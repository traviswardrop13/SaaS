/* A hose toy: only physical airborne droplets wash a moving muddy patch.
   SayPlay owns words, narration, microphone turns and every repetition.

   Each word said two times starts the next muddy spot (and lends ten seconds
   of a steadier puppy and wider water). The finger does all the washing.

   EVERY SPOT WASHES CLEAN (CLAUDE.md, "Every ball ends in a basket"), and the
   help that gets it there never needs speech: the "Steady puppy" power is a
   bonus on top. Washing is a held task, so the ladder climbs with seconds of
   spraying that has not reached the mud (effort), never with waiting: a
   hose that is not held adds nothing. This is a game for ages 3-4, so the
   gentle ladder is the default (setLittle(false) gives the ages 5-8 one).
     ages 3-4: 2 s   level 1: the glow pulses, an arrow points from the
                     water to the spot, the puppy wiggles less, the spot
                     catches water a little wider;
               4 s   level 2: the puppy holds still, the spot catches about
                     2.5x wider and the water bends toward it;
               6 s   level 3: water held anywhere flies onto the spot.
     ages 5-8: the same at 4, 8 and 12 s.
   No help washes by itself: the hose must still be held, and no timer ever
   finishes a spot. The ladder starts again with each new word.

   The celebration beat (hoops.js): a clean spot chimes and the puppy hops,
   and the step is reported BEAT seconds later on a clock that runs only
   while the page is live, so a pause in between holds it. */
