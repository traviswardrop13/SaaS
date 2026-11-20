(function () {
    "use strict";
    // Run in the isolated world of a quiesced legacy origin. Microphone
    // recordings and IndexedDB stay out of the migration path.
    var origin = location.origin;
    function snapshot() {
        var values = Object.create(null);
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf("sona.") === 0) values[key] = localStorage.getItem(key);
        }
        return values;
    }

    var before = snapshot();
    var after = snapshot();
    var keys = Object.keys(before).sort();
    var stable = location.origin === origin
        && JSON.stringify(keys) === JSON.stringify(Object.keys(after).sort())
        && keys.every(function (key) { return before[key] === after[key]; });
    return JSON.stringify({ schema: 1, origin: origin, stable: stable, storage: before });
})()
