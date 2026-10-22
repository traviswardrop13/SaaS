"""The daily stories' pictures (STORY1, 22 Oct 2026): cut the raw drawings
into the files the app loads.

gen-adventure.mjs draws the story pages, the lineups and Home's cards into
tools/art/out/adventure/<id>/; gen-sprites.mjs draws the three games' pieces
(their entries in game-sprites.json: lighthouse-*, windup-*, bridge-*) into
tools/art/out/game/. This cuts them:

    python3 tools/art/cut-adventure.py               # everything drawn
    python3 tools/art/cut-adventure.py lighthouse    # names starting with this
    python3 tools/art/cut-adventure.py --stars page.png '[[0.5, 0.3, 0.06]]' out.png
                                                     # a proof of STARS on one page

The recipes are cut-rise.py's three, done with ImageMagick (`convert`),
because this container's Python has no PIL:

  * card: a 1536x1024 picture's centre 16:9 band (rows 80..944), 768x432,
    public/assets/crafted/home-<name>.webp. Home crops it again from the
    middle to 2:1, 5:2 or 3:1 on short phones, so the subject sits in the
    middle band; the Arcade door shows home-arcade as a square centre crop.
  * bg: a 1024x1536 picture shrunk to 800x1200 with no crop, the size every
    game background ships at (the games place things by fractions of the
    picture, so the size is free). A story page is the same recipe, into
    public/assets/adventure/<id>/<art>.webp.
  * sprite: a transparent piece trimmed to what is drawn (alpha over 24),
    shrunk to a width (never enlarged), public/assets/crafted/game/<name>.webp.

And three that are this feature's own:

  * texture: bridge-stone, a 1024 tile shrunk to 512 (a pattern on a canvas).
  * town: lighthouse-town-lit is the sea with only its windows and dock bulbs
    lit. The model redraws its whole picture, so only the pixels inside the
    window circles and the bulb strip (TOWN, measured on the raw sea) are
    taken from what it drew; every other pixel is the raw sea's. The
    difference outside them is printed and must be 0 before encoding (what
    WebP's own rounding adds is printed beside it). Same frame as the sea.
  * rocks: lighthouse-rocks-front is the cove's front rocks cut out of the
    sea itself (ROCKS, a polygon on the raw sea), transparent everywhere
    else, the same frame as the sea, so the teacup can hide behind them and
    the rocks line up exactly (a separately drawn layer never does).

Every number the games and the player fit to is in design/adventure/art-notes.md.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW_GAME = os.path.join(HERE, "out", "game")
RAW_ADV = os.path.join(HERE, "out", "adventure")
EDIT = os.path.join(HERE, "out", "edit")
CARDS = os.path.join(ROOT, "public", "assets", "crafted")
GAME = os.path.join(CARDS, "game")
ADV = os.path.join(ROOT, "public", "assets", "adventure")
DESIGN = os.path.join(ROOT, "design", "adventure")
PAGES = ["s%02d" % n for n in range(1, 9)] + ["e%02d" % n for n in range(1, 5)]
# every story adventure-prompts.json draws (Days 1-3, and since 22 Oct 2026
# the Days 4-14 stories around Codex's games), in its order
STORIES = [s["id"] for s in json.load(open(os.path.join(HERE, "adventure-prompts.json")))["stories"]]

# THE TOWN. The model never painted twelve windows into the sea (it drew 6,
# then 9), so lighthouse-sea is composed here: the sea and its empty hill
# (lighthouse-sea-base), then three painted rows of exactly four cottages
# stood on the hill, back to front, then a string of dock bulbs. Each window
# is four panes of glass behind a cream cross; its centre and glass radius
# were read off the raw row pictures (1536x1024) by finding the four dark
# panes. lighthouse-town-lit is the same composition with every window's
# glass lit and the bulbs on: the rows differ only inside their glass and the
# bulbs only inside their own strip, so outside them the two pictures are the
# same, pixel for pixel, before encoding (checked).
ROWS = [  # name, window centres in the raw row, glass radius, left x, baseline y and width on the 1024x1536 sea
    ("lighthouse-town-row1", [(335.5, 535), (619, 534), (937.5, 535.5), (1256, 533)], 46, 594, 920, 410),
    ("lighthouse-town-row2", [(264.5, 532), (616.5, 532), (960, 532.5), (1296, 532.5)], 46, 532, 1030, 471),
    ("lighthouse-town-row3", [(273, 501.5), (571, 501.5), (865.5, 501.5), (1175.5, 501.5)], 44, 492, 1145, 512),
]
BULBS = ("lighthouse-bulbs", 600, 1158, 310)  # left x, top y and width of the bulb string on the sea
# The cove's front rocks, a polygon in the sea's pixels (lighthouse-rocks-front).
ROCKS = [(0, 552), (46, 566), (69, 586), (101, 593), (124, 610), (152, 613), (184, 630), (216, 644), (253, 654), (290, 668),
         (322, 671), (350, 678), (382, 688), (393, 702), (368, 709), (299, 712), (230, 712), (198, 726), (161, 736), (150, 758),
         (161, 778), (216, 785), (223, 799), (175, 808), (115, 814), (92, 828), (46, 828), (0, 821)]


def im(*args):
    r = subprocess.run(["convert", *[str(a) for a in args]], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("convert failed: " + r.stderr)
    return r.stdout.strip()


def webp(q, lossless=False):
    return ["-define", "webp:method=6"] + (["-define", "webp:lossless=true"] if lossless else ["-quality", str(q)])


def raw_game(name):
    return os.path.join(RAW_GAME, name + ".png")


def card(src, dst):
    out = os.path.join(CARDS, dst + ".webp")
    fix = TOUCH.get(dst[len("home-"):] + "/home") if dst.startswith("home-") else None
    if fix:
        os.makedirs(EDIT, exist_ok=True)
        src = touch(src, fix, os.path.join(EDIT, dst + "-touched.png"))
    im(src, "-alpha", "off", "-crop", "1536x864+0+80", "+repage", "-filter", "Lanczos", "-resize", "768x432!", *webp(82), out)
    return out


def bg(src, out, w=800, h=1200, q=82):
    im(src, "-alpha", "off", "-filter", "Lanczos", "-resize", "%dx%d!" % (w, h), *webp(q), out)
    return out


def bbox(src):
    # what is drawn: alpha over 24. A black border first, so -trim always trims
    # the transparent colour (with mixed corners, %@ trimmed the wrong one).
    g = im(src, "-alpha", "extract", "-threshold", "9.41%", "-bordercolor", "black", "-border", "1", "-trim", "-format", "%w %h %X %Y", "info:")
    w, h, x, y = [int(v) for v in g.replace("+", " ").split()]
    return w, h, x - 1, y - 1


def sprite(name, maxw):
    src, out = raw_game(name), os.path.join(GAME, name + ".webp")
    w, h, x, y = bbox(src)
    args = [src, "-crop", "%dx%d+%d+%d" % (w, h, x, y), "+repage"]
    if w > maxw:
        args += ["-filter", "Lanczos", "-resize", "%dx" % maxw]
    im(*args, *webp(82), out)
    return out


# Two pictures of one thing that the game swaps (the lamp off and on, the
# whale asleep and winking, the jack-in-the-box shut and open) are cut into
# one frame, so the swap moves nothing: the second is scaled so that its
# width (or, for the jack, the box's width `row` px above its bottom) matches
# the first's, its bottom centre is put on the first's, and both are cropped
# to the box that holds them both. Both files come out the same size.
PAIRS = {
    ("lighthouse-lamp-off", "lighthouse-lamp-on"): (360, None),
    ("lighthouse-whale", "lighthouse-whale-wink"): (400, None),
    ("windup-jack-closed", "windup-jack-open"): (560, 120),
}


def span(src, row, box):
    """The opaque width `row` px above the drawing's bottom (or its whole width)."""
    w, h, x, y = box
    if row is None:
        return w, x + w / 2.0
    line = im(src, "-alpha", "extract", "-crop", "%dx1+0+%d" % (im_size(src)[0], y + h - 1 - row), "+repage", "-threshold", "50%",
              "-bordercolor", "black", "-border", "1", "-trim", "-format", "%w %X", "info:")
    lw, lx = [int(v) for v in line.replace("+", " ").split()]
    return lw, lx - 1 + lw / 2.0


