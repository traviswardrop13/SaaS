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
 * hand-off) and the plan screen's offer when a grown-up opened it (from
 * setup or after the first practice run). On those, the child's name is
 * recorded as "[child]" where the page shows it, a piece of recording that
 * would still hold any child's name or parent's email this phone knows is
 * not sent at all, every box a grown-up types in is an empty shape, and
 * setup's speech therapy question and its ready screen (which repeats the
 * answer) are never in a recording.
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

  // WHERE WE ARE (REPLAY1). On speaksona.com itself (the app loads the same
  // site) PostHog's code comes from this site, pinned to the one version
  // tests/replaytest.mjs plays (public/vendor/posthog/static/<version>/):
  // what records a parent's setup is exactly what was checked, and no other
  // PostHog extension (surveys, toolbar, logs…) can load, since this site
  // serves only these two files. Anywhere else (a preview build, a test
  // server) it is PostHog's own latest copy, and nothing is ever recorded.
  var HERE = window.location || {};
  var ON_SITE = HERE.hostname === "speaksona.com" || HERE.hostname === "www.speaksona.com";
  var PATH = HERE.pathname || "";
  var PH_VERSION = "1.438.12", PH_SELF = "/vendor/posthog";
  var PH_SRC = ON_SITE ? PH_SELF + "/static/" + PH_VERSION + "/array.js" : "https://us-assets.i.posthog.com/static/array.js";

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
          (p.src = PH_SRC),
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
  //     and only when a grown-up opened it (?setup=1, ?first=1): never for a
  //     child's tap on a locked game, Home's own offer, or Settings.
  // Recording starts as OFF at init everywhere and is only ever switched on
  // by an explicit call, so a page that forgets to call records nothing.
  var AUTO_PATHS = { "/": 1, "/parents.html": 1, "/try": 1, "/try.html": 1 };
  var REPLAY_AUTO = ON_SITE && !NATIVE && !window.__sonaFamilyRedirect && AUTO_PATHS[PATH] === 1;
  var REPLAY_PAGE = REPLAY_AUTO || (ON_SITE && ((PATH === "/onboarding.html" && !/[?&]slp=/.test(HERE.search || "")) || PATH === "/subscribe.html"));

  // WHAT A RECORDING MAY NEVER CARRY: any child's name or grown-up's email
  // this phone knows (the profiles, the kids list and setup's draft, in
  // localStorage; nothing is forgotten while the page is open, so a name
  // changed on Back still counts). Two locks, no word swapping:
  //   1. Where a page shows the name, it sits in an element of class
  //      "ph-name", whose words the recorder writes as "[child]" whatever
  //      they are (maskTextFn below), so neither the name nor its length
  //      is recorded.
  //   2. Before a piece of recording is sent, every word in it a person
  //      could read (text, and the attributes in READ_ATTR) is checked for
  //      any of those names, as a whole word, and those addresses. A piece
  //      that holds one is not sent at all. Replacing the name there instead
  //      would tell it: "Will" taken out of "Echo will listen", or "max"
  //      out of "max-width", reads straight back.
  // Ordinary events are never touched: track() already lets only fixed
  // codes through, and PostHog's own fields stay as PostHog wrote them.
  var KEEP_KEYS = { childName: "n", name: "n", email: "m", parentEmail: "m" };
  var seen = { n: {}, m: {} }, seenVer = 0, rawSeen = {}, finders = null, findVer = -1;
  function keep(kind, v) {
    v = typeof v === "string" ? v.replace(/^\s+|\s+$/g, "") : "";
    if (!v || v.length > 200) return;
    var k = v.toLowerCase();
    if (k === "child" || k === "email") return;   // the placeholder's own word
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
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&"); }
  // a name counts only as a whole word: not inside a longer word, and not
  // glued to a hyphen or underscore ("max" is not in "max-width")
  var LETTER = "A-Za-z0-9_\\-\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF\\u1E00-\\u1EFF";
  function buildFinders() {
    if (findVer === seenVer && finders) return finders;
    var out = [], k;
    for (k in seen.m) if (Object.prototype.hasOwnProperty.call(seen.m, k)) out.push(new RegExp(reEsc(seen.m[k]), "i"));
    for (k in seen.n) if (Object.prototype.hasOwnProperty.call(seen.n, k)) out.push(new RegExp("(^|[^" + LETTER + "])" + reEsc(seen.n[k]) + "(?![" + LETTER + "])", "i"));
    findVer = seenVer; finders = out;
    return out;
  }
  function holds(s) {
    if (typeof s !== "string" || !s) return false;
    var list = buildFinders();
    for (var i = 0; i < list.length; i++) if (list[i].test(s)) return true;
    return false;
  }
  // The words a person reads. Classes, styles, ids, SVG shapes, tag names and
  // stylesheets are the page's own code, never a name, and are not read.
  var READ_ATTR = /^(aria-|data-|title$|alt$|placeholder$|value$|label$|content$|href$|src$|srcset$|name$|for$)/i;
  var STYLE_SOURCES = { 8: 1, 13: 1, 15: 1 };   // rrweb: stylesheet rule, style declaration, adopted stylesheet
  function attrsHold(map) {
    for (var a in map) if (Object.prototype.hasOwnProperty.call(map, a) && typeof map[a] === "string" && READ_ATTR.test(a) && holds(map[a])) return true;
    return false;
  }
  function carries(v, key, parent, depth) {
    if (depth > 500) return true;                  // too deep to read is not sent
    if (typeof v === "string") {
      if (key === "tagName" || key === "_cssText" || key === "rule" || key === "cssText") return false;
      if (key === "textContent" && parent && parent.isStyle) return false;
      return holds(v);
    }
    if (!v || typeof v !== "object") return false;
    if (v.type === 3 && v.data && STYLE_SOURCES[v.data.source]) return false;
    var i;
    if (Object.prototype.toString.call(v) === "[object Array]") {
      for (i = 0; i < v.length; i++) if (carries(v[i], key, v, depth + 1)) return true;
      return false;
    }
    for (i in v) {
      if (!Object.prototype.hasOwnProperty.call(v, i)) continue;
      if (i === "attributes" && v[i] && typeof v[i] === "object" && Object.prototype.toString.call(v[i]) !== "[object Array]") { if (attrsHold(v[i])) return true; continue; }
      if (carries(v[i], i, v, depth + 1)) return true;
    }
    return false;
  }
  // Only recordings are checked; a piece that holds a name or an address,
  // or that cannot be checked, is dropped. Never sent as it was.
  function beforeSend(ev) {
    if (!ev || ev.event !== "$snapshot") return ev;
    try {
      remember();
      if (!seenVer) return ev;
      return carries(ev.properties && ev.properties.$snapshot_data, "", null, 0) ? null : ev;
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
    // On speaksona.com the recorder loads from this site too (see WHERE WE ARE)
    asset_host: ON_SITE ? HERE.protocol + "//" + HERE.host + PH_SELF : undefined,
    // Each of these is the client's word, which PostHog's project settings
    // cannot loosen (checked against posthog-js 1.438.12, REPLAY1).
    session_recording: {
      compress_events: false,           // so beforeSend can read every word before it goes
      maskAllInputs: true,
      maskInputOptions: { color: true, date: true, "datetime-local": true, email: true, month: true, number: true, range: true, search: true, tel: true, text: true, time: true, url: true, week: true, textarea: true, select: true, password: true },
      maskInputFn: function () { return "[typed]"; },
      // every box is an empty shape: no value, no keystrokes, no length
      blockSelector: "input, textarea, select, [contenteditable]",
      // a ph-name element's words are recorded as "[child]", whatever they are
      maskTextSelector: ".ph-name",
      maskTextFn: function () { return "[child]"; },
      maskAllElementAttributes: false,  // the check before sending reads the attributes people read
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
    // would a recording holding this be dropped? For the tests (replaytest) only
    holdsName: function (text) { remember(); return holds(String(text)); },
    // replay(true) records from now on, replay(false) stops (what was
    // already recorded is sent, after the check). Nothing outside REPLAY.
    // A recording also needs "Record user sessions" on in PostHog.
    replay: function (on) {
      if (!REPLAY_PAGE) return;
      on = !!on;
      // once setup has handed the phone to the child, never again in this
      // tab (onboarding.html writes it at the hand-off); unreadable is "no"
      if (on) { try { if (window.sessionStorage.getItem("sona.replayoff.v1")) return; } catch (e) { return; } }
      if (on === replaying) return;
      replaying = on;
      try { remember(); if (on) window.posthog.startSessionRecording(); else window.posthog.stopSessionRecording(); } catch (e) {}
    },
  };
  if (REPLAY_AUTO) window.SonaAnalytics.replay(true);
})();
