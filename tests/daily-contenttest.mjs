// The eleven-day expansion must be a complete, loadable set. A story record
// alone cannot stand in for its controller, artwork or earned resolution.
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const publicRoot=process.env.SONATEST_PUBLIC_ROOT||fileURLToPath(new URL('../public/',import.meta.url));
let checks=0,fails=0;
function ok(name,pass,detail){checks++;if(!pass){fails++;console.log('FAIL '+name+(detail?' '+String(detail):''));}}
function source(relative){return readFileSync(path.join(publicRoot,relative),'utf8');}
function script(relative,context){const program=new vm.Script(source(relative),{filename:relative});program.runInNewContext(context);}
function asset(url){
  if(typeof url!=='string'||!/^\/assets\/crafted\/daily\/[a-z0-9-]+\.webp$/.test(url))return false;
  const file=path.join(publicRoot,url);if(!existsSync(file))return false;
  const bytes=readFileSync(file);return bytes.length>1000&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
}
try{
  const context={window:{}};script('daily-adventures/stories.js',context);
  const stories=context.window.DailyAdventureStories;
  ok('all eleven requested days are present',Array.isArray(stories)&&stories.length===11);
  if(!Array.isArray(stories))throw new Error('Missing story array');
  const days=new Set(),keys=new Set(),mechanics=new Set();
  for(const story of stories){
    const label='Day '+story.day+' '+story.key;
    ok(label+' has its own valid identity',Number.isInteger(story.day)&&story.day>=4&&story.day<=14&&!days.has(story.day)&&/^[a-z]+$/.test(story.key)&&!keys.has(story.key));
    days.add(story.day);keys.add(story.key);
    ok(label+' describes a distinct physical game',typeof story.mechanic==='string'&&!!story.mechanic&&!mechanics.has(story.mechanic)&&typeof story.speechHelp==='string'&&story.speechHelp.length>30);
    mechanics.add(story.mechanic);
    ok(label+' provides both age paths',Array.isArray(story.youngerGoals)&&story.youngerGoals.length===5&&Array.isArray(story.olderGoals)&&story.olderGoals.length===8&&story.youngerGoals.concat(story.olderGoals).every(s=>typeof s==='string'&&s.trim()));
    ok(label+' has three ordered plot acts',Array.isArray(story.acts)&&story.acts.length===3&&story.acts.every((act,index)=>act.atYounger===[0,1,3][index]&&act.atOlder===[0,2,6][index]&&typeof act.title==='string'&&Array.isArray(act.narration)&&act.narration.length>0&&act.narration.every(line=>typeof line==='string'&&line.trim())));
    ok(label+' has a narrated, earned resolution',Array.isArray(story.ending)&&story.ending.length>0&&story.ending.every(s=>typeof s==='string'&&s.trim())&&story.done&&typeof story.done.title==='string'&&!!story.done.title&&typeof story.done.sub==='string');
    const sentences=(story.acts||[]).flatMap(act=>act.narration||[]).concat(story.ending||[]);
    ok(label+' keeps fallback utterances short',sentences.every(line=>typeof line==='string'&&line.length<=160&&line.trim().split(/\s+/).length<=18));
    ok(label+' has its actual setting painting',asset(story.art),story.art);
    ok(label+' has its actual earned-ending painting',asset(story.endingArt),story.endingArt);
    ok(label+' has an explicit release state',typeof story.ready==='boolean');
    const controller='daily-adventures/'+story.key+'.js',css='daily-adventures/'+story.key+'.css';
    ok(label+' has a controller and its layout',existsSync(path.join(publicRoot,controller))&&existsSync(path.join(publicRoot,css)));
    if(!existsSync(path.join(publicRoot,controller)))continue;
    const gameContext={window:{}};script(controller,gameContext);
    const game=gameContext.window.DailyAdventureGames&&gameContext.window.DailyAdventureGames[story.key];
    ok(label+' can register without opening a mic or starting a game',game&&['init','onWord','onHelp','pause','resume','reset','finale','destroy'].every(method=>typeof game[method]==='function'));
    // Catch literal image typos in deeply nested controllers that the root
    // static-page parser never visits. Runtime-generated paths are covered by
    // each game's input-driven browser suite.
    const urls=source(controller).match(/["'](\/assets\/[a-zA-Z0-9_./-]+\.(?:webp|png|svg))["']/g)||[];
    for(const quoted of urls){const url=quoted.slice(1,-1);ok(label+' can load '+url,existsSync(path.join(publicRoot,url)));}
  }
  ok('the day range has no holes',Array.from({length:11},(_,i)=>i+4).every(day=>days.has(day)));
  const narrative={window:{}};script('daily-adventures/narration.js',narrative);
  ok('the common narration adapter can load',typeof narrative.window.DailyAdventureNarration.wrap==='function');
}catch(error){ok('the complete daily expansion loads',false,error.stack);}
console.log('Daily content: '+checks+' checks; '+fails+' failures');process.exitCode=fails?1:0;
