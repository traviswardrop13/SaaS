// Setup's game reel: short clips of the REAL games, for the "Practice through
// play." screen (Travis, 22 Oct 2026: "Do like a little clip of a few
// games so that parents can see it"; 23 Oct 2026: "I want it to take up the
// whole screen ... rotate through fruit slice, piano tiles, and Flappy Glide,
// and make it clear that in the demo they're saying ... the letter R ... And
// then the game slows down. And just do a 3-second of those three games").
// Nothing here is drawn or edited: each clip is the page in public/, served
// as is on tools/appstore/capture.mjs's fake phone, played with the page's
// own controls and filmed one frame at a time.
//
//   node tools/setupreel/record.mjs                 every game in KEYS
//   node tools/setupreel/record.mjs --only=slice,tiles
//   node tools/setupreel/record.mjs --frames-only   film, no encode (look first)
//   node tools/setupreel/record.mjs --full          the whole screen every half
//                                                   second, to choose a crop
//   node tools/setupreel/record.mjs --encode-only   encode the last frames again
//   node tools/setupreel/record.mjs --debug         each scene's probe, as it films
//                                                   (--debug=1: every frame)
//
// Writes public/assets/setup/reel/<key>.mp4 (540x1080, 1:2, 30 fps, 4 s,
// H.264 High, no audio track, moov first) and <key>.webp (its first frame),
// and a contact sheet per clip in tools/setupreel/out/sheets/ (git ignores
// out/): LOOK at every sheet before committing a clip (a lost heart, an empty
// sky, a dead stretch, a miss the finger should not have made, the ask or
// the slowdown off the frame). Each run prints each clip's moments ("times":
// say, the child's sound heard; slow, the slowdown on; len, the clip), in
// seconds from its first frame (setup shows no caption since 23 Oct 2026:
// the game's own top bar says each moment, so nothing needs copying).
// tests/setupreeltest.mjs checks the files (size, codec, length, colour
// tags, no audio, faststart, poster) and that KEYS and setup's REEL_ORDER
// are its list; it never runs this. A new game on the reel is a scene here,
// a key in KEYS and in that test's list, and setup's own list and times
// (onboarding.html). Needs ffmpeg with libx264 and libwebp, and ImageMagick's
// montage for the sheets. It is CPU heavy (about a minute and a half a clip;
// SETUPREEL_PORT, default 9303): run it alone, not beside a test. The games'
// dice are seeded (cfg.dice, a number; never cfg.seed, which is
// capture.mjs's map of localStorage keys), so a scene films nearly the same
// round each time until a game's code changes; a scene that stalls says
// where ("stalled: …"), and --debug shows why.
//
// How it films (./kit.mjs, the machinery tools/homereel/record.mjs films
// Home's story clips with too): Playwright's virtual clock (page.clock),
// paused, moved on 1/30 s per frame, a screenshot each frame at 390x844 @2x,
// cropped to 1:2 just under the status bar (the whole game: its top, Echo's
// pill and his line, the play, the bottom). The games' requestAnimationFrame,
// timers and performance.now are the clock's, so a frame is exactly 1/30 s
// of the game however long the screenshot takes; their CSS animations
// (banners, Echo's hop) are held and stepped the same 1/30 s through the Web
// Animations API.
// A crop that leaves the screen stops the run (Playwright would trim the
// shot and ffmpeg would stretch it): every frame is 780 x 1560.
//
// It stops, and writes nothing more for that clip, when:
//   - the child's name is on the page in any frame (any case, a whole word).
//     It reads the page's text: a word drawn on a canvas is pixels, and this
//     cannot see it (no game draws a name today; one that starts to is the
//     next thing to check by eye on the sheet);
//   - a clip is still over 400 KB at CRF 36, or a poster over 80 KB at q40
//     (both are made in out/enc/ first: a failed clip never replaces the
//     one in public/);
//   - a frame is not 780 x 1560;
//   - Fruit Slice's clip would open with a heart already lost.
// The clips are tagged BT.709 (matrix, primaries, transfer; limited range)
// and converted with that matrix, so a player reads the colours the way they
// were made and the poster (a WebP, always BT.601 inside) hands over to the
// first frame without a colour jump.
//
// Whose calls these are (built on defaults, 23 Oct 2026):
//   - Travis's: the three games and their order, the moment each shows
//     (about a second of play, then Echo's ask, the sound heard and about
//     two seconds of the slowed game), 4 s a clip, the crop, and the budgets
//     counted strictly (400,000 and 80,000 bytes);
//   - Rachel's: every clip shows R asked by Echo and earned by saying it (the
//     bare sound, as the games ask it), shown to every parent before any
//     sound is picked, a parent of a 2-4 year old too; and that saying the
//     sound is shown making the game easier (Super Slice, slow keys, the
//     slow help).
//
// What is staged, and why it is honest:
//   - capture.mjs's household (an onboarded child on R, Premium through the
//     free-era promise, every era stamp set), as the iPhone app. R is the
//     sound every clip is filmed on (the one example: no sound is picked yet
//     when setup shows them, and nothing on setup names it); the child's name is
//     on no game page, and each clip is checked for it anyway;
//   - Echo's ask is his own: capture.mjs holds his clock (holdAsk) so he
//     never asks at a random moment, and a scene sets that clock to "now" a
//     second into the clip, so the page begins his turn exactly as play time
//     running out would (no tap on him). Then the "child" is capture.mjs's
//     fake microphone: a voiced sound only once his turn's mic is open
//     (__dev.voice, as the test suites do), and the page's own check says
//     yes before the game slows;
//   - the finger is the page's own pointer events (page.mouse), one move a
//     frame, so a swipe takes the time a child's does;
//   - never a Coming soon game: every key below is open on Home.
import path from "path";
import { fileURLToPath } from "url";
import { reelKit, both, line, FPS } from "./kit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const DEST = path.join(REPO, "public/assets/setup/reel");
const OUT = process.env.SETUPREEL_OUT || path.join(HERE, "out");
const PORT = Number(process.env.SETUPREEL_PORT || 9303);

