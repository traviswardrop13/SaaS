// Contact sheets for checking the art by eye:
//   node tools/bookart/preview.mjs cast <out.png>            every character, a few poses
//   node tools/bookart/preview.mjs book <slug> <out.png>      one book's cover and pages
//   node tools/bookart/preview.mjs files <dir> <out.png>      any folder of page SVGs
import { readFileSync, readdirSync } from "fs";
import { chromium, launchOpts } from "../../tests/_env.mjs";
import * as cast from "./cast.mjs";
import { G, at, R } from "./kit.mjs";

const [mode, a1, a2] = process.argv.slice(2);
const svg = (inner, w = 440, h = 400) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
const b64 = (s) => "data:image/svg+xml;base64," + Buffer.from(s).toString("base64");
let cells = [];
if (mode === "cast") {
  const who = Object.keys(cast).filter((k) => !process.env.ONLY || process.env.ONLY.split(",").includes(k));
  for (const k of who) {
    const one = (o) => cast[k](o);
    const inner = R(0, 0, 440, 200, 0, "#e8f4fb") + R(0, 150, 440, 50, 0, "#b5e08f")
      + G(at(60, 170, 0.9), one({ pose: "stand", face: "smile" })) + G(at(165, 170, 0.9), one({ pose: "wave", face: "grin" }))
      + G(at(270, 170, 0.9), one({ pose: "cheer", face: "happy" })) + G(at(375, 170, 0.9), one({ pose: "hold", face: "o" }));
    cells.push([k, b64(svg(inner, 440, 200))]);
  }
} else {
  const dir = mode === "book" ? "public/assets/books/" + a1 : a1;
  const out = mode === "book" ? a2 : a2;
  const names = readdirSync(dir).filter((f) => f.endsWith(".svg")).sort((x, y) => (x === "cover.svg" ? -1 : y === "cover.svg" ? 1 : x < y ? -1 : 1));
  cells = names.map((n) => [n, b64(readFileSync(dir + "/" + n, "utf8"))]);
  process.argv[4] = out;
}
const out = mode === "cast" ? a1 : a2;
const colW = mode === "cast" ? 440 : 330;
const html = `<body style="margin:0;background:#fff;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${mode === "cast" ? 3 : 4},${colW}px);gap:8px;padding:8px">`
  + cells.map(([n, u]) => `<figure style="margin:0"><img src="${u}" style="width:${colW}px;border:1px solid #ddd;border-radius:8px;display:block"><figcaption>${n}</figcaption></figure>`).join("")
  + "</div></body>";
const b = await chromium.launch(launchOpts([]));
const p = await b.newPage({ viewport: { width: mode === "cast" ? 1360 : 1380, height: 900 } });
await p.setContent(html);
await p.waitForTimeout(400);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log("wrote", out, cells.length, "cells");
