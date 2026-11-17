/* Bedtime Stars: continuous, physically checked constellation strokes.
   The word starts the next picture and nothing else (CLAUDE.md, "The
   audit's rebuilds"): it never widens the path and never draws a line.

   A NEW SKY EVERY ROUND (plan): five of twelve pictures (ALL), easy ones
   first and the biggest last (two of tier 1, two of tier 2, one of tier 3),
   the ones this child has never drawn before the ones they have. Each is a
   surprise: nothing names it until its last line, when it lights up and
   its little details (an eye, whiskers, a door) appear. Every picture ever
   drawn is the child's for good (sona.stars.v1, kept by the page through
   Stars.setup); the start and end cards show them all, the ones still to
   find as faint shapes. Echo says how to draw once a visit.

   EVERY PICTURE ENDS (the Hoops rule, for ages 3-4). The word starts a
   picture; the finger draws it, and the finger alone can always finish it.
   A miss is a real try that did not reach the next star: the finger slid
   off the path, or let go after drawing part of the way. Never idle time.
   ease (per picture, reset by a new word or a finished picture):
     0  the game as designed: a narrow path, a slip starts the line again
     1  after 1 miss, or about 4 s of finger work with no new star: the path
        is twice as wide, glows and pulses, an arrow points to the next star
        and its star rings bright; a slip still starts that one line again
     2  after 2 misses, or about 8 s of finger work: almost anything works.
        Leaving the path no longer starts again; the pen slides along the
        line as far as the finger has gone toward the next star, and three
        quarters of the way lights it. The finger still makes every line:
        nothing is drawn by a timer.
   The help pill (speech) is a bonus on top: the path is whichever is wider. */
