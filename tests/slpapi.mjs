// SLPAPI1: the clinician's side of the roster — children set up AHEAD of the
// family, children taken off (by the clinician, or by the family themselves),
// and per-child data the device can never overwrite.
//
// What the dashboard exists for is CARRYOVER: send a child home with the
// right practice, see whether it happened, paste a sentence into a note. The
// three things that made that impossible were: a child appeared only after
// the family had practiced; nobody could remove one; and the device's sync
// overwrote the whole roster row, so nothing the clinician wrote about a
// child could live there. This suite pins the fixes — and, more than the
// fixes, the walls around them: an invite holds a LABEL, never a name, and
// deletes itself in 30 days; the claim trusts the bound ticket and the
// single-use token, never anything the device says about the child; the
// clinician routes read the clinic code from the SESSION; a child taken off
// STAYS off until a fresh invite is claimed; the family can withdraw consent
// from their own device and the deletion is real; and on production nothing
// is signed with a borrowed secret.
//
// lib/roster.ts is TypeScript. Node 22 strips types natively behind a flag,
// so this suite re-launches itself with it (as chartertest does). The lib
// imports its siblings through the "@/" alias, which plain node cannot
// resolve, so a small resolve hook maps "@/x" → "<repo>/x.ts" for this
// process only.
import { spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, existsSync } from "fs";
import { register } from "node:module";
import path from "path";

const self = fileURLToPath(import.meta.url);
if (!process.execArgv.includes("--experimental-strip-types")) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", self], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const APP = path.resolve(path.dirname(self), "..");
register(
  "data:text/javascript," + encodeURIComponent(`
    import { existsSync } from "node:fs";
    import { pathToFileURL } from "node:url";
    const ROOT = ${JSON.stringify(APP + "/")};
    export async function resolve(spec, ctx, next) {
      let s = spec;
      if (s.startsWith("@/")) s = pathToFileURL(ROOT + s.slice(2)).href;
      else if ((s.startsWith("./") || s.startsWith("../")) && ctx.parentURL && !/\\.[a-z]+$/.test(s)) s = new URL(s, ctx.parentURL).href;
      if (/^file:/.test(s) && !/\\.[a-z]+$/.test(s)) { const p = new URL(s).pathname; if (existsSync(p + ".ts")) s += ".ts"; }
      return next(s, ctx);
    }`),
  pathToFileURL(APP + "/"),
);

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };
const read = (rel) => (existsSync(APP + "/" + rel) ? readFileSync(APP + "/" + rel, "utf8") : "");
// A "this must NOT appear" assertion has to read CODE, not prose — the
// comment explaining why something is banned must not trip the ban.
const noComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// ── a fake KV: the Redis verbs the roster lib speaks, with a log ──
// The log is the point: it lets the suite say "every write to a hash was
// followed by an EXPIRE on that hash", which is the rule that keeps a quiet
// caseload ageing out of every key together instead of leaving orphans.
function fakeKv() {
  const H = new Map(), K = new Map(), TTL = new Map(), log = [];
  const h = (k) => { if (!H.has(k)) H.set(k, new Map()); return H.get(k); };
  const kv = async (cmd) => {
    log.push(cmd.map(String));
    const [op, key, a, b, c, d] = cmd.map(String);
    switch (op) {
      case "HSET": { const had = h(key).has(a); h(key).set(a, b); return had ? 0 : 1; }
      case "HGET": return h(key).has(a) ? h(key).get(a) : null;
      case "HGETALL": return [...h(key)].flat();
      case "HDEL": return h(key).delete(a) ? 1 : 0;
      case "HEXISTS": return h(key).has(a) ? 1 : 0;
      case "HLEN": return h(key).size;
      case "EXPIRE": TTL.set(key, Number(a)); return 1;
      case "GET": return K.has(key) ? K.get(key) : null;
      case "MGET": return cmd.slice(1).map((k) => (K.has(String(k)) ? K.get(String(k)) : null));
      case "SET": {
        const rest = cmd.slice(3).map(String);
        if (rest.includes("NX") && K.has(key)) return null;
        K.set(key, a);
        const ex = rest.indexOf("EX"); if (ex >= 0) TTL.set(key, Number(rest[ex + 1]));
        return "OK";
      }
      case "DEL": return (H.delete(key) ? 1 : 0) + (K.delete(key) ? 1 : 0);
      default: throw new Error("fake kv does not speak " + op);
    }
  };
  kv.H = H; kv.K = K; kv.TTL = TTL; kv.log = log;
  // every hash-mutating verb on `key` was followed, later in the log, by an EXPIRE on it
  kv.expiredAfterWrite = (key) => {
    let lastWrite = -1, lastExpire = -1;
    log.forEach((cmd, i) => {
      if (cmd[1] !== key) return;
      if (/^(HSET|HDEL)$/.test(cmd[0])) lastWrite = i;
      if (cmd[0] === "EXPIRE") lastExpire = i;
    });
    return lastWrite >= 0 && lastExpire > lastWrite;
  };
  return kv;
}

// ── the library, if it exists yet (the pre-change run must still report) ──
let R = null, A = null;
try { R = await import(APP + "/lib/roster.ts"); } catch (e) { console.log("(lib/roster.ts not importable: " + (e && e.message) + ")"); }
try { A = await import(APP + "/lib/slpAuth.ts"); } catch (e) { console.log("(lib/slpAuth.ts not importable: " + (e && e.message) + ")"); }
ok("lib/roster.ts exists and imports", !!R);

const authSrc = read("lib/slpAuth.ts");
const keyAlphabet = (authSrc.match(/const KEY_ALPHABET = "([^"]+)"/) || [])[1] || "";

