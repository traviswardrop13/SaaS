# Listening (the microphone, Apple's listener, Echo's voice)

## In five lines
1. The extra question: BOTH claims are partly true. In the iPhone app, a WORD is never counted unless Apple's listener says "pass" (Say & Play, Feed Echo, books, stories, and the practice page's word and sentence steps). A bare SOUND or syllable (practice page's early steps, the round games' say-it card, the sound power) does fall back to the sound-shape check.
2. So a child whom Apple cannot hear (Speech Recognition switched off in iPhone Settings, no on-device model, a small child it cannot write down, or one slow bridge call) can play the sound-only parts, but is stuck in every word game, book and story. There is no message and no way on except a grown-up's Skip in books and stories.
3. One slow Apple call (2.5 seconds) switches Apple's listener "broken" for the whole page, so every later word turn on that page is dead until reload (sona.js:6875, 6896).
4. The "hears me only close" problem most likely lives in fixed minimum loudness bars (0.035 to 0.05) laid over a native mic that has no automatic gain; the bar is absolute, so a quiet room does not help a quiet child.
5. Echo's voice: lines are fetched live from /api/tts (7 s wait) on first use, then kept in a phone database; nothing is shipped as a file for story lines. First-time offline = robot voice.

## Answer to the extra question (file:line)
Rule that decides it: `speechTurn()` sets `required = native && level is "word" or "sentence"` (sona.js:6856). `native` = the SonaSpeech plugin exists (sona.js:6851, 6779-6783). When `required`, "unavailable" (no permission, no on-device model, fault, slow start, wrong result) and "unknown" (empty or filler transcript) are NOT passes. `finish()` returns "unavailable" at sona.js:6917-6925 and `hearVerdict` returns "unknown" at sona.js:8173 and 8206. The comment at sona.js:6797-6798 says it on purpose: "With the bridge, a word needs a match even if recognition is unavailable or unclear." Existing tests pin it: tests/practicewordchecktest.mjs:73 ("an installed bridge with unavailable recognition offers a retry and earns nothing"), arcadewordchecktest.mjs:79.

Surface by surface (app, Apple gives unknown or unavailable):
- Say & Play (sayplay.js): NO fallback for words. Every word turn is level "word" (sayplay.js:328), `required` true, goes to `nativeWordListen`. `ready` false: `micStop(); nudge()` (sayplay.js:420). Not "pass": same (sayplay.js:406). Child is told "Tap the mic, then say it" (sayplay.js:501) forever. The other auditor is right here. Only exit: the X.
- Feed Echo (arcade-feed.html): same. 572 and 577. Only exit: Not now / home.
- Books and stories (saycheck.js): NO fallback for words. Result "unverified" (saycheck.js:314, 319, 322) becomes "Let's try the word again. Tap the mic." (library.html:1944, adventure.html:851). The "3 tries then turn the page kindly" rule counts only the sound-shape path ("shape", library.html:1934), never reached here. Only exit: the grown-up Skip button (library.html bkSkip) .
- Practice page (charge.html): Sound and syllable steps DO fall back: `hearVerdict` "unknown" goes to `shapeVerdict()` (charge.html:2207-2209). Word and sentence steps do NOT: `needsWordCheck()` (charge.html:1607) makes `verifyClip` return "pass" only if a word was already credited, else "unknown" (2199); with nothing credited the child sees "Let's try that word again." (2243, 2517). "Maybe later" leaves, and the game stays closed. A new child starts at the sound step, so day one passes; the first word step is where Apple-deaf children get stuck.
- Round games' say-it card (arcade-speech-help.js:69-135): bare sound = fallback works: `accepted = required ? pass : verdict !== "fail"` (line 126), so unknown and unavailable are let through by the loudness and shape check. Only an Apple "fail" (clear wrong word) blocks. A word card (Fruit Slice on R) is `required`; if not passed, it steps down to the bare sound (lines 128-130), so there is an exit. Edge: a required word with no `ASK.rung` just asks again.
- Sound power (arcade-speech-help.js:248-250): fallback works; only an explicit Apple "fail" cancels the power.
- CLAUDE.md (about line 5796) says "Unknown, handed to the sound-shape check": true for bare sounds, syllables, the card, the power; NOT true for words with the bridge. SPEECH_PLUGIN.md:287-288 ("Speech Recognition off: the app keeps working on the spectral check alone") is wrong for words, so Travis's phone checklist will mislead.

## Bugs