def pair(a, b, maxw, row):
    ra, rb = raw_game(a), raw_game(b)
    ba, bb = bbox(ra), bbox(rb)
    wa, ca = span(ra, row, ba)
    wb, cb = span(rb, row, bb)
    k = wa / float(wb)
    os.makedirs(EDIT, exist_ok=True)
    PAD = 600
    # b scaled about its own bottom centre, then moved onto a's bottom centre, both on a padded canvas
    W, H = im_size(ra)
    pa, pb = os.path.join(EDIT, a + "-pair.png"), os.path.join(EDIT, b + "-pair.png")
    im(ra, "-background", "none", "-gravity", "NorthWest", "-extent", "%dx%d-%d-%d" % (W + 2 * PAD, H + 2 * PAD, PAD, PAD), pa)
    bw, bh, bx, by = bb
    left = PAD + ca - (cb - bx) * k
    top = PAD + (ba[3] + ba[1]) - bh * k
    im("-size", "%dx%d" % (W + 2 * PAD, H + 2 * PAD), "xc:none", "(", rb, "-crop", "%dx%d+%d+%d" % (bw, bh, bx, by), "+repage",
       "-filter", "Lanczos", "-resize", "%dx%d!" % (round(bw * k), round(bh * k)), ")", "-geometry", "+%d+%d" % (round(left), round(top)), "-composite", pb)
    ua, ub = bbox(pa), bbox(pb)
    x0, y0 = min(ua[2], ub[2]), min(ua[3], ub[3])
    x1, y1 = max(ua[2] + ua[0], ub[2] + ub[0]), max(ua[3] + ua[1], ub[3] + ub[1])
    outs = []
    for name, src in ((a, pa), (b, pb)):
        out = os.path.join(GAME, name + ".webp")
        args = [src, "-crop", "%dx%d+%d+%d" % (x1 - x0, y1 - y0, x0, y0), "+repage"]
        if x1 - x0 > maxw:
            args += ["-filter", "Lanczos", "-resize", "%dx" % maxw]
        im(*args, *webp(82), out)
        outs.append(out)
    return outs[1]


def texture(name, side=512):
    out = os.path.join(GAME, name + ".webp")
    im(raw_game(name), "-alpha", "off", "-filter", "Lanczos", "-resize", "%dx%d!" % (side, side), *webp(82), out)
    return out


def row_box(name):
    return bbox(raw_game(name))


