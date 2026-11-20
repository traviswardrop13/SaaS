import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../../', import.meta.url);
const source = readFileSync(new URL('public/sona.js', root), 'utf8');
const start = source.indexOf('  const ROAD_LANDS =');
const end = source.indexOf('  const MONTH_NAMES =', start);
assert(start >= 0 && end > start, 'The authored Trophy Road tables must exist');
const { ROAD_LANDS, ROAD_STOPS, MONTH_STEPS } = vm.runInNewContext(
    source.slice(start, end) + '\n({ ROAD_LANDS, ROAD_STOPS, MONTH_STEPS })',
    Object.create(null), {timeout: 1000}
);
assert(ROAD_LANDS.length && ROAD_STOPS.length && MONTH_STEPS.length);
for (const land of ROAD_LANDS) {
    assert(/^[a-z0-9-]+$/.test(land.art));
    readFileSync(new URL('public/assets/crafted/' + land.art + '.webp', root));
}
const data = JSON.stringify({version: 1, lands: ROAD_LANDS, stops: ROAD_STOPS, monthly: MONTH_STEPS}, null, 2) + '\n';
const output = new URL('native/family-ios/SonaNativePreview/Content/Rewards.json', root);
if (process.argv.includes('--check')) {
    assert.equal(readFileSync(output, 'utf8'), data, 'Trophy Road differs from the approved source');
} else {
    writeFileSync(output, data);
}
console.log(`${ROAD_LANDS.length} Trophy Road lands, ${ROAD_STOPS.length} lifetime stops and ${MONTH_STEPS.length} monthly stops.`);
