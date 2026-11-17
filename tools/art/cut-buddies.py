"""Cuts the buddies' pictures, as the image model drew them, to the sizes each
place that shows them expects.

Playing as your buddy (11 Oct 2026): a child's buddy runs in Sound Sprint,
stands beside Echo in the play games and cheers with him, peeks over Fruit
Slice's counter and sits on Block Stacker's bench. Each pose is drawn once per
buddy (tools/art/gen-sprites.mjs, with that buddy's model sheet attached, or,
for the twelve drawn on 11 Oct 2026, its checked cheer pose in the sheet's
place: design/crafted-world/buddies-v3.md) and cut here, so every buddy
fills the same frame the same way and a game places any of them with one set
of numbers.

    python3 tools/art/cut-buddies.py buddy-bunny-run buddy-bunny-rest
    python3 tools/art/cut-buddies.py buddy-bunny-run=path/to/drawing.png
    python3 tools/art/cut-buddies.py --out /tmp/look buddy-bunny-run   # write somewhere else

A file already committed is never written over (the eight badges and six
places that match these names are shipped art; new art gets a new name), unless
--force says so.

Each NAME reads tools/art/out/game/NAME.png (git-ignored; where gen-sprites.mjs
writes), or the file after "=", and the name says how it is cut:

  buddy-<id>-run          a runner, seen from behind (Sound Sprint): cropped to
                          the drawing, padded to 4:7 with the feet 4% above the
                          bottom edge, 480x840, the frame the fox's runner is
                          cut to (fox-runner.webp at 390,205,480,840)
  buddy-<id>-rest         standing, facing us (beside Echo, the road's hero),
  buddy-<id>-cheer        arms up (the 900 ms cheer), and
  buddy-<id>-sit          sitting (Block Stacker's bench): cropped, padded to a
                          square with a 6% margin and the feet on the bottom
                          margin, 512x512, like Echo's poses
  buddy-<id>-peek         over a ledge (Fruit Slice): cropped, its flat bottom
                          edge kept as the frame's bottom, the top and sides
                          padded, 512x384
  buddy-<id>-v2           the round badge every screen shows: 288x288, no
                          alpha, the corners (outside the disc) the existing
                          set's off-white, (254, 250, 242); a disc drawn with
                          a margin is cut to the disc first, so it fills the
                          square edge to edge like the existing set's
  <id>-sheet              a model sheet (front, side, back): 1536x1024 kept,
                          into design/crafted-world/buddies-v3/. A reference for
                          drawing the poses; never shipped in public/
  hat-<id>                a hat (the Buddy Shop): cropped, square, 256x256
                          (a hat the shop used to draw is drawn from that
                          drawing: node tools/art/hat-refs.mjs renders them)
  customize-<id>-v2       a place (the Buddy Shop): 600x399, no alpha, like
                          customize-sky-v2.webp
  road-<id>               a chest (the Trophy Road): 512x512, framed as drawn
                          (a chest and the big chest keep their sizes apart)

Everything else goes to public/assets/crafted/NAME.webp. Each cut prints what
it read, where the drawing sat in it, and what it wrote; checking the result by
eye (the same character as the badge and the sheet, a runner from behind, a
flat peek, clean edges, no text) is still a person's job, and the verdicts go
in design/crafted-world/buddies-v3.md. Needs PIL and numpy.
"""
import os
import re
import subprocess
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, "out", "game")
CRAFTED = os.path.join(ROOT, "public", "assets", "crafted")
SHEETS = os.path.join(ROOT, "design", "crafted-world", "buddies-v3")
ALPHA = 8              # alpha above this is drawing; below it, the model's haze
OFFWHITE = (254, 250, 242)

# runner: the frame's shape and where the drawing sits in it
RUN_W, RUN_H = 480, 840
RUN_FEET = 0.04        # the feet this share of the height above the bottom edge
RUN_TOP = 0.02         # and at least this much room over the head
RUN_SIDE = 0.03        # and at least this much each side
SQUARE = 512
SQUARE_MARGIN = 0.06   # every side; the feet stand on the bottom margin
PEEK_W, PEEK_H = 512, 384
PEEK_TOP = 0.06        # room over the ears; the bottom edge stays the drawing's own
PEEK_SIDE = 0.04
PORTRAIT = 288
HAT = 256
HAT_MARGIN = 0.06
PLACE = (600, 399)
ROAD = 512


