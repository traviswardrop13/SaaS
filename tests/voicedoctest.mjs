// The source index covers upstream TALK1 without allowing unreviewed readers.
// Fixtures change only temporary copies; no running app source is modified.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readdirSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url));
const code=readFileSync(process.env.SONA_VOICEDOC_SOURCE||path.join(root,'tools/voicedoc.mjs'),'utf8');
const dirs=[];
function fixture(extraReader){
  const dir=mkdtempSync(path.join(os.tmpdir(),'sona-voicedoc-'));dirs.push(dir);
  mkdirSync(path.join(dir,'tools'));mkdirSync(path.join(dir,'public'));
  writeFileSync(path.join(dir,'tools/voicedoc.mjs'),code);
  writeFileSync(path.join(dir,'VOICE_SCRIPT.md'),readFileSync(path.join(root,'VOICE_SCRIPT.md')));
  for(const f of readdirSync(path.join(root,'public'))){
    const src=path.join(root,'public',f),dst=path.join(dir,'public',f);
    if(extraReader&&f==='settings.html')writeFileSync(dst,readFileSync(src,'utf8')+'\n<script src="/saycheck.js"></script>\n');
    else symlinkSync(src,dst);
  }
  return path.join(dir,'tools/voicedoc.mjs');
}
const run=(file,args=[])=>spawnSync(process.execPath,[file,...args],{encoding:'utf8',maxBuffer:5*1024*1024});
let checks=0,failures=0;
function ok(label,pass,detail){checks++;if(!pass)failures++;console.log((pass?'PASS ':'FAIL ')+label+(!pass?' → '+String(detail||''):''));}
try{
  const normal=fixture(false),generated=run(normal);
  ok('the index includes TALK1 narration and existing word-moment templates',generated.status===0&&generated.stdout.includes("Robo built a shiny rocket to fly to the moon. But it's fast asleep! Let's wake up the rocket.")&&generated.stdout.includes('C11 — Talking Day1 stories')&&generated.stdout.includes('Can you say... {word}.')&&generated.stdout.includes('public/talk-stories.js:'),generated.stderr);
  const current=run(normal,['--check']);
  ok('the saved voice index exactly matches the reviewed sources',current.status===0,current.stderr);
  const unexpected=run(fixture(true));
  ok('an unexpected third SayCheck page is rejected without output',unexpected.status===1&&unexpected.stdout===''&&/saycheck\.js is now loaded by .*settings\.html/.test(unexpected.stderr),unexpected.stderr);
}finally{for(const dir of dirs)rmSync(dir,{recursive:true,force:true});}
console.log(failures?failures+' FAILURES / '+checks+' checks':'ALL GREEN — '+checks+' checks');process.exit(failures?1:0);
