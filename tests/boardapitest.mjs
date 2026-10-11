// BOARDAPI1: the Practice Board's server (lib/board.ts, app/api/board/*), built
// dark (11 Oct 2026; spec §9.5–§9.11, §9.15–§9.17). Node only, every network
// call mocked: an in-memory Upstash behind fetch that runs the plain commands
// and models each board script by its marker line (the slpcommunityapi
// pattern), with a switch that makes any command fail the way kvCmd sees an
// error, and a Resend fake that records each email. The clock is the test's.
//
// What it holds the server to: it ships off and fails closed (production is
// production unless Vercel says otherwise, previews write only under
// board-pv:, no secret means no board); the phone can never confirm its own
// request; no response carries a link; no name, age, sound, fid, childId,
// address or raw IP is ever stored; a day counts once, by the server's clock,
// never early and never past the calendar; deletion always works, races
// included, and leaves no key without a time limit.
//
// BOARD_REDIS_SERVER=/usr/bin/redis-server node tests/boardapitest.mjs runs
// every check against a real Redis, executing the real Lua scripts.
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (spec) => spec.startsWith('@/') ? loadTs(path.join(ROOT, spec.slice(2) + '.ts')) : require(spec);
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return mod.exports;
}

let checks = 0, fails = 0;
function ok(label, condition, detail) {
  checks++; if (!condition) fails++;
  realLog((condition ? 'PASS ' : 'FAIL ') + label + (condition || detail === undefined ? '' : ' → ' + JSON.stringify(detail).slice(0, 600)));
}
const realLog = console.log.bind(console);
const originalConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error };
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let redisProcess, redisDir;
function finish() {
  Object.assign(console, originalConsole);
  globalThis.fetch = originalFetch; Date.now = originalNow;
  if (redisProcess) redisProcess.kill();
  if (redisDir) try { rmSync(redisDir, { recursive: true, force: true }); } catch {}
  realLog(`\n${checks - fails}/${checks} checks passed` + (usingRedis ? ' (real Redis)' : ''));
  process.exit(fails ? 1 : 0);
}

