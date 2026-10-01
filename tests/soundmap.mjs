// Sound-map coverage: every sound Sona offers must be fully supported by the
// maps that serve it. The B/D outage came from exactly this gap — ALL_SOUNDS
// shipped 19 sounds while the scorer's phoneme map knew 17, so every scored
// B and D attempt was force-failed and logged as a miss against a child who
// said it correctly. Nothing cross-checked the two lists, so it was invisible.
// The cloud scorer is gone, but the bug CLASS is not: every map that has to
// know about a sound is cross-checked here against the roster.
//
// Pure source parsing (and one sandboxed run of gamecontent.js) — no browser needed.
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import vm from "vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sona = readFileSync(ROOT + "/public/sona.js", "utf8");

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ---- the roster ----
const mAll = sona.match(/ALL_SOUNDS\s*=\s*\[([^\]]*)\]/);
ok("ALL_SOUNDS found in sona.js", !!mAll);
const ALL = (mAll ? mAll[1] : "").match(/"([A-Z]+)"/g).map((s) => s.replace(/"/g, ""));
ok("ALL_SOUNDS is non-trivial", ALL.length >= 15, `got ${ALL.length}`);

// ---- 1. every sound Echo offers, Echo can model ----
const mSay = sona.match(/const SOUND_SAY\s*=\s*\{([\s\S]*?)\n  \};/);
ok("SOUND_SAY found in sona.js", !!mSay);
const SAY = [...(mSay ? mSay[1] : "").matchAll(/([A-Z]+)\s*:\s*"/g)].map((m) => m[1]);
const missingSay = ALL.filter((s) => !SAY.includes(s));
ok("every ALL_SOUNDS entry has a spoken model", missingSay.length === 0,
  `Echo would say the letter name instead of the sound: ${missingSay.join(", ")}`);

// ---- 2. …and a placement cue to coach it ----
const mCue = sona.match(/const CUES\s*=\s*\{([\s\S]*?)\n  \};/);
ok("CUES found in sona.js", !!mCue);
const CUE = [...(mCue ? mCue[1] : "").matchAll(/^\s{4}([A-Z]+)\s*:/gm)].map((m) => m[1]);
const missingCue = ALL.filter((s) => !CUE.includes(s));
ok("every ALL_SOUNDS entry has a placement cue", missingCue.length === 0,
  `a child who misses would get no help: ${missingCue.join(", ")}`);

// ---- 2b. …and a developmental norm, so age gating has something to read ----
const mNorm = sona.match(/const SOUND_NORM\s*=\s*\{([\s\S]*?)\n  \};/);
ok("SOUND_NORM found in sona.js", !!mNorm);
const NORM = [...(mNorm ? mNorm[1] : "").matchAll(/([A-Z]+)\s*:/g)].map((m) => m[1]);
const missingNorm = ALL.filter((s) => !NORM.includes(s));
ok("every ALL_SOUNDS entry has a developmental norm", missingNorm.length === 0,
  `no age data to gate on: ${missingNorm.join(", ")}`);

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

// ---- 6. the "stays on this device" promise is now structurally true ----
// There is no cloudScoring toggle any more because there is nothing to toggle:
// the scorer is deleted and no page uploads audio. A promise kept by having no
// mechanism to break it beats one kept by a checkbox.
for (const page of ["charge.html", "story.html", "check.html", "coach-call.html"]) {
  const src = readFileSync(ROOT + "/public/" + page, "utf8");
  ok(`${page} uploads no audio anywhere`, !/api\/score/.test(src),
    "a clip leaving the device makes the consent copy false");
}
ok("the cloud scorer is deleted, not merely unused",
  !existsSync(ROOT + "/app/api/score/route.ts") && !existsSync(ROOT + "/lib/scoring.ts"));
ok("the consent copy states it plainly",
  /no recording is ever uploaded/i.test(readFileSync(ROOT + "/public/pilot.html", "utf8")));


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

// ---- 7b. no prompt asks a child to say a word we never ask them to say ----
// syllables() is onset + vowel, so nobody chose its output: G spelled "gay"
// and P spelled "poo", shown in big letters and spoken "Ready? Say gay, five
// times." (Travis, 30 Sep 2026). They are swapped, not dropped, so every sound
// still has five. The list is checked against what the generator really
// returns (run, not read) and against every word in the bank.
{
  const NEVER_SAY = ["gay", "poo"];
  const box = { window: {} };
  vm.runInNewContext(readFileSync(ROOT + "/public/gamecontent.js", "utf8"), box);
  const SC = box.window.SonaContent;
  ok("gamecontent.js runs on its own and exports syllables()", !!(SC && SC.syllables));
  const bad = [], short = [];
  for (const s of ALL) {
    const sy = SC ? SC.syllables(s).map((x) => String(x.t).toLowerCase()) : [];
    if (new Set(sy).size !== 5) short.push(`${s}: ${sy.join(", ")}`);
    sy.forEach((t) => { if (NEVER_SAY.includes(t)) bad.push(`${s}: ${t}`); });
    if (SC) SC.syllables(s).forEach((x) => { if (x.say !== x.t) bad.push(`${s}: shows ${x.t}, says ${x.say}`); });
  }
  ok("no sound's syllables include a never-say word", bad.length === 0,
    `a child would be asked to say: ${bad.join("; ")}`);
  ok("…and every sound still has five different syllables", short.length === 0,
    `swapped must not mean dropped: ${short.join("; ")}`);
  const g = SC ? SC.syllables("G").map((x) => x.t).join() : "", p = SC ? SC.syllables("P").map((x) => x.t).join() : "";
  ok("G says guy and P says pie, and nothing else moved",
    g === "gah,gee,goo,goh,guy" && p === "pah,pee,pie,poh,pay", `G: ${g} · P: ${p}`);
  const bankWords = [...(mWords ? mWords[1] : "").matchAll(/\bw:\s*"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  ok("the word bank was read", bankWords.length > 100, `got ${bankWords.length}`);
  const badBank = bankWords.filter((w) => w.split(/\s+/).some((x) => NEVER_SAY.includes(x)));
  ok("no word in Sona.WORDS is a never-say word", badBank.length === 0, badBank.join(", "));
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


// ---- 9. TRACK1: the usage events the daily dashboard reads ----
// The relay whitelist IS the vocabulary — an event fired but not listed is
// silently dropped, so the two halves have to be checked against each other.
{
  const route = readFileSync(ROOT + "/app/api/track/route.ts", "utf8");
  for (const ev of ["practice started", "practice completed", "day goal done", "slp code redeemed"]) {
    ok(`/api/track whitelists "${ev}"`, route.includes(`"${ev}"`), "fired but dropped = a dashboard that reads zero forever");
  }
  ok("/api/track allows the slp code property", /PROPS = new Set\(\[[^\]]*"code"/.test(route));
  ok("sona.js owns a first-party track() beacon",
    /function track\(ev, props\)/.test(sona) && /sendBeacon\("\/api\/track"/.test(sona),
    "kid pages must never talk to analytics directly");
  ok("day goal done fires at the ring's goal crossing, once",
    /if \(n === ROT_LEN\) \{ try \{ track\("day goal done"/.test(sona),
    "per-page firing double-counts the day charge.html AND Feed Echo finish it");
  ok("slp redemption verifies once per code, and the event fires only on VALID",
    /localStorage\.getItem\("sona\.slpok"\) !== code\) _slpVerify/.test(sona)
    && /valid[\s\S]{0,600}track\("slp code redeemed"/.test(sona),
    "the code sticks and links get re-tapped; only a server-verified redemption may count");
  const settings = readFileSync(ROOT + "/public/settings.html", "utf8");
  ok("kid added fires from the parent page", /SonaAnalytics\.track\("kid added"\)/.test(settings));
  const privacy = readFileSync(ROOT + "/public/privacy.html", "utf8");
  ok("privacy.html no longer claims the app is analytics-free",
    !/contains no third-party\s+analytics or advertising trackers/.test(privacy)
    && /no third-party\s+analytics ever run on a child's practice screen/.test(privacy),
    "the page promised something analytics.js does not do");
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
