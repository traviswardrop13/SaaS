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
  "gameasktest.mjs", // GAMEASK1: what a game's say-it card asks for: the sound, then one syllable, then a short word; Settings' pick, the practice page's floor, homework; it only reads
  "trophytest.mjs", // TROPHY1/COIN3: trophies follow the honest rep, a day at the goal is 30 whatever the goal, never spent or lost; coins no longer minted, a hardened wallet, never sold
  "boardapitest.mjs", // BOARDAPI1: the Practice Board server, built dark: fails closed, the phone never confirms itself, a day counts once and never early, deletion always works, nothing about a child kept
  "momweek.mjs",   // parent weekly goal + streak math + the three UIs
  "dailygoaltest.mjs", // daily rep goals, quiet once-a-day celebration, and weekly goal-day streaks
  "repweektest.mjs", // REPWEEKS1: the week's reps in Home's corner, week by week in Settings — one count everywhere
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
  "roadtest.mjs", // ROAD1/LEVELS1 on Home and in Settings: one tap still plays, "Pick a level" once per game when a level opens, the level badge, "Level 1 only"; Home only reads
  "questtest.mjs", // QUEST1: the 14-day daily adventure; Home only reads, a round of today's game finishes the day once, a sticker never coins, a missed day waits, ages 3-4 get their own
  "storycoretest.mjs", // STORY1: the daily story's rules in sona.js: the fourteen stories come before the game of the day for every child, Premium by the books' rule (never the demonstration window, never a locked card on a phone that cannot buy), one sticker a finished day, the offer a locked card opens, a story's game hands back to its story
  "homestorytest.mjs", // STORY1 on Home: one big story card (open, locked, done, Day 4 after Day 3, a game day after Day 14), the Arcade and Books doors, Back and Forward, Home only reads, the play button and both doors on the first screen at five sizes
  "adventuretest.mjs", // STORY1: the story's player: entitlement before any sound, the website waits for a tap, the app plays as media, ages 3-4's scenes, sound off, Skip, "Let's go!", the ending and its sticker, the buddy on its painted spot, nothing written but seen
  "storygametest.mjs", // STORY1 Days 4-14: the page that plays Codex's eleven games inside the story: the games' test host's shell and words, entitlement before any file, mic or sound, both ages for every game, and Day 4 played from "Let's go!" to its sticker
  "daily-contenttest.mjs", // All eleven new days require real controllers, both age paths, short story acts and actual setting/earned-ending art
  "daily-waterwheeltest.mjs", // Day 4: real water routes, gates and split flow; speech widens joins, with honest progress and safe interruptions
  "daily-postboattest.mjs", // Day 5: steer, dock, transfer parcels and tow a separate raft; speech calms water without delivering for the child
  "daily-bakerytest.mjs", // Day 6: catch ingredients, stir, shape, bake and sort real batches; speech steadies pours and widens useful heat
  "daily-bridgetest.mjs", // Day 7: winch, rotate and lower supported bridge pieces, then steer both carts to the real door; speech steadies loads
  "daily-lanterntest.mjs", // Day 8: true supply/bulb/return circuits, manual switches and short repair; speech traces live paths and widens real catches
  "daily-trainlinetest.mjs", // Day 9: join rail ends, route and stop a real train, transfer pictured passengers and return the crew; speech widens joins and slows travel
  "daily-kitetest.mjs", // Day 10: fit pictures, continuously sew, thread front/back, swap real tail weights and steer balanced flight; speech steadies cloth and calms gusts
  "daily-nestlifttest.mjs", // Day 11: choose real counterweight sums, wind and brake the loaded lift, hand over each bundle and slide the quilt into its room; speech damps actual sway
  "daily-concerttest.mjs", // Day 12: strike and pluck real owned instruments, play timed phrases, arrange and conduct an earned concert; speech slows beats and widens the actual window
  "daily-rooftopstest.mjs", // Day 13: load, aim and launch real seeds, bank off the awning and grow every planter; speech calms actual drift without planting for the child
  "daily-observatorytest.mjs", // Day 14: true gear meshes transmit signed ratios to the sun, moon and stars; real motor work, idler correction and speech-assisted valid catches
  "daily-narrationtest.mjs", // Three spoken story acts and an ending earned through actual play, using the existing quiet audio owner
  "daily-directionstest.mjs", // Real rapid tool/rail/cart transitions retain essential owned directions; paused or finished tasks cannot leak stale cues
  "daily-storyendingtest.mjs", // A real narrated railway finish waits for the owned home cue before every ending sentence and the child's Continue
  "daily-previewtest.mjs", // Local review serves the real speech/story game, returns safely, stays loopback-only and leaves production access untouched
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
  // The three story games (STORY1). lighthousetest and bridgetest are run in
  // parts (their wrappers set LIGHTHOUSE_PART / BRIDGE_PART), each well under
  // the five minutes a suite gets: whole, Light the Way took about 260 s and
  // Puzzle Bridge about 400 s on a busy machine (22 Oct 2026).
  "lighthouseplaytest.mjs", // LIGHTHOUSE1: Light the Way (Day 1) played through: the word lights the lamp, the finger holds the light on each lost boat, the town's windows last, the end card hands to the story; a locked phone goes Home before any mic
  "lighthousehelptest.mjs", // LIGHTHOUSE1: Light the Way's help ladder for both ages: seconds searching or decoys lit, never waiting; every boat comes home with no more speaking
  "lighthousefittest.mjs", // LIGHTHOUSE1: Light the Way at four sizes: no scroll, the light above the finger, every boat and window on the visible sea
  "winduptest.mjs", // WINDUP1: Wind-Up Toys (Day 2): the word pops the key, the finger winds and lets go at the star (ages 3-4: wind until it rings), every toy wakes, the end hands to the story
  "bridgeplaytest.mjs", // BRIDGE1: Puzzle Bridge (Day 3) for ages 5-8: the word calls a stone, a tap turns it, a drag slides it, the river rises, every stone fits, the end hands to the story
  "bridgelittletest.mjs", // BRIDGE1: Puzzle Bridge for ages 3-4 (the same shape, a bounce back from the wrong hole), Calm river, Reduce Motion (nothing slides)
  "bridgefittest.mjs", // BRIDGE1: Puzzle Bridge's buddy, the fit from 320 px to an iPad, the drawn stand-ins and keyboard play
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
const bad = [];
for (const s of SUITES) {
  console.log("\n━━━ " + s + " ━━━");
  const r = spawnSync(process.execPath, [path.join(dir, s)], { stdio: "inherit", timeout: 300000 });
  if (r.status !== 0) { bad.push(s + (r.signal ? " (" + r.signal + ")" : "")); console.log("SUITE FAILED: " + bad[bad.length - 1]); }
}
console.log(bad.length ? "\n" + bad.length + " SUITE(S) FAILED: " + bad.join(", ") : "\nALL SUITES GREEN");
process.exit(bad.length ? 1 : 0);
