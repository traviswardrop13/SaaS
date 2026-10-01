// The fuller books whose pictures are drawn by hand, not built here. build.mjs
// never writes into these folders and refuses to run if one of them is also in
// books1.mjs or books2.mjs; tests/arttooltest.mjs fails the same way. It is its
// own module, with no side effects, because build.mjs writes files the moment
// it is imported, so a test can only read the list from here.
//
// Rory and the Rainbow was drawn on the Claude Design canvas. The rest are due
// to be redrawn (the family's 28 Sep 2026 brief), one book at a time: when a
// book's new art lands in public/assets/books/<slug>/, add the slug here AND
// delete its entry from books1.mjs or books2.mjs in the same commit, the way
// Hoops left tools/gameart/big.mjs when it was rebuilt by hand. Until then the
// builder refuses that folder rather than write old pictures beside the new.
export const HANDMADE = ["rory-rainbow", "sid-the-seagull", "shay-the-shy-shark"];
