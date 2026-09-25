// ART1: the sticker sprite renders.
//
// Every piece of art in the kid app is one <g> in public/assets/sona-stickers.svg,
// referenced as <use href="#id"> inside a viewBox="0 0 120 120" wrapper. Two
// failure modes are invisible in source and obvious to a child:
//
//   1. A group whose art sits outside the 120 box — it ships as "half the rocket
//      is missing". Four groups arrived from the design bundle like this; the
//      handoff's own instruction to reference everything at 120 would have
//      rendered 44 more at 53% in the top-left corner.
//   2. A group that renders nothing at all, because a <use> points at an id that
//      moved or a transform collapsed it.
//
// Neither is catchable by reading the file, so this measures the real bounding
// box of every group in a browser.
import { createServer } from "http";
import { readFileSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const SPRITE = ROOT + "/assets/sona-stickers.svg";
const sprite = readFileSync(SPRITE, "utf8");
const ids = [...sprite.matchAll(/<g id="([^"]+)"/g)].map((m) => m[1]);

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ── source contracts ──
ok("the sprite paints nothing on its own", !/<(path|circle|rect|ellipse|polygon)\b/.test(sprite.replace(/<defs>[\s\S]*<\/defs>/, "")),
  "inlining it into a page must render nothing until something references an id");
ok("every id is unique", new Set(ids).size === ids.length,
  "a duplicate id makes <use> pick whichever came first, silently");
ok("the whole kit is present", ids.length >= 120, String(ids.length));
for (const family of ["p-echo-", "st-", "ob-", "wb-", "bud-", "pi-", "bc-", "rrb-"]) {
  ok(`family ${family}* exists`, ids.some((i) => i.startsWith(family)), family);
}

const html = `<!DOCTYPE html><body style="margin:0">${sprite}
${ids.map((id) => `<svg id="box-${id}" viewBox="0 0 120 120" width="120" height="120"><use href="#${id}"></use></svg>`).join("")}</body>`;
const srv = createServer((_q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end(html); });
await new Promise((r) => srv.listen(8193, r));

const browser = await chromium.launch(launchOpts());
const pg = await browser.newPage();
const warned = [];
pg.on("console", (m) => { if (m.type() === "error") warned.push(m.text()); });
pg.on("pageerror", (e) => warned.push(String(e)));
await pg.goto("http://localhost:8193/");
await pg.waitForTimeout(500);

const boxes = await pg.evaluate((ids) => ids.map((id) => {
  const bb = document.querySelector(`#box-${CSS.escape(id)} use`).getBBox();
  return { id, x: +bb.x.toFixed(1), y: +bb.y.toFixed(1), w: +bb.width.toFixed(1), h: +bb.height.toFixed(1) };
}), ids);

const empty = boxes.filter((b) => b.w < 1 || b.h < 1);
ok("every sticker renders something", empty.length === 0, empty.map((b) => b.id).join(" "));

// One grid, one wrapper. A group outside the box is art the child never sees.
const out = boxes.filter((b) => b.x < -1 || b.y < -1 || b.x + b.w > 121 || b.y + b.h > 121);
ok("every sticker fits its 120 box", out.length === 0,
  out.map((b) => `${b.id}@${b.x},${b.y} ${b.w}x${b.h}`).join(" "));

// README §2a: scene stickers are centre-slice cropped at up to 1.27 aspect, so
// SUBJECT geometry outside y14–106 is cropped away at the hero size. The field
// behind it (sky / peach / mint) is meant to bleed edge to edge — measuring the
// whole group would flag every correct sticker, so the field is excluded: any
// child covering ≥95% of the box is background, not subject.
const subj = await pg.evaluate((ids) => ids.filter((i) => i.startsWith("st-")).map((id) => {
  const use = document.querySelector(`#box-${CSS.escape(id)} use`);
  const root = use.getRootNode().getElementById(id);
  let top = 999, bot = -999;
  const walk = (el) => {
    for (const c of el.children) {
      if (c.children.length) { walk(c); continue; }
      let bb; try { bb = c.getBBox(); } catch { continue; }
      if (bb.width <= 0 || bb.height <= 0) continue;
      if (bb.width >= 114 && bb.height >= 114) continue;   // the field
      top = Math.min(top, bb.y); bot = Math.max(bot, bb.y + bb.height);
    }
  };
  walk(root);
  return { id, top: +top.toFixed(1), bot: +bot.toFixed(1) };
}), ids);
const unsafe = subj.filter((b) => b.top < 13 || b.bot > 107);
ok("scene-sticker subjects stay inside the y14–106 safe band", unsafe.length === 0,
  unsafe.map((b) => `${b.id} y${b.top}–${b.bot}`).join(" "));

ok("no console errors resolving any <use href>", warned.length === 0, warned.slice(0, 3).join(" | "));

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