// ── Load the server ──────────────────────────────────────────────────────────
const ROUTE_NAMES = ['start', 'confirm', 'claim', 'day', 'view', 'nick', 'leave', 'remove', 'admin'];
let board; const R = {};
const usingRedis = !!process.env.BOARD_REDIS_SERVER;
try {
  board = loadTs(path.join(ROOT, 'lib/board.ts'));
  for (const n of ROUTE_NAMES) R[n] = loadTs(path.join(ROOT, 'app/api/board', n, 'route.ts'));
} catch (e) {
  ok('the board server exists: lib/board.ts and app/api/board/{' + ROUTE_NAMES.join(',') + '}/route.ts', false, e.message);
  finish();
}
const REPS = loadTs(path.join(ROOT, 'app/api/reps/route.ts'));
const SONA = readFileSync(path.join(ROOT, 'public/sona.js'), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');

// ── The in-memory Upstash ────────────────────────────────────────────────────
const store = new Map();
function ent(k) { const e = store.get(k); if (!e) return null; if (e.exp != null && e.exp <= Date.now()) { store.delete(k); return null; } return e; }
function of(k, t, create) {
  let e = ent(k);
  if (!e) { if (!create) return null; e = { t, v: t === 'string' ? '' : new Map(), exp: null }; store.set(k, e); }
  if (e.t !== t) throw new Error('WRONGTYPE ' + k);
  return e.v;
}
function emptied(k) { const e = store.get(k); if (e && e.t !== 'string' && e.v.size === 0) store.delete(k); }
function bound(s) { s = String(s); const ex = s.startsWith('('); const v = ex ? s.slice(1) : s; return { ex, v: v === '+inf' ? Infinity : v === '-inf' ? -Infinity : Number(v) }; }
function M(op, ...a) {
  a = a.map((x) => (typeof x === 'number' ? String(x) : x));
  const k = a[0];
  switch (op.toUpperCase()) {
    case 'GET': return ent(k) ? of(k, 'string') : null;
    case 'MGET': return a.map((key) => { const e = ent(key); return e && e.t === 'string' ? e.v : null; });
    case 'SET': {
      let nx = false, ms = null;
      for (let i = 2; i < a.length; i++) { const f = a[i].toUpperCase(); if (f === 'NX') nx = true; else if (f === 'EX') ms = Number(a[++i]) * 1000; else if (f === 'PX') ms = Number(a[++i]); }
      if (nx && ent(k)) return null;
      store.set(k, { t: 'string', v: String(a[1]), exp: ms == null ? null : Date.now() + ms });
      return 'OK';
    }
    case 'DEL': { let n = 0; for (const key of a) if (ent(key)) { store.delete(key); n++; } return n; }
    case 'EXISTS': return a.filter((key) => ent(key)).length;
    case 'INCR': case 'INCRBY': {
      const by = op.toUpperCase() === 'INCR' ? 1 : Number(a[1]);
      const e = ent(k); const n = (e ? Number(of(k, 'string')) : 0) + by;
      if (e) e.v = String(n); else store.set(k, { t: 'string', v: String(n), exp: null });
      return n;
    }
    case 'EXPIRE': { const e = ent(k); if (!e) return 0; e.exp = Date.now() + Number(a[1]) * 1000; ent(k); return 1; }
    case 'EXPIREAT': { const e = ent(k); if (!e) return 0; e.exp = Number(a[1]) * 1000; ent(k); return 1; }
    case 'TTL': { const e = ent(k); return !e ? -2 : e.exp == null ? -1 : Math.round((e.exp - Date.now()) / 1000); }
    case 'PTTL': { const e = ent(k); return !e ? -2 : e.exp == null ? -1 : e.exp - Date.now(); }
    case 'TYPE': { const e = ent(k); return e ? e.t : 'none'; }
    case 'KEYS': return [...store.keys()].filter((key) => ent(key));
    case 'FLUSHALL': store.clear(); return 'OK';
    case 'HSET': { const h = of(k, 'hash', true); let n = 0; for (let i = 1; i < a.length; i += 2) { if (!h.has(a[i])) n++; h.set(a[i], String(a[i + 1])); } return n; }
    case 'HGET': { const h = of(k, 'hash'); return h && h.has(a[1]) ? h.get(a[1]) : null; }
    case 'HMGET': { const h = of(k, 'hash'); return a.slice(1).map((f) => (h && h.has(f) ? h.get(f) : null)); }
    case 'HGETALL': { const h = of(k, 'hash'); return h ? [...h].flat() : []; }
    case 'ZSCORE': { const z = of(k, 'zset'); return z && z.has(a[1]) ? String(z.get(a[1])) : null; }
    case 'ZINCRBY': { const z = of(k, 'zset', true); const n = (z.get(a[2]) || 0) + Number(a[1]); z.set(a[2], n); return String(n); }
    case 'ZCARD': { const z = of(k, 'zset'); return z ? z.size : 0; }
    case 'ZREM': { const z = of(k, 'zset'); if (!z) return 0; let n = 0; for (const m of a.slice(1)) if (z.delete(m)) n++; emptied(k); return n; }
    case 'ZCOUNT': { const z = of(k, 'zset'); if (!z) return 0; const lo = bound(a[1]), hi = bound(a[2]); return [...z.values()].filter((s) => (lo.ex ? s > lo.v : s >= lo.v) && (hi.ex ? s < hi.v : s <= hi.v)).length; }
    case 'ZREVRANGE': case 'ZRANGE': {
      const z = of(k, 'zset'); if (!z) return [];
      const rev = op.toUpperCase() === 'ZREVRANGE';
      const sorted = [...z].sort((x, y) => (x[1] - y[1]) || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
      if (rev) sorted.reverse();
      let start = Number(a[1]), stop = Number(a[2]); if (stop < 0) stop = sorted.length + stop;
      const ws = String(a[3] || '').toUpperCase() === 'WITHSCORES';
      return sorted.slice(start, stop + 1).flatMap(([m, s]) => (ws ? [m, String(s)] : [m]));
    }
    case 'ZUNIONSTORE': {
      const out = new Map();
      for (let i = 0; i < Number(a[1]); i++) { const z = of(a[2 + i], 'zset'); if (z) for (const [m, s] of z) out.set(m, (out.get(m) || 0) + s); }
      store.delete(k); if (out.size) store.set(k, { t: 'zset', v: out, exp: null });
      return out.size;
    }
    case 'EVAL': return evalModel(a[0], Number(a[1]), a.slice(2));
    default: throw new Error('model: unknown command ' + op);
  }
}
// cjson writes an empty Lua table as {}, never []: the routes must cope.
const enc = (o) => JSON.stringify(o, (key, v) => (Array.isArray(v) && v.length === 0 ? {} : v));
function leaveM(P, id, zkeys, days) {
  const mem = P + 'mem:' + id;
  if (!M('EXISTS', mem)) return 0;
  let n = 0;
  const f = M('HMGET', mem, 'nick', 'rid');
  if (f[0]) { const nk = P + 'nick:' + f[0]; if (M('GET', nk) === id) n += M('DEL', nk); }
  for (const z of zkeys) n += M('ZREM', z, id);
  for (const d of days) n += M('DEL', P + 'tick:' + id + ':' + d);
  n += M('DEL', mem);
  if (f[1]) {
    const rk = P + 'rid:' + f[1]; const ids = M('HGET', rk, 'ids');
    if (ids) { const keep = ids.split(',').filter((x) => x && x !== id); if (!keep.length) M('DEL', rk); else M('HSET', rk, 'ids', keep.join(',')); }
  }
  return n;
}
function listsM(A, from) {
  const nz = Number(A[from - 1]); const zkeys = A.slice(from, from + nz);
  const nd = Number(A[from + nz]); return [zkeys, A.slice(from + nz + 1, from + nz + 1 + nd)];
}
const SCRIPTS = {
  'board:mail'(K, A) {
    const g = M('INCR', K[0]); if (M('TTL', K[0]) < 0) M('EXPIRE', K[0], A[0]);
    if (g > Number(A[2])) return [g, 0];
    const a = M('INCR', K[1]); if (M('TTL', K[1]) < 0) M('EXPIRE', K[1], A[1]);
    return [g, a];
  },
  'board:start'(K, A) {
    const pend = K[0];
    if (A[0] === 'new') {
      if (M('EXISTS', pend)) return 0;
      M('HSET', pend, 'n', A[3], 'buddies', A[4], 'tz', A[5], 'code', A[6], 'ok', '0', 'cidh1', A[2], 'xh', A[2]); M('EXPIRE', pend, A[1]);
      return 1;
    }
    if (!M('EXISTS', pend)) return 0;
    const f = M('HMGET', pend, 'mids', 'cidh1', 'cidh2', 'cidh3', 'xh');
    if (f[0]) return 0;
    if (!f[1]) M('HSET', pend, 'cidh1', A[2]);
    else if (!f[2]) M('HSET', pend, 'cidh2', A[2]);
    else if (!f[3]) M('HSET', pend, 'cidh3', A[2]);
    else M('HSET', pend, 'cidh1', f[2], 'cidh2', f[3], 'cidh3', A[2]);
    const xs = (f[4] || '').split(' ').filter(Boolean); xs.push(A[2]);
    M('HSET', pend, 'xh', xs.slice(-Number(A[3])).join(' ')); M('EXPIRE', pend, A[1]);
    return 1;
  },
  'board:confirm'(K, A) {
    if (!M('EXISTS', K[0])) return 0;
    const h = M('HMGET', K[0], 'cidh1', 'cidh2', 'cidh3');
    if (!h.includes(A[0])) return 0;
    M('HSET', K[0], 'ok', '1'); return 1;
  },
  'board:claim'(K, A) {
    const [pend, rk, jk] = K; const [P, rid, joined] = A; const ttl = Number(A[3]), per = Number(A[4]), given = Number(A[5]);
    if (!M('EXISTS', pend)) return enc({ s: 'expired' });
    const f = M('HMGET', pend, 'ok', 'mids', 'n', 'buddies', 'tz', 'code', 'cidh1', 'cidh2', 'cidh3', 'xh');
    if (f[0] !== '1') return enc({ s: 'waiting' });
    if (f[1]) return enc({ s: 'done', m: f[1].split(',').filter(Boolean).map((id) => [id, M('HGET', P + 'mem:' + id, 'nick') || '']) });
    const n = Number(f[2]) || 0;
    if (n < 1 || n > given) return enc({ s: 'busy' });
    const buds = (f[3] || '').split(',').filter(Boolean);
    const made = [], ids = [], out = [];
    for (let i = 1; i <= n; i++) {
      const base = 8 + (i - 1) * (per + 1); const id = A[base - 1]; let nick = null;
      for (let j = 1; j <= per; j++) { const cand = A[base - 1 + j]; if (M('SET', P + 'nick:' + cand, id, 'NX', 'EX', ttl)) { nick = cand; break; } }
      if (!nick) { for (const key of made) M('DEL', key); return enc({ s: 'busy' }); }
      made.push(P + 'nick:' + nick); ids.push(id); out.push([id, nick]);
    }
    for (let i = 0; i < n; i++) {
      const mem = P + 'mem:' + ids[i];
      M('HSET', mem, 'nick', out[i][1], 'buddy', buds[i] || 'fox', 'tz', f[4], 'tz0', f[4], 'tzAt', '0', 'joined', joined, 'rid', rid, 'nkd', '', 'nkm', '', 'nkn', '0');
      M('EXPIRE', mem, ttl);
    }
    const r = [rk, 'ids', ids.join(','), 'code', f[5]];
    for (let i = 6; i <= 8; i++) if (f[i]) r.push('cidh' + (i - 5), f[i]);
    if (f[9]) r.push('xh', f[9]);
    M('HSET', ...r); M('EXPIRE', rk, ttl);
    M('HSET', pend, 'mids', ids.join(','));
    const joins = M('INCRBY', jk, n); if (M('TTL', jk) < 0) M('EXPIRE', jk, A[6]);
    return enc({ s: 'new', m: out, joins });
  },
  'board:day'(K, A) {
    const [mem, dk, tk, mz] = K; const [P, id] = A; const ceiling = Number(A[2]); const now = Number(A[7]);
    if (!M('EXISTS', mem)) return enc({ s: 'gone' });
    const dn = M('INCR', dk); if (M('TTL', dk) < 0) M('EXPIRE', dk, A[8]);
    if (dn > Number(A[9])) return enc({ s: 'limit' });
    const cur = Number(M('ZSCORE', mz, id) || '0');
    if (M('EXISTS', tk)) return enc({ s: 'dup', days: cur });
    if (cur + 1 > ceiling) return enc({ s: 'ceiling', days: cur });
    if (!M('SET', tk, '1', 'NX', 'EX', A[10])) return enc({ s: 'dup', days: cur });
    const days = Number(M('ZINCRBY', mz, 1, id));
    M('EXPIREAT', mz, A[4]); M('EXPIRE', mem, A[3]);
    const f = M('HMGET', mem, 'nick', 'rid', 'tz', 'tz0', 'tzAt');
    if (f[0]) M('EXPIRE', P + 'nick:' + f[0], A[3]);
    if (f[1]) M('EXPIRE', P + 'rid:' + f[1], A[3]);
    if (A[5] !== '') M('HSET', mem, 'buddy', A[5]);
    if (A[6] !== '' && A[6] !== f[2]) {
      const t = Number(A[6]), t0 = Number(f[3] || '0'), at = Number(f[4] || '0');
      if (Math.abs(t - t0) <= 120 && now - at >= 72000) M('HSET', mem, 'tz', A[6], 'tzAt', now);
    }
    return enc({ s: 'counted', days });
  },
  'board:view'(K, A) {
    const [mem, mz, snap, mark, vk] = K; const [P, id] = A;
    if (!M('EXISTS', mem)) return enc({ s: 'gone' });
    const vn = M('INCR', vk); if (M('TTL', vk) < 0) M('EXPIRE', vk, 3600);
    if (vn > Number(A[2])) return enc({ s: 'limit' });
    if (!M('EXISTS', mark)) { M('ZUNIONSTORE', snap, 1, mz); M('EXPIRE', snap, A[3]); M('SET', mark, '1', 'EX', A[3]); }
    const rows = M('ZREVRANGE', snap, 0, 49, 'WITHSCORES'); const out = [];
    for (let i = 0; i < rows.length; i += 2) {
      const h = M('HMGET', P + 'mem:' + rows[i], 'nick', 'buddy');
      if (h[0]) out.push([rows[i] === id ? 1 : 0, h[0], h[1] || 'fox', Number(rows[i + 1])]); else M('ZREM', snap, rows[i]);
    }
    const seen = new Set(), ties = [];
    for (const r of out) if (!seen.has(r[3])) { seen.add(r[3]); ties.push([r[3], M('ZCOUNT', snap, r[3], r[3])]); }
    const days = Number(M('ZSCORE', mz, id) || '0');
    const above = days > 0 ? M('ZCOUNT', snap, '(' + days, '+inf') : 0;
    const me = M('HMGET', mem, 'nick', 'buddy');
    return enc({ s: 'ok', rows: out, ties, card: M('ZCARD', snap), days, above, snapme: Number(M('ZSCORE', snap, id) || '-1'), nick: me[0], buddy: me[1] || 'fox' });
  },
  'board:nick'(K, A) {
    const [mem, hk] = K; const [P, id, day, ym] = A;
    if (!M('EXISTS', mem)) return enc({ s: 'gone' });
    const hn = M('INCR', hk); if (M('TTL', hk) < 0) M('EXPIRE', hk, 3600);
    if (hn > Number(A[4])) return enc({ s: 'limit' });
    const f = M('HMGET', mem, 'nick', 'nkd', 'nkm', 'nkn');
    if (f[1] === day) return enc({ s: 'limit' });
    let used = Number(f[3] || '0') || 0; if (f[2] !== ym) used = 0;
    if (used >= 3) return enc({ s: 'limit' });
    const pttl = M('PTTL', mem); if (pttl <= 0) return enc({ s: 'busy' });
    for (const cand of A.slice(5)) {
      if (M('SET', P + 'nick:' + cand, id, 'NX', 'PX', pttl)) {
        if (f[0] && f[0] !== cand) { const old = P + 'nick:' + f[0]; if (M('GET', old) === id) M('DEL', old); }
        M('HSET', mem, 'nick', cand, 'nkd', day, 'nkm', ym, 'nkn', used + 1);
        return enc({ s: 'ok', nick: cand });
      }
    }
    return enc({ s: 'busy' });
  },
  'board:leave'(K, A) { const [zkeys, days] = listsM(A, 3); return leaveM(A[0], A[1], zkeys, days); },
  'board:remove'(K, A) {
    const [pend, rk] = K; const [P, cidh] = A; const [zkeys, days] = listsM(A, 3);
    const holds = (key) => { const h = M('HMGET', key, 'cidh1', 'cidh2', 'cidh3', 'xh'); return h.slice(0, 3).includes(cidh) || (h[3] || '').split(' ').includes(cidh); };
    let found = 0, n = 0;
    if (M('EXISTS', rk) && holds(rk)) { found = 1; for (const id of (M('HGET', rk, 'ids') || '').split(',').filter(Boolean)) n += leaveM(P, id, zkeys, days); M('DEL', rk); }
    if (M('EXISTS', pend) && holds(pend)) { found = 1; for (const id of (M('HGET', pend, 'mids') || '').split(',').filter(Boolean)) n += leaveM(P, id, zkeys, days); M('DEL', pend); }
    return [found, n];
  },
};
function evalModel(script, nk, rest) {
  const m = /^-- (board:\w+)\n/.exec(script);
  if (!m || !SCRIPTS[m[1]]) throw new Error('model: no script for ' + JSON.stringify(script.slice(0, 40)));
  return SCRIPTS[m[1]](rest.slice(0, nk), rest.slice(nk));
}

// ── …or a real Redis ─────────────────────────────────────────────────────────
function respParse(buf, start = 0) {
  const end = buf.indexOf('\r\n', start); if (end < 0) return null;
  const prefix = String.fromCharCode(buf[start]), line = buf.toString('utf8', start + 1, end); let pos = end + 2;
  if (prefix === '+' || prefix === ':' || prefix === '-') return { value: prefix === ':' ? Number(line) : line, end: pos, error: prefix === '-' };
  if (prefix === '$') { const n = Number(line); if (n === -1) return { value: null, end: pos }; if (buf.length < pos + n + 2) return null; return { value: buf.toString('utf8', pos, pos + n), end: pos + n + 2 }; }
  if (prefix === '*') { const n = Number(line), values = []; if (n === -1) return { value: null, end: pos }; for (let i = 0; i < n; i++) { const p = respParse(buf, pos); if (!p) return null; if (p.error) return { value: p.value, end: p.end, error: true }; values.push(p.value); pos = p.end; } return { value: values, end: pos }; }
  throw new Error('Unexpected Redis response');
}
function realRedis(cmd) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(path.join(redisDir, 'redis.sock')); let data = Buffer.alloc(0);
    socket.setTimeout(5000, () => socket.destroy(new Error('Redis timed out')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(Buffer.concat([Buffer.from('*' + cmd.length + '\r\n'), ...cmd.flatMap((arg) => { const b = Buffer.from(String(arg)); return [Buffer.from('$' + b.length + '\r\n'), b, Buffer.from('\r\n')]; })])));
    socket.on('data', (chunk) => { data = Buffer.concat([data, chunk]); const out = respParse(data); if (out) { socket.end(); out.error ? reject(new Error(out.value)) : resolve(out.value); } });
  });
}
async function kv(cmd) { return usingRedis ? realRedis(cmd) : M(...cmd); }

// ── fetch: the store, Resend, nothing else ───────────────────────────────────
const KV = 'https://board-kv.test.invalid';
const SITE = 'https://sona.test.invalid';
const SECRET = 'test-only-board-secret-0123456789';
const FOUNDER = 'founder-key-for-board-tests';
const commands = [], emails = [], storeErrors = [], external = [];
let failOn = null, delayOn = null, resendStatus = 200;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === KV) {
    const cmd = JSON.parse(init.body);
    commands.push(cmd);
    const wait = delayOn ? delayOn(cmd) : 0;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    if (failOn && failOn(cmd)) return new Response('{"error":"offline"}', { status: 500 });
    try { return Response.json({ result: await kv(cmd) }); }
    catch (e) { storeErrors.push(String(e.message) + ' in ' + JSON.stringify(cmd).slice(0, 80)); return new Response('{"error":"' + e.message + '"}', { status: 400 }); }
  }
  if (u === 'https://api.resend.com/emails') {
    emails.push({ ...JSON.parse(init.body), auth: (init.headers || {}).Authorization });
    return new Response('{"id":"x"}', { status: resendStatus });
  }
  external.push(u);
  throw new Error('Unexpected outbound call');
};
const isEval = (cmd, marker) => cmd[0] === 'EVAL' && String(cmd[1]).startsWith('-- board:' + marker + '\n');

// Every console line, to prove no address and no link ever reaches a log.
const logs = [];
for (const k of ['log', 'info', 'warn', 'error']) console[k] = (...args) => logs.push(args.map(String).join(' '));

