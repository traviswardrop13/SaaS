/* Short, optional sound-powered help for the live arcade games. */
    // A deliberate, short listening turn stays inside the active game. Holding
    // the scene keeps game sounds out of the mic and preserves the child's progress.
    var slowTurn=null, slowMs=0, slowTotal=8000, slowSaid=false;
    function slowFactor(){ return slowMs>0?0.55:1; }
    // Optional, per page (SLOW_HELP): reps counts more than one try in a turn,
    // msFor(n) sets the earned time for n tries, onEarn(n) starts the page's
    // own show, say/sayOnce replace Echo's instruction and speak it only on
    // the first turn, and idle is the resting status. A page that sets none of
    // them keeps the one-try, eight-second help unchanged.
    function slowIdle(){ return SLOW_HELP.idle||("Tap Echo to "+SLOW_HELP.action); }
    function paintSlowKeys(){
      var visible=tok&&!window.__speechLeaving&&phase===SLOW_HELP.phase&&!window.__ended&&(!reviveWait||!!slowTurn)&&(!!slowTurn||!SLOW_HELP.eligible||SLOW_HELP.eligible());
      $("slowControl").hidden=!visible;
      document.body.classList.toggle("speech-help-active",!!slowTurn);
      $("slowKeys").disabled=!!slowTurn||slowMs>0;
      $("slowCancel").hidden=!slowTurn;
      $("slowControl").classList.toggle("earned",slowMs>0);
      document.body.classList.toggle("speech-help-earned",slowMs>0&&!slowTurn&&phase===SLOW_HELP.phase);
      var reps=document.getElementById("slowReps");
      if(reps){ reps.hidden=!slowTurn; var said=slowTurn?slowTurn.reps||0:0; for(var i=0;i<reps.children.length;i++) reps.children[i].className=i<said?"on":""; }
      $("slowSound").textContent=SAYTXT||"rrrr";
      $("slowKeys").setAttribute("aria-label","Say "+(SAYTXT||"rrrr")+" to "+SLOW_HELP.action);
      $("slowMeter").style.width=(slowMs/slowTotal*100)+"%";
    }
    function stopSlowVoice(t){
      if(t.abort){t.abort.abort();t.abort=null;}
      if(t.audioStop){var stop=t.audioStop;t.audioStop=null;stop();}
    }
    function slowAudio(url,t){return new Promise(function(resolve){
      if(slowTurn!==t||t.finishing||document.hidden)return resolve();
      var a=new Audio(url),timer,done=false,p=S.getProfile();
      a.volume=p.volume!=null?Math.max(0,Math.min(1,Number(p.volume)||0)):0.8;
      function finish(){if(done)return;done=true;clearTimeout(timer);a.onended=null;a.onerror=null;try{a.pause();a.removeAttribute("src");a.load();}catch(e){}if(t.audioStop===finish)t.audioStop=null;resolve();}
      t.audioStop=finish;a.onended=finish;a.onerror=finish;timer=setTimeout(finish,10000);
      try{var result=a.play();if(result&&result.catch)result.catch(finish);}catch(e){finish();}
    });}
    function slowPrompt(t){
      var p=S.getProfile();
      if(p.voiceOn===false||Number(p.volume)===0)return Promise.resolve();
      // A child who has heard the instruction once hears only the sound after
      // it: a second try should cost a second, not a sentence and a download.
      var instruct=!(SLOW_HELP.sayOnce&&slowSaid);slowSaid=true;
      var controller=new AbortController();t.abort=controller;
      var timeout=setTimeout(function(){controller.abort();},5000),url;
      return (instruct?fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:SLOW_HELP.say||("To "+SLOW_HELP.action+", say"),voice:p.voiceId||"",stable:true}),signal:controller.signal}):Promise.resolve({ok:false}))
        .then(function(response){return response.ok?response.arrayBuffer():null;})
        .then(function(bytes){if(bytes&&slowTurn===t&&!t.finishing&&!document.hidden){url=URL.createObjectURL(S.pcmWave(bytes));return slowAudio(url,t);}})
        .catch(function(){})
        .then(function(){clearTimeout(timeout);if(url)URL.revokeObjectURL(url);if(t.abort===controller)t.abort=null;
          // Use the existing recorded sound, never ask TTS to guess a phoneme.
          if(slowTurn===t&&!t.finishing&&S.ALL_SOUNDS.indexOf(SND)>=0)return slowAudio("/coach/say-echo/"+SND+"-demo.mp3",t);
        });
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
      t.finishing=true;clearTimeout(t.timer);stopSlowVoice(t);reviveWait=false;closeReviveMic();
      $("slowStatus").textContent=heard?"Listening check…":(message||"Tap Echo to try again");
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
          slowTurn=null;
          var n=Math.max(1,t.reps||1);
          if(accepted){slowTotal=slowMs=SLOW_HELP.msFor?SLOW_HELP.msFor(n):8000;$("slowStatus").textContent=SLOW_HELP.earned;sfx(SLOW_HELP.earnSfx||"complete");}
          else $("slowStatus").textContent=message||(heard?"Try your sound again":"Tap Echo to try again");
          if(!window.__ended&&phase===SLOW_HELP.phase)playing=true;
          paintSlowKeys();if(accepted&&SLOW_HELP.onEarn)SLOW_HELP.onEarn(n);resolve();
        },Math.max(0,micClosedAt+SETTLE_MS-performance.now()));});
      });
      return t.done;
    }
    function beginSlowKeys(){
      if(!tok||!playing||phase!==SLOW_HELP.phase||(SLOW_HELP.eligible&&!SLOW_HELP.eligible())||slowTurn||slowMs>0||rv.pending||window.__ended)return;
      if(!CAN_LISTEN){$("slowStatus").textContent="Microphone unavailable";return;}
      var t={finishing:false,cancelled:false,native:null,nativeSettled:false,nativeStarted:false,reps:0};slowTurn=t;
      playing=false;reviveWait=true;$("slowStatus").textContent="Listen to Echo…";paintSlowKeys();
      function prompt(){
        if(slowTurn!==t||t.finishing||document.hidden)return;
        var wait=Math.max(quietUntil,micClosedAt+SETTLE_MS)-performance.now();
        if(wait>0){t.timer=setTimeout(prompt,wait);return;}
        slowPrompt(t).then(function(){
          if(slowTurn!==t||t.finishing||document.hidden)return;
          quietUntil=Math.max(quietUntil,performance.now()+QUIET_MS);
          $("slowStatus").textContent="Get ready…";openReviveMic();
        });
      }
      prompt();
    }
    document.getElementById("slowKeys").onclick=beginSlowKeys;
    document.getElementById("slowCancel").onclick=function(){if(slowTurn)slowTurn.cancelled=true;finishSlowKeys(false,"Tap Echo to try again");};
