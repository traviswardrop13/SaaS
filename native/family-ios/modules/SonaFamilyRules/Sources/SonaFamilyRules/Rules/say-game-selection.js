// Say & Play config from its original game pages and word selection from public/sayplay.js.
const nativeSayGameConfig = {
  "bubbles": {
    "title": "Bubble Pop",
    "intro": null,
    "steps": 5,
    "sayings": 1
  },
  "peekaboo": {
    "title": "Peekaboo",
    "intro": "Say each word two times to hide a picture.",
    "steps": 5,
    "sayings": 2
  },
  "hoops": {
    "title": "Hoops",
    "intro": "Say each word two times to get a ball.",
    "steps": 8,
    "sayings": 2
  },
  "soccer": {
    "title": "Soccer Goal",
    "intro": "Say each word two times to get a ball.",
    "steps": 8,
    "sayings": 2
  },
  "dino": {
    "title": "Dino Dig",
    "intro": "Say each word two times to get a brush.",
    "steps": 8,
    "sayings": 2
  },
  "racecar": {
    "title": "Race Car",
    "intro": "Say each word two times to drive. Then drag to steer into the glowing ring.",
    "steps": 8,
    "sayings": 2
  },
  "treasure": {
    "title": "Treasure Map",
    "intro": "Say each word two times to set sail. Then draw a line from your boat to the glowing ring.",
    "steps": 8,
    "sayings": 2
  },
  "space": {
    "title": "Space Trip",
    "intro": "Say each word two times to start a flight. Then land on each planet.",
    "steps": 8,
    "sayings": 2
  },
  "balloon": {
    "title": "Balloon Party",
    "intro": "Say each word two times to get a balloon. Pump it up. Then pull it into the glowing ring and let go.",
    "steps": 5,
    "sayings": 2
  },
  "flower": {
    "title": "Grow a Flower",
    "intro": "Say each word two times to fill your watering can. Then hold the can over the glowing soil. Tap the water drop for more water.",
    "steps": 5,
    "sayings": 2
  },
  "rocket": {
    "title": "Rocket Blast",
    "intro": "Say your word two times to get a rocket. Then pull it down and let go!",
    "steps": 5,
    "sayings": 2
  },
  "snowman": {
    "title": "Build a Snowman",
    "intro": "Say your word two times to get a snowball. Roll it big, and stack it!",
    "steps": 5,
    "sayings": 2
  },
  "train": {
    "title": "Choo-Choo Train",
    "intro": "Say your word two times to start the train. Then drive, stop, and help a friend aboard.",
    "steps": 5,
    "sayings": 2
  },
  "stars": {
    "title": "Bedtime Stars",
    "intro": "Say each word two times to start a picture. Then slide from star to star to draw it.",
    "steps": 5,
    "sayings": 2
  },
  "cake": {
    "title": "Birthday Cake",
    "intro": "Say each word two times to start each cooking step. Then bake the cake!",
    "steps": 5,
    "sayings": 2
  },
  "robot": {
    "title": "Robot Builder",
    "intro": "Say each word two times to open a circuit. Tap the wires to turn them, then press Test power.",
    "steps": 8,
    "sayings": 2
  },
  "castle": {
    "title": "Castle Builder",
    "intro": "Say each word two times to get a castle piece. Slide the crane over the glow, then hold Lower.",
    "steps": 8,
    "sayings": 2
  },
  "pizza": {
    "title": "Pizza Chef",
    "intro": "Say each word two times to start the next step. Then your hands make the pizza!",
    "steps": 8,
    "sayings": 2
  }
};
const nativeFirstStoryConfig = {
  "lighthouse": {
    "title": "Light the Way",
    "young": "Say each word three times to light the lamp. Then touch the glowing boat with the light.",
    "regular": "Say each word three times to light the lamp. Then move the light to find a lost boat. Tap Bright beam for extra help."
  },
  "windup": {
    "title": "Wind-Up Toys",
    "young": "Say each word three times to find a toy's key. Then draw circles on the key until it rings.",
    "regular": "Say each word three times to find a toy's key. Wind it with circles, and let go at the star. Tap Oil can for extra help."
  },
  "bridge": {
    "title": "Puzzle Bridge",
    "young": "Say each word three times to call a stone up. Then slide it into the hole with the same shape.",
    "regular": "Say each word three times to call a stone up. Then turn it and slide it into its hole. Tap Calm river for extra help."
  }
};
function nativeStoryGame(key) {
    const story = Sona.STORY_DAYS.find(item => item.game === key);
    if (!story) return null;
    const simple = Sona.playStyle() === "simple";
    const first = nativeFirstStoryConfig[key];
    if (first) return { title: first.title, intro: simple ? first.young : first.regular,
        steps: simple ? 6 : 8, sayings: Sona.STORY_SAY_TIMES };
    const copy = window.DailyAdventurePages[story.controller];
    return copy && { title: copy.title, intro: copy.intro, steps: simple ? 5 : 8, sayings: Sona.STORY_SAY_TIMES };
}
function nativeSayGame(options) {
    const config = nativeSayGameConfig[options.game] || nativeStoryGame(options.game);
    if (!config) return null;
    var SOUND = String(Sona.rotSound() || "R").toUpperCase();
    var WORDS = Sona.playPool(SOUND, 10);
    if (!WORDS.length) { SOUND = "R"; WORDS = Sona.playPool(SOUND, 10); }
    if (!WORDS.length) return null;
    var roundWords = [], themedUsed = [], used = [], step = 0, word = null;
    var themed = Sona.gameWords(options.game, SOUND);
  function pickWord() {
    if(step%3===0){
      var theme=themed.filter(function(w){return themedUsed.indexOf(w.w)<0&&roundWords.indexOf(w.w)<0;})[0];
      if(theme){themedUsed.push(theme.w);roundWords.push(theme.w);return theme;}
    }
    var fresh=WORDS.filter(function(w){return roundWords.indexOf(w.w)<0;});
    if(fresh.length){var choice=fresh[(Math.random()*fresh.length)|0];roundWords.push(choice.w);return choice;}
    // A short bank may need an ordinary repeat, but never repeat a theme.
    var repeats=WORDS.filter(function(w){return themedUsed.indexOf(w.w)<0&&(!word||w.w!==word.w);});
    if(repeats.length){var again=repeats[(Math.random()*repeats.length)|0];roundWords.push(again.w);return again;}
    var i, tries = 0;
    do { i = (Math.random() * WORDS.length) | 0; tries++; } while (WORDS.length > 1 && (used.indexOf(i) >= 0 || (word && WORDS[i] === word)) && tries < 40);
    used.push(i); if (used.length >= WORDS.length) used = [];
    return WORDS[i];
  }
    const targets = [];
    for (step = 0; step < config.steps; step++) {
        word = pickWord();
        if (!word || !word.w) return null;
        targets.push({ word: word.w, emoji: word.e || "", position: word.pos || "" });
    }
    const profile = Sona.getProfile();
    return { title: config.title, intro: config.intro, sayings: config.sayings, targets, sound: SOUND,
        voice: profile.voiceId || "", voiceOn: profile.voiceOn !== false,
        soundOn: profile.soundOn !== false, isSimple: Sona.playStyle() === "simple",
        volume: profile.volume == null ? 0.8 : Number(profile.volume) };
}
