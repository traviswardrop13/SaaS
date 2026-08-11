// Produces a single self-contained file for an outside reviewer (Codex, a
// contractor, another agent) that can't clone the repo. One upload, no
// directory structure to get flattened, and a manifest so the reader knows
// exactly what is and isn't in front of them.
//   node tools/bundle.mjs > SONA_BUNDLE.md
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const out = [];
const P = (s) => out.push(s);
function walk(dir, hits = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "node_modules" || e === ".next" || e === ".git") continue;
    if (statSync(p).isDirectory()) walk(p, hits);
    else hits.push(p);
  }
  return hits;
}
const kb = (p) => Math.round(statSync(p).size / 1024);

// Priority order mirrors AUDIT_BRIEF.md: the single source of truth, then the
// server, then the surfaces that carry auth, money, consent or a child's data.
const CORE_PAGES = [
  "today.html", "chapter.html", "charge.html", "join.html", "pilot.html",
  "trial.html", "subscribe.html", "settings.html", "onboarding.html",
  "slp.html", "slp-login.html", "for-slps.html", "library.html",
  "progress.html", "story.html", "arcade-feed.html", "privacy.html", "check.html",
];
const files = [];
for (const d of ["AUDIT_BRIEF.md", "CLAUDE.md"]) if (existsSync(d)) files.push(d);
files.push("public/sona.js");
for (const f of ["gamecontent.js", "scenes.js", "mouthcue.js", "analytics.js", "pixel.js"])
  if (existsSync("public/" + f)) files.push("public/" + f);
for (const f of walk("lib")) files.push(f);
for (const f of walk("app").filter((f) => /\.(ts|tsx)$/.test(f)).sort()) files.push(f);
for (const p of CORE_PAGES) if (existsSync("public/" + p)) files.push("public/" + p);
files.push("capacitor.config.json", "package.json");

const included = new Set(files);
const skipped = walk("public").filter((f) => /\.(html|js)$/.test(f) && !included.has(f));

P("# Sona — source bundle");
P("");
P("Single-file export for a reviewer who can't clone the repo. Every file below");
P("is delimited by a `=== FILE: path ===` marker.");
P("");
P("**Read `AUDIT_BRIEF.md` first — it is the first section.** It explains the");
P("architecture, the invariants that must hold, and the classes of bug this");
P("codebase has actually produced. Without it you will look for the logic in the");
P("wrong place: there is no `src/`, and almost everything lives in");
P("`public/sona.js`.");
P("");
P("## What's included");
P("");
P("| file | size |");
P("|---|---|");
for (const f of files) if (existsSync(f)) P(`| \`${f}\` | ${kb(f)}kb |`);
P("");
P("## What's NOT included, and why");
P("");
P("These are game-rendering pages — canvas loops, sprites, tween code. They");
P("carry no auth, entitlement, consent or child-data logic, so they are the");
P("lowest-value bytes for an audit. Ask if you want any of them.");
P("");
for (const f of skipped) P(`- \`${f}\` (${kb(f)}kb)`);
P("");
P("Also excluded: `node_modules`, `.next`, tests, images, audio.");
P("The full repo is at **github.com/traviswardrop13/SaaS** (branch `main`).");
P("");
P("---");
P("");
for (const f of files) {
  if (!existsSync(f)) continue;
  const lang = f.endsWith(".ts") || f.endsWith(".tsx") ? "ts" : f.endsWith(".js") ? "js"
    : f.endsWith(".html") ? "html" : f.endsWith(".json") ? "json" : "md";
  P(`=== FILE: ${f} ===`);
  P("```" + lang);
  P(readFileSync(f, "utf8").replace(/```/g, "``​`"));
  P("```");
  P("");
}
console.log(out.join("\n"));