def lit_row(name, wins, r):
    """The row with every window's glass lit: a warm glow painted only on the
    dark panes inside each window's circle (the cream cross and frame stay)."""
    os.makedirs(EDIT, exist_ok=True)
    src, out = raw_game(name), os.path.join(EDIT, name + "-lit.png")
    circles = " ".join("circle %g,%g %g,%g" % (x, y, x + r, y) for x, y in wins)
    glass = os.path.join(EDIT, name + "-glass.png")
    # the panes: dark and blue inside the circles
    im(src, "-alpha", "off", "-fx", "(b-r>0.06 && (r+g+b)/3<0.36)?1:0", "(", "-size", "%dx%d" % im_size(src), "xc:black", "-fill", "white", "-draw", circles, ")",
       "-compose", "multiply", "-composite", "-morphology", "Dilate", "Disk:1", "-blur", "0x0.8", glass)
    glow = os.path.join(EDIT, name + "-glow.png")
    args = ["-size", "%dx%d" % im_size(src), "xc:none"]
    for x, y in wins:
        args += ["(", "-size", "%dx%d" % (2 * r, 2 * r), "radial-gradient:#fff6cf-#ffb43f", ")", "-geometry", "+%d+%d" % (round(x - r), round(y - r)), "-composite"]
    im(*args, glow)
    # the glow keeps a little of the glass's own shading, then goes in through the panes' mask
    im(src, "(", glow, "(", src, "-alpha", "off", "-colorspace", "gray", "-level", "0,55%", ")", "-compose", "soft-light", "-composite",
       glass, "-alpha", "off", "-compose", "CopyOpacity", "-composite", ")", "-compose", "over", "-composite", out)
    return out


def im_size(f):
    return tuple(int(v) for v in im(f, "-format", "%w %h", "info:").split())


def compose_sea(lit):
    """The sea with the town and the dock bulbs, unlit or lit. Answers the
    picture and the windows' places (fractions of the sea's width and height)."""
    base = raw_game("lighthouse-sea-base")
    args = [base, "-alpha", "off"]
    windows = []
    for row, (name, wins, r, left, base_y, width) in enumerate(ROWS):
        w, h, x, y = row_box(name)
        k = width / w
        src = lit_row(name, wins, r) if lit else raw_game(name)
        top = base_y - h * k
        args += ["(", src, "-crop", "%dx%d+%d+%d" % (w, h, x, y), "+repage", "-filter", "Lanczos", "-resize", "%dx" % width, "-modulate", "86,92", ")",
                 "-geometry", "+%d+%d" % (left, round(top)), "-compose", "over", "-composite"]
        for wx, wy in wins:
            windows.append({"x": (left + (wx - x) * k) / 1024, "y": (top + (wy - y) * k) / 1536, "r": r * k / 1024, "row": row})
    name, left, top, width = BULBS
    w, h, x, y = row_box(name)
    bulbs = ["(", raw_game(name), "-crop", "%dx%d+%d+%d" % (w, h, x, y), "+repage", "-filter", "Lanczos", "-resize", "%dx" % width]
    if not lit:  # unlit: the faint glow gone, the glass grey
        bulbs += ["-channel", "A", "-level", "45%,100%", "+channel", "-modulate", "60,15"]
    args += bulbs + [")", "-geometry", "+%d+%d" % (left, top), "-compose", "over", "-composite"]
    k = width / w
    strip = {"x": left / 1024, "y": top / 1536, "w": width / 1024, "h": h * k / 1536}
    os.makedirs(EDIT, exist_ok=True)
    out = os.path.join(EDIT, "lighthouse-%s.png" % ("town-lit" if lit else "sea"))
    im(*args, out)
    return out, windows, strip


def sea():
    made, windows, strip = compose_sea(False)
    lit, _, _ = compose_sea(True)
    # outside the glass and the bulb strip the two must be identical. The
    # margin is the resize filter's reach (4 px), well inside the 1.25 x r
    # circle the game clips a lit window to.
    keep = os.path.join(EDIT, "town-keep.png")
    draw = ["circle %g,%g %g,%g" % (w["x"] * 1024, w["y"] * 1536, w["x"] * 1024 + w["r"] * 1024 + 4, w["y"] * 1536) for w in windows]
    draw.append("rectangle %g,%g %g,%g" % (strip["x"] * 1024 - 2, strip["y"] * 1536 - 2, (strip["x"] + strip["w"]) * 1024 + 2, (strip["y"] + strip["h"]) * 1536 + 2))
    im("-size", "1024x1536", "xc:white", "-fill", "black", "-draw", " ".join(draw), keep)
    # (both are 8-bit pictures: compared as such, in whole steps of 1/255)
    diff = os.path.join(EDIT, "town-diff.png")
    im(made, "-alpha", "off", lit, "-alpha", "off", "-compose", "difference", "-composite", keep, "-compose", "multiply", "-composite", "-separate", "-evaluate-sequence", "max", "-depth", "8", diff)
    outside = im(diff, "-format", "%[fx:maxima*255]", "info:")
    if float(outside) != 0:
        raise SystemExit("the lit town differs outside its windows and bulbs: %s" % outside)
    a = bg(made, os.path.join(GAME, "lighthouse-sea.webp"))
    b = bg(lit, os.path.join(GAME, "lighthouse-town-lit.webp"))
    print("  the sea and the lit town differ only inside the windows and the bulb strip (0 outside, before encoding)")
    for w in windows:
        print("  window row %d  x %.4f  y %.4f  r %.4f" % (w["row"], w["x"], w["y"], w["r"]))
    print("  dock bulbs  x %.4f  y %.4f  w %.4f  h %.4f" % (strip["x"], strip["y"], strip["w"], strip["h"]))
    return a


