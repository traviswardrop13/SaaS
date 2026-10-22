// LIGHTHOUSE1: Light the Way's help ladder, for both ages (the "struggle"
// part of tests/lighthousetest.mjs): it climbs with seconds of the finger
// searching or with decoys lit, never with waiting, resets with each word,
// and every step still ends with the boat home and no more speaking.
//
// Its own suite for the same reason as tests/lighthouseplaytest.mjs: the
// whole file outgrows run-all's five minutes a suite. This file only picks
// the part; everything else lives in lighthousetest.mjs.
process.env.LIGHTHOUSE_PART = "struggle";
await import("./lighthousetest.mjs");
