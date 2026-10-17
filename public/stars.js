/* Bedtime Stars: continuous, physically checked constellation strokes.
   Speech reveals a more forgiving route; it never draws any connection. */
(function () {
  "use strict";
  var STEP_LINES = [
    "Start at the glowing star. Slide along the path to the next star.",
    "Let's make a kite. Keep your finger on the glowing path.",
    "A little house! Start at the bright star and follow each path.",
    "Trace a sleepy little boat. Go from one glowing star to the next.",
    "One more picture. Follow the stars to make a little fish."
  ];
  var PICTURES = [
    {name:"tent",points:[[.2,.84],[.5,.16],[.8,.84],[.2,.84]]},
    {name:"kite",points:[[.5,.12],[.84,.46],[.5,.84],[.16,.46],[.5,.12]]},
    {name:"house",points:[[.2,.84],[.2,.42],[.5,.14],[.8,.42],[.8,.84],[.2,.84]]},
    {name:"boat",points:[[.5,.14],[.5,.66],[.84,.66],[.7,.86],[.28,.86],[.14,.66]]},
    {name:"fish",points:[[.15,.22],[.89,.5],[.15,.78],[.31,.5],[.15,.22]]}
  ];
  var api,cv,ctx,W=390,H=844,raf=0,last=0,active=false,paused=false,away=false,won=false,stage=0,stages=5,completed=0,power=0;
  var nodes=[],next=1,pen={x:.5,y:.5},paths=[],completedPatterns=[false,false,false,false,false],minis=[],box={x:50,y:220,size:290},top=120,bottom=750,forwardTravel=0,failures=0;
  var held=false,owner=null,surface=null,keyHeld=false,grab={x:0,y:0},art={},POWER=10;
  var $=function(id){return document.getElementById(id);};
  function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
  function canPlay(){return active&&!paused&&!away&&!won&&!document.hidden;}
  function corridor(){return clamp(W*(power>0 ? 0.09 : 0.055),power>0?32:18,power>0?40:24)/W;}
  function nodeRadius(){return clamp(W*(power>0 ? 0.085 : 0.05),power>0?30:18,power>0?36:24)/W;}
  function banner(text){if($("starsBanner").textContent!==text)$("starsBanner").textContent=text;}
  function image(name){var i=art[name];return i&&i.complete&&i.naturalWidth?i:null;}
  function loadArt(){[["bg","stars-night-clear-v1.webp"],["star","star.webp"]].forEach(function(p){var i=new Image();i.onload=draw;i.src="/assets/crafted/game/"+p[1];art[p[0]]=i;});}
  function makeNodes(){nodes=PICTURES[stage].points.map(function(p,n){return{x:(box.x+p[0]*box.size)/W,y:(box.y+p[1]*box.size)/H,lit:n<next};});paths=[];for(var n=1;n<next;n++)paths.push({from:{x:nodes[n-1].x,y:nodes[n-1].y},to:{x:nodes[n].x,y:nodes[n].y}});}
  function fit(){
    if(!cv)return;cancelStroke(true);var oldW=W,oldH=H,rect=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,rect.width);H=Math.max(1,rect.height);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    top=$("starsBanner").getBoundingClientRect().bottom-rect.top+16;bottom=$("starsControls").getBoundingClientRect().top-rect.top-14;
    var landscape=W>H&&H<500,size,patternTop;
    if(landscape){size=Math.max(70,Math.min(W*.54,bottom-top-12));box={x:W*.63-size/2,y:top+6,size:size};minis=PICTURES.map(function(p,n){return{x:W*.17,y:top+13+n*(Math.max(100,bottom-top)-24)/4,size:25};});}
    else{var strip=clamp(W*.12,40,56);patternTop=top+strip+18;var patternBottom=Math.min(bottom,H*.70),room=Math.max(90,patternBottom-patternTop);size=Math.min(W*.78,room);box={x:(W-size)/2,y:patternTop+(room-size)/2,size:size};minis=PICTURES.map(function(p,n){return{x:W*(n+.5)/5,y:top+strip/2,size:Math.min(42,W*.105)};});}
    makeNodes();if(!active||pen.x===undefined){pen={x:nodes[Math.max(0,next-1)].x,y:nodes[Math.max(0,next-1)].y};}else{pen.x=clamp(pen.x,.04,.96);pen.y=clamp(pen.y,top/H,bottom/H);}forwardTravel=0;hud();draw();
  }
  function snapshot(){var a=nodes[Math.min(next-1,nodes.length-1)],b=nodes[Math.min(next,nodes.length-1)],length=b?distance(a,b):0;window.__stars={active:active,paused:paused,stage:stage,stages:stages,completed:completed,won:won,picture:PICTURES[stage].name,nodes:nodes.map(function(p){return{x:p.x,y:p.y,lit:p.lit};}),next:next,links:next-1,linkCount:next-1,totalLinks:nodes.length-1,currentSegment:{from:a,to:b},corridor:corridor(),nodeRadius:nodeRadius(),pen:{x:pen.x,y:pen.y},grip:{x:a.x,y:a.y},held:held,pointerId:owner,keyHeld:keyHeld,power:power,forwardTravel:forwardTravel,progress:length?clamp(forwardTravel/length,0,1):0,paths:paths.map(function(p){return{from:{x:p.from.x,y:p.from.y},to:{x:p.to.x,y:p.to.y}};}),completedPatterns:completedPatterns.slice(),failures:failures,width:W,height:H,coordinates:"positions normalized to canvas; corridor/nodeRadius/forwardTravel use canvas width. Native grip restarts at the last lit node; help preserves the pen's last physical position."};}
  function hud(){if(!cv||!nodes.length)return;var enabled=canPlay(),at=held?pen:nodes[Math.min(next-1,nodes.length-1)],b=$("starPen");b.disabled=!enabled;b.hidden=!active||won;b.style.left=at.x*W+"px";b.style.top=at.y*H+"px";b.setAttribute("aria-pressed",held?"true":"false");$("starsHelp").disabled=!enabled||held;$("starsHearStep").disabled=!enabled||held;$("starsPower").hidden=power<=0;$("starsPowerFill").style.width=power/POWER*100+"%";snapshot();}
  function background(){var i=image("bg");if(i){var scale=Math.max(W/i.naturalWidth,H/i.naturalHeight),w=i.naturalWidth*scale,h=i.naturalHeight*scale;ctx.drawImage(i,(W-w)/2,(H-h)/2,w,h);}else{var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#172447");g.addColorStop(.7,"#494b72");g.addColorStop(1,"#79849d");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.fillStyle="#efe4bc";ctx.beginPath();ctx.arc(W*.84,H*.17,26,0,Math.PI*2);ctx.fill();ctx.fillStyle="#273252";ctx.beginPath();ctx.arc(W*.87,H*.15,25,0,Math.PI*2);ctx.fill();}}
  function star(x,y,size,lit){var i=image("star");ctx.save();ctx.translate(x,y);if(lit){ctx.shadowColor="#fff2b9";ctx.shadowBlur=16;}if(i&&lit)ctx.drawImage(i,-size/2,-size/2,size,size);else{ctx.fillStyle=lit?"#fff3bf":"#bfc7d6";ctx.globalAlpha=lit?1:.58;ctx.beginPath();for(var n=0;n<10;n++){var a=-Math.PI/2+n*Math.PI/5,r=size*(n%2?.22:.5);if(n)ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();}ctx.restore();}
  function detail(name,x,y,size,alpha){ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.globalAlpha=alpha;ctx.strokeStyle="#e7d7b2";ctx.fillStyle="rgba(247,227,174,.08)";ctx.lineWidth=1.5/size;ctx.lineJoin="round";
    if(name==="tent"){ctx.beginPath();ctx.moveTo(.5,.39);ctx.lineTo(.39,.84);ctx.lineTo(.61,.84);ctx.stroke();}
    else if(name==="kite"){ctx.beginPath();ctx.moveTo(.5,.84);ctx.bezierCurveTo(.68,.97,.31,.9,.51,1.01);ctx.stroke();}
    else if(name==="house"){ctx.strokeRect(.44,.62,.14,.22);}
    else if(name==="boat"){ctx.beginPath();ctx.moveTo(.5,.14);ctx.lineTo(.22,.57);ctx.lineTo(.5,.57);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(.14,.66);ctx.lineTo(.5,.66);ctx.stroke();}
    else{ctx.beginPath();ctx.arc(.72,.47,.018,0,Math.PI*2);ctx.fillStyle="#fff2bb";ctx.fill();}ctx.restore();}
  function miniatures(){minis.forEach(function(m,n){var done=completedPatterns[n];ctx.save();ctx.translate(m.x-m.size/2,m.y-m.size/2);ctx.globalAlpha=done?1:.17;ctx.strokeStyle=done?"#f7e9b7":"#a6b6cd";ctx.lineWidth=1.6;ctx.lineJoin="round";ctx.beginPath();PICTURES[n].points.forEach(function(p,index){if(index)ctx.lineTo(p[0]*m.size,p[1]*m.size);else ctx.moveTo(p[0]*m.size,p[1]*m.size);});ctx.stroke();if(done)detail(PICTURES[n].name,0,0,m.size,.75);ctx.restore();});}
  function constellation(){if(!nodes.length)return;var a=nodes[Math.min(next-1,nodes.length-1)],b=nodes[Math.min(next,nodes.length-1)];if(active&&next<nodes.length){ctx.save();ctx.lineCap="round";ctx.strokeStyle=power>0?"rgba(176,220,214,.18)":"rgba(207,222,224,.065)";ctx.lineWidth=corridor()*W*2;ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke();ctx.strokeStyle=power>0?"#e5f5ce":"rgba(228,235,218,.42)";ctx.lineWidth=power>0?2.5:1.5;ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke();ctx.restore();}
    ctx.save();ctx.strokeStyle="#f6e8b5";ctx.shadowColor="#f7e1a8";ctx.shadowBlur=9;ctx.lineWidth=3;ctx.lineCap="round";paths.forEach(function(p){ctx.beginPath();ctx.moveTo(p.from.x*W,p.from.y*H);ctx.lineTo(p.to.x*W,p.to.y*H);ctx.stroke();});ctx.restore();
    if(next<nodes.length&&distance(a,pen)>.005){ctx.save();ctx.strokeStyle=held?"rgba(249,241,200,.9)":"rgba(249,241,200,.25)";ctx.lineWidth=2;ctx.setLineDash(held?[]:[3,6]);ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(pen.x*W,pen.y*H);ctx.stroke();ctx.restore();}
    nodes.forEach(function(p,n){var last=n===next-1&&active,upcoming=n===next&&active;if(upcoming){ctx.save();ctx.strokeStyle="rgba(255,243,184,.72)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x*W,p.y*H,nodeRadius()*W,0,Math.PI*2);ctx.stroke();ctx.restore();}if(last){ctx.save();ctx.fillStyle="rgba(255,242,176,.15)";ctx.beginPath();ctx.arc(p.x*W,p.y*H,31,0,Math.PI*2);ctx.fill();ctx.restore();}star(p.x*W,p.y*H,last?30:p.lit?22:upcoming?20:12,p.lit||upcoming);});
    if(held)star(pen.x*W,pen.y*H,18,true);if(completedPatterns[stage])detail(PICTURES[stage].name,box.x,box.y,box.size,.85);
  }
  function draw(){if(!ctx)return;ctx.clearRect(0,0,W,H);background();miniatures();constellation();}
  function distance(a,b){var dx=a.x-b.x,dy=(a.y-b.y)*H/W;return Math.sqrt(dx*dx+dy*dy);}
  function nearest(p,a,b){var dx=b.x-a.x,dy=(b.y-a.y)*H/W,length=dx*dx+dy*dy,t=length?clamp(((p.x-a.x)*dx+(p.y-a.y)*H/W*dy)/length,0,1):0;return{x:a.x+dx*t,y:a.y+(b.y-a.y)*t};}
  function projection(p,a,b){var dx=b.x-a.x,dy=(b.y-a.y)*H/W,length=Math.sqrt(dx*dx+dy*dy);return length?clamp(((p.x-a.x)*dx+(p.y-a.y)*H/W*dy)/length,0,length):0;}
  function detach(){var id=owner,s=surface;owner=null;surface=null;held=false;keyHeld=false;if(id!==null&&s)try{if(s.hasPointerCapture(id))s.releasePointerCapture(id);}catch(e){}}
  function cancelStroke(preservePen){detach();forwardTravel=0;if(!preservePen&&nodes.length)pen={x:nodes[Math.min(next-1,nodes.length-1)].x,y:nodes[Math.min(next-1,nodes.length-1)].y};}
  function begin(){if(!canPlay()||held||next>=nodes.length)return false;held=true;pen={x:nodes[next-1].x,y:nodes[next-1].y};forwardTravel=0;banner("Follow the path to the next star");return true;}
  function commit(p){var a=nodes[next-1],b=nodes[next];paths.push({from:{x:a.x,y:a.y},to:{x:b.x,y:b.y}});pen={x:b.x,y:b.y};nodes[next].lit=true;next++;forwardTravel=0;if(next>=nodes.length){completedPatterns[stage]=true;completed=stage+1;active=false;detach();api.sfx("correct");banner(completed===stages?"Five sleepy pictures in our sky!":"A little "+PICTURES[stage].name+", drawn by you!");hud();draw();api.done();}else{api.sfx("tap");banner("Another little star. Keep going!");}}
  function movePen(p){if(!canPlay()||!held||next>=nodes.length)return;var a=nodes[next-1],b=nodes[next],near=nearest(b,pen,p),travel=projection(near,a,b),length=distance(a,b);
    // The capsule is convex: each accepted recorded segment stays inside it.
    // A real pass through the next star can count before a fast overshoot;
    // a detour first leaves the corridor and releases the whole stroke.
    if(travel>=length*.75&&distance(near,b)<=nodeRadius()&&distance(near,nearest(near,a,b))<=corridor()){commit(p);hud();draw();return;}
    if(distance(p,nearest(p,a,b))>corridor()){failures++;cancelStroke(false);banner("Start again at the glowing star");hud();draw();return;}
    forwardTravel=Math.max(forwardTravel,projection(p,a,b));pen={x:p.x,y:p.y};hud();draw();
  }
  function point(event){var r=cv.getBoundingClientRect();return{x:(event.clientX-r.left)/W,y:(event.clientY-r.top)/H};}
  function down(event){if(owner!==null||keyHeld||event.button!==undefined&&event.button!==0||!begin())return;event.preventDefault();var p=point(event);owner=event.pointerId;surface=event.currentTarget;grab={x:p.x-pen.x,y:p.y-pen.y};try{surface.setPointerCapture(owner);}catch(e){}hud();}
  function move(event){if(event.pointerId!==owner)return;event.preventDefault();var p=point(event);movePen({x:p.x-grab.x,y:p.y-grab.y});}
  function release(event){if(event.pointerId!==owner)return;event.preventDefault();cancelStroke(true);hud();draw();}
  function keyboard(event){if(!canPlay()||owner!==null)return;var key=event.key;if(key===" "||key==="Enter"){event.preventDefault();if(event.repeat)return;if(held)cancelStroke(true);else if(begin())keyHeld=true;hud();draw();return;}if(key==="Escape"){event.preventDefault();cancelStroke(false);hud();draw();return;}if(!held||!keyHeld)return;var step=event.shiftKey ? 0.012 : 0.04,dx=0,dy=0;if(key==="ArrowLeft")dx=-step;else if(key==="ArrowRight")dx=step;else if(key==="ArrowUp")dy=-step*W/H;else if(key==="ArrowDown")dy=step*W/H;else return;event.preventDefault();movePen({x:pen.x+dx,y:pen.y+dy});}
  function controls(){var b=$("starPen");b.addEventListener("pointerdown",down);b.addEventListener("pointermove",move);["pointerup","pointercancel","lostpointercapture"].forEach(function(name){b.addEventListener(name,release);});b.addEventListener("keydown",keyboard);$("starsHelp").onclick=function(){if(canPlay()&&!held)api.practice();};$("starsHearStep").onclick=function(){if(canPlay()&&!held)api.instruct(STEP_LINES[stage]);};window.addEventListener("resize",fit);window.addEventListener("blur",function(){cancelStroke(true);hud();});document.addEventListener("visibilitychange",function(){if(document.hidden)pause();});window.addEventListener("pagehide",function(){away=true;pause();cancelAnimationFrame(raf);raf=0;});window.addEventListener("pageshow",function(){away=false;if(!raf){last=0;raf=requestAnimationFrame(frame);}hud();});}
  function frame(now){var dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(canPlay())power=Math.max(0,power-dt);hud();draw();raf=requestAnimationFrame(frame);}
  function earnPower(){power=POWER;active=true;paused=false;last=0;banner("A wide glowing path. Follow the stars!");hud();}
  function pause(){paused=true;last=0;cancelStroke(true);hud();}
  function reset(){cancelStroke(true);active=false;paused=false;won=false;stage=0;completed=0;next=1;power=0;failures=0;last=0;completedPatterns=[false,false,false,false,false];makeNodes();pen={x:nodes[0].x,y:nodes[0].y};banner("Let's draw a quiet little night sky");hud();draw();}
  window.Stars={init:function(a,n){api=a;stages=n||5;cv=$("starsCanvas");ctx=cv.getContext("2d");loadArt();controls();fit();reset();raf=requestAnimationFrame(frame);},onWord:function(index){cancelStroke(true);stage=index;next=1;makeNodes();pen={x:nodes[0].x,y:nodes[0].y};earnPower();api.instruct(STEP_LINES[stage]);},onHelp:earnPower,pause:pause,resume:function(playing){paused=playing===false;last=0;hud();},reset:reset,finale:function(){cancelStroke(true);active=false;power=0;won=true;banner("Five little pictures. Good night, stars!");hud();draw();}};
})();
