#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift SonaAudioPlugin with Capacitor so the web layer can call
// window.Capacitor.Plugins.SonaAudio.record(...) / .stop().
CAP_PLUGIN(SonaAudioPlugin, "SonaAudio",
  CAP_PLUGIN_METHOD(record, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
)
