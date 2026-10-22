// A real speech turn earns the move, story beats introduce its purpose,
// and only physically delivered water earns the final story painting.
import {dailyHarness,advance,until,sayWord} from './_daily-adventure.mjs';
let harness, checks=0, fails=0;
function ok(name,pass,detail){checks++;if(!pass){fails++;console.log('FAIL '+name+' '+JSON.stringify(detail).slice(0,1800));}}
function must(name,pass,detail){ok(name,pass,detail);if(!pass)throw new Error(name);}
const snapshot=p=>p.evaluate(()=>({story:window.__dailyNarration,play:window.__sayplay,water:window.__dailyWaterwheel}));
async function nextCard(page,mode){
  must('the earned '+mode+' card appears',await until(page,m=>window.__dailyNarration&&__dailyNarration.open&&__dailyNarration.mode===m,5000,mode),await snapshot(page));
  must('the existing audio owner finishes the story beat',await until(page,()=>!__dailyNarration.speaking,10000),await snapshot(page));
  const fit=await page.locator('#dailyStoryNext').boundingBox();
  ok('the story action is visible and at least44pixels',fit&&fit.width>=44&&fit.height>=44&&fit.y>=0&&fit.y+fit.height<=(await page.viewportSize()).height+1,fit);
  await page.locator('#dailyStoryNext').click();
}
async function placeRoute(page){
  const ids=await page.evaluate(()=>__dailyWaterwheel.pieces.filter(p=>!p.placed).map(p=>p.id));
  for(const id of ids){
    let p=await page.evaluate(id=>__dailyWaterwheel.pieces.find(p=>p.id===id),id);
    await page.locator('[data-trough="'+id+'"]').click();
    const difference=Math.atan2(Math.sin(p.target.angle-p.angle),Math.cos(p.target.angle-p.angle));
    for(let i=0;i<Math.abs(Math.round(difference/(Math.PI/8)));i++)await page.getByRole('button',{name:difference<0?'Turn selected trough left':'Turn selected trough right',exact:true}).click();
    p=await page.evaluate(id=>__dailyWaterwheel.pieces.find(p=>p.id===id),id);const box=await page.locator('#dailyCanvas').boundingBox();
    await page.mouse.move(box.x+p.x*box.width,box.y+p.y*box.height);await page.mouse.down();
    await page.mouse.move(box.x+p.target.x*box.width,box.y+p.target.y*box.height,{steps:8});await page.mouse.up();
    must('the child places the actual trough '+id,await page.evaluate(id=>__dailyWaterwheel.pieces.find(p=>p.id===id).placed,id));
  }
}
try{
  harness=await dailyHarness({key:'waterwheel',port:8396});
  // Phones retain Sona's portrait guard. Landscape play is checked on a
  // tablet, where the existing orientation rule actually permits the game.
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:1024,height:768}]){
    const {page,context,errors}=await harness.fresh({narration:true,viewport,device:{age:'4',speechMs:100}});
    await page.locator('#startBtn').click();must('real speech opens the story at '+viewport.width+'×'+viewport.height,await sayWord(page),errors);
    must('the spoken story finishes at '+viewport.width,await until(page,()=>__dailyNarration.open&&!__dailyNarration.speaking,15000),await snapshot(page));
    const spoken=await page.evaluate(()=>({lines:DailyAdventureStories[0].acts[0].narration,heard:__quiet.speech}));
    ok('the fallback receives every short story sentence separately at '+viewport.width,spoken.lines.every(line=>spoken.heard.includes(line)),spoken.heard);
    const fit=await page.evaluate(()=>{
      function box(id){var r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right};}
      return {next:box('dailyStoryNext'),replay:box('dailyStoryReplay'),title:box('dailyStoryTitle'),width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight};
    });
    ok('a nonreader can see the Continue and replay actions without scrolling at '+viewport.width,[fit.next,fit.replay].every(r=>r.w>=44&&r.h>=44&&r.x>=0&&r.right<=fit.width+1&&r.y>=0&&r.bottom<=fit.height+1),fit);
    ok('the story title and actions have separate visible space at '+viewport.width,fit.title.y>=0&&fit.title.bottom<=fit.next.y&&fit.scroll<=fit.height+1,fit);
    await page.screenshot({path:'/tmp/daily-narration-fit-'+viewport.width+'.png'});
    ok('the story card has no page errors at '+viewport.width,errors.length===0,errors);await context.close();
  }
  for(const age of process.env.NARRATION_FIT_ONLY==='1'?[]:['4','7']){
    const {page,context,errors}=await harness.fresh({narration:true,device:{age,speechMs:650}});
    must('the narration wrapper boots at age'+age,await until(page,()=>!!window.__dailyNarration&&!!window.__sayplay,2500),errors);
    ok('story presence never earns a move or a rep',await page.evaluate(()=>__sayplay.step===0&&!__dailyNarration.open&&__dailyWaterwheel.stage===-1&&Sona.weekReps(0)===0));
    await page.locator('#startBtn').click();must('only real voiced sayings open the first story beat',await sayWord(page),await snapshot(page));
    must('the first story card waits before physical play',await until(page,()=>__dailyNarration.open,3000),await snapshot(page));
    ok('the story does not auto-place troughs or advance a speech step',await page.evaluate(()=>!__dailyWaterwheel.active&&__dailyWaterwheel.pieces.length===0&&__sayplay.step===0&&Sona.weekReps(0)===2));
    await page.evaluate(()=>__quiet.background());await advance(page,1800);
    ok('backgrounding a story stops its voice and preserves its boundary',await page.evaluate(()=>__dailyNarration.paused&&__quiet.live()===0&&__quiet.speaking===0&&__sayplay.step===0));
    await page.evaluate(()=>__quiet.foreground());await page.locator('#resume').click();await nextCard(page,'act');
    ok('continuing starts the same earned physical objective',await page.evaluate(()=>__dailyWaterwheel.active&&__dailyWaterwheel.stage===0&&!__dailyNarration.open&&Sona.weekReps(0)===2));
    // A same-word help turn must not leave the wrapper paused and swallow
    // the physical completion callback after the real game resumes.
    await page.locator('#dailyHelp').click();must('speech help returns through the existing listener',await sayWord(page),await snapshot(page));
    await placeRoute(page);await page.locator('.waterwheel-gate').click();
    must('a completed real route still advances after help',await until(page,()=>__sayplay.step===1,12000),await snapshot(page));
    const total=age==='4'?5:8, acts=age==='4'?[1,3]:[2,6];
    for(let step=1;step<total;step++){
      must('the next word is actually spoken at stage'+step,await sayWord(page),await snapshot(page));
      if(acts.includes(step)){
        const state=await snapshot(page);ok('an act opens at the correct physical boundary',state.story.open&&state.story.stage===step&&!state.water.active,state);
        await nextCard(page,'act');
      }else ok('ordinary objectives have no extra story interruption',!(await snapshot(page)).story.open);
      await placeRoute(page);
      if(step===total-1)await page.locator('.waterwheel-share').click();
      await page.locator('.waterwheel-gate').click();
      if(step===total-1){
        must('only a real filled pond earns the ending',await until(page,()=>__dailyNarration.open&&__dailyNarration.mode==='ending',15000),await snapshot(page));
        const ending=await snapshot(page);ok('the ending cannot mark the engine finished on its own',ending.water.targets.pond.complete&&ending.water.targets.finalbed.complete&&ending.play.step===step&&ending.play.phase==='play'&&ending.story.physicalEndingEarned,ending);
        ok('the earned ending uses its actual resolution painting',await page.locator('#dailyStoryArt').getAttribute('src')==='/assets/crafted/daily/day04-waterwheel-ending-v1.webp');
        await nextCard(page,'ending');
      }else must('delivered water completes the physical objective',await until(page,n=>__sayplay.step>n,13000,step),await snapshot(page));
    }
    must('the completed story reaches the normal game ending',await until(page,()=>__sayplay.phase==='end',5000),await snapshot(page));
    const audit=await page.evaluate(()=>({lines:__quiet.speech,leaks:__quiet.leakFrames,live:__quiet.live(),overlap:__quiet.sounds.filter(s=>__quiet.mics.some(m=>s.start<(m.end==null?__quiet.now():m.end)&&m.asked<s.end)).length,reps:Sona.weekReps(0),outcomes:Sona.outcomes()}));
    ok('all three plot acts and the earned resolution are narrated',audit.lines.some(s=>s.includes('Gardener Mouse'))&&audit.lines.some(s=>s.includes('high garden channel'))&&audit.lines.some(s=>s.includes('butterfly'))&&audit.lines.some(s=>s.includes('Ducks paddle')),audit.lines);
    ok('narration adds no speech reps or clinical data',audit.reps===total*2+2&&Object.keys(audit.outcomes).length===0,audit);
    ok('story voice and game sounds never enter a microphone',audit.leaks===0&&audit.live===0&&audit.overlap===0,audit);
    await page.locator('#again').click();ok('replay clears story boundaries without giving a free route',await page.evaluate(()=>!__dailyNarration.open&&__dailyNarration.seen.length===0&&__dailyWaterwheel.stage===-1&&__sayplay.step===0));
    ok('the story playthrough has no page errors',errors.length===0,errors);await context.close();
  }
}catch(e){if(!fails)ok('the narration suite completes',false,e.stack);}
finally{if(harness)await harness.close();}
console.log('Daily narration: '+checks+' checks; '+fails+' failures');process.exitCode=fails?1:0;
