// The talking stories' pictures, drawn in ChatGPT by hand (TALKMORE1, 25 Nov
// 2026; Travis, asked for his OpenAI key: "just give me the prompt to give
// to chatgpt"). gen-adventure.mjs draws a story through the image API, one
// request a picture with its reference pictures attached; this writes the
// same story as ONE message for a ChatGPT chat: the four reference pictures
// are attached once (Echo, the approved style sheet, Echo's cottage with
// Pelly, the helper map), the style, the cast and the rules are said once,
// and the 14 pictures (the cast, s01-s08, e01-e04, Home's card) are drawn
// one at a time, the next on "next". Every word a picture is told comes
// from adventure-prompts.json, as the API route's would: the style line,
// the light, the bible, each scene, who is NOT in it (the same who-regexes,
// WHO below is gen-adventure.mjs's), the problem note on the s-pages, the
// composition rules. Change a picture there, never here.
//
//   node tools/art/chatgpt-prompts.mjs rosie ruby ... > prompts.json
//   node tools/art/chatgpt-prompts.mjs --md rosie > rosie.md
//   (no ids: every later talking story, STORY_TALK_MORE's order)
//
// What comes back from ChatGPT is a picture file per slot, cast first; the
// pages go through cut-adventure.py like the API's (save them as
// tools/art/out/adventure/<id>/<part>.png first), the cast to
// design/adventure/cast-<id>.webp.
import fs from "fs";
import path from "path";

