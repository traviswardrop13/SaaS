// Capability-free host for the byte-identical public/treasure.js motor engine.
// Canvas/image methods are inert; SwiftUI paints the typed snapshot locally.
(function(root){
  "use strict";
  var nodes={},handlers={},engine=null,arrivals=0,completions=0;
  function noop(){}
  function node(id){
    if(nodes[id])return nodes[id];
    var n={style:{},hidden:false,disabled:false,textContent:"",offsetHeight:32,
      getBoundingClientRect:function(){return{left:0,top:0,bottom:id==="top"?60:110,width:390,height:844};},
      addEventListener:function(name,fn){if(id==="seaCanvas")handlers[name]=fn;},setPointerCapture:noop};
    if(id==="seaCanvas")n.getContext=function(){return context;};
    nodes[id]=n;return n;
  }
  var context={setTransform:noop,clearRect:noop,fillRect:noop,beginPath:noop,ellipse:noop,fill:noop,
    setLineDash:noop,moveTo:noop,lineTo:noop,stroke:noop,save:noop,translate:noop,rotate:noop,
    drawImage:noop,restore:noop,arc:noop,fillText:noop,closePath:noop};
  root.window=root;root.document={getElementById:node};
  root.Image=function(){this.complete=false;this.naturalWidth=0;};
  root.getComputedStyle=function(){return{bottom:"12"};};
  root.requestAnimationFrame=function(){return 0;};root.cancelAnimationFrame=noop;
  root.addEventListener=noop;root.matchMedia=function(){return{matches:false};};root.devicePixelRatio=1;
  root.nativeTreasureAttach=function(value){engine=value;};
  function number(x){return typeof x==="number"&&isFinite(x);}
  function point(p){return p&&number(p.x)&&number(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;}
  function snapshot(){
    var s=engine.snapshot();s.arrivals=arrivals;s.completions=completions;return JSON.stringify(s);
  }
  root.nativeTreasureStart=function(raw){
    var p=JSON.parse(raw),seed=p.seed;
    if(!number(seed)||Math.floor(seed)!==seed||seed<1||seed>2147483646)throw new Error("Invalid voyage seed");
    Math.random=function(){seed=seed*16807%2147483647;return(seed-1)/2147483646;};
    root.Treasure.init({done:function(){completions++;},sfx:function(name){if(name==="correct")arrivals++;},
      cheer:noop,face:noop,instruct:noop,practice:noop},8);
    engine.size(p.unit);return snapshot();
  };
  root.nativeTreasureCommand=function(raw){
    var p=JSON.parse(raw),e,map;
    switch(p.action){
    case"word":if(!number(p.leg)||Math.floor(p.leg)!==p.leg||p.leg<0||p.leg>7)throw new Error("Invalid harbour");root.Treasure.onWord(p.leg);break;
    case"step":if(!number(p.seconds)||p.seconds<0||p.seconds>.04)throw new Error("Invalid frame");engine.step(p.seconds);break;
    case"size":if(!number(p.unit)||p.unit<1||p.unit>4096)throw new Error("Invalid map");engine.size(p.unit);break;
    case"down":case"move":case"up":
      if(!point(p.point))throw new Error("Invalid pointer");
      map=engine.snapshot().map;e={clientX:map.x+p.point.x*map.w,clientY:map.y+p.point.y*map.h,pointerId:1};
      handlers[p.action==="down"?"pointerdown":p.action==="move"?"pointermove":"pointerup"](e);break;
    case"cancel":handlers.pointercancel({pointerId:1});break;
    case"help":root.Treasure.onHelp();break;
    case"resetHarbour":nodes.seaReset.onclick();break;
    case"pause":root.Treasure.pause();break;
    case"resume":root.Treasure.resume(true);break;
    case"finale":root.Treasure.finale();break;
    default:throw new Error("Unknown motor command");
    }
    return snapshot();
  };
})(this);
