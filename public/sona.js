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
    "sona.stickers.v1", "sona.attempts.v1", "sona.outcomes.v1",
    "sona.lib.read.v1", "sona.feed.v1", "sona.call.v1", "sona.callhist.v1",
    "sona.games.v1", "sona.homework.v1",
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
  function addKid(name, age) {
    const v = _kids();
    // slots are never reused — a removed kid's leftover keys must not become a
    // new child's history
    let n = 2; const taken = new Set(v.list.map((k) => k.slot));
    while (taken.has("k" + n)) n++;
    const slot = "k" + n;
    v.list.push({ slot, name: String(name || "").slice(0, 24) });
    v.active = slot;
    _saveKids(v);
    // written through the namespace, so this lands on the NEW kid
    save(PKEY, Object.assign(clone(DEFAULT_PROFILE), {
      childName: String(name || "").slice(0, 24),
      childAge: String(age || ""),
      onboarded: false,
    }));
    return slot;
  }
  function switchKid(slot) {
    const v = _kids();
    if (!v.list.some((k) => k.slot === slot)) return false;
    v.active = slot; _saveKids(v); return true;
  }
  function removeKid(slot) {
    const v = _kids();
    if (v.list.length < 2) return false;              // never leave zero children
    v.list = v.list.filter((k) => k.slot !== slot);
    if (v.active === slot) v.active = v.list[0].slot;
    _saveKids(v);
    // drop that child's practice data; slot "" (the first kid) shares the
    // un-suffixed keys, so only a suffixed slot is safe to clear
    if (slot) { try { PER_KID.forEach((k) => localStorage.removeItem(k + "@" + slot)); } catch (e) {} }
    return true;
  }

  // SET1 replaced three audio checkboxes with one volume slider, but a profile
  // saved BEFORE that can still carry voiceOn:false — and there is no longer a
  // control anywhere that can set it back to true. Echo goes silent forever and
  // the parent has nothing to press. Reconcile the legacy flags with the volume
  // that now owns them: audible volume means audible Echo.
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
  // family who set up but never practised has none at all.
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
    // migrate old/empty default voices (Jessica, Will, and the prior Leo) to the current voice
    if (!p.voiceId || p.voiceId === "cgSgspJ2msm6clMCkdW9" || p.voiceId === "bIHbv24MWmeRgasZH58o" || p.voiceId === "SF6OznV7UB2AxeidTpie") p.voiceId = DEFAULT_PROFILE.voiceId;
    // one-time repair: the default used to be 0.3 and the Settings slider that
    // could change it was removed, so families were stuck at 30% volume with
    // no way up. Lift only that exact value — a deliberate 0.3 is unreachable
    // today, and anything else the family chose is left alone.
    if (p.volume === 0.3) { p.volume = 0.8; try { save(PKEY, Object.assign({}, load(PKEY, {}), { volume: 0.8 })); } catch (e) {} }
    return _healAudioFlags(p);
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
  // practises yesterday's assignment rather than nothing.
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
  let _hwAt = 0;
  function syncHomework(force) {
    try {
      if (!isPilot()) return Promise.resolve(null);
      const now = Date.now();
      if (!force && now - _hwAt < 3600000) return Promise.resolve(homework());
      _hwAt = now;
      const pi = pilotInfo(), code = pi.code || "", childId = pi.childId || "";
      let ticket = ""; try { ticket = localStorage.getItem("sona.slpticket") || ""; } catch (e) {}
      if (!code || !childId || !ticket) return Promise.resolve(null);
      const body = { code: code, childId: childId, ticket: ticket };
      // TODAY'S TOTAL, never a delta — a retried request cannot inflate it,
      // the same reason mintCoins() derives from the day's count rather than
      // incrementing. Reps only; no audio, no name, nothing else.
      const cur = homework();
      if (cur) { body.forId = cur.id; body.reps = repsToday(); }
      return fetch("/api/homework", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json()).then((j) => {
        if (j && j.ok) save(HWKEY, { hw: j.hw || null, at: Date.now() });
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
  // The position to practise: the assignment's, else the family's setting.
  // One reader for both, so a page cannot honour homework for the sound and
  // quietly ignore it for the position.
  function practicePos() {
    const hw = homework();
    if (hw && hw.pos) return hw.pos;
    try { return getProfile().practicePosition || "i"; } catch (e) { return "i"; }
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
    try { mintStoryBonus(); } catch (e) {}          // once per day, guarded in the ledger
    try { episodeAdvance(); } catch (e) {}          // day-guarded: sets up tomorrow
    return true;
  }
  // The three games offered today: TODAY'S CHAPTER'S three. Stable across
  // refreshes and across a parent and child looking at the same phone, because
  // the chapter is pinned for the day — so "did I already play today's set?"
  // has one answer, and the answer never changes underneath a child.
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
    // Feed Echo is the littles game: no reading, no timer. Under 6 it leads,
    // whatever the chapter asked for, because the alternative is a
    // four-year-old facing three games none of which they can play. The
    // chapter loses its third pick rather than the child losing their day.
    const age = parseInt(getProfile().childAge, 10) || 0;
    if (age && age < 6 && trio[0] !== "feed") {
      return ["feed"].concat(trio.filter((k) => k !== "feed")).slice(0, DAILY_GAMES);
    }
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
  const REP_GOAL_DEFAULT = 25;
  function repGoal() {
    // An assignment's daily target outranks the family's own — the clinician
    // set it, and the jar the child is filling should be the one they set.
    const hw = homework();
    if (hw && hw.repsPerDay > 0) return hw.repsPerDay;
    const g = parseInt(getProfile().dailyGoal, 10) || 0;
    return g > 0 ? g : REP_GOAL_DEFAULT;
  }
  function goalState() {
    const n = repsToday(), goal = repGoal();
    return { n, goal, pct: Math.max(0, Math.min(1, n / goal)), full: n >= goal };
  }

  // ── COIN1: coins spend across days, the meter resets each night ────────
  // Two different jobs. The meter answers "am I done today?"; coins answer
  // "what did all those days add up to?" — which is what carries a kid over a
  // day when none of today's three games appeal.
  //
  // Coins are minted from reps, NOT from time in the app and NOT from opening
  // things. Same rule as the meter: only a child's actual voice earns.
  const COINS_PER = 5;                       // one coin per 5 honest reps
  const COIN_STORY = 5;                      // finishing the daily chapter
  const MYSTERY_COST = 15;                   // the 4th game, bought for a day
  const COINKEY = "sona.coinmint.v1";
  // Minting is derived from the day's rep count rather than incremented per
  // rep, so a double-fired bumpReps can't double-pay — the ledger records how
  // many coins today has already yielded and only ever pays the difference.
  function mintCoins() {
    const t = today(); const led = load(COINKEY, {});
    const paid = (led.d === t ? led.paid : 0) | 0;
    const earned = Math.floor(repsToday() / COINS_PER);
    const owed = earned - paid;
    if (owed > 0) { addCoins(owed); save(COINKEY, { d: t, paid: earned, story: !!(led.d === t && led.story) }); }
    return getCoins();
  }
  function mintStoryBonus() {
    const t = today(); const led = load(COINKEY, {});
    if (led.d === t && led.story) return getCoins();      // once per day only
    addCoins(COIN_STORY);
    save(COINKEY, { d: t, paid: (led.d === t ? led.paid : 0) | 0, story: true });
    return getCoins();
  }
  // The mystery game: one extra game for today, drawn from the ones NOT in
  // today's trio. Deliberately ADDITIVE — it never opens the whole deck and it
  // never skips the story, because a coin that buys past the gate would undo
  // the reason the gate exists.
  function mysteryCost() { return MYSTERY_COST; }
  function mysteryGame() {
    const d = _day();
    if (d && d.mystery) return d.mystery;
    return null;
  }
  function canBuyMystery() {
    return storyRead() && !mysteryGame() && getCoins() >= MYSTERY_COST;
  }
  function buyMystery() {
    if (!canBuyMystery()) return null;
    const trio = dailyGames();
    const rest = GAME_KEYS.filter((k) => trio.indexOf(k) === -1);
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
    if (lvl === "sentence") return (SC && SC.sentences ? SC.sentences(sound) : ws().map((w) => ({ t: w.w, say: w.w, e: w.e, word: w.w }))).map((s) => ({ t: s.t, say: s.say, display: s.t, e: s.e, word: s.word, level: "sentence", mode: "full" }));
    if (lvl === "conversation") return (SC && SC.chats ? SC.chats(sound) : []).map((c) => ({ q: c.q, options: c.options, level: "conversation", mode: "full" }));
    return [];
  }

  // ── the week, narrated ────────────────────────────────────────────────
  // The Sound Story: a plain-language read of the week from REAL practice
  // data — days practised, reps out loud, and honest-scoring movement on the
  // rotating sound. It used to also report Sound Check grade changes; the
  // Sound Check is gone, and a weekly AI evaluation was never what made this
  // card useful to a parent. Unofficial by design: a practice snapshot to
  // share with an SLP, never an evaluation or a diagnosis.
  function soundStory() {
    const w = weekWins(); const mw = momWeek();
    const name = getProfile().childName || "Your kid";
    const bits = [];
    bits.push(name + " practiced " + mw.done + (mw.done === 1 ? " day" : " days") + " this week" + (w.reps > 0 ? " and said " + w.reps + (w.reps === 1 ? " sound" : " sounds") + " out loud." : "."));
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
  // Word positions for targeted practice — SLPs pick where in the word the sound sits.
  const POSITIONS = [
    { id: "i", name: "Beginning" }, { id: "m", name: "Middle" }, { id: "f", name: "End" },
    { id: "v", name: "Vocalic R" }, { id: "b", name: "Blends" }, { id: "mix", name: "Mixed" },
  ];
  function wordsFor(sound, pos) {
    // An assignment may name its own words. Only words this app already knows
    // are used — an SLP typing a word with no recorded target is a silent
    // dead end, so unknown ones fall through to the bank rather than shipping
    // a round the child cannot pass.
    try {
      const hw = homework();
      if (hw && hw.words && hw.words.length && hw.sounds.indexOf(String(sound).toUpperCase()) >= 0) {
        const want = {}; hw.words.forEach(function (w) { want[String(w).toLowerCase()] = 1; });
        const pick = (WORDS[sound] || []).filter(function (w) { return want[String(w.w).toLowerCase()]; });
        if (pick.length) return pick;
      }
    } catch (e) {}
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
  // Backup restores PRACTICE, never ACCESS. It used to write any key beginning
  // "sona." verbatim, which made a backup code a paste-in paywall bypass: hand
  // someone a string containing sona.sub.v1 and they were a subscriber. Every
  // entitlement lives server-side or behind a verified credential, and every
  // one of them can be re-established on a new device by restoring with an
  // email or re-opening an SLP link — so dropping them here costs a real
  // family nothing and costs a forger everything.
  const NO_IMPORT = ["sona.sub.v1", "sona.slpunlock", "sona.slpok", "sona.founder", "sona.paidui", "sona.pilot.v1", "sona.trial.v1"];
  function importData(payload) {
    try {
      const obj = (typeof payload === "string") ? JSON.parse(payload) : payload;
      const data = (obj && obj.data && typeof obj.data === "object") ? obj.data : obj;
      if (!data || typeof data !== "object") return { ok: false, error: "That backup didn't look right." };
      let n = 0, skipped = 0;
      Object.keys(data).forEach((k) => {
        if (k.indexOf("sona.") !== 0) return;
        // the base key, so "sona.profile.v1@k2" is judged like "sona.profile.v1"
        const base = k.split("@")[0];
        if (NO_IMPORT.indexOf(base) !== -1) { skipped++; return; }
        let v = String(data[k]);
        // earlyAdopter rides INSIDE the profile, so a key-level block misses it
        if (base === PKEY) {
          try { const p = JSON.parse(v); if (p && typeof p === "object") { delete p.earlyAdopter; v = JSON.stringify(p); } } catch (e) {}
        }
        try { localStorage.setItem(k, v); n++; } catch (e) {}
      });
      if (!n) return { ok: false, error: "No Sona data found in that backup." };
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
        '<img src="/coach/echo/echo-idle.svg" alt="Echo" style="width:100px;height:100px;object-fit:contain;" onerror="this.outerHTML=\'<div style=&quot;font-size:64px&quot;>🦜</div>\'" />' +
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

  // Launch gate: subscribers, pilots and founding families (SLP-referred —
  // that free-forever promise IS the SLP channel) are always in; everyone else
  // gets a 3-day free trial, then the paywall. (Library, customize, progress
  // stay open.) The native shell gates exactly like the web now — the old
  // "native never gates" bypass predates the Apple IAP rail and would have
  // made the App Store build free forever with an ignorable paywall.
  // FREE MODE first: nothing is gated, so a kid page can never bounce to a
  // price screen mid-play (the audit caught Story Time doing exactly that).
  // Gates fire at PAGE LOAD only, never mid-round.
  function gated() {
    if (isFree()) return false;
    if (isFounder()) return false;
    if (slpVerified()) return false;                 // device redeemed a valid SLP credential
    if (isSubscribed() || isPilot()) return false;
    if (earlyAdopterAnyKid()) return false;
    ensureTrial();
    return trialExpired();
  }
  // earlyAdopter lives on the PROFILE, and the profile is per-kid — so a
  // founding or SLP-referred family that added a second child had the first one
  // playing free while the sibling hit a paywall on the same device. Access was
  // never granted to a child; it was granted to the household.
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
  // Verify a subscription by email (Stripe is the source of truth) and cache it,
  // so a paid family can unlock on a new device / after clearing storage.
  // SECURITY (F7, founder review): email-only is a weak second factor — the
  // real fix is an emailed one-time code (needs RESEND_API_KEY). The endpoint
  // is rate-limited server-side as the interim guard; the secure hand-off path
  // is the single-use move-in code, not this.
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


  // ── SLP caseload links: speaksona.com/join.html?slp=CODE&k=KEY ──────────
  // An SLP shares their credential — code (the "username") + family key (the
  // "password") — and their families get Sona free, forever. Pricing is LIVE,
  // so the grant is SERVER-VERIFIED: the old honor system unlocked for any
  // string in the URL, which was a paywall hole. The code still sticks
  // unverified (it keys the roster and the funnel), but free access needs the
  // key to check out.
  //
  // Verifying UNLOCKS. It does not enrol — that takes the grown-up's explicit
  // consent on /join.html, which calls slpJoinCaseload() below. Access and
  // surveillance are separate decisions, and a family can take the free app
  // without agreeing to be watched.
  function _slpVerify(code, key) {
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
    return fetch("/api/slp/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, key, childId: cid }),
    }).then((r) => r.json()).then((j) => {
      if (j && j.ok && j.valid) {
        try { localStorage.setItem("sona.slpok", code.toUpperCase()); localStorage.setItem("sona.slpunlock", "1"); } catch (e) {}
        // The enrolment ticket is this device's proof that it passed code+key.
        // /api/pilot refuses a roster write without it, which is what stops
        // anyone who merely knows the code from inventing children on a real
        // clinician's dashboard.
        try { if (j.ticket) localStorage.setItem("sona.slpticket", String(j.ticket)); } catch (e) {}
        // a family that already finished onboarding gets patched in place —
        // the link can arrive after setup (e.g. re-sent by the SLP)
        try { const pr = getProfile(); if (pr.onboarded || pr.childName) saveProfile({ earlyAdopter: true, slpCode: code.toUpperCase() }); } catch (e) {}
        // the funnel event means A REAL FAMILY UNLOCKED — only the valid
        // branch may fire it, or the SLP ranking counts garbage
        try { track("slp code redeemed", { code: code.toUpperCase() }); } catch (e) {}
        return { valid: true, name: j.name || "" };
      }
      return { valid: false, error: (j && j.error) || "" };
    }).catch(() => ({ valid: false, error: "offline" }));
  }
  // Typed entry (paywall surfaces): same verification, same grant.
  function slpRedeem(code, key) { return _slpVerify(String(code || ""), String(key || "")); }

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
  // below skips re-checking a code whose slpok already matches, so those
  // families could never heal themselves by re-opening their own link.
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
  // The home screen's grown-ups gate (PIN or math, in today.html) calls
  // gateVerify() when the adult passes it. Parent-only pages (progress,
  // settings, voices, subscribe) call requireGate() on load so a child can't
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
  function requireGate(redirect) {
    if (gateOk()) { gateVerify(); gateWatch(); return true; }
    try { document.documentElement.style.visibility = "hidden"; } catch (e) {}
    try { location.replace(redirect || "/today.html?gate=1"); } catch (e) {}
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
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const tx = db.transaction("recordings", "readwrite");
        // KIDS1: stamp the owning child. The store is one IndexedDB table for
        // the device, so without this a sibling's Progress page listed — and
        // played — another child's voice.
        tx.objectStore("recordings").add(Object.assign({ date: new Date().toISOString(), kid: _slot() }, rec));
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
        const mine = _slot();
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
  function sfxVol() { try { const p = getProfile(); if (p.soundOn === false) return 0; return (p.volume != null ? p.volume : 0.6); } catch (e) { return 0.6; } }
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
  };
  function gameMeta(file) {
    const k = String(file || "").replace(/^\//, "").split("?")[0];
    return GAME_META[k] || { name: "Game", icon: "🎮", band: "", c: "#1cb0f6" };
  }
  // The games the daily trio is drawn from. This lived inline in today.html;
  // it moved here because dailyGames() has to pick from the same list the home
  // screen paints, and two copies of a list is one copy that goes stale.
  const GAME_ACTS = {
    slice: { name: "Fruit Slice",   sub: "Say it 5× to play",          go: "/charge.html?game=arcade-slice.html" },
    tiles: { name: "Piano Tiles",   sub: "Say it 5× to play",          go: "/charge.html?game=arcade-tiles.html" },
    stack: { name: "Block Stacker", sub: "Say it 5× to play",          go: "/charge.html?game=arcade-stack.html" },
    run:   { name: "Sound Sprint",  sub: "Say it 5× to play",          go: "/charge.html?game=arcade-run.html" },
    glide: { name: "Flappy Glide",  sub: "Say it 5× to play",          go: "/charge.html?game=arcade-glide.html" },
    feed:  { name: "Feed Echo",     sub: "Say it & tap — Echo's hungry!", go: "/arcade-feed.html" },
  };
  const GAME_KEYS = ["slice", "tiles", "stack", "run", "glide", "feed"];
  function gameAct(key) { return GAME_ACTS[key] || null; }
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
    let reps = 0; Object.keys(o).forEach(function (s) { const bs = o[s]; if (bs && bs.days) Object.keys(bs.days).forEach(function (k) { if (inRange(k, start, end)) reps += bs.days[k].a || 0; }); });
    return { sound: snd, label: soundLabel(snd), reps: reps, acc: acc(start, end), accPrev: acc(prev, start), week: momWeek() };
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
      if (!pos) { try { pos = practicePos(); } catch (e) { pos = ""; } }
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

  // ── weekly practice volume (the parent's headline metric) ────────────────
  // Total honest reps this Mon–Sun week, summed from the attempt log. Volume
  // is a PARENT-side motivator: kids keep the ring, never rep quotas. The
  // beacon ships {anonymous id, week, count} — no names, no audio, no
  // accuracy — so families can see how their practice volume compares.
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
  function weekReps(offsetWeeks) {
    const now = new Date(); if (offsetWeeks) now.setDate(now.getDate() + offsetWeeks * 7);
    const dow = (now.getDay() + 6) % 7;
    const mon = new Date(now); mon.setDate(now.getDate() - dow); mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 7);
    const out = outcomes(); let total = 0;
    Object.keys(out).forEach((s) => {
      const days = (out[s] && out[s].days) || {};
      Object.keys(days).forEach((d) => {
        const t = new Date(d + "T12:00:00");
        if (t >= mon && t < sun) total += (days[d] && days[d].a) || 0;
      });
    });
    return total;
  }
  function repsBeacon() {
    try {
      const week = isoWeek(), reps = weekReps(), f = fid();
      if (!f) return;
      const st = load("sona.repsync.v1", {});
      if (st.week === week && st.reps === reps && Date.now() - (st.at || 0) < 6 * 3600 * 1000) return;
      save("sona.repsync.v1", { week, reps, at: Date.now() });
      fetch("/api/reps", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ fid: f, week, reps }) }).catch(() => {});
    } catch (e) {}
  }

  // ── Native audio capture (iOS) ──────────────────────────────────────────────
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
  // The App Store build sells "Sona Yearly" ($79.99/yr, 7-day free trial —
  // ONE offer) through Apple's sheet via the @revenuecat/purchases-capacitor
  // plugin — reached over the same remote-page bridge SonaAudio already uses.
  // Web visitors never touch this (Stripe stays the web rail). We purchase
  // DIRECTLY by product id (no offerings dependency) and unlock on the "full"
  // entitlement. The appl_ key is publishable by design.
  // NOTE: this product id is already App Store-approved; the price lives in
  // App Store Connect, and the paywall renders whatever ASC reports.
  // ── FREE MODE ──────────────────────────────────────────────────────────
  // OFF: pricing is live — $9.99/mo billed at purchase with NO trial, or
  // $59.99/yr after a 3-day free trial.
  //
  // The free window this reverses ran five days. The boundary between the two
  // free eras was drawn WHILE free (see _grandfatherFreeEra below), which is
  // what makes flipping back honest rather than a broken promise: devices from
  // the FIRST free era are already stamped "grandfathered" and never gate,
  // devices from the second are stamped "post" and do. Nothing needs deciding
  // now because it was decided then, on the only day the evidence existed.
  //
  // ONE switch, honoured by every purchase surface. Four cohorts stay free
  // regardless of it: SLP-referred families (the ?slp= credential — that
  // promise IS the SLP channel), pilots, founders, and every family who was
  // already using Sona while it was free. That last group is grandfathered by
  // _grandfatherFreeEra(); it is a promise to those families, not a growth
  // tactic, and it is not up for quiet reinterpretation.
  // Recorded human model clips (/coach/say/<SOUND>[-demo].mp3) are Rachel's own
  // voice. OFF everywhere until a non-Rachel set exists. This MUST live here,
  // not per-page: charge.html gated it locally and coach-call.html went on
  // playing them ungated, so her voice shipped anyway.
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
    story: ["st-story", "peach"], chapter: ["st-story", "peach"],
  };
  function gameSticker(key) { return GAME_STICKER[String(key || "").replace(/^arcade-|\.html$/g, "")] || GAME_STICKER.story; }

  const HUMAN_CLIPS = false;
  function humanClipsOn() { return HUMAN_CLIPS; }

  const FREE_MODE = false;
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

  const IAP_KEY = "appl_nONRfALUCMiZczeCggXKEusmVtl";
  // Two auto-renewable products in the "full" entitlement. The annual id is
  // the ORIGINAL one — its price changes in App Store Connect ($39.99 →
  // $59.99, existing subscribers preserved), so early buyers keep their rate
  // without any code caring.
  const IAP_PRODUCTS = { annual: "com.speaksona.app.annual", monthly: "com.speaksona.app.monthly" };
  const IAP_PRODUCT = IAP_PRODUCTS.annual;
  const IAP_TYPE = "subs"; // auto-renewable subscription
  const IAP_ENTITLEMENT = "full";
  function iapPlugin() {
    try { const C = global.Capacitor; return (C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Purchases) ? C.Plugins.Purchases : null; } catch (e) { return null; }
  }
  function iapAvailable() { return !!iapPlugin(); }
  let _iapReady = null;
  function iapConfigure() {
    const P = iapPlugin(); if (!P) return Promise.reject(new Error("no-iap"));
    if (!_iapReady) _iapReady = Promise.resolve(P.configure({ apiKey: IAP_KEY })).catch(() => {}); // configure is idempotent enough; never block on it twice
    return _iapReady.then(() => P);
  }
  function _iapActive(info) {
    try { const e = info && (info.customerInfo || info); return !!(e && e.entitlements && e.entitlements.active && e.entitlements.active[IAP_ENTITLEMENT]); } catch (e2) { return false; }
  }
  function _iapUnlock() { saveSub({ active: true, source: "apple", since: Date.now() }); }
  // fetch the live product (price string comes from the App Store, locale-
  // correct). kind: "annual" (default) | "monthly".
  function iapProduct(kind) {
    const id = IAP_PRODUCTS[kind || "annual"] || IAP_PRODUCT;
    return iapConfigure().then((P) =>
      Promise.resolve(P.getProducts({ productIdentifiers: [id], type: IAP_TYPE }))
        .catch(() => P.getProducts({ productIdentifiers: [id] }))
        .then((r) => (r && r.products && r.products[0]) || null)
    );
  }
  // buy: try the modern API first, fall back across plugin versions
  function iapPurchase(kind) {
    const id = IAP_PRODUCTS[kind || "annual"] || IAP_PRODUCT;
    return iapConfigure().then((P) =>
      iapProduct(kind).then((product) => {
        const attempts = [];
        if (product && P.purchaseStoreProduct) attempts.push(() => P.purchaseStoreProduct({ product }));
        if (P.purchaseProduct) attempts.push(() => P.purchaseProduct({ productIdentifier: id, type: IAP_TYPE }));
        let p = Promise.reject(new Error("no-purchase-api"));
        attempts.forEach((fn) => { p = p.catch(fn); });
        return p;
      })
    ).then((res) => {
      if (res && res.userCancelled) throw Object.assign(new Error("cancelled"), { cancelled: true });
      if (_iapActive(res)) { _iapUnlock(); return { ok: true }; }
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
  function iapRefresh(force) {
    if (!iapAvailable()) return Promise.resolve(false);
    if (!force && isSubscribed()) return Promise.resolve(true);
    return iapConfigure().then((P) => P.getCustomerInfo()).then((info) => {
      const active = _iapActive(info);
      if (active) _iapUnlock();
      return active;
    }).catch(() => false);
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
            if (j && j.valid) { startPilot("ff-" + _ff); try { sendProgress("enroll"); } catch (e) {} }
          })
          .catch(function () {});
      } catch (e) {}
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
  try { installDebug(); } catch (e) {}

  global.Sona = { pic, ICONS, icon, heartRow, WORD_STICKERS, COVER_FACES, momWeek, weeklyGoalDays, weekWins, ALL_SOUNDS, PLAY_ORDER, playMode, soundLabel, SOUND_NORM, soundNorm, STAGES, CHARACTERS, OUTFITS, BACKDROPS, VOICE_PITCH, HOUSE_PALETTE, WORDS, wordsFor, POSITIONS, THEMES, houseArt, dayNum, dayTheme, dailyPick, characterById, outfitById, backdropById, buddyMarkup, kids, activeKid, addKid, switchKid, removeKid, kkey, getProfile, saveProfile, getProgress, recordSession, resetProgress, exportData, exportString, importData, tickets, addTickets, spendTicket, chargeState, chargeAdd, chargeReset, dailyInfo, dailyFinish, micDenied, stageOf, completeStage, LADDER, LADDER_LABEL, rungOf, rungName, rungLabel, recordRung, ladderContent, FREE_MODE, isFree, HUMAN_CLIPS, humanClipsOn, onBackground, ROT_LEN, rotSounds, rotState, rotSound, rotRound, rotAdvance, todayRing, track, EPISODES, episode, episodeNum, episodeBeat, episodeHook, episodeAdvance, dailyStory, dailyChapterNum, chapterScene, chapterPose, storyRead, markStoryRead, dailyGames, DAILY_GAMES, GAME_ACTS, GAME_KEYS, gameAct, bumpReps, repsToday, repGoal, goalState, mintCoins, mintStoryBonus, mysteryCost, mysteryGame, canBuyMystery, buyMystery, pathState, localDay: () => _localDay(), soundFamily, frameShape, soundStory, chestClaimed, claimChest, getMissed: () => getProgress().missed, getCoins, addCoins, spendCoins, owns, addOwned, getSub, saveSub, isSubscribed, gated, gateVerify, gateOk, requireGate, slpCode, slpRedeem, slpVerified, slpJoinCaseload, isFounder, founderUnlock, offerCode, homework, homeworkSounds, syncHomework, practicePos, stickerSheet, stickerBox, paintSticker, gameSticker, STICKER_FIELDS, isNativeApp, iapAvailable, iapProduct, iapPurchase, iapRestore, iapRefresh, getTrial, startTrial, ensureTrial, trialActive, trialExpired, trialDaysLeft, restore, saveRecording, listRecordings, sfx, music, confetti, pop, GAME_META, gameMeta, session, diff, markLevelDone, levelDone, sessionButtons, utm, startPilot, isPilot, pilotInfo, unlockedThru, logAttempt, outcomes, fid, isoWeek, weekReps, repsBeacon, hasNativeAudio, captureClip, sendProgress, sendFeedback, reportError, debugOn, STICKERS, stickersEarned, hasSticker, awardSticker, awardNextSticker, awardRandomSticker, cue, CUES, coachLine, soundSay, SOUND_SAY, actionCue, repeatCue, praiseLine, PRAISES };
})(window);
