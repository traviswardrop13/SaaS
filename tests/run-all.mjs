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
  "soundmap.mjs",  // every sound is scorable + the daily ring can actually fill
  "storytest.mjs", // STORY1: episode beats, chapter pacing, cliffhanger
  "kidtest.mjs",   // KIDS1: per-child progress, switching, family-wide entitlement
  "slpcode.mjs",   // CODES1: SLP family credential — verified redemption, honest gate
  "slpapi.mjs",    // SLPAPI1: the clinician's roster — invites ahead of the family, removal, meta the device can't overwrite
  "caseloadtest.mjs", // CASELOAD1: the clinician's $79.99 plan — who is covered, grandfathering, own phone, parent invites
  "ttsroutetest.mjs", // voice provider, delivery cache, safe fallback and request deadline
  "voiceclienttest.mjs", // actual playback source, old-cache refresh and complete spoken turns
  "chargepacingtest.mjs", // listen/model/child-turn handoff and replay ordering
  "readtest.mjs",  // books never go silent: browser-voice fallback when TTS dies
  "momweek.mjs",   // parent weekly goal + streak math + the three UIs
  "nativefamilytest.mjs", // native family entry; clinician routes stay browser-only
  "onboardingtest.mjs", // reviewed setup, permission and explicit handoff
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
  "fittest.mjs",   // device-matrix fit: SE→Pro Max, zoomed display, landscape
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
  "slptest.mjs",   // SLP1: the clinician dashboard — live Today, honest register, one door, real remove, the note
  "slpworkflowtest.mjs", // quick homework, per-child plans, feedback/call UI and failure recovery
  "slpcommunityapi.mjs", // shared community access, persistence, privacy and ownership
  "slpcommunitytest.mjs", // shared conversations, draft recovery and mobile layout
  "slpfeedbacktest.mjs", // authenticated feedback and call requests; confirmed receipt only
  "slpdesigntest.mjs", // SLP workspace: filters, failure recovery, bulk assignments, mobile layout
  "arttest.mjs",   // ART1: every sticker renders, fits its box and stays in the safe band
];

let bad = 0;
for (const s of SUITES) {
  console.log("\n━━━ " + s + " ━━━");
  const r = spawnSync(process.execPath, [path.join(dir, s)], { stdio: "inherit", timeout: 300000 });
  if (r.status !== 0) { bad++; console.log("SUITE FAILED: " + s + (r.signal ? " (" + r.signal + ")" : "")); }
}
console.log(bad ? "\n" + bad + " SUITE(S) FAILED" : "\nALL SUITES GREEN");
process.exit(bad ? 1 : 0);
