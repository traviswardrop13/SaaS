// GUIDES1: the guides for parents (Travis, 28 Oct 2026: "go build the pages",
// pages that answer what a parent asks Google or ChatGPT about speech
// practice at home). lib/guides.ts holds every word; app/guides draws them.
// What can quietly stop being true, each pinned here:
// - a guide Rachel has not read is never on speaksona.com: a 404 there, in no
//   sitemap, no llms.txt and no link; it says "Reviewed by Rachel" only once
//   she has (CLAUDE.md: a page that explains how to practice a sound is hers);
// - a guide teaches what the app does: SOUND_NORM's ages, Sona's own
//   start-of-word words, HEAR_SUBS's mix-ups, no syllable Sona never says;
// - the house rules: Rachel's line word for word, no dollar figure, no
//   "SLP", no certification, no claim the app grades a word, no link to the
//   clinician side, the App Store a tap away;
// - Meta's pixel sends nothing from /guides.
// No browser: the pages are plain server-rendered React, drawn here with
// react-dom/server exactly as Next draws them at build time.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { renderToStaticMarkup } = require("react-dom/server");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, passes = 0;
const ok = (name, cond, info) => {
  if (cond) { passes++; console.log("PASS " + name); }
  else { fails++; console.log("FAIL " + name + (info === undefined ? "" : "  → " + JSON.stringify(info).slice(0, 600))); }
};
const read = (f) => readFileSync(path.join(REPO, f), "utf8");

// A small loader for the app's TypeScript and TSX, with stubs for Next.
const NF = new Error("NEXT_NOT_FOUND");
const STUBS = { "next/navigation": { notFound: () => { throw NF; } } };
const TSOPT = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } };
const cache = new Map();
function resolve(from, s) {
  const base = s.startsWith("@/") ? path.join(REPO, s.slice(2)) : path.resolve(path.dirname(from), s);
  for (const ext of ["", ".ts", ".tsx"]) { try { readFileSync(base + ext); return base + ext; } catch (e) {} }
  throw new Error("cannot resolve " + s + " from " + from);
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { ...TSOPT, fileName: file }).outputText;
  const req = (s) => STUBS[s] || (s.startsWith("@/") || s.startsWith(".") ? (s.endsWith(".css") ? {} : load(resolve(file, s))) : require(s));
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
const L = load(path.join(REPO, "lib/guides.ts"));
const View = load(path.join(REPO, "app/guides/GuideView.tsx"));
const { GUIDES, isLive, guidePath, guideShown, liveGuides, RACHEL_LINE, RACHEL_REVIEW, APP_STORE } = L;
const React = require("react");
const html = (g, env) => renderToStaticMarkup(React.createElement(View.default, { g, env }));
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
// Mark guides reviewed for one check, then put them back.
function asReviewed(list, run) {
  const was = list.map((g) => g.reviewed);
  list.forEach((g) => { g.reviewed = "2026-10-30"; });
  try { return run(); } finally { list.forEach((g, i) => { g.reviewed = was[i]; }); }
}

// sona.js's own tables, read from its source
const sona = read("public/sona.js");
const lit = (name) => {
  const a = sona.indexOf("const " + name + " = ");
  let i = sona.indexOf("{", a), d = 0, j = i;
  for (; j < sona.length; j++) { if (sona[j] === "{") d++; else if (sona[j] === "}" && !--d) { j++; break; } }
  return vm.runInNewContext("(" + sona.slice(i, j) + ")");
};
const SOUND_NORM = lit("SOUND_NORM"), WORDS = lit("WORDS"), HEAR_SPELL = lit("HEAR_SPELL"), HEAR_SUBS = lit("HEAR_SUBS"), HEAR_SUBS_END = lit("HEAR_SUBS_END");