### P1
**1. Apple's listener off, missing or unable: every word game, book and story is a dead end, with no explanation.**
Sees: child says the word again and again; the mic shows "Tap the mic, then say it" or "Let's try the word again"; nothing ever moves.
Steps: install app, allow mic, deny Speech Recognition (or a phone with no on-device English model, or a child Apple writes down as nothing), open any Say & Play game, Feed Echo, a book (age-eligible) or a talking story. `requestPermission` returns granted false at once each turn, no dialog (sona.js:6900).
Where: sona.js:6856, 6917-6925; sayplay.js:406, 420; arcade-feed.html:572, 577; saycheck.js:314-322; library.html:1944.
Status: LIKELY (traced to the end; existing tests assert the "earns nothing" half; I did not run the app).
Fix: after the first "unavailable" (not a wrong word), say so once to the grown-up ("Turn on Speech Recognition for Sona in iPhone Settings") and offer the grown-up Skip / bare-sound fallback for that visit. Which fallback is allowed is Rachel's call ("taco" rule).

**2. One slow Apple call kills word listening for the whole page.**
Sees: a game or book that worked for the first words stops accepting words after a hiccup (phone busy, Low Power Mode, bridge slow); retries do nothing until the app is reloaded.
Steps: any `speechStop()` taking over 2.5 s, or `start` over 5 s.
Where: sona.js:6875 (`_speechTurnFault = true` on the stop timeout), 6907 (start timeout); never cleared; read at 6820, 6896, 6902.
Status: LIKELY. UNSURE how often a real phone is that slow.
Fix: clear the fault after a quiet period or on the next page visibility change, and retry once before giving up.

### P2
**3. A 3-second slow `available()` check counts as "unavailable"** (sona.js:6897-6899: `okay === null` returns false). The first word turn after a cold start can be refused though Apple is fine; it recovers on the next turn. LIKELY.

**4. Speech permission is asked mid-turn with the mic already open** on any page that is not the practice page (books, stories, games reached directly): up to 60 s wait (sona.js:6900) with no "Echo is waiting" state; charge.html:2317 only asks on the practice page. LIKELY.

