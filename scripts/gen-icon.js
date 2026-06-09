/**
 * Generates the Sona app icon as PNGs (no native deps — hand-rolled encoder).
 *
 * A clean, friendly Leo on a blue gradient — deliberately NOT the old spiky
 * "sun" lion. This is an interim mark; drop real Leo art over the same files
 * (apple-touch-icon.png 180, icon-192.png, icon-512.png) to replace it.
 *
 *   node scripts/gen-icon.js
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

// ---- tiny PNG encoder (RGB, 8-bit) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit, RGB
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- draw Leo, supersampled for smooth edges ----
const BLUE_TOP = [58, 167, 255], BLUE_BOT = [24, 128, 224];
const ORANGE = [255, 138, 61], CREAM = [255, 231, 194], DARK = [40, 30, 22], NOSE = [120, 74, 50], PINK = [247, 179, 163];
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

function colorAt(nx, ny) {
  // base gradient
  let col = [lerp(BLUE_TOP[0], BLUE_BOT[0], ny), lerp(BLUE_TOP[1], BLUE_BOT[1], ny), lerp(BLUE_TOP[2], BLUE_BOT[2], ny)];
  // ears (orange) + inner ear (cream)
  for (const ex of [0.30, 0.70]) { if (dist(nx, ny, ex, 0.32) < 0.105) col = ORANGE.slice(); }
  // mane (orange, smooth circle)
  if (dist(nx, ny, 0.5, 0.55) < 0.37) col = ORANGE.slice();
  for (const ex of [0.30, 0.70]) { if (dist(nx, ny, ex, 0.32) < 0.052) col = CREAM.slice(); }
  // face (cream)
  if (dist(nx, ny, 0.5, 0.57) < 0.285) col = CREAM.slice();
  // cheeks
  for (const cx of [0.36, 0.64]) { if (dist(nx, ny, cx, 0.63) < 0.05) col = [lerp(col[0], PINK[0], .6), lerp(col[1], PINK[1], .6), lerp(col[2], PINK[2], .6)]; }
  // eyes
  for (const cx of [0.41, 0.59]) { if (dist(nx, ny, cx, 0.55) < 0.032) col = DARK.slice(); }
  // nose (rounded triangle-ish: small circle + point)
  if (dist(nx, ny, 0.5, 0.62) < 0.035) col = NOSE.slice();
  if (ny > 0.62 && ny < 0.69 && Math.abs(nx - 0.5) < (0.69 - ny) * 0.6) col = NOSE.slice();
  // little smile
  const sm = dist(nx, ny, 0.5, 0.60);
  if (sm > 0.10 && sm < 0.118 && ny > 0.66) col = NOSE.slice();
  return col;
}

function render(size, ss = 3) {
  const W = size * ss, out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = colorAt((x * ss + sx + 0.5) / W, (y * ss + sy + 0.5) / W);
        r += c[0]; g += c[1]; b += c[2];
      }
      const n = ss * ss, i = (y * size + x) * 3;
      out[i] = Math.round(r / n); out[i + 1] = Math.round(g / n); out[i + 2] = Math.round(b / n);
    }
  }
  return out;
}

const PUB = path.join(__dirname, "..", "public");
[[180, "apple-touch-icon.png"], [192, "icon-192.png"], [512, "icon-512.png"]].forEach(([sz, name]) => {
  fs.writeFileSync(path.join(PUB, name), encodePNG(sz, render(sz)));
  console.log("wrote", name, sz + "x" + sz);
});
