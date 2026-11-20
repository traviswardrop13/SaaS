// Renders the share cards at 1200 x 630, the size a shared link's card is
// drawn at: tools/og/og-<name>.html → public/og-<name>.png.
//   node tools/og/render-og.mjs           every card (og-slp)
//   node tools/og/render-og.mjs packet    one of them
// A new picture under the same name needs the page's ?v= bumped, or a
// scraper keeps showing its cached copy.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { chromium } from "../../tests/_env.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CARDS = ["slp"];
const want = process.argv.slice(2).filter((n) => CARDS.includes(n));
const MIME = { html: "text/html", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", ttf: "font/ttf" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const m = /^\/og\/([a-z]+)$/.exec(u.pathname);
  const p = m ? ROOT + "/tools/og/og-" + m[1] + ".html" : ROOT + "/public" + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, r));
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const name of want.length ? want : CARDS) {
  await pg.goto("http://localhost:" + srv.address().port + "/og/" + name);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: ROOT + "/public/og-" + name + ".png" });
  console.log("wrote public/og-" + name + ".png");
}
await b.close(); srv.close();
