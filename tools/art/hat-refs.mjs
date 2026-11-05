// Renders the Buddy Shop's drawn hats (customize.html's outfitArt(), the
// little SVGs every hat showed until its painted picture arrived) to PNG, so
// each painted hat (tools/art/game-sprites.json, hat-<id>) is drawn from the
// shape and colours children already know: the drawn hat is its first
// reference picture, approved-style.png its second.
//   node tools/art/hat-refs.mjs        → tools/art/out/edit/hat-<id>-ref.png
// 512 x 512, transparent, the SVG's 64 x 64 box scaled up 8 times. Read
// straight from the page, so a hat redrawn there is the reference next time.
// Needs Playwright's chromium (as the tests do); writes only into the
// git-ignored out/ folder.
import fs from "fs";
import path from "path";
import { chromium } from "../../tests/_env.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const page = fs.readFileSync(path.join(here, "../../public/customize.html"), "utf8");
const block = page.slice(page.indexOf("var paths = {"), page.indexOf("};", page.indexOf("var paths = {")));
const hats = [...block.matchAll(/^\s*([a-z]+):'(.*)',?$/gm)].map((m) => ({ id: m[1], svg: m[2] })).filter((h) => h.id !== "none");
if (!hats.length) { console.log("✗ no drawn hats found in customize.html's outfitArt()"); process.exit(1); }
const out = path.join(here, "out/edit"); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  const p = await browser.newPage({ viewport: { width: 512, height: 512 } });
  for (const h of hats) {
    await p.setContent('<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">' + h.svg + "</svg></body></html>");
    const f = path.join(out, "hat-" + h.id + "-ref.png");
    await p.screenshot({ path: f, omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
    console.log("✓", path.relative(path.join(here, "../.."), f));
  }
} finally { await browser.close(); }
