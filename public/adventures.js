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
    }
  };
})(window);
