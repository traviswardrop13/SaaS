// KIDS1: more than one child per device.
//
// The thing that has to be true: two children on one phone keep SEPARATE
// practice histories, and the family's entitlement is NOT one of the things
// that splits — a family pays once, so a second child must never land behind a
// paywall or re-trigger the OS mic prompt.
//
// The first child keeps the original un-suffixed keys, so an existing family
// needs no migration. That is the case most likely to break silently, so it is
// asserted directly.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8153, r));

const browser = await chromium.launch(launchOpts());
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
const page = await ctx.newPage();
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => {
  // an EXISTING family, already on the un-suffixed keys
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true, parentPin: "2468" }));
  localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, source: "apple" }));
  localStorage.setItem("sona.micok", "1");
});
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

await page.goto("http://localhost:8153/today.html");
await page.waitForTimeout(700);

// ── the existing family becomes kid one, on their own keys ──
let st = await page.evaluate(() => ({
  kids: Sona.kids(),
  active: Sona.activeKid(),
  name: Sona.getProfile().childName,
}));
ok("an existing family seeds one kid", st.kids.length === 1, JSON.stringify(st.kids));
ok("that kid is the active one", !!st.active && st.active.slot === "", JSON.stringify(st.active));
ok("their name comes from their own profile", st.name === "Milo", st.name);

// ── add a sibling: separate profile, separate progress, from the first write ──
st = await page.evaluate(() => {
  const slot = Sona.addKid("Ana", "5");
  Sona.saveProfile({ focusSounds: ["S"], onboarded: true });
  Sona.bumpReps(9);
  const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.S = 2;
  localStorage.setItem(Sona.kkey("sona.progress.v1"), JSON.stringify(g));
  return {
    slot,
    name: Sona.getProfile().childName, age: Sona.getProfile().childAge,
    focus: Sona.getProfile().focusSounds,
    reps: Sona.repsToday(),
    kids: Sona.kids().map((k) => k.name + (k.active ? "*" : "")),
  };
});
ok("adding a kid takes a new slot", st.slot === "k2", st.slot);
ok("the new kid is switched to immediately", /Ana\*/.test(st.kids.join(",")), st.kids.join(","));
ok("their name and age land on THEIR profile", st.name === "Ana" && st.age === "5", JSON.stringify(st));
ok("their focus sounds are their own", JSON.stringify(st.focus) === '["S"]', JSON.stringify(st.focus));
ok("their reps are their own", st.reps === 9, String(st.reps));

// ── switch back: kid one is exactly as they were ──
st = await page.evaluate(() => {
  Sona.switchKid("");
  return {
    name: Sona.getProfile().childName,
    focus: Sona.getProfile().focusSounds,
    pin: Sona.getProfile().parentPin,
    reps: Sona.repsToday(),
    stageS: (Sona.getProgress().stage || {}).S,
  };
});
ok("switching back restores the first child's profile", st.name === "Milo", st.name);
ok("their focus sound was never overwritten", JSON.stringify(st.focus) === '["R"]', JSON.stringify(st.focus));
ok("their parent code survived", st.pin === "2468", st.pin);
ok("the sibling's reps did not leak in", st.reps === 0, String(st.reps));
ok("the sibling's earned rung did not leak in", st.stageS === undefined, JSON.stringify(st.stageS));

// ── entitlement is FAMILY-wide: paying twice for two kids is not a thing ──
st = await page.evaluate(() => {
  const a = !!(Sona.isSubscribed && Sona.isSubscribed());
  Sona.switchKid("k2");
  const b = !!(Sona.isSubscribed && Sona.isSubscribed());
  const mic = localStorage.getItem("sona.micok");
  Sona.switchKid("");
  return { a, b, mic };
});
ok("both children share the family's plan", st.a === true && st.b === true, JSON.stringify(st));
ok("the mic grant is per DEVICE, not per child", st.mic === "1", String(st.mic));

// ── removing a sibling clears their data and never leaves zero children ──
st = await page.evaluate(() => {
  const before = Sona.kids().length;
  const removedLast = Sona.removeKid("");         // two exist, so this one is allowed
  Sona.switchKid("");
  const midway = Sona.kids().length;
  return { before, removedLast, midway, keys: Object.keys(localStorage).filter((k) => k.indexOf("@k2") > -1).length };
});
ok("a removal takes the child out of the list", st.midway === st.before - 1, JSON.stringify(st));

st = await page.evaluate(() => ({ blocked: Sona.removeKid(Sona.kids()[0].slot), n: Sona.kids().length }));
ok("the last child can never be removed", st.blocked === false && st.n === 1, JSON.stringify(st));

// ── per-kid keys that pages own directly must be namespaced too ──
// PER_KID is a promise; a key listed there but read with a raw localStorage call
// keeps none of it. These are the live surfaces that keep their own key.
{
  const lib = readFileSync(ROOT + "/library.html", "utf8");
  const feed = readFileSync(ROOT + "/arcade-feed.html", "utf8");
  const story = readFileSync(ROOT + "/story.html", "utf8");
  const today = readFileSync(ROOT + "/today.html", "utf8");
  ok("library read-stars are per child", /Sona\.kkey\("sona\.lib\.read\.v1"\)/.test(lib));
  ok("library's story-done check is per child", /kkey\("sona\.games\.v1"\)/.test(lib));
  ok("Echo's size is per child", /Sona\.kkey\("sona\.feed\.v1"\)/.test(feed));
  ok("Story Time's finished flag is per child", /kkey\("sona\.games\.v1"\)/.test(story));
  // the comeback greeting was removed on Travis's call — nothing should write
  // its key or resurrect the overlay
  ok("the comeback popup stays gone", !/cbOvl|sona\.comeback\.v1/.test(today));
  // the first-run guard runs before sona.js and must resolve the slot itself
  ok("the first-run guard reads the ACTIVE child's profile",
    /sona\.kids\.v1[\s\S]{0,320}sona\.profile\.v1"\s*\+\s*\(slot/.test(today),
    "it would always read child one, so a new sibling would skip setup");
}

// ── Settings surfaces the switcher ──
await page.goto("http://localhost:8153/settings.html?gate=1");
await page.waitForTimeout(600);
await page.evaluate(() => { try { Sona.gateVerify(); } catch (e) {} });
await page.goto("http://localhost:8153/settings.html");
await page.waitForTimeout(700);
const ui = await page.evaluate(() => ({
  card: !!document.getElementById("kidsCard"),
  rows: document.querySelectorAll("#kidList [data-slot]").length,
  active: document.querySelectorAll('#kidList [data-active="1"]').length,
  addBtn: !!document.getElementById("addKidBtn"),
  copy: (document.getElementById("kidsCard") || {}).textContent || "",
}));
ok("Settings has a Kids card", ui.card);
ok("it lists every child", ui.rows >= 1, "rows=" + ui.rows);
ok("exactly one child is marked as practising now", ui.active === 1, "active=" + ui.active);
ok("it offers adding a kid", ui.addBtn);
ok("it says the settings below belong to the selected child", /belongs to whoever is selected/i.test(ui.copy), ui.copy.slice(0, 120));

ok("no pageerrors", errs.length === 0, errs.join(" | "));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
