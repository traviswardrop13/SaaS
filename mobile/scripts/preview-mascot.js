/* eslint-disable */
// Preview render for the Sona mascot in every mood + the talking state.
// Mirrors components/TalkingFace.tsx so we can eyeball expressions before
// they ship. Renders to a temp dir.
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

const smile = `<path d="M-43 73 Q0 112 43 73" stroke="#7c2d12" stroke-width="9" stroke-linecap="round" fill="none"/>`;

function eyes(mood) {
  if (mood === "happy" || mood === "celebrate") {
    return `
      <path d="M-84 -34 Q-62 -58 -40 -34" stroke="#1f2937" stroke-width="11" stroke-linecap="round" fill="none"/>
      <path d="M40 -34 Q62 -58 84 -34" stroke="#1f2937" stroke-width="11" stroke-linecap="round" fill="none"/>`;
  }
  const cy = mood === "sad" ? -24 : -30;
  const hy = mood === "sad" ? -32 : -38;
  const brows =
    mood === "sad"
      ? `<path d="M-84 -52 Q-62 -60 -44 -50" stroke="#b45309" stroke-width="8" stroke-linecap="round" fill="none"/>
         <path d="M44 -50 Q62 -60 84 -52" stroke="#b45309" stroke-width="8" stroke-linecap="round" fill="none"/>`
      : "";
  return `
    <circle cx="-62" cy="${cy}" r="21" fill="#1f2937"/>
    <circle cx="62" cy="${cy}" r="21" fill="#1f2937"/>
    <circle cx="-56" cy="${hy}" r="8" fill="#ffffff"/>
    <circle cx="69" cy="${hy}" r="8" fill="#ffffff"/>
    ${brows}`;
}

function mouth(mood) {
  if (mood === "happy" || mood === "celebrate") {
    return `<path d="M-52 66 Q0 140 52 66 Z" fill="#7c2d12"/><path d="M-30 96 Q0 124 30 96 Z" fill="#fb7185"/>`;
  }
  if (mood === "sad") {
    return `<path d="M-36 96 Q0 72 36 96" stroke="#7c2d12" stroke-width="9" stroke-linecap="round" fill="none"/>`;
  }
  return smile;
}

function lion(mood) {
  const cheekRx = mood === "celebrate" ? 34 : 30;
  const cheekRy = mood === "celebrate" ? 22 : 19;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-256 -256 512 512" width="300" height="300">
  <circle r="240" fill="#ea580c"/>
  <g fill="#c2410c">${MANE.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="38"/>`).join("")}</g>
  <circle r="172" fill="#fef3c7"/>
  <ellipse cx="-99" cy="40" rx="${cheekRx}" ry="${cheekRy}" fill="#fbcfe8"/>
  <ellipse cx="99" cy="40" rx="${cheekRx}" ry="${cheekRy}" fill="#fbcfe8"/>
  ${eyes(mood)}
  <path d="M-14 19 L14 19 L0 43 Z" fill="#c2410c"/>
  ${mouth(mood)}
</svg>`;
}

async function main() {
  const moods = ["neutral", "happy", "celebrate", "encourage", "sad"];
  const files = [];
  for (const m of moods) {
    const f = path.join(OUT, `mood-${m}.png`);
    await sharp(Buffer.from(lion(m))).flatten({ background: "#ffffff" }).png().toFile(f);
    files.push(f);
  }
  // Contact sheet
  const sheet = path.join(OUT, "moods.png");
  await sharp({
    create: { width: 300 * moods.length, height: 300, channels: 3, background: "#ffffff" },
  })
    .composite(files.map((f, i) => ({ input: f, left: i * 300, top: 0 })))
    .png()
    .toFile(sheet);
  console.log("rendered moods:", files.join(", "));
  console.log("sheet:", sheet);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
