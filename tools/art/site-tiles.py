"""The website's game tiles, cut from the app's own painted Home cards.

speaksona.com's "games" strip showed the old flat stickers beside painted book
covers (and three frames of a canvas court), while a family who installs sees
the painted cards on Home. This cuts each Home card
(public/assets/crafted/home-<name>.webp, 768x432) to the square the strip
shows and writes public/assets/site/games/<key>.webp, so the site and the app
show the same picture and a repainted card is one command away:

    python3 tools/art/site-tiles.py            # every game in TILES
    python3 tools/art/site-tiles.py --sheet f  # also write a contact sheet to f

A new game on the strip is one line in TILES: its key, its Home card's name,
and where the square's centre sits across the card (0 = left edge, 1 = right;
0.5 unless the subject is off to one side).
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CARDS = os.path.join(ROOT, "public", "assets", "crafted")
OUT = os.path.join(ROOT, "public", "assets", "site", "games")
SIDE = 300   # the strip shows a tile at 150 px, so 300 covers a 2x screen

# key (the game's key in sona.js), Home card name, centre of the square
TILES = [
    ("slice", "fruit", 0.5),
    ("tiles", "piano", 0.5),
    ("stack", "stack", 0.5),
    ("run", "run", 0.5),
    ("glide", "glide", 0.38),
    ("hoops", "hoops", 0.5),
    ("soccer", "soccer", 0.5),
    ("dino", "dino", 0.5),
    ("feed", "feed", 0.5),
    ("bubbles", "bubbles", 0.45),
]

def cut(name, cx):
    im = Image.open(os.path.join(CARDS, "home-%s.webp" % name)).convert("RGB")
    w, h = im.size
    left = int(round(cx * w - h / 2.0))
    left = max(0, min(w - h, left))
    return im.crop((left, 0, left + h, h)).resize((SIDE, SIDE), Image.LANCZOS)

def main():
    sheet = None
    if "--sheet" in sys.argv:
        sheet = sys.argv[sys.argv.index("--sheet") + 1]
    os.makedirs(OUT, exist_ok=True)
    made = []
    for key, name, cx in TILES:
        t = cut(name, cx)
        t.save(os.path.join(OUT, key + ".webp"), "WEBP", quality=82, method=6)
        made.append(t)
        print("%-8s <- home-%s.webp  %d bytes" % (key, name, os.path.getsize(os.path.join(OUT, key + ".webp"))))
    if sheet:
        s = Image.new("RGB", (SIDE * 5, SIDE * ((len(made) + 4) // 5)), "white")
        for i, t in enumerate(made):
            s.paste(t, ((i % 5) * SIDE, (i // 5) * SIDE))
        s.save(sheet)

if __name__ == "__main__":
    main()
