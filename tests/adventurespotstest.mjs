// STORY1: the buddy on the story's real painted pages at an iPad (768x1024):
// on every boxed scene of every story, intro and ending, it stands exactly on
// its spot, in its own pose, clear of the caption card, Echo's face and every
// button (the "buddy spots ipad" part of tests/adventuretest.mjs; the phone's
// are in tests/adventureplaytest.mjs).
//
// Its own suite for the same reason as tests/adventureplaytest.mjs. This
// file only picks the part; everything else lives in adventuretest.mjs.
process.env.ADVENTURE_PART = "buddy spots ipad";
await import("./adventuretest.mjs");
