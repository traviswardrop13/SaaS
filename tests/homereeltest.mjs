// HOMEREEL1: the clips Home's big card plays (28 Oct 2026: "the daily
// practice is like a 3 second reel essentially of the game that the child
// will play"). Home asks for /assets/home/reel/<game>.mp4, with <game>.webp
// as its poster, for whatever today's card holds: a story day's game
// (STORY_DAYS' `game`) or the game of the day (QUEST_DAYS' `game`). This
// holds what reaches the phone, without a browser (the test Chromium cannot
// play H.264 anyway):
//   - every game either list can name has a clip and a poster, and the folder
//     holds nothing else (a dotfile such as Finder's .DS_Store aside: git
//     ignores it). Both lists are read from public/sona.js, so a new story
//     day, or a new game of the day, fails here until its clip is filmed;
//   - tools/homereel/record.mjs films exactly the story days' games, in
//     STORY_DAYS' order (the game of the day's clips were filmed by
//     tools/setupreel/record.mjs before it went to 1:2, at the commit before
//     09d8f1b, and copied here), and it is a manual tool, not part of the
//     battery;
//   - a clip is H.264 (avc1, High profile, level 4.0 at most: what Home's
//     canPlayType('video/mp4; codecs="avc1.640028"') asks for) at 540 x 720
//     (3:4), 2.5 to 4 seconds, with one track and it is video: no audio
//     track, so a clip can never make a sound or touch the phone's audio
//     session;
//   - its colours are tagged BT.709 (a colr box: primaries, transfer and
//     matrix 1, limited range), the matrix the recorder converts with;
//   - its moov comes before its mdat (faststart), so it starts playing
//     before it has finished downloading;
//   - each is at most 300 KB, and its poster a 540 x 720 WebP of at most
//     60 KB (Home loads one a day);
//   - where ffmpeg is installed: the poster is the clip's first frame (so
//     nothing jumps when the clip starts) and is not a black frame.
// Node only: it reads the files' own boxes and chunks (and, for the last
// check, asks ffmpeg to decode two small pictures).
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// (HOMEREEL_DIR: another folder, to check this test fails on a bad clip)
const DIR = process.env.HOMEREEL_DIR || path.join(ROOT, "public/assets/home/reel");
const BUDGET = { mp4: 300000, webp: 60000 };

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ── MP4: the boxes ──
function boxes(buf, start, end) {
  const out = [];
  for (let at = start; at + 8 <= end;) {
    let size = buf.readUInt32BE(at), head = 8;
    const type = buf.toString("latin1", at + 4, at + 8);
    if (size === 1) { size = Number(buf.readBigUInt64BE(at + 8)); head = 16; }
    else if (size === 0) size = end - at;
    if (size < head || at + size > end) { out.push({ type, at, size, head, bad: true }); break; }
    out.push({ type, at, size, head });
    at += size;
  }
  return out;
}
// where a box's children start (sample descriptions and sample entries carry
// fields before them)
const KIDS = { moov: 0, trak: 0, mdia: 0, minf: 0, stbl: 0, edts: 0, dinf: 0, stsd: 8, avc1: 78 };
function walk(buf, list, found) {
  for (const b of list) {
    (found[b.type] = found[b.type] || []).push(b);
    if (b.type in KIDS) walk(buf, boxes(buf, b.at + b.head + KIDS[b.type], b.at + b.size), found);
  }
  return found;
}
function mp4(file) {
  const buf = readFileSync(file), top = boxes(buf, 0, buf.length), types = top.map((b) => b.type);
  const moov = top.find((b) => b.type === "moov"), r = { types, bad: top.some((b) => b.bad) };
  if (!moov) return r;
  const f = walk(buf, [moov], {});
  r.handlers = (f.hdlr || []).map((b) => buf.toString("latin1", b.at + b.head + 8, b.at + b.head + 12));
  r.entries = (f.stsd || []).flatMap((b) => boxes(buf, b.at + b.head + 8, b.at + b.size).map((e) => e.type));
  r.traks = (f.trak || []).length;
  const avc = (f.avc1 || [])[0];
  if (avc) { r.w = buf.readUInt16BE(avc.at + avc.head + 24); r.h = buf.readUInt16BE(avc.at + avc.head + 26); }
  // the decoder configuration: profile (100 is High) and level (40 is 4.0)
  const avcC = (f.avcC || [])[0];
  if (avcC) { r.profile = buf[avcC.at + avcC.head + 1]; r.level = buf[avcC.at + avcC.head + 3]; }
  // the sample entry's colour box: "nclx", primaries, transfer, matrix, and
  // the full-range bit
  const colr = (f.colr || [])[0];
  if (colr) {
    const o = colr.at + colr.head;
    r.colr = { kind: buf.toString("latin1", o, o + 4) };
    if (r.colr.kind === "nclx") Object.assign(r.colr, { primaries: buf.readUInt16BE(o + 4), transfer: buf.readUInt16BE(o + 6), matrix: buf.readUInt16BE(o + 8), full: (buf[o + 10] & 0x80) !== 0 });
  }
  const mvhd = (f.mvhd || [])[0];
  if (mvhd) {
    const v = buf[mvhd.at + mvhd.head], o = mvhd.at + mvhd.head + (v === 1 ? 20 : 12);
    const scale = buf.readUInt32BE(o), dur = v === 1 ? Number(buf.readBigUInt64BE(o + 4)) : buf.readUInt32BE(o + 4);
    r.seconds = dur / scale;
  }
  // no audio anywhere in the description, whatever box holds it
  const desc = buf.subarray(moov.at, moov.at + moov.size).toString("latin1");
  r.audio = /mp4a|soun|ac-3|ec-3|Opus|alac/.test(desc);
  return r;
}