// The phone's 780 px across, cut to a 780 x 1560 window (1:2, everything
// under the status bar) and scaled to 540 x 1080.
const CROP_H = 390 * 2;                         // 780 pt
const SIZE = { w: 540, h: 1080 };
// in bytes, decimal: 400 KB a clip, 80 KB a poster (tests/setupreeltest.mjs)
export const BUDGET = { mp4: 400000, webp: 80000 };
const { run, step, until, must, images, finger, main } = reelKit({ dest: DEST, out: OUT, port: PORT, cropH: CROP_H, size: SIZE, budget: BUDGET });

// ── the scenes ──
// Three clips, one story told three times (Travis, 23 Oct 2026: "make it
// clear that in the demo they're saying ... the letter R ... And then the
// game slows down. And just do a 3-second of those three games"): play,
// Echo's own mid-round ask, the child's "rrrr" heard, and the game slowing
// down while the finger keeps playing. Each is the whole game cropped to
// 1:2 just under the status bar, so setup can lay it full screen.
const CROP_Y = 47;
// the clip's first frame comes this long before the child's sound is heard
const SAY_AT = 1.0;
// how long the child says it (frames), how long after the mic opens ("Go!"
// and its tail are over by then) they start, and how far into the film Echo
// asks (so the clip opens on play, not on his ask)
const VOICE_FRAMES = 12, REACT_FRAMES = 6, ASK_FRAME = 12;
const SCENES = {};
const ROUND = (game) => ({ "sona.play.token": "arcade-" + game + ".html", "sona.boost.sound": "R", "sona.boost.level": "isolation", "sona.boost.ask": "rrrr" });

