"""Edits a painted scene inside one box and leaves every other pixel alone.

Playing as your buddy (11 Oct 2026) puts a child's own buddy where the fox is
painted into Fruit Slice's counter and Block Stacker's workshop, and in Echo's
place in the rocket's window. Each scene keeps its picture; a new copy is cut
with the painted character taken out, and only inside the character's box, so
everything the game measures off the picture (Fruit Slice's STAND_LEDGE and
fruit wells, the bench line, the tower's stage) stays exactly where it was.

    python3 tools/art/scene-edit.py clear fruit-stand-v2   # alpha 0 in a box of a transparent scene
    python3 tools/art/scene-edit.py clone fruit-stand-v2   # copy a strip of plain rows over the box
    python3 tools/art/scene-edit.py prep stack-workshop-v3 # the model's input and mask, in out/edit/
    python3 tools/art/scene-edit.py apply stack-workshop-v3  # keep only the masked pixels of out/game/<name>.png
    python3 tools/art/scene-edit.py cut fox-peek-ref       # a reference crop for gen-sprites.mjs (edits nothing)

  --lossless  write the scene as lossless WebP. By default it is written at the
              quality in its entry, like the picture it replaces; the edit is
              exact outside the box before encoding (the number that must be
              0), and the encoder's own rounding is printed beside it.

Every edit prints the pixel difference OUTSIDE its box, between what it read
and what it wrote, and stops with an error unless that is 0. A model never
touches a pixel outside the box: it redraws its whole picture, but `apply`
keeps the masked pixels of what came back and nothing else, so the rest is the
untouched original by construction.

The flow for a scripted edit (A7, no model): clear, then clone. The first
operation of an entry reads its source; each later one reads the working copy
out/edit/<name>.png the one before it wrote, so running the list again starts
again from the source. Only the last one writes the scene into public/.

The flow for a model edit (A8, A9):
    python3 tools/art/scene-edit.py prep stack-workshop-v3
    NODE_USE_ENV_PROXY=1 node tools/art/gen-sprites.mjs stack-workshop-v3
        # its game-sprites.json entry: ref tools/art/out/edit/<name>-in.png,
        # mask tools/art/out/edit/<name>-mask.png, the canvas's size
    python3 tools/art/scene-edit.py apply stack-workshop-v3

Boxes are (x0, y0, x1, y1) in the SOURCE picture's pixels, x1 and y1 not
included (PIL's convention); a circle is (cx, cy, r). The numbers were read off
the pictures on main 796e5c6; a repainted scene puts its character elsewhere:
re-read them before running this on it. Writes into the git-ignored
tools/art/out/edit/ and, once an edit's last operation has run, the entry's
`dst` in public/. Needs PIL and numpy.
"""
import os
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
EDIT = os.path.join(HERE, "out", "edit")
GAME = os.path.join(HERE, "out", "game")
FEATHER = 12  # px of the API's canvas over which a mask fades out, inside the box

