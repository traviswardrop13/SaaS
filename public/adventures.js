/* THE DAILY STORY'S SCENES (STORY1, 22 Oct 2026). Loaded by /adventure.html
   alone, so the story text does not ride on every page. The day list itself
   (title, Home's line and picture, the game and its page) is one copy in
   sona.js, STORY_DAYS; this file holds only what Echo reads.

   Every line is the build spec's, word for word, and tests/adventuretest.mjs
   holds each to the rules a story line keeps: 120 characters at most (a
   longer line misses the voice server's cache), plain punctuation, no
   child's name (the line is sent to the voice company), no speech sound
   named, nothing about how to talk, none of the game words a child could read
   as a grade, and the same line on every phone (so each can be recorded once).
   No scene asks the child to speak: that happens only in the game's own word
   turn. "Ah-choo!" and "Honk-shoo" are story words, never targets.

   A scene: { art, ages, buddy, line }.
     art    the picture, /assets/adventure/<story>/<art>.webp (800x1200)
     ages   "both", or "big" (ages 5-8 only: a child of 3 or 4 skips it)
     line   one string for every age, or { big, little } (little: ages 3-4)
     buddy  where the child's buddy stands on the picture, or null:
            { x, y, h, pose }, measured on the picture from 0 to 1. x is the
            middle of the buddy, y the line its feet stand on, h its height;
            pose is rest, cheer, peek or sit. The boxes are the art notes'
            (design/adventure/art-notes.md, section 2), placed by laying real
            buddies on each picture's empty spot; the comment on each scene
            names that spot. null: the picture has no spot, and no buddy
            shows. The player lifts a buddy clear of the caption card and
            leaves it out where it would meet a button, so a box never puts a
            buddy over something a child taps. What a picture shows a child
            is Rachel's call.
   wash is the colour a scene shows while its picture loads, or if it fails.
   Adding a story is two edits: its line in sona.js's STORY_DAYS, its scenes
   here. ES5, no build step. */