def rocks():
    if not ROCKS:
        raise SystemExit("ROCKS is empty: draw the front rocks' outline on the raw sea first")
    out = os.path.join(GAME, "lighthouse-rocks-front.webp")
    poly = "polygon " + " ".join("%d,%d" % p for p in ROCKS)
    os.makedirs(EDIT, exist_ok=True)
    made = os.path.join(EDIT, "lighthouse-rocks-front.png")
    im(os.path.join(EDIT, "lighthouse-sea.png"), "-alpha", "off", "(", "-size", "1024x1536", "xc:black", "-fill", "white", "-draw", poly, "-blur", "0x1", ")", "-alpha", "off", "-compose", "CopyOpacity", "-composite", made)
    im(made, "-filter", "Lanczos", "-resize", "800x1200!", *webp(86), out)
    return out


# A page whose drawing is right only in part is cut to that part (x, y, w, h
# in the raw 1024x1536 picture, 2:3 like the page) and sized to 800x1200.
# windup/s07: drawn three times, the model always stood awake toys in front of
# the chart, though the toys are asleep in this part of the story; the chart
# itself was right, so the page is the chart alone (x 0.23-0.82, y 0.08-0.66
# of the drawing, enlarged 1.33x; the awake toys below and beside it left out).
CROPS = {"windup/s07": (240, 116, 600, 900)}
# A page with the games' own pieces laid on it: (sprite, centre x, bottom y,
# width), fractions of the page, back to front. lighthouse/e01: asked to draw
# the seven boats, the model drew nine or ten every time, two of some; so the
# page is an empty harbor and these are the very boats the game shows.
COMPOSE = {"lighthouse/e01": [
    ("lighthouse-boat-tug", 0.20, 0.665, 0.17), ("lighthouse-boat-ferry", 0.41, 0.67, 0.22),
    ("lighthouse-boat-sail", 0.61, 0.665, 0.15), ("lighthouse-boat-banana", 0.80, 0.66, 0.18),
    ("lighthouse-boat-row", 0.25, 0.81, 0.22), ("lighthouse-boat-teacup", 0.50, 0.815, 0.17), ("lighthouse-boat-bathtub", 0.75, 0.815, 0.21),
]}

# The helper map's earlier gold stars (Days 4-14's e04), laid on the map's
# little places: (centre x, centre y, width), fractions of the page. Asked to
# draw a close-up with only the new star, or the whole map with N stars, the
# model drew the whole map with one star every time; so it draws the map with
# the one star Echo presses, and the stars of the days before are the game's
# own star (public/assets/crafted/game/star.webp, the same glossy star as
# Days 1-3's maps), each with a soft shadow, as Days 1-3's were put on.
# Placed with `--stars` (below) and looked at; design/adventure/art-notes.md
# lists them.
# Pages fixed by hand after drawing, where a redraw kept bringing the fault
# back (each listed in design/adventure/art-notes.md):
#   ("unlight", [(x, y, r), ...]): lamp light the model kept drawing on a page
#     whose line says the lamps are dark. Inside each circle (centre x, y and
#     radius r, fractions of the page width; a soft edge out to 1.35 r) only
#     bright warm pixels are turned to dull dusk-grey glass, by how warm and
#     bright they are, so the lamp's shape and the shade around it stay.
#   ("fill", (x, y, rx, ry)): a small thing that must not be there (a wing on
#     the wingless glowworm), filled in from the sky around it: the ellipse is
#     smoothed in from its edge, then given the grain of the ring around it.
#   ("teeth", (x, top, w, h)): a beaver's two front teeth the model left out.
#   ("recolor", (box, ellipse, rgb)): one of Echo's feathers drawn the wrong
#     colour, turned to the right one (see "kite/e04").
TOUCH = {
    # Day 8: the mushroom lamps glowed on every "before" page in three drawings
    # each, though the lines say they will not light until the game. Echo's own
    # porch lamp (s01, s02) is his cottage's and stays lit.
    # Day 5: drawn five times, Beaver came out once with a tail on Echo and
    # once with no teeth, the day's joke (he nibbled his own door)
    "postboat/e01": [("teeth", (0.397, 0.290, 0.017, 0.010))],
    # Day 14: four tiny cream crayon sparkles by the map's two moons, which a
    # child counting the fourteen gold stars could count too
    "observatory/e04": [("fill", (0.785, 0.125, 0.009, 0.007)), ("fill", (0.875, 0.123, 0.009, 0.007)),
                        ("fill", (0.844, 0.426, 0.009, 0.007)), ("fill", (0.890, 0.440, 0.009, 0.007))],
    "lantern/s02": [("unlight", [(0.928, 0.345, 0.045), (0.975, 0.360, 0.040)])],
    # Day 10: drawn five times, Echo came out with three feathers, then with
    # both coral; the back one is his yellow
    "kite/e04": [("recolor", ((0.369, 0.470, 0.451, 0.525), (0.377, 0.521, 0.045, 0.027, 15), (252, 192, 42)))],
    "lantern/home": [("unlight", [(0.827, 0.352, 0.018)])],   # the big lantern's candle, before the game
    "lantern/s04": [("unlight", [(0.192, 0.519, 0.045), (0.335, 0.452, 0.028), (0.413, 0.410, 0.022), (0.460, 0.385, 0.020),
                                 (0.515, 0.374, 0.016), (0.553, 0.346, 0.016), (0.592, 0.347, 0.016), (0.646, 0.356, 0.016),
                                 (0.690, 0.410, 0.022), (0.884, 0.486, 0.040), (0.800, 0.293, 0.050)])],
    "lantern/s05": [("unlight", [(0.095, 0.655, 0.050), (0.472, 0.409, 0.020), (0.746, 0.390, 0.020), (0.105, 0.488, 0.025)]),
                    ("fill", (0.437, 0.121, 0.021, 0.023))],    # a wing on Glowworm, who has none
    "lantern/s06": [("unlight", [(0.210, 0.413, 0.040), (0.390, 0.349, 0.025), (0.531, 0.326, 0.018), (0.461, 0.307, 0.012),
                                 (0.605, 0.303, 0.012), (0.691, 0.308, 0.014), (0.752, 0.303, 0.015), (0.828, 0.317, 0.020)])],
    "lantern/s07": [("unlight", [(0.861, 0.758, 0.045), (0.044, 0.494, 0.020), (0.083, 0.438, 0.020), (0.107, 0.428, 0.020),
                                 (0.947, 0.442, 0.020)])],    # the chart's lit lamp is the drawing of the fix: it stays
    "lantern/s08": [("unlight", [(0.100, 0.490, 0.035), (0.483, 0.380, 0.018), (0.905, 0.396, 0.020), (0.705, 0.338, 0.012),
                                 (0.661, 0.322, 0.010), (0.822, 0.282, 0.040)])],
}


