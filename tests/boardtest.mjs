// THE PRACTICE BOARD, the phone's half (BOARD2; Travis, 9 Oct 2026: "a board
// of every kid in Sona … days practiced"; D8, 11 Oct 2026). Built dark:
// BOARD_LIVE is false, and this suite turns the board on only through the
// preview seam (localhost, sessionStorage sona.boardpreview.v1), with every
// /api/board/* route answered by a mock. It plays the board the way a family
// meets it:
//   - off (the shipped state): no card in Settings, no link on the road, and
//     the board page says it is off. Nothing shows and nothing is sent;
//   - on: the card, and the reasons a child can't be on it (under 5, a phone
//     set up through a speech therapist, more than four children, a grown-up's
//     "Yes" to "Did a speech therapist or a school send you to Sona?");
//   - turning it on: the question once, the sheet, two children ticked, the
//     email sent with nothing but {email, kids:[{buddy}], tz}, the code on
//     screen, waiting, then one entry per child, and a repeated answer
//     changing nothing;
//   - a goal day: sent with nothing but {token, ago, tz, buddy}, once a day,
//     only with the goal stamp and at least 10 reps; a brother's day queued
//     offline goes out from Settings while his sister is the one playing;
//     Home sends nothing, ever;
//   - the board page: places, ties, medals, the "+N more kids" line, the
//     child's own card, a quiet month, a resting board and an old answer;
//   - leaving: "Turn off" deletes now, or later when offline (a rotated key
//     keeps it owed); with the board switched off an entry can still be
//     removed, and an owed deletion goes out from a rep on a game page;
//     removing a child, a restore that changes who sits in a slot, and a slot
//     handed out again never leave an entry behind; backups carry none of it;
//   - the words a child can see; no page errors.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0;
function ok(label, pass, detail = "") { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__seed") { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Setup</title>"); return; }
  if (url.pathname === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Store</title><script src="/sona.js"></script>'); return; }
  if (url.pathname.startsWith("/api/")) { req.resume(); res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());
const TODAY = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][new Date().getMonth()];

const KID = { childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false, volume: 0, character: "dragon" };
const entry = (token, nick, more) => JSON.stringify(Object.assign({ on: true, token, nick, joined: TODAY, q: [], qd: "", days: 0 }, more || {}));
const NOT_ALLOWED = "The Practice Board is only for a family's own phone. It's off on phones set up through a speech therapist or a school, or shared by more than four children.";

