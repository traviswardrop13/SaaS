// THE SHARED FAKE PHONE (5 Oct 2026). Not a suite: the helpers every suite
// that needs an App Store AND a microphone in one init script imports
// (planwordstest, pricescreentest, setupbuytest, trialfirsttest).
//
// Why one file: since 5 Oct 2026 setup goes ready → price → microphone →
// hand-off, so a buy-path test needs the store and the microphone together,
// and three suites each growing their own fake store is how iaptest's fake
// came to sell a yearly plan with "3 days free" the store never offered.
//
//   import { phone, serve, open, calm, STORES, IDS, ZONE, NOON, isOrange, isTeal } from "./_phone.mjs";
//   const { base, hits, close } = await serve();
//   const { context, page, errors, requests } = await open(browser, base, { app: "buy", store: STORES.noFree });
//   await page.goto(base + "/subscribe.html?setup=1");
//
// ── cfg (everything is optional) ──────────────────────────────────────────
//   app        "buy" (the app with the purchase plugin) · "nobuy" (an app
//              build without it) · absent (a browser)
//   stamp      what the free-version sweep already wrote ("kept" / "post")
//   setUp      seeds a set-up child, Mia (age: cfg.age, default "7")
//   slp        a clinician's verified link · webSells: the website selling
//   noGate     leave the grown-ups stamp unset (it is written on every load)
//   store      what the App Store sells: a STORES entry or your own
//              { monthly: {...}, annual: {...} }. ABSENT MEANS
//              STORES.monthlyFree, the App Store since 5 Oct 2026. Per
//              product: price (the priceString), free (an ISO period: "P3D",
//              "P1W", "P1M"…), paidIntro (the offer costs money), unitsOnly
//              (periodUnit + periodNumberOfUnits, no `period`), noPriceString,
//              id (another identifier), noId (no identifier at all).
//              The old name `intro` still works when no store is given:
//              "free3" → monthlyFree, "none" → noFree, "hang" → products:"hang".
//   wrong      true: asked for a product the store lacks, it answers with
//              its OTHER product (the yearly one under the monthly ask)
//   configure  "ok" | "hang"          products  "ok" | "hang" | "fail"
//   elig       absent (2 for a product with any introductory offer, 3 for
//              one with none) | "missing" | "throw" | "hang" |
//              { monthly: 0|1|2|3, annual: … }; eligNames: true answers with
//              RevenueCat's status names instead of numbers; eligBare: true
//              answers with the number (or name) itself for each id, not
//              wrapped in { status, description } (which shape a real phone
//              sends is not known yet, so sona.js reads both)
//   entitled   true: this Apple ID has Premium from the start
//   info       "ok" | "hang" | "fail"  (getCustomerInfo)
//   sync       absent (resolves, finds nothing) | "finds" (customer info is
//              empty until syncPurchases resolves) | "missing" | "fail" | "hang"
//   wait       { configure, products, elig, info, sync, buy, restore }: ms
//              before that call answers (the page's own timers, so a fake
//              clock drives them)
//   buy        "ok" | "cancel" | "pending" | "notallowed" | "owned" |
//              "nogrant" | "offline" | "fail" | "hang"
//              (RevenueCat's codes "1", "20", "3", "6", "10", "2", as strings)
//   restore    absent (finds a purchase only if this Apple ID has one:
//              entitled, sync:"finds" or buy:"owned") | "finds" | "none" | "fail"
//   bridge     absent (a plain object with only the real plugin's methods)
//              | "proxy" (answers EVERY unknown method name with a function
//              that rejects "not implemented", the way a Capacitor proxy can).
//              EVERY method can be replaced from a test, in either mode:
//              Capacitor.Plugins.Purchases.<name> = fn (or `delete` it, or
//              assign undefined, for a build that lacks it). That includes
//              the two optional calls, checkTrialOrIntroductoryPriceEligibility
//              and syncPurchases. A function of your own is not counted by
//              the recorders below: count its calls yourself.
//   mic        "grant" | "deny" | "pending" (the default): getUserMedia
//   kids       2 (or more): Mia is set up, and the LAST child was just added
//              in Settings (active, named, not set up). Pass stamp:"post"
//              for a household that owes the price.
//   founder    true · marker: true (a fresh "after the price" marker for the
//              active child) · firstgame: "slice" (the old setup page's
//              mark) · draft: {…} (seeds sona.obdraft.v1)
//   local, session   { key: value }: written last, on the context's first
//              load only (strings as they are, anything else as JSON): a
//              phone copied from another context, a pilot and its ticket, a
//              marker for another child, a subscription from the website
//   safeArea   { top, bottom }: px swapped in for env(safe-area-inset-*) in
//              every served .html and .css (desktop Chromium reports zero)
//
// ── window.__phone, in the page ───────────────────────────────────────────
//   set(patch)   merge a patch into the LIVE config (null clears a field) and
//                keep it for later loads. Every fake method reads the live
//                config when it is CALLED, and a hung call is let go the
//                moment set() changes its field, answering from the new one.
//   bought[]     the product id of every purchase call, in order
//   asked[]      the ids of each getProducts call on THIS page load
//                (askedAll[]: every load in this context)
//   eligAsked    how many eligibility calls (eligIds[]: the ids of each)
//   syncs, restores, infos, configured   call counts
//   unknown[]    proxy bridge only: the unknown method names that were called
//   mic          { requests[] (each .grant() / .deny()), tracks[], order[] }
//                order holds "microphone", "stop", "speech permission"
//   events[]     every SonaAnalytics.track call: { name, props, page }, the
//                props as the page passed them (before the allow-list)
//   sfx{}, confetti   counts of Sona.sfx.<name>() and Sona.confetti()
// bought, askedAll, syncs, restores and events are kept in localStorage, so
// they SURVIVE NAVIGATION and add up across a context's page loads; the rest
// start empty on each load. localStorage.__ent ("1") and __bought (the last
// id) are kept as trialfirsttest reads them.
//
// TIME. open() runs every context in ZONE. A dated check installs the clock
// itself: page.clock.install({ time: new Date(NOON) }). The two time stamps
// this fake seeds (the grown-ups stamp, the marker) are written at the first
// storage read of each page load, not when the init script runs, so they are
// stamped by the page's clock whichever was installed first.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { ROOT } from "./_env.mjs";

