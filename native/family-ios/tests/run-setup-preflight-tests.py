#!/usr/bin/env python3
"""Run the 13 setup-preflight regressions with fake clients and a manual clock.

Copies the exact current app source into a temporary macOS SwiftPM harness.
Dependencies are the actual local SDK-neutral packages, referenced by absolute
path. No SDK, accounts, permissions, simulator, or remote dependency is used.
Evidence is retained; runner-owned build/cache directories are removed on exit.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


PACKAGES = ("SonaFamilyMigration", "SonaFamilyAccess", "SonaFamilyStorefront")


def temporary_path(raw):
    path = Path(raw).expanduser().resolve()
    roots = {Path("/tmp").resolve(), Path(tempfile.gettempdir()).resolve()}
    if not any(path != root and root in path.parents for root in roots):
        raise ValueError("Harness, scratch and cache paths must be below a temporary directory")
    return path


def stable_bytes(path):
    with path.open("rb") as source:
        before = os.fstat(source.fileno())
        data = source.read()
        after = os.fstat(source.fileno())
    current = path.stat()
    signature = lambda stat: (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)
    if signature(before) != signature(after) or signature(after) != signature(current):
        raise RuntimeError("Input changed while being read: " + str(path))
    return data


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument("--output-dir", type=Path, help="New temporary directory for retained source, log and manifest")
    parser.add_argument("--scratch-path", type=Path, help="Optional reusable scratch directory under tmp; retained")
    parser.add_argument("--cache-path", type=Path, help="Optional reusable cache directory under tmp; retained")
    parser.add_argument("--disable-sandbox", action="store_true", help="Disable SwiftPM's nested build sandbox")
    parser.add_argument("--stage-only", action="store_true", help="Validate/copy inputs and write the manifest without building")
    options = parser.parse_args()
    root = options.project_root.resolve()
    if options.output_dir:
        host = temporary_path(options.output_dir)
        host.mkdir(parents=True, exist_ok=False)
    else:
        host = Path(tempfile.mkdtemp(prefix="sona-setup-preflight-tests-")).resolve()
    scratch = temporary_path(options.scratch_path or host / "build")
    cache = temporary_path(options.cache_path or host / "cache")
    owned = [host / "module-cache", host / "config", host / "security"]
    if options.scratch_path is None:
        owned.append(scratch)
    if options.cache_path is None:
        owned.append(cache)
    manifest = {"projectRoot": str(root), "harness": str(host), "stageOnly": options.stage_only,
                "syntheticOnly": True, "jobs": 1, "inputs": {}, "exitCode": 1}
    manifest_path, log = host / "manifest.json", host / "swift-test.log"
    try:
        modules = root / "native/family-ios/modules"
        package_paths = {name: (modules / name).resolve() for name in PACKAGES}
        allowed = set(package_paths.values())
        for package in package_paths.values():
            path = package / "Package.swift"
            text = stable_bytes(path).decode("utf-8")
            # Fail closed if these SDK-neutral packages gain another dependency.
            # Only literal local path dependencies within this known set resolve.
            for entry in re.findall(r"\.package\s*\((.*?)\)", text, re.S):
                match = re.fullmatch(r'\s*path\s*:\s*"([^"\n]+)"\s*', entry)
                if not match or (package / match.group(1)).resolve() not in allowed:
                    raise RuntimeError("Nonlocal or unexpected package dependency in " + str(path))
            paths = [path] + sorted(p for p in (package / "Sources").rglob("*") if p.is_file())
            for item in paths:
                manifest["inputs"][str(item)] = digest(stable_bytes(item))
        source = root / "native/family-ios/SonaNativePreview/Sources/NativeSetupPreflight.swift"
        tests = Path(__file__).with_name("SetupPreflightTests.swift").resolve()
        target = host / "Sources/SetupPreflightHarness"
        test_target = host / "Tests/SetupPreflightHarnessTests"
        target.mkdir(parents=True)
        test_target.mkdir(parents=True)
        for original, destination in [(source, target / source.name), (tests, test_target / tests.name)]:
            data = stable_bytes(original)
            manifest["inputs"][str(original)] = digest(data)
            destination.write_bytes(data)
        manifest["sourceSHA256"] = manifest["inputs"][str(source)]
        manifest["testSHA256"] = manifest["inputs"][str(tests)]
        manifest["runnerSHA256"] = digest(stable_bytes(Path(__file__).resolve()))
        dependencies = ",\n".join(" .package(path: " + json.dumps(str(package_paths[name]), ensure_ascii=False) + ")" for name in PACKAGES)
        products = ", ".join('.product(name: "' + name + '", package: "' + name + '")' for name in PACKAGES)
        (host / "Package.swift").write_text(f'''// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "SetupPreflightHarness", platforms: [.macOS(.v13)], dependencies: [
{dependencies}
], targets: [
 .target(name: "SetupPreflightHarness", dependencies: [{products}]),
 .testTarget(name: "SetupPreflightHarnessTests", dependencies: ["SetupPreflightHarness", {products}])
])
''')
        command = ["swift", "test", "--package-path", str(host), "--scratch-path", str(scratch),
                   "--cache-path", str(cache), "--config-path", str(host / "config"),
                   "--security-path", str(host / "security"), "--jobs", "1"]
        if options.disable_sandbox:
            command.append("--disable-sandbox")
        manifest["command"] = command
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print("Preflight evidence: " + str(host), flush=True)
        print("App source SHA256: " + manifest["sourceSHA256"], flush=True)
        if options.stage_only:
            manifest["exitCode"] = 0
        else:
            env = os.environ.copy()
            env["CLANG_MODULE_CACHE_PATH"] = str(host / "module-cache")
            env["SWIFTPM_MODULECACHE_OVERRIDE"] = str(host / "module-cache")
            with log.open("w") as output:
                result = subprocess.run(command, env=env, stdout=output, stderr=subprocess.STDOUT, check=False)
            manifest["exitCode"] = result.returncode
            print("Swift test log: " + str(log), flush=True)
        manifest["inputsUnchanged"] = all(digest(stable_bytes(Path(path))) == expected for path, expected in manifest["inputs"].items())
        if not manifest["inputsUnchanged"]:
            manifest["exitCode"] = 1
            manifest["error"] = "Source inputs changed during the run"
    except Exception as error:
        manifest["exitCode"] = 1
        manifest["error"] = str(error)
        print(str(error), file=sys.stderr)
    finally:
        for path in owned:
            if path.is_dir():
                shutil.rmtree(path)
        manifest["retainedEvidence"] = [str(host / "Package.swift"), str(target) if "target" in locals() else "", str(test_target) if "test_target" in locals() else "", str(log), str(manifest_path)]
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print("Manifest: " + str(manifest_path), flush=True)
        print("Exit code: " + str(manifest["exitCode"]), flush=True)
    return manifest["exitCode"] if manifest["exitCode"] >= 0 else 128 - manifest["exitCode"]


if __name__ == "__main__":
    sys.exit(main())
