// HEAR1: on-device speech recognition, and the verdict rules that ride on it.
//
// The plugin (plugins/sona-speech) returns raw transcripts; the PASS/FAIL
// decision lives in sona.js so Rachel can tune it without an App Store review.
// These pin the decision rules — including the exact case that motivated the
// feature: a kid saying "poopoo" instead of an R sound must not advance — and
// the two safety properties: unknown NEVER fails a child the recognizer can't
// parse, and the plugin is never trusted unless it attests on-device.
import { createServer } from "http";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8206, r));

const browser = await chromium.launch(launchOpts());
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

const page = await browser.newPage();
await page.goto("http://localhost:8206/today.html");
await page.waitForTimeout(500);
// the practice page, the one place a syllable at another place is judged,
// loads the syllable tables too: "or" for ar fails because "or" is one of them
await page.addScriptTag({ url: "/gamecontent.js" });
ok("the practice page loads the syllable tables it judges against", /<script src="\/gamecontent\.js/.test(readFileSync(ROOT + "/charge.html", "utf8")));

// ── 1. the verdict rules, case by case ──
const V = (t, sound, word, opts) => page.evaluate(([a, b, c, d]) => Sona.hearVerdict(a, b, c, d), [t, sound, word, opts || null]);

// THE MOTIVATING CASE. "poopoo" carries no R anywhere — intelligible speech
// with none of the target sound is a fail, and the segment must not advance.
ok('"poopoo" for the R sound FAILS', (await V("poopoo", "R", "")) === "fail");
ok('"poo poo" for the word rabbit FAILS', (await V("poo poo", "R", "rabbit")) === "fail");
ok('"banana banana" for R FAILS', (await V("banana banana", "R", "rain")) === "fail");

// Anything semi-close advances — Travis's rule, and the clinical one: the
// misarticulation IS the practice.
ok('"rabbit" for rabbit passes', (await V("rabbit", "R", "rabbit")) === "pass");
ok('"wabbit" for rabbit passes (a close try — that IS the practice)',
  (await V("wabbit", "R", "rabbit")) === "pass");
ok('"the rabbit" inside a phrase passes', (await V("the rabbit", "R", "rabbit")) === "pass");
// A different word does not count, even one starting with the sound (Travis,
// 28 Sep 2026: "ideally the exact / close word"). It used to: "run" for rain.
ok('"run" for rain FAILS (a different word, though it starts with R)',
  (await V("run", "R", "rain")) === "fail");
ok('"rocket" for rabbit FAILS', (await V("rocket", "R", "rabbit", { level: "word" })) === "fail");
ok('"rainy" for rain passes (close to the word itself)', (await V("rainy", "R", "rain", { level: "word" })) === "pass");
ok('"are" for isolated R practice passes', (await V("are", "R", "")) === "pass");

// digraphs match their spelling, not their letters
ok('"ship" for the SH sound passes', (await V("ship", "SH", "")) === "pass");
ok('"sip" for the SH sound FAILS (S is not SH)', (await V("sip", "SH", "")) === "fail");
ok('"this" for TH passes', (await V("this", "TH", "")) === "pass");

// UNKNOWN IS NOT A FAIL. Apple's models are adult-tuned; disordered child
// speech often will not transcribe. A child the recognizer cannot parse must
// be judged by the spectral check exactly as before this feature existed.
ok("an empty transcript is unknown, never fail", (await V("", "R", "rabbit")) === "unknown");
ok("silence/whitespace is unknown", (await V("   ", "R", "rabbit")) === "unknown");
ok("punctuation-only noise is unknown", (await V("...!!", "R", "rabbit")) === "unknown");

// short words never fuzzy-match into a false pass
ok('"cat" does not fuzzy-match "car"... it does not need to — it has no R; but "bat" vs target "bar": no R anywhere → fail',
  (await V("bat", "R", "bar")) === "fail");

// ── 1b. HEAR2: in the ballpark, and not "taco" (Travis, 28 Sep 2026) ──
// The first rules passed any word with the target LETTER in it and any word
// one letter off. So "Here is a taco" passed R, "water" passed for rabbit and
// "sock" passed for rock. Close tries must still pass; those must not.
{
  const W = { level: "word" };
  ok('"taco" for rabbit FAILS', (await V("taco", "R", "rabbit", W)) === "fail");
  ok('"water" for rabbit FAILS (an r, but not where rabbit has it)', (await V("water", "R", "rabbit", W)) === "fail");
  ok('"here is a taco" FAILS on a word round', (await V("here is a taco", "R", "rabbit", W)) === "fail");
  const HERE = { level: "sentence", frame: "Here is a rabbit." };
  ok('"Here is a taco." FAILS the sentence "Here is a rabbit."', (await V("Here is a taco.", "R", "rabbit", HERE)) === "fail");
  ok('"Here is a rabbit." passes it', (await V("Here is a rabbit.", "R", "rabbit", HERE)) === "pass");
  ok('only the sentence\'s other words ("here is a") is unknown, not a pass', (await V("here is a", "R", "rabbit", HERE)) === "unknown");
  ok('"I see a taco" FAILS "I see a sun." ("see" is the sentence\'s, not the child\'s)',
    (await V("I see a taco", "S", "sun", { level: "sentence", frame: "I see a sun." })) === "fail");
  ok('"sock" for rock FAILS (a rhyme, not a close try)', (await V("sock", "R", "rock", W)) === "fail");
  ok('"sing" for ring FAILS', (await V("sing", "R", "ring", W)) === "fail");
  ok('"wock" for rock passes (the typical R error)', (await V("wock", "R", "rock", W)) === "pass");
  ok('"wed" for red passes (short words get close tries too)', (await V("wed", "R", "red", W)) === "pass");
  ok('"bed" for red FAILS', (await V("bed", "R", "red", W)) === "fail");
  ok('"cah" for car passes (a final R melting into the vowel)', (await V("cah", "R", "car", W)) === "pass");
  ok('"tat" for cat passes (K fronted to T)', (await V("tat", "K", "cat", W)) === "pass");
  ok('"sip" for the word ship passes (the typical SH error)', (await V("sip", "SH", "ship", W)) === "pass");
  ok('"4" for four passes (Apple writes numbers as digits)', (await V("4", "R", "four", W)) === "pass");
  ok('a grown-up\'s "say rabbit" does not pass the child\'s "taco"', (await V("say rabbit taco", "R", "rabbit", W)) === "fail");
  ok('…while the child\'s own "rabbit" after it still passes', (await V("say rabbit rabbit", "R", "rabbit", W)) === "pass");
  // "taco is just an example. it could be anything that is way off like poop
  // or fridge" (Travis, 28 Sep). A different word counts only when it starts
  // with the same sound; with the sound anywhere else it must be close to the
  // word itself. "fridge" has an r, and passed every middle-R word until this.
  ok('"poop" for rabbit FAILS', (await V("poop", "R", "rabbit", W)) === "fail");
  ok('"fridge" for rabbit FAILS', (await V("fridge", "R", "rabbit", W)) === "fail");
  ok('"fridge" for carrot FAILS (an r in the middle is not enough)', (await V("fridge", "R", "carrot", W)) === "fail");
  ok('"tractor" for car FAILS (an r at the end is not enough either)', (await V("tractor", "R", "car", W)) === "fail");
  ok('"parrot" for carrot passes (close, the R intact)', (await V("parrot", "R", "carrot", W)) === "pass");
  ok('"cawwot" for carrot passes (both Rs glided)', (await V("cawwot", "R", "carrot", W)) === "pass");
  ok('"cannot" for carrot FAILS (close, but no R and no R error)', (await V("cannot", "R", "carrot", W)) === "fail");
  const ISO = { level: "isolation" };
  ok('a bare-sound round: "uh" is unknown (how Apple writes a sound it cannot spell)', (await V("uh", "R", "rrrr", ISO)) === "unknown");
  ok('…"Er" passes', (await V("Er", "R", "rrrr", ISO)) === "pass");
  ok('…"taco" FAILS', (await V("taco", "R", "rrrr", ISO)) === "fail");
  ok('…"fridge" FAILS (a word with an r in it is not the bare sound)', (await V("fridge", "R", "rrrr", ISO)) === "fail");
  ok('…"Rrrrrr" and "Error" pass (mostly the sound itself)',
    (await V("Rrrrrr", "R", "rrrr", ISO)) === "pass" && (await V("Error", "R", "rrrr", ISO)) === "pass");
  ok('…"taco" FAILS a bare K too, though it has a k sound', (await V("taco", "K", "kuh", ISO)) === "fail");
  const SYL = { level: "syllable" };
  ok('a syllable round: "wah" for rah passes', (await V("wah", "R", "rah", SYL)) === "pass");
  // 22 Oct 2026: a syllable at every place in a word. A start-of-word
  // syllable is judged exactly as before; at another place it has its own
  // rule (_hearPlace): every word heard covered by tries that are EXACTLY the
  // target, its usual-error form or a HEAR_ALIKE word passes; every word
  // exactly another syllable of that place, or no word carrying the sound,
  // fails; anything else is unknown (the shape check decides, as before
  // Apple's listener: its spelling of a made-up syllable is weak evidence).
  const MID = { level: "syllable", pos: "m" }, END = { level: "syllable", pos: "f" }, VOC = { level: "syllable", pos: "v" }, BL = { level: "syllable", pos: "b" };
  ok('a middle syllable: "Ah rah", "Ara" and the usual error "ah wah" pass for ah-rah', (await V("Ah rah", "R", "ah-rah", MID)) === "pass" && (await V("Ara", "R", "ah-rah", MID)) === "pass" && (await V("ah wah", "R", "ah-rah", MID)) === "pass");
  ok('…and five tries in one listen pass ("Ah-rah. Ah-rah.", "Ay ray ay ray", "Ara ara")', (await V("Ah-rah. Ah-rah.", "R", "ah-rah", MID)) === "pass" && (await V("Ay ray ay ray", "R", "ay-ray", MID)) === "pass" && (await V("Ara ara", "R", "ah-rah", MID)) === "pass");
  ok('…"Are" passes for ar, and an end syllable said exactly ("ache", "ease") passes', (await V("Are", "R", "ar", END)) === "pass" && (await V("ache", "K", "ache", END)) === "pass" && (await V("ease", "Z", "ease", END)) === "pass");
  ok('…a word Apple writes for a made-up syllable, carrying its sound, is unknown, never pass or fail ("Oh row", "Op", a grown-up\'s "the" for athe or "is a" for ah-sah)', (await V("Oh row", "R", "oh-roh", MID)) === "unknown" && (await V("Op", "P", "ahp", END)) === "unknown" && (await V("the", "THV", "athe", END)) === "unknown" && (await V("is a", "S", "ah-sah", MID)) === "unknown");
  ok('…another syllable of the place fails: "or", "er" or "air" for ar, "eep" for ahp, "free" for trah', (await V("or", "R", "ar", VOC)) === "fail" && (await V("er", "R", "ar", VOC)) === "fail" && (await V("air", "R", "ar", END)) === "fail" && (await V("eep", "P", "ahp", END)) === "fail" && (await V("free", "R", "trah", BL)) === "fail");
  ok('…never a run picked out of a longer phrase: a grown-up\'s "is a" or "That\'s a good one" fails ar, "Is he done" is no pass for ice', (await V("is a", "R", "ar", VOC)) === "fail" && (await V("That's a good one", "R", "ar", VOC)) === "fail" && (await V("Is he done", "S", "ice", END)) !== "pass");
  ok('…a word that carries the sound is unknown, never a fail: "Itchy" for ee-chee, "Oh dough" for oh-doh, "Eye er" for ire, "Ooh two" for oo-too, "Year" for ear', (await V("Itchy", "CH", "ee-chee", MID)) === "unknown" && (await V("Oh dough", "D", "oh-doh", MID)) === "unknown" && (await V("Eye er", "R", "ire", VOC)) === "unknown" && (await V("Ooh, two", "T", "oo-too", MID)) === "unknown" && (await V("Year", "R", "ear", VOC)) === "unknown");
  ok('…a try with its sound melted away is never a pass ("Owe" for ole, "Ow" for or), and a letter is read as its name ("E, C" passes ee-see)', (await V("Owe", "L", "ole", END)) !== "pass" && (await V("Ow", "R", "or", VOC)) !== "pass" && (await V("E, C", "S", "ee-see", MID)) === "pass");
  ok('…filler never finishes a try: "Er, eh" fails air like "Er"', (await V("Er, eh", "R", "air", VOC)) === "fail");
  ok('…an R melted into the vowel ("E" for ear) and a blend whose sound is there but its other letter is not ("Three" for free) are unknown, never a fail', (await V("E", "R", "ear", VOC)) === "unknown" && (await V("Three", "R", "free", BL)) === "unknown");
  ok('…a usual error spelled like another sound\'s syllable is no pass ("Ache" for age), but one that IS the usual error\'s sound passes ("Ay say" for ay-shay)', (await V("Ache", "J", "age", END)) !== "pass" && (await V("Ay say", "SH", "ay-shay", MID)) === "pass");
  ok('…"Ay say" passes ay-say (its "say" is no grown-up\'s), "Eight" passes ate', (await V("Ay say ay say", "S", "ay-say", MID)) === "pass" && (await V("Eight", "T", "ate", END)) === "pass");
  ok('…and a try with no trace of the sound fails: "taco" for ah-rah and for ar, "way" for play, "too" for snoo', (await V("taco", "R", "ah-rah", MID)) === "fail" && (await V("taco", "R", "ar", VOC)) === "fail" && (await V("way", "L", "play", BL)) === "fail" && (await V("too", "S", "snoo", BL)) === "fail");
  ok('a start-of-word syllable is judged as before: "the" fails for sah, "see" (the usual error) passes for shee, "tah" for thah', (await V("the", "S", "sah", SYL)) === "fail" && (await V("see", "SH", "shee", SYL)) === "pass" && (await V("tah", "TH", "thah", SYL)) === "pass");
  ok('a blend said without its sound fails, as a word and as a syllable: "top" for stop, "tee" for tree, "tah" for trah', (await V("top", "S", "stop", { level: "word", pos: "b" })) === "fail" && (await V("tee", "R", "tree", { level: "word", pos: "b" })) === "fail" && (await V("tah", "R", "trah", { level: "syllable", pos: "b" })) === "fail" && (await V("stop", "S", "stop", { level: "word", pos: "b" })) === "pass");
  ok('a grown-up\'s "say ah-rah" is two words set aside, not one', (await V("say ah rah", "R", "ah-rah", SYL)) === "unknown");
  ok('…but a "say Ara" Apple wrote as one word sets aside one, so the child\'s "Ah rah" after it passes and "taco" fails', (await V("say Ara Ah rah", "R", "ah-rah", MID)) === "pass" && (await V("say Ara taco", "R", "ah-rah", MID)) === "fail" && (await V("say ah rah ah rah", "R", "ah-rah", MID)) === "pass");
  ok('…"ah" is unknown', (await V("ah", "R", "rah", SYL)) === "unknown");
  ok('…"taco" FAILS', (await V("taco", "R", "rah", SYL)) === "fail");
}

// ── 2. availability fails CLOSED ──
// A plugin that reports onDevice:false must never be used, whatever else it
// claims — that is how a server fallback would sneak into an app whose hard
// rule is that no audio leaves the device.
{
  const st = await page.evaluate(async () => {
    const out = {};
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SonaSpeech: {
          available: async () => ({ available: true, onDevice: false, authorized: true }),
          start: async () => { out.started = true; return { started: true }; },
          stop: async () => ({ text: "rabbit", onDevice: false }),
        },
      },
    };
    out.avail = await Sona.speechAvailable();
    out.startRet = await Sona.speechStart({});
    out.stopRet = await Sona.speechStop();
    return out;
  });
  ok("a plugin that is not on-device is treated as unavailable", st.avail === false, JSON.stringify(st));
  ok("…speechStart refuses to start it", st.startRet === false && !st.started, JSON.stringify(st));
  ok("…and a transcript not attested on-device is discarded", st.stopRet === null, JSON.stringify(st));
}

