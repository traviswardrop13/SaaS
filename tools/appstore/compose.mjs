// App Store screenshots, part 2 of 2: put each captured screen in a calm
// frame with its headline, at the exact sizes App Store Connect takes.
//
//   node tools/appstore/capture.mjs && node tools/appstore/compose.mjs
//
// Reads slides.json (the words, colours and order) and the raw screens
// capture.mjs wrote, renders one HTML page per slide in Chromium and saves
//   <out>/iphone/NN-name.png   1320 x 2868  (6.9-inch display)
//   <out>/ipad/NN-name.png     2064 x 2752  (13-inch display)
// as opaque RGB PNGs (the store refuses transparency; a page with an opaque
// background is saved without an alpha channel, and this checks it).
//
// Options: --only=01-fruit-slice,…  --device=iphone|ipad  --out=dir
//
// The look follows Travis's notes (5 Oct 2026): the old set's big two-line
// headline with one line in a warm colour, a short line under it, the phone
// below, a soft background per slide, one family look, but calmer: at most
// two small pictures from the app's own art, a cream page and a deep-navy
// Baloo headline (the "objects with personality" board). The phone is drawn
// in CSS, plain, with a status bar; what is on its screen is the real app.
import { createServer } from "http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, launchOpts } from "../../tests/_env.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const PUBLIC = path.join(REPO, "public");
const RAW = process.env.APPSTORE_RAW || path.join(HERE, "out", "raw");
const PORT = Number(process.env.APPSTORE_COMPOSE_PORT || 8304);
const BASE = "http://127.0.0.1:" + PORT;
const CFG = JSON.parse(readFileSync(path.join(HERE, "slides.json"), "utf8"));

// The phones, in the same points capture.mjs shot them at. bezel and radius
// are fractions of the screen's width; the island is Apple's 126 x 37 pt.
const FRAMES = {
  iphone: { pt: [430, 932], radius: 0.128, bezel: 0.034, rim: 0.007, island: true, statusPt: 59 },
  ipad: { pt: [1032, 1376], radius: 0.036, bezel: 0.03, rim: 0.004, island: false, statusPt: 24 },
};
// Layout per canvas: where the headline starts, its size, and how much of
// the canvas the phone may take.
const LAYOUT = {
  iphone: { top: 150, h1: 124, sub: 50, gap: 30, phoneTop: 36, bottom: 110, maxW: 0.78 },
  ipad: { top: 140, h1: 132, sub: 54, gap: 30, phoneTop: 44, bottom: 120, maxW: 0.78 },
};
const INK = "#28285c", ACCENT = "#ef6f23", SUBINK = "#5b5a7e";

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A plain status bar: the time on the left, signal, Wi-Fi and a full battery
// on the right (Apple's 9:41).
function statusBar(dev, k, ink) {
  const c = ink === "light" ? "#ffffff" : "#1b1b1f";
  const wifi = (s) => `<svg width="${17 * s}" height="${12 * s}" viewBox="0 0 17 12"><path d="M8.5 2.3c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.4 10.4 0 0 0 8.5.6 10.4 10.4 0 0 0 1.1 3.6l1.2 1.2A8.7 8.7 0 0 1 8.5 2.3Zm0 3.4c1.5 0 2.8.6 3.8 1.5l1.2-1.2A7 7 0 0 0 8.5 4a7 7 0 0 0-5 2l1.2 1.2c1-.9 2.3-1.5 3.8-1.5Zm0 3.4c.6 0 1.1.2 1.5.6L8.5 11.2 7 9.7c.4-.4.9-.6 1.5-.6Z" fill="${c}"/></svg>`;
  const battery = (s) => `<svg width="${27 * s}" height="${13 * s}" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.6" fill="none" stroke="${c}" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.2" fill="${c}"/><path d="M25 4.3v4.4c.9-.3 1.5-1.2 1.5-2.2s-.6-1.9-1.5-2.2Z" fill="${c}" fill-opacity=".45"/></svg>`;
  const signal = (s) => `<svg width="${18 * s}" height="${12 * s}" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="${c}"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="${c}"/><rect x="10" y="3" width="3" height="9" rx="1" fill="${c}"/><rect x="15" y="0" width="3" height="12" rx="1" fill="${c}"/></svg>`;
  if (dev === "iphone") {
    // centred on the island's line, as iOS draws it
    return `<div class="sb" style="height:${59 * k}px;color:${c}">
      <span style="position:absolute;left:${34 * k}px;top:${17 * k}px;width:${76 * k}px;text-align:center;font:700 ${17 * k}px/${22 * k}px var(--sys)">9:41</span>
      <span style="position:absolute;right:${30 * k}px;top:${21 * k}px;display:flex;gap:${6 * k}px;align-items:center">${signal(k)}${wifi(k)}${battery(k)}</span></div>`;
  }
  return `<div class="sb" style="height:${24 * k}px;color:${c}">
    <span style="position:absolute;left:${20 * k}px;top:${5 * k}px;font:600 ${12.5 * k}px/${15 * k}px var(--sys)">9:41&nbsp;&nbsp;Mon Oct 5</span>
    <span style="position:absolute;right:${18 * k}px;top:${5 * k}px;display:flex;gap:${6 * k}px;align-items:center;font:600 ${12 * k}px/${15 * k}px var(--sys)">${wifi(k * 0.86)}<span>100%</span>${battery(k * 0.9)}</span></div>`;
}