EDITS = {
    # A7: Fruit Slice's counter with no fox, for any other buddy to peek over.
    # In fruit-stand.webp (1440x545) the counter's ledge starts at row 244 (its
    # soft top edge; opaque from 245) in every column, and everything above it
    # is transparent but the fox (about x 11-318) and Echo. So the fox's head
    # goes by clearing the box above the ledge, and its paws, which lie on the
    # ledge down to about row 258, by copying the ledge's own rows from just
    # right of them. (The plan said rows 0-249 and 250-263; clearing to 249
    # cut the top five rows off the ledge under the fox, a visible step.)
    # Same size and the same ledge line, so STAND_LEDGE (0.1979) and the fruit
    # wells in arcade-slice.html hold. Checked at phone size for a seam in the
    # ledge; if one shows, redo it as a masked edit inside the same box.
    "fruit-stand-v2": {
        "src": "public/assets/crafted/fruit-stand.webp",
        "dst": "public/assets/crafted/fruit-stand-v2.webp",
        "q": 82,                                  # cut-slice.py's quality for this picture
        "ops": ["clear", "clone"],
        "clear": (0, 0, 320, 244),                # the fox above the ledge
        "clone": ((320, 244, 640, 264), (0, 244)),  # ledge rows 244-263, x 320-640 -> x 0-320
    },
    # A8: Block Stacker's workshop with no fox on the bench's left end, for any
    # other buddy to sit there. 768x1536 sits in the middle of the API's
    # 1024x1536 at its own size (the 128 px bands each side are the picture's
    # edge columns, carried out); the box is the fox on the bench: its ears
    # from about row 915, its tail against the left edge, its right side about
    # x 235, and its paws on the bench top (which starts at row 1214) down to
    # about row 1228. The box runs to 1244, not the plan's 1230, so the mask's
    # fade lies on bare bench below the paws instead of across them.
    "stack-workshop-v3": {
        "src": "public/assets/crafted/stack-workshop-v2.webp",
        "dst": "public/assets/crafted/stack-workshop-v3.webp",
        "q": 85,
        "ops": ["prep", "apply"],
        "canvas": (1024, 1536),
        "scale": 1,
        "rect": (0, 900, 250, 1244),
    },
    # A9: the finale rocket with an empty porthole, so a buddy's portrait can be
    # drawn in it. 267x400 is scaled up to fill the API's 1024x1536 (3.835x),
    # because a model drawing into a 267 px corner of a big canvas paints mud;
    # `apply` scales its answer back down. The box is the porthole's glass,
    # inside the gold ring: x about 94-171 and y 126-208, so centred at
    # (133, 167), not the plan's (133, 158), whose circle left Echo's chest
    # showing at the bottom; r 43 reaches just under the ring all round.
    "stack-rocket-v3": {
        "src": "public/assets/crafted/stack-rocket-v2.webp",
        "dst": "public/assets/crafted/stack-rocket-v3.webp",
        "q": 85,
        "ops": ["prep", "apply"],
        "canvas": (1024, 1536),
        "scale": "fit",
        "circle": (133, 167, 43),
    },
}

# Reference crops, written to out/edit/<name>.png for a gen-sprites.mjs entry's
# refs: the painted fox exactly as each game shows it, so a buddy drawn to take
# its place matches its size, angle and pose. They edit nothing.
CUTS = {
    "fox-peek-ref": ("public/assets/crafted/fruit-stand.webp", (0, 0, 320, 264)),        # A5: the fox over the ledge
    "fox-sit-ref": ("public/assets/crafted/stack-workshop-v2.webp", (0, 900, 250, 1244)),  # A6: the fox on the bench
}


def path_of(p):
    return os.path.join(ROOT, p)


def load(p):
    im = Image.open(p)
    im.load()
    return np.array(im.convert("RGBA" if "A" in im.getbands() else "RGB"))


def save_png(a, p):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    Image.fromarray(a).save(p, "PNG")


def save_webp(a, p, q, lossless):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im = Image.fromarray(a)
    if lossless:
        im.save(p, "WEBP", lossless=True, exact=True, method=6)
    else:
        im.save(p, "WEBP", quality=q, method=6)


def same(a, b):
    """Per pixel: equal, or both fully transparent (what is under alpha 0 is never seen)."""
    eq = (a == b).all(axis=2)
    if a.shape[2] == 4:
        eq |= (a[:, :, 3] == 0) & (b[:, :, 3] == 0)
    return eq