(function () {
  "use strict";
  // How to draw, said once a visit (the first picture) and on "Hear what to
  // do". Nothing names a picture before it is drawn: it is a surprise.
  var HOWTO="Start at the glowing star. Slide along the path to draw a line to the next star.";
  // Twelve pictures, by tier (how many lines: 1 is 3-4, 2 is 5, 3 is 6-7).
  // Every point keeps clear of the box's edges, where finished pictures
  // wait in their slots (x from .14, and the box's corners empty).
  var ALL = [
    {name:"tent",label:"a tent",tier:1,points:[[.2,.84],[.5,.16],[.8,.84],[.2,.84]]},
    {name:"flag",label:"a flag",tier:1,points:[[.28,.86],[.28,.14],[.8,.3],[.28,.46]]},
    {name:"kite",label:"a kite",tier:1,points:[[.5,.12],[.84,.46],[.5,.84],[.16,.46],[.5,.12]]},
    {name:"house",label:"a house",tier:2,points:[[.2,.84],[.2,.42],[.5,.14],[.8,.42],[.8,.84],[.2,.84]]},
    {name:"boat",label:"a boat",tier:2,points:[[.5,.14],[.5,.66],[.84,.66],[.7,.86],[.28,.86],[.14,.66]]},
    {name:"rocket",label:"a rocket",tier:2,points:[[.5,.12],[.7,.4],[.7,.8],[.3,.8],[.3,.4],[.5,.12]]},
    {name:"mountain",label:"a mountain",tier:2,points:[[.18,.82],[.4,.3],[.56,.56],[.7,.4],[.82,.82],[.18,.82]]},
    {name:"star",label:"a star",tier:2,points:[[.5,.12],[.72,.82],[.16,.38],[.84,.38],[.28,.82],[.5,.12]]},
    // a real fish (it was a paper dart): a body, then its tail
    {name:"fish",label:"a fish",tier:3,points:[[.18,.3],[.36,.5],[.6,.26],[.86,.5],[.6,.74],[.36,.5],[.18,.7]]},
    {name:"heart",label:"a heart",tier:3,points:[[.5,.84],[.16,.44],[.3,.2],[.5,.34],[.7,.2],[.84,.44],[.5,.84]]},
    {name:"cat",label:"a cat",tier:3,points:[[.22,.84],[.22,.28],[.38,.44],[.62,.44],[.78,.28],[.78,.84],[.22,.84]]},
    {name:"crown",label:"a crown",tier:3,points:[[.18,.76],[.18,.32],[.34,.52],[.5,.26],[.66,.52],[.82,.32],[.82,.76],[.18,.76]]}
  ];
  var ROUND_TIERS=[1,1,2,2,3];
  // this round's five pictures, in order (plan() picks them)
  var pics=[ALL[0],ALL[2],ALL[3],ALL[4],ALL[8]];
  // the child's sky collection (the page keeps it), this round's new ones,
  // whether Echo has said how to draw this visit, and when the picture
  // being drawn was finished (it lights up for the beat)
  var store=null,album={got:[]},fresh=[],told=false,litAt=-9;
  var api,cv,ctx,W=390,H=844,raf=0,last=0,active=false,paused=false,away=false,won=false,stage=0,stages=5,completed=0,power=0;
  var nodes=[],next=1,pen={x:.5,y:.5},paths=[],completedPatterns=[false,false,false,false,false],minis=[],box={x:50,y:220,size:290},top=120,bottom=750,forwardTravel=0,failures=0;
  // the ladder (see the top): misses this picture, finger-work seconds since
  // the last new star, the level, and the celebration countdown on the
  // game's own clock (the next word waits for it; a pause holds it)
  var misses=0,ease=0,tryTime=0,movedAt=-9,clock=0,doneAt=0,calm=false;
  var held=false,owner=null,surface=null,keyHeld=false,grab={x:0,y:0},art={},POWER=10;
  // A SKY FULL OF LITTLE PICTURES. Each picture used to be wiped when the
  // next began, and the end card's "A sky full of little pictures!" sat over
  // a sky holding one. Now a finished picture stays up as a small, fainter
  // constellation in a slot beside the tracing area (slots: upper left,
  // upper right, lower left, lower right, in the side bands and the box's
  // empty corners, where no picture has a star). Each is drawn on its own
  // little canvas with the current picture's path, its glowing corridor and
  // its stars cut out, so a kept picture never overlaps what the finger is
  // tracing. At the finale all five gather across the sky (sky: the open
  // sky's rectangle; skyAt: the clock when they began to gather; keptAt:
  // when the newest one appeared, so it fades in).
  var slots=[],sky={x0:0,y0:0,x1:390,y1:600},keptAt=-9,skyAt=-9,from=[],keepCanvas=[],KEPT_ALPHA=.62,GATHER_S=.9;
  var $=function(id){return document.getElementById(id);};
  function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
  function canPlay(){return active&&!paused&&!away&&!won&&!document.hidden;}
  var WIDEN=[1,2,2.6],REACH=[1,1.6,2.1];
  function corridor(){var base=clamp(W*0.055,18,24)*WIDEN[ease],help=power>0?clamp(W*0.09,32,40):0;return Math.max(base,help)/W;}
  function nodeRadius(){var base=clamp(W*0.05,18,24)*REACH[ease],help=power>0?clamp(W*0.085,30,36):0;return Math.max(base,help)/W;}
  function raise(){var l=misses>=2||tryTime>=8?2:misses>=1||tryTime>=4?1:0;if(l<=ease)return;ease=l;
    // Echo says it once per level, for a child who cannot read the banner
    if(api)api.instruct(l===1?"So close! Press the glowing star and follow the arrow.":"Press the glowing star and slide toward the next one.");}
  function freshTry(){misses=0;ease=0;tryTime=0;movedAt=-9;}
  function miss(){misses++;failures++;var was=ease;raise();if(ease===was)banner(ease?"Nearly! Follow the arrow to the next star":"So close! Start at the glowing star");else banner(ease===1?"So close! Follow the arrow":"Slide toward the next star");}
  function banner(text){if($("starsBanner").textContent!==text)$("starsBanner").textContent=text;}
  function image(name){var i=art[name];return i&&i.complete&&i.naturalWidth?i:null;}
  function loadArt(){[["bg","stars-night-clear-v1.webp"],["star","star.webp"]].forEach(function(p){var i=new Image();i.onload=draw;i.src="/assets/crafted/game/"+p[1];art[p[0]]=i;});}
  function makeNodes(){nodes=pics[stage].points.map(function(p,n){return{x:(box.x+p[0]*box.size)/W,y:(box.y+p[1]*box.size)/H,lit:n<next};});paths=[];for(var n=1;n<next;n++)paths.push({from:{x:nodes[n-1].x,y:nodes[n-1].y},to:{x:nodes[n].x,y:nodes[n].y}});}
  // The kept pictures' slots (in px): each side band plus the box's empty
  // margin (no picture puts a star within .12 of the box's edge), at the
  // box's top and at its bottom. A band too narrow for a picture a child
  // can make out has none, and those pictures wait for the finale.
  function makeSlots(){var m=box.size*.08,bands=[[sky.x0,box.x+m],[box.x+box.size-m,sky.x1]];slots=[null,null,null,null];
    bands.forEach(function(b,side){var s=Math.min(b[1]-b[0],box.size*.32);if(s<26)return;var x=b[0]+(b[1]-b[0]-s)/2;slots[side]={x:x,y:box.y,size:s};slots[side+2]={x:x,y:box.y+box.size-s,size:s};});}
  // where the five pictures sit at the finale: three across, two under them
  function gathered(){var w=sky.x1-sky.x0,h=sky.y1-sky.y0,s=Math.min(w/3*.86,h/2*.86,box.size*.62),out=[];[[1/6,.5,5/6],[1/3,2/3]].forEach(function(row,i){row.forEach(function(f){out.push({x:sky.x0+w*f-s/2,y:sky.y0+h*(i?.73:.27)-s/2,size:s});});});return out;}
  // one finished picture as a little constellation, `size` across with its
  // top left at (x, y): its lines lit and a small star on every point
  function littlePicture(g,n,x,y,size){var pts=pics[n].points,i=image("star"),r=clamp(size*.09,5,11);g.save();g.translate(x,y);g.strokeStyle="#f6e8b5";g.shadowColor="#f7e1a8";g.shadowBlur=clamp(size*.05,4,9);g.lineWidth=clamp(size*.016,1.5,3);g.lineCap="round";g.lineJoin="round";g.beginPath();pts.forEach(function(p,k){if(k)g.lineTo(p[0]*size,p[1]*size);else g.moveTo(p[0]*size,p[1]*size);});g.stroke();g.shadowBlur=0;
    pts.forEach(function(p){if(i)g.drawImage(i,p[0]*size-r,p[1]*size-r,r*2,r*2);else{g.fillStyle="#fff3bf";g.beginPath();g.arc(p[0]*size,p[1]*size,r*.45,0,Math.PI*2);g.fill();}});g.restore();detail(pics[n].name,x,y,size,.85,g);}
  // Everything of the picture being traced, with room around it, erased
  // from a kept picture: the glowing corridor of the line the finger is on,
  // every line of the picture, every star with its glow and the held pen.
  function cutOut(g){if(!nodes.length)return;g.strokeStyle="#000";g.fillStyle="#000";g.lineCap="round";g.lineJoin="round";var a=nodes[Math.min(next-1,nodes.length-1)],b=nodes[Math.min(next,nodes.length-1)];
    if(active&&next<nodes.length){g.lineWidth=(corridor()*W+8)*2;g.beginPath();g.moveTo(a.x*W,a.y*H);g.lineTo(b.x*W,b.y*H);g.stroke();}
    g.lineWidth=28;g.beginPath();nodes.forEach(function(p,k){if(k)g.lineTo(p.x*W,p.y*H);else g.moveTo(p.x*W,p.y*H);});g.stroke();
    var r=Math.max(37,nodeRadius()*W+6);nodes.forEach(function(p){g.beginPath();g.arc(p.x*W,p.y*H,r,0,Math.PI*2);g.fill();});if(held){g.beginPath();g.arc(pen.x*W,pen.y*H,20,0,Math.PI*2);g.fill();}}
  // the finished pictures, other than the one in the tracing area, in their
  // slots; the newest fades in as its word starts the next picture
  function isKept(n){return n<4&&!!slots[n]&&completedPatterns[n]&&n!==stage;}
  function kept(){var dpr=Math.min(2,window.devicePixelRatio||1);for(var n=0;n<4;n++){if(!isKept(n))continue;var s=slots[n],c=keepCanvas[n]||(keepCanvas[n]=document.createElement("canvas")),px=Math.max(1,Math.ceil(s.size*dpr)),g,fade=calm||n!==stage-1?1:clamp((clock-keptAt)/.5,0,1);
    if(c.width!==px){c.width=px;c.height=px;}g=c.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);g.globalCompositeOperation="source-over";g.clearRect(0,0,s.size,s.size);littlePicture(g,n,0,0,s.size);
    g.globalCompositeOperation="destination-out";g.translate(-s.x,-s.y);cutOut(g);g.globalCompositeOperation="source-over";
    ctx.save();ctx.globalAlpha=KEPT_ALPHA*fade;ctx.drawImage(c,s.x,s.y,s.size,s.size);ctx.restore();}}
  // the finale: all five gather across the sky from where they were (a
  // kept slot, the tracing area, or nowhere: then it fades in where it goes)
  function gather(){var to=gathered(),k=calm?1:clamp((clock-skyAt)/GATHER_S,0,1),e=1-(1-k)*(1-k);to.forEach(function(t,n){var f=from[n]||{x:t.x,y:t.y,size:t.size,a:0};ctx.save();ctx.globalAlpha=f.a+(1-f.a)*e;littlePicture(ctx,n,f.x+(t.x-f.x)*e,f.y+(t.y-f.y)*e,f.size+(t.size-f.size)*e);ctx.restore();});}
  function fit(){
    if(!cv)return;cancelStroke(true);var oldW=W,oldH=H,rect=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,rect.width);H=Math.max(1,rect.height);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    top=$("starsBanner").getBoundingClientRect().bottom-rect.top+16;bottom=$("starsControls").getBoundingClientRect().top-rect.top-14;
    var landscape=W>H&&H<500,size,patternTop;
    if(landscape){size=Math.max(70,Math.min(W*.54,bottom-top-12));box={x:W*.63-size/2,y:top+6,size:size};minis=pics.map(function(p,n){return{x:W*.17,y:top+13+n*(Math.max(100,bottom-top)-24)/4,size:25};});sky={x0:W*.17+25,y0:top+6,x1:W-6,y1:bottom};}
    else{var strip=clamp(W*.12,40,56);patternTop=top+strip+18;var patternBottom=Math.min(bottom,H*.70),room=Math.max(90,patternBottom-patternTop);size=Math.min(W*.78,room);box={x:(W-size)/2,y:patternTop+(room-size)/2,size:size};minis=pics.map(function(p,n){return{x:W*(n+.5)/5,y:top+strip/2,size:Math.min(42,W*.105)};});sky={x0:6,y0:patternTop-10,x1:W-6,y1:patternBottom};}
    makeSlots();
    makeNodes();if(!active||pen.x===undefined){pen={x:nodes[Math.max(0,next-1)].x,y:nodes[Math.max(0,next-1)].y};}else{pen.x=clamp(pen.x,.04,.96);pen.y=clamp(pen.y,top/H,bottom/H);}forwardTravel=0;hud();draw();
  }
  function rectOf(s,n){return{picture:pics[n].name,x:s.x/W,y:s.y/H,w:s.size/W,h:s.size/H};}
  function snapshot(){var a=nodes[Math.min(next-1,nodes.length-1)],b=nodes[Math.min(next,nodes.length-1)],length=b?distance(a,b):0;window.__stars={active:active,paused:paused,stage:stage,stages:stages,completed:completed,won:won,picture:pics[stage].name,nodes:nodes.map(function(p){return{x:p.x,y:p.y,lit:p.lit};}),next:next,links:next-1,linkCount:next-1,totalLinks:nodes.length-1,currentSegment:{from:a,to:b},corridor:corridor(),nodeRadius:nodeRadius(),pen:{x:pen.x,y:pen.y},grip:{x:a.x,y:a.y},held:held,pointerId:owner,keyHeld:keyHeld,power:power,forwardTravel:forwardTravel,progress:length?clamp(forwardTravel/length,0,1):0,paths:paths.map(function(p){return{from:{x:p.from.x,y:p.from.y},to:{x:p.to.x,y:p.to.y}};}),completedPatterns:completedPatterns.slice(),round:pics.map(function(p){return p.name;}),tiers:pics.map(function(p){return p.tier;}),lines:pics.map(function(p){return p.points.length-1;}),catalog:ALL.map(function(p){return p.name;}),got:album.got.slice(),fresh:fresh.slice(),told:told,alive:completedPatterns[stage]?alive():0,failures:failures,misses:misses,ease:ease,tryTime:tryTime,celebrating:doneAt>0,width:W,height:H,
      kept:[0,1,2,3].filter(isKept).map(function(n){return rectOf(slots[n],n);}),slots:slots.map(function(s,n){return s?rectOf(s,n):null;}),gathered:won?gathered().map(rectOf):[],gathering:won&&!calm&&clock-skyAt<GATHER_S,sky:{x:sky.x0/W,y:sky.y0/H,right:sky.x1/W,bottom:sky.y1/H},box:{x:box.x/W,y:box.y/H,w:box.size/W,h:box.size/H},
      coordinates:"positions normalized to canvas; kept/slots/gathered/box rects as x,y,w,h of the canvas; corridor/nodeRadius/forwardTravel use canvas width. Native grip restarts at the last lit node; help preserves the pen's last physical position."};}
  function hud(){if(!cv||!nodes.length)return;var enabled=canPlay(),at=held?pen:nodes[Math.min(next-1,nodes.length-1)],b=$("starPen");b.disabled=!enabled;b.hidden=!active||won;b.style.left=at.x*W+"px";b.style.top=at.y*H+"px";b.setAttribute("aria-pressed",held?"true":"false");$("starsHelp").disabled=!enabled||held;$("starsHearStep").disabled=!enabled||held;$("starsPower").hidden=power<=0;$("starsPowerFill").style.width=power/POWER*100+"%";snapshot();}
  function background(){var i=image("bg");if(i){var scale=Math.max(W/i.naturalWidth,H/i.naturalHeight),w=i.naturalWidth*scale,h=i.naturalHeight*scale;ctx.drawImage(i,(W-w)/2,(H-h)/2,w,h);}else{var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#172447");g.addColorStop(.7,"#494b72");g.addColorStop(1,"#79849d");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.fillStyle="#efe4bc";ctx.beginPath();ctx.arc(W*.84,H*.17,26,0,Math.PI*2);ctx.fill();ctx.fillStyle="#273252";ctx.beginPath();ctx.arc(W*.87,H*.15,25,0,Math.PI*2);ctx.fill();}}
  function star(x,y,size,lit){var i=image("star");ctx.save();ctx.translate(x,y);if(lit){ctx.shadowColor="#fff2b9";ctx.shadowBlur=16;}if(i&&lit)ctx.drawImage(i,-size/2,-size/2,size,size);else{ctx.fillStyle=lit?"#fff3bf":"#bfc7d6";ctx.globalAlpha=lit?1:.58;ctx.beginPath();for(var n=0;n<10;n++){var a=-Math.PI/2+n*Math.PI/5,r=size*(n%2?.22:.5);if(n)ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();}ctx.restore();}
  // each picture's little details, in the box's units: they appear as the
  // picture is finished (an eye, whiskers, a door), and stay on it
  function detail(name,x,y,size,alpha,g){var c=g||ctx;c.save();c.translate(x,y);c.scale(size,size);c.globalAlpha*=alpha;c.strokeStyle="#e7d7b2";c.fillStyle="rgba(247,227,174,.08)";c.lineWidth=1.8/size;c.lineJoin="round";c.lineCap="round";
    var dot=function(px,py,r,f){c.beginPath();c.arc(px,py,r,0,Math.PI*2);c.fillStyle=f||"#fff2bb";c.fill();},line=function(pts){c.beginPath();pts.forEach(function(q,k){if(k)c.lineTo(q[0],q[1]);else c.moveTo(q[0],q[1]);});c.stroke();};
    if(name==="tent"){line([[.5,.39],[.39,.84],[.61,.84]]);}
    else if(name==="flag"){c.beginPath();for(var n=0;n<10;n++){var a=-Math.PI/2+n*Math.PI/5,r=n%2?.022:.055;c.lineTo(.47+Math.cos(a)*r,.3+Math.sin(a)*r);}c.closePath();c.fillStyle="#fff2bb";c.fill();}
    else if(name==="kite"){c.beginPath();c.moveTo(.5,.84);c.bezierCurveTo(.68,.97,.31,.9,.51,1.01);c.stroke();}
    else if(name==="house"){c.strokeRect(.44,.62,.14,.22);c.strokeRect(.27,.5,.1,.1);c.strokeRect(.63,.5,.1,.1);}
    else if(name==="boat"){c.beginPath();c.moveTo(.5,.14);c.lineTo(.22,.57);c.lineTo(.5,.57);c.closePath();c.fill();c.stroke();line([[.14,.66],[.5,.66]]);}
    else if(name==="rocket"){c.beginPath();c.arc(.5,.47,.07,0,Math.PI*2);c.fillStyle="rgba(247,227,174,.3)";c.fill();c.stroke();line([[.3,.62],[.2,.84],[.3,.8]]);line([[.7,.62],[.8,.84],[.7,.8]]);line([[.42,.8],[.5,.92],[.58,.8]]);}
    else if(name==="mountain"){line([[.35,.42],[.38,.46],[.41,.42],[.44,.46],[.47,.42]]);}
    else if(name==="star"){dot(.5,.5,.035);}
    else if(name==="fish"){dot(.72,.44,.028);c.beginPath();c.moveTo(.64,.34);c.quadraticCurveTo(.58,.5,.64,.66);c.stroke();}
    else if(name==="heart"){c.beginPath();c.moveTo(.27,.4);c.quadraticCurveTo(.27,.3,.34,.27);c.stroke();}
    else if(name==="cat"){dot(.4,.58,.03);dot(.6,.58,.03);c.beginPath();c.moveTo(.47,.66);c.lineTo(.53,.66);c.lineTo(.5,.7);c.closePath();c.fillStyle="#fff2bb";c.fill();line([[.44,.7],[.29,.68]]);line([[.44,.73],[.29,.77]]);line([[.56,.7],[.71,.68]]);line([[.56,.73],[.71,.77]]);}
    else if(name==="crown"){dot(.34,.64,.035,"rgba(247,227,174,.55)");dot(.5,.62,.045,"rgba(247,227,174,.55)");dot(.66,.64,.035,"rgba(247,227,174,.55)");}
    c.restore();}
  // the round's strip: a drawn picture shows itself; one still to draw is a
  // small dim star, so what it will be stays a surprise
  function miniatures(){minis.forEach(function(m,n){var done=completedPatterns[n];if(!done){ctx.save();ctx.globalAlpha=.38;star(m.x,m.y,Math.min(14,m.size*.42),false);ctx.restore();return;}ctx.save();ctx.translate(m.x-m.size/2,m.y-m.size/2);ctx.globalAlpha=1;ctx.strokeStyle=done?"#f7e9b7":"#a6b6cd";ctx.lineWidth=1.6;ctx.lineJoin="round";ctx.beginPath();pics[n].points.forEach(function(p,index){if(index)ctx.lineTo(p[0]*m.size,p[1]*m.size);else ctx.moveTo(p[0]*m.size,p[1]*m.size);});ctx.stroke();if(done)detail(pics[n].name,0,0,m.size,.75);ctx.restore();});}
  function constellation(){if(!nodes.length)return;var a=nodes[Math.min(next-1,nodes.length-1)],b=nodes[Math.min(next,nodes.length-1)];if(active&&next<nodes.length){var pulse=ease&&!calm?.5+.5*Math.sin(clock*4):1;ctx.save();ctx.lineCap="round";ctx.strokeStyle=ease?"rgba(255,236,160,"+(.22+.14*pulse).toFixed(3)+")":power>0?"rgba(176,220,214,.2)":"rgba(207,222,224,.17)";ctx.lineWidth=corridor()*W*2;ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke();ctx.strokeStyle=power>0?"#e5f5ce":"rgba(228,235,218,.42)";ctx.lineWidth=power>0?2.5:1.5;ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke();ctx.restore();if(ease)arrow(a,b,pulse);}
    var glow=completedPatterns[stage]&&!calm?Math.max(0,1-(clock-litAt)/1.15):0;
    ctx.save();ctx.strokeStyle="#f6e8b5";ctx.shadowColor="#f7e1a8";ctx.shadowBlur=9+18*glow;ctx.lineWidth=3+2.5*glow;ctx.lineCap="round";paths.forEach(function(p){ctx.beginPath();ctx.moveTo(p.from.x*W,p.from.y*H);ctx.lineTo(p.to.x*W,p.to.y*H);ctx.stroke();});ctx.restore();
    if(next<nodes.length&&distance(a,pen)>.005){ctx.save();ctx.strokeStyle=held?"rgba(249,241,200,.9)":"rgba(249,241,200,.25)";ctx.lineWidth=2;ctx.setLineDash(held?[]:[3,6]);ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(pen.x*W,pen.y*H);ctx.stroke();ctx.restore();}
    nodes.forEach(function(p,n){var last=n===next-1&&active,upcoming=n===next&&active;if(upcoming){ctx.save();ctx.strokeStyle="rgba(255,243,184,.72)";ctx.lineWidth=ease?4:2;if(ease){ctx.shadowColor="#fff2b9";ctx.shadowBlur=14;}ctx.beginPath();ctx.arc(p.x*W,p.y*H,nodeRadius()*W,0,Math.PI*2);ctx.stroke();ctx.restore();}if(last){ctx.save();ctx.fillStyle="rgba(255,242,176,.15)";ctx.beginPath();ctx.arc(p.x*W,p.y*H,31,0,Math.PI*2);ctx.fill();ctx.restore();}star(p.x*W,p.y*H,last?30:p.lit?22:upcoming?20:12,p.lit||upcoming);});
    if(held)star(pen.x*W,pen.y*H,18,true);if(completedPatterns[stage])detail(pics[stage].name,box.x,box.y,box.size,.85*alive());
  }
  // how far the finished picture's details have come in (all at once under
  // Reduce Motion)
  function alive(){return calm?1:clamp((clock-litAt)/.5,0,1);}
  // ease 1 and up: a bright arrow on the path, pointing at the next star
  function arrow(a,b,pulse){var ax=a.x*W,ay=a.y*H,bx=b.x*W,by=b.y*H,len=Math.sqrt((bx-ax)*(bx-ax)+(by-ay)*(by-ay));if(len<40)return;var ux=(bx-ax)/len,uy=(by-ay)/len,tipx=ax+ux*len*.62,tipy=ay+uy*len*.62,s=13+3*pulse;
    ctx.save();ctx.fillStyle="#fff2bb";ctx.strokeStyle="#fff2bb";ctx.shadowColor="#fff2b9";ctx.shadowBlur=10;ctx.lineWidth=4;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(tipx-ux*s*2.2,tipy-uy*s*2.2);ctx.lineTo(tipx-ux*s*.6,tipy-uy*s*.6);ctx.stroke();ctx.beginPath();ctx.moveTo(tipx,tipy);ctx.lineTo(tipx-ux*s-uy*s*.75,tipy-uy*s+ux*s*.75);ctx.lineTo(tipx-ux*s+uy*s*.75,tipy-uy*s-ux*s*.75);ctx.closePath();ctx.fill();ctx.restore();}
  function draw(){if(!ctx)return;ctx.clearRect(0,0,W,H);background();miniatures();if(won){gather();return;}kept();constellation();}
  function distance(a,b){var dx=a.x-b.x,dy=(a.y-b.y)*H/W;return Math.sqrt(dx*dx+dy*dy);}
  function nearest(p,a,b){var dx=b.x-a.x,dy=(b.y-a.y)*H/W,length=dx*dx+dy*dy,t=length?clamp(((p.x-a.x)*dx+(p.y-a.y)*H/W*dy)/length,0,1):0;return{x:a.x+dx*t,y:a.y+(b.y-a.y)*t};}
  function projection(p,a,b){var dx=b.x-a.x,dy=(b.y-a.y)*H/W,length=Math.sqrt(dx*dx+dy*dy);return length?clamp(((p.x-a.x)*dx+(p.y-a.y)*H/W*dy)/length,0,length):0;}
  function detach(){var id=owner,s=surface;owner=null;surface=null;held=false;keyHeld=false;if(id!==null&&s)try{if(s.hasPointerCapture(id))s.releasePointerCapture(id);}catch(e){}}
  function cancelStroke(preservePen){detach();forwardTravel=0;if(!preservePen&&nodes.length)pen={x:nodes[Math.min(next-1,nodes.length-1)].x,y:nodes[Math.min(next-1,nodes.length-1)].y};}
  function begin(){if(!canPlay()||held||next>=nodes.length)return false;held=true;pen={x:nodes[next-1].x,y:nodes[next-1].y};forwardTravel=0;banner("Follow the path to the next star");return true;}
  function commit(p){var a=nodes[next-1],b=nodes[next];paths.push({from:{x:a.x,y:a.y},to:{x:b.x,y:b.y}});pen={x:b.x,y:b.y};nodes[next].lit=true;next++;forwardTravel=0;tryTime=0;if(next>=nodes.length){completedPatterns[stage]=true;completed=stage+1;active=false;detach();freshTry();litAt=clock;keepFound(pics[stage]);api.sfx("correct");api.face("cheer");api.cheer("You drew it!");banner(completed===stages?"Five sleepy pictures in our sky!":"A little "+pics[stage].name+", drawn by you!");
      // the celebration beat: the next word waits about a second, on the
      // game's clock, so the chime and the picture are seen and heard first
      doneAt=clock+1.15;hud();draw();}else{api.sfx("tap");banner("Another little star. Keep going!");}}
  function movePen(p){if(!canPlay()||!held||next>=nodes.length)return;var a=nodes[next-1],b=nodes[next],near=nearest(b,pen,p),travel=projection(near,a,b),length=distance(a,b);movedAt=clock;
    // ease 2: almost anything works. The pen rides the line as far as the
    // finger has gone toward the next star; it never goes back, never
    // starts again, and lights the star at three quarters of the way.
    if(ease>=2){forwardTravel=Math.max(forwardTravel,projection(p,a,b));var k=length?forwardTravel/length:1;pen={x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k};if(forwardTravel>=length*.75){commit(p);}hud();draw();return;}
    // The capsule is convex: each accepted recorded segment stays inside it.
    // A real pass through the next star can count before a fast overshoot;
    // a detour first leaves the corridor and releases the whole stroke.
    if(travel>=length*.75&&distance(near,b)<=nodeRadius()&&distance(near,nearest(near,a,b))<=corridor()){commit(p);hud();draw();return;}
    if(distance(p,nearest(p,a,b))>corridor()){cancelStroke(false);miss();hud();draw();return;}
    forwardTravel=Math.max(forwardTravel,projection(p,a,b));pen={x:p.x,y:p.y};hud();draw();
  }
  function point(event){var r=cv.getBoundingClientRect();return{x:(event.clientX-r.left)/W,y:(event.clientY-r.top)/H};}
  function down(event){if(owner!==null||keyHeld||event.button!==undefined&&event.button!==0||!begin())return;event.preventDefault();var p=point(event);owner=event.pointerId;surface=event.currentTarget;grab={x:p.x-pen.x,y:p.y-pen.y};try{surface.setPointerCapture(owner);}catch(e){}hud();}
  function move(event){if(event.pointerId!==owner)return;event.preventDefault();var p=point(event);movePen({x:p.x-grab.x,y:p.y-grab.y});}
  // letting go after drawing part of a line is a try that did not reach the
  // star (a miss); a tap, or letting go on a star, is not
  function letGo(){var partWay=held&&next<nodes.length&&forwardTravel>=distance(nodes[next-1],nodes[next])*.2;cancelStroke(true);if(partWay)miss();}
  function release(event){if(event.pointerId!==owner)return;event.preventDefault();letGo();hud();draw();}
  function keyboard(event){if(!canPlay()||owner!==null)return;var key=event.key;if(key===" "||key==="Enter"){event.preventDefault();if(event.repeat)return;if(held)letGo();else if(begin())keyHeld=true;hud();draw();return;}if(key==="Escape"){event.preventDefault();cancelStroke(false);hud();draw();return;}if(!held||!keyHeld)return;var step=event.shiftKey ? 0.012 : 0.04,dx=0,dy=0;if(key==="ArrowLeft")dx=-step;else if(key==="ArrowRight")dx=step;else if(key==="ArrowUp")dy=-step*W/H;else if(key==="ArrowDown")dy=step*W/H;else return;event.preventDefault();movePen({x:pen.x+dx,y:pen.y+dy});}
  function controls(){var b=$("starPen");b.addEventListener("pointerdown",down);b.addEventListener("pointermove",move);["pointerup","pointercancel","lostpointercapture"].forEach(function(name){b.addEventListener(name,release);});b.addEventListener("keydown",keyboard);$("starsHelp").onclick=function(){if(canPlay()&&!held)api.practice();};$("starsHearStep").onclick=function(){if(canPlay()&&!held)api.instruct(HOWTO);};window.addEventListener("resize",fit);window.addEventListener("blur",function(){cancelStroke(true);hud();});document.addEventListener("visibilitychange",function(){if(document.hidden)pause();});window.addEventListener("pagehide",function(){away=true;pause();cancelAnimationFrame(raf);raf=0;});window.addEventListener("pageshow",function(){away=false;if(!raf){last=0;raf=requestAnimationFrame(frame);}hud();});}
  function frame(now){var dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    if(!paused&&!away&&!document.hidden){clock+=dt;if(doneAt&&clock>=doneAt){doneAt=0;hud();if(api)api.done();}}
    if(canPlay()){power=Math.max(0,power-dt);
      // finger work: held and moving within the last 0.6 s, no new star yet
      if(held&&clock-movedAt<.6){tryTime+=dt;raise();}}
    hud();draw();raf=requestAnimationFrame(frame);}
  // the word's picture: the stars to draw and nothing else (no wider path)
  function go(){power=0;active=true;paused=false;last=0;banner("Follow the stars. What will it be?");hud();}
  function earnPower(){power=POWER;active=true;paused=false;last=0;banner("A wide glowing path. Follow the stars!");hud();}
  function recall(){var v=null;try{v=store&&store.read?store.read():null;}catch(e){}var names=ALL.map(function(p){return p.name;}),got=[];if(v&&v.got&&v.got.length)v.got.forEach(function(n){if(names.indexOf(n)>=0&&got.indexOf(n)<0)got.push(n);});album={got:got};}
  function shuffled(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
  // this round's five: by tier, a picture never drawn before one drawn, then
  // the fewest lines first inside a tier
  function plan(){recall();var used=[];pics=ROUND_TIERS.map(function(t){var pool=ALL.filter(function(p){return p.tier===t&&used.indexOf(p)<0;}),news=shuffled(pool.filter(function(p){return album.got.indexOf(p.name)<0;})),old=shuffled(pool.filter(function(p){return album.got.indexOf(p.name)>=0;})),pick=(news.length?news:old)[0];used.push(pick);return pick;});
    pics=pics.map(function(p,i){return{p:p,i:i};}).sort(function(a,b){return a.p.tier-b.p.tier||a.p.points.length-b.p.points.length||a.i-b.i;}).map(function(x){return x.p;});fresh=[];}
  // A picture drawn is the child's for good, at once (closing the app
  // before the end card loses nothing); the end card names what was new.
  function keepFound(p){if(!p||album.got.indexOf(p.name)>=0)return;album.got.push(p.name);fresh.push(p.name);try{if(store&&store.write)store.write({got:album.got.slice()});}catch(e){}try{if(store&&store.found)store.found(fresh.map(function(n){return ALL.filter(function(q){return q.name===n;})[0];}));}catch(e){}paintRows();}
  // The collection on the start and end cards: every picture, the ones drawn
  // in gold (this round's new ones ringed on the end card), the rest faint.
  // Named, never counted.
  function paintRows(){var have=ALL.filter(function(p){return album.got.indexOf(p.name)>=0;}),label=(have.length?"Pictures drawn: "+have.map(function(p){return p.name;}).join(", ")+".":"No pictures drawn yet.")+(have.length<ALL.length?" More pictures to find.":" Every picture drawn!");
    ["skyRow","skyRowEnd"].forEach(function(id){var el=$(id);if(!el)return;var h="";ALL.forEach(function(p){var got=album.got.indexOf(p.name)>=0,isNew=got&&fresh.indexOf(p.name)>=0&&id==="skyRowEnd";h+='<svg viewBox="0 0 1 1" data-picture="'+p.name+'" data-found="'+(got?1:0)+'" class="'+(got?"got":"left")+(isNew?" new":"")+'"><rect width="1" height="1" rx=".24"/><polyline points="'+p.points.map(function(q){return(.1+q[0]*.8).toFixed(3)+","+(.1+q[1]*.8).toFixed(3);}).join(" ")+'"/></svg>';});el.innerHTML=h;el.setAttribute("aria-label",label);el.hidden=false;});}
  function pause(){paused=true;last=0;cancelStroke(true);hud();}
  function reset(){cancelStroke(true);active=false;paused=false;won=false;stage=0;completed=0;next=1;power=0;failures=0;last=0;doneAt=0;litAt=-9;freshTry();plan();paintRows();if(store&&store.found)try{store.found([]);}catch(e){}completedPatterns=[false,false,false,false,false];from=[];keptAt=-9;skyAt=-9;makeNodes();pen={x:nodes[0].x,y:nodes[0].y};banner("Let's draw a quiet little night sky");hud();draw();}
  window.Stars={init:function(a,n){api=a;stages=n||5;try{calm=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);}catch(e){}cv=$("starsCanvas");ctx=cv.getContext("2d");loadArt();controls();fit();reset();raf=requestAnimationFrame(frame);},setup:function(hooks){store=hooks||null;recall();paintRows();},onWord:function(index){cancelStroke(true);doneAt=0;freshTry();stage=index;keptAt=clock;litAt=-9;next=1;makeNodes();pen={x:nodes[0].x,y:nodes[0].y};go();if(!told){told=true;api.instruct(HOWTO);}},onHelp:earnPower,pause:pause,resume:function(playing){paused=playing===false;last=0;hud();},reset:reset,finale:function(){cancelStroke(true);doneAt=0;active=false;power=0;
    // where each picture starts its way to the gathered sky
    skyAt=clock;from=pics.map(function(p,n){var s=n===stage?{x:box.x,y:box.y,size:box.size,a:1}:isKept(n)?{x:slots[n].x,y:slots[n].y,size:slots[n].size,a:KEPT_ALPHA}:null;return s;});won=true;banner("Five little pictures. Good night, stars!");hud();draw();}};
})();