export const IDS = { monthly: "com.speaksona.app.monthly", annual: "com.speaksona.app.annual" };
export const STORES = {
  monthlyFree: { monthly: { price: "$9.99", free: "P3D" }, annual: { price: "$59.99", free: "P3D" } },   // the App Store since 5 Oct 2026
  noFree:      { monthly: { price: "$9.99" },             annual: { price: "$59.99", free: "P3D" } },   // monthly has no free days: charged today (yearly's are ignored)
  yearOnly:    { annual: { price: "$59.99", free: "P3D" } },                                             // no monthly product: nothing is sold
  empty:       {} };
// every dated check: this zone, this clock. This Mac is UTC-6 and CI is UTC,
// so without the zone "Thursday, October 8" is Wednesday on one of them.
export const ZONE = "America/Boise", NOON = "2026-10-05T12:00:00-06:00";

// For context.addInitScript(phone, cfg). SELF-CONTAINED ON PURPOSE:
// addInitScript ships only this function's own text, so it may name nothing
// outside its body (the two product ids and the default store are written out
// inside it; planwordstest fails if it reaches for the exports above).
export function phone(cfg) {
  cfg = cfg || {};
  // the blank first document has no storage, and nothing to fake
  try { localStorage.getItem("__phoneCfg"); sessionStorage.getItem("__phoneCfg"); } catch (e) { return; }
  const MONTHLY = "com.speaksona.app.monthly", ANNUAL = "com.speaksona.app.annual";
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const merge = (into, from) => {
    for (const k in from) {
      if (k === "wait" && from.wait && typeof from.wait === "object") into.wait = Object.assign({}, into.wait || {}, from.wait);
      else into[k] = from[k];
    }
    return into;
  };

  // ── the live config: what the test passed, then every set() since ──
  const live = merge(merge({}, cfg), read("__phoneCfg", {}));
  const waiters = [];
  const mode = (field) => field === "products"
    ? (live.products != null ? live.products : (live.store == null && live.intro === "hang" ? "hang" : "ok"))
    : live[field];
  // a delay, then (while the field says "hang") no answer until set() moves it
  const hold = async (field) => {
    const ms = Number((live.wait || {})[field]) || 0;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    while (mode(field) === "hang") await new Promise((r) => waiters.push(r));
  };

  // ── recorders ──
  const kept = read("__phoneRec", {});
  const rec = {
    bought: kept.bought || [], asked: [], askedAll: kept.askedAll || [], eligAsked: 0, eligIds: [],
    syncs: kept.syncs || 0, restores: kept.restores || 0, infos: 0, configured: 0, unknown: [],
    events: kept.events || [], mic: { requests: [], tracks: [], order: [] }, sfx: {}, confetti: 0,
  };
  const keep = () => {
    try { localStorage.setItem("__phoneRec", JSON.stringify({ bought: rec.bought, askedAll: rec.askedAll, syncs: rec.syncs, restores: rec.restores, events: rec.events })); } catch (e) {}
  };
  rec.set = (patch) => {
    merge(live, patch || {});
    try { localStorage.setItem("__phoneCfg", JSON.stringify(merge(read("__phoneCfg", {}), patch || {}))); } catch (e) {}
    waiters.splice(0).forEach((w) => w());
    return true;
  };
  rec.cfg = () => JSON.parse(JSON.stringify(live));
  window.__phone = rec;

  // ── the App Store ──
  if (live.app) {
    const fail = (message, code) => Object.assign(new Error(message), { code });
    const ent = () => live.entitled === true || localStorage.getItem("__ent") === "1";
    const info = () => ({ customerInfo: { entitlements: { active: ent() ? { full: { identifier: "full", isActive: true } } : {} } } });
    const store = () => live.store != null ? live.store
      : live.intro === "none" ? { monthly: { price: "$9.99" }, annual: { price: "$59.99", free: "P3D" } }
      : { monthly: { price: "$9.99", free: "P3D" }, annual: { price: "$59.99", free: "P3D" } };
    const kindOf = (id) => id === MONTHLY ? "monthly" : id === ANNUAL ? "annual" : "";
    const UNITS = { D: "DAY", W: "WEEK", M: "MONTH", Y: "YEAR" };
    const product = (kind) => {
      const e = kind ? store()[kind] : null;
      if (!e) return null;
      const p = {
        identifier: e.id || (kind === "monthly" ? MONTHLY : ANNUAL),
        title: kind === "monthly" ? "Sona Monthly" : "Sona Yearly", description: "Sona Premium",
        priceString: e.price, price: parseFloat(String(e.price).replace(/[^0-9.]/g, "")) || 0, currencyCode: "USD",
        subscriptionPeriod: kind === "monthly" ? "P1M" : "P1Y", introPrice: null,
      };
      if (e.noPriceString) delete p.priceString;
      if (e.noId) delete p.identifier;
      if (e.free) {
        const m = /^P(\d+)([DWMY])$/.exec(String(e.free)) || [];
        p.introPrice = { price: e.paidIntro ? 4.99 : 0, priceString: e.paidIntro ? "$4.99" : "$0.00", period: e.free, periodUnit: UNITS[m[2]] || "DAY", periodNumberOfUnits: Number(m[1]) || 0, cycles: 1 };
        if (e.unitsOnly) delete p.introPrice.period;
      }
      return p;
    };
    const NAMES = ["INTRO_ELIGIBILITY_STATUS_UNKNOWN", "INTRO_ELIGIBILITY_STATUS_INELIGIBLE", "INTRO_ELIGIBILITY_STATUS_ELIGIBLE", "INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS"];
    const eligAnswer = async (ids) => {
      await hold("elig");
      const out = {};
      ids.forEach((id) => {
        const kind = kindOf(id), p = product(kind), e = live.elig;
        const s = (e && typeof e === "object" && e[kind] != null) ? Number(e[kind]) : (p && p.introPrice ? 2 : 3);
        const status = live.eligNames ? NAMES[s] : s;
        out[id] = live.eligBare ? status : { status, description: NAMES[s] };
      });
      return out;
    };
    // not async: "throw" has to throw before any promise exists
    const eligCall = function (a) {
      const ids = ((a && a.productIdentifiers) || []).slice();
      rec.eligAsked++; rec.eligIds.push(ids);
      if (live.elig === "throw") throw new Error("eligibility is broken on this bridge");
      return eligAnswer(ids);
    };
    const syncCall = async () => {
      rec.syncs++; keep();
      await hold("sync");
      if (live.sync === "fail") throw fail("Error performing request.", "10");
      if (live.sync === "finds") localStorage.setItem("__ent", "1");
      return info();
    };
    const P = {
      configure: async () => { rec.configured++; await hold("configure"); },
      getProducts: async (a) => {
        const ids = ((a && a.productIdentifiers) || []).slice();
        rec.asked.push(ids); rec.askedAll.push(ids); keep();
        await hold("products");
        if (mode("products") === "fail") throw fail("There was a problem with the App Store.", "2");
        const out = [];
        ids.forEach((id) => {
          const kind = kindOf(id);
          let p = product(kind);
          if (!p && live.wrong) p = product(kind === "monthly" ? "annual" : "monthly");
          if (p) out.push(p);
        });
        return { products: out };
      },
      purchaseStoreProduct: async (a) => {
        const id = (a && a.product && a.product.identifier) || "?";
        rec.bought.push(id); keep(); localStorage.setItem("__bought", id);
        await hold("buy");
        const m = live.buy || "ok";
        if (m === "cancel") throw fail("Purchase was cancelled.", "1");
        if (m === "pending") throw fail("The payment is pending.", "20");
        if (m === "notallowed") throw fail("The device or user is not allowed to make the purchase.", "3");
        if (m === "owned") throw fail("This product is already active for the user.", "6");
        if (m === "offline") throw fail("Error performing request.", "10");
        if (m === "fail") throw fail("There was a problem with the App Store.", "2");
        if (m === "nogrant") return { productIdentifier: id, customerInfo: { entitlements: { active: {} } } };
        localStorage.setItem("__ent", "1");
        return Object.assign({ productIdentifier: id }, info());
      },
      restorePurchases: async () => {
        rec.restores++; keep();
        await hold("restore");
        const m = live.restore;
        if (m === "fail") throw fail("Error performing request.", "10");
        if (m === "finds" || (m == null && (live.sync === "finds" || live.buy === "owned"))) localStorage.setItem("__ent", "1");
        return info();
      },
      getCustomerInfo: async () => {
        rec.infos++;
        await hold("info");
        if (live.info === "fail") throw fail("Error performing request.", "10");
        return info();
      },
    };
    // the two calls a build may not have: there, or not, as the live config
    // says. A suite may still put its OWN function in either's place, or
    // delete it, as it can with every other method here: a getter that
    // dropped the assignment without a word would leave the fake's default
    // answering for a case the suite believes it is playing.
    const own = Object.create(null);
    const optional = (name, missing, call) => Object.defineProperty(P, name, {
      enumerable: true, configurable: true,
      get: () => name in own ? own[name] : (missing() ? undefined : call),
      set: (fn) => { own[name] = fn; },
    });
    optional("checkTrialOrIntroductoryPriceEligibility", () => live.elig === "missing", eligCall);
    optional("syncPurchases", () => live.sync === "missing", syncCall);
    // "then" stays undefined: a plugin object that answered it would be
    // swallowed by the first promise it was returned through
    const bridge = live.bridge !== "proxy" ? P : new Proxy(P, {
      get(t, k) {
        const v = t[k];
        if (v !== undefined || typeof k !== "string" || k === "then" || k === "toJSON") return v;
        return function () { rec.unknown.push(k); return Promise.reject(new Error('"Purchases.' + k + '()" is not implemented on ios')); };
      },
    });
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: live.app === "buy" ? { Purchases: bridge } : {} };
  }

  // ── the microphone (onboardingtest's fake, with its stop-order record) ──
  try {
    if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {} });
    navigator.mediaDevices.getUserMedia = () => new Promise((resolve, reject) => {
      const h = rec.mic;
      h.order.push("microphone");
      const req = {
        grant() {
          const tracks = [0, 1].map(() => { const t = { readyState: "live", stop() { t.readyState = "ended"; h.order.push("stop"); } }; h.tracks.push(t); return t; });
          resolve({ getTracks: () => tracks, getAudioTracks: () => tracks });
        },
        deny() { reject(new DOMException("Denied", "NotAllowedError")); },
      };
      h.requests.push(req);
      if (live.mic === "grant") req.grant(); else if (live.mic === "deny") req.deny();
    });
  } catch (e) {}

  // ── Sona's own noise, and every analytics call, through setter traps ──
  // (Sona.isNativeApp is NOT stubbed: window.Capacitor makes it true for sona.js itself)
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set(v) {
    sona = v;
    try {
      v.speechPerm = () => { rec.mic.order.push("speech permission"); return Promise.resolve(true); };
      v.confetti = () => { rec.confetti++; };
      Object.keys(v.sfx || {}).forEach((k) => { if (typeof v.sfx[k] === "function") v.sfx[k] = () => { rec.sfx[k] = (rec.sfx[k] || 0) + 1; }; });
    } catch (e) {}
  } });
  let analytics;
  Object.defineProperty(window, "SonaAnalytics", { configurable: true, get: () => analytics, set(v) {
    try {
      if (v && typeof v.track === "function" && !v.track.__phone) {
        const real = v.track;
        v.track = function (name, props) {
          let copy = {}; try { copy = props ? JSON.parse(JSON.stringify(props)) : {}; } catch (e) {}
          rec.events.push({ name: String(name), props: copy, page: location.pathname + location.search }); keep();
          return real.apply(this, arguments);
        };
        v.track.__phone = true;
      }
    } catch (e) {}
    analytics = v;
  } });

  // ── seeds ──
  const once = (k, v) => { if (localStorage.getItem(k) == null) localStorage.setItem(k, v); };
  // every free era already swept: none of them is this phone's
  once("sona.freeera.v1", "post"); ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => once(k, "done"));
  if (live.stamp) once("sona.freever.v1", live.stamp);
  const many = Number(live.kids) > 1 ? Number(live.kids) : 0;
  if (live.setUp || many) once("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: live.age || "7", focusSounds: ["R"], onboarded: true, voiceOn: false, soundOn: false }));
  if (live.slp) once("sona.slpok", "1");
  if (live.webSells) sessionStorage.setItem("sona.websalesui", "1");
  // …and the ones written once per context: a test that clears one (a marker
  // "Not now" removed, a draft setup deleted) must not find it back on the next page
  let markerFor = null;
  if (localStorage.getItem("__phoneSeeded") == null) {
    localStorage.setItem("__phoneSeeded", "1");
    let slot = "";
    if (live.founder) localStorage.setItem("sona.founder", "1");
    if (many) {
      const names = ["Mia", "Ben", "Cara", "Dev", "Eli", "Fay"], list = [{ slot: "", name: "Mia" }];
      for (let i = 2; i <= many; i++) {
        slot = "k" + i;
        const name = names[i - 1] || "Kid " + i;
        list.push({ slot, name });
        // the last one was just added in Settings: named, not set up
        localStorage.setItem("sona.profile.v1@" + slot, JSON.stringify(i === many
          ? { childName: name, childAge: "", onboarded: false, voiceOn: false, soundOn: false }
          : { childName: name, childAge: "6", focusSounds: ["S"], onboarded: true, voiceOn: false, soundOn: false }));
      }
      localStorage.setItem("sona.kids.v1", JSON.stringify({ active: slot, list, hi: many }));
    }
    if (live.draft) localStorage.setItem("sona.obdraft.v1", JSON.stringify(live.draft));
    if (live.firstgame) sessionStorage.setItem("sona.firstgame.v1", String(live.firstgame));
    if (live.marker) markerFor = slot;
    [[live.local, localStorage], [live.session, sessionStorage]].forEach((pair) => {
      const map = pair[0] || {};
      for (const k in map) pair[1].setItem(k, typeof map[k] === "string" ? map[k] : JSON.stringify(map[k]));
    });
  }
  // THE TWO TIME STAMPS WAIT FOR THE PAGE'S CLOCK. A fake clock installed
  // after this script was added runs after it on every load, so a stamp
  // written here would carry the real time into a page that believes it is
  // noon on 5 October: the grown-ups stamp would read as hours old, the
  // marker as stale. They are written at the first storage call instead,
  // which is sona.js's, after every init script and before any page logic.
  const SP = Storage.prototype, raw = { getItem: SP.getItem, setItem: SP.setItem, removeItem: SP.removeItem };
  let stamped = false;
  const stampNow = () => {
    if (stamped) return; stamped = true;
    SP.getItem = raw.getItem; SP.setItem = raw.setItem; SP.removeItem = raw.removeItem;
    try {
      if (!live.noGate) sessionStorage.setItem("sona.gate.v1", String(Date.now()));
      if (markerFor != null) sessionStorage.setItem("sona.setupafter.v1", JSON.stringify({ at: Date.now(), kid: markerFor }));
    } catch (e) {}
  };
  ["getItem", "setItem", "removeItem"].forEach((name) => { SP[name] = function () { stampNow(); return raw[name].apply(this, arguments); }; });
  rec.stamp = stampNow;
}

