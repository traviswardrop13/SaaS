#!/usr/bin/env python3
"""Switch on Apple's on-device listening check (SonaSpeech) in the iOS app.

The plugin's source lives in plugins/sona-speech. It was written in August but
never reached the app: nothing compiled it, nothing registered it, and the app
had no speech-permission text, so every practice try was judged by the looser
sound-shape check. This does the three steps, the same way
install-ios-lifecycle.py installs the scene fix:

1. Compiles the plugin through AppDelegate.swift, which is already in the
   Xcode Sources phase, so there is no manual target-membership step. If the
   project already compiles a copy of the plugin, that copy is brought up to
   date instead (two copies of one class cannot both compile).
2. Registers it with Capacitor. Local plugins are not found on their own; the
   bridge view controller has to register them. The app's storyboard names
   that controller:
   - MainViewController (native/README.md): the registration is added to it,
     wherever the project compiles it from;
   - Capacitor's own CAPBridgeViewController (no local plugin was ever set up):
     a small SonaBridgeViewController that registers SonaSpeech is compiled
     through AppDelegate.swift too, and the storyboard is pointed at it.
3. Adds NSSpeechRecognitionUsageDescription to Info.plist. Without it iOS
   closes the app the moment the speech permission is asked.

It changes nothing when it meets a project it does not understand; it says
what it found instead. Originals are backed up to a temporary directory, and
running it again is safe. `--check` reports what it would do, and writes
nothing.
"""
import argparse
from pathlib import Path
import plistlib
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins/sona-speech/ios/Sources/SonaSpeechPlugin/SonaSpeechPlugin.swift"
START = "// BEGIN SONA SPEECH PLUGIN"
END = "// END SONA SPEECH PLUGIN"
REGISTER = "bridge?.registerPluginInstance(SonaSpeechPlugin())"
BRIDGE = "SonaBridgeViewController"
BRIDGE_SOURCE = """
// The app's bridge view controller: Capacitor's own, plus Sona's local
// plugins, which Capacitor does not find by itself. The storyboard names it
// by this Objective-C name, so no module name is needed there.
@objc(SonaBridgeViewController)
class SonaBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SonaSpeechPlugin())
    }
}
"""
USAGE_KEY = "NSSpeechRecognitionUsageDescription"
USAGE = ("Sona checks your child's practice words right on this iPhone. "
         "Speech recognition runs on the phone, and no audio is sent anywhere.")


def read(path):
    return path.read_text() if path and path.exists() else ""


def pbx_paths(pbx, filename):
    """Where the Xcode project says a file lives (path values that name it)."""
    return re.findall(r'path = "?([^";]*' + re.escape(filename) + r')"?;', pbx)


def compiled(pbx, filename):
    return (filename + " in Sources") in pbx


def resolve(app, found):
    """Turn a project path into a real file, trying the places Xcode resolves from."""
    for raw in found:
        p = Path(raw)
        for candidate in ([p] if p.is_absolute() else [app / p, app.parent / p, app.parent.parent / p]):
            if candidate.exists():
                return candidate.resolve()
        if raw.endswith("native/ios/App/MainViewController.swift"):
            return (ROOT / "native/ios/App/MainViewController.swift").resolve()
    return None


def bridge_class(storyboard):
    tags = re.findall(r"<viewController\b[^>]*>", storyboard)
    for tag in tags:
        m = re.search(r'customClass="([^"]+)"', tag)
        if m:
            return m.group(1), tag
    return None, None


