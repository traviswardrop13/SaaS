// Home's story clips: a few seconds of each story day's REAL game, for the
// big card on Home (Travis, 28 Oct 2026: "the daily practice is like a 3
// second reel essentially of the game that the child will play"). Nothing
// here is drawn or edited: each clip is the game's page in public/, served as
// is on tools/appstore/capture.mjs's fake phone, played with the page's own
// controls and filmed one frame at a time by ../setupreel/kit.mjs, the
// machinery setup's clips were made with.
//
//   node tools/homereel/record.mjs                 every game in KEYS
//   node tools/homereel/record.mjs --only=lighthouse,windup
//   node tools/homereel/record.mjs --frames-only   film, no encode (look first)
//   node tools/homereel/record.mjs --full          the whole screen every half
//                                                  second, to choose a crop
//   node tools/homereel/record.mjs --encode-only   encode the last frames again
//   node tools/homereel/record.mjs --debug         each scene's probe, as it films
//                                                  (--debug=1: every frame)
//
// Writes public/assets/home/reel/<game>.mp4 (540x720, 3:4, 30 fps, 3 to
// 3.5 s, H.264 High 4.0, no audio track, moov first, tagged BT.709) and
// <game>.webp (its first frame), one for each story day's game (STORY_DAYS'
// `game` in public/sona.js), and a contact sheet per clip in
// tools/homereel/out/sheets/ (git ignores out/): LOOK at every sheet before
// committing a clip (a card or a banner over the play, a dead stretch, a move
// the finger should not have made, the moment off the frame). The game of the
// day's clips (QUEST_DAYS: slice, tiles, stack, run, glide, hoops, dino,
// soccer, rise, feed, bubbles) sit in the same folder; they were filmed by
// tools/setupreel/record.mjs before it went to 1:2 (its scenes are in git
// history, at the commit before 09d8f1b) and are not this tool's.
// tests/homereeltest.mjs checks every file (size, codec, length, colour
// tags, no audio, faststart, poster) and that KEYS is STORY_DAYS' games; it
// never runs this. A new story day is a scene here and a key in KEYS. Needs
// ffmpeg with libx264 and libwebp, and ImageMagick's montage for the sheets.
// It is CPU heavy (a minute or two a clip; HOMEREEL_PORT, default 9304): run
// it alone, not beside a test, one game at a time when trying a scene.
//
// Each clip is one move of the game: a word just heard (said three times, as
// every story game asks: Sona.STORY_SAY_TIMES), then the finger playing it
// to the moment it pays off (a boat found and tooting home, a toy wound and
// drumming, a stone dropping into its hole...), cut so the loop starts on
// the play and ends just after that moment (moveEnd). Never a start card, an
// end card or a wait for a word, and never the turn panel: the clip is the
// play, cropped to 3:4 under the game's top bar and banner. A move longer
// than 3.5 s shows its end; where a game's first move is too plain or too
// short, a later word's is filmed, and the words before it are played off
// film by the same finger script.
//
// What is staged, and why it is honest:
//   - capture.mjs's household (an onboarded child on R, Premium through the
//     free-era promise, every era stamp set), as the iPhone app, aged 7: the
//     ages 5-8 version of each game, the story open (Sona.storyOpen()). The
//     child's name is on no game page, and each clip is checked for it;
//   - the "child" is capture.mjs's fake microphone: a voiced sound only once
//     Echo's turn's mic is open (__dev.voice, as the test suites do), three
//     sayings a beat apart; the page's own check says yes before the move is
//     earned;
//   - the finger is the page's own pointer events (page.mouse), one move a
//     frame, so a drag takes the time a child's does; it plays the move the
//     way the game's own suite does (tests/<game>test.mjs and
//     tests/daily-<game>test.mjs), never through a page function;
//   - Echo's mid-round asks are held (holdAsk), and the game's dice are
//     seeded (cfg.dice), so a scene films nearly the same move each time.
//
// Whose calls these are (built on defaults, 28 Oct 2026):
//   - Travis's: which moment each clip shows, the crops, about 3.2 s a clip,
//     and the budgets counted strictly (300,000 and 60,000 bytes);
//   - Rachel's: nothing here asks a child anything new; the clips show the
//     reward a child earns by saying the word (the move itself), on R.
import path from "path";
import { fileURLToPath } from "url";
import { reelKit, both, FPS, NAME, VIEW } from "../setupreel/kit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const DEST = path.join(REPO, "public/assets/home/reel");
const OUT = process.env.HOMEREEL_OUT || path.join(HERE, "out");
const PORT = Number(process.env.HOMEREEL_PORT || 9304);

// The phone's 780 px across, cut to a 780 x 1040 window (3:4) and scaled to
// 540 x 720: the shape of the game of the day's clips beside them.
const CROP_H = VIEW.width * 4 / 3;              // 520 pt
const SIZE = { w: 540, h: 720 };
// in bytes, decimal: 300 KB a clip, 60 KB a poster (tests/homereeltest.mjs)
export const BUDGET = { mp4: 300000, webp: 60000 };
const { run, step, until, must, images, main } = reelKit({ dest: DEST, out: OUT, port: PORT, cropH: CROP_H, size: SIZE, budget: BUDGET });

// ── the household: capture.mjs's, aged 7 (the ages 5-8 games) ──
const KID = { "sona.profile.v1": JSON.stringify({ childName: NAME, childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: true, soundOn: true, volume: 0.8, weeklyGoal: 5 }) };
const CFG = (dice) => ({ seed: KID, dice });