// ── 3. the happy path through a mocked on-device plugin ──
// A fresh page: the mock must exist BEFORE sona.js loads (a reload wipes
// window state, which is what sank the first version of this block).
{
  const pg2 = await browser.newPage();
  await pg2.addInitScript(() => {
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SonaSpeech: {
          available: async () => ({ available: true, onDevice: true, authorized: true }),
          requestPermission: async () => ({ granted: true }),
          start: async (o) => { window.__startOpts = o; return { started: true }; },
          stop: async () => ({ text: "poopoo", onDevice: true }),
        },
      },
    };
  });
  await pg2.goto("http://localhost:8206/today.html");
  await pg2.waitForTimeout(500);
  const run = await pg2.evaluate(async () => {
    const out = {};
    out.avail = await Sona.speechAvailable();
    out.started = await Sona.speechStart({ words: ["rabbit"], maxMs: 5000 });
    out.opts = window.__startOpts;
    const r = await Sona.speechStop();
    out.verdict = Sona.hearVerdict(r && r.text, "R", "rabbit");
    return out;
  });
  ok("an on-device plugin is available and starts", run.avail === true && run.started === true, JSON.stringify(run));
  ok("…the target word biases the recognizer (contextualStrings)",
    run.opts && Array.isArray(run.opts.words) && run.opts.words[0] === "rabbit", JSON.stringify(run.opts));
  ok("…and the round's transcript yields the fail the feature exists for",
    run.verdict === "fail", JSON.stringify(run));
  await pg2.close();
}

