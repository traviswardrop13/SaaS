/* eslint-disable */
/**
 * Rasterizes the SVG sources in assets/ into the PNGs Expo expects:
 *   icon.png          1024 x 1024 (square, no transparency — iOS)
 *   adaptive-icon.png 1024 x 1024 (foreground for Android adaptive icon)
 *   splash.png        1242 x 2688 (centered, on white)
 *   favicon.png         48 x 48   (Expo web)
 *
 * Re-run after editing the .svg files:
 *   node scripts/generate-assets.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ASSETS = path.join(__dirname, "..", "assets");
const read = (name) => fs.readFileSync(path.join(ASSETS, name));
const write = (svg, out, w, h, opts = {}) =>
  sharp(svg)
    .resize(w, h, { fit: "contain", background: opts.background ?? "#ffffff00" })
    .png()
    .toFile(path.join(ASSETS, out))
    .then(() => console.log("wrote", out));

async function main() {
  await write(read("icon.svg"), "icon.png", 1024, 1024, {
    background: "#f97316",
  });
  await write(read("adaptive-icon.svg"), "adaptive-icon.png", 1024, 1024);
  await write(read("splash.svg"), "splash.png", 1242, 2688, {
    background: "#ffffff",
  });
  await write(read("icon.svg"), "favicon.png", 48, 48, {
    background: "#f97316",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