function slideHTML(slide, dev, copyBottom) {
  const [CW, CH] = CFG.sizes[dev].canvas, L = LAYOUT[dev];
  // A cropped detail keeps the captured pixels' aspect, without pretending
  // the excerpt includes a whole device or adding a status bar over it.
  const rawInfo = pngInfo(readFileSync(path.join(RAW, dev, slide.scene + ".png")));
  const F = slide.detail ? { pt: [rawInfo.w, rawInfo.h], radius: 0.028, bezel: 0.007, rim: 0.003, island: false } : FRAMES[dev];
  // the headline block's height, then the phone fills what is left
  const textH = copyBottom || L.top + 2 * L.h1 * 1.02 + L.gap + 2 * L.sub * 1.3;
  const phoneTop = textH + L.phoneTop;
  const availH = CH - phoneTop - L.bottom;
  const [pw, ph] = F.pt;
  // screen width from the height we have, capped by the canvas width
  let sw = availH / (ph / pw + 2 * F.bezel + 2 * F.rim);
  sw = Math.min(sw, (CW * L.maxW) / (1 + 2 * F.bezel + 2 * F.rim));
  const sh = sw * ph / pw, k = sw / pw;
  const bez = sw * F.bezel, rim = sw * F.rim, fw = sw + 2 * (bez + rim), fh = sh + 2 * (bez + rim);
  const fx = (CW - fw) / 2, fy = phoneTop + (availH - fh) / 2;
  const R = sw * F.radius;
  const shotURL = `/raw/${dev}/${slide.scene}.png`;
  const decor = (slide.decor || []).map((d) => {
    const w = d.w * CW;
    return `<img class="decor${d.behind ? " behind" : ""}" src="/public/${d.src}" style="width:${w}px;left:${d.x * CW - w / 2}px;top:${d.y * CH - w / 2}px;transform:rotate(${d.rot || 0}deg)" alt="">`;
  }).join("");
  const title = slide.title.map((t, i) => `<span class="${i === slide.accent ? "acc" : ""}">${esc(t)}</span>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:"Baloo 2";font-weight:400 800;src:url(/public/fonts/baloo2.woff2) format("woff2");}
    @font-face{font-family:"Nunito";font-weight:400 900;src:url(/public/fonts/nunito.woff2) format("woff2");}
    :root{--sys:-apple-system,"SF Pro Text","Nunito",system-ui,sans-serif;}
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:${CW}px;height:${CH}px;overflow:hidden;}
    body{position:relative;background:linear-gradient(180deg,${slide.bg[0]} 0%,${slide.bg[1]} 100%);-webkit-font-smoothing:antialiased;}
    ${slide.bgImage ? `body{background:url(/bg/${slide.bgImage}) center/cover no-repeat,${slide.bg[0]};}
    /* a soft wash behind the headline so painted art never fights the words */
    body::after{content:"";position:absolute;left:0;right:0;top:0;height:${L.top + L.h1 * 3.6}px;background:linear-gradient(180deg,rgba(255,250,240,.82),rgba(255,250,240,.55) 70%,rgba(255,250,240,0));z-index:0;}
    .copy{z-index:1;}` : ""}
    /* a soft glow behind the phone, so it sits in light rather than on a flat page */
    body::before{content:"";position:absolute;left:50%;top:${fy + fh * 0.42}px;width:${fw * 1.5}px;height:${fh * 0.9}px;transform:translate(-50%,-50%);
      background:radial-gradient(closest-side,rgba(255,255,255,.75),rgba(255,255,255,0));pointer-events:none;}
    .copy{position:absolute;left:${CW * 0.09}px;right:${CW * 0.09}px;top:${L.top}px;text-align:center;}
    h1{font-family:"Baloo 2";font-weight:800;font-size:${L.h1}px;line-height:1.02;color:${INK};letter-spacing:-0.01em;}
    h1 span{display:block;white-space:nowrap;} h1 .acc{color:${ACCENT};}
    p.sub{margin-top:${L.gap}px;font-family:"Nunito";font-weight:700;font-size:${L.sub}px;line-height:1.3;color:${SUBINK};}
    .decor{position:absolute;z-index:3;filter:drop-shadow(0 ${CW * 0.008}px ${CW * 0.012}px rgba(90,50,10,.18));}
    .decor.behind{z-index:1;}
    .phone{position:absolute;z-index:2;left:${fx}px;top:${fy}px;width:${fw}px;height:${fh}px;border-radius:${R + bez + rim}px;
      background:linear-gradient(145deg,#4b4e5c 0%,#24252e 40%,#1a1b22 60%,#3c3f4c 100%);padding:${rim}px;
      box-shadow:0 ${CW * 0.03}px ${CW * 0.06}px rgba(70,40,15,.22),0 ${CW * 0.006}px ${CW * 0.012}px rgba(70,40,15,.18);}
    .bezel{width:100%;height:100%;border-radius:${R + bez}px;background:#0f1015;padding:${bez}px;}
    .screen{position:relative;width:${sw}px;height:${sh}px;border-radius:${R}px;overflow:hidden;background:#fff;}
    .screen img.shot{display:block;width:100%;height:100%;}
    .sb{position:absolute;left:0;right:0;top:0;z-index:2;}
    .island{position:absolute;z-index:3;left:50%;top:${11 * k}px;width:${126 * k}px;height:${37 * k}px;margin-left:${-63 * k}px;border-radius:${18.5 * k}px;background:#000;}
  </style></head><body>
    <header class="copy"><h1>${title}</h1><p class="sub">${esc(slide.sub)}</p></header>
    ${decor}
    <div class="phone"><div class="bezel"><div class="screen">
      <img class="shot" src="${shotURL}" alt="">
      ${slide.detail ? "" : statusBar(dev, k, typeof slide.status === "object" ? slide.status[dev] : slide.status)}
      ${F.island ? '<div class="island"></div>' : ""}
    </div></div></div>
  </body></html>`;
}

const MIME = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", woff2: "font/woff2", svg: "image/svg+xml" };
let pending = "";
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE);
  if (u.pathname === "/slide") { res.writeHead(200, { "content-type": "text/html" }); res.end(pending); return; }
  let f = null;
  if (u.pathname.startsWith("/public/")) f = path.join(PUBLIC, decodeURIComponent(u.pathname.slice(8)));
  if (u.pathname.startsWith("/bg/")) f = path.join(HERE, "bg", decodeURIComponent(u.pathname.slice(4)));
  if (u.pathname.startsWith("/raw/")) f = path.join(RAW, decodeURIComponent(u.pathname.slice(5)));
  if (!f || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(f));
});

