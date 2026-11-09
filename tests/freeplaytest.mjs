// FREEPLAY1: one free round of Fruit Slice before the price (2 Nov 2026).
//
// Travis: "its cuz they wanto to try it first so lets come up with something
// where they get a free session", then "lets make day 1 just be a game like
// fruit slice ... no charge up just str8 to the game", and, since the parent
// most likely plays it first, no hand-off screens. Built switched OFF
// (FREE_PLAY_ON in sona.js); this suite turns it on for its own tabs through
// the test seam (sessionStorage "sona.freeplayon", honoured on a test server
// only) and plays, on the real pages:
//   - setup's ready screen goes on to the microphone, not the price;
//   - the microphone goes straight into Fruit Slice: no hand-off card, no
//     "Say it 5 times" page, and the household's one free round is spent;
//   - the round is a real round, and its end card has one button, "Keep
//     playing!", to the price (no "Back home": Home is locked); the ✕ goes
//     there too;
//   - the price's "Not now" goes Home, locked; a purchase goes Home, open;
//   - the round comes once per household: a second setup goes to the price;
//   - a phone that cannot buy, and a switch that is off, are as before;
//   - the stamp never travels in a backup, either way.
import fs from "node:fs";
import { chromium, launchOpts } from "./_env.mjs";
import { serve, open, calm, setupWalk } from "./_phone.mjs";

const { base, close } = await serve();
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, detail = "") { assertions++; if (!pass) failures++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail))); }
async function scenario(name, fn) { try { await fn(); } catch (e) { ok(name + " has no harness/page exception", false, String(e && e.stack || e).split("\n").slice(0, 4).join(" | ")); } }

const SRC = fs.readFileSync(new URL("../public/sona.js", import.meta.url), "utf8");
const SWITCH = /\n  const FREE_PLAY_ON = (true|false);/.exec(SRC);
ok("sona.js has one switch for the free round, FREE_PLAY_ON", !!SWITCH);
const LIVE = SWITCH && SWITCH[1] === "true";

const tap = async (page, sel) => { await calm(page); await page.locator(sel).click(); };
const text = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; }, sel);
const asked = (requests, re) => requests.some((r) => re.test(new URL(r.url).pathname));
async function phoneOn(cfg) {
  const o = await open(browser, base, cfg);
  await o.context.addInitScript(() => { try { sessionStorage.setItem("sona.freeplayon", "1"); } catch (e) {} });
  return o;
}
// a new family's setup to the microphone, then the microphone's own button
async function toGame(page) {
  await page.goto(base + "/onboarding.html");
  await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
  const seen = await setupWalk(page, "mic", { name: "Mia", age: "6" });
  await tap(page, "#nextBtn");                        // "Turn on Echo's ears"
  await page.waitForURL(/\/arcade-slice\.html\?from=charge$/, { timeout: 12000 });
  await page.waitForFunction(() => typeof window.endRound === "function");
  return seen;
}