// ── a Say & Play story game, started ──
// The start card's "Let's play" (the iPhone plays nothing before a tap), then
// the grown-up's yes to the mic if the page asks for it.
async function begin(page) {
  await must(page, "the start card", until(page, () => document.querySelector("#startOvl.show") && window.__sayplay, 20000));
  await images(page);
  await page.evaluate(() => document.getElementById("startBtn").click());
  await run(page, 300);
  if (await page.evaluate(() => !!document.querySelector("#primer.show"))) { await page.evaluate(() => document.getElementById("primerYes").click()); await run(page, 300); }
}
// The child: once Echo's turn's mic is open, the word said as many times as
// the game asks (three in every story game), each saying 0.3 s with a third
// of a second's quiet between them (sayplay hears a saying only after 200 ms
// under its bar, and never sooner than 450 ms after the last).
function talker(page) {
  let on = 0, wait = 0;
  return async () => {
    if (on > 0) { if (--on === 0) await page.evaluate(() => { __dev.voice = false; }); return; }
    const g = await page.evaluate(() => window.__sayplay || {});
    if (!g.listening || g.phase === "play") { wait = 0; return; }
    if (wait++ < (g.said ? 10 : 4)) return;
    wait = 0; on = 9;
    await page.evaluate(() => { __dev.voice = true; });
  };
}
// play on, unfilmed, until `steps` moves are done and the next word is being
// asked (its turn just begun: Echo asking, nothing said yet)
async function toTurn(page, drive, steps, most = 60000) {
  const at = (n) => page.evaluate((n) => !!window.__sayplay && __sayplay.step >= n && __sayplay.phase === "turn" && !__sayplay.said, n);
  for (let t = 0; t < most / 33 && !(await at(steps)); t++) await step(page, drive);
  await must(page, "word " + (steps + 1) + "'s turn", at(steps));
}
// A ring scene's end (see the kit's film): the clip runs from `lead` frames
// after the move is earned (probe field `earn` going true: the word heard)
// to `tail` frames after the moment it pays off (field `hit` going true), and
// is 3.0 to 3.5 s long; a slower move opens later in it. A move that pays
// off too soon for that (the clip would open on the wait for the word), or
// whose tail runs into the next word's turn, stops the scene there and then
// with the numbers, so its pace or tail can be put right.
const MIN = 90, MAX = 105;
const moveEnd = (earn, hit, lead, tail) => function (h) {
  const end = h.length - 1, at = end - tail;
  const rose = (f, i) => i > 0 && !!h[i][f] && !h[i - 1][f];
  if (!rose(hit, at)) return false;
  let e = at;
  while (e > 0 && !rose(earn, e)) e--;
  if (!rose(earn, e)) throw new Error("the moment came with no word heard before it");
  for (let i = e; i <= end; i++) {
    if (!h[i][earn]) throw new Error("the move ended " + (i - at) + " frames after the moment, inside the tail of " + tail);
    if (i > e && i < at && rose(hit, i)) throw new Error("the move paid off twice");
  }
  let start = Math.max(e + lead, end + 1 - MAX);
  if (end + 1 - start < MIN) start = end + 1 - MIN;
  if (start < e) throw new Error("the move is too quick: " + (at - e) + " frames from the word to the moment, needs at least " + (MIN - 1 - tail + lead));
  this._t = { earned: +((e - start) / FPS).toFixed(2), moment: +((at - start) / FPS).toFixed(2), len: +((end + 1 - start) / FPS).toFixed(2) };
  return end + 1 - start;
};
// the finger along a path: down at its first point, one step of at most
// `speed` points a frame toward each next one, then held on `last()` (a
// moving target is followed) until `done()`
function pathFinger(page, speed) {
  let at = null, todo = null;
  return {
    get on() { return !!at; },
    async go(points) { todo = points.slice(1); at = { ...points[0] }; await page.mouse.move(at.x, at.y); await page.mouse.down(); },
    async step(target) {
      if (!at) return;
      const goal = todo.length ? todo[0] : target;
      if (!goal) return;
      const dx = goal.x - at.x, dy = goal.y - at.y, d = Math.hypot(dx, dy), k = d > speed ? speed / d : 1;
      at = { x: at.x + dx * k, y: at.y + dy * k };
      if (todo.length && k === 1) todo.shift();
      await page.mouse.move(at.x, at.y);
    },
    async lift() { if (at) { await page.mouse.up(); at = null; todo = null; } },
  };
}
// ── finger scripts ──
// A move written as an async generator that yields once a frame (each yield
// is a frame of game time), so it reads in order and a drag still takes the
// time a child's finger does. script(make) runs one a frame a call, and
// makes a fresh one when it ends.
function script(make) {
  let it = null;
  return async () => { if (!it) it = make(); const r = await it.next(); if (r.done) it = null; };
}
async function* rest(n) { for (let i = 0; i < n; i++) yield; }
// wait, a frame at a time, for the page to say so
async function* waitFor(page, fn, arg) { while (!(await page.evaluate(fn, arg))) yield; }
// the centre of an element, and a point of the story game's canvas (its
// snapshots give points as fractions of the canvas)
const centre = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const onCanvas = (page, p) => page.evaluate((p) => { const r = document.getElementById("dailyCanvas").getBoundingClientRect(); return { x: r.left + p.x * r.width, y: r.top + p.y * r.height }; }, p);
async function* tap(page, at) { await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.up(); yield; }
// a finger already down, moved from `a` to `to` (eased in and out, about
// `speed` points a frame)
async function* glide(page, a, to, speed = 11) {
  const n = Math.max(2, Math.ceil(Math.hypot(to.x - a.x, to.y - a.y) / speed));
  for (let i = 1; i <= n; i++) {
    const t = i / n, k = t * t * (3 - 2 * t);
    await page.mouse.move(a.x + (to.x - a.x) * k, a.y + (to.y - a.y) * k); yield;
  }
}
// press at `from`, slide through `points`, hold a moment, let go
async function* slide(page, from, points, speed = 11, hold = 2) {
  let at = { ...from };
  await page.mouse.move(at.x, at.y); await page.mouse.down(); yield;
  for (const to of points) { yield* glide(page, at, to, speed); at = { ...to }; }
  yield* rest(hold);
  await page.mouse.up(); yield;
}
const SCENES = {};

// ── Day 1: Light the Way ──
// The lamp lights on the word; the finger sweeps the pool of light out over
// the fog and onto the lost tugboat, and holds it there: the boat's lantern
// blazes, it toots ("Toot toot! Found it!"), Echo and the buddy cheer, and it
// chugs home. Cropped between the moon and the buttons under the ledge: the
// sea, the lamp's beam and the ledge with Echo and the buddy.
SCENES.lighthouse = {
  url: "/arcade-lighthouse.html", cfg: CFG(7), seconds: 3, most: 20, cropY: 212,
  what: "the tugboat found", probe: () => ({ lamp: !!window.__lighthouse && __lighthouse.lampOn, found: !!window.__lighthouse && __lighthouse.beat > 0 }),
  end: moveEnd("lamp", "found", 10, 30),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.find = boatFinder(page);
  },
  drive() { return both(this._s.talk, this._s.find)(); },
  debug: () => { const l = window.__lighthouse; return l && { stage: l.stage, lamp: l.lampOn, beat: l.beat, hold: l.target && l.target.hold, t: l.target && [Math.round(l.target.sx), Math.round(l.target.sy)], pool: l.pool && [Math.round(l.pool.sx), Math.round(l.pool.sy)], sp: window.__sayplay && [__sayplay.step, __sayplay.phase, __sayplay.said] }; },
};
// once the lamp is lit, a beat, then the finger down on the pool and
// sweeping out over the town's fog before it slides onto the boat (where it
// is now: a drifting boat is followed), held there until it is found
function boatFinder(page) {
  const f = pathFinger(page, 7);
  let wait = 0;
  return async () => {
    const s = await page.evaluate(() => { const l = window.__lighthouse; return l && l.lampOn && l.beat === 0 && l.target && l.target.kind === "boat" && l.pool ? { t: { x: l.target.sx, y: l.target.sy }, p: { x: l.pool.sx, y: l.pool.sy } } : null; });
    if (!s) { wait = 0; return f.lift(); }
    if (wait++ < 6) return;
    if (!f.on) return f.go([s.p, { x: s.p.x + 115, y: s.p.y + 90 }]);
    return f.step(s.t);
  };
}

