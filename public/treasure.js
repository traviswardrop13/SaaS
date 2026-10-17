/* Treasure Map is a route-drawing sailing puzzle. The child's finger plans
   a real route; the boat follows it around solid islands. Existing isolated
   words earn calm currents and a visible safe channel, never automatic moves.
   SayPlay alone owns the microphone, quiet audio and accepted play reps. */
(function(){
  "use strict";
  var api,cv,ctx,W=390,H=844,box={x:0,y:0,w:360,h:540},raf=0,last=0,t=0;
  var active=false,paused=false,leg=0,total=8,finished=false,boat={x:.70,y:.86},heading=0,hint=[];
  var route=[],at=0,draft=[],drag=null,calm=0,bumps=0,visit=0,wake=[],moving=false;
  var POWER=12,GOALS=[{x:.18,y:.83},{x:.16,y:.59},{x:.84,y:.63},{x:.84,y:.40},{x:.17,y:.47},{x:.17,y:.24},{x:.56,y:.29},{x:.84,y:.23}];
  var CHANNELS=[[[.43,.85]],[[.08,.81],[.08,.64]],[[.35,.61],[.65,.63]],[[.93,.61],[.93,.43]],[[.76,.41],[.56,.43]],[[.08,.47],[.08,.25]],[[.35,.25],[.46,.28]],[[.60,.28],[.81,.28]]];
  var ISLANDS=[{x:.35,y:.715,rx:.24,ry:.060},{x:.66,y:.51,rx:.21,ry:.065},{x:.32,y:.35,rx:.23,ry:.070},{x:.73,y:.17,rx:.22,ry:.065}];
  var $=function(id){return document.getElementById(id);},art={};
  [["map","treasure-map-play-v2.webp"],["boat","treasure-boat.webp"],["chest","treasure-chest.webp"]].forEach(function(p){var i=new Image();i.onload=function(){draw();};i.src="/assets/crafted/game/"+p[1];art[p[0]]=i;});
  function image(k){var i=art[k];return i&&i.complete&&i.naturalWidth?i:null;}
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function dist(a,b){var x=(a.x-b.x),y=(a.y-b.y)*1.5;return Math.sqrt(x*x+y*y);}
  function screen(p){return box.rotated?{x:box.x+p.y*box.w,y:box.y+(1-p.x)*box.h}:{x:box.x+p.x*box.w,y:box.y+p.y*box.h};}
  function point(e){var r=cv.getBoundingClientRect(),x=box.rotated?1-(e.clientY-r.top-box.y)/box.h:(e.clientX-r.left-box.x)/box.w,y=box.rotated?(e.clientX-r.left-box.x)/box.w:(e.clientY-r.top-box.y)/box.h;return{x:clamp(x,.065,.935),y:clamp(y,.065,.93)};}
  function land(p){return ISLANDS.some(function(i){var x=(p.x-i.x)/i.rx,y=(p.y-i.y)/i.ry;return x*x+y*y<1;});}
  function fit(){if(!cv)return;var r=cv.getBoundingClientRect();W=r.width;H=r.height;var wide=window.matchMedia("(orientation:landscape) and (max-height:500px)").matches,head=$("top").getBoundingClientRect().bottom,top=wide?head+8:Math.max(95,$("seaBanner").getBoundingClientRect().bottom+8),bottom=wide?12:Math.max(116,parseFloat(getComputedStyle($("seaControls")).bottom)+$("seaControls").offsetHeight+50),avail=Math.max(110,H-top-bottom),w=wide?Math.min(W-180,avail*1.5):Math.min(W-14,avail*2/3);box=wide?{x:8+(W-180-w)/2,y:top+(avail-w/1.5)/2,w:w,h:w/1.5,rotated:true}:{x:(W-w)/2,y:top+(avail-w*1.5)/2,w:w,h:w*1.5,rotated:false};var d=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(W*d);cv.height=Math.round(H*d);ctx.setTransform(d,0,0,d,0,0);draw();}
  function clearWater(a,b){var n=Math.max(2,Math.ceil(dist(a,b)/.008));for(var i=0;i<=n;i++)if(land({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;}
  function safeChannel(){
    // A shortest visible route around the actual coast, from wherever the
    // child is now. A fixed connector could send a mid-voyage help line
    // straight through an island. Recompute only at a stop or earned power.
    var nav=[];CHANNELS.forEach(function(c){c.forEach(function(p){nav.push({x:p[0],y:p[1]});});});GOALS.forEach(function(p){nav.push(p);});[.08,.93].forEach(function(x){[.1,.25,.43,.60,.81,.90].forEach(function(y){nav.push({x:x,y:y});});});
    var nodes=[{x:boat.x,y:boat.y},GOALS[leg]].concat(nav.filter(function(p){return !land(p);})),cost=[],prev=[],closed=[],n=nodes.length;
    for(var i=0;i<n;i++)cost[i]=Infinity;cost[0]=0;
    for(var count=0;count<n;count++){var u=-1;for(var j=0;j<n;j++)if(!closed[j]&&(u<0||cost[j]<cost[u]))u=j;if(u<0||!isFinite(cost[u]))break;if(u===1)break;closed[u]=true;
      for(var v=0;v<n;v++)if(!closed[v]&&v!==u&&clearWater(nodes[u],nodes[v])){var c=cost[u]+dist(nodes[u],nodes[v]);if(c<cost[v]){cost[v]=c;prev[v]=u;}}
    }
    hint=[];if(!isFinite(cost[1]))return;for(var at=1;at!=null;at=prev[at]){hint.unshift({x:nodes[at].x,y:nodes[at].y});if(at===0)break;}
  }
  function path(points,color,width,dash){if(!points.length)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash(dash||[]);ctx.beginPath();points.forEach(function(p,i){var s=screen(p);if(i)ctx.lineTo(s.x,s.y);else ctx.moveTo(s.x,s.y);});ctx.stroke();ctx.setLineDash([]);}
  function draw(){
    if(!ctx)return;ctx.clearRect(0,0,W,H);ctx.fillStyle="#f7ecd6";ctx.fillRect(0,0,W,H);
    var map=image("map");if(map){if(box.rotated){ctx.save();ctx.translate(box.x,box.y+box.h);ctx.rotate(-Math.PI/2);ctx.drawImage(map,0,0,box.h,box.w);ctx.restore();}else ctx.drawImage(map,box.x,box.y,box.w,box.h);}else{ctx.fillStyle="#8fcbd2";ctx.fillRect(box.x,box.y,box.w,box.h);ISLANDS.forEach(function(i){var p=screen(i);ctx.fillStyle="#e6d4a5";ctx.beginPath();ctx.ellipse(p.x,p.y,box.rotated?i.ry*box.w:i.rx*box.w,box.rotated?i.rx*box.h:i.ry*box.h,0,0,Math.PI*2);ctx.fill();});}
    var goal=screen(GOALS[leg]);
    // Calm reveals a route, not a conveyor belt: only a route the child
    // actually draws can move the boat. The hint never fills `route`.
    if(active&&calm>0)path(hint,"rgba(255,250,218,.92)",5,[3,10]);
    if(wake.length>1)path(wake,"rgba(255,255,255,.7)",2);
    if(route.length>at)path([boat].concat(route.slice(at)),"#226f7c",4,[6,5]);if(draft.length)path(draft,"#f8f4dc",5);
    if(!finished){ctx.save();ctx.strokeStyle="#fffbd8";ctx.lineWidth=4;ctx.shadowColor="#138b9a";ctx.shadowBlur=12;ctx.beginPath();ctx.ellipse(goal.x,goal.y,Math.max(13,box.w*.045),Math.max(9,box.w*.032),0,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.fillStyle="#5b2d05";ctx.font="800 17px 'Baloo 2',sans-serif";ctx.textAlign="center";ctx.fillText(leg===7?"X":String(leg+1),goal.x,goal.y-18);}
    var p=screen(boat),boatImage=image("boat"),w=Math.max(30,Math.min(box.w,box.h)*.13),h=w*1.13;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.sin(heading)*.13);ctx.fillStyle="rgba(21,103,118,.2)";ctx.beginPath();ctx.ellipse(0,6,w*.5,w*.15,0,0,Math.PI*2);ctx.fill();
    if(boatImage)ctx.drawImage(boatImage,-w/2,-h*.65,w,h);else{ctx.fillStyle="#8b5e36";ctx.beginPath();ctx.moveTo(-w/2,0);ctx.lineTo(w/2,0);ctx.lineTo(w*.25,w*.25);ctx.lineTo(-w*.25,w*.25);ctx.closePath();ctx.fill();ctx.fillStyle="#fff6e0";ctx.fillRect(-w*.1,-h*.5,w*.3,h*.5);}
    if(active&&!moving&&!drag){ctx.strokeStyle="#fff9dd";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,w*.7,0,Math.PI*2);ctx.stroke();}ctx.restore();
    if(finished){var chest=image("chest"),s=screen(GOALS[7]);if(chest)ctx.drawImage(chest,s.x-box.w*.13,s.y-box.w*.15,box.w*.26,box.w*.26);}
  }
  function publish(){window.__treasure={active:active,paused:paused,leg:leg,legs:total,boat:{x:boat.x,y:boat.y},goal:GOALS[leg],calm:calm,current:calm>0?0:.018,moving:moving,route:route.slice(at),draft:draft.slice(),bumps:bumps,finished:finished,map:{x:box.x,y:box.y,w:box.w,h:box.h,rotated:box.rotated},channel:hint.slice(1)};}
  function hud(){var power=$("seaPower");power.hidden=!(active&&calm>0);$("seaPowerFill").style.width=(calm/POWER*100)+"%";$("seaHelp").disabled=!active||paused||calm>POWER-2||finished;$("seaReset").disabled=!active||paused||finished;$("seaHint").textContent=finished?"Treasure found!":moving?(calm>0?"Calm seas":"A little current"):"Draw from your boat";publish();}
  function tick(dt){
    if(!active||paused||finished)return;t+=dt;calm=Math.max(0,calm-dt);
    if(moving&&route.length>at){var end=route[at],dx=end.x-boat.x,dy=end.y-boat.y,d=dist(boat,end),speed=.14,step=Math.min(1,speed*dt/Math.max(.001,d));
      var next={x:boat.x+dx*step+(calm>0?0:Math.sin(t*.8+leg)*.018*dt),y:boat.y+dy*step};next.x=clamp(next.x,.065,.935);next.y=clamp(next.y,.065,.93);heading=Math.atan2(dy,dx);
      if(land(next)){moving=false;route=[];at=0;bumps++;safeChannel();$("seaBanner").textContent="Let's go around the island";}
      else{boat=next;if(visit++%5===0){wake.push({x:boat.x,y:boat.y});if(wake.length>25)wake.shift();}if(d<.012){at++;if(at>=route.length){moving=false;route=[];at=0;safeChannel();}}}
      if(dist(boat,GOALS[leg])<.045){complete();}
    }
    hud();
  }
  function frame(ts){var dt=last?Math.min(.04,(ts-last)/1000):0;last=ts;tick(dt);draw();raf=requestAnimationFrame(frame);}
  function complete(){if(!active||paused)return;active=false;moving=false;route=[];draft=[];drag=null;calm=0;$("seaBanner").textContent=leg===7?"You found the treasure!":"A safe harbour!";hud();api.done();}
  function controls(){
    cv.addEventListener("pointerdown",function(e){if(!active||paused||finished||drag!==null)return;var p=point(e);if(dist(p,boat)>.12){$("seaBanner").textContent="Start your line at the boat";return;}drag=e.pointerId;try{cv.setPointerCapture(drag);}catch(x){}moving=false;route=[];draft=[{x:boat.x,y:boat.y}];hud();});
    cv.addEventListener("pointermove",function(e){if(e.pointerId!==drag||!active||paused)return;var p=point(e);if(dist(p,draft[draft.length-1])>.008)draft.push(p);publish();});
    cv.addEventListener("pointerup",function(e){if(e.pointerId!==drag)return;drag=null;if(!active||paused){draft=[];return;}if(draft.length>1&&dist(draft[0],draft[draft.length-1])>.02){route=draft.slice();at=1;moving=true;$("seaBanner").textContent="Off we sail!";}draft=[];hud();});
    function cancel(e){if(e&&e.pointerId!==drag)return;drag=null;draft=[];hud();}cv.addEventListener("pointercancel",cancel);cv.addEventListener("lostpointercapture",cancel);
    $("seaHelp").onclick=function(){if(active&&!paused&&calm<=POWER-2)api.practice();};
    $("seaReset").onclick=function(){if(!active||paused)return;boat=leg?{x:GOALS[leg-1].x,y:GOALS[leg-1].y}:{x:.70,y:.86};route=[];draft=[];at=0;moving=false;wake=[];safeChannel();$("seaBanner").textContent="A fresh route. Let's sail!";hud();};
    window.addEventListener("resize",fit);window.addEventListener("pagehide",function(){cancelAnimationFrame(raf);raf=0;paused=true;last=0;});window.addEventListener("pageshow",function(){if(!raf){last=0;raf=requestAnimationFrame(frame);}});
  }
  function power(){calm=POWER;paused=false;active=true;last=0;safeChannel();$("seaBanner").textContent="Calm seas. Follow the safe channel!";hud();}
  function reset(){active=false;paused=false;leg=0;boat={x:.70,y:.86};route=[];draft=[];at=0;drag=null;calm=0;bumps=0;visit=0;wake=[];hint=[];moving=false;finished=false;$("seaBanner").textContent="An ocean full of adventure";hud();draw();}
  window.Treasure={init:function(a,n){api=a;total=n;cv=$("seaCanvas");ctx=cv.getContext("2d");controls();fit();reset();raf=requestAnimationFrame(frame);},onWord:function(i){leg=i;route=[];draft=[];at=0;moving=false;wake=[];power();},onHelp:power,pause:function(){paused=true;drag=null;draft=[];last=0;hud();},resume:function(playing){paused=playing===false;last=0;hud();},reset:reset,finale:function(){finished=true;active=false;moving=false;calm=0;$("seaBanner").textContent="The treasure is yours!";hud();draw();}};
})();
