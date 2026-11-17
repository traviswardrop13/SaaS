// WINDUP1 / FOUND1: Wind-Up Toys played again from Home's row (?again=1), for
// a child whose stories are all finished: a whole round to the end card, which
// has Play again and Back home; Play again starts a clean round (no toy awake,
// the parade gone, the cuckoo and the music box's doors shut), which is played
// through to its own end card; Back home goes Home; neither round changes the
// story record (the "replay" part of tests/winduptest.mjs).
//
// Its own suite because tests/winduptest.mjs, whole, already takes about 170 s
// of run-all's 300 s a suite, and this part two rounds more. This file only
// picks the part; everything else lives in winduptest.mjs.
process.env.WINDUP_PART = "replay";
await import("./winduptest.mjs");
