"""Cut each drawn book into pages: out/books/<slug>/{cover,A,B}.png ->
out/books/<slug>/cut/{cover,p01..p12}.webp. The sheets are 3x2 panels on
white gutters; the gutters are found from the picture itself (a model never
draws them exactly on the thirds), and each panel is trimmed of white edge.

    python3 tools/art/cut-books.py            # every drawn book
    python3 tools/art/cut-books.py sid-the-seagull
"""
import os, sys
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
BOOKS = os.path.join(HERE, "out", "books")

def runs(flags):
    out, start = [], None
    for i, f in enumerate(flags + [False]):
        if f and start is None: start = i
        if not f and start is not None: out.append((start, i)); start = None
    return out

def gutters(gray, axis, want):
    # a gutter line is almost all near-white; pick the `want` widest runs away from the edges
    w, h = gray.size
    px = gray.load()
    n, m = (w, h) if axis == "x" else (h, w)
    flags = []
    for i in range(n):
        white = sum(1 for j in range(0, m, 2) if (px[i, j] if axis == "x" else px[j, i]) > 235)
        flags.append(white > 0.9 * (m / 2))
    inner = [r for r in runs(flags) if r[0] > n * 0.15 and r[1] < n * 0.85]
    inner.sort(key=lambda r: r[1] - r[0], reverse=True)
    picks = sorted(inner[:want])
    if len(picks) < want:  # no clean gutters: fall back to even thirds / halves
        return [(round(n * k / (want + 1)), round(n * k / (want + 1))) for k in range(1, want + 1)]
    return picks

def trim(im):
    # drop white border left around a panel
    g = ImageOps.invert(im.convert("L")).point(lambda v: 255 if v > 20 else 0)
    box = g.getbbox()
    return im.crop(box) if box else im

def cut_sheet(path):
    im = Image.open(path).convert("RGB")
    gray = im.convert("L")
    xs = gutters(gray, "x", 2); ys = gutters(gray, "y", 1)
    cols = [(0, xs[0][0]), (xs[0][1], xs[1][0]), (xs[1][1], im.width)]
    rows = [(0, ys[0][0]), (ys[0][1], im.height)]
    return [trim(im.crop((c[0], r[0], c[1], r[1]))) for r in rows for c in cols]

def cut_book(slug):
    src = os.path.join(BOOKS, slug)
    need = [os.path.join(src, p + ".png") for p in ("cover", "A", "B")]
    if not all(os.path.exists(p) for p in need): return print("skip", slug, "(not fully drawn)")
    dst = os.path.join(src, "cut"); os.makedirs(dst, exist_ok=True)
    cover = Image.open(need[0]).convert("RGB").resize((768, 768), Image.LANCZOS)
    cover.save(os.path.join(dst, "cover.webp"), "WEBP", quality=86, method=6)
    pages = cut_sheet(need[1]) + cut_sheet(need[2])
    for i, pg in enumerate(pages):
        pg.save(os.path.join(dst, "p%02d.webp" % (i + 1)), "WEBP", quality=86, method=6)
    print("cut", slug, "->", ", ".join("%dx%d" % p.size for p in pages[:3]), "...")

if __name__ == "__main__":
    slugs = sys.argv[1:] or sorted(d for d in os.listdir(BOOKS) if os.path.isdir(os.path.join(BOOKS, d)))
    for s in slugs: cut_book(s)