def touch(src, ops, out):
    # numpy and PIL here only, like add_stars
    import numpy as np
    from PIL import Image, ImageFilter
    im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    H, W, _ = im.shape
    yy, xx = np.mgrid[0:H, 0:W]
    for kind, arg in ops:
        if kind == "unlight":
            r, g, b = im[..., 0], im[..., 1], im[..., 2]
            L = 0.299 * r + 0.587 * g + 0.114 * b
            warm = np.clip((r - b) / 120.0, 0, 1) * np.clip((L - 90) / 110.0, 0, 1)
            dusk = np.stack([L * 0.30 + 30, L * 0.32 + 34, L * 0.38 + 46], -1)
            w = np.zeros((H, W), np.float32)
            for cx, cy, cr in arg:
                d = np.hypot(xx - cx * W, yy - cy * H) / (cr * W * 1.35)
                w = np.maximum(w, np.clip(1.25 - d * 1.25, 0, 1))
            a = (w * warm)[..., None]
            im = im * (1 - a) + dusk * a
        elif kind == "fill":
            cx, cy, rx, ry = arg
            hole = (((xx - cx * W) / (rx * W)) ** 2 + ((yy - cy * H) / (ry * H)) ** 2) <= 1.0
            x0, x1 = max(0, int((cx - rx) * W) - 30), min(W, int((cx + rx) * W) + 30)
            y0, y1 = max(0, int((cy - ry) * H) - 30), min(H, int((cy + ry) * H) + 30)
            sub = im[y0:y1, x0:x1].copy()
            h = hole[y0:y1, x0:x1]
            f = sub.copy()
            f[h] = sub[~h].mean(0)
            for _ in range(1500):
                pd = np.pad(f, ((1, 1), (1, 1), (0, 0)), mode="edge")
                f[h] = ((pd[:-2, 1:-1] + pd[2:, 1:-1] + pd[1:-1, :-2] + pd[1:-1, 2:]) / 4)[h]
            blur = np.asarray(Image.fromarray(sub.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)
            ring = np.argwhere(~h)
            pick = ring[np.random.default_rng(1).integers(0, len(ring), int(h.sum()))]
            f[h] += (sub - blur)[pick[:, 0], pick[:, 1]]
            m = Image.fromarray((h * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
            a = (np.asarray(m).astype(np.float32) / 255)[..., None]
            im[y0:y1, x0:x1] = sub * (1 - a) + f * a
        elif kind == "recolor":
            # one of Echo's head feathers drawn coral twice over: the coral
            # pixels in a box, minus the front feather's ellipse (cx, cy, a, b
            # as fractions of the width, its tilt in degrees), turned to his
            # yellow with their own light and shade kept
            import math
            (bx0, by0, bx1, by1), (cx, cy, ea, eb, ang), to = arg
            r, g, b = im[..., 0], im[..., 1], im[..., 2]
            coral = (r > 150) & (r - g > 60) & (r - b > 70)
            t = math.radians(ang)
            dx, dy = xx - cx * W, yy - cy * H
            u = dx * math.cos(t) + dy * math.sin(t)
            v = -dx * math.sin(t) + dy * math.cos(t)
            front = (u / (ea * W)) ** 2 + (v / (eb * W)) ** 2 <= 1.0
            m = coral & ~front & (xx >= bx0 * W) & (xx < bx1 * W) & (yy >= by0 * H) & (yy < by1 * H)
            L = 0.299 * r + 0.587 * g + 0.114 * b
            k = np.clip(L / np.median(L[m]), 0.55, 1.35)[..., None]
            new = np.clip(np.array(to, np.float32) * k, 0, 255)
            soft = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)[..., None] / 255
            im = im * (1 - soft) + new * soft
        elif kind == "teeth":
            # Beaver's two front teeth under his lip (cx, top, width of both,
            # height), drawn 8x large and shrunk, with a soft shadow on the mouth
            from PIL import ImageDraw
            cx, top, tw, th = arg
            w, h, S = tw * W, th * H, 8
            layer = Image.new("RGBA", (int(w * S) + 4 * S, int(h * S) + 4 * S), (0, 0, 0, 0))
            dr = ImageDraw.Draw(layer)
            gap = max(1, int(0.06 * w * S)); one = (w * S - gap) / 2; inset = max(1, int(one * 0.08))
            for i in range(2):
                x0 = 2 * S + i * (one + gap); x1 = x0 + one; y0 = 2 * S; y1 = y0 + h * S; r = int(one * 0.35)
                dr.rounded_rectangle([x0, y0 - r, x1, y1], radius=r, fill=(120, 84, 60, 255))
                dr.rounded_rectangle([x0 + inset, y0 - r, x1 - inset, y1 - inset], radius=max(1, r - inset), fill=(247, 241, 228, 255))
                dr.rectangle([x0 + inset, y0 + (y1 - y0) * 0.62, x1 - inset, y1 - inset * 1.6], fill=(232, 222, 203, 255))
            layer = layer.resize((layer.width // S, layer.height // S), Image.LANCZOS)
            pic = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8))
            x, y = round(cx * W - layer.width / 2), round(top * H - 2)
            sh = Image.new("RGBA", layer.size, (60, 20, 20, 0))
            sh.putalpha(layer.split()[3].filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: int(v * 0.35)))
            pic.paste(sh, (x + 1, y + 2), sh)
            pic.paste(layer, (x, y), layer)
            im = np.asarray(pic).astype(np.float32)
        else:
            raise ValueError("unknown touch " + kind)
    Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).save(out)
    return out


