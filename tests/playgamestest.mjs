// PLAYGAMES1: the Say & Play games rebuilt to be PLAYED, each played through
// on the Say & Play harness: Hoops (26 Sep 2026), Soccer Goal and Dino Dig
// (1 Oct 2026). Only a voice earns the move, the finger plays it, a miss never
// costs a word, the help grows until every round ends on a win, a pause holds
// the move, and nothing is written as practice.
//
// They are their own suite because tests/sayplaytest.mjs, with every rebuilt
// game in it, outgrew run-all's five minutes a suite. This file only picks the
// part; the harness, the checks and the scenarios all live in sayplaytest.mjs.
process.env.SAYPLAY_PART = "play";
await import("./sayplaytest.mjs");
