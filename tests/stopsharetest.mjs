// STOPSHARE1: a family who said "Yes, share progress" can find the way to stop.
//
// The privacy policy says: open the grown-ups' area and choose "Stop sharing
// with your speech therapist". That control lives on pilot.html, and nothing
// in the grown-ups' area linked there — so the one promised way to withdraw
// consent could not be found. Settings now carries a row, shown only while
// this child is sharing, that opens pilot.html's stop view; the stop view is
// parent-only, and a child never meets the delete on any view of the page.
// What stopping DOES (the forget call, then slpShare:false) is pinned by
// slpapi; this suite pins how a grown-up gets there, and who cannot.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", webp: "image/webp", png: "image/png", json: "application/json", webmanifest: "application/manifest+json" };
const forgets = [];
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/pilot/forget" && req.method === "POST") {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { try { forgets.push(JSON.parse(b)); } catch { forgets.push(null); } res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true,"forgotten":true}'); });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + (u.pathname === "/" ? "/index.html" : u.pathname);
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + srv.address().port;

let fails = 0;
const ok = (n, p, d) => { if (p) console.log("PASS " + n); else { fails++; console.log("FAIL " + n + (d ? " — " + d : "")); } };
const browser = await chromium.launch(launchOpts());

// A set-up family, every era stamp set (an onboarded seed missing one looks
// like that era's cohort). sharing: "yes" = said Yes on join.html and holds
// the ticket; "no" = said No thanks; "none" = never met a clinician.
async function family(sharing) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/today.html"); await pg.waitForTimeout(250);
  await pg.evaluate((sharing) => {
    ["sona.freeera.v1", "sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1"].forEach((k, i) => localStorage.setItem(k, i ? "done" : "post"));
    Sona.saveProfile({ childName: "Mia", childAge: "6", focusSounds: ["S"], onboarded: true });
    if (sharing === "none") return;
    localStorage.setItem("sona.slpticket", "TICKET:rachel-k4");
    if (sharing === "yes") Sona.slpJoinCaseload("RACHEL-K4");
    else Sona.saveProfile({ slpShare: false });
  }, sharing);
  return { ctx, pg };
}
const pass = (pg) => pg.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now())));
const shown = (pg, id) => pg.evaluate((id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0; }, id);

// ── 1. one answer for "is this child sharing" ──
{
  const { ctx, pg } = await family("none");
  const t = await pg.evaluate(() => {
    const r = { fresh: Sona.slpSharing() };
    localStorage.setItem("sona.slpticket", "TICKET:rachel-k4");
    Sona.slpJoinCaseload("RACHEL-K4");
    r.yes = Sona.slpSharing();
    Sona.saveProfile({ slpShare: false }); r.stopped = Sona.slpSharing();
    Sona.saveProfile({ slpShare: true });
    localStorage.removeItem("sona.slpticket"); r.noTicket = Sona.slpSharing();
    localStorage.setItem("sona.slpticket", "TICKET:rachel-k4");
    // per child, like the consent it reads: a sibling added later is not sharing
    Sona.addKid("Leo", "5"); r.sibling = Sona.slpSharing();
    Sona.switchKid(Sona.kids().find((k) => k.name === "Mia").slot); r.back = Sona.slpSharing();
    // a founding family's slot is a beacon to Sona, not a clinician
    localStorage.setItem(Sona.kkey("sona.pilot.v1"), JSON.stringify({ code: "ff-abc123", childId: "c1", consent: true }));
    r.founding = Sona.slpSharing();
    return r;
  });
  ok("a device that never met a clinician is not sharing", t.fresh === false, JSON.stringify(t));
  ok("Yes, share progress + the enrolment ticket is sharing", t.yes === true, JSON.stringify(t));
  ok("a stop already done (slpShare false) is not sharing", t.stopped === false, JSON.stringify(t));
  ok("without the ticket nothing is sent, so it is not 'on'", t.noTicket === false, JSON.stringify(t));
  ok("it is per child: a sibling is not sharing, the child who said yes still is", t.sibling === false && t.back === true, JSON.stringify(t));
  ok("a founding family's ff- slot is not a speech therapist", t.founding === false, JSON.stringify(t));
  await ctx.close();
}

// ── 2. the gate's allowlist knows the stop view, and only the stop view ──
{
  const { ctx, pg } = await family("none");
  const d = await pg.evaluate(() => ({
    bare: Sona.gateDest("/pilot.html"),
    stop: Sona.gateDest("/pilot.html?stop=1"),
    cred: Sona.gateDest("/pilot.html?code=rachel-k4&k=RACHELKEY"),
  }));
  ok("?to=/pilot.html comes back as its gated stop view", d.bare === "/pilot.html?stop=1" && d.stop === "/pilot.html?stop=1", JSON.stringify(d));
  ok("…and a code or family key never rides through the gate", d.cred === "/pilot.html?stop=1", d.cred);
  await ctx.close();
}