// ── 4. source contracts ──
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const charge = readFileSync(ROOT + "/charge.html", "utf8");
  const swift = readFileSync(ROOT + "/../plugins/sona-speech/ios/Sources/SonaSpeechPlugin/SonaSpeechPlugin.swift", "utf8");

  ok("the Swift request REQUIRES on-device recognition",
    /requiresOnDeviceRecognition = true/.test(swift),
    "without this line the recognizer may route audio to Apple's servers");
  ok("the Swift plugin rejects when on-device is unsupported (fail closed)",
    /supportsOnDeviceRecognition else \{[\s\S]{0,120}reject/.test(swift),
    "the unavailable path must refuse, never fall back to the network");
  ok("recognition sessions are bounded (an abandoned round can't hold the mic)",
    /maxMs/.test(swift) && /15000/.test(swift));
  ok("verifyClip prefers the on-device transcript and falls back to spectral",
    /async function verifyClip\(\)[\s\S]{0,400}await recognitionStop\(\)[\s\S]{0,400}hearVerdict[\s\S]{0,400}shapeVerdict\(\)/.test(charge)
    && /function recognitionStop\(\)[\s\S]{0,700}S\.speechStop\(\)/.test(charge));
  ok("the round biases recognition toward the practice word",
    /speechStart\(\{ words:/.test(charge));
  ok("the judge is told the round's kind, on a sentence round the sentence, and the place in the word (a blend said without its sound fails)",
    /S\.hearVerdict\(text,SOUND,[^;]*\{level:ITEM\.level,frame:ITEM\.level==="sentence"\?String\(ITEM\.t\|\|""\):"",pos:ITEM\.pos\|\|""\}\)/.test(charge));
  ok("Apple listens up to 15 s an attempt (9 s left a child who waited for Echo's nudge about one)",
    /var REC_BUDGET=15000;/.test(charge) && (charge.match(/recognitionRemaining=REC_BUDGET/g) || []).length === 2 && !/recognitionRemaining=9000/.test(charge));
  ok("stop() waits for Apple's final transcript instead of answering with a partial guess",
    /private func beginStop[\s\S]{0,400}request\?\.endAudio\(\)\s*task\?\.finish\(\)\s*settleTimer = Timer\.scheduledTimer/.test(swift)
    && /private func recognitionEnded\(\)[\s\S]{0,200}if settleTimer != nil \{ settle\(\) \}/.test(swift));
  ok("…and a late answer from an older listen is ignored",
    /let mine = session/.test(swift) && /guard let self = self, self\.session == mine else \{ return \}/.test(swift));
  ok("…and a start clears what the last listen heard, so a failed start returns no old word",
    /private func begin\(_ call: CAPPluginCall\) \{[\s\S]{0,300}settle\(\)\s*session \+= 1\s*let mine = session\s*latestText = ""/.test(swift));
  ok("MainViewController registers SonaSpeech beside SonaAudio",
    /registerPluginInstance\(SonaAudioPlugin\(\)\)\s*bridge\?\.registerPluginInstance\(SonaSpeechPlugin\(\)\)/.test(readFileSync(ROOT + "/../native/ios/App/MainViewController.swift", "utf8")));
  ok("the verdict rules live in sona.js, not the binary",
    /function hearVerdict/.test(sona),
    "clinical tuning must never need an App Store review");
  // ORDER MATTERS and is pinned from both sides: the mic prompt must ride
  // directly on the primer tap (storytest pins primer→acquirePracticeMic with
  // nothing between), and the speech dialog comes AFTER the mic grant — a
  // speech prompt beating the mic prompt is exactly the confusion the primer
  // exists to prevent.
  ok("the speech permission is asked at setup, AFTER the mic grant",
    /async function flow\(\)[\s\S]{0,600}await micPrimer\(\);\s*if\(!\(await acquirePracticeMic\(\)\)\)return;[\s\S]{0,700}S\.speechPerm\(\)/.test(charge)
    && /async function acquirePracticeMic\(\)[\s\S]*?await navigator\.mediaDevices\.getUserMedia\(\{audio:true,video:false\}\)/.test(charge));

  // HELP IS NOT A CONSOLATION PRIZE. "Hear it slowly" existed from the start
  // but was revealed only inside the wrong-sound branch, so the child who
  // most needed the slow model had to fail first to learn it was there.
  // ORDER, not distance: the reveal must come before the first listen.
  {
    // Anchored to the round itself, not to any comment: inside flow(), the
    // FIRST reveal must come before the FIRST listen. Pre-fix the only reveal
    // sat in the wrong-sound branch, well after burstAndVerify.
    const flowAt = charge.indexOf("async function flow(){");
    const listen = charge.indexOf("var v=await burstAndVerify();", flowAt);
    const reveal = charge.indexOf("showTurtle(true);", flowAt);
    ok("\u2026slow replay is offered before the first attempt, not after a failure",
      flowAt > -1 && listen > -1 && reveal > -1 && reveal < listen,
      "a child had to get it wrong to find the help");
  }
  // …and the safeguards that make it safe to offer earlier
  ok("the slow replay runs through the speaker guard, so it is never a rep",
    /function playSlowClip[\s\S]{0,220}await playMedia\(url,true,job\)/.test(charge)
    && /function playMedia[\s\S]{0,900}ttsBegin\(\)/.test(charge),
    "model playback counted as the child speaking is the one thing this must never do");
  ok("…and repeated taps cannot stack playback",
    /function saySlow\([\s\S]{0,160}if\(speaking\)return res\(\);/.test(charge));
  ok("…and both help controls say what they do, to a screen reader too",
    /aria-label="Hear it again"/.test(charge) && /aria-label="Hear it slowly"/.test(charge));
}

// ── 4b. SONA'S OWN MICROPHONE: the Swift side of the contract (12 Oct 2026) ──
// In the app the page no longer captures with getUserMedia (WebKit's capture
// is a video call: call volume, call-quality AirPods). The plugin opens the
// mic itself and hands the page its samples; nativemictest holds the page
// side against a fake of this file. These pin the file to that fake, and to
// the rules it exists for: plain media mode, never hands-free Bluetooth, one
// tap, nothing written or sent. Read with its comments stripped, so a note
// explaining a rule can never satisfy the pin for it.
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  const swift = readFileSync(ROOT + "/../plugins/sona-speech/ios/Sources/SonaSpeechPlugin/SonaSpeechPlugin.swift", "utf8");
  const code = swift.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const count = (re) => (code.match(re) || []).length;
  for (const m of ["micOpen", "micClose", "micPermission"]) {
    ok("the plugin declares " + m + " (an undeclared method never reaches the page), and sona.js calls it",
      code.includes('CAPPluginMethod(name: "' + m + '"') && sona.includes("P." + m + "("));
  }
  for (const e of ["micpcm", "micend", "microute", "micready"]) {
    ok("the plugin sends \"" + e + "\" and sona.js listens for it", code.includes('notifyListeners("' + e + '"') && sona.includes('addListener("' + e + '"'));
  }
  ok("a chunk is { g, q, r, n, d } (open, sequence, rate, frames, base64 Float32), and sona.js decodes exactly that",
    /notifyListeners\("micpcm", data: \["g": gen, "q": seq, "r": rate, "n": frames, "d": b64\]\)/.test(code) && /_nmDecode\(m\.d, m\.n\)/.test(sona));
  ok("the stream is .playAndRecord in mode .default: never a voice-chat or video-chat mode",
    /setCategory\(\.playAndRecord, mode: \.default, options: options\)/.test(code) && !/\.voiceChat|\.videoChat/.test(code));
  ok("measurement mode and hands-free Bluetooth appear once each, only on the old path (no stream named)",
    count(/\.measurement/g) === 1 && count(/\.allowBluetooth(?!A2DP)/g) === 1 && /if onStream == nil \{[\s\S]{0,400}mode: \.measurement/.test(code)
    && /if onStream == nil \{[\s\S]{0,500}\.allowBluetooth\]/.test(code));
  ok("one tap on the input: a second installTap on bus 0 is a fatal assertion", count(/installTap\(onBus: 0/g) === 1);
  ok("Apple's check named a stream that has closed is refused (nostream), never opening the mic the old way; sona.js names it",
    /if let g = onStream, !\(micLive && g == micGen\) \{[\s\S]{0,120}"nostream"/.test(code) && /\{ g: h\.g \}/.test(sona));
  ok("a finished check leaves a live stream its session, and its engine",
    /private func settle\(\) \{[\s\S]{0,300}if !micLive \{ sessionOff\(\) \}/.test(code) && /private func haltAudio\(\) \{[\s\S]{0,200}if micLive \{ return \}/.test(code));
  // THE SILENT SWITCH (15 Oct 2026, Travis: "Everything off"): what the
  // session is left as after a listen is what the robot fallback voice plays
  // on. .ambient follows the ring/silent switch and mixes (so it can never
  // interrupt WebKit's own session); .playback ignores the switch, and
  // .soloAmbient does not mix.
  const off = (code.match(/private func sessionOff\(\) \{([\s\S]*?)\n    \}/) || [])[1] || "";
  ok("the silent switch: sessionOff() leaves the session .ambient (follows the switch, mixable), never .playback or .soloAmbient, and nothing in the plugin sets .playback",
    /setCategory\(\.ambient, mode: \.default, options: \[\]\)/.test(off) && !/\.playback|\.soloAmbient/.test(off) && !/\.playback\b/.test(code));
  ok("a page that stopped listening (navigation, a dead web view) closes the mic within one chunk",
    /guard hasListeners\("micpcm"\) else \{ closeMic\("nolistener"\)/.test(code));
  ok("an open nobody re-confirms is capped (micCap, at most 10 minutes)", /micCap = Timer\.scheduledTimer/.test(code) && /600000/.test(code));
  ok("NO AUDIO LEAVES THE PHONE: no URLSession, URLRequest, NWConnection, WebSocket, FileManager or .write( in the plugin",
    !/URLSession|URLRequest|NWConnection|WebSocket|FileManager|\.write\(/.test(code));
  ok("every stream and every restart gets a fresh engine, and a format the hardware disagrees with is refused",
    /private func openMic\([\s\S]*?replaceEngine\(\)[\s\S]*?private func busyError/.test(code) && /private func restartMic\(\) \{[\s\S]*?replaceEngine\(\)/.test(code) && /format\.sampleRate == hw\.sampleRate/.test(code));
  ok("a finished request is fed nothing more", /private func recognitionEnded\(\)[\s\S]{0,120}detachTap\(\)/.test(code));
  ok("no retainUntilConsumed (a call kept forever)", !/retainUntilConsumed/.test(code));
  ok("iOS's \"not now\" is busy (one web-mic try), anything else a fault (the web mic for the page)",
    /setActive\(true\)[\s\S]{0,140}"busy"/.test(code) && /busyError\(error\) \? "busy" : "engine"/.test(code));
}

// ── 5. switching it on: scripts/install-ios-speech.py ──
// The plugin sat in the repo from August and never reached the app: nothing
// compiled it, nothing registered it, and Info.plist had no speech text (iOS
// closes an app that asks for the speech permission without one). The script
// does all three on the Mac's generated (git-ignored) project; here it runs on
// stand-ins for that project. Its first version assumed MainViewController was
// in the app folder; on Travis's Mac it was not (28 Sep 2026), so it now reads
// which controller the storyboard loads, and where the project compiles files.
{
  const script = path.join(ROOT, "../scripts/install-ios-speech.py");
  const plugin = readFileSync(ROOT + "/../plugins/sona-speech/ios/Sources/SonaSpeechPlugin/SonaSpeechPlugin.swift", "utf8");
  const board = (cls) => '<?xml version="1.0" encoding="UTF-8"?>\n<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" initialViewController="BYZ-38-t0r">\n    <scenes>\n        <scene sceneID="tne-QT-ifu">\n            <objects>\n                <viewController id="BYZ-38-t0r" ' + cls + ' sceneMemberID="viewController"/>\n            </objects>\n        </scene>\n    </scenes>\n</document>\n';
  const CAP = 'customClass="CAPBridgeViewController" customModule="Capacitor"';
  const MAIN = 'customClass="MainViewController" customModule="App" customModuleProvider="target"';
  const fresh = (cls) => {
    const dir = mkdtempSync(path.join(tmpdir(), "sona-speech-"));
    const app = path.join(dir, "App", "App");
    mkdirSync(path.join(app, "Base.lproj"), { recursive: true });
    mkdirSync(path.join(dir, "App", "App.xcodeproj"), { recursive: true });
    writeFileSync(path.join(app, "AppDelegate.swift"), "import UIKit\nimport Capacitor\n\n@UIApplicationMain\nclass AppDelegate: UIResponder, UIApplicationDelegate {\n    var window: UIWindow?\n}\n");
    writeFileSync(path.join(app, "Info.plist"), '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleName</key><string>Sona</string></dict></plist>\n');
    writeFileSync(path.join(app, "Base.lproj", "Main.storyboard"), board(cls));
    writeFileSync(path.join(dir, "App", "App.xcodeproj", "project.pbxproj"), "504EC3071FED79650016851F /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; };\n");
    return { dir, app, file: (f) => path.join(app, f) };
  };
  const run = (app, ...flags) => spawnSync("python3", [script, app, ...flags], { encoding: "utf8" });
  const text = (f) => readFileSync(f, "utf8");
  const pluginBlock = (d) => text(d).includes("// BEGIN SONA SPEECH PLUGIN\n" + plugin.trimEnd() + "\n");

  // A. Capacitor's own controller, no MainViewController anywhere (Travis's Mac)
  {
    const p = fresh(CAP);
    const check = run(p.app, "--check");
    ok("--check reports and writes nothing", check.status === 0 && /nothing written/.test(check.stdout)
      && !text(p.file("AppDelegate.swift")).includes("SONA SPEECH"), check.stdout + check.stderr);
    const first = run(p.app);
    const delegate = text(p.file("AppDelegate.swift")), sb = text(p.file("Base.lproj/Main.storyboard"));
    ok("with Capacitor's own controller: the installer runs", first.status === 0, first.stderr || first.stdout);
    ok("…compiles the plugin through AppDelegate.swift, whole and unchanged", pluginBlock(p.file("AppDelegate.swift")));
    ok("…and a SonaBridgeViewController that registers it",
      /\nclass SonaBridgeViewController: CAPBridgeViewController \{\s*override func capacitorDidLoad\(\) \{\s*bridge\?\.registerPluginInstance\(SonaSpeechPlugin\(\)\)/.test(delegate));
    // BUILD 6 OPENED TO A BLACK SCREEN (28 Sep 2026). The storyboard named the
    // class by a bare @objc name. Its superclass comes from Capacitor's binary
    // framework, so Swift leaves it out of the Objective-C class list until
    // Swift code touches it: the bare-name lookup found nothing, and iOS put up
    // an empty controller. Named with the app's module (Xcode's "Inherit Module
    // From Target"), the lookup goes through the Swift runtime, which finds it.
    ok("…and points the storyboard at it with the app's module, never a bare Objective-C name",
      /<viewController id="BYZ-38-t0r" customClass="SonaBridgeViewController" customModule="App" customModuleProvider="target" sceneMemberID="viewController"\/>/.test(sb)
      && !/@objc\(SonaBridgeViewController\)/.test(delegate), sb);
    ok("…and adds the speech-permission text, which says it stays on the phone",
      /<key>NSSpeechRecognitionUsageDescription<\/key>\s*<string>[^<]*on the phone[^<]*no audio is sent anywhere/.test(text(p.file("Info.plist"))));
    const again = run(p.app);
    ok("…and running it again changes nothing",
      again.status === 0 && /already installed/.test(again.stdout) && text(p.file("AppDelegate.swift")) === delegate
      && text(p.file("Base.lproj/Main.storyboard")) === sb, again.stdout + again.stderr);
    rmSync(p.dir, { recursive: true, force: true });
  }
  // B. MainViewController in the app folder (native/README.md, "Copy items if needed")
  {
    const p = fresh(MAIN);
    writeFileSync(p.file("MainViewController.swift"), "import UIKit\nimport Capacitor\n\nclass MainViewController: CAPBridgeViewController {\n    override func capacitorDidLoad() {\n        bridge?.registerPluginInstance(SonaAudioPlugin())\n    }\n}\n");
    const r = run(p.app), control = text(p.file("MainViewController.swift"));
    ok("with MainViewController in the app: registers it there once, beside SonaAudio",
      r.status === 0 && (control.match(/registerPluginInstance\(SonaSpeechPlugin\(\)\)/g) || []).length === 1
      && /registerPluginInstance\(SonaAudioPlugin\(\)\)\n\s+bridge\?\.registerPluginInstance\(SonaSpeechPlugin\(\)\)/.test(control)
      && !text(p.file("AppDelegate.swift")).includes("SonaBridgeViewController"), r.stderr || control);
    const again = run(p.app);
    ok("…and a rerun leaves it registered once", again.status === 0 && text(p.file("MainViewController.swift")) === control);
    rmSync(p.dir, { recursive: true, force: true });
  }
  // C. MainViewController compiled from the repo's own file
  {
    const p = fresh(MAIN);
    writeFileSync(path.join(p.dir, "App", "App.xcodeproj", "project.pbxproj"),
      "AAA /* MainViewController.swift in Sources */ = {isa = PBXBuildFile; };\nBBB /* MainViewController.swift */ = {isa = PBXFileReference; path = /nowhere/native/ios/App/MainViewController.swift; sourceTree = \"<absolute>\"; };\n");
    const before = text(ROOT + "/../native/ios/App/MainViewController.swift");
    const r = run(p.app);
    ok("with MainViewController compiled from the repo: finds it, already registering, and leaves it alone",
      r.status === 0 && /already registers it/.test(r.stdout) && text(ROOT + "/../native/ios/App/MainViewController.swift") === before
      && pluginBlock(p.file("AppDelegate.swift")), r.stdout + r.stderr);
    rmSync(p.dir, { recursive: true, force: true });
  }
  // D. an older copy of the plugin already compiled: brought up to date, not doubled
  {
    const p = fresh(CAP);
    writeFileSync(p.file("SonaSpeechPlugin.swift"), plugin.replace("private var settleTimer: Timer?", "// an older copy"));
    const r = run(p.app);
    ok("an older copy of the plugin is brought up to date, never compiled twice",
      r.status === 0 && text(p.file("SonaSpeechPlugin.swift")) === plugin.trimEnd() + "\n"
      && !/class SonaSpeechPlugin/.test(text(p.file("AppDelegate.swift"))) && /class SonaBridgeViewController/.test(text(p.file("AppDelegate.swift"))), r.stdout + r.stderr);
    rmSync(p.dir, { recursive: true, force: true });
  }
  // G. Capacitor 8.5's template builds the window in SceneDelegate.swift, and
  //    that controller is the one on screen: switching only the storyboard
  //    would register nothing, and still say it had
  {
    const p = fresh(CAP);
    writeFileSync(p.file("SceneDelegate.swift"), "import UIKit\nimport Capacitor\n\nclass SceneDelegate: UIResponder, UIWindowSceneDelegate {\n    var window: UIWindow?\n\n    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {\n        guard let windowScene = scene as? UIWindowScene else { return }\n\n        window = UIWindow(windowScene: windowScene)\n        window?.rootViewController = CAPBridgeViewController()\n        window?.makeKeyAndVisible()\n    }\n}\n");
    const r = run(p.app), scene = text(p.file("SceneDelegate.swift")), delegate = text(p.file("AppDelegate.swift"));
    ok("a window built in code (Capacitor 8.5's SceneDelegate) now builds SonaBridgeViewController",
      r.status === 0 && /window\?\.rootViewController = SonaBridgeViewController\(\)/.test(scene) && !/CAPBridgeViewController\(/.test(scene)
      && (delegate.match(/class SonaBridgeViewController/g) || []).length === 1, r.stdout + r.stderr + scene);
    const again = run(p.app);
    ok("…and a rerun changes nothing", again.status === 0 && /already installed/.test(again.stdout)
      && text(p.file("SceneDelegate.swift")) === scene && text(p.file("AppDelegate.swift")) === delegate, again.stdout + again.stderr);
    rmSync(p.dir, { recursive: true, force: true });
  }
  // H. build 6's project, as the earlier script left it: the storyboard names
  //    the class bare and the block renames it for Objective-C. Rerunning the
  //    script is the repair, so it must recognise that state and fix both.
  {
    const p = fresh('customClass="SonaBridgeViewController"');
    writeFileSync(p.file("AppDelegate.swift"), text(p.file("AppDelegate.swift")).trimEnd() + "\n\n// BEGIN SONA SPEECH PLUGIN\n" + plugin.trimEnd()
      + "\n\n@objc(SonaBridgeViewController)\nclass SonaBridgeViewController: CAPBridgeViewController {\n    override func capacitorDidLoad() {\n        bridge?.registerPluginInstance(SonaSpeechPlugin())\n    }\n}\n// END SONA SPEECH PLUGIN\n");
    const r = run(p.app), sb = text(p.file("Base.lproj/Main.storyboard")), delegate = text(p.file("AppDelegate.swift"));
    ok("build 6's black screen is repaired: the storyboard gains the app's module, the bare rename goes",
      r.status === 0 && /black screen/.test(r.stdout)
      && /customClass="SonaBridgeViewController" customModule="App" customModuleProvider="target" sceneMemberID/.test(sb)
      && !/@objc\(SonaBridgeViewController\)/.test(delegate) && (delegate.match(/class SonaBridgeViewController/g) || []).length === 1
      && (delegate.match(/BEGIN SONA SPEECH PLUGIN/g) || []).length === 1, r.stdout + r.stderr + sb);
    const again = run(p.app);
    ok("…and a rerun changes nothing", again.status === 0 && /already installed/.test(again.stdout)
      && text(p.file("Base.lproj/Main.storyboard")) === sb && text(p.file("AppDelegate.swift")) === delegate, again.stdout + again.stderr);
    rmSync(p.dir, { recursive: true, force: true });
  }
  // E/F. what it will not guess at: it stops, and changes nothing
  {
    const p = fresh(CAP);
    mkdirSync(path.join(p.dir, "App", "CapApp-SPM"), { recursive: true });
    writeFileSync(path.join(p.dir, "App", "CapApp-SPM", "Package.swift"), '.package(name: "SonaSpeech", path: "../../../node_modules/sona-speech")');
    const r = run(p.app);
    ok("it stops, changing nothing, when the plugin is already in the app as a package",
      r.status !== 0 && /already in the app as a package/.test(r.stderr) && !text(p.file("AppDelegate.swift")).includes("SONA SPEECH"), r.stderr);
    rmSync(p.dir, { recursive: true, force: true });
    const q = fresh('customClass="SomethingElse" customModule="App"');
    const u = run(q.app);
    ok("…or when the storyboard loads a controller it does not know",
      u.status !== 0 && /Could not tell which controller/.test(u.stderr) && !text(q.file("AppDelegate.swift")).includes("SONA SPEECH"), u.stderr);
    rmSync(q.dir, { recursive: true, force: true });
  }
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
