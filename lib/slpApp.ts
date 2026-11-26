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

/**
 * SESSION PLAY (SESSPLAY1, 17 Nov 2026, Travis: "I want it built into their
 * app"): the pages a game played in a session needs, the practice page, every
 * game page, the talking story and the bookshelf. They may load in the app,
 * and public/sona.js sends any of them straight back to the dashboard unless
 * this tab holds a session the server said yes to (its record is in the tab's
 * sessionStorage, which the server never sees). Never the family's Home,
 * setup, Settings or the price screen.
 */
export const SLP_APP_PLAY_PAGE = /^(charge|library|adventure|arcade-[a-z]+)\.html$/;

export function slpAppRequest(userAgent: string | null | undefined): boolean {
  return SLP_APP_UA.test(String(userAgent || ""));
}

export function slpAppPageAllowed(pathname: string): boolean {
  const m = /^\/([a-z0-9-]+\.html)$/i.exec(pathname || "");
  if (!m) return true;
  const page = m[1].toLowerCase();
  return SLP_APP_PAGES.indexOf(page) >= 0 || SLP_APP_PLAY_PAGE.test(page);
}
