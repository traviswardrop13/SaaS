/* Tiny shared state for the Sona parent prototype — localStorage only (no backend yet).
   Used by home.html, lesson.html, customize.html, progress.html and settings.html. */
(function (global) {
  const PKEY = "sona.profile.v1", GKEY = "sona.progress.v1";
  const ALL_SOUNDS = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"];
  // Friendly labels for the sound pickers (most are just the letter; voiced TH needs marking).
  const SOUND_LABELS = { THV: "TH (v)" };
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
  // fallback until each game draws the sticker sprite directly.
  const CHARACTERS = [
    { id: 'fox', name: 'Pip', emoji: '🦊', svg: '<svg viewBox="0 0 120 120"><clipPath id="bFox"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#ffe29a"></circle><g clip-path="url(#bFox)"><path d="M30 32l16 18-22 6Z" fill="#ff8a3d"></path><path d="M90 32l-16 18 22 6Z" fill="#ff8a3d"></path><path d="M34 38l9 10-12 3.5Z" fill="#e5672a"></path><path d="M86 38l-9 10 12 3.5Z" fill="#e5672a"></path><circle cx="60" cy="72" r="28" fill="#ff8a3d"></circle><ellipse cx="60" cy="83" rx="14" ry="10" fill="#fff"></ellipse><ellipse cx="49" cy="66" rx="6" ry="7" fill="#fff"></ellipse><circle cx="50" cy="67" r="3" fill="#3d2a1a"></circle><ellipse cx="71" cy="66" rx="6" ry="7" fill="#fff"></ellipse><circle cx="70" cy="67" r="3" fill="#3d2a1a"></circle><circle cx="60" cy="79" r="3.5" fill="#3d2a1a"></circle><circle cx="41" cy="78" r="4" fill="#ffb98a"></circle><circle cx="79" cy="78" r="4" fill="#ffb98a"></circle></g></svg>', locked: false },
    { id: 'bunny', name: 'Miso', emoji: '🐰', svg: '<svg viewBox="0 0 120 120"><clipPath id="bBun"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#cdefff"></circle><g clip-path="url(#bBun)"><ellipse cx="47" cy="30" rx="9" ry="22" fill="#f7f3ee" transform="rotate(-8 47 30)"></ellipse><ellipse cx="73" cy="30" rx="9" ry="22" fill="#f7f3ee" transform="rotate(8 73 30)"></ellipse><ellipse cx="47" cy="33" rx="4.5" ry="14" fill="#ffb9c8" transform="rotate(-8 47 33)"></ellipse><ellipse cx="73" cy="33" rx="4.5" ry="14" fill="#ffb9c8" transform="rotate(8 73 33)"></ellipse><circle cx="60" cy="74" r="27" fill="#f7f3ee"></circle><ellipse cx="49" cy="68" rx="6" ry="7" fill="#fff" stroke="#e8ddd2" stroke-width="1"></ellipse><circle cx="50" cy="69" r="3" fill="#3d2a1a"></circle><ellipse cx="71" cy="68" rx="6" ry="7" fill="#fff" stroke="#e8ddd2" stroke-width="1"></ellipse><circle cx="70" cy="69" r="3" fill="#3d2a1a"></circle><path d="M57 78h6l-3 4Z" fill="#ff8fa3"></path><rect x="55" y="84" width="10" height="8" rx="2.5" fill="#fff" stroke="#e8ddd2" stroke-width="1"></rect><line x1="60" y1="84" x2="60" y2="92" stroke="#e8ddd2" stroke-width="1.5"></line><circle cx="41" cy="80" r="4.5" fill="#ffd6c9"></circle><circle cx="79" cy="80" r="4.5" fill="#ffd6c9"></circle></g></svg>', locked: false },
    { id: 'dragon', name: 'Ziggy', emoji: '🐲', svg: '<svg viewBox="0 0 120 120"><clipPath id="bDrg"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#ffd9e8"></circle><g clip-path="url(#bDrg)"><path d="M44 38l-6-16 13 10Z" fill="#ffe9c9"></path><path d="M76 38l6-16-13 10Z" fill="#ffe9c9"></path><path d="M52 34l4-9 4 9Z" fill="#3cae7d"></path><path d="M62 33l4-9 4 9Z" fill="#3cae7d"></path><circle cx="60" cy="72" r="28" fill="#63d6a3"></circle><ellipse cx="60" cy="84" rx="15" ry="10" fill="#a5ecc9"></ellipse><circle cx="55" cy="82" r="2" fill="#2e8f68"></circle><circle cx="65" cy="82" r="2" fill="#2e8f68"></circle><ellipse cx="48" cy="64" rx="6" ry="7" fill="#fff"></ellipse><circle cx="49" cy="65" r="3" fill="#2b2a4a"></circle><ellipse cx="72" cy="64" rx="6" ry="7" fill="#fff"></ellipse><circle cx="71" cy="65" r="3" fill="#2b2a4a"></circle><path d="M50 92q10 6 20 0" stroke="#2e8f68" stroke-width="3.5" fill="none" stroke-linecap="round"></path></g></svg>', locked: false },
    { id: 'cat', name: 'Mochi', emoji: '🐱', svg: '<svg viewBox="0 0 120 120"><clipPath id="bCat"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#e5dcff"></circle><g clip-path="url(#bCat)"><path d="M36 32l14 14-19 7Z" fill="#ff9d7a"></path><path d="M84 32l-14 14 19 7Z" fill="#ff9d7a"></path><path d="M40 38l7 8-10 3.5Z" fill="#ffc9b3"></path><path d="M80 38l-7 8 10 3.5Z" fill="#ffc9b3"></path><circle cx="60" cy="72" r="27" fill="#ff9d7a"></circle><ellipse cx="60" cy="83" rx="13" ry="9" fill="#fff"></ellipse><ellipse cx="49" cy="66" rx="6" ry="7" fill="#fff"></ellipse><circle cx="50" cy="67" r="3" fill="#3d2a1a"></circle><ellipse cx="71" cy="66" rx="6" ry="7" fill="#fff"></ellipse><circle cx="70" cy="67" r="3" fill="#3d2a1a"></circle><path d="M57 78h6l-3 4Z" fill="#ff6b8a"></path><path d="M54 86q6 4 12 0" stroke="#e5764f" stroke-width="2.5" fill="none" stroke-linecap="round"></path><line x1="28" y1="76" x2="40" y2="78" stroke="#e5764f" stroke-width="2" stroke-linecap="round"></line><line x1="28" y1="84" x2="40" y2="83" stroke="#e5764f" stroke-width="2" stroke-linecap="round"></line><line x1="92" y1="76" x2="80" y2="78" stroke="#e5764f" stroke-width="2" stroke-linecap="round"></line><line x1="92" y1="84" x2="80" y2="83" stroke="#e5764f" stroke-width="2" stroke-linecap="round"></line></g></svg>', locked: false },
    { id: 'bee', name: 'Buzz', emoji: '🐝', svg: '<svg viewBox="0 0 120 120"><clipPath id="bBee"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#dff5c2"></circle><g clip-path="url(#bBee)"><line x1="48" y1="38" x2="42" y2="24" stroke="#3d3d3d" stroke-width="3" stroke-linecap="round"></line><line x1="72" y1="38" x2="78" y2="24" stroke="#3d3d3d" stroke-width="3" stroke-linecap="round"></line><circle cx="42" cy="22" r="4.5" fill="#3d3d3d"></circle><circle cx="78" cy="22" r="4.5" fill="#3d3d3d"></circle><ellipse cx="26" cy="58" rx="14" ry="9" fill="#fff" opacity=".85" transform="rotate(-24 26 58)"></ellipse><ellipse cx="94" cy="58" rx="14" ry="9" fill="#fff" opacity=".85" transform="rotate(24 94 58)"></ellipse><clipPath id="bBeeB"><circle cx="60" cy="70" r="27"></circle></clipPath><circle cx="60" cy="70" r="27" fill="#ffd43b"></circle><g clip-path="url(#bBeeB)"><rect x="30" y="78" width="60" height="9" fill="#3d3d3d"></rect><rect x="30" y="92" width="60" height="9" fill="#3d3d3d"></rect></g><ellipse cx="49" cy="62" rx="6" ry="7" fill="#fff" stroke="#e8c86a" stroke-width="1"></ellipse><circle cx="50" cy="63" r="3" fill="#2b2a4a"></circle><ellipse cx="71" cy="62" rx="6" ry="7" fill="#fff" stroke="#e8c86a" stroke-width="1"></ellipse><circle cx="70" cy="63" r="3" fill="#2b2a4a"></circle><path d="M53 71q7 5 14 0" stroke="#3d3d3d" stroke-width="3" fill="none" stroke-linecap="round"></path></g></svg>', locked: false },
    { id: 'octopus', name: 'Otto', emoji: '🐙', svg: '<svg viewBox="0 0 120 120"><clipPath id="bOct"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#ffe9c9"></circle><g clip-path="url(#bOct)"><circle cx="60" cy="64" r="28" fill="#a86ee3"></circle><circle cx="38" cy="92" r="9" fill="#a86ee3"></circle><circle cx="53" cy="97" r="9" fill="#a86ee3"></circle><circle cx="68" cy="97" r="9" fill="#a86ee3"></circle><circle cx="83" cy="92" r="9" fill="#a86ee3"></circle><circle cx="38" cy="90" r="3" fill="#c79bf0"></circle><circle cx="53" cy="95" r="3" fill="#c79bf0"></circle><circle cx="68" cy="95" r="3" fill="#c79bf0"></circle><circle cx="83" cy="90" r="3" fill="#c79bf0"></circle><ellipse cx="49" cy="58" rx="6.5" ry="7.5" fill="#fff"></ellipse><circle cx="50" cy="59" r="3.2" fill="#2b2a4a"></circle><ellipse cx="71" cy="58" rx="6.5" ry="7.5" fill="#fff"></ellipse><circle cx="70" cy="59" r="3.2" fill="#2b2a4a"></circle><ellipse cx="60" cy="72" rx="7" ry="5.5" fill="#5c3494"></ellipse><ellipse cx="60" cy="74.5" rx="4" ry="2.5" fill="#ff8fa3"></ellipse><circle cx="41" cy="68" r="4.5" fill="#c79bf0"></circle><circle cx="79" cy="68" r="4.5" fill="#c79bf0"></circle></g></svg>', locked: false },
    { id: 'dino', name: 'Rocky', emoji: '🦖', svg: '<svg viewBox="0 0 120 120"><clipPath id="bDin"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#d6f0ff"></circle><g clip-path="url(#bDin)"><path d="M42 36l5-12 5 12Z" fill="#ffe9c9"></path><path d="M55 32l5-12 5 12Z" fill="#ffe9c9"></path><path d="M68 36l5-12 5 12Z" fill="#ffe9c9"></path><circle cx="60" cy="72" r="28" fill="#4dc6b8"></circle><ellipse cx="60" cy="85" rx="16" ry="11" fill="#a8e8e0"></ellipse><circle cx="54" cy="83" r="2.2" fill="#2e8f83"></circle><circle cx="66" cy="83" r="2.2" fill="#2e8f83"></circle><ellipse cx="48" cy="63" rx="6" ry="7" fill="#fff"></ellipse><circle cx="49" cy="64" r="3" fill="#2b2a4a"></circle><ellipse cx="72" cy="63" rx="6" ry="7" fill="#fff"></ellipse><circle cx="71" cy="64" r="3" fill="#2b2a4a"></circle><path d="M50 93q10 7 20 0" stroke="#2e8f83" stroke-width="3.5" fill="none" stroke-linecap="round"></path><path d="M55 94l3 4 3-4Z" fill="#fff"></path></g></svg>', locked: false },
    { id: 'panda', name: 'Bao', emoji: '🐼', svg: '<svg viewBox="0 0 120 120"><clipPath id="bPan"><circle cx="60" cy="60" r="56"></circle></clipPath><circle cx="60" cy="60" r="56" fill="#ffdf9e"></circle><g clip-path="url(#bPan)"><circle cx="38" cy="42" r="11" fill="#3d3d3d"></circle><circle cx="82" cy="42" r="11" fill="#3d3d3d"></circle><circle cx="60" cy="72" r="28" fill="#fff"></circle><ellipse cx="47" cy="64" rx="9" ry="11" fill="#3d3d3d" transform="rotate(-14 47 64)"></ellipse><ellipse cx="73" cy="64" rx="9" ry="11" fill="#3d3d3d" transform="rotate(14 73 64)"></ellipse><circle cx="48" cy="64" r="3.6" fill="#fff"></circle><circle cx="49" cy="65" r="2" fill="#2b2a4a"></circle><circle cx="72" cy="64" r="3.6" fill="#fff"></circle><circle cx="71" cy="65" r="2" fill="#2b2a4a"></circle><ellipse cx="60" cy="79" rx="4" ry="3" fill="#3d3d3d"></ellipse><path d="M54 87q6 4 12 0" stroke="#3d3d3d" stroke-width="3" fill="none" stroke-linecap="round"></path><circle cx="40" cy="80" r="4.5" fill="#ffd6c9"></circle><circle cx="80" cy="80" r="4.5" fill="#ffd6c9"></circle></g></svg>', locked: false },
  ];
  const OUTFITS = [
    { id: "none",   name: "None",   emoji: "",   cost: 0 },
    { id: "crown",  name: "Crown",  emoji: "👑", cost: 30 },
    { id: "tophat", name: "Top hat",emoji: "🎩", cost: 25 },
    { id: "cap",    name: "Cap",    emoji: "🧢", cost: 20 },
    { id: "shades", name: "Cool",   emoji: "🕶️", cost: 25 },
    { id: "bow",    name: "Bow",    emoji: "🎀", cost: 20 },
    { id: "party",  name: "Party",  emoji: "🥳", cost: 40 },
  ];
  const BACKDROPS = [
    { id: "sky",      name: "Sky",       cost: 0,  css: "linear-gradient(180deg,#bfe3ff,#eaf3ff)", scene: ["☁️", "🌤️", "☁️"] },
    { id: "jungle",   name: "Jungle",    cost: 40, css: "linear-gradient(180deg,#bdf0c8,#e7fbe9)", scene: ["🌴", "🌿", "🦜"] },
    { id: "forest",   name: "Forest",    cost: 40, css: "linear-gradient(180deg,#cbe8c0,#eef7e6)", scene: ["🌲", "🍄", "🐿️"] },
    { id: "mountain", name: "Mountains", cost: 50, css: "linear-gradient(180deg,#d6e6ff,#f0f5ff)", scene: ["🏔️", "⛰️", "🌲"] },
    { id: "space",    name: "Space",     cost: 60, css: "linear-gradient(180deg,#cdd6ff,#eef1ff)", scene: ["🚀", "⭐", "🪐"] },
    { id: "beach",    name: "Beach",     cost: 50, css: "linear-gradient(180deg,#bfefff,#fff6e0)", scene: ["🏖️", "🌊", "🐚"] },
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

  const DEFAULT_PROFILE = { childName: "", childAge: "", focusSounds: ["R", "S", "L", "K"], voiceOn: true, coachName: "Coach", cloudScoring: true, slpEvaluated: "", goals: "", focusArea: "articulation", interests: [], language: "en", character: "fox", outfit: "none", backdrop: "sky", soundOn: true, voiceId: "qBDvhofpxp92JgXJxDjB", volume: 0.3, musicOn: false, dailyMinutes: 5, owned: { outfits: ["none"], backdrops: ["sky"] }, onboarded: false };
  // stage per sound: 0 = isolation (the letter), 1 = syllables, 2 = words, 3 = mastered.
  const STAGES = ["isolation", "syllables", "words"];
  const DEFAULT_PROGRESS = { sessions: [], totals: { sessions: 0, words: 0, stars: 0, coins: 0 }, streak: { count: 0, lastDate: "" }, bySound: {}, stage: {}, chests: {}, missed: [] };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  function load(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return (v && typeof v === "object") ? v : clone(def); } catch { return clone(def); } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  function getProfile() {
    const p = Object.assign(clone(DEFAULT_PROFILE), load(PKEY, {}));
    // migrate old/empty default voices (Jessica, Will, and the prior Leo) to the current voice
    if (!p.voiceId || p.voiceId === "cgSgspJ2msm6clMCkdW9" || p.voiceId === "bIHbv24MWmeRgasZH58o" || p.voiceId === "SF6OznV7UB2AxeidTpie") p.voiceId = DEFAULT_PROFILE.voiceId;
    return p;
  }
  // Playback-rate multiplier for /api/tts audio. Leo's ElevenLabs voice is
  // already a kid — no pitch-shift needed.
  const VOICE_PITCH = 1;
  function saveProfile(patch) { save(PKEY, Object.assign(getProfile(), patch || {})); }

  function getProgress() {
    const g = load(GKEY, DEFAULT_PROGRESS);
    g.totals = Object.assign({ sessions: 0, words: 0, stars: 0, coins: 0 }, g.totals || {});
    g.streak = Object.assign({ count: 0, lastDate: "" }, g.streak || {});
    g.bySound = g.bySound || {}; g.sessions = g.sessions || []; g.stage = g.stage || {}; g.chests = g.chests || {}; g.missed = g.missed || [];
    return g;
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

  // ── The parent's week — streaks belong to MOM, not the kid ──
  // She picks 3, 5, or 7 practice days a week in onboarding; a practice day is
  // any day with real logged attempts. The week streak counts consecutive weeks
  // that met HER goal, so a 3-day family feels every bit as on-track as a
  // 7-day one. Nothing here is ever shown to (or pressures) the child.
  function weeklyGoalDays() { const g = parseInt(getProfile().weeklyGoal, 10); return (g === 3 || g === 5 || g === 7) ? g : 5; }
  function momWeek() {
    const g = getProgress(); const pd = Object.assign({}, g.practiceDays || {});
    if (g.streak && g.streak.lastDate) pd[g.streak.lastDate] = 1; // pre-history migration
    const now = new Date(); const dow = (now.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
    const key = function (d) { return _localDay(d.getTime()); };
    const days = []; for (let i = 0; i < 7; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); days.push(!!pd[key(d)]); }
    const goal = weeklyGoalDays(); const done = days.filter(Boolean).length;
    let weekStreak = 0;
    for (let w = 1; w <= 26; w++) {
      let c = 0; for (let i = 0; i < 7; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7 * w + i); if (pd[key(d)]) c++; }
      if (c >= goal) weekStreak++; else break;
    }
    if (done >= goal) weekStreak++;
    return { days: days, done: done, goal: goal, hit: done >= goal, weekStreak: weekStreak, todayIx: dow, practicedToday: days[dow] };
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

  // ── SLP content ladder: isolation → syllable → word → phrase → sentence → conversation ──
  // The way real therapists sequence a target sound. Per-sound progress climbs
  // the 6 rungs; a rung unlocks the next after a solid round (~80% — "encouraging"
  // gating: only ever moves UP, and every lower rung stays replayable). We reuse
  // g.stage[sound] as the rung index (0..6, 6 = all rungs cleared) so it stays in
  // sync with the existing stage tracker (stageOf/completeStage keep their 0..3
  // contract for the legacy lesson flow).
  const LADDER = ["isolation", "syllable", "word", "phrase", "sentence", "conversation"];
  const LADDER_LABEL = { isolation: "Sound", syllable: "Syllables", word: "Words", phrase: "Phrases", sentence: "Sentences", conversation: "Talking" };
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
  // ── free-play rotation: one letter at a time, one rung per game ──
  // A rotation = ROT_LEN practice rounds (≈ one pass of the games — any games,
  // any order) spent on ONE focus sound. Round r practices rung min(r, earned+1):
  // warm up in isolation, climb a rung each game, stretch ONE level past
  // mastery, never three. When a rotation completes, the NEXT focus sound takes
  // over — so every sound the family picked gets worked, not just the first.
  // The rotation persists across days (stop at round 3, resume at round 3);
  // todayRing() below is the per-day goal and resets each morning.
  const ROTKEY = "sona.rotation.v1", RINGKEY = "sona.today.v1", ROT_LEN = 5;
  function rotSounds() {
    const f = ((getProfile().focusSounds) || []).map((s) => String(s).toUpperCase()).filter((s) => WORDS[s]);
    return f.length ? f : ["R"];
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
  function rotAdvance() {
    const f = rotSounds(); const st = rotState();
    let i = st.i, r = st.r + 1;
    if (r >= ROT_LEN) { r = 0; i = (i + 1) % f.length; }
    save(ROTKEY, { i, r });
    const t = today(); const dr = load(RINGKEY, {});
    save(RINGKEY, { d: t, n: ((dr.d === t ? dr.n : 0) || 0) + 1 });
    return { i, r };
  }
  // today's goal ring: rounds finished today; the goal = one full pass of the games
  function todayRing() { const dr = load(RINGKEY, {}); const n = (dr.d === today() ? dr.n : 0) || 0; return { n, goal: ROT_LEN, done: n >= ROT_LEN }; }

  // ── in-game sound-shape helpers (same calibration as charge.html's gate).
  // Games use these so "say RRRR to keep playing" actually requires an R-ish
  // sound — a hiss or a scream won't revive. Frequency NUMBERS only, computed
  // on-device from the live analyser: nothing is recorded or uploaded, and
  // revives/boosts are never logged as practice data.
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
    const ws = () => wordsFor(sound) || [];
    if (lvl === "isolation") return [{ t: soundSay(sound), say: soundSay(sound), display: soundLabel(sound), level: "isolation", mode: "phoneme" }];
    if (lvl === "syllable") return (SC && SC.syllables ? SC.syllables(sound) : []).map((s) => ({ t: s.t, say: s.say, display: s.t, level: "syllable", mode: "phoneme" }));
    if (lvl === "word") return ws().map((w) => ({ t: w.w, say: w.w, display: w.w, e: w.e, word: w.w, level: "word", mode: "full" }));
    if (lvl === "phrase") return (SC && SC.phrases ? SC.phrases(sound) : ws().map((w) => ({ t: w.w, say: w.w, e: w.e, word: w.w }))).map((p) => ({ t: p.t, say: p.say, display: p.t, e: p.e, word: p.word, level: "phrase", mode: "full" }));
    if (lvl === "sentence") return (SC && SC.sentences ? SC.sentences(sound) : ws().map((w) => ({ t: w.w, say: w.w, e: w.e, word: w.w }))).map((s) => ({ t: s.t, say: s.say, display: s.t, e: s.e, word: s.word, level: "sentence", mode: "full" }));
    if (lvl === "conversation") return (SC && SC.chats ? SC.chats(sound) : []).map((c) => ({ q: c.q, options: c.options, level: "conversation", mode: "full" }));
    return [];
  }

  // ── Sound Check: the weekly AI evaluation that writes the plan ──
  // A structured word sweep: the SAME first-two initial-position words per
  // sound every time, so week-over-week scores compare like-for-like — a
  // controlled sample, unlike free play. Each word is scored on the target
  // phoneme by the cloud scorer; grades roll up to strong/emerging/needs-work
  // and buildPlan() turns that into focus sounds, starting ladder rungs, and
  // a 12-week arc. Unofficial by design: a practice snapshot the parent can
  // share with their SLP — never an evaluation or diagnosis.
  const SCKEY = "sona.soundcheck.v1", PLANKEY = "sona.plan.v1";
  function checkSounds(mode) {
    const p = getProfile(); const age = parseInt(p.childAge, 10) || 0;
    const picked = (p.focusSounds || []).map((s) => String(s).toUpperCase()).filter((s) => WORDS[s]);
    if (mode === "mini" && picked.length) return picked.slice(0, 4);
    // full sweep: age-appropriate sounds (expected by ~age+1) plus anything
    // already picked, easiest developmental norms first so the check opens
    // with wins; capped so a 4-year-old stays under ~five minutes.
    let all = ALL_SOUNDS.filter((s) => WORDS[s]);
    if (age) all = all.filter((s) => (SOUND_NORM[s] || 9) <= age + 1);
    // picked sounds ALWAYS make the sweep (they take cap slots first), then
    // age-appropriate rest; presented easiest developmental norms first.
    const rest = all.filter((s) => picked.indexOf(s) === -1);
    let list = picked.concat(rest).slice(0, 12);
    if (!list.length) list = ["P", "B", "M"];
    list.sort((a, b) => (SOUND_NORM[a] || 9) - (SOUND_NORM[b] || 9));
    return list;
  }
  function checkItems(mode) {
    return checkSounds(mode)
      .map((s) => ({ sound: s, words: (wordsFor(s, "i") || []).slice(0, 2).map((w) => w.w) }))
      .filter((it) => it.words.length);
  }
  // Grade one sound from its per-word target-phoneme scores (0-100; null = unscored).
  function gradeSound(scores) {
    const sc = (scores || []).filter((v) => typeof v === "number");
    if (!sc.length) return "unknown";
    const avg = sc.reduce((a, b) => a + b, 0) / sc.length;
    return avg >= 78 ? "strong" : avg >= 55 ? "emerging" : "needs";
  }
  function saveCheck(run) { // {mode, results:{R:{words:[..], scores:[..]}}}
    const hist = load(SCKEY, { checks: [] });
    const statuses = {};
    Object.keys(run.results || {}).forEach((s) => { statuses[s] = gradeSound(run.results[s].scores); });
    hist.checks.push({ d: today(), t: Date.now(), mode: run.mode || "mini", results: run.results, statuses });
    hist.checks = hist.checks.slice(-26); // ~6 months of weekly snapshots
    save(SCKEY, hist);
    return statuses;
  }
  function lastCheck() { const h = load(SCKEY, { checks: [] }); return h.checks[h.checks.length - 1] || null; }
  function checkHistory() { return load(SCKEY, { checks: [] }).checks; }
  function checkDue() { const c = lastCheck(); return !c || (Date.now() - (c.t || 0)) > 6.5 * 86400000; }
  // The plan writer: evaluation → focus sounds + starting rungs + the arc.
  function buildPlan() {
    const c = lastCheck(); if (!c) return null;
    const g = getProgress();
    // needs-work first, easiest norms first, cap 3 so practice stays focused;
    // strong sounds graduate out. All strong → light maintenance on the first two.
    const order = Object.keys(c.statuses).sort((a, b) => (SOUND_NORM[a] || 9) - (SOUND_NORM[b] || 9));
    const needs = order.filter((s) => c.statuses[s] === "needs");
    const emerging = order.filter((s) => c.statuses[s] === "emerging");
    let focus = needs.concat(emerging).slice(0, 3);
    if (!focus.length) focus = order.slice(0, 2);
    // starting rung: needs-work begins at the bottom, emerging gets isolation
    // credit — but an EARNED rung is never downgraded by a bad check day.
    focus.forEach((s) => { const want = c.statuses[s] === "emerging" ? 1 : 0; g.stage[s] = Math.max(g.stage[s] || 0, want); });
    save(GKEY, g);
    saveProfile({ focusSounds: focus });
    try { save(ROTKEY, { i: 0, r: 0 }); } catch (e) {}
    const plan = { created: today(), t: Date.now(), focus, statuses: c.statuses,
      weeks: [
        { w: "Weeks 1–2", what: "Warm-ups — each sound by itself, then syllables (rah, ree, roo)" },
        { w: "Weeks 3–6", what: "Words — " + focus.map((s) => soundLabel(s)).join(", ") + " at the start of words" },
        { w: "Weeks 7–10", what: "Phrases — short two-word combos inside the games" },
        { w: "Weeks 11–13", what: "Sentences & review — the sounds in real talking" },
      ] };
    save(PLANKEY, plan);
    return plan;
  }
  function getPlan() { const v = load(PLANKEY, {}); return v && v.focus ? v : null; }
  // The Sound Story: the week, narrated from real data (card + email body).
  function soundStory() {
    const w = weekWins(); const mw = momWeek(); const hist = checkHistory();
    const name = getProfile().childName || "Your kid";
    const bits = [];
    bits.push(name + " practiced " + mw.done + (mw.done === 1 ? " day" : " days") + " this week" + (w.reps > 0 ? " and said " + w.reps + " sounds out loud." : "."));
    if (w.acc != null && w.accPrev != null && w.acc !== w.accPrev) bits.push("The " + w.label + " sound moved " + w.accPrev + "% → " + w.acc + "% on honest scoring.");
    if (hist.length >= 2) {
      const rank = { needs: 0, emerging: 1, strong: 2 }; const ups = [];
      const prev = hist[hist.length - 2].statuses || {}, cur = hist[hist.length - 1].statuses || {};
      Object.keys(cur).forEach((s) => { if (prev[s] != null && rank[cur[s]] > rank[prev[s]]) ups.push(soundLabel(s)); });
      if (ups.length) bits.push("Sound Check win: " + ups.join(", ") + " moved up since last week.");
    }
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
  // Word positions for targeted practice — SLPs pick where in the word the sound sits.
  const POSITIONS = [
    { id: "i", name: "Beginning" }, { id: "m", name: "Middle" }, { id: "f", name: "End" },
    { id: "v", name: "Vocalic R" }, { id: "b", name: "Blends" }, { id: "mix", name: "Mixed" },
  ];
  function wordsFor(sound, pos) {
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

  // --- coins (earned in lessons, spent in the shop) ---
  function getCoins() { return getProgress().totals.coins || 0; }
  function addCoins(n) { const g = getProgress(); g.totals.coins = (g.totals.coins || 0) + (n || 0); save(GKEY, g); return g.totals.coins; }
  function spendCoins(n) { const g = getProgress(); if ((g.totals.coins || 0) < n) return false; g.totals.coins -= n; save(GKEY, g); return true; }
  // --- owned cosmetics (shop) ---
  function owns(kind, id) { const o = getProfile().owned || {}; return (o[kind] || []).indexOf(id) !== -1; }
  function addOwned(kind, id) { const p = getProfile(); const o = p.owned || { outfits: [], backdrops: [] }; o[kind] = o[kind] || []; if (o[kind].indexOf(id) === -1) o[kind].push(id); saveProfile({ owned: o }); }

  // rec: { words: [{ word, sound, ok }] }
  function recordSession(rec) {
    const g = getProgress();
    const words = (rec && rec.words) || [];
    const stars = words.filter((w) => w && w.ok !== false).length;
    g.sessions.unshift({ date: new Date().toISOString(), count: words.length, sounds: [...new Set(words.map((w) => w && w.sound).filter(Boolean))] });
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
  function exportData() {
    const out = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("sona.") === 0) out[k] = localStorage.getItem(k); } } catch (e) {}
    return { app: "sona", v: 1, data: out };
  }
  function exportString() { try { return JSON.stringify(exportData()); } catch (e) { return "{}"; } }
  function importData(payload) {
    try {
      const obj = (typeof payload === "string") ? JSON.parse(payload) : payload;
      const data = (obj && obj.data && typeof obj.data === "object") ? obj.data : obj;
      if (!data || typeof data !== "object") return { ok: false, error: "That backup didn't look right." };
      let n = 0;
      Object.keys(data).forEach((k) => { if (k.indexOf("sona.") === 0) { try { localStorage.setItem(k, String(data[k])); n++; } catch (e) {} } });
      if (!n) return { ok: false, error: "No Sona data found in that backup." };
      return { ok: true, restored: n };
    } catch (e) { return { ok: false, error: "Couldn't read that backup code." }; }
  }

  // ── Charge & Play: the ⚡ charge gate + the Daily Run ─────────────────────
  // The core loop: a quick burst of ~5 real spoken reps "charges" the game the
  // kid is about to play. Practice is the power source — never the penalty.
  // Arcade time is NOT practice and never counts in the SLP stats (that stays
  // logAttempt's job — one honest SpeechAce spot-check per charge).
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

  // Friendly full-screen blocker when the mic is denied — a kid should never
  // sit in a silent loop. One shared implementation for every recording page.
  function micDenied(opts) {
    opts = opts || {};
    try {
      if (document.getElementById("sonaMicDenied")) return;
      const d = document.createElement("div");
      d.id = "sonaMicDenied";
      d.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(255,255,255,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:10px;";
      d.innerHTML =
        '<img src="/coach/echo/echo-idle.svg" alt="Leo" style="width:110px;height:110px;object-fit:contain;" onerror="this.outerHTML=\'<div style=&quot;font-size:64px&quot;>🦜</div>\'" />' +
        '<div style="font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:24px;color:#3c3c3c;">I can’t hear you!</div>' +
        '<div style="font-family:Nunito,sans-serif;font-weight:700;font-size:15px;color:#777;max-width:300px;">Ask a grown-up to turn on the microphone for Sona in your phone’s settings, then come back!</div>' +
        '<button style="margin-top:10px;border:none;border-radius:16px;padding:14px 34px;font-family:\'Baloo 2\',sans-serif;font-weight:800;font-size:16px;text-transform:uppercase;color:#fff;background:#1cb0f6;box-shadow:0 5px 0 0 #1597d4;cursor:pointer;">OK</button>';
      d.querySelector("button").onclick = function () { d.remove(); if (opts.onClose) opts.onClose(); else location.href = opts.back || "/today.html"; };
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
  const TRIALKEY = "sona.trial.v1", TRIAL_DAYS = 7;
  function getTrial() { return load(TRIALKEY, null); }
  function trialMs(t) { return (((t && t.days) || TRIAL_DAYS)) * 86400000; }
  function mirrorTrial(t) { try { fetch("/api/trial", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ email: t.email || "", start: t.start, days: t.days || TRIAL_DAYS }) }).catch(function () {}); } catch (e) {} }
  function startTrial(email) {
    let t = getTrial();
    if (!t || !t.start) { t = { start: Date.now(), email: (email || "").trim(), days: TRIAL_DAYS }; save(TRIALKEY, t); mirrorTrial(t); }
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

  // Launch gate: subscribers/pilots are always in; everyone else gets a 7-day
  // free trial, then the paywall. (Library, customize, progress stay open.)
  // Native app: never gate — it's free with no in-app purchase.
  function gated() { if (isNativeApp()) return false; if (isSubscribed() || isPilot()) return false; ensureTrial(); return trialExpired(); }
  // Verify a subscription by email (Stripe is the source of truth) and cache it,
  // so a paid family can unlock on a new device / after clearing storage.
  async function restore(email) {
    email = (email || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email." };
    try {
      const r = await fetch("/api/subscription?email=" + encodeURIComponent(email));
      const j = await r.json();
      if (j && j.ok && j.active) { saveSub({ active: true, email: email }); return { ok: true, active: true }; }
      if (j && j.ok) return { ok: true, active: false };
      return { ok: false, error: (j && j.error) || "Couldn’t check right now." };
    } catch (e) { return { ok: false, error: "Network error. Try again." }; }
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
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const tx = db.transaction("recordings", "readwrite");
        tx.objectStore("recordings").add(Object.assign({ date: new Date().toISOString() }, rec));
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { return false; }
  }
  async function listRecordings(limit = 50) {
    try {
      const db = await idb();
      return await new Promise((res) => {
        const out = [];
        const tx = db.transaction("recordings", "readonly");
        const cur = tx.objectStore("recordings").openCursor(null, "prev");
        cur.onsuccess = (e) => { const c = e.target.result; if (c && out.length < limit) { out.push(c.value); c.continue(); } else res(out); };
        tx.onerror = () => res(out);
      });
    } catch (e) { return []; }
  }

  // ── juice: tiny sound effects + confetti (Web Audio + canvas, no assets) ──
  // What gives the app its Duolingo "feel": a satisfying chime on success, a
  // soft buzz on a miss, and confetti on a win. Synthesized so there are no
  // files to ship and nothing to wait on.
  let _ac = null, _master = null;
  function ac() {
    try { if (!_ac) { _ac = new (window.AudioContext || window.webkitAudioContext)(); _master = _ac.createGain(); _master.gain.value = 0.9; _master.connect(_ac.destination); } if (_ac.state === "suspended") _ac.resume(); } catch (e) {}
    return _ac;
  }
  // master volume from the profile (so the volume slider also controls SFX); 0 = muted
  function sfxVol() { try { const p = getProfile(); if (p.soundOn === false) return 0; return (p.volume != null ? p.volume : 0.8); } catch (e) { return 0.8; } }
  function note(freq, start, dur, type, gain) {
    const a = ac(); const v = sfxVol(); if (!a || v === 0) return;
    const t0 = a.currentTime + start;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
    const peak = (gain || 0.18) * v;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(_master || a.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  const tone = note; // back-comat
  // richer than plain beeps: core note + a soft octave/overtone shimmer
  const sfx = {
    tap()      { note(660, 0, 0.06, "triangle", 0.10); note(990, 0.005, 0.05, "sine", 0.04); },
    correct()  { [523.25, 659.25, 783.99].forEach((f, i) => { note(f, i * 0.08, 0.18, "sine", 0.16); note(f * 2, i * 0.08, 0.12, "sine", 0.05); }); }, // warm C-E-G + shimmer
    wrong()    { note(330, 0, 0.16, "sine", 0.07); note(247, 0.1, 0.2, "sine", 0.07); },                  // gentle, never harsh
    complete() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { note(f, i * 0.1, 0.26, "sine", 0.16); note(f * 1.5, i * 0.1, 0.15, "sine", 0.04); }); },
    reward()   { [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => note(f, i * 0.08, 0.28, "triangle", 0.14)); },
    star()     { note(1046.5, 0, 0.1, "sine", 0.14); note(1568, 0.06, 0.16, "sine", 0.12); },
    coin()     { note(988, 0, 0.07, "square", 0.09); note(1319, 0.06, 0.12, "square", 0.09); },           // coin "ching"
    drop()     { note(210, 0, 0.16, "sine", 0.16); note(120, 0.04, 0.18, "sine", 0.10); },                // soft thunk
  };
  // Optional background music — plays a real track if /sfx/music.mp3 is added,
  // gated on a profile toggle (off by default). No synth music (would sound cheap).
  let _music = null;
  const music = {
    start() { try { const p = getProfile(); if (p.musicOn !== true || p.soundOn === false) return; if (!_music) { _music = new Audio("/sfx/music.mp3"); _music.loop = true; _music.volume = 0.18; } _music.play().catch(() => {}); } catch (e) {} },
    stop()  { try { if (_music) _music.pause(); } catch (e) {} },
    toggle(on) { try { saveProfile({ musicOn: !!on }); if (on) music.start(); else music.stop(); } catch (e) {} },
  };
  function confetti(opts) {
    opts = opts || {};
    const cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;";
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    const colors = opts.colors || ["#2a9df4", "#ff8a3d", "#22c55e", "#ffd33d", "#ef6f23", "#1480e0"];
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
  const LEVEL_GAMES = ["racer.html", "bubble.html", "grocery.html", "cupstack.html", "story.html"];
  // ── the deck is now Charge & Play ──
  // The core loop replaced the themed-game roster: honest reps charge the ⚡
  // meter → arcade tickets (Fruit Slice / Block Stacker) → repeat to the daily
  // target. charge.html runs the whole session itself, so a "level" is simply
  // one charge session. Story Time stays as the calm second mode (reached from
  // the shelf), and the old speech games are parked on disk (racer, bubble,
  // grocery, cupstack, chat, rocket, builder, train, whack, match) — arcade
  // payoffs are the expansion surface now, not new speech games.
  const GAME_DECK = ["charge.html"];
  const GAMES_PER_LEVEL = 1;
  function levelGames(level) {
    level = level || 1;
    const start = ((level - 1) * GAMES_PER_LEVEL) % GAME_DECK.length, out = [];
    for (let i = 0; i < GAMES_PER_LEVEL; i++) out.push(GAME_DECK[(start + i) % GAME_DECK.length]);
    return out;
  }
  // Per-game display info for the level-path screen (icon · name · skill band · color).
  const GAME_META = {
    "rocket.html":   { name: "Sound Rocket",  icon: "🚀",  band: "Warm-up",   c: "#1cb0f6" },
    "bubble.html":   { name: "Bubble Pop",    icon: "🫧",  band: "Syllables", c: "#27c2c2" },
    "racer.html":    { name: "Rev Racer",     icon: "🏎️", band: "Words",     c: "#9b7bff" },
    "cupstack.html": { name: "Cup Stack",     icon: "🥤",  band: "Words",     c: "#ff5d6c" },
    "whack.html":    { name: "Pop-a-Word",    icon: "🔨",  band: "Words",     c: "#58cc02" },
    "match.html":    { name: "Match-Up",      icon: "🃏",  band: "Words",     c: "#8b5cf6" },
    "builder.html":  { name: "Block Builder",  icon: "🧱",  band: "Words",     c: "#ff8c42" },
    "grocery.html":  { name: "Grocery Grab",  icon: "🛒",  band: "Phrases",   c: "#ff9600" },
    "train.html":    { name: "Story Train",   icon: "🚂",  band: "Sentences", c: "#2ec4d6" },
    "story.html":    { name: "Story Time",    icon: "📖",  band: "Story",     c: "#7cc40a" },
    "chat.html":     { name: "Chat with Leo", icon: "💬",  band: "Talking",   c: "#e0457b" },
    "charge.html":       { name: "Charge & Play", icon: "⚡", band: "Practice", c: "#ffb100" },
    "arcade-slice.html": { name: "Fruit Slice",   icon: "🍉", band: "Arcade",   c: "#ff6b6b" },
    "arcade-stack.html": { name: "Block Stacker", icon: "🧱", band: "Arcade",   c: "#4dabf7" },
    "arcade-tiles.html": { name: "Piano Tiles",   icon: "🎹", band: "Arcade",   c: "#9775fa" },
    "arcade-run.html":   { name: "Sound Sprint",  icon: "🏃", band: "Arcade",   c: "#2f9e44" },
    "arcade-glide.html": { name: "Flappy Glide",  icon: "🎈", band: "Arcade",   c: "#4f8fc7" },
  };
  function gameMeta(file) {
    const k = String(file || "").replace(/^\//, "").split("?")[0];
    return GAME_META[k] || { name: "Game", icon: "🎮", band: "", c: "#1cb0f6" };
  }
  const SESKEY = "sona.session.v1";
  const session = {
    start(level, sound, queue, diffLevel) {
      const s = { level: level || 1, sound: (sound || "R"), diff: (diffLevel != null ? diffLevel : (level || 1)),
                  queue: (queue && queue.length ? queue.slice() : LEVEL_GAMES.slice()), idx: 0, ts: Date.now() };
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

  // ── Worlds = one per game (Duolingo-ABC style) ──
  // Each game is its own world (a themed "house"). Inside is a path of
  // LEVELS_PER_WORLD levels of THAT game at rising difficulty (diff 1..N),
  // cycling the child's focus sounds. All worlds are open (kids pick any house);
  // levels unlock in order. Stars (1–3) come from accuracy and are replayable.
  // Art drops in at /coach/worlds/<id>.png (house) + /coach/<id>/lvl<n>.png.
  const WORLDS = [
    { id: "racer",    game: "racer.html",    name: "Speedway",    theme: "🏁", sky: "linear-gradient(180deg,#bfe9ff,#dff4ff 55%,#cdeffd)" },
    { id: "bubble",   game: "bubble.html",   name: "Bubble Bay",  theme: "🫧", sky: "linear-gradient(180deg,#bfeeff,#7fd2f0 55%,#2b86bd)" },
    { id: "grocery",  game: "grocery.html",  name: "The Market",  theme: "🛒", sky: "linear-gradient(180deg,#fff1d6,#ffe1ad 55%,#ffcf86)" },
    { id: "cupstack", game: "cupstack.html", name: "Stack Hall",  theme: "🥤", sky: "linear-gradient(180deg,#e9f3ff,#cfe6ff 55%,#a9d2ff)" },
    { id: "story",    game: "story.html",    name: "Storybook",   theme: "📖", sky: "linear-gradient(180deg,#eafbe4,#cdebb0 60%,#9ad07a)" },
    // Parked (files on disk; off the map until rebuilt): builder, train, whack, match.
  ];
  const LEVELS_PER_WORLD = 10;
  function campaignSounds() {
    const p = getProfile();
    let f = (p.focusSounds || []).filter((s) => WORDS[s]);
    if (!f.length) f = ["R", "S", "L", "K"].filter((s) => WORDS[s]);
    return f;
  }
  // One world per game; LEVELS_PER_WORLD levels of that game at diff 1..N,
  // cycling the child's focus sounds.
  function campaignLevels() {
    const sounds = campaignSounds(), out = [];
    for (let w = 0; w < WORLDS.length; w++) {
      for (let i = 0; i < LEVELS_PER_WORLD; i++) {
        out.push({ id: WORLDS[w].id + "-" + (i + 1), world: w, worldId: WORLDS[w].id,
          idx: i, n: i + 1, game: WORLDS[w].game,
          sound: sounds[(w + i) % sounds.length], diff: i + 1, boss: i === LEVELS_PER_WORLD - 1 });
      }
    }
    return out;
  }
  function worldById(id) { return WORLDS.filter((w) => w.id === id)[0] || null; }
  function worldLevels(id) { return campaignLevels().filter((l) => l.worldId === id); }
  const CAMPKEY = "sona.campaign.v1", CAMPPEND = "sona.campaign.pending";
  function campaignState() { const s = load(CAMPKEY, { stars: {}, ts: 0 }); s.stars = s.stars || {}; return s; }
  function levelStars(id) { return campaignState().stars[id] || 0; }
  function setLevelStars(id, n) { const s = campaignState(); if ((n || 0) > (s.stars[id] || 0)) { s.stars[id] = n; s.ts = Date.now(); save(CAMPKEY, s); } return s.stars[id] || 0; }
  function totalStars() { const s = campaignState().stars; return Object.keys(s).reduce((a, k) => a + (s[k] || 0), 0); }
  function worldStars(id) { return worldLevels(id).reduce((a, l) => a + levelStars(l.id), 0); }
  function worldCleared(id) { return worldLevels(id).filter((l) => levelStars(l.id) > 0).length; }
  function worldUnlocked() { return true; } // all houses open; gating is per-level inside
  function levelUnlocked(level, all) {
    all = all || campaignLevels();
    if (level.idx === 0) return true;
    const prev = all.filter((l) => l.worldId === level.worldId && l.idx === level.idx - 1)[0];
    return prev ? levelStars(prev.id) > 0 : true;
  }
  // Snapshot a sound's accuracy before launching a level; resolve to stars on
  // return (read-only on the games — they just record outcomes as they always do).
  function campaignLaunch(level) {
    const o = outcomes()[level.sound] || { attempts: 0, passes: 0 };
    save(CAMPPEND, { id: level.id, sound: level.sound, a: o.attempts || 0, p: o.passes || 0, ts: Date.now(), back: "/world.html?w=" + level.worldId });
  }
  function campaignResolve() {
    const pend = load(CAMPPEND, null);
    if (!pend || !pend.id) return null;
    try { localStorage.removeItem(CAMPPEND); } catch (e) {}
    const o = outcomes()[pend.sound] || { attempts: 0, passes: 0 };
    const da = (o.attempts || 0) - (pend.a || 0), dp = (o.passes || 0) - (pend.p || 0);
    if (da <= 0) return null; // they didn't actually practice
    const acc = dp / da, stars = acc >= 0.85 ? 3 : acc >= 0.55 ? 2 : 1;
    const before = levelStars(pend.id); setLevelStars(pend.id, stars);
    if (before === 0) { try { addCoins(15); } catch (e) {} } // first-clear bonus
    return { id: pend.id, stars: stars, improved: stars > before, acc: acc, worldId: String(pend.id).split("-")[0] };
  }

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
  function cue(sound) { return CUES[sound] || { mouth: "👄", tip: "Listen to Leo, then copy the sound!" }; }

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
    let reps = 0; Object.keys(o).forEach(function (s) { const bs = o[s]; if (bs && bs.days) Object.keys(bs.days).forEach(function (k) { if (inRange(k, start, end)) reps += bs.days[k].a || 0; }); });
    return { sound: snd, label: soundLabel(snd), reps: reps, acc: acc(start, end), accPrev: acc(prev, start), week: momWeek() };
  }

  // ── Sticker icon kit (design §7): flat 2-tone SVGs with a white glint dot.
  // Replaces every kid-visible emoji — HUD pills, hearts, mic, bolts, covers.
  const ICONS = {
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
  // "Are you ready? Say rrrr 4 times to rev your engine!"  — reps>1 adds the
  // count; action is the game's verb ("rev your engine", "pop the bubble").
  function actionCue(sound, reps, action) {
    var s = soundSay(sound), n = Math.max(1, parseInt(reps, 10) || 1);
    return "Are you ready? Say " + s + (n > 1 ? (" " + n + " times") : "") + (action ? (" to " + action) : "") + "!";
  }
  // Model-then-try line for warm-ups and corrections: "Repeat after me… rrrr!  Now you try — rrrr!"
  function repeatCue(sound) { var s = soundSay(sound); return "Repeat after me… " + s + "!  Now you try — " + s + "!"; }
  // Short spoken praise for a correct rep — said before moving to the next prompt.
  // Lightly varied (led by "Nice one!") so it doesn't feel robotic to a kid.
  const PRAISES = ["Nice one!", "Nice!", "Great job!", "Awesome!", "You got it!", "Way to go!"];
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
    // Adventure-Map (campaign) flow: a game launched from the map leaves a fresh
    // campaign-pending marker. Turn the replay button into "Next →" that returns to
    // the map — which is what records the win and unlocks the next level. Without
    // this, tapping replay never returns, so the next level stays locked.
    try {
      var pend = load(CAMPPEND, null);
      if (pend && pend.id && pend.ts && (Date.now() - pend.ts < 7200000) && !/[?&]session=1\b/.test(location.search)) {
        var agc = winEl.querySelector("#again");
        if (agc) { agc.textContent = "Next →"; agc.onclick = function () { try { sfx && sfx.tap && sfx.tap(); } catch (e) {} location.href = (pend && pend.back) || "/map.html"; }; }
        Array.prototype.forEach.call(winEl.querySelectorAll("a"), function (a) { var h = a.getAttribute("href") || ""; if (/play\.html|map\.html/.test(h)) a.style.display = "none"; });
        return true;
      }
    } catch (e) {}
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
    if (!proto) btn.style.cssText = "margin-top:14px;border:none;border-radius:16px;padding:15px 44px;font-family:'Baloo 2',sans-serif;font-weight:800;font-size:18px;color:#fff;background:#58cc02;box-shadow:0 5px 0 0 #46a302;cursor:pointer;";
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
  function startPilot(code) { try { const cur = pilotInfo(); save(PILOTKEY, { code: (code || cur.code || "pilot"), childId: cur.childId || (Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)), consent: true, consentAt: new Date().toISOString(), ver: 1 }); } catch (e) {} }
  // how many levels are open: pilot families get the whole town; everyone else Level 1 for now.
  function unlockedThru() { return isPilot() ? 10 : 1; }

  // outcome capture: every scored attempt → per-sound accuracy over time (the "does it work" data).
  const ATTKEY = "sona.attempts.v1", OUTKEY = "sona.outcomes.v1";
  function logAttempt(a) {
    try {
      a = a || {}; const sound = a.sound || "?", pass = !!a.pass, day = today();
      const word = String(a.word || "").toLowerCase();
      const log = load(ATTKEY, []); log.push({ g: a.game || "", s: sound, p: pass, sc: (typeof a.score === "number" ? Math.round(a.score) : null), w: word, t: Date.now() });
      save(ATTKEY, log.slice(-600));
      const o = load(OUTKEY, {}); const bs = o[sound] || (o[sound] = { attempts: 0, passes: 0, firstAt: day, lastAt: day, days: {} });
      bs.attempts++; if (pass) bs.passes++; bs.lastAt = day;
      const d = bs.days[day] || (bs.days[day] = { a: 0, p: 0 }); d.a++; if (pass) d.p++;
      // by word position (initial/medial/final/vocalic/blends) — the clinical breakdown.
      // Prefer the word's own tagged position; else fall back to the practice setting.
      let pos = a.pos || "";
      if (!pos && word) { const hit = (WORDS[sound] || []).filter(function (x) { return x.w === word; })[0]; if (hit) pos = hit.pos || "i"; }
      if (!pos) { try { pos = getProfile().practicePosition || ""; } catch (e) { pos = ""; } }
      if (pos && pos !== "mix" && pos !== "all") {
        bs.byPos = bs.byPos || {}; const bp = bs.byPos[pos] || (bs.byPos[pos] = { a: 0, p: 0 }); bp.a++; if (pass) bp.p++;
      }
      // by target word — per-word accuracy (word games pass a.word)
      if (word) { bs.byWord = bs.byWord || {}; const bw = bs.byWord[word] || (bs.byWord[word] = { a: 0, p: 0 }); bw.a++; if (pass) bw.p++; }
      save(OUTKEY, o);
      // keep Today/Progress alive from real game play (not just the lesson flow):
      // every scored attempt counts a word and keeps today's streak going.
      try { const g = getProgress(); g.totals.words = (g.totals.words || 0) + 1; bumpStreak(g); save(GKEY, g); } catch (e2) {}
      // pilot/founding beacon: consented, counts-only, throttled to 1/min inside sendProgress
      try { sendProgress("auto"); } catch (e3) {}
    } catch (e) {}
  }
  function outcomes() { return load(OUTKEY, {}); }

  // ── Native audio capture (iOS) ──────────────────────────────────────────────
  // On the native iOS app (Capacitor) a custom `SonaAudio` plugin captures CLEAN
  // PCM via AVAudioSession `.measurement` mode (no auto-gain / noise-suppression
  // / high-pass) — preserving the high-frequency detail /s,sh,ch,th/ need. On the
  // web we fall back to MediaRecorder on the game's existing mic stream. Either
  // way captureClip() resolves to { blob, transcript, spoke } that /api/score
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
    if (_ff) { startPilot("ff-" + _ff); setTimeout(function () { try { sendProgress("enroll"); } catch (e) {} }, 900); }
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

  // ── debug HUD: with ?debug=1 (sticky; ?debug=0 to clear), show the SpeechAce score on screen ──
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
      if (url.indexOf("/api/score") !== -1) { try { p.then(function (r) { try { r.clone().json().then(function (j) { debugScore(req, j); }).catch(function () {}); } catch (e) {} return r; }).catch(function () {}); } catch (e) {} }
      return p;
    };
    try { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", debugBox); else debugBox(); } catch (e) {}
  }
  try { installDebug(); } catch (e) {}

  global.Sona = { pic, ICONS, icon, heartRow, WORD_STICKERS, COVER_FACES, momWeek, weeklyGoalDays, weekWins, ALL_SOUNDS, soundLabel, SOUND_NORM, soundNorm, STAGES, CHARACTERS, OUTFITS, BACKDROPS, VOICE_PITCH, HOUSE_PALETTE, WORDS, wordsFor, POSITIONS, THEMES, houseArt, dayNum, dayTheme, dailyPick, characterById, outfitById, backdropById, buddyMarkup, getProfile, saveProfile, getProgress, recordSession, resetProgress, exportData, exportString, importData, tickets, addTickets, spendTicket, chargeState, chargeAdd, chargeReset, dailyInfo, dailyFinish, micDenied, stageOf, completeStage, LADDER, LADDER_LABEL, rungOf, rungName, rungLabel, recordRung, ladderContent, ROT_LEN, rotSounds, rotState, rotSound, rotRound, rotAdvance, todayRing, soundFamily, frameShape, checkSounds, checkItems, gradeSound, saveCheck, lastCheck, checkHistory, checkDue, buildPlan, getPlan, soundStory, chestClaimed, claimChest, getMissed: () => getProgress().missed, getCoins, addCoins, spendCoins, owns, addOwned, getSub, saveSub, isSubscribed, gated, isNativeApp, getTrial, startTrial, ensureTrial, trialActive, trialExpired, trialDaysLeft, restore, saveRecording, listRecordings, sfx, music, confetti, pop, LEVEL_GAMES, GAME_DECK, GAMES_PER_LEVEL, levelGames, GAME_META, gameMeta, session, diff, markLevelDone, levelDone, WORLDS, LEVELS_PER_WORLD, campaignLevels, campaignSounds, campaignState, worldById, worldLevels, worldStars, worldCleared, levelStars, setLevelStars, totalStars, worldUnlocked, levelUnlocked, campaignLaunch, campaignResolve, sessionButtons, utm, startPilot, isPilot, pilotInfo, unlockedThru, logAttempt, outcomes, hasNativeAudio, captureClip, sendProgress, sendFeedback, reportError, debugOn, STICKERS, stickersEarned, hasSticker, awardSticker, awardNextSticker, awardRandomSticker, cue, CUES, coachLine, soundSay, SOUND_SAY, actionCue, repeatCue, praiseLine, PRAISES };
})(window);
