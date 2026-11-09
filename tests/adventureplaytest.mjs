// STORY1: the story's player (/adventure.html): entitlement before any
// sound, the website waits for a tap, the app plays as media, ages 3-4's
// scenes, sound off, Skip, "Let's go!", the ending and its sticker (and the
// game it left on Home, FOUND1), interruptions, the recorded voice, the
// buddy and its spots on every painted page at a phone, Reduce Motion, the
// fit, and nothing written but seen.
//
// Its own suite because tests/adventuretest.mjs, whole, takes about 290 s of
// run-all's 300 s a suite (23 Oct 2026, with fourteen stories). This file
// only picks the parts; the harness, the checks and the scenarios all live in
// adventuretest.mjs. The buddy's spots at an iPad are
// tests/adventurespotstest.mjs.
// Every part but the iPad's spots, so a part added to adventuretest.mjs
// later runs here without anyone having to list it.
process.env.ADVENTURE_PART = "!buddy spots ipad";
await import("./adventuretest.mjs");
