/*
 * Sona analytics — PostHog, privacy-hardened for a kids' speech app.
 *
 * Runs on parent/marketing pages AND inside the iOS shell (the purchase
 * funnel lives in-app), with different postures:
 *   - web: pageviews on (ad-funnel diagnostics), autocapture OFF
 *   - shell: no pageviews, no autocapture — only the whitelisted events below
 * Both: session replay disabled, heatmaps off, no rage-click tracking.
 *
 * Identity is the anonymous family id (Sona.fid) — never a name or an email.
 * Event properties pass a hard whitelist; free-form data never leaves. Child
 * names, recordings, transcripts, and typed text never reach this file.
 * Loaded by: parent pages, onboarding, subscribe, and charge.html (practice
 * telemetry only) — never the arcade game pages.
 *
 * The phc_ key is a PUBLISHABLE client token (like a pixel id): safe in git.
 * Events: window.SonaAnalytics.track(name, props). The legacy sonaTrack
 * chain (Meta) is web-only and unchanged.
 */
(function () {
  var POSTHOG_KEY = "phc_xRPqirD2PznnvZrpeuLDwo7LtYegHsF2xWsDNLEEXdkw"; // PostHog Project API key (public)
  var POSTHOG_HOST = "https://us.i.posthog.com";
  var NATIVE = !!window.Capacitor;
  var ALLOWED = { sound: 1, game: 1, duration_seconds: 1, attempts_count: 1, surface: 1, plan: 1, source: 1 };

  window.SonaAnalytics = { track: function () {}, identify: function () {}, reset: function () {} }; // no-op until loaded

  // Shell: the Meta chain stays a no-op (ad pixels never ship in the app).
  if (NATIVE && typeof window.sonaTrack !== "function") window.sonaTrack = function () {};

  if (!POSTHOG_KEY) return; // inert until configured

  if (!NATIVE) {
    // Web: chain PostHog onto sonaTrack regardless of load order with pixel.js.
    var prior = typeof window.sonaTrack === "function" ? window.sonaTrack : function () {};
    window.sonaTrack = function (event, params) {
      try { prior(event, params); } catch (e) {}
      try { if (window.posthog && window.posthog.capture) window.posthog.capture(event, params || {}); } catch (e) {}
    };
  }

  // Official PostHog loader snippet (queues calls, then loads posthog-js).
  !(function (t, e) {
    var o, n, p, r;
    e.__SV ||
      ((window.posthog = e),
      (e._i = []),
      (e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split(".");
          2 == o.length && ((t = t[o[0]]), (e = o[1]));
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }
        ((p = t.createElement("script")).type = "text/javascript"),
          (p.crossOrigin = "anonymous"),
          (p.async = !0),
          (p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js"),
          (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
        var u = e;
        for (
          void 0 !== a ? (u = e[a] = []) : (a = "posthog"),
            u.people = u.people || [],
            u.toString = function (t) {
              var e = "posthog";
              return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e;
            },
            u.people.toString = function () {
              return u.toString(1) + ".people (stub)";
            },
            o =
              "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(
                " "
              ),
            n = 0;
          n < o.length;
          n++
        )
          g(u, o[n]);
        e._i.push([i, s, a]);
      }),
      (e.__SV = 1));
  })(document, window.posthog || []);

  window.posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,                 // never record raw clicks/inputs
    capture_pageview: !NATIVE,          // web funnel only; the shell sends events, not URLs
    capture_pageleave: false,
    disable_session_recording: true,    // never record a child's screen
    enable_heatmaps: false,
    rageclick: false,
    person_profiles: "identified_only",
    loaded: function (ph) {
      // identity = the anonymous family id — never a name or email
      try { if (window.Sona && window.Sona.fid) ph.identify(window.Sona.fid()); } catch (e) {}
    },
  });

  window.SonaAnalytics = {
    track: function (name, props) {
      try {
        var clean = {};
        for (var k in props || {}) if (ALLOWED[k]) clean[k] = props[k];
        clean.native = NATIVE;
        window.posthog.capture(name, clean);
      } catch (e) {}
    },
    identify: function (id) { try { if (id) window.posthog.identify(String(id)); } catch (e) {} },
    reset: function () { try { window.posthog.reset(); } catch (e) {} },
  };
})();
