# Sona art drop-in manifest

Every image below auto-loads the moment the file exists at the path — **zero code**.
Until then the app shows a placeholder (gradient / emoji / CSS). Names are exact,
lowercase, **no spaces**. Target style: the rich, vibrant, dimensional look from the
8–10 "Champion's Arena" screen.

## Level-group map screens  (9:16 vertical PNG)
- `coach/map/levels1-4.png`   — Starter Town (1–4)
- `coach/map/academy.png`     — The Academy Grounds (5–7)  ✅ in
- `coach/map/levels8-10.png`  — Champion's Arena (8–10)    ✅ in

## Game backgrounds  (drops behind each game's scene)
`coach/<game>/bg.png` for: cupstack, rocket, racer, bubble, match, whack,
grocery, train, story, chat.

## Game props  (transparent PNG, keyed on flat green #00b140)
- `coach/cupstack/cup.png` — the stacking cup
- `coach/rocket/rocket.png` — the rocket

## Vocabulary pictures  (replace the food/animal emoji in the games)
- `coach/items/<word>.png` — e.g. `rabbit.png`, `cake.png`.
  Full list + spec in `coach/items/README.md`.

## Notes
- Transparent props/items: generate on flat green `#00b140`; keyed with `scripts/key-pose.js`.
- Map screens & backgrounds: full image, no transparency.
- Mascot/character art is parked.
