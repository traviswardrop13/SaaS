import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const moduleRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sourceRoot=process.argv[2]?path.resolve(process.argv[2]):path.resolve(moduleRoot,'../../../..');
const source=readFileSync(path.join(sourceRoot,'public/treasure.js'),'utf8');
const sha=createHash('sha256').update(source).digest('hex');
const marker='  window.Treasure={';
if(source.split(marker).length!==2)throw new Error('Canonical engine seam changed');
function reference(seed){
 const nodes={},listeners={};let arrivals=0,completions=0;
 const noop=()=>{},ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
 const node=id=>nodes[id]??=( {style:{},offsetHeight:32,getBoundingClientRect:()=>({left:0,top:0,bottom:id==='top'?60:110,width:390,height:844}),getContext:()=>ctx,addEventListener:(n,f)=>{if(id==='seaCanvas')listeners[n]=f},setPointerCapture:noop});
 const math=Object.create(Math);math.random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646};
 const box={Math:math,document:{getElementById:node},Image:function(){this.complete=false;this.naturalWidth=0},getComputedStyle:()=>({bottom:'12'}),requestAnimationFrame:()=>0,cancelAnimationFrame:noop,addEventListener:noop,matchMedia:()=>({matches:false}),devicePixelRatio:1};box.window=box;
 vm.createContext(box);
 const expose=`window.__reference={step:function(dt){tick(dt);draw();hud();},size:function(w){box={x:0,y:0,w:w,h:w*1.5,rotated:false};draw();hud();},snapshot:function(){draw();hud();var s=window.__treasure;s.trailPoints=trail.map(function(p){return p.slice();});s.wake=wake.slice();s.heading=heading;s.doneWait=doneWait;return s;}};\n`;
 vm.runInContext(source.replace(marker,expose+marker),box);
 box.Treasure.init({done:()=>completions++,sfx:n=>{if(n==='correct')arrivals++},cheer:noop,face:noop,instruct:noop,practice:noop},8);box.__reference.size(360);
 const snap=()=>JSON.parse(JSON.stringify({...box.__reference.snapshot(),arrivals,completions}));
 const perform=e=>{switch(e.action){case'word':box.Treasure.onWord(e.leg);break;case'help':box.Treasure.onHelp();break;case'pause':box.Treasure.pause();break;case'resume':box.Treasure.resume(true);break;case'resetHarbour':nodes.seaReset.onclick();break;case'cancel':listeners.pointercancel({pointerId:1});break;case'step':for(let i=0;i<e.count;i++)box.__reference.step(e.seconds);break;case'down':case'move':case'up':{const m=snap().map;listeners[e.action==='down'?'pointerdown':e.action==='move'?'pointermove':'pointerup']({pointerId:1,clientX:m.x+e.point.x*m.w,clientY:m.y+e.point.y*m.h});break;}default:throw Error(e.action);}return snap()};
 return{snap,perform,path:()=>JSON.parse(JSON.stringify(box.Treasure.pathFor(snap().boat,snap().goal)))};
}
const scenarios=[];
function scenario(name,seed,build){const r=reference(seed),events=[];const emit=e=>{const expected=r.perform(e);delete expected.trailPoints;delete expected.wake;events.push({...e,expected});return expected};const draw=pts=>{emit({action:'down',point:pts[0]});for(const p of pts.slice(1))emit({action:'move',point:p});return emit({action:'up',point:pts.at(-1)})};const sail=()=>{let s=r.snap(),n=0;while(s.completions<=s.leg&&n++<2500)s=emit({action:'step',seconds:.02,count:10});if(n>=2500)throw Error(name+' did not reach harbour')};build({r,emit,draw,sail});events.at(-1).expected.trailPoints=r.snap().trailPoints;scenarios.push({name,seed,unit:360,initial:reference(seed).snap(),events})}
scenario('idle_never_sails',49866,({emit})=>{emit({action:'word',leg:0});emit({action:'step',seconds:.02,count:200})});
scenario('real_island_collision_and_reset',49866,({r,emit,draw})=>{emit({action:'word',leg:0});draw([r.snap().boat,{x:.5,y:.79},{x:.32,y:.70}]);emit({action:'step',seconds:.02,count:500});emit({action:'resetHarbour'});emit({action:'step',seconds:.02,count:20})});
scenario('wrong_start_ladder_then_toward_line',49866,({r,emit,draw,sail})=>{emit({action:'word',leg:0});for(let i=0;i<3;i++)draw([{x:.1,y:.1},{x:.2,y:.18}]);const s=r.snap();draw([s.boat,{x:s.boat.x+(s.goal.x-s.boat.x)*.15,y:s.boat.y+(s.goal.y-s.boat.y)*.15}]);sail()});
scenario('help_pause_draft_cancel_and_harbour_delay',5,({r,emit,draw,sail})=>{emit({action:'word',leg:0});emit({action:'help'});emit({action:'down',point:r.snap().boat});emit({action:'move',point:{x:.6,y:.86}});emit({action:'cancel'});draw(r.path());emit({action:'step',seconds:.02,count:10});emit({action:'pause'});emit({action:'step',seconds:.02,count:100});emit({action:'resume'});let s=r.snap(),i=0;while(!s.celebrating&&i++<1000)s=emit({action:'step',seconds:.02,count:1});if(!s.celebrating)throw Error('No celebration');emit({action:'pause'});emit({action:'step',seconds:.02,count:100});emit({action:'resume'});sail()});
scenario('eight_real_sails',77,({r,emit,draw,sail})=>{for(let leg=0;leg<8;leg++){emit({action:'word',leg});emit({action:'help'});draw(r.path());sail()}});
const orders=[5,77,3001,424242,49866].map(seed=>({seed,order:reference(seed).snap().order}));
const target=path.join(moduleRoot,'Tools/treasure-motion/reference.json');writeFileSync(target,JSON.stringify({sourceSHA256:sha,orders,scenarios},null,2)+'\n');
console.log(JSON.stringify({sourceSHA256:sha,scenarios:scenarios.length,snapshots:scenarios.reduce((n,s)=>n+s.events.length+1,0),orders:orders.length,target}));
