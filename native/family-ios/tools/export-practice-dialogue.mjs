// Data-only snapshot of the shipping practice page's own line builders.
// No requests, audio generation, clinical selection, scoring or rep writes.
// node native/family-ios/tools/export-practice-dialogue.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex < 0
  ? join(root, 'native/family-ios/SonaNativePreview/Content/PracticeDialogue.json')
  : resolve(process.argv[outputIndex + 1]);
const check = process.argv.includes('--check');
const source = Object.fromEntries(['public/sona.js', 'public/charge.html'].map(path => [path, readFileSync(join(root, path), 'utf8')]));
const sha = value => createHash('sha256').update(value).digest('hex');
const refs = {};
const ranges = [];
function find(path, expression, label) {
  const match = expression.exec(source[path]);
  if (!match) throw new Error(`Practice dialogue source changed: ${label} (${path}). Nothing generated.`);
  refs[label] = { path, line: source[path].slice(0, match.index).split('\n').length };
  ranges.push({ path, start: match.index, end: match.index + match[0].length });
  return match;
}
const shared = 'public/sona.js', charge = 'public/charge.html';
const store = new Map();
const context = vm.createContext({
  window: {}, location: { search: '', hostname: 'native-export.invalid', pathname: '/native-export' },
  document: { addEventListener() {}, documentElement: {} },
  localStorage: { getItem(key) { return store.get(key) ?? null; }, setItem(key, value) { store.set(key, String(value)); }, removeItem(key) { store.delete(key); } },
  setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
});
vm.runInContext(source[shared], context, { timeout: 2000, filename: shared });
const S = context.window.Sona;
if (!S?.ALL_SOUNDS?.length || !S.CUES || !S.SOUND_SAY || !S.PRAISES) throw new Error('The shared practice tables are unavailable.');
const need = Number(find(shared, /const CHARGE_NEED = (\d+);/, 'default repetitions')[1]);
const retryNeeds = [...new Set([...source[charge].matchAll(/burstAndVerify\((\d+)\)/g)].map(match => Number(match[1])))];
if (!retryNeeds.length) throw new Error('No explicit retry repetition count found.');
const needs = [...new Set([need, ...retryNeeds])];
const humanClips = find(shared, /const HUMAN_CLIPS = (true|false);/, 'human model switch')[1] === 'true';
const numword = vm.runInNewContext('(' + find(charge, /var NUMWORD=(\{[^}]*\});/, 'number words')[1] + ')');
for (const count of needs) if (!numword[count]) throw new Error(`No authored repetition word for ${count}.`);
const soundNameCode = find(charge, /^    function soundName\(\)\{.*\}$/m, 'sound name')[0];
const sayLineCode = find(charge, /^    function sayLine\(\)\{\n[\s\S]*?^    \}$/m, 'prompt builder')[0];
const shortRule = find(charge, /var CUESHORT=\((.*)\);\n/, 'short mouth cue')[1];
const retryRule = find(charge, /var tip=\((.*)\);\n/, 'retry mouth cue')[1];
const slotCode = find(charge, /^    function soundSlot\(text\)\{\n[\s\S]*?^    \}$/m, 'recorded sound slot')[0];
const splitCode = find(charge, /function goSplit\(t\)\{return .*\}/, 'handoff split')[0];
const go = find(shared, /const GO_LINE = "([^"]*)", GO_WAIT_MS = (\d+)/, 'shared handoff');
const goPage = find(charge, /var GO="([^"]*)", GO_GAP=(\d+)/, 'handoff join');
if (goPage[1].trim() !== go[1]) throw new Error('Practice handoff and the shared handoff differ.');
const split = new Function('GO', splitCode + ';return goSplit;')(goPage[1]);
const coach = find(charge, /await say\("(Let's try that one again\. )"\+tip\+"(\.)( Go!)"\);/, 'retry line');
const idea = find(charge, /await say\("(I have an idea\. Let's try this one\. )"\+\(ITEM\.level==="isolation"\?\("(Make your )"\+soundName\(\)\+"( sound)"\):\("(Say )"\+\(ITEM\.say\|\|ITEM\.t\)\)\)\+"(\.)( Go!)"\);/, 'step down line');
const praise = find(charge, /await say\(\(S&&S\.praiseLine\)\?S\.praiseLine\(\):"([^"]*)"\);/, 'praise call');
const fixed = {
  afterMisses: find(charge, /await say\("(Good practicing\. Let's play\.)"\);/, 'after misses')[1],
  win: find(charge, /await sayAfterChime\("(You did it\. Let's play\.)"\);/, 'win')[1],
  chest: find(charge, /sayAfterChime\("(Look what we found\.)",/, 'chest')[1],
  adventureEnd: find(charge, /sayAfterChime\("(We finished the whole adventure\.)",/, 'adventure end')[1],
  quiet: find(charge, /if\(!microphone\)say\("(I couldn't hear you! Say it big — I'm all ears!)"\);/, 'quiet screen')[1],
  praiseFallback: praise[1],
};
const timing = find(charge, /var ECHO_TAIL_MS=(\d+), SETTLE_MS=(\d+), SFX_MS=\{tap:(\d+),complete:(\d+)\};/, 'speaker microphone timing');
const afterChime = Number(find(charge, /var AFTER_CHIME_MS=(\d+);/, 'after chime timing')[1]);
const slow = Number(find(charge, /if\(slow\)\{a\.playbackRate=(0\.\d+);/, 'slow model rate')[1]);
find(charge, /function playPrompt\(\)\{\n\s*if\(mutedSpeech\(\)\)return Promise\.resolve\(\);\n\s*return say\(sayLine\(\)\);\n\s*\}/, 'live prompt call');
find(charge, /function turtleText\(\)\{ return ITEM\.level==="isolation" \? sayLine\(\) : String\(ITEM\.say\|\|ITEM\.display\|\|ITEM\.t\); \}/, 'slow target selection');
// Match voicedoc's completeness guard: a new voice line must not silently
// disappear when this snapshot is regenerated after a source update.
for (const call of source[charge].matchAll(/(?<![\w$.])(say|sayAfterChime)\(/g)) {
  const index = call.index;
  if (/function $/.test(source[charge].slice(Math.max(0, index - 9), index))) continue;
  if (source[charge].startsWith('say(text)', index) || source[charge].startsWith('say(t)', index)) continue;
  if (!ranges.some(range => range.path === charge && index >= range.start && index < range.end)) {
    throw new Error(`Unexported practice voice call at ${charge}:${source[charge].slice(0, index).split('\n').length}. Nothing generated.`);
  }
}

function nameFor(sound) { return new Function('SOUND', soundNameCode + ';return soundName();')(sound); }
function shortFor(sound) { return new Function('CUETIP', 'return (' + shortRule + ');')(S.CUES[sound].tip); }
function retryFor(sound) { return new Function('c', 'soundName', 'return (' + retryRule + ');')(S.CUES[sound], () => nameFor(sound)); }
function prompt(sound, item, repetitions, cued) {
  const fn = new Function('NUMWORD', 'soundName', 'ITEM', 'NEED', 'CUESHORT', sayLineCode + ';return sayLine;')(numword, () => nameFor(sound), item, repetitions, shortFor(sound));
  fn._cued = cued;
  return fn();
}
function slotFor(sound, text, isolation = true) {
  return new Function('HUMANCLIPS', 'ITEM', 'SOUND', 'soundName', slotCode + ';return soundSlot;')(humanClips, { level: isolation ? 'isolation' : 'word' }, sound, () => nameFor(sound))(text);
}
function utterance(sound, fullText, isolation = true) {
  const bodyText = split(fullText);
  return { fullText, bodyText: bodyText ?? fullText, handoff: bodyText == null ? null : go[1], soundSlot: slotFor(sound, bodyText ?? fullText, isolation) };
}
function asset(path) {
  if (!/^\/coach\/say-echo\/[A-Z]+(?:-sound\.wav|\.mp3)$/.test(path)) throw new Error('Unexpected model clip path: ' + path);
  const bytes = readFileSync(join(root, 'public', path));
  return { path, sha256: sha(bytes), bytes: bytes.length };
}

const sounds = [...S.ALL_SOUNDS].map(sound => {
  if (!S.CUES[sound]?.tip || !S.SOUND_SAY[sound]) throw new Error(`Missing authored model for ${sound}.`);
  const item = { level: 'isolation', t: S.SOUND_SAY[sound], say: S.SOUND_SAY[sound], display: S.soundLabel(sound) };
  const prompts = needs.map(repetitions => ({
    repetitions,
    first: utterance(sound, prompt(sound, item, repetitions, false)),
    repeated: utterance(sound, prompt(sound, item, repetitions, true)),
  }));
  const clips = { sound: asset(`/coach/say-echo/${sound}-sound.wav`), fallbackLine: asset(`/coach/say-echo/${sound}.mp3`) };
  // The current preview already bundles these exact sound-only recordings.
  const bundled = join(root, 'native/family-ios/SonaNativePreview/Audio', `${sound}-sound.wav`);
  if (existsSync(bundled) && sha(readFileSync(bundled)) !== clips.sound.sha256) throw new Error(`Bundled ${sound} audio differs from the shipping recording.`);
  return {
    id: sound, label: S.soundLabel(sound), soundText: S.SOUND_SAY[sound],
    cue: S.CUES[sound].tip, shortCue: shortFor(sound), retryCue: retryFor(sound), clips, prompts,
    coaching: utterance(sound, coach[1] + retryFor(sound) + coach[2] + coach[3]),
    stepDownToSound: utterance(sound, idea[1] + idea[2] + nameFor(sound) + idea[3] + idea[5] + idea[6]),
  };
});
const target = '{target}';
const templates = needs.map(repetitions => {
  const item = { level: 'word', t: target, display: target, say: target, cueFirst: true };
  const plain = prompt('R', item, repetitions, true);
  const first = new Function('NUMWORD', 'soundName', 'ITEM', 'NEED', 'CUESHORT', sayLineCode + ';return sayLine();')(numword, () => '{sound}', item, repetitions, '{cue}');
  return { repetitions, firstWithCue: first, repeated: plain };
});
const catalog = {
  version: 1,
  scope: 'Exact practice dialogue and existing clip references only; not a clinical session, selector, scorer or practice-credit implementation.',
  sources: Object.entries(source).map(([path, text]) => ({ path, sha256: sha(text) })),
  references: refs,
  defaultRepetitions: need, retryRepetitions: retryNeeds, humanClipsEnabled: humanClips,
  timing: { echoTailMS: Number(timing[1]), microphoneSettleMS: Number(timing[2]), afterChimeMS: afterChime,
    goWaitMS: Number(go[2]), goGapSamples: Number(goPage[2]), slowPlaybackRate: slow },
  lines: fixed, praise: [...S.PRAISES], sounds, targetTemplates: templates,
  stepDownTargetTemplate: idea[1] + idea[4] + target + idea[5] + idea[6],
};
const text = JSON.stringify(catalog, null, 2) + '\n';
if (check) {
  if (!existsSync(output) || readFileSync(output, 'utf8') !== text) {
    console.error('Practice dialogue snapshot is missing or stale. Re-export from the reviewed shipping sources.');
    process.exitCode = 1;
  } else console.log(`Practice dialogue current: ${sounds.length} sounds, ${sounds.length * needs.length * 2} exact first/repeat prompts, ${sounds.length * 2} original clip hashes.`);
} else {
  writeFileSync(output, text);
  console.log(`Exported ${sounds.length} authored sound dialogues to ${output}.`);
}
