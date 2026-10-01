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

// THE WORD COMES FIRST (Travis, 1 Oct 2026: "we need to get the kid to have
// to say it!"). The mic here is a stand-in: window.__mic.voice is the child
// talking, and it is all the page can hear.
function fakeMic() {
  const h = window.__mic = { voice: false, opens: 0, live: 0 };
  navigator.mediaDevices.getUserMedia = () => { h.opens++; h.live++; const t = { kind: "audio", readyState: "live", stop() { if (this.readyState !== "ended") { this.readyState = "ended"; h.live--; } } }; return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] }); };
  const AC = window.AudioContext || window.webkitAudioContext;
  AC.prototype.createMediaStreamSource = function () { return { connect() {}, disconnect() {} }; };
  const real = AC.prototype.createAnalyser;
  AC.prototype.createAnalyser = function () {
    const an = real.call(this);
    an.getByteTimeDomainData = (d) => { for (let i = 0; i < d.length; i++) d[i] = h.voice ? (i % 2 ? 200 : 56) : 128; };
    an.getByteFrequencyData = (d) => { d.fill(0); if (h.voice) for (let i = 1; i <= 10 && i < d.length; i++) d[i] = 220; };
    return an;
  };
}
await page.addInitScript(fakeMic);
await page.addInitScript(() => {
  // seed once — later tests mutate the profile and reload, so never clobber
  if (!localStorage.getItem("sona.profile.v1")) {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Zoe", childAge: "4", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.micok", "1");   // the grown-up said yes in setup
  }
});
await page.goto("http://localhost:8145/arcade-feed.html"); await page.waitForTimeout(600);
const asked = () => page.evaluate(() => (document.getElementById("bMain").textContent.match(/Where's the (.+)\?/) || [])[1] || "");
const tapCard = (word) => page.evaluate((w) => { const b = [...document.querySelectorAll("#grid .cardBtn")].find((x) => x.querySelector(".w").textContent === w); if (b) b.click(); return !!b; }, word);
const fedNow = () => page.evaluate(() => document.getElementById("plate").dataset.fed);
// the child says the word once the mic is listening
async function sayWord() {
  await page.waitForFunction(() => window.__mic.live === 1, null, { timeout: 6000 });
  await page.waitForTimeout(450);   // past the mic's first look at the room
  await page.evaluate(() => { window.__mic.voice = true; });
  await page.waitForFunction(() => !document.getElementById("grid").classList.contains("locked"), null, { timeout: 3000 }).catch(() => {});
  await page.evaluate(() => { window.__mic.voice = false; });
}

// ── "Let's play" starts it: the first ask comes from a tap ──
ok("a start card waits for Let's play, so the first ask is never silent on a phone", await page.evaluate(() => document.getElementById("startOvl").classList.contains("show") && /Let's play/.test(document.getElementById("startBtn").textContent) && !/Where's the/.test(document.getElementById("bMain").textContent)));
ok("…and nothing listens before it", await page.evaluate(() => window.__mic.opens === 0));
await page.locator("#startBtn").click();
await page.waitForFunction(() => /Where's the/.test(document.getElementById("bMain").textContent));

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
await page.waitForTimeout(400);
ok("Echo speaks the ask", ttsAsks.some((x) => new RegExp("Where is the " + target1, "i").test(x)), JSON.stringify(ttsAsks));
// Calm, not hype (24 Sep 2026): the voice reads "!" as a burst of energy, so
// the ask ends on a period. The practice word inside it is unchanged.
ok("Echo's ask ends calmly, on a period", ttsAsks.length > 0 && ttsAsks.every((x) => !/!/.test(x) && /\.$/.test(x)), JSON.stringify(ttsAsks));

// ── the word comes first: a tap before it feeds nothing ──
ok("the pictures wait, locked, until the word is said", await page.evaluate(() => document.getElementById("grid").classList.contains("locked")));
await tapCard(target1);
await page.waitForTimeout(300);
ok("tapping the right picture before saying the word feeds nothing, and says so", /0\/5/.test(await fedNow()) && /first|Tap the mic/.test(await page.locator("#bSub").innerText()), await page.locator("#bSub").innerText());
await sayWord();
ok("saying it unlocks the pictures, and the asked one glows", await page.evaluate((w) => { const g = document.querySelectorAll(".speechHint"); return !document.getElementById("grid").classList.contains("locked") && g.length === 1 && g[0].querySelector(".w").textContent === w && window.__heard === 1; }, target1));
ok("…and the word alone feeds nothing: the child still taps", /0\/5/.test(await fedNow()));

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
await tapCard(target1);
await page.waitForTimeout(400);
const scaleAfter = await page.evaluate(() => parseFloat((document.getElementById("echo").style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || "1"));
ok("Echo grows with the bite (visible, not just banked)", scaleAfter > scaleBefore + 0.04, scaleBefore + " → " + scaleAfter);

// ── silence never unlocks a picture: the mic closes and waits for a tap ──
await page.waitForFunction(() => /Where's the/.test(document.getElementById("bMain").textContent) && window.__mic.live === 1, null, { timeout: 6000 });
await page.waitForTimeout(8600);
t = await page.evaluate(() => ({ mic: !document.getElementById("micBtn").hidden, live: window.__mic.live, locked: document.getElementById("grid").classList.contains("locked"), sub: document.getElementById("bSub").textContent, fed: document.getElementById("plate").dataset.fed }));
ok("a quiet turn closes the mic, keeps the pictures locked and shows the mic button", t.mic && t.live === 0 && t.locked && /Tap the mic/.test(t.sub) && /1\/5/.test(t.fed), JSON.stringify(t));
await page.evaluate(() => document.getElementById("micBtn").click());   // it pulses, so a real tap, not a wait for it to hold still
await sayWord();
ok("…and the mic button listens again: the word still unlocks the pictures", await page.evaluate(() => !document.getElementById("grid").classList.contains("locked") && document.getElementById("micBtn").hidden));
await tapCard(await asked());
await page.waitForTimeout(1100);

// ── feed the rest: say each word, then tap its picture ──
for (let i = 0; i < 5; i++) {
  const w = await asked();
  if (!w) break;
  await sayWord();
  await tapCard(w);
  await page.waitForTimeout(1100);
}
await page.waitForTimeout(1400);
t = await page.evaluate(() => ({
  end: document.getElementById("endOvl").classList.contains("show"),
  endSub: document.getElementById("endSub").textContent,
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
// Echo hops under the win sentence, and his box has to hold the whole hop: at
// 120px he covered the middle of "discoveries" (1 Oct 2026). Measured at rest,
// plus the hop's own reach.
const hop = /@keyframes echoHop\{[^@]*?translateY\(-(\d+)px\) rotate\(-(\d+)deg\)/.exec(src) || [];
const gap = await page.evaluate(([px, deg]) => {
  const img = document.querySelector("#endOvl .echoWin img"), above = img.parentNode.previousElementSibling, was = img.style.animation;
  img.style.animation = "none"; const r = img.getBoundingClientRect(); img.style.animation = was;
  const a = deg * Math.PI / 180, reach = px + r.height / 2 * (Math.cos(a) + Math.sin(a) - 1), line = above.getBoundingClientRect();
  return { above: above.id, shown: line.height > 0, reach, clear: r.top - reach - line.bottom };
}, [+hop[1], +hop[2]]);
ok("at the top of his hop, Echo stays clear of the sentence above him", gap.above === "endSub" && gap.shown && gap.reach >= 14 && gap.clear >= 0, JSON.stringify(gap));
t = await page.evaluate(() => ({
  fedStore: JSON.parse(localStorage.getItem("sona.feed.v1") || "{}").fed || 0,
  rot: window.Sona.rotRound(),
  ring: window.Sona.todayRing().n,
  stickers: Object.keys(window.Sona.stickersEarned ? window.Sona.stickersEarned() : {}).length,
  reps: window.Sona.weekReps ? window.Sona.weekReps(0) : null,
  heard: window.__heard,
  endSub: document.getElementById("endSub").textContent,
}));
ok("growth persisted (5 feeds banked)", t.fedStore === 5, "fed=" + t.fedStore);
// A WORD SAID IN A GAME IS PLAY, NOT PRACTICE. Each heard word is one rep on
// the week's count (Sona.gameRep), but the rotation, the day's ring and the
// stickers belong to the practice page alone.
ok("a heard round does NOT advance the rotation or ring", t.rot === 0 && t.ring === 0, "rot=" + t.rot + " ring=" + t.ring);
ok("…and earns no sticker", t.stickers === 0, String(t.stickers));
ok("…but every word Echo heard is a rep on the week's count", t.heard >= 5 && (t.reps == null || t.reps >= 5), JSON.stringify({ heard: t.heard, reps: t.reps }));
ok("…and ends kindly", /discoveries/i.test(t.endSub), t.endSub);
ok("win copy offers the earned play celebration", /concert/i.test(t.endSub), t.endSub);

// ── growth survives a reload (Echo visibly bigger) ──
await page.goto("http://localhost:8145/arcade-feed.html"); await page.waitForTimeout(900);
t = await page.evaluate(() => document.getElementById("echo").style.transform);
// ── a grown-up's "Not now" goes home: Echo needs to hear the word to eat ──
{
  const ctx2 = await browser.newContext();
  await ctx2.addInitScript(fakeMic);
  await ctx2.addInitScript(() => { if (!localStorage.getItem("seeded")) { localStorage.setItem("seeded", "1"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "4", focusSounds: ["R"], onboarded: true, voiceOn: false })); } });
  const pg2 = await ctx2.newPage();
  await pg2.goto("http://localhost:8145/arcade-feed.html"); await pg2.waitForTimeout(500);
  await pg2.locator("#startBtn").click();
  await pg2.waitForTimeout(400);
  const primer = await pg2.evaluate(() => ({ shown: document.getElementById("primer").classList.contains("show"), opens: window.__mic.opens, promise: document.getElementById("micPromise").textContent, want: Sona.MIC_PROMISE }));
  ok("with no mic yet, a grown-up is asked first, with the shared mic promise, before the phone is", primer.shown && primer.opens === 0 && primer.promise === primer.want, JSON.stringify(primer));
  await pg2.locator("#primerNo").click();
  await pg2.waitForTimeout(200);
  ok("…\"Not now\" explains Echo needs to hear the word, and offers the way home", /needs to hear you/.test(await pg2.locator("#primer").innerText()) && await pg2.evaluate(() => window.__mic.opens === 0 && !/Where's the/.test(document.getElementById("bMain").textContent)));
  await pg2.locator("#byeBtn").click();
  await pg2.waitForURL(/today\.html/);
  ok("…and Okay goes home", /today\.html/.test(pg2.url()));
  await ctx2.close();
}

ok("Echo's size persists across visits", /scale\(1\.0[2-9]|scale\(1\.[1-9]/.test(t), t);

// Home suggests an age shelf, but never starts a game for the child.
async function readLibrary(){return page.evaluate(()=>({
  group:document.querySelector('.activity-group').dataset.group,
  games:[...document.querySelectorAll('#activityGroups .game-card')].map(t=>t.dataset.game),
  playable:[...document.querySelectorAll('#activityGroups .game-card')].filter(card=>!card.disabled).map(card=>card.dataset.game),
  comingSoon:[...document.querySelectorAll('#activityGroups .game-card')].filter(card=>card.disabled&&/coming (soon|[a-z]{3} \d{1,2})\b/i.test(card.textContent)).map(card=>card.dataset.game).sort(),
  hero:!!document.getElementById('goBtn'),
  trio:Sona.dailyGames()
}));}
await page.goto("http://localhost:8145/today.html"); await page.waitForTimeout(900);
let deck=await readLibrary();
ok("age 4: simple play is suggested first",deck.group==='simple',JSON.stringify(deck));
// The Say & Play games are Coming soon until each is rebuilt (Travis, 26 Sep
// 2026); the six first games, Feed Echo among them, always play.
const PARKED=['peekaboo',...[...readFileSync(ROOT+'/sona.js','utf8').matchAll(/^\s{4}(\w+): \{[^\n]*\bsay: true, comingSoon: true\b/gm)].map(m=>m[1])].sort();
ok("Home shows all 28 titles: the six first games and any rebuilt ones playable, the rest Coming soon",deck.games.length===28&&deck.playable.length===28-PARKED.length&&['feed','slice','tiles','stack','run','glide'].every(k=>deck.playable.includes(k))&&JSON.stringify(deck.comingSoon)===JSON.stringify(PARKED),JSON.stringify(deck));
ok("Home waits for a choice instead of starting an adventure",!deck.hero&&page.url().endsWith('/today.html'));
await page.evaluate(()=>Sona.dailyFinish(10));
await page.reload();await page.waitForTimeout(900);deck=await readLibrary();
ok("finishing a day keeps the same library choices",deck.group==='simple'&&deck.games.includes('feed')&&!deck.hero,JSON.stringify(deck));
await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('sona.profile.v1'));p.childAge='8';localStorage.setItem('sona.profile.v1',JSON.stringify(p));});
await page.reload();await page.waitForTimeout(900);deck=await readLibrary();
ok("age 8: Arcade is suggested first, with Feed Echo still available",deck.group==='arcade'&&deck.games.includes('feed'),JSON.stringify(deck));

}
// Audio device edges are fake: no real mic, browser speech or Web Audio output.
async function audioFixture() {
  const ctx=await browser.newContext();
  await ctx.addInitScript(()=>{
    localStorage.setItem('sona.profile.v1',JSON.stringify({childName:'Mia',childAge:'4',focusSounds:['R'],onboarded:true,voiceOn:true,soundOn:true,volume:0.8}));
    localStorage.setItem('sona.micok','1');
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
  await pg.locator('#startBtn').click();
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
