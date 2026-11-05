/* Shared activity content for the Sona games.
   Generated from the word banks (window.Sona.WORDS) so every sound gets
   syllables, sentences, a mini story, and chat prompts for free —
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
  // Words at the position to practise (Beginning/Middle/End/Vocalic R/Blends/Mixed),
  // read from window.Sona.WORDS. Falls back to initial-position words if Sona isn't loaded.
  // The position is Sona.practicePos(): an SLP's homework first, then the
  // family's setting, the same reader the word step uses (30 Sep 2026). This
  // read the setting alone, so End-of-word homework still got "I see a rabbit."
  function targetWords(sound) {
    var pos = "";
    try {
      if (window.Sona && Sona.practicePos) pos = Sona.practicePos() || "";
      else if (window.Sona && Sona.getProfile) pos = Sona.getProfile().practicePosition || "";
    } catch (e) {}
    if (window.Sona && Sona.wordsFor) {
      var sel = Sona.wordsFor(sound, pos);
      if (sel && sel.length) return sel;
    }
    return initialWords(sound);
  }
  function take(a, n) { a = a.slice(); var out = []; for (var i = 0; i < n && a.length; i++) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); return out; }

  // Onset + vowel spells two words a child is never asked to say: "gay" for G
  // and "poo" for P (Travis, 30 Sep 2026). Swapped, not dropped, so every sound
  // keeps five. tests/soundmap.mjs holds the never-say list against this.
  var SWAP = { gay: "guy", poo: "pie" };
  function syllables(sound) {
    var on = ONSET[sound] || sound.toLowerCase();
    return ["ah", "ee", "oo", "oh", "ay"].map(function (v) { var t = SWAP[on + v] || (on + v); return { t: t, say: t }; });
  }
  // ── what a GAME's say-it card may ask for, past the bare sound (Travis, 1
  // Oct 2026: "start with isolation then ree rah roh then rot") ──
  // The card between rounds asks ONE of these a card, never three in a breath:
  // a rotating list was tried in July and confused children. They are built
  // from syllables() so the never-say swaps above hold, in Travis's order
  // (ee, ah, oh), with oo and ay standing in for one that is skipped.
  // GAME_SKIP: Echo's computer voice models a card's syllable, and it reads
  // "gee" as "jee" and "thee" as the loud th, the wrong sound for the child
  // copying it; "pee" is a potty word.
  // GAME_SYL_ON is the switch, one sound at a time. A sound goes in only
  // after someone has LISTENED to its lines on a phone (R is where a changed
  // voice once slid toward "w"). A sound that is not in it gets nothing here,
  // and its cards keep asking the bare sound, exactly as before.
  // GAME_SHORT is the short word that follows the syllables: an explicit list
  // Rachel can read, never "the shortest bank word" (L tied on lion and
  // leaf). "rot" is Travis's word; it is in no word bank and has no picture,
  // so only a text card may ask it. All of this is Rachel's call.
  var GAME_SYL_ON = ["R"];
  var GAME_SKIP = { P: ["pee"], G: ["gee"], TH: ["thee"] };
  var GAME_SHORT = { R: "rot" };
  function gameSyllables(sound) {
    sound = String(sound || "").toUpperCase();
    if (GAME_SYL_ON.indexOf(sound) < 0) return [];
    var all = syllables(sound), skip = GAME_SKIP[sound] || [];
    // syllables() runs ah, ee, oo, oh, ay: take ee, ah, oh, then the stand-ins
    return [1, 0, 3, 2, 4].map(function (i) { return all[i]; })
      .filter(function (s) { return s && skip.indexOf(s.t) < 0; }).slice(0, 3);
  }
  function gameWord(sound) {
    sound = String(sound || "").toUpperCase();
    return GAME_SYL_ON.indexOf(sound) >= 0 ? (GAME_SHORT[sound] || "") : "";
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

  window.SonaContent = { initialWords: initialWords, targetWords: targetWords, syllables: syllables, gameSyllables: gameSyllables, gameWord: gameWord, GAME_SYL_ON: GAME_SYL_ON, GAME_SKIP: GAME_SKIP, GAME_SHORT: GAME_SHORT, sentences: sentences, storyPages: storyPages, chats: chats };
})();
