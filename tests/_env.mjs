// Shared test environment. Works in two worlds:
//   - CI: `npm i --no-save playwright && npx playwright install chromium`,
//     then playwright resolves from node_modules and uses its own chromium.
//   - Claude Code cloud containers: playwright lives at a global path and
//     chromium is pre-installed at /opt/pw-browsers/chromium.
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import path from "path";

const pw = await (async () => {
  try { return await import("playwright"); }
  catch { return await import("/opt/node22/lib/node_modules/playwright/index.mjs"); }
})();
export const chromium = pw.chromium;

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
export const OUT = process.env.TEST_OUT || tmpdir(); // screenshots land here, never in the repo

const exe = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
export function launchOpts(args) {
  const o = { args: args || [] };
  if (exe) o.executablePath = exe;
  return o;
}
