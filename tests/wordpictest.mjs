// WORDPIC1: every Say & Play game shows the word's picture in its turn panel
// (Travis, 5 Nov 2026: "fix the missing word pictures").
//
// crafted-words.js draws the picture as two spans sized inline, and a span's
// width and height do nothing until a rule makes it a box. Only five Home
// games' own stylesheets held that rule, so in seventeen of them, and in the
// eleven daily-adventure games, the picture box was an empty cream square: a
// child who cannot read yet had only the letters. The rule is in sayplay.css
// now. This opens every Say & Play page in the catalog (read from sona.js, so
// a new game is covered without an edit here) plus one daily-adventure game
// on its own host page, starts the first word, and measures the picture.
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {ROOT as SOURCE_ROOT} from './_env.mjs';
import {gameHarness,advance,until} from './_sayplay-realgame.mjs';
import {dailyHarness} from './_daily-adventure.mjs';
import {unparkedSona} from './_parked.mjs';

const ROOT=process.env.SONATEST_PUBLIC_ROOT||SOURCE_ROOT;
let checks=0,failures=0;
function ok(name,pass,detail){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' '+JSON.stringify(detail)));}

// Every catalog game whose page runs on the Say & Play engine.
const sona=readFileSync(path.join(ROOT,'sona.js'),'utf8');
const acts=sona.slice(sona.indexOf('const GAME_ACTS = {'),sona.indexOf('const GAME_KEYS'));
const keys=[...acts.matchAll(/^\s*([a-z]+):\s*\{[^\n]*go: "\/arcade-([a-z]+)\.html"/gm)]
  .filter(m=>m[1]===m[2]&&existsSync(path.join(ROOT,'arcade-'+m[2]+'.html'))&&/\/sayplay\.js"/.test(readFileSync(path.join(ROOT,'arcade-'+m[2]+'.html'),'utf8')))
  .map(m=>m[1]);
ok('the catalog lists the Say & Play games (at least twenty)',keys.length>=20,keys);
// A parked game (four since 5 Nov 2026) bounces Home before its first word,
// so every page here is served a catalog with all of them open: a parked
// game's picture is checked too, ready for the day it comes back.
const UNPARKED=unparkedSona(sona,keys);

// The picture inside the box: drawn, a real size, and inside the box's edges.
const measure=page=>page.evaluate(()=>{
  const box=document.getElementById('picBox'),crop=document.querySelector('#pic .crafted-word-crop');
  const b=box.getBoundingClientRect(),c=crop&&crop.getBoundingClientRect();
  return {word:window.__sayplay&&__sayplay.word,box:[Math.round(b.width),Math.round(b.height)],pic:c?[Math.round(c.width),Math.round(c.height)]:null,
    inside:!!c&&c.left>=b.left-1&&c.right<=b.right+1&&c.top>=b.top-1&&c.bottom<=b.bottom+1};
});
const shows=r=>!!r.pic&&r.pic[0]>=r.box[0]*0.6&&r.pic[1]>=r.box[1]*0.6&&r.inside;
async function firstWord(page){
  await page.locator('#startBtn').click();
  if(await page.locator('#primerYes').isVisible().catch(()=>false))await page.locator('#primerYes').click();
  return until(page,()=>window.__sayplay&&__sayplay.listening&&!!__sayplay.word,20000);
}

let h;
try{
  h=await gameHarness(keys[0],8488);
  for(const viewport of [{width:390,height:844},{width:320,height:568}]){
    for(const key of keys){
      const {page,context,errors}=await h.fresh({viewport});
      await context.route(/\/sona\.js(\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:UNPARKED}));
      try{
        if(!page.url().endsWith('/arcade-'+key+'.html'))await page.goto(page.url().replace(/arcade-[a-z]+\.html/,'arcade-'+key+'.html'));
        await advance(page,1200);
        const live=await firstWord(page),r=await measure(page);
        ok(key+' ('+viewport.width+'x'+viewport.height+') shows the word\'s picture',live&&shows(r)&&!errors.length,{live,r,errors});
      }catch(e){ok(key+' ('+viewport.width+'x'+viewport.height+') opens to its first word',false,e.message);}
      await context.close();
    }
  }
}finally{if(h)await h.close();}

// A daily-adventure game: story-game.html loads sayplay.css and the shared
// host.css, the same pair its test host serves.
const story=readFileSync(path.join(ROOT,'story-game.html'),'utf8');
ok('the daily-adventure page loads the engine\'s stylesheet, where the picture rule lives',/href="\/sayplay\.css"/.test(story));
let d;
try{
  d=await dailyHarness({key:'waterwheel',port:8489});
  const {page,context,errors}=await d.fresh();
  await page.clock.resume();await page.waitForTimeout(600);
  const live=await firstWord(page),r=await measure(page);
  ok('a daily-adventure game shows the word\'s picture',live&&shows(r)&&!errors.length,{live,r,errors});
  await context.close();
}finally{if(d)await d.close();}

console.log(`\n${checks-failures}/${checks} passed`);
process.exit(failures?1:0);
