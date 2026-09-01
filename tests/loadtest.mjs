// LOAD1: the say-it-5x gate is each game's own loading scene.
//
// The design handoff's section 3 asks for the ticket filling to happen ON the
// game's sky, with the scene building one piece per successful say and the
// unearned pieces showing as white dashed ghosts. Most of that already shipped
// — this suite pins the parts that are easy to lose in a refactor: the sky
// tokens themselves, the ticket pill staying in step with the scene, the ghost
// treatment, and the copy rule that the word "charge" never reaches a child.
import { createServer } from "http";
import { readFileSync, existsSync, readdirSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2", png: "image/png" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8198, r));

const browser = await chromium.launch(launchOpts());
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// The design's sky tokens, verbatim. A loading scene that does not open on its
// own game's sky is the thing section 3 exists to prevent.
const SKIES = [
  ["arcade-slice.html", "FRUIT SLICE", ["143, 208, 245", "255, 138, 90"]],   // sunset
  ["arcade-run.html", "SOUND SPRINT", ["174, 230, 255"]],                     // morning
  ["arcade-stack.html", "BLOCK STACKER", ["43, 46, 107", "225, 122, 164"]],   // dusk
  ["arcade-tiles.html", "PIANO TILES", ["35, 26, 77", "84, 64, 158"]],        // night
  ["arcade-glide.html", "FLAPPY GLIDE", ["63, 116, 171", "255, 231, 196"]],   // golden hour
];

async function scene(game, fill) {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: 390, height: 844 });
  // headless has no microphone, and a rejected getUserMedia correctly raises
  // the denied-recovery screen over the scene we are here to measure
  await pg.addInitScript(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = async () => {
      const c = new AC(), d = c.createMediaStreamDestination(), o = c.createOscillator();
      o.frequency.value = 180; o.connect(d); o.start(); return d.stream;
    };
  });
  await pg.goto("http://localhost:8198/today.html");
  await pg.evaluate(() => {
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done");
    localStorage.setItem("sona.micok", "1");
    Sona.saveProfile({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true });
    Sona.markStoryRead();
  });
  await pg.goto("http://localhost:8198/charge.html?game=" + game + "&free=1");
  await pg.waitForTimeout(1000);
  if (typeof fill === "number") {
    await pg.evaluate((n) => { try { reveal(n); } catch (e) { window.__err = String(e); } }, fill);
    await pg.waitForTimeout(350);
  }
  return { ctx, pg };
}

// ── 1. every game opens on its own sky, with its own title ──
for (const [game, title, rgbs] of SKIES) {
  const { ctx, pg } = await scene(game);
  const st = await pg.evaluate(() => ({
    sky: getComputedStyle(document.body).backgroundImage,
    title: (document.getElementById("gameTitle") || {}).textContent || "",
    cream: getComputedStyle(document.body).backgroundColor,
  }));
  ok(`${title} opens on its own sky`, rgbs.every((c) => st.sky.includes(c)), st.sky.slice(0, 90));
  ok(`…titled ${title}`, st.title.trim() === title, st.title);
  await ctx.close();
}

// ── 2. the ticket pill stays in step with the scene ──
// Two readings of one number is how they drift. The header pill and the scene
// below it are both driven by reveal(), so a child can answer "how many more?"
// without counting fruit.
{
  const { ctx, pg } = await scene("arcade-slice.html", 3);
  const st = await pg.evaluate(() => ({
    total: document.querySelectorAll("#tktSegs i").length,
    on: document.querySelectorAll("#tktSegs i.on").length,
    filled: document.querySelectorAll("#stand .well .fr:not(.ghost)").length,
  }));
  ok("the ticket pill has five segments", st.total === 5, String(st.total));
  ok("…and reads the same number as the scene", st.on === 3 && st.filled === 3, JSON.stringify(st));

  const back = await pg.evaluate(() => { reveal(0); return document.querySelectorAll("#tktSegs i.on").length; });
  ok("…and empties again when the scene does", back === 0, String(back));
  await ctx.close();
}

// ── 3. unearned pieces are white dashed ghosts, not empty slots ──
// A child should see the SHAPE of the thing they are about to earn. This is
// the design's signature reveal and the easiest detail to lose.
{
  const { ctx, pg } = await scene("arcade-slice.html", 2);
  const st = await pg.evaluate(() => {
    const g = document.querySelector("#stand .well .fr.ghost");
    const inner = g && g.querySelector("svg *");
    const cs = inner ? getComputedStyle(inner) : null;
    return {
      ghosts: document.querySelectorAll("#stand .well .fr.ghost").length,
      solid: document.querySelectorAll("#stand .well .fr:not(.ghost)").length,
      dash: cs ? cs.strokeDasharray : "",
      stroke: cs ? cs.stroke : "",
    };
  });
  ok("unearned fruit render as ghosts", st.ghosts === 3 && st.solid === 2, JSON.stringify(st));
  ok("…dashed, in white, per the spec", /5/.test(st.dash) && /255, 255, 255/.test(st.stroke), JSON.stringify(st));
  await ctx.close();
}

