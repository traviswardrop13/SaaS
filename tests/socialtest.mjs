// SOCIAL1: the daily short video posts with nobody looking (Travis, 11 Nov
// 2026: "fully automatic"), so the only reviewer is this file.
//
//   1. the content rules catch every claim CLAUDE.md forbids — a wrong
//      credential, a price, "free", therapy, a diagnosis, a promise, an age —
//      and let an ordinary, honest script through;
//   2. a script that breaks a rule twice never reaches the video maker;
//   3. a finished video is posted once per day, to all four networks,
//      labelled AI-generated and NOT made for kids, however often the post
//      step runs;
//   4. the switch, the auth and the schedule are where the setup doc says.
//
// Everything outside the repo (Claude, HeyGen, Upload-Post, the KV store)
// is a fake behind globalThis.fetch: no request leaves this machine.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra ?? ""))); };

const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => s.startsWith("@/") ? loadTs(path.join(ROOT, s.slice(2) + ".ts"))
    : s === "next/server" ? require(path.join(ROOT, "node_modules/next/server"))
    : s.startsWith("node:") ? require(s) : require(path.join(ROOT, "node_modules", s));
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}

// ── 1. the rules ──
const R = loadTs(path.join(ROOT, "lib/socialRules.ts"));
const clean = "Does practice feel like a fight? Try five minutes a day. In Sona, your child picks a game, says one sound on its own, and every round ends on a win. Their voice is listened to on your phone and never uploaded. Sona was built with Rachel, a licensed pediatric speech-language pathologist. Find Sona at speaksona.com.";
ok("an honest script passes", R.checkScript(clean).length === 0, R.checkScript(clean).join("; "));
const bad = {
  "a certified claim": "Built with a board-certified speech pathologist.",
  "the CCC": "Made by a CCC-SLP.",
  "the fellowship": "Rachel is a clinical fellow.",
  "fully licensed": "Rachel is fully licensed.",
  "a price": "All this for $4.99 a month.",
  "'free'": "Download Sona free today!",
  "a trial": "Start your trial today.",
  "therapy": "Sona is speech therapy at home.",
  "a diagnosis": "Sona can help diagnose speech problems.",
  "a score": "See your child's score after every round.",
  "a promise": "Sona will fix your child's lisp.",
  "a research claim": "Studies show this works.",
  "a label": "Great for kids with a speech delay.",
  "an age": "By age 4 your child should be saying R.",
  "a 'year-old'": "My 3-year-old loves it.",
  "speaking as the clinician": "I'm a speech therapist and I love this app.",
};
for (const [what, text] of Object.entries(bad)) ok("the checker stops " + what, R.checkScript(text).length > 0, text);
ok("the writer is told the one settled credential wording",
  R.WRITER_SYSTEM.includes("built with Rachel, a licensed pediatric speech-language pathologist"));
ok("there is a topic for every day, and the rotation wraps",
  R.TOPICS.length >= 14 && R.topicFor(0) === R.TOPICS[0] && R.topicFor(R.TOPICS.length) === R.TOPICS[0] && R.topicFor(-1) === R.TOPICS[R.TOPICS.length - 1]);
ok("the day is a UTC calendar date", R.dayKey(new Date("2026-11-11T23:30:00Z")) === "2026-11-11");