// ── Environment and clock ────────────────────────────────────────────────────
const ENV_KEYS = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'VERCEL', 'VERCEL_ENV', 'BOARD_SECRET', 'BOARD_SECRET_PREV', 'BOARD_FORCE_LIVE', 'BOARD_PAUSE', 'RESEND_API_KEY', 'RESEND_FROM', 'FOUNDER_KEY'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function env(over = {}) {
  for (const k of ENV_KEYS) delete process.env[k];
  const base = { KV_REST_API_URL: KV, KV_REST_API_TOKEN: 'test-only-kv-token', BOARD_SECRET: SECRET, BOARD_FORCE_LIVE: '1', RESEND_API_KEY: 'test-only-resend', FOUNDER_KEY: FOUNDER };
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== undefined) process.env[k] = v;
}
let NOW = Date.UTC(2027, 2, 10, 12, 0, 0);
Date.now = () => NOW;
const at = (iso) => { NOW = Date.parse(iso); };
const P = () => board.boardPrefix();
async function flush() { await kv(['FLUSHALL']); }

// ── Requests ─────────────────────────────────────────────────────────────────
const INJECT = { name: 'ZQ~NAME~QZ', childName: 'ZQ~NAME~QZ', childId: 'ZQ~CHILD~QZ', fid: 'ZQ~FID~QZ', age: 'ZQ~AGE~QZ', childAge: 'ZQ~AGE~QZ', sound: 'ZQ~SOUND~QZ', focusSounds: ['ZQ~SOUND~QZ'], slpCode: 'ZQ~SLP~QZ' };
const responses = [];
let ipSeq = 1;
const nextIp = () => '198.18.' + ((ipSeq >> 8) & 255) + '.' + (ipSeq++ & 255);
const IPS = new Set();
async function call(route, method, body, opts = {}) {
  const ip = opts.ip || nextIp(); IPS.add(ip);
  const headers = new Headers({ 'content-type': opts.form ? 'application/x-www-form-urlencoded' : 'application/json', 'x-real-ip': ip });
  if (opts.origin !== null) headers.set('origin', opts.origin === undefined ? SITE : opts.origin);
  if (opts.founder) headers.set('x-founder-key', opts.founder);
  const init = { method, headers };
  if (method !== 'GET') init.body = opts.raw !== undefined ? opts.raw : opts.form ? new URLSearchParams(body).toString() : JSON.stringify(body);
  let res;
  try { res = await R[route][method](new Request(SITE + '/api/board/' + route + (opts.query || ''), init)); }
  catch (e) { return { status: 599, json: null, text: 'threw: ' + e.stack, headers: new Headers() }; }
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  const out = { route, method, status: res.status, json, text, headers: res.headers };
  responses.push(out);
  return out;
}
let mailSeq = 0;
const nextEmail = () => 'grownup' + (++mailSeq) + '@family.example';
const idOf = (token) => String(token).split('.')[1];
const ridOf = (pend) => String(pend).split('.')[1];
function linksOf(mail) {
  const c = /\/api\/board\/confirm\?c=(\S+)/.exec(mail.text), x = /\/api\/board\/remove\?x=(\S+)/.exec(mail.text);
  return { c: c && decodeURIComponent(c[1]), x: x && decodeURIComponent(x[1]) };
}
function start(email, kids, extra = {}, opts = {}) {
  return call('start', 'POST', { ...INJECT, email, kids: kids.map((b) => ({ buddy: b, name: 'ZQ~NAME~QZ', age: 'ZQ~AGE~QZ' })), tz: 0, ...extra }, opts);
}
const confirm = (c, opts) => call('confirm', 'POST', { c }, { form: true, ...opts });
const claim = (pend, opts) => call('claim', 'POST', { ...INJECT, pend }, opts);
const day = (token, ago, extra = {}, opts) => call('day', 'POST', { ...INJECT, token, ago, ...extra }, opts);
const view = (token, opts) => call('view', 'POST', { ...INJECT, token }, opts);
const nick = (token, opts) => call('nick', 'POST', { ...INJECT, token }, opts);
const leave = (token, opts) => call('leave', 'POST', { ...INJECT, token }, opts);
async function join(kids = ['fox'], o = {}) {
  const email = o.email || nextEmail();
  const s = await start(email, kids, { tz: o.tz === undefined ? 0 : o.tz });
  if (s.status !== 200) throw new Error('start answered ' + s.status + ' ' + s.text);
  const { c, x } = linksOf(emails[emails.length - 1]);
  const cf = await confirm(c);
  if (cf.status !== 200) throw new Error('confirm answered ' + cf.status);
  const cl = await claim(s.json.pend);
  if (cl.status !== 200) throw new Error('claim answered ' + cl.status + ' ' + cl.text);
  return { email, pend: s.json.pend, code: s.json.code, c, x, members: cl.json.members, tokens: cl.json.members.map((m) => m.token), ids: cl.json.members.map((m) => idOf(m.token)), rid: ridOf(s.json.pend) };
}
async function keysLike(prefix) { return (await kv(['KEYS', '*'])).filter((k) => k.startsWith(prefix)); }
async function scenario(label, run) {
  try { env(); failOn = null; delayOn = null; resendStatus = 200; await run(); }
  catch (e) { ok(label + ' completes', false, e.stack); }
  failOn = null; delayOn = null;
  // Whatever a scenario left in the store, every key has a time limit.
  const noTtl = [];
  for (const key of await kv(['KEYS', '*'])) if ((await kv(['TTL', key])) === -1) noTtl.push(key);
  ok(label + ': every key left in the store has a time limit', noTtl.length === 0, noTtl.slice(0, 5));
}
// A TTL the store reports for an absolute time: the model runs on the test's
// clock, a real Redis on the real one.
const ttlUntil = (ms) => (ms - (usingRedis ? originalNow() : NOW)) / 1000;
const memberDay = (ms, tz, ago) => new Date(ms - ago * 1000 + tz * 60000).toISOString().slice(0, 10);
const dayNum = (d) => Math.round(Date.parse(d + 'T00:00:00Z') / 86400000);

