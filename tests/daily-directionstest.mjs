// Regression for three real, fast task changes. The only synthetic change is
// the existing fake device's utterance duration; all progress uses real inputs.
import {dailyHarness,advance,until,sayWord} from './_daily-adventure.mjs';

let harness, checks=0, failures=0;
function ok(name,pass,detail){checks++;if(!pass){failures++;console.log('FAIL '+name+' '+JSON.stringify(detail??'').slice(0,2000));}}
function must(name,pass,detail){ok(name,pass,detail);if(!pass)throw new Error(name);}
const snapshot=page=>page.evaluate(()=>({speech:window.__sayplay,bakery:window.__dailyBakery,rail:window.__dailyTrainline,bridge:window.__dailyBridge,lines:__quiet.speech}));
const point=async(page,p)=>{const b=await page.locator('#dailyCanvas').boundingBox();return{x:b.x+p.x*b.width,y:b.y+p.y*b.height};};
const duration=(page,ms)=>page.evaluate(ms=>{__quiet.cfg.speechMs=ms;},ms);
const utteranceActive=page=>page.evaluate(()=>__quiet.speaking>0);
async function heard(page,text,max=12000){return until(page,text=>__quiet.speech.includes(text),max,text);}
async function idle(page){must('the preceding actual instruction finishes',await until(page,()=>__quiet.speaking===0,7000),await snapshot(page));}
async function boot(key){
  harness=await dailyHarness({key,port:8408});
  const r=await harness.fresh({device:{age:'3',speechMs:100}});
  must(key+' boots through the real host',await until(r.page,()=>window.__sayplay&&__sayplay.phase==='ready',3000),r.errors);
  await r.page.locator('#startBtn').click();
  must('two accepted sayings earn the first '+key+' objective',await sayWord(r.page),await snapshot(r.page));
  await idle(r.page);return r;
}
async function audit(page,label){
  const q=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,outcomes:Sona.outcomes()}));
  ok(label+' keeps every instruction outside the microphone and clinical data',q.leaks===0&&q.overlap===0&&q.live===0&&Object.keys(q.outcomes).length===0,q);
}
async function drag(page,selector,to){
  const b=await page.locator(selector).boundingBox(),p=await point(page,to);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await page.mouse.move(p.x,p.y,{steps:10});await page.mouse.up();
}

