// THE HOME-PRACTICE PACKET (17 Nov 2026): the free printable a clinician
// gets for their email at speaksona.com/ (public/packet.html). This script
// writes public/home-practice-packet.html, served at /packet.
//
//   node tools/packet/build-packet.mjs           writes the page
//   node tools/packet/build-packet.mjs --check   exits 1 if the page on disk
//                                                is not what this would write
//
// WHAT A CHILD IS ASKED TO SAY IS RACHEL'S CALL (CLAUDE.md, Clinical rules),
// so the packet adds no clinical content of its own: every word on every
// sound page is a word already in the app's word bank (WORDS in sona.js), at
// the same place in the word, one word on its own, never with a carrier
// phrase. Left out, as the app leaves them out:
//   - the medial words the family Middle and Mixed skip until Rachel reviews
//     the bank (FAMILY_MEDIAL_REVIEW in sona.js: water, letter and button
//     for T, gloves for V);
//   - anything on the never-say list (tests/soundmap.mjs keeps it).
// The ages on the cover are SOUND_NORM's, the ones the app uses. The parent
// guide follows the app's own rules (one target said on its own; silence is
// never a try; end on a success; the speech therapist picks the target) and
// is Rachel's to approve before it ships.
//
// Static markup, generated: change a word in sona.js and run this again,
// never hand-edit the page. tests/shiptest.mjs makes --check's comparison,
// and holds every printed word to the bank.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import vm from "node:vm";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const OUT = path.join(REPO, "public/home-practice-packet.html");

// A literal from sona.js, read as data (the bank is plain objects and strings).
function literal(src, name) {
  const at = src.indexOf("const " + name + " = ");
  if (at < 0) throw new Error("sona.js has no " + name);
  const start = at + ("const " + name + " = ").length;
  const open = src[start], close = open === "[" ? "]" : "}";
  let depth = 0, i = start;
  for (; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close && --depth === 0) break;
  }
  return vm.runInNewContext("(" + src.slice(start, i + 1) + ")");
}