// Echo's OWN ask, at a moment the scene picks: capture.mjs's holdAsk keeps
// his clock from asking at a random one, and this sets that clock's next ask
// to now, so the page's next tick begins the turn exactly as play time
// running out would (no tap on him). Then, once his turn's mic is open, the
// fake microphone says the sound for VOICE_FRAMES; the page's own check
// decides, and the page's own reward slows the game. Nothing is set.
function speaker(page) {
  let f = 0, wait = -1, on = 0;
  return async () => {
    if (f++ < ASK_FRAME) return;
    if (f === ASK_FRAME + 1) { await page.evaluate(() => { slowAskAt = 0; }); return; }
    if (on > 0) { if (--on === 0) await page.evaluate(() => { __dev.voice = false; }); return; }
    if (wait > 0) { if (--wait === 0) { on = VOICE_FRAMES; await page.evaluate(() => { __dev.voice = true; }); } return; }
    if (wait === -1 && await page.evaluate(() => !!slowTurn && slowTurn.listening)) wait = REACT_FRAMES;
  };
}
// read every frame: the child's voice on, the slowdown on, Echo's turn on
const POWER_PROBE = () => ({ v: !!(window.__dev && __dev.voice), slow: slowMs > 0, ask: !!slowTurn });
// The clip keeps SAY_AT s before the sound is heard and the rest after it,
// so its middle is the slowed game; the moments are reported, counted from
// the clip's first frame.
function powerEnd(h, n) {
  const say = h.findIndex((x) => x.v), slow = h.findIndex((x) => x.slow);
  if (say < 0 || slow < 0) return false;
  const start = Math.max(0, say - Math.round(SAY_AT * FPS));
  if (h.length - n < start) return false;
  this._t = { say: +((say - start) / FPS).toFixed(2), slow: +((slow - start) / FPS).toFixed(2), len: +(n / FPS).toFixed(2) };
  return true;
}

// 1. Fruit Slice: fruit flying, Echo asks ("Super Slice! Say rrrr"), the
// child says it, Super Slice: five fruit at once, slower, the rainbow blade.
SCENES.slice = {
  url: "/arcade-slice.html?from=charge", cfg: { session: ROUND("slice"), dice: 13 }, cropY: CROP_Y, seconds: 4, most: 25,
  what: "the child heard and Super Slice on", probe: POWER_PROBE, end: powerEnd,
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && typeof startWave === "function", 20000));
    await images(page);
    s.finger = finger(page);
    s.cut = sliceCutter(page, s.finger);
    // a short row first, so the counter shows a real one, and fruit in the air
    for (let t = 0; t < 900 && (await page.evaluate(() => rowN)) < 3; t++) await step(page, s.cut);
    // (only three: the wave is six, and its end would bring the break's card)
    await until(page, () => fruits.filter((q) => !q.sliced && q.y < standTop() - 60).length >= 2, 4000);
    // every heart still on: a clip never opens on a fumble
    await must(page, "three hearts", page.evaluate(() => hearts === 3));
    s.say = speaker(page);
  },
  drive() { return both(this._s.say, this._s.cut)(); },
};
// the next fruit to cut: whole, in the sky, near the top of its arc; the
// swipe crosses where it will be four frames on
function sliceCutter(page, fing) {
  let rest = 0;
  return async () => {
    if (fing.busy()) return fing.frame();
    if (rest-- > 0) return;
    const pts = await page.evaluate((top) => {
      const r = document.getElementById("cv").getBoundingClientRect(), fac = slowFactor() * slicePace();
      const up = fruits.filter((q) => !q.sliced && q.y < standTop() - 50 && r.top + q.y > top + 120 && q.vy > -2.5);
      if (!up.length) return null;
      const f = up.sort((a, b) => Math.abs(a.vy) - Math.abs(b.vy))[0], k = 4;
      const x = f.x + f.vx * fac * k, y = f.y + f.vy * fac * k + 0.5 * (f.g || G) * fac * fac * k * k;
      const dir = Math.random() < 0.5 ? -1 : 1;
      return { x0: r.left + x - dir * 85, y0: r.top + y + 40, x1: r.left + x + dir * 85, y1: r.top + y - 40 };
    }, CROP_Y);
    if (!pts) return;
    fing.start(line(pts.x0, pts.y0, pts.x1, pts.y1, 5));
    rest = 5;
    return fing.frame();
  };
}