if (R) {
  // ── invite tokens ──
  ok("invite tokens draw from the family key's unambiguous alphabet — the one a parent can read off a handout",
    !!keyAlphabet && R.TOKEN_ALPHABET === keyAlphabet, JSON.stringify({ lib: R.TOKEN_ALPHABET, auth: keyAlphabet }));
  const toks = Array.from({ length: 300 }, () => R.makeInviteToken());
  ok("a token is 12 characters, every one from that alphabet",
    R.TOKEN_LEN === 12 && toks.every((t) => t.length === 12 && [...t].every((ch) => keyAlphabet.includes(ch))), toks.slice(0, 3).join(" "));
  ok("…and they do not repeat", new Set(toks).size === toks.length);
  ok("cleanToken accepts a retyped token in any case and nothing of the wrong length",
    R.cleanToken(toks[0].toLowerCase()) === toks[0] && R.cleanToken("ABC") === "" && R.cleanToken(toks[0] + "X") === "");

  // ── what the clinician may put in an invite, and what is clamped ──
  const good = R.normalizeInvite({ label: "  M.K.  ", age: "6", sounds: ["r", "S", "r", "xx", "th", "l"], pos: "i", repsPerDay: 30, note: "Two minutes after breakfast." });
  ok("a normal invite normalises cleanly", !good.error && good.label === "M.K." && good.age === "6", JSON.stringify(good));
  ok("sounds are uppercased, deduped, checked against the sound list and capped at three",
    JSON.stringify(good.sounds) === JSON.stringify(["R", "S", "TH"]), JSON.stringify(good.sounds));
  ok("position and reps come through when valid", good.pos === "i" && good.repsPerDay === 30, JSON.stringify(good));
  const wide = R.normalizeInvite({ label: "x".repeat(80), age: "123abc", sounds: "R", pos: "nope", repsPerDay: 9999, note: "n".repeat(500) });
  ok("the label is capped at 40 characters", wide.label.length === 40, wide.label.length);
  ok("age is digits only, at most two", wide.age === "12", wide.age);
  ok("a non-list of sounds is no sounds (an invite with nothing to practice is still an invite)", Array.isArray(wide.sounds) && wide.sounds.length === 0, JSON.stringify(wide.sounds));
  ok("an unknown position falls back to mixed", wide.pos === "mix", wide.pos);
  ok("reps are clamped into the homework range", wide.repsPerDay === 200, wide.repsPerDay);
  ok("the parent note is capped at NOTE_MAX (240)", wide.note.length === 240, wide.note.length);
  const low = R.normalizeInvite({ label: "Bo", repsPerDay: 1 });
  ok("…from below too, and everything else has a default", low.repsPerDay === 5 && low.pos === "mix" && low.note === "" && low.age === "", JSON.stringify(low));
  const noLabel = R.normalizeInvite({ label: "   ", sounds: ["R"] });
  ok("an invite needs a label — it is all the pending list can show", !!noLabel.error, JSON.stringify(noLabel));
  ok("an invite has a LABEL and no name field at all — the family types the name when they join",
    Object.keys(good).sort().join() === "age,label,note,pos,repsPerDay,sounds" && !("child" in good) && !("name" in good), Object.keys(good).join());
  ok("…and no diagnosis, goal-bank or clinical note", !/diagnos|goalBank|clinicalNote|icd/i.test(Object.keys(good).join()));

  // ── expiry is real: each invite is its own key with its own EX ──
  const day = 86400000, now = Date.now();
  ok("isExpiredInvite reads expiresAt", R.isExpiredInvite({ expiresAt: new Date(now - 1000).toISOString() }, now) === true
    && R.isExpiredInvite({ expiresAt: new Date(now + day).toISOString() }, now) === false
    && R.isExpiredInvite({}, now) === true);
  ok("INVITE_TTL is 30 days, in seconds, and the cap is 200 pending per code", R.INVITE_TTL === 2592000 && R.INVITE_CAP === 200);

  {
    const kv = fakeKv();
    const made = await R.createInvite("Rachel-K4", good, kv);
    ok("createInvite stamps a token, createdAt and expiresAt 30 days out",
      made && made.token.length === 12 && /^\d{4}-/.test(made.createdAt) && Math.round((Date.parse(made.expiresAt) - Date.parse(made.createdAt)) / day) === 30, JSON.stringify(made));
    const dataKey = "inv:rachel-k4:" + made.token;
    ok("…the data lives under its OWN lowercase key with a 30-day EX", kv.K.has(dataKey) && kv.TTL.get(dataKey) === 2592000, JSON.stringify([...kv.K.keys()]) + " ttl=" + kv.TTL.get(dataKey));
    ok("…the index row carries timestamps and NO child data",
      kv.H.has("inv:rachel-k4") && Object.keys(JSON.parse(kv.H.get("inv:rachel-k4").get(made.token))).sort().join() === "createdAt,expiresAt",
      kv.H.get("inv:rachel-k4") && kv.H.get("inv:rachel-k4").get(made.token));
    ok("…and the index's expiry is refreshed", kv.expiredAfterWrite("inv:rachel-k4") && kv.TTL.get("inv:rachel-k4") === 150 * 86400);
    // a data key that the store has already expired, but whose index row remains
    await kv(["HSET", "inv:rachel-k4", "OLDTOKEN9999", JSON.stringify({ createdAt: new Date(now - 40 * day).toISOString(), expiresAt: new Date(now - 10 * day).toISOString() })]);
    const list = await R.readInvites("rachel-k4", kv);
    ok("readInvites lists the live invite", list.length === 1 && list[0].token === made.token && list[0].label === "M.K.", JSON.stringify(list.map((i) => i.token)));
    ok("…and DROPS the index row whose data key is gone — that is the 30-day auto-delete", !kv.H.get("inv:rachel-k4").has("OLDTOKEN9999"));
    ok("readInviteData finds a live token", (await R.readInviteData("rachel-k4", made.token, kv))?.token === made.token);
    ok("…and a missing one reads as gone", (await R.readInviteData("rachel-k4", "OLDTOKEN9999", kv)) === null);
    // single use
    ok("the first device to claim a token wins", (await R.claimInvite("rachel-k4", made.token, "kid1", kv)) === "won");
    ok("…the same device again is told it is theirs", (await R.claimInvite("rachel-k4", made.token, "kid1", kv)) === "mine");
    ok("…and a second device is told it was used", (await R.claimInvite("rachel-k4", made.token, "kid2", kv)) === "used");
    ok("…the lock is SET NX with a 150-day EX", kv.log.some((c) => c[0] === "SET" && c[1] === "invclaim:rachel-k4:" + made.token && c.includes("NX") && c.includes("EX")));
    ok("claimHolder names the winner", (await R.claimHolder("rachel-k4", made.token, kv)) === "kid1");
    await R.finishClaim("rachel-k4", made.token, "kid1", kv);
    const idx = JSON.parse(kv.H.get("inv:rachel-k4").get(made.token));
    ok("finishClaim records who and when on the index row", idx.claimedBy === "kid1" && !!idx.claimedAt && idx.createdAt === made.createdAt, JSON.stringify(idx));
    ok("…and DELETES the data key — the label does not outlive the tap", !kv.K.has(dataKey));
    ok("…so the claimed invite is no longer listed", (await R.readInvites("rachel-k4", kv)).length === 0);
    const other = await R.createInvite("rachel-k4", { ...good, label: "B." }, kv);
    ok("deleteInvite removes data and index and says so", (await R.deleteInvite("rachel-k4", other.token, kv)) === true && !kv.K.has("inv:rachel-k4:" + other.token) && !kv.H.get("inv:rachel-k4").has(other.token));
    ok("…and a missing token says so too", (await R.deleteInvite("rachel-k4", "NOSUCHTOKEN1", kv)) === false);
  }
  {
    const kv = fakeKv();
    for (let i = 0; i < R.INVITE_CAP; i++) await R.createInvite("cap-1", { ...good, label: "n" + i }, kv);
    ok("the 201st pending invite is refused", (await R.createInvite("cap-1", good, kv)) === null);
  }

  // ── per-child meta the device never overwrites — and that never holds a name ──
  {
    const kv = fakeKv();
    await R.writeMeta("RACHEL-K4", "kid1", { joinedAt: "2026-09-20T00:00:00.000Z", invitedAt: "2026-09-01T00:00:00.000Z", child: "Mia", age: "6", label: "M." }, kv);
    const m2 = await R.writeMeta("rachel-k4", "kid1", { archived: true }, kv);
    ok("writeMeta MERGES — archiving does not lose when the child joined", m2.joinedAt === "2026-09-20T00:00:00.000Z" && m2.invitedAt === "2026-09-01T00:00:00.000Z" && m2.archived === true, JSON.stringify(m2));
    ok("…keeps ONLY joinedAt / invitedAt / archived / updatedAt: a name, an age or a label passed by mistake is dropped",
      Object.keys(m2).sort().join() === "archived,invitedAt,joinedAt,updatedAt", JSON.stringify(m2));
    ok("…and unarchive clears the flag", !("archived" in (await R.writeMeta("rachel-k4", "kid1", { archived: false }, kv))));
    ok("…lives under the lowercase meta key", kv.H.has("slpmeta:rachel-k4") && kv.H.size === 1, [...kv.H.keys()].join());
    ok("…and refreshes the expiry", kv.expiredAfterWrite("slpmeta:rachel-k4"));
    const all = await R.readMeta("rachel-k4", kv);
    ok("readMeta returns every child's row keyed by childId", Object.keys(all).join() === "kid1" && !!all.kid1.joinedAt, JSON.stringify(all));
  }

  // ── gone: taking a child off, and everything about them goes ──
  {
    const kv = fakeKv();
    await kv(["HSET", "slp:rachel-k4", "kid1", JSON.stringify({ childId: "kid1", child: "Mia" })]);
    await kv(["HSET", "slp:rachel-k4", "kid2", JSON.stringify({ childId: "kid2", child: "Bo" })]);
    await kv(["HSET", "hw:rachel-k4", "kid1", JSON.stringify({ hw: { id: "h1" }, progress: null })]);
    await R.writeMeta("rachel-k4", "kid1", { joinedAt: "x" }, kv);
    const mine = await R.createInvite("rachel-k4", good, kv);
    await R.claimInvite("rachel-k4", mine.token, "kid1", kv);
    await R.finishClaim("rachel-k4", mine.token, "kid1", kv);
    const other = await R.createInvite("rachel-k4", { ...good, label: "B." }, kv);
    ok("nobody is gone to begin with", (await R.isGone("rachel-k4", "kid1", kv)) === false);
    const r = await R.removeChild("rachel-k4", "kid1", kv);
    ok("removeChild reports the child it removed", r && r.removed === "kid1", JSON.stringify(r));
    ok("…the roster row is gone, and the sibling's is not", !kv.H.get("slp:rachel-k4").has("kid1") && kv.H.get("slp:rachel-k4").has("kid2"));
    ok("…the homework row is gone", !kv.H.get("hw:rachel-k4").has("kid1"));
    ok("…the clinician's meta is gone", !kv.H.get("slpmeta:rachel-k4").has("kid1"));
    ok("…the index row of the invite that child claimed is gone, and a pending one is kept",
      !kv.H.get("inv:rachel-k4").has(mine.token) && kv.H.get("inv:rachel-k4").has(other.token));
    ok("…and the child is marked gone under slpgone:<code>, childId → when",
      (await R.isGone("rachel-k4", "kid1", kv)) === true && /^\d{4}-/.test(kv.H.get("slpgone:rachel-k4").get("kid1")));
    ok("…with a 400-day life, as long as any ticket", kv.TTL.get("slpgone:rachel-k4") === 400 * 86400, kv.TTL.get("slpgone:rachel-k4"));
    ok("readGone lists them", (await R.readGone("rachel-k4", kv)).has("kid1"));
    await R.unmarkGone("rachel-k4", "kid1", kv);
    ok("a fresh invite claim lifts the mark — a re-invited family can come back", (await R.isGone("rachel-k4", "kid1", kv)) === false);
  }

  // ── the roster record is ALWAYS valid JSON ──
  {
    const days = {}; for (let i = 0; i < 400; i++) days["2025-" + String(1 + (i % 12)).padStart(2, "0") + "-" + String(1 + (i % 28)).padStart(2, "0") + "x" + i] = { a: 12, p: 8 };
    const byWord = {}; for (let i = 0; i < 300; i++) byWord["word" + i] = { a: 3, p: 2 };
    const outcomes = {}; for (const s of ["R", "S", "L", "TH", "SH", "CH", "K"]) outcomes[s] = { attempts: 1, passes: 1, days: { ...days }, byWord: { ...byWord }, byPos: { i: { a: 1, p: 1 } } };
    const row = { childId: "kid1", child: "Mia", age: "6", outcomes, at: "2026-09-21T00:00:00.000Z" };
    const raw = JSON.stringify(row);
    const fit = R.fitRosterRecord(row);
    let parsed = null; try { parsed = JSON.parse(fit); } catch {}
    ok("an oversized record is still whole JSON — never a sliced string", raw.length > 16000 && !!parsed, "raw=" + raw.length + " fit=" + fit.length);
    ok("…the per-word breakdown goes first", parsed && Object.values(parsed.outcomes).every((o) => !("byWord" in o)));
    ok("…then each sound's day ledger is trimmed to the newest 90", parsed && Object.values(parsed.outcomes).every((o) => Object.keys(o.days).length === 90));
    ok("…the per-position breakdown and the identity fields survive", parsed && parsed.outcomes.R.byPos.i.a === 1 && parsed.child === "Mia" && parsed.at === row.at);
    const small = { childId: "kid2", outcomes: { R: { days: { "2026-09-01": { a: 1, p: 1 } }, byWord: { rain: { a: 1, p: 1 } } } } };
    ok("a record that fits is stored untouched", R.fitRosterRecord(small) === JSON.stringify(small));
  }
}

