/*
 * Sona analytics — PostHog, privacy-hardened for a kids' speech app.
 *
 * Runs on parent/marketing pages AND inside the iOS shell (the purchase
 * funnel lives in-app), with different postures:
 *   - web: pageviews on (ad-funnel diagnostics), autocapture OFF
 *   - shell: no pageviews, no autocapture — only the whitelisted events below
 * Both: heatmaps off, no rage-click or dead-click tracking, no surveys, no
 * console or network capture.
 *
 * Session replay (REPLAY1, 15 Oct 2026) is OFF everywhere but four grown-up
 * screens on speaksona.com (see REPLAY below): the home page, /try, parent
 * setup (the page turns it on and off screen by screen, never past the
 * hand-off) and the plan screen while it shows the offer. On those, before
 * anything leaves the phone, every child's name and parent email this phone
 * knows is replaced ("[child]", "[email]"), every box a grown-up types in is
 * recorded as an empty shape, and setup's speech therapy question and the
 * summary screen after it are not recorded at all.
 *
 * Identity is the anonymous family id (Sona.fid) — never a name or an email.
 * Event properties pass a hard whitelist; free-form data never leaves.
 * Loaded by: check, for-slps, onboarding, parents, settings, subscribe and
 * try, and every Next.js page (app/layout.tsx) — never a child's practice,
 * game or book page.
 *
 * The phc_ key is a PUBLISHABLE client token (like a pixel id): safe in git.
 * Events: window.SonaAnalytics.track(name, props). The legacy sonaTrack
 * chain (Meta) is web-only and unchanged.
 */
