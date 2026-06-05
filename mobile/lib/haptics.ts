/**
 * Haptic feedback (Duolingo-style buzz on key moments). Dynamically requires
 * expo-haptics so the bundle still loads if it isn't installed yet — calls
 * become no-ops until `npx expo install expo-haptics` is run. Works in Expo
 * Go once installed.
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

/** Correct answer / success. */
export function hapticSuccess() {
  const m = h();
  m?.notificationAsync?.(m.NotificationFeedbackType.Success).catch?.(() => {});
}
/** Wrong / try again — a gentle warning buzz (not punishing). */
export function hapticWarning() {
  const m = h();
  m?.notificationAsync?.(m.NotificationFeedbackType.Warning).catch?.(() => {});
}
/** A light tap — selecting an option / starting to listen. */
export function hapticSelect() {
  const m = h();
  m?.selectionAsync?.().catch?.(() => {});
}
/** A medium thump — pressing the big action / starting an activity. */
export function hapticImpact() {
  const m = h();
  m?.impactAsync?.(m.ImpactFeedbackStyle.Medium).catch?.(() => {});
}
