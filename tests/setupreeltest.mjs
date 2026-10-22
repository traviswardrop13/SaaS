// SETUPREEL1: setup's game reel, the clips a parent sees on "They practice by
// playing." (Travis, 22 Oct 2026: "Do like a little clip of a few games so
// that parents can see it"). tools/setupreel/record.mjs films the real games
// and writes public/assets/setup/reel/<key>.mp4 and <key>.webp; this holds
// what reaches the phone, without a browser (the test Chromium cannot play
// H.264 anyway):
//   - every clip and its poster is there, the six setup cannot do without
//     among them (Fruit Slice, Piano Tiles, Hoops, Soccer Goal, Bubble Pop,
//     Feed Echo), and every one is a game a child can open: never a Coming
//     soon game;
//   - a clip is H.264 (avc1, High profile) at 540 x 720, 3 to 4.5 seconds,
//     with one track and it is video: no audio track, so a clip can never
//     make a sound or touch the phone's audio session;
//   - its moov comes before its mdat (faststart), so it starts playing
//     before it has finished downloading;
//   - each is at most 300 KB, and its poster a 540 x 720 WebP of at most
//     60 KB (eleven clips are a couple of megabytes on a phone's data);
//   - the folder holds nothing else, and the recorder films exactly this list.
// Node only: it reads the files' own boxes and chunks.
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// (SETUPREEL_DIR: another folder, to check this test fails on a bad clip)
const DIR = process.env.SETUPREEL_DIR || path.join(ROOT, "public/assets/setup/reel");
// the recorder's list, in setup's demo order; the first six are required
const REEL = ["slice", "tiles", "hoops", "soccer", "dino", "stack", "run", "glide", "rise", "feed", "bubbles"];
const REQUIRED = ["slice", "tiles", "hoops", "soccer", "bubbles", "feed"];
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
  const avcC = (f.avcC || [])[0];
  if (avcC) r.profile = buf[avcC.at + avcC.head + 1];
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

// ── the list ──
const sona = readFileSync(path.join(ROOT, "public/sona.js"), "utf8");
const acts = sona.slice(sona.indexOf("const GAME_ACTS = {"), sona.indexOf("function gameMeta", sona.indexOf("const GAME_ACTS = {")) > 0 ? sona.indexOf("function gameMeta", sona.indexOf("const GAME_ACTS = {")) : undefined);
for (const k of REEL) {
  const line = (acts.match(new RegExp("^\\s*" + k + ":\\s*\\{[^\\n]*", "m")) || [""])[0];
  ok(k + ": a game in the catalog, open on Home (never Coming soon)", !!line && !/comingSoon:\s*true/.test(line), line || "not in GAME_ACTS");
}
ok("the six setup needs are on the list", REQUIRED.every((k) => REEL.includes(k)));
const rec = readFileSync(path.join(ROOT, "tools/setupreel/record.mjs"), "utf8");
const keys = (rec.match(/export const KEYS = \[([^\]]*)\]/) || [, ""])[1].match(/"([a-z]+)"/g) || [];
ok("the recorder films exactly this list, in this order", JSON.stringify(keys.map((s) => s.slice(1, -1))) === JSON.stringify(REEL), keys.join(","));
ok("the recorder encodes to the same budget", /BUDGET = \{ mp4: 300000, webp: 60000 \}/.test(rec));
ok("the recorder is a manual tool, not part of the battery", !/setupreel\/record/.test(readFileSync(path.join(ROOT, "tests/run-all.mjs"), "utf8")));

// ── the files ──
ok("the reel folder exists", existsSync(DIR));
const files = existsSync(DIR) ? readdirSync(DIR).sort() : [];
const want = REEL.flatMap((k) => [k + ".mp4", k + ".webp"]).sort();
ok("the folder holds a clip and a poster for each game, and nothing else", JSON.stringify(files) === JSON.stringify(want), files.join(" "));
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
  ok(k + ": H.264 (avc1), High profile", JSON.stringify(v.entries) === '["avc1"]' && v.profile === 100, JSON.stringify({ entries: v.entries, profile: v.profile }));
  ok(k + ": no audio track (no mp4a), so it can never make a sound", !v.audio);
  ok(k + ": 540 x 720", v.w === 540 && v.h === 720, v.w + "x" + v.h);
  ok(k + ": 3 to 4.5 seconds", v.seconds >= 3 && v.seconds <= 4.5, v.seconds);
  ok(k + ": the poster is a 540 x 720 WebP of at most 60 KB", p.ok && p.w === 540 && p.h === 720 && ps <= BUDGET.webp, JSON.stringify({ chunk: p.chunk, w: p.w, h: p.h, bytes: ps }));
}
console.log("reel: " + REEL.length + " clips, " + (total / 1e6).toFixed(2) + " MB with posters");

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
