# Say & Play engine and its five older games (Hoops, Soccer Goal, Dino Dig, Bubble Pop, Peekaboo)

## In five lines
1. The engine is careful and mostly solid. Pause, resume, hidden pages, a second tap, "Play again" and the help pill all hold up when I traced them.
2. The biggest worry is in the iPhone app. A saying only counts when Apple's on-device listener returns a clean "pass". If the listener is missing, off, or does not understand a small child, the child is stuck on "Tap the mic, then say it" with no voice and no way on (only the X).
3. After a failed try or 12 quiet seconds, Echo says nothing. A 3-year-old who cannot read sees a small mic button and written words. This is the worst moment in these games for the youngest children.
4. The word is a gate in front of the game, not part of it. The word is "robot" or "rabbit" and then a basketball appears. Only Bubble Pop and Peekaboo tie the picture to what happens next.
5. Hoops, Soccer and Dino fit at 320x568 and finish every round. They have not had the "rebuild" the other games got. They need less than the others do (see below).

## Bugs

### P1

**1. In the iPhone app, a child can be stuck forever when the listener does not give a clean pass.**
- Sees: after saying the word, the screen reads "Tap the mic, then say it". Saying it again does the same. The game never moves. Echo does not speak.
- Steps (LIKELY, traced): iPhone app build with the speech plugin, Speech Recognition denied in iPhone Settings, Siri and dictation off, or the on-device language pack missing. Open any of the five games, tap Let's play and say the word.
- Where: `public/sayplay.js:392-452`. In `nativeWordListen`, `check.ready` false calls `micStop(); nudge()` (line 416). `finishWord` only continues on `out === "pass"` (line 406). Any other answer ("unavailable", "fail", "unknown", "cancelled") goes to `nudge()`. In `public/sona.js:6892-6930`, `finish()` returns "unavailable" whenever the result is not on-device. The `unknown` answer does not fall back to the sound-shape check here, though the practice page does that.
- Status: LIKELY. The fake phone has no speech bridge, so I could not run it. The code path is clear.
- Fix: after 2 or 3 failed or "unavailable" tries in a row, fall back to the sound-shape check for that turn (as the practice page does for "unknown"). Or offer a grown-up's "Skip this word" button. Both are Rachel's call (see Decisions).

**2. After a failed try or silence, Echo does not speak, so a 3-year-old who cannot read has no cue.**
- Sees: the mic closes and a small round mic button appears with the words "Tap the mic, then say it". Echo's pose changes to thinking. Nothing is said aloud.
- Steps: Bubble Pop or Peekaboo, age 3-4. Say nothing for 12 seconds. Or say a word the listener rejects.
- Where: `public/sayplay.js:495-504` (`nudge`), `LISTEN_MS = 12000` (line 86).
- Status: CONFIRMED by reading the code. On the fake phone the mic closes after the window and `micBtn` shows with no voice line.
- Fix: on the first nudge, Echo says "Your turn!" (or the word again, then Go) and reopens the mic once by himself. This is a prompt to talk, not a free step, so it keeps the silence rule.

### P2

**3. If the phone never answers the mic request, the game sits on "Listen" for good.**
- Sees: Echo has said the word and the screen says "Listen" forever. There is no mic button, and "Hear it" does not help.
- Steps (CONFIRMED on the fake phone): `getUserMedia` replaced with a promise that never resolves, `sona.micok` set, tap Let's play, wait 30 s. Result: phase "turn", not listening, mic button hidden.
- Where: `public/sayplay.js:310-318`. `micAsking` stays true and `micOpen` returns early at line 312. `nextTurn` and `micStop` never reset `micAsking`. There is no timeout on the request itself.
- Fix: a 5 to 6 second timeout on the open; on timeout set `micAsking = false` and call `nudge()`.

**4. On the iPhone app the "1 more time!" line flickers to "Listen" between two sayings.**
- Sees: after the first saying the dot ticks and "1 more time!" shows, then switches to "Listen" with Echo in his talking pose for about half a second, until the second saying starts.
- Where: `public/sayplay.js:408-411`. `heardOne()` calls `showTurn(true)`, then `finishWord` calls `showTurn(false)` right after, and `nativeWordGap` does not call `showTurn(true)` again until the next burst starts.
- Status: LIKELY. Travis asked for no delay here on 1 Oct.
- Fix: in `finishWord`, skip `showTurn(false)` when `heardOne()` returned false.

