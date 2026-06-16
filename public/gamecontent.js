/* Shared activity content for the Sona games.
   Generated from the word banks (window.Sona.WORDS) so every sound gets
   syllables, phrases, sentences, a mini story, and chat prompts for free —
   the Articulation-Station "depth", without hand-authoring each sound.
   Exposes window.SonaContent. */
(function () {
  var ONSET = { R: "r", S: "s", L: "l", K: "k", G: "g", F: "f", SH: "sh", CH: "ch", TH: "th", Z: "z", V: "v", J: "j" };
  // initial-position matcher per sound (what reads cleanly as "starts with the sound")
  var INIT = { R: /^r/, S: /^s(?!h)/, L: /^l/, K: /^(c|k)/, G: /^g/, F: /^f/, SH: /^sh/, CH: /^ch/, TH: /^th/, Z: /^z/, V: /^v/, J: /^j/ };

  function words(sound) { return (window.Sona && Sona.WORDS && Sona.WORDS[sound]) ? Sona.WORDS[sound] : []; }
  function initialWords(sound) {
    var ws = words(sound), re = INIT[sound];
    var out = re ? ws.filter(function (w) { return re.test(w.w.toLowerCase()); }) : [];
    return out.length ? out : ws; // fallback to all if none match
  }
  function take(a, n) { a = a.slice(); var out = []; for (var i = 0; i < n && a.length; i++) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); return out; }

  function syllables(sound) {
    var on = ONSET[sound] || sound.toLowerCase();
    return ["ah", "ee", "oo", "oh", "ay"].map(function (v) { return { t: on + v, say: on + v }; });
  }
  function phrases(sound) {
    var carriers = ["a", "my", "the", "one", "a big", "a little"];
    return take(initialWords(sound), 6).map(function (w, i) {
      var c = carriers[i % carriers.length];
      return { t: c + " " + w.w, say: c + " " + w.w, e: w.e, word: w.w };
    });
  }
  function sentences(sound) {
    var frames = ["I see a ___.", "I have a ___.", "Look at the ___.", "Here is a ___.", "I like my ___."];
    return take(initialWords(sound), frames.length).map(function (w, i) {
      var t = frames[i % frames.length].replace("___", w.w);
      return { t: t, say: t.replace(/[.]/g, ""), e: w.e, word: w.w };
    });
  }
  function storyPages(sound) {
    var frames = ["Once, Leo saw a ___.", "He really liked the ___.", "Then came a big ___.", "Leo and the ___ played all day.", "What a fun ___!"];
    return take(initialWords(sound), frames.length).map(function (w, i) {
      return { text: frames[i % frames.length], word: w.w, e: w.e };
    });
  }
  function chats(sound) {
    var frames = ["Which do you like — a ___ or a ___?", "Do you want the ___ or the ___?", "Pick one — ___ or ___!", "Hmm… a ___ or a ___?"];
    var ws = initialWords(sound), out = [];
    for (var i = 0; i < 4 && ws.length >= 2; i++) {
      var pair = take(ws, 2);
      out.push({ q: frames[i % frames.length].replace("___", pair[0].w).replace("___", pair[1].w), options: pair });
    }
    return out;
  }

  window.SonaContent = { initialWords: initialWords, syllables: syllables, phrases: phrases, sentences: sentences, storyPages: storyPages, chats: chats };
})();
