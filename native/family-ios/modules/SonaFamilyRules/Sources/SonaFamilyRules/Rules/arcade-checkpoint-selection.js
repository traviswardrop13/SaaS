// Authored literals and cardAsk from the shipping arcade pages; gameAsk stays canonical.
function nativeArcadeCheckpoint(p) {
    var S=Sona;
    if (["slice","tiles","stack","run","glide","rise"].indexOf(p.game)<0 || [0,1,2].indexOf(p.card)<0) return null;
    if (p.sound!=null && (typeof p.sound!=="string" || S.ALL_SOUNDS.indexOf(p.sound.toUpperCase())<0)) return null;
    ["sona.boost.sound","sona.boost.level","sona.boost.ask","sona.boost.pos"].forEach(k=>sessionStorage.removeItem(k));
    if(p.sound) sessionStorage.setItem("sona.boost.sound",p.sound);
    if(p.boostLevel!=null) {
        if(["isolation","syllable","word","sentence"].indexOf(p.boostLevel)<0 || typeof p.boostAsk!=="string" || p.boostAsk.length>200) return null;
        sessionStorage.setItem("sona.boost.level",p.boostLevel);
        sessionStorage.setItem("sona.boost.ask",p.boostAsk);
        if(p.boostPosition!=null) sessionStorage.setItem("sona.boost.pos",p.boostPosition);
    }
    var SND="R", SAYTXT="rrrr", CAN_LISTEN=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
    (function(){
      var snd=""; try{ snd=sessionStorage.getItem("sona.boost.sound")||""; }catch(e){}
      if(!snd){ try{ snd=((S&&S.getProfile&&S.getProfile().focusSounds)||["R"])[0]; }catch(e){ snd="R"; } }
      SND=String(snd).toUpperCase(); SAYTXT=(S&&S.soundSay)?S.soundSay(SND):"rrrr";
    })();

    if(S.ALL_SOUNDS.indexOf(SND)<0) return null;
    function esc(t){ return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
    function cardAsk(n){
      var a=null; try{ a=S.gameAsk(SND,n); }catch(e){}
      return a&&a.text?a:{rung:0,level:"isolation",text:SAYTXT,html:'<b class="snd">'+esc(SAYTXT)+'</b>',clip:"/coach/say-echo/"+SND+"-sound.wav",say:""};
    }

    var STRETCHES=[
      {name:"the park",len:160,grass:"#8fdc7a",edge:"#6fcf62",side:"tree"},
      {name:"the beach",len:190,grass:"#f6dfa4",edge:"#67c6ef",side:"palm"},
      {name:"the forest",len:220,grass:"#5cb35a",edge:"#3f8f47",side:"pine"}
    ];

    function title(a) {
        var SAYTXT=a.text,wave=p.card-1,floor=p.card-1,next=p.card,stretch=p.card-1;
        if(p.card===0) return "Say \u201C"+(SAYTXT||"rrrr")+"\u201D for a new life!";
        switch(p.game) {
        case "slice": return "Say “"+a.text+"” "+("for wave "+(wave+2)+"!");
        case "tiles": return "Say \u201C"+SAYTXT+"\u201D for song "+(next+1)+"!";
        case "stack": return "Say \u201C"+SAYTXT+"\u201D for floor "+(floor+2)+"!";
        case "run": return "Say \u201C"+SAYTXT+"\u201D to run to "+STRETCHES[stretch+1].name+"!";
        case "glide": return "Say \u201C"+SAYTXT+"\u201D to fly on!";
        case "rise": return "Say \u201C"+SAYTXT+"\u201D to rise higher!";
        }
    }
    function ask(a) { return {rung:a.rung,level:a.level,text:a.text,position:a.pos||"",markedHTML:a.html,
        clip:a.clip||"",modelText:a.say?("To keep playing, say... "+a.say+"."):"",title:title(a)}; }
    var bare=cardAsk(0), desired=p.game==="slice"&&p.card>0?cardAsk(p.card):bare, profile=S.getProfile();
    return {gameID:p.game,sound:SND,family:S.soundFamily(SND),card:p.card,
        voiceID:profile.voiceId||"",voiceOn:!(profile.voiceOn===false||Number(profile.volume)===0),
        volume:profile.volume==null?0.8:Number(profile.volume),humanClipsEnabled:!!(S.humanClipsOn&&S.humanClipsOn()),
        intro:p.card===0?"For a new life, say":"To keep playing, say",goText:"Go!",stepBackLine:"I have an idea. Let's try this one.",desired:ask(desired),bare:ask(bare),
        ...{"modelWaitMilliseconds":3000,"voiceTailMilliseconds":250,"bareLineWaitMilliseconds":2500,"takeStartMilliseconds":3000}};
}
