# Vocabulary pictures (drop-in)

These images replace the emoji "flashcard" pictures in the games (Cup Stack, Rev
Racer, Grocery Grab, Story Time, Chat with Leo, Match-Up, Pop-a-Word).

## How it works
- Name each file after the **word, lowercased, no spaces** → `<word>.png`
  (e.g. `rabbit.png`, `milkshake.png`, `icecream.png`).
- Drop it in this folder: `public/coach/items/`.
- It appears **everywhere that word is used, automatically** — no code changes.
- If a file is missing, the game falls back to the emoji (no broken image).

## Art spec (match every generation)
- **Keyed transparent PNG.** Generate on a flat solid green background `#00b140`,
  object centered, not touching the edges; I key it to transparency
  (`node scripts/key-pose.js in.png public/coach/items/<word>.png 512`).
- ~**512×512**, single object, no text, soft top-left light, thick rounded
  flat-vector style in the world of Leo (attach Leo + a game screenshot as
  style references every time).

## Words to generate (by sound)
> Some repeat across sounds (e.g. `fish`, `leaf`, `sandwich`) — one file covers all.

- **R:** rabbit, rocket, ring, rain, robot, rose, rock, carrot, pirate, car, star, door
- **S:** sun, snake, soap, sock, sandwich, seal, spoon, dinosaur, glasses, bus, house, grass
- **L:** lion, leaf, lemon, ladder, lamp, lollipop, log, balloon, jello, ball, bell, owl
- **K:** cat, key, cake, kite, king, koala, cow, corn, cookie, monkey, duck, book
- **G:** goat, girl, game, gift, guitar, gorilla, goose, wagon, tiger, dog, frog, pig
- **F:** fish, fox, fan, fire, feather, fork, flower, elephant, dolphin, leaf, wolf, knife
- **SH:** shoe, ship, shark, sheep, shell, shirt, milkshake, sunshine, fish, brush, splash, trash
- **CH:** cheese, chair, cherry, chicken, chocolate, cheetah, lunchbox, teacher, peach, beach, watch, sandwich
- **TH:** thumb, three, thread, thunder, think, thirty, toothbrush, birthday, bath, tooth, earth, moth

Start with the **initial-position** words (the first ~7 in each list) — those are
the ones the games lean on most.
