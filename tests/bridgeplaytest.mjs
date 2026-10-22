// BRIDGE1: Puzzle Bridge, the game inside Day 3 of the daily story (STORY1,
// 22 Oct 2026), for ages 5-8: the word calls a stone up, a tap turns it and a
// drag slides it, the wrong way up is a miss and a drop away from its hole is
// not, the river rises at word 5, the help ghost, arrow and snap, the camera
// pulls back at the end, and the end card hands to the story's ending. Also a
// locked phone sent Home before any mic or sound, and every shape's turns.
//
// Its own suite because tests/bridgetest.mjs, whole, takes about 200 s of
// run-all's 300 s a suite on a quiet machine. This file only picks the parts;
// the harness, the checks and the scenarios all live in bridgetest.mjs.
process.env.BRIDGE_PART = "locked,shapes,main,tapdrag,struggle";
await import("./bridgetest.mjs");
