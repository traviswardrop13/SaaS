// Local review only. No production page, catalog, entitlement or child speech
// rule is changed. The server is deliberately bound to this computer.
import {createServer} from 'node:http';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const repo=fileURLToPath(new URL('../',import.meta.url));
const publicRoot=path.join(repo,'public');
const template=readFileSync(path.join(repo,'tests/fixtures/daily-adventure.html'),'utf8');
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',webp:'image/webp',png:'image/png',svg:'image/svg+xml',woff2:'font/woff2'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function stories(){const context={window:{}};new vm.Script(readFileSync(path.join(publicRoot,'daily-adventures/stories.js'),'utf8')).runInNewContext(context);return context.window.DailyAdventureStories||[];}
function exists(relative){const file=path.join(publicRoot,relative);return existsSync(file)&&statSync(file).isFile();}
function playable(story){return exists('daily-adventures/'+story.key+'.js')&&exists('daily-adventures/'+story.key+'.css')&&exists(story.art)&&exists(story.endingArt||'__missing_ending__');}
function metadata(story){return{
  key:story.key,title:story.title,sub:story.description,progressLabel:'0 adventure jobs finished',
  canvasLabel:story.description,banner:story.acts[0].title,
  helpText:"Echo's help",helpLabel:'Optional speech help: '+story.speechHelp,
  startCopy:story.description,helpCopy:story.speechHelp,
  primerCopy:'Say each word two times to start the next adventure job.',pauseCopy:'Your adventure is waiting right here.',
  intro:'Say each word two times. Then help with the next adventure job.',done:story.done
};}
function gallery(records){return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sona adventure review</title><link rel="stylesheet" href="/fonts.css"><style>body{margin:0;background:#fff6e9;color:#4a2c14;font:17px/1.45 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:30px 20px}h1,h2{font-family:"Baloo 2",sans-serif;line-height:1.12}h1{font-size:40px;margin:0 0 8px}.lead{max-width:650px;color:#80674d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:28px}article{overflow:hidden;background:#fffcf6;border:1px solid #e9dcc4;border-radius:24px;box-shadow:0 5px 0 #e9dcc4}article img{width:100%;height:170px;object-fit:cover;object-position:center 25%}.copy{padding:18px}small{font-weight:800;color:#8a7257}h2{font-size:25px;margin:5px 0 12px}.copy p{min-height:72px}.links{display:flex;gap:10px;flex-wrap:wrap}a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;min-width:92px;box-sizing:border-box;padding:10px 15px;border-radius:16px;background:#258f98;color:white;text-decoration:none;font-weight:750}a:focus-visible{outline:4px solid #d88032;outline-offset:4px}.pending{color:#8a7257;font-weight:650}@media(max-width:380px){main{padding:22px 14px}h1{font-size:34px}}</style><main><h1>Sona adventure review</h1><p class="lead">New adventures in progress. This page is only on this computer. Choose an age group, turn on the microphone, and play with the real speech check.</p><div class="grid">'+records.map(story=>'<article>'+(exists(story.art)?'<img src="'+escape(story.art)+'" alt="">':'')+'<div class="copy"><small>Day '+story.day+'</small><h2>'+escape(story.title)+'</h2><p>'+escape(story.description)+'</p>'+(playable(story)?'<div class="links"><a href="/daily-adventure.html?day='+story.day+'&amp;age=3">Ages 3–4</a><a href="/daily-adventure.html?day='+story.day+'&amp;age=7">Ages 5–8</a></div>':'<p class="pending">Still being built</p>')+'</div></article>').join('')+'</div></main></html>';}

export function createDailyPreviewServer(){return createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method!=='GET'){res.writeHead(405);res.end('Local review only.');return;}
  // A preview never proxies API requests, accepts a recording or calls a
  // service. Echo uses the existing device voice fallback here.
  if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');return;}
  let records;try{records=stories();}catch{res.writeHead(503);res.end('The adventure files are being saved. Try again in a moment.');return;}
  if(url.pathname==='/'||url.pathname==='/index.html'){res.setHeader('Content-Type',mime.html);res.end(gallery(records));return;}
  // Keep SayPlay's own Home handler: it closes the mic and stops its voice
  // before navigating. Only its destination is redirected to the review.
  if(url.pathname==='/today.html'){res.writeHead(302,{Location:'/'});res.end();return;}
  if(url.pathname==='/daily-adventure.html'){
    const day=Number(url.searchParams.get('day')),story=records.find(item=>item.day===day),age=url.searchParams.get('age')==='3'?'3':'7';
    if(!story||!playable(story)){res.writeHead(404);res.end('That adventure is not ready for local review yet.');return;}
    const game=metadata(story);
    let html=template.replace(/\{\{([a-zA-Z]+)\}\}/g,(_,field)=>field==='config'?JSON.stringify(game).replace(/</g,'\\u003c'):escape(game[field]));
    html=html.replace('</head>','<script>window.__dailyNarrationFixture=true;</script></head>')
      .replace('var game =','Sona.saveProfile({childAge:'+JSON.stringify(age)+'});\n      var game =')
      .replace(/Back to games/g,'Back to adventure review');
    res.setHeader('Content-Type',mime.html);res.end(html);return;
  }
  if(url.pathname==='/sona.js'){
    let code=readFileSync(path.join(publicRoot,'sona.js'),'utf8');
    const available=records.filter(playable),keys=available.map(story=>story.key);
    for(const story of available)code=code.replace(new RegExp('^\\s*'+story.key+':\\s*\\{[^\\n]*\\},?\\s*$','m'),'');
    const entries=available.map(story=>story.key+': {name:'+JSON.stringify(story.title)+',sub:'+JSON.stringify(story.description)+',go:"/daily-adventure.html?day='+story.day+'",group:"daily",tier:"premium",say:true,adventure:false},').join('\n');
    if(!code.includes('const GAME_ACTS = {')){res.writeHead(503);res.end('/* Preview catalog could not be installed safely. */');return;}
    code=code.replace('const GAME_ACTS = {','const GAME_ACTS = {\n'+entries);
    // Only this loopback server's response grants review access to its new
    // story keys. Production Sona and its Premium decisions stay untouched.
    code+='\n(function(){var keys='+JSON.stringify(keys)+',original=Sona.gameAccess;Sona.gameAccess=function(key,options){if(keys.indexOf(key)!==-1)return{allowed:true,tier:"premium",reason:"local-review",preview:true};return original(key,options);};})();';
    res.setHeader('Content-Type',mime.js);res.end(code);return;
  }
  let file;try{file=path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));}catch{res.writeHead(400);res.end('Invalid path');return;}
  if(!file.startsWith(publicRoot+path.sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('Content-Type',mime[path.extname(file).slice(1)]||'application/octet-stream');res.end(readFileSync(file));
});}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const previewPort=Number(process.argv[2]||8424);
  if(!Number.isInteger(previewPort)||previewPort<1024||previewPort>65535)throw new Error('Choose a local port from 1024 to 65535.');
  const server=createDailyPreviewServer();
  server.listen(previewPort,'127.0.0.1',()=>process.stdout.write('Sona adventure review: http://127.0.0.1:'+previewPort+'/\n'));
  function stop(){server.close(()=>process.exit(0));}
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
