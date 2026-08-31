// Sound-shape gate: the SHIPPED classifier code (extracted from charge.html)
// judging Rachel's REAL recordings through a real browser AnalyserNode —
// exactly the pipeline the app uses (dB-scaled bytes, 512 FFT, voiced frames).
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", mp3: "audio/mpeg" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8133, r));

let fails = 0;
const ok = (n, p) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n); };

// ── source tripwires ──
const src = readFileSync(ROOT + "/charge.html", "utf8");
// Stronger than before: the cloud scorer is gone, so EVERY rung is judged on
// the phone and no clip is ever uploaded. That is what makes the consent copy
// ("no recording is ever uploaded") true rather than aspirational.
// HEAR1 widened this: the verdict is now on-device TRANSCRIPT first (the
// SonaSpeech plugin, requiresOnDeviceRecognition), on-device SPECTRAL second.
// Both paths stay on the phone; what this pins is that no third path exists.
ok("every verdict is on-device: transcript first, spectral fallback",
  /async function verifyClip\(\)\{[\s\S]{0,700}speechStop[\s\S]{0,400}hearVerdict[\s\S]{0,400}return shapeVerdict\(\);[\s\S]{0,20}\}/.test(src));
ok("…and the verdict path makes no network call",
  !/function verifyClip[\s\S]{0,900}fetch\(/.test(src));
ok("no page uploads a clip to a scorer", !/api\/score/.test(src));
ok("shape sampled on voiced frames in the engine", /an\.getByteFrequencyData\(fd\); shapeFrame\(fd,binHz\);/.test(src));
const shapeSrc = src.match(/var SHAPE=\{[\s\S]*?return "pass";\n    \}/)?.[0];
ok("SHAPE block extracted from charge.html", !!shapeSrc);
if (!shapeSrc) { srv.close(); process.exit(1); }

const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
const page = await browser.newPage();
await page.goto("http://localhost:8133/charge.html"); // any origin; we run our own harness
await page.evaluate((code) => {
  window.SOUND = "R";
  // the extracted block references SOUND as a free variable
  window.__runShape = new Function("SOUNDref", "var SOUND=SOUNDref;" + code +
    ";return {reset:shapeReset, frame:shapeFrame, verdict:shapeVerdict, S:SHAPE};");
}, shapeSrc);

// Play a clip through a real AnalyserNode and classify with the shipped code.
// `reps` replays short clips back-to-back the way a real 5-rep round would.
const classify = (file, target, reps = 1) => page.evaluate(async ({ file, target, reps }) => {
  const h = window.__runShape(target);
  h.reset();
  const ctx = new AudioContext();
  const buf = await ctx.decodeAudioData(await (await fetch("/coach/say/" + file)).arrayBuffer());
  const an = ctx.createAnalyser(); an.fftSize = 512;
  const g = ctx.createGain(); g.gain.value = 0;
  an.connect(g); g.connect(ctx.destination);
  const td = new Uint8Array(an.fftSize), fd = new Uint8Array(an.frequencyBinCount);
  const binHz = ctx.sampleRate / an.fftSize;
  let playing = true;
  (async () => {
    for (let i = 0; i < reps; i++) {
      const srcN = ctx.createBufferSource(); srcN.buffer = buf; srcN.connect(an);
      const done = new Promise((res) => (srcN.onended = res));
      srcN.start(); await done;
    }
    playing = false;
  })();
  await new Promise((res) => {
    (function tick() {
      an.getByteTimeDomainData(td);
      let s = 0; for (let i = 0; i < td.length; i++) { const d = (td[i] - 128) / 128; s += d * d; }
      if (Math.sqrt(s / td.length) > 0.03) { an.getByteFrequencyData(fd); h.frame(fd, binHz); }
      if (!playing) return setTimeout(res, 50);
      requestAnimationFrame(tick);
    })();
  });
  const v = h.verdict();
  await ctx.close();
  return { v, shape: window.__shape || null, frames: h.S.frames };
}, { file, target, reps });

// (file, claimed target, expected verdict, label, reps)
const CASES = [
  ["R-demo.mp3", "R", "pass", "real R as R"],
  ["M-demo.mp3", "R", "pass", "M as R (same family — local gate can't catch, syllables+ do)"],
  ["S-demo.mp3", "R", "fail", "S claimed as R — Travis's repro"],
  ["SH-demo.mp3", "R", "fail", "SH as R"],
  ["F-demo.mp3", "R", "fail", "F as R"],
  ["Z-demo.mp3", "R", "fail", "Z as R"],
  ["CH-demo.mp3", "R", "fail", "CH as R"],
  ["TH-demo.mp3", "R", "fail", "TH as R"],
  ["T-demo.mp3", "R", "fail", "T said 5x as R (aspiration reads hissy)", 5],
  ["T-demo.mp3", "R", "unknown", "T said ONCE — too little voice, never judged", 1],
  ["S-demo.mp3", "S", "pass", "real S as S"],
  ["Z-demo.mp3", "Z", "pass", "real Z as Z"],
  ["R-demo.mp3", "S", "fail", "R claimed as S"],
  ["M-demo.mp3", "S", "fail", "M as S"],
  ["THV-demo.mp3", "THV", "pass", "voiced TH as itself"],
  ["K-demo.mp3", "K", "pass", "K ungated (aspirates legitimately)"],
];
for (const [file, target, want, label, reps] of CASES) {
  const r = await classify(file, target, reps || 1);
  const got = r.v;
  ok(`${label}: ${got}${r.shape ? ` (cent=${r.shape.cent} high=${r.shape.high} n=${r.frames})` : ` (n=${r.frames})`}`, got === want);
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
