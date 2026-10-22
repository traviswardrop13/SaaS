// DINOS1: Dino Dig's four dinosaurs (Travis, 1 Oct 2026: "i want to build
// different types of dinosaurs to look for not just one"). T. rex,
// Triceratops, Stegosaurus and Brontosaurus are each dug, with a finger, to
// their own finale: eight bones of their own, their own places in the pit,
// their own colour when they wake. A child digs them in order, a new one each
// round and round again after the last; the start card names the one to look
// for, the end card the one found, and both show the collection with no count;
// a brother or sister starts at the first; a dinosaur left half dug is not
// found; a phone that will not save still moves on to the next one. Nothing
// here is practice data.
//
// Its own suite for the same reason as tests/playgamestest.mjs: with these
// digs added, that file would outgrow run-all's five minutes a suite. This
// file only picks the part; the harness, the checks and the scenarios all live
// in sayplaytest.mjs.
process.env.SAYPLAY_PART = "dinos";
await import("./sayplaytest.mjs");
