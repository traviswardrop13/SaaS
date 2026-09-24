import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { runInNewContext } from 'node:vm';

// Local review fixture only. Nothing is forwarded to Sona or persisted.
const PROJECT = fileURLToPath(new URL('..', import.meta.url));
const ROOT = resolve(PROJECT, 'public');
const HOST = '127.0.0.1';
const PORT = Number(process.env.SLP_PREVIEW_PORT || 4174);
const ORIGIN = `http://${HOST}:${PORT}`;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2', '.mp3':'audio/mpeg' };
const source = readFileSync(resolve(PROJECT, 'tests/slptest.mjs'), 'utf8');
const fixtureStart = source.indexOf('const day =');
const fixtureEnd = source.indexOf('// ── mock API:');
if (fixtureStart < 0 || fixtureEnd < fixtureStart) throw new Error('Synthetic fixture boundary missing');
const makeFixture = () => runInNewContext(source.slice(fixtureStart, fixtureEnd) + '\nfixture();', { Date });
const initialAccount = { ok:true, email:'rachel@example.com', code:'rachel-k4', familyKey:'ABCD2345', name:'Rachel K', clinic:'Bright Steps', onboarded:true };
let data = makeFixture();
let account = { ...initialAccount };
let writes = 0;
let communityPosts = [];
const demoBanner = `<aside id="local-preview-banner" role="status" style="position:fixed;bottom:0;left:0;right:0;z-index:10000;min-height:32px;padding:6px 14px;box-sizing:border-box;background:#183d43;color:#fff;font:500 11px/20px system-ui,sans-serif;letter-spacing:.02em;text-align:center;box-shadow:0 -1px 8px #0001"><strong style="letter-spacing:.1em">LOCAL PREVIEW</strong> &nbsp;·&nbsp; Synthetic sample data &nbsp;·&nbsp; Changes stay in this local preview <button type="button" onclick="fetch('/api/preview/reset',{method:'POST'}).then(function(){location.reload();})" style="margin-left:10px;background:transparent;color:#fff;border:1px solid #ffffff70;border-radius:5px;padding:2px 7px;font:inherit;cursor:pointer">Reset demo</button></aside><style>body{padding-bottom:44px!important}@media print{#local-preview-banner{display:none!important}}</style>`;

