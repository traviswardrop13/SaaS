// BRIDGE1: Puzzle Bridge for ages 3-4 (two holes open, the stone the right
// way round, a bounce back from the wrong hole), Calm river (the help pill),
// and Reduce Motion (nothing slides or spins): three of tests/bridgetest.mjs's
// parts.
//
// Its own suite for the same reason as tests/bridgeplaytest.mjs. This file
// only picks the parts; everything else lives in bridgetest.mjs.
process.env.BRIDGE_PART = "little,help,motion";
await import("./bridgetest.mjs");
