/* Shared activity content for the Sona games.
   Generated from the word banks (window.Sona.WORDS) so every sound gets
   syllables, phrases, sentences, a mini story, and chat prompts for free —
   the Articulation-Station "depth", without hand-authoring each sound.
   Exposes window.SonaContent. */
(function () {
  var ONSET = { R: "r", S: "s", L: "l", K: "k", G: "g", F: "f", SH: "sh", CH: "ch", TH: "th", THV: "th", Z: "z", V: "v", J: "j", P: "p", B: "b", M: "m", N: "n", T: "t", D: "d" };
  // initial-position matcher per sound (what reads cleanly as "starts with the sound")
  var INIT = { R: /^r/, S: /^s(?!h)/, L: /^l/, K: /^(c|k)/, G: /^g/, F: /^f/, SH: /^sh/, CH: /^ch/, TH: /^th/, THV: /^th/, Z: /^z/, V: /^v/, J: /^(j|g)/, P: /^p/, B: /^b/, M: /^m/, N: /^n/, T: /^t(?!h)/, D: /^d/ };

  function words(sound) { return (window.Sona && Sona.WORDS && Sona.WORDS[sound]) ? Sona.WORDS[sound] : []; }
  function initialWords(sound) {
    var ws = words(sound), re = INIT[sound];
    var out = re ? ws.filter(function (w) { return re.test(w.w.toLowerCase()); }) : [];
    return out.length ? out : ws; // fallback to all if none match
  }
  // Words at the position the parent/SLP chose (Beginning/Middle/End/Vocalic R/Blends/Mixed),
  // read from window.Sona.WORDS. Falls back to initial-position words if Sona isn't loaded.
  function targetWords(sound) {
    var pos = "";
    try { pos = (window.Sona && Sona.getProfile) ? (Sona.getProfile().practicePosition || "") : ""; } catch (e) {}
    if (window.Sona && Sona.wordsFor) {
      var sel = Sona.wordsFor(sound, pos);
      if (sel && sel.length) return sel;
    }
    return initialWords(sound);
  }
  function take(a, n) { a = a.slice(); var out = []; for (var i = 0; i < n && a.length; i++) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); return out; }

  function syllables(sound) {
    var on = ONSET[sound] || sound.toLowerCase();
    return ["ah", "ee", "oo", "oh", "ay"].map(function (v) { return { t: on + v, say: on + v }; });
  }
  // The prompt is ONE word. This used to rotate a carrier onto the front of it
  // ("a", "my", "the", "one", "a big", "a little"), which produced "a rain" and
  // "a robot" — the carrier was applied blindly, so every mass noun and every
  // non-noun in the bank came out ungrammatical. A five-year-old reading "Say a
  // rain" is being asked to practise a mistake.
  //
  // A real phrase step needs to know which words take which carrier, word by
  // word. Until that exists, the phrase rung presents the target word alone,
  // same as the word rung. The seam stays so a hand-checked carrier set can drop
  // in here later without re-plumbing the ladder.
  function phrases(sound) {
    return take(targetWords(sound), 6).map(function (w) {
      return { t: w.w, say: w.w, e: w.e, word: w.w };
    });
  }
  function sentences(sound) {
    var frames = ["I see a ___.", "I have a ___.", "Look at the ___.", "Here is a ___.", "I like my ___."];
    return take(targetWords(sound), frames.length).map(function (w, i) {
      var t = frames[i % frames.length].replace("___", w.w);
      return { t: t, say: t.replace(/[.]/g, ""), e: w.e, word: w.w };
    });
  }
  function storyPages(sound) {
    var frames = ["Once, Echo saw a ___.", "He really liked the ___.", "Then came a big ___.", "Echo and the ___ played all day.", "What a fun ___!"];
    return take(targetWords(sound), frames.length).map(function (w, i) {
      return { text: frames[i % frames.length], word: w.w, e: w.e };
    });
  }
  function chats(sound) {
    var frames = ["Which do you like — a ___ or a ___?", "Do you want the ___ or the ___?", "Pick one — ___ or ___!", "Hmm… a ___ or a ___?"];
    var ws = targetWords(sound), out = [];
    for (var i = 0; i < 4 && ws.length >= 2; i++) {
      var pair = take(ws, 2);
      out.push({ q: frames[i % frames.length].replace("___", pair[0].w).replace("___", pair[1].w), options: pair });
    }
    return out;
  }

  window.SonaContent = { initialWords: initialWords, targetWords: targetWords, syllables: syllables, phrases: phrases, sentences: sentences, storyPages: storyPages, chats: chats };
})();
