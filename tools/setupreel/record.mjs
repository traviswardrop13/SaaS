// Setup's game reel: short clips of the REAL games, for the "They practice by
// playing." screen (Travis, 22 Oct 2026: "Do like a little clip of a few
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
// seconds from its first frame: setup's captions read them (REEL_TIMES in
// onboarding.html), so a clip filmed again means copying them there.
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
// How it films: Playwright's virtual clock (page.clock), paused, moved on
// 1/30 s per frame, a screenshot each frame at 390x844 @2x, cropped to 1:2
// just under the status bar (the whole game: its top, Echo's pill and his
// line, the play, the bottom). The games' requestAnimationFrame, timers and
// performance.now are the clock's, so a frame is exactly 1/30 s of the game
// however long the screenshot takes; their CSS animations (banners, Echo's
// hop) are held and stepped the same 1/30 s through the Web Animations API.
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
//     sound because setup's reel says it is the example; the child's name is
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
import { readFileSync, mkdirSync, rmSync, renameSync, statSync, readdirSync, copyFileSync } from "fs";
import { createServer } from "http";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, launchOpts } from "../../tests/_env.mjs";
import { device, fileFor, MIME, seedOutcomes, seedGameReps, seedProgress } from "../appstore/capture.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const DEST = path.join(REPO, "public/assets/setup/reel");
const OUT = process.env.SETUPREEL_OUT || path.join(HERE, "out");
const PORT = Number(process.env.SETUPREEL_PORT || 9303);
const BASE = "http://127.0.0.1:" + PORT;

// An iPhone 13/14 (390 x 844 pt) at @2x: 780 px across, cut to a 780 x 1560
// window (1:2, everything under the status bar) and scaled to 540 x 1080.
// The safe areas are that phone's.
const VIEW = { width: 390, height: 844 }, DPR = 2, INSET = { top: 47, bottom: 34 };
const CROP_H = VIEW.width * 2;                  // 780 pt
const SIZE = { w: 540, h: 1080 };
// in bytes, decimal: 400 KB a clip, 80 KB a poster (tests/setupreeltest.mjs)
export const BUDGET = { mp4: 400000, webp: 80000 };
const FPS = 30;
// Thursday 22 Oct 2026, 4:10 pm in Idaho.
const AT = Date.parse("2026-10-22T16:10:00-06:00");
const TZ = "America/Boise";
const NAME = "Mia";                             // capture.mjs's household

// ── the server: public/ as it is ──
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  const f = fileFor(u.pathname);
  if (!f) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(f));
});

let browser, FULL = false, DEBUG = 0;
async function open(url, cfg = {}) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, timezoneId: TZ, locale: "en-US" });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (!u.href.startsWith(BASE + "/")) return route.abort();
    if (/\.(html|css|js)$/.test(u.pathname) || u.pathname === "/") {
      const f = fileFor(u.pathname === "/" ? "/index.html" : u.pathname);
      if (f) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()],
        body: readFileSync(f, "utf8").replace(/env\(safe-area-inset-top[^)]*\)/g, INSET.top + "px").replace(/env\(safe-area-inset-bottom[^)]*\)/g, INSET.bottom + "px").replace(/env\(safe-area-inset-(left|right)[^)]*\)/g, "0px") });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  // the clock first, so the fake phone's requestAnimationFrame wrapper wraps
  // the clock's, and the clock owns Date (ownClock)
  await page.clock.install({ time: AT });
  // the game's dice, seeded, so a scene plays the same way every time it is
  // filmed (the same round a child could get: only the order is fixed).
  // cfg.dice is the number; everything else in cfg is the fake phone's
  // (device(), whose cfg.seed is a map of localStorage keys to set)
  const { dice = 7, ...phone } = cfg;
  await context.addInitScript((n) => {
    let a = n >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, Number(dice));
  await context.addInitScript(device, Object.assign({ shift: 0, ownClock: true, native: true, holdAsk: true, goalMet: true,
    outcomes: seedOutcomes(), gameReps: seedGameReps(), progress: seedProgress() }, phone));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + url);
  // the clock runs until paused: a busy machine can pass the moment asked
  // for before the call lands, so it asks again, a little further on
  for (let tries = 0, ahead = 50; ; tries++, ahead *= 2) {
    try { await page.clock.pauseAt((await page.evaluate(() => Date.now())) + ahead); break; }
    catch (e) { if (tries >= 4 || !/to the past/.test(e.message)) throw e; }
  }
  return { context, page, errors };
}