// PNG colour type 2 is RGB, 6 is RGBA: the store wants no alpha.
function pngInfo(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], colour: buf[25] }; }

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
  const out = path.resolve(REPO, args.out || CFG.out);
  const devices = args.device ? [args.device] : Object.keys(CFG.sizes);
  const only = args.only ? args.only.split(",") : null;
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  const browser = await chromium.launch(launchOpts());
  let bad = 0;
  try {
    for (const dev of devices) {
      const [CW, CH] = CFG.sizes[dev].canvas;
      const context = await browser.newContext({ viewport: { width: CW, height: CH }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      mkdirSync(path.join(out, dev), { recursive: true });
      for (const slide of CFG.slides) {
        if (only && !only.includes(slide.id)) continue;
        const raw = path.join(RAW, dev, slide.scene + ".png");
        if (!existsSync(raw)) { console.log("FAIL " + dev + "/" + slide.id + ": no raw screen " + raw + " (run capture.mjs)"); bad++; continue; }
        // Keep the exact Rachel sentence checkable in the copy source even
        // though the headline and its continuation have different sizes.
        if (slide.statement && slide.title.join(" ") + " " + slide.sub !== slide.statement) throw new Error("Credential wording drifted: " + slide.id);
        pending = slideHTML(slide, dev);
        await page.goto(BASE + "/slide?" + Date.now());
        await page.evaluate(() => document.fonts.ready);
        // Measure wrapped copy, especially the longer credential sentence
        // on iPad. A guessed line count can put the frame through the words.
        const copyBottom = await page.locator(".copy").evaluate((el) => el.getBoundingClientRect().bottom);
        pending = slideHTML(slide, dev, copyBottom);
        await page.goto(BASE + "/slide?fit=" + Date.now());
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
        const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")));
        const fit = await page.evaluate(() => {
          const copy = document.querySelector(".copy").getBoundingClientRect(), frame = document.querySelector(".phone").getBoundingClientRect();
          const titleFits = [...document.querySelectorAll("h1 span")].every((el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return b.left >= copy.left && b.right <= copy.right; });
          return titleFits && copy.bottom < frame.top && frame.left >= 0 && frame.right <= innerWidth && frame.bottom < innerHeight;
        });
        const file = path.join(out, dev, slide.id + ".png");
        const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: CW, height: CH } });
        writeFileSync(file, buf);
        const info = pngInfo(buf);
        const okSize = info.w === CW && info.h === CH, okRGB = info.colour === 2;
        if (!okSize || !okRGB || broken.length || !fit) bad++;
        console.log((okSize && okRGB && !broken.length && fit ? "PASS " : "FAIL ") + path.relative(REPO, file) + "  " + info.w + "x" + info.h + (okRGB ? " RGB" : " colour type " + info.colour) + (broken.length ? "  missing: " + broken.join(", ") : "") + (!fit ? "  copy or frame outside its bounds" : ""));
      }
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
  if (bad) process.exit(1);
}
await main();