(function (global) {
  "use strict";
  global.SonaAdventures = {

    // Day 1: The Lighthouse Sneeze. A cozy night, never scary.
    lighthouse: {
      wash: "#2b2f5e",
      intro: [
        // buddy: on the porch step, LEFT of Echo (the spec said right; the picture put Echo on the right of the step)
        { art: "s01", ages: "both", buddy: { x: 0.41, y: 0.68, h: 0.22, pose: "rest" },
          line: "Look! Pelly the pelican brought us a letter. Oops. That's a fish!" },
        // buddy: peeking over the porch railing, beside Echo (peek)
        { art: "s02", ages: "both", buddy: { x: 0.42, y: 0.60, h: 0.15, pose: "peek" },
          line: { big: "Here's the real letter. It's from Captain Wally at the lighthouse. He needs our help tonight!",
                  little: "Here's the real letter. Captain Wally at the lighthouse needs our help!" } },
        // buddy: on the path, left of Echo (rest)
        { art: "s03", ages: "both", buddy: { x: 0.44, y: 0.80, h: 0.19, pose: "rest" },
          line: { big: "Captain Wally keeps the light that helps the boats get home. But he has a cold. Sniff, sniff!",
                  little: "This is Captain Wally. He has a cold. Sniff, sniff!" } },
        // buddy: on a step, between Wally and Echo (rest)
        { art: "s04", ages: "big", buddy: { x: 0.62, y: 0.595, h: 0.15, pose: "rest" },
          line: "We climb up, up, up the twisty stairs to the big lamp. Puff, puff, puff!" },
        // buddy: on the lamp-room floor by the railing (rest)
        { art: "s05", ages: "both", buddy: { x: 0.55, y: 0.78, h: 0.20, pose: "rest" },
          line: "Ah... ah... ah-choo! Oh no! Captain Wally sneezed the lamp right out!" },
        // no buddy: the view out of the window
        { art: "s06", ages: "both", buddy: null,
          line: { big: "Out on the sea, the little boats are coming home. But it's dark and foggy. Toot, toot? Which way?",
                  little: "The little boats can't find their way home. It's too dark!" } },
        // buddy: laughing on the floor, right, apart from Wally (cheer)
        { art: "s07", ages: "big", buddy: { x: 0.80, y: 0.81, h: 0.22, pose: "cheer" },
          line: "Wally can't find his glasses. They're on his head! And if he gets near the lamp... ah-choo! Out it goes." },
        // buddy: on the ledge, right of the lamp (cheer)
        { art: "s08", ages: "both", buddy: { x: 0.80, y: 0.665, h: 0.20, pose: "cheer" },
          line: { big: "So it's up to us! Let's light the lamp, find every boat, and shine them all the way home.",
                  little: "Let's light the lamp and find the little boats!" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy: the harbor
        { art: "e01", ages: "both", buddy: null,
          line: "Toot, toot, hooray! Every little boat is safe at home." },
        // no buddy: the whale's fountain
        { art: "e02", ages: "big", buddy: null,
          line: "Even the sleepy whale woke up to say thank you. Splash!" },
        // buddy: on the floor, lower left, under Echo and Wally (cheer)
        { art: "e03", ages: "both", buddy: { x: 0.24, y: 0.85, h: 0.20, pose: "cheer" },
          line: { big: "We found Wally's glasses. And this time, his sneeze was a teeny one. Achoo!",
                  little: "Look! Wally's glasses were on his head the whole time. Silly Wally!" } },
        // buddy: on the empty cushion by the lamp, a mug beside it (sit)
        { art: "e04", ages: "both", buddy: { x: 0.75, y: 0.81, h: 0.22, pose: "sit" },
          line: "Cocoa for the heroes! You lit the way home. Our helper map gets its first gold star." }
      ]
    },

    // Day 2: Grandpa Bear's Sleepy Toys. A warm wooden toy shop, indoors.
    windup: {
      wash: "#b9783f",
      intro: [
        // buddy: on the doorstep, between Pelly and Echo (rest)
        { art: "s01", ages: "both", buddy: { x: 0.44, y: 0.68, h: 0.21, pose: "rest" },
          line: "Pelly the pelican is back with a letter! Oops. That's a rubber duck. Squeak!" },
        // buddy: on the path, right of Echo (cheer)
        { art: "s02", ages: "both", buddy: { x: 0.70, y: 0.64, h: 0.25, pose: "cheer" },
          line: { big: "It's from Grandpa Bear's toy shop. The Toy Parade is today! Hooray!",
                  little: "Grandpa Bear's toys have a parade today. Hooray!" } },
        // buddy: on the cobbles, right of Echo (rest)
        { art: "s03", ages: "both", buddy: { x: 0.74, y: 0.635, h: 0.22, pose: "rest" },
          line: { big: "The whole town is waiting in the square for the parade. But where are the toys?",
                  little: "Everyone is waiting for the parade. Where are the toys?" } },
        // buddy: peeking over the wooden crate, right of Echo (peek)
        { art: "s04", ages: "both", buddy: { x: 0.56, y: 0.61, h: 0.17, pose: "peek" },
          line: "Shh! The toys are fast asleep. They had a secret party all night long!" },
        // no buddy: a close-up of the drummer bunny
        { art: "s05", ages: "big", buddy: null,
          line: "Now they're all out of wind. Their little keys won't turn by themselves." },
        // buddy: giggling on the round rug, right of Echo (cheer)
        { art: "s06", ages: "both", buddy: { x: 0.60, y: 0.81, h: 0.24, pose: "cheer" },
          line: "And Grandpa Bear is asleep too. He snores like a tuba! Honk-shoo, honk-shoo." },
        // no buddy: the paper board of three pictures
        { art: "s07", ages: "big", buddy: null,
          line: "A wind-up toy needs just the right winding. Too little, it yawns. Too much, it spins! Just right, it marches." },
        // buddy: on the workbench, right of the bunny (cheer)
        { art: "s08", ages: "both", buddy: { x: 0.83, y: 0.74, h: 0.22, pose: "cheer" },
          line: { big: "Let's wind up every toy and get this parade going. Ready?",
                  little: "Let's wind up the toys for the parade. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy: the parade
        { art: "e01", ages: "both", buddy: null,
          line: "Here comes the Toy Parade! Rat-a-tat, toot, hop, twirl. Everybody cheers!" },
        // buddy: on the cobbles, right of Echo (cheer)
        { art: "e02", ages: "both", buddy: { x: 0.64, y: 0.79, h: 0.23, pose: "cheer" },
          line: "Grandpa Bear woke up and ran out in his pajamas. Is it parade time? Yes, it is!" },
        // no buddy: the back of the crowd
        { art: "e03", ages: "big", buddy: null,
          line: "Look who came to watch! Captain Wally, with his glasses on, and the three little mice." },
        // buddy: hugging Echo, on the rug at his right (cheer)
        { art: "e04", ages: "both", buddy: { x: 0.76, y: 0.69, h: 0.26, pose: "cheer" },
          line: "Two gold stars on our helper map! What a day." }
      ]
    },

    // Day 3: The Puzzle Bridge. A bright, sparkling morning after the storm.
    bridge: {
      wash: "#5fb8c2",
      intro: [
        // buddy: on the doorstep, right of Echo (rest)
        { art: "s01", ages: "both", buddy: { x: 0.86, y: 0.69, h: 0.20, pose: "rest" },
          line: "Pelly is here with a letter. Oops. That's a banana. Pelly, you silly bird!" },
        // no buddy: the letter
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. Grandma Tortoise is one hundred years old today! The party is on Blossom Island.",
                  little: "It's Grandma Tortoise's birthday! The party is on Blossom Island." } },
        // buddy: in the group, right of Echo (rest)
        { art: "s03", ages: "big", buddy: { x: 0.74, y: 0.77, h: 0.22, pose: "rest" },
          line: "Everyone is going. Captain Wally has the cake, and Grandpa Bear's toys will play the music!" },
        // buddy: on the bank, left of Echo; everyone is small here (rest)
        { art: "s04", ages: "both", buddy: { x: 0.15, y: 0.87, h: 0.13, pose: "rest" },
          line: { big: "But look! Last night's storm shook the old bridge. Its stones fell in the river!",
                  little: "Oh no! The storm broke the bridge. Its stones fell in the river!" } },
        // no buddy: Grandma on the island
        { art: "s05", ages: "big", buddy: null,
          line: "Grandma Tortoise is waving from the island. Nobody can get across to the party!" },
        // buddy: peeking over the flat rock, beside Echo (peek)
        { art: "s06", ages: "both", buddy: { x: 0.55, y: 0.585, h: 0.17, pose: "peek" },
          line: "The stones are asleep on the river bottom. When they hear a word, up they float!" },
        // no buddy: one stone beside its hole
        { art: "s07", ages: "both", buddy: null,
          line: { big: "Every stone fits just one hole. Turn it the right way, then slide it in. Click!",
                  little: "Every stone fits the hole with the same shape. Click!" } },
        // buddy: on the bridge's first stones, left of Echo (cheer)
        { art: "s08", ages: "both", buddy: { x: 0.17, y: 0.52, h: 0.16, pose: "cheer" },
          line: { big: "Let's build the bridge back, stone by stone. Ready?",
                  little: "Let's fix the bridge, stone by stone. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy: the whole bridge
        { art: "e01", ages: "both", buddy: null,
          line: "Click! The last stone fits. The bridge is whole again!" },
        // buddy: in the line on the bridge, behind Echo (rest). Ages 5-8
        // only: the spec's table marks it "both" but shows it to no little
        // one, and its ending list for ages 3-4 is e01, e03 and e04.
        { art: "e02", ages: "big", buddy: { x: 0.76, y: 0.76, h: 0.20, pose: "rest" },
          line: "Everyone crosses. Captain Wally carries the cake, and the toys march and play!" },
        // no buddy: Grandma and her candles
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Happy birthday, Grandma Tortoise! Everybody sings, and she blows out her candles. Whoosh!",
                  little: "Happy birthday, Grandma Tortoise! Whoosh go the candles!" } },
        // buddy: hugging Echo, on the rug at his right (cheer)
        { art: "e04", ages: "both", buddy: { x: 0.74, y: 0.71, h: 0.27, pose: "cheer" },
          line: "Three gold stars on our helper map! You're a super helper." }
      ]
    },

    // ── DAYS 4-14 (22 Oct 2026): the stories around Codex's eleven games. Same shape
    // and rules as Days 1-3: Pelly's letter, the problem, "Let's go!", the game
    // (story-game.html), the ending and a gold star. The game's own words are
    // daily-adventures/pages.js; these are only what Echo reads around it. ──

    // Day 4: The Thirsty Waterwheel Garden.
    waterwheel: {
      wash: "#8fbf68",
      intro: [
        // buddy: on the doorstep to the right of Echo, right of the door (rest)
        { art: "s01", ages: "both", buddy: { x: 0.515, y: 0.705, h: 0.145, pose: "rest" },
          line: "Here comes Pelly with a letter! Oops. That's a striped sock. Pelly, where's the other one?" },
        // no buddy (PEEK, not placed)
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. It's from Gardener Mouse. Her flowers are thirsty, and her waterwheel has stopped!",
                  little: "Here's the real letter, from Gardener Mouse. Her flowers need a drink!" } },
        // buddy: on the sandy path just right of Echo (rest)
        { art: "s03", ages: "both", buddy: { x: 0.71, y: 0.755, h: 0.19, pose: "rest" },
          line: { big: "Up the hill we go, to Gardener Mouse's garden. Oh dear. The flowers are droopy, and the pond is dry.",
                  little: "Oh dear. Droopy flowers, an empty pond, and a wheel that won't turn!" } },
        // no buddy
        { art: "s04", ages: "big", buddy: null,
          line: "Two ducks sit in the empty pond with their towels, ready for a swim. Quack? Where's the water?" },
        // no buddy (on the sandy path just right of Gardener Mouse, not placed)
        { art: "s05", ages: "both", buddy: null,
          line: { big: "Gardener Mouse is watering the whole garden with a teeny watering can. One drop for you. One drop for you!",
                  little: "Gardener Mouse has a teeny watering can. Drip, drip!" } },
        // no buddy (on the sandy ground just right of Echo, in front of the heap, not placed)
        { art: "s06", ages: "both", buddy: null,
          line: { big: "She took her wooden troughs apart to scrub them. Now they're in a heap, and she can't remember how they go!",
                  little: "The wooden troughs are slides for the water. Now they're all in a heap!" } },
        // no buddy
        { art: "s07", ages: "big", buddy: null,
          line: "Water runs down the troughs to the wheel, and the wheel scoops it up for the plants. A gap? Splish! It spills out." },
        // no buddy (on the wide flat stone just left of Echo, not placed)
        { art: "s08", ages: "both", buddy: null,
          line: { big: "Let's fit the troughs back together, open the water gate, and get that wheel turning. Ready?",
                  little: "Let's fix the troughs and get the wheel turning. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Gurgle, gurgle! The wheel turns, the water runs, and every droopy flower stands up tall.",
                  little: "Gurgle, gurgle! The wheel turns, and the flowers get a big drink!" } },
        // buddy: on the pond's flat stone edge just right of Echo (cheer)
        { art: "e02", ages: "big", buddy: { x: 0.6, y: 0.78, h: 0.19, pose: "cheer" },
          line: "The pond fills right up, and in jump the ducks with a big splash. Quack, quack, hooray!" },
        // buddy: on the sandy path just right of Echo (cheer)
        { art: "e03", ages: "both", buddy: { x: 0.875, y: 0.855, h: 0.18, pose: "cheer" },
          line: { big: "Gardener Mouse puts her feet up. And look! A little frog found Pelly's other sock. It makes a cozy sleeping bag!",
                  little: "Look! A little frog found Pelly's other sock!" } },
        // buddy: the right half of the bench, just right of Echo (cheer)
        { art: "e04", ages: "both", buddy: { x: 0.655, y: 0.685, h: 0.19, pose: "cheer" },
          line: "Four gold stars on our helper map! And not one droopy flower left in the garden." }
      ]
    },

    // Day 5: The Little Island Postboat.
    postboat: {
      wash: "#3f9fc0",
      intro: [
        // buddy: on the doorstep to the right of Echo, right of the door (rest)
        { art: "s01", ages: "both", buddy: { x: 0.45, y: 0.72, h: 0.19, pose: "rest" },
          line: "Pelly waddles up with a letter! Oops. That's a teapot. And it's still warm!" },
        // buddy: on the garden path just right of Echo (rest)
        { art: "s02", ages: "both", buddy: { x: 0.79, y: 0.765, h: 0.21, pose: "rest" },
          line: { big: "Here's the real letter. It's from Postmaster Otter, down by the sea. He needs our help!",
                  little: "Here's the real letter. Postmaster Otter needs our help!" } },
        // buddy: on the jetty's plank deck just right of Echo (rest)
        { art: "s03", ages: "both", buddy: { x: 0.42, y: 0.83, h: 0.19, pose: "rest" },
          line: { big: "Otter has parcels for everybody on the little islands. Look at that pile!",
                  little: "Postmaster Otter has a big pile of parcels!" } },
        // buddy: on the flat mossy rock just right of Echo (rest)
        { art: "s04", ages: "big", buddy: { x: 0.48, y: 0.795, h: 0.2, pose: "rest" },
          line: "But his big red boat is too wide for the reeds. It got stuck! Squish, squelch." },
        // buddy: on the jetty's plank deck in the lower right, in front of the postboat (cheer)
        { art: "s05", ages: "both", buddy: { x: 0.7, y: 0.84, h: 0.2, pose: "cheer" },
          line: { big: "Lucky for us, Otter has a little postboat too. It fits right through the reeds!",
                  little: "Otter's big boat won't fit in the reeds. This little one will!" } },
        // no buddy
        { art: "s06", ages: "big", buddy: null,
          line: "Mouse's little blue house has no curtains. Heron keeps getting rained on. And Turtle has read all his books, twice!" },
        // buddy: on the floating jetty's planks just right of Echo (rest)
        { art: "s07", ages: "both", buddy: { x: 0.44, y: 0.745, h: 0.185, pose: "rest" },
          line: { big: "Then there's Beaver. He nibbled his own front door by mistake. Crunch! His new one is on that raft.",
                  little: "Silly Beaver nibbled his door. Crunch! His new one is on a raft." } },
        // buddy: on the jetty planks in the lower right, right of Otter and in front of the postboat (cheer)
        { art: "s08", ages: "both", buddy: { x: 0.8, y: 0.855, h: 0.2, pose: "cheer" },
          line: { big: "Let's steer the little postboat to every island, and pull Beaver's raft behind us. Ready?",
                  little: "Let's steer the boat to every island. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Beaver's new door fits just right. Open, shut, open, shut. He loves it!",
                  little: "Beaver's new door fits. Hooray!" } },
        // no buddy
        { art: "e02", ages: "big", buddy: null,
          line: "Mouse hangs up her curtains. Turtle starts a new book. And Heron splashes in his new raincoat!" },
        // no buddy (on the jetty planks just right of Echo, in front of the table, not placed)
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Tea for everyone from Pelly's teapot! And Beaver nibbles a stick, not his new door.",
                  little: "Tea for everyone from Pelly's teapot!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "Our helper map has five gold stars now! You and the little postboat did it." }
      ]
    },

    // Day 6: Breakfast at the Moonberry Bakery.
    bakery: {
      wash: "#cc8b43",
      intro: [
        // buddy: on the doorstep to the right of Echo, right of the door (rest)
        { art: "s01", ages: "both", buddy: { x: 0.45, y: 0.685, h: 0.19, pose: "rest" },
          line: "Pelly is up early with a letter. Oops. That's a pinecone! What a prickly letter, Pelly." },
        // no buddy (PEEK, not placed)
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. It's from Baker Badger. His new bakery opens this morning, and he needs more paws!",
                  little: "Here's the real letter. Baker Badger's new bakery opens today!" } },
        // no buddy (on the cobbles just left of Echo, not placed)
        { art: "s03", ages: "both", buddy: null,
          line: { big: "The neighbors are already lining up at the Moonberry Bakery. Grandpa Bear brought a very big basket!",
                  little: "Everyone is hungry, but there are no buns yet. Rumble, rumble go their tummies!" } },
        // buddy: on the counter top just right of Echo (rest)
        { art: "s04", ages: "big", buddy: { x: 0.865, y: 0.775, h: 0.165, pose: "rest" },
          line: "Inside, every tray is empty. Badger is so excited about his new bakery, his paws won't stop wiggling!" },
        // no buddy
        { art: "s05", ages: "both", buddy: null,
          line: { big: "Wobble, wobble, poof! The flour goes everywhere. Where did Badger's stripes go?",
                  little: "Poof! Flour everywhere. Where did Badger's stripes go?" } },
        // no buddy
        { art: "s06", ages: "both", buddy: null,
          line: { big: "The recipe is all pictures. Pour to the line, stir, then shape round buns, curled buns and berry buns.",
                  little: "The recipe is all pictures. Pour it, stir it, shape the buns!" } },
        // buddy: on the counter top just right of Echo (rest)
        { art: "s07", ages: "big", buddy: { x: 0.905, y: 0.8, h: 0.17, pose: "rest" },
          line: "Sniff, sniff. Grandpa Bear's nose is squished on the window. Not yet, Grandpa Bear. We haven't even started!" },
        // no buddy (on the counter top just right of the mixing bowl, not placed)
        { art: "s08", ages: "both", buddy: null,
          line: { big: "Let's mix the dough, shape the buns and bake them golden for the whole street. Ready?",
                  little: "Let's bake breakfast for everyone. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Ta-da! Round buns, curled buns and berry buns, each in its own basket. Breakfast is ready!",
                  little: "Ta-da! Breakfast is ready. Warm buns, fresh from the oven!" } },
        // no buddy (on the counter top just right of Echo, not placed)
        { art: "e02", ages: "big", buddy: null,
          line: "Badger opens the door, and in come the neighbors. Good thing Grandpa Bear brought that very big basket!" },
        // buddy: on the wooden floor just left of Echo (cheer)
        { art: "e03", ages: "both", buddy: { x: 0.555, y: 0.765, h: 0.19, pose: "cheer" },
          line: { big: "Pelly flies in for breakfast too. She tucks a bun in her pouch, and out pops another pinecone. Bonk!",
                  little: "Pelly puts a bun in her pouch. Out pops another pinecone!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "Six gold stars on our helper map! Badger even gave us the very last curled bun." }
      ]
    },

    // Day 7: Tortoise's New Front Door.
    frontdoor: {
      wash: "#94ac7d",
      intro: [
        // no buddy (on the doorstep to the right of Echo, right of the door, not placed)
        { art: "s01", ages: "both", buddy: null,
          line: "Pelly flew in with a letter. Oops. That's a toothbrush! Whose is it?" },
        // no buddy (PEEK, not placed)
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. It's from Tortoise. He's moving to a new house today, and he needs our help!",
                  little: "Here's the real letter. Tortoise has a new house, and he needs our help!" } },
        // no buddy (on the sandy path just left of Echo, not placed)
        { art: "s03", ages: "both", buddy: null,
          line: { big: "Meet Tortoise and his moving cart. His new house is just over the stream. See the green door?",
                  little: "This is Tortoise and his cart. His new house is over the stream, but there's no bridge!" } },
        // no buddy (on the plain grass just right of Echo, in front of the cart, not placed)
        { art: "s04", ages: "big", buddy: null,
          line: "Tortoise packed his chair, his books and his cozy blanket. But where is his toothbrush?" },
        // no buddy
        { art: "s05", ages: "big", buddy: null,
          line: "Oh no, there's no bridge! The new one is still in pieces, all in a big pile by the water." },
        // no buddy (on the plain grass just right of Echo, well away from the plank, not placed)
        { art: "s06", ages: "both", buddy: null,
          line: { big: "Tortoise tries to carry a long plank on his shell. Round and round he spins! Whoa, whoops!",
                  little: "Tortoise tries to carry a big piece of wood. Round and round he spins. Whoops!" } },
        // no buddy
        { art: "s07", ages: "both", buddy: null,
          line: { big: "Here's a crane to help! Hook the wood, lift it, turn it to fit, and lower it onto its glowing spot.",
                  little: "Here's a crane! It lifts the wood. Turn it to fit, then down it goes. Clunk!" } },
        // no buddy (on the wooden landing's planks just right of Echo, not placed)
        { art: "s08", ages: "both", buddy: null,
          line: { big: "Let's put the bridge together, roll Tortoise's cart to his green door, and ring his doorbell. Ready?",
                  little: "Let's build a bridge, then roll Tortoise's cart to his door. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy (on the bridge's plank walkway just behind Echo, toward the near bank, not placed)
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Ding-dong! Tortoise's cart rolls across our new bridge, all the way to his green door.",
                  little: "Ding-dong! Tortoise's cart made it to his green door!" } },
        // no buddy (the plain patch of round rug just right of Echo, nothing on it, not placed)
        { art: "e02", ages: "big", buddy: null,
          line: "Chair by the window, books on the shelf, blanket on the bed. Tortoise does a happy dance, a very slow one!" },
        // no buddy (on the stone path just right of Echo, not placed)
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Pelly is back, and look! That toothbrush is Tortoise's. He sent it with his letter by mistake!",
                  little: "Pelly brings the toothbrush. It's Tortoise's! Brush, brush!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "Tortoise is home, and that makes seven gold stars on our helper map!" }
      ]
    },

    // Day 8: The Glowworm Lantern Walk.
    lantern: {
      wash: "#56598a",
      intro: [
        // buddy: on the doorstep to the right of Echo, right of the door (rest)
        { art: "s01", ages: "both", buddy: { x: 0.465, y: 0.665, h: 0.19, pose: "rest" },
          line: "Pelly swoops down with a letter! Oops. That's a carrot! Somebody is going to love that." },
        // no buddy (PEEK, not placed)
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. It's from Glowworm in the Mushroom Woods. He needs our help with his lamps tonight!",
                  little: "Here's the real letter. Glowworm needs our help with his lamps!" } },
        // no buddy (on the near sandy path just right of Echo, not placed)
        { art: "s03", ages: "both", buddy: null,
          line: { big: "Into the Mushroom Woods we go. Hello, Glowworm! Rabbit and Hedgehog are here for the lantern walk too.",
                  little: "Hello, Glowworm! Hello, Rabbit and Hedgehog!" } },
        // no buddy (on the sandy path just right of Echo, not placed)
        { art: "s04", ages: "big", buddy: null,
          line: "Every evening, Glowworm leads a walk down the lamp path to the big lantern, to hear the crickets sing." },
        // no buddy (on the near sandy path just right of Echo, not placed)
        { art: "s05", ages: "both", buddy: null,
          line: { big: "Oh dear, Glowworm has the hiccups. And every hiccup makes him hop! Hic, hop! Hic, hop!",
                  little: "Glowworm has the hiccups! Hic, hop! Hic, hop!" } },
        // no buddy (on the near sandy path in the lower right of the middle, just right of Echo and apart from the heap of cords, not placed)
        { art: "s06", ages: "both", buddy: null,
          line: { big: "He hopped right into the lamp cords. Pop, pop, pop! Now every plug is out, and the lamps won't light.",
                  little: "He hopped on the cords. Pop, pop, pop! Out came the plugs. The lamps won't light!" } },
        // no buddy
        { art: "s07", ages: "big", buddy: null,
          line: "Every light needs two cords. One takes the power in, one brings it back. Then flip the switch. Click!" },
        // no buddy (on the near sandy path just right of Echo, not placed)
        { art: "s08", ages: "both", buddy: null,
          line: { big: "Let's plug in every cord and flip every switch, lamp by lamp, right up to the big lantern. Ready?",
                  little: "Let's plug in the cords and switch on the lamps. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Click! The great big lantern glows gold. Every lamp shines, and the stepping stones glow like little moons!",
                  little: "Click! The big lantern glows. Every lamp is shining!" } },
        // buddy: the empty tree-stump seat just right of Echo, with a plain soft cushion on it and nothing else (sit)
        { art: "e02", ages: "big", buddy: { x: 0.862, y: 0.612, h: 0.17, pose: "sit" },
          line: "Glowworm leads the walk down the shining path. Then we all sit and listen to the crickets. Chirp, chirp!" },
        // no buddy
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Pelly's carrot was for Rabbit all along! Crunch, crunch. And Glowworm's hiccups are almost gone... hic!",
                  little: "Pelly's carrot was for Rabbit! Crunch, crunch!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "Goodnight, Glowworm! Now there are eight gold stars on our helper map." }
      ]
    },

    // Day 9: All Aboard for Snowdrop Valley.
    trainline: {
      wash: "#a9cbe0",
      intro: [
        // buddy: on the doorstep to the right of Echo, right of the door (rest)
        { art: "s01", ages: "both", buddy: { x: 0.505, y: 0.679, h: 0.18, pose: "rest" },
          line: "Pelly lands on the doorstep with a letter. Oops. That's a fuzzy red mitten! Pelly, it isn't even snowing here." },
        // no buddy (PEEK, not placed)
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. It's from Hare in snowy Snowdrop Valley. She needs help with her brand-new train!",
                  little: "Here's the real letter. It's from Hare, out in the snow!" } },
        // no buddy (on the open snow just left of Echo, well below the coach and Frog, not placed)
        { art: "s03", ages: "both", buddy: null,
          line: { big: "Hare and Frog are the train crew. Here's their shiny new train. But look! There are no tracks!",
                  little: "Hare and Frog have a shiny new train. But it has no tracks!" } },
        // no buddy (on the snow just right of Echo, not placed)
        { art: "s04", ages: "big", buddy: null,
          line: "Hare and Frog polished the train all week. They forgot the tracks! They're still on the cart, under the snow." },
        // no buddy (on the front of the platform just right of Echo, not placed)
        { art: "s05", ages: "both", buddy: null,
          line: { big: "Squirrel wants to go sledding. Baker Badger has a day off and wants a nap. The duck family wants a swim!",
                  little: "Squirrel, Badger and the duck family all need a ride!" } },
        // no buddy (on the plain snow just right of Echo, in front of the snowdrift and well below it, not placed)
        { art: "s06", ages: "both", buddy: null,
          line: { big: "Frog gave Badger a ride home on his back. One hop, two hops, plop! They landed in a snowdrift, giggling.",
                  little: "Frog gave Badger a ride. One hop, two hops, plop! Into the snow!" } },
        // no buddy
        { art: "s07", ages: "big", buddy: null,
          line: "Every stop has a picture sign. A sled for the hill, a little house for Badger, and a duck for the pond." },
        // no buddy (on the plain snow just right of Echo, not placed)
        { art: "s08", ages: "both", buddy: null,
          line: { big: "Let's lay the tracks and drive everyone to their stop. Then Hare and Frog get a ride too. Ready?",
                  little: "Let's build the tracks and give everyone a ride. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Ding, ding! Everyone is at their stop. And Hare and Frog got their ride too, round the valley and home!",
                  little: "Ding, ding! Everyone got a ride on the train!" } },
        // no buddy
        { art: "e02", ages: "big", buddy: null,
          line: "Down the hill zooms Squirrel! Badger waves from his door in his slippers, and the ducklings paddle in the pond." },
        // no buddy (on the front of the platform just right of Echo, not placed)
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Hot cocoa and cookies at the station! And here comes Pelly, wearing that red mitten as a cozy hat.",
                  little: "Look! Pelly is wearing the mitten as a hat!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "The whole valley can ride the train now. Nine gold stars on our helper map!" }
      ]
    },

    // Day 10: The Hilltop Patchwork Kite.
    kite: {
      wash: "#8cc3e3",
      intro: [
        // buddy: on the doorstep to the right of Echo, right of the door (rest)
        { art: "s01", ages: "both", buddy: { x: 0.45, y: 0.72, h: 0.19, pose: "rest" },
          line: "Pelly sails in on the breeze with a letter. Oops. That's an umbrella! How did it ever fit in her pouch?" },
        // buddy: peeking over the stretch of the railing's top edge just right of Echo, with nothing behind it but the background, so a little character can peek over the railing there (peek)
        { art: "s02", ages: "both", buddy: { x: 0.385, y: 0.6, h: 0.14, pose: "peek" },
          line: { big: "Here's the real letter. It's from Goat on Breezy Hill. His giant kite needs our help!",
                  little: "Here's the real letter. Goat's giant kite needs our help!" } },
        // buddy: on the grass just right of Echo, nearer the front than Goat and apart from him (rest)
        { art: "s03", ages: "both", buddy: { x: 0.56, y: 0.825, h: 0.2, pose: "rest" },
          line: { big: "Up on windy Breezy Hill, Goat shows us his giant kite. All his friends painted pictures for it!",
                  little: "Goat shows us his giant kite. His friends painted pictures for it!" } },
        // no buddy (on the grass just right of Echo, nearer the front than the rock, not placed)
        { art: "s04", ages: "big", buddy: null,
          line: "Lamb painted a flower for the kite. And Beetle painted a picture of herself!" },
        // no buddy
        { art: "s05", ages: "both", buddy: null,
          line: { big: "But the pictures aren't sewn on yet. Whoosh! Every time the wind blows, up they flip and flap.",
                  little: "The pictures aren't sewn on. Whoosh! Up they flap!" } },
        // buddy: on the grass just right of Echo, nearer the front than Goat and apart from him (rest)
        { art: "s06", ages: "both", buddy: { x: 0.47, y: 0.85, h: 0.2, pose: "rest" },
          line: { big: "Goat grabbed a needle to sew them on. But that's tricky with hooves! Now he's wrapped up like a present.",
                  little: "Sewing is tricky with hooves. Goat is all tangled up!" } },
        // no buddy
        { art: "s07", ages: "big", buddy: null,
          line: "A kite's tail has to hang even. Too many bows on one side, and it tips over! Spread them out, and it flies straight." },
        // buddy: on the grass just right of Echo, nearer the front than Goat and apart from him (rest)
        { art: "s08", ages: "both", buddy: { x: 0.61, y: 0.855, h: 0.19, pose: "rest" },
          line: { big: "Let's sew every picture in its place, thread the ribbons, balance the tail and fly the kite. Ready?",
                  little: "Let's sew on the pictures, add the ribbon tail and fly! Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // buddy: on the grass just right of Echo (cheer)
        { art: "e01", ages: "both", buddy: { x: 0.87, y: 0.815, h: 0.19, pose: "cheer" },
          line: { big: "Look at it go! Up goes the patchwork kite, straight and steady, with every picture flying high!",
                  little: "Up goes the kite! Every picture is flying!" } },
        // no buddy (on the grass just right of Echo, apart from the rock, not placed)
        { art: "e02", ages: "big", buddy: null,
          line: "Lamb waves up at her flower. And Beetle waves up at herself, flying high!" },
        // buddy: on the grass just right of Echo, far below Pelly and the kite (cheer)
        { art: "e03", ages: "both", buddy: { x: 0.775, y: 0.79, h: 0.18, pose: "cheer" },
          line: { big: "Pelly comes to watch. Pop! Her umbrella opens, and the breeze lifts her up like a kite. Hold on, Pelly!",
                  little: "Pop! Pelly's umbrella opens. Up she floats like a kite!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "Hooray for Goat's kite, and for ten gold stars on our helper map!" }
      ]
    },

    // Day 11: The Sandstone Nest Lift.
    nestlift: {
      wash: "#d99a62",
      intro: [
        // no buddy (on the doorstep to the right of Echo, right of the door, not placed)
        { art: "s01", ages: "both", buddy: null,
          line: "Pelly has the mail! Oops. That's a wooden spoon. Are you making soup, Pelly?" },
        // no buddy (PEEK, not placed)
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. It's from Mama Swallow. Her family is moving into new nests on a cliff!",
                  little: "Here's the real letter. Mama Swallow is moving into new nests!" } },
        // no buddy (on the sand just right of Echo, at the foot of the cliff, not placed)
        { art: "s03", ages: "both", buddy: null,
          line: { big: "This is Sandstone Cliff, with little round nests all the way up. Mama Swallow and her chicks wave hello!",
                  little: "Look! Mama Swallow and her three chicks. Their new nests are way up high!" } },
        // no buddy
        { art: "s04", ages: "both", buddy: null,
          line: { big: "Uh-oh! The blankets and toys are all bundled up, and the bundles can't squeeze up the little cliff stairs.",
                  little: "Oh no! The blankets and toys are too big for the stairs!" } },
        // no buddy (on the sand just right of Echo, not placed)
        { art: "s05", ages: "both", buddy: null,
          line: { big: "Mama Swallow took off with the enormous quilt. Flap, flap, flop! Down it came, and now it's a quilt with feet.",
                  little: "Flap, flap, flop! The big quilt fell on Mama Swallow. A quilt with feet!" } },
        // no buddy
        { art: "s06", ages: "big", buddy: null,
          line: "Each chick wants its own toy in bed tonight. A rabbit, a teddy bear, and a very, very long snake!" },
        // no buddy (on the sand just right of the post's foot, not placed)
        { art: "s07", ages: "big", buddy: null,
          line: "Here's the basket lift! A bundle in one basket, stones with just as many dots in the other. Then up it goes!" },
        // no buddy (on the sand between Echo and the flat rock with the stones, not placed)
        { art: "s08", ages: "both", buddy: null,
          line: { big: "Let's balance each bundle with stones, wind it up, up, up, and pop it into its nest. Ready?",
                  little: "Here's a basket lift! Let's carry the blankets and toys up to the nests. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Swoosh! The enormous quilt slides right into the top nest. Every nest has its bundle!",
                  little: "Swoosh! The big quilt fits in the top nest!" } },
        // no buddy (on the picnic cloth in the lower middle, just in front of the pot, between the chicks and Echo, not placed)
        { art: "e02", ages: "big", buddy: null,
          line: "Soup's on! Pelly stirs berry soup with her wooden spoon. So that's what it was for!" },
        // no buddy
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Bedtime! Each chick snuggles in its own nest with its toy. And up top, Mama Swallow is a quilt with feet again!",
                  little: "Bedtime! Each chick hugs its toy in its own nest. And look, a quilt with feet!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "Eleven gold stars on our helper map! Every chick is snug in its new nest." }
      ]
    },

    // Day 12: The Lily-Pad Concert.
    concert: {
      wash: "#6fb39b",
      intro: [
        // buddy: on the doorstep to the right of Echo, right of the door (rest)
        { art: "s01", ages: "both", buddy: { x: 0.485, y: 0.708, h: 0.18, pose: "rest" },
          line: "Hello, Pelly! Is that a letter? Oops. That's a sandwich. One bite is already gone!" },
        // no buddy (PEEK, not placed)
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. It's from our friend Frog. The pond concert is today, but his band can't get started!",
                  little: "Here's the real letter. Frog's band needs our help with their concert!" } },
        // no buddy (on the mossy bank just right of Echo, not placed)
        { art: "s03", ages: "both", buddy: null,
          line: { big: "At Lily Pond, here's Frog with his band! He has a drum, Newt has a reed harp, and Duck has two little bells.",
                  little: "Here's the pond band! Frog has a drum, Newt has a harp, and Duck has bells." } },
        // no buddy (on the wide flat mossy stone just right of Echo, not placed)
        { art: "s04", ages: "big", buddy: null,
          line: "Each one knows a lovely tune. Boom, boom goes the drum. Plink, plonk go the reeds. Ding, ding go the bells!" },
        // no buddy (on the near mossy bank just right of Echo, not placed)
        { art: "s05", ages: "both", buddy: null,
          line: { big: "Nobody knows who goes first, so they all play at once. Boom, plink, ding! A bunny and a mouse cover their ears.",
                  little: "They all play at once. Boom, plink, ding! Oh dear, what a mix-up!" } },
        // no buddy (on the front of the lily pad just right of Echo, not placed)
        { art: "s06", ages: "both", buddy: null,
          line: { big: "And Newt's curly tail keeps plucking the reeds all by itself. Plink, plonk! Oops, silly tail!",
                  little: "And Newt's silly tail keeps plucking her harp. Plink, plink!" } },
        // no buddy
        { art: "s07", ages: "big", buddy: null,
          line: "Everyone needs their own seat, with room to play. Then a conductor waves a hand to show who goes next!" },
        // buddy: on the front of the lily pad just right of Echo (cheer)
        { art: "s08", ages: "both", buddy: { x: 0.735, y: 0.675, h: 0.17, pose: "cheer" },
          line: { big: "Let's play their tunes, give each one a seat, pick who goes first, and be the conductor. Ready?",
                  little: "Let's play their music and help them play together. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Everyone takes a turn, and the band plays one lovely song together. The last note floats across the pond.",
                  little: "Everyone takes a turn. What a lovely song!" } },
        // no buddy
        { art: "e02", ages: "big", buddy: null,
          line: "The bunny and the mouse pat the water. Splish, splash! And this time, nobody covers their ears." },
        // no buddy (on the mossy bank just right of Echo, in front of the row, not placed)
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Pelly shares her sandwich with the band. And Newt's tail plays one last plink, right on time!",
                  little: "Pelly shares her sandwich. And Newt's tail goes plink!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: { big: "Take a bow, conductor! That's twelve gold stars on our helper map.",
                  little: "Take a bow! That's twelve gold stars on our helper map." } }
      ]
    },

    // Day 13: Seeds Across the Rooftops.
    rooftops: {
      wash: "#8cc0dc",
      intro: [
        // buddy: on the doorstep to the right of Echo, right of the door (rest)
        { art: "s01", ages: "both", buddy: { x: 0.44, y: 0.715, h: 0.18, pose: "rest" },
          line: "Knock, knock! It's Pelly with a letter. Oops. That's a pancake, with butter on top! Silly Pelly." },
        // buddy: peeking over the stretch of the railing's top edge just right of Echo, with nothing behind it but the background, so a little character can peek over the railing there (peek)
        { art: "s02", ages: "both", buddy: { x: 0.365, y: 0.655, h: 0.115, pose: "peek" },
          line: { big: "Here's the real letter. It's from Gardener Bird. Her rooftop gardens need seeds, and lots of them!",
                  little: "Here's the real letter. Gardener Bird has seeds to plant!" } },
        // buddy: on the cobbled lane just right of Echo (rest)
        { art: "s03", ages: "both", buddy: { x: 0.65, y: 0.805, h: 0.21, pose: "rest" },
          line: { big: "Off we go to the hilltop town! Every rooftop has a planter full of soil. But nothing is growing.",
                  little: "Look at all the rooftop pots. Lots of soil, but no plants!" } },
        // no buddy (on the cobbles just right of Echo, not placed)
        { art: "s04", ages: "both", buddy: null,
          line: { big: "The seed pods are too heavy for Gardener Bird to fly up. And her cart gets stuck at the narrow stairs. Bump!",
                  little: "The seed cart gets stuck at the skinny stairs. Bump!" } },
        // no buddy (on the cobbles just right of Echo, not placed)
        { art: "s05", ages: "both", buddy: null,
          line: { big: "Gardener Bird loves watering so much, she waters everything. The stairs, the cart, and us! Sprinkle!",
                  little: "Gardener Bird waters everything. Even us! Sprinkle, sprinkle!" } },
        // no buddy (on the cobbles just right of Echo, not placed)
        { art: "s06", ages: "big", buddy: null,
          line: "Beside the cart stands a springboard for seed pods. Pop one in the cup, pull the spring, and boing! Up it flies." },
        // no buddy
        { art: "s07", ages: "big", buddy: null,
          line: "One planter hides under a little roof. So we bounce a pod off the striped awning. Boing, plop!" },
        // no buddy (on the cobbles just right of Echo, not placed)
        { art: "s08", ages: "both", buddy: null,
          line: { big: "Let's aim the springboard, send a seed pod to every rooftop planter, and make the old arch bloom. Ready?",
                  little: "Boing! This springboard sends seeds up high. Let's fill every rooftop pot. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "Plop! Every seed is planted. Green leaves on every rooftop, and flowers all over the old arch!",
                  little: "Plop! Green leaves and flowers on every rooftop!" } },
        // buddy: on the terrace just right of Echo (cheer)
        { art: "e02", ages: "big", buddy: { x: 0.645, y: 0.82, h: 0.19, pose: "cheer" },
          line: "Gardener Bird loops through the flowery arch, watering every new plant. Quick, a leaf umbrella!" },
        // no buddy (on the terrace just right of Echo, in front of the table, not placed)
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Out of Pelly's pouch comes a whole stack of pancakes! A rooftop picnic for everyone. Yum!",
                  little: "Pelly brought pancakes for everyone. Yum!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "A garden on every rooftop, and thirteen gold stars on our helper map!" }
      ]
    },

    // Day 14: The Moving-Star Observatory.
    observatory: {
      wash: "#c4945a",
      intro: [
        // no buddy (on the doorstep to the right of Echo, right of the door, not placed)
        { art: "s01", ages: "both", buddy: null,
          line: "Pelly brought us another letter! Oops. That's a fluffy slipper. Pelly, you don't wear slippers!" },
        // no buddy (PEEK, not placed)
        { art: "s02", ages: "both", buddy: null,
          line: { big: "Here's the real letter. It's from Owl at the Moving-Star Observatory. Her stars have stopped moving!",
                  little: "Here's the real letter, from Owl. Her stars are stuck!" } },
        // no buddy (on the stone path just right of Echo, not placed)
        { art: "s03", ages: "both", buddy: null,
          line: { big: "Owl opens the round doors in just one fluffy slipper. So that's whose it is! Here you go, Owl.",
                  little: "Owl has one fluffy slipper on. Here's the other one!" } },
        // no buddy
        { art: "s04", ages: "big", buddy: null,
          line: "Owl sleeps all day, so now it's her breakfast time. At night! Good morning, Owl!" },
        // buddy: on the honey-wood floor just right of Echo (rest)
        { art: "s05", ages: "both", buddy: { x: 0.53, y: 0.865, h: 0.155, pose: "rest" },
          line: { big: "After breakfast, look at Owl's wooden sky! A painted sun, a silver moon and a ring of golden stars.",
                  little: "Look up! A wooden sun, a moon and lots of stars." } },
        // buddy: on the honey-wood floor just right of Echo, in front of the left end of the platform (rest)
        { art: "s06", ages: "both", buddy: { x: 0.455, y: 0.795, h: 0.17, pose: "rest" },
          line: { big: "Tonight is the Sky Show. Owl turns the big wheel, but nothing moves. The gears are still in their tray!",
                  little: "Owl turns the big wheel. Nothing moves! The gears are in a pile." } },
        // no buddy
        { art: "s07", ages: "big", buddy: null,
          line: "Owl shows us the trick. Too small, a gear can't reach. Too big, it squeezes! Just right, round they go." },
        // no buddy (on the left part of the platform, just left of Echo, not placed)
        { art: "s08", ages: "both", buddy: null,
          line: { big: "Let's fit the gears and turn the big wheel, so the sun, moon and stars move again. Ready?",
                  little: "Let's fit the gears and turn the wheel. Ready?" } }
      ],
      go: "Let's go!",
      ending: [
        // no buddy
        { art: "e01", ages: "both", buddy: null,
          line: { big: "The sun goes up, the moon goes round, and the stars spin. And the roof opens to the real stars!",
                  little: "The sun goes up, and the moon and stars go round!" } },
        // no buddy
        { art: "e02", ages: "big", buddy: null,
          line: "Look at the little pictures going round! A boat, a bridge, a flower and a kite. Just like our adventures!" },
        // no buddy (on the honey-wood floor just right of Owl, not placed)
        { art: "e03", ages: "both", buddy: null,
          line: { big: "Everyone comes to the Sky Show. And Owl dances under the stars in both fluffy slippers!",
                  little: "Owl dances in her two fluffy slippers. Shuffle, shuffle!" } },
        // no buddy (the right half of the bench, just right of Echo, not placed)
        { art: "e04", ages: "both", buddy: null,
          line: "Fourteen gold stars on our helper map, all shining bright. What a helper you've been!" }
      ]
    }
  };
})(window);
