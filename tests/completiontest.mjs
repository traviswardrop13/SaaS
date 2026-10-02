// COMPLETE1: finishing a daily adventure celebrates actual practice without
// turning an arcade score into a speech measure or a zero-word history row.
// Baseline runs can serve an exported public tree with SONATEST_PUBLIC_ROOT.
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const publicRoot = process.env.SONATEST_PUBLIC_ROOT || ROOT;
const origin = "http://localhost:8193";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2" };
const server = createServer((req, res) => {
  const u = new URL(req.url, origin);
  if (u.pathname === "/__seed") { res.end("<!doctype html><title>Test setup</title>"); return; }
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const file = path.join(publicRoot, u.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(8193, "127.0.0.1", resolve));
const browser = await chromium.launch(launchOpts());
let failures = 0, assertions = 0;
function ok(name, pass, extra) {
  assertions++;
  if (!pass) failures++;
  console.log((pass ? "PASS " : "FAIL ") + name + (pass ? "" : " → " + (typeof extra === "string" ? extra : JSON.stringify(extra))));
}
async function scenario(name, task) {
  try { await task(); } catch (error) { ok(name + " completes without a harness/page exception", false, error.stack); }
}
const games = ["slice", "stack", "tiles", "run", "glide"];
// Default completion fixtures hold grandfathered access in either pricing
// state. `paid: true` uses the paid-state seam for a post-era family, keeping
// the parent handoff covered while the production family app remains free.
// `web` is the second seam (1 Oct 2026, Travis: "i dont want them paying on
// the website"): these pages run in a browser, and a browser is only asked to
// fetch a grown-up while the website sells. "1" forces that on, so the handoff
// stays covered whichever way WEB_SALES ships; "0" plays the browser that
// cannot sell.
async function fresh({ paid = false, web = "1", replay = false, sound = "R", width = 390, height = 844, parkedEngineFixture = false, voicedMic = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return u.origin === origin || u.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  // The retained younger-game engine still needs completion/replay coverage.
  // Enable it only in this test context's served source, never via app state.
  if (parkedEngineFixture) await context.route("**/sona.js", route => route.fulfill({
    status:200, contentType:"text/javascript",
    body:readFileSync(path.join(publicRoot,"sona.js"),"utf8").replace(/(\b(?:bubbles|peekaboo)\s*:\s*\{[^}]*\bcomingSoon\s*:\s*)true/g, "$1false"),
  }));
  // These scenarios finish recorded runs; none should request a real mic.
  // Feed Echo needs the word said before Echo eats (1 Oct 2026), so a run
  // that plays it gets a stand-in mic instead: window.__mic.voice is the
  // child talking, and it is all the page can hear.
  if (voicedMic) await context.addInitScript(() => {
    const h = window.__mic = { voice: false, live: 0 };
    navigator.mediaDevices.getUserMedia = () => { h.live++; const t = { kind: "audio", readyState: "live", stop() { if (this.readyState !== "ended") { this.readyState = "ended"; h.live--; } } }; return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] }); };
    const AC = window.AudioContext || window.webkitAudioContext;
    AC.prototype.createMediaStreamSource = function () { return { connect() {}, disconnect() {} }; };
    const real = AC.prototype.createAnalyser;
    AC.prototype.createAnalyser = function () { const an = real.call(this); an.getByteTimeDomainData = (d) => { for (let i = 0; i < d.length; i++) d[i] = h.voice ? (i % 2 ? 200 : 56) : 128; }; an.getByteFrequencyData = (d) => { d.fill(0); if (h.voice) for (let i = 1; i <= 10 && i < d.length; i++) d[i] = 220; }; return an; };
  });
  else await context.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/__seed");
  await page.evaluate(({ paid, web, replay, sound, games }) => {
    localStorage.setItem("sona.freeera.v1", "post");
    localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done"); localStorage.setItem("sona.freeera5.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: "7", focusSounds: [sound], onboarded: true, volume: 0, voiceOn: false, soundOn: false, earlyAdopter: !paid }));
    if (paid) sessionStorage.setItem("sona.paidui", "1");
    if (paid) sessionStorage.setItem("sona.websalesui", web);
    if (replay) localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 1000, done: Date.now() }));
    sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, tries: 25, round: 4, sum: 40, scores: [10, 10, 10, 10], pending: true, sound, level: 1, demo: replay, games }));
  }, { paid, web, replay, sound, games });
  return { context, page, errors };
}
async function finish(page) {
  await page.goto(origin + "/charge.html?daily=1&banked=17");
  await page.locator("#runOvl.show").waitFor();
}
async function evidence(page) {
  return page.evaluate(() => ({ progress: Sona.getProgress(), daily: Sona.dailyInfo(), reps: Sona.repsToday(), outcomes: Sona.outcomes(), run: JSON.parse(sessionStorage.getItem("sona.run.v1")) }));
}
async function showHistory(page) {
  await page.evaluate(() => Sona.gateVerify());
  await page.goto(origin + "/progress.html");
  const more = page.getByText("More details", { exact: false });
  if (await more.count()) await more.click();
  return page.locator("#recent").innerText();
}
async function reachable(page, selector) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (top === el || el.contains(top));
  }, selector);
}

