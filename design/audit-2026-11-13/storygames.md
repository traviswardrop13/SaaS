# storygames (Light the Way, Wind-Up Toys, Puzzle Bridge)

## In five lines
- The three games are well built: each move is earned by a heard word, the finger makes the move, and every help ladder really ends. I found no P0 and no way to get a child stuck for ages 5-8.
- The one real hole is the little-kid ladders: Wind-Up Toys (confirmed) and Puzzle Bridge (traced) only help a finger that MOVES. A 3-year-old who only taps or pokes gets no help at all.
- Wind-Up Toys ignores every touch for 1.3 seconds after a "yawn" or "dizzy", with nothing on screen saying "wait". A child who retries at once thinks the toy is broken.
- Three sayings of one word before each move is the biggest cost: about 8 to 10 seconds of talking and listening for every 4 to 15 seconds of playing. It is Travis's and Rachel's call. Lighthouse is the most fun; Bridge has the most to teach; Wind-Up Toys is the weakest word-to-game link.
- Smallest phone (320x568): everything fits, nothing is under the top bar, the home bar or a thumb. Light the Way's find area is small there (about 20 px across the middle of the light).

## Bugs

### P2: Wind-Up Toys, a child who only taps never gets help (CONFIRMED)
- Sees: a 3 or 4 year old pokes the big brass dial again and again. The needle never moves, no arrows appear, no hint, the oil can help does not change that. Only a dragging finger gets anything.
- Steps: ages 3-4 (`age: "4"`), say the first word, then press and release on the dial 40 times over about 14 seconds without moving. After that: `ladder.effort = 0`, `turns = 0`, banner still "Wind up the bunny". The same holds for ages 5-8.
- Where: `public/windup.js:828-836` (a move under 0.5 px is dropped), `:978` (effort counts only a finger that is moving), `:851` (the last rung needs a real drag).
- Fix: count a tap or a still press as effort the way Light the Way does (`lighthouse.js:839`, a tap counts at least half a second), so the arrows and the dot appear for a toddler who pokes.

### P2: Puzzle Bridge ages 3-4, a tap never carries the stone even at the last rung (LIKELY)
- Sees: a toddler taps the stone over and over. Nothing turns (no turning for little ones), and even after the "any drag carries it" rung, a tap does nothing; it needs a 12 px drag.
- Where: `public/bridge.js:1020-1025` (a tap only tries to turn; turning is off for little), `:992` (grab anywhere at rung 3 is fine, but only a drag carries).
- Fix: at rung 3 for ages 3-4, let a tap on the stone send it to the right hole's edge.

### P2: Puzzle Bridge, pressing and holding the stone drops it (LIKELY)
- Sees: a small child puts a finger on the stone and keeps it there without moving. After a third of a second it counts as "let go", the stone just sits where it was, then 2 seconds later glides back. No sound, no words.
- Where: `public/bridge.js:1020-1026` (a press longer than 0.3 s with under 12 px of movement goes to `drop()`), `:429` and `:491` (the 2-second wait, then goes home).
- Fix: treat a long still press as a pick-up, not a drop; only drop on lift after a real move.

### P2: Wind-Up Toys, all touches are ignored for 1.3 s after a yawn or dizzy spin (LIKELY)
- Sees: the toy yawns or spins dizzy, and the child tries again at once. The dial does nothing; the Oil can and "Hear what to do" are also greyed out. No cue says "wait a moment".
- Where: `public/windup.js:816` (`down` returns while `reacting()`), `:1009-1011` (buttons off), `:192` (1.3 s).
- Fix: queue the touch, or shorten the reaction to about 0.6 s, or dim the dial during it so the pause reads as intended.