STAR = os.path.join(ROOT, "public", "assets", "crafted", "game", "star.webp")
STARS = {
    # Day 5: 1 drawn, 4 laid on (the red-and-white lighthouse (Day 1), at its top-left; the red-roofed house beside the lighthouse (Day 2), above its roof; the stone steps and curved causeway below them (Day 3's bridge stand-in), at the top of the steps; the grassy tip of the coast, top left of the map (Day 4: no garden or waterwheel is drawn))
    "postboat/e04": [(0.723, 0.098, 0.050), (0.848, 0.098, 0.050), (0.815, 0.174, 0.050), (0.586, 0.091, 0.050)],
    # Day 6: 1 drawn, 5 laid on (the big red-and-white lighthouse on the rock, top left, on its striped tower (Day 1's place); the blue-roofed house right of the middle, on its roof (Day 2's place: no toy shop is drawn); the stone bridge over the river, on its arch (Day 3's place); the pink blossom tree by the river, on its crown (Day 4: no garden or waterwheel is drawn); the red-roofed farmhouse under the pine trees, top right (Day 5: no harbour or postboat is drawn))
    "bakery/e04": [(0.401, 0.150, 0.050), (0.793, 0.300, 0.050), (0.532, 0.393, 0.050), (0.425, 0.355, 0.050), (0.776, 0.178, 0.050)],
    # Day 7: 1 drawn, 6 laid on (the little pine-tree island left of the river; the twin red-roofed house, on its roof (the house shows under the star); the top of the stone tower; the small red-roofed house right of the tower, on its roof; the green point with a pine tree, in the bend of the river; the pine trees on the rocky point below the town)
    "frontdoor/e04": [(0.561, 0.166, 0.045), (0.754, 0.120, 0.045), (0.816, 0.099, 0.045), (0.871, 0.129, 0.045), (0.731, 0.174, 0.045), (0.810, 0.190, 0.045)],
    # Day 8: 1 drawn, 7 laid on (the striped toy shop's roof (Day 2's place); the stone bridge's arch (Day 3's place); the pine forest left of the toy shop; the little brown hills on the sandy shore, top left of the map; the small red-roofed house right of the toy shop, at the map's right edge; the autumn tree clump on the map's right edge; the pink blossom trees on the map's right edge)
    "lantern/e04": [(0.812, 0.103, 0.045), (0.793, 0.172, 0.045), (0.721, 0.120, 0.045), (0.640, 0.088, 0.045), (0.876, 0.139, 0.045), (0.874, 0.255, 0.045), (0.867, 0.306, 0.045)],
    # Day 9: 1 drawn, 8 laid on (the red-and-white lighthouse, on its striped tower (Day 1's place); the toy shop with the striped awning, on its gable (Day 2's place; also hides a tiny number-like mark there); the stone bridge over the river, on its arch (Day 3's place); the little red-roofed house by the river, on its roof; the snowy mountain peaks at the top of the map; the rocky point with pine trees across the sea, right of the mountains; the pine forest left of the toy shop; the small pine trees by the stream, left of the clouds)
    "trainline/e04": [(0.241, 0.140, 0.050), (0.857, 0.118, 0.050), (0.356, 0.368, 0.050), (0.210, 0.352, 0.050), (0.400, 0.140, 0.050), (0.508, 0.185, 0.050), (0.674, 0.124, 0.050), (0.356, 0.293, 0.050)],
    # Day 10: 1 drawn, 9 laid on (the red-and-white lighthouse's tower, below its lamp (Day 1's place); the stone bridge's left end, beside its arch (Day 3's place); the roof of the big red-roofed farmhouse, upper left (Day 2's place: no striped toy shop is drawn); the roof of the red-roofed cottage at the left; the little brown house right of the river, by the bridge (its neighbour stays bare); the pink blossom bush on the green island, lower left; the pine forest on the hill between the farmhouse and the lighthouse; the trees and grass on the green island's right end; the bush clump on the left shore, below the cottage)
    "kite/e04": [(0.578, 0.207, 0.050), (0.479, 0.329, 0.050), (0.361, 0.255, 0.050), (0.249, 0.294, 0.050), (0.617, 0.306, 0.050), (0.322, 0.423, 0.050), (0.467, 0.194, 0.050), (0.422, 0.402, 0.050), (0.190, 0.333, 0.050)],
    # Day 11: 1 drawn, 10 laid on (the red-and-white lighthouse, on its striped tower below the lamp (Day 1's place); the red-roofed house with arched doors, top left, on its roof (Day 2's place: no toy shop with a striped awning is drawn); the stone bridge over the river, on its arch (Day 3's place); the brown cottage with the round window, middle left, on its roof; the little red-roofed house on the green hill right of the river; the snowy mountain's peak at the top of the map; the house with the domed tower, lower left; the pink blossom tree by the river, lower left; the vegetable garden rows in the lower left corner; the little red-roofed house among the pine trees in the middle of the map)
    "nestlift/e04": [(0.803, 0.164, 0.050), (0.422, 0.212, 0.050), (0.566, 0.255, 0.050), (0.314, 0.236, 0.050), (0.691, 0.212, 0.050), (0.535, 0.148, 0.050), (0.325, 0.376, 0.050), (0.422, 0.415, 0.050), (0.311, 0.435, 0.050), (0.564, 0.358, 0.050)],
    # Day 12: 1 drawn, 11 laid on (the red-and-white lighthouse's tower, below its lamp (Day 1's place); the little house on the lighthouse's rocky island; the red-roofed shop with the red awning, top middle (Day 2's toy shop); the stone bridge's right end, over the river (Day 3's place); the farmhouse at the top right; the pine trees at the map's right edge, right of the farmhouse; the red-roofed cottage on the path, middle left; the cottage roof at the lower left (it also hides a tiny pale weathervane speck there); the vegetable garden and fence beside that cottage; the little footbridge over the stream, lower middle (left of Echo's wing); the pine forest in the middle of the map, between the clouds)
    "concert/e04": [(0.320, 0.156, 0.045), (0.266, 0.203, 0.045), (0.649, 0.205, 0.045), (0.781, 0.234, 0.045), (0.767, 0.182, 0.045), (0.867, 0.195, 0.045), (0.363, 0.326, 0.045), (0.305, 0.398, 0.045), (0.405, 0.417, 0.045), (0.498, 0.417, 0.045), (0.566, 0.283, 0.045)],
    # Day 14: 1 drawn, 13 laid on (the red-and-white lighthouse, on its striped tower below the lamp (Day 1's place); the two-storey shop with the red awning, lower left, on its roof (Day 2's toy shop: no striped awning is drawn); the stone bridge over the river, on its arch (Day 3's place); the red-roofed house on the little island at the top of the map; the red-roofed house in the village right of the middle (beside the blue-roofed one); the cottage with the pink blossom tree, middle left; the red-roofed house with the smoking chimney, right edge; the blossom island in the middle of the lower river; the red-roofed cottage at the bottom, above Echo's star; the little green islet right of the lighthouse; the long causeway from the lighthouse's rocks, on its path; the pine forest on the bottom-right island, left of the small domed tower; the pine trees on the green hill below the observatory, left of the tower)
    "observatory/e04": [(0.430, 0.184, 0.045), (0.275, 0.392, 0.045), (0.527, 0.320, 0.045), (0.625, 0.134, 0.045), (0.674, 0.240, 0.045), (0.317, 0.303, 0.045), (0.854, 0.324, 0.045), (0.610, 0.383, 0.045), (0.503, 0.461, 0.045), (0.547, 0.193, 0.045), (0.483, 0.254, 0.045), (0.747, 0.477, 0.045), (0.750, 0.207, 0.045)],
}


