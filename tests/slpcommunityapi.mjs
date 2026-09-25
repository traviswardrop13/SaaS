// Shared community HTTP contract. Optional SLP_COMMUNITY_REDIS_SERVER runs every
// assertion against the real Lua scripts in an isolated local Redis process.
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url), ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const source = file.endsWith('/slp/community/route.ts') && process.env.SLP_COMMUNITY_ROUTE_SOURCE ? process.env.SLP_COMMUNITY_ROUTE_SOURCE : file;
  const js = ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', js)(s => s.startsWith('@/') ? loadTs(path.join(ROOT, s.slice(2) + '.ts')) : require(s), mod, mod.exports);
  return mod.exports;
}
const { signSession } = loadTs(path.join(ROOT, 'lib/slpAuth.ts'));
const route = loadTs(path.join(ROOT, 'app/api/slp/community/route.ts'));
const KEYS = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SLP_AUTH_SECRET', 'SLP_COMMUNITY_MODERATOR_EMAILS'];
const oldEnv = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
const oldFetch = globalThis.fetch;
let checks = 0, fails = 0, sequence = 0, redisProcess, redisDir;
function ok(label, condition) { checks++; if (!condition) fails++; console.log((condition ? 'PASS ' : 'FAIL ') + label); }
const accountA = 'morgan@example.test', accountB = 'casey@example.test', moderator = 'moderator@example.test';
const welcomeId = '71109159-5b68-4af1-851c-35c918bc3050';
const welcomeText = 'I’m Rachel! My husband Travis and I started Sona, and I’m so happy you’re here.\n\nI’d love for this to be a place where we can swap ideas, share resources, and help each other make homework and planning a little easier. And if something in Sona is confusing or could work better, tell us—we’re building it with you.\n\nCome say hi! What setting do you work in, and what’s one thing you’d love help with right now?';
const accounts = new Map([
  ['slpacct:' + accountA, JSON.stringify({ email: accountA, name: 'Morgan PRIVATE_LASTNAME', code: '', familyKey: 'PRIVATE_KEY', clinic: 'PRIVATE_CLINIC', children: ['PRIVATE_CHILD'] })],
  ['slpacct:' + accountB, JSON.stringify({ email: accountB, name: 'Casey Other', code: 'private-code' })],
  ['slpacct:' + moderator, JSON.stringify({ email: moderator, name: 'Moderator Person', code: '' })],
]);
const posts = new Map(), indexes = new Map(), receipts = new Map(), counters = new Map(), reports = [], memberCache = new Map();
let forcedCount = 0, offline = false, failWrites = false, failReadLimit = false, failWelcome = false, externalCalls = 0, commands = [];