const MIME = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", woff2: "font/woff2", json: "application/json", wav: "audio/wav", mp3: "audio/mpeg", ico: "image/x-icon", webmanifest: "application/manifest+json" };
const DOC = (title, body) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + title + "</title></head><body>" + body + "</body></html>";
const BACK = (title) => DOC(title, "<h1>" + title + '</h1><a href="#" id="back" onclick="history.back();return false;">Back</a>');

// A plain file server over public/ on a free port. /api/* answers 503 {} and
// its bodies are kept in `hits` ({ path, method, body }); opts.api(path,
// method, body) may answer one itself with { status, body }. opts.pages adds
// or replaces whole pages by path.
export async function serve(opts = {}) {
  const root = opts.root || process.env.SONATEST_PUBLIC_ROOT || ROOT;
  const hits = [];
  const pages = Object.assign({
    "/__blank.html": DOC("blank", '<script src="/sona.js"></script>'),
    "/__pixel-off.html": DOC("pixel off", '<script src="/pixel.js" data-autoconfig="off"></script>'),
    "/__pixel-on.html": DOC("pixel on", '<script src="/pixel.js"></script>'),
    "/terms": BACK("Terms of Use"),
    "/privacy": BACK("Privacy"),
  }, opts.pages || {});
  const server = createServer((req, res) => {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname.startsWith("/api/")) {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        hits.push({ path: u.pathname, method: req.method, body });
        let a = null; try { a = opts.api ? opts.api(u.pathname, req.method, body) : null; } catch (e) { a = null; }
        res.writeHead((a && a.status) || 503, { "content-type": "application/json" });
        res.end(a && a.body != null ? (typeof a.body === "string" ? a.body : JSON.stringify(a.body)) : "{}");
      });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(pages, u.pathname)) { res.writeHead(200, { "content-type": "text/html" }); res.end(pages[u.pathname]); return; }
    const file = path.join(root, decodeURIComponent(u.pathname));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": MIME[file.split(".").pop().toLowerCase()] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  return { base, hits, root, close: () => new Promise((resolve) => server.close(resolve)) };
}

