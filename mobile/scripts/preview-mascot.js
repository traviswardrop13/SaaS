/* eslint-disable */
// Preview render for the Sona mascot lion. Renders a few mouth states to
// PNG so we can eyeball the design before porting it into the RN component.
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(os.tmpdir(), "sona-preview");
fs.mkdirSync(OUT, { recursive: true });

// Mouth shapes keyed by openness. Each returns SVG inside the muzzle area.
function mouth(open) {
  if (open === 0) {
    // Closed — gentle smile
    return `<path d="M150 178 Q176 196 202 178" stroke="#7c3a12" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  }
  const ry = open; // 8..26
  return `
    <ellipse cx="176" cy="184" rx="30" ry="${ry}" fill="#7c2d12"/>
    <ellipse cx="176" cy="${184 + ry * 0.35}" rx="20" ry="${Math.max(
      3,
      ry * 0.55,
    )}" fill="#fb6f92"/>
    <path d="M${176 - 30} 184 Q176 ${184 - ry} ${176 + 30} 184" fill="#fff" opacity="0.95"/>
  `;
}

function lion(open) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 352" width="352" height="352">
  <!-- MANE: outer scalloped ring -->
  <g>
    ${Array.from({ length: 14 })
      .map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const cx = 176 + Math.cos(a) * 132;
        const cy = 168 + Math.sin(a) * 132;
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(
          1,
        )}" r="34" fill="#d9620a"/>`;
      })
      .join("")}
    <circle cx="176" cy="168" r="140" fill="#ef7c1a"/>
    <!-- inner mane scallops (lighter) -->
    ${Array.from({ length: 12 })
      .map((_, i) => {
        const a = (i / 12) * Math.PI * 2 + 0.26;
        const cx = 176 + Math.cos(a) * 104;
        const cy = 168 + Math.sin(a) * 104;
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(
          1,
        )}" r="26" fill="#f59e0b"/>`;
      })
      .join("")}
  </g>

  <!-- EARS -->
  <circle cx="96" cy="92" r="26" fill="#f4b942"/>
  <circle cx="256" cy="92" r="26" fill="#f4b942"/>
  <circle cx="96" cy="92" r="13" fill="#e07b39"/>
  <circle cx="256" cy="92" r="13" fill="#e07b39"/>

  <!-- FACE -->
  <circle cx="176" cy="168" r="98" fill="#ffe7a8"/>

  <!-- CHEEK BLUSH -->
  <ellipse cx="104" cy="186" rx="22" ry="14" fill="#ffb3a7" opacity="0.75"/>
  <ellipse cx="248" cy="186" rx="22" ry="14" fill="#ffb3a7" opacity="0.75"/>

  <!-- EYES -->
  <g>
    <ellipse cx="138" cy="146" rx="24" ry="28" fill="#ffffff"/>
    <ellipse cx="214" cy="146" rx="24" ry="28" fill="#ffffff"/>
    <circle cx="142" cy="150" r="13" fill="#2b2118"/>
    <circle cx="210" cy="150" r="13" fill="#2b2118"/>
    <circle cx="146" cy="145" r="4.5" fill="#ffffff"/>
    <circle cx="214" cy="145" r="4.5" fill="#ffffff"/>
  </g>
  <!-- brows -->
  <path d="M120 116 Q138 106 158 114" stroke="#b45309" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M194 114 Q214 106 232 116" stroke="#b45309" stroke-width="7" fill="none" stroke-linecap="round"/>

  <!-- MUZZLE -->
  <ellipse cx="176" cy="196" rx="66" ry="52" fill="#fff4d6"/>
  <!-- nose -->
  <path d="M160 168 Q176 160 192 168 Q188 182 176 186 Q164 182 160 168 Z" fill="#7c3a12"/>
  <path d="M176 186 L176 198" stroke="#7c3a12" stroke-width="5" stroke-linecap="round"/>

  <!-- MOUTH -->
  ${mouth(open)}
</svg>`;
}

async function main() {
  const states = { closed: 0, mid: 14, open: 24 };
  for (const [name, v] of Object.entries(states)) {
    await sharp(Buffer.from(lion(v)))
      .resize(352, 352, { background: "#ffffff" })
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
