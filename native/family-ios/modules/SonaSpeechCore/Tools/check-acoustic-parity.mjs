// Reproduce the reference replay used by PracticeAcousticsTests.swift.
// Run from any directory: node native/family-ios/modules/SonaSpeechCore/Tools/check-acoustic-parity.mjs
// Reads the current web detector and synthetic expected results. Writes no files,
// opens no microphone, uses no recordings and makes no network requests.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const charge = readFileSync(new URL('../../../../../public/charge.html', import.meta.url), 'utf8');
const reference = JSON.parse(readFileSync(new URL('../Tests/SonaSpeechCoreTests/Fixtures/acoustic-web-reference.json', import.meta.url), 'utf8'));
const start = charge.indexOf('    function speechEvidence(){');
const end = charge.indexOf('    // ---- rapid-fire rep engine', start);
if (start < 0 || end < 0) throw new Error('Could not locate charge.html speechEvidence; review the extractor before changing its reference.');
const evidenceSource = charge.slice(start, end);
const hash = createHash('sha256').update(evidenceSource).digest('hex');
let failures = 0;
function check(label, passed, actual) {
  if (!passed) failures++;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}${actual === undefined ? '' : ' ' + JSON.stringify(actual)}`);
}
check('unchanged web evidence source', hash === reference.sha256, { sha256: hash });

// Thresholds sit outside the extracted function. Read the actual web object,
// then guard it too, so a changed clinical constant cannot pass by replaying
// the old numbers against the old expected results.
const constantsMatch = charge.match(/var EVID=(\{[^;]+\});/);
if (!constantsMatch) throw new Error('Could not locate charge.html EVID constants.');
const EVID = new Function('return (' + constantsMatch[1] + ');')();
check('unchanged web evidence constants', isDeepStrictEqual(EVID, {
  broadHz: 1200, overtones: 3, voicedMs: 45, sibDb: 8, sibMs: 150,
  minMs: 45, shortMs: 1000, quietMs: 130, changeDb: 4.5, spanMs: 800, edgeMs: 30
}));
for (const [label, code] of [
  ['energy onset/cooldown', 'if(!inBurst&&voiced>=4&&(successAt!==null||now-lastRep>350)){inBurst=true;burstAt=now;}'],
  ['brief-event end/rearm', 'if(inBurst&&!counted&&(silent>=8||evid.quietFor(now)>=EVID.quietMs)&&heardTry())countRep(now);'],
  ['quiet rearm', 'if(silent>=8){inBurst=false;counted=false;burstFrames=[];evid.drop();}'],
  ['known-room bar', 'function roomBar(level){return Math.min(3*ROOM_MAX,Math.max(0.035,level*3.0));}']
]) check('unchanged web ' + label, charge.includes(code));
const create = new Function('EVID', evidenceSource + ';return speechEvidence;')(EVID);

// Identical in-memory signal snapshots to PracticeAcousticsTests.swift. The
// adapter supplies an analyser's two views; this audits the detector boundary,
// not Apple's hardware, the FFT implementation or child-speech validity.
function frame(signal) {
  const samples = new Float32Array(1024), bins = new Float32Array(512);
  bins.fill(-110);
  for (let i = 0; i < 1024; i++) {
    const phase = 2 * Math.PI * 187.5 * i / 48000;
    if (signal === 'room') samples[i] = i % 2 === 0 ? .005 : -.005;
    if (signal === 'voice') {
      let value = 0;
      for (let k = 1; k <= 24; k++) value += .12 / k * Math.sin(k * phase);
      samples[i] = value;
    }
    if (signal === 'tone') samples[i] = .2 * Math.sin(2 * Math.PI * 440 * i / 48000);
    if (signal === 'hiss' || signal === 'broadNoise') {
      samples[i] = ((Math.imul(i, 1664525) + 1013904223) >>> 0) / 4294967295 * .4 - .2;
    }
  }
  if (signal === 'room') bins.fill(-100);
  if (signal === 'zero') bins.fill(-Infinity);
  if (signal === 'voice') {
    for (let i = 0; i < 512; i++) if (i * 48000 / 1024 < 6000) bins[i] = i % 4 === 0 ? -40 : -70;
  }
  if (signal === 'tone') for (let i = 8; i <= 11; i++) bins[i] = -20;
  if (signal === 'hiss') for (let i = 0; i < 512; i++) bins[i] = i >= 54 && i <= 170 ? -30 : -70;
  if (signal === 'broadNoise') bins.fill(-30);
  return { samples, bins, rms: signal === 'room' ? .005 : signal === 'zero' ? 0 : .17 };
}

function run(script) {
  let data = frame('room');
  const analyser = {
    fftSize: 1024,
    getFloatTimeDomainData(out) { out.set(data.samples); },
    getFloatFrequencyData(out) { out.set(data.bins); }
  };
  const evidence = create();
  evidence.attach(analyser, 48000);
  for (let time = 0; time <= 300; time += 20) evidence.calibrate(time);
  evidence.settle();
  // The unchanged energy/burst rules from charge.html:1895–1913. A fixed
  // known room (.005 RMS, threshold .035) isolates the evidence rule here;
  // Swift tests separately check startup, room learning and interruption.
  let voiced = 0, silent = 0, inBurst = false, counted = false;
  let reps = 0, lastRep = 0, burstAt = 0;
  const at = [];
  for (const [signal, from, through, step = 20] of script) {
    for (let now = from; now <= through; now += step) {
      data = frame(signal);
      if (data.rms > .035) {
        voiced++; silent = 0;
        if (!inBurst && voiced >= 4 && now - lastRep > 350) { inBurst = true; burstAt = now; }
        if (!counted && evidence.frame(now) && inBurst) {
          counted = true; reps++; lastRep = burstAt; at.push([now, evidence.route()]);
        }
      } else {
        silent++; voiced = 0;
        if (!inBurst) evidence.drop();
        if (inBurst && !counted && (silent >= 8 || evidence.quietFor(now) >= EVID.quietMs) && evidence.brief()) {
          counted = true; reps++; lastRep = burstAt; at.push([now, evidence.route()]);
        }
        if (silent >= 8) { inBurst = false; counted = false; evidence.drop(); }
      }
    }
  }
  return { reps, at };
}

const scripts = {
  voice: [['voice', 1100, 1800]],
  tone: [['tone', 1100, 3600], ['room', 3620, 3900]],
  steadyBroad: [['broadNoise', 1100, 3600], ['room', 3620, 3900]],
  hiss: [['hiss', 1100, 2500]],
  briefBroad: [['broadNoise', 1100, 1280], ['room', 1300, 1450, 10]],
  transient: [['broadNoise', 1100, 1120], ['room', 1140, 1500]],
  silence: [['zero', 1000, 21000]],
  five: []
};
for (let index = 0; index < 5; index++) {
  const start = 1100 + index * 650;
  scripts.five.push(['voice', start, start + 240], ['room', start + 260, start + 600]);
}
for (const [name, script] of Object.entries(scripts)) {
  const actual = run(script);
  check(name + ' counts/routes/times', isDeepStrictEqual(actual, reference.results[name]), actual);
}
check('reference contains exactly these scripts', isDeepStrictEqual(Object.keys(scripts).sort(), Object.keys(reference.results).sort()));
console.log(`${failures ? 'FAIL' : 'PASS'} acoustic parity (${Object.keys(scripts).length} synthetic scripts; ${failures} failed checks)`);
process.exitCode = failures ? 1 : 0;
