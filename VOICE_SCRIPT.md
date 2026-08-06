# Sona — Voice Recording Script

Every line the app can speak, generated from `public/sona.js` so it can't drift
from what actually ships. Regenerate with `node tools/voicedoc.mjs > VOICE_SCRIPT.md`.

**How to record.** One take per row, a beat of silence at each end — trailing
silence gets trimmed, clipped word endings can't be recovered. Room tone matters
more than mic quality: soft furnishings, no fan, no laptop on the table.
Save as `<File name>.mp3` (or .wav) in the folder named at the top of each
section. A row you skip falls back to the synthetic voice, so partial delivery
is fine — record the sound models first, they carry the clinical weight.

**Read it as you'd say it to a 5-year-old in session.** These get re-voiced
through the coach timbre afterwards, which keeps your pacing, stress and warmth
and changes only who it sounds like. Deliver for the child, not for the mic.

---

## 1. Sound models — `public/coach/model/`

The clinical core. Each sound is recorded **stretched** (held ~1.5s, continuants)
or **popped** (crisp single burst, stops). Poppers must NOT be held — a held /p/
teaches a schwa the child then has to unlearn.

| # | File name | Say this | Notes |
|---|---|---|---|
| 1 | `model-P.mp3` | **puh** | POP — crisp, no schwa · /P/ |
| 2 | `model-B.mp3` | **buh** | POP — crisp, no schwa · /B/ |
| 3 | `model-M.mp3` | **mmm** | STRETCH ~1.5s · /M/ |
| 4 | `model-N.mp3` | **nnn** | STRETCH ~1.5s · /N/ |
| 5 | `model-T.mp3` | **tuh** | POP — crisp, no schwa · /T/ |
| 6 | `model-D.mp3` | **duh** | POP — crisp, no schwa · /D/ |
| 7 | `model-K.mp3` | **kuh** | POP — crisp, no schwa · /K/ |
| 8 | `model-G.mp3` | **guh** | POP — crisp, no schwa · /G/ |
| 9 | `model-F.mp3` | **ffff** | STRETCH ~1.5s · /F/ |
| 10 | `model-V.mp3` | **vvvv** | STRETCH ~1.5s · /V/ |
| 11 | `model-S.mp3` | **sss** | STRETCH ~1.5s · /S/ |
| 12 | `model-Z.mp3` | **zzz** | STRETCH ~1.5s · /Z/ |
| 13 | `model-SH.mp3` | **shhh** | STRETCH ~1.5s · /SH/ |
| 14 | `model-CH.mp3` | **chuh** | POP — crisp, no schwa · /CH/ |
| 15 | `model-J.mp3` | **juh** | POP — crisp, no schwa · /J/ |
| 16 | `model-L.mp3` | **lll** | STRETCH ~1.5s · /L/ |
| 17 | `model-R.mp3` | **rrrr** | STRETCH ~1.5s · /R/ |
| 18 | `model-TH.mp3` | **thhh** | STRETCH ~1.5s · /TH/ |
| 19 | `model-THV.mp3` | **thuh** | STRETCH ~1.5s · /THV/ |
| 20 | `cue-P.mp3` | Press your lips and pop a little puff — p! p! p! | placement cue for /P/ |
| 21 | `cue-B.mp3` | Lips together, turn your voice on — b! b! b! | placement cue for /B/ |
| 22 | `cue-M.mp3` | Lips together and hum — mmmm. | placement cue for /M/ |
| 23 | `cue-N.mp3` | Tongue up behind your teeth and hum — nnnn. | placement cue for /N/ |
| 24 | `cue-T.mp3` | Tongue taps behind your top teeth — t! t! t! | placement cue for /T/ |
| 25 | `cue-D.mp3` | Like T, but turn your voice on — d! d! d! | placement cue for /D/ |
| 26 | `cue-K.mp3` | The back of your tongue pops up in the back — k! k! k! | placement cue for /K/ |
| 27 | `cue-G.mp3` | Like K, but turn your voice on — g! g! g! | placement cue for /G/ |
| 28 | `cue-F.mp3` | Top teeth on your bottom lip, blow soft — ffff. | placement cue for /F/ |
| 29 | `cue-V.mp3` | Like F, but buzz your voice — vvvv. | placement cue for /V/ |
| 30 | `cue-S.mp3` | Teeth together, big smile, let the air hiss out — sss like a snake. | placement cue for /S/ |
| 31 | `cue-Z.mp3` | Teeth together and buzz like a bee — zzzz. | placement cue for /Z/ |
| 32 | `cue-SH.mp3` | Round your lips and whisper quiet — shhh. | placement cue for /SH/ |
| 33 | `cue-CH.mp3` | Pop it like a little train — ch! ch! ch! | placement cue for /CH/ |
| 34 | `cue-J.mp3` | Like CH, but turn your voice on — j! j! j! | placement cue for /J/ |
| 35 | `cue-L.mp3` | Tongue tip up behind your top teeth — lll, la la la. | placement cue for /L/ |
| 36 | `cue-R.mp3` | Pull your tongue back and up like a tiger growl — rrr! | placement cue for /R/ |
| 37 | `cue-TH.mp3` | Peek your tongue between your teeth and blow soft — th. | placement cue for /TH/ |
| 38 | `cue-THV.mp3` | Tongue between your teeth and buzz — th, like in 'the'. | placement cue for /THV/ |

