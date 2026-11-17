// THE IPHONE'S NOTIFICATION SETTING, FAKED (22 Oct 2026). Not a suite: the
// fake of SonaSpeech's four reminder methods (NOTIFY1) that notifytest plays
// against, for any suite that needs a phone that can (or cannot) remind:
// setup's reminder screen, the price screen's reminder line.
//
//   import { open } from "./_phone.mjs";
//   import { iosNotify } from "./_notify.mjs";
//   const o = await open(browser, base, { app: "buy", stamp: "post" });
//   await o.context.addInitScript(iosNotify, { perm: "prompt" });   // after open(), before goto
//
// The iPhone's side of the four methods, as SonaSpeechPlugin.swift answers
// them. For context.addInitScript, registered AFTER _phone.mjs's phone() (it
// adds the four methods to the SonaSpeech that Capacitor already has, such as
// _nativemic.mjs's fake microphone, registered before it, or to a bare
// SonaSpeech of its own when there is none, and wraps phone()'s RevenueCat).
// It never replaces a SonaSpeech it finds: a suite with the fake microphone
// keeps it. SELF-CONTAINED: addInitScript ships only this function's text.
//   plugin   "none": no SonaSpeech of its own, and nothing added (on an app phone)
//   methods  which notify methods the build has (default all four); "none"
//   perm     iOS's setting on a fresh phone: "prompt" | "granted" | "denied" | "provisional"
//   answer   what the parent taps in iOS's box: "allow" (default) | "deny"
//   ask, status, schedule, cancel   "ok" | "fail" (rejects) | "throw" (before
//            any promise) | "hang" (until set() changes it) | "unimpl"
//            (rejects as a Capacitor bridge does for a method a build lacks:
//            code UNIMPLEMENTED, "… is not implemented on ios")
//   rc       RevenueCat's "full" entitlement for getCustomerInfo and the
//            purchase: { periodType, expirationDateMillis, expirationDate,
//            willRenew } merged into an active entitlement; null: none.
//            Absent: _phone.mjs's own answer
//   rcBuy    the same, for the purchase's own answer only (absent: rc), so a
//            purchase can name no end while RevenueCat's record does
//   rcInfo   "fail" | "hang": getCustomerInfo when rc is given. A hung call
//            answers once set() changes rcInfo, with the record as it was
//            when it was ASKED (a stale answer, as a slow store gives)
// window.__ios: set(patch) (kept for later loads), perm(p) (iOS's setting
// changed behind the app's back), state() { perm, pending, log, infos }.
export function iosNotify(cfg) {
  try { localStorage.getItem("__iosState"); } catch (e) { return; }
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const live = Object.assign({}, cfg || {}, read("__iosCfg", {}));
  const st = read("__iosState", null) || { perm: live.perm || "prompt", pending: {}, log: [], infos: 0 };
  const keep = () => write("__iosState", st);
  const log = (m, a) => { st.log.push({ m, a: a === undefined ? null : JSON.parse(JSON.stringify(a)), page: location.pathname }); keep(); };
  const waiters = [];
  const hold = async (field) => { while (live[field] === "hang") await new Promise((r) => waiters.push(r)); };
  window.__ios = {
    set(patch) { Object.assign(live, patch); write("__iosCfg", Object.assign(read("__iosCfg", {}), patch)); waiters.splice(0).forEach((w) => w()); return true; },
    perm(p) { st.perm = p; keep(); return true; },
    state: () => JSON.parse(JSON.stringify(st)),
  };
  if (live.plugin === "none" || !window.Capacitor) return;
  const C = window.Capacitor;
  const fail = (m, code) => Object.assign(new Error(m), { code });
  const N = {
    available: async () => ({ available: false, onDevice: false, authorized: false }),
    requestPermission: async () => ({ granted: false }),
    stop: async () => ({ text: "", onDevice: true }),
  };
  const call = (name, field, body) => function (a) {
    log(name, a);
    if (live[field] === "throw") throw new Error(name + " is broken on this bridge");
    return (async () => {
      await hold(field);
      if (live[field] === "fail") throw fail(name + " failed", "fail");
      if (live[field] === "unimpl") throw fail('"SonaSpeech.' + name + '()" is not implemented on ios', "UNIMPLEMENTED");
      return body(a);
    })();
  };
  const NOTIFY = {
    notifyStatus: call("notifyStatus", "status", () => ({ status: st.perm, v: 1 })),
    notifyAsk: call("notifyAsk", "ask", () => {
      if (st.perm === "prompt" || st.perm === "provisional") { st.perm = live.answer === "deny" ? "denied" : "granted"; keep(); }
      return { granted: st.perm === "granted", v: 1 };
    }),
    notifySchedule: call("notifySchedule", "schedule", (a) => {
      const at = Number(a && a.at), ahead = at - Date.now();
      if (!a || !a.id || !a.title || !a.body) throw fail("a reminder needs an id, a title and words", "invalid");
      if (!(ahead > 60000) || ahead >= 400 * 86400000) throw fail("that moment is past or too far away", "past");
      if (st.perm !== "granted" && st.perm !== "provisional") return { scheduled: false, reason: "denied", v: 1 };
      st.pending[a.id] = { at, title: a.title, body: a.body }; keep();
      return { scheduled: true, at, v: 1 };
    }),
    notifyCancel: call("notifyCancel", "cancel", (a) => { delete st.pending[a && a.id]; keep(); return { cancelled: true, v: 1 }; }),
  };
  const want = Array.isArray(live.methods) ? live.methods : live.methods === "none" ? [] : Object.keys(NOTIFY);
  C.Plugins = C.Plugins || {};
  // onto the SonaSpeech already there (the fake microphone's), never over it
  const S = C.Plugins.SonaSpeech || (C.Plugins.SonaSpeech = N);
  want.forEach((m) => { S[m] = NOTIFY[m]; });
  const P = C.Plugins.Purchases;
  if (P) {
    const realInfo = P.getCustomerInfo, realBuy = P.purchaseStoreProduct;
    const ent = (r) => Object.assign({ identifier: "full", isActive: true }, r);
    P.getCustomerInfo = function () {
      st.infos++; keep();
      if (live.rc === undefined) return realInfo.apply(this, arguments);
      const asked = live.rc ? JSON.parse(JSON.stringify(live.rc)) : null;   // the record as it is now
      const answer = (rc) => ({ customerInfo: { entitlements: { active: rc ? { full: ent(rc) } : {}, all: {} } } });
      if (live.rcInfo === "fail") return Promise.reject(fail("Error performing request.", "10"));
      if (live.rcInfo === "hang") return (async () => { await hold("rcInfo"); if (live.rcInfo === "fail") throw fail("Error performing request.", "10"); return answer(asked); })();
      return Promise.resolve(answer(asked));
    };
    P.purchaseStoreProduct = function () {
      return realBuy.apply(this, arguments).then((res) => {
        const rc = live.rcBuy !== undefined ? live.rcBuy : live.rc;
        try { const f = res.customerInfo.entitlements.active.full; if (f && rc) Object.assign(f, rc); } catch (e) {}
        return res;
      });
    };
  }
}
