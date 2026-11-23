#!/usr/bin/env python3
"""Exercise the real Feed state machine with local synthetic input only."""
from pathlib import Path
import json
import shutil
import subprocess
import sys
import tempfile


def main():
    root = Path(__file__).resolve().parents[3]
    with tempfile.TemporaryDirectory(prefix="sona-feed-contract-") as folder:
        host = Path(folder)
        target = host / "Sources/FeedContract"
        target.mkdir(parents=True)
        app = root / "native/family-ios/SonaNativePreview/Sources"
        for name in ("GameSpeechGatePlan.swift", "NativeFeedSelection.swift", "NativeFeedController.swift", "NativePracticeOccurrence.swift"):
            shutil.copy2(app / name, target / name)
        shutil.copy2(Path(__file__).with_name("NativeFeedContract.swift"), target / "Contract.swift")
        # The real shared network service is tested separately. This guard means
        # a missing injected provider fails rather than making a live request.
        (target / "NarrationGuard.swift").write_text('''import Foundation
import SonaSpeechCore
@MainActor final class GameSpeechNarration {
 enum Failure: Error { case unavailable }
 func authoredPrompt(_ text: String, voice: String, volume: Float) async throws -> PracticePrompt { throw Failure.unavailable }
 func goPrompt(voice: String, volume: Float) async -> PracticePrompt? { nil }
}
''')
        # SwiftPM asks Git for local dependency tags. A clean copy also makes
        # this fixture independent of the desktop's managed-worktree lock.
        core_path = host / "SonaSpeechCore"
        shutil.copytree(root / "native/family-ios/modules/SonaSpeechCore", core_path,
                        ignore=shutil.ignore_patterns(".build", ".swiftpm", ".git"))
        core = json.dumps(str(core_path))
        (host / "Package.swift").write_text(f'''// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "FeedContract", platforms: [.macOS(.v13)], dependencies: [.package(path: {core})], targets: [
 .executableTarget(name: "FeedContract", dependencies: [.product(name: "SonaSpeechCore", package: "SonaSpeechCore")])
])
''')
        return subprocess.run(["swift", "run", "--package-path", str(host),
                               "--scratch-path", str(host / "build"), "FeedContract"], check=False).returncode


if __name__ == "__main__":
    sys.exit(main())