// ── the signing secret on production ──
if (A) {
  const saved = { env: process.env.VERCEL_ENV, sec: process.env.SLP_AUTH_SECRET };
  delete process.env.SLP_AUTH_SECRET; delete process.env.VERCEL_ENV;
  const tk = A.signTicket("rachel-k4", 1, "kid1");
  const ss = A.signSession({ email: "r@x.test", code: "rachel-k4", exp: Date.now() + 60000 });
  ok("off production, the fallback secret signs and verifies (the suites depend on this)",
    !!A.readTicket(tk, "rachel-k4") && !!A.verifySession(ss) && A.authSecretOk() === true);
  process.env.VERCEL_ENV = "production";
  ok("ON PRODUCTION with no SLP_AUTH_SECRET, a session signed with the fallback is refused", A.verifySession(ss) === null && A.readSession(new Request("http://x/", { headers: { cookie: "slp_session=" + encodeURIComponent(ss) } })) === null);
  ok("…so is a ticket", A.readTicket(tk, "rachel-k4") === null);
  let threw = false; try { A.signTicket("rachel-k4", 1, "kid1"); } catch { threw = true; }
  ok("…and nothing new is signed", threw && A.authSecretOk() === false);
  process.env.SLP_AUTH_SECRET = "a-real-secret-for-this-test";
  ok("with the dedicated secret set, production signs again", A.authSecretOk() === true);

  // THE MIGRATION, which is the whole reason this is safe to merge. Families
  // enrolled before the secret existed hold 400-day tickets signed with the KV
  // token, and their devices never ask for a new one. If setting the secret
  // invalidated those tickets, every enrolled family would stop syncing the
  // moment it was set — no homework in, no practice out, no error anyone sees,
  // and a clinician watching a live caseload go quiet would conclude the
  // families had stopped practicing. So the OLD secret still VERIFIES.
  {
    const legacy = "legacy-kv-token-from-before-the-secret";
    process.env.KV_REST_API_TOKEN = legacy;
    // the world as it was: no dedicated secret, and not yet refusing to sign
    // (production with no secret signs nothing at all — that is the pin above)
    delete process.env.SLP_AUTH_SECRET; delete process.env.VERCEL_ENV;
    const oldTicket = A.signTicket("rachel-k4", 400, "kid1");
    const oldSession = A.signSession({ email: "r@x.test", code: "rachel-k4", exp: Date.now() + 60000 });
    process.env.SLP_AUTH_SECRET = "a-real-secret-for-this-test";   // the day it is set
    process.env.VERCEL_ENV = "production";
    ok("a ticket minted before the secret existed KEEPS WORKING after it is set",
      !!A.readTicket(oldTicket, "rachel-k4"),
      "otherwise every enrolled family silently stops syncing the day the secret is set");
    ok("…and so does a clinician already signed in", !!A.verifySession(oldSession));
    ok("…while anything new is signed with the DEDICATED secret, not the old one",
      (function () {
        const fresh = A.signTicket("rachel-k4", 400, "kid1");
        // a world that only knows the legacy key (off production, so reading
        // is allowed at all — otherwise this would pass for the wrong reason)
        delete process.env.SLP_AUTH_SECRET; delete process.env.VERCEL_ENV;
        const readable = !!A.readTicket(fresh, "rachel-k4");
        process.env.SLP_AUTH_SECRET = "a-real-secret-for-this-test";
        process.env.VERCEL_ENV = "production";
        return !readable;
      })(),
      "the legacy key is honoured for reading only; it must never sign");
    ok("…and a signature from neither secret is still refused",
      A.readTicket(oldTicket.split(".")[0] + ".not-a-signature", "rachel-k4") === null);
    delete process.env.KV_REST_API_TOKEN;
  }
  if (saved.env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = saved.env;
  if (saved.sec === undefined) delete process.env.SLP_AUTH_SECRET; else process.env.SLP_AUTH_SECRET = saved.sec;
}

// ── the sign-up route refuses before it half-creates an account ──
{
  const req = read("app/api/slp/auth/request/route.ts");

  // The order is the pin, not the presence. signSession() throws without a
  // secret; if the account had already been stored by then, the clinician's
  // retry would take the "account exists" branch forever and only ever be
  // emailed a link that cannot verify either. One missing variable, one
  // clinician locked out for good, and a network error to explain it.
  const gate = req.indexOf("if (!authSecretOk())");
  ok("the sign-up route checks the signing secret at all", gate > 0);
  ok("…before it writes the account, mints a token or pings the CRM",
    gate > 0 &&
    gate < req.indexOf('kvCmd(["SET", "slptok:') &&
    gate < req.indexOf('kvCmd(["SET", "slpacct:') &&
    gate < req.indexOf("tellCrm(origin, email, String("),
    "a half-created account is a permanent lockout: the retry can never reach the new-account branch again");
  ok("…and says so in words a clinician can act on, not a stack trace",
    /Sign-in isn't switched on for this deployment yet/.test(req) && /hello@speaksona.com/.test(req));

  // A live ad spends whether or not the funnel works. One URL, opened in a
  // browser, has to answer "is it working" without reading a log.
  ok("GET on the sign-up route reports whether the funnel is wired",
    /export async function GET()/.test(req) && /ready: signing && store/.test(req));
  ok("…as presence booleans only, never the values themselves",
    /Boolean\(process\.env\.RESEND_API_KEY\)/.test(req) &&
    /Boolean\(process\.env\.LEAD_WEBHOOK_URL\)/.test(req) &&
    !/process\.env\.SLP_AUTH_SECRET/.test((req.split("export async function POST")[0].split("export async function GET")[1]) || ""),
    "a health check that prints a secret is a leak wearing a helpful hat");
}

// ── source contracts: the routes ──
{
  const roster = read("lib/roster.ts");
  const dash = read("app/api/slp/route.ts");
  const child = read("app/api/slp/child/route.ts");
  const invite = read("app/api/slp/invite/route.ts");
  const claim = read("app/api/slp/claim/route.ts");
  const pilot = read("app/api/pilot/route.ts");
  const forget = read("app/api/pilot/forget/route.ts");
  const devHw = read("app/api/homework/route.ts");
  const account = read("app/api/slp/account/route.ts");
  const join = read("public/join.html");
  const pilotHtml = read("public/pilot.html");
  const runAll = read("tests/run-all.mjs");

  ok("the routes exist", !!child && !!invite && !!claim && !!dash && !!forget, [!!child, !!invite, !!claim, !!dash, !!forget].join());

  // 2. the claim route: the device proves who it is; the invite says what to practice
  ok("claim verifies the enrolment ticket against the code",
    /readTicket\(ticket, code\)/.test(claim) && /status: 401/.test(claim),
    "a device that never passed the clinician's code+key has no standing to claim an invite");
  ok("claim requires the ticket to be BOUND to this child — an unbound ticket is refused, not bound on first use",
    /!t\.cid \|\| t\.cid !== childId/.test(claim) && /status: 403/.test(claim) && !/ticketOwnsChild/.test(noComments(claim)),
    "this flow always mints a bound ticket; an unbound one here is a replay");
  ok("claim never reads a name, an age or a label from the request",
    !!claim && !/body\.(child|name|age|label|childName)\b/.test(noComments(claim)));
  ok("…and never writes a name, an age or a label INTO slpmeta from the invite — only when",
    /writeMeta\(code, childId, \{ joinedAt: now, invitedAt: data\.createdAt \}\)/.test(claim),
    "the enrol beacon carries what the parent typed, and the roster row is the one place that lives");
  ok("claim needs no session (it is the family's device calling), but is rate limited and fails CLOSED without KV",
    !/readSession\(/.test(claim) && /rateLimit\(req, \{ key: "slpclaim", limit: 30/.test(claim) && /status: 503/.test(claim));
  ok("a missing data key is answered { claimed:false, reason:\"expired\" }", /claimed: false, reason: "expired"/.test(claim));
  ok("a token another device won is answered { claimed:false, reason:\"used\" }", /claimed: false, reason: "used"/.test(claim));
  ok("…and the single-use lock is the lib's SET NX", /claimInvite\(code, inv, childId\)/.test(claim) && /"NX", "EX", CLAIM_TTL/.test(roster));
  ok("claim turns the invite's sounds into the child's first assignment, on a fresh ledger, two weeks long",
    /normalizeHomework\(/.test(claim) && /writeHomework\(/.test(claim) && /days: \{\}/.test(claim) && /FIRST_ASSIGNMENT_DAYS = 14/.test(claim),
    "the device picks it up on its next sync — the clinician's pre-set target becomes what the child practices");
  ok("…addressed by the clinician's account name, looked up from the code — never from the body",
    /"slpcode:" \+ code/.test(claim) && /readAccount\(/.test(claim) && !/body\.by\b/.test(noComments(claim)));
  ok("…and the note is the invite's note", /note: data\.note/.test(claim));
  ok("claim closes by marking the index row and DELETING the data key, and lifts the gone mark",
    /finishClaim\(code, inv, childId\)/.test(claim) && /unmarkGone\(code, childId\)/.test(claim) &&
    /export async function finishClaim[\s\S]{0,700}"DEL", invDataKey/.test(roster));
  ok("claim returns { ok, claimed:true, sounds, pos }", /claimed: true, sounds: data\.sounds, pos: data\.pos/.test(claim));

  // the clinician routes: session, never a query param
  for (const [name, src] of [["child", child], ["invite", invite], ["dashboard", dash]]) {
    ok(`the ${name} route reads the clinic code from the SESSION, never the query string`,
      /readSession\(req\)/.test(src) && /s\.email/.test(src) && !/searchParams\.get\("code"\)/.test(src) && !/body\.code/.test(noComments(src)),
      "a clinic slug is printed on every family link");
    ok(`the ${name} route never builds a roster key by hand`, !/"slp:" *\+/.test(src));
  }
  ok("child and invite writes fail CLOSED without KV and are rate limited",
    /status: 503/.test(child) && /status: 503/.test(invite) &&
    /rateLimit\(req, \{ key: "slpchild", limit: 120/.test(child) && /rateLimit\(req, \{ key: "slpinvite", limit: 60/.test(invite));
  ok("the child route acts only on a child of THIS clinician (roster or meta), else 404",
    /not on your caseload/.test(child) && /status: 404/.test(child));
  ok("archive is a meta flag — the device keeps syncing, the clinician just stops seeing them by default",
    /archived: /.test(child) && /writeMeta\(/.test(child));
  ok("DELETE removes the child through the same function the family's own stop-sharing uses",
    /export async function DELETE/.test(child) && /removeChild\(/.test(child) && /removeChild\(/.test(forget));

  // 3. gone: the mark, and the two write paths that honour it
  ok("the mark lives under slpgone:<code> as a hash of childId → when, 400 days",
    /goneKey\(code: string\): string \{ return "slpgone:"/.test(roster) && /export async function markGone[\s\S]{0,300}"HSET", goneKey\(code\), childId, new Date\(\)\.toISOString\(\)/.test(roster) && /TOMB_TTL = 60 \* 60 \* 24 \* 400/.test(roster));
  {
    const check = pilot.indexOf("isGone(");
    const write = pilot.indexOf('"HSET"');
    ok("the pilot route checks the mark BEFORE the roster write and answers a plain ok WITHOUT writing",
      check > -1 && write > -1 && check < write && /isGone\(code, childId\)\) \{\s*return NextResponse\.json\(\{ ok: true, captured \}\);/.test(pilot) && !/removed by clinician/.test(pilot),
      "a 2xx keeps the device's logs quiet; the row simply never comes back");
    const hwCheck = devHw.indexOf("isGone(");
    const hwWrite = devHw.indexOf("writeHomework(");
    ok("the homework read answers a gone child { ok:true, hw:null } and never writes their progress",
      hwCheck > -1 && hwWrite > -1 && hwCheck < hwWrite && /isGone\(code, childId\)\) return NextResponse\.json\(\{ ok: true, hw: null \}\)/.test(devHw));
  }

  // 4. the family's own delete
  ok("POST /api/pilot/forget takes the ticket, the code and the child id",
    /readTicket\(ticket, code\)/.test(forget) && /status: 401/.test(forget) && /cleanChildId\(body\.childId\)/.test(forget));
  ok("…enforces the child binding (bound ticket direct, legacy ticket via ticketOwnsChild)",
    /t\.cid \? t\.cid === childId : await ticketOwnsChild\(/.test(forget) && /status: 403/.test(forget));
  ok("…performs the same deletion as the clinician's remove, and is rate limited and fails closed",
    /removeChild\(code, childId\)/.test(forget) && /rateLimit\(req, \{ key: "pilotforget", limit: 30/.test(forget) && /status: 503/.test(forget));
  ok("pilot.html offers 'Stop sharing with your speech therapist' to a device that is sharing",
    /Stop sharing with your speech therapist<\/button>/.test(pilotHtml) && /id="stopCard"/.test(pilotHtml) && /pi\.consent&&pi\.childId/.test(pilotHtml));
  ok("…with the confirm text agreed with the privacy review, and the two buttons",
    /Their dashboard forgets your child right away: name, age, practice history and homework are deleted, not hidden\. Sona stays free for you, and your child's progress stays on this device\./.test(pilotHtml) &&
    />Stop sharing<\/button>/.test(pilotHtml) && />Keep sharing<\/button>/.test(pilotHtml));
  ok("…the call carries the ticket, the device's child id and the code from pilotInfo, nothing typed",
    /\/api\/pilot\/forget/.test(pilotHtml) && /sona\.slpticket/.test(pilotHtml) && /Sona\.pilotInfo\(\)/.test(pilotHtml) &&
    /JSON\.stringify\(\{ code:code, childId:childId, ticket:ticket \}\)/.test(pilotHtml));
  ok("…and records the choice locally only AFTER the server said ok",
    /j&&j\.ok\)\{\s*try\{ Sona\.saveProfile\(\{ slpShare:false \}\)/.test(pilotHtml));
  ok("…without touching the enrolment form the credential tests drive", /id="shareSlp"/.test(pilotHtml) && /slpRedeem\(code,key\)/.test(pilotHtml));

  // 5. the roster row: consent recorded, and never a sliced string
  ok("the pilot route persists consentAt from the device and stamps the consent wording version",
    /consentAt: typeof b\.consentAt === "string"/.test(pilot) && /consentVer: CONSENT_VER/.test(pilot) && /CONSENT_VER = "join-2026-09"/.test(pilot));
  ok("the 16 KB truncation is gone: the record is fitted, never sliced",
    /fitRosterRecord\(\{/.test(pilot) && !/\.slice\(0, 16000\)/.test(pilot) && !/JSON\.stringify\([\s\S]{0,400}\)\.slice\(/.test(noComments(pilot)));

  // 6. the signing secret
  ok("slpAuth refuses to sign or verify on production without a dedicated secret",
    /export function authSecretOk\(\)/.test(authSrc) && /VERCEL_ENV !== "production"/.test(authSrc) &&
    /export function verifySession[\s\S]{0,120}if \(!authSecretOk\(\)\) return null;/.test(authSrc) &&
    /export function readTicket[\s\S]{0,140}if \(!authSecretOk\(\)\) return null;/.test(authSrc) &&
    /export function signSession[\s\S]{0,80}requireAuthSecret\(\);/.test(authSrc) &&
    /export function signTicket[\s\S]{0,120}requireAuthSecret\(\);/.test(authSrc),
    "a session signed with the KV token or the dev string must never be accepted in production");

  // invites
  ok("an invite's token is minted by the lib, never taken from the request",
    /makeInviteToken\(\)/.test(roster) && !/body\.token/.test(noComments(invite.replace(/DELETE[\s\S]*$/, ""))));
  ok("invites are validated by the lib's normaliser, and a bad one is a 400",
    /normalizeInvite\(/.test(invite) && /status: 400/.test(invite));
  ok("…and the cap is a 429", /status: 429/.test(invite));
  ok("the invite link is the join link the family already knows, plus the token",
    /\/join\.html\?slp=/.test(invite) && /&k=/.test(invite) && /&inv=/.test(invite) && /toUpperCase\(\)/.test(invite),
    "join.html parses ?slp and ?k; the code is uppercased there as every share link does");
  ok("…built from the request's own origin", /new URL\(req\.url\)\.origin/.test(invite));
  ok("DELETE /api/slp/invite removes by token: data key and index row", /export async function DELETE/.test(invite) && /deleteInvite\(/.test(invite)
    && /export async function deleteInvite[\s\S]{0,300}"DEL", invDataKey[\s\S]{0,200}"HDEL", invIndexKey/.test(roster));
  ok("each invite is its own key with SET … EX 30 days, and the index holds no child data",
    /"SET", invDataKey\(code, inv\.token\), JSON\.stringify\(inv\), "EX", INVITE_TTL/.test(roster) &&
    /const entry: InviteIndexEntry = \{ createdAt: inv\.createdAt, expiresAt: inv\.expiresAt \}/.test(roster));
  ok("a listing walks the index, MGETs the data keys and drops rows whose data is gone",
    /export async function readInvites[\s\S]{0,900}"MGET"[\s\S]{0,600}"HDEL", invIndexKey/.test(roster));

  // 8. the dashboard read
  ok("the dashboard keeps its session check and the legacy-roster heal",
    /readSession\(req\)/.test(dash) && /healLegacyRoster\(code\)/.test(dash));
  ok("…merges the clinician's meta into each kid", /readMeta\(/.test(dash) && /meta:/.test(dash));
  ok("…computes each kid's homework status with the same rule the homework routes use",
    /hwStatus\(/.test(dash) && /readAllHomework\(/.test(dash));
  ok("…hides children marked gone", /readGone\(/.test(dash) && /gone\.has\(childId\)\) continue/.test(dash));
  ok("…lists pending invites as { token, label, age, sounds, pos, repsPerDay, note, createdAt, expiresAt }",
    /token: i\.token, label: i\.label, age: i\.age, sounds: i\.sounds, pos: i\.pos,\s*repsPerDay: i\.repsPerDay, note: i\.note, createdAt: i\.createdAt, expiresAt: i\.expiresAt/.test(dash));
  ok("…the family key stays on /api/slp/account", !/familyKey/.test(noComments(dash)));

  // expiry discipline in the lib: every hash write is followed by a refresh
  {
    const body = noComments(roster);
    const writes = (body.match(/"(HSET|HDEL)"/g) || []).length;
    const touches = (body.match(/await touch\(/g) || []).length;
    ok("every hash write in the lib refreshes the key's expiry through one helper",
      writes > 0 && touches >= writes - 2 && /function touch\(/.test(roster) && /HASH_TTL = 60 \* 60 \* 24 \* 150/.test(roster),
      JSON.stringify({ writes, touches }));
  }

  // 7. join.html: the token is read before the URL is stripped, claim runs only behind Yes, and the copy says everything
  {
    const head = (join.match(/<script>([\s\S]*?)<\/script>/) || ["", ""])[1];
    ok("join.html reads ?inv beside ?slp and ?k, BEFORE the URL is stripped",
      /inv: q\.get\("inv"\)/.test(head) && head.indexOf('q.get("inv")') < head.indexOf("history.replaceState"),
      "the strip is what keeps the key out of captured pageview URLs; the token rides the same strip");
    const yes = (join.match(/getElementById\("jYes"\)\.onclick = function \(\) \{([\s\S]*?)\n\s*\};/) || ["", ""])[1];
    const no = (join.match(/getElementById\("jNo"\)\.onclick = function \(\) \{([\s\S]*?)\n\s*\};/) || ["", ""])[1];
    ok("saying Yes enrols first, then claims the invite", /slpJoinCaseload\(code\)/.test(yes) && yes.indexOf("slpJoinCaseload") < yes.indexOf("claimInvite("));
    ok("saying No never claims — a family that declined sharing is not put on the roster by a token",
      !!no && !/claim/i.test(no));
    ok("the claim carries the ticket and the device's own child id, and nothing typed on the device",
      /\/api\/slp\/claim/.test(join) && /sona\.slpticket/.test(join) && /pilotInfo\(\)/.test(join) &&
      /JSON\.stringify\(\{ code: code, ticket: ticket, childId: childId, inv: inv \}\)/.test(join));
    ok("…and is fire-and-forget: the unlock and enrolment never wait on it", /claim[\s\S]{0,600}\.catch\(function \(\) \{\}\)/.test(join));
    ok("the consent copy names the clinician and says what they see, what they can send, what never leaves, and that stopping deletes",
      /"If you say yes, " \+ \(name \|\| "your child's speech therapist"\) \+ " will see your child's first name and age as you entered them, "/.test(join) &&
      /which sounds they are practicing, practice days and how many tries each day, and a rough pass rate per sound\. /.test(join) &&
      /They can also send practice assignments and a short note to this app\. Never any audio; recordings stay on this device\. /.test(join) &&
      /You can stop any time, and stopping deletes everything they could see\. Saying no changes nothing; Sona stays free for you\./.test(join));
    ok("…and the two button labels the credential suite drives are unchanged",
      />Yes, share progress<\/button>/.test(join) && />No thanks — just use Sona<\/button>/.test(join));
    ok("…with the old two-paragraph copy gone", !/They'll see practice days, how many times your child practiced/.test(join));
  }

  // rotating the family key
  ok("POST /api/slp/account { rotateKey: true } mints a new key through the one minting function",
    /rotateKey/.test(account) && /rotateKey === true[\s\S]{0,200}makeFamilyKey\(\)/.test(account));
  ok("…and says out loud that minted tickets keep working while old links stop redeeming",
    // ORDER, NOT DISTANCE. This measured 900 characters from the first
    // "rotateKey" — which is the TYPE DECLARATION at the top of the body,
    // fifty lines above the branch — so the explanation could never fall
    // inside the window however well it was written. slpcode lost a pin to a
    // character window already; this asks the two things it actually means.
    /rotateKey === true && acct\.code\) acct\.familyKey = makeFamilyKey\(\)/.test(account) &&
    /families ALREADY enrolled keep syncing/i.test(account) && /enrolment ticket/i.test(account) &&
    /Rotating never knocks a real child off the\s+\/\/\s+dashboard/i.test(account),
    "a clinician rotating a key must be able to read what it does to the families already on it");

  // 9. register: what a clinician or parent reads is practice, not treatment
  for (const [name, src] of [["roster lib", roster], ["dashboard route", dash], ["child route", child], ["invite route", invite], ["claim route", claim], ["forget route", forget]]) {
    ok(`no diagnosis/treatment/score/adherence register in the ${name}`,
      !!src && !/\b(accuracy|score|adherence|therapy|treatment|diagnos\w*|goalBank|clinicalNote|icd)\b/i.test(noComments(src)),
      "describing is not disavowing: these files BAN those words in comments, so the scan reads the code");
  }
  ok("…nor in the strings pilot.html's stop-sharing card and join.html's consent show a parent",
    !/\b(accuracy|score|adherence|therapy|treatment|diagnos\w*)\b/i.test(noComments(join)) &&
    !/\b(accuracy|score|adherence|therapy|treatment)\b/i.test(noComments(pilotHtml).replace(/not a diagnosis or a substitute for professional care/, "")));

  ok("the suite is registered right after slpcode in run-all",
    /"slpcode\.mjs",[^\n]*\n\s*"slpapi\.mjs",/.test(runAll));
}


// ── the email IS the product, so it has to arrive and to be honest ──
{
  const auth = read("lib/slpAuth.ts");
  const slps = read("public/for-slps.html");

  ok("the sign-in email carries a plain-text part",
    /\n\s*text:\s*$/m.test(auth) || /text:\s*\n?\s*\(name \?/.test(auth),
    "HTML-only scores worse with every spam filter, and this message is the dashboard");
  ok("…whose link is the same link the button uses",
    /"Open it here:\\n" \+ link/.test(auth));

  // The usual cause of an empty inbox is an unverified sending domain, and
  // its symptom is silence. Silence is what this suite exists to break.
  ok("a refused send says why, in the log", /Resend refused the sign-in email/.test(auth));
  ok("…without ever logging the key", !/console\.error[\s\S]{0,200}RESEND_API_KEY/.test(auth));

  ok("the page does not claim an email that was refused",
    /if \(!j\.sent && !j\.signedIn\)/.test(slps),
    "an existing account has no other door; 'check your email' about an email that never went is a dead end");
  ok("…and gives them a way through instead", /hello@speaksona\.com/.test(slps));
}


// ── the sign-up actually reaches the CRM ──
{
  const req = read("app/api/slp/auth/request/route.ts");
  const lead = read("app/api/lead/route.ts");
  // On Vercel a function can be frozen the moment its response is sent, so a
  // fetch nobody awaits may never leave. The symptom is silence: sign-up
  // works, the CRM never hears, nothing errors.
  ok("the CRM call is awaited before the response, not fired and forgotten",
    /const crm = tellCrm\(/.test(req) && /await crm;/.test(req) &&
    req.indexOf("await crm;") < req.lastIndexOf("return out;") && !/void fetch\(origin \+ "\/api\/lead"/.test(req),
    "an un-awaited fetch in a serverless function can be dropped when the response is sent");
  ok("…with a fuse, so a slow CRM never costs a clinician their sign-in",
    /CRM_TIMEOUT_MS = \d+/.test(req) && /ctl\.abort\(\)/.test(req));
  ok("…and a lead the CRM did not take says so in the log", /CRM did not capture the lead/.test(req));

  // The clinician's own first name reaches the CRM — as its own field, only
  // on the clinician path, and never through `name`, which stays blank
  // because on the parent path the only name there is a child's.
  ok("the clinician's first name travels only when the caller is a clinician",
    /first_name: body\?\.role === "slp" && typeof body\?\.name === "string"/.test(lead));
  ok("…and reaches the webhook through the allow-list",
    /first_name: lead\.first_name,/.test(lead) && /role: lead\.role,/.test(lead) && /fbclid: lead\.fbclid,/.test(lead));
}


// ── what the clinician sees when sign-up does not go through ──
{
  const slps = read("public/for-slps.html");
  // The error line sits under the button — on a laptop, the bottom edge of the
  // window. Shown there and left there, a refused sign-up looked like a button
  // that did nothing (23 Sep 2026, with an ad running).
  ok("every sign-up error is brought into view as it is shown",
    /function err\(msg\)[\s\S]{0,200}scrollIntoView/.test(slps) &&
    !/\$\("fErr"\)\.textContent = [^"]*"[^"]/.test(slps.replace('$("fErr").textContent = "";', "")),
    "an error below the fold is an error nobody reads");
  ok("a signed-in clinician whose email failed is not told it is on its way",
    /else if \(!j\.sent\)/.test(slps) && /didn't go out just now, so bookmark the dashboard/.test(slps));
}


// ── every clinician reaches the CRM exactly once ──
{
  const req = read("app/api/slp/auth/request/route.ts");
  const start = req.indexOf("if (acctExists) {");
  const existing = start > 0 ? req.slice(start, req.indexOf("return NextResponse.json", start)) : "";
  // 23 Sep 2026: Travis signed up with his own address, got the dashboard
  // email, and GoHighLevel never heard of him — his account predated the CRM
  // wiring, and the CRM was told only when this route CREATED an account.
  ok("an existing account the CRM has never heard of is sent to it on sign-in",
    /if \(acct && !acct\.crmAt\)/.test(existing) && /await tellCrm\(/.test(existing),
    "otherwise every clinician who signed up before the CRM was wired stays invisible to it forever");
  ok("…once: the account is stamped when the CRM takes it, so a daily sign-in is not a daily new lead",
    /acct\.crmAt = new Date\(\)\.toISOString\(\)/.test(existing) &&
    /if \(captured\) await kvCmd\(\["SET", "slpacct:" \+ email, JSON\.stringify\(\{ \.\.\.acctNew, crmAt:/.test(req));
  ok("…and a sign-in request, which is not signed in, never rewrites the account's name",
    existing.length > 0 && !/acct\.name\s*=/.test(existing));
}


// ── a new clinician goes straight into the dashboard ──
{
  const slps = read("public/for-slps.html");
  ok("a brand-new, signed-in clinician is taken into the dashboard without a 'check your email' stop",
    /if \(j\.signedIn\) setTimeout\(function \(\) \{ location\.href = "\/slp\.html"; \}/.test(slps));
  ok("…after the Lead has fired, so the pixel's request leaves first",
    slps.indexOf('sonaTrack("Lead")') > 0 && slps.indexOf('sonaTrack("Lead")') < slps.indexOf('if (j.signedIn) setTimeout('));
}


// ── no lead is ever lost, and "sent to the CRM" means the CRM said yes ──
{
  const lead = read("app/api/lead/route.ts");
  const view = read("app/api/founders/leads/route.ts");
  const page = read("public/leads.html");
  const ob = read("public/onboarding.html");
  // 24 Sep 2026: the first ad showed 26 "Website Leads" and the CRM had
  // almost none. /api/lead forwarded and forgot, and called a refusal a
  // capture; setup fired Lead whether or not an email was given.
  ok("captured is true only when the CRM accepted the lead",
    /captured = !!\(hookRes && hookRes\.ok\) \|\| !!\(kitRes && kitRes\.ok\);/.test(lead) && !/body: JSON\.stringify\(safeLead\),\s*\}\);\s*captured = true;/.test(lead),
    "a 4xx from a broken workflow must not read as a lead delivered");
  ok("…and a refusal is logged with the CRM's own answer", /CRM webhook refused the lead/.test(lead));
  ok("every lead is also kept in our own store, capped",
    /kvCmd\(\["LPUSH", "leads:all", JSON\.stringify\(entry\)\]\)/.test(lead) && /kvCmd\(\["LTRIM", "leads:all", 0, \d+\]\)/.test(lead));
  const entry = lead.slice(lead.indexOf("const entry = {"), lead.indexOf("};", lead.indexOf("const entry = {")));
  ok("…built field by field from safeLead: never a child, never the free-text report",
    entry.length > 0 && !/\.\.\./.test(entry) && !/\blead\./.test(entry) && !/child|age:|practice|report/.test(entry),
    "the ledger is marketing data; a child's details have no place in it");
  const gate = read("lib/founder.ts");
  ok("the founder view needs a real FOUNDER_KEY, compared in constant time, from a header",
    /need\.length < 12/.test(gate) && /timingSafeEqual/.test(gate) && /x-founder-key/.test(gate) && !/searchParams\.get\("key"\)/.test(gate) &&
    /const denied = founderGate\(req\);\s*if \(denied\) return denied;/.test(view));
  ok("the founder page is hidden from search and loads no tracking",
    /name="robots" content="noindex/.test(page) && !/pixel\.js|analytics\.js|fbevents|posthog/.test(page),
    "it lists people's email addresses");
  ok("setup counts a Lead only when an email was given",
    /if\(draft\.email\) sonaTrack\("Lead"\); sonaTrack\("CompleteRegistration"\);/.test(ob),
    "a finished setup with no email is a registration, not a lead the CRM can ever show");
}


// ── Kit: every grown-up's email joins the list; nothing about a child does ──
{
  const kitSrc = read("lib/kit.ts");
  const lead = read("app/api/lead/route.ts");
  const sync = read("app/api/founders/kit-sync/route.ts");
  const ob = read("public/onboarding.html");
  ok("Kit is reached with the v4 API key header", /"X-Kit-Api-Key": process\.env\.KIT_API_KEY/.test(kitSrc));
  ok("the lead route sends every lead to Kit, tagged by role, with only a clinician's own first name",
    /kitSubscribe\(\{ email: safeLead\.email, firstName: safeLead\.first_name, tag: kitTagFor\(safeLead\.role\) \}\)/.test(lead) &&
    /first_name: body\?\.role === "slp" && typeof body\?\.name === "string"/.test(lead),
    "first_name is only ever a clinician's own name; a parent's lead carries none");
  ok("…and records Kit's answer on the saved lead", /kit: kitRes \? \(kitRes\.ok \? kitRes\.detail : "refused \(" \+ kitRes\.detail \+ "\)"\)/.test(lead));
  ok("the catch-up is founder-only, batched, and stops when Kit says slow down",
    /const denied = founderGate\(req\);/.test(sync) && /const BATCH = \d+;/.test(sync) && /r\.status === 429/.test(sync));

  // A parent's email used to stay on the phone; it now goes to the list, with
  // the grown-up's email and nothing from the child on the same screen.
  const fin = ob.slice(ob.indexOf('var em=(document.getElementById("achEmailInput")'), ob.indexOf("SonaAnalytics.track(\"onboarding completed\")"));
  ok("a parent's weekly-summary email is sent to the list, tagged parent",
    /fetch\("\/api\/lead",[^\n]*role:"parent"/.test(fin) && /keepalive:true/.test(fin));
  ok("…and never with the child's name or age",
    fin.length > 0 && !/childName|draft\.age|achEmName|nameEl|child:/.test(fin.slice(fin.indexOf('fetch("/api/lead"'))));

  // The consent line, everywhere an email can join the list (Travis's wording).
  for (const f of ["public/for-slps.html", "public/slp-login.html", "public/onboarding.html", "public/check.html"]) {
    ok(`${f} says the email joins the list before it is given`,
      /also send occasional tips from Rachel\. Unsubscribe anytime\./.test(read(f)));
  }
  ok("…on both of the app's email boxes", (ob.match(/also send occasional tips from Rachel/g) || []).length >= 2);
  ok("the Speech Check no longer promises to email a report it never sends", !/email your child's report/.test(read("public/check.html")));
  ok("the privacy policy names Kit and says it holds nothing about a child",
    /<strong>Email list<\/strong> — Kit/.test(read("public/privacy.html")) && /never anything about a child/.test(read("public/privacy.html")));

  // Behaviour, against a fake Kit: what is sent, and what counts as success.
  const calls = [];
  let createStatus = 201, formStatus = 404;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url), body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ u, method: init && init.method, body, key: init && init.headers && init.headers["X-Kit-Api-Key"] });
    const res = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
    if (u.endsWith("/v4/subscribers")) return res(createStatus, { subscriber: { id: 1 } });
    if (u.includes("/v4/tags?")) return res(200, { tags: [{ id: 77, name: "sona-parent" }, { id: 78, name: "sona-slp" }], pagination: { has_next_page: false } });
    if (/\/v4\/tags\/\d+\/subscribers$/.test(u)) return res(201, { subscriber: { id: 1 } });
    if (/\/v4\/forms\/.+\/subscribers$/.test(u)) return res(formStatus, { errors: ["Not Found"] });
    return res(404, {});
  };
  const saved = { key: process.env.KIT_API_KEY, form: process.env.KIT_FORM_ID };
  process.env.KIT_API_KEY = "kit_test_key"; process.env.KIT_FORM_ID = "12345";
  try {
    const K = await import(pathToFileURL(APP + "/lib/kit.ts").href);
    const r1 = await K.kitSubscribe({ email: "mom@example.com", firstName: "", tag: K.kitTagFor("parent") });
    const create = calls.find((c) => c.u.endsWith("/v4/subscribers"));
    ok("a parent is created in Kit with their email and no name", !!create && create.body.email_address === "mom@example.com" && !("first_name" in create.body));
    ok("…with the API key sent", !!create && create.key === "kit_test_key");
    ok("…tagged sona-parent", calls.some((c) => /\/v4\/tags\/77\/subscribers$/.test(c.u)));
    ok("a failed form step still counts the person as in Kit, and says what failed",
      r1.ok === true && /form 404/.test(r1.detail), JSON.stringify(r1));
    calls.length = 0; formStatus = 201;
    const r2 = await K.kitSubscribe({ email: "sam@clinic.org", firstName: "Sam", tag: K.kitTagFor("slp") });
    ok("a clinician goes with their own first name and the sona-slp tag, all steps clean",
      r2.ok && r2.detail === "added" && calls.some((c) => c.u.endsWith("/v4/subscribers") && c.body.first_name === "Sam") && calls.some((c) => /\/v4\/tags\/78\/subscribers$/.test(c.u)));
    calls.length = 0; createStatus = 401;
    const r3 = await K.kitSubscribe({ email: "x@y.org", tag: K.kitTagFor("parent") });
    ok("if the subscriber itself is refused, the lead is NOT counted as in Kit", r3.ok === false && /subscriber 401/.test(r3.detail));
    delete process.env.KIT_API_KEY;
    const r4 = await K.kitSubscribe({ email: "x@y.org" });
    ok("with no key, Kit is simply not configured — nothing is called", r4.ok === false && r4.detail === "not configured");
  } finally {
    globalThis.fetch = realFetch;
    if (saved.key === undefined) delete process.env.KIT_API_KEY; else process.env.KIT_API_KEY = saved.key;
    if (saved.form === undefined) delete process.env.KIT_FORM_ID; else process.env.KIT_FORM_ID = saved.form;
  }
}


// ── the lead door, hardened (independent review of #131, 24 Sep 2026) ──
{
  const lead = read("app/api/lead/route.ts");
  const req = read("app/api/slp/auth/request/route.ts");
  const page = read("public/leads.html");
  ok("an address longer than email allows is refused before it is kept", /email\.length > 254/.test(lead));
  ok("a stranger is limited to ten leads an hour from one address",
    /rateLimit\(req, \{ key: "lead", limit: 10, windowSec: 3600 \}\)/.test(lead),
    "otherwise a script fills the ledger past its cap and stuffs the Kit list with junk");
  ok("…while our own sign-up route, which forwards every clinician from the same servers, signs its leads past it",
    /"x-sona-lead-sig": leadSig\(email\)/.test(req) && /timingSafeEqual\(Buffer\.from\(sig\), Buffer\.from\(want\)\)/.test(lead) &&
    lead.indexOf("if (!internal)") > 0 && lead.indexOf("if (!internal)") < lead.indexOf("const toKit"));
  if (A) {
    ok("the signature is the server's own: same for the same email, different for another",
      A.leadSig("Sam@Clinic.org") === A.leadSig("sam@clinic.org") && A.leadSig("sam@clinic.org") !== A.leadSig("pat@clinic.org"));
  }
  ok("a timeout or network failure reads 'unreachable', never 'refused 0'",
    /hookRes\.status \? "refused " \+ hookRes\.status : "unreachable"/.test(lead) && /sub\.status \? "subscriber " \+ sub\.status : "unreachable"/.test(read("lib/kit.ts")));
  ok("the founder CSV cannot run a formula someone typed into a form",
    /if \(\/\^\[=\+\\-@\\t\\r\]\/\.test\(v\)\) v = "'" \+ v;/.test(page));
  ok("the founder page counts people, not rows", /var uniq = function \(list\)/.test(page) && /\$\("nLeads"\)\.textContent = uniq\(j\.leads\)/.test(page));
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
