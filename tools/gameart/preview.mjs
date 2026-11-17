// Contact sheets for checking a game's scene by eye, one frame per word:
//   node tools/gameart/preview.mjs <out-dir> [key…]
// writes <out-dir>/<key>.png: the scene before the first word, after every
// word, and after the finale, with moves applied and animations stilled (the
// finale's fly-aways are motion, so they show where they start).
import { readFileSync } from "fs";
import { chromium, launchOpts } from "../../tests/_env.mjs";
import { stageSvg, check } from "./page.mjs";
import { GAMES } from "./games.mjs";

const [outDir, ...keys] = process.argv.slice(2);
if (!outDir) throw new Error("usage: preview.mjs <out-dir> [key…]");
const css = readFileSync("public/sayplay.css", "utf8");

function frames(g) {
  const st = {};
  for (const p of g.parts) st[p.id] = { x: 0, y: 0, s: p.s ?? 1, r: p.r ?? 0, hid: !!p.hid, gone: false };
  const snap = () => JSON.parse(JSON.stringify(st));
  const apply = (list) => (list || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((a) => {
    const p = st[a.id];
    if (a.a === "show") { p.hid = false; p.gone = a.fx === "puff"; }
    else if (a.a === "hide") p.gone = true;
    else if (a.a === "move") { p.x = a.x; p.y = a.y; if (a.s != null) p.s = a.s; if (a.r != null) p.r = a.r; }
    else if (a.a === "by") { p.x += a.x || 0; p.y += a.y || 0; }
    else if (a.a === "scale") p.s = a.s;
    else if (a.a === "turn") p.r = a.r;
  });
  const out = [["start", snap()]];
  g.steps.forEach((s, i) => { apply(s); out.push(["word " + (i + 1), snap()]); });
  apply(g.finale); out.push(["finale", snap()]);
  return out;
}
function frameSvg(g, state) {
  let svg = stageSvg(g);
  for (const id in state) {
    const p = state[id];
    const cls = "part" + (p.hid ? " hid" : "") + (p.gone ? " gone" : "");
    svg = svg.replace(new RegExp(`<g id="p-${id}" class="part( hid)?"`), `<g id="p-${id}" class="${cls}"`)
      .replace(new RegExp(`(<g id="p-${id}"[^>]*>)<g class="pm"( style="[^"]*")?>`), `$1<g class="pm" style="transform:translate(${p.x}px,${p.y}px) rotate(${p.r}deg) scale(${p.s})">`);
  }
  return `<svg viewBox="0 0 440 400" style="width:330px;display:block;border-radius:14px">${svg}</svg>`;
}

const b = await chromium.launch(launchOpts([]));
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
for (const g of GAMES) {
  if (keys.length && !keys.includes(g.key)) continue;
  check(g);
  const cells = frames(g).map(([name, s]) => `<figure style="margin:0">${frameSvg(g, s)}<figcaption>${name}</figcaption></figure>`).join("");
  await p.setContent(`<style>${css}\n.pm,.pa,.part{transition:none!important;animation:none!important}</style><body style="margin:0;background:#fff;font:13px sans-serif"><h3 style="margin:8px">${g.title}</h3><div style="display:grid;grid-template-columns:repeat(4,330px);gap:8px;padding:8px">${cells}</div></body>`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${outDir}/${g.key}.png`, fullPage: true });
  console.log("wrote", `${outDir}/${g.key}.png`);
}
await b.close();
