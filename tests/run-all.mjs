// Runs every suite in order; exits nonzero if any fails.
// Locally: `node tests/run-all.mjs` (needs playwright — see _env.mjs).
import { spawnSync } from "child_process";
import { writeSync } from "fs";
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
  "nurturetest.mjs", // NURTURE1: a new sign-up gets the welcome now and the 5-minute email tomorrow, once each, with a real unsubscribe
  "contactstest.mjs", // CONTACTS1: every grown-up's email joins Resend's contacts in its segment; nobody is re-subscribed; unsubscribes go both ways; Kit's leavers first
  "replaytest.mjs", // REPLAY1: PostHog session recording only on four grown-up screens on speaksona.com, played with the real recorder: no name, no address, nothing typed, never the speech therapy question or its answer, nothing past the hand-off
  "reporttest.mjs", // REPORT1: the weekly progress report: only a household that asked sends a few numbers a child (never a name or a voice), never from Home; Monday's email from Rachel, once a week
  "rcwebhooktest.mjs", // RCHOOK1: RevenueCat tells Sona when a parent's Premium starts, renews, is cancelled or ends: only RevenueCat's own header gets in, the sales emails stop for a buyer, "Your free days end soon" and "We miss you at Sona" go once to an address on Sona's list, and Kit is gone
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
  "gameasktest.mjs", // GAMEASK1: what a game's say-it card asks for: the sound, then one syllable, then a short word; what was earned (an old Settings pick is dropped), the practice page's floor, homework; it only reads
  "trophytest.mjs", // TROPHY1/COIN3: trophies follow the honest rep, a day at the goal is 30 whatever the goal, never spent or lost; coins no longer minted, a hardened wallet, never sold
  "boardapitest.mjs", // BOARDAPI1: the Practice Board server, built dark: fails closed, the phone never confirms itself, a day counts once and never early, deletion always works, nothing about a child kept
  "momweek.mjs",   // parent weekly goal + streak math + the three UIs
  "dailygoaltest.mjs", // daily rep goals, quiet once-a-day celebration, and weekly goal-day streaks
  "repweektest.mjs", // REPWEEKS1: the week's reps in Home's corner and on Progress — one count everywhere
  "besttest.mjs", // BESTS1: each child's own best in a game — per child, only ever up, never practice data or shared; Home's "Best 17" tag
  "nativefamilytest.mjs", // native family entry; clinician routes stay browser-only
  "onboardingtest.mjs", // reviewed setup, permission and explicit handoff
  "setupsteadytest.mjs", // STEADY1: setup's name step holds still while the iPhone keyboard comes and goes, a name is typed and an age picked
  "iphonepolishtest.mjs", // spoken revive, cancellation and native audio format
  "progressreviewtest.mjs", // honest parent counts, local clips and explicit sharing
  "repguardtest.mjs", // non-speech evidence cannot create practice
  "repguardowntest.mjs", // the same non-speech and loud rooms on Sona's own mic in the iPhone app: never a try
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
  "homepickstest.mjs", // deterministic daily picks stay in the child's sound and age
  "shoptest.mjs", // SHOP1/OWN1: the Buddy Shop; a kept household owns everything, a new family gets the rest with coins (hold "Get it", give it back), road items show their trophies
  "roadtest.mjs", // ROAD1/LEVELS1 on Home and the road: one tap still plays, "Pick a level" once per game when a level opens, the level badge, an old "Level 1 only" ignored; Home only reads
  "questtest.mjs", // QUEST1: the 14-day daily adventure; Home only reads, a round of today's game finishes the day once, a sticker never coins, a missed day waits, ages 3-4 get their own
  "activitytest.mjs", // play library: age suggestions, game routes, safe browsing and fit
  "freemiumtest.mjs", // local Premium preview: parent gate, session trial, free games and route boundaries
  "websalestest.mjs", // WEBSALES1: families no longer pay on the website — the trial page and Settings in both states of the switch, and never a price flash
  "pausetest.mjs", // interruptions preserve one practice flow and release local device resources
  "completiontest.mjs", // adventure recap, honest history, finish routes and prompt volume
  "simpleplaytest.mjs", // Peekaboo (the simple-play engine; Bubble Pop left it on 1 Oct 2026): deliberate play, honest voice feedback, safe interruption
  "feedtest.mjs",  // Feed Echo: littles tap-and-say loop, growth, deck placement
  "iaptest.mjs",   // Apple IAP rail: native paywall, purchase/restore, web untouched
  "trialfirsttest.mjs", // trial first: the price before the first game, nothing free where Sona can sell
  "homeoffertest.mjs", // HOMEOFFER1: a family locked out who never saw the free days on this phone gets the plan screen once from Home; never again, never for anyone who keeps the free version or already saw it
  "planwordstest.mjs", // PLANWORDS1: the store answer (monthly only, eligibility, late answers) and every sentence the iPhone price card may show
  "pricescreentest.mjs", // PRICE1: the one-plan iPhone price card in every store state: no typed figure, no reminder words, never a dead end
  "setupbuytest.mjs", // SETUPBUY1: a new family end to end: setup, the price, a purchase, then the microphone, the hand-off and the first game
  "heartest.mjs",  // HEAR1: on-device recognition verdicts — poopoo fails, unknown never does
  "loadtest.mjs",  // LOAD1: per-game loading scenes, ticket pill, ghost reveals
  "mictest.mjs",   // MIC1: a declined mic is never a dead end; the consent copy is true
  "hwtest.mjs",    // HW1: SLP homework replaces what the app would have picked
  "pauseaudiotest.mjs", // interrupted playback and native starts cannot outlive their practice phase
  "micquietpracticetest.mjs", // the practice screen never plays a sound into a live mic (no iPhone call mode)
  "loudroomtest.mjs", // a room too loud to be a room is never a try, in any window of an attempt
  "micquietgamestest.mjs", // the eight games never play a sound into a live mic; STAR MODE is gone
  "micquietgamesowntest.mjs", // the same quiet rules on Sona's own mic in the iPhone app: the card, a lock mid-ask, the background, a refusal
  "nativemictest.mjs", // NATIVEMIC1: in the iPhone app the mic is Sona's own (no phone-call audio): same child, same answer, every exit closes it, nothing plays into it, no audio leaves
  "slicetest.mjs", // SLICE2: Fruit Slice is a round: three waves, the say-it card between them, a giant watermelon win; the child's own best is fruit in a row (Beat Your Best)
  "superslicetest.mjs", // SUPERSLICE1: say the sound once, quick or held, mid-wave for ten seconds of Super Slice; its fruit are extras and its drops are free; a rep on the week's count, never practice data
  "stacktest.mjs", // STACK2: Block Stacker is a round: three floors on the practice page's five, a rocket to the moon
  "arcadespeechhelptest.mjs", // spoken help changes live game motion and preserves quiet, local microphones
  "tilesspeechtest.mjs", // a spoken sound earns temporary slower keys; quiet mic and native verdict
  "tilestest.mjs", // TILES2: Piano Tiles is a round: three songs a child knows, the same speed on every screen, a finale that waits
  "runtest.mjs", // RUN2: Sound Sprint is a race: park, beach, forest, a checkpoint card between, a finish line that always wins; a child's first three races open on Echo's how-to-play card
  "glidetest.mjs", // GLIDE2: Flappy Glide is a flight: three legs, a cloud rest card between, a fireworks landing; the balloon floats
  "risetest.mjs", // RISE1: Rise Up: drag a shield to push falling blocks off a rising balloon; three stretches, the say-it card between, five clouds at the top
  "sayitcardtest.mjs", // SAYIT1: the six round games' say-it card speaks (ask, Rachel's take, "Go!") before it listens, and is never frozen; a child answering right on "Go!" is heard
  "firstgametest.mjs", // FIRST1: setup goes straight to the first game; its end card is the one offer; Home greys the rest
  "sayplaytest.mjs", // SAYPLAY1: the twenty Say & Play games: only a voice moves them, quiet mic, no practice data
  "playgamestest.mjs", // PLAYGAMES1: Hoops, Soccer Goal and Dino Dig played through: the word earns the move, every round ends on a win
  "racecartest.mjs", // real steering, brakes, speech slow-road powers, eight pit stops, fit and interruption safety
  "flowertest.mjs", // FLOWER1: actual poured drops grow a plant, speech widens the shower, progress survives help
  "castletest.mjs", // CASTLE1: real crane and lowering controls, speech steadies the rope, eight architectural placements
  "pizzatest.mjs", // PIZZA1: rolling, real coverage, topping drags, controlled baking, cuts and owned step instructions
  "spacetest.mjs", // SPACE1: real thrust, steering and soft touchdowns, speech eases gravity without autopiloting
  "monstertest.mjs", // MONSTER1: real salon gestures, persistent styling and speech-assisted tools
  "rocketblasttest.mjs", // ROCKET1: pull-and-release physics, five real planet arrivals, speech-widened landing rings
  "snowmantest.mjs", // SNOWMAN1: real snow rolling and stacking, manual face/clothes and speech-help recovery
  "traintest.mjs", // TRAIN1: held driving, real station stops and hand-placed passengers, speech-slowed travel
  "puppytest.mjs", // PUPPY1: moving fur patches washed only by real water particles, speech-steadied puppy
  "bedtimestarstest.mjs", // STARS1: continuous constellation tracing, real wider speech path and preserved connections
  "peekabootest.mjs", // PEEK1: Peekaboo on the Say & Play engine: the word hides the picture, a wrong door glows the right one, silence never finds it
  "fishtanktest.mjs", // FISHTANK1: hand-released sinking food, moving mouth catches and speech-calmed swimming
  "giftstest.mjs", // GIFTS1: five physical unwrapping mechanisms and speech-assisted handles
  "caketest.mjs", // CAKE1: real circular mixing, caught batter, piping, custom fruit and manually fanned candles
  "balloonpartytest.mjs", // BALLOON1: real pump strokes and guided garland deliveries, speech power and quiet turns
  "robottest.mjs", // ROBOT1: rotate real circuits, speech blueprints, eight assembled parts
  "treasuretest.mjs", // drawn sailing routes, solid islands, speech-calmed currents and a real treasure finish
  "dinotest.mjs", // DINOS1: Dino Dig's four dinosaurs: each dug to its own finale, in order, per child, round again after the last
  "bubblestest.mjs", // BUBBLES1: Bubble Pop played through: the word blows the bubbles, the finger pops them, the pops are media in the app, every round ends on a win
  "buddyplaytest.mjs", // BUDDY2: the child plays as their own buddy in eight games; a fox child keeps today's Fruit Slice and Block Stacker pictures; the engines cheer the buddy's own pictures, never Echo's
  "levelstest.mjs", // LEVELS1 in the five round games: Level 1 is today's game, a level changes only the finger's part, every help reads Level 1's numbers, each level keeps its own best
  "levelsplaytest.mjs", // LEVELS1 in Bubble Pop, Hoops, Soccer Goal and Dino Dig: the page hands the level to the engine, the help is Level 1's, the start card names it; Feed Echo keeps one
  "slptest.mjs",   // SLP1: the clinician dashboard — live Today, honest register, one door, real remove, the note
  "boardtest.mjs", // BOARD2: the Practice Board's phone half, built dark: nothing shows while off, a grown-up's email turns it on, a goal day goes once with 10 reps, Home sends nothing, deletion always works
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
// Their FAIL lines are repeated there too (22 Oct 2026): the log now runs to
// about 17,500 lines and the same tool reaches only the last 5,000, so a
// suite that failed early named itself but not what failed in it. Each suite's
// output is echoed whole as it ends (a suite's own lines are not interleaved
// with another's, and nothing else changes for a reader of the full log).
// Every line goes out with writeSync, waiting out a full pipe (22 Oct 2026).
// GitHub's runner hands Node a non-blocking pipe: a big suite's output written
// with process.stdout.write was taken in part, the rest queued for the event
// loop, and spawnSync never lets the loop run, so the queue (every later
// suite, and the list of failures) was dropped when the run exited. The log
// on #234 stopped mid-word at suite 69 of 126.
const pause = new Int32Array(new SharedArrayBuffer(4));
function say(fd, text) {
  const buf = Buffer.from(text, "utf8");
  for (let off = 0, tries = 0; off < buf.length;) {
    try { off += writeSync(fd, buf, off, buf.length - off); tries = 0; }
    catch (e) { if (e.code !== "EAGAIN" || ++tries > 3000) throw e; Atomics.wait(pause, 0, 0, 10); }
  }
}
const bad = [], fails = {};
for (const s of SUITES) {
  say(1, "\n━━━ " + s + " ━━━\n");
  const r = spawnSync(process.execPath, [path.join(dir, s)], { stdio: ["inherit", "pipe", "pipe"], timeout: 300000, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" });
  say(1, r.stdout || "");
  say(2, r.stderr || "");
  if (r.status !== 0) {
    bad.push(s + (r.signal ? " (" + r.signal + ")" : ""));
    const lines = ((r.stdout || "") + "\n" + (r.stderr || "")).split("\n").filter((l) => /^\s*(FAIL|✗|Error|TypeError|ReferenceError|AssertionError)/.test(l) || /FAILURES? \//.test(l) || /\d+ failures?\b/i.test(l));
    fails[s] = lines.slice(0, 60).map((l) => l.length > 700 ? l.slice(0, 700) + " …" : l);
    say(1, "SUITE FAILED: " + bad[bad.length - 1] + "\n");
  }
}
let tail = "";
for (const s of Object.keys(fails)) tail += "\n── what failed in " + s + " ──\n" + fails[s].join("\n") + "\n";
say(1, tail + (bad.length ? "\n" + bad.length + " SUITE(S) FAILED: " + bad.join(", ") : "\nALL SUITES GREEN") + "\n");
process.exit(bad.length ? 1 : 0);
