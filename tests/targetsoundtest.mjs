// A family may pin one of its selected sounds without erasing the other
// sounds, earned work or its speech therapist's assignment. The shelf follows
// that sound, and the other books remain behind its one closed fold.
// TARGET_SOUND_OLD_ROOT serves saved pre-change files for the regression check.
import vm from "vm";
import { readFileSync, existsSync } from "fs";
import { createServer } from "http";
import path from "path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0;
const ok = (name, pass, detail) => { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + JSON.stringify(detail || ""))); };
const source = (name) => readFileSync(name === "today.html" && process.env.TARGET_SOUND_HOME_SOURCE ? process.env.TARGET_SOUND_HOME_SOURCE : process.env.TARGET_SOUND_OLD_ROOT && existsSync(path.join(process.env.TARGET_SOUND_OLD_ROOT, name)) ? path.join(process.env.TARGET_SOUND_OLD_ROOT, name) : path.join(ROOT, name), "utf8");
function boot(profile = {}, local) {
  local = local || {};
  const noop = () => {}, session = {};
  const store = (data) => ({ getItem: (k) => k in data ? data[k] : null, setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; }, key: (i) => Object.keys(data)[i] || null, get length() { return Object.keys(data).length; } });
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [] });
  if (!local["sona.profile.v1"]) {
    ["", "2", "3", "4", "5"].forEach((n) => { local["sona.freeera" + n + ".v1"] = n ? "done" : "post"; });
    local["sona.freever.v1"] = "kept"; local["sona.buddyset.v1"] = "post";
    local["sona.profile.v1"] = JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R", "S"], onboarded: true, volume: 0 }, profile));
  }
  const ctx = { localStorage: store(local), sessionStorage: store(session), console, setTimeout, clearTimeout, setInterval, clearInterval,
    document: { hidden: true, addEventListener: noop, removeEventListener: noop, createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: el(), head: el(), documentElement: el(), cookie: "", visibilityState: "hidden", referrer: "" },
    navigator: { userAgent: "node", mediaDevices: {} }, location: { href: "http://x/charge.html", pathname: "/charge.html", search: "", hash: "", hostname: "x", origin: "http://x", replace: noop },
    addEventListener: noop, removeEventListener: noop, history: { replaceState: noop }, matchMedia: () => ({ matches: false, addEventListener: noop }), fetch: () => Promise.reject(new Error("offline")) };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(source("sona.js"), ctx, { filename: "sona.js" });
  return { S: ctx.Sona, local, session };
}
function section(name, fn) { try { fn(); } catch (e) { ok(name + " runs", false, e.message); } }
section("shared target", () => {
  const p = boot(), { S, local } = p;
  ok("shared target readers and explicit writer exist", [S.targetSound, S.targetSoundOptions, S.setTargetSound].every((x) => typeof x === "function"));
  if (!S.targetSound) return;
  local["sona.rotation.v1"] = JSON.stringify({ i: 1, r: 2 });
  const before = JSON.stringify(local);
  ok("an unpinned existing child retains their current rotation", S.targetSound() === "S" && S.rotSound() === "S");
  S.targetSoundOptions(); S.targetSound();
  ok("reading the target saves nothing", JSON.stringify(local) === before);
  local["sona.progress.v1"] = JSON.stringify({ ladderV: 2, stage: { R: 2 }, totals: { sessions: 4, coins: 23 } });
  const progress = local["sona.progress.v1"], rotation = local["sona.rotation.v1"];
  ok("an explicit choice pins the current sound for existing game readers", S.setTargetSound("r") && S.targetSound() === "R" && S.rotSound() === "R" && JSON.stringify(S.rotSounds()) === '["R"]');
  ok("choosing keeps the multi-sound set, earned progress and rotation record", JSON.stringify(S.getProfile().focusSounds) === '["R","S"]' && local["sona.progress.v1"] === progress && local["sona.rotation.v1"] === rotation);
  const pinned = JSON.stringify(local);
  ok("an unavailable sound cannot be selected or saved", !S.setTargetSound("TH") && !S.setTargetSound("X") && JSON.stringify(local) === pinned);
  const reloaded = boot({}, local);
  ok("the chosen sound survives a reload", reloaded.S.targetSound() === "R");
  ok("automatic rotation can be restored explicitly", S.setTargetSound("") && S.targetSound() === "S" && !S.getProfile().targetSound);
  S.setTargetSound("S"); S.saveProfile({ focusSounds: ["R"] });
  ok("removing a selected sound clears its pin safely", S.targetSound() === "R" && !S.getProfile().targetSound && !JSON.parse(local["sona.profile.v1"]).targetSound);
  S.saveProfile({ focusSounds: ["R", "S"] });
  ok("adding the sound later does not revive the old choice", !S.getProfile().targetSound);
});
section("homework and child boundaries", () => {
  const p = boot(), { S, local } = p;
  if (!S.setTargetSound) return ok("homework target API exists", false);
  S.setTargetSound("S");
  local["sona.homework.v1"] = JSON.stringify({ hw: { sounds: ["L"], start: "2000-01-01", due: "2999-01-01", pos: "f", repsPerDay: 10 } });
  const before = JSON.stringify(local);
  ok("an active assignment still wins, including outside the family's set", S.targetSound() === "L" && JSON.stringify(S.targetSoundOptions()) === '["L"]' && S.practicePos() === "f");
  ok("selection cannot appear to override the speech therapist", !S.setTargetSound("R") && !S.setTargetSound("") && JSON.stringify(local) === before);
  delete local["sona.homework.v1"];
  ok("the family choice returns once the assignment ends", S.targetSound() === "S");
  const slot = S.addKid("Ana", "5"); S.saveProfile({ focusSounds: ["K", "G"], onboarded: true }); S.setTargetSound("G");
  S.switchKid(""); const first = S.targetSound(); S.switchKid(slot); const second = S.targetSound();
  ok("siblings retain separate target sounds", first === "S" && second === "G");
  const backup = S.exportString();
  Object.keys(local).forEach((k) => { delete local[k]; });
  const restored = S.importData(backup); S.switchKid(""); const firstBack = S.targetSound(); S.switchKid(slot);
  ok("backup restores each child's own sound", restored.ok && firstBack === "S" && S.targetSound() === "G");
  const raw = JSON.parse(local[S.kkey("sona.profile.v1")]); raw.targetSound = "BAD"; local[S.kkey("sona.profile.v1")] = JSON.stringify(raw);
  const invalidBefore = JSON.stringify(local);
  ok("an invalid imported pin falls back without a read-time migration", S.targetSoundOptions().indexOf(S.targetSound()) >= 0 && !S.getProfile().targetSound && JSON.stringify(local) === invalidBefore);
});
section("invalid rotation and selected set", () => {
  const p = boot({ focusSounds: ["X", null, "s", "S", "R"], targetSound: "TH" });
  if (!p.S.targetSound) return ok("target selection handles imported sets", false);
  p.local["sona.rotation.v1"] = JSON.stringify({ i: 999, r: -3 });
  const before = JSON.stringify(p.local);
  ok("invalid and repeated imported sounds do not become target choices", JSON.stringify(p.S.targetSoundOptions()) === '["S","R"]');
  ok("an invalid rotation falls back to a valid target without writing", p.S.targetSound() === "S" && p.S.rotRound() === 0 && JSON.stringify(p.local) === before);
  const malformed = boot({ focusSounds: "R,S", targetSound: "S" });
  ok("a malformed imported sound list has a safe read-only fallback", malformed.S.targetSound() === "R" && malformed.S.targetSoundOptions().length === 0 && !malformed.S.getProfile().targetSound);
});

