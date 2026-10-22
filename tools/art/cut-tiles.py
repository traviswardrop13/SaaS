"""Piano Tiles' note tiles, cut wide and chunky from the painted originals.

Travis, 5 Oct 2026, of the falling notes: "the keynotes are a little bit too
skinny". The painted tiles (tile-coral/purple/green/blue/gold in
game-sprites.json, drawn 1024x1536 by gen-sprites.mjs) are tall thin bars in a
wide transparent frame, and the game stretched the whole frame over its lane,
so a note showed at half its lane's width. Drawn wider as they are, the bar
and its music note would just be stretched sideways. So this re-proportions
each one, by hand-free arithmetic, keeping the paint:

  * the tile is cropped to what is painted and scaled to the new width,
    so its rounded corners and raised rim keep their shape;
  * the top and bottom caps are kept whole and the plain clay below the note
    is fitted between them, which makes the bar ASPECT (1.35) times as tall
    as it is wide, the concept board's chunky note, where the painting's bar
    was 2.7 times;
  * the note (or the gold tile's star) is lifted out with its shadow, at its
    own shape, a little smaller, and set back in the middle with a soft edge.

arcade-tiles.html draws a tile ASPECT times as tall as it is wide (its
TILE_ASPECT: change both together), so the picture is never stretched on a
phone or an iPad.

    python3 tools/art/cut-tiles.py            # all five
    python3 tools/art/cut-tiles.py --sheet f  # also write a contact sheet to f

Reads tools/art/out/game/tile-<colour>.png (git-ignored: redraw one with
`NODE_USE_ENV_PROXY=1 node tools/art/gen-sprites.mjs tile-coral`) and writes
public/assets/crafted/game/tile-<colour>.webp. Only PIL is needed.
"""
import os, sys
from collections import deque
from PIL import Image, ImageFilter, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, "out", "game")
OUT = os.path.join(ROOT, "public", "assets", "crafted", "game")
COLOURS = ["coral", "purple", "green", "blue", "gold"]
TW = 264          # the widest tile on screen is 132 px (a 560 px stage), at 2x
ASPECT = 1.35     # height / width; arcade-tiles.html's TILE_ASPECT says the same
TH = round(TW * ASPECT)
NOTE_H = 0.50     # the note's height, as a share of the tile's
CREAM = (247, 229, 186)


def _pixels(im):
    # getdata() is on its way out of Pillow (14); its replacement is new in 12
    return list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())


def painted_box(im):
    """The box around what is painted (alpha over 40: no stray haze)."""
    return im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()