// ── WebP: the chunk that says how big it is ──
function webp(file) {
  const b = readFileSync(file);
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return { ok: false };
  const chunk = b.toString("latin1", 12, 16), d = 20;
  if (chunk === "VP8 ") return { ok: b[d + 3] === 0x9d && b[d + 4] === 0x01 && b[d + 5] === 0x2a, w: b.readUInt16LE(d + 6) & 0x3fff, h: b.readUInt16LE(d + 8) & 0x3fff, chunk };
  if (chunk === "VP8L") { const v = b.readUInt32LE(d + 1); return { ok: b[d] === 0x2f, w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1, chunk }; }
  if (chunk === "VP8X") return { ok: true, w: b.readUIntLE(d + 4, 3) + 1, h: b.readUIntLE(d + 7, 3) + 1, chunk };
  return { ok: false, chunk };
}

// ── the lists Home can ask from ──
const sona = readFileSync(path.join(ROOT, "public/sona.js"), "utf8");
// one block of sona.js, from its opening line to its own closing line (a
// game named anywhere else in sona.js is not that list's)
function block(open, close) {
  const at = sona.indexOf(open), end = at < 0 ? -1 : sona.indexOf(close, at);
  return at >= 0 && end > at ? sona.slice(at, end) : "";
}
const story = block("const STORY_DAYS = [", "\n  ];"), quest = block("const QUEST_DAYS = {", "\n  };");
ok("sona.js: STORY_DAYS and QUEST_DAYS are where this test reads them", !!story && !!quest, { story: story.length, quest: quest.length });
const STORY = [...story.matchAll(/\bgame: "([a-z]+)"/g)].map((m) => m[1]);
const QUEST = [...new Set([...quest.matchAll(/\bgame: "([a-z]+)"/g)].map((m) => m[1]))];
ok("STORY_DAYS names a game for every day (14 on 28 Oct 2026, the list may grow)", STORY.length >= 14 && new Set(STORY).size === STORY.length, STORY.join(","));
ok("QUEST_DAYS names the game of the day's games (11 on 28 Oct 2026)", QUEST.length >= 11, QUEST.join(","));
const REEL = [...new Set(STORY.concat(QUEST))];

const rec = readFileSync(path.join(ROOT, "tools/homereel/record.mjs"), "utf8");
const keys = (rec.match(/export const KEYS = \[([^\]]*)\]/) || [, ""])[1].match(/"([a-z]+)"/g) || [];
ok("the recorder films exactly the story days' games, in STORY_DAYS' order", JSON.stringify(keys.map((s) => s.slice(1, -1))) === JSON.stringify(STORY), keys.join(","));
ok("the recorder encodes to the same budget", /BUDGET = \{ mp4: 300000, webp: 60000 \}/.test(rec));
ok("the recorder is a manual tool, not part of the battery", !/homereel\/record/.test(readFileSync(path.join(ROOT, "tests/run-all.mjs"), "utf8")));

