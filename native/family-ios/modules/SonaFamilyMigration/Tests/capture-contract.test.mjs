import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const defaultCapture = new URL('Sources/SonaFamilyMigration/Resources/CaptureLegacyStorage.js', root);
const script = await readFile(process.argv[2] ?? defaultCapture, 'utf8');
const core = await readFile(new URL('Sources/SonaFamilyMigration/LegacySnapshot.swift', root), 'utf8');
const shipping = await readFile(new URL('../../../../public/sona.js', root), 'utf8');
const oldKeys = shipping.match(/const PER_KID = new Set\(\[([\s\S]*?)\]\);/)[1].replace(/\/\/[^\n]*/g, '');
const nativeKeys = core.match(/public static let perChild: Set<String> = \[([\s\S]*?)\n    \]/)[1];
const quotedKeys = source => Array.from(source.matchAll(/"(sona\.[^"]+)"/g), match => match[1]);
assert.deepEqual(
    ['sona.profile.v1', ...quotedKeys(nativeKeys)].sort(),
    ['sona.profile.v1', 'sona.progress.v1', ...quotedKeys(oldKeys)].sort()
);

const original = {
    'sona.profile.v1': '{"childName":"Fixture"}',
    'sona.homework.v1@k2': '{"sounds":["S"]}',
    'sona.founding.v1': '{"code":"ff-fixture"}',
    'sona.future.fixture': 'Preserved verbatim',
    'other-service-key': 'Excluded'
};
async function capture(valueAtRead = key => original[key]) {
    const result = await vm.runInNewContext(script, {
        setTimeout() { return 0; }, clearTimeout() {},
        location: { origin: 'https://app.speaksona.com' },
        localStorage: {
            length: Object.keys(original).length,
            key: index => Object.keys(original)[index],
            getItem: valueAtRead,
            setItem() { throw new Error('Capture wrote to the old store'); }
        },
        get indexedDB() { throw new Error('Capture accessed the microphone recording store'); },
        fetch() { throw new Error('Capture made a network request'); }
    });
    return JSON.parse(result);
}
const captured = await capture();
assert.equal(captured.origin, 'https://app.speaksona.com');
assert.equal(captured.stable, true);
assert.deepEqual(captured.storage, Object.fromEntries(Object.entries(original).filter(([key]) => key.startsWith('sona.'))));
assert.equal(Object.hasOwn(captured, 'recordings'), false);
let reads = 0;
const changing = await capture(key => {
    if (key === 'sona.profile.v1' && ++reads > 1) return '{"childName":"Changed during capture"}';
    return original[key];
});
assert.equal(changing.stable, false);
assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|console\.|\.(?:setItem|removeItem|clear)\s*\(|\bFileReader\b|\bBlob\b/);
console.log('7 storage contract checks passed, including the microphone recording exclusion.');
