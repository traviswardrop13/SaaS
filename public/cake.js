/* Birthday Cake: circular stirring, falling batter, piping in the child's
   own colours, a child's own fruit arrangement, and the birthday candles.
   SayPlay owns all speech.

   Each word said two times starts the next recipe step and nothing else
   (until 11 Nov 2026 it also lent ten seconds of cooking power, so the
   steps nearly cooked themselves); the finger does all the cooking. The
   Cooking help pill's word still gives that power.

   A NEW PARTY EVERY ROUND (CAKE2, 11 Nov 2026): one of the eleven buddies
   with a sitting picture has a birthday and sits by the worktop; their age
   (3, 4 or 5) is how many candles go on; three fruits of the nine are on
   the tray; the six icing swirls come in one of four patterns; three of
   five icing colours sit in pots the child may tap to change the bag. The
   paper fan is gone: once the cake is done the birthday buddy blows the
   candles out (the finale). Echo explains each step once a visit.

   EVERY STEP ENDS (CLAUDE.md, "Every ball ends in a basket"), and the help
   that gets it there never needs speech: the cooking power is a bonus on top.
   This is a game for ages 3-4, so the gentle ladder is the default
   (setLittle(false) gives the ages 5-8 one).
   - The dropped steps (fruit, candles) count misses (misses, reset by the
     next word). A miss is a real try that did not work: a fruit or candle
     dragged off the tray and let go where it cannot go. A tap that moved
     nothing is never a miss, and waiting never is.
       ages 3-4: from the 1st miss the place glows and an arrow points to it
         (catch about 2-3x wider); from the 2nd almost anything works: a fruit
         or candle let go anywhere above the tray flies onto the cake.
       ages 5-8: miss 1 easier (about 1.5-2x), miss 2 glow and arrow, miss 3
         almost anything works.
   - The held steps (stirring, pouring, piping) count seconds of finger work
     that has not got anywhere (effort): ages 3-4 glow at 2 s, arrow and much
     easier at 4 s, almost anything at 6 s (ages 5-8: 4, 8, 12 s). Stirring:
     the ring gets wider, then the spoon may go round anywhere in the bowl.
     Pouring: the tin catches wider, then the batter drifts into the tin.
     Piping: the tip gets bigger, then holding the bag anywhere over the
     cake pipes the nearest swirl.
   No help finishes a step by itself: the finger still makes every move, and
   no timer completes one. Waiting never counts as effort. */