async function openAndClaim(page) {
  await page.locator("#runChest").click();
  await page.locator("#chestOvl.show").waitFor();
  for(let i=0;i<3;i++) await page.locator("#chestBox").click();
  await page.locator("#chestClaim").click();
  await page.locator("#runDone").waitFor({state:"visible"});
}
await scenario("saved three-beat completion", async () => {
  const {context,page,errors}=await fresh();
  try {
    await finish(page);
    const ui=await page.locator("#runOvl").innerText();
    ok("Echo celebrates without numbers or an arcade score", /Adventure complete!/.test(ui)&&!/5 rounds|score|R sound/.test(ui),ui);
    ok("the first action is opening the chest, not leaving",await page.locator("#runChest").isVisible()&&!(await page.locator("#runDone").isVisible()));
    const before=await evidence(page),row=before.progress.sessions[0];
    ok("score is banked once and finish remains resumable",before.daily.score===57&&before.run.round===5&&before.run.active&&before.run.finishing,before.run);
    ok("parent history stores rounds and verified tries",row&&row.tries===25&&row.rounds===5&&row.sounds[0]==="R"&&row.arcadeScore===57,row);
    ok("completion creates no extra tries or accuracy",before.progress.totals.words===0&&before.reps===0&&Object.keys(before.outcomes).length===0,before);
    await page.locator("#runChest").click();await page.locator("#chestBox").click();
    await page.reload();await page.locator("#chestOvl.show").waitFor();
    ok("one chest tap survives refresh",await page.evaluate(()=>chestTaps===1));
    await page.locator("#chestBox").click();await page.locator("#chestBox").click();
    const sticker=await page.evaluate(()=>JSON.stringify(Sona.stickersEarned()));
    await page.reload();await page.locator("#chestClaim").waitFor({state:"visible"});
    ok("the opened sticker survives refresh without another award",await page.evaluate(()=>JSON.stringify(Sona.stickersEarned()))===sticker);
    await page.locator("#chestClaim").click();
    ok("tomorrow follows the chest with one Done action",/tomorrow/i.test(await page.locator("#runOvl").innerText())&&await page.locator("#runDone").isVisible()&&!(await page.locator("#runChest").isVisible()));
    const after=await evidence(page);
    ok("refresh never doubles sessions or coins",JSON.stringify(after.progress)===JSON.stringify(before.progress)&&after.daily.score===57,{before:before.progress,after:after.progress});
    await page.locator("#runDone").click();await page.waitForURL(/today.html/);
    ok("Done returns Home and closes the saved run",await page.evaluate(()=>!JSON.parse(sessionStorage.getItem("sona.run.v1")).active));
    const history=await showHistory(page);
    ok("parent history uses detected tries",/25 tries/.test(history)&&!/0 words/.test(history),history);
    ok("completion has no page errors",errors.length===0,errors);
  }finally{await context.close();}
});
await scenario("small-screen and keyboard completion",async()=>{
  const {context,page}=await fresh({width:320,height:568});
  try{
    await finish(page);
    ok("dialog is named and fits the short phone",await page.getByRole("dialog",{name:"Adventure complete!"}).count()===1&&await reachable(page,"#runChest"));
    await page.keyboard.press("Tab");ok("keyboard reaches the picture-led chest action",await page.evaluate(()=>document.activeElement.id==="runChest"));
    await openAndClaim(page);
    ok("Done stays reachable without horizontal overflow",await reachable(page,"#runDone")&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }finally{await context.close();}
});
await scenario("paid-state parent handoff",async()=>{
  const {context,page}=await fresh({paid:true,width:320,height:568});
  try{
    await finish(page);await openAndClaim(page);
    ok("paid-state uses a grown-up handoff after the chest",/Show a grown-up/i.test(await page.locator("#runDone").innerText()));
    await page.locator("#runDone").click();await page.waitForLoadState("domcontentloaded");
    const url=new URL(page.url());
    ok("the adult gate preserves the intended destination",url.pathname==="/today.html"&&url.searchParams.get("gate")==="1"&&url.searchParams.get("to")==="/subscribe.html?first=1",page.url());
    ok("arrival at the gate does not spend the offer",await page.evaluate(()=>!localStorage.getItem("sona.planmoment.v1")));
  }finally{await context.close();}
});
// The same finished run in a browser whose website does not sell: there is no
// plan to show a grown-up, so the child is not sent to fetch one. Without this
// the one-time ask could never be spent on the web (only a purchase card on
// screen spends it), and "Show a grown-up" would follow every run, forever.
await scenario("a browser that cannot sell: no parent handoff",async()=>{
  const {context,page,errors}=await fresh({paid:true,web:"0",width:320,height:568});
  try{
    await finish(page);await openAndClaim(page);
    const end=await page.evaluate(()=>({premium:Sona.premium(),due:Sona.planEligible(),label:document.getElementById("runDone").textContent,line:document.getElementById("runPractice").textContent}));
    ok("web sales off: a family on the free version ends the run on a plain Done",end.premium===false&&end.due===false&&end.label==="Done"&&!/grown-up|show them/i.test(end.label+" "+end.line),end);
    await page.locator("#runDone").click();await page.waitForURL(/today\.html/);
    const url=new URL(page.url());
    ok("…which goes Home: no grown-ups gate, no plan screen",url.pathname==="/today.html"&&!url.searchParams.has("gate")&&!url.searchParams.has("to"),page.url());
    ok("…and the one-time ask is unspent, for the day they open the app",await page.evaluate(()=>!localStorage.getItem("sona.planmoment.v1")));
    ok("web sales off: completion has no page errors",errors.length===0,errors);
  }finally{await context.close();}
});
await scenario("replays and empty sessions never add practice",async()=>{
  const {context,page}=await fresh({replay:true});
  try{
    await finish(page);await openAndClaim(page);
    const state=await evidence(page);
    ok("demo replay creates no session, coins, words or daily score",state.progress.sessions.length===0&&state.progress.totals.coins===0&&state.progress.totals.words===0&&!state.daily.playedToday,state);
    ok("demo replay creates no extra sticker",await page.evaluate(()=>Object.keys(Sona.stickersEarned()).length===0));
    const unchanged=await page.evaluate(()=>{var before=JSON.stringify(Sona.getProgress());Sona.recordSession({words:[]});Sona.recordSession({activity:"adventure",rounds:5,sound:"R",tries:0});return before===JSON.stringify(Sona.getProgress());});
    ok("zero-try sessions never create stats or a streak",unchanged);
  }finally{await context.close();}
});

await scenario("retained parked-game fixture completes the younger-child adventure",async()=>{
  const {context,page,errors}=await fresh({width:375,height:812,parkedEngineFixture:true,voicedMic:true});
  try{
    await page.evaluate(()=>{
      sessionStorage.removeItem("sona.run.v1");localStorage.setItem("sona.micok","1");
      var p=JSON.parse(localStorage.getItem("sona.profile.v1"));p.childAge="3";p.focusSounds=["M"];localStorage.setItem("sona.profile.v1",JSON.stringify(p));
    });
    await page.goto(origin+"/charge.html?daily=1&first=feed");
    const seen=[];
    for(let round=0;round<5;round++){
      await page.waitForURL(/arcade-(feed|bubbles|peekaboo)\.html/, {timeout:7000});
      const game=new URL(page.url()).pathname.match(/arcade-(.+)\.html/)[1];seen.push(game);
      if(game==="feed"){
        await page.locator("#startBtn").click();   // the round starts on Let's play (1 Oct 2026)
        for(let turn=0;turn<5;turn++){
          await page.waitForFunction(()=>window.turnLive===true);
          const label=await page.locator("#bMain").innerText();
          const word=label.match(/Where's the (.+)\?/)[1];
          // the child says it, then feeds the picture
          await page.waitForFunction(()=>window.__mic.live===1);await page.waitForTimeout(450);
          await page.evaluate(()=>{window.__mic.voice=true;});
          await page.waitForFunction(()=>!document.getElementById("grid").classList.contains("locked"));
          await page.evaluate(()=>{window.__mic.voice=false;});
          await page.locator("#grid .cardBtn").filter({has:page.locator(".w",{hasText:word})}).first().click();
        }
        await page.locator("#endOvl.show").waitFor();
        if(round===0){
          await page.locator("#goHome").click();await page.waitForURL(/today.html/);
          ok("Home leaves the saved adventure parked in the library",await page.locator('#libraryApp').isVisible());
          await page.goto(origin+"/charge.html?daily=1");
          await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem("sona.run.v1")).round===1);
          ok("an explicit legacy resume preserves the completed simple game",await page.evaluate(()=>JSON.parse(sessionStorage.getItem("sona.run.v1")).scores.length===1));
        }else await page.locator("#again").click();
      }else if(game==="bubbles"){
        // Bubble Pop needs the word too (rebuilt 1 Oct 2026, on the Say & Play
        // engine): say it, pop every bubble, five times, then the giant one.
        // The engine knows nothing of this adventure; the page banks the round
        // and sends the end card's button back to it.
        await page.locator("#startBtn").click();
        const box=await page.locator("#sky").boundingBox();
        const sky=()=>page.evaluate(()=>window.Bubbles.snapshot());
        for(let turn=0;turn<5;turn++){
          await page.waitForFunction(()=>window.__sayplay&&window.__sayplay.listening===true,null,{timeout:8000});
          await page.evaluate(()=>{window.__mic.voice=true;});
          await page.waitForFunction(()=>window.__bubbles.state==="ready"&&window.__bubbles.bubbles.length>0&&window.__bubbles.bubbles.every(b=>b.out),null,{timeout:6000});
          await page.evaluate(()=>{window.__mic.voice=false;});
          for(let i=0;i<40;i++){
            const s=await sky();if(!s.left)break;
            const b=s.bubbles.find(x=>x.out&&!x.gold)||s.bubbles.find(x=>x.out);
            if(b)await page.mouse.click(box.x+b.x,box.y+b.y);
            await page.waitForTimeout(60);
          }
        }
        await page.waitForFunction(()=>window.__bubbles.state==="giant"&&window.__bubbles.giant&&window.__bubbles.giant.up,null,{timeout:8000});
        const big=(await sky()).giant;await page.mouse.click(box.x+big.x,box.y+big.y);
        await page.locator("#endOvl.show").waitFor({timeout:9000});
        ok("Bubble Pop banks its round for the adventure: the end card says Keep going",/Keep going/.test(await page.locator("#again").innerText()));
        await page.locator("#again").click();
      }else{
        await page.locator("#startGame").click();
        for(let turn=0;turn<5;turn++){
          await page.locator("[data-door]").first().click();
          await page.locator("#nextTurn").click();
        }
        await page.locator("#playAgain").click();
      }
      if(round<4)await page.waitForFunction(n=>location.pathname==="/charge.html"||JSON.parse(sessionStorage.getItem("sona.run.v1")).round>n,round);
    }
    await page.locator("#runOvl.show").waitFor({timeout:7000});
    ok("the retained simple-engine fixture exercises all three games across five untimed turns",seen.length===5&&seen.every(x=>["feed","bubbles","peekaboo"].includes(x))&&seen.includes("bubbles")&&seen.includes("peekaboo"),seen);
    const state=await evidence(page);
    ok("all discoveries can finish without inventing spoken practice",state.run.round===5&&state.progress.sessions.length===0&&state.progress.totals.words===0&&state.reps===0&&Object.keys(state.outcomes).length===0&&!state.progress.streak.lastDate,state);
    await openAndClaim(page);await page.locator("#runDone").click();await page.waitForURL(/today.html/);
    ok("younger child returns Home after the final chest",await page.evaluate(()=>Sona.dailyInfo().playedToday));
    ok("younger adventure has no page errors",errors.length===0,errors);
  }finally{await context.close();}
});