// One fake phone: a context in ZONE with reduced motion, the init script, and
// every request to another host aborted (and still written down). `requests`
// holds EVERY request, any host: { url, method, body }. The page is not
// navigated: the caller does that, after any clock or route of its own.
export async function open(browser, base, cfg = {}, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", timezoneId: ZONE });
  const requests = [];
  // written down as the browser makes them, not in the route below: a suite's
  // own route (a stubbed Home, a held price page) answers before this one is
  // asked, and "never requests subscribe.html" has to see those too
  context.on("request", (req) => { requests.push({ url: req.url(), method: req.method(), body: req.postData() }); });
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(base + "/")) return route.abort();
    // Desktop Chromium has zero safe-area insets. Swap in the device's real
    // ones so a footer collision is exercised, not hidden.
    if (cfg.safeArea && /\.(html|css)$/.test(new URL(url).pathname)) {
      try {
        const res = await route.fetch();
        const body = (await res.text())
          .replace(/env\(safe-area-inset-top\)/g, (cfg.safeArea.top || 0) + "px")
          .replace(/env\(safe-area-inset-bottom\)/g, (cfg.safeArea.bottom || 0) + "px");
        return route.fulfill({ response: res, body });
      } catch (e) { return route.continue(); }
    }
    return route.continue();
  });
  await context.addInitScript(phone, cfg);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors, requests };
}