// ── Run ──────────────────────────────────────────────────────────────────────
try {
  if (usingRedis) {
    redisDir = mkdtempSync(path.join(os.tmpdir(), 'sona-board-redis-'));
    redisProcess = spawn(process.env.BOARD_REDIS_SERVER, ['--port', '0', '--unixsocket', path.join(redisDir, 'redis.sock'), '--save', '', '--appendonly', 'no', '--loglevel', 'warning'], { cwd: redisDir, stdio: 'ignore' });
    for (let i = 0; !existsSync(path.join(redisDir, 'redis.sock')) && i < 200; i++) await new Promise((r) => setTimeout(r, 25));
  }

  // 1. Switches, environment, sources ────────────────────────────────────────
  await scenario('switches', async () => {
    const lib = readFileSync(path.join(ROOT, 'lib/board.ts'), 'utf8');
    const server = /export const BOARD_LIVE = (true|false);/.exec(lib);
    const client = /const BOARD_LIVE = (true|false);/.exec(noComments(SONA));
    // Until the client block (BOARD2) lands, sona.js has no switch: no client is a client that is off.
    const clientLive = client ? client[1] === 'true' : false;
    ok('BOARD_LIVE is written once in lib/board.ts', !!server);
    ok('BOARD_LIVE is the same in lib/board.ts and public/sona.js (' + (server && server[1]) + ' / ' + (client ? client[1] : 'no client switch yet, off') + ')', !!server && (server[1] === 'true') === clientLive);
    const block = /const CHARACTERS = \[([\s\S]*?)\n\s*\];/.exec(SONA);
    const ids = block ? [...block[1].matchAll(/\{\s*id:\s*['"]([a-z]+)['"]/g)].map((m) => m[1]) : [];
    ok('BUDDY_IDS is exactly the CHARACTERS ids', ids.length > 0 && JSON.stringify(board.BUDDY_IDS) === JSON.stringify(ids), { BUDDY_IDS: board.BUDDY_IDS, CHARACTERS: ids });
    const env1 = (o) => { env(o); return board.boardEnv(); };
    ok('no VERCEL is a developer\'s machine', env1({}) === 'local');
    ok('VERCEL with VERCEL_ENV=preview or development is a preview', env1({ VERCEL: '1', VERCEL_ENV: 'preview' }) === 'preview' && env1({ VERCEL: '1', VERCEL_ENV: 'development' }) === 'preview');
    ok('VERCEL set with no VERCEL_ENV counts as production (fails closed)', env1({ VERCEL: '1' }) === 'prod' && board.boardPrefix() === 'board:');
    ok('VERCEL_ENV=production is production, prefix board:', env1({ VERCEL: '1', VERCEL_ENV: 'production' }) === 'prod' && board.boardPrefix() === 'board:');
    env({ VERCEL: '1', VERCEL_ENV: 'production', BOARD_FORCE_LIVE: '1' });
    ok('BOARD_FORCE_LIVE is ignored in production', board.boardLive() === board.BOARD_LIVE);
    env({ VERCEL: '1', VERCEL_ENV: 'preview' });
    ok('a preview uses board-pv:', board.boardPrefix() === 'board-pv:');
    env({ BOARD_SECRET: undefined });
    ok('the fixed development secret exists only with VERCEL unset', board.boardSecrets().length === 1 && board.boardSecrets()[0] === 'sona-board-dev');
    env({ BOARD_SECRET: undefined, VERCEL: '1', VERCEL_ENV: 'preview' });
    ok('…not on a preview', board.boardSecrets().length === 0);
    env({ BOARD_SECRET: undefined, VERCEL: '1' });
    ok('…not in production', board.boardSecrets().length === 0);
    env({ BOARD_SECRET_PREV: 'old-secret-for-rotation-test' });
    ok('the key ring is BOARD_SECRET then BOARD_SECRET_PREV', JSON.stringify(board.boardSecrets()) === JSON.stringify([SECRET, 'old-secret-for-rotation-test']));

    for (const n of ROUTE_NAMES) {
      const src = readFileSync(path.join(ROOT, 'app/api/board', n, 'route.ts'), 'utf8');
      ok(n + ' runs on nodejs', R[n].runtime === 'nodejs');
      ok(n + ' never calls formData() (mictest: only the founder clip tools take a file)', !/formData\(/.test(noComments(src)));
      ok(n + ' never reads or keeps a name, age, sound, fid, childId or clinician code', !/body\.(name|childName|age|childAge|sound|focusSounds|fid|childId|slpCode|code\b)/.test(src));
    }
    ok('every board script starts with its marker line', ['MAIL', 'START', 'CONFIRM', 'CLAIM', 'DAY', 'VIEW', 'NICK', 'LEAVE', 'REMOVE'].every((k) => new RegExp('^-- board:' + k.toLowerCase() + '\\n').test(board['SCRIPT_' + k])));
    ok('every script sets a time limit on what it creates (no bare SET without EX/PX)', Object.keys(board).filter((k) => k.startsWith('SCRIPT_')).every((k) => !/'SET', [^)]*\)/.test(board[k].replace(/'SET', [^)]*'(EX|PX)'[^)]*\)/g, ''))));
    ok('no script reads a clock (the route passes days in)', Object.keys(board).filter((k) => k.startsWith('SCRIPT_')).every((k) => !/'TIME'/.test(board[k])));
  });

  // 2. Off: 503 everywhere but the three that must always work ──────────────
  await scenario('off', async () => {
    await flush();
    const j = await join(['fox']);
    env({ BOARD_FORCE_LIVE: undefined });
    // Only while it ships dark: at go-live (step 12) there is no "off" to test.
    if (board.BOARD_LIVE) { realLog('(BOARD_LIVE is on: the "not live" checks are skipped)'); return; }
    ok('not live: nothing turns the board on but the switch or a forced preview', board.boardLive() === false);
    for (const [route, body] of [['start', { email: nextEmail(), kids: [{ buddy: 'fox' }], tz: 0 }], ['claim', { pend: j.pend }], ['day', { token: j.tokens[0], ago: 0 }], ['view', { token: j.tokens[0] }], ['nick', { token: j.tokens[0] }]]) {
      const r = await call(route, 'POST', body);
      ok('not live: ' + route + ' answers 503 {off:true}', r.status === 503 && r.json && r.json.off === true, r);
    }
    const cg = await call('confirm', 'GET', null, { query: '?c=' + encodeURIComponent(j.c) });
    const cp = await confirm(j.c);
    ok('not live: the confirm link answers 503 and changes nothing', cg.status === 503 && cp.status === 503 && /off/.test(cg.text));
    const rg = await call('remove', 'GET', null, { query: '?x=' + encodeURIComponent(j.x) });
    ok('not live: the remove link still shows its button', rg.status === 200 && /method="POST"/.test(rg.text));
    const ad = await call('admin', 'GET', null, { founder: FOUNDER });
    ok('not live: the founder view still works', ad.status === 200 && ad.json && ad.json.ok === true, ad);
    const lv = await leave(j.tokens[0]);
    ok('not live: leave still deletes', lv.status === 200 && lv.json.deleted === true && (await kv(['EXISTS', P() + 'mem:' + j.ids[0]])) === 0, lv);

    env({ VERCEL: '1', VERCEL_ENV: 'production', BOARD_SECRET: undefined });
    for (const route of ['leave', 'start']) {
      const r = await call(route, 'POST', route === 'leave' ? { token: j.tokens[0] } : { email: nextEmail(), kids: [{ buddy: 'fox' }], tz: 0 });
      ok('production without BOARD_SECRET: ' + route + ' answers 503', r.status === 503 && r.json.off === true, r);
    }
    const rm = await confirm(j.c);
    ok('production without BOARD_SECRET: the confirm link answers 503', rm.status === 503);
    env({ VERCEL: '1', BOARD_FORCE_LIVE: '1' });
    const st = await start(nextEmail(), ['fox']);
    ok('VERCEL with no VERCEL_ENV is production: BOARD_FORCE_LIVE cannot turn it on', st.status === 503 && st.json.off === true);
    env({ VERCEL: '1', VERCEL_ENV: 'preview', BOARD_SECRET: undefined });
    const pv = await start(nextEmail(), ['fox']);
    ok('a preview without BOARD_SECRET answers 503 (the dev secret is only local)', pv.status === 503 && pv.json.off === true);
    env({ BOARD_SECRET: undefined });
    const lo = await join(['cat']);
    ok('on a developer\'s machine the dev secret works', lo.members.length === 1);
  });

  // 3. start ─────────────────────────────────────────────────────────────────
  await scenario('start', async () => {
    await flush();
    const e0 = emails.length;
    for (const bad of ['', 'nope', 'a@b', 'x'.repeat(250) + '@family.example', 'a\ud800@family.example', 'two words@family.example', 42]) {
      const r = await call('start', 'POST', { email: bad, kids: [{ buddy: 'fox' }], tz: 0 });
      ok('start refuses the email ' + JSON.stringify(String(bad).slice(0, 20)), r.status === 400 && r.json.error === 'email', r.json);
    }
    for (const kids of [[], [1, 2, 3, 4, 5].map(() => ({ buddy: 'fox' })), 'fox', null]) {
      const r = await call('start', 'POST', { email: nextEmail(), kids, tz: 0 });
      ok('start refuses kids ' + JSON.stringify(kids).slice(0, 30), r.status === 400 && r.json.error === 'kids', r.json);
    }
    for (const tz of [7, 900, -735, '60', null]) {
      const r = await call('start', 'POST', { email: nextEmail(), kids: [{ buddy: 'fox' }], tz });
      ok('start refuses the time zone ' + JSON.stringify(tz), r.status === 400 && r.json.error === 'tz', r.json);
    }
    ok('nothing above sent an email', emails.length === e0);
    const email = 'Parent.One@Family.example';
    const before = emails.length;
    const r = await start(email, ['dragon', 'unicorn', 'robot']);
    ok('a good request answers {ok, pend, code}', r.status === 200 && r.json.ok === true && /^p\./.test(r.json.pend) && /^[ACDEFHJKMNPQRTWXY347]{3}$/.test(r.json.code), r.json);
    ok('Resend is called once, to that address', emails.length === before + 1 && JSON.stringify(emails[before].to) === JSON.stringify([email]));
    const mail = emails[before], { c, x } = linksOf(mail);
    ok('the email carries the code (subject and body)', mail.subject.includes(r.json.code) && mail.html.includes(r.json.code) && mail.text.includes(r.json.code));
    ok('the email carries a confirm link and a remove link', /^c\./.test(c || '') && /^x\./.test(x || '') && mail.html.includes('/api/board/confirm?c=') && mail.html.includes('/api/board/remove?x='));
    ok('the email says how many children ("3 children")', mail.text.includes('3 children'));
    const hrefs = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    ok('the email has no picture and no link but confirm, remove and privacy', !/<img/i.test(mail.html) && hrefs.length === 3 && hrefs.every((h) => /\/api\/board\/(confirm|remove)\?|\/privacy\.html$/.test(h)), hrefs);
    ok('the email holds nothing about a child', !/ZQ~[A-Z]+~QZ/.test(JSON.stringify(mail)));
    const pk = P() + 'pend:' + ridOf(r.json.pend);
    const h = await kv(['HGETALL', pk]);
    const hh = {}; for (let i = 0; i < h.length; i += 2) hh[h[i]] = h[i + 1];
    ok('the pending request lasts 48 hours (TTL 172800)', Math.abs((await kv(['TTL', pk])) - 172800) <= 2);
    ok('…holds the count, the buddies (unknown ones are the fox), the zone, the code, ok=0 and one confirm hash', hh.n === '3' && hh.buddies === 'dragon,unicorn,fox' && hh.tz === '0' && hh.code === r.json.code && hh.ok === '0' && /^[0-9a-f]{64}$/.test(hh.cidh1 || '') && !hh.cidh2, hh);
    ok('…and never the confirm secret itself', !JSON.stringify(h).includes(c.split('.')[2]));

    // At most two emails to one address a day, whatever the capitals.
    const r2 = await start(email.toLowerCase(), ['fox']);
    const r3 = await start(email.toUpperCase(), ['fox']);
    ok('the second email to an address goes, the third the same day is 429', r2.status === 200 && r3.status === 429 && r3.json.limit === true, [r2.status, r3.status]);
    at('2027-03-11T12:00:00Z');
    ok('…and the next day it may have two again', (await start(email, ['fox'])).status === 200);

    // The global cap: 300 emails a UTC day in all.
    await kv(['SET', P() + 'mail:' + new Date(NOW).toISOString().slice(0, 10), '300', 'EX', '172800']);
    const sentBefore = emails.length;
    const rc = await start(nextEmail(), ['fox']);
    ok('the 301st email of a UTC day is 503 {resting:true}, nothing sent', rc.status === 503 && rc.json.resting === true && emails.length === sentBefore, rc.json);
    ok('…and logged as "[board] mail cap"', logs.some((l) => l.includes('[board] mail cap')));
    await kv(['DEL', P() + 'mail:' + new Date(NOW).toISOString().slice(0, 10)]);

    // "Send it again": same request and code, one more confirm hash, either link works.
    const a = await start(nextEmail(), ['fox', 'cat']);
    const linkA1 = linksOf(emails[emails.length - 1]);
    const a2 = await start(nextEmail(), ['fox'], { pend: a.json.pend });
    const linkA2 = linksOf(emails[emails.length - 1]);
    const ak = P() + 'pend:' + ridOf(a.json.pend);
    const ah = await kv(['HMGET', ak, 'n', 'code', 'cidh1', 'cidh2']);
    ok('a resend keeps the request, its code and its children', a2.status === 200 && a2.json.pend === a.json.pend && a2.json.code === a.json.code && ah[0] === '2' && ah[1] === a.json.code, a2.json);
    ok('…and adds a second confirm hash', !!ah[2] && !!ah[3] && ah[2] !== ah[3]);
    ok('…with a new link in the new email', linkA1.c !== linkA2.c && ridOf(linkA1.c) === ridOf(linkA2.c));
    ok('the first email\'s link confirms', (await confirm(linkA1.c)).status === 200 && (await kv(['HGET', ak, 'ok'])) === '1');
    const b = await start(nextEmail(), ['fox']);
    const bk = P() + 'pend:' + ridOf(b.json.pend);
    await kv(['EXPIRE', bk, 3600]);
    await start(nextEmail(), ['fox'], { pend: b.json.pend });
    ok('a resend starts the request\'s 48 hours again, so the new email\'s "The link works for 2 days" is true', Math.abs((await kv(['TTL', bk])) - 172800) <= 2, await kv(['TTL', bk]));
    const linkB2 = linksOf(emails[emails.length - 1]);
    ok('the second email\'s link confirms too', (await confirm(linkB2.c)).status === 200 && (await kv(['HGET', P() + 'pend:' + ridOf(b.json.pend), 'ok'])) === '1');
    const cc = await start(nextEmail(), ['fox']);
    const first = linksOf(emails[emails.length - 1]);
    for (let i = 0; i < 3; i++) await start(nextEmail(), ['fox'], { pend: cc.json.pend });
    const ch = await kv(['HMGET', P() + 'pend:' + ridOf(cc.json.pend), 'cidh1', 'cidh2', 'cidh3', 'cidh4']);
    ok('at most three confirm hashes are kept; the oldest goes', !!ch[0] && !!ch[1] && !!ch[2] && ch[3] === null);
    ok('…so the oldest email\'s link has run out', /run out/.test((await confirm(first.c)).text) && (await kv(['HGET', P() + 'pend:' + ridOf(cc.json.pend), 'ok'])) === '0');
    const xg = await call('remove', 'GET', null, { query: '?x=' + encodeURIComponent(first.x) });
    ok('…but its remove link still shows its button', xg.status === 200 && /<form method="POST" action="\/api\/board\/remove">/.test(xg.text), xg.text.slice(0, 200));
    const again = await start(nextEmail(), ['fox'], { pend: a.json.pend });
    ok('a resend after the grown-up confirmed sends nothing more and says so', again.status === 200 && again.json.confirmed === true && again.json.pend === a.json.pend);

    // Rate limit: 10 an hour from one network, hashed, IPv6 by /64.
    const v6 = ['2001:db8:aa:bb::1', '2001:db8:aa:bb::2', '2001:db8:aa:bb:ffff:ffff:ffff:9', '2001:0db8:00aa:00bb::7'];
    let last;
    for (let i = 0; i < 10; i++) last = await start(nextEmail(), ['fox'], {}, { ip: v6[i % v6.length] });
    const eleventh = await start(nextEmail(), ['fox'], {}, { ip: '[2001:db8:aa:bb::abcd]' });
    const other = await start(nextEmail(), ['fox'], {}, { ip: '2001:db8:aa:bc::1' });
    ok('ten requests an hour from one network; addresses in one IPv6 /64 share a bucket', last.status === 200 && eleventh.status === 429 && eleventh.json.limit === true, [last.status, eleventh.status]);
    ok('…another /64 has its own', other.status === 200);
    const rl = (await kv(['KEYS', '*'])).filter((k) => k.startsWith('rl:board'));
    ok('every board rate-limit key is hashed (":h:"), none holds an address', rl.length > 0 && rl.every((k) => /^rl:board-[a-z-]+:h:[0-9a-f]{16}$/.test(k)), rl.slice(0, 5));

    // A send that fails: nothing kept, nothing claimed.
    env({ VERCEL: '1', VERCEL_ENV: 'preview' });
    resendStatus = 500;
    const pendsBefore = (await keysLike(P() + 'pend:')).length;
    const f = await start(nextEmail(), ['fox']);
    ok('when Resend refuses, start answers 503 {error:"email-off"}', f.status === 503 && f.json.error === 'email-off', f.json);
    ok('…and the new pending request is deleted', (await keysLike(P() + 'pend:')).length === pendsBefore);
    ok('…and the log says only the status, never the address', logs.some((l) => /Resend refused the board confirmation: 500/.test(l)));
    resendStatus = 200;
    env({ RESEND_API_KEY: undefined });
    const logN = logs.length;
    const d = await start(nextEmail(), ['fox']);
    ok('on a developer\'s machine with no Resend key, start works and the links go to the console', d.status === 200 && logs.slice(logN).some((l) => l.includes('[board] no RESEND_API_KEY') && l.includes('/api/board/confirm?c=')));
    ok('…and never into the response', !/confirm\?c=|remove\?x=/.test(d.text));
    env({ RESEND_API_KEY: undefined, VERCEL: '1', VERCEL_ENV: 'preview' });
    const pvNoKey = await start(nextEmail(), ['fox']);
    ok('…but on a preview with no Resend key nothing is logged and nothing kept', pvNoKey.status === 503 && pvNoKey.json.error === 'email-off');
    env();
    const xo = await call('start', 'POST', { email: nextEmail(), kids: [{ buddy: 'fox' }], tz: 0 }, { origin: 'https://evil.example' });
    const no = await call('start', 'POST', { email: nextEmail(), kids: [{ buddy: 'fox' }], tz: 0 }, { origin: null });
    ok('a JSON POST from another origin, or none, is refused', xo.status === 403 && no.status === 403);
    const big = await call('start', 'POST', null, { raw: JSON.stringify({ email: nextEmail(), kids: [{ buddy: 'fox' }], tz: 0, pad: 'x'.repeat(2100) }) });
    ok('a body over 2,000 bytes is refused', big.status === 413);
  });

  // 4. confirm ───────────────────────────────────────────────────────────────
  await scenario('confirm', async () => {
    await flush();
    const s = await start(nextEmail(), ['fox', 'bee']);
    const { c } = linksOf(emails[emails.length - 1]);
    const pk = P() + 'pend:' + ridOf(s.json.pend);
    const g = await call('confirm', 'GET', null, { query: '?c=' + encodeURIComponent(c) });
    ok('GET shows the code, the children and a POST button', g.status === 200 && g.text.includes(s.json.code) && g.text.includes('2 children') && /<form method="POST" action="\/api\/board\/confirm">/.test(g.text) && g.text.includes('Yes, turn it on'));
    ok('GET changes nothing (a mail scanner never confirms)', (await kv(['HGET', pk, 'ok'])) === '0');
    const csp = g.headers.get('content-security-policy') || '';
    ok('the page carries the CSP, frame-ancestors \'none\' included', csp.includes("default-src 'none'") && csp.includes("frame-ancestors 'none'") && csp.includes("form-action 'self'") && csp.includes("base-uri 'none'"), csp);
    ok('…no script, no pixel, no referrer', !/<script|<img/i.test(g.text) && g.headers.get('referrer-policy') === 'no-referrer');
    const pv = await confirm(s.json.pend);
    ok('POST with the phone\'s pend value is refused', pv.status === 400 && (await kv(['HGET', pk, 'ok'])) === '0');
    const forged = c.replace(/\.[^.]+$/, '.' + 'A'.repeat(43));
    ok('POST with a forged signature is refused', (await confirm(forged)).status === 400 && (await kv(['HGET', pk, 'ok'])) === '0');
    const p = await confirm(c);
    ok('POST with the emailed value confirms', p.status === 200 && /Done!/.test(p.text) && (await kv(['HGET', pk, 'ok'])) === '1');
    ok('…and keeps the request\'s own time limit', (await kv(['TTL', pk])) > 0);
    const g2 = await call('confirm', 'GET', null, { query: '?c=' + encodeURIComponent(c) });
    ok('GET after confirming says done', /Done!/.test(g2.text));
    await kv(['DEL', pk]);
    ok('a link whose request is gone says it ran out', /run out/.test((await call('confirm', 'GET', null, { query: '?c=' + encodeURIComponent(c) })).text) && /run out/.test((await confirm(c)).text));
    ok('a POST does not need the Origin header (it is the email\'s own page)', (await confirm(c, { origin: null })).status === 200);
  });

  // 5. claim ─────────────────────────────────────────────────────────────────
  await scenario('claim', async () => {
    await flush();
    const s = await start(nextEmail(), ['panda', 'nothere', 'lion']);
    const { c } = linksOf(emails[emails.length - 1]);
    const w = await claim(s.json.pend);
    ok('before the grown-up confirms, claim says waiting', w.status === 202 && w.json.waiting === true, w.json);
    ok('…and writes no member', (await keysLike(P() + 'mem:')).length === 0);
    await confirm(c);
    const memsBefore = (await keysLike(P() + 'mem:')).length;
    delayOn = (cmd) => (isEval(cmd, 'claim') ? 20 : 0);
    const [c1, c2] = await Promise.all([claim(s.json.pend), claim(s.json.pend)]);
    delayOn = null;
    const c3 = await claim(s.json.pend);
    ok('one member per child, in order', c1.status === 200 && c1.json.members.length === 3, c1.json);
    const NICK = /^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/;
    ok('each nickname is Adjective Animal NN from the lists, never a skipped number', c1.json.members.every((m) => { const [ad, an, n] = m.nick.split(' '); return NICK.test(m.nick) && board.ADJECTIVES.includes(ad) && board.ANIMALS.includes(an) && !board.NUMBER_SKIP.includes(Number(n)) && Number(n) >= 10; }), c1.json.members);
    ok('each token is a member token ("m.")', c1.json.members.every((m) => /^m\./.test(m.token)));
    ok('two claims started together get the same members', JSON.stringify(c1.json.members) === JSON.stringify(c2.json.members));
    ok('a repeated claim gets the same members again', JSON.stringify(c1.json.members) === JSON.stringify(c3.json.members));
    ok('…and only one set exists', (await keysLike(P() + 'mem:')).length === memsBefore + 3 && (await keysLike(P() + 'nick:')).length === 3);
    ok('the answer says which month', c1.json.month === new Date(NOW).toISOString().slice(0, 7));
    const ids = c1.json.members.map((m) => idOf(m.token));
    const mk = P() + 'mem:' + ids[0];
    ok('a member lives 100 days (TTL 8640000)', Math.abs((await kv(['TTL', mk])) - 8640000) <= 2);
    ok('…and so does its nickname', Math.abs((await kv(['TTL', P() + 'nick:' + c1.json.members[0].nick])) - 8640000) <= 2);
    ok('…and its remove-link record', Math.abs((await kv(['TTL', P() + 'rid:' + ridOf(s.json.pend)])) - 8640000) <= 2);
    const m0 = await kv(['HGETALL', mk]); const mh = {}; for (let i = 0; i < m0.length; i += 2) mh[m0[i]] = m0[i + 1];
    ok('a member holds only nick, buddy, tz, tz0, tzAt, joined, rid and the nickname counters', JSON.stringify(Object.keys(mh).sort()) === JSON.stringify(['buddy', 'joined', 'nick', 'nkd', 'nkm', 'nkn', 'rid', 'tz', 'tz0', 'tzAt']), mh);
    ok('…joined is today in the family\'s zone; the buddy is checked', mh.joined === memberDay(NOW, 0, 0) && mh.buddy === 'panda' && (await kv(['HGET', P() + 'mem:' + ids[1], 'buddy'])) === 'fox');
    ok('a bad pend is 401', (await claim('p.' + 'A'.repeat(22) + '.' + 'B'.repeat(43))).status === 401);
    ok('a member token is not a pend (401)', (await claim(c1.json.members[0].token)).status === 401);
    const s2 = await start(nextEmail(), ['fox']);
    await kv(['DEL', P() + 'pend:' + ridOf(s2.json.pend)]);
    const ex = await claim(s2.json.pend);
    ok('an expired request is 404 {expired:true}', ex.status === 404 && ex.json.expired === true);
    // Whole words, and the ones that are never innocent inside another word.
    const DENY_WORD = ['ass', 'butt', 'poop', 'pee', 'fat', 'hot', 'sexy', 'kill', 'dead', 'die', 'dumb', 'stupid', 'ugly', 'idiot', 'loser', 'fart', 'gay', 'nazi', 'crap', 'damn', 'hell', 'piss', 'slut', 'weird', 'gun', 'drunk', 'beer', 'fool', 'lazy', 'slow', 'smelly', 'stinky', 'chubby', 'skinny', 'crazy', 'pig', 'cow', 'rat', 'snake', 'worm', 'monkey', 'donkey', 'weasel', 'skunk', 'shark', 'wolf', 'bull', 'hog'];
    const DENY_PART = ['ass', 'butt', 'poop', 'sexy', 'kill', 'dumb', 'stupid', 'fart', 'nazi', 'slut', 'piss', 'crap', 'damn', 'dead'];
    const words = [...board.ADJECTIVES, ...board.ANIMALS].map((w) => w.toLowerCase());
    const denied = words.filter((w) => DENY_WORD.includes(w) || DENY_PART.some((d) => w.includes(d)));
    ok('neither list holds a word from the denylist', denied.length === 0, denied);
    ok('32 adjectives, 32 animals, 86 numbers: 88,064 nicknames', board.ADJECTIVES.length === 32 && board.ANIMALS.length === 32 && new Set(words).size === 64 && 90 - board.NUMBER_SKIP.length === 86);
    ok('every candidate drawn is well formed', board.nickCandidates(500).every((n) => NICK.test(n) && !board.NUMBER_SKIP.includes(Number(n.slice(-2)))));
    // The first child gets a free nickname, the second finds every one of its
    // draw taken: the script must take the first child's back and make nothing.
    const s3 = await start(nextEmail(), ['fox', 'fox']);
    await confirm(linksOf(emails[emails.length - 1]).c);
    const realCands = board.nickCandidates;
    const used = c1.json.members.map((m) => m.nick);
    const free = ['Zippy Gecko 77', 'Zippy Gecko 76'].find((x) => !used.includes(x));
    let draws = 0;
    board.nickCandidates = (n) => (draws++ === 0 ? [free, ...Array(n - 1).fill(used[0])] : Array(n).fill(used[0]));
    const mem2 = (await keysLike(P() + 'mem:')).length, nk2 = (await keysLike(P() + 'nick:')).length;
    const busy = await claim(s3.json.pend);
    board.nickCandidates = realCands;
    ok('with no free nickname for one child, claim answers 503 {retry} and makes nothing', draws === 2 && busy.status === 503 && busy.json.retry === true && (await keysLike(P() + 'mem:')).length === mem2 && (await keysLike(P() + 'nick:')).length === nk2 && (await kv(['EXISTS', P() + 'nick:' + free])) === 0, busy.json);
    ok('…and a later claim still works', (await claim(s3.json.pend)).status === 200);
  });

  // 6. day ───────────────────────────────────────────────────────────────────
  await scenario('day', async () => {
    await flush();
    at('2027-03-10T12:00:00Z');
    const j = await join(['fox'], { tz: 0 });
    const t = j.tokens[0], id = j.ids[0];
    const d1 = await day(t, 0);
    ok('a goal day counts', d1.status === 200 && d1.json.counted === true && d1.json.days === 1, d1.json);
    const d2 = await day(t, 30);
    ok('the same day again is counted:false', d2.status === 200 && d2.json.counted === false && d2.json.days === 1, d2.json);
    const y = await day(t, 86400);
    ok('a day before joining is 400 {reason:"date"}', y.status === 400 && y.json.reason === 'date', y.json);
    at('2027-03-11T12:00:00Z');
    const yy = await day(t, 86400);
    ok('ago 86400 is yesterday: already counted', yy.status === 200 && yy.json.counted === false);
    const tt = await day(t, 0);
    ok('ago 0 is today: counts', tt.json.counted === true && tt.json.days === 2);
    ok('ago 172801 is 400', (await day(t, 172801)).status === 400);
    for (const bad of [-1, 1.5, '0', null]) ok('ago ' + JSON.stringify(bad) + ' is 400', (await day(t, bad)).status === 400);
    ok('the "already counted" mark lives 3 days', Math.abs((await kv(['TTL', P() + 'tick:' + id + ':2027-03-11'])) - 259200) <= 2);
    ok('the month list ends 8 days after the month', Math.abs((await kv(['TTL', P() + 'm:2027-03'])) - ttlUntil(Date.UTC(2027, 3, 9))) <= 2);
    ok('a bad token is 401', (await day('m.' + 'A'.repeat(22) + '.' + 'B'.repeat(43), 0)).status === 401);
    ok('a pend is not a member token (401)', (await day(j.pend, 0)).status === 401);
    env({ BOARD_SECRET: 'the-next-board-secret-after-rotation', BOARD_SECRET_PREV: SECRET });
    at('2027-03-12T12:00:00Z');
    const rot = await day(t, 0);
    ok('a token signed with BOARD_SECRET_PREV still works after a rotation', rot.status === 200 && rot.json.counted === true);
    env({ BOARD_SECRET: 'the-next-board-secret-after-rotation' });
    ok('…and a key off the ring is 401, never "gone"', (await day(t, 0)).status === 401);
    env();
    // 12 claims a UTC day, then 429.
    at('2027-03-13T01:00:00Z');
    const runs = [];
    for (let i = 0; i < 13; i++) runs.push((await day(t, i)).status);
    ok('the 13th claim of a UTC day is 429', runs.slice(0, 12).every((s) => s === 200) && runs[12] === 429, runs);
    // Buddy follows the phone when it is a real one.
    at('2027-03-14T12:00:00Z');
    await day(t, 0, { buddy: 'octopus' });
    await day(t, 0, { buddy: 'robot' });
    ok('a counted day may carry the buddy; an unknown one is ignored', (await kv(['HGET', P() + 'mem:' + id, 'buddy'])) === 'octopus');
    // Store errors are 503, never "counted:false".
    at('2027-03-15T12:00:00Z');
    failOn = (cmd) => isEval(cmd, 'day');
    const f1 = await day(t, 0);
    failOn = (cmd) => cmd[0] === 'HMGET';
    const f2 = await day(t, 0);
    failOn = null;
    ok('with the store failing, day answers 503 {retry:true}, never counted:false', f1.status === 503 && f1.json.retry === true && f2.status === 503 && f2.json.counted === undefined, [f1.json, f2.json]);
    ok('…and the day is not marked counted', (await kv(['EXISTS', P() + 'tick:' + id + ':2027-03-15'])) === 0);
    ok('…so the retry counts it', (await day(t, 0)).json.counted === true);
    env({ BOARD_PAUSE: '1' });
    at('2027-03-16T12:00:00Z');
    const pz = await day(t, 0);
    ok('with BOARD_PAUSE=1, day still counts', pz.status === 200 && pz.json.counted === true);
    for (const [route, body] of [['start', { email: nextEmail(), kids: [{ buddy: 'fox' }], tz: 0 }], ['claim', { pend: j.pend }], ['view', { token: t }], ['nick', { token: t }]]) {
      const r = await call(route, 'POST', body);
      ok('with BOARD_PAUSE=1, ' + route + ' answers 503 {paused:true}', r.status === 503 && r.json.paused === true, r.json);
    }
    env();
    // Many children behind one address never lose a day.
    const many = [await join(['fox', 'cat', 'bee', 'dino']), await join(['fox', 'cat', 'bee', 'dino']), await join(['fox', 'cat', 'bee', 'dino'])];
    const statuses = [];
    for (const m of many) for (const tok of m.tokens) for (const ago of [0, 1, 2]) statuses.push((await day(tok, ago, {}, { ip: '203.0.113.9' })).status);
    ok('36 day claims from one IP for 12 tokens are never IP-limited', statuses.length === 36 && statuses.every((s) => s === 200), statuses);
    const gone = await join(['fox']);
    await leave(gone.tokens[0]);
    const g = await day(gone.tokens[0], 0);
    ok('a member that left is 404 {gone:true}', g.status === 404 && g.json.gone === true);
  });

  // 7. The time-zone walk and the ceiling ────────────────────────────────────
  await scenario('time zones', async () => {
    await flush();
    at('2027-03-10T00:30:00Z');
    const j = await join(['fox'], { tz: 0 });
    const t = j.tokens[0], id = j.ids[0], mk = P() + 'mem:' + id;
    const problems = [];
    let prevTz = '0', lastChange = null;
    for (let k = 1; k <= 48; k++) {
      NOW += 3600e3;
      const before = new Set(await keysLike(P() + 'tick:' + id + ':'));
      const r = await day(t, 0, { tz: Math.min(840, 120 * k) });
      const fresh = (await keysLike(P() + 'tick:' + id + ':')).filter((x) => !before.has(x)).map((x) => x.split(':').pop());
      for (const d of fresh) if (d > memberDay(NOW, 120, 0)) problems.push('counted ' + d + ' at ' + new Date(NOW).toISOString() + ', more than two hours early');
      const [tz, tz0] = await kv(['HMGET', mk, 'tz', 'tz0']);
      if (Math.abs(Number(tz) - Number(tz0)) > 120) problems.push('stored tz ' + tz);
      if (tz !== prevTz) {
        if (!(r.json && r.json.counted === true)) problems.push('tz changed without a counted day');
        if (lastChange !== null && NOW - lastChange < 20 * 3600e3) problems.push('tz changed twice in 20 hours');
        lastChange = NOW; prevTz = tz;
      }
      const ceiling = dayNum(memberDay(NOW, 120, 0)) - dayNum('2027-03-10') + 1;
      const held = Number((await kv(['ZSCORE', P() + 'm:2027-03', id])) || 0);
      if (held > ceiling) problems.push('days ' + held + ' > ceiling ' + ceiling);
    }
    ok('a script walking tz by +120 each hour for two days gains no day early and never passes the ceiling', problems.length === 0, problems);
    ok('…the zone moved at most once, to +120', (await kv(['HGET', mk, 'tz'])) === '120');

    // Back and forth between two zones: only on counted days, once in 20 hours.
    await flush();
    at('2027-03-10T00:30:00Z');
    const j2 = await join(['fox'], { tz: 60 });
    const mk2 = P() + 'mem:' + j2.ids[0];
    const changes = [], bad = [];
    let prev = '60';
    for (let k = 1; k <= 60; k++) {
      NOW += 3600e3;
      const r = await day(j2.tokens[0], 0, { tz: k % 2 ? 120 : 0 });
      const tz = await kv(['HGET', mk2, 'tz']);
      if (tz !== prev) { changes.push(NOW); if (!(r.json && r.json.counted)) bad.push('changed on a call that did not count'); prev = tz; }
    }
    for (let i = 1; i < changes.length; i++) if (changes[i] - changes[i - 1] < 20 * 3600e3) bad.push('two changes ' + (changes[i] - changes[i - 1]) / 3600e3 + 'h apart');
    ok('a tz change is stored only on a counted day, within ±120 of where it joined, once in 20 hours', bad.length === 0 && changes.length >= 1, { bad, changes: changes.length });

    // A simulated month and a half: days never pass the calendar days since joining.
    await flush();
    at('2027-04-03T15:00:00Z');
    const j3 = await join(['fox'], { tz: -300 });
    const id3 = j3.ids[0], joined = '2027-04-03';
    const over = [];
    const base = NOW;
    let april = null;
    for (let i = 0; i < 40; i++) {
      if (april === null && memberDay(NOW, -300, 0) >= '2027-05-02') april = Number(await kv(['ZSCORE', P() + 'm:2027-04', id3]));
      for (const [ago, jitter] of [[0, 0], [86400, 3 * 3600e3], [7200, 7 * 3600e3], [172000, 11 * 3600e3]]) {
        NOW = base + i * 86400e3 + jitter;
        await day(j3.tokens[0], ago, { tz: -300 + (((i * 7 + ago) % 9) - 4) * 30 });
        const top = memberDay(NOW, -180, 0);
        for (const ym of ['2027-04', '2027-05']) {
          const startD = joined > ym + '-01' ? joined : ym + '-01';
          const last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).toISOString().slice(0, 10);
          const end = top < last ? top : last;
          const cap = Math.max(0, dayNum(end) - dayNum(startD) + 1);
          const held = Number((await kv(['ZSCORE', P() + 'm:' + ym, id3])) || 0);
          if (held > cap) over.push(ym + ' holds ' + held + ' on ' + top + ' (cap ' + cap + ')');
        }
      }
    }
    ok('over a simulated month and a half, days never exceed the calendar days since joining', over.length === 0, over.slice(0, 5));
    ok('…and a family that met the goal daily holds every April day since joining', april === 28, april);
    // Retention runs on the store's clock: the model's is the test's, so it can be watched.
    if (!usingRedis) ok('a month list is erased 8 days after its month ends', (await kv(['EXISTS', P() + 'm:2027-04'])) === 0 && Number(await kv(['ZSCORE', P() + 'm:2027-05', id3])) > 0);
    ok('ceilingFor counts from the later of joining and the 1st, to the earlier of today and the month end', board.ceilingFor('2027-04-30', '2027-04-03', '2027-05-01') === 28 && board.ceilingFor('2027-05-01', '2027-04-03', '2027-05-01') === 1 && board.ceilingFor('2027-04-10', '2027-03-01', '2027-04-10') === 10);
    ok('memberDay reads the server clock in the family zone', board.memberDay(Date.UTC(2027, 0, 1, 23, 30), 60, 0) === '2027-01-02' && board.memberDay(Date.UTC(2027, 0, 1, 0, 30), -60, 0) === '2026-12-31' && board.memberDay(Date.UTC(2027, 0, 2, 12), 0, 86400) === '2027-01-01');
    ok('offsetOk takes −720 to 840 in steps of 15', [-720, 0, 345, 840].every(board.offsetOk) && ![-735, 855, 7, 0.5, '0', NaN].some(board.offsetOk));
  });

  // 8. view ──────────────────────────────────────────────────────────────────
  await scenario('view', async () => {
    // Ties share places (1, 1, 3); the snapshot is once a UTC day; own days are live.
    await flush();
    at('2027-03-10T09:00:00Z');
    const j = await join(['fox', 'cat', 'bee'], { tz: 0 });
    const [A, B, C] = j.tokens;
    for (const tk of [A, B, C]) await day(tk, 0);
    at('2027-03-11T09:00:00Z');
    await day(A, 0); await day(B, 0);
    const vc = await view(C);
    ok('view answers {month, quiet, top, more, me}', vc.status === 200 && vc.json.month === '2027-03' && vc.json.quiet === false && Array.isArray(vc.json.top) && Array.isArray(vc.json.more), vc.json);
    ok('ties share places: 1, 1, 3', JSON.stringify(vc.json.top.map((r) => r.place)) === '[1,1,3]' && JSON.stringify(vc.json.top.map((r) => r.days)) === '[2,2,1]', vc.json.top);
    ok('the asking child\'s own row is marked and its place is 3', vc.json.top[2].me === true && vc.json.me.place === 3 && vc.json.me.days === 1 && vc.json.me.nick === j.members[2].nick);
    ok('rows carry only place, nick, buddy, days, me', vc.json.top.every((r) => JSON.stringify(Object.keys(r).sort()) === '["buddy","days","me","nick","place"]'));
    await day(C, 0);
    const vc2 = await view(C), va = await view(A);
    ok('a day counted after today\'s snapshot shows in the child\'s own days at once', vc2.json.me.days === 2 && vc2.json.me.place === 1 && vc2.json.top.find((r) => r.me).days === 2);
    ok('…but not in other children\'s rows until the next UTC day', va.json.top.find((r) => r.nick === j.members[2].nick).days === 1 && va.json.top.find((r) => r.nick === j.members[2].nick).place === 3);
    at('2027-03-12T00:05:00Z');
    const va2 = await view(A);
    ok('…the next UTC day it does', va2.json.top.find((r) => r.nick === j.members[2].nick).days === 2 && va2.json.top.every((r) => r.place === 1));
    const ids = j.ids;
    ok('the answer holds no member id and no total', ![vc, vc2, va, va2].some((r) => ids.some((x) => r.text.includes(x)) || /total|"id"/.test(r.text)));
    // No time limit refreshed by a read.
    await kv(['EXPIRE', P() + 'mem:' + j.ids[0], 1000]);
    await view(A);
    const ttl = await kv(['TTL', P() + 'mem:' + j.ids[0]]);
    ok('a view refreshes no member\'s time limit', ttl > 0 && ttl <= 1000, ttl);

    // Fewer than three children: quiet, no rows.
    await flush();
    at('2027-03-10T09:00:00Z');
    const q = await join(['fox', 'cat']);
    for (const tk of q.tokens) await day(tk, 0);
    const vq = await view(q.tokens[0]);
    ok('fewer than 3 children on the board is quiet: no rows', vq.json.quiet === true && vq.json.top.length === 0 && vq.json.more.length === 0 && vq.json.me.days === 1 && vq.json.me.place === null, vq.json);

    // 50+ tied at the top: 20 rows at most, one "more" line, the asking child listed.
    await flush();
    at('2027-03-20T09:00:00Z');
    const all = [];
    for (let i = 0; i < 13; i++) all.push(...(await join(['fox', 'cat', 'bee', 'panda'])).tokens);
    const st = [];
    for (const tk of all) st.push((await day(tk, 0, {}, { ip: '198.51.100.7' })).status);
    ok('52 children from one IP all count (no IP limit on days)', st.every((s) => s === 200));
    const me = all[37];
    const v = await view(me);
    ok('52 tied at the top: at most 20 rows, all place 1', v.json.top.length === 20 && v.json.top.every((r) => r.place === 1 && r.days === 1), v.json.top.length);
    ok('…a "more" line with the rest (+32 more kids with 1 day)', JSON.stringify(v.json.more) === JSON.stringify([{ place: 1, n: 32, days: 1 }]), v.json.more);
    ok('…and the asking child\'s own row listed, in the last slot of its tie group', v.json.top.filter((r) => r.me).length === 1 && v.json.top[19].me === true && v.json.me.place === 1);
    ok('…no nickname listed twice', new Set(v.json.top.map((r) => r.nick)).size === 20);
    const v2 = await view(all[3]);
    ok('another child sees their own row too', v2.json.top.filter((r) => r.me).length === 1);

    // Only places 1-10; me.place null past 10.
    await flush();
    at('2027-03-20T09:00:00Z');
    const twelve = [], nickOf = {};
    for (let i = 0; i < 3; i++) for (const m of (await join(['fox', 'cat', 'bee', 'panda'])).members) { twelve.push(m.token); nickOf[m.token] = m.nick; }
    for (const tk of twelve) await day(tk, 0);
    at('2027-03-21T09:00:00Z');
    for (const tk of twelve.slice(0, 10)) await day(tk, 0);
    const v11 = await view(twelve[11]);
    ok('only places 1-10 are listed', v11.json.top.length === 10 && v11.json.top.every((r) => r.place === 1 && r.days === 2) && v11.json.more.length === 0, v11.json);
    ok('…and the asking child at place 11 gets me.place null', v11.json.me.place === null && v11.json.me.days === 1 && !v11.json.top.some((r) => r.me));
    const fresh = await join(['fox']);
    const v0 = await view(fresh.tokens[0]);
    ok('a child with no days yet gets me.place null', v0.json.me.days === 0 && v0.json.me.place === null);
    ok('the view limit is 120 an hour per child', board.VIEW_CAP === 120);
    await leave(twelve[0]);
    const vg = await view(twelve[1]);
    ok('a child who left drops out of today\'s snapshot at once', !vg.json.top.some((r) => r.nick === nickOf[twelve[0]]), vg.json.top);
    ok('…so nine share place 1 and the two with one day are listed at place 10', JSON.stringify(vg.json.top.map((r) => r.place)) === JSON.stringify([1, 1, 1, 1, 1, 1, 1, 1, 1, 10, 10]) && vg.json.top.filter((r) => r.me).length === 1, vg.json.top.map((r) => r.place));
    ok('places() is competition ranking', JSON.stringify(board.places([5, 5, 3, 3, 3, 1])) === '[1,1,3,3,3,6]');
  });

  // 9. nick ──────────────────────────────────────────────────────────────────
  await scenario('nick', async () => {
    await flush();
    at('2027-03-10T09:00:00Z');
    const j = await join(['fox'], { tz: 0 });
    const t = j.tokens[0], old = j.members[0].nick;
    const n1 = await nick(t);
    ok('a new nickname from the lists', n1.status === 200 && /^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/.test(n1.json.nick) && n1.json.nick !== old, n1.json);
    ok('the old nickname key is deleted', (await kv(['EXISTS', P() + 'nick:' + old])) === 0);
    const nt = await kv(['TTL', P() + 'nick:' + n1.json.nick]);
    ok('the new nickname key has a time limit, the member\'s own', nt > 0 && Math.abs(nt - (await kv(['TTL', P() + 'mem:' + j.ids[0]]))) <= 2, nt);
    ok('the member holds the new nickname', (await kv(['HGET', P() + 'mem:' + j.ids[0], 'nick'])) === n1.json.nick);
    const n2 = await nick(t);
    ok('one a day: the second the same day is 429 {limit:true}', n2.status === 429 && n2.json.limit === true);
    at('2027-03-11T09:00:00Z'); const n3 = await nick(t);
    at('2027-03-12T09:00:00Z'); const n4 = await nick(t);
    at('2027-03-13T09:00:00Z'); const n5 = await nick(t);
    ok('three a month: the fourth is 429', n3.status === 200 && n4.status === 200 && n5.status === 429, [n3.status, n4.status, n5.status]);
    at('2027-04-02T09:00:00Z');
    ok('a new month allows a new one', (await nick(t)).status === 200);
    ok('only the current nickname has a key', (await keysLike(P() + 'nick:')).length === 1);
    ok('a bad token is 401', (await nick('m.x.y')).status === 401);
  });

  // 10. leave, remove, admin ─────────────────────────────────────────────────
  await scenario('leave and remove', async () => {
    await flush();
    at('2027-03-10T09:00:00Z');
    const j = await join(['fox', 'cat', 'bee']);
    for (const tk of j.tokens) await day(tk, 0);
    await view(j.tokens[1]);
    const [t] = j.tokens, id = j.ids[0], nk = j.members[0].nick;
    const snap = P() + 'snap:2027-03:2027-03-10';
    ok('before leaving: member, nickname, month entry, snapshot entry and mark exist', (await kv(['EXISTS', P() + 'mem:' + id])) === 1 && (await kv(['ZSCORE', snap, id])) !== null && (await kv(['EXISTS', P() + 'tick:' + id + ':2027-03-10'])) === 1);
    failOn = (cmd) => isEval(cmd, 'leave');
    const lf = await leave(t);
    failOn = null;
    ok('with the store failing, leave answers 503, never deleted:true', lf.status === 503 && lf.json.deleted === undefined && (await kv(['EXISTS', P() + 'mem:' + id])) === 1);
    const l1 = await leave(t);
    ok('leave answers {deleted:true}', l1.status === 200 && l1.json.deleted === true);
    ok('…and removes the member, its nickname, its month and snapshot entries and its marks',
      (await kv(['EXISTS', P() + 'mem:' + id])) === 0 && (await kv(['EXISTS', P() + 'nick:' + nk])) === 0 && (await kv(['ZSCORE', P() + 'm:2027-03', id])) === null && (await kv(['ZSCORE', snap, id])) === null && (await kv(['EXISTS', P() + 'tick:' + id + ':2027-03-10'])) === 0);
    ok('…and its id from the remove-link record', !(await kv(['HGET', P() + 'rid:' + j.rid, 'ids'])).includes(id));
    ok('leaving twice is fine', (await leave(t)).json.deleted === true);
    env({ BOARD_PAUSE: '1' });
    ok('leave works while paused', (await leave(j.tokens[1])).json.deleted === true && (await kv(['EXISTS', P() + 'mem:' + j.ids[1]])) === 0);
    env({ BOARD_FORCE_LIVE: undefined });
    ok('leave works when the board is off', (await leave(j.tokens[2])).json.deleted === true && (await kv(['EXISTS', P() + 'mem:' + j.ids[2]])) === 0);
    ok('…and the record goes with its last member', (await kv(['EXISTS', P() + 'rid:' + j.rid])) === 0);
    env();
    ok('a bad token is 401', (await leave('m.nope.nope')).status === 401);

    // The email's remove link.
    const r = await join(['fox', 'dino']);
    for (const tk of r.tokens) await day(tk, 0);
    const rg = await call('remove', 'GET', null, { query: '?x=' + encodeURIComponent(r.x) });
    ok('GET remove shows a button and changes nothing', rg.status === 200 && /<form method="POST" action="\/api\/board\/remove">/.test(rg.text) && (await kv(['EXISTS', P() + 'mem:' + r.ids[0]])) === 1);
    ok('…with the locked-down page', (rg.headers.get('content-security-policy') || '').includes("frame-ancestors 'none'") && !/<script|<img/i.test(rg.text));
    const rp = await call('remove', 'POST', { x: r.pend }, { form: true });
    ok('POST remove refuses the phone\'s pend value', rp.status === 400 && (await kv(['EXISTS', P() + 'mem:' + r.ids[0]])) === 1);
    ok('…and a confirm value', (await call('remove', 'POST', { x: r.c }, { form: true })).status === 400 && (await kv(['EXISTS', P() + 'mem:' + r.ids[0]])) === 1);
    await kv(['DEL', P() + 'pend:' + r.rid]);
    const rm = await call('remove', 'POST', { x: r.x }, { form: true });
    ok('POST remove with the emailed value deletes every member of that request, after the request expired', rm.status === 200 && /deleted/.test(rm.text) && (await kv(['EXISTS', P() + 'mem:' + r.ids[0]])) === 0 && (await kv(['EXISTS', P() + 'mem:' + r.ids[1]])) === 0 && (await kv(['ZCARD', P() + 'm:2027-03'])) === 0);
    ok('…and the record', (await kv(['EXISTS', P() + 'rid:' + r.rid])) === 0);
    ok('…and a second press finds nothing', /nothing on the board/.test((await call('remove', 'POST', { x: r.x }, { form: true })).text));
    // Never claimed: the request itself goes, so Finish says it ran out.
    const s = await start(nextEmail(), ['fox']);
    const links = linksOf(emails[emails.length - 1]);
    await confirm(links.c);
    env({ BOARD_FORCE_LIVE: undefined, BOARD_PAUSE: '1' });
    const rn = await call('remove', 'POST', { x: links.x }, { form: true });
    env();
    ok('remove before the claim deletes the request, live or not, paused or not', rn.status === 200 && (await kv(['EXISTS', P() + 'pend:' + ridOf(s.json.pend)])) === 0);
    ok('…so the phone\'s Finish says it ran out', (await claim(s.json.pend)).json.expired === true);
    // Claimed and still pending: both go, so a repeated claim gets nothing back.
    const k = await join(['fox']);
    await call('remove', 'POST', { x: k.x }, { form: true });
    ok('remove right after a claim deletes the member and the request', (await kv(['EXISTS', P() + 'mem:' + k.ids[0]])) === 0 && (await claim(k.pend)).json.expired === true);
    // Four emails for one request: the first can no longer confirm, but it can always remove.
    const many = await start(nextEmail(), ['fox', 'cat']);
    const firstMail = linksOf(emails[emails.length - 1]);
    for (let i = 0; i < 3; i++) await start(nextEmail(), ['fox', 'cat'], { pend: many.json.pend });
    const lastMail = linksOf(emails[emails.length - 1]);
    ok('after four emails for one request the first one\'s confirm link has run out', /run out/.test((await confirm(firstMail.c)).text));
    await confirm(lastMail.c);
    const mc = await claim(many.json.pend);
    for (const m of mc.json.members) await day(m.token, 0);
    await kv(['DEL', P() + 'pend:' + ridOf(many.json.pend)]);
    const mg = await call('remove', 'GET', null, { query: '?x=' + encodeURIComponent(firstMail.x) });
    const mr = await call('remove', 'POST', { x: firstMail.x }, { form: true });
    let manyLeft = 0;
    for (const m of mc.json.members) manyLeft += await kv(['EXISTS', P() + 'mem:' + idOf(m.token)]);
    ok('…but its remove link still takes the children off, after the claim and after the request expired', mc.json.members.length === 2 && mg.status === 200 && /method="POST"/.test(mg.text) && mr.status === 200 && /deleted/.test(mr.text) && manyLeft === 0 && (await kv(['EXISTS', P() + 'rid:' + ridOf(many.json.pend)])) === 0, [mg.status, mr.status, manyLeft]);
    failOn = (cmd) => isEval(cmd, 'remove');
    const k2 = await join(['fox']);
    const rf = await call('remove', 'POST', { x: k2.x }, { form: true });
    failOn = null;
    ok('with the store failing, remove says so and deletes nothing', rf.status === 503 && (await kv(['EXISTS', P() + 'mem:' + k2.ids[0]])) === 1);
  });

  await scenario('admin', async () => {
    await flush();
    at('2027-03-10T09:00:00Z');
    const j = await join(['fox', 'cat']);
    for (const tk of j.tokens) await day(tk, 0);
    const none = await call('admin', 'GET', null, {});
    const wrong = await call('admin', 'GET', null, { founder: 'not-the-founder-key-x' });
    ok('admin needs FOUNDER_KEY', none.status === 401 && wrong.status === 401);
    env({ FOUNDER_KEY: undefined });
    ok('…and answers 503 when none is set', (await call('admin', 'GET', null, { founder: FOUNDER })).status === 503);
    env();
    const g = await call('admin', 'GET', null, { founder: FOUNDER });
    ok('admin GET: this month\'s count, 14 days of joins, today\'s emails', g.status === 200 && g.json.members === 2 && g.json.joins.length === 14 && g.json.joins[0].n === 2 && g.json.mail === 1, g.json);
    ok('…as bare numbers: no nickname, no id', !g.text.includes(j.members[0].nick) && !j.ids.some((x) => g.text.includes(x)));
    const rm = await call('admin', 'POST', { action: 'remove', nick: j.members[0].nick }, { founder: FOUNDER });
    ok('admin remove by nickname deletes that entry', rm.status === 200 && rm.json.deleted === true && (await kv(['EXISTS', P() + 'mem:' + j.ids[0]])) === 0 && (await kv(['EXISTS', P() + 'mem:' + j.ids[1]])) === 1);
    ok('…and refuses anything that is not a nickname', (await call('admin', 'POST', { action: 'remove', nick: '*' }, { founder: FOUNDER })).status === 400);
    env({ BOARD_FORCE_LIVE: undefined });
    ok('admin works when the board is off', (await call('admin', 'POST', { action: 'remove', nick: j.members[1].nick }, { founder: FOUNDER })).json.deleted === true);
  });

  // 11. Races: a deletion never leaves a key without a time limit ───────────
  await scenario('races', async () => {
    await flush();
    at('2027-03-10T09:00:00Z');
    for (const order of ['leave first', 'day first']) {
      const j = await join(['fox']);
      delayOn = (cmd) => (order === 'leave first' ? (isEval(cmd, 'day') ? 30 : 0) : (isEval(cmd, 'leave') ? 30 : 0));
      const [d, l] = await Promise.all([day(j.tokens[0], 0, { buddy: 'cat', tz: 60 }), leave(j.tokens[0])]);
      delayOn = null;
      ok('leave racing a day (' + order + '): the member is gone either way', l.json.deleted === true && (await kv(['EXISTS', P() + 'mem:' + j.ids[0]])) === 0 && (order === 'day first' ? d.json.counted === true : d.status === 404), [d.status, d.json]);
      ok('…and nothing of it is left: no nickname, entry or mark', (await keysLike(P() + 'nick:')).length === 0 && (await kv(['ZSCORE', P() + 'm:2027-03', j.ids[0]])) === null && (await keysLike(P() + 'tick:')).length === 0);
    }
    const j = await join(['fox']);
    delayOn = (cmd) => (isEval(cmd, 'nick') ? 30 : 0);
    await Promise.all([nick(j.tokens[0]), leave(j.tokens[0])]);
    delayOn = null;
    ok('leave racing a nickname change leaves no nickname behind', (await keysLike(P() + 'nick:')).length === 0 && (await keysLike(P() + 'mem:')).length === 0);
    const k = await join(['fox']);
    delayOn = (cmd) => (isEval(cmd, 'view') ? 30 : 0);
    const [vw] = await Promise.all([view(k.tokens[0]), leave(k.tokens[0])]);
    delayOn = null;
    ok('leave racing a view: the view says gone', vw.status === 404 && vw.json.gone === true);
    const noTtl = [];
    for (const key of await kv(['KEYS', '*'])) if ((await kv(['TTL', key])) === -1) noTtl.push(key);
    ok('leave racing a day leaves no board key without a TTL (nor any other key)', noTtl.length === 0, noTtl);
  });

  // 12. Hygiene, over everything the suite did ──────────────────────────────
  await scenario('hygiene', async () => {
    const keys = new Set();
    for (const cmd of commands) {
      if (cmd[0] === 'EVAL') { for (let i = 0; i < Number(cmd[2]); i++) keys.add(cmd[3 + i]); }
      else if (!['KEYS', 'FLUSHALL', 'MGET'].includes(cmd[0])) keys.add(cmd[1]);
      else if (cmd[0] === 'MGET') cmd.slice(1).forEach((k) => keys.add(k));
    }
    const badKeys = [...keys].filter((k) => !/^(board:|board-pv:|rl:)/.test(k) || /^reps:/.test(k));
    ok('every key a route touched starts with board:, board-pv: or rl:, never reps:', keys.size > 50 && badKeys.length === 0, badKeys.slice(0, 5));
    const sent = JSON.stringify(commands);
    ok('no command sent to the store holds an injected name, age, sound, fid, childId or clinician code', !/ZQ~[A-Z]+~QZ/.test(sent));
    ok('…or an email address ("@"), or the family domain', !sent.includes('@') && !sent.includes('family.example'));
    ok('…or a raw IP', ![...IPS].some((ip) => sent.includes(ip.replace(/^\[|\]$/g, ''))), [...IPS].find((ip) => sent.includes(ip)));
    ok('no log line holds an address', !logs.some((l) => /@|family\.example/.test(l)), logs.find((l) => /@/.test(l)));
    const emailed = new Set();
    for (const m of emails) { const { c, x } = linksOf(m); emailed.add(c); emailed.add(x); emailed.add(c.split('.')[2]); }
    const json = responses.filter((r) => !/text\/html/.test(r.headers.get('content-type') || ''));
    ok('no JSON response ever carries a confirm or remove link, or the emailed secret', json.length > 100 && !json.some((r) => /confirm\?c=|remove\?x=/.test(r.text) || [...emailed].some((e) => e && r.text.includes(e))));
    ok('every response says Cache-Control: no-store', responses.every((r) => r.headers.get('cache-control') === 'no-store'), responses.filter((r) => r.headers.get('cache-control') !== 'no-store').map((r) => r.route + ' ' + r.status).slice(0, 5));
    ok('no route ever threw', !responses.some((r) => r.status === 599), responses.filter((r) => r.status === 599).map((r) => r.text.slice(0, 200)));
    ok('the store never refused a command (every script ran)', storeErrors.length === 0, storeErrors.slice(0, 3));
    ok('nothing but the store and Resend was called', external.length === 0, external);
    ok('every email went through the repo\'s Resend helper, with its key', emails.length > 0 && emails.every((m) => m.auth === 'Bearer test-only-resend'));
    const SLP = [readFileSync(path.join(ROOT, 'public/slp.html'), 'utf8')];
    (function walk(d) { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n === 'route.ts') SLP.push(readFileSync(p, 'utf8')); } })(path.join(ROOT, 'app/api/slp'));
    ok('the clinician side never sees the board (slp.html, app/api/slp/**)', SLP.length > 5 && !SLP.some((s) => /\/api\/board|board:|Practice Board/.test(s)));
    const reps = await REPS.GET();
    ok('/api/reps still answers 410', reps.status === 410);
    const lib = noComments(readFileSync(path.join(ROOT, 'lib/board.ts'), 'utf8'));
    ok('lib/board.ts writes no reps: key', !/["'`]reps:/.test(lib));
  });

  // 13. The go-live pin ──────────────────────────────────────────────────────
  // First the words that ship in BOTH states (11 Oct 2026, spec step 11): the
  // privacy page's board section, and one line each on Progress, the parents'
  // FAQ and the clinician's setup step. While the board is dark nobody can
  // turn it on, so each family page that names it must say so conditionally
  // ("if Sona offers…"), never as if a family could today.
  {
    const page = (n) => readFileSync(path.join(ROOT, 'public', n), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const sentences = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&rsquo;|&#8217;/g, '’').replace(/&ldquo;|&rdquo;/g, '"').replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/).filter((s) => /Practice Board/.test(s));
    const privacy = page('privacy.html');
    ok('both states: privacy.html has its board section, "The Practice Board (only if a grown-up turns it on)"', privacy.includes('<h2>The Practice Board (only if a grown-up turns it on)</h2>'));
    ok('both states: …which says "Sona may offer" it, off unless a grown-up turns it on and confirms by email',
      privacy.includes('Sona may offer a monthly Practice Board.') && /It is off for every child unless a grown-up turns it\s+on in Settings and confirms by tapping a link we email to them/.test(privacy));
    ok('both states: …and the COPPA list says the board is off unless a parent turns it on', /<li>The Practice Board is off unless a parent turns it on and confirms by email\./.test(privacy));
    for (const n of ['progress.html', 'parents.html', 'onboarding.html']) {
      const found = sentences(page(n));
      ok('both states: ' + n + ' names the Practice Board only as something Sona may offer',
        found.length > 0 && found.every((s) => /if Sona offers|if it’s offered|may offer/i.test(s)), found);
    }
    // The clinician's setup step is read by a speech therapist, none of whose
    // families can ever be on the board (a phone holding their link is
    // "clinic"), so it says that and never that "a family may choose" it.
    const obClin = sentences(page('onboarding.html'));
    ok('both states: the clinician setup step says the board stays off on any phone holding their link',
      obClin.some((s) => /stays off on any phone that holds your link/.test(s)) && !obClin.some((s) => /may (also )?choose/i.test(s)), obClin);
  }
  {
    const live = /export const BOARD_LIVE = true;/.test(readFileSync(path.join(ROOT, 'lib/board.ts'), 'utf8')) || /const BOARD_LIVE = true;/.test(noComments(SONA));
    if (live) {
      ok('live: privacy.html says "The Practice Board (only if a grown-up turns it on)"', readFileSync(path.join(ROOT, 'public/privacy.html'), 'utf8').includes('The Practice Board (only if a grown-up turns it on)'));
      ok('live: the Terms carry title="Practice Board"', readFileSync(path.join(ROOT, 'app/terms/page.tsx'), 'utf8').includes('title="Practice Board"'));
      ok('live: for-slps.html says "You never see the board"', readFileSync(path.join(ROOT, 'public/for-slps.html'), 'utf8').includes('You never see the board'));
      const native = readFileSync(path.join(ROOT, 'NATIVE.md'), 'utf8');
      ok('live: NATIVE.md lists "Identifiers → User ID" and "Resend open and click tracking"', native.includes('Identifiers → User ID') && native.includes('Resend open and click tracking'));
    } else realLog('(the board is dark: the go-live copy pin waits for BOARD_LIVE = true)');
  }
} catch (e) {
  ok('the suite completes', false, e.stack);
}
for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
finish();