// ── time ──
// A frame is 1/30 s: 33, 33, 34 ms, so three frames are exactly 100 ms.
let tick = 0;
const frameMs = () => [33, 33, 34][tick++ % 3];
async function run(page, ms) { await page.clock.runFor(ms); }
// the page's CSS animations, held and stepped with the clock (a banner that
// slides in over 400 ms takes 12 frames, not one)
const stepAnims = (page, dt) => page.evaluate((dt) => {
  const seen = window.__reelAnims || (window.__reelAnims = new WeakSet());
  for (const a of document.getAnimations()) {
    if (!seen.has(a)) { seen.add(a); a.pause(); continue; }
    if (a.playState !== "paused") a.pause();
    a.currentTime = (Number(a.currentTime) || 0) + dt;
  }
}, dt);
// wait in game time for the page to say so
async function until(page, fn, maxMs, arg, step = 50) {
  for (let t = 0; t <= maxMs; t += step) {
    if (await page.evaluate(fn, arg)) return true;
    await run(page, step);
  }
  return false;
}
async function must(page, what, ok) {
  if (!(await ok)) throw new Error("stalled: " + what);
}
async function images(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].filter((i) => i.src && !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
}

// ── the finger: one pointer move a frame ──
// A gesture is a list of points; frame() plays the next one before the clock
// moves, so a 5-point swipe takes 5 frames (about 170 ms), as a child's does.
function finger(page) {
  let path = null, i = 0;
  return {
    busy: () => !!path,
    start(points) { path = points; i = 0; },
    async frame() {
      if (!path) return;
      const p = path[i];
      if (i === 0) { await page.mouse.move(p.x, p.y); await page.mouse.down(); }
      else await page.mouse.move(p.x, p.y);
      i++;
      if (i >= path.length) { await page.mouse.up(); path = null; }
    },
  };
}
const line = (x0, y0, x1, y1, n) => Array.from({ length: n }, (_, k) => ({ x: x0 + (x1 - x0) * k / (n - 1), y: y0 + (y1 - y0) * k / (n - 1) }));

// one frame of game time without filming it (staging)
async function step(page, drive) {
  if (drive) await drive();
  await run(page, frameMs());
}

