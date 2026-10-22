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
  // The position is the one asked for, else Sona.soundPos(): an SLP's homework
  // first, then the family's setting, with each sound's own fallbacks — the
  // same reader the word step uses. It read the setting alone once, so
  // End-of-word homework still got "I see a rabbit."
  function targetWords(sound, pos) {
    try {
      if (!pos && window.Sona && Sona.soundPos) pos = Sona.soundPos(sound) || "";
    } catch (e) {}
    if (window.Sona && Sona.wordsFor) {
      var sel = Sona.wordsFor(sound, pos || "");
      if (sel && sel.length) return sel;
    }
    return initialWords(sound);
  }
  function take(a, n) { a = a.slice(); var out = []; for (var i = 0; i < n && a.length; i++) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); return out; }

  // Onset + vowel spells two words a child is never asked to say: "gay" for G
  // and "poo" for P (Travis, 30 Sep 2026). Swapped, not dropped, so every sound
  // keeps five. tests/soundmap.mjs holds the never-say list against this.
  var SWAP = { gay: "guy", poo: "pie" };
  var VOWELS = ["ah", "ee", "oo", "oh", "ay"];
  function cv(sound) {
    var on = ONSET[sound] || String(sound || "").toLowerCase();
    return VOWELS.map(function (v) { var t = SWAP[on + v] || (on + v); return { t: t, say: t, pos: "i" }; });
  }

  // ── SYLLABLES AT EVERY PLACE IN A WORD (Travis, 22 Oct 2026: "not just
  // saying the sound of the letter R, but to progress where we're doing re,
  // ra, ru, and then we're doing a full word and applying that to each
  // letter", with every word position open) ──
  // The syllable step practises the sound where the word will have it. "rah"
  // is an R at the start of a word; a child working on the end of words
  // says "ar", one working on the middle says "ah-rah", and a blend is said
  // with its cluster, "trah". Explicit tables, so Rachel can read and change
  // each one; every one of them is her call.
  //   SYL_MID   the middle of a word: vowel, sound, vowel, the same vowel on
  //             both sides. The hyphen stays in what Echo's voice is given, so
  //             it reads two beats, never "eerie". Left out: anything whose
  //             start-of-word half is skipped or swapped (pee, poo, gee,
  //             thee), "ah-lah" (it sounds like "Allah"), "ah-jah" ("Jah"),
  //             and "ee-ree"/"ee-lee", which a voice slides into one word.
  //             TH (v) says "thuh", its own sound, never the voiceless "thah".
  //   SYL_END   the end of a word: vowel, then the sound, spelled as the end
  //             of an English word wherever there is one ("ope" as in hope,
  //             "oak", "ace", "edge"), so a voice reads it the way it reads
  //             that word, and Apple writes down something close.
  //   SYL_VOC   vocalic R: the vowel + R sounds themselves. R at the end of a
  //             word IS vocalic R (car, door), so R's end syllables are these.
  //             No "er": a voice reads it as a hesitation, and the sound
  //             alone, "rrrr", already is it. `say` gives Echo a real word
  //             ("are", "ore"): a bare "ar" can be swallowed or spelled out.
  //   SYL_BLEND the r-, s- and l-blends the picker names ("tr, st, bl"). Each
  //             said WITHOUT its sound is still fine to hear ("spee" would be
  //             "pee", so S has "spa").
  // Left out on purpose: oss, ohss and ahz (each can sound like "ass"), and
  // every end with no clean English spelling (ohsh, ohj, ohg, ohv; "eeg" is
  // read as the letters EEG).
  // `t` is what the card shows; `say` is what Echo's voice is given.
  //
  // SYL_POS_ON IS THE LISTENING SWITCH, like GAME_SYL_ON for the games: a
  // place's syllables are asked only once someone has LISTENED to Echo say
  // them on a phone (/listen.html plays every one). A computer voice that
  // misreads a syllable models the wrong sound to a child copying it, which
  // is exactly what an SLP would have to undo. EVERY PLACE SHIPS OFF, and its
  // sound's climb skips the syllable step there, from the sound straight to
  // words (Sona.ladderSteps). Add a sound to a place to turn it on, once it
  // has been heard ("f" also covers R at the end of a word, whose syllables
  // are vocalic R's; "v" covers vocalic R).
  var SYL_MID = {
    P: ["ah-pah", "oh-poh", "ay-pay"], B: ["ah-bah", "ee-bee", "oo-boo", "oh-boh", "ay-bay"],
    M: ["ah-mah", "ee-mee", "oo-moo", "oh-moh", "ay-may"], N: ["ah-nah", "ee-nee", "oo-noo", "ay-nay"],
    T: ["ah-tah", "ee-tee", "oo-too", "oh-toh", "ay-tay"], D: ["ah-dah", "ee-dee", "oh-doh", "ay-day"],
    K: ["ah-kah", "ee-kee", "oo-koo", "oh-koh", "ay-kay"], G: ["ah-gah", "oo-goo", "oh-goh"],
    F: ["ah-fah", "ee-fee", "oo-foo", "oh-foh", "ay-fay"], V: ["ah-vah", "ee-vee", "oo-voo", "oh-voh", "ay-vay"],
    S: ["ah-sah", "ee-see", "oo-soo", "oh-soh", "ay-say"], Z: ["ah-zah", "ee-zee", "oo-zoo", "oh-zoh", "ay-zay"],
    SH: ["ah-shah", "ee-shee", "oo-shoo", "oh-shoh", "ay-shay"], CH: ["ah-chah", "ee-chee", "oo-choo", "oh-choh", "ay-chay"],
    J: ["ee-jee", "oo-joo", "oh-joh", "ay-jay"], L: ["oo-loo", "oh-loh", "ay-lay"],
    R: ["ah-rah", "oo-roo", "oh-roh", "ay-ray"], TH: ["ah-thah", "oo-thoo", "oh-thoh"],
    THV: ["ah-thuh", "oo-thuh", "oh-thuh"],
  };
  var SYL_END = {
    P: ["ahp", "eep", "oop", "ope", "ape"], B: ["ahb", "eeb", "oob", "obe"], M: ["ahm", "eem", "oom", "ohm", "aim"],
    N: ["ahn", "een", "oon", "own"], T: ["aht", "eet", "oot", "oat", "ate"], D: ["ahd", "eed", "ood", "ode", "aid"],
    K: ["ahk", "eek", "ook", "oak", "ache"], G: ["ahg", "oog", "ogue"], F: ["ahf", "eef", "oof", "oaf"],
    V: ["ahv", "eve", "oove"], S: ["oose", "ace", "ice"], Z: ["ease", "ooze", "oze"],
    SH: ["ash", "eesh", "oosh"], CH: ["atch", "each", "ooch", "oach"], J: ["odge", "age", "edge"],
    L: ["ahl", "eel", "ool", "ole", "ail"], TH: ["eeth", "ooth", "oath"], THV: ["eethe", "oothe", "oathe", "athe"],
  };
  var SYL_VOC = [["ar", "are"], ["or", "ore"], ["air", "air"], ["ear", "ear"], ["ire", "ire"]];
  var SYL_BLEND = {
    R: ["trah", "free", "grew", "droh", "kray"],
    S: ["spa", "ski", "snoo", "smoh", "stay"],
    L: ["blah", "flee", "clue", "glow", "play"],
  };
  var SYL_POS_ON = { m: [], f: [], v: [], b: [] };
  function _items(list, pos) {
    return (list || []).map(function (x) {
      var t = typeof x === "string" ? x : x[0], say = typeof x === "string" ? x : x[1];
      return { t: t, say: say, pos: pos };
    });
  }
  // a place's own table, switched on or not (the listening page reads it whole)
  function _table(sound, pos) {
    if (pos === "m") return _items(SYL_MID[sound], "m");
    if (pos === "f") return sound === "R" ? _items(SYL_VOC, "f") : _items(SYL_END[sound], "f");
    if (pos === "v") return sound === "R" ? _items(SYL_VOC, "v") : [];
    if (pos === "b") return _items(SYL_BLEND[sound], "b");
    return [];
  }
  function sylOn(sound, pos) { return (SYL_POS_ON[pos] || []).indexOf(String(sound || "").toUpperCase()) >= 0; }
  function _at(sound, pos) { return sylOn(sound, pos) ? _table(sound, pos) : []; }
  // syllables(sound): the start of a word, exactly as it has always been.
  // syllables(sound, pos): at that place in the word — [] when the place has
  // no table for this sound (vocalic R for S; the climb then uses the start of
  // a word, as its words do) or its table is not switched on yet (the climb
  // then skips the syllable step). Mixed: the start of a word and every other
  // place that is switched on.
  function syllables(sound, pos) {
    sound = String(sound || "").toUpperCase();
    if (!pos || pos === "i") return cv(sound);
    if (pos === "mix") {
      var all = cv(sound), seen = {};
      ["m", "f", "b"].forEach(function (p) { all = all.concat(_at(sound, p)); });
      return all.filter(function (s) { if (seen[s.t]) return false; seen[s.t] = 1; return true; });
    }
    if (!_table(sound, pos).length) return cv(sound);
    return _at(sound, pos);
  }
  // Every table, on or off, for the listening page and the tests:
  // [{ pos, sound, on, items }]
  function syllableTables() {
    var out = [];
    ["m", "f", "v", "b"].forEach(function (pos) {
      Object.keys(ONSET).forEach(function (sound) {
        var items = _table(sound, pos);
        if (items.length) out.push({ pos: pos, sound: sound, on: sylOn(sound, pos), items: items });
      });
    });
    return out;
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
  // EVERY PLACE IN A WORD (22 Oct 2026): a switched-on sound's cards ask the
  // syllables of the place being practised, from the tables above, only once
  // GAME_POS_ON lists that place for it; until then the cards skip the
  // syllable step (the sound, then a word of that place). The same listening
  // rule as GAME_SYL_ON, kept as a list of what is ON so that nothing new can
  // switch itself on: R's start-of-word card lines were listened to; its new
  // ones ("ar", "ah-rah", "trah") have not been, in Fruit Slice's one-line
  // ask ("To keep playing, say... ar."). Someone listens on a phone, then adds
  // the place. GAME_SHORT_AT is the short word for each other place: bank
  // words with pictures, which every picture game already says, again a list
  // Rachel can read.
  var GAME_SYL_ON = ["R"];
  var GAME_SKIP = { P: ["pee"], G: ["gee"], TH: ["thee"] };
  var GAME_SHORT = { R: "rot" };
  var GAME_POS_ON = { R: [] };
  var GAME_SHORT_AT = { R: { m: "zero", f: "car", v: "bird", b: "tree" } };
  function gameSyllables(sound, pos) {
    sound = String(sound || "").toUpperCase();
    if (GAME_SYL_ON.indexOf(sound) < 0) return [];
    var skip = GAME_SKIP[sound] || [];
    // Mixed includes the start of a word, whose card lines were listened to,
    // so its cards ask those (as do TH (v)'s, whose words are all "mixed")
    if (pos && pos !== "i" && pos !== "mix") {
      if ((GAME_POS_ON[sound] || []).indexOf(pos) < 0) return [];
      // only this place's own syllables: a fallback to "ree" is not this place
      return _at(sound, pos).filter(function (s) { return skip.indexOf(s.t) < 0; }).slice(0, 3);
    }
    var all = syllables(sound);
    // syllables() runs ah, ee, oo, oh, ay: take ee, ah, oh, then the stand-ins
    return [1, 0, 3, 2, 4].map(function (i) { return all[i]; })
      .filter(function (s) { return s && skip.indexOf(s.t) < 0; }).slice(0, 3);
  }
  function gameWord(sound, pos) {
    sound = String(sound || "").toUpperCase();
    if (GAME_SYL_ON.indexOf(sound) < 0) return "";
    if (pos && pos !== "i" && pos !== "mix") return (GAME_SHORT_AT[sound] || {})[pos] || "";
    return GAME_SHORT[sound] || "";
  }

  // ── SENTENCES THAT ARE ENGLISH (22 Oct 2026) ──
  // Every frame used to say "a": "I see a ear.", "I have a milk.", "Here is a
  // grapes.", "I see a think." — the "a rain" class of mistake CLAUDE.md's
  // clinical rules forbid, and opening every position put many more such
  // words in front of children. SENT_FORM says, for EVERY word in the bank,
  // how a sentence holds it (posladdertest fails on a bank word missing here):
  //   "a" / "an"  a thing you count: "I see a car." / "I see an egg."
  //   "none"      a thing you don't count: "I see water.", "Here is milk."
  //   "pl"        more than one: "I see grapes.", "Here are grapes."
  //   "the"       there is one of it: "I see the sun."
  //   "my"        a person in the family: "I see my mom."
  //   "x"         not a thing at all (happy, think, breathe, three): never in a
  //               sentence; still asked as a word.
  // Which words a sentence may hold is Rachel's call.
  var SENT_FORM = {
    angel: "an", apple: "an", arm: "an", arrow: "an", baby: "a", badge: "a", bag: "a", ball: "a", balloon: "a",
    banana: "a", bath: "a", bathe: "x", bathtub: "a", beach: "a", bear: "a", bed: "a", bee: "a", bees: "pl",
    bell: "a", bicycle: "a", bird: "a", birthday: "x", blocks: "pl", boat: "a", bone: "a", book: "a",
    branch: "a", breathe: "x", bridge: "a", broom: "a", brother: "my", brush: "a", bucket: "a", bug: "a",
    bulldozer: "a", bus: "a", button: "a", cab: "a", cage: "a", cake: "a", camel: "a", can: "a", car: "a",
    carrot: "a", castle: "a", cat: "a", cave: "a", chair: "a", cheese: "none", cherry: "a", chicken: "a",
    chips: "pl", chocolate: "none", clock: "a", cloud: "a", cob: "a", coffee: "none", color: "a", cookie: "a",
    corn: "none", couch: "a", cow: "a", crab: "a", cup: "a", dad: "my", deer: "a", desk: "a", dinner: "none",
    dinosaur: "a", dish: "a", dishes: "pl", dizzy: "x", dog: "a", doll: "a", door: "a", dove: "a",
    dragon: "a", dress: "a", driver: "a", drum: "a", drummer: "a", duck: "a", ear: "an", egg: "an",
    elephant: "an", engine: "an", fan: "a", farm: "a", father: "my", feather: "a", finger: "a", fire: "a",
    fish: "a", five: "x", flag: "a", food: "none", foot: "a", fork: "a", four: "x", fox: "a", frog: "a",
    game: "a", gate: "a", gift: "a", giraffe: "a", girl: "a", glass: "a", glove: "a", gloves: "pl",
    goat: "a", goose: "a", grapes: "pl", guitar: "a", gum: "none", ham: "none", hammer: "a", hand: "a",
    happy: "x", hat: "a", hose: "a", house: "a", ice: "none", jacket: "a", jam: "none", jar: "a", jeep: "a",
    jet: "a", juice: "none", kangaroo: "a", ketchup: "none", key: "a", king: "a", kitchen: "a", kite: "a",
    knife: "a", koala: "a", ladder: "a", lamp: "a", leaf: "a", leash: "a", leather: "none", leg: "a",
    lemon: "a", letter: "a", lion: "a", lizard: "a", lock: "a", lollipop: "a", lunch: "none", magic: "x",
    magnet: "a", map: "a", math: "x", medal: "a", milk: "none", mom: "my", monkey: "a", moon: "the",
    moth: "a", mother: "my", mountain: "a", mouse: "a", mouth: "a", muffin: "a", mug: "a", nail: "a",
    nest: "a", net: "a", nine: "x", noodle: "a", nose: "a", nut: "a", ocean: "the", orange: "an", oven: "an",
    owl: "an", page: "a", paint: "none", pajamas: "pl", pan: "a", panda: "a", paper: "a", parrot: "a",
    peach: "a", peanut: "a", pen: "a", pencil: "a", pie: "a", pig: "a", pigeon: "a", pillow: "a", pin: "a",
    pizza: "a", plane: "a", plate: "a", potato: "a", pumpkin: "a", puppy: "a", puzzle: "a", rabbit: "a",
    radio: "a", rain: "none", ribbon: "a", ring: "a", river: "a", road: "a", robot: "a", rock: "a",
    rocket: "a", roof: "a", rope: "a", rose: "a", salad: "a", sand: "none", sandwich: "a", scarf: "a",
    school: "a", scissors: "pl", seal: "a", seven: "x", sheep: "a", shell: "a", ship: "a", shirt: "a",
    shark: "a", shoe: "a", shower: "a", sled: "a", smile: "a", smooth: "x", snail: "a", snake: "a", soap: "none",
    sock: "a", soda: "a", sofa: "a", soup: "none", spider: "a", spoon: "a", star: "a", stop: "x",
    stove: "a", sun: "the", table: "a", teacher: "a", teeth: "pl", teethe: "x", telephone: "a", ten: "x",
    tennis: "x", think: "x", thirty: "x", thorn: "a", thread: "a", three: "x", thumb: "a", tiger: "a",
    tissue: "a", toe: "a", tomato: "a", tooth: "a", toothbrush: "a", top: "a", toy: "a", train: "a",
    trash: "none", tree: "a", truck: "a", tub: "a", turtle: "a", van: "a", vase: "a", vegetable: "a",
    vest: "a", video: "a", violin: "a", volcano: "a", wagon: "a", wash: "x", washing: "x", watch: "a",
    water: "none", wave: "a", weather: "x", web: "a", whale: "a", wolf: "a", yellow: "x", zebra: "a",
    zero: "x", zigzag: "a", zip: "x", zipper: "a", zoo: "a",
  };
  // The words each form puts in a frame's slots: {a} before the word, {the}
  // where a frame says "the", {my} where it says "my", {is} for "Here is".
  var FORM_SLOTS = {
    a: { a: "a ", the: "the ", my: "my ", is: "is" }, an: { a: "an ", the: "the ", my: "my ", is: "is" },
    none: { a: "", the: "the ", my: "my ", is: "is" }, pl: { a: "", the: "the ", my: "my ", is: "are" },
    the: { a: "the ", the: "the ", my: "the ", is: "is" }, my: { a: "my ", the: "my ", my: "my ", is: "is" },
  };
  function sentForm(word) { var f = SENT_FORM[String(word || "").toLowerCase()]; return f || "a"; }
  function _fill(frame, word) {
    var sl = FORM_SLOTS[sentForm(word)] || FORM_SLOTS.a;
    return frame.replace("{a}", sl.a).replace("{the}", sl.the).replace("{my}", sl.my).replace("{is}", sl.is).replace("___", word);
  }
  // Unchanged frames for a word you count: "I see a ___.", "I have a ___.",
  // "Look at the ___.", "Here is a ___.", "I like my ___."
  var SENT_FRAMES = ["I see {a}___.", "I have {a}___.", "Look at {the}___.", "Here {is} {a}___.", "I like {my}___."];
  function sentenceFor(word, i) {
    var form = sentForm(word);
    if (form === "x") return null;
    // nobody "has" their mom, or the sun: those take "I like" instead
    i = (i | 0) % SENT_FRAMES.length;
    if (i === 1 && (form === "my" || form === "the")) i = 4;
    var t = _fill(SENT_FRAMES[i], word).replace(/ {2,}/g, " ");
    return { t: t, say: t.replace(/[.]/g, ""), word: word };
  }
  function sentences(sound, pos) {
    var ws = targetWords(sound, pos).filter(function (w) { return sentForm(w.w) !== "x"; });
    return take(ws, SENT_FRAMES.length).map(function (w, i) {
      var s = sentenceFor(w.w, i);
      return { t: s.t, say: s.say, e: w.e, word: w.w, pos: w.pos };
    });
  }
  function storyPages(sound, pos) {
    var frames = ["Once, Echo saw {a}___.", "He really liked {the}___.", "Then {a}___ came along.", "Echo and {the}___ played all day.", "What a day with {the}___!"];
    var ws = targetWords(sound, pos).filter(function (w) { return sentForm(w.w) !== "x"; });
    return take(ws, frames.length).map(function (w, i) {
      var sl = FORM_SLOTS[sentForm(w.w)] || FORM_SLOTS.a;
      return { text: frames[i % frames.length].replace("{a}", sl.a).replace("{the}", sl.the).replace(/ {2,}/g, " "), word: w.w, e: w.e };
    });
  }
  function chats(sound, pos) {
    var frames = ["Which do you like — {a}___ or {b}___?", "Do you want {the}___ or {the2}___?", "Pick one — ___ or ___!", "Hmm… {a}___ or {b}___?"];
    var ws = targetWords(sound, pos).filter(function (w) { return sentForm(w.w) !== "x"; }), out = [];
    for (var i = 0; i < 4 && ws.length >= 2; i++) {
      var pair = take(ws, 2), A = FORM_SLOTS[sentForm(pair[0].w)] || FORM_SLOTS.a, B = FORM_SLOTS[sentForm(pair[1].w)] || FORM_SLOTS.a;
      var q = frames[i % frames.length].replace("{a}", A.a).replace("{b}", B.a).replace("{the}", A.the).replace("{the2}", B.the);
      out.push({ q: q.replace("___", pair[0].w).replace("___", pair[1].w).replace(/ {2,}/g, " "), options: pair });
    }
    return out;
  }

  window.SonaContent = { initialWords: initialWords, targetWords: targetWords, syllables: syllables, gameSyllables: gameSyllables, gameWord: gameWord, GAME_SYL_ON: GAME_SYL_ON, GAME_SKIP: GAME_SKIP, GAME_SHORT: GAME_SHORT, GAME_POS_ON: GAME_POS_ON, GAME_SHORT_AT: GAME_SHORT_AT, SYL_MID: SYL_MID, SYL_END: SYL_END, SYL_VOC: SYL_VOC, SYL_BLEND: SYL_BLEND, SYL_POS_ON: SYL_POS_ON, sylOn: sylOn, syllableTables: syllableTables, SENT_FORM: SENT_FORM, sentForm: sentForm, sentenceFor: sentenceFor, sentences: sentences, storyPages: storyPages, chats: chats };
})();