(function () {
  "use strict";
  var STEP_LINES = [
    "Touch the glowing muddy spot and hold to wash it.",
    "Touch the next glowing spot. Hold until the mud is gone.",
    "The puppy wiggles! Keep your finger on the glowing spot.",
    "Touch the glowing spot and hold for a gentle shower.",
    "Last muddy spot! Touch it and hold to finish the bath."
  ];
  // Banner lines: short and kind. Never "missed", "wrong", "fail", "score".
  var HINTS = ["Keep the water on the muddy glow", "So close! Follow the arrow", "Nearly! Hold the water on the glow", "Just keep holding the water!"];
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0, phase = 0, amp = 0.025, shakeTime = 2, active = false, paused = false, away = false, won = false, stage = 0, stages = 5, cleaned = 0, power = 0;
  var body = { x: 225, y: 400, w: 290, h: 350 }, top = 120, bottom = 670, nozzle = { x: 0.14, y: 0.75 }, aim = { x: 0.84, y: 0.70 }, mud = [], particles = [], splashes = [], art = {};
  var held = false, owner = null, surface = null, aimId = null, keyHeld = false, emission = 0, spawned = 0, impacts = 0, missed = 0, lastSound = -10;
  // the ladder (see the top of this file); little = a child aged 2 to 4
  var effort = 0, lastHit = -9, shownLevel = 0, little = true;
  // clock runs only while the page is live; doneAt is the celebration beat
  var clock = 0, doneAt = 0, doneFor = -1, dones = 0, hopT = 9;
  var PATCHES = [[0.14,0.335],[0.50,0.122],[0.869,0.341],[0.364,0.919],[0.637,0.919]], POWER = 10, SPEED = 2.3, GRAVITY = 0.55, EMISSION = 24, BEAT = 1.15, RUB = [4,8,12], RUB_LITTLE = [2,4,6];
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function live() { return !paused && !away && !won && !document.hidden; }
  function canPlay() { return active && live(); }
  function banner(text) { if ($("puppyBanner").textContent !== text) $("puppyBanner").textContent = text; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function ladder() { var t = little ? RUB_LITTLE : RUB; return effort >= t[2] ? 3 : effort >= t[1] ? 2 : effort >= t[0] ? 1 : 0; }
  function wiggleAmplitude() { var l = ladder(); return l >= 2 ? 0 : (power > 0 || l >= 1) ? 0.006 : 0.025; }
  function wiggleRate() { return (power > 0 || ladder() >= 1) ? 0.8 : 2.3; }
  function sprayRadius() { return power > 0 ? 0.016 : 0.0065; }
  function spread() { return power > 0 ? 0.022 : 0.008; }
  // how much wider than the painted mud the spot catches water (x its radius)
  function catchExtra() { var l = ladder(); return l >= 2 ? 1.5 : l >= 1 ? 0.6 : 0; }
  // how far the water bends from the finger toward the spot (0..1)
  function pull() { var l = ladder(); return l >= 3 ? 1 : l >= 2 ? 0.45 : 0; }
  function transform() {
    // the phase and the size ease, so a power or a ladder step never makes
    // the puppy jump; a pause freezes both
    var dx = Math.sin(phase) * body.w * amp, dy = Math.sin(phase * 1.4) * body.h * amp * 0.22, angle = Math.sin(phase * 0.8) * amp * 1.52;
    if (hopT < 0.9) dy -= Math.abs(Math.sin(hopT * 10.5)) * body.h * 0.035 * (1 - hopT / 0.9);
    if (won && shakeTime < 1.35) { var strength = Math.max(0, 1 - shakeTime / 1.35); dx = Math.sin(shakeTime * 43) * body.w * 0.025 * strength; angle = Math.sin(shakeTime * 39) * 0.05 * strength; }
    return { dx: dx, dy: dy, angle: angle, px: body.x, py: body.y + body.h * 0.22 };
  }
  function world(p) {
    var t = transform(), x = body.x - body.w / 2 + p.x * body.w - t.px, y = body.y - body.h / 2 + p.y * body.h - t.py, c = Math.cos(t.angle), s = Math.sin(t.angle);
    return { x: (t.px + t.dx + x * c - y * s) / W, y: (t.py + t.dy + x * s + y * c) / H, r: p.r * body.w / W };
  }
  function loadArt() {
    [["bg","puppy-bg.webp"],["body","puppy-body-clean-v1.webp"]].forEach(function (p) { var i = new Image(); i.onload = function () { if (p[0] === "body") fit(); else draw(); hud(); }; i.onerror = function () { hud(); }; i.src = "/assets/crafted/game/" + p[1]; art[p[0]] = i; });
  }
  function fit() {
    if (!cv) return; var rect = cv.getBoundingClientRect(), dpr = Math.min(2,window.devicePixelRatio || 1), nw = Math.max(1,rect.width), nh = Math.max(1,rect.height);
    // a new screen size lets go of the hose (the aim moved under the finger);
    // the painting arriving does not
    if (nw !== W || nh !== H) stopWater();
    W = nw; H = nh; cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
    top = $("puppyBanner").getBoundingClientRect().bottom - rect.top + 18; bottom = $("puppyHelp").getBoundingClientRect().top - rect.top - 12;
    var room = Math.max(90,bottom-top), i = image("body"), aspect = i ? i.naturalWidth/i.naturalHeight : 0.84, h = Math.min(W*0.96,room*0.86), w = h*aspect;
    if (w > W*0.82) { w = W*0.82; h = w/aspect; } body = { x: W*0.57, y: top+room*0.47, w:w, h:h }; nozzle = { x:0.13, y:(bottom-Math.min(20,W*0.045))/H };
    aim.x = clamp(aim.x,0.03,0.97); aim.y = clamp(aim.y,top/H,(bottom+10)/H); hud(); draw();
  }
  function makeMud() { mud = PATCHES.map(function (p) { return { x:p[0], y:p[1], r:0.06, wash:0, clean:false, hits:0 }; }); }
  function artReady() { return ["bg","body"].every(function (k) { var i = art[k]; return i && i.complete; }); }
  function snapshot() {
    var t = transform(), targets = mud.map(function (p,n) { var at = world(p); return { x:at.x,y:at.y,r:at.r,wash:p.wash,clean:p.clean,active:n===stage,hits:p.hits,localX:p.x,localY:p.y }; });
    window.__puppy = { active:active,paused:paused,stage:stage,stages:stages,cleaned:cleaned,won:won,power:power,body:{x:body.x/W,y:body.y/H,w:body.w/W,h:body.h/H},transform:{dx:t.dx/W,dy:t.dy/H,angle:t.angle,pivot:{x:t.px/W,y:t.py/H}},
      targets:targets,target:targets[stage],aim:{x:aim.x,y:aim.y},nozzle:{x:nozzle.x,y:nozzle.y},particles:particles.map(function (p) { return {x:p.x,y:p.y*W/H,vx:p.vx,vy:p.vy,r:p.r}; }),spawned:spawned,impacts:impacts,missed:missed,
      emissionRate:EMISSION,jetSpeed:SPEED,gravity:GRAVITY,sprayRadius:sprayRadius(),spread:spread(),wiggle:{amplitude:wiggleAmplitude(),rate:wiggleRate(),angle:t.angle,phase:phase},held:held,pointerId:owner,aimPointer:aimId,keyHeld:keyHeld,shakeTime:shakeTime,width:W,height:H,
      ladder:{level:ladder(),effort:effort,little:little,catchExtra:catchExtra(),pull:pull()},beat:doneAt>0,dones:dones,clock:clock,artReady:artReady(),banner:$("puppyBanner").textContent,
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
      if(n===stage&&active){
        // the glow is as wide as the spot really catches water, and pulses
        // once the ladder starts helping
        var lv=ladder(),glowR=p.r*body.w*(1+catchExtra())+6,beat=lv>=1?.5+.5*Math.sin(clock*5):0;ctx.save();ctx.translate(px,py);
        if(lv>=1){ctx.fillStyle="rgba(255,246,190,"+(.18+.16*beat)+")";ctx.beginPath();ctx.arc(0,0,glowR+4*beat,0,Math.PI*2);ctx.fill();}
        ctx.strokeStyle="#fff3b8";ctx.shadowColor="#fff6cb";ctx.shadowBlur=12+10*beat;ctx.lineWidth=3+2*beat;ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(0,0,glowR+4*beat,0,Math.PI*2);ctx.stroke();ctx.restore();}
    });ctx.restore();
  }
  // From the first ladder step, an arrow runs from where the water is aimed
  // to the glowing spot: exactly where to move the finger.
  function guide() {
    if(!canPlay()||ladder()<1||!mud[stage])return;var p=world(mud[stage]),tx=p.x*W,ty=p.y*H,ax=aim.x*W,ay=aim.y*H,dx=tx-ax,dy=ty-ay,d=Math.sqrt(dx*dx+dy*dy),stop=p.r*W*(1+catchExtra())+12;
    if(d<stop+24)return;var ux=dx/d,uy=dy/d,bob=Math.sin(clock*6)*4,ex=tx-ux*(stop+bob),ey=ty-uy*(stop+bob),sx=ax+ux*16,sy=ay+uy*16;
    ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="rgba(84,64,40,.35)";ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
    ctx.strokeStyle="#fff3b8";ctx.lineWidth=6;ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#fff3b8";ctx.strokeStyle="rgba(84,64,40,.45)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ex+ux*14,ey+uy*14);ctx.lineTo(ex-ux*6-uy*12,ey-uy*6+ux*12);ctx.lineTo(ex-ux*6+uy*12,ey-uy*6-ux*12);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function hose() {
    var nx=nozzle.x*W,ny=nozzle.y*H,angle=Math.atan2(aim.y*H-ny,aim.x*W-nx);ctx.save();ctx.strokeStyle="#347e87";ctx.lineWidth=Math.max(9,W*.025);ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-15,bottom+30);ctx.bezierCurveTo(W*.32,bottom+45,W*.01,ny+45,nx-Math.cos(angle)*20,ny-Math.sin(angle)*20);ctx.stroke();ctx.strokeStyle="#6bb1b3";ctx.lineWidth=3;ctx.stroke();ctx.translate(nx,ny);ctx.rotate(angle);var w=Math.max(26,W*.075);ctx.fillStyle="#6c969a";ctx.fillRect(-w,-w*.25,w*.76,w*.5);ctx.fillStyle="#c9b77d";ctx.fillRect(-w*.34,-w*.30,w*.34,w*.6);ctx.fillStyle="#e3e6de";ctx.fillRect(-3,-w*.32,5,w*.64);ctx.fillStyle="#6e9eaa";for(var n=-1;n<=1;n++){ctx.beginPath();ctx.arc(2,n*w*.18,1.3,0,Math.PI*2);ctx.fill();}ctx.restore();
    if(canPlay()){ctx.save();ctx.strokeStyle=held?"rgba(244,255,248,.88)":"rgba(64,139,149,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(aim.x*W,aim.y*H,Math.max(8,sprayRadius()*W*1.3),0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  function water() {
    particles.forEach(function(p){ctx.save();ctx.strokeStyle="rgba(171,224,239,.72)";ctx.lineWidth=p.r*W*1.5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo((p.x-p.vx*.012)*W,(p.y-p.vy*.012)*W);ctx.lineTo(p.x*W,p.y*W);ctx.stroke();ctx.fillStyle="rgba(237,254,255,.9)";ctx.beginPath();ctx.arc(p.x*W,p.y*W,Math.max(1,p.r*W*.45),0,Math.PI*2);ctx.fill();ctx.restore();});
    splashes.forEach(function(s){var life=1-s.age/.38;ctx.globalAlpha=life;ctx.strokeStyle="#d5f6f7";ctx.lineWidth=2;for(var n=0;n<3;n++){var a=-Math.PI+n*Math.PI*.5;ctx.beginPath();ctx.moveTo(s.x*W,s.y*H);ctx.lineTo(s.x*W+Math.cos(a)*s.age*30,s.y*H+Math.sin(a)*s.age*30);ctx.stroke();}});ctx.globalAlpha=1;
  }
  function draw(){if(!ctx)return;ctx.clearRect(0,0,W,H);background();puppy();guide();hose();water();}
  function point(event){var r=cv.getBoundingClientRect();return{x:(event.clientX-r.left)/W,y:(event.clientY-r.top)/H};}
  function setAim(p){aim.x=clamp(p.x,.025,.975);aim.y=clamp(p.y,top/H,(bottom+12)/H);}
  function startWater(){if(!canPlay())return;held=true;emission=0;if(time-lastSound>.8){api.sfx("tap");lastSound=time;}banner(HINTS[ladder()]);}
  function down(event){
    if(!canPlay()||keyHeld||event.button!==undefined&&event.button!==0)return;
    // holding the big Spray button, a second finger on the canvas aims
    if(owner!==null){if(surface===$("puppySpray")&&event.currentTarget===cv&&aimId===null&&event.pointerId!==owner){event.preventDefault();aimId=event.pointerId;setAim(point(event));try{cv.setPointerCapture(aimId);}catch(e){}hud();}return;}
    event.preventDefault();owner=event.pointerId;surface=event.currentTarget;
    // the Spray button aims at the glowing spot, never at itself
    if(surface===$("puppySpray"))setAim(world(mud[stage]));else setAim(point(event));
    startWater();try{surface.setPointerCapture(owner);}catch(e){}hud();
  }
  function move(event){if(!canPlay())return;if(event.pointerId===aimId){event.preventDefault();setAim(point(event));hud();return;}if(event.pointerId!==owner||aimId!==null)return;event.preventDefault();setAim(point(event));hud();}
  function release(event){if(event.pointerId===aimId&&event.pointerId!==owner){aimId=null;try{if(cv.hasPointerCapture(event.pointerId))cv.releasePointerCapture(event.pointerId);}catch(e){}return;}if(event.pointerId!==owner)return;event.preventDefault();if(event.type==="pointercancel"||event.type==="lostpointercapture"){stopWater();hud();return;}var id=owner,s=surface;owner=null;surface=null;held=false;emission=0;releaseAim();if(s)try{if(s.hasPointerCapture(id))s.releasePointerCapture(id);}catch(e){}hud();}
  function releaseAim(){var id=aimId;aimId=null;if(id!==null&&cv)try{if(cv.hasPointerCapture(id))cv.releasePointerCapture(id);}catch(e){}}
  function stopWater(){var id=owner,s=surface;owner=null;surface=null;held=false;keyHeld=false;emission=0;particles=[];splashes=[];releaseAim();if(id!==null&&s)try{if(s.hasPointerCapture(id))s.releasePointerCapture(id);}catch(e){}}
  function keyboard(event){if(!canPlay()||owner!==null)return;var key=event.key;if(key===" "||key==="Enter"){event.preventDefault();if(!event.repeat){keyHeld=true;startWater();}hud();return;}var step=event.shiftKey ? 0.015 : 0.055,dx=0,dy=0;if(key==="ArrowLeft")dx=-step;else if(key==="ArrowRight")dx=step;else if(key==="ArrowUp")dy=-step*W/H;else if(key==="ArrowDown")dy=step*W/H;else return;event.preventDefault();setAim({x:aim.x+dx,y:aim.y+dy});hud();draw();}
  function controls(){[cv,$("puppySpray")].forEach(function(b){b.addEventListener("pointerdown",down);b.addEventListener("pointermove",move);["pointerup","pointercancel","lostpointercapture"].forEach(function(name){b.addEventListener(name,release);});});$("puppySpray").addEventListener("keydown",keyboard);$("puppySpray").addEventListener("keyup",function(event){if(event.key!==" "&&event.key!=="Enter")return;event.preventDefault();keyHeld=false;held=false;emission=0;hud();});$("puppySpray").addEventListener("blur",function(){if(keyHeld){keyHeld=false;held=false;emission=0;hud();}});$("puppyHelp").onclick=function(){if(canPlay()&&!held)api.practice();};$("puppyHearStep").onclick=function(){if(canPlay()&&!held)api.instruct(STEP_LINES[stage]);};window.addEventListener("resize",fit);window.addEventListener("blur",function(){stopWater();hud();});document.addEventListener("visibilitychange",function(){if(document.hidden)pause();});window.addEventListener("pagehide",function(){away=true;pause();cancelAnimationFrame(raf);raf=0;});window.addEventListener("pageshow",function(){away=false;if(!raf){last=0;raf=requestAnimationFrame(frame);}hud();});}
  function spawn(){
    var nx=nozzle.x,ny=nozzle.y*H/W,ax=aim.x,ay=aim.y*H/W,k=pull();
    // the ladder bends the water from the finger toward the spot
    if(k>0&&mud[stage]){var at=world(mud[stage]);ax+=(at.x-ax)*k;ay+=(at.y*H/W-ay)*k;}
    var dx=ax-nx,dy=ay-ny,distance=Math.sqrt(dx*dx+dy*dy),t=clamp(distance/SPEED,.08,.65),fan=Math.sin(spawned*2.399)*spread()*(k>=1?.3:1),length=Math.max(.01,distance);ax+=-dy/length*fan;ay+=dx/length*fan;particles.push({x:nx,y:ny,vx:(ax-nx)/t,vy:(ay-ny)/t-GRAVITY*t/2,r:sprayRadius(),age:0,life:t+.4});spawned++;
  }
  function contact(a,b,target,r){var dx=b.x-a.x,dy=b.y-a.y,tx=target.x,ty=target.y*H/W,length=dx*dx+dy*dy,t=length?clamp(((tx-a.x)*dx+(ty-a.y)*dy)/length,0,1):0;return Math.pow(a.x+dx*t-tx,2)+Math.pow(a.y+dy*t-ty,2)<=Math.pow(target.r+r,2);}
  // The spot is clean: the chime and a happy hop now, the step itself BEAT
  // seconds later (beat()), once, whatever happens in between.
  function complete(){if(doneAt||doneFor===stage)return;mud[stage].wash=1;mud[stage].clean=true;cleaned=stage+1;active=false;stopWater();api.sfx("correct");try{api.face("cheer");}catch(e){}hopT=0;banner(cleaned===stages?"A squeaky-clean little friend!":"That muddy patch is all clean!");doneFor=stage;doneAt=clock+BEAT;hud();draw();}
  function beat(){if(doneAt&&live()&&clock>=doneAt){doneAt=0;dones++;hud();if(api)api.done();}}
  function checkLevel(){var l=ladder();if(l!==shownLevel){shownLevel=l;if(l>0)banner(HINTS[l]);}}
  function tick(dt){
    if(live()){clock+=dt;if(hopT<9)hopT+=dt;}
    beat();
    if(!canPlay())return;time+=dt;power=Math.max(0,power-dt);
    amp+=(wiggleAmplitude()-amp)*Math.min(1,dt*3);phase+=dt*wiggleRate();
    if(held){emission+=dt;while(emission>=1/EMISSION){emission-=1/EMISSION;spawn();}
      // effort: seconds the hose is held while no water reaches the mud
      if(clock-lastHit>.35){effort+=dt;checkLevel();}}
    var target=world(mud[stage]);target.r*=1+catchExtra();
    for(var n=particles.length-1;n>=0;n--){var p=particles[n],before={x:p.x,y:p.y};p.x+=p.vx*dt;p.y+=p.vy*dt+GRAVITY*dt*dt/2;p.vy+=GRAVITY*dt;p.age+=dt;if(contact(before,p,target,p.r)){impacts++;lastHit=clock;mud[stage].hits++;mud[stage].wash=Math.min(1,mud[stage].wash+.035);splashes.push({x:p.x,y:p.y*W/H,age:0});particles.splice(n,1);if(mud[stage].wash>=1){complete();return;}}else if(p.age>p.life||p.x<-.1||p.x>1.1||p.y*W>H+30||p.y*W<top-30){particles.splice(n,1);missed++;}}
    splashes.forEach(function(s){s.age+=dt;});splashes=splashes.filter(function(s){return s.age<.38;});hud();
  }
  function frame(now){var dt=last?Math.min(.045,(now-last)/1000):0;last=now;if(won&&!paused&&!away&&!document.hidden)shakeTime+=dt;tick(dt);draw();if(!canPlay())snapshot();raf=requestAnimationFrame(frame);}
  function earnPower(text){power=POWER;active=true;paused=false;last=0;banner(text);hud();}
  function pause(){paused=true;last=0;stopWater();hud();}
  function reset(){stopWater();active=false;paused=false;won=false;stage=0;cleaned=0;power=0;time=0;phase=0;amp=.025;shakeTime=2;spawned=0;impacts=0;missed=0;lastSound=-10;last=0;effort=0;lastHit=-9;shownLevel=0;doneAt=0;doneFor=-1;hopT=9;makeMud();aim={x:.84,y:Math.min(.82,(bottom-10)/H)};banner("Say the word to wash a spot!");hud();draw();}
  window.Puppy={init:function(a,n){api=a;stages=n||5;cv=$("puppyCanvas");ctx=cv.getContext("2d");loadArt();controls();fit();reset();raf=requestAnimationFrame(frame);},
    onWord:function(index){stopWater();stage=index;effort=0;lastHit=-9;shownLevel=0;doneAt=0;doneFor=-1;earnPower("Touch the glowing spot and hold!");api.instruct(STEP_LINES[stage]);},
    onHelp:function(){earnPower("A steady puppy and a wider shower!");},
    pause:pause,
    // resume(true) after a help ask nobody answered, or a pause: the same
    // spot, its wash, the aim and the ladder exactly as they were
    resume:function(playing){paused=playing===false;last=0;hud();},
    reset:reset,setLittle:function(on){little=!!on;if(cv)hud();},
    finale:function(){stopWater();active=false;power=0;won=true;shakeTime=0;doneAt=0;banner("A clean puppy and a happy little shake!");hud();draw();}};
})();
