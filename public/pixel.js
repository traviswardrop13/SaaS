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
  var META_PIXEL_ID = ""; // ← PASTE YOUR META PIXEL ID HERE (e.g. "1234567890123456")

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

  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");

  window.sonaTrack = function (event, params) {
    try { fbq("track", event, params || {}); } catch (e) {}
  };
})();
