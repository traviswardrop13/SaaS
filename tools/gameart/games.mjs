// Every Say & Play game, in the order Home lists them.
import { LITTLE } from "./little.mjs";
import { BIG } from "./big.mjs";
export const GAMES = [...LITTLE, ...BIG];

// Home cards drawn by hand, as [key, picture]: cards.mjs writes only the
// sticker's pointer for these and never a picture over them. Hoops, Soccer
// Goal and Dino Dig are real games now (public/hoops.js, soccer.js, dino.js),
// not scenes, so each card is a frame of its own court, pitch or dig, drawn once. A key may be here and in GAMES at once (a scene game whose new
// Home tile has landed): its page is still built, its card is not, and until
// the key is added here cards.mjs refuses to run over the new tile. It lives
// here, not in cards.mjs, because cards.mjs writes files the moment it is
// imported and tests/arttooltest.mjs needs to read the list.
export const PLAYED = [["hoops", "/assets/games/hoops.webp"], ["soccer", "/assets/games/soccer.webp"], ["dino", "/assets/games/dino.webp"], ["racecar", "/assets/crafted/home-racecar.webp"], ["treasure", "/assets/crafted/home-treasure.webp"], ["robot", "/assets/crafted/home-robot.webp"], ["balloon", "/assets/crafted/home-balloon.webp"], ["flower", "/assets/crafted/home-flower.webp"], ["castle", "/assets/crafted/home-castle.webp"], ["pizza", "/assets/crafted/home-pizza.webp"], ["space", "/assets/crafted/home-space.webp"], ["monster", "/assets/crafted/home-monster.webp"], ["rocket", "/assets/crafted/home-rocket.webp"], ["snowman", "/assets/crafted/home-snowman.webp"], ["train", "/assets/crafted/home-train.webp"], ["puppy", "/assets/crafted/home-puppy.webp"], ["stars", "/assets/crafted/home-stars.webp"], ["cake", "/assets/crafted/home-cake.webp"], ["gifts", "/assets/crafted/home-gifts.webp"], ["fishtank", "/assets/crafted/home-fishtank.webp"]];
