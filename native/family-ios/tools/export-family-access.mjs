// Canonical data export, not another hand-maintained pricing switch.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const root = process.env.SONA_ACCESS_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = readFileSync(join(root, 'public/sona.js'), 'utf8');
function literal(name) {
  const marker = new RegExp('\\bconst ' + name + '\\s*=\\s*').exec(source);
  if (!marker) throw new Error('Missing canonical constant: ' + name);
  const start = marker.index + marker[0].length;
  if (source[start] !== '{' && source[start] !== '[') {
    const value = /^[^;\n]+/.exec(source.slice(start))[0].trim();
    if (!/^(true|false|"[a-z]+")$/.test(value)) throw new Error('Unexpected scalar: ' + name);
    return JSON.parse(value);
  }
  const open = source[start], close = open === '[' ? ']' : '}';
  let depth = 0, quote = '', comment = '', escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i++; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === open) depth++;
    if (c === close && --depth === 0) return vm.runInNewContext('(' + source.slice(start, i + 1) + ')', Object.create(null), { timeout: 1000 });
  }
  throw new Error('Unbalanced data: ' + name);
}
function number(name) {
  const match = new RegExp('\\b' + name + '\\s*=\\s*([0-9 *]+)[,;]').exec(source);
  if (!match) throw new Error('Missing numeric constant: ' + name);
  return vm.runInNewContext(match[1], Object.create(null), { timeout: 1000 });
}
const games = literal('GAME_ACTS');
const result = {
  version: 1,
  sourceSHA256: createHash('sha256').update(source).digest('hex'),
  freeMode: literal('FREE_MODE'), webSales: literal('WEB_SALES'),
  freeBooks: literal('FREE_BOOKS'),
  games: Object.entries(games).map(([id, g]) => ({ id, tier: g.tier, available: g.available !== false, parked: !!g.comingSoon })),
  storyKeys: ['adventure', ...literal('STORY_DAYS').map(s => s.game), ...literal('STORY_TALK').map(s => s.id)],
  products: literal('IAP_PRODUCTS'), entitlement: literal('IAP_ENTITLEMENT'), sellYearly: literal('IAP_SELL_YEARLY'),
  localTrialFallbackDays: number('TRIAL_DAYS'), demoWindowSeconds: number('DEMO_WINDOW_MS') / 1000,
  rotationLength: number('ROT_LEN'), appleRecheckSeconds: number('IAP_RECHECK_MS') / 1000,
  clinicianRecheckSeconds: number('CASE_RECHECK_MS') / 1000
};
const output = JSON.stringify(result, null, 2) + '\n';
const destination = process.env.SONA_ACCESS_OUTPUT || join(root, 'native/family-ios/modules/SonaFamilyAccess/Sources/SonaFamilyAccess/Resources/FamilyAccessCatalog.json');
if (process.argv.includes('--check')) {
  if (!existsSync(destination) || readFileSync(destination, 'utf8') !== output) throw new Error('Native access data differs from public/sona.js. Re-export before release.');
} else writeFileSync(destination, output);
console.log('Canonical access catalog: ' + result.games.length + ' games, ' + result.storyKeys.length + ' story keys; no store prices or trial eligibility assumed.');
