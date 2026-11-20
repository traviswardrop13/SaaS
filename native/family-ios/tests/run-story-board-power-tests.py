"""Compile the exact board clocks and interaction policies without an app or mic."""
from pathlib import Path
import subprocess
import tempfile


def main():
    project = Path(__file__).resolve().parents[1]
    app = project / "SonaNativePreview" / "Sources"

    def section(file, start, end):
        source = (app / file).read_text()
        return source.split(start, 1)[1].split(end, 1)[0]

    clock = "struct StoryMovePowerClock" + section(
        "StoryMovePower.swift", "struct StoryMovePowerClock", "final class StoryMovePower"
    )
    pieces = [
        "import Foundation",
        clock,
        section("StoryVillageGamesView.swift", "// BEGIN VILLAGE_POWER_GEOMETRY", "// END VILLAGE_POWER_GEOMETRY"),
        section("StoryWorkshopGamesView.swift", "// BEGIN WORKSHOP_POWER_GEOMETRY", "// END WORKSHOP_POWER_GEOMETRY"),
        section("MeadowGamesView.swift", "// BEGIN MEADOW_FLOWER_WATER", "// END MEADOW_FLOWER_WATER"),
    ]
    helpers = (app / "NativeSayPlayRound.swift").read_text().split("private var supportsHelp", 1)[1]
    supported = helpers.split("private var boardProgress", 1)[0]
    assert all(
        f'"{board}"' in supported
        for board in (
            "waterwheel", "postboat", "bakery", "frontdoor", "lantern", "trainline",
            "kite", "nestlift", "concert", "rooftops", "observatory", "flower",
        )
    ), "All twelve boards need the same-word help callback"

    with tempfile.TemporaryDirectory(prefix="sona-story-power-tests-") as folder:
        build = Path(folder)
        source = build / "Power.swift"
        source.write_text("\n".join(pieces).replace("private enum ", "enum ").replace("private struct ", "struct "))
        executable = build / "story-power"
        subprocess.run([
            "swiftc", "-module-cache-path", str(build / "cache"), str(source),
            str(Path(__file__).with_name("StoryBoardPowerContract.swift")), "-o", str(executable),
        ], check=True)
        subprocess.run([str(executable)], check=True)


if __name__ == "__main__":
    main()
