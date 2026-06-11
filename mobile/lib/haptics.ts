/**
 * Haptic feedback (Duolingo-style buzz on key moments). Dynamically requires
 * expo-haptics so the bundle still loads if it isn't installed yet — calls
 * become no-ops until `npx expo install expo-haptics` is run. Works in Expo
 * Go once installed.
 *
 * Two layers:
 *   - Primitives  (success / warning / select / light / medium / heavy) map
 *     1:1 to expo-haptics calls.
 *   - Patterns    (coin award, star reveal, celebrate, listen-pulse) compose
 *     primitives with small delays so big moments feel cinematic, not flat.
 *
 * Anything else in the app should prefer a named pattern over an ad-hoc
 * sequence so the "feel" of the app stays consistent.
 */
let mod: any = null;
let tried = false;
function h(): any {
  if (tried) return mod;
  tried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-haptics");
  } catch {
    mod = null;
  }
  return mod;
}

// ───────────────────────── primitives ─────────────────────────

/** Correct answer / success — the classic "ding" buzz. */
export function hapticSuccess() {
  const m = h();
  m?.notificationAsync?.(m.NotificationFeedbackType.Success).catch?.(() => {});
}
/** Wrong / try again — a gentle warning buzz (not punishing). */
export function hapticWarning() {
  const m = h();
  m?.notificationAsync?.(m.NotificationFeedbackType.Warning).catch?.(() => {});
}
/** A light tap — selecting an option / arriving at a screen. */
export function hapticSelect() {
  const m = h();
  m?.selectionAsync?.().catch?.(() => {});
}
/** Light impact — tapping a button. */
export function hapticLight() {
  const m = h();
  m?.impactAsync?.(m.ImpactFeedbackStyle.Light).catch?.(() => {});
}
/** Medium impact — pressing the big action / starting an activity. */
export function hapticImpact() {
  const m = h();
  m?.impactAsync?.(m.ImpactFeedbackStyle.Medium).catch?.(() => {});
}
/** Heavy impact — the "wow" moment (level up, unlock, big confetti). */
export function hapticHeavy() {
  const m = h();
  m?.impactAsync?.(m.ImpactFeedbackStyle.Heavy).catch?.(() => {});
}
/** Rigid impact — crisper than heavy; iOS-only, gracefully falls back. */
export function hapticRigid() {
  const m = h();
  const style = m?.ImpactFeedbackStyle?.Rigid ?? m?.ImpactFeedbackStyle?.Heavy;
  if (m && style) m.impactAsync?.(style).catch?.(() => {});
}

// ───────────────────────── patterns ─────────────────────────

/**
 * Coin chime — a quick double-tap that reads as "ka-ching". Used the moment
 * coins are awarded on the done screen (and any other place coins land).
 */
export function hapticCoinAward() {
  hapticLight();
  setTimeout(hapticLight, 90);
}

/**
 * Star reveal — one tap per star, staggered so the kid feels each one land
 * as it pops onto the screen. Used on the lesson done screen.
 */
export function hapticStarReveal(stars: number) {
  const n = Math.max(0, Math.min(3, Math.floor(stars)));
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      // Final star hits a touch harder so 3-star wins feel earned.
      if (i === n - 1 && n === 3) hapticHeavy();
      else hapticLight();
    }, i * 220);
  }
}

/**
 * Big celebration — heavy thump + success ding, for confetti / unlock / level
 * complete. This is the loudest pattern; reserve it for "wow" moments.
 */
export function hapticCelebrate() {
  hapticHeavy();
  setTimeout(hapticSuccess, 120);
}

/**
 * "I'm listening to you now" — a single soft tap so the child gets a physical
 * cue the mic just went live. Quieter than `hapticSelect` so it doesn't feel
 * like a button press.
 */
export function hapticListenStart() {
  hapticLight();
}

/**
 * Unlock thump — used when a world item is purchased. Crisper than a generic
 * success because something tangible just appeared in the scene.
 */
export function hapticUnlock() {
  hapticRigid();
  setTimeout(hapticSuccess, 80);
  setTimeout(hapticLight, 200);
}

/**
 * Soft "nope" — used when the child taps an item they can't afford yet. Two
 * quick light taps read as "uh-uh" without the alarm of a warning buzz.
 */
export function hapticNope() {
  hapticLight();
  setTimeout(hapticLight, 110);
}
