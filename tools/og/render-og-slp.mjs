// Renders tools/og/og-slp.html to public/og-slp.png at 1200 x 630, the size
// a shared link's card is drawn at. `node tools/og/render-og-slp.mjs`.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { chromium } from "../../tests/_env.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIME = { html: "text/html", css: "text/css", png: "image/png", woff2: "font/woff2", ttf: "font/ttf" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const p = u.pathname === "/og" ? ROOT + "/tools/og/og-slp.html" : ROOT + "/public" + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, r));
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await pg.goto("http://localhost:" + srv.address().port + "/og");
await pg.evaluate(() => document.fonts.ready);
await pg.waitForTimeout(300);
await pg.screenshot({ path: ROOT + "/public/og-slp.png" });
await b.close(); srv.close();
console.log("wrote public/og-slp.png");
