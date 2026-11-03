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

// Every letter at its own fractional width, as an iPhone lays text out,
// whatever the browser was started with (see launchOpts below, the first
// half of this): text-rendering:geometricPrecision turns font hinting off in
// Chromium. On every element, not inherited from <html>: Chromium's own
// stylesheet puts text-rendering back to auto on every button, and Home's
// cards are buttons. An adopted sheet, so no page sees a new <style> or a
// style attribute, there before any of the page's own script measures a line.
function unhintedText() {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("*{text-rendering:geometricPrecision !important}");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {}
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
      await context.addInitScript(unhintedText);
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
// Text is laid out the way an iPhone lays it out: every letter at its own
// fractional width (--font-render-hinting=none, and unhintedText above).
// CI's headless Chromium (Playwright 1.64's headless shell) snaps each
// letter to a whole pixel, about 5% wider at Home's sizes (Baloo 2 800 at
// 13 px: "Seed Launcher" 95 px, not 87), so a line or a game name wrapped
// there and nowhere else, and homestorytest's one-screen fit failed on main
// from 1 Nov 2026 while every local run passed (a headless shell run with
// --font-render-hinting=medium gives CI's numbers to the pixel). The full
// Chromium a cloud container uses already lays text out this way.
export function launchOpts(args) {
  const o = { args: ["--mute-audio", "--font-render-hinting=none", ...(args || [])] };
  if (exe) o.executablePath = exe;
  return o;
}
