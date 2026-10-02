// BESTS1: "Beat Your Best" (Travis, 1-2 Oct 2026). Each big-kid game counts
// one real thing the child's finger did and remembers that child's own best;
// Home's game picture carries a small "Best 17". This suite pins the shared
// store (Sona.gameBest / Sona.gameBestOffer) and Home's tag. The rules that
// make it safe for a child are the ones tested hardest:
//   - one record per child: a brother or sister starts with none, a removed
//     child's goes with them, and the old one-per-phone bests are not read;
//   - it only goes up, in whole numbers of real things;
//   - it is play, never practice: outcomes(), the week's reps, coins and
//     everything that leaves the phone are untouched by it;
//   - Home shows it only on a game the child can open, nothing for a game
//     never played, and never the words "score" or "points".
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0;
function ok(label, pass, detail = "") { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

// Everything a page posts to the server is kept, so "nothing shared mentions
// a best" is checked against what was really sent, not against the source.
const posted = [];
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Store</title><script src="/sona.js"></script>'); return; }
  if (url.pathname === "/__seed") { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Setup</title>"); return; }
  if (url.pathname.startsWith("/api/")) {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => { posted.push({ path: url.pathname + url.search, method: req.method, body }); res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); });
    return;
  }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());

// A family that arrived after every free era (see CLAUDE.md: a seed missing
// the newest stamp is grandfathered and the paywall quietly disappears), with
// the paid seam on, so Premium games are greyed whichever way the switch is.
async function fresh({ width = 375, height = 812, age = "7", premium = false, bests = null, extra = null, oldSona = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(origin)) return route.abort();
    // a phone still holding the sona.js from before this build
    if (oldSona && new URL(url).pathname === "/sona.js") return route.fulfill({ contentType: "text/javascript", body: readFileSync(path.join(ROOT, "sona.js"), "utf8") + "\n;delete Sona.gameBest;delete Sona.gameBestOffer;" });
    return route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/__seed");
  await page.evaluate(({ age, premium, bests, extra }) => {
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: age, focusSounds: ["R"], onboarded: true, volume: 0, voiceOn: false, soundOn: false }));
    sessionStorage.setItem("sona.paidui", "1");
    if (premium) localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, since: Date.now(), source: "stripe" }));
    if (bests) localStorage.setItem("sona.bests.v1", JSON.stringify(bests));
    Object.keys(extra || {}).forEach((k) => localStorage.setItem(k, extra[k]));
  }, { age, premium, bests, extra });
  return { context, page, errors };
}
async function store(page) { await page.goto(origin + "/__sona"); await page.waitForFunction(() => window.Sona && Sona.getProfile); }
async function home(page) { await page.goto(origin + "/today.html"); await page.waitForFunction(() => window.Sona && document.querySelector("#activityGroups .game-card")); await page.waitForTimeout(200); }
// What Home shows on each card, and where the tag sits against the picture
// and the Free / Included / Premium badge.
function cards(page) {
  return page.evaluate(() => {
    function rgba(c) { const m = String(c).match(/[\d.]+/g) || []; return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 }; }
    function lum(c) { return [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
    return [...document.querySelectorAll("#libraryApp .game-card[data-game]")].map((b) => {
      const tag = b.querySelector(".game-best"), art = b.querySelector(".game-art"), acc = b.querySelector(".game-access");
      const out = { key: b.dataset.game, disabled: b.disabled, locked: b.dataset.locked === "true", aria: b.getAttribute("aria-label"), text: tag ? tag.textContent : null, tags: b.querySelectorAll(".game-best").length };
      if (!tag) return out;
      const t = tag.getBoundingClientRect(), a = art.getBoundingClientRect(), c = acc.getBoundingClientRect(), cs = getComputedStyle(tag);
      const bg = rgba(cs.backgroundColor), ink = rgba(cs.color), l1 = lum(bg), l2 = lum(ink);
      out.inArt = tag.parentNode === art && art.getAttribute("aria-hidden") === "true";
      out.inside = t.left >= a.left && t.right <= a.right + 0.5 && t.top >= a.top && t.bottom <= a.bottom + 0.5 && t.width > 0 && t.height > 0;
      out.topLeft = t.left - a.left < a.width / 4 && t.top - a.top < a.height / 4;
      out.clearOfBadge = t.right <= c.left || c.right <= t.left || t.bottom <= c.top || c.bottom <= t.top;
      out.oneLine = t.height < 30;
      out.font = parseFloat(cs.fontSize); out.numFont = parseFloat(getComputedStyle(tag.querySelector("b")).fontSize);
      out.solid = bg.a; out.contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      out.artFade = getComputedStyle(art).opacity;
      return out;
    });
  });
}
const overflow = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const by = (list, key) => list.filter((c) => c.key === key);

// ── 1. the store ──────────────────────────────────────────────────────────
await section("the store", async () => {
  const { context, page, errors } = await fresh();
  try {
    await store(page);
    const r = await page.evaluate(() => {
      const raw = () => localStorage.getItem("sona.bests.v1");
      const out = { api: typeof Sona.gameBest === "function" && typeof Sona.gameBestOffer === "function" };
      out.never = Sona.gameBest("tiles"); out.neverWrote = raw();
      out.first = Sona.gameBestOffer("tiles", 14); out.afterFirst = Sona.gameBest("tiles"); out.rec = JSON.parse(raw()); out.today = Sona.localDay();
      out.lower = Sona.gameBestOffer("tiles", 9); out.afterLower = Sona.gameBest("tiles");
      out.equal = Sona.gameBestOffer("tiles", 14);
      out.higher = Sona.gameBestOffer("tiles", 17); out.afterHigher = Sona.gameBest("tiles");
      // not a whole number of real things from 1: ignored, the best stays
      out.junk = [17.5, 99.9, "30", NaN, Infinity, -Infinity, null, undefined, 0, -3, true, [40], {}, 1e9].map((n) => { const a = Sona.gameBestOffer("tiles", n); return a.best === 17 && a.prev === 17 && a.isNew === false && Sona.gameBest("tiles") === 17; });
      out.junkFirst = Sona.gameBestOffer("slice", 0); out.junkFirstRead = Sona.gameBest("slice");
      // not a game: nothing kept
      const before = raw();
      out.unknown = ["nope", "", null, undefined, "__proto__", "constructor", "toString", "arcade-tiles.html", 7].map((k) => { const a = Sona.gameBestOffer(k, 50); return a.best === 0 && a.prev === 0 && a.isNew === false && Sona.gameBest(k) === 0; });
      out.unknownWrote = raw() !== before;
      // each game is its own
      out.slice = Sona.gameBestOffer("slice", 6); out.tilesAfterSlice = Sona.gameBest("tiles"); out.sliceRead = Sona.gameBest("slice");
      out.shape = JSON.parse(raw());
      return out;
    });
    ok("Sona exports gameBest and gameBestOffer", r.api);
    ok("a game never played has no best (0), and asking writes nothing", r.never === 0 && r.neverWrote === null, r);
    ok("a first round sets the best: { best: 14, prev: 0, isNew: true }", JSON.stringify(r.first) === JSON.stringify({ best: 14, prev: 0, isNew: true }) && r.afterFirst === 14, r.first);
    ok("…kept as { tiles: { n: 14, at: <today on the phone> } }", JSON.stringify(r.rec) === JSON.stringify({ tiles: { n: 14, at: r.today } }) && /^\d{4}-\d\d-\d\d$/.test(r.today), r.rec);
    ok("a lower round never lowers it: { best: 14, prev: 14, isNew: false }", JSON.stringify(r.lower) === JSON.stringify({ best: 14, prev: 14, isNew: false }) && r.afterLower === 14, r.lower);
    ok("matching the best is not a new best", JSON.stringify(r.equal) === JSON.stringify({ best: 14, prev: 14, isNew: false }), r.equal);
    ok("beating it stores it: { best: 17, prev: 14, isNew: true }", JSON.stringify(r.higher) === JSON.stringify({ best: 17, prev: 14, isNew: true }) && r.afterHigher === 17, r.higher);
    ok("whole numbers from 1 only: fractions, strings, NaN, zero, negatives and absurd values change nothing", r.junk.every(Boolean), r.junk);
    ok("…and a round that counted nothing leaves a game with no best", JSON.stringify(r.junkFirst) === JSON.stringify({ best: 0, prev: 0, isNew: false }) && r.junkFirstRead === 0, r.junkFirst);
    ok("a key that is not a game keeps nothing", r.unknown.every(Boolean) && !r.unknownWrote, r.unknown);
    ok("each game has its own best", r.slice.isNew && r.slice.prev === 0 && r.sliceRead === 6 && r.tilesAfterSlice === 17 && Object.keys(r.shape).sort().join() === "slice,tiles", r.shape);

    // a damaged record never throws and never shows a number that is not one
    const d = await page.evaluate(() => {
      const out = {};
      [["array", "[1,2]"], ["text", "\"hello\""], ["broken", "{oops"], ["stringN", JSON.stringify({ tiles: { n: "38" } })], ["fraction", JSON.stringify({ tiles: { n: 12.5 } })], ["negative", JSON.stringify({ tiles: { n: -4 } })], ["bare", JSON.stringify({ tiles: 38 })], ["nullRec", JSON.stringify({ tiles: null })]].forEach(([name, raw]) => {
        localStorage.setItem("sona.bests.v1", raw);
        let read = "threw", offer = "threw", after = "threw";
        try { read = Sona.gameBest("tiles"); offer = Sona.gameBestOffer("tiles", 8); after = Sona.gameBest("tiles"); } catch (e) {}
        out[name] = { read, offer, after };
      });
      return out;
    });
    ok("a damaged record reads as no best, and the next round mends it", Object.values(d).every((x) => x.read === 0 && x.offer && x.offer.best === 8 && x.offer.prev === 0 && x.offer.isNew === true && x.after === 8), d);

    // a phone that cannot save still tells the truth about this round
    const full = await page.evaluate(() => {
      localStorage.setItem("sona.bests.v1", JSON.stringify({ tiles: { n: 10, at: "2026-10-01" } }));
      const real = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("QuotaExceededError"); };
      let a; try { a = Sona.gameBestOffer("tiles", 22); } finally { Storage.prototype.setItem = real; }
      return { a, kept: Sona.gameBest("tiles") };
    });
    ok("when the phone cannot save, the answer is still never below the round just played", full.a.best === 22 && full.a.prev === 10 && full.a.isNew === true && full.kept === 10, full);
    ok("…with no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── 2. one per child ──────────────────────────────────────────────────────
await section("per child", async () => {
  const { context, page, errors } = await fresh({ extra: { "sona.best.tiles": "52", "sona.best.slice": "80", "sona.best.run": "570", "sona.best.glide": "33", "sona.stack.best": "18" } });
  try {
    await store(page);
    const r = await page.evaluate(() => {
      const out = {};
      // the old bests were one per phone and counted a hidden number
      out.old = ["tiles", "slice", "run", "glide", "stack"].map((k) => Sona.gameBest(k));
      Sona.gameBestOffer("tiles", 17); Sona.gameBestOffer("slice", 9);
      out.firstKey = Sona.kkey("sona.bests.v1");
      const slot = Sona.addKid("Nora", "6");
      out.slot = slot; out.secondKey = Sona.kkey("sona.bests.v1");
      out.secondStarts = ["tiles", "slice"].map((k) => Sona.gameBest(k));
      out.secondOffer = Sona.gameBestOffer("tiles", 5);
      out.rawFirst = localStorage.getItem("sona.bests.v1"); out.rawSecond = localStorage.getItem("sona.bests.v1@" + slot);
      Sona.switchKid("");
      out.firstStill = ["tiles", "slice"].map((k) => Sona.gameBest(k));
      Sona.switchKid(slot); out.secondStill = Sona.gameBest("tiles");
      // it rides in a backup, like other play data (both children's)
      const backup = Sona.exportString();
      out.backupHas = /"sona\.bests\.v1"/.test(backup) && backup.indexOf("sona.bests.v1@" + slot) >= 0;
      out.backup = backup;
      // removing the child removes their best; the other child's stays
      Sona.switchKid(""); out.removed = Sona.removeKid(slot);
      out.afterRemove = { second: localStorage.getItem("sona.bests.v1@" + slot), first: localStorage.getItem("sona.bests.v1"), read: Sona.gameBest("tiles") };
      // …and the next child added is not handed it
      const slot3 = Sona.addKid("Theo", "7"); out.slot3 = slot3; out.thirdStarts = Sona.gameBest("tiles");
      return out;
    });
    ok("the old one-per-phone bests are not carried over: every game starts with none", r.old.every((n) => n === 0), r.old);
    ok("the first child's best is on the first child's own key", r.firstKey === "sona.bests.v1" && JSON.parse(r.rawFirst).tiles.n === 17, r);
    ok("a brother or sister starts with none", r.secondKey === "sona.bests.v1@" + r.slot && r.slot !== "" && r.secondStarts.every((n) => n === 0), r.secondStarts);
    ok("…and their first round is their own first best, on their own key", r.secondOffer.prev === 0 && r.secondOffer.best === 5 && r.secondOffer.isNew && JSON.parse(r.rawSecond).tiles.n === 5 && JSON.parse(r.rawFirst).tiles.n === 17, r);
    ok("switching back shows each child only their own", r.firstStill.join() === "17,9" && r.secondStill === 5, r);
    ok("both children's bests ride in a backup", r.backupHas);
    ok("removing a child removes their best and leaves the other's", r.removed === true && r.afterRemove.second === null && r.afterRemove.read === 17 && JSON.parse(r.afterRemove.first).slice.n === 9, r.afterRemove);
    ok("…and the next child added starts with none", r.slot3 !== r.slot && r.thirdStarts === 0, r);
    ok("…with no page errors", errors.length === 0, errors);

    // the backup restores them on a new phone
    const other = await fresh();
    try {
      await store(other.page);
      const got = await other.page.evaluate((backup) => { const res = Sona.importData(backup); return { res, first: (Sona.switchKid(""), Sona.gameBest("tiles")), second: (Sona.switchKid("k2"), Sona.gameBest("tiles")) }; }, r.backup);
      ok("a restored backup brings each child's best back to that child", got.res.ok && got.first === 17 && got.second === 5, got);
    } finally { await other.context.close(); }
  } finally { await context.close(); }
});

// ── 3. play, never practice; nothing shared ───────────────────────────────
await section("never practice data", async () => {
  const SRC = readFileSync(path.join(ROOT, "sona.js"), "utf8");
  ok("the record is in PER_KID", /const PER_KID = new Set\(\[[\s\S]*?"sona\.bests\.v1"[\s\S]*?\]\);/.test(SRC));
  // every mention of the store sits in three places: the PER_KID list, the
  // BESTS1 block and the export line. Anything else reading it is a new door.
  const block = (SRC.match(/\/\/ ── BESTS1:[\s\S]*?\n {2}function gameBestOffer\(key, n\) \{[\s\S]*?\n {2}\}\n/) || [""])[0];
  const rest = SRC.replace(block, "").replace(/const PER_KID = new Set\(\[[\s\S]*?\]\);/, "").replace(/\n {2}global\.Sona = \{[^\n]*\n/, "");
  ok("the store's block is found", block.length > 400 && /function gameBest\(key\)/.test(block));
  ok("nothing else in sona.js reads the bests: not outcomes(), not sendProgress(), not the week's reps, not coins", !/sona\.bests|BESTKEY|gameBest|_bestOf|_bests\(/.test(rest), (rest.match(/[^\n]*(sona\.bests|BESTKEY|gameBest|_bestOf|_bests\()[^\n]*/) || [""])[0].slice(0, 200));
  ok("…and the store itself never logs an attempt, a rep, a coin or a beacon", !/logAttempt|bumpReps|gameRep\(|addCoins|mintCoins|sendProgress|track\(|fetch\(|sendBeacon/.test(block.replace(/^\s*\/\/[^\n]*$/gm, "")));
  // what a clinician or a sharing parent is shown, and every server route
  const shared = ["progress.html", "slp.html", "slp-login.html", "join.html", "pilot.html", "talk.html"].filter((f) => existsSync(path.join(ROOT, f)));
  const mention = /sona\.bests|gameBest/;
  ok("Progress, the clinician's dashboard, the join page and Talk to us never read a best", shared.length >= 4 && shared.every((f) => !mention.test(readFileSync(path.join(ROOT, f), "utf8"))), shared.filter((f) => mention.test(readFileSync(path.join(ROOT, f), "utf8"))));
  const walk = (dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx|js|mjs)$/.test(e.name) ? [path.join(dir, e.name)] : []) : [];
  const serverFiles = [...walk(path.resolve(ROOT, "..", "app")), ...walk(path.resolve(ROOT, "..", "lib"))];
  ok("no server route or library knows the bests exist", serverFiles.length > 20 && serverFiles.every((f) => !mention.test(readFileSync(f, "utf8"))), serverFiles.filter((f) => mention.test(readFileSync(f, "utf8"))));

  // …and in a running app: a consenting, enrolled family's beacon, Home's own
  // calls and the funnel carry nothing about it, and no practice number moves.
  const SENTINEL = 73193;
  const { context, page, errors } = await fresh({ premium: true });
  try {
    await store(page);
    posted.length = 0;
    const r = await page.evaluate((SENTINEL) => {
      Sona.logAttempt({ game: "charge", sound: "R", pass: true, word: "rabbit" });
      Sona.startPilot("rachel"); localStorage.setItem("sona.slpticket", "fake.ticket");
      const snap = () => JSON.stringify({ out: Sona.outcomes(), prog: Sona.getProgress(), week: Sona.weekReps(0), weeks: Sona.repWeeks(8), coins: Sona.getCoins(), att: localStorage.getItem("sona.attempts.v1"), gr: localStorage.getItem("sona.gamereps.v1"), stickers: localStorage.getItem("sona.stickers.v1") });
      const keys = () => Object.keys(localStorage).sort();
      const before = snap(), keysBefore = keys();
      const a = Sona.gameBestOffer("tiles", SENTINEL), b = Sona.gameBestOffer("slice", 41);
      const after = snap(), keysAfter = keys();
      Sona.sendProgress("manual"); Sona.track("home_open", { where: "test" }); Sona.sendFeedback({ q: "pulse.chips", text: "More games" });
      return { a, b, same: before === after, added: keysAfter.filter((k) => keysBefore.indexOf(k) < 0), pilot: Sona.isPilot() };
    }, SENTINEL);
    ok("the bests went in", r.a.isNew && r.b.isNew && r.a.best === SENTINEL, r);
    ok("a best changes no practice number: outcomes, progress, the week's reps, coins, attempts, game reps and stickers are untouched", r.same);
    ok("…and writes one key, the child's bests", r.added.join() === "sona.bests.v1", r.added);
    await home(page); await page.waitForTimeout(400);
    await page.evaluate(() => Sona.sendProgress("manual")); await page.waitForTimeout(300);
    const beacon = posted.filter((p) => p.path === "/api/pilot" && p.method === "POST");
    ok("the consenting family's progress beacon really was sent", r.pilot && beacon.length >= 1 && /"outcomes"/.test(beacon[0].body), posted.map((p) => p.path));
    const leak = new RegExp("best|\\b" + SENTINEL + "\\b", "i");
    ok("nothing sent to the server mentions a best or carries its number: not the beacon, the funnel, feedback or Home's own calls", posted.length >= 3 && posted.every((p) => !leak.test(p.path) && !leak.test(p.body)), posted.filter((p) => leak.test(p.path) || leak.test(p.body)).map((p) => p.path + " " + p.body.slice(0, 160)));
    ok("…with no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── 4. Home's tag ─────────────────────────────────────────────────────────
for (const vp of [{ width: 375, height: 812 }, { width: 320, height: 568 }]) {
  await section("Home at " + vp.width, async () => {
    // Milo has played the two free games and, once, two Premium ones and a
    // parked one; his family has no Premium now, so those three are greyed.
    const { context, page, errors } = await fresh({ ...vp, bests: { tiles: { n: 38, at: "2026-10-02" }, slice: { n: 17, at: "2026-10-02" }, stack: { n: 13, at: "2026-09-20" }, run: { n: 570, at: "2026-09-20" }, peekaboo: { n: 4, at: "2026-09-20" } } });
    try {
      await home(page);
      const list = await cards(page), tiles = by(list, "tiles"), slice = by(list, "slice");
      const w = vp.width + "px: ";
      ok(w + "Piano Tiles' picture says \"Best 38\" and Fruit Slice's \"Best 17\"", tiles.length >= 1 && slice.length >= 1 && tiles.every((c) => c.text === "Best 38" && c.tags === 1) && slice.every((c) => c.text === "Best 17" && c.tags === 1), [tiles, slice]);
      const tagged = list.filter((c) => c.text !== null);
      ok(w + "the tag is on the picture, in its top left corner, whole and on one line", tagged.length >= 2 && tagged.every((c) => c.inArt && c.inside && c.topLeft && c.oneLine), tagged);
      ok(w + "…clear of the Free / Included badge", tagged.every((c) => c.clearOfBadge), tagged);
      ok(w + "…readable on the painted art: a solid cream pill, dark words, the number the biggest thing in it", tagged.every((c) => c.solid >= 0.9 && c.contrast >= 7 && c.font >= 11 && c.numFont > c.font && c.artFade === "1"), tagged);
      ok(w + "the card's own label says it too: \"… Your best: 38.\"", tiles.every((c) => /^Piano Tiles\. .*Your best: 38\.$/.test(c.aria)) && slice.every((c) => /^Fruit Slice\. .*Your best: 17\.$/.test(c.aria)), [tiles[0] && tiles[0].aria, slice[0] && slice[0].aria]);
      const greyed = list.filter((c) => c.locked && !c.disabled), parked = list.filter((c) => c.disabled);
      ok(w + "a greyed Premium game carries no tag, whatever the child once did in it", by(greyed, "stack").length >= 1 && by(greyed, "run").length >= 1 && greyed.every((c) => c.text === null && !/best/i.test(c.aria) && /Ask a grown-up/.test(c.aria)), greyed.filter((c) => c.text !== null));
      ok(w + "a Coming soon game carries no tag", by(parked, "peekaboo").length >= 1 && parked.every((c) => c.text === null && !/best/i.test(c.aria)), parked.filter((c) => c.text !== null));
      ok(w + "a game never played shows nothing at all", list.filter((c) => !c.locked && !c.disabled && ["tiles", "slice"].indexOf(c.key) < 0).every((c) => c.text === null && !/best/i.test(c.aria)), list.filter((c) => c.text !== null).map((c) => c.key));
      ok(w + "Home has no sideways scroll", (await overflow(page)) <= 1, await overflow(page));
      const words = await page.evaluate(() => document.getElementById("libraryApp").innerText);
      ok(w + "Home never says \"score\" or \"points\" to a child", !/\bscores?\b|\bpoints?\b/i.test(words), (words.match(/[^\n]*(scores?|points?)[^\n]*/i) || [""])[0]);
      // a tap on the tag is a tap on the game
      const tag = page.locator('#activityGroups .game-card[data-game="tiles"] .game-best').first();
      await tag.scrollIntoViewIfNeeded();
      const box = await tag.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForURL(/\/charge\.html\?/);
      ok(w + "tapping the tag opens the game, like the rest of the picture", new URL(page.url()).searchParams.get("game") === "arcade-tiles.html", page.url());
      ok(w + "…with no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  });
}

await section("Home: who sees a tag", async () => {
  // no bests at all: Home is exactly as it was
  let f = await fresh();
  try {
    await home(f.page);
    const list = await cards(f.page);
    ok("a child who has played nothing sees no tag and hears no best in any label", list.length > 8 && list.every((c) => c.text === null && c.tags === 0 && !/best/i.test(c.aria)), list.filter((c) => c.text !== null || /best/i.test(c.aria)));
    ok("…with no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }

  // with Premium, an opened Premium game carries its tag too; big numbers fit
  f = await fresh({ width: 320, height: 568, premium: true, bests: { tiles: { n: 52, at: "2026-10-02" }, stack: { n: 13, at: "2026-10-02" }, run: { n: 570, at: "2026-10-02" }, hoops: { n: 99999, at: "2026-10-02" }, peekaboo: { n: 4, at: "2026-10-02" } } });
  try {
    await home(f.page);
    const list = await cards(f.page);
    ok("a Premium game the family has opened carries its tag", by(list, "stack").every((c) => c.text === "Best 13" && !c.locked) && by(list, "run").every((c) => c.text === "Best 570") && by(list, "stack").length >= 1, by(list, "stack"));
    ok("the longest number still sits whole on a 320px picture, clear of the badge", by(list, "hoops").length >= 1 && by(list, "hoops").every((c) => c.text === "Best 99999" && c.inside && c.oneLine && c.clearOfBadge), by(list, "hoops"));
    ok("…and a Coming soon game still carries none", by(list, "peekaboo").every((c) => c.text === null && c.disabled), by(list, "peekaboo"));
    ok("…with no sideways scroll or page errors", (await overflow(f.page)) <= 1 && f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }

  // a brother or sister sees none of the first child's bests on Home
  f = await fresh({ bests: { tiles: { n: 38, at: "2026-10-02" }, slice: { n: 17, at: "2026-10-02" } } });
  try {
    await home(f.page);
    await f.page.evaluate(() => { Sona.addKid("Nora", "6"); Sona.saveProfile(Object.assign(Sona.getProfile(), { onboarded: true, focusSounds: ["S"] })); });
    await home(f.page);
    let list = await cards(f.page);
    ok("a second child's Home shows none of the first child's bests", (await f.page.evaluate(() => Sona.activeKid().name)) === "Nora" && list.length > 8 && list.every((c) => c.text === null && !/best/i.test(c.aria)), list.filter((c) => c.text !== null).map((c) => c.key + " " + c.text));
    await f.page.evaluate(() => Sona.switchKid("")); await home(f.page);
    list = await cards(f.page);
    ok("…and the first child's are still there when it is their turn", by(list, "tiles").every((c) => c.text === "Best 38") && by(list, "slice").every((c) => c.text === "Best 17") && by(list, "tiles").length >= 1, list.filter((c) => c.text !== null).map((c) => c.key + " " + c.text));
  } finally { await f.context.close(); }

  // Home left open behind a game repaints when it comes back to the front
  f = await fresh({ bests: { slice: { n: 17, at: "2026-10-01" } } });
  try {
    await home(f.page);
    const label = (key) => f.page.evaluate((key) => { const b = document.querySelector('#activityGroups .game-card[data-game="' + key + '"]'), t = b.querySelector(".game-best"); return { text: t ? t.textContent : null, tags: b.querySelectorAll(".game-best").length, aria: b.getAttribute("aria-label") }; }, key);
    const base = await label("tiles");
    await f.page.evaluate(() => { Sona.gameBestOffer("tiles", 21); Sona.gameBestOffer("slice", 23); });
    const stale = await label("tiles");
    await f.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const tiles = await label("tiles"), slice = await label("slice");
    ok("back at the front, a new best appears on its picture and in its label", base.text === null && stale.text === null && tiles.text === "Best 21" && tiles.tags === 1 && tiles.aria === base.aria + " Your best: 21.", { base, stale, tiles });
    ok("…and a beaten best is repainted in place, once", slice.text === "Best 23" && slice.tags === 1 && /Your best: 23\.$/.test(slice.aria) && !/17/.test(slice.aria), slice);
    await f.page.evaluate(() => { localStorage.removeItem("sona.bests.v1"); document.dispatchEvent(new Event("visibilitychange")); });
    const gone = await label("tiles");
    ok("…and a best that is gone takes its tag and its words with it", gone.text === null && gone.tags === 0 && gone.aria === base.aria, gone);
    ok("…with no page errors", f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }

  // a phone still holding the sona.js from before this build
  f = await fresh({ oldSona: true, bests: { tiles: { n: 38, at: "2026-10-02" } } });
  try {
    await home(f.page);
    const list = await cards(f.page);
    await f.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    ok("an older cached sona.js still gives a whole Home, with no tags and no errors", (await f.page.evaluate(() => typeof Sona.gameBest)) === "undefined" && list.length > 8 && list.every((c) => c.text === null) && f.errors.length === 0, f.errors);
  } finally { await f.context.close(); }
});

await browser.close(); server.close();
console.log(fails ? "\n" + fails + " FAILED" : "\nALL PASS");
process.exit(fails ? 1 : 0);