// ── 3. Settings: the row is there only while sharing ──
{
  for (const [who, want] of [["yes", true], ["no", false], ["none", false]]) {
    const { ctx, pg } = await family(who);
    await pass(pg);
    await pg.goto(BASE + "/settings.html"); await pg.waitForTimeout(500);
    const r = await pg.evaluate(() => {
      const row = document.getElementById("slpShareRow"), a = document.getElementById("slpStopLink");
      return { text: row ? row.textContent.replace(/\s+/g, " ").trim() : "", href: a ? a.getAttribute("href") : "" };
    });
    const vis = await shown(pg, "slpShareRow");
    if (want) {
      ok("a sharing family sees the row in Settings", vis, JSON.stringify(r));
      ok("…saying exactly 'Sharing progress with your speech therapist: on'", /^Sharing progress with your speech therapist: on · Stop sharing$/.test(r.text), r.text);
      ok("…and 'Stop sharing' opens the stop view", r.href === "/pilot.html?stop=1", r.href);
    } else {
      ok(`no row for a family who ${who === "no" ? "said No thanks" : "never met a clinician"}`, !vis, r.text);
    }
    await ctx.close();
  }
}

// ── 4. the stop view is parent-only ──
{
  const { ctx, pg } = await family("yes");
  await pg.goto(BASE + "/pilot.html?stop=1"); await pg.waitForTimeout(600);
  ok("a child opening the stop view is sent to the grown-ups' gate", pg.url().includes("/today.html?gate=1"), pg.url());
  ok("…carrying the stop view as where they were going", pg.url().includes("to=" + encodeURIComponent("/pilot.html?stop=1")), pg.url());
  // …and a grown-up who passes the gate lands back on it
  const q = await pg.evaluate(() => document.getElementById("gateQ").textContent);
  const WORDS = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
  const digits = q.split(" · ").map((w) => WORDS.indexOf(w));
  await pg.evaluate((seq) => {
    const btns = [...document.querySelectorAll("#pad button")];
    seq.forEach((dg) => btns.find((b) => b.textContent === String(dg)).click());
    btns.find((b) => b.textContent === "✓").click();
  }, digits);
  await pg.waitForTimeout(900);
  ok("passing the gate hands the grown-up on to the stop view", new URL(pg.url()).pathname === "/pilot.html" && /[?&]stop=1/.test(pg.url()), pg.url());
  ok("…where the stop card is showing", await shown(pg, "stopCard"));
  await ctx.close();
}
{
  // The enrolment form stays open (older clinician links land there with a
  // key) — but a child on it never meets the delete.
  const { ctx, pg } = await family("yes");
  await pg.goto(BASE + "/pilot.html"); await pg.waitForTimeout(600);
  ok("the enrolment form is not gated", new URL(pg.url()).pathname === "/pilot.html" && await shown(pg, "enrolCard"), pg.url());
  ok("…but without a grown-up's pass it shows no stop card", !(await shown(pg, "stopCard")));
  await ctx.close();
}

// ── 5. the whole way out, from Settings ──
{
  const { ctx, pg } = await family("yes");
  const before = await pg.evaluate(() => ({ code: Sona.pilotInfo().code, childId: Sona.pilotInfo().childId }));
  await pass(pg);
  await pg.goto(BASE + "/settings.html"); await pg.waitForTimeout(500);
  await pg.click("#slpStopLink"); await pg.waitForTimeout(700);
  ok("the row's link opens the stop view", new URL(pg.url()).pathname === "/pilot.html" && /[?&]stop=1/.test(pg.url()), pg.url());
  const view = { card: await shown(pg, "stopCard"), form: await shown(pg, "enrolCard"), back: await shown(pg, "stopBack") };
  ok("the stop view shows the stop card, a way back to Settings, and no sign-up form", view.card && view.back && !view.form, JSON.stringify(view));
  await pg.click("#stopOpen"); await pg.waitForTimeout(150);
  await pg.click("#stopYes"); await pg.waitForTimeout(700);
  const f = forgets[forgets.length - 1] || {};
  ok("Stop sharing makes the same request it always did", forgets.length === 1 && f.code === before.code && f.childId === before.childId && f.ticket === "TICKET:rachel-k4", JSON.stringify(f));
  ok("…and records the choice", await pg.evaluate(() => Sona.getProfile().slpShare === false && Sona.slpSharing() === false));
  await pg.click("#stopBack"); await pg.waitForTimeout(600);
  ok("back in Settings, the row is gone", new URL(pg.url()).pathname === "/settings.html" && !(await shown(pg, "slpShareRow")), pg.url());
  // nothing left to stop: the stop view has nothing on it, so it hands back
  await pg.goto(BASE + "/pilot.html?stop=1"); await pg.waitForTimeout(700);
  ok("the stop view with nothing to stop returns the grown-up to Settings", new URL(pg.url()).pathname === "/settings.html", pg.url());
  await ctx.close();
}

// ── 6. source contracts ──
{
  const privacy = readFileSync(ROOT + "/privacy.html", "utf8");
  const pilot = readFileSync(ROOT + "/pilot.html", "utf8");
  const settings = readFileSync(ROOT + "/settings.html", "utf8");
  ok("the privacy promise names a control that exists", /choose &ldquo;Stop sharing with\s+your speech therapist&rdquo;/.test(privacy) && />Stop sharing with your speech therapist<\/button>/.test(pilot));
  const guard = pilot.indexOf('sessionStorage.getItem("sona.gate.v1")'), sona = pilot.indexOf('<script src="/sona.js">');
  ok("pilot.html's stop view is guarded before sona.js loads, so it fails closed", guard > -1 && sona > -1 && guard < sona);
  ok("…and the guard runs after the family key is stripped from the address", pilot.indexOf("window.__cred") > -1 && pilot.indexOf("window.__cred") < guard);
  ok("Settings asks sona.js, not its own copy of the rule", /Sona\.slpSharing\(\)/.test(settings) && !/pilotInfo\(\)\.consent/.test(settings));
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
