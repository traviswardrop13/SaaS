// The games' quiet rules on Sona's own mic (12 Oct 2026): micquietgamestest's
// scenarios again inside the iPhone app, where the page hears the phone's own
// mic (tests/_nativemic.mjs) instead of capturing with getUserMedia. The five
// round games' keep-playing card, a lock while its mic is still being asked
// for, backgrounding the card and a refused mic, under the same audit:
// nothing plays into a live mic, every mic closes, never the web mic.
//
// Its own suite because micquietgamestest.mjs with both mics in it outgrows
// run-all's five minutes a suite. This file only picks the part; the
// harness, the checks and the scenarios all live in micquietgamestest.mjs.
process.env.MICQUIET_MIC = "own";
await import("./micquietgamestest.mjs");