// One phone. preview: the board's seam. kids: extra children after Mia
// ([{ slot, name, age }]). seed: localStorage keys set as given. mock: the
// board routes, by name, each (body, n) => [status, json] (status 0 = no
// network). Main's seed rules (CLAUDE.md "Test seeds"): every era stamp, the
// trial-first stamp, and the kept-buddies stamp set so no sweep writes.
async function fresh({ preview = true, kids = [], seed = {}, profile = {}, mock = {}, width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const calls = [];   // every board request: { name, body, from }
  const count = {};
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin !== origin) return route.abort();
    if (u.pathname.startsWith("/api/board/")) {
      const name = u.pathname.slice("/api/board/".length);
      let body = null; try { body = JSON.parse(req.postData() || "null"); } catch (e) { body = req.postData(); }
      let from = ""; try { from = new URL(req.frame().url()).pathname; } catch (e) {}
      calls.push({ name, body, from });
      count[name] = (count[name] || 0) + 1;
      const h = mock[name], ans = h ? h(body, count[name]) : [503, { ok: false, retry: true }];
      if (!ans || ans[0] === 0) return route.abort();
      return route.fulfill({ status: ans[0], contentType: "application/json", body: JSON.stringify(ans[1]) });
    }
    // where a link goes is recorded, not run
    if (/^\/(?:customize|stickers|subscribe|premium|onboarding)\.html$/.test(u.pathname)) return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Away</title><p>Away</p>" });
    return route.continue();
  });
  await context.addInitScript((preview) => {
    if (preview) sessionStorage.setItem("sona.boardpreview.v1", "1");
    // the grown-ups check, passed (Settings asks for it)
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    const record = (text) => { if (String(text || "").trim()) { const c = JSON.parse(sessionStorage.getItem("test.speech") || "[]"); c.push(String(text)); sessionStorage.setItem("test.speech", JSON.stringify(c)); } return Promise.resolve(); };
    let sona; Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v; v.speak = record; v.speakNow = record; } });
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => record(u && u.text);
    const sb = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
    navigator.sendBeacon = function (u, b) { try { if (/\/api\/track/.test(String(u))) { const l = JSON.parse(sessionStorage.getItem("test.beacons") || "[]"); l.push(JSON.parse(b).e); sessionStorage.setItem("test.beacons", JSON.stringify(l)); } } catch (e) {} return sb ? sb(u, b) : true; };
    window.confirm = () => true;
  }, preview);
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/__seed");
  await page.evaluate(({ kids, seed, profile, KID }) => {
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.freever.v1", "kept");
    localStorage.setItem("sona.buddyset.v1", "kept");
    localStorage.setItem("sona.profile.v1", JSON.stringify(Object.assign({}, KID, profile)));
    if (kids.length) {
      localStorage.setItem("sona.kids.v1", JSON.stringify({ active: "", hi: kids.length + 1, list: [{ slot: "", name: "Mia" }].concat(kids.map((k) => ({ slot: k.slot, name: k.name }))) }));
      kids.forEach((k) => localStorage.setItem("sona.profile.v1@" + k.slot, JSON.stringify(Object.assign({}, KID, { childName: k.name, childAge: k.age, character: k.buddy || "panda" }))));
    }
    Object.keys(seed).forEach((k) => localStorage.setItem(k, seed[k]));
  }, { kids, seed, profile, KID });
  return { context, page, errors, calls };
}
const beacons = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("test.beacons") || "[]"));
const speech = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("test.speech") || "[]"));
const get = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const settle = (page, ms = 350) => page.waitForTimeout(ms);
async function settings(page) { await page.goto(origin + "/settings.html"); await page.waitForSelector("#boardCard", { state: "attached" }); await settle(page); }
async function store(page) { await page.goto(origin + "/__sona"); await page.waitForFunction(() => window.Sona && Sona.boardState); }
const card = (page) => page.evaluate(() => { const c = document.getElementById("boardCard"); return { shown: !c.hidden && c.getBoundingClientRect().height > 0, text: c.innerText.replace(/\s+/g, " ").trim(), buttons: [...c.querySelectorAll("button")].map((b) => b.textContent.trim()) }; });
const tap = async (page, text) => { await page.locator("#boardCard button", { hasText: text }).first().click(); await settle(page); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const BANNED = /\b(score|points?|high score|rare|epic|legendary|mystery|you're back|missed|lost|behind|hurry|ends in|last chance|streak|passed you|total)\b|\$/i;
const words = (page) => page.evaluate(() => document.body.innerText + " " + [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).join(" "));

// ── 1. off: the shipped state ──
await section("1 off", async () => {
  const f = await fresh({ preview: false, seed: { "sona.trophy.v1": JSON.stringify({ v: 1, t: 400, d: TODAY, dn: 0, m: TODAY.slice(0, 7), mn: 0 }) } });
  await settings(f.page);
  const c = await card(f.page);
  ok("off: Settings shows no Practice Board card (nothing a family can see)", !c.shown, c);
  ok("…and no Move box line", await f.page.evaluate(() => document.getElementById("boardMoveNote").hidden));
  await f.page.goto(origin + "/road.html"); await f.page.waitForSelector("#road:not([hidden])"); await settle(f.page);
  ok("off: the Trophy Road has no board link", await f.page.evaluate(() => document.getElementById("boardLink").hidden && document.getElementById("boardLink").getBoundingClientRect().height === 0));
  await f.page.goto(origin + "/board.html"); await settle(f.page, 400);
  const b = await f.page.evaluate(() => ({ off: !document.getElementById("offCard").hidden, text: document.getElementById("offCard").innerText.trim(), me: !document.getElementById("meCard").hidden, rows: document.querySelectorAll("#boardRows li").length }));
  ok("off: the board page says \"The Practice Board is off.\" with a Home button, and nothing else", b.off && /^The Practice Board is off\.\s*Home$/.test(b.text) && !b.me && b.rows === 0, b);
  ok("off: no page sent a single board request", f.calls.length === 0, f.calls);
  const went = f.page.waitForURL(/\/today\.html/, { timeout: 3000 }).then(() => true, () => false);
  await f.page.click("#boardHome");
  ok("…and Home goes home", await went);
  ok("no page errors (off)", f.errors.length === 0, f.errors);
  await f.context.close();
});

// ── 2. on: who can't be on it, and why ──
await section("2 reasons", async () => {
  const young = await fresh({ profile: { childAge: "4" } });
  await settings(young.page);
  let c = await card(young.page);
  ok("on: the card shows, and a child of 4 is told \"The Practice Board is for ages 5 and up.\"", c.shown && /Practice Board The Practice Board is for ages 5 and up\./.test(c.text) && !c.buttons.length, c);
  await young.context.close();
  const clinic = await fresh({ seed: { "sona.slpok": "ABC123" } });
  await settings(clinic.page); c = await card(clinic.page);
  ok("a phone that holds a speech therapist's link: the not-allowed line, and no way to turn it on", c.shown && c.text.includes(NOT_ALLOWED) && !c.buttons.length, c);
  await clinic.context.close();
  const many = await fresh({ kids: [2, 3, 4, 5].map((n) => ({ slot: "k" + n, name: "Kid" + n, age: "7" })) });
  await settings(many.page); c = await card(many.page);
  ok("five children on one phone: the same not-allowed line", c.shown && c.text.includes(NOT_ALLOWED) && !c.buttons.length, c);
  await many.context.close();
  const yes = await fresh();
  await settings(yes.page);
  c = await card(yes.page);
  ok("a family's own phone with a child of 7: \"Off unless you turn it on.\" and Learn more", c.shown && c.text.includes("A monthly board of how many days Sona kids practiced. Off unless you turn it on.") && c.buttons.join() === "Learn more", c);
  await tap(yes.page, "Learn more");
  c = await card(yes.page);
  ok("Learn more asks the therapist question first, with its promise", c.text.includes("Did a speech therapist or a school send you to Sona?") && c.text.includes("The board stays off for families who came through a speech therapist or a school. Your answer stays on this phone.") && c.buttons.join() === "Yes,No", c);
  await tap(yes.page, "Yes");
  c = await card(yes.page);
  ok("\"Yes\" ends in the not-allowed line, and the answer stays on this phone (sona.boardask.v1)", c.text.includes(NOT_ALLOWED) && !c.buttons.length && (await get(yes.page, "sona.boardask.v1")) === "clinic", c);
  await settings(yes.page); c = await card(yes.page);
  ok("…and it is asked once: a reload still says not allowed, with no question", c.text.includes(NOT_ALLOWED) && !c.text.includes("Did a speech therapist"), c);
  ok("nothing was sent to the board while deciding", yes.calls.length === 0, yes.calls);
  ok("no page errors (reasons)", young.errors.length + clinic.errors.length + many.errors.length + yes.errors.length === 0, [young.errors, clinic.errors, many.errors, yes.errors]);
  await yes.context.close();
});

// ── 3. turning it on: one email, a code, waiting, one entry per child ──
await section("3 consent", async () => {
  let claims = 0;
  const f = await fresh({
    kids: [{ slot: "k2", name: "Leo", age: "6", buddy: "panda" }, { slot: "k3", name: "Tot", age: "3" }],
    mock: {
      start: () => [200, { ok: true, pend: "p.req1", code: "K7Q" }],
      claim: () => { claims++; return claims === 1 ? [202, { ok: false, waiting: true }] : [200, { ok: true, members: [{ token: "m.mia", nick: "Brave Fox 42" }, { token: "m.leo", nick: "Calm Otter 17" }], month: TODAY.slice(0, 7) }]; },
      day: () => [200, { ok: true, counted: true, days: 1 }],
    },
  });
  await settings(f.page);
  await tap(f.page, "Learn more");
  await tap(f.page, "No");
  let c = await card(f.page);
  ok("\"No\" opens the sheet: what other families see, how a day counts, what the server keeps, the email", c.text.includes("Put your children on the Practice Board?") && c.text.includes("What other families see: a made-up nickname Sona picks (like Brave Fox 42)") &&
    c.text.includes("a day can be added up to a day late, never early") && c.text.includes("What Sona's server keeps:") && c.text.includes("To turn it on, we email a grown-up a link.") && c.text.includes("If a child is on the board on another phone or in Safari, turn it off there too."), c.text.slice(0, 300));
  const boxes = await f.page.evaluate(() => [...document.querySelectorAll("#boardCard .bd-kids label")].map((l) => ({ text: l.innerText.replace(/\s+/g, " ").trim(), disabled: l.querySelector("input").disabled, checked: l.querySelector("input").checked })));
  ok("one checkbox per child, none ticked; the child of 3 greyed with the reason", boxes.length === 3 && !boxes[0].disabled && !boxes[1].disabled && boxes[2].disabled && boxes[2].text === "Tot for ages 5 and up" && boxes.every((b) => !b.checked), boxes);
  await f.page.locator('#boardCard input[data-slot=""]').check();
  await f.page.locator('#boardCard input[data-slot="k2"]').check();
  await f.page.fill("#boardEmail", "grownup@example.com");
  await tap(f.page, "Email me the link");
  const start = f.calls.filter((x) => x.name === "start");
  ok("\"Email me the link\" sends once, with exactly {email, kids, tz}: two children as {buddy} and nothing else", start.length === 1 && JSON.stringify(Object.keys(start[0].body).sort()) === '["email","kids","tz"]' && start[0].body.email === "grownup@example.com" &&
    JSON.stringify(start[0].body.kids) === '[{"buddy":"dragon"},{"buddy":"panda"}]' && Number.isInteger(start[0].body.tz) && start[0].body.tz % 15 === 0, start);
  ok("…never a name or an age", !/Mia|Leo|"7"|"6"/.test(JSON.stringify(start)), start);
  const pend = JSON.parse(await get(f.page, "sona.boardpend.v1") || "null");
  ok("the phone keeps only the pending value, its time, the children asked for and the code: never the address", pend && pend.pend === "p.req1" && pend.code === "K7Q" && JSON.stringify(pend.slots) === '["","k2"]' && !/grownup|@/.test(JSON.stringify(pend)), pend);
  c = await card(f.page);
  ok("Settings shows the code and waits: Finish, Cancel, and \"Didn't get it? Send it again\"", c.text.includes("Check your email for code K7Q and tap the link, then come back here.") && c.buttons.join() === "Finish,Cancel,Send it again" && c.text.includes("Didn't get it? Send it again"), c);
  ok("nothing says on until the server has answered", !(await get(f.page, "sona.board.v1")) && !(await get(f.page, "sona.board.v1@k2")));
  await tap(f.page, "Finish");
  c = await card(f.page);
  ok("Finish before the email's button: still waiting", c.text.includes("code K7Q") && c.text.includes("Not confirmed yet") && !(await get(f.page, "sona.board.v1")), c);
  await tap(f.page, "Finish"); await settle(f.page, 400);
  const mia = JSON.parse(await get(f.page, "sona.board.v1") || "null"), leo = JSON.parse(await get(f.page, "sona.board.v1@k2") || "null");
  ok("the claim writes both children's entries, each its own token and nickname, joined today", mia && mia.on && mia.token === "m.mia" && mia.nick === "Brave Fox 42" && mia.joined === TODAY && leo && leo.on && leo.token === "m.leo" && leo.nick === "Calm Otter 17" && !(await get(f.page, "sona.board.v1@k3")), { mia, leo });
  ok("…and the pending request is gone", !(await get(f.page, "sona.boardpend.v1")));
  c = await card(f.page);
  ok("each child on the board has a line: \"Mia is on the board as Brave Fox 42 · 0 days this month.\", New nickname, Turn off", c.text.includes("Mia is on the board as Brave Fox 42 · 0 days this month.") && c.text.includes("Leo is on the board as Calm Otter 17 · 0 days this month.") &&
    c.buttons.filter((b) => b === "Turn off").length === 2 && c.buttons.filter((b) => b === "New nickname").length === 2, c);
  ok("\"board turned on\" was sent once, with nothing else", (await beacons(f.page)).filter((e) => e === "board turned on").length === 1);
  ok("today had no goal yet, so no day was sent", !f.calls.some((x) => x.name === "day"), f.calls.map((x) => x.name));
  // a repeated answer (an automatic retry, a lost reply) changes nothing
  const before = JSON.stringify([await get(f.page, "sona.board.v1"), await get(f.page, "sona.board.v1@k2"), await get(f.page, "sona.boardleave.v1")]);
  await f.page.evaluate(() => localStorage.setItem("sona.boardpend.v1", JSON.stringify({ pend: "p.req1", at: Date.now(), slots: ["", "k2"], code: "K7Q" })));
  const again = await f.page.evaluate(() => Sona.boardClaim());
  ok("a repeated claim answer changes nothing: the same entries, nothing queued, no second \"board turned on\"", again.ok && JSON.stringify([await get(f.page, "sona.board.v1"), await get(f.page, "sona.board.v1@k2"), await get(f.page, "sona.boardleave.v1")]) === before &&
    (await beacons(f.page)).filter((e) => e === "board turned on").length === 1, { again });
  ok("the Move box says to turn it off first while a child is on", await f.page.evaluate(() => { document.getElementById("moveBox").open = true; const n = document.getElementById("boardMoveNote"); return !n.hidden && n.getBoundingClientRect().height > 0 && n.textContent === "Turn off the Practice Board on this phone first: the board entry stays with this phone."; }));
  ok("no sideways scroll at 390 with the card full", (await overflow(f.page)) <= 0);
  ok("no page errors (consent)", f.errors.length === 0, f.errors);
  await f.context.close();
});

// ── 3b. the rest of the card: send again, the cap, cancel, a link that ran
// out, a resting board, a new nickname, an entry the server let go ──
await section("3b card states", async () => {
  let startAns = [200, { ok: true, pend: "p.req2", code: "M3T" }], claimAns = [404, { ok: false, expired: true }], nickN = 0;
  const f = await fresh({ seed: { "sona.boardask.v1": "no" }, profile: { email: "mum@example.com" },
    mock: { start: () => startAns, claim: () => claimAns, nick: () => (++nickN === 1 ? [200, { ok: true, nick: "Sunny Gecko 77" }] : [429, { ok: false, limit: true }]), day: () => [404, { ok: false, gone: true }] } });
  await settings(f.page);
  await tap(f.page, "Learn more");
  let c = await card(f.page);
  ok("with the question answered \"No\" on this phone, Learn more goes straight to the sheet", c.text.includes("Put your children on the Practice Board?") && !c.text.includes("Did a speech therapist"), c.text.slice(0, 80));
  ok("the email box starts with the grown-up's email from setup, when there is one", (await f.page.inputValue("#boardEmail")) === "mum@example.com");
  await tap(f.page, "Email me the link");
  ok("nothing ticked: \"Tick a child first.\", and nothing sent", (await card(f.page)).text.includes("Tick a child first.") && !f.calls.length);
  await f.page.locator('#boardCard input[data-slot=""]').check(); await f.page.fill("#boardEmail", "grownup@example.com");
  await tap(f.page, "Email me the link");
  await f.page.fill("#boardEmailAgain", "grownup@example.com");
  startAns = [429, { ok: false, limit: true }];
  await tap(f.page, "Send it again");
  const st = f.calls.filter((x) => x.name === "start");
  c = await card(f.page);
  ok("\"Send it again\" posts the same children with the pending value, and at the cap says so", st.length === 2 && st[1].body.pend === "p.req2" && JSON.stringify(Object.keys(st[1].body).sort()) === '["email","kids","pend","tz"]' &&
    c.text.includes("We just sent that address a link. Check the inbox, or try again tomorrow.") && c.text.includes("code M3T"), { st, c });
  await tap(f.page, "Finish");
  c = await card(f.page);
  ok("a link that ran out: \"That link ran out. Send a new one?\", and the request is forgotten", c.text.includes("That link ran out. Send a new one?") && c.buttons.includes("Send a new one") && !(await get(f.page, "sona.boardpend.v1")), c);
  await tap(f.page, "Send a new one");
  await f.page.locator('#boardCard input[data-slot=""]').check(); await f.page.fill("#boardEmail", "grownup@example.com");
  startAns = [503, { ok: false, paused: true }];
  await tap(f.page, "Email me the link");
  ok("a resting board: \"The Practice Board is resting right now. Nothing new was shared, and days still count.\"", (await card(f.page)).text.includes("The Practice Board is resting right now. Nothing new was shared, and days still count.") && !(await get(f.page, "sona.boardpend.v1")));
  startAns = [200, { ok: true, pend: "p.req3", code: "Q4X" }];
  await tap(f.page, "Email me the link");
  await tap(f.page, "Cancel");
  c = await card(f.page);
  ok("Cancel forgets the request on this phone and goes back to the card", !(await get(f.page, "sona.boardpend.v1")) && c.buttons.includes("Learn more") && !c.text.includes("Q4X"), c);
  // on the board: a new nickname once, then the day's limit
  await f.page.evaluate((e) => localStorage.setItem("sona.board.v1", e), entry("m.mia", "Brave Fox 42", { days: 2 }));
  await settings(f.page);
  await tap(f.page, "New nickname");
  c = await card(f.page);
  ok("New nickname: the line shows the new one at once", c.text.includes("Mia is on the board as Sunny Gecko 77 · 2 days this month.") && JSON.parse(await get(f.page, "sona.board.v1")).nick === "Sunny Gecko 77" && JSON.stringify(f.calls.filter((x) => x.name === "nick")[0].body) === '{"token":"m.mia"}', c);
  await tap(f.page, "New nickname");
  ok("…and a second one the same day says when", (await card(f.page)).text.includes("One new nickname a day, and three a month. Try again tomorrow."));
  // the server let the entry go (100 days without a counted day): the phone says so
  await f.page.evaluate((e) => localStorage.setItem("sona.board.v1", e), entry("m.mia", "Sunny Gecko 77", { q: [{ at: Date.now() - 5000 }], qd: TODAY }));
  await settings(f.page);
  c = await card(f.page);
  ok("a day answered 404 gone: the entry is off on this phone and the card says \"The board entry was removed after a long break. You can turn it on again.\"", c.text.includes("Mia · The board entry was removed after a long break. You can turn it on again.") && c.buttons.includes("Learn more") && JSON.parse(await get(f.page, "sona.board.v1")).gone === true && !(await get(f.page, "sona.boardleave.v1")), c);
  await f.page.setViewportSize({ width: 320, height: 640 });
  ok("no sideways scroll at 320", (await overflow(f.page)) <= 0);
  ok("no page errors (card states)", f.errors.length === 0, f.errors);
  await f.context.close();
});

// ── 4. a goal day: once, with the goal and 10 reps, and nothing more ──
await section("4 days", async () => {
  const f = await fresh({
    kids: [{ slot: "k2", name: "Leo", age: "6", buddy: "panda" }],
    profile: { dailyGoal: 5 },
    seed: { "sona.board.v1": entry("m.mia", "Brave Fox 42"), "sona.board.v1@k2": entry("m.leo", "Calm Otter 17", { q: [{ at: Date.now() - 60000 }], qd: TODAY }) },
    mock: { day: (b) => [200, { ok: true, counted: true, days: b.token === "m.mia" ? 4 : 2 }], view: () => [503, { ok: false, retry: true }] },
  });
  await store(f.page);
  const days = () => f.calls.filter((x) => x.name === "day" && x.body.token === "m.mia");
  for (let i = 0; i < 4; i++) await f.page.evaluate(() => Sona.gameRep("R"));
  await f.page.evaluate(() => Sona.gameRep("R")); await settle(f.page);
  const stamp = JSON.parse(await get(f.page, "sona.goaldays.v1") || "{}");
  ok("with a daily goal of 5, the 5th rep stamps the goal day and sends nothing (a board day needs 10 reps)", stamp[TODAY] === 5 && days().length === 0, { stamp, calls: f.calls.map((x) => x.name) });
  for (let i = 0; i < 4; i++) await f.page.evaluate(() => Sona.gameRep("R"));
  await settle(f.page);
  ok("…the 9th still sends nothing", days().length === 0);
  await f.page.evaluate(() => Sona.logAttempt({ sound: "R", word: "rabbit", pass: false, game: "practice" })); await settle(f.page, 500);
  ok("the 10th rep (a practice try, a miss counting the same) sends one day", days().length === 1, days());
  const d = days()[0] || { body: {} };
  ok("…with exactly {token, ago, tz, buddy}: the child's token, how many seconds ago, the offset and the buddy", JSON.stringify(Object.keys(d.body).sort()) === '["ago","buddy","token","tz"]' && d.body.token === "m.mia" && d.body.ago >= 0 && d.body.ago < 60 && d.body.buddy === "dragon" && Number.isInteger(d.body.tz), d.body);
  await f.page.evaluate(() => Sona.gameRep("R")); await settle(f.page, 400);
  ok("the 11th rep sends nothing more", days().length === 1, days().length);
  const mia = JSON.parse(await get(f.page, "sona.board.v1"));
  ok("the sent day leaves the queue, the day is marked, and the server's count is kept", mia.q.length === 0 && mia.qd === TODAY && mia.days === 4, mia);
  ok("the goal stamp and \"rep goal met\" still happen exactly once", JSON.parse(await get(f.page, "sona.goaldays.v1"))[TODAY] === 5 && (await beacons(f.page)).filter((e) => e === "rep goal met").length === 1, await beacons(f.page));
  ok("the flush that sent Mia's day sent her brother's queued day too (every child on the phone, not only the one playing)", f.calls.filter((x) => x.name === "day" && x.body.token === "m.leo").length === 1 && JSON.parse(await get(f.page, "sona.board.v1@k2")).q.length === 0);
  // Home: never a board request, whatever is queued or owed
  await f.page.evaluate((T) => { localStorage.setItem("sona.board.v1@k2", JSON.stringify({ on: true, token: "m.leo", nick: "Calm Otter 17", joined: T, q: [{ at: Date.now() - 60000 }], qd: T, days: 1 })); localStorage.setItem("sona.boardleave.v1", JSON.stringify([{ t: "m.old", at: Date.now() }])); }, TODAY);
  const n0 = f.calls.length;
  await f.page.goto(origin + "/today.html"); await f.page.waitForFunction(() => window.Sona && document.querySelector("#activityGroups .game-card")); await settle(f.page, 800);
  await f.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); }); await settle(f.page, 500);
  ok("Home makes 0 board requests, on load or coming back to the front, with a day queued and a deletion owed", f.calls.slice(n0).length === 0, f.calls.slice(n0));
  ok("Home is silent", (await speech(f.page)).length === 0);
  // a brother's day queued offline goes out from Settings while his sister plays
  await settings(f.page);
  const leoDay = f.calls.slice(n0).filter((x) => x.name === "day" && x.body.token === "m.leo");
  ok("a day queued for k2 while offline is sent by Settings' flush while \"\" is the active child", leoDay.length === 1 && leoDay[0].from === "/settings.html" && (await f.page.evaluate(() => Sona.activeKid().slot)) === "" && JSON.parse(await get(f.page, "sona.board.v1@k2")).q.length === 0, leoDay);
  ok("…and Settings sends the owed deletion first", f.calls.slice(n0).findIndex((x) => x.name === "leave") >= 0 && f.calls.slice(n0).findIndex((x) => x.name === "leave") < f.calls.slice(n0).findIndex((x) => x.name === "day"), f.calls.slice(n0).map((x) => x.name));
  ok("no page errors (days)", f.errors.length === 0, f.errors);
  await f.context.close();
});