def kind_of(name):
    for pat, kind in ((r"^buddy-[a-z]+-run$", "run"), (r"^buddy-[a-z]+-(rest|cheer|sit)$", "square"),
                      (r"^buddy-[a-z]+-peek$", "peek"), (r"^buddy-[a-z]+-v2$", "portrait"),
                      (r"^[a-z]+-sheet$", "sheet"), (r"^hat-[a-z]+$", "hat"),
                      (r"^customize-[a-z]+-v2$", "place"), (r"^road-[a-z-]+$", "road")):
        if re.match(pat, name):
            return kind
    return None


def drawn(im):
    """The drawing's box (x0, y0, x1, y1): every pixel with alpha over ALPHA."""
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > ALPHA)
    if not len(xs):
        sys.exit("  FAIL: nothing drawn (every pixel transparent)")
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def place(im, box, fw, fh, x, y):
    """The drawing in `box`, on a transparent fw x fh frame with its top left at (x, y)."""
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    frame.alpha_composite(im.crop(box), (int(round(x)), int(round(y))))
    return frame


def needs_alpha(im, name):
    if im.mode != "RGBA" or np.array(im)[:, :, 3].min() == 255:
        sys.exit("  FAIL: %s has no transparent background; draw it with \"transparent\": true" % name)


def tracked(p):
    """Is this file already committed? Eight badges (buddy-fox-v2 and the rest)
    and six places (customize-sky-v2 and the rest) match the names this script
    writes, and they are shipped art, never a draft to cut over."""
    if not os.path.exists(p):
        return False
    try:
        return subprocess.run(["git", "-C", ROOT, "ls-files", "--error-unmatch", os.path.relpath(p, ROOT)],
                              capture_output=True).returncode == 0
    except OSError:
        return True  # no git to ask: an existing file is treated as shipped


