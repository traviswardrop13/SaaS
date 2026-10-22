// BRIDGE1: Puzzle Bridge with a fox child and a dragon child (the buddy, and a
// picture that will not load), the fit from a 320 px phone to an iPad (every
// hole and stone big enough, the camera inside the painting), the drawn
// stand-ins with every picture blocked, and keyboard play: the rest of
// tests/bridgetest.mjs's parts.
//
// Its own suite for the same reason as tests/bridgeplaytest.mjs. This file
// only picks the parts; everything else lives in bridgetest.mjs.
process.env.BRIDGE_PART = "buddy,fit,standins,keyboard";
await import("./bridgetest.mjs");
