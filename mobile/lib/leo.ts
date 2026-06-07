/**
 * Leo's voice across the whole app — not just inside lessons.
 *
 * Khan Academy Kids' "Kodi the bear" narrates every screen so a non-reader is
 * never stuck. We do the same with Leo: he greets on Home, welcomes the kid
 * into his World, and cheers when a lesson finishes. The TTS plumbing already
 * exists in lib/speech (`speak()` stops any in-flight utterance before the
 * next one, so layered calls cut over cleanly).
 *
 * Gates are module-level Sets so each greeting only fires once per app
 * launch, per child — leaving and returning to a screen doesn't re-greet. The
 * cheer/purchase lines aren't gated; those celebrate every time.
 */
import { speak } from "./speech";

const said = new Set<string>();
function once(key: string): boolean {
  if (said.has(key)) return false;
  said.add(key);
  return true;
}

const RATE = 0.85; // a touch faster than the lesson read rate — friendlier.

/** First time the home screen sees this child, greet them by name. */
export function leoGreetHome(name: string, childId: string) {
  if (!once(`home:${childId}`)) return;
  speak(`Hi ${name}! Ready for today's session?`, { rate: RATE });
}

/** First arrival in Leo's World — explains the mechanic out loud. */
export function leoWelcomeWorld(childId: string) {
  if (!once(`world:${childId}`)) return;
  speak("Welcome to my world! Tap a faded thing to add it.", { rate: RATE });
}

/** Said out loud the moment a world item is unlocked. */
export function leoPurchaseCheer(itemName: string) {
  speak(`Yay! A ${itemName}!`, { rate: 0.9 });
}

/** Lesson-complete cheer; uses the child's name when we have it. */
export function leoLessonCheer(name?: string) {
  speak(name ? `Great job, ${name}!` : "Great job!", { rate: 0.9 });
}
