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
STAR = os.path.join(ROOT, "public", "assets", "crafted", "game", "star.webp")
STARS = {}
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
