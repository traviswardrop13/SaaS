/* Articulation cue: a side-view (sagittal) Leo profile showing what the mouth
   is doing for each sound — tongue, teeth, and lips actually move to the
   placement target, the way SLPs teach it. Pure SVG, no assets.
   API: Mouth.svg(sound) -> markup, Mouth.hint(sound) -> short kid hint. */
(function (global) {
  var CFG = {
    L:  { act: "tipup",    hint: "Tongue tip UP behind your top teeth — lll" },
    T:  { act: "tipup",    hint: "Tongue taps behind your top teeth — t!" },
    D:  { act: "tipup",    hint: "Tongue taps behind your top teeth — d!" },
    N:  { act: "tipup",    hint: "Tongue up, hum through your nose — nnn" },
    S:  { act: "sclose",   air: true, hint: "Teeth almost closed, smile, blow air — sss" },
    Z:  { act: "sclose",   air: true, hint: "Teeth almost closed, buzz — zzz" },
    R:  { act: "bunch",    hint: "Pull your tongue back and bunch it up — rrr" },
    K:  { act: "back",     hint: "Lift the BACK of your tongue — k!" },
    G:  { act: "back",     hint: "Back of tongue up, voice on — g!" },
    F:  { act: "fv",       air: true, hint: "Bottom lip touches top teeth, blow — fff" },
    V:  { act: "fv",       air: true, hint: "Bottom lip on top teeth, buzz — vvv" },
    TH: { act: "poke",     air: true, hint: "Tongue peeks out between your teeth — th" },
    SH: { act: "round",    air: true, hint: "Round your lips, quiet air — shhh" },
    CH: { act: "round",    air: true, hint: "Round your lips, then pop — ch!" },
    J:  { act: "round",    air: true, hint: "Round your lips, buzzy pop — j!" },
    P:  { act: "bilabial", air: true, hint: "Press your lips, then pop — p!" },
    B:  { act: "bilabial", hint: "Lips together, voice on — b!" },
    M:  { act: "bilabial", hint: "Lips together, hum — mmm" },
    W:  { act: "round",    hint: "Round your lips — wuh" },
    H:  { act: "open",     air: true, hint: "Open and breathe out — hhh" },
  };

  var STYLE =
    '.mc *{transform-box:fill-box;}' +
    /* tongue tip lifts to the ridge (L, T, D, N) */
    '@keyframes mc-tipup{0%,18%,92%,100%{transform:rotate(0)}40%,72%{transform:rotate(-38deg)}}' +
    '.act-tipup .mc-tip{transform-origin:88% 55%;animation:mc-tipup 2.1s ease-in-out infinite;}' +
    /* back of tongue humps to the soft palate (K, G) */
    '@keyframes mc-back{0%,18%,92%,100%{transform:none}40%,72%{transform:translate(5px,-15px) scaleY(1.5)}}' +
    '.act-back .mc-body{transform-origin:50% 100%;animation:mc-back 2.1s ease-in-out infinite;}' +
    /* whole tongue bunches up and back (R) */
    '@keyframes mc-bunch{0%,18%,92%,100%{transform:none}40%,72%{transform:translate(9px,-7px) scale(.82,1.32)}}' +
    '.act-bunch .mc-tongue{transform-origin:78% 82%;animation:mc-bunch 2.1s ease-in-out infinite;}' +
    /* tongue tip slides forward between the teeth (TH) */
    '@keyframes mc-poke{0%,18%,92%,100%{transform:none}40%,72%{transform:translate(-15px,-6px)}}' +
    '.act-poke .mc-tongue{animation:mc-poke 2.1s ease-in-out infinite;}' +
    /* teeth come nearly together (S, Z) */
    '@keyframes mc-tup{0%,18%,92%,100%{transform:none}40%,72%{transform:translateY(7px)}}' +
    '@keyframes mc-tdn{0%,18%,92%,100%{transform:none}40%,72%{transform:translateY(-7px)}}' +
    '@keyframes mc-tipsm{0%,18%,92%,100%{transform:rotate(0)}40%,72%{transform:rotate(-16deg)}}' +
    '.act-sclose .mc-teethup{animation:mc-tup 2.1s ease-in-out infinite;}' +
    '.act-sclose .mc-teethdn{animation:mc-tdn 2.1s ease-in-out infinite;}' +
    '.act-sclose .mc-tip{transform-origin:88% 55%;animation:mc-tipsm 2.1s ease-in-out infinite;}' +
    /* bottom lip rises to the top teeth (F, V) */
    '@keyframes mc-lipup{0%,18%,92%,100%{transform:none}40%,72%{transform:translate(2px,-19px)}}' +
    '.act-fv .mc-lowlip{animation:mc-lipup 2.1s ease-in-out infinite;}' +
    '.act-fv .mc-teethup{animation:mc-tup 2.1s ease-in-out infinite;}' +
    /* lips press shut, then pop open (P, B, M) */
    '@keyframes mc-seal{0%,38%{opacity:1}50%,78%{opacity:0}96%,100%{opacity:1}}' +
    '.act-bilabial .mc-seal{animation:mc-seal 2.1s ease-in-out infinite;}' +
    '.mc-seal{opacity:0;}' +
    /* lips round into a small circle (SH, CH, J, W) */
    '@keyframes mc-purse{0%,18%,92%,100%{opacity:0;transform:scale(1.25)}40%,72%{opacity:1;transform:scale(1)}}' +
    '.mc-lipring{opacity:0;transform-origin:50% 50%;}' +
    '.act-round .mc-lipring{animation:mc-purse 2.1s ease-in-out infinite;}' +
    '@keyframes mc-tipsh{0%,18%,92%,100%{transform:rotate(0)}40%,72%{transform:rotate(-22deg)}}' +
    '.act-round .mc-tip{transform-origin:88% 55%;animation:mc-tipsh 2.1s ease-in-out infinite;}' +
    /* air stream out the front */
    '@keyframes mc-air{0%{transform:translateX(0);opacity:0}30%{opacity:.95}100%{transform:translateX(-26px);opacity:0}}' +
    '.mc-air circle{opacity:0;animation:mc-air 1.5s linear infinite;}' +
    '.mc-air circle:nth-child(2){animation-delay:.5s;}' +
    '.mc-air circle:nth-child(3){animation-delay:1s;}';

  function svg(sound) {
    var c = CFG[sound] || { act: "open" };
    var clipId = "mcclip-" + sound + "-" + Math.floor(Math.random() * 1e5);
    var air = c.air
      ? '<g class="mc-air"><circle cx="22" cy="110" r="3.6" fill="#9fd3ff"/><circle cx="24" cy="118" r="3" fill="#9fd3ff"/><circle cx="22" cy="103" r="2.6" fill="#9fd3ff"/></g>'
      : "";
    return (
      '<svg class="mc act-' + c.act + '" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<style>' + STYLE + '</style>' +
        '<defs><clipPath id="' + clipId + '"><rect x="30" y="92" width="74" height="46" rx="16"/></clipPath></defs>' +
        /* mane + ear (Leo, in profile) */
        '<circle cx="128" cy="98" r="74" fill="#ef8a2e"/>' +
        '<circle cx="176" cy="52" r="20" fill="#ef8a2e"/><circle cx="188" cy="104" r="20" fill="#ef8a2e"/><circle cx="172" cy="152" r="20" fill="#ef8a2e"/>' +
        '<circle cx="148" cy="28" r="16" fill="#ef8a2e"/><circle cx="148" cy="31" r="8" fill="#ffd9a8"/>' +
        /* head + muzzle */
        '<circle cx="104" cy="102" r="66" fill="#ffe3b3"/>' +
        '<ellipse cx="58" cy="112" rx="34" ry="32" fill="#ffe3b3"/>' +
        /* eye + brow + nose */
        '<path d="M66 50 Q78 42 90 48" stroke="#c98a3f" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<circle cx="78" cy="64" r="7" fill="#3a2a1f"/><circle cx="80" cy="61" r="2.2" fill="#fff"/>' +
        '<ellipse cx="42" cy="82" rx="10" ry="7" fill="#d96a4e"/>' +
        /* open mouth interior */
        '<rect x="32" y="92" width="72" height="46" rx="16" fill="#7a3340"/>' +
        '<g clip-path="url(#' + clipId + ')">' +
          /* alveolar ridge (the bump the tongue tip aims for) */
          '<circle cx="70" cy="91" r="9" fill="#ffd9a8"/>' +
          /* tongue (body + tip move per sound) */
          '<g class="mc-tongue">' +
            '<g class="mc-body"><ellipse cx="84" cy="128" rx="26" ry="13" fill="#ee6e8c"/></g>' +
            '<g class="mc-tip"><ellipse cx="56" cy="128" rx="18" ry="10" fill="#ee6e8c"/><path d="M44 126 Q56 121 70 124" stroke="#e25577" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>' +
          '</g>' +
          /* teeth */
          '<g class="mc-teethup"><rect x="36" y="90" width="26" height="15" rx="3.5" fill="#fff" stroke="#e3e3e3"/></g>' +
          '<g class="mc-teethdn"><rect x="36" y="125" width="22" height="13" rx="3.5" fill="#fff" stroke="#e3e3e3"/></g>' +
        '</g>' +
        /* lips */
        '<rect x="28" y="85" width="22" height="9" rx="4.5" fill="#f7cf91"/>' +
        '<g class="mc-lowlip"><rect x="28" y="136" width="22" height="10" rx="5" fill="#f7cf91"/></g>' +
        /* lips pressed shut (bilabial overlay) */
        '<g class="mc-seal"><rect x="32" y="92" width="72" height="46" rx="16" fill="#ffe3b3"/><path d="M34 114 H78" stroke="#e7b97f" stroke-width="3.5" stroke-linecap="round"/></g>' +
        /* rounded/pursed lips (SH/CH/J/W) */
        '<g class="mc-lipring"><ellipse cx="33" cy="114" rx="9" ry="17" fill="#f7cf91"/><ellipse cx="31" cy="114" rx="4.5" ry="9" fill="#7a3340"/></g>' +
        air +
      '</svg>'
    );
  }

  global.Mouth = { svg: svg, hint: function (s) { return (CFG[s] && CFG[s].hint) || ""; } };
})(window);
