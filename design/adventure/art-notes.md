# The daily stories' art: notes and numbers (STORY1, 22 Oct 2026)

Everything here was drawn by the image model (`chatgpt-image-latest`, high
quality) through `tools/art/gen-adventure.mjs` (story pages, lineups, Home
cards) and `tools/art/gen-sprites.mjs` (the games' pieces, the `lighthouse-*`,
`windup-*` and `bridge-*` entries of `tools/art/game-sprites.json`), and cut by
`tools/art/cut-adventure.py` (ImageMagick; Days 4-14's `TOUCH` and `STARS`
also need Python's PIL and numpy). Every
picture was checked by eye; what was redrawn, and why, is in
`tools/art/out/adventure/checks.json` (git-ignored, beside the raw drawings)
and summed up at the end. `review.html` beside this file shows every page with
its line and its buddy box, for Travis and Rachel.

All numbers are fractions: x of the picture's width, y of its height, unless
a line says otherwise. The shipped files are smaller than the drawings
(story pages 800x1200 from 1024x1536), and fractions do not change with size.

## 1. The cast

`cast-lighthouse.webp`, `cast-windup.webp`, `cast-bridge.webp` (this folder)
are the lineups every page was drawn against: Echo for scale, then Pelly,
Captain Wally and the three mice (Day 1); Grandpa Bear twice (cardigan, and
striped pajamas with one slipper) and the seven toys (Day 2); Grandma
Tortoise (Day 3). Each character was drawn alone and the lineup composed
(a whole lineup in one picture merged Pelly into the walrus). Pelly's cap is
a light-blue postal cap with an envelope badge; Wally's has a gold anchor.
Days 4-14 have one lineup each, `cast-<id>.webp` (this folder), drawn the
same way: each day's new characters beside Echo.

## 2. Story pages: buddy boxes (for `adventures.js`)

`{ x, y, h, pose }`: x the buddy's middle, y the line its feet stand on, h its
height, as P3's player reads them. Each was placed with real buddy pictures
(the dragon, and the octopus, the widest) laid exactly as the player lays
them, and looked at. `null`: the scene has no spot (as the spec says).

```js
// Day 1: lighthouse
s01: { x: 0.41, y: 0.68,  h: 0.22, pose: "rest" },   // on the porch steps, LEFT of Echo (Echo took the right of the step)
s02: { x: 0.42, y: 0.60,  h: 0.15, pose: "peek" },   // peeking over the porch railing, left of Echo
s03: { x: 0.44, y: 0.80,  h: 0.19, pose: "rest" },   // on the path, left of Echo
s04: { x: 0.62, y: 0.595, h: 0.15, pose: "rest" },   // on a stair step between Wally (below) and Echo (flying above)
s05: { x: 0.55, y: 0.78,  h: 0.20, pose: "rest" },   // on the lamp-room floor by the railing, in front of the lamp
s06: null,                                            // the view out of the round window
s07: { x: 0.80, y: 0.81,  h: 0.22, pose: "cheer" },  // on the floor, right, apart from Wally
s08: { x: 0.80, y: 0.665, h: 0.20, pose: "cheer" },  // on the ledge right of the lamp (Wally's armchair is behind it)
e01: null, e02: null,
e03: { x: 0.24, y: 0.85,  h: 0.20, pose: "cheer" },  // on the floor, lower left, under Echo and Wally
e04: { x: 0.75, y: 0.81,  h: 0.22, pose: "sit" },    // on the empty cushion, right, a mug of cocoa beside it
// Day 2: windup
s01: { x: 0.44, y: 0.68,  h: 0.21, pose: "rest" },   // on the doorstep, between Pelly and Echo
s02: { x: 0.70, y: 0.64,  h: 0.25, pose: "cheer" },  // on the path, right of Echo
s03: { x: 0.74, y: 0.635, h: 0.22, pose: "rest" },   // on the cobbles, right of Echo
s04: { x: 0.56, y: 0.61,  h: 0.17, pose: "peek" },   // peeking over the wooden crate, right of Echo
s05: null, s07: null,
s06: { x: 0.60, y: 0.81,  h: 0.24, pose: "cheer" },  // on the round rug, right of Echo
s08: { x: 0.83, y: 0.74,  h: 0.22, pose: "cheer" },  // on the workbench, right of the bunny
e01: null, e03: null,
e02: { x: 0.64, y: 0.79,  h: 0.23, pose: "cheer" },  // on the cobbles, right of Echo
e04: { x: 0.76, y: 0.69,  h: 0.26, pose: "cheer" },  // on the rug, right of Echo (the hug)
// Day 3: bridge
s01: { x: 0.86, y: 0.69,  h: 0.20, pose: "rest" },   // on the doorstep, right of Echo
s02: null, s05: null, s07: null,
s03: { x: 0.74, y: 0.77,  h: 0.22, pose: "rest" },   // in the group, right of Echo
s04: { x: 0.15, y: 0.87,  h: 0.13, pose: "rest" },   // on the bank, left of Echo (everyone is small here)
s06: { x: 0.55, y: 0.585, h: 0.17, pose: "peek" },   // peeking over the flat rock, right of Echo
s08: { x: 0.17, y: 0.52,  h: 0.16, pose: "cheer" },  // on the bridge's first stones, left of Echo
e01: null, e03: null,
e02: { x: 0.76, y: 0.76,  h: 0.20, pose: "rest" },   // in the line on the bridge, behind Echo
e04: { x: 0.74, y: 0.71,  h: 0.27, pose: "cheer" },  // on the rug, right of Echo (the hug)
// Day 4: waterwheel
s01: { x: 0.515, y: 0.705, h: 0.145, pose: "rest" }, // on the top doorstep between Pelly and Echo, under the sock's toe (Echo is near the right edge, so there is no room right of him, as on Day 1)
s02: { x: 0.38, y: 0.615, h: 0.13, pose: "peek" },   // peeking over the porch railing, left of Echo, under the letter (as Day 1's s02; the railing right of Echo is too short)
s03: { x: 0.71, y: 0.755, h: 0.19, pose: "rest" },   // on the sandy path just right of Echo, feet on his foot line, clear of the droopy bed on the right
s05: { x: 0.858, y: 0.825, h: 0.18, pose: "rest" },  // on the sandy path just right of Gardener Mouse and a little in front of her, below her tail
s08: { x: 0.585, y: 0.81, h: 0.16, pose: "rest" },   // on the path at the foot of the flat stone, below the trough, between Echo and Gardener Mouse (left of Echo, Echo's wing reaches the stone's edge: no room)
e02: { x: 0.6, y: 0.78, h: 0.19, pose: "cheer" },    // on the pond's flat stone edge, right of Echo, below the splashing ducks
e03: { x: 0.875, y: 0.855, h: 0.18, pose: "cheer" }, // on the sandy path in front of and right of Echo (Echo is at the right edge, so not beside him)
e04: { x: 0.655, y: 0.685, h: 0.19, pose: "cheer" }, // on the right half of the bench, between Echo and the lamp
s04: null, s06: null, s07: null, e01: null,
// Day 5: postboat
s01: { x: 0.45, y: 0.72, h: 0.19, pose: "rest" },    // on the doorstep between Pelly and Echo, LEFT of Echo (Echo took the right of the step; the strip right of him is too narrow and cuts the octopus at the edge), as Day 1's s01
s02: { x: 0.79, y: 0.765, h: 0.21, pose: "rest" },   // on the garden path just right of Echo, below the letter
s03: { x: 0.42, y: 0.83, h: 0.19, pose: "rest" },    // on the jetty's plank deck LEFT of Echo, in front of the parcel pile (Echo stands on the right of the deck, and the strip right of him is too narrow)
s04: { x: 0.48, y: 0.795, h: 0.2, pose: "rest" },    // on the flat mossy rock just right of Echo, in front of the red boat's bow
s05: { x: 0.7, y: 0.84, h: 0.2, pose: "cheer" },     // on the jetty's plank deck, lower right, in front of the postboat's hull
s07: { x: 0.44, y: 0.745, h: 0.185, pose: "rest" },  // on the floating jetty's planks just right of Echo, in front of the raft's edge, clear of Beaver
s08: { x: 0.8, y: 0.855, h: 0.2, pose: "cheer" },    // on the near plank deck, lower right, in front of the postboat's hull (Otter is upper left)
e03: { x: 0.6, y: 0.78, h: 0.19, pose: "rest" },     // on the jetty planks just right of Echo, in front of the tea table, clear of Beaver and his tail
e04: { x: 0.7, y: 0.665, h: 0.19, pose: "cheer" },   // on the right half of the bench, right of Echo, cheering, its feet on the bench top level with his
s06: null, e01: null, e02: null,
// Day 6: bakery
s01: { x: 0.45, y: 0.685, h: 0.19, pose: "rest" },   // on the top doorstep between Pelly's fence and Echo, LEFT of Echo (Echo took the right of the step; the strip right of him is too narrow), as Day 1's s01
s02: { x: 0.372, y: 0.597, h: 0.12, pose: "peek" },  // peeking over the porch railing LEFT of Echo, under the letter (as Day 1's s02: Echo again stands right of the middle and the post is right of him)
s03: { x: 0.5, y: 0.755, h: 0.19, pose: "rest" },    // on the plain cobbles RIGHT of Echo, between him and Grandpa Bear, feet level with his (Echo stands at about a fifth of the width, so the daisies left of him leave no room on that side)
s04: { x: 0.865, y: 0.775, h: 0.165, pose: "rest" }, // on the counter top in front of and right of Echo, by the counter's front edge (right of Echo is too narrow for the octopus)
s07: { x: 0.872, y: 0.8, h: 0.17, pose: "rest" },    // on the counter top just right of Echo, at the right edge beside his wing
s08: { x: 0.88, y: 0.718, h: 0.155, pose: "rest" },  // on the front of the counter top right of the mixing bowl, in front of the blueberries (the jug and the flour cup stay in view)
e02: { x: 0.625, y: 0.66, h: 0.15, pose: "cheer" },  // on the bare counter top just right of Echo, cheering, in front of the bottom of Grandpa Bear's sweater (no bun, mouse or face covered)
e03: { x: 0.555, y: 0.765, h: 0.19, pose: "cheer" }, // on the wooden floor RIGHT of Echo, below Pelly's feet (Echo is at the left edge, nothing left of him)
e04: { x: 0.82, y: 0.666, h: 0.19, pose: "cheer" },  // on the empty right half of the bench, right of Echo, cheering, feet on the bench top level with his; its head reaches the map's lower edge below the bakery, covering no star or place
s05: null, s06: null, e01: null,
// Day 7: frontdoor
s01: { x: 0.445, y: 0.685, h: 0.18, pose: "rest" },  // on the top doorstep between Pelly's fence and Echo, LEFT of Echo (Echo took the right of the step; the strip right of him is too narrow), as Day 1's s01
s02: { x: 0.405, y: 0.625, h: 0.14, pose: "peek" },  // peeking over the porch railing's top edge LEFT of Echo, between the left post and Echo's raised wing, under the letter (Echo now stands right of the middle and fills the stretch to the right-hand post; Day 1's s02 peek is also left of Echo)
s03: { x: 0.43, y: 0.6, h: 0.16, pose: "rest" },     // on the plain sandy path just RIGHT of Echo, in the gap between Echo and Tortoise (Echo stands at the left edge, so there is no path left of him)
s04: { x: 0.565, y: 0.785, h: 0.165, pose: "rest" }, // on the plain grass just right of Echo and the dandelion leaf, a little in front of him, below Tortoise's front feet and in front of the cart
s06: { x: 0.415, y: 0.8, h: 0.18, pose: "rest" },    // on the plain grass just right of Echo, well below and left of the spinning plank
s08: { x: 0.672, y: 0.69, h: 0.15, pose: "rest" },   // on the landing's planks just right of Echo, left of the right-hand post, feet on the plank top
e01: { x: 0.2, y: 0.79, h: 0.19, pose: "cheer" },    // on the near end of the bridge's planks, in front of and left of Echo, toward the near bank
e02: { x: 0.853, y: 0.76, h: 0.19, pose: "rest" },   // on the round rug just right of Echo, in front of the chair's legs (Echo took the right of the rug)
e03: { x: 0.665, y: 0.815, h: 0.16, pose: "rest" },  // on the stone path in front, between Tortoise and Echo and a little nearer the viewer (Echo stands near the right edge, so there is no path right of him)
e04: { x: 0.64, y: 0.626, h: 0.2, pose: "cheer" },   // on the empty right half of the bench, right of Echo, feet on the bench top
s05: null, s07: null,
// Day 8: lantern
s01: { x: 0.465, y: 0.665, h: 0.19, pose: "rest" },  // on the stone landing LEFT of Echo, between the fence and Echo (Echo's right wing reaches almost to the edge, so there is no room right of him)
s02: { x: 0.42, y: 0.62, h: 0.1, pose: "peek" },     // peeking over the porch railing LEFT of Echo, under the letter (no room right of him: the post)
s03: { x: 0.69, y: 0.72, h: 0.18, pose: "rest" },    // on the plain near path right of Echo, feet level with his, clear of the dark lamp at the right edge
s04: { x: 0.195, y: 0.84, h: 0.17, pose: "rest" },   // on the near path's left edge just left of Hedgehog, feet level with hers (no room right of Echo: his wing reaches the right edge); lamp light switched off by the s04 unlight list
s05: { x: 0.695, y: 0.68, h: 0.165, pose: "rest" },  // on the near path right of Echo, feet level with his, clear of Hedgehog
s06: { x: 0.52, y: 0.79, h: 0.19, pose: "rest" },    // on the plain path right of Echo, in front of the cord heap, clear of the plugs
s08: { x: 0.385, y: 0.8, h: 0.17, pose: "rest" },    // on the plain path in front of Echo, left of him, under the cords (no room right of him)
e02: { x: 0.862, y: 0.612, h: 0.17, pose: "sit" },   // sitting on the cushion of the empty stump right of Echo (the fox, with no sit pose, stands on it)
e04: { x: 0.75, y: 0.648, h: 0.22, pose: "cheer" },  // on the empty right half of the bench, right of Echo, feet on the bench top
s07: null, e01: null, e03: null,
// Day 9: trainline
s01: { x: 0.505, y: 0.679, h: 0.18, pose: "rest" },  // on the top doorstep between Pelly's fence and Echo, LEFT of Echo (Echo's right wing nearly reaches the right edge, so there is no room right of him), as on Day 1
s02: { x: 0.365, y: 0.585, h: 0.125, pose: "peek" }, // peeking over the porch railing LEFT of Echo, between the ball-topped post and his raised wing (Echo is right of the middle and a post fills the rail right of him), as on Day 1
s03: { x: 0.185, y: 0.805, h: 0.15, pose: "rest" },  // on the open snow just left of Echo, feet level with his, well below the coach and Frog
s05: { x: 0.495, y: 0.655, h: 0.16, pose: "rest" },  // on the platform's front boards just right of Echo, inside the front edge, below the ducks
s06: { x: 0.44, y: 0.74, h: 0.19, pose: "rest" },    // on the plain snow just right of Echo, in front of and below the snowdrift
s08: { x: 0.77, y: 0.755, h: 0.19, pose: "rest" },   // on the plain snow just right of Echo and the end of his track piece
e03: { x: 0.5, y: 0.735, h: 0.175, pose: "rest" },   // use e03.keep.png (the new e03.png gives Echo four wings, two spread and two holding the cup, and still draws the bobble beanie); the buddy stands on the plain platform boards just right of Echo and his cocoa, feet level with his, in front of the round table's legs, below the cups
e04: { x: 0.72, y: 0.7, h: 0.21, pose: "cheer" },    // on the empty right half of the bench, right of Echo, feet on the bench top
s04: null, s07: null, e01: null, e02: null,
// Day 10: kite
s01: { x: 0.45, y: 0.72, h: 0.19, pose: "rest" },    // on the doorstep between Pelly's umbrella and Echo, LEFT of Echo (the step right of him is too narrow and cuts the octopus and fox at the edge), as on Day 1
s02: { x: 0.385, y: 0.6, h: 0.14, pose: "peek" },    // peeking over the porch railing's top rail LEFT of Echo, its head just under the letter's bottom edge (right of Echo is only the corner post at the picture's edge), as on Day 1's s02
s03: { x: 0.56, y: 0.825, h: 0.2, pose: "rest" },    // on the grass right of Echo, in front of the basket of cloth pictures and nearer the front than Goat (any higher and it covers the basket)
s04: { x: 0.79, y: 0.715, h: 0.18, pose: "rest" },   // on the plain grass right of Beetle (who stands just right of Echo), a step nearer the front than Echo, under the beetle and moon pictures without touching them
s06: { x: 0.47, y: 0.85, h: 0.2, pose: "rest" },     // on the grass right of Echo, in front of and below the flower cloth picture, apart from tangled Goat (any higher and it covers the picture)
s08: { x: 0.61, y: 0.855, h: 0.19, pose: "rest" },   // on the grass right of the front basket of cloth pictures, below the small ribbon basket, apart from Goat
e01: { x: 0.87, y: 0.815, h: 0.19, pose: "cheer" },  // on the grass just right of Echo, cheering with him (a small gap to his wing)
e02: { x: 0.75, y: 0.75, h: 0.17, pose: "cheer" },   // on the wide plain grass right of Echo, cheering up at the kite, feet on Echo's line
e03: { x: 0.775, y: 0.79, h: 0.18, pose: "cheer" },  // on the grass just right of Echo, cheering with him, far below Pelly and the kite
e04: { x: 0.765, y: 0.71, h: 0.19, pose: "cheer" },  // on the empty right half of the bench, right of Echo, cheering, feet on the bench top level with his; its head reaches the map's lower-right corner, covering no star, the kite or Echo's wing
s05: null, s07: null,
// Day 11: nestlift
s01: { x: 0.43, y: 0.7, h: 0.18, pose: "rest" },     // on the stone step between Pelly's fence and Echo, LEFT of him (right of Echo the step runs out at the picture's edge and the octopus touched it)
s02: { x: 0.375, y: 0.643, h: 0.105, pose: "peek" }, // peeking over the porch rail LEFT of Echo, between the left post and his wing, chin just under the letter (Echo stands right of the middle, so the stretch right of him ends at a post)
s03: { x: 0.578, y: 0.775, h: 0.165, pose: "rest" }, // on the sand between the chicks and Echo, LEFT of him (Echo stands near the right edge with no sand to his right)
s05: { x: 0.575, y: 0.78, h: 0.19, pose: "rest" },   // on the plain sand just right of Echo, feet on his line, the quilt and chicks well above
s07: { x: 0.665, y: 0.855, h: 0.15, pose: "rest" },  // on the open sand just right of the post's foot, between the winch and the hanging lift basket
s08: { x: 0.405, y: 0.85, h: 0.185, pose: "rest" },  // on the sand between the flat rock with the stones and Echo, left of him, under the hanging lift basket
e02: { x: 0.57, y: 0.825, h: 0.16, pose: "rest" },   // on the plain cream patch of the picnic cloth, in front of the pot, between the chicks and Echo
e04: { x: 0.7, y: 0.725, h: 0.17, pose: "cheer" },   // on the plain right half of the bench, right of Echo and left of the lamp table, arms up, feet on Echo's line
s04: null, s06: null, e01: null, e03: null,
// Day 12: concert
s01: { x: 0.485, y: 0.708, h: 0.18, pose: "rest" },  // on the top flagstone between Pelly's fence and Echo, left of him (Echo is near the right edge with no room right of him, as on Day 1)
s02: { x: 0.385, y: 0.59, h: 0.12, pose: "peek" },   // peeking over the railing's top rail LEFT of Echo, under the letter (right of him is the corner post), as Day 1's s02
s03: { x: 0.69, y: 0.68, h: 0.17, pose: "rest" },    // on the mossy grass of the near bank just right of Echo
s04: { x: 0.46, y: 0.58, h: 0.165, pose: "rest" },   // on the wide flat stone just right of Echo
s05: { x: 0.46, y: 0.8, h: 0.17, pose: "rest" },     // on the near bank's grass just right of Echo, in front of the waterside stones
s06: { x: 0.45, y: 0.65, h: 0.16, pose: "rest" },    // on the lily pad in front, between Echo and the harp
s08: { x: 0.735, y: 0.675, h: 0.17, pose: "cheer" }, // on the front of the lily pad, right of Echo, below Duck and clear of her bell stand
e03: { x: 0.6, y: 0.755, h: 0.17, pose: "rest" },    // on the mossy bank just right of Echo, in front of the picnic row, below Duck and Newt
e04: { x: 0.668, y: 0.705, h: 0.19, pose: "cheer" }, // on the bench top right of Echo, between him and the lamp, arms up; feet on the bench like Echo's
s07: null, e01: null, e02: null,
// Day 13: rooftops
s01: { x: 0.44, y: 0.715, h: 0.18, pose: "rest" },   // on the doorstep LEFT of Echo, between Pelly's fence and Echo (Echo took the right of the step; the strip right of him is too narrow and cuts the octopus at the edge), as Day 1's s01
s02: { x: 0.365, y: 0.655, h: 0.115, pose: "peek" }, // peeking over the porch railing LEFT of Echo, under the letter (Echo leans on the right of the railing, as Day 1's s02); kept small so it clears the post knob, Echo's wing and the letter
s03: { x: 0.65, y: 0.805, h: 0.21, pose: "rest" },   // on the cobbled lane just right of Echo
s04: { x: 0.565, y: 0.75, h: 0.16, pose: "rest" },   // on the cobbles in front, between Gardener Bird and Echo, below the cart
s05: { x: 0.535, y: 0.86, h: 0.14, pose: "rest" },   // on the cobbles in front, between Gardener Bird and Echo, just under the watering can (Echo stands at the right edge, so the prompt's spot right of him has no room); feet a little in front of the two birds'
s06: { x: 0.625, y: 0.845, h: 0.15, pose: "rest" },  // on the cobbles in front, between the springboard's end and Echo's feet (no room right of Echo, who is at the right edge)
s08: { x: 0.665, y: 0.85, h: 0.15, pose: "rest" },   // on the cobbles in front, between the springboard's end and Echo's feet (no room right of Echo, who is at the right edge)
e02: { x: 0.645, y: 0.82, h: 0.19, pose: "cheer" },  // on the terrace just right of Echo, under the flowery arch
e03: { x: 0.53, y: 0.845, h: 0.17, pose: "cheer" },  // on the terrace just right of Echo, in front of the table, feet level with Echo's
e04: { x: 0.74, y: 0.7, h: 0.2, pose: "cheer" },     // on the empty right half of the bench, right of Echo, cheering, feet on the bench top level with his; its head and arms reach the map's lower edge and cover no star or place (only cobbles)
s07: null, e01: null,
// Day 14: observatory
s01: { x: 0.4, y: 0.7, h: 0.17, pose: "rest" },      // on the doorstep LEFT of Echo, between Pelly and Echo (right of Echo is only a sliver of step at the picture's edge)
s02: { x: 0.365, y: 0.585, h: 0.12, pose: "peek" },  // peeking over the railing's top rail LEFT of Echo, between the left post and Echo (Echo sits on the railing, and right of him are the slipper and the end post); its head just under the letter
s03: { x: 0.575, y: 0.8, h: 0.17, pose: "rest" },    // on the stone path just right of Echo and the slipper he holds up
s05: { x: 0.53, y: 0.865, h: 0.155, pose: "rest" },  // on the floor between Owl and Echo, LEFT of Echo (right of Echo is only a sliver of floor at the picture's edge)
s06: { x: 0.455, y: 0.795, h: 0.17, pose: "rest" },  // on the floor just right of Echo, in front of the platform's left end, below the drive wheel
e03: { x: 0.865, y: 0.78, h: 0.145, pose: "cheer" }, // on the floor just right of Owl, clear of her raised slipper, cheering
e04: { x: 0.63, y: 0.688, h: 0.19, pose: "cheer" },  // on the empty right half of the bench, right of Echo, cheering, feet on the bench top level with his; its head reaches the map's bottom frame and covers no star or place
s04: null, s07: null, s08: null, e01: null, e02: null,
```

The bottom eighth of every page is calm (ground, floor or water) for the
caption card. Everything important is inside the middle 70% of the width but
for a few edge details (a lamp, a curtain).

Where a page differs from the spec's words:
- **lighthouse/s01**: the buddy stands left of Echo (the model put Echo on the
  right of the step, and the gap between Pelly and Echo is the empty spot).
- **lighthouse/e01**: the seven boats are the game's own pictures, laid along
  the dock of an empty harbor by `cut-adventure.py` (`COMPOSE`). Drawn, the
  model gave nine or ten boats every time, two of some.
- **windup/s07**: the page is the chart only (cut from the drawing, a 1.33x
  enlargement): drawn three times, the model always stood awake toys in front
  of it, though the toys are asleep at that point.
- **lighthouse/e02**: the crews are the boats' animals, but the rowboat's crew
  reads as bunnies more than mice. Small; a redraw if anyone minds.
- **windup/e01**: the crowd has two bears in checked shirts; one could be
  taken for Grandpa Bear, who only comes out in e02.

Touched up after drawing (the raws in `tools/art/out/adventure/` carry the
fix, so a `--redo` of one of these pages loses it):
- **windup/e01**: the model left out the crocodile and the jack-in-the-box
  (asked twice, and once more as a masked edit of the doorway). Their own
  cast drawings (`c-croc`, `c-jack`) are laid on the cobbles at the lower
  right, warmed 10% toward the scene's light, with a soft shadow each.
- **lighthouse/e04, windup/e04, bridge/e04**: the helper map's stars sat in
  the sky and on the grass. Each old star was painted out (a masked edit,
  only its own square kept, its colours matched to the map around it) and a
  gold star sticker put on each place helped so far: the lighthouse; then the
  toy shop; then the bridge.
- **bridge/s01, s02**: the bridge stood whole behind the house and the
  letter, though the storm broke it the night before. Painted out (a masked
  edit, only that strip kept): the river runs on with no bridge, as in s05.

Days 4-14 (22 Oct 2026). Every page was checked against its line by a
reviewer looking at the picture (writing, Echo off-model, a character
missing, doubled or wrong, extra limbs, the fix drawn before the game, a face
under the caption card) and redrawn with the reason until it passed, up to
five times; from the third round only those hard faults sent a page back.
What a later round still noticed but let pass is in the PR. Fixed after
drawing by `cut-adventure.py` (`TOUCH`, the same way every time it runs; the
raws in `tools/art/out/adventure/` stay as the model drew them):
- **the helper maps (Days 5-14's e04)**: drawn with the one star Echo presses; the
  stars of the days before are the game's own glossy star, laid on the map's
  places with a soft shadow (`STARS`, placed with `--stars` and counted on
  the proof). Day 4's map was drawn with its four. The map pages draw from
  `refs/ref-map.webp` (this folder), Day 3's map cut out of its page with
  its stars filled in: the whole page brought back its stars, and its Echo's
  two-lobed pink feather, as extra stars and a third feather.
- **lantern/s02, s04-s08, home**: the mushroom lamps glowed on every page
  before the game (three drawings each); inside each lamp's circle only warm,
  bright pixels are turned to dull dusk glass. Echo's own porch lamp stays
  lit, and so does the chart's drawing of a lit lamp (s07).
- **lantern/s05**: a wing on Glowworm, who has none, filled in from the sky.
- **postboat/e01**: Beaver's two front teeth, the day's joke, drawn on.
- **kite/e04**: Echo's back feather drawn coral, turned to his yellow.
- **observatory/e04**: four tiny cream crayon sparkles by the moons, which a
  child counting fourteen stars could count too, filled in.
Pages drawn against an earlier page of their own story: postboat e01 and e03
(Beaver as on s07), kite s04 and e02 (Lamb's and Beetle's own model sheets),
trainline e03 (Pelly and the mitten as on s01). Those references are in
`refs/` too, so a `--redo` from a fresh checkout has them (the raw drawings
in `tools/art/out/` are git-ignored).

## 3. Home's pictures

768x432, cut from the centre 16:9 band of a 1536x1024 drawing.
- `home-lighthouse`: Echo left of the middle beside the shining lamp, the beam
  to a tugboat right of the middle on the foggy sea. Echo spans y 0.15-0.85,
  so the 3:1 crop (the middle 59%) cuts his feathers and feet; 2:1 and 5:2 keep
  him whole.
- `home-windup`: Echo (left) turning the drummer bunny's key (right) on the
  workbench, toys peeking from the shelves. Both inside y 0.15-0.9.
- `home-bridge`: Echo on the broken bridge (left), a stone rising from the
  river with its spiral glowing (right), Blossom Island behind.
- `home-arcade`: Echo in the middle (x 0.32-0.68, y 0.25-0.95) with a
  watermelon slice, basketball, piano keys, soccer ball and a bone around him:
  the square centre crop keeps Echo whole.
- `home-<id>` for Days 4-14: each shows the day's problem (never the fix)
  with Echo, checked whole at 16:9 and 2:1. Where Echo stands low (frontdoor,
  trainline, rooftops) the 5:2 and 3:1 crops of the smallest phones trim his
  feet, as Day 1's 3:1 does.

## 4. Light the Way (`lighthouse-*`, for P4)

**The sea is composed, not drawn whole.** Asked in words (and again over a
layout sketch) the model never painted twelve windows (it gave 6, then 9) and
put the town where it liked. So `lighthouse-sea` is: the sea and its empty
hill (`lighthouse-sea-base`), three painted rows of exactly four cottages
(`lighthouse-town-row1..3`) stood on the hill back to front, and a string of
dock bulbs (`lighthouse-bulbs`), unlit. `lighthouse-town-lit` is the same
composition with every window's glass lit and the bulbs on: **outside the
twelve window circles (r + 4 px) and the bulb strip the two are identical,
pixel for pixel, before encoding** (checked on every cut; the encoder's own
rounding is all that differs after). `lighthouse-rocks-front` is the cove's
front rocks cut out of the composed sea itself (a polygon, `ROCKS`), the same
800x1200 frame, transparent elsewhere.

All three are the same frame (800x1200 from 1024x1536). The numbers below are
fractions of it, ready for `ANCHORS` (x of width, y of height, s and r of
width):

```js
horizon: 0.345,                                    // the sky above, the sea below
start: { x: 0.50, y: 0.45 },
moon: { x: 0.78, y: 0.13, s: 0.14 },               // the sky is clear there; the picture has no moon of its own
// the cove: rock from the left edge to x 0.38, y 0.36-0.54; a thin spit
// runs right along y 0.42-0.46 to its tip at (0.384, 0.457). For the stand-in only:
rocks: { x: 0.17, y: 0.45, rx: 0.21, ry: 0.09 },
fogBanks: [{ x: 0.22, y: 0.64, rx: 0.14, ry: 0.04 }, { x: 0.40, y: 0.68, rx: 0.14, ry: 0.04 }],  // over the ferry
boats: {                                            // lamp: the lantern's glass from the sprite's middle, fractions of its drawn width
  tug:     { s: 0.16, lamp: [0.36, 0.094] },
  row:     { s: 0.15, lamp: [-0.35, -0.194] },
  sail:    { s: 0.16, lamp: [-0.424, 0.254] },
  banana:  { s: 0.17, lamp: [0.383, -0.165] },
  teacup:  { s: 0.12, lamp: [-0.353, -0.261] },
  bathtub: { s: 0.15, lamp: [-0.376, -0.191] },
  ferry:   { s: 0.24, lamp: [0.052, -0.376] }
},
decoys: { barrel: { s: 0.08 }, whale: { s: 0.22 }, duckie: { s: 0.13 }, buoy: { s: 0.09 } },
sea: [
  { boat: "tug", x: 0.30, y: 0.68 },
  { boat: "row", x: 0.58, y: 0.45 },
  { boat: "sail", x: 0.70, y: 0.45, drift: { x: 0.09, y: 0.012, s: 11 }, decoy: { key: "barrel", x: 0.20, y: 0.62 } },
  { boat: "banana", x: 0.38, y: 0.575, drift: { x: 0.06, y: 0.015, s: 9 }, decoy: { key: "whale", x: 0.72, y: 0.44 } },  // drift kept to 0.06: wider, its tip meets the cottages
  { boat: "teacup", x: 0.10, y: 0.455, peek: { x: 0.29, y: 0.40 }, twist: true },   // hidden wholly behind rocks-front; peeks up behind the spit
  { boat: "bathtub", x: 0.60, y: 0.415, drift: { x: 0.06, y: 0.010, s: 10 }, decoy: { key: "duckie", x: 0.24, y: 0.79 } },
  { boat: "ferry", x: 0.30, y: 0.66, drift: { x: 0.08, y: 0.010, s: 14 }, decoy: { key: "buoy", x: 0.63, y: 0.47 }, banks: true },
  { town: true }
],
little: [
  { boat: "tug", x: 0.30, y: 0.68 }, { boat: "row", x: 0.58, y: 0.45 }, { boat: "banana", x: 0.40, y: 0.58 },
  { boat: "bathtub", x: 0.26, y: 0.80 }, { boat: "sail", x: 0.70, y: 0.46 }, { town: true }
],
// the twelve windows: the centre of each window's glass and its radius, measured on the composition
windows: [
  { x: 0.6439, y: 0.5658, r: 0.0137, row: 0 }, { x: 0.7283, y: 0.5656, r: 0.0137, row: 0 }, { x: 0.8231, y: 0.5659, r: 0.0137, row: 0 }, { x: 0.9180, y: 0.5654, r: 0.0137, row: 0 },
  { x: 0.5912, y: 0.6253, r: 0.0141, row: 1 }, { x: 0.6993, y: 0.6253, r: 0.0141, row: 1 }, { x: 0.8048, y: 0.6254, r: 0.0141, row: 1 }, { x: 0.9079, y: 0.6254, r: 0.0141, row: 1 },
  { x: 0.5604, y: 0.6971, r: 0.0161, row: 2 }, { x: 0.6698, y: 0.6971, r: 0.0161, row: 2 }, { x: 0.7778, y: 0.6971, r: 0.0161, row: 2 }, { x: 0.8915, y: 0.6971, r: 0.0161, row: 2 }
],
// where found boats tie up (drawn at half size): the water in front of the dock's left end
dock: [{ x: 0.56, y: 0.795 }, { x: 0.475, y: 0.785 }, { x: 0.395, y: 0.79 }, { x: 0.315, y: 0.80 }, { x: 0.50, y: 0.85 }, { x: 0.42, y: 0.86 }, { x: 0.33, y: 0.865 }],
dockLights: { x: 0.586, y: 0.754, w: 0.303, h: 0.055 },   // the bulb strip (clip town-lit to it)
wally: { x: 0.74, y: 0.735, s: 0.09 },                   // standing on the dock
ledge: { top: 0.24 },
lamp: { aspect: 0.658 }
```

- **Open water** for anything new: the band y 0.36-0.52 across the width
  (right of x 0.38 where the cove is), and the lower left, x 0.02-0.55,
  y 0.52-0.88. The town fills x 0.48-0.98, y 0.52-0.75; the dock x 0.58-0.89,
  y 0.75-0.82; a grassy hill the lower right below it; rocks along the bottom
  left from y 0.88.
- Each window light should clip to at most 1.25 x r (P4's rule): outside r + 4
  px the two pictures do not differ, so a wider clip shows nothing new.
- **The windows' rows in a picture are not perfectly level**: use each
  window's own y.
- `lighthouse-ledge` (1200x352): the brass rail's top bar is at 0.06-0.10, its
  two end posts at x 0.04 and 0.95; **the first fully opaque row is 0.24** (the
  cream stone top), so `ledge.top: 0.24` puts the stone on the ledge line and
  the rail across the foot of the sea in front of it. Stone top 0.24-0.47,
  wooden wall below. Plain in the middle (nothing stands on it).
- `lighthouse-lamp-off` / `-on` (360x547 each): **one frame**, the lamp in the
  same place in both (the on picture was scaled to the off one's width and
  bottom, `PAIRS` in the cut script), so swapping moves nothing. Width over
  height 0.658. The lit glass's centre is at (0.504, 0.527) of the picture,
  the glow about 0.31 of its height.
- `lighthouse-whale` / `-whale-wink` (400x290 each): one frame, the body the
  same; the sleeping whale fills the bottom 228 px (y 0.21-1.0), the wink adds
  the spout above. Draw both at the same size and place.
- Boats: three-quarter view, trimmed to what is drawn, waterline at the
  bottom; each lantern lit (the canvas dims them). Heights: tug 1.11 x its
  width, row 0.76, sail 1.16, banana 0.75, teacup 0.81, bathtub 0.81, ferry 1.07.
- `lighthouse-moon` 256x252 (no face), `lighthouse-cloud` 512x209,
  `lighthouse-barrel` 200x259, `-buoy` 200x244 (a gull asleep on top),
  `-duckie` 256x300, `lighthouse-wally` 256x359 (waving, glasses on).

## 5. Wind-Up Toys (`windup-*`, for P5)

- `windup-shop` (800x1200): **the bench top's front edge is at 0.60**
  (`ART.shop.bench`, P5's default holds): its top surface recedes from 0.50 to
  0.60, the lip's face is 0.60-0.63, a dark line under it at 0.63, the plain
  bench front below to 0.95, floor boards at the very bottom. Round window
  (sunny square) x 0.05-0.45, y 0.17-0.47; the open door x 0.80-1.00,
  y 0.29-0.55 with a little ramp down to it at x 0.73-0.82, y 0.46-0.55;
  shelves with spools and blocks at y 0.12-0.20; bunting y 0.22-0.28 on the
  right. **Plain wall for the cuckoo clock: x 0.48-0.78, y 0.24-0.46** (P5's
  default, top at 0.02, lands on the shelf: try x 0.63, top 0.24).
  Grandpa Bear has no floor to stand on (the bench fills the bottom): sit his
  chair on the bench's left end, bottom on 0.60, x about 0.14.
- `windup-shelf` (800x1200): **the shelf the big toys stand on has its front
  edge at 0.70** (`ART.shelf.bench`): top surface 0.66-0.70, lip face to 0.73,
  shadow line 0.735. A second, higher shelf edge at 0.345 (decoration), a
  small round window top centre (0.5, 0.17), bunting y 0.17-0.22.
- Toys, awake, no key, trimmed tight with their feet on the bottom edge
  (560 px wide, the crocodile 600): bunny 560x819, frog 560x497, top 560x755,
  croc 600x456, elephant 560x549, hippo 560x860, musicbox 600x748 (lid open,
  no crank). Width over height: bunny 0.68, frog 1.13, top 0.74, croc 1.32,
  elephant 1.02, hippo 0.65, musicbox 0.80. Drawn at one height they read as
  different sizes, as toys should; the frog and the croc are low and wide.
- `windup-jack-closed` / `-jack-open` (560x766 each): **one frame**; the
  closed one was drawn from the open one, so it is the same box. The box
  sits in the bottom of the frame: in the closed picture it fills x 0.17-0.85,
  y 0.54-1.0 and the rest is transparent; the open one's puppy fills the top.
  Draw both at the same size and place, so the lid pops in place.
- `windup-dial` 640x641: the brass disc fills the picture, centre (0.5, 0.5),
  a ridged rim, two engraved rings, a small hub. Round.
- `windup-key` 256x163: the butterfly handle, front view; its short stem ends
  at the bottom middle (0.5, 1.0), the joint to the toy or the dial.
- `windup-crank` 400x126: the pivot cap at the left end, centre (0.08, 0.66);
  the arm runs right along y 0.66-0.72; the red knob stands up at the right,
  centre (0.90, 0.30). Draw it with the pivot on the dial's centre.
- `windup-gauge` 720x393: a rainbow arch with brass rims, red on the outside
  of the left foot to violet on the inside; **its centre (where the needle
  pivots) is at (0.51, 0.85)** of the picture, outer rim radius 0.467 of the
  picture's width, inner rim radius 0.303 (the coloured band between);
  the arch's feet stand on the bottom edge; a gold star on the hub at (0.486,
  0.834) (the hub sits a hair left of the arc's true centre: pivot the needle
  on the arc's centre). The canvas draws the star zone and the needle on top.
- `windup-nightcap` 240x165 (the opening at the bottom, the tip flops right),
  `windup-grandpa` 360x461 (asleep in the rocking chair, a long red cap with a
  white pompom), `windup-cuckoo` 280x397 (bird out, a face with no numbers,
  pine-cone weights), `windup-oilcan` 200x146 (spout up and right).

## 6. Puzzle Bridge (`bridge-*`, for P6)

- `bridge-canyon` (drawn 1024x1536, **not shipped**: the game uses the wide
  one, and the tall drawing is kept only as the picture the wide one was drawn
  from; its numbers, as fractions of the drawing), seen from the side: **the near
  bank's flat top is at y 0.285, from the left edge to x 0.28**, its face
  dropping straight to the river; **Blossom Island's top is at y 0.40-0.42,
  from x 0.66 to the right edge**, its face at x 0.66-0.68 down to 0.56; the
  lantern arbour x 0.79-0.92, y 0.30-0.38 (stand Grandma at about (0.85, 0.39),
  her feet there). **The gap is open sky: x 0.28-0.66, y 0.10-0.50**, a little
  waterfall far behind it at x 0.47-0.53, y 0.28-0.47, a rainbow across the
  top (y 0.04-0.10). The river's surface starts at about 0.50 at the back and
  fills 0.55-0.85 in front; stones on the riverbed show through at 0.85-1.0.
- `bridge-canyon-wide` (1200x800, from 1536x1024): the near bank's top at
  y 0.37, x 0-0.20 (its face reaches x 0.24 by y 0.6); the island's top at
  y 0.53, x 0.72-1.0 (face at x 0.70-0.72); arbour x 0.83-0.94, y 0.40-0.52;
  open sky x 0.20-0.71; the river from about 0.66; waterfall x 0.48-0.52,
  y 0.48-0.62. Wider gap, easier for a camera that pans; the tall one is the
  more dramatic arch (the bank 0.12 higher than the island).
- `bridge-stone` 512x512: a flat, seamless sandstone tile (checked repeated
  2x2: no seams). A pattern for the stones' polygons.
- `bridge-spiral` 256x267: a carved spiral in light grey-white, for the canvas
  to tint dim or sea-green. `bridge-moss` 256x105: a moss cushion, flat
  bottom, to sit on a sleeping stone. `bridge-blossom` 200x176: a puff of pink
  blossom. `bridge-grandma` 256x369: waving her hanky, feet on the bottom.
  `bridge-crowd` 560x504: Wally with the cake, Grandpa Bear and the drummer
  bunny, standing together, feet on the bottom edge (no Echo).
  `bridge-ducks` 360x148: a mother duck and three ducklings swimming right,
  waterline at the bottom.

## 7. Open, for Travis and Rachel

- What every picture shows a child is Rachel's call (the CLAUDE.md rule for
  the books): the sneeze and the walrus's cold (Day 1 s03, s05), the storm-
  broken bridge (Day 3 s04, s08), the toys asleep after their party.
- lighthouse/e02's rowboat crew (bunnies, not mice) and windup/e01's bears in
  the crowd (section 2) are the two pages I would redraw first if anyone minds.
- The night pages are cozy (warm lamplight, every face lit); worth a look on
  a real phone in a dark room.
- Grandpa Bear's cap: a long floppy red sleeping cap with a white pompom (the
  first drawings read as a Santa hat and were redrawn).
