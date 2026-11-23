import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const family = resolve(process.argv[2] ?? join(root, 'native/family-ios'));
const source = resolve(process.argv[3] ?? root);
const sona = readFileSync(join(source, 'public/sona.js'), 'utf8');
const feed = readFileSync(join(source, 'public/arcade-feed.html'), 'utf8');
const rate = 24000;
const audio = join(family, 'SonaNativePreview/Audio');
mkdirSync(audio, {recursive: true});

function section(text, first, after) {
    const start = text.indexOf(first);
    const end = text.indexOf(after, start + first.length);
    if (start < 0 || end <= start) throw new Error('Canonical sound source moved');
    return text.slice(start, end);
}

const chimeBytes = runInNewContext(`
    let _chimeNotes;
    function note(f, at, dur, type = "sine", gain = 0.18, attack = 0.015) {
        _chimeNotes.push({ f, at, dur, type, gain, attack });
    }
    ${section(sona, '  const WIN_ATTACK =', '  function chime(name)')}
    chimeBytes;
`);

function wave(bytes) {
    const header = Buffer.alloc(44);
    header.write('RIFF'); header.writeUInt32LE(36 + bytes.length, 4);
    header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
    header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(bytes.length, 40);
    return Buffer.concat([header, bytes]);
}

writeFileSync(join(audio, 'feed-bite.wav'), wave(Buffer.from(chimeBytes('correct'))));

// Let the shipping concert recipe schedule its original strings and gain
// curves on an in-memory audio graph, then sample the result offline.
const mix = new Float32Array(rate * 5);
const destination = {};
function gainNode() {
    return {destination: null, gain: {
        value: 1, setValueAtTime(value, time) { this.events.push([time, value]); },
        exponentialRampToValueAtTime(value, time) { this.events.push([time, value]); },
        events: [],
    }, connect(node) { this.destination = node; }};
}
const context = {
    currentTime: 0, sampleRate: rate, destination,
    createGain: gainNode,
    createBuffer(_, frames) {
        const samples = new Float32Array(frames);
        return {getChannelData() { return samples; }};
    },
    createBufferSource() {
        return {connect(node) { this.output = node; }, start(when) {
            const samples = this.buffer.getChannelData(0);
            const [, attack, release] = this.output.gain.events;
            const [start, initial] = this.output.gain.events[0];
            const [peakTime, peak] = attack, [endTime, last] = release;
            const master = this.output.destination.gain.value;
            const begin = Math.round(when * rate);
            for (let i = 0; i < samples.length; i++) {
                const time = when + i / rate;
                const gain = time < peakTime ? initial * (peak / initial) ** ((time - start) / (peakTime - start))
                    : time < endTime ? peak * (last / peak) ** ((time - peakTime) / (endTime - peakTime))
                    : last;
                mix[begin + i] += samples[i] * gain * master;
            }
        }};
    },
};
const math = Object.create(Math);
let seed = 1;
math.random = () => (seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32;
const state = {Math: math, profile: {soundOn: true, volume: 1}, document: {hidden: false}, audioPaused: false,
    micStream: null, micAsking: false, wordClosing: false, window: {}, ukeUntil: 0,
    getCtx: () => context, performance: {now: () => 0}};
runInNewContext(section(feed, '    var ukeNodes=', '    // the concert belongs to the end card:') + '\nplayUke();', state);
if (!state.window.__ukePlayed || !mix.some(value => value !== 0)) throw new Error('Original Feed concert did not render');

const chime = Buffer.from(chimeBytes('complete'));
const bytes = Buffer.alloc(mix.length * 2);
for (let i = 0; i < mix.length; i++) {
    const initial = i * 2 < chime.length ? chime.readInt16LE(i * 2) / 32767 : 0;
    bytes.writeInt16LE(Math.round(32767 * Math.max(-1, Math.min(1, initial + mix[i]))), i * 2);
}
writeFileSync(join(audio, 'feed-concert.wav'), wave(bytes));

const mark = section(feed, '<span class="uke" aria-hidden>', '</span>');
const instrument = mark.slice(mark.indexOf('<svg')).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
if (!instrument.endsWith('</svg>')) throw new Error('Original Feed ukulele did not render');
const images = join(family, 'SonaNativePreview/Assets.xcassets/feed-ukulele.imageset');
mkdirSync(images, {recursive: true});
writeFileSync(join(images, 'feed-ukulele.svg'), instrument + '\n');
writeFileSync(join(images, 'Contents.json'), JSON.stringify({
    images: [{filename: 'feed-ukulele.svg', idiom: 'universal'}],
    info: {author: 'xcode', version: 1},
    properties: {'preserves-vector-representation': true},
}, null, 2) + '\n');
