#!/usr/bin/env python3
"""Test the actual four setup-demo sources in a temporary, dependency-free harness."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import uuid


SOURCE_NAMES = (
    "NativeSetupArtworkImage.swift",
    "NativeSetupDemoClock.swift",
    "NativeSetupDemoScene.swift",
    "NativeSetupDemoView.swift",
)
PACKAGE = '''// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "SonaSetupDemoHarness", platforms: [.macOS(.v13)],
    targets: [.target(name: "SonaSetupDemoHarness", path: "Sources"),
              .testTarget(name: "SetupDemoTests", dependencies: ["SonaSetupDemoHarness"], path: "Tests")])
'''


def bounded_read(path):
    """Reject replacements, partial content and unstable metadata; never probe EOF."""
    for attempt in range(2):
        descriptor = os.open(path, os.O_RDONLY)
        try:
            before = os.fstat(descriptor)
            if not stat.S_ISREG(before.st_mode):
                raise ValueError(f"Expected a regular source file: {path}")
            body = os.pread(descriptor, before.st_size, 0)
            after = os.fstat(descriptor)
            pathname = os.stat(path)
        finally:
            os.close(descriptor)
        identity = lambda value: (value.st_dev, value.st_ino, value.st_size,
                                  value.st_mtime_ns, value.st_ctime_ns)
        if identity(before) == identity(after) == identity(pathname) and len(body) == before.st_size:
            return body
        if attempt == 0:
            print(f"Retrying one source metadata instability: {path}", flush=True)
    raise RuntimeError(f"Source changed during bounded read: {path}")


def digest(body):
    return hashlib.sha256(body).hexdigest()


def json_file(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native-root", type=Path,
                        default=Path(__file__).resolve().parent.parent,
                        help="native/family-ios directory; actual source files are read only")
    parser.add_argument("--output", type=Path,
                        help="Evidence directory (default: a new directory in the system temporary area)")
    args = parser.parse_args()
    native = args.native_root.resolve()
    here = Path(__file__).resolve().parent
    label = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    if args.output is None:
        output = Path(tempfile.mkdtemp(prefix="sona-setup-demo-results-" + label + "-"))
    else:
        output = args.output.resolve()
        output.mkdir(parents=True, exist_ok=False)
    # Evidence survives; the much larger compiler/cache work directory always
    # goes away, including on failure. Neither directory belongs to the app.
    work = Path(tempfile.mkdtemp(prefix="sona-setup-demo-work-"))
    result = {"nativeRoot": str(native), "output": str(output), "buildJobs": 1,
              "actualSourceReadOnly": True, "remotePackageDependencies": False,
              "networkAudioMicrophoneStorageOrCreditServices": False,
              "appOrSimulatorOrPermissionUsed": False,
              "scope": "Ten deterministic presentation-clock/lifecycle/visual-model tests; no installed UI proof"}
    originals = {}
    status = 1
    try:
        paths = [native / "SonaNativePreview/Sources" / name for name in SOURCE_NAMES]
        paths.append(here / "SetupDemoTests.swift")
        for source in paths:
            body = bounded_read(source)
            originals[str(source)] = digest(body)
            folder = "Tests" if source.name == "SetupDemoTests.swift" else "Sources"
            for base in (work, output / "inputs"):
                target = base / folder / source.name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(body)
                if digest(bounded_read(target)) != originals[str(source)]:
                    raise RuntimeError("Copied source did not verify")
        for base in (work, output / "inputs"):
            (base / "Package.swift").write_text(PACKAGE)
        json_file(output / "source-hashes-before.json", originals)
        command = ["swift", "test", "--package-path", str(work),
                   "--scratch-path", str(work / "build"), "--cache-path", str(work / "cache"),
                   "--config-path", str(work / "config"), "--security-path", str(work / "security"),
                   "--disable-sandbox", "--jobs", "1"]
        environment = dict(os.environ)
        environment["CLANG_MODULE_CACHE_PATH"] = str(work / "clang-cache")
        environment["SWIFTPM_MODULECACHE_OVERRIDE"] = str(work / "swift-cache")
        result["command"] = command
        with (output / "swift-tests.log").open("w") as log:
            tested = subprocess.run(command, env=environment, stdout=log, stderr=subprocess.STDOUT)
        result["swiftExitCode"] = tested.returncode
        after = {str(path): digest(bounded_read(path)) for path in paths}
        json_file(output / "source-hashes-after.json", after)
        result["sourceHashesUnchanged"] = originals == after
        result["combinedInputSHA256"] = digest(json.dumps(originals, sort_keys=True, separators=(",", ":")).encode())
        status = tested.returncode if tested.returncode >= 0 else 128 - tested.returncode
        if status == 0 and originals != after:
            status = 1
        result["success"] = status == 0
    except Exception as error:
        result.update(success=False, errorType=type(error).__name__, error=str(error))
        status = 1
    finally:
        shutil.rmtree(work)
        result["temporaryBuildAndCachesRemoved"] = not work.exists()
        json_file(output / "result.json", result)
        print(json.dumps(result, indent=2, sort_keys=True), flush=True)
    return status


if __name__ == "__main__":
    raise SystemExit(main())
