/* Meta (Facebook) Pixel — parent marketing funnel only (never the kids' game pages).
 *
 * A Pixel ID is a PUBLIC client-side identifier (not a secret), so it's safe to
 * commit. Paste yours from Meta Events Manager below, redeploy, and it goes live.
 * Until it's set, everything here is an inert no-op (nothing loads, nothing tracks).
 *
 * Use window.sonaTrack(event, params) anywhere to fire a standard event, e.g.
 *   sonaTrack("Lead")  ·  sonaTrack("Purchase", { value: 39.99, currency: "USD" })
 */
(function () {
  var META_PIXEL_ID = "28886011914332605"; // Sona pixel (Meta Events Manager)
  // <script src="/pixel.js" data-autoconfig="off">: read here, at the top,
  // because document.currentScript is only this tag while this file first runs.
  var QUIET = false;
  try { var cs = document.currentScript; QUIET = !!(cs && cs.getAttribute && cs.getAttribute("data-autoconfig") === "off"); } catch (e) {}

  window.sonaTrack = function () {}; // safe no-op until configured

  // Native app (Capacitor): ship zero third-party tracking (kids/COPPA). Web is unaffected.
  if (window.Capacitor) return;

  if (!META_PIXEL_ID) return;

  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  // SETUP ASKS ABOUT A FAMILY, so on that page Meta's own button-reading is off:
  // left on, Meta's script sends the words on every tapped button by itself
  // (and scans the page's metadata and forms), which would carry a parent's
  // answer off the phone with no line of ours sending it. It has to be set
  // before init. Explicit events (PageView, Lead…) still fire, with no
  // parameters. Only a page that asks for it is quiet: the landing pages and
  // the plan screen keep Meta's automatic events.
  if (QUIET) fbq("set", "autoConfig", false, META_PIXEL_ID);
  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");

  window.sonaTrack = function (event, params) {
    try { fbq("track", event, params || {}); } catch (e) {}
  };
})();
