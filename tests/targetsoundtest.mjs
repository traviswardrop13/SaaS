// A family may pin one of its selected sounds without erasing the other
// sounds, earned work or its speech therapist's assignment. The shelf follows
// that sound alone; other sounds never appear in another shelf or fold.
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
section("free books on the selected shelf", () => {
  const p = boot({ targetSound: "S" }), { S, local } = p;
  if (typeof S.freeBooksOnShelf !== "function") return ok("the free-book shelf preview exists", false);
  const table = vm.runInNewContext(source("library.html").match(/var STORIES = (\[[\s\S]*?\n    \]);/)[1]);
  const freeIn = (sound) => S.FREE_BOOKS.filter((title) => table.some((b) => b.title === title && (!sound || b.sound === sound))).length;
  const before = JSON.stringify(local);
  ok("the free-book preview excludes another sound's free book and only reads", S.freeBooksOnShelf() === freeIn("S") && JSON.stringify(local) === before);
  S.setTargetSound("R");
  ok("…and includes free R books when R is selected", S.freeBooksOnShelf() === freeIn("R"));
  S.saveProfile({ mode: "play", targetSound: "" });
  ok("unpinned play mode previews the free books from its all-sound shelf", S.freeBooksOnShelf() === freeIn(""));
  S.setTargetSound("S");
  ok("a pin in play mode still previews only the pinned sound", S.freeBooksOnShelf() === freeIn("S"));
  S.saveProfile({ focusSounds: [], targetSound: "", mode: "" });
  ok("a child with no chosen sounds previews the all-sound shelf", S.freeBooksOnShelf() === freeIn(""));
  local["sona.homework.v1"] = JSON.stringify({ hw: { sounds: ["L"], start: "2000-01-01", due: "2999-01-01" } });
  ok("an active assignment previews its sound's shelf, even with no family sounds", S.freeBooksOnShelf() === freeIn("L"));
  delete local["sona.homework.v1"];
  local["sona.freever.v1"] = "post";
  // A website that cannot buy still keeps the free version. The returned
  // count always obeys the actual bookFree rule rather than a plan guess.
  ok("the preview grants no access and counts only titles this phone calls free", S.freeBooksOnShelf() === S.FREE_BOOKS.filter((title) => S.bookFree(title)).length);
});

