// LOAD1: the say-it-5x gate is each game's own loading scene.
//
// The design handoff's section 3 asks for the ticket filling to happen ON the
// game's sky, with the scene building one piece per successful say and the
// unearned pieces showing as white dashed ghosts. Most of that already shipped
// — this suite pins the parts that are easy to lose in a refactor: the sky
// illustrations themselves, the ticket pill staying in step with the scene, the ghost
// treatment, and the copy rule that the word "charge" never reaches a child.
import { createServer } from "http";
import { readFileSync, existsSync, readdirSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2", png: "image/png", webp: "image/webp" };
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

// Each game has its own illustrated world. A missing asset or a scene assigned
// to the wrong game must fail even if a fallback background still looks fine.
const SKIES = [
  ["arcade-slice.html", "FRUIT SLICE", "orchard-game.webp"],
  ["arcade-run.html", "SOUND SPRINT", "sprint-lane.webp"],
  ["arcade-stack.html", "BLOCK STACKER", "moon-village.webp"],
  ["arcade-tiles.html", "PIANO TILES", "piano-stage.webp"],
  ["arcade-glide.html", "FLAPPY GLIDE", "glide-countryside.webp"],
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
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done");localStorage.setItem("sona.freeera5.v1","done");
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
for (const [game, title, art] of SKIES) {
  const expected = "/assets/crafted/" + art;
  ok(`${title} has its illustrated scene asset`, existsSync(ROOT + expected), expected);
  const { ctx, pg } = await scene(game);
  const st = await pg.evaluate(async () => {
    const sky = getComputedStyle(document.getElementById("app")).backgroundImage;
    const sources = [...sky.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]);
    const decoded = await Promise.all(sources.map(async source => {
      const image = new Image(); image.src = source;
      try { await image.decode(); } catch {}
      return {path:new URL(source, location.href).pathname, loaded:image.complete && image.naturalWidth > 0 && image.naturalHeight > 0};
    }));
    return {sky, decoded, title:(document.getElementById("gameTitle") || {}).textContent || ""};
  });
  ok(`${title} opens on its own illustrated scene`, st.decoded.length === 1 && st.decoded[0].path === expected, st.sky);
  ok(`…and its scene image decodes`, st.decoded.length === 1 && st.decoded[0].loaded, JSON.stringify(st.decoded));
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
// so a child learns one meaning per colour, and every button is teal.
// Duolingo green stays banned, and on the Say & Play sheet and Hoops too:
// the family named "the bright green GO button", and that is where it lived,
// out of this suite's sight. A green press shadow (an orange button flashing
// green on tap) counts as a green button. Greens that are NOT actions stay:
// --good, the call-answer button (the universal answer affordance), status
// dots, the founding-timeline dot, a Say & Play turn's "word heard" glow.
//
// Two layers carry the teal since the crafted-world merge (29 Sep 2026).
// Codex's crafted world paints its own teal from public/crafted-*.css: under
// body[data-crafted] on the five round games, the practice page, Feed Echo
// and Hoops, and by class on Home and the grown-up screens. Everything else
// takes the tokens from /action.css. Both are accepted, and the same bans
// hold over both. A crafted page still carries its older <style>, some of it
// orange with a green press, and the crafted sheet paints over it; the source
// alone can't say which wins, so on those pages the browser is asked what a
// child sees, pressed as well as at rest.
{
  // one list of banned values, read two ways: as the source spells them and
  // as the browser reports them
  const HEX = { green: ["58cc02", "46a302", "6edd18", "6fd60e", "5fd216", "3c8c02", "7ee23a"], orange: ["ffa05a", "ff8a3d", "ef6f23", "ff9600", "e08600"] };
  const rgbOf = (h) => "\\(" + [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",\\s*") + "\\b";
  const GREEN = new RegExp(HEX.green.map((h) => "#" + h).join("|") + "|var\\(--green\\b", "i");
  const ORANGE = new RegExp(HEX.orange.map((h) => "#" + h).join("|") + "|var\\(--orange|255,\\s*138,\\s*61|255,\\s*160,\\s*90", "i");
  const GREEN_RGB = new RegExp(HEX.green.map(rgbOf).join("|"));
  const ORANGE_RGB = new RegExp(HEX.orange.map(rgbOf).join("|"));
  // Teal by hue, not by value: action.css's --act-hi/--act and the crafted
  // sheets' teals are different numbers for the same colour, and both will
  // change when the designer's STYLE.md arrives. Cream: a light warm neutral.
  const rgbs = (s) => [...String(s).matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map((m) => m.slice(1, 4).map(Number));
  const hue = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn; if (!c) return -1;
    const h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; return (h * 60 + 360) % 360; };
  const isTeal = (s) => rgbs(s).some((c) => Math.max(...c) - Math.min(...c) > 80 && hue(c) >= 172 && hue(c) <= 195);
  const isCream = (s) => { const c = rgbs(s).filter((x) => x.length); return c.some(([r, g, b]) => r >= 240 && g >= 225 && b >= 200 && r >= g && g >= b) && !isTeal(s); };

  const ARCADE = ["slice", "run", "stack", "tiles", "glide"].map((g) => `arcade-${g}.html`);
  const CRAFTED_CSS = readdirSync(ROOT).filter((f) => /^crafted-.*\.css$/.test(f)).concat(["onboarding-crafted.css", "arcade-speech-help.css"]);
  const KID = ["today.html", "activities.html", "charge.html", "story.html", "chapter.html", "check.html", "join.html",
    "library.html", "coach-call.html", ...ARCADE, "arcade-feed.html", "arcade-hoops.html", "arcade-soccer.html", "arcade-dino.html", "arcade-bubbles.html", "sayplay.css", "simple-play.css", ...CRAFTED_CSS];
  // the pages whose buttons have moved to teal; check.html and join.html are
  // grown-up pages (join's buttons are the crafted family teal on screen,
  // checked in the browser below), coach-call.html is orphaned
  const TEAL_KID = ["today.html", "charge.html", "story.html", "chapter.html", "library.html", ...ARCADE, "arcade-feed.html",
    "arcade-hoops.html", "arcade-soccer.html", "arcade-dino.html", "arcade-bubbles.html", "sayplay.css", "simple-play.css", "sona.css", ...CRAFTED_CSS];
  const srcOf = (f) => readFileSync(ROOT + "/" + f, "utf8");
  const craftedPage = (f) => /\.html$/.test(f) && /<body\b[^>]*\bdata-crafted=/.test(srcOf(f));
  // CSS only: a page's <style> blocks, or the whole sheet, comments stripped
  const css = (f) => {
    const src = srcOf(f);
    const out = /\.css$/.test(f) ? src : [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    return out.replace(/\/\*[\s\S]*?\*\//g, " ");
  };
  // every rule that paints a BUTTON or a MIC: the selector names one, and
  // what it paints is its background and its shadow (the press state too)
  const BTN = /([^{}]*(?:\.btn|button|Btn|#quietGo|\.jbtn|\.primary|\.bknext|\.mic\b|\.act-pill|\.act-mic)[^{}]*)\{([^}]*)\}/gi;
  const painted = (f) => [...css(f).matchAll(BTN)].map((m) => ({ all: m[1].trim(), sel: m[1].trim().split("\n").pop().trim(), paint: (m[2].match(/(?:background|box-shadow)[^;]*/gi) || []).join(";") })).filter((r) => r.paint);
  const inline = (f) => [...srcOf(f).matchAll(/<button[^>]*style="([^"]*)"/gi)].map((m) => m[1]);

  // A banned colour in a crafted page's own <style> is held to what the
  // browser paints for that selector, at rest and pressed (Chrome's devtools
  // protocol forces :active and :hover). A selector that needs a state the
  // page adds later (#micBtn.go) gets that class added first. Scripts are off,
  // so no page sends itself home before it is looked at.
  const onScreen = async (f, sels) => {
    const c = await browser.newContext({ javaScriptEnabled: false });
    const p = await c.newPage();
    await p.goto("http://localhost:8198/" + f);
    const cdp = await c.newCDPSession(p);
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    const find = async (sel) => (await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: sel })).nodeIds;
    const paint = async (id) => { const { computedStyle } = await cdp.send("CSS.getComputedStyleForNode", { nodeId: id });
      const g = (n) => (computedStyle.find((x) => x.name === n) || {}).value || ""; return [g("background-image"), g("background-color"), g("box-shadow")].join(" "); };
    const out = [];
    for (const sel of sels) {
      let ids = await find(sel);
      if (!ids.length) {
        const last = sel.split(/[\s>+~]+/).pop(), hook = last.match(/^[a-z]*#[\w-]+|^[a-z]*\.[\w-]+/i), want = last.match(/\.[\w-]+/g) || [];
        if (hook) for (const id of await find(hook[0])) {
          const { attributes } = await cdp.send("DOM.getAttributes", { nodeId: id }); const i = attributes.indexOf("class");
          await cdp.send("DOM.setAttributeValue", { nodeId: id, name: "class", value: ((i < 0 ? "" : attributes[i + 1]) + " " + want.map((w) => w.slice(1)).join(" ")).trim() });
        }
        ids = await find(sel);
      }
      if (!ids.length) { out.push({ sel, missing: true }); continue; }
      for (const id of ids) {
        const rest = await paint(id);
        await cdp.send("CSS.forcePseudoState", { nodeId: id, forcedPseudoClasses: ["active", "hover"] });
        out.push({ sel, rest, pressed: await paint(id) });
        await cdp.send("CSS.forcePseudoState", { nodeId: id, forcedPseudoClasses: [] });
      }
    }
    await c.close();
    return out;
  };
  // the selectors a flagged rule names, with the states the browser is made to show
  const selsOf = (r) => r.all.split(",").map((s) => s.trim().replace(/:(?:active|hover|focus-visible|focus)\b/g, "")).filter(Boolean);
  const judged = async (f, rules, bad) => {
    const found = [];
    for (const r of await onScreen(f, [...new Set(rules.flatMap(selsOf)), "button"])) {
      if (r.missing) { if (r.sel !== "button") found.push(f + " " + r.sel + " (can't be shown, so can't be cleared)"); continue; }
      if (bad.test(r.rest)) found.push(f + " " + r.sel + ": rgb" + r.rest.match(bad)[0] + "…)");
      else if (bad.test(r.pressed)) found.push(f + " " + r.sel + " when pressed: rgb" + r.pressed.match(bad)[0] + "…)");
    }
    return found;
  };

  const green = [], orange = [], greenOnCrafted = {}, orangeOnCrafted = {};
  for (const f of KID) {
    for (const r of painted(f)) {
      if (/--green|var\(--good\)|#answer|#callDot|\.ghost/.test(r.sel)) continue;   // status/answer greens
      if (GREEN.test(r.paint)) { if (craftedPage(f)) (greenOnCrafted[f] = greenOnCrafted[f] || []).push(r); else green.push(f + " " + r.sel.slice(0, 40)); }
    }
    for (const st of inline(f)) if (GREEN.test(st) && /background/.test(st)) green.push(f + " inline <button>");
  }
  for (const f of TEAL_KID) {
    for (const r of painted(f)) if (ORANGE.test(r.paint)) { if (craftedPage(f)) (orangeOnCrafted[f] = orangeOnCrafted[f] || []).push(r); else orange.push(f + " " + r.sel.slice(0, 40)); }
    for (const st of inline(f)) if (ORANGE.test(st)) orange.push(f + " inline <button>");
  }
  for (const [f, rules] of Object.entries(greenOnCrafted)) green.push(...await judged(f, rules, GREEN_RGB));
  for (const [f, rules] of Object.entries(orangeOnCrafted)) orange.push(...await judged(f, rules, ORANGE_RGB));
  ok("no kid-facing action button is Duolingo green (nor flashes green when pressed)", green.length === 0, green.join(" | "));
  ok("no kid button or mic is orange: orange is only the practice sound's letters", orange.length === 0, orange.join(" | "));

  // the crafted primer, in the browser (the crafted world's own pin)
  const { ctx, pg } = await scene("arcade-slice.html");
  const primer = await pg.evaluate(() => {
    const b = document.getElementById("micPrimeBtn");
    return b ? getComputedStyle(b).backgroundImage : "";
  });
  ok("the mic primer's button uses the crafted teal action", primer.includes("rgb(25, 182, 187)") && primer.includes("rgb(7, 142, 157)"), primer);
  await ctx.close();

  const act = srcOf("action.css").replace(/\s+/g, "");
  ok("action.css holds the teal, once: --act-hi, --act, --act-d", /--act-hi:#48ccd7;/.test(act) && /--act:#1f98a6;/.test(act) && /--act-d:#16767f;/.test(act));
  // the shared sheets import the tokens (first rule, or the browser drops the
  // @import) rather than keep a second copy; without them every white-on-teal
  // button on those pages would be white on nothing
  const noImport = ["sona.css", "sayplay.css", "simple-play.css"].filter((f) => {
    const src = srcOf(f);
    return !/^(?:\s*\/\*[\s\S]*?\*\/)*\s*@import url\("\/action\.css"\);/.test(src) || /--act(?:-hi|-d)?\s*:/.test(src);
  });
  ok("sona.css, sayplay.css and simple-play.css take the tokens from action.css instead of a second copy", noImport.length === 0, noImport.join(" | "));
  // every kid page gets its button colours from a shared sheet: /action.css
  // (linked, or through sona.css), or the crafted layer it opts into
  const links = (f, href) => [...srcOf(f).replace(/<!--[\s\S]*?-->/g, "").matchAll(/<link\b[^>]*>/gi)].some((m) => m[0].includes('href="' + href + '"') && /rel="stylesheet"/.test(m[0]));
  const noSheet = [...ARCADE, "arcade-feed.html", "arcade-hoops.html", "arcade-soccer.html", "arcade-dino.html", "arcade-bubbles.html", "charge.html", "chapter.html", "story.html", "library.html", "today.html"]
    .filter((f) => !links(f, "/action.css") && !links(f, "/sona.css") && !(craftedPage(f) && links(f, "/crafted-games.css")));
  ok("every kid page takes its action colour from a shared sheet: action.css, or the crafted layer it opts into", noSheet.length === 0, noSheet.join(" | "));

  // In the browser, with scripts off (so no page sends itself home), the
  // buttons a child taps come out teal, the second choice cream.
  const look = async (f, sels) => (await onScreen(f, sels)).map((r) => (r.missing ? r : { q: r.sel, bg: r.rest }));
  const PRIMARY = [
    ["charge.html", ["#micPrimeBtn"]],
    // the say-it card's mic is a disc, not a button, and its own markup is
    // still orange: the crafted sheet paints it teal
    ...ARCADE.map((f) => [f, ["#goCharge", "#endCharge", "#revOvl .ovlCard>div[style]"]]),
    ["arcade-feed.html", ["#again", "#startBtn", "#primerYes"]],
    ["arcade-hoops.html", ["#startBtn", "#primerYes", "#resume", "#again", "#micBtn"]],
    ["arcade-soccer.html", ["#startBtn", "#primerYes", "#resume", "#again", "#micBtn"]],
    ["arcade-dino.html", ["#startBtn", "#primerYes", "#resume", "#again", "#micBtn"]],
    ["arcade-balloon.html", ["#startBtn", "#micBtn"]],
    ["arcade-bubbles.html", ["#startBtn", "#primerYes", "#resume", "#again", "#micBtn"]],
    ["chapter.html", ["#next", "#doneBtn"]],
    ["story.html", ["#startBtn", "#again", ".mic"]],
    ["library.html", ["#bkNext"]],
    // 29 Sep 2026: "Share this week" left the Grown-ups pop-up (Progress keeps
    // it); on 30 Sep 2026 the pop-up itself went (the code opens Settings)
    ["today.html", ["#libraryUnlock"]],
    ["settings.html", ["button.btn:not(.ghost):not(.blue)"]],
  ];
  const notTeal = [];
  for (const [f, sels] of PRIMARY) for (const r of await look(f, sels)) if (r.missing || !isTeal(r.bg) || ORANGE_RGB.test(r.bg) || GREEN_RGB.test(r.bg)) notTeal.push(f + " " + (r.q || r.sel) + (r.missing ? " (missing)" : ": " + r.bg.slice(0, 60)));
  ok("the buttons and mics a child taps are the action teal, in the browser", notTeal.length === 0, notTeal.join(" | "));
  const SECOND = [["arcade-hoops.html", ["#goHome", "#primerNo"]], ["arcade-bubbles.html", ["#goHome", "#primerNo"]], ["arcade-soccer.html", ["#goHome", "#primerNo"]], ["arcade-dino.html", ["#goHome", "#primerNo"]], ["arcade-feed.html", ["#goHome", "#primerNo"]], ...ARCADE.map((f) => [f, ["#endHome", "#revDone"]]), ["settings.html", ["button.btn.ghost"]]];
  const notCream = [];
  for (const [f, sels] of SECOND) for (const r of await look(f, sels)) if (r.missing || !isCream(r.bg)) notCream.push(f + " " + (r.q || r.sel) + (r.missing ? " (missing)" : ": " + r.bg.slice(0, 60)));
  ok("…and the second choice is the cream pill", notCream.length === 0, notCream.join(" | "));
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
