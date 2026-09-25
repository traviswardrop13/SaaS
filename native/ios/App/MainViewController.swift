import UIKit
import Capacitor

/**
 * MainViewController — registers the local `SonaAudio` plugin with Capacitor.
 *
 * WHY THIS IS NEEDED: `SonaAudioPlugin` lives in the App target (a *local*
 * plugin, not an npm package). On Capacitor 6+/8 with Swift Package Manager,
 * conforming to `CAPBridgedPlugin` supplies the plugin's metadata (jsName +
 * methods) but does NOT by itself make Capacitor discover the class — local
 * plugins must be registered on the bridge. Without this, `SonaAudio` is never
 * exposed to JS, `window.Capacitor.Plugins.SonaAudio` is undefined, and the
 * clean-mic feature silently no-ops (the app falls back to the web mic).
 *
 * ONE-TIME XCODE STEP: in `App/Base.lproj/Main.storyboard`, select the
 * "Bridge View Controller" scene and set its Custom Class (Identity inspector)
 * to `MainViewController`. Then rebuild.
 */
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SonaAudioPlugin())
    }
}