const server = createServer((req, res) => {
  const u = new URL(req.url, ORIGIN);
  const json = (value, status=200) => { res.writeHead(status, { 'content-type':'application/json', 'cache-control':'no-store' }); res.end(JSON.stringify(value)); };
  const send = (status, value) => { res.writeHead(status, { 'content-type':'text/plain; charset=utf-8' }); res.end(value); };
  let body = '';
  req.on('data', chunk => { body += chunk; if(body.length > 1_000_000) req.destroy(); });
  req.on('end', () => {
    let b = {};
    try { if(body) b=JSON.parse(body); } catch { return json({ok:false,error:'Invalid JSON'},400); }
    if(u.pathname === '/api/preview/reset' && req.method === 'POST') { data=makeFixture(); account={...initialAccount}; writes=0; communityPosts=[]; return json({ok:true}); }
    if(u.pathname === '/api/slp/auth/me') return json(account);
    if(u.pathname === '/api/slp/auth/logout') return json({ok:true});
    if(u.pathname === '/api/slp/account') {
      if(req.method === 'POST') {
        for(const k of ['name','clinic','code']) if(typeof b[k] === 'string') account[k]=b[k];
        if(b.rotateKey) account.familyKey='DEMO' + String(++writes).padStart(6,'0');
      }
      return json(account);
    }
    if(u.pathname === '/api/slp' && req.method === 'GET') return json({ok:true,configured:true,kids:data.kids,invites:data.invites});
    if(u.pathname === '/api/slp/homework') {
      if(req.method === 'GET') return json({ok:true,items:data.kids.map(k=>({childId:k.childId,...k.hw}))});
      const kid=data.kids.find(k=>k.childId===b.childId);
      if(!kid) return json({ok:false,error:'Sample child was not found'},404);
      if(b.action === 'clear') kid.hw={status:'none',hw:null,days:{}};
      else if(b.hw) kid.hw={status:'active',hw:{...b.hw,id:'preview-hw-'+(++writes),by:account.name},days:{}};
      return json({ok:true,hw:kid.hw.hw});
    }
    if(u.pathname === '/api/slp/child') {
      if(req.method === 'DELETE') { data.kids=data.kids.filter(k=>k.childId!==b.childId); return json({ok:true,removed:b.childId}); }
      const kid=data.kids.find(k=>k.childId===b.childId);
      if(kid) kid.meta={...kid.meta,...b.meta};
      return json({ok:true});
    }
    if(u.pathname === '/api/slp/invite') {
      if(req.method === 'DELETE') { data.invites=data.invites.filter(i=>i.token!==b.token); return json({ok:true}); }
      if(req.method === 'POST') {
        const token='PREVIEW'+String(++writes).padStart(5,'0');
        const inv={token,label:b.label,age:b.age,sounds:b.sounds,pos:b.pos,repsPerDay:b.repsPerDay,note:b.note,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString()};
        data.invites.push(inv);
        return json({ok:true,invite:inv,link:ORIGIN+'/join.html?slp='+encodeURIComponent(account.code.toUpperCase())+'&k='+encodeURIComponent(account.familyKey)+'&inv='+token});
      }
    }
    // The local demo mirrors the shared feed, but never forwards a post.
    if(u.pathname === '/api/slp/community') {
      if(req.method === 'GET') {
        const category=u.searchParams.get('category');
        return json({ok:true,posts:communityPosts.filter(p=>!category||p.category===category),nextCursor:null});
      }
      const post=communityPosts.find(p=>p.id===b.postId);
      if(req.method === 'DELETE') {
        if(!post)return json({ok:false,error:'Conversation not found.'},404);
        if(b.replyId)post.replies=post.replies.filter(r=>r.id!==b.replyId);
        else communityPosts=communityPosts.filter(p=>p.id!==b.postId);
        return json({ok:true});
      }
      if(b.action === 'post') {
        const id='demo-'+(++writes);
        communityPosts.unshift({id,title:b.title,text:b.text,category:b.category,author:account.name.split(/\s+/)[0]||'SLP member',createdAt:new Date().toISOString(),canDelete:true,replies:[]});
        return json({ok:true,id});
      }
      if(b.action === 'reply'&&post) {
        const id='reply-'+(++writes);
        post.replies.push({id,text:b.text,author:account.name.split(/\s+/)[0]||'SLP member',createdAt:new Date().toISOString(),canDelete:true});
        return json({ok:true,id});
      }
      if(b.action === 'report')return json({ok:true});
      return json({ok:false,error:'Conversation not found.'},404);
    }
    // Feedback, tracking, and any other API action stay local and inert.
    if(u.pathname.startsWith('/api/')) return json({ok:true,preview:true});
    let pathname;
    try { pathname=decodeURIComponent(u.pathname); } catch { return send(400,'Invalid URL'); }
    if(pathname === '/') pathname='/slp.html';
    const path=resolve(ROOT,'.'+pathname);
    if(path !== ROOT && !path.startsWith(ROOT+sep)) return send(403,'Forbidden');
    let content;
    try { if(!statSync(path).isFile()) return send(404,'Not found'); content=readFileSync(path); } catch { return send(404,'Not found'); }
    if(pathname === '/slp.html') content=content.toString().replace('<head>', '<head><script>window.SLP_PREVIEW_FEATURES=true;</script>').replace('</body>',demoBanner+'\n</body>');
    res.writeHead(200, {'content-type':MIME[extname(path)]||'application/octet-stream','cache-control':'no-store'});
    res.end(content);
  });
});
server.listen(PORT,HOST,()=>console.log('Local synthetic SLP preview: '+ORIGIN+'/slp.html\nServing '+ROOT+'\nAll API writes are in memory; restart/reset restores the test fixture.'));
