// SYNTAX1: every script in public/ must PARSE. That sounds beneath testing —
// it was not. story.html shipped broken for a stretch of commits because a
// refactor deleted the opening line of an async IIFE (it shared a line with
// the SpeechAce probe being removed) and left its body behind: a top-level
// `await` in a classic <script>. The browser kills the ENTIRE block at parse
// time, so the page rendered its HTML shell and did nothing — no reader, no
// buttons, no sound, and no failing test, because no suite drove that page.
// A parse gate catches that whole class the moment it is committed.
//
// vm.Script compiles with CLASSIC SCRIPT grammar — the same rules a plain
// <script> tag gets (top-level await illegal, top-level return illegal) —
// which `new Function` (wraps in a function body) and `node --check` on a
// .mjs would each get wrong. The extraction regex ends each block at the
// first </script>, which is also exactly what the HTML parser does.
import { readFileSync, readdirSync } from "fs";
import vm from "vm";
import { ROOT } from "./_env.mjs";

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

for (const f of readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort()) {
  const src = readFileSync(ROOT + "/" + f, "utf8");
  const errs = [];
  let n = 0;
  for (const m of src.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || "", body = m[2] || "";
    if (/\bsrc\s*=/i.test(attrs) || !body.trim()) continue;
    n++;
    if (/type\s*=\s*["']?module/i.test(attrs)) {
      // module grammar needs a different compiler; none exist in public/ today
      errs.push("block with type=module — teach this suite module grammar before shipping one");
      continue;
    }
    const line = src.slice(0, m.index).split("\n").length;
    try {
      new vm.Script(body, { filename: f + " <script> at line " + line });
    } catch (e) {
      errs.push("line " + line + ": " + e.message);
    }
  }
  ok(f + " — every inline script parses" + (n ? "" : " (none)"), errs.length === 0, errs.join(" | "));
}

for (const f of readdirSync(ROOT).filter((f) => f.endsWith(".js")).sort()) {
  let err = null;
  try { new vm.Script(readFileSync(ROOT + "/" + f, "utf8"), { filename: f }); } catch (e) { err = e.message; }
  ok(f + " parses", !err, err);
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
