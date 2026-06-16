/* Tiny shared state for the Sona parent prototype — localStorage only (no backend yet).
   Used by home.html, lesson.html, customize.html, progress.html and settings.html. */
(function (global) {
  const PKEY = "sona.profile.v1", GKEY = "sona.progress.v1";
  const ALL_SOUNDS = ["R", "S", "L", "K", "SH", "CH", "TH", "G", "F"];

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

  const DEFAULT_PROFILE = { childName: "", focusSounds: ["R", "S", "L", "K"], voiceOn: true, coachName: "Coach", cloudScoring: true, slpEvaluated: "", goals: "", focusArea: "articulation", language: "en", character: "leo", outfit: "none", backdrop: "sky", soundOn: true, voiceId: "SF6OznV7UB2AxeidTpie", volume: 0.8, musicOn: false, dailyMinutes: 5, owned: { outfits: ["none"], backdrops: ["sky"] }, onboarded: false };
  // stage per sound: 0 = isolation (the letter), 1 = syllables, 2 = words, 3 = mastered.
  const STAGES = ["isolation", "syllables", "words"];
  const DEFAULT_PROGRESS = { sessions: [], totals: { sessions: 0, words: 0, stars: 0, coins: 0 }, streak: { count: 0, lastDate: "" }, bySound: {}, stage: {}, chests: {}, missed: [] };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  function load(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return (v && typeof v === "object") ? v : clone(def); } catch { return clone(def); } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  function getProfile() {
    const p = Object.assign(clone(DEFAULT_PROFILE), load(PKEY, {}));
    // migrate old/empty default voices (Jessica, Will) to Leo's real voice
    if (!p.voiceId || p.voiceId === "cgSgspJ2msm6clMCkdW9" || p.voiceId === "bIHbv24MWmeRgasZH58o") p.voiceId = DEFAULT_PROFILE.voiceId;
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
  const WORDS = {
    R: [{ w: "rabbit", e: "🐰", i: 1 }, { w: "rocket", e: "🚀", i: 1 }, { w: "ring", e: "💍", i: 1 }, { w: "rain", e: "🌧️", i: 1 }, { w: "robot", e: "🤖", i: 1 }, { w: "rose", e: "🌹", i: 1 }, { w: "rock", e: "🪨", i: 1 }, { w: "carrot", e: "🥕" }, { w: "pirate", e: "🏴‍☠️" }, { w: "car", e: "🚗" }, { w: "star", e: "⭐" }, { w: "door", e: "🚪" }],
    S: [{ w: "sun", e: "☀️", i: 1 }, { w: "snake", e: "🐍", i: 1 }, { w: "soap", e: "🧼", i: 1 }, { w: "sock", e: "🧦", i: 1 }, { w: "sandwich", e: "🥪", i: 1 }, { w: "seal", e: "🦭", i: 1 }, { w: "spoon", e: "🥄", i: 1 }, { w: "dinosaur", e: "🦖" }, { w: "glasses", e: "👓" }, { w: "bus", e: "🚌" }, { w: "house", e: "🏠" }, { w: "grass", e: "🌱" }],
    L: [{ w: "lion", e: "🦁", i: 1 }, { w: "leaf", e: "🍃", i: 1 }, { w: "lemon", e: "🍋", i: 1 }, { w: "ladder", e: "🪜", i: 1 }, { w: "lamp", e: "💡", i: 1 }, { w: "lollipop", e: "🍭", i: 1 }, { w: "log", e: "🪵", i: 1 }, { w: "balloon", e: "🎈" }, { w: "jello", e: "🍮" }, { w: "ball", e: "⚽" }, { w: "bell", e: "🔔" }, { w: "owl", e: "🦉" }],
    K: [{ w: "cat", e: "🐱", i: 1 }, { w: "key", e: "🔑", i: 1 }, { w: "cake", e: "🍰", i: 1 }, { w: "kite", e: "🪁", i: 1 }, { w: "king", e: "👑", i: 1 }, { w: "koala", e: "🐨", i: 1 }, { w: "cow", e: "🐮", i: 1 }, { w: "corn", e: "🌽", i: 1 }, { w: "cookie", e: "🍪", i: 1 }, { w: "monkey", e: "🐵" }, { w: "duck", e: "🦆" }, { w: "book", e: "📖" }],
    G: [{ w: "goat", e: "🐐", i: 1 }, { w: "girl", e: "👧", i: 1 }, { w: "game", e: "🎮", i: 1 }, { w: "gift", e: "🎁", i: 1 }, { w: "guitar", e: "🎸", i: 1 }, { w: "gorilla", e: "🦍", i: 1 }, { w: "goose", e: "🪿", i: 1 }, { w: "wagon", e: "🛒" }, { w: "tiger", e: "🐯" }, { w: "dog", e: "🐶" }, { w: "frog", e: "🐸" }, { w: "pig", e: "🐷" }],
    F: [{ w: "fish", e: "🐟", i: 1 }, { w: "fox", e: "🦊", i: 1 }, { w: "fan", e: "🪭", i: 1 }, { w: "fire", e: "🔥", i: 1 }, { w: "feather", e: "🪶", i: 1 }, { w: "fork", e: "🍴", i: 1 }, { w: "flower", e: "🌸", i: 1 }, { w: "elephant", e: "🐘" }, { w: "dolphin", e: "🐬" }, { w: "leaf", e: "🍂" }, { w: "wolf", e: "🐺" }, { w: "knife", e: "🔪" }],
    SH: [{ w: "shoe", e: "👟", i: 1 }, { w: "ship", e: "🚢", i: 1 }, { w: "shark", e: "🦈", i: 1 }, { w: "sheep", e: "🐑", i: 1 }, { w: "shell", e: "🐚", i: 1 }, { w: "shirt", e: "👕", i: 1 }, { w: "milkshake", e: "🥤" }, { w: "sunshine", e: "🌞" }, { w: "fish", e: "🐠" }, { w: "brush", e: "🪥" }, { w: "splash", e: "💦" }, { w: "trash", e: "🗑️" }],
    CH: [{ w: "cheese", e: "🧀", i: 1 }, { w: "chair", e: "🪑", i: 1 }, { w: "cherry", e: "🍒", i: 1 }, { w: "chicken", e: "🐔", i: 1 }, { w: "chocolate", e: "🍫", i: 1 }, { w: "cheetah", e: "🐆", i: 1 }, { w: "lunchbox", e: "🍱" }, { w: "teacher", e: "🧑‍🏫" }, { w: "peach", e: "🍑" }, { w: "beach", e: "🏖️" }, { w: "watch", e: "⌚" }, { w: "sandwich", e: "🥪" }],
    TH: [{ w: "thumb", e: "👍", i: 1 }, { w: "three", e: "3️⃣", i: 1 }, { w: "thread", e: "🧵", i: 1 }, { w: "thunder", e: "⛈️", i: 1 }, { w: "think", e: "💭", i: 1 }, { w: "thirty", e: "🔢", i: 1 }, { w: "toothbrush", e: "🪥" }, { w: "birthday", e: "🎂" }, { w: "bath", e: "🛁" }, { w: "tooth", e: "🦷" }, { w: "earth", e: "🌍" }, { w: "moth", e: "🦋" }],
  };

  // --- prize chests (one at the end of each sound's path) ---
  function chestClaimed(sound) { return !!getProgress().chests[sound]; }
  function claimChest(sound) { const g = getProgress(); if (g.chests[sound]) return false; g.chests[sound] = true; save(GKEY, g); return true; }

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
  // Launch gate: one full free session, then practice/calls require the trial.
  // (Library, customize, and progress stay open — goodwill + no marginal cost.)
  function gated() { return !isSubscribed() && (getProgress().totals.sessions >= 1); }
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

  global.Sona = { ALL_SOUNDS, STAGES, CHARACTERS, OUTFITS, BACKDROPS, VOICE_PITCH, HOUSE_PALETTE, WORDS, THEMES, houseArt, dayNum, dayTheme, dailyPick, characterById, outfitById, backdropById, buddyMarkup, getProfile, saveProfile, getProgress, recordSession, resetProgress, stageOf, completeStage, chestClaimed, claimChest, getMissed: () => getProgress().missed, getCoins, addCoins, spendCoins, owns, addOwned, getSub, saveSub, isSubscribed, gated, restore, saveRecording, listRecordings, sfx, music, confetti, pop };
})(window);
