# Handoff: Sona — Kids Speech-Practice App Redesign

## Overview
Sona is a speech-therapy practice app for kids (~3–8). The core loop: the child says a target word/sound 5 times ("charges the ticket"), which unlocks a mini-game; inside games, saying the sound again triggers power-ups, revives, and point banking. **Voice is the only controller** — no tapping to progress practice.

This redesign replaces the previous emoji-based UI with a designed "sticker" system, retires Leo (PNG mascot) for **Echo the Parrot** (pure SVG, 5 poses), adds an original 8-buddy cast, gives each mini-game its own sky, and moves all interstitials onto a shared warm-card overlay pattern.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code. The task is to **recreate these designs in the app's existing codebase** (its current framework, component patterns, and asset pipeline). Open `Sona Final.dc.html` in a browser (keep `support.js` and `uploads/` beside it) to view the full board.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, shadows, and copy are final. Recreate pixel-perfectly. Screens are mocked on a 300×650 canvas (≈ iPhone logical size scaled ~0.77; treat values as proportional, not absolute px).

## Screens / Views (flow order)

### 1. Buddy picker (onboarding)
- Cream bg `#fff6e9`, padding 20. Header: white circle back button (38px, hard shadow `0 4px 0 rgba(120,80,20,.15)`) + progress bar (14px tall, track `#f0e4d2`, fill gradient `#ffa05a→#ff8a3d`, 45%).
- Title: Baloo 2 800, 22px, `#4a2c14`, centered: "Choose a buddy for {kid name}".
- 3-column grid of 70px circular buddy avatars; ring `0 0 0 3px #fff, 0 0 0 4.5px #eee6d8`. Selected: ring becomes `#58cc02` (7px) + 24px green check badge (top-right, shadow `0 2px 0 #46a302`). 9th cell = "SURPRISE ME" (star icon + 8.5px label).
- CTA: full-width, gradient `#6edd18→#58cc02`, radius 20, shadow `0 6px 0 #46a302`, Baloo 2 800 18px white, copy "PIP'S MY BUDDY!" (updates to selection).

### 2. Home (sticker book)
- Cream bg. Header: "Hi, Mia!" (Baloo 2 800 23px `#4a2c14`) + subtitle "Let's practice your R sound" (Nunito 800 12.5px `#b08d63`); Echo idle pose (58px) on the right.
- Hero: today's activity as a tilted photo card (234×290, radius 26, 7px white border, `rotate(-2deg)`, shadow `0 12px 26px rgba(90,50,10,.2)`, image = scene panel) with overlapping caption card (`rotate(1.5deg)`): activity name + "Read with Echo · ★★★" (sticker stars, `#ffd21c`).
- "UP NEXT" label: Baloo 2 800 12px, letter-spacing .1em, `#c9a878`. Two 106×104 tilted thumbnails (±2°, 5px white border) with white pill name tags overlapping bottom edge.
- CTA: full-width orange gradient `#ffa05a→#ff8a3d`, radius 20, shadow `0 6px 0 #ef6f23`, "LET'S GO!".

### 3. Practice
- Cream bg. Header: close circle · ticket pill (ticket icon + 5 segments 15×10, radius 4 — filled `#ff8a3d`, empty `#f0e4d2`) · star-count pill.
- Word card: white, radius 26, shadow `0 8px 20px rgba(90,50,10,.12)`; "R SOUND" chip (bg `#ffe7d3`, text `#ef6f23`, Baloo 2 800 12px, ls .06em, radius 99); word illustration 118px (flat SVG fallback; production uses toy-style renders from the panel pipeline); word in Baloo 2 800 36px `#4a2c14`; phonetic hint "**Rrr**—abbit" (accent `#ef6f23`).
- Echo listening pose (78px) + speech bubble (white, radius 16 / bottom-left 4, shadow `0 5px 12px rgba(90,50,10,.12)`): "2 more and Fruit Slice unlocks!"
- Mic: 62px circle, gradient `#ffa05a→#ff8a3d`, shadow `0 5px 0 #ef6f23`, two pulsing rings (`rgba(255,138,61,.14)` / `.26`). Caption: "I'm listening — just say it out loud!"

