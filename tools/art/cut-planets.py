#!/usr/bin/env python3
"""Cut Rocket Blast's new planets (6 Nov 2026) to the game's size.

gen-sprites.mjs draws each `rocket-planet-<id>` entry of game-sprites.json
into tools/art/out/game/<name>.png (1024x1024, transparent). This trims each
to its painted globe, centres it on a square with a little clear space (the
two planets Codex drew sit the same way), and writes the 384x384 WebP the
game loads:

    python3 tools/art/cut-planets.py            # every planet drawn
    python3 tools/art/cut-planets.py snow,ocean # just these

Nothing is painted, recoloured or cleaned: a crop, a resize and the save.
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools/art/out/game"
DST = ROOT / "public/assets/crafted/game"
IDS = ["strawberry", "snow", "ocean", "flower", "candy", "cloud", "rainbow"]
SIZE, MARGIN = 384, 0.02  # the globe fills 96% of the square, as Codex's do


def cut(pid):
    src = SRC / f"rocket-planet-{pid}.png"
    if not src.exists():
        print("✗", pid, "not drawn yet:", src.relative_to(ROOT))
        return False
    im = Image.open(src).convert("RGBA")
    # the globe: everything more than faintly opaque (a stray soft edge pixel
    # far out would shrink the planet in its square)
    box = im.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    if not box:
        print("✗", pid, "is empty")
        return False
    im = im.crop(box)
    side = round(max(im.size) / (1 - 2 * MARGIN))
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    out = DST / f"rocket-planet-{pid}.webp"
    sq.resize((SIZE, SIZE), Image.LANCZOS).save(out, "WEBP", quality=88, method=6, exact=True)
    print("✓", pid, out.relative_to(ROOT), out.stat().st_size, "bytes")
    return True


if __name__ == "__main__":
    want = sys.argv[1].split(",") if len(sys.argv) > 1 else IDS
    ok = [cut(p) for p in want]
    sys.exit(0 if all(ok) else 1)
