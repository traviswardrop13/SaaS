// The reel kit: how Sona's game clips are filmed. tools/setupreel/record.mjs
// (setup's clips) and tools/homereel/record.mjs (Home's story card) each give
// it where its files go, its frame and its budgets, and their own scenes;
// everything below is the same for both, so a clip on Home is made exactly
// the way setup's were.
//
// How it films: Playwright's virtual clock (page.clock), paused, moved on
// 1/30 s per frame, a screenshot each frame at 390x844 @2x, cropped to the
// reel's frame (`cropH` points tall, the phone's whole width). The games'
// requestAnimationFrame, timers and performance.now are the clock's, so a
// frame is exactly 1/30 s of the game however long the screenshot takes;
// their CSS animations (banners, Echo's hop) are held and stepped the same
// 1/30 s through the Web Animations API. A crop that leaves the screen stops
// the run (Playwright would trim the shot and ffmpeg would stretch it).
//
// It stops, and writes nothing more for that clip, when:
//   - the child's name is on the page in any frame (any case, a whole word).
//     It reads the page's text: a word drawn on a canvas is pixels, and this
//     cannot see it (the contact sheet is where to look);
//   - a clip is still over its budget at CRF 36, or a poster over its budget
//     at q40 (both are made in out/enc/ first: a failed clip never replaces
//     the one in public/);
//   - a frame is not the reel's size (780 px across).
// The clips are tagged BT.709 (matrix, primaries, transfer; limited range)
// and converted with that matrix, so a player reads the colours the way they
// were made and the poster (a WebP, always BT.601 inside) hands over to the
// first frame without a colour jump.
//
// What is staged is tools/appstore/capture.mjs's fake phone (device()): its
// household (an onboarded child on R, Premium through the free-era promise,
// every era stamp set), as the iPhone app, and its fake microphone, which
// hears a voiced sound only while a scene sets __dev.voice.
import { readFileSync, mkdirSync, rmSync, renameSync, statSync, readdirSync, copyFileSync } from "fs";
import { createServer } from "http";
import { execFileSync } from "child_process";
import path from "path";
import { chromium, launchOpts } from "../../tests/_env.mjs";
import { device, fileFor, MIME, seedOutcomes, seedGameReps, seedProgress } from "../appstore/capture.mjs";

// An iPhone 13/14 (390 x 844 pt) at @2x: 780 px across. The safe areas are
// that phone's.
export const VIEW = { width: 390, height: 844 }, DPR = 2, INSET = { top: 47, bottom: 34 };
export const FPS = 30;
// Thursday 22 Oct 2026, 4:10 pm in Idaho.
const AT = Date.parse("2026-10-22T16:10:00-06:00");
const TZ = "America/Boise";
export const NAME = "Mia";                      // capture.mjs's household

