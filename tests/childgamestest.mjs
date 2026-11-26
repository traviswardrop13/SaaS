// CHILDGAMES1 (Travis, 25 Nov 2026): a speech therapist sending a parent a
// login can "give full access or limited access and customize it for each
// kid". The server half (Add a family, the claim, /api/homework,
// /api/slp/childgames, removing the child) is familylogintest's. This suite
// plays the phone's half, through the real sona.js and the real pages:
//   - the list arrives with the homework and is kept beside it, per child;
//   - a game off the list is gone from the Arcade, Today's picks and the game
//     of the day, and its address goes Home: never a grey card, never the price;
//   - a listed game the plan does not open stays locked as before (a list is
//     never access); stories and books are never limited;
//   - a grown-up's "No thanks" or Stop sharing ends it;
//   - no list is every game, exactly as before;
//   - the family's Settings says the therapist picked the games;
//   - the dashboard sends the position and the picked games, and its child
//     page can change them.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0;
function ok(label, pass, detail = "") { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const posted = [];
let HW_ANSWER = { ok: true, hw: null, games: ["slice", "hoops", "bubbles"] };
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", webmanifest: "application/manifest+json", mp4: "video/mp4", wav: "audio/wav", mp3: "audio/mpeg" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__sona") { res.writeHead(200, { "content-type": "text/html" }); res.end('<!doctype html><title>Store</title><body></body><script src="/sona.js"></script>'); return; }
  if (url.pathname.startsWith("/api/")) {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      posted.push({ path: url.pathname, body });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(url.pathname === "/api/homework" ? JSON.stringify(HW_ANSWER) : "{}");
    });
    return;
  }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());

// A set-up child on a clinician's caseload, sharing, with every era stamp
// (CLAUDE.md: a seed missing one is grandfathered). `premium` opens every
// game; `games` is the cached list (undefined: none cached).
function seedScript({ age = 7, premium = true, games, share = true }) {
  return `(() => {
    if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "${age}", focusSounds: ["R"], onboarded: true, voiceOn: true, volume: 0.8, slpShare: ${share}${premium ? ", earlyAdopter: true" : ""} }));
    localStorage.setItem("sona.freeera.v1", "post");
    ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
    localStorage.setItem("sona.freever.v1", "kept"); localStorage.setItem("sona.buddyset.v1", "kept");
    localStorage.setItem("sona.pilot.v1", JSON.stringify({ code: "rachel-k4", childId: "phoneG1", consent: true, ver: 1 }));
    localStorage.setItem("sona.slp", "rachel-k4"); localStorage.setItem("sona.slpok", "1"); localStorage.setItem("sona.slpticket", "tkt");
    ${games !== undefined ? `localStorage.setItem("sona.homework.v1", JSON.stringify({ hw: null, games: ${JSON.stringify(games)}, at: Date.now() }));` : ""}
  })();`;
}
async function open(page, opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(seedScript(opts || {}));
  const pg = await ctx.newPage(); const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(origin + page); await pg.waitForFunction(() => window.Sona && Sona.activityLibrary);
  return { ctx, pg, errors };
}
const shelf = (pg) => pg.evaluate(() => { const L = Sona.activityLibrary(); return { games: L.groups.map((g) => g.games.map((x) => x.key)).flat(), picks: (L.picks ? L.picks.games : []).map((x) => x.key) }; });

// ── 1. the list arrives with the homework ──
await section("the list arrives", async () => {
  const { ctx, pg } = await open("/__sona", {});
  const before = await pg.evaluate(() => Sona.slpGames());
  ok("no list cached: every game, as before", before === null, before);
  const after = await pg.evaluate(async () => { await Sona.syncHomework(true); return { list: Sona.slpGames(), raw: JSON.parse(localStorage.getItem("sona.homework.v1")) }; });
  ok("the homework sync brings the therapist's list and keeps it beside the homework", JSON.stringify(after.list) === '["slice","hoops","bubbles"]' && after.raw && JSON.stringify(after.raw.games) === '["slice","hoops","bubbles"]', after);
  ok("…and nothing about it is sent up (the sync still sends only the code, the child, the ticket and reps)",
    posted.some((p) => p.path === "/api/homework") && posted.filter((p) => p.path === "/api/homework").every((p) => Object.keys(JSON.parse(p.body)).every((k) => ["code", "childId", "ticket", "forId", "reps"].includes(k))), posted);
  HW_ANSWER = { ok: true, hw: null, games: null };
  const cleared = await pg.evaluate(async () => { await Sona.syncHomework(true); return Sona.slpGames(); });
  ok("a therapist who goes back to every game: the next sync clears it", cleared === null, cleared);
  HW_ANSWER = { ok: true, hw: null, games: ["slice", "hoops", "bubbles"] };
  await ctx.close();
});