const JUG='Hold the jug over the bowl. Pour to the picture line. Let go, then tap the check.';
const MIX='Hold the spoon. Stir in circles around the bowl until the dough comes together.';
async function pour(page,{check=true}={}){
  let g=(await snapshot(page)).bakery,key=g.phase==='pourFlour'?'flour':'liquid';
  const target={x:g.bowl.x-(g.tool.spout.x-g.tool.x),y:g.bowl.y-.15*g.width/g.height};
  const b=await page.locator('#bakeryTool').boundingBox(),p=await point(page,target);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y);
  try{must('actual falling '+key+' reaches its recipe picture',await until(page,()=>{const g=__dailyBakery,b=g.batches[g.batch],k=g.phase==='pourFlour'?'flour':'liquid';return b[k]>=b[k+'Target']-g.amountBand*.5;},6500),await snapshot(page));}
  finally{await page.mouse.up();}
  await advance(page,700);g=(await snapshot(page)).bakery;
  if(g.batches[g.batch][key]>g.batches[g.batch][key+'Target']+g.amountBand)await page.locator('#bakeryLevel').click();
  if(check){await page.locator('#bakeryAction').click();must('the actual '+key+' portion passes its manual check',(await snapshot(page)).bakery.batches[g.batch][key+'Checked'],await snapshot(page));}
}
async function openMixBehindJug(page){
  await pour(page,{check:false});await idle(page);await duration(page,4500);
  await page.locator('#bakeryAction').click();
  must('flour check actually changes to the jug phase',(await snapshot(page)).bakery.phase==='pourLiquid');
  must('the real jug cue begins as a4500ms utterance',await heard(page,JUG,2000)&&await utteranceActive(page),await snapshot(page));
  // The running utterance already owns its4500ms timer. Subsequent cues can
  // use the normal fast device without extending the physical regression.
  await duration(page,100);await pour(page);
  must('liquid check reaches actual mixing while the jug line still speaks',(await snapshot(page)).bakery.phase==='mix'&&await utteranceActive(page),await snapshot(page));
}
async function bakeryDirections(){
  const {page,context,errors}=await boot('bakery');
  try{
    await openMixBehindJug(page);
    ok('the jug-to-spoon transition eventually narrates its essential new action',await heard(page,MIX,8000),await snapshot(page));
    ok('a direction alone does not stir or award the bakery objective',await page.evaluate(()=>__dailyBakery.batches[0].mix===0&&__sayplay.step===0&&Sona.weekReps(0)===2));
    await idle(page);await audit(page,'Bakery task change');ok('Bakery direction path has no runtime errors',errors.length===0,errors);
  }finally{await context.close();}
}
async function stir(page){
  const g=(await snapshot(page)).bakery,b=await page.locator('#bakeryTool').boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  try{for(let i=0;i<=96;i++){
    if((await snapshot(page)).bakery.phase!=='mix')break;
    const a=i/48*Math.PI*2,p=await point(page,{x:g.bowl.x+Math.cos(a)*g.bowl.ringRadius,y:g.bowl.y+Math.sin(a)*g.bowl.ringRadius*g.width/g.height});
    await page.mouse.move(p.x,p.y);await advance(page,8);
  }}finally{await page.mouse.up();}
}
async function bakeryCancellation(){
  const {page,context,errors}=await boot('bakery');
  try{
    await openMixBehindJug(page);
    const before=(await snapshot(page)).bakery,mark=await page.evaluate(()=>__quiet.speech.length);
    await page.evaluate(()=>__quiet.background());await advance(page,1500);
    const hidden=await snapshot(page);
    ok('backgrounding with a pending direction freezes the real bowl and keeps audio closed',hidden.bakery.paused&&hidden.bakery.batches[0].mix===before.batches[0].mix&&hidden.speech.step===0&&await page.evaluate(mark=>__quiet.live()===0&&__quiet.speaking===0&&__quiet.speech.length===mark,mark),hidden);
    await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();
    await duration(page,100);await stir(page);
    must('real circular stirring finishes the earned first job',await until(page,()=>__sayplay.step===1,5000),await snapshot(page));
    const later=await page.evaluate(()=>__quiet.speech.length);
    must('the next objective still requires real accepted speech',await sayWord(page),await snapshot(page));
    must('the next accepted turn starts actual round shaping',(await snapshot(page)).bakery.phase==='shapeRound',await snapshot(page));
    await advance(page,6500);
    const lines=await page.evaluate(mark=>__quiet.speech.slice(mark),later);
    ok('cancelled pending pour/mix cues never leak into the later word or shaping turn',!lines.includes(JUG)&&!lines.includes(MIX),lines);
    ok('background and cancellation add no extra practice or physical credit',await page.evaluate(()=>__sayplay.step===1&&Sona.weekReps(0)===4&&__dailyBakery.batches[0].buns.every(b=>!b.formed&&!b.onTray)));
    await audit(page,'Bakery background and next turn');ok('Bakery cancellation path has no runtime errors',errors.length===0,errors);
  }finally{await context.close();}
}