---

## 2. Round prompts — `public/coach/say/`

Said at the top of a round. The target sound is spliced in at runtime from
section 1, so leave a clean beat where the ellipsis is.

| # | File name | Say this | Notes |
|---|---|---|---|
| 39 | `ask-ready.mp3` | Are you ready? | opens a round |
| 40 | `ask-yourturn.mp3` | Your turn! |  |
| 41 | `ask-again.mp3` | Let's try that again. | after a miss — warm, never disappointed |
| 42 | `ask-onemore.mp3` | One more time! |  |
| 43 | `ask-listen.mp3` | Listen… | before a model |
| 44 | `ask-nowyou.mp3` | Now you try! | after a model |
| 45 | `ask-repeat.mp3` | Repeat after me… |  |
| 46 | `ask-louder.mp3` | A little louder! |  |
| 47 | `ask-slow.mp3` | Nice and slow. |  |
| 48 | `ask-great-listening.mp3` | Great listening! |  |

---

## 3. Praise — `public/coach/praise/`

These fire constantly, so variety is the whole point. Give each a different
energy so a child hears a person and not a soundboard.

| # | File name | Say this | Notes |
|---|---|---|---|
| 49 | `praise-1.mp3` | Nice one! | warm |
| 50 | `praise-2.mp3` | Nice! | quick |
| 51 | `praise-3.mp3` | Great job! | big |
| 52 | `praise-4.mp3` | Awesome! | delighted |
| 53 | `praise-5.mp3` | You got it! | surprised |
| 54 | `praise-6.mp3` | Way to go! | proud |
| 55 | `praise-chest.mp3` | You filled it up! Open your chest! | daily goal hit |
| 56 | `praise-streak.mp3` | That's three days in a row! | streak |
| 57 | `praise-done.mp3` | All done for today. See you tomorrow! | end of session |

---

## 4. Story chapters — `public/coach/story/`

The daily short story — this is what a child hears every single day. Read it as
a bedtime story: slower than the prompts, the last line of each page landing
softly. The hook is a cliffhanger; give it a little mischief.

### Chapter 1 — *The Star That Fell*

| # | File name | Say this | Notes |
|---|---|---|---|
| 58 | `ch1-title.mp3` | The Star That Fell | title card |
| 59 | `ch1-p1.mp3` | A little star fell out of the sky and landed right in the meadow! | page 1 — the opening |
| 60 | `ch1-p2.mp3` | The star is scared. Your voice makes it glow brighter. | page 2 |
| 61 | `ch1-p3.mp3` | It glows! But it's still a long way from home. | page 3 |
| 62 | `ch1-p4.mp3` | The star hums along with you. It likes your voice. | page 4 |
| 63 | `ch1-p5.mp3` | Almost warm enough to float again… | page 5 |
| 64 | `ch1-hook.mp3` | Tomorrow: the star tries to fly — and the wind has other plans. | tomorrow's hook — playful |

### Chapter 2 — *The River Crossing*

| # | File name | Say this | Notes |
|---|---|---|---|
| 65 | `ch2-title.mp3` | The River Crossing | title card |
| 66 | `ch2-p1.mp3` | The star floats away — and lands on a rock in the middle of the river! | page 1 — the opening |
| 67 | `ch2-p2.mp3` | Stepping stones! One appears every time you speak up. | page 2 |
| 68 | `ch2-p3.mp3` | Halfway across. The water is loud — be louder. | page 3 |
| 69 | `ch2-p4.mp3` | A fish pokes its head up to listen to you. | page 4 |
| 70 | `ch2-p5.mp3` | One more stone and you've made it… | page 5 |
| 71 | `ch2-hook.mp3` | Tomorrow: what's making that sound in the woods? | tomorrow's hook — playful |

### Chapter 3 — *The Whispering Woods*

| # | File name | Say this | Notes |
|---|---|---|---|
| 72 | `ch3-title.mp3` | The Whispering Woods | title card |
| 73 | `ch3-p1.mp3` | The woods whisper back everything you say. Echo LOVES it here. | page 1 — the opening |
| 74 | `ch3-p2.mp3` | Say it and the trees say it right back. | page 2 |
| 75 | `ch3-p3.mp3` | Something small is following you. It's friendly. Probably. | page 3 |
| 76 | `ch3-p4.mp3` | It's a lost baby owl! It copies your sound. | page 4 |
| 77 | `ch3-p5.mp3` | The owl knows a shortcut — through the dark cave… | page 5 |
| 78 | `ch3-hook.mp3` | Tomorrow: inside the cave. Bring your loudest voice. | tomorrow's hook — playful |

### Chapter 4 — *The Cave of Echoes*