// ── filming ──
const frameName = (f) => String(f).padStart(4, "0") + ".png";
// a PNG's own width and height (its IHDR chunk)
function pngSize(file) {
  const b = readFileSync(file);
  return b.toString("latin1", 12, 16) === "IHDR" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : { w: 0, h: 0 };
}
// Most scenes film `seconds` straight from where stage() left the game. A
// scene with end(h) films on instead (probe() read into h every frame), up to
// `most` seconds, until end(h) says the last `seconds` of film are the clip;
// the frames before them are dropped. That is how a clip can END on a moment
// (Feed Echo's next picture glowing in the row the frame shows) that staging
// cannot see coming.
async function film(s, scene, key) {
  const { page } = s;
  const dir = path.join(OUT, "frames", key);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const frames = Math.round((scene.seconds || 4) * FPS);
  const ring = !!scene.end && !FULL;
  const most = ring ? Math.round((scene.most || 40) * FPS) : frames;
  const cropY = scene.crop ? await scene.crop(page) : scene.cropY;
  // a crop past the screen's foot is trimmed by Playwright and then
  // stretched by ffmpeg: never film one
  if (!FULL && !(cropY >= 0 && cropY <= VIEW.height - CROP_H)) throw new Error("the crop leaves the screen: y " + cropY + " (0 to " + (VIEW.height - CROP_H) + ")");
  const clip = FULL ? undefined : { x: 0, y: cropY, width: VIEW.width, height: CROP_H };
  s.cropY = cropY;
  // the child's name as a whole word, in any case
  const nameRe = "\\b" + NAME + "\\b";
  const h = [];
  let f = 0, ended = !ring;
  for (; f < most; f++) {
    if (scene.drive) await scene.drive(f);
    const dt = frameMs();
    await run(page, dt);
    await stepAnims(page, dt);
    if (DEBUG && scene.debug && f % DEBUG === 0) console.log("  " + key + " " + f + ": " + JSON.stringify(await page.evaluate(scene.debug)));
    // every frame: the page's text (a canvas's drawn words are not text, so
    // they are not covered here)
    if (await page.evaluate((re) => new RegExp(re, "i").test(document.body.innerText || ""), nameRe)) throw new Error("the child's name is on screen (frame " + f + ")");
    if (ring) h.push(await page.evaluate(scene.probe));
    if (!FULL || f % 15 === 0) {
      const file = path.join(dir, frameName(f));
      await page.screenshot({ path: file, clip });
      if (!FULL && f === 0) {
        const z = pngSize(file), want = { w: VIEW.width * DPR, h: CROP_H * DPR };
        if (z.w !== want.w || z.h !== want.h) throw new Error("frame 0 is " + z.w + "x" + z.h + ", not " + want.w + "x" + want.h);
      }
    }
    if (ring && h.length >= frames && scene.end(h, frames)) { ended = true; f++; break; }
  }
  if (!ended) throw new Error("stalled: " + (scene.what || "the clip's ending") + " (" + most + " frames)");
  // a ring scene keeps its last `frames`, numbered from 0
  if (ring) {
    const first = f - frames;
    for (let i = 0; i < first; i++) rmSync(path.join(dir, frameName(i)));
    for (let i = first; i < f; i++) renameSync(path.join(dir, frameName(i)), path.join(dir, frameName(i - first)));
  }
  return dir;
}