// ── Day 2: Wind-Up Toys ──
// The word pops the bunny's key out; the finger draws circles round the
// brass dial at a child's pace, the needle climbs the rainbow to the star,
// the finger lets go there, and the bunny wakes and plays its drum (the clip
// ends on the drum, before the next toy hops onto the bench). Cropped from
// the bench (the bunny, Echo, Grandpa Bear) to the dial's foot, above the
// buttons.
SCENES.windup = {
  url: "/arcade-windup.html", cfg: CFG(7), seconds: 3, most: 20, cropY: 205,
  what: "the bunny wound up and drumming",
  probe: () => ({ play: !!window.__sayplay && __sayplay.phase === "play", woke: !!window.__windup && __windup.react === "wake" }),
  end: moveEnd("play", "woke", 8, 20),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.wind = winder(page);
  },
  drive() { return both(this._s.talk, this._s.wind)(); },
  debug: () => { const w = window.__windup; return w && { toy: w.toy, active: w.active, key: w.keyOut, turns: +w.turns.toFixed(2), need: w.need, react: w.react, lastTry: w.lastTry, beat: w.beat, sp: window.__sayplay && [__sayplay.step, __sayplay.phase, __sayplay.said] }; },
};
// once the key is out, a beat, then the finger down on the dial and round
// it, a turn every 26 frames, until the needle is in the middle of the star
// (the toy's `need`); then it lets go
function winder(page) {
  let wait = 0, a = null;
  return async () => {
    const w = await page.evaluate(() => { const w = window.__windup, c = document.getElementById("windupCanvas").getBoundingClientRect(); return w && w.active && w.keyOut && !w.react ? { x: c.left + w.dial.x, y: c.top + w.dial.y, r: w.dial.r, turns: w.turns, need: w.need } : null; });
    if (!w) { wait = 0; if (a !== null) { await page.mouse.up(); a = null; } return; }
    if (wait++ < 6) return;
    const r = w.r * 0.8;
    if (a === null) { a = -Math.PI / 2; await page.mouse.move(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r); await page.mouse.down(); return; }
    if (w.turns >= w.need - 0.02) { await page.mouse.up(); a = null; return; }
    a += 2 * Math.PI / 26;
    await page.mouse.move(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r);
  };
}

// ── Day 3: Puzzle Bridge ──
// The word calls the L stone up out of the river, turned the wrong way; a
// tap turns it a quarter turn, and the finger slides it across into its hole
// in the bridge: it drops in with a thunk ("Click!"), blossoms pop up and
// Echo and the buddy cheer. Cropped under the banner, down to Echo and the
// buddy on the bank.
SCENES.bridge = {
  url: "/arcade-bridge.html", cfg: CFG(7), seconds: 3, most: 20, cropY: 212,
  what: "the stone dropping into its hole",
  probe: () => ({ play: !!window.__sayplay && __sayplay.phase === "play", seated: !!window.__bridge && __bridge.beat > 0 }),
  end: moveEnd("play", "seated", 8, 33),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.fit = stoneFitter(page);
  },
  drive() { return both(this._s.talk, this._s.fit)(); },
  debug: () => { const b = window.__bridge; return b && { shape: b.shape, need: b.need, state: b.pos && b.pos.state, pos: b.pos && [Math.round(b.pos.sx), Math.round(b.pos.sy)], hole: b.hole && [Math.round(b.hole.sx), Math.round(b.hole.sy)], beat: b.beat, sp: window.__sayplay && [__sayplay.step, __sayplay.phase, __sayplay.said] }; },
};
// once the stone floats, a beat, then a tap on it for each quarter turn it
// needs (each spin let finish), then a press on it and a slide, at a child's
// pace, until it sits over its hole; then the finger lets go
function stoneFitter(page) {
  let wait = 0, drag = null;
  return async () => {
    const b = await page.evaluate(() => { const b = window.__bridge; return b && b.pos && b.beat === 0 && __sayplay.phase === "play" ? { need: b.need, state: b.pos.state, turning: b.pos.turning, x: b.pos.sx, y: b.pos.sy, hx: b.hole.sx, hy: b.hole.sy } : null; });
    if (!b) { wait = 0; if (drag) { await page.mouse.up(); drag = null; } return; }
    if (drag) {
      const dx = b.hx - drag.x, dy = b.hy - drag.y, d = Math.hypot(dx, dy), k = d > 8 ? 8 / d : 1;
      if (d < 1) { await page.mouse.up(); drag = null; wait = 0; return; }
      drag = { x: drag.x + dx * k, y: drag.y + dy * k };
      return page.mouse.move(drag.x, drag.y);
    }
    if (b.state !== "float" || b.turning) { wait = 0; return; }
    if (wait++ < 8) return;
    wait = 0;
    await page.mouse.move(b.x, b.y); await page.mouse.down();
    if (b.need > 0) return page.mouse.up();   // a tap: a quarter turn
    drag = { x: b.x, y: b.y };
  };
}