/** Everything the packet is made from, read from the app itself. */
export function packetData(sonaSrc = readFileSync(path.join(REPO, "public/sona.js"), "utf8"),
  soundmapSrc = readFileSync(path.join(REPO, "tests/soundmap.mjs"), "utf8")) {
  const neverSay = JSON.parse(((soundmapSrc.match(/const NEVER_SAY = (\[[^\]]*\]);/) || [])[1] || "").replace(/'/g, '"') || "null");
  if (!Array.isArray(neverSay) || !neverSay.length) throw new Error("tests/soundmap.mjs has no NEVER_SAY list");
  const sounds = literal(sonaSrc, "ALL_SOUNDS");
  const norm = literal(sonaSrc, "SOUND_NORM");
  const words = literal(sonaSrc, "WORDS");
  const held = literal(sonaSrc, "FAMILY_MEDIAL_REVIEW");
  const labels = literal(sonaSrc, "SOUND_LABELS");
  const POS = [["i", "Beginning"], ["m", "Middle"], ["f", "End"], ["b", "Blends"], ["v", "Vocalic R"]];
  const pages = sounds.map((s) => {
    const bank = words[s];
    if (!bank) throw new Error("WORDS has no " + s);
    const cols = POS.map(([pos, name]) => {
      const seen = new Set();
      const list = bank.filter((w) => (w.pos || "i") === pos)
        .filter((w) => !(pos === "m" && (held[s] || []).includes(w.w)))
        .filter((w) => !neverSay.includes(w.w))
        .filter((w) => !seen.has(w.w) && seen.add(w.w));
      for (const w of list) if (!/^[a-z]+$/.test(w.w)) throw new Error(s + ": '" + w.w + "' is not a single word");
      return { pos, name, words: list.map((w) => ({ w: w.w, e: w.e })) };
    }).filter((c) => c.words.length);
    return { sound: s, label: labels[s] || s, example: bank[0].w, age: norm[s], cols };
  });
  return { sounds, norm, pages, neverSay, held };
}

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The cover's age line, grouped from SOUND_NORM: "P, B and M by about 3; …"
function agesLine(pages) {
  const by = new Map();
  for (const p of pages) { if (!by.has(p.age)) by.set(p.age, []); by.get(p.age).push(p.label); }
  const and = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  return [...by.keys()].sort((a, b) => a - b).map((age) => and(by.get(age)) + " by about " + age).join("; ");
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const tracker = () =>
  `<div class="track"><b>Tick a box each day you practice</b>` +
  ["Week 1", "Week 2"].map((wk) => `<div class="week"><span class="wk">${wk}</span>` + DAYS.map((d) => `<span class="day"><i></i>${d}</span>`).join("") + `</div>`).join("") +
  `</div>`;

const RACHEL = "Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship.";

export function buildPacket(data = packetData()) {
  const { pages } = data;
  const chips = pages.map((p) => `<span>${esc(p.label)}</span>`).join("");
  const soundPages = pages.map((p) => `
  <section class="sheet sound" data-sound="${p.sound}">
    <div class="top">
      <div><p class="eyebrow">Practice sound</p><h2>${esc(p.label)} <small>as in &ldquo;${esc(p.example)}&rdquo;</small></h2></div>
      <img src="/assets/site/echo.webp" alt="" width="72" height="72">
    </div>
    <p class="how">Your child&rsquo;s speech therapist circled where to practice. Say one word on its own; your child says it back.</p>
    <div class="cols">
${p.cols.map((c) => `      <div class="col" data-pos="${c.pos}"><h3><span class="ring" aria-hidden="true"></span>${c.name}</h3><ul>${c.words.map((w) => `<li data-w="${esc(w.w)}"><span class="e" aria-hidden="true">${w.e}</span>${esc(w.w)}</li>`).join("")}</ul></div>`).join("\n")}
    </div>
    ${tracker()}
    <p class="foot">Sona home-practice packet &middot; A practice sheet, not an evaluation &middot; speaksona.com</p>
  </section>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <script>
// Clinician tools live in the browser. A restored link in the native shell
// must return to the family app before rendering or making clinician requests.
(function () {
  var native = false;
  // The clinicians' own app (SLPAPP1, 16 Nov 2026) opens its dashboard: the
  // websites have sign-up and price pages that app never shows.
  try { if (/\\bSonaSLPApp\\/\\d/.test(navigator.userAgent || "")) { window.__sonaFamilyRedirect = true; document.documentElement.style.visibility = "hidden"; window.location.replace("/slp.html"); return; } } catch (e) {}
  try {
    var bridge = window.Capacitor;
    native = !!(bridge && (typeof bridge.isNativePlatform === "function" ? bridge.isNativePlatform() : true));
  } catch (e) {}
  if (!native) return;
  window.__sonaFamilyRedirect = true;
  document.documentElement.style.visibility = "hidden";
  // Home owns active-child selection and the first-run setup guard.
  window.location.replace("/today.html");
})();
  </script>
  <!-- GENERATED by tools/packet/build-packet.mjs from the app's own word bank.
       Do not edit by hand: change sona.js and run the script again. -->
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Home-practice packet — Sona</title>
  <!-- What the opt-in's email buys, so search is not invited to skip the door. -->
  <meta name="robots" content="noindex" />
  <link rel="icon" type="image/png" href="/favicon.png?v=2" />
  <link href="/fonts.css" rel="stylesheet">
  <style>
    :root { --cream: #f7f2e8; --paper: #fffdf8; --ink: #1d2b4f; --body: #46506b; --muted: #626b85; --line: #e6dcc9; --teal: #146d73; --teal-deep: #0b4e55; --butter: #ffe6a6; --display: "Baloo 2", Nunito, sans-serif; }
    * { box-sizing: border-box; }
    html, body { overflow-x: clip; }
    body { margin: 0; background: var(--cream); color: var(--ink); font: 600 16px/1.5 Nunito, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    h1, h2, h3, p { margin: 0; }
    h1, h2, h3 { font-family: var(--display); font-weight: 800; line-height: 1.02; }
    img { display: block; max-width: 100%; height: auto; }
    .bar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 10px clamp(16px, 3vw, 28px); background: rgba(255, 248, 231, .97); border-bottom: 1px solid #e8dfd2; }
    .bar .brand { display: flex; align-items: center; gap: 8px; }
    .bar .brand img { width: 36px; height: 36px; }
    .bar .brand b { font: 800 22px/1 var(--display); }
    .bar .brand span { color: var(--muted); font-size: 14px; }
    .bar .acts { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .bar .note { color: var(--muted); font-size: 13px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 6px 20px; border: 0; border-radius: 14px; background: var(--teal); color: #fff; box-shadow: 0 4px 0 var(--teal-deep); font: 800 17px/1.1 var(--display); cursor: pointer; }
    .btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--teal-deep); }
    :focus-visible { outline: 3px solid var(--teal); outline-offset: 3px; }
    .sheets { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px 16px 60px; }
    .sheet { position: relative; display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 8.5in; min-height: 11in; padding: .55in .6in; border-radius: 8px; background: #fff; box-shadow: 0 10px 30px -18px rgba(29, 43, 79, .5); }
    .eyebrow { color: var(--teal-deep); font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .lede { color: var(--body); font-size: 17px; }
    .box { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; border: 2px solid var(--line); border-radius: 16px; }
    .box.tint { background: #fff8e5; border-color: #f0dfaa; }
    .box h3 { font-size: 20px; }
    .box p, .box li { color: var(--body); font-size: 15px; }
    ol { display: flex; flex-direction: column; gap: 9px; margin: 0; padding-left: 22px; color: var(--body); font-size: 16px; }
    ol b { color: var(--ink); }
    .cover h1 { font-size: 46px; letter-spacing: -.03em; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips span { padding: 2px 11px; border: 2px solid var(--line); border-radius: 999px; font-size: 14px; font-weight: 800; }
    .guide h2 { font-size: 38px; letter-spacing: -.02em; }
    /* the page a parent reads: larger, with room between the steps */
    .guide .lede { font-size: 19px; }
    .guide ol { gap: 16px; font-size: 19px; }
    .guide .box p { font-size: 16px; }
    .byline { display: flex; align-items: center; gap: 12px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; line-height: 1.45; }
    .byline img { width: 44px; height: 44px; flex: none; border-radius: 50%; object-fit: cover; }
    .sound .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .sound h2 { font-size: 52px; letter-spacing: -.02em; }
    .sound h2 small { color: var(--muted); font: 700 19px/1 Nunito, sans-serif; letter-spacing: 0; }
    .sound .top img { width: 72px; height: 72px; flex: none; }
    .how { color: var(--body); font-size: 15px; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 14px; }
    .col h3 { display: flex; align-items: center; gap: 8px; padding-bottom: 6px; border-bottom: 3px solid var(--teal); font-size: 19px; }
    .ring { display: inline-block; flex: none; width: 18px; height: 18px; border: 2px solid var(--ink); border-radius: 50%; }
    .col ul { margin: 6px 0 0; padding: 0; list-style: none; }
    .col li { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 19px; font-weight: 800; overflow-wrap: anywhere; }
    .col .e { flex: none; width: 26px; font-size: 21px; text-align: center; }
    .track { display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
    .track b { font-size: 15px; }
    .week { display: grid; grid-template-columns: 62px repeat(7, 1fr); align-items: end; gap: 7px; }
    .wk { color: var(--muted); font-size: 12px; font-weight: 800; }
    .day { display: flex; flex-direction: column; align-items: center; gap: 3px; color: var(--muted); font-size: 11px; font-weight: 800; }
    .day i { display: block; width: 100%; height: 26px; border: 2px solid var(--ink); border-radius: 7px; }
    .foot { color: var(--muted); font-size: 11px; text-align: center; }
    @media (max-width: 640px) {
      /* one slim row on a phone: the logo and the button */
      .bar { flex-wrap: nowrap; }
      .bar .note, .bar .brand span { display: none; }
      .bar .btn { min-height: 42px; padding: 6px 14px; font-size: 16px; }
      .sheet { min-height: 0; padding: 22px 18px; }
      .cover h1 { font-size: 34px; }
      .sound h2 { font-size: 40px; }
      .week { grid-template-columns: 48px repeat(7, 1fr); gap: 4px; }
    }
    /* US Letter, one page per sheet: the sound pages are what goes home. */
    @page { size: letter; margin: 0; }
    @media print {
      body { background: #fff; }
      .bar { display: none; }
      .sheets { display: block; padding: 0; }
      .sheet { width: 8.5in; max-width: none; height: 11in; min-height: 0; border-radius: 0; box-shadow: none; break-after: page; page-break-after: always; overflow: hidden; }
      .sheet:last-child { break-after: auto; page-break-after: auto; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

<div class="bar">
  <div class="brand"><img src="/assets/site/echo.webp" alt="" width="36" height="36"><b>Sona</b><span>Home-practice packet</span></div>
  <div class="acts">
    <span class="note">US Letter, one sound to a page.</span>
    <button class="btn" id="print" type="button">Print or save as PDF</button>
  </div>
</div>

<main class="sheets">
  <section class="sheet cover">
    <p class="eyebrow">For speech therapists</p>
    <h1>Home-practice packet</h1>
    <p class="lede">Word lists for every sound, sorted by where the sound sits in the word, a one-page guide for parents, and a tick-box tracker on every page.</p>
    <div class="box">
      <h3>How to use it</h3>
      <ol>
        <li><b>Choose what the child is ready for:</b> the sound, and the place in the word. You know the child; this packet doesn&rsquo;t choose for you.</li>
        <li><b>Circle it</b> on that sound&rsquo;s page: beginning, middle or end of the word, or blends and vocalic R where a sound has them.</li>
        <li><b>Send it home</b> with the parent guide on the next page.</li>
        <li><b>Ask to see the ticks</b> at the next session.</li>
      </ol>
    </div>
    <div class="box tint">
      <h3>Readiness comes first</h3>
      <p>In the Sona app, a sound is offered from about the age most children say it: ${esc(agesLine(pages))}. These ages are approximate and references vary. The app also holds blends and vocalic R back for ages 2 to 4. Your clinical judgment comes first.</p>
    </div>
    <div class="box">
      <h3>${pages.length} sounds inside</h3>
      <div class="chips">${chips}</div>
      <p>Every word is one the Sona app already uses, said on its own.</p>
    </div>
    <div class="byline"><img src="/assets/rachel-wardrop-profile.jpg" alt="" width="44" height="44"><p>${RACHEL}<br>A practice resource from Sona, not an evaluation. speaksona.com</p></div>
  </section>

  <section class="sheet guide">
    <p class="eyebrow">For parents</p>
    <h2>Practicing at home</h2>
    <p class="lede">A few minutes a day helps your child use their sound between speech sessions.</p>
    <ol>
      <li><b>Pick one quiet time a day.</b> A few minutes is enough.</li>
      <li><b>Practice only what your child&rsquo;s speech therapist circled:</b> the sound, and the place in the word.</li>
      <li><b>Say one word on its own,</b> clearly. Your child says it back. One word at a time, with nothing added before or after it.</li>
      <li><b>A try is your child saying the word out loud.</b> Silence or pointing isn&rsquo;t a try.</li>
      <li><b>Praise the try,</b> not just the words that come out right.</li>
      <li><b>If a word is tricky, go back to an easier one,</b> and always finish on a word your child gets right.</li>
      <li><b>Tick a box each day you practice,</b> and bring the page to the next session.</li>
    </ol>
    <div class="box tint">
      <p>This guide supports the plan your child&rsquo;s speech therapist makes. It is not an evaluation. Questions about your child&rsquo;s speech? Ask their speech therapist.</p>
    </div>
    <div class="byline"><img src="/assets/rachel-wardrop-profile.jpg" alt="" width="44" height="44"><p>${RACHEL}</p></div>
  </section>
${soundPages}
</main>

<script>
  (function () {
    if (window.__sonaFamilyRedirect) return;
    var b = document.getElementById("print");
    if (b) b.onclick = function () { window.print(); };
  })();
</script>
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = buildPacket();
  if (process.argv.includes("--check")) {
    let disk = "";
    try { disk = readFileSync(OUT, "utf8"); } catch (e) {}
    if (disk !== html) { console.error("public/home-practice-packet.html is not what tools/packet/build-packet.mjs writes: run it again"); process.exit(1); }
    console.log("public/home-practice-packet.html is up to date");
  } else {
    writeFileSync(OUT, html);
    console.log("wrote public/home-practice-packet.html");
  }
}
