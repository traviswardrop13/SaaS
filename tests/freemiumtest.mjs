// Premium is a local, parent-controlled rehearsal. The public free promise,
// real purchase rails, and an already-earned game's handoff must survive it.
import { existsSync, readFileSync } from "fs";
import { chromium, ROOT as SOURCE_ROOT, launchOpts } from "./_env.mjs";

const ROOT = process.env.SONATEST_PUBLIC_ROOT || SOURCE_ROOT;
const BASE = "http://localhost:8196";
const FREE = ["bubbles", "feed", "slice", "stack"];
const PREMIUM = ["glide", "peekaboo", "run", "tiles"];
const ALL = [...FREE, ...PREMIUM].sort();
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2" };
const browser = await chromium.launch(launchOpts());
let fails = 0;
function ok(name, pass, detail = "") {
  if (!pass) fails++;
  console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (values) => [...values].sort();
async function section(name, fn) {
  try { await fn(); }
  catch (error) { ok(name + " completes without a browser/test exception", false, error.message); }
}

// Fulfil every response locally, including the fake public host: these tests
// cannot call a payment service, speech service, or a real family API.
async function fixture({ origin = BASE, path = "/activities.html?libraryPreview=1", gate = false, paid = false, local = {}, session = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const calls = [], errors = [], ungatedPaints = [];
  await ctx.exposeBinding("__premiumPaint", (_source, value) => ungatedPaints.push(value));
  await ctx.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { calls.push(url.href); return route.abort(); }
    if (url.pathname.startsWith("/api/")) {
      calls.push(url.pathname);
      return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    }
    const file = ROOT + url.pathname;
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "Not found" });
    let body = readFileSync(file);
    if (url.pathname === "/sona.js") body = body.toString() + `
      (function(){
        ['iapPurchase','iapRestore','startTrial','ensureTrial','saveSub'].forEach(function(name){
          var original=Sona[name];
          Sona[name]=function(){
            var calls=JSON.parse(sessionStorage.getItem('test.realCalls')||'[]');
            calls.push(name);sessionStorage.setItem('test.realCalls',JSON.stringify(calls));
            return original.apply(this,arguments);
          };
        });
      })();`;
    return route.fulfill({ contentType: MIME[file.split(".").pop()] || "application/octet-stream", body });
  });
  await ctx.addInitScript(({ gate, paid, local, session }) => {
    if (!localStorage.getItem("test.freemium.seed")) {
      localStorage.setItem("test.freemium.seed", "1");
      localStorage.setItem("sona.freeera.v1", "post");
      localStorage.setItem("sona.freeera2.v1", "done");
      localStorage.setItem("sona.freeera3.v1", "done");
      localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: ["S"], onboarded: true, volume: 0, voiceOn: false, soundOn: false }));
      localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 8 * 86400000, done: Date.now() - 7 * 86400000 }));
      Object.entries(local).forEach(([key, value]) => localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)));
    }
    if (!sessionStorage.getItem("test.freemium.seed")) {
      sessionStorage.setItem("test.freemium.seed", "1");
      if (gate) sessionStorage.setItem("sona.gate.v1", String(Date.now()));
      if (paid) sessionStorage.setItem("sona.paidui", "1");
      Object.entries(session).forEach(([key, value]) => sessionStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)));
    }
    const media = navigator.mediaDevices;
    if (media) media.getUserMedia = function () {
      sessionStorage.setItem("test.micCalls", String(Number(sessionStorage.getItem("test.micCalls") || 0) + 1));
      return Promise.reject(new DOMException("Test microphone is disabled", "NotAllowedError"));
    };
    function inspectPaint() {
      const el = document.getElementById("premiumApp");
      const stamp = Number(sessionStorage.getItem("sona.gate.v1") || 0);
      const gateAge = Date.now() - stamp;
      if (el && !(stamp && gateAge >= 0 && gateAge < 600000)) {
        const rect = el.getBoundingClientRect();
        if (rect.width && rect.height && getComputedStyle(el).visibility === "visible" && getComputedStyle(document.documentElement).visibility === "visible") window.__premiumPaint(location.pathname);
      }
      requestAnimationFrame(inspectPaint);
    }
    requestAnimationFrame(inspectPaint);
  }, { gate, paid, local, session });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(5000);
  pg.on("pageerror", error => errors.push(error.message));
  await pg.goto(origin + path);
  return { ctx, pg, calls, errors, ungatedPaints };
}
async function realState(pg) {
  return pg.evaluate(() => Object.keys(localStorage)
    .filter(key => /^sona\.(?:sub|trial|profile|progress|demo|slp|founder|pilot|plan|reps|tickets|charge|rung|rotation|librarypreview|previewplan)/.test(key))
    .sort().map(key => [key, localStorage.getItem(key)]));
}
async function allowed(pg, options) {
  return pg.evaluate(({ keys, options }) => keys.filter(key => Sona.gameAccess(key, options).allowed), { keys: ALL, options });
}
async function solveGate(pg) {
  await pg.locator("#gateOvl.show").waitFor();
  const words = (await pg.locator("#gateQ").innerText()).split("·").map(word => word.trim());
  const digits = words.map(word => ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"].indexOf(word));
  if (digits.length !== 4 || digits.some(digit => digit < 0)) throw new Error("Parent gate did not show its four number words");
  for (const digit of digits) await pg.locator("#pad").getByRole("button", { name: String(digit), exact: true }).click();
  await pg.locator("#pad").getByRole("button", { name: "✓", exact: true }).click();
}

const premiumPresent = existsSync(ROOT + "/premium.html");
ok("the parent Premium page exists", premiumPresent);
let hasContract = false;
await section("preview contract", async () => {
  const { ctx, pg } = await fixture({ path: "/activities.html" });
  try {
    const contract = await pg.evaluate(() => ["libraryPreview", "previewPlan", "setPreviewPlan", "gameAccess"].map(name => [name, typeof window.Sona?.[name] === "function"]));
    for (const [name, present] of contract) ok("Sona exposes " + name, present);
    hasContract = contract.every(([, present]) => present);
    if (hasContract) {
      ok("ordinary visits do not enable the preview", await pg.evaluate(() => Sona.libraryPreview()) === false);
      if (await pg.evaluate(() => Sona.isFree())) ok("the current free promise still opens every available game", same(await allowed(pg), ALL));
      const access = await pg.evaluate(() => Sona.gameAccess("not-a-game"));
      ok("unknown games never receive access", access.allowed === false);
    }
  } finally { await ctx.close(); }
});

if (hasContract) {
  for (const origin of [BASE, "http://127.0.0.1:8196", "http://[::1]:8196", "https://library.example.test", "http://localhost.evil.example"]) {
    await section("preview origin " + origin, async () => {
      const local = [BASE, "http://127.0.0.1:8196", "http://[::1]:8196"].includes(origin);
      const { ctx, pg } = await fixture({ origin, gate: true });
      try {
        ok(origin + ": only an exact loopback host enables preview", await pg.evaluate(() => Sona.libraryPreview()) === local);
        const changed = await pg.evaluate(() => Sona.setPreviewPlan("trial"));
        ok(origin + ": only a local preview can simulate a trial", changed === local, changed);
        if (!local) {
          await pg.evaluate(() => { sessionStorage.setItem("sona.librarypreview.v1", "1"); sessionStorage.setItem("sona.previewplan.v1", JSON.stringify({state:"trial",endsAt:Date.now()+86400000})); });
          ok(origin + ": copied session flags cannot enable a public preview", await pg.evaluate(() => Sona.libraryPreview()) === false);
        } else {
          await pg.goto(origin + "/activities.html");
          ok(origin + ": preview survives navigation in the same tab", await pg.evaluate(() => Sona.libraryPreview()) === true);
          await pg.goto(origin + "/activities.html?libraryPreview=0");
          ok(origin + ": the explicit off switch disables the session preview", await pg.evaluate(() => Sona.libraryPreview()) === false);
          ok(origin + ": an off preview cannot modify the simulated plan", await pg.evaluate(() => Sona.setPreviewPlan("trial")) === false);
        }
      } finally { await ctx.close(); }
    });
  }

  await section("free and simulated trial boundaries", async () => {
    const { ctx, pg, calls } = await fixture();
    try {
      const before = await realState(pg);
      ok("preview starts free with two games in each age group", same(await allowed(pg), FREE));
      const model = await pg.evaluate(() => Sona.activityLibrary());
      ok("both age groups retain two free choices", model.groups.length === 2 && model.groups.every(group => group.games.filter(game => game.tier === "free").length === 2));
      ok("a child cannot start the simulated trial", await pg.evaluate(() => Sona.setPreviewPlan("trial")) === false);
      await pg.evaluate(() => Sona.gateVerify());
      const trial = await pg.evaluate(() => { const now = Date.now(); const changed = Sona.setPreviewPlan("trial"); return { now, changed, plan: Sona.previewPlan() }; });
      ok("a verified parent can simulate precisely three days", trial.changed === true && trial.plan.state === "trial" && Math.abs(trial.plan.endsAt - trial.now - 3 * 86400000) < 100, trial);
      ok("the simulated trial opens all eight games", same(await allowed(pg), ALL));
      ok("invalid simulated states are rejected", await pg.evaluate(() => Sona.setPreviewPlan("paid")) === false);
      await pg.evaluate(() => { const end = Sona.previewPlan().endsAt; Date.now = () => end + 1; });
      ok("the simulated trial expires by its clock without a button tap", await pg.evaluate(() => Sona.previewPlan().state) === "expired");
      ok("expiry leaves all four free games available", same(await allowed(pg), FREE));
      ok("simulation never changes real family, practice, trial or subscription data", same(await realState(pg), before));
      ok("simulation invokes no real trial or subscription method", await pg.evaluate(() => JSON.parse(sessionStorage.getItem("test.realCalls") || "[]").length) === 0);
      ok("simulation invokes no purchase, trial or checkout endpoint", !calls.some(url => /checkout|subscription|\/trial|revenuecat|purchases/i.test(url)), calls);
      const tab = await ctx.newPage(); await tab.goto(BASE + "/activities.html");
      ok("a new tab inherits no preview or simulated trial", await tab.evaluate(() => Sona.libraryPreview()) === false);
    } finally { await ctx.close(); }
  });

  await section("real paid families keep their promises", async () => {
    const cohorts = [
      ["subscriber", { "sona.sub.v1": { active: true, since: 1 } }],
      ["founder", { "sona.founder": "1" }],
      ["verified SLP family", { "sona.slpunlock": "1", "sona.slpok": "VERIFIED" }],
      ["pilot family", { "sona.pilot.v1": { consent: true } }],
      ["grandfathered sibling", { "sona.kids.v1": { active: "second", list: [{slot:"",name:"Mia"},{slot:"second",name:"Leo"}] }, "sona.profile.v1": {onboarded:true,earlyAdopter:true}, "sona.profile.v1@second": {onboarded:true,childAge:"7",voiceOn:false,soundOn:false,volume:0} }],
      ["existing promised trial", { "sona.trial.v1": { start: Date.now() - 86400000, days: 3 } }],
    ];
    for (const [name, local] of cohorts) {
      const { ctx, pg } = await fixture({ path: "/activities.html?paid=1", paid: true, local });
      try { ok(name + " keeps all eight games in the paid seam", same(await allowed(pg), ALL)); }
      finally { await ctx.close(); }
    }
    const { ctx, pg } = await fixture({ path: "/activities.html?paid=1", paid: true, local: {"sona.trial.v1":{start:Date.now()-9*86400000,days:3}} });
    try {
      ok("an expired paid family retains the four free games", same(await allowed(pg), FREE));
      await pg.evaluate(() => sessionStorage.setItem("sona.run.v1", JSON.stringify({active:true,round:0,pending:true,games:["slice","stack","slice","stack","slice"]})));
      ok("a generic active free run cannot unlock unrelated Premium games", same(await allowed(pg), FREE));
      ok("even a forged SLP URL cannot grant access", await pg.evaluate(() => { history.replaceState({},"","/activities.html?paid=1&slp=UNVERIFIED"); return Sona.gameAccess("tiles").allowed; }) === false);
    } finally { await ctx.close(); }
  });

  await section("only the current earned game survives expiry", async () => {
    const { ctx, pg } = await fixture({ gate: true });
    try {
      await pg.evaluate(() => {
        Sona.setPreviewPlan("trial");
        sessionStorage.setItem("sona.run.v1", JSON.stringify({active:true,round:0,pending:true,games:["tiles","run","glide","stack","slice"],scores:[],sum:0,tries:5,sound:"S"}));
        Sona.setPreviewPlan("expired");
      });
      ok("an earned saved run does not unlock Premium in the library", same(await allowed(pg), FREE));
      ok("run continuation honors only its currently earned Premium game", same(await allowed(pg, {run:true}), sorted([...FREE,"tiles"])));
      await pg.evaluate(() => { const run=JSON.parse(sessionStorage.getItem("sona.run.v1")); run.pending=false; sessionStorage.setItem("sona.run.v1",JSON.stringify(run)); });
      ok("a run without an earned checkpoint grants no Premium exception", same(await allowed(pg, {run:true}), FREE));
      await pg.evaluate(() => { const run=JSON.parse(sessionStorage.getItem("sona.run.v1")); run.ready={round:0,chest:null}; sessionStorage.setItem("sona.run.v1",JSON.stringify(run)); });
      ok("the saved ready checkpoint retains the same earned game", await pg.evaluate(() => Sona.gameAccess("tiles",{run:true}).allowed) === true);
      await pg.evaluate(() => sessionStorage.removeItem("sona.run.v1"));
      await pg.goto(BASE + "/charge.html?daily=1");
      const deck = await pg.evaluate(() => JSON.parse(sessionStorage.getItem("sona.run.v1") || "null")?.games || []);
      ok("a new adventure after expiry contains only free games", deck.length > 0 && deck.every(key => FREE.includes(key)), deck);
    } finally { await ctx.close(); }
  });

  await section("an earned game's real route survives expiry", async () => {
    const { ctx, pg } = await fixture({ gate: true });
    try {
      const games = ["tiles", "run", "glide", "stack", "slice"];
      await pg.evaluate(games => {
        Sona.setPreviewPlan("trial");
        sessionStorage.setItem("sona.run.v1", JSON.stringify({active:true,round:0,pending:true,games,scores:[],sum:0,tries:5,sound:"S"}));
        sessionStorage.setItem("sona.play.token", "1");
        Sona.setPreviewPlan("expired");
      }, games);
      ok("a generic legacy token cannot open a different Premium game", await pg.evaluate(() => Sona.gameAccess("run",{earned:true}).allowed) === false);
      await pg.goto(BASE + "/arcade-tiles.html?daily=1&from=charge");
      ok("the current earned game still opens after expiry", new URL(pg.url()).pathname === "/arcade-tiles.html" && await pg.evaluate(() => window.gameEntryAllowed === true));
      ok("the earned game keeps its saved run without changing the deck", same(await pg.evaluate(() => JSON.parse(sessionStorage.getItem("sona.run.v1")).games), games));
      await pg.goto(BASE + "/arcade-run.html?daily=1&from=charge");
      await pg.waitForURL(/\/activities\.html/);
      ok("another Premium URL cannot borrow the active game's permission", new URL(pg.url()).pathname === "/activities.html");
      await pg.evaluate(() => { sessionStorage.removeItem("sona.run.v1"); sessionStorage.removeItem("sona.play.active"); sessionStorage.setItem("sona.play.token","arcade-tiles.html"); });
      await pg.goto(BASE + "/arcade-tiles.html?from=charge");
      ok("an already-earned standalone turn also survives expiry", new URL(pg.url()).pathname === "/arcade-tiles.html" && await pg.evaluate(() => window.gameEntryAllowed === true));
    } finally { await ctx.close(); }
  });

  for (const daily of [false, true]) await section("a completed Premium arcade turn cannot retain its pass, daily=" + daily, async () => {
    const { ctx, pg } = await fixture({ gate: true });
    try {
      await pg.evaluate(daily => {
        Sona.setPreviewPlan("trial"); sessionStorage.setItem("sona.play.token","arcade-tiles.html");
        if (daily) sessionStorage.setItem("sona.run.v1",JSON.stringify({active:true,round:0,pending:true,ready:{round:0,chest:null},games:["tiles","run","glide","stack","slice"],scores:[],sum:0,tries:5,sound:"S"}));
      }, daily);
      const gameURL = BASE + "/arcade-tiles.html?from=charge" + (daily ? "&daily=1" : "");
      await pg.goto(gameURL);
      ok("daily=" + daily + ": the trial opens the earned arcade turn", new URL(pg.url()).pathname === "/arcade-tiles.html");
      // Invoke the same finish routine used by the game's final collision;
      // scoring and game timing are covered by their own suites.
      await pg.evaluate(() => endRound());
      await pg.locator("#endOvl.show").waitFor();
      await pg.evaluate(() => Sona.setPreviewPlan("expired"));
      await pg.goto(gameURL);
      await pg.waitForTimeout(100);
      ok("daily=" + daily + ": a completed turn cannot reopen Premium after expiry using its old URL", new URL(pg.url()).pathname === "/activities.html", pg.url());
      if (daily) {
        await pg.goto(BASE + "/charge.html?daily=1");
        const run = await pg.evaluate(() => JSON.parse(sessionStorage.getItem("sona.run.v1")));
        ok("a completed saved round banks once and preserves the original adventure", run.round === 1 && run.scores.length === 1 && same(run.games,["tiles","run","glide","stack","slice"]), run);
        await pg.reload();
        const resumed = await pg.evaluate(() => JSON.parse(sessionStorage.getItem("sona.run.v1")));
        ok("refreshing the continuation cannot bank the completed turn twice", resumed.round === 1 && resumed.scores.length === 1, resumed);
      }
    } finally { await ctx.close(); }
  });

  await section("Premium simple play rechecks a new round", async () => {
    const { ctx, pg } = await fixture({ gate: true });
    try {
      await pg.evaluate(() => Sona.setPreviewPlan("trial"));
      await pg.goto(BASE + "/arcade-peekaboo.html");
      await pg.locator("#startGame").click();
      for (let turn = 0; turn < 5; turn++) {
        await pg.locator("[data-door]").first().click();
        await pg.locator("#nextTurn").click();
      }
      await pg.locator("#finishPanel").waitFor();
      await pg.evaluate(() => Sona.setPreviewPlan("expired"));
      await pg.locator("#playAgain").click();
      await pg.waitForTimeout(100);
      ok("a finished Peekaboo page cannot start a fresh Premium round after expiry", new URL(pg.url()).pathname === "/activities.html", pg.url());
    } finally { await ctx.close(); }
  });

  for (const key of ALL) {
    await section("charge entry " + key, async () => {
      const { ctx, pg } = await fixture({ gate: true });
      try {
        await pg.evaluate(() => Sona.setPreviewPlan("expired"));
        await pg.goto(BASE + "/charge.html?game=arcade-" + key + ".html");
        await pg.waitForTimeout(100);
        const url = new URL(pg.url());
        if (FREE.includes(key)) ok(key + ": expiry still permits its existing practice route", url.pathname === "/charge.html" || url.pathname === "/arcade-" + key + ".html", url.href);
        else {
          ok(key + ": a direct Premium practice link returns to the library", url.pathname === "/activities.html", url.href);
          ok(key + ": a blocked practice link never asks for the microphone", await pg.evaluate(() => Number(sessionStorage.getItem("test.micCalls") || 0)) === 0);
        }
      } finally { await ctx.close(); }
    });
  }

  for (const key of PREMIUM) {
    await section("direct Premium game " + key, async () => {
      const { ctx, pg } = await fixture();
      try {
        await pg.goto(BASE + "/arcade-" + key + ".html?from=charge&daily=1");
        await pg.waitForURL(/\/activities\.html/);
        ok(key + ": a typed game URL cannot bypass preview access", new URL(pg.url()).pathname === "/activities.html");
        ok(key + ": rejection happens before microphone use", await pg.evaluate(() => Number(sessionStorage.getItem("test.micCalls") || 0)) === 0);
      } finally { await ctx.close(); }
    });
  }
}

if (hasContract && premiumPresent) {
  await section("locked choice and the parent gate", async () => {
    const { ctx, pg, calls, errors, ungatedPaints } = await fixture();
    try {
      // Home normalizes an existing family's daily counters on its first load.
      // Initialize that ordinary state before measuring a canceled gate visit.
      await pg.goto(BASE + "/today.html");
      await pg.goto(BASE + "/activities.html");
      const before = await realState(pg);
      await pg.locator('#activityGroups button[data-game="tiles"]').click();
      ok("a locked choice stays in the child library", new URL(pg.url()).pathname === "/activities.html");
      ok("the locked message names a grown-up who can help", await pg.locator("#libraryNotice").isVisible() && /grown[ -]?up|parent|adult/i.test(await pg.locator("#libraryNotice").innerText()));
      await pg.locator("#libraryUnlock").click();
      await pg.waitForURL(/\/today\.html\?gate=1/);
      ok("the gate carries only the selected known game", new URL(pg.url()).searchParams.get("to") === "/premium.html?game=tiles", pg.url());
      await pg.locator("#gateClose").click();
      ok("canceling the gate reveals no Premium offer or entitlement", !await pg.locator("#gateOvl").isVisible() && await pg.evaluate(() => Sona.previewPlan().state) === "free");
      ok("canceling keeps real family state unchanged", same(await realState(pg), before), {before,after:await realState(pg)});
      await pg.goBack();
      await pg.waitForURL(/\/activities\.html/);
      await pg.locator('#activityGroups button[data-game="tiles"]').click();
      await pg.locator("#libraryUnlock").click();
      await solveGate(pg);
      await pg.waitForURL(/\/premium\.html\?game=tiles/);
      ok("solving the gate returns to the selected game offer", await pg.locator("#premiumApp").isVisible());
      const body = await pg.locator("body").innerText();
      ok("the parent sees that this is a local simulation", await pg.locator("#premiumPreviewNotice").isVisible() && /preview|simulat/i.test(body));
      ok("the offer promises no unverified price", !/\$\s?\d/.test(body));
      ok("books remain clearly coming soon", /books[\s\S]{0,100}coming soon|coming soon[\s\S]{0,100}books/i.test(body));
      ok("a real purchase remains disabled pending release and product verification", await pg.locator("#premiumBuy").isDisabled());
      await pg.locator("#previewTrial").click();
      await pg.waitForURL(/\/charge\.html\?game=arcade-tiles\.html/);
      ok("the parent control starts only the simulated trial", await pg.evaluate(() => Sona.previewPlan().state) === "trial");
      ok("starting the simulated trial returns to the selected known game", new URL(pg.url()).searchParams.get("game") === "arcade-tiles.html");
      await pg.goto(BASE + "/premium.html?game=tiles");
      await pg.locator("#previewExpire").click();
      ok("the parent can rehearse expiry", await pg.evaluate(() => Sona.previewPlan().state) === "expired");
      await pg.locator("#keepFree").click();
      await pg.waitForURL(/\/activities\.html/);
      ok("Keep free returns to a library with four usable games", same(await allowed(pg), FREE));
      const entitlement = rows => rows.filter(([key]) => /^sona\.(?:sub|trial|slp|founder|pilot|plan)/.test(key));
      ok("the complete parent flow changes no real subscription or trial", same(entitlement(await realState(pg)), entitlement(before)));
      ok("the parent simulation calls no real purchase or trial methods", await pg.evaluate(() => JSON.parse(sessionStorage.getItem("test.realCalls") || "[]").length) === 0);
      ok("the parent simulation calls no purchase or trial endpoint", !calls.some(url => /checkout|subscription|\/trial|revenuecat|purchases/i.test(url)), calls);
      ok("no Premium frame was painted for an unverified visitor", ungatedPaints.length === 0, ungatedPaints);
      ok("the entire parent flow has no runtime errors", errors.length === 0, errors);
    } finally { await ctx.close(); }
  });

  await section("cold URL, destination sanitization and cached return", async () => {
    const { ctx, pg, ungatedPaints } = await fixture({ path: "/premium.html?libraryPreview=1&game=tiles&price=1&slp=EVIL" });
    try {
      await pg.waitForURL(/\/today\.html\?gate=1/);
      ok("a cold Premium URL requires the same parent gate", new URL(pg.url()).searchParams.get("to") === "/premium.html?game=tiles", pg.url());
      ok("a cold local preview entry remains a preview after the gate bounce", await pg.evaluate(() => Sona.libraryPreview()) === true);
      ok("a cold Premium visit never paints the offer before the gate", ungatedPaints.length === 0, ungatedPaints);
      const destinations = await pg.evaluate(() => [
        Sona.gateDest("/premium.html?game=tiles&slp=EVIL&price=1"),
        Sona.gateDest("/premium.html?game=unknown"),
        Sona.gateDest("//evil.example/premium.html?game=tiles"),
        Sona.gateDest("/../premium.html?game=tiles"),
        Sona.gateDest("/premium.html?game=https%3A%2F%2Fevil.example"),
      ]);
      ok("only a known game survives the Premium destination allowlist", destinations[0] === "/premium.html?game=tiles" && ["", "/premium.html"].includes(destinations[1]) && destinations[2] === "" && destinations[3] === "" && ["", "/premium.html"].includes(destinations[4]), destinations);
      await solveGate(pg); await pg.waitForURL(/\/premium\.html/);
      await pg.evaluate(() => { sessionStorage.removeItem("sona.gate.v1"); window.__sonaGateOk=0; window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true})); });
      await pg.waitForURL(/\/today\.html\?gate=1/);
      ok("a cached back-navigation rechecks an expired parent pass", new URL(pg.url()).pathname === "/today.html");
    } finally { await ctx.close(); }
  });
}
await browser.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