// ── Day 4: The Thirsty Waterwheel Garden ──
// The first word: the finger joins the spring to the waterwheel with three
// leaf troughs (each picked from the tray, turned with the arrows and
// carried up onto its outline), then taps Open water: the water runs along
// the troughs and fills the wheel, which turns ("The wheel is turning!").
// The clip is the end of it: from the tap on Open water to the wheel full
// (the water takes about three seconds). Cropped from just under the
// banner to the tray and its buttons.
SCENES.waterwheel = {
  url: "/story-game.html?story=waterwheel", cfg: CFG(7), seconds: 3, most: 20, cropY: 209,
  what: "the water reaching the wheel",
  probe: () => { const g = window.__dailyWaterwheel; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 1 }; },
  end: moveEnd("play", "hit", 6, 4),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => troughWork(page));
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyWaterwheel; return g && { stage: g.stage, goal: g.goal, active: g.active, placed: g.pieces.map((p) => p.placed), gate: g.gateOpen, fill: g.targets[g.goal] && +g.targets[g.goal].fill.toFixed(2), goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
const wrapAngle = (n) => Math.atan2(Math.sin(n), Math.cos(n));
// each trough still in the tray: a tap picks it, the arrows turn it to its
// outline's angle (an eighth of a half turn a tap), and the finger carries
// it onto its outline; then Open water, and the water runs
async function* troughWork(page) {
  yield* waitFor(page, () => { const g = window.__dailyWaterwheel; return !!g && g.active && __sayplay.phase === "play"; });
  yield* rest(6);
  for (let n = 0; n < 6; n++) {
    const p = await page.evaluate(() => __dailyWaterwheel.pieces.find((p) => !p.placed));
    if (!p) break;
    yield* tap(page, await centre(page, '[data-trough="' + p.id + '"]'));
    yield* rest(5);
    const turns = Math.round(wrapAngle(p.target.angle - p.angle) / (Math.PI / 8));
    for (let i = 0; i < Math.abs(turns); i++) {
      yield* tap(page, await centre(page, 'button[aria-label="Turn selected trough ' + (turns < 0 ? "left" : "right") + '"]'));
      yield* rest(4);
    }
    const q = await page.evaluate((id) => __dailyWaterwheel.pieces.find((p) => p.id === id), p.id);
    yield* slide(page, await onCanvas(page, q), [await onCanvas(page, q.target)], 11);
    yield* rest(5);
  }
  yield* rest(4);
  if (!(await page.evaluate(() => __dailyWaterwheel.gateOpen))) yield* tap(page, await centre(page, ".waterwheel-gate"));
  yield* waitFor(page, () => !__dailyWaterwheel.active);
}

// ── Day 5: The Little Island Postboat ──
// The first word: the finger drags from the postboat out across the water
// and holds while it paddles round to Otter's jetty, then taps Dock and
// loads the pictured parcels aboard. The clip is the end of it: the boat
// coming alongside, docking and the parcels going aboard. Cropped to the
// harbour map, between the banner and the steering controls.
SCENES.postboat = {
  url: "/story-game.html?story=postboat", cfg: CFG(7), seconds: 3, most: 30, cropY: 200,
  what: "the parcels loaded at the jetty",
  probe: () => { const g = window.__dailyPostboat; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 1 }; },
  end: moveEnd("play", "hit", 6, 24),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => postWork(page));
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyPostboat; return g && { stage: g.stage, active: g.active, obj: g.objective && [g.objective.type, g.objective.station], boat: [+g.boat.x.toFixed(3), +g.boat.y.toFixed(3), +g.boat.heading.toFixed(2), g.boat.moored], can: g.stations[g.objective ? g.objective.station : "depot"] && g.stations[g.objective ? g.objective.station : "depot"].canDock, action: g.action, cargo: g.cargo, goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// The boat paddled toward a point (as fractions of the canvas): the finger
// presses on the boat and moves out to the point at a child's pace, then
// stays there while the boat paddles after it; it lets go once the boat is
// within `radius` points of it, or has stopped getting closer, and taps
// Stop (tests/daily-postboattest.mjs's paddleLeg, a frame at a time)
async function* paddle(page, target, radius) {
  let g = await page.evaluate(() => __dailyPostboat), at = await onCanvas(page, g.boat);
  const to = await onCanvas(page, target);
  await page.mouse.move(at.x, at.y); await page.mouse.down(); yield;
  let last = Infinity, still = 0;
  for (let t = 0; t < 450; t++) {
    g = await page.evaluate(() => __dailyPostboat);
    const d = Math.hypot((g.boat.x - target.x) * g.width, (g.boat.y - target.y) * g.height);
    if (d <= radius) break;
    if (Math.abs(last - d) < 0.05) { if (++still > 45) break; } else still = 0;
    last = d;
    const dx = to.x - at.x, dy = to.y - at.y, n = Math.hypot(dx, dy), k = n > 12 ? 12 / n : 1;
    at = { x: at.x + dx * k, y: at.y + dy * k };
    await page.mouse.move(at.x, at.y); yield;
  }
  await page.mouse.up(); yield;
  if (await page.evaluate(() => !document.getElementById("postboatStop").disabled)) yield* tap(page, await centre(page, "#postboatStop"));
}
// a dock job, as the suite's approachDock and finishStage do it: round to a
// point behind the dock along its heading, in to the dock, short paddles
// along the heading until it may dock, then the action button (Dock, Load,
// ...) until the job is done
async function* postWork(page) {
  yield* waitFor(page, () => { const g = window.__dailyPostboat; return !!g && g.active && __sayplay.phase === "play"; });
  yield* rest(6);
  let approached = false;
  for (let n = 0; n < 24; n++) {
    const g = await page.evaluate(() => __dailyPostboat);
    if (!g.active) return;
    if (g.transfer) { yield* rest(10); continue; }
    if (g.action.enabled) { yield* tap(page, await centre(page, "#postboatAction")); yield* rest(16); continue; }
    if (g.objective.waypoints.length) return;   // (a route job: not this clip's)
    const dock = g.targetDock;
    if (!approached) {
      approached = true;
      yield* paddle(page, { x: dock.x - Math.cos(dock.heading) * 38 / g.width, y: dock.y - Math.sin(dock.heading) * 38 / g.height }, 18);
      yield* paddle(page, dock, Math.max(8, dock.r * g.width * 0.35));
      continue;
    }
    // the bow turned along the dock with a short paddle that way, then Stop
    const at = await onCanvas(page, g.boat), to = await onCanvas(page, { x: g.boat.x + Math.cos(dock.heading) * 0.18, y: g.boat.y + Math.sin(dock.heading) * 0.18 * g.width / g.height });
    await page.mouse.move(at.x, at.y); await page.mouse.down(); yield;
    await page.mouse.move(to.x, to.y); yield* rest(4);
    await page.mouse.up(); yield;
    yield* tap(page, await centre(page, "#postboatStop"));
    yield* rest(6);
    const off = await page.evaluate((d) => { const g = __dailyPostboat; return Math.hypot((g.boat.x - d.x) * g.width, (g.boat.y - d.y) * g.height) > d.r * g.width * 0.85; }, dock);
    if (off) yield* paddle(page, dock, dock.r * g.width * 0.45);
  }
}

// ── Day 6: Breakfast at the Moonberry Bakery ──
// The second word: the finger takes the spoon and stirs round and round the
// bowl until the flour and milk the first word poured turn into dough. The
// first word's job (flour, then milk, each poured to its picture line and
// checked) is played off film. Cropped from Baker Badger to the counter.
SCENES.bakery = {
  url: "/story-game.html?story=bakery", cfg: CFG(7), seconds: 3, most: 20, cropY: 200,
  what: "the dough stirred",
  probe: () => { const g = window.__dailyBakery; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 2 }; },
  end: moveEnd("play", "hit", 6, 24),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => bakeryWork(page));
    await toTurn(page, both(s.talk, s.play), 1);
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyBakery; if (!g) return null; const b = g.batches[g.batch]; return { stage: g.stage, phase: g.phase, active: g.active, flour: +b.flour.toFixed(2), liquid: +b.liquid.toFixed(2), checked: [b.flourChecked, b.liquidChecked], mix: +b.mix.toFixed(2), goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// the bakery's jobs as tests/daily-bakerytest.mjs plays them: a pour is the
// tool carried over the bowl and held there until the amount reaches its
// picture line, then the line checked (levelled first if it ran over); a mix
// is the spoon pressed and stirred round the bowl until the dough is made
async function* bakeryWork(page) {
  yield* waitFor(page, () => { const g = window.__dailyBakery; return !!g && g.active && __sayplay.phase === "play"; });
  yield* rest(6);
  const g = await page.evaluate(() => __dailyBakery);
  if (g.phase === "pourFlour" || g.phase === "pourLiquid") {
    const key = g.phase === "pourFlour" ? "flour" : "liquid", from = await centre(page, "#bakeryTool");
    await page.mouse.move(from.x, from.y); await page.mouse.down(); yield;
    yield* glide(page, from, await onCanvas(page, { x: g.bowl.x - (g.tool.spout.x - g.tool.x), y: g.bowl.y - 0.15 * g.width / g.height }), 9);
    yield* waitFor(page, (k) => { const g = __dailyBakery, b = g.batches[g.batch]; return b[k] >= b[k + "Target"] - g.amountBand * 0.5; }, key);
    await page.mouse.up(); yield;
    yield* rest(24);
    if (await page.evaluate((k) => { const g = __dailyBakery, b = g.batches[g.batch]; return b[k] > b[k + "Target"] + g.amountBand; }, key)) { yield* tap(page, await centre(page, "#bakeryLevel")); yield* rest(8); }
    yield* tap(page, await centre(page, "#bakeryAction"));
    yield* rest(8);
    return;
  }
  if (g.phase === "mix") {
    const c = g.bowl, rx = c.ringRadius, ry = c.ringRadius * g.width / g.height, n = g.completedGoals.length;
    const ring = (i) => onCanvas(page, { x: c.x + Math.cos(i / 48 * 2 * Math.PI) * rx, y: c.y + Math.sin(i / 48 * 2 * Math.PI) * ry });
    const from = await centre(page, "#bakeryTool");
    await page.mouse.move(from.x, from.y); await page.mouse.down(); yield;
    yield* glide(page, from, await ring(0), 9);
    for (let i = 1; i < 48 * 6 && (await page.evaluate((n) => __dailyBakery.active && __dailyBakery.completedGoals.length === n, n)); i++) {
      const p = await ring(i);
      await page.mouse.move(p.x, p.y); yield;
    }
    await page.mouse.up(); yield;
  }
}

// ── Day 7: Tortoise's New Front Door ──
// The first word: the finger drags the crane's hook down to the plank lying
// on the bank, links it, hoists it, turns it upright with the Turn button,
// swings it over the stream to the dashed outline by the bank and lets it
// down: the first support stands ("Your bridge is growing stronger!"). The
// clip is the end of it. Cropped between the banner and the crane controls.
SCENES.frontdoor = {
  url: "/story-game.html?story=frontdoor", cfg: CFG(7), seconds: 3, most: 25, cropY: 172,
  what: "the first support in place",
  probe: () => { const g = window.__dailyBridge; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 1 }; },
  end: moveEnd("play", "hit", 6, 22),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => craneWork(page));
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyBridge; return g && { stage: g.stage, phase: g.phase, active: g.active, hook: [+g.crane.hook.x.toFixed(3), +g.crane.hook.y.toFixed(3)], load: g.crane.load && [g.crane.load.id, g.crane.load.lifted, +g.crane.load.angle.toFixed(2)], can: g.landing.canRelease, placed: g.placed, goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// the hook to a point (as fractions of the canvas): the finger on the hook,
// aimed against the load's swing the way tests/daily-bridgetest.mjs aims it
// (the crane moves at its own winch speed; the finger only leads it), until
// the hook hangs still there; then the crane is stopped
async function* hookTo(page, target) {
  let at = await centre(page, "#bridgeHook");
  await page.mouse.move(at.x, at.y); await page.mouse.down(); yield;
  for (let t = 0; t < 400; t++) {
    const g = await page.evaluate(() => __dailyBridge);
    if (Math.hypot((g.crane.hook.x - target.x) * g.width, (g.crane.hook.y - target.y) * g.height) < 5 && Math.abs(g.crane.velocity) < 0.015) break;
    const aim = await onCanvas(page, { x: target.x - Math.sin(g.crane.theta) * g.crane.length * g.height / g.width, y: g.crane.boomY + (target.y - g.crane.boomY) / Math.cos(g.crane.theta) });
    const dx = aim.x - at.x, dy = aim.y - at.y, d = Math.hypot(dx, dy), k = d > 14 ? 14 / d : 1;
    at = { x: at.x + dx * k, y: at.y + dy * k };
    await page.mouse.move(at.x, at.y); yield;
  }
  await page.mouse.up(); yield;
  yield* tap(page, await centre(page, "#bridgeStop"));
}
// one piece of the bridge, as tests/daily-bridgetest.mjs's cranePiece places
// it: hooked and linked at its pile, hoisted clear, turned to its outline's
// angle, carried there and let go
async function* craneWork(page) {
  yield* waitFor(page, () => { const g = window.__dailyBridge; return !!g && g.active && g.phase === "crane" && __sayplay.phase === "play"; });
  yield* rest(6);
  let g = await page.evaluate(() => __dailyBridge);
  const p = g.current;
  if (!g.crane.load) { yield* hookTo(page, p.source); yield* rest(4); yield* tap(page, await centre(page, "#bridgeLift")); yield* rest(6); }
  yield* hookTo(page, { x: p.source.x, y: p.safeLiftY });
  g = await page.evaluate(() => __dailyBridge);
  let d = p.target.angle - g.crane.load.commandAngle;
  while (d > Math.PI / 2) d -= Math.PI;
  while (d < -Math.PI / 2) d += Math.PI;
  const n = Math.round(d / (Math.PI / 12));
  for (let i = 0; i < Math.abs(n); i++) { yield* tap(page, await centre(page, n > 0 ? "#bridgeRotateRight" : "#bridgeRotateLeft")); yield* rest(4); }
  yield* hookTo(page, p.target);
  yield* rest(4);
  yield* tap(page, await centre(page, "#bridgeLift"));
  yield* rest(10);
}

// ── Day 8: The Glowworm Lantern Walk ──
// The second word: the first mushroom lamp already has its supply cord from
// the power box (the first word's job), so the finger picks the return cord,
// plugs one end into the lamp and the other into the power box, and flicks
// the lamp's switch: the lamp glows. Cropped to the three rows of lamps, the
// cords coming up from the tray under them.
SCENES.lantern = {
  url: "/story-game.html?story=lantern", cfg: CFG(7), seconds: 3, most: 20, cropY: 208,
  what: "the first lamp lit",
  probe: () => { const g = window.__dailyLantern; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 2 }; },
  end: moveEnd("play", "hit", 6, 20),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => lanternWork(page));
    await toTurn(page, both(s.talk, s.play), 1);
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyLantern; return g && { stage: g.stage, phase: g.phase, target: g.target, mode: g.mode, active: g.active, wires: g.wires.filter((w) => w.group === g.target).map((w) => w.role + ":" + w.ends.join("|")), lit: g.groups.filter((v) => v.lit).map((v) => v.id), goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// the lamp of the moment's cords (supply, then return; the first job wants
// only the supply), each end from the tray to the socket the game suggests,
// then its switch closed
async function* lanternWork(page) {
  yield* waitFor(page, () => { const g = window.__dailyLantern; return !!g && g.active && __sayplay.phase === "play"; });
  yield* rest(4);
  const g = await page.evaluate(() => { const g = __dailyLantern; return { phase: g.phase, target: g.target, mode: g.mode, suggested: g.suggested, wires: g.wires.filter((w) => w.group === g.target), lamp: g.groups.find((v) => v.id === g.target), terminals: g.terminals }; });
  for (const role of g.phase === "feed" ? ["supply"] : ["supply", "return"]) {
    const w = g.wires.find((w) => w.role === role);
    if (!w || w.complete) continue;
    if (g.mode !== role) { yield* tap(page, await centre(page, "#lantern" + role[0].toUpperCase() + role.slice(1))); yield* rest(4); }
    for (const n of [0, 1]) {
      const id = g.suggested[role][n];
      if (w.ends[n] === id) continue;
      yield* slide(page, await centre(page, "#lanternEnd" + n), [await onCanvas(page, g.terminals.find((t) => t.id === id))], 11);
      yield* rest(3);
    }
  }
  const lamp = await page.evaluate(() => { const g = __dailyLantern; return g.active && g.phase !== "feed" ? g.groups.find((v) => v.id === g.target) : null; });
  if (lamp && !lamp.closed) { yield* tap(page, await centre(page, "#lanternSwitch-" + g.target)); yield* rest(6); }
}

// ── Day 9: All Aboard for Snowdrop Valley ──
// The third word: Squirrel, Badger and the duck family climb aboard, the
// points are set for the sledding hill, and the finger holds the throttle
// while the little train runs up the line to the hill; then Squirrel is set
// down on the platform. The clip is the end of it: the run up the hill and
// Squirrel home. The first two words (each a rail piece turned and laid in
// its gap) are played off film. Cropped from under the banner to the
// station, above the controls.
SCENES.trainline = {
  url: "/story-game.html?story=trainline", cfg: CFG(7), seconds: 3, most: 30, cropY: 200,
  what: "the train at the hill and Squirrel off",
  probe: () => { const g = window.__dailyTrainline; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 3 }; },
  end: moveEnd("play", "hit", 6, 18),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => railWork(page));
    await toTurn(page, both(s.talk, s.play), 2);
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyTrainline; return g && { stage: g.stage, phase: g.phase, active: g.active, target: g.targetPassenger, route: g.route, train: [g.train.edge, +g.train.fraction.toFixed(3), +g.train.speed.toFixed(3)], who: g.passengers.map((p) => p.id + ":" + p.state), goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// a rail job: the waiting piece turned to its gap (15 degrees a tap) and laid
// in it; the first passenger leg: everyone waiting helped aboard, the points
// set for the hill, the throttle held to the hill's buffer, Squirrel set down
async function* railWork(page) {
  yield* waitFor(page, () => { const g = window.__dailyTrainline; return !!g && g.active && __sayplay.phase === "play"; });
  yield* rest(6);
  let g = await page.evaluate(() => __dailyTrainline);
  if (g.phase === "build") {
    const p = g.selectedPiece;
    if (!p) return;
    const turns = Math.round((p.targetAngle - p.angle) / 15);
    for (let i = 0; i < Math.abs(turns); i++) { yield* tap(page, await centre(page, turns < 0 ? "#trainlineRotateLeft" : "#trainlineRotateRight")); yield* rest(4); }
    yield* slide(page, await centre(page, "#trainlineTrack"), [await onCanvas(page, p.target)], 10);
    yield* rest(6);
    return;
  }
  if (g.targetPassenger !== "squirrel") return;
  for (const id of ["squirrel", "badger", "ducks"]) {
    g = await page.evaluate(() => __dailyTrainline);
    const q = g.passengers.find((p) => p.id === id);
    if (!q || q.state !== "waiting") continue;
    yield* slide(page, await centre(page, "#trainlinePassenger-" + id), [await onCanvas(page, g.train.door)], 10);
    yield* rest(6);
  }
  if ((await page.evaluate(() => __dailyTrainline.route)) !== "hill") { yield* tap(page, await centre(page, "#trainlineSwitch")); yield* rest(6); }
  const fw = await centre(page, "#trainlineForward");
  await page.mouse.move(fw.x, fw.y); await page.mouse.down(); yield;
  yield* waitFor(page, () => __dailyTrainline.train.edge === "J_H" && __dailyTrainline.train.fraction > 0.999);
  await page.mouse.up(); yield;
  yield* tap(page, await centre(page, "#trainlineStop"));
  yield* rest(8);
  g = await page.evaluate(() => __dailyTrainline);
  yield* slide(page, await centre(page, "#trainlinePassenger-squirrel"), [await onCanvas(page, g.stations.find((s) => s.id === "H").platform)], 9);
  yield* rest(6);
}

// ── Day 10: The Hilltop Patchwork Kite ──
// The second word: the finger carries the three cloth pictures still in the
// tray up onto their own pictures on the kite, one after another, and the
// kite is whole. (The first word places one; the clip is the second.)
// Cropped from the kite's top to the goat on the hill, above the tray.
SCENES.kite = {
  url: "/story-game.html?story=kite", cfg: CFG(7), seconds: 3, most: 20, cropY: 205,
  what: "the cloth pictures on the kite",
  probe: () => { const g = window.__dailyKite; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 2 }; },
  end: moveEnd("play", "hit", 6, 18),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => kitePatches(page));
    await toTurn(page, both(s.talk, s.play), 1);
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyKite; return g && { stage: g.stage, phase: g.phase, active: g.active, placed: g.patches.filter((p) => p.placed).map((p) => p.id), goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// each cloth picture still in the tray, from its tray button to its own
// picture on the kite, at a child's pace
async function* kitePatches(page) {
  yield* waitFor(page, () => { const g = window.__dailyKite; return !!g && g.active && g.phase === "patch" && __sayplay.phase === "play"; });
  yield* rest(4);
  const p = await page.evaluate(() => __dailyKite.patches.find((p) => !p.placed));
  if (!p) return;
  yield* slide(page, await centre(page, "#kitePatch-" + p.id), [await onCanvas(page, p)], 11);
  yield* rest(2);
}

// ── Day 11: The Sandstone Nest Lift ──
// The second word: the finger holds the winch's Up arrow and the loaded
// basket rises up the cliff as the counterweight sinks, stops it level with
// the first nest, brakes, and slides the blanket in through the doorway. The
// first word's job (the blanket into the lowered basket, the two-dot stone
// into the counterweight pan to balance it) is played off film. Cropped from
// the balance beam to the winch, above the tray.
SCENES.nestlift = {
  url: "/story-game.html?story=nestlift", cfg: CFG(7), seconds: 3, most: 25, cropY: 200,
  what: "the blanket delivered to the nest",
  probe: () => { const g = window.__dailyNestlift; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 2 }; },
  end: moveEnd("play", "hit", 6, 16),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => liftWork(page));
    await toTurn(page, both(s.talk, s.play), 1);
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyNestlift; return g && { stage: g.stage, kind: g.objective && g.objective.kind, active: g.active, cargo: g.lift.cargo, h: +g.lift.height.toFixed(3), by: +g.lift.basket.y.toFixed(3), ly: +g.landing.y.toFixed(3), can: g.landing.canDock, braked: g.lift.braked, stones: g.stones.filter((s) => s.installed).map((s) => s.mass), bal: g.beam.balanced, goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// tests/daily-nestlifttest.mjs's moves: a preparing job loads the bundle into
// the lowered basket and puts the stones whose dots add up to its weight in
// the counterweight pan; a delivery holds Up (or Down) until the basket is
// level with the nest, brakes it with Stop, and slides the bundle in
async function* liftWork(page) {
  yield* waitFor(page, () => { const g = window.__dailyNestlift; return !!g && g.active && __sayplay.phase === "play"; });
  yield* rest(6);
  let g = await page.evaluate(() => __dailyNestlift);
  const load = g.loads.find((l) => l.id === g.objective.load);
  if (g.objective.kind === "prepare") {
    if (g.lift.cargo !== load.id) { yield* slide(page, await centre(page, "#nestliftCargo"), [await onCanvas(page, g.lift.basket)], 9); yield* rest(8); }
    const pick = [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]].find((a) => a.reduce((n, m) => n + m, 0) === load.mass);
    for (const st of g.stones) {
      const want = pick.includes(st.mass);
      if (st.installed === want) continue;
      yield* slide(page, await centre(page, "#nestliftStone-" + st.mass), [await onCanvas(page, want ? st.pan : st.source)], 9);
      yield* rest(6);
    }
    return;
  }
  yield* rest(6);
  const up = g.lift.basket.y > g.landing.y, btn = await centre(page, up ? "#nestliftUp" : "#nestliftDown");
  await page.mouse.move(btn.x, btn.y); await page.mouse.down(); yield;
  yield* waitFor(page, (up) => { const g = __dailyNestlift, d = (g.lift.basket.y - g.landing.y) * g.height; return Math.abs(d) < 5 || (up ? d < 0 : d > 0); }, up);
  await page.mouse.up(); yield;
  yield* tap(page, await centre(page, "#nestliftStop"));
  yield* rest(8);
  for (let t = 0; t < 90 && !(await page.evaluate(() => __dailyNestlift.landing.canDock)); t++) yield;
  yield* rest(6);
  g = await page.evaluate(() => __dailyNestlift);
  yield* slide(page, await centre(page, "#nestliftCargo"), [await onCanvas(page, g.loads.find((l) => l.id === g.objective.load).target)], 6);
  yield* rest(6);
}