## Experience problems
- A child whose Apple check fails sees the same cheerful "try again" for ever, with no hint it is the phone, not the child. A 4-year-old will conclude they are bad at talking. (Rachel: this is the worst possible message for a child with a speech disorder, who is the target user, and Apple's recogniser is weakest on exactly these children.)
- The books' "3 tries then turn the page kindly" and the round card's step-down exist, but Say & Play, Feed Echo and the word steps of practice have no kind exit after repeated failure. The practice rule "end every round on a success" is not met there.
- While listening a child sees only a glowing mic and "Your turn!" or "I'm listening". There is no live level or "I hear you" feedback while talking (Speech Blubs, Duolingo show the mic pulsing with the voice). Quiet children cannot tell if the phone heard anything until the verdict.

## "Hears me only when I'm close": the stages (Q3)
Child's mouth, then:
1. Mic request. Web: plain `getUserMedia({audio:true})` (sayplay.js:~300, arcade-feed.html:488): Safari applies its own automatic gain, echo and noise cancelling, so a far voice is boosted. App with Sona's own mic: native AVAudioEngine, mode `.default`, echo cancel and noise suppression reported off, AGC "unknown", gain fixed `NATIVE_MIC_GAIN = 1.0` (sona.js:6970, 7446-7449). No automatic boost on a far voice.
2. Room floor: 20th percentile of the quietest 450 ms (250 ms in Feed) (sayplay.js:86, arcade-feed.html:455), only ever goes down.
3. Bar: `max(ABSOLUTE_MIN, 3 x floor)`. Absolute minimums: 0.04 Say & Play and books (sayplay.js:361, 435, 465; saycheck.js:346), 0.035 Feed (arcade-feed.html:~535) and practice (charge.html:1703), 0.05 and 3.5x for the round games' card (arcade-slice.html listenFor). The absolute minimum is the likely culprit: in a quiet room a far child has floor x 3 well under 0.04, but the bar is still 0.04 (about -28 dB full scale), a loud speaking voice at arm's length without gain.
4. Burst length: 5 voiced frames (Say & Play), 4 (Feed), 6 (card), each about 16 ms at 60 fps. A soft S can be shorter.
5. Shape test (`famOK`): "low" sounds fail if centre above 1800 Hz and high-band share above 0.22; "hiss" sounds fail if centre below 1100 Hz and high share below 0.10 (arcade-feed.html:548-551, sayplay.js famOK). Quiet voice = more noise share, which can change the numbers.
6. Apple word check (app, words only): the above must come first, because the burst detector decides when to ask Apple (nativeWordListen).
Most likely loss: (a) website: stage 3 only if Safari's gain is low; (b) app with Sona's own mic: stage 3 (no gain, fixed floor) then stage 6 for a soft word; (c) older app build: the web mic path with Safari's gain, so it should hear better; if an old build is better than the new one, the native mic mode is the cause.
Numbers for Travis to read off the mic-numbers box (five taps on Account in Settings; practice page) with the child at arm's length, saying "sock", in the app, then speaksona.com in Safari, then the app with Speech Recognition off: (1) the level now (room) and the bar, (2) the loudest moment of the last two seconds, (3) whether the loudest moment exceeds the bar, (4) auto gain yes/no/?, echo and noise yes/no, (5) frame rate and gaps, (6) each sound that cleared the bar, counted or not. If the loudest moment is under 0.04 at arm's length, the absolute minimum is the cause. Do NOT lower it blindly (Rachel's call); designs that hear a quiet child without counting noise: measure the room floor first and set the bar from floor only (drop the absolute minimum when the floor is very low), add a per-phone gain calibration ("say hi to Echo" once), or digital gain (`NATIVE_MIC_GAIN`) applied before the bar with a clip guard, or use Apple's recogniser as the gate with the loudness bar only choosing WHEN to ask it.

## Fairness of the check (Q4, for Rachel)
Wrongly counts: in the web and for bare sounds/syllables: any voiced sound of the right shape family (a sibling, TV, a cough, a hum, a scream for a "low" sound), because only loudness and rough shape are tested. In the app for words: the TV or a sibling saying the exact word (Apple transcribes any voice, no speaker check). The bare-sound check counts "wow" never, but counts "er", "are", "grr" for R.
Wrongly does not count: a quiet voice (above); a soft S or F (low energy, hiss test wants high-band share); a child Apple writes down wrongly (the stuck case above, only for words); a word split by a pause ("ah ... rah") counts as two bursts.

## Improvements, ranked
1. Make "Apple unavailable" visible and survivable: one clear grown-up message + Skip, never silent endless retry. Impact High, effort Small, whose call: Rachel (what a no-Apple child may pass on) and Travis (wording).
2. Fix the sticky `_speechTurnFault` (retry, clear on resume). Impact Med, effort Small, engineering.
3. Update SPEECH_PLUGIN.md and CLAUDE.md so the phone checklist matches (words need Apple). Impact Med, effort Small, engineering.
4. A live listening level on the mic (a ring that grows with voice, drawn from the analyser already running) so a child sees "it hears me" and a quiet child sees it is not. Impact High, effort Med, Travis (look) with Rachel (no score look).
5. Measure the absolute minimum bar on a real phone with the mic-numbers box before touching anything. Impact High, effort Small, Rachel decides.
6. Ship the common Echo lines (the "Say…", "Go!", "I heard you", card lines) as files in the app bundle or a service-worker cache so they are instant and work offline; today they are fetched on first use then kept in the phone database (arcade-sayit.js:66), and `/api/tts` is `no-store` (app/api/tts/route.ts:48) with a 7 s timeout then the robot voice (sona.js ~6385). Impact Med, effort Med, Travis.

## Versus the best apps
- Duolingo Speak / Speech Blubs: a live mic animation that reacts to the voice, and a visible "heard" state; Sona has a glow only.
- Speech Blubs also lets a child continue after tries (no dead end). Sona's books do (3 tries); Say & Play, Feed Echo and practice words do not.
- Most apps pre-bundle their voice lines; Sona's first-time lines depend on the network.

## Decisions worth another look
- The "a word needs Apple's match even when Apple is unavailable" rule (sona.js:6797): defensible for "taco", but it hard-blocks every Apple-deaf child. Rachel and Travis should decide what an unavailable check may do (grown-up Skip, bare-sound fallback, or a clear message).
- Fixed 0.035 to 0.05 absolute bars, one per surface, not one shared number.

## Already good (keep)
- Every owner closes the mic on page hide, card close and turn change; stale-page guards (`retireStaleFeed`, `current()`) are consistent.
- Nothing plays while the mic listens (quiet windows, tail after "Go!"), and a muted mic's zero frames are dropped (`micDeaf`).
- The round card and sound power degrade gracefully; the card steps down from a word.
- Speech permission recovery: after being denied then allowed in iPhone Settings, `speechPerm()` re-asks each turn and resets the cache (sona.js:6812), so it recovers without a restart.

## Not checked
- I did not run the fake phone (the existing suites already assert the key "no pass without Apple" behaviour).
- Not read in depth: chimes (sona.js 3606-3780), SPEAK1 beyond the fetch path, the native-mic worklet (7000-7940), backgrounding, Bluetooth/car/silent-switch/Low Power Mode behaviour, loudroomtest and speechevidencetest. The practice page's own floor logic (charge.html ROOM) was only skimmed.
