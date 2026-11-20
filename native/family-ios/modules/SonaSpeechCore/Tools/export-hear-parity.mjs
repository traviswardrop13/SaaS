// Canonical, data-only HEAR2 export. No app boot, audio, accounts or network.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = process.env.SONA_HEAR_SOURCE_ROOT || resolve(base, '../../../..');
const sona = readFileSync(resolve(root, 'public/sona.js'), 'utf8');
const content = readFileSync(resolve(root, 'public/gamecontent.js'), 'utf8');
const test = readFileSync(resolve(root, 'tests/heartest.mjs'), 'utf8');
const begin = sona.indexOf('  const HEAR_SPELL = {');
const end = sona.indexOf('\n  // THIRD FREE ERA', begin);
if (begin < 0 || end < begin) throw new Error('HEAR2 bounds changed; inspect source before exporting.');
const hear = sona.slice(begin, end);
const soundSay = sona.match(/const SOUND_SAY\s*=\s*(\{[\s\S]*?\n  \});/);
if (!soundSay) throw new Error('Missing canonical SOUND_SAY.');
const context = { Sona: { WORDS: {} } };
context.window = context;
runInNewContext(content, context, { timeout: 3000 });
runInNewContext('const SOUND_SAY = ' + soundSay[1] + '; function _gameContent(){ return window.SonaContent; }\n' + hear + '\nthis.oracle = hearVerdict;', context, { timeout: 3000 });
const tables = JSON.parse(JSON.stringify(context.SonaContent.syllableTables())).map(table => ({
  sound: table.sound, position: table.pos,
  items: table.items.map(item => ({ text: item.t, say: item.say ?? '' }))
}));
const fixtures = [];
function record(text, sound, word, opts = {}) {
  const expected = context.oracle(text, sound, word, opts || {});
  fixtures.push({ text, sound, word, level: opts?.level ?? '', frame: opts?.frame ?? '', position: opts?.pos ?? '', expected });
  return expected;
}
// Execute only heartest's unchanged pure verdict assertions, with its original
// expected comparisons intact. The rest of that browser suite never runs.
const verdictStart = test.indexOf('// THE MOTIVATING CASE.');
const verdictEnd = test.indexOf('// ── 2. availability', verdictStart);
if (verdictStart < 0 || verdictEnd < verdictStart) throw new Error('heartest bounds changed.');
const originalAssertions = [];
await runInNewContext('(async function(){\n' + test.slice(verdictStart, verdictEnd) + '\n})()', {
  V: async (...args) => record(...args),
  ok: (name, passed) => { if (!passed) throw new Error('Existing web expectation failed: ' + name); originalAssertions.push(name); }
}, { timeout: 3000 });
const sourceFixtureCount = fixtures.length;
// Sweep only authored syllable items and transcript forms already used by the
// web rule, against the unchanged current JS oracle. No native expected rules.
for (const table of tables) for (const item of table.items) {
  const opts = { level: 'syllable', pos: table.position };
  const variants = new Set([item.text, item.say, item.text.replace(/-/g, ' '), item.text + ' ' + item.text,
    'say ' + item.text, 'say ' + item.text.replace(/-/g, ' ') + ' ' + item.text, 'taco']);
  for (const text of variants) if (text) record(text, table.sound, item.text, opts);
}
const sha256 = value => createHash('sha256').update(value).digest('hex');
const payload = { version: 1, sourceSHA256: sha256(content), tables };
const reference = { version: 1, hearSHA256: sha256(hear), contentSHA256: sha256(content),
  heartestSHA256: sha256(test), sourceAssertionCount: originalAssertions.length, sourceFixtureCount, fixtures };
let failed = false;
for (const [path, value] of [
  ['Sources/SonaSpeechCore/Resources/PracticeSyllableTables.json', payload],
  ['Tests/SonaSpeechCoreTests/Fixtures/positional-hear-reference.json', reference]
]) {
  const destination = resolve(base, path), rendered = JSON.stringify(value, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(destination, 'utf8') !== rendered) { failed = true; console.error('Stale HEAR2 export: ' + path); }
  } else writeFileSync(destination, rendered);
}
console.log(`${tables.length} authored syllable tables; ${sourceFixtureCount} original web cases; ${fixtures.length} total exact-source cases.`);
if (failed) process.exitCode = 1;
