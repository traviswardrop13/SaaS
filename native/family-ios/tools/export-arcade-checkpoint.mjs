import assert from "node:assert/strict";

// This projects the existing between-segment card only. Powers/new lives have
// their own source rules and are not added to this native checkpoint contract.
export function arcadeCheckpointSelection(source) {
  const slice = source("public/arcade-slice.html");
  const sayit = source("public/arcade-sayit.js");
  const help = source("public/arcade-speech-help.js");
  const games = ["slice", "tiles", "stack", "run", "glide", "rise"];
  function between(text, from, to) {
    const a = text.indexOf(from), b = text.indexOf(to, a);
    assert(a >= 0 && b > a, "Checkpoint source boundary changed: " + from);
    return text.slice(a, b);
  }
  function number(text, name) {
    const found = text.match(new RegExp("\\b" + name + "=(\\d+)|\\b" + name + " = (\\d+)"));
    assert(found, "Checkpoint timing changed: " + name);
    return Number(found[1] || found[2]);
  }
  const boot = between(slice, '    var SND="R", SAYTXT="rrrr", CAN_LISTEN=', "    function listenNote");
  const cardAsk = between(slice, "    function cardAsk(n){", "    // What card n");
  const model = slice.match(/JSON\.stringify\(\{text:("To keep playing, say\.\.\. "\+a\.say\+"\."),voice:/);
  const intro = sayit.match(/var ASK = ("[^"]+"), GO = ("[^"]+")/);
  const idea = slice.match(/var IDEA_LINE=("[^"\n]+")/);
  const lifeLine = help.match(/var LIFE_LINE=("[^"\n]+")/);
  const lifeTitle = help.match(/else sayCard\(("Say \\u201C"[^\n]+?),"none"\)/);
  const tail = slice.match(/sayCard\(("for wave "\+\(wave\+2\)\+"!"),"none",wave\+1\)/);
  assert(model && intro && idea && tail && lifeLine && lifeTitle, "Checkpoint authored lines changed");
  const titles = {};
  for (const game of games.slice(1)) {
    const page = source(`public/arcade-${game}.html`);
    assert(page.includes('sessionStorage.getItem("sona.boost.sound")') && page.includes('S.soundSay(SND)'), game + " no longer reads charge's sound");
    const title = page.match(/sayCard\(("Say \\u201C"[^\n]+?),"none"\)/);
    assert(title, "Cannot find between-segment title: " + game);
    titles[game] = title[1];
  }
  const stretches = between(source("public/arcade-run.html"), "    var STRETCHES=[", "    // every metre");
  const timing = {
    modelWaitMilliseconds: number(slice, "ASK_LINE_MS"), voiceTailMilliseconds: number(sayit, "VOICE_TAIL_MS"),
    bareLineWaitMilliseconds: number(sayit, "LINE_WAIT_MS"), takeStartMilliseconds: number(sayit, "TAKE_START_MS")
  };
  return `// Authored literals and cardAsk from the shipping arcade pages; gameAsk stays canonical.
function nativeArcadeCheckpoint(p) {
    var S=Sona;
    if (${JSON.stringify(games)}.indexOf(p.game)<0 || [0,1,2].indexOf(p.card)<0) return null;
    if (p.sound!=null && (typeof p.sound!=="string" || S.ALL_SOUNDS.indexOf(p.sound.toUpperCase())<0)) return null;
    ["sona.boost.sound","sona.boost.level","sona.boost.ask","sona.boost.pos"].forEach(k=>sessionStorage.removeItem(k));
    if(p.sound) sessionStorage.setItem("sona.boost.sound",p.sound);
    if(p.boostLevel!=null) {
        if(["isolation","syllable","word","sentence"].indexOf(p.boostLevel)<0 || typeof p.boostAsk!=="string" || p.boostAsk.length>200) return null;
        sessionStorage.setItem("sona.boost.level",p.boostLevel);
        sessionStorage.setItem("sona.boost.ask",p.boostAsk);
        if(p.boostPosition!=null) sessionStorage.setItem("sona.boost.pos",p.boostPosition);
    }
${boot}
    if(S.ALL_SOUNDS.indexOf(SND)<0) return null;
    function esc(t){ return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
${cardAsk}
${stretches}
    function title(a) {
        var SAYTXT=a.text,wave=p.card-1,floor=p.card-1,next=p.card,stretch=p.card-1;
        if(p.card===0) return ${lifeTitle[1]};
        switch(p.game) {
        case "slice": return "Say \u201C"+a.text+"\u201D "+(${tail[1]});
${Object.entries(titles).map(([key, expression]) => `        case ${JSON.stringify(key)}: return ${expression};`).join("\n")}
        }
    }
    function ask(a) { return {rung:a.rung,level:a.level,text:a.text,position:a.pos||"",markedHTML:a.html,
        clip:a.clip||"",modelText:a.say?(${model[1]}):"",title:title(a)}; }
    var bare=cardAsk(0), desired=p.game==="slice"&&p.card>0?cardAsk(p.card):bare, profile=S.getProfile();
    return {gameID:p.game,sound:SND,family:S.soundFamily(SND),card:p.card,
        voiceID:profile.voiceId||"",voiceOn:!(profile.voiceOn===false||Number(profile.volume)===0),
        volume:profile.volume==null?0.8:Number(profile.volume),humanClipsEnabled:!!(S.humanClipsOn&&S.humanClipsOn()),
        intro:p.card===0?${lifeLine[1]}:${intro[1]},goText:${intro[2]},stepBackLine:${idea[1]},desired:ask(desired),bare:ask(bare),
        ...${JSON.stringify(timing)}};
}
`;
}
