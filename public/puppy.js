/* A hose toy: only physical airborne droplets wash a moving muddy patch.
   SayPlay owns words, narration, microphone turns and every repetition. */
(function () {
  "use strict";
  var STEP_LINES = [
    "Touch the glowing muddy spot and hold to spray it clean.",
    "Aim the water at the next glowing spot. Hold until the mud washes away.",
    "Our puppy is wiggling! Keep the water on the glowing muddy spot.",
    "Find the next muddy patch and give it a gentle shower.",
    "One more muddy spot. Hold the water on it to finish our puppy's bath."
  ];
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0, shakeTime = 2, active = false, paused = false, away = false, won = false, stage = 0, stages = 5, cleaned = 0, power = 0;
  var body = { x: 225, y: 400, w: 290, h: 350 }, top = 120, bottom = 670, nozzle = { x: 0.14, y: 0.75 }, aim = { x: 0.84, y: 0.70 }, mud = [], particles = [], splashes = [], art = {};
  var held = false, owner = null, surface = null, keyHeld = false, emission = 0, spawned = 0, impacts = 0, missed = 0, lastSound = -10;
  var PATCHES = [[0.14,0.335],[0.50,0.122],[0.869,0.341],[0.364,0.919],[0.637,0.919]], POWER = 10, SPEED = 2.3, GRAVITY = 0.55, EMISSION = 24;
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function banner(text) { if ($("puppyBanner").textContent !== text) $("puppyBanner").textContent = text; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function wiggleAmplitude() { return power > 0 ? 0.006 : 0.025; }
  function wiggleRate() { return power > 0 ? 0.8 : 2.3; }
  function sprayRadius() { return power > 0 ? 0.016 : 0.0065; }
  function spread() { return power > 0 ? 0.022 : 0.008; }
  function transform() {
    var amount = wiggleAmplitude(), rate = wiggleRate(), dx = Math.sin(time * rate) * body.w * amount, dy = Math.sin(time * rate * 1.4) * body.h * amount * 0.22, angle = Math.sin(time * rate * 0.8) * (power > 0 ? 0.012 : 0.038);
    if (won && shakeTime < 1.35) { var strength = Math.max(0, 1 - shakeTime / 1.35); dx = Math.sin(shakeTime * 43) * body.w * 0.025 * strength; angle = Math.sin(shakeTime * 39) * 0.05 * strength; }
    return { dx: dx, dy: dy, angle: angle, px: body.x, py: body.y + body.h * 0.22 };
  }
  function world(p) {
    var t = transform(), x = body.x - body.w / 2 + p.x * body.w - t.px, y = body.y - body.h / 2 + p.y * body.h - t.py, c = Math.cos(t.angle), s = Math.sin(t.angle);
    return { x: (t.px + t.dx + x * c - y * s) / W, y: (t.py + t.dy + x * s + y * c) / H, r: p.r * body.w / W };
  }
  function loadArt() {
    [["bg","puppy-bg.webp"],["body","puppy-body-clean-v1.webp"]].forEach(function (p) { var i = new Image(); i.onload = function () { if (p[0] === "body") fit(); else draw(); }; i.src = "/assets/crafted/game/" + p[1]; art[p[0]] = i; });
  }
  function fit() {
    if (!cv) return; stopWater(); var rect = cv.getBoundingClientRect(), dpr = Math.min(2,window.devicePixelRatio || 1); W = Math.max(1,rect.width); H = Math.max(1,rect.height); cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
    top = $("puppyBanner").getBoundingClientRect().bottom - rect.top + 18; bottom = $("puppyHelp").getBoundingClientRect().top - rect.top - 12;
    var room = Math.max(90,bottom-top), i = image("body"), aspect = i ? i.naturalWidth/i.naturalHeight : 0.84, h = Math.min(W*0.96,room*0.86), w = h*aspect;
    if (w > W*0.82) { w = W*0.82; h = w/aspect; } body = { x: W*0.57, y: top+room*0.47, w:w, h:h }; nozzle = { x:0.13, y:(bottom-Math.min(20,W*0.045))/H };
    aim.x = clamp(aim.x,0.03,0.97); aim.y = clamp(aim.y,top/H,(bottom+10)/H); hud(); draw();
  }
  function makeMud() { mud = PATCHES.map(function (p) { return { x:p[0], y:p[1], r:0.06, wash:0, clean:false, hits:0 }; }); }
  function snapshot() {
    var t = transform(), targets = mud.map(function (p,n) { var at = world(p); return { x:at.x,y:at.y,r:at.r,wash:p.wash,clean:p.clean,active:n===stage,hits:p.hits,localX:p.x,localY:p.y }; });
    window.__puppy = { active:active,paused:paused,stage:stage,stages:stages,cleaned:cleaned,won:won,power:power,body:{x:body.x/W,y:body.y/H,w:body.w/W,h:body.h/H},transform:{dx:t.dx/W,dy:t.dy/H,angle:t.angle,pivot:{x:t.px/W,y:t.py/H}},
      targets:targets,target:targets[stage],aim:{x:aim.x,y:aim.y},nozzle:{x:nozzle.x,y:nozzle.y},particles:particles.map(function (p) { return {x:p.x,y:p.y*W/H,vx:p.vx,vy:p.vy,r:p.r}; }),spawned:spawned,impacts:impacts,missed:missed,
      emissionRate:EMISSION,jetSpeed:SPEED,gravity:GRAVITY,sprayRadius:sprayRadius(),spread:spread(),wiggle:{amplitude:wiggleAmplitude(),rate:wiggleRate(),angle:t.angle,phase:time},held:held,pointerId:owner,keyHeld:keyHeld,shakeTime:shakeTime,width:W,height:H,
      coordinates:"screen positions normalized to canvas; particle radius/velocity/gravity use canvas width; body and mud share the published rigid transform" };
  }
  function hud() {
    if (!cv) return; var enabled=canPlay(); $("puppySpray").disabled=!enabled; $("puppySpray").setAttribute("aria-pressed",held?"true":"false"); $("puppyHelp").disabled=!enabled||held; $("puppyHearStep").disabled=!enabled||held;
    $("puppyPower").hidden=power<=0; $("puppyPowerFill").style.width=power/POWER*100+"%"; $("puppyStatusText").textContent=held?"A gentle shower!":"Touch the muddy glow"; snapshot();
  }
  function background() {
    var i=image("bg"); if(i){var scale=Math.max(W/i.naturalWidth,H/i.naturalHeight),w=i.naturalWidth*scale,h=i.naturalHeight*scale;ctx.drawImage(i,(W-w)/2,(H-h)/2,w,h);}else{var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#cbe5ec");g.addColorStop(.55,"#e9ead2");g.addColorStop(1,"#b8ce9e");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
    ctx.fillStyle="rgba(114,166,178,.23)";ctx.beginPath();ctx.ellipse(body.x,body.y+body.h*.43,body.w*.45,body.w*.09,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="rgba(225,248,245,.7)";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(body.x+body.w*.08,body.y+body.h*.44,body.w*.34,body.w*.055,0,0,Math.PI*2);ctx.stroke();
  }
  function puppy() {
    var t=transform();ctx.save();ctx.translate(t.px+t.dx,t.py+t.dy);ctx.rotate(t.angle);var x=body.x-body.w/2-t.px,y=body.y-body.h/2-t.py,i=image("body");
    if(i)ctx.drawImage(i,x,y,body.w,body.h);else{
      ctx.fillStyle="#e2cba4";ctx.beginPath();ctx.ellipse(x+body.w*.5,y+body.h*.69,body.w*.24,body.h*.27,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f3e2be";ctx.beginPath();ctx.ellipse(x+body.w*.5,y+body.h*.285,body.w*.34,body.h*.22,0,0,Math.PI*2);ctx.fill();
      [-1,1].forEach(function(side){ctx.fillStyle="#c7aa7e";ctx.beginPath();ctx.ellipse(x+body.w*(.5+side*.35),y+body.h*.34,body.w*.14,body.h*.21,side*-.18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff8e7";ctx.beginPath();ctx.ellipse(x+body.w*(.5+side*.136),y+body.h*.919,body.w*.14,body.h*.07,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#39362f";ctx.beginPath();ctx.arc(x+body.w*(.5+side*.138),y+body.h*.245,body.w*.035,0,Math.PI*2);ctx.fill();});ctx.fillStyle="#55504a";ctx.beginPath();ctx.ellipse(x+body.w*.5,y+body.h*.305,body.w*.065,body.w*.04,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#7b6659";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+body.w*.5,y+body.h*.36,body.w*.075,.1,Math.PI-.1);ctx.stroke();ctx.fillStyle="#bb6971";ctx.beginPath();ctx.moveTo(x+body.w*.27,y+body.h*.49);ctx.lineTo(x+body.w*.73,y+body.h*.49);ctx.lineTo(x+body.w*.5,y+body.h*.63);ctx.closePath();ctx.fill();
    }
    mud.forEach(function(p,n){if(p.clean)return;var px=x+p.x*body.w,py=y+p.y*body.h,r=p.r*body.w*(1-p.wash*.35);ctx.save();ctx.translate(px,py);ctx.rotate(n*.7);ctx.globalAlpha=1-p.wash*.58;var shade=ctx.createRadialGradient(-r*.3,-r*.4,1,0,0,r);shade.addColorStop(0,"#ab8f66");shade.addColorStop(1,"#7f694c");ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(-r*.9,0);ctx.bezierCurveTo(-r*1.15,-r*.48,-r*.55,-r*.91,-r*.27,-r*.72);ctx.bezierCurveTo(r*.08,-r*1.05,r*.57,-r*.84,r*.63,-r*.5);ctx.bezierCurveTo(r*1.13,-r*.34,r*.98,r*.26,r*.71,r*.31);ctx.bezierCurveTo(r*.64,r*.95,r*.04,r*.86,-r*.16,r*.66);ctx.bezierCurveTo(-r*.78,r*.9,-r*1.08,r*.4,-r*.9,0);ctx.closePath();ctx.fill();for(var dot=0;dot<5;dot++){var a=dot*2.4;ctx.fillStyle="rgba(217,194,152,.48)";ctx.beginPath();ctx.arc(Math.cos(a)*r*.5,Math.sin(a)*r*.5,Math.max(1,r*.065),0,Math.PI*2);ctx.fill();}ctx.restore();
      if(n===stage&&active){ctx.save();ctx.translate(px,py);ctx.strokeStyle="#fff3b8";ctx.shadowColor="#fff6cb";ctx.shadowBlur=12;ctx.lineWidth=3;ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(0,0,p.r*body.w+6,0,Math.PI*2);ctx.stroke();ctx.restore();}
    });ctx.restore();
  }
  function hose() {
    var nx=nozzle.x*W,ny=nozzle.y*H,angle=Math.atan2(aim.y*H-ny,aim.x*W-nx);ctx.save();ctx.strokeStyle="#347e87";ctx.lineWidth=Math.max(9,W*.025);ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-15,bottom+30);ctx.bezierCurveTo(W*.32,bottom+45,W*.01,ny+45,nx-Math.cos(angle)*20,ny-Math.sin(angle)*20);ctx.stroke();ctx.strokeStyle="#6bb1b3";ctx.lineWidth=3;ctx.stroke();ctx.translate(nx,ny);ctx.rotate(angle);var w=Math.max(26,W*.075);ctx.fillStyle="#6c969a";ctx.fillRect(-w,-w*.25,w*.76,w*.5);ctx.fillStyle="#c9b77d";ctx.fillRect(-w*.34,-w*.30,w*.34,w*.6);ctx.fillStyle="#e3e6de";ctx.fillRect(-3,-w*.32,5,w*.64);ctx.fillStyle="#6e9eaa";for(var n=-1;n<=1;n++){ctx.beginPath();ctx.arc(2,n*w*.18,1.3,0,Math.PI*2);ctx.fill();}ctx.restore();
    if(canPlay()){ctx.save();ctx.strokeStyle=held?"rgba(244,255,248,.88)":"rgba(64,139,149,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(aim.x*W,aim.y*H,Math.max(8,sprayRadius()*W*1.3),0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  function water() {
    particles.forEach(function(p){ctx.save();ctx.strokeStyle="rgba(171,224,239,.72)";ctx.lineWidth=p.r*W*1.5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo((p.x-p.vx*.012)*W,(p.y-p.vy*.012)*W);ctx.lineTo(p.x*W,p.y*W);ctx.stroke();ctx.fillStyle="rgba(237,254,255,.9)";ctx.beginPath();ctx.arc(p.x*W,p.y*W,Math.max(1,p.r*W*.45),0,Math.PI*2);ctx.fill();ctx.restore();});
    splashes.forEach(function(s){var life=1-s.age/.38;ctx.globalAlpha=life;ctx.strokeStyle="#d5f6f7";ctx.lineWidth=2;for(var n=0;n<3;n++){var a=-Math.PI+n*Math.PI*.5;ctx.beginPath();ctx.moveTo(s.x*W,s.y*H);ctx.lineTo(s.x*W+Math.cos(a)*s.age*30,s.y*H+Math.sin(a)*s.age*30);ctx.stroke();}});ctx.globalAlpha=1;
  }
  function draw(){if(!ctx)return;ctx.clearRect(0,0,W,H);background();puppy();hose();water();}
  function point(event){var r=cv.getBoundingClientRect();return{x:(event.clientX-r.left)/W,y:(event.clientY-r.top)/H};}
  function setAim(p){aim.x=clamp(p.x,.025,.975);aim.y=clamp(p.y,top/H,(bottom+12)/H);}
  function startWater(){if(!canPlay())return;held=true;emission=0;if(time-lastSound>.8){api.sfx("tap");lastSound=time;}banner("Keep the water on the muddy glow");}
  function down(event){if(!canPlay()||owner!==null||keyHeld||event.button!==undefined&&event.button!==0)return;event.preventDefault();owner=event.pointerId;surface=event.currentTarget;setAim(point(event));startWater();try{surface.setPointerCapture(owner);}catch(e){}hud();}
  function move(event){if(event.pointerId!==owner||!canPlay())return;event.preventDefault();setAim(point(event));hud();}
  function release(event){if(event.pointerId!==owner)return;event.preventDefault();if(event.type==="pointercancel"||event.type==="lostpointercapture"){stopWater();hud();return;}var id=owner,s=surface;owner=null;surface=null;held=false;emission=0;if(s)try{if(s.hasPointerCapture(id))s.releasePointerCapture(id);}catch(e){}hud();}
  function stopWater(){var id=owner,s=surface;owner=null;surface=null;held=false;keyHeld=false;emission=0;particles=[];splashes=[];if(id!==null&&s)try{if(s.hasPointerCapture(id))s.releasePointerCapture(id);}catch(e){}}
  function keyboard(event){if(!canPlay()||owner!==null)return;var key=event.key;if(key===" "||key==="Enter"){event.preventDefault();if(!event.repeat){keyHeld=true;startWater();}hud();return;}var step=event.shiftKey ? 0.015 : 0.055,dx=0,dy=0;if(key==="ArrowLeft")dx=-step;else if(key==="ArrowRight")dx=step;else if(key==="ArrowUp")dy=-step*W/H;else if(key==="ArrowDown")dy=step*W/H;else return;event.preventDefault();setAim({x:aim.x+dx,y:aim.y+dy});hud();draw();}
  function controls(){[cv,$("puppySpray")].forEach(function(b){b.addEventListener("pointerdown",down);b.addEventListener("pointermove",move);["pointerup","pointercancel","lostpointercapture"].forEach(function(name){b.addEventListener(name,release);});});$("puppySpray").addEventListener("keydown",keyboard);$("puppySpray").addEventListener("keyup",function(event){if(event.key!==" "&&event.key!=="Enter")return;event.preventDefault();keyHeld=false;held=false;emission=0;hud();});$("puppySpray").addEventListener("blur",function(){if(keyHeld){keyHeld=false;held=false;emission=0;hud();}});$("puppyHelp").onclick=function(){if(canPlay()&&!held)api.practice();};$("puppyHearStep").onclick=function(){if(canPlay()&&!held)api.instruct(STEP_LINES[stage]);};window.addEventListener("resize",fit);window.addEventListener("blur",function(){stopWater();hud();});document.addEventListener("visibilitychange",function(){if(document.hidden)pause();});window.addEventListener("pagehide",function(){away=true;pause();cancelAnimationFrame(raf);raf=0;});window.addEventListener("pageshow",function(){away=false;if(!raf){last=0;raf=requestAnimationFrame(frame);}hud();});}
  function spawn(){var nx=nozzle.x,ny=nozzle.y*H/W,ax=aim.x,ay=aim.y*H/W,dx=ax-nx,dy=ay-ny,distance=Math.sqrt(dx*dx+dy*dy),t=clamp(distance/SPEED,.08,.65),fan=Math.sin(spawned*2.399)*spread(),length=Math.max(.01,distance);ax+=-dy/length*fan;ay+=dx/length*fan;particles.push({x:nx,y:ny,vx:(ax-nx)/t,vy:(ay-ny)/t-GRAVITY*t/2,r:sprayRadius(),age:0,life:t+.4});spawned++;}
  function contact(a,b,target,r){var dx=b.x-a.x,dy=b.y-a.y,tx=target.x,ty=target.y*H/W,length=dx*dx+dy*dy,t=length?clamp(((tx-a.x)*dx+(ty-a.y)*dy)/length,0,1):0;return Math.pow(a.x+dx*t-tx,2)+Math.pow(a.y+dy*t-ty,2)<=Math.pow(target.r+r,2);}
  function complete(){mud[stage].wash=1;mud[stage].clean=true;cleaned=stage+1;active=false;stopWater();api.sfx("correct");banner(cleaned===stages?"A squeaky-clean little friend!":"That muddy patch is all clean!");hud();draw();api.done();}
  function tick(dt){if(!canPlay())return;time+=dt;power=Math.max(0,power-dt);if(held){emission+=dt;while(emission>=1/EMISSION){emission-=1/EMISSION;spawn();}}var target=world(mud[stage]);for(var n=particles.length-1;n>=0;n--){var p=particles[n],before={x:p.x,y:p.y};p.x+=p.vx*dt;p.y+=p.vy*dt+GRAVITY*dt*dt/2;p.vy+=GRAVITY*dt;p.age+=dt;if(contact(before,p,target,p.r)){impacts++;mud[stage].hits++;mud[stage].wash=Math.min(1,mud[stage].wash+.035);splashes.push({x:p.x,y:p.y*W/H,age:0});particles.splice(n,1);if(mud[stage].wash>=1){complete();return;}}else if(p.age>p.life||p.x<-.1||p.x>1.1||p.y*W>H+30||p.y*W<top-30){particles.splice(n,1);missed++;}}splashes.forEach(function(s){s.age+=dt;});splashes=splashes.filter(function(s){return s.age<.38;});hud();}
  function frame(now){var dt=last?Math.min(.045,(now-last)/1000):0;last=now;if(won&&!paused&&!away&&!document.hidden)shakeTime+=dt;tick(dt);draw();raf=requestAnimationFrame(frame);}
  function earnPower(){power=POWER;active=true;paused=false;last=0;banner("A steady puppy and a wider shower!");hud();}
  function pause(){paused=true;last=0;stopWater();hud();}
  function reset(){stopWater();active=false;paused=false;won=false;stage=0;cleaned=0;power=0;time=0;shakeTime=2;spawned=0;impacts=0;missed=0;lastSound=-10;last=0;makeMud();aim={x:.84,y:Math.min(.82,(bottom-10)/H)};banner("Ready for a playful puppy bath?");hud();draw();}
  window.Puppy={init:function(a,n){api=a;stages=n||5;cv=$("puppyCanvas");ctx=cv.getContext("2d");loadArt();controls();fit();reset();raf=requestAnimationFrame(frame);},onWord:function(index){stopWater();stage=index;earnPower();api.instruct(STEP_LINES[stage]);},onHelp:earnPower,pause:pause,resume:function(playing){paused=playing===false;last=0;hud();},reset:reset,finale:function(){stopWater();active=false;power=0;won=true;shakeTime=0;banner("A clean puppy and a happy little shake!");hud();draw();}};
})();
