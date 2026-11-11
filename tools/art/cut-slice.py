"""Fruit Slice's two pictures: the orchard behind the game, and the counter
with the fox and Echo along its bottom edge.

Travis, 5 Oct 2026: "it just feels a little bit busy on that screen ... make
the bird and whatever's down low maybe smaller or just simplify it". The one
market picture (fruit-market-v2.webp) put a big fox and a big Echo behind
crates of painted fruit across the lower half of the screen, and was
stretched '100% 100%', so it squashed differently on every phone. Now there
are two layers (crafted-slice.css):

  * the orchard, fruit-market-v3.webp: v2's sky, trees and village with no
    characters, stalls, crates or counter. It is cut to v2's 1:2 shape, so on
    a phone `cover` keeps its trees in the frame;
  * the counter, fruit-stand.webp: one low counter running off both edges,
    a blank chalkboard in the middle and a SMALL fox and Echo peeking over its
    corners. It is drawn at the screen's full width and pinned to the bottom,
    so its ledge and its sign sit at the same share of the WIDTH above the
    bottom on every screen, and arcade-slice.html and #sliceHint read those
    shares (STAND_LEDGE, and the hint's `bottom`).

The cut, from the drawing as the image model made it:
  * the counter's rounded ends are cropped off, so it runs off the screen;
  * the chalkboard is widened by stretching its plain middle, so "Swipe to
    slice!" fits it at a size a child can read;
  * the counter's front is made taller (planks under the sign, and a little
    more board), so on a phone the sign clears the home bar.

The numbers below are read off THIS drawing (rows and columns of the 1536x1024
original). A redraw (`NODE_USE_ENV_PROXY=1 node tools/art/gen-sprites.mjs
fruit-stand`) puts things elsewhere: re-read them, run this, and copy the
shares it prints into arcade-slice.html (STAND_LEDGE, and wellX's spread
between the fox and Echo) and crafted-slice.css (#sliceHint).

    python3 tools/art/cut-slice.py

Reads tools/art/out/game/fruit-market-v3.png and fruit-stand.png (git-ignored)
and writes public/assets/crafted/fruit-market-v3.webp and fruit-stand.webp.
Needs PIL and numpy.
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "out", "game")
DST = os.path.join(HERE, "..", "..", "public", "assets", "crafted")

# ── the orchard: the middle 768 of the 1024 drawn, v2's 1:2 ──
# A phone is about 1:2, so `cover` shows only the middle of a 2:3 picture:
# drawn with its trees at the very edges, it lost them. Its prompt stands
# each tree's trunk 15% in and keeps its leaves in the outer 30%, so the
# middle 768 still has a tree down each side.
orch = Image.open(os.path.join(SRC, "fruit-market-v3.png")).convert("RGB")
assert orch.size == (1024, 1536), orch.size
orch.crop((128, 0, 896, 1536)).save(os.path.join(DST, "fruit-market-v3.webp"), "WEBP", quality=84, method=6)

# ── the counter ──
st = Image.open(os.path.join(SRC, "fruit-stand.png")).convert("RGBA")
assert st.size == (1536, 1024), st.size
X0, X1 = 44, 1492       # inside the counter front's rounded ends (it runs 32..1500)
Y0, Y1 = 430, 949       # the fox's ear tip .. the counter's bottom edge
LEDGE = 742             # the front of the ledge's top face: where a fruit stands
SIGN = (536, 780, 988, 905)        # the chalkboard's dark face (x0, y0, x1, y1)
WIDE = (640, 880, 280)  # the board's plain middle columns, widened by this much
TALL = (830, 890, 25)   # plain planks and board rows, made this much taller
UNDER = (937, 110)      # under the board's shadow: this many rows of planks go in here
PLANKS = (880, 936)     # plank rows the new ones are made from

def rows(img, a, b):
    return img.crop((0, a - Y0, img.width, b - Y0))

c = st.crop((X0, Y0, X1, Y1))
# planks for under the board: the board's own columns have none, so they are
# filled from the plank columns beside it (seams included)
band = rows(c, *PLANKS)
fill = Image.new("RGBA", (1030 - 500, band.height))
fill.paste(band.crop((60 - X0, 0, 500 - X0, band.height)), (0, 0))
fill.paste(band.crop((1030 - X0, 0, 1120 - X0, band.height)), (500 - 60, 0))
band.paste(fill, (500 - X0, 0))
# upside down: these planks darken toward the bottom, so flipped, the new rows
# start as dark as the row above them and end near the light row below
band = band.resize((band.width, UNDER[1]), Image.LANCZOS).transpose(Image.FLIP_TOP_BOTTOM)
t0, t1, tg = TALL
c = Image.fromarray(np.vstack([np.array(p) for p in (
    rows(c, Y0, t0),
    rows(c, t0, t1).resize((c.width, t1 - t0 + tg), Image.LANCZOS),
    rows(c, t1, UNDER[0]),
    band,
    rows(c, UNDER[0], Y1),
)]))
m0, m1, g = WIDE
left, mid, right = c.crop((0, 0, m0 - X0, c.height)), c.crop((m0 - X0, 0, m1 - X0, c.height)), c.crop((m1 - X0, 0, c.width, c.height))
mid = mid.resize((mid.width + g, mid.height), Image.LANCZOS)
out = Image.new("RGBA", (left.width + mid.width + right.width, c.height))
out.paste(left, (0, 0)); out.paste(mid, (left.width, 0)); out.paste(right, (left.width + mid.width, 0))
W, H = out.size
FINAL = 1440            # 430 px phones at 3x, and the 560 px column at 2.5x
out.resize((FINAL, round(H * FINAL / W)), Image.LANCZOS).save(os.path.join(DST, "fruit-stand.webp"), "WEBP", quality=82, method=6)

# where things landed, as shares of the width, measured up from the bottom
def up(y):  # a source row above the stretched zones, or the board's own rows
    extra = (tg if y >= t1 else (y - t0) * tg / (t1 - t0) if y > t0 else 0) + (UNDER[1] if y >= UNDER[0] else 0)
    return (H - (y - Y0 + extra)) / W
sx = lambda x: (x - X0 + (g if x >= m1 else 0)) / W
print("picture", FINAL, "x", round(H * FINAL / W), "(height/width %.4f)" % (H / W))
print("STAND_LEDGE (fruit line up from the bottom) %.4f" % up(LEDGE))
print("sign middle up from the bottom %.4f, its dark face %.4f..%.4f across" % ((up(SIGN[1]) + up(SIGN[3])) / 2, sx(SIGN[0]), sx(SIGN[2])))
print("bare ledge between the fox (%.4f) and Echo (%.4f)" % (sx(380), sx(1115)))