// ── 2. off the list is off Home ──
await section("hidden games", async () => {
  const { ctx, pg, errors } = await open("/__sona", { games: ["slice", "hoops", "puppy", "nope", "slice"] });
  const r = await pg.evaluate(() => ({
    list: Sona.slpGames(), tiles: Sona.gameAccess("tiles"), hoops: Sona.gameAccess("hoops"), story: Sona.gameAccess("lighthouse"),
  }));
  ok("only real, playable games count, each once (a parked or unknown one is dropped)", JSON.stringify(r.list) === '["slice","hoops"]', r.list);
  ok("a game off the list does not open, and says why (never 'premium', so no price)", r.tiles.allowed === false && r.tiles.reason === "therapist", r.tiles);
  ok("a game on the list opens as before", r.hoops.allowed === true, r.hoops);
  ok("stories are never limited by it", r.story.reason !== "therapist", r.story);
  const s = await shelf(pg);
  ok("the Arcade's shelves hold only the listed games", JSON.stringify(s.games.slice().sort()) === '["hoops","slice"]', s);
  ok("…and so do Today's picks", s.picks.length > 0 && s.picks.every((k) => k === "slice" || k === "hoops"), s.picks);
  const q = await pg.evaluate(() => { localStorage.setItem("sona.quest.v1", JSON.stringify({ s: 99, lk: "game" })); return Sona.questToday(); });
  ok("the game of the day is never a hidden game", q.kind !== "game" || ["slice", "hoops"].includes(q.game), q);
  ok("the first game after setup is Fruit Slice while it is on the list", await pg.evaluate(() => Sona.firstGameStart()) === "/charge.html?game=arcade-slice.html");
  ok("no page errors", errors.length === 0, errors);
  await ctx.close();
});

// ── 3. Home draws no card for a hidden game, and its address goes Home ──
await section("Home and addresses", async () => {
  const { ctx, pg, errors } = await open("/today.html?view=arcade", { games: ["slice", "hoops"] });
  await pg.waitForTimeout(600);
  const html = await pg.evaluate(() => document.getElementById("libraryApp") ? document.getElementById("libraryApp").innerHTML : document.body.innerHTML);
  ok("the Arcade draws Fruit Slice and Hoops", /Fruit Slice/.test(html) && /Hoops/.test(html), html.slice(0, 200));
  ok("…and no card for a game off the list (no Piano Tiles, no Dino Dig, no Feed Echo)", !/Piano Tiles|Dino Dig|Feed Echo/.test(html));
  ok("no page errors on Home", errors.length === 0, errors);
  const pg2 = await ctx.newPage();
  await pg2.goto(origin + "/arcade-dino.html");
  await pg2.waitForURL(/\/today\.html/, { timeout: 8000 }).catch(() => {});
  ok("a hidden game's address goes Home (never the Arcade's locked note, never the price)", /\/today\.html$/.test(new URL(pg2.url()).pathname + new URL(pg2.url()).search), pg2.url());
  await ctx.close();
});

// ── 4. a list is never access ──
await section("never access", async () => {
  const { ctx, pg } = await open("/__sona", { premium: false, games: ["tiles", "dino"] });
  const r = await pg.evaluate(() => ({ tiles: Sona.gameAccess("tiles"), dino: Sona.gameAccess("dino"), slice: Sona.gameAccess("slice") }));
  ok("a listed free game opens with the free version", r.tiles.allowed === true, r.tiles);
  ok("a listed Premium game stays Premium on the free version", r.dino.allowed === false && r.dino.reason !== "therapist", r.dino);
  ok("an unlisted free game is hidden", r.slice.allowed === false && r.slice.reason === "therapist", r.slice);
  ok("the first game after setup is the first on the list when Fruit Slice is not", await pg.evaluate(() => Sona.firstGameStart()) === "/charge.html?game=arcade-tiles.html");
  await ctx.close();
});

// ── 5. a grown-up's no ends it; no list is every game ──
await section("no and none", async () => {
  let { ctx, pg } = await open("/__sona", { share: false, games: ["slice"] });
  ok("a child whose grown-up stopped sharing has every game", await pg.evaluate(() => Sona.slpGames()) === null && (await shelf(pg)).games.length > 2);
  await ctx.close();
  ({ ctx, pg } = await open("/__sona", {}));
  const s = await shelf(pg);
  ok("no list: the shelves are every playable game, as before", s.games.length >= 20 && s.games.includes("tiles") && s.games.includes("feed"), s.games.length);
  await ctx.close();
});

// ── 6. what the grown-ups and the therapist see (source) ──
{
  const set = readFileSync(path.join(ROOT, "settings.html"), "utf8");
  ok("the family's Settings says the therapist picked the games, read only, only when they did",
    /id="gamesNote" hidden/.test(set) && /speech therapist picked " \+ picked\.length/.test(set) && /gn\.hidden = !picked/.test(set));
  const slp = readFileSync(path.join(ROOT, "slp.html"), "utf8");
  ok("Add a family asks where in the word and offers All games or Pick games",
    /id="famPos"/.test(slp) && /id="famGamesAll" value="all" checked/.test(slp) && /id="famGamesPick" value="pick"/.test(slp) && /if\(pos&&pos!=="mix"\)body\.pos=pos/.test(slp) && /body\.games=games/.test(slp));
  ok("…and refuses an empty pick in words", /Pick at least one game, or choose All games\./.test(slp));
  ok("the child page shows the games and saves a change to /api/slp/childgames", /id="chGamesCard"/.test(slp) && /fetch\("\/api\/slp\/childgames"/.test(slp) && /Other games are hidden on the child's Home\./.test(slp));
  ok("the picker never sells: no price in it", !/\$\d/.test((slp.match(/function gamePicker[\s\S]*?\n    }\n/) || [""])[0]));
}

await browser.close(); server.close();
console.log(fails ? "\n" + fails + " FAILED" : "\nALL GREEN");
process.exit(fails ? 1 : 0);
