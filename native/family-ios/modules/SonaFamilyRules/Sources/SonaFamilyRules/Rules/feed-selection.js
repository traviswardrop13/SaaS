// Verbatim selection and authored asks from public/arcade-feed.html.
function nativeFeedGame(options) {
    var S = Sona, SOUND = (S && S.rotSound) ? S.rotSound() : "R";
    function pool(sound){ if(S&&S.playPool) return S.playPool(sound,8)||[]; var ws=(S&&S.playWords)?(S.playWords(sound)||[]):[]; return ws.filter(function(w){ return w&&w.w&&w.e; }).sort(function(a,b){ return a.w.length-b.w.length; }).slice(0,8); }
    var TARGETS=pool(SOUND);
    if(!TARGETS.length){ SOUND="R"; TARGETS=pool("R"); }
    var OTHERS=[];
    try{
      // A wrong picture never has the practice sound in it anywhere: once
      // the end of words opened, "bus" (a B word) beside "glass" was a second
      // right answer for S. Sona.hasSound reads the spelling (an x is a k and
      // an s). The first-letter rule stays.
      // Nor a word filed under the practice sound at all (Z's "nose" and
      // "rose" spell their z with an s), so a target never shows up twice.
      var OWN={}; ((S.WORDS&&S.WORDS[SOUND])||[]).forEach(function(w){ OWN[w.w]=1; });
      (S.ALL_SOUNDS||[]).forEach(function(s){ if(s===SOUND)return; (S.wordsFor(s,"i")||[]).forEach(function(w){ if(w&&w.w&&w.e&&!OWN[w.w]&&w.w[0].toLowerCase()!==String(TARGETS[0]&&TARGETS[0].w||" ")[0].toLowerCase()&&!(S.hasSound&&S.hasSound(w.w,SOUND))) OTHERS.push(w); }); });
    }catch(e){}


    function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=(Math.random()*(i+1))|0,t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

    if (!TARGETS.length) return null;
    var usedIdx = [], turnN = 0, target = null, turns = [];
    function word(item) { return { word: item.w, emoji: item.e || "", position: item.pos || "" }; }
    for (var index = 0; index < 5; index++) {
      var ti; do{ ti=(Math.random()*TARGETS.length)|0; }while(TARGETS.length>1&&usedIdx.indexOf(ti)>=0&&usedIdx.length<TARGETS.length);
      usedIdx.push(ti); if(usedIdx.length>=TARGETS.length)usedIdx=[];
      target=TARGETS[ti]; turnN++;

      var opts=[target].concat(shuffle(OTHERS.slice()).slice(0,3));
      if(opts.length<2){ opts=[target].concat(TARGETS.filter(function(w){return w.w!==target.w;}).slice(0,3)); }
      shuffle(opts);

        turns.push({ target: word(target), choices: opts.map(word),
            ask: "Where is the "+target.w+"? Say... "+target.w+".", repeatAsk: "Say... "+target.w+".",
            markedWord: S.soundMark ? S.soundMark(target.w, SOUND, target.pos) : target.w });
    }
    var profile = S.getProfile(), feed = {};
    try { feed = JSON.parse(localStorage.getItem(S.kkey("sona.feed.v1")) || "{}"); } catch (_) {}
    return { title: "Feed Echo", sound: SOUND, soundLabel: S.soundLabel(SOUND), family: S.soundFamily(SOUND),
        voice: profile.voiceId || "", voiceOn: profile.voiceOn !== false, soundOn: profile.soundOn !== false,
        volume: profile.volume == null ? 0.8 : Number(profile.volume), micReady: localStorage.getItem("sona.micok") === "1",
        microphonePromise: S.MIC_PROMISE, lifetimeFed: Number(feed.fed) || 0, turns,
        policy: {"floorMilliseconds":250,"historyMilliseconds":3000,"listenMilliseconds":8000,"minimumRMS":0.035,"roomMultiplier":3,"voicedFrames":4,"quietMilliseconds":200,"settleMilliseconds":200,"soundQuietMilliseconds":900,"voiceTailMilliseconds":250,"roomPercentile":0.2,"lowMaximumCentroid":1800,"lowMaximumHighFraction":0.22,"hissMinimumCentroid":1100,"hissMinimumHighFraction":0.1} };
}
