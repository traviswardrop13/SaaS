// Runs every suite in order; exits nonzero if any fails.
// Locally: `node tests/run-all.mjs` (needs playwright — see _env.mjs).
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [
  "syntaxtest.mjs",// SYNTAX1: every inline script parses — a broken block kills its whole page
  "freetest.mjs",  // FREE1: Sona is free — the two switches agree and no door takes money
  "telemetrytest.mjs", // TELE1: the funnel is measurable, and carries nothing about a child
  "chartertest.mjs",   // CHARTER1: $59.99 for the first 50 families, then $99.99 — true by construction
  "shiptest.mjs",      // SHIP1: what reaches the phone — the header that makes a deploy visible, without re-downloading the app every page
  "landingtest.mjs", // LANDING1: speaksona.com's Start free pop-up: who they are, the lead, then the App Store
  "launchtest.mjs", // LAUNCH1: the family app is locked until launch day (Friday 2 Oct), one email box, a team door, open by itself
  "soundmap.mjs",  // every sound is scorable + the daily ring can actually fill
  "storytest.mjs", // STORY1: episode beats, chapter pacing, cliffhanger
  "kidtest.mjs",   // KIDS1: per-child progress, switching, family-wide entitlement
  "slpcode.mjs",   // CODES1: SLP family credential — verified redemption, honest gate
  "slpapi.mjs",    // SLPAPI1: the clinician's roster — invites ahead of the family, removal, meta the device can't overwrite
  "caseloadtest.mjs", // CASELOAD1: the clinician's plans ($59.99 for you, $59.99 more for the caseload) — who is covered, grandfathering, own phone, parent invites
  "ttsroutetest.mjs", // voice provider, delivery cache, safe fallback and request deadline
  "voiceclienttest.mjs", // actual playback source, old-cache refresh and complete spoken turns
  "chargepacingtest.mjs", // listen/model/child-turn handoff and replay ordering
  "readtest.mjs",  // books never go silent: browser-voice fallback when TTS dies
  "booktest.mjs",  // BOOKS2: full-screen pages; say the key word to turn the page — Say & Play's check, a quiet mic, silence never turns it, no practice data
  "arttooltest.mjs", // ART2: the book and game art tools never draw over hand-made art
  "soundmarktest.mjs", // SNDMARK1: only the practice sound's letters are orange, for every bank word
  "gameasktest.mjs", // GAMEASK1: what a game's say-it card asks for: the sound, then one syllable, then a short word; Settings' pick, the practice page's floor, homework; it only reads
  "momweek.mjs",   // parent weekly goal + streak math + the three UIs
  "repweektest.mjs", // REPWEEKS1: the week's reps in Home's corner, week by week in Settings — one count everywhere
  "nativefamilytest.mjs", // native family entry; clinician routes stay browser-only
  "onboardingtest.mjs", // reviewed setup, permission and explicit handoff
  "iphonepolishtest.mjs", // spoken revive, cancellation and native audio format
  "progressreviewtest.mjs", // honest parent counts, local clips and explicit sharing
  "repguardtest.mjs", // non-speech evidence cannot create practice
  "speechevidencetest.mjs", // SPEECHEV1: that rule in room noise, at 30fps, for held/quiet sounds and early answers
  "betatest.mjs",  // onboarding flow + beta pulse + founding banner
  "calltest.mjs",  // Coach Call script variants + weekly cap (dev-gated)
  "packtest.mjs",  // call memory, wins card, buddy sprites, adventure tile
  "voicetest3.mjs",// TTS line composition + syllable card rotation
  "progtest.mjs",  // sound rotation + ladder cap + daily goal ring
  "shapetest.mjs", // sound-shape gate vs real recorded sounds
  "gatecheck.mjs", // parent-gate hardening on adult-only pages
  "familynavtest.mjs", // FAMILYNAV1: one grown-ups bar, identical and in the same place on every grown-up page
  "talktest.mjs",  // Talk to us: feedback only (no calls), reply-only email, nothing about the child
  "familyfeedbackapi.mjs", // the family feedback route: same-origin, capped, stored or delivered, never the lead/pilot hooks
  "fittest.mjs",   // device-matrix fit: SE→Pro Max, zoomed display, landscape
  "zoomtest.mjs",  // ZOOM1: a double tap never zooms the app; grown-up pages keep pinch, game boards keep none
  "day1.mjs", // the day: one story, then three games
  "homesessiontest.mjs", // one age-appropriate Home session, current goals and resume precedence
  "activitytest.mjs", // play library: age suggestions, game routes, safe browsing and fit
  "freemiumtest.mjs", // local Premium preview: parent gate, session trial, free games and route boundaries
  "pausetest.mjs", // interruptions preserve one practice flow and release local device resources
  "completiontest.mjs", // adventure recap, honest history, finish routes and prompt volume
  "simpleplaytest.mjs", // Bubble Pop and Peekaboo: deliberate play, honest voice feedback, safe interruption
  "feedtest.mjs",  // Feed Echo: littles tap-and-say loop, growth, deck placement
  "iaptest.mjs",   // Apple IAP rail: native paywall, purchase/restore, web untouched
  "heartest.mjs",  // HEAR1: on-device recognition verdicts — poopoo fails, unknown never does
  "loadtest.mjs",  // LOAD1: per-game loading scenes, ticket pill, ghost reveals
  "mictest.mjs",   // MIC1: a declined mic is never a dead end; the consent copy is true
  "hwtest.mjs",    // HW1: SLP homework replaces what the app would have picked
  "pauseaudiotest.mjs", // interrupted playback and native starts cannot outlive their practice phase
  "micquietpracticetest.mjs", // the practice screen never plays a sound into a live mic (no iPhone call mode)
  "loudroomtest.mjs", // a room too loud to be a room is never a try, in any window of an attempt
  "micquietgamestest.mjs", // the eight games never play a sound into a live mic; STAR MODE is gone
  "slicetest.mjs", // SLICE2: Fruit Slice is a round: three waves, the say-it card between them, a giant watermelon win
  "superslicetest.mjs", // SUPERSLICE1: say the sound once, quick or held, mid-wave for ten seconds of Super Slice; a rep on the week's count, never practice data
  "stacktest.mjs", // STACK2: Block Stacker is a round: three floors on the practice page's five, a rocket to the moon
  "arcadespeechhelptest.mjs", // spoken help changes live game motion and preserves quiet, local microphones
  "tilesspeechtest.mjs", // a spoken sound earns temporary slower keys; quiet mic and native verdict
  "tilestest.mjs", // TILES2: Piano Tiles is a round: three songs a child knows, the same speed on every screen, a finale that waits
  "runtest.mjs", // RUN2: Sound Sprint is a race: park, beach, forest, a checkpoint card between, a finish line that always wins; a child's first three races open on Echo's how-to-play card
  "glidetest.mjs", // GLIDE2: Flappy Glide is a flight: three legs, a cloud rest card between, a fireworks landing; the balloon floats
  "firstgametest.mjs", // FIRST1: setup goes straight to the first game; its end card is the one offer; Home greys the rest
  "sayplaytest.mjs", // SAYPLAY1: the twenty Say & Play games: only a voice moves them, quiet mic, no practice data
  "playgamestest.mjs", // PLAYGAMES1: Hoops, Soccer Goal and Dino Dig played through: the word earns the move, every round ends on a win
  "slptest.mjs",   // SLP1: the clinician dashboard — live Today, honest register, one door, real remove, the note
  "slpworkflowtest.mjs", // quick homework, per-child plans, feedback/call UI and failure recovery
  "slpcommunityapi.mjs", // shared community access, persistence, privacy and ownership
  "slpcommunitytest.mjs", // shared conversations, draft recovery and mobile layout
  "slpfeedbacktest.mjs", // authenticated feedback, call requests refused; confirmed receipt only
  "slpdesigntest.mjs", // SLP workspace: filters, failure recovery, bulk assignments, mobile layout
  "craftedarttest.mjs", // every Feed word has loadable, usable illustrated artwork
  "arttest.mjs",   // ART1: every sticker renders, fits its box and stays in the safe band
];

// The failed suites are named again at the very end: CI's log runs to about
// 7,000 lines, and a tool that can read only its last few thousand could see
// "1 SUITE(S) FAILED" but not which one (PR #166, 29 Sep 2026).
const bad = [];
for (const s of SUITES) {
  console.log("\n━━━ " + s + " ━━━");
  const r = spawnSync(process.execPath, [path.join(dir, s)], { stdio: "inherit", timeout: 300000 });
  if (r.status !== 0) { bad.push(s + (r.signal ? " (" + r.signal + ")" : "")); console.log("SUITE FAILED: " + bad[bad.length - 1]); }
}
console.log(bad.length ? "\n" + bad.length + " SUITE(S) FAILED: " + bad.join(", ") : "\nALL SUITES GREEN");
process.exit(bad.length ? 1 : 0);
