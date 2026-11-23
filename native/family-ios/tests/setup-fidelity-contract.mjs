// Actual offline rules resources only. No browser, account, network or device permission.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here=dirname(fileURLToPath(import.meta.url));
const rules=resolve(process.argv[2] || resolve(here,'../modules/SonaFamilyRules/Sources/SonaFamilyRules/Rules'));
const host=process.argv[3] ? readFileSync(resolve(process.argv[3]),'utf8') : readFileSync(resolve(rules,'host.js'),'utf8');
const resources=['sona','gamecontent','story-game-copy','charge-selection','say-game-selection','book-word-selection','feed-selection','arcade-checkpoint-selection'];
const sources=resources.map(name=>[name,readFileSync(resolve(rules,name+'.js'),'utf8')]);
const hook=`      // REPORT1: the weekly report's numbers, after today's goal stamp so they
      // count it; at most every 30 minutes, and a no-op unless asked for
      try { _reportTouch(); } catch (e) {}`;
assert.equal(sources[0][1].split(hook).length,2,'same canonical report-hook boundary as NativeFamilyRules.childLedgerProgram');
sources[0][1]=sources[0][1].replace(hook,"      // The native household report owner runs after this child commit.");
const freshProfile={onboarded:false,focusSounds:['R'],earlyAdopter:true,weeklyGoal:3};
function boot(profile={},extra={}) {
  const storage={
    'sona.profile.v1':JSON.stringify({...freshProfile,...profile}),
    'sona.freeera.v1':'post','sona.freeera2.v1':'done','sona.freeera3.v1':'done','sona.freeera4.v1':'done','sona.freeera5.v1':'done',
    ...extra
  };
  const ctx=vm.createContext({});
  vm.runInContext(host,ctx,{filename:'host.js'});
  ctx.nativeInstall(JSON.stringify({storage,canSell:false}));
  for(const [name,source] of sources) vm.runInContext(source,ctx,{filename:name+'.js'});
  return {ctx,storage,run:(operation,input={})=>JSON.parse(ctx.nativeRun(JSON.stringify({operation,input})))};
}
const input=(patch={})=>({name:'Synthetic',age:'6',character:'fox',focusSounds:['S'],mode:'speech',pathReason:'',minutes:5,interests:[],...patch});
function saved(result,key='sona.profile.v1') { assert(result.changed[key],'expected an actual profile delta');return JSON.parse(result.changed[key]); }
function noConsentWrites(result,storage) {
  for(const key of Object.keys(result.changed)) {
    if(key.startsWith('sona.profile.v1')) {
      const before=JSON.parse(storage[key]||'{}'),after=JSON.parse(result.changed[key]);
      for(const field of ['email','weeklyEmail','weeklyReport','reportId']) assert.deepEqual(after[field],before[field],field+' must stay byte-equivalent in generic setup save');
    }
  }
  for(const key of ['sona.setupasks.v1','sona.report.v1','sona.sub.v1','sona.trial.v1','sona.pilot.v1','sona.kids.v1','sona.obdraft.v1']) {
    assert.equal(result.changed[key],undefined,'no generic setup household or scratchpad delta '+key);
    assert(!result.removed.includes(key),'no household or scratchpad removal '+key);
  }
}
let passed=0,failed=0;
function test(label,body) {
  try { body();passed++;console.log('PASS '+label); }
  catch(error) { failed++;console.log('FAIL '+label+': '+error.message); }
}