### 4. Games — shared HUD kit
Every game uses: white close circle (38px) · white score pill (game icon + Baloo 2 800 count) · hearts pill (3 heart SVGs `#ff5c74`, lost = pale) **or** timer ring (44px, `conic-gradient(#ffb100 …)`) · bottom **voice-boost pill** (white, radius 99, mic icon + "Say **"rrrr"** for {POWER}!"). Hard shadows tint to each sky. Streak banners: Baloo 2 800 24–29px, `rotate(-3deg)` or `(-4deg)`, hard text-shadow.
- **Fruit Slice** — sunset sky `#8fd0f5→#ffe9b8→#ffb066→#ff8a5a`; skyline silhouettes; designed fruit sprites (melon/apple/orange/grapes/berry/lemon); white slice trail (13px @ .28 under 5.5px @ .92); sliced-apple halves + juice dots; glowing golden star; boost = FRENZY. Timer ring.
- **Sound Sprint** — morning sky `#aee6ff→#cff2e2→#d8f7e0`, green hills, grey 3-lane road (`#b7c5d4`, dashed white lane lines); fox buddy runner (bottom, drop-shadow); cone + boulder obstacles; coin row (gold, star-stamped); shield badge counter; boost = STAR MODE. Distance pill "128m". Timer ring.
- **Block Stacker** — dusk sky `#2b2e6b→#5b3f8f→#a45fae→#e17aa4`, stars, moon `#fff4d6`, toy-town silhouette with lit windows `#ffd88a`; crane rope + swinging glossy block **with a face**; dashed drop-guide; stacked glossy blocks (green/yellow/orange/red/purple, inset top highlight); "PERFECT!" in `#ffd21c`; "Best 18" ghost pill (`rgba(255,255,255,.2)`); boost = SLOW-MO.
- **Piano Tiles** — night concert `#231a4d→#2f2266→#43318c→#54409e`; overhead spotlight (radial); 4 columns (1.5px white lines @ .09, alternating column tint .03); glossy note tiles 63×88 radius 14 (pink/green/yellow/blue, inset top highlight, note glyph); golden star tile glows `0 0 22px rgba(255,210,28,.55)`; piano-key hit bar (92px band, white keys with `0 5px 0` shadow; pressed key = gold, translated 3px down); **hearts, not timer**; boost = GOLDEN KEYS.
- **Flappy Glide** — golden hour `#3f74ab→#6ea3d4→#ffcf9a→#ffe7c4`, sun glow, white cloud pills; topiary gate towers (green `#3fa34d`, lighter cap, leaf dots); striped balloon (red/cream/yellow) with fox peeking from basket; balloon icon in score pill; boost = SUPER FLOAT.
- **Story Time** — meadow `#d8f2ff→#eef8d6→#cdea9e`, sun, grass mounds, flower dots. Header: close · title pill "Mia's Dragon Story" · book pill "2/5". Book page: white card radius 24 with offset paper shadow (`#f1ead8` layer behind), character illustration, sentence in Baloo 2 800 22px/1.45 `#3a4a1f` with the target word as a chip (bg `#ffe7d3`, text `#ef6f23`, radius 10); 5 page dots (`#7cc40a` done w/ glow ring, `#e4edcc` todo). Echo listening + bubble "Your turn — say **rabbit**!". Bottom: "Read it to me" pill (speaker icon) + blue mic button (64px, `#5cc6ff→#1cb0f6→#1597d4`, shadow `0 5px 0 #1480c0`, 5 white waveform bars) with pulse ring.

### 5. Say-it overlays (shared pattern)
Card: `#fff6e9`, radius 28, side padding 20, shadow `0 18px 40px <sky-tinted>`; sits over the game with a tinted scrim (e.g. `rgba(24,18,56,.55)`); **Echo pose overhangs the card top** (negative margin ~-52 to -58px, drop-shadow). Secondary action is a plain text link (Nunito 800 12px `#b08d63`).
- **Ticket gate** (Echo holding star): "Fruit Slice needs a ticket!" + "Say your R sound 5 times to charge it up"; ticket + 5 empty segments in a white pill; green CTA "CHARGE UP" (bolt icon); link "Back home".
- **New life** (Echo listening, night scrim): "Whoops! Say **"rrrr"** for a new life!" (accent `#7048c9` on night sky); 2 filled hearts + 1 dashed outline heart; orange mic (50px) with pulse rings + "I'm listening…"; link "I'm done playing".
- **Results** (Echo celebrating, confetti rects rotated ±14–40°): "Level 3 done!" + context line "Block Stacker · goal 10"; 3 stars (44/56/44px, outer ±8°; unearned = `#e8dcc7`); stat pills ("14 stacked", "+6" with coin); green CTA "LEVEL 4"; link "Back to the house".
- **Points banking** (Echo celebrating, golden-hour scrim): "+34" (Baloo 2 800 30px) + "DAILY RUN POINTS" (`#ef6f23`, ls .04em); "TODAY'S RUN 86 / 120" progress bar (16px, track `#f0e4d2`, fill `#ffd21c→#ffb100`); loader dots + "Saving your points…" (auto-dismisses).

### 6. Character kit
- **Echo the Parrot** (coach, replaces Leo everywhere — 11 former placements): body `#2fb8c6`, wings `#22909e`, belly `#bfeef3`, beak `#ffb100`/`#f0a800`, crest `#ff6b6b`+`#ffd43b`, cheeks `#ff9d9d` @ .75, eyes white + `#2b2a4a`, feet `#ffb100`. Poses: **idle, listening** (wing to ear, pupils shifted), **celebrate** (wings up, closed happy eyes, open beak + tongue `#ff9d8a`), **holding star, avatar** (face crop, for circles). SVG sources in `assets/characters/`.
- **Buddies** (kid-selected; appear in games — balloon basket, runner): Pip (fox), Miso (bunny), Ziggy (dragon), Mochi (cat), Buzz (bee), Otto (octopus), Rocky (dino), Bao (panda). Each = circular sticker on pastel bg, ring `0 0 0 3px #fff, 0 0 0 4.5px #eee6d8`. Markup in the HTML (section 06).

