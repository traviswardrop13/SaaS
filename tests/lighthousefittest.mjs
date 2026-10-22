// LIGHTHOUSE1: Light the Way fits 320x568, 375x667, 390x844 and 768x1024: no
// page scroll, both buttons on screen and at least 44 px, every boat, decoy
// and window on the visible sea, the moon in sight, and the light riding above
// a finger (on a mouse pointer) so a finger never covers what it shows (the
// "fit" part of tests/lighthousetest.mjs).
//
// Its own suite for the same reason as tests/lighthouseplaytest.mjs. This file
// only picks the part; everything else lives in lighthousetest.mjs.
process.env.LIGHTHOUSE_PART = "fit";
await import("./lighthousetest.mjs");