await scenario("a family that can buy, with the free round on", async () => {
  const { context, page, errors, requests } = await phoneOn({ app: "buy", mic: "grant" });
  try {
    const seen = await toGame(page);
    ok("setup goes from the ready screen to the microphone, never to the price, and shows no hand-off card",
      seen.includes("ready") && seen[seen.length - 1] === "mic" && !seen.includes("achieve") && !asked(requests, /^\/subscribe\.html$/), seen);
    ok("the microphone opens Fruit Slice itself: no \"Say it 5 times\" page in front of it",
      !asked(requests, /^\/charge\.html$/), requests.filter((r) => /charge/.test(r.url)).map((r) => r.url));
    const st = await page.evaluate(() => ({ need: document.getElementById("needOvl").classList.contains("show"), free: FREEPLAY, used: localStorage.getItem("sona.freeplay.v1") || "", due: Sona.freePlayDue(), locked: !Sona.gameAccess("slice").allowed, trial: Sona.trialFirst() }));
    ok("the round plays (no ticket card), the household's one free round is spent as it opens, and nothing else opens: Fruit Slice alone stays locked outside this round",
      !st.need && st.free && /^used:\d+$/.test(st.used) && !st.due && st.locked && st.trial, st);
    await page.evaluate(() => endRound());
    await page.locator("#endOvl.show").waitFor();
    const card = await page.evaluate(() => ({ btn: document.getElementById("endCharge").textContent, btnShown: getComputedStyle(document.getElementById("endCharge")).display !== "none", home: getComputedStyle(document.getElementById("endHome")).display, again: getComputedStyle(document.getElementById("endAgain")).display }));
    ok("its end card has one button, \"Keep playing!\", and no \"Back home\" or \"Play again\"",
      card.btn === "Keep playing!" && card.btnShown && card.home === "none" && card.again === "none", card);
    await tap(page, "#endCharge");
    await page.waitForURL(/\/subscribe\.html\?setup=1$/, { timeout: 12000 });
    await page.locator("#iapBuy").waitFor({ state: "visible", timeout: 8000 });
    ok("\"Keep playing!\" opens the price as setup's offer, with no grown-ups check in between",
      await page.evaluate(() => document.body.classList.contains("offer") && !document.getElementById("gateOvl")), page.url());
    await tap(page, "#iapBuy");
    await page.waitForURL(/\/today\.html$/, { timeout: 12000 });
    ok("a purchase there goes Home (the microphone was asked already), with Fruit Slice open",
      await page.evaluate(() => Sona.gameAccess("slice").allowed && !Sona.trialFirst()), page.url());
    ok("no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("the free round's ✕, then Not now", async () => {
  const { context, page, errors } = await phoneOn({ app: "buy", mic: "grant" });
  try {
    await toGame(page);
    await tap(page, "#close");
    await page.waitForURL(/\/subscribe\.html\?setup=1$/, { timeout: 12000 });
    ok("the ✕ during the free round goes to the price, not to a locked Home", true);
    await page.locator("#declineLink").waitFor({ state: "visible", timeout: 6000 });
    await tap(page, "#declineLink");
    await page.waitForURL(/\/today\.html$/, { timeout: 12000 });
    ok("Not now goes Home, where Fruit Slice is locked again",
      await page.evaluate(() => !Sona.gameAccess("slice").allowed && Sona.trialFirst() && !Sona.freePlayActive("slice")));
    // the round comes once: the address again, in this tab, is no free round
    await page.goto(base + "/arcade-slice.html?from=charge");
    await page.waitForFunction(() => !/arcade-slice/.test(location.pathname) || (document.getElementById("needOvl") && document.getElementById("needOvl").classList.contains("show")), null, { timeout: 8000 });
    ok("the game's address afterwards plays nothing: no second free round",
      await page.evaluate(() => !/arcade-slice/.test(location.pathname) || document.getElementById("needOvl").classList.contains("show")), page.url());
    // …and a second setup on this phone goes to the price, as before
    await page.goto(base + "/onboarding.html");
    await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
    ok("with the round spent, nothing is due any more", await page.evaluate(() => Sona.freePlayDue() === false && Sona.freePlayStart() === null));
    ok("✕ and Not now: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("a phone that cannot buy, with the free round on", async () => {
  const { context, page, errors, requests } = await phoneOn({ mic: "grant" });   // a browser: the website does not sell
  try {
    await page.goto(base + "/onboarding.html");
    await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
    await setupWalk(page, "mic", { name: "Zoe", age: "6" });
    await tap(page, "#nextBtn");
    await page.locator('[data-step="achieve"].on, .ob-achieve.on, #handoffTitle').first().waitFor({ state: "visible", timeout: 8000 });
    ok("nothing is owed, so nothing changes: the hand-off card as before, and no free round spent",
      await page.evaluate(() => !localStorage.getItem("sona.freeplay.v1") && Sona.freePlayDue() === false) && !asked(requests, /^\/arcade-slice\.html$/));
    ok("cannot buy: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

if (!LIVE) await scenario("the switch off (as it ships)", async () => {
  const { context, page, errors, requests } = await open(browser, base, { app: "buy", mic: "grant" });
  try {
    await page.goto(base + "/onboarding.html");
    await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
    ok("off, no free round is ever due", await page.evaluate(() => Sona.freePlayOn() === false && Sona.freePlayDue() === false && Sona.freePlayStart() === null));
    await setupWalk(page, "ready", { name: "Ben", age: "6" });
    await tap(page, "#nextBtn");
    await page.waitForURL(/\/subscribe\.html\?setup=1$/, { timeout: 12000 });
    ok("off, setup's ready screen goes to the price, exactly as before", !asked(requests, /^\/arcade-slice\.html$/));
    ok("off: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

await scenario("a backup never carries the round", async () => {
  const { context, page } = await phoneOn({ app: "buy" });
  try {
    await page.goto(base + "/today.html");
    await page.waitForFunction(() => window.Sona);
    const r = await page.evaluate(() => {
      localStorage.setItem("sona.freeplay.v1", "used:1");
      const out = JSON.parse(Sona.exportString ? Sona.exportString() : JSON.stringify(Sona.exportData()));
      const has = JSON.stringify(out).indexOf("sona.freeplay.v1") !== -1;
      localStorage.removeItem("sona.freeplay.v1");
      const data = out.data || out;
      data["sona.freeplay.v1"] = "used:1";
      try { Sona.importData(out); } catch (e) {}
      return { has, after: localStorage.getItem("sona.freeplay.v1") };
    });
    ok("the spent stamp is left out of a backup, and a backup cannot bring one", !r.has && !r.after, r);
  } finally { await context.close(); }
});

await browser.close(); close();
console.log(`\n${assertions - failures}/${assertions} passed`);
process.exit(failures ? 1 : 0);
