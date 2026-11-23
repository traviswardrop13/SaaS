import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';

const root = process.argv[2];
const actual = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const source = (name) => readFileSync(join(root, 'public', name), 'utf8');
function range(text, start, end) {
    const from = text.indexOf(start), to = text.indexOf(end, from + start.length);
    if (from < 0 || to < 0) throw new Error('Canonical fixture boundary moved: ' + start);
    return text.slice(from, to);
}
function value(text, pattern, matchAt = 1) {
    const match = text.match(pattern);
    if (!match) throw new Error('Missing original rule: ' + pattern);
    return runInNewContext(match[matchAt]);
}
function verify(name, got, expected) {
    if (typeof expected === 'number' && typeof got === 'number') {
        if (Math.abs(got - expected) < 1e-10) return;
    } else if (expected !== null && typeof expected === 'object' && got !== null && typeof got === 'object') {
        if (Object.keys(got).length === Object.keys(expected).length) {
            for (const key of Object.keys(expected)) verify(name + '.' + key, got[key], expected[key]);
            return;
        }
    } else if (got === expected) return;
    throw new Error(name + ': expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(got));
}
const tiles = range(source('arcade-tiles.html'), '    var SONGS=[', '    var song=0');
const slice = range(source('arcade-slice.html'), '    var WAVES=[', '    var FRUIT_K=');
const stack = range(source('arcade-stack.html'), '    var FLOORS=[', '    var FLOOR_TOP=');
const glide = range(source('arcade-glide.html'), '    var LEGS=[', '    var G=');
const run = range(source('arcade-run.html'), '    var SPEEDS=', ', SPEED_CAP=');
for (const LV of [1, 2, 3]) {
    const prefix = `Level ${LV}`;
    const current = actual[LV-1];
    const expected = runInNewContext(tiles + '\nSONGS.map(s => ({...s, finale: !!s.finale}))', {LV});
    verify(prefix + ' songs', current.songs, expected);
    const wave = runInNewContext(slice + '\n({waves:WAVES,cuts:GIANT_CUTS})', {LV});
    verify(prefix + ' Fruit Slice', current.slice, wave.waves);
    verify(prefix + ' giant cuts', current.giantCuts, wave.cuts);
    verify(prefix + ' fruit scale', current.fruitScale, value(source('arcade-slice.html'), /FRUIT_K=(\[[^\]]+\])/)[LV-1]);
    verify(prefix + ' Stack', current.stack, runInNewContext(stack+'\nFLOORS', {LV}));
    const sky = runInNewContext(glide + '\n({legs: LEGS,shrink: SHRINK})', {LV});
    verify(prefix + ' Glide goals', current.glide, sky.legs);
    verify(prefix + ' Glide gaps', current.glideShrink, sky.shrink);
    verify(prefix + ' Glide spacing', current.glideEvery, value(source('arcade-glide.html'), /GATE_EVERY=(\[[^\]]+\])/)[LV-1]);
    verify(prefix + ' Glide speed', current.glideSpeed, value(source('arcade-glide.html'), /GSPEED_L1\*(\[[^\]]+\])/)[LV-1]);
    verify(prefix + ' Sprint speed', current.run, runInNewContext(run + '\nSPEEDS', {LV}));
    const bubbles = value(source('bubbles.js'), LV === 1 ? /PER_WORD = (\[[^\]]+\])/ : /PER_WORD_UP = (\[[^\]]+\])/);
    verify(prefix + ' Bubble counts', current.bubbles, bubbles);
}
console.log('All three native levels match the original song, wave, stack, Glide, sprint and bubble settings');
