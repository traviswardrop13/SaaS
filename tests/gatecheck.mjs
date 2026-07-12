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
let ok = 0, bad = 0;
const chk = (n, p) => { p ? ok++ : bad++; console.log((p ? "PASS " : "FAIL ") + n); };
for (const f of ["settings.html", "progress.html", "voices.html", "subscribe.html"]) {
  await page.goto(`http://localhost:8141/${f}`); await page.waitForTimeout(600);
  chk(`${f} bounces a kid to the home gate`, page.url().includes("today.html?gate=1"));
}
const gateOpen = await page.evaluate(() => document.getElementById("gateOvl")?.classList.contains("show"));
chk("home gate auto-opens after the bounce", !!gateOpen);
await page.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now())));
for (const f of ["settings.html", "progress.html", "subscribe.html"]) {
  await page.goto(`http://localhost:8141/${f}`); await page.waitForTimeout(600);
  chk(`${f} opens for a verified parent`, page.url().includes(f));
}
await browser.close(); srv.close();
console.log(bad ? bad + " FAILURES" : "GATE ALL GREEN");
process.exit(bad ? 1 : 0);
