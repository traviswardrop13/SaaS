// Real Fruit Slice lifecycle, fake speech/mic edges: a retry must speak before listening.
import {createServer} from 'http';
import {readFileSync} from 'fs';
import path from 'path';
import {chromium,ROOT,launchOpts} from './_env.mjs';
const root=process.env.SONATEST_PUBLIC_ROOT||ROOT;
const server=createServer((req,res)=>{try{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(readFileSync(path.join(root,req.url.split('?')[0])));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(launchOpts());let failed=0;
function ok(name,value,detail){console.log((value?'PASS ':'FAIL ')+name+(value||detail===undefined?'':' → '+JSON.stringify(detail)));if(!value)failed++;}
try{
 const context=await browser.newContext();await context.route('**/api/tts',route=>route.fulfill({body:Buffer.alloc(4800),contentType:'application/octet-stream'}));
 await context.addInitScript(()=>{
  localStorage.setItem('sona.profile.v1',JSON.stringify({onboarded:true,focusSounds:['P'],voiceOn:true,soundOn:false,volume:.6,earlyAdopter:true}));sessionStorage.setItem('sona.play.token','arcade-slice.html');
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"ios",Plugins:{}};
  // h.media is Echo's voice and Rachel's clips: the page waits for each to end.
  // A chime is media in the app too since 2 Oct 2026 (the last block below),
  // played and not waited on, and is kept apart in h.chimes. (The seed's
  // soundOn:false is healed to on by getProfile, so the chimes do ring here.)
  window.h={media:[],chimes:[],mic:0,hidden:false};Object.defineProperty(document,'hidden',{get:()=>h.hidden});
  window.Audio=function(src){const a={src,play(){(a.onended||a.onplaying?h.media:h.chimes).push(a);return Promise.resolve();},pause(){a.paused=true;},removeAttribute(){},load(){}};return a;};
  navigator.mediaDevices.getUserMedia=()=>{h.mic++;return new Promise(()=>{});};
 });
 const page=await context.newPage(),errors=[],texts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/api/tts'))texts.push(JSON.parse(r.postData()).text);});await page.goto(base+'/arcade-slice.html?from=charge');
 await page.waitForFunction(()=>typeof crash==='function');await page.evaluate(()=>crash());
 await page.waitForFunction(()=>h.media.length===1,{},{timeout:2500}).catch(()=>{});
 ok('retry speaks the instruction before asking for microphone',await page.evaluate(()=>h.media.length===1&&h.mic===0)&&texts.includes('To keep playing, say'));
 if(await page.evaluate(()=>h.media.length===1)){
  await page.evaluate(()=>h.media[0].onended());await page.waitForFunction(()=>h.media.length===2);
  // 29 Sep 2026: ONE take of her sound (tools/soundclips.mjs), not the demo that repeats it.
  ok('retry models P using Rachel audio rather than TTS spelling',await page.evaluate(()=>h.media[1].src==='/coach/say-echo/P-sound.wav'&&h.mic===0));
  await page.locator('#revDone').click();await page.waitForTimeout(1100);
  ok('leaving retry cancels audio without opening microphone',await page.evaluate(()=>h.media[1].paused&&h.mic===0));
  await page.evaluate(()=>{playing=true;crash();});await page.waitForFunction(()=>h.media.length===3);await page.evaluate(()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
  ok('backgrounding cancels retry narration',await page.evaluate(()=>h.media[2].paused&&h.mic===0));
  await page.evaluate(()=>{h.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>h.media.length===4);await page.evaluate(()=>h.media[3].onended());await page.waitForFunction(()=>h.media.length===5);await page.evaluate(()=>h.media[4].onended());
  // 2 Oct 2026 (Travis: "i also wanna try to have the 11 labs voice say
  // 'Go!'"): after Rachel's take Echo says "Go!", in the same media voice,
  // and the mic still waits for it and for the quiet tail after it.
  await page.waitForFunction(()=>h.media.length===6,{},{timeout:2500}).catch(()=>{});
  ok('after her sound, Echo says "Go!" as media, with no microphone yet',await page.evaluate(()=>h.media.length===6&&h.media[5].src.startsWith('blob:')&&h.mic===0)&&texts.includes('Go!'),{texts});
  // The mic waits the 250 ms tail every listening page keeps after a voice
  // line (2 Oct 2026, review: the 900 ms chime window left a child who
  // answered right on "Go!" talking to a closed mic), then opens promptly.
  if(await page.evaluate(()=>h.media.length===6))await page.evaluate(()=>h.media[5].onended());const goEnd=await page.evaluate(()=>performance.now());await page.waitForTimeout(150);
  ok('microphone waits for the sound tail',await page.evaluate(()=>h.mic===0));await page.waitForFunction(()=>h.mic===1);
  ok('microphone opens within a moment of the tail, not the old 900 ms window',await page.evaluate((t)=>performance.now()-t<800,goEnd));
  ok('microphone starts after completed spoken retry',await page.evaluate(()=>h.mic===1));
 }
 const wav=await page.evaluate(async()=>{if(!Sona.pcmWave)return null;var bytes=new Uint8Array([0,128,0,0,255,127]),blob=Sona.pcmWave(bytes),data=new Uint8Array(await blob.arrayBuffer()),v=new DataView(data.buffer);return {type:blob.type,rate:v.getUint32(24,true),channels:v.getUint16(22,true),samples:Array.from(data.slice(44))};});
 ok('media wrapper preserves samples and mono 24kHz format',wav?.type==='audio/wav'&&wav.rate===24000&&wav.channels===1&&JSON.stringify(wav.samples)==='[0,128,0,0,255,127]');
 // Feed Echo starts on its Let's play card, after a grown-up's yes to the mic (here, given in setup)
 await page.evaluate(()=>localStorage.setItem('sona.micok','1'));
 await page.goto(base+'/arcade-feed.html');
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>h.media.length>0,{},{timeout:2500}).catch(()=>{});
 ok('Feed Echo generated voice uses native media playback at the profile\'s level (a saved 60% plays at the normal 0.8 since 30 Sep 2026)',await page.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.8&&h.media[0].volume===Sona.getProfile().volume));
 await page.evaluate(()=>{h.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
 ok('Feed Echo stops its native voice when backgrounded',await page.evaluate(()=>h.media.length>0&&h.media[0].paused));
 ok('no runtime errors',errors.length===0);await context.close();
 // 1 Oct 2026 ("Sounds not working again on books", the call-volume slider on
 // screen): the book reader, the word games and Bubble Pop play Echo's voice
 // as media in the app too, never Web Audio, and a voice that won't start
 // still reaches the child as the browser voice.
 {
  // ttsTexts: what each voice request asked to be said (2 Oct 2026: "Go!"
  // follows the word as its own line, and plays as media too)
  const ttsTexts=[];
  const ctx2=await browser.newContext({reducedMotion:'reduce'});await ctx2.route('**/api/tts',route=>{try{ttsTexts.push(JSON.parse(route.request().postData()).text);}catch(e){}route.fulfill({body:Buffer.alloc(48000),contentType:'application/octet-stream'});});
  await ctx2.addInitScript(()=>{
   localStorage.setItem('sona.profile.v1',JSON.stringify({onboarded:true,focusSounds:['R'],childAge:'4',voiceOn:true,soundOn:false,volume:.6,earlyAdopter:true}));localStorage.setItem('sona.micok','1');
   window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"ios",Plugins:{}};
   window.h={media:[],chimes:[],mic:0,synth:[],refuse:false,pcm:0};
   window.Audio=function(src){const a={src,paused:false,play(){(a.onended||a.onplaying?h.media:h.chimes).push(a);if(h.refuse)return Promise.reject(new Error('NotAllowedError'));setTimeout(()=>a.onplaying&&a.onplaying(),0);return Promise.resolve();},pause(){a.paused=true;},removeAttribute(){},load(){}};return a;};
   window.SpeechSynthesisUtterance=function(t){this.text=t;};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speaking:false,paused:false,speak(u){h.synth.push(u.text);setTimeout(()=>u.onend&&u.onend(),20);},cancel(){},resume(){},getVoices:()=>[]}});
   // a voice line through Web Audio is a buffer longer than the 1-sample unlock
   const AC=window.AudioContext;if(AC){const make=AC.prototype.createBuffer;AC.prototype.createBuffer=function(c,n,r){if(n>1)h.pcm++;return make.call(this,c,n,r);};}
   navigator.mediaDevices.getUserMedia=()=>{h.mic++;return new Promise(()=>{});};
  });
  const pg=await ctx2.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(base+'/library.html');await pg.waitForFunction(()=>document.querySelectorAll('#shelf .bookBtn').length>0);
  await pg.evaluate(()=>[...document.querySelectorAll('#shelf .bookBtn')].find(b=>b.querySelector('.bt').textContent==='Rory and the Rainbow').click());
  await pg.waitForTimeout(150);await pg.evaluate(()=>document.getElementById('bkNext').click());
  await pg.waitForFunction(()=>h.media.length>0,{},{timeout:4000}).catch(()=>{});
  ok('the book reads its page as native media at the profile\'s level (a saved 60% plays at the normal 0.8 since 30 Sep 2026), never through Web Audio',await pg.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.8&&h.pcm===0));
  await pg.evaluate(()=>document.getElementById('bkNext').click());
  ok('turning the page stops the line in flight',await pg.evaluate(()=>h.media.length>0&&h.media[0].paused));
  await pg.waitForFunction(()=>h.media.length>1,{},{timeout:4000}).catch(()=>{});
  await pg.evaluate(()=>{h.refuse=true;const a=h.media[h.media.length-1];if(a&&a.onended)a.onended();});await pg.waitForTimeout(300);
  await pg.evaluate(()=>document.getElementById('bkHear').click());
  await pg.waitForFunction(()=>h.synth.length>0,{},{timeout:4000}).catch(()=>{});
  ok('a book voice the phone refuses to start is read by the browser voice instead of silence',await pg.evaluate(()=>h.synth.length>0&&h.pcm===0),await pg.evaluate(()=>({synth:h.synth,media:h.media.length})));
  await pg.evaluate(()=>{h.refuse=false;h.media=[];h.synth=[];});
  await pg.goto(base+'/arcade-hoops.html');await pg.waitForFunction(()=>!!document.getElementById('startBtn'));
  await pg.evaluate(()=>{h.media=[];document.getElementById('startBtn').click();});
  await pg.waitForFunction(()=>h.media.length>0,{},{timeout:5000}).catch(()=>{});
  ok('a word game (Hoops) says its word as native media at the profile\'s level (a saved 60% plays at the normal 0.8 since 30 Sep 2026)',await pg.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.8&&h.pcm===0),await pg.evaluate(()=>({media:h.media.length,pcm:h.pcm})));
  await pg.evaluate(()=>{const a=h.media[0];if(a&&a.onended)a.onended();});
  await pg.waitForFunction(()=>h.media.length>1,{},{timeout:4000}).catch(()=>{});
  ok('…then "Go!", as its own line, also as native media and never Web Audio',await pg.evaluate(()=>h.media.length>1&&h.media[1].src.startsWith('blob:')&&h.media[1].volume===.8&&h.pcm===0&&h.synth.length===0)&&ttsTexts[ttsTexts.length-1]==='Go!'&&/^Say\.\.\. [a-z]+\.$/i.test(ttsTexts[ttsTexts.length-2]),{texts:ttsTexts.slice(-2),media:await pg.evaluate(()=>h.media.length)});
  const bubblesFrom=ttsTexts.length;
  // Bubble Pop is a word game on the same engine since 1 Oct 2026: Echo asks
  // for the word straight after Let's play, before any bubble exists
  await pg.goto(base+'/arcade-bubbles.html');await pg.waitForFunction(()=>!!document.getElementById('startBtn'));
  await pg.evaluate(()=>{h.media=[];document.getElementById('startBtn').click();});
  await pg.waitForFunction(()=>h.media.length>0,{},{timeout:5000}).catch(()=>{});
  ok('Bubble Pop says its word as native media at the profile\'s level (a saved 60% plays at the normal 0.8 since 30 Sep 2026)',await pg.evaluate(()=>h.media.length>0&&h.media[0].src.startsWith('blob:')&&h.media[0].volume===.8&&h.pcm===0),await pg.evaluate(()=>({media:h.media.length,pcm:h.pcm})));
  await pg.evaluate(()=>{const a=h.media[0];if(a&&a.onended)a.onended();});
  await pg.waitForFunction(()=>h.media.length>1,{},{timeout:4000}).catch(()=>{});
  // "Go!" is one clip per phone: Hoops above already saved it, so Bubble Pop
  // asks the voice service for its word alone and plays "Go!" from the phone.
  // (When Bubble Pop picks the word Hoops just asked for, about one round in
  // ten, the phone has that line saved too and nothing is asked for at all.)
  ok('Bubble Pop: …then "Go!", as its own line from the clip this phone already saved, also as native media and never Web Audio',await pg.evaluate(()=>h.media.length>1&&h.media[1].src.startsWith('blob:')&&h.media[1].volume===.8&&h.pcm===0&&h.synth.length===0)&&ttsTexts.length<=bubblesFrom+1&&!ttsTexts.slice(bubblesFrom).includes('Go!'),{texts:ttsTexts.slice(bubblesFrom),media:await pg.evaluate(()=>h.media.length)});
  ok('books and word games: no runtime errors',errs.length===0,errs);await ctx2.close();
 }
 // 1 Oct 2026 ("start with isolation then ree rah roh then rot"): for a child
 // on R the card between waves asks one syllable. Nothing past the bare sound
 // is recorded, so Echo says it himself: ONE line, as media like every voice
 // line in the app, with no recording after it, and the mic waits for it. A
 // line that will not load, or that the phone refuses to start, puts the card
 // on the bare sound and Rachel's recording at once: never a syllable on
 // screen that nobody said.
 {
  const ctx3=await browser.newContext();let down=false;
  await ctx3.route('**/api/tts',route=>down?route.fulfill({status:503,body:'{}'}):route.fulfill({body:Buffer.alloc(4800),contentType:'application/octet-stream'}));
  await ctx3.addInitScript(()=>{
   localStorage.setItem('sona.profile.v1',JSON.stringify({onboarded:true,childAge:'7',focusSounds:['R'],voiceOn:true,soundOn:false,volume:.6,earlyAdopter:true}));sessionStorage.setItem('sona.play.token','arcade-slice.html');
   window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"ios",Plugins:{}};
   // h.media: the lines the page waits on; the chimes (media in the app since
   // 2 Oct 2026, see the last block) go to h.chimes
   window.h={media:[],chimes:[],mic:0,refuse:sessionStorage.getItem('test.refuse')==='1'};
   window.Audio=function(src){const a={src,play(){(a.onended||a.onplaying?h.media:h.chimes).push(a);return h.refuse&&/^blob:/.test(src)?Promise.reject(new Error('NotAllowedError')):Promise.resolve();},pause(){a.paused=true;},removeAttribute(){},load(){}};return a;};
   navigator.mediaDevices.getUserMedia=()=>{h.mic++;return new Promise(()=>{});};
  });
  const pg=await ctx3.newPage(),errs=[],lines=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('request',r=>{if(r.url().endsWith('/api/tts'))lines.push(JSON.parse(r.postData()).text);});
  const card=async()=>{await pg.waitForFunction(()=>typeof startWave==='function');await pg.evaluate(()=>{waveGot=WAVES[wave].goal;});await pg.waitForFunction(()=>h.media.length===1,{},{timeout:8000}).catch(()=>{});};
  const title=()=>pg.evaluate(()=>document.getElementById('revTitle').textContent);
  // The card's voice (/arcade-sayit.js, 2 Oct 2026) asks for its own two
  // lines, "To keep playing, say" and "Go!", as the page loads, whatever the
  // card will ask: they are set aside, and own() is what the card asked for.
  const own=()=>lines.filter(t=>t!=='To keep playing, say'&&t!=='Go!');
  await pg.goto(base+'/arcade-slice.html?from=charge');await card();
  ok('a syllable card says its ask in ONE line, as native media, before any microphone',own().length===1&&/^To keep playing, say\.\.\. r(ee|ah|oh)\.$/.test(own()[0])&&await pg.evaluate(()=>h.media.length===1&&h.media[0].src.startsWith('blob:')&&h.mic===0),lines);
  ok('…and the card shows that same syllable',(await title())==='Say “'+(own()[0]||'').replace(/^.*\.\.\. |\.$/g,'')+'” for wave 2!',await title());
  await pg.evaluate(()=>h.media[0].onended());await pg.waitForFunction(()=>h.media.length===2,{},{timeout:4000}).catch(()=>{});
  ok('no recording follows a syllable: then "Go!", as native media too, and the microphone waits for it',await pg.evaluate(()=>h.media.length===2&&h.media[1].src.startsWith('blob:')&&h.mic===0));
  await pg.evaluate(()=>h.media[1].onended());await pg.waitForFunction(()=>h.mic===1);
  ok('the microphone starts after "Go!"',own().length===1&&await pg.evaluate(()=>h.mic===1&&h.media.length===2));
  down=true;await pg.goto(base+'/arcade-slice.html?from=charge');await card();
  ok('a syllable line that will not load: the card asks the bare sound and plays Rachel\'s recording at once, with no second line',(await title())==='Say “rrrr” for wave 2!'&&own().length===2&&await pg.evaluate(()=>h.media.length===1&&h.media[0].src==='/coach/say-echo/R-sound.wav'&&h.mic===0),{title:await title(),lines});
  down=false;await pg.evaluate(()=>sessionStorage.setItem('test.refuse','1'));await pg.goto(base+'/arcade-slice.html?from=charge');
  await pg.waitForFunction(()=>typeof startWave==='function');await pg.evaluate(()=>{waveGot=WAVES[wave].goal;});await pg.waitForFunction(()=>h.media.length===2,{},{timeout:8000}).catch(()=>{});
  ok('a syllable line the phone refuses to start: the same, the bare sound and its recording',(await title())==='Say “rrrr” for wave 2!'&&own().length===3&&await pg.evaluate(()=>h.media.length===2&&h.media[0].src.startsWith('blob:')&&h.media[1].src==='/coach/say-echo/R-sound.wav'&&h.mic===0),{title:await title(),lines});
  ok('syllable card: no runtime errors',errs.length===0,errs);await ctx3.close();
 }
 // 2 Oct 2026: THE CHIMES ARE MEDIA IN THE APP TOO. The "heard you" chime lands
 // the moment the mic closes, exactly when an iPhone plays Web Audio as a quiet
 // phone call (and not at all with the ringer off). Hoops is played for real
 // here: a tone stands in for the child's voice, the game hears it, closes the
 // mic and chimes. Every media element the page plays is logged with how many
 // mics were live at that instant; every Web Audio oscillator and buffer the
 // page makes is counted.
 {
  const ctx4=await browser.newContext({reducedMotion:'reduce'});await ctx4.route('**/api/tts',route=>route.fulfill({body:Buffer.alloc(4800),contentType:'application/octet-stream'}));
  await ctx4.addInitScript(()=>{
   // t.mute / t.web: the same seed with Sona muted (a level of zero is the
   // only mute there is: getProfile heals soundOn:false), or in a plain browser
   localStorage.setItem('sona.profile.v1',JSON.stringify({onboarded:true,focusSounds:['R'],childAge:'4',voiceOn:true,soundOn:true,volume:localStorage.getItem('t.mute')==='1'?0:.6,earlyAdopter:true}));localStorage.setItem('sona.micok','1');
   if(localStorage.getItem('t.web')!=='1')window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"ios",Plugins:{}};
   window.h={media:[],tracks:[],mic:0,osc:0,pcm:0,refuse:false,hang:false,last:null};
   h.live=()=>h.tracks.filter(t=>t.readyState==='live').length;
   // refuse: the phone will not start a media element. hang: play() is still
   // being answered when the element is paused, which rejects it (AbortError).
   // a.voice: a line the page waits on to end (Echo); a chime is not waited on.
   window.Audio=function(src){const a={src,paused:true,currentTime:0,plays:0,
    play(){a.plays++;a.paused=false;a.micLive=h.live();h.last=a;if(!h.media.includes(a)){a.voice=!!(a.onended||a.onplaying);h.media.push(a);}
     if(h.refuse)return Promise.reject(new DOMException('refused','NotAllowedError'));
     if(h.hang)return new Promise((_,no)=>{a.cut=()=>no(new DOMException('cut short','AbortError'));});
     setTimeout(()=>a.onplaying&&a.onplaying(),0);setTimeout(()=>a.onended&&a.onended(),40);return Promise.resolve();},
    pause(){a.paused=true;if(a.cut){const cut=a.cut;a.cut=null;cut();}},removeAttribute(){},load(){}};return a;};
   const AC=window.AudioContext,mkOsc=AC.prototype.createOscillator,mkBuf=AC.prototype.createBuffer;
   AC.prototype.createOscillator=function(){h.osc++;return mkOsc.call(this);};
   AC.prototype.createBuffer=function(c,n,r){if(n>1)h.pcm++;return mkBuf.call(this,c,n,r);};
   // the microphone: a real stream carrying a 300 Hz tone, silent until h.talk()
   navigator.mediaDevices.getUserMedia=()=>{h.mic++;const c=h.micCtx||(h.micCtx=new AC());c.resume();const o=mkOsc.call(c),g=c.createGain(),d=c.createMediaStreamDestination();o.frequency.value=300;g.gain.value=0;o.connect(g);g.connect(d);o.start();h.micGain=g;h.tracks.push(d.stream.getTracks()[0]);return Promise.resolve(d.stream);};
   // the child says the word as often as the game asks (two times since 1 Oct
   // 2026): each saying lasts until the game has counted it, then a breath,
   // then the next, until the game takes the word. Paced by what the game
   // heard, not by a clock, so a busy machine's slow frames cannot merge two.
   h.talk=()=>{let said=__sayplay.said,quietAt=0;h.micGain.gain.value=.5;const t=setInterval(()=>{const sp=window.__sayplay;if(!sp||sp.phase!=='turn'){h.micGain.gain.value=0;clearInterval(t);return;}
    if(!quietAt&&sp.said!==said){said=sp.said;quietAt=performance.now();h.micGain.gain.value=0;}else if(quietAt&&performance.now()-quietAt>700){quietAt=0;h.micGain.gain.value=.5;}},30);};
  });
  const pg=await ctx4.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const tick=()=>pg.waitForTimeout(60);
  await pg.goto(base+'/arcade-hoops.html');await pg.locator('#startBtn').click();
  const listening=await pg.waitForFunction(()=>window.__sayplay&&__sayplay.listening===true&&h.live()===1,{},{timeout:9000}).then(()=>true,()=>false);
  const n=await pg.evaluate(()=>{const n=h.media.length;h.talk();return n;});
  await pg.waitForFunction(n=>h.media.length>n,n,{timeout:10000}).catch(()=>{});
  const heard=await pg.evaluate(async n=>{const a=h.media[n];if(!a)return {phase:__sayplay.phase,media:h.media.length,osc:h.osc,mic:h.mic};
   const b=new DataView(await(await fetch(a.src)).arrayBuffer());let peak=0;for(let i=44;i+1<b.byteLength;i+=2)peak=Math.max(peak,Math.abs(b.getInt16(i,true)));
   return {phase:__sayplay.phase,blob:a.src.startsWith('blob:'),micLive:a.micLive,osc:h.osc,pcm:h.pcm,riff:String.fromCharCode(b.getUint8(0),b.getUint8(1),b.getUint8(2),b.getUint8(3)),rate:b.getUint32(24,true),secs:+((b.byteLength-44)/2/b.getUint32(24,true)).toFixed(2),peak:+(peak/32767).toFixed(3)};},n);
  ok('the app, Hoops: Echo asks, the mic opens, and the child\'s word is heard',listening&&heard.phase==='play',heard);
  ok('the app plays the "heard you" chime as a media element, once the mic has closed',heard.blob===true&&heard.micLive===0,heard);
  ok('…and never through Web Audio: not one oscillator or buffer was made for it',heard.osc===0&&heard.pcm===0,heard);
  ok('the chime is a short recording with its level in the samples (an iPhone gives a media element no volume): 0.34 s, peaking near 0.4 of full level',heard.riff==='RIFF'&&heard.rate===24000&&heard.secs===.34&&heard.peak>.3&&heard.peak<.6,heard);
  const again=await pg.evaluate(async n=>{const a=h.media[n],els=h.media.length,plays=a.plays;Sona.sfx.correct();await new Promise(r=>setTimeout(r,30));return {els:h.media.length-els,plays:a.plays-plays,osc:h.osc};},n);
  ok('one element a chime: the same chime again replays it from the top',again.els===0&&again.plays===1&&again.osc===0,again);
  const all=await pg.evaluate(()=>{const names=Object.keys(Sona.sfx).filter(k=>k!=='stop');names.forEach(k=>Sona.sfx[k]());names.forEach(k=>Sona.sfx[k]());const chimes=h.media.filter(a=>!a.voice);return {names,elements:chimes.length,blobs:chimes.every(a=>a.src.startsWith('blob:')),osc:h.osc};});
  ok('every Sona chime (tap, the win, the coin…) plays as media in the app, one element each however often it rings',all.names.length>=8&&all.elements===all.names.length&&all.blobs&&all.osc===0,all);
  // a page going to the background stops a chime in flight (Sona.sfx.stop),
  // and the play() that pause cuts short is not a refusal
  const cut=await pg.evaluate(async()=>{h.hang=true;Sona.sfx.complete();const a=h.last;Sona.sfx.stop();await new Promise(r=>setTimeout(r,30));h.hang=false;const plays=h.media.reduce((s,x)=>s+x.plays,0);Sona.sfx.tap();await new Promise(r=>setTimeout(r,30));return {paused:a.paused,osc:h.osc,next:h.media.reduce((s,x)=>s+x.plays,0)-plays};});
  ok('a chime stopped in flight is paused, makes no Web Audio, and the next chime is still media',cut.paused===true&&cut.osc===0&&cut.next===1,cut);
  const refused=await pg.evaluate(async()=>{h.refuse=true;Sona.sfx.correct();await new Promise(r=>setTimeout(r,30));const first=h.osc;h.refuse=false;const plays=h.media.reduce((s,x)=>s+x.plays,0);Sona.sfx.tap();await new Promise(r=>setTimeout(r,30));return {first,after:h.osc-first,plays:h.media.reduce((s,x)=>s+x.plays,0)-plays};});
  ok('a chime the phone refuses to start as media is played through Web Audio instead, never silence, and so is every chime after it',refused.first>0&&refused.after>0&&refused.plays===0,refused);
  // the books' word moment and Feed Echo ring the same chimes
  for(const [name,file] of [['Feed Echo','arcade-feed.html'],['the book reader','library.html']]){
   await pg.goto(base+'/'+file);await pg.waitForFunction(()=>!!(window.Sona&&Sona.sfx));
   const r=await pg.evaluate(async()=>{const els=h.media.length;Sona.sfx.tap();Sona.sfx.correct();await new Promise(r=>setTimeout(r,30));return {made:h.media.length-els,blobs:h.media.slice(els).every(a=>a.src.startsWith('blob:')),osc:h.osc};});
   ok(name+' in the app: its chimes are media, never Web Audio',r.made===2&&r.blobs&&r.osc===0,r);
  }
  const src=f=>readFileSync(path.join(root,f),'utf8');
  ok('the word games, the books\' word moment and Feed Echo all ring Sona\'s chimes (one switch, in sona.js)',/S\.sfx\[n\]\(\)/.test(src('sayplay.js'))&&/S\.sfx\[name\]\(\)/.test(src('saycheck.js'))&&/S\.sfx\[n\]\(\)/.test(src('arcade-feed.html')));
  await pg.evaluate(()=>localStorage.setItem('t.mute','1'));await pg.goto(base+'/arcade-feed.html');await pg.waitForFunction(()=>!!(window.Sona&&Sona.sfx));
  const muted=await pg.evaluate(async()=>{Sona.sfx.correct();Sona.sfx.tap();await new Promise(r=>setTimeout(r,30));return {media:h.media.length,osc:h.osc};});
  ok('a muted Sona plays no chime in the app, as media or any other way',muted.media===0&&muted.osc===0,muted);
  await pg.evaluate(()=>{localStorage.removeItem('t.mute');localStorage.setItem('t.web','1');});await pg.goto(base+'/arcade-feed.html');await pg.waitForFunction(()=>!!(window.Sona&&Sona.sfx));
  const web=await pg.evaluate(async()=>{Sona.sfx.correct();await new Promise(r=>setTimeout(r,30));return {media:h.media.length,osc:h.osc};});
  ok('a browser keeps Web Audio for its chimes',web.media===0&&web.osc>0,web);
  await tick();ok('chimes in the app: no runtime errors',errs.length===0,errs);await ctx4.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
process.exitCode=failed?1:0;
