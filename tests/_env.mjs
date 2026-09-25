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

// Mute native speech explicitly as well as Chromium media output.
// Keep native utterance timing/events, but make every test utterance silent.
// This remains writable so suites can install their own speech spies afterward.
function muteTestSpeech() {
  const synth = window.speechSynthesis;
  if (!synth || typeof synth.speak !== "function") return;
  const speak = synth.speak;
  synth.speak = function (utterance) {
    if (utterance) utterance.volume = 0;
    return speak.call(this, utterance);
  };
}

// Install before a context is handed to a suite, not from a late page event.
// Playwright's browser.newPage() delegates to this public newContext() method,
// so its owned-context cleanup stays intact and both creation paths are quiet.
const launchChromium = chromium.launch.bind(chromium);
chromium.launch = async function (options) {
  const browser = await launchChromium(options);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async function (options) {
    const context = await newContext(options);
    try {
      await context.addInitScript(muteTestSpeech);
    } catch (error) {
      // Never return an unprotected context if installing the mute failed.
      try { await context.close(); } catch {}
      throw error;
    }
    return context;
  };
  return browser;
};

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
export const OUT = process.env.TEST_OUT || tmpdir(); // screenshots land here, never in the repo

const exe = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
export function launchOpts(args) {
  const o = { args: ["--mute-audio", ...(args || [])] };
  if (exe) o.executablePath = exe;
  return o;
}