| # | File name | Say this | Notes |
|---|---|---|---|
| 79 | `ch4-title.mp3` | The Cave of Echoes | title card |
| 80 | `ch4-p1.mp3` | It's dark. But every sound you make lights the walls up blue. | page 1 — the opening |
| 81 | `ch4-p2.mp3` | Your voice bounces around and lights the way. | page 2 |
| 82 | `ch4-p3.mp3` | Cave drawings! Someone else was here long ago. | page 3 |
| 83 | `ch4-p4.mp3` | The drawings show a door made of clouds. | page 4 |
| 84 | `ch4-p5.mp3` | There's light up ahead — you're nearly through… | page 5 |
| 85 | `ch4-hook.mp3` | Tomorrow: a ladder made of clouds. Yes, really. | tomorrow's hook — playful |

### Chapter 5 — *The Cloud Ladder*

| # | File name | Say this | Notes |
|---|---|---|---|
| 86 | `ch5-title.mp3` | The Cloud Ladder | title card |
| 87 | `ch5-p1.mp3` | Out of the cave and into the sky — a ladder of clouds goes up and up. | page 1 — the opening |
| 88 | `ch5-p2.mp3` | Each cloud puffs up solid when you use your voice. | page 2 |
| 89 | `ch5-p3.mp3` | Don't look down! (Echo looked down.) | page 3 |
| 90 | `ch5-p4.mp3` | A bird gives you a lift to the next one. | page 4 |
| 91 | `ch5-p5.mp3` | The top is close enough to touch… | page 5 |
| 92 | `ch5-hook.mp3` | Tomorrow: the windy ridge, where sounds get carried away. | tomorrow's hook — playful |

### Chapter 6 — *The Windy Ridge*

| # | File name | Say this | Notes |
|---|---|---|---|
| 93 | `ch6-title.mp3` | The Windy Ridge | title card |
| 94 | `ch6-p1.mp3` | The wind up here is FAST. It steals sounds right out of the air. | page 1 — the opening |
| 95 | `ch6-p2.mp3` | Say it strong so the wind can't take it. | page 2 |
| 96 | `ch6-p3.mp3` | The star tucks into your pocket to stay safe. | page 3 |
| 97 | `ch6-p4.mp3` | The owl flies ahead to scout the way. | page 4 |
| 98 | `ch6-p5.mp3` | The wind is dropping. Something big is ahead… | page 5 |
| 99 | `ch6-hook.mp3` | Tomorrow: the Sky Door. Only one thing opens it. | tomorrow's hook — playful |

### Chapter 7 — *The Sky Door*

| # | File name | Say this | Notes |
|---|---|---|---|
| 100 | `ch7-title.mp3` | The Sky Door | title card |
| 101 | `ch7-p1.mp3` | A huge door in the sky. No handle. No key. Just a listening ear carved in it. | page 1 — the opening |
| 102 | `ch7-p2.mp3` | The door leans in. It wants to hear you. | page 2 |
| 103 | `ch7-p3.mp3` | A crack of light! Keep going. | page 3 |
| 104 | `ch7-p4.mp3` | The owl hoots along to help. | page 4 |
| 105 | `ch7-p5.mp3` | It's opening… slowly… almost… | page 5 |
| 106 | `ch7-hook.mp3` | Tomorrow: the star finally goes home. | tomorrow's hook — playful |

### Chapter 8 — *Home Again*

| # | File name | Say this | Notes |
|---|---|---|---|
| 107 | `ch8-title.mp3` | Home Again | title card |
| 108 | `ch8-p1.mp3` | Behind the door: the whole night sky, and a star-shaped gap waiting. | page 1 — the opening |
| 109 | `ch8-p2.mp3` | The star lifts out of your hands. | page 2 |
| 110 | `ch8-p3.mp3` | It's climbing! Your voice is carrying it up. | page 3 |
| 111 | `ch8-p4.mp3` | It settles into its gap and blazes bright. | page 4 |
| 112 | `ch8-p5.mp3` | The whole sky says thank you, in your voice… | page 5 |
| 113 | `ch8-hook.mp3` | Tomorrow: a brand-new adventure begins. | tomorrow's hook — playful |

---

## 5. Navigation & UI — `public/coach/ui/`

| # | File name | Say this | Notes |
|---|---|---|---|
| 114 | `ui-welcome.mp3` | Hi! I'm Echo. Let's practice together! | first launch |
| 115 | `ui-welcomeback.mp3` | You're back! I missed you. | comeback greeting |
| 116 | `ui-storyfirst.mp3` | Read today's story to unlock your games! | the daily gate |
| 117 | `ui-unlocked.mp3` | You did it! Three games are unlocked. | story finished |
| 118 | `ui-locked.mp3` | Not yet! Finish the story first. | tapping a locked game |
| 119 | `ui-tapstart.mp3` | Tap to start! |  |
| 120 | `ui-micplease.mp3` | I need to hear you — can you turn on the microphone? | mic denied |
| 121 | `ui-goodbye.mp3` | Bye for now! |  |

---

**Total rows: 121.** Sections 1 and 4 first — the sound models are the clinical
product, and the story is the part a child hears every day.