// An isolated, in-memory model keeps the suite portable. The same requests can
// also execute actual Redis, guarding cjson empty arrays and Lua race behavior.
function model(cmd) {
  const [op, ...args] = cmd;
  if (op === 'GET') return accounts.get(args[0]) ?? memberCache.get(args[0]) ?? null;
  if (op === 'SCAN') return ['0', [...accounts.keys()]];
  if (op === 'SET') { memberCache.set(args[0], args[1]); return 'OK'; }
  if (op === 'LRANGE') return reports.slice(0, 100).map(x => JSON.stringify(x));
  if (op !== 'EVAL') throw new Error('Unexpected store operation: ' + op);
  const script = args[0], n = Number(args[1]), k = args.slice(2, 2 + n), a = args.slice(2 + n);
  if (script.includes('HSETNX')) {
    const marker = a[0] + ':seeded';
    if (!posts.has(marker)) { posts.set(marker, '1'); if (!posts.has(a[0])) posts.set(a[0], JSON.parse(a[1])); }
    return posts.has(a[0]) ? JSON.stringify(posts.get(a[0])) : null;
  }
  if (!script.includes('local previous') && !script.includes('ZREVRANGEBYSCORE')) {
    const count = forcedCount || (counters.get(k[0]) || 0) + 1; counters.set(k[0], count); return count;
  }
  if (script.includes('ZREVRANGEBYSCORE')) {
    const cursor = a[0] === '+inf' ? Infinity : Number(String(a[0]).slice(1));
    return [...(indexes.get(k[0]) || new Map())].filter(([, score]) => score < cursor).sort((x, y) => y[1] - x[1]).slice(0, Number(a[1])).flatMap(([id, score]) => [JSON.stringify(posts.get(id)), String(score)]);
  }
  const previous = receipts.get(k[6]);
  if (previous) return JSON.stringify(previous.fingerprint === a[7] ? { status: 200, id: previous.id, duplicate: true } : { status: 409 });
  const [action, user, postId, replyId, encoded] = a;
  let post = posts.get(postId), target = post, replyIndex = -1;
  if (action !== 'post' && !post) return JSON.stringify({ status: 404 });
  if (replyId) { replyIndex = post.replies.findIndex(r => r.id === replyId); if (replyIndex < 0) return JSON.stringify({ status: 404 }); target = post.replies[replyIndex]; }
  if (action === 'delete' && target.authorId !== user && a[8] !== '1') return JSON.stringify({ status: 403 });
  if (action === 'reply' && post.replies.length >= 50) return JSON.stringify({ status: 409, full: true });
  const count = forcedCount || (counters.get(k[5]) || 0) + 1; counters.set(k[5], count);
  if (count > 60) return JSON.stringify({ status: 429 });
  let id = postId;
  if (action === 'post') {
    const item = JSON.parse(encoded); id = item.id; posts.set(id, item); const score = ++sequence;
    for (const index of [k[0], k[7] + item.category]) { if (!indexes.has(index)) indexes.set(index, new Map()); indexes.get(index).set(id, score); }
  } else if (action === 'reply') { const reply = JSON.parse(encoded); post.replies.push(reply); id = reply.id; }
  else if (action === 'report') { const report = { ...JSON.parse(encoded), postId, replyId, text: target.text, title: post.title, authorId: target.authorId }; reports.unshift(report); reports.splice(1000); id = report.id; }
  else if (action === 'delete') {
    if (replyId) post.replies.splice(replyIndex, 1);
    else { posts.delete(postId); indexes.get(k[0])?.delete(postId); indexes.get(k[7] + post.category)?.delete(postId); }
  }
  if (action !== 'delete') receipts.set(k[6], { id, fingerprint: a[7] });
  return JSON.stringify({ status: 200, id });
}
function respParse(buf, start = 0) {
  const end = buf.indexOf('\r\n', start); if (end < 0) return null;
  const prefix = String.fromCharCode(buf[start]), line = buf.toString('utf8', start + 1, end); let pos = end + 2;
  if (prefix === '+' || prefix === ':' || prefix === '-') return { value: prefix === ':' ? Number(line) : line, end: pos, error: prefix === '-' };
  if (prefix === '$') { const n = Number(line); if (n === -1) return { value: null, end: pos }; if (buf.length < pos + n + 2) return null; return { value: buf.toString('utf8', pos, pos + n), end: pos + n + 2 }; }
  if (prefix === '*') { const n = Number(line), values = []; if (n === -1) return { value: null, end: pos }; for (let i = 0; i < n; i++) { const p = respParse(buf, pos); if (!p) return null; values.push(p.value); pos = p.end; } return { value: values, end: pos }; }
  throw new Error('Unexpected Redis response');
}
async function realRedis(cmd) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(path.join(redisDir, 'redis.sock')); let data = Buffer.alloc(0);
    socket.setTimeout(3000, () => socket.destroy(new Error('Redis timed out')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(Buffer.concat([Buffer.from('*' + cmd.length + '\r\n'), ...cmd.flatMap(arg => { const b = Buffer.from(String(arg)); return [Buffer.from('$' + b.length + '\r\n'), b, Buffer.from('\r\n')]; })])));
    socket.on('data', chunk => { data = Buffer.concat([data, chunk]); const out = respParse(data); if (out) { socket.end(); out.error ? reject(new Error(out.value)) : resolve(out.value); } });
  });
}
const usingRedis = !!process.env.SLP_COMMUNITY_REDIS_SERVER;
async function request(method = 'GET', body, opts = {}) {
  const email = opts.email || accountA;
  const headers = new Headers({ 'content-type': 'application/json', origin: opts.origin === undefined ? 'https://sona.test.invalid' : opts.origin });
  if (!opts.signedOut) headers.set('cookie', 'slp_session=' + (opts.badCookie ? '%ZZ' : signSession({ email, exp: opts.expired ? Date.now() - 100 : Date.now() + 100000 })));
  const req = new Request('https://sona.test.invalid/api/slp/community' + (opts.query || ''), { method, headers, ...(method !== 'GET' ? { body: opts.raw ? body : JSON.stringify(body) } : {}) });
  try { const result = await route[method](req); return { status: result.status, json: await result.json(), headers: result.headers }; }
  catch (e) { return { status: 599, json: { error: e.message } }; }
}
let requestSeq = 0;
function post(overrides = {}, opts) { return request('POST', { action: 'post', title: 'Sharing a practice idea', text: 'A text-only discussion.', category: 'discussions', requestId: 'request_' + (++requestSeq), ...overrides }, opts); }
function reply(postId, overrides = {}, opts) { return request('POST', { action: 'reply', postId, text: 'Thanks for sharing.', requestId: 'request_' + (++requestSeq), ...overrides }, opts); }

