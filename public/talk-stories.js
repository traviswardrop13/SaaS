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
    },

    kiki: {
      // K: Kiki's Camping Night. The wind blew Kiki the kitten's tent down:
      // the child's words fix her camp, warm the cocoa and bring a comet.
      sound: "K",
      wash: "#7a6fb0",
      intro: [
        { art: "s01", ages: "both", key: "cake",
          line: "Pelly the pelican brought us a letter. Oops! That's a big birthday cake!" },
        { art: "s02", ages: "both", key: "kitten",
          line: { big: "Here's the real letter. It's from Kiki the kitten. Come camping with her tonight!",
                  little: "The real letter is from Kiki the kitten. Come camping!" } },
        { art: "s03", ages: "big", key: "canoe",
          line: "We paddle a little canoe across the lake to Kiki's camp in the woods." },
        { art: "s04", ages: "both", key: "camp",
          line: { big: "Kiki's camp is a mess! The wind blew her tent down. Let's fix up the camp!",
                  little: "The wind blew Kiki's tent down! Let's fix up the camp!" } },
        { art: "s05", ages: "both", key: "cord",
          line: { big: "We pull the cord nice and tight, and up pops the tent!",
                  little: "We pull the cord, and up pops the tent!" } },
        { art: "s06", ages: "big", key: "koala",
          line: "A sleepy koala peeks out of a tree and drops us a cozy blanket. Thank you, koala!" },
        { art: "s07", ages: "both", key: "cocoa",
          line: { big: "The sun goes down. Kiki pours warm cocoa for everyone. Yum!",
                  little: "Kiki pours warm cocoa. Yum!" } },
        { art: "s08", ages: "both", key: "count",
          line: { big: "The sky gets dark, and the stars come out. Let's count the stars!",
                  little: "The stars come out! Let's count the stars!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "comet",
          line: { big: "Whoosh! A bright comet zooms across the sky with a long, glowing tail.",
                  little: "Whoosh! A bright comet zooms by!" } },
        { art: "e02", ages: "big", key: "cookie",
          line: "We each eat a big cookie by the campfire and giggle at the owl's silly hoots." },
        { art: "e03", ages: "both", key: "cuddle",
          line: { big: "Kiki gives us a big cuddle and a tiny toy tent. Thank you, friends!",
                  little: "Kiki gives us a cuddle. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "kind",
          line: { big: "You were so kind! A gold star for Kiki's camp on our helper map!",
                  little: "You were so kind! A gold star for our helper map!" } }
      ]
    },

    gus: {
      // G: Gus's Goose Chase. Gus the goat's geese waddled away from the farm:
      // the child's words find them all, the last one on a golden egg.
      sound: "G",
      wash: "#6f9a4a",
      intro: [
        { art: "s01", ages: "both", key: "guitar",
          line: "Pelly the pelican brought us a letter. Oops! That's a little guitar!" },
        { art: "s02", ages: "both", key: "goat",
          line: { big: "Here's the real letter. It's from Gus the goat. Come quick, his geese got out!",
                  little: "The real letter is from Gus the goat. Come quick!" } },
        { art: "s03", ages: "big", key: "gate",
          line: "We run up the farm lane. Oh no, the wooden gate is wide open!" },
        { art: "s04", ages: "both", key: "goose",
          line: { big: "Gus has five geese, and they all waddled away! Let's find every goose.",
                  little: "Gus's geese waddled away! Let's find every goose." } },
        { art: "s05", ages: "both", key: "garden",
          line: { big: "Honk, honk! Two geese are in the garden, nibbling the lettuce.",
                  little: "Honk! Two geese are in the garden!" } },
        { art: "s06", ages: "big", key: "gopher",
          line: "A friendly gopher pops out of a hole and waves us to the pond. Thank you, gopher!" },
        { art: "s07", ages: "both", key: "giggle",
          line: { big: "Splash! Two more geese are swimming in the pond. They giggle and flap!",
                  little: "Two more geese are in the pond! They giggle and flap!" } },
        { art: "s08", ages: "both", key: "gallop",
          line: { big: "One more goose to find! Let's gallop up the hill to look.",
                  little: "One more! Let's gallop up the hill!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "golden",
          line: { big: "There she is, sitting on a golden egg! Every goose is home.",
                  little: "She's sitting on a golden egg! Every goose is home." } },
        { art: "e02", ages: "big", key: "games",
          line: "We play silly farm games with Gus and all five geese." },
        { art: "e03", ages: "both", key: "gift",
          line: { big: "Gus gives us a gift, a soft little feather. Thank you, friends!",
                  little: "Gus gives us a gift. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "goodbye",
          line: { big: "Goodbye, Gus! A gold star for Gus's farm on our helper map!",
                  little: "Goodbye, Gus! A gold star for our helper map!" } }
      ]
    },

    shelly: {
      // SH: Shelly's Shell Show. The waves washed Shelly the shark's shells
      // away before her show: the child's words dig, shake and find them all.
      sound: "SH",
      wash: "#2f8fa8",
      intro: [
        { art: "s01", ages: "both", key: "shoe",
          line: "Pelly the pelican brought us a letter. Oops! That's a fuzzy pink shoe!" },
        { art: "s02", ages: "both", key: "shark",
          line: { big: "Here's the real letter. It's from Shelly the shark. Come quick, she needs our help!",
                  little: "The real letter is from Shelly the shark. Come quick!" } },
        { art: "s03", ages: "big", key: "shore",
          line: "We walk along the sandy shore to Shelly's little blue cove." },
        { art: "s04", ages: "both", key: "shells",
          line: { big: "Shelly's shell show is today, but the waves washed her shells away! Let's find the shells.",
                  little: "The waves washed Shelly's shells away! Let's find the shells." } },
        { art: "s05", ages: "both", key: "shovel",
          line: { big: "We dig in the sand with a little shovel. Look, a pink shell!",
                  little: "We dig with a little shovel. A pink shell!" } },
        { art: "s06", ages: "big", key: "ship",
          line: "An old toy ship is stuck in the sand, and a stripy shell is hiding inside!" },
        { art: "s07", ages: "both", key: "shiny",
          line: { big: "Under a rock, a shiny shell sparkles in the water. Just one more to go!",
                  little: "A shiny shell sparkles in the water!" } },
        { art: "s08", ages: "both", key: "shake",
          line: { big: "Where is the last shell? Let's shake the seaweed and see!",
                  little: "Let's shake the seaweed and see!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "shine",
          line: { big: "Plop! Out falls the last shell. Every shell is back, and they shine in the sun!",
                  little: "Every shell is back, and they shine!" } },
        { art: "e02", ages: "big", key: "show",
          line: "The shell show begins, and all the little fish swim close to look." },
        { art: "e03", ages: "both", key: "share",
          line: { big: "Shelly lets us share her very best shell. Thank you, friends!",
                  little: "Shelly lets us share her best shell. Thank you!" } },
        { art: "e04", ages: "both", key: "shout",
          line: { big: "Let's shout hooray! A gold star for Shelly's cove on our helper map!",
                  little: "Let's shout hooray! A gold star for our helper map!" } }
      ]
    },

    chip: {
      // CH: Chip's Cherry Pie. A bird flew off with Chip the chipmunk's
      // cherries: the child's words chase it, bake the pie and start the picnic.
      sound: "CH",
      wash: "#a8543f",
      intro: [
        { art: "s01", ages: "both", key: "chair",
          line: "Pelly the pelican brought us a letter. Oops! That's a tiny wooden chair!" },
        { art: "s02", ages: "both", key: "chipmunk",
          line: { big: "Here's the real letter. It's from Chip the chipmunk. Come to his picnic!",
                  little: "The real letter is from Chip the chipmunk. Come to his picnic!" } },
        { art: "s03", ages: "big", key: "chimney",
          line: "We follow the puffs of smoke from Chip's chimney through the woods." },
        { art: "s04", ages: "both", key: "cherries",
          line: { big: "Chip wants to bake a cherry pie for the picnic, but his cherries are gone! Let's find the cherries.",
                  little: "Chip's cherries are gone! Let's find the cherries." } },
        { art: "s05", ages: "both", key: "chase",
          line: { big: "A cheeky bird flew off with them! Let's chase the bird to the big tree.",
                  little: "A bird took them! Let's chase the bird!" } },
        { art: "s06", ages: "big", key: "chick",
          line: "Up in the nest, a little chick hands down the basket of cherries. Thank you, chick!" },
        { art: "s07", ages: "both", key: "chop",
          line: { big: "Back at home, we chop and stir and pop the pie in the oven.",
                  little: "We chop and stir and bake the pie!" } },
        { art: "s08", ages: "both", key: "chocolate",
          line: { big: "The pie smells so good. Chip adds a drizzle of chocolate on top!",
                  little: "Chip adds chocolate on top. Yum!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "cheer",
          line: { big: "Ding! The pie is ready, and everyone at the picnic gives a big cheer!",
                  little: "Ding! The pie is ready! Let's cheer!" } },
        { art: "e02", ages: "big", key: "chew",
          line: "We chew and munch on warm, sweet cherry pie. The little chick has some too." },
        { art: "e03", ages: "both", key: "chalk",
          line: { big: "Chip draws a big thank you heart in chalk, just for us!",
                  little: "Chip draws us a heart in chalk!" } },
        { art: "e04", ages: "both", key: "champion",
          line: { big: "You're a pie champion! A gold star for Chip's woods on our helper map!",
                  little: "You're a pie champion! A gold star for our helper map!" } }
      ]
    },

    theo: {
      // TH: Theo's Big Show. Theo the bear's thunder drum is lost before his
      // show at the forest theater: the child's words find it and start the show.
      sound: "TH",
      wash: "#4b4f8f",
      intro: [
        { art: "s01", ages: "both", key: "thimble",
          line: "Pelly the pelican brought us a letter. Oops! That's a tiny thimble!" },
        { art: "s02", ages: "both", key: "theater",
          line: { big: "Here's the real letter. It's from Theo the bear. Come to his show at the forest theater!",
                  little: "The real letter is from Theo the bear. Come to his show at the theater!" } },
        { art: "s03", ages: "big", key: "thick",
          line: "We tiptoe through the thick green woods to the little stage under the trees." },
        { art: "s04", ages: "both", key: "thunder",
          line: { big: "Theo plays the thunder drum in the show, but his drum is lost! Let's find the thunder drum.",
                  little: "Theo's thunder drum is lost! Let's find the thunder drum." } },
        { art: "s05", ages: "both", key: "think",
          line: { big: "Hmm, let's think. Where did Theo play it last? Behind the stage!",
                  little: "Hmm, let's think. Where can it be?" } },
        { art: "s06", ages: "big", key: "thistle",
          line: "We peek behind a purple thistle. No drum, just a sleepy snail." },
        { art: "s07", ages: "both", key: "thump",
          line: { big: "Thump, thump! We hear a noise behind the big bush. What is that?",
                  little: "Thump, thump! What is that?" } },
        { art: "s08", ages: "both", key: "thin",
          line: { big: "It's the drum! A little squirrel is tapping it with a thin stick.",
                  little: "It's the drum! A squirrel taps it with a thin stick." } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "thousand",
          line: { big: "The show begins, and a thousand fireflies light up the stage.",
                  little: "A thousand fireflies light up the show!" } },
        { art: "e02", ages: "big", key: "thud",
          line: "Theo plays the drum. Thud, boom, thud! Everyone dances along." },
        { art: "e03", ages: "both", key: "thank",
          line: { big: "Theo gives us a big bear hug. Thank you, friends!",
                  little: "Theo gives us a hug. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "thumbs",
          line: { big: "Two thumbs up! A gold star for Theo's theater on our helper map!",
                  little: "Two thumbs up! A gold star for our helper map!" } }
      ]
    },
    // TALKMORE1 (25 Nov 2026): the later talking stories, after the 14 days
    // (sona.js STORY_TALK_MORE says when). The same shape and rules as Day 1's
    // above; each is offered only once its pictures are drawn and Rachel has
    // read it ("ready" in sona.js). Every word is Rachel's to change.

    // R: Rosie's Raft. Rosie the raccoon's raft drifted onto a rock in the pond with her picnic on it: the child's words throw the rope, free the raft and row it home.
    rosie: {
      sound: "R",
      wash: "#2f6b66",
      intro: [
        { art: "s01", ages: "both", key: "rake",
          line: "Pelly the pelican brought us a letter. Oops! That's a garden rake!" },
        { art: "s02", ages: "both", key: "raccoon",
          line: { big: "Here's the real letter. It's from Rosie the raccoon. Her raft is stuck, and she needs our help!",
                  little: "The real letter is from Rosie the raccoon. Her raft is stuck!" } },
        { art: "s03", ages: "big", key: "road",
          line: "We hurry down the dusty road to the pond, past the tall green reeds." },
        { art: "s04", ages: "both", key: "raft",
          line: { big: "There's the raft, stuck on a big rock in the middle of the pond. Rosie's picnic is on it!",
                  little: "Rosie's raft is stuck on a big rock. Her picnic is on it!" } },
        { art: "s05", ages: "both", key: "rope",
          line: { big: "Rosie has a long rope. Let's toss the rope to the raft and pull!",
                  little: "Let's toss a rope to the raft and pull!" } },
        { art: "s06", ages: "big", key: "rock",
          line: "Heave, ho! The raft wiggles, but it's still stuck on the rock. A little frog hops on to help." },
        { art: "s07", ages: "both", key: "row",
          line: { big: "Pop! The raft floats free! Rosie grabs her paddle. Let's help her row to the shore.",
                  little: "The raft floats free! Let's help Rosie row to the shore." } },
        { art: "s08", ages: "both", key: "ready",
          line: { big: "Rosie spreads her picnic blanket on the grass. Berries, buns and lemonade. Are we ready to eat?",
                  little: "Rosie spreads out her picnic. Are we ready to eat?" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "raisin",
          line: { big: "Rosie shares her raisin buns with everyone, even the little frog. Yum!",
                  little: "Rosie shares her raisin buns. Yum!" } },
        { art: "e02", ages: "big", key: "rainbow",
          line: "After lunch, a little shower falls, and a rainbow shines over the pond." },
        { art: "e03", ages: "both", key: "rest",
          line: { big: "Rosie, the frog and Echo lie back on the soft grass to rest and watch the clouds.",
                  little: "We lie on the soft grass to rest. Ahh!" } },
        { art: "e04", ages: "both", key: "rescue",
          line: { big: "What a rescue! A gold star for Rosie's pond on our helper map!",
                  little: "What a rescue! A gold star for our helper map!" } }
      ]
    },

    // R: Ruby's Nest. The wind blew Ruby the robin's nest out of her tree: the child's words reach it, fix it with a ribbon and wool, and lift it back up.
    ruby: {
      sound: "R",
      wash: "#3f6a3a",
      intro: [
        { art: "s01", ages: "both", key: "rug",
          line: "Pelly the pelican brought us a letter. Oops! That's a fuzzy red rug!" },
        { art: "s02", ages: "both", key: "robin",
          line: { big: "Here's the real letter. It's from Ruby the robin. The wind blew her nest out of her tree!",
                  little: "The real letter is from Ruby the robin. Her nest blew away!" } },
        { art: "s03", ages: "big", key: "run",
          line: "We run across the windy meadow to the big old oak tree where Ruby lives." },
        { art: "s04", ages: "both", key: "roof",
          line: { big: "Ruby's nest landed upside down on the roof of the garden shed. Oh no, it's all bent!",
                  little: "Ruby's nest landed on the roof of the shed. Oh no!" } },
        { art: "s05", ages: "both", key: "reach",
          line: { big: "Echo climbs the ladder, but the nest is too high. Let's reach a little higher!",
                  little: "The nest is too high. Let's reach up high!" } },
        { art: "s06", ages: "big", key: "ribbon",
          line: "Ruby needs soft things to fix her nest. Look, a long blue ribbon on the fence!" },
        { art: "s07", ages: "both", key: "roll",
          line: { big: "Here's a ball of soft wool too. Let's roll it over to Ruby!",
                  little: "Here's soft wool. Let's roll it to Ruby!" } },
        { art: "s08", ages: "both", key: "round",
          line: { big: "Ruby tucks in the ribbon and the wool and shapes her nest nice and round.",
                  little: "Ruby makes her nest nice and round." } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "rise",
          line: { big: "Echo lifts the nest in a basket, up, up, back into the tree. Watch it rise!",
                  little: "Up, up! Watch the nest rise into the tree!" } },
        { art: "e02", ages: "big", key: "rocking",
          line: "The branch sways in the breeze, gently rocking the nest like a little cradle." },
        { art: "e03", ages: "both", key: "relax",
          line: { big: "Ruby sits on her three blue eggs, safe and warm. Now she can relax!",
                  little: "Ruby sits on her eggs. Now she can relax!" } },
        { art: "e04", ages: "both", key: "really",
          line: { big: "Ruby sings a really happy song. A gold star for Ruby's tree on our helper map!",
                  little: "Ruby sings a really happy song. A gold star for our helper map!" } }
      ]
    },

    // R: Rex's Radio Show. Rex the rhino's jungle radio won't play before his morning show: the child's words push the button, find the rod and start the show.
    rex: {
      sound: "R",
      wash: "#5a3d7a",
      intro: [
        { art: "s01", ages: "both", key: "rattle",
          line: "Pelly the pelican brought us a letter. Oops! That's a baby's rattle!" },
        { art: "s02", ages: "both", key: "rhino",
          line: { big: "Here's the real letter. It's from Rex the rhino. His radio show starts soon, and his radio won't play!",
                  little: "The real letter is from Rex the rhino. His radio won't play!" } },
        { art: "s03", ages: "big", key: "rush",
          line: "We rush through the jungle to the little radio hut by the waterfall." },
        { art: "s04", ages: "both", key: "radio",
          line: { big: "Rex's big radio is quiet. No music, no songs, not one beep. Let's wake up the radio!",
                  little: "Rex's radio is quiet. Let's wake up the radio!" } },
        { art: "s05", ages: "both", key: "red",
          line: { big: "Look! There's a big red button on the back. Let's push the red button!",
                  little: "There's a big red button. Let's push it!" } },
        { art: "s06", ages: "big", key: "rod",
          line: "Crackle, crackle! The radio needs its tall silver rod to catch the music. There it is, by the door!" },
        { art: "s07", ages: "both", key: "ring",
          line: { big: "Ring, ring! The radio lights up, and a happy tune begins to play. It works!",
                  little: "Ring, ring! The radio plays a happy tune!" } },
        { art: "s08", ages: "both", key: "rhyme",
          line: { big: "Rex leans in to the microphone. Good morning, jungle! Let's start with a silly rhyme.",
                  little: "Good morning, jungle! Let's start with a rhyme." } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "rhythm",
          line: { big: "The monkeys drum on the logs to keep the rhythm, and the parrots start to dance.",
                  little: "The monkeys drum a happy rhythm!" } },
        { art: "e02", ages: "big", key: "ripe",
          line: "Rex reads the jungle news. The bananas are ripe, and the hippos are going for a swim!" },
        { art: "e03", ages: "both", key: "room",
          line: { big: "The whole jungle dances in the little hut. There's room for everyone, big and small!",
                  little: "Everyone dances. There's room for all!" } },
        { art: "e04", ages: "both", key: "right",
          line: { big: "Rex's show was just right! A gold star for the radio hut on our helper map!",
                  little: "Just right! A gold star for our helper map!" } }
      ]
    },

    // R: Remi's Red Sleigh. Snow buried Remi the reindeer's red sleigh before the winter ride: the child's words dig it out, find the reins and fly over the village.
    remi: {
      sound: "R",
      wash: "#2e4a78",
      intro: [
        { art: "s01", ages: "both", key: "radish",
          line: "Pelly the pelican brought us a letter. Oops! That's a little pink radish!" },
        { art: "s02", ages: "both", key: "ride",
          line: { big: "Here's the real letter. It's from Remi the reindeer. Can we help her get ready for the winter ride?",
                  little: "The real letter is from Remi. Come help with the winter ride!" } },
        { art: "s03", ages: "big", key: "road",
          line: "We bundle up and march down the snowy road to Remi's barn on the hill." },
        { art: "s04", ages: "both", key: "red",
          line: { big: "Oh no! Snow covered Remi's sleigh. Only a bit of red pokes out. Let's dig out the red sleigh!",
                  little: "Snow covered Remi's red sleigh. Let's dig it out!" } },
        { art: "s05", ages: "both", key: "reins",
          line: { big: "Dig, dig, dig! There's the sleigh. Now Remi needs her reins. Let's find the reins!",
                  little: "Here's the sleigh! Now let's find the reins." } },
        { art: "s06", ages: "big", key: "rope",
          line: "The reins are tangled up in an old rope by the fence. Echo wiggles them free." },
        { art: "s07", ages: "both", key: "ribbon",
          line: { big: "Let's make the sleigh pretty. Tie a big ribbon on the front!",
                  little: "Let's tie a ribbon on the sleigh!" } },
        { art: "s08", ages: "both", key: "ready",
          line: { big: "Remi wears her jingle bells, and Echo climbs into the sleigh. Are we ready to go?",
                  little: "Echo climbs in. Are we ready to go?" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "race",
          line: { big: "Whoosh! Up we race into the starry night sky, over the snowy hills.",
                  little: "Whoosh! Up we race into the night sky!" } },
        { art: "e02", ages: "big", key: "roof",
          line: "We glide over the village, past every snowy roof and every twinkly window." },
        { art: "e03", ages: "both", key: "rainbow",
          line: { big: "Below us, the winter lights glow like a rainbow in the snow.",
                  little: "The winter lights glow like a rainbow!" } },
        { art: "e04", ages: "both", key: "rosy",
          line: { big: "We land with rosy cheeks. A gold star for Remi's barn on our helper map!",
                  little: "We land with rosy cheeks. A gold star for our helper map!" } }
      ]
    },

    // R: Rina's Rainbow Reef. A storm covered the reef where Rina the ray lives in gray sand: the child's words rub it off until the colors and the fish come back.
    rina: {
      sound: "R",
      wash: "#1f5c7a",
      intro: [
        { art: "s01", ages: "both", key: "rowboat",
          line: "Pelly the pelican brought us a letter. Oops! That's a tiny toy rowboat!" },
        { art: "s02", ages: "both", key: "ray",
          line: { big: "Here's the real letter. It's from Rina the ray. A storm covered her reef in sand!",
                  little: "The real letter is from Rina the ray. Her reef is covered in sand!" } },
        { art: "s03", ages: "big", key: "ride",
          line: "We ride on a friendly sea turtle, down, down under the waves to Rina's home." },
        { art: "s04", ages: "both", key: "reef",
          line: { big: "The reef is all gray. Every bright color is hiding under the sand. Let's save the reef!",
                  little: "The reef is all gray. Let's save the reef!" } },
        { art: "s05", ages: "both", key: "rub",
          line: { big: "Rina flaps her wide fins to blow the sand. Let's rub the sand off the rocks!",
                  little: "Let's rub the sand off the rocks!" } },
        { art: "s06", ages: "big", key: "red",
          line: "Look! Under the sand there's red coral, waving like tiny fingers." },
        { art: "s07", ages: "both", key: "round",
          line: { big: "Round, bright corals pop out everywhere, yellow and purple and pink. The reef is waking up!",
                  little: "Round, bright corals pop out! The reef wakes up!" } },
        { art: "s08", ages: "both", key: "rush",
          line: { big: "Here come the fish! They rush back home to play in the bright reef.",
                  little: "The fish rush back home!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "rainbow",
          line: { big: "Now the whole reef shines like a rainbow under the sea.",
                  little: "The reef shines like a rainbow!" } },
        { art: "e02", ages: "big", key: "ribbon",
          line: "A long ribbon of little silver fish swirls around Rina, tickling her fins." },
        { art: "e03", ages: "both", key: "race",
          line: { big: "Rina gives everyone a ride on her back. Then the fish race us around the reef!",
                  little: "The fish race us around the reef!" } },
        { art: "e04", ages: "both", key: "really",
          line: { big: "That was really fun! A gold star for Rina's reef on our helper map!",
                  little: "That was really fun! A gold star for our helper map!" } }
      ]
    },

    // R: Ravi's Rain Cloud. Ravi the raven's garden is dry because his little rain cloud is caught on a mountain tree: the child's words free it and roll it home to rain.
    ravi: {
      sound: "R",
      wash: "#7a5a2e",
      intro: [
        { art: "s01", ages: "both", key: "rose",
          line: "Pelly the pelican brought us a letter. Oops! That's a pink rose!" },
        { art: "s02", ages: "both", key: "raven",
          line: { big: "Here's the real letter. It's from Ravi the raven. His garden is dry, because his rain cloud is stuck!",
                  little: "The real letter is from Ravi the raven. His garden is dry!" } },
        { art: "s03", ages: "big", key: "rocky",
          line: "We climb up the rocky path to the very top of the mountain." },
        { art: "s04", ages: "both", key: "rain",
          line: { big: "There's Ravi's little cloud, caught on a pointy tree. It can't rain on his garden!",
                  little: "The cloud is stuck on a tree. It can't rain!" } },
        { art: "s05", ages: "both", key: "rope",
          line: { big: "Let's swing a long rope around the cloud and give it a gentle tug!",
                  little: "Let's swing a rope around the cloud!" } },
        { art: "s06", ages: "big", key: "rumble",
          line: "The cloud gives a happy rumble. It's free, and it bounces like a balloon!" },
        { art: "s07", ages: "both", key: "roll",
          line: { big: "Let's roll the fluffy cloud down the hill to Ravi's garden. Push!",
                  little: "Let's roll the cloud down to the garden!" } },
        { art: "s08", ages: "both", key: "rainy",
          line: { big: "Plip, plop! The little cloud makes a rainy day over the garden.",
                  little: "Plip, plop! It's a rainy day!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "root",
          line: { big: "Deep in the ground, every thirsty root drinks up the water.",
                  little: "Every root drinks up the water!" } },
        { art: "e02", ages: "big", key: "radishes",
          line: "Little green sprouts pop up everywhere. Peas, beans and red radishes!" },
        { art: "e03", ages: "both", key: "ripe",
          line: { big: "Ravi picks a ripe, juicy tomato and shares it with everyone.",
                  little: "Ravi shares a ripe tomato!" } },
        { art: "e04", ages: "both", key: "ready",
          line: { big: "Ravi's garden is ready to grow. A gold star for Ravi's garden on our helper map!",
                  little: "The garden is ready to grow. A gold star for our helper map!" } }
      ]
    },

    // S: Sami's Soccer Game. Sami the seal's soccer ball rolled away before the big game: the child's words follow its tracks to a silly puppy, and the game begins.
    sami: {
      sound: "S",
      wash: "#2e6a3e",
      intro: [
        { art: "s01", ages: "both", key: "sandwich",
          line: "Pelly the pelican brought us a letter. Oops! That's a cheese sandwich!" },
        { art: "s02", ages: "both", key: "seal",
          line: { big: "Here's the real letter. It's from Sami the seal. Her soccer ball rolled away before the big game!",
                  little: "The real letter is from Sami the seal. Her ball rolled away!" } },
        { art: "s03", ages: "big", key: "sunny",
          line: "We hurry across the sunny park to the soccer field by the beach." },
        { art: "s04", ages: "both", key: "soccer",
          line: { big: "The game starts soon, and there's no ball. Let's look for the soccer ball!",
                  little: "There's no soccer ball! Let's look for it." } },
        { art: "s05", ages: "both", key: "sand",
          line: { big: "Look, little round tracks in the sand. The ball went this way!",
                  little: "Little tracks in the sand! This way!" } },
        { art: "s06", ages: "big", key: "sandbox",
          line: "The tracks go around the sandbox and into a big bush. Shh, what's in there?" },
        { art: "s07", ages: "both", key: "silly",
          line: { big: "Inside the bush is a silly puppy, wagging her tail, with the ball in her mouth!",
                  little: "A silly puppy has the ball!" } },
        { art: "s08", ages: "both", key: "sit",
          line: { big: "Let's all sit down and wait. Drop it, puppy! She drops the ball at Sami's flippers.",
                  little: "Let's all sit and wait. Drop it, puppy!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "super",
          line: { big: "The game begins! Sami kicks the ball with her flipper. What a super kick!",
                  little: "Sami kicks the ball. What a super kick!" } },
        { art: "e02", ages: "big", key: "six",
          line: "The puppy joins the team, and they pass the ball six times in a row." },
        { art: "e03", ages: "both", key: "soar",
          line: { big: "Watch the ball soar over the field and into the net. Goal!",
                  little: "Watch the ball soar into the net. Goal!" } },
        { art: "e04", ages: "both", key: "sunset",
          line: { big: "We play until sunset. A gold star for the soccer field on our helper map!",
                  little: "We play until sunset. A gold star for our helper map!" } }
      ]
    },

    // S: Cecil's Circus Socks. Cecil the centipede lost all his socks before the circus show: the child's words find them all over the big top, and the show begins.
    cecil: {
      sound: "S",
      wash: "#8a2f3e",
      intro: [
        { art: "s01", ages: "both", key: "sock",
          line: "Pelly the pelican brought us a letter. Oops! That's a stripy sock!" },
        { art: "s02", ages: "both", key: "centipede",
          line: { big: "Here's the real letter. It's from Cecil the centipede. He lost his socks before the circus show!",
                  little: "The real letter is from Cecil the centipede. He lost his socks!" } },
        { art: "s03", ages: "big", key: "circus",
          line: "We hurry to the big circus tent. Inside, everyone is getting ready for the show." },
        { art: "s04", ages: "both", key: "socks",
          line: { big: "Cecil has lots of feet, and every foot needs a sock. But his socks are gone! Let's find the socks.",
                  little: "Cecil has lots of feet. Let's find his socks!" } },
        { art: "s05", ages: "both", key: "seven",
          line: { big: "Look! Seven socks are hanging on the tightrope. Let's grab the seven socks!",
                  little: "Seven socks are on the rope! Let's grab them." } },
        { art: "s06", ages: "big", key: "saddle",
          line: "More socks are tucked under the pony's saddle. The pony giggles." },
        { art: "s07", ages: "both", key: "sofa",
          line: { big: "And the rest of the socks are under the clown's comfy sofa. Peekaboo!",
                  little: "More socks under the sofa. Peekaboo!" } },
        { art: "s08", ages: "both", key: "set",
          line: { big: "Cecil pulls on every sock, one by one, all down his long body. All set!",
                  little: "Cecil pulls on his socks. All set!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "sing",
          line: { big: "The show begins! The band plays, and the whole crowd starts to sing.",
                  little: "The show begins, and everyone starts to sing!" } },
        { art: "e02", ages: "big", key: "silly",
          line: "Cecil does a silly dance. Tap, tap, tap go all his little feet!" },
        { art: "e03", ages: "both", key: "circle",
          line: { big: "Then he spins in a big circle, and his socks look like a whirl of colors.",
                  little: "He spins in a big circle!" } },
        { art: "e04", ages: "both", key: "surprise",
          line: { big: "What a surprise! A gold star for the circus tent on our helper map!",
                  little: "What a surprise! A gold star for our helper map!" } }
      ]
    },

    // S: Suki's Super Soup. Suki the sea otter makes soup for Little Bear, who has a cold: the child's words add each thing to the pot and carry it over.
    suki: {
      sound: "S",
      wash: "#7a4a2a",
      intro: [
        { art: "s01", ages: "both", key: "soap",
          line: "Pelly the pelican brought us a letter. Oops! That's a bar of soap!" },
        { art: "s02", ages: "both", key: "soup",
          line: { big: "Here's the real letter. It's from Suki the sea otter. Her friend has a cold, and she's making soup!",
                  little: "The real letter is from Suki the sea otter. She's making soup!" } },
        { art: "s03", ages: "big", key: "seaside",
          line: "We walk along the seaside to Suki's cozy little kitchen on the dock." },
        { art: "s04", ages: "both", key: "celery",
          line: { big: "Suki's big pot is empty. Let's start with some crunchy celery!",
                  little: "The pot is empty. Let's add some celery!" } },
        { art: "s05", ages: "both", key: "salt",
          line: { big: "Now let's add just a little pinch of salt. Not too much!",
                  little: "Let's add a pinch of salt!" } },
        { art: "s06", ages: "big", key: "sizzle",
          line: "Onions go in the hot pan. Listen to them sizzle!" },
        { art: "s07", ages: "both", key: "sip",
          line: { big: "Suki stirs the pot and takes a tiny sip. Hmm, it needs one more thing!",
                  little: "Suki takes a tiny sip. Hmm!" } },
        { art: "s08", ages: "both", key: "secret",
          line: { big: "Suki adds her secret thing, a spoonful of honey. Now it's super soup!",
                  little: "Suki adds her secret honey. Yum!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "soon",
          line: { big: "We carry the warm soup to Little Bear in bed. Here you go. Feel better soon!",
                  little: "Here's your soup, Little Bear. Feel better soon!" } },
        { art: "e02", ages: "big", key: "sigh",
          line: "Little Bear takes a big spoonful and lets out a happy sigh." },
        { art: "e03", ages: "both", key: "suddenly",
          line: { big: "Suddenly Little Bear sits up in bed, feeling much better!",
                  little: "Suddenly Little Bear feels much better!" } },
        { art: "e04", ages: "both", key: "sea",
          line: { big: "We all share the soup by the sea. A gold star for Suki's kitchen on our helper map!",
                  little: "We share soup by the sea. A gold star for our helper map!" } }
      ]
    },

    // S: Sadie's Sailboat. The wind blew the sail off Sadie the salamander's little boat before the pond race: the child's words bring it down, sew it and sail.
    sadie: {
      sound: "S",
      wash: "#2a5f7a",
      intro: [
        { art: "s01", ages: "both", key: "sunglasses",
          line: "Pelly the pelican brought us a letter. Oops! That's a pair of sunglasses!" },
        { art: "s02", ages: "both", key: "salamander",
          line: { big: "Here's the real letter. It's from Sadie the salamander. Her sail blew away before the boat race!",
                  little: "The real letter is from Sadie the salamander. Her sail blew away!" } },
        { art: "s03", ages: "big", key: "sun",
          line: "We run down to the pond in the warm sun. Little boats bob on the water." },
        { art: "s04", ages: "both", key: "sail",
          line: { big: "Sadie's little boat has no sail, and the race starts soon! Let's find the sail.",
                  little: "Sadie's boat has no sail. Let's find the sail!" } },
        { art: "s05", ages: "both", key: "safe",
          line: { big: "There it is, stuck up in a tree! Echo climbs up, nice and safe, and grabs it.",
                  little: "Echo climbs up, nice and safe, and grabs it!" } },
        { art: "s06", ages: "big", key: "sew",
          line: "Oh no, the sail has a hole! A kind duck helps us sew it up." },
        { art: "s07", ages: "both", key: "sailboat",
          line: { big: "Let's tie the sail back on the sailboat, nice and tight!",
                  little: "Let's tie the sail back on the sailboat!" } },
        { art: "s08", ages: "both", key: "seat",
          line: { big: "Sadie hops into her seat, and Echo sits behind her. Ready, set, go!",
                  little: "Sadie hops into her seat. Go!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "sailing",
          line: { big: "Whoosh! The wind fills the sail, and we go sailing across the pond.",
                  little: "Whoosh! We go sailing across the pond!" } },
        { art: "e02", ages: "big", key: "silver",
          line: "We zip past a silver fish and a family of ducks." },
        { art: "e03", ages: "both", key: "circle",
          line: { big: "Everyone sits in a circle by the pond to cheer for every little boat.",
                  little: "We sit in a circle and cheer!" } },
        { art: "e04", ages: "both", key: "summer",
          line: { big: "What a summer day! A gold star for Sadie's pond on our helper map!",
                  little: "What a summer day! A gold star for our helper map!" } }
      ]
    },

    // S: Sasha's Sunflowers. Sasha the squirrel's sunflower seed won't grow: the child's words dig the soil, give it a sip, sing to it, and it grows into a giant flower.
    sasha: {
      sound: "S",
      wash: "#7a6a1f",
      intro: [
        { art: "s01", ages: "both", key: "sack",
          line: "Pelly the pelican brought us a letter. Oops! That's a sack of potatoes!" },
        { art: "s02", ages: "both", key: "sunflower",
          line: { big: "Here's the real letter. It's from Sasha the squirrel. She planted a sunflower seed, but nothing grows!",
                  little: "The real letter is from Sasha the squirrel. Her sunflower won't grow!" } },
        { art: "s03", ages: "big", key: "city",
          line: "We ride the bus out of the busy city to Sasha's little garden." },
        { art: "s04", ages: "both", key: "soil",
          line: { big: "The soil is dry and hard, and the seed is fast asleep. Let's dig the soil!",
                  little: "The soil is dry. Let's dig the soil!" } },
        { art: "s05", ages: "both", key: "sip",
          line: { big: "Let's give the seed a sip of water from the watering can.",
                  little: "Let's give the seed a sip of water!" } },
        { art: "s06", ages: "big", key: "sun",
          line: "The clouds float away, and the warm sun shines down on the garden." },
        { art: "s07", ages: "both", key: "sing",
          line: { big: "Sasha thinks plants like music. Let's sing a song to the seed!",
                  little: "Let's sing a song to the seed!" } },
        { art: "s08", ages: "both", key: "seed",
          line: { big: "Pop! A tiny green shoot peeks out of the seed!",
                  little: "Pop! A green shoot peeks out of the seed!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "sunny",
          line: { big: "Day by day, it grows taller and taller toward the sunny sky.",
                  little: "It grows tall in the sunny sky!" } },
        { art: "e02", ages: "big", key: "seven",
          line: "Now it's taller than Echo, taller than Sasha, taller than seven squirrels!" },
        { art: "e03", ages: "both", key: "sunshine",
          line: { big: "The big yellow flower opens, as bright as sunshine!",
                  little: "The flower opens, as bright as sunshine!" } },
        { art: "e04", ages: "both", key: "seeds",
          line: { big: "Sasha has lots of seeds to share. A gold star for Sasha's garden on our helper map!",
                  little: "Sasha has seeds to share. A gold star for our helper map!" } }
      ]
    },

    // S: Simon's Seesaw. A seat fell off Simon the sloth's playground seesaw: the child's words find it in the sand, fix it, and everyone plays.
    simon: {
      sound: "S",
      wash: "#3a6a6a",
      intro: [
        { art: "s01", ages: "both", key: "sun",
          line: "Pelly the pelican brought us a letter. Oops! That's a big floppy sun hat!" },
        { art: "s02", ages: "both", key: "seesaw",
          line: { big: "Here's the real letter. It's from Simon the sloth. The playground seesaw is broken!",
                  little: "The real letter is from Simon the sloth. His seesaw is broken!" } },
        { art: "s03", ages: "big", key: "sidewalk",
          line: "We hurry down the sidewalk to the playground in the park." },
        { art: "s04", ages: "both", key: "seat",
          line: { big: "One seat fell off the seesaw, and nobody can play. Let's find the seat!",
                  little: "The seesaw seat fell off. Let's find the seat!" } },
        { art: "s05", ages: "both", key: "sand",
          line: { big: "There it is, half buried in the sand. Let's dig it out!",
                  little: "It's in the sand! Let's dig it out!" } },
        { art: "s06", ages: "big", key: "saw",
          line: "Echo brings his toy saw and a box of shiny bolts to fix the seesaw." },
        { art: "s07", ages: "both", key: "safe",
          line: { big: "Twist, twist! The seat is back on, nice and safe.",
                  little: "Twist! The seat is back on, nice and safe." } },
        { art: "s08", ages: "both", key: "sit",
          line: { big: "Simon climbs on one end, and Echo climbs on the other. Let's sit and bounce!",
                  little: "Let's sit and bounce!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "super",
          line: { big: "Up and down, up and down! Simon thinks this is super fun.",
                  little: "Up and down! This is super fun!" } },
        { art: "e02", ages: "big", key: "sister",
          line: "Simon's little sister wants a turn too, so everyone takes turns." },
        { art: "e03", ages: "both", key: "silly",
          line: { big: "The whole playground joins in with silly giggles. Wheee!",
                  little: "Everyone giggles. How silly! Wheee!" } },
        { art: "e04", ages: "both", key: "supper",
          line: { big: "We play until it's time for supper. A gold star for the playground on our helper map!",
                  little: "We play until supper. A gold star for our helper map!" } }
      ]
    },
    // TALKMORE1, the other sounds (25 Nov 2026): one later story each for L, Z,
    // F, K, G, SH, CH and TH, off until drawn and read, as the R and S ones.

    // L: Lola the llama's lemons rolled away before her lemonade stand opens, so the child helps find them on the lawn, in a tree and under a sleepy lizard, and everyone shares lemonade.
    lola: {
      sound: "L",
      wash: "#6e5a1c",
      intro: [
        { art: "s01", ages: "both", key: "lollipop",
          line: "Pelly the pelican brought us a letter. Oops! That's a giant lollipop!" },
        { art: "s02", ages: "both", key: "llama",
          line: { big: "Here's the real letter. It's from Lola the llama. Her lemons rolled away before her lemonade stand opens!",
                  little: "The real letter is from Lola the llama. Her lemons rolled away!" } },
        { art: "s03", ages: "big", key: "lane",
          line: "We hurry down the leafy lane to the little park at the top of the hill." },
        { art: "s04", ages: "both", key: "lemons",
          line: { big: "Here is Lola's lemonade stand, but her basket is empty. Where did all the lemons go?",
                  little: "Lola's basket is empty. Where did the lemons go?" } },
        { art: "s05", ages: "both", key: "lawn",
          line: { big: "Look, yellow lemons on the lawn! They rolled all the way down the hill.",
                  little: "Lemons on the lawn! This way!" } },
        { art: "s06", ages: "big", key: "ladder",
          line: "Some lemons bounced up into a tall tree. Up the ladder we go, one step at a time!" },
        { art: "s07", ages: "both", key: "lizard",
          line: { big: "The last lemons rolled into a hollow log. A little lizard is using one as a pillow!",
                  little: "A little lizard is napping on a lemon!" } },
        { art: "s08", ages: "both", key: "lemonade",
          line: { big: "The lizard gives it back with a yawn. Squeeze and stir, and Lola makes her lemonade!",
                  little: "Squeeze and stir. Lola makes lemonade!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "line",
          line: { big: "The stand is open! Friends from all over the park wait in a long line.",
                  little: "The stand is open! Friends wait in a line." } },
        { art: "e02", ages: "big", key: "leaf",
          line: "Lola puts a little green leaf on top of every cup. Even the lizard gets one!" },
        { art: "e03", ages: "both", key: "laugh",
          line: { big: "Lola takes a big sip and starts to laugh. Her lemonade tickles her nose!",
                  little: "Lola sips and starts to laugh!" } },
        { art: "e04", ages: "both", key: "lucky",
          line: { big: "What a lucky day! A gold star for Lola's lemonade stand on our helper map!",
                  little: "What a lucky day! A gold star for our helper map!" } }
      ]
    },

    // Z: Zola the koala's little zeppelin went flat when its zipper popped open, and the child's words zip it shut, pump it full and fly it over the farm.
    zola: {
      sound: "Z",
      wash: "#2f5585",
      intro: [
        { art: "s01", ages: "both", key: "zebra",
          line: "Pelly the pelican brought us a letter. Oops! That's a little toy zebra!" },
        { art: "s02", ages: "both", key: "zeppelin",
          line: { big: "Here's the real letter. It's from Zola the koala. Her zeppelin went flat before the big ride!",
                  little: "The real letter is from Zola the koala. Her zeppelin went flat!" } },
        { art: "s03", ages: "big", key: "zucchini",
          line: "We hurry along the farm path, past a garden of giant zucchini, to Zola's flower meadow." },
        { art: "s04", ages: "both", key: "zipper",
          line: { big: "Oh no! The zeppelin's big zipper popped open, and all its air puffed out. Let's close the zipper!",
                  little: "Oh no! The zipper popped open. Let's close the zipper!" } },
        { art: "s05", ages: "both", key: "zip",
          line: { big: "Zip! We pull the zipper all the way shut. Now the zeppelin needs lots of air.",
                  little: "Zip! The zipper is shut. Now it needs air." } },
        { art: "s06", ages: "big", key: "zany",
          line: "Here comes Zola's friend, a zany little goat. Boing! She hops on the pump, and puff, the zeppelin grows." },
        { art: "s07", ages: "both", key: "zinnias",
          line: { big: "Hooray! The zeppelin is big and round. It floats up over the zinnias, tugging at its ropes.",
                  little: "Hooray! The zeppelin floats up over the zinnias!" } },
        { art: "s08", ages: "both", key: "zoom",
          line: { big: "We all climb into the basket. Zola turns the little wheel, the propeller spins, and up we zoom!",
                  little: "We climb in the basket. Up we zoom!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "zigzag",
          line: { big: "Whee! We zigzag around the fluffy white clouds, this way and that way.",
                  little: "Whee! We zigzag around the clouds!" } },
        { art: "e02", ages: "big", key: "zoo",
          line: "Far below is a tiny zoo. The giraffes and elephants look up and wave hello!" },
        { art: "e03", ages: "both", key: "zillion",
          line: { big: "We float softly back down to the meadow. Zola gives us a zillion thank-you hugs!",
                  little: "We float back down. Zola gives us a zillion hugs!" } },
        { art: "e04", ages: "both", key: "zinnia",
          line: { big: "Zola gives us a pink zinnia to take home. A gold star for Zola's meadow on our helper map!",
                  little: "Zola gives us a pink zinnia. A gold star for our helper map!" } }
      ]
    },

    // F: A long knitted scarf is tangled in the gears of Felix the ferret's Ferris wheel; the child's words follow it to a granny goat, untangle it and get the wheel turning.
    felix: {
      sound: "F",
      wash: "#7a3b52",
      intro: [
        { art: "s01", ages: "both", key: "funnel",
          line: "Pelly the pelican brought us a letter. Oops! That's a funnel! Is it a hat, Pelly?" },
        { art: "s02", ages: "both", key: "ferret",
          line: { big: "Here's the real letter. It's from Felix the ferret. The big wheel at his fair is stuck!",
                  little: "The real letter is from Felix the ferret. His big wheel is stuck!" } },
        { art: "s03", ages: "big", key: "farm",
          line: "We hurry down the country lane, past the farm, to the fair on the grassy hill." },
        { art: "s04", ages: "both", key: "fair",
          line: { big: "The fair opens soon, but the Ferris wheel won't go round. Let's find out why!",
                  little: "The fair opens soon, but the big wheel won't go!" } },
        { art: "s05", ages: "both", key: "fuzzy",
          line: { big: "Look! A long, fuzzy scarf is tangled all around the wheel's big wooden gears.",
                  little: "A fuzzy scarf is stuck in the wheel!" } },
        { art: "s06", ages: "big", key: "follow",
          line: "The scarf goes on and on, down the hill. Let's follow it! At the end sits a granny goat, knitting away." },
        { art: "s07", ages: "both", key: "fold",
          line: { big: "The granny goat giggles. Her yarn rolled away! We help her fold the long scarf, nice and neat.",
                  little: "We help the granny goat fold up the long scarf." } },
        { art: "s08", ages: "both", key: "faster",
          line: { big: "Now let's give the big wheel a push. One, two, three! It turns faster and faster!",
                  little: "Push, one, two, three! Faster and faster!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "fine",
          line: { big: "The Ferris wheel spins round and round, and its little lights twinkle on. What a fine sight!",
                  little: "The big wheel spins round and round. What a fine sight!" } },
        { art: "e02", ages: "big", key: "fudge",
          line: "We ride all the way to the top and share sweet fudge with Felix and the granny goat." },
        { art: "e03", ages: "both", key: "funny",
          line: { big: "The granny goat knits us a funny little hat with a pom-pom. Thank you, friends!",
                  little: "The goat knits us a funny little hat. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "fantastic",
          line: { big: "What a fantastic fair! A gold star for Felix's fair on our helper map!",
                  little: "What a fantastic day! A gold star for our helper map!" } }
      ]
    },

    // K: Coco the kangaroo's carnival carousel won't turn because a silly cockatoo flew off with its brass key; the child's words find it and swap it back for a cupcake.
    coco: {
      sound: "K",
      wash: "#6e3a63",
      intro: [
        { art: "s01", ages: "both", key: "cactus",
          line: "Pelly the pelican brought us a letter. Oops! That's a tiny cactus in a pot!" },
        { art: "s02", ages: "both", key: "kangaroo",
          line: { big: "Here's the real letter. It's from Coco the kangaroo. Her carousel stopped, and its key is lost!",
                  little: "The real letter is from Coco the kangaroo. Her key is lost!" } },
        { art: "s03", ages: "big", key: "carnival",
          line: "We hop up the hill path to the carnival, with its striped tents and a little Ferris wheel." },
        { art: "s04", ages: "both", key: "carousel",
          line: { big: "The carousel won't go round without its big brass key. Let's find the key for the carousel!",
                  little: "The carousel won't go round! Let's find its key." } },
        { art: "s05", ages: "both", key: "candy",
          line: { big: "We peek behind the candy stand. Just pink cotton candy, no key!",
                  little: "We peek by the candy stand. No key!" } },
        { art: "s06", ages: "big", key: "cat",
          line: "A curious cat on the popcorn cart waves his paw up at the sky. Thank you, cat!" },
        { art: "s07", ages: "both", key: "cockatoo",
          line: { big: "Up on the Ferris wheel sits a silly cockatoo, with the shiny key in her beak!",
                  little: "A silly cockatoo has the key!" } },
        { art: "s08", ages: "both", key: "cupcake",
          line: { big: "We hold up a tasty cupcake. The cockatoo flutters down and swaps the key for the cupcake!",
                  little: "We hold up a cupcake. The cockatoo swaps it for the key!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "key",
          line: { big: "Coco turns the key, click, click! The carousel spins, and happy music plays.",
                  little: "Coco turns the key. The carousel spins!" } },
        { art: "e02", ages: "big", key: "camel",
          line: "We all ride the carousel. Echo picks a camel with a bright blue saddle." },
        { art: "e03", ages: "both", key: "coin",
          line: { big: "Coco gives us a shiny copper coin to keep. Thank you, friends!",
                  little: "Coco gives us a shiny coin. Thank you, friends!" } },
        { art: "e04", ages: "both", key: "come",
          line: { big: "Come back soon, Coco! A gold star for the carnival on our helper map!",
                  little: "Come back soon! A gold star for our helper map!" } }
      ]
    },

    // G: A gust of wind scatters Gabby the gorilla's golf balls across her mini golf course, and the child's words find all six so the golf game can begin.
    gabby: {
      sound: "G",
      wash: "#3f6a34",
      intro: [
        { art: "s01", ages: "both", key: "goggles",
          line: "Pelly the pelican brought us a letter. Oops! That's a pair of swim goggles!" },
        { art: "s02", ages: "both", key: "gorilla",
          line: { big: "Here's the real letter. It's from Gabby the gorilla. Her golf balls blew all over her golf course!",
                  little: "The real letter is from Gabby the gorilla. Her golf balls blew away!" } },
        { art: "s03", ages: "big", key: "gate",
          line: "We hurry down the winding path and through the little white gate to the golf course." },
        { art: "s04", ages: "both", key: "golf",
          line: { big: "A gust of wind tipped over the bucket, and every golf ball is gone. Let's look!",
                  little: "Every golf ball is gone! Let's look." } },
        { art: "s05", ages: "both", key: "garden",
          line: { big: "Look, three golf balls rolled into the garden, under the big pumpkin leaves!",
                  little: "Three balls are in the garden!" } },
        { art: "s06", ages: "big", key: "goldfish",
          line: "Two more balls are floating in the pond. A friendly goldfish nudges them to the edge. Thank you!" },
        { art: "s07", ages: "both", key: "gull",
          line: { big: "One more ball! A cheeky gull is sitting on the windmill with the ball in its beak.",
                  little: "A gull has the last ball!" } },
        { art: "s08", ages: "both", key: "give",
          line: { big: "Let's ask the gull nicely. Please give it back! Plop, the ball drops into Gabby's hands.",
                  little: "Please give it back, gull! Plop!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "game",
          line: { big: "All six balls are back in the bucket. Now the golf game can begin!",
                  little: "Every ball is back! The golf game can begin!" } },
        { art: "e02", ages: "big", key: "goofy",
          line: "Echo taps his ball. It rolls right into the mouth of a goofy frog statue. Gulp!" },
        { art: "e03", ages: "both", key: "goodies",
          line: { big: "Gabby shares a basket of goodies with everyone, even the gull. Yum!",
                  little: "Gabby shares her goodies. Yum!" } },
        { art: "e04", ages: "both", key: "good",
          line: { big: "What a good day! A gold star for Gabby's golf course on our helper map!",
                  little: "What a good day! A gold star for our helper map!" } }
      ]
    },

    // SH: Shona the sheep rolled in the mud before her farm party, and the child's words give her a bubbly shower so she is clean and fluffy in time to dance.
    shona: {
      sound: "SH",
      wash: "#5a4a7a",
      intro: [
        { art: "s01", ages: "both", key: "shirt",
          line: "Pelly the pelican brought us a letter. Oops! That's a little polka-dot shirt!" },
        { art: "s02", ages: "both", key: "sheep",
          line: { big: "Here's the real letter. It's from Shona the sheep. She rolled in the mud before her farm party!",
                  little: "The real letter is from Shona the sheep. She's all muddy!" } },
        { art: "s03", ages: "big", key: "shed",
          line: "We hurry down the path to the farm, past the little old red shed." },
        { art: "s04", ages: "both", key: "shower",
          line: { big: "Shona has big mud spots all over her wool, and the party starts soon! Let's give her a shower.",
                  little: "Shona is all muddy! Let's give her a shower." } },
        { art: "s05", ages: "both", key: "shampoo",
          line: { big: "We rub lots of pink shampoo into her wool. Look at all the bubbles!",
                  little: "We rub in pink shampoo. Bubbles!" } },
        { art: "s06", ages: "big", key: "shapes",
          line: "The bubbles make funny shapes on her wool, a tall hat, a long beard and a big bow!" },
        { art: "s07", ages: "both", key: "shake",
          line: { big: "Now Shona gives a big wiggly shake. Splash! Water flies everywhere, and we get wet too!",
                  little: "Shona gives a big shake. Splash!" } },
        { art: "s08", ages: "both", key: "sheet",
          line: { big: "We wrap her up in a big soft sheet to dry. She's warm and cozy.",
                  little: "We wrap her in a soft sheet. Cozy!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "shiny",
          line: { big: "Ta-da! Shona's wool is clean, fluffy and shiny, just like a soft white cloud!",
                  little: "Shona is clean, fluffy and shiny!" } },
        { art: "e02", ages: "big", key: "shuffle",
          line: "At the farm party, we shuffle our feet and dance with all of Shona's farm friends." },
        { art: "e03", ages: "both", key: "shares",
          line: { big: "Shona shares a soft little ball of her clean wool with us. Thank you, friends!",
                  little: "Shona shares a ball of wool with us. Thank you!" } },
        { art: "e04", ages: "both", key: "shine",
          line: { big: "See it shine? A gold star for Shona's farm on our helper map!",
                  little: "See it shine? A gold star for our helper map!" } }
      ]
    },

    // CH: Chico the chinchilla hid a treasure chest for a party and forgot where, so the child follows his chalk arrows and a chickadee's chirp to find it and share the picnic inside.
    chico: {
      sound: "CH",
      wash: "#6d4b2e",
      intro: [
        { art: "s01", ages: "both", key: "chicken",
          line: "Pelly the pelican brought us a letter. Oops! That's a rubber chicken!" },
        { art: "s02", ages: "both", key: "chinchilla",
          line: { big: "Here's the real letter. It's from Chico the chinchilla. He hid a treasure chest for a party and forgot where!",
                  little: "The real letter is from Chico the chinchilla. He can't find his treasure!" } },
        { art: "s03", ages: "big", key: "chilly",
          line: "The wind is chilly on the hill, so we hurry up the winding path to Chico's little stone house." },
        { art: "s04", ages: "both", key: "chest",
          line: { big: "Chico hid a treasure chest for his friends to find, but now he can't find it. Let's find the chest!",
                  little: "Chico can't find his treasure chest! Let's find the chest." } },
        { art: "s05", ages: "both", key: "chalk",
          line: { big: "Look, an arrow in chalk on a big rock. Chico drew chalk arrows to show the way!",
                  little: "A chalk arrow! This way!" } },
        { art: "s06", ages: "big", key: "chirp",
          line: "The chalk arrows stop at the fence. Chirp, chirp! A little chickadee waves her wing at the old oak tree." },
        { art: "s07", ages: "both", key: "chuckle",
          line: { big: "At the oak tree, Chico starts to chuckle. Now he remembers! The chest is under the leaves.",
                  little: "Chico starts to chuckle. It's under the leaves!" } },
        { art: "s08", ages: "both", key: "chain",
          line: { big: "We brush the leaves away, and there's the chest! Chico unhooks its little gold chain.",
                  little: "There's the chest! Chico unhooks the chain." } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "cheese",
          line: { big: "Chico lifts the lid. Inside is a treasure picnic, with cheese, crackers and berries for everyone!",
                  little: "Inside is a picnic! Cheese for everyone!" } },
        { art: "e02", ages: "big", key: "chomp",
          line: "We sit on a picnic blanket with the chickadee and chomp, chomp, chomp on the yummy treats." },
        { art: "e03", ages: "both", key: "cheek",
          line: { big: "Chico gives us a big hug, cheek to cheek. Thank you, treasure hunters!",
                  little: "A big hug, cheek to cheek. Thank you!" } },
        { art: "e04", ages: "both", key: "cheerful",
          line: { big: "What a cheerful day! A gold star for Chico's oak tree on our helper map!",
                  little: "What a cheerful day! A gold star for our helper map!" } }
      ]
    },

    // TH: The wind blew a hole in Thea the hedgehog's thatched roof, so the child helps her fetch straw from the farm field over the hill and patch it.
    thea: {
      sound: "TH",
      wash: "#6b4a1c",
      intro: [
        { art: "s01", ages: "both", key: "thermos",
          line: "Pelly the pelican brought us a letter. Oops! That's a big blue thermos!" },
        { art: "s02", ages: "both", key: "thatch",
          line: { big: "Here's the real letter. It's from Thea the hedgehog. The wind blew a hole in the thatch on her roof!",
                  little: "The real letter is from Thea the hedgehog. Her roof thatch has a hole!" } },
        { art: "s03", ages: "big", key: "thicket",
          line: "We hurry down the lane and through a little thicket to Thea's cozy cottage." },
        { art: "s04", ages: "both", key: "thimble",
          line: { big: "Drip, drop! Last night's rain came through the hole, and Thea caught it in a thimble. Silly Thea!",
                  little: "Drip, drop! Thea caught the rain in a thimble!" } },
        { art: "s05", ages: "both", key: "thumb",
          line: { big: "Thea holds up her thumb toward the hill. The field by the barn is full of golden straw!",
                  little: "Thea's thumb shows the way. Golden straw, over there!" } },
        { art: "s06", ages: "big", key: "thistle",
          line: "A fuzzy purple thistle tickles Echo's wing as we pass. Hee hee!" },
        { art: "s07", ages: "both", key: "thorn",
          line: { big: "Look, a thorn on the bramble by the gate. We step around it and pick up big bundles of straw.",
                  little: "Look, a thorn! We step around it." } },
        { art: "s08", ages: "both", key: "thin",
          line: { big: "We tie each bundle with a thin piece of string, and off we go, back to Thea's cottage.",
                  little: "We tie the straw with thin string!" } }
      ],
      ending: [
        { art: "e01", ages: "both", key: "thump",
          line: { big: "Thump, thump! Up on the roof, Thea taps fresh straw into the hole, one bundle at a time.",
                  little: "Thump, thump! Thea fixes the roof." } },
        { art: "e02", ages: "big", key: "thud",
          line: "Thud! The last bundle lands on the roof, and Thea pats it neatly into place. The hole is gone!" },
        { art: "e03", ages: "both", key: "thanks",
          line: { big: "Thea pours warm cocoa for everyone. Thanks for helping, friends!",
                  little: "Thea pours us cocoa. Thanks, friends!" } },
        { art: "e04", ages: "both", key: "thick",
          line: { big: "Thea's roof is thick and cozy now. A gold star for Thea's cottage on our helper map!",
                  little: "Her roof is thick and cozy! A gold star for our helper map!" } }
      ]
    }
  };
})(this);
