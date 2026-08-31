// MIC1: a declined microphone is never a dead end, and the consent copy is true.
//
// Two failures the Aug 10 review and a follow-up audit found, both of the same
// shape — the app knowing something the family doesn't:
//
//   1. "Not now" on the primer bounced the child home in silence. Games still
//      locked, nothing said. The decline itself is right (burning the OS prompt
//      is near-unrecoverable), so what was missing was the sentence.
//   2. story.html and check.html swallowed a REAL denial. story.html then
//      looped "Not quite — try again!" forever, because a turn with no stream
//      can only ever score as a miss; check.html produced a report built on
//      zero heard words that still read like a result.
//
// And the primer's grown-up paragraph — the thing a parent reads before saying
// yes — still described an upload that no longer exists. That one matters most:
// it is the consent text for a promise the whole product rests on.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", woff2: "font/woff2" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8412, r));

const browser = await chromium.launch(launchOpts());
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// A "this must not appear" check has to read what a PARENT reads, never the
// source around it. Strip comments first — a note explaining a removal has
// tripped the check guarding that removal three times in this repo.
const noComments = (s) => s
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// DENIED mic: getUserMedia rejects exactly as a real refusal does
const denyMic = () => {
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
};
// GRANTED mic: an oscillator stream, so the primer path can be driven headless
const allowMic = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => {
    const c = new AC(), d = c.createMediaStreamDestination(), o = c.createOscillator();
    o.frequency.value = 180; o.connect(d); o.start(); return d.stream;
  };
};
const seed = () => {
  localStorage.setItem("sona.freeera.v1", "post");
  localStorage.setItem("sona.freeera2.v1", "done");
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true }));
};
async function page(mic) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript(mic);
  await pg.addInitScript(seed);
  return { ctx, pg, errs };
}

// ── 1. the consent paragraph is TRUE ──
// No audio leaves the device — there is no mechanism that could send it — so
// the paragraph a parent reads before granting the mic must not describe one.
{
  const charge = noComments(readFileSync(ROOT + "/charge.html", "utf8"));
  const primer = (charge.match(/id="micPrime"[\s\S]{0,1400}?<\/div>\s*<\/div>/) || [""])[0];
  ok("the mic primer exists with a grown-ups paragraph", /Grown-ups:/.test(primer), "the primer is the consent moment");
  // Scan for an AFFIRMATIVE sending claim only. A first pass matched the word
  // "upload" and flagged the sentence promising nothing is uploaded — a denial
  // is the opposite of the claim being hunted, so negated sentences come out
  // before the scan.
  const claims = primer
    .replace(/<[^>]+>/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !/\b(no|not|never|n['’]t|without)\b/i.test(s))
    .join(" ");
  ok("…and does not claim any recording is sent anywhere",
    !/\b(sends?|sent|uploads?|uploaded|transmits?)\b|for scoring|scoring provider/i.test(claims),
    "no audio leaves the device — copy describing an upload is a false promise, not a stale detail: " + claims.slice(0, 120));
  ok("…and says plainly that nothing is uploaded",
    /never uploaded|no recording is ever uploaded|not uploaded/i.test(primer),
    "the strongest claim Sona makes should be stated, not implied");
  ok("…and is honest about the one clip kept on the phone",
    /saved on this phone|on this device/i.test(primer),
    "a clip a parent can play back exists locally; consent copy should say so");
}

// ── 2. "Not now" says something before it leaves ──
{
  const { ctx, pg, errs } = await page(allowMic);
  await pg.goto("http://localhost:8412/charge.html?game=arcade-slice.html&free=1");
  await pg.waitForTimeout(1200);
  const st = await pg.evaluate(() => {
    const el = document.getElementById("micPrime");
    if (!el) return { err: "no primer" };
    el.classList.add("show");
    const sk = document.getElementById("micPrimeSkip");
    if (!sk || !sk.onclick) return { err: "no skip handler" };
    sk.onclick();
    const card = document.querySelector("#micPrime .ovlCard");
    return {
      text: card ? card.textContent.replace(/\s+/g, " ").trim() : "",
      stillHere: location.pathname.indexOf("charge") >= 0,
      micok: localStorage.getItem("sona.micok"),
    };
  });
  ok("'Not now' explains itself instead of bouncing home in silence",
    !st.err && st.stillHere && /okay/i.test(st.text) && st.text.length > 40, JSON.stringify(st).slice(0, 200));
  ok("…and tells the grown-up how to turn it on later",
    !st.err && /grown-ups?:/i.test(st.text) && /settings/i.test(st.text), (st.text || "").slice(0, 160));
  ok("…while keeping the decline SOFT — no permission is burned",
    st.micok !== "1",
    "sona.micok must stay unset so the primer asks again next visit");
  ok("no pageerrors on the primer path", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── 3. a denied mic gets the recovery screen, never an unwinnable loop ──
// story.html scores a turn from what it heard; with no stream it hears nothing,
// scores a miss, and calls itself again. Forever.
{
  const { ctx, pg, errs } = await page(denyMic);
  await pg.goto("http://localhost:8412/story.html");
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const b = document.getElementById("startBtn"); if (b) b.click(); });
  // readPage() speaks first; the recovery screen lands when the turn is reached
  let seen = false;
  for (let i = 0; i < 40 && !seen; i++) {
    seen = await pg.evaluate(() => !!document.getElementById("sonaMicDenied"));
    if (!seen) await pg.waitForTimeout(500);
  }
  ok("story: a denied mic raises the recovery screen", seen,
    "without it the child loops on 'Not quite — try again!' with nothing explaining why");
  if (seen) {
    const txt = await pg.evaluate(() => document.getElementById("sonaMicDenied").textContent.replace(/\s+/g, " "));
    ok("…naming the Settings path for a grown-up", /Settings/.test(txt) && /Microphone/i.test(txt), txt.slice(0, 140));
  } else { fails++; console.log("FAIL …naming the Settings path for a grown-up  → screen never appeared"); }
  ok("no pageerrors on the denied-story path", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── 4. the Speech Check refuses to "check" without hearing anything ──
{
  const { ctx, pg, errs } = await page(denyMic);
  await pg.goto("http://localhost:8412/check.html");
  await pg.waitForTimeout(900);
  const st = await pg.evaluate(async () => {
    const n = document.getElementById("cName"), a = document.getElementById("cAge");
    if (n) n.value = "Milo";
    if (a) a.value = "7";
    document.getElementById("startBtn").click();
    await new Promise((r) => setTimeout(r, 1200));
    return {
      denied: !!document.getElementById("sonaMicDenied"),
      onTest: !!(document.getElementById("sTest") || {}).classList?.contains("on"),
      btn: (document.getElementById("startBtn") || {}).disabled,
    };
  });
  ok("check: a denied mic stops the check instead of scoring silence", st.denied && !st.onTest, JSON.stringify(st));
  ok("…and leaves the start button usable for a retry", st.btn === false, JSON.stringify(st));
  ok("no pageerrors on the denied-check path", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── 5. the recovery screen is one implementation, shared ──
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("micDenied lives in sona.js and is exported", /function micDenied/.test(sona) && /\bmicDenied,/.test(sona),
    "every recording page must reach the same screen — a second copy drifts");
  for (const f of ["charge.html", "story.html", "check.html", "coach-call.html"]) {
    const src = noComments(readFileSync(ROOT + "/" + f, "utf8"));
    ok(f + " routes a denial to that screen", /micDenied\(/.test(src),
      "a page that records must never leave a denial unexplained");
  }
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
