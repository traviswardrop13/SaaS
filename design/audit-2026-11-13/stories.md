# Stories (the daily story, the ten talking Day 1 stories, the calendar)

## In five lines
1. The talking Day 1 story is a real strength: lovely pictures, short lines, a word on every page, a finished day (sticker) given before the ending starts. About 2 to 3.5 minutes if every saying is heard first time (my estimate, see Q1).
2. The biggest hole: a talking story remembers nothing. Tap the X (or lose the app) on page 7 of 8 and the child starts again from page 1, saying every word three more times. Confirmed on the fake phone.
3. On the iPhone, a page can never turn if the phone keeps "not hearing" the word (a clear wrong word, or the listener returns nothing). There is no try counter for that case, so the child is stuck until a grown-up finds the small Skip button.
4. Every "Can you say... rocket." is fetched live, one request per page, right when the mic is about to open, and is not preloaded with the story lines. On a new family's first story that is 12 small dead pauses (24 voice requests in all). No recorded files exist; the manifest 404s on every page load.
5. The calendar is solid (time zones, daylight saving, midnight, clock moved back all hold). The cliff is real: after the 14th story a daily player gets only "the game of the day", with no new story and no talking story again.

## Bugs

### P1
**B1. A talking story forgets where the child was.**
- Sees: the child is on page 7 of 8, taps the X by accident (it is 44 px, top left, no "are you sure"), or the phone call comes in and the app is closed. Back on Home, the card opens "Tap to start" at page 1. Every word must be said three times again.
- Steps: open a talking story (child on R), say pages 1 to 6, leave, open `/adventure.html` again.
- Where: `public/adventure.html:956` (`openCard`), `:648-649` (the card only offers "Keep going" when `seen`), `:903-909` (only the non-talking "Let's go!" button writes `Sona.storySeen`; the talking path never writes anything until the last intro page, `:869`).
- Status: CONFIRMED. Fake phone: said 6 pages, reloaded the page, got "Tap to start", `seen=false`, `idx=0` after the tap. The quest record held only `{a, sv}`.
- Fix: keep the page number for today's talking story (a tiny `seen`-like field in `sona.quest.v1`, e.g. `tp: "<date>|<id>|<page>"`, written by the player on each page turn, read back to offer "Keep going"). Rachel's rules are untouched: it only remembers a place.

