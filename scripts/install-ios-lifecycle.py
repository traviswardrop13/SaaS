#!/usr/bin/env python3
"""Install scene support in the generated (git-ignored) Capacitor iOS app.

AppDelegate.swift is already in the Xcode Sources phase. Appending our scene
class there avoids a manual target-membership step that could leave a broken
archive. Existing app-delegate logic and all unrelated plist keys are preserved.
"""
import argparse
from pathlib import Path
import plistlib
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
START = "// BEGIN SONA SCENE LIFECYCLE"
END = "// END SONA SCENE LIFECYCLE"


def install(app):
    delegate = app / "AppDelegate.swift"
    info = app / "Info.plist"
    source = delegate.read_text()
    with info.open("rb") as stream:
        config = plistlib.load(stream)
    scene = (ROOT / "native/ios/App/SceneDelegate.swift").read_text()
    if START in source:
        source, count = re.subn(re.escape(START) + r".*?" + re.escape(END),
                                "", source, flags=re.S)
        if count != 1:
            raise ValueError("Unexpected scene markers; inspect AppDelegate before updating.")
    if "class SceneDelegate" in source or (app / "SceneDelegate.swift").exists():
        raise ValueError("Existing SceneDelegate found; integrate it instead of replacing it.")
    manifest = {
        "UIApplicationSupportsMultipleScenes": False,
        "UISceneConfigurations": {
            "UIWindowSceneSessionRoleApplication": [{
                "UISceneConfigurationName": "Sona",
                "UISceneClassName": "UIWindowScene",
                "UISceneDelegateClassName": "$(PRODUCT_MODULE_NAME).SceneDelegate",
                "UISceneStoryboardFile": "Main",
            }]
        },
    }
    existing = config.get("UIApplicationSceneManifest")
    if existing and existing != manifest:
        raise ValueError("Existing scene configuration found; inspect it before updating.")
    config["UIApplicationSceneManifest"] = manifest
    # All supported iOS versions use the scene's Main storyboard, not an app window.
    config.pop("UIMainStoryboardFile", None)
    updated = source.rstrip() + "\n\n" + START + "\n" + scene + END + "\n"
    encoded = plistlib.dumps(config, sort_keys=False)
    if updated == delegate.read_text() and encoded == info.read_bytes():
        print("Scene lifecycle already installed.")
        return
    backup = Path(tempfile.mkdtemp(prefix="sona-ios-lifecycle-"))
    for file in (delegate, info):
        shutil.copy2(file, backup / file.name)
    delegate.write_text(updated)
    info.write_bytes(encoded)
    print(f"Scene lifecycle installed in {app}; originals saved in {backup}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", nargs="?", type=Path, default=ROOT / "ios/App/App")
    install(parser.parse_args().app.resolve())
