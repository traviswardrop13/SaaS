// Birthday Cake: each word said two times starts the next recipe step and
// nothing else; the finger stirs, pours, pipes, decorates and puts on the
// birthday buddy's candles. A new party every round (CAKE2): whose birthday,
// how many candles, the tray's fruit, the swirls and the icing colours.
// Plays the real page on a fake clock (page.clock), so every wait is on
// published state, never on real time.
// CAKE_PART=rebuild|main|struggle|help|keyboard|fit runs one part.
import path from 'node:path';
import {OUT} from './_env.mjs';
import {gameHarness,advance,until,sayWord} from './_sayplay-realgame.mjs';
let h,checks=0,failures=0;
function ok(n,p,d){checks++;if(!p)failures++;console.log((p?'PASS ':'FAIL ')+n+(p?'':' '+JSON.stringify(d)));}
const state=p=>p.evaluate(()=>({speech:window.__sayplay,cake:window.__cake}));
const UNKIND=/\b(miss(ed|es)?|wrong|fail(ed)?|score|points?|correct|lose|lost)\b/i;
async function at(p,q){const b=await p.locator('#cakeCanvas').boundingBox();return{x:b.x+q.x*b.width,y:b.y+q.y*b.height};}
async function move(p,q,steps=14){const t=await at(p,q);await p.mouse.move(t.x,t.y,{steps});}
async function hold(p,id='#cakeTool'){const b=await p.locator(id).boundingBox();if(!b)throw Error('No real control '+id);await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();}
// the step is counted after the celebration beat (about 1.15 s on the game's clock)
const finished=(p,stage)=>until(p,st=>__sayplay.step>st,4000,stage);
async function stir(p,{partial=false}={}){let s=(await state(p)).cake;await hold(p);const b=s.bowl;await move(p,{x:b.x+b.ringRadius,y:b.y});for(let circle=0;circle<(partial?1:12);circle++){for(let n=1;n<=32;n++){s=(await state(p)).cake;if(s.stage>0||s.completed>0)break;const a=n*Math.PI*2/32;await move(p,{x:b.x+Math.cos(a)*b.ringRadius,y:b.y+Math.sin(a)*b.ringRadius*s.width/s.height},3);}if((await state(p)).cake.completed>0)break;}await p.mouse.up();await advance(p,100);return partial?(await state(p)).speech.step>0:finished(p,0);}
// the jug is held where it was touched, so the spout follows the hand at that offset
async function moveSpout(p,q,steps=14){const s=(await state(p)).cake;await move(p,{x:q.x+s.grab.x,y:q.y+s.grab.y},steps);}
async function pour(p,{partial=false,miss=false}={}){let s=(await state(p)).cake;await hold(p);await moveSpout(p,{x:miss?.91:s.pan.x,y:s.pan.y-.22*s.width/s.height});for(let t=0;t<(partial?miss?1200:3500:9000);t+=80){await advance(p,80);s=(await state(p)).cake;if(s.completed>1||partial&&!miss&&s.pan.fill>.08)break;}await p.mouse.up();await advance(p,100);return partial?(await state(p)).speech.step>1:finished(p,1);}
async function ice(p,{one=false}={}){let s=(await state(p)).cake;await hold(p);for(let zone=0;zone<(one?1:s.icingZones.length);zone++){s=(await state(p)).cake;if(s.completed>2)break;await move(p,s.icingZones[zone]);for(let t=0;t<2200;t+=100){await advance(p,100);s=(await state(p)).cake;if(s.completed>2||s.icingZones[zone].progress>=1)break;}}await p.mouse.up();await advance(p,100);return one?(await state(p)).speech.step>2:finished(p,2);}
function fruitPoint(s,n){const c=s.cakeTop,uv=[[-.68,.10],[-.23,-.22],[.23,.22],[.68,-.10]][n];return{x:c.x+uv[0]*c.rx,y:c.y+uv[1]*c.ry*s.width/s.height};}
async function drag(p,id,target){await hold(p,id);await move(p,target,16);await p.mouse.up();await advance(p,100);}
async function fruit(p,n,{miss=false,background=false}={}){const s=(await state(p)).cake,index=n%3,target=miss?{x:.08,y:s.cakeTop.y}:fruitPoint(s,n);await hold(p,'#cakeFruit'+index);await move(p,target);if(background){await p.evaluate(()=>__quiet.background());await advance(p,350);await p.mouse.up();await p.evaluate(()=>__quiet.foreground());await p.locator('#resume').click();await advance(p,100);}else{await p.mouse.up();await advance(p,100);}return(await state(p)).cake.fruits.length>s.fruits.length;}
async function fruits(p){let s=(await state(p)).cake;for(let n=s.fruits.length;n<s.fruitGoal;n++)await fruit(p,n);return finished(p,3);}
// a candle comes from the one candle box, to the first shape still empty
async function candle(p,{miss=false}={}){const s=(await state(p)).cake,t=s.candleTargets.find(c=>!c.placed);await drag(p,'#cakeCandles',miss?{x:.08,y:s.cakeTop.y}:t);}
async function candles(p){for(let n=0;n<8;n++){const s=(await state(p)).cake;if(s.completed>4||s.candleTargets.every(t=>t.placed))break;await candle(p);}return finished(p,4);}
const actions=[stir,pour,ice,fruits,candles],part=process.env.CAKE_PART;
const STEP_LINES=['Stir the spoon','Hold the jug','Hold the icing bag','Drag four fruits','Drag the candles'];
const spoken=p=>p.evaluate(L=>__quiet.speech.map(x=>typeof x==='string'?x:(x&&(x.text||x.line))||'').filter(t=>L.some(l=>t.indexOf(l)>=0)),STEP_LINES);
const BUDDIES=['bunny','cat','lion','penguin','frog','bee','dino','dragon','octopus','panda','unicorn'],FRUITS=['strawberry','kiwi','grapes','apple','orange','peach','lemon','pineapple','watermelon'],ICES=['pink','blue','mint','lavender','vanilla'];
// a help ask that ends with no word: the same move, exactly where it was, no power
const kept=s=>JSON.stringify({step:s.speech.step,stage:s.cake.stage,completed:s.cake.completed,mix:s.cake.bowl.mix,tool:s.cake.tool,fill:s.cake.pan.fill,fruits:s.cake.fruits.length});
const sameMove=(s,was)=>s.speech.phase==='play'&&!s.speech.paused&&!s.speech.listening&&!s.cake.paused&&s.cake.active&&s.cake.power===0&&kept(s)===was;
try{
 h=await gameHarness('cake',8360);const fresh=(opts={})=>h.fresh({...opts,device:{age:'4',...opts.device}});
 if(!part||part==='rebuild'){
  // ── the rebuild (CAKE2): a new party every round, the word brings no
  //    power, the icing pots, the candle box, Echo once a visit ──
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();
  ok('two sayings start the first step',await sayWord(page));let s=await state(page);const p1=s.cake.party;
  ok('it is one buddy\'s birthday: 3, 4 or 5 years old, named on the banner',BUDDIES.includes(p1.buddy)&&p1.age>=3&&p1.age<=5&&p1.name.length>1&&(s.cake.banner==='Stir all the way around'),p1);
  ok('three different fruits of the nine on the tray, three different icing colours, one of four swirl patterns',p1.fruits.length===3&&new Set(p1.fruits).size===3&&p1.fruits.every(f=>FRUITS.includes(f))&&p1.ice.length===3&&new Set(p1.ice).size===3&&p1.ice.every(c=>ICES.includes(c))&&p1.pattern>=0&&p1.pattern<4,p1);
  ok('the birthday buddy\'s sitting picture and the party hat are loaded',await until(page,b=>__cake.loaded.indexOf('buddy-'+b)>=0&&__cake.loaded.indexOf('hat')>=0,4000,p1.buddy),(await state(page)).cake.loaded);
  ok('the word brings no cooking power',s.cake.power===0&&s.cake.stirGain===1,s.cake);
  ok('Echo explains stirring the first time',await until(page,()=>__quiet.speech.some(t=>/Stir the spoon/.test(t)),6000),await spoken(page));
  ok('the batter stirs',await stir(page));
  ok('the pouring word',await sayWord(page));s=await state(page);ok('the pouring word brings no power: the tin catches only its own width',s.cake.power===0&&Math.abs(s.cake.pourCatch-s.cake.pan.rx)<1e-9,{power:s.cake.power,catch:s.cake.pourCatch,rx:s.cake.pan.rx});ok('the batter pours',await pour(page));
  ok('the icing word',await sayWord(page));s=await state(page);
  ok('the icing word brings no power: the tip is its own size',s.cake.power===0&&Math.abs(s.cake.icingTip-.025)<1e-9,s.cake);
  const pots=await Promise.all([0,1,2].map(n=>page.locator('#cakeIce'+n).boundingBox()));
  ok('three icing pots on the tray, each a big enough button, the first one picked',pots.every(b=>b&&b.width>=44&&b.height>=44)&&s.cake.iceColor===p1.ice[0]&&await page.locator('#cakeIce0').getAttribute('aria-pressed')==='true',{pots,ice:s.cake.iceColor});
  await ice(page,{one:true});s=await state(page);const first=s.cake.icingZones.findIndex(z=>z.progress>=1);ok('a swirl piped with the first pot is that colour',first>=0&&s.cake.icingZones[first].color===p1.ice[0],s.cake.icingZones);
  await page.locator('#cakeIce2').click();await advance(page,100);s=await state(page);ok('a tap on another pot fills the bag with that colour',s.cake.iceColor===p1.ice[2]&&await page.locator('#cakeIce2').getAttribute('aria-pressed')==='true'&&await page.locator('#cakeIce0').getAttribute('aria-pressed')==='false',s.cake.iceColor);
  ok('the rest of the swirls pipe',await ice(page));s=await state(page);const cols=s.cake.icingZones.map(z=>z.color);ok('the finished first swirl kept its colour, the rest are the new one',cols[first]===p1.ice[0]&&cols.filter((c,n)=>n!==first).every(c=>c===p1.ice[2]),cols);
  ok('the fruit word',await sayWord(page));s=await state(page);ok('the pots are gone and the tray holds this party\'s fruit',await page.locator('#cakeIce0').isHidden()&&JSON.stringify(s.cake.fruitTray.map(f=>f.type))===JSON.stringify(p1.fruits),s.cake.fruitTray);
  ok('four fruits go on',await fruits(page));
  ok('the candle word',await sayWord(page));s=await state(page);ok('one shape for each year, and the candle box',s.cake.candleTargets.length===p1.age&&s.cake.candleBox.total===p1.age&&await page.locator('#cakeCandles').isVisible(),s.cake.candleBox);
  await page.locator('#cakeCandles').focus();await page.keyboard.press('Space');s=await state(page);ok('Space on the candle box picks up a candle',s.cake.draft&&s.cake.draft.kind==='candle',s.cake.draft);await page.keyboard.press('Escape');s=await state(page);ok('…and Escape puts it back',!s.cake.draft&&s.cake.candleBox.placed===0,s.cake);
  ok('the candles go on, and the party is done',await candles(page));await advance(page,3300);s=await state(page);
  ok('the birthday buddy blew the candles out, and the end card names them',s.speech.phase==='end'&&s.cake.candleTargets.every(t=>t.flame.heat===0)&&await page.locator('#endTitle').textContent()==='Happy birthday, '+p1.name+'!',{end:await page.locator('#endTitle').textContent(),p1});
  let lines=await spoken(page);ok('a whole cake: Echo explained each step once',lines.length===5&&STEP_LINES.every((l,n)=>lines[n].indexOf(l)>=0),lines);
  await page.locator('#again').click();await advance(page,350);s=await state(page);const p2=s.cake.party;
  ok('Play again is a new party: another buddy, another fruit tray, another swirl pattern',p2.buddy!==p1.buddy&&p2.fruits.slice().sort().join()!==p1.fruits.slice().sort().join()&&p2.pattern!==p1.pattern,{p1,p2});
  for(let st=0;st<5;st++){if(!await sayWord(page))throw Error('again word '+st);s=await state(page);if(s.cake.power!==0)throw Error('again power '+st);if(!await actions[st](page))throw Error('again step '+st);}
  await advance(page,3300);lines=await spoken(page);ok('Play again: Echo kept quiet, and the end card names the new buddy',lines.length===5&&await page.locator('#endTitle').textContent()==='Happy birthday, '+p2.name+'!',{lines,end:await page.locator('#endTitle').textContent()});
  // "Hear what to do" still says the step's line on a tap
  await page.locator('#again').click();await advance(page,350);await sayWord(page);await page.locator('#cakeHearStep').click();await until(page,()=>__quiet.speech.filter(t=>/Stir the spoon/.test(t)).length>=2,6000);
  ok('"Hear what to do" says the step\'s line on a tap, also on a round Echo kept quiet',(await spoken(page)).length===6,await spoken(page));
  ok('the rebuild has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='main'){
  // ── (d) parked: a typed address goes home before any mic or sound ──
  {const {page,context}=await fresh({unpark:false});const home=await until(page,()=>/\/(today|activities)\.html/.test(location.pathname)&&!!document.getElementById('libraryMessage')&&/Birthday Cake is coming soon/.test(document.getElementById('libraryMessage').textContent),8000);
   ok('the parked kitchen goes back to Home, which says it is coming soon',home&&!page.url().includes('arcade-cake'),{url:page.url()});
   ok('…with no mic asked for and no sound played',await page.evaluate(()=>__quiet.requests===0&&__quiet.soundsBefore===0&&__quiet.sounds.length===0),await page.evaluate(()=>({r:__quiet.requests,b:__quiet.soundsBefore,s:__quiet.sounds.length})));await context.close();}
  const {page,context,errors}=await fresh();const real=await page.locator('#cakeCanvas').count();ok('Birthday Cake has a real recipe worktop',real===1);if(!real)throw Error('Cake is still a layer reveal scene');
  const words=await page.evaluate(()=>[...document.querySelectorAll('#startOvl p,#primer p')].map(e=>e.textContent).join(' | ')+' | '+document.getElementById('cakeCanvas').getAttribute('aria-label'));
  ok('the start card and the mic card say each word starts a step',/two times to start each cooking step/.test(words)&&/two times to bake/.test(words)&&!/little cooking help/.test(words),words);
  await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);await advance(page,1500);let s=await state(page);
  // ── (a) silence earns nothing ──
  ok('silence never cooks the cake',!s.cake.active&&s.cake.completed===0&&s.speech.step===0,s);
  ok('two sayings earn the first recipe activity',await sayWord(page));s=await state(page);ok('the word starts the stirring and nothing else: no cooking power',s.cake.active&&s.cake.power===0&&s.cake.stirGain===1,s.cake);await advance(page,1400);s=await state(page);ok('speech and idle time do not stir batter',s.cake.bowl.mix===0&&s.cake.completed===0&&s.cake.ladder.level===0,s);
  await hold(page);await advance(page,1000);await page.mouse.up();s=await state(page);ok('a still spoon cannot mix batter, and holding still is not effort',s.cake.bowl.mix===0&&s.cake.ladder.effort===0,s.cake.ladder);
  s=await state(page);await hold(page);for(let n=0;n<8;n++)await move(page,{x:s.cake.bowl.x+(n%2?-.3:.3)*s.cake.bowl.ringRadius,y:s.cake.bowl.y});await page.mouse.up();s=await state(page);ok('short straight wiggles cannot finish the stirring',s.cake.completed===0&&s.cake.bowl.mix<.2,s);
  await advance(page,11000);s=await state(page);const ordinaryGain=s.cake.stirGain,keep=s.cake.bowl.mix;await page.locator('#cakeHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('speech help preserves batter and the same recipe activity',s.cake.paused&&s.cake.bowl.mix===keep&&s.speech.step===0&&await page.locator('#helpBack').isVisible(),s);
  await page.evaluate(()=>__quiet.background());await advance(page,350);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await advance(page,100);s=await state(page);
  ok('backgrounding a help ask goes back to the same stirring, with no power',sameMove(s,kept(s))&&s.cake.bowl.mix===keep&&s.speech.step===0,s);
  await page.locator('#cakeHelp').click();await sayWord(page);s=await state(page);ok('speech gives stronger real stirring',s.cake.stirGain>ordinaryGain*1.3&&s.speech.step===0&&s.cake.power>0,s);
  ok('real circular stirring finishes the batter',await stir(page),await state(page));
  await sayWord(page);s=await state(page);ok('the next word does not fill the tin',s.cake.pan.fill===0&&s.cake.completed===1,s);await pour(page,{partial:true,miss:true});s=await state(page);ok('batter poured away from the tin does not fill it',s.cake.pan.fill===0&&s.cake.completed===1,s);await pour(page,{partial:true});s=await state(page);ok('arriving batter fills the tin gradually',s.cake.pan.fill>0&&s.cake.pan.fill<1&&s.cake.impacts>0&&s.cake.completed===1,s);await page.locator('#cakeHelp').evaluate(e=>e.addEventListener('click',()=>window.__cakeAtHelp=JSON.parse(JSON.stringify(__cake)),{capture:true,once:true}));await page.locator('#cakeHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);const kp=await page.evaluate(()=>__cakeAtHelp);ok('help retains the already caught batter and pouring aim',s.cake.paused&&s.cake.pan.fill===kp.pan.fill&&s.cake.tool.x===kp.tool.x&&s.cake.tool.y===kp.tool.y,s);await sayWord(page);await hold(page);await page.evaluate(()=>{window.__cakeAtBackground=JSON.parse(JSON.stringify(__cake));__quiet.background();});await advance(page,350);await page.mouse.up();await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();s=await state(page);const bp=await page.evaluate(()=>__cakeAtBackground);ok('an interrupted pour releases safely and preserves caught batter',!s.cake.held&&s.cake.pan.fill===bp.pan.fill&&s.cake.particles.length===0,s);ok('actual batter arrivals fill the tin and bake the cake',await pour(page),await state(page));
  await sayWord(page);await ice(page,{one:true});s=await state(page);ok('holding icing at one spot cannot frost the whole cake',s.cake.icingZones.some(z=>z.progress>=1)&&s.cake.icingZones.some(z=>z.progress<1)&&s.cake.completed===2,s);ok('moving the piping tip finishes every icing zone',await ice(page),await state(page));await sayWord(page);ok('a fruit dropped off the cake is returned',!await fruit(page,0,{miss:true})&&(await state(page)).cake.fruits.length===0);ok('a real drop adds the chosen fruit',await fruit(page,0));s=await state(page);const savedFruit=JSON.stringify(s.cake.fruits);await page.locator('#cakeHelp').click();await sayWord(page);ok('help keeps the custom fruit already placed',JSON.stringify((await state(page)).cake.fruits)===savedFruit);await fruit(page,1,{background:true});s=await state(page);ok('an interrupted fruit drop cannot add a decoration',s.cake.fruits.length===1&&!s.cake.held&&s.speech.step===3,s);ok('four actual fruit placements decorate this cake',await fruits(page),await state(page));s=await state(page);ok('the cake keeps four freely chosen positions and different fruit types',s.cake.fruits.length===4&&new Set(s.cake.fruits.map(f=>f.type)).size===3,s.cake.fruits);await page.screenshot({path:path.join(OUT,'sona-cake-decorated.png')});
  await sayWord(page);s=await state(page);const xs=s.cake.candleTargets.map(t=>t.x),age=s.cake.party.age;ok('the candle shapes spread across the cake, not bunched on one side',xs.some(x=>x<s.cake.cakeTop.x-.05)&&xs.some(x=>x>s.cake.cakeTop.x+.05),xs);
  ok('one candle shape for each year of the birthday buddy\'s age, and one candle box',s.cake.candleTargets.length===age&&age>=3&&age<=5&&s.cake.candleBox.total===age&&await page.locator('#cakeCandles').isVisible()&&await page.locator('#cakeTool').isHidden(),{age,targets:s.cake.candleTargets.length,box:s.cake.candleBox});
  await candle(page,{miss:true});s=await state(page);ok('an off-cake candle cannot be placed',s.cake.candleTargets.every(t=>!t.placed)&&s.cake.candleBox.placed===0,s.cake.candleBox);
  await candle(page);s=await state(page);ok('a candle dragged from the box stands on a shape, lit at once',s.cake.candleTargets.filter(t=>t.placed).length===1&&s.cake.candleTargets.find(t=>t.placed).flame.heat===1&&s.cake.completed===4,s.cake.candleTargets);
  await advance(page,2300);s=await state(page);ok('waiting places no candle and finishes nothing',s.cake.candleTargets.filter(t=>t.placed).length===1&&s.speech.step===4,s);
  const colors=new Set();ok('the rest of the candles go on, one drag each, and that finishes the party',await candles(page),await state(page));s=await state(page);s.cake.candleTargets.forEach(t=>colors.add(t.color));ok('every candle on, each its own colour, none blown out by the child',s.cake.candleTargets.every(t=>t.placed)&&colors.size===age&&s.cake.ladder.misses===1,{targets:s.cake.candleTargets,misses:s.cake.ladder.misses});
  await advance(page,3300);s=await state(page);ok('five physical recipe activities finish one custom cake, one done a step',s.speech.phase==='end'&&s.speech.step===5&&s.cake.completed===5&&s.cake.won&&s.cake.dones===5,s);const audio=await page.evaluate(()=>({leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,lines:__quiet.speech}));ok('kitchen directions and sounds never enter the microphone',audio.leaks===0&&audio.live===0&&audio.overlap===0,audio);ok('the child hears that the word starts each step, how to stir and where the candles go, and never a fan',/two times to start each cooking step/i.test(audio.lines.join('|'))&&/stir/i.test(audio.lines.join('|'))&&/candles onto the cake/i.test(audio.lines.join('|'))&&!/fan|swipe/i.test(audio.lines.join('|')),audio.lines);
  s=await state(page);ok('the birthday buddy blew every candle out, and the end card says whose birthday it was',s.cake.blowing&&s.cake.candleTargets.every(t=>t.flame.heat===0)&&await page.locator('#endTitle').textContent()==='Happy birthday, '+s.cake.party.name+'!',{title:await page.locator('#endTitle').textContent(),party:s.cake.party,heat:s.cake.candleTargets.map(t=>t.flame.heat),paused:s.cake.paused,won:s.cake.won,blowing:s.cake.blowing,clock:s.cake.clock,phase:s.speech.phase,beat:s.cake.beat});await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-cake-finished.png')});await page.locator('#endOvl').evaluate(e=>e.style.visibility='');await page.locator('#again').click();await advance(page,350);s=await state(page);ok('replay resets the batter and all decorations',s.speech.step===0&&s.cake.completed===0&&!s.cake.active&&s.cake.bowl.mix===0&&s.cake.fruits.length===0&&s.cake.ladder.level===0&&!s.cake.beat,s);ok('no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (b) a child who keeps getting it not quite right finishes every step, with no help word ──
 if(!part||part==='struggle'){
  const {page,context,errors}=await fresh();const banners=new Set(),seen=async()=>{const s=await state(page);banners.add(s.cake.banner);return s;};
  await page.locator('#startBtn').click();await sayWord(page);await advance(page,11000);let s=await state(page),lv=0;
  // stirring with a 60 px wobble: the spoon slips off the ring again and again
  await hold(page);const b=s.cake.bowl;for(let n=0;n<700;n++){s=await seen();lv=Math.max(lv,s.cake.ladder.level);if(s.cake.completed>0)break;const a=n*Math.PI*2/24,R=b.ringRadius+(60/s.cake.width)*Math.sin(n*1.7);await move(page,{x:b.x+Math.cos(a)*R,y:b.y+Math.sin(a)*R*s.cake.width/s.cake.height},2);await advance(page,60);}await page.mouse.up();
  s=await state(page);ok('a wobbly stirrer finishes the batter with no help word, the ring widening',s.cake.completed===1&&lv>=1,{lv,l:s.cake.ladder,mix:s.cake.bowl.mix});
  ok('the step is counted after a celebration beat, not at once',s.cake.beat&&s.speech.step===0,{beat:s.cake.beat,step:s.speech.step});
  ok('…then counted once',await finished(page,0)&&(await state(page)).cake.dones===1);
  // the jug: picked up by its handle, then held off to the side of the tin
  await sayWord(page);await advance(page,11000);s=await state(page);const box=s.cake.jug.box,tool0=JSON.stringify(s.cake.tool),handle=await at(page,{x:box.x0+12/s.cake.width,y:(box.y0+box.y1)/2});await page.mouse.move(handle.x,handle.y);await page.mouse.down();await advance(page,50);s=await state(page);
  ok('a touch on the jug\'s handle picks it up, and the jug does not jump',s.cake.held&&JSON.stringify(s.cake.tool)===tool0,{held:s.cake.held,tool:s.cake.tool,tool0});
  await moveSpout(page,{x:.93,y:s.cake.pan.y-.2*s.cake.width/s.cake.height});lv=0;for(let t=0;t<20000;t+=200){await advance(page,200);s=await seen();lv=Math.max(lv,s.cake.ladder.level);if(s.cake.completed>1)break;}await page.mouse.up();
  ok('a jug held off to the side still fills the tin, the batter finding it',s.cake.completed===2&&lv>=2,{lv,l:s.cake.ladder,fill:s.cake.pan.fill});
  // a page hidden during the celebration beat holds the step, then counts it
  await page.evaluate(()=>__quiet.background());await advance(page,2500);s=await state(page);ok('a hidden page holds the beat',s.speech.step===1,s.speech);await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();ok('…and coming back counts the step',await finished(page,1));
  // piping 30 px under every swirl
  await sayWord(page);await advance(page,11000);s=await state(page);await hold(page);lv=0;for(let n=0;n<120;n++){s=await seen();lv=Math.max(lv,s.cake.ladder.level);if(s.cake.completed>2)break;const z=s.cake.icingZones.find(q=>q.progress<1);await move(page,{x:z.x,y:z.y+30/s.cake.height},4);await advance(page,250);}await page.mouse.up();
  ok('icing just under the swirls still pipes the cake',s.cake.completed===3&&lv>=2,{lv,l:s.cake.ladder});await finished(page,2);
  // fruit, with the ages 5-8 ladder: dropped far above the cake
  await sayWord(page);await advance(page,11000);await page.evaluate(()=>Cake.setLittle(false));const levels=[];for(let n=0;n<8;n++){s=await seen();if(s.cake.completed>3)break;const before=s.cake.fruits.length;await drag(page,'#cakeFruit'+(n%3),{x:.5,y:s.cake.cakeTop.y-.35*s.cake.width/s.cake.height});s=await seen();if(s.cake.fruits.length===before)levels.push(s.cake.ladder.level);}
  ok('ages 5-8: each fruit let go far off the cake makes it easier, 1, 2, 3, then almost anywhere works',JSON.stringify(levels)==='[1,2,3]'&&s.cake.completed===4,{levels,c:s.cake.completed});
  await page.evaluate(()=>Cake.setLittle(true));await finished(page,3);
  // candles dropped 20 px to the right of their shapes
  await sayWord(page);await advance(page,11000);const clv=[];for(let n=0;n<10;n++){s=await seen();if(s.cake.completed>4||s.cake.candleTargets.every(c=>c.placed))break;const t=s.cake.candleTargets.find(c=>!c.placed);await drag(page,'#cakeCandles',{x:t.x+20/s.cake.width,y:t.y});s=await seen();clv.push(s.cake.ladder.level);}
  ok('ages 3-4: a candle 20 px off goes back once, then the shapes catch every one',s.cake.candleTargets.every(c=>c.placed)&&clv[0]===2&&clv.length<=s.cake.party.age+1,{clv,age:s.cake.party.age});
  ok('…and the last candle finishes the party',await finished(page,4));
  await advance(page,3300);s=await state(page);ok('the struggling round ends on the win, with no help word',s.speech.phase==='end'&&s.cake.won&&s.cake.dones===5,s.speech);
  ok('every line the child saw is kind',[...banners].every(t=>!UNKIND.test(t)),[...banners]);
  ok('struggle has no runtime errors',errors.length===0,errors);await context.close();
 }
 // ── (c) help, then silence: the same move goes on, with no power ──
 if(!part||part==='help'){
  const {page,context,errors}=await fresh();await page.locator('#startBtn').click();await sayWord(page);await advance(page,11000);await stir(page,{partial:true});let s=await state(page);const was=kept(s);
  ok('a part-stirred bowl, the word power spent',s.cake.bowl.mix>0&&s.cake.bowl.mix<1&&s.cake.power===0,s.cake);
  await page.locator('#cakeHelp').click();await until(page,()=>__sayplay.listening);s=await state(page);ok('help asks for the word, with "Back to the game" on screen',s.cake.paused&&await page.locator('#helpBack').isVisible()&&s.cake.banner==='Say it for cooking help',s);
  await advance(page,13500);s=await state(page);ok('help, then 13 s of silence: the same stirring, no power, playing again',sameMove(s,was)&&!await page.locator('#cakeTool').isDisabled()&&!await page.locator('#helpBack').isVisible(),{s,was});
  await page.locator('#cakeHelp').click();await until(page,()=>__sayplay.listening);await page.locator('#helpBack').click();await advance(page,100);s=await state(page);
  ok('a tap on "Back to the game" does the same',sameMove(s,was)&&!await page.locator('#cakeTool').isDisabled(),{s,was});
  ok('…and the finger finishes that same stirring',await stir(page));ok('help has no runtime errors',errors.length===0,errors);await context.close();
 }
 if(!part||part==='keyboard'){
  const {page,context}=await fresh();await page.locator('#startBtn').click();await sayWord(page);await page.locator('#cakeTool').focus();await page.keyboard.press('Space');let s=await state(page);const before={...s.cake.tool};ok('keyboard picks up the real kitchen tool',s.cake.held,s);await page.keyboard.press('ArrowRight');s=await state(page);ok('keyboard physically moves the kitchen tool',s.cake.tool.x>before.x,s);await page.keyboard.press('Space');ok('keyboard release never skips cooking',!(await state(page)).cake.held&&(await state(page)).cake.completed===0);await context.close();
 }
 // ── (e) fit: play, a word turn and a help ask on four screens ──
 if(!part||part==='fit'){
  {const {page,context,errors}=await fresh({blockAssets:true});await page.locator('#startBtn').click();await sayWord(page);ok('missing paintings do not prevent real stirring',await stir(page));ok('fallback has no runtime errors',errors.length===0,errors);await context.close();}
  const rects=(p,ids)=>p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e?e.getBoundingClientRect():{x:0,y:0,right:0,bottom:0,width:0,height:0};return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,shown:!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'};}),ids);
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:768,height:1024}]){
   const tag=viewport.width+'x'+viewport.height,inside=r=>r.shown&&r.w>0&&r.x>=-.5&&r.y>=-.5&&r.right<=viewport.width+.5&&r.bottom<=viewport.height+.5,big=r=>r.w>=44&&r.h>=44;
   const {page,context,errors}=await fresh({viewport});await page.locator('#startBtn').click();await until(page,()=>__sayplay.listening);
   let r=await rects(page,['turnPanel','hear','word']);ok(tag+': the word turn fits, with a big enough Hear it',r.every(inside)&&big(r[1]),r);
   for(let stage=0;stage<5;stage++){if(!await sayWord(page))throw Error('Could not earn fitted recipe step '+stage);
    const fit=await page.evaluate(()=>{const controls=['cakeTool','cakeFruit0','cakeFruit1','cakeFruit2','cakeCandles','cakeIce0','cakeIce1','cakeIce2'].filter(id=>{const e=document.getElementById(id);return!e.hidden&&getComputedStyle(e).visibility!=='hidden';});const rects=['cakeHelp','cakeHearStep','cakeBanner',...controls].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,rects};});
    // the birthday buddy sits clear of every control and under the scene
    const bud=await page.evaluate(()=>{const c=document.getElementById('cakeCanvas').getBoundingClientRect(),b=__cake.buddy;return{x:c.x+b.x0*c.width,right:c.x+b.x1*c.width,y:c.y+b.y0*c.height,bottom:c.y+b.y1*c.height,floor:c.y+b.floor*c.height,h:(b.y1-b.y0)*c.height};});
    ok(tag+': the birthday buddy at step '+(stage+1)+' covers no control and sits under the cake',fit.rects.filter(r=>r.id!=='cakeBanner').every(r=>r.right<=bud.x||r.x>=bud.right||r.bottom<=bud.y||r.y>=bud.bottom)&&bud.y>=bud.floor-1&&bud.x>=0&&bud.h>=50,{bud,rects:fit.rects});
    ok(tag+': real kitchen controls fit step '+(stage+1),fit.scroll<=fit.height+1&&fit.sw<=fit.width+1&&fit.rects.every(r=>r.x>=0&&r.y>=0&&r.right<=fit.width&&r.bottom<=fit.height&&(r.id==='cakeBanner'||r.w>=44&&r.h>=44)),fit);
    if(stage===0){await page.locator('#cakeHelp').click();await until(page,()=>__sayplay.listening);r=await rects(page,['turnPanel','hear','helpBack','word']);ok(tag+': a help ask fits, with a big enough "Back to the game"',r.every(inside)&&big(r[1])&&r[2].h>=44&&r[2].w>=44,r);await page.locator('#helpBack').click();await advance(page,100);}
    ok(tag+': actual cooking completes fitted step '+(stage+1),await actions[stage](page),await state(page));}
   await advance(page,3300);await page.locator('#endOvl').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:path.join(OUT,'sona-cake-'+viewport.width+'.png')});ok(tag+': fit has no runtime errors',errors.length===0,errors);await context.close();
  }
 }
}catch(e){ok('test completes without a page or harness crash',false,e.stack);}finally{if(h)await h.close();}
console.log(checks+' checks; '+failures+' failures');process.exitCode=failures?1:0;