// ── the files ──
ok("the reel folder exists", existsSync(DIR));
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => !f.startsWith(".")).sort() : [];
const want = REEL.flatMap((k) => [k + ".mp4", k + ".webp"]).sort();
ok("the folder holds a clip and a poster for every game Home can ask for, and nothing else", JSON.stringify(files) === JSON.stringify(want),
  "missing: " + want.filter((f) => !files.includes(f)).join(" ") + "; extra: " + files.filter((f) => !want.includes(f)).join(" "));

// ffmpeg, where the machine has it: a picture's first frame decoded small,
// as RGB (each file through its own colour matrix: the clip's BT.709 and the
// WebP's BT.601 give different grey levels for the same colour, so grey
// levels would not compare)
let ffmpeg = false;
try { execFileSync("ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" }); ffmpeg = true; } catch (e) {}
const rgb = (file) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-frames:v", "1", "-vf", "scale=54:72:flags=area,format=rgb24", "-f", "rawvideo", "-"]);
if (!ffmpeg) console.log("SKIP the poster-is-the-first-frame checks: no ffmpeg on this machine");

let total = 0;
for (const k of REEL) {
  const m = path.join(DIR, k + ".mp4"), w = path.join(DIR, k + ".webp");
  if (!existsSync(m) || !existsSync(w)) { ok(k + ": clip and poster exist", false); continue; }
  const size = statSync(m).size, ps = statSync(w).size, v = mp4(m), p = webp(w);
  total += size + ps;
  ok(k + ": the clip is at most 300 KB", size <= BUDGET.mp4, size + " bytes");
  ok(k + ": its boxes read cleanly, ftyp first", !v.bad && v.types[0] === "ftyp", v.types.join(" "));
  ok(k + ": moov before mdat (it plays before it has all arrived)", v.types.includes("moov") && v.types.includes("mdat") && v.types.indexOf("moov") < v.types.indexOf("mdat"), v.types.join(" "));
  ok(k + ": one track, and it is video", v.traks === 1 && JSON.stringify(v.handlers) === '["vide"]', JSON.stringify({ traks: v.traks, handlers: v.handlers }));
  ok(k + ": H.264 (avc1), High profile, level 4.0 at most", JSON.stringify(v.entries) === '["avc1"]' && v.profile === 100 && v.level > 0 && v.level <= 40, JSON.stringify({ entries: v.entries, profile: v.profile, level: v.level }));
  ok(k + ": no audio track (no mp4a), so it can never make a sound", !v.audio);
  ok(k + ": 540 x 720 (3:4)", v.w === 540 && v.h === 720, v.w + "x" + v.h);
  ok(k + ": 2.5 to 4 seconds", v.seconds >= 2.5 && v.seconds <= 4.05, v.seconds);
  ok(k + ": tagged BT.709 (colr nclx 1/1/1), limited range", !!v.colr && v.colr.kind === "nclx" && v.colr.primaries === 1 && v.colr.transfer === 1 && v.colr.matrix === 1 && v.colr.full === false, JSON.stringify(v.colr || null));
  ok(k + ": the poster is a 540 x 720 WebP of at most 60 KB", p.ok && p.w === 540 && p.h === 720 && ps <= BUDGET.webp, JSON.stringify({ chunk: p.chunk, w: p.w, h: p.h, bytes: ps }));
  if (ffmpeg) {
    let a = null, b = null;
    try { a = rgb(m); b = rgb(w); } catch (e) {}
    // (the two encodings of one picture differ by about 1 to 1.7 levels;
    // another frame of the same clip, by 1.3 to 28)
    const diff = a && b && a.length === b.length ? a.reduce((n, x, i) => n + Math.abs(x - b[i]), 0) / a.length : Infinity;
    const mean = b ? b.reduce((n, x) => n + x, 0) / b.length : 0;
    ok(k + ": the poster is the clip's first frame", diff <= 3, "mean difference " + diff.toFixed(2) + " levels");
    ok(k + ": the poster is not a black frame", mean >= 40, "mean level " + mean.toFixed(1));
  }
}
console.log("reel: " + REEL.length + " clips, " + (total / 1e6).toFixed(2) + " MB with posters");

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
