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
  // (e.g. /coach/leo.png) once the separated character poses arrive.
  const CHARACTERS = [
    { id: "leo",    name: "Leo",   emoji: "🦁", img: "/coach/leo.png", locked: false },
    { id: "frog",   name: "Pip",   emoji: "🐸", locked: true },
    { id: "bear",   name: "Bruno", emoji: "🐻", locked: true },
    { id: "fox",    name: "Fern",  emoji: "🦊", locked: true },
    { id: "panda",  name: "Bao",   emoji: "🐼", locked: true },
    { id: "rabbit", name: "Hop",   emoji: "🐰", locked: true },
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

  const DEFAULT_PROFILE = { childName: "", childAge: "", focusSounds: ["R", "S", "L", "K"], voiceOn: true, coachName: "Coach", cloudScoring: true, slpEvaluated: "", goals: "", focusArea: "articulation", interests: [], language: "en", character: "leo", outfit: "none", backdrop: "sky", soundOn: true, voiceId: "qBDvhofpxp92JgXJxDjB", volume: 0.3, musicOn: false, dailyMinutes: 5, owned: { outfits: ["none"], backdrops: ["sky"] }, onboarded: false };
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
  const today = () => new Date().toISOString().slice(0, 10);
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
    const t = today();
    if (g.streak.lastDate !== t) {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      g.streak.count = (g.streak.lastDate === y) ? g.streak.count + 1 : 1;
      g.streak.lastDate = t;
    }
    save(GKEY, g);
    return g;
  }
  function resetProgress() { save(GKEY, clone(DEFAULT_PROGRESS)); }

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
  function mirrorTrial(t) { try { fetch("/api/trial", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ email: t.email || "", start: t.start, days: t.days || TRIAL_DAYS }) }); } catch (e) {} }
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
  function pic(word, emoji, size) {
    size = size || 64; var em = emoji || "⭐"; var slug = slugify(word);
    var sp = '<span style="font-size:' + size + 'px;line-height:1;vertical-align:middle;">' + em + '</span>';
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
  const LEVEL_GAMES = ["rocket.html", "bubble.html", "racer.html", "grocery.html", "train.html"];
  // ── rotating game deck ──
  // All ten games, ordered so each level mixes complexity bands (warm-up · word ·
  // connected speech). Each level deals GAMES_PER_LEVEL games from the deck, so a
  // given game doesn't reappear for ~4 levels; and since difficulty = the level
  // number, each time a game comes back around it's the harder version.
  const GAME_DECK = ["rocket.html", "racer.html", "grocery.html", "bubble.html", "cupstack.html", "builder.html", "train.html", "whack.html", "story.html", "match.html", "chat.html"];
  const GAMES_PER_LEVEL = 3;
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
    { id: "builder",  game: "builder.html",  name: "Build Site",  theme: "🧱", sky: "linear-gradient(180deg,#ffe9c9,#ffd79a 55%,#f0b35e)" },
    { id: "train",    game: "train.html",    name: "Railroad",    theme: "🚂", sky: "linear-gradient(180deg,#cdeffd,#bdebc4 60%,#7fc36a)" },
    { id: "whack",    game: "whack.html",    name: "The Garden",  theme: "🌻", sky: "linear-gradient(180deg,#dff4ff,#cdebb0 60%,#8fd07a)" },
    { id: "match",    game: "match.html",    name: "Memory Lane", theme: "🃏", sky: "linear-gradient(180deg,#efe6ff,#d9c8ff 55%,#b79bff)" },
    { id: "story",    game: "story.html",    name: "Storybook",   theme: "📖", sky: "linear-gradient(180deg,#eafbe4,#cdebb0 60%,#9ad07a)" },
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
    if (hasNativeAudio()) {
      return global.Capacitor.Plugins.SonaAudio.record({ maxMs: opts.maxMs || 6000 })
        .then((r) => ({ blob: (r && r.wav) ? _b64ToBlob(r.wav, "audio/wav") : null, transcript: "", spoke: !!(r && r.spoke), native: true }))
        .catch(() => ({ blob: null, transcript: "", spoke: false, native: true }));
    }
    // web fallback: MediaRecorder on a provided MediaStream (opts.stream)
    return new Promise((resolve) => {
      const stream = opts.stream;
      if (!stream || typeof MediaRecorder === "undefined") { resolve({ blob: null, transcript: "", spoke: false }); return; }
      let rec; const chunks = [];
      try { rec = new MediaRecorder(stream); } catch (e) { resolve({ blob: null, transcript: "", spoke: false }); return; }
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => resolve({ blob: chunks.length ? new Blob(chunks, { type: (rec && rec.mimeType) || "audio/webm" }) : null, transcript: "", spoke: chunks.length > 0 });
      try { rec.start(); } catch (e) { resolve({ blob: null }); return; }
      setTimeout(() => { try { if (rec.state !== "inactive") rec.stop(); } catch (e) {} }, opts.maxMs || 6000);
    });
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
        child: (p.childName || "").slice(0, 60),
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

  global.Sona = { pic, ALL_SOUNDS, soundLabel, SOUND_NORM, soundNorm, STAGES, CHARACTERS, OUTFITS, BACKDROPS, VOICE_PITCH, HOUSE_PALETTE, WORDS, wordsFor, POSITIONS, THEMES, houseArt, dayNum, dayTheme, dailyPick, characterById, outfitById, backdropById, buddyMarkup, getProfile, saveProfile, getProgress, recordSession, resetProgress, stageOf, completeStage, LADDER, LADDER_LABEL, rungOf, rungName, rungLabel, recordRung, ladderContent, chestClaimed, claimChest, getMissed: () => getProgress().missed, getCoins, addCoins, spendCoins, owns, addOwned, getSub, saveSub, isSubscribed, gated, isNativeApp, getTrial, startTrial, ensureTrial, trialActive, trialExpired, trialDaysLeft, restore, saveRecording, listRecordings, sfx, music, confetti, pop, LEVEL_GAMES, GAME_DECK, GAMES_PER_LEVEL, levelGames, GAME_META, gameMeta, session, diff, markLevelDone, levelDone, WORLDS, LEVELS_PER_WORLD, campaignLevels, campaignSounds, campaignState, worldById, worldLevels, worldStars, worldCleared, levelStars, setLevelStars, totalStars, worldUnlocked, levelUnlocked, campaignLaunch, campaignResolve, sessionButtons, utm, startPilot, isPilot, pilotInfo, unlockedThru, logAttempt, outcomes, hasNativeAudio, captureClip, sendProgress, sendFeedback, debugOn, STICKERS, stickersEarned, hasSticker, awardSticker, awardNextSticker, awardRandomSticker, cue, CUES, coachLine, soundSay, SOUND_SAY, actionCue, repeatCue, praiseLine, PRAISES };
})(window);