def add_stars(src, stars, out):
    # PIL here only: the rest of this file runs on ImageMagick alone
    from PIL import Image, ImageFilter
    page = Image.open(src).convert("RGB")
    W, H = page.size
    star = Image.open(STAR).convert("RGBA")
    star = star.crop(star.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox())
    for cx, cy, fw in stars:
        dw = max(8, round(fw * W)); dh = round(star.height * dw / float(star.width))
        s = star.resize((dw, dh), Image.LANCZOS)
        x, y = round(cx * W - dw / 2.0), round(cy * H - dh / 2.0)
        pad = max(4, dw // 5)
        # a soft brown shadow a little down and right, as a sticker casts
        a = Image.new("L", (dw + 2 * pad, dh + 2 * pad), 0)
        a.paste(s.getchannel("A").point(lambda v: int(v * 0.45)), (pad, pad))
        a = a.filter(ImageFilter.GaussianBlur(max(1.5, dw * 0.05)))
        shadow = Image.new("RGBA", a.size, (58, 34, 14, 255))
        shadow.putalpha(a)
        page.paste(shadow, (x - pad + round(dw * 0.03), y - pad + round(dw * 0.06)), shadow)
        page.paste(s, (x, y), s)
    page.save(out)
    return out


def page(story, part):
    src = os.path.join(RAW_ADV, story, part + ".png")
    os.makedirs(os.path.join(ADV, story), exist_ok=True)
    crop = CROPS.get(story + "/" + part)
    if crop:
        made = os.path.join(EDIT, "%s-%s.png" % (story, part))
        os.makedirs(EDIT, exist_ok=True)
        x, y, w, h = crop
        im(src, "-crop", "%dx%d+%d+%d" % (w, h, x, y), "+repage", made)
        src = made
    fix = TOUCH.get(story + "/" + part)
    if fix:
        os.makedirs(EDIT, exist_ok=True)
        src = touch(src, fix, os.path.join(EDIT, "%s-%s-touched.png" % (story, part)))
    lay = COMPOSE.get(story + "/" + part)
    if lay:
        made = os.path.join(EDIT, "%s-%s-composed.png" % (story, part))
        os.makedirs(EDIT, exist_ok=True)
        W, H = im_size(src)
        args = [src, "-alpha", "off"]
        for name, cx, by, fw in lay:
            w, h, x, y = bbox(raw_game(name))
            dw = round(fw * W); dh = round(h * dw / float(w))
            args += ["(", raw_game(name), "-crop", "%dx%d+%d+%d" % (w, h, x, y), "+repage", "-filter", "Lanczos", "-resize", "%dx%d!" % (dw, dh),
                     ")", "-geometry", "+%d+%d" % (round(cx * W - dw / 2.0), round(by * H - dh)), "-compose", "over", "-composite"]
        im(*args, made)
        src = made
    stars = STARS.get(story + "/" + part)
    if stars:
        os.makedirs(EDIT, exist_ok=True)
        src = add_stars(src, stars, os.path.join(EDIT, "%s-%s-stars.png" % (story, part)))
    return bg(src, os.path.join(ADV, story, part + ".webp"), q=84)


def lineup(story):
    os.makedirs(DESIGN, exist_ok=True)
    out = os.path.join(DESIGN, "cast-%s.webp" % story)
    im(os.path.join(RAW_ADV, story, "cast.png"), "-alpha", "off", "-filter", "Lanczos", "-resize", "1600x>", *webp(84), out)
    return out


JOBS = []
for s in STORIES:
    JOBS += [("%s-%s" % (s, p), (lambda s=s, p=p: page(s, p)), os.path.join(RAW_ADV, s, p + ".png")) for p in PAGES]
    JOBS.append(("%s-cast" % s, (lambda s=s: lineup(s)), os.path.join(RAW_ADV, s, "cast.png")))
    JOBS.append(("home-%s" % s, (lambda s=s: card(os.path.join(RAW_ADV, s, "home.png"), "home-" + s)), os.path.join(RAW_ADV, s, "home.png")))
JOBS.append(("home-arcade", lambda: card(os.path.join(RAW_ADV, "arcade", "arcade.png"), "home-arcade"), os.path.join(RAW_ADV, "arcade", "arcade.png")))
# the games' pieces: (name, recipe, width it is shrunk to)
SPRITES = {
    "lighthouse-ledge": 1200, "lighthouse-lamp-off": 360, "lighthouse-lamp-on": 360, "lighthouse-moon": 256, "lighthouse-cloud": 512,
    "lighthouse-boat-tug": 320, "lighthouse-boat-row": 320, "lighthouse-boat-sail": 320, "lighthouse-boat-banana": 320,
    "lighthouse-boat-teacup": 256, "lighthouse-boat-bathtub": 320, "lighthouse-boat-ferry": 440,
    "lighthouse-whale": 400, "lighthouse-whale-wink": 400, "lighthouse-barrel": 200, "lighthouse-buoy": 200, "lighthouse-duckie": 256,
    "lighthouse-wally": 256,
    "windup-bunny": 560, "windup-frog": 560, "windup-top": 560, "windup-croc": 600, "windup-elephant": 560, "windup-hippo": 560,
    "windup-jack-closed": 560, "windup-jack-open": 560, "windup-nightcap": 240, "windup-dial": 640, "windup-key": 256,
    "windup-gauge": 720, "windup-musicbox": 600, "windup-crank": 400, "windup-grandpa": 360, "windup-cuckoo": 280, "windup-oilcan": 200,
    "bridge-spiral": 256, "bridge-moss": 256, "bridge-blossom": 200, "bridge-grandma": 256, "bridge-crowd": 560, "bridge-ducks": 360,
}
PAIRED = set(n for ab in PAIRS for n in ab)
for n, w in SPRITES.items():
    if n not in PAIRED:
        JOBS.append((n, (lambda n=n, w=w: sprite(n, w)), raw_game(n)))
for (a, b), (w, row) in PAIRS.items():
    JOBS.append((b, (lambda a=a, b=b, w=w, row=row: pair(a, b, w, row)), raw_game(b)))
JOBS.append(("lighthouse-sea", sea, raw_game("lighthouse-sea-base")))
# bridge-canyon (the tall drawing) is not shipped: it is only the reference
# bridge-canyon-wide was drawn from, and the game uses the wide one alone.
for n in ["windup-shop", "windup-shelf"]:
    JOBS.append((n, (lambda n=n: bg(raw_game(n), os.path.join(GAME, n + ".webp"))), raw_game(n)))
JOBS.append(("bridge-canyon-wide", lambda: bg(raw_game("bridge-canyon-wide"), os.path.join(GAME, "bridge-canyon-wide.webp"), 1200, 800), raw_game("bridge-canyon-wide")))
JOBS.append(("bridge-stone", lambda: texture("bridge-stone"), raw_game("bridge-stone")))
JOBS.append(("lighthouse-rocks-front", rocks, os.path.join(EDIT, "lighthouse-sea.png")))


def main():
    args = sys.argv[1:]
    if args[:1] == ["--touch"]:
        # a proof: python3 tools/art/cut-adventure.py --touch <page.png> '[["unlight", [[x, y, r]]], ["fill", [x, y, rx, ry]]]' <out.png>
        print(touch(args[1], json.loads(args[2]), args[3]))
        return
    if args[:1] == ["--stars"]:
        # a proof: python3 tools/art/cut-adventure.py --stars <page.png> '[[cx, cy, w], ...]' <out.png>
        print(add_stars(args[1], json.loads(args[2]), args[3]))
        return
    for name, job, src in JOBS:
        if args and not any(name.startswith(a) for a in args):
            continue
        if not os.path.exists(src):
            print("%-24s (not drawn yet)" % name)
            continue
        out = job()
        size = im(out, "-format", "%wx%h", "info:")
        print("%-24s -> %s  %s  %d bytes" % (name, os.path.relpath(out, ROOT), size, os.path.getsize(out)))


if __name__ == "__main__":
    main()
