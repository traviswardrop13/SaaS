// Verbatim letter-case selection from the existing book reader.
function nativeBookWord(options) {
    var BOOK = {title: options.title, pages: (options.captions || []).map(t => ({t}))};
    function keyShown(word) {
      var w = String(word).replace(/[^a-z']/gi, ""), cap = w.charAt(0).toUpperCase() + w.slice(1);
      if (/^th(e|is|at|ese|ose|en|ey|ere|em)$/i.test(w)) return w;
      if (String(BOOK.title).split(" ")[0].replace(/'s$/, "") === cap) return cap;
      var re = new RegExp("\\b" + w + "\\b", "gi"), mid = 0, low = 0, m;
      BOOK.pages.forEach(function (p) {
        re.lastIndex = 0;
        while ((m = re.exec(p.t))) {
          if (m[0].charAt(0) === m[0].charAt(0).toLowerCase()) low++;
          else if (/[a-z,]\s*$/i.test(p.t.slice(0, m.index))) mid++;
        }
      });
      return mid && !low ? cap : w;
    }
    return keyShown(options.word);
}