// ── Day 12: The Lily-Pad Concert ──
// The first word: the finger taps the drum (Frog beats it), picks the reeds,
// and plucks the low, the middle and the high reed sideways, each its own
// note ("Lovely music! Your notes are safe."). Cropped to the lily pad and
// the dots over it, above the tray of musicians.
SCENES.concert = {
  url: "/story-game.html?story=concert", cfg: CFG(7), seconds: 3, most: 20, cropY: 190,
  what: "every reed and the drum played",
  probe: () => { const g = window.__dailyConcert; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 1 }; },
  end: moveEnd("play", "hit", 6, 18),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => concertExplore(page));
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyConcert; return g && { stage: g.stage, phase: g.phase, active: g.active, ready: g.musicReady, busy: g.voiceBusy, selected: g.selected, tried: g.tried, goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// once the music is ready and Echo is quiet: the drum tapped, the reeds
// chosen, then each reed plucked across, a beat between notes
async function* concertExplore(page) {
  yield* waitFor(page, () => { const g = window.__dailyConcert; return !!g && g.active && g.phase === "explore" && g.musicReady && !g.voiceBusy && __sayplay.phase === "play"; });
  yield* rest(6);
  let g = await page.evaluate(() => __dailyConcert);
  if (!g.tried.drum) {
    if (g.selected !== "drum") { yield* tap(page, await centre(page, "#concertChoose-drum")); yield* rest(6); }
    yield* tap(page, await centre(page, "#concertDrum"));
    yield* rest(14);
  }
  g = await page.evaluate(() => __dailyConcert);
  if (g.objective.id === "drum-reed" || g.objective.id === "all") {
    if (g.selected !== "reed") { yield* tap(page, await centre(page, "#concertChoose-reed")); yield* rest(10); }
    for (const r of g.instruments.reeds) {
      if (g.tried["reed-" + r.pitch]) continue;
      const at = await onCanvas(page, r);
      yield* slide(page, { x: at.x - 16, y: at.y }, [{ x: at.x + 16, y: at.y }], 4, 2);
      yield* rest(14);
    }
  }
}

// ── Day 13: Seeds Across the Rooftops ──
// The fifth word, the planter on top of the tall tower: the finger carries a
// seed pod from the tray into Bird's cup, turns the launch arrow, pulls the
// spring back and taps Launch; the pod arcs high over the rooftops into the
// glowing planter, its second seed, and Bird waters the new leaves. The four
// words before it (the near planters, seven pods) are played off film the
// same way. Cropped between the banner and the tray: the arch, the towers,
// the planters, Bird and the springboard.
SCENES.rooftops = {
  url: "/story-game.html?story=rooftops", cfg: CFG(7), seconds: 3, most: 25, cropY: 178,
  what: "the seed landing in the tower's planter",
  probe: () => { const g = window.__dailyRooftops; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 5 }; },
  end: moveEnd("play", "hit", 6, 7),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => seedShot(page));
    await toTurn(page, both(s.talk, s.play), 4, 150000);
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyRooftops; return g && { stage: g.stage, target: g.objective && g.objective.id, active: g.active, loaded: g.loaded, angle: +g.angle.toFixed(1), strength: +g.strength.toFixed(2), flying: g.projectile && g.projectile.mode, landings: g.landings, misses: g.misses, goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// The shot, worked out from the board the game publishes, the way
// tests/daily-rooftopstest.mjs does (its trial and chooseShot): every whole
// angle and spring pull flown in the game's own physics, and the one that
// lands nearest the middle of the glowing planter kept.
function rooftopShot(g) {
  const target = g.pots.find((p) => p.id === g.objective.id);
  function trial(angle, pull) {
    const r = angle * Math.PI / 180, speed = g.world.speedBase + g.world.speedScale * pull, dt = 1 / 240;
    const p = { x: g.world.cup.x, y: g.world.cup.y, vx: Math.cos(r) * speed, vy: -Math.sin(r) * speed, bounces: 0 };
    for (let time = 0; time < 5; time += dt) {
      const old = { x: p.x, y: p.y }, wind = time < g.power ? g.wind : g.baseWind / (1 + g.assistance * 0.45);
      p.vx += wind * dt; p.vy += g.world.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const cross = (y) => old.x + (p.x - old.x) * (y - old.y) / (p.y - old.y);
      if (p.vy > 0 && p.y !== old.y) for (const pot of g.pots) if (old.y <= pot.world.y && p.y >= pot.world.y) {
        const x = cross(pot.world.y);
        if (Math.abs(x - pot.world.x) <= pot.catchWidth / 2) return pot.id === target.id && (!g.objective.bankshot || p.bounces) ? { angle, pull, x, time } : null;
      }
      if (p.y !== old.y && (old.y - g.shelter.y) * (p.y - g.shelter.y) <= 0) { const x = cross(g.shelter.y); if (x >= g.shelter.x && x <= g.shelter.x + g.shelter.width) return null; }
      if (p.vy > 0) for (const roof of g.roofs) if (old.y <= roof.y && p.y >= roof.y) { const x = cross(roof.y); if (x >= roof.x && x <= roof.x + roof.width) return null; }
      if (!p.bounces && old.y < g.awning.a.y && p.y >= g.awning.a.y && p.x >= g.awning.a.x && p.x <= g.awning.b.x) { p.y = g.awning.a.y - 1; p.vx *= g.awning.tangentRetention; p.vy = -Math.abs(p.vy) * g.awning.restitution; p.bounces++; }
      if (p.x < 5 || p.x > 1005 || p.y > 688) return null;
    }
    return null;
  }
  let best = null, score = Infinity;
  for (let a = 25; a <= 82; a++) for (let pull = 10; pull <= 100; pull++) {
    const t = trial(a, pull / 100);
    if (t) { const v = Math.abs(t.x - target.world.x) + t.time * 0.01; if (v < score) { best = t; score = v; } }
  }
  return best;
}
// a point of the rooftops' world (1000 x 700), as a fraction of the canvas
const roofPoint = (g, x, y) => ({ x: g.board.x + x * g.board.width / g.world.width, y: g.board.y + y * g.board.height / g.world.height });
// a pod into the cup, the arrow turned and the spring pulled to the
// worked-out shot, and Launch
async function* seedShot(page) {
  yield* waitFor(page, () => { const g = window.__dailyRooftops; return !!g && g.active && !g.projectile && __sayplay.phase === "play"; });
  yield* rest(8);
  let g = await page.evaluate(() => __dailyRooftops);
  if (!g.loaded) { yield* slide(page, await centre(page, "#rooftopsSeed"), [await onCanvas(page, g.cup)], 8); yield* rest(14); }
  g = await page.evaluate(() => __dailyRooftops);
  const shot = rooftopShot(g);
  if (!shot) throw new Error("no shot reaches planter " + g.objective.id);
  // (the arrow a little past the angle first, then back to it, as a hand
  // finds it)
  const aim = (deg) => onCanvas(page, roofPoint(g, g.world.cup.x + 160 * Math.cos(deg * Math.PI / 180), g.world.cup.y - 160 * Math.sin(deg * Math.PI / 180)));
  yield* slide(page, await centre(page, "#rooftopsAim"), [await aim(Math.min(82, shot.angle + 9)), await aim(shot.angle)], 6);
  yield* rest(8);
  const spring = await centre(page, "#rooftopsSpring"), to = await onCanvas(page, roofPoint(g, 390 + 125 * shot.pull, 0));
  yield* slide(page, spring, [{ x: to.x, y: spring.y }], 6);
  yield* rest(12);
  yield* tap(page, await centre(page, "#rooftopsLaunch"));
  yield* waitFor(page, () => !__dailyRooftops.projectile || __dailyRooftops.projectile.mode !== "flight");
  yield* rest(4);
}

// ── Day 14: The Moving-Star Observatory ──
// The last word: the finger carries the last small gear from the tray onto
// the glowing axle under the stars, then holds the round arrow, and the
// whole wooden sky moves at once: the drive wheel turns every gear, the sun
// climbs, the moon slides along its track and the stars turn ("The whole
// wooden sky is moving!"). The seven words before it are played off film,
// each job its own gears and the same held arrow. Cropped to the wooden sky
// and the tray of gears under it.
SCENES.observatory = {
  url: "/story-game.html?story=observatory", cfg: CFG(7), seconds: 3, most: 20, cropY: 262,
  what: "the whole sky moving",
  probe: () => { const g = window.__dailyObservatory; return { play: !!window.__sayplay && __sayplay.phase === "play", hit: !!g && g.completedGoals.length >= 8 }; },
  end: moveEnd("play", "hit", 6, 8),
  async stage(s) {
    const { page } = s;
    await begin(page);
    s.talk = talker(page); s.play = script(() => gearWork(page));
    await toTurn(page, both(s.talk, s.play), 7, 120000);
  },
  drive() { return both(this._s.talk, this._s.play)(); },
  debug: () => { const g = window.__dailyObservatory; return g && { stage: g.stage, active: g.active, busy: g.voiceBusy, obj: g.objective && [g.objective.id, +g.objective.stroke.toFixed(2), g.objective.requiredTurn], slots: g.slots.filter((s) => s.size).map((s) => s.id + ":" + s.size), jam: g.network.jammed, goals: g.completedGoals, sp: [__sayplay.step, __sayplay.phase] }; },
};
// the gear each axle takes (tests/daily-observatorytest.mjs's sizes)
const GEAR = { S1: "small", S2: "small", M1: "small", M2: "medium", Md: "small", Ma: "small", Mb: "small", M4: "small", T1: "medium", T2: "small" };
// the gear the job lifts out goes back to the tray, each empty axle of the
// job gets its gear (from the tray, at a child's careful pace), and the round
// arrow is held until the job is done
async function* gearWork(page) {
  yield* waitFor(page, () => { const g = window.__dailyObservatory; return !!g && g.active && __sayplay.phase === "play"; });
  yield* rest(8);
  const g = await page.evaluate(() => { const g = __dailyObservatory; return { remove: g.objective.remove && g.slots.find((s) => s.id === g.objective.remove && s.size) ? g.objective.remove : null, slots: g.objective.slots.map((id) => g.slots.find((s) => s.id === id)), done: g.completedGoals.length, tray: g.tray }; });
  if (g.remove) {
    yield* slide(page, await centre(page, "#observatoryPlaced-" + g.remove), [await onCanvas(page, { x: g.tray.x + g.tray.width * 0.5, y: g.tray.y + g.tray.height * 0.5 })], 8);
    yield* rest(6);
  }
  for (const slot of g.slots) {
    if (slot.size) continue;
    yield* slide(page, await centre(page, "#observatoryGear-" + GEAR[slot.id]), [await onCanvas(page, slot)], 8);
    yield* rest(6);
  }
  const run = await centre(page, "#observatoryRun");
  await page.mouse.move(run.x, run.y); await page.mouse.down(); yield;
  yield* waitFor(page, (n) => __dailyObservatory.completedGoals.length > n || !__dailyObservatory.active, g.done);
  await page.mouse.up(); yield;
}

// the story days' games, in STORY_DAYS' order (tests/homereeltest.mjs reads
// this list and holds it to sona.js's)
export const KEYS = ["lighthouse", "windup", "bridge", "waterwheel", "postboat", "bakery", "frontdoor", "lantern", "trainline", "kite", "nestlift", "concert", "rooftops", "observatory"];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(SCENES, KEYS);
