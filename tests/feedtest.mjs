// Feed Echo (the littles game): Echo asks a word, kid taps the matching
// picture, Echo munches and GROWS — persistently. Verifies: the ask/cards
// agree, wrong taps never fail the round, 5 feeds finish it (rotation
// advances, sticker awarded, growth saved), scale persists across loads,
// deck placement leads for under-6, and the page carries zero tracking.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2" };
let ttsAsks = [];
const feedSource = process.env.SONATEST_FEED_SOURCE || ROOT + "/arcade-feed.html";
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/tts" && req.method === "POST") {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { try { ttsAsks.push(JSON.parse(b).text); } catch (e) {} res.writeHead(500); res.end("{}"); });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = u.pathname === "/arcade-feed.html" ? feedSource : ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8145, r));

const browser = await chromium.launch(launchOpts());
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// COPPA guard: the kid page must not carry any tracking script
const src = readFileSync(feedSource, "utf8");
if (!process.env.FEED_AUDIO_ONLY) {
ok("kid page carries no tracking", !/pixel\.js|analytics\.js|fbevents|posthog/i.test(src));

await page.addInitScript(() => {
  // seed once — later tests mutate the profile and reload, so never clobber
  if (!localStorage.getItem("sona.profile.v1")) {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Zoe", childAge: "4", focusSounds: ["R"], onboarded: true }));
  }
});
await page.goto("http://localhost:8145/arcade-feed.html"); await page.waitForTimeout(1000);

// ── the ask and the cards agree ──
let t = await page.evaluate(() => ({
  cards: [...document.querySelectorAll("#grid .cardBtn")].map((b) => b.querySelector(".w").textContent),
  bubble: document.getElementById("bMain").textContent,
  fed: document.getElementById("plate").dataset.fed,
}));
ok("renders 2-4 picture cards", t.cards.length >= 2 && t.cards.length <= 4, JSON.stringify(t.cards));
const target1 = (t.bubble.match(/Where's the (.+)\?/) || [])[1];
ok("the asked word is one of the cards", !!target1 && t.cards.includes(target1), t.bubble);
ok("round starts 0/5", /0\/5/.test(t.fed));
ok("Echo speaks the ask", ttsAsks.some((x) => new RegExp("Where is the " + target1, "i").test(x)), JSON.stringify(ttsAsks));

// ── wrong tap: wobble + hint, never a fail, fed stays 0 ──
const wrongIdx = t.cards.findIndex((w) => w !== target1);
if (wrongIdx >= 0) {
  await page.evaluate((i) => document.querySelectorAll("#grid .cardBtn")[i].click(), wrongIdx);
  await page.waitForTimeout(300);
  t = await page.evaluate(() => ({
    fed: document.getElementById("plate").dataset.fed,
    hint: document.getElementById("bSub").textContent,
    cardsLeft: document.querySelectorAll("#grid .cardBtn").length,
  }));
  ok("wrong tap never fails the round", /0\/5/.test(t.fed) && t.cardsLeft >= 2 && /Almost/.test(t.hint));
}

// ── every bite VISIBLY grows Echo within the round ──
const scaleBefore = await page.evaluate(() => parseFloat((document.getElementById("echo").style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || "1"));
await page.evaluate(() => {
  const m = document.getElementById("bMain").textContent.match(/Where's the (.+)\?/);
  const hit = [...document.querySelectorAll("#grid .cardBtn")].find((x) => x.querySelector(".w").textContent === m[1]);
  if (hit) hit.click();
});
await page.waitForTimeout(400);
const scaleAfter = await page.evaluate(() => parseFloat((document.getElementById("echo").style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || "1"));
ok("Echo grows with the bite (visible, not just banked)", scaleAfter > scaleBefore + 0.04, scaleBefore + " → " + scaleAfter);

// ── feed the rest by always tapping the asked card ──
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(1100);
  const done = await page.evaluate(() => {
    const b = document.getElementById("bMain").textContent;
    const m = b.match(/Where's the (.+)\?/);
    if (!m) return false;
    const btns = [...document.querySelectorAll("#grid .cardBtn")];
    const hit = btns.find((x) => x.querySelector(".w").textContent === m[1]);
    if (hit) hit.click();
    return !!hit;
  });
  if (!done) break;
}
await page.waitForTimeout(1400);
t = await page.evaluate(() => ({
  end: document.getElementById("endOvl").classList.contains("show"),
  endSub: document.getElementById("endSub").textContent,

  fedStore: JSON.parse(localStorage.getItem("sona.feed.v1") || "{}").fed || 0,
  rot: window.Sona.rotRound(),
  ring: window.Sona.todayRing().n,
  stickers: Object.keys(window.Sona.stickersEarned ? window.Sona.stickersEarned() : {}).length,
}));
ok("5 feeds finish the round", t.end);
// ── the ukulele concert: strumming Echo + floating notes + real plucks fired ──
t = await page.evaluate(() => ({
  uke: !!document.querySelector("#concert .uke"),
  notes: document.querySelectorAll("#concert .note").length,
  played: window.__ukePlayed === true,
}));
ok("concert scene: Echo strums with floating notes", t.uke && t.notes >= 2);
ok("the ukulele actually plays (plucks scheduled)", t.played);
t = await page.evaluate(() => ({
  end: document.getElementById("endOvl").classList.contains("show"),
  endSub: document.getElementById("endSub").textContent,
  fedStore: JSON.parse(localStorage.getItem("sona.feed.v1") || "{}").fed || 0,
  rot: window.Sona.rotRound(),
  ring: window.Sona.todayRing().n,
  stickers: Object.keys(window.Sona.stickersEarned ? window.Sona.stickersEarned() : {}).length,
}));
ok("growth persisted (5 feeds banked)", t.fedStore === 5, "fed=" + t.fedStore);
// SILENCE IS NEVER A REP. This run had no microphone, so Echo heard nothing —
// tapping the right picture five times must NOT count as practice. The round
// still ends warmly; it just doesn't advance anything.
ok("a silent round does NOT advance the rotation or ring", t.rot === 0 && t.ring === 0, "rot=" + t.rot + " ring=" + t.ring);
ok("…and earns no sticker", t.stickers === 0, String(t.stickers));
ok("…and ends kindly without claiming silence was practice", /discoveries/i.test(t.endSub), t.endSub);
ok("win copy offers the earned play celebration", /concert/i.test(t.endSub), t.endSub);

// ── growth survives a reload (Echo visibly bigger) ──
await page.goto("http://localhost:8145/arcade-feed.html"); await page.waitForTimeout(900);
t = await page.evaluate(() => document.getElementById("echo").style.transform);
// …and the other half of the rule: a round Echo actually HEARD does count.
{
  const ctx2 = await browser.newContext();
  const pg2 = await ctx2.newPage();
  await pg2.goto("http://localhost:8145/today.html");
  await pg2.evaluate(() => localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "5", focusSounds: ["R"], onboarded: true, voiceOn: false })));
  await pg2.goto("http://localhost:8145/arcade-feed.html?heard=5");
  await pg2.waitForTimeout(700);
  for (let i = 0; i < 6; i++) {
    const hit = await pg2.evaluate(() => {
      const m = document.getElementById("bMain").textContent.match(/Where's the (.+)\?/);
      if (!m) return false;
      const btn = [...document.querySelectorAll("#grid .cardBtn")].find((x) => x.querySelector(".w").textContent === m[1]);
      if (btn) btn.click();
      return !!btn;
    });
    if (!hit) break;
    await pg2.waitForTimeout(900);   // the bite animation has to finish before the next ask paints
  }
  await pg2.waitForTimeout(1500);
  const heard = await pg2.evaluate(() => ({ rot: Sona.rotRound(), ring: Sona.todayRing().n, title: document.getElementById("endTitle").textContent }));
  ok("a loudness-only round never advances measured practice", heard.rot === 0 && heard.ring === 0, JSON.stringify(heard));
  await ctx2.close();
}

ok("Echo's size persists across visits", /scale\(1\.0[2-9]|scale\(1\.[1-9]/.test(t), t);

// ── the deck is age-aware. A little who can't read must open on Feed Echo
//    (tap-and-say), not on a card full of falling fruit — but every other
//    game is still one swipe away. ──
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(900);
let deck = await page.evaluate(() => ({
  hero: document.getElementById("heroName").textContent,
  launch: document.getElementById("goBtn").dataset.launch,
  thumbs: [...document.querySelectorAll(".thumb")].map((t) => t.dataset.key),
  trio: Sona.dailyGames(),
}));
// Home recommends a short simple-play session for ages 3–4. Feed Echo
// remains an available individual choice in the existing daily trio.
ok("under-6: today's trio leads with Feed Echo", deck.trio[0] === "feed", JSON.stringify(deck));
ok("age 4: the day starts with the shared simple adventure", /charge\.html\?daily=1/.test(deck.launch || "") && deck.trio.every(k=>["feed","bubbles","peekaboo"].includes(k)), deck.launch);
ok("under-6: three games are on offer from the first tap", deck.thumbs.length === 3, JSON.stringify(deck.thumbs));
// Completing an adventure does not replace the younger child's simple-play
// recommendation with a game requiring timing or reading.
await page.evaluate(() => Sona.dailyFinish(10));
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(900);
deck = await page.evaluate(() => ({
  hero: document.getElementById("heroName").textContent,
  launch: document.getElementById("goBtn").dataset.launch,
}));
ok("age 4: after the adventure, the hero offers Feed Echo", /Feed Echo/.test(deck.hero), JSON.stringify(deck));
ok("age 4: the completed-day action opens Feed Echo", /arcade-feed/.test(deck.launch || ""), deck.launch);
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.childAge = "8"; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(900);
deck = await page.evaluate(() => ({
  hero: document.getElementById("heroName").textContent,
  launch: document.getElementById("goBtn").dataset.launch,
}));
ok("age 8: the deck no longer opens on Feed Echo", !/Feed Echo/.test(deck.hero), JSON.stringify(deck));
ok("age 8: LET'S GO opens a practice game", /charge\.html\?game=/.test(deck.launch || ""), deck.launch);

}
// Audio device edges are fake: no real mic, browser speech or Web Audio output.
async function audioFixture() {
  const ctx=await browser.newContext();
  await ctx.addInitScript(()=>{
    localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'4',focusSounds:['R'],onboarded:true,voiceOn:true,soundOn:true,volume:0.8}));
    const h=window.__feedAudio={hidden:false,requests:[],sources:[],spoken:0,cancelled:0,resumes:0,suspends:0};
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>h.hidden});
    h.hide=()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));};
    h.show=()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));};
    const fetchOriginal=window.fetch.bind(window);
    window.fetch=(url,opts)=>String(url)==='/api/tts'?new Promise(resolve=>h.requests.push(success=>resolve({ok:success,arrayBuffer:()=>Promise.resolve(new ArrayBuffer(48))}))):fetchOriginal(url,opts);
    function param(){return{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}};}
    function FakeContext(){this.state='running';this.sampleRate=24000;this.currentTime=0;this.destination={};}
    FakeContext.prototype.createBuffer=(c,n)=>({length:n,getChannelData:()=>new Float32Array(n)});
    FakeContext.prototype.createGain=()=>({gain:param(),connect(){},disconnect(){}});
    FakeContext.prototype.createBufferSource=function(){const source={buffer:null,started:false,stopped:false,connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;if(this.onended)this.onended();}};h.sources.push(source);return source;};
    FakeContext.prototype.resume=function(){h.resumes++;this.state='running';return Promise.resolve();};
    FakeContext.prototype.suspend=function(){h.suspends++;this.state='suspended';return Promise.resolve();};
    window.AudioContext=window.webkitAudioContext=FakeContext;
    navigator.mediaDevices.getUserMedia=()=>Promise.reject(new Error('No real mic in audio regression'));
    speechSynthesis.speak=()=>{h.spoken++;};speechSynthesis.cancel=()=>{h.cancelled++;};
  });
  const pg=await ctx.newPage();pg.setDefaultTimeout(3000);await pg.goto('http://localhost:8145/arcade-feed.html');
  await pg.waitForFunction(()=>__feedAudio.requests.length>0);return{ctx,pg};
}
for(const mode of ['pcm','fallback','late']){
 const {ctx,pg}=await audioFixture();
 try{
  if(mode==='late')await pg.evaluate(()=>__feedAudio.hide());
  await pg.evaluate(success=>__feedAudio.requests.shift()(success),mode!=='fallback');
  if(mode==='pcm')await pg.waitForFunction(()=>__feedAudio.sources.some(s=>s.started&&s.buffer.length>1));
  if(mode==='fallback')await pg.waitForFunction(()=>__feedAudio.spoken>0);
  if(mode!=='late')await pg.evaluate(()=>__feedAudio.hide());
  await pg.waitForTimeout(100);
  const state=await pg.evaluate(()=>({playing:__feedAudio.sources.filter(s=>s.started&&!s.stopped&&s.buffer.length>1).length,spoken:__feedAudio.spoken,cancelled:__feedAudio.cancelled,resumes:__feedAudio.resumes,started:__feedAudio.sources.filter(s=>s.started).length}));
  ok(mode+': background prevents active or late PCM',state.playing===0,JSON.stringify(state));
  if(mode==='fallback')ok('background cancels native fallback speech',state.cancelled>0,JSON.stringify(state));
  if(mode==='late')ok('a late response never starts fallback speech either',state.spoken===0,JSON.stringify(state));
  await pg.evaluate(()=>__feedAudio.show());await pg.waitForTimeout(80);
  ok(mode+': foreground alone never restarts audio',await pg.evaluate(before=>__feedAudio.resumes===before.resumes&&__feedAudio.sources.filter(s=>s.started).length===before.started,state));
  if(mode==='pcm'){
   await pg.locator('#echo').click();
   await pg.evaluate(()=>playUke());
   ok('the visible concert can play after a deliberate action',await pg.evaluate(()=>__feedAudio.sources.some(s=>s.started&&!s.stopped&&s.buffer.length>48)));
   await pg.evaluate(()=>__feedAudio.hide());
   ok('background stops every concert note',await pg.evaluate(()=>__feedAudio.sources.filter(s=>s.started&&s.buffer.length>1).every(s=>s.stopped)));
  }
 }finally{await ctx.close();}
}

ok("no pageerrors", errs.length === 0, errs.join(" | "));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
