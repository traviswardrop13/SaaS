/* Race Car: free steering, bends, overtaking, braking and a finish gate.
   SayPlay owns speech, permission, audio and reps. Its accepted words earn
   eight seconds of slower road; an optional pit stop resumes the SAME leg.
   No independent microphone or speech detector lives in this engine. */
(function () {
  "use strict";
  var api,cv,ctx,W=390,H=844,dpr=1,clock=0,raf=0,last=0,running=false,parked=false;
  var leg=0,total=8,distance=0,travel=0,car=0,target=0,steer=0,drag=null,braking=false;
  var slow=0,bump=0,objects=[],spawn=0,passed=0,hits=0,gate=false,finished=false,serial=0;
  var LEG=150,POWER=8,VIEW=100,readout=0,keys={left:false,right:false};
  var $=function(id){return document.getElementById(id);},art={};
  ["racecar-bg","racecar-car","racecar-cone","racecar-finish","star"].forEach(function(n){var i=new Image();i.onload=function(){draw();};i.src="/assets/crafted/game/"+n+".webp";art[n]=i;});
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function picture(n){var i=art[n];return i&&i.complete&&i.naturalWidth?i:null;}
  function size(){if(!cv)return;var r=cv.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function bend(z){return Math.sin((travel+z)/95)*Math.min(W*.095,45);}
  function project(x,z){var p=clamp(1-z/VIEW,0,1),q=p*p,horizon=H*.27;return{x:W/2+bend(z)*(1-p)+x*(W*.40*q+W*.025),y:horizon+(H*1.02-horizon)*q,s:Math.max(.06,p)};}
  function quad(a,b,c,d,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.fill();}
  function drawRoad(){
    var bg=picture("racecar-bg");
    if(bg){var sc=Math.max(W/bg.width,H/bg.height);ctx.drawImage(bg,(W-bg.width*sc)/2,0,bg.width*sc,bg.height*sc);}
    else{ctx.fillStyle="#b7e2ee";ctx.fillRect(0,0,W,H);ctx.fillStyle="#a7c99b";ctx.fillRect(0,H*.27,W,H*.73);}
    // Perspective strips carry gameplay motion over the painted landscape.
    // Their width is capped so every safe path is reachable on a small phone.
    for(var z=VIEW;z>0;z-=2){var z0=Math.max(0,z-2),a=project(-1,z),b=project(1,z),c=project(1,z0),d=project(-1,z0);quad(a,b,c,d,"#a3998c");
      if(bg){ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.clip();var y=((travel+z)%22)/22;ctx.drawImage(bg,bg.width*.55,bg.height*(.68+y*.06),bg.width*.04,bg.height*.015,Math.min(a.x,d.x)-1,a.y,Math.max(b.x,c.x)-Math.min(a.x,d.x)+2,c.y-a.y+1);ctx.restore();}
      [-1,1].forEach(function(side){quad(project(side,z),project(side*1.08,z),project(side*1.08,z0),project(side,z0),Math.floor((travel+z)/5)%2?"#fff5de":"#bd5752");});
      if(Math.floor((travel+z)/8)%2===0)[-.34,.34].forEach(function(x){quad(project(x-.008,z),project(x+.008,z),project(x+.008,z0),project(x-.008,z0),"#fff6df");});
    }
  }
  function sprite(n,x,y,w,h,alpha){var img=picture(n);if(!img)return false;ctx.save();ctx.globalAlpha=alpha==null?1:alpha;ctx.drawImage(img,x-w/2,y-h,w,h);ctx.restore();return true;}
  function drawObject(o){var p=project(o.x,o.z),w=(o.kind==="car"?W*.19:W*.11)*p.s,h=w*(o.kind==="car"?.74:1.16);ctx.save();
    if(o.kind==="car"){ctx.filter="hue-rotate(160deg) saturate(.7)";if(!sprite("racecar-car",p.x,p.y,w,h)){ctx.filter="none";ctx.fillStyle="#478eae";ctx.fillRect(p.x-w/2,p.y-h,w,h);ctx.fillStyle="#fff4dc";ctx.fillRect(p.x-w*.3,p.y-h*.8,w*.6,h*.3);}}
    else if(o.kind==="star"){if(!sprite("star",p.x,p.y,W*.095*p.s,W*.095*p.s)){ctx.fillStyle="#f3d46c";ctx.beginPath();for(var t=0;t<10;t++){var a=-Math.PI/2+t*Math.PI/5,r=W*.05*p.s*(t%2?.45:1);if(t)ctx.lineTo(p.x+Math.cos(a)*r,p.y-h*.5+Math.sin(a)*r);else ctx.moveTo(p.x+Math.cos(a)*r,p.y-h*.5+Math.sin(a)*r);}ctx.closePath();ctx.fill();}}
    else if(!sprite("racecar-cone",p.x,p.y,w,h)){ctx.fillStyle="#deb06f";ctx.beginPath();ctx.moveTo(p.x,p.y-h);ctx.lineTo(p.x+w/2,p.y);ctx.lineTo(p.x-w/2,p.y);ctx.fill();}
    ctx.restore();
  }
  function gateX(){return[-.58,.56,0,.56,-.58,0,-.58,0][leg%8];}
  function drawGate(){
    if(distance<LEG-58&&!gate&&!finished)return;
    var z=gate?19:Math.max(19,LEG-distance),p=project(gateX(),z),w=W*.30*p.s;
    ctx.save();ctx.globalAlpha=.75+.15*Math.sin(clock*4);ctx.strokeStyle="#fff9df";ctx.lineWidth=Math.max(3,6*p.s);ctx.shadowColor="#40c6cd";ctx.shadowBlur=15;ctx.beginPath();ctx.ellipse(p.x,p.y,w*.58,w*.16,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    if(leg===total-1)sprite("racecar-finish",W/2,p.y-W*.1*p.s,W*.8*p.s,W*.8*p.s*.38);
    else{ctx.fillStyle="#fff7e8";ctx.font="800 "+Math.max(12,23*p.s)+"px Nunito";ctx.textAlign="center";ctx.fillText("PIT STOP",p.x,p.y-w*.25);}
  }
  function drawCar(){var p=project(car,15),w=Math.min(130,W*.29),h=w*.74;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(steer*.07);if(bump>0)ctx.translate(Math.sin(clock*50)*Math.min(3,bump*4),0);
    ctx.fillStyle="rgba(55,40,24,.18)";ctx.beginPath();ctx.ellipse(0,-h*.1,w*.44,h*.17,0,0,Math.PI*2);ctx.fill();
    if(slow>0){ctx.strokeStyle="#88eee7";ctx.lineWidth=4;ctx.globalAlpha=.65;ctx.beginPath();ctx.ellipse(0,-h*.42,w*.56,h*.67,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    if(!sprite("racecar-car",0,0,w,h)){ctx.fillStyle="#d4655e";ctx.fillRect(-w/2,-h,w,h);}ctx.restore();
  }
  function draw(){if(!ctx||!W||!H)return;ctx.clearRect(0,0,W,H);drawRoad();objects.slice().sort(function(a,b){return b.z-a.z;}).forEach(drawObject);drawGate();drawCar();}
  function publish(){window.__racecar={running:running,paused:parked,leg:leg,legs:total,distance:distance,travel:travel,car:car,target:target,slow:slow,factor:slow>0?.48:1,braking:braking,hits:hits,passed:passed,gate:gate,gateX:gateX(),finished:finished,objects:objects.map(function(o){return{id:o.id,kind:o.kind,x:o.x,z:o.z};})};}
  function hud(){var pct=clamp((leg+distance/LEG)/total,0,1);$("raceProgressFill").style.width=(pct*100)+"%";$("raceDistance").textContent=finished?"Finished!":Math.round(pct*100)+"%";$("racePower").hidden=!(slow>0&&running);$("racePowerFill").style.width=(slow/POWER*100)+"%";$("raceHelp").disabled=!running||slow>POWER-2||finished;$("raceHint").textContent=braking?"Nice and steady":gate?"Steer into the glow":slow>0?"Slow road!":"Drag to steer";publish();}
  function addObjects(){var xs=[-.65,0,.65],i=(serial*2+leg)%3,x=xs[i],id=serial++,kind=serial%3===0?"car":"cone";objects.push({id:id,kind:kind,x:x,z:kind==="car"?55:70,hit:false});objects.push({id:serial++,kind:"star",x:xs[(i+1)%3],z:55,hit:false});}
  function tick(dt){
    if(!running||parked||finished)return;
    clock+=dt;slow=Math.max(0,slow-dt);bump=Math.max(0,bump-dt);
    if(keys.left||keys.right)target=clamp(target+((keys.right?1:0)-(keys.left?1:0))*dt*1.65,-.82,.82);
    steer=clamp((target-car)*8,-1,1);car+=(target-car)*Math.min(1,dt*9);
    var factor=(slow>0?.48:1)*(braking?.42:1)*(bump>0?.4:1),speed=(19+leg*.65)*factor;if(gate)speed=0;
    var delta=speed*dt;travel+=delta;distance=Math.min(LEG,distance+delta);spawn-=delta;
    if(spawn<=0&&distance<LEG-55){addObjects();spawn=30;}
    for(var i=objects.length-1;i>=0;i--){var o=objects[i];o.z-=delta*(o.kind==="car"?.75:1);
      if(o.z<19&&!o.hit){o.hit=true;if(Math.abs(o.x-car)<(o.kind==="star"?.25:.23)){
        if(o.kind==="star"){passed++;api.sfx("tap");}
        else{hits++;bump=.8;$("raceBanner").textContent="A little bump. Keep going!";objects=objects.filter(function(v){return v.z>22||v.id===o.id;});spawn=45;break;}
      }}if(o.z< -9)objects.splice(i,1);
    }
    if(distance>=LEG){gate=true;$("raceBanner").textContent=leg===total-1?"Drive through the finish!":"Steer into your pit stop";if(Math.abs(car-gateX())<.27)completeLeg();}
    readout+=dt;if(readout>.07){readout=0;hud();}
  }
  function frame(t){var dt=last?Math.min(.04,(t-last)/1000):0;last=t;tick(dt);draw();raf=window.requestAnimationFrame(frame);}
  function completeLeg(){if(!running||parked)return;running=false;braking=false;drag=null;keys.left=keys.right=false;gate=false;objects=[];slow=0;$("raceBanner").textContent=leg===total-1?"Finish line!":"Pit stop. Let's slow the road!";hud();api.done();}
  function controls(){
    cv.addEventListener("pointerdown",function(e){if(!running||parked)return;drag=e.pointerId;try{cv.setPointerCapture(drag);}catch(x){}move(e);});
    cv.addEventListener("pointermove",function(e){if(e.pointerId===drag&&running&&!parked)move(e);});
    function up(e){if(e.pointerId===drag)drag=null;}cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);cv.addEventListener("lostpointercapture",up);
    function move(e){var r=cv.getBoundingClientRect();target=clamp((e.clientX-r.left-W/2-bend(15)*.15)/(W*(.40*.85*.85+.025)),-.82,.82);}
    var brake=$("raceBrake");brake.addEventListener("pointerdown",function(e){if(!running)return;braking=true;try{brake.setPointerCapture(e.pointerId);}catch(x){}e.preventDefault();hud();});
    ["pointerup","pointercancel","lostpointercapture"].forEach(function(n){brake.addEventListener(n,function(){braking=false;hud();});});
    window.addEventListener("keydown",function(e){if(!running||parked)return;if(e.key==="ArrowLeft"||e.key==="a"){keys.left=true;e.preventDefault();}if(e.key==="ArrowRight"||e.key==="d"){keys.right=true;e.preventDefault();}if(e.key==="ArrowDown"||e.code==="Space"){braking=true;e.preventDefault();}});
    window.addEventListener("keyup",function(e){if(e.key==="ArrowLeft"||e.key==="a")keys.left=false;if(e.key==="ArrowRight"||e.key==="d")keys.right=false;if(e.key==="ArrowDown"||e.code==="Space")braking=false;});
    $("raceHelp").onclick=function(){if(running&&!parked&&slow<=POWER-2){$("raceBanner").textContent="Pit crew, ready!";api.practice();}};
    window.addEventListener("blur",function(){braking=false;keys.left=keys.right=false;drag=null;});window.addEventListener("resize",size);
    // A Back/Forward Cache return restores this exact engine, not a new one.
    // Keep the earned car and let SayPlay's visible Resume control own play.
    window.addEventListener("pagehide",function(){window.cancelAnimationFrame(raf);raf=0;parked=true;last=0;});
    window.addEventListener("pageshow",function(){if(!raf){last=0;raf=window.requestAnimationFrame(frame);}});
  }
  function power(){slow=POWER;$("raceBanner").textContent="Slow road! You've got this.";running=true;parked=false;last=0;hud();}
  function reset(){leg=0;distance=0;travel=0;car=target=0;slow=0;bump=0;objects=[];spawn=22;passed=hits=0;running=false;parked=false;finished=false;gate=false;serial=0;braking=false;drag=null;keys.left=keys.right=false;$("raceBanner").textContent="Your very own race day";hud();draw();}
  window.RaceCar={
    init:function(a,n){api=a;total=n;cv=$("raceCanvas");ctx=cv.getContext("2d");controls();size();reset();raf=window.requestAnimationFrame(frame);},
    onWord:function(i){leg=i;distance=0;objects=[];spawn=24;gate=false;power();},
    onHelp:function(){power();},pause:function(){parked=true;drag=null;braking=false;keys.left=keys.right=false;last=0;hud();},resume:function(driving){parked=driving===false;last=0;hud();},reset:reset,
    finale:function(){finished=true;running=false;objects=[];slow=0;$("raceBanner").textContent="You crossed the finish!";hud();draw();}
  };
})();
