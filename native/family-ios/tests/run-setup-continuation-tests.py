#!/usr/bin/env python3
"""Check setup microphone/handoff with held fake answers; never use device audio."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    here = Path(__file__).resolve().parent
    app = here.parent / "SonaNativePreview/Sources"
    source_path = app / "NativeSetupContinuationView.swift"
    source = source_path.read_text()
    enum_start = "enum NativeSetupMicrophoneResult {"
    controller_start = "@MainActor final class NativeSetupContinuationController:"
    controller_end = "@MainActor struct NativeSetupContinuationView:"
    for anchor in (enum_start, controller_start, controller_end):
        if source.count(anchor) != 1:
            raise RuntimeError("Controller boundary changed: " + anchor)
    result_enum = source[source.index(enum_start):].split("\n", 1)[0]
    controller = source[source.index(controller_start):source.index(controller_end)]
    checks = here / "SetupContinuationChecks.swift"
    print("Actual source SHA256: " + hashlib.sha256(source_path.read_bytes()).hexdigest(), flush=True)
    print("Checks SHA256: " + hashlib.sha256(checks.read_bytes()).hexdigest(), flush=True)
    with tempfile.TemporaryDirectory(prefix="sona-setup-continuation-") as folder:
        host = Path(folder)
        extracted = host / "ActualContinuationController.swift"
        extracted.write_text("import Foundation\nimport Combine\n" + result_enum + "\n\n" + controller)
        executable = host / "setup-continuation-checks"
        command = ["swiftc", "-module-cache-path", str(host / "module-cache"),
                   str(extracted), str(checks), "-o", str(executable)]
        result = subprocess.run(command, check=False)
        if result.returncode:
            return result.returncode
        return subprocess.run([str(executable)], check=False).returncode


if __name__ == "__main__":
    sys.exit(main())
