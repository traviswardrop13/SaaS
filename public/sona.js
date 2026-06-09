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
    { id: "leo",    name: "Leo",   emoji: "🦁", locked: false },
    { id: "frog",   name: "Pip",   emoji: "🐸", locked: true },
    { id: "bear",   name: "Bruno", emoji: "🐻", locked: true },
    { id: "fox",    name: "Fern",  emoji: "🦊", locked: true },
    { id: "panda",  name: "Bao",   emoji: "🐼", locked: true },
    { id: "rabbit", name: "Hop",   emoji: "🐰", locked: true },
  ];
  const OUTFITS = [
    { id: "none",   name: "None",   emoji: "" },
    { id: "crown",  name: "Crown",  emoji: "👑" },
    { id: "tophat", name: "Top hat",emoji: "🎩" },
    { id: "cap",    name: "Cap",    emoji: "🧢" },
    { id: "shades", name: "Cool",   emoji: "🕶️" },
    { id: "bow",    name: "Bow",    emoji: "🎀" },
    { id: "party",  name: "Party",  emoji: "🥳" },
  ];
  const BACKDROPS = [
    { id: "sky",      name: "Sky",       css: "linear-gradient(180deg,#bfe3ff,#eaf3ff)", scene: ["☁️", "🌤️", "☁️"] },
    { id: "jungle",   name: "Jungle",    css: "linear-gradient(180deg,#bdf0c8,#e7fbe9)", scene: ["🌴", "🌿", "🦜"] },
    { id: "forest",   name: "Forest",    css: "linear-gradient(180deg,#cbe8c0,#eef7e6)", scene: ["🌲", "🍄", "🐿️"] },
    { id: "mountain", name: "Mountains", css: "linear-gradient(180deg,#d6e6ff,#f0f5ff)", scene: ["🏔️", "⛰️", "🌲"] },
    { id: "space",    name: "Space",     css: "linear-gradient(180deg,#cdd6ff,#eef1ff)", scene: ["🚀", "⭐", "🪐"] },
    { id: "beach",    name: "Beach",     css: "linear-gradient(180deg,#bfefff,#fff6e0)", scene: ["🏖️", "🌊", "🐚"] },
  ];
  const byId = (list, id) => list.find((x) => x.id === id) || list[0];
  const characterById = (id) => byId(CHARACTERS, id);
  const outfitById = (id) => byId(OUTFITS, id);
  const backdropById = (id) => byId(BACKDROPS, id);

  const DEFAULT_PROFILE = { childName: "", focusSounds: ["R", "S", "L", "K"], voiceOn: true, coachName: "Coach", cloudScoring: true, slpEvaluated: "", goals: "", focusArea: "articulation", language: "en", character: "leo", outfit: "none", backdrop: "sky", onboarded: false };
  const DEFAULT_PROGRESS = { sessions: [], totals: { sessions: 0, words: 0, stars: 0 }, streak: { count: 0, lastDate: "" }, bySound: {} };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  function load(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return (v && typeof v === "object") ? v : clone(def); } catch { return clone(def); } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  function getProfile() { return Object.assign(clone(DEFAULT_PROFILE), load(PKEY, {})); }
  function saveProfile(patch) { save(PKEY, Object.assign(getProfile(), patch || {})); }

  function getProgress() {
    const g = load(GKEY, DEFAULT_PROGRESS);
    g.totals = Object.assign({ sessions: 0, words: 0, stars: 0 }, g.totals || {});
    g.streak = Object.assign({ count: 0, lastDate: "" }, g.streak || {});
    g.bySound = g.bySound || {}; g.sessions = g.sessions || [];
    return g;
  }
  const today = () => new Date().toISOString().slice(0, 10);

  // rec: { words: [{ word, sound, ok }] }
  function recordSession(rec) {
    const g = getProgress();
    const words = (rec && rec.words) || [];
    const stars = words.filter((w) => w && w.ok !== false).length;
    g.sessions.unshift({ date: new Date().toISOString(), count: words.length, sounds: [...new Set(words.map((w) => w && w.sound).filter(Boolean))] });
    g.sessions = g.sessions.slice(0, 50);
    g.totals.sessions += 1; g.totals.words += words.length; g.totals.stars += stars;
    words.forEach((w) => { if (w && w.sound) g.bySound[w.sound] = (g.bySound[w.sound] || 0) + 1; });
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

  global.Sona = { ALL_SOUNDS, CHARACTERS, OUTFITS, BACKDROPS, characterById, outfitById, backdropById, getProfile, saveProfile, getProgress, recordSession, resetProgress, saveRecording, listRecordings };
})(window);
