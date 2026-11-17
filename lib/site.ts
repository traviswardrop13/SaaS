/**
 * WHERE THE APP LIVES (APPHOST1, 17 Nov 2026). Travis: point the app at
 * app.speaksona.com "so that I can get speaksona.com officially inside my
 * home base of high level". The app and every API route move to
 * app.speaksona.com; speaksona.com (and www) become GoHighLevel's website
 * once Travis switches its DNS (DOMAIN_MOVE.md says when, and what first).
 *
 * So every link Sona EMAILS points here, never at speaksona.com: an email
 * outlives the switch, and after it a speaksona.com link opens GoHighLevel's
 * site, not the unsubscribe or the sign-in it promised.
 *
 * Links a page builds for itself keep using the page's own address
 * (location.origin, the request's origin), which is already app.speaksona.com
 * once the family is moved, and stays a preview or test address elsewhere.
 */
export const APP_HOST = "app.speaksona.com";
export const APP_ORIGIN = "https://" + APP_HOST;

/**
 * The address an emailed link should use, given the request's own origin:
 * any speaksona.com address becomes the app's; anything else (a Vercel
 * preview, localhost under test) is left alone, so a link a developer is
 * sent still opens the build that sent it.
 */
export function linkOrigin(origin: string): string {
  try {
    const host = new URL(origin).hostname;
    if (host === "speaksona.com" || host.endsWith(".speaksona.com")) return APP_ORIGIN;
  } catch (e) {}
  return origin;
}