try {
  for (const k of KEYS) delete process.env[k];
  process.env.KV_REST_API_URL = 'https://community-kv.test.invalid'; process.env.KV_REST_API_TOKEN = 'test-only-token'; process.env.SLP_AUTH_SECRET = 'test-only-community-secret'; process.env.SLP_COMMUNITY_MODERATOR_EMAILS = moderator;
  if (usingRedis) {
    redisDir = mkdtempSync(path.join(os.tmpdir(), 'sona-community-redis-'));
    redisProcess = spawn(process.env.SLP_COMMUNITY_REDIS_SERVER, ['--port', '0', '--unixsocket', path.join(redisDir, 'redis.sock'), '--save', '', '--appendonly', 'no', '--loglevel', 'warning'], { cwd: redisDir, stdio: 'ignore' });
    for (let i = 0; !existsSync(path.join(redisDir, 'redis.sock')) && i < 100; i++) await new Promise(r => setTimeout(r, 25));
    for (const [key, value] of accounts) await realRedis(['SET', key, value]);
  }
  globalThis.fetch = async (url, init) => {
    if (String(url) !== process.env.KV_REST_API_URL) { externalCalls++; throw new Error('Unexpected outbound call'); }
    const cmd = JSON.parse(init.body); commands.push(cmd);
    const mutation = cmd[0] === 'EVAL' && cmd[1].includes('local previous');
    const welcomeRead = cmd[0] === 'EVAL' && cmd[1].includes('HSETNX');
    const readLimit = cmd[0] === 'EVAL' && !mutation && !welcomeRead && !cmd[1].includes('ZREVRANGEBYSCORE');
    if (offline || (failWrites && mutation) || (failReadLimit && readLimit) || (failWelcome && welcomeRead)) return Response.json({ error: 'offline' }, { status: 503 });
    if (forcedCount && usingRedis) {
      if (readLimit) return Response.json({ result: forcedCount });
      if (mutation) await realRedis(['SET', cmd[8], forcedCount]);
    }
    return Response.json({ result: usingRedis ? await realRedis(cmd) : model(cmd) });
  };
  for (const opts of [{ signedOut: true }, { badCookie: true }, { expired: true }, { email: 'missing@example.test' }]) {
    const r = await request('GET', undefined, opts); ok('only signed-in real accounts have community access: ' + JSON.stringify(opts), r.status === 401);
  }
  const firstReads = await Promise.all([request(), request('GET', undefined, { email: accountB })]);
  let r = firstReads[0]; ok('existing account with unfinished profile has automatic access and empty feed', r.status === 200 && r.json.ok && r.json.posts?.length === 0 && r.json.nextCursor === null);
  const welcome = r.json.pinned?.[0];
  // WHO IS HERE (25 Sep 2026): the real count and first names, nothing more.
  ok('members see how many SLPs are in the community: every account', r.json.members?.count === accounts.size);
  ok('…and their first names only, never a last name', JSON.stringify(r.json.members?.names?.slice().sort()) === JSON.stringify(['Casey', 'Moderator', 'Morgan']) && !JSON.stringify(r.json.members).includes('PRIVATE') && !JSON.stringify(r.json.members).includes('Other'));
  {
    const scans = () => commands.filter(c => c[0] === 'SCAN').length;
    const before = scans(); await request(); await request('GET', undefined, { email: accountB });
    ok('…rebuilt at most every ten minutes, not on every read', scans() === before);
  }
  ok('members receive the approved Rachel welcome separately from ordinary posts', r.json.pinned?.length === 1 && welcome?.id === welcomeId && welcome.author === 'Rachel' && welcome.title === 'Hey everyone! 👋' && welcome.text === welcomeText && welcome.category === 'discussions' && welcome.pinned === true && Array.isArray(welcome.replies) && welcome.replies.length === 0);
  ok('simultaneous first reads seed one stable welcome for both accounts', firstReads.every(x => x.status === 200 && x.json.pinned?.length === 1 && x.json.pinned[0].id === welcomeId && x.json.pinned[0].createdAt === welcome?.createdAt && x.json.posts?.length === 0));
  ok('ordinary members receive no permission or private owner ID for the welcome', welcome?.canDelete === false && !JSON.stringify(r.json).includes('sona-team-rachel'));
  ok('community responses are never cached', r.headers?.get('cache-control') === 'no-store');
  r = await post({}, { origin: 'https://evil.test' }); ok('cross-origin mutations rejected', r.status === 403);
  r = await post({}, { origin: '' }); ok('missing origin rejected', r.status === 403);
  for (const raw of ['null', '[]', '{bad']) { r = await request('POST', raw, { raw: true }); ok('invalid JSON rejected: ' + raw, r.status === 400); }
  for (const change of [{ title: '' }, { text: '  ' }, { title: 'x'.repeat(121) }, { text: 'x'.repeat(4001) }, { category: 'private' }, { requestId: 'x' }, { text: {} }]) {
    r = await post(change); ok('invalid post rejected: ' + Object.keys(change).join(','), r.status === 400);
  }
  r = await request('POST', 'x'.repeat(20001), { raw: true }); ok('oversized request rejected before parsing', r.status === 413);
  const first = await post({ title: '<img src=x onerror=alert(1)>', text: '<script>alert(1)</script> 雪', author: 'Spoof', authorId: 'sona-team-rachel', id: welcomeId, pinned: true, email: 'spoof@example.test', requestId: 'stable_request_01' });
  ok('signed-in member creates shared post', first.status === 200 && first.json.id);
  const firstId = first.json.id;
  r = await request('GET', undefined, { email: accountB });
  let shared = r.json.posts?.find(p => p.id === firstId);
  ok('second account sees the same durable post', r.status === 200 && shared?.text === '<script>alert(1)</script> 雪');
  ok('shared author is server-derived first name', shared?.author === 'Morgan');
  ok('member-supplied pin identity and flag cannot create or replace a welcome', shared?.id !== welcomeId && !shared?.pinned && r.json.pinned?.length === 1 && r.json.pinned[0].text === welcomeText);
  ok('non-owner cannot delete through returned permissions', shared?.canDelete === false);
  const exposed = JSON.stringify(r.json);
  ok('shared response omits private names emails codes keys clinics and member IDs', !/PRIVATE_|example\.test|authorId|reporterId|familyKey|private-code|clinic|children/.test(exposed));
  ok('new post replies serialize as an array', Array.isArray(shared?.replies) && shared.replies.length === 0);
  r = await post({ title: '<img src=x onerror=alert(1)>', text: '<script>alert(1)</script> 雪', author: 'Spoof', email: 'spoof@example.test', requestId: 'stable_request_01' });
  ok('retry reuses successful post receipt', r.status === 200 && r.json.id === firstId && r.json.duplicate === true);
  r = await post({ requestId: 'stable_request_01' }); ok('same request ID with changed content is rejected', r.status === 409);
  const together = await Promise.all([reply(firstId, { text: 'Reply one' }, { email: accountB }), reply(firstId, { text: 'Reply two' })]);
  r = await request(); shared = r.json.posts?.find(p => p.id === firstId);
  ok('concurrent writers retain both replies', together.every(x => x.status === 200) && shared?.replies.length === 2 && shared.replies.some(x => x.text === 'Reply one') && shared.replies.some(x => x.text === 'Reply two'));
  const welcomeReplies = await Promise.all([reply(welcomeId, { text: 'Hello Rachel from a school!' }), reply(welcomeId, { text: 'Hi from a clinic!' }, { email: accountB })]);
  r = await request('GET', undefined, { email: accountB });
  let updatedWelcome = r.json.pinned?.[0];
  ok('concurrent replies to the welcome persist across accounts and repeated reads', welcomeReplies.every(x => x.status === 200) && updatedWelcome?.createdAt === welcome?.createdAt && updatedWelcome?.replies.length === 2 && updatedWelcome.replies.some(x => x.author === 'Morgan' && x.text === 'Hello Rachel from a school!') && updatedWelcome.replies.some(x => x.author === 'Casey' && x.text === 'Hi from a clinic!'));
  r = await request('DELETE', { postId: welcomeId, authorId: 'sona-team-rachel' }); ok('members cannot delete the welcome or claim its server owner', r.status === 403);
  r = await request('DELETE', { postId: welcomeId, replyId: welcomeReplies[1].json.id }); ok('members cannot delete another member reply to the welcome', r.status === 403);
  const deleteWelcomeReply = await request('DELETE', { postId: welcomeId, replyId: welcomeReplies[0].json.id });
  r = await request(); updatedWelcome = r.json.pinned?.[0];
  ok('members can delete their own welcome reply without removing the welcome or other replies', deleteWelcomeReply.status === 200 && updatedWelcome?.replies.length === 1 && updatedWelcome.replies[0].id === welcomeReplies[1].json.id);
  const bReply = together[0].json.id, aReply = together[1].json.id;
  r = await request('DELETE', { postId: firstId }, { email: accountB }); ok('another member cannot delete a post', r.status === 403);
  r = await request('DELETE', { postId: firstId, replyId: bReply }); ok('post ownership does not grant deletion of another member reply', r.status === 403);
  r = await reply(firstId, { text: 'x'.repeat(2001) }); ok('reply text is bounded', r.status === 400);
  const reportBody = { action: 'report', postId: firstId, replyId: bReply, reason: 'Please review', requestId: 'report_request_01' };
  failWrites = true; r = await request('POST', reportBody); ok('failed report persistence never claims receipt', r.status === 503 && !r.json.ok); failWrites = false;
  r = await request('POST', reportBody); ok('report is confirmed only after durable storage', r.status === 200 && r.json.ok);
  r = await request('POST', reportBody); ok('report retry is deduplicated', r.status === 200 && r.json.duplicate);
  r = await request('GET', undefined, { query: '?reports=1' }); ok('report inbox is private from ordinary members', r.status === 403);
  r = await request('GET', undefined, { query: '?reports=1', email: moderator });
  ok('moderator can inspect saved content even without exposing it in feed', r.status === 200 && r.json.reports?.length === 1 && r.json.reports[0].text === 'Reply one' && r.json.reports[0].reason === 'Please review');
  r = await request('DELETE', { postId: firstId, replyId: bReply }, { email: accountB }); ok('reply author can delete own reply', r.status === 200);
  r = await request('DELETE', { postId: firstId, replyId: aReply }); ok('remaining reply can be deleted', r.status === 200);
  r = await request(); shared = r.json.posts?.find(p => p.id === firstId); ok('last-reply deletion retains usable empty replies array', r.status === 200 && Array.isArray(shared?.replies) && shared.replies.length === 0);
  const resource = await post({ category: 'resources', title: 'A resource' }, { email: accountB });
  r = await request('GET', undefined, { query: '?category=resources' }); ok('category filter returns only its posts', r.status === 200 && r.json.posts?.length === 1 && r.json.posts[0].id === resource.json.id);
  r = await request('DELETE', { postId: resource.json.id }, { email: moderator }); ok('configured moderator can remove a reported post', r.status === 200);
  r = await request('GET', undefined, { query: '?category=resources' }); ok('delete removes category index entry', r.status === 200 && r.json.posts?.length === 0);
  for (let i = 0; i < 22; i++) await post({ title: 'Page item ' + i }, { email: accountB });
  const pageOne = await request(), pageTwo = await request('GET', undefined, { query: '?cursor=' + pageOne.json.nextCursor });
  ok('feed is bounded and newest first', pageOne.json.posts?.length === 20 && pageOne.json.posts[0].title === 'Page item 21' && !!pageOne.json.nextCursor);
  ok('pagination has no repeats or lost posts', pageTwo.json.posts?.length === 3 && pageTwo.json.nextCursor === null && !pageTwo.json.posts.some(p => pageOne.json.posts.some(other => p.id === other.id)));
  const categoryWithWelcome = await request('GET', undefined, { query: '?category=resources' });
  ok('welcome stays separate on later pages and category filters without changing normal pagination', [pageOne, pageTwo, categoryWithWelcome].every(x => x.json.pinned?.length === 1 && x.json.pinned[0].id === welcomeId && x.json.pinned[0].replies.length === 1 && !x.json.posts?.some(p => p.id === welcomeId)) && categoryWithWelcome.json.posts?.length === 0);
  for (const query of ['?cursor=-1', '?cursor=abc', '?category=admin']) { r = await request('GET', undefined, { query }); ok('invalid query is rejected: ' + query, r.status === 400); }
  failWelcome = true; r = await request(); ok('welcome storage outage fails closed instead of inventing an empty pinned feed', r.status === 503 && !r.json.ok); failWelcome = false;
  const moderatorFeed = await request('GET', undefined, { email: moderator });
  r = await request('DELETE', { postId: welcomeId }, { email: moderator });
  ok('configured moderator can remove the welcome', moderatorFeed.json.pinned?.[0]?.canDelete === true && r.status === 200);
  const afterRemoval = await Promise.all([request(), request('GET', undefined, { email: accountB })]);
  r = await reply(welcomeId);
  ok('later and concurrent reads never resurrect a removed welcome or permit new replies', afterRemoval.every(x => x.status === 200 && Array.isArray(x.json.pinned) && x.json.pinned.length === 0) && r.status === 404);
  forcedCount = 121; r = await request(); ok('read rate limit enforced', r.status === 429);
  forcedCount = 61; r = await post(); ok('write rate limit enforced', r.status === 429);
  r = await post({ title: '<img src=x onerror=alert(1)>', text: '<script>alert(1)</script> 雪', author: 'Spoof', email: 'spoof@example.test', requestId: 'stable_request_01' }); ok('successful retries still recover receipt at rate limit', r.status === 200 && r.json.duplicate); forcedCount = 0;
  failReadLimit = true; r = await request(); ok('read limiter outage fails closed', r.status === 503); failReadLimit = false;
  failWrites = true; r = await post(); ok('store outage never claims a post was saved', r.status === 503 && !r.json.ok); failWrites = false;
  offline = true; r = await request(); ok('account/store outage fails closed rather than returning an empty success', r.status === 503); offline = false;
  ok('no community messages or member details are sent to external services', externalCalls === 0);
  const writes = commands.filter(c => c[0] === 'EVAL' && c[1].includes('local previous'));
  ok('mutations use an atomic script with ownership, rate limits and expiring retry receipts', writes.length > 0 && writes.every(c => /target\.authorId/.test(c[1]) && /'INCR'/.test(c[1]) && /86400/.test(c[1]) && /'HSET'/.test(c[1])));
} finally {
  globalThis.fetch = oldFetch;
  for (const k of KEYS) oldEnv[k] === undefined ? delete process.env[k] : process.env[k] = oldEnv[k];
  if (redisProcess) { redisProcess.kill(); await new Promise(r => redisProcess.once('exit', r)); }
  if (redisDir) rmSync(redisDir, { recursive: true, force: true });
}
console.log(`${checks - fails}/${checks} passed (${usingRedis ? 'real Redis Lua' : 'deterministic KV model'})`);
process.exitCode = fails ? 1 : 0;
