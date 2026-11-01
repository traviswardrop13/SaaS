/* THE TALKING STORIES (TALK1, 31 Oct 2026). Day 1 of the daily adventure in
   the child's own sound (Travis: "we just need to wow them in their first
   sessions so the daily adventure is prob the one most choose and the day 1
   has to be awesome ... i want the books in the daily adventure to be unique
   depending on the target sound so they are practicing it throughout the
   story"; then "go build the r one and the other popular sounds").

   Loaded by /adventure.html alone. The day list (title, Home's line and
   picture) is sona.js's STORY_TALK; this file holds what Echo reads and the
   one word each page asks for.

   A talking story is a story with no separate game: every page has one KEY
   word in the story's sound, Echo reads the page, the word lights up, Echo
   asks "Can you say... <word>." and the child's voice turns the page (the
   books' word moment, SayCheck). The intro's last word finishes the day,
   and the happy ending plays straight on, every page asking its word too.

   A scene: { art, ages, key, line }, as adventures.js's, plus
     key   the page's one word, lower case, a whole word in its line (both
           lines, where it has two), that starts with the story's sound
           before a vowel by its pronouncing entry (tests/booklex.json), and
           for R with no second r-coloured sound (the books' key rule;
           tests/talkstorytest.mjs holds every one to it).
   No buddy is laid over these pictures (buddy: none), so no spot was left.
   Every line keeps adventures.js's rules (120 characters at most, no
   child's name, no speech sound named, nothing about how to talk, none of
   the words a child could read as a grade). What a child is asked to say,
   and every word here, is Rachel's to change. ES5, no build step. */
