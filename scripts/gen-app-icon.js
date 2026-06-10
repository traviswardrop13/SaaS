/**
 * Builds the Sona app icon from "Leo - APP Icon" art (a lion HEAD on a flat
 * off-white background) by keying out that background and compositing the head
 * on Sona's blue gradient.
 *
 *   node scripts/gen-app-icon.js [sourcePng]
 *
 * Writes public/coach/leo-icon.png (transparent head, for re-runs/reuse) and
 * public/{apple-touch-icon,icon-192,icon-512}.png. Pure Node (no native deps).
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
function chunk(ty, da) { const l = Buffer.alloc(4); l.writeUInt32BE(da.length, 0); const t = Buffer.from(ty, "ascii"); const cr = Buffer.alloc(4); cr.writeUInt32BE(CRC(Buffer.concat([t, da])), 0); return Buffer.concat([l, t, da, cr]); }
function decodePNG(buf) {
  let pos = 8, w, h, bd, ct, il; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.slice(pos + 8, pos + 8 + len); pos += 12 + len; if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; } else if (type === "IDAT") idat.push(data); else if (type === "IEND") break; }
  if (bd !== 8 || (ct !== 6 && ct !== 2)) throw new Error("unsupported PNG " + bd + "/" + ct);
  if (il !== 0) throw new Error("interlaced PNG not supported");
  const src = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * src, line = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  let rp = 0;
  for (let y = 0; y < h; y++) { const f = raw[rp++]; for (let x = 0; x < stride; x++) { const v = raw[rp++]; const a = x >= src ? line[y * stride + x - src] : 0, b = y > 0 ? line[(y - 1) * stride + x] : 0, c = (x >= src && y > 0) ? line[(y - 1) * stride + x - src] : 0; let val; switch (f) { case 0: val = v; break; case 1: val = v + a; break; case 2: val = v + b; break; case 3: val = v + ((a + b) >> 1); break; case 4: val = v + paeth(a, b, c); break; } line[y * stride + x] = val & 255; } }
  const out = Buffer.alloc(w * h * 4); for (let i = 0, j = 0; i < w * h; i++) { out[j++] = line[i * src]; out[j++] = line[i * src + 1]; out[j++] = line[i * src + 2]; out[j++] = src === 4 ? line[i * src + 3] : 255; }
  return { width: w, height: h, data: out };
}
function encodePNG(w, h, data, channels) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2; const stride = w * channels, raw = Buffer.alloc((stride + 1) * h); for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); } return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]); }
function resize(s, sw, sh, dw, dh) { const out = Buffer.alloc(dw * dh * 4); for (let y = 0; y < dh; y++) { const sy = (y + 0.5) * sh / dh - 0.5, y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(sh - 1, y0 + 1), fy = Math.min(1, Math.max(0, sy - y0)); for (let x = 0; x < dw; x++) { const sx = (x + 0.5) * sw / dw - 0.5, x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(sw - 1, x0 + 1), fx = Math.min(1, Math.max(0, sx - x0)); for (let c = 0; c < 4; c++) { const a = s[(y0 * sw + x0) * 4 + c], b = s[(y0 * sw + x1) * 4 + c], cc = s[(y1 * sw + x0) * 4 + c], d2 = s[(y1 * sw + x1) * 4 + c]; out[(y * dw + x) * 4 + c] = Math.round((a + (b - a) * fx) + ((cc + (d2 - cc) * fx) - (a + (b - a) * fx)) * fy); } } } return { data: out, width: dw, height: dh }; }
// High-quality downscale: average every source pixel covering a destination
// pixel (box filter), using premultiplied alpha so transparent edges stay clean.
// Far sharper than 2x2 bilinear for big reductions.
function resizeArea(s, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4), sxr = sw / dw, syr = sh / dh;
  for (let dy = 0; dy < dh; dy++) {
    const y0 = Math.floor(dy * syr), y1 = Math.max(y0 + 1, Math.min(sh, Math.ceil((dy + 1) * syr)));
    for (let dx = 0; dx < dw; dx++) {
      const x0 = Math.floor(dx * sxr), x1 = Math.max(x0 + 1, Math.min(sw, Math.ceil((dx + 1) * sxr)));
      let r = 0, g = 0, b = 0, asum = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * sw + x) * 4, al = s[i + 3] / 255; r += s[i] * al; g += s[i + 1] * al; b += s[i + 2] * al; asum += al; n++; }
      const di = (dy * dw + dx) * 4;
      if (asum > 0) { out[di] = Math.round(r / asum); out[di + 1] = Math.round(g / asum); out[di + 2] = Math.round(b / asum); out[di + 3] = Math.round(asum / n * 255); }
    }
  }
  return { data: out, width: dw, height: dh };
}
function bbox(d, w, h) { let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; }
function crop(d, w, bb) { const cw = bb.x1 - bb.x0 + 1, ch = bb.y1 - bb.y0 + 1, out = Buffer.alloc(cw * ch * 4); for (let y = 0; y < ch; y++) d.copy(out, y * cw * 4, ((bb.y0 + y) * w + bb.x0) * 4, ((bb.y0 + y) * w + bb.x0) * 4 + cw * 4); return { data: out, width: cw, height: ch }; }

// Chroma-key a FLAT background: flood-fill from the border through near-bg pixels
// and turn them transparent, with anti-aliased edges (alpha from color distance,
// plus un-mixing the bg tint). The enclosed cream face is never reached.
function keyOutBackground(d, w, h) {
  // sample bg from the four corners
  const sample = (x, y) => [d[(y * w + x) * 4], d[(y * w + x) * 4 + 1], d[(y * w + x) * 4 + 2]];
  const cs = [sample(1, 1), sample(w - 2, 1), sample(1, h - 2), sample(w - 2, h - 2)];
  const bg = [0, 1, 2].map((k) => Math.round(cs.reduce((s, c) => s + c[k], 0) / cs.length));
  const dist = (i) => Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]);
  const TLOW = 26, THIGH = 130; // <=TLOW fully bg, >=THIGH fully kept
  const inRegion = new Uint8Array(w * h), st = [];
  const consider = (i) => { if (!inRegion[i] && dist(i) < THIGH) { inRegion[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { consider(x); consider((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { consider(y * w); consider(y * w + w - 1); }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; if (x > 0) consider(i - 1); if (x < w - 1) consider(i + 1); if (y > 0) consider(i - w); if (y < h - 1) consider(i + w); }
  for (let i = 0; i < w * h; i++) {
    if (!inRegion[i]) continue;
    const dd = dist(i);
    let a = (dd - TLOW) / (THIGH - TLOW); a = a < 0 ? 0 : a > 1 ? 1 : a;
    if (a <= 0) { d[i * 4 + 3] = 0; continue; }
    // un-mix: observed = true*a + bg*(1-a)  =>  true = (observed - bg*(1-a))/a
    for (let c = 0; c < 3; c++) { let v = (d[i * 4 + c] - bg[c] * (1 - a)) / a; d[i * 4 + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
    d[i * 4 + 3] = Math.round(a * 255);
  }
}

// Leo's head filling the frame on a blue gradient (slight padding)
function icon(head, size, fill) {
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) { const t = y / size, r = Math.round(58 + (24 - 58) * t), g = Math.round(167 + (128 - 167) * t), b = Math.round(255 + (224 - 255) * t); for (let x = 0; x < size; x++) { const i = (y * size + x) * 3; out[i] = r; out[i + 1] = g; out[i + 2] = b; } }
  const inner = size * (fill || 0.92), scale = Math.min(inner / head.width, inner / head.height), dw = Math.round(head.width * scale), dh = Math.round(head.height * scale);
  const lion = resizeArea(head.data, head.width, head.height, dw, dh).data;
  const ox = Math.round((size - dw) / 2), oy = Math.round((size - dh) / 2);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { const a = lion[(y * dw + x) * 4 + 3] / 255; if (a <= 0) continue; const di = ((oy + y) * size + (ox + x)) * 3, si = (y * dw + x) * 4; out[di] = Math.round(lion[si] * a + out[di] * (1 - a)); out[di + 1] = Math.round(lion[si + 1] * a + out[di + 1] * (1 - a)); out[di + 2] = Math.round(lion[si + 2] * a + out[di + 2] * (1 - a)); }
  return encodePNG(size, size, out, 3);
}

const PUB = path.join(__dirname, "..", "public");
const COACH = path.join(PUB, "coach");
fs.mkdirSync(COACH, { recursive: true });
const srcPath = process.argv[2] || (fs.existsSync("/tmp/leo_icon_src.png") ? "/tmp/leo_icon_src.png" : path.join(COACH, "leo-icon.png"));

const src = decodePNG(fs.readFileSync(srcPath));
if (path.resolve(srcPath) !== path.join(COACH, "leo-icon.png")) keyOutBackground(src.data, src.width, src.height);
const head = crop(src.data, src.width, bbox(src.data, src.width, src.height));
// save a transparent, downscaled head for re-runs / reuse (area-averaged = crisp)
const m = Math.min(1, 1280 / Math.max(head.width, head.height)), hw = Math.round(head.width * m), hh = Math.round(head.height * m);
const headSmall = resizeArea(head.data, head.width, head.height, hw, hh);
fs.writeFileSync(path.join(COACH, "leo-icon.png"), encodePNG(hw, hh, headSmall.data, 4));
console.log("wrote coach/leo-icon.png", hw + "x" + hh);

// icons are rendered straight from the full-res head in a single area-downscale
for (const [sz, name] of [[180, "apple-touch-icon.png"], [192, "icon-192.png"], [512, "icon-512.png"]]) {
  fs.writeFileSync(path.join(PUB, name), icon(head, sz, 0.85));
  console.log("wrote", name, sz + "x" + sz);
}