def inside(shape, src_hw, h, w, scale=1.0, off=(0, 0)):
    """Distance in px from each pixel's centre to the box's edge, positive inside.

    Built in the space of an h x w grid whose pixels are 1/scale source pixels,
    the source (src_hw) sitting at `off`; scale 1 and off (0, 0) is the source
    itself. A side of a box that lies on the picture's own edge is no edge at
    all: nothing beyond it needs blending into, so the box does not fade there
    (else a strip of the fox's tail would stay against the workshop's left
    edge), and on the API's canvas the box carries on to the canvas's edge."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
    sx = (xs + 0.5 - off[0]) / scale  # source coordinates of each centre
    sy = (ys + 0.5 - off[1]) / scale
    if "rect" in shape:
        x0, y0, x1, y1 = shape["rect"]
        H, W = src_hw
        far = np.full((h, w), np.inf)
        d = np.minimum(np.minimum(sx - x0 if x0 > 0 else far, x1 - sx if x1 < W else far),
                       np.minimum(sy - y0 if y0 > 0 else far, y1 - sy if y1 < H else far))
    else:
        cx, cy, r = shape["circle"]
        d = r - np.hypot(sx - cx, sy - cy)
    return d * scale  # in this grid's own pixels


def placement(e, src_hw):
    h, w = src_hw
    cw, ch = e["canvas"]
    s = min(cw / w, ch / h) if e["scale"] == "fit" else float(e["scale"])
    sw, sh = round(w * s), round(h * s)
    assert sw <= cw and sh <= ch, "the source does not fit the canvas at this scale"
    return s, (sw, sh), ((cw - sw) // 2, (ch - sh) // 2)


def report(what, before, after, box_mask):
    out = ~box_mask
    diff = int((~same(before, after) & out).sum())
    changed = int((~same(before, after) & box_mask).sum())
    print("  %s: %d pixels changed inside the box, %d outside it" % (what, changed, diff))
    if diff:
        sys.exit("  FAIL: an edit touched %d pixels outside its box" % diff)


def seen(a):
    """What a pixel shows over a background: its colour times its alpha, and the alpha."""
    f = a.astype(np.float64)
    if a.shape[2] == 4:
        f[:, :, :3] *= f[:, :, 3:4] / 255.0
    return f


def encoded(e, a, original, union, lossless):
    """Writes the scene and prints what the encoder itself moved outside the boxes."""
    dst = path_of(e["dst"])
    save_webp(a, dst, e["q"], lossless)
    back = load(dst)
    if back.shape != original.shape:
        sys.exit("  FAIL: wrote %s at a different size" % e["dst"])
    out = ~union
    moved = ~same(back, original) & out
    gap = np.abs(seen(back) - seen(original)).max(axis=2)[out]
    print("  wrote %s %dx%d, %d KB; outside every box, against the source as decoded: %d pixels differ, by %.2f levels on average and %d at most%s"
          % (e["dst"], a.shape[1], a.shape[0], os.path.getsize(dst) // 1024, int(moved.sum()), gap.mean(), round(gap.max()),
             "" if lossless else " (WebP re-encoding, not the edit; --lossless makes it 0)"))
    if lossless and moved.any():
        sys.exit("  FAIL: a lossless write changed pixels outside the boxes")


def box_of(rect, shape_hw):
    m = np.zeros(shape_hw, bool)
    x0, y0, x1, y1 = rect
    m[y0:y1, x0:x1] = True
    return m


def scripted(name, op, lossless):
    e = EDITS[name]
    original = load(path_of(e["src"]))
    work = os.path.join(EDIT, name + ".png")
    first = e["ops"].index(op) == 0
    if not first and not os.path.exists(work):
        sys.exit("run %s %s first" % (e["ops"][0], name))
    a = original.copy() if first else load(work)
    before = a.copy()
    hw = a.shape[:2]
    if op == "clear":
        if a.shape[2] != 4:
            sys.exit("clear needs a transparent source; %s has no alpha" % e["src"])
        rect = e["clear"]
        x0, y0, x1, y1 = rect
        a[y0:y1, x0:x1] = 0
        report("clear %s" % (rect,), before, a, box_of(rect, hw))
    elif op == "clone":
        (sx0, sy0, sx1, sy1), (dx, dy) = e["clone"]
        w, h = sx1 - sx0, sy1 - sy0
        rect = (dx, dy, dx + w, dy + h)
        a[dy:dy + h, dx:dx + w] = before[sy0:sy1, sx0:sx1]
        report("clone %s -> %s" % ((sx0, sy0, sx1, sy1), rect), before, a, box_of(rect, hw))
    save_png(a, work)
    # Only the entry's last operation writes the scene into public/: a scene
    # written after `clear` alone would be a counter with a gap in its ledge,
    # one commit away from a child's screen.
    if op != e["ops"][-1]:
        print("  wrote out/edit/%s.png only; run %s %s next, which writes %s" % (name, e["ops"][-1], name, e["dst"]))
        return
    # every box this entry's operations so far have touched
    upto = e["ops"][: e["ops"].index(op) + 1]
    union = np.zeros(hw, bool)
    if "clear" in upto:
        union |= box_of(e["clear"], hw)
    if "clone" in upto:
        (sx0, sy0, sx1, sy1), (dx, dy) = e["clone"]
        union |= box_of((dx, dy, dx + sx1 - sx0, dy + sy1 - sy0), hw)
    encoded(e, a, original, union, lossless)


def prep(name):
    e = EDITS[name]
    src = load(path_of(e["src"]))
    h, w = src.shape[:2]
    s, (sw, sh), (ox, oy) = placement(e, (h, w))
    cw, ch = e["canvas"]
    img = Image.fromarray(src)
    if (sw, sh) != (w, h):
        img = img.resize((sw, sh), Image.LANCZOS)
    placed = np.array(img)
    if src.shape[2] == 4:
        canvas = np.zeros((ch, cw, 4), np.uint8)  # a transparent scene stays transparent around it
        canvas[oy:oy + sh, ox:ox + sw] = placed
    else:  # an opaque one: its own edge pixels carried out to the canvas's edges
        canvas = np.pad(placed, ((oy, ch - sh - oy), (ox, cw - sw - ox), (0, 0)), mode="edge")
    d = inside(e, (h, w), ch, cw, s, (ox, oy))
    # The API's mask: opaque where the picture must stay, transparent where the
    # model may paint, fading over FEATHER px just inside the box's edge.
    alpha = (255 * (1 - np.clip(d / FEATHER, 0, 1))).round().astype(np.uint8)
    mask = np.zeros((ch, cw, 4), np.uint8)
    mask[:, :, 3] = alpha
    save_png(canvas, os.path.join(EDIT, name + "-in.png"))
    save_png(mask, os.path.join(EDIT, name + "-mask.png"))
    back = canvas[oy:oy + sh, ox:ox + sw]
    diff = 0 if (sw, sh) != (w, h) else int((~same(back, src)).sum())
    print("  prep %s: %dx%d at %.3fx, placed at (%d, %d) on %dx%d; wrote out/edit/%s-in.png and -mask.png%s"
          % (name, w, h, s, ox, oy, cw, ch, name,
             "" if (sw, sh) != (w, h) else "; the picture on the canvas differs from the source in %d pixels" % diff))
    if diff:
        sys.exit("  FAIL: the canvas does not carry the source unchanged")


def apply(name, lossless):
    e = EDITS[name]
    src = load(path_of(e["src"]))
    h, w = src.shape[:2]
    s, (sw, sh), (ox, oy) = placement(e, (h, w))
    gp = os.path.join(GAME, name + ".png")
    if not os.path.exists(gp):
        sys.exit("no %s: draw it with gen-sprites.mjs first" % os.path.relpath(gp, ROOT))
    gen = Image.open(gp).convert("RGBA" if src.shape[2] == 4 else "RGB")
    cw, ch = e["canvas"]
    if gen.size != (cw, ch):
        sys.exit("out/game/%s.png is %dx%d; prep made a %dx%d canvas" % (name, gen.width, gen.height, cw, ch))
    gen = gen.crop((ox, oy, ox + sw, oy + sh))
    if gen.size != (w, h):
        gen = gen.resize((w, h), Image.LANCZOS)
    g = np.array(gen).astype(np.float64)
    # The same fade as the API's mask, at the source's own size: 1 deep in the
    # box, 0 on its edge and everywhere outside it, so outside is the source.
    d = inside(e, (h, w), h, w)
    wgt = np.clip(d / (FEATHER / s), 0, 1)[:, :, None]
    blend = (src.astype(np.float64) * (1 - wgt) + g * wgt).round().astype(np.uint8)
    out = np.where(wgt > 0, blend, src)
    box = d > 0
    report("apply", src, out, box)
    save_png(out, os.path.join(EDIT, name + ".png"))
    encoded(e, out, src, box, lossless)


def cut(name):
    srcp, (x0, y0, x1, y1) = CUTS[name]
    a = load(path_of(srcp))[y0:y1, x0:x1]
    p = os.path.join(EDIT, name + ".png")
    save_png(a, p)
    print("  cut %s: %s (%d, %d, %d, %d) -> %s, %dx%d (a reference; nothing edited)"
          % (name, srcp, x0, y0, x1, y1, os.path.relpath(p, ROOT), a.shape[1], a.shape[0]))


def main(argv):
    lossless = "--lossless" in argv
    args = [a for a in argv if a != "--lossless"]
    if len(args) != 2 or args[0] not in ("clear", "clone", "prep", "apply", "cut"):
        sys.exit(__doc__)
    op, name = args
    if op == "cut":
        if name not in CUTS:
            sys.exit("no cut named %s (have: %s)" % (name, ", ".join(CUTS)))
        return cut(name)
    if name not in EDITS:
        sys.exit("no edit named %s (have: %s)" % (name, ", ".join(EDITS)))
    if op not in EDITS[name]["ops"]:
        sys.exit("%s is edited by %s, not %s" % (name, " then ".join(EDITS[name]["ops"]), op))
    if op in ("clear", "clone"):
        scripted(name, op, lossless)
    elif op == "prep":
        prep(name)
    else:
        apply(name, lossless)


if __name__ == "__main__":
    main(sys.argv[1:])
