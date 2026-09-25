// Re-voice Rachel's July recordings into Echo's voice through the app's own
// speech-to-speech route (app/api/voice-change: ElevenLabs Voice Changer).
// Her pacing, warmth and — the point — the performed sound survive; only the
// timbre becomes Echo's. Run against a PREVIEW deployment, where the route is
// open (unguessable URL + rate limit); on production it needs FOUNDER_KEY.
//   node tools/revoice.mjs            # public/coach/say/*.mp3 → public/coach/say-echo/
//   REVOICE_BASE=https://…vercel.app FOUNDER_KEY=… node tools/revoice.mjs
// Bare sounds (-demo) get gentler settings than sentences: a high
// similarity_boost re-synthesizes through the target voice's vocal-tract
// prior, and an isolated /r/ drifts toward /w/ (measured in July: F3 rose
// 1898 → 2470 Hz). See app/api/voice-change/route.ts.
// The route hands back whatever level it likes (2–5 dB hotter than a TTS
// line, peaks at the ceiling — 25 Sep 2026), so the last step runs
// tools/levelclips.mjs on the output: every clip lands at the level /api/tts
// gives its lines. That step needs `npm i --no-save lamejs`.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
const BASE = process.env.REVOICE_BASE || "https://sona-git-claude-dreamy-gauss-ywph11-traviswardrop13s-projects.vercel.app";
const SRC = new URL("../public/coach/say/", import.meta.url).pathname;
const OUT = new URL("../public/coach/say-echo/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const SENTENCE = { stability: "0.6", similarity: "0.75", style: "0", speaker_boost: "1" };
const SOUND = { stability: "0.6", similarity: "0.5", style: "0", speaker_boost: "0" };
const only = process.argv.slice(2);
const files = readdirSync(SRC).filter((f) => f.endsWith(".mp3") && (!only.length || only.includes(f))).sort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, failed = 0;
for (const f of files) {
  const out = OUT + f;
  if (existsSync(out) && statSync(out).size > 1000 && !process.env.REVOICE_FORCE) { console.log("skip (exists)", f); continue; }
  const settings = /-demo\.mp3$/.test(f) ? SOUND : SENTENCE;
  let done = false;
  for (let attempt = 1; attempt <= 4 && !done; attempt++) {
    const form = new FormData();
    form.append("audio", new Blob([readFileSync(SRC + f)], { type: "audio/mpeg" }), f);
    for (const [k, v] of Object.entries(settings)) form.append(k, v);
    const headers = process.env.FOUNDER_KEY ? { "x-founder-key": process.env.FOUNDER_KEY } : {};
    const t0 = Date.now();
    try {
      const r = await fetch(BASE + "/api/voice-change", { method: "POST", body: form, headers });
      if (r.ok && (r.headers.get("content-type") || "").startsWith("audio/")) {
        const buf = Buffer.from(await r.arrayBuffer());
        writeFileSync(out, buf); ok++; done = true;
        console.log("ok  ", f, buf.length, "bytes", ((Date.now() - t0) / 1000).toFixed(1) + "s", JSON.stringify(settings));
      } else {
        const text = (await r.text().catch(() => "")).slice(0, 200);
        console.log("fail", f, r.status, text, "attempt", attempt);
        if (r.status === 429) await sleep(65000); else await sleep(5000 * attempt);
      }
    } catch (e) { console.log("error", f, String(e).slice(0, 120), "attempt", attempt); await sleep(5000 * attempt); }
  }
  if (!done) failed++;
  await sleep(1500);
}
if (ok) execFileSync(process.execPath, [new URL("./levelclips.mjs", import.meta.url).pathname, OUT], { stdio: "inherit" });
console.log(`DONE ok=${ok} failed=${failed} of ${files.length}`);
process.exit(failed ? 1 : 0);
