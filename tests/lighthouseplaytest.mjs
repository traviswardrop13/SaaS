// LIGHTHOUSE1: Light the Way, the game inside Day 1 of the daily story
// (STORY1, 22 Oct 2026), played through: the word lights the lamp, the finger
// holds the light on each lost boat, the town's windows light last, and the
// end card hands to the story's ending with no Play again. Also a locked
// phone sent Home before any mic or sound, Bright beam, the buddy, the drawn
// stand-ins, the keyboard, and the painted sea's own pixels (the art part).
//
// Its own suite because tests/lighthousetest.mjs, whole, takes about 260 s of
// run-all's 300 s a suite. This file only picks the parts; the harness, the
// checks and the scenarios all live in lighthousetest.mjs.
process.env.LIGHTHOUSE_PART = "locked,main,help,buddy,keyboard,standins,art";
await import("./lighthousetest.mjs");
