/* SonaScenes — the swipe-city, hand-built in SVG.
   One consistent flat-vector style for every house: layered sky → skyline →
   hills → street, neighbor slivers at the edges, hero building centered on
   the sidewalk. ~30KB of code replaces ~16MB of raster panels, stays crisp
   on every screen, and recolors per scene from one palette table.
   today.html mounts svg(key) full-bleed behind its (invisible) tap target;
   charge.html uses uri(key) as the blurred "game is loading" backdrop. */
(function (global) {
  // per-key palette: sky top/mid/low, hills, street, hero body/roof/accent
  var P = {
    slice: { sky: ["#8fd14f", "#b3e37a", "#dff3b8"], hill: "#79c043", hill2: "#8fd14f", body: "#f06595", roof: "#e8590c", trim: "#ffd43b", door: "#37b24d" },
    tiles: { sky: ["#845ef7", "#b197fc", "#e5dbff"], hill: "#6741d9", hill2: "#7950f2", body: "#f3f0ff", roof: "#5f3dc4", trim: "#ffd43b", door: "#7048e8" },
    stack: { sky: ["#3bc9db", "#66d9e8", "#c5f6fa"], hill: "#1098ad", hill2: "#15aabf", body: "#4dabf7", roof: "#1864ab", trim: "#ffd43b", door: "#f59f00" },
    run:   { sky: ["#ff922b", "#ffa94d", "#ffe8cc"], hill: "#e8590c", hill2: "#f76707", body: "#fa5252", roof: "#c92a2a", trim: "#ffd43b", door: "#1864ab" },
    glide: { sky: ["#4dabf7", "#74c0fc", "#ffd8a8"], hill: "#1c7ed6", hill2: "#339af0", body: "#d0ebff", roof: "#1971c2", trim: "#fa5252", door: "#e8590c" },
    story: { sky: ["#ffd43b", "#ffe066", "#fff3bf"], hill: "#f08c00", hill2: "#f59f00", body: "#fff9db", roof: "#e8590c", trim: "#9775fa", door: "#a9803f" },
    daily: [ // rotates by weekday, mirrors the KITS palette
      { sky: ["#4fc3ff", "#a8e3ff", "#e5f6ff"], hill: "#2b9fe0", hill2: "#4fc3ff", body: "#ffd9a8", roof: "#ff6b6b", trim: "#ffd43b", door: "#e8590c" },
      { sky: ["#7ec9ff", "#c5e8ff", "#ecf7ff"], hill: "#4da3e0", hill2: "#7ec9ff", body: "#d0bfff", roof: "#845ef7", trim: "#ffd43b", door: "#5f3dc4" },
      { sky: ["#ffb45e", "#ffd9a1", "#fff0d9"], hill: "#e0892b", hill2: "#ffb45e", body: "#ffe8cc", roof: "#e8590c", trim: "#37b24d", door: "#a9803f" },
      { sky: ["#63e6be", "#b2f2dd", "#e6fcf5"], hill: "#2bc09a", hill2: "#63e6be", body: "#d3f9d8", roof: "#2f9e44", trim: "#ffd43b", door: "#e8590c" },
      { sky: ["#c890ff", "#e5ccff", "#f6ecff"], hill: "#a163e0", hill2: "#c890ff", body: "#eebefa", roof: "#9c36b5", trim: "#ffd43b", door: "#5f3dc4" },
      { sky: ["#74c0fc", "#a5d8ff", "#e3f2ff"], hill: "#3f9be0", hill2: "#74c0fc", body: "#a5d8ff", roof: "#1971c2", trim: "#fa5252", door: "#e8590c" },
      { sky: ["#ffa8a8", "#ffc9c9", "#ffe9e9"], hill: "#e07a7a", hill2: "#ffa8a8", body: "#ffdeeb", roof: "#e64980", trim: "#ffd43b", door: "#a9803f" },
    ],
  };

  // ── tiny shape kit ──
  function cloud(x, y, s, op) {
    return '<g fill="#ffffff" opacity="' + (op || 0.85) + '" transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<ellipse cx="0" cy="0" rx="34" ry="16"/><ellipse cx="-22" cy="6" rx="20" ry="12"/><ellipse cx="24" cy="6" rx="22" ry="13"/></g>';
  }
  function win(x, y, w, h, r) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 7) + '" fill="#fff"/>' +
      '<rect x="' + (x + 3.5) + '" y="' + (y + 3.5) + '" width="' + (w - 7) + '" height="' + (h - 7) + '" rx="' + Math.max(3, (r || 7) - 3) + '" fill="#bfe7ff"/>' +
      '<rect x="' + (x + 3.5) + '" y="' + (y + 3.5) + '" width="' + ((w - 7) / 2) + '" height="' + (h - 7) + '" rx="3" fill="#dff3ff"/>';
  }
  function awning(x, y, w, c1, c2, n) {
    n = n || 5; var seg = w / n, out = '<g>';
    for (var i = 0; i < n; i++) out += '<path d="M' + (x + i * seg) + ' ' + y + ' h' + seg + ' v10 a' + (seg / 2) + ' 8 0 0 1 -' + seg + ' 0 Z" fill="' + (i % 2 ? c2 : c1) + '"/>';
    return out + '</g>';
  }
  function tree(x, y, s, leaf) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<rect x="-5" y="-6" width="10" height="26" rx="5" fill="#8a5a2e"/>' +
      '<circle cx="0" cy="-26" r="24" fill="' + leaf + '"/><circle cx="-18" cy="-14" r="16" fill="' + leaf + '"/><circle cx="18" cy="-14" r="16" fill="' + leaf + '"/>' +
      '<circle cx="-8" cy="-32" r="7" fill="#ffffff" opacity=".25"/></g>';
  }
  function bush(x, y, s, c) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><circle cx="0" cy="0" r="14" fill="' + c + '"/><circle cx="-13" cy="4" r="10" fill="' + c + '"/><circle cx="13" cy="4" r="10" fill="' + c + '"/></g>';
  }
  function neighbor(x, w, h, body, roof, flip) {
    // an edge sliver building, cropped by the viewport like the raster panels
    var y = 640 - h;
    return '<g>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10" fill="' + body + '"/>' +
      '<rect x="' + (x - 8) + '" y="' + (y - 16) + '" width="' + (w + 16) + '" height="22" rx="11" fill="' + roof + '"/>' +
      win(x + (flip ? 14 : w - 52), y + 34, 38, 34) + win(x + (flip ? 14 : w - 52), y + 92, 38, 34) +
      '</g>';
  }
  function base(c, sign) {
    // shared hero core: body plinth + door + windows; `sign` draws the theme
    return '<g>' +
      '<rect x="120" y="400" width="200" height="240" rx="18" fill="' + c.body + '"/>' +
      '<rect x="120" y="400" width="200" height="26" rx="13" fill="#ffffff" opacity=".18"/>' +
      win(146, 470, 52, 46) + win(242, 470, 52, 46) +
      '<rect x="196" y="556" width="48" height="84" rx="12" fill="' + c.door + '"/>' +
      '<rect x="204" y="564" width="32" height="76" rx="9" fill="#ffffff" opacity=".22"/>' +
      '<circle cx="232" cy="600" r="3.5" fill="#ffd43b"/>' +
      sign + '</g>';
  }

  // ── the seven hero buildings ──
  var HEROES = {
    slice: function (c) {
      return base(c,
        awning(132, 528, 176, '#ffd43b', '#fff9db', 6) +
        // pineapple finial + fruit crates
        '<ellipse cx="150" cy="632" rx="26" ry="8" fill="rgba(0,0,0,.10)"/>' +
        '<g><rect x="126" y="596" width="52" height="36" rx="6" fill="#c08a5a"/><rect x="126" y="596" width="52" height="10" rx="5" fill="#a97044"/>' +
        '<circle cx="140" cy="596" r="8" fill="#fa5252"/><circle cx="156" cy="592" r="8" fill="#ff922b"/><circle cx="170" cy="596" r="8" fill="#ffd43b"/></g>'
      ) + '<rect x="110" y="386" width="220" height="20" rx="10" fill="' + c.roof + '"/>' +
        '<path d="M158 388 A62 40 0 0 1 282 388 L268 388 A48 30 0 0 0 172 388 Z" fill="#2f9e44"/>' +
        '<path d="M172 388 A48 30 0 0 1 268 388 L254 388 A34 20 0 0 0 186 388 Z" fill="#ff6b7a"/>' +
        '<circle cx="200" cy="374" r="2.6" fill="#343a40"/><circle cx="220" cy="370" r="2.6" fill="#343a40"/><circle cx="240" cy="374" r="2.6" fill="#343a40"/>';
    },
    tiles: function (c) {
      var keys = '';
      for (var i = 0; i < 7; i++) keys += '<rect x="' + (134 + i * 25) + '" y="612" width="21" height="28" rx="4" fill="' + (i % 2 ? '#343a40' : '#ffffff') + '"/>';
      return base(c,
        keys +
        '<circle cx="220" cy="452" r="26" fill="#fff" stroke="' + c.trim + '" stroke-width="6"/>' +
        '<path d="M212 462 v-18 q0 -4 4 -5 l10 -3 v18" stroke="#5f3dc4" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
        '<circle cx="209" cy="462" r="4.5" fill="#5f3dc4"/><circle cx="223" cy="454" r="4.5" fill="#5f3dc4"/>'
      ) +
        '<path d="M110 400 L220 344 L330 400 Z" fill="' + c.roof + '"/>' +
        '<rect x="102" y="392" width="236" height="16" rx="8" fill="' + c.roof + '"/>';
    },
    stack: function (c) {
      return base(c,
        // block stack beside the door + roof crane
        '<g><rect x="134" y="600" width="34" height="34" rx="7" fill="#fa5252"/><rect x="140" y="566" width="34" height="34" rx="7" fill="#ffd43b"/><rect x="136" y="532" width="30" height="30" rx="7" fill="#40c057"/></g>' +
        '<circle cx="292" cy="446" r="20" fill="#fff" stroke="' + c.trim + '" stroke-width="5"/><rect x="284" y="438" width="16" height="16" rx="3" fill="#f59f00"/>'
      ) +
        '<rect x="108" y="388" width="224" height="18" rx="9" fill="' + c.roof + '"/>' +
        '<g stroke="#f59f00" stroke-width="7" stroke-linecap="round"><path d="M150 386 L150 330 L262 330" fill="none"/></g>' +
        '<path d="M262 330 l0 26" stroke="#5c5f66" stroke-width="4"/><rect x="250" y="356" width="24" height="24" rx="6" fill="#845ef7"/>';
    },
    run: function (c) {
      var checks = '';
      for (var i = 0; i < 10; i++) checks += '<rect x="' + (120 + i * 20) + '" y="388" width="20" height="18" fill="' + (i % 2 ? '#343a40' : '#ffffff') + '"/>';
      return base(c,
        '<g><circle cx="150" cy="620" r="16" fill="#343a40"/><circle cx="150" cy="620" r="7" fill="#9aa5b1"/><circle cx="150" cy="602" r="16" fill="#343a40"/><circle cx="150" cy="602" r="7" fill="#9aa5b1"/></g>' +
        '<path d="M286 640 L296 606 L306 640 Z" fill="#ff922b"/><rect x="282" y="636" width="48" height="8" rx="4" fill="#e8590c"/>' +
        '<rect x="196" y="452" width="48" height="30" rx="8" fill="#ffd43b"/><circle cx="210" cy="467" r="7" fill="#fa5252"/><circle cx="230" cy="467" r="7" fill="#40c057"/>'
      ) + '<g>' + checks + '</g><rect x="112" y="382" width="216" height="10" rx="5" fill="' + c.roof + '"/>' +
        '<path d="M330 388 l0 -46 l34 10 -34 12" fill="none" stroke="#343a40" stroke-width="5"/><path d="M330 342 l34 10 -34 12 Z" fill="#fa5252"/>';
    },
    glide: function (c) {
      return base(c,
        '<path d="M156 528 h128 v8 a14 10 0 0 1 -14 8 h-100 a14 10 0 0 1 -14 -8 Z" fill="' + c.trim + '" opacity=".9"/>' +
        '<circle cx="220" cy="470" r="30" fill="#fff" stroke="' + c.roof + '" stroke-width="6"/><path d="M204 470 a16 16 0 0 1 32 0" fill="#74c0fc"/>'
      ) +
        '<rect x="110" y="386" width="220" height="20" rx="10" fill="' + c.roof + '"/>' +
        // rooftop hot-air balloon
        '<g transform="translate(220 316)"><path d="M0 -34 C-24 -34 -34 -16 -34 0 C-34 18 -18 28 -8 36 L8 36 C18 28 34 18 34 0 C34 -16 24 -34 0 -34" fill="#fa5252"/><path d="M0 -34 C-10 -34 -16 -16 -16 0 C-16 18 -8 28 -4 36 L0 36 Z" fill="#ff8787"/><path d="M0 -34 C10 -34 16 -16 16 0 C16 18 8 28 4 36 L0 36 Z" fill="#ffd43b"/><path d="M-8 36 l-2 10 M8 36 l2 10 M0 36 l0 10" stroke="#8a5a2e" stroke-width="2"/><rect x="-11" y="46" width="22" height="14" rx="4" fill="#a97044"/></g>';
    },
    story: function (c) {
      return base(c,
        // open book over the door
        '<g transform="translate(220 452)"><path d="M-44 8 Q-22 -8 0 2 Q22 -8 44 8 L44 18 Q22 6 0 14 Q-22 6 -44 18 Z" fill="#fff"/><path d="M0 2 L0 14" stroke="#dee2e6" stroke-width="3"/><path d="M-36 6 Q-18 -4 -4 3 M4 3 Q18 -4 36 6" stroke="#c4b5ea" stroke-width="3" fill="none"/></g>' +
        '<rect x="136" y="598" width="30" height="42" rx="5" fill="#9775fa"/><rect x="286" y="590" width="26" height="50" rx="5" fill="#fa5252"/><rect x="262" y="606" width="22" height="34" rx="5" fill="#40c057"/>'
      ) +
        '<path d="M108 402 Q220 344 332 402 L332 410 L108 410 Z" fill="' + c.roof + '"/>' +
        '<rect x="204" y="330" width="10" height="42" fill="' + c.roof + '"/><path d="M214 330 h30 l-9 9 9 9 h-30 Z" fill="' + c.trim + '"/>';
    },
    daily: function (c) {
      // the circus-tent Today's Run house
      var stripes = '';
      for (var i = 0; i < 6; i++) stripes += '<path d="M' + (136 + i * 28) + ' 406 L220 330 L' + (164 + i * 28) + ' 406 Z" fill="' + (i % 2 ? '#ffffff' : c.roof) + '"/>';
      return base(c,
        '<path d="M162 528 h116 l-10 16 h-96 Z" fill="' + c.trim + '"/>' +
        '<circle cx="220" cy="470" r="26" fill="#fff" stroke="' + c.roof + '" stroke-width="6"/><path d="M220 456 l5 10 11 1 -8 8 2 11 -10 -5 -10 5 2 -11 -8 -8 11 -1 Z" fill="' + c.trim + '"/>'
      ) +
        '<path d="M128 406 Q220 318 312 406 Z" fill="' + c.roof + '"/>' + stripes +
        '<path d="M220 318 l0 -16" stroke="' + c.roof + '" stroke-width="5" stroke-linecap="round"/><path d="M220 300 h26 l-8 8 8 8 h-26 Z" fill="#fa5252"/>';
    },
  };

  function paletteFor(key) {
    if (key.indexOf("daily") === 0) {
      var ix = parseInt(key.split("-")[1], 10) || 0;
      return P.daily[ix % P.daily.length];
    }
    return P[key] || P.slice;
  }

  function svg(key) {
    var c = paletteFor(key);
    var hero = HEROES[key.indexOf("daily") === 0 ? "daily" : key] || HEROES.slice;
    var id = "sk" + key.replace(/[^a-z0-9]/g, "");
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 780" preserveAspectRatio="xMidYMax slice">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + c.sky[0] + '"/><stop offset=".55" stop-color="' + c.sky[1] + '"/><stop offset="1" stop-color="' + c.sky[2] + '"/></linearGradient></defs>' +
      '<rect width="440" height="780" fill="url(#' + id + ')"/>' +
      '<circle cx="368" cy="96" r="34" fill="#fff9db" opacity=".9"/><circle cx="368" cy="96" r="46" fill="#fff9db" opacity=".25"/>' +
      cloud(96, 92, 1, .9) + cloud(300, 168, .7, .8) + cloud(180, 240, .5, .6) +
      // distant hills
      '<path d="M0 560 Q90 500 190 548 Q300 500 440 552 L440 780 L0 780 Z" fill="' + c.hill2 + '" opacity=".55"/>' +
      '<path d="M0 590 Q120 534 250 578 Q350 546 440 582 L440 780 L0 780 Z" fill="' + c.hill + '" opacity=".7"/>' +
      // neighbors peeking at the edges
      neighbor(-40, 96, 210, "#ffe8cc", "#f59f00", false) +
      neighbor(384, 96, 240, "#d0ebff", "#1971c2", true) +
      tree(64, 636, 1.05, "#37b24d") + tree(392, 640, .9, "#2f9e44") +
      // hero shadow + hero
      '<ellipse cx="220" cy="646" rx="130" ry="14" fill="rgba(15,40,70,.14)"/>' +
      hero(c) +
      bush(120, 644, 1, "#40c057") + bush(322, 646, 1.1, "#37b24d") +
      // street
      '<rect x="0" y="648" width="440" height="132" fill="#5b6a76"/>' +
      '<rect x="0" y="648" width="440" height="10" fill="rgba(0,0,0,.12)"/>' +
      '<rect x="0" y="640" width="440" height="12" rx="6" fill="#8a97a3"/>' +
      '<g fill="#cfd8df"><rect x="30" y="700" width="52" height="8" rx="4"/><rect x="130" y="700" width="52" height="8" rx="4"/><rect x="230" y="700" width="52" height="8" rx="4"/><rect x="330" y="700" width="52" height="8" rx="4"/></g>' +
      '</svg>';
  }

  function uri(key) { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(key)); }

  global.SonaScenes = { svg: svg, uri: uri, has: function (key) { return !!(HEROES[key] || key.indexOf("daily") === 0); } };
})(window);