def note_box(tile):
    """The music note (or star): the biggest patch nearer cream than the clay.

    The clay's own colour is read from a plain patch low in the tile. The
    rim's highlights are cream-ish too, which is why it is the biggest
    connected patch that counts, not every cream pixel."""
    w, h = tile.size
    patch = tile.crop((int(w * .3), int(h * .75), int(w * .7), int(h * .85))).convert("RGB")
    px = sorted(_pixels(patch), key=sum)
    body = px[len(px) // 2]
    step = 4
    small = tile.resize((w // step, h // step), Image.BILINEAR)
    sw, sh = small.size
    data = _pixels(small)

    def near_cream(p):
        r, g, b, a = p
        dc = (r - CREAM[0]) ** 2 + (g - CREAM[1]) ** 2 + (b - CREAM[2]) ** 2
        db = (r - body[0]) ** 2 + (g - body[1]) ** 2 + (b - body[2]) ** 2
        return a > 200 and dc < db * 0.25

    mask = [near_cream(p) for p in data]
    seen = [False] * len(mask)
    best = []
    for i, on in enumerate(mask):
        if not on or seen[i]:
            continue
        seen[i] = True
        q, comp = deque([i]), []
        while q:
            j = q.popleft()
            comp.append(j)
            y, x = divmod(j, sw)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                k = ny * sw + nx
                if 0 <= ny < sh and 0 <= nx < sw and mask[k] and not seen[k]:
                    seen[k] = True
                    q.append(k)
        if len(comp) > len(best):
            best = comp
    xs = [j % sw for j in best]
    ys = [j // sw for j in best]
    return (min(xs) * step, min(ys) * step, (max(xs) + 1) * step, (max(ys) + 1) * step)


def full_width_rows(im):
    """The first and last rows where the bar is (nearly) its full width."""
    a = im.getchannel("A")
    w, h = im.size
    widths = []
    for y in range(h):
        box = a.crop((0, y, w, y + 1)).point(lambda v: 255 if v > 128 else 0).getbbox()
        widths.append(box[2] - box[0] if box else 0)
    full = max(widths) * .985
    rows = [y for y, v in enumerate(widths) if v >= full]
    return rows[0], rows[-1]


def ramp(size, fade_at_bottom, ov):
    """Solid, fading to nothing over the last (or first) ov rows."""
    w, h = size
    m = Image.new("L", size, 255)
    d = ImageDraw.Draw(m)
    for i in range(ov):
        v = round(255 * (i + .5) / ov)
        y = h - 1 - i if fade_at_bottom else i
        d.line((0, y, w, y), fill=v)
    return m


def cut(colour):
    src = Image.open(os.path.join(SRC, "tile-%s.png" % colour)).convert("RGBA")
    tile = src.crop(painted_box(src))
    nx0, ny0, nx1, ny1 = note_box(tile)
    w, h = tile.size
    s = TW / w
    tall = tile.resize((TW, round(h * s)), Image.LANCZOS)
    # Each end cap runs until the bar is full width again: the painting's
    # top corners are rounder than its bottom ones, and a cap cut short of
    # that leaves a step in the outline.
    top, bot = full_width_rows(tall)
    top, bot = top + 6, tall.height - bot + 6
    # the plain clay between the note's shadow and the bottom cap, fitted
    # between the caps with a soft overlap, so no seam shows across the bar
    ov = 14
    b0 = min(round((ny1 + (ny1 - ny0) * .12) * s), tall.height - bot - 40)
    band = tall.crop((0, b0, TW, tall.height - bot)).resize((TW, TH - top - bot + 2 * ov), Image.LANCZOS)
    body = Image.new("RGBA", (TW, TH))
    body.paste(band, (0, top - ov))
    cap = tall.crop((0, 0, TW, top + ov))
    body.paste(cap, (0, 0), ramp(cap.size, fade_at_bottom=True, ov=ov))
    cap = tall.crop((0, tall.height - bot - ov, TW, tall.height))
    body.paste(cap, (0, TH - bot - ov), ramp(cap.size, fade_at_bottom=False, ov=ov))
    # the note with its shadow and a margin of clay round it, at its own shape
    mw, mh = (nx1 - nx0) * .16, (ny1 - ny0) * .14
    box = (max(0, round(nx0 - mw)), max(0, round(ny0 - mh)), min(w, round(nx1 + mw)), min(h, round(ny1 + mh * 1.4)))
    lift = tile.crop(box)
    k = TH * NOTE_H / (ny1 - ny0)
    lift = lift.resize((round(lift.width * k), round(lift.height * k)), Image.LANCZOS)
    # a soft-edged window: solid over the note and its shadow, fading out over the margin
    fade = Image.new("L", lift.size, 0)
    inset = (round(mw * k * .55), round(mh * k * .55))
    ImageDraw.Draw(fade).rounded_rectangle((inset[0], inset[1], lift.width - inset[0], lift.height - inset[1]),
                                           radius=round(min(lift.size) * .22), fill=255)
    fade = fade.filter(ImageFilter.GaussianBlur(min(inset) * .45))
    # centre the NOTE (not the window) a touch above the tile's middle, where the painting had it
    cx = (nx0 + nx1) / 2 - box[0]
    cy = (ny0 + ny1) / 2 - box[1]
    at = (round(TW / 2 - cx * k), round(TH * .48 - cy * k))
    glyph = Image.new("RGBA", (TW, TH))
    glyph.paste(lift, at)
    win = Image.new("L", (TW, TH), 0)
    win.paste(fade, at)
    win = Image.composite(win, Image.new("L", (TW, TH), 0), body.getchannel("A"))   # never outside the tile
    out = Image.composite(glyph, body, win)
    out.putalpha(body.getchannel("A"))
    out.save(os.path.join(OUT, "tile-%s.webp" % colour), "WEBP", quality=82, method=6)
    return out


def main():
    made = [cut(c) for c in COLOURS]
    print("wrote", ", ".join("tile-%s.webp" % c for c in COLOURS), "at %dx%d" % (TW, TH))
    if "--sheet" in sys.argv:
        f = sys.argv[sys.argv.index("--sheet") + 1]
        sheet = Image.new("RGBA", (len(made) * (TW + 24) + 24, TH + 48), (60, 36, 86, 255))
        for i, im in enumerate(made):
            sheet.alpha_composite(im, (24 + i * (TW + 24), 24))
        sheet.save(f)
        print("sheet", f)


if __name__ == "__main__":
    main()