def plan(app):
    """Work out every change without writing anything. Raises on anything unexpected."""
    delegate, info = app / "AppDelegate.swift", app / "Info.plist"
    for need in (delegate, info):
        if not need.exists():
            raise ValueError(f"{need} not found. Pass the App folder: ios/App/App")
    pbx = read(app.parent / "App.xcodeproj/project.pbxproj")
    spm = read(app.parent / "CapApp-SPM/Package.swift")
    if re.search(r"sona-speech|SonaSpeech", spm) or "SonaSpeechPlugin" in read(app / "capacitor.config.json"):
        raise ValueError("SonaSpeech is already in the app as a package (CapApp-SPM or capacitor.config.json). "
                         "Use that, or remove it before running this.")
    notes, writes = [], {}
    source = read(delegate)
    if START in source:
        source, count = re.subn(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", source, flags=re.S)
        if count != 1:
            raise ValueError("Unexpected speech-plugin markers; inspect AppDelegate before updating.")
    plugin = PLUGIN.read_text().rstrip() + "\n"

    # 1. the plugin: update a copy the project already compiles, else compile it here
    swift = [p for p in app.rglob("*.swift") if p != delegate]
    copies = [p for p in swift if "class SonaSpeechPlugin" in p.read_text()]
    if not copies and compiled(pbx, "SonaSpeechPlugin.swift"):
        elsewhere = resolve(app, pbx_paths(pbx, "SonaSpeechPlugin.swift"))
        if not elsewhere:
            raise ValueError("The project compiles a SonaSpeechPlugin.swift this script cannot find "
                             f"({', '.join(pbx_paths(pbx, 'SonaSpeechPlugin.swift')) or 'no path'}).")
        copies = [elsewhere]
    block = ""
    if copies:
        if copies[0].resolve() != PLUGIN.resolve() and copies[0].read_text() != plugin:
            writes[copies[0]] = plugin
            notes.append(f"updated the plugin the project already compiles: {copies[0]}")
        else:
            notes.append(f"the plugin is already compiled from {copies[0]}")
    else:
        block += plugin
        notes.append("compiles the plugin through AppDelegate.swift")

    # 2. registration, through whichever controller the storyboard loads
    board = app / "Base.lproj/Main.storyboard"
    storyboard = read(board)
    name, tag = bridge_class(storyboard)
    if name == "MainViewController":
        controller = next((p for p in swift if re.search(r"class\s+MainViewController\b", p.read_text())), None)
        if not controller:
            controller = resolve(app, pbx_paths(pbx, "MainViewController.swift"))
        if not controller:
            raise ValueError("The storyboard loads MainViewController, but this script cannot find the file the "
                             f"project compiles it from ({', '.join(pbx_paths(pbx, 'MainViewController.swift')) or 'no path'}). "
                             f"Add `{REGISTER}` to its capacitorDidLoad() by hand.")
        control = controller.read_text()
        if REGISTER in control:
            notes.append(f"MainViewController already registers it ({controller})")
        else:
            audio = re.search(r"^([ \t]*)bridge\?\.registerPluginInstance\(SonaAudioPlugin\(\)\)[ \t]*$", control, flags=re.M)
            hook = re.search(r"override func capacitorDidLoad\(\)\s*\{[ \t]*\n", control)
            if audio:
                control = control[:audio.end()] + "\n" + audio.group(1) + REGISTER + control[audio.end():]
            elif hook:
                control = control[:hook.end()] + "        " + REGISTER + "\n" + control[hook.end():]
            else:
                raise ValueError(f"No capacitorDidLoad() in {controller}; register {REGISTER} by hand.")
            writes[controller] = control
            notes.append(f"registered it in MainViewController ({controller})")
    elif name in ("CAPBridgeViewController", BRIDGE):
        block += BRIDGE_SOURCE
        if name == "CAPBridgeViewController":
            new_tag = re.sub(r'\s+customModuleProvider="[^"]*"', "", re.sub(r'\s+customModule="[^"]*"', "",
                              tag.replace('customClass="CAPBridgeViewController"', f'customClass="{BRIDGE}"')))
            writes[board] = storyboard.replace(tag, new_tag, 1)
            notes.append(f"the storyboard loaded Capacitor's own controller; it now loads {BRIDGE}, which registers it")
        else:
            notes.append(f"the storyboard already loads {BRIDGE}")
    else:
        raise ValueError(f"Could not tell which controller {board} loads (found: {name or 'nothing'}). "
                         "Set its Bridge View Controller's class by hand, or send this message to Claude.")

    if block or START in read(delegate):
        updated = source.rstrip() + "\n" + ("\n" + START + "\n" + block.rstrip() + "\n" + END + "\n" if block else "")
        if updated != read(delegate):
            writes[delegate] = updated

    # 3. the speech-permission text
    with info.open("rb") as stream:
        config = plistlib.load(stream)
    if not config.get(USAGE_KEY):
        config[USAGE_KEY] = USAGE
        writes[info] = plistlib.dumps(config, sort_keys=False)
        notes.append("added the speech-permission text to Info.plist")
    return writes, notes


def install(app, check=False):
    writes, notes = plan(app)
    for note in notes:
        print("- " + note)
    if not writes:
        print("Apple's listening check is already installed.")
        return
    if check:
        print("--check: nothing written. Files that would change:")
        for path in writes:
            print("  " + str(path))
        return
    backup = Path(tempfile.mkdtemp(prefix="sona-ios-speech-"))
    for i, path in enumerate(writes):
        if path.exists():
            shutil.copy2(path, backup / f"{i}-{path.name}")
    for path, content in writes.items():
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content)
    print(f"Apple's listening check installed in {app}; originals saved in {backup}")
    print("Next: build to a real iPhone (the simulator has no on-device model) and run the "
          "checklist in SPEECH_PLUGIN.md.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("app", nargs="?", type=Path, default=ROOT / "ios/App/App")
    parser.add_argument("--check", action="store_true", help="report what would change; write nothing")
    args = parser.parse_args()
    install(args.app.resolve(), check=args.check)