// ── 4. the word a child never sees ──
// "charge" -> "fill" and "point(s)" -> "star(s)" is a copy rule from the
// handoff, and copy rules rot silently. Identifiers are exempt; only what a
// child can read counts.
{
  const KID = new Set(["today.html", "charge.html", "library.html", "story.html", "chapter.html",
    "stickers.html", "customize.html", "call.html",
    ...["slice", "run", "stack", "tiles", "glide", "feed"].map((g) => `arcade-${g}.html`)]);
  // Scan MARKUP text only. A first pass matched > ... < across <script> blocks
  // and flagged every JS comparison operator in the app, so scripts and
  // comments come out first; copy set from JS is caught by the second pass on
  // string literals assigned to textContent/innerHTML.
  const EXEMPT = /charge\.html|chargeState|chargeAdd|chargeReset|chargeType|pointer|checkpoint|\bpoints? (?:to|at)\b/i;
  const bad = [];
  for (const f of readdirSync(ROOT).filter((f) => KID.has(f))) {
    const src = readFileSync(ROOT + "/" + f, "utf8");
    const markup = src
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
    for (const m of markup.matchAll(/>([^<>]*?(charge|point)[^<>]*?)</gi)) {
      const t = m[1].trim();
      if (t && !EXEMPT.test(t)) bad.push(f + " markup: " + t.slice(0, 44));
    }
    for (const m of src.matchAll(/(?:textContent|innerHTML)\s*=\s*"([^"]*(?:charge|point)[^"]*)"/gi)) {
      if (!EXEMPT.test(m[1])) bad.push(f + " js: " + m[1].slice(0, 44));
    }
  }
  ok("no child-facing copy says charge or points", bad.length === 0, bad.join(" | "));
}

// ── 5. one action colour ──
// The Aug 10 review: "the home CTA is brand orange; the story's Next and the
// mic primer's button are Duolingo green" — palette discipline is the top
// premium signal, and a borrowed accent is a cheap tell. Orange is ours.
// Greens that are NOT actions stay: --good, the call-answer button (the
// universal answer affordance), status dots, the founding-timeline dot.
{
  const GREEN = /#58cc02|#46a302|#6edd18|#6fd60e|#5fd216|#3c8c02/i;
  const KID = ["today.html", "charge.html", "story.html", "chapter.html", "check.html", "join.html",
    "library.html", "coach-call.html", ...["slice", "run", "stack", "tiles", "glide", "feed"].map((g) => `arcade-${g}.html`)];
  const bad = [];
  for (const f of KID) {
    const src = readFileSync(ROOT + "/" + f, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    // every rule that paints a BUTTON: the selector must mention a button or a
    // btn-ish id/class, and the declaration must set a background
    for (const m of src.matchAll(/([^{}]*(?:\.btn|button|Btn|#quietGo|\.jbtn)[^{}]*)\{([^}]*background[^}]*)\}/gi)) {
      const sel = m[1].trim(), decl = m[2];
      if (/--green|var\(--good\)|#answer|#callDot|\.ghost/.test(sel)) continue;   // status/answer greens
      if (GREEN.test(decl)) bad.push(f + " " + sel.split("\n").pop().trim().slice(0, 40));
    }
    // inline styles on buttons
    for (const m of src.matchAll(/<button[^>]*style="([^"]*)"/gi)) {
      if (GREEN.test(m[1]) && /background/.test(m[1])) bad.push(f + " inline <button>");
    }
  }
  ok("no kid-facing action button is Duolingo green", bad.length === 0, bad.join(" | "));

  // and the buttons a child actually taps are the brand orange, in the browser
  const ORANGE = /255, ?138, ?61|255, ?160, ?90/;
  const { ctx, pg } = await scene("arcade-slice.html");
  const primer = await pg.evaluate(() => {
    const b = document.getElementById("micPrimeBtn");
    return b ? getComputedStyle(b).backgroundImage : "";
  });
  ok("the mic primer's button is brand orange", ORANGE.test(primer), primer.slice(0, 70));
  await ctx.close();

  const c2 = await browser.newContext();
  const p2 = await c2.newPage();
  await p2.goto("http://localhost:8198/today.html");
  await p2.evaluate(() => {
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done");
    Sona.saveProfile({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true });
  });
  await p2.goto("http://localhost:8198/chapter.html");
  await p2.waitForTimeout(600);
  const next = await p2.evaluate(() => {
    const n = document.getElementById("next"), d = document.getElementById("doneBtn");
    return { next: n ? getComputedStyle(n).backgroundImage : "", done: d ? getComputedStyle(d).backgroundImage : "" };
  });
  ok("the chapter's Next is brand orange", ORANGE.test(next.next), next.next.slice(0, 70));
  ok("…and so is the chapter's finish button", ORANGE.test(next.done), next.done.slice(0, 70));
  await c2.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
