// REPGUARD1 on Sona's own mic (13 Oct 2026): repguardtest's non-speech
// fixtures, its loud rooms and two recorded targets, inside the iPhone app,
// where the page hears the phone's own mic (tests/_nativemic.mjs) with no
// noise suppression and no auto gain. Silence, a tone, clicks, claps, a
// breath, a hum and a room too loud to be a room are never a try there
// either, and a real R and S still are.
//
// Its own suite because repguardtest.mjs with both mics in it outgrows
// run-all's five minutes a suite. This file only picks the part; the
// harness, the checks and the scenarios all live in repguardtest.mjs.
process.env.REPGUARD_MIC = "own";
await import("./repguardtest.mjs");