// ── 5. the board page ──
const VIEW = { ok: true, month: TODAY.slice(0, 7), quiet: false,
  top: [
    { place: 1, nick: "Zippy Seal 33", buddy: "panda", days: 12, me: false },
    { place: 2, nick: "Kind Owl 50", buddy: "nobody", days: 9, me: false },
    { place: 2, nick: "Brave Fox 42", buddy: "dragon", days: 9, me: true },
    { place: 4, nick: "Jolly Puffin 18", buddy: "bee", days: 5, me: false },
  ],
  more: [{ place: 4, n: 38, days: 5 }],
  me: { nick: "Brave Fox 42", buddy: "dragon", days: 9, place: 2 } };
await section("5 board page", async () => {
  let mode = "ok";
  const f = await fresh({ seed: { "sona.board.v1": entry("m.mia", "Brave Fox 42", { days: 7 }) }, width: 320, height: 640,
    mock: { view: () => mode === "ok" ? [200, VIEW] : mode === "quiet" ? [200, { ok: true, month: TODAY.slice(0, 7), quiet: true, top: [], more: [], me: { nick: "Brave Fox 42", buddy: "dragon", days: 0, place: null } }] : mode === "resting" ? [503, { ok: false, paused: true }] : [0] } });
  await f.page.goto(origin + "/road.html"); await f.page.waitForSelector("#road:not([hidden])"); await settle(f.page);
  ok("on, with this child on the board: the road links to the board page", await f.page.evaluate(() => !document.getElementById("boardLink").hidden && document.getElementById("boardLink").getAttribute("href") === "/board.html"));
  await f.page.goto(origin + "/board.html"); await f.page.waitForSelector("#boardRows li"); await settle(f.page);
  const b = await f.page.evaluate(() => ({
    sub: document.getElementById("boardSub").textContent,
    rows: [...document.querySelectorAll("#boardRows li")].map((li) => ({ cls: li.className, text: li.innerText.replace(/\s+/g, " ").trim(), medal: !!li.querySelector(".bd-place svg"), place: (li.querySelector(".bd-place") || {}).textContent || "", img: (li.querySelector(".bd-face img") || {}).getAttribute ? li.querySelector(".bd-face img").getAttribute("src") : "", label: li.getAttribute("aria-label") })),
    me: document.getElementById("meCard").innerText.replace(/\s+/g, " ").trim(), suns: document.querySelectorAll("#meSuns svg").length, note: document.getElementById("boardNote").hidden ? "" : document.getElementById("boardNote").textContent,
    foot: document.getElementById("boardFoot").textContent }));
  ok("the sub names the month: \"Days practiced in " + MONTH + ". A new board starts on the 1st.\"", b.sub === "Days practiced in " + MONTH + ". A new board starts on the 1st.", b.sub);
  ok("rows in order, places 1-3 with a medal, 4 with its number; ties share a place", b.rows.length === 5 && b.rows[0].medal && b.rows[1].medal && b.rows[2].medal && !b.rows[3].medal && b.rows[3].place === "4" && /Place 2\./.test(b.rows[1].label) && /Place 2\./.test(b.rows[2].label), b.rows);
  ok("the child's own row is highlighted and says You", /\bme\b/.test(b.rows[2].cls) && /You/.test(b.rows[2].text) && b.rows[2].label === "You. Place 2. Brave Fox 42. 9 days.", b.rows[2]);
  ok("each row: the buddy picture, the nickname, \"12 days\"; a buddy the catalog doesn't know shows as the fox", /Zippy Seal 33 12 days/.test(b.rows[0].text) && /buddy-panda-v2\.webp/.test(b.rows[0].img) && /buddy-fox-v2\.webp/.test(b.rows[1].img), b.rows.slice(0, 2));
  ok("a tie too big to list is one line after its place: \"+38 more kids with 5 days\"", b.rows[4].cls === "bd-more" && b.rows[4].text === "+38 more kids with 5 days", b.rows[4]);
  ok("the own card first: You, the nickname, \"9 days\", a sun a day, \"You practiced 9 days this month!\"", /^You Brave Fox 42 9 days You practiced 9 days this month!$/.test(b.me) && b.suns === 9, b);
  ok("the grown-ups' footer", b.foot === "A sun is a day your child met the daily goal. Other kids' days update once a day. A new board starts on the 1st. Turn it off in Settings.");
  const v = f.calls.filter((x) => x.name === "view");
  ok("the page asks once, with just the token, and \"board viewed\" is sent", v.length === 1 && JSON.stringify(v[0].body) === '{"token":"m.mia"}' && (await beacons(f.page)).filter((e) => e === "board viewed").length >= 1, v);
  ok("the server's own count is kept for the child", JSON.parse(await get(f.page, "sona.board.v1")).days === 9);
  ok("no sideways scroll at 320", (await overflow(f.page)) <= 0);
  const said = await words(f.page);
  ok("no word a child must never see on the board page (behind, passed you, streak, total, score…)", !BANNED.test(said), said.match(BANNED));
  ok("silent", (await speech(f.page)).length === 0);
  // an old answer, when the network is gone
  mode = "offline";
  await f.page.reload(); await f.page.waitForSelector("#boardRows li"); await settle(f.page, 500);
  const st = await f.page.evaluate(() => ({ note: document.getElementById("boardNote").textContent, rows: document.querySelectorAll("#boardRows li").length }));
  ok("no network: the board from earlier today, saying so", st.note === "From earlier today." && st.rows === 5, st);
  mode = "quiet";
  await f.page.reload(); await settle(f.page, 600);
  const q = await f.page.evaluate(() => ({ note: document.getElementById("boardNote").textContent, rows: document.querySelectorAll("#boardRows li").length, me: document.getElementById("meCard").innerText.replace(/\s+/g, " ").trim(), suns: document.querySelectorAll("#meSuns svg").length }));
  ok("a quiet month: \"The board fills up as kids practice this month.\", no rows, and \"Meet your goal today to get your first sun!\"", q.note === "The board fills up as kids practice this month." && q.rows === 0 && /Meet your goal today to get your first sun!/.test(q.me) && q.suns === 0, q);
  mode = "resting";
  await f.page.evaluate(() => { const e = JSON.parse(localStorage.getItem("sona.board.v1")); e.days = 6; localStorage.setItem("sona.board.v1", JSON.stringify(e)); });
  await f.page.reload(); await settle(f.page, 600);
  const r = await f.page.evaluate(() => ({ note: document.getElementById("boardNote").textContent, rows: document.querySelectorAll("#boardRows li").length, me: document.getElementById("meCard").innerText.replace(/\s+/g, " ").trim() }));
  ok("resting (503): the own card from this phone's days, and \"The board is resting. Your days still count!\"", r.note === "The board is resting. Your days still count!" && r.rows === 0 && /6 days/.test(r.me), r);
  ok("no page errors (board page)", f.errors.length === 0, f.errors);
  await f.context.close();
});