// ── 1. the list itself ──
{
  const slugs = GUIDES.map((g) => g.slug);
  ok("every guide has its own address, and the hub is /guides", new Set(slugs).size === slugs.length && slugs.includes("") && guidePath(GUIDES.find((g) => !g.slug)) === "/guides");
  ok("addresses are plain words: lower case, hyphens", slugs.every((s) => /^([a-z0-9]+(-[a-z0-9]+)*)?$/.test(s)), slugs);
  const badRel = GUIDES.flatMap((g) => g.related.filter((r) => !slugs.includes(r) || r === g.slug).map((r) => g.slug + "→" + r));
  ok("every 'More guides' link is another guide", badRel.length === 0, badRel);
  const longT = GUIDES.filter((g) => !g.title.endsWith(" — Sona") || g.title.length > 62).map((g) => g.title);
  ok("every title ends ' — Sona' and fits a search result (62 characters)", longT.length === 0, longT);
  const desc = GUIDES.filter((g) => g.description.length < 70 || g.description.length > 175).map((g) => [g.slug, g.description.length]);
  ok("every description is 70 to 175 characters", desc.length === 0, desc);
  ok("every guide answers first, in a full paragraph", GUIDES.every((g) => g.answer.length >= 150), GUIDES.map((g) => g.answer.length));
  ok("every guide has questions, each with an answer", GUIDES.every((g) => g.faq.length >= 1 && g.faq.every((f) => /\?$/.test(f.q) && f.a.length > 40)));
  const dates = GUIDES.filter((g) => g.reviewed !== null && !isLive(g)).map((g) => g.slug);
  ok("a guide is unreviewed (null) or reviewed on a real day (YYYY-MM-DD)", dates.length === 0, dates);
}

// ── 2. a guide teaches what the app does ──
{
  const sounds = GUIDES.flatMap((g) => g.sounds || []);
  const ages = sounds.filter((s) => s.age !== SOUND_NORM[s.key]).map((s) => s.key + " " + s.age + "≠" + SOUND_NORM[s.key]);
  ok("every age is SOUND_NORM's (sona.js)", sounds.length >= 10 && ages.length === 0, ages);
  const AG = L.AGES.map((a) => a.age + ":" + a.sounds).join(" | ");
  const want = {};
  for (const [k, a] of Object.entries(SOUND_NORM)) (want[a] = want[a] || []).push(k);
  const named = (k) => (k === "TH" ? "TH (as in thumb)" : k === "THV" ? "TH (as in this)" : k);
  const okAges = L.AGES.every((a) => {
    const got = a.sounds.split(", ").sort(), exp = (want[a.age] || []).map(named).sort();
    return JSON.stringify(got) === JSON.stringify(exp);
  }) && L.AGES.length === Object.keys(want).length;
  ok("the hub's table of ages is SOUND_NORM, every sound once", okAges, AG);
  const notBank = sounds.flatMap((s) => s.words.filter((w) => !(WORDS[s.key] || []).some((x) => x.w === w && (x.pos || "i") === "i")).map((w) => s.key + ":" + w));
  ok("every practice word is one of Sona's own start-of-word words", notBank.length === 0, notBank);
  const spelled = sounds.flatMap((s) => s.syllables.filter((y) => !new RegExp("^(" + HEAR_SPELL[s.key] + ")").test(y)).map((y) => s.key + ":" + y));
  ok("every syllable starts with its sound", spelled.length === 0, spelled);
  const never = sounds.flatMap((s) => s.syllables.filter((y) => ["gay", "poo", "pee"].includes(y)));
  ok("…and is never one Sona won't say (gay, poo, pee)", never.length === 0, never);
  // "“wabbit” for rabbit": the first word must be the second with its sound
  // swapped for one of the mix-ups the app itself listens for (HEAR_SUBS).
  const variants = (w, key) => {
    const out = new Set(), re = new RegExp(HEAR_SPELL[key], "g");
    let m;
    while ((m = re.exec(w))) {
      const at = m.index, len = m[0].length || 1;
      for (const sub of (HEAR_SUBS[key] || []).concat(at + len >= w.length ? HEAR_SUBS_END[key] || [] : [])) out.add(w.slice(0, at) + sub + w.slice(at + len));
      if (!m[0].length) re.lastIndex++;
    }
    return out;
  };
  const bad = [];
  for (const g of GUIDES) {
    const keys = (g.sounds || []).map((s) => s.key);
    const all = keys.length ? keys : Object.keys(HEAR_SUBS);
    const words = JSON.stringify(g);
    for (const m of words.matchAll(/“([a-z]+)” for ([a-z]+)/g)) if (!all.some((k) => variants(m[2], k).has(m[1]))) bad.push(g.slug + ": " + m[0]);
  }
  ok("every mix-up quoted (“wabbit” for rabbit) is one the app listens for", bad.length === 0, bad);
  const sents = sounds.filter((s) => s.words.length && !(/^[A-Z][a-z ]+[.?!]$/.test(s.sentence) && s.words.some((w) => new RegExp("\\b" + w + "\\b").test(s.sentence)) && !/\b(a|an) (cheese|jam|juice|soup|sand|milk)\b/.test(s.sentence)));
  ok("every routine's sentence is a short real sentence with one of its words", sents.length === 0, sents.map((s) => s.key + ": " + s.sentence));
  ok("every sound with words has the routine's three steps to show", sounds.filter((s) => s.words.length).every((s) => s.syllables.length === 3 && s.words.length >= 4 && s.alone && s.play));
}