### 7. Icons & app icon
- **Sticker icon system** (replaces ALL emoji): flat 2-tone SVGs with a white glint dot — star, coin, ticket, charge bolt, streak flame, mic, library book, goal target; Fruit Slice sprites; word-cue fallbacks. Word cues in production use toy-style renders from the existing panel pipeline (transparent bg, centered, soft shadow); flat SVG is the fallback while art generates.
- **App icon**: Echo, closed beak, on warm cream `#f5efe2`. `assets/app-icon-echo-1024.png` (full-square; iOS masks corners) + vector `assets/app-icon-echo.svg`. Tuned for small sizes: tight crop, ~15% bigger eyes, no fine detail.

## Interactions & Behavior
- **Mic-first**: practice and boosts are triggered by speech recognition only. Listening state always shows pulsing concentric rings around the mic + a text reassurance line.
- **Ticket charging**: each successful utterance fills one of 5 segments (animate fill + slight pop). Full ticket → game unlock.
- **In-game boost**: saying the target sound triggers the named power-up; the boost pill should pop/glow on recognition.
- **Overlays**: scrim fades in, card springs up (~translateY 40px → 0), Echo pose drops in with overshoot. Streak banners pop in rotated, fade after ~1.2s.
- **Home pager**: hero card swaps per activity (swipe), thumbnails promote on tap.
- **Buttons**: hard-shadow buttons depress on press (translateY(3–5px), shadow collapses) — see the pressed gold piano key for the pattern.
- Results stars land one at a time with scale overshoot; confetti on results/banking.

## State Management
- `selectedBuddy` (onboarding, persisted) · `practiceCount` 0–5 / `ticketSegments` · per-game `score`, `hearts` (3), `timerPct`, `streak`, `best` · `starsEarned` 0–3 per level · `dailyRunPoints` + session delta · `micState`: idle | listening | success | retry.

## Design Tokens
- **Type**: Baloo 2 (600/700/800) — display, numbers, buttons; Nunito (600/700/800) — body/UI. Google Fonts.
- **Core neutrals**: app cream `#fff6e9` · card white `#fff` · icon-bg cream `#f5efe2` · text `#4a2c14` · muted `#b08d63` · section label `#c9a878` · divider `#f3e8d7` · track `#f0e4d2`.
- **Accents**: green CTA `#6edd18→#58cc02` shadow `#46a302` · orange `#ffa05a→#ff8a3d` shadow `#ef6f23`, chip `#ffe7d3`/`#ef6f23` · gold `#ffd21c`/`#ffb100` shadow `#f0a800` · blue mic `#5cc6ff→#1cb0f6→#1597d4` shadow `#1480c0`, icon blue `#4db3f2`/`#2a8fd4` · hearts `#ff5c74`.
- **Skies**: sunset `#8fd0f5→#ffe9b8→#ffb066→#ff8a5a` · morning `#aee6ff→#cff2e2→#d8f7e0` · dusk `#2b2e6b→#5b3f8f→#a45fae→#e17aa4` · night `#231a4d→#2f2266→#43318c→#54409e` · golden hour `#3f74ab→#6ea3d4→#ffcf9a→#ffe7c4` · meadow `#d8f2ff→#eef8d6→#cdea9e`.
- **Radii**: screens 30 · cards 24–28 · tiles/blocks 8–14 · buttons 18–22 · pills 99.
- **Shadows**: buttons/pills = hard offset `0 4–6px 0 <darker or tinted rgba>`; floating cards = soft `0 8–18px 20–40px rgba(tinted)`; glossy game pieces = `inset 0 3–4px 0 rgba(255,255,255,.35–.5)`.
- **Scale note**: mock canvas is 300×650; multiply by ~1.3 for 390pt iPhone. Hit targets ≥44pt at production scale (mic 62→~81pt, buddy avatars 70→~91pt).

## Assets
- `assets/characters/echo-{idle,listening,celebrate,star,avatar}.svg` — Echo poses (original artwork, pure SVG)
- `assets/app-icon-echo.svg` + `assets/app-icon-echo-1024.png` — app icon (closed beak = shipped choice)
- `uploads/*.webp` — 3 illustrated scene panels used on Home (from the app's existing panel pipeline; more generated the same way)
- Buddy cast, sticker icons, and game sprites live as inline SVG in `Sona Final.dc.html` — copy paths directly.
- App Store marketing screenshots exist as a separate deliverable (not in this bundle).

## Files
- `Sona Final.dc.html` — the full merged design board (open in a browser; keep `support.js` + `uploads/` alongside)
- `support.js` — viewer runtime for the HTML board (not app code)
- `assets/`, `uploads/` — as above