(function () {
  "use strict";
  // Echo's directions, short, and each said once a visit (told, below):
  // Play again bakes with no directions, as Build a Snowman does.
  var STEP_LINES = [
    "Stir the spoon all the way around the bowl.",
    "Hold the jug over the tin to pour.",
    "Hold the icing bag on each swirl.",
    "Drag four fruits onto your cake.",
    "Drag the candles onto the cake."
  ];
  // Every banner line: short (one line on a 320 px phone) and kind. Never
  // "missed", "wrong", "fail", "score", "points" or "correct".
  var LABELS = ["Stir all the way around", "Hold the jug over the tin", "Pipe icing on every swirl", "Pick four fruits for your cake", "Put the candles on the cake"];
  var SAY = { start: "Bake a cake for ", ask: "Say it for cooking help", jug: "Pick up the jug!", fruitTap: "Drag it to the cake", candleTap: "Drag it to a shape", room: "Nearly! Find a free spot", yum: "Yum! That looks delicious!", party: "Happy birthday to you!", finale: "Make a birthday wish!" };
  var HINTS = {
    stir: ["Keep the spoon on the ring", "Follow the arrow around", "Stir anywhere in the bowl!"],
    pour: ["Hold the jug over the tin", "Follow the arrow to the tin", "Just hold the jug!"],
    ice: ["Hold the bag on a swirl", "Follow the arrow to a swirl", "Hold the bag on the cake!"],
    fruit: ["So close! Try the cake top", "Follow the arrow to the cake", "Drop it near the cake!"],
    candles: ["So close! Try a glowing shape", "Follow the arrow to a shape", "Drop it near the cake!"]
  };
  var api,cv,ctx,W=390,H=844,raf=0,last=0,art={},active=false,paused=false,away=false,won=false,stage=0,stages=5,completed=0,power=0;
  var top=120,bottom=750,trayY=690,bowl={x:195,y:380,r:86},pan={x:195,y:400,rx:100,ry:28},cakeTop={x:195,y:370,rx:110,ry:34},cakeBox={x:60,y:330,w:270,h:190},tool={x:.75,y:.45};
  var mix=0,stirSweep=0,stirPrev=null,stirCredit=0,stirQuads=[false,false,false,false],panFill=0,bake=0,particles=[],spawned=0,impacts=0,missed=0,emission=0,icing=[];
  var fruits=[],fruitGoal=4,selectedFruit=0,candles=[],candleAnchors=[],placedCandles=0,draft=null,owner=null,surface=null,held=false,keyHeld=false,grab={x:0,y:0};
  // the party (newParty): whose birthday, how old, the tray's fruit, the
  // swirls' pattern and the three icing colours; lastParty keeps a round
  // from repeating the one before. told: the steps Echo has explained on
  // this page (never reset by Play again). blowAt: when the finale began.
  var party=null,lastParty=null,iceColor=0,told={},blowAt=-1,smoke=[];
  // the ladder (see the top of this file); little = a child aged 2 to 4
  var misses=0,effort=0,lastWork=-9,lastGain=-9,lastTap=-9,shownLevel=0,little=true,icedNow=false;
  // clock runs only while the page is live; doneAt is the celebration beat:
  // the step is reported this long after the cooking is finished, so the
  // chime is heard whole and a pause in between holds it (hoops.js too)
  var clock=0,doneAt=0,doneFor=-1,sparks=[],dones=0;
  var POWER=10,BEAT=1.15,RUB=[4,8,12],RUB_LITTLE=[2,4,6],FRUITS=["strawberry","kiwi","grapes"],COLORS=["#78bcc4","#d593b0","#a693c7","#e7c75f","#8fcfac"],ICE=[[-.63,-.23],[-.12,-.57],[.48,-.37],[.63,.23],[.08,.57],[-.48,.37]];
  // every fruit picture Fruit Slice already has; three a round on the tray
  var FRUIT_ALL=["strawberry","kiwi","grapes","apple","orange","peach","lemon","pineapple","watermelon"],FRUIT_SAY={strawberry:"a strawberry",kiwi:"a kiwi",grapes:"grapes",apple:"an apple",orange:"an orange",peach:"a peach",lemon:"a lemon",pineapple:"a pineapple",watermelon:"a slice of watermelon"};
  // six swirls in one of four patterns (u, v on the cake top, |u|,|v| < .7)
  var ICE_PATTERNS=[ICE,[[-.5,-.32],[0,-.32],[.5,-.32],[-.5,.3],[0,.3],[.5,.3]],[[-.65,0],[-.39,-.45],[-.13,.3],[.13,-.3],[.39,.45],[.65,0]],[[0,0],[0,-.6],[.57,-.19],[.35,.48],[-.35,.48],[-.57,-.19]]];
  // the icing colours: a fill and a piped edge (never orange: orange means
  // only the practice sound's letters)
  var ICE_COLORS=[{id:"pink",fill:"#f7bcd2",line:"#df8fae"},{id:"blue",fill:"#bddff3",line:"#84bbdd"},{id:"mint",fill:"#c3ead6",line:"#86c8a6"},{id:"lavender",fill:"#dccdf2",line:"#ab96d6"},{id:"vanilla",fill:"#fff7e6",line:"#d9cfb6"}];
  // the eleven buddies with a sitting picture, and the drawn area of each
  // (x0, y0, x1, y1 in its 512 px picture: train.js measured them)
  var BUDDY_BOX={bunny:[137,31,387,476],cat:[89,31,423,478],lion:[58,31,455,477],penguin:[97,31,425,476],frog:[73,31,445,475],bee:[50,30,462,476],dino:[106,31,406,480],dragon:[88,30,434,479],octopus:[47,30,475,477],panda:[74,31,437,478],unicorn:[95,30,417,480]};
  // where the party hat sits on each: across and down from the top of the
  // drawn area (fractions of its size) and a tilt, so it sits on the head,
  // between the bunny's ears and beside the unicorn's horn
  var HAT_AT={bunny:[0,.27,0],unicorn:[-.17,.15,-.3],bee:[0,.13,0],dino:[0,.05,0],dragon:[0,.07,0],lion:[0,.06,0],panda:[0,.04,0],cat:[0,.04,0],frog:[0,.04,0]};
  var BUDDIES=Object.keys(BUDDY_BOX),BUDDY_NAME={bunny:"Miso",cat:"Mochi",lion:"Sunny",penguin:"Pebble",frog:"Hops",bee:"Buzz",dino:"Rocky",dragon:"Ziggy",octopus:"Otto",panda:"Bao",unicorn:"Luna"},onParty=null;
  var CAKE_ART={aspect:512/357,cx:.5,cy:.296,rx:.48,ry:.196*512/357},$=function(id){return document.getElementById(id);};
  function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
  function live(){return !paused&&!away&&!document.hidden;}
  function canPlay(){return active&&!won&&live();}
  function mode(){return stage===0?"stir":stage===1?"pour":stage===2?"ice":stage===3?"fruit":"candles";}
  function heldStep(){var m=mode();return m==="stir"||m==="pour"||m==="ice";}
  // ── the ladder ──
  function ladder(){
    if(heldStep()){var t=little?RUB_LITTLE:RUB;return effort>=t[2]?3:effort>=t[1]?2:effort>=t[0]?1:0;}
    return little?(misses>=2?3:misses>=1?2:0):Math.min(3,misses);
  }
  function checkLevel(force){var l=ladder();if(l>shownLevel||force&&l>0){shownLevel=l;banner(HINTS[mode()][l-1]);}}
  function miss(){misses++;var l=ladder();shownLevel=l;banner(l>0?HINTS[mode()][l-1]:HINTS[mode()][0]);}
  function ringTol(){return Math.max(power>0?.09:.065,[.065,.10,.14,.14][ladder()]);}
  function stirGain(){return Math.max(power>0?1.7:1,[1,1.25,1.6,2.4][ladder()]);}
  function pourCatch(){return pan.rx/W+Math.max(power>0?.055:0,[0,.07,.16,.16][ladder()]);}
  function icingTip(){return Math.max(power>0?.055:.025,[.025,.04,.065,.065][ladder()]);}
  function icingRate(){return [1.8,2.2,2.8,3.4][ladder()];}
  function decorMagnet(){return Math.max(power>0?.05:.01,[.01,.06,.12,.12][ladder()]);}
  function candleMagnet(){return Math.max(power>0?.08:.045,[.045,.09,.15,.15][ladder()]);}
  function banner(t){if($("cakeBanner").textContent!==t)$("cakeBanner").textContent=t;}
  function image(name){var i=art[name];return i&&i.complete&&i.naturalWidth?i:null;}
  function need(name,src){if(art[name])return;var i=new Image();i.onload=function(){if(name==="base")fit();else draw();};i.src=src;art[name]=i;}
  // the kitchen once; a party's fruit and buddy only when that party comes
  function loadArt(){[["bg","/assets/crafted/game/pizza-kitchen-v1.webp"],["base","/assets/crafted/game/cake-base-v1.webp"],["bowl","/assets/crafted/game/cake-bowl-v1.webp"],["spoon","/assets/crafted/game/cake-spoon-v1.webp"],["jug","/assets/crafted/game/cake-jug-v1.webp"],["bag","/assets/crafted/game/cake-piping-v1.webp"],["hat","/assets/crafted/hat-party.webp"]].forEach(function(p){need(p[0],p[1]);});partyArt();}
  function partyArt(){if(!party)return;FRUITS.forEach(function(n){need(n,"/assets/crafted/fruit-"+n+".webp");});need("buddy-"+party.buddy,"/assets/crafted/buddy-"+party.buddy+"-sit.webp");}
  // the tray row starts right of the birthday buddy, who sits at its left
  function tray(index){return{x:W*(.38+index*.24),y:trayY};}
  function candleBox(){return tray(1);}
  function pick(list,not){var pool=list.filter(function(x){return x!==not;});return pool[Math.floor(Math.random()*pool.length)]||list[0];}
  function shuffled(list){var a=list.slice();for(var n=a.length-1;n>0;n--){var k=Math.floor(Math.random()*(n+1)),t=a[n];a[n]=a[k];a[k]=t;}return a;}
  // a new party: never the same buddy, fruit tray or swirl pattern as the
  // round before
  function newParty(){var was=lastParty||{},fruit;do{fruit=shuffled(FRUIT_ALL).slice(0,3);}while(was.fruits&&fruit.slice().sort().join()===was.fruits.slice().sort().join());
    party={buddy:pick(BUDDIES,was.buddy),age:3+Math.floor(Math.random()*3),fruits:fruit,pattern:ICE_PATTERNS.indexOf(pick(ICE_PATTERNS,ICE_PATTERNS[was.pattern])),ice:shuffled(ICE_COLORS.map(function(c,n){return n;})).slice(0,3)};
    lastParty=party;FRUITS=party.fruits;iceColor=party.ice[0];partyArt();
    for(var n=0;n<3;n++){var f=$("cakeFruit"+n);if(f)f.setAttribute("aria-label","Choose "+FRUIT_SAY[FRUITS[n]]+". Drag it to the cake. Keyboard: Space picks up, arrows move, Space places.");var pot=$("cakeIce"+n);if(pot)pot.setAttribute("aria-label",ICE_COLORS[party.ice[n]].id+" icing");}
    if(onParty)try{onParty({buddy:party.buddy,name:buddyName(party.buddy),age:party.age});}catch(e){}}
  function buddyName(id){try{var c=window.Sona&&Sona.characterById&&Sona.characterById(id);if(c&&c.name)return c.name;}catch(e){}return BUDDY_NAME[id]||id;}
  function distance(a,b){var dx=a.x-b.x,dy=(a.y-b.y)*H/W;return Math.sqrt(dx*dx+dy*dy);}
  function scenePoint(u,v){return{x:(cakeTop.x+u*cakeTop.rx)/W,y:(cakeTop.y+v*cakeTop.ry)/H};}
  function fruitRadius(){return .038;}
  function layout(){
    var room=Math.max(100,bottom-top),i=image("base"),aspect=i?i.naturalWidth/i.naturalHeight:CAKE_ART.aspect,sceneY=top+room*.43;
    trayY=bottom-40;bowl={x:W*.5,y:top+room*.45,r:Math.min(W*.22,room*.23)};pan={x:W*.5,y:sceneY+W*.07,rx:W*.26,ry:W*.075};
    var w=Math.min(W*.72,room*.92*aspect),h=w/aspect;cakeBox={x:W*.5-w*CAKE_ART.cx,y:sceneY-h*CAKE_ART.cy,w:w,h:h};cakeTop={x:W*.5,y:sceneY,rx:w*CAKE_ART.rx,ry:h*CAKE_ART.ry};
    icing=ICE_PATTERNS[party?party.pattern:0].map(function(p,n){var at=scenePoint(p[0],p[1]),old=icing[n];return{x:at.x,y:at.y,r:.032,progress:old?old.progress:0,color:old?old.color:-1};});
    candles=candleAnchors.map(function(p,n){var at=scenePoint(p.u,p.v),old=candles[n];return{x:at.x,y:at.y-.078*W/H,u:p.u,v:p.v,placed:old?old.placed:false,color:old?old.color:n,heat:old?old.heat:1};});
  }
  function fit(){if(!cv)return;stopGesture(true);var r=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,r.width);H=Math.max(1,r.height);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);top=$("cakeBanner").getBoundingClientRect().bottom-r.top+18;bottom=$("cakeControls").getBoundingClientRect().top-r.top-12;layout();tool.x=clamp(tool.x,.10,.90);tool.y=clamp(tool.y,(top+32)/H,(bottom-32)/H);hud();draw();}
  function fruitWorld(f){var p=scenePoint(f.u,f.v);return{type:f.type,x:p.x,y:p.y,r:fruitRadius(),angle:f.angle};}
  function flame(c){return{x:c.x,y:c.y-.104*W/H,heat:c.heat};}
  // the jug's painted body, in px from the spout tip (the tool point), so a
  // touch on its handle or its middle picks it up, not only the spout
  function jugRect(){var i=image("jug");if(i){var sc=Math.min(W*.28/i.naturalWidth,W*.28/i.naturalHeight),sw=i.naturalWidth*sc,sh=i.naturalHeight*sc;return{x0:-sw*.985,x1:sw*.015,y0:-sh*.128,y1:sh*.872};}return{x0:-W*.19,x1:W*.01,y0:-W*.05,y1:W*.12};}
  function jugHit(p){var r=jugRect(),dx=(p.x-tool.x)*W,dy=(p.y-tool.y)*H,pad=14;return dx>=r.x0-pad&&dx<=r.x1+pad&&dy>=r.y0-pad&&dy<=r.y1+pad;}
  function maxPourY(){return(pan.y-W*.06)/H;}
  function snapshot(){var trays=FRUITS.map(function(type,n){var p=tray(n);return{type:type,x:p.x/W,y:p.y/H};});window.__cake={active:active,paused:paused,stage:stage,stages:stages,completed:completed,won:won,mode:mode(),power:power,held:held,pointerId:owner,keyHeld:keyHeld,tool:{x:tool.x,y:tool.y},grab:{x:grab.x,y:grab.y},banner:$("cakeBanner").textContent,
      ladder:{level:ladder(),misses:misses,effort:effort,little:little},beat:doneAt>0,dones:dones,clock:clock,
      bowl:{x:bowl.x/W,y:bowl.y/H,ringRadius:bowl.r/W,mix:mix,angle:stirSweep,sweep:stirSweep,coverage:stirQuads.slice(),tolerance:ringTol()},jug:{box:(function(){var r=jugRect();return{x0:tool.x+r.x0/W,x1:tool.x+r.x1/W,y0:tool.y+r.y0/H,y1:tool.y+r.y1/H};})(),nozzle:{x:tool.x,y:tool.y},tilt:held&&stage===1?.45:0,pouring:held&&stage===1},pan:{x:pan.x/W,y:pan.y/H,rx:pan.rx/W,ry:pan.ry/W,fill:panFill},
      particles:particles.map(function(p){return{x:p.x,y:p.y*W/H,r:p.r};}),spawned:spawned,impacts:impacts,missed:missed,cakeTop:{x:cakeTop.x/W,y:cakeTop.y/H,rx:cakeTop.rx/W,ry:cakeTop.ry/W},icingZones:icing.map(function(p){return{x:p.x,y:p.y,r:p.r,progress:p.progress,color:p.color>=0?ICE_COLORS[p.color].id:""};}),iceColor:ICE_COLORS[iceColor].id,icePots:party?party.ice.map(function(c,n){var t=tray(n);return{color:ICE_COLORS[c].id,x:t.x/W,y:t.y/H};}):[],fruitTray:trays,fruits:fruits.map(fruitWorld),fruitGoal:fruitGoal,fruitSpacing:.085,selectedFruit:selectedFruit,
      candleBox:(function(){var b=candleBox();return{x:b.x/W,y:b.y/H,placed:placedCandles,total:candles.length};})(),candleTargets:candles.map(function(c){return{x:c.x,y:c.y,base:{x:c.x,y:c.y+.078*W/H},placed:c.placed,color:c.color,flame:flame(c)};}),
      party:party?{buddy:party.buddy,name:buddyName(party.buddy),age:party.age,fruits:party.fruits.slice(),pattern:party.pattern,ice:party.ice.map(function(c){return ICE_COLORS[c].id;})}:null,buddy:(function(){var b=buddySpot();b.floor=sceneFloor()/H;return b;})(),told:Object.keys(told),blowing:blowAt>=0,loaded:Object.keys(art).filter(function(k){return!!image(k);}),draft:draft?{kind:draft.kind,index:draft.index,type:draft.type,x:draft.x,y:draft.y}:null,
      stirGain:stirGain(),pourCatch:pourCatch(),icingTip:icingTip(),decorMagnet:decorMagnet(),candleMagnet:candleMagnet(),width:W,height:H,coordinates:"positions normalized to canvas; all radii/physical distances use canvas width. Candle target is the candle's center; base is separately published."};}
  function hud(){if(!cv)return;var allowed=canPlay(),m=mode(),b=$("cakeTool"),visible=m==="stir"||m==="pour"||m==="ice",gx=tool.x*W,gy=tool.y*H;b.hidden=!visible;b.disabled=!allowed;
    // in the pour step the grip sits on the jug's body, where a child grabs it
    if(m==="pour"){var jr=jugRect();gx+=(jr.x0+jr.x1)/2;gy+=(jr.y0+jr.y1)/2;}
    b.style.left=gx+"px";b.style.top=gy+"px";b.setAttribute("aria-pressed",held?"true":"false");
    for(var n=0;n<3;n++){var p=tray(n),f=$("cakeFruit"+n),pot=$("cakeIce"+n);f.hidden=m!=="fruit";f.disabled=!allowed||!!draft&&draft.index!==n;f.style.left=p.x+"px";f.style.top=p.y+"px";
      if(pot){pot.hidden=m!=="ice";pot.disabled=!allowed||held;pot.style.left=p.x+"px";pot.style.top=p.y+"px";pot.setAttribute("aria-pressed",party&&party.ice[n]===iceColor?"true":"false");}}
    var c=$("cakeCandles"),cb=candleBox(),left=placedCandles<candles.length;c.hidden=m!=="candles"||!left;c.disabled=!allowed||!!draft&&draft.kind!=="candle";c.style.left=cb.x+"px";c.style.top=cb.y+"px";
    $("cakeHelp").disabled=!allowed||held||!!draft;$("cakeHearStep").disabled=!allowed||held||!!draft;$("cakePower").hidden=power<=0;$("cakePowerFill").style.width=power/POWER*100+"%";snapshot();}
  function sprite(name,x,y,w,h,anchorX,anchorY){var i=image(name);if(!i)return false;var sc=Math.min(w/i.naturalWidth,h/i.naturalHeight),sw=i.naturalWidth*sc,sh=i.naturalHeight*sc;ctx.drawImage(i,x-sw*(anchorX===undefined?.5:anchorX),y-sh*(anchorY===undefined?.5:anchorY),sw,sh);return true;}
  function background(){var i=image("bg");if(i){var sc=Math.max(W/i.naturalWidth,H/i.naturalHeight),w=i.naturalWidth*sc,h=i.naturalHeight*sc;ctx.drawImage(i,(W-w)/2,(H-h)/2,w,h);}else{var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#eee2ce");g.addColorStop(1,"#d0ae7f");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}bunting();}
  // a party garland across the top of the kitchen, under the banner: drawn,
  // still, never under a finger (no new picture, and no orange flag)
  function bunting(){var y0=Math.max(70,top-14),sag=Math.min(22,W*.05),n=Math.max(7,Math.round(W/46)),cols=["#78bcc4","#d593b0","#a693c7","#e7c75f","#8fcfac"];ctx.save();ctx.strokeStyle="#8a6f50";ctx.lineWidth=2;ctx.beginPath();for(var k=0;k<=24;k++){var t=k/24,x=-6+t*(W+12),y=y0+Math.sin(t*Math.PI)*sag;if(k)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();
    for(var f=0;f<n;f++){var t0=(f+.15)/n,t1=(f+.85)/n,x0=-6+t0*(W+12),x1=-6+t1*(W+12),ya=y0+Math.sin(t0*Math.PI)*sag,yb=y0+Math.sin(t1*Math.PI)*sag,size=Math.min(26,W*.06);ctx.fillStyle=cols[f%cols.length];ctx.beginPath();ctx.moveTo(x0,ya);ctx.lineTo(x1,yb);ctx.lineTo((x0+x1)/2,(ya+yb)/2+size);ctx.closePath();ctx.fill();ctx.fillStyle="rgba(255,255,255,.28)";ctx.beginPath();ctx.moveTo(x0+2,ya+1);ctx.lineTo((x0+x1)/2,ya+2);ctx.lineTo((x0+x1)/2,(ya+yb)/2+size*.55);ctx.closePath();ctx.fill();}ctx.restore();}
  // where the birthday buddy sits: left of the tray row, on the worktop, as
  // tall as the room under the scene allows (at least 56 px)
  function sceneFloor(){return Math.max(cakeBox.y+cakeBox.h,bowl.y+bowl.r*1.55+10)+8;}
  // and never wider than the room left of the first tray button
  function buddySpot(){var b=BUDDY_BOX[party?party.buddy:"cat"],bw=b[2]-b[0],bh=b[3]-b[1],foot=trayY+34,room=tray(0).x-36-10-6,size=Math.min(W*.3,Math.max(56,foot-sceneFloor()),room*Math.max(bw,bh)/bw),sc=size/Math.max(bw,bh),dw=bw*sc,dh=bh*sc,cx=6+room/2;
    return{x:cx/W,y:(foot-dh/2)/H,size:size/W,x0:(cx-dw/2)/W,x1:(cx+dw/2)/W,y0:(foot-dh)/H,y1:foot/H};}
  function buddyArt(){if(!party)return;var i=image("buddy-"+party.buddy),b=BUDDY_BOX[party.buddy],spot=buddySpot();if(!i||!b)return;var bw=b[2]-b[0],bh=b[3]-b[1],dw=(spot.x1-spot.x0)*W,dh=(spot.y1-spot.y0)*H,size=spot.size*W,cx=spot.x*W,bottomY=spot.y1*H;
    ctx.save();if(blowAt>=0){var lean=Math.min(1,Math.max(0,(clock-blowAt)*2));ctx.translate(cx,bottomY);ctx.rotate(lean*.12);ctx.translate(-cx,-bottomY);}ctx.fillStyle="rgba(80,55,30,.18)";ctx.beginPath();ctx.ellipse(cx,bottomY-2,dw*.42,dw*.09,0,0,Math.PI*2);ctx.fill();ctx.drawImage(i,b[0],b[1],bw,bh,cx-dw/2,bottomY-dh,dw,dh);
    // a party hat on top: the shop's painted one when it is here, else drawn
    var at=HAT_AT[party.buddy]||[0,0,0],hat=image("hat"),hw=Math.min(dw*.42,size*.4),hx=cx+at[0]*dw,hy=bottomY-dh+hw*.12+at[1]*dh;ctx.translate(hx,hy);ctx.rotate(at[2]);if(hat)ctx.drawImage(hat,-hw/2,-hw,hw,hw);else{ctx.fillStyle="#a693c7";ctx.beginPath();ctx.moveTo(-hw*.32,0);ctx.lineTo(hw*.32,0);ctx.lineTo(0,-hw*.9);ctx.closePath();ctx.fill();}ctx.restore();}
  function glowing(){return active&&ladder()>=1;}
  function pulse(){return .5+.5*Math.sin(clock*4);}
  // a teal dashed arrow (orange is kept for the practice sound's letters)
  function arrow(x0,y0,x1,y1){var dx=x1-x0,dy=y1-y0,len=Math.sqrt(dx*dx+dy*dy);if(len<24)return;var ux=dx/len,uy=dy/len,ex=x1-ux*10,ey=y1-uy*10;ctx.save();ctx.strokeStyle="#2f8f94";ctx.fillStyle="#2f8f94";ctx.lineWidth=5;ctx.lineCap="round";ctx.shadowColor="rgba(255,250,225,.95)";ctx.shadowBlur=8;ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(x0+ux*12,y0+uy*12);ctx.lineTo(ex-ux*8,ey-uy*8);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(ex-ux*12-uy*11,ey-uy*12+ux*11);ctx.lineTo(ex-ux*12+uy*11,ey-uy*12-ux*11);ctx.closePath();ctx.fill();ctx.restore();}
  function bowlArt(){var w=bowl.r*2.95;if(!sprite("bowl",bowl.x,bowl.y,w,w)){var g=ctx.createLinearGradient(0,bowl.y-bowl.r,0,bowl.y+bowl.r);g.addColorStop(0,"#f3ecdd");g.addColorStop(1,"#a0c6c8");ctx.fillStyle=g;ctx.beginPath();ctx.arc(bowl.x,bowl.y,bowl.r*1.4,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e7cf91";ctx.beginPath();ctx.arc(bowl.x,bowl.y,bowl.r*1.10,0,Math.PI*2);ctx.fill();}
    var lvl=ladder();ctx.save();
    if(glowing()){ctx.fillStyle="rgba(255,248,214,"+(.22+.18*pulse())+")";ctx.beginPath();if(lvl>=3){ctx.arc(bowl.x,bowl.y,bowl.r*1.3,0,Math.PI*2);}else{var t=ringTol()*W;ctx.arc(bowl.x,bowl.y,bowl.r+t,0,Math.PI*2);ctx.arc(bowl.x,bowl.y,Math.max(4,bowl.r-t),0,Math.PI*2,true);}ctx.fill();}
    ctx.strokeStyle="rgba(239,250,236,.78)";ctx.lineWidth=glowing()?7:5;if(glowing()){ctx.shadowColor="#fff3b0";ctx.shadowBlur=12;}ctx.setLineDash([5,9]);ctx.beginPath();ctx.arc(bowl.x,bowl.y,bowl.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;ctx.strokeStyle="#bfa46f";ctx.lineWidth=2;for(var n=0;n<3;n++){ctx.beginPath();ctx.arc(bowl.x,bowl.y,bowl.r*(.3+n*.18),stirSweep*.13,stirSweep*.13+Math.PI*1.7);ctx.stroke();}ctx.restore();
    // an arrow round the ring, starting where the spoon is
    if(active&&lvl>=2){var a=Math.atan2((tool.y*H-bowl.y),(tool.x*W-bowl.x)),r=bowl.r;ctx.save();ctx.strokeStyle="#2f8f94";ctx.fillStyle="#2f8f94";ctx.lineWidth=5;ctx.lineCap="round";ctx.shadowColor="rgba(255,250,225,.95)";ctx.shadowBlur=8;ctx.beginPath();ctx.arc(bowl.x,bowl.y,r,a+.25,a+1.9);ctx.stroke();var e=a+2.05,hx=bowl.x+Math.cos(e)*r,hy=bowl.y+Math.sin(e)*r,tx=-Math.sin(e),ty=Math.cos(e);ctx.beginPath();ctx.moveTo(hx+tx*8,hy+ty*8);ctx.lineTo(hx-tx*8+Math.cos(e)*10,hy-ty*8+Math.sin(e)*10);ctx.lineTo(hx-tx*8-Math.cos(e)*10,hy-ty*8-Math.sin(e)*10);ctx.closePath();ctx.fill();ctx.restore();}
    ctx.fillStyle="#f7f1df";ctx.fillRect(W*.25,bowl.y+bowl.r*1.55,W*.5,7);ctx.fillStyle="#4a9a9e";ctx.fillRect(W*.25,bowl.y+bowl.r*1.55,W*.5*mix,7);
  }
  // a round metal cake tin: a shiny rim, a deeper inside, the batter rising
  function panArt(){var depth=W*.09;ctx.save();var side=ctx.createLinearGradient(pan.x-pan.rx,0,pan.x+pan.rx,0);side.addColorStop(0,"#8d9ea3");side.addColorStop(.35,"#e3eaeb");side.addColorStop(.6,"#b9c6c9");side.addColorStop(1,"#7d8f94");ctx.fillStyle="rgba(70,52,34,.22)";ctx.beginPath();ctx.ellipse(pan.x,pan.y+depth+pan.ry*.35,pan.rx*1.06,pan.ry*.8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=side;ctx.beginPath();ctx.ellipse(pan.x,pan.y+depth,pan.rx,pan.ry,0,0,Math.PI);ctx.lineTo(pan.x-pan.rx,pan.y);ctx.ellipse(pan.x,pan.y,pan.rx,pan.ry,0,Math.PI,0,true);ctx.closePath();ctx.fill();
    ctx.fillStyle="#f1f5f5";ctx.beginPath();ctx.ellipse(pan.x,pan.y,pan.rx,pan.ry,0,0,Math.PI*2);ctx.fill();var inside=ctx.createLinearGradient(0,pan.y-pan.ry,0,pan.y+pan.ry);inside.addColorStop(0,"#6f8186");inside.addColorStop(1,"#a9b8bb");ctx.fillStyle=inside;ctx.beginPath();ctx.ellipse(pan.x,pan.y+2,pan.rx*.9,pan.ry*.78,0,0,Math.PI*2);ctx.fill();
    if(panFill>0){var lvl=pan.y+2+pan.ry*.5*(1-panFill),bat=ctx.createLinearGradient(0,lvl-pan.ry,0,lvl+pan.ry);bat.addColorStop(0,"#f6e1a8");bat.addColorStop(1,"#e2c47f");ctx.fillStyle=bat;ctx.beginPath();ctx.ellipse(pan.x,lvl,pan.rx*(.72+.17*panFill),pan.ry*(.56+.2*panFill),0,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,250,228,.55)";ctx.beginPath();ctx.ellipse(pan.x-pan.rx*.25,lvl-pan.ry*.18,pan.rx*.22,pan.ry*.14,-.1,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle="rgba(255,255,255,.85)";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(pan.x,pan.y,pan.rx-1,pan.ry-1,0,Math.PI*1.05,Math.PI*1.6);ctx.stroke();
    if(active){if(glowing()){ctx.fillStyle="rgba(255,248,214,"+(.25+.2*pulse())+")";ctx.shadowColor="#fff3b0";ctx.shadowBlur=14;ctx.beginPath();ctx.ellipse(pan.x,pan.y,pourCatch()*W,pan.ry+5,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}ctx.strokeStyle="#74aeb1";ctx.setLineDash([4,6]);ctx.lineWidth=glowing()?3:2;ctx.beginPath();ctx.ellipse(pan.x,pan.y,pourCatch()*W,pan.ry+5,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
    if(active&&ladder()>=2&&!held)arrow(tool.x*W,tool.y*H,pan.x,pan.y-W*.12);}
  // a piped rosette in the colour it was piped with (a swirl still being
  // piped takes the bag's colour; a finished one keeps its own): three tiers that rise
  // as the piping goes on, each edged, with a peak and a soft shine
  function swirlArt(p){if(p.progress<=0)return;var col=ICE_COLORS[p.color>=0?p.color:iceColor],R=p.r*W*1.45,x=p.x*W,y=p.y*H;ctx.save();ctx.translate(x,y);ctx.shadowColor="rgba(120,90,60,.22)";ctx.shadowBlur=4;ctx.shadowOffsetY=2;
    for(var k=0;k<3;k++){var grow=Math.max(0,Math.min(1,p.progress*3-k));if(grow<=0)break;var r=R*(1-k*.27)*(.55+.45*grow),lift=-R*.34*k;ctx.fillStyle=col.fill;ctx.beginPath();ctx.ellipse(0,lift,r,r*.55,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=col.line;ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(0,lift+r*.06,r*.92,r*.46,0,Math.PI*.05,Math.PI*.95);ctx.stroke();}
    if(p.progress>=1){ctx.fillStyle=col.fill;ctx.beginPath();ctx.moveTo(-R*.2,-R*.62);ctx.quadraticCurveTo(0,-R*1.15,R*.2,-R*.62);ctx.closePath();ctx.fill();}
    ctx.fillStyle="rgba(255,255,255,.55)";ctx.beginPath();ctx.ellipse(-R*.28,-R*.3*Math.min(1,p.progress*1.5),R*.18,R*.08,-.3,0,Math.PI*2);ctx.fill();ctx.restore();}
  function baseCake(){var i=image("base");if(i)ctx.drawImage(i,cakeBox.x,cakeBox.y,cakeBox.w,cakeBox.h);else{var y=cakeTop.y,rx=cakeTop.rx,ry=cakeTop.ry,h=W*.22,g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,"#e6c38b");g.addColorStop(1,"#bc8c53");ctx.fillStyle="#e9e5db";ctx.beginPath();ctx.ellipse(cakeTop.x,y+h+8,rx*1.13,ry*1.08,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=g;ctx.fillRect(cakeTop.x-rx,y,rx*2,h);ctx.beginPath();ctx.ellipse(cakeTop.x,y+h,rx,ry,0,0,Math.PI);ctx.fill();ctx.fillStyle="#f1d6a2";ctx.beginPath();ctx.ellipse(cakeTop.x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
    icing.forEach(swirlArt);
    if(stage===2){var glow=glowing();icing.forEach(function(p){if(p.progress>=1)return;ctx.save();if(glow){ctx.fillStyle="rgba(255,248,214,"+(.3+.25*pulse())+")";ctx.shadowColor="#fff3b0";ctx.shadowBlur=12;ctx.beginPath();ctx.ellipse(p.x*W,p.y*H,p.r*W+8,p.r*W*.7+8,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}ctx.strokeStyle="#77aeb3";ctx.lineWidth=glow?3:2;ctx.setLineDash([3,5]);ctx.beginPath();ctx.ellipse(p.x*W,p.y*H,p.r*W+4,p.r*W*.7+4,0,0,Math.PI*2);ctx.stroke();ctx.restore();});
      if(active&&ladder()>=2&&ladder()<3){var z=nearestSwirl(tool);if(z)arrow(tool.x*W,tool.y*H,z.x*W,z.y*H);}}
    fruits.forEach(function(f){var p=fruitWorld(f);fruitArt(p.type,p.x*W,p.y*H,p.r*W,f.angle);});
  }
  function fruitArt(type,x,y,r,angle){ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);if(!sprite(type,0,0,r*2.25,r*2.3)){ctx.fillStyle=type==="kiwi"?"#9cb35d":type==="grapes"?"#9d83ab":"#ce7774";ctx.beginPath();ctx.ellipse(0,0,r*.85,r,0,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function candleArt(index,x,y,lit,heat){var w=W*.025,h=W*.15;ctx.save();ctx.fillStyle=COLORS[index%COLORS.length];ctx.fillRect(x-w/2,y-h/2,w,h);ctx.strokeStyle="#fff3db";ctx.lineWidth=2;for(var n=0;n<4;n++){ctx.beginPath();ctx.moveTo(x-w/2,y-h/2+n*h/4);ctx.lineTo(x+w/2,y-h/2+n*h/4+w);ctx.stroke();}ctx.strokeStyle="#6e6254";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y-h/2);ctx.lineTo(x,y-h/2-5);ctx.stroke();if(lit&&heat>0){var r=W*.026*(.6+heat*.4)*(glowing()?1.3:1);ctx.shadowColor="#f1d48b";ctx.shadowBlur=glowing()?22:12;ctx.fillStyle="#e9bf71";ctx.beginPath();ctx.moveTo(x,y-h/2-r*2);ctx.bezierCurveTo(x-r,y-h/2-r,x-r*.7,y-h/2,x,y-h/2);ctx.bezierCurveTo(x+r*.7,y-h/2,x+r,y-h/2-r,x,y-h/2-r*2);ctx.fill();ctx.fillStyle="#fff5c4";ctx.beginPath();ctx.ellipse(x,y-h/2-r*.6,r*.32,r*.55,0,0,Math.PI*2);ctx.fill();}ctx.restore();}
  // an empty candle shape: it really glows (the banner says "glowing")
  function candleGhost(x,y){var w=W*.034,h=W*.16;ctx.save();ctx.globalAlpha=.4+.3*pulse();ctx.shadowColor="#fff1b0";ctx.shadowBlur=glowing()?22:14;ctx.fillStyle="#fff6d6";ctx.fillRect(x-w/2,y-h/2,w,h);ctx.shadowBlur=0;ctx.strokeStyle="#2f8f94";ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.strokeRect(x-w/2,y-h/2,w,h);ctx.restore();}
  function decorations(){var m=mode();if(m==="fruit"){ctx.save();if(glowing()){ctx.fillStyle="rgba(255,248,214,"+(.2+.2*pulse())+")";ctx.shadowColor="#fff3b0";ctx.shadowBlur=16;ctx.beginPath();ctx.ellipse(cakeTop.x,cakeTop.y,cakeTop.rx*.93,cakeTop.ry*.93,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}ctx.strokeStyle="rgba(87,158,161,.65)";ctx.lineWidth=glowing()?3:2;ctx.setLineDash([4,7]);ctx.beginPath();ctx.ellipse(cakeTop.x,cakeTop.y,cakeTop.rx*.93,cakeTop.ry*.93,0,0,Math.PI*2);ctx.stroke();ctx.restore();FRUITS.forEach(function(type,n){var p=tray(n);ctx.fillStyle="rgba(255,249,236,.92)";ctx.beginPath();ctx.ellipse(p.x,p.y,37,34,0,0,Math.PI*2);ctx.fill();fruitArt(type,p.x,p.y,23);});
      if(active&&ladder()>=2&&!draft){var to=freeSpot(0,0),p0=tray(selectedFruit);if(to){var at=scenePoint(to.u,to.v);arrow(p0.x,p0.y-38,at.x*W,at.y*H);}}}
    // a candle on the cake is lit the moment it is placed; the box holds
    // the rest, the next one on top in its own colour
    if(stage===4){candles.forEach(function(c){if(c.placed)candleArt(c.color,c.x*W,c.y*H,true,c.heat);else candleGhost(c.x*W,c.y*H);});var left=candles.length-placedCandles-(draft&&draft.kind==="candle"?1:0);if(m==="candles"&&left>0){var b=candleBox();ctx.fillStyle="rgba(255,249,236,.92)";ctx.beginPath();ctx.ellipse(b.x,b.y,40,38,0,0,Math.PI*2);ctx.fill();for(var k=Math.min(left,3)-1;k>=0;k--){var col=(placedCandles+(draft?1:0)+k)%COLORS.length;candleArt(col,b.x-12+k*12,b.y+k*2,false,1);}
        if(active&&ladder()>=2&&!draft){var ct=nearestShape({x:b.x/W,y:b.y/H});if(ct)arrow(b.x,b.y-40,ct.x*W,ct.y*H+W*.05);}}}
    if(draft){if(draft.kind==="fruit")fruitArt(draft.type,draft.x*W,draft.y*H,fruitRadius()*W);else candleArt(draft.index%COLORS.length,draft.x*W,draft.y*H,false,1);}
  }
  // three pots of icing on the tray: a tap fills the bag with that colour
  function potsArt(){if(!party||mode()!=="ice")return;party.ice.forEach(function(c,n){var p=tray(n),col=ICE_COLORS[c],on=c===iceColor;ctx.save();if(on){ctx.strokeStyle="#2f8f94";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p.x,p.y,36,33,0,0,Math.PI*2);ctx.stroke();}ctx.fillStyle="rgba(255,249,236,.94)";ctx.beginPath();ctx.ellipse(p.x,p.y,31,28,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#e9e1cf";ctx.beginPath();ctx.ellipse(p.x,p.y+6,22,13,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=col.fill;ctx.beginPath();ctx.ellipse(p.x,p.y+1,19,9,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y-2,11,Math.PI,0);ctx.fill();ctx.beginPath();ctx.moveTo(p.x-4,p.y-11);ctx.quadraticCurveTo(p.x,p.y-22,p.x+4,p.y-11);ctx.fill();ctx.strokeStyle=col.line;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(p.x,p.y-1,8,Math.PI*1.1,Math.PI*1.9);ctx.stroke();ctx.restore();});}
  function smokeArt(){smoke.forEach(function(k){var t=k.age/k.life;if(t>=1)return;ctx.save();ctx.globalAlpha=(1-t)*.7;ctx.fillStyle="#f4f1ea";ctx.beginPath();ctx.arc(k.x*W,k.y*H,k.r*(1+t*1.6),0,Math.PI*2);ctx.fill();ctx.restore();});}
  function toolArt(){var m=mode(),x=tool.x*W,y=tool.y*H;if(m==="stir"){if(!sprite("spoon",x,y,W*.32,W*.32,.18,.22)){ctx.strokeStyle="#aa895c";ctx.lineWidth=9;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+W*.17,y-W*.18);ctx.stroke();ctx.fillStyle="#c9aa75";ctx.beginPath();ctx.ellipse(x,y,9,14,-.6,0,Math.PI*2);ctx.fill();}}
    else if(m==="pour"){ctx.save();ctx.translate(x,y);ctx.rotate(held?.24:0);if(!sprite("jug",0,0,W*.28,W*.28,.985,.128)){ctx.fillStyle="#c7d8cf";ctx.fillRect(-W*.19,-W*.04,W*.17,W*.16);ctx.fillStyle="#e2d6b9";ctx.beginPath();ctx.moveTo(-W*.19,-W*.04);ctx.lineTo(0,0);ctx.lineTo(-W*.02,W*.025);ctx.lineTo(-W*.19,W*.02);ctx.closePath();ctx.fill();}ctx.restore();}
    else if(m==="ice"){var dab=ICE_COLORS[iceColor];if(!sprite("bag",x,y,W*.3,W*.34,.031,.967)){ctx.fillStyle="#d3e6df";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+W*.05,y-W*.23);ctx.lineTo(x+W*.22,y-W*.16);ctx.closePath();ctx.fill();ctx.fillStyle="#9babad";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+W*.05,y-W*.04);ctx.lineTo(x+W*.01,y-W*.06);ctx.closePath();ctx.fill();}ctx.fillStyle=dab.fill;ctx.strokeStyle=dab.line;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.stroke();if(active){ctx.strokeStyle=dab.line;ctx.globalAlpha=.75;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,icingTip()*W,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}}
  }
  function sparkArt(){sparks.forEach(function(s){var t=s.age/s.life;if(t>=1)return;ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle=s.c;ctx.translate(s.x*W,s.y*H);ctx.rotate(s.age*3);ctx.beginPath();for(var k=0;k<10;k++){var r=k%2?s.r*.45:s.r,a=k*Math.PI/5;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.restore();});}
  function draw(){if(!ctx)return;ctx.clearRect(0,0,W,H);background();buddyArt();if(stage===0)bowlArt();else if(stage===1){panArt();if(panFill>=1){ctx.save();ctx.globalAlpha=1-bake/.9;baseCake();ctx.restore();}}else baseCake();particles.forEach(function(p){ctx.fillStyle="#e8cc91";ctx.beginPath();ctx.ellipse(p.x*W,p.y*W,p.r*W,p.r*W*1.3,0,0,Math.PI*2);ctx.fill();});if(stage>=3)decorations();potsArt();toolArt();smokeArt();sparkArt();}
  function point(e){var r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)/W,y:(e.clientY-r.top)/H};}
  function resetStir(){stirPrev=null;stirSweep=0;stirCredit=0;stirQuads=[false,false,false,false];}
  // a spoon point counts on the ring (wider with the ladder), and from the
  // top of the ladder anywhere over the batter, going round
  function ringPoint(p){var dx=p.x-bowl.x/W,dy=(p.y*H-bowl.y)/W,r=Math.sqrt(dx*dx+dy*dy),R=bowl.r/W;return{angle:Math.atan2(dy,dx),valid:ladder()>=3?r>=R*.2&&r<=R*1.35:Math.abs(r-R)<=ringTol()};}
  function ringSegment(a,b){var steps=Math.max(1,Math.ceil(distance(a,b)*W/7));for(var n=0;n<=steps;n++){var p={x:a.x+(b.x-a.x)*n/steps,y:a.y+(b.y-a.y)*n/steps};if(!ringPoint(p).valid)return false;}return true;}
  function quad(angle){return Math.min(3,Math.floor((angle+Math.PI)/(Math.PI/2)));}
  // A slip off the ring only lets go of the spoon's place on it: the next
  // point on the ring picks up from there, and no stirring already done is
  // lost (it used to start the turn again, with no word on screen).
  function stir(a,b){var p=ringPoint(b);if(!p.valid||!ringSegment(a,b)){if(stirPrev!==null)checkLevel(true);stirPrev=null;if(!p.valid&&ladder()===0)banner(HINTS.stir[0]);return;}if(stirPrev===null){stirPrev=p.angle;stirQuads[quad(p.angle)]=true;return;}var d=p.angle-stirPrev;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;stirSweep+=d;stirPrev=p.angle;stirQuads[quad(p.angle)]=true;if(ladder()>=2||stirQuads.every(function(v){return v;})){var wanted=Math.abs(stirSweep),amount=Math.max(0,wanted-stirCredit);if(amount>0){mix=Math.min(1,mix+amount*stirGain()/(Math.PI*3));lastGain=clock;}stirCredit=Math.max(stirCredit,wanted);if(mix>=1)complete();}}
  function moveTool(p){if(!canPlay())return;var old={x:tool.x,y:tool.y},maxY=(bottom-25)/H;if(stage===1)maxY=Math.min(maxY,maxPourY());tool.x=clamp(p.x,.07,.93);tool.y=clamp(p.y,(top+25)/H,maxY);if(held&&(Math.abs(tool.x-old.x)+Math.abs(tool.y-old.y))>.002)lastWork=clock;if(held&&stage===0)stir(old,tool);hud();draw();}
  function beginTool(){held=true;emission=0;if(stage===0){resetStir();var p=ringPoint(tool);if(p.valid){stirPrev=p.angle;stirQuads[quad(p.angle)]=true;}}}
  function down(e){if(!canPlay()||owner!==null||held||draft||e.button!==undefined&&e.button!==0)return;var m=mode(),p=point(e);if(m!=="stir"&&m!=="pour"&&m!=="ice")return;
    if(m==="pour"){
      // the jug is picked up where it is touched and keeps that hold, so it
      // never jumps under the finger; from the arrow on, a touch anywhere does
      if(e.currentTarget===cv&&!jugHit(p)&&ladder()<2){e.preventDefault();if(clock-lastTap>.6){lastTap=clock;effort+=1;}banner(SAY.jug);checkLevel();hud();return;}
      e.preventDefault();grab={x:p.x-tool.x,y:p.y-tool.y};
    }else{e.preventDefault();if(e.currentTarget===cv){tool={x:p.x,y:p.y};grab={x:0,y:0};}else grab={x:p.x-tool.x,y:p.y-tool.y};}
    owner=e.pointerId;surface=e.currentTarget;beginTool();try{surface.setPointerCapture(owner);}catch(err){}hud();}
  function move(e){if(e.pointerId!==owner||!canPlay())return;e.preventDefault();var p=point(e);if(draft){draft.x=clamp(p.x-grab.x,.06,.94);draft.y=clamp(p.y-grab.y,(top+20)/H,(bottom-20)/H);hud();draw();}else moveTool({x:p.x-grab.x,y:p.y-grab.y});}
  function detach(){var id=owner,s=surface;owner=null;surface=null;held=false;keyHeld=false;if(id!==null&&s)try{if(s.hasPointerCapture(id))s.releasePointerCapture(id);}catch(e){}}
  function stopGesture(cancelDraft){detach();resetStir();emission=0;particles=[];if(cancelDraft)draft=null;}
  // the free spot on the cake top nearest (u,v), or null
  function freeSpot(u0,v0){var best=null,bd=1e9;for(var u=-.8;u<=.81;u+=.16)for(var v=-.8;v<=.81;v+=.2){if(u*u+v*v>.62)continue;var at=scenePoint(u,v);if(fruits.some(function(f){return distance(at,fruitWorld(f))<.085;}))continue;var d=(u-u0)*(u-u0)+(v-v0)*(v-v0);if(d<bd){bd=d;best={u:u,v:v};}}return best;}
  function nearestShape(p){var best=null,bd=1e9;candles.forEach(function(c,j){if(c.placed)return;var d=distance(p,c);if(d<bd){bd=d;best={x:c.x,y:c.y,j:j,d:d};}});return best;}
  function nearestSwirl(p){var best=null,bd=1e9;icing.forEach(function(z){if(z.progress>=1)return;var d=distance(p,z);if(d<bd){bd=d;best=z;}});return best;}
  function placeFruit(d,u,v){fruits.push({type:d.type,u:u,v:v,angle:Math.sin(fruits.length*2.4)*.22});api.sfx("tap");if(fruits.length>=fruitGoal)complete();}
  function dropDraft(){var d=draft;draft=null;if(!d)return;var moved=distance(d,d.from)>.05,lvl=ladder(),anywhere=lvl>=3&&moved&&d.y*H<trayY-30;
    if(d.kind==="fruit"){var dx=d.x*W-cakeTop.x,dy=d.y*H-cakeTop.y,rx=cakeTop.rx-fruitRadius()*W*.6,ry=Math.max(W*.025,cakeTop.ry-fruitRadius()*W*.2),q=Math.sqrt(dx*dx/(rx*rx)+dy*dy/(ry*ry));
      if(anywhere){var s=freeSpot(clamp(dx/cakeTop.rx,-.8,.8),clamp(dy/cakeTop.ry,-.8,.8));if(s){placeFruit(d,s.u,s.v);return;}}
      if(q>1){var bx=dx/q,by=dy/q;if(Math.sqrt(Math.pow(dx-bx,2)+Math.pow(dy-by,2))>decorMagnet()*W){if(moved)miss();else banner(SAY.fruitTap);return;}dx=bx*.98;dy=by*.98;}
      var at={x:(cakeTop.x+dx)/W,y:(cakeTop.y+dy)/H},u=dx/cakeTop.rx,v=dy/cakeTop.ry;
      if(fruits.some(function(f){return distance(at,fruitWorld(f))<.085;})){var near=lvl>=2?freeSpot(u,v):null;if(near){placeFruit(d,near.u,near.v);return;}misses++;shownLevel=ladder();banner(SAY.room);return;}
      placeFruit(d,u,v);return;}
    var c=nearestShape(d);
    if(c&&(c.d<=candleMagnet()||anywhere)){var t=candles[c.j];t.placed=true;t.color=d.index%COLORS.length;t.heat=1;placedCandles++;api.sfx("tap");if(placedCandles>=candles.length)complete();}
    else if(moved)miss();else banner(SAY.candleTap);}
  function release(e){if(e.pointerId!==owner)return;e.preventDefault();if(e.type!=="pointerup"||!canPlay()){stopGesture(true);hud();draw();return;}if(draft){detach();dropDraft();}else{detach();resetStir();emission=0;}hud();draw();}
  // a fruit comes from its own tray spot; a candle from the box, the next
  // one (index: how many are already on, so each has its own colour)
  function newDraft(kind,index){var p=kind==="candle"?candleBox():tray(index),i=kind==="candle"?placedCandles:index;draft={kind:kind,index:i,type:FRUITS[i]||"",x:p.x/W,y:p.y/H,from:{x:p.x/W,y:p.y/H}};if(kind==="fruit")selectedFruit=index;}
  function trayDown(e,kind,index){if(!canPlay()||owner!==null||held||draft||e.button!==undefined&&e.button!==0)return;if(kind==="candle"&&placedCandles>=candles.length)return;e.preventDefault();var mouse=point(e);newDraft(kind,index);grab={x:mouse.x-draft.x,y:mouse.y-draft.y};owner=e.pointerId;surface=e.currentTarget;try{surface.setPointerCapture(owner);}catch(err){}hud();draw();}
  function toolKey(e){if(!canPlay()||owner!==null||draft)return;var key=e.key;if(key===" "||key==="Enter"){e.preventDefault();if(e.repeat)return;if(held){detach();resetStir();emission=0;}else{keyHeld=true;beginTool();}hud();draw();return;}if(key==="Escape"){e.preventDefault();stopGesture(true);hud();draw();return;}var step=e.shiftKey?.012:.04,dx=0,dy=0;if(key==="ArrowLeft")dx=-step;else if(key==="ArrowRight")dx=step;else if(key==="ArrowUp")dy=-step*W/H;else if(key==="ArrowDown")dy=step*W/H;else return;e.preventDefault();moveTool({x:tool.x+dx,y:tool.y+dy});}
  // is the piece in hand this button's? (any candle is the candle box's)
  function mine(kind,index){return!!draft&&draft.kind===kind&&(kind==="candle"||draft.index===index);}
  function trayKey(e,kind,index){if(!canPlay()||owner!==null||held)return;var key=e.key;if(key===" "||key==="Enter"){e.preventDefault();if(e.repeat)return;if(draft){if(mine(kind,index))dropDraft();}else if(kind!=="candle"||placedCandles<candles.length)newDraft(kind,index);hud();draw();return;}if(key==="Escape"){e.preventDefault();draft=null;hud();draw();return;}if(!mine(kind,index))return;var step=e.shiftKey?.015:.055,dx=0,dy=0;if(key==="ArrowLeft")dx=-step;else if(key==="ArrowRight")dx=step;else if(key==="ArrowUp")dy=-step*W/H;else if(key==="ArrowDown")dy=step*W/H;else return;e.preventDefault();draft.x=clamp(draft.x+dx,.06,.94);draft.y=clamp(draft.y+dy,(top+20)/H,(bottom-20)/H);hud();draw();}
  function controls(){[cv,$("cakeTool")].forEach(function(b){b.addEventListener("pointerdown",down);b.addEventListener("pointermove",move);["pointerup","pointercancel","lostpointercapture"].forEach(function(n){b.addEventListener(n,release);});});function grip(b,kind,index){b.addEventListener("pointerdown",function(e){trayDown(e,kind,index);});b.addEventListener("pointermove",move);["pointerup","pointercancel","lostpointercapture"].forEach(function(name){b.addEventListener(name,release);});b.addEventListener("keydown",function(e){trayKey(e,kind,index);});}
    for(var n=0;n<3;n++){grip($("cakeFruit"+n),"fruit",n);(function(index){var pot=$("cakeIce"+index);if(pot)pot.addEventListener("click",function(){if(!canPlay()||held||!party)return;iceColor=party.ice[index];api.sfx("tap");hud();draw();});})(n);}grip($("cakeCandles"),"candle",0);
    $("cakeTool").addEventListener("keydown",toolKey);$("cakeTool").addEventListener("keyup",function(e){if(e.key===" "||e.key==="Enter")e.preventDefault();});$("cakeHelp").onclick=function(){if(canPlay()&&!held&&!draft){var was=$("cakeBanner").textContent;banner(SAY.ask);if(!api.practice())banner(was);}};$("cakeHearStep").onclick=function(){if(canPlay()&&!held&&!draft)api.instruct(STEP_LINES[stage]);};window.addEventListener("resize",fit);window.addEventListener("blur",function(){stopGesture(true);hud();});document.addEventListener("visibilitychange",function(){if(document.hidden)pause();});window.addEventListener("pagehide",function(){away=true;pause();cancelAnimationFrame(raf);raf=0;});window.addEventListener("pageshow",function(){away=false;if(!raf){last=0;raf=requestAnimationFrame(frame);}hud();});}
  // one candle shape for each year of the birthday buddy's age (3, 4 or 5),
  // spread across the back of the cake first, then the rest of the grid,
  // clear of the child's fruit
  function chooseCandles(){var want=party?party.age:3,back=want===3?[-.5,0,.5]:want===4?[-.54,-.18,.18,.54]:[-.6,-.3,0,.3,.6];candleAnchors=[];var prefer=back.map(function(u){return{u:u,v:-.55};}),xs=[-.65,-.35,0,.35,.65],ys=[-.55,.05,.5];for(var row=0;row<ys.length;row++)for(var col=0;col<xs.length;col++)prefer.push({u:xs[col],v:ys[row]});
    prefer.forEach(function(a){if(candleAnchors.length>=want)return;var u=a.u,v=a.v,p=scenePoint(u,v);if(u*u+v*v>.85||fruits.some(function(f){return distance(p,fruitWorld(f))<.061;})||candleAnchors.some(function(c){return distance(p,scenePoint(c.u,c.v))<.085;}))return;candleAnchors.push({u:u,v:v});});
    for(var n=candleAnchors.length;n<want;n++)candleAnchors.push({u:-.6+n*1.2/Math.max(1,want-1),v:-.72});candles=[];placedCandles=0;layout();}
  function burst(){var c=stage===0?{x:bowl.x,y:bowl.y}:stage===1?{x:pan.x,y:pan.y}:{x:cakeTop.x,y:cakeTop.y},cols=["#fff3b0","#78bcc4","#d593b0","#f6e7c1"];for(var n=0;n<16;n++){var a=n/16*Math.PI*2;sparks.push({x:c.x/W,y:c.y/H,vx:Math.cos(a)*.35,vy:Math.sin(a)*.35*W/H-.1,r:5+(n%3)*2,c:cols[n%4],age:0,life:1});}}
  // The step is cooked: the chime and a little burst now, the step itself
  // after the celebration beat. Only once a step.
  function complete(){if(doneAt||doneFor===stage)return;completed=stage+1;active=false;if(stage===1)bake=.9;stopGesture(true);api.sfx("correct");try{api.face("cheer");}catch(e){}burst();banner(stage===4?SAY.party:SAY.yum);doneFor=stage;doneAt=clock+BEAT;hud();draw();}
  function beat(){if(doneAt&&live()&&clock>=doneAt){doneAt=0;dones++;hud();if(api)api.done();}}
  function tick(dt){
    if(live()){clock+=dt;for(var s=sparks.length-1;s>=0;s--){var k=sparks[s];k.age+=dt;k.x+=k.vx*dt;k.y+=k.vy*dt;k.vy+=.25*dt;if(k.age>=k.life)sparks.splice(s,1);}}
    beat();
    if(live()){for(var q=smoke.length-1;q>=0;q--){var m2=smoke[q];m2.age+=dt;m2.y-=.05*dt;m2.x+=m2.vx*dt;if(m2.age>=m2.life)smoke.splice(q,1);}if(won&&blowAt>=0){blow();snapshot();}}
    if(!canPlay())return;power=Math.max(0,power-dt);var lvl=ladder();
    // effort: seconds of finger work that got nowhere (never waiting)
    if(held&&stage===0&&clock-lastWork<.3&&clock-lastGain>.4)effort+=dt;
    if(held&&stage===1&&!(Math.abs(tool.x-pan.x/W)<=pourCatch()))effort+=dt;
    if(stage===1&&held){emission+=dt;while(emission>=1/22){emission-=1/22;particles.push({x:tool.x,y:tool.y*H/W,vy:.08,r:.008,age:0});spawned++;}}
    for(var n=particles.length-1;n>=0;n--){var p=particles[n],old=p.y;if(lvl>=3)p.x+=(pan.x/W-p.x)*Math.min(1,dt*6);p.y+=p.vy*dt+.8*dt*dt/2;p.vy+=.8*dt;p.age+=dt;if(old<pan.y/W&&p.y>=pan.y/W){if(Math.abs(p.x-pan.x/W)<=pourCatch()){panFill=Math.min(1,panFill+.05);impacts++;}else missed++;particles.splice(n,1);if(panFill>=1){complete();return;}}else if(p.y*W>H+20||p.age>2){particles.splice(n,1);missed++;}}
    if(stage===2&&held){icedNow=false;var rate=icingRate(),z;if(lvl>=3&&tool.x*W>=cakeBox.x-30&&tool.x*W<=cakeBox.x+cakeBox.w+30&&tool.y*H>=cakeBox.y-60&&tool.y*H<=cakeBox.y+cakeBox.h+30){z=nearestSwirl(tool);if(z){z.color=iceColor;z.progress=Math.min(1,z.progress+dt*rate);icedNow=true;}}else icing.forEach(function(q){if(q.progress<1&&distance(tool,q)<=icingTip()+q.r*.6){q.color=iceColor;q.progress=Math.min(1,q.progress+dt*rate);icedNow=true;}});if(!icedNow)effort+=dt;if(icing.every(function(q){return q.progress>=1;})){complete();return;}}
    if(heldStep())checkLevel();hud();}
  function frame(now){var dt=last?Math.min(.045,(now-last)/1000):0;last=now;if(!away&&!document.hidden)bake=Math.max(0,bake-dt);tick(dt);draw();raf=requestAnimationFrame(frame);}
  // the finale: the birthday buddy blows the candles out, one after another
  // from the left, each leaving a little puff of smoke
  function blow(){var t=clock-blowAt;candles.forEach(function(c,n){if(!c.placed||c.heat<=0)return;var at=.7+n*.32;if(t<at)return;c.heat=Math.max(0,1-(t-at)/.22);if(c.heat<=0){var f=flame(c);for(var k=0;k<3;k++)smoke.push({x:f.x+(k-1)*.006,y:f.y-.01,vx:.02*(k-1),r:3+k,age:0,life:1.1});}});}
  function label(){return stage===4?LABELS[4]:LABELS[stage];}
  // the word starts the step (go); only the help word adds the cooking power
  function go(){active=true;paused=false;last=0;banner(label());hud();}
  function earnPower(){power=POWER;go();}
  function pause(){paused=true;last=0;stopGesture(true);hud();}
  function reset(){stopGesture(true);active=false;paused=false;won=false;stage=0;completed=0;power=0;mix=0;panFill=0;bake=0;spawned=0;impacts=0;missed=0;icing=[];fruits=[];candles=[];candleAnchors=[];placedCandles=0;selectedFruit=0;misses=0;effort=0;shownLevel=0;doneAt=0;doneFor=-1;sparks=[];smoke=[];blowAt=-1;newParty();layout();tool={x:(bowl.x+bowl.r)/W,y:bowl.y/H};banner(SAY.start+buddyName(party.buddy)+"!");hud();draw();}
  window.Cake={init:function(a,n){api=a;stages=n||5;cv=$("cakeCanvas");ctx=cv.getContext("2d");loadArt();controls();fit();reset();raf=requestAnimationFrame(frame);},
    onWord:function(index){stopGesture(true);stage=index;misses=0;effort=0;shownLevel=0;doneAt=0;doneFor=-1;if(stage===0)tool={x:(bowl.x+bowl.r)/W,y:bowl.y/H};else if(stage===1)tool={x:.84,y:(pan.y-W*.25)/H};else if(stage===2)tool={x:.18,y:(cakeTop.y+W*.24)/H};else if(stage===4)chooseCandles();go();var kind=mode();if(!told[kind]){told[kind]=true;api.instruct(STEP_LINES[stage]);}},
    onHelp:earnPower,pause:pause,
    // back from a pause or an unanswered help ask: the same move goes on,
    // with what was cooked kept and no power added
    resume:function(playing){paused=playing===false;last=0;if(!paused&&active)banner(label());hud();},
    reset:reset,setLittle:function(on){little=!!on;if(cv)hud();},
    finale:function(){stopGesture(true);active=false;power=0;won=true;doneAt=0;blowAt=clock;banner(SAY.finale);hud();draw();},
    // the page hears whose birthday it is, for the end card
    onParty:function(fn){onParty=fn;if(party&&fn)try{fn({buddy:party.buddy,name:buddyName(party.buddy),age:party.age});}catch(e){}}};
})();
