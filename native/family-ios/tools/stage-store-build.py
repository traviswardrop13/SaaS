#!/usr/bin/env python3
"""Stage a separate, compile-only copy of the family app with the pinned store SDK."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import plistlib
import re
import shutil
import subprocess


VERSION = "5.80.3"
REVISION = "8969bf1feaca2cc9efaa7630cd148cec5005f2f8"
FAMILY = Path(__file__).resolve().parents[1]
PREFIX = "7060AFA200000000000000"


def stage(destination: Path, sdk_stage: Path | None) -> None:
    if not destination.is_relative_to(Path("/private/tmp")) or destination.exists():
        raise ValueError("Choose a new directory under /private/tmp")
    source = FAMILY / "SonaNativePreview.xcodeproj"
    tree = plistlib.loads(subprocess.check_output(["plutil", "-convert", "xml1", "-o", "-", str(source / "project.pbxproj")]))
    objects = tree["objects"]
    package = {"isa": "XCRemoteSwiftPackageReference", "repositoryURL": "https://github.com/RevenueCat/purchases-ios-spm.git",
               "requirement": {"kind": "exactVersion", "version": VERSION}}
    if sdk_stage:
        marker = json.loads((sdk_stage / "sdk-origin.json").read_text())
        if marker != {"revision": REVISION, "version": VERSION}:
            raise ValueError("The local SDK stage does not match the shipping SDK pin")
        package_source = sdk_stage / "Vendor/RevenueCat"
        if not (package_source / "Package.swift").is_file():
            raise ValueError("The local SDK stage has no Swift package")
        package = {"isa": "XCLocalSwiftPackageReference", "relativePath": "Vendor/RevenueCat"}

    def add(suffix, value):
        key = PREFIX + suffix
        if key in objects:
            raise ValueError("The preview project reused a generated object ID")
        objects[key] = value
        return key

    reference = add("50", package)
    product = add("51", {"isa": "XCSwiftPackageProductDependency", "package": reference, "productName": "RevenueCat"})
    link = add("52", {"isa": "PBXBuildFile", "productRef": product})
    objects[PREFIX + "01"]["packageReferences"].append(reference)
    objects[PREFIX + "06"]["packageProductDependencies"].append(product)
    objects[PREFIX + "0A"]["files"].append(link)
    for suffix, name in [(53, "RevenueCatFamilyPurchaseClient.swift"), (55, "RevenueCatFamilyStorefrontClient.swift")]:
        file = add(str(suffix), {"isa": "PBXFileReference", "lastKnownFileType": "sourcecode.swift", "path": f"adapters/{name}", "sourceTree": "SOURCE_ROOT"})
        objects[PREFIX + "03"]["children"].append(file)
        build_file = add(str(suffix + 1), {"isa": "PBXBuildFile", "fileRef": file})
        objects[PREFIX + "09"]["files"].append(build_file)

    config = (FAMILY / "Preview.xcconfig").read_text()
    shipping = (FAMILY.parents[1] / "public/sona.js").read_text()
    public_key = re.search(r'const IAP_KEY = "(appl_[A-Za-z0-9]+)"', shipping)
    if not public_key:
        raise ValueError("The existing publishable iOS configuration changed")
    config += "\nINFOPLIST_FILE = StageStoreInfo.plist\nCODE_SIGNING_ALLOWED = NO\n"
    # Keep the preview bundle ID. The production SDK code compiles in this
    # stage, but its runtime identity check cannot open the real store.
    destination.mkdir()
    if sdk_stage:
        staged_package = destination / "Vendor/RevenueCat"
        shutil.copytree(package_source, staged_package, ignore=shutil.ignore_patterns(".build", ".swiftpm"))
        manifest = staged_package / "Package.swift"
        source_manifest = manifest.read_text()
        if source_manifest.count("platforms: [.macOS(.v13)]") != 1:
            raise ValueError("The verified package manifest changed")
        manifest.write_text(source_manifest.replace("platforms: [.macOS(.v13)]", "platforms: [.macOS(.v13), .iOS(.v15)]"))
    for directory in ["SonaNativePreview", "modules", "adapters"]:
        shutil.copytree(FAMILY / directory, destination / directory,
                        ignore=shutil.ignore_patterns(".build", ".swiftpm"))
    project = destination / source.name
    shutil.copytree(source, project, ignore=shutil.ignore_patterns("xcuserdata"))
    (project / "project.pbxproj").write_bytes(plistlib.dumps(tree, sort_keys=False))
    (destination / "Preview.xcconfig").write_text(config)
    (destination / "StageStoreInfo.plist").write_bytes(plistlib.dumps({"SonaRevenueCatPublicKey": public_key[1]}))
    print(project)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--sdk-stage", type=Path)
    arguments = parser.parse_args()
    stage(arguments.output.resolve(), arguments.sdk_stage.resolve() if arguments.sdk_stage else None)
