# Hoops: painted gym pass

28 September 2026. Scope: `arcade-hoops.html`, `crafted-hoops.css`, drawing functions in `hoops.js`, and the optional picture renderer in `sayplay.js`.

The original court perspective, ball radius, shot timing, collision geometry, growing help after missed shots, moving hoop, eight-basket finish, speech gate and audio are unchanged. The renderer now uses a warm painted timber floor and framed backboard, teal padded walls, brass backboard pins, a cream rope net, highlighted rim and pebbled leather basketball. The eight score dots are inset into a small wooden score plaque. The practice card uses the same warm ivory material as the rest of the crafted app, the existing illustrated word atlas, and the painted Echo portrait. Only Hoops loads the atlas for Say & Play; the shared engine keeps its original picture fallback when no atlas is present.

The new scoped CSS reserves room for the status bar, home indicator, score bar and word card. The court keeps its original 440:560 aspect ratio; the existing engine resizes its projection to the displayed canvas.

## Material

Reuses `/assets/crafted/painted-wood-ivory.webp`, generated for Piano Tiles. Exact image prompt and source provenance are in `piano-v2.md`. The canvas caches its material tint once per color. Ball leather is drawn procedurally so it rotates with the existing ball instead of looking like timber.

## Checked

- Existing Hoops scenario extracted unchanged from `tests/sayplaytest.mjs`, using isolated port 28733: **34 assertions passed**, exit code 0. Includes no ball before speech, silence, tap versus swipe, missed shots, pause/resume, eight baskets, replay, mic/audio separation and no practice-data writes.
- Real pointer swipes after a simulated spoken turn at 393×852 (safe areas 59/34) and 320×568 (20/0): each scored one basket; no runtime errors.
- Document scroll dimensions exactly matched both phone viewports; no horizontal or vertical overflow.
- `node --check public/hoops.js` and `git diff --check` passed.
- Screenshots captured at `/private/tmp/sona-hoops-v2-{393,320}-{speech,ready,shot,basket}.png`.

The focused automated device supplies simulated speech, not a real microphone. No physical iPhone or acoustic assessment is claimed. The root agent owns the complete release suite.