def cut(name, src, out_dir, force=False):
    kind = kind_of(name)
    if not kind:
        sys.exit("don't know how to cut %r (see the names in this script's help)" % name)
    if not os.path.exists(src):
        sys.exit("no %s: draw it with gen-sprites.mjs, or name a file with %s=path" % (os.path.relpath(src, ROOT), name))
    im = Image.open(src)
    im.load()
    im = im.convert("RGBA")
    W, H = im.size
    note = ""
    if kind == "run":
        needs_alpha(im, name)
        box = drawn(im)
        w, h = box[2] - box[0], box[3] - box[1]
        # the smallest 4:7 frame that holds the drawing with its margins
        fh = max(h / (1 - RUN_FEET - RUN_TOP), w / (1 - 2 * RUN_SIDE) * RUN_H / RUN_W)
        fw = fh * RUN_W / RUN_H
        frame = place(im, box, int(round(fw)), int(round(fh)), (fw - w) / 2, fh * (1 - RUN_FEET) - h)
        out, size = frame.resize((RUN_W, RUN_H), Image.LANCZOS), (RUN_W, RUN_H)
        note = "drawing %dx%d, %.0f%% of the frame's height" % (w, h, 100 * h / fh)
    elif kind in ("square", "hat"):
        needs_alpha(im, name)
        box = drawn(im)
        w, h = box[2] - box[0], box[3] - box[1]
        m = SQUARE_MARGIN if kind == "square" else HAT_MARGIN
        side = max(w, h) / (1 - 2 * m)
        # centred across; a figure stands on the bottom margin, a hat sits in the middle
        y = side * (1 - m) - h if kind == "square" else (side - h) / 2
        frame = place(im, box, int(round(side)), int(round(side)), (side - w) / 2, y)
        n = SQUARE if kind == "square" else HAT
        out, size = frame.resize((n, n), Image.LANCZOS), (n, n)
        note = "drawing %dx%d" % (w, h)
    elif kind == "peek":
        needs_alpha(im, name)
        box = drawn(im)
        w, h = box[2] - box[0], box[3] - box[1]
        # the bottom row of the drawing should be its flat cut: most of that row drawn
        bottom = np.array(im)[box[3] - 1, box[0]:box[2], 3] > ALPHA
        if bottom.mean() < 0.5:
            note = "WARNING: the bottom row is only %.0f%% drawn; the peek's flat edge may not be flat. " % (100 * bottom.mean())
        fw = max(w / (1 - 2 * PEEK_SIDE), h / (1 - PEEK_TOP) * PEEK_W / PEEK_H)
        fh = fw * PEEK_H / PEEK_W
        frame = place(im, box, int(round(fw)), int(round(fh)), (fw - w) / 2, fh - h)
        out, size = frame.resize((PEEK_W, PEEK_H), Image.LANCZOS), (PEEK_W, PEEK_H)
        note += "drawing %dx%d, its bottom edge on the frame's" % (w, h)
    elif kind == "portrait":
        if W != H:
            sys.exit("  FAIL: a badge is drawn square; this one is %dx%d" % (W, H))
        flat = Image.new("RGB", im.size, OFFWHITE)
        flat.paste(im, mask=im.split()[3])
        # The existing badges' disc fills its square edge to edge; the model
        # draws it with a margin of the paper colour (about 5% a side on 11 Oct
        # 2026, and not quite round). So the disc is found (everything that
        # differs from the corners' paper) and the square cut to it, its side
        # the disc's smaller extent, so no sliver of paper shows inside the rim.
        rgb = np.array(flat).astype(np.int32)
        paper = (rgb[2, 2] + rgb[2, -3] + rgb[-3, 2] + rgb[-3, -3]) / 4.0
        ys, xs = np.where(np.abs(rgb - paper).sum(2) > 30)
        if len(xs):
            w, h = xs.max() + 1 - xs.min(), ys.max() + 1 - ys.min()
            side = min(w, h)
            if side < 0.97 * W:
                cx, cy = (xs.min() + xs.max() + 1) / 2.0, (ys.min() + ys.max() + 1) / 2.0
                flat = flat.crop((int(round(cx - side / 2)), int(round(cy - side / 2)),
                                  int(round(cx - side / 2)) + side, int(round(cy - side / 2)) + side))
                note = "disc %dx%d at (%d, %d), cut to a %d px square on it" % (w, h, xs.min(), ys.min(), side)
        a = np.array(flat.resize((PORTRAIT, PORTRAIT), Image.LANCZOS)).astype(np.float64)
        # outside the disc every badge is the same off-white, so badges side by
        # side (the shop, the board) never show a different paper behind each.
        # The disc fills the square, as in the existing set, and its rim is
        # blended over one pixel the way theirs is: a hard cut steps like a
        # staircase on a phone's sharp screen.
        ys, xs = np.mgrid[0:PORTRAIT, 0:PORTRAIT]
        r = PORTRAIT / 2
        cover = np.clip(r - np.hypot(xs + 0.5 - r, ys + 0.5 - r) + 0.5, 0, 1)[:, :, None]
        a = a * cover + np.array(OFFWHITE, np.float64) * (1 - cover)
        out, size = Image.fromarray(a.round().astype(np.uint8)), (PORTRAIT, PORTRAIT)
    elif kind == "sheet":
        if (W, H) != (1536, 1024):
            sys.exit("  FAIL: a model sheet is drawn 1536x1024; this one is %dx%d" % (W, H))
        out, size = im, (W, H)
    elif kind == "place":
        out, size = im.convert("RGB").resize(PLACE, Image.LANCZOS), PLACE
    else:  # road
        needs_alpha(im, name)
        if W != H:
            sys.exit("  FAIL: a chest is drawn square; this one is %dx%d" % (W, H))
        out, size = im.resize((ROAD, ROAD), Image.LANCZOS), (ROAD, ROAD)
    if out_dir:
        dst = os.path.join(out_dir, name + ".webp")
    elif kind == "sheet":
        dst = os.path.join(SHEETS, name + ".webp")
    else:
        dst = os.path.join(CRAFTED, name + ".webp")
    if not out_dir and not force and tracked(dst):
        sys.exit("  FAIL: %s is already in the repo. New art gets a new name (-v2 -> -v3); "
                 "--force writes over it anyway" % os.path.relpath(dst, ROOT))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    q = 84 if kind == "place" else 85
    out.save(dst, "WEBP", quality=q, method=6)
    print("  %s (%s): %s %dx%d -> %s %dx%d, %d KB%s" % (
        name, kind, os.path.relpath(src, ROOT) if src.startswith(ROOT) else src, W, H,
        os.path.relpath(dst, ROOT) if dst.startswith(ROOT) else dst, size[0], size[1],
        os.path.getsize(dst) // 1024, "; " + note if note else ""))


def main(argv):
    out_dir = None
    force = "--force" in argv
    argv = [a for a in argv if a != "--force"]
    if "--out" in argv:
        i = argv.index("--out")
        if i + 1 >= len(argv):
            sys.exit("--out needs a folder")
        out_dir = os.path.abspath(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    if not argv:
        sys.exit(__doc__)
    for arg in argv:
        name, _, path = arg.partition("=")
        cut(name, os.path.abspath(path) if path else os.path.join(SRC, name + ".png"), out_dir, force)


if __name__ == "__main__":
    main(sys.argv[1:])