// ── encoding ──
function ff(args) { execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" }); }
// Both files are made in out/enc/ and copied into public/ only once both are
// within budget, so a failed run leaves the committed clip as it was.
function encode(key, dir) {
  const enc = path.join(OUT, "enc");
  mkdirSync(DEST, { recursive: true }); mkdirSync(enc, { recursive: true });
  const mp4 = path.join(enc, key + ".mp4"), webp = path.join(enc, key + ".webp");
  // H.264 High, yuv420p, a keyframe every 2 s, no audio track, moov first:
  // what an iPhone's web view plays inline and muted with no tap. Converted
  // with the BT.709 matrix into limited range, and tagged so (colr box and
  // the stream's VUI): an untagged clip is read as BT.709 by some players and
  // BT.601 by others, and its greens shift against the poster
  let crf = 28;
  for (; crf <= 36; crf++) {
    ff(["-framerate", String(FPS), "-i", path.join(dir, "%04d.png"),
      "-vf", "scale=" + SIZE.w + ":" + SIZE.h + ":flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p",
      "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0", "-preset", "veryslow", "-tune", "animation",
      "-crf", String(crf), "-g", "60",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-an", "-map_metadata", "-1", "-movflags", "+faststart", mp4]);
    if (statSync(mp4).size <= BUDGET.mp4) break;
  }
  if (statSync(mp4).size > BUDGET.mp4) throw new Error(key + ".mp4 over budget: " + statSync(mp4).size + " bytes at CRF 36 (at most " + BUDGET.mp4 + ")");
  // the poster is the clip's first frame, so nothing jumps when it starts
  let q = 82;
  for (; q >= 40; q -= 6) {
    ff(["-i", path.join(dir, "0000.png"), "-vf", "scale=" + SIZE.w + ":" + SIZE.h + ":flags=lanczos",
      "-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", "-map_metadata", "-1", webp]);
    if (statSync(webp).size <= BUDGET.webp) break;
  }
  if (statSync(webp).size > BUDGET.webp) throw new Error(key + ".webp over budget: " + statSync(webp).size + " bytes at q40 (at most " + BUDGET.webp + ")");
  copyFileSync(mp4, path.join(DEST, key + ".mp4")); copyFileSync(webp, path.join(DEST, key + ".webp"));
  return { crf, q, mp4: statSync(mp4).size, webp: statSync(webp).size };
}
function sheet(key, dir, full) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  const pick = files.filter((_, i) => full || i % 15 === 0).map((f) => path.join(dir, f));
  const out = path.join(OUT, "sheets", key + ".png");
  mkdirSync(path.dirname(out), { recursive: true });
  try { execFileSync("montage", [...pick, "-tile", pick.length + "x1", "-geometry", full ? "195x422+2+2" : "195x260+2+2", out]); } catch (e) { return null; }
  return out;
}

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
// so its middle is the slowed game; the moments are kept for setup's
// captions (REEL_TIMES in onboarding.html), counted from the clip's first frame.
function powerEnd(h, n) {
  const say = h.findIndex((x) => x.v), slow = h.findIndex((x) => x.slow);
  if (say < 0 || slow < 0) return false;
  const start = Math.max(0, say - Math.round(SAY_AT * FPS));
  if (h.length - n < start) return false;
  this._t = { say: +((say - start) / FPS).toFixed(2), slow: +((slow - start) / FPS).toFixed(2), len: +(n / FPS).toFixed(2) };
  return true;
}
const both = (...fns) => async () => { for (const f of fns) await f(); };

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

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
  const only = args.only ? args.only.split(",") : KEYS.filter((k) => SCENES[k]);
  // --full: the whole screen every half second, to choose a crop (no encode)
  FULL = "full" in args;
  // --debug: each scene's own probe, every half second of film (--debug=1:
  // every frame)
  DEBUG = "debug" in args ? Math.max(1, Number(args.debug) || 15) : 0;
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  browser = await chromium.launch(launchOpts());
  let bad = 0;
  try {
    for (const key of only) {
      const scene = SCENES[key];
      if (!scene) { console.log("SKIP " + key + ": no scene"); continue; }
      const t = Date.now();
      let s = null;
      try {
        tick = 0;
        // --encode-only: the frames already filmed, encoded again
        if ("encode-only" in args) {
          const e = encode(key, path.join(OUT, "frames", key));
          console.log("PASS " + key + "  mp4 " + (e.mp4 / 1000).toFixed(0) + " KB crf " + e.crf + ", poster " + (e.webp / 1000).toFixed(0) + " KB q" + e.q);
          continue;
        }
        s = await open(scene.url, scene.cfg);
        scene._s = s;
        await scene.stage(s);
        const dir = await film(s, scene, key);
        if (s.errors.length) throw new Error("page errors: " + s.errors.slice(0, 3).join(" | "));
        const sh = sheet(key, dir, FULL);
        const e = "frames-only" in args || FULL ? null : encode(key, dir);
        console.log("PASS " + key + " (" + ((Date.now() - t) / 1000).toFixed(0) + " s, crop y " + s.cropY + ")" + (scene._t ? "  times " + JSON.stringify(scene._t) : "") + (e ? "  mp4 " + (e.mp4 / 1000).toFixed(0) + " KB crf " + e.crf + ", poster " + (e.webp / 1000).toFixed(0) + " KB q" + e.q : "") + (sh ? "  sheet " + sh : ""));
      } catch (e) {
        bad++; console.log("FAIL " + key + ": " + e.message.split("\n")[0] + (s && s.errors.length ? "  page errors: " + s.errors.slice(0, 3).join(" | ") : ""));
        if (DEBUG && s && scene.debug) console.log("  " + JSON.stringify(await s.page.evaluate(scene.debug).catch((x) => x.message)));
      } finally { if (s) await s.context.close(); }
    }
  } finally { await browser.close(); server.close(); }
  if (bad) process.exit(1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