// one call after another, in order: both(a, b)() runs a, then b
export const both = (...fns) => async () => { for (const f of fns) await f(); };
// the points of a straight stroke, n of them, ends included
export const line = (x0, y0, x1, y1, n) => Array.from({ length: n }, (_, k) => ({ x: x0 + (x1 - x0) * k / (n - 1), y: y0 + (y1 - y0) * k / (n - 1) }));
async function images(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].filter((i) => i.src && !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
}
async function must(page, what, ok) {
  if (!(await ok)) throw new Error("stalled: " + what);
}
// a PNG's own width and height (its IHDR chunk)
function pngSize(file) {
  const b = readFileSync(file);
  return b.toString("latin1", 12, 16) === "IHDR" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : { w: 0, h: 0 };
}
const frameName = (f) => String(f).padStart(4, "0") + ".png";
function ff(args) { execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" }); }

// dest: the folder in public/ the clips go to; out: the tool's own working
// folder (frames, encodes, contact sheets); port: its server's; cropH: the
// frame's height in points (the width is the phone's); size: the clip's
// pixels; budget: { mp4, webp } in bytes.
export function reelKit({ dest, out, port, cropH, size, budget }) {
  const BASE = "http://127.0.0.1:" + port;
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

  // one frame of game time without filming it (staging)
  async function step(page, drive) {
    if (drive) await drive();
    await run(page, frameMs());
  }

  // ── filming ──
  // Most scenes film `seconds` straight from where stage() left the game. A
  // scene with end(h) films on instead (probe() read into h every frame), up to
  // `most` seconds, until end(h) says the last `seconds` of film are the clip
  // (true), or how many of the last frames are (a number, at least `seconds`'
  // worth); the frames before them are dropped. That is how a clip can END on
  // a moment (Feed Echo's next picture glowing in the row the frame shows)
  // that staging cannot see coming.
  async function film(s, scene, key) {
    const { page } = s;
    const dir = path.join(out, "frames", key);
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const frames = Math.round((scene.seconds || 4) * FPS);
    const ring = !!scene.end && !FULL;
    const most = ring ? Math.round((scene.most || 40) * FPS) : frames;
    const cropY = scene.crop ? await scene.crop(page) : scene.cropY;
    // a crop past the screen's foot is trimmed by Playwright and then
    // stretched by ffmpeg: never film one
    if (!FULL && !(cropY >= 0 && cropY <= VIEW.height - cropH)) throw new Error("the crop leaves the screen: y " + cropY + " (0 to " + (VIEW.height - cropH) + ")");
    const clip = FULL ? undefined : { x: 0, y: cropY, width: VIEW.width, height: cropH };
    s.cropY = cropY;
    // the child's name as a whole word, in any case
    const nameRe = "\\b" + NAME + "\\b";
    const h = [];
    let f = 0, ended = !ring, keep = frames;
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
          const z = pngSize(file), want = { w: VIEW.width * DPR, h: cropH * DPR };
          if (z.w !== want.w || z.h !== want.h) throw new Error("frame 0 is " + z.w + "x" + z.h + ", not " + want.w + "x" + want.h);
        }
      }
      if (ring && h.length >= frames) {
        const k = scene.end(h, frames);
        if (k) { keep = k === true ? frames : Math.min(k, h.length); ended = true; f++; break; }
      }
    }
    if (!ended) throw new Error("stalled: " + (scene.what || "the clip's ending") + " (" + most + " frames)");
    // a ring scene keeps its last `keep` frames, numbered from 0
    if (ring) {
      const first = f - keep;
      for (let i = 0; i < first; i++) rmSync(path.join(dir, frameName(i)));
      for (let i = first; i < f; i++) renameSync(path.join(dir, frameName(i)), path.join(dir, frameName(i - first)));
    }
    return dir;
  }

  // ── encoding ──
  // Both files are made in out/enc/ and copied into public/ only once both are
  // within budget, so a failed run leaves the committed clip as it was.
  function encode(key, dir) {
    const enc = path.join(out, "enc");
    mkdirSync(dest, { recursive: true }); mkdirSync(enc, { recursive: true });
    const mp4 = path.join(enc, key + ".mp4"), webp = path.join(enc, key + ".webp");
    // H.264 High, yuv420p, a keyframe every 2 s, no audio track, moov first:
    // what an iPhone's web view plays inline and muted with no tap. Converted
    // with the BT.709 matrix into limited range, and tagged so (colr box and
    // the stream's VUI): an untagged clip is read as BT.709 by some players and
    // BT.601 by others, and its greens shift against the poster
    let crf = 28;
    for (; crf <= 36; crf++) {
      ff(["-framerate", String(FPS), "-i", path.join(dir, "%04d.png"),
        "-vf", "scale=" + size.w + ":" + size.h + ":flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0", "-preset", "veryslow", "-tune", "animation",
        "-crf", String(crf), "-g", "60",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        "-an", "-map_metadata", "-1", "-movflags", "+faststart", mp4]);
      if (statSync(mp4).size <= budget.mp4) break;
    }
    if (statSync(mp4).size > budget.mp4) throw new Error(key + ".mp4 over budget: " + statSync(mp4).size + " bytes at CRF 36 (at most " + budget.mp4 + ")");
    // the poster is the clip's first frame, so nothing jumps when it starts
    let q = 82;
    for (; q >= 40; q -= 6) {
      ff(["-i", path.join(dir, "0000.png"), "-vf", "scale=" + size.w + ":" + size.h + ":flags=lanczos",
        "-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", "-map_metadata", "-1", webp]);
      if (statSync(webp).size <= budget.webp) break;
    }
    if (statSync(webp).size > budget.webp) throw new Error(key + ".webp over budget: " + statSync(webp).size + " bytes at q40 (at most " + budget.webp + ")");
    copyFileSync(mp4, path.join(dest, key + ".mp4")); copyFileSync(webp, path.join(dest, key + ".webp"));
    return { crf, q, mp4: statSync(mp4).size, webp: statSync(webp).size };
  }
  function sheet(key, dir, full) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
    const pick = files.filter((_, i) => full || i % 15 === 0).map((f) => path.join(dir, f));
    const file = path.join(out, "sheets", key + ".png");
    mkdirSync(path.dirname(file), { recursive: true });
    try { execFileSync("montage", [...pick, "-tile", pick.length + "x1", "-geometry", full ? "195x422+2+2" : "195x260+2+2", file]); } catch (e) { return null; }
    return file;
  }

  // ── the run ──
  //   --only=a,b      these scenes (else every key in `keys` with a scene)
  //   --frames-only   film, no encode (look first)
  //   --full          the whole screen every half second, to choose a crop
  //   --encode-only   encode the last frames again
  //   --debug         each scene's probe, as it films (--debug=1: every frame)
  async function main(scenes, keys) {
    const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
    const only = args.only ? args.only.split(",") : keys.filter((k) => scenes[k]);
    FULL = "full" in args;
    DEBUG = "debug" in args ? Math.max(1, Number(args.debug) || 15) : 0;
    await new Promise((r) => server.listen(port, "127.0.0.1", r));
    browser = await chromium.launch(launchOpts());
    let bad = 0;
    try {
      for (const key of only) {
        const scene = scenes[key];
        if (!scene) { console.log("SKIP " + key + ": no scene"); continue; }
        const t = Date.now();
        let s = null;
        try {
          tick = 0;
          // --encode-only: the frames already filmed, encoded again
          if ("encode-only" in args) {
            const e = encode(key, path.join(out, "frames", key));
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

  return { open, run, step, until, must, images, finger, frameMs, film, encode, sheet, main };
}