### P2: Light the Way, the find area on the smallest phone is small (LIKELY, from the numbers)
- Sees: on a 320x568 phone, ages 5-8, the pool of light is about 66 px across and the part that finds a boat is 40 px across; a boat is about 41 px wide, and the find needs half a second of steady holding. A shaky 5-year-old will hit "So close! Hold the light on it" a lot.
- Where: `public/lighthouse.js:194` (`baseR` is 0.13 of the sea's width; the sea is only 257 px wide there), `:205` (`inner` 0.6), `:206` (hold 0.5 s).
- It ends: after about 12 seconds the pool grows and the hold drops to 0.1 s (`:206`), and decoys also climb the ladder, so nobody is stuck. This is "slow", not "broken".
- Fix: a floor on the pool radius (for example 44 px) so small phones are not harder than big ones.

## Experience problems
- Three sayings per move (the number Travis and Rachel chose). Per move: Echo says the word (about 1.5 s), "Go!", the mic opens, three sayings with at least 0.45 s between them, then Echo reads the step line (3-4 s, the finger can already play). That is roughly 8-10 s of talking before each move. Play itself is 4-15 s, then a 1.15 s cheer and 1.4 s before the next word. A full 5-8 round is 8 moves, so about 3 to 4 minutes, half of it talking. For ages 3-4 it is 6 moves, about 2.5 to 3 minutes. The cost is not the total but the rhythm: talk, play, talk, play, with no part where the child can just play. Plainly: it is a slog if a child dislikes saying the word, a good rhythm if they like it.
- Windup 3-4 line "Draw circles on the key until it rings" shows a tiny key on the toy's back and a big dial below. A child who cannot read can follow the teal arrows, but the word "key" points at the small thing, not the big one (picture `windup-4-play.png`).
- Light the Way at 320x568: the sea band is only about 275 px tall and the "Lost boat" card and banner cover its top. Fine to play, but small; on an iPad in landscape the sea is a narrow strip in the middle with dark sides (picture `lighthouse-ipadL.png`), and the boat is tiny.
- Puzzle Bridge ages 3-4 has dotted shape outlines drawn all over the top of the screen (picture `bridge-4-play.png`). They are only background, but a 3-year-old could try to put the stone on them.
- Puzzle Bridge ages 5-8: the stone is the same brown as the bridge (picture `bridge-7-play.png`); only the spiral medallion and a dark outline separate it. Readable, but the first look is "which part is the stone?".
- Replay from "Your games": no new things to find. Boats, toys and stones are in the same order and the same places every time. The only change is what you remember.

## Improvements, ranked
1. Make taps and still presses count as trying on Wind-Up Toys and Puzzle Bridge (little ones). Why: a toddler who pokes is the child the ladders are for, and today they get nothing. Impact High for ages 3-4. Effort Small. Engineering.
2. Break up the talking: let the first saying turn the lamp on, or let the child start moving while the 2nd and 3rd saying happen (the game is "dark" until all three). Why: the rhythm is the biggest feel problem. It changes what a word earns, so it is Rachel's call and Travis's. Impact High. Effort Medium. Rachel and Travis.
3. Make Wind-Up Toys' yawn and dizzy reaction shorter (about 0.6 s) or clearly "wait". Impact Medium. Effort Small. Engineering.
4. A minimum pool size in Light the Way on small phones. Impact Medium. Effort Small. Engineering.
5. Vary the replays: shuffle boat positions, toy order, stone shapes by a seed that changes per replay. Why: "Your games" is the retention hook (FOUND1), and today a replay is the same game. Impact Medium. Effort Medium. Travis.
6. Make Puzzle Bridge's stone stand out from the bridge (a lighter rim or a gentle glow before it is touched). Impact Low to Medium. Effort Small. Engineering.
7. Wind-Up Toys: swap "on the key" for "on the big gold wheel" in the ages 3-4 line. A word change on what a child hears, so Rachel reads it. Impact Low. Effort Small. Rachel.

## Versus the best apps
- Toca Boca / Sago Mini: let the toy react to a touch at any time. Here, before the word, a touch on the water in Bridge makes ripples (good), but Wind-Up Toys and Light the Way give nothing for touching before the word. Fits Sona's rules (a reaction that moves nothing forward is allowed).
- Pok Pok / Lingokids: a short win every 10 seconds. Here the win only comes after about 10 seconds of talking plus play. Fits as long as the three sayings stay; could be cut with a visible "1 of 3" lamp warm-up (Light the Way could glow a little brighter with each saying).
- Speech Blubs: the child sees their own reaction (video). Not allowed here (no audio or video kept). The nearest fit is the buddy and Echo cheering after each saying, not only after the third.
- Duolingo ABC: a clear, small reward after every item with a progress path. Here the 8 dots at the top are the path, and the helper map is the reward. Good match already.

## Decisions worth another look
- Three sayings per word vs two (Travis, 23 Oct 2026). I would keep it but let the game give a small sign after each saying (a flicker of the lamp, a nudge of the key). This does not change what is asked or counted, so it sits with Travis.
- A child the phone cannot hear (mic refused, "Not now") cannot finish a story Day 1-3 at all. CLAUDE.md already lists it as Rachel's call. The cost: that family sees the same story come back. I would ask Rachel whether a grown-up's "finish anyway" belongs.
- Little ones are asked their sound whatever their age (R for a 4-year-old). Rachel's call, already recorded.

## Already good (keep)
- Silence never moves anything; every help ladder climbs on trying, never on waiting, and ends (Light the Way, Bridge: confirmed by reading; windup: only for a moving finger, see the bug above).
- The hand-back to the story ("See what happens!"), no Play again on a story day, a replay finishing nothing, and a typed replay address for an unfinished story going Home (`arcade-lighthouse.html:188-192`).
- One finger owns the stone or the dial; a resting palm or a second finger cannot lock the game (`bridge.js:991`, `windup.js:817-820`).
- Pause and return in each phase, the fake clock only moving while the game is live, Reduce Motion (every move becomes a cut or a fade), keyboard play, and a drawn stand-in for every picture.
- Start card and Lost boat card say what to do for a child who cannot read: a picture of the boat, arrows on the dial, a shape in the hole.
- At 320x568 nothing is under the top bar, the home bar or a thumb. A phone turned to landscape gets "Turn your screen back!".

## Not checked
- I did not play the whole of any round by script; round-length numbers come from the code constants plus an estimate of Echo's voice length (the fake phone answers in about 100 ms).
- Light the Way's twist step (cloud and teacup), decoys and Bridge's rising river on a real finger. Read, not driven.
- Sounds and loudness (`MEDIA_PEAK`), real iPhone touch (a finger covering the stone), and the real voice clips.
- Which Rachel-reviewed words appear for each sound in these games (`GAME_WORDS`), and whether a typed `/arcade-<game>.html` address without `?again=1` plays a full round and earns reps for a family whose story is already finished (seems allowed; not traced).

## Ratings (1 to 5)
| | clear in 10 s | fun to repeat | word feels part of the game | fits small phones | bug-free |
|---|---|---|---|---|---|
| Light the Way | 4 (boat card + twinkle) | 4 | 4 (the word lights the lamp) | 3 (small pool) | 4 |
| Wind-Up Toys | 4 (arrows show the move) | 3 | 3 (the word gives the key, then it is a wheel) | 4 | 3 (tap-only, 1.3 s lock) |
| Puzzle Bridge | 4 (shapes) | 3 | 4 (the word calls the stone up) | 4 | 3.5 (press-and-hold, tap-only) |

Biggest single change per game:
- Light the Way: a floor on the pool size for small phones, and a light that grows a little with each saying.
- Wind-Up Toys: count taps and pokes as trying, so a toddler gets help.
- Puzzle Bridge: a long press picks up the stone instead of dropping it.