(function () {
  var POSTHOG_KEY = "phc_xRPqirD2PznnvZrpeuLDwo7LtYegHsF2xWsDNLEEXdkw"; // PostHog Project API key (public)
  var POSTHOG_HOST = "https://us.i.posthog.com";
  var NATIVE = !!window.Capacitor;
  // `step` (5 Oct 2026) is a fixed code for WHICH screen was reached: a setup
  // screen's key ("name", "ready"…) or which price card a phone showed
  // ("free-sure", "paid"…). Never what was tapped on it: the two answers a
  // parent gives in setup stay on the phone, and no caller is handed them.
  var ALLOWED = { sound: 1, game: 1, duration_seconds: 1, attempts_count: 1, surface: 1, plan: 1, source: 1, step: 1 };

  window.SonaAnalytics = { track: function () {}, identify: function () {}, reset: function () {}, replay: function () {} }; // no-op until loaded

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

  // REPLAY (REPLAY1, 15 Oct 2026). Travis: "how do i start recording", yes
  // to recording only grown-up screens with names and typing blanked out.
  // Only on speaksona.com itself (a preview build or a test server on
  // localhost never records), and only on these paths:
  //   - "/" (parents.html) and "/try": started here, in a browser only (in
  //     the app those pages redirect home before they render);
  //   - "/onboarding.html", the parent's setup (never a clinician's, ?slp=):
  //     the page calls SonaAnalytics.replay(on) for each screen;
  //   - "/subscribe.html": the page calls replay(true) once the offer is up,
  //     never for Settings › Your plan.
  // Recording starts as OFF at init everywhere and is only ever switched on
  // by an explicit call, so a page that forgets to call records nothing.
  var HERE = window.location || {};
  var ON_SITE = HERE.hostname === "speaksona.com" || HERE.hostname === "www.speaksona.com";
  var PATH = HERE.pathname || "";
  var AUTO_PATHS = { "/": 1, "/parents.html": 1, "/try": 1, "/try.html": 1 };
  var REPLAY_AUTO = ON_SITE && !NATIVE && !window.__sonaFamilyRedirect && AUTO_PATHS[PATH] === 1;
  var REPLAY_PAGE = REPLAY_AUTO || (ON_SITE && ((PATH === "/onboarding.html" && !/[?&]slp=/.test(HERE.search || "")) || PATH === "/subscribe.html"));

  // WHAT A RECORDING MAY NEVER CARRY: every child's name and grown-up's email
  // this phone knows. Read from the profiles, the kids list and setup's draft
  // (all in localStorage) and from the boxes being typed in right now, each
  // time something is about to be recorded or sent, and never forgotten
  // while the page is open (a name changed on Back is still scrubbed).
  var KEEP_KEYS = { childName: "n", name: "n", email: "m", parentEmail: "m" };
  var BOXES = ["obName", "updEmail", "obEmail", "fEmail", "remindEmail"];
  var seen = { n: {}, m: {} }, seenVer = 0, rawSeen = {}, scrubbers = null, scrubVer = -1;
  function keep(kind, v) {
    v = typeof v === "string" ? v.replace(/^\s+|\s+$/g, "") : "";
    if (!v || v.length > 200) return;
    var k = v.toLowerCase();
    if (!seen[kind][k]) { seen[kind][k] = v; seenVer++; }
  }
  function walk(v, depth) {
    if (!v || typeof v !== "object" || depth > 4) return;
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      if (typeof v[k] === "string" && KEEP_KEYS[k]) keep(KEEP_KEYS[k], v[k]);
      else if (v[k] && typeof v[k] === "object") walk(v[k], depth + 1);
    }
  }
  function remember() {
    try {
      var ls = window.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var key = ls.key(i);
        if (!key || !(key.indexOf("sona.profile.v1") === 0 || key === "sona.obdraft.v1" || key === "sona.kids.v1")) continue;
        var raw = ls.getItem(key);
        if (!raw || rawSeen[key] === raw) continue;   // parse a key only when it changed
        rawSeen[key] = raw;
        try { walk(JSON.parse(raw), 0); } catch (e) {}
      }
    } catch (e) {}
    for (var b = 0; b < BOXES.length; b++) {
      try { var el = document.getElementById(BOXES[b]); if (el && el.value) keep(/mail/i.test(BOXES[b]) ? "m" : "n", el.value); } catch (e) {}
    }
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&"); }
  // A name of three letters or more is replaced wherever it appears, inside
  // a longer word too (safer, and only the replay's words suffer). One or
  // two letters only as a whole word, or every "a" and "Jo" would go.
  // Addresses first: an address can hold the child's name.
  var LETTER = "A-Za-z0-9\\u00C0-\\u024F";
  function buildScrubbers() {
    if (scrubVer === seenVer && scrubbers) return scrubbers;
    var out = [], kinds = [["m", "[email]"], ["n", "[child]"]];
    for (var t = 0; t < kinds.length; t++) {
      var list = [];
      for (var k in seen[kinds[t][0]]) if (Object.prototype.hasOwnProperty.call(seen[kinds[t][0]], k)) list.push(seen[kinds[t][0]][k]);
      list.sort(function (a, b) { return b.length - a.length; });
      for (var i = 0; i < list.length; i++) {
        var e = reEsc(list[i]);
        if (list[i].length >= 3) out.push([new RegExp(e, "gi"), kinds[t][1]]);
        else out.push([new RegExp("(^|[^" + LETTER + "])" + e + "(?![" + LETTER + "])", "gi"), "$1" + kinds[t][1]]);
      }
    }
    scrubVer = seenVer; scrubbers = out;
    return out;
  }
  function scrub(s) {
    if (typeof s !== "string" || !s) return s;
    var list = buildScrubbers();
    for (var i = 0; i < list.length; i++) s = s.replace(list[i][0], list[i][1]);
    return s;
  }
  // Every string in an event, at any depth, but never the ids PostHog needs
  // to file it (a name that happens to sit inside a random id would break
  // the event, not hide anything). Too deep to walk means not sent.
  var IDS = { token: 1, distinct_id: 1, $session_id: 1, $window_id: 1, $device_id: 1, $anon_distinct_id: 1, uuid: 1, $insert_id: 1 };
  function scrubDeep(v, depth) {
    if (depth > 500) throw new Error("too deep");
    if (typeof v === "string") return scrub(v);
    if (!v || typeof v !== "object") return v;
    if (Object.prototype.toString.call(v) === "[object Array]") { for (var i = 0; i < v.length; i++) v[i] = scrubDeep(v[i], depth + 1); return v; }
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k) && !(depth < 2 && IDS[k])) v[k] = scrubDeep(v[k], depth + 1);
    return v;
  }
  // The last check before anything is sent, for every event (recordings
  // included): scrubbed, or dropped if scrubbing fails. Never sent as it was.
  function beforeSend(ev) {
    try {
      remember();
      if (!seenVer) return ev;
      if (ev && ev.properties) ev.properties = scrubDeep(ev.properties, 0);
      if (ev && ev.$set) ev.$set = scrubDeep(ev.$set, 0);
      if (ev && ev.$set_once) ev.$set_once = scrubDeep(ev.$set_once, 0);
      return ev;
    } catch (e) { return null; }
  }
  // The page's own address only, for the replay's page marker: no query
  // string but which door opened the plan screen, no #hash. Every network
  // request a recording might list is dropped.
  var DOOR = /^(setup|first|from)=[A-Za-z0-9_-]{0,40}$/;
  function pageOnly(req) {
    try {
      var n = 0; for (var k in req) if (Object.prototype.hasOwnProperty.call(req, k)) n++;
      if (n !== 1 || typeof req.name !== "string") return null;
      var u = req.name.split("#")[0], q = u.indexOf("?"), keepQ = [];
      if (q >= 0) {
        var parts = u.slice(q + 1).split("&");
        for (var i = 0; i < parts.length; i++) if (DOOR.test(parts[i])) keepQ.push(parts[i]);
        u = u.slice(0, q);
      }
      return { name: u + (keepQ.length ? "?" + keepQ.join("&") : "") };
    } catch (e) { return null; }
  }
  // Only the words a person reads in an attribute go through the scrubber
  // (classes, styles and picture addresses are left alone).
  var WORDY = /^(aria-|data-|title$|alt$|placeholder$|value$|label$|content$)/i;

  window.posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,                 // never record raw clicks/inputs
    capture_pageview: !NATIVE,          // web funnel only; the shell sends events, not URLs
    capture_pageleave: false,
    // Off at the start everywhere; only SonaAnalytics.replay(true), on a
    // REPLAY page, ever turns it on (see REPLAY above).
    disable_session_recording: true,
    enable_heatmaps: false,
    capture_heatmaps: false,
    rageclick: false,
    capture_dead_clicks: false,         // it would send the tapped element's words
    capture_exceptions: false,          // an error message can quote the page
    capture_performance: false,         // no page or network timings
    enable_recording_console_log: false,
    disable_surveys: true,              // nothing pops up over a child's screen
    before_send: beforeSend,
    // Each of these is the client's word, which PostHog's project settings
    // cannot loosen (checked against posthog-js 1.438.12, REPLAY1).
    session_recording: {
      compress_events: false,           // so beforeSend can read every word before it goes
      maskAllInputs: true,
      maskInputOptions: { color: true, date: true, "datetime-local": true, email: true, month: true, number: true, range: true, search: true, tel: true, text: true, time: true, url: true, week: true, textarea: true, select: true, password: true },
      maskInputFn: function () { return "[typed]"; },
      // every box is an empty shape: no value, no keystrokes, no length
      blockSelector: "input, textarea, select, [contenteditable]",
      maskTextSelector: "*",
      maskTextFn: function (text) { remember(); return scrub(text); },
      maskAllElementAttributes: false,
      maskAttributeFn: function (name, value) { return WORDY.test(name) ? scrub(value) : value; },
      maskCapturedNetworkRequestFn: pageOnly,
      recordHeaders: false,
      recordBody: false,
      captureCanvas: { recordCanvas: false },
      slimDOMOptions: { comment: true, script: true },
    },
    person_profiles: "identified_only",
    loaded: function (ph) {
      // identity = the anonymous family id — never a name or email
      try { if (window.Sona && window.Sona.fid) ph.identify(window.Sona.fid()); } catch (e) {}
    },
  });

  var replaying = false;
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
    // the scrubber itself, for the tests (replaytest) and nothing else
    redact: function (text) { remember(); return scrub(String(text)); },
    // replay(true) records from now on, replay(false) stops (what was
    // already recorded is sent, scrubbed). Nothing on a page outside REPLAY.
    // A recording also needs "Record user sessions" on in PostHog.
    replay: function (on) {
      if (!REPLAY_PAGE) return;
      on = !!on;
      if (on === replaying) return;
      replaying = on;
      try { remember(); if (on) window.posthog.startSessionRecording(); else window.posthog.stopSessionRecording(); } catch (e) {}
    },
  };
  if (REPLAY_AUTO) window.SonaAnalytics.replay(true);
})();
