#!/usr/bin/env python3
"""Switch on Apple's on-device listening check (SonaSpeech) in the iOS app.

The plugin's source lives in plugins/sona-speech. It was written in August but
never reached the app: nothing compiled it, nothing registered it, and the app
had no speech-permission text, so every practice try was judged by the looser
sound-shape check. This does the three steps, the same way
install-ios-lifecycle.py installs the scene fix:

1. Compiles the plugin through AppDelegate.swift, which is already in the
   Xcode Sources phase, so there is no manual target-membership step.
2. Registers it in the project's MainViewController, beside SonaAudio.
3. Adds NSSpeechRecognitionUsageDescription to Info.plist. Without it iOS
   closes the app the moment the speech permission is asked.

It stops without changing anything if the plugin is already in the app some
other way (as an npm package, or as its own Swift file), because two copies of
one plugin class cannot both be compiled. Originals are backed up to a
temporary directory; running it again is safe.
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
USAGE_KEY = "NSSpeechRecognitionUsageDescription"
USAGE = ("Sona checks your child's practice words right on this iPhone. "
         "Speech recognition runs on the phone, and no audio is sent anywhere.")


def already_packaged(app):
    """Is SonaSpeech already in the app as an npm/Swift package?"""
    spm = app.parent / "CapApp-SPM/Package.swift"      # ios/App/CapApp-SPM, beside ios/App/App
    if spm.exists() and re.search(r"sona-speech|SonaSpeech", spm.read_text()):
        return str(spm)
    config = app / "capacitor.config.json"
    if config.exists() and "SonaSpeechPlugin" in config.read_text():
        return str(config)
    return None


def install(app):
    delegate = app / "AppDelegate.swift"
    info = app / "Info.plist"
    for need in (delegate, info):
        if not need.exists():
            raise ValueError(f"{need} not found. Pass the App folder: ios/App/App")
    packaged = already_packaged(app)
    if packaged:
        raise ValueError(f"SonaSpeech is already in the app as a package ({packaged}). "
                         "Use that, or remove it before running this.")
    swift = [p for p in app.rglob("*.swift") if p != delegate]
    elsewhere = [p for p in swift if "class SonaSpeechPlugin" in p.read_text()]
    if elsewhere:
        raise ValueError(f"SonaSpeechPlugin is already compiled from {elsewhere[0]}. "
                         "Keep one copy: remove that file from the target, or skip this script.")
    controllers = [p for p in swift if re.search(r"class\s+MainViewController\b", p.read_text())]
    if not controllers:
        raise ValueError("MainViewController.swift is not in the Xcode project, so no local plugin "
                         "can be registered. Add it first (native/README.md, steps 2 and 3).")
    controller = controllers[0]

    # 1. compile the plugin through AppDelegate.swift
    source = delegate.read_text()
    if START in source:
        source, count = re.subn(re.escape(START) + r".*?" + re.escape(END) + r"\n?",
                                "", source, flags=re.S)
        if count != 1:
            raise ValueError("Unexpected speech-plugin markers; inspect AppDelegate before updating.")
    plugin = PLUGIN.read_text()
    updated = source.rstrip() + "\n\n" + START + "\n" + plugin.rstrip() + "\n" + END + "\n"

    # 2. register it beside SonaAudio
    control = controller.read_text()
    registered = control
    if REGISTER not in control:
        audio = re.search(r"^([ \t]*)bridge\?\.registerPluginInstance\(SonaAudioPlugin\(\)\)[ \t]*$",
                          control, flags=re.M)
        if audio:
            registered = control[:audio.end()] + "\n" + audio.group(1) + REGISTER + control[audio.end():]
        else:
            hook = re.search(r"override func capacitorDidLoad\(\)\s*\{[ \t]*\n", control)
            if not hook:
                raise ValueError(f"No capacitorDidLoad() in {controller}; register {REGISTER} by hand.")
            registered = control[:hook.end()] + "        " + REGISTER + "\n" + control[hook.end():]

    # 3. the speech-permission text
    with info.open("rb") as stream:
        config = plistlib.load(stream)
    encoded = info.read_bytes()
    if not config.get(USAGE_KEY):
        config[USAGE_KEY] = USAGE
        encoded = plistlib.dumps(config, sort_keys=False)

    if updated == delegate.read_text() and registered == control and encoded == info.read_bytes():
        print("Apple's listening check is already installed.")
        return
    backup = Path(tempfile.mkdtemp(prefix="sona-ios-speech-"))
    for file in (delegate, controller, info):
        shutil.copy2(file, backup / file.name)
    delegate.write_text(updated)
    controller.write_text(registered)
    info.write_bytes(encoded)
    print(f"Apple's listening check installed in {app}; originals saved in {backup}")
    print("Next: build to a real iPhone (the simulator has no on-device model) and run the "
          "checklist in SPEECH_PLUGIN.md.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", nargs="?", type=Path, default=ROOT / "ios/App/App")
    install(parser.parse_args().app.resolve())