// Real pages: a shelf selected in Settings, only that sound rendered,
// and assignment wording that cannot suggest a family choice was applied.
const mime = { html: "text/html", js: "text/javascript", css: "text/css", webp: "image/webp", svg: "image/svg+xml", woff2: "font/woff2" };
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x"), name = u.pathname.slice(1), file = path.join(process.env.TARGET_SOUND_OLD_ROOT || ROOT, name);
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
  await context.route("**/*", r => r.request().url().startsWith(base + "/") ? r.continue() : r.abort());
  const page = await context.newPage(), errors = [];
  await page.clock.setFixedTime(new Date("2026-10-15T12:00:00-06:00"));
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    if (localStorage.getItem("__targetseed")) return;
    localStorage.setItem("__targetseed", "1");
    ["", "2", "3", "4", "5"].forEach(n => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "post");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["R", "S"], targetSound: "S", onboarded: true, earlyAdopter: true, volume: 0 }));
  });
  const profileText = () => page.evaluate(() => localStorage.getItem(Sona.kkey("sona.profile.v1")));
  const readShelf = () => page.evaluate(() => ({ top: [...document.querySelectorAll("#shelf .bookBtn .bt")].map(b => b.textContent), badge: document.getElementById("librarySoundValue")?.textContent, more: !!document.getElementById("moreBtn"), rest: document.querySelectorAll(".bookBtn:not(#shelf .bookBtn)").length, all: ALL_STORIES.map(b => ({title:b.title,sound:b.sound})) }));
  const only = (shelf,sound) => shelf.top.length > 0 && shelf.top.every(t => shelf.all.find(b => b.title === t).sound === sound) && !shelf.more && shelf.rest === 0;
  async function childReadOnly(where, boxId, valueId) {
    const before = await profileText(), returnTo = page.url();
    const shape = await page.evaluate(([boxId,valueId]) => {
      const box=document.getElementById(boxId),value=document.getElementById(valueId);
      return {exists:!!box&&!!value,editable:box?box.querySelectorAll("select,input,button,a[href],[role=button],[role=combobox],[tabindex]").length:-1,role:box?.getAttribute("role"),tab:box?.getAttribute("tabindex")};
    },[boxId,valueId]);
    ok(where+" shows a read-only sound, with no editable control or dropdown",shape.exists&&shape.editable===0&&shape.role!=="button"&&shape.role!=="combobox"&&shape.tab===null,shape);
    if(shape.exists&&shape.editable===0){await page.locator("#"+valueId).click();await page.keyboard.press("r");await page.keyboard.press("ArrowDown");await page.keyboard.press("Space");await page.evaluate(id=>{const e=document.getElementById(id);if(e)e.focus();},valueId);}
    ok(where+" cannot change the child's sound by click, type-ahead or keys",await profileText()===before);
    if(page.url()!==returnTo)await page.goto(returnTo);
  }
  async function solveGate() {
    await page.waitForSelector("#gateOvl.show");
    const words=["ZERO","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE"],digits=(await page.locator("#gateQ").innerText()).split(" · ").map(w=>words.indexOf(w.trim()));
    if(digits.length!==4||digits.some(n=>n<0))throw new Error("parent gate did not show its four number words");
    for(const n of digits)await page.locator("#pad").getByRole("button",{name:String(n),exact:true}).click();
    await Promise.all([page.waitForURL(/\/settings\.html$/),page.locator("#pad").getByRole("button",{name:"✓",exact:true}).click()]);
  }
  await page.goto(base+"/library.html");
  let shelf=await readShelf();
  ok("the bookshelf names the parent's selected sound and shows only its books",shelf.badge==="S sound"&&only(shelf,"S"),shelf);
  await childReadOnly("Books","librarySoundBox","librarySoundValue");
  if(process.env.TARGET_SOUND_SCREENSHOTS)await page.screenshot({path:path.join(process.env.TARGET_SOUND_SCREENSHOTS,"library-sound.png"),fullPage:true});
  await page.goto(base+"/today.html");
  await childReadOnly("Home","homeSoundWrap","homeSoundValue");
  ok("Home's read-only badge shows the same current S sound",await page.locator("#homeSoundValue").textContent()==="S");

  // The real gate, without a fixture stamp: typing Settings' address cannot
  // expose its picker. Passing the same check is the parent's way in.
  await page.goto(base+"/settings.html");
  await page.waitForURL(/\/today\.html\?gate=1/);
  ok("a direct Settings visit still requires the grown-ups check",await page.locator("#gateOvl").evaluate(e=>e.classList.contains("show"))&&await page.locator("#targetSound").count()===0);
  await solveGate();
  ok("the real grown-ups check opens Settings with its editable target control",await page.locator("#targetSound").count()===1&&await page.evaluate(()=>Sona.gateOk()));
  await page.locator("#targetSound").selectOption("R");
  ok("the parent's Settings pick saves R without removing other sounds",await page.evaluate(()=>Sona.targetSound()==="R"&&Sona.getProfile().focusSounds.join(",")==="R,S"));
  await page.goto(base+"/library.html");shelf=await readShelf();
  ok("returning from the parent's pick rebuilds only the R shelf",shelf.badge==="R sound"&&only(shelf,"R"),shelf);
  await page.goto(base+"/today.html");
  ok("Home reflects the parent's R pick without a child sound control",await page.locator("#homeSoundValue").textContent()==="R"&&await page.locator("#homeSound").count()===0);
  await page.locator("#parentBtn").click();
  ok("the Grown-ups button still opens its check",await page.locator("#gateOvl").evaluate(e=>e.classList.contains("show")));
  await solveGate();
  await page.locator("#targetSound").selectOption("S");
  ok("Settings alone can deliberately switch the family back to S",await page.evaluate(()=>Sona.getProfile().targetSound==="S"&&Sona.rotSound()==="S"));
  if(process.env.TARGET_SOUND_SCREENSHOTS)await page.screenshot({path:path.join(process.env.TARGET_SOUND_SCREENSHOTS,"settings-sound.png"),fullPage:true});
  await page.locator('#sounds [data-s="S"]').click();
  ok("removing the parent's selected sound clears its pin safely",await page.evaluate(()=>document.getElementById("targetSound").value===""&&Sona.targetSound()==="R"&&!Sona.getProfile().targetSound));
  await page.locator('#sounds [data-s="S"]').click();
  await page.locator("#targetSound").selectOption("S");

  // Discovery still respects access and seasons; a different sound's free
  // or seasonal title never substitutes for the parent's selected shelf.
  await page.evaluate(()=>Sona.saveProfile({earlyAdopter:false}));
  await page.goto(base+"/library.html");shelf=await readShelf();
  ok("a locked S shelf never substitutes the free R book",only(shelf,"S"),shelf);
  await page.goto(base+"/today.html");
  ok("Home's Books door describes the locked S shelf honestly",await page.evaluate(()=>document.getElementById("homeBooksTag").textContent===(Sona.isFree()?"Free":Sona.booksOpen()?"Included":"Premium")));
  await page.evaluate(()=>Sona.saveProfile({focusSounds:["R","S"],targetSound:"R"}));await page.reload();
  ok("the R shelf can still be described by its real free title",await page.evaluate(()=>document.getElementById("homeBooksTag").textContent===(Sona.isFree()?"Free":Sona.booksOpen()?"Included":"1 free book")));
  await page.evaluate(()=>Sona.saveProfile({focusSounds:["K"],targetSound:"K",earlyAdopter:true}));
  await page.goto(base+"/library.html");shelf=await readShelf();
  ok("a K shelf never substitutes B's seasonal book",only(shelf,"K")&&!shelf.top.includes("Boo the Bat on Halloween"),shelf);

  await page.evaluate(()=>{Sona.saveProfile({focusSounds:["R","S"],targetSound:"S"});localStorage.setItem(Sona.kkey("sona.homework.v1"),JSON.stringify({hw:{sounds:["L"],start:"2000-01-01",due:"2999-01-01"}}));});
  await page.reload();shelf=await readShelf();
  ok("assigned books take precedence and name the speech therapist",shelf.badge==="L sound"&&only(shelf,"L")&&/speech therapist/.test(await page.locator("#librarySoundNote").textContent()),shelf);
  await childReadOnly("Assigned Books","librarySoundBox","librarySoundValue");
  await page.goto(base+"/today.html");
  ok("Home's read-only assignment badge shows L and its source",await page.locator("#homeSoundValue").textContent()==="L"&&/speech therapist/.test(await page.locator("#homeSoundWrap").getAttribute("aria-label")));
  await page.goto(base+"/settings.html");
  ok("even the parent cannot switch away from active homework",await page.locator("#targetSound").isDisabled()&&await page.locator("#targetSound").inputValue()==="L");
  await page.evaluate(()=>localStorage.removeItem(Sona.kkey("sona.homework.v1")));

  // A child switch while a page is still open cannot turn either badge into
  // a writer for the new child. Reload then paints that child's own shelf.
  await page.goto(base+"/library.html");
  await page.evaluate(()=>{Sona.addKid("Ana","7");Sona.saveProfile({focusSounds:["R","S"],targetSound:"R",onboarded:true});});
  const siblingProfile=await profileText();await childReadOnly("Stale Books","librarySoundBox","librarySoundValue");
  ok("a stale child's Books page cannot overwrite the sibling's R choice",await profileText()===siblingProfile&&await page.evaluate(()=>Sona.targetSound()==="R"));
  await page.reload();shelf=await readShelf();ok("Books reloads for the active sibling only",only(shelf,"R")&&shelf.badge==="R sound",shelf);
  await page.goto(base+"/today.html");
  await page.evaluate(()=>{Sona.addKid("Bea","7");Sona.saveProfile({focusSounds:["R","S"],targetSound:"S",onboarded:true});});
  const thirdProfile=await profileText();await childReadOnly("Stale Home","homeSoundWrap","homeSoundValue");
  ok("a stale Home cannot overwrite the next child's S choice",await profileText()===thirdProfile&&await page.evaluate(()=>Sona.targetSound()==="S"));
  await page.reload();
  const unpinnedProfile=await page.evaluate(()=>{Sona.saveProfile({targetSound:""});return localStorage.getItem(Sona.kkey("sona.profile.v1"));});
  await page.reload();
  ok("opening Home reads automatic rotation without pinning or saving it",await profileText()===unpinnedProfile&&await page.evaluate(()=>!Sona.getProfile().targetSound&&document.getElementById("homeSoundValue").textContent===Sona.soundLabel(Sona.targetSound())));
  let safeTop=0,safeBottom=0;
  await context.route(/\.(html|css)$/,async route=>{const response=await route.fetch(),body=(await response.text()).replace(/env\(safe-area-inset-top\)/g,safeTop+"px").replace(/env\(safe-area-inset-bottom\)/g,safeBottom+"px");await route.fulfill({response,body});});
  await page.evaluate(()=>{Sona.saveProfile({focusSounds:["THV","R"],targetSound:""});localStorage.setItem(Sona.kkey("sona.rotation.v1"),JSON.stringify({i:0,r:0}));});
  for(const viewport of [{width:320,height:568},{width:390,height:844,top:47,bottom:34}]){
    safeTop=viewport.top||0;safeBottom=viewport.bottom||0;await page.setViewportSize({width:viewport.width,height:viewport.height});await page.reload();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
    const badge=await page.evaluate(()=>{const e=document.getElementById("homeSoundValue"),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{text:e.textContent,fontSize:parseFloat(s.fontSize),fits:e.scrollWidth<=e.clientWidth+1,l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollHeight};});
    ok("Home's read-only TH label stays legible and on screen at "+viewport.width+"px",badge.text==="TH (v)"&&badge.fontSize>=11&&badge.fits&&badge.l>=0&&badge.r<=badge.w&&badge.t>=safeTop&&badge.b<=badge.h-safeBottom&&badge.scroll<=badge.h+1,badge);
  }
  ok("parent-only target pages have no script errors",errors.length===0,errors);
  await context.close();
} catch(e){ok("parent-only target regression runs",false,e.stack);}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
process.exit(fails?1:0);
