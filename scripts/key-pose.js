/**
 * Key a flat-background character PNG to transparency and size it for the app.
 *   node scripts/key-pose.js <in.png> <out.png> [maxPx=1100]
 * Same flood-fill chroma-key as gen-app-icon.js (samples corners, eats inward,
 * anti-aliased edges, un-mixes the bg tint), then crops and area-downscales.
 */
const fs = require("fs");
const zlib = require("zlib");

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
function encodePNG(w, h, data) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; const stride = w * 4, raw = Buffer.alloc((stride + 1) * h); for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); } return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]); }
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
function keyOutBackground(d, w, h) {
  const sample = (x, y) => [d[(y * w + x) * 4], d[(y * w + x) * 4 + 1], d[(y * w + x) * 4 + 2]];
  const cs = [sample(1, 1), sample(w - 2, 1), sample(1, h - 2), sample(w - 2, h - 2)];
  const bg = [0, 1, 2].map((k) => Math.round(cs.reduce((s, c) => s + c[k], 0) / cs.length));
  const dist = (i) => Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]);
  const TLOW = 26, THIGH = 130;
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
    for (let c = 0; c < 3; c++) { let v = (d[i * 4 + c] - bg[c] * (1 - a)) / a; d[i * 4 + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
    d[i * 4 + 3] = Math.round(a * 255);
  }
}

const [inPath, outPath, maxArg] = process.argv.slice(2);
if (!inPath || !outPath) { console.error("usage: node scripts/key-pose.js <in.png> <out.png> [maxPx]"); process.exit(1); }
const MAX = parseInt(maxArg, 10) || 1100;
const src = decodePNG(fs.readFileSync(inPath));
keyOutBackground(src.data, src.width, src.height);
const head = crop(src.data, src.width, bbox(src.data, src.width, src.height));
const m = Math.min(1, MAX / Math.max(head.width, head.height));
const fin = m < 1 ? resizeArea(head.data, head.width, head.height, Math.round(head.width * m), Math.round(head.height * m)) : head;
fs.writeFileSync(outPath, encodePNG(fin.width, fin.height, fin.data));
console.log("wrote", outPath, fin.width + "x" + fin.height);
