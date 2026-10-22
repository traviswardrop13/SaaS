/* Tiny shared state for the Sona parent prototype — localStorage only (no backend yet).
   Used by home.html, lesson.html, customize.html, progress.html and settings.html. */
(function (global) {
  const PKEY = "sona.profile.v1", GKEY = "sona.progress.v1";
  const ALL_SOUNDS = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"];
  // ── PLAY1: the play door ────────────────────────────────────────────────
  // Most kids don't need speech help — they're just acquiring sounds (the
  // 3-year-old who loves the games). Play mode skips the "which sounds are we
  // fixing" framing entirely: the rotation walks EVERY sound in developmental
  // acquisition order (early stops/nasals → middle → the late-8), so the
  // easiest wins come first and R — the hardest — comes last. Same games,
  // same engine, same honesty; only the framing and the sound list differ.
  const PLAY_ORDER = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "CH", "J", "S", "Z", "SH", "L", "TH", "THV", "R"];
  function playMode() { try { return getProfile().mode === "play"; } catch (e) { return false; } }
  // Friendly labels for the sound pickers (most are just the letter; voiced TH needs marking).
  const SOUND_LABELS = { THV: "TH (v)" };
  // Wrap server PCM without altering its leveled samples. Media playback uses
  // the same iPhone output path as Rachel's recordings, rather than Web Audio.
  function pcmWave(bytes) {
    var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var h = new ArrayBuffer(44), v = new DataView(h);
    function tag(at, text) { for(var i=0;i<text.length;i++)v.setUint8(at+i,text.charCodeAt(i)); }
    tag(0,"RIFF");v.setUint32(4,36+data.byteLength,true);tag(8,"WAVE");tag(12,"fmt ");
    v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,24000,true);v.setUint32(28,48000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
    tag(36,"data");v.setUint32(40,data.byteLength,true);
    return new Blob([h,data],{type:"audio/wav"});
  }
  // ECHO'S VOICE IS MEDIA IN THE IPHONE APP (1 Oct 2026: "Sounds not working
  // again on books", with the phone-call volume slider on screen). The pages
  // that listen used to play the voice through Web Audio. An iPhone keeps a
  // page that just had the mic open in its call audio while Web Audio plays
  // into it, so the voice came out quiet and the volume buttons moved CALL
  // volume; and Web Audio alone is silenced by the ring/silent switch. A media
  // element plays the same bytes the way Rachel's recordings do. The browser
  // keeps Web Audio, where a tap unlocks it and an <audio> started later would
  // be refused. Returns { done, stop }: done settles "ended", "failed" (never
  // started: the caller falls back to the browser voice) or "stopped".
  // THE SILENT SWITCH (15 Oct 2026, Travis: "Everything off"): left to
  // itself WebKit plays a media element as Playback, which ignores the switch.
  // In an app build with Sona's own mic the page sets the audio session to
  // "transient-solo" instead, so on a silenced phone this voice, the chimes
  // and every other sound are silent: a child hears no Echo and no sound to
  // copy until a grown-up flips the switch. An App Store build without that
  // mic plays through the switch as before (THE SILENT SWITCH, in the native
  // mic block, says why and where).
  function voiceAsMedia() { return isNativeApp(); }
  function mediaPCM(bytes, opts) {
    opts = opts || {};
    var url = null, a = null, over = false, started = false, timer = 0, settle;
    var done = new Promise(function (r) { settle = r; });
    function finish(how) {
      if (over) return; over = true; clearTimeout(timer);
      try { if (a) { a.onended = null; a.onerror = null; a.onplaying = null; a.pause(); a.removeAttribute("src"); a.load(); } } catch (e) {}
      try { if (url) URL.revokeObjectURL(url); } catch (e) {}
      settle(how);
    }
    try {
      var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), rate = Number(opts.rate) || 1;
      if (!data.byteLength) { finish("failed"); return { done: done, stop: function () {} }; }
      // a line's own length plus a beat ends it if "ended" never comes
      var ms = Math.ceil(data.byteLength / 48 / rate) + 1500;
      url = URL.createObjectURL(pcmWave(data)); a = new Audio(url);
      var v = Number(opts.volume == null ? 0.8 : opts.volume);
      try { a.volume = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8; } catch (e) {}
      if (rate !== 1) { try { a.playbackRate = rate; a.preservesPitch = a.webkitPreservesPitch = a.mozPreservesPitch = false; } catch (e) {} }
      function go() { if (started || over) return; started = true; clearTimeout(timer); timer = setTimeout(function () { finish("ended"); }, ms); }
      a.onplaying = go;
      a.onended = function () { finish("ended"); };
      a.onerror = function () { finish(started ? "ended" : "failed"); };
      // an element that never starts must not hold the page's quiet forever
      timer = setTimeout(function () { finish(started ? "ended" : "failed"); }, 4000);
      var p = a.play();
      if (p && p.then) p.then(go, function () { finish(started ? "ended" : "failed"); }); else go();
    } catch (e) { finish("failed"); }
    return { done: done, stop: function () { finish("stopped"); } };
  }
  function soundLabel(s) { return SOUND_LABELS[s] || s; }
  // Approximate developmental norms: the age (in years) by which most children
  // typically produce the sound. Used to show "usually by age X" and gently flag
  // a too-early target. Approximate consensus values that vary by reference — an
  // SLP should always use clinical judgment.
  const SOUND_NORM = { P: 3, B: 3, M: 3, N: 4, T: 4, D: 4, K: 4, G: 4, F: 4, V: 6, S: 5, Z: 6, SH: 6, CH: 6, J: 6, L: 6, R: 7, TH: 6, THV: 7 };
  function soundNorm(s) { return SOUND_NORM[String(s || "").toUpperCase()] || null; }

  // --- fun world layer: who the child plays as + where ---
  // Only Leo is unlocked today; the rest are "coming soon" placeholders so the
  // chooser already looks like a real Duolingo-style roster. Swap emoji for art
  // (e.g. /coach/echo/echo-idle.svg) once the separated character poses arrive.
  // The buddy cast — 8 original sticker characters (design handoff, section 06).
  // `svg` is the circular sticker (120 viewBox); `emoji` stays as the canvas-game
  // fallback until each game draws the sticker sprite directly. `source` and
  // `cost` are the Buddy Shop's (SHOP1, 11 Oct 2026; see OUTFITS just below).
  // A new buddy is appended, never inserted (item 0 is byId's fallback), and
  // only once its painted portrait is on disk.
  const CHARACTERS = [
    { id: 'fox', name: 'Pip', emoji: '🦊', svg: '<svg viewBox="0 0 120 120"><clipPath id="bFox"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#ffe29a"></circle><g clip-path="url(#bFox)"><path d="M30 32l16 18-22 6Z" fill="#ff8a3d"></path><path d="M90 32l-16 18 22 6Z" fill="#ff8a3d"></path><path d="M34 38l9 10-12 3.5Z" fill="#e5672a"></path><path d="M86 38l-9 10 12 3.5Z" fill="#e5672a"></path><circle cx="60" cy="72" r="28" fill="#ff8a3d"></circle><ellipse cx="60" cy="83" rx="14" ry="10" fill="#fff"></ellipse><ellipse cx="49" cy="66" rx="6" ry="7" fill="#fff"></ellipse><circle cx="50" cy="67" r="3" fill="#3d2a1a"></circle><ellipse cx="71" cy="66" rx="6" ry="7" fill="#fff"></ellipse><circle cx="70" cy="67" r="3" fill="#3d2a1a"></circle><circle cx="60" cy="79" r="3.5" fill="#3d2a1a"></circle><circle cx="41" cy="78" r="4" fill="#ffb98a"></circle><circle cx="79" cy="78" r="4" fill="#ffb98a"></circle></g></svg>', locked: false, source: 'starter', cost: null },
    { id: 'bunny', name: 'Miso', emoji: '🐰', svg: '<svg viewBox="0 0 120 120"><clipPath id="bBun"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#cdefff"></circle><g clip-path="url(#bBun)"><ellipse cx="47" cy="30" rx="9" ry="22" fill="#f7f3ee" transform="rotate(-8 47 30)"></ellipse><ellipse cx="73" cy="30" rx="9" ry="22" fill="#f7f3ee" transform="rotate(8 73 30)"></ellipse><ellipse cx="47" cy="33" rx="4.5" ry="14" fill="#ffb9c8" transform="rotate(-8 47 33)"></ellipse><ellipse cx="73" cy="33" rx="4.5" ry="14" fill="#ffb9c8" transform="rotate(8 73 33)"></ellipse><circle cx="60" cy="74" r="27" fill="#f7f3ee"></circle><ellipse cx="49" cy="68" rx="6" ry="7" fill="#fff" stroke="#e8ddd2" stroke-width="1"></ellipse><circle cx="50" cy="69" r="3" fill="#3d2a1a"></circle><ellipse cx="71" cy="68" rx="6" ry="7" fill="#fff" stroke="#e8ddd2" stroke-width="1"></ellipse><circle cx="70" cy="69" r="3" fill="#3d2a1a"></circle><path d="M57 78h6l-3 4Z" fill="#ff8fa3"></path><rect x="55" y="84" width="10" height="8" rx="2.5" fill="#fff" stroke="#e8ddd2" stroke-width="1"></rect><line x1="60" y1="84" x2="60" y2="92" stroke="#e8ddd2" stroke-width="1.5"></line><circle cx="41" cy="80" r="4.5" fill="#ffd6c9"></circle><circle cx="79" cy="80" r="4.5" fill="#ffd6c9"></circle></g></svg>', locked: false, source: 'starter', cost: null },
    { id: 'dragon', name: 'Ziggy', emoji: '🐲', svg: '<svg viewBox="0 0 120 120"><clipPath id="bDrg"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#ffd9e8"></circle><g clip-path="url(#bDrg)"><path d="M44 38l-6-16 13 10Z" fill="#ffe9c9"></path><path d="M76 38l6-16-13 10Z" fill="#ffe9c9"></path><path d="M52 34l4-9 4 9Z" fill="#3cae7d"></path><path d="M62 33l4-9 4 9Z" fill="#3cae7d"></path><circle cx="60" cy="72" r="28" fill="#63d6a3"></circle><ellipse cx="60" cy="84" rx="15" ry="10" fill="#a5ecc9"></ellipse><circle cx="55" cy="82" r="2" fill="#2e8f68"></circle><circle cx="65" cy="82" r="2" fill="#2e8f68"></circle><ellipse cx="48" cy="64" rx="6" ry="7" fill="#fff"></ellipse><circle cx="49" cy="65" r="3" fill="#2b2a4a"></circle><ellipse cx="72" cy="64" rx="6" ry="7" fill="#fff"></ellipse><circle cx="71" cy="65" r="3" fill="#2b2a4a"></circle><path d="M50 92q10 6 20 0" stroke="#2e8f68" stroke-width="3.5" fill="none" stroke-linecap="round"></path></g></svg>', locked: false, source: 'shop', cost: 150 },
    { id: 'cat', name: 'Mochi', emoji: '🐱', svg: '<svg viewBox="0 0 120 120"><clipPath id="bCat"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#e5dcff"></circle><g clip-path="url(#bCat)"><path d="M36 32l14 14-19 7Z" fill="#ff9d7a"></path><path d="M84 32l-14 14 19 7Z" fill="#ff9d7a"></path><path d="M40 38l7 8-10 3.5Z" fill="#ffc9b3"></path><path d="M80 38l-7 8 10 3.5Z" fill="#ffc9b3"></path><circle cx="60" cy="72" r="27" fill="#ff9d7a"></circle><ellipse cx="60" cy="83" rx="13" ry="9" fill="#fff"></ellipse><ellipse cx="49" cy="66" rx="6" ry="7" fill="#fff"></ellipse><circle cx="50" cy="67" r="3" fill="#3d2a1a"></circle><ellipse cx="71" cy="66" rx="6" ry="7" fill="#fff"></ellipse><circle cx="70" cy="67" r="3" fill="#3d2a1a"></circle><path d="M57 78h6l-3 4Z" fill="#ff6b8a"></path><path d="M54 86q6 4 12 0" stroke="#e5764f" stroke-width="2.5" fill="none" stroke-linecap="round"></path><line x1="28" y1="76" x2="40" y2="78" stroke="#e5764f" stroke-width="2" stroke-linecap="round"></line><line x1="28" y1="84" x2="40" y2="83" stroke="#e5764f" stroke-width="2" stroke-linecap="round"></line><line x1="92" y1="76" x2="80" y2="78" stroke="#e5764f" stroke-width="2" stroke-linecap="round"></line><line x1="92" y1="84" x2="80" y2="83" stroke="#e5764f" stroke-width="2" stroke-linecap="round"></line></g></svg>', locked: false, source: 'shop', cost: 100 },
    { id: 'bee', name: 'Buzz', emoji: '🐝', svg: '<svg viewBox="0 0 120 120"><clipPath id="bBee"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#dff5c2"></circle><g clip-path="url(#bBee)"><line x1="48" y1="38" x2="42" y2="24" stroke="#3d3d3d" stroke-width="3" stroke-linecap="round"></line><line x1="72" y1="38" x2="78" y2="24" stroke="#3d3d3d" stroke-width="3" stroke-linecap="round"></line><circle cx="42" cy="22" r="4.5" fill="#3d3d3d"></circle><circle cx="78" cy="22" r="4.5" fill="#3d3d3d"></circle><ellipse cx="26" cy="58" rx="14" ry="9" fill="#fff" opacity=".85" transform="rotate(-24 26 58)"></ellipse><ellipse cx="94" cy="58" rx="14" ry="9" fill="#fff" opacity=".85" transform="rotate(24 94 58)"></ellipse><clipPath id="bBeeB"><circle cx="60" cy="70" r="27"></circle></clipPath><circle cx="60" cy="70" r="27" fill="#ffd43b"></circle><g clip-path="url(#bBeeB)"><rect x="30" y="78" width="60" height="9" fill="#3d3d3d"></rect><rect x="30" y="92" width="60" height="9" fill="#3d3d3d"></rect></g><ellipse cx="49" cy="62" rx="6" ry="7" fill="#fff" stroke="#e8c86a" stroke-width="1"></ellipse><circle cx="50" cy="63" r="3" fill="#2b2a4a"></circle><ellipse cx="71" cy="62" rx="6" ry="7" fill="#fff" stroke="#e8c86a" stroke-width="1"></ellipse><circle cx="70" cy="63" r="3" fill="#2b2a4a"></circle><path d="M53 71q7 5 14 0" stroke="#3d3d3d" stroke-width="3" fill="none" stroke-linecap="round"></path></g></svg>', locked: false, source: 'shop', cost: 100 },
    { id: 'octopus', name: 'Otto', emoji: '🐙', svg: '<svg viewBox="0 0 120 120"><clipPath id="bOct"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#ffe9c9"></circle><g clip-path="url(#bOct)"><circle cx="60" cy="64" r="28" fill="#a86ee3"></circle><circle cx="38" cy="92" r="9" fill="#a86ee3"></circle><circle cx="53" cy="97" r="9" fill="#a86ee3"></circle><circle cx="68" cy="97" r="9" fill="#a86ee3"></circle><circle cx="83" cy="92" r="9" fill="#a86ee3"></circle><circle cx="38" cy="90" r="3" fill="#c79bf0"></circle><circle cx="53" cy="95" r="3" fill="#c79bf0"></circle><circle cx="68" cy="95" r="3" fill="#c79bf0"></circle><circle cx="83" cy="90" r="3" fill="#c79bf0"></circle><ellipse cx="49" cy="58" rx="6.5" ry="7.5" fill="#fff"></ellipse><circle cx="50" cy="59" r="3.2" fill="#2b2a4a"></circle><ellipse cx="71" cy="58" rx="6.5" ry="7.5" fill="#fff"></ellipse><circle cx="70" cy="59" r="3.2" fill="#2b2a4a"></circle><ellipse cx="60" cy="72" rx="7" ry="5.5" fill="#5c3494"></ellipse><ellipse cx="60" cy="74.5" rx="4" ry="2.5" fill="#ff8fa3"></ellipse><circle cx="41" cy="68" r="4.5" fill="#c79bf0"></circle><circle cx="79" cy="68" r="4.5" fill="#c79bf0"></circle></g></svg>', locked: false, source: 'shop', cost: 150 },
    { id: 'dino', name: 'Rocky', emoji: '🦖', svg: '<svg viewBox="0 0 120 120"><clipPath id="bDin"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#d6f0ff"></circle><g clip-path="url(#bDin)"><path d="M42 36l5-12 5 12Z" fill="#ffe9c9"></path><path d="M55 32l5-12 5 12Z" fill="#ffe9c9"></path><path d="M68 36l5-12 5 12Z" fill="#ffe9c9"></path><circle cx="60" cy="72" r="28" fill="#4dc6b8"></circle><ellipse cx="60" cy="85" rx="16" ry="11" fill="#a8e8e0"></ellipse><circle cx="54" cy="83" r="2.2" fill="#2e8f83"></circle><circle cx="66" cy="83" r="2.2" fill="#2e8f83"></circle><ellipse cx="48" cy="63" rx="6" ry="7" fill="#fff"></ellipse><circle cx="49" cy="64" r="3" fill="#2b2a4a"></circle><ellipse cx="72" cy="63" rx="6" ry="7" fill="#fff"></ellipse><circle cx="71" cy="64" r="3" fill="#2b2a4a"></circle><path d="M50 93q10 7 20 0" stroke="#2e8f83" stroke-width="3.5" fill="none" stroke-linecap="round"></path><path d="M55 94l3 4 3-4Z" fill="#fff"></path></g></svg>', locked: false, source: 'shop', cost: 120 },
    { id: 'panda', name: 'Bao', emoji: '🐼', svg: '<svg viewBox="0 0 120 120"><clipPath id="bPan"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#ffdf9e"></circle><g clip-path="url(#bPan)"><circle cx="38" cy="42" r="11" fill="#3d3d3d"></circle><circle cx="82" cy="42" r="11" fill="#3d3d3d"></circle><circle cx="60" cy="72" r="28" fill="#fff"></circle><ellipse cx="47" cy="64" rx="9" ry="11" fill="#3d3d3d" transform="rotate(-14 47 64)"></ellipse><ellipse cx="73" cy="64" rx="9" ry="11" fill="#3d3d3d" transform="rotate(14 73 64)"></ellipse><circle cx="48" cy="64" r="3.6" fill="#fff"></circle><circle cx="49" cy="65" r="2" fill="#2b2a4a"></circle><circle cx="72" cy="64" r="3.6" fill="#fff"></circle><circle cx="71" cy="65" r="2" fill="#2b2a4a"></circle><ellipse cx="60" cy="79" rx="4" ry="3" fill="#3d3d3d"></ellipse><path d="M54 87q6 4 12 0" stroke="#3d3d3d" stroke-width="3" fill="none" stroke-linecap="round"></path><circle cx="40" cy="80" r="4.5" fill="#ffd6c9"></circle><circle cx="80" cy="80" r="4.5" fill="#ffd6c9"></circle></g></svg>', locked: false, source: 'starter', cost: null },
    // The Trophy Road's own four (11 Oct 2026): painted, no sticker
    // svg (buddyMarkup shows the emoji; the painted badge sits over it).
    // Never Bo (the bear in goal) or Robot (Robot Builder): taken names.
    { id: 'frog', name: 'Hops', emoji: '🐸', svg: '', portrait: "/assets/crafted/buddy-frog-v2.webp", locked: false, source: 'road', cost: null },
    { id: 'penguin', name: 'Pebble', emoji: '🐧', svg: '', portrait: "/assets/crafted/buddy-penguin-v2.webp", locked: false, source: 'road', cost: null },
    { id: 'lion', name: 'Sunny', emoji: '🦁', svg: '', portrait: "/assets/crafted/buddy-lion-v2.webp", locked: false, source: 'road', cost: null },
    { id: 'unicorn', name: 'Luna', emoji: '🦄', svg: '', portrait: "/assets/crafted/buddy-unicorn-v2.webp", locked: false, source: 'road', cost: null },
  ];
  // Hats and places. `source` is how a family that set up after the Buddy
  // Shop (11 Oct 2026, SHOP1) gets each one: "starter" (theirs from the
  // start), "shop" (for `cost` coins) or "road" (a Trophy Road stop gives it);
  // a household already on Sona kept everything it could pick that day
  // (LEGACY_SET, the OWN1 sweep). An entry joins only with its painted art.
  // `art` is a hat's painted picture (11 Oct 2026): the shop shows it where the
  // page's drawn hat used to be, and a new hat joins only with its picture.
  const OUTFITS = [
    { id: "none",   name: "None",   emoji: "",   source: "starter", cost: null },
    { id: "crown",  name: "Crown",  emoji: "👑", source: "shop", cost: 80, art: "/assets/crafted/hat-crown.webp" },
    { id: "tophat", name: "Top hat",emoji: "🎩", source: "shop", cost: 60, art: "/assets/crafted/hat-tophat.webp" },
    { id: "cap",    name: "Cap",    emoji: "🧢", source: "shop", cost: 40, art: "/assets/crafted/hat-cap.webp" },
    { id: "shades", name: "Cool",   emoji: "🕶️", source: "shop", cost: 60, art: "/assets/crafted/hat-shades.webp" },
    { id: "bow",    name: "Bow",    emoji: "🎀", source: "shop", cost: 40, art: "/assets/crafted/hat-bow.webp" },
    { id: "party",  name: "Party",  emoji: "🥳", source: "shop", cost: 80, art: "/assets/crafted/hat-party.webp" },
    { id: "flowercrown", name: "Flower crown", emoji: "🌸", source: "shop", cost: 150, art: "/assets/crafted/hat-flowercrown.webp" },
    { id: "sunhat",     name: "Sun hat",    emoji: "👒", source: "road", cost: null, art: "/assets/crafted/hat-sunhat.webp" },
    { id: "starclip",   name: "Star clip",  emoji: "⭐", source: "road", cost: null, art: "/assets/crafted/hat-starclip.webp" },
    { id: "headphones", name: "Headphones", emoji: "🎧", source: "road", cost: null, art: "/assets/crafted/hat-headphones.webp" },
  ];
  const BACKDROPS = [
    { id: "sky",      name: "Sky",       source: "starter", cost: null, css: "linear-gradient(180deg,#bfe3ff,#eaf3ff)", scene: ["☁️", "🌤️", "☁️"] },
    { id: "jungle",   name: "Jungle",    source: "shop", cost: 80,  css: "linear-gradient(180deg,#bdf0c8,#e7fbe9)", scene: ["🌴", "🌿", "🦜"] },
    { id: "forest",   name: "Forest",    source: "shop", cost: 80,  css: "linear-gradient(180deg,#cbe8c0,#eef7e6)", scene: ["🌲", "🍄", "🐿️"] },
    { id: "mountain", name: "Mountains", source: "shop", cost: 120, css: "linear-gradient(180deg,#d6e6ff,#f0f5ff)", scene: ["🏔️", "⛰️", "🌲"] },
    { id: "space",    name: "Space",     source: "shop", cost: 150, css: "linear-gradient(180deg,#cdd6ff,#eef1ff)", scene: ["🚀", "⭐", "🪐"] },
    { id: "beach",    name: "Beach",     source: "shop", cost: 120, css: "linear-gradient(180deg,#bfefff,#fff6e0)", scene: ["🏖️", "🌊", "🐚"] },
    { id: "candy",    name: "Candy land", source: "shop", cost: 250, css: "linear-gradient(180deg,#ffd9ec,#fff3f8)", scene: ["🍭", "🍬", "🧁"] },
    { id: "snow",     name: "Snow",      source: "road", cost: null, css: "linear-gradient(180deg,#d9ebff,#f7fbff)", scene: ["❄️", "⛄", "🌲"] },
    { id: "sea",      name: "Under the sea", source: "road", cost: null, css: "linear-gradient(180deg,#a9dcef,#e2f5fb)", scene: ["🐠", "🐚", "🌊"] },
  ];
  const byId = (list, id) => list.find((x) => x.id === id) || list[0];
  const characterById = (id) => byId(CHARACTERS, id);
  const outfitById = (id) => byId(OUTFITS, id);
  const backdropById = (id) => byId(BACKDROPS, id);
  // Render a buddy as art if it has an image, else fall back to its emoji.
  function buddyMarkup(id, px) {
    const c = characterById(id), s = px || 40;
    if (c.svg) return '<span style="display:inline-block;width:' + s + 'px;height:' + s + 'px;border-radius:50%;overflow:hidden;vertical-align:middle;">' + c.svg + '</span>';
    if (c.img) return '<img src="' + c.img + '" alt="' + c.name + '" style="width:' + s + 'px;height:' + s + 'px;object-fit:contain;display:inline-block;vertical-align:middle;" />';
    return '<span style="font-size:' + Math.round(s * 0.92) + 'px;line-height:1;">' + c.emoji + '</span>';
  }

  // ── BUDDY2: every painted picture of a buddy, by pose (11 Oct 2026) ──
  // Play as your buddy (Travis, 9 Oct 2026: "they actually BE the character in
  // the game"). A pose with no picture on disk is simply absent (no stand-in
  // art), and each game falls back in one order: its pose → that pose's
  // fallback pose → the portrait in a circle → the sticker SVG (xmlns added)
  // → a plain dot.
  // "run"   = seen from behind, running (Sound Sprint): [src, sx, sy, sw, sh] (a crop),
  //           or just [src] when the file is already cut to the 480x840 frame.
  // "rest"  = front, full body, standing calmly, like echo-welcome (512x512).
  // "cheer" = front, full body, arms up, like echo-cheer (512x512); falls back to rest.
  // "peek"  = head and paws over a ledge, bottom cut flat (Fruit Slice, 512x384).
  // "sit"   = sitting on Block Stacker's bench (512x512); falls back to rest.
  // "portrait" = the 288px round badge every screen uses.
  // The fox keeps its painted Fruit Slice counter and Block Stacker bench, so
  // it has no peek or sit. Each line is added by the art step that lands its
  // files; how each was drawn, cut and checked is design/crafted-world/buddies-v3.md.
  const BUDDY_ART = {
    fox:     { run: ["/assets/crafted/fox-runner.webp", 390, 205, 480, 840], rest: "/assets/crafted/buddy-fox-rest.webp", cheer: "/assets/crafted/buddy-fox-cheer.webp" },
    bunny:   { run: ["/assets/crafted/buddy-bunny-run.webp"], rest: "/assets/crafted/buddy-bunny-rest.webp", cheer: "/assets/crafted/buddy-bunny-cheer.webp", peek: "/assets/crafted/buddy-bunny-peek.webp", sit: "/assets/crafted/buddy-bunny-sit.webp" },
    dragon:  { run: ["/assets/crafted/buddy-dragon-run.webp"], rest: "/assets/crafted/buddy-dragon-rest.webp", cheer: "/assets/crafted/buddy-dragon-cheer.webp", peek: "/assets/crafted/buddy-dragon-peek.webp", sit: "/assets/crafted/buddy-dragon-sit.webp" },
    cat:     { run: ["/assets/crafted/buddy-cat-run.webp"], rest: "/assets/crafted/buddy-cat-rest.webp", cheer: "/assets/crafted/buddy-cat-cheer.webp", peek: "/assets/crafted/buddy-cat-peek.webp", sit: "/assets/crafted/buddy-cat-sit.webp" },
    bee:     { run: ["/assets/crafted/buddy-bee-run.webp"], rest: "/assets/crafted/buddy-bee-rest.webp", cheer: "/assets/crafted/buddy-bee-cheer.webp", peek: "/assets/crafted/buddy-bee-peek.webp", sit: "/assets/crafted/buddy-bee-sit.webp" },
    octopus: { run: ["/assets/crafted/buddy-octopus-run.webp"], rest: "/assets/crafted/buddy-octopus-rest.webp", cheer: "/assets/crafted/buddy-octopus-cheer.webp", peek: "/assets/crafted/buddy-octopus-peek.webp", sit: "/assets/crafted/buddy-octopus-sit.webp" },
    dino:    { run: ["/assets/crafted/buddy-dino-run.webp"], rest: "/assets/crafted/buddy-dino-rest.webp", cheer: "/assets/crafted/buddy-dino-cheer.webp", peek: "/assets/crafted/buddy-dino-peek.webp", sit: "/assets/crafted/buddy-dino-sit.webp" },
    panda:   { run: ["/assets/crafted/buddy-panda-run.webp"], rest: "/assets/crafted/buddy-panda-rest.webp", cheer: "/assets/crafted/buddy-panda-cheer.webp", peek: "/assets/crafted/buddy-panda-peek.webp", sit: "/assets/crafted/buddy-panda-sit.webp" },
    frog:    { run: ["/assets/crafted/buddy-frog-run.webp"], rest: "/assets/crafted/buddy-frog-rest.webp", cheer: "/assets/crafted/buddy-frog-cheer.webp", peek: "/assets/crafted/buddy-frog-peek.webp", sit: "/assets/crafted/buddy-frog-sit.webp" },
    penguin: { run: ["/assets/crafted/buddy-penguin-run.webp"], rest: "/assets/crafted/buddy-penguin-rest.webp", cheer: "/assets/crafted/buddy-penguin-cheer.webp", peek: "/assets/crafted/buddy-penguin-peek.webp", sit: "/assets/crafted/buddy-penguin-sit.webp" },
    lion:    { run: ["/assets/crafted/buddy-lion-run.webp"], rest: "/assets/crafted/buddy-lion-rest.webp", cheer: "/assets/crafted/buddy-lion-cheer.webp", peek: "/assets/crafted/buddy-lion-peek.webp", sit: "/assets/crafted/buddy-lion-sit.webp" },
    unicorn: { run: ["/assets/crafted/buddy-unicorn-run.webp"], rest: "/assets/crafted/buddy-unicorn-rest.webp", cheer: "/assets/crafted/buddy-unicorn-cheer.webp", peek: "/assets/crafted/buddy-unicorn-peek.webp", sit: "/assets/crafted/buddy-unicorn-sit.webp" },
  };
  const BUDDY_POSE_ORDER = { rest: ["rest"], cheer: ["cheer", "rest"], peek: ["peek"], sit: ["sit", "rest"] };
  // "leo" (an old pick) or anything unknown is the fox, as characterById says
  function buddyId() { try { return characterById(getProfile().character).id; } catch (e) { return "fox"; } }
  function buddySprite(id, pose) {
    const c = characterById(id), a = BUDDY_ART[c.id] || {};
    if (pose === "portrait") return c.portrait || ("/assets/crafted/buddy-" + c.id + "-v2.webp");
    if (pose === "run") { const r = a.run; return r ? { src: r[0], crop: r.length === 5 ? r.slice(1) : null } : null; }
    const order = BUDDY_POSE_ORDER[pose] || [];
    for (let i = 0; i < order.length; i++) if (a[order[i]]) return { src: a[order[i]], pose: order[i] };
    return null;
  }

  // ── Sound Town houses: shared art + per-sound color theme ──
  // Each entry: house wall + roof colors (with shaded variants) and the room
  // theme used inside the unit (wall tints + watermark color).
  const HOUSE_PALETTE = [
    { body: "#ff7a6e", bodyD: "#ef6557", roof: "#4db6ff", roofD: "#2f9be4", wallA: "#fff3ee", wallB: "#ffe4dc", wm: "rgba(77,182,255,.13)" },
    { body: "#ffd45e", bodyD: "#f4be38", roof: "#ff9446", roofD: "#ef7d2c", wallA: "#fff9e8", wallB: "#ffeecb", wm: "rgba(255,148,70,.13)" },
    { body: "#7dd470", bodyD: "#63bd57", roof: "#ff7fab", roofD: "#ef6595", wallA: "#f1fbea", wallB: "#e1f5d6", wm: "rgba(255,127,171,.13)" },
    { body: "#62bdff", bodyD: "#46a6ec", roof: "#ffd45e", roofD: "#f0bb33", wallA: "#eef8ff", wallB: "#dcf0ff", wm: "rgba(255,212,94,.17)" },
  ];
  // Illustrated house button art (3 building styles, rotating colors).
  function houseArt(i, letter) {
    const P = HOUSE_PALETTE[i % HOUSE_PALETTE.length];
    const B = P.body, BD = P.bodyD, R = P.roof, RD = P.roofD, v = i % 3;
    const badge = (cx, cy) =>
      '<circle cx="' + cx + '" cy="' + cy + '" r="20" fill="#fff"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="20" fill="none" stroke="' + R + '" stroke-width="5"/>' +
      '<text x="' + cx + '" y="' + (cy + 9) + '" text-anchor="middle" font-family="Baloo 2, Nunito, sans-serif" font-weight="800" font-size="26" fill="' + R + '">' + letter + '</text>';
    const win = (x, y, w, h) =>
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="7" fill="#fff"/>' +
      '<rect x="' + (x + 4) + '" y="' + (y + 4) + '" width="' + (w - 8) + '" height="' + (h - 8) + '" rx="4" fill="#bfe7ff"/>' +
      '<line x1="' + (x + w / 2) + '" y1="' + (y + 4) + '" x2="' + (x + w / 2) + '" y2="' + (y + h - 4) + '" stroke="#fff" stroke-width="3"/>' +
      '<rect x="' + (x - 3) + '" y="' + (y + h) + '" width="' + (w + 6) + '" height="7" rx="3.5" fill="#fff"/>';
    const shadow = '<ellipse cx="100" cy="181" rx="74" ry="8" fill="rgba(15,39,66,.12)"/>';
    if (v === 0) return '<svg viewBox="0 0 200 192">' + shadow +
      '<rect x="34" y="80" width="132" height="98" rx="12" fill="' + B + '"/>' +
      '<path d="M140 80 h14 a12 12 0 0 1 12 12 v74 a12 12 0 0 1 -12 12 h-14 z" fill="' + BD + '"/>' +
      '<rect x="138" y="34" width="17" height="34" rx="5" fill="' + RD + '"/>' +
      '<path d="M20 84 L100 22 L180 84 Z" fill="' + R + '"/>' +
      '<rect x="16" y="78" width="168" height="13" rx="6.5" fill="' + RD + '"/>' +
      win(46, 102, 34, 28) + win(120, 102, 34, 28) +
      '<rect x="86" y="120" width="28" height="58" rx="13" fill="#8a5a2e"/><rect x="90" y="126" width="20" height="52" rx="9" fill="#a97044"/><circle cx="108" cy="152" r="3" fill="#ffd33d"/>' +
      '<circle cx="42" cy="174" r="11" fill="#6ecb63"/><circle cx="57" cy="177" r="13" fill="#58b34f"/><circle cx="160" cy="176" r="11" fill="#6ecb63"/>' +
      badge(100, 56) + '</svg>';
    if (v === 1) return '<svg viewBox="0 0 200 192">' + shadow +
      '<rect x="56" y="56" width="88" height="122" rx="12" fill="' + B + '"/>' +
      '<path d="M120 56 h12 a12 12 0 0 1 12 12 v98 a12 12 0 0 1 -12 12 h-12 z" fill="' + BD + '"/>' +
      '<path d="M46 62 L100 14 L154 62 Z" fill="' + R + '"/>' +
      '<rect x="42" y="56" width="116" height="12" rx="6" fill="' + RD + '"/>' +
      '<line x1="100" y1="14" x2="100" y2="3" stroke="' + RD + '" stroke-width="4" stroke-linecap="round"/><path d="M100 2 h22 l-7 7 7 7 h-22 z" fill="' + RD + '"/>' +
      win(72, 78, 56, 24) + win(72, 112, 56, 24) +
      '<rect x="83" y="144" width="34" height="34" rx="10" fill="#8a5a2e"/><circle cx="110" cy="162" r="3" fill="#ffd33d"/>' +
      '<circle cx="64" cy="176" r="10" fill="#6ecb63"/>' +
      badge(100, 44) + '</svg>';
    return '<svg viewBox="0 0 200 192">' + shadow +
      '<rect x="30" y="74" width="140" height="104" rx="12" fill="' + B + '"/>' +
      '<path d="M144 74 h14 a12 12 0 0 1 12 12 v80 a12 12 0 0 1 -12 12 h-14 z" fill="' + BD + '"/>' +
      '<rect x="22" y="66" width="156" height="14" rx="7" fill="' + R + '"/>' +
      '<circle cx="38" cy="80" r="11" fill="#fff"/><circle cx="62" cy="80" r="11" fill="' + R + '"/><circle cx="86" cy="80" r="11" fill="#fff"/><circle cx="110" cy="80" r="11" fill="' + R + '"/><circle cx="134" cy="80" r="11" fill="#fff"/><circle cx="158" cy="80" r="11" fill="' + R + '"/>' +
      win(42, 104, 56, 36) +
      '<rect x="44" y="150" width="52" height="10" rx="5" fill="#8a5a2e"/><circle cx="52" cy="148" r="5" fill="#ff6b9a"/><circle cx="66" cy="146" r="5" fill="#ffd14a"/><circle cx="82" cy="148" r="5" fill="#ff6b9a"/>' +
      '<rect x="116" y="102" width="36" height="76" rx="10" fill="#8a5a2e"/><rect x="121" y="108" width="26" height="70" rx="8" fill="#a97044"/><circle cx="144" cy="142" r="3" fill="#ffd33d"/>' +
      badge(100, 52) + '</svg>';
  }

  const DEFAULT_PROFILE = { childName: "", childAge: "", focusSounds: ["R", "S", "L", "K"], voiceOn: true, coachName: "Coach", slpEvaluated: "", goals: "", focusArea: "articulation", interests: [], language: "en", character: "fox", outfit: "none", backdrop: "sky", soundOn: true, voiceId: "qBDvhofpxp92JgXJxDjB", volume: 0.8, musicOn: false, dailyMinutes: 5, owned: { outfits: ["none"], backdrops: ["sky"] }, onboarded: false };
  // stage per sound: 0 = isolation (the letter), 1 = syllables, 2 = words, 3 = mastered.
  const STAGES = ["isolation", "syllables", "words"];
  const DEFAULT_PROGRESS = { sessions: [], totals: { sessions: 0, words: 0, stars: 0, coins: 0 }, streak: { count: 0, lastDate: "" }, bySound: {}, stage: {}, chests: {}, missed: [] };

  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ── KIDS1: more than one child per device ──────────────────────────────
  // Siblings share a phone and an SLP shares one iPad across a caseload, so
  // every practice key has to belong to a CHILD, not to the device. All of it
  // funnels through load()/save(), so the namespace lives there and every page
  // inherits it with no edits of its own.
  //
  // The first child keeps the ORIGINAL un-suffixed keys (slot ""). That is not a
  // special case in the code — it is a slot whose suffix happens to be empty —
  // and it means an existing family's progress needs no migration and cannot be
  // lost by one. Kid two onward get "@k2", "@k3".
  //
  // Entitlement, trial, the parent gate, the anonymous beacon id and device
  // permissions are FAMILY-wide and must never be namespaced: a family pays
  // once, and a second child must not land behind a paywall or re-trigger the
  // OS mic prompt.
  const KIDSKEY = "sona.kids.v1";
  const PER_KID = new Set([
    PKEY, GKEY,
    "sona.rotation.v1", "sona.today.v1", "sona.episode.v2", "sona.reps.v1",
    "sona.day.v2", "sona.coinmint.v1", "sona.tickets.v1", "sona.charge.v1",
    "sona.daily.v1", "sona.session.v1", "sona.levels.v1", "sona.campaign.v1",
    "sona.stickers.v1", "sona.attempts.v1", "sona.outcomes.v1", "sona.gamereps.v1", "sona.goaldays.v1",
    "sona.lib.read.v1", "sona.feed.v1", "sona.call.v1", "sona.callhist.v1",
    "sona.games.v1", "sona.homework.v1", "sona.reclast",
    // Dino Dig's round of dinosaurs: which one is next and the ones found
    // (arcade-dino.html keeps it). A collection, never practice data.
    "sona.dino.v1",
    // how many races this child has started from Sound Sprint's start card
    // (Echo's how-to-play, shown for the first three): a sibling gets their own
    "sona.sprintintro.v1",
    // QUEST1: where this child is in the 14-day daily adventure, and the day
    // they last finished one (a brother or sister has their own adventure)
    "sona.quest.v1",
    // each child's own best in each game (BESTS1, Sona.gameBest): a brother
    // or sister starts with none, and it goes when the child is removed. The
    // old "sona.best.<game>" keys were one per phone, so siblings overwrote
    // each other; they are not carried over.
    "sona.bests.v1",
    // each child's own trophies, daily chest, Trophy Road and game levels (11
    // Oct 2026, TROPHY1 and after): a play economy, never practice data
    "sona.trophy.v1", "sona.chest.v1", "sona.road.v1", "sona.playlevel.v1",
    // each child's Practice Board entry and the last board they saw (BOARD2,
    // 11 Oct 2026): never in a backup, and gone when the child is removed
    "sona.board.v1", "sona.boardcache.v1",
    // PER-CHILD, and it must be. This key holds the clinician code, the
    // reporting childId and the grown-up's CONSENT to share. While it was
    // shared, two siblings on one iPad reported under ONE childId: the roster
    // row was overwritten by whichever child practiced last, so a clinician
    // saw one child's name against the other's outcomes — and homework
    // assigned to one arrived on the other's profile. Consent was also
    // inherited silently, which is the part that is not just a bug.
    "sona.pilot.v1",
  ]);
  function _kids() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(KIDSKEY)); } catch (e) {}
    if (!v || !Array.isArray(v.list) || !v.list.length) {
      // seed from whoever is already on this device — slot "" is their data
      let nm = "";
      try { nm = (JSON.parse(localStorage.getItem(PKEY) || "{}").childName) || ""; } catch (e) {}
      v = { active: "", list: [{ slot: "", name: nm }] };
    }
    if (!v.list.some((k) => k.slot === v.active)) v.active = v.list[0].slot;
    return v;
  }
  function _saveKids(v) { try { localStorage.setItem(KIDSKEY, JSON.stringify(v)); } catch (e) {} }
  function _slot() { try { return _kids().active || ""; } catch (e) { return ""; } }
  function _k(key) { const s = _slot(); return (s && PER_KID.has(key)) ? key + "@" + s : key; }
  // Pages that keep their own localStorage key (Story Time's game flags, the
  // library's read stars, Echo's size, the comeback date) call this so their key
  // belongs to the child too. Anything in PER_KID that does NOT route through
  // load()/save() MUST be namespaced through here, or the list is a promise the
  // code doesn't keep.
  function kkey(key) { return _k(key); }

  function load(key, def) { try { const v = JSON.parse(localStorage.getItem(_k(key))); return (v && typeof v === "object") ? v : clone(def); } catch { return clone(def); } }
  function save(key, val) { try { localStorage.setItem(_k(key), JSON.stringify(val)); } catch {} }
  // Write to the child who was active when the work STARTED, not whoever is
  // active when it finishes. save() resolves _k() at write time, which is
  // right for anything synchronous and wrong for anything that awaits: a
  // response that arrives after a switch lands under the wrong name.
  function saveFor(slot, key, val) {
    try { localStorage.setItem((slot && PER_KID.has(key)) ? key + "@" + slot : key, JSON.stringify(val)); } catch {}
  }
  // …and its mirror: read one child's key whoever is active (the Practice
  // Board sends for every child on the phone, not only the one playing).
  function _loadFor(slot, key, def) {
    try { const v = JSON.parse(localStorage.getItem((slot && PER_KID.has(key)) ? key + "@" + slot : key)); return (v && typeof v === "object") ? v : clone(def); } catch { return clone(def); }
  }

  // The switcher's list, each entry carrying the name from that kid's OWN
  // profile (the cached name goes stale the moment a parent renames a child).
  function kids() {
    const v = _kids();
    return v.list.map((k) => {
      let nm = k.name || "";
      try { const p = JSON.parse(localStorage.getItem(k.slot ? PKEY + "@" + k.slot : PKEY) || "{}"); if (p.childName) nm = p.childName; } catch (e) {}
      return { slot: k.slot, name: nm, active: k.slot === v.active };
    });
  }
  function activeKid() { return kids().filter((k) => k.active)[0] || null; }
  // The live page uses one session key. Park it with its owner whenever a
  // parent changes children, so a pending game cannot credit a sibling.
  function _switchRun(from, to) {
    if (from === to) return;
    try {
      const key = "sona.run.v1", saved = sessionStorage.getItem(key);
      const fromKey = key + "@" + (from || "first");
      if (saved) sessionStorage.setItem(fromKey, saved);
      else sessionStorage.removeItem(fromKey);
      const next = sessionStorage.getItem(key + "@" + (to || "first"));
      if (next) sessionStorage.setItem(key, next);
      else sessionStorage.removeItem(key);
      // A game entrance token is transient; the saved ready checkpoint owns
      // any already-earned game and will issue its own token on resume.
      ["sona.play.token", "sona.play.active", "sona.boost.sound", "sona.boost.level", "sona.boost.ask"].forEach((k) => sessionStorage.removeItem(k));
    } catch (e) {}
  }
  function addKid(name, age) {
    const v = _kids();
    // Slots are never reused — a removed kid's leftover keys and saved voice
    // clips must not become a new child's history. It used to take the lowest
    // free slot, so the child added after a removal was handed the removed
    // child's slot, and their Progress page played the removed child's saved
    // tries. Now the record keeps the highest slot ever given (`hi`); a record
    // from before that starts from the highest slot still on the list.
    let hi = Math.max(1, parseInt(v.hi, 10) || 1);
    v.list.forEach((k) => { const n = parseInt(String(k.slot).slice(1), 10); if (n > hi) hi = n; });
    const slot = "k" + (hi + 1);
    v.hi = hi + 1;
    // A device that removed a child before this build may still hold that
    // child's clips under this very slot (removing used to leave them). A new
    // slot can own none, so clear whatever is stamped with it.
    _dropRecordings(slot);
    // …and the Practice Board: a restored list can bring a lower `hi`, and a
    // slot handed out again must never inherit another child's board entry or
    // the grown-up's yes for them (BOARD2). A stray entry is queued for
    // deletion, never kept.
    try { _boardDrop(slot); _boardPendForget([slot]); } catch (e) {}
    // A grandfathered household stays grandfathered through its NEW children
    // too (24 Sep 2026). earlyAdopterAnyKid() only sees children still on the
    // list, so a family who added a sibling and then removed the first child
    // — the only one the sweep ever marked — dropped to the free version.
    // Read BEFORE the list changes; copied, never invented.
    const household = earlyAdopterAnyKid();
    // A household that kept its buddies (OWN1) keeps them for a new child too,
    // written into the profile so a backup carries them to another phone.
    const keptSet = buddiesKept();
    v.list.push({ slot, name: String(name || "").slice(0, 24) });
    _switchRun(v.active, slot);
    v.active = slot;
    _saveKids(v);
    // written through the namespace, so this lands on the NEW kid
    save(PKEY, Object.assign(clone(DEFAULT_PROFILE), {
      childName: String(name || "").slice(0, 24),
      childAge: String(age || ""),
      onboarded: false,
    }, household ? { earlyAdopter: true } : {}, keptSet ? { owned: _legacyInto(clone(DEFAULT_PROFILE.owned)) } : {}));
    return slot;
  }
  function switchKid(slot) {
    const v = _kids();
    if (!v.list.some((k) => k.slot === slot)) return false;
    _switchRun(v.active, slot);
    v.active = slot; _saveKids(v); return true;
  }
  function removeKid(slot) {
    const v = _kids();
    if (v.list.length < 2) return false;              // never leave zero children
    // a child on the Practice Board leaves it with the rest of their data:
    // the deletion is queued first and goes out from the next practice,
    // game, road or Settings page, and slot "" is cleared here because the
    // PER_KID sweep below leaves the first child's keys (BOARD2)
    try { _boardDrop(slot); _boardPendForget([slot]); } catch (e) {}
    v.list = v.list.filter((k) => k.slot !== slot);
    if (v.active === slot) { _switchRun(slot, v.list[0].slot); v.active = v.list[0].slot; }
    try { sessionStorage.removeItem("sona.run.v1@" + (slot || "first")); } catch (e) {}
    _saveKids(v);
    // drop that child's practice data; slot "" (the first kid) shares the
    // un-suffixed keys, so only a suffixed slot is safe to clear
    if (slot) { try { PER_KID.forEach((k) => localStorage.removeItem(k + "@" + slot)); } catch (e) {} }
    // …and their saved tries, whichever slot they had: the clips are theirs,
    // and no child is ever given slot "" again.
    _dropRecordings(slot);
    return true;
  }

  // SET1 replaced three audio checkboxes with one volume slider (gone too now,
  // see getProfile), but a profile saved BEFORE that can still carry
  // voiceOn:false — and there is no longer a control anywhere that can set it
  // back to true. Echo goes silent forever and the parent has nothing to
  // press. Reconcile the legacy flags with the volume that now owns them:
  // audible volume means audible Echo.
  function _healAudioFlags(p) {
    if (!p || typeof p !== "object") return p;
    const vol = (p.volume != null ? p.volume : 0.6);
    if (vol > 0 && (p.voiceOn === false || p.soundOn === false)) {
      p.voiceOn = true; p.soundOn = true;
      try { save(PKEY, p); } catch (e) {}
    }
    return p;
  }

  // THE FREE-ERA PROMISE. Sona shipped free, then priced. Every family already
  // on the app when the paid build first loads came in under that promise and
  // keeps it — for good. Detected structurally rather than by date: if this
  // device was ALREADY onboarded the first time this ran here, it predates
  // pricing. Stamped once, so a family who signs up after the flip is never
  // caught by it, and a later run can never revoke a grant already made.
  //
  // This runs in FREE MODE TOO, and that is the whole point. It used to return
  // early while free, which meant nothing was stamped until a paid build
  // loaded — so going free again and pricing again later would have caught the
  // entire second free period in a promise that was only ever made to the
  // first one. The evidence that separates the two cohorts (an onboarded
  // device carrying no stamp) exists only until this build reaches the phone,
  // so the boundary is drawn NOW, while it is still there to draw. Families
  // from the original free era keep free forever; families arriving during
  // this free period are free because the app is free, which is a different
  // promise and a revocable one.
  const GFKEY = "sona.freeera.v1";
  function _grandfatherFreeEra() {
    try {
      if (localStorage.getItem(GFKEY)) return;      // this device was already judged
      const raw = localStorage.getItem(PKEY);
      let pr = null;
      try { pr = JSON.parse(raw || "null"); } catch (e) { pr = null; }
      const pre = !!(pr && (pr.onboarded || pr.childName));
      localStorage.setItem(GFKEY, pre ? "grandfathered" : "post");
      if (pre) {
        pr.earlyAdopter = true; pr.freeEra = true;
        localStorage.setItem(PKEY, JSON.stringify(pr));
      }
    } catch (e) {}
  }

  // SECOND FREE ERA, ALSO KEPT. Sona was free again for nine days (20-28 Aug)
  // and those families were told a REVOCABLE thing — the app is free, not free
  // forever. Travis chose to keep it for them anyway. This upgrades them.
  //
  // The hard part is telling an era-two family apart from a family who arrives
  // tomorrow, because BOTH are stamped "post": a brand-new device is stamped on
  // its very first load, before it has onboarded. No date on the device
  // distinguishes them reliably — practiceDays is pruned at 130 days and a
  // family who set up but never practiced has none at all.
  //
  // So this uses the same structural trick that worked for era one: on the
  // FIRST LOAD OF THIS BUILD, a device that is ALREADY onboarded necessarily
  // existed before this build shipped. Era one is already stamped
  // "grandfathered", so an onboarded device still stamped "post" can only be
  // era two. A family arriving tomorrow is stamped and swept before they
  // onboard, and is correctly left out. Like era one, the evidence exists only
  // until this build lands, which is why it is claimed on the way in.
  const GF2KEY = "sona.freeera2.v1";
  function _grandfatherFreeEra2() {
    try {
      if (localStorage.getItem(GF2KEY)) return;     // swept once, on the way in
      localStorage.setItem(GF2KEY, "done");
      if (localStorage.getItem(GFKEY) !== "post") return;   // era one, or not yet judged
      // every child on the device, not just the active one — access was
      // granted to the household, the same rule earlyAdopterAnyKid enforces
      let slots = [""];
      try {
        const v = JSON.parse(localStorage.getItem(KIDSKEY) || "null");
        if (v && v.list && v.list.length) slots = v.list.map((k) => k.slot || "");
      } catch (e) {}
      let any = false;
      slots.forEach(function (slot) {
        const key = slot ? PKEY + "@" + slot : PKEY;
        try {
          const pr = JSON.parse(localStorage.getItem(key) || "null");
          if (pr && (pr.onboarded || pr.childName)) {
            pr.earlyAdopter = true; pr.freeEra = true; pr.freeEra2 = true;
            localStorage.setItem(key, JSON.stringify(pr));
            any = true;
          }
        } catch (e) {}
      });
      if (any) localStorage.setItem(GFKEY, "grandfathered");
    } catch (e) {}
  }

  function getProfile() {
    const p = Object.assign(clone(DEFAULT_PROFILE), load(PKEY, {}));
    // ONE coach voice for every family (Travis, 29 Sep 2026). The voice picker
    // is gone, so a voice saved from it (Sarah, George…) is overridden here
    // rather than honoured: with no picker left, an old pick would strand that
    // family on a voice nobody else hears and they could never change back.
    // The old pick is not kept, either: saveProfile() writes this result back,
    // so the next save of any setting replaces it with the default. Harmless —
    // nothing reads the saved field any more, and there is no picker to undo.
    p.voiceId = DEFAULT_PROFILE.voiceId;
    // The optional parent code is gone (Travis, 30 Sep 2026: "get rid of the
    // parent code"): Home always asks for four number words, so a code saved
    // before then opens nothing. Dropped here, so the next save of any setting
    // stops carrying it in the profile and into backups.
    delete p.parentPin;
    // SOUND IS ON OR OFF; THE PHONE'S SIDE BUTTONS DO THE REST (Travis, 30 Sep
    // 2026: "why can't we just use our phones to adjust volume on the side of
    // our iphone?"). The Settings slider is gone, so a level saved from it —
    // 30%, 100% — would be a level nobody can change again. That happened
    // once already: the old default was 30% and families were stuck there
    // after the first slider went. So every level above zero plays at the one
    // normal level. Zero is kept exactly: a muted child stays silent until a
    // grown-up taps Turn sound on in Settings, which writes the normal level
    // back. Read-time, not written back: every page reads volume through
    // here, and the next save of any setting stores the result.
    const vol = p.volume == null ? NaN : Number(p.volume);
    p.volume = (isFinite(vol) && vol <= 0) ? 0 : DEFAULT_PROFILE.volume;
    return _healAudioFlags(p);
  }
  // Playback-rate multiplier for /api/tts audio. Leo's ElevenLabs voice is
  // already a kid — no pitch-shift needed.
  const VOICE_PITCH = 1;
  // Shared delivery revision: server tuning must not leave families replaying
  // older, indefinitely cached prompts on their devices.
  // v9 (28 Sep 2026): /api/tts makes every line with Eleven v4 Turbo instead of
  // Multilingual v2. v8 (24 Sep) levelled every clip to one loudness with
  // calmer settings and a fixed seed. Moves in lockstep with VOICE_REVISION in
  // app/api/tts/route.ts — a phone that kept its v8 copies would go on playing
  // the old model's takes for every line it had already heard.
  const TTS_CACHE_VERSION = "v9";
  const _voiceEvents = [];
  function voiceDiagnostic(event) {
    event = event || {};
    const sources = ["elevenlabs", "openai", "server", "cache", "browser", "human", "unavailable"];
    const reasons = ["api-error", "network-error", "timeout", "playback-blocked", "playback-error", "no-audio", "fallback", "no-synth"];
    const item = { at: Date.now(), source: sources.indexOf(event.source) >= 0 ? event.source : "unavailable" };
    if (reasons.indexOf(event.reason) >= 0) item.reason = event.reason;
    if (typeof event.model === "string" && /^[a-z0-9_.-]{1,64}$/i.test(event.model)) item.model = event.model;
    if (typeof event.revision === "string" && /^[a-z0-9_.-]{1,32}$/i.test(event.revision)) item.revision = event.revision;
    if (["hit", "miss", "device"].indexOf(event.cache) >= 0) item.cache = event.cache;
    if (Number.isInteger(event.status) && event.status >= 100 && event.status <= 599) item.status = event.status;
    _voiceEvents.push(item); if (_voiceEvents.length > 20) _voiceEvents.shift();
    // Memory only: no spoken text, child information, audio, persistence or beacon.
    return Object.assign({}, item);
  }
  function voiceStatus() {
    return { last: _voiceEvents.length ? Object.assign({}, _voiceEvents[_voiceEvents.length - 1]) : null,
      events: _voiceEvents.map(function (item) { return Object.assign({}, item); }) };
  }

  // ── "Go!": Echo's turn cue after a game's ask (2 Oct 2026) ──
  // Travis: "i also wanna try to have the 11 labs voice say 'Go!'". Feed
  // Echo, the Say & Play games (Bubble Pop, Hoops, Soccer Goal, Dino Dig) and
  // Peekaboo say it straight after the word, as its own short clip, so a child
  // who can't read hears that it is their turn. It is a nicety, so it never
  // holds up a turn (review, 2 Oct 2026). Fetched like the word, every turn
  // waited on the voice service a second time while "Listen…" sat on screen
  // in silence: up to 8 s more when the service was slow, on every turn while
  // it sent stand-ins (those are never saved, so "Go!" was fetched again each
  // time), and a "Go!" the service could not send came in the browser's robot
  // voice after Echo's word. So each game asks goClip() for the clip it can
  // play right now, and plays nothing when there is none:
  // - this page's copy, or this phone's saved copy (read from the phone, not
  //   the network); if neither, nothing this turn, and the voice service is
  //   asked in the background, so the next turn has it;
  // - only the first ask of a visit waits for that request (waitMs, the
  //   game's GO_WAIT_MS: 1.5 s at most after the word), so a new phone hears
  //   "Go!" from the start;
  // - an ordinary answer is saved on the phone; a stand-in (X-Sona-Voice-Keep
  //   "0") is kept for this page only and never saved, so the next visit asks
  //   again, the rule every voice line keeps (28 Sep 2026);
  // - never the browser voice: no clip, no "Go!".
  // Resolves with the clip's bytes (an ArrayBuffer of 24 kHz PCM) or null.
  const GO_LINE = "Go!", GO_WAIT_MS = 1500, _go = { mem: {}, job: {} };
  function _goStore(key, bytes) {
    return new Promise(function (done) {
      // a phone that never answers is the same as one without the clip
      const timer = setTimeout(function () { done(null); }, 500);
      const fin = function (v) { clearTimeout(timer); done(v || null); };
      try {
        const rq = indexedDB.open("sona-tts", 1);
        rq.onupgradeneeded = function () { try { if (!rq.result.objectStoreNames.contains("clips")) rq.result.createObjectStore("clips"); } catch (e) {} };
        rq.onerror = function () { fin(null); };
        rq.onsuccess = function () {
          try {
            const tx = rq.result.transaction("clips", bytes ? "readwrite" : "readonly"), st = tx.objectStore("clips");
            if (bytes) { st.put(bytes, key); tx.oncomplete = function () { fin(bytes); }; tx.onerror = function () { fin(null); }; return; }
            const q = st.get(key); q.onsuccess = function () { fin(q.result); }; q.onerror = function () { fin(null); };
          } catch (e) { fin(null); }
        };
      } catch (e) { fin(null); }
    });
  }
  function _goFetch(voice) {
    let ctl = null, to = 0;
    try { ctl = new AbortController(); to = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 8000); } catch (e) {}
    return fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: GO_LINE, voice: voice || "", stable: true }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        if (!r.ok) return null;
        const keep = !(r.headers && r.headers.get && r.headers.get("X-Sona-Voice-Keep") === "0");
        return r.arrayBuffer().then(function (b) { return b && b.byteLength ? { bytes: b, keep: keep } : null; });
      })
      .then(function (v) { clearTimeout(to); return v; }, function () { clearTimeout(to); return null; });
  }
  function goClip(voice, waitMs) {
    const key = (voice || "echo") + "|" + TTS_CACHE_VERSION + "|" + GO_LINE;
    if (_go.mem[key]) return Promise.resolve(_go.mem[key]);
    let job = _go.job[key];
    if (!job) {
      job = _go.job[key] = {};
      job.phone = _goStore(key);
      job.all = job.phone.then(function (b) {
        if (b) return b;
        return _goFetch(voice).then(function (v) { if (!v) return null; if (v.keep) _goStore(key, v.bytes); return v.bytes; });
      }).then(function (b) { if (b) _go.mem[key] = b; if (_go.job[key] === job) delete _go.job[key]; return b; },
        function () { if (_go.job[key] === job) delete _go.job[key]; return null; });
    }
    if (!(waitMs > 0)) return job.phone.then(function (b) { return b || _go.mem[key] || null; });
    return Promise.race([job.all, new Promise(function (done) { setTimeout(function () { done(null); }, waitMs); })])
      .then(function (b) { return b || _go.mem[key] || null; });
  }

  function saveProfile(patch) {
    // Lowering the daily target can complete today without another saying.
    // Stamp that earned day in this writer; read-only goal readers stay pure.
    const dailyChange = patch && Object.prototype.hasOwnProperty.call(patch, "dailyGoal");
    const previousGoal = dailyChange ? repGoal() : null;
    save(PKEY, Object.assign(getProfile(), patch || {}));
    // …and pay it: today's reps already said earn against the lowered goal
    // now (30 once it is met, like any goal day), not at a next rep that may
    // never come that day (the ledger never goes back to an earlier day).
    // Only the difference is paid, so nothing pays twice.
    if (dailyChange && repGoal() < previousGoal) { if (dayReps() > 0) _trophyAdd(); _goalCheck(); }
  }

  function getProgress() {
    // A read never CREATES the record (11 Oct 2026). A phone with none has no
    // rungs to remap, so the fresh default is born migrated and nothing is
    // saved; the first real write (a try, a coin) stores it with the flag.
    // Home used to create it on every first load through the coin mint
    // (retired, COIN3), which hid that any page reading progress, a game a
    // child cannot open included, wrote this key just by looking.
    let had = false; try { had = localStorage.getItem(_k(GKEY)) != null; } catch (e) {}
    const g = load(GKEY, DEFAULT_PROGRESS);
    if (!had) g.ladderV = 2;
    g.totals = Object.assign({ sessions: 0, words: 0, stars: 0, coins: 0 }, g.totals || {});
    g.streak = Object.assign({ count: 0, lastDate: "" }, g.streak || {});
    g.bySound = g.bySound || {}; g.sessions = g.sessions || []; g.stage = g.stage || {}; g.chests = g.chests || {}; g.missed = g.missed || [];
    if (migrateLadder(g)) save(GKEY, g);
    return g;
  }
  // ── ladder v2: the phrase rung is gone (word → sentence) ───────────────
  // g.stage[sound] is an INDEX into LADDER, so dropping a rung silently
  // re-points every stored value: a child sitting on 4 ("sentence") would read
  // as 5 ("conversation") and be pushed a level they never earned. One-time
  // remap, flagged so it can only run once:
  //   0,1,2  isolation/syllable/word  → unchanged
  //   3      phrase                   → 2 (word). Conservative on purpose: the
  //          rung they cleared no longer exists, and the cap is earned+1, so
  //          they still stretch to sentences without us claiming they own them.
  //   4,5    sentence/conversation    → 3,4 (the same names, new indices)
  function migrateLadder(g) {
    if (g.ladderV >= 2) return false;
    const st = g.stage || {};
    Object.keys(st).forEach((s) => {
      const v = st[s] | 0;
      if (v >= 4) st[s] = v - 1;
      else if (v === 3) st[s] = 2;
    });
    g.ladderV = 2;
    return true;
  }
  // Local calendar day (was toISOString = UTC, which broke evening streaks).
  function _localDay(ms) { const d = ms != null ? new Date(ms) : new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  const today = () => _localDay();
  // Idempotent per local day: counts a streak day the first time the child does
  // anything real today; called from both recordSession and logAttempt so games
  // keep Today's streak alive, not just the lesson flow.
  function bumpStreak(g) { const t = today(); if (g.streak.lastDate !== t) { const y = _localDay(Date.now() - 86400000); g.streak.count = (g.streak.lastDate === y) ? (g.streak.count || 0) + 1 : 1; g.streak.lastDate = t;
    // per-day practice history for the parent's weekly goal (pruned ~4 months)
    g.practiceDays = g.practiceDays || {}; g.practiceDays[t] = 1;
    const cut = _localDay(Date.now() - 130 * 86400000); Object.keys(g.practiceDays).forEach(function (k) { if (k < cut) delete g.practiceDays[k]; });
  } }

  // Daily rep goals and the grown-up's week. Existing practice days stay in
  // days/done for honest practice summaries; metDays/goalDone show the new goal.
  // Before goals existed, a family's practiced days keep their earned weeks.
  const GOALKEY = "sona.goaldays.v1", GOAL_SINCE = "2026-10-05";
  // 3, 4, 5 or 7. "Every day" is a real choice again (Travis, 5 Oct 2026, of
  // setup: "three days a week or five days a week or every day"); for a few
  // hours that day a saved 7 read as 5.
  function goalDays() { const n = parseInt(getProfile().weeklyGoal, 10); return (n === 3 || n === 4 || n === 5 || n === 7) ? n : 4; }
  function weeklyGoalDays() { return goalDays(); }
  // A pure read (load, not getProgress): getProgress() saves the one-time
  // ladder migration on a record without it, and Home used to make that write
  // on every load through mintCoins(). Since COIN3 (11 Oct 2026) Home only
  // reads, so a reader must not be the one to write it either.
  function momWeek() {
    const g = load(GKEY, DEFAULT_PROGRESS), pd = Object.assign({}, g.practiceDays || {}), stamps = load(GOALKEY, {}), t = today();
    if (g.streak && g.streak.lastDate) pd[g.streak.lastDate] = 1;
    const now = new Date(), dow = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
    const key = (d) => _localDay(d.getTime());
    function met(k) { return k <= t && (!!stamps[k] || (k === t && dayGoal().done) || (k < GOAL_SINCE && !!pd[k])); }
    const days = [], metDays = [];
    for (let i = 0; i < 7; i++) { const k = key(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)); days.push(k <= t && !!pd[k]); metDays.push(met(k)); }
    const goal = goalDays(), done = days.filter(Boolean).length, goalDone = metDays.filter(Boolean).length;
    let weekStreak = 0;
    for (let w = 1; w <= 26; w++) {
      let c = 0; for (let i = 0; i < 7; i++) if (met(key(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7 * w + i)))) c++;
      if (c >= goal) weekStreak++; else break;
    }
    if (goalDone >= goal) weekStreak++;
    return { days, done, metDays, goalDone, goal, hit: goalDone >= goal, weekStreak, todayIx: dow, practicedToday: days[dow] };
  }
  // current stage to practice for a sound (0..3); 3 = mastered
  function stageOf(sound) { const g = getProgress(); return Math.min(3, g.stage[sound] || 0); }
  // advance a sound's stage after finishing that stage's session (if they passed)
  function completeStage(sound, stage, passed) {
    const g = getProgress();
    const cur = g.stage[sound] || 0;
    if (passed && stage >= cur && cur < 3) { g.stage[sound] = Math.min(3, stage + 1); save(GKEY, g); }
    return g.stage[sound] || 0;
  }

  // ── SLP content ladder: isolation → syllable → word → sentence → conversation ──
  // The way real therapists sequence a target sound. Per-sound progress climbs
  // the 6 rungs; a rung unlocks the next after a solid round (~80% — "encouraging"
  // gating: only ever moves UP, and every lower rung stays replayable). We reuse
  // g.stage[sound] as the rung index (0..6, 6 = all rungs cleared) so it stays in
  // sync with the existing stage tracker (stageOf/completeStage keep their 0..3
  // contract for the legacy lesson flow).
  // No phrase rung. It only ever existed as "carrier + word" ("a rain"), which
  // was auto-generated and ungrammatical for half the bank; a real phrase step
  // needs a per-word carrier table. Word → sentence until that exists.
  // g.stage[sound] indexes THIS array — see migrateLadder() before reordering it.
  const LADDER = ["isolation", "syllable", "word", "sentence", "conversation"];
  const LADDER_LABEL = { isolation: "Sound", syllable: "Syllables", word: "Words", sentence: "Sentences", conversation: "Talking" };
  const RUNG_MASTER = 0.8; // ~80% on a rung advances to the next
  function rungOf(sound) { const g = getProgress(); return Math.min(LADDER.length, g.stage[sound] || 0); } // 0..6
  function rungName(i) { return LADDER[i] || "mastered"; }
  function rungLabel(i) { return LADDER_LABEL[LADDER[i]] || "Mastered"; }
  // Record a finished round at `rung`. accuracy: 0..1 (or a pass boolean). Encouraging:
  // advances only when solid and never regresses.
  function recordRung(sound, rung, accuracy) {
    const g = getProgress(); const cur = g.stage[sound] || 0;
    const ok = (typeof accuracy === "number") ? accuracy >= RUNG_MASTER : !!accuracy;
    if (ok && rung >= cur && cur < LADDER.length) { g.stage[sound] = Math.min(LADDER.length, rung + 1); save(GKEY, g); }
    return g.stage[sound] || 0;
  }
  // One clean first-listen pass at the stretch rung; the second one earns it.
  // The rule (two passes, never down) is Rachel's and is unchanged — this is
  // only WHOSE count it is. The practice page used to keep it in a key named
  // for the sound and rung ("sona.rungwins.R.0") and pass that through kkey(),
  // but PER_KID holds fixed names, so the key was never suffixed and the count
  // was the DEVICE's: one sibling's pass plus the other's moved a level for a
  // child who had earned half of it. It lives inside the child's own progress
  // now, so it follows them through load()/save(), a backup and a removal.
  // Counts left under the old keys are not read: a child at worst needs one
  // more clean round, which is the safe direction.
  function rungWin(sound, rung) {
    const g = getProgress(); const k = sound + "." + rung;
    g.rungWins = g.rungWins || {};
    const w = (g.rungWins[k] | 0) + 1;
    if (w >= 2) { delete g.rungWins[k]; save(GKEY, g); return recordRung(sound, rung, 1); }
    g.rungWins[k] = w; save(GKEY, g);
    return g.stage[sound] || 0;
  }
  // ── free-play rotation: one letter at a time, one rung per game ──
  // A rotation = ROT_LEN practice rounds (≈ one pass of the games — any games,
  // any order) spent on ONE focus sound. Round r practices rung min(r, earned+1):
  // warm up in isolation, climb a rung each game, stretch ONE level past
  // mastery, never three. When a rotation completes, the NEXT focus sound takes
  // over — so every sound the family picked gets worked, not just the first.
  // The rotation persists across days (stop at round 3, resume at round 3);
  // todayRing() below is the per-day goal and resets each morning.
  const ROTKEY = "sona.rotation.v1", RINGKEY = "sona.today.v1", ROT_LEN = 5;
  // ── HW1: homework an SLP assigned ──────────────────────────────────────
  // The design decision: homework REPLACES what the app would have picked. It
  // is not a to-do list beside the practice — rotSounds(), the word position
  // and the daily rep goal all defer to it, so the clinician's plan is simply
  // what the child does next. Homework the app ignores is a checkbox.
  //
  // Cached locally and read from the cache on every call. The network is never
  // in the path of a child starting a round: a phone in a car with no signal
  // practices yesterday's assignment rather than nothing.
  const HWKEY = "sona.homework.v1";
  function homework() {
    try {
      const hw = (load(HWKEY, {}) || {}).hw;
      if (!hw || !hw.sounds || !hw.sounds.length) return null;
      const d = _localDay();
      if (hw.start && d < hw.start) return null;   // not started yet
      if (hw.due && d > hw.due) return null;       // window closed
      return hw;
    } catch (e) { return null; }
  }
  // Sounds the assignment names that this app actually has words for. An SLP
  // can type anything; the child should never land on an empty round.
  function homeworkSounds() {
    const hw = homework(); if (!hw) return [];
    return hw.sounds.map((x) => String(x).toUpperCase()).filter((x) => WORDS[x]);
  }
  // Pull the assignment, and report this child's rep total against the one we
  // are currently holding. Fire-and-forget, at most hourly, and every failure
  // path leaves the cached copy exactly where it was.
  // THE THROTTLE IS PER CHILD. One shared timestamp meant that after the first
  // child synced, a sibling switched to within the hour was refused their own
  // fetch entirely — so a second child on the same iPad could go an hour
  // without ever seeing the assignment their SLP had just written.
  const _hwAt = {};
  function syncHomework(force) {
    try {
      if (!isPilot()) return Promise.resolve(null);
      const now = Date.now();
      // Pin the child HERE. Everything below — the credential, the rep count,
      // and above all the write — belongs to whoever is active at this
      // instant, and a parent can switch children while the request is in
      // flight. Without this, child A's SLP assignment was saved into child
      // B's slot, and B then practiced A's sound at A's word position with
      // A's reps reported against it. Clinical data crossing children is the
      // exact failure the per-child pilot key was split to prevent; this is
      // the asynchronous half of it.
      const slot = _slot();
      if (!force && now - (_hwAt[slot] || 0) < 3600000) return Promise.resolve(homework());
      _hwAt[slot] = now;
      const pi = pilotInfo(), code = pi.code || "", childId = pi.childId || "";
      let ticket = ""; try { ticket = localStorage.getItem("sona.slpticket") || ""; } catch (e) {}
      if (!code || !childId || !ticket) return Promise.resolve(null);
      const body = { code: code, childId: childId, ticket: ticket };
      // TODAY'S TOTAL, never a delta — a retried request cannot inflate it,
      // the same reason the trophy ledger (TROPHY1) pays only the difference
      // from the day's count. Reps only; no audio, no name, nothing else.
      const cur = homework();
      if (cur) { body.forId = cur.id; body.reps = repsToday(); }
      return fetch("/api/homework", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json()).then((j) => {
        if (j && j.ok) saveFor(slot, HWKEY, { hw: j.hw || null, at: Date.now() });
        // homework() reads whoever is active NOW, which is the honest answer
        // for a caller that is still on this child and correctly reads the
        // other child's assignment for a caller that has switched.
        return homework();
      }).catch(() => homework());
    } catch (e) { return Promise.resolve(null); }
  }

  function rotSounds() {
    // Homework first: this is the whole point of assigning it.
    const hs = homeworkSounds();
    if (hs.length) return hs;
    const f = ((getProfile().focusSounds) || []).map((s) => String(s).toUpperCase()).filter((s) => WORDS[s]);
    return f.length ? f : ["R"];
  }
  // The position to practice: the assignment's, else the family's setting.
  // One reader for both, so a page cannot honour homework for the sound and
  // quietly ignore it for the position.
  //
  // A FAMILY CAN PICK ONLY THE START OF A WORD FOR NOW (Travis, 1 Oct 2026:
  // "have the options listed but to not let them select other positioning
  // because it's not built yet ... make it clear that it's just the initial
  // position"). Only the practice page ever read the setting; the games ask
  // for start-of-word words whatever it says (and so do the books, but for
  // the odd page with no such word), so "Middle" was a choice the app half
  // kept. FAMILY_POSITIONS is the one switch: Settings
  // and the pilot page list every position and grey out the ones not in it
  // ("coming soon"), and a position saved before this reads as the start of
  // a word here rather than being quietly honoured on one page. Add an id to
  // open it. An SLP's homework still names its own position.
  const FAMILY_POSITIONS = ["i"];
  function practicePos() {
    const hw = homework();
    if (hw && hw.pos) return hw.pos;
    try { const p = getProfile().practicePosition || "i"; return FAMILY_POSITIONS.indexOf(p) >= 0 ? p : "i"; } catch (e) { return "i"; }
  }
  function rotState() {
    const st = load(ROTKEY, {}); const f = rotSounds();
    let i = parseInt(st.i, 10), r = parseInt(st.r, 10);
    if (!(i >= 0 && i < f.length)) i = 0;
    if (!(r >= 0 && r < ROT_LEN)) r = 0;
    return { i, r, sound: f[i], len: ROT_LEN };
  }
  function rotSound() { return rotState().sound; }
  function rotRound() { return rotState().r; }
  // A practice round finished with real reps. The honesty split: QUALITY gates
  // the rung (recordRung — scored passes only); showing up moves the rotation.
  // ── first-party usage beacon (TRACK1) ──────────────────────────────────
  // Kid pages ship ZERO third-party scripts, so product events go to our own
  // /api/track and the SERVER relays them to analytics. Anonymous family id
  // only; the route enforces a hard whitelist of event names and properties,
  // so a typo here silently drops rather than leaking anything new.
  function track(ev, props) {
    try {
      const body = JSON.stringify({ e: ev, p: props || {}, fid: fid() });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", body);
      else fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch (e) {}
  }

  function rotAdvance() {
    const f = rotSounds(); const st = rotState();
    let i = st.i, r = st.r + 1;
    if (r >= ROT_LEN) { r = 0; i = (i + 1) % f.length; }
    save(ROTKEY, { i, r });
    // the Practice Path ticks here too: one finished round = one lifelong step
    try { const g = getProgress(); g.totals.rounds = (g.totals.rounds || 0) + 1; save(GKEY, g); } catch (e) {}
    const t = today(); const dr = load(RINGKEY, {});
    const n = ((dr.d === t ? dr.n : 0) || 0) + 1;
    save(RINGKEY, { d: t, n });
    // "day goal done" fires HERE, not per page: charge.html and Feed Echo both
    // land on this one line, and the ring only crosses the goal once per local
    // day (n climbs monotonically), so bonus rounds can't re-fire it. The sound
    // is the one just PRACTICED (st.i) — rotSound() already points at tomorrow's.
    if (n === ROT_LEN) { try { track("day goal done", { sound: f[st.i % f.length] }); } catch (e) {} }
    return { i, r };
  }
  // today's goal ring: rounds finished today; the goal = one full pass of the games
  function todayRing() { const dr = load(RINGKEY, {}); const n = (dr.d === today() ? dr.n : 0) || 0; return { n, goal: ROT_LEN, done: n >= ROT_LEN }; }

  // ── STORY1: the daily run is an EPISODE ────────────────────────────────
  // Kids come back for "what happens next," not for streaks. Each daily run is
  // one complete episode: an opening beat, a bridge before each round, and a
  // cliffhanger that names tomorrow.
  //
  // EPISODIC on purpose, not one long arc. Three reasons:
  //   1. articulation needs repetition; a linear story fights that
  //   2. a child who misses three days must not lose the thread
  //   3. content can grow forever by appending, with nothing to re-thread
  // The prose is sound-agnostic — the practice word still comes from the
  // child's own focus sound — so ONE arc serves all 19 sounds. Writing 19
  // separate arcs would be a content project; this is a week.
  // ── SEASON 1: THE LONG WAY HOME ────────────────────────────────────────
  // One chapter a day, in order, told across a season rather than a loop. A
  // kid who shows up on day 14 is in the middle of something, and knows it.
  //
  // Every chapter names the three games it hands over (`games`). They used to
  // be drawn at random from the deck, which made the day's shape arbitrary:
  // the river chapter could hand you the flying one and the story stopped
  // meaning anything. Now the river gives you the one where you place stones
  // and the ridge gives you the one where you fight the wind, so a game reads
  // as the next thing that happens rather than an interruption.
  //
  // The verbs the six games map to: slice = cut a way through · tiles = echo
  // a pattern back · stack = build upward · run = chase or escape · glide =
  // float, rise, fight wind · feed = give something to a creature.
  //
  // WRITING RULES, and they are not stylistic:
  //   - No instruction on HOW to say anything. "Your voice lifts the stone" is
  //     story; "say it louder", "say it slowly" is a CUE, and cueing is
  //     Rachel's to specify (CLAUDE.md). The old chapters had "be louder" and
  //     "say it strong" in the beats, which shipped a clinical decision inside
  //     a bedtime story.
  //   - Nothing here is a practice target. Targets come from WORDS/wordsFor().
  //     A chapter frames the practice; it never sets it.
  //   - Read aloud by TTS, so: plain punctuation, no markdown, no symbols a
  //     voice engine reads out as a word.
  //   - `games` order is CARD order, and the first card is the hero a kid taps
  //     LET'S GO on. "feed" is the littles game and must never lead a chapter:
  //     dailyGames() promotes it for under-6s on its own, and an eight-year-old
  //     opening the day on the toddler game is the regression feedtest catches.
  const EPISODES = [
    { id: "star", t: "The Star That Fell", games: ["glide", "feed", "tiles"],
      open: "You are in the meadow when the sky drops something. It lands in the tall grass with a soft whump. The grass around it starts to glow.",
      beats: [
        "It is a star. A small one, about the size of your two hands together. It is shaking.",
        "Echo lands beside it and says hello. The star does not answer. Stars do not know words yet.",
        "But when you speak, the star brightens. It has never heard a voice before. It likes yours.",
        "The more you say, the warmer it gets. Warm stars can float. Cold ones cannot.",
        "It lifts off the grass. Just a little. Just enough to show you it wants to go home.",
        "Home is a very long way up. Echo looks at the sky, then at you. This is going to take a while.",
      ],
      hook: "Tomorrow: the way out of the meadow is full of thorns." },

    { id: "brambles", t: "The Bramble Path", games: ["slice", "run", "feed"],
      open: "The only way out of the meadow is one narrow path. Overnight, the brambles have grown all the way across it.",
      beats: [
        "Thorns as long as your finger. Echo tries to squeeze through and comes back with one feather missing.",
        "The star floats up to look. From above, the path is a green tangle with no gap anywhere in it.",
        "Then the star does something new. It hums one low note, and a single bramble curls away from the sound.",
        "So you help. Every sound you make bends another branch back, and a gap opens up in the green.",
        "You go through in a line. Echo first, then you, then the star bobbing along behind.",
        "On the other side there is a noise like a hundred spoons in a hundred cups. Water. A lot of water.",
      ],
      hook: "Tomorrow: the river is too wide to jump and too fast to swim." },

    { id: "river", t: "The River Crossing", games: ["stack", "tiles", "slice"],
      open: "The river is wide, loud, and moving fast. There is no bridge. There is no boat. There is just you.",
      beats: [
        "The star floats out over the water to have a look, and the wind pushes it straight back to you.",
        "Echo spots something under the surface. Flat stones, one after another, like a path somebody hid on purpose.",
        "They are too deep to stand on. But when you speak, the nearest one rises up out of the water.",
        "One stone at a time. A sound, a stone, a step. A sound, a stone, a step.",
        "Halfway across, a fish comes up beside you and just listens. Then another one. Then eleven more.",
        "You reach the far bank with wet shoes and a small crowd of fish watching you go.",
      ],
      hook: "Tomorrow: the woods ahead say everything back to you." },

    { id: "woods", t: "The Whispering Woods", games: ["tiles", "run", "feed"],
      open: "The trees here are old and standing close together. Say one word and the woods say it back to you, twice.",
      beats: [
        "Echo goes absolutely wild. A parrot in a place that repeats things is a parrot in heaven.",
        "The star hides in your pocket. It is not used to hearing itself yet.",
        "You try a sound. The woods answer. You try another one. The woods answer that one too.",
        "Then a third voice joins in. Small, wobbly, half a beat behind. That one is not a tree.",
        "Something is following you and copying you. Echo stops laughing and steps in front of you.",
        "It comes out of the ferns. It is about the size of a teacup, and it is extremely fluffy.",
      ],
      hook: "Tomorrow: you find out what the fluffy thing is, and what it wants." },

    { id: "pip", t: "Pip", games: ["run", "feed", "glide"],
      open: "It is a baby owl. It has one feather sticking straight up off its head, and it will not stop staring at you.",
      beats: [
        "Echo asks its name. The owl copies the question back instead of answering it. It is learning too.",
        "You make a sound. The owl tries the same one. It comes out sideways, but it comes out.",
        "You make it again. This time the owl lands much closer to it, and its one feather quivers with the effort.",
        "You share your snack. The owl decides you are family now and climbs into your hood.",
        "Echo names it Pip, on the grounds that it makes a sound like pip whenever it is pleased.",
        "Pip points a wing at the hills. There is a black opening in the rock, and the path goes straight into it.",
      ],
      hook: "Tomorrow: the cave is dark, and dark is not the same as empty." },

    { id: "cave", t: "The Cave of Echoes", games: ["tiles", "slice", "glide"],
      open: "Inside the cave it is black. Not dim. Black. You cannot see your own hands in front of you.",
      beats: [
        "Then Pip makes one small nervous pip, and a ring of blue light spreads across the ceiling.",
        "The rock in here answers sound with light. Every noise you make lights up the part of the wall it touches.",
        "So you talk your way in. The cave glows ahead of you, one patch at a time, like stepping stones made of light.",
        "The star sits on your shoulder and hums along. Between the two of you, it is almost bright.",
        "The light reaches a wall that is not rock. It is flat, and somebody has drawn on it.",
        "Hundreds of drawings. And in every single one, somebody is holding a star.",
      ],
      hook: "Tomorrow: you find out who drew them, and where they were going." },

    { id: "drawings", t: "The Drawings", games: ["stack", "slice", "run"],
      open: "The drawings go on for further than you can walk in one go. They tell a story, left to right, like a very long comic.",
      beats: [
        "First panel: a person in a meadow, and a star falling out of the sky. That one looks familiar.",
        "Then a river. Then woods. Then a cave, with a small round shape riding on somebody's shoulder.",
        "Pip looks at the shoulder shape, then down at itself, then back at the shoulder shape.",
        "The last panel is a ladder. It starts on the ground and it goes up and up into the clouds.",
        "There is no drawing of what happens after the ladder. Whoever drew all this never came back to finish it.",
        "Echo is very quiet, which for a parrot is unusual. Then Echo says: well. We had better go and look.",
      ],
      hook: "Tomorrow: the ladder is real, and it is made of clouds." },

    { id: "clouds", t: "The Cloud Ladder", games: ["stack", "glide", "run"],
      open: "The ladder is exactly where the drawing said it would be. Rungs of white cloud, going up and up until they are too small to see.",
      beats: [
        "Echo tests the bottom rung with one foot. It goes straight through it. Cloud is cloud.",
        "Then the star drifts down and rests on the rung, and the cloud puffs solid, like bread rising.",
        "Warmth is what makes cloud firm. And your voice is what keeps the star warm.",
        "So you climb and you talk. Rung, sound, rung, sound. The meadow shrinks to a green thumbprint underneath you.",
        "Pip refuses to fly and rides in your hood the whole way, which is somehow more tiring for you than for Pip.",
        "Near the top the air changes. It is moving. It is moving very fast.",
      ],
      hook: "Tomorrow: the ridge, where the wind takes sounds away with it." },

    { id: "ridge", t: "The Windy Ridge", games: ["glide", "run", "slice"],
      open: "The top of the ladder comes out on a thin ridge of cloud, and the wind up here does not stop for a second.",
      beats: [
        "It pulls at your sleeves. It pulls at Echo's tail. It pulls sounds right out of the air and carries them off sideways.",
        "The star dims. Up here it is losing warmth faster than you can give it back.",
        "So you tuck it inside your coat, against you, where the wind cannot get at it.",
        "It works. You can feel it glowing through the fabric, steady as a heartbeat.",
        "Pip flies ahead to scout, gets blown backwards past your head, and returns to the hood without comment.",
        "Through the blur you see it. Something enormous standing out in the open sky, and the wind is going around it.",
      ],
      hook: "Tomorrow: the door in the sky, and the only key that fits it." },

    { id: "door", t: "The Sky Door", games: ["tiles", "stack", "glide"],
      open: "It is a door. It is taller than a tree and it is standing in the open air with nothing holding it up.",
      beats: [
        "No handle. No lock. No keyhole. Carved in the middle of it, at exactly your height, there is an ear.",
        "Echo knocks. Nothing. Pip pips at it. Nothing. The star bumps into it and slides slowly down.",
        "So you lean close to the carved ear, and you say something to it.",
        "The door listens. That is the whole trick. It has been waiting a very long time for somebody to talk to it.",
        "It swings open onto the night sky, closer than you have ever seen it, every star the size of a lamp.",
        "Your star leaps out of your coat and races for a gap in the pattern. And that is when you see the other gaps.",
      ],
      hook: "Tomorrow: one star is home. Eleven are still missing." },

    // ── ACT II: THE MISSING ELEVEN (11-20) ───────────────────────────────
    // Seven of the eleven are recovered here, each rescue its own small
    // self-contained problem, so a family joining on day 14 is in the middle
    // of something without being lost. It ends on the reason they fell.
    { id: "comeback", t: "The Star Comes Back", games: ["glide", "tiles", "run"],
      open: "Your star is home. It sits in its gap in the sky, blazing away, exactly the right shape for the space it left.",
      beats: [
        "You are about to go when it pops straight back out of the gap and lands on your shoulder.",
        "Echo says that is not how going home works. The star does not appear to care.",
        "Then you look properly at the sky, and you understand why it came back.",
        "There are gaps everywhere. Dark shapes where stars should be. You count them twice to be sure.",
        "Eleven. Eleven stars that fell somewhere and never got back up.",
        "Pip is already looking down through the open door. Somewhere under all that cloud, eleven lights are waiting.",
      ],
      hook: "Tomorrow: the first one fell into a city that never turns its lights off." },

    { id: "lanterns", t: "The Lantern City", games: ["run", "stack", "slice"],
      open: "You come down out of the clouds over a city made of lanterns. Thousands of them, strung between the rooftops, glowing orange.",
      beats: [
        "It is night here, but nobody has noticed. In a city of lanterns, night is just when the lights look nicer.",
        "Echo asks a pigeon for directions. The pigeon is not helpful. Pigeons rarely are.",
        "Then Pip pips once, and the two of you see it at the same time.",
        "One lantern in the middle of the city is far, far too bright. Nobody has thought to ask why.",
        "It is up at the very top of the tallest post, above all the washing lines and the cats.",
        "So you start to climb. Twelve floors of ladders and roof tiles, and the light gets whiter the higher you go.",
      ],
      hook: "Tomorrow: you reach the top, and the whole city is watching." },

    { id: "longnight", t: "The Longest Night", games: ["tiles", "feed", "glide"],
      open: "At the top of the post, inside a glass lantern the size of a bathtub, a star is sitting with its arms around its knees.",
      beats: [
        "It has been in there so long that it thinks the lantern is the sky.",
        "The glass is warm. When you speak near it, the star turns its head.",
        "It will not come out. Everything out there is dark and everything in here is bright, and it is not moving.",
        "So you sit down on the roof tiles and you talk to it. Not to make it do anything. Just so it is not on its own.",
        "The glass cools. The star stands up. It comes over to the little door in the side and looks out at you.",
        "As it steps out, every lantern in the city dims by exactly the same amount, and for the first time in years the people below look up.",
      ],
      hook: "Tomorrow: the next one fell somewhere much colder." },

    { id: "ice", t: "Under the Ice", games: ["slice", "run", "stack"],
      open: "A frozen lake, flat and grey and bigger than the city was. Under your boots you can hear the ice creak.",
      beats: [
        "Something down there is glowing green through the ice, about the size of a dinner plate.",
        "It is not green. It is a star, and the ice is what is making it look that way.",
        "Echo taps the surface with one claw. The ice is thicker than Echo is tall.",
        "But your two stars are warm. You lie flat and hold them against the surface, and the ice begins to give.",
        "A hole opens, no bigger than a plate. The green light comes up through it and turns gold in the air.",
        "Three stars now. Pip's hood is getting crowded, and Pip is very clear about it.",
      ],
      hook: "Tomorrow: a house with an attic, and something in the attic that plays music by itself." },

    { id: "musicbox", t: "The Music Box", games: ["tiles", "stack", "feed"],
      open: "The house has been empty a long time. The attic ladder comes down when you pull it, and dust falls on all three of you.",
      beats: [
        "In the corner, under a sheet, something is playing. Six notes, over and over, very slowly.",
        "It is a music box. The lid is shut, and the little brass key on the back is turning all by itself.",
        "Echo lands on the lid and gets carried around in a slow circle, which Echo finds undignified.",
        "You lift the lid. Inside, where the dancer should be, there is a star going round and round.",
        "It has been keeping time in here for years. Nobody ever told it how to stop.",
        "So you learn the six notes and say them back, and on the last one the star steps off the spindle and into your hand.",
      ],
      hook: "Tomorrow: an orchard, and a fruit that is far too heavy for its branch." },

    { id: "orchard", t: "The Orchard", games: ["slice", "feed", "glide"],
      open: "Rows and rows of trees, all the same height, all quiet. Somewhere in the middle, one branch is bent almost to the ground.",
      beats: [
        "On the end of it hangs a fruit the size of your head, and it is glowing faintly through the skin.",
        "Echo tries to eat it. Echo is stopped.",
        "You cut it down carefully. It is warm in your hands, and heavier than a fruit has any business being.",
        "Inside there is a star, curled up, fast asleep. It fell in the spring and the tree simply grew around it.",
        "You wake it the polite way, which is with your voice and not with your hands.",
        "The branch springs straight the moment the fruit leaves it, and every other tree in the row shivers once, in order, all the way down.",
      ],
      hook: "Tomorrow: the sea, and a ferry that only runs for people who ask." },

    { id: "ferry", t: "The Ferry", games: ["stack", "feed", "run"],
      open: "The road ends at the sea. There is a jetty, and a boat, and a very large creature asleep across the whole of it.",
      beats: [
        "It has whiskers like broom handles and it is snoring in a way that moves the water.",
        "Echo suggests going around. There is no around. There is sea in both directions as far as anybody can see.",
        "Pip lands on its nose. One eye opens. The eye is the size of a dinner plate and it looks straight at you.",
        "It is the ferry. It has been the ferry for a very long time, and nobody has asked it for a ride in years.",
        "You share what is left of your food, and you tell it where you are going and why.",
        "It slides off the jetty without a word and floats there, waiting, with its back flat like a raft.",
      ],
      hook: "Tomorrow: the star you are looking for is at the bottom of the sea." },

    { id: "deep", t: "The Deep", games: ["glide", "slice", "tiles"],
      open: "Out where the water goes from green to black, the ferry stops and points its nose straight down.",
      beats: [
        "Far below, so far it might be your eyes making it up, there is one small light.",
        "You cannot swim that deep. Nobody can. But your four stars can, and they will not go without you.",
        "So they make a bubble. Four stars in a ring, warm air between them, and you inside it, going down.",
        "Kelp closes over the top. Fish you have no names for come to look at you, and then leave again.",
        "The light gets bigger. It is shut inside a shell the size of a door.",
        "You say something to the shell, the way you did to the sky door, and it opens without any fuss at all.",
      ],
      hook: "Tomorrow: something has been collecting bright things, and it has been busy." },

    { id: "nest", t: "The Nest", games: ["stack", "feed", "glide"],
      open: "On the cliffs above the beach there is a nest, and the nest is glittering.",
      beats: [
        "Bottle caps. Spoons. A watch. A doorknob. And near the middle, two lights that are none of those things.",
        "Pip goes completely still, the way small birds do when a big bird is somewhere close.",
        "It lands behind you. It is black and enormous and its head tilts all the way over to look at you.",
        "It is not angry. It just likes bright things, and two of the brightest things it ever found were lying in a field.",
        "So you trade. You give it the shiniest thing you are carrying, which is the little brass key off the back of the music box.",
        "It takes the key, and it lets you take the two stars, and it watches you the whole way down the cliff path.",
      ],
      hook: "Tomorrow: you find out why any of them fell in the first place." },

    { id: "thread", t: "The Loose Thread", games: ["tiles", "slice", "run"],
      open: "Seven stars now. They ride in a loose cloud around your head, and you have stopped being able to count them without help.",
      beats: [
        "You are walking back towards the cloud ladder when Echo stops dead in the air.",
        "Hanging down out of the sky, swaying, there is a single silver thread. It goes up further than you can see.",
        "You touch it. It hums the same six notes as the music box, and every star you are carrying hums back.",
        "Echo says the thing you are both thinking. The sky is not a picture. The sky is something somebody made.",
        "And somewhere up there a thread has come loose, and the stars have been slipping through the gap it left.",
        "The thread twitches once, all on its own, as though something at the far end of it just noticed you holding on.",
      ],
      hook: "Tomorrow: you climb the thread, and you find out who is up there." },

    // ── ACT III: THE SKY LOOM (21-30) ────────────────────────────────────
    // The last four stars, the reason, and a finale that hands the shuttle to
    // the child. Chapter 30 closes the season and hooks straight back into
    // chapter 1, so a family that finishes starts a new fall the next morning.
    { id: "climb", t: "Following the Thread", games: ["run", "glide", "tiles"],
      open: "You wrap the thread around your hand and it lifts, gently, the way a kite pulls just before it goes.",
      beats: [
        "The ground drops away. The orchard, then the lake, then the lantern city, all of it going small underneath you.",
        "Pip flies alongside for the first time in the whole journey, which Pip would like noted.",
        "The stars come too, in a long line behind you, like beads on a string.",
        "Above the clouds the thread stops being silver and starts being light, and it is warm to hold.",
        "You go up through the place where the sky door was and out the other side, and there is no other side. There is just more sky.",
        "The thread ends at a stair. A spiral stair with no building around it, going up into the dark.",
      ],
      hook: "Tomorrow: the stair, and what is waiting at the top of it." },

    { id: "stair", t: "The Weaver's Stair", games: ["stack", "run", "glide"],
      open: "The stair is made of the same silver as the thread, and every step gives a little under your weight, like rope.",
      beats: [
        "There is no rail. There is nothing to fall onto either, which Echo points out and immediately regrets pointing out.",
        "You climb. The stars go on ahead and light three steps at a time.",
        "Halfway up, you pass a step with a bird's nest on it. Old, empty, and very carefully made.",
        "Pip looks at that nest for a long moment and does not say anything at all.",
        "The stair narrows near the top, until it is one step wide and you are going up it sideways.",
        "Then the dark opens out, and there is a room, and in the room there is a loom the size of a house.",
      ],
      hook: "Tomorrow: you meet the person who makes the sky." },

    { id: "weaver", t: "The Weaver", games: ["tiles", "feed", "stack"],
      open: "She is very old and very small, and she is sitting at the loom with her hands in her lap, not weaving.",
      beats: [
        "The cloth on the loom is the night sky. You are seeing it from underneath, which nobody has ever done.",
        "She says hello without turning around. She says she wondered when somebody would come.",
        "Echo, for once, has nothing to say. Pip climbs out of your hood and sits on the arm of her chair.",
        "There is a gap in the weave the size of a door. Around it, threads hang loose in every direction.",
        "She has not stopped because she is tired, although she is. She has stopped because she cannot do it on her own any more.",
        "You put your seven stars down on the floor of the room, and the whole place fills up with light.",
      ],
      hook: "Tomorrow: she shows you how the sky is made, and why it needs you." },

    { id: "loom", t: "What the Loom Needs", games: ["tiles", "glide", "slice"],
      open: "She picks up the shuttle and holds it out to you. It is wooden, worn smooth, and lighter than it looks.",
      beats: [
        "She says the loom does not run on hands. It never has.",
        "She sings one note, and a thread pulls itself across the frame and lies down flat.",
        "That is why the stars go warm when you talk to them. That is why the door opened. That is why the cave lit up.",
        "The whole sky is woven out of sound, and it has been quiet up here for a very long time.",
        "Her voice went a while ago. That is the night the thread came loose, and every night since has been a little darker.",
        "She puts the shuttle into your hand and closes your fingers around it, and she does not say anything else.",
      ],
      hook: "Tomorrow: the eighth star, tangled in the loom itself." },

    { id: "tangled", t: "The Eighth Star", games: ["slice", "tiles", "stack"],
      open: "You find the eighth star before you work out how to weave. It is tangled in the loose threads at the edge of the gap.",
      beats: [
        "It has been stuck there since the night it slipped, holding on so it would not fall like the others.",
        "The threads have grown right around it, the way the orchard tree grew around its fruit.",
        "You work it free one strand at a time while it hums the six notes at you, over and over, nervously.",
        "When it comes loose it does not fly off. It stays exactly where it is, because it is already in its own place.",
        "One star back in the sky, and the smallest patch of the dark shape closes up around it.",
        "The Weaver laughs, which is a sound like a door that has not been opened in years.",
      ],
      hook: "Tomorrow: it gets worse before it gets better." },

    { id: "unravel", t: "The Unravelling", games: ["run", "slice", "glide"],
      open: "You wake up to a sound like a zip. Along the far edge of the loom, the weave is coming apart on its own.",
      beats: [
        "Threads are letting go one after another, faster than anybody could tie them back.",
        "Through the widening gap you can see the ground, extremely far away, and none of it is cloud.",
        "Echo goes one way and Pip goes the other and you go straight down the middle, catching threads.",
        "You get six of them in one fist and it is nowhere near enough. There are hundreds.",
        "Then the Weaver says your name, and tells you to stop grabbing and start talking.",
        "So you do. And the threads you speak to stop moving, and hang still, and wait.",
      ],
      hook: "Tomorrow: two more stars, in the darkest part of the sky." },

    { id: "dark", t: "The Two in the Dark", games: ["glide", "tiles", "feed"],
      open: "There is a corner of the sky where three stars fell on the same night, and nothing has ever been put back.",
      beats: [
        "It is the darkest place you have ever stood. Darker than the cave, because in the cave there was rock to touch.",
        "Your stars will not go in. They hang at the edge of it, dimming, like a hand held over a candle.",
        "So you go in without them, with Pip on your shoulder and Echo somewhere just above your head.",
        "You find the first one by sound. It has been humming the whole time, very quietly, for a very long while.",
        "The second one is holding on to the first one and will not let go, so you carry the pair of them together.",
        "Coming out, you count. Two in your arms. One still missing. And no corner of the world left that you have not looked in.",
      ],
      hook: "Tomorrow: the last star, and it is not where anybody looked." },

    { id: "lastone", t: "The Last One", games: ["slice", "feed", "tiles"],
      open: "You look everywhere for the eleventh star. The Weaver studies the sky from underneath. Echo asks every bird between here and the sea.",
      beats: [
        "Nothing. Ten found, one gap left, and not one single idea between the four of you.",
        "Then Pip flies off without telling anybody, which Pip has never once done, and is gone until morning.",
        "Pip comes back with a single blade of grass in its beak. Long, green, and slightly scorched at the tip.",
        "You know that grass. You have sat in that grass. It is the meadow, from the very first night.",
        "The last star never went anywhere at all. It landed where the first one landed, on the same night, and it has been under the grass ever since, waiting for somebody to come back for it.",
        "It is small and it is cold, and when you pick it up it fits in one hand, exactly the way the first one did.",
      ],
      hook: "Tomorrow: the long climb back up, with all of them at once." },

    { id: "backup", t: "The Long Way Back Up", games: ["stack", "glide", "run"],
      open: "Ten stars. You have ten stars and one spiral stair, and the stair is one step wide at the top.",
      beats: [
        "Echo carries two, badly. Pip carries one and will not be talked out of it.",
        "The rest go in your coat, in your hood, and in both hands, and you go up sideways the way you did before.",
        "Halfway, at the step with the old nest on it, you stop to rest and count them all again.",
        "Pip puts its star down in the nest for a moment, just to see how it looks. It looks very good.",
        "Then Pip picks it up again, because it is not Pip's star, and there is a sky waiting for it.",
        "At the top, the Weaver has the loom open and the shuttle ready. She has been up all night clearing the frame.",
      ],
      hook: "Tomorrow: every star goes home at once." },

    { id: "mended", t: "The Sky, Mended", games: ["tiles", "stack", "glide"],
      open: "The gap in the weave is the size of a door, and there are ten stars sitting on the floor of the room waiting to go through it.",
      beats: [
        "The Weaver cannot sing it shut. You already knew that. It is the reason you are the one holding the shuttle.",
        "So you say the first thing that comes into your head, and a thread lies itself flat across the frame.",
        "Then another. Then another. It is slow, and it is not neat, and it holds.",
        "One at a time the stars step up into the weave and find their gaps, and one at a time the dark shapes close.",
        "The last one is the star from the meadow. It waits until the very end. Then it goes up, and the sky is whole.",
        "From underneath, the new patch does not match. It is brighter than the rest, and rougher, and the Weaver says that is how everybody will know that somebody mended it.",
      ],
      hook: "Tomorrow: somewhere a long way off, in a meadow nobody has walked in yet, another star falls out of the sky." },
  ];
  // ── SCENE1: every chapter gets its own world, and Echo acts in it ───────
  // The live review's finding, verbatim: "across five pages the illustration
  // never changes — same Echo, same pose, same starfield; only the text swaps."
  // For a story-first app aimed at 3-8s, most of whom cannot read the words,
  // the text was doing 100% of the storytelling. That is backwards.
  //
  // The cheap fix that buys most of the storybook feeling: one BACKGROUND per
  // chapter and a re-POSED Echo per page. A single character moving over a
  // changing world reads as illustration at a fraction of the art cost, which
  // matters at 30 chapters x 7 pages = 210 pages.
  //
  // Scenes are CSS, not assets: a gradient plus a handful of positioned shapes,
  // the same technique charge.html already uses for its six game skies. Nothing
  // to download, nothing to art-direct per page, and it scales to Season 2 by
  // adding a row.
  const SKY = {
    nightMeadow: "radial-gradient(120% 90% at 50% 8%,#26407e 0%,#152a5c 45%,#0d1b3e 100%)",
    forest:      "linear-gradient(180deg,#1d3b46 0%,#1f4a3d 45%,#16352c 100%)",
    river:       "linear-gradient(180deg,#7ec8e8 0%,#4a9fd0 42%,#2b6ea8 100%)",
    cave:        "radial-gradient(90% 70% at 50% 40%,#1b2d5c 0%,#0e1730 55%,#070b18 100%)",
    highSky:     "linear-gradient(180deg,#8fd0f5 0%,#cfe7f2 45%,#ffe9b8 100%)",
    lantern:     "linear-gradient(180deg,#2a1a3e 0%,#5a3320 55%,#8a4a1e 100%)",
    ice:         "linear-gradient(180deg,#cfe9f7 0%,#9fc9e4 50%,#6fa6c9 100%)",
    attic:       "linear-gradient(180deg,#4a3520 0%,#6b4a2a 50%,#3a2716 100%)",
    orchard:     "linear-gradient(180deg,#bfe4f5 0%,#d9efc9 48%,#8fc46f 100%)",
    sea:         "linear-gradient(180deg,#8fd0f5 0%,#5fb0d8 40%,#2f7fa8 100%)",
    deep:        "linear-gradient(180deg,#12456b 0%,#0a2c4a 45%,#04121f 100%)",
    dusk:        "linear-gradient(180deg,#3f4a8a 0%,#7a5a9a 50%,#b06a8a 100%)",
    loom:        "radial-gradient(100% 80% at 50% 30%,#5b3f8f 0%,#3a2766 50%,#1e1440 100%)",
    dark:        "radial-gradient(80% 60% at 50% 45%,#161a3a 0%,#0a0c1c 60%,#04050c 100%)",
    goldSky:     "linear-gradient(180deg,#3f74ab 0%,#6ea3d4 40%,#ffcf9a 78%,#ffe7c4 100%)",
  };
  // decor primitives — positioned shapes, no assets
  function _c(css) { return '<i style="position:absolute;' + css + '"></i>'; }
  const D = {
    sun:    (t, l, w, c) => _c("top:" + t + ";left:" + l + ";width:" + w + ";aspect-ratio:1;border-radius:50%;background:" + (c || "#ffd21c") + ";box-shadow:0 0 0 14px rgba(255,210,28,.14)"),
    moon:   (t, l, w) => _c("top:" + t + ";left:" + l + ";width:" + w + ";aspect-ratio:1;border-radius:50%;background:#fff4d6;opacity:.9"),
    hill:   (t, l, w, h, c) => _c("top:" + t + ";left:" + l + ";width:" + w + ";height:" + h + ";border-radius:50%;background:" + c),
    cloud:  (t, l, w, o) => _c("top:" + t + ";left:" + l + ";width:" + w + ";height:calc(" + w + " * .34);border-radius:99px;background:#fff;opacity:" + (o || ".7")),
    band:   (b, h, c) => _c("bottom:" + b + ";left:0;right:0;height:" + h + ";background:" + c),
    glow:   (t, l, w, c) => _c("top:" + t + ";left:" + l + ";width:" + w + ";aspect-ratio:1;border-radius:50%;background:radial-gradient(circle," + c + ",transparent 70%)"),
  };
  // sky · stars? · decor · one Echo pose per page (i idle, l listening, c celebrate, s holding-star)
  const CHAPTER_SCENES = {
    star:      { sky: "nightMeadow", stars: 1, poses: "iilslcc", decor: D.hill("74%", "-16%", "70%", "230px", "#1d4a3a") + D.hill("78%", "45%", "80%", "240px", "#173c2f") + D.glow("72%", "38%", "26%", "rgba(255,210,28,.5)") },
    brambles:  { sky: "forest", stars: 0, poses: "ililcli", decor: D.hill("70%", "-20%", "80%", "250px", "#143028") + D.glow("30%", "44%", "18%", "rgba(255,210,28,.35)") },
    river:     { sky: "river", stars: 0, poses: "ilillci", decor: D.sun("8%", "72%", "18%") + D.cloud("14%", "-6%", "40%", ".75") + D.band("0", "34%", "rgba(20,90,150,.35)") },
    woods:     { sky: "forest", stars: 0, poses: "illlici", decor: D.hill("62%", "-24%", "70%", "260px", "#122b23") + D.hill("68%", "50%", "76%", "250px", "#0e241d") },
    pip:       { sky: "forest", stars: 0, poses: "ilclici", decor: D.glow("30%", "30%", "40%", "rgba(255,210,28,.18)") + D.hill("72%", "-18%", "80%", "230px", "#143028") },
    cave:      { sky: "cave", stars: 0, poses: "ilillci", decor: D.glow("34%", "26%", "48%", "rgba(90,170,255,.30)") },
    drawings:  { sky: "cave", stars: 0, poses: "iiillci", decor: D.glow("40%", "18%", "64%", "rgba(90,170,255,.22)") },
    clouds:    { sky: "highSky", stars: 0, poses: "ilclici", decor: D.cloud("22%", "-8%", "46%", ".9") + D.cloud("34%", "56%", "40%", ".8") + D.cloud("52%", "8%", "36%", ".7") },
    ridge:     { sky: "highSky", stars: 0, poses: "illicsi", decor: D.cloud("18%", "-14%", "60%", ".55") + D.cloud("40%", "40%", "58%", ".45") },
    door:      { sky: "nightMeadow", stars: 1, poses: "iillcsc", decor: D.glow("36%", "30%", "42%", "rgba(255,255,255,.20)") },

    comeback:  { sky: "nightMeadow", stars: 1, poses: "scilili", decor: D.glow("28%", "34%", "34%", "rgba(255,210,28,.32)") },
    lanterns:  { sky: "lantern", stars: 1, poses: "ilillci", decor: D.glow("30%", "40%", "30%", "rgba(255,180,80,.42)") + D.band("0", "26%", "rgba(20,10,30,.45)") },
    longnight: { sky: "lantern", stars: 1, poses: "illlicc", decor: D.glow("26%", "34%", "40%", "rgba(255,220,140,.5)") },
    ice:       { sky: "ice", stars: 0, poses: "ilillci", decor: D.band("0", "42%", "rgba(255,255,255,.30)") + D.glow("76%", "36%", "28%", "rgba(120,255,190,.35)") },
    musicbox:  { sky: "attic", stars: 0, poses: "illlici", decor: D.glow("36%", "32%", "34%", "rgba(255,210,28,.28)") },
    orchard:   { sky: "orchard", stars: 0, poses: "ilillci", decor: D.sun("10%", "12%", "16%") + D.hill("70%", "-14%", "66%", "220px", "#6fae52") + D.hill("74%", "48%", "70%", "220px", "#5f9a46") },
    ferry:     { sky: "sea", stars: 0, poses: "ilclici", decor: D.sun("9%", "70%", "15%") + D.band("0", "38%", "rgba(20,90,150,.40)") },
    deep:      { sky: "deep", stars: 0, poses: "illlici", decor: D.glow("26%", "30%", "40%", "rgba(120,220,255,.22)") },
    nest:      { sky: "sea", stars: 0, poses: "ililcii", decor: D.cloud("16%", "-6%", "42%", ".7") + D.hill("66%", "-20%", "60%", "240px", "#8a7a5a") },
    thread:    { sky: "dusk", stars: 1, poses: "iilliccc".slice(0, 7), decor: D.glow("20%", "44%", "18%", "rgba(255,255,255,.35)") },

    climb:     { sky: "goldSky", stars: 0, poses: "iclilic", decor: D.cloud("28%", "-10%", "50%", ".7") + D.cloud("46%", "50%", "44%", ".6") },
    stair:     { sky: "loom", stars: 1, poses: "iiliicc", decor: D.glow("38%", "34%", "34%", "rgba(200,180,255,.22)") },
    weaver:    { sky: "loom", stars: 0, poses: "ilillcs", decor: D.glow("32%", "26%", "48%", "rgba(255,210,28,.20)") },
    loom:      { sky: "loom", stars: 0, poses: "illlicc", decor: D.glow("30%", "30%", "42%", "rgba(255,255,255,.18)") },
    tangled:   { sky: "loom", stars: 1, poses: "ilillcc", decor: D.glow("34%", "36%", "30%", "rgba(255,210,28,.38)") },
    unravel:   { sky: "dark", stars: 1, poses: "licilii", decor: D.glow("78%", "20%", "60%", "rgba(120,90,200,.18)") },
    dark:      { sky: "dark", stars: 0, poses: "iilllci", decor: D.glow("26%", "38%", "24%", "rgba(255,210,28,.16)") },
    lastone:   { sky: "nightMeadow", stars: 1, poses: "iillisc", decor: D.hill("74%", "-16%", "70%", "230px", "#1d4a3a") + D.hill("78%", "45%", "80%", "240px", "#173c2f") + D.glow("76%", "40%", "20%", "rgba(255,210,28,.42)") },
    backup:    { sky: "loom", stars: 1, poses: "iscilic", decor: D.glow("36%", "30%", "38%", "rgba(255,210,28,.26)") },
    mended:    { sky: "nightMeadow", stars: 1, poses: "islcccc", decor: D.glow("26%", "22%", "56%", "rgba(255,210,28,.30)") },
  };
  const POSE_SRC = { i: "idle", l: "listening", c: "celebrate", s: "star" };
  // The scene for a chapter, resolved to real values. Falls back to the night
  // sky the season opened under, so a chapter added without a scene still
  // renders as a story rather than a blank.
  function chapterScene(id) {
    const sc = CHAPTER_SCENES[id] || {};
    return {
      sky: SKY[sc.sky] || SKY.nightMeadow,
      stars: sc.stars !== 0,
      decor: sc.decor || "",
      poses: String(sc.poses || "iiiiiii"),
    };
  }
  // Which Echo pose page n of this chapter wears.
  function chapterPose(id, n) {
    const p = chapterScene(id).poses;
    const k = p.charAt(Math.max(0, Math.min(p.length - 1, n | 0))) || "i";
    return "/coach/echo/echo-" + (POSE_SRC[k] || "idle") + ".svg";
  }

  const EPKEY = "sona.episode.v2";        // v2: Season 1 replaced the 8-chapter loop
  function _ep() { const v = load(EPKEY, {}); return { i: (v.i | 0) || 0, day: v.day || "" }; }
  function episodeNum() { return (_ep().i % EPISODES.length) + 1; }        // 1-based, for "Chapter N"
  function episode() { return EPISODES[_ep().i % EPISODES.length]; }
  // The beat shown before round `r` (0-based). Round 0 gets the opening.
  function episodeBeat(r) {
    const e = episode(); const n = r | 0;
    if (n <= 0) return e.open;
    return e.beats[Math.min(n, e.beats.length) - 1] || e.beats[e.beats.length - 1];
  }
  function episodeHook() { return episode().hook; }
  // Advance ONE episode per finished day — never twice for the same local day,
  // so a replayed or refreshed run can't skip a chapter.
  function episodeAdvance() {
    const v = _ep(); const t = today();
    if (v.day === t) return episode();
    save(EPKEY, { i: (v.i + 1) % EPISODES.length, day: t });
    return episode();
  }

  // ── DAY1: the day's shape — one story, then three games ─────────────────
  // The home screen is a gate, not a menu. Today's chapter is the front door;
  // finishing it unlocks three games, and tomorrow both are different. Two
  // reasons this beats a static deck of six:
  //   1. a kid who can pick anything picks the same thing every day, and the
  //      sound that needs work is never the fun one
  //   2. "what do I get tomorrow?" is the only retention mechanic that costs
  //      no content — the same six games feel new in a different trio
  // The trio is no longer drawn at random: each chapter names its own three
  // (see EPISODES above), so the games are the next thing that happens in the
  // story rather than an interruption to it.
  const DAYKEY = "sona.day.v2";           // v2 with EPKEY: today re-pins against the new season
  function _day() { const v = load(DAYKEY, {}); return (v && v.date === today()) ? v : null; }
  // Today's chapter, PINNED on first look. Without the pin, reading it would
  // advance the pointer and the card would flip to tomorrow's story while the
  // kid was still on today's screen.
  function dailyStory() {
    const d = _day();
    if (d && typeof d.ep === "number") return EPISODES[d.ep % EPISODES.length];
    const i = _ep().i % EPISODES.length;
    save(DAYKEY, { date: today(), ep: i, read: false });
    return EPISODES[i];
  }
  function dailyChapterNum() { const d = _day(); return ((d && typeof d.ep === "number" ? d.ep : _ep().i) % EPISODES.length) + 1; }
  function storyRead() { const d = _day(); return !!(d && d.read); }
  function markStoryRead() {
    dailyStory();                                   // ensure the day is pinned
    const d = load(DAYKEY, {}); d.read = true; save(DAYKEY, d);
    try { episodeAdvance(); } catch (e) {}          // day-guarded: sets up tomorrow
    return true;
  }
  // The three games offered today: TODAY'S CHAPTER'S three. Stable across
  // refreshes and across a parent and child looking at the same phone, because
  // the chapter is pinned for the day — so "did I already play today's set?"
  // has one answer, and the answer never changes underneath a child.
  // Short on purpose (Travis, 1 Oct 2026: "make this much more concise"; 2
  // Oct 2026: "still too long ... just say audio is never recorded or
  // uploaded"). Two things, both true: nothing is uploaded, and the one try a
  // day kept on the phone for a parent to play back. Not "never recorded":
  // that one try IS recorded, on the phone, and a consent line must not deny
  // it (mictest). The privacy page and /support keep the long version.
  const MIC_PROMISE = "Grown-ups: audio is never uploaded. One try a day is saved on this phone so you can listen back.";
  // Rachel-approved play recommendation. Every game remains available by choice.
  function playStyle() {
    var age = Number(getProfile().childAge);
    return age >= 2 && age < 5 && Math.floor(age) === age ? "simple" : "arcade";
  }
  const DAILY_GAMES = 3;
  function dailyGames() {
    const ep = dailyStory();
    const named = (ep && ep.games) || [];
    const trio = [];
    for (let i = 0; i < named.length && trio.length < DAILY_GAMES; i++) {
      if (GAME_KEYS.indexOf(named[i]) >= 0 && trio.indexOf(named[i]) === -1) trio.push(named[i]);
    }
    // A chapter with a short or misspelled trio still has to hand a kid three
    // playable things. Topping up from the deck beats rendering two cards.
    for (let i = 0; trio.length < DAILY_GAMES && i < GAME_KEYS.length; i++) {
      if (trio.indexOf(GAME_KEYS[i]) === -1) trio.push(GAME_KEYS[i]);
    }
    if (playStyle() === "simple") return ["feed", "bubbles", "peekaboo"].filter(function (key) { return gameAccess(key).allowed; });

    return trio;
  }

  // ── today's rep count (RING1): every honest VAD-counted rep ticks a
  // positive-only daily number the kid watches CLIMB (a kid does 40-60 real
  // reps a day — "47" beats "0/5"). Local-day keyed; silence never counts
  // because only the charge engine's counted bursts call bumpReps.
  const REPSKEY = "sona.reps.v1";
  function bumpReps(n) {
    n = Math.max(0, parseInt(n, 10) || 0); if (!n) return repsToday();
    const t = today(); const r = load(REPSKEY, {});
    const v = ((r.d === t ? r.n : 0) || 0) + n;
    save(REPSKEY, { d: t, n: v }); return v;
  }
  function repsToday() { const r = load(REPSKEY, {}); return (r.d === today() ? r.n : 0) || 0; }

  // ── METER1: the jar a kid is filling ───────────────────────────────────
  // A number that climbs is honest but abstract; a container visibly filling
  // is the thing a five-year-old actually chases. It fills on REPS, which are
  // VAD-counted, so the meter can only move when a child actually speaks —
  // a bar that creeps up on a timer would teach exactly the wrong lesson.
  const REP_GOAL_DEFAULT = 30;
  function repGoal() {
    // An assignment's daily target outranks the family's own — the clinician
    // set it, and the jar the child is filling should be the one they set.
    const hw = homework();
    if (hw && hw.repsPerDay > 0) return hw.repsPerDay;
    const p = getProfile(), g = parseInt(p.dailyGoal, 10) || 0;
    // One default for every age (Travis, 5 Oct 2026: "we'll just set the
    // default to thirty reps per day. Right now it's set to fifty", which it
    // was for ages 5 and up). So three days a week is a 90-rep week. A number a
    // grown-up picked in Settings is kept.
    return g > 0 ? g : REP_GOAL_DEFAULT;
  }
  function goalState() {
    const n = repsToday(), goal = repGoal();
    return { n, goal, pct: Math.max(0, Math.min(1, n / goal)), full: n >= goal };
  }

  // ── COIN1, now COIN3: the meter resets each night, coins are spent ─────
  // Different jobs. The meter answers "am I done today?"; trophies (TROPHY1)
  // answer "what did all those days add up to?", and they follow the honest
  // rep. Coins are what a child spends (11 Oct 2026, D2): they may come only
  // from the daily chest on a day the goal is met and from Trophy Road gifts,
  // never from time in the app, opening things, a finished story or an arcade
  // score, and never from a purchase. Reps used to mint them here (one coin per
  // 5, plus 5 for the daily chapter, ledger "sona.coinmint.v1"); that mint is
  // retired, and a balance already earned is kept. mintCoins() and
  // mintStoryBonus() stay for cached pages, and only read the balance.
  const MYSTERY_COST = 15;                   // the 4th game, bought for a day
  function mintCoins() { return coinsNow(); }
  function mintStoryBonus() { return coinsNow(); }
  // The mystery game: one extra game for today, drawn from the ones NOT in
  // today's trio. Deliberately ADDITIVE — it never opens the whole deck. It
  // used to wait on today's story being read; that gate went with the books
  // (GAMES1, 19 Sep 2026). Coins come only from what practice earns (COIN3),
  // so a purchase is still practice-backed.
  function mysteryCost() { return MYSTERY_COST; }
  function mysteryGame() {
    const d = _day();
    if (d && d.mystery) return d.mystery;
    return null;
  }
  // The mystery door is a PREMIUM door (24 Sep 2026): the free version is
  // practice plus its free games, and a fourth game a day is exactly what
  // Premium adds. Coins are earned by practice for everyone (COIN3) — they
  // are practice made visible, not a currency the paywall owns — so a family
  // who upgrades later finds their jar already full.
  function canBuyMystery() {
    if (!isFree() && !premium()) return false;
    return !mysteryGame() && getCoins() >= MYSTERY_COST && GAME_KEYS.some(function (key) {
      return dailyGames().indexOf(key) < 0 && gameAccess(key).allowed;
    });
  }
  function buyMystery() {
    if (!canBuyMystery()) return null;
    const trio = dailyGames();
    const rest = GAME_KEYS.filter((k) => trio.indexOf(k) === -1 && gameAccess(k).allowed);
    if (!rest.length) return null;
    if (!spendCoins(MYSTERY_COST)) return null;
    const pick = dailyPick(rest, 1, 31)[0] || rest[0];
    dailyStory();                                          // ensure the day exists
    const day = load(DAYKEY, {}); day.mystery = pick; save(DAYKEY, day);
    return pick;
  }

  // ── the Practice Path: every finished round = one step on one lifelong
  // trail; a gate celebrates every PATH_DISTRICT steps (purely a milestone —
  // nothing about practice ever locks behind it). Families from before the
  // path get one step per practiced day, so nobody restarts at zero.
  const PATH_DISTRICT = 15;
  function pathState() {
    const g = getProgress();
    let steps = (g.totals && g.totals.rounds) || 0;
    const credit = Object.keys(g.practiceDays || {}).length;
    if (credit > steps) { steps = credit; try { g.totals.rounds = credit; save(GKEY, g); } catch (e) {} }
    const into = steps % PATH_DISTRICT;
    return { steps, district: Math.floor(steps / PATH_DISTRICT), into, toGate: PATH_DISTRICT - into, gateEvery: PATH_DISTRICT };
  }

  // ── in-game sound-shape helpers (same calibration as charge.html's gate).
  // Games use these so "say RRRR to keep playing" actually requires an R-ish
  // sound — a hiss or a scream won't revive. Frequency NUMBERS only, computed
  // on-device from the live analyser: nothing is recorded or uploaded, and
  // revives are never logged as practice data.
  const SHAPE_FAM = { hiss: { S:1, Z:1, SH:1, CH:1, J:1, F:1, TH:1 }, low: { R:1, L:1, M:1, N:1, B:1, D:1, G:1, V:1, THV:1 } };
  function soundFamily(s) { s = String(s || "").toUpperCase(); return SHAPE_FAM.hiss[s] ? "hiss" : (SHAPE_FAM.low[s] ? "low" : "any"); }
  const SHAPE_LUT = (() => { const t = []; for (let i = 0; i < 256; i++) t.push(Math.pow(10, (-100 + i * 70 / 255) / 20)); return t; })();
  // One analyser frequency frame → raw magnitude sums {m, fm, hm} for
  // accumulating an energy-weighted centroid + high-band ratio across a burst.
  function frameShape(fd, binHz) {
    const lo = Math.max(1, Math.round(90 / binHz)), hi = Math.min(fd.length - 1, Math.round(12000 / binHz)), h0 = Math.round(3500 / binHz);
    let m = 0, fm = 0, hm = 0;
    for (let i = lo; i <= hi; i++) { const v = SHAPE_LUT[fd[i]]; m += v; fm += v * i * binHz; if (i >= h0) hm += v; }
    return m > 0 ? { m, fm, hm } : null;
  }

  // Practice items for a (sound, rung), wired to the existing content sources.
  // isolation/syllable score as "phoneme" (lenient); word+ score "full". Degrades
  // gracefully to words if SonaContent (gamecontent.js) isn't loaded on a page.
  function ladderContent(sound, rung) {
    const SC = (typeof window !== "undefined") ? window.SonaContent : null;
    const lvl = LADDER[Math.max(0, Math.min(LADDER.length - 1, rung || 0))];
    // The word step asks for the position being practised: homework's, then
    // the family's setting (practicePos). It passed no position and so always
    // asked for start-of-word words, whatever Settings or the SLP said (Travis,
    // 30 Sep 2026: the position must actually drive the practice page). A
    // position with no words for this sound falls back to start-of-word ones
    // inside wordsFor. The games keep start-of-word words on purpose and call
    // wordsFor(sound, "i") themselves.
    const ws = () => wordsFor(sound, practicePos()) || [];
    if (lvl === "isolation") return [{ t: soundSay(sound), say: soundSay(sound), display: soundLabel(sound), level: "isolation", mode: "phoneme" }];
    if (lvl === "syllable") return (SC && SC.syllables ? SC.syllables(sound) : []).map((s) => ({ t: s.t, say: s.say, display: s.t, level: "syllable", mode: "phoneme" }));
    if (lvl === "word") return ws().map((w) => ({ t: w.w, say: w.w, display: w.w, e: w.e, word: w.w, level: "word", mode: "full" }));
    if (lvl === "sentence") return (SC && SC.sentences ? SC.sentences(sound) : ws().map((w) => ({ t: w.w, say: w.w, e: w.e, word: w.w }))).map((s) => ({ t: s.t, say: s.say, display: s.t, e: s.e, word: s.word, level: "sentence", mode: "full" }));
    if (lvl === "conversation") return (SC && SC.chats ? SC.chats(sound) : []).map((c) => ({ q: c.q, options: c.options, level: "conversation", mode: "full" }));
    return [];
  }

  // ── GAMEASK1: what a round game's say-it card asks for (Travis, 1 Oct
  // 2026: "we need to add back the increase of complexity to the sounds in
  // the games and start with isolation then ree rah roh then rot. and maybe
  // have that be something to update in settings") ──
  // The card between rounds always said the bare sound. It now climbs: the
  // sound alone ("rrrr"), then ONE syllable a card ("ree"; a different one
  // each calendar day, never three in a breath), then a short word ("rot").
  // This is the one reader every round game calls, and the Settings picker
  // paints its grey line from it, so neither can promise an ask the other
  // won't make.
  //
  // gameAsk(sound, card): card 0 is the bare sound (Echo's power button, and
  // where a card steps back to); 1 and 2 are the two cards between rounds.
  // The step asked is min(top, floor + card):
  //   top   — the grown-up's pick in Settings (profile.gameLevel), else one
  //           step past what the child has EARNED on the practice page, the
  //           practice page's own rule. A pick wins both ways.
  //   floor — the step the "Say it 5 times" page ended on this sitting
  //           (charge.html hands it over), so a card never asks below what
  //           the child was just asked; its own syllable or word is reused.
  // For a child aged 2 to 4, and while Echo's voice is off, the step is 0
  // whatever top and floor say (gameHold): those cards keep the bare sound.
  // Otherwise it is lowered to what can really be asked: a sound whose syllables nobody
  // has listened to yet (SonaContent.GAME_SYL_ON) stays on the bare sound,
  // as does a page without gamecontent.js; and when the position being
  // practised is not the start of a word (an SLP's end-of-word or "er, ar,
  // or" homework) there is no syllable step, because "ree" is a start-of-word
  // R, a different target from the one the therapist set: the sound, then one
  // of the homework's own words if it names any.
  //
  // HONEST LIMITS. A card hears only "a voice of the right kind": it cannot
  // tell "ree" from "rrrr" or "rot", so harder here means what Echo ASKS,
  // never what is checked, and Echo never says "correct". And it only READS:
  // nothing said in a game moves the earned level (recordRung is the practice
  // page's alone), and a heard card stays one game rep, never practice data.
  // Which syllables, which word, the pace, and the computer voice modelling
  // them are Rachel's calls (CLAUDE.md, "Games ask for more than the sound").
  const GAME_LEVELS = ["isolation", "syllable", "word"];
  function _gameContent() { return (typeof window !== "undefined" && window.SonaContent) || null; }
  // WHAT HOLDS A SOUND'S CARDS TO THE BARE SOUND, whatever was earned or
  // picked. One answer, read by the cards (through _gameWant and _gameItem)
  // and by the Settings line, which says the reason in words, so the two can
  // never disagree:
  //   "little"   — a child aged 2 to 4. Their Home still shows the round
  //                games (Fruit Slice is free and open to a four-year-old),
  //                and Settings hides the picker for that age, so their cards
  //                ask the bare sound exactly as before, whatever a pick saved
  //                at an older age says. Whether little ones should ever be
  //                asked a syllable is Rachel's call.
  //   "muted"    — Echo's voice is off in Sona. Only his voice can model a
  //                syllable or a word; nothing past the bare sound is recorded.
  //   "sound"    — this sound's syllables are not switched on yet (or the
  //                page has no gamecontent.js).
  //   "position" — the position being practised is not the start of a word.
  //   ""         — nothing does.
  function gameHold(sound) {
    sound = String(sound || "").toUpperCase();
    try { if (playStyle() === "simple") return "little"; } catch (e) {}
    try { const p = getProfile(); if (p.voiceOn === false || Number(p.volume) === 0) return "muted"; } catch (e) {}
    const SC = _gameContent();
    if (!(SC && SC.gameSyllables && SC.gameSyllables(sound).length)) return "sound";
    if (practicePos() !== "i") return "position";
    return "";
  }
  // The ceiling asked for, before the sound's own limits.
  function _gameWant(sound) {
    const hold = gameHold(sound);
    if (hold === "little" || hold === "muted") return 0;
    let pick = ""; try { pick = getProfile().gameLevel || ""; } catch (e) {}
    const i = GAME_LEVELS.indexOf(pick);
    return i >= 0 ? i : Math.min(2, rungOf(sound) + 1);
  }
  // What the practice page ended on this sitting, if it was this sound.
  function _gameHand(sound) {
    try {
      if (String(sessionStorage.getItem("sona.boost.sound") || "").toUpperCase() !== sound) return null;
      const lvl = LADDER.indexOf(sessionStorage.getItem("sona.boost.level") || "");
      if (lvl < 0) return null;
      return { rung: Math.min(2, lvl), ask: String(sessionStorage.getItem("sona.boost.ask") || "").toLowerCase().trim() };
    } catch (e) { return null; }
  }
  function _gameItem(sound, want, card, hand) {
    const SC = _gameContent(), bare = soundSay(sound);
    const syls = SC && SC.gameSyllables ? SC.gameSyllables(sound) : [];
    let rung = 0, text = bare;
    if (syls.length && want > 0) {
      const start = practicePos() === "i", hw = homeworkWords(sound);
      if (want >= 2) {
        // the practice page's own word, then the homework's, then the short word
        if (hand && hand.rung === 2 && (WORDS[sound] || []).some((w) => String(w.w).toLowerCase() === hand.ask)) text = hand.ask;
        else if (hw.length) text = String(hw[(dayNum() + card) % hw.length].w).toLowerCase();
        else if (start && SC.gameWord) text = SC.gameWord(sound) || "";
        else text = "";
        if (text) rung = 2; else text = bare;
      }
      if (!rung && start) {
        // the practice page's own syllable if it just asked one of this
        // sound's (never one the skip list holds back); else today's
        const skip = (SC.GAME_SKIP || {})[sound] || [];
        const own = hand && hand.rung === 1 && skip.indexOf(hand.ask) < 0 && SC.syllables(sound).some((s) => s.t === hand.ask);
        text = own ? hand.ask : syls[(dayNum() + Math.max(1, card) - 1) % syls.length].t;
        rung = 1;
      }
    }
    return {
      rung: rung, level: GAME_LEVELS[rung], text: text, html: soundMark(text, sound),
      // how Echo models it: the bare sound is Rachel's recording; a syllable
      // or word is one line in his own voice, which the page must fall back
      // from (to card 0) the moment it cannot play
      clip: rung ? "" : "/coach/say-echo/" + sound + "-sound.wav", say: rung ? text : "",
    };
  }
  // The highest step this sound's cards can reach today: 0, 1 or 2.
  function gameTop(sound) {
    sound = String(sound || "").toUpperCase();
    return _gameItem(sound, _gameWant(sound), 2, null).rung;
  }
  // opts.first: as on the first game of a day, ignoring the practice page's
  // hand-over (Settings paints its line with it).
  function gameAsk(sound, card, opts) {
    sound = String(sound || "").toUpperCase();
    card = Math.max(0, Math.min(2, parseInt(card, 10) || 0));
    const hand = (opts && opts.first) ? null : _gameHand(sound);
    const want = card ? Math.min(_gameWant(sound), (hand ? hand.rung : 0) + card) : 0;
    return _gameItem(sound, want, card, hand);
  }

  // ── the week, narrated ────────────────────────────────────────────────
  // The Sound Story: a plain-language read of the week from REAL practice
  // data — days practiced, reps out loud, and honest-scoring movement on the
  // rotating sound. It used to also report Sound Check grade changes; the
  // Sound Check is gone, and a weekly AI evaluation was never what made this
  // card useful to a parent. Unofficial by design: a practice snapshot to
  // share with an SLP, never an evaluation or a diagnosis.
  function soundStory() {
    const w = weekWins(); const mw = momWeek();
    const name = getProfile().childName || "Your kid";
    const bits = [];
    // A day of practice is a practice-page day; sounds said in games are reps
    // without one (Feed Echo and Hoops open straight from Home), so a week
    // whose reps all came from games says so instead of "practiced 0 days ...
    // 7 reps".
    if (w.reps > 0 && weekReps(0, null, true) === 0) bits.push(name + " said the practice sound out loud " + w.reps + (w.reps === 1 ? " time" : " times") + " in games and books this week.");
    else bits.push(name + " practiced " + mw.done + (mw.done === 1 ? " day" : " days") + " this week" + (w.reps > 0 ? " — " + w.reps + (w.reps === 1 ? " rep" : " reps") + ", each one said out loud." : "."));
    if (w.acc != null && w.accPrev != null && w.acc !== w.accPrev) bits.push("The " + w.label + " sound moved " + w.accPrev + "% → " + w.acc + "% on honest scoring.");
    bits.push("At this stage, lots of honest tries beat perfect tries — steady practice is exactly how sounds get built.");
    return bits;
  }

  // ── the daily variety engine ──
  // Sessions are assembled from rotating ingredients seeded by the date, so
  // every day feels different without hand-authoring a 30-day curriculum:
  // a theme of the day + a daily pick from each sound's word pool.
  const THEMES = [
    { e: "🐾", n: "Animal Day" }, { e: "🚀", n: "Space Day" }, { e: "🍎", n: "Snack Day" },
    { e: "🌈", n: "Color Day" }, { e: "🦸", n: "Hero Day" }, { e: "🎵", n: "Music Day" }, { e: "🤪", n: "Silly Day" },
  ];
  function dayNum() { const d = new Date(); return d.getFullYear() * 366 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
  function dayTheme() { return THEMES[dayNum() % THEMES.length]; }
  // deterministic per-day shuffle-and-take (salt keeps picks different per sound)
  function dailyPick(arr, n, salt) {
    let seed = (dayNum() * 9301 + (salt || 0)) | 0;
    const rand = function () { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    return a.slice(0, Math.min(n, a.length));
  }

  // Word pools per sound (beginning / middle / end positions) — the lesson
  // picks a few per day; the Library's Word Box shows them all.
  // Each word: { w, e, i? }. `i:1` = the word STARTS with the sound (initial
  // position) — only those are used in the "find pictures that start with X"
  // game. Untagged words still contain the sound (medial/final) and are kept
  // for "say it" practice, where hearing R in car/star is clinically useful.
  // Each word: { w, e, pos }. pos = where the target sound sits, so SLPs can
  // target a specific level of the hierarchy: "i" initial · "m" medial · "f" final
  // · "v" vocalic R (the most common, stubborn R error) · "b" blends/clusters.
  // (`i:1` kept on initial words for backward-compat.)
  const WORDS = {
    R: [
      { w: "rabbit", e: "🐰", i: 1, pos: "i" }, { w: "rocket", e: "🚀", i: 1, pos: "i" }, { w: "ring", e: "💍", i: 1, pos: "i" }, { w: "rain", e: "🌧️", i: 1, pos: "i" }, { w: "robot", e: "🤖", i: 1, pos: "i" }, { w: "rose", e: "🌹", i: 1, pos: "i" }, { w: "rock", e: "🪨", i: 1, pos: "i" },
      { w: "carrot", e: "🥕", pos: "m" }, { w: "arrow", e: "🏹", pos: "m" }, { w: "parrot", e: "🦜", pos: "m" }, { w: "kangaroo", e: "🦘", pos: "m" }, { w: "zero", e: "0️⃣", pos: "m" },
      { w: "car", e: "🚗", pos: "f" }, { w: "star", e: "⭐", pos: "f" }, { w: "door", e: "🚪", pos: "f" }, { w: "four", e: "4️⃣", pos: "f" }, { w: "bear", e: "🐻", pos: "f" },
      { w: "bird", e: "🐦", pos: "v" }, { w: "girl", e: "👧", pos: "v" }, { w: "shark", e: "🦈", pos: "v" }, { w: "fork", e: "🍴", pos: "v" }, { w: "corn", e: "🌽", pos: "v" }, { w: "chair", e: "🪑", pos: "v" }, { w: "ear", e: "👂", pos: "v" }, { w: "water", e: "💧", pos: "v" }, { w: "tiger", e: "🐯", pos: "v" },
      { w: "tree", e: "🌳", pos: "b" }, { w: "frog", e: "🐸", pos: "b" }, { w: "drum", e: "🥁", pos: "b" }, { w: "crab", e: "🦀", pos: "b" }, { w: "grapes", e: "🍇", pos: "b" }, { w: "train", e: "🚂", pos: "b" }, { w: "dragon", e: "🐉", pos: "b" }
    ],
    S: [
      { w: "sun", e: "☀️", i: 1, pos: "i" }, { w: "soap", e: "🧼", i: 1, pos: "i" }, { w: "sock", e: "🧦", i: 1, pos: "i" }, { w: "soup", e: "🍲", i: 1, pos: "i" }, { w: "seal", e: "🦭", i: 1, pos: "i" }, { w: "sandwich", e: "🥪", i: 1, pos: "i" }, { w: "sand", e: "🏖️", i: 1, pos: "i" },
      { w: "pencil", e: "✏️", pos: "m" }, { w: "bicycle", e: "🚲", pos: "m" }, { w: "dinosaur", e: "🦕", pos: "m" }, { w: "castle", e: "🏰", pos: "m" },
      { w: "bus", e: "🚌", pos: "f" }, { w: "house", e: "🏠", pos: "f" }, { w: "glass", e: "🥛", pos: "f" }, { w: "dress", e: "👗", pos: "f" }, { w: "ice", e: "🧊", pos: "f" }, { w: "mouse", e: "🐭", pos: "f" },
      { w: "star", e: "⭐", pos: "b" }, { w: "spoon", e: "🥄", pos: "b" }, { w: "snake", e: "🐍", pos: "b" }, { w: "school", e: "🏫", pos: "b" }, { w: "smile", e: "😄", pos: "b" }, { w: "spider", e: "🕷️", pos: "b" }, { w: "stop", e: "🛑", pos: "b" }
    ],
    L: [
      { w: "lion", e: "🦁", i: 1, pos: "i" }, { w: "leaf", e: "🍃", i: 1, pos: "i" }, { w: "lemon", e: "🍋", i: 1, pos: "i" }, { w: "ladder", e: "🪜", i: 1, pos: "i" }, { w: "lamp", e: "💡", i: 1, pos: "i" }, { w: "lollipop", e: "🍭", i: 1, pos: "i" }, { w: "lock", e: "🔒", i: 1, pos: "i" },
      { w: "balloon", e: "🎈", pos: "m" }, { w: "yellow", e: "💛", pos: "m" }, { w: "pillow", e: "🛏️", pos: "m" }, { w: "koala", e: "🐨", pos: "m" }, { w: "color", e: "🎨", pos: "m" },
      { w: "ball", e: "⚽", pos: "f" }, { w: "bell", e: "🔔", pos: "f" }, { w: "owl", e: "🦉", pos: "f" }, { w: "snail", e: "🐌", pos: "f" }, { w: "whale", e: "🐳", pos: "f" }, { w: "doll", e: "🪆", pos: "f" },
      { w: "clock", e: "🕐", pos: "b" }, { w: "flag", e: "🚩", pos: "b" }, { w: "glove", e: "🧤", pos: "b" }, { w: "plate", e: "🍽️", pos: "b" }, { w: "sled", e: "🛷", pos: "b" }, { w: "blocks", e: "🧱", pos: "b" }, { w: "plane", e: "✈️", pos: "b" }
    ],
    K: [
      { w: "cat", e: "🐱", i: 1, pos: "i" }, { w: "key", e: "🔑", i: 1, pos: "i" }, { w: "cake", e: "🍰", i: 1, pos: "i" }, { w: "kite", e: "🪁", i: 1, pos: "i" }, { w: "king", e: "👑", i: 1, pos: "i" }, { w: "cow", e: "🐮", i: 1, pos: "i" }, { w: "cookie", e: "🍪", i: 1, pos: "i" },
      { w: "monkey", e: "🐵", pos: "m" }, { w: "bucket", e: "🪣", pos: "m" }, { w: "pumpkin", e: "🎃", pos: "m" }, { w: "jacket", e: "🧥", pos: "m" }, { w: "rocket", e: "🚀", pos: "m" },
      { w: "book", e: "📖", pos: "f" }, { w: "duck", e: "🦆", pos: "f" }, { w: "sock", e: "🧦", pos: "f" }, { w: "truck", e: "🚚", pos: "f" }, { w: "cake", e: "🍰", pos: "f" }, { w: "milk", e: "🥛", pos: "f" }
    ],
    G: [
      { w: "goat", e: "🐐", i: 1, pos: "i" }, { w: "girl", e: "👧", i: 1, pos: "i" }, { w: "gift", e: "🎁", i: 1, pos: "i" }, { w: "game", e: "🎮", i: 1, pos: "i" }, { w: "guitar", e: "🎸", i: 1, pos: "i" }, { w: "goose", e: "🪿", i: 1, pos: "i" }, { w: "gate", e: "🚪", i: 1, pos: "i" },
      { w: "wagon", e: "🛒", pos: "m" }, { w: "tiger", e: "🐯", pos: "m" }, { w: "dragon", e: "🐉", pos: "m" }, { w: "magnet", e: "🧲", pos: "m" }, { w: "finger", e: "☝️", pos: "m" },
      { w: "dog", e: "🐶", pos: "f" }, { w: "frog", e: "🐸", pos: "f" }, { w: "pig", e: "🐷", pos: "f" }, { w: "bug", e: "🐛", pos: "f" }, { w: "egg", e: "🥚", pos: "f" }, { w: "bag", e: "🎒", pos: "f" }, { w: "leg", e: "🦵", pos: "f" }
    ],
    F: [
      { w: "fish", e: "🐟", i: 1, pos: "i" }, { w: "fox", e: "🦊", i: 1, pos: "i" }, { w: "fan", e: "🪭", i: 1, pos: "i" }, { w: "fire", e: "🔥", i: 1, pos: "i" }, { w: "foot", e: "🦶", i: 1, pos: "i" }, { w: "fork", e: "🍴", i: 1, pos: "i" }, { w: "farm", e: "🚜", i: 1, pos: "i" },
      { w: "elephant", e: "🐘", pos: "m" }, { w: "telephone", e: "☎️", pos: "m" }, { w: "muffin", e: "🧁", pos: "m" }, { w: "sofa", e: "🛋️", pos: "m" }, { w: "coffee", e: "☕", pos: "m" },
      { w: "leaf", e: "🍃", pos: "f" }, { w: "knife", e: "🔪", pos: "f" }, { w: "wolf", e: "🐺", pos: "f" }, { w: "roof", e: "🏠", pos: "f" }, { w: "scarf", e: "🧣", pos: "f" }, { w: "giraffe", e: "🦒", pos: "f" }
    ],
    SH: [
      { w: "shoe", e: "👟", i: 1, pos: "i" }, { w: "ship", e: "🚢", i: 1, pos: "i" }, { w: "shark", e: "🦈", i: 1, pos: "i" }, { w: "sheep", e: "🐑", i: 1, pos: "i" }, { w: "shell", e: "🐚", i: 1, pos: "i" }, { w: "shirt", e: "👕", i: 1, pos: "i" }, { w: "shower", e: "🚿", i: 1, pos: "i" },
      { w: "ocean", e: "🌊", pos: "m" }, { w: "dishes", e: "🍽️", pos: "m" }, { w: "washing", e: "🧺", pos: "m" }, { w: "tissue", e: "🤧", pos: "m" },
      { w: "fish", e: "🐟", pos: "f" }, { w: "brush", e: "🪥", pos: "f" }, { w: "dish", e: "🍽️", pos: "f" }, { w: "wash", e: "🧼", pos: "f" }, { w: "leash", e: "🐕", pos: "f" }, { w: "trash", e: "🗑️", pos: "f" }
    ],
    CH: [
      { w: "cheese", e: "🧀", i: 1, pos: "i" }, { w: "chair", e: "🪑", i: 1, pos: "i" }, { w: "cherry", e: "🍒", i: 1, pos: "i" }, { w: "chicken", e: "🐔", i: 1, pos: "i" }, { w: "chocolate", e: "🍫", i: 1, pos: "i" }, { w: "chips", e: "🍟", i: 1, pos: "i" },
      { w: "teacher", e: "🧑‍🏫", pos: "m" }, { w: "kitchen", e: "🍳", pos: "m" }, { w: "sandwich", e: "🥪", pos: "m" }, { w: "ketchup", e: "🍅", pos: "m" },
      { w: "beach", e: "🏖️", pos: "f" }, { w: "peach", e: "🍑", pos: "f" }, { w: "watch", e: "⌚", pos: "f" }, { w: "lunch", e: "🥪", pos: "f" }, { w: "branch", e: "🌿", pos: "f" }, { w: "couch", e: "🛋️", pos: "f" }
    ],
    TH: [
      { w: "thumb", e: "👍", i: 1, pos: "i" }, { w: "three", e: "3️⃣", i: 1, pos: "i" }, { w: "thread", e: "🧵", i: 1, pos: "i" }, { w: "think", e: "💭", i: 1, pos: "i" }, { w: "thirty", e: "🔢", i: 1, pos: "i" }, { w: "thorn", e: "🌹", i: 1, pos: "i" },
      { w: "toothbrush", e: "🪥", pos: "m" }, { w: "birthday", e: "🎂", pos: "m" }, { w: "bathtub", e: "🛁", pos: "m" },
      { w: "bath", e: "🛁", pos: "f" }, { w: "tooth", e: "🦷", pos: "f" }, { w: "mouth", e: "👄", pos: "f" }, { w: "math", e: "➗", pos: "f" }, { w: "moth", e: "🦋", pos: "f" }, { w: "teeth", e: "🦷", pos: "f" }
    ],
    P: [
      { w: "pig", e: "🐷", i: 1, pos: "i" }, { w: "pizza", e: "🍕", i: 1, pos: "i" }, { w: "pen", e: "🖊️", i: 1, pos: "i" }, { w: "paint", e: "🎨", i: 1, pos: "i" }, { w: "pumpkin", e: "🎃", i: 1, pos: "i" }, { w: "pie", e: "🥧", i: 1, pos: "i" }, { w: "pan", e: "🍳", i: 1, pos: "i" },
      { w: "apple", e: "🍎", pos: "m" }, { w: "puppy", e: "🐶", pos: "m" }, { w: "happy", e: "😊", pos: "m" }, { w: "zipper", e: "🤐", pos: "m" }, { w: "paper", e: "📄", pos: "m" },
      { w: "cup", e: "☕", pos: "f" }, { w: "map", e: "🗺️", pos: "f" }, { w: "soap", e: "🧼", pos: "f" }, { w: "sheep", e: "🐑", pos: "f" }, { w: "rope", e: "🪢", pos: "f" }, { w: "top", e: "🔝", pos: "f" }
    ],
    B: [
      { w: "ball", e: "⚽", i: 1, pos: "i" }, { w: "banana", e: "🍌", i: 1, pos: "i" }, { w: "bear", e: "🐻", i: 1, pos: "i" }, { w: "bus", e: "🚌", i: 1, pos: "i" }, { w: "bed", e: "🛏️", i: 1, pos: "i" }, { w: "book", e: "📖", i: 1, pos: "i" }, { w: "bee", e: "🐝", i: 1, pos: "i" }, { w: "boat", e: "⛵", i: 1, pos: "i" },
      { w: "baby", e: "👶", pos: "m" }, { w: "rabbit", e: "🐰", pos: "m" }, { w: "ribbon", e: "🎀", pos: "m" }, { w: "robot", e: "🤖", pos: "m" }, { w: "table", e: "🪑", pos: "m" },
      { w: "crab", e: "🦀", pos: "f" }, { w: "web", e: "🕸️", pos: "f" }, { w: "tub", e: "🛁", pos: "f" }, { w: "cob", e: "🌽", pos: "f" }, { w: "cab", e: "🚕", pos: "f" }
    ],
    M: [
      { w: "moon", e: "🌙", i: 1, pos: "i" }, { w: "mouse", e: "🐭", i: 1, pos: "i" }, { w: "milk", e: "🥛", i: 1, pos: "i" }, { w: "mom", e: "👩", i: 1, pos: "i" }, { w: "monkey", e: "🐵", i: 1, pos: "i" }, { w: "mountain", e: "⛰️", i: 1, pos: "i" }, { w: "mug", e: "☕", i: 1, pos: "i" },
      { w: "hammer", e: "🔨", pos: "m" }, { w: "camel", e: "🐫", pos: "m" }, { w: "lemon", e: "🍋", pos: "m" }, { w: "tomato", e: "🍅", pos: "m" }, { w: "drummer", e: "🥁", pos: "m" },
      { w: "drum", e: "🥁", pos: "f" }, { w: "gum", e: "🍬", pos: "f" }, { w: "ham", e: "🍖", pos: "f" }, { w: "broom", e: "🧹", pos: "f" }, { w: "arm", e: "💪", pos: "f" }, { w: "jam", e: "🍓", pos: "f" }
    ],
    N: [
      { w: "nose", e: "👃", i: 1, pos: "i" }, { w: "nest", e: "🪺", i: 1, pos: "i" }, { w: "net", e: "🥅", i: 1, pos: "i" }, { w: "nut", e: "🥜", i: 1, pos: "i" }, { w: "noodle", e: "🍜", i: 1, pos: "i" }, { w: "nail", e: "💅", i: 1, pos: "i" }, { w: "nine", e: "9️⃣", i: 1, pos: "i" },
      { w: "banana", e: "🍌", pos: "m" }, { w: "peanut", e: "🥜", pos: "m" }, { w: "panda", e: "🐼", pos: "m" }, { w: "dinner", e: "🍽️", pos: "m" }, { w: "tennis", e: "🎾", pos: "m" },
      { w: "sun", e: "☀️", pos: "f" }, { w: "can", e: "🥫", pos: "f" }, { w: "train", e: "🚂", pos: "f" }, { w: "pin", e: "📌", pos: "f" }, { w: "bone", e: "🦴", pos: "f" }, { w: "lion", e: "🦁", pos: "f" }
    ],
    T: [
      { w: "top", e: "🔝", i: 1, pos: "i" }, { w: "toe", e: "🦶", i: 1, pos: "i" }, { w: "tiger", e: "🐯", i: 1, pos: "i" }, { w: "tooth", e: "🦷", i: 1, pos: "i" }, { w: "toy", e: "🧸", i: 1, pos: "i" }, { w: "ten", e: "🔟", i: 1, pos: "i" }, { w: "turtle", e: "🐢", i: 1, pos: "i" }, { w: "table", e: "🪑", i: 1, pos: "i" },
      { w: "water", e: "💧", pos: "m" }, { w: "guitar", e: "🎸", pos: "m" }, { w: "potato", e: "🥔", pos: "m" }, { w: "button", e: "🔘", pos: "m" }, { w: "letter", e: "✉️", pos: "m" },
      { w: "cat", e: "🐱", pos: "f" }, { w: "hat", e: "🎩", pos: "f" }, { w: "boat", e: "⛵", pos: "f" }, { w: "gate", e: "🚪", pos: "f" }, { w: "kite", e: "🪁", pos: "f" }, { w: "foot", e: "🦶", pos: "f" }
    ],
    D: [
      { w: "dog", e: "🐶", i: 1, pos: "i" }, { w: "duck", e: "🦆", i: 1, pos: "i" }, { w: "door", e: "🚪", i: 1, pos: "i" }, { w: "doll", e: "🪆", i: 1, pos: "i" }, { w: "deer", e: "🦌", i: 1, pos: "i" }, { w: "dinosaur", e: "🦕", i: 1, pos: "i" }, { w: "desk", e: "🪑", i: 1, pos: "i" }, { w: "dad", e: "👨", i: 1, pos: "i" },
      { w: "ladder", e: "🪜", pos: "m" }, { w: "spider", e: "🕷️", pos: "m" }, { w: "radio", e: "📻", pos: "m" }, { w: "medal", e: "🏅", pos: "m" }, { w: "soda", e: "🥤", pos: "m" },
      { w: "bed", e: "🛏️", pos: "f" }, { w: "road", e: "🛣️", pos: "f" }, { w: "cloud", e: "☁️", pos: "f" }, { w: "hand", e: "✋", pos: "f" }, { w: "food", e: "🍔", pos: "f" }, { w: "salad", e: "🥗", pos: "f" }
    ],
    V: [
      { w: "van", e: "🚐", i: 1, pos: "i" }, { w: "violin", e: "🎻", i: 1, pos: "i" }, { w: "vase", e: "🏺", i: 1, pos: "i" }, { w: "vest", e: "🦺", i: 1, pos: "i" }, { w: "volcano", e: "🌋", i: 1, pos: "i" }, { w: "vegetable", e: "🥦", i: 1, pos: "i" }, { w: "video", e: "📹", i: 1, pos: "i" },
      { w: "river", e: "🏞️", pos: "m" }, { w: "oven", e: "🍳", pos: "m" }, { w: "seven", e: "7️⃣", pos: "m" }, { w: "gloves", e: "🧤", pos: "m" }, { w: "driver", e: "🚗", pos: "m" },
      { w: "five", e: "5️⃣", pos: "f" }, { w: "cave", e: "🕳️", pos: "f" }, { w: "glove", e: "🧤", pos: "f" }, { w: "wave", e: "🌊", pos: "f" }, { w: "dove", e: "🕊️", pos: "f" }, { w: "stove", e: "🍳", pos: "f" }
    ],
    Z: [
      { w: "zebra", e: "🦓", i: 1, pos: "i" }, { w: "zoo", e: "🦁", i: 1, pos: "i" }, { w: "zipper", e: "🤐", i: 1, pos: "i" }, { w: "zero", e: "0️⃣", i: 1, pos: "i" }, { w: "zigzag", e: "➰", i: 1, pos: "i" }, { w: "zip", e: "🧥", i: 1, pos: "i" },
      { w: "lizard", e: "🦎", pos: "m" }, { w: "puzzle", e: "🧩", pos: "m" }, { w: "dizzy", e: "😵", pos: "m" }, { w: "scissors", e: "✂️", pos: "m" }, { w: "bulldozer", e: "🚜", pos: "m" },
      { w: "nose", e: "👃", pos: "f" }, { w: "rose", e: "🌹", pos: "f" }, { w: "cheese", e: "🧀", pos: "f" }, { w: "hose", e: "🚿", pos: "f" }, { w: "bees", e: "🐝", pos: "f" }
    ],
    J: [
      { w: "jam", e: "🍓", i: 1, pos: "i" }, { w: "juice", e: "🧃", i: 1, pos: "i" }, { w: "jet", e: "✈️", i: 1, pos: "i" }, { w: "jeep", e: "🚙", i: 1, pos: "i" }, { w: "jar", e: "🫙", i: 1, pos: "i" }, { w: "jacket", e: "🧥", i: 1, pos: "i" }, { w: "giraffe", e: "🦒", i: 1, pos: "i" },
      { w: "magic", e: "🪄", pos: "m" }, { w: "pajamas", e: "🩳", pos: "m" }, { w: "engine", e: "🚂", pos: "m" }, { w: "pigeon", e: "🕊️", pos: "m" }, { w: "angel", e: "😇", pos: "m" },
      { w: "cage", e: "🦜", pos: "f" }, { w: "page", e: "📄", pos: "f" }, { w: "bridge", e: "🌉", pos: "f" }, { w: "orange", e: "🍊", pos: "f" }, { w: "badge", e: "🎖️", pos: "f" }
    ],
    THV: [
      { w: "mother", e: "👩", pos: "m" }, { w: "father", e: "👨", pos: "m" }, { w: "brother", e: "👦", pos: "m" }, { w: "feather", e: "🪶", pos: "m" }, { w: "weather", e: "🌦️", pos: "m" }, { w: "leather", e: "🧥", pos: "m" },
      { w: "bathe", e: "🛁", pos: "f" }, { w: "smooth", e: "🧈", pos: "f" }, { w: "teethe", e: "🦷", pos: "f" }, { w: "breathe", e: "😮‍💨", pos: "f" }
    ]
  };
  // Game-themed beginning words reuse painted bank pictures. No new words
  // leak into Feed Echo or practice. A named homework list always wins.
  const GAME_WORDS = {
    soccer: { B:["ball","bear"], N:["net"], T:["toe"], F:["foot"], S:["sock"], SH:["shoe","shirt"], K:["cup"], M:["medal"], L:["leg"] },
    hoops: { B:["ball"], N:["net"], S:["sock"], SH:["shoe","shirt"], K:["cup"], M:["medal"], L:["leg"] },
    dino: { B:["bone","bucket"], R:["rock"], M:["mountain","map"], N:["nest"], T:["tooth"], D:["dinosaur"], K:["cave"], F:["foot"], V:["volcano"], S:["sand","sun"], SH:["shell"], L:["leaf","lizard"], TH:["thorn"] }
  };
  function gameWords(key,sound) {
    sound=String(sound||"").toUpperCase();
    if(homeworkWords(sound).length)return [];
    var names=(GAME_WORDS[key]||{})[sound]||[], all=[];
    Object.keys(WORDS).forEach(function(snd){all=all.concat(WORDS[snd]);});
    return names.map(function(name){
      var entry=(WORDS[sound]||[]).filter(function(w){return w.w===name;})[0]||all.filter(function(w){return w.w===name;})[0];
      return entry?{w:entry.w,e:entry.e,pos:"i"}:null;
    }).filter(function(w){return !!w;});
  }

  // Word positions for targeted practice — SLPs pick where in the word the sound sits.
  const POSITIONS = [
    { id: "i", name: "Beginning" }, { id: "m", name: "Middle" }, { id: "f", name: "End" },
    { id: "v", name: "Vocalic R" }, { id: "b", name: "Blends" }, { id: "mix", name: "Mixed" },
  ];
  // An assignment may name its own words. Only words this app already knows
  // are used — an SLP typing a word with no recorded target is a silent
  // dead end, so unknown ones fall through to the bank rather than shipping
  // a round the child cannot pass. [] when the assignment names none for
  // this sound (the game reader, gameAsk, needs to tell the two apart).
  function homeworkWords(sound) {
    try {
      const hw = homework();
      if (hw && hw.words && hw.words.length && hw.sounds.indexOf(String(sound).toUpperCase()) >= 0) {
        const want = {}; hw.words.forEach(function (w) { want[String(w).toLowerCase()] = 1; });
        return (WORDS[sound] || []).filter(function (w) { return want[String(w.w).toLowerCase()]; });
      }
    } catch (e) {}
    return [];
  }
  function wordsFor(sound, pos) {
    const pick = homeworkWords(sound);
    if (pick.length) return pick;
    const list = (WORDS[sound] || []).slice();
    if (pos === "mix" || pos === "all") return list;
    pos = pos || "i"; // no selection → initial position (preserves prior behavior; SLPs opt into others)
    const sel = list.filter(function (w) { return (w.pos || "i") === pos; });
    if (sel.length) return sel;
    const init = list.filter(function (w) { return (w.pos || "i") === "i"; });
    return init.length ? init : list;
  }

  // --- prize chests (one at the end of each sound's path) ---
  function chestClaimed(sound) { return !!getProgress().chests[sound]; }
  function claimChest(sound) { const g = getProgress(); if (g.chests[sound]) return false; g.chests[sound] = true; save(GKEY, g); try { awardNextSticker(); } catch (e) {} return true; }

  // --- coins: COIN3 (11 Oct 2026, D2): a play currency with two sources only,
  // the daily chest and Trophy Road / month gifts. Never sold. Validated: a
  // typo'd price can no longer make the wallet NaN or string-join it ("40"+"5"),
  // and a zero, negative or junk amount changes nothing (not even the ladder
  // migration getProgress() may save, so it is never called for one).
  function _coinInt(n) { n = Math.floor(Number(n)); return (isFinite(n) && n > 0 && n < 100000) ? n : 0; }
  // pure: reads the balance without getProgress()'s one-time ladder migration write
  function coinsNow() { try { const g = load(GKEY, DEFAULT_PROGRESS); return Math.max(0, (g.totals && g.totals.coins) | 0); } catch (e) { return 0; } }
  function getCoins() { return getProgress().totals.coins || 0; }
  function addCoins(n) { const v = _coinInt(n); if (!v) return coinsNow(); const g = getProgress(); g.totals.coins = (g.totals.coins | 0) + v; save(GKEY, g); return g.totals.coins; }
  function spendCoins(n) { const v = _coinInt(n); if (!v) return false; const g = getProgress(); if ((g.totals.coins | 0) < v) return false; g.totals.coins = (g.totals.coins | 0) - v; save(GKEY, g); return true; }
  // --- owned cosmetics: the Buddy Shop (SHOP1, 11 Oct 2026, D3) ---
  // Exactly what every family could pick on 11 Oct 2026, when the old shop
  // set `owned = true` for everything. A household set up before the shop
  // keeps all of it (the OWN1 sweep, _keepBuddies, below the free-era sweeps);
  // a family set up after it starts with the starters (fox, bunny, panda, no
  // hat, the sky) and buys or wins the rest. A literal: new items never join.
  const LEGACY_SET = {
    characters: ["fox", "bunny", "dragon", "cat", "bee", "octopus", "dino", "panda"],
    outfits: ["none", "crown", "tophat", "cap", "shades", "bow", "party"],
    backdrops: ["sky", "jungle", "forest", "mountain", "space", "beach"] };
  const SHOP_LISTS = { characters: CHARACTERS, outfits: OUTFITS, backdrops: BACKDROPS };
  const SHOP_FIELD = { characters: "character", outfits: "outfit", backdrops: "backdrop" };
  const UNDO_MS = 10000;
  // strict: a catalog entry or null, never byId's fallback (so "leo" is no buddy here)
  function _shopFind(kind, id) {
    const l = Object.prototype.hasOwnProperty.call(SHOP_LISTS, kind) ? SHOP_LISTS[kind] : null; if (!l) return null;
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function _worn(kind) { const p = getProfile(); return kind === "characters" ? p.character : kind === "outfits" ? p.outfit : p.backdrop; }
  // Owned without counting what is worn: a starter, the kept household's
  // promise (fails open: a device that cannot read its stamp is "kept"), or
  // the family's own list, which a backup carries to a new phone.
  function _ownsBesidesWorn(kind, id) {
    const it = _shopFind(kind, id); if (!it) return false;
    if (it.source === "starter") return true;
    if (buddiesKept() && LEGACY_SET[kind].indexOf(id) >= 0) return true;
    const o = getProfile().owned || {}; return Array.isArray(o[kind]) && o[kind].indexOf(id) >= 0;
  }
  // …and what a child is wearing is theirs, however it came to be worn
  function owns(kind, id) { return !!_shopFind(kind, id) && (_worn(kind) === id || _ownsBesidesWorn(kind, id)); }
  function addOwned(kind, id) { const p = getProfile(); const o = p.owned || { outfits: [], backdrops: [] }; o[kind] = o[kind] || []; if (o[kind].indexOf(id) === -1) o[kind].push(id); saveProfile({ owned: o }); }
  // Pure: one item as the shop shows it. state "owned", "buy" (a shop item
  // not owned yet) or "road" (a Trophy Road item not reached yet: its stop
  // and trophies, from ROAD_STOPS). null for an unknown id.
  function shopItem(kind, id) {
    const it = _shopFind(kind, id); if (!it) return null;
    let stop = null, at = null;
    if (it.source === "road") ROAD_STOPS.forEach((s) => { if (stop === null && s.gift.some((g) => { const r = _roadItem(g); return r && r.kind === kind && r.id === id; })) { stop = s.n; at = s.at; } });
    const art = kind === "characters" ? buddySprite(id, "portrait") : kind === "outfits" ? (it.art || null) : "/assets/crafted/customize-" + id + "-v2.webp";
    const state = owns(kind, id) ? "owned" : it.source === "shop" ? "buy" : "road";
    return { kind, id, name: it.name, cost: it.source === "shop" ? _coinInt(it.cost) : null, source: it.source || "", stop, at, art, state };
  }
  // Wear something the child owns. If what they wear now is theirs only
  // because they are wearing it (an old pick, or one a backup brought), it is
  // written into their own list first, so switching away never takes it.
  function equip(kind, id) {
    const field = SHOP_FIELD[kind]; if (!field || !owns(kind, id)) return false;
    const cur = _worn(kind);
    if (cur !== id && _shopFind(kind, cur) && !_ownsBesidesWorn(kind, cur)) addOwned(kind, cur);
    const patch = {}; patch[field] = id; saveProfile(patch);
    return true;
  }
  // Coins for a shop item: the price is the catalog's, never the page's. The
  // coins go first (a crash under-gives, never gives twice), then the item,
  // then it is worn. Never sold for money, never random.
  function buyItem(kind, id) {
    const it = shopItem(kind, id);
    if (!it) return { ok: false, reason: "bad" };
    if (it.state === "owned") return { ok: false, reason: "owned" };
    if (it.state === "road") return { ok: false, reason: "road" };
    const cost = _coinInt(it.cost); if (!cost) return { ok: false, reason: "bad" };
    const have = coinsNow(); if (have < cost) return { ok: false, reason: "short", need: cost - have };
    const prev = _worn(kind);
    if (!spendCoins(cost)) return { ok: false, reason: "short", need: Math.max(1, cost - coinsNow()) };
    addOwned(kind, id); equip(kind, id);
    saveProfile({ lastBuy: { kind, id, cost, prev, at: Date.now() } });
    try { track("shop item got", { kind, item: id, cost }); } catch (e) {}
    return { ok: true, coins: coinsNow() };
  }
  // "Oops? Give it back", within 10 seconds of the last buy: the item leaves
  // the child's list first, then the coins come back (never more than the
  // catalog price), and what they wore before is put back on if they still
  // wear the one bought. Once only.
  function undoBuy() {
    const p = getProfile(), lb = p.lastBuy, now = Date.now();
    if (!lb || typeof lb !== "object" || !SHOP_FIELD[lb.kind] || !(now - lb.at >= 0 && now - lb.at <= UNDO_MS)) return { ok: false };
    const it = _shopFind(lb.kind, lb.id), o = p.owned || {}, list = Array.isArray(o[lb.kind]) ? o[lb.kind] : [], i = list.indexOf(lb.id);
    if (!it || it.source !== "shop" || i < 0) { saveProfile({ lastBuy: null }); return { ok: false }; }
    list.splice(i, 1); o[lb.kind] = list;
    const patch = { owned: o, lastBuy: null }, field = SHOP_FIELD[lb.kind];
    // (an old pick like "leo" goes back on as it was: it reads as the fox)
    if (p[field] === lb.id) patch[field] = (typeof lb.prev === "string" && lb.prev && lb.prev !== lb.id) ? lb.prev : SHOP_LISTS[lb.kind][0].id;
    saveProfile(patch);
    const back = Math.min(_coinInt(lb.cost), _coinInt(it.cost));
    if (back) addCoins(back);
    return { ok: true, coins: coinsNow() };
  }

  // Word sessions retain their original counts. An adventure records completed
  // rounds separately: its isolation/syllable practice is not a list of words.
  function recordSession(rec) {
    const g = getProgress();
    const words = (rec && rec.words) || [];
    const tries = Math.max(0, Math.floor(Number(rec && rec.tries) || 0));
    // Discovery-only play never creates a practice day or an empty session.
    if (!words.length && !tries) return g;
    const stars = words.filter((w) => w && w.ok !== false).length;
    const session = { date: new Date().toISOString(), count: words.length, sounds: [...new Set(words.map((w) => w && w.sound).filter(Boolean))] };
    if (rec && rec.activity === "adventure" && !words.length) {
      const rounds = rec.rounds, sound = String(rec.sound || "").toUpperCase();
      if (Number.isInteger(rounds) && rounds > 0 && rounds <= ROT_LEN && Object.prototype.hasOwnProperty.call(WORDS, sound)) {
        session.activity = "adventure";
        session.rounds = rounds;
        session.sounds = [sound];
      }
    }
    if (tries) session.tries = tries;
    if (rec && rec.activity === "practice") session.activity = "practice";
    if (rec && rec.sound && Object.prototype.hasOwnProperty.call(WORDS, rec.sound)) session.sounds = [rec.sound];
    if (rec && Number.isFinite(rec.arcadeScore)) session.arcadeScore = Math.max(0, Math.floor(rec.arcadeScore));
    g.sessions.unshift(session);
    g.sessions = g.sessions.slice(0, 50);
    g.totals.sessions += 1; g.totals.words += words.length; g.totals.stars += stars;
    words.forEach((w) => { if (w && w.sound) g.bySound[w.sound] = (g.bySound[w.sound] || 0) + 1; });
    // keep a short "try again" list: add words they missed, clear ones they nailed
    words.forEach((w) => {
      if (!w || !w.word || w.level === "isolation") return;
      const i = g.missed.findIndex((m) => m.w === w.word);
      if (w.ok === false && i === -1) g.missed.push({ w: w.word, sound: w.sound || "R" });
      if (w.ok !== false && i !== -1) g.missed.splice(i, 1);
    });
    g.missed = g.missed.slice(-15);
    bumpStreak(g);
    save(GKEY, g);
    return g;
  }
  function resetProgress() { save(GKEY, clone(DEFAULT_PROGRESS)); }

  // ── backup / restore ──────────────────────────────────────────────────────
  // Everything the app persists lives under the "sona." key prefix, so a full
  // backup is a sweep of those keys — the safety net for the data-loss risk
  // (a cleared browser/app currently erases a child's whole history).
  //
  // TWO KEYS NEVER LEAVE IN A BACKUP (5 Oct 2026): what a parent tapped on
  // setup's two one-tap questions ("What brings you to Sona?", "How does
  // practice go at home now?"), and the half-finished setup that holds the
  // same two taps before it is saved. Those screens say "Your answer stays on
  // this device", and a backup code is something a family copies, emails to
  // itself or pastes into another phone. Left out here AND refused by
  // importData below, so neither half can be undone by the other.
  // THE PRACTICE BOARD'S FIVE KEYS never leave either (BOARD2, 11 Oct 2026):
  // a child's board token belongs to this phone (a copy on a second phone
  // would post days for a child twice over, and a pasted one is somebody
  // else's entry), the pending request and the deletions still to send are
  // this phone's errands, and the therapist answer stays here, as the sheet
  // says. A new phone asks again and joins again.
  // THE NATIVE MIC'S MEASUREMENT SETTING never leaves either (Oct 2026):
  // "sona.nativemic" is set by hand on Travis's test phone, and it changes
  // whose mic listens and how loud it hears; on another family's phone it
  // would change what counts as heard. It is refused by importData too.
  const NO_EXPORT = ["sona.setupasks.v1", "sona.obdraft.v1", "sona.board.v1", "sona.boardcache.v1", "sona.boardpend.v1", "sona.boardleave.v1", "sona.boardask.v1", "sona.nativemic",
    // the trial reminder (NOTIFY1): this phone's iOS answer and what iOS holds for it
    "sona.notify.v1",
    // what this phone showed (the offer from Home, 13 Oct 2026), like freever
    "sona.offerseen.v1",
    // the weekly report's device id and last send (REPORT1): this phone's own
    "sona.report.v1"];
  function exportData() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        // the base key, as importData judges it ("name@k2" is "name")
        if (k && k.indexOf("sona.") === 0 && NO_EXPORT.indexOf(k.split("@")[0]) === -1) out[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return { app: "sona", v: 1, data: out };
  }
  function exportString() { try { return JSON.stringify(exportData()); } catch (e) { return "{}"; } }
  // Backup restores PRACTICE, never ACCESS. It used to write any key beginning
  // "sona." verbatim, which made a backup code a paste-in paywall bypass: hand
  // someone a string containing sona.sub.v1 and they were a subscriber. Every
  // entitlement lives server-side or behind a verified credential, and every
  // one of them can be re-established on a new device by restoring with an
  // email or re-opening an SLP link — so dropping them here costs a real
  // family nothing and costs a forger everything. ONE EXCEPTION, stated
  // plainly: a free-era promise (earlyAdopter) is recorded only on the device
  // its sweep judged, so it cannot follow a family to a new phone. A restore
  // at least never erases the one the DESTINATION holds (below); carrying it
  // across would need a server-side record, which does not exist yet.
  // The caseload coverage cache joined the list on 24 Sep 2026: coverage is
  // Premium, and a cached "yes" is exactly what a forger would paste.
  //
  // THE ENROLMENT TICKET TRAVELS, and so do the clinician codes (sona.slp,
  // sona.slpok) — deliberately, and later the same day. The clinician's link
  // opens in Safari; the iOS app keeps separate storage, and the move-in code
  // or a backup is the ONLY way anything crosses to it. Blocking the ticket
  // meant a covered family who installed the app landed on the free version
  // with no way back short of finding the link again. It is safe to carry
  // because it grants nothing here: premium() never reads it, and the only
  // thing that turns it into Premium is the server answering /api/slp/covered
  // for that exact code — which is asked the moment an import carries one. A
  // pasted ticket is worth what the clinician's plan is worth, for as long as
  // the server says so; the cached answer itself never travels.
  //
  // THE FREE-ERA STAMPS AND THE FOUNDING MARK never travel either. The stamps
  // say "this device was judged on its first load", which is true of the
  // device, not the family — and a pasted empty stamp would re-open a sweep
  // on the next load and adopt whatever the backup brought with it.
  //
  // SETUP'S TWO ANSWERS AND ITS DRAFT, and the Practice Board's five keys, are
  // on NO_EXPORT above too: a backup made by this build never holds them, and
  // one that does (hand-made, or from a build that slips) is not let in either.
  const NO_IMPORT = ["sona.sub.v1", "sona.slpunlock", "sona.caseplan.v1", "sona.founder", "sona.founding.v1", "sona.paidui", "sona.websalesui", "sona.pilot.v1", "sona.trial.v1",
    "sona.freeera.v1", "sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1", "sona.freever.v1",
    "sona.setupasks.v1", "sona.obdraft.v1",
    // the kept-buddies stamp (OWN1) is true of this device, like freever; what
    // a household owns travels inside each child's profile instead
    "sona.buddyset.v1",
    // the Practice Board's keys (BOARD2): never brought in, so a restore can
    // never put a child on the board, or hand one child another's entry
    "sona.board.v1", "sona.boardcache.v1", "sona.boardpend.v1", "sona.boardleave.v1", "sona.boardask.v1",
    // the native mic's measurement setting (NATIVE MIC): true of one test
    // phone only, and it changes what counts as heard, so it never moves to another
    "sona.nativemic",
    // the trial reminder (NOTIFY1): a backup never brings another phone's
    // iOS answer, or a reminder iOS does not hold here
    "sona.notify.v1",
    // the offer from Home was shown on THIS phone (13 Oct 2026): a backup
    // never brings the mark, so it can never take that one showing away
    "sona.offerseen.v1",
    // the weekly report's device id (REPORT1): a restored phone is its own device
    "sona.report.v1"];
  // The free-era marks a sweep writes onto a profile. A backup may never
  // bring them (it would forge the promise), and it may never take them away
  // from the device it is restored onto (that would break one).
  const ERA_MARKS = ["earlyAdopter", "freeEra", "freeEra2", "freeEra3", "freeEra4", "freeEra5"];
  function importData(payload) {
    try {
      const obj = (typeof payload === "string") ? JSON.parse(payload) : payload;
      const data = (obj && obj.data && typeof obj.data === "object") ? obj.data : obj;
      if (!data || typeof data !== "object") return { ok: false, error: "That backup didn't look right." };
      // THE DESTINATION'S PROMISE SURVIVES THE RESTORE (24 Sep 2026). Stripping
      // earlyAdopter from the backup is right; writing the stripped profile
      // over a profile that was grandfathered HERE silently ended a promise
      // this device's own sweep made. Snapshot the household first.
      const wasGrandfathered = earlyAdopterAnyKid();
      // THE KEPT BUDDIES COME WITH THE HOUSEHOLD (OWN1, 11 Oct 2026). The
      // stamp never comes in (NO_IMPORT), but what it says does: a backup
      // stamped "kept", or one with no stamp at all (made before the Buddy
      // Shop, when every family could pick everything), brings the legacy set
      // in every set-up child's profile, a profile saved without the list (a
      // child set up after the sweep ran) included. The Terms promise a backup
      // never takes away an item a child already has. A backup stamped "post"
      // brings only the list it holds. Forging one only adds cosmetic items on
      // the phone that pastes it, which the spec accepts (§11).
      const keptBackup = data[BUDDYSET_KEY] !== "post";
      // THE PRACTICE BOARD FOLLOWS THE CHILD, NOT THE SLOT (BOARD2). Board
      // keys never come in (NO_IMPORT), but a restore can put a different
      // child into a slot, or take one away; who sits where is noted first.
      let boardBefore = []; try { boardBefore = _boardSlots(); } catch (e) {}
      let n = 0, skipped = 0, ticket = false;
      Object.keys(data).forEach((k) => {
        if (k.indexOf("sona.") !== 0) return;
        // the base key, so "sona.profile.v1@k2" is judged like "sona.profile.v1"
        const base = k.split("@")[0];
        if (NO_IMPORT.indexOf(base) !== -1) { skipped++; return; }
        let v = String(data[k]);
        // earlyAdopter rides INSIDE the profile, so a key-level block misses it
        if (base === PKEY) {
          try {
            const p = JSON.parse(v);
            if (p && typeof p === "object") {
              ERA_MARKS.forEach((m) => { delete p[m]; });
              // …and the marks this device already held on this very key stay
              let here = null; try { here = JSON.parse(localStorage.getItem(k) || "null"); } catch (e) {}
              if (here && typeof here === "object") ERA_MARKS.forEach((m) => { if (here[m]) p[m] = here[m]; });
              if (keptBackup && (p.onboarded || p.childName)) p.owned = _legacyInto(p.owned);
              v = JSON.stringify(p);
            }
          } catch (e) {}
        }
        try { localStorage.setItem(k, v); n++; if (base === "sona.slpticket" && v) ticket = true; } catch (e) {}
      });
      // A slot whose child changed (a new name) or that left the list loses
      // its board entry here, and the entry is queued for deletion: a new
      // child's grown-up is never told "removed after a long break", and
      // nobody inherits another child's place or the grown-up's yes.
      try { _boardAfterImport(boardBefore); } catch (e) {}
      // HISTORY WITHOUT A TROPHY RECORD (final review, 12 Oct 2026). A backup
      // made before this build, or on a phone that logged no rep since, brings
      // the practice and play history trophies come from but no record of
      // them. The record already here (a few reps in the iPhone app before a
      // Safari backup was pasted) would be trusted for good and the restored
      // weeks never counted: Level 2 locked, the road at its start. That
      // slot's record goes, and is counted again from the history now on the
      // phone, as at a first rep after this build.
      try {
        const brought = {};
        Object.keys(data).forEach((k) => {
          const at = k.indexOf("@"), base = at < 0 ? k : k.slice(0, at), sfx = at < 0 ? "" : k.slice(at);
          if (base === TROPHYKEY) brought[sfx] = true;
          else if ((base === OUTKEY || base === GAMEREPKEY || base === GOALKEY) && !(sfx in brought)) brought[sfx] = false;
        });
        Object.keys(brought).forEach((sfx) => { if (!brought[sfx]) localStorage.removeItem(TROPHYKEY + sfx); });
      } catch (e) {}
      if (!n) return { ok: false, error: "No Sona data found in that backup." };
      // The backup can also replace the child list, so the grandfathered
      // profile may no longer be in it. Access was the household's, so it
      // lands on every child the household now has — never on a household
      // that did not already hold it.
      if (wasGrandfathered && !earlyAdopterAnyKid()) {
        try {
          (_kids().list || []).forEach((k) => {
            const key = k.slot ? PKEY + "@" + k.slot : PKEY;
            let pr = null; try { pr = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) {}
            pr = (pr && typeof pr === "object") ? pr : {};
            pr.earlyAdopter = true;
            localStorage.setItem(key, JSON.stringify(pr));
          });
        } catch (e) {}
      }
      // a carried ticket is a question, not an answer: ask it now, so a
      // covered family opens Home with every game instead of in six hours
      if (ticket) { try { caseRefresh(true); } catch (e) {} }
      return { ok: true, restored: n, skipped: skipped };
    } catch (e) { return { ok: false, error: "Couldn't read that backup code." }; }
  }

  // ── Charge & Play: the ⚡ charge gate + the Daily Run ─────────────────────
  // The core loop: a quick burst of ~5 real spoken reps "charges" the game the
  // kid is about to play. Practice is the power source — never the penalty.
  // Arcade time is NOT practice and never counts in the SLP stats (that stays
  // logAttempt's job — one on-device shape check per charge).
  const TICKKEY = "sona.tickets.v1", CHARGEKEY = "sona.charge.v1";
  const CHARGE_NEED = 5; // reps per charge — fast, drill-like, ~10s
  function tickets() { return Math.max(0, (load(TICKKEY, { n: 0 }).n | 0)); }
  function addTickets(k) { const t = load(TICKKEY, { n: 0 }); t.n = Math.max(0, (t.n | 0) + (k == null ? 1 : k | 0)); save(TICKKEY, t); return t.n; }
  function spendTicket() { const t = load(TICKKEY, { n: 0 }); if ((t.n | 0) < 1) return false; t.n = (t.n | 0) - 1; save(TICKKEY, t); return true; }
  function chargeState() { const c = load(CHARGEKEY, { fill: 0, need: CHARGE_NEED }); c.need = CHARGE_NEED; return c; }
  // One rep toward the meter. Honest data is logAttempt's; the METER may also be
  // fed by "effort sparks" (fail-forward after real tries) so a struggling kid
  // still reaches the fun — kind meter, truthful stats.
  function chargeAdd() {
    const c = chargeState();
    c.fill = (c.fill | 0) + 1;
    if (c.fill >= c.need) { c.fill = 0; save(CHARGEKEY, c); const n = addTickets(1); return { ticket: true, tickets: n, fill: 0, need: c.need }; }
    save(CHARGEKEY, c);
    return { ticket: false, tickets: tickets(), fill: c.fill, need: c.need };
  }
  function chargeReset() { save(CHARGEKEY, { fill: 0, need: CHARGE_NEED }); }


  // ── the Daily Run: one shot per day, cumulative high score ───────────────
  // 4 quick games, each unlocked by a 5-rep charge; the round scores add up to
  // today's total. One attempt per day (the Wordle scarcity that makes it an
  // event) — free play in the arcade stays unlimited, same charge gate.
  const DAILYKEY = "sona.daily.v1";
  function localDay() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dailyInfo() {
    const d = load(DAILYKEY, { date: "", played: false, score: 0, best: 0 });
    const today = localDay();
    return { playedToday: !!(d.played && d.date === today), score: (d.date === today ? d.score | 0 : 0), best: d.best | 0, date: today };
  }
  function dailyFinish(score) {
    score = Math.max(0, score | 0);
    const d = load(DAILYKEY, { date: "", played: false, score: 0, best: 0 });
    const newBest = score > (d.best | 0);
    save(DAILYKEY, { date: localDay(), played: true, score: score, best: newBest ? score : (d.best | 0) });
    return { score: score, best: newBest ? score : (d.best | 0), newBest: newBest };
  }

  // Denial-recovery blocker when the mic is denied — a kid should never sit
  // in a silent loop, and a mic-less Sona is inert. The permission-priming
  // study found this screen is an industry blind spot (1 of 24 apps designs
  // the denied state), so: grown-up steps to re-enable + a Try Again that
  // actually retries. One shared implementation for every recording page.
  function micDenied(opts) {
    opts = opts || {};
    try {
      if (document.getElementById("sonaMicDenied")) return;
      const native = typeof isNativeApp === "function" && isNativeApp();
      const d = document.createElement("div");
      d.id = "sonaMicDenied";
      d.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(255,255,255,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:10px;";
      d.innerHTML =
        '<img src="/assets/crafted/echo-think.webp" alt="Echo" style="width:100px;height:100px;object-fit:contain;" onerror="if(this.src.indexOf(\'echo-welcome\')<0)this.src=\'/assets/crafted/echo-welcome.webp\';else this.outerHTML=\'<div style=&quot;font-size:64px&quot;>🦜</div>\'" />' +
        '<div style="font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:24px;color:#3c3c3c;">Echo can’t hear you yet!</div>' +
        '<div style="font-family:Nunito,sans-serif;font-weight:700;font-size:15px;color:#777;max-width:300px;">Ask a grown-up to turn Echo’s ears back on:</div>' +
        '<div style="text-align:left;background:#fff6e9;border-radius:16px;padding:13px 18px;font-family:Nunito,sans-serif;font-weight:800;font-size:14px;color:#5b4a36;line-height:1.9;max-width:300px;">' +
          '1. Open the phone’s <b>Settings</b><br/>' +
          (native ? '2. Find <b>Sona</b><br/>' : '2. Find <b>Safari</b> → <b>Microphone</b><br/>') +
          '3. Turn the <b>Microphone</b> on' +
        '</div>' +
        '<button id="sonaMicRetry" style="margin-top:10px;border:none;border-radius:16px;padding:14px 30px;font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:16px;text-transform:uppercase;color:#fff;background:#1cb0f6;box-shadow:0 5px 0 0 #1597d4;cursor:pointer;">I turned it on — try again!</button>' +
        '<button id="sonaMicBack" style="border:none;background:none;font-family:Nunito,sans-serif;font-weight:800;font-size:14px;color:#9fb0c0;cursor:pointer;padding:8px;">Back home</button>';
      d.querySelector("#sonaMicRetry").onclick = function () { try { location.reload(); } catch (e) {} };
      d.querySelector("#sonaMicBack").onclick = function () { d.remove(); if (opts.onClose) opts.onClose(); else location.href = opts.back || "/today.html"; };
      document.body.appendChild(d);
    } catch (e) {}
  }

  // --- subscription (Stripe is the source of truth; this is a local cache so
  //     the app can reflect "active" without a round-trip every load) ---
  const SKEY = "sona.sub.v1";
  function getSub() { return load(SKEY, { active: false, email: "", since: 0 }); }
  function saveSub(patch) { save(SKEY, Object.assign(getSub(), patch || {})); }
  function isSubscribed() { return !!getSub().active; }

  // --- free trial (no card): email-gated 7-day window, then the paywall ---
  // Maximizes signups while the product is being validated. Stored locally and
  // mirrored to KV (/api/trial) so it survives a device switch and the day-6
  // nudge job can find expiring trials. Stripe charges only on conversion.
  const TRIALKEY = "sona.trial.v1", TRIAL_DAYS = 3;
  function getTrial() { return load(TRIALKEY, null); }
  function trialMs(t) { return (((t && t.days) || TRIAL_DAYS)) * 86400000; }
  function mirrorTrial(t) { try { fetch("/api/trial", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ email: t.email || "", start: t.start, days: t.days || TRIAL_DAYS }) }).catch(function () {}); } catch (e) {} }
  function startTrial(email) {
    let t = getTrial();
    if (!t || !t.start) {
      t = { start: Date.now(), email: (email || "").trim(), days: TRIAL_DAYS };
      save(TRIALKEY, t); mirrorTrial(t);
      // Fired HERE, where the clock actually starts, not at the call site.
      // onboarding.html used to be the only thing reporting a trial, through
      // sonaTrack — which is a deliberate no-op in the iOS shell, so every
      // trial started in the app was invisible. This is the top of the
      // conversion funnel; measuring it only on the web measures the smaller
      // half. Fires once per device, because the guard above only builds a
      // trial when there isn't one.
      try { track("trial started", { plan: "annual" }); } catch (e) {}
    }
    else if (email && !t.email) { t.email = String(email).trim(); save(TRIALKEY, t); mirrorTrial(t); }
    return t;
  }
  // start the clock lazily so nobody is gated before they've had their days
  function ensureTrial() { if (isSubscribed() || isPilot()) return null; let t = getTrial(); if (!t || !t.start) t = startTrial(""); return t; }
  function trialActive() { const t = getTrial(); return !!(t && t.start && Date.now() < t.start + trialMs(t)); }
  function trialExpired() { const t = getTrial(); return !!(t && t.start && Date.now() >= t.start + trialMs(t)); }
  function trialDaysLeft() { const t = getTrial(); if (!t || !t.start) return TRIAL_DAYS; return Math.max(0, Math.ceil((t.start + trialMs(t) - Date.now()) / 86400000)); }

  // Native app (App Store build): window.Capacitor exists only inside the iOS
  // app, never in a browser. The App Store build ships with NO in-app payment
  // (Apple forbids non-IAP checkout), so the paywall is disabled and all
  // subscribe UI is hidden there. The web paywall is completely unchanged.
  function isNativeApp() { try { return !!(window.Capacitor && (typeof window.Capacitor.isNativePlatform === "function" ? window.Capacitor.isNativePlatform() : true)); } catch (e) { return false; } }

  // ── THE FREE DEMONSTRATION ────────────────────────────────────────────────
  // A new family used to be handed a silent 3-day clock the moment onboarding
  // closed, before Sona had shown them anything: the trial started burning
  // while the parent was still reading. What they get instead is one COMPLETE
  // run — a real prompt, real reps judged by the real detector, the game those
  // reps earn, the celebration, and an explicit finish — and only then a price.
  //
  // It is not an entitlement. It grants nothing, unlocks nothing else, and is
  // stored per DEVICE because it is a demonstration of the product, not a
  // property of a child: a second child on the same iPad has already been
  // shown what Sona does.
  const DEMOKEY = "sona.demo.v1";
  function demoState() { try { return JSON.parse(localStorage.getItem(DEMOKEY) || "null") || { started: 0, done: 0 }; } catch (e) { return { started: 0, done: 0 }; } }
  function _demoSave(d) { try { localStorage.setItem(DEMOKEY, JSON.stringify(d)); } catch (e) {} }
  // THE DEMONSTRATION HAS A WINDOW. Without one, a family who never FINISHED a
  // run was never gated: story + practice + games, every day, free, for as
  // long as they never reached the win screen. Three days from the first real
  // practice is the whole of what the old trial promised, and it is generous
  // to a family who started at bedtime. It never closes mid-run — see gated().
  const DEMO_WINDOW_MS = 72 * 3600 * 1000;
  function demoDone() {
    const d = demoState();
    if (d.done) return true;
    return !!(d.started && (Date.now() - d.started) > DEMO_WINDOW_MS);
  }
  function demoStart() {
    const d = demoState();
    if (d.done || d.started) return d;        // explicit state, so a refresh or
    d.started = Date.now(); _demoSave(d);     // a back-swipe resumes rather
    return d;                                  // than restarting
  }
  // ONE-SHOT, like the offer it precedes. A replay must not re-fire the
  // first-completion beat, so this answers "was this the first time" and the
  // caller decides what only happens once.
  function demoFinish() {
    const d = demoState();
    if (d.done) return false;
    d.done = Date.now(); _demoSave(d);
    try { track("demo completed", {}); } catch (e) {}
    return true;
  }

  // Launch gate. SINCE 24 SEP 2026 SONA HAS A FREE VERSION, and this gate is
  // what keeps it one: daily speech practice is never behind the paywall, for
  // anyone, in any pricing state. What Premium adds is GAMES — every game in
  // the library, the mystery door — and a catalog game is decided by
  // gameAccess(), the one reader of the catalog's tiers, so this gate and the
  // library can never disagree about whether Piano Tiles is open. Whoever
  // holds Premium (premium() below: subscribers, founders, founding pilots,
  // every grandfathered free era, a covered clinician's caseload) is never
  // gated. The native shell gates exactly like the web — the old "native
  // never gates" bypass predates the Apple IAP rail and would have made the
  // App Store build free forever with an ignorable paywall.
  // FREE MODE first: nothing is gated, so a kid page can never bounce to a
  // price screen mid-play (the audit caught Story Time doing exactly that).
  // Gates fire at PAGE LOAD only, never mid-round.
  //
  // `what` names the thing being asked for. Practice in any of its doors
  // ("practice", "daily", "session", and "demo" — the one run a family was
  // shown before the offer, replayable forever) is always open. A catalog key
  // asks the catalog. Anything else — Story Time, or a cached page that asks
  // with no name at all — is Premium content, and gates like it once the
  // demonstration is done.
  // A RUN THAT HAS STARTED IS NEVER GATED. charge.html keeps the daily run in
  // sessionStorage and hands the child off to an arcade page and back, five
  // times — every one of those is a page load, and every one of them asks the
  // gate. The demo replay was bouncing at its FIRST earned game because the
  // arcade pages ask with no activity name and the round trip carried no demo
  // flag: a child practiced, earned the game, tapped it, and met a price. And
  // the demonstration's window, if it closed between round two and round
  // three, would have done the same to a family mid-adventure.
  //
  // This is not a hole. A run record exists only because charge.html already
  // passed this gate when the run began, so honouring it merely extends a
  // permission that was already granted to the end of the thing it was granted
  // for. It is one sitting: sessionStorage, gone with the tab.
  const RUNKEY = "sona.run.v1";
  function runActive() {
    try { const r = JSON.parse(sessionStorage.getItem(RUNKEY) || "null"); return !!(r && r.active); } catch (e) { return false; }
  }
  // Where a GATED KID PAGE sends the child. It used to be /trial.html — a price
  // screen, with the child's name on it, reached by a child tapping a game.
  // Home tells them to ask a grown-up; the grown-up finds the price behind the
  // gate, on the grown-ups' pages (Settings, the plan screen), which is the
  // only place a price belongs.
  function gateBounce() {
    try { location.replace("/today.html?locked=1"); } catch (e) {}
  }
  // ── TRIAL FIRST: NOTHING FREE WHERE SONA CAN SELL (Travis, 3 Oct 2026) ──
  // "lets add the paywall before they try anything in the app. and then they
  // unlock everything. so fruit slice and piano tiles and feed echo and
  // bubble pop are all part of paid or needing to start a trial", then, of
  // the plan screen's "Not now": "yeah home locked". Setup now ends on the
  // plan screen (trialFirst()), and the free version (the free-tier games,
  // FREE_BOOKS, and the practice that opens them) is open only to:
  //   - a device where nobody can buy: an app build with no purchase plugin
  //     (the App Store's 1.0.4) or a browser while the website does not sell.
  //     A wall nobody can pass is not a paywall, it is a broken app;
  //   - a household already set up on this build's first load
  //     (_keepFreeVersion): it was told those games were free;
  //   - a family who joined through their speech therapist's link
  //     (slpVerified): every clinician page promises them the free version.
  //     sona.slpok travels in a backup, so a pasted one brings the free
  //     version too, never Premium: accepted, since it is what those pages
  //     promise.
  // Premium from any source, a trial, or Sona being free open everything,
  // exactly as before.
  function canSellHere() {
    try { return isNativeApp() ? iapAvailable() : webSales(); } catch (e) { return false; }
  }
  const FREEVER_KEY = "sona.freever.v1";
  function freeVersionKept() { try { return localStorage.getItem(FREEVER_KEY) === "kept"; } catch (e) { return false; } }
  function freeVersion() { return !canSellHere() || freeVersionKept() || slpVerified(); }
  // A TAP ON A GREY GAME OR BOOK OPENS THE PRICE AT ONCE (Travis, 4 Oct 2026:
  // "I want it to open automatically if they click on a game that is grayed
  // out"), with no "Ask a grown-up" note and no grown-ups check in between,
  // wherever Sona can sell to this family. Elsewhere (an app build with no
  // purchase plugin, a browser that does not sell) the note stays: there is
  // nothing to open.
  function offerOnLock() {
    try { return !isFree() && canSellHere() && !premium() && !trialActive(); } catch (e) { return false; }
  }
  // Setup ends on the plan screen, not the first game, for a family who could
  // buy here and has nothing that opens the games yet.
  function trialFirst() {
    try { return !isFree() && !freeVersion() && !premium() && !trialActive(); } catch (e) { return false; }
  }
  const PRACTICE_ASKS = ["practice", "daily", "session", "demo"];
  function gated(what) {
    if (isFree()) return false;
    // Practice opens with the free version (see freeVersion above), or with
    // Premium or a trial. A run that already started is never stopped.
    if (PRACTICE_ASKS.indexOf(what) !== -1) return !(freeVersion() || premium() || trialActive() || runActive());
    if (gameKey(what)) return !gameAccess(what).allowed;
    if (premium()) return false;                     // every game, whatever the source
    if (runActive()) return false;                   // never mid-run — see above
    if (!demoDone()) return false;                   // still inside the demonstration
    // A local no-card trial is no longer STARTED by anything — the
    // demonstration replaced it — but one already promised to a family is
    // honoured to the day it runs out. Removing ensureTrial() from here is
    // what stops a new device quietly minting one just by being gated.
    const t = getTrial();
    if (t && t.start && !trialExpired()) return false;
    return true;
  }
  // THE FREE BOOK (Travis, 30 Sep 2026: "one book uh so like the letter r
  // book ... to be free and the rest is grayed out ... once they purchase it'll
  // open up everything else"). The shelf opens for every family; the books
  // named here are open in every pricing state, and every other book is
  // Premium. Named by title because the books themselves live on the shelf
  // (library.html), and a title is what a parent sees. Rename that book and
  // this list must follow (readtest pins it).
  //
  // A Premium book opens exactly when a Premium game does (gameAccess's rule:
  // Sona free, Premium from any source, or a trial), and NOT on the
  // demonstration window gated() still honours for the rest: a new family
  // would otherwise watch a shelf of open books lock three days in.
  const FREE_BOOKS = ["Rory and the Rainbow"];
  function bookFree(title) { return FREE_BOOKS.indexOf(String(title || "")) !== -1 && freeVersion(); }
  function booksOpen() { return isFree() || premium() || trialActive(); }
  function bookLocked(title) { return !bookFree(title) && !booksOpen(); }
  // earlyAdopter lives on the PROFILE, and the profile is per-kid — so a
  // founding or SLP-referred family that added a second child had the first one
  // playing free while the sibling hit a paywall on the same device. Access was
  // never granted to a child; it was granted to the household.
  //
  // Since 24 Sep 2026 NOTHING NEW WRITES IT except the free-era sweeps. It is
  // the mark of a family who was promised Sona free before pricing returned
  // (eras one to five, including every device that redeemed a clinician's
  // link before the Caseload Premium build — see _grandfatherFreeEra4). A
  // redemption made AFTER that build earns Premium only through the
  // clinician's coverage, which can end; a promise already made cannot.
  function earlyAdopterAnyKid() {
    try {
      const list = _kids().list || [];
      for (let i = 0; i < list.length; i++) {
        const slot = list[i].slot;
        const raw = localStorage.getItem(slot ? PKEY + "@" + slot : PKEY);
        if (raw && JSON.parse(raw).earlyAdopter) return true;
      }
    } catch (e) {}
    return false;
  }

  // ── PREMIUM: every game in the library ────────────────────────────────
  // ONE answer to "does this family have Premium", so the gate, the catalog,
  // the plan moment and every page's copy ask the same question — the rule
  // lives here and nowhere else, or the paywall and the Home tiles drift the
  // way the free-mode copy once drifted from the gate.
  //
  // Deliberately NOT here: slpVerified() and an SLP-code pilot on their own.
  // A clinician's link proves a family belongs to a caseload; whether that
  // caseload includes Premium is the clinician's plan, answered by the server
  // (caseCovered). Before this build every redemption WAS the grant — those
  // families are kept by the era-four sweep, not by this function reading the
  // credential. Founding pilots (codes "ff-…", from the /founding programme)
  // and founders keep Premium outright: nobody sold them anything and nobody
  // can take it back.
  //
  // FOUNDING IS THE HOUSEHOLD'S, in its own key (24 Sep 2026). It used to be
  // read off the pilot code, which is per-child and which "Yes, share
  // progress" overwrites with the clinician's code — so a founding family who
  // joined an uncovered clinician lost every game, and their second child
  // never had them. sona.founding.v1 is written by the verified ?ff= path (and
  // by startPilot, carrying an older device's "ff-" code out of the slot it
  // is about to overwrite); it is on NO_IMPORT, so a backup cannot forge it.
  const FOUNDKEY = "sona.founding.v1";
  function _markFounding(code) {
    try { if (!localStorage.getItem(FOUNDKEY)) localStorage.setItem(FOUNDKEY, JSON.stringify({ code: String(code || ""), at: new Date().toISOString() })); } catch (e) {}
  }
  function foundingPilot() {
    try {
      const f = JSON.parse(localStorage.getItem(FOUNDKEY) || "null");
      if (f && String(f.code || "").indexOf("ff-") === 0) return true;
    } catch (e) {}
    // devices enrolled before the key existed: the "ff-" code on any child
    try {
      const list = _kids().list || [];
      for (let i = 0; i < list.length; i++) {
        const raw = localStorage.getItem(list[i].slot ? PILOTKEY + "@" + list[i].slot : PILOTKEY);
        const pi = raw ? JSON.parse(raw) : null;
        if (pi && pi.consent && String(pi.code || "").indexOf("ff-") === 0) return true;
      }
    } catch (e) {}
    return false;
  }
  function premium() {
    return isFounder() || isSubscribed() || earlyAdopterAnyKid() || foundingPilot() || caseCovered();
  }

  // ── CASELOAD COVERAGE: Premium that a clinician's plan pays for ─────────
  // A family who joined through a clinician whose caseload is covered ("Sona
  // Premium for your caseload", or a clinician grandfathered from before it
  // existed) gets Premium — whether or not they chose to share
  // progress. Access and sharing stay separate decisions.
  //
  // The SERVER decides, from the enrolment ticket this device earned by
  // redeeming code + key: /api/slp/covered answers about the clinician who
  // owns that code. Cached device-wide in sona.caseplan.v1 (a caseload is a
  // household's, like every other grant) and re-asked on the same cadence as
  // Apple. The lifecycle mirrors iapRefresh on purpose:
  //   • only an authoritative {ok:true, covered} answer changes anything;
  //   • a network failure, a 5xx or a refused ticket changes NOTHING — a
  //     family on a plane keeps their games, and a server bug must not strip
  //     a whole caseload at once;
  //   • covered:false removes THIS grant only. A subscription, a founder key
  //     or a free-era promise on the same device is a different source and is
  //     never touched from here.
  // When a clinician stops paying, Stripe keeps the subscription active to
  // the end of the paid year, so their families keep Premium until then.
  const CASEKEY = "sona.caseplan.v1";
  const CASE_RECHECK_MS = 6 * 60 * 60 * 1000;
  let _caseInFlight = null;
  function _casePlan() {
    try { const c = JSON.parse(localStorage.getItem(CASEKEY) || "null"); return (c && typeof c === "object") ? c : null; } catch (e) { return null; }
  }
  function caseCovered() { const c = _casePlan(); return !!(c && c.active === true); }
  function caseRefresh(force) {
    let code = "", ticket = "";
    try {
      // the VERIFIED code first: the ticket was minted for it, and sona.slp can
      // be overwritten by any bare ?slp= link opened later
      code = localStorage.getItem("sona.slpok") || localStorage.getItem("sona.slp") || "";
      ticket = localStorage.getItem("sona.slpticket") || "";
    } catch (e) {}
    if (!code || !ticket) return Promise.resolve(caseCovered());
    const cur = _casePlan();
    const fresh = cur && String(cur.code || "").toUpperCase() === code.toUpperCase() &&
      (Date.now() - (Number(cur.checked) || 0)) < CASE_RECHECK_MS;
    if (!force && fresh) return Promise.resolve(!!cur.active);
    // one question at a time: join.html forces a refresh right after the
    // redeem that already started one, and two answers racing is two writes
    if (_caseInFlight) return _caseInFlight;
    _caseInFlight = fetch("/api/slp/covered", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code, ticket: ticket }),
    }).then((r) => r.json()).then((j) => {
      if (j && j.ok === true && typeof j.covered === "boolean") {
        try { localStorage.setItem(CASEKEY, JSON.stringify({ active: j.covered, code: code.toUpperCase(), checked: Date.now() })); } catch (e) {}
        // A RENEWED TICKET rides every authoritative answer (24 Sep 2026).
        // Tickets expire (400 days) and only a redeem used to mint one, so a
        // healthy device reached expiry, got 401s forever and froze on its
        // last answer — Premium kept after a clinician stopped paying, or
        // never granted after they started. Storing the fresh one here means
        // a device that keeps asking never runs out of proof.
        try { if (typeof j.ticket === "string" && j.ticket && j.ticket.length < 4096) localStorage.setItem("sona.slpticket", j.ticket); } catch (e) {}
        return j.covered;
      }
      return caseCovered();                      // not an answer: change nothing
    }).catch(() => caseCovered()).then((v) => { _caseInFlight = null; return v; });
    return _caseInFlight;
  }
  // Verify a subscription by email (Stripe is the source of truth) and cache it,
  // so a paid family can unlock on a new device / after clearing storage.
  // SECURITY (F7, founder review): email-only is a weak second factor — the
  // real fix is an emailed one-time code (needs RESEND_API_KEY). The endpoint
  // is rate-limited server-side as the interim guard; the secure hand-off path
  // is the single-use move-in code, not this.
  // WEB RESTORE. Same lifecycle as iapRefresh: an authoritative answer is
  // acted on, a network failure is not. This used to grant on active and do
  // NOTHING on inactive, so a cancelled Stripe subscriber stayed unlocked
  // forever — and the restore screen would cheerfully tell them "no
  // subscription found" while the app they were holding stayed open.
  //
  // Two guards on the revoke, and both matter:
  //   • the email must be the one the cached access was granted to. Stripe
  //     answers about an ADDRESS, not a device. A parent who mistypes, or
  //     checks their partner's address, gets an honest "nothing here" about
  //     someone else's account — that says nothing about their own.
  //   • Apple-sourced access is never touched here, exactly as iapRefresh
  //     never touches Stripe's. Founder unlocks, SLP credentials, pilots and
  //     the grandfathered free eras are separate grants entirely and are not
  //     stored here at all, so they cannot be reached from this path.
  async function restore(email) {
    email = (email || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email." };
    try {
      const r = await fetch("/api/subscription?email=" + encodeURIComponent(email));
      const j = await r.json();
      if (j && j.ok && j.active) {
        saveSub({ active: true, email: email, source: "stripe", since: Date.now(), checked: Date.now() });
        return { ok: true, active: true };
      }
      if (j && j.ok) {
        try {
          const cur = getSub();
          const sameAccount = !!(cur.email && cur.email.toLowerCase() === email.toLowerCase());
          if (cur.active && sameAccount && cur.source !== "apple") saveSub({ active: false, since: 0, checked: Date.now() });
        } catch (e) {}
        return { ok: true, active: false };
      }
      return { ok: false, error: (j && j.error) || "Couldn’t check right now." };
    } catch (e) { return { ok: false, error: "Network error. Try again." }; }
  }


  // ── SLP caseload links: speaksona.com/join.html?slp=CODE&k=KEY ──────────
  // An SLP shares their credential — code (the "username") + family key (the
  // "password"). The credential is SERVER-VERIFIED: the old honor system
  // unlocked for any string in the URL, which was a paywall hole. The code
  // still sticks unverified (it keys the roster and the funnel), but the
  // enrolment ticket needs the key to check out.
  //
  // WHAT VERIFYING GRANTS CHANGED ON 24 SEP 2026. It used to write
  // earlyAdopter — free forever, on the spot. Now it earns the ticket, and the
  // ticket is what lets the server answer whether this clinician's caseload is
  // covered (caseRefresh): a covered caseload means Premium, an uncovered one
  // means the free version, which every family has anyway. Devices that
  // redeemed BEFORE this build keep what they were given — the era-four sweep
  // grandfathers them — so nobody who was already in loses anything.
  //
  // Verifying does not enrol — that takes the grown-up's explicit consent on
  // /join.html, which calls slpJoinCaseload() below. Access and surveillance
  // are separate decisions, and a family can take the app without agreeing to
  // be watched. `me` is the clinician's own one-phone token (their emailed
  // link to try Sona on their own device); only the server can read it.
  function _slpVerify(code, key, me) {
    // Mint this device's child id FIRST so the ticket can be bound to it. It
    // used to be minted later, at startPilot(), which meant every ticket was
    // code-only — and a code-only ticket is readable by every other family on
    // the same caseload. The id is a random opaque string, not a name.
    let cid = "";
    try { cid = pilotInfo().childId || ""; } catch (e) {}
    if (!cid) {
      try {
        cid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        const cur = pilotInfo(); save(PILOTKEY, Object.assign({}, cur, { childId: cid }));
      } catch (e) { cid = ""; }
    }
    const body = { code, key, childId: cid };
    if (me && /^[A-Za-z0-9_-]{8,128}$/.test(String(me))) body.me = String(me);
    return fetch("/api/slp/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()).then((j) => {
      if (j && j.ok && j.valid) {
        // slpok/slpunlock no longer grant anything by themselves, but they
        // stay: they record that the server vouched for this device, and the
        // era-four sweep and caseRefresh both read that record.
        try { localStorage.setItem("sona.slpok", code.toUpperCase()); localStorage.setItem("sona.slpunlock", "1"); } catch (e) {}
        // The enrolment ticket is this device's proof that it passed code+key.
        // /api/pilot refuses a roster write without it, which is what stops
        // anyone who merely knows the code from inventing children on a real
        // clinician's dashboard — and /api/slp/covered refuses to say whether
        // a caseload is covered to anyone who cannot show one.
        try { if (j.ticket) localStorage.setItem("sona.slpticket", String(j.ticket)); } catch (e) {}
        // a family that already finished onboarding is tagged in place — the
        // link can arrive after setup (e.g. re-sent by the SLP). The tag is a
        // label for the roster, NOT a grant: earlyAdopter is no longer
        // written here (see above).
        try { const pr = getProfile(); if (pr.onboarded || pr.childName) saveProfile({ slpCode: code.toUpperCase() }); } catch (e) {}
        // ask straight away whether this caseload is covered, so a covered
        // family opens Home with every game rather than on the next check
        try { caseRefresh(true); } catch (e) {}
        // the funnel event means A REAL FAMILY UNLOCKED — only the valid
        // branch may fire it, or the SLP ranking counts garbage
        try { track("slp code redeemed", { code: code.toUpperCase() }); } catch (e) {}
        return { valid: true, name: j.name || "" };
      }
      return { valid: false, error: (j && j.error) || "" };
    }).catch(() => ({ valid: false, error: "offline" }));
  }
  // Typed entry (join.html's form, pilot.html): same verification, same ticket.
  function slpRedeem(code, key, me) { return _slpVerify(String(code || ""), String(key || ""), me ? String(me) : ""); }

  // ── Founder access: the owners use the whole app, no paywall, any device ──
  // Server-verified against FOUNDER_KEY (same env that guards the founder
  // dashboard); the local flag is device-wide, deliberately not per-kid.
  function isFounder() { try { return localStorage.getItem("sona.founder") === "1"; } catch (e) { return false; } }
  function founderUnlock(key) {
    return fetch("/api/founder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key }),
    }).then((r) => r.json()).then((j) => {
      if (j && j.ok && j.valid) { try { localStorage.setItem("sona.founder", "1"); } catch (e) {} return { valid: true }; }
      return { valid: false, error: (j && j.error) || "" };
    }).catch(() => ({ valid: false, error: "offline" }));
  }
  try {
    const fm = (typeof location !== "undefined" ? location.search : "").match(/[?&]founder=([^&]{8,128})/);
    if (fm && localStorage.getItem("sona.founder") !== "1") founderUnlock(decodeURIComponent(fm[1]));
  } catch (e) {}
  // Either key means "the server vouched for this credential". slpok is the
  // older of the two and is written ONLY on a valid redeem, so honouring it is
  // the same trust level — not a wider door. It has to be honoured: during the
  // free window _slpVerify wrote slpok and NOT slpunlock, and the auto-verify
  // below skips re-checking a code whose slpok already matches.
  //
  // It ANSWERS "is this device on a verified caseload"; since 24 Sep 2026 it
  // no longer answers "does this family have Premium" — premium() does not
  // read it. The families it used to unlock are kept by the era-four sweep,
  // which reads these same two keys once, on the way in.
  function slpVerified() {
    try { return localStorage.getItem("sona.slpunlock") === "1" || !!localStorage.getItem("sona.slpok"); } catch (e) { return false; }
  }
  // Consented enrolment: the grown-up agreed to share this child's practice
  // with their clinician. startPilot is what makes sendProgress() actually
  // report (it no-ops without consent), so THIS is the line that puts a family
  // on an SLP's dashboard — link-joined families never hit it before, which is
  // why they were invisible to their own therapist. Separate from the unlock
  // on purpose: declining costs the family nothing.
  function slpJoinCaseload(code) {
    try {
      startPilot(String(code || "").toUpperCase());
      saveProfile({ slpCode: String(code || "").toUpperCase(), slpShare: true });
      sendProgress("enroll");
      return true;
    } catch (e) { return false; }
  }
  try {
    const q = (typeof location !== "undefined" ? location.search : "");
    const m = q.match(/[?&]slp=([A-Za-z0-9_-]{2,24})/);
    if (m) {
      const code = m[1].toUpperCase();
      localStorage.setItem("sona.slp", code);
      const km = q.match(/[?&]k=([A-Za-z0-9]{4,16})/);
      // verify once per code — the link gets bookmarked and re-tapped
      if (km && localStorage.getItem("sona.slpok") !== code) _slpVerify(code, km[1]);
    }
  } catch (e) {}
  function slpCode() { try { return localStorage.getItem("sona.slp") || ""; } catch (e) { return ""; } }

  // ── special-offer links: speaksona.com/…?offer=FOUNDING50 ────────────────
  // The landing page's founding card links through with an offer code; it
  // sticks like an SLP code so the paywall can show the founding plan to the
  // families the offer was actually made to. Honest scarcity only: the count
  // is enforced by a human retiring the link — never a countdown clock.
  try {
    const mo = (typeof location !== "undefined" ? location.search : "").match(/[?&]offer=([A-Za-z0-9_-]{2,24})/);
    if (mo) localStorage.setItem("sona.offer.v1", mo[1].toUpperCase());
  } catch (e) {}
  function offerCode() { try { return localStorage.getItem("sona.offer.v1") || ""; } catch (e) { return ""; } }

  // ── parent gate: adults-only pages ─────────────────────────────────────
  // The home screen's grown-ups gate (four number words, in today.html) calls
  // gateVerify() when the adult passes it. Parent-only pages (progress,
  // settings, talk, subscribe) call requireGate() on load so a child can't
  // reach them by direct URL or back-swipe: without a fresh pass they're sent
  // back to the home screen with the gate open — never a scary error. The
  // pass lives in sessionStorage (per tab, gone when the app closes) and
  // expires after 10 quiet minutes; every gated page load refreshes it, so an
  // adult who is actively reading is never kicked out mid-visit.
  const GATEKEY = "sona.gate.v1", GATE_TTL = 10 * 60 * 1000;
  // The pass is written to sessionStorage AND mirrored to an in-memory
  // timestamp (window.__sonaGateOk). Some browsers (private modes, blocked
  // storage) throw on sessionStorage — without the mirror, a parent who just
  // passed the gate would be bounced straight back to it.
  function gateVerify() {
    var now = Date.now();
    try { sessionStorage.setItem(GATEKEY, String(now)); } catch (e) {}
    try { window.__sonaGateOk = now; } catch (e) {}
  }
  function gateStamp() {
    var t = 0;
    try { var s = parseInt(sessionStorage.getItem(GATEKEY), 10); if (s > t) t = s; } catch (e) {}
    try { var m = window.__sonaGateOk; if (m > t) t = m; } catch (e) {}
    return t;
  }
  function gateOk() { var t = gateStamp(); var age = Date.now() - t; return !!t && age >= 0 && age < GATE_TTL; }
  // While a verified parent is on a gated page, any tap (or tab return) renews
  // the still-fresh pass so reading never re-gates mid-visit.
  var gateWatching = false;
  function gateWatch() {
    if (gateWatching) return; gateWatching = true;
    function renew() { if (gateOk()) gateVerify(); }
    try {
      document.addEventListener("click", renew, { passive: true });
      document.addEventListener("visibilitychange", renew, { passive: true });
    } catch (e) {}
  }
  // WHERE THEY WERE GOING. The gate bounces an ungated visitor to Home and
  // opens the puzzle there — and used to drop the destination on the floor. A
  // parent who tapped Done on the win screen, solved the gate, and landed on
  // Home never saw the plan screen they were sent to, and had no idea one
  // existed. So the bounce carries ?to=.
  //
  // ?to= rides inside a URL anyone can type or send, and it lands on a page
  // that sells things, so it is an ALLOWLIST and not a parameter: it may name
  // a known parent-only page and carry only its allowed copy/game selector.
  // Everything else — other origins, protocol-relative
  // "//evil.example", any other query key — is dropped, and the visitor simply
  // stays on Home.
  const GATE_DESTS = { "/premium.html": 1, "/subscribe.html": 1, "/progress.html": 1, "/settings.html": 1, "/talk.html": 1 };
  function gateDest(raw) {
    try {
      const s = String(raw || "");
      if (s.charAt(0) !== "/" || s.charAt(1) === "/") return "";   // internal only, never "//host"
      const path = s.split("?")[0].split("#")[0];
      if (!GATE_DESTS[path]) return "";
      if (path === "/premium.html") {
        var query = new URLSearchParams(s.split("?")[1] || "");
        var key = gameKey(query.get("game"));
        return path + (key ? "?game=" + key : "");
      }
      // The plan screen opened from a locked game names that game (30 Sep
      // 2026), so ?from= rides the bounce too — but only as a key the catalog
      // knows, or "library" (a locked book, "See Premium"). Anything else is
      // dropped, the same as every other query key.
      if (path === "/subscribe.html") {
        var q = new URLSearchParams(s.split("?")[1] || "");
        if (q.get("first") === "1") return path + "?first=1";
        if (q.get("setup") === "1") return path + "?setup=1";
        var from = q.get("from");
        from = from === "library" ? from : gameKey(from);
        return path + (from ? "?from=" + from : "");
      }
      return path + (/[?&]first=1(&|$)/.test(s) ? "?first=1" : "");
    } catch (e) { return ""; }
  }
  function requireGate(redirect) {
    if (gateOk()) { gateVerify(); gateWatch(); return true; }
    try { document.documentElement.style.visibility = "hidden"; } catch (e) {}
    let url = redirect || "/today.html?gate=1";
    if (!redirect) {
      try {
        const to = gateDest(location.pathname + location.search);
        if (to) url += "&to=" + encodeURIComponent(to);
      } catch (e) {}
    }
    try { location.replace(url); } catch (e) {}
    return false;
  }

  // --- recordings (the child's audio attempts) kept in IndexedDB so a parent
  //     can review them later. Best-effort: never throws into the lesson. ---
  function idb() {
    return new Promise((res, rej) => {
      try {
        const r = indexedDB.open("sona", 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("recordings")) r.result.createObjectStore("recordings", { keyPath: "id", autoIncrement: true }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  async function saveRecording(rec) {
    const kid = _slot(), day = today();
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const tx = db.transaction("recordings", "readwrite");
        // KIDS1: stamp the owning child. The store is one IndexedDB table for
        // the device, so without this a sibling's Progress page listed — and
        // played — another child's voice.
        const store = tx.objectStore("recordings");
        let saved = false;
        const request = store.openCursor();
        request.onsuccess = function () {
          const cursor = request.result;
          if (cursor) {
            const row = cursor.value;
            if ((row.kid || "") === kid && _localDay(new Date(row.date).getTime()) === day) return;
            cursor.continue(); return;
          }
          store.add(Object.assign({}, rec, { date: new Date().toISOString(), kid: kid }));
          saved = true;
        };
        tx.oncomplete = () => res(saved);
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { return false; }
  }
  async function listRecordings(limit = 50) {
    const mine = _slot();
    try {
      const db = await idb();
      return await new Promise((res) => {
        const out = [];
        const tx = db.transaction("recordings", "readonly");
        const cur = tx.objectStore("recordings").openCursor(null, "prev");
        // Only this child's clips. Rows saved before the kid stamp existed have
        // no `kid` field — they belong to the first child, whose slot is "".
        cur.onsuccess = (e) => {
          const c = e.target.result;
          if (!c) return res(out);
          if (out.length >= limit) return res(out);
          if ((c.value.kid || "") === mine) out.push(c.value);
          c.continue();
        };
        tx.onerror = () => res(out);
      });
    } catch (e) { return []; }
  }
  // Delete every clip stamped with one child's slot (removeKid, and addKid for
  // a slot an older build may have left clips under). Without it a removed
  // child's voice stayed in the device's one table, and the next child handed
  // that slot heard it — and could share it — on Progress. Best-effort like
  // every clip call: resolves to how many went, never throws.
  // Both callers are followed at once by a reload or a new page, and leaving
  // a page aborts an IndexedDB delete that has not finished: Settings' Remove
  // reloaded first, so the removed child's clips stayed on the phone every
  // time. clipsSettled() resolves once every clean-up started so far is done;
  // a page that leaves right after addKid or removeKid waits on it.
  let _clipWork = Promise.resolve();
  function clipsSettled() { return _clipWork; }
  function _dropRecordings(slot) {
    const p = _dropRecordingsNow(slot);
    _clipWork = Promise.all([_clipWork, p]).then(() => {}, () => {});
    return p;
  }
  function _dropRecordingsNow(slot) {
    slot = slot || "";
    return idb().then((db) => new Promise((res) => {
      let n = 0;
      try {
        const tx = db.transaction("recordings", "readwrite");
        const cur = tx.objectStore("recordings").openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return;
          if ((c.value.kid || "") === slot) { c.delete(); n++; }
          c.continue();
        };
        tx.oncomplete = () => res(n);
        tx.onerror = tx.onabort = () => res(0);
      } catch (e) { res(0); }
    })).catch(() => 0);
  }

  // ── juice: tiny sound effects + confetti (Web Audio + canvas, no assets) ──
  // What gives the app its Duolingo "feel": a satisfying chime on success, a
  // soft buzz on a miss, and confetti on a win. Synthesized so there are no
  // files to ship and nothing to wait on.
  let _ac = null, _master = null;
  const _sfxNodes = new Set();
  let _chimeNotes = null;   // set while a chime is being written down for the iPhone app (chimeBytes below)
  function ac() {
    try { if (!_ac) { _ac = new (window.AudioContext || window.webkitAudioContext)(); _master = _ac.createGain(); _master.gain.value = 0.9; _master.connect(_ac.destination); } if (_ac.state === "suspended") _ac.resume(); } catch (e) {}
    return _ac;
  }
  // master volume from the profile (so Sound off silences SFX too); 0 = muted
  function sfxVol() { try { const p = getProfile(); if (p.soundOn === false) return 0; return (p.volume != null ? p.volume : 0.6); } catch (e) { return 0.6; } }
  // attack: seconds to reach the peak (default 15 ms). The win chimes pass a
  // slower one so they swell in rather than snap.
  function note(freq, start, dur, type, gain, attack) {
    // a chime being written down for the iPhone app (chimeBytes below), not played
    if (_chimeNotes) { _chimeNotes.push({ f: freq, at: start, dur: dur, type: type || "sine", gain: gain || 0.18, attack: attack || 0.015 }); return; }
    const a = ac(); const v = sfxVol(); if (!a || v === 0) return;
    const t0 = a.currentTime + start;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
    const peak = (gain || 0.18) * v;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (attack || 0.015));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(_master || a.destination);
    const voice = {o, g}; _sfxNodes.add(voice);
    o.onended = () => { _sfxNodes.delete(voice); try { o.disconnect(); g.disconnect(); } catch (e) {} };
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  const tone = note; // back-comat
  const WIN_ATTACK = 0.025;
  // richer than plain beeps: core note + a soft octave/overtone shimmer
  const CHIMES = {
    tap()      { note(660, 0, 0.06, "triangle", 0.10); note(990, 0.005, 0.05, "sine", 0.04); },
    // CALMER WINS (24 Sep 2026). correct and complete are the two loudest
    // chimes and they land on the big moments, right beside Echo's voice. Each
    // gain is 3 dB down (x0.71: 0.16 -> 0.113, 0.05 -> 0.035, 0.04 -> 0.028)
    // and the attack is 25 ms instead of 15, so they swell rather than snap.
    // Durations are unchanged: pages time the mic's quiet window after them.
    correct()  { [523.25, 659.25, 783.99].forEach((f, i) => { note(f, i * 0.08, 0.18, "sine", 0.113, WIN_ATTACK); note(f * 2, i * 0.08, 0.12, "sine", 0.035, WIN_ATTACK); }); }, // warm C-E-G + shimmer
    wrong()    { note(330, 0, 0.16, "sine", 0.07); note(247, 0.1, 0.2, "sine", 0.07); },                  // gentle, never harsh
    complete() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { note(f, i * 0.1, 0.26, "sine", 0.113, WIN_ATTACK); note(f * 1.5, i * 0.1, 0.15, "sine", 0.028, WIN_ATTACK); }); },
    reward()   { [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => note(f, i * 0.08, 0.28, "triangle", 0.14)); },
    star()     { note(1046.5, 0, 0.1, "sine", 0.14); note(1568, 0.06, 0.16, "sine", 0.12); },
    coin()     { note(988, 0, 0.07, "square", 0.09); note(1319, 0.06, 0.12, "square", 0.09); },           // coin "ching"
    drop()     { note(210, 0, 0.16, "sine", 0.16); note(120, 0.04, 0.18, "sine", 0.10); },                // soft thunk
  };
  // IN THE IPHONE APP THE CHIMES ARE MEDIA TOO (2 Oct 2026), as Echo's voice,
  // Piano Tiles' notes and Bubble Pop's pops already are (mediaPCM, at the top
  // of this file, says why). The "heard you" chime lands the moment the mic
  // closes, exactly when an iPhone plays Web Audio as a quiet phone call, and
  // not at all with the ringer switched off. So the app writes each chime down
  // once, from the same recipe above, as a short recording, and plays it as a
  // media element: one element a chime, replayed from the top. The level is in
  // the samples (an iPhone gives a media element no volume): CHIME_MEDIA puts
  // the win chime's main notes (0.113) at 0.4 of full level, where a Piano
  // Tiles note and a bubble's pop sit. It was set without a phone to listen
  // on. A muted Sona plays none. A browser keeps Web Audio. An element the
  // phone refuses sends that chime, and every one after it, to Web Audio
  // rather than to silence. When a chime may play is still each page's own
  // rule (never over a mic); nothing here changes when, only how. On Sona's
  // own mic (15 Oct 2026, "Everything off") the chimes, media or Web Audio,
  // follow the ring/silent switch: THE SILENT SWITCH in the native mic block.
  const CHIME_RATE = 24000, CHIME_MEDIA = 3.6;   // the rate is what pcmWave's header says
  let _chimeBroken = false, _chimeGen = 0;
  const _chimePlayers = {};
  function chimeShape(type, ph, f) {
    if (type === "triangle") return Math.asin(Math.sin(ph)) * 0.636619772;
    if (type === "square") {
      // only the harmonics a 24 kHz recording can hold: a bare square rings false notes
      let s = 0; for (let k = 1; k * f < CHIME_RATE * 0.45; k += 2) s += Math.sin(k * ph) / k;
      return s * 1.273239545;
    }
    return Math.sin(ph);
  }
  function chimeBytes(name) {
    let notes; _chimeNotes = [];
    try { CHIMES[name](); } finally { notes = _chimeNotes; _chimeNotes = null; }
    let secs = 0; notes.forEach((n) => { secs = Math.max(secs, n.at + n.dur); });
    const total = Math.ceil(secs * CHIME_RATE), a = new Float32Array(total);
    notes.forEach((n) => {
      const i0 = Math.round(n.at * CHIME_RATE), len = Math.round(n.dur * CHIME_RATE), up = Math.max(1, Math.round(n.attack * CHIME_RATE));
      for (let i = 0; i < len && i0 + i < total; i++) {
        // the envelope note() asks Web Audio for: up from near nothing to the
        // peak over the attack, then down to near nothing at the note's end
        const env = i < up ? 0.0001 * Math.pow(n.gain / 0.0001, i / up) : n.gain * Math.pow(0.0001 / n.gain, (i - up) / Math.max(1, len - up));
        a[i0 + i] += env * chimeShape(n.type, 6.283185307 * n.f * i / CHIME_RATE, n.f);
      }
    });
    const bytes = new Uint8Array(total * 2), dv = new DataView(bytes.buffer);
    for (let i = 0; i < total; i++) dv.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, a[i] * CHIME_MEDIA)) * 32767), true);
    return bytes;
  }
  function chime(name) {
    if (_chimeBroken || !voiceAsMedia()) { CHIMES[name](); return; }
    if (sfxVol() === 0) return;   // nothing to turn down on a media element, so a muted Sona must not start one
    const gen = _chimeGen;
    // (a chime stopped by sfx.stop(), or asked for by a page already hidden,
    // also lands here, its play() cut short: that is not a refusal)
    function web() { if (gen !== _chimeGen || document.hidden) return; _chimeBroken = true; try { CHIMES[name](); } catch (e) {} }
    try {
      let p = _chimePlayers[name];
      if (!p) {
        p = new Audio(URL.createObjectURL(pcmWave(chimeBytes(name)))); p.preload = "auto";
        p.onerror = function () { _chimeBroken = true; };
        _chimePlayers[name] = p;
      }
      try { if (p.currentTime) p.currentTime = 0; } catch (e) {}
      const r = p.play();
      if (r && r.then) r.then(null, web);
    } catch (e) { web(); }
  }
  const sfx = {
    // Stop scheduled notes too, so they cannot play when an audio context wakes.
    stop() {
      for (const {o, g} of _sfxNodes) { try { o.stop(); } catch (e) {} try { o.disconnect(); g.disconnect(); } catch (e) {} } _sfxNodes.clear();
      _chimeGen++;
      for (const k in _chimePlayers) { try { _chimePlayers[k].pause(); } catch (e) {} }
    },
  };
  Object.keys(CHIMES).forEach((k) => { sfx[k] = function () { chime(k); }; });
  // Optional background music — plays a real track if /sfx/music.mp3 is added,
  // gated on a profile toggle (off by default). No synth music (would sound cheap).
  let _music = null;
  const music = {
    // Background music is gone: it fought Echo's voice, and the one thing a
    // speech app must never do is make the model harder to hear. start() is
    // kept as a no-op so the dozen game pages that call it don't need touching.
    start() {},
    stop()  { try { if (_music) _music.pause(); } catch (e) {} },
    toggle() {},
  };
  function confetti(opts) {
    opts = opts || {};
    const cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;";
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    const colors = opts.colors || ["#1cb0f6", "#ff8a3d", "#22c55e", "#ffd33d", "#ef6f23", "#1480e0"];
    const n = opts.count || 130, P = [];
    for (let i = 0; i < n; i++) P.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.4, r: 4 + Math.random() * 7, c: colors[i % colors.length], vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4.5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35 });
    let last = performance.now(), tEnd = last + (opts.duration || 2600);
    (function frame(now) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = false;
      for (const p of P) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
        if (p.y < cv.height + 20) alive = true;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore();
      }
      if (alive && now < tEnd) requestAnimationFrame(frame); else cv.remove();
    })(last);
  }
  // floating "+N XP" style popup near an element (or screen center)
  function pop(text, opts) {
    opts = opts || {};
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = "position:fixed;z-index:9998;font-family:'Baloo 2',sans-serif;font-weight:800;pointer-events:none;" +
      "font-size:" + (opts.size || 26) + "px;color:" + (opts.color || "#ff8a3d") + ";text-shadow:0 2px 0 rgba(255,255,255,.7);" +
      "left:" + (opts.x != null ? opts.x : innerWidth / 2) + "px;top:" + (opts.y != null ? opts.y : innerHeight / 2) + "px;transform:translate(-50%,-50%);transition:transform .9s ease-out,opacity .9s ease-out;opacity:1;";
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = "translate(-50%,-160%)"; el.style.opacity = "0"; });
    setTimeout(() => el.remove(), 950);
  }

  function slugify(w) { return String(w || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  // word -> picture. The emoji shows instantly; /coach/items/<word>.png swaps in ONLY
  // if it actually loads (no manifest, no broken-icon if it's missing). Drop a keyed PNG
  // in that folder named after the word (e.g. rabbit.png) and it appears everywhere — zero code.
  // ── Word stickers (design §8): flat 2-tone, white glint — the emoji-free
  // fallback for every word cue. Panel art (coach/items/<w>.png) still wins.
  const WORD_STICKERS = {
    arrow: '<path d="M22 10q22 22 0 44" fill="none" stroke="#b5875a" stroke-width="4.5" stroke-linecap="round"></path><line x1="22" y1="10" x2="22" y2="54" stroke="#f7f3ee" stroke-width="2.5"></line><line x1="14" y1="32" x2="46" y2="32" stroke="#8a5a2a" stroke-width="3.5" stroke-linecap="round"></line><path d="M46 26l12 6-12 6 3-6Z" fill="#b3b9c4"></path><rect x="10" y="26.5" width="5" height="4" rx="1.5" fill="#ff5c5c"></rect><rect x="10" y="33.5" width="5" height="4" rx="1.5" fill="#ff5c5c"></rect><circle cx="30" cy="20" r="2" fill="#fff" opacity=".75"></circle>',
    bear: '<circle cx="19" cy="22" r="7" fill="#b5875a"></circle><circle cx="45" cy="22" r="7" fill="#b5875a"></circle><circle cx="19" cy="22" r="3.4" fill="#e0b98a"></circle><circle cx="45" cy="22" r="3.4" fill="#e0b98a"></circle><circle cx="32" cy="37" r="16.5" fill="#b5875a"></circle><ellipse cx="32" cy="43" rx="8.5" ry="6.5" fill="#e0b98a"></ellipse><circle cx="26" cy="34" r="2.3" fill="#2b2a4a"></circle><circle cx="38" cy="34" r="2.3" fill="#2b2a4a"></circle><ellipse cx="32" cy="41" rx="2.6" ry="2.1" fill="#4a2c14"></ellipse><circle cx="25" cy="29" r="2.4" fill="#fff" opacity=".75"></circle>',
    bird: '<ellipse cx="46" cy="46" rx="8" ry="3.6" fill="#2a8fd4" transform="rotate(34 46 46)"></ellipse><circle cx="30" cy="34" r="15" fill="#4db3f2"></circle><ellipse cx="27" cy="41" rx="8" ry="6.5" fill="#eaf6ff"></ellipse><ellipse cx="38" cy="35" rx="5.5" ry="9" fill="#2a8fd4" transform="rotate(-24 38 35)"></ellipse><path d="M15 30l-8 3 8 3Z" fill="#ffb100"></path><circle cx="23" cy="29" r="2.2" fill="#2b2a4a"></circle><circle cx="26" cy="24" r="2.2" fill="#fff" opacity=".75"></circle>',
    car: '<path d="M20 32l3-7q1.5-3 5-3h10q3.5 0 5 3l3 7Z" fill="#ff5c5c"></path><path d="M25 31l2.4-6h9.2l2.4 6Z" fill="#cfeaff"></path><line x1="32" y1="25" x2="32" y2="31" stroke="#ff5c5c" stroke-width="2"></line><rect x="8" y="31" width="48" height="13" rx="6" fill="#ff5c5c"></rect><circle cx="20" cy="45" r="5.5" fill="#2b2a4a"></circle><circle cx="44" cy="45" r="5.5" fill="#2b2a4a"></circle><circle cx="20" cy="45" r="2.4" fill="#b3b9c4"></circle><circle cx="44" cy="45" r="2.4" fill="#b3b9c4"></circle><rect x="10" y="34" width="7" height="3" rx="1.5" fill="#ffd88a"></rect><circle cx="15" cy="29" r="2" fill="#fff" opacity=".75"></circle>',
    carrot: '<ellipse cx="24" cy="13" rx="7" ry="3.4" fill="#58cc02" transform="rotate(-32 24 13)"></ellipse><ellipse cx="40" cy="13" rx="7" ry="3.4" fill="#58cc02" transform="rotate(32 40 13)"></ellipse><ellipse cx="32" cy="11" rx="3.2" ry="6.5" fill="#6fd644"></ellipse><path d="M25 19q7-5 14 0l-4.5 34q-2.5 4-5 0Z" fill="#ff8a3d"></path><line x1="27" y1="28" x2="34" y2="27" stroke="#e5672a" stroke-width="2" stroke-linecap="round"></line><line x1="28" y1="37" x2="34" y2="36" stroke="#e5672a" stroke-width="2" stroke-linecap="round"></line><line x1="29.5" y1="46" x2="33" y2="45.5" stroke="#e5672a" stroke-width="2" stroke-linecap="round"></line><circle cx="28" cy="23" r="2" fill="#fff" opacity=".75"></circle>',
    chair: '<rect x="19" y="7" width="6" height="32" rx="3" fill="#b5875a"></rect><rect x="39" y="7" width="6" height="32" rx="3" fill="#b5875a"></rect><rect x="19" y="12" width="26" height="6" rx="3" fill="#a06f45"></rect><rect x="15" y="36" width="34" height="7" rx="3.5" fill="#b5875a"></rect><rect x="17" y="43" width="5.5" height="14" rx="2.75" fill="#a06f45"></rect><rect x="41.5" y="43" width="5.5" height="14" rx="2.75" fill="#a06f45"></rect><circle cx="24" cy="10" r="1.8" fill="#fff" opacity=".75"></circle>',
    corn: '<ellipse cx="18" cy="42" rx="6" ry="14" fill="#58cc02" transform="rotate(24 18 42)"></ellipse><ellipse cx="46" cy="42" rx="6" ry="14" fill="#58cc02" transform="rotate(-24 46 42)"></ellipse><ellipse cx="32" cy="32" rx="10" ry="21" fill="#ffd21c"></ellipse><line x1="27" y1="14" x2="27" y2="50" stroke="#f0a800" stroke-width="1.6"></line><line x1="37" y1="14" x2="37" y2="50" stroke="#f0a800" stroke-width="1.6"></line><line x1="23" y1="24" x2="41" y2="24" stroke="#f0a800" stroke-width="1.6"></line><line x1="22" y1="33" x2="42" y2="33" stroke="#f0a800" stroke-width="1.6"></line><line x1="23" y1="42" x2="41" y2="42" stroke="#f0a800" stroke-width="1.6"></line><ellipse cx="32" cy="52" rx="5" ry="6" fill="#6fd644"></ellipse><circle cx="27" cy="17" r="2" fill="#fff" opacity=".75"></circle>',
    door: '<path d="M18 16q0-8 8-8h12q8 0 8 8v40H18Z" fill="#b5875a"></path><rect x="23" y="15" width="18" height="14" rx="2.5" fill="none" stroke="#8f6a42" stroke-width="2.2"></rect><rect x="23" y="35" width="18" height="15" rx="2.5" fill="none" stroke="#8f6a42" stroke-width="2.2"></rect><circle cx="42.5" cy="33" r="2.6" fill="#ffd21c"></circle><rect x="14" y="56" width="36" height="3" rx="1.5" fill="#8f6a42"></rect><circle cx="23" cy="12" r="2" fill="#fff" opacity=".75"></circle>',
    ear: '<path d="M25 22q0-13 13-12 12 1 10 17-1.5 10-9 16-5 4-7 1" fill="none" stroke="#ffd0a8" stroke-width="9" stroke-linecap="round"></path><path d="M33 22q6-1 6 6-1 7-6 11" fill="none" stroke="#f0b184" stroke-width="3" stroke-linecap="round"></path><circle cx="30" cy="47" r="5" fill="#ffd0a8"></circle><circle cx="31" cy="14" r="2" fill="#fff" opacity=".75"></circle>',
    fork: '<rect x="29" y="28" width="6" height="28" rx="3" fill="#9aa3b0"></rect><rect x="22" y="8" width="4.5" height="15" rx="2.25" fill="#b3b9c4"></rect><rect x="29.75" y="8" width="4.5" height="15" rx="2.25" fill="#b3b9c4"></rect><rect x="37.5" y="8" width="4.5" height="15" rx="2.25" fill="#b3b9c4"></rect><path d="M22 20h20v6q0 4-4 4H26q-4 0-4-4Z" fill="#b3b9c4"></path><circle cx="26" cy="12" r="1.8" fill="#fff" opacity=".75"></circle>',
    four: '<rect x="12" y="12" width="40" height="40" rx="11" fill="#4db3f2"></rect><text x="32" y="43" text-anchor="middle" font-family="\'Baloo 2\'" font-weight="800" font-size="27" fill="#fff">4</text><circle cx="20" cy="20" r="2.6" fill="#fff" opacity=".75"></circle>',
    girl: '<circle cx="13" cy="36" r="5.5" fill="#8a5a2a"></circle><circle cx="51" cy="36" r="5.5" fill="#8a5a2a"></circle><circle cx="14" cy="30" r="2.6" fill="#ff8fa3"></circle><circle cx="50" cy="30" r="2.6" fill="#ff8fa3"></circle><circle cx="32" cy="32" r="16" fill="#8a5a2a"></circle><circle cx="32" cy="36" r="13" fill="#ffd0a8"></circle><path d="M19 32q1-14 13-14t13 14q-6-7-13-7t-13 7Z" fill="#8a5a2a"></path><circle cx="26.5" cy="36" r="2.2" fill="#4a2c14"></circle><circle cx="37.5" cy="36" r="2.2" fill="#4a2c14"></circle><circle cx="22.5" cy="41" r="2.4" fill="#ffb9c8"></circle><circle cx="41.5" cy="41" r="2.4" fill="#ffb9c8"></circle><path d="M28 43q4 3 8 0" stroke="#c97a4a" stroke-width="2" fill="none" stroke-linecap="round"></path><circle cx="38" cy="23" r="2" fill="#fff" opacity=".75"></circle>',
    kangaroo: '<path d="M18 52q-10-2-8-12" fill="none" stroke="#e0a368" stroke-width="6" stroke-linecap="round"></path><ellipse cx="30" cy="39" rx="12" ry="15" fill="#e0a368"></ellipse><path d="M20 42a11 11 0 0 0 20 3q-10 6-20-3Z" fill="#f0c896"></path><circle cx="42" cy="19" r="8" fill="#e0a368"></circle><ellipse cx="37" cy="10" rx="2.4" ry="5.5" fill="#e0a368" transform="rotate(-14 37 10)"></ellipse><ellipse cx="45" cy="9" rx="2.4" ry="5.5" fill="#e0a368" transform="rotate(10 45 9)"></ellipse><path d="M48 20l6 3-6 2Z" fill="#c9885a"></path><circle cx="43" cy="17" r="1.8" fill="#2b2a4a"></circle><ellipse cx="26" cy="55" rx="7" ry="3" fill="#c9885a"></ellipse><circle cx="37" cy="14" r="2" fill="#fff" opacity=".75"></circle>',
    parrot: '<ellipse cx="24" cy="50" rx="9" ry="4" fill="#4db3f2" transform="rotate(-38 24 50)"></ellipse><ellipse cx="20" cy="53" rx="8" ry="3.2" fill="#ffd21c" transform="rotate(-30 20 53)"></ellipse><ellipse cx="31" cy="35" rx="13" ry="17" fill="#58cc02"></ellipse><ellipse cx="25" cy="38" rx="6" ry="10" fill="#3fae14" transform="rotate(14 25 38)"></ellipse><circle cx="36" cy="24" r="10" fill="#58cc02"></circle><circle cx="39" cy="24" r="5.5" fill="#f7f3ee"></circle><circle cx="40" cy="23.5" r="2" fill="#2b2a4a"></circle><path d="M45 20q8 2 3 10-2-5-6-5Z" fill="#ff8a3d"></path><circle cx="31" cy="17" r="2.2" fill="#fff" opacity=".75"></circle>',
    rabbit: '<ellipse cx="25" cy="17" rx="5.5" ry="13" fill="#f7f3ee" transform="rotate(-10 25 17)"></ellipse><ellipse cx="39" cy="17" rx="5.5" ry="13" fill="#f7f3ee" transform="rotate(10 39 17)"></ellipse><ellipse cx="25" cy="19" rx="2.6" ry="8" fill="#ffb9c8" transform="rotate(-10 25 19)"></ellipse><ellipse cx="39" cy="19" rx="2.6" ry="8" fill="#ffb9c8" transform="rotate(10 39 19)"></ellipse><circle cx="32" cy="40" r="15" fill="#f7f3ee"></circle><circle cx="26.5" cy="38" r="2.4" fill="#4a2c14"></circle><circle cx="37.5" cy="38" r="2.4" fill="#4a2c14"></circle><path d="M30 44h4l-2 3Z" fill="#ff8fa3"></path><circle cx="26" cy="32" r="2.4" fill="#fff" opacity=".75"></circle>',
    rain: '<circle cx="23" cy="27" r="9" fill="#eef4fa"></circle><circle cx="34" cy="23" r="11" fill="#eef4fa"></circle><circle cx="44" cy="28" r="8" fill="#eef4fa"></circle><rect x="15" y="27" width="37" height="9" rx="4.5" fill="#eef4fa"></rect><path d="M22 42q4 3 0 8-4-5 0-8Z" fill="#4db3f2"></path><path d="M32 46q4 3 0 8-4-5 0-8Z" fill="#4db3f2"></path><path d="M42 42q4 3 0 8-4-5 0-8Z" fill="#4db3f2"></path><circle cx="27" cy="22" r="2.4" fill="#fff" opacity=".75"></circle>',
    ring: '<circle cx="32" cy="40" r="12" fill="none" stroke="#f0a800" stroke-width="7"></circle><circle cx="32" cy="40" r="12" fill="none" stroke="#ffd21c" stroke-width="4"></circle><path d="M32 8l9 9-9 9-9-9Z" fill="#a5e3f5"></path><path d="M32 8l9 9h-18Z" fill="#cff0fb"></path><path d="M28 4l1.5 3 1.5-3" stroke="#fff" stroke-width="1.6" fill="none"></path><circle cx="38" cy="35" r="2" fill="#fff" opacity=".75"></circle>',
    robot: '<line x1="32" y1="12" x2="32" y2="20" stroke="#9fb4d9" stroke-width="3"></line><circle cx="32" cy="9" r="3.5" fill="#ff5c5c"></circle><rect x="10" y="28" width="5" height="12" rx="2.5" fill="#7d94bd"></rect><rect x="49" y="28" width="5" height="12" rx="2.5" fill="#7d94bd"></rect><rect x="14" y="20" width="36" height="30" rx="8" fill="#9fb4d9"></rect><circle cx="24" cy="33" r="5" fill="#fff"></circle><circle cx="40" cy="33" r="5" fill="#fff"></circle><circle cx="24" cy="33" r="2.2" fill="#2b2a4a"></circle><circle cx="40" cy="33" r="2.2" fill="#2b2a4a"></circle><rect x="25" y="42" width="14" height="3.5" rx="1.75" fill="#fff" opacity=".85"></rect><circle cx="20" cy="25" r="2.2" fill="#fff" opacity=".75"></circle>',
    rock: '<path d="M11 49l7-19q14-13 28 0l7 19q-21 8-42 0Z" fill="#b3b9c4"></path><path d="M22 30l10-8 9 8-9 7Z" fill="#d0d5dd"></path><path d="M11 49l7-19 4 10-5 11Z" fill="#9aa3b0"></path><circle cx="38" cy="26" r="2.2" fill="#fff" opacity=".75"></circle>',
    rocket: '<path d="M20 42l-8 12 13-4Z" fill="#ff5c5c"></path><path d="M44 42l8 12-13-4Z" fill="#ff5c5c"></path><path d="M32 5c9 7 12 22 8 41H24c-4-19-1-34 8-41Z" fill="#f0f0f5"></path><path d="M32 5c5 4 8 10 9 17H23c1-7 4-13 9-17Z" fill="#ff5c5c"></path><circle cx="32" cy="31" r="6" fill="#4db3f2"></circle><circle cx="32" cy="31" r="6" fill="none" stroke="#d0d5dd" stroke-width="2"></circle><path d="M26 46q6 12 12 0-6 4-12 0Z" fill="#ffb100"></path><circle cx="27" cy="15" r="2.2" fill="#fff" opacity=".75"></circle>',
    rose: '<line x1="32" y1="36" x2="32" y2="58" stroke="#58cc02" stroke-width="3.5" stroke-linecap="round"></line><ellipse cx="24" cy="50" rx="6" ry="3.4" fill="#58cc02" transform="rotate(-28 24 50)"></ellipse><circle cx="21.5" cy="28" r="6.5" fill="#e84663"></circle><circle cx="42.5" cy="28" r="6.5" fill="#e84663"></circle><circle cx="32" cy="24" r="12" fill="#ff5470"></circle><path d="M32 24m-6.5 1a6.5 6.5 0 1 1 6.5 6.5" fill="none" stroke="#d63a5a" stroke-width="2.4" stroke-linecap="round"></path><circle cx="26" cy="18" r="2.2" fill="#fff" opacity=".75"></circle>',
    shark: '<path d="M28 22q0-10 10-11-3 6-1 11Z" fill="#8fa8bd"></path><path d="M10 35q-7-8-6-14 7 3 11 8Z" fill="#8fa8bd"></path><path d="M10 35q-7 8-6 14 7-3 11-8Z" fill="#8fa8bd"></path><path d="M8 35q8-13 26-13 15 0 22 11-2 4-8 7-14 6-30 2-7-2-10-7Z" fill="#8fa8bd"></path><path d="M24 41q12 4 24 0l-4 4q-9 2-16 0Z" fill="#e8eff5"></path><circle cx="46" cy="30" r="2.4" fill="#2b2a4a"></circle><path d="M38 28v8M42 28.5v8" stroke="#7691a8" stroke-width="1.8" stroke-linecap="round"></path><circle cx="30" cy="27" r="2.4" fill="#fff" opacity=".75"></circle>',
    star: '<path d="M32 5l8.2 18.6L60 25.8 44.9 39.2 49.8 59 32 48.4 14.2 59l4.9-19.8L4 25.8l19.8-2.2Z" fill="#ffd21c"></path><circle cx="25" cy="21" r="3" fill="#fff" opacity=".85"></circle>',
    tiger: '<circle cx="19" cy="21" r="6.5" fill="#ff8a3d"></circle><circle cx="45" cy="21" r="6.5" fill="#ff8a3d"></circle><circle cx="19" cy="21" r="3" fill="#fff"></circle><circle cx="45" cy="21" r="3" fill="#fff"></circle><circle cx="32" cy="37" r="16.5" fill="#ff8a3d"></circle><rect x="29.8" y="20.5" width="4.4" height="7" rx="2.2" fill="#d96a1e"></rect><rect x="14.5" y="33" width="7" height="4" rx="2" fill="#d96a1e"></rect><rect x="42.5" y="33" width="7" height="4" rx="2" fill="#d96a1e"></rect><ellipse cx="32" cy="43" rx="8.5" ry="6.5" fill="#fff"></ellipse><circle cx="26" cy="34" r="2.3" fill="#2b2a4a"></circle><circle cx="38" cy="34" r="2.3" fill="#2b2a4a"></circle><path d="M29.5 41h5l-2.5 3Z" fill="#ff8fa3"></path><circle cx="25" cy="29" r="2.4" fill="#fff" opacity=".75"></circle>',
    tree: '<circle cx="32" cy="21" r="13" fill="#58cc02"></circle><circle cx="20" cy="30" r="10" fill="#58cc02"></circle><circle cx="44" cy="30" r="10" fill="#58cc02"></circle><circle cx="32" cy="30" r="11" fill="#6fd644"></circle><rect x="28" y="38" width="8" height="18" rx="3.5" fill="#8a5a2a"></rect><path d="M32 44l-7-6M32 48l6-7" stroke="#8a5a2a" stroke-width="3" stroke-linecap="round"></path><circle cx="26" cy="16" r="2.6" fill="#fff" opacity=".75"></circle>',
    water: '<path d="M32 6q15 22 15 35a15 15 0 1 1-30 0Q17 28 32 6Z" fill="#4db3f2"></path><path d="M24 40q0 8 7 10-9 1-11-8 0-4 4-2Z" fill="#fff" opacity=".55"></path><circle cx="26" cy="30" r="2.6" fill="#fff" opacity=".75"></circle>',
    zero: '<rect x="12" y="12" width="40" height="40" rx="11" fill="#4db3f2"></rect><text x="32" y="43" text-anchor="middle" font-family="\'Baloo 2\'" font-weight="800" font-size="27" fill="#fff">0</text><circle cx="20" cy="20" r="2.6" fill="#fff" opacity=".75"></circle>',
  };
  // Animal faces for the sound-story covers (design §8), buddy-cast style.
  const COVER_FACES = {
    R: '<ellipse cx="25" cy="17" rx="5.5" ry="13" fill="#f7f3ee" transform="rotate(-10 25 17)"></ellipse><ellipse cx="39" cy="17" rx="5.5" ry="13" fill="#f7f3ee" transform="rotate(10 39 17)"></ellipse><ellipse cx="25" cy="19" rx="2.6" ry="8" fill="#ffb9c8" transform="rotate(-10 25 19)"></ellipse><ellipse cx="39" cy="19" rx="2.6" ry="8" fill="#ffb9c8" transform="rotate(10 39 19)"></ellipse><circle cx="32" cy="40" r="15" fill="#f7f3ee"></circle><circle cx="26.5" cy="38" r="2.4" fill="#4a2c14"></circle><circle cx="37.5" cy="38" r="2.4" fill="#4a2c14"></circle><path d="M30 44h4l-2 3Z" fill="#ff8fa3"></path><circle cx="26" cy="32" r="2.4" fill="#fff" opacity=".75"></circle>',
    S: '<circle cx="32" cy="36" r="17" fill="#8fb9d6"></circle><ellipse cx="32" cy="43" rx="9.5" ry="7" fill="#e8f2fa"></ellipse><circle cx="26" cy="33" r="2.4" fill="#2b2a4a"></circle><circle cx="38" cy="33" r="2.4" fill="#2b2a4a"></circle><ellipse cx="32" cy="40" rx="3" ry="2.4" fill="#2b2a4a"></ellipse><circle cx="26" cy="44" r="1" fill="#8fb9d6"></circle><circle cx="23" cy="46" r="1" fill="#8fb9d6"></circle><circle cx="38" cy="44" r="1" fill="#8fb9d6"></circle><circle cx="41" cy="46" r="1" fill="#8fb9d6"></circle><circle cx="25" cy="27" r="2.6" fill="#fff" opacity=".75"></circle>',
    L: '<circle cx="32" cy="36" r="19" fill="#e8933c"></circle><circle cx="20" cy="26" r="6" fill="#e8933c"></circle><circle cx="44" cy="26" r="6" fill="#e8933c"></circle><circle cx="14" cy="38" r="5" fill="#e8933c"></circle><circle cx="50" cy="38" r="5" fill="#e8933c"></circle><circle cx="20" cy="49" r="5" fill="#e8933c"></circle><circle cx="44" cy="49" r="5" fill="#e8933c"></circle><circle cx="32" cy="37" r="13.5" fill="#ffce6b"></circle><ellipse cx="32" cy="43" rx="7.5" ry="5.5" fill="#ffe6b3"></ellipse><circle cx="27" cy="34" r="2.3" fill="#4a2c14"></circle><circle cx="37" cy="34" r="2.3" fill="#4a2c14"></circle><path d="M29.5 41h5l-2.5 3Z" fill="#8a5a2a"></path><circle cx="26" cy="30" r="2.2" fill="#fff" opacity=".75"></circle>',
    K: '<circle cx="15" cy="27" r="9" fill="#a8b4c0"></circle><circle cx="49" cy="27" r="9" fill="#a8b4c0"></circle><circle cx="15" cy="27" r="4.5" fill="#ffb9c8"></circle><circle cx="49" cy="27" r="4.5" fill="#ffb9c8"></circle><circle cx="32" cy="38" r="16" fill="#b8c4d0"></circle><ellipse cx="32" cy="41" rx="4.8" ry="6.5" fill="#4a4a5a"></ellipse><circle cx="25" cy="34" r="2.3" fill="#2b2a4a"></circle><circle cx="39" cy="34" r="2.3" fill="#2b2a4a"></circle><circle cx="25" cy="29" r="2.4" fill="#fff" opacity=".75"></circle>',
    SH: '<circle cx="22" cy="28" r="8" fill="#f7f3ee"></circle><circle cx="32" cy="24" r="9" fill="#f7f3ee"></circle><circle cx="42" cy="28" r="8" fill="#f7f3ee"></circle><circle cx="18" cy="37" r="7" fill="#f7f3ee"></circle><circle cx="46" cy="37" r="7" fill="#f7f3ee"></circle><ellipse cx="13" cy="40" rx="5" ry="3.4" fill="#ffdcb8" transform="rotate(-16 13 40)"></ellipse><ellipse cx="51" cy="40" rx="5" ry="3.4" fill="#ffdcb8" transform="rotate(16 51 40)"></ellipse><ellipse cx="32" cy="41" rx="11" ry="10" fill="#ffdcb8"></ellipse><circle cx="27" cy="39" r="2.2" fill="#4a2c14"></circle><circle cx="37" cy="39" r="2.2" fill="#4a2c14"></circle><ellipse cx="30" cy="46" rx="1.2" ry="1.7" fill="#e0a368"></ellipse><ellipse cx="34" cy="46" rx="1.2" ry="1.7" fill="#e0a368"></ellipse><circle cx="27" cy="26" r="2.4" fill="#fff" opacity=".75"></circle>',
    CH: '<ellipse cx="28" cy="17" rx="2.4" ry="5" fill="#ffd94d" transform="rotate(-18 28 17)"></ellipse><ellipse cx="34" cy="16" rx="2.4" ry="5" fill="#ffd94d" transform="rotate(12 34 16)"></ellipse><circle cx="32" cy="38" r="16" fill="#ffd94d"></circle><circle cx="26" cy="35" r="2.3" fill="#4a2c14"></circle><circle cx="38" cy="35" r="2.3" fill="#4a2c14"></circle><path d="M28.5 40h7l-3.5 4.5Z" fill="#ff8a3d"></path><circle cx="21" cy="42" r="3" fill="#ffb9c8"></circle><circle cx="43" cy="42" r="3" fill="#ffb9c8"></circle><circle cx="25" cy="30" r="2.4" fill="#fff" opacity=".75"></circle>',
    TH: '<circle cx="32" cy="37" r="16.5" fill="#c9a878"></circle><ellipse cx="32" cy="39" rx="11.5" ry="10" fill="#f0dcc0"></ellipse><ellipse cx="25" cy="35" rx="6" ry="3.4" fill="#8a6844" transform="rotate(-24 25 35)"></ellipse><ellipse cx="39" cy="35" rx="6" ry="3.4" fill="#8a6844" transform="rotate(24 39 35)"></ellipse><circle cx="26.5" cy="36" r="1.9" fill="#2b2a4a"></circle><circle cx="37.5" cy="36" r="1.9" fill="#2b2a4a"></circle><ellipse cx="32" cy="42" rx="2.6" ry="2" fill="#4a2c14"></ellipse><path d="M28 46q4 2.6 8 0" stroke="#8a6844" stroke-width="1.8" fill="none" stroke-linecap="round"></path><circle cx="26" cy="28" r="2.4" fill="#fff" opacity=".75"></circle>',
    G: '<path d="M20 20q-8-2-9-11 8 1 12 8Z" fill="#d9b78f"></path><path d="M44 20q8-2 9-11-8 1-12 8Z" fill="#d9b78f"></path><ellipse cx="14" cy="34" rx="6" ry="3.6" fill="#ece7de" transform="rotate(-18 14 34)"></ellipse><ellipse cx="50" cy="34" rx="6" ry="3.6" fill="#ece7de" transform="rotate(18 50 34)"></ellipse><circle cx="32" cy="37" r="15" fill="#ece7de"></circle><ellipse cx="32" cy="44" rx="8" ry="6" fill="#fbf7f0"></ellipse><circle cx="26.5" cy="34" r="2.2" fill="#4a2c14"></circle><circle cx="37.5" cy="34" r="2.2" fill="#4a2c14"></circle><ellipse cx="29.5" cy="44" rx="1.2" ry="1.8" fill="#c9a878"></ellipse><ellipse cx="34.5" cy="44" rx="1.2" ry="1.8" fill="#c9a878"></ellipse><path d="M29 53h6l-3 6Z" fill="#d9b78f"></path><circle cx="26" cy="29" r="2.4" fill="#fff" opacity=".75"></circle>',
    F: '<path d="M17 12l9 11-13 4Z" fill="#ff8a3d"></path><path d="M47 12l-9 11 13 4Z" fill="#ff8a3d"></path><path d="M20 16l5 7-8 2.5Z" fill="#e5672a"></path><path d="M44 16l-5 7 8 2.5Z" fill="#e5672a"></path><circle cx="32" cy="38" r="16" fill="#ff8a3d"></circle><ellipse cx="32" cy="45" rx="8.5" ry="6.5" fill="#fff"></ellipse><circle cx="26" cy="36" r="2.3" fill="#4a2c14"></circle><circle cx="38" cy="36" r="2.3" fill="#4a2c14"></circle><ellipse cx="32" cy="43" rx="2.4" ry="2" fill="#4a2c14"></ellipse><circle cx="25" cy="30" r="2.4" fill="#fff" opacity=".75"></circle>',
  };
  function pic(word, emoji, size) {
    size = size || 64; var em = emoji || "⭐"; var slug = slugify(word);
    var stick = WORD_STICKERS[slug];
    var sp = stick
      ? '<svg viewBox="0 0 64 64" style="width:' + size + 'px;height:' + size + 'px;vertical-align:middle;">' + stick + '</svg>'
      : '<span style="font-size:' + size + 'px;line-height:1;vertical-align:middle;">' + em + '</span>';
    if (!slug) return sp;
    return '<img src="/coach/items/' + slug + '.png" alt="" aria-hidden="true" ' +
      'style="width:' + size + 'px;height:' + size + 'px;object-fit:contain;display:none;vertical-align:middle;" ' +
      'onload="this.style.display=\'inline-block\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'none\';" ' +
      'onerror="this.remove();">' + sp;
  }
  // ── levels = a playlist of mini-games ──
  // A level is a short playlist of games played back-to-back. Tapping a level on
  // the map starts a "session"; finishing a game auto-advances to the next; after
  // the last game the child lands on the level-complete screen. The SAME games are
  // reused at every level but scale in difficulty with the level number (the rocket
  // flies farther, races get longer, more bubbles to pop…). Add new games over time
  // by appending here (or give a map node its own `queue`).
  // The core loop is Charge & Play: honest reps charge the ⚡ meter, which
  // buys an arcade round. It replaced a roster of themed speech games and a
  // level/world campaign on top of it — both are gone now, along with the
  // pages that drove them, because nothing on the home screen had linked to
  // them for a long time.
  // Per-game display info for the level-path screen (icon · name · skill band · color).
  const GAME_META = {
    "rocket.html":   { name: "Sound Rocket",  icon: "🚀",  band: "Warm-up",   c: "#1cb0f6" },
    "bubble.html":   { name: "Bubble Pop",    icon: "🫧",  band: "Syllables", c: "#27c2c2" },
    "racer.html":    { name: "Rev Racer",     icon: "🏎️", band: "Words",     c: "#9b7bff" },
    "cupstack.html": { name: "Cup Stack",     icon: "🥤",  band: "Words",     c: "#ff5d6c" },
    "whack.html":    { name: "Pop-a-Word",    icon: "🔨",  band: "Words",     c: "#58cc02" },
    "match.html":    { name: "Match-Up",      icon: "🃏",  band: "Words",     c: "#8b5cf6" },
    "builder.html":  { name: "Block Builder",  icon: "🧱",  band: "Words",     c: "#ff8c42" },
    "grocery.html":  { name: "Grocery Grab",  icon: "🛒",  band: "Words",      c: "#ff9600" },
    "train.html":    { name: "Story Train",   icon: "🚂",  band: "Sentences", c: "#2ec4d6" },
    "story.html":    { name: "Story Time",    icon: "📖",  band: "Story",     c: "#7cc40a" },
    "chat.html":     { name: "Chat with Echo", icon: "💬",  band: "Talking",   c: "#e0457b" },
    "charge.html":       { name: "Charge & Play", icon: "⚡", band: "Practice", c: "#ffb100" },
    "arcade-slice.html": { name: "Fruit Slice",   icon: "🍉", band: "Arcade",   c: "#ff6b6b" },
    "arcade-stack.html": { name: "Block Stacker", icon: "🧱", band: "Arcade",   c: "#4dabf7" },
    "arcade-tiles.html": { name: "Piano Tiles",   icon: "🎹", band: "Arcade",   c: "#9775fa" },
    "arcade-run.html":   { name: "Sound Sprint",  icon: "🏃", band: "Arcade",   c: "#2f9e44" },
    "arcade-glide.html": { name: "Flappy Glide",  icon: "🎈", band: "Arcade",   c: "#4f8fc7" },
    "arcade-rise.html":  { name: "Rise Up",       icon: "🎈", band: "Arcade",   c: "#5aa6dc" },
  };
  function gameMeta(file) {
    const k = String(file || "").replace(/^\//, "").split("?")[0];
    return GAME_META[k] || { name: "Game", icon: "🎮", band: "", c: "#1cb0f6" };
  }
  // The games the daily trio is drawn from. This lived inline in today.html;
  // it moved here because dailyGames() has to pick from the same list the home
  // screen paints, and two copies of a list is one copy that goes stale.
  const GAME_ACTS = {
    slice: { name: "Fruit Slice",   sub: "Say it 5× to play",          go: "/charge.html?game=arcade-slice.html", group: "arcade", tier: "free", playDescription: "Swipe through the fruit." },
    // Free since 30 Sep 2026 (Travis: "fruit slice and piano tiles free ...
    // feed echo to be free", then "two free games for older kids, the two free
    // games for younger kids"): the free version is practice, two games for
    // each age group (these two, Feed Echo and Bubble Pop) and one book.
    // Every other game is Premium.
    tiles: { name: "Piano Tiles",   sub: "Say it 5× to play",          go: "/charge.html?game=arcade-tiles.html", group: "arcade", tier: "free", playDescription: "Tap each tile as it reaches the line." },
    // Premium since 27 Sep 2026 (Travis: once the plan screen has been seen,
    // "all the other games are ... grayed out except they can replay feed echo
    // and fruit slice"). Only matters when pricing is on; free while Sona is.
    stack: { name: "Block Stacker", sub: "Say it 5× to play",          go: "/charge.html?game=arcade-stack.html", group: "arcade", tier: "premium", playDescription: "Time your tap to stack the blocks." },
    run:   { name: "Sound Sprint",  sub: "Say it 5× to play",          go: "/charge.html?game=arcade-run.html", group: "arcade", tier: "premium", playDescription: "Switch lanes and collect coins." },
    glide: { name: "Flappy Glide",  sub: "Say it 5× to play",          go: "/charge.html?game=arcade-glide.html", group: "arcade", tier: "premium", playDescription: "Tap to glide through the gaps." },
    // Rise Up (Travis, 9 Oct 2026: "lets build the game rise up"): a round game like Flappy Glide, entered through its practice page; adventure: false keeps it out of the old five-game run.
    rise:  { name: "Rise Up",       sub: "Say it 5× to play",          go: "/charge.html?game=arcade-rise.html", group: "arcade", tier: "premium", adventure: false, playDescription: "Drag the shield to keep your balloon safe." },
    feed:  { name: "Feed Echo",     sub: "Say it & tap — Echo's hungry!", go: "/arcade-feed.html", group: "simple", tier: "free", playDescription: "Find the picture and feed Echo. No timer." },
    // Back from Coming soon on 30 Sep 2026 (Travis: "the two free games for
    // older kids, the two free games for younger kids"): with Feed Echo, the
    // free version's games for ages 3-4. No release date, so no New shelf.
    // Rebuilt on 1 Oct 2026 ("Say it, and Echo blows bubbles") on the Say &
    // Play engine, but NOT a `say` game: that flag would list it twice on
    // Home, point its sticker at one that does not exist, and take it out of
    // the little kids' adventure deck. Its page keeps that adventure's hand-off.
    bubbles: { name: "Bubble Pop", sub: "Say it, and Echo blows bubbles", go: "/arcade-bubbles.html", group: "simple", tier: "free", playDescription: "Say the word. Echo blows bubbles, and you pop them all." },
    peekaboo: { name: "Peekaboo", sub: "Say it, then find the picture", go: "/arcade-peekaboo.html", group: "simple", tier: "premium", comingSoon: true, releasedOn: "2026-09-21", playDescription: "Say the word to hide a picture behind a door. Watch the doors move, then tap the right one." },
    // Say & Play (Travis, 26 Sep 2026: "10 more games for ages 3-4 and 10
    // more games for ages 5-8 ... incorporating practice into it"). Every
    // word the child says moves the game one step, so each opens straight to
    // its game; public/sayplay.js is the one engine behind all twenty, and
    // tools/gameart/ draws them. They are not in the daily adventure (see
    // adventureGames), and a spoken move is play, never practice data.
    //
    // PARKED AS COMING SOON (Travis, 26 Sep 2026: "these games are not good.
    // they are essentially all the exact same ... put the 20 games as coming
    // soon"). None let a child PLAY. Each comes back one at a time, rebuilt
    // and played by Travis first, by taking comingSoon off its own line.
    // Since 19 Oct 2026 Home draws no parked game (Travis: the greyed cards
    // cluttered Home); a typed address to one bounces home with "<Game> is
    // coming soon".
    //
    // TWO FRIDAYS (Travis, 1 Oct 2026: "I don't want all these books and
    // games to have different dates ... split them and have like seven or
    // eight for next Friday and then seven or eight for the following
    // Friday"). From 9 Oct 2026 each parked game carried a Friday
    // (`comingOn`, three a week from 16 Oct to 20 Nov); since 15 Oct 2026
    // (Travis: "put coming soon") none does. The support stays, as the
    // bookshelf keeps `opens`: `comingOn: "2026-11-06"` on one line makes the
    // bounce note say "coming Nov 6" until that day, then "coming soon"
    // again. It is a LABEL, never a switch: only taking comingSoon off opens
    // a game.
    balloon: { name: "Balloon Party", sub: "Say it, then pump and float", go: "/arcade-balloon.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to get a balloon. Pump it up and pull it into the party ring." },
    flower: { name: "Grow a Flower", sub: "Say it, then water the flower", go: "/arcade-flower.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to fill the watering can. Hold it over the glowing soil to help the flower grow." },
    rocket: { name: "Rocket Blast", sub: "Say it, then blast off", go: "/arcade-rocket.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to get a rocket. Pull it back and let go to fly to a planet." },
    snowman: { name: "Build a Snowman", sub: "Say it, then roll and stack", go: "/arcade-snowman.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to get a snowball. Roll it big, stack it and dress your snowman." },
    train: { name: "Choo-Choo Train", sub: "Say it, then drive and stop", go: "/arcade-train.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to start the train. Drive to the station, stop, and help a friend aboard." },
    puppy: { name: "Puppy Bath", sub: "Say it, then wash the puppy", go: "/arcade-puppy.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to find a muddy spot. Aim the water and wash it clean." },
    stars: { name: "Bedtime Stars", sub: "Say it, then draw in the stars", go: "/arcade-stars.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to start a picture. Slide from star to star to draw it in the sky." },
    cake: { name: "Birthday Cake", sub: "Say it, then bake a cake", go: "/arcade-cake.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to start each step. Stir, pour, ice and decorate your own birthday cake." },
    gifts: { name: "Surprise Boxes", sub: "Say it, then open a present", go: "/arcade-gifts.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to get a present. Pull, peel and lift to open it." },
    fishtank: { name: "Fish Tank", sub: "Say it, then feed a fish", go: "/arcade-fishtank.html", group: "simple", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to get fish food. Drop it above a hungry fish and watch it eat." },
    racecar: { name: "Race Car", sub: "Say it, then steer and race", go: "/arcade-racecar.html", group: "arcade", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to drive the next stretch. Steer around cones and into the glowing ring." },
    treasure: { name: "Treasure Map", sub: "Say it, then draw a route", go: "/arcade-treasure.html", group: "arcade", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to set sail. Draw your boat a path around the islands to the next harbour." },
    // REBUILT (Travis, 1 Oct 2026: "go finish soccer"): the word earns the
    // ball and the child swipes it past a goalie who slides along the goal
    // line (public/soccer.js).
    soccer: { name: "Soccer Goal", sub: "Say it, then kick!", go: "/arcade-soccer.html", group: "arcade", tier: "premium", say: true, playDescription: "Say the word to get the ball, then swipe up to kick it past the goalie." },
    // REBUILT (Travis, 26 Sep 2026: "yes build hoops"): the word earns the
    // ball and the child swipes it into a gliding hoop (public/hoops.js).
    hoops: { name: "Hoops", sub: "Say it, then shoot!", go: "/arcade-hoops.html", group: "arcade", tier: "premium", say: true, playDescription: "Say the word to get the ball, then swipe up to shoot hoops." },
    robot: { name: "Robot Builder", sub: "Say it, then connect the wires", go: "/arcade-robot.html", group: "arcade", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to open a circuit. Turn the wires to power each robot part." },
    castle: { name: "Castle Builder", sub: "Say it, then hoist a piece", go: "/arcade-castle.html", group: "arcade", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to get a castle piece. Slide the crane over the glow and lower it in." },
    // REBUILT (Travis, 1 Oct 2026: "go to the next game"): the word earns a
    // brush and the child rubs the sand off a bone (public/dino.js).
    dino: { name: "Dino Dig", sub: "Say it, then dig!", go: "/arcade-dino.html", group: "arcade", tier: "premium", say: true, playDescription: "Say the word to get a brush, then rub the sand to dig up a dinosaur bone." },
    space: { name: "Space Trip", sub: "Say it, then fly and land", go: "/arcade-space.html", group: "arcade", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to start a flight. Steer the rocket and land softly on the glowing pad." },
    pizza: { name: "Pizza Chef", sub: "Say it, then cook the pizza", go: "/arcade-pizza.html", group: "arcade", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to start each step. Roll, spread, top, bake and slice your own pizza." },
    monster: { name: "Monster Makeover", sub: "Say it, then style the monster", go: "/arcade-monster.html", group: "arcade", tier: "premium", say: true, comingSoon: true, playDescription: "Say the word to get the next salon tool. Wash, brush and style a friendly monster." },
  };
  // Catalog access is separate from the speech needed to earn an arcade turn.
  // Free access opens released games; unfinished games stay parked for everyone.
  // Preserve the existing story and mystery deck; new library games stand alone.
  const GAME_KEYS = ["slice", "tiles", "stack", "run", "glide", "feed"];
  // The Say & Play games list themselves (say: true), in catalog order. A
  // playable one comes before every parked one (Home draws only the playable
  // ones since 19 Oct 2026: each shelf is those, in this order).
  const SAY_KEYS = Object.keys(GAME_ACTS).filter(function (key) { return GAME_ACTS[key].say; });
  const ACTIVITY_KEYS = GAME_KEYS.concat(
    SAY_KEYS.filter(function (key) { return !GAME_ACTS[key].comingSoon; }),
    SAY_KEYS.filter(function (key) { return GAME_ACTS[key].comingSoon; }),
    ["bubbles", "peekaboo", "rise"]);
  function gameAct(key) { return GAME_ACTS[key] || null; }

  const LIBRARY_PREVIEW_KEY = "sona.librarypreview.v1", PREVIEW_PLAN_KEY = "sona.previewplan.v1";
  function libraryPreview() {
    try {
      if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(global.location.hostname)) return false;
      var q = new URLSearchParams(global.location.search), flag = q.get("libraryPreview");
      if (flag === "0") {
        sessionStorage.removeItem(LIBRARY_PREVIEW_KEY);
        sessionStorage.removeItem(PREVIEW_PLAN_KEY);
        return false;
      }
      if (flag === "1") sessionStorage.setItem(LIBRARY_PREVIEW_KEY, "1");
      return sessionStorage.getItem(LIBRARY_PREVIEW_KEY) === "1";
    } catch (e) { return false; }
  }
  function previewPlan() {
    var empty = { state: "free", endsAt: 0 };
    if (!libraryPreview()) return empty;
    try {
      var p = JSON.parse(sessionStorage.getItem(PREVIEW_PLAN_KEY) || "null");
      if (!p || ["free", "trial", "expired"].indexOf(p.state) < 0) return empty;
      var end = Number(p.endsAt) || 0;
      if (p.state === "trial") return { state: end > Date.now() ? "trial" : "expired", endsAt: end };
      return { state: p.state, endsAt: end };
    } catch (e) { return empty; }
  }
  function setPreviewPlan(state) {
    if (!libraryPreview() || !gateOk() || ["free", "trial", "expired"].indexOf(state) < 0) return false;
    try {
      sessionStorage.setItem(PREVIEW_PLAN_KEY, JSON.stringify({ state: state,
        endsAt: state === "trial" ? Date.now() + 3 * 86400000 : state === "expired" ? Date.now() - 1 : 0 }));
      return true;
    } catch (e) { return false; }
  }
  // Only catalog keys enter links or access decisions. Paths and return URLs
  // are deliberately not accepted here, even when they point to this origin.
  function gameKey(value) {
    return typeof value === "string" && ACTIVITY_KEYS.indexOf(value) >= 0 ? value : "";
  }
  function catalogRun() {
    try {
      var r = JSON.parse(sessionStorage.getItem(RUNKEY) || "null");
      if (!r || !r.active || !Array.isArray(r.games) || r.games.length !== ROT_LEN ||
          !r.games.every(function (key) { return !!gameKey(key); }) ||
          typeof r.round !== "number" || Math.floor(r.round) !== r.round || r.round < 0 || r.round > r.games.length) return null;
      return r;
    } catch (e) { return null; }
  }
  function gameAccess(key, options) {
    key = gameKey(key);
    var act = key && GAME_ACTS[key], preview = libraryPreview();
    var result = { allowed: false, tier: act ? act.tier : "premium", reason: "unknown", preview: preview };
    function allow(reason) { result.allowed = true; result.reason = reason; return result; }
    if (!act || act.available === false) return result;
    // Unfinished games cannot be unlocked by a plan, saved turn or old link.
    if (act.comingSoon) { result.reason = "coming-soon"; return result; }
    // the free tier opens with the free version only (see freeVersion)
    if (act.tier === "free" && (preview || freeVersion())) return allow("free");
    if (preview) {
      if (previewPlan().state === "trial") return allow("trial");
    } else {
      if (isFree()) return allow("free-mode");
      if (premium()) return allow("entitled");
      if (trialActive()) return allow("trial");
    }
    // Keep matching earned turns within a saved adventure across expiration:
    // charge resumes its original plan, and each finished turn is banked once.
    // A saved adventure never grants unrelated Premium choices in the library.
    var run = options && options.run ? catalogRun() : null;
    if (run && (run.simpleComplete === run.round || (run.arcadeComplete && run.arcadeComplete.round === run.round))) {
      result.reason = "completed"; return result;
    }
    if (options && options.earned) {
      try {
        var file = "arcade-" + key + ".html";
        if (sessionStorage.getItem("sona.play.token") === file || sessionStorage.getItem("sona.play.active") === file) return allow("earned");
      } catch (e) {}
    }
    if (run && run.games[run.round] === key && (run.pending || (run.ready && run.ready.round === run.round))) return allow("run");
    result.reason = preview && previewPlan().state === "expired" ? "expired" : "premium";
    return result;
  }
  function finishGameTurn(key, dailyScore) {
    key = gameKey(key); if (!key) return;
    try {
      var file = "arcade-" + key + ".html";
      if (sessionStorage.getItem("sona.play.token") === file) sessionStorage.removeItem("sona.play.token");
      if (sessionStorage.getItem("sona.play.active") === file) sessionStorage.removeItem("sona.play.active");
      var run = typeof dailyScore === "number" && isFinite(dailyScore) ? catalogRun() : null;
      if (run && run.pending && run.games[run.round] === key && !(run.arcadeComplete && run.arcadeComplete.round === run.round)) {
        run.arcadeComplete = { round: run.round, score: Math.max(0, dailyScore | 0) };
        sessionStorage.setItem(RUNKEY, JSON.stringify(run));
      }
    } catch (e) {}
  }
  function gameBounce(key) {
    try { location.replace("/activities.html" + (gameKey(key) ? "?locked=" + key : "")); } catch (e) {}
  }

  // Age suggests a style of play, never access or a speech target. Keep this
  // catalog separate from the daily adventure and its practice progression.
  const ACTIVITY_GROUPS = [
    { id: "simple", name: "Simple play", ageLabel: "Suggested ages 3–4", description: "Little taps. Big discoveries." },
    { id: "arcade", name: "Arcade", ageLabel: "Suggested ages 5–8", description: "A little more action and adventure." },
  ];
  // The books Home's top rows can show. releasedOn: the day it came out (it
  // sits under What's new for 30 days). season: { startsOn, endsOn } puts it
  // under Limited time for that window instead. Folder = public/assets/books/<slug>.
  const HOME_BOOKS = [
    // Existing covers can be daily picks too; no release date is invented.
    { slug: "rory-rainbow", title: "Rory and the Rainbow", sound: "R" },
    { slug: "penny-pebble-party", title: "Penny's Pebble Party", sound: "P" },
    { slug: "bo-beach-day", title: "Bo's Beach Day", sound: "B" },
    { slug: "mia-makes-muffins", title: "Mia Makes Muffins", sound: "M" },
    { slug: "ned-needs-a-net", title: "Ned Needs a Net", sound: "N" },
    { slug: "toby-tiny-tuba", title: "Toby's Tiny Tuba", sound: "T" },
    { slug: "dot-digs-a-pool", title: "Dot Digs a Pool", sound: "D" },
    { slug: "kip-kite", title: "Kip's Kite", sound: "K" },
    { slug: "goldie-guitar", title: "Goldie's Guitar", sound: "G" },
    { slug: "finn-finds-a-feather", title: "Finn Finds a Feather", sound: "F" },
    { slug: "val-the-van", title: "Val the Van", sound: "V" },
    { slug: "sid-the-seagull", title: "Sid the Seagull", sound: "S" },
    { slug: "zoe-and-the-zipper", title: "Zoe and the Zipper", sound: "Z" },
    { slug: "shay-the-shy-shark", title: "Shay the Shy Shark", sound: "SH" },
    { slug: "chip-the-chipmunk", title: "Chip the Chipmunk", sound: "CH" },
    { slug: "jax-and-the-jam-jar", title: "Jax and the Jam Jar", sound: "J" },
    { slug: "leo-lucky-leaf", title: "Leo's Lucky Leaf", sound: "L" },
    { slug: "theo-thunder-day", title: "Theo's Thunder Day", sound: "TH" },
    { slug: "this-bear-that-bee", title: "This Bear, That Bee", sound: "THV" },
    { slug: "rosie-red-wagon", title: "Rosie and the Red Wagon", sound: "R", releasedOn: "2026-10-01" },
    { slug: "ray-lost-ring", title: "Ray and the Lost Ring", sound: "R", releasedOn: "2026-10-01" },
    { slug: "sam-sailboat", title: "Sam's Sailboat", sound: "S", releasedOn: "2026-10-01" },
    { slug: "sophie-silly-soup", title: "Sophie's Silly Soup", sound: "S", releasedOn: "2026-10-01" },
    { slug: "libby-lemon", title: "Libby and the Lemon", sound: "L", releasedOn: "2026-10-01" },
    { slug: "leon-lantern", title: "Leon's Lantern", sound: "L", releasedOn: "2026-10-01" },
    { slug: "shane-shiny-shell", title: "Shane and the Shiny Shell", sound: "SH", releasedOn: "2026-10-01" },
    { slug: "shawn-shadow", title: "Shawn and His Shadow", sound: "SH", releasedOn: "2026-10-01" },
    { slug: "thor-thank-you", title: "Thor Says Thank You", sound: "TH", releasedOn: "2026-10-01" },
    { slug: "thelma-thirsty-plant", title: "Thelma's Thirsty Plant", sound: "TH", releasedOn: "2026-10-01" },
    { slug: "boo-bat-halloween", title: "Boo the Bat on Halloween", sound: "B", anySound: true, season: { startsOn: "2026-10-01", endsOn: "2026-10-31" } },
    { slug: "rory-halloween", title: "Rory the Rabbit on Halloween", sound: "R", season: { startsOn: "2026-10-01", endsOn: "2026-10-31" } },
    { slug: "sid-halloween", title: "Sid the Seagull on Halloween", sound: "S", season: { startsOn: "2026-10-01", endsOn: "2026-10-31" } },
    { slug: "leon-halloween", title: "Leon's Trick-or-Treat Night", sound: "L", season: { startsOn: "2026-10-01", endsOn: "2026-10-31" } },
    { slug: "zoe-halloween", title: "Zoe the Zebra on Halloween", sound: "Z", season: { startsOn: "2026-10-01", endsOn: "2026-10-31" } },
    { slug: "finn-halloween", title: "Finn the Fish on Halloween", sound: "F", season: { startsOn: "2026-10-01", endsOn: "2026-10-31" } },
  ];
  // Halloween has a limited-time book for several sounds (Travis, 2 Oct 2026:
  // "take a popular book like the halloween and make a version for other
  // letter"). A child gets the one in their own sound; a child whose sounds
  // have none gets the one written for everyone (anySound: Boo the Bat).
  // Home's Limited time row and the bookshelf both ask here, so they agree.
  function seasonPick(list, sounds) {
    var want = (sounds || []).map(function (x) { return String(x).toUpperCase(); });
    var mine = list.filter(function (b) { return want.indexOf(String(b.sound).toUpperCase()) !== -1; });
    return mine.length ? mine : list.filter(function (b) { return b.anySound; });
  }
  function activityLibrary(options) {
    var age = Number(getProfile().childAge);
    var validAge = age >= 2 && age <= 14 && Math.floor(age) === age;
    var recommended = validAge ? playStyle() : null;
    var now = options && typeof options.now === "number" && isFinite(options.now) ? options.now : Date.now();
    var date = new Date(now), day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    function catalogDay(value) {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
      var parsed = Date.parse(value + "T00:00:00Z");
      return isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : NaN;
    }
    // A day string is the read-only seam for daily picks. Existing release
    // rows retain their UTC-day rule when only a timestamp is supplied.
    var requestedDay = options && isFinite(catalogDay(options.day)) ? options.day : "";
    if (requestedDay) day = catalogDay(requestedDay);
    // A parked game's day (comingOn, see GAME_ACTS; none carries one since 15
    // Oct 2026) on the family's own calendar, the way the bookshelf dates its
    // books: "Coming Oct 9" until the day, then "Coming soon" again if the
    // game still isn't ready. A label only; gameAccess never reads it.
    var localToday = requestedDay || _localDay(now);
    function comingOn(act) {
      var d = act.comingSoon && typeof act.comingOn === "string" && isFinite(catalogDay(act.comingOn)) ? act.comingOn : "";
      return d && d > localToday ? d : null;
    }
    function comingLabel(on) {
      if (!on) return "Coming soon";
      try { var p = on.split("-"); return "Coming " + new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
      catch (e) { return "Coming soon"; }
    }
    function entry(key) {
      var act = GAME_ACTS[key], on = comingOn(act);
      return { key: key, name: act.name, sub: act.sub, go: act.go, playDescription: act.playDescription,
        tier: act.tier, releasedOn: act.releasedOn || null, available: act.available !== false, comingSoon: !!act.comingSoon,
        comingOn: on, comingLabel: act.comingSoon ? comingLabel(on) : null };
    }
    // Playable games keep the catalog's order; the parked ones follow, soonest
    // day first, any without a date last. Home draws no parked one (19 Oct
    // 2026); they stay here for the bounce note and its day label.
    function parkedOrder(a, b) {
      var x = GAME_ACTS[a].comingOn || "9999", y = GAME_ACTS[b].comingOn || "9999";
      return x < y ? -1 : x > y ? 1 : 0;
    }
    var groups = ACTIVITY_GROUPS.map(function (group) {
      var keys = ACTIVITY_KEYS.filter(function (key) {
        return GAME_ACTS[key].group === group.id && GAME_ACTS[key].available !== false;
      });
      return {
        id: group.id, name: group.name, ageLabel: group.ageLabel,
        description: group.description, recommended: group.id === recommended,
        games: keys.filter(function (key) { return !GAME_ACTS[key].comingSoon; })
          .concat(keys.filter(function (key) { return GAME_ACTS[key].comingSoon; }).sort(parkedOrder)).map(entry),
      };
    });
    if (recommended === "arcade") groups.reverse();
    // Release dates expire honestly after thirty calendar dates. Seasonal rows
    // exist only when a finished item has a real active start/end date; no placeholders.
    var fresh = ACTIVITY_KEYS.filter(function (key) {
      var act = GAME_ACTS[key], released = catalogDay(act.releasedOn);
      return act.available !== false && !act.comingSoon && released <= day && day - released < 30 * 86400000;
    }).sort(function (a, b) { return catalogDay(GAME_ACTS[b].releasedOn) - catalogDay(GAME_ACTS[a].releasedOn); }).map(entry);
    var seasonal = ACTIVITY_KEYS.filter(function (key) {
      var act = GAME_ACTS[key], season = act.season;
      return act.available !== false && !act.comingSoon && season && catalogDay(season.startsOn) <= day && day <= catalogDay(season.endsOn);
    }).map(entry);
    // Books join the two top rows (Travis, 1 Oct 2026: "at the top ... what's
    // new ... the next section like limited time where we have books and
    // games"). HOME_BOOKS names each book's day out and, for a limited-time
    // one, its window; a book is still opened (or not) by the shelf's rules.
    function bookEntry(b) { return { key: "book:" + b.slug, kind: "book", name: b.title, slug: b.slug, sound: b.sound, cover: "/assets/books/" + b.slug + "/cover.webp", go: "/library.html?book=" + b.slug, playDescription: "A picture book with Echo.", tier: bookFree(b.title) ? "free" : "premium", releasedOn: b.releasedOn || null, available: true, comingSoon: false }; }
    // only the child's own sounds, the one practised now first (Travis, 1 Oct
    // 2026: "the kids just seeing books based on their letter/s")
    var mySounds = (getProfile().focusSounds || []).map(function (x) { return String(x).toUpperCase(); });
    var nowSound = ""; try { nowSound = String(rotSound() || "").toUpperCase(); } catch (e) {}
    var freshBooks = HOME_BOOKS.filter(function (b) { var r = catalogDay(b.releasedOn); return !b.season && r <= day && day - r < 30 * 86400000 && (!mySounds.length || playMode() || mySounds.indexOf(b.sound) !== -1); })
      .sort(function (a, b) { return (b.sound === nowSound) - (a.sound === nowSound); })
      .map(bookEntry);
    var limitedBooks = HOME_BOOKS.filter(function (b) { return b.season && catalogDay(b.season.startsOn) <= day && day <= catalogDay(b.season.endsOn); });
    // the limited-time book in this child's sound (seasonPick); play mode,
    // which rotates every sound, and a child with no sounds yet see them all
    var sounds = getProfile().focusSounds || [];
    if (sounds.length && !playMode()) limitedBooks = seasonPick(limitedBooks, sounds);
    limitedBooks = limitedBooks.map(bookEntry);
    // At most five across, so a row never becomes a long side-scroll.
    var ROW = 5, newRow = fresh.concat(freshBooks).slice(0, ROW), limitedRow = seasonal.concat(limitedBooks).slice(0, ROW);
    var featured = [];
    if (newRow.length) featured.push({ id: "new", name: "What's new", games: newRow });
    if (limitedRow.length) featured.push({ id: "seasonal", name: "Limited time", games: limitedRow });
    // Today's picks change with the local calendar, without saving a shuffle
    // or calling fid() (which creates an id). Lanes are disjoint where the
    // catalog permits it: a book + game, then two games the following day.
    // The two littles games cannot avoid every repeat; never borrow an older
    // child's game or an unrelated sound's book just to fill that gap.
    var pickDay = catalogDay(localToday), ordinal = Math.floor(pickDay / 86400000);
    var seed = _slot(); try { seed += ":" + (localStorage.getItem("sona.fid.v1") || ""); } catch (e) {}
    function pickHash(text) { var h = 2166136261; for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function ranked(list) { return list.slice().sort(function (a, b) { var x = pickHash(seed + "|" + a.key), y = pickHash(seed + "|" + b.key); return x - y || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); }); }
    function walk(list, step, lane) { return list.length ? list[((step + pickHash(seed + "|" + lane)) % list.length + list.length) % list.length] : null; }
    function opens(item) { return item && (item.kind === "book" ? !bookLocked(item.name) : gameAccess(item.key).allowed); }
    function freshPick(item) { var r = catalogDay(item.releasedOn); item.isNew = r <= pickDay && pickDay - r < 30 * 86400000; return item; }
    var pickGames = ranked(ACTIVITY_KEYS.filter(function (key) { var a = GAME_ACTS[key]; return a.group === playStyle() && a.available !== false && !a.comingSoon && !a.season; }).map(entry));
    // An active assignment leads the sound pool, exactly as practice does.
    // Read its window against the requested calendar, so a date preview stays
    // deterministic even across an assignment's start or due day.
    var pickSounds = mySounds, hw = (load(HWKEY, {}) || {}).hw;
    if (hw && (!hw.start || localToday >= hw.start) && (!hw.due || localToday <= hw.due) && Array.isArray(hw.sounds)) {
      var assigned = hw.sounds.map(function (x) { return String(x).toUpperCase(); }).filter(function (x) { return !!WORDS[x]; });
      if (assigned.length) pickSounds = assigned;
    }
    var pickBooks = HOME_BOOKS.filter(function (b) { var r = catalogDay(b.releasedOn); return !b.season && (!isFinite(r) || r <= pickDay) && (!pickSounds.length || playMode() || pickSounds.indexOf(b.sound) !== -1); });
    var firstSound = pickSounds.indexOf(nowSound) !== -1 ? nowSound : pickSounds[0];
    var currentBooks = pickBooks.filter(function (b) { return b.sound === firstSound; });
    if (currentBooks.length) pickBooks = currentBooks;
    pickBooks = ranked(pickBooks.map(bookEntry));
    var split = Math.max(1, Math.floor(pickGames.length / 2));
    var leftGames = pickGames.slice(0, split), rightGames = pickGames.slice(split);
    var bookDay = ordinal % 2 === 0 && pickBooks.length;
    var left = bookDay ? walk(pickBooks, Math.floor(ordinal / 2), "books") : walk(leftGames, ordinal, "left");
    var right = walk(rightGames, ordinal, "right");
    if (!right) right = walk(pickGames.filter(function (g) { return !left || g.key !== left.key; }), ordinal, "right");
    // Picks stay useful for a free family: if neither chosen tile opens,
    // replace one game with an open choice. The book stays in their sound.
    if (left && right && !opens(left) && !opens(right)) {
      var openGames = pickGames.filter(opens);
      if (openGames.length) {
        if (bookDay) right = walk(openGames, ordinal, "open");
        else left = walk(openGames.filter(function (g) { return g.key !== right.key; }), ordinal, "open") || left;
      }
    }
    var choices = [left, right].filter(function (item, i, all) { return item && (!i || item.key !== all[0].key); }).map(freshPick);
    var picks = { id: "picks", name: "Today's picks", tag: "Changes daily", day: localToday, games: choices };
    return { recommended: recommended, groups: groups, featured: featured, picks: picks };
  }
  function homePicks(dayStr) { return activityLibrary({ day: dayStr }).picks.games; }
  // Home previews the same adventure that practice launches. Feed Echo has
  // its own practice/reward loop and remains an independent game choice.
  // A started adventure keeps its order when a family pauses over midnight.
  function adventureGames(firstGame) {
    var style = playStyle();
    // A Say & Play game is its own practice-shaped loop with no earned turn
    // to bank, so it never joins the adventure's deck.
    // adventure: false (Rise Up) keeps a round game out of the old five-game run.
    var deck = ACTIVITY_KEYS.filter(function (key) { return GAME_ACTS[key].group === style && !GAME_ACTS[key].say && GAME_ACTS[key].adventure !== false && gameAccess(key).allowed; });
    var count = ROT_LEN;
    try {
      var run = JSON.parse(sessionStorage.getItem(RUNKEY) || "null");
      var saved = run && run.active && run.games;
      // Keep a started plan, including older arcade plans and repeating simple games.
      if (Array.isArray(saved) && saved.length === count && saved.every(function (key) {
        return ACTIVITY_KEYS.indexOf(key) >= 0;
      })) return saved.slice();
    } catch (e) {}
    // Home can stay open overnight. Its first-game hint keeps the launch
    // faithful to the card the family tapped; only arcade order is affected.
    var offset = deck.indexOf(firstGame);
    if (offset < 0) offset = dayNum() % deck.length;
    var games = [];
    for (var i = 0; i < count; i++) games.push(deck[(offset + i) % deck.length]);
    return games;
  }
  // Simple games are untimed discoveries. Their completion may move an
  // adventure forward but never fabricates a spoken try, streak or outcome.
  function simpleAdventure(kind, completed) {
    try {
      var query = new URLSearchParams(location.search);
      if (query.get("daily") !== "1") return false;
      var run = JSON.parse(sessionStorage.getItem(RUNKEY) || "null");
      if (!run || !run.active || !run.pending || !Array.isArray(run.games) || run.games[run.round] !== kind) return false;
      if (completed) { run.simpleComplete = run.round; sessionStorage.setItem(RUNKEY, JSON.stringify(run)); }
      return true;
    } catch (e) { return false; }
  }
  const SESKEY = "sona.session.v1";
  const session = {
    start(level, sound, queue, diffLevel) {
      const s = { level: level || 1, sound: (sound || "R"), diff: (diffLevel != null ? diffLevel : (level || 1)),
                  queue: (queue && queue.length ? queue.slice() : ["charge.html"]), idx: 0, ts: Date.now() };
      save(SESKEY, s); return s;
    },
    get() { return load(SESKEY, null); },
    active() { const s = load(SESKEY, null); return !!(s && s.queue && s.idx < s.queue.length); },
    pos() { const s = load(SESKEY, null); return s ? { i: s.idx + 1, n: s.queue.length } : null; },
    // full URL (with sound + difficulty + session flag) for the current game in the queue
    url(s) {
      s = s || load(SESKEY, null); if (!s || !s.queue) return null;
      const g = s.queue[s.idx]; if (!g) return null;
      const path = "/" + String(g).replace(/^\//, "");
      const sep = path.indexOf("?") >= 0 ? "&" : "?";
      return path + sep + "sound=" + encodeURIComponent(s.sound) + "&diff=" + s.diff + "&session=1";
    },
    // advance; returns the next game's URL, or null when the level is finished
    next() {
      const s = load(SESKEY, null); if (!s) return null;
      s.idx = (s.idx || 0) + 1; save(SESKEY, s);
      return s.idx < s.queue.length ? session.url(s) : null;
    },
    end() { try { localStorage.removeItem(SESKEY); } catch (e) {} }
  };
  // ?diff= from the URL (1 = easiest). Games read this to scale length/goals.
  function diff() { try { const d = parseInt(new URLSearchParams(location.search).get("diff"), 10); return (d && d > 0) ? d : 1; } catch (e) { return 1; } }

  // completed-level tracking (for future progress-gated locks on the map)
  const LVLKEY = "sona.levels.v1";
  function levelsState() { const s = load(LVLKEY, { done: {} }); s.done = s.done || {}; return s; }
  function markLevelDone(level) { const s = levelsState(); const was = !!s.done[level]; s.done[level] = true; s.ts = Date.now(); save(LVLKEY, s); if (!was) { try { awardNextSticker(); } catch (e) {} } return s; }
  function levelDone(level) { return !!levelsState().done[level]; }

  // ── sticker book: a collectible reward shelf kids fill as they practice ──
  const STICKERS = [
    { id: "star", e: "⭐", name: "Star" }, { id: "trophy", e: "🏆", name: "Trophy" }, { id: "rocket", e: "🚀", name: "Rocket" },
    { id: "medal", e: "🏅", name: "Gold Medal" }, { id: "crown", e: "👑", name: "Crown" }, { id: "rainbow", e: "🌈", name: "Rainbow" },
    { id: "unicorn", e: "🦄", name: "Unicorn" }, { id: "dragon", e: "🐉", name: "Dragon" }, { id: "cake", e: "🎂", name: "Cake" },
    { id: "balloon", e: "🎈", name: "Balloon" }, { id: "gift", e: "🎁", name: "Gift" }, { id: "gem", e: "💎", name: "Diamond" },
    { id: "fire", e: "🔥", name: "On Fire" }, { id: "bolt", e: "⚡", name: "Lightning" }, { id: "heart", e: "❤️", name: "Heart" },
    { id: "sun", e: "☀️", name: "Sunshine" }, { id: "moon", e: "🌙", name: "Moon" }, { id: "flower", e: "🌸", name: "Flower" },
    { id: "robot", e: "🤖", name: "Robot" }, { id: "crystal", e: "🔮", name: "Crystal Ball" }, { id: "ribbon", e: "🎀", name: "Ribbon" },
    { id: "clover", e: "🍀", name: "Lucky Clover" }, { id: "butterfly", e: "🦋", name: "Butterfly" }, { id: "whale", e: "🐳", name: "Whale" },
  ];
  const STKKEY = "sona.stickers.v1";
  function stickersEarned() { return load(STKKEY, {}); }
  function hasSticker(id) { return !!stickersEarned()[id]; }
  function awardSticker(id) { try { const e = load(STKKEY, {}); if (e[id]) return false; e[id] = { at: Date.now() }; save(STKKEY, e); return true; } catch (_) { return false; } }
  // award the next not-yet-earned sticker (milestone reward); returns the sticker or null
  function awardNextSticker() { const e = stickersEarned(); for (let i = 0; i < STICKERS.length; i++) { if (!e[STICKERS[i].id]) { awardSticker(STICKERS[i].id); return STICKERS[i]; } } return null; }
  function awardRandomSticker() { const e = stickersEarned(); const left = STICKERS.filter(function (s) { return !e[s.id]; }); if (!left.length) return null; const s = left[Math.floor(Math.random() * left.length)]; awardSticker(s.id); return s; }

  // ── "how to make this sound" — kid-friendly placement cues (SLP-informed) ──
  const CUES = {
    R: { mouth: "🐯", tip: "Pull your tongue back and up like a tiger growl — rrr!" },
    S: { mouth: "🐍", tip: "Teeth together, big smile, let the air hiss out — sss like a snake." },
    L: { mouth: "🦁", tip: "Tongue tip up behind your top teeth — lll, la la la." },
    K: { mouth: "🐸", tip: "The back of your tongue pops up in the back — k! k! k!" },
    G: { mouth: "🐊", tip: "Like K, but turn your voice on — g! g! g!" },
    F: { mouth: "🐰", tip: "Top teeth on your bottom lip, blow soft — ffff." },
    V: { mouth: "🚐", tip: "Like F, but buzz your voice — vvvv." },
    SH: { mouth: "🤫", tip: "Round your lips and whisper quiet — shhh." },
    CH: { mouth: "🚂", tip: "Pop it like a little train — ch! ch! ch!" },
    J: { mouth: "🦘", tip: "Like CH, but turn your voice on — j! j! j!" },
    TH: { mouth: "👅", tip: "Peek your tongue between your teeth and blow soft — th." },
    THV: { mouth: "👅", tip: "Tongue between your teeth and buzz — th, like in 'the'." },
    Z: { mouth: "🐝", tip: "Teeth together and buzz like a bee — zzzz." },
    P: { mouth: "💨", tip: "Press your lips and pop a little puff — p! p! p!" },
    B: { mouth: "🫧", tip: "Lips together, turn your voice on — b! b! b!" },
    M: { mouth: "😋", tip: "Lips together and hum — mmmm." },
    N: { mouth: "👃", tip: "Tongue up behind your teeth and hum — nnnn." },
    T: { mouth: "⏰", tip: "Tongue taps behind your top teeth — t! t! t!" },
    D: { mouth: "🥁", tip: "Like T, but turn your voice on — d! d! d!" },
  };
  function cue(sound) { return CUES[sound] || { mouth: "👄", tip: "Listen to Echo, then copy the sound!" }; }

    // ── The parent's weekly wins: reps + focus-sound accuracy, this week vs
  // last (local Monday weeks, honest scored attempts only via outcomes()).
  function weekWins() {
    const o = (typeof outcomes === "function" ? outcomes() : {}) || {};
    const prof = getProfile();
    const snd = ((prof.focusSounds && prof.focusSounds[0]) || "R").toUpperCase();
    const now = new Date(); const dow = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
    const prev = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    function inRange(k, a, b) { const d = new Date(k + "T12:00:00"); return d >= a && d < b; }
    function acc(a, b) { let at = 0, ps = 0; const bs = o[snd]; if (bs && bs.days) Object.keys(bs.days).forEach(function (k) { if (inRange(k, a, b)) { at += bs.days[k].a || 0; ps += bs.days[k].p || 0; } }); return at >= 5 ? Math.round(ps / at * 100) : null; }
    // reps is Home's corner count (REPWEEKS1), not the number of sound checks:
    // the two sat on the same screen and disagreed.
    return { sound: snd, label: soundLabel(snd), reps: weekReps(0), acc: acc(start, end), accPrev: acc(prev, start), week: momWeek() };
  }

  // ── Sticker icon kit (design §7): flat 2-tone SVGs with a white glint dot.
  // Replaces every kid-visible emoji — HUD pills, hearts, mic, bolts, covers.
  const ICONS = {
    // fix-pack 1e: the last chrome emoji, drawn — flat 2-tone + one white glint
    gift: '<rect x="10" y="26" width="44" height="30" rx="6" fill="#ff8a3d"/><rect x="10" y="26" width="44" height="9" fill="#ef6f23"/><rect x="28" y="18" width="8" height="38" fill="#ffd21c"/><path d="M32 18c-8-10-20-4-14 4 5 5 14-4 14-4Z" fill="#ffd21c"/><path d="M32 18c8-10 20-4 14 4-5 5-14-4-14-4Z" fill="#f0a800"/><circle cx="18" cy="32" r="2.5" fill="#fff" opacity=".75"/>',
    target: '<circle cx="32" cy="32" r="24" fill="#ff5c74"/><circle cx="32" cy="32" r="16" fill="#fff"/><circle cx="32" cy="32" r="8" fill="#ff5c74"/><circle cx="22" cy="22" r="3" fill="#fff" opacity=".8"/>',
    map: '<path d="M10 16l14-5 16 5 14-5v37l-14 5-16-5-14 5Z" fill="#8fd0f5"/><path d="M24 11v37M40 16v37" stroke="#5aa8d6" stroke-width="2.5"/><path d="M32 20c6 0 10 4 10 9 0 7-10 14-10 14s-10-7-10-14c0-5 4-9 10-9Z" fill="#ff5c74"/><circle cx="32" cy="29" r="3.5" fill="#fff"/><circle cx="16" cy="18" r="2.5" fill="#fff" opacity=".8"/>',
    mail: '<rect x="6" y="16" width="52" height="36" rx="7" fill="#5cc6ff"/><path d="M6 22l26 17 26-17" fill="none" stroke="#1c87c9" stroke-width="4" stroke-linejoin="round"/><path d="M32 26c-3-4-9-2-7.4 2 1.2 2.8 5.4 4.6 7.4 7 2-2.4 6.2-4.2 7.4-7 1.6-4-4.4-6-7.4-2Z" fill="#ff5c74"/><circle cx="14" cy="22" r="2.5" fill="#fff" opacity=".75"/>',
    lock: '<path d="M20 28v-6a12 12 0 0 1 24 0v6" fill="none" stroke="#f0a800" stroke-width="6" stroke-linecap="round"/><rect x="14" y="27" width="36" height="28" rx="8" fill="#ffd21c"/><circle cx="32" cy="39" r="4.5" fill="#a97b00"/><rect x="30" y="41" width="4" height="8" rx="2" fill="#a97b00"/><circle cx="22" cy="33" r="2.5" fill="#fff" opacity=".8"/>',
    sprout: '<rect x="29.5" y="34" width="5" height="22" rx="2.5" fill="#8a5a2a"/><path d="M32 40C28 26 18 22 8 24c4 12 14 17 24 16Z" fill="#58cc02"/><path d="M32 40c4-14 14-18 24-16-4 12-14 17-24 16Z" fill="#6edd18"/><path d="M32 36c-2-10 0-18 0-26 6 8 6 18 0 26Z" fill="#46a302"/><circle cx="20" cy="27" r="2" fill="#fff" opacity=".8"/>',
    flame: '<path d="M32 4c6 10 14 14 14 26a14 14 0 0 1-28 0c0-6 3-10 6-14 0 5 2 8 5 9-1-8 0-15 3-21Z" fill="#ff8a3d"/><path d="M32 24c3 5 7 7 7 13a7 7 0 0 1-14 0c0-5 4-7 7-13Z" fill="#ffd21c"/><circle cx="26" cy="20" r="2.5" fill="#fff" opacity=".8"/>',
    home: '<path d="M32 7 60 33H4Z" fill="#ff8a3d"></path><rect x="44" y="12" width="7" height="10" rx="2" fill="#e5672a"></rect><rect x="13" y="33" width="38" height="23" rx="3" fill="#ffdf9e"></rect><rect x="26" y="40" width="12" height="16" rx="3" fill="#e5672a"></rect><circle cx="45" cy="42" r="3.6" fill="#4db3f2"></circle><circle cx="24" cy="20" r="2.6" fill="#fff" opacity=".75"></circle>',
    gear: '<g fill="#9fb4d9"><rect x="28" y="4" width="8" height="12" rx="3"></rect><rect x="28" y="48" width="8" height="12" rx="3"></rect><rect x="4" y="28" width="12" height="8" rx="3"></rect><rect x="48" y="28" width="12" height="8" rx="3"></rect><rect x="28" y="4" width="8" height="12" rx="3" transform="rotate(45 32 32)"></rect><rect x="28" y="48" width="8" height="12" rx="3" transform="rotate(45 32 32)"></rect><rect x="4" y="28" width="12" height="8" rx="3" transform="rotate(45 32 32)"></rect><rect x="48" y="28" width="12" height="8" rx="3" transform="rotate(45 32 32)"></rect></g><circle cx="32" cy="32" r="14" fill="#9fb4d9"></circle><circle cx="32" cy="32" r="6" fill="#fff"></circle><circle cx="25" cy="24" r="2.2" fill="#fff" opacity=".75"></circle>',
    printer: '<rect x="21" y="7" width="22" height="11" rx="3" fill="#f0f0f5"></rect><rect x="11" y="15" width="42" height="21" rx="6" fill="#4db3f2"></rect><circle cx="45" cy="21" r="2.4" fill="#6fd644"></circle><rect x="19" y="30" width="26" height="20" rx="4" fill="#fff"></rect><line x1="24" y1="38" x2="40" y2="38" stroke="#d0d5dd" stroke-width="2.5" stroke-linecap="round"></line><line x1="24" y1="44" x2="36" y2="44" stroke="#d0d5dd" stroke-width="2.5" stroke-linecap="round"></line><circle cx="17" cy="20" r="2.2" fill="#fff" opacity=".75"></circle>',
    envelope: '<rect x="9" y="15" width="46" height="34" rx="7" fill="#4db3f2"></rect><path d="M12 18 32 36 52 18q-9-4-20-4t-20 4Z" fill="#6fc4f7"></path><path d="M9 44l16-12M55 44 39 32" stroke="#2a8fd4" stroke-width="2.5" opacity=".6"></path><circle cx="32" cy="38" r="5" fill="#ff5c74"></circle><path d="M30.2 37.2a1.5 1.5 0 0 1 1.8-.8 1.5 1.5 0 0 1 1.8.8q.6 1.4-1.8 3-2.4-1.6-1.8-3Z" fill="#fff"></path><circle cx="16" cy="21" r="2.2" fill="#fff" opacity=".75"></circle>',
    trend: '<rect x="9" y="40" width="9" height="15" rx="2.5" fill="#ffd21c"></rect><rect x="23" y="32" width="9" height="23" rx="2.5" fill="#ffb100"></rect><rect x="37" y="24" width="9" height="31" rx="2.5" fill="#ffd21c"></rect><path d="M12 30Q30 26 46 12" fill="none" stroke="#58cc02" stroke-width="4" stroke-linecap="round"></path><path d="M40 10l12-3-3 12Z" fill="#58cc02"></path><circle cx="14" cy="44" r="1.8" fill="#fff" opacity=".75"></circle>',
    up: '<path d="M32 10q3 0 4.8 3l14 24q2 4-2.5 5.5-16.3 3.5-32.6 0Q11.2 41 13.2 37l14-24q1.8-3 4.8-3Z" fill="#58cc02"></path><path d="M32 22l8 13H24Z" fill="#eefce2"></path><circle cx="25" cy="22" r="2" fill="#fff" opacity=".75"></circle>',
    heart: '<path d="M32 56C14 44 6 33 6 22 6 13 13 7 21 7c5 0 9 2 11 6 2-4 6-6 11-6 8 0 15 6 15 15 0 11-8 22-26 34Z" fill="#ff5c74"/><circle cx="22" cy="19" r="4" fill="#fff" opacity=".75"/>',
    heartLost: '<path d="M32 56C14 44 6 33 6 22 6 13 13 7 21 7c5 0 9 2 11 6 2-4 6-6 11-6 8 0 15 6 15 15 0 11-8 22-26 34Z" fill="rgba(255,255,255,.16)" stroke="#e0d2bc" stroke-width="3" stroke-dasharray="6 5"/>',
    mic: '<rect x="24" y="7" width="16" height="27" rx="8" fill="#4db3f2"/><path d="M15 30a17 17 0 0 0 34 0" fill="none" stroke="#2a8fd4" stroke-width="5" stroke-linecap="round"/><line x1="32" y1="47" x2="32" y2="53" stroke="#2a8fd4" stroke-width="5" stroke-linecap="round"/><line x1="25" y1="56" x2="39" y2="56" stroke="#2a8fd4" stroke-width="5" stroke-linecap="round"/><circle cx="28" cy="13" r="2.5" fill="#fff" opacity=".85"/>',
    bolt: '<path d="M36 4 14 36h13l-5 24 24-34H33Z" fill="#ffd21c" stroke="#f0a800" stroke-width="2.5" stroke-linejoin="round"/><circle cx="30" cy="15" r="2.5" fill="#fff" opacity=".9"/>',
    star: '<path d="M32 5l8.2 18.6L60 25.8 44.9 39.2 49.8 59 32 48.4 14.2 59l4.9-19.8L4 25.8l19.8-2.2Z" fill="#ffd21c"/><circle cx="25" cy="21" r="3" fill="#fff" opacity=".85"/>',
    coin: '<circle cx="32" cy="32" r="20" fill="#ffd21c"/><circle cx="32" cy="32" r="14.5" fill="none" stroke="#f0a800" stroke-width="3"/><path d="M32 24l2.6 5.9 6.4.7-4.8 4.3 1.5 6.3L32 37.9l-5.7 3.3 1.5-6.3-4.8-4.3 6.4-.7Z" fill="#f0a800"/><circle cx="24" cy="22" r="3" fill="#fff" opacity=".8"/>',
    library: '<path d="M10 14c8-4 15-4 22 0v38c-7-4-14-4-22 0Z" fill="#4db3f2"/><path d="M54 14c-8-4-15-4-22 0v38c7-4 14-4 22 0Z" fill="#2a8fd4"/><line x1="32" y1="14" x2="32" y2="52" stroke="#1c6fa8" stroke-width="2"/><circle cx="19" cy="22" r="3" fill="#fff" opacity=".8"/>',
    melon: '<path d="M5 25a27 27 0 0 0 54 0Z" fill="#58cc02"/><path d="M10 25a22 22 0 0 0 44 0Z" fill="#eefce2"/><path d="M14 25a18 18 0 0 0 36 0Z" fill="#ff5470"/><ellipse cx="26" cy="33" rx="2" ry="3" fill="#3d2317" transform="rotate(18 26 33)"/><ellipse cx="38" cy="33" rx="2" ry="3" fill="#3d2317" transform="rotate(-18 38 33)"/>',
    fox: '<path d="M17 10l10 12-14 4Z" fill="#ff8a3d"/><path d="M47 10l-10 12 14 4Z" fill="#ff8a3d"/><path d="M20 15l6 8-9 2.5Z" fill="#e5672a"/><path d="M44 15l-6 8 9 2.5Z" fill="#e5672a"/><circle cx="32" cy="36" r="17" fill="#ff8a3d"/><ellipse cx="32" cy="44" rx="9" ry="7" fill="#fff"/><circle cx="25" cy="34" r="2.6" fill="#4a2c14"/><circle cx="39" cy="34" r="2.6" fill="#4a2c14"/><circle cx="32" cy="42" r="2.6" fill="#4a2c14"/>',
    block: '<rect x="8" y="19" width="48" height="27" rx="7" fill="#69db7c"/><rect x="8" y="19" width="48" height="9" rx="4.5" fill="#85e099"/><circle cx="18" cy="26" r="2.5" fill="#fff" opacity=".85"/>',
    keys: '<rect x="8" y="14" width="48" height="36" rx="6" fill="#fff"/><line x1="20" y1="14" x2="20" y2="50" stroke="#d8cfec" stroke-width="2.5"/><line x1="32" y1="14" x2="32" y2="50" stroke="#d8cfec" stroke-width="2.5"/><line x1="44" y1="14" x2="44" y2="50" stroke="#d8cfec" stroke-width="2.5"/><rect x="16" y="14" width="8" height="19" rx="2" fill="#2f2266"/><rect x="40" y="14" width="8" height="19" rx="2" fill="#2f2266"/><circle cx="13" cy="20" r="2" fill="#fff" opacity=".9"/>',
    balloon: '<path d="M32 4C18 4 11 16 11 27c0 12 11 19 17 26h8c6-7 17-14 17-26C53 16 46 4 32 4Z" fill="#ff6b6b"/><path d="M32 4c-6 0-10 12-10 23 0 12 5 19 7 26h6c2-7 7-14 7-26C42 16 38 4 32 4Z" fill="#fff4dd"/><path d="M32 4c-2 0-4 12-4 23 0 12 2 19 3 26h2c1-7 3-14 3-26C36 16 34 4 32 4Z" fill="#ffd43b"/><rect x="25" y="53" width="14" height="9" rx="3" fill="#b5875a"/><ellipse cx="22" cy="16" rx="4" ry="7" fill="#fff" opacity=".3" transform="rotate(-16 22 16)"/>',
    // The Trophy Road and the Practice Board's glyphs (11 Oct 2026): drawn
    // beside a number at 12-24 px, so each is one bold shape in two tones
    // with the kit's white glint, and no detail that turns to mud when small.
    trophy: '<path d="M21 14H11a9 9 0 0 0 12 14M43 14h10a9 9 0 0 1-12 14" fill="none" stroke="#f0a800" stroke-width="5" stroke-linecap="round"/><path d="M18 8h28v14a14 14 0 0 1-28 0Z" fill="#ffd21c"/><rect x="28" y="34" width="8" height="12" fill="#f0a800"/><rect x="17" y="45" width="30" height="11" rx="4" fill="#f0a800"/><circle cx="25" cy="15" r="3" fill="#fff" opacity=".8"/>',
    chest: '<path d="M8 30v-6a13 13 0 0 1 13-13h22a13 13 0 0 1 13 13v6Z" fill="#b8722b"/><rect x="8" y="29" width="48" height="26" rx="5" fill="#d9903f"/><rect x="8" y="27" width="48" height="6" fill="#ffd21c"/><rect x="26" y="24" width="12" height="15" rx="4" fill="#ffd21c"/><circle cx="32" cy="31" r="2.6" fill="#a97b00"/><circle cx="17" cy="19" r="2.5" fill="#fff" opacity=".75"/>',
    sun: '<g fill="#ffb100"><rect x="29" y="2" width="6" height="12" rx="3"/><rect x="29" y="50" width="6" height="12" rx="3"/><rect x="2" y="29" width="12" height="6" rx="3"/><rect x="50" y="29" width="12" height="6" rx="3"/><rect x="29" y="2" width="6" height="12" rx="3" transform="rotate(45 32 32)"/><rect x="29" y="50" width="6" height="12" rx="3" transform="rotate(45 32 32)"/><rect x="2" y="29" width="12" height="6" rx="3" transform="rotate(45 32 32)"/><rect x="50" y="29" width="12" height="6" rx="3" transform="rotate(45 32 32)"/></g><circle cx="32" cy="32" r="15" fill="#ffd21c"/><circle cx="26" cy="26" r="3" fill="#fff" opacity=".8"/>',
    // a medal carries its place as well as its colour, so first, second and
    // third still read apart to a child who sees the colours alike
    medalGold: '<path d="M18 3h11l7 23H25Z" fill="#4db3f2"/><path d="M46 3H35l-7 23h11Z" fill="#ff5c74"/><circle cx="32" cy="41" r="18" fill="#ffd21c"/><circle cx="32" cy="41" r="13" fill="none" stroke="#f0a800" stroke-width="3"/><path d="M29 36l4-3v16" fill="none" stroke="#a97b00" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23" cy="34" r="2.6" fill="#fff" opacity=".8"/>',
    medalSilver: '<path d="M18 3h11l7 23H25Z" fill="#4db3f2"/><path d="M46 3H35l-7 23h11Z" fill="#ff5c74"/><circle cx="32" cy="41" r="18" fill="#dfe5ee"/><circle cx="32" cy="41" r="13" fill="none" stroke="#a9b4c4" stroke-width="3"/><path d="M27 37a5 5 0 0 1 10 0c0 4-10 8-10 12h10" fill="none" stroke="#6d7a8c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23" cy="34" r="2.6" fill="#fff" opacity=".8"/>',
    medalBronze: '<path d="M18 3h11l7 23H25Z" fill="#4db3f2"/><path d="M46 3H35l-7 23h11Z" fill="#ff5c74"/><circle cx="32" cy="41" r="18" fill="#e7a670"/><circle cx="32" cy="41" r="13" fill="none" stroke="#bd7440" stroke-width="3"/><path d="M27 34h9l-5 6a4.5 4.5 0 1 1-4 7" fill="none" stroke="#8a4c22" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23" cy="34" r="2.6" fill="#fff" opacity=".8"/>',
  };
  function icon(name, px) { const d = ICONS[name]; return d ? '<svg viewBox="0 0 64 64" style="width:' + (px || 18) + 'px;height:' + (px || 18) + 'px;vertical-align:-3px">' + d + '</svg>' : ""; }
  // Hearts row: n filled of max; the lost ones are dashed outlines (design: New-life overlay)
  function heartRow(n, max, px) { let out = "", i; max = max == null ? 3 : max; for (i = 0; i < max; i++) out += '<svg viewBox="0 0 64 64" style="width:' + (px || 20) + 'px;height:' + (px || 20) + 'px;margin:0 2px;vertical-align:middle">' + ICONS[i < n ? "heart" : "heartLost"] + '</svg>'; return out; }

  // ── SPOKEN sound cues — the SOUND, not the letter name ──
  // Kids must hear "puh", never "pee". Continuants stretch (sss, rrrr); stops
  // get a light schwa (puh, kuh). Used by every game so Leo always models the
  // sound and asks the child to repeat it (never just "say R").
  const SOUND_SAY = {
    R: "rrrr", S: "sss", L: "lll", K: "kuh", G: "guh", F: "ffff", V: "vvvv",
    SH: "shhh", CH: "chuh", J: "juh", TH: "thhh", THV: "thuh", Z: "zzz",
    P: "puh", B: "buh", M: "mmm", N: "nnn", T: "tuh", D: "duh",
  };
  function soundSay(sound) { return SOUND_SAY[String(sound || "").toUpperCase()] || String(sound || "").toLowerCase(); }

  // ── the practice sound's LETTERS, in orange (design brief, 28 Sep 2026) ──
  // "The practice sound's letters are always orange (the r in rabbit, rrrr)."
  // soundMark(text, sound, pos) returns the text as HTML, escaped, with only
  // the letters that make the sound wrapped in <b class="snd"> (action.css).
  // Which letters those are is a spelling question English makes hard: "sure"
  // is an SH word, the c in "bicycle" is an S and the one after it a K, the
  // s at the end of "cheese" is a Z. A cue pointing at a letter that doesn't
  // make the sound teaches the wrong thing, which is worse than no narrowing —
  // so each rule below narrows only where the spelling proves it, and anything
  // it can't prove gets today's behaviour: the whole text orange.
  // tests/soundmarktest.mjs runs every word in WORDS and writes the table
  // Rachel reviews; how a sound is shown to a child is her call.
  // At the start of a word: the book reader's LEAD map (library.html), plus gn.
  var SM_LEAD = { SH: ["sh", "s"], CH: ["ch"], TH: ["th"], THV: ["th"], K: ["k", "c", "q"], N: ["kn", "gn", "n"],
    R: ["wr", "r"], F: ["ph", "f"], J: ["j", "g"], S: ["s", "c"], Z: ["z", "x"], G: ["gh", "g"] };
  // Inside a word (middle, end, blends), longest first so "ck" beats "c".
  var SM_SPELL = { R: ["rr", "r"], S: ["ss", "s", "c"], Z: ["zz", "z", "ss", "s"], L: ["ll", "l"], K: ["ck", "k", "c", "q"],
    G: ["gg", "g"], F: ["ff", "ph", "gh", "f"], SH: ["sh", "ss", "ti", "ci", "ce", "ch"], CH: ["tch", "ch", "t"],
    TH: ["th"], THV: ["th"], J: ["dg", "j", "g"], P: ["pp", "p"], B: ["bb", "b"], M: ["mm", "m"], N: ["nn", "n"],
    T: ["tt", "t"], D: ["dd", "d"], V: ["v"] };
  // Vocalic R is the vowel the r colours, so the mark takes the vowel with it.
  var SM_VOC = ["ear", "air", "eer", "our", "oar", "oor", "ar", "er", "ir", "or", "ur"];
  function smEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  // A spelling that looks right but, here, makes another sound (or none).
  function smOk(snd, sp, w, i) {
    var a = w.charAt(i + sp.length), b = w.charAt(i - 1), rest = w.slice(i + sp.length), soft = /[eiy]/.test(a);
    if (sp === "c") return snd === "S" ? soft : (!soft && a !== "h");        // city is S, cat is K, chip is neither
    if (sp === "g") return snd === "J" ? soft : (a !== "h" && !(b === "n" && /^(s|ue|ues)?$/.test(rest))); // gem; night; ring, tongue
    if (sp === "dg") return soft;                                              // badge: one J
    if (sp === "gh") return snd === "G" ? i === 0 : rest === "";               // ghost; laugh
    if (sp === "s") return a !== "h";                                          // sh is its own sound
    if (sp === "p") return a !== "h";                                          // phone is F
    if (sp === "k") return a !== "n";                                          // knife: silent k
    if (sp === "ch") return b !== "s";                                         // school
    if (sp === "t") return snd === "CH" ? rest.indexOf("ure") === 0          // picture
      : (a !== "h" && rest.indexOf("ch") !== 0 && !/^i[ao]/.test(rest) && rest.indexOf("ure") !== 0);
    if (sp === "n") return a !== "k" && !(a === "g" && /^g(s|ue|ues)?$/.test(rest)); // ink, ring: the ng sound
    if (sp === "b") return !(b === "m" && /^s?$/.test(rest));                 // lamb: silent b
    if (sp === "d") return !(a === "g" && /[eiy]/.test(w.charAt(i + 2)));      // badge is J
    if (snd === "SH" && /^(ti|ci|ce|ss)$/.test(sp)) return /[aeiou]/.test(a); // nation, special, ocean, tissue
    return true;
  }
  function smAt(snd, list, w, i) {
    for (var k = 0; k < list.length; k++) if (w.substr(i, list[k].length) === list[k] && smOk(snd, list[k], w, i)) return [i, i + list[k].length];
    return null;
  }
  function smCons(c) { return /[a-z]/.test(c) && !/[aeiouy]/.test(c); }
  // [start, end) of the sound in lower-case word w at position pos, or null.
  function smFind(snd, w, pos) {
    var lead = SM_LEAD[snd] || [snd.charAt(0).toLowerCase()], spell = SM_SPELL[snd] || lead, i, h, k, tails, t, end, rest;
    if (pos === "i") return smAt(snd, lead, w, 0);
    if (pos === "m") {                   // inside: never the first letter, never the last sound
      for (i = 1; i < w.length; i++) { h = smAt(snd, spell, w, i); rest = h && w.slice(h[1]); if (h && rest && rest !== "e" && rest !== "ue") return h; }
      return null;
    }
    if (pos === "f") {                   // last sound, past a silent e (cake, nose, cage) or the b of lamb
      tails = snd === "M" ? ["", "e", "ue", "b"] : ["", "e", "ue"];
      for (t = 0; t < tails.length; t++) {
        end = w.length - tails[t].length;
        if (end < 1 || w.slice(end) !== tails[t]) continue;
        for (k = 0; k < spell.length; k++) if (end - spell[k].length >= 0 && w.substr(end - spell[k].length, spell[k].length) === spell[k] && smOk(snd, spell[k], w, end - spell[k].length)) return [end - spell[k].length, end];
      }
      return null;
    }
    if (pos === "v") {                   // vocalic R: an r after a vowel, before no vowel (bird, chair, tiger)
      if (snd !== "R") return null;
      for (i = 0; i < w.length; i++) { h = smAt(snd, SM_VOC, w, i); rest = h && w.slice(h[1]); if (h && (/^es?$/.test(rest) || !/^[aeiouyr]/.test(rest))) return h; }
      return null;
    }
    if (pos === "b") {                   // a blend: the sound's own letter, beside ANOTHER consonant (tree, spoon) —
      // the twin of a doubled letter is the same sound, not a blend: "glass" must not mark its last s alone
      for (i = 0; i < w.length; i++) {
        h = smAt(snd, i === 0 ? lead : spell, w, i);
        if (h && ((smCons(w.charAt(i - 1)) && w.charAt(i - 1) !== w.charAt(i)) || (smCons(w.charAt(h[1])) && w.charAt(h[1]) !== w.charAt(h[1] - 1)))) return h;
      }
      return null;
    }
    return null;
  }
  // When the position rule finds nothing: if the sound's spellings occur
  // exactly once in the word, that one IS the sound ("sandwich" is filed
  // under middle CH, but its only ch is at the end). Two or more is a guess.
  function smOnly(snd, w) {
    var lead = SM_LEAD[snd] || [snd.charAt(0).toLowerCase()], spell = SM_SPELL[snd] || lead, hits = [], i = 0, h;
    var all = lead.concat(spell).sort(function (a, b) { return b.length - a.length; });
    while (i < w.length) { h = smAt(snd, i === 0 ? all : spell, w, i); if (h) { hits.push(h); i = h[1]; } else i++; }
    return hits.length === 1 ? hits[0] : null;
  }
  // The word bank's own position for w, preferring the one asked for.
  function smBankPos(snd, w, pos) {
    var hit = (WORDS[snd] || []).filter(function (x) { return x && String(x.w).toLowerCase() === w; });
    if (!hit.length) return "";
    for (var k = 0; k < hit.length; k++) if ((hit[k].pos || "i") === pos) return pos;
    return hit[0].pos || "i";
  }
  // "rrrr", "sh sh", "shhh", "kuh": the sound on its own, so all of it is the sound.
  function smIsolation(t, snd) {
    var s = t.toLowerCase().trim(), toks, k, j, sp, ok, spells;
    if (s === soundSay(snd) || s === snd.toLowerCase() || s === String(soundLabel(snd)).toLowerCase()) return true;
    toks = s.replace(/[^a-z\s]/g, " ").trim().split(/\s+/);
    if (!toks[0]) return false;
    spells = (SM_LEAD[snd] || [snd.charAt(0).toLowerCase()]).concat(SM_SPELL[snd] || []);
    for (k = 0; k < toks.length; k++) {
      ok = toks[k] === soundSay(snd);
      for (j = 0; !ok && j < spells.length; j++) { sp = spells[j]; ok = new RegExp("^(?:" + sp + ")+" + sp.slice(-1) + "*$").test(toks[k]); }
      if (!ok) return false;
    }
    return true;
  }
  // One word, with any punctuation around it kept outside the mark. null = unsure.
  function smWord(tok, snd, pos) {
    var m = String(tok).match(/^([^A-Za-z]*)([\s\S]*?)([^A-Za-z]*)$/), core = m[2], w = core.toLowerCase(), hit = null;
    if (!w) return null;
    var p = /^[imfvb]$/.test(pos || "") ? pos : "", bank = smBankPos(snd, w, p);
    if (p) hit = smFind(snd, w, p);
    if (!hit && bank && bank !== p) hit = smFind(snd, w, bank);
    if (!hit && !p && !bank) hit = smFind(snd, w, "i");
    if (!hit) hit = smOnly(snd, w);
    if (!hit) return null;
    return smEsc(m[1]) + smEsc(core.slice(0, hit[0])) + '<b class="snd">' + smEsc(core.slice(hit[0], hit[1])) + "</b>" + smEsc(core.slice(hit[1])) + smEsc(m[3]);
  }
  function soundMark(text, sound, pos) {
    var t = String(text == null ? "" : text), snd = String(sound || "").toUpperCase(), whole = '<b class="snd">' + smEsc(t) + "</b>";
    if (!t.trim() || !snd) return t.trim() ? whole : smEsc(t);
    try {
      if (smIsolation(t, snd)) return whole;
      var parts = t.split(/(\s+)/), words = parts.filter(function (x) { return x && !/^\s+$/.test(x); });
      if (words.length === 1) return smWord(t, snd, pos) || whole;
      // A sentence: mark only its practice words (the bank's words for this
      // sound). "Here is a bus" must not light up the z-sounding s of "is".
      var out = "", marked = 0;
      for (var k = 0; k < parts.length; k++) {
        var x = parts[k], core = x.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "").toLowerCase(), html = null;
        if (core && smBankPos(snd, core, pos)) html = smWord(x, snd, pos);
        if (html) marked++;
        out += html || smEsc(x);
      }
      return marked ? out : whole;
    } catch (e) { return whole; }
  }
  // "Are you ready? Say rrrr 4 times to rev your engine!"  — reps>1 adds the
  // count; action is the game's verb ("rev your engine", "pop the bubble").
  function actionCue(sound, reps, action) {
    var s = soundSay(sound), n = Math.max(1, parseInt(reps, 10) || 1);
    return "Are you ready? Say " + s + (n > 1 ? (" " + n + " times") : "") + (action ? (" to " + action) : "") + "!";
  }
  // Model-then-try line for warm-ups and corrections: "Repeat after me… rrrr!  Now you try — rrrr!"
  function repeatCue(sound) { var s = soundSay(sound); return "Repeat after me… " + s + "!  Now you try — " + s + "!"; }
  // Short spoken praise for a correct rep — said before moving to the next prompt.
  // Lightly varied so it doesn't feel robotic to a kid.
  // CALM, NOT HYPED (24 Sep 2026). The voice reads "!" as a jump in pitch and
  // energy, and "Awesome!" / "Way to go!" after every good try was the jumpy,
  // explosive sound Travis heard. Echo should sound like a grown-up talking
  // softly to a small child: short, warm, full stops. No "!" — voicetest3 pins it.
  const PRAISES = ["Nice one.", "Good job.", "I heard that.", "That was lovely.", "Well done."];   // not "You did it." — the win line says that right after
  function praiseLine() { return PRAISES[Math.floor(Math.random() * PRAISES.length)]; }

  // Corrective line for a missed attempt: re-model the sound + a placement cue.
  function coachLine(sound, feedback) {
    var base = feedback || ("Let's try again. Say " + soundSay(sound) + "!");
    var c = cue(sound);
    return c && c.tip ? (base + "  " + (c.mouth ? c.mouth + " " : "") + c.tip) : base;
  }

  // ── in-the-moment, per-game feedback (pilot/SLP + debug) — optional, never blocks "Next" ──
  function sendFeedback(o) {
    try {
      o = o || {}; o.at = new Date().toISOString(); o.text = String(o.text || "").slice(0, 1000);
      fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o), keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  // Client error telemetry — surfaces pilot-week silent failures in the server
  // logs. Capped per page load so a repeating error can't spam the beacon.
  var _errSent = 0;
  function reportError(msg) {
    try {
      if (_errSent >= 5) return; _errSent++;
      fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ msg: String(msg || "").slice(0, 500), url: (window.location && location.pathname) || "" }) }).catch(function () {});
    } catch (e) {}
  }
  try {
    window.addEventListener("error", function (e) { reportError(((e && e.message) || "error") + (e && e.filename ? " @ " + String(e.filename).split("/").pop() + ":" + (e.lineno || "?") : "")); });
    window.addEventListener("unhandledrejection", function (e) { var r = e && e.reason; reportError("unhandledrejection: " + ((r && (r.message || r)) || "")); });
  } catch (e) {}
  function gameFeedbackCard() {
    const game = gameMeta(location.pathname).name;
    let sound = "", code = "", childId = "", level = "";
    try { sound = new URLSearchParams(location.search).get("sound") || ""; } catch (e) {}
    try { const pi = pilotInfo(); code = pi.code || ""; childId = pi.childId || ""; } catch (e) {}
    try { const s0 = load(SESKEY, null); level = s0 ? s0.level : ""; } catch (e) {}
    const card = document.createElement("div");
    card.className = "sona-fb";
    card.style.cssText = "margin:16px auto 0;width:100%;max-width:360px;background:#f6fbff;border:1.5px solid #dcebf8;border-radius:16px;padding:13px 14px;text-align:left;";
    card.innerHTML =
      '<div style="font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:14.5px;color:#16384f;">💭 Quick thought on ' + game + '?</div>' +
      '<div style="font-weight:700;font-size:12px;color:#6b86a3;margin-top:2px;">Optional — a knee-jerk reaction is perfect. Or just hit Next.</div>' +
      '<textarea rows="2" placeholder="Too easy? Confusing? Loved it?" style="width:100%;margin-top:8px;border:1.5px solid #d9e6f2;border-radius:10px;padding:9px;font:700 13px/1.4 Nunito,sans-serif;color:#16384f;resize:vertical;box-sizing:border-box;"></textarea>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-top:6px;"><button type="button" style="border:none;border-radius:10px;padding:9px 16px;font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:13px;color:#fff;background:#1cb0f6;cursor:pointer;">Send</button><span style="font-weight:800;font-size:12px;color:#46a302;"></span></div>';
    const ta = card.querySelector("textarea"), send = card.querySelector("button"), msg = card.querySelector("span");
    send.onclick = function () {
      const text = (ta.value || "").trim(); if (!text) { ta.focus(); return; }
      sendFeedback({ game: game, sound: sound, text: text, code: code, childId: childId, level: level });
      msg.textContent = "Thanks! ✓"; send.disabled = true; send.style.opacity = ".5"; ta.disabled = true;
    };
    return card;
  }

  // On a game's win screen, when it was launched as part of a level session, swap
  // the standalone "play again / done for now" controls for a single "Next game →"
  // that advances the level (or finishes it). Returns true if it took over.
  function sessionButtons(winEl) {
    if (!winEl) return false;
    if (!session.active()) return false;
    try { if (!/[?&]session=1\b/.test(location.search)) return false; } catch (e) { return false; }
    const pos = session.pos(); const last = pos && pos.i >= pos.n;
    // hide the per-game replay + exit controls
    const ag = winEl.querySelector("#again"); if (ag) ag.style.display = "none";
    Array.prototype.forEach.call(winEl.querySelectorAll("a"), function (a) {
      const h = a.getAttribute("href") || "";
      if (/play\.html|map\.html/.test(h) || /done for now/i.test(a.textContent || "")) a.style.display = "none";
    });
    if (winEl.querySelector(".sona-next")) return true; // already added
    const chip = document.createElement("div");
    chip.textContent = "Game " + pos.i + " of " + pos.n;
    chip.style.cssText = "margin-top:16px;font-family:'Baloo 2',sans-serif;font-weight:800;font-size:13px;color:#8aa0b5;letter-spacing:.05em;text-transform:uppercase;";
    const proto = winEl.querySelector(".btn");
    const btn = document.createElement("button");
    btn.className = (proto ? proto.className : "btn") + " sona-next";
    if (!proto) btn.style.cssText = "margin-top:14px;border:none;border-radius:16px;padding:15px 44px;font-family:'Baloo 2',sans-serif;font-weight:800;font-size:18px;color:#fff;background:#ff8a3d;box-shadow:0 5px 0 0 #ef6f23;cursor:pointer;";
    else btn.style.marginTop = "14px";
    btn.textContent = last ? "See your path →" : "Next step →";
    btn.onclick = function () {
      try { sfx && sfx.tap && sfx.tap(); } catch (e) {}
      const s0 = load(SESKEY, null); const lvl = s0 ? s0.level : null;
      session.next();                       // mark this step done
      // return to the level path so it fills in toward the prize (path handles the finale)
      location.href = lvl ? ("/level.html?level=" + lvl) : "/levelcomplete.html";
    };
    winEl.appendChild(chip);
    if (isPilot() || debugOn()) { try { winEl.appendChild(gameFeedbackCard()); } catch (e) {} }
    winEl.appendChild(btn);
    return true;
  }

  // ── first-touch attribution: remember the UTM tags / referrer that brought this
  //    visitor, so the speech-check lead can show which content actually converted. ──
  const UTMKEY = "sona.utm.v1";
  function captureUTM() {
    try {
      if (localStorage.getItem(UTMKEY)) return; // keep the first touch
      const p = new URLSearchParams(location.search); const o = {}; let any = false;
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
        const v = p.get(k); if (v) { o[k] = v.slice(0, 120); any = true; }
      });
      const ref = document.referrer || "";
      if (!any && !ref) return;            // a plain direct hit — nothing to attribute
      o.referrer = ref.slice(0, 200); o.landing = location.pathname.slice(0, 120); o.ts = new Date().toISOString();
      localStorage.setItem(UTMKEY, JSON.stringify(o));
    } catch (e) {}
  }
  function utm() { try { return JSON.parse(localStorage.getItem(UTMKEY) || "{}"); } catch (e) { return {}; } }
  try { captureUTM(); } catch (e) {}

  // ── SLP/parent pilot: free full access + (consented) outcome capture ──
  const PILOTKEY = "sona.pilot.v1";
  function pilotInfo() { return load(PILOTKEY, { consent: false }); }
  function isPilot() { return !!pilotInfo().consent; }
  // The one writer of the pilot code — so the one place a founding "ff-" code
  // could be overwritten. Carry it into the household key first.
  function startPilot(code) { try { const cur = pilotInfo(); if (cur.consent && String(cur.code || "").indexOf("ff-") === 0) _markFounding(cur.code); save(PILOTKEY, { code: (code || cur.code || "pilot"), childId: cur.childId || (Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)), consent: true, consentAt: new Date().toISOString(), ver: 1 }); } catch (e) {} }
  // how many levels are open: pilot families get the whole town; everyone else Level 1 for now.
  function unlockedThru() { return isPilot() ? 10 : 1; }

  // outcome capture: every scored attempt → per-sound accuracy over time (the "does it work" data).
  const ATTKEY = "sona.attempts.v1", OUTKEY = "sona.outcomes.v1";
  function logAttempt(a) {
    try {
      a = a || {};
      var reps = a.reps == null ? 1 : Math.max(0, Math.floor(Number(a.reps) || 0));
      if (!reps) return;
      const sound = a.sound || "?", pass = !!a.pass, day = today();
      const word = String(a.word || "").toLowerCase();
      const log = load(ATTKEY, []); log.push({ g: a.game || "", s: sound, p: pass, sc: (typeof a.score === "number" ? Math.round(a.score) : null), w: word, reps: reps, t: Date.now() });
      save(ATTKEY, log.slice(-600));
      const o = load(OUTKEY, {}); const bs = o[sound] || (o[sound] = { attempts: 0, passes: 0, firstAt: day, lastAt: day, days: {} });
      bs.tries = (typeof bs.tries === "number" ? bs.tries : bs.attempts) + reps;
      bs.attempts++; if (pass) bs.passes++; bs.lastAt = day;
      const d = bs.days[day] || (bs.days[day] = { a: 0, p: 0 });
      d.tries = (typeof d.tries === "number" ? d.tries : d.a) + reps;
      d.a++; if (pass) d.p++;
      // by word position (initial/medial/final/vocalic/blends) — the clinical breakdown.
      // Prefer the word's own tagged position; else fall back to the practice setting.
      let pos = a.pos || "";
      if (!pos && word) { const hit = (WORDS[sound] || []).filter(function (x) { return x.w === word; })[0]; if (hit) pos = hit.pos || "i"; }
      if (!pos) { try { pos = practicePos(); } catch (e) { pos = ""; } }
      if (pos && pos !== "mix" && pos !== "all") {
        bs.byPos = bs.byPos || {}; const bp = bs.byPos[pos] || (bs.byPos[pos] = { a: 0, p: 0 }); bp.a++; if (pass) bp.p++;
      }
      // by target word — per-word accuracy (word games pass a.word)
      if (word) { bs.byWord = bs.byWord || {}; const bw = bs.byWord[word] || (bs.byWord[word] = { a: 0, p: 0 }); bw.a++; if (pass) bw.p++; }
      save(OUTKEY, o);
      // keep Today/Progress alive from real game play (not just the lesson flow):
      // every scored attempt counts a word and keeps today's streak going.
      try { const g = getProgress(); g.totals.words = (g.totals.words || 0) + reps; bumpStreak(g); save(GKEY, g); } catch (e2) {}
      _trophyAdd();
      _goalCheck();
      // pilot/founding beacon: consented, counts-only, throttled to 1/min inside sendProgress
      try { sendProgress("auto"); } catch (e3) {}
    } catch (e) {}
  }
  function outcomes() { return load(OUTKEY, {}); }

  // ── weekly practice volume (the parent's headline metric) ────────────────
  // Total honest reps in a Mon–Sun local week, from the day ledger. Volume is
  // a PARENT-side motivator. Home's corner shows the week's count to whoever
  // holds the phone — a number that only climbs, never a target — and every
  // comparison (last week, best week) sits behind the grown-ups gate. The
  // count stays on this device: the anonymous volume beacon is retired.
  function fid() {
    try {
      let f = localStorage.getItem("sona.fid.v1");
      if (!f) { f = "f" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem("sona.fid.v1", f); }
      return f;
    } catch (e) { return ""; }
  }
  function isoWeek(d) {
    const t = d ? new Date(d) : new Date();
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); // nearest Thursday
    const y = t.getFullYear();
    const jan4 = new Date(y, 0, 4);
    const wk = 1 + Math.round(((t - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return y + "-W" + String(wk).padStart(2, "0");
  }
  // REPWEEKS1 (Travis, 28 Sep 2026: the week's reps in Home's top corner, and
  // week by week in Settings). ONE bucketing of the day ledger feeds Home,
  // Progress and Settings, so no two surfaces can disagree about "this week" —
  // Home's old Grown-ups pop-up summed sound checks while Progress summed
  // tries, and showed two different numbers for the same week.
  //
  // A rep is a voiced try the practice screen counted: days[day].tries. Days
  // logged before tries were counted (22 Sep 2026) hold only .a, one per sound
  // check — a floor, not a count — so they add nothing. Falling back to them
  // made the first counted week look like a leap, and handed out a "best week"
  // won against numbers that were never counted. For the same reason a week
  // before REPS_SINCE (the Monday of that week) cannot hold a rep at all: a
  // .tries dated earlier is a phone clock that was wrong, and would otherwise
  // stand as a best week no child could ever beat.
  const REPS_SINCE = "2026-09-21";
  function _dayTries(d) { return d && typeof d.tries === "number" && d.tries > 0 ? Math.floor(d.tries) : 0; }
  function _weekStart(y, m, d) { const t = new Date(y, m, d); t.setDate(t.getDate() - (t.getDay() + 6) % 7); return t; }
  // Monday's local day key for the week holding dayKey ("YYYY-MM-DD"). Built
  // from date parts, never parsed, so a DST night cannot slide a day across.
  function _weekOf(dayKey) {
    const p = String(dayKey).split("-"); if (p.length !== 3) return "";
    const t = _weekStart(+p[0], +p[1] - 1, +p[2]); return isNaN(t.getTime()) ? "" : _localDay(t.getTime());
  }
  function _mondayKey(offsetWeeks) { const n = new Date(); return _localDay(_weekStart(n.getFullYear(), n.getMonth(), n.getDate() + 7 * (offsetWeeks || 0)).getTime()); }
  // One daily ledger feeds both daily goals and week totals. It never writes.
  // slot: one child's ledger whoever is active (the weekly report, REPORT1,
  // counts every child on the phone); left out, the active child's.
  function _repDays(sound, practiceOnly, slot) {
    const out = slot === undefined ? outcomes() : _loadFor(slot, OUTKEY, {}), counts = {};
    function add(k, n) { const w = _weekOf(k); if (n > 0 && isFinite(n) && w && w >= REPS_SINCE && /^\d{4}-\d{2}-\d{2}$/.test(k)) counts[k] = (counts[k] || 0) + n; }
    Object.keys(out).forEach((s) => {
      if (sound && s !== sound) return;
      const days = (out[s] && out[s].days) || {};
      Object.keys(days).forEach((k) => add(k, _dayTries(days[k])));
    });
    // Play reps, including accepted book words, never enter clinical outcomes.
    const gr = practiceOnly ? {} : slot === undefined ? load(GAMEREPKEY, {}) : _loadFor(slot, GAMEREPKEY, {});
    Object.keys(gr).forEach((k) => { const d = gr[k] || {}; Object.keys(d).forEach((s) => { if (!sound || s === sound) add(k, Math.max(0, Math.floor(Number(d[s]) || 0))); }); });
    return counts;
  }
  function _repBuckets(sound, practiceOnly) {
    const days = _repDays(sound, practiceOnly), weeks = {};
    Object.keys(days).forEach((k) => { const w = _weekOf(k); weeks[w] = (weeks[w] || 0) + days[k]; });
    return weeks;
  }
  function dayReps(dayKey, practiceOnly) { return _repDays(null, practiceOnly)[dayKey || today()] || 0; }
  function dayGoal() { const n = dayReps(), goal = repGoal(); return { n, goal, done: !!load(GOALKEY, {})[today()] || n >= goal }; }
  // A silent, nonblocking note can appear over a live microphone. No audio,
  // confetti, focus change, parent gate or input interception belongs here.
  function _goalBanner(n) {
    if (document.hidden) return;
    try {
      if (document.getElementById("sonaGoalBanner")) return;
      const b = document.createElement("div"); b.id = "sonaGoalBanner"; b.setAttribute("role", "status");
      b.textContent = "You did it! " + n + " reps today. Keep playing!";
      b.style.cssText = "position:fixed;z-index:1200;top:calc(env(safe-area-inset-top,0px) + 12px);left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);padding:12px 18px;border-radius:20px;background:#fff8e9;color:#4a2c14;box-shadow:0 4px 20px #4a2c1426;font:800 17px/1.35 'Nunito',sans-serif;text-align:center;pointer-events:none";
      document.body.appendChild(b); setTimeout(() => b.remove(), 4000);
    } catch (e) {}
  }
  // The stamp, the event and the banner happen once a day, as before; the
  // early return moved (11 Oct 2026) so the Practice Board's hook can run
  // after the stamp on a later rep (a board day needs BOARD_MIN_REPS too),
  // and queued board deletions go out from practice and game pages. Home
  // never calls this.
  function _goalCheck() {
    try { _boardSendLeaves(true); } catch (e) {}   // BOARD2: queued board deletions, at most once a minute; a no-op when none
    try {
      const d = dayGoal(), t = today(), stamps = load(GOALKEY, {});
      if (!d.done) return;
      if (!stamps[t]) { stamps[t] = d.goal; save(GOALKEY, stamps); track("rep goal met"); _goalBanner(d.n); }
      try { _boardQueue(_slot()); } catch (e) {}   // BOARD2: a no-op unless this child is on the board
    } finally {
      // REPORT1: the weekly report's numbers, after today's goal stamp so they
      // count it; at most every 30 minutes, and a no-op unless asked for
      try { _reportTouch(); } catch (e) {}
    }
  }
  // ── GAMEREPS1: a sound said inside a game is a rep too (Travis, 29 Sep
  // 2026: "yeah count as reps"). Every place a game asks for the sound and
  // hears it (the say-it card between rounds, Echo's sound powers, a Hoops
  // word, Feed Echo's picture hint) adds one here, and the week's count
  // above reads it with the practice page's tries. It is NOT practice data:
  // it never enters outcomes(), so no pass rate, clinician's note or shared
  // progress sees it; since 11 Oct 2026 it earns trophies, a play currency
  // (TROPHY1). Only a voiced try that passed the game's own check ever calls
  // it, so silence still never counts.
  const GAMEREPKEY = "sona.gamereps.v1";
  function gameRep(sound) {
    try {
      const s = String(sound || "").toUpperCase(); if (ALL_SOUNDS.indexOf(s) < 0) return;
      const t = today(), gr = load(GAMEREPKEY, {}), d = gr[t] || (gr[t] = {});
      // kept like the day ledger, unpruned: the best week reads all of it
      d[s] = (d[s] || 0) + 1; save(GAMEREPKEY, gr); _trophyAdd(); _goalCheck();
    } catch (e) {}
  }
  // sound narrows the count to one sound — Progress names the week's busiest
  // sound beside the total, and both have to come from the same rule.
  function weekReps(offsetWeeks, sound, practiceOnly) { return _repBuckets(sound, practiceOnly)[_mondayKey(offsetWeeks)] || 0; }
  // The last n weeks, oldest first, ending with this one. The list never
  // starts before the first week with a counted rep: a zero bar for a week
  // nobody was counting would say the child did nothing. best is the best
  // FINISHED week, so this week is measured against it rather than itself;
  // days dated after this week (a phone clock that was wrong) never count.
  // Reads only — Home calls it on every load and must write nothing.
  function repWeeks(n) {
    n = Math.max(1, Math.min(52, parseInt(n, 10) || 8));
    const wk = _repBuckets(), cur = _mondayKey(0);
    const past = Object.keys(wk).filter((k) => k < cur).sort();
    let best = null;
    past.forEach((k) => { if (!best || wk[k] > best.reps) best = { start: k, reps: wk[k] }; });
    const first = past.length ? past[0] : cur;
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = _mondayKey(-i); if (k < first) continue;
      weeks.push({ start: k, reps: wk[k] || 0, current: i === 0, best: !!best && k === best.start });
    }
    const thisWeek = wk[cur] || 0;
    return { weeks: weeks, thisWeek: thisWeek, lastWeek: wk[_mondayKey(-1)] || 0, best: best, newBest: !!best && thisWeek > best.reps, since: past.length ? past[0] : (thisWeek ? cur : null) };
  }
  // Retained as a no-op for cached pages. Family comparisons and their beacon
  // are retired; counts remain local except consented pilot progress sharing.
  // The opt-in Practice Board (BOARD2, below) is a separate thing: goal days
  // only, under a nickname, after a grown-up's email confirmation.
  function repsBeacon() {}

  // ── TROPHY1 (Travis, 9 Oct 2026: "a currency so they can buy stuff"; D1,
  // refined 11 Oct 2026). Trophies follow the honest rep (a practice try
  // through logAttempt, an accepted game ask or book word through gameRep),
  // and a day at the goal is always 30 of them, whatever the goal: a grown-up
  // raising the goal cannot earn more, and a speech therapist's low dose cannot
  // earn less. At the default goal of 30 that is one trophy a rep. Never spent,
  // never lost: the ledger is "paid up to today's derived count", so a double
  // call, a reload or a goal change can never pay twice or take one back. A
  // pass and a miss count the same (effort, not accuracy). It never enters
  // outcomes(), sendProgress or any clinician view, and "Reset progress"
  // leaves it. A child already on Sona starts with what their real reps since
  // REPS_SINCE earned, counted once, at the first rep after this build.
  const TROPHYKEY = "sona.trophy.v1", TROPHY_FILL = 30;
  // The goal a day is measured against: the stamp it met (the goal at that
  // moment); today's goal for today; 30 before goal stamps existed; and for a
  // past day that never met its goal, never less than 30, so it is never
  // over-paid.
  function _goalOn(k, stamps) {
    const s = stamps[k] | 0; if (s > 0) return s;
    if (k < GOAL_SINCE) return TROPHY_FILL;
    const g = Math.max(1, repGoal() | 0);
    return k === today() ? g : Math.max(TROPHY_FILL, g);
  }
  function _dayTrophies(k, reps, stamps) { return Math.min(TROPHY_FILL, Math.floor(TROPHY_FILL * Math.max(0, reps | 0) / _goalOn(k, stamps))); }
  function _trophyToday() { const t = today(); return _dayTrophies(t, dayReps(t), load(GOALKEY, {})); }
  // every day BEFORE today (or only one month of them). Pure.
  function _trophyHist(ym) {
    const days = _repDays(null, false), stamps = load(GOALKEY, {}), t = today(); let n = 0;
    Object.keys(days).forEach((k) => { if (k >= t || (ym && k.slice(0, 7) !== ym)) return; n += _dayTrophies(k, days[k], stamps); });
    return n;
  }
  // Pure: Home, the road and the levels read this, and it writes nothing.
  function trophyState() {
    const t = today(), ym = t.slice(0, 7), s = load(TROPHYKEY, {});
    if (!(s.v >= 1)) { const dn = _trophyToday(); return { total: _trophyHist() + dn, today: dn, month: _trophyHist(ym) + dn, ym }; }
    const dn = s.d === t ? (s.dn | 0) : 0, mn = s.m === ym ? (s.mn | 0) : 0;
    return { total: s.t | 0, today: dn, month: mn, ym };
  }
  function trophies() { return trophyState().total; }
  // logAttempt and gameRep call this after the rep is saved, and saveProfile
  // when a lowered goal fills today with reps already said.
  function _trophyAdd() {
    try {
      const t = today(), ym = t.slice(0, 7); let s = load(TROPHYKEY, {});
      if (!(s.v >= 1)) s = { v: 1, t: _trophyHist(), d: t, dn: 0, m: ym, mn: _trophyHist(ym) };
      if (s.d !== t) { s.d = t; s.dn = 0; }
      if (s.m !== ym) { if (s.m) { s.pm = s.m; s.pmn = s.mn | 0; } s.m = ym; s.mn = 0; }
      const add = _trophyToday() - (s.dn | 0);
      if (add > 0) { s.dn = (s.dn | 0) + add; s.t = (s.t | 0) + add; s.mn = (s.mn | 0) + add; }
      save(TROPHYKEY, s);
    } catch (e) {}
  }

  // ── CHEST1: the daily chest (Travis, 9 Oct 2026: "a currency so they can
  // buy stuff"; D2, 11 Oct 2026). One chest a day, on a day the daily goal is
  // met (the same stamp dayGoal() reads). Fixed contents, shown before it
  // opens: 10 coins, and every fifth chest is a Big Chest of 25 coins and a
  // sticker. Nothing random, no timer; a day without the goal shows nothing
  // missed, and no chest piles up for later. Opened only on the Trophy Road
  // page, after three taps; Home only reads chestState().
  const CHESTKEY = "sona.chest.v1", CHEST_COINS = 10, CHEST_BIG_EVERY = 5, CHEST_BIG_COINS = 25;
  // Pure. big/coins/sticker describe the next chest to open (today's, when it
  // is still shut); openedBig says whether the one opened today was a Big
  // Chest, so the road shows the chest the child really opened.
  function chestState() {
    const c = load(CHESTKEY, {}), opened = c.last === today(), big = ((c.n | 0) + 1) % CHEST_BIG_EVERY === 0;
    return { ready: !opened && dayGoal().done, opened, big, coins: big ? CHEST_BIG_COINS : CHEST_COINS, sticker: big,
      openedBig: opened && (c.n | 0) > 0 && (c.n | 0) % CHEST_BIG_EVERY === 0 };
  }
  function chestOpen() {
    const st = chestState(); if (!st.ready) return null;
    // the ledger first: a crash under-pays, never pays twice
    const c = load(CHESTKEY, {}); c.n = (c.n | 0) + 1; c.last = today(); save(CHESTKEY, c);
    const got = [{ coins: st.coins }]; addCoins(st.coins);
    if (st.sticker) got.push(_grantSticker());
    try { track("chest opened"); } catch (e) {}
    return got;
  }
  // the next sticker in the book; a full book pays 20 coins instead
  function _grantSticker() { const s = awardNextSticker(); if (s) return { sticker: s.id, name: s.name }; addCoins(20); return { coins: 20, full: true }; }

  // ── ROAD1 / MONTH1: the Trophy Road (Travis, 9 Oct 2026: "motivated over
  // weeks and months like Clash Royale"). Numbered stops across five lands, by
  // lifetime trophies, each gift fixed and shown before it is reached: coins,
  // stickers, "Level 2 opens in every game" (levels open by the trophy count
  // itself, LEVELS1; the stop is the celebration), and the road's own
  // buddies, hats and places. Nothing random, no timer, nothing lost: a
  // reached stop waits until it is opened. An item a child already owns pays
  // its coins (ROAD_ALT); an item listed on a stop AFTER a child opened it is
  // still given, once (roadSettle). A new item joins its stop only once its
  // painted art is on disk.
  // "October path" (MONTH_STEPS) is a small path by the trophies earned this
  // calendar month; it starts again each month, and every reached step of an
  // ended month is handed out by roadSettle(), which only the road page calls
  // (never Home). Kept per child. No event carries a stop or step number.
  const ROADKEY = "sona.road.v1", MONTH_SINCE = "2026-10", ROAD_BONUS_EVERY = 150;
  const ROAD_ALT = { characters: 100, outfits: 50, backdrops: 80 };
  const ROAD_LANDS = [
    { id: "meadow", name: "Sunny Meadow", from: 0, art: "customize-forest-v2" }, { id: "beach", name: "Beach Bay", from: 300, art: "customize-beach-v2" },
    { id: "snow", name: "Snowy Peak", from: 750, art: "customize-snow-v2" }, { id: "sea", name: "Under the Sea", from: 1350, art: "customize-sea-v2" },
    { id: "sky", name: "Starry Sky", from: 2100, art: "customize-space-v2" }, { id: "champ", name: "Champion Trail", from: 3000, art: "customize-mountain-v2" } ];
  // The stop table Travis approved (11 Oct 2026), with the road's own
  // buddies, hats and places (frog, penguin, lion, unicorn; sunhat, starclip,
  // headphones; snow, sea), which joined their stops once their painted art
  // was on disk. An earlier build of the road paid stops 6, 12, 15, 19 and
  // 25 what their item is worth in coins (ROAD_ALT); a child who opened one
  // then keeps those coins and is handed the item by roadSettle, once, with
  // no second payment.
  const ROAD_STOPS = [
    { n: 1, at: 30, gift: [{ coins: 20 }] },
    { n: 2, at: 80, gift: [{ sticker: 1 }] },
    { n: 3, at: 150, gift: [{ level: 2 }, { coins: 20 }] },
    { n: 4, at: 220, gift: [{ coins: 30 }] },
    { n: 5, at: 300, big: true, gift: [{ coins: 40 }, { sticker: 1 }, { land: "beach" }] },
    { n: 6, at: 380, gift: [{ hat: "sunhat" }] },
    { n: 7, at: 460, gift: [{ coins: 40 }] },
    { n: 8, at: 540, gift: [{ sticker: 1 }] },
    { n: 9, at: 640, gift: [{ coins: 50 }] },
    { n: 10, at: 750, big: true, gift: [{ level: 3 }, { buddy: "frog" }, { coins: 50 }, { land: "snow" }] },
    { n: 11, at: 850, gift: [{ sticker: 1 }] },
    { n: 12, at: 950, gift: [{ place: "snow" }] },
    { n: 13, at: 1050, gift: [{ coins: 60 }] },
    { n: 14, at: 1150, gift: [{ sticker: 1 }] },
    { n: 15, at: 1250, gift: [{ hat: "starclip" }] },
    { n: 16, at: 1350, big: true, gift: [{ buddy: "penguin" }, { coins: 60 }, { land: "sea" }] },
    { n: 17, at: 1475, gift: [{ coins: 70 }] },
    { n: 18, at: 1600, gift: [{ sticker: 1 }] },
    { n: 19, at: 1725, gift: [{ place: "sea" }] },
    { n: 20, at: 1850, gift: [{ coins: 80 }] },
    { n: 21, at: 1975, gift: [{ sticker: 1 }] },
    { n: 22, at: 2100, big: true, gift: [{ buddy: "lion" }, { coins: 80 }, { land: "sky" }] },
    { n: 23, at: 2250, gift: [{ coins: 90 }] },
    { n: 24, at: 2400, gift: [{ sticker: 1 }] },
    { n: 25, at: 2550, gift: [{ hat: "headphones" }] },
    { n: 26, at: 2700, gift: [{ coins: 100 }] },
    { n: 27, at: 2850, gift: [{ sticker: 1 }] },
    { n: 28, at: 3000, big: true, gift: [{ buddy: "unicorn" }, { coins: 100 }, { sticker: 1 }, { land: "champ" }] } ];
  const MONTH_STEPS = [
    { n: 1, at: 40, gift: [{ coins: 5 }] }, { n: 2, at: 100, gift: [{ sticker: 1 }] }, { n: 3, at: 180, gift: [{ coins: 10 }] },
    { n: 4, at: 260, gift: [{ sticker: 1 }] }, { n: 5, at: 340, gift: [{ coins: 15 }] }, { n: 6, at: 420, gift: [{ sticker: 1 }] },
    { n: 7, at: 500, gift: [{ coins: 20 }] }, { n: 8, at: 600, big: true, gift: [{ coins: 30 }, { sticker: 1 }] } ];
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const _ROAD_KINDS = { buddy: "characters", hat: "outfits", place: "backdrops" };
  // A stop by number: the table up to 28, then the Champion Trail's bonus
  // stops every 150 trophies, 30 coins and a sticker by turns.
  function roadStop(n) {
    n = parseInt(n, 10); if (!(n >= 1)) return null;
    if (n <= ROAD_STOPS.length) return ROAD_STOPS[n - 1];
    const k = n - ROAD_STOPS.length;
    return { n, at: ROAD_STOPS[ROAD_STOPS.length - 1].at + k * ROAD_BONUS_EVERY, gift: k % 2 ? [{ coins: 30 }] : [{ sticker: 1 }] };
  }
  function _roadReached(t) {             // the highest stop a lifetime count reaches (0 before the first)
    const last = ROAD_STOPS[ROAD_STOPS.length - 1];
    if (t >= last.at) return ROAD_STOPS.length + Math.floor((t - last.at) / ROAD_BONUS_EVERY);
    let n = 0; ROAD_STOPS.forEach((s) => { if (t >= s.at) n = s.n; }); return n;
  }
  function _roadRec() {
    const r = load(ROADKEY, {}), o = (v) => (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
    return { got: o(r.got), items: o(r.items), m: typeof r.m === "string" ? r.m : "", mgot: o(r.mgot), rolled: Array.isArray(r.rolled) ? r.rolled : [] };
  }
  // an item gift on a stop: {kind, id, name}, only for a catalog entry (never byId's fallback)
  function _roadItem(g) {
    for (const k in _ROAD_KINDS) if (g && typeof g[k] === "string") {
      const kind = _ROAD_KINDS[k], list = kind === "characters" ? CHARACTERS : kind === "outfits" ? OUTFITS : BACKDROPS;
      for (let i = 0; i < list.length; i++) if (list[i].id === g[k]) return { kind, id: g[k], name: list[i].name };
      return null;
    }
    return null;
  }
  function _ymNext(ym) { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 12 ? (y + 1) + "-01" : y + "-" + String(m + 1).padStart(2, "0"); }
  function _monthName(ym) { return MONTH_NAMES[(+String(ym).slice(5, 7) || 1) - 1] || ""; }
  // Pure: every ended month not yet settled, with the reached steps it still
  // owes ({m, steps}). The month last visited owes what was not opened then;
  // a first visit starts at the later of MONTH_SINCE and the first month of
  // the child's trophy history.
  function _monthsOwed(r) {
    const cur = today().slice(0, 7), out = [];
    let from = r.m;
    if (!from) { const days = Object.keys(_repDays(null, false)).sort(); from = days.length ? days[0].slice(0, 7) : cur; }
    if (from < MONTH_SINCE) from = MONTH_SINCE;
    if (!/^\d{4}-\d{2}$/.test(from) || from >= cur) return out;
    const tr = load(TROPHYKEY, {});
    for (let m = from, guard = 0; m < cur && guard < 240; m = _ymNext(m), guard++) {
      const count = (tr.v >= 1 && tr.m === m) ? (tr.mn | 0) : (tr.v >= 1 && tr.pm === m) ? (tr.pmn | 0) : _trophyHist(m);
      const done = m === r.m ? r.mgot : {};
      const steps = MONTH_STEPS.filter((s) => count >= s.at && !done[s.n]);
      out.push({ m, steps });
    }
    return out;
  }
  // Pure: the item gifts listed on stops already opened that were never handed over.
  function _roadLate(r) {
    const out = [];
    Object.keys(r.got).forEach((k) => {
      const s = roadStop(k); if (!s || !r.got[k]) return;
      s.gift.forEach((g) => { const it = _roadItem(g); if (it && !r.items[s.n + ":" + it.id]) out.push({ n: s.n, item: it }); });
    });
    return out;
  }
  // Pure: everything the road page and Home's card show.
  function roadState() {
    const ts = trophyState(), t = ts.total, r = _roadRec(), cur = ts.ym, stop = _roadReached(t);
    let land = ROAD_LANDS[0]; ROAD_LANDS.forEach((l) => { if (t >= l.from) land = l; });
    let waiting = 0, lowest = null;
    for (let n = 1; n <= stop; n++) if (!r.got[n]) { waiting++; if (lowest === null) lowest = n; }
    // a phone clock set back before the month last visited: monthOpen can't
    // open this month's steps (that would open a month twice), so none is
    // shown reached or counted as waiting until the clock catches up
    const mgot = r.m === cur ? r.mgot : {}, frozen = !!r.m && r.m > cur;
    const steps = MONTH_STEPS.map((s) => ({ n: s.n, at: s.at, gift: s.gift, big: !!s.big, reached: !frozen && ts.month >= s.at, got: !!mgot[s.n] }));
    steps.forEach((s) => { if (s.reached && !s.got) waiting++; });
    _monthsOwed(r).forEach((o) => { waiting += o.steps.length; });
    _roadLate(r).forEach((x) => { if (!owns(x.item.kind, x.item.id)) waiting++; });
    const nx = roadStop(stop + 1);
    return { trophies: t, coins: coinsNow(), land: { id: land.id, name: land.name, art: land.art }, stop, got: Object.assign({}, r.got),
      next: { n: nx.n, at: nx.at, gift: nx.gift, big: !!nx.big }, waiting, lowestWaiting: lowest,
      month: { ym: cur, name: _monthName(cur), count: ts.month, steps }, chest: chestState(), rolled: r.rolled.slice() };
  }
  // Hands over one gift and says what the child got. An item is recorded
  // before this runs (the ledger first); one already owned pays its coins.
  function _roadGive(g) {
    if (g.coins) { const c = _coinInt(g.coins); if (c) addCoins(c); return { coins: c }; }
    if (g.sticker) return _grantSticker();
    if (g.level) return { level: g.level | 0 };
    if (g.land) { const l = ROAD_LANDS.filter((x) => x.id === g.land)[0]; return { land: g.land, name: l ? l.name : "" }; }
    const it = _roadItem(g); if (!it) return null;
    if (owns(it.kind, it.id)) { const c = ROAD_ALT[it.kind] | 0; addCoins(c); return { alt: { kind: it.kind, id: it.id, name: it.name, coins: c } }; }
    addOwned(it.kind, it.id); return { item: it };
  }
  function roadOpen(n) {
    const s = roadStop(n); if (!s) return { ok: false, reason: "not-yet" };
    const r = _roadRec();
    if (r.got[s.n]) return { ok: false, reason: "opened" };
    if (trophies() < s.at) return { ok: false, reason: "not-yet" };
    r.got[s.n] = 1; s.gift.forEach((g) => { const it = _roadItem(g); if (it) r.items[s.n + ":" + it.id] = 1; });
    save(ROADKEY, r);
    const gifts = []; s.gift.forEach((g) => { const x = _roadGive(g); if (x) gifts.push(x); });
    try { track("road gift opened"); } catch (e) {}
    return { ok: true, gifts };
  }
  function monthOpen(step) {
    const s = MONTH_STEPS.filter((x) => x.n === parseInt(step, 10))[0]; if (!s) return { ok: false, reason: "not-yet" };
    const ts = trophyState(); let r = _roadRec();
    if (r.m !== ts.ym) { roadSettle(); r = _roadRec(); }   // a page left open across the month's end
    if (r.m !== ts.ym) return { ok: false, reason: "not-yet" };
    if (r.mgot[s.n]) return { ok: false, reason: "opened" };
    if (ts.month < s.at) return { ok: false, reason: "not-yet" };
    r.mgot[s.n] = 1; save(ROADKEY, r);
    const gifts = []; s.gift.forEach((g) => { const x = _roadGive(g); if (x) gifts.push(x); });
    try { track("month gift opened"); } catch (e) {}
    return { ok: true, gifts };
  }
  // The road page's load, and only the road page's: every ended month's
  // reached steps go into the wallet (listed in rolled for one notice), then
  // any item listed on an opened stop after it was opened is given. null when
  // nothing was handed out.
  function roadSettle() {
    try {
      const cur = today().slice(0, 7); let r = _roadRec();
      const owed = (r.m && r.m > cur) ? [] : _monthsOwed(r), rolled = [], late = [];
      if (!r.m || r.m < cur) {
        // the ledger first (a crash under-pays, never pays twice): the month
        // moves on and the notice names each month that handed something out
        r.m = cur; r.mgot = {};
        owed.forEach((o) => { if (o.steps.length) r.rolled.push({ m: o.m, gifts: [].concat.apply([], o.steps.map((s) => s.gift)) }); });
        r.rolled = r.rolled.slice(-12);
        save(ROADKEY, r);
        owed.forEach((o) => {
          if (!o.steps.length) return;
          const gifts = []; o.steps.forEach((s) => s.gift.forEach((g) => { const x = _roadGive(g); if (x) gifts.push(x); }));
          rolled.push({ m: o.m, gifts });
        });
      }
      r = _roadRec();
      const owe = _roadLate(r);
      if (owe.length) {
        owe.forEach((x) => { r.items[x.n + ":" + x.item.id] = 1; });
        save(ROADKEY, r);
        owe.forEach((x) => { if (!owns(x.item.kind, x.item.id)) { addOwned(x.item.kind, x.item.id); late.push(x.item); } });
      }
      return (rolled.length || late.length) ? { rolled, late } : null;
    } catch (e) { return null; }
  }
  // the road page's month notice was seen: it is not shown again
  function roadRolledSeen() { const r = _roadRec(); if (!r.rolled.length) return; r.rolled = []; save(ROADKEY, r); }

  // ── LEVELS1 (Travis, 9 Oct 2026: "levels inside games"). Every game opens
  // exactly as before: nothing here is read by gameAccess, gated, premium or
  // the catalog, and a level is never sold. Inside nine of them, Level 2 opens
  // at 150 trophies and Level 3 at 750, for all of them at once. Harder levels
  // change only finger play (speed, counts, new songs); never what a child
  // says, how often, the hearts, or any help that makes every round end, and
  // every help path reads Level 1's numbers (each page keeps its Level 1
  // tables on their own lines and overrides after them). Feed Echo keeps one
  // level until Rachel says, and a parked game has none. Kept per child
  // (PER_KID). A tap plays the level last picked; Home asks once per game when
  // a new level opens (playLevelAsk), and that tap and a pick are the only
  // writes Home makes. A grown-up can hold a child at Level 1 (cap). A child's
  // longest row at Level 2 and 3 is kept here; Level 1's stays with Beat Your
  // Best, so a best is never measured against a level whose top it cannot
  // reach. Nothing here is sent anywhere: the game page says "level played".
  const PLAYLEVELKEY = "sona.playlevel.v1", PLAY_LEVEL_AT = [0, 150, 750];
  // what the sheet and the road say under each level (kid copy, beneath the numeral)
  const PLAY_LEVEL_LINES = {
    slice:   ["The fruit stand", "Faster fruit!", "Fruit party!"],
    tiles:   ["Twinkle, Mary, Row Your Boat", "Hot Cross Buns and more", "Are You Sleeping and more"],
    stack:   ["A tall tower", "Taller and faster", "The tallest tower!"],
    run:     ["Park, beach, forest", "A faster run", "The fastest run!"],
    glide:   ["Easy flying", "Narrow gaps", "Sky champion!"],
    bubbles: ["Bubbles bob", "More bubbles!", "Bonus bubbles!"],
    hoops:   ["The hoop starts still", "The hoop slides from the start", "The hoop zooms!"],
    soccer:  ["Bo waits at first", "Bo slides sooner", "Bo dives!"],
    dino:    ["Big brush", "Smaller brush", "Deep dig!"] };
  // a game with levels, by its own key (never a name off Object.prototype),
  // and never one parked as Coming soon
  function _lvKey(key) {
    if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(PLAY_LEVEL_LINES, key)) return "";
    return (GAME_ACTS[key] && GAME_ACTS[key].comingSoon) ? "" : key;
  }
  function _lvState() { const p = load(PLAYLEVELKEY, {}); return (p && typeof p === "object" && !Array.isArray(p)) ? p : {}; }
  function _lvOf(map, key) { return (map && typeof map === "object" && Object.prototype.hasOwnProperty.call(map, key)) ? map[key] : undefined; }
  // Pure: how many levels are open for this child, 1 to 3.
  function playLevelsOpen() {
    if ((_lvState().cap | 0) === 1) return 1;
    const t = trophies(); let n = 1;
    for (let i = 1; i < PLAY_LEVEL_AT.length; i++) if (t >= PLAY_LEVEL_AT[i]) n = i + 1;
    return n;
  }
  // Pure: the level a game page plays. A pick above what is open (a restored
  // backup can lower trophies) plays the highest open level, and is kept.
  function playLevel(key) {
    key = _lvKey(key); if (!key) return 1;
    const pick = parseInt(_lvOf(_lvState().pick, key), 10) || 1;
    return Math.max(1, Math.min(pick, playLevelsOpen()));
  }
  // Home's tap only: true once per game per newly opened level, and it records that.
  function playLevelAsk(key) {
    key = _lvKey(key); const open = playLevelsOpen();
    if (!key || open < 2) return false;
    const p = _lvState(); p.seen = (p.seen && typeof p.seen === "object") ? p.seen : {};
    if ((_lvOf(p.seen, key) | 0) >= open) return false;
    p.seen[key] = open; save(PLAYLEVELKEY, p); return true;
  }
  // a child's tap on the sheet or the road; it sends nothing
  function setPlayLevel(key, n) {
    key = _lvKey(key); n = parseInt(n, 10);
    if (!key || !(n >= 1 && n <= playLevelsOpen())) return false;
    const p = _lvState(); p.pick = (p.pick && typeof p.pick === "object") ? p.pick : {};
    p.pick[key] = n; save(PLAYLEVELKEY, p); return true;
  }
  // Settings only: "Level 1 only" (1), or open as earned (anything else)
  function setPlayLevelCap(n) { const p = _lvState(); if (n === 1 || n === "1") p.cap = 1; else delete p.cap; save(PLAYLEVELKEY, p); return true; }
  // Pure: what the sheet and the road show for one game.
  function playLevelInfo(key) {
    const k = _lvKey(key), open = playLevelsOpen(), t = trophies();
    return { key: k || String(key), pick: playLevel(k), cap: (_lvState().cap | 0) === 1,
      levels: (k ? PLAY_LEVEL_LINES[k] : []).map((line, i) => ({ n: i + 1, line, open: i + 1 <= open, at: PLAY_LEVEL_AT[i], have: t })) };
  }
  // A child's longest row at Level 2 or 3, by Level 1's rules: whole numbers
  // 1..99999, only ever up, answered before the write (a phone that cannot
  // save still tells the child the truth about the round they just played).
  function _lvRow(p, key, lv) {
    const r = _lvOf(_lvOf(p.best, key), String(lv));
    return (r && typeof r.n === "number" && r.n >= 1 && r.n <= 99999 && Math.floor(r.n) === r.n) ? r.n : 0;
  }
  function playBest(key, lv) {
    try { key = _lvKey(key); lv = parseInt(lv, 10); return (key && (lv === 2 || lv === 3)) ? _lvRow(_lvState(), key, lv) : 0; } catch (e) { return 0; }
  }
  function playBestOffer(key, lv, n) {
    const out = { best: 0, prev: 0, isNew: false };
    try {
      key = _lvKey(key); lv = parseInt(lv, 10);
      if (!key || !(lv === 2 || lv === 3)) return out;
      const p = _lvState(); out.prev = out.best = _lvRow(p, key, lv);
      if (!(typeof n === "number" && n >= 1 && n <= 99999 && Math.floor(n) === n) || n <= out.prev) return out;
      out.best = n; out.isNew = true;
      p.best = (p.best && typeof p.best === "object") ? p.best : {};
      p.best[key] = (p.best[key] && typeof p.best[key] === "object") ? p.best[key] : {};
      p.best[key][String(lv)] = { n: n, at: today() };
      save(PLAYLEVELKEY, p);
    } catch (e) {}
    return out;
  }

  // ── BOARD2: the Practice Board, the phone's half (Travis, 9 Oct 2026: "a
  // board of every kid in Sona … days practiced"; D8, 11 Oct 2026). BUILT
  // DARK: BOARD_LIVE is false here and in lib/board.ts (boardapitest pins the
  // two equal), and only a preview seam on localhost turns it on, for tests.
  // Switching it on is Travis's go, after a lawyer has named the consent
  // method; nothing in this block shows or sends anything while it is off,
  // except a deletion still owed (below).
  //   - A day on the board is a goal day (today's goal stamp) with at least
  //     BOARD_MIN_REPS reps. The phone only says "this child met the goal so
  //     many seconds ago"; the server works the day out by its own clock and
  //     counts it once, a day late at most and never early (lib/board.ts).
  //   - A grown-up turns it on for the household's children at once, by a
  //     link emailed to them (the four number words stop a child who can't
  //     read, not one who can). Nothing here says "on" until the server has
  //     handed back a member for that child (boardClaim), and the address is
  //     never kept.
  //   - Off for a phone set up through a speech therapist or a school, one
  //     shared by more than four children, a family who says a therapist or a
  //     school sent them, and a child under 5 (boardAllowed): checked at join,
  //     at every send and at every view, and a child who stops being allowed
  //     leaves by themselves.
  //   - Deleting always works: a deletion is queued on the phone FIRST, then
  //     sent whether or not the board is live, from Settings, the road page,
  //     the board page and (at most once a minute) every rep on a practice or
  //     game page. Home never calls anything here.
  //   - Never a name, an age, a sound, audio, fid or childId: the server gets
  //     a buddy id per child, a time-zone offset and "how long ago".
  // Every reply can arrive after a switch of child, so each async function
  // takes its slot first and writes through saveFor, never save().
  const BOARD_LIVE = false;   // pinned equal to lib/board.ts by boardapitest; flipping it is Travis's go (spec §16 step 12)
  function boardLive() {
    if (BOARD_LIVE) return true;
    try { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && sessionStorage.getItem("sona.boardpreview.v1") === "1"; } catch (e) { return false; }
  }
  const BOARDKEY = "sona.board.v1", BOARDCACHEKEY = "sona.boardcache.v1", BOARDPENDKEY = "sona.boardpend.v1", BOARDLEAVEKEY = "sona.boardleave.v1", BOARDASKKEY = "sona.boardask.v1";
  // a board day needs this many reps as well as the goal stamp (Rachel to confirm, R-B1)
  const BOARD_MIN_REPS = 10, BOARD_PEND_MS = 48 * 3600 * 1000, BOARD_AGO_MAX = 172800, BOARD_LEAVE_GIVEUP = 30 * 864e5;
  // the family's offset from UTC, in minutes, to the nearest quarter hour
  function _tz() { return Math.round(-new Date().getTimezoneOffset() / 15) * 15; }
  function _boardSlot(slot) { return (slot === undefined || slot === null) ? _slot() : String(slot); }
  function _boardSlots() { return _kids().list.map((k) => { const s = k.slot || ""; return { slot: s, name: String(_loadFor(s, PKEY, {}).childName || "") }; }); }
  function _boardBuddy(slot) { try { return characterById(_loadFor(slot, PKEY, {}).character).id; } catch (e) { return "fox"; } }
  function _boardClear(slot, key) { try { localStorage.removeItem((slot && PER_KID.has(key)) ? key + "@" + slot : key); } catch (e) {} }
  function _leaveList() { const l = load(BOARDLEAVEKEY, []); return Array.isArray(l) ? l.filter((x) => x && typeof x.t === "string" && x.t) : []; }
  function _boardQueueLeave(token) {
    if (typeof token !== "string" || !token) return;
    const l = _leaveList(); if (l.some((x) => x.t === token)) return;
    l.push({ t: token, at: Date.now() }); save(BOARDLEAVEKEY, l);
  }
  // steps 1 and 2 of leaving: the token is queued for deletion FIRST, then
  // this phone's two keys go (slot "" too). Answers the entry that was there.
  function _boardDrop(slot) {
    let e = {};
    try { e = _loadFor(slot, BOARDKEY, {}); if (e && typeof e.token === "string" && e.token) _boardQueueLeave(e.token); } catch (x) {}
    _boardClear(slot, BOARDKEY); _boardClear(slot, BOARDCACHEKEY);
    return e || {};
  }
  // A pending request was asked for these slots by position. A slot whose
  // child is gone keeps its place as null, so a claim deletes that member
  // instead of handing it to whoever sits in the slot next.
  function _boardPendForget(slots) {
    try {
      const p = load(BOARDPENDKEY, null); if (!p || !Array.isArray(p.slots)) return;
      let hit = false; p.slots = p.slots.map((s) => { if (s !== null && slots.indexOf(s) >= 0) { hit = true; return null; } return s; });
      if (hit) save(BOARDPENDKEY, p);
    } catch (e) {}
  }
  function _boardAfterImport(before) {
    const now = _kids().list.map((k) => k.slot || ""), changed = [];
    (before || []).forEach((b) => {
      if (now.indexOf(b.slot) >= 0 && String(_loadFor(b.slot, PKEY, {}).childName || "") === b.name) return;
      _boardDrop(b.slot); changed.push(b.slot);
    });
    if (changed.length) _boardPendForget(changed);
  }
  // a live pending request (48 hours), or null. Pure.
  function _boardPend() {
    const p = load(BOARDPENDKEY, null);
    if (!p || typeof p.pend !== "string" || !p.pend || !Array.isArray(p.slots) || !(Date.now() - (Number(p.at) || 0) < BOARD_PEND_MS)) return null;
    return p;
  }
  function _boardPendDrop(pend) { try { const p = load(BOARDPENDKEY, null); if (!pend || !p || p.pend === pend) _boardClear("", BOARDPENDKEY); } catch (e) {} }
  // One POST to a board route. Never throws: an error, a timeout or no
  // network is status 0, which every caller treats as "try again later".
  function _boardPost(name, body) {
    let ctl = null, to = 0;
    try { ctl = new AbortController(); to = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, 10000); } catch (e) { ctl = null; }
    const done = (x) => { clearTimeout(to); return x; };
    try {
      return fetch("/api/board/" + name, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", credentials: "same-origin", signal: ctl ? ctl.signal : undefined })
        .then((r) => r.text().then((t) => { let j = {}; try { j = JSON.parse(t); } catch (e) {} return { status: r.status, j: (j && typeof j === "object" && !Array.isArray(j)) ? j : {} }; }), () => ({ status: 0, j: {} }))
        .then(done, () => done({ status: 0, j: {} }));
    } catch (e) { return Promise.resolve(done({ status: 0, j: {} })); }
  }

  // Who may be on the board: { ok, why }. Read for the child the line is
  // about (slot), never just the one playing. "off" only pauses: it never
  // deletes anything here, and queued deletions still go out.
  function _boardClinic(slot) {
    try {
      if (["sona.slp", "sona.slpok", "sona.slpunlock", "sona.slpticket"].some((k) => !!localStorage.getItem(k))) return true;
      if (localStorage.getItem(BOARDASKKEY) === "clinic") return true;
      if (_kids().list.some((k) => _loadFor(k.slot || "", PKEY, {}).role === "slp")) return true;
      const pi = _loadFor(slot, "sona.pilot.v1", {});
      if (pi.consent || pi.code) return true;
      return false;
    } catch (e) { return true; }   // can't tell: off
  }
  function boardAllowed(slot) {
    slot = _boardSlot(slot);
    if (!boardLive()) return { ok: false, why: "off" };
    if (!_kids().list.some((k) => (k.slot || "") === slot)) return { ok: false, why: "none" };
    if (_boardClinic(slot)) return { ok: false, why: "clinic" };
    if (_kids().list.length > 4) return { ok: false, why: "many" };
    const age = _loadFor(slot, PKEY, {}).childAge, a = String(age == null ? "" : age).trim();
    if (!/^\d+$/.test(a) || parseInt(a, 10) < 5) return { ok: false, why: "young" };
    return { ok: true, why: "" };
  }
  // Pure: what Settings, the road and the board page show for one child.
  function boardState(slot) {
    slot = _boardSlot(slot);
    const e = _loadFor(slot, BOARDKEY, {}), p = _boardPend(), a = boardAllowed(slot), on = !!(e.on && typeof e.token === "string" && e.token);
    return { on, nick: on && typeof e.nick === "string" ? e.nick : "", days: on ? Math.max(0, e.days | 0) : 0, joined: on ? String(e.joined || "") : "",
      pending: !!p, code: p ? String(p.code || "") : "", asked: !!p && p.slots.indexOf(slot) >= 0, gone: !on && !!e.gone, why: a.ok ? "" : a.why, leaving: _leaveList().length };
  }
  // The Settings sheet's question, "Did a speech therapist or a school send
  // you to Sona?": "clinic" or "no", kept on this phone only (a new phone
  // asks again). Called with no answer it only reads.
  function boardAsk(ans) {
    try {
      if (ans === "clinic" || ans === "no") localStorage.setItem(BOARDASKKEY, ans);
      const v = localStorage.getItem(BOARDASKKEY); return (v === "clinic" || v === "no") ? v : "";
    } catch (e) { return ""; }
  }

  // "Email me the link": up to four children the grown-up ticked, in order.
  // The phone sends their buddies, its time zone and the address, and keeps
  // only what the server hands back (a pending value and a short code). The
  // address is never stored here. "Send it again" is the same call: it adds
  // the pending value when the same children are asked for again.
  async function boardStart(email, slots) {
    if (!boardLive()) return { ok: false, error: "off" };
    const em = typeof email === "string" ? email.trim() : "";
    if (!em || em.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { ok: false, error: "email" };
    if (!Array.isArray(slots) || slots.length < 1 || slots.length > 4) return { ok: false, error: "kids" };
    const want = slots.map(String);
    if (want.some((s, i) => want.indexOf(s) !== i) || want.some((s) => !boardAllowed(s).ok)) return { ok: false, error: "kids" };
    const old = _boardPend(), body = { email: em, kids: want.map((s) => ({ buddy: _boardBuddy(s) })), tz: _tz() };
    if (old && old.slots.length === want.length && old.slots.every((s, i) => s === want[i])) body.pend = old.pend;
    const r = await _boardPost("start", body), j = r.j;
    if (r.status === 200 && j.ok && typeof j.pend === "string" && j.pend) {
      const code = String(j.code || "").slice(0, 8);
      // "confirmed": the grown-up already pressed the email's button, so the
      // server sent nothing and kept the request's own 48 hours; Finish is
      // all that is left (Settings runs it), and the clock is not reset
      const kept = !!(j.confirmed && old && old.pend === j.pend);
      save(BOARDPENDKEY, { pend: j.pend, at: kept ? old.at : Date.now(), slots: want, code });
      return kept ? { ok: true, code, confirmed: true } : { ok: true, code };
    }
    if (r.status === 400 && j.error === "email") return { ok: false, error: "email" };
    if (r.status === 429 || j.limit) return { ok: false, error: "limit" };
    if (r.status === 503 && (j.paused || j.resting)) return { ok: false, error: "resting" };
    if (r.status === 503 && j.off) return { ok: false, error: "off" };
    return { ok: false, error: "busy" };
  }
  // "Cancel" while waiting: this phone forgets the request. The server's
  // half holds nothing about a child and runs out by itself in 48 hours;
  // no child is put on the board without this phone's Finish.
  function boardCancel() { _boardPendDrop(); return true; }
  // "Finish": once the grown-up has pressed the email's button, one member
  // per ticked child, in order. Repeatable: a repeated answer changes nothing,
  // and a member this phone cannot place (the child is gone, no longer
  // allowed, or already on with another entry) is queued for deletion.
  async function boardClaim() {
    if (!boardLive()) return { ok: false, off: true };
    if (!load(BOARDPENDKEY, null)) return { ok: false, none: true };
    const p = _boardPend();
    if (!p) { _boardPendDrop(); return { ok: false, expired: true }; }
    const r = await _boardPost("claim", { pend: p.pend }), j = r.j;
    if (r.status === 202 || (r.status === 200 && j.waiting)) return { ok: false, waiting: true };
    if (r.status === 404 || r.status === 401 || j.expired) { _boardPendDrop(p.pend); return { ok: false, expired: true }; }
    if (r.status === 503 && j.paused) return { ok: false, resting: true };
    if (r.status === 503 && j.off) return { ok: false, off: true };
    if (!(r.status === 200 && j.ok && Array.isArray(j.members))) return { ok: false, busy: true };
    const now = load(BOARDPENDKEY, null), slots = (now && now.pend === p.pend && Array.isArray(now.slots)) ? now.slots : p.slots;
    const here = _kids().list.map((k) => k.slot || ""), got = [];
    let fresh = 0;
    j.members.forEach((m, i) => {
      if (!m || typeof m.token !== "string" || !m.token) return;
      // taken off since by the email's remove link: nothing to turn on
      if (typeof m.nick !== "string" || !m.nick) return;
      const slot = i < slots.length ? slots[i] : null;
      if (slot === null || here.indexOf(slot) < 0 || !boardAllowed(slot).ok) { _boardQueueLeave(m.token); return; }
      const e = _loadFor(slot, BOARDKEY, {});
      if (e.on && e.token) { if (e.token !== m.token) _boardQueueLeave(m.token); got.push({ slot, nick: String(e.nick || "") }); return; }
      saveFor(slot, BOARDKEY, { on: true, token: m.token, nick: m.nick.slice(0, 40), joined: _localDay(), q: [], qd: "", days: 0 });
      _boardClear(slot, BOARDCACHEKEY);
      fresh++; got.push({ slot, nick: m.nick.slice(0, 40) });
    });
    _boardPendDrop(p.pend);
    // today counts for the child using Sona now; a brother or sister's today
    // counts from their next rep
    try { _boardQueue(_slot()); } catch (e) {}
    try { await boardFlush(); } catch (e) {}
    if (fresh) track("board turned on");
    return { ok: true, members: got };
  }
  // A goal day for the child playing now: queued once a day, after the goal
  // stamp and at least BOARD_MIN_REPS reps, then sent. Only from _goalCheck
  // (every rep on a practice or game page) and boardClaim.
  function _boardQueue(slot) {
    if (slot !== _slot() || !boardLive()) return;
    const e = _loadFor(slot, BOARDKEY, {}), t = today();
    if (!e.on || !e.token || e.qd === t) return;
    if (!dayGoal().done || dayReps() < BOARD_MIN_REPS) return;
    e.qd = t; e.q = (Array.isArray(e.q) ? e.q : []).concat([{ at: Date.now() }]).slice(-3);
    saveFor(slot, BOARDKEY, e);
    try { const f = boardFlush(); if (f && f.catch) f.catch(() => {}); } catch (x) {}
  }
  // Every deletion still owed, sent whether or not the board is live. A
  // deletion goes when the server says it is done (or there is nothing to
  // delete); a rotated key (401) is retried for 30 days; a busy server or no
  // network keeps it for next time. throttle: at most once a minute (the
  // per-rep caller).
  let _leaveAt = 0, _leaveRun = null;
  function _boardSendLeaves(throttle) {
    if (!_leaveList().length) return Promise.resolve();
    if (_leaveRun) return throttle ? _leaveRun : _leaveRun.then(() => _boardSendLeaves(false));
    if (throttle && Date.now() - _leaveAt < 60000 && Date.now() >= _leaveAt) return Promise.resolve();
    _leaveAt = Date.now();
    _leaveRun = (async () => {
      const drop = [];
      for (const x of _leaveList()) {
        const r = await _boardPost("leave", { token: x.t });
        if ((r.status === 200 && r.j.deleted) || r.status === 404) drop.push(x.t);
        else if (r.status === 401 && Date.now() - (Number(x.at) || 0) > BOARD_LEAVE_GIVEUP) drop.push(x.t);
      }
      if (drop.length) save(BOARDLEAVEKEY, _leaveList().filter((x) => drop.indexOf(x.t) < 0));
    })().catch(() => {}).then(() => { _leaveRun = null; });
    return _leaveRun;
  }
  // Deletions first, live or not; then, only while the board is on, every
  // child on this phone (not only the one playing): a child no longer allowed
  // leaves, and each queued day goes out. Never from Home.
  async function _boardFlushOnce() {
    try { await _boardSendLeaves(false); } catch (e) {}
    if (!boardLive()) return;
    const slots = _kids().list.map((k) => k.slot || "");
    for (const slot of slots) {
      const e = _loadFor(slot, BOARDKEY, {});
      if (!e.on || typeof e.token !== "string" || !e.token) continue;
      if (!boardAllowed(slot).ok) { await boardLeave(slot); continue; }
      const q = Array.isArray(e.q) ? e.q : [];
      if (!q.length) continue;
      const done = [], buddy = _boardBuddy(slot);
      let days = null, gone = false;
      for (const item of q) {
        const at = Number(item && item.at) || 0;
        let ago = Math.round((Date.now() - at) / 1000);
        // older than two days (or a clock moved back): the server would refuse it, so it goes
        if (!(ago >= -300 && ago <= BOARD_AGO_MAX)) { done.push(at); continue; }
        ago = Math.max(0, ago);
        const r = await _boardPost("day", { token: e.token, ago, tz: _tz(), buddy });
        if (r.status === 200 && r.j.ok) { done.push(at); if (typeof r.j.days === "number") days = Math.max(0, r.j.days | 0); }
        else if (r.status === 404 && r.j.gone) { gone = true; break; }
        else if (r.status === 400) done.push(at);
        // 401 (a rotated key, never "gone"), 429, 503, 5xx, offline: kept for the next send
      }
      // written to the child the work started for, onto what is there NOW
      const cur = _loadFor(slot, BOARDKEY, {});
      if (cur.token !== e.token) continue;   // turned off meanwhile
      if (gone) { saveFor(slot, BOARDKEY, { on: false, gone: true }); _boardClear(slot, BOARDCACHEKEY); continue; }
      cur.q = (Array.isArray(cur.q) ? cur.q : []).filter((x) => done.indexOf(Number(x && x.at) || 0) < 0);
      if (days !== null) cur.days = days;
      saveFor(slot, BOARDKEY, cur);
    }
  }
  let _flushRun = null, _flushMore = false;
  function boardFlush() {
    if (_flushRun) { _flushMore = true; return _flushRun; }
    _flushRun = (async () => { do { _flushMore = false; await _boardFlushOnce(); } while (_flushMore); })().catch(() => {}).then(() => { _flushRun = null; });
    return _flushRun;
  }
  // The board page's one read, for the child playing now (or slot). Other
  // children's rows are the server's once-a-day snapshot; the child's own
  // days are live. A failure shows the last board from earlier today.
  function _boardRow(x) {
    const b = x && typeof x.buddy === "string" ? characterById(x.buddy).id : "fox";
    return { place: Math.max(1, x && x.place | 0), nick: String((x && x.nick) || "").slice(0, 40), buddy: b, days: Math.max(0, x && x.days | 0), me: !!(x && x.me) };
  }
  async function boardView(slot) {
    slot = _boardSlot(slot);
    if (!boardLive()) return { ok: false, off: true };
    const e = _loadFor(slot, BOARDKEY, {});
    if (!e.on || !e.token) return { ok: false, notOn: true, gone: !!e.gone };
    if (!boardAllowed(slot).ok) { await boardLeave(slot); return { ok: false, off: true }; }
    const mine = { nick: String(e.nick || ""), buddy: _boardBuddy(slot), days: Math.max(0, e.days | 0), place: null };
    const r = await _boardPost("view", { token: e.token }), j = r.j;
    if (r.status === 200 && j.ok) {
      const me = j.me && typeof j.me === "object" ? j.me : {};
      const view = { ok: true, month: String(j.month || "").slice(0, 7), quiet: !!j.quiet,
        top: (Array.isArray(j.top) ? j.top : []).slice(0, 20).map(_boardRow),
        more: (Array.isArray(j.more) ? j.more : []).slice(0, 10).map((x) => ({ place: Math.max(1, x && x.place | 0), n: Math.max(0, x && x.n | 0), days: Math.max(0, x && x.days | 0) })),
        me: { nick: String(me.nick || mine.nick).slice(0, 40), buddy: typeof me.buddy === "string" ? characterById(me.buddy).id : mine.buddy, days: Math.max(0, me.days | 0), place: (me.place | 0) > 0 ? me.place | 0 : null } };
      const cur = _loadFor(slot, BOARDKEY, {});
      if (cur.token !== e.token) return { ok: false, off: true };
      saveFor(slot, BOARDCACHEKEY, Object.assign({}, view, { at: Date.now() }));
      cur.days = view.me.days; if (view.me.nick) cur.nick = view.me.nick; saveFor(slot, BOARDKEY, cur);
      track("board viewed");
      return view;
    }
    if (r.status === 404 && j.gone) {
      if (_loadFor(slot, BOARDKEY, {}).token === e.token) { saveFor(slot, BOARDKEY, { on: false, gone: true }); _boardClear(slot, BOARDCACHEKEY); }
      return { ok: false, gone: true };
    }
    // resting: the days still count, so the child's own card shows what this phone knows
    if (r.status === 503 && j.paused) { track("board viewed"); return { ok: false, resting: true, me: mine }; }
    if (r.status === 503 && j.off) return { ok: false, off: true };
    const c = _loadFor(slot, BOARDCACHEKEY, null);
    if (c && c.ok && typeof c.at === "number" && c.at <= Date.now() && Date.now() - c.at < 864e5 && _localDay(c.at) === today()) {
      track("board viewed");
      return Object.assign({}, c, { stale: true });
    }
    return { ok: false, busy: true, me: mine };
  }
  // "New nickname": another made-up one from the server's lists, at most one
  // a day and three a month. Never typed.
  async function boardNick(slot) {
    slot = _boardSlot(slot);
    if (!boardLive()) return { off: true };
    const e = _loadFor(slot, BOARDKEY, {});
    if (!e.on || !e.token) return { off: true };
    const r = await _boardPost("nick", { token: e.token }), j = r.j;
    if (r.status === 200 && j.ok && typeof j.nick === "string" && j.nick) {
      const nick = j.nick.slice(0, 40), cur = _loadFor(slot, BOARDKEY, {});
      if (cur.token === e.token) {
        cur.nick = nick; saveFor(slot, BOARDKEY, cur);
        const c = _loadFor(slot, BOARDCACHEKEY, null);
        if (c && c.me) { c.me.nick = nick; (Array.isArray(c.top) ? c.top : []).forEach((x) => { if (x && x.me) x.nick = nick; }); saveFor(slot, BOARDCACHEKEY, c); }
      }
      return { nick };
    }
    if (r.status === 429 || j.limit) return { limit: true };
    if (r.status === 404 && j.gone) {
      if (_loadFor(slot, BOARDKEY, {}).token === e.token) { saveFor(slot, BOARDKEY, { on: false, gone: true }); _boardClear(slot, BOARDCACHEKEY); }
      return { gone: true };
    }
    if (r.status === 503 && j.paused) return { resting: true };
    return { busy: true };
  }
  // "Turn off" (and every other way a child leaves): (1) the deletion is
  // queued first, (2) this phone's keys go, slot "" included, (3) it is sent
  // now, live or not, (4) "board turned off". queued says it is still owed
  // (no network): the next practice, game, road or Settings page sends it.
  async function boardLeave(slot) {
    slot = _boardSlot(slot);
    const e = _boardDrop(slot), had = typeof e.token === "string" && !!e.token;
    try { await _boardSendLeaves(false); } catch (x) {}
    if (had) track("board turned off");
    return { ok: true, nick: had ? String(e.nick || "") : "", queued: had && _leaveList().some((x) => x.t === e.token) };
  }

  // ── BESTS1: "Beat Your Best" (Travis, 1-2 Oct 2026: "whatever you think is
  // best for kids you can do"). Each big-kid game counts ONE real thing the
  // child's FINGER did (fruit sliced in a row, notes in a row) and remembers
  // this child's own best: the win card adds one line and Home's picture
  // carries a small "Best 17". The rules it keeps, all of them on purpose:
  //   - It counts the finger, never the voice. Nothing here grades speech, so
  //     it is not practice data: outcomes(), sendProgress(), Progress and the
  //     clinician's note never read it (besttest pins that), and it mints no
  //     coins. It stays on the phone; like other play data it rides in a
  //     backup, which is a grown-up moving their own family's phone.
  //   - One record per CHILD (PER_KID), so no child ever sees another's best.
  //   - It only ever goes up. A lower round changes nothing; there is no way
  //     to lose a best by playing.
  //   - Whole numbers of real things only. A game's hidden number (a golden
  //     fruit is worth 3) was once shown as "Best" beside a count of fruit and
  //     did not match it; a caller passes the count the child can see.
  // gameBest(key) is the child's best (a whole number from 1) or 0 for a game
  // never played, and Home shows no tag for 0. gameBestOffer(key, n) stores n
  // when it beats the best and answers { best, prev, isNew }: prev is the
  // best before this round (0 = their first ever, which just sets it), isNew
  // is true when n went in, and best is never below a valid n, so a win card
  // can always say "Your best: {best}". An n that is not a whole number from
  // 1 is ignored (best = prev). Pages feature-detect both: a phone holding an
  // older sona.js must still play the game.
  const BESTKEY = "sona.bests.v1", BEST_MAX = 99999;
  function _bestN(n) { return typeof n === "number" && n >= 1 && n <= BEST_MAX && Math.floor(n) === n; }
  function _bests() { const all = load(BESTKEY, {}); return Array.isArray(all) ? {} : all; }
  function _bestOf(all, key) {
    const rec = Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null;
    return (rec && typeof rec === "object" && _bestN(rec.n)) ? rec.n : 0;
  }
  function gameBest(key) {
    try { key = gameKey(key); return key ? _bestOf(_bests(), key) : 0; } catch (e) { return 0; }
  }
  function gameBestOffer(key, n) {
    const out = { best: 0, prev: 0, isNew: false };
    try {
      key = gameKey(key); if (!key) return out;
      const all = _bests();
      out.prev = out.best = _bestOf(all, key);
      if (!_bestN(n) || n <= out.prev) return out;
      // answered before the write: a phone that cannot save (storage full or
      // off) still tells the child the truth about the round they just played
      out.best = n; out.isNew = true;
      all[key] = { n: n, at: today() };
      save(BESTKEY, all);
    } catch (e) {}
    return out;
  }

  // ── QUEST1: the daily adventure (Travis, 12-13 Oct 2026: "a new quest or
  // like daily activity that they complete every day. That is only showing up
  // for that day ... a 14-day rotation", then "go build the daily adventure").
  // One quest a day: a line from Echo and ONE round of one game. Finishing a
  // round of that game (its end card) finishes the day and gives a sticker
  // (two on days 7 and 14). What it keeps, on purpose:
  //   - It asks for nothing new. Practice happens inside the game exactly as
  //     it always does; the quest only picks the game and says why. No cue,
  //     no target, no count of anything said (cueing and targets are Rachel's).
  //   - A missed day loses nothing: the adventure waits on the day it is on.
  //     It moves on once, when a quest is finished, and never twice in one
  //     calendar day; tomorrow's quest is shown, dark, never playable early.
  //   - No coins: coins come from the chest and the Trophy Road only (COIN3).
  //     No timer, no countdown, nothing random (the sticker is the next one).
  //   - A family without Premium is never sent to a locked game: a quest whose
  //     game this phone cannot open gives its day to the next one in the list
  //     it can. With nothing open at all it stays as written, and the card's
  //     tap goes where any grey game's tap goes (the price, where Sona sells).
  //   - Home only reads questToday(). questEnd() is called by a game's end
  //     card and does nothing unless that game is today's open quest.
  // Ages 5-8 get the big-kid games; 3-4 get Feed Echo and Bubble Pop
  // (playStyle()). After day 14 it starts again at day 1.
  const QUESTKEY = "sona.quest.v1", QUEST_LEN = 14;
  const QUEST_DAYS = {
    arcade: [
      { game: "slice", line: "Echo is packing a picnic. Slice some fruit for the basket!" },
      { game: "tiles", line: "It's the meadow concert tonight. Play a song with Echo!" },
      { game: "stack", line: "The wind blew Echo's tower down. Help him build it back up!" },
      { game: "run", line: "Race Echo to the beach before the waves roll in!" },
      { game: "glide", line: "Take the balloon up high and look at the whole meadow!" },
      { game: "hoops", line: "It's game day! Shoot some hoops with Echo." },
      { game: "dino", line: "Something is buried by the cliff. Dig it up!" },
      { game: "soccer", line: "Can you kick the ball past Bo the bear?" },
      { game: "slice", line: "The fruit trees are full again. Slice a big feast!" },
      { game: "tiles", line: "Echo made up a new song. Play it with him!" },
      { game: "rise", line: "Toy blocks are falling! Keep the balloon safe all the way up to the stars." },
      { game: "stack", line: "Build a tower so tall it touches the clouds!" },
      { game: "glide", line: "Fly the balloon home over the hills!" },
      { game: "hoops", line: "The big final game! Shoot hoops with Echo." },
    ],
    simple: [
      { game: "feed", line: "Echo is hungry! Help him eat his lunch." },
      { game: "bubbles", line: "It's a bubble day! Pop Echo's bubbles." },
      { game: "feed", line: "Echo wants a snack. Can you feed him?" },
      { game: "bubbles", line: "The wind is full of bubbles. Pop them all!" },
      { game: "feed", line: "Echo's tummy is rumbling. Time for breakfast!" },
      { game: "bubbles", line: "Echo found his bubble wand. Pop, pop, pop!" },
      { game: "feed", line: "Echo is having a picnic. Feed him a treat!" },
      { game: "bubbles", line: "Big bubbles, little bubbles. Pop them with Echo!" },
      { game: "feed", line: "Echo played all day. Now he needs his dinner!" },
      { game: "bubbles", line: "The sky is full of bubbles. Can you pop them?" },
      { game: "feed", line: "Echo is very, very hungry. Help him eat!" },
      { game: "bubbles", line: "Echo blew the biggest bubbles ever. Pop them!" },
      { game: "feed", line: "It's Echo's party! Feed him some party food." },
      { game: "bubbles", line: "One more bubble day! Pop them all with Echo." },
    ],
  };
  // a day whose own game cannot open here borrows another game's day line
  const QUEST_LINE = {
    slice: "Echo needs fruit. Slice some for him!", tiles: "Play a song with Echo!",
    stack: "Help Echo build a tall tower!", run: "Race with Echo!",
    glide: "Fly the balloon with Echo!", hoops: "Shoot hoops with Echo!",
    soccer: "Kick the ball past Bo the bear!", dino: "Dig for dinosaur bones!",
    rise: "Keep the balloon safe from the falling blocks!",
    feed: "Echo is hungry! Help him eat.", bubbles: "Pop Echo's bubbles!",
  };
  function _questSt() {
    const v = load(QUESTKEY, {}) || {};
    let i = parseInt(v.i, 10); if (!(i >= 0 && i < QUEST_LEN)) i = 0;
    let last = parseInt(v.last, 10); if (!(last >= 0 && last < QUEST_LEN)) last = (i + QUEST_LEN - 1) % QUEST_LEN;
    return { i, last, done: typeof v.done === "string" ? v.done : "" };
  }
  // The quest on day index n, with its game resolved for THIS phone.
  function _questAt(list, n) {
    const open = (k) => { try { return !!(GAME_ACTS[k] && !GAME_ACTS[k].comingSoon && gameAccess(k).allowed); } catch (e) { return false; } };
    const own = list[n];
    if (open(own.game)) return { game: own.game, line: own.line };
    for (let j = 1; j < list.length; j++) {
      const q = list[(n + j) % list.length];
      if (open(q.game)) return { game: q.game, line: QUEST_LINE[q.game] || q.line };
    }
    return { game: own.game, line: own.line };
  }
  // Read only: what the adventure card shows today.
  //   state "open": today's quest, not finished yet (day = 1..14)
  //   state "done": today's was finished; next = tomorrow's, shown dark
  function questToday() {
    const list = QUEST_DAYS[playStyle()] || QUEST_DAYS.arcade, st = _questSt();
    const done = st.done === today();
    const n = done ? st.last : st.i, q = _questAt(list, n);
    const out = { state: done ? "done" : "open", day: n + 1, total: QUEST_LEN, game: q.game, line: q.line };
    if (done) { const t = _questAt(list, st.i); out.next = { day: st.i + 1, game: t.game }; }
    return out;
  }
  // A game's end card: finishes today's quest if this round was today's game.
  // Answers { day, stickers: [...] } once, or null.
  function questEnd(gameKey) {
    try {
      const q = questToday();
      if (q.state !== "open" || q.game !== gameKey) return null;
      const n = q.day - 1;
      save(QUESTKEY, { i: (n + 1) % QUEST_LEN, last: n, done: today() });
      const got = [];
      const one = awardNextSticker(); if (one) got.push(one);
      if (q.day === 7 || q.day === QUEST_LEN) { const two = awardNextSticker(); if (two) got.push(two); }
      track("adventure day done", { game: gameKey });
      _questBanner(q.day, got);
      return { day: q.day, stickers: got };
    } catch (e) { return null; }
  }
  // Silent, nonblocking, like the goal note: no audio, no focus change, no
  // tap taken. Below the goal note when both show.
  function _questBanner(day, got) {
    if (document.hidden) return;
    try {
      if (document.getElementById("sonaQuestBanner")) return;
      const b = document.createElement("div"); b.id = "sonaQuestBanner"; b.setAttribute("role", "status");
      const st = got && got.length ? " You got " + got.map((g) => g.e + " " + g.name).join(" and ") + "!" : "";
      b.textContent = "Day " + day + " adventure done!" + st;
      const low = document.getElementById("sonaGoalBanner") ? 70 : 12;
      b.style.cssText = "position:fixed;z-index:1200;top:calc(env(safe-area-inset-top,0px) + " + low + "px);left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);padding:12px 18px;border-radius:20px;background:#fff8e9;color:#4a2c14;box-shadow:0 4px 20px #4a2c1426;font:800 17px/1.35 'Nunito',sans-serif;text-align:center;pointer-events:none";
      document.body.appendChild(b); setTimeout(() => b.remove(), 5000);
    } catch (e) {}
  }

  // ── Native audio capture (iOS) ──────────────────────────────────────────────
  // ── SPEAK1: the one speech pipeline every reader shares ─────────────────
  // chapter.html and story.html each carried their own copy of the TTS path,
  // and both were missing the cure library.html already had. Two hangs, both
  // seen on a real phone as "I press Read it to me and nothing happens":
  //
  //   1. The /api/tts fetch had no timeout. One stalled request blocked the
  //      per-page say-queue forever and pinned its depth counter, after which
  //      every later say() — the button included — was dropped WITHOUT SOUND
  //      OR ERROR. library.html hit exactly this and was fixed with a 7s
  //      abort; the other two pages never got the fix. That is the drift
  //      CLAUDE.md warns about, so the pipeline now lives here, once.
  //
  //   2. playPCM resolved only from source.onended. On iOS an AudioContext
  //      born outside a tap starts "suspended" (and a lock-screen interruption
  //      re-suspends it): the source is scheduled, nothing plays, onended
  //      never fires, and the queue is wedged for the life of the page.
  //
  // Every unit here is BOUNDED: the fetch aborts at 7s, PCM refuses to start
  // on a context that will not run and falls back to the browser voice, a
  // started source carries a duration+1.5s watchdog, and the browser voice is
  // capped at 12s (1.2s when no voices are installed, where speak() never
  // fires). A bounded unit means the depth-2 queue can never wedge, so the
  // button always eventually speaks — and speakNow() does not even wait: a
  // tapped button supersedes whatever is playing, because a child who taps
  // "Read it to me" wants it read NOW, not after the backlog.
  const _spk = { ctx: null, q: Promise.resolve(), n: 0, src: null, gen: 0 };
  function _spkCtx() {
    if (!_spk.ctx) { const C = global.AudioContext || global.webkitAudioContext; _spk.ctx = new C(); }
    return _spk.ctx;
  }
  // Call from any user gesture: resumes the context and plays one silent
  // sample, which is what iOS needs before it will run audio at all.
  // At most ONE line waits for the first tap. Holding a backlog would mean a
  // child taps and then sits through instructions that have already scrolled
  // past; the newest line is the only one still true.
  let _spkPending = null;
  function _spkPark(text, opts) { _spkPending = { text: text, opts: opts }; }
  function _spkFlush() {
    const p = _spkPending; _spkPending = null;
    if (!p) return;
    try {
      const c = _spkCtx();
      if (c.state !== "running") return;          // still locked: let it go
      speak(p.text, Object.assign({}, p.opts, { auto: false }));
    } catch (e) {}
  }
  function speakUnlock() {
    try {
      const c = _spkCtx();
      if (c.state === "suspended") c.resume();
      const b = c.createBuffer(1, 1, 22050), s2 = c.createBufferSource();
      s2.buffer = b; s2.connect(c.destination); s2.start(0);
    } catch (e) {}
    // iOS speechSynthesis sticks in a paused state after interruptions and
    // then queues utterances forever; a gesture is the one place it un-sticks
    try { if (global.speechSynthesis && global.speechSynthesis.paused) global.speechSynthesis.resume(); } catch (e) {}
    // resume() settles a tick later, so give it one before deciding the
    // context is running and releasing whatever was waiting on this tap.
    try { setTimeout(_spkFlush, 60); } catch (e) {}
  }
  function _spkSynth(text, opts, gen) {
    return new Promise((res) => {
      try {
        if (gen !== _spk.gen) return res("superseded");
        const SS = global.speechSynthesis;
        if (!SS || !global.SpeechSynthesisUtterance) return res("no-synth");
        // clear the stuck-paused queue iOS accumulates, or nothing ever plays
        try { SS.cancel(); if (SS.paused) SS.resume(); } catch (e) {}
        const t = opts.synthTransform ? opts.synthTransform(String(text)) : String(text);
        const u = new global.SpeechSynthesisUtterance(t);
        u.rate = opts.rate || 0.95; u.pitch = 1.05;
        u.volume = (getProfile().volume != null ? getProfile().volume : 0.8);
        let done = false, timer = null;
        const fin = () => {
          if (done) return; done = true;
          if (timer) clearTimeout(timer);
          try { if (opts.hooks && opts.hooks.synthEnd) opts.hooks.synthEnd(); } catch (e) {}
          res("synth");
        };
        u.onend = fin; u.onerror = fin;
        // getVoices() may still be loading while speech already works. Its
        // empty list must not cut a valid sentence off after 1.2 seconds.
        // Release a stuck queue without cutting off longer, valid narration.
        timer = setTimeout(fin, 12000);
        voiceDiagnostic({ source: "browser", reason: opts.fallbackReason || "fallback" });
        try { if (opts.hooks && opts.hooks.synthStart) opts.hooks.synthStart(); } catch (e) {}
        SS.speak(u);
      } catch (e) { res("error"); }
    });
  }
  function _spkPCM(bytes, opts, gen) {
    return new Promise((res) => {
      try {
        if (gen !== _spk.gen) return res("superseded");
        const c = _spkCtx();
        const go = () => {
          try {
            if (gen !== _spk.gen) return res("superseded");
            // a context that will not run schedules audio that never plays and
            // an onended that never fires — refuse, and let synth carry it
            if (c.state !== "running") return res("blocked");
            const n = bytes.byteLength >> 1, ab = c.createBuffer(1, n, 24000), ch = ab.getChannelData(0);
            const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            for (let k = 0; k < n; k++) ch[k] = dv.getInt16(k * 2, true) / 32768;
            const src = c.createBufferSource();
            src.buffer = ab; src.playbackRate.value = VOICE_PITCH || 1;
            const g = c.createGain();
            g.gain.value = (getProfile().volume != null ? getProfile().volume : 0.8);
            src.connect(g); g.connect(c.destination);
            let done = false;
            const fin = () => { if (done) return; done = true; if (_spk.src === src) _spk.src = null; res("pcm"); };
            src.onended = fin;
            // the watchdog IS the fix: onended is not trusted to arrive
            setTimeout(() => { try { src.stop(); } catch (e) {} fin(); }, Math.ceil(ab.duration * 1000) + 1500);
            _spk.src = src;
            src.start();
            voiceDiagnostic(opts.voiceInfo || { source: "server" });
          } catch (e) { res("error"); }
        };
        if (c.state === "suspended") {
          // resume() outside a gesture may silently do nothing on iOS — give
          // it a beat, then either play or hand off to the browser voice
          let waited = false;
          const once = () => { if (waited) return; waited = true; go(); };
          try { c.resume().then(once, once); } catch (e) { once(); }
          setTimeout(once, 400);
        } else go();
      } catch (e) { res("error"); }
    });
  }
  function _spkOnce(text, opts, gen) {
    let ctrl = null, to = null;
    try { ctrl = new AbortController(); to = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 7000); } catch (e) {}
    return fetch("/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text), voice: getProfile().voiceId || "" }),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then((r) => {
        if (!r.ok) { opts.fallbackReason = "api-error"; voiceDiagnostic({ source: "unavailable", reason: "api-error", status: r.status }); return null; }
        opts.voiceInfo = { source: r.headers.get("X-Sona-Voice-Provider") || "server", model: r.headers.get("X-Sona-Voice-Model"),
          cache: r.headers.get("X-Sona-Voice-Cache"), revision: r.headers.get("X-Sona-Voice-Revision") };
        return r.arrayBuffer();
      })
      .then((bytes) => { if (to) clearTimeout(to); return bytes; })
      .then((b) => (b && b.byteLength) ? _spkPCM(new Uint8Array(b), opts, gen) : "no-audio")
      .catch((error) => { if (to) clearTimeout(to); opts.fallbackReason = error && error.name === "AbortError" ? "timeout" : "network-error"; return "fetch-failed"; })
      .then((how) => {
        // THE ROBOT VOICE IS A LAST RESORT, NOT A DEFAULT.
        //
        // "blocked" means the AudioContext will not run — which on a fresh page
        // load is not a failure at all, just a browser waiting for a tap. Every
        // page makes a NEW, locked context, so every line spoken automatically
        // on open (charge.html's "Ready? Say rrrr… Go!") was landing here and
        // falling straight through to speechSynthesis. /api/tts was answering
        // 200 the whole time: the good voice was fetched, then thrown away.
        //
        // So an AUTO-spoken line waits for the tap that is coming anyway, and
        // speaks in Echo's real voice when it arrives. A line the child ASKED
        // for ("Read it to me") still falls back, because there the choice is
        // robot-or-nothing and nothing is worse.
        if (how === "pcm" || how === "superseded") return how;
        if (how === "blocked" && opts.auto) { _spkPark(text, opts); return "parked"; }
        if (!opts.fallbackReason) opts.fallbackReason = how === "blocked" ? "playback-blocked" : "no-audio";
        return _spkSynth(text, opts, gen);
      });
  }
  // speak() is the AMBIENT path — a page reading itself aloud on open, a page
  // turn, a prompt at the top of a round. Nobody asked for it right now, so if
  // the audio context is still locked it waits for the tap instead of dropping
  // to the robot voice. speakNow() is the opposite and turns this off.
  function speak(text, opts) {
    opts = Object.assign({ auto: true }, opts || {});
    if (!text || getProfile().voiceOn === false) return Promise.resolve();
    if (_spk.n >= 2) return Promise.resolve();   // one playing + one waiting
    _spk.n++;
    const gen = _spk.gen;
    const run = () => _spkOnce(text, opts, gen);
    _spk.q = _spk.q.then(run, run).then(
      () => { _spk.n = Math.max(0, _spk.n - 1); },
      () => { _spk.n = Math.max(0, _spk.n - 1); },
    );
    return _spk.q;
  }
  // THE PLAN MOMENT — ask for money once the product has proved itself.
  //
  // Onboarding used to end at /subscribe.html: a parent off an ad saw a price
  // screen before their child had said one word, with the 3-day trial already
  // burning. That is the worst possible order — it asks a stranger to buy a
  // promise instead of showing them the thing working.
  //
  // So the ask moves to the first COMPLETED practice run: the child has said
  // their sound, filled the ticket, played the game and is looking at "You did
  // it!". That is the only moment Sona has actually demonstrated what it sells.
  //
  // This is an OFFER, not a wall. The 3-day trial still entitles them either
  // way — nothing here blocks a child mid-session, and it fires exactly once.
  // Families who never finish a run simply meet the normal trial gate later.
  const PLANSEEN = "sona.planmoment.v1";
  // ELIGIBILITY IS NOT AN IMPRESSION. These were one function, and that was a
  // bug: planMoment() consumed the one-shot and fired "plan moment shown" at
  // the moment of DECIDING, before anything was on screen. The offer lives
  // behind the grown-ups gate, so a parent who bounced off that gate — or a
  // navigation that simply failed — burned the only ask this family will ever
  // get, while the funnel recorded an impression that never happened. Both
  // halves wrong in the same breath: the family loses the offer, and the
  // number that was supposed to tell us whether the offer works is inflated.
  //
  // planEligible() answers "should we take them there" and CHANGES NOTHING.
  // planShown() is called by the paywall itself, once it has actually
  // rendered, and is the only thing that spends the one-shot.
  function planEligible() {
    try {
      if (isFree()) return false;                    // nothing to sell
      if (!isNativeApp() && !webSales()) return false;   // a browser that cannot sell has nothing to offer
      if (isNativeApp() && !iapAvailable()) return false;   // nor has an app build with no purchase plugin
      if (localStorage.getItem(PLANSEEN)) return false;
      // anyone who already has every game is never asked: subscribers,
      // founders, founding pilots, a covered clinician's families, and all
      // four grandfathered free eras (which include every device that
      // redeemed a clinician's link before 24 Sep 2026). premium() is the
      // one list — a second copy here is how the ask and the gate drifted.
      // What the offer sells is Premium, so a family on the free version
      // may see it once, after a finished run; practice is theirs either way.
      if (premium()) return false;
      return true;
    } catch (e) { return false; }
  }
  function planShown(surface) {
    try {
      if (localStorage.getItem(PLANSEEN)) return false;   // already counted
      localStorage.setItem(PLANSEEN, String(Date.now()));
      track("plan moment shown", { surface: surface || "first-run" });
      return true;
    } catch (e) { return false; }
  }
  // THE OFFER, ONCE, FROM HOME (Travis, 13 Oct 2026: "yeah, let's show the
  // offer again"). Some families' Home locked without them ever seeing the
  // free days: set up on the App Store's 1.0.4, which could not buy, so setup
  // skipped the price and opened the free games; stamped "post" by the
  // trial-first build, so the update to a build that can buy took the free
  // version away and every game greyed out with no offer on screen. The next
  // time such a family opens Home on a phone that can sell, the plan screen
  // opens once as the offer (/subscribe.html?from=home), the same screen a
  // grey-game tap opens, and its X leaves to Home exactly as that one does.
  //
  // Two keys, because one is not enough. PLANSEEN is spent only once a
  // PRICED card is painted (planShown), so a store that never answers would
  // leave it unspent and Home would open the offer again on every visit.
  // OFFERSEEN is spent by subscribe.html the moment the offer frame is up,
  // from any door (setup, a grey game, a first run, Home): what this phone
  // showed, never what the family bought. It is on NO_EXPORT and NO_IMPORT
  // like the free-version stamp; PLANSEEN still travels, so a pasted backup
  // can take the offer away but never add one.
  //
  // homeOfferDue() only reads: it writes nothing, sends nothing, grants
  // nothing and reads no address. trialFirst() is the whole "who owes the
  // price" rule (a phone that can sell, no free version, no Premium, no
  // trial, Sona not free); a clinician's own setup and a phone not yet set up
  // are never asked (the second is setup's job).
  //
  // AN ERROR CARD IS NOT THE ONE SHOWING. The offer frame goes up before the
  // store answers, so a store that is slow or unreachable would spend the
  // family's one showing on "We couldn't reach the App Store." with no price
  // on it. So subscribe.html calls offerSeen(true) only on a definite answer
  // (a priced card, which also spends PLANSEEN; "nothing to sell"; Premium
  // already there) and offerSeen(false) for a frame the store never priced:
  // that marks this visit (OFFERTAB, sessionStorage, so X back to Home cannot
  // loop) and counts the try ("try:N"). The next launch of the app tries
  // again, at most OFFER_TRIES times in all, so a store that is broken for
  // good never opens an error card on every launch.
  const OFFERSEEN = "sona.offerseen.v1", OFFERTAB = "sona.offerseen.tab", OFFER_TRIES = 3;
  function _offerTries(v) { const m = /^try:(\d+)$/.exec(v || ""); return m ? +m[1] : -1; }
  function _offerSpent(v) { if (!v) return false; const n = _offerTries(v); return n < 0 || n >= OFFER_TRIES; }
  function homeOfferDue() {
    try {
      if (!trialFirst()) return false;
      const list = _kids().list;
      if (!list.some((k) => { const p = _loadFor(k.slot || "", PKEY, {}); return !!(p.onboarded || p.childName); })) return false;
      if (list.some((k) => _loadFor(k.slot || "", PKEY, {}).role === "slp")) return false;
      if (localStorage.getItem(PLANSEEN)) return false;    // a priced card was already painted here
      if (_offerSpent(localStorage.getItem(OFFERSEEN))) return false;   // the offer was already shown here
      try { if (sessionStorage.getItem(OFFERTAB)) return false; } catch (e) {}   // tried this visit, the store never priced it
      return true;
    } catch (e) { return false; }
  }
  function offerSeen(final) {
    try {
      const v = localStorage.getItem(OFFERSEEN);
      if (_offerSpent(v)) return;
      if (final) { localStorage.setItem(OFFERSEEN, String(Date.now())); return; }
      try { if (sessionStorage.getItem(OFFERTAB)) return; sessionStorage.setItem(OFFERTAB, "1"); } catch (e) {}
      localStorage.setItem(OFFERSEEN, "try:" + (Math.max(0, _offerTries(v)) + 1));
    } catch (e) {}
  }
  // Kept so an older cached page cannot crash on a missing export. It is the
  // OLD, wrong shape — decide-and-consume — so it only answers eligibility and
  // never spends the one-shot; nothing in this repo calls it.
  function planMoment() { return planEligible(); }

  // ── the first game, straight from setup (Travis, 27 Sep 2026) ──
  // "upon completing the few steps inside the onboarding ... it will choose
  // feed echo for the littles and fruit slice for ages five and up ... it'll
  // literally go straight to the game". Setup marks which game is the first
  // (this tab only); that game's end card asks firstGameEnd() once where to go
  // next, and the answer is always Home.
  //
  // It used to be the plan screen while planEligible() said so. Travis played
  // it on 30 Sep 2026 and turned it round: "after they play their first game
  // after onboarding lets maybe have the second option be 'Go to Home' so the
  // top stays as play again but then when they see home they see the other
  // games they can play and that there are premium ones ... the flow was not
  // good". A child who has just won one game wants another go, not a price.
  // The offer now waits for the two moments a grown-up is actually there: the
  // end of the first full practice run (charge.html's "Show a grown-up"), and
  // a tap on a locked game.
  const FIRSTKEY = "sona.firstgame.v1";
  function firstGameKey() { return playStyle() === "simple" ? "feed" : "slice"; }
  function firstGameStart() {
    const key = firstGameKey();
    try { sessionStorage.setItem(FIRSTKEY, key); } catch (e) {}
    return (GAME_ACTS[key] && GAME_ACTS[key].go) || "/today.html";
  }
  function firstGameEnd(key) {
    let mine = false;
    try { mine = sessionStorage.getItem(FIRSTKEY) === gameKey(key); if (mine) sessionStorage.removeItem(FIRSTKEY); } catch (e) {}
    if (!mine) return null;
    return "/today.html";
  }

  // The crafted picture each game wears on Home's card, and on the plan
  // screen's hero (30 Sep 2026): the plan screen sells these games, so it
  // shows them, in the same art Home does. One map, read by both pages.
  const CRAFTED_CARDS = { slice: "fruit", tiles: "piano", stack: "stack", run: "run", glide: "glide", feed: "feed", hoops: "hoops", bubbles: "bubbles", peekaboo: "peekaboo", balloon: "balloon", flower: "flower", rocket: "rocket", snowman: "snowman", train: "train", puppy: "puppy", stars: "stars", cake: "cake", gifts: "gifts", fishtank: "fishtank", racecar: "racecar", treasure: "treasure", soccer: "soccer", robot: "robot", castle: "castle", dino: "dino", space: "space", pizza: "pizza", monster: "monster", rise: "rise" };


  // The button path: stop whatever is talking and say THIS, now.
  // The button path: a child ASKED to hear this, so it must make a sound now.
  // auto:false means a locked context falls back to the browser voice rather
  // than parking — robot-or-nothing, and nothing is worse.
  function speakNow(text, opts) {
    opts = Object.assign({}, opts || {}, { auto: false });
    _spk.gen++;                                   // strand every queued unit
    try { if (_spk.src) { _spk.src.stop(); _spk.src = null; } } catch (e) {}
    try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) {}
    _spk.q = Promise.resolve(); _spk.n = 0;       // the queue restarts clean
    return speak(text, opts);
  }

  // On the native iOS app (Capacitor) a custom `SonaAudio` plugin captures CLEAN
  // PCM via AVAudioSession `.measurement` mode (no auto-gain / noise-suppression
  // / high-pass) — preserving the high-frequency detail /s,sh,ch,th/ need. On the
  // web we fall back to MediaRecorder on the game's existing mic stream. Either
  // way captureClip() resolves to { blob, transcript, spoke } that the local
  // already accepts — so a game opts in with one line at the top of its recorder:
  //   if (Sona.hasNativeAudio()) return Sona.captureClip({ maxMs });
  function hasNativeAudio() {
    try { const C = global.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.SonaAudio); } catch (e) { return false; }
  }
  function _b64ToBlob(b64, type) {
    try { const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: type || "audio/wav" }); } catch (e) { return null; }
  }
  function captureClip(opts) {
    opts = opts || {};
    // web MediaRecorder on a provided MediaStream (opts.stream) — also the
    // fallback if native capture errors, so the child is never dead-ended.
    const webCapture = () => new Promise((resolve) => {
      const stream = opts.stream;
      if (!stream || typeof MediaRecorder === "undefined") { resolve({ blob: null, transcript: "", spoke: false }); return; }
      let rec; const chunks = [];
      try { rec = new MediaRecorder(stream); } catch (e) { resolve({ blob: null, transcript: "", spoke: false }); return; }
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => resolve({ blob: chunks.length ? new Blob(chunks, { type: (rec && rec.mimeType) || "audio/webm" }) : null, transcript: "", spoke: chunks.length > 0 });
      try { rec.start(); } catch (e) { resolve({ blob: null, transcript: "", spoke: false }); return; }
      setTimeout(() => { try { if (rec.state !== "inactive") rec.stop(); } catch (e) {} }, opts.maxMs || 6000);
    });
    if (hasNativeAudio()) {
      return global.Capacitor.Plugins.SonaAudio.record({ maxMs: opts.maxMs || 6000 })
        .then((r) => {
          const blob = (r && r.wav) ? _b64ToBlob(r.wav, "audio/wav") : null;
          if (blob) return { blob, transcript: "", spoke: !!(r && r.spoke), native: true };
          return webCapture(); // native gave us nothing usable — don't dead-end the kid
        })
        .catch(() => webCapture());
    }
    return webCapture();
  }

  // ── Apple in-app purchases (RevenueCat, native shell only) ───────────────
  // The App Store build sells Sona Premium through Apple's sheet via the
  // @revenuecat/purchases-capacitor plugin — reached over the same
  // remote-page bridge SonaAudio already uses. Web visitors never touch this
  // (Stripe stays the web rail). We purchase DIRECTLY by product id, read
  // RevenueCat's offerings only for whether the yearly row may show, and
  // unlock on the "full" entitlement. The appl_ key is publishable by design.
  // NO PRICE AND NO FREE-TRIAL LENGTH IS WRITTEN HERE, and that is the point:
  // both live in App Store Connect, and this comment went on naming a yearly
  // price and a trial length long after the store had changed both. The app
  // sells the monthly product (and since 19 Oct 2026 the yearly one beside
  // it, when RevenueCat's offering lists it); storePlan() / planWords() turn
  // the store's own answer into every figure and every "free" a parent reads.
  // ── FREE MODE ──────────────────────────────────────────────────────────
  // The switch, what "off" means since the free version shipped (24 Sep
  // 2026), and who keeps Premium regardless of it are all documented at
  // `const FREE_MODE` below, beside the four free-era sweeps. This used to
  // carry its own copy of that list, and it went stale the day the list
  // changed — one description, next to the code it describes.
  // Recorded human model clips. Rachel's July recordings live in /coach/say/
  // and never play whole: they are the source for the tests' child fixtures,
  // for tools/soundclips.mjs, which cuts the ONE take of each sound that
  // plays in its place (/coach/say-echo/<S>-sound.wav, her own voice since
  // 2 Oct 2026), and for tools/revoice.mjs, which ran her whole lines
  // through ElevenLabs speech-to-speech into Echo's voice (the rest of
  // /coach/say-echo/: the line practice plays when the voice service is
  // down, and parked Coach Call's demos). ON since 25 Sep 2026 (Travis: hear
  // the recorded sounds in the app). This MUST live here, not per-page:
  // charge.html once gated a local copy and coach-call.html went on playing
  // her raw voice ungated.
  // ── Backgrounding ──────────────────────────────────────────────────────
  // `pagehide` does NOT fire when a phone is locked or the user switches apps
  // on iOS — only `visibilitychange` does. Every page here holds a live mic
  // stream and/or running timers, and all of them listened to pagehide ALONE:
  // lock the phone mid-practice and the recording indicator stayed lit while
  // game timers kept advancing in your pocket. Register on BOTH, in one place,
  // so a page can't get this half-right (the same per-page-copy mistake that
  // kept Rachel's clips playing).
  function onBackground(fn) {
    if (typeof fn !== "function") return;
    const run = () => { try { fn(); } catch (e) {} };
    try { document.addEventListener("visibilitychange", () => { if (document.hidden) run(); }); } catch (e) {}
    try { global.addEventListener("pagehide", run); } catch (e) {}
  }

  // ── ART1: the sticker sheet ────────────────────────────────────────────
  // Every illustration in the kid app is one <g> in /assets/sona-stickers.svg,
  // referenced as <use href="#id">. <use> cannot cross a document boundary, so
  // the sheet has to be IN the page — the design handoff says to paste it into
  // every page for that reason. It is 82KB, and pasting it into twenty pages
  // ships it twenty times; fetching it once puts a single cached copy behind
  // all of them and keeps one source of truth on disk.
  //
  // A card must never be blank while that request is in flight, so stickerBox()
  // paints the flat FIELD colour immediately and the art lands on top when the
  // sheet arrives. Offline, on a failed fetch, or with JS half-loaded, the card
  // is a solid coloured tile with its label — not an empty grey box.
  const STICKER_FIELDS = { sky: "#cfe7f2", peach: "#ffe1c4", mint: "#d9efc9" };
  let _sheet = null;
  function stickerSheet() {
    if (_sheet) return _sheet;
    _sheet = fetch("/assets/sona-stickers.svg").then((r) => r.text()).then((t) => {
      try {
        if (document.getElementById("sona-sticker-sheet")) return true;
        const d = document.createElement("div");
        d.id = "sona-sticker-sheet";
        d.setAttribute("aria-hidden", "true");
        d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
        d.innerHTML = t;
        document.body.insertBefore(d, document.body.firstChild);
      } catch (e) {}
      return true;
    }).catch(() => false);
    return _sheet;
  }
  // One sticker, filling its box. preserveAspectRatio="slice" crops rather than
  // letterboxing, which is why every sticker keeps its subject inside y14-106.
  function stickerBox(id, field) {
    const bg = STICKER_FIELDS[field || "sky"] || STICKER_FIELDS.sky;
    return '<span class="stk" style="position:absolute;inset:0;overflow:hidden;border-radius:inherit;background:' + bg + ';">'
      + '<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" style="display:block;width:100%;height:100%">'
      + '<use href="#' + id + '"></use></svg></span>';
  }
  // Paint a sticker into an element, behind whatever labels it already carries.
  function paintSticker(el, id, field) {
    if (!el) return;
    try {
      const old = el.querySelector(":scope > .stk"); if (old) old.remove();
      el.insertAdjacentHTML("afterbegin", stickerBox(id, field));
      stickerSheet();
    } catch (e) {}
  }
  // Which sticker each activity wears. The design drew six scenes; Feed Echo is
  // the under-6 game it never covered, so it wears Echo himself on the mint
  // field rather than borrowing a scene that means something else.
  const GAME_STICKER = {
    slice: ["st-fruit", "sky"], run: ["st-sprint", "mint"], stack: ["st-blocks", "sky"],
    tiles: ["st-piano", "sky"], glide: ["st-balloon", "sky"], feed: ["p-echo-idle", "mint"],
    rise: ["st-balloon", "sky"],
    bubbles: ["st-bubbles", "sky"], peekaboo: ["st-peekaboo", "peach"],
    story: ["st-story", "peach"], chapter: ["st-story", "peach"],
  };
  // Each Say & Play game wears its own scene (sp-<key>, tools/gameart/cards.mjs).
  SAY_KEYS.forEach(function (key) { GAME_STICKER[key] = ["sp-" + key, "sky"]; });
  function gameSticker(key) { return GAME_STICKER[String(key || "").replace(/^arcade-|\.html$/g, "")] || GAME_STICKER.story; }

  // ── HEAR1: on-device speech recognition (native shell only) ────────────
  // The spectral check asks "did that have the shape of the sound"; it cannot
  // tell "poopoo" from an R, because both are low-centred and hiss-free. On
  // the iOS shell the SonaSpeech plugin runs Apple's recognizer with
  // requiresOnDeviceRecognition = true — audio never leaves the phone, and if
  // on-device recognition is unavailable the plugin REFUSES to start rather
  // than falling back to Apple's servers. Fail closed; the spectral check is
  // always the fallback, so web/Android behaviour is unchanged.
  //
  // The plugin returns raw transcripts only. The PASS/FAIL DECISION lives
  // here, on purpose: what counts as an attempt at a sound is clinical logic,
  // it is Rachel's to tune, and a rule that lives in the web layer can be
  // tuned without an App Store review.
  function speechPlugin() {
    try { const C = global.Capacitor; return (C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.SonaSpeech) ? C.Plugins.SonaSpeech : null; } catch (e) { return null; }
  }
  let _speechOk = null;
  function speechAvailable() {
    const P = speechPlugin(); if (!P) return Promise.resolve(false);
    if (_speechOk !== null) return Promise.resolve(_speechOk);
    return P.available().then((r) => {
      // available is only true when on-device AND authorized — a plugin build
      // that could reach a server never gets used, by construction
      _speechOk = !!(r && r.available && r.onDevice);
      return _speechOk;
    }).catch(() => { _speechOk = false; return false; });
  }
  function speechPerm() {
    const P = speechPlugin(); if (!P) return Promise.resolve(false);
    return P.requestPermission().then((r) => { _speechOk = null; return !!(r && r.granted); }).catch(() => false);
  }
  function speechStart(opts) {
    const P = speechPlugin(); if (!P) return Promise.resolve(false);
    return speechAvailable().then((okay) => {
      if (!okay) return false;
      // On Sona's own mic Apple listens on the page's stream (g) or not at
      // all: the plugin never opens the mic the old way behind a page that
      // owns it (call-quality AirPods). A page on the web mic names none.
      // Asked of the handle, not of micNative(): a fault elsewhere (a worklet
      // that failed to load) turns micNative() off while this stream carries
      // on natively, and a start naming no stream would close it. An ended
      // handle names its stream only while the page is still on Sona's mic,
      // so Apple refuses it (nostream) rather than opening the old way.
      const h = _nm.last, mine = h && !h.web && (h.state !== "ended" || micNative());
      const o = mine ? Object.assign({}, opts || {}, { g: h.g }) : (opts || {});
      return P.start(o).then(() => true).catch(() => false);
    });
  }
  function speechStop() {
    const P = speechPlugin(); if (!P) return Promise.resolve(null);
    return P.stop().then((r) => (r && r.onDevice ? r : null)).catch(() => null);
  }

  // ── SONA'S OWN MICROPHONE IN THE IPHONE APP (NATIVE MIC, Oct 2026) ────────
  // Travis: in the app, every listen made the phone act as if it were on a
  // call (volume buttons move call volume, AirPods drop to call quality, a
  // parent's music ducks). The cause is WebKit, not a setting: while a page
  // captures with getUserMedia, WebKit's own audio session is PlayAndRecord
  // with VideoChat mode and Apple's voice processing, and the app cannot
  // change it. So inside the app the mic is opened by Sona's native code
  // (SonaSpeechPlugin.swift: AVAudioEngine, .playAndRecord, mode .default, no
  // hands-free Bluetooth, no voice processing) and its samples are handed to
  // this page as events. Pages never see the difference: micOpen() answers a
  // stream-like handle with one track (stop, readyState, muted, getSettings),
  // micSource() answers an AudioNode fed by those samples, micRecorder() a
  // recorder for the keepsake clip. Every analyser, bar and timing on every
  // listening page is untouched.
  //
  // NEVER LESS ABLE THAN BEFORE. Any app build without the new native code
  // (every build in the App Store on 12 Oct 2026) declares no micOpen, so
  // Capacitor puts none on the plugin and micNative() is false: each page runs
  // the same getUserMedia line it always ran. A native failure that is not a
  // refusal falls back to that same getUserMedia, for the rest of the page.
  // NATIVE_MIC_ON = false is the off switch: a web deploy, no App Store review.
  //
  // NO AUDIO LEAVES THE PHONE. The samples move from Sona's native code into
  // this page on the same phone and nowhere else: nothing in this block
  // fetches, posts or opens a socket (mictest pins it), and the one clip a
  // day goes only to the IndexedDB saveRecording above.
  //
  // SILENCE IS NEVER A TRY. Nothing here makes a sample. A late or missing
  // chunk is exact zeros, which every listening page already reads as no
  // sound; the mic's own warm-up zeros are never passed on.
  const NATIVE_MIC_ON = true;
  // The boost on the page's copy of the mic. 1.0 = none. Changing it changes
  // which tries count as heard: Rachel's call, after Travis's phone numbers.
  const NATIVE_MIC_GAIN = 1.0;
  // Every knob the native mic takes is sent from here, so tuning it is a web
  // deploy. maxMs: the phone closes a stream nobody has re-confirmed in 5
  // minutes (a live page re-opens it at once). duck: turn other apps down
  // while listening. speaker: .defaultToSpeaker (the same bottom mic WebKit's
  // call mode used). ioMs 0: leave the phone's own buffer alone. frames: a
  // hint for the tap; iOS often hands over ~100 ms whatever is asked.
  // primeMs..: the page-side queue (see nmFifo). openMs: an open with the
  // permission already given that has not answered by then falls back.
  // firstMs: no real sound by then falls back. watchMs: a live stream that
  // goes quiet this long is re-opened. probeMs: how long a new feed has to
  // show it carries sound before the page uses the web mic instead.
  const NATIVE_MIC = { maxMs: 300000, duck: false, speaker: true, ioMs: 0, frames: 1024,
    primeMs: 120, primeMaxMs: 300, stepMs: 40, openMs: 4000, firstMs: 1500, watchMs: 2500,
    probeMs: 900, resumeMs: [250, 1000, 2000, 4000], pauseMaxMs: 60000, clipMaxMs: 25000, quietMaxMs: 300 };
  const _nmWeak = () => (typeof WeakMap === "function" ? new WeakMap() : null);
  const _nm = { subscribed: false, subscribing: null, broken: false, why: "", busy: 0, live: [], byG: {}, lastG: 0,
    pending: 0, stash: [], staleClosed: {}, of: _nmWeak(), mods: _nmWeak(), last: null, closing: 0, quiet: [],
    closeMaxMs: 0, opens: [], seq: 0, epoch: 0, leave: [] };

  // "sona.nativemic": "off" (this phone uses the web mic), or JSON knobs, set
  // only by hand in Safari's Web Inspector for Travis's measurements. It is on
  // NO_EXPORT and NO_IMPORT: a measurement setting never rides a backup onto
  // another family's phone, where it would change what counts as heard.
  function _nmTune() {
    let raw = null; try { raw = localStorage.getItem("sona.nativemic"); } catch (e) {}
    if (!raw) return {};
    if (raw === "off") return { off: true };
    try { const o = JSON.parse(raw); return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; }
  }
  function _nmNum(v, lo, hi, dflt) { const x = Number(v); return (v != null && isFinite(x)) ? Math.min(hi, Math.max(lo, x)) : dflt; }
  function micGain() { return _nmNum(_nmTune().gain, 0.25, 8, NATIVE_MIC_GAIN); }

  // True only inside an app build whose plugin declares the mic methods.
  // Old builds, a page in a browser, and every test stand-in for "the app"
  // (Capacitor = {}, Plugins: {}, a Sona.isNativeApp override) answer false.
  function micNative() {
    if (!NATIVE_MIC_ON || _nm.broken) return false;
    if (_nmTune().off) return false;
    const P = speechPlugin();
    return !!(P && typeof P.micOpen === "function" && typeof P.micClose === "function"
      && typeof P.micPermission === "function" && typeof P.addListener === "function");
  }

  // ── THE SILENT SWITCH ON SONA'S OWN MIC (15 Oct 2026) ──
  // Travis, asked "When the iPhone is on silent, what should Sona do?", picked
  // "Everything off": nothing plays on a silenced phone, Echo included, like
  // most iPhone games. In the app Echo's voice, the chimes, Piano Tiles' notes,
  // Bubble Pop's pops and Rachel's take are <audio> elements (mediaPCM and the
  // pages' own), and while an audible one plays WebKit puts the app's audio in
  // Playback, which ignores the switch (on Sona's own mic the Web Audio
  // sounds the games make themselves already followed it).
  // navigator.audioSession (WKWebView, iOS 16.4 and later) overrides WebKit's
  // choice for media elements and Web Audio alike. "transient-solo"
  // (SoloAmbient) follows the switch and still pauses other apps' music, as
  // Playback does today. Not "ambient": it mixes, so a parent's Spotify would
  // keep playing into the open mic.
  //
  // NOT EVERY SOUND IS WEBKIT'S: the browser's robot voice (speechSynthesis,
  // the fallback when Echo's line will not load) plays on the app's own
  // session, which SonaSpeechPlugin.swift's sessionOff() leaves after each
  // listen. It follows the switch only from the App Store build whose
  // sessionOff() leaves .ambient (15 Oct 2026); in an earlier build with
  // Sona's own mic it still plays on a silenced phone. This page change ships
  // with a web deploy; that one needs a new App Store build.
  //
  // THE PRICE OF IT: while the type is anything but "auto" (or
  // "play-and-record"), WebKit refuses getUserMedia (InvalidStateError). So it
  // is set only where WebKit never captures, on Sona's own mic, and given back
  // ("auto") before every capture WebKit makes, for the rest of that page:
  // every fallback in this block goes through _webMic, and _asGuard catches a
  // page's own getUserMedia line (its fallback, or a parked page that never
  // asks micNative()). And WebKit holds the override for the whole web
  // process, across same-site page loads, while each new page's getter starts
  // at "auto": so every page load in a build that could have set it writes its
  // own type, "auto" included (an earlier page's override, held after the
  // kill switch or "sona.nativemic" turned Sona's mic off, would otherwise
  // refuse this page's web mic). A browser and a build without micOpen are
  // never touched: nothing there ever sets it.
  //
  // TO TAKE IT OUT, set AUDIO_SESSION_TYPE to "auto": every load then writes
  // "auto", which also clears an override an open app still holds. Never
  // revert this block, or roll the website back past it, while an app build
  // with micOpen is in families' hands: code without it never writes "auto",
  // so WebKit refuses its own mic (every fallback, and every listen once
  // NATIVE_MIC_ON is false) until the app is closed and opened again.
  const AUDIO_SESSION_TYPE = "transient-solo";
  // type: what this page last wrote (null: untouched) · auto: this page gave
  // the session back for a web capture, for good · why: what asked it to
  const _as = { type: null, auto: false, why: "" };
  function _asApi() {
    try { const s = global.navigator && global.navigator.audioSession; return (s && typeof s === "object" && "type" in s) ? s : null; } catch (e) { return null; }
  }
  function _asWrite(type) {
    const s = _asApi(); if (!s) return false;
    try { s.type = type; _as.type = type; return true; } catch (e) { return false; }
  }
  // Every page load, and a page back from the back-forward cache (the page in
  // between may have changed the process's override).
  function _asApply() {
    if (!isNativeApp() || !_asApi()) return;
    const P = speechPlugin();
    if (!P || typeof P.micOpen !== "function") return;   // a build that never sets it
    if (!_as.auto && micNative()) { if (_asWrite(AUDIO_SESSION_TYPE)) _asGuard(); }
    else _asWrite("auto");
  }
  // Give the session back before WebKit captures: from here to the end of
  // this page. Writes only on a page that set it (a page that wrote "auto" at
  // load already has it back).
  function _asAuto(why) {
    if (_as.auto || !_as.type || _as.type === "auto") return;
    _as.auto = true; _as.why = String(why || "web mic");
    _asWrite("auto");
  }
  // WebKit's own mic, with the session given back first.
  function _webMic(constraints, why) {
    _asAuto(why);
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  // Any getUserMedia this page makes gives the session back first, in the
  // same turn, so WebKit's check sees "auto": a page's own fallback line runs
  // after micNative() has said no, and the parked pages (story, check, coach
  // call, Peekaboo) never ask it.
  function _asGuard() {
    try {
      const md = global.navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== "function" || md.getUserMedia.__sonaSession) return;
      const real = md.getUserMedia;
      const guard = function () { _asAuto("getUserMedia"); return real.apply(this || md, arguments); };
      guard.__sonaSession = true;
      md.getUserMedia = guard;
    } catch (e) {}
  }
  _asApply();
  try { global.addEventListener("pageshow", (e) => { if (e && e.persisted) _asApply(); }); } catch (e) {}

  function _nmErr(name, message) {
    try { return new DOMException(message || name, name); } catch (e) { const er = new Error(message || name); er.name = name; return er; }
  }
  function _nmFail(kind, code) { const e = new Error(code || kind); e.kind = kind; e.code = code || kind; return e; }
  // what a rejection means: "denied" (a refusal), "busy" (the phone said not
  // now), "temp" (the open ended for a reason that is not a fault),
  // "nolistener" (the page lost its subscription), anything else a fault
  function _nmKind(e) {
    const c = e && (e.kind || e.code);
    return (c === "denied" || c === "busy" || c === "temp" || c === "nolistener") ? c : "fail";
  }
  // a plugin call as a promise, even if the bridge throws while making it
  function _nmP(fn) { try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); } }
  function _nmTimed(p, ms) {
    return new Promise((resolve, reject) => {
      let done = false;
      const t = ms > 0 ? setTimeout(() => { if (!done) { done = true; reject(_nmFail("fail", "timeout")); } }, ms) : 0;
      Promise.resolve(p).then((v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
        (e) => { if (!done) { done = true; clearTimeout(t); reject(e); } });
    });
  }
  function _nmEmitter(o) {
    const L = {};
    o.addEventListener = function (t, fn) { if (typeof fn === "function") (L[t] = L[t] || []).push(fn); };
    o.removeEventListener = function (t, fn) { const a = L[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } };
    o.dispatchEvent = function (ev) {
      const on = o["on" + ev.type];
      try { if (typeof on === "function") on.call(o, ev); } catch (e) {}
      (L[ev.type] || []).slice().forEach((fn) => { try { fn.call(o, ev); } catch (e) {} });
      return true;
    };
    return o;
  }
  function _nmFire(o, type, extra) { o.dispatchEvent(Object.assign({ type: type, target: o, currentTarget: o }, extra || {})); }
  // One chunk: base64 of n little-endian Float32 samples (an iPhone and this
  // page are both little-endian), mono.
  function _nmDecode(b64, n) {
    if (typeof b64 !== "string" || !b64) return null;
    let bin; try { bin = atob(b64); } catch (e) { return null; }
    const len = bin.length - (bin.length % 4), u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
    const f = new Float32Array(u8.buffer);
    return (n > 0 && n < f.length) ? f.subarray(0, n) : f;
  }

  // ── the queue between the phone's chunks and the page's audio clock ──
  // Chunks arrive on the page's main thread in bursts (iOS often hands over
  // ~100 ms at a time); the audio clock wants 128 samples every 2.7 ms. This
  // queue sits between them. It starts holding real audio (the feeder is
  // made from the newest prime of what the mic has heard), plays out what it
  // holds, and on running dry writes exact zeros for the missing part only,
  // counts a gap, aims a step deeper (stepMs, up to maxPrimeMs) and resumes
  // only once it holds that aim again. Resuming at one step (the first cut)
  // left a busy phone's queue one step deep for good: with ~21 ms chunks a
  // little late it ran dry every few hundred ms, and a game card whose room
  // reading needs 450 ms without a gap never said "I'm listening…" (13 Oct
  // 2026, CI). After a burst (chunks held behind a long task, then delivered
  // together) it drops the oldest audio back to its aim, so the page never
  // stays late for good. A chunk at another rate is resampled on arrival
  // (4-point Hermite: under 0.6 dB down at 12 kHz, where linear lost ~1.8).
  // Exact zeros stay exact zeros, so the pages' starved-frame checks still
  // see a gap as a gap. Its source is copied, as text, into the worklet
  // below: keep it ES5 and free of anything outside itself.
  function nmFifo(o, outRate) {
    var smp = function (m) { return Math.round(m * outRate / 1000); };
    var ms = function (n) { return Math.round(n * 1000 / outRate); };
    var f = { q: [], qi: 0, depth: 0, target: smp(o.primeMs || 120), step: Math.max(1, smp(o.stepMs || 40)),
      most: smp(o.maxPrimeMs || 300), primed: false, gaps: 0, maxDepth: 0, avg: 0, ended: false, rs: null, rsRate: 0 };
    function resampler(inRate) {
      var step = inRate / outRate, p = 3, h0 = null, h1 = 0, h2 = 0;
      return function (x) {
        if (h0 === null) { h0 = h1 = h2 = x[0]; }
        var n = x.length, N = n + 3, out = new Float32Array(Math.ceil((N - p) / step) + 2), k = 0;
        var y = function (i) { return i === 0 ? h0 : i === 1 ? h1 : i === 2 ? h2 : x[i - 3]; };
        for (;;) {
          var i = Math.floor(p);
          if (i + 2 > N - 1) break;
          var t = p - i, xm1 = y(i - 1), x0 = y(i), x1 = y(i + 1), x2 = y(i + 2);
          var c1 = 0.5 * (x1 - xm1), c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2, c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
          out[k++] = ((c3 * t + c2) * t + c1) * t + x0;
          p += step;
        }
        p -= n; h0 = y(N - 3); h1 = y(N - 2); h2 = y(N - 1);
        return out.subarray(0, k);
      };
    }
    f.drop = function (k) {
      while (k > 0 && f.q.length) {
        var c = f.q[0], left = c.length - f.qi;
        if (left <= k) { f.q.shift(); f.qi = 0; f.depth -= left; k -= left; }
        else { f.qi += k; f.depth -= k; k = 0; }
      }
    };
    f.push = function (x, r) {
      if (!x || !x.length || f.ended) return;
      if (r && r !== outRate) { if (!f.rs || f.rsRate !== r) { f.rs = resampler(r); f.rsRate = r; } x = f.rs(x); }
      else { f.rs = null; f.rsRate = 0; }
      if (!x.length) return;
      f.q.push(x); f.depth += x.length;
      if (f.primed && f.depth > f.target + 2 * f.step) f.drop(f.depth - f.target);
      if (f.depth > f.maxDepth) f.maxDepth = f.depth;
    };
    f.ready = function () { f.primed = f.depth > 0; };
    f.read = function (out) {
      var n = out.length, w = 0, z;
      if (!f.primed) {
        if (f.depth >= f.target) f.primed = true;
        else { for (z = 0; z < n; z++) out[z] = 0; return; }
      }
      while (w < n && f.q.length) {
        var c = f.q[0], take = Math.min(n - w, c.length - f.qi);
        out.set(c.subarray(f.qi, f.qi + take), w);
        w += take; f.qi += take; f.depth -= take;
        if (f.qi >= c.length) { f.q.shift(); f.qi = 0; }
      }
      if (w < n) {
        for (z = w; z < n; z++) out[z] = 0;
        f.gaps++; f.primed = false; f.target = Math.min(f.most, f.target + f.step);
      }
      f.avg = f.avg ? f.avg * 0.99 + f.depth * 0.01 : f.depth;
    };
    f.stats = function () { return { gaps: f.gaps, queueMs: ms(f.avg), queueMaxMs: ms(f.maxDepth), targetMs: ms(f.target) }; };
    return f;
  }
  // The worklet: the queue above, run on the audio thread. It has no input
  // and is never connected to the speaker; the page's own analysers pull it.
  function _nmWorkletSource() {
    return "var nmFifo = " + nmFifo.toString() + ";\n" +
      "class SonaMicFeed extends AudioWorkletProcessor {\n" +
      "  constructor(options) {\n" +
      "    super();\n" +
      "    var o = (options && options.processorOptions) || {}, self = this;\n" +
      "    this.f = nmFifo(o, sampleRate); this.t = 0; this.g = 0;\n" +
      "    (o.prime || []).forEach(function (c) { self.f.push(c.pcm, c.r); });\n" +
      "    this.f.ready();\n" +
      "    this.port.onmessage = function (e) { var m = e.data || {}; if (m.end) self.f.ended = true; else if (m.pcm) self.f.push(m.pcm, m.r); };\n" +
      "  }\n" +
      "  process(inputs, outputs) {\n" +
      "    if (this.f.ended) return false;\n" +
      "    var ch = outputs[0] && outputs[0][0];\n" +
      "    if (ch) this.f.read(ch);\n" +
      "    if (this.f.gaps !== this.g || currentTime - this.t >= 0.5) { this.g = this.f.gaps; this.t = currentTime; this.port.postMessage(this.f.stats()); }\n" +
      "    return true;\n" +
      "  }\n" +
      "}\n" +
      "registerProcessor(\"sona-mic-feed\", SonaMicFeed);\n";
  }
  // once per audio context: the module, from a blob URL (no file to keep in step)
  function _nmModule(ctx) {
    let m = _nm.mods && _nm.mods.get(ctx);
    if (m) return m;
    m = { ok: false, p: null };
    let url = null;
    try { url = URL.createObjectURL(new Blob([_nmWorkletSource()], { type: "application/javascript" })); } catch (e) {}
    // a synchronous throw from addModule is a failed load, not a page error
    try { m.p = url ? Promise.resolve(ctx.audioWorklet.addModule(url)) : Promise.reject(_nmFail("fail", "blob")); } catch (e) { m.p = Promise.reject(e); }
    m.p.then(() => { m.ok = true; }, () => {}).then(() => { try { if (url) URL.revokeObjectURL(url); } catch (e) {} });
    if (_nm.mods) _nm.mods.set(ctx, m);
    return m;
  }

  // ── one feed per (stream, audio context) ──
  // Every micSource() on that context gets its own GainNode from it, so a
  // page's src.disconnect() drops only its own (charge.html makes one for its
  // room reading and one per listening window on the same stream).
  function _nmFeeder(ctx, h) {
    const f = { ctx, outs: [], node: null, sp: null, fifo: null, web: null, probe: null, probeT: 0, probing: false,
      ear: null, earBuf: null, earTried: false, ended: false, gaps: 0, queueMs: 0, queueMaxMs: 0 };
    const opts = () => ({ primeMs: h._primeMs(), stepMs: NATIVE_MIC.stepMs, maxPrimeMs: NATIVE_MIC.primeMaxMs });
    function wire(node) {
      f.outs.forEach((o) => { try { node.connect(o); } catch (e) {} });
      if (f.probe) { try { node.connect(f.probe); } catch (e) {} }
      if (f.ear) { try { node.connect(f.ear); } catch (e) {} }
    }
    function makeWorklet() {
      const o = opts(); o.prime = h._recent(o.primeMs);
      const node = new global.AudioWorkletNode(ctx, "sona-mic-feed", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: o });
      node.port.onmessage = (e) => {
        const s = e.data || {};
        if (typeof s.gaps === "number") f.gaps = s.gaps;
        if (typeof s.queueMs === "number") f.queueMs = s.queueMs;
        if (typeof s.queueMaxMs === "number" && s.queueMaxMs > f.queueMaxMs) f.queueMaxMs = s.queueMaxMs;
      };
      try { node.__sonaMic = true; } catch (e) {}
      return node;
    }
    // the stopgap while a context's first worklet module loads (the first
    // listen on a page), so a brand-new listen never starts on exact zeros
    // (the games' room floor only ever goes down)
    function makeSP() {
      const o = opts(), fifo = nmFifo(o, ctx.sampleRate);
      h._recent(o.primeMs).forEach((c) => fifo.push(c.pcm, c.r));
      fifo.ready();
      const sp = ctx.createScriptProcessor(512, 1, 1);
      sp.onaudioprocess = (e) => {
        const ch = e.outputBuffer.getChannelData(0);
        if (f.ended || f.fifo !== fifo) { ch.fill(0); return; }
        fifo.read(ch);
        const s = fifo.stats(); f.gaps = s.gaps; f.queueMs = s.queueMs; if (s.queueMaxMs > f.queueMaxMs) f.queueMaxMs = s.queueMaxMs;
      };
      try { sp.__sonaMic = true; } catch (e) {}
      f.fifo = fifo;
      return sp;
    }
    function dropSP() { if (f.sp) { try { f.sp.disconnect(); } catch (e) {} f.sp.onaudioprocess = null; f.sp = null; f.fifo = null; } }
    function dropNode() { if (f.node) { try { f.node.port.postMessage({ end: true }); } catch (e) {} try { f.node.disconnect(); } catch (e) {} f.node = null; } }
    f.push = function (pcm, r) {
      if (f.ended || f.web) return;
      if (f.node) { const c = pcm.slice(); try { f.node.port.postMessage({ pcm: c, r: r }, [c.buffer]); } catch (e) {} }
      else if (f.fifo) f.fifo.push(pcm, r);
    };
    f.add = function (out) {
      f.outs.push(out);
      const n = f.web || f.node || f.sp;
      if (n) { try { n.connect(out); } catch (e) {} }
      f.earStart();
      f.probeStart();
    };
    // THE FEED'S OWN EAR (micDeaf). Between the phone's samples (a pause, a
    // re-open, a chunk later than the queue is deep) the feed plays exact
    // zeros. A page's room floor only ever goes down, so a few frames of them
    // would set it to nothing for the rest of the page, and its bar would
    // drop to the minimum: a TV that never answered a card would answer it.
    // This analyser hears what the page's own analysers hear, at the same
    // moment, and says when the last frame held a gap: a run of exact zeros
    // (GAP_RUN, as practice's starved() reads it), which real audio, even a
    // mic's faintest hiss, never is. Made with the page's first source, so
    // it is full by the page's first frame.
    const GAP_RUN = 96;
    f.earStart = function () {
      if (f.earTried || f.web || typeof ctx.createAnalyser !== "function") return;
      f.earTried = true;
      try {
        const ear = ctx.createAnalyser();
        if (typeof ear.getFloatTimeDomainData !== "function") return;   // old WebKit: the handle's state alone
        ear.fftSize = 512; try { ear.__sonaMic = true; } catch (e) {}
        f.ear = ear; f.earBuf = new Float32Array(ear.fftSize);
        const n = f.node || f.sp; if (n) n.connect(ear);
      } catch (e) { f.ear = null; }
    };
    f.deaf = function () {
      if (f.ended) return true;
      if (f.web || !f.ear) return false;
      try {
        f.ear.getFloatTimeDomainData(f.earBuf);
        for (let i = 0, run = 0; i < f.earBuf.length; i++) { if (f.earBuf[i] !== 0) run = 0; else if (++run >= GAP_RUN) return true; }
      } catch (e) {}
      return false;
    };
    // The web mic took over (h._toWeb): the same out gains, a real source.
    f.toWeb = function (ws) {
      if (f.ended || f.web) return;
      try { f.web = f.ctx.createMediaStreamSource(ws); } catch (e) { f.web = null; return; }
      f.outs.forEach((o) => { try { f.web.connect(o); } catch (e) {} });
      dropNode(); dropSP();
      if (f.ear) { try { f.ear.disconnect(); } catch (e) {} f.ear = null; }
      try { if (f.ctx.state !== "running" && f.ctx.resume) Promise.resolve(f.ctx.resume()).catch(() => {}); } catch (e) {}
    };
    f.end = function () {
      if (f.ended) return;
      f.ended = true; clearTimeout(f.probeT);
      dropNode(); dropSP();
      if (f.web) { try { f.web.disconnect(); } catch (e) {} f.web = null; }
      if (f.probe) { try { f.probe.disconnect(); } catch (e) {} f.probe = null; }
      if (f.ear) { try { f.ear.disconnect(); } catch (e) {} f.ear = null; }
      f.outs = [];
    };
    // Nothing checks a graph by itself: if the feed carries nothing while the
    // phone's chunks arrive (a worklet that loads but stays silent on some
    // WebKit, a node nobody pulls, a context that never starts without a
    // capture), three reads in a row say so and the web mic takes over.
    f.probeStart = function () {
      if (f.probing || f.web || typeof ctx.createAnalyser !== "function") return;
      f.probing = true;
      let bad = 0;
      try { f.probe = ctx.createAnalyser(); f.probe.fftSize = 2048; try { f.probe.__sonaMic = true; } catch (e) {} const n = f.node || f.sp; if (n) n.connect(f.probe); } catch (e) { f.probe = null; }
      const check = () => {
        if (f.ended || f.web || !f.probe) return;
        if (h.state !== "live" || document.hidden || !h.firstAt || performance.now() - h.lastAt > 500) { f.probeT = setTimeout(check, NATIVE_MIC.probeMs / 3); return; }
        let silent = true;
        if (ctx.state === "running" && (f.node || f.sp)) {
          try {
            if (typeof f.probe.getFloatTimeDomainData !== "function") silent = false;
            else { const b = new Float32Array(f.probe.fftSize); f.probe.getFloatTimeDomainData(b); for (let i = 0; i < b.length; i++) if (b[i] !== 0) { silent = false; break; } }
          } catch (e) { silent = false; }
        }
        if (!silent) { try { f.probe.disconnect(); } catch (e) {} f.probe = null; return; }
        if (++bad >= 3) { h._toWeb(ctx.state === "running" ? "graph" : "context " + ctx.state); return; }
        f.probeT = setTimeout(check, NATIVE_MIC.probeMs / 3);
      };
      f.probeT = setTimeout(check, NATIVE_MIC.probeMs / 3);
    };
    if (h.web) { f.toWeb(h.web); return f; }
    const hasWorklet = !!(ctx.audioWorklet && typeof ctx.audioWorklet.addModule === "function" && typeof global.AudioWorkletNode === "function");
    const hasSP = typeof ctx.createScriptProcessor === "function";
    if (!hasWorklet && !hasSP) { _nm.broken = true; _nm.why = "no feed"; throw _nmErr("NotSupportedError", "this audio engine cannot take Sona's microphone"); }
    if (!hasWorklet) { f.sp = makeSP(); return f; }
    const mod = _nmModule(ctx);
    if (mod.ok) { f.node = makeWorklet(); return f; }
    if (hasSP) f.sp = makeSP();
    mod.p.then(() => {
      if (f.ended || f.web) return;
      let node; try { node = makeWorklet(); } catch (e) { _nm.broken = true; _nm.why = "worklet node"; return; }
      f.node = node; wire(node); dropSP();
    }, () => { _nm.broken = true; _nm.why = "worklet"; });   // this listen keeps the stopgap; the next open uses the web mic
    return f;
  }

  // ── the handle a page holds: a MediaStream to every line that reads one ──
  function _nmHandle(P, ans, constraints) {
    _nm.seq++;
    const track = _nmEmitter({ kind: "audio", id: "sona-mic-" + _nm.seq, label: "Sona microphone", enabled: true, muted: false,
      readyState: "live", contentHint: "", onended: null, onmute: null, onunmute: null });
    const stream = _nmEmitter({ id: "sona-stream-" + _nm.seq, active: true, sonaNative: true, onaddtrack: null, onremovetrack: null });
    const h = { P, constraints, stream, track, g: ans.g, rate: +ans.sampleRate > 0 ? +ans.sampleRate : 48000, route: ans.route || {},
      v: ans.v || 0, state: "opening", nativeLive: true, web: null, webAsking: false, feeders: [], recorders: [], hist: [], histMs: 0,
      lastQ: 0, firstAt: 0, lastAt: 0, openedAt: performance.now(), readyMs: null, leadZeroMs: 0, chunkMs: 0, chunks: 0,
      restarts: 0, pauses: 0, tries: 0, pausedAt: 0, resuming: false, unmute: false, resumeT: 0, watchT: 0, closeAckMs: null, why: "",
      _ready: null, _fail: null };
    stream.getTracks = () => [track];
    stream.getAudioTracks = () => [track];
    stream.getVideoTracks = () => [];
    stream.getTrackById = (id) => (id === track.id ? track : null);
    stream.addTrack = () => {}; stream.removeTrack = () => {};
    stream.clone = () => stream;
    // stop() is synchronous, as a real track's is: by the time it returns no
    // sample reaches this page's analysers or its clip, so a page stamps its
    // mic-closed moment exactly where it always did. The phone's own close
    // follows over the bridge (micQuiet() waits for it; the box shows it).
    track.stop = () => h._end("stopped", false);
    track.getConstraints = () => ({});
    track.getCapabilities = () => ({});
    track.applyConstraints = () => Promise.resolve();
    track.clone = () => track;
    track.getSettings = () => {
      if (h.web) {
        let s = {}; try { const wt = h.web.getAudioTracks()[0]; s = Object.assign({}, wt && wt.getSettings ? wt.getSettings() : {}); } catch (e) {}
        s.sonaNative = false; s.sonaWhy = h.why; return s;
      }
      const st = h._stats();
      // autoGainControl is left unset: iOS says nothing about what mode
      // .default does to the level, and the box shows "?" rather than guess
      return { deviceId: "sona-native", groupId: "", channelCount: 1, sampleRate: h.rate, sampleSize: 32,
        echoCancellation: false, noiseSuppression: false, autoGainControl: undefined,
        sonaNative: true, sonaMode: "default", sonaInput: h.route.input || "", sonaOutput: h.route.output || "", sonaGain: micGain(),
        sonaChunkMs: Math.round(h.chunkMs), sonaQueueMs: st.queueMs, sonaGaps: st.gaps, sonaRestarts: h.restarts,
        sonaLeadZeroMs: Math.round(h.leadZeroMs), sonaCloseMs: _nm.closeMaxMs || null };
    };
    h._primeMs = () => {
      const p = _nmNum(_nmTune().primeMs, 20, NATIVE_MIC.primeMaxMs, NATIVE_MIC.primeMs);
      return Math.min(NATIVE_MIC.primeMaxMs, Math.max(p, 1.5 * h.chunkMs + NATIVE_MIC.stepMs));
    };
    h._stats = () => {
      let gaps = 0, q = 0, qm = 0;
      h.feeders.forEach((f) => { gaps += f.gaps; if (f.queueMs > q) q = f.queueMs; if (f.queueMaxMs > qm) qm = f.queueMaxMs; });
      return { gaps, queueMs: q, queueMaxMs: qm };
    };
    // the newest `ms` of what the mic heard, to start a new feed full
    h._keep = (pcm, r) => {
      h.hist.push({ pcm, r }); h.histMs += pcm.length * 1000 / r;
      const keepMs = NATIVE_MIC.primeMaxMs + NATIVE_MIC.stepMs + h.chunkMs;
      while (h.hist.length > 1 && h.histMs - h.hist[0].pcm.length * 1000 / h.hist[0].r >= keepMs) { h.histMs -= h.hist[0].pcm.length * 1000 / h.hist[0].r; h.hist.shift(); }
    };
    h._recent = (ms) => {
      const out = []; let got = 0;
      for (let k = h.hist.length - 1; k >= 0 && got < ms; k--) {
        const c = h.hist[k], cms = c.pcm.length * 1000 / c.r;
        if (got + cms <= ms) { out.unshift({ pcm: c.pcm.slice(), r: c.r }); got += cms; }
        else { const keep = Math.max(1, Math.round((ms - got) * c.r / 1000)); out.unshift({ pcm: c.pcm.slice(c.pcm.length - keep), r: c.r }); got = ms; }
      }
      return out;
    };
    h._chunk = (m) => {
      if (h.state === "ended" || h.state === "paused" || h.web) return;
      const q = typeof m.q === "number" ? m.q : 0;
      if (q && q <= h.lastQ) return;        // twice: a page that subscribed again can be told once per listener
      if (q) h.lastQ = q;
      let pcm = _nmDecode(m.d, m.n);
      if (!pcm || !pcm.length) return;
      const r = +m.r > 0 ? +m.r : h.rate, now = performance.now(), ms = pcm.length * 1000 / r;
      h.rate = r; h.lastAt = now; h.chunks++; if (ms > h.chunkMs) h.chunkMs = ms;
      if (h.unmute) { h.unmute = false; track.muted = false; _nmFire(track, "unmute"); }   // back after a pause
      if (!h.firstAt) {
        // the mic's warm-up: exact zeros before its first sound are not passed on
        let i = 0; while (i < pcm.length && pcm[i] === 0) i++;
        if (i === pcm.length) { h.leadZeroMs += ms; h._watch(); return; }
        h.leadZeroMs += i * 1000 / r; h.firstAt = now; pcm = pcm.subarray(i);
      }
      h._keep(pcm, r);
      for (let k = 0; k < h.feeders.length; k++) h.feeders[k].push(pcm, r);
      for (let k = 0; k < h.recorders.length; k++) h.recorders[k]._push(pcm, r);
      if (h._ready && h.histMs >= h._primeMs()) h._ready();
      h._watch();
    };
    h._takeStash = () => {
      const mine = _nm.stash.filter((c) => c.g === h.g);
      _nm.stash = _nm.pending > 0 ? _nm.stash.filter((c) => c.g !== h.g && c.g > _nm.lastG) : [];
      mine.forEach(h._chunk);
    };
    h._route = (m) => {
      h.restarts++;
      if (m && m.route) h.route = m.route;
      if (m && +m.sampleRate > 0) h.rate = +m.sampleRate;
    };
    // the phone ended this open (micend)
    h._native = (reason) => {
      h.nativeLive = false; delete _nm.byG[h.g];
      if (h.state === "opening") { if (h._fail) h._fail(reason); return; }
      // a lost microphone on a page that still holds it is a pause, as
      // WebKit's own capture pauses for a call and picks up after it: the
      // round games never look at an ended track, and a card would otherwise
      // say "I'm listening…" to nobody for the rest of the visit
      if (reason === "interrupted" || reason === "route" || reason === "stalled" || reason === "reset" || reason === "timeout") h._pause(reason);
      else h._end(reason, true);
    };
    h._pause = (reason) => {
      if (h.state !== "live") return;
      h.state = "paused"; h.pausedAt = performance.now(); h.pauses++; h.why = reason; h.tries = 0; h.relisted = false;
      clearTimeout(h.watchT);
      if (h.nativeLive) { h.nativeLive = false; delete _nm.byG[h.g]; _nmClose(h); }
      // a re-open that went quiet before its first chunk is still muted
      h.unmute = false; if (!track.muted) { track.muted = true; _nmFire(track, "mute"); }
      // the 5-minute cap re-opens at once; an interruption waits for iOS's
      // "you may record again" (micready) or tries every few seconds
      h._later(reason === "timeout" ? 0 : reason === "interrupted" ? 4000 : NATIVE_MIC.resumeMs[0]);
    };
    h._later = (ms) => { clearTimeout(h.resumeT); h.resumeT = setTimeout(h._resume, ms); };
    h._resume = () => {
      // the web mic taking this handle over (h._toWeb) leaves it "paused"
      // until getUserMedia answers: a micready or a return to the page in
      // that moment must not open Sona's mic beside it
      if (h.state !== "paused" || h.resuming || h.webAsking || h.web) return;
      if (performance.now() - h.pausedAt > NATIVE_MIC.pauseMaxMs) { h._end("lost", true); return; }
      if (document.hidden) { h._later(1000); return; }
      h.resuming = true; h.tries++;
      _nmAsk(h.P).then((ans) => {
        h.resuming = false;
        // the page let go, or the web mic took over, while the phone was asked
        if (h.state !== "paused" || h.webAsking || h.web) { _nmStale(ans.g); return; }
        h.g = ans.g; h.lastQ = 0; h.nativeLive = true; h.restarts++;
        if (ans.route) h.route = ans.route;
        if (+ans.sampleRate > 0) h.rate = +ans.sampleRate;
        // unmuted by the first chunk (h._chunk), not here: until one lands
        // the feed is still re-priming on exact zeros, and a page that reads
        // the track hears a mic that is not hearing yet
        _nm.byG[h.g] = h; h.state = "live"; h.unmute = true; h._takeStash();
        h._watch();
      }, (e) => {
        h.resuming = false;
        if (h.state !== "paused" || h.webAsking || h.web) return;
        const k = _nmKind(e);
        if (k === "denied") { h._end("denied", true); return; }
        if (k === "fail") { h._toWeb("reopen " + ((e && e.code) || "failed")); return; }
        if (k === "nolistener") {
          // subscribing again is the cure, not waiting: at once, once a pause
          _nm.subscribed = false;
          if (!h.relisted) { h.relisted = true; h._later(0); return; }
        }
        h._later(NATIVE_MIC.resumeMs[Math.min(h.tries, NATIVE_MIC.resumeMs.length - 1)]);
      });
    };
    // No chunk for watchMs on a visible page: the phone stopped without a
    // word that reached us (a navigation that never happened takes the
    // page's listeners). Yield once first: a timer can run ahead of chunks
    // queued behind the same long task.
    h._watch = () => {
      clearTimeout(h.watchT);
      if (h.state !== "live" || h.web) return;
      h.watchT = setTimeout(() => {
        if (h.state !== "live" || h.web) return;
        if (document.hidden) { h._watch(); return; }
        const seen = h.lastAt;
        setTimeout(() => {
          if (h.state !== "live" || h.web) return;
          if (h.lastAt !== seen || document.hidden) { h._watch(); return; }
          // not a reason to subscribe again: Capacitor keeps every listener
          // it was given, so a second set has each chunk sent once per set.
          // If the listeners really went, the phone answers the re-open
          // "nolistener" and that subscribes again (h._resume).
          h._pause("silent");
        }, 80);
      }, NATIVE_MIC.watchMs);
    };
    // The web mic takes this handle over, for the rest of this page: the page
    // keeps its stream, its nodes and its recorder, and hears the child the
    // way it always did (the phone-call mode included).
    h._toWeb = (why) => {
      if (h.state === "ended" || h.web || h.webAsking) return;
      _nm.broken = true; _nm.why = why; if (_nm.last === h) _nm.last = null;
      h.why = why; h.webAsking = true; h.unmute = false; clearTimeout(h.watchT); clearTimeout(h.resumeT);
      if (h.nativeLive) { h.nativeLive = false; delete _nm.byG[h.g]; _nmClose(h); }   // never both mics at once
      let ask; try { ask = _webMic(h.constraints || { audio: true }, why); } catch (e) { ask = Promise.reject(e); }
      Promise.resolve(ask).then((ws) => {
        h.webAsking = false;
        if (h.state === "ended") { try { ws.getTracks().forEach((t) => t.stop()); } catch (e) {} return; }
        h.web = ws; h.state = "live";
        h.feeders.forEach((f) => f.toWeb(ws));
        if (track.muted) { track.muted = false; _nmFire(track, "unmute"); }
        try {
          const wt = ws.getAudioTracks()[0];
          if (wt) {
            wt.addEventListener("ended", () => h._end("ended", true));
            wt.addEventListener("mute", () => { track.muted = true; _nmFire(track, "mute"); });
            wt.addEventListener("unmute", () => { track.muted = false; _nmFire(track, "unmute"); });
          }
        } catch (e) {}
      }, () => { h.webAsking = false; h._end("lost", true); });
    };
    h._end = (reason, fire) => {
      if (h.state === "ended") return;
      const opening = h.state === "opening";
      h.state = "ended"; if (!h.why) h.why = reason;
      track.readyState = "ended"; stream.active = false;
      clearTimeout(h.watchT); clearTimeout(h.resumeT);
      if (h.nativeLive) { h.nativeLive = false; delete _nm.byG[h.g]; _nmClose(h); }
      if (h.web) { try { h.web.getTracks().forEach((t) => t.stop()); } catch (e) {} }
      if (!opening) _nmOpened(h);
      h.feeders.splice(0).forEach((f) => f.end());
      h.recorders.slice().forEach((rc) => rc._end());
      _nm.live = _nm.live.filter((x) => x !== h);
      // a real track's stop() fires no "ended"; the phone ending it does
      if (fire) { if (reason === "interrupted") track.muted = true; _nmFire(track, "ended"); }
      // an open ended before it was handed over (pagehide) settles at once:
      // left to its clocks it would read as a fault on a page restored from
      // the back-forward cache, and put that page on the web mic for good
      if (opening && h._fail) h._fail(reason);
    };
    h.source = (ctx) => {
      if (h.state === "ended") throw _nmErr("InvalidStateError", "the microphone has stopped");
      if (!ctx || typeof ctx.createGain !== "function") throw _nmErr("NotSupportedError", "no audio context");
      let f = null;
      for (let k = 0; k < h.feeders.length; k++) if (h.feeders[k].ctx === ctx) f = h.feeders[k];
      if (!f) { f = _nmFeeder(ctx, h); h.feeders.push(f); }
      const out = ctx.createGain();
      // left untouched at 1: some test audits read every gain they see as a sound
      const gain = micGain(); if (gain !== 1) out.gain.value = gain;
      try { out.__sonaMic = true; out.mediaStream = stream; } catch (e) {}
      f.add(out);
      return out;
    };
    if (_nm.of) _nm.of.set(stream, h);
    return h;
  }

  // ── the bridge: events from the phone ──
  function _nmStale(g) {
    if (typeof g !== "number" || _nm.staleClosed[g]) return;
    _nm.staleClosed[g] = 1;
    const P = speechPlugin();
    if (P) _nmP(() => P.micClose({ g: g })).catch(() => {});
  }
  function _nmChunk(m) {
    if (!m || typeof m.g !== "number") return;
    const h = _nm.byG[m.g];
    if (h) { h._chunk(m); return; }
    // an open still waiting for its answer: its first chunks can beat it here
    if (_nm.pending > 0 && m.g > _nm.lastG) { if (_nm.stash.length < 12) _nm.stash.push(m); return; }
    _nmStale(m.g);   // an open nobody holds: closed, once
  }
  function _nmEnded(m) { const h = m && _nm.byG[m.g]; if (h) h._native(String(m.reason || "closed")); }
  function _nmRouted(m) { const h = m && _nm.byG[m.g]; if (h) h._route(m); }
  function _nmReady() { _nm.live.forEach((h) => { if (h.state === "paused") h._resume(); }); }
  // Subscribe once a page: first close whatever the last page left (and any
  // Apple check it was running), so nothing is delivered while the listeners
  // are being added (Capacitor adds them on another thread than it delivers).
  function _nmSubscribe(P) {
    if (_nm.subscribed) return Promise.resolve();
    if (_nm.subscribing) return _nm.subscribing;
    // Debug builds log every bridge event in full, and copy each log back to
    // the phone. At ten audio chunks a second that is the phone's busiest
    // work while Travis measures it. This flag only changes that logging.
    try { if (global.Capacitor) global.Capacitor.isLoggingEnabled = false; } catch (e) {}
    const p = _nmTimed(_nmP(() => P.micClose({ all: true })), NATIVE_MIC.openMs).catch(() => null).then(() => {
      P.addListener("micpcm", _nmChunk);
      P.addListener("micend", _nmEnded);
      P.addListener("microute", _nmRouted);
      P.addListener("micready", _nmReady);
      _nm.subscribed = true;
    });
    _nm.subscribing = p;
    const clear = () => { if (_nm.subscribing === p) _nm.subscribing = null; };
    p.then(clear, clear);
    return p;
  }
  // One native open: answers the phone's {g, sampleRate, route, v}.
  // An ask the page leaves in the middle of (pagehide) ends at once as
  // "temp", not a fault: if the page comes back from the back-forward cache,
  // the phone's answer went to another document and would never arrive, and
  // the clock running out would put this page on the web mic for good. An
  // answer that does still come is closed (_nmStale).
  function _nmAsk(P) {
    const ep = _nm.epoch;
    return new Promise((resolve, reject) => {
      let out = false;
      const leave = () => { if (!out) { out = true; reject(_nmFail("temp", "pagehide")); } };
      const off = () => { _nm.leave = _nm.leave.filter((x) => x !== leave); };
      _nm.leave.push(leave);
      _nmAskOnce(P, ep).then((ans) => {
        off();
        if (out || _nm.epoch !== ep) { _nmStale(ans.g); leave(); return; }
        out = true; resolve(ans);
      }, (e) => {
        off();
        if (out) return;
        out = true; reject(_nm.epoch !== ep && _nmKind(e) !== "denied" ? _nmFail("temp", "pagehide") : e);
      });
    });
  }
  function _nmAskOnce(P, ep) {
    return _nmSubscribe(P).then(() => _nmTimed(_nmP(() => P.micPermission({})), NATIVE_MIC.openMs)).then((perm) => {
      const state = perm && perm.state;
      if (state === "denied") throw _nmFail("denied");
      if (_nm.epoch !== ep) throw _nmFail("temp", "pagehide");   // the page left while asked: open nothing
      const t = _nmTune();
      const opts = {
        maxMs: Math.round(_nmNum(t.maxMs, 1000, 600000, NATIVE_MIC.maxMs)),
        duck: t.duck != null ? !!t.duck : NATIVE_MIC.duck,
        speaker: t.speaker != null ? !!t.speaker : NATIVE_MIC.speaker,
        ioMs: Math.round(_nmNum(t.ioMs, 0, 100, NATIVE_MIC.ioMs)),
        frames: Math.round(_nmNum(t.frames, 256, 8192, NATIVE_MIC.frames)),
      };
      _nm.pending++;
      return new Promise((resolve, reject) => {
        let settled = false, clock = 0;
        // the page leaving also settles this open, so nothing stays pending
        const gone = () => { if (finish()) reject(_nmFail("temp", "pagehide")); };
        const finish = () => {
          if (settled) return false;
          settled = true; _nm.pending = Math.max(0, _nm.pending - 1); clearTimeout(clock);
          _nm.leave = _nm.leave.filter((x) => x !== gone);
          return true;
        };
        _nm.leave.push(gone);
        // a grown-up reading iOS's own dialog has no clock; an open that should be quick does
        if (state === "granted") clock = setTimeout(() => { if (finish()) reject(_nmFail("fail", "timeout")); }, NATIVE_MIC.openMs);
        _nmP(() => P.micOpen(opts)).then((ans) => {
          const g = ans && typeof ans.g === "number" ? ans.g : null;
          if (g != null && g > _nm.lastG) _nm.lastG = g;
          if (!finish()) { _nmStale(g); return; }   // answered after the page gave up: closed at once
          if (g == null) { reject(_nmFail("fail", "no stream")); return; }
          resolve(ans);
        }, (e) => { if (finish()) reject(e); });
      });
    });
  }
  function _nmOpened(h) {
    _nm.opens.push(_nmStatOf(h));
    while (_nm.opens.length > 10) _nm.opens.shift();
  }
  function _nmStatOf(h) {
    const st = h._stats();
    return { g: h.g, state: h.state, web: !!h.web, why: h.why, openMs: h.readyMs, leadZeroMs: Math.round(h.leadZeroMs),
      chunkMs: Math.round(h.chunkMs), primeMs: Math.round(h._primeMs()), gaps: st.gaps, queueMs: st.queueMs, queueMaxMs: st.queueMaxMs,
      restarts: h.restarts, pauses: h.pauses, closeMs: h.closeAckMs };
  }
  // Bind an answered open to a new handle; resolve once the feed can start
  // full (primeMs of real sound after the first non-zero sample).
  function _nmBind(P, ans, constraints) {
    const h = _nmHandle(P, ans, constraints);
    _nm.byG[h.g] = h; _nm.live.push(h);
    return new Promise((resolve, reject) => {
      let done = false;
      const first = setTimeout(() => { if (!h.firstAt) fail("silent"); }, NATIVE_MIC.firstMs);
      const most = setTimeout(() => { if (h.firstAt) ok(); }, NATIVE_MIC.firstMs + NATIVE_MIC.primeMaxMs);
      function ok() {
        if (done) return; done = true; clearTimeout(first); clearTimeout(most); h._ready = h._fail = null;
        h.state = "live"; h.readyMs = Math.round(performance.now() - h.openedAt); _nm.last = h; h._watch();
        resolve(h.stream);
      }
      function fail(reason) {
        if (done) return; done = true; clearTimeout(first); clearTimeout(most); h._ready = h._fail = null;
        h._end(reason, false);
        // ended by a call, the background, another open or the page leaving: not a fault
        const temp = reason === "interrupted" || reason === "background" || reason === "replaced" || reason === "closed"
          || reason === "pagehide" || reason === "stopped";
        reject(_nmFail(temp ? "temp" : "fail", reason));
      }
      h._ready = ok; h._fail = fail;
      h._takeStash();
    });
  }
  function _nmClose(h) {
    const P = h.P, t0 = performance.now();
    _nm.closing++;
    _nmTimed(_nmP(() => P.micClose({ g: h.g })), 1000).catch(() => null).then(() => {
      const ms = Math.round(performance.now() - t0);
      h.closeAckMs = ms; if (ms > _nm.closeMaxMs) _nm.closeMaxMs = ms;
      _nm.opens.forEach((x) => { if (x.g === h.g && x.closeMs == null) x.closeMs = ms; });
      _nm.closing = Math.max(0, _nm.closing - 1);
      if (!_nm.closing) _nm.quiet.splice(0).forEach((fn) => fn());
    });
  }

  // ── what pages call ──
  // micOpen(constraints): the stream. Refused: NotAllowedError, never the
  // web mic. "Not now" from the phone: the web mic, this once. A call or the
  // background ending it while it opens: NotReadableError, the temporary
  // path every page already has. Anything else: the web mic for the page.
  function micOpen(constraints) {
    const P = speechPlugin();
    if (!P || !micNative()) { _nm.last = null; return _webMic(constraints, "web mic"); }
    return _nmP(() => _nmOpenNative(P, constraints, false));
  }
  function _nmOpenNative(P, constraints, retried) {
    return _nmAsk(P).then((ans) => _nmBind(P, ans, constraints)).catch((e) => {
      const k = _nmKind(e);
      if (k === "denied") throw _nmErr("NotAllowedError", "microphone not allowed");
      if (k === "nolistener" && !retried) { _nm.subscribed = false; return _nmOpenNative(P, constraints, true); }
      if (k === "temp") throw _nmErr("NotReadableError", "the microphone was interrupted");
      _nm.last = null;
      if (k === "busy") { _nm.busy++; return _webMic(constraints, "busy"); }
      _nm.broken = true; _nm.why = String((e && (e.code || e.message)) || k);
      return _webMic(constraints, _nm.why);
    });
  }
  // micProbe(constraints): the permission alone, for the pages that only ask
  // (setup, the primers). No mic opens, no orange dot. A refusal is
  // NotAllowedError; anything unclear asks the way it always did.
  function micProbe(constraints) {
    const P = speechPlugin();
    const web = () => _webMic(constraints, "permission");
    if (!P || !micNative()) return web();
    return _nmP(() => P.micPermission({ request: true })).then((r) => {
      const st = r && r.state;
      if (st === "granted") return _nmDeadStream();
      if (st === "denied") throw _nmErr("NotAllowedError", "microphone not allowed");
      return web();
    }, () => web());
  }
  function _nmDeadStream() {
    const t = _nmEmitter({ kind: "audio", id: "sona-mic-probe", label: "Sona microphone", enabled: true, muted: false, readyState: "ended", onended: null });
    t.stop = () => {}; t.getSettings = () => ({ sonaNative: true }); t.getConstraints = () => ({}); t.getCapabilities = () => ({}); t.clone = () => t;
    return _nmEmitter({ id: "sona-probe", active: false, sonaNative: true, getTracks: () => [t], getAudioTracks: () => [t],
      getVideoTracks: () => [], getTrackById: (id) => (id === t.id ? t : null) });
  }
  // micSource(ctx, stream): an AudioNode in ctx carrying the mic. A real
  // MediaStream gets exactly the line every page had.
  function micSource(ctx, stream) {
    const h = stream && _nm.of && _nm.of.get(stream);
    if (!h) return ctx.createMediaStreamSource(stream);
    return h.source(ctx);
  }
  // micDeaf(stream[, ctx]): true while Sona's own mic is not hearing: paused
  // (a call, a stall, a re-open), or the frame a page just read held a gap
  // between the phone's samples (the feed's ear, above). The pages whose
  // room floor only goes down skip those frames exactly as they skip the
  // frames of their own sounds. False for a real MediaStream, the web mic
  // included: those pages read it exactly as they always did.
  function micDeaf(stream, ctx) {
    const h = stream && _nm.of && _nm.of.get(stream);
    if (!h || h.web) return false;
    if (h.state !== "live" || !h.firstAt) return true;
    for (let k = 0; k < h.feeders.length; k++) { const f = h.feeders[k]; if ((!ctx || f.ctx === ctx) && f.deaf()) return true; }
    return false;
  }
  // micRecorder(stream): the keepsake clip's recorder. For Sona's own mic,
  // one 16-bit mono WAV (48 kHz halved to 24 kHz, at most 25 s), raw samples
  // without the boost, handed over the way MediaRecorder does: data, then
  // stop, a task after stop(); and it stops itself if the mic ends.
  function micRecorder(stream) {
    const h = stream && _nm.of && _nm.of.get(stream);
    if (!h) return new MediaRecorder(stream);
    if (h.web) return new MediaRecorder(h.web);
    const rc = _nmEmitter({ state: "inactive", mimeType: "audio/wav", stream: stream, ondataavailable: null, onstop: null, onstart: null, onerror: null });
    let parts = [], rate = 0, got = 0;
    rc._push = (pcm, r) => {
      if (rc.state !== "recording") return;
      if (rate && r !== rate) return;          // one rate a clip: a change mid-clip keeps what it has
      rate = r;
      const room = Math.round(NATIVE_MIC.clipMaxMs * r / 1000) - got;
      if (room <= 0) return;
      const part = pcm.length > room ? pcm.subarray(0, room) : pcm;
      parts.push(part); got += part.length;
    };
    rc.start = () => {
      if (rc.state !== "inactive") throw _nmErr("InvalidStateError", "already recording");
      if (h.state === "ended") throw _nmErr("InvalidStateError", "the microphone has stopped");
      parts = []; rate = 0; got = 0; rc.state = "recording"; h.recorders.push(rc);
      setTimeout(() => _nmFire(rc, "start"), 0);
    };
    rc._end = () => {
      if (rc.state === "inactive") return;
      rc.state = "inactive"; h.recorders = h.recorders.filter((x) => x !== rc);
      const blob = _nmWav(parts, rate); parts = [];
      setTimeout(() => { _nmFire(rc, "dataavailable", { data: blob }); _nmFire(rc, "stop"); }, 0);
    };
    rc.stop = () => rc._end();
    rc.requestData = () => {}; rc.pause = () => {}; rc.resume = () => {};
    return rc;
  }
  // The clip as Echo's own voice files are kept: 24 kHz mono 16-bit, written
  // by pcmWave (top of this file). 48 kHz halves by averaging pairs; any
  // other rate goes through the queue's own resampler.
  function _nmWav(parts, rate) {
    let n = 0; parts.forEach((p) => { n += p.length; });
    if (!n || !rate) return new Blob([], { type: "audio/wav" });   // nothing heard: an empty blob, which the page drops
    let x;
    if (rate === 48000) {
      const all = new Float32Array(n); let o = 0; parts.forEach((p) => { all.set(p, o); o += p.length; });
      x = new Float32Array(n >> 1);
      for (let i = 0; i < x.length; i++) x[i] = (all[2 * i] + all[2 * i + 1]) / 2;
    } else {
      const f = nmFifo({ primeMs: 1, stepMs: 1, maxPrimeMs: 1 }, 24000);   // never primed, so it never drops
      parts.forEach((p) => f.push(p, rate));
      x = new Float32Array(f.depth); let o = 0; f.q.forEach((c) => { x.set(c, o); o += c.length; });
    }
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, x[i])) * 32767);
    return pcmWave(new Uint8Array(pcm.buffer));
  }
  // Resolves once every close sent to the phone has been answered (at most
  // quietMaxMs). Pages stamp their quiet tail at stop(); if Travis's phone
  // shows closes over 50 ms, each page's settle helper waits on this too.
  function micQuiet() {
    if (!_nm.closing) return Promise.resolve(true);
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), NATIVE_MIC.quietMaxMs);
      _nm.quiet.push(() => { clearTimeout(t); resolve(true); });
    });
  }
  // For the phone checklist (Safari's console: Sona.micStats()) and the tests.
  function micStats() {
    // session: the audio-session type this page wrote (null: untouched;
    // "transient-solo": sounds follow the silent switch; "auto": given back
    // for WebKit's own mic, sessionWhy says what asked)
    return { on: NATIVE_MIC_ON, native: micNative(), broken: _nm.broken, why: _nm.why, busy: _nm.busy, closeMaxMs: _nm.closeMaxMs,
      live: _nm.live.map(_nmStatOf), opens: _nm.opens.slice(), session: _as.type, sessionWhy: _as.why || null };
  }
  try {
    global.addEventListener("pagehide", () => {
      _nm.epoch++;
      _nm.leave.splice(0).forEach((fn) => fn());
      _nm.live.slice().forEach((h) => h._end("pagehide", false));
    });
    // back from the back-forward cache: Capacitor dropped the listeners when the page left
    global.addEventListener("pageshow", (e) => { if (e && e.persisted) _nm.subscribed = false; });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) _nmReady(); });
  } catch (e) {}
  // ── END OF SONA'S OWN MICROPHONE ──

  // HEAR2 (28 Sep 2026): Travis, "I just don't want kids saying taco and
  // getting a correct score. We want them to be in the ballpark." The first
  // rules passed any word with the target LETTER anywhere in it and any word
  // one letter off the target. So "Here is a taco" passed R ("here" has an r),
  // "water" passed for rabbit, and "sock" passed for rock. The rules below keep
  // the close tries and drop those.
  //
  // A transcript only has spelling, so each sound is matched by the ways it is
  // spelled in the words a child practises (K is "c" in cat, F is "ph" in
  // phone, S is "c" in ice).
  const HEAR_SPELL = {
    R: "r", L: "l", S: "s(?!h)|c(?=[eiy])", Z: "z", SH: "sh", CH: "t?ch", J: "dge|j|g(?=[eiy])",
    K: "ck|k|q|c(?![eiyh])", G: "g", F: "ph|f", V: "v", TH: "th", THV: "th",
    P: "p", B: "b", M: "m", N: "n", T: "t(?!h)", D: "d",
  };
  // What a close try at each sound usually comes out as: the errors a child
  // working on that sound typically makes ("wabbit", "wed", "thun", "tat").
  // Rachel to confirm the list; it is here so she can change it without an
  // App Store review.
  const HEAR_SUBS = {
    R: ["w", "l"], L: ["w", "y"], S: ["th", "t", "sh"], Z: ["th", "d", "s"], SH: ["s", "ch"],
    CH: ["sh", "t", "ts"], J: ["d", "z", "ch"], TH: ["f", "s", "t", "d"], THV: ["d", "v", "z"],
    K: ["t"], G: ["d"], F: ["p", "b"], V: ["b", "f"],
  };
  // At the very end of a word, R and L often melt into the vowel ("cah" for car).
  const HEAR_SUBS_END = { R: ["", "h", "w"], L: ["", "w", "o"] };
  // How a transcript writes a sound that is not a word. On a bare-sound round
  // these say nothing either way, so they are "unknown", never a fail.
  const HEAR_FILLER = { a: 1, uh: 1, uhh: 1, um: 1, umm: 1, ah: 1, ahh: 1, aah: 1, eh: 1, oh: 1, ooh: 1, oo: 1, hmm: 1, hm: 1, mm: 1, mmm: 1, huh: 1, ha: 1, hah: 1, mhm: 1, er: 1, erm: 1, err: 1, aw: 1, ew: 1, whoa: 1, woah: 1 };
  const HEAR_NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  // Where a sound sits in a word: "i" at the start, "f" at the end (a silent
  // final e does not count: house, cake), "m" anywhere between.
  function _hearSpots(str, sound) {
    const out = {}, src = HEAR_SPELL[sound];
    if (!src || !str) return out;
    const re = new RegExp(src, "g"), end = str.length - (str.length > 2 && /e$/.test(str) ? 1 : 0);
    let m;
    while ((m = re.exec(str))) {
      const at = m.index, len = m[0].length || 1;
      out[at === 0 ? "i" : (at + len >= end ? "f" : "m")] = true;
      if (!m[0].length) re.lastIndex++;
    }
    return out;
  }
  // The target word plus its close tries: each place the sound is spelled,
  // swapped for a typical error. "rabbit" → wabbit, labbit; "car" → caw, cah.
  function _hearVariants(w, sound) {
    const out = [w], src = HEAR_SPELL[sound];
    if (!src) return out;
    const re = new RegExp(src, "g");
    let m;
    while ((m = re.exec(w))) {
      const at = m.index, len = m[0].length || 1;
      const subs = (HEAR_SUBS[sound] || []).concat(at + len >= w.length ? (HEAR_SUBS_END[sound] || []) : []);
      for (let k = 0; k < subs.length; k++) {
        const v = w.slice(0, at) + subs[k] + w.slice(at + len);
        if (v.length >= 2) out.push(v);
      }
      if (!m[0].length) re.lastIndex++;
    }
    return out;
  }
  // Is a within n edits (letters changed, added or dropped) of b?
  function _hearNear(a, b, n) {
    if (Math.abs(a.length - b.length) > n) return false;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev.push(j);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
      prev = row;
    }
    return prev[b.length] <= n;
  }
  function _hearTokens(text) {
    return String(text || "").toLowerCase()
      .replace(/\d+/g, (d) => " " + (HEAR_NUM[+d] || d) + " ")     // Apple writes "four" as "4"
      .replace(/[^a-z' ]+/g, " ").split(/\s+/)
      .map((t) => t.replace(/^'+|'+$/g, "")).filter(Boolean);
  }
  /**
   * hearVerdict(transcript, sound, word, opts?) → "pass" | "fail" | "unknown"
   * opts: { level: "isolation"|"syllable"|"word"|"sentence", frame: the
   *         sentence the child was asked to say, when there is one }
   *
   * pass    — a real try at the target: the word, or a close version of it
   *           ("wabbit" for rabbit, "wed" for red, "cah" for car, "rainy" for
   *           rain; "wabbit" IS the practice, per Travis). Never a different
   *           word (Travis: "the exact / close word"). On a bare-sound round, a
   *           short sound or mostly the sound itself ("rrr", "er").
   * fail    — the child said clear words and none of them is a try at the
   *           target: "taco" or "fridge" for rabbit, "Here is a taco", "sock"
   *           for rock, "run" for rain.
   * unknown — nothing to judge: no words, only filler ("uh", "hmm"), or only
   *           the words around the target ("Here is a …"). Unknown is NEVER a
   *           fail. Apple's models are tuned on adults and a child's speech
   *           often will not transcribe, so unknown hands the try to the
   *           sound-shape check, exactly as before this feature existed.
   *
   * Two things are set aside before judging: a grown-up coaching ("say
   * rabbit") — the word after "say" is theirs, not the child's — and, on a
   * sentence round, the sentence's other words. Without the first, a parent
   * in the room made "taco" pass; without the second, "Here is a" did.
   */
  function hearVerdict(transcript, sound, word, opts) {
    opts = opts || {};
    const S2 = String(sound || "").toUpperCase();
    let tokens = _hearTokens(transcript);
    if (!tokens.length) return "unknown";
    const said = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === "say" || tokens[i] === "said" || tokens[i] === "saying") { i++; continue; }
      said.push(tokens[i]);
    }
    tokens = said;
    const w = String(word || "").toLowerCase().replace(/[^a-z']/g, "");
    if (opts.frame) {
      const skip = {};
      _hearTokens(opts.frame).forEach((t) => { if (t !== w) skip[t] = 1; });
      tokens = tokens.filter((t) => !skip[t]);
    }
    // what is left that says something: filler is only filler when it has no
    // trace of the target ("er" is a fine R, "mm" a fine M)
    const content = tokens.filter((t) => !HEAR_FILLER[t] || Object.keys(_hearSpots(t, S2)).length);
    if (!content.length) return "unknown";
    const bare = opts.level === "isolation" || !w || w === String(SOUND_SAY[S2] || "");
    if (bare) {
      // A bare sound comes back short ("Er", "Grr", "Are") or as mostly the
      // sound itself ("Rrrrr", "Shhhh", "Error"). A word that merely has the
      // sound in it ("fridge", "water", "taco" for K) is not a try at the
      // sound on its own.
      const own = String(SOUND_SAY[S2] || S2.toLowerCase()).replace(/[aeiou]/g, "");
      for (let i = 0; i < content.length; i++) {
        const t = content[i];
        if (!Object.keys(_hearSpots(t, S2)).length) continue;
        let n = 0;
        for (let k = 0; k < t.length; k++) if (own.indexOf(t[k]) >= 0) n++;
        if (t.length <= 3 || n * 2 >= t.length) return "pass";
      }
      return "fail";
    }
    const vars = _hearVariants(w, S2);
    const near = Math.max(1, Math.floor(w.length / 3)), subs = HEAR_SUBS[S2] || [];
    for (let i = 0; i < content.length; i++) {
      const t = content[i];
      for (let k = 0; k < vars.length; k++) {
        const v = vars[k];
        if (t === v || t === v + "s" || t === v + "es" || t === v + "'s") return "pass";
      }
      // Otherwise it has to be close to the word itself, and still carry the
      // sound or its usual error: "rainy" for rain, "parrot" or "cawwot" for
      // carrot, "crib" for crab. A different word does not count, even one
      // with the sound in the same place (Travis, 28 Sep 2026: "ideally the
      // exact / close word"): not "run" for rain, not "fridge" for carrot.
      const has = _hearSpots(t, S2);
      let carries = Object.keys(has).length > 0;
      for (let k = 0; !carries && k < subs.length; k++) carries = !!subs[k] && t.indexOf(subs[k]) >= 0;
      if (carries && _hearNear(t, w, near)) return "pass";
    }
    return "fail";
  }

  // THIRD FREE ERA, KEPT — and this one was promised the most explicitly.
  //
  // Sona was free from 31 Aug to 15 Sep 2026. Unlike era two, that window was
  // announced as PERMANENT: the landing page said free, CLAUDE.md said
  // permanent, and /api/checkout refused money outright. Travis has now
  // decided to charge again, which is his call — but the families who arrived
  // believing the first thing do not pay for the change of mind. The
  // precedent has been set twice, and CLAUDE.md recorded the requirement
  // before the question was live: if pricing returns, this sweep ships FIRST.
  //
  // Same structural trick as eras one and two, for the same reason: on the
  // FIRST LOAD OF THIS BUILD, a device that is ALREADY onboarded necessarily
  // existed before this build shipped, and this build is the one that brings
  // the paywall back. So an onboarded device seen here used Sona while it was
  // free. A family arriving tomorrow gets stamped before they ever onboard and
  // is correctly left out. The evidence exists only until this build lands,
  // which is why it is claimed on the way in and never re-run.
  //
  // Deliberately NOT gated on the era-one/era-two stamps. Era two checked
  // `GFKEY === "post"` because an already-"grandfathered" device was, by
  // definition, already handled. That is still true — re-granting is a no-op —
  // but a device that first loaded during the free era carries GFKEY "post"
  // and GF2KEY "done" and belongs to no earlier cohort, so gating on those
  // keys would skip exactly the families this sweep exists for.
  const GF3KEY = "sona.freeera3.v1";
  function _grandfatherFreeEra3() {
    try {
      if (localStorage.getItem(GF3KEY)) return;     // swept once, on the way in
      localStorage.setItem(GF3KEY, "done");
      // every child on the device, not just the active one — access was
      // granted to the household, the same rule earlyAdopterAnyKid enforces
      let slots = [""];
      try {
        const v = JSON.parse(localStorage.getItem(KIDSKEY) || "null");
        if (v && v.list && v.list.length) slots = v.list.map((k) => k.slot || "");
      } catch (e) {}
      let any = false;
      slots.forEach(function (slot) {
        const key = slot ? PKEY + "@" + slot : PKEY;
        try {
          const pr = JSON.parse(localStorage.getItem(key) || "null");
          if (pr && (pr.onboarded || pr.childName)) {
            pr.earlyAdopter = true; pr.freeEra = true; pr.freeEra3 = true;
            localStorage.setItem(key, JSON.stringify(pr));
            any = true;
          }
        } catch (e) {}
      });
      if (any) localStorage.setItem(GFKEY, "grandfathered");
    } catch (e) {}
  }

  // FOURTH FREE ERA, KEPT — and it ships in the build that ends it.
  //
  // Sona went free again on 20 Sep 2026 ("make it free"), and every family who
  // arrived while that window was open came in under it. Pricing returns with
  // this build as a free version plus Premium, and CLAUDE.md fixed the rule
  // before the question was live: the sweep for a free window ships in the
  // SAME build that returns pricing — never earlier, because a sweep that
  // shipped during the window would have stamped the very families it exists
  // to protect before they onboarded.
  //
  // Two kinds of device are this era's cohort, and both get Premium for good:
  //   • any device already ONBOARDED on its first load of this build — the
  //     same structural evidence eras one to three used;
  //   • any device holding a clinician's verified credential (sona.slpok /
  //     sona.slpunlock), onboarded or not. Until this build a redemption WAS
  //     free-forever access, written on the spot; from this build it is a
  //     ticket whose Premium depends on the clinician's plan. A family who
  //     redeemed a link and hadn't finished setup yet was promised exactly
  //     what the family who had was promised.
  // A family whose first load is this build or later is stamped here before
  // they onboard or redeem anything, and gets what the free version and their
  // clinician's coverage give them — nothing from this sweep.
  //
  // HOUSEHOLD-WIDE, like the earlier eras: every profile on the device. A
  // credential-only device has no profile yet, so the grant goes where the
  // first child's profile will be, and onboarding merges into it.
  //
  // Deliberately NOT gated on any earlier era's stamp: a device that first
  // loaded during era three or four carries all of them and belongs to none.
  const GF4KEY = "sona.freeera4.v1";
  function _grandfatherFreeEra4() {
    try {
      if (localStorage.getItem(GF4KEY)) return;     // swept once, on the way in
      localStorage.setItem(GF4KEY, "done");
      let slots = [""];
      try {
        const v = JSON.parse(localStorage.getItem(KIDSKEY) || "null");
        if (v && v.list && v.list.length) slots = v.list.map((k) => k.slot || "");
      } catch (e) {}
      const read = (slot) => {
        try { const pr = JSON.parse(localStorage.getItem(slot ? PKEY + "@" + slot : PKEY) || "null"); return (pr && typeof pr === "object") ? pr : null; }
        catch (e) { return null; }
      };
      const onboarded = slots.some((slot) => { const pr = read(slot); return !!(pr && (pr.onboarded || pr.childName)); });
      let redeemed = false;
      try { redeemed = localStorage.getItem("sona.slpunlock") === "1" || !!localStorage.getItem("sona.slpok"); } catch (e) {}
      if (!onboarded && !redeemed) return;
      slots.forEach(function (slot) {
        try {
          const pr = read(slot) || {};
          pr.earlyAdopter = true; pr.freeEra = true; pr.freeEra4 = true;
          localStorage.setItem(slot ? PKEY + "@" + slot : PKEY, JSON.stringify(pr));
        } catch (e) {}
      });
      localStorage.setItem(GFKEY, "grandfathered");
    } catch (e) {}
  }

  // FIFTH FREE ERA, KEPT — and it ships in the build that ends it.
  //
  // Sona went free again on 24 Sep 2026, the afternoon Caseload Premium
  // merged, and stayed free until this build brought the paywall back
  // (Travis, 30 Sep 2026: "we add the paywall today"; families first meet it
  // on launch day, when the launch lock lifts). The rule is the one every
  // window has kept: the sweep ships in the build that ENDS the window,
  // never earlier, or it stamps the families it exists for before they
  // onboard.
  //
  // The cohort is structural, as in eras one to three: a device already
  // ONBOARDED on its first load of this build used Sona while it was free,
  // and keeps Premium for good. A clinician's link redeemed in this window is
  // not a cohort of its own, unlike era four's: since the Caseload Premium
  // build a redemption is a ticket whose Premium is the clinician's coverage
  // (caseCovered), and that promise keeps itself. A family whose first load
  // is this build or later is stamped here before they onboard, and pays.
  //
  // Deliberately NOT gated on any earlier era's stamp: a device that first
  // loaded during era five carries all four of them and belongs to none.
  const GF5KEY = "sona.freeera5.v1";
  function _grandfatherFreeEra5() {
    try {
      if (localStorage.getItem(GF5KEY)) return;     // swept once, on the way in
      localStorage.setItem(GF5KEY, "done");
      let slots = [""];
      try {
        const v = JSON.parse(localStorage.getItem(KIDSKEY) || "null");
        if (v && v.list && v.list.length) slots = v.list.map((k) => k.slot || "");
      } catch (e) {}
      let any = false;
      slots.forEach(function (slot) {
        const key = slot ? PKEY + "@" + slot : PKEY;
        try {
          const pr = JSON.parse(localStorage.getItem(key) || "null");
          if (pr && (pr.onboarded || pr.childName)) {
            pr.earlyAdopter = true; pr.freeEra = true; pr.freeEra5 = true;
            localStorage.setItem(key, JSON.stringify(pr));
            any = true;
          }
        } catch (e) {}
      });
      if (any) localStorage.setItem(GFKEY, "grandfathered");
    } catch (e) {}
  }

  // THE FREE VERSION, KEPT (3 Oct 2026), in the free eras' one-shot shape. A
  // device already set up on its first load of the trial-first build was told
  // Fruit Slice, Piano Tiles, Feed Echo, Bubble Pop and the free book were
  // free, and keeps them ("kept"); a device not set up yet is stamped "post"
  // before it onboards, and starts with the trial. It keeps the free version,
  // not Premium. Not gated on any free era's stamp (a device that first
  // loaded in an earlier window carries those too), and on NO_IMPORT like
  // them: it is true of this device, not of a family.
  function _keepFreeVersion() {
    try {
      if (localStorage.getItem(FREEVER_KEY)) return;
      let slots = [""];
      try {
        const v = JSON.parse(localStorage.getItem(KIDSKEY) || "null");
        if (v && v.list && v.list.length) slots = v.list.map((k) => k.slot || "");
      } catch (e) {}
      const setUp = slots.some(function (slot) {
        try { const pr = JSON.parse(localStorage.getItem(slot ? PKEY + "@" + slot : PKEY) || "null"); return !!(pr && (pr.onboarded || pr.childName)); }
        catch (e) { return false; }
      });
      localStorage.setItem(FREEVER_KEY, setUp ? "kept" : "post");
    } catch (e) {}
  }

  // OWN1 (11 Oct 2026, D3): a household already set up on this build's first
  // load keeps every buddy, hat and place it could pick that day ("kept"); a
  // device not set up yet is stamped "post" before it onboards and starts with
  // the starter buddies. The stamp is true of this device and is on NO_IMPORT;
  // what the family owns is written into each child's profile.owned, which a
  // backup carries, so moving phones (or into the iPhone app) takes nothing away.
  // It reads no other sweep's stamp. Like the free-era sweeps, it is one-shot
  // and structural: never "clean it up", and never re-run it.
  const BUDDYSET_KEY = "sona.buddyset.v1";
  function _legacyInto(owned) {
    const o = (owned && typeof owned === "object" && !Array.isArray(owned)) ? owned : {};
    Object.keys(LEGACY_SET).forEach((kind) => {
      const have = Array.isArray(o[kind]) ? o[kind] : [];
      LEGACY_SET[kind].forEach((id) => { if (have.indexOf(id) < 0) have.push(id); });
      o[kind] = have;
    });
    return o;
  }
  function _keepBuddies() {
    try {
      if (localStorage.getItem(BUDDYSET_KEY)) return;
      let slots = [""];
      try { const v = JSON.parse(localStorage.getItem(KIDSKEY) || "null"); if (v && v.list && v.list.length) slots = v.list.map((k) => k.slot || ""); } catch (e) {}
      let setUp = false;
      slots.forEach(function (slot) {
        try {
          const key = slot ? PKEY + "@" + slot : PKEY, pr = JSON.parse(localStorage.getItem(key) || "null");
          if (!(pr && (pr.onboarded || pr.childName))) return;
          setUp = true; pr.owned = _legacyInto(pr.owned); localStorage.setItem(key, JSON.stringify(pr));
        } catch (e) {}
      });
      localStorage.setItem(BUDDYSET_KEY, setUp ? "kept" : "post");
    } catch (e) {}
  }
  // missing = kept (fails open), so a device that cannot read its stamp takes nothing away
  function buddiesKept() { try { return localStorage.getItem(BUDDYSET_KEY) !== "post"; } catch (e) { return true; } }

  const HUMAN_CLIPS = true;
  function humanClipsOn() { return HUMAN_CLIPS; }

  // ── THE FAMILY PAYWALL SWITCH ─────────────────────────────────────────
  // FREE_MODE is the switch for what a FAMILY pays, mirrored in
  // lib/pricing.ts for the server (tests/freetest.mjs fails if they disagree).
  //
  // Since 24 Sep 2026 "off" no longer means "everything behind a wall". Sona
  // has a FREE VERSION — daily practice and released free-tier games —
  // and PREMIUM, which opens every released game:
  //   OFF (now) — the free version for the families freeVersion() names
  //     (since 3 Oct 2026 a family who could buy here starts with the price:
  //     see TRIAL FIRST); Premium for premium(): a subscription (on the
  //     iPhone the one plan the App Store answers with, at its price and
  //     with any free days it reports: storePlan(); on the web, when the
  //     website sells, the plans in lib/charter.ts via /api/charter), a
  //     covered clinician's caseload, a founder or founding pilot, or any of
  //     the five free eras' promises;
  //   ON — every released game for everyone, nothing sold.
  // Practice is never gated in either state; gated() says so before anything.
  //
  // The CLINICIAN plan ("Sona Premium for your caseload", bought on the
  // dashboard) is separate and deliberately does not read this switch: what
  // it pays for is its families' Premium, reported back here by caseRefresh.
  //
  // Era five, the window that opened on 24 Sep 2026, ends with this build,
  // and its sweep (_grandfatherFreeEra5) ships in it. The next free window,
  // if there is one, gets its own sweep in the build that ends it.
  //
  // The paid rails stay TESTED in either state through the ?paid=1 seam below,
  // because a switch nobody can flip is not a switch — and every free era so
  // far has proved how fast an unexercised path rots into archaeology.
  const FREE_MODE = false;  // Travis, 30 Sep 2026: "we add the paywall today" — era five ends the day this merges
  // QA seam: ?paid=1 (or the sticky sona.paidui flag) reveals the purchase
  // rails on this device so the paid path stays exercisable — and TESTED —
  // while free mode ships. It only controls VISIBILITY; it can't unlock
  // anything, grant entitlement, or move money.
  function isFree() {
    if (!FREE_MODE) return false;
    try {
      const q = new URLSearchParams(global.location.search);
      // SESSION-scoped, deliberately. This lived in localStorage and so was
      // permanent: one stray ?paid=1 — a shared QA link, a bookmark, a curious
      // tap — and that family saw a paywall forever, in a free app, with the
      // only escape a ?paid=0 parameter nobody could know about. A QA seam must
      // not be able to lock a child out of a free product. sessionStorage
      // lasts the tab, which is all testing needs, and dies on its own.
      if (q.get("paid") === "1") sessionStorage.setItem("sona.paidui", "1");
      if (q.get("paid") === "0") { sessionStorage.removeItem("sona.paidui"); localStorage.removeItem("sona.paidui"); }
      // clear the old persistent flag wherever it is still stuck
      if (localStorage.getItem("sona.paidui")) localStorage.removeItem("sona.paidui");
      if (sessionStorage.getItem("sona.paidui") === "1") return false;
    } catch (e) {}
    return true;
  }

  // ── WHERE A FAMILY CAN BUY ────────────────────────────────────────────
  // WEB_SALES is the second switch, and it is a different question from
  // FREE_MODE: not "does Sona cost anything" but "can a FAMILY start a
  // purchase in a web browser". Off (Travis, 1 Oct 2026: "i dont want them
  // paying on the website"), a family buys Premium only in the iPhone and
  // iPad app, through Apple: a family who paid on the web had no cancel
  // button, and a cancelled web plan stayed unlocked on the phone. Mirrored in
  // lib/pricing.ts for the server (tests/freetest.mjs fails if they disagree),
  // and the server refuses on its own copy, whatever a page shows.
  //
  // It is the FAMILY web checkout and nothing else. The Apple card never reads
  // it ("native" is isNativeApp(), always). Nor does anything a family who
  // ALREADY pays through Stripe leans on: restore(), isSubscribed(), the
  // receipt page. A plan off sale is not a cancelled subscription. The
  // clinician plans, bought on the dashboard, never read it either.
  //
  // Pages keep BOTH states and read webSales(), failing closed:
  //   !!(Sona.webSales && Sona.webSales())
  // so a stale page beside a new sona.js shows no web card rather than a card
  // whose button the server refuses.
  //
  // It shipped true on 1 Oct 2026, because the app on the App Store that
  // night had no purchase plugin. OFF since 2 Oct 2026, on Travis's word
  // ("turn off payments on website"), the day 1.0.5 (the first build that can
  // sell) went to App Review: until that build is live, nobody can buy
  // Premium anywhere, and he chose that.
  const WEB_SALES = false;  // off (Travis, 2 Oct 2026: "turn off payments on website")
  // QA seam, the sona.paidui rule again: SESSION-scoped ("1" shows the web
  // rails, "0" hides them, anything else is the constant), so both states stay
  // played by the tests whichever way this ships. sessionStorage only, and no
  // URL flag: the grown-ups gate strips every query key but first= and from=,
  // and a localStorage seam once showed a family a paywall forever (see
  // isFree above). It only controls VISIBILITY: /api/checkout refuses on the
  // server's switch, so forcing it on in a browser opens nothing.
  function webSales() {
    try {
      const v = sessionStorage.getItem("sona.websalesui");
      if (v === "1") return true;
      if (v === "0") return false;
    } catch (e) {}
    return WEB_SALES;
  }

  const IAP_KEY = "appl_nONRfALUCMiZczeCggXKEusmVtl";
  // Two auto-renewable products in the "full" entitlement. The annual id is
  // the ORIGINAL one — its price changes in App Store Connect ($39.99 →
  // $59.99, existing subscribers preserved), so early buyers keep their rate
  // without any code caring.
  // Monthly was retired from SALE on 18 Sep 2026, back on sale on 1 Oct 2026,
  // and from 5 Oct 2026 the ONLY plan the iPhone's plan screen offered (its
  // price and free days are App Store Connect's, and storePlan() below reads
  // them from the store, so neither is typed here). Since 19 Oct 2026 the
  // annual product can be offered again beside it, as a second row, only
  // while RevenueCat's current offering lists it. The annual id stays here
  // either way, as monthly's did while it was off sale: RevenueCat needs
  // each id to recognise an existing subscriber on restore or reinstall, and
  // dropping one would strand them behind a paywall they are already paying
  // for.
  // ONE PAYMENT (Travis, 22 Oct 2026: "ok go build it all", the one-time
  // purchase on the price screen in iOS 1.0.9; "i dont wanna say lifetime"):
  // a NON-CONSUMABLE in the same "full" entitlement, App Store name "Sona
  // Premium, One Payment". Its id keeps the store's own word because the id
  // is App Store Connect's and never shown; no sentence a parent reads says
  // it. Offered only while RevenueCat's current offering lists it (THE
  // ONE-PAYMENT ROW, below), and kept here for restore like the other two.
  const IAP_PRODUCTS = { annual: "com.speaksona.app.annual", monthly: "com.speaksona.app.monthly", lifetime: "com.speaksona.app.lifetime" };
  const IAP_PRODUCT = IAP_PRODUCTS.annual;
  const IAP_TYPE = "subs"; // auto-renewable subscription
  // The one payment is not a subscription: RevenueCat's getProducts takes
  // the category (iOS ignores it, so a phone answers either way), and an old
  // plugin's purchaseProduct the store's purchase type ("inapp").
  function _iapIsOnce(kind) { return kind === "lifetime"; }
  const IAP_ENTITLEMENT = "full";
  function iapPlugin() {
    try { const C = global.Capacitor; return (C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Purchases) ? C.Plugins.Purchases : null; } catch (e) { return null; }
  }
  function iapAvailable() { return !!iapPlugin(); }
  let _iapReady = null;
  function iapConfigure() {
    const P = iapPlugin(); if (!P) return Promise.reject(new Error("no-iap"));
    if (!_iapReady) {
      _iapReady = Promise.resolve(P.configure({ apiKey: IAP_KEY })).catch(() => {}); // configure is idempotent enough; never block on it twice
      _iapReady.then(() => _rcEmail(P));
    }
    return _iapReady.then(() => P);
  }
  // THE PARENT'S EMAIL, TO REVENUECAT (RCHOOK1, Travis, 16 Oct 2026: "Yes,
  // show emails", over keeping RevenueCat's customers ANONYMOUS). Once the
  // store is set up on a page, the household's parent email (parentEmail():
  // the address the parent typed on setup's email step) is handed to
  // RevenueCat as this customer's email. RevenueCat shows it beside each
  // trial, payment and cancellation, and puts it in every message it sends
  // Sona's server (/api/revenuecat): that is how the welcome emails stop for
  // a family who bought, and how "Your free days end soon" finds the right
  // parent. That address only, never a child's name or anything about their
  // practice, and nothing when no email was given. Optional like every new
  // native call: a build without setEmail, or one that throws or refuses,
  // changes nothing, and nothing waits on it (RevenueCat keeps the address
  // on the phone and sends it with the next purchase, restore or sync).
  function _rcEmail(P) {
    try {
      if (!P || typeof P.setEmail !== "function") return;
      const email = parentEmail();
      if (email) _soon(() => P.setEmail({ email: email })).catch(() => {});
    } catch (e) {}
  }
  function _iapActive(info) {
    try { const e = info && (info.customerInfo || info); return !!(e && e.entitlements && e.entitlements.active && e.entitlements.active[IAP_ENTITLEMENT]); } catch (e2) { return false; }
  }
  function _iapUnlock() { saveSub({ active: true, source: "apple", since: Date.now() }); }
  // Which period Apple says Premium is in: "TRIAL" (free days), "NORMAL",
  // "INTRO" or "PREPAID", or "" when the answer does not say (_tellPlan).
  function _iapPeriod(info) {
    try {
      const e = info && (info.customerInfo || info);
      const f = e && e.entitlements && e.entitlements.active && e.entitlements.active[IAP_ENTITLEMENT];
      return f && f.periodType ? String(f.periodType).toUpperCase() : "";
    } catch (e2) { return ""; }
  }
  // When Apple says this period of Premium ends, in ms since 1970, or 0 when
  // its answer does not say (a one payment has no end): the trial reminder
  // (NOTIFY1) is set from the purchase's own record, before the price page
  // leaves, not from a second lookup that page may not live to hear.
  function _iapEnd(info) {
    try {
      const e = info && (info.customerInfo || info);
      const f = e && e.entitlements && e.entitlements.active && e.entitlements.active[IAP_ENTITLEMENT];
      let end = f ? Number(f.expirationDateMillis) : 0;
      if (!(end > 0) && f) end = Date.parse(String(f.expirationDate || ""));
      return end > 0 ? end : 0;
    } catch (e2) { return 0; }
  }
  // fetch the live product (price string comes from the App Store, locale-
  // correct). kind: "annual" (default) | "monthly" | "lifetime".
  // THE PRODUCT ASKED FOR, OR NOTHING (1 Oct 2026). This took the first
  // product in the answer whatever it was. With two on sale that is how a
  // "Monthly" button buys the yearly plan: a store that has no monthly product
  // but answers with the yearly one would have priced and sold it under the
  // wrong name. A product that names itself must name the id asked for; only
  // an answer with no identifier at all (an old plugin) is taken on trust.
  function iapProduct(kind) {
    const id = IAP_PRODUCTS[kind || "annual"] || IAP_PRODUCT;
    return iapConfigure().then((P) =>
      Promise.resolve(P.getProducts({ productIdentifiers: [id], type: _iapIsOnce(kind) ? "NON_SUBSCRIPTION" : IAP_TYPE }))
        .catch(() => P.getProducts({ productIdentifiers: [id] }))
        .then((r) => {
          const list = (r && r.products) || [];
          for (let i = 0; i < list.length; i++) if (list[i] && list[i].identifier === id) return list[i];
          return (list.length === 1 && list[0] && list[0].identifier == null) ? list[0] : null;
        })
    );
  }
  // buy. ONE PURCHASE CALL, NEVER TWO (5 Oct 2026). This used to try
  // purchaseStoreProduct and, when that REJECTED, try purchaseProduct too
  // ("fall back across plugin versions"). But a rejection is Apple's answer,
  // not a missing method: a parent who cancelled the sheet, or whose purchase
  // is waiting for Ask to Buy, was then sent through the second name, and on
  // a bridge that answers it the second call's error replaced Apple's own
  // (cancel read as "That didn't go through", "Waiting for approval" could
  // never show) or a second sheet opened. Which method exists is known before
  // anything is asked of Apple, so it is chosen first and called once.
  // `product` (optional) is the store's own product object, already in hand
  // from storePlan(): with it no second fetch can hang between the tap and
  // Apple's sheet. Without it, or with one that is not the id being bought,
  // the product is fetched here as it always was.
  function iapPurchase(kind, product) {
    const id = IAP_PRODUCTS[kind || "annual"] || IAP_PRODUCT;
    return iapConfigure().then((P) => {
      const have = (product && product.identifier === id) ? Promise.resolve(product) : iapProduct(kind);
      return have.then((prod) => {
        if (prod && typeof P.purchaseStoreProduct === "function") return P.purchaseStoreProduct({ product: prod });   // the only attempt
        if (typeof P.purchaseProduct === "function") return P.purchaseProduct({ productIdentifier: id, type: _iapIsOnce(kind) ? "inapp" : IAP_TYPE });   // an old plugin with no product API
        throw new Error("no-purchase-api");
      });
    }).then((res) => {
      if (res && res.userCancelled) throw Object.assign(new Error("cancelled"), { cancelled: true });
      if (_iapActive(res)) { _iapUnlock(); return { ok: true, period: _iapPeriod(res), end: _iapEnd(res) }; }
      // some plugin versions return only {productIdentifier}; verify via customer info
      return iapRefresh(true).then((active) => { if (active) return { ok: true }; throw new Error("not-entitled"); });
    }).catch((e) => {
      if (e && (e.cancelled || e.userCancelled || /cancel/i.test(String(e && e.message)))) throw Object.assign(new Error("cancelled"), { cancelled: true });
      throw e;
    });
  }
  function iapRestore() {
    return iapConfigure().then((P) => P.restorePurchases()).then((info) => {
      const active = _iapActive(info);
      if (active) _iapUnlock();
      return active;
    });
  }
  // quiet entitlement sync (today.html on load in the shell): keeps sub state
  // honest across reinstalls/devices without any UI.
  // Apple access has a lifetime, and this is where it ends.
  //
  // This used to grant and never revoke. Two halves, both wrong: an unforced
  // refresh returned true immediately for anyone already cached active — so an
  // existing subscriber was NEVER re-checked — and even a forced refresh that
  // came back inactive left the stored flag alone, because _iapUnlock() only
  // runs on success. Cancel, expire, refund, or have a payment fail, and
  // isSubscribed() stayed true on that device forever.
  //
  // Now: re-verify on a cadence, and act on an authoritative "no".
  const IAPCHK = "sona.iapcheck.v1";        // when Apple last actually answered
  const IAP_RECHECK_MS = 6 * 60 * 60 * 1000;
  function iapRefresh(force) {
    if (!iapAvailable()) return Promise.resolve(false);
    // Cached and checked recently: trust it. This is the offline grace too —
    // a subscriber on a plane keeps their app.
    if (!force && isSubscribed()) {
      let last = 0;
      try { last = parseInt(localStorage.getItem(IAPCHK) || "0", 10) || 0; } catch (e) {}
      if (Date.now() - last < IAP_RECHECK_MS) return Promise.resolve(true);
    }
    return iapConfigure().then((P) => P.getCustomerInfo()).then((info) => {
      const active = _iapActive(info);
      // Apple answered, so record WHEN — the cadence above is only honest if
      // it measures real answers rather than attempts.
      try { localStorage.setItem(IAPCHK, String(Date.now())); } catch (e) {}
      if (active) { _iapUnlock(); return true; }
      // An authoritative inactive: drop Apple-sourced access. Only Apple's own
      // grant is cleared — a Stripe subscription, a founder unlock, an SLP
      // credential or a grandfathered free era are different sources and must
      // survive, or cancelling an Apple sub would silently paywall a family
      // whose access never came from Apple in the first place.
      try { if (getSub().source === "apple") saveSub({ active: false, since: 0 }); } catch (e) {}
      return false;
    }).catch(() => {
      // Network failure is NOT a cancellation. Leave everything as it is and
      // do not stamp the check clock, so the next open tries again.
      return isSubscribed();
    });
  }

  // ── THE PLANS THE IPHONE SELLS, AS THE STORE ANSWERS THEM (5 Oct 2026) ──
  // Travis, 5 Oct 2026: "get rid of the annual option and update the copy so
  // that it says three days free, then $9.99 a month". The app sold the
  // MONTHLY product alone; since 19 Oct 2026 the yearly one can be a second
  // row beside it, only when RevenueCat's offering lists it (THE YEARLY ROW,
  // below: Plan.year), and since 22 Oct 2026 the one-payment product a third
  // row by the same rule (THE ONE-PAYMENT ROW: Plan.life). The free time is whatever the store's offer says (3
  // days on 5 Oct 2026; a week once Travis sets it in App Store Connect, as
  // approved on 19 Oct 2026, which planFree reads as "7 days"): nothing here
  // counts days. What a screen may say about a plan is decided HERE, once,
  // from three answers only the store can give:
  //   - the monthly product itself: its price, and the free time its
  //     introductory offer carries, if it has one;
  //   - whether THIS Apple ID may still have that offer. Apple gives one per
  //     subscription group and yearly shares monthly's group, so a family who
  //     took the yearly plan's free days gets none here and is charged at
  //     once. A product that "has 3 free days" proves nothing about the buyer;
  //   - whether this Apple ID already holds Premium. A reinstall is a new,
  //     anonymous RevenueCat customer, so the record alone says "no" to a
  //     family that is paying: only a purchase sync finds them.
  // storePlan() turns those into one of four states:
  //   free  — the product came back, its free time can be read, and the buyer
  //           is not definitely ineligible. `sure` is true only on a definite
  //           "eligible"; when it is false the words say "new subscribers"
  //           and state no first charge as fact;
  //   paid  — the product came back and has no offer, or the buyer is
  //           definitely ineligible: charged today, never the word "free";
  //   none  — everything else: no monthly product, the yearly one answering
  //           in its place (iapProduct refuses it), an offer that costs money
  //           or cannot be read, an error, no answer in time. NOTHING is sold
  //           instead (the yearly and one-payment rows included) and no
  //           figure is shown;
  //   owned — this Apple ID already has Premium, so it is never sold a second
  //           plan.
  // The product and the purchase go through iapProduct("monthly") and
  // iapPurchase("monthly", product), the calls real phones already use (the
  // yearly row through iapProduct("annual") and iapPurchase("annual", ...),
  // the one-payment row through iapProduct("lifetime") and
  // iapPurchase("lifetime", ...)).
  // The NEW native calls (the eligibility ask, the purchase sync, and since
  // 19 Oct 2026 RevenueCat's getOfferings) are optional by construction:
  // missing, throwing, rejecting or slow, each leaves the answer exactly as
  // if the call did not exist, and none can hold the card back beyond the
  // limits below.
  const PLAN_WAIT_MS  = 4000;  // no product by then → none/timeout. The clock starts when storePlan() is CALLED, before the store is even set up.
  const PLAN_GRACE_MS = 1200;  // after the product: how long eligibility, "already has it", the yearly row and the one-payment row may hold the answer back
  const PLAN_OWN_MS   = 3000;  // after the product: how long "already has it" may hold back a pay-today price for a buyer Apple calls ineligible
  const WALL_WAIT_MS  = 2500;  // setupWall. Starts when setupWall() is called.
  const IAPSYNC = "sona.iapsync.v1";   // sessionStorage "1": a purchase sync has FINISHED in this app launch
  // a call that may throw before it returns its promise (a bridge method that
  // is missing or broken) becomes a rejection, so nothing below can throw
  function _soon(fn) { return new Promise((resolve) => { resolve(fn()); }); }

  // "Does this Apple ID hold Premium?", shared by storePlan and setupWall so
  // setup's ask and the price screen's are one ask. The customer record
  // first; if it says no, ONE purchase sync, then the record again.
  // syncPurchases re-attaches an old purchase to this install without Apple's
  // sign-in prompt (restorePurchases can show one, which is why Restore stays
  // a button). At most one FINISHED sync per app launch.
  let _ownP = null, _syncP = null;
  function _iapSyncOnce() {            // → Promise<boolean>: true only if a sync was sent now and resolved. Never rejects.
    if (_syncP) return _syncP;         // one attempt per page load
    let had = false; try { had = sessionStorage.getItem(IAPSYNC) === "1"; } catch (e) {}
    const P = iapPlugin();
    if (had || !P || typeof P.syncPurchases !== "function") return (_syncP = Promise.resolve(false));
    // the flag is written only when the sync RESOLVES: one cut off by leaving the page is sent again by the next page
    return (_syncP = _soon(() => P.syncPurchases()).then(() => { try { sessionStorage.setItem(IAPSYNC, "1"); } catch (e) {} return true; }, () => false));
  }
  function _iapOwned(fresh) {          // never rejects
    if (_ownP && !fresh) return _ownP;
    return (_ownP = _soon(() => iapRefresh(true))
      .then((a) => a ? true : _iapSyncOnce().then((sent) => sent ? iapRefresh(true) : false))
      .catch(() => false));
  }

  // The free time a product's introductory offer carries:
  //   "none"  no offer at all;
  //   "paid"  an offer that costs money (a discounted first period): the
  //           first charge is neither nothing nor the full price;
  //   "odd"   an offer whose length cannot be read;
  //   { n, unit, text }  free for that long ("3 days", "1 month", "1 year").
  // Only the last is ever shown as free time. Weeks are said in days, as
  // Apple's own sheet says them.
  function planFree(p) {
    let ip = null; try { ip = p && (p.introPrice || p.introductoryPrice); } catch (e) {}
    if (!ip) return "none";
    // free means a price that IS zero: a missing one is not known to be
    if (ip.price == null || ip.price === "" || Number(ip.price) !== 0) return "paid";
    const span = (n, u) => {
      if (u === "W") { n = n * 7; u = "D"; }
      if (!(n >= 1) || Math.floor(n) !== n) return null;
      const unit = u === "D" ? "day" : u === "M" ? "month" : u === "Y" ? "year" : "";
      // what Apple lets an offer be, with room: anything outside is a misread
      if (!unit || (unit === "day" && n > 31) || (unit === "month" && n > 12) || (unit === "year" && n > 1)) return null;
      return { n, unit, text: n + " " + unit + (n === 1 ? "" : "s") };
    };
    // the count and its unit first, then the ISO period ("P3D"): a bridge may send either
    let free = span(Number(ip.periodNumberOfUnits), String(ip.periodUnit || "").toUpperCase().charAt(0));
    if (!free) { const m = /^P(\d+)([DWMY])$/i.exec(String(ip.period || "")); if (m) free = span(Number(m[1]), m[2].toUpperCase()); }
    return free || "odd";
  }
  // RevenueCat's answer for one product: a number or its name, either under
  // .status or bare (which one a real phone sends is not known yet, so both
  // are read). "no" = this buyer already used the group's offer; "none" = the
  // product has no offer; anything unreadable is "unknown", never a "no".
  function _planElig(r, id) {
    let v = null; try { v = r && r[id]; if (v && typeof v === "object") v = v.status; } catch (e) { v = null; }
    const s = String(v == null ? "" : v).toUpperCase();
    if (s === "1" || s.indexOf("INELIGIBLE") !== -1) return "no";   // before ELIGIBLE: the name contains it
    if (s === "3" || s.indexOf("NO_INTRO") !== -1) return "none";
    if (s === "2" || s === "ELIGIBLE" || s === "INTRO_ELIGIBILITY_STATUS_ELIGIBLE") return "yes";   // exact: "sure" prints "Nothing to pay today" as plain fact
    return "unknown";
  }
  // The Plan a page is handed. `_p` is the store's own product object, kept
  // for buyPlan and hidden from JSON, logs and for-in: nothing may copy it
  // into a payload by accident. FROZEN: one Plan is handed to every caller of
  // the page load, so a page that wrote to it would change the price the next
  // caller reads, and the words built from it.
  // The plan storePlan() answers is always the MONTHLY one (or none/owned),
  // and it carries `year`: the yearly Plan when the card may show a second
  // row for it (see THE YEARLY ROW below), else null. A yearly Plan carries
  // `best` instead: true only when the store's yearly price is below twelve
  // of its monthly ones (the "Best value" tag; never a figure or a ratio).
  // It also carries `life`: the one-payment Plan (THE ONE-PAYMENT ROW), else
  // null. A one-payment Plan is always "paid" (charged today, once), its
  // `per` is "once", and it carries neither `year`, `life` nor `best`.
  function _plan(state, why, p, free, sure, kind, extra) {
    const priced = state === "free" || state === "paid";
    const yearly = kind === "annual", once = _iapIsOnce(kind);
    const plan = {
      state,
      kind: priced ? (yearly ? "annual" : once ? "lifetime" : "monthly") : "",  // handed back to buyPlan (the product bought) and analytics; the card's pick reads it
      id: priced ? String(p.identifier || (yearly ? IAP_PRODUCTS.annual : once ? IAP_PRODUCTS.lifetime : IAP_PRODUCTS.monthly)) : "",
      price: priced ? String(p.priceString) : "",          // the store's own string, verbatim: never rebuilt from a number
      per: priced ? (yearly ? "year" : once ? "once" : "month") : "",
      free: state === "free" ? free : null,
      sure: state === "free" && sure === true,
      why: why || "",
    };
    if (yearly) plan.best = !!(extra && extra.best);
    else if (!once) { plan.year = (priced && extra && extra.year) || null; plan.life = (priced && extra && extra.life) || null; }
    if (priced) Object.defineProperty(plan, "_p", { value: p, enumerable: false });
    if (plan.free) Object.freeze(plan.free);
    return Object.freeze(plan);
  }
  // "Best value": the yearly price below twelve monthly ones, in whole cents
  // (9.99 × 12 in floating point is 119.88000000000001, which would call a
  // yearly price of exactly $119.88 cheaper), from the numbers the store
  // gives, in one currency. Either number missing or odd: no tag.
  function _yearBest(yp, mp) {
    try {
      const y = Math.round(Number(yp && yp.price) * 100), m = Math.round(Number(mp && mp.price) * 100);
      if (!(y > 0 && m > 0 && isFinite(y) && isFinite(m))) return false;
      if (yp.currencyCode && mp.currencyCode && String(yp.currencyCode) !== String(mp.currencyCode)) return false;
      return y < 12 * m;
    } catch (e) { return false; }
  }
  // ── THE YEARLY ROW (Travis, 19 Oct 2026: "go, yes to 1 2 3", to "show TWO
  // plans on the price screen, monthly and yearly, so parents compare") ──
  // The yearly product comes back to Apple's card as a second row, above the
  // monthly one, ONLY when two answers say it can really be sold:
  //   - RevenueCat's CURRENT OFFERING lists it among its packages
  //     (Purchases.getOfferings). On 1 Oct 2026 the yearly product was
  //     attached to no RevenueCat entitlement, so a sale would have taken a
  //     parent's money and opened nothing. Putting it in the current offering
  //     is Travis's switch, in RevenueCat's dashboard, and the sign it is set
  //     up there;
  //   - the store returns the yearly product itself, named by its own id,
  //     with a price.
  // getOfferings missing, throwing, slow (the same PLAN_GRACE_MS the
  // eligibility ask gets after the monthly product), an offering without it,
  // or no product: the card is exactly the monthly row alone, as before. The
  // yearly row is decided when the card is first answered; a later yearly
  // answer never adds a row under a reading parent (a fresh ask may). The
  // monthly plan stays THE plan: no monthly product sells nothing, yearly
  // included, exactly as before.
  // ONE READ OF THE OFFERING FOR EACH ASK, for both rows it can add (the
  // yearly one and the one payment): → Promise<{ annual, lifetime }>, each
  // true only when the CURRENT offering lists that product by its own id,
  // among its packages or as its own annual / lifetime package. Never
  // rejects: missing, throwing or failing, neither row is listed.
  function _offered(P) {
    return _soon(() => {
      if (typeof P.getOfferings !== "function") return null;
      return P.getOfferings();
    }).then((r) => {
      const cur = r && typeof r === "object" ? r.current : null;
      if (!cur || typeof cur !== "object") return { annual: false, lifetime: false };
      const list = [].concat(Array.isArray(cur.availablePackages) ? cur.availablePackages : [], cur.annual ? [cur.annual] : [], cur.lifetime ? [cur.lifetime] : []);
      const has = (id) => list.some((pk) => !!pk && !!pk.product && pk.product.identifier === id);
      return { annual: has(IAP_PRODUCTS.annual), lifetime: has(IAP_PRODUCTS.lifetime) };
    }, () => ({ annual: false, lifetime: false }));
  }
  // ── THE ONE-PAYMENT ROW (Travis, 22 Oct 2026, for iOS 1.0.9: "the one-time
  // 'lifetime' purchase on the price screen"; "i dont wanna say lifetime") ──
  // The non-consumable comes to Apple's card as a third row, under the
  // monthly one, by the yearly row's rules: ONLY when RevenueCat's current
  // offering lists it (attaching it to "full" and adding it to the offering
  // is Travis's switch, in RevenueCat's dashboard, as NATIVE.md says) AND
  // the store returns it by its own id with a price. It is charged once,
  // today: it has no free days and no eligibility to ask, so an answer that
  // says it has an introductory offer is a product this page cannot
  // describe, and no row. Decided when the card is first answered, within
  // the same PLAN_GRACE_MS; a later answer never adds it under a reading
  // parent (a fresh ask may). No monthly product sells nothing, this row
  // included.
  function _lifePlan(a) {
    const lp = a.lf;
    if (!lp || !a.p || planFree(lp) !== "none") return null;
    return _plan("paid", "", lp, null, false, "lifetime");
  }
  // the yearly Plan for an ask, or null: its own free time and its own
  // eligibility, by monthly's rules (a first year that costs money, or one
  // that cannot be read, is no row at all rather than a guess)
  function _yearPlan(a) {
    const yp = a.yr;
    if (!yp || !a.p) return null;
    // "Best value" compares the yearly price with twelve monthly ones. Beside
    // a one-payment row that costs no more than the year, that tag would be a
    // false comparison on the card ("$59.99/yr · Best value" over "One
    // payment $59.99"), so it goes whenever that row shows and its price is
    // at or under the year's, or the two cannot be compared.
    const life = _lifePlan(a), lifeCheaper = !!life && (function () {
      try {
        const y = Math.round(Number(yp.price) * 100), l = Math.round(Number(a.lf.price) * 100);
        if (!(y > 0 && l > 0 && isFinite(y) && isFinite(l))) return true;
        if (!yp.currencyCode || !a.lf.currencyCode || String(yp.currencyCode) !== String(a.lf.currencyCode)) return true;
        return l <= y;
      } catch (e) { return true; }
    })();
    const intro = planFree(yp), cant = a.eligY === "no" || a.eligY === "none", best = !lifeCheaper && _yearBest(yp, a.p);
    if (typeof intro === "object" && !cant) return _plan("free", "", yp, intro, a.eligY === "yes", "annual", { best });
    if (intro === "none" || cant) return _plan("paid", "", yp, null, false, "annual", { best });
    return null;
  }
  // what a late answer must change before every onLate hears it
  function _planSig(p) {
    const y = p && p.year, l = p && p.life;
    return p ? [p.state, p.kind, p.sure, y ? y.state + "/" + y.sure + "/" + y.best : "-", l ? l.state + "/" + l.price : "-"].join("|") : "";
  }

  // ONE ASK PER PAGE LOAD, and the latest answer is the one every caller
  // gets, "none" included: only { fresh: true } asks the store again.
  //   opts.fresh   ask again (Try again; the app coming back to the front)
  //   opts.onLate  called with the new Plan whenever an answer that arrived
  //                AFTER the promise resolved changes { state, kind, sure }
  //                or the yearly row's { state, sure, best }, or the one-
  //                payment row's { state, price } (_planSig).
  // LATE ANSWERS COUNT. The promise resolves on the limits above, but the
  // three asks stay live: a "not eligible", an "already has it" or the
  // product itself arriving later replaces the answer and tells every
  // onLate, so a sentence the phone knows to be false never stays on screen.
  // Callbacks are kept for the page load, each once; an ask that a later
  // fresh one replaced tells nobody anything.
  let _planAsk = null;
  const _planLate = [];
  function _planStep(a) {
    if (a !== _planAsk) return;
    let plan;
    if (a.own === true) plan = _plan("owned");
    else if (!a.got) { if (!a.timedOut) return; plan = _plan("none", "timeout"); }
    else if (a.failed) plan = _plan("none", "error");
    else if (!a.p) plan = _plan("none", "no-product");
    else {
      const ownIn = a.own !== undefined, eligIn = a.elig !== undefined || a.intro === "none";
      // the yearly row has answered: no row, or its product and its own
      // eligibility (none needed for a product with no offer)
      const yearIn = a.yr !== undefined && (!a.yr || a.eligY !== undefined || planFree(a.yr) === "none");
      // the one-payment row has answered: no row, or its product (it has no eligibility)
      const lifeIn = a.lf !== undefined;
      if (!(ownIn && eligIn && yearIn && lifeIn)) {
        if (!a.graceOver) return;
        // A buyer Apple calls ineligible has subscribed before and may be
        // paying right now: no pay-today price while the sync is in flight.
        if ((a.elig === "no" || (a.yr && a.eligY === "no")) && !ownIn && !a.ownOver) return;
      }
      // too slow to have answered by now: no yearly row, and no one-payment row, for this ask
      if (a.yr === undefined) a.yr = null;
      if (a.lf === undefined) a.lf = null;
      const cant = a.elig === "no" || a.elig === "none";
      if (typeof a.intro === "object" && !cant) plan = _plan("free", "", a.p, a.intro, a.elig === "yes", "monthly", { year: _yearPlan(a), life: _lifePlan(a) });
      else if (a.intro === "none" || cant) plan = _plan("paid", "", a.p, null, false, "monthly", { year: _yearPlan(a), life: _lifePlan(a) });
      // an offer that costs money, or one that cannot be read, for a buyer
      // who may get it: the first charge is unknown, so nothing is stated
      else plan = _plan("none", "no-product");
    }
    if (!a.plan) { a.plan = plan; a.resolve(plan); return; }
    if (_planSig(plan) === _planSig(a.plan)) return;
    a.plan = plan;
    _planLate.slice().forEach((fn) => { try { fn(plan); } catch (e) {} });
  }
  function storePlan(opts) {           // → Promise<Plan>. Never rejects.
    opts = opts || {};
    try { if (typeof opts.onLate === "function" && _planLate.indexOf(opts.onLate) === -1) _planLate.push(opts.onLate); } catch (e) {}
    if (!iapPlugin()) return Promise.resolve(_plan("none", "no-plugin"));
    if (_planAsk && !opts.fresh) return _planAsk.plan ? Promise.resolve(_planAsk.plan) : _planAsk.promise;
    // yr: the yearly product (undefined while asking, null for no row); eligY: its own eligibility
    // lf: the one-payment product (undefined while asking, null for no row)
    const a = { plan: null, got: false, failed: false, p: null, intro: "none", own: undefined, elig: undefined, yr: undefined, eligY: undefined, lf: undefined, timedOut: false, graceOver: false, ownOver: false };
    a.promise = new Promise((resolve) => { a.resolve = resolve; });
    // whoever is still waiting on the ask this one replaces gets this one's answer
    if (_planAsk && !_planAsk.plan) _planAsk.resolve(a.promise);
    _planAsk = a;
    try {
      const id = IAP_PRODUCTS.monthly;
      // the limit first: a store that never finishes setting itself up is caught by the same clock
      a.wait = setTimeout(() => { a.timedOut = true; _planStep(a); }, PLAN_WAIT_MS);
      const got = (p, failed) => {
        if (a.got) return;
        clearTimeout(a.wait);
        a.got = true; a.failed = !!failed;
        // a product with no price to show is not a product
        a.p = (p && String(p.priceString == null ? "" : p.priceString).trim()) ? p : null;
        if (a.p) {
          a.intro = planFree(a.p);
          setTimeout(() => { a.graceOver = true; _planStep(a); }, PLAN_GRACE_MS);
          setTimeout(() => { a.ownOver = true; _planStep(a); }, PLAN_OWN_MS);
        }
        _planStep(a);
      };
      _soon(() => iapProduct("monthly")).then((p) => got(p, false), () => got(null, true));
      _iapOwned(!!opts.fresh).then((own) => { a.own = !!own; _planStep(a); });
      _soon(() => iapConfigure()).then((P) => {
        if (typeof P.checkTrialOrIntroductoryPriceEligibility !== "function") return "unknown";
        return Promise.resolve(P.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [id] })).then((r) => _planElig(r, id));
      }).catch(() => "unknown").then((e) => { a.elig = e; _planStep(a); });
      // THE YEARLY ROW: RevenueCat's offering first; only an offering that
      // lists the yearly product leads to asking the store for it, so with
      // no such offering the asks are exactly the monthly ones above. Its
      // own eligibility is a call of its own, so monthly's never changes.
      const noYear = () => { if (a.yr === undefined) { a.yr = null; _planStep(a); } };
      const noLife = () => { if (a.lf === undefined) { a.lf = null; _planStep(a); } };
      // one read of the offering for both rows (and none at all when the store cannot be set up)
      const offer = _soon(() => iapConfigure()).then((P) => _offered(P).then((o) => ({ P: P, o: o })));
      offer.then(({ P, o }) => {
        if (!o.annual || a.yr !== undefined) return noYear();
        return _soon(() => iapProduct("annual")).then((yp) => {
          if (a.yr !== undefined) return;
          // its own id, by name (iapProduct also takes an unnamed lone
          // product on trust; a yearly row never does), and a price to show
          const good = !!yp && yp.identifier === IAP_PRODUCTS.annual && !!String(yp.priceString == null ? "" : yp.priceString).trim();
          if (!good) return noYear();
          a.yr = yp;
          if (planFree(yp) !== "none") {
            const yid = IAP_PRODUCTS.annual;
            _soon(() => {
              if (typeof P.checkTrialOrIntroductoryPriceEligibility !== "function") return "unknown";
              return Promise.resolve(P.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [yid] })).then((r) => _planElig(r, yid));
            }).catch(() => "unknown").then((e) => { a.eligY = e; _planStep(a); });
          }
          _planStep(a);
        });
      }).catch(noYear);
      // THE ONE-PAYMENT ROW, from the same read: only an offering that lists
      // it leads to asking the store for it, so with none the asks are
      // exactly those above. No eligibility: it has no free days to give.
      offer.then(({ o }) => {
        if (!o.lifetime || a.lf !== undefined) return noLife();
        return _soon(() => iapProduct("lifetime")).then((lp) => {
          if (a.lf !== undefined) return;
          // by its own id (never an unnamed lone product taken on trust) and with a price to show
          const good = !!lp && lp.identifier === IAP_PRODUCTS.lifetime && !!String(lp.priceString == null ? "" : lp.priceString).trim();
          if (!good) return noLife();
          a.lf = lp;
          _planStep(a);
        });
      }).catch(noLife);
    } catch (e) {
      if (!a.plan) { a.plan = _plan("none", "error"); a.resolve(a.plan); }
    }
    return a.promise;
  }

  // Buy the plan a screen was handed. Resolves { ok: true }, or
  // { ok: true, restored: true } when Apple says this Apple ID already bought
  // it and a restore finds Premium (not a new sale: the caller must not count
  // or celebrate it). Rejects with an Error whose .code a page can turn into
  // words with planSay():
  //   cancelled · pending (Ask to Buy) · not-allowed (Screen Time) ·
  //   not-entitled (Apple took the order, Premium did not switch on) ·
  //   offline · unavailable · busy (a purchase is already open) · failed ·
  //   no-plan (nothing to buy was handed in).
  // The numbers are RevenueCat's error codes, which cross the bridge as
  // strings. No time limit on Apple's own sheet: a parent may sit on it.
  function _buyCode(e) {
    if (!e) return "failed";
    const c = String(e.code == null ? "" : e.code), m = String(e.message || "");
    if (e.cancelled || e.userCancelled || c === "1") return "cancelled";
    if (c === "20") return "pending";
    if (c === "3") return "not-allowed";
    if (m === "not-entitled") return "not-entitled";
    if (c === "10" || c === "35") return "offline";
    if (c === "5" || m === "no-purchase-api" || m === "no-iap") return "unavailable";
    if (c === "15") return "busy";
    return "failed";
  }
  function _buyError(code) {
    const err = new Error(code); err.code = code;
    if (code === "cancelled") err.cancelled = true;
    return err;
  }
  // THE LIST HEARS WHEN THE FREE DAYS START (Travis, 5 Oct 2026: "yeah build
  // it"). A parent who gave the app their email (setup's email step, before
  // the price since 13 Oct 2026) is on Sona's email list already. Once a
  // purchase here has gone through, the list is told which kind it was
  // through /api/lead, the one door every grown-up's email uses: "trial"
  // when Apple started the free days, "paid" when it charged at once. The
  // server files them under Started Premium in Resend's contacts and stops
  // the welcome series at once, before RevenueCat's own message arrives
  // (RCHOOK1; Kit, which this used to tag, is gone since 16 Oct 2026).
  // What goes: that email and that one word.
  // Never a child's name or anything about their practice. Never without an
  // email (nobody is asked for one here), and once per kind and address on
  // this phone.
  const PLANTOLD = "sona.plantold.v1";
  function parentEmail() {
    const good = (v) => { const t = typeof v === "string" ? v.trim() : ""; return t.length <= 254 && /^\S+@\S+\.\S+$/.test(t) ? t : ""; };
    let got = "";
    try { got = good(load(PKEY, {}).email); } catch (e) {}
    // the email sits on the profile of the child who was set up first; any child's will do
    if (!got) { try { _kids().list.some((k) => { const p = JSON.parse(localStorage.getItem(k.slot ? PKEY + "@" + k.slot : PKEY) || "{}"); got = good(p.email); return !!got; }); } catch (e) {} }
    if (!got) { try { got = good((getTrial() || {}).email) || good(getSub().email); } catch (e) {} }
    return got;
  }
  function _tellPlan(period, plan) {
    // Apple's own answer first; only when it says nothing, what the card sold
    let what = period === "TRIAL" ? "trial" : (period === "NORMAL" || period === "INTRO" || period === "PREPAID") ? "paid" : "";
    if (!what) { try { what = plan && plan.state === "free" ? "trial" : plan && plan.state === "paid" ? "paid" : ""; } catch (e) {} }
    const email = what ? parentEmail() : "";
    if (!email) return;
    const mark = what + " " + email.toLowerCase();
    try { if (localStorage.getItem(PLANTOLD) === mark) return; localStorage.setItem(PLANTOLD, mark); } catch (e) {}
    try {
      fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ email: email, role: "parent", plan: what, source: what === "trial" ? "app-trial" : "app-paid",
          summary: what === "trial" ? "Started Sona Premium's free days in the app" : "Bought Sona Premium in the app" }) }).catch(() => {});
    } catch (e) {}
  }
  // ── REPORT1: the weekly progress report (Travis, 15 Oct 2026: "i want the
  // setup page to say get the weekly progress report", then, told that nothing
  // sent one, "Build the real report"). Only a household whose grown-up asked
  // for it on setup's email step (profile.weeklyReport, on the profile that
  // holds the address) sends anything: the address, this phone's random device
  // id, and for each child set up here a few numbers for this week and last
  // (a random id for the child, days with a rep, days at the daily goal, the
  // plan's days a week, reps, practice tries among them, the sounds they were
  // in). Never a name, an age, a word, a pass rate or a voice: the email says
  // "Child 1". lib/report.ts keeps nothing until the address confirms this
  // phone from the link it is emailed, then keeps three weeks and sends
  // Monday's email.
  // It is sent once as setup ends (so the confirm email comes while the parent
  // is still holding the phone), then from _goalCheck (a rep, on a practice or
  // game page) at most every 30 minutes, and once more when that page goes to
  // the background, so Sunday evening's practice is in Monday's email. A post
  // that fails is tried again five minutes later. A phone still unconfirmed
  // two weeks on checks in once a day, and after eight weeks stops asking and
  // checks once a month, quietly. Home never sends (it writes nothing). A
  // confirmed phone of an address that unsubscribed is answered "off" and
  // stops sending numbers; it checks once a month, with none, whether the
  // address is back. sona.report.v1 (the device id, the last send, "off" and
  // when, when it first heard "pending" and for which address, "gaveUp") is
  // this phone's own (NO_EXPORT, NO_IMPORT): a phone restored from a backup is
  // a second device. The child's id (profile.reportId) does travel, so after a
  // move the email still shows that child once.
  const REPORTKEY = "sona.report.v1", REPORT_EVERY_MS = 30 * 60 * 1000, REPORT_RETRY_MS = 5 * 60 * 1000;
  // unconfirmed: every 30 minutes for two weeks, then once a day (a late tap
  // on the link still starts the report within a day); a post still answered
  // "pending" after eight weeks makes the phone give up asking, and from then
  // it checks once a month, quietly (no numbers, and the server never sends a
  // link for it), whether the address confirmed after all. "off" is checked
  // every 30 days the same way, with no child's numbers.
  const REPORT_DAY_MS = 24 * 60 * 60 * 1000, REPORT_PEND_MS = 14 * REPORT_DAY_MS, REPORT_GIVEUP_MS = 56 * REPORT_DAY_MS, REPORT_OFF_MS = 30 * REPORT_DAY_MS;
  function _reportState() { try { const v = JSON.parse(localStorage.getItem(REPORTKEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } }
  function _reportSave(v) { try { localStorage.setItem(REPORTKEY, JSON.stringify(v)); } catch (e) {} }
  function _randomHex(bytes) {
    const a = new Uint8Array(bytes);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // The address the report goes to: on the profile of the child whose setup
  // asked for it, or "" when nobody here did. Printable ASCII and at most 120
  // characters, as the server (and its unsubscribe link) take them.
  function reportEmail() {
    let got = "";
    try {
      _kids().list.some((k) => {
        const p = _loadFor(k.slot, PKEY, {}), e = typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
        if (p.weeklyReport === true && e.length <= 120 && /^[\x21-\x7e]+$/.test(e) && /^[^@]+@[^@]+\.[^@]+$/.test(e)) got = e;
        return !!got;
      });
    } catch (e) {}
    return got;
  }
  // One child's numbers for the week starting mon (a local Monday key), read
  // from the same ledgers as Home's corner and Progress, whoever is active.
  function _reportKid(slot, mon) {
    const p = _loadFor(slot, PKEY, {}), all = _repDays(null, false, slot), prac = _repDays(null, true, slot);
    const stamps = _loadFor(slot, GOALKEY, {}), pd = _loadFor(slot, GKEY, DEFAULT_PROGRESS).practiceDays || {}, t = today();
    // the child's random id, made once and kept on the profile (so a backup carries it)
    let id = typeof p.reportId === "string" && /^[a-f0-9]{16}$/.test(p.reportId) ? p.reportId : "";
    if (!id) { id = _randomHex(8); p.reportId = id; saveFor(slot, PKEY, p); }
    const parts = mon.split("-"), wd = [];
    for (let i = 0; i < 7; i++) wd.push(_localDay(new Date(+parts[0], +parts[1] - 1, +parts[2] + i).getTime()));
    let d = 0, g = 0, r = 0, pr = 0;
    wd.forEach((k) => {
      const n = all[k] || 0; if (n > 0) d++;
      r += n; pr += prac[k] || 0;
      if (k <= t && (!!stamps[k] || (k < GOAL_SINCE && !!pd[k]))) g++;
    });
    const s = r > 0 ? ALL_SOUNDS.filter((S) => { const by = _repDays(S, false, slot); return wd.some((k) => (by[k] || 0) > 0); }) : [];
    // the plan's days a week ONLY when a grown-up picked them (the profile
    // holds one: Settings, Progress, or setup before 22 Oct 2026, when it
    // stopped asking): never goalDays()'s default 4, which the email would
    // call "your plan" to a family that never chose it
    const n = parseInt(p.weeklyGoal, 10), out = { i: id, d: d, g: g, r: r, p: pr, s: s };
    if (n === 3 || n === 4 || n === 5 || n === 7) out.gw = n;
    return out;
  }
  let _reportBusy = false, _reportDirty = false, _reportAgain = false, _reportHooked = false;
  function reportSync(force) {
    const email = reportEmail();
    if (!email) return Promise.resolve(false);
    if (_reportBusy) { if (force) _reportAgain = true; return Promise.resolve(false); }
    const st = _reportState(), now = Date.now(), prev = st.at;
    // pend, off and gaveUp belong to one address: a corrected address starts fresh
    const off = st.off === email, quiet = st.gaveUp === email, pend = st.pendFor === email && st.pend > 0 && st.pend <= now ? now - st.pend : 0;
    const every = off || quiet ? REPORT_OFF_MS : pend > REPORT_PEND_MS ? REPORT_DAY_MS : REPORT_EVERY_MS;
    if ((!force || every > REPORT_EVERY_MS) && st.at > 0 && st.at <= now && now - st.at < every) return Promise.resolve(false);
    if (!/^[a-f0-9]{32}$/.test(st.dev || "")) st.dev = _randomHex(16);
    st.at = now; _reportSave(st);
    let list = [];
    try { list = _kids().list.filter((k) => { const p = _loadFor(k.slot, PKEY, {}); return p.onboarded === true && p.role !== "slp"; }).slice(0, 8); } catch (e) {}
    // a check on an address that said "off", or one the phone gave up on, carries no child's numbers
    const weeks = [-1, 0].map((o) => { const wk = _mondayKey(o); return { wk: wk, kids: off || quiet ? [] : list.map((k) => _reportKid(k.slot, wk)) }; });
    _reportBusy = true; _reportDirty = false; _reportAgain = false;
    let sent;
    try {
      sent = fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify(quiet ? { email: email, dev: st.dev, weeks: weeks, quiet: true } : { email: email, dev: st.dev, weeks: weeks }) })
        .then((r) => r.json())
        .then((j) => {
          const s2 = _reportState();
          // only a plain "ok" ends "off"; "pending" never does (the server
          // gives an unconfirmed phone of an unsubscribed address "pending" too)
          if (j && j.off) { s2.off = email; s2.offAt = Date.now(); delete s2.pend; delete s2.pendFor; delete s2.gaveUp; } // "off" proves the phone was confirmed
          else if (j && j.ok && j.pending) {
            if (s2.off !== email) {
              if (s2.pendFor !== email || !(s2.pend > 0)) { s2.pend = Date.now(); s2.pendFor = email; }
              else if (Date.now() - s2.pend > REPORT_GIVEUP_MS) s2.gaveUp = email; // still not confirmed eight weeks on
            }
          }
          else if (j && j.ok) { delete s2.off; delete s2.offAt; delete s2.pend; delete s2.pendFor; delete s2.gaveUp; }
          _reportSave(s2);
          return !!(j && j.ok);
        });
    } catch (e) { sent = Promise.resolve(false); }
    return sent.catch(() => false).then((ok) => {
      _reportBusy = false;
      if (!ok) {
        // offline, a 503 or a 429: these numbers still have to go; try again in five minutes
        _reportDirty = true;
        const s3 = _reportState(); s3.at = Math.max(prev > 0 && prev <= now ? prev : 0, now - every + REPORT_RETRY_MS); _reportSave(s3);
      } else if (_reportAgain && _reportDirty) reportSync(true);
      _reportAgain = false;
      return ok;
    });
  }
  function _reportTouch() {
    if (!reportEmail()) return;
    _reportDirty = true;
    if (!_reportHooked) {
      _reportHooked = true;
      const flush = () => { if (_reportDirty) reportSync(true); };
      window.addEventListener("pagehide", flush);
      document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
    }
    reportSync(false);
  }
  function buyPlan(plan) {
    let p = null; try { p = plan && (plan.state === "free" || plan.state === "paid") && plan._p; } catch (e) {}
    if (!p) return Promise.reject(_buyError("no-plan"));
    return _soon(() => iapPurchase(plan.kind, p)).then((r) => { _tellPlan(r && r.period, plan); _trialRemindBought(r, plan); return { ok: true }; }, (e) => {
      if (e && !e.cancelled && String(e.code) === "6") {
        // "already purchased": the sale is Apple's news that they own it
        return _soon(() => iapRestore()).then((active) => {
          if (active) return { ok: true, restored: true };
          throw _buyError("not-entitled");
        }, () => { throw _buyError("not-entitled"); });
      }
      throw _buyError(_buyCode(e));
    });
  }

  // "Does this family still owe the price?", after asking the store once.
  // Setup calls it as the parent leaves the ready screen, so a paying family
  // who reinstalled goes on to the microphone instead of to a price. False at
  // once for anyone setup would not send to the price anyway. Otherwise the
  // answer is trialFirst() read when the store has spoken or `ms` has passed,
  // whichever is first: the store's "yes" has by then written the
  // subscription, and a slow store means the price screen (which runs the
  // same ask) decides. Never rejects.
  function setupWall(ms) {
    let due = false; try { due = trialFirst(); } catch (e) {}
    if (!due) return Promise.resolve(false);
    return new Promise((resolve) => {
      let done = false, t = 0;
      const end = () => {
        if (done) return; done = true; clearTimeout(t);
        let owes = false; try { owes = trialFirst(); } catch (e) {}
        resolve(owes);
      };
      t = setTimeout(end, (typeof ms === "number" && ms >= 0) ? ms : WALL_WAIT_MS);
      _iapOwned(false).then(end, end);
    });
  }

  // ── NOTIFY1: one reminder the day before the free trial ends ──────────────
  // Travis, 22 Oct 2026: "can we add push notifications and have that be a
  // step in the onboarding where we ask them to turn it on to notify them a
  // day before their trial ends". It is a LOCAL notification: this phone asks
  // iOS to show it at a moment, through Sona's own plugin (SonaSpeech's
  // notifyStatus, notifyAsk, notifySchedule, notifyCancel, iOS 1.0.9 and
  // later). No server sends it and nothing leaves the phone for it: no device
  // token, no address, no account, no event. The words are fixed here and
  // name nobody (never a child's name, never a price); they are Travis's and
  // Rachel's to change.
  //   - Asked once, by setup's reminder screen (notifyAsk: iOS's own Allow
  //     box), only while iOS has never been asked (notifyState() "prompt";
  //     setup waits on notifyRefresh() for iOS's real answer first).
  //   - Set only once a free trial has really started: AT ONCE from the
  //     purchase itself (buyPlan: the end in the purchase's own record, else
  //     the store's own free time from now), because the price page leaves
  //     1.2 s after a sale; then corrected from RevenueCat's record when the
  //     purchase named no end. Only when that moment is more than an hour away.
  //   - Checked again once a day on an app page (trialReminderSync), never on
  //     Home ("Home only reads": Home calls nothing of this block): set afresh
  //     while the trial is on (so a longer or moved trial follows), and taken
  //     back once no free trial is on any more (it became a paid plan, ended,
  //     or the parent already cancelled it: then the reminder has nothing left
  //     to tell). A store that does not answer is asked again at most once an
  //     hour, not on every page.
  //   - A purchase clears the day's mark (the next page asks again), and no
  //     check acts on a store answer it asked for before the latest purchase
  //     (the price page's own check, still waiting when the parent bought,
  //     would otherwise take the new reminder back).
  // Optional like every new native call: a build without the four methods, a
  // bridge that answers them "not implemented", a browser, or a bridge that
  // throws or hangs changes nothing anywhere, and nothing waits on it but the
  // reminder screen's own tap. sona.notify.v1 ({ state, asked, arm, end,
  // sync, tried }) is true of this phone's iOS setting and of what iOS holds
  // for it, so it is on NO_EXPORT and NO_IMPORT.
  const NOTIFYKEY = "sona.notify.v1";
  const TRIAL_REMIND_ID = "sona-trial-end";
  const TRIAL_REMIND = { title: "Sona", body: "Your free trial ends tomorrow." };   // Travis's and Rachel's words to change; never a name
  const NOTIFY_DAY_MS = 24 * 60 * 60 * 1000;
  const TRIAL_REMIND_LEAD_MS = NOTIFY_DAY_MS;         // the day before
  const TRIAL_REMIND_MIN_MS = 60 * 60 * 1000;         // a reminder less than an hour away is not set
  const NOTIFY_SYNC_MS = NOTIFY_DAY_MS;               // trialReminderSync asks the store at most once a day
  const NOTIFY_RETRY_MS = 60 * 60 * 1000;             // …and, after a store that did not answer, at most once an hour
  const NOTIFY_ASK_MS = 60000;                        // a bridge that never answers iOS's box does not hold setup for good
  const NOTIFY_STATUS_MS = 3000, NOTIFY_INFO_MS = 8000;
  const NOTIFY_FIELDS = ["state", "asked", "arm", "end", "sync", "tried"];
  // A bridge that answers a method this build does not have with "not
  // implemented" (a Capacitor proxy in front of an older build answers every
  // name it is asked for) is no build that can remind: once one of the four
  // says so, none is called again on this page and notifyAvailable() is false,
  // as the mic's _nm.broken does for micOpen.
  let _notifyBroken = false;
  // Every purchase on this page counts one (the hook in buyPlan). A check
  // that asked the store before the latest purchase heard about the phone
  // before it: what it heard sets nothing, takes nothing back, and marks
  // nothing checked.
  let _notifyBuys = 0;
  function _notifyPlugin() {
    if (_notifyBroken) return null;
    const P = speechPlugin();
    return (P && typeof P.notifyStatus === "function" && typeof P.notifyAsk === "function"
      && typeof P.notifySchedule === "function" && typeof P.notifyCancel === "function") ? P : null;
  }
  function _notifyGone(e) {
    try { if (String(e && e.code).toUpperCase() === "UNIMPLEMENTED" || /not implemented/i.test(String(e && e.message))) _notifyBroken = true; } catch (e2) {}
  }
  function _notifyCall(fn) { return _soon(fn).catch((e) => { _notifyGone(e); throw e; }); }
  // True only inside an app build whose plugin carries all four methods (and
  // has not answered one of them "not implemented" on this page).
  function notifyAvailable() { try { return !!_notifyPlugin(); } catch (e) { return false; } }
  function _notifyLoad() { try { const v = JSON.parse(localStorage.getItem(NOTIFYKEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } }
  function _notifySave(patch) {
    try {
      const v = _notifyLoad(), keep = {};
      Object.keys(patch).forEach((k) => { if (patch[k] == null) delete v[k]; else v[k] = patch[k]; });
      NOTIFY_FIELDS.forEach((k) => { if (v[k] != null) keep[k] = v[k]; });
      const out = JSON.stringify(keep), had = localStorage.getItem(NOTIFYKEY);
      // the same answer read again on every page is not written again, and
      // clearing marks on a phone that never had any writes nothing
      if (had !== out && !(had == null && out === "{}")) localStorage.setItem(NOTIFYKEY, out);
    } catch (e) {}
  }
  function _notifyWithin(p, ms, dflt) {
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(dflt), ms);
      p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(dflt); });
    });
  }
  // iOS's word, in this file's: "provisional" (quiet delivery, which nothing
  // in Sona asks for) is still "prompt", because a real ask still shows the box
  function _notifyWord(raw) { return raw === "granted" ? "granted" : raw === "denied" ? "denied" : (raw === "prompt" || raw === "provisional") ? "prompt" : ""; }
  let _notifyBusy = null, _notifyLooked = false;
  function _notifyRefresh() {          // → Promise<state>, never rejects
    const P = _notifyPlugin();
    if (!P) return Promise.resolve("unavailable");
    if (_notifyBusy) return _notifyBusy;
    _notifyLooked = true;
    _notifyBusy = _notifyWithin(_notifyCall(() => P.notifyStatus()), NOTIFY_STATUS_MS, null).then((r) => {
      _notifyBusy = null;
      const st = _notifyWord(r && r.status);
      if (st) _notifySave({ state: st });
      return notifyState();
    });
    return _notifyBusy;
  }
  // iOS's answer, read afresh: notifyState() alone answers "prompt" on a page
  // that has not heard from iOS yet (a guess, true of a fresh install), so a
  // screen that decides from it (setup's reminder ask) waits on this first.
  // → a Promise of notifyState()'s word once iOS has answered (the one already
  // on its way, if any), or after NOTIFY_STATUS_MS what was known; never
  // rejects. "unavailable" for a build that cannot remind.
  function notifyRefresh() { try { return _notifyRefresh(); } catch (e) { return Promise.resolve("unavailable"); } }
  // "granted" | "denied" | "prompt" | "unavailable", from what iOS last said
  // (read again in the background on a page's first ask). A phone that never
  // told this page anything is "prompt": a fresh install, which is the only
  // way an app has no notification answer yet.
  function notifyState() {
    if (!notifyAvailable()) return "unavailable";
    if (!_notifyLooked) _notifyRefresh();
    const st = _notifyLoad().state;
    return st === "granted" || st === "denied" ? st : "prompt";
  }
  // iOS's own Allow box (once: an answered setting resolves at once). → a
  // Promise of "granted" | "denied" | "unavailable"; never rejects. A bridge
  // that refuses is asked what iOS now says; one that never answers lets the
  // screen go on after NOTIFY_ASK_MS, and its late answer is still kept.
  function notifyAsk() {
    const P = _notifyPlugin();
    if (!P) return Promise.resolve("unavailable");
    _notifySave({ asked: Date.now() });
    const ask = _notifyCall(() => P.notifyAsk()).then((r) => {
      const st = r && r.granted === true ? "granted" : "denied";
      _notifySave({ state: st });
      return st;
    }, () => _notifyRefresh().then((st) => st === "granted" || st === "denied" ? st : "unavailable"));
    return _notifyWithin(ask, NOTIFY_ASK_MS, "unavailable");
  }
  // Will Sona really remind this family? With no plan: notifications are
  // allowed on a build that can set one. With a plan (a price screen's
  // picked row): also, that row is a free trial the store is SURE of
  // (plan.sure: a row that only may be free, "Only new subscribers get 3 days
  // free. Otherwise Apple charges $9.99 today.", states nothing as fact, so
  // it promises no reminder either), whose reminder can be set: its end more
  // than a day and an hour away.
  function trialReminderOn(plan) {
    try {
      if (!notifyAvailable() || notifyState() !== "granted") return false;
      if (plan === undefined) return true;
      if (!plan || plan.state !== "free" || plan.sure !== true) return false;
      const d = planBillDate(plan);
      return !!d && d.getTime() - TRIAL_REMIND_LEAD_MS > Date.now() + TRIAL_REMIND_MIN_MS;
    } catch (e) { return false; }
  }
  // Set the reminder for a trial that ends at endMs: a day before, if that is
  // more than an hour away. → Promise<boolean> (set), never rejects. Arming
  // again replaces the one iOS holds (one id), so it is never sent twice.
  function trialReminderArm(endMs) {
    const P = _notifyPlugin(), end = Number(endMs), now = Date.now();
    if (!P || !isFinite(end) || !(end > 0) || !trialReminderOn()) return Promise.resolve(false);
    const at = Math.round(end - TRIAL_REMIND_LEAD_MS);
    if (!(at > now + TRIAL_REMIND_MIN_MS) || at > now + 400 * NOTIFY_DAY_MS) return Promise.resolve(false);   // the plugin refuses past 400 days too
    return _notifyWithin(_notifyCall(() => P.notifySchedule({ id: TRIAL_REMIND_ID, at: at, title: TRIAL_REMIND.title, body: TRIAL_REMIND.body }))
      .then((r) => !(r && r.scheduled === false)), NOTIFY_STATUS_MS, false)
      .then((ok) => { if (ok) _notifySave({ arm: at, end: Math.round(end) }); return ok; });
  }
  // gen: the purchase count the caller acted on. A purchase that set the
  // reminder while this took it back keeps its own note of what is set.
  function _trialReminderCancel(gen) {
    const P = _notifyPlugin();
    if (!P) return Promise.resolve(false);
    return _notifyWithin(_notifyCall(() => P.notifyCancel({ id: TRIAL_REMIND_ID })).then(() => true), NOTIFY_STATUS_MS, false)
      .then((ok) => { if (ok && (gen === undefined || gen === _notifyBuys)) _notifySave({ arm: null, end: null }); return ok; });
  }
  // What RevenueCat says of the free trial, from the plain fields of its own
  // entitlement record (periodType, willRenew, expirationDateMillis or
  // expirationDate): { on, end } a free trial that will renew (end 0 when it
  // gives none); { off } no trial: no Premium, a paid period (paid), or a
  // trial the parent already cancelled (cancelled); { unsure } Premium whose
  // period it does not name. null: the store did not answer.
  function _trialOf(info) {
    try {
      const c = info && (info.customerInfo || info);
      const f = c && c.entitlements && c.entitlements.active && c.entitlements.active[IAP_ENTITLEMENT];
      if (!f) return { off: true };
      const period = String(f.periodType || "").toUpperCase();
      if (!period) return { unsure: true };
      if (period !== "TRIAL") return { off: true, paid: true };
      if (f.willRenew === false) return { off: true, cancelled: true };
      let end = Number(f.expirationDateMillis);
      if (!(end > 0)) end = Date.parse(String(f.expirationDate || ""));
      return { on: true, end: end > 0 ? end : 0 };
    } catch (e) { return null; }
  }
  function _trialNow() {               // → Promise<_trialOf answer, or null when the store did not answer>
    if (!iapAvailable()) return Promise.resolve(null);
    return _notifyWithin(iapConfigure().then((P) => P.getCustomerInfo()).then(_trialOf), NOTIFY_INFO_MS, null);
  }
  // Once a day on an app page (forced: now). → Promise of "armed", "near"
  // (a trial whose reminder moment has gone), "kept" (a trial with no end
  // given, or Premium whose period RevenueCat does not name: what is set
  // stays), "cancelled", "off" (notifications not allowed: the store is not
  // asked), "later" (asked today already, or the store did not answer within
  // the last hour), "stale" (the store answered a question asked before the
  // latest purchase: nothing done), "error" (no answer: asked again an hour
  // later) or "unavailable".
  let _notifySyncP = null, _notifySyncGen = -1;
  function trialReminderSync(force) {
    if (!notifyAvailable() || !iapAvailable()) return Promise.resolve("unavailable");
    const k = _notifyLoad(), now = Date.now();
    const last = Number(k.sync) || 0, tried = Number(k.tried) || 0;
    if (!force && last > 0 && last <= now && now - last < NOTIFY_SYNC_MS) return Promise.resolve("later");
    if (!force && tried > 0 && tried <= now && now - tried < NOTIFY_RETRY_MS) return Promise.resolve("later");
    // one check at a time, but never one that asked before the latest purchase
    if (_notifySyncP && _notifySyncGen === _notifyBuys) return _notifySyncP;
    const gen = _notifyBuys, fresh = () => gen === _notifyBuys;
    const p = _notifyRefresh().then((st) => {
      if (st !== "granted") return "off";
      return _trialNow().then((t) => {
        if (!fresh()) return "stale";
        if (!t) { _notifySave({ tried: Date.now() }); return "error"; }
        _notifySave({ sync: Date.now(), tried: null });
        if (t.off) return _trialReminderCancel(gen).then(() => "cancelled");
        if (!t.on || !t.end) return "kept";
        return trialReminderArm(t.end).then((ok) => {
          if (ok) return "armed";
          // too late to remind for this end. One set for an end more than an
          // hour away from it (a trial that moved) would speak of the wrong
          // day, so it goes; one set at purchase from the store's own free
          // time (seconds off RevenueCat's) stays, to be shown as planned.
          const was = Number(_notifyLoad().end) || 0;
          if (fresh() && was && Math.abs(was - t.end) > TRIAL_REMIND_MIN_MS) return _trialReminderCancel(gen).then(() => "near");
          return "near";
        });
      });
    }).catch(() => "error").then((r) => { if (_notifySyncP === p) _notifySyncP = null; return r; });
    _notifySyncP = p; _notifySyncGen = gen;
    return p;
  }
  // The one hook in buyPlan (r: iapPurchase's answer, { ok, period, end }).
  // The purchase is counted and the day's mark cleared first, whatever was
  // bought. A purchase that started a free trial (Apple's period TRIAL, or,
  // when Apple's answer names no period, a card that was SURE it sold free
  // days, plan.sure: the list's plan post decides "trial" on the card alone,
  // but a reminder states it as fact) sets the reminder AT ONCE, before the
  // price page leaves: for the end in the purchase's own record, else the
  // store's own free time from now (planBillDate). Only when that record
  // named no end is RevenueCat asked, once, to correct the moment (or, for a
  // paid period or a trial already cancelled, take it back; a record that has
  // not caught up with the purchase changes nothing). Never waited on, never
  // throws.
  function _trialRemindBought(r, plan) {
    try {
      const gen = ++_notifyBuys;
      if (!notifyAvailable()) return;
      _notifySave({ sync: null, tried: null });
      const period = String((r && r.period) || "");
      if (period === "NORMAL" || period === "INTRO" || period === "PREPAID") return;   // charged: no free days to tell of
      if (!trialReminderOn()) return;
      const end = Number(r && r.end) > 0 ? Number(r.end) : 0;
      const sold = !!plan && plan.state === "free" && plan.sure === true;
      const guess = planBillDate(plan), g = guess ? guess.getTime() : 0;
      const first = period === "TRIAL" ? (end || g) : (!period && sold) ? g : 0;
      if (first) trialReminderArm(first);
      if (period === "TRIAL" && end) return;          // the purchase's own record named the end: nothing to correct
      _trialNow().then((t) => {
        if (gen !== _notifyBuys || !t) return;
        if (t.on && t.end) { if (Math.abs(t.end - first) > 60000) trialReminderArm(t.end); }
        else if (first && (t.paid || t.cancelled)) _trialReminderCancel(gen);
      }).catch(() => {});
    } catch (e) {}
  }
  // On an app page that can set one, Home excepted: iOS's answer is read as
  // the page opens (setup decides whether to ask from it), and the trial is
  // checked a moment later, and again whenever the app comes back to the
  // front (a parent who changed the setting in iOS Settings, a trial that
  // ended while Sona sat in the background); the store is asked at most once
  // a day (once an hour after it did not answer). Home only reads (CLAUDE.md,
  // the daily adventure and the Trophy Road): it neither asks iOS nor the
  // store here, and writes nothing of this block.
  function _notifyHome() { try { return /^\/today(\.html)?$/i.test(location.pathname); } catch (e) { return false; } }
  try {
    if (notifyAvailable() && !_notifyHome()) {
      _notifyRefresh();
      setTimeout(() => { trialReminderSync(false); }, 1500);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) { _notifyRefresh(); trialReminderSync(false); } });
    }
  } catch (e) {}

  // PLAN-WORDS-BEGIN
  // EVERY SENTENCE APPLE'S CARD MAY SHOW LIVES BETWEEN THESE TWO MARKERS.
  // The plan screen types no price, no day count and no "free" of its own:
  // it paints what planWords() returns for the Plan storePlan() handed it,
  // and its status line from planSay(). So a claim about money can only be
  // changed here, where the tests read every state at once (planwordstest).
  // Plain text only: a store string never becomes markup.
  //
  // What the words keep, whatever the store answers:
  //   - every figure is the store's own price string, never a typed one;
  //   - "paid" and "none" never say "free"; "none" and the waiting state
  //     show no figure at all;
  //   - when the phone is not sure this buyer gets the free time
  //     (plan.sure false), no row states "nothing to pay today" or a billing
  //     day as plain fact: each says "new subscribers", and the note says
  //     what Apple does otherwise;
  //   - "cancel at least 24 hours before" is Apple's own measure. The row
  //     names a day with no time, so "a day before" could be read as the
  //     evening before, which is too late;
  //   - the two rows are Today and the billing day, and NOTHING ELSE. No
  //     sentence here promises a message before the charge, with ONE
  //     exception (Travis, 22 Oct 2026, the step in setup that asks iPhone
  //     for its Allow box): `headsUp`, the one line under the button, only
  //     when the page says this phone really can and will show its own
  //     heads-up for the picked row (o.headsUp: the page asks sona.js's
  //     trial heads-up block) and only on a free row. Without that, nothing: the message
  //     Sona's server sends since 16 Oct 2026 reaches only a parent who gave
  //     the app an address, so a promise here would be false for the rest.
  //     planwordstest holds the line to exactly those cases, word for word;
  //   - the one-payment row (kind "lifetime") is charged once, today: its
  //     words never say "free", never "Best value", and never the store's
  //     word for it (Travis: "i dont wanna say lifetime"). It says "One
  //     payment" and "No subscription", and its figure is the store's.
  const PLAN_CANCEL = "Settings\u00a0→\u00a0Subscriptions";   // no-break spaces: the arrow never starts a line
  // The day the first charge falls, for a plan with free time. Apple's free
  // days are exact 24-hour days from the purchase; months and years land on
  // the same day of the month, or its last day (31 Jan + 1 month).
  function planBillDate(plan, now) {
    try {
      const f = plan && plan.state === "free" && plan.free;
      if (!f || !(f.n >= 1)) return null;
      const from = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();
      if (f.unit === "day") return new Date(from.getTime() + f.n * 86400000);
      if (f.unit !== "month" && f.unit !== "year") return null;
      const d = new Date(from.getTime()), day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + (f.unit === "year" ? 12 * f.n : f.n));
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      return d;
    } catch (e) { return null; }
  }
  // plan: what storePlan() resolved, or null/undefined while it is asking,
  // or that answer's yearly row (plan.year) or one-payment row (plan.life):
  // each row's words are its own plan's, and the button, the check line and
  // the small print are the words of whichever row is picked.
  // o.freeVersion: this family already has daily practice (the free
  // version), so Premium is not what opens it. o.now: the clock, for tests.
  // o.headsUp: true only when the page has been told this phone will show
  // its own heads-up the day before this row's free days end (see above).
  const PLAN_HEADS_UP = "We'll remind you the day before it ends.";   // Travis's and Rachel's words to change
  function planWords(plan, o) {
    o = o || {};
    const WHAT = o.freeVersion ? "Every game and every book." : "Daily practice, every game and every book.";
    const w = {
      state: "wait", title: "Sona Premium", tag: "", price: "", what: WHAT,
      rows: [], note: "", noteFirst: false, noteLast: false,
      name: "Sona Premium", sub: "", amount: "", check: "",
      button: "Checking the App Store…", act: "wait",
      header: "Sona Premium: " + WHAT.charAt(0).toLowerCase() + WHAT.slice(1),
      none: null, headsUp: "",
    };
    if (plan == null) return w;
    if (plan.state === "owned") { w.state = "owned"; w.name = ""; w.what = ""; w.button = ""; w.act = ""; w.header = ""; return w; }
    const P = String(plan.price || ""), per = String(plan.per || "");
    const FREE = (plan.state === "free" && plan.free && plan.free.text) ? String(plan.free.text) : "";
    if (!P || !per || !(plan.state === "paid" || FREE)) {
      // nothing to sell, or a plan too broken to describe: no figure, one way on
      const reach = plan.state === "none" && (plan.why === "timeout" || plan.why === "error");
      w.state = "none"; w.name = ""; w.what = ""; w.button = "Try again"; w.act = "retry";
      w.none = reach ? { title: "We couldn't reach the App Store.", text: "Check your connection, then try again." }
                     : { title: "Sona Premium can't be bought right now.", text: "Please try again in a little while." };
      w.header = w.none.title;
      return w;
    }
    // THE ONE-PAYMENT ROW (22 Oct 2026; every word Travis's to change): its
    // name, one line under it, the store's price with no period, then for the
    // pick one check line, the button and the small print. A one payment
    // with free days is not a plan this card can describe (storePlan never
    // hands one out): nothing to sell.
    if (plan.kind === "lifetime" || per === "once") {
      if (plan.state !== "paid") { w.state = "none"; w.name = ""; w.what = ""; w.button = "Try again"; w.act = "retry"; w.none = { title: "Sona Premium can't be bought right now.", text: "Please try again in a little while." }; w.header = w.none.title; return w; }
      w.state = "paid"; w.title = "Get Sona Premium";
      w.name = "One payment"; w.sub = "Yours to keep. No subscription."; w.amount = P;
      w.price = "One payment of " + P + ".";
      w.check = "One payment \u00b7 No subscription";
      w.note = "One payment of " + P + ". No subscription."; w.noteLast = true;   // small print, under the button
      w.button = "Get Sona Premium — " + P; w.act = "buy";
      w.header = "Sona Premium: one payment of " + P + ".";
      return w;
    }
    const PP = P + " a " + per;
    // THE ROW (Travis, 6 Oct 2026, with a reference paywall: "too many words
    // ... I don't want it to say Friday October 9th I just want it to say
    // three days"): the plan's name, one short line under it, the store's
    // price on the right, and one check line. No dated rows.
    const SHORT = { month: "mo", year: "yr", week: "wk" };
    w.name = per === "month" ? "Monthly" : per === "year" ? "Yearly" : "Sona Premium";
    w.amount = P + "/" + (SHORT[per] || per);
    w.sub = ""; w.check = "Subscription auto-renews"; w.noteLast = false;
    w.act = "buy";
    // the yearly row's one tag, and only when the store's own numbers make it
    // true (Plan.best): never a saving in dollars, never a ratio (19 Oct 2026)
    w.tag = plan.best === true && per === "year" ? "Best value" : "";
    if (plan.state === "paid") {
      w.state = "paid"; w.title = "Get Sona Premium";
      w.price = PP + ", charged today.";
      w.sub = "Charged today";
      w.note = "Charged to your Apple ID today, then every " + per + ". Renews unless canceled in " + PLAN_CANCEL + ".";
      w.button = "Subscribe — " + PP;
      w.header = "Sona Premium: " + PP + ", charged today.";
      return w;
    }
    const UNIT = plan.free.unit ? String(plan.free.unit) : "";
    const N = parseInt(FREE, 10);
    const TRIAL = (N > 0 && UNIT) ? N + "-" + UNIT + " free trial" : FREE + " free";
    w.state = "free";
    w.price = FREE + " free, then " + PP + ".";          // Travis's line (5 Oct 2026), built from the store's two answers
    w.button = "Start practicing!";                      // Travis, 6 Oct 2026; the free days and the price are on the row and under the button
    if (plan.sure === true) {
      w.title = "Start Sona Premium with " + FREE + " free";
      w.sub = TRIAL;
      w.check = "No payment today \u00b7 Subscription auto-renews";
      w.note = w.price + " Cancel anytime.";
      w.noteLast = true;                                   // small print, under the button
      w.header = "Sona Premium: " + FREE + " free, then " + PP + ".";
    } else {
      w.title = "Sona Premium: " + FREE + " free for new subscribers";
      w.sub = TRIAL + " for new subscribers";
      w.note = "Only new subscribers get " + FREE + " free. Otherwise Apple charges " + P + " today. Apple shows your exact terms before you confirm. Cancel anytime in " + PLAN_CANCEL + ".";
      w.noteFirst = true;                                  // directly under the row, above the button
      w.header = "Sona Premium: " + FREE + " free for new subscribers, then " + PP + ".";
    }
    // a free row only, and only when the page says this phone will show it
    if (o.headsUp === true) w.headsUp = PLAN_HEADS_UP;
    return w;
  }
  // The card's one status line, by code (buyPlan's codes, and the page's own
  // moments). "Nothing was charged" is never said: after a failure the phone
  // does not know that. Cancelled and busy say nothing at all.
  const PLAN_SAY = {
    opening: "Opening the App Store…",
    slow: "Still waiting for the App Store. If its window has closed, tap Restore Purchases.",
    pending: "Waiting for approval. Sona Premium opens once the purchase is approved.",
    "not-allowed": "Purchases are turned off on this device. Check Screen Time in Settings.",
    "not-entitled": "Apple has your order, but Premium hasn't switched on yet. Tap Restore Purchases below.",
    offline: "We couldn't reach the App Store. Check your connection and try again.",
    unavailable: "Sona Premium can't be bought right now. Please try again in a little while.",
    failed: "That didn't go through. If Apple took a payment, tap Restore Purchases.",
    bought: "Sona Premium is on. Welcome to Sona!",
    owned: "You already have Sona Premium. Welcome back!",
    restoring: "Checking your purchases…",
    restored: "Restored ✓ — welcome back!",
    "no-purchases": "No purchases found on this Apple ID.",
    "restore-failed": "Couldn't reach the App Store — try again in a moment.",
  };
  function planSay(code) {
    return (typeof code === "string" && Object.prototype.hasOwnProperty.call(PLAN_SAY, code)) ? PLAN_SAY[code] : "";
  }
  // PLAN-WORDS-END

  // ── SETUP: THE MARKER THAT BRINGS A BUYER BACK, AND THE TWO ANSWERS ──
  // (Travis, 4–5 Oct 2026: "number B would be good … you can do a full
  // reset".) Setup now saves the child on its ready screen and shows the
  // price while the grown-up still holds the phone; the microphone and the
  // hand-off come after.
  //
  // THE MARKER (sessionStorage, this tab only) says "this tab left setup's
  // ready screen for this child": the price screen reads it to send a buyer
  // back to setup, and setup reads it to open on the microphone instead of
  // the hello. IT PICKS A SCREEN AND GRANTS NOTHING. Whether a family owes
  // the price is always re-read from trialFirst() (stored entitlement), so a
  // forged marker opens a microphone step and not one game. It dies with the
  // tab or the app, after two hours, or when another child is active.
  const SETUPAFTER = "sona.setupafter.v1";
  const SETUPAFTER_MS = 2 * 60 * 60 * 1000;
  function setupAfterMark() {
    try { sessionStorage.setItem(SETUPAFTER, JSON.stringify({ at: Date.now(), kid: _slot() })); return true; } catch (e) { return false; }
  }
  // Pure: it removes nothing, so asking twice gives the same answer twice.
  function setupAfter() {
    try {
      const m = JSON.parse(sessionStorage.getItem(SETUPAFTER) || "null");
      if (!m || typeof m !== "object" || typeof m.at !== "number" || typeof m.kid !== "string") return false;
      const age = Date.now() - m.at;
      if (!(age >= 0 && age < SETUPAFTER_MS)) return false;
      if (m.kid !== _slot()) return false;
      return !!getProfile().onboarded;
    } catch (e) { return false; }
  }
  function setupAfterClear() { try { sessionStorage.removeItem(SETUPAFTER); } catch (e) {} }

  // THE TWO ANSWERS ("What brings you to Sona?", "How does practice go at
  // home now?") STAY ON THIS PHONE. The screens that ask say so, so it has to
  // be true by construction: ONE household key, holding one fixed id per
  // question or "" for a skip. Not in the profile and not in PER_KID (so
  // sendProgress, which reads the profile, cannot carry it to a clinician),
  // not in a backup (NO_EXPORT) and not let in by one (NO_IMPORT), and no
  // event, lead, address, title or error message is ever given one. They
  // change nothing a child is given; they only pick which true sentence
  // about Sona setup's ready screen shows. Asked once per family: the key
  // existing (even with both skipped) is what stops a second ask.
  const SETUPASKS = "sona.setupasks.v1";
  // ONE question since 5 Oct 2026 (Travis, of the two it replaced, "What brings
  // you to Sona?" and "How does practice go at home now?": "I don't like"
  // them; "we could at the very least ask them if they are in speech therapy
  // or not"). The days-a-week pick that sits beside it in setup is a real
  // setting (profile.weeklyGoal), not one of these.
  // Yes, No (t_none, 16 Oct 2026) and Not yet (t_no, which read "Not right
  // now" before; a saved t_no keeps its meaning)
  const SETUP_THERAPY = ["t_yes", "t_none", "t_no"];
  function _askId(list, v) { return (typeof v === "string" && list.indexOf(v) !== -1) ? v : ""; }
  function setupAsks() {
    let raw = null, v = null;
    try { raw = localStorage.getItem(SETUPASKS); v = JSON.parse(raw || "null"); } catch (e) {}
    v = (v && typeof v === "object") ? v : {};
    // (a record from the day the old questions were live still means "asked";
    // its one answer that was this question carries over)
    return { asked: raw != null, therapy: _askId(SETUP_THERAPY, v.therapy) || (v.why === "w_therapist" ? "t_yes" : "") };
  }
  function setupAsksSave(a) {
    a = (a && typeof a === "object") ? a : {};
    try { localStorage.setItem(SETUPASKS, JSON.stringify({ v: 2, therapy: _askId(SETUP_THERAPY, a.therapy) })); return true; } catch (e) { return false; }
  }

  // best-effort: send the pilot child's (consented) progress back to the founder. Debounced.
  let _lastSent = 0;
  function sendProgress(kind) {
    try {
      if (!isPilot()) return;
      const now = Date.now(); if (kind !== "enroll" && kind !== "manual" && now - _lastSent < 60000) return; _lastSent = now;
      const p = getProfile(), g = getProgress();
      const payload = {
        source: kind === "enroll" ? "pilot-enroll" : "pilot-progress",
        code: pilotInfo().code || "pilot",
        childId: pilotInfo().childId || "",
        // founding-family beacons carry NO name — the dashboard already has it
        // from the parent's web signup; the app itself sends counts only.
        child: (String(pilotInfo().code || "").indexOf("ff-") === 0 ? "" : (p.childName || "").slice(0, 60)),
        age: p.childAge || "",
        focus: (p.focusSounds || []).join(", "),
        goal: p.dailyGoal || "",
        outcomes: outcomes(),
        sessions: (g.totals && g.totals.sessions) || 0,
        streak: (g.streak && g.streak.count) || 0,
        consentAt: pilotInfo().consentAt || "",
        at: new Date().toISOString(),
      };
      // No ticket, no write. A device that never passed the credential check
      // has nothing to say about a clinician's caseload.
      let ticket = ""; try { ticket = localStorage.getItem("sona.slpticket") || ""; } catch (e) {}
      if (!ticket) return;
      payload.ticket = ticket;
      fetch("/api/pilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  // ── Founding Families: opening any page with ?ff=CODE enrolls this device —
  // free full access (pilot mode) + the consented practice beacon (counts
  // only, never audio). The code comes from the /founding signup, so the
  // founder dashboard can match this child to the parent's application.
  try {
    const _ffq = new URLSearchParams(location.search);
    const _ff = (_ffq.get("ff") || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24).toLowerCase();
    // Fail-closed founding enrollment: only unlock if the server confirms the
    // code is a real founding application. A random ?ff=anything no longer
    // grants free access; a network error / KV-down also grants nothing.
    if (_ff && !isPilot()) {
      try {
        fetch("/api/founding?id=" + encodeURIComponent(_ff))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            // the household mark first: the pilot slot is per-child and can be
            // overwritten by a later clinician enrolment; this cannot
            if (j && j.valid) { _markFounding("ff-" + _ff); startPilot("ff-" + _ff); try { sendProgress("enroll"); } catch (e) {} }
          })
          .catch(function () {});
      } catch (e) {}
    }
  } catch (e) {}

  // ── No double-tap zoom (Travis, 30 Sep 2026: "i double tapped the screen
  // and it zoomed in"). A child taps fast (a bubble, a fruit, the same game
  // card twice) and two quick taps are Safari's "zoom in", leaving the game
  // half off the screen until a grown-up pinches it back. The kid pages'
  // viewport lock (user-scalable=no) holds in the iOS app's web view, but
  // Safari has ignored it since iOS 10, for accessibility. Both honour
  // touch-action:manipulation, which drops double-tap zoom and nothing else:
  // lists still scroll, and the grown-up pages, which carry no viewport lock
  // on purpose, still pinch-zoom for a parent who needs bigger text.
  // On EVERY element, not just html: touch-action is not inherited, and
  // WebKit intersects it only up to the nearest scroll container, so a root
  // rule misses every tap inside a scrolling row or pop-up. `*` weighs
  // nothing and this sheet goes FIRST in <head>, so a page's own
  // touch-action (Hoops' court and Fruit Slice's board say none) still wins;
  // and since every element's default is auto, it only ever narrows.
  // Injected here, not in a stylesheet, because no one sheet reaches every
  // app page without also reaching the marketing pages: charge.html and the
  // crafted games skip action.css, and check/pilot load only fonts.css,
  // which parents.html and for-slps.html load too. The clinician dashboard
  // (/slps) loads sona.js only for its sound labels; it is left out on
  // purpose and keeps its own touch rules. tests/zoomtest.mjs pins all this.
  try {
    if (!/^\/slp(s|\.html)$/.test(location.pathname) && !document.getElementById("sonaNoZoom")) {
      const _nz = document.createElement("style");
      _nz.id = "sonaNoZoom";
      _nz.textContent = "*{touch-action:manipulation}";
      const _nzAt = document.head || document.documentElement;
      _nzAt.insertBefore(_nz, _nzAt.firstChild);
    }
  } catch (e) {}

  // ── Portrait-only guard: every kid surface loads sona.js, so one injected
  // overlay covers the whole app. Small-height landscape = a rotated phone
  // (desktop windows are taller); the cover asks for a turn back. The native
  // shell should also lock orientation in Xcode — this is the web belt.
  try {
    const _pg = document.createElement("div");
    _pg.id = "sonaPortraitGuard";
    _pg.innerHTML = '<div style="font-size:64px;">📱</div><div style="font-family:\'Baloo 2\',Nunito,sans-serif;font-weight:800;font-size:22px;margin-top:10px;">Turn your screen back!</div>';
    _pg.style.cssText = "display:none;position:fixed;inset:0;z-index:99999;background:#1cb0f6;color:#fff;text-align:center;flex-direction:column;align-items:center;justify-content:center;";
    const _ps = document.createElement("style");
    _ps.textContent = "@media (orientation:landscape) and (max-height:500px){ #sonaPortraitGuard{display:flex !important;} }";
    const _mount = () => { try { document.head.appendChild(_ps); document.body.appendChild(_pg); } catch (e) {} };
    if (document.body) _mount(); else document.addEventListener("DOMContentLoaded", _mount);
  } catch (e) {}

  // ── debug HUD: with ?debug=1 (sticky; ?debug=0 to clear) ──
  function debugOn() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("debug") === "1") localStorage.setItem("sona.debug", "1");
      if (q.get("debug") === "0") localStorage.removeItem("sona.debug");
      return localStorage.getItem("sona.debug") === "1";
    } catch (e) { return false; }
  }
  let _dbgBox = null;
  function debugBox() {
    if (_dbgBox) return _dbgBox;
    _dbgBox = document.createElement("div");
    _dbgBox.id = "sonaDebug";
    _dbgBox.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;max-width:64vw;background:rgba(8,20,33,.9);color:#fff;font:700 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:8px 10px;border-radius:10px;border-left:4px solid #4aa3ff;pointer-events:none;white-space:pre-wrap;box-shadow:0 6px 18px rgba(0,0,0,.35);";
    _dbgBox.textContent = "🛈 debug on — a score appears here after each attempt";
    (document.body || document.documentElement).appendChild(_dbgBox);
    return _dbgBox;
  }
  function debugScore(req, j) {
    try {
      const el = debugBox(), rating = (j && j.rating) || "?";
      el.style.borderLeftColor = rating === "great" ? "#74d174" : (rating === "ok" ? "#ffd36a" : (rating === "tryAgain" ? "#ff8f8f" : "#9fb6d6"));
      let ph = "";
      if (j && Array.isArray(j.phones)) ph = j.phones.map(function (p) { return p.phone + (p.score != null ? p.score : "–"); }).join(" ");
      el.textContent = "🛈 " + (req.text || "") + (req.sound ? " [" + req.sound + "]" : "") +
        "\nscore " + (j && j.score != null ? j.score : "–") + " · " + rating +
        (j && j.targetPhoneme != null ? "  (" + (req.sound || "tgt") + ":" + Math.round(j.targetPhoneme) + ")" : "") +
        (ph ? "\n" + ph : "");
    } catch (e) {}
  }
  function installDebug() {
    if (!debugOn() || global.__sonaDbg) return; global.__sonaDbg = true;
    const _fetch = global.fetch; if (typeof _fetch !== "function") return;
    global.fetch = function (input, init) {
      let url = ""; try { url = typeof input === "string" ? input : (input && input.url) || ""; } catch (e) {}
      const req = { text: "", sound: "" };
      try { if (init && init.body && typeof init.body.get === "function") { req.text = init.body.get("text") || ""; req.sound = init.body.get("targetSound") || ""; } } catch (e) {}
      const p = _fetch.apply(this, arguments);
      return p;
    };
    try { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", debugBox); else debugBox(); } catch (e) {}
  }
  try { _grandfatherFreeEra(); } catch (e) {}
  // order matters: era one is judged first, so the era-two sweep can trust
  // that a device still stamped "post" is not an era-one family
  try { _grandfatherFreeEra2(); } catch (e) {}
  // era three runs last and independently: it does not read the earlier
  // stamps, because a family who first opened Sona during the third free
  // window carries both of them and belongs to neither earlier cohort.
  try { _grandfatherFreeEra3(); } catch (e) {}
  // era four, likewise independent of every earlier stamp. It must run
  // BEFORE anything on this load can redeem a credential or finish setup —
  // both are asynchronous or user-driven, so a device whose first load is
  // this build is always judged as it arrived, never as it will be.
  try { _grandfatherFreeEra4(); } catch (e) {}
  // era five, likewise independent of every earlier stamp, and for the same
  // reason run before anything on this load can finish setup.
  try { _grandfatherFreeEra5(); } catch (e) {}
  try { _keepFreeVersion(); } catch (e) {}
  // the kept buddies (OWN1), likewise one-shot and independent of every other stamp
  try { _keepBuddies(); } catch (e) {}
  try { installDebug(); } catch (e) {}

  global.Sona = { questToday, questEnd, QUEST_DAYS, QUEST_LEN, pcmWave, mediaPCM, voiceAsMedia, libraryPreview, previewPlan, setPreviewPlan, gameKey, gameAccess, gameBounce, finishGameTurn, catalogRun, simpleAdventure, MIC_PROMISE, playStyle, pic, ICONS, icon, heartRow, WORD_STICKERS, COVER_FACES, momWeek, weeklyGoalDays, goalDays, dayReps, dayGoal, weekWins, ALL_SOUNDS, PLAY_ORDER, playMode, soundLabel, SOUND_NORM, soundNorm, STAGES, CHARACTERS, OUTFITS, BACKDROPS, VOICE_PITCH, TTS_CACHE_VERSION, voiceDiagnostic, voiceStatus, HOUSE_PALETTE, goClip, GO_WAIT_MS, WORDS, wordsFor, GAME_WORDS, gameWords, POSITIONS, FAMILY_POSITIONS, THEMES, houseArt, dayNum, dayTheme, dailyPick, characterById, outfitById, backdropById, buddyMarkup, kids, activeKid, addKid, switchKid, removeKid, kkey, saveFor, getProfile, saveProfile, getProgress, recordSession, resetProgress, exportData, exportString, importData, tickets, addTickets, spendTicket, chargeState, chargeAdd, chargeReset, dailyInfo, dailyFinish, micDenied, stageOf, completeStage, LADDER, LADDER_LABEL, rungOf, rungName, rungLabel, recordRung, rungWin, ladderContent, GAME_LEVELS, gameTop, gameAsk, gameHold, FREE_MODE, isFree, WEB_SALES, webSales, HUMAN_CLIPS, humanClipsOn, onBackground, ROT_LEN, rotSounds, rotState, rotSound, rotRound, rotAdvance, todayRing, track, EPISODES, episode, episodeNum, episodeBeat, episodeHook, episodeAdvance, dailyStory, dailyChapterNum, chapterScene, chapterPose, storyRead, markStoryRead, dailyGames, adventureGames, DAILY_GAMES, GAME_ACTS, GAME_KEYS, gameAct, activityLibrary, homePicks, bumpReps, repsToday, repGoal, goalState, mintCoins, mintStoryBonus, mysteryCost, mysteryGame, canBuyMystery, buyMystery, pathState, localDay: () => _localDay(), soundFamily, frameShape, soundStory, chestClaimed, claimChest, getMissed: () => getProgress().missed, getCoins, addCoins, spendCoins, owns, addOwned, getSub, saveSub, isSubscribed, premium, caseCovered, caseRefresh, gated, freeVersion, trialFirst, offerOnLock, FREE_BOOKS, bookFree, booksOpen, bookLocked, seasonPick, gateVerify, gateOk, requireGate, gateDest, slpCode, slpRedeem, slpVerified, slpJoinCaseload, isFounder, founderUnlock, offerCode, homework, homeworkSounds, syncHomework, practicePos, planMoment, planEligible, planShown, firstGameKey, firstGameStart, firstGameEnd, CRAFTED_CARDS, speak, speakNow, speakUnlock, speechAvailable, speechPerm, speechStart, speechStop, micNative, micOpen, micProbe, micSource, micDeaf, micRecorder, micQuiet, micStats, micFifo: nmFifo, NATIVE_MIC_GAIN, hearVerdict, stickerSheet, stickerBox, paintSticker, gameSticker, STICKER_FIELDS, isNativeApp, iapAvailable, iapProduct, iapPurchase, iapRestore, iapRefresh, getTrial, startTrial, ensureTrial, demoState, demoDone, demoStart, demoFinish, runActive, gateBounce, trialActive, trialExpired, trialDaysLeft, restore, saveRecording, listRecordings, sfx, music, confetti, pop, GAME_META, gameMeta, session, diff, markLevelDone, levelDone, sessionButtons, utm, startPilot, isPilot, pilotInfo, unlockedThru, logAttempt, outcomes, fid, isoWeek, weekReps, repWeeks, gameRep, repsBeacon, gameBest, gameBestOffer, hasNativeAudio, captureClip, sendProgress, sendFeedback, reportError, debugOn, STICKERS, stickersEarned, hasSticker, awardSticker, awardNextSticker, awardRandomSticker, cue, CUES, coachLine, soundSay, SOUND_SAY, actionCue, repeatCue, praiseLine, PRAISES, trophyState, trophies, coinsNow, PLAY_LEVEL_AT, PLAY_LEVEL_LINES, playLevelsOpen, playLevel, playLevelAsk, setPlayLevel, setPlayLevelCap, playLevelInfo, playBest, playBestOffer, buddyId, buddySprite, chestState, chestOpen, ROAD_LANDS, ROAD_STOPS, MONTH_STEPS, roadStop, roadState, roadOpen, monthOpen, roadSettle, roadRolledSeen, buddiesKept, shopItem, buyItem, undoBuy, equip, BOARD_LIVE, boardLive, boardAllowed, boardState, boardStart, boardClaim, boardFlush, boardView, boardNick, boardLeave, boardAsk, boardCancel, parentEmail, reportEmail, reportSync, homeOfferDue, offerSeen, notifyAvailable, notifyState, notifyRefresh, notifyAsk, trialReminderOn, trialReminderArm, trialReminderSync, soundMark, clipsSettled, storePlan, buyPlan, planWords, planSay, planBillDate, setupWall, setupAfterMark, setupAfter, setupAfterClear, setupAsks, setupAsksSave, SETUP_THERAPY };
})(window);