const TRACK='Turn the track to match. Drag it until both rail ends join their glowing circles.';
const BADGER='Back to the fork. Choose the cottage picture, drive, stop, then move Badger onto the platform.';
async function placeTrack(page){
  const p=(await snapshot(page)).rail.selectedPiece;must('a real rail piece is waiting',!!p);
  const turns=Math.round((p.targetAngle-p.angle)/15);
  for(let i=0;i<Math.abs(turns);i++)await page.locator(turns<0?'#trainlineRotateLeft':'#trainlineRotateRight').click();
  await drag(page,'#trainlineTrack',p.target);
  must('both real endpoints join for '+p.id,(await snapshot(page)).rail.pieces.find(q=>q.id===p.id).placed);
}
async function holdTrain(page,direction,predicate){
  const selector=direction>0?'#trainlineForward':'#trainlineBack';await page.locator(selector).focus();await page.keyboard.down('Space');
  let reached;try{reached=await until(page,predicate,24000);}finally{await page.keyboard.up('Space');await page.locator('#trainlineStop').click();}
  must('the manually driven train reaches its actual stop',reached,await snapshot(page));
}
async function trainDirections(){
  const {page,context,errors}=await boot('trainline');
  try{
    await placeTrack(page);await placeTrack(page);
    must('actual first rails finish their objective',await until(page,()=>__sayplay.step===1,3000),await snapshot(page));
    must('accepted speech earns the passenger leg',await sayWord(page),await snapshot(page));
    for(const id of ['squirrel','badger','ducks']){
      const g=(await snapshot(page)).rail;must(id+' may board only at the real station',g.passengers.find(p=>p.id===id).canBoard);
      await drag(page,'#trainlinePassenger-'+id,g.train.door);must(id+' is manually aboard',(await snapshot(page)).rail.passengers.find(p=>p.id===id).state==='aboard');
    }
    if((await snapshot(page)).rail.route!=='hill')await page.locator('#trainlineSwitch').click();
    await holdTrain(page,1,()=>__dailyTrainline.train.edge==='J_H'&&__dailyTrainline.train.fraction>.999);
    const hill=(await snapshot(page)).rail.stations.find(s=>s.id==='H');await drag(page,'#trainlinePassenger-squirrel',hill.platform);
    must('manual Squirrel delivery earns the next word',await until(page,()=>__sayplay.step===2,3000),await snapshot(page));
    const builtCues=await page.evaluate(text=>__quiet.speech.filter(t=>t===text).length,TRACK);
    must('real accepted speech opens the cottages construction',await sayWord(page),await snapshot(page));
    must('the new cottages instruction actually begins after its quiet barrier',await until(page,({text,count})=>__quiet.speech.filter(t=>t===text).length>count,2500,{text:TRACK,count:builtCues}),await snapshot(page));
    // An unmatched real drop starts a fresh correction immediately before
    // the child fixes the same piece; no restart or progress setter is used.
    await idle(page);
    await duration(page,4500);await drag(page,'#trainlineTrack',{x:.15,y:.5});
    const RETRY='Turn the track to match, then put both ends inside the glowing circles.';
    must('an actual unmatched rail drop starts the long retry',await heard(page,RETRY,2500)&&await utteranceActive(page),await snapshot(page));
    await duration(page,100);await placeTrack(page);
    must('the corrected cottage track immediately reaches the Badger task during its old cue',(await snapshot(page)).rail.phase==='deliver'&&(await snapshot(page)).rail.targetPassenger==='badger'&&await utteranceActive(page),await snapshot(page));
    ok('the new Badger driving and platform directions eventually speak',await heard(page,BADGER,8000),await snapshot(page));
    ok('spoken directions do not deliver Badger or advance speech progress',await page.evaluate(()=>__sayplay.step===2&&__dailyTrainline.passengers.find(p=>p.id==='badger').state==='aboard'&&Sona.weekReps(0)===6));
    await idle(page);await audit(page,'Trainline task change');ok('Trainline direction path has no runtime errors',errors.length===0,errors);
  }finally{await context.close();}
}

