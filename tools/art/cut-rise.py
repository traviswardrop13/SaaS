"""Rise Up's pictures: Home's card, the three skies and the six pieces.

Travis, 9 Oct 2026: "lets build the game rise up". The image model draws each
picture listed under cover-rise and rise-* in game-sprites.json:

    NODE_USE_ENV_PROXY=1 node tools/art/gen-sprites.mjs cover-rise,rise-garden,rise-clouds,rise-stars,rise-balloon,rise-shield,rise-cube-yellow,rise-cube-purple,rise-bar,rise-bumpy

and this cuts the raw drawings (tools/art/out/game/<name>.png, git-ignored)
into the files the app loads:

    python3 tools/art/cut-rise.py              # every picture
    python3 tools/art/cut-rise.py rise-shield  # just the ones named

The three recipes are the ones the other games' pictures were cut with (they
reproduce home-dino, dino-site and soccer-keeper byte for byte):

  * card: the cover's centre 16:9 band (rows 80..944 of 1536x1024), 768x432,
    public/assets/crafted/home-rise.webp. The website's tile is cut from that
    card by site-tiles.py ("rise" in its TILES).
  * bg: a 1024x1536 sky, shrunk to 800x1200 with no crop,
    public/assets/crafted/game/rise-<sky>.webp. crafted-rise.css pans it.
  * sprite: a transparent piece, trimmed to what is drawn (alpha over 24),
    shrunk to a width (never enlarged), public/assets/crafted/game/<name>.webp.
    rise.js draws the balloon at the trimmed picture's full width with its top
    at the balloon's top, so the round body must be the widest part.

Every picture is decoration: rise.js and crafted-rise.css draw a plain
stand-in when one fails to load. Needs PIL.
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, "out", "game")
CARDS = os.path.join(ROOT, "public", "assets", "crafted")
GAME = os.path.join(CARDS, "game")

def raw(name):
    return Image.open(os.path.join(RAW, name + ".png"))

def card(src, dst):
    im = raw(src).convert("RGB").crop((0, 80, 1536, 944)).resize((768, 432), Image.LANCZOS)
    out = os.path.join(CARDS, dst + ".webp")
    im.save(out, "WEBP", quality=82)
    return out

def bg(src, w=800, h=1200):
    im = raw(src).convert("RGB").resize((w, h), Image.LANCZOS)
    out = os.path.join(GAME, src + ".webp")
    im.save(out, "WEBP", quality=82, method=6)
    return out

def sprite(src, maxw):
    im = raw(src).convert("RGBA")
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox())
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    out = os.path.join(GAME, src + ".webp")
    im.save(out, "WEBP", quality=82, method=6)
    return out

JOBS = [
    ("cover-rise", lambda: card("cover-rise", "home-rise")),
    ("rise-garden", lambda: bg("rise-garden")),
    ("rise-clouds", lambda: bg("rise-clouds")),
    ("rise-stars", lambda: bg("rise-stars")),
    ("rise-balloon", lambda: sprite("rise-balloon", 320)),
    ("rise-shield", lambda: sprite("rise-shield", 256)),
    ("rise-cube-yellow", lambda: sprite("rise-cube-yellow", 256)),
    ("rise-cube-purple", lambda: sprite("rise-cube-purple", 256)),
    ("rise-bar", lambda: sprite("rise-bar", 512)),
    ("rise-bumpy", lambda: sprite("rise-bumpy", 256)),
]

def main():
    only = set(sys.argv[1:])
    for name, job in JOBS:
        if only and name not in only:
            continue
        out = job()
        w, h = Image.open(out).size
        print("%-17s -> %s  %dx%d  %d bytes" % (name, os.path.relpath(out, ROOT), w, h, os.path.getsize(out)))

if __name__ == "__main__":
    main()