// ── 6. leaving ──
await section("6 leaving", async () => {
  let leaveAns = [200, { ok: true, deleted: true }];
  const f = await fresh({ kids: [{ slot: "k2", name: "Leo", age: "6" }], seed: { "sona.board.v1": entry("m.mia", "Brave Fox 42", { days: 3 }), "sona.boardcache.v1": JSON.stringify({ ok: true, at: Date.now() }), "sona.board.v1@k2": entry("m.leo", "Calm Otter 17") },
    mock: { leave: () => leaveAns, day: () => [200, { ok: true, counted: true, days: 1 }] } });
  await settings(f.page);
  await f.page.locator('#boardCard .bd-kid[data-slot=""] button', { hasText: "Turn off" }).click(); await settle(f.page);
  let c = await card(f.page);
  ok("\"Turn off\" asks first: \"Turn off the board for Mia? Brave Fox 42 is deleted now.\" Turn off / Keep it on", c.text.includes("Turn off the board for Mia? Brave Fox 42 is deleted now.") && c.buttons.includes("Keep it on"), c);
  await f.page.locator('#boardCard .bd-kid[data-slot=""] button', { hasText: "Turn off" }).click(); await settle(f.page, 400);
  const lv = f.calls.filter((x) => x.name === "leave");
  ok("…then sends a leave with just the token, and this phone's entry and cached board are gone", lv.length === 1 && JSON.stringify(lv[0].body) === '{"token":"m.mia"}' && !(await get(f.page, "sona.board.v1")) && !(await get(f.page, "sona.boardcache.v1")) && JSON.parse(await get(f.page, "sona.boardleave.v1") || "[]").length === 0, lv);
  c = await card(f.page);
  ok("\"Turned off. Brave Fox 42 is deleted from the board.\", and \"board turned off\" sent", c.text.includes("Turned off. Brave Fox 42 is deleted from the board.") && (await beacons(f.page)).includes("board turned off"), c);
  // offline: queued, then a rotated key keeps it owed, then it goes
  leaveAns = [0];
  await f.page.locator('#boardCard .bd-kid[data-slot="k2"] button', { hasText: "Turn off" }).click(); await settle(f.page);
  await f.page.locator('#boardCard .bd-kid[data-slot="k2"] button', { hasText: "Turn off" }).click(); await settle(f.page, 400);
  c = await card(f.page);
  const owed = JSON.parse(await get(f.page, "sona.boardleave.v1") || "[]");
  ok("offline: \"Turned off. We'll finish deleting Calm Otter 17 when this phone is back online.\", the deletion owed on the phone, the entry gone here", c.text.includes("Turned off. We'll finish deleting Calm Otter 17 when this phone is back online.") && owed.length === 1 && owed[0].t === "m.leo" && !(await get(f.page, "sona.board.v1@k2")), { c, owed });
  leaveAns = [401, { ok: false, error: "token" }];
  await settings(f.page);
  ok("a 401 (a rotated key) keeps it owed", JSON.parse(await get(f.page, "sona.boardleave.v1") || "[]").length === 1);
  leaveAns = [200, { ok: true, deleted: true }];
  await settings(f.page);
  ok("the next flush sends it, and nothing is owed any more", JSON.parse(await get(f.page, "sona.boardleave.v1") || "[]").length === 0 && f.calls.filter((x) => x.name === "leave" && x.body.token === "m.leo").length === 3);
  ok("no page errors (turn off)", f.errors.length === 0, f.errors);
  await f.context.close();

  // the board switched off after go-live: an entry can still be removed, and an owed deletion still goes
  const off = await fresh({ preview: false, seed: { "sona.board.v1": entry("m.mia", "Brave Fox 42") }, mock: { leave: () => [200, { ok: true, deleted: true }] } });
  await settings(off.page);
  c = await card(off.page);
  ok("board off, an entry left: the card shows only \"Remove Mia from the Practice Board\"", c.shown && c.buttons.join() === "Remove Mia from the Practice Board" && !c.text.includes("Learn more"), c);
  await tap(off.page, "Remove Mia from the Practice Board"); await settle(off.page);
  ok("…and its tap sends the leave and clears the entry, and the card goes away", off.calls.filter((x) => x.name === "leave" && x.body.token === "m.mia").length === 1 && !(await get(off.page, "sona.board.v1")) && !(await card(off.page)).shown, off.calls);
  await off.page.evaluate(() => localStorage.setItem("sona.boardleave.v1", JSON.stringify([{ t: "m.owed", at: Date.now() }])));
  await store(off.page);
  await off.page.evaluate(() => Sona.gameRep("R")); await settle(off.page, 500);
  ok("board off: a queued leave is sent by a rep on a game page (gameRep), and nothing else is sent", off.calls.filter((x) => x.name === "leave" && x.body.token === "m.owed").length === 1 && off.calls.every((x) => x.name === "leave") && (await get(off.page, "sona.boardleave.v1")) === "[]", off.calls);
  await off.page.evaluate(() => { localStorage.setItem("sona.boardleave.v1", JSON.stringify([{ t: "m.owed2", at: Date.now() }])); Sona.gameRep("R"); }); await settle(off.page, 400);
  ok("…at most once a minute from reps (the next owed one waits for a page load or a minute)", off.calls.filter((x) => x.body && x.body.token === "m.owed2").length === 0);
  ok("no page errors (board off)", off.errors.length === 0, off.errors);
  await off.context.close();
});