const CART='Hold arrows or drag along the dotted path. Stop at the green door, then tap the bell.';
function angle(a){while(a>Math.PI/2)a-=Math.PI;while(a<-Math.PI/2)a+=Math.PI;return a;}
function distance(g,a,b){return Math.hypot((a.x-b.x)*g.width,(a.y-b.y)*g.height);}
async function hookTo(page,target){
  const b=await page.locator('#bridgeHook').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();let reached=false;
  try{for(let t=0;t<8500;t+=100){const g=(await snapshot(page)).bridge;if(distance(g,g.crane.hook,target)<5&&Math.abs(g.crane.velocity)<.015){reached=true;break;}
    const aim={x:target.x-Math.sin(g.crane.theta)*g.crane.length*g.height/g.width,y:g.crane.boomY+(target.y-g.crane.boomY)/Math.cos(g.crane.theta)},p=await point(page,aim);
    await page.mouse.move(p.x,p.y);await advance(page,100);
  }}finally{await page.mouse.up();await page.locator('#bridgeStop').click();}
  must('the real winch reaches its physical destination',reached,{target,bridge:(await snapshot(page)).bridge});
}
async function turnWood(page,target){
  const g=(await snapshot(page)).bridge,n=Math.round(angle(target-g.crane.load.commandAngle)/(Math.PI/12));
  if(!n&&g.current.requiresTurn&&!g.crane.load.turns){await page.locator('#bridgeRotateRight').click();await page.locator('#bridgeRotateLeft').click();}
  else for(let i=0;i<Math.abs(n);i++)await page.locator(n>0?'#bridgeRotateRight':'#bridgeRotateLeft').click();
}
async function prepareWood(page){
  let g=(await snapshot(page)).bridge,p=g.current;must('the actual waiting wood has its required supports',!!p&&p.requires.every(id=>g.pieces.find(q=>q.id===id).placed),g);
  await hookTo(page,p.source);await page.locator('#bridgeLift').click();must('a real link attaches the waiting wood',(await snapshot(page)).bridge.crane.load?.id===p.id);
  await hookTo(page,{x:p.source.x,y:p.safeLiftY});await turnWood(page,p.target.angle);await hookTo(page,p.target);
  must('the actual raised and turned wood can be released',(await snapshot(page)).bridge.landing.canRelease,await snapshot(page));return p;
}
async function bridgeDirections(){
  const {page,context,errors}=await boot('bridge');
  try{
    for(let stage=0;stage<3;stage++){
      if(stage)must('accepted speech earns bridge stage '+stage,await sayWord(page),await snapshot(page));
      for(let n=0;n<3;n++){
        const g=(await snapshot(page)).bridge;if(!g.active)break;
        const p=await prepareWood(page);await page.locator('#bridgeLift').click();must('manual unlink installs '+p.id,(await snapshot(page)).bridge.placed.includes(p.id));
      }
      must('actual installed wood completes bridge stage '+stage,await until(page,n=>__sayplay.step>n,3000,stage),await snapshot(page));
    }
    must('accepted speech earns the final plank and cart objective',await sayWord(page),await snapshot(page));
    const p=await prepareWood(page);must('this is the real gap plank',p.id==='gap');await idle(page);
    for(let i=0;i<3;i++)await page.locator('#bridgeRotateRight').click();
    await duration(page,4500);await page.locator('#bridgeLift').click();
    must('an invalid actual wood release speaks its long correction',await until(page,()=>__quiet.speaking>0,2500)&&!(await snapshot(page)).bridge.placed.includes('gap'),await snapshot(page));
    await duration(page,100);for(let i=0;i<3;i++)await page.locator('#bridgeRotateLeft').click();
    must('the child corrects the real angle before unlinking',(await snapshot(page)).bridge.landing.canRelease,await snapshot(page));
    await page.locator('#bridgeLift').click();
    must('the installed gap starts the actual test cart while the prior cue is still speaking',(await snapshot(page)).bridge.phase==='cart'&&await utteranceActive(page),await snapshot(page));
    ok('the first cart path, stop and bell instructions eventually speak',await heard(page,CART,8000),await snapshot(page));
    ok('directions cannot move the cart or complete its objective',await page.evaluate(()=>__sayplay.step===3&&!__dailyBridge.testFinished&&__dailyBridge.cart.distance===0&&Sona.weekReps(0)===8));
    await idle(page);await audit(page,'Bridge task change');ok('Bridge direction path has no runtime errors',errors.length===0,errors);
  }finally{await context.close();}
}

for(const [name,test] of [['bakery',bakeryDirections],['bakery cancellation',bakeryCancellation],['trainline',trainDirections],['bridge',bridgeDirections]].filter(([name])=>!process.env.DAILY_DIRECTION_ONLY||name===process.env.DAILY_DIRECTION_ONLY)){
  try{await test();}catch(error){ok(name+' regression reaches its actual-input assertions',false,error.stack);}
  finally{if(harness){await harness.close();harness=null;}}
}
console.log('Daily directions: '+checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
