// Every Say & Play game, in the order Home lists them.
import { LITTLE } from "./little.mjs";
import { BIG } from "./big.mjs";
export const GAMES = [...LITTLE, ...BIG];

// Home cards drawn by hand, as [key, picture]: cards.mjs writes only the
// sticker's pointer for these and never a picture over them. Hoops and Soccer
// Goal are real games now (public/hoops.js, public/soccer.js), not scenes, so
// each card is a frame of its own court or pitch, drawn once. A key may be here and in GAMES at once (a scene game whose new
// Home tile has landed): its page is still built, its card is not, and until
// the key is added here cards.mjs refuses to run over the new tile. It lives
// here, not in cards.mjs, because cards.mjs writes files the moment it is
// imported and tests/arttooltest.mjs needs to read the list.
export const PLAYED = [["hoops", "/assets/games/hoops.webp"], ["soccer", "/assets/games/soccer.webp"]];
