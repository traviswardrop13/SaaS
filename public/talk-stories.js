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
           tests/talktest.mjs holds every one to it).
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
    }
  };
})(this);