**5. A page hidden while the "Let's play" turn is starting can come back to a frozen turn.**
- Sees: the phone locks while the first permission check or the first mic question is on screen. On return, the word is shown but nothing speaks and the mic never opens. "Hear it" gets it going again.
- Where: `public/sayplay.js:870-876`. `pause()` ignores the phases "starting" and "primer", so `paused` is never set. Then `begin()`'s `micReady().then(nextTurn)` runs while the page is hidden. `nextTurn` leaves `audioPaused` true and `audioAllowed` fails, so the chain stops before `micOpen`.
- Status: UNSURE. I traced it but could not force it, because the fake phone answers the permission query at once.
- Fix: in `begin()`, wait for the page to be visible before calling `nextTurn`.

**6. A pause taken in the quarter second before the last word's finale skips the finale.**
- Where: `public/sayplay.js:886`. Resume goes straight to `showEnd` when `step >= steps.length`. Cosmetic only.

**7. When the voice service is slow, a turn can wait 8 seconds with "Listen" on screen.**
- Where: `fetchVoice` (line 196) aborts after 8 s, then `speakFallback` reads the word in the phone's robot voice.
- This happens for every word that is not yet cached on this phone. Nothing warms the words, only the one-line intro (line 913).
- The robot voice models the target sound, which is a clinical question (see Decisions).
- Fix: warm the pool words in the background while the start card shows.

## Experience problems

- **Hoops, picture "320 hoops".** The hoop is small (about 60 px wide at 320 wide) and slides slowly. The painted wall is lovely. The "Swipe up" hint finger is easy to miss because it is white on a bright floor.
- **The word is a gate.** In Hoops and Soccer, the word "rabbit" or "robot" has nothing to do with a basketball. Only steps 1, 4 and 7 use a themed word like "ball" or "net", and only for some sounds (`sona.js:2342`, `GAME_WORDS`). `sayplay.js:603-617` (`pickWord`) uses `step % 3` for themes. A 4-year-old does not feel "I said ball, I got a ball".
- **Eight words twice is long for the older games.** One round is about 8 words x (Echo 2 s + two sayings 4 s + native check 1 s + move 3 s + cheer 1 s) = roughly 90 seconds. Waiting for Echo and the mic guards is about 30% of that. The guards (nothing plays while the mic listens, 200 ms settle, 250 ms tail) are necessary and short. The long part is Echo saying the word and "Go!" on every turn, even for words the child just said.
- **Round timing measured on the fake phone (Bubble Pop, voice off):** Let's play to listening is about 1.0 s. Last pop to the next listening is about 0.5 s. With real voice add about 2 s of Echo per word.
- **Peekaboo.** The banner "Say the word two times!" and "Watch the doors!" are written. Echo speaks them only when sound is on and the phone is not silenced. A child who taps the door while the picture is still peeking out gets no reaction. The doors are disabled there, with no wiggle or sound.
- **Peekaboo's Echo's clue pill** asks the child to say the word two more times just to get a hint. That is a lot to ask of a 3-year-old who is already stuck.
- **Bubble Pop sayTimes: 1 versus Peekaboo 2.** On the same shelf, one game asks once and the other asks twice. This is waiting on Rachel (noted in the files).
- **Dino Dig** is the best of the five at turning the word into a game moment (the child earns the brush, digs, and the bone flies to the skeleton), but the word asked is still random. Pit rubbing is satisfying. There is no way back to see all four dinosaurs from the game.
- **A failed try gives no feedback.** The mic closes and the text changes (see bug 2). Speech Blubs-style apps show the child a kind, simple prompt every time.

## Improvements, ranked

1. **Echo re-prompts by voice after a quiet or failed turn, and reopens the mic once.** Why: the youngest children cannot read the nudge. Impact High, effort Small, call: Rachel (what Echo says and how often) with engineering.
2. **A kind way on when the listener is unavailable (bug 1).** After two or three failed tries on a word, fall back to the sound-shape check, or show a small grown-up "Skip this word" button. Impact High (stops a stuck child), effort Medium, call: Rachel and Travis (it changes what counts).
3. **Warm the next words while the start card shows, and the next word during the cheer.** Removes the dead 1-8 s wait on slow networks and on first play. Impact Medium, effort Small, call: engineering.
4. **Make the word part of the game in Hoops, Soccer and Dino.** Use the Peekaboo/Bubble Pop idea: the word's picture rides on the ball, or the word is what the ball is called ("Say ball"). Where no themed word exists for the sound, put the word's picture on the ball or the bone. Impact High for fun, effort Medium, call: Rachel (what is said) and Travis.
5. **A hang timeout on the mic request (bug 3), and a one-line fix for the flicker (bug 4).** Impact Low to Medium, effort Small, call: engineering.
6. **Do not say the word and "Go!" again after a "Hear it" tap or a retry in a row.** Skip "Go!" on the second retry to cut dead time. Impact Low, effort Small, call: Rachel.
7. **Peekaboo: wiggle the door and play a soft sound if tapped during the peek.** A tap now does nothing. Impact Low, effort Small, call: engineering.
8. **One kind rule for who asks once versus twice (Bubble Pop 1, Peekaboo 2).** Impact Medium, effort Small, call: Rachel.