(function (global) {
  "use strict";
  global.SonaTalkStories = {

    // R: Robo's Rocket. Robo the robot built a rocket for the moon, and it
    // won't wake up: the child's words wake it, fill it and fly it.
    robo: {
      sound: "R",
      wash: "#3a4f8a",
      intro: [
        { art: "s01", ages: "both", key: "red",
          line: "Pelly the pelican brought us a letter. Oops! That's a big red boot!" },
        { art: "s02", ages: "both", key: "robot",
          line: { big: "Here's the real letter. It's from Robo the robot. Come quick, he needs our help!",
                  little: "The real letter is from Robo the robot. Come quick!" } },
        { art: "s03", ages: "big", key: "road",
          line: "We hurry down the bumpy road to Robo's workshop on the hill." },
        { art: "s04", ages: "both", key: "rocket",
          line: { big: "Robo built a shiny rocket to fly to the moon. But it's fast asleep! Let's wake up the rocket.",
                  little: "Robo built a rocket. It's fast asleep! Let's wake up the rocket." } },
        { art: "s05", ages: "both", key: "rope",
          line: { big: "Blink, blink! The rocket woke up! Now Robo needs a rope to tie the fuel tank on.",
                  little: "Blink, blink! It woke up! Now we need a rope." } },
        { art: "s06", ages: "big", key: "raccoon",
          line: "A little raccoon pops out of a box, holding the rope. Thank you, raccoon!" },
        { art: "s07", ages: "both", key: "ready",
          line: { big: "Everyone climbs in and buckles up. Robo looks at us. Are we ready?",
                  little: "We climb in and buckle up. Are we ready?" } },
        { art: "s08", ages: "both", key: "rise",
          line: { big: "Three, two, one... the rocket rumbles and glows. Let's rise up into the sky!",
                  little: "Three, two, one... let's rise up into the sky!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "rainbow",
          line: { big: "Whoosh! We zoom up past a giant rainbow, higher and higher.",
                  little: "Whoosh! We zoom past a giant rainbow!" } },
        { art: "e02", ages: "big", key: "rabbit",
          line: "We land on the moon, and a fluffy moon rabbit hops over to wave hello." },
        { art: "e03", ages: "both", key: "ring",
          line: { big: "Robo gives us a shiny ring that glows like the stars. Thank you, friends!",
                  little: "Robo gives us a shiny ring. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "ride",
          line: { big: "What a ride! A gold star for Robo's workshop on our helper map!",
                  little: "What a ride! A gold star for our helper map!" } }
      ]
    },

    lulu: {
      sound: "L",
      wash: "#34507a",
      intro: [
        { art: "s01", ages: "both", key: "lemon",
          line: "Pelly the pelican brought us a letter. Oops! That's a big yellow lemon!" },
        { art: "s02", ages: "both", key: "lamb",
          line: { big: "Here's the real letter. It's from Lulu the little lamb. Come to her lantern party by the lake tonight!",
                  little: "The real letter is from Lulu the little lamb. Come to her lantern party!" } },
        { art: "s03", ages: "big", key: "leaves",
          line: "We hurry down the hill through the crunchy leaves. The sun is going down over the lake." },
        { art: "s04", ages: "both", key: "light",
          line: { big: "We made it to the lake, but the lanterns are dark. Where is Lulu? Let's light the lanterns!",
                  little: "The lanterns are dark. Where is Lulu? Let's light the lanterns!" } },
        { art: "s05", ages: "both", key: "lily",
          line: { big: "Glow, glow! There's Lulu on a little island. Her lily pads floated away! Let's bring them back.",
                  little: "There's Lulu on a little island! Let's bring back the lily pads." } },
        { art: "s06", ages: "big", key: "leap",
          line: "Pop, pop, pop! Big round lily pads float back in a line across the lake. Ready, set, leap!" },
        { art: "s07", ages: "both", key: "log",
          line: { big: "Hop, hop, hop! We made it, and Lulu gives us a big hug. Now let's all float home on a log!",
                  little: "We hop to Lulu, and she hugs us! Let's float home on a log." } },
        { art: "s08", ages: "both", key: "lift",
          line: { big: "Here comes a big round log! It floats us home, and the party can start. Let's lift the lanterns up to the sky!",
                  little: "The log floats us home. Let's lift the lanterns up to the sky!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "lake",
          line: { big: "Up, up, up! The lanterns float over the lake like little glowing moons.",
                  little: "Up, up! The lanterns float over the lake!" } },
        { art: "e02", ages: "big", key: "ladybug",
          line: "Hee hee! A tiny ladybug with a tiny lantern lands right on Lulu's nose. Hello, ladybug!" },
        { art: "e03", ages: "both", key: "lantern",
          line: { big: "Lulu gives us a little lantern of our very own. Thank you, friends!",
                  little: "Lulu gives us a little lantern. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "lovely",
          line: { big: "What a lovely night! A gold star for Lulu's lake on our helper map!",
                  little: "What a lovely night! A gold star for our helper map!" } }
      ]
    },

    fizz: {
      // F: Fizz and the Sleepy Fireflies. Fizz the little fox's forest party
      // is tonight, and the fireflies are too sleepy to glow: the child's words
      // wake them, light the fairy lights and start the fun.
      sound: "F",
      wash: "#3b5b4b",
      intro: [
        { art: "s01", ages: "both", key: "fork",
          line: "Pelly the pelican brought us a letter. Oops! That's a giant fork! Are you hungry, Pelly?" },
        { art: "s02", ages: "both", key: "fox",
          line: { big: "Here's the real letter. It's from Fizz the little fox. Come quick, she needs our help!",
                  little: "The real letter is from Fizz the fox. Come quick!" } },
        { art: "s03", ages: "big", key: "forest",
          line: "We hurry down the twisty path, deep into the forest, where Fizz is having a party." },
        { art: "s04", ages: "both", key: "feather",
          line: { big: "Fizz's party is tonight, but the fireflies are too sleepy to glow. Let's tickle them with a feather!",
                  little: "The fireflies are too sleepy for the party! Let's tickle them with a feather." } },
        { art: "s05", ages: "both", key: "fairy",
          line: { big: "Tickle, tickle! The fireflies giggle and glow! Now they can light up the fairy lights.",
                  little: "Tickle, tickle! They glow! Now let's light the fairy lights." } },
        { art: "s06", ages: "big", key: "fawn",
          line: "The fireflies zip along the fairy lights, and they twinkle on! A shy little fawn peeks out. Hi, fawn!" },
        { art: "s07", ages: "both", key: "fizzy",
          line: { big: "Fizz pours fizzy berry juice for everyone. The bubbles tickle the fawn's nose! Are we ready?",
                  little: "Fizz pours fizzy juice for everyone. Are we ready?" } },
        { art: "s08", ages: "both", key: "fireworks",
          line: { big: "Three, two, one... the fireflies swirl up into a big glowing ball. Let's make firefly fireworks!",
                  little: "Three, two, one... let's make firefly fireworks!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "feet",
          line: { big: "Whoosh! The fireflies burst into golden sparkles all over the sky. Let's dance on our happy feet!",
                  little: "Whoosh! Golden sparkles everywhere! Let's dance on our happy feet!" } },
        { art: "e02", ages: "big", key: "food",
          line: "We dance in a circle under the twinkly lights. Now it's time for the yummy party food!" },
        { art: "e03", ages: "both", key: "fan",
          line: { big: "Fizz gives us a pretty paper fan, dotted with gold like the fireflies. Thank you, friends!",
                  little: "Fizz gives us a pretty paper fan. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "fun",
          line: { big: "What fun! A gold star for Fizz's forest on our helper map!",
                  little: "What fun! A gold star for our helper map!" } }
      ]
    },

    sandy: {
      // S: Sandy's Sandcastle. Sandy the sea turtle's sandcastle keeps falling
      // down on the day of her beach party: the child's words build it, bring
      // the shells, bring the sunset and turn back a big bubbly wave.
      sound: "S",
      wash: "#3fa7b5",
      intro: [
        { art: "s01", ages: "both", key: "soup",
          line: "Pelly the pelican brought us a letter. Oops! That's a bowl of soup!" },
        { art: "s02", ages: "both", key: "sea",
          line: { big: "Here's the real letter. It's from Sandy the sea turtle. Come quick, she needs our help!",
                  little: "The real letter is from Sandy the sea turtle. Come quick!" } },
        { art: "s03", ages: "big", key: "sail",
          line: "We hop in a little boat. Up goes the sail, and off we go to Sandy's beach!" },
        { art: "s04", ages: "both", key: "sandcastle",
          line: { big: "Sandy's big beach party is today, but plop! Her sandcastle keeps falling down. Let's build up the sandcastle!",
                  little: "Plop! Sandy's sandcastle keeps falling down. Let's build up the sandcastle!" } },
        { art: "s05", ages: "both", key: "seven",
          line: { big: "Whoosh! Up goes the sandcastle, tall and round. Now it needs seven pretty shells!",
                  little: "Whoosh! Up it goes! Now it needs seven pretty shells." } },
        { art: "s06", ages: "big", key: "seal",
          line: "A little seal pops out of the waves with seven shells on her nose. Thank you, seal!" },
        { art: "s07", ages: "both", key: "sunset",
          line: { big: "Pat, pat, pat! On go the shells. Our sandcastle is ready. Now it's time for the sunset party!",
                  little: "Pat, pat! It's ready. Now it's time for the sunset party!" } },
        { art: "s08", ages: "both", key: "save",
          line: { big: "The sky turns pink and gold. Uh oh! A big, bubbly wave is rolling in. Let's save our sandcastle!",
                  little: "Uh oh! A big wave is rolling in. Let's save our sandcastle!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "sing",
          line: { big: "Swoosh! The wave turns around and rolls back to the sea. Our sandcastle is safe! Let's sing!",
                  little: "Swoosh! The wave rolls away. Our sandcastle is safe! Let's sing!" } },
        { art: "e02", ages: "big", key: "seahorse",
          line: "A little seahorse bobs up out of the waves to sing along with us. What a party!" },
        { art: "e03", ages: "both", key: "silver",
          line: { big: "Sandy gives us a shiny silver shell. We hold it close and hear the sea. Thank you, friends!",
                  little: "Sandy gives us a shiny silver shell. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "super",
          line: { big: "What a super day! A gold star for Sandy's beach on our helper map!",
                  little: "What a super day! A gold star for our helper map!" } }
      ]
    },

    zippy: {
      // Z: Zippy's Zoo Parade. Zippy the zebra's parade float is stuck: the
      // child's words zap it, bring the music and start the parade.
      sound: "Z",
      wash: "#62a87a",
      intro: [
        { art: "s01", ages: "both", key: "zucchini",
          line: "Pelly the pelican brought us a letter. Oops! That's a big green zucchini!" },
        { art: "s02", ages: "both", key: "zebra",
          line: { big: "Here's the real letter. It's from Zippy the zebra. Come quick, the zoo parade is stuck!",
                  little: "The real letter is from Zippy the zebra. Come quick!" } },
        { art: "s03", ages: "big", key: "zoo",
          line: "Off we go, down the twisty path to the zoo. There's the big striped gate!" },
        { art: "s04", ages: "both", key: "zap",
          line: { big: "Oh no! Zippy's parade float is stuck. Its lights are off, and it can't move. Let's give it a zap!",
                  little: "Oh no! Zippy's parade float is stuck. Let's give it a zap!" } },
        { art: "s05", ages: "both", key: "zookeeper",
          line: { big: "Zap! The lights glow, and Zippy's mane goes boing! A parade needs music. Let's call the zookeeper!",
                  little: "Zap! The lights glow! Now we need music. Let's call the zookeeper!" } },
        { art: "s06", ages: "big", key: "xylophone",
          line: "Here comes the zookeeper, a kind elephant, rolling a big, bright xylophone!" },
        { art: "s07", ages: "both", key: "zipper",
          line: { big: "Plink, plonk! The music plays. Zippy stands up tall in his parade jacket. Up goes the zipper!",
                  little: "The zookeeper plays music! Up goes Zippy's zipper!" } },
        { art: "s08", ages: "both", key: "zero",
          line: { big: "Everyone hops on the float, and the lights twinkle. Ready? Three, two, one... zero!",
                  little: "Everyone hops on! Three, two, one... zero!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "zoom",
          line: { big: "The float rolls out, the music plays, and the zoo parade begins! Let's zoom!",
                  little: "The parade begins! Let's zoom!" } },
        { art: "e02", ages: "big", key: "zigzag",
          line: "Whee! We zigzag past the monkey in the tree and the hippo in the pond. Hooray!" },
        { art: "e03", ages: "both", key: "zip",
          line: { big: "Zippy hugs us and gives us a little striped flag. Now it's time to zip home!",
                  little: "Zippy gives us a striped flag. Let's zip home!" } },
        { art: "e04", ages: "both", key: "zillion",
          line: { big: "A zillion cheers for Zippy! A gold star for Zippy's zoo on our helper map!",
                  little: "A zillion cheers! A gold star for our helper map!" } }
      ]
    }
  };
})(this);