// 2. Piano Tiles: a song coming down the lanes, Echo asks ("To slow the
// keys, say rrrr"), the child says it, slow keys: the tiles at 55%.
SCENES.tiles = {
  url: "/arcade-tiles.html?from=charge", cfg: { session: ROUND("tiles") }, cropY: CROP_Y, seconds: 4, most: 25,
  what: "the child heard and slow keys on", probe: POWER_PROBE, end: powerEnd,
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && typeof startSong === "function", 20000));
    await images(page);
    s.play = tilePlayer(page);
    // into the song, past the three tiles that wait on the keys (never as
    // far as the song's end)
    await must(page, "a full song", (async () => {
      for (let t = 0; t < 600; t++) {
        await step(page, s.play);
        if (await page.evaluate(() => phase === "song" && songIx >= 4 && songIx <= 8 && tiles.filter((q) => !q.hit && !q.gone).length >= 3)) return true;
      }
      return false;
    })());
    s.say = speaker(page);
  },
  drive() { return both(this._s.say, this._s.play)(); },
};
// a tile is played when its foot is on the keys, as a child's finger does
function tilePlayer(page) {
  return async () => {
    const t = await page.evaluate(() => {
      const q = tiles.filter((q) => !q.hit && !q.gone && q.y + q.h > HITY() + 4 && q.y < HITY() + 40).sort((a, b) => b.y - a.y)[0];
      if (!q) return null;
      const r = document.getElementById("cv").getBoundingClientRect();
      return { x: r.left + (q.lane + 0.5) * (W / 4), y: r.top + HITY() + 40 };
    });
    if (t) { await page.mouse.move(t.x, t.y); await page.mouse.down(); await page.mouse.up(); }
  };
}

// 3. Flappy Glide: the balloon kept in the gaps with a tap now and then,
// Echo asks ("To slow the beams, say rrrr"), the child says it, the hedges
// slow down.
SCENES.glide = {
  url: "/arcade-glide.html?from=charge", cfg: { session: ROUND("glide") }, cropY: CROP_Y, seconds: 4, most: 25,
  what: "the child heard and the slow help on", probe: POWER_PROBE, end: powerEnd,
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && typeof flap === "function", 20000));
    await images(page);
    s.play = glider(page);
    for (let t = 0; t < 600; t++) {
      await step(page, s.play);
      if (t > 150 && await page.evaluate(() => phase === "fly" && gates.some((g) => g.x > px + 70 && g.x < px + 150 && Math.abs(py - g.cy) < gapH * 0.2))) break;
    }
    s.say = speaker(page);
  },
  drive() { return both(this._s.say, this._s.play)(); },
};
function glider(page) {
  let rest = 0;
  return async () => {
    if (rest-- > 0) return;
    const go = await page.evaluate(() => {
      if (!playing || phase !== "fly") return null;
      const g = gates.filter((g) => g.x + 40 > px).sort((a, b) => a.x - b.x)[0], aim = g ? g.cy + gapH * 0.24 : H * 0.5;   // the lower half of the gap
      if (!(py > aim && vy >= 0)) return null;
      const r = document.getElementById("cv").getBoundingClientRect();
      return { x: r.left + W * 0.6, y: r.top + H * 0.6 };
    });
    if (go) { await page.mouse.move(go.x, go.y); await page.mouse.down(); await page.mouse.up(); rest = 7; }
  };
}

// setup's demo order (Travis, 23 Oct 2026: "rotate through fruit slice,
// piano tiles, and Flappy Glide"); setup keeps its own copy (REEL_ORDER)
export const KEYS = ["slice", "tiles", "glide"];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(SCENES, KEYS);