await scenario("human practice prompt respects sound settings", async () => {
  const { context, page } = await fresh();
  try {
    await finish(page);
    // Exercise the actual prompt function with human clips enabled locally.
    // 29 Sep 2026: the prompt is Echo's words with Rachel's recorded sound in
    // the letter's place, joined into one clip. Playback is a silent spy: no
    // file or OS audio device is ever played.
    const results = await page.evaluate(async () => {
      const oldPCM = playPCM, oldFetch = window.fetch, oldHuman = HUMANCLIPS, oldItem = ITEM, oldProfile = profile;
      const calls = [];
      window.fetch = (url, opts) => {
        let text = null; try { text = JSON.parse(opts.body).text; } catch (e) {}
        calls.push({ fetch: String(url), text });
        if (String(url) === "/api/tts") return Promise.resolve(new Response(new Uint8Array(4800), { headers: { "X-Sona-Voice-Keep": "0" } }));
        return oldFetch(url, opts);
      };
      playPCM = (bytes) => { calls.push({ play: bytes.byteLength, volume: speechVolume() }); return Promise.resolve(true); };
      HUMANCLIPS = true; ITEM = { level: "isolation" };
      const results = [];
      try {
        for (const settings of [{ volume: 0, voiceOn: true }, { volume: 0.4, voiceOn: false }, { volume: 0.35, voiceOn: true }]) {
          profile = Object.assign({}, oldProfile, settings); calls.length = 0;
          await playPrompt(); results.push({ settings, calls: calls.slice() });
        }
      } finally { window.fetch = oldFetch; playPCM = oldPCM; HUMANCLIPS = oldHuman; ITEM = oldItem; profile = oldProfile; }
      return results;
    });
    ok("zero volume never starts the human prompt", results[0].calls.length === 0, results[0]);
    ok("disabled voice never starts the human prompt", results[1].calls.length === 0, results[1]);
    const c = results[2].calls, plays = c.filter((x) => x.play);
    // 2 Oct 2026: the prompt hands the turn over with "Go!", Echo's own clip,
    // asked for on its own (charge.html, GO, ON ITS OWN) and joined on.
    const tts = c.filter((x) => x.fetch === "/api/tts");
    ok("a human prompt asks for her one R, Echo's two halves, and \"Go!\" on its own", c.filter((x) => x.fetch === "/coach/say-echo/R-sound.wav").length === 1 && tts.filter((x) => x.text !== "Go!").length === 2 && tts.filter((x) => x.text === "Go!").length === 1, c);
    ok("a human prompt plays once, as one clip, at the selected positive volume", plays.length === 1 && plays[0].volume === 0.35 && plays[0].play > 9600, c);
  } finally { await context.close(); }
});

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log(`\n${assertions} assertions, ${failures} failures (${publicRoot})`);
process.exitCode = failures ? 1 : 0;
