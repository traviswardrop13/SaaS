import fs from 'node:fs';
import assert from 'node:assert/strict';
// Data-only extraction. Never loads Sona into a live browser or reads a family.
const publicSource = fs.readFileSync(new URL('../../../../../public/sona.js', import.meta.url), 'utf8');
const rulesSource = fs.readFileSync(new URL('../../SonaFamilyRules/Sources/SonaFamilyRules/Rules/sona.js', import.meta.url), 'utf8');
const swift = fs.readFileSync(new URL('../../SonaFamilyMigration/Sources/SonaFamilyMigration/NativeFamilyBackupPolicy.swift', import.meta.url), 'utf8');
function sourceList(source, name) {
  const text = source.match(new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\]);'))?.[1];
  assert.ok(text, name);
  return JSON.parse(text.replace(/\/\/[^\n]*/g, ''));
}
function swiftList(name) {
  const text = swift.match(new RegExp('static let ' + name + ': Set<String> = \\\[([\\s\\S]*?)\\]'))?.[1];
  assert.ok(text, name);
  return [...text.matchAll(/"([^"\n]+)"/g)].map(m => m[1]);
}
const lists = Object.fromEntries(['NO_EXPORT','NO_IMPORT','ERA_MARKS','UNDO_KEEP'].map(name => {
  const current = sourceList(publicSource, name);
  assert.deepEqual(sourceList(rulesSource, name), current, 'Bundled source policy drift: ' + name);
  return [name, current];
}));
const extra = ['sona.fid.v1','sona.fid','sona.iapcheck.v1',...lists.UNDO_KEEP];
const excluded = new Set([...lists.NO_EXPORT,...lists.NO_IMPORT,...extra]);
const mutable = new Set(['sona.board.v1','sona.boardcache.v1','sona.boardpend.v1','sona.boardleave.v1','sona.boardask.v1','sona.report.v1']);
const expected = {
  excluded,
  immutable: new Set([...excluded].filter(x => !mutable.has(x))),
  profilePrivate: new Set([...lists.ERA_MARKS,'weeklyReport','slpShare','slpCode']),
  profileSecurity: new Set(['weeklyReport','slpShare','slpCode'])
};
for (const [name, values] of Object.entries(expected)) assert.deepEqual(swiftList(name).sort(), [...values].sort(), name + ' drift');
console.log('PASS portable policy matches current public + bundled NO_EXPORT/NO_IMPORT/UNDO_KEEP/ERA_MARKS; native-only identity and consent exclusions retained.');