const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(here, "../..");
const P = JSON.parse(fs.readFileSync(path.join(here, "adventure-prompts.json"), "utf8"));
const T = (() => { const w = {}; new Function("window", fs.readFileSync(path.join(ROOT, "public/talk-stories.js"), "utf8")).call(w, w); return w.SonaTalkStories; })();
const SRC = fs.readFileSync(path.join(ROOT, "public/sona.js"), "utf8");
const listOf = (name) => [...((SRC.match(new RegExp("const " + name + " = \\[([\\s\\S]*?)\\n  \\];")) || ["", ""])[1]).matchAll(/\{ id: "([a-z]+)", sound: "([A-Z]+)", hero: "([a-z]+)", name: "([^"]+)", title: "([^"]+)",\s*line: "([^"]+)"/g)]
  .map((m) => ({ id: m[1], sound: m[2], hero: m[3], title: m[5], line: m[6] }));
const STORIES = listOf("STORY_TALK").concat(listOf("STORY_TALK_MORE"));

// gen-adventure.mjs's own finders, word for word: who is in a picture is who
// its text names; everyone else in the bible is told to stay out.
const WHO = { PELLY: [/Pelly/, "Pelly the pelican"], WALLY: [/Wally/, "Captain Wally"], MICE: [/\bmice\b/i, "the three mice"], "GRANDPA BEAR": [/Grandpa Bear/, "Grandpa Bear"], TOYS: [/wind-up toy|\btoys\b|bunny|elephant|hippo|jack-in-the-box/i, "the wind-up toys"], GRANDMA: [/Grandma/, "Grandma Tortoise"] };
const whoOf = (s, n) => s.who && s.who[n] ? [new RegExp(s.who[n].re), s.who[n].label] : WHO[n];
const absent = (s, text) => [...s.bible.matchAll(/\b([A-Z][A-Z' ]+):/g)].map((m) => m[1].trim()).filter((n) => whoOf(s, n) && !whoOf(s, n)[0].test(text)).map((n) => whoOf(s, n)[1]);

const PARTS = ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "e01", "e02", "e03", "e04"];
const lightOf = (s, sc) => (sc && sc.light) || s.light || "day";
const LIGHT_NAME = (k) => k.toUpperCase();
const times = (h) => h < 0.4 ? "about a third as tall as Echo" : h < 0.6 ? "about half as tall as Echo" : h < 0.85 ? "about three quarters as tall as Echo"
  : h < 1.1 ? "about as tall as Echo" : h < 1.35 ? "about one and a quarter times as tall as Echo" : h < 1.65 ? "about one and a half times as tall as Echo"
  : h < 2.2 ? "about twice as tall as Echo" : h < 2.75 ? "about two and a half times as tall as Echo" : "about three times as tall as Echo";
// "Rosie the raccoon, full body, standing ..." names its character before the first comma
const castName = (c) => c.prompt.split(/[,:]/)[0].replace(/^A /, "a ").replace(/^An /, "an ").trim();
const join = (xs) => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
const notIn = (list) => list.length ? ` Not in this picture: ${join(list)}.` : "";

function build(id) {
  const s = P.stories.find((x) => x.id === id), meta = STORIES.find((x) => x.id === id), pages = T[id];
  if (!s || !meta || !pages) throw new Error("no story " + id);
  const all = PARTS.map((p) => s.scenes[p].picture).concat([s.home]).join("\n");
  const places = Object.values(P.places).filter((d) => all.includes(d.split(":")[0]));
  const lights = [...new Set([lightOf(s, null), ...PARTS.map((p) => lightOf(s, s.scenes[p]))])];
  // the bible, one character (or the place) a line
  const bible = s.bible.split(/\s(?=[A-Z][A-Z' ]+:\s)|\s(?=The place in this story is )/).map((x) => x.trim()).filter(Boolean);
  const cast = [{ name: "Pelly the pelican", h: 2 }].concat(s.chars.map((c) => ({ name: castName(c), h: c.h })));
  const pics = [];
  pics.push({ slot: "cast", label: "Cast", size: "wide", text: `The cast (a wide picture, 3:2). Echo, ${join(cast.map((c) => c.name))} standing side by side in one row on a plain cream background, all facing forward and smiling, the whole of each one in the picture: ${cast.map((c) => c.name + " " + times(c.h)).join(", ")}. Nothing else in the picture: no ground, no scenery, no other characters.` });
  PARTS.forEach((p, i) => {
    const sc = s.scenes[p], echoOut = /Echo is not in this picture/.test(sc.picture);
    const away = (echoOut ? ["Echo"] : []).concat(absent(s, sc.picture));
    const n = i + 1, page = pages[p[0] === "s" ? "intro" : "ending"].find((x) => x.art === p);
    pics.push({ slot: p, label: "Page " + n, size: "tall", key: page && page.key, text: `Page ${n} (a tall picture, 2:3; ${LIGHT_NAME(lightOf(s, sc))} light). ${sc.picture}${notIn(away)}` });
  });
  pics.push({ slot: "home", label: "Home card", size: "wide", text: `The Home card (a wide picture, 3:2; ${LIGHT_NAME(lightOf(s, null))} light). ${s.home}${notIn(absent(s, s.home))}` });

  const lines = [];
  lines.push(`Please make the pictures for a children's picture book called "${meta.title}". There are ${pics.length} pictures. Draw them ONE AT A TIME, in order: draw picture 1 now, then stop. Each time I type "next", draw the next picture. Don't ask me questions and don't explain: just draw. If I type "redo" and a note, draw that same picture again and fix what I say.`);
  lines.push("");
  // Echo's picture is the one that must be attached (ChatGPT sees no
  // picture from another chat, and without it Echo changes from story to
  // story); the other three keep the pages matching the older stories
  lines.push("I attached a picture of Echo, and maybe up to 3 more. Use each one I attached:");
  lines.push("- ECHO, our hero. Draw Echo exactly like this in every picture: the same shape, colors, feathers and face.");
  lines.push("- The STYLE SHEET (a grid of six little rabbit pictures), if attached. Match its look only. Never copy its rabbit, its places or its story, and never make a grid of panels like it.");
  lines.push(`- ECHO'S COTTAGE with Pelly the pelican, from an earlier book, if attached. Pictures 2 and 3 happen at this cottage: keep the cottage, its porch, its fence and Pelly looking exactly like this (Pelly's pose and what she holds are each picture's own).`);
  lines.push("- THE HELPER MAP, from an earlier book, if attached, with its old stars taken off. Picture 13 shows this map: draw it in exactly this look, its cream frame, four brass pins and soft painted little places.");
  lines.push("Any of them not attached: draw it from its description below.");
  lines.push("");
  lines.push("THE STYLE OF EVERY PICTURE");
  lines.push(`Children's picture-book illustration in the exact look of the style sheet: soft 3D clay characters with a smooth, clean finish (no grain, no noise, no fuzzy felt, no paper texture), big friendly glossy eyes and small pink cheeks; simple, readable painted scenery with one clear focal point. Cheerful and calm for 3 to 8 year olds. Absolutely no text, letters, numbers or signs anywhere in any picture.`);
  lines.push("Each picture names its light:");
  for (const k of lights) lines.push(`- ${LIGHT_NAME(k)} light: ${P.light[k] || P.light.day}.`);
  lines.push("");
  lines.push("THE CHARACTERS (draw each one the same in every picture)");
  lines.push(P.echo);
  for (const b of bible) lines.push(b);
  for (const pl of places) lines.push(pl);
  lines.push("");
  lines.push("RULES FOR EVERY PICTURE");
  lines.push("- One single scene: not a grid, no panels, no border; the picture runs to every edge.");
  lines.push("- Only the characters named in that picture's description appear, each exactly once, with a normal number of arms, legs, wings and flippers. A picture that says who is NOT in it means exactly that.");
  lines.push("- No objects the description does not mention. No letters on the letter, no writing on any sign or map.");
  lines.push("- Pictures 2 to 13 are tall picture-book pages (portrait, 2:3). Keep every character and everything important inside the middle 70% of the width (a phone may cut off the left and right edges), and keep the bottom eighth of the picture calm: plain ground, floor or water with nothing important in it, because words cover it.");
  lines.push("- Pictures 2 to 9 happen BEFORE the problem is solved: draw the problem exactly as described. Nothing is fixed, finished, flowing, growing, lit or moving yet unless the description says so.");
  lines.push("- Never add any other little character, pet or friend that is not described.");
  lines.push("");
  lines.push(`THE ${pics.length} PICTURES`);
  pics.forEach((p, i) => lines.push(`${i + 1}. ${p.text}`));
  lines.push("");
  lines.push("Start now with picture 1.");
  const prompt = lines.join("\n");
  // one picture again, for a "redo" or a chat that has lost its way
  pics.forEach((p, i) => { p.redo = `Please draw picture ${i + 1} again, in the same style, with the same characters and rules as before: ${p.text}`; });
  return { id, sound: meta.sound, title: meta.title, line: meta.line, prompt, pictures: pics };
}

const argv = process.argv.slice(2), md = argv.includes("--md");
const ids = argv.filter((a) => !a.startsWith("--"));
const want = ids.length ? ids : listOf("STORY_TALK_MORE").map((x) => x.id);
const out = want.map(build);
if (md) process.stdout.write(out.map((o) => `# ${o.title}\n\n${o.prompt}\n`).join("\n\n"));
else process.stdout.write(JSON.stringify(out, null, 1) + "\n");