**B2. On the iPhone a page can be impossible to pass.**
- Sees: the child says "rocket" (or "wocket"), the dots do not fill, text says "Let's try "rocket" again. Tap the mic." Again, again. The page never turns by itself.
- Steps: iPhone app build. Apple's listener returns a different clear word ("word") or nothing usable ("unverified"). Repeat.
- Where: `public/adventure.html:851-854` (`out === "word" || out === "unverified"` only repaints a nudge, no counter), compare `:842-849` where a wrong-family sound is counted (`M.tries`) and turns the page kindly after 3. `public/saycheck.js:243-244` says this on purpose ("repeated unrelated words never turn a page"), and `tests/talkstorytest.mjs` ("taco try 1..3 earns no dot, rep, page") pins it.
- Status: LIKELY for the child who has the real speech difficulty (the app's whole audience): "unverified" is also what a quiet or unclear 3-year-old voice often produces. The only way through is the cream "Skip" pill top right, which carries no hint that a grown-up should press it.
- Fix (For Rachel, it changes what counts): after N (say 4) not-heard tries on one page, do what the wrong-family rule already does: "Great trying. Let's turn the page." with no dot and no rep. Keeps "taco" from ever earning a dot.

### P2
**B3. Little kids skip the page that introduces a character, but later pictures show that character.**
- Sees: ages 3-4 skip s06 (big-only). In Robo's Rocket they never meet the raccoon ("Thank you, raccoon!") yet the raccoon is in the seat beside them on s07 and in the ending. Sandy: the seal is missing the same way. Same for the moon rabbit in Robo's e03/e04 (e02 is big-only).
- Where: `public/talk-stories.js` (robo s06/e02, sandy s06/e02 `ages: "big"`), pictures `assets/adventure/robo/s07.webp`, `e03.webp`, `e04.webp`. Status: LIKELY (seen in the pictures; I did not check all ten stories). Fix: either keep the character page for little kids, or give the little line a clause that names the guest ("Raccoon is here too!").

**B4. A missing manifest is requested on every page load.** `public/adventure.html:106` loads `/assets/adventure/voice/manifest.js`; it does not exist (404). Harmless to play, but a wasted request and a red console line each visit. CONFIRMED by listing `public/assets/adventure/` (no `voice` folder). Fix: drop the tag until files exist, or ship an empty manifest.

**B5. A finished game hands off to a second "Tap to see what happens" card (non-talking stories).** The game's end card button already says "See what happens!", then the ending opens on another start card with "Tap to see what happens" (`public/adventure.html:648`, `mode === "end"`). Two taps for one step; a 4-year-old can hit the second one wrongly or wait. LIKELY. Fix: in the iPhone app (which already auto-starts intros, `:956`) start the ending at once, as the intro does.

**B6. Day 2 and later stories open with 8 pages of reading before the game.** Not a bug, listed as pacing in "Experience".

## Experience problems
- **Time (Q1), estimate, not measured on a real clock:** a talking story for ages 5-8 is 12 pages (8 intro + 4 ending) = 36 sayings. Per page: Echo reads about 5 to 7 s (average line 65 characters, longest 110), Echo asks about 2 s, each saying about 2 to 2.5 s with the mic reopen, then a 1.3 s cheer. That is about 16 s a page, roughly 3 to 3.5 minutes. Ages 3-4 get 9 pages = 27 sayings, about 2 minutes. That is a good length, if the phone hears the child every time.
- **Where a 5-year-old drifts:** (a) after the sticker is already earned at page 8, the four ending pages still ask three sayings each: the reward has been paid, then 12 more sayings. (b) Nothing audible happens between sayings one, two and three (by design, the mic is open), so only the dots and the pulsing mic tell the child to say it again. A 3-year-old who cannot read "2 more times!" will probably stop after one saying, wait 12 s, and then meet the "Tap the mic" nudge. Echo's voice never repeats the prompt. Compare Speech Blubs / Duolingo ABC, where a model or a sound answers every attempt.
- **Nothing the child says changes the picture until the page turns.** The word is said three times, then the next picture. Duolingo-style feedback would be a small reaction on the picture after each saying (a twinkle, the robot's eyes blink) even without a sound. Silent visuals break no rule.
- **The phone does not hear the child (Q1):** mic refused or "Not now": the story reads on with Next (good, never a dead end). Mic works but the child is quiet: a tap-to-listen nudge, then the grown-up Skip. Mic works but the iPhone "does not verify": stuck (B2).
- **Skip is for everybody.** The grown-ups' Skip (top right, cream pill, 44 px) is on every talking page and not behind the grown-ups check. A 5-year-old who finds it can finish the day (and the sticker) with zero sayings. Recorded decision (the books' Skip is the same); see "Decisions worth another look".
- **A child on a sound with no talking story** (P, B, M, N, T, D, V, J, and the voiced TH) gets the lighthouse: eight pages of reading with no ask, then a game. That is exactly the early sounds of the youngest children. Travis called the lighthouse "average" (TALK1). Which sounds do new families actually pick? That decides the value of the next five stories.
- **Dead pauses on a first story (Q2):** see "Echo's voice" below.
- **Fit (Q6):** checked a long Lulu page (the 110-character line, `lulu` s08) at 320x568, 375x667 and 768x1024. Close, Skip, Hear it, the mic are all at least 44 px (mic 64, Hear it 48, Skip 44x66). The caption card is 196 to 209 px (35% of a tiny screen) and the picture shrinks and is centred over a blurred copy of itself: fine, no overlap with Echo or the ask bubble. Looks right. (Test pictures were the suite's placeholder, so I judged only layout, not art.)
- **Pictures (Q5):** I looked at Robo and Sandy (all 12), and the lighthouse intro. They match their lines, are warm and not scary (the lighthouse's walrus with his eyes shut and smoke from the lamp is the most "dark" page, and still gentle). Slight style gap: the child's own buddy never appears in the talking stories (Echo stands in). Day 3 and later stories have the buddy laid over the picture.
- **Words (Q5, as a parent and as Rachel), three stories read:** Windup Toys, Bakery, Pond Concert. Tone is warm, short, funny ("snores like a tuba. Honk-shoo"). The Pelly "wrong thing in the pouch" gag is a good repeat ritual. Small things: Newt is "her harp" in the little line and "Newt's tail" in the big (fine); Bakery s03 mentions "Grandpa Bear from the toy shop", which a child who has not seen Day 2 does not know (lines are meant to stand alone, this one wobbles); Windup s07 ("Too little, it yawns. Too much, it spins!") describes the game rule on a page of pure reading, which a 6-year-old will have forgotten by the game. For Rachel: all keys in Sandy include "sandcastle" (S before a vowel, but "stl" in the middle) and "silver" (an L later in the word): fine as start-of-word keys, her call for a child who is also working on L.
- **Day 2 to 14 pacing:** 8 pages to tap through (about 45 to 60 s) before a game. A child who loved Day 1's talking cannot talk in those pages, so the app goes from "say every page" to "tap Next" the very next day. A little less magic on Day 2.

## Echo's voice (Q2)
What a child hears and waits for:
- The story's own line goes `clipFor` (`adventure.html:282`): a recorded file if the manifest lists it (none do), else `SayIt.line` (the phone's cache first, then `/api/tts`, aborted at 7 s), else the browser's robot voice read aloud (cut at 9 s).
- The word question "Can you say... rocket." goes a different way: `SayCheck.say` (`saycheck.js:124`), its own cache read, then `/api/tts` aborted at 8 s, then the robot voice. It shares the same cache key, but it is not preloaded: `preload()` (`adventure.html:294`) only queues the story lines. CONFIRMED: I played 6 pages on the fake phone and counted 14 `/api/tts` requests: 8 story lines and 6 asks, each ask fired when its page finished.
- So on a first story a pre-reader gets: line, then a network pause, then "Can you say...". A whole story is about 24 voice requests (12 lines + 12 asks; more if a "One more time..." try happens). They are cached on the phone after that, so a second visit has no waits. The service limit is 120 requests a minute per IP (`app/api/tts/route.ts:226`): fine.
- On a slow or stalled connection: up to 7 s of silence, then the robot voice reads the line, then (talk pages hide Next while waiting) up to 8 more seconds before the ask, then the robot voice for that. A bad connection can mean 30 s a page and a different "Echo" voice. Offline (no network at all) fails fast and goes straight to the robot voice.
- Sound off or a silenced phone: captions only; the word and dots stay on screen and the mic still listens (no spoken prompt).

What recording every line would take: 10 talking stories = 200 distinct story lines (both ages) + 120 distinct ask words (+ "One more time..." and "Great trying. Let's turn the page."), and the 260 lines of the 14 daily stories. The player already reads recorded files by a hash of `TTS_CACHE_VERSION|line` and `voicedoc` lists the lines, but (a) nothing makes the files (no tool in `tools/`), (b) the file name changes whenever the cache version changes, and (c) `SayCheck.say` does not read the manifest, so the asks would still go live unless it is taught to. What it would fix: first-story waits, slow and offline families, the robot voice, a different voice from one day to the next, and server cost. Cheapest step first: preload the asks (see Improvements #2).

## Improvements, ranked
1. **Remember the page in a talking story ("Keep going").** Why: families cancel in the free week; losing 6 pages of work to a stray tap is the worst moment. Impact High, effort Small. Engineering.
2. **Preload the ask lines and the ending's first lines.** In `preload()`, also queue `"Can you say... " + key + "."` for each page and the first ending line once the last intro page loads. They already share one cache key with `SayCheck.say`. Removes about 12 pauses on a first story. Impact Med-High, effort Small. Engineering.
3. **Stop dead-ends: after N not-heard tries turn the page kindly (no dot, no rep).** Impact High for the target children, effort Small. Rachel's call (what counts).
4. **Say something between sayings, silently or briefly.** A pop and the picture reacting (a visual twinkle) after each saying; or a short chime between mic windows (the chime path already waits for the mic to close). Pre-readers need a sign that it worked. Impact Med, effort Small to Med. Travis and Rachel (adds a sound next to the mic window).
5. **Move the happy ending's asks to "just watch"** (or only ask one word in the ending). The day is already finished and the sticker given; 12 more sayings are the likeliest place to quit. Impact Med, effort Small. Rachel and Travis (reps vs delight).
6. **More talking stories for the early sounds (P, B, M, N, T, D) and V, J, the voiced TH,** after checking which sounds new families pick. Impact High if those sounds are common among 3-4s, effort Large (art + 12 lines each). Travis.
7. **Fix the 3-4 continuity** (B3). Impact Low, effort Small. Engineering and Rachel.
8. **Fix the cliff after Day 14** (below). Impact High for retention after week two, effort Large. Travis.
9. **Record the voice files** (above). Impact Med, effort Med (a tool to make the files, plus a manifest, plus teaching `SayCheck.say` to read it). Travis.
10. **Hold-to-skip or the grown-ups check on Skip.** Impact Low-Med, effort Small. Travis.

## The calendar and the cliff (Q4)
Read `_questOn`, `questToday`, `questEnd`, `_questYesterday`, `_questAnchor`, `storyDay`, `_talkDay`. Traced with these cases, all hold:
- First day: `sv` set at setup, the first story shown is Day 1 (since = 1, `left[0]` = story 0).
- A skipped day: the next day shows the story after the last finished; skipped stories return after the others (`left` is the unfinished set, indexed by days since).
- Midnight: a talking story begun before and ended after midnight is finished as yesterday's story (`_questYesterday`); the sticker is given once; tomorrow's story moves on.
- Clock going back: `done` in the future never equals today; `since()` ignores days after today; the card does not stick (CAL1 notes agree).
- Daylight saving and time zones: days are text dates and counted in UTC, so a 23- or 25-hour day is still one day. A parent who flies west sees "today" repeat (a finished story stays done: `done === today()`), flying east loses one story day: acceptable.
- Typed addresses: `?part=end&story=x` for a story not finished goes Home before anything loads; `?again=1` needs a finished talking story that is open; a talking story for another sound, or another child's, is not a day here (`storyDay` returns null).
- Two children on one phone: the page pins `storyOwner`, and `SayCheck` is told the owner, so switching child mid-story retires the old page without counting reps for the new child. Looks right.
Not bugs, but for Travis: (a) finishing the day is tied to the last intro page's third saying; if Premium lapses or the sounds change mid-story, `questEnd` returns null and the ending plays with no sticker (rare, LIKELY, UNSURE how often). (b) The cliff: `storyNext` is false once 14 are finished (`sona.js:6110`), so a child who plays every day sees the last story on day 14, then only the game of the day forever (for ages 3-4 that is Feed Echo and Bubble Pop alternating, 14 entries). Stories 2 to 14 are also not in the child's sound (only the game asks it), and the one talking story is spent on day 1. What keeps week three as good as week one: a weekly new story (already Travis's idea: "about one a week"), a Day-1-style talking story for each of the child's other sounds (reuse the player, only new words and art), seasonal stories whose games stay once found, and a replay of favourites with a new twist (a "bonus page"). Rotating the old stories again would be one change in `_questOn` but is the weakest option (children recognise them).

## Versus the best apps
- **Speech Blubs / Duolingo ABC:** every attempt gets an immediate answer (a video model, a sound, a star). Sona is silent between sayings 1, 2, 3 (a rule about the mic). A silent visual reaction per saying would fit all of Sona's rules.
- **Pok Pok / Toca / Sago Mini:** the child can touch the picture and something happens. In the talking stories the picture is not touchable (taps do nothing), and the story only advances by voice or Skip. A "tap the character" micro reaction between words would help a child who cannot talk yet or is drifting, without counting as practice.
- **Lingokids / Khan Kids:** progress is remembered mid-lesson. Sona forgets mid-story (B1).
- **Headspace for Kids / Calm:** a story is a ritual: the same gentle opener each night (Pelly's letter is this, good) and a soft close. Sona's ending asks 12 more sayings after the reward.
- **Duolingo:** a new lesson every day without end, plus a path. Sona has 14 stories, then a loop.

## Decisions worth another look
- **The "taco" rule (iPhone) with no cap** (B2). Deliberate (Travis, 28 Sep 2026: "I just don't want kids saying taco and getting a correct score"). The score is not at stake when a page simply turns after N not-heard tries with no dot and no rep; the shape rule already does this. Worth a ruling from Rachel.
- **Skip is not behind the grown-ups check** (recorded: "as the books' is"). On a talking story it lets a child finish the day without speaking. Silence is never a rep (it earns none), but it does move the story. Worth asking whether the sticker should still be given for a fully skipped story.
- **The ending pages ask words after the sticker is already given** (36 sayings in all). Said to wow, probably too long. Rachel and Travis.
- **No "Keep going" for talking stories** was likely an oversight of the 31 Oct build, not a decision (the CLAUDE.md note describes seen only for the non-talking path).

## Already good (keep)
- The calendar and the finish-at-the-last-intro-page rule: closing the app after the problem is solved loses nothing.
- The guard rails on the mic: nothing plays while it listens, hidden page closes it, the grown-up's yes comes first inside the story, "Not now" reads on with Next (never a dead end), two-children owner check.
- Pictures and line writing: warm, consistent, short, no names, no sound named, no grading words (rules enforced by `adventuretest` and `talkstorytest`).
- The caption card keeps one height for the whole story (no jumping), buttons 44 px or more, fits down to 320x568.
- Pelly's letter ritual and the gold-star helper map end each story the same gentle way.

## Not checked
- A real device: voice latency, the real feel of the mic reopening, Apple's recognizer on children.
- Real `/api/tts` speed and whether it keeps the 6 s vendor limit under load.
- Pictures of the other eight talking stories and of Days 2 to 14 (I looked at Robo, Sandy and the lighthouse intro; read three daily stories' words).
- The Home card, the "Your games" row and the sticker card visuals (other auditors).
- A full timed run on a fake clock: I counted requests and layout, and estimated minutes from line lengths and the SayCheck timings (`FLOOR_MS 450`, `QUIET_MS 900`, `VOICE_TAIL_MS 250`, `SETTLE_MS 200`).
- Whether the non-talking story games (Days 2 to 14) hand back correctly: not in my files.
