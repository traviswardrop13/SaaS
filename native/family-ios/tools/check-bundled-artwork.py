#!/usr/bin/env python3
"""Check an Xcode-built family app against the original book, story and Buddy Shop artwork."""
import argparse
import json
from pathlib import Path
import re
import subprocess


ART_PATH = re.compile(r"/assets/(?:books|adventure|crafted)/[a-z0-9/_-]+\.webp")


def artwork_paths(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from artwork_paths(child)
    elif isinstance(value, list):
        for child in value:
            yield from artwork_paths(child)
    elif isinstance(value, str) and ART_PATH.fullmatch(value):
        yield value.removeprefix("/assets/")


def check_shop_catalog(app):
    catalog = Path(__file__).resolve().parents[1] / "SonaNativePreview" / "Assets.xcassets"
    expected = {item.stem for item in catalog.glob("*.imageset")
                if item.name.startswith(("buddy-", "customize-", "hat-"))}
    if not expected:
        raise ValueError("No original Buddy Shop catalog entries found")
    renditions = json.loads(subprocess.check_output(["/usr/bin/assetutil", "--info", str(app / "Assets.car")]))
    missing = expected - {entry.get("Name") for entry in renditions}
    if missing:
        print(f"{len(missing)} Buddy Shop artwork entries missing from Assets.car")
        for name in sorted(missing)[:10]:
            print(name)
        return 1
    print(f"{len(expected)} Buddy Shop artwork entries are available in the compiled app")
    return 0


def check(app, assets):
    expected = set()
    for name in ("Books.json", "Adventures.json"):
        catalog = app / name
        expected.update(artwork_paths(json.loads(catalog.read_text())))

    game_art = assets / "crafted" / "game"
    expected.update(file.relative_to(assets).as_posix() for file in game_art.glob("*.webp"))
    if not expected or not game_art.is_dir():
        raise ValueError("No artwork catalog or original game assets found")

    missing = []
    different = []
    for name in sorted(expected):
        original = assets / name
        bundled = app / name
        if not bundled.is_file():
            missing.append(name)
        elif bundled.read_bytes() != original.read_bytes():
            different.append(name)

    if missing or different:
        print(f"{len(missing)} missing and {len(different)} changed artwork files")
        for name in (missing + different)[:10]:
            print(name)
        return 1
    print(f"{len(expected)} original artwork files are present in the compiled app and match the source bytes")
    return check_shop_catalog(app)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", type=Path)
    parser.add_argument("--assets", type=Path, default=Path(__file__).resolve().parents[3] / "public" / "assets")
    arguments = parser.parse_args()
    raise SystemExit(check(arguments.app, arguments.assets))