// ── the fakes ──
const kv = new Map();
const calls = { claude: 0, heygenCreate: [], uploads: [] };
let claudeAnswers = [];
let heygenStatus = "completed";
let claudeDown = false;
function kvRun([cmd, key, ...rest]) {
  switch (cmd) {
    case "GET": return kv.has(key) ? kv.get(key) : null;
    case "SET": {
      if (rest.includes("NX") && kv.has(key)) return null;
      kv.set(key, String(rest[0])); return "OK";
    }
    case "DEL": return kv.delete(key) ? 1 : 0;
    case "INCR": { const n = Number(kv.get(key) || 0) + 1; kv.set(key, String(n)); return n; }
    default: throw new Error("fake KV has no " + cmd);
  }
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith("https://kv.test")) return json({ result: kvRun(JSON.parse(init.body)) });
  if (url.startsWith("https://api.anthropic.com/v1/messages")) {
    calls.claude++;
    if (claudeDown) return json({ type: "error", error: { type: "invalid_request_error", message: "test outage" } }, 400);
    const text = JSON.stringify(claudeAnswers.shift());
    return json({ id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
  }
  if (url === "https://api.heygen.com/v3/videos" && init.method === "POST") {
    calls.heygenCreate.push(JSON.parse(init.body));
    return json({ data: { video_id: "vid_1", status: "pending" } });
  }
  if (url.startsWith("https://api.heygen.com/v3/videos/")) {
    return json({ data: { status: heygenStatus, video_url: "https://cdn.test/clean.mp4", captioned_video_url: "https://cdn.test/captioned.mp4" } });
  }
  if (url === "https://api.upload-post.com/api/upload") {
    const f = init.body;
    calls.uploads.push({ headers: init.headers, form: f instanceof FormData ? f : null });
    return json({ success: true, message: "Upload initiated successfully in background.", request_id: f.get("request_id") });
  }
  throw new Error("unexpected request in test: " + url);
};

Object.assign(process.env, {
  KV_REST_API_URL: "https://kv.test", KV_REST_API_TOKEN: "test-token",
  CRON_SECRET: "cron-secret-for-tests", FOUNDER_KEY: "founder-key-for-tests",
  ANTHROPIC_API_KEY: "sk-test", HEYGEN_VIDEO_API_KEY: "hg-test", HEYGEN_AVATAR_ID: "av", HEYGEN_VOICE_ID: "vo",
  UPLOADPOST_API_KEY: "up-test", UPLOADPOST_USER: "sona",
});
delete process.env.SOCIAL_PAUSED;

const route = loadTs(path.join(ROOT, "app/api/cron/social/route.ts"));
const { NextRequest } = require(path.join(ROOT, "node_modules/next/server"));
const call = async (q, headers = { authorization: "Bearer cron-secret-for-tests" }) => {
  const res = await route.GET(new NextRequest("https://sona.test/api/cron/social" + q, { headers }));
  return { status: res.status, body: await res.json() };
};
const goodScript = { title: "Five minutes a day", script: clean, caption: "Small, daily and on a win.", hashtags: ["speechpractice", "#parenting tips"] };
const day = R.dayKey(new Date());

// ── 4a. auth and the switch ──
ok("a stranger is turned away", (await call("?step=make", {})).status === 401);
ok("the status page is founder-only", (await call("?step=status")).status === 403);
process.env.SOCIAL_PAUSED = "1";
const p = await call("?step=make");
ok("SOCIAL_PAUSED=1 stops the run before anything is made", p.body.paused === true && calls.claude === 0 && calls.heygenCreate.length === 0, JSON.stringify(p.body));
delete process.env.SOCIAL_PAUSED;

// ── 2. a rule-breaking script never becomes a video ──
claudeAnswers = [
  { ...goodScript, script: "Sona is certified speech therapy, free for a week." },
  { ...goodScript, script: "Still free, still therapy." },
];
const blocked = await call("?step=make");
const rec0 = JSON.parse(kv.get("social:day:" + day) || "{}");
ok("a script that breaks the rules twice is skipped, not rendered",
  blocked.body.skipped === true && calls.claude === 2 && calls.heygenCreate.length === 0 && rec0.stage === "blocked",
  JSON.stringify(blocked.body));
const noPost = await call("?step=post");
ok("…and the post step has nothing to post", calls.uploads.length === 0, JSON.stringify(noPost.body));

// ── Claude unreachable: the day is recorded and freed for a manual rerun ──
kv.clear(); calls.claude = 0; claudeDown = true;
const down = await call("?step=make");
claudeDown = false;
ok("if Claude is unreachable, the day says why and is freed for a rerun",
  down.status === 502 && JSON.parse(kv.get("social:day:" + day) || "{}").stage === "write_failed"
  && !kv.has("social:lock:make:" + day) && calls.heygenCreate.length === 0, JSON.stringify(down.body));

// ── the next day's run: first draft breaks a rule, the rewrite is clean ──
kv.clear(); calls.claude = 0;
claudeAnswers = [{ ...goodScript, script: "Sona is speech therapy." }, goodScript];
const made = await call("?step=make");
ok("a rule-breaking first draft gets one rewrite, and the clean rewrite renders",
  made.body.ok === true && calls.claude === 2 && calls.heygenCreate.length === 1, JSON.stringify(made.body));
const hg = calls.heygenCreate[0] || {};
ok("the video is vertical, captioned, and reads the checked script",
  hg.aspect_ratio === "9:16" && hg.caption && hg.caption.style === "default" && hg.script === clean && hg.type === "avatar", JSON.stringify(hg));
ok("a second make the same day does nothing", (await call("?step=make")).body.note === "already made today" && calls.heygenCreate.length === 1);

// ── 3. posting ──
heygenStatus = "processing";
const early = await call("?step=post");
ok("a video still rendering is left for the next run", calls.uploads.length === 0 && /not ready/.test(early.body.note || ""), JSON.stringify(early.body));
heygenStatus = "completed";
const posted = await call("?step=post&retry=1");
ok("a finished video is posted", posted.body.ok === true && calls.uploads.length === 1, JSON.stringify(posted.body));
await call("?step=post");
ok("…once: later runs that day post nothing", calls.uploads.length === 1);
const up = calls.uploads[0] || { form: new FormData(), headers: {} };
const f = up.form;
ok("to TikTok, Instagram, YouTube and Facebook",
  ["tiktok", "instagram", "youtube", "facebook"].every((x) => f.getAll("platform[]").includes(x)), f.getAll("platform[]").join());
ok("the captioned render is the one posted", f.get("video") === "https://cdn.test/captioned.mp4");
ok("labelled AI-generated on every network", f.get("is_ai_generated") === "true" && f.get("facebook_is_ai_generated") === "true");
ok("declared NOT made for kids (the audience is parents)", f.get("selfDeclaredMadeForKids") === "false");
ok("the day's id is the idempotency key, so a retry can't double-post",
  up.headers["Idempotency-Key"] === "sona-daily-" + day && f.get("request_id") === "sona-daily-" + day);
ok("hashtags are cleaned and carried in the caption", /#speechpractice #parentingtips$/.test(String(f.get("title"))), f.get("title"));
ok("YouTube gets the short title", f.get("youtube_title") === goodScript.title);

// ── 4b. the schedule ──
const crons = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")).crons.map((c) => c.path);
ok("Vercel runs make once and post twice a day",
  crons.includes("/api/cron/social?step=make") && crons.filter((c) => c.startsWith("/api/cron/social?step=post")).length === 2
  && new Set(crons).size === crons.length, crons.join());
ok("the weekly parent email is still scheduled", crons.includes("/api/cron/weekly"));

console.log(fails ? fails + " FAILURES" : "ALL PASS");
process.exit(fails ? 1 : 0);
