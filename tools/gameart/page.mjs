// One Say & Play game page: the HUD, the drawn scene, the turn panel and the
// overlays around a game definition from little.mjs or big.mjs. Everything
// that runs lives in public/sayplay.js and public/sayplay.css, so a page is
// markup plus one SayPlay.start({...}) call.
//
// A game definition:
//   key, title, group ("simple" ages 3-4, "arcade" ages 5-8), how (the start
//   card's line), alt (the scene, for a screen reader), top/bottom (page
//   colours), bg (the scene's backdrop), parts [{ id, x, y, svg, hid, o }],
//   fg (drawn over the parts), steps [[action…] one per word], finale
//   [action…], done { title, sub }.
// A part is drawn around (0, 0) and placed at (x, y); `o` is the point it
// grows and turns around ("50% 100%" = its bottom middle); `hid` keeps it off
// the scene until a step shows it. Actions: see act() in sayplay.js.

export const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="#1cb0f6"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#1cb0f6" stroke-width="2.2" stroke-linecap="round"/></svg>';
export const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="#fff"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
export const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z" fill="#fff"/></svg>';

export function partSvg(p) {
  const style = p.o ? ` style="--o:${p.o}"` : "";
  // a part that starts small (s) or turned (r) says so twice: the drawn
  // transform, and data-s / data-r for sayplay.js to move it on from
  const s = p.s ?? 1, r = p.r ?? 0, start = s !== 1 || r !== 0;
  const data = (s !== 1 ? ` data-s="${s}"` : "") + (r !== 0 ? ` data-r="${r}"` : "");
  const pm = start ? ` style="transform:translate(0px,0px) rotate(${r}deg) scale(${s})"` : "";
  return `<g id="p-${p.id}" class="part${p.hid ? " hid" : ""}" transform="translate(${p.x} ${p.y})"${style}${data}><g class="pm"${pm}><g class="pa">${p.svg}</g></g></g>`;
}
export function stageSvg(g) { return g.bg + g.parts.map(partSvg).join("") + (g.fg || ""); }

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function check(g) {
  const want = g.group === "simple" ? 5 : 8;
  if (!/^[a-z]+$/.test(g.key)) throw new Error(g.key + ": keys are lowercase letters only");
  if (g.steps.length !== want) throw new Error(g.key + " has " + g.steps.length + " steps, not " + want);
  const ids = new Set(g.parts.map((p) => p.id));
  if (ids.size !== g.parts.length) throw new Error(g.key + ": two parts share an id");
  for (const a of [...g.steps.flat(), ...g.finale]) {
    if (!ids.has(a.id)) throw new Error(g.key + ": an action names a part that isn't drawn: " + a.id);
    if (!["show", "hide", "move", "by", "scale", "turn", "fx"].includes(a.a)) throw new Error(g.key + ": unknown action " + a.a);
  }
  return g;
}

export function page(g) {
  check(g);
  const run = { key: g.key, title: g.title, steps: g.steps, finale: g.finale, done: g.done };
  const ages = g.group === "simple" ? "3-4" : "5-8";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <title>Sona — ${esc(g.title)}</title>
  <link href="/fonts.css" rel="stylesheet">
  <link href="/sayplay.css" rel="stylesheet">
  <meta name="theme-color" content="${g.top}" />
  <!--
    ${esc(g.title)}: a Say & Play game (suggested ages ${ages}). ${esc(g.blurb)}
    Written by tools/gameart/build.mjs: change the game there and rebuild,
    not here. What the mic may do, and why a spoken move is play and never
    practice data, is at the top of /sayplay.js.
  -->
  <style>:root{--top:${g.top};--bottom:${g.bottom};}</style>
</head>
<body data-phase="boot">
  <div id="app">
    <div id="top">
      <button id="close" aria-label="Back">✕</button>
      <span class="hudpill"><span id="ttl">${esc(g.title)}</span></span>
      <span id="spacer"></span>
      <span class="hudpill" id="dots" role="img" aria-label="0 of ${g.steps.length}"></span>
    </div>
    <div id="stageWrap"><svg id="stage" viewBox="0 0 440 400" role="img" aria-label="${esc(g.alt)}">${stageSvg(g)}</svg></div>
    <div id="turnPanel" aria-live="polite">
      <div id="picBox"><span id="pic"></span></div>
      <div id="word"></div>
      <button id="hear" aria-label="Hear it again">${SPEAKER}<span>Hear it</span></button>
      <div id="listenRow">
        <span id="echoWrap"><img id="echoFace" src="/coach/echo/echo-idle.svg" alt="Echo" /></span>
        <span id="micState"></span>
        <span id="cheer"></span>
        <button id="micBtn" hidden aria-label="Listen again">${MIC}</button>
      </div>
    </div>
  </div>

  <div class="ovl" id="startOvl">
    <div class="ovlCard">
      <h2 id="startTitle">${esc(g.title)}</h2>
      <p>${esc(g.how)}</p>
      <p class="small" id="startSound"></p>
      <button id="startBtn" aria-label="Play">${PLAY}</button>
    </div>
  </div>
  <div class="ovl" id="primer">
    <div class="ovlCard">
      <img class="ovlEcho" src="/coach/echo/echo-listening.svg" alt="" />
      <h2>Let Echo hear you!</h2>
      <p>Say each word, and watch what happens.</p>
      <p class="small" id="micPromise"></p>
      <button class="btn" id="primerYes">Turn on Echo's ears</button>
      <button class="ghost" id="primerNo">Not now</button>
    </div>
  </div>
  <div class="ovl" id="pauseOvl">
    <div class="ovlCard">
      <img class="ovlEcho" src="/coach/echo/echo-idle.svg" alt="" />
      <h2>Paused</h2>
      <button class="btn" id="resume">Keep playing</button>
    </div>
  </div>
  <div class="ovl" id="endOvl">
    <div class="ovlCard">
      <img class="ovlEcho endStar" src="/coach/echo/echo-celebrate.svg" alt="" />
      <h2 id="endTitle"></h2>
      <p id="endSub"></p>
      <button class="btn" id="again">Play again</button>
      <button class="ghost" id="goHome">Back home</button>
    </div>
  </div>

  <script src="/sona.js"></script>
  <script src="/sayplay.js"></script>
  <script>SayPlay.start(${JSON.stringify(run)});</script>
</body>
</html>
`;
}
