// Runs every suite in order; exits nonzero if any fails.
// Locally: `node tests/run-all.mjs` (needs playwright — see _env.mjs).
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [
  "momweek.mjs",   // parent weekly goal + streak math + the three UIs
  "betatest.mjs",  // onboarding flow + beta pulse + founding banner
  "calltest.mjs",  // Coach Call script variants + weekly cap (dev-gated)
  "packtest.mjs",  // call memory, wins card, buddy sprites, adventure tile
  "voicetest3.mjs",// TTS line composition + syllable card rotation
  "progtest.mjs",  // sound rotation + ladder cap + daily goal ring
  "shapetest.mjs", // sound-shape gate vs real recorded sounds
  "checktest.mjs", // Sound Check → plan loop + parent card
  "gatecheck.mjs", // parent-gate hardening on adult-only pages
  "fittest.mjs",   // device-matrix fit: SE→Pro Max, zoomed display, landscape
];

let bad = 0;
for (const s of SUITES) {
  console.log("\n━━━ " + s + " ━━━");
  const r = spawnSync(process.execPath, [path.join(dir, s)], { stdio: "inherit", timeout: 300000 });
  if (r.status !== 0) { bad++; console.log("SUITE FAILED: " + s + (r.signal ? " (" + r.signal + ")" : "")); }
}
console.log(bad ? "\n" + bad + " SUITE(S) FAILED" : "\nALL SUITES GREEN");
process.exit(bad ? 1 : 0);
