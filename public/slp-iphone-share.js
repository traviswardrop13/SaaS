(function (global) {
  "use strict";

  function nativeShare() {
    if (global.__sonaSlpApp !== true) return null;
    var capacitor = global.Capacitor;
    if (!capacitor || typeof capacitor.getPlatform !== "function" || capacitor.getPlatform() !== "ios") return null;
    var plugin = capacitor.Plugins && capacitor.Plugins.Share;
    return plugin && typeof plugin.share === "function" ? plugin : null;
  }

  function shareError(error) {
    // Capacitor reports a dismissed iOS sheet as a rejected promise.
    return error && /^share cancel(?:ed|led)$/i.test(error.message || "") ? "cancelled" : "unavailable";
  }

  function open(options) {
    var plugin = nativeShare();
    if (!plugin || !options) return Promise.resolve("unavailable");

    var payload = {};
    if (typeof options.text === "string" && options.text.trim()) payload.text = options.text;
    if (typeof options.url === "string" && /^https:\/\//i.test(options.url)) payload.url = options.url;
    if (!payload.text && !payload.url) return Promise.resolve("unavailable");
    if (typeof options.title === "string" && options.title.trim()) payload.title = options.title;

    try {
      return Promise.resolve(plugin.share(payload)).then(function () {
        return "shared";
      }, shareError);
    } catch (error) {
      return Promise.resolve(shareError(error));
    }
  }

  global.SonaSlpShare = {
    available: function () { return !!nativeShare(); },
    open: open
  };
})(window);
