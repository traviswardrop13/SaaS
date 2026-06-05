/* eslint-disable */
// Preview render for the Sona mascot. This matches the ORIGINAL logo
// (assets/splash.svg) exactly and only adds an animated mouth for the
// "talking" state. Renders states to PNG so we can verify before shipping.
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(os.tmpdir(), "sona-preview");
fs.mkdirSync(OUT, { recursive: true });

const MANE = [
  [240, 0], [208, 120], [120, 208], [0, 240], [-120, 208], [-208, 120],
  [-240, 0], [-208, -120], [-120, -208], [0, -240], [120, -208], [208, -120],
];

function mouth(open) {
  if (open === 0) {
    return `<path d="M-43 73 Q0 112 43 73" stroke="#7c2d12" stroke-width="9" stroke-linecap="round" fill="none"/>`;
  }
  const ry = open; // 6..24
  return `
    <ellipse cx="0" cy="82" rx="34" ry="${ry}" fill="#7c2d12"/>
    <ellipse cx="0" cy="${82 + ry * 0.4}" rx="22" ry="${Math.max(
      3,
      ry * 0.5,
    )}" fill="#fb7185"/>`;
}

function lion(open) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-256 -256 512 512" width="352" height="352">
  <circle r="240" fill="#ea580c"/>
  <g fill="#c2410c">
    ${MANE.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="38"/>`).join("")}
  </g>
  <circle r="172" fill="#fef3c7"/>
  <ellipse cx="-99" cy="40" rx="30" ry="19" fill="#fbcfe8"/>
  <ellipse cx="99" cy="40" rx="30" ry="19" fill="#fbcfe8"/>
  <circle cx="-62" cy="-30" r="21" fill="#1f2937"/>
  <circle cx="62" cy="-30" r="21" fill="#1f2937"/>
  <circle cx="-56" cy="-38" r="8" fill="#ffffff"/>
  <circle cx="69" cy="-38" r="8" fill="#ffffff"/>
  <path d="M-14 19 L14 19 L0 43 Z" fill="#c2410c"/>
  ${mouth(open)}
</svg>`;
}

async function main() {
  const states = { closed: 0, mid: 12, open: 22 };
  for (const [name, v] of Object.entries(states)) {
    await sharp(Buffer.from(lion(v)))
      .flatten({ background: "#ffffff" })
      .png()
      .toFile(path.join(OUT, `lion-${name}.png`));
  }
  console.log("rendered to", OUT);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
