/* Birthday Cake: circular stirring, falling batter, piping, a child's own
   fruit arrangement, and hand-fanned candles. SayPlay owns all speech.

   Each word said two times starts the next recipe step (and lends ten
   seconds of cooking power); the finger does all the cooking.

   EVERY STEP ENDS (CLAUDE.md, "Every ball ends in a basket"), and the help
   that gets it there never needs speech: the cooking power is a bonus on top.
   This is a game for ages 3-4, so the gentle ladder is the default
   (setLittle(false) gives the ages 5-8 one).
   - The dropped and swiped steps (fruit, candles, the fan) count misses
     (misses, reset by the next word and when the candles are all placed). A
     miss is a real try that did not work: a fruit or candle dragged off the
     tray and let go where it cannot go, a full fan swipe that touched no
     flame. A tap that moved nothing is never a miss, and waiting never is.
       ages 3-4: from the 1st miss the place glows and an arrow points to it
         (catch about 2-3x wider); from the 2nd almost anything works: a fruit
         or candle let go anywhere above the tray flies onto the cake, and
         any sideways swipe blows on every flame.
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
  var STEP_LINES = [
    "Move the spoon all the way around the bowl to stir the batter.",
    "Pick up the jug and hold it over the tin. Keep holding to pour.",
    "Hold the icing bag on each glowing swirl to pipe some icing.",
    "Choose four pieces of fruit. Drag them anywhere on top of your cake.",
    "Drag candles to the shapes. Swipe the fan across the flames."
  ];
  // Every banner line: short (one line on a 320 px phone) and kind. Never
  // "missed", "wrong", "fail", "score", "points" or "correct".
  var LABELS = ["Stir all the way around", "Hold the jug over the tin", "Pipe icing on every swirl", "Pick four fruits for your cake", "Candles first, then the fan"];
  var SAY = { start: "Say the word to bake!", ask: "Say it for cooking help", fan: "Swipe the fan over the flames", jug: "Pick up the jug!", fruitTap: "Drag it to the cake", candleTap: "Drag it to a shape", room: "Nearly! Find a free spot", yum: "Yum! That looks delicious!", party: "Happy birthday to you!", finale: "Make a birthday wish!" };
  var HINTS = {
    stir: ["Keep the spoon on the ring", "Follow the arrow around", "Stir anywhere in the bowl!"],
    pour: ["Hold the jug over the tin", "Follow the arrow to the tin", "Just hold the jug!"],
    ice: ["Hold the bag on a swirl", "Follow the arrow to a swirl", "Hold the bag on the cake!"],
    fruit: ["So close! Try the cake top", "Follow the arrow to the cake", "Drop it near the cake!"],
    candles: ["So close! Try a glowing shape", "Follow the arrow to a shape", "Drop it near the cake!"],
    fan: ["Nearly! Swipe over the flames", "Swipe along the arrow", "Swipe across the cake!"]
  };
  var api,cv,ctx,W=390,H=844,raf=0,last=0,art={},active=false,paused=false,away=false,won=false,stage=0,stages=5,completed=0,power=0;
  var top=120,bottom=750,trayY=690,bowl={x:195,y:380,r:86},pan={x:195,y:400,rx:100,ry:28},cakeTop={x:195,y:370,rx:110,ry:34},cakeBox={x:60,y:330,w:270,h:190},tool={x:.75,y:.45};
  var mix=0,stirSweep=0,stirPrev=null,stirCredit=0,stirQuads=[false,false,false,false],panFill=0,bake=0,particles=[],spawned=0,impacts=0,missed=0,emission=0,icing=[];
  var fruits=[],fruitGoal=4,selectedFruit=0,candles=[],candleAnchors=[],usedCandle=[false,false,false],fanPath=[],fanStrokes=0,fanAssist=null,draft=null,owner=null,surface=null,held=false,keyHeld=false,grab={x:0,y:0};
  // the ladder (see the top of this file); little = a child aged 2 to 4
  var misses=0,effort=0,lastWork=-9,lastGain=-9,lastTap=-9,shownLevel=0,little=true,icedNow=false;
  // clock runs only while the page is live; doneAt is the celebration beat:
  // the step is reported this long after the cooking is finished, so the
  // chime is heard whole and a pause in between holds it (hoops.js too)
  var clock=0,doneAt=0,doneFor=-1,sparks=[],dones=0;
  var POWER=10,BEAT=1.15,RUB=[4,8,12],RUB_LITTLE=[2,4,6],FRUITS=["strawberry","kiwi","grapes"],COLORS=["#78bcc4","#d593b0","#a693c7"],ICE=[[-.63,-.23],[-.12,-.57],[.48,-.37],[.63,.23],[.08,.57],[-.48,.37]];
  var CAKE_ART={aspect:512/357,cx:.5,cy:.296,rx:.48,ry:.196*512/357},$=function(id){return document.getElementById(id);};
  function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
  function live(){return !paused&&!away&&!document.hidden;}
  function canPlay(){return active&&!won&&live();}
  function mode(){return stage===0?"stir":stage===1?"pour":stage===2?"ice":stage===3?"fruit":usedCandle.every(function(u){return u;})?"fan":"candles";}
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
  function fanPower(){return fanAssist?fanAssist.power:power>0;}
  function fanDistance(){return Math.min(fanPower()?.10:.18,[.18,.12,.08,.06][ladder()]);}
  function fanReach(){return Math.max(fanPower()?.10:.06,[.06,.10,.16,.16][ladder()]);}
  function fanStrength(){return fanPower()||ladder()>=2?1:.55;}
  function banner(t){if($("cakeBanner").textContent!==t)$("cakeBanner").textContent=t;}
  function image(name){var i=art[name];return i&&i.complete&&i.naturalWidth?i:null;}
  function loadArt(){[["bg","/assets/crafted/game/pizza-kitchen-v1.webp"],["base","/assets/crafted/game/cake-base-v1.webp"],["bowl","/assets/crafted/game/cake-bowl-v1.webp"],["spoon","/assets/crafted/game/cake-spoon-v1.webp"],["jug","/assets/crafted/game/cake-jug-v1.webp"],["bag","/assets/crafted/game/cake-piping-v1.webp"]].concat(FRUITS.map(function(n){return[n,"/assets/crafted/fruit-"+n+".webp"];})).forEach(function(p){var i=new Image();i.onload=function(){if(p[0]==="base")fit();else draw();};i.src=p[1];art[p[0]]=i;});}
  function tray(index){return{x:W*(.2+index*.3),y:trayY};}
  function distance(a,b){var dx=a.x-b.x,dy=(a.y-b.y)*H/W;return Math.sqrt(dx*dx+dy*dy);}
  function scenePoint(u,v){return{x:(cakeTop.x+u*cakeTop.rx)/W,y:(cakeTop.y+v*cakeTop.ry)/H};}
  function fruitRadius(){return .038;}
  function layout(){
    var room=Math.max(100,bottom-top),i=image("base"),aspect=i?i.naturalWidth/i.naturalHeight:CAKE_ART.aspect,sceneY=top+room*.43;
    trayY=bottom-40;bowl={x:W*.5,y:top+room*.45,r:Math.min(W*.22,room*.23)};pan={x:W*.5,y:sceneY+W*.07,rx:W*.26,ry:W*.075};
    var w=Math.min(W*.72,room*.92*aspect),h=w/aspect;cakeBox={x:W*.5-w*CAKE_ART.cx,y:sceneY-h*CAKE_ART.cy,w:w,h:h};cakeTop={x:W*.5,y:sceneY,rx:w*CAKE_ART.rx,ry:h*CAKE_ART.ry};
    icing=ICE.map(function(p,n){var at=scenePoint(p[0],p[1]);return{x:at.x,y:at.y,r:.032,progress:icing[n]?icing[n].progress:0};});
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
      particles:particles.map(function(p){return{x:p.x,y:p.y*W/H,r:p.r};}),spawned:spawned,impacts:impacts,missed:missed,cakeTop:{x:cakeTop.x/W,y:cakeTop.y/H,rx:cakeTop.rx/W,ry:cakeTop.ry/W},icingZones:icing.map(function(p){return{x:p.x,y:p.y,r:p.r,progress:p.progress};}),fruitTray:trays,fruits:fruits.map(fruitWorld),fruitGoal:fruitGoal,fruitSpacing:.085,selectedFruit:selectedFruit,
      candleTray:COLORS.map(function(color,n){var p=tray(n);return{index:n,x:p.x/W,y:p.y/H,used:usedCandle[n]};}),candleTargets:candles.map(function(c){return{x:c.x,y:c.y,base:{x:c.x,y:c.y+.078*W/H},placed:c.placed,color:c.color,flame:flame(c)};}),fan:{phase:mode()==="fan",requiredDistance:fanDistance(),reach:fanReach(),strength:fanStrength(),strokes:fanStrokes},draft:draft?{kind:draft.kind,index:draft.index,type:draft.type,x:draft.x,y:draft.y}:null,
      stirGain:stirGain(),pourCatch:pourCatch(),icingTip:icingTip(),decorMagnet:decorMagnet(),candleMagnet:candleMagnet(),width:W,height:H,coordinates:"positions normalized to canvas; all radii/physical distances use canvas width. Candle target is the candle's center; base is separately published."};}
  function hud(){if(!cv)return;var allowed=canPlay(),m=mode(),b=$("cakeTool"),visible=m==="stir"||m==="pour"||m==="ice"||m==="fan",gx=tool.x*W,gy=tool.y*H;b.hidden=!visible;b.disabled=!allowed;
    // in the pour step the grip sits on the jug's body, where a child grabs it
    if(m==="pour"){var jr=jugRect();gx+=(jr.x0+jr.x1)/2;gy+=(jr.y0+jr.y1)/2;}
    b.style.left=gx+"px";b.style.top=gy+"px";b.setAttribute("aria-pressed",held?"true":"false");
    for(var n=0;n<3;n++){var p=tray(n),f=$("cakeFruit"+n),c=$("cakeCandle"+n);f.hidden=m!=="fruit";c.hidden=m!=="candles"||usedCandle[n];f.disabled=!allowed||!!draft&&draft.index!==n;c.disabled=!allowed||!!draft&&draft.index!==n;[f,c].forEach(function(button){button.style.left=p.x+"px";button.style.top=p.y+"px";});}
    $("cakeHelp").disabled=!allowed||held||!!draft;$("cakeHearStep").disabled=!allowed||held||!!draft;$("cakePower").hidden=power<=0;$("cakePowerFill").style.width=power/POWER*100+"%";snapshot();}
  function sprite(name,x,y,w,h,anchorX,anchorY){var i=image(name);if(!i)return false;var sc=Math.min(w/i.naturalWidth,h/i.naturalHeight),sw=i.naturalWidth*sc,sh=i.naturalHeight*sc;ctx.drawImage(i,x-sw*(anchorX===undefined?.5:anchorX),y-sh*(anchorY===undefined?.5:anchorY),sw,sh);return true;}
  function background(){var i=image("bg");if(i){var sc=Math.max(W/i.naturalWidth,H/i.naturalHeight),w=i.naturalWidth*sc,h=i.naturalHeight*sc;ctx.drawImage(i,(W-w)/2,(H-h)/2,w,h);}else{var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#eee2ce");g.addColorStop(1,"#d0ae7f");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}}
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
  function panArt(){ctx.save();ctx.fillStyle="#80949a";ctx.beginPath();ctx.ellipse(pan.x,pan.y+W*.09,pan.rx,pan.ry,0,0,Math.PI*2);ctx.fill();ctx.fillRect(pan.x-pan.rx,pan.y,pan.rx*2,W*.09);ctx.fillStyle="#d2dddd";ctx.beginPath();ctx.ellipse(pan.x,pan.y,pan.rx,pan.ry,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=panFill>0?"#e8ce91":"#809398";ctx.beginPath();ctx.ellipse(pan.x,pan.y+3,pan.rx*.87,pan.ry*.76,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,245,195,.5)";ctx.beginPath();ctx.ellipse(pan.x,pan.y+W*.065*(1-panFill),pan.rx*.85,pan.ry*.7,0,0,Math.PI*2);ctx.fill();
    if(active){if(glowing()){ctx.fillStyle="rgba(255,248,214,"+(.25+.2*pulse())+")";ctx.shadowColor="#fff3b0";ctx.shadowBlur=14;ctx.beginPath();ctx.ellipse(pan.x,pan.y,pourCatch()*W,pan.ry+5,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}ctx.strokeStyle="#74aeb1";ctx.setLineDash([4,6]);ctx.lineWidth=glowing()?3:2;ctx.beginPath();ctx.ellipse(pan.x,pan.y,pourCatch()*W,pan.ry+5,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
    if(active&&ladder()>=2&&!held)arrow(tool.x*W,tool.y*H,pan.x,pan.y-W*.12);}
  function baseCake(){var i=image("base");if(i)ctx.drawImage(i,cakeBox.x,cakeBox.y,cakeBox.w,cakeBox.h);else{var y=cakeTop.y,rx=cakeTop.rx,ry=cakeTop.ry,h=W*.22,g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,"#e6c38b");g.addColorStop(1,"#bc8c53");ctx.fillStyle="#e9e5db";ctx.beginPath();ctx.ellipse(cakeTop.x,y+h+8,rx*1.13,ry*1.08,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=g;ctx.fillRect(cakeTop.x-rx,y,rx*2,h);ctx.beginPath();ctx.ellipse(cakeTop.x,y+h,rx,ry,0,0,Math.PI);ctx.fill();ctx.fillStyle="#f1d6a2";ctx.beginPath();ctx.ellipse(cakeTop.x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
    icing.forEach(function(p){if(p.progress<=0)return;ctx.save();ctx.translate(p.x*W,p.y*H);var r=p.r*W*(.35+.65*p.progress);ctx.fillStyle="#fff7e6";ctx.shadowColor="rgba(147,117,85,.2)";ctx.shadowBlur=3;ctx.beginPath();ctx.ellipse(0,-r*.2,r,r*.58,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#dfd8c6";ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(0,-r*.26,r*.65,r*.29,-.2,0,Math.PI*1.7);ctx.stroke();ctx.restore();});
    if(stage===2){var glow=glowing();icing.forEach(function(p){if(p.progress>=1)return;ctx.save();if(glow){ctx.fillStyle="rgba(255,248,214,"+(.3+.25*pulse())+")";ctx.shadowColor="#fff3b0";ctx.shadowBlur=12;ctx.beginPath();ctx.ellipse(p.x*W,p.y*H,p.r*W+8,p.r*W*.7+8,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}ctx.strokeStyle="#77aeb3";ctx.lineWidth=glow?3:2;ctx.setLineDash([3,5]);ctx.beginPath();ctx.ellipse(p.x*W,p.y*H,p.r*W+4,p.r*W*.7+4,0,0,Math.PI*2);ctx.stroke();ctx.restore();});
      if(active&&ladder()>=2&&ladder()<3){var z=nearestSwirl(tool);if(z)arrow(tool.x*W,tool.y*H,z.x*W,z.y*H);}}
    fruits.forEach(function(f){var p=fruitWorld(f);fruitArt(p.type,p.x*W,p.y*H,p.r*W,f.angle);});
  }
  function fruitArt(type,x,y,r,angle){ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);if(!sprite(type,0,0,r*2.25,r*2.3)){ctx.fillStyle=type==="kiwi"?"#9cb35d":type==="grapes"?"#9d83ab":"#ce7774";ctx.beginPath();ctx.ellipse(0,0,r*.85,r,0,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function candleArt(index,x,y,lit,heat){var w=W*.025,h=W*.15;ctx.save();ctx.fillStyle=COLORS[index];ctx.fillRect(x-w/2,y-h/2,w,h);ctx.strokeStyle="#fff3db";ctx.lineWidth=2;for(var n=0;n<4;n++){ctx.beginPath();ctx.moveTo(x-w/2,y-h/2+n*h/4);ctx.lineTo(x+w/2,y-h/2+n*h/4+w);ctx.stroke();}ctx.strokeStyle="#6e6254";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y-h/2);ctx.lineTo(x,y-h/2-5);ctx.stroke();if(lit&&heat>0){var r=W*.026*(.6+heat*.4)*(glowing()?1.3:1);ctx.shadowColor="#f1d48b";ctx.shadowBlur=glowing()?22:12;ctx.fillStyle="#e9bf71";ctx.beginPath();ctx.moveTo(x,y-h/2-r*2);ctx.bezierCurveTo(x-r,y-h/2-r,x-r*.7,y-h/2,x,y-h/2);ctx.bezierCurveTo(x+r*.7,y-h/2,x+r,y-h/2-r,x,y-h/2-r*2);ctx.fill();ctx.fillStyle="#fff5c4";ctx.beginPath();ctx.ellipse(x,y-h/2-r*.6,r*.32,r*.55,0,0,Math.PI*2);ctx.fill();}ctx.restore();}
  // an empty candle shape: it really glows (the banner says "glowing")
  function candleGhost(x,y){var w=W*.034,h=W*.16;ctx.save();ctx.globalAlpha=.4+.3*pulse();ctx.shadowColor="#fff1b0";ctx.shadowBlur=glowing()?22:14;ctx.fillStyle="#fff6d6";ctx.fillRect(x-w/2,y-h/2,w,h);ctx.shadowBlur=0;ctx.strokeStyle="#2f8f94";ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.strokeRect(x-w/2,y-h/2,w,h);ctx.restore();}
  function decorations(){var m=mode();if(m==="fruit"){ctx.save();if(glowing()){ctx.fillStyle="rgba(255,248,214,"+(.2+.2*pulse())+")";ctx.shadowColor="#fff3b0";ctx.shadowBlur=16;ctx.beginPath();ctx.ellipse(cakeTop.x,cakeTop.y,cakeTop.rx*.93,cakeTop.ry*.93,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}ctx.strokeStyle="rgba(87,158,161,.65)";ctx.lineWidth=glowing()?3:2;ctx.setLineDash([4,7]);ctx.beginPath();ctx.ellipse(cakeTop.x,cakeTop.y,cakeTop.rx*.93,cakeTop.ry*.93,0,0,Math.PI*2);ctx.stroke();ctx.restore();FRUITS.forEach(function(type,n){var p=tray(n);ctx.fillStyle="rgba(255,249,236,.92)";ctx.beginPath();ctx.ellipse(p.x,p.y,37,34,0,0,Math.PI*2);ctx.fill();fruitArt(type,p.x,p.y,23);});
      if(active&&ladder()>=2&&!draft){var to=freeSpot(0,0),p0=tray(selectedFruit);if(to){var at=scenePoint(to.u,to.v);arrow(p0.x,p0.y-38,at.x*W,at.y*H);}}}
    if(stage===4){candles.forEach(function(c){if(c.placed)candleArt(c.color,c.x*W,c.y*H,m==="fan",c.heat);else candleGhost(c.x*W,c.y*H);});if(m==="candles"){for(var n=0;n<3;n++){if(usedCandle[n])continue;var p=tray(n);ctx.fillStyle="rgba(255,249,236,.92)";ctx.beginPath();ctx.ellipse(p.x,p.y,35,37,0,0,Math.PI*2);ctx.fill();candleArt(n,p.x,p.y,false,1);}
        if(active&&ladder()>=2&&!draft){var first=usedCandle.indexOf(false),tp=first>=0?tray(first):null,ct=tp?nearestShape({x:tp.x/W,y:tp.y/H}):null;if(ct)arrow(tp.x,tp.y-40,ct.x*W,ct.y*H+W*.05);}}
      if(m==="fan"&&active&&ladder()>=2){var lit=candles.filter(function(c){return c.heat>0;});if(lit.length){var fy=lit.reduce(function(a,c){return a+flame(c).y;},0)/lit.length*H;arrow(cakeTop.x-cakeTop.rx*1.05,fy,cakeTop.x+cakeTop.rx*1.05,fy);}}}
    if(draft){if(draft.kind==="fruit")fruitArt(draft.type,draft.x*W,draft.y*H,fruitRadius()*W);else candleArt(draft.index,draft.x*W,draft.y*H,false,1);}
  }
  function toolArt(){var m=mode(),x=tool.x*W,y=tool.y*H;if(m==="stir"){if(!sprite("spoon",x,y,W*.32,W*.32,.18,.22)){ctx.strokeStyle="#aa895c";ctx.lineWidth=9;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+W*.17,y-W*.18);ctx.stroke();ctx.fillStyle="#c9aa75";ctx.beginPath();ctx.ellipse(x,y,9,14,-.6,0,Math.PI*2);ctx.fill();}}
    else if(m==="pour"){ctx.save();ctx.translate(x,y);ctx.rotate(held?.24:0);if(!sprite("jug",0,0,W*.28,W*.28,.985,.128)){ctx.fillStyle="#c7d8cf";ctx.fillRect(-W*.19,-W*.04,W*.17,W*.16);ctx.fillStyle="#e2d6b9";ctx.beginPath();ctx.moveTo(-W*.19,-W*.04);ctx.lineTo(0,0);ctx.lineTo(-W*.02,W*.025);ctx.lineTo(-W*.19,W*.02);ctx.closePath();ctx.fill();}ctx.restore();}
    else if(m==="ice"){if(!sprite("bag",x,y,W*.3,W*.34,.031,.967)){ctx.fillStyle="#d3e6df";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+W*.05,y-W*.23);ctx.lineTo(x+W*.22,y-W*.16);ctx.closePath();ctx.fill();ctx.fillStyle="#9babad";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+W*.05,y-W*.04);ctx.lineTo(x+W*.01,y-W*.06);ctx.closePath();ctx.fill();}if(active){ctx.strokeStyle="rgba(74,143,150,.5)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,icingTip()*W,0,Math.PI*2);ctx.stroke();}}
    else if(m==="fan"){ctx.save();ctx.translate(x,y);ctx.fillStyle="#88b6b6";ctx.strokeStyle="#f4e3bf";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,12);ctx.arc(0,12,W*.11,-Math.PI*.9,-Math.PI*.1);ctx.closePath();ctx.fill();for(var n=0;n<6;n++){var a=-Math.PI*.9+n*Math.PI*.16;ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(Math.cos(a)*W*.11,12+Math.sin(a)*W*.11);ctx.stroke();}ctx.restore();}
  }
  function sparkArt(){sparks.forEach(function(s){var t=s.age/s.life;if(t>=1)return;ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle=s.c;ctx.translate(s.x*W,s.y*H);ctx.rotate(s.age*3);ctx.beginPath();for(var k=0;k<10;k++){var r=k%2?s.r*.45:s.r,a=k*Math.PI/5;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.restore();});}
  function draw(){if(!ctx)return;ctx.clearRect(0,0,W,H);background();if(stage===0)bowlArt();else if(stage===1){panArt();if(panFill>=1){ctx.save();ctx.globalAlpha=1-bake/.9;baseCake();ctx.restore();}}else baseCake();particles.forEach(function(p){ctx.fillStyle="#e8cc91";ctx.beginPath();ctx.ellipse(p.x*W,p.y*W,p.r*W,p.r*W*1.3,0,0,Math.PI*2);ctx.fill();});if(stage>=3)decorations();toolArt();sparkArt();}
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
  function moveTool(p){if(!canPlay())return;var old={x:tool.x,y:tool.y},maxY=(bottom-25)/H;if(stage===1)maxY=Math.min(maxY,maxPourY());tool.x=clamp(p.x,.07,.93);tool.y=clamp(p.y,(top+25)/H,maxY);if(held&&(Math.abs(tool.x-old.x)+Math.abs(tool.y-old.y))>.002)lastWork=clock;if(held&&stage===0)stir(old,tool);if(held&&mode()==="fan")fanPath.push({x:tool.x,y:tool.y});hud();draw();}
  function beginTool(){held=true;emission=0;if(stage===0){resetStir();var p=ringPoint(tool);if(p.valid){stirPrev=p.angle;stirQuads[quad(p.angle)]=true;}}if(mode()==="fan"){fanPath=[{x:tool.x,y:tool.y}];fanAssist={power:power>0};}}
  function down(e){if(!canPlay()||owner!==null||held||draft||e.button!==undefined&&e.button!==0)return;var m=mode(),p=point(e);if(m!=="stir"&&m!=="pour"&&m!=="ice"&&m!=="fan")return;
    if(m==="pour"){
      // the jug is picked up where it is touched and keeps that hold, so it
      // never jumps under the finger; from the arrow on, a touch anywhere does
      if(e.currentTarget===cv&&!jugHit(p)&&ladder()<2){e.preventDefault();if(clock-lastTap>.6){lastTap=clock;effort+=1;}banner(SAY.jug);checkLevel();hud();return;}
      e.preventDefault();grab={x:p.x-tool.x,y:p.y-tool.y};
    }else{e.preventDefault();if(e.currentTarget===cv){tool={x:p.x,y:p.y};grab={x:0,y:0};}else grab={x:p.x-tool.x,y:p.y-tool.y};}
    owner=e.pointerId;surface=e.currentTarget;beginTool();try{surface.setPointerCapture(owner);}catch(err){}hud();}
  function move(e){if(e.pointerId!==owner||!canPlay())return;e.preventDefault();var p=point(e);if(draft){draft.x=clamp(p.x-grab.x,.06,.94);draft.y=clamp(p.y-grab.y,(top+20)/H,(bottom-20)/H);hud();draw();}else moveTool({x:p.x-grab.x,y:p.y-grab.y});}
  function detach(){var id=owner,s=surface;owner=null;surface=null;held=false;keyHeld=false;if(id!==null&&s)try{if(s.hasPointerCapture(id))s.releasePointerCapture(id);}catch(e){}}
  function stopGesture(cancelDraft){detach();resetStir();emission=0;particles=[];fanPath=[];fanAssist=null;if(cancelDraft)draft=null;}
  function pathNear(target,path){for(var n=1;n<path.length;n++){var a=path[n-1],b=path[n],dx=b.x-a.x,dy=(b.y-a.y)*H/W,len=dx*dx+dy*dy;if(!len||Math.abs(dy)>Math.abs(dx)*1.3)continue;var t=clamp(((target.x-a.x)*dx+(target.y-a.y)*H/W*dy)/len,0,1),p={x:a.x+dx*t,y:a.y+(b.y-a.y)*t};if(distance(p,target)<=fanReach())return true;}return false;}
  function finishFan(){if(fanPath.length<2)return;var runs=[],run=[fanPath[0]],direction=0,hit=false,swiped=false,lvl=ladder(),strength=fanStrength();for(var n=1;n<fanPath.length;n++){var dx=fanPath[n].x-fanPath[n-1].x,next=dx>.0001?1:dx<-.0001?-1:direction;if(direction&&next!==direction){runs.push(run);run=[fanPath[n-1]];}run.push(fanPath[n]);direction=next;}runs.push(run);
    runs.forEach(function(path){var a=path[0],b=path[path.length-1],dx=Math.abs(b.x-a.x),dy=Math.abs((b.y-a.y)*H/W);if(dx>=.05)swiped=true;if(dx<fanDistance()||dy>dx*(lvl>=3?2:1.1))return;var touched=false;candles.forEach(function(c){if(c.heat>0&&(lvl>=3||pathNear(flame(c),path))){c.heat=Math.max(0,c.heat-strength);touched=true;}});if(touched){fanStrokes++;hit=true;}});
    if(hit)api.sfx("tap");else if(swiped)miss();if(candles.every(function(c){return c.heat<=0;}))complete();}
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
    if(c&&(c.d<=candleMagnet()||anywhere)){var t=candles[c.j];t.placed=true;t.color=d.index;usedCandle[d.index]=true;api.sfx("tap");if(mode()==="fan"){misses=0;effort=0;shownLevel=0;tool={x:.23,y:(cakeTop.y+W*.25)/H};banner(SAY.fan);}}
    else if(moved)miss();else banner(SAY.candleTap);}
  function release(e){if(e.pointerId!==owner)return;e.preventDefault();if(e.type!=="pointerup"||!canPlay()){stopGesture(true);hud();draw();return;}var m=mode();if(draft){detach();dropDraft();}else{if(m==="fan")finishFan();detach();resetStir();emission=0;fanPath=[];fanAssist=null;}hud();draw();}
  function newDraft(kind,index){var p=tray(index);draft={kind:kind,index:index,type:FRUITS[index],x:p.x/W,y:p.y/H,from:{x:p.x/W,y:p.y/H}};selectedFruit=index;}
  function trayDown(e,kind,index){if(!canPlay()||owner!==null||held||draft||e.button!==undefined&&e.button!==0)return;if(kind==="candle"&&usedCandle[index])return;e.preventDefault();var mouse=point(e);newDraft(kind,index);grab={x:mouse.x-draft.x,y:mouse.y-draft.y};owner=e.pointerId;surface=e.currentTarget;try{surface.setPointerCapture(owner);}catch(err){}hud();draw();}
  function toolKey(e){if(!canPlay()||owner!==null||draft)return;var key=e.key;if(key===" "||key==="Enter"){e.preventDefault();if(e.repeat)return;if(held){if(mode()==="fan")finishFan();detach();resetStir();fanPath=[];fanAssist=null;emission=0;}else{keyHeld=true;beginTool();}hud();draw();return;}if(key==="Escape"){e.preventDefault();stopGesture(true);hud();draw();return;}var step=e.shiftKey?.012:.04,dx=0,dy=0;if(key==="ArrowLeft")dx=-step;else if(key==="ArrowRight")dx=step;else if(key==="ArrowUp")dy=-step*W/H;else if(key==="ArrowDown")dy=step*W/H;else return;e.preventDefault();moveTool({x:tool.x+dx,y:tool.y+dy});}
  function trayKey(e,kind,index){if(!canPlay()||owner!==null||held)return;var key=e.key;if(key===" "||key==="Enter"){e.preventDefault();if(e.repeat)return;if(draft){if(draft.kind===kind&&draft.index===index)dropDraft();}else newDraft(kind,index);hud();draw();return;}if(key==="Escape"){e.preventDefault();draft=null;hud();draw();return;}if(!draft||draft.kind!==kind||draft.index!==index)return;var step=e.shiftKey?.015:.055,dx=0,dy=0;if(key==="ArrowLeft")dx=-step;else if(key==="ArrowRight")dx=step;else if(key==="ArrowUp")dy=-step*W/H;else if(key==="ArrowDown")dy=step*W/H;else return;e.preventDefault();draft.x=clamp(draft.x+dx,.06,.94);draft.y=clamp(draft.y+dy,(top+20)/H,(bottom-20)/H);hud();draw();}
  function controls(){[cv,$("cakeTool")].forEach(function(b){b.addEventListener("pointerdown",down);b.addEventListener("pointermove",move);["pointerup","pointercancel","lostpointercapture"].forEach(function(n){b.addEventListener(n,release);});});for(var n=0;n<3;n++)(function(index){[["cakeFruit","fruit"],["cakeCandle","candle"]].forEach(function(p){var b=$(p[0]+index);b.addEventListener("pointerdown",function(e){trayDown(e,p[1],index);});b.addEventListener("pointermove",move);["pointerup","pointercancel","lostpointercapture"].forEach(function(name){b.addEventListener(name,release);});b.addEventListener("keydown",function(e){trayKey(e,p[1],index);});});})(n);
    $("cakeTool").addEventListener("keydown",toolKey);$("cakeTool").addEventListener("keyup",function(e){if(e.key===" "||e.key==="Enter")e.preventDefault();});$("cakeHelp").onclick=function(){if(canPlay()&&!held&&!draft&&api.practice())banner(SAY.ask);};$("cakeHearStep").onclick=function(){if(canPlay()&&!held&&!draft)api.instruct(STEP_LINES[stage]);};window.addEventListener("resize",fit);window.addEventListener("blur",function(){stopGesture(true);hud();});document.addEventListener("visibilitychange",function(){if(document.hidden)pause();});window.addEventListener("pagehide",function(){away=true;pause();cancelAnimationFrame(raf);raf=0;});window.addEventListener("pageshow",function(){away=false;if(!raf){last=0;raf=requestAnimationFrame(frame);}hud();});}
  // three candle shapes spread across the back of the cake first, then the
  // rest of the grid, clear of the child's fruit
  function chooseCandles(){candleAnchors=[];var prefer=[{u:-.5,v:-.55},{u:0,v:-.55},{u:.5,v:-.55}],xs=[-.65,-.35,0,.35,.65],ys=[-.55,.05,.5];for(var row=0;row<ys.length;row++)for(var col=0;col<xs.length;col++)prefer.push({u:xs[col],v:ys[row]});
    prefer.forEach(function(a){if(candleAnchors.length>=3)return;var u=a.u,v=a.v,p=scenePoint(u,v);if(u*u+v*v>.85||fruits.some(function(f){return distance(p,fruitWorld(f))<.061;})||candleAnchors.some(function(c){return distance(p,scenePoint(c.u,c.v))<.085;}))return;candleAnchors.push({u:u,v:v});});
    if(candleAnchors.length<3){for(var n=candleAnchors.length;n<3;n++)candleAnchors.push({u:(n-1)*.5,v:-.7});}candles=[];usedCandle=[false,false,false];layout();}
  function burst(){var c=stage===0?{x:bowl.x,y:bowl.y}:stage===1?{x:pan.x,y:pan.y}:{x:cakeTop.x,y:cakeTop.y},cols=["#fff3b0","#78bcc4","#d593b0","#f6e7c1"];for(var n=0;n<16;n++){var a=n/16*Math.PI*2;sparks.push({x:c.x/W,y:c.y/H,vx:Math.cos(a)*.35,vy:Math.sin(a)*.35*W/H-.1,r:5+(n%3)*2,c:cols[n%4],age:0,life:1});}}
  // The step is cooked: the chime and a little burst now, the step itself
  // after the celebration beat. Only once a step.
  function complete(){if(doneAt||doneFor===stage)return;completed=stage+1;active=false;if(stage===1)bake=.9;stopGesture(true);api.sfx("correct");try{api.face("cheer");}catch(e){}burst();banner(stage===4?SAY.party:SAY.yum);doneFor=stage;doneAt=clock+BEAT;hud();draw();}
  function beat(){if(doneAt&&live()&&clock>=doneAt){doneAt=0;dones++;hud();if(api)api.done();}}
  function tick(dt){
    if(live()){clock+=dt;for(var s=sparks.length-1;s>=0;s--){var k=sparks[s];k.age+=dt;k.x+=k.vx*dt;k.y+=k.vy*dt;k.vy+=.25*dt;if(k.age>=k.life)sparks.splice(s,1);}}
    beat();
    if(!canPlay())return;power=Math.max(0,power-dt);var lvl=ladder();
    // effort: seconds of finger work that got nowhere (never waiting)
    if(held&&stage===0&&clock-lastWork<.3&&clock-lastGain>.4)effort+=dt;
    if(held&&stage===1&&!(Math.abs(tool.x-pan.x/W)<=pourCatch()))effort+=dt;
    if(stage===1&&held){emission+=dt;while(emission>=1/22){emission-=1/22;particles.push({x:tool.x,y:tool.y*H/W,vy:.08,r:.008,age:0});spawned++;}}
    for(var n=particles.length-1;n>=0;n--){var p=particles[n],old=p.y;if(lvl>=3)p.x+=(pan.x/W-p.x)*Math.min(1,dt*6);p.y+=p.vy*dt+.8*dt*dt/2;p.vy+=.8*dt;p.age+=dt;if(old<pan.y/W&&p.y>=pan.y/W){if(Math.abs(p.x-pan.x/W)<=pourCatch()){panFill=Math.min(1,panFill+.05);impacts++;}else missed++;particles.splice(n,1);if(panFill>=1){complete();return;}}else if(p.y*W>H+20||p.age>2){particles.splice(n,1);missed++;}}
    if(stage===2&&held){icedNow=false;var rate=icingRate(),z;if(lvl>=3&&tool.x*W>=cakeBox.x-30&&tool.x*W<=cakeBox.x+cakeBox.w+30&&tool.y*H>=cakeBox.y-60&&tool.y*H<=cakeBox.y+cakeBox.h+30){z=nearestSwirl(tool);if(z){z.progress=Math.min(1,z.progress+dt*rate);icedNow=true;}}else icing.forEach(function(q){if(q.progress<1&&distance(tool,q)<=icingTip()+q.r*.6){q.progress=Math.min(1,q.progress+dt*rate);icedNow=true;}});if(!icedNow)effort+=dt;if(icing.every(function(q){return q.progress>=1;})){complete();return;}}
    if(heldStep())checkLevel();hud();}
  function frame(now){var dt=last?Math.min(.045,(now-last)/1000):0;last=now;if(!away&&!document.hidden)bake=Math.max(0,bake-dt);tick(dt);draw();raf=requestAnimationFrame(frame);}
  function label(){return mode()==="fan"?SAY.fan:LABELS[stage];}
  function earnPower(){power=POWER;active=true;paused=false;last=0;banner(label());hud();}
  function pause(){paused=true;last=0;stopGesture(true);hud();}
  function reset(){stopGesture(true);active=false;paused=false;won=false;stage=0;completed=0;power=0;mix=0;panFill=0;bake=0;spawned=0;impacts=0;missed=0;icing=[];fruits=[];candles=[];candleAnchors=[];usedCandle=[false,false,false];fanStrokes=0;selectedFruit=0;misses=0;effort=0;shownLevel=0;doneAt=0;doneFor=-1;sparks=[];layout();tool={x:(bowl.x+bowl.r)/W,y:bowl.y/H};banner(SAY.start);hud();draw();}
  window.Cake={init:function(a,n){api=a;stages=n||5;cv=$("cakeCanvas");ctx=cv.getContext("2d");loadArt();controls();fit();reset();raf=requestAnimationFrame(frame);},
    onWord:function(index){stopGesture(true);stage=index;misses=0;effort=0;shownLevel=0;doneAt=0;doneFor=-1;if(stage===0)tool={x:(bowl.x+bowl.r)/W,y:bowl.y/H};else if(stage===1)tool={x:.84,y:(pan.y-W*.25)/H};else if(stage===2)tool={x:.18,y:(cakeTop.y+W*.24)/H};else if(stage===4)chooseCandles();earnPower();api.instruct(STEP_LINES[stage]);},
    onHelp:earnPower,pause:pause,
    // back from a pause or an unanswered help ask: the same move goes on,
    // with what was cooked kept and no power added
    resume:function(playing){paused=playing===false;last=0;if(!paused&&active)banner(label());hud();},
    reset:reset,setLittle:function(on){little=!!on;if(cv)hud();},
    finale:function(){stopGesture(true);active=false;power=0;won=true;doneAt=0;banner(SAY.finale);hud();draw();}};
})();
