// BUBBLES1: Bubble Pop, rebuilt to be played (Travis, 1 Oct 2026: "yeah B":
// "Say it, and Echo blows bubbles"), played through on the Say & Play harness.
// The word blows the bubbles and the finger pops them; silence blows none; the
// gold one drops the word's picture into the basket; the help grows until
// every round ends; a pause holds the same bubbles; five words and one giant
// bubble win; in the iPhone app the pops are media; a slow microphone and a
// page hidden at the wrong moment lose nothing; and nothing is practice.
//
// Its own suite for the reason tests/playgamestest.mjs is one: Hoops, Soccer
// Goal and Dino Dig already take most of run-all's five minutes a suite, and
// this is about two and a half more. This file only picks the part; the
// harness, the checks and the scenarios all live in sayplaytest.mjs.
process.env.SAYPLAY_PART = "bubbles";
await import("./sayplaytest.mjs");