## Do the five older games need the "rebuild"?
- **Hoops, Soccer, Dino:** mostly no. The word does not hand out power (there is no help pill), the finger play is the game, and every round ends on a success. What they lack is a new round each time. Their word list is the only variety, and the hoop and goalie patterns repeat. A small variation (different hoop spots, a different court) is cheap. The bigger gap is that the word is a gate (see improvement 4).
- **Bubble Pop and Peekaboo:** the word hides the picture or blows the bubbles, which is a real link. Both are fine. Peekaboo's help pill hands out a glow for saying the word two more times, which is the "power from the word" pattern the other rebuilds removed. It is optional, so it hurts less.

## Ratings (1 to 5)

| Game | Clear | Fun to repeat | Word is part of the game | Fits small phones | Bug-free |
|---|---|---|---|---|---|
| Hoops | 4 | 3 | 2 | 4 (320x568 checked) | 4 |
| Soccer Goal | 4 | 3 | 2 | 4 (320x568 checked) | 4 |
| Dino Dig | 4 | 4 | 3 | 4 (320x568 checked) | 4 |
| Bubble Pop | 5 | 3 | 4 | 4 (320x568 checked) | 4 |
| Peekaboo | 4 | 3 | 4 | 5 (320x568 checked) | 4 |

The engine itself: clear 4, bugs 3 (items 1 to 3 above).

## Versus the best apps

- **Speech Blubs:** the child sees a face and copies a sound with a live video of themselves. The saying is the game. In Sona the saying comes first, then the game. Idea that fits Sona's rules: let the child's saying make something happen on screen right away (a bubble grows as they say it, the ball glows while they say it). That would use the loudness the mic already measures and needs no new grading. Rachel's call on what is said; this only changes the picture.
- **Duolingo speaking:** one short prompt, one clear "heard" or "try again", and never a stuck state. Duolingo offers "Can't speak now" after a miss. Sona has no equivalent. A grown-up's "skip this word" (listener unavailable, noisy room) would fit and keeps silence from counting as a rep.
- **Lingokids:** the character says the word and the child repeats it inside a game moment, with very little text. Sona's Peekaboo and Bubble Pop are closest to this.
- **Pok Pok and Toca Boca:** the toy is always reacting to touch, even before the goal. Peekaboo's doors do nothing while the picture peeks out. Small reactions to every tap are cheap and would help the youngest children.

## Decisions worth another look

- **Native "pass" is the only thing that moves a game** (`sayplay.js:406`). Travis and Rachel chose this ("the word or an existing close try earns that saying") so that "taco" does not count. It also means a child the listener cannot understand (young, a lisp, a loud room) never gets through. The safer middle is a fallback after a few tries. For Rachel.
- **The word falls back to the browser's robot voice when Echo's voice is not on the phone** (`sayplay.js:231-232`). The robot voice may mispronounce a target sound. "Go!" already refuses the robot voice. For Rachel.
- **Saying each word twice for ages 3-4** (Peekaboo) versus once (Bubble Pop). Already recorded as Rachel's.
- **Echo says "Say... word." and "Go!" on every turn**, even right after "Hear it". Probably intended (models the word), but the gap matters for a 3-year-old's attention.

## Already good (keep)

- The mic guards: nothing plays under an open mic, 200 ms settle, 250 ms tail, a pause that needs a tap to resume, and a stale-profile check that sends the page Home if the child changed.
- Every play game ends on a success: Hoops and Soccer ladders, Dino's glow and crumble, Bubble Pop's wider touch and touch-anywhere, Peekaboo's glow and any-door.
- The help pill is easy to leave (silence, "Back to the game", or a pause), and a double tap on it is ignored.
- Counting each saying as a rep without ever calling it practice data.
- The 320x568 phone: all five games fit with no scroll (checked on the fake phone).
- Peekaboo's doors with no reading needed, and Bubble Pop's big bubbles (about 66 px) for small fingers.

## Not checked

- The native speech path on a real iPhone, or on the fake phone (the harness has no speech bridge).
- Soccer Goal's and Dino Dig's drawing code and `crafted-*.css` in detail; I read their state machines, the miss ladder and the replay logic.
- `crafted-buddies.js` and `crafted-words.js` (not read).
- Rotation, two fingers on the screen at once, and a real slow network.
- 375x667 (only 320x568 and the 390x844 default were looked at).
- The finished suites (`sayplaytest.mjs` and the per-game suites) were not run.