// Real pages: a shelf selected in Settings, every other book still reachable,
// and assignment wording that cannot suggest a family choice was applied.
const mime = { html: "text/html", js: "text/javascript", css: "text/css", webp: "image/webp", svg: "image/svg+xml", woff2: "font/woff2" };
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x"), name = u.pathname.slice(1), file = path.join(ROOT, name);
  if (!existsSync(file) || u.pathname.startsWith("/api/")) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": mime[path.extname(file).slice(1)] || "application/octet-stream" });
  res.end(["sona.js", "library.html", "settings.html", "today.html"].includes(name) ? source(name) : readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  browser = await chromium.launch(launchOpts());
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, reducedMotion: "reduce", timezoneId: "America/Boise" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (localStorage.getItem("__targetseed")) return;
    localStorage.setItem("__targetseed", "1");
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "post");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R", "S"], targetSound: "S", onboarded: true, earlyAdopter: true, volume: 0 }));
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  });
  await page.goto(base + "/library.html");
  const readShelf = () => page.evaluate(() => ({ top: [...document.querySelectorAll("#shelf .bookBtn .bt")].map((b) => b.textContent), target: document.getElementById("librarySound")?.value, more: document.getElementById("moreBtn")?.getAttribute("aria-expanded"), rest: document.querySelectorAll("#moreShelf .bookBtn").length, all: ALL_STORIES.map((b) => ({ title: b.title, sound: b.sound })) }));
  let shelf = await readShelf();
  ok("the bookshelf names the selected sound and shows only its books first", shelf.target === "S" && shelf.top.length > 0 && shelf.top.every((t) => shelf.all.find((b) => b.title === t).sound === "S"), shelf);
  if (process.env.TARGET_SOUND_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.TARGET_SOUND_SCREENSHOTS, "library-sound.png"), fullPage: true });
  ok("other sounds start closed and their covers are not built", shelf.more === "false" && shelf.rest === 0);
  await page.locator("#moreBtn").click();
  shelf = await readShelf();
  ok("one More books control retains the complete in-season catalog", shelf.more === "true" && shelf.rest + shelf.top.length === shelf.all.length);
  if (await page.locator("#librarySound").count()) {
    await page.waitForTimeout(750);
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator("#librarySound").selectOption("R")]); shelf = await readShelf();
    ok("changing the bookshelf sound saves it and rebuilds one focused shelf", shelf.target === "R" && shelf.top.every((t) => shelf.all.find((b) => b.title === t).sound === "R") && shelf.more === "false", shelf);
  } else ok("the bookshelf has a sound switcher", false);
  await page.evaluate(() => Sona.gateVerify());
  await page.goto(base + "/settings.html");
  if (await page.locator("#targetSound").count()) {
    if (process.env.TARGET_SOUND_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.TARGET_SOUND_SCREENSHOTS, "settings-sound.png"), fullPage: true });
    await page.locator("#targetSound").selectOption("S");
    ok("Settings changes the target without removing other sounds", await page.evaluate(() => Sona.targetSound() === "S" && Sona.getProfile().focusSounds.join(",") === "R,S"));
    await page.locator('#sounds [data-s="S"]').click();
    ok("removing the selected sound updates the target control", await page.evaluate(() => document.getElementById("targetSound").value === "" && /R/.test(document.getElementById("targetSound").selectedOptions[0].textContent) && Sona.targetSound() === "R" && !Sona.getProfile().targetSound));
  } else ok("Settings has a target sound control", false);
  await page.evaluate(() => localStorage.setItem(Sona.kkey("sona.homework.v1"), JSON.stringify({ hw: { sounds: ["L"], start: "2000-01-01", due: "2999-01-01" } })));
  await page.goto(base + "/library.html");
  ok("assigned books take precedence and cannot be switched away", await page.evaluate(() => document.getElementById("librarySound")?.value === "L" && document.getElementById("librarySound")?.disabled && /speech therapist/.test(document.getElementById("librarySoundNote")?.textContent || "")));
  await page.evaluate(() => { localStorage.removeItem(Sona.kkey("sona.homework.v1")); });
  await page.reload();
  await page.evaluate(() => { Sona.addKid("Ana", "7"); Sona.saveProfile({ focusSounds: ["R", "S"], targetSound: "S", onboarded: true }); });
  if (await page.locator("#librarySound").count()) {
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator("#librarySound").selectOption("R")]);
    ok("a shelf left open for another child cannot overwrite the child's choice", await page.evaluate(() => Sona.getProfile().childName === "Ana" && Sona.targetSound() === "S" && document.getElementById("librarySound").value === "S"));
  }
  const unpinnedProfile = await page.evaluate(() => { Sona.saveProfile({ targetSound: "" }); return localStorage.getItem(Sona.kkey("sona.profile.v1")); });
  await page.goto(base + "/today.html");
  await page.waitForSelector("#homeSound:not([hidden])");
  ok("opening Home shows Automatic separately without pinning or saving the current sound", await page.evaluate((before) => localStorage.getItem(Sona.kkey("sona.profile.v1")) === before && !Sona.getProfile().targetSound && document.getElementById("homeSound").value === "" && document.getElementById("homeSound").selectedOptions[0].textContent === "Auto" && document.getElementById("homeSound").getAttribute("aria-label") === "Target sound, automatic: " + Sona.soundLabel(Sona.targetSound()), unpinnedProfile));
  // Native type-ahead emits a real change only when the option changes.
  // selectOption emits one even for an already-selected R and hid the bug.
  // (Mac headless native selects ignore arrow keys, but type-ahead works.)
  async function chooseHomeByKey(key) {
    const moved = page.waitForNavigation({ waitUntil: "load", timeout: 2000 }).then(() => true, () => false);
    await page.locator("#homeSound").focus(); await page.keyboard.press(key);
    const changed = await moved;
    if (!changed) await page.reload();
    return changed;
  }
  const choseR = await chooseHomeByKey("r");
  ok("choosing the already-effective R from Automatic emits a real change and persists R", choseR && await page.evaluate(() => document.getElementById("homeSound").value === "R" && Sona.getProfile().targetSound === "R" && Sona.rotSound() === "R"));
  if (await page.locator('#homeSound option[value=""]').count()) {
    const choseAuto = await chooseHomeByKey("a");
    ok("Home's Automatic option clears the explicit pin and restores rotation", choseAuto && await page.evaluate(() => document.getElementById("homeSound").value === "" && !Sona.getProfile().targetSound && Sona.rotSounds().join(",") === "R,S"));
  } else ok("Home's Automatic option clears the explicit pin and restores rotation", false);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator("#homeSound").selectOption("S")]);
  ok("Home's R/S selector persists the chosen sound for books and games", await page.evaluate(() => document.getElementById("homeSound").value === "S" && Sona.getProfile().targetSound === "S" && Sona.rotSound() === "S"));
  await page.evaluate(() => localStorage.setItem(Sona.kkey("sona.homework.v1"), JSON.stringify({ hw: { sounds: ["L"], start: "2000-01-01", due: "2999-01-01" } })));
  await page.reload();
  ok("Home shows the assigned sound and disables family changes", await page.evaluate(() => document.getElementById("homeSound").disabled && document.getElementById("homeSound").value === "L" && /speech therapist/.test(document.getElementById("homeSound").title)));
  await page.evaluate(() => { localStorage.removeItem(Sona.kkey("sona.homework.v1")); });
  await page.reload();
  await page.evaluate(() => { Sona.addKid("Bea", "7"); Sona.saveProfile({ focusSounds: ["R", "S"], targetSound: "S", onboarded: true }); });
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator("#homeSound").selectOption("R")]);
  ok("a stale Home with the same available sounds cannot overwrite a sibling's choice", await page.evaluate(() => Sona.getProfile().childName === "Bea" && Sona.targetSound() === "S" && document.getElementById("homeSound").value === "S"));
  let safeTop = 0, safeBottom = 0;
  await context.route(/\.(html|css)$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/env\(safe-area-inset-top\)/g, safeTop + "px").replace(/env\(safe-area-inset-bottom\)/g, safeBottom + "px");
    await route.fulfill({ response, body });
  });
  await page.evaluate(() => { Sona.saveProfile({ focusSounds: ["THV", "R"], targetSound: "" }); localStorage.setItem(Sona.kkey("sona.rotation.v1"), JSON.stringify({ i: 0, r: 0 })); });
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844, top: 47, bottom: 34 }]) {
    safeTop = viewport.top || 0; safeBottom = viewport.bottom || 0;
    await page.setViewportSize({ width: viewport.width, height: viewport.height }); await page.reload();
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(100);
    const label = await page.evaluate(() => {
      const pick = document.getElementById("homeSound"), cs = getComputedStyle(pick), r = pick.getBoundingClientRect();
      const text = pick.selectedOptions[0].textContent, canvas = document.createElement("canvas"), pen = canvas.getContext("2d");
      pen.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      return { value: pick.value, text, accessible: pick.getAttribute("aria-label"), title: pick.title, fontSize: parseFloat(cs.fontSize), textWidth: pen.measureText(text).width, available: pick.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), height: r.height, right: r.right, top: r.top, bottom: r.bottom, pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight, width: innerWidth, heightLimit: innerHeight };
    });
    ok("Home's automatic choice stays readable with the current sound accessible at " + viewport.width + "px", label.value === "" && label.text === "Auto" && label.accessible === "Target sound, automatic: TH (v)" && label.title === "Automatic: TH (v)" && label.fontSize >= 16 && label.textWidth <= label.available && label.height >= 44 && label.right <= label.width && label.top >= safeTop && label.bottom <= label.heightLimit - safeBottom && label.pageWidth <= label.width && label.pageHeight <= label.heightLimit + 1, label);
  }
  ok("target selection pages have no script errors", errors.length === 0, errors);
  await context.close();
} catch (e) { ok("target page regression runs", false, e.stack); }
finally { if (browser) await browser.close(); await new Promise((r) => server.close(r)); }
process.exit(fails ? 1 : 0);
