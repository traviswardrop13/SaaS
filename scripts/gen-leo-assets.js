/**
 * Builds Sona's Leo assets from the source art:
 *   - public/coach/leo.png       (front-facing, web-sized, transparent)
 *   - public/coach/leo-wave.png  (waving, web-sized, transparent)
 *   - public/apple-touch-icon.png, icon-192.png, icon-512.png (Leo on blue)
 *
 * Pure Node (no native deps): hand-rolled PNG decode/encode + bilinear resize.
 * Sources default to the originals pulled from Drive (/tmp/leo2.png front,
 * /tmp/leo1.png wave). To regenerate the icon after swapping art, drop a new
 * front-facing transparent PNG at public/coach/leo.png and run:
 *     node scripts/gen-leo-assets.js public/coach/leo.png
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

// ---------- PNG chunk helpers ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

// ---------- decode 8-bit PNG (RGBA/RGB, non-interlaced) ----------
function decodePNG(buf) {
  let pos = 8, w, h, bitDepth, colorType, interlace; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len); pos += 12 + len;
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error("unsupported PNG " + bitDepth + "/" + colorType);
  if (interlace !== 0) throw new Error("interlaced PNG not supported");
  const src = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * src, line = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++];
      const a = x >= src ? line[y * stride + x - src] : 0;
      const b = y > 0 ? line[(y - 1) * stride + x] : 0;
      const c = (x >= src && y > 0) ? line[(y - 1) * stride + x - src] : 0;
      let val; switch (f) { case 0: val = v; break; case 1: val = v + a; break; case 2: val = v + b; break; case 3: val = v + ((a + b) >> 1); break; case 4: val = v + paeth(a, b, c); break; default: throw new Error("filter " + f); }
      line[y * stride + x] = val & 0xff;
    }
  }
  // normalize to RGBA
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++) {
    out[j++] = line[i * src]; out[j++] = line[i * src + 1]; out[j++] = line[i * src + 2]; out[j++] = src === 4 ? line[i * src + 3] : 255;
  }
  return { width: w, height: h, data: out };
}

// ---------- encode ----------
function encodePNG(w, h, data, channels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  const stride = w * channels, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- ops ----------
function bbox(d, w, h) { let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; }
function crop(d, w, bb) { const cw = bb.x1 - bb.x0 + 1, ch = bb.y1 - bb.y0 + 1, out = Buffer.alloc(cw * ch * 4); for (let y = 0; y < ch; y++) d.copy(out, y * cw * 4, ((bb.y0 + y) * w + bb.x0) * 4, ((bb.y0 + y) * w + bb.x0) * 4 + cw * 4); return { data: out, width: cw, height: ch }; }
function resize(s, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) * sh / dh - 0.5, y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(sh - 1, y0 + 1), fy = Math.min(1, Math.max(0, sy - y0));
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) * sw / dw - 0.5, x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(sw - 1, x0 + 1), fx = Math.min(1, Math.max(0, sx - x0));
      for (let c = 0; c < 4; c++) {
        const a = s[(y0 * sw + x0) * 4 + c], b = s[(y0 * sw + x1) * 4 + c], cc = s[(y1 * sw + x0) * 4 + c], d2 = s[(y1 * sw + x1) * 4 + c];
        out[(y * dw + x) * 4 + c] = Math.round((a + (b - a) * fx) + ((cc + (d2 - cc) * fx) - (a + (b - a) * fx)) * fy);
      }
    }
  }
  return { data: out, width: dw, height: dh };
}

// Some AI "transparent" PNGs leave the eye whites/highlights see-through, so a
// colored background bleeds through the eyes. Flood-fill from the border to find
// the true outside, then composite any *enclosed* see-through pixels over white.
function fillHoles(d, w, h) {
  const TH = 200, ext = new Uint8Array(w * h), st = [];
  const isT = (i) => d[i * 4 + 3] < TH;
  const push = (i) => { if (isT(i) && !ext[i]) { ext[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
  for (let i = 0; i < w * h; i++) { const a = d[i * 4 + 3]; if (a < 255 && !ext[i]) { const f = a / 255; d[i * 4] = Math.round(d[i * 4] * f + 255 * (1 - f)); d[i * 4 + 1] = Math.round(d[i * 4 + 1] * f + 255 * (1 - f)); d[i * 4 + 2] = Math.round(d[i * 4 + 2] * f + 255 * (1 - f)); d[i * 4 + 3] = 255; } }
}

// isolate head + mane: crop to the alpha bbox, then cut at the "neck" — the row
// below the widest mane where the opaque width pinches in before the body.
function headCrop(src) {
  const { data: d, width: w } = src;
  const bb = bbox(d, w, src.height);
  let maxW = 1, maxRow = bb.y0; const rowW = [];
  for (let y = bb.y0; y <= bb.y1; y++) {
    let lo = -1, hi = -1;
    for (let x = bb.x0; x <= bb.x1; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (lo < 0) lo = x; hi = x; }
    const ww = hi < 0 ? 0 : hi - lo + 1; rowW.push(ww); if (ww > maxW) { maxW = ww; maxRow = y; }
  }
  let neck = bb.y1;
  for (let y = maxRow; y <= bb.y1; y++) { if (rowW[y - bb.y0] < maxW * 0.6) { neck = y; break; } }
  const bottom = Math.min(bb.y1, neck + Math.round((neck - bb.y0) * 0.05));
  return crop(d, w, { x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bottom });
}

// transparent web character: tight-crop + fit into maxDim
function webChar(src, maxDim) {
  const bb = bbox(src.data, src.width, src.height), c = crop(src.data, src.width, bb);
  const scale = Math.min(1, maxDim / Math.max(c.width, c.height));
  const dw = Math.round(c.width * scale), dh = Math.round(c.height * scale);
  const r = resize(c.data, c.width, c.height, dw, dh);
  return { buf: encodePNG(dw, dh, r.data, 4), w: dw, h: dh };
}

// opaque icon: Leo's HEAD filling the frame (cover) on a blue gradient
function icon(head, size) {
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) { const t = y / size, r = Math.round(58 + (24 - 58) * t), g = Math.round(167 + (128 - 167) * t), b = Math.round(255 + (224 - 255) * t); for (let x = 0; x < size; x++) { const i = (y * size + x) * 3; out[i] = r; out[i + 1] = g; out[i + 2] = b; } }
  const scale = Math.max(size / head.width, size / head.height), dw = Math.round(head.width * scale), dh = Math.round(head.height * scale);
  const lion = resize(head.data, head.width, head.height, dw, dh).data;
  const ox = Math.round((size - dw) / 2), oy = Math.round((size - dh) / 2);
  for (let y = 0; y < dh; y++) { const py = oy + y; if (py < 0 || py >= size) continue; for (let x = 0; x < dw; x++) { const px = ox + x; if (px < 0 || px >= size) continue; const a = lion[(y * dw + x) * 4 + 3] / 255; if (a <= 0) continue; const di = (py * size + px) * 3, si = (y * dw + x) * 4; out[di] = Math.round(lion[si] * a + out[di] * (1 - a)); out[di + 1] = Math.round(lion[si + 1] * a + out[di + 1] * (1 - a)); out[di + 2] = Math.round(lion[si + 2] * a + out[di + 2] * (1 - a)); } }
  return encodePNG(size, size, out, 3);
}

const PUB = path.join(__dirname, "..", "public");
const COACH = path.join(PUB, "coach");
fs.mkdirSync(COACH, { recursive: true });

const frontSrc = process.argv[2] || (fs.existsSync("/tmp/leo_new.png") ? "/tmp/leo_new.png" : path.join(COACH, "leo.png"));
const waveSrc = process.argv[3] || (fs.existsSync("/tmp/leo1.png") ? "/tmp/leo1.png" : null);

const front = decodePNG(fs.readFileSync(frontSrc));
fillHoles(front.data, front.width, front.height); // fix see-through eyes
const leo = webChar(front, 512);
fs.writeFileSync(path.join(COACH, "leo.png"), leo.buf);
console.log("wrote coach/leo.png", leo.w + "x" + leo.h, leo.buf.length + "B");

if (waveSrc && fs.existsSync(waveSrc)) {
  const wv = decodePNG(fs.readFileSync(waveSrc));
  fillHoles(wv.data, wv.width, wv.height);
  const wave = webChar(wv, 512);
  fs.writeFileSync(path.join(COACH, "leo-wave.png"), wave.buf);
  console.log("wrote coach/leo-wave.png", wave.w + "x" + wave.h, wave.buf.length + "B");
}

// NOTE: the app icon is generated separately from the dedicated head art
// ("Leo - APP Icon") so it isn't overwritten here:  node scripts/gen-app-icon.js
