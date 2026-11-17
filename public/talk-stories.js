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
    }
  };
})(this);
