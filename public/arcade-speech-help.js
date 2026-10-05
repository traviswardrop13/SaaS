/* Echo's sound power in the five round games: Fruit Slice (Super Slice),
   Piano Tiles (slow keys), Block Stacker, Sound Sprint and Flappy Glide (slow
   help). Each page sets window.SLOW_HELP and keeps its own microphone
   (openReviveMic, closeReviveMic, listenFor) and its own ear; this file holds
   the turn, the ask and the reward, once.

   ECHO ASKS, THEN LISTENS (Travis, 3 Oct 2026: "I don't want them to have to
   tap echo to then say the sound ... I want them to be able to just be
   playing the game and at any given point say the sound ... have 11 Labs
   voice maybe say that like mid game"). He was told that on an iPhone a page
   holding the mic plays everything like a phone call (quieter, and the
   volume buttons change call volume), and chose "Echo asks, then listens"
   over a mic that stays on the whole game. So:
     - nobody taps: after about SLOW_ASK.first ms of play, then every
       SLOW_ASK.every ms of play, Echo asks: the game's own line the first
       time in a visit ("To slow the keys, say", "Super Slice! Say"), then
       just Rachel's take of the sound, then "Go!" (the say-it card's voice,
       /arcade-sayit.js: media in the app, Web Audio on the website);
     - THE GAME KEEPS GOING while he asks and while he listens. Nothing freezes;
       the game's own sounds pause (sfx and the piano's notes stand down while a
       turn is on), so nothing plays over his voice or into the open mic;
     - he listens for SLOW_ASK.listen ms; one heard try, quick or held, earns
       the power at once, exactly as before (Super Slice ten seconds, the others
       eight seconds at 55%), and is one rep on the week's count (Sona.gameRep),
       never practice data;
     - nothing heard: the mic closes quietly and the game goes on. Two asks in a
       row with nothing heard and the next waits SLOW_ASK.quiet ms instead, so a
       child who isn't playing along isn't asked every twenty seconds;
     - a tap on Echo still asks at once, the same way: a shortcut, never needed.
   Play time only: no ask during a say-it card, a break, a finale, the power
   itself, a hidden page or a phone that has said no to the mic. A round that
   ends while he is asking ends the turn first (the card never meets a live
   turn). */
    var slowTurn=null, slowMs=0, slowTotal=8000, slowSaid={};
    var SLOW_ASK={first:10000, every:20000, quiet:40000, listen:8000, soon:1500};
    var slowAskPlay=0, slowAskAt=SLOW_HELP.first||SLOW_ASK.first, slowMissed=0, slowNoMic=false, slowAskLast=0, slowVoice=null;
    function slowFactor(){ return slowMs>0?0.55:1; }
    function slowIdle(){ return SLOW_HELP.idle||("Say "+(SAYTXT||"rrrr")+" when Echo asks"); }
    function slowLineText(){ return (SLOW_HELP.line&&SLOW_HELP.line())||SLOW_HELP.say||("To "+SLOW_HELP.action+", say"); }
    function slowAskSoon(){
      if(!CAN_LISTEN||slowNoMic||slowTurn||slowMs>0||slowMissed>=2) return;
      slowAskAt=Math.min(slowAskAt,slowAskPlay+SLOW_ASK.soon);
    }
    // Warm both reasons before play, so the first ask explains the reward.
    document.addEventListener("DOMContentLoaded",function(){
      if(!window.SayIt||!SayIt.line||!window.S||!S.getProfile||!S.getProfile().voiceOn) return;
      SayIt.line(SLOW_HELP.say||("To "+SLOW_HELP.action+", say"));
      if(SLOW_HELP.heartSay) SayIt.line(SLOW_HELP.heartSay);
      (SLOW_HELP.lines||[]).forEach(function(text){ SayIt.line(text); });
    });
    // The page's mic is wanted by the say-it card (reviveWait) or by a sound
    // turn still listening. A turn never sets reviveWait: that is the card's,
    // and a turn that ended under a card must not take it away.
    function micWanted(){ return reviveWait||(!!slowTurn&&!slowTurn.finishing); }
    function paintSlowKeys(){
      var visible=tok&&!window.__speechLeaving&&!window.__pianoLeaving&&phase===SLOW_HELP.phase&&!window.__ended&&(!reviveWait||!!slowTurn)&&(!!slowTurn||!SLOW_HELP.eligible||SLOW_HELP.eligible());
      $("slowControl").hidden=!visible;
      document.body.classList.toggle("speech-help-active",!!slowTurn);
      $("slowControl").classList.toggle("asking",!!slowTurn&&!slowTurn.finishing);
      $("slowKeys").disabled=!!slowTurn||slowMs>0;
      $("slowControl").classList.toggle("earned",slowMs>0);
      document.body.classList.toggle("speech-help-earned",slowMs>0&&!slowTurn&&phase===SLOW_HELP.phase);
      $("slowSound").textContent=SAYTXT||"rrrr";
      $("slowKeys").setAttribute("aria-label","Say "+(SAYTXT||"rrrr")+" to "+SLOW_HELP.action);
      $("slowMeter").style.width=(slowMs/slowTotal*100)+"%";
    }
    // Echo's voice for the ask: the say-it card's (/arcade-sayit.js), made the
    // first time it is needed, when the page's own mic and context exist.
    function slowVoiceGet(){
      if(slowVoice||!window.SayIt) return slowVoice;
      slowVoice=SayIt.voice({
        up:function(){ return !!slowTurn&&!slowTurn.finishing&&!slowTurn.listening; },
        wait:function(){ return rv.pending||rv.st?40:Math.max(typeof chimeEnd==="number"?chimeEnd:0,micClosedAt+SETTLE_MS)-performance.now(); },
        note:function(t){
          if(!slowTurn||slowTurn.finishing||slowTurn.listening) return;
          $("slowStatus").textContent=t;
          if(typeof echoPose==="function") echoPose($("slowKeys").querySelector("img"),"talk");
        },
        clip:function(){ return S.ALL_SOUNDS.indexOf(SND)>=0?"/coach/say-echo/"+SND+"-sound.wav":""; },
        ctx:function(){ if(!rv.ctx){ var AC=window.AudioContext||window.webkitAudioContext; rv.ctx=new AC(); } return rv.ctx; },
        // the game's own line once a visit, said to its end; after that the
        // sound alone (Rachel's take), which a child has already heard asked for
        ask:function(t){
          var text=slowLineText(), first=!slowSaid[text];
          return (first?t.line(text):Promise.resolve(false)).then(function(said){
            if(said===true) slowSaid[text]=true;
            return t.take();
          });
        },
        listen:slowListen
      });
      return slowVoice;
    }
    function slowListen(spoke){
      var t=slowTurn; if(!t||t.finishing||t.listening) return;
      t.listening=true;
      // the tail every listening page keeps after a voice line
      if(spoke) quietUntil=Math.max(quietUntil,performance.now()+(window.SayIt?SayIt.VOICE_TAIL_MS:250));
      $("slowStatus").textContent="Say "+(SAYTXT||"rrrr")+"!";
      openReviveMic();
    }
    function stopSlowRecognition(t){
      if(t.stopping)return t.stopping;
      function stop(){try{return Promise.resolve(S.speechStop?S.speechStop():null).catch(function(){return null;});}catch(e){return Promise.resolve(null);}}
      if(!t.native)return Promise.resolve(null);
      var settled=t.nativeSettled,first=stop();
      // Availability/start may settle after cancellation. Stop again then,
      // before releasing the game back to its speaker audio route.
      t.stopping=(settled?first:Promise.all([first,t.native]).then(stop)).then(function(result){
        if(t.nativeStarted)micClosedAt=performance.now();
        return result;
      });
      return t.stopping;
    }
    function finishSlowKeys(heard,message){
      var t=slowTurn;if(!t)return Promise.resolve();if(t.finishing)return t.done;
      t.finishing=true;clearTimeout(t.timer);if(slowVoice)slowVoice.stop();closeReviveMic();
      $("slowStatus").textContent=heard?"Listening check…":(message||slowIdle());
      // A cancelled permission request can still return a stream. Its page's
      // generation guard closes that stream before any gameplay audio resumes.
      t.done=new Promise(function(resolve){(function waitForMic(){if(rv.pending)setTimeout(waitForMic,30);else resolve();})();}).then(function(){return stopSlowRecognition(t);}).then(function(result){
        var accepted=!!heard&&!t.cancelled&&!document.hidden&&!window.__ended;
        if(accepted&&t.nativeStarted&&S.hearVerdict){
          var verdict=S.hearVerdict(result&&result.text||"",SND,SAYTXT,{level:"isolation"});
          if(verdict==="fail")accepted=false;
        }
        return new Promise(function(resolve){setTimeout(function(){
          if(slowTurn!==t){resolve();return;}
          accepted=accepted&&!t.cancelled&&!document.hidden&&!window.__ended;
          slowTurn=null; slowAskPlay=0;
          if(accepted){
            slowMissed=0; slowAskAt=SLOW_ASK.every;
            slowTotal=slowMs=SLOW_HELP.ms||8000;$("slowStatus").textContent=SLOW_HELP.earned;sfx(SLOW_HELP.earnSfx||"complete");try{if(S.gameRep)S.gameRep(SND);}catch(e){}
          }else{
            // a turn the round, the page or the phone ended is not a miss
            if(!t.cancelled) slowMissed++;
            slowAskAt=slowMissed>=2?SLOW_ASK.quiet:SLOW_ASK.every;
            $("slowStatus").textContent=message||slowIdle();
          }
          paintSlowKeys();if(accepted&&SLOW_HELP.onHeard)SLOW_HELP.onHeard();if(accepted&&SLOW_HELP.onEarn)SLOW_HELP.onEarn();resolve();
        },Math.max(0,micClosedAt+SETTLE_MS-performance.now()));});
      });
      return t.done;
    }
    // the phone said no to the mic, or has none: the turn ends and Echo stops
    // asking for this visit (he would only be asking a child he can't hear)
    function slowMicFailed(message){ slowNoMic=true; return finishSlowKeys(false,message); }
    function beginSlowKeys(){
      if(!tok||!playing||phase!==SLOW_HELP.phase||(SLOW_HELP.eligible&&!SLOW_HELP.eligible())||slowTurn||slowMs>0||rv.pending||rv.st||reviveWait||window.__ended)return;
      if(!CAN_LISTEN||slowNoMic){$("slowStatus").textContent="Microphone unavailable";return;}
      var t={finishing:false,cancelled:false,listening:false,native:null,nativeSettled:false,nativeStarted:false};slowTurn=t;slowAskPlay=0;
      $("slowStatus").textContent="Listen to Echo…";paintSlowKeys();
      var v=slowVoiceGet();
      if(v) v.speak(); else slowListen(false);
    }
    // The ask clock: play time only. It also ends a turn whose round ended
    // under it (the wave's last fruit, the song's last note), well before the
    // break's say-it card, which waits about two seconds more.
    function slowAskReady(){
      return !!tok&&playing&&phase===SLOW_HELP.phase&&!window.__ended&&!window.__speechLeaving&&!window.__pianoLeaving&&!document.hidden&&!reviveWait&&!slowTurn&&!(slowMs>0)&&!rv.pending&&!rv.st&&CAN_LISTEN&&!slowNoMic&&(!SLOW_HELP.eligible||SLOW_HELP.eligible());
    }
    setInterval(function(){
      var now=performance.now(), dt=slowAskLast?Math.min(now-slowAskLast,1000):0; slowAskLast=now;
      try{
        if(slowTurn&&!slowTurn.finishing&&(phase!==SLOW_HELP.phase||window.__ended)){ slowTurn.cancelled=true; finishSlowKeys(false); return; }
        if(!slowAskReady()) return;
        slowAskPlay+=dt;
        if(slowAskPlay>=slowAskAt) beginSlowKeys();
      }catch(e){}
    },200);
    document.getElementById("slowKeys").onclick=beginSlowKeys;
