// BRIDGE1: Puzzle Bridge with a fox child and a dragon child (the buddy, and a
// picture that will not load), the fit from a 320 px phone to an iPad (every
// hole and stone big enough, the camera inside the painting), the drawn
// stand-ins with every picture blocked, keyboard play, and the game played
// again from Home's row (FOUND1: Play again starts a clean round, no stone
// seated, the river down and the camera back on the first gap, played to its
// own end card, and Back home goes Home): the rest of tests/bridgetest.mjs's
// parts.
//
// Its own suite for the same reason as tests/bridgeplaytest.mjs. This file
// only picks the parts; everything else lives in bridgetest.mjs.
process.env.BRIDGE_PART = "buddy,fit,standins,keyboard,replay";
await import("./bridgetest.mjs");