// ── 3. never on speaksona.com before Rachel has read it ──
{
  ok("no guide is reviewed in this build unless the date is set (today: none)", GUIDES.every((g) => g.reviewed === null || isLive(g)));
  const unread = GUIDES.filter((g) => !isLive(g));
  ok("on speaksona.com an unread guide is not shown; on a preview or a laptop it is", unread.every((g) => !guideShown(g, "production") && guideShown(g, "preview") && guideShown(g, undefined)));
  // the pages themselves, as Next builds them
  const Hub = load(path.join(REPO, "app/guides/page.tsx"));
  const Slug = load(path.join(REPO, "app/guides/[slug]/page.tsx"));
  const env0 = process.env.VERCEL_ENV;
  const render = (slug) => { try { return renderToStaticMarkup(slug ? Slug.default({ params: { slug } }) : Hub.default()); } catch (e) { if (e === NF) return "404"; throw e; } };
  try {
    process.env.VERCEL_ENV = "production";
    const leaks = GUIDES.filter((g) => !isLive(g) && render(g.slug) !== "404").map((g) => g.slug);
    ok("production: every unread guide's page is a 404", leaks.length === 0, leaks);
    ok("…and an address that is no guide is a 404 too", render("nope") === "404" && Slug.dynamicParams === false);
    asReviewed(GUIDES, () => {
      ok("…and once reviewed, every guide's page is drawn", GUIDES.every((g) => render(g.slug) !== "404"));
    });
    process.env.VERCEL_ENV = "preview";
    ok("preview: every guide is drawn, for Rachel to read", GUIDES.every((g) => render(g.slug) !== "404"));
  } finally { if (env0 === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = env0; }
  ok("every guide but the hub is built at deploy time", JSON.stringify(Slug.generateStaticParams().map((p) => p.slug).sort()) === JSON.stringify(GUIDES.filter((g) => g.slug).map((g) => g.slug).sort()));

  const metaUnread = View.guideMetadata(unread[0]);
  ok("an unread guide tells search engines to skip it", metaUnread.robots && metaUnread.robots.index === false);
  asReviewed([unread[0]], () => ok("…a read one does not", View.guideMetadata(unread[0]).robots === undefined));
  ok("every guide's address for search is on www", GUIDES.every((g) => View.guideMetadata(g).alternates.canonical === "https://www.speaksona.com" + guidePath(g)));

  const draft = html(unread[0], "preview");
  ok("a draft says it is one, and says nothing of a review", /Draft for Rachel’s review/.test(draft) && !/Reviewed by/.test(draft));
  asReviewed([unread[0]], () => {
    const live = html(unread[0], "production");
    ok("a read guide says who reviewed it and when, in the settled words", live.includes(RACHEL_REVIEW + ", on October 30, 2026.") && !/Draft/.test(live));
    const ld = JSON.parse(live.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const art = ld.find((x) => x["@type"] === "Article");
    ok("…and so do its labels for search engines", art.reviewedBy && art.reviewedBy.name === "Rachel Wardrop" && art.reviewedBy.honorificSuffix === "MS, CF-SLP" && art.datePublished === "2026-10-30");
  });
  const ldDraft = JSON.parse(draft.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  ok("…while a draft's labels name no reviewer", !ldDraft.find((x) => x["@type"] === "Article").reviewedBy);
}

// ── 4. what every page says, and never says ──
{
  for (const env of ["preview", "production"]) {
    asReviewed(env === "production" ? GUIDES : [], () => {
      const pages = GUIDES.map((g) => [g, html(g, env)]);
      const bad = (re) => pages.filter(([, h]) => re.test(text(h))).map(([g, h]) => g.slug + ": " + (text(h).match(re) || [])[0]);
      ok(env + ": Rachel's line on every page, word for word", pages.every(([, h]) => text(h).includes(RACHEL_LINE)));
      ok(env + ": no dollar figure", bad(/\$\s?\d/).length === 0, bad(/\$\s?\d/));
      ok(env + ": 'speech-language pathologist', never 'SLP'", bad(/(?<!CF-)\bSLPA?\b/).length === 0, bad(/(?<!CF-)\bSLPA?\b/));
      ok(env + ": no certification claimed", bad(/\bCCC\b|certified|fully licen[sc]ed/i).length === 0, bad(/\bCCC\b|certified|fully licen[sc]ed/i));
      const grade = /pronunciation feedback|real-time|accuracy|\bscores?\b|\bgrades?\b(?! school)|correct pronunciation|tells you if/i;
      ok(env + ": nothing says Sona grades a word", bad(grade).length === 0, bad(grade));
      ok(env + ": no testimonial or rating", bad(/★|stars? rating|“[^”]{40,}” ?—/).length === 0, bad(/★|stars? rating/));
      ok(env + ": no count of games or books", bad(/\d+ (games|picture books|books)\b/).length === 0, bad(/\d+ (games|picture books|books)\b/));
      const clin = pages.filter(([, h]) => /href="(https?:\/\/(www\.)?speaksona\.com)?\/(for-slps|slp-login|slps\b|slp\.html)/.test(h)).map(([g]) => g.slug);
      ok(env + ": no link to the clinician side", clin.length === 0, clin);
      ok(env + ": the App Store a tap away, ready for Android's swap", pages.every(([, h]) => h.includes('href="' + APP_STORE + '" data-store=""')));
      ok(env + ": every link stays on speaksona.com or goes to the App Store or ASHA",
        pages.every(([, h]) => [...h.matchAll(/href="([^"]+)"/g)].every((m) => /^\/|^https:\/\/(apps\.apple\.com|www\.asha\.org)\//.test(m[1]))));
      const faqOk = pages.every(([g, h]) => {
        const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
        const faq = ld.find((x) => x["@type"] === "FAQPage");
        return faq.mainEntity.length === g.faq.length && g.faq.every((f) => text(h).includes(f.q) && text(h).includes(f.a)) &&
          faq.mainEntity.every((q, i) => q.name === g.faq[i].q && q.acceptedAnswer.text === g.faq[i].a);
      });
      ok(env + ": the questions search engines are told about are the ones on the page", faqOk);
      ok(env + ": one h1 a page, the guide's", pages.every(([g, h]) => (h.match(/<h1/g) || []).length === 1 && h.includes(">" + g.h1.replace(/’/g, "’") + "</h1>")));
      ok(env + ": no script tag can be closed from the data", pages.every(([, h]) => !/<\/script>[\s\S]*<\/script>[\s\S]*<\/script>/.test(h.split('application/ld+json">')[1] || "")));
    });
  }
  // the hub links only to guides that are on the site
  const hub = GUIDES.find((g) => !g.slug);
  const prodHub = html(hub, "production");
  ok("production: the hub links to no guide that is a 404", GUIDES.filter((g) => g.slug && !isLive(g)).every((g) => !prodHub.includes('href="' + guidePath(g) + '"')));
  ok("preview: the hub links to every guide", GUIDES.filter((g) => g.slug).every((g) => html(hub, "preview").includes('href="' + guidePath(g) + '"')));
  const apps = GUIDES.filter((g) => g.kind === "apps");
  ok("a list of apps says first that we make Sona, and puts Sona first, marked as ours",
    apps.length >= 1 && apps.every((g) => /^We make Sona/.test(g.disclosure || "") && g.apps[0].name === "Sona" && g.apps[0].ours && g.apps.filter((a) => a.ours).length === 1));
  ok("…and describes the others in their makers' terms, dated", apps.every((g) => /in its maker’s own terms, checked in October 2026/.test(g.disclosure)));
}

// ── 5. the sitemap and llms.txt list exactly the guides that are live ──
{
  const Site = load(path.join(REPO, "app/sitemap.ts"));
  const urls = () => Site.default().map((u) => u.url.replace("https://www.speaksona.com", ""));
  ok("the sitemap lists no guide while none is reviewed", !urls().some((u) => u.startsWith("/guides")) && liveGuides().length === 0, urls());
  const some = GUIDES.filter((g) => g.kind === "sound").slice(0, 2);
  asReviewed(some, () => {
    const got = urls().filter((u) => u.startsWith("/guides"));
    ok("…and lists exactly the reviewed ones, with the day", JSON.stringify(got) === JSON.stringify(some.map(guidePath)) &&
      Site.default().filter((u) => u.url.includes("/guides")).every((u) => u.lastModified === "2026-10-30"));
  });
  const Llms = load(path.join(REPO, "app/llms.txt/route.ts"));
  const none = await Llms.GET().text();
  ok("llms.txt names no guide while none is reviewed", !/Guides for parents|\/guides/.test(none));
  const was = some.map((g) => g.reviewed);
  some.forEach((g) => { g.reviewed = "2026-10-30"; });
  try {
    const b = await Llms.GET().text();
    ok("…and lists exactly the reviewed ones, each with its own description",
      /## Guides for parents\n/.test(b) && some.every((g) => b.includes(`- [${g.h1}](https://www.speaksona.com${guidePath(g)}): ${g.description}`)) &&
      (b.match(/speaksona\.com\/guides/g) || []).length === some.length);
  } finally { some.forEach((g, i) => { g.reviewed = was[i]; }); }
}

// ── 6. Meta's pixel sends nothing from the guides ──
{
  const src = read("public/pixel.js");
  const run = (pathname) => {
    const added = [];
    const doc = { currentScript: null, createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore: (t) => added.push(t) } }] };
    const win = { location: { pathname }, document: doc };
    win.window = win; // the page's window is the script's global, as in a browser
    vm.runInNewContext(src, win);
    return { loaded: added.length > 0, fbq: typeof win.fbq };
  };
  const g = run("/guides/s-sound"), h = run("/guides"), home = run("/");
  ok("pixel.js loads nothing and defines no fbq on /guides and every guide", !g.loaded && g.fbq === "undefined" && !h.loaded && h.fbq === "undefined");
  ok("…and still loads on the home page, where the ads land", home.loaded && home.fbq === "function");
  ok("…and an address that only starts like it (/guidesx) is not a guide", run("/guidesx").loaded);
}

// ── 7. the home page links only to guides that are live ──
{
  const parents = read("public/parents.html").replace(/<!--[\s\S]*?-->/g, " ");
  const linked = [...parents.matchAll(/href="(?:https:\/\/www\.speaksona\.com)?(\/guides[^"#?]*)"/g)].map((m) => m[1].replace(/\/$/, ""));
  const dead = linked.filter((u) => !GUIDES.some((g) => guidePath(g) === u && isLive(g)));
  ok("every link from the home page to a guide is to one Rachel has read", dead.length === 0, dead);
}

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
