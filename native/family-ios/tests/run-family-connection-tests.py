#!/usr/bin/env python3
"""Run native connection regressions with synthetic storage and intercepted HTTP.

The temporary macOS host imports only local packages. It does not access a real
account or Keychain and does not require editing the app's Xcode project.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--disable-sandbox", action="store_true",
                        help="Disable SwiftPM's nested build sandbox when the host already isolates it.")
    options = parser.parse_args()
    project = Path(__file__).resolve().parents[3]
    modules = project / "native/family-ios/modules"
    sources = project / "native/family-ios/SonaNativePreview/Sources"
    with tempfile.TemporaryDirectory(prefix="sona-connection-tests-") as folder:
        host = Path(folder)
        target = host / "Sources/ConnectionHost"
        tests = host / "Tests/ConnectionHostTests"
        target.mkdir(parents=True)
        tests.mkdir(parents=True)
        for filename in ("FamilyLoginClient.swift", "FamilyConnectionScope.swift", "FamilyConnectionStore.swift"):
            shutil.copy2(sources / filename, target / filename)
        (target / "NativeGame.swift").write_text("enum NativeGame: String { case sprint, slice }\n")
        shutil.copy2(Path(__file__).with_name("FamilyConnectionScopeTests.swift"), tests / "ConnectionTests.swift")
        # Exact local copies avoid asking the managed Git checkout for tags
        # while the desktop holds a worktree metadata operation.
        for package in ("SonaFamilyMigration", "SonaFamilyAccess"):
            shutil.copytree(modules / package, host / package,
                            ignore=shutil.ignore_patterns(".build", ".swiftpm", ".git"))
        migration = json.dumps(str(host / "SonaFamilyMigration"))
        access = json.dumps(str(host / "SonaFamilyAccess"))
        (host / "Package.swift").write_text(f'''// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "ConnectionHost", platforms: [.macOS(.v13)], dependencies: [
    .package(path: {migration}), .package(path: {access})
], targets: [
    .target(name: "ConnectionHost", dependencies: [
        .product(name: "SonaFamilyMigration", package: "SonaFamilyMigration"),
        .product(name: "SonaFamilyAccess", package: "SonaFamilyAccess")
    ]),
    .testTarget(name: "ConnectionHostTests", dependencies: ["ConnectionHost"])
])
''')
        command = ["swift", "test", "--package-path", str(host), "--scratch-path", str(host / "build")]
        if options.disable_sandbox:
            command.append("--disable-sandbox")
        result = subprocess.run(command, check=False)
        return result.returncode


if __name__ == "__main__":
    sys.exit(main())
