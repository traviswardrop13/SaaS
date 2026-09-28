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
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done");
    localStorage.setItem("sona.micok", "1");
    // earlyAdopter: a family holding every game. This measures each game's
    // SCENE, and since 24 Sep 2026 a family on the free version is sent back
    // from a Premium game before its scene paints — that refusal is pinned in
    // freetest/day1, not here, and this must hold whichever way pricing points.
    Sona.saveProfile({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true });
    Sona.markStoryRead();
  });
  await pg.goto("http://localhost:8198/charge.html?game=" + game + "&free=1");
  // 24 Sep 2026: the page now measures the room and lets the phone settle
  // before Echo's prompt, so the first listening window (which paints the
  // stand at zero) opens later than a fixed second. Wait for it, so a
  // reveal() below is not repainted to zero underneath the check.
  await pg.waitForFunction(() => window.engineOn === true, {}, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(300);
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
  ok("the redundant ticket pill is removed", st.total === 0, String(st.total));
  ok("the fruit stand alone shows three heard tries", st.on === 0 && st.filled === 3, JSON.stringify(st));

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
  ok("…one continuous warm-white outline", st.dash === "none" && /255, 245, 223/.test(st.stroke), JSON.stringify(st));
  await ctx.close();
}

// ── 4. the word a child never sees ──
// "charge" -> "fill" and "point(s)" -> "star(s)" is a copy rule from the
// handoff, and copy rules rot silently. Identifiers are exempt; only what a
// child can read counts.
{
  const KID = new Set(["today.html", "activities.html", "charge.html", "library.html", "story.html", "chapter.html",
    "stickers.html", "customize.html",
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

// ── 5. one action colour: teal ──
// The family's design brief (28 Sep 2026): "Teal main buttons and mic ...
// Secondary buttons are cream. No bright green buttons." It reverses the Aug
// 10 review ("the home CTA is brand orange ... Orange is ours"): orange now
// means ONE thing, the practice sound's letters (.snd, from Sona.soundMark),
// so a child learns one meaning per colour, and every button is teal. The
// teal is defined once, in /action.css; a page takes it from there, which is
// what lets the provisional values change in one file when STYLE.md arrives.
// Duolingo green stays banned, and now on the Say & Play sheet and Hoops too:
// the family named "the bright green GO button", and that is where it lived,
// out of this suite's sight. A green press shadow (an orange button flashing
// green on tap) counts as a green button. Greens that are NOT actions stay:
// --good, the call-answer button (the universal answer affordance), status
// dots, the founding-timeline dot, a Say & Play turn's "word heard" glow.
{
  const GREEN = /#58cc02|#46a302|#6edd18|#6fd60e|#5fd216|#3c8c02|#7ee23a|var\(--green\b/i;
  const ORANGE = /#ffa05a|#ff8a3d|#ef6f23|#ff9600|#e08600|var\(--orange|255,\s*138,\s*61|255,\s*160,\s*90/i;
  const TEAL = /72, ?204, ?215|31, ?152, ?166/;     // --act-hi, --act, as the browser reports them
  const ARCADE = ["slice", "run", "stack", "tiles", "glide"].map((g) => `arcade-${g}.html`);
  const KID = ["today.html", "activities.html", "charge.html", "story.html", "chapter.html", "check.html", "join.html",
    "library.html", "coach-call.html", ...ARCADE, "arcade-feed.html", "arcade-hoops.html", "sayplay.css", "simple-play.css"];
  // the pages whose buttons have moved to teal; check.html and join.html are
  // grown-up pages still on the old orange, coach-call.html is orphaned
  const TEAL_KID = ["today.html", "charge.html", "story.html", "chapter.html", "library.html", ...ARCADE, "arcade-feed.html",
    "arcade-hoops.html", "sayplay.css", "simple-play.css", "sona.css"];
  // CSS only: a page's <style> blocks, or the whole sheet, comments stripped
  const css = (f) => {
    const src = readFileSync(ROOT + "/" + f, "utf8");
    const out = /\.css$/.test(f) ? src : [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    return out.replace(/\/\*[\s\S]*?\*\//g, " ");
  };
  // every rule that paints a BUTTON or a MIC: the selector names one, and
  // what it paints is its background and its shadow (the press state too)
  const BTN = /([^{}]*(?:\.btn|button|Btn|#quietGo|\.jbtn|\.primary|\.bknext|\.mic\b|\.act-pill|\.act-mic)[^{}]*)\{([^}]*)\}/gi;
  const painted = (f) => [...css(f).matchAll(BTN)].map((m) => ({ sel: m[1].trim().split("\n").pop().trim(), paint: (m[2].match(/(?:background|box-shadow)[^;]*/gi) || []).join(";") })).filter((r) => r.paint);
  const inline = (f) => [...readFileSync(ROOT + "/" + f, "utf8").matchAll(/<button[^>]*style="([^"]*)"/gi)].map((m) => m[1]);

  const green = [];
  for (const f of KID) {
    for (const r of painted(f)) {
      if (/--green|var\(--good\)|#answer|#callDot|\.ghost/.test(r.sel)) continue;   // status/answer greens
      if (GREEN.test(r.paint)) green.push(f + " " + r.sel.slice(0, 40));
    }
    for (const st of inline(f)) if (GREEN.test(st) && /background/.test(st)) green.push(f + " inline <button>");
  }
  ok("no kid-facing action button is Duolingo green (nor flashes green when pressed)", green.length === 0, green.join(" | "));

  const orange = [];
  for (const f of TEAL_KID) {
    for (const r of painted(f)) if (ORANGE.test(r.paint)) orange.push(f + " " + r.sel.slice(0, 40));
    for (const st of inline(f)) if (ORANGE.test(st)) orange.push(f + " inline <button>");
  }
  ok("no kid button or mic is orange: orange is only the practice sound's letters", orange.length === 0, orange.join(" | "));

  const act = readFileSync(ROOT + "/action.css", "utf8").replace(/\s+/g, "");
  ok("action.css holds the teal, once: --act-hi, --act, --act-d", /--act-hi:#48ccd7;/.test(act) && /--act:#1f98a6;/.test(act) && /--act-d:#16767f;/.test(act));
  // the shared sheets import the tokens (first rule, or the browser drops the
  // @import) rather than keep a second copy; without them every white-on-teal
  // button on those pages would be white on nothing
  const noImport = ["sona.css", "sayplay.css", "simple-play.css"].filter((f) => {
    const src = readFileSync(ROOT + "/" + f, "utf8");
    return !/^(?:\s*\/\*[\s\S]*?\*\/)*\s*@import url\("\/action\.css"\);/.test(src) || /--act(?:-hi|-d)?\s*:/.test(src);
  });
  ok("sona.css, sayplay.css and simple-play.css take the tokens from action.css instead of a second copy", noImport.length === 0, noImport.join(" | "));
  const linksAct = (f) => [...readFileSync(ROOT + "/" + f, "utf8").replace(/<!--[\s\S]*?-->/g, "").matchAll(/<link\b[^>]*>/gi)].some((m) => /href="\/action\.css"/.test(m[0]) && /rel="stylesheet"/.test(m[0]));
  const noLink = [...ARCADE, "arcade-feed.html", "arcade-hoops.html", "charge.html", "chapter.html", "story.html"].filter((f) => !linksAct(f));
  ok("every kid page that doesn't load sona.css links /action.css", noLink.length === 0, noLink.join(" | "));

  // In the browser, with scripts off (so no page sends itself home), the
  // buttons a child taps come out teal, the second choice cream.
  const CREAM = /255, 250, 241|255, 246, 233/;
  const look = async (f, sels) => {
    const c = await browser.newContext({ javaScriptEnabled: false });
    const p = await c.newPage();
    await p.goto("http://localhost:8198/" + f);
    const r = await p.evaluate((sels) => sels.map((q) => {
      const el = document.querySelector(q);
      if (!el) return { q, missing: true };
      const cs = getComputedStyle(el);
      return { q, bg: cs.backgroundImage + " " + cs.backgroundColor };
    }), sels);
    await c.close();
    return r;
  };
  const PRIMARY = [
    ["charge.html", ["#micPrimeBtn"]],
    ...ARCADE.map((f) => [f, ["#goCharge", "#endCharge"]]),
    ["arcade-feed.html", ["#again"]],
    ["arcade-hoops.html", ["#startBtn", "#primerYes", "#resume", "#again", "#micBtn"]],
    ["arcade-balloon.html", ["#startBtn", "#micBtn"]],
    ["arcade-bubbles.html", [".primary"]],
    ["chapter.html", ["#next", "#doneBtn"]],
    ["story.html", ["#startBtn", "#again", ".mic"]],
    ["library.html", ["#bkNext"]],
    ["today.html", ["#shareWeek", "#libraryUnlock"]],
    ["settings.html", ["button.btn:not(.ghost):not(.blue)"]],
  ];
  const notTeal = [];
  for (const [f, sels] of PRIMARY) for (const r of await look(f, sels)) if (r.missing || !TEAL.test(r.bg) || ORANGE.test(r.bg)) notTeal.push(f + " " + r.q + (r.missing ? " (missing)" : ": " + r.bg.slice(0, 60)));
  ok("the buttons and mics a child taps are the action teal, in the browser", notTeal.length === 0, notTeal.join(" | "));
  const SECOND = [["arcade-hoops.html", ["#goHome", "#primerNo"]], ["arcade-feed.html", ["#goHome"]], ["settings.html", ["button.btn.ghost"]]];
  const notCream = [];
  for (const [f, sels] of SECOND) for (const r of await look(f, sels)) if (r.missing || !CREAM.test(r.bg)) notCream.push(f + " " + r.q + (r.missing ? " (missing)" : ": " + r.bg.slice(0, 60)));
  ok("…and the second choice is the cream pill", notCream.length === 0, notCream.join(" | "));
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