// ── 7. a child removed, a restore, a slot handed out again; backups ──
await section("7 storage", async () => {
  const f = await fresh({ kids: [{ slot: "k2", name: "Leo", age: "6" }], seed: { "sona.board.v1": entry("m.mia", "Brave Fox 42"), "sona.board.v1@k2": entry("m.leo", "Calm Otter 17"), "sona.boardcache.v1@k2": JSON.stringify({ ok: true, at: 1 }) } });
  await store(f.page);
  const ex = await f.page.evaluate(() => Object.keys(Sona.exportData().data));
  ok("exportData() holds no board key", !ex.some((k) => /^sona\.board/.test(k)) && ex.includes("sona.profile.v1@k2"), ex.filter((k) => /board/.test(k)));
  const im = await f.page.evaluate(() => { const r = Sona.importData({ app: "sona", v: 1, data: { "sona.profile.v1@k2": JSON.stringify({ childName: "Leo", childAge: "6", onboarded: true }), "sona.board.v1@k2": "{\"on\":true,\"token\":\"m.forged\"}", "sona.boardleave.v1": "[]" } }); return { r, k2: localStorage.getItem("sona.board.v1@k2"), leave: localStorage.getItem("sona.boardleave.v1") }; });
  ok("importData refuses board keys (skipped), and the same child in the same slot keeps their entry", im.r.ok && im.r.skipped === 2 && JSON.parse(im.k2).token === "m.leo" && !im.leave, im);
  const ren = await f.page.evaluate(() => { Sona.importData({ app: "sona", v: 1, data: { "sona.profile.v1@k2": JSON.stringify({ childName: "Zed", childAge: "8", onboarded: true }) } }); return { k2: localStorage.getItem("sona.board.v1@k2"), cache: localStorage.getItem("sona.boardcache.v1@k2"), leave: JSON.parse(localStorage.getItem("sona.boardleave.v1") || "[]"), mia: localStorage.getItem("sona.board.v1") }; });
  ok("an import that renames slot k2's child queues k2's leave and clears k2's board keys (Mia's stays)", !ren.k2 && !ren.cache && ren.leave.length === 1 && ren.leave[0].t === "m.leo" && JSON.parse(ren.mia).token === "m.mia", ren);
  // a restore with a lower hi, then a new child: the slot handed out again has no board entry
  const hi = await f.page.evaluate(() => {
    localStorage.setItem("sona.kids.v1", JSON.stringify({ active: "", hi: 3, list: [{ slot: "", name: "Mia" }, { slot: "k2", name: "Zed" }, { slot: "k3", name: "Ana" }] }));
    localStorage.setItem("sona.profile.v1@k3", JSON.stringify({ childName: "Ana", childAge: "7", onboarded: true }));
    localStorage.setItem("sona.board.v1@k3", JSON.stringify({ on: true, token: "m.ana", nick: "Merry Lamb 61", joined: "2026-10-01", q: [], qd: "", days: 4 }));
    Sona.importData({ app: "sona", v: 1, data: { "sona.kids.v1": JSON.stringify({ active: "", hi: 2, list: [{ slot: "", name: "Mia" }, { slot: "k2", name: "Zed" }] }) } });
    const afterImport = localStorage.getItem("sona.board.v1@k3");
    // a stray entry an older build might have left under the slot about to be handed out
    localStorage.setItem("sona.board.v1@k3", JSON.stringify({ on: true, token: "m.stray", nick: "Lucky Duck 12", joined: "2026-10-01", q: [], qd: "", days: 1 }));
    const slot = Sona.addKid("Bo", "7");
    return { afterImport, slot, k3: localStorage.getItem("sona.board.v1@" + slot), cache: localStorage.getItem("sona.boardcache.v1@" + slot), leave: JSON.parse(localStorage.getItem("sona.boardleave.v1") || "[]").map((x) => x.t), state: Sona.boardState(slot) };
  });
  ok("a restore that drops a child clears that slot's entry and queues it", !hi.afterImport && hi.leave.includes("m.ana"), hi);
  ok("an import with a lower hi, then addKid: the slot handed out again has no board key (a stray one is queued for deletion)", hi.slot === "k3" && !hi.k3 && !hi.cache && hi.leave.includes("m.stray") && hi.state.on === false, hi);
  const rm = await f.page.evaluate(() => { Sona.switchKid("k2"); Sona.removeKid(""); return { base: localStorage.getItem("sona.board.v1"), leave: JSON.parse(localStorage.getItem("sona.boardleave.v1") || "[]").map((x) => x.t), kids: Sona.kids().map((k) => k.slot) }; });
  ok("removeKid(\"\") queues the first child's leave and clears slot \"\"'s board keys", !rm.base && rm.leave.includes("m.mia") && rm.kids.indexOf("") < 0, rm);
  ok("these only queue: nothing is sent until the next practice, game, road or Settings page sends it", f.calls.length === 0, f.calls);
  ok("no page errors (storage)", f.errors.length === 0, f.errors);
  await f.context.close();
});

await browser.close(); server.close();
console.log(fails ? fails + " FAILED" : "ALL GREEN");
process.exit(fails ? 1 : 0);
