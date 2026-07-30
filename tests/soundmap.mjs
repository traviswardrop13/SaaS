// Sound-map coverage: every sound Sona offers must be fully supported by the
// maps that serve it. The B/D outage came from exactly this gap — ALL_SOUNDS
// shipped 19 sounds while /api/score's PHONEME_FOR knew 17, so every scored
// B and D attempt was force-failed and logged as a miss against a child who
// said it correctly. Nothing cross-checked the two lists, so it was invisible.
//
// Pure source parsing — no browser needed.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sona = readFileSync(ROOT + "/public/sona.js", "utf8");
const score = readFileSync(ROOT + "/app/api/score/route.ts", "utf8");

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ---- the roster ----
const mAll = sona.match(/ALL_SOUNDS\s*=\s*\[([^\]]*)\]/);
ok("ALL_SOUNDS found in sona.js", !!mAll);
const ALL = (mAll ? mAll[1] : "").match(/"([A-Z]+)"/g).map((s) => s.replace(/"/g, ""));
ok("ALL_SOUNDS is non-trivial", ALL.length >= 15, `got ${ALL.length}`);

// ---- 1. /api/score can actually grade every sound ----
const mPhon = score.match(/const PHONEME_FOR[^=]*=\s*\{([\s\S]*?)\n\};/);
ok("PHONEME_FOR found in app/api/score/route.ts", !!mPhon);
const PHON = [...(mPhon ? mPhon[1] : "").matchAll(/^\s*([A-Z]+)\s*:/gm)].map((m) => m[1]);
const missingPhon = ALL.filter((s) => !PHON.includes(s));
ok(
  "every ALL_SOUNDS entry has a PHONEME_FOR mapping",
  missingPhon.length === 0,
  `unscorable (every attempt would be force-failed): ${missingPhon.join(", ")}`,
);

// ---- 2. an unmapped sound must fail LOUDLY, never as a fabricated miss ----
ok(
  "score route rejects an unmapped sound instead of rating it tryAgain",
  /PHONEME_FOR\[targetSound\.toUpperCase\(\)\]/.test(score) && /unscorable-sound/.test(score),
  "missing the ok:false guard — an unmapped sound would log a miss the child didn't make",
);

// ---- 3. every sound has practice words ----
const mWords = sona.match(/const WORDS\s*=\s*\{([\s\S]*?)\n  \};/);
ok("WORDS found in sona.js", !!mWords);
const WORDS = [...(mWords ? mWords[1] : "").matchAll(/^\s{4}([A-Z]+)\s*:\s*\[/gm)].map((m) => m[1]);
const missingWords = ALL.filter((s) => !WORDS.includes(s));
ok(
  "every ALL_SOUNDS entry has a WORDS list",
  missingWords.length === 0,
  `would render an empty practice round: ${missingWords.join(", ")}`,
);

// ---- 4. the daily run must be able to fill the goal ring ----
const charge = readFileSync(ROOT + "/public/charge.html", "utf8");
const mRot = sona.match(/ROT_LEN\s*=\s*(\d+)/);
ok("ROT_LEN found", !!mRot);
ok(
  "daily run length is derived from ROT_LEN, not hardcoded short",
  /_runLen\s*=\s*Math\.min\(\(S&&S\.ROT_LEN\)\|\|5/.test(charge),
  "a fixed-length DAILY_SEQ shorter than ROT_LEN leaves the ring unfillable and the chest unreachable",
);

// ---- 5. the daily run must advance the ring at all ----
ok(
  "daily rounds advance the rotation (no !isDaily lock-out)",
  !/if\(!isDaily\s*&&\s*anyReps/.test(charge),
  "rotAdvance() gated behind !isDaily freezes the path, chest and sound rotation for every daily child",
);

// ---- 6. the 'no clips sent' promise is honoured where recording happens ----
for (const page of ["charge.html", "soundcheck.html"]) {
  const src = readFileSync(ROOT + "/public/" + page, "utf8");
  ok(
    `${page} reads the cloudScoring toggle`,
    /cloudScoring/.test(src),
    "Settings promises 'no clips sent' — this page must honour it",
  );
  ok(
    `${page} gates MediaRecorder on the toggle (no clip is even created)`,
    /if\(CLOUD&&/.test(src),
    "a clip must never be recorded when honest scoring is off",
  );
}


// ---- 7. no practice prompt is glued into a phrase ----
// The phrase rung rotated a carrier onto the front of the target ("a", "my",
// "the", "one", "a big", "a little"), applied blindly to the whole bank. It
// produced "a rain" and "a robot": a child shown ungrammatical English to
// imitate. Sentences are still allowed to be sentences.
{
  const gc = readFileSync(ROOT + "/public/gamecontent.js", "utf8");
  ok(
    "gamecontent.js builds no carrier phrases",
    !/carriers\s*=/.test(gc),
    "a carrier list here is 'a rain' waiting to come back",
  );
  const feed = readFileSync(ROOT + "/public/arcade-feed.html", "utf8");
  // match the CALL, not the words — a comment explaining the removal must not
  // be able to fail this
  ok(
    "Feed Echo speaks no praise on a correct tap",
    !/if\(fed===\d+\)\s*say\(/.test(feed),
    "an every-Nth-answer line talks over a child who is about to go again",
  );
}


// ---- 8. the ladder lost a rung, so stored progress had to be remapped ----
// g.stage[sound] is an INDEX into LADDER. Dropping "phrase" re-points every
// stored value: a child sitting on 4 ("sentence") would read as 5
// ("conversation") and be pushed a level they never earned. This is the kind of
// thing that is invisible until an SLP notices a kid on sentences they can't say.
{
  ok(
    "LADDER no longer has a phrase rung",
    /const LADDER = \["isolation", "syllable", "word", "sentence", "conversation"\];/.test(sona),
    "word → sentence",
  );
  ok(
    "LADDER_LABEL has no orphan phrase entry",
    !/phrase: "Phrases"/.test(sona),
    "a label for a rung that cannot be reached",
  );
  ok(
    "ladderContent has no phrase branch",
    !/lvl === "phrase"/.test(sona),
    "dead branch for an index nothing produces",
  );
  ok(
    "gamecontent.js no longer exports phrases()",
    !/phrases: phrases/.test(readFileSync(ROOT + "/public/gamecontent.js", "utf8")),
    "an exported generator with no consumer",
  );
  ok(
    "stored rungs are migrated, once, behind a version flag",
    /function migrateLadder\(g\)/.test(sona) && /g\.ladderV >= 2/.test(sona) && /g\.ladderV = 2/.test(sona),
    "without this every child above the word rung silently jumps a level",
  );
  ok(
    "the migration runs on every read of progress",
    /if \(migrateLadder\(g\)\) save\(GKEY, g\);/.test(sona),
    "a migration nothing calls is not a migration",
  );
  ok(
    "a child who cleared the phrase rung is moved DOWN to word, not up",
    /else if \(v === 3\) st\[s\] = 2;/.test(sona),
    "claiming a child owns a rung they never cleared is the unsafe direction",
  );
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