// R6 pauses taps for about half a second after a setup step changes
// (body.ob-settling) and after the price card changes shape
// (body.price-settling). A walking helper calls this before a real click that
// follows either: without it each click waits the pause out through
// Playwright's retries, and under a paused fake clock the pause never lifts
// at all. The scenarios that test R6 itself do not call it.
export async function calm(page) {
  await page.evaluate(() => { if (document.body) document.body.classList.remove("ob-settling", "price-settling"); });
}

// Colours, judged the way loadtest judges a strong colour: by hue, and only
// when the colour is strong (max − min of r, g, b over 80; every hex on
// loadtest's orange list has a spread of 165 or more). Callers pass
// backgroundImage + backgroundColor + borderTopColor + boxShadow in one
// string: the timeline dots are gradients, so their backgroundColor alone is
// transparent.
function strongHues(css) {
  const out = [];
  for (const m of String(css || "").matchAll(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/g)) {
    const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
    if (m[4] != null && parseFloat(m[4]) === 0) continue;          // fully transparent: nobody sees it
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d <= 80) continue;
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    out.push(h);
  }
  return out;
}
export function isOrange(css) { return strongHues(css).some((h) => h >= 10 && h <= 45); }
export function isTeal(css) { return strongHues(css).some((h) => h >= 172 && h <= 195); }
