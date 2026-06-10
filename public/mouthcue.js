/* Animated mouth/tongue cue per sound — schematic SVG, no assets needed.
   Front-facing open mouth: lips, upper/lower teeth, tongue. A per-sound CSS
   animation shows the action (tongue tip up, teeth on lip, lips round, etc.).
   Pairs with the text hint. Mouth.svg(sound) -> markup; Mouth.hint(sound). */
(function (global) {
  var CFG = {
    L:  { act: "tipup",  hint: "Tongue tip UP behind your top teeth" },
    T:  { act: "tipup",  hint: "Tongue taps behind your top teeth" },
    D:  { act: "tipup",  hint: "Tongue taps behind your top teeth" },
    N:  { act: "tipup",  hint: "Tongue up — hum through your nose" },
    S:  { act: "sclose", air: true, hint: "Teeth together, smile, stream air — sss" },
    Z:  { act: "sclose", air: true, hint: "Teeth together, buzz — zzz" },
    R:  { act: "bunch",  hint: "Pull your tongue back and bunch it up" },
    K:  { act: "back",   hint: "Lift the BACK of your tongue" },
    G:  { act: "back",   hint: "Back of tongue up — turn your voice on" },
    F:  { act: "fv",     air: true, hint: "Top teeth gently on your bottom lip — fff" },
    V:  { act: "fv",     air: true, hint: "Top teeth on bottom lip — buzz, vvv" },
    TH: { act: "poke",   air: true, hint: "Tongue peeks out between your teeth" },
    SH: { act: "round",  air: true, hint: "Round your lips — shhh" },
    CH: { act: "round",  air: true, hint: "Round your lips, then pop — ch" },
  };

  var STYLE =
    '.mc *{transform-box:fill-box;transform-origin:center;}' +
    '.mc .lips{fill:#ef7d8e;}' +
    '.mc .cavity{fill:#6d2a37;}' +
    '.mc .teeth{fill:#fff;stroke:#e7ecf3;stroke-width:1;}' +
    '.mc .tongue{fill:#e0617c;}' +
    '.mc .air circle{fill:#bfe0ff;opacity:0;}' +
    '@keyframes mc-tipup{0%,100%{transform:translateY(0)}45%,72%{transform:translateY(-34px)}}' +
    '.act-tipup .tongue{animation:mc-tipup 1.9s ease-in-out infinite;}' +
    '@keyframes mc-back{0%,100%{transform:translate(0,0) scaleY(1)}50%{transform:translate(-20px,-16px) scaleY(1.3)}}' +
    '.act-back .tongue{animation:mc-back 2s ease-in-out infinite;}' +
    '@keyframes mc-bunch{0%,100%{transform:translateX(0) scale(1)}50%{transform:translateX(-10px) scale(.78,1.18)}}' +
    '.act-bunch .tongue{animation:mc-bunch 2s ease-in-out infinite;}' +
    '@keyframes mc-poke{0%,100%{transform:translateY(0)}50%{transform:translateY(20px)}}' +
    '.act-poke .tongue{animation:mc-poke 1.9s ease-in-out infinite;}' +
    '@keyframes mc-fv{0%,100%{transform:translateY(0)}50%{transform:translateY(22px)}}' +
    '.act-fv .teeth.up{animation:mc-fv 1.8s ease-in-out infinite;}' +
    '@keyframes mc-sup{0%,100%{transform:translateY(0)}45%,78%{transform:translateY(15px)}}' +
    '@keyframes mc-sdn{0%,100%{transform:translateY(0)}45%,78%{transform:translateY(-15px)}}' +
    '.act-sclose .teeth.up{animation:mc-sup 2s ease-in-out infinite;}' +
    '.act-sclose .teeth.dn{animation:mc-sdn 2s ease-in-out infinite;}' +
    '@keyframes mc-round{0%,100%{transform:scaleX(1)}50%{transform:scale(.58,1.12)}}' +
    '.act-round .mouthgrp{animation:mc-round 2s ease-in-out infinite;}' +
    '@keyframes mc-open{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.82)}}' +
    '.act-open .mouthgrp{animation:mc-open 2s ease-in-out infinite;}' +
    '@keyframes mc-airflow{0%{transform:translateY(0);opacity:0}25%{opacity:.9}100%{transform:translateY(34px);opacity:0}}' +
    '.air circle{animation:mc-airflow 1.4s linear infinite;}' +
    '.air circle:nth-child(2){animation-delay:.45s;}' +
    '.air circle:nth-child(3){animation-delay:.9s;}';

  function svg(sound) {
    var c = CFG[sound] || { act: "open" };
    var air = c.air
      ? '<g class="air"><circle cx="100" cy="150" r="3.5"/><circle cx="90" cy="150" r="3"/><circle cx="110" cy="150" r="3"/></g>'
      : "";
    return (
      '<svg class="mc act-' + c.act + '" viewBox="0 0 200 196" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<style>' + STYLE + '</style>' +
        '<defs><clipPath id="mc-clip"><ellipse cx="100" cy="98" rx="62" ry="47"/></clipPath></defs>' +
        '<g class="mouthgrp">' +
          '<ellipse class="lips" cx="100" cy="98" rx="74" ry="58"/>' +
          '<g clip-path="url(#mc-clip)">' +
            '<rect class="cavity" x="34" y="48" width="132" height="100"/>' +
            '<rect class="teeth dn" x="44" y="124" width="112" height="22" rx="6"/>' +
            '<ellipse class="tongue" cx="100" cy="120" rx="46" ry="24"/>' +
            '<rect class="teeth up" x="44" y="50" width="112" height="22" rx="6"/>' +
          '</g>' +
        '</g>' +
        air +
      '</svg>'
    );
  }

  global.Mouth = { svg: svg, hint: function (s) { return (CFG[s] && CFG[s].hint) || ""; } };
})(window);
