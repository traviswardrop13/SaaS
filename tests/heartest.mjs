// HEAR1: on-device speech recognition, and the verdict rules that ride on it.
//
// The plugin (plugins/sona-speech) returns raw transcripts; the PASS/FAIL
// decision lives in sona.js so Rachel can tune it without an App Store review.
// These pin the decision rules — including the exact case that motivated the
// feature: a kid saying "poopoo" instead of an R sound must not advance — and
// the two safety properties: unknown NEVER fails a child the recognizer can't
// parse, and the plugin is never trusted unless it attests on-device.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8206, r));

const browser = await chromium.launch(launchOpts());
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

const page = await browser.newPage();
await page.goto("http://localhost:8206/today.html");
await page.waitForTimeout(500);

// ── 1. the verdict rules, case by case ──
const V = (t, sound, word) => page.evaluate(([a, b, c]) => Sona.hearVerdict(a, b, c), [t, sound, word]);

// THE MOTIVATING CASE. "poopoo" carries no R anywhere — intelligible speech
// with none of the target sound is a fail, and the segment must not advance.
ok('"poopoo" for the R sound FAILS', (await V("poopoo", "R", "")) === "fail");
ok('"poo poo" for the word rabbit FAILS', (await V("poo poo", "R", "rabbit")) === "fail");
ok('"banana banana" for R FAILS', (await V("banana banana", "R", "rain")) === "fail");

// Anything semi-close advances — Travis's rule, and the clinical one: the
// misarticulation IS the practice.
ok('"rabbit" for rabbit passes', (await V("rabbit", "R", "rabbit")) === "pass");
ok('"wabbit" for rabbit passes (one edit away — that IS the practice)',
  (await V("wabbit", "R", "rabbit")) === "pass");
ok('"the rabbit" inside a phrase passes', (await V("the rabbit", "R", "rabbit")) === "pass");
ok('"run" carries the R sound → passes even against another word',
  (await V("run", "R", "rain")) === "pass");
ok('"are" for isolated R practice passes', (await V("are", "R", "")) === "pass");

// digraphs match their spelling, not their letters
ok('"ship" for the SH sound passes', (await V("ship", "SH", "")) === "pass");
ok('"sip" for the SH sound FAILS (S is not SH)', (await V("sip", "SH", "")) === "fail");
ok('"this" for TH passes', (await V("this", "TH", "")) === "pass");

// UNKNOWN IS NOT A FAIL. Apple's models are adult-tuned; disordered child
// speech often will not transcribe. A child the recognizer cannot parse must
// be judged by the spectral check exactly as before this feature existed.
ok("an empty transcript is unknown, never fail", (await V("", "R", "rabbit")) === "unknown");
ok("silence/whitespace is unknown", (await V("   ", "R", "rabbit")) === "unknown");
ok("punctuation-only noise is unknown", (await V("...!!", "R", "rabbit")) === "unknown");

// short words never fuzzy-match into a false pass
ok('"cat" does not fuzzy-match "car"... it does not need to — it has no R; but "bat" vs target "bar": no R anywhere → fail',
  (await V("bat", "R", "bar")) === "fail");

// ── 2. availability fails CLOSED ──
// A plugin that reports onDevice:false must never be used, whatever else it
// claims — that is how a server fallback would sneak into an app whose hard
// rule is that no audio leaves the device.
{
  const st = await page.evaluate(async () => {
    const out = {};
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SonaSpeech: {
          available: async () => ({ available: true, onDevice: false, authorized: true }),
          start: async () => { out.started = true; return { started: true }; },
          stop: async () => ({ text: "rabbit", onDevice: false }),
        },
      },
    };
    out.avail = await Sona.speechAvailable();
    out.startRet = await Sona.speechStart({});
    out.stopRet = await Sona.speechStop();
    return out;
  });
  ok("a plugin that is not on-device is treated as unavailable", st.avail === false, JSON.stringify(st));
  ok("…speechStart refuses to start it", st.startRet === false && !st.started, JSON.stringify(st));
  ok("…and a transcript not attested on-device is discarded", st.stopRet === null, JSON.stringify(st));
}

// ── 3. the happy path through a mocked on-device plugin ──
// A fresh page: the mock must exist BEFORE sona.js loads (a reload wipes
// window state, which is what sank the first version of this block).
{
  const pg2 = await browser.newPage();
  await pg2.addInitScript(() => {
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SonaSpeech: {
          available: async () => ({ available: true, onDevice: true, authorized: true }),
          requestPermission: async () => ({ granted: true }),
          start: async (o) => { window.__startOpts = o; return { started: true }; },
          stop: async () => ({ text: "poopoo", onDevice: true }),
        },
      },
    };
  });
  await pg2.goto("http://localhost:8206/today.html");
  await pg2.waitForTimeout(500);
  const run = await pg2.evaluate(async () => {
    const out = {};
    out.avail = await Sona.speechAvailable();
    out.started = await Sona.speechStart({ words: ["rabbit"], maxMs: 5000 });
    out.opts = window.__startOpts;
    const r = await Sona.speechStop();
    out.verdict = Sona.hearVerdict(r && r.text, "R", "rabbit");
    return out;
  });
  ok("an on-device plugin is available and starts", run.avail === true && run.started === true, JSON.stringify(run));
  ok("…the target word biases the recognizer (contextualStrings)",
    run.opts && Array.isArray(run.opts.words) && run.opts.words[0] === "rabbit", JSON.stringify(run.opts));
  ok("…and the round's transcript yields the fail the feature exists for",
    run.verdict === "fail", JSON.stringify(run));
  await pg2.close();
}

// ── 4. source contracts ──
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const charge = readFileSync(ROOT + "/charge.html", "utf8");
  const swift = readFileSync(ROOT + "/../plugins/sona-speech/ios/Sources/SonaSpeechPlugin/SonaSpeechPlugin.swift", "utf8");

  ok("the Swift request REQUIRES on-device recognition",
    /requiresOnDeviceRecognition = true/.test(swift),
    "without this line the recognizer may route audio to Apple's servers");
  ok("the Swift plugin rejects when on-device is unsupported (fail closed)",
    /supportsOnDeviceRecognition else \{[\s\S]{0,120}reject/.test(swift),
    "the unavailable path must refuse, never fall back to the network");
  ok("recognition sessions are bounded (an abandoned round can't hold the mic)",
    /maxMs/.test(swift) && /15000/.test(swift));
  ok("verifyClip prefers the on-device transcript and falls back to spectral",
    /speechStop[\s\S]{0,400}hearVerdict[\s\S]{0,400}shapeVerdict\(\)/.test(charge));
  ok("the round biases recognition toward the practice word",
    /speechStart\(\{ words:/.test(charge));
  ok("the verdict rules live in sona.js, not the binary",
    /function hearVerdict/.test(sona),
    "clinical tuning must never need an App Store review");
  // ORDER MATTERS and is pinned from both sides: the mic prompt must ride
  // directly on the primer tap (storytest pins primer→getUserMedia with
  // nothing between), and the speech dialog comes AFTER the mic grant — a
  // speech prompt beating the mic prompt is exactly the confusion the primer
  // exists to prevent.
  ok("the speech permission is asked at setup, AFTER the mic grant",
    /getUserMedia\(\{audio:true[\s\S]{0,600}speechPerm/.test(charge)
    && !/micPrimer\(\);[\s\S]{0,200}speechPerm/.test(charge));
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
