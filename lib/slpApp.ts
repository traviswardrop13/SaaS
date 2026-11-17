/**
 * THE CLINICIANS' OWN iPHONE APP (SLPAPP1, 16 Nov 2026; Travis: "start
 * building the SLP dashboard mobile app", its own App Store app that never
 * sells). It is a Capacitor shell like the family app, loading speaksona.com,
 * and its config adds "SonaSLPApp/<n>" to the web view's user agent
 * (native/slp-ios/capacitor.config.json). That word is how a page knows it is
 * in the clinicians' app: the dashboard and its sign-in render there (the
 * family app is still sent home from them), and every other page sends it to
 * the dashboard. It grants nothing: anyone can send any user agent, and all it
 * changes is which pages show, and that the dashboard hides its prices.
 *
 * Edge-safe (the middleware imports it): no Node modules.
 */
export const SLP_APP_UA = /\bSonaSLPApp\/\d/;

/** Pages the clinicians' app may show; any other .html goes to the dashboard. */
export const SLP_APP_PAGES = ["slp.html", "slp-login.html", "privacy.html"];

export function slpAppRequest(userAgent: string | null | undefined): boolean {
  return SLP_APP_UA.test(String(userAgent || ""));
}

export function slpAppPageAllowed(pathname: string): boolean {
  const m = /^\/([a-z0-9-]+\.html)$/i.exec(pathname || "");
  return !m || SLP_APP_PAGES.indexOf(m[1].toLowerCase()) >= 0;
}
