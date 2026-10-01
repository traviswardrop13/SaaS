"""Turn each drawn book into the files the app serves:
out/books/<slug>/{cover,p01..p12}.png -> out/books/<slug>/cut/{cover,p01..p12}.webp,
768 px square (the reader shows a page at full phone width, ~390 pt, so 768
covers a 2x screen). wire-books.mjs copies them into public/assets/books/.

    python3 tools/art/cut-books.py            # every fully drawn book
    python3 tools/art/cut-books.py sid-the-seagull
"""
import os, sys
from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
BOOKS = os.path.join(HERE, "out", "books")
PARTS = ["cover"] + ["p%02d" % n for n in range(1, 13)]

def unframe(im):
    # A drawing sometimes comes back with thin white strips along its edges
    # (the check caught ~10 px bars on four pages, 1 Oct 2026): drop any
    # near-white edge rows/columns, up to 6% a side, then crop to a square.
    w, h = im.size
    def white(box):
        st = ImageStat.Stat(im.crop(box).convert("L"))
        return st.mean[0] > 236 and st.stddev[0] < 12
    t, b, l, r = 0, h, 0, w
    while t < h * 0.06 and white((0, t, w, t + 1)): t += 1
    while h - b < h * 0.06 and white((0, b - 1, w, b)): b -= 1
    while l < w * 0.06 and white((l, 0, l + 1, h)): l += 1
    while w - r < w * 0.06 and white((r - 1, 0, r, h)): r -= 1
    im = im.crop((l, t, r, b)); w, h = im.size; side = min(w, h)
    return im.crop(((w - side) // 2, (h - side) // 2, (w - side) // 2 + side, (h - side) // 2 + side))

def cut_book(slug):
    src = os.path.join(BOOKS, slug)
    missing = [p for p in PARTS if not os.path.exists(os.path.join(src, p + ".png"))]
    if missing: return print("skip", slug, "(missing %s)" % ",".join(missing))
    dst = os.path.join(src, "cut"); os.makedirs(dst, exist_ok=True)
    for p in PARTS:
        im = unframe(Image.open(os.path.join(src, p + ".png")).convert("RGB")).resize((768, 768), Image.LANCZOS)
        im.save(os.path.join(dst, p + ".webp"), "WEBP", quality=84, method=6)
    print("cut", slug)

if __name__ == "__main__":
    slugs = sys.argv[1:] or sorted(d for d in os.listdir(BOOKS) if os.path.isdir(os.path.join(BOOKS, d)))
    for s in slugs: cut_book(s)