test('fresh form exposes the canonical first-family flags without guessed sounds',()=>{
  const b=boot();const out=b.run('setupForm'),form=out.result;
  assert.equal(form.askQuestions,true);assert.equal(form.askMinutes,true);assert.equal(form.showSales,true);
  assert.equal(form.askUpdates,true);assert.equal(form.showPlanMoment,true);assert.equal(form.showTherapistLogin,true);
  assert.equal(form.isClinician,false);assert.equal(form.rewalk,false);assert.deepEqual(form.focusSounds,[]);
  assert.equal(form.slot,'');assert.equal(form.isSingleChild,true);assert.deepEqual(out.changed,{});assert.deepEqual(out.removed,[]);
});
test('sound-word projection retains canonical order and all authored examples',()=>{
  const form=boot().run('setupForm').result;
  assert.deepEqual(form.sounds.slice(0,4).map(s=>s.id),['R','S','L','TH']);assert.equal(form.sounds.length,19);
  for(const sound of form.sounds) assert(sound.pieces.map(p=>p.text).join('').length>0);
});
test('previously asked family suppresses all first-family questions and sales',()=>{
  const b=boot({}, {'sona.setupasks.v1':'{"v":2,"therapy":"t_no"}'}),form=b.run('setupForm').result;
  for(const flag of ['askQuestions','askMinutes','showSales','askUpdates','showPlanMoment']) assert.equal(form[flag],false,flag);
  assert.equal(form.showTherapistLogin,true,'login eligibility follows source welcome condition, not asked state');
});
test('second-child projection is child-bound and retains the sibling household email',()=>{
  const b=boot({childName:'Sibling',email:'sibling@example.invalid'}, {
    'sona.kids.v1':'{"list":[{"slot":""},{"slot":"k4"}],"active":"k4","hi":4}',
    'sona.profile.v1@k4':'{"onboarded":false,"childName":"Second Synthetic","childAge":"5","dailyGoal":36}'
  });
  const form=b.run('setupForm').result;
  assert.equal(form.name,'Second Synthetic');assert.equal(form.age,'5');assert.equal(form.slot,'k4');assert.equal(form.isSingleChild,false);
  for(const flag of ['askQuestions','askMinutes','showSales','askUpdates','showPlanMoment','showTherapistLogin']) assert.equal(form[flag],false,flag);
});
test('existing household parent email suppresses only the optional report ask',()=>{
  const b=boot({}, {'sona.sub.v1':'{"active":false,"email":"parent@example.invalid"}'}),form=b.run('setupForm').result;
  assert.equal(form.askQuestions,true);assert.equal(form.showSales,true);assert.equal(form.askUpdates,false);
});
test('verified clinician connection hides the hello login link without granting a role',()=>{
  const b=boot({}, {'sona.slpok':'SYNTHETIC'}),out=b.run('setupForm');
  assert.equal(out.result.showTherapistLogin,false);assert.equal(out.result.isClinician,false);assert.deepEqual(out.changed,{});
});
test('clinician role is projected from the current profile and suppresses family-only steps',()=>{
  const b=boot({role:'slp'}),form=b.run('setupForm',{role:'parent',isClinician:false}).result;
  assert.equal(form.isClinician,true);for(const flag of ['askQuestions','askMinutes','showSales','askUpdates','showPlanMoment']) assert.equal(form[flag],false,flag);
});
test('draft role or injected form flags cannot grant clinician authority',()=>{
  const form=boot().run('setupForm',{role:'slp',isClinician:true,showSales:false}).result;
  assert.equal(form.isClinician,false);assert.equal(form.showSales,true);
});
test('explicit rewalk preserves real age, sounds, mode and every known existing buddy',()=>{
  const b=boot({onboarded:true,childAge:'3',focusSounds:['L'],character:'unicorn',mode:'speech',pathReason:'',interests:['dragons','space']});
  const form=b.run('setupForm',{rewalk:true}).result;
  assert.equal(form.rewalk,true);assert.equal(form.age,'3');assert.equal(form.character,'unicorn');assert.deepEqual(form.focusSounds,['L']);
  assert.equal(form.mode,'speech');assert.equal(form.pathReason,'');assert.deepEqual(form.interests,['space']);
  assert.equal(form.askQuestions,true);assert.equal(form.askMinutes,true);assert.equal(form.showSales,false);assert.equal(form.showPlanMoment,false);assert.equal(form.showTherapistLogin,false);
});
test('only boolean true authorizes a rewalk projection',()=>{
  for(const rewalk of [false,'true',1,null]) assert.equal(boot({onboarded:true}).run('setupForm',{rewalk}).result.rewalk,false);
});
test('legacy draft bridge returns exact raw local text and canonical owner data',()=>{
  const raw=' {"kid":"k4","childName":"Held Synthetic","character":"unicorn","role":"slp"} ';
  const b=boot({}, {'sona.kids.v1':'{"list":[{"slot":""},{"slot":"k4"}],"active":"k4","hi":4}',
    'sona.profile.v1@k4':'{"onboarded":false,"owned":{"characters":["unicorn"]}}', 'sona.obdraft.v1':raw});
  const out=b.run('setupForm'),form=out.result;
  assert.equal(form.legacyDraftJSON,raw);assert.equal(form.slot,'k4');assert.equal(form.isSingleChild,false);assert.equal(form.character,'unicorn');assert.equal(form.isClinician,false);
  assert.deepEqual(out.changed,{});assert.deepEqual(out.removed,[]);
});
test('foreign or corrupt legacy buddy cannot replace current buddy',()=>{
  for(const raw of ['{"kid":"other","character":"unicorn"}','{"kid":4,"character":"unicorn"}','{"kid":"","character":"unknown"}','{']) {
    assert.equal(boot({character:'bunny'},{'sona.obdraft.v1':raw}).run('setupForm').result.character,'bunny');
  }
});
test('unowned old draft is accepted only for original single-child slot',()=>{
  assert.equal(boot({character:'fox',owned:{characters:['unicorn']}},{'sona.obdraft.v1':'{"character":"unicorn"}'}).run('setupForm').result.character,'unicorn');
  const b=boot({}, {'sona.kids.v1':'{"list":[{"slot":"k4"}],"active":"k4","hi":4}', 'sona.profile.v1@k4':'{"onboarded":false,"character":"bunny"}', 'sona.obdraft.v1':'{"character":"unicorn"}'});
  assert.equal(b.run('setupForm').result.character,'bunny');
});
test('raw source ages3,5,7 and optional empty age save without rounding',()=>{
  for(const age of ['3','5','7','14','']) {
    const b=boot(),out=b.run('completeSetup',input({age})),profile=saved(out);
    assert.equal(profile.childAge,age);assert.deepEqual(profile.focusSounds,['S']);assert.equal(profile.onboarded,true);noConsentWrites(out,b.storage);
  }
});
test('current fresh interests save and an asked skip clears only that array',()=>{
  for(const interests of [['space','music'],[]]) {
    const b=boot({interests:['dragons']}),out=b.run('completeSetup',input({interests}));
    assert.deepEqual(saved(out).interests,interests);noConsentWrites(out,b.storage);
  }
});
test('interests not asked on a short or explicit rewalk path preserve legacy themes',()=>{
  for(const [profile,extra,rewalk] of [
    [{interests:['dragons']},{'sona.setupasks.v1':'{"v":2,"therapy":""}'},false],
    [{onboarded:true,interests:['dragons']},{},true]
  ]) {
    const b=boot(profile,extra),out=b.run('completeSetup',input({minutes:rewalk?5:null,interests:['space'],rewalk}));
    assert.deepEqual(saved(out).interests,['dragons']);noConsentWrites(out,b.storage);
  }
});
test('clinician save retains the current role rather than forcing parent or trusting draft',()=>{
  const b=boot({role:'slp',character:'fox'}),out=b.run('completeSetup',input({minutes:null,character:'fox',role:'parent',therapy:'t_yes'}));
  assert.equal(saved(out).role,'slp');assert.equal(saved(out).character,'fox');noConsentWrites(out,b.storage);
});
test('a parent cannot gain clinician role from a setup payload or old clinician draft',()=>{
  const b=boot({}, {'sona.obdraft.v1':'{"kid":"","role":"slp"}'}),out=b.run('completeSetup',input({role:'slp',isClinician:true}));
  assert.equal(saved(out).role,'parent');noConsentWrites(out,b.storage);
});
test('saved old family is protected unless a current explicit boolean rewalk is supplied',()=>{
  for(const rewalk of [undefined,false,'true',1]) {
    const b=boot({onboarded:true,childName:'Kept Synthetic',focusSounds:['L']}),out=b.run('completeSetup',input({rewalk}));
    assert.deepEqual(out.changed,{});assert.deepEqual(out.removed,[]);
  }
  const b=boot({onboarded:true,childName:'Kept Synthetic',focusSounds:['L'],founding:true,weeklyGoal:2});
  const out=b.run('completeSetup',input({rewalk:true,name:'Explicit Synthetic'})),profile=saved(out);
  assert.equal(profile.childName,'Explicit Synthetic');assert.deepEqual(profile.focusSounds,['S']);assert.equal(profile.founding,true);assert.equal(profile.weeklyGoal,2);noConsentWrites(out,b.storage);
});
test('unicorn stays equipped without a retired buddy picker and unknown new buddy is rejected',()=>{
  const b=boot({character:'unicorn'}),out=b.run('completeSetup',input({character:'unicorn'}));
  assert.equal(saved(out).character,'unicorn');
  assert.throws(()=>boot({character:'unicorn'}).run('completeSetup',input({character:'unknown'})));
  assert.throws(()=>boot({character:'unicorn'}).run('completeSetup',input({character:'bunny'})),'no newly invented picker swap');
});
test('valid owned old draft buddy can survive canonical unfinished setup',()=>{
  const b=boot({character:'fox',owned:{characters:['unicorn']}},{'sona.obdraft.v1':'{"kid":"","character":"unicorn"}'});
  assert.equal(saved(b.run('completeSetup',input({character:'unicorn'}))).character,'unicorn');
});
test('unowned same-child legacy shop buddy cannot be equipped by setup',()=>{
  const b=boot({character:'bunny'},{'sona.obdraft.v1':'{"kid":"","character":"unicorn"}'});
  assert.equal(b.ctx.Sona.owns('characters','unicorn'),false,'synthetic draft buddy really is unowned');
  assert.equal(b.run('setupForm').result.character,'bunny','current equipped owned buddy survives stale unowned draft');
  assert.throws(()=>b.run('completeSetup',input({character:'unicorn'})),'raw legacy choice cannot grant a shop buddy');
  assert.equal(saved(b.run('completeSetup',input({character:'bunny'}))).character,'bunny');
});
test('new unsure path stores the original PLAY_ORDER with no invented speech target',()=>{
  const b=boot(),out=b.run('completeSetup',input({mode:'play',pathReason:'unsure',focusSounds:[]})),profile=saved(out);
  assert.equal(profile.mode,'play');assert.equal(profile.pathReason,'unsure');assert.deepEqual(profile.focusSounds,Array.from(b.ctx.Sona.PLAY_ORDER));noConsentWrites(out,b.storage);
});
test('old general-play reason can be preserved only from a genuine saved play choice',()=>{
  const b=boot({onboarded:true,mode:'play',pathReason:'',focusSounds:['P']});
  const profile=saved(b.run('completeSetup',input({rewalk:true,mode:'play',pathReason:'',focusSounds:[]})));
  assert.equal(profile.mode,'play');assert.equal(profile.pathReason,'');
  const old=boot({}, {'sona.obdraft.v1':'{"kid":"","mode":"play","pathReason":""}'});
  assert.equal(saved(old.run('completeSetup',input({mode:'play',pathReason:'',focusSounds:[]}))).pathReason,'');
  assert.throws(()=>boot().run('completeSetup',input({mode:'play',pathReason:'',focusSounds:[]})));
});
test('invalid sound, mode, raw age, minute or asked-interest data cannot finish',()=>{
  for(const patch of [
    {name:'  '},{age:'99'},{age:3},{age:'3x'},{character:null},{character:4},{focusSounds:[]},{focusSounds:['S','S']},{focusSounds:['UNKNOWN']},
    {mode:'assessment'},{pathReason:'invented'},{mode:'play',pathReason:'unsure',focusSounds:['S']},{minutes:15},{minutes:'5'},
    {interests:['dragons']},{interests:['space','space']},{interests:'space'}
  ]) assert.throws(()=>boot().run('completeSetup',input(patch)),JSON.stringify(patch));
});
test('skipped minutes retain existing goal and selected canonical minutes convert exactly',()=>{
  for(const [minutes,goal] of [[3,18],[5,30],[10,60]]) {
    const b=boot(),profile=saved(b.run('completeSetup',input({minutes})));
    assert.equal(profile.dailyMinutes,minutes);assert.equal(profile.dailyGoal,goal);
  }
  const b=boot({dailyGoal:40,dailyMinutes:7}),profile=saved(b.run('completeSetup',input({minutes:null})));
  assert.equal(profile.dailyGoal,40);assert.equal(profile.dailyMinutes,7);
});
test('second child save changes only that child and cannot write first-family minutes',()=>{
  const extra={'sona.kids.v1':'{"list":[{"slot":""},{"slot":"k4"}],"active":"k4","hi":4}',
    'sona.profile.v1@k4':'{"onboarded":false,"childName":"Second Synthetic","dailyGoal":36,"interests":["dragons"],"email":"second@example.invalid","weeklyReport":false,"reportId":"kept-second"}',
    'sona.setupasks.v1':'{"v":2,"therapy":"t_no"}', 'sona.sdk.synthetic.v1':'syntheticSDK'};
  const b=boot({childName:'First Synthetic'},extra),out=b.run('completeSetup',input({minutes:null,interests:['space'],email:'new@example.invalid',weeklyReport:true,therapy:'t_yes'}));
  const profile=saved(out,'sona.profile.v1@k4');assert.equal(profile.dailyGoal,36);assert.deepEqual(profile.interests,['dragons']);
  noConsentWrites(out,b.storage);assert.equal(out.changed['sona.profile.v1'],undefined);assert.equal(out.changed['sona.sdk.synthetic.v1'],undefined);
  assert(Object.keys(out.changed).every(k=>k.endsWith('@k4')),'all returned writes belong to active child');
  assert.deepEqual(out.removed,[]);
  assert.throws(()=>boot({childName:'First Synthetic'},extra).run('completeSetup',input({minutes:3})));
});
test('typed household consent boundary remains untouched even with malicious setup fields',()=>{
  const b=boot({email:'kept@example.invalid',weeklyEmail:false,weeklyReport:false,reportId:'kept-report',earlyAdopter:true,founding:true}, {'sona.report.v1':'{"enabled":false}', 'sona.setupasks.v1':'{"v":2,"therapy":"t_no"}'});
  const out=b.run('completeSetup',input({minutes:null,email:'new@example.invalid',weeklyEmail:true,weeklyReport:true,reportId:'new-report',therapy:'t_yes',earlyAdopter:false,premium:true}));
  const profile=saved(out);assert.equal(profile.earlyAdopter,true);assert.equal(profile.founding,true);assert.equal(profile.therapy,undefined);noConsentWrites(out,b.storage);
});
console.log(`Setup host fidelity: ${passed}/${passed+failed} cases passed; ${failed} failed`);
if(failed) process.exitCode=1;
