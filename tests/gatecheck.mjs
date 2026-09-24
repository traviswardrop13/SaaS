// Gate hardening smoke: kid can't reach parent pages by URL; parent pass works.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x"); const p = ROOT + u.pathname;
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8141, r));
const browser = await chromium.launch(launchOpts());
const page = await browser.newPage();
// a set-up family — today.html's first-run guard must not bounce these visits
await page.addInitScript(() => {
  if (!localStorage.getItem("sona.profile.v1")) localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true }));
});
let ok = 0, bad = 0;
const chk = (n, p) => { p ? ok++ : bad++; console.log((p ? "PASS " : "FAIL ") + n); };
for (const f of ["settings.html", "progress.html", "voices.html", "subscribe.html"]) {
  await page.goto(`http://localhost:8141/${f}`); await page.waitForTimeout(600);
  chk(`${f} bounces a kid to the home gate`, page.url().includes("today.html?gate=1"));
  // …and remembers where the visit was headed. Without this the parent
  // solves the puzzle and lands on the kid's home screen, with no sign of the
  // page that bounced them — which on subscribe.html means the plan screen a
  // completed practice run just sent them to simply never appears.
  chk(`…carrying ${f} as the destination`,
    page.url().includes("to=" + encodeURIComponent("/" + f)));
}
const gateOpen = await page.evaluate(() => document.getElementById("gateOvl")?.classList.contains("show"));
chk("home gate auto-opens after the bounce", !!gateOpen);
await page.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now())));
for (const f of ["settings.html", "progress.html", "subscribe.html"]) {
  await page.goto(`http://localhost:8141/${f}`); await page.waitForTimeout(600);
  chk(`${f} opens for a verified parent`, page.url().includes(f));
}
// ── the challenge a child cannot read ──────────────────────────────────────
// It used to be arithmetic (3-8 × 3-8). A seven-year-old who knows their times
// tables walks straight through that, and there are only ~30 plausible products
// to guess. Four spelled-out number words have to be READ to be answered —
// exactly what the child this gate exists to stop cannot do — and there are
// ten thousand of them.
{
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto("http://localhost:8141/today.html"); await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done");
    Sona.saveProfile({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true });
  });
  await pg.goto("http://localhost:8141/today.html"); await pg.waitForTimeout(800);
  await pg.evaluate(() => document.getElementById("parentBtn").click());
  await pg.waitForTimeout(350);
  const g = await pg.evaluate(() => ({
    q: document.getElementById("gateQ").textContent,
    shown: document.getElementById("gateOvl").classList.contains("show"),
    overflow: (function () { const e = document.getElementById("gateQ"); return e.scrollWidth > e.clientWidth + 1; })(),
  }));
  chk("the parent gate asks for four spelled-out numbers", /^[A-Z]+( · [A-Z]+){3}$/.test(g.q));
  chk("…with no arithmetic and no digits to shortcut", !/[×*=0-9]/.test(g.q));
  chk("…and the words fit the modal", g.shown && g.overflow === false);

  const WORDS = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
  const digits = g.q.split(" · ").map((w) => WORDS.indexOf(w));
  chk("every word maps to a real digit", digits.every((d) => d >= 0));

  const tap = (ds) => pg.evaluate((seq) => {
    const btns = [...document.querySelectorAll("#pad button")];
    seq.forEach((d) => btns.find((b) => b.textContent === String(d)).click());
    btns.find((b) => b.textContent === "✓").click();
  }, ds);
  const wrong = digits.map((d) => (d + 1) % 10);
  await tap(wrong); await pg.waitForTimeout(350);
  let st = await pg.evaluate(() => ({
    gate: document.getElementById("gateOvl").classList.contains("show"),
    sheet: document.getElementById("sheetOvl").classList.contains("show"),
  }));
  chk("a wrong sequence keeps the gate shut", st.gate === true && st.sheet === false);

  await tap(digits); await pg.waitForTimeout(400);
  st = await pg.evaluate(() => ({
    gate: document.getElementById("gateOvl").classList.contains("show"),
    sheet: document.getElementById("sheetOvl").classList.contains("show"),
  }));
  chk("the right sequence opens the parent corner", st.gate === false && st.sheet === true);
  await pg.close();
}

// ── the destination survives the gate, and ONLY an allowlisted one does ──
// ?to= rides in a URL anyone can type or text to a parent, and it lands on the
// page that sells things. It names one of four pages or it is ignored.
{
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto("http://localhost:8141/today.html"); await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
    Sona.saveProfile({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true });
  });

  const dest = await pg.evaluate(() => ({
    plain: Sona.gateDest("/subscribe.html"),
    first: Sona.gateDest("/subscribe.html?first=1"),
    prog: Sona.gateDest("/progress.html"),
    offList: Sona.gateDest("/charge.html"),
    absolute: Sona.gateDest("https://evil.example/x"),
    protoRel: Sona.gateDest("//evil.example/subscribe.html"),
    traversal: Sona.gateDest("/../subscribe.html"),
    extraQuery: Sona.gateDest("/subscribe.html?slp=DRSMITH22&first=1"),
    empty: Sona.gateDest(""),
  }));
  chk("an allowlisted page comes back", dest.plain === "/subscribe.html" && dest.prog === "/progress.html");
  chk("…keeping the one flag that changes its copy", dest.first === "/subscribe.html?first=1");
  chk("a page not on the list is dropped", dest.offList === "");
  chk("another origin is dropped", dest.absolute === "" && dest.protoRel === "");
  chk("a traversal is dropped", dest.traversal === "");
  chk("every other query key is stripped", dest.extraQuery === "/subscribe.html?first=1");
  chk("nothing is nothing", dest.empty === "");

  // end to end: the win screen sends a parent to the plan, the gate stops
  // them, they solve it, and they arrive where they were going.
  await pg.evaluate(() => sessionStorage.removeItem("sona.gate.v1"));
  await pg.goto("http://localhost:8141/subscribe.html?first=1"); await pg.waitForTimeout(700);
  chk("an ungated visit to the plan screen bounces home with its destination",
    pg.url().includes("gate=1") && pg.url().includes(encodeURIComponent("/subscribe.html?first=1")));
  await pg.waitForTimeout(300);
  const digits = (await pg.evaluate(() => document.getElementById("gateQ").textContent))
    .split("·").map((w) => ["ZERO","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE"].indexOf(w.trim()));
  chk("the gate opened with a readable challenge", digits.length === 4 && digits.every((d) => d >= 0));
  await pg.evaluate((seq) => {
    const btns = [...document.querySelectorAll("#pad button")];
    seq.forEach((d) => btns.find((b) => b.textContent === String(d)).click());
    btns.find((b) => b.textContent === "✓").click();
  }, digits);
  await pg.waitForTimeout(900);
  chk("solving it lands the parent on the plan screen, not the kid's home",
    /\/subscribe\.html\?first=1/.test(pg.url()));
  await pg.close();
}

// the settings page describes the gate that actually exists: four number
// words to read, not the arithmetic it replaced (a seven-year-old with their
// times tables walked through the old one; the copy still advertised it)
chk("settings describes the gate that exists, not the one it replaced",
  /four number words/.test(readFileSync(ROOT + "/settings.html", "utf8")) && !/math question/.test(readFileSync(ROOT + "/settings.html", "utf8")));

await browser.close(); srv.close();
console.log(bad ? bad + " FAILURES" : "GATE ALL GREEN");
process.exit(bad ? 1 : 0);
