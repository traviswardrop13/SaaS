#!/usr/bin/env python3
"""All weekly-report tests use exact local packages and fictional transport."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import tempfile


def main():
    root = Path(__file__).resolve().parents[3]
    with tempfile.TemporaryDirectory(prefix="sona-weekly-tests-") as folder:
        host = Path(folder)
        for package in ("SonaFamilyMigration", "SonaFamilyRules"):
            shutil.copytree(root / "native/family-ios/modules" / package, host / package,
                            ignore=shutil.ignore_patterns(".build", ".swiftpm", ".git"))
        negative = os.environ.get("SONA_REPORT_NEGATIVE_CONTROL") == "unlisted-field"
        if negative:
            file = host / "SonaFamilyMigration/Sources/SonaFamilyMigration/NativeFamilyWeeklyReport.swift"
            original = file.read_text()
            pin = 'Set(body.keys).isSubset(of: ["email", "dev", "weeks", "quiet", "off", "on"]),'
            assert original.count(pin) == 1
            file.write_text(original.replace(pin, "true,", 1))
        target = host / "Sources/ReportHost"
        tests = host / "Tests/ReportHostTests"
        target.mkdir(parents=True)
        tests.mkdir(parents=True)
        shutil.copy2(root / "native/family-ios/SonaNativePreview/Sources/NativeFamilyReportStore.swift", target / "ReportStore.swift")
        shutil.copy2(Path(__file__).with_name("NativeWeeklyReportTests.swift"), tests / "ReportTests.swift")
        migration = json.dumps(str(host / "SonaFamilyMigration"))
        rules = json.dumps(str(host / "SonaFamilyRules"))
        (host / "Package.swift").write_text(f'''// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "ReportHost", platforms: [.macOS(.v13)], dependencies: [
 .package(path: {migration}), .package(path: {rules})
], targets: [
 .target(name: "ReportHost", dependencies: ["SonaFamilyMigration", "SonaFamilyRules"]),
 .testTarget(name: "ReportHostTests", dependencies: ["ReportHost", "SonaFamilyMigration", "SonaFamilyRules"])
])
''')
        command = ["swift", "test", "--disable-sandbox", "--package-path", str(host)]
        if negative:
            command += ["--filter", "testMalformedProjectionCannotCommitOrReachTransport"]
        result = subprocess.run(command, check=False)
        if result.returncode or negative:
            return result.returncode
        return subprocess.run(["swift", "test", "--disable-sandbox", "--package-path", str(host / "SonaFamilyRules"),
                               "--filter", "NativeWeeklyReportPolicyTests"], check=False).returncode


if __name__ == "__main__":
    sys.exit(main())
