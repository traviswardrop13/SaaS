// Export canonical story data only; never run a web page or modify public/.
// node native/family-ios/tools/export-adventures.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = process.env.SONA_ADVENTURE_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const files = ['public/sona.js', 'public/adventures.js', 'public/talk-stories.js'];
const sources = Object.fromEntries(files.map(file => [file, readFileSync(join(root, file), 'utf8')]));

function literal(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error('Missing canonical marker: ' + marker);
  const start = source.indexOf('=', at) + 1;
  let first = start; while (/\s/.test(source[first])) first++;
  const open = source[first], close = open === '[' ? ']' : '}';
  if (open !== '[' && open !== '{') throw new Error('Not a data literal: ' + marker);
  let quote = '', comment = '', escaped = false, depth = 0;
  for (let i = first; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '/') { comment = 'line'; i++; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === open) depth++;
    if (c === close && --depth === 0) return vm.runInNewContext('(' + source.slice(first, i + 1) + ')', Object.create(null), { timeout: 1000 });
  }
  throw new Error('Unbalanced canonical literal: ' + marker);
}

const days = literal(sources['public/sona.js'], 'const STORY_DAYS =');
const talking = literal(sources['public/sona.js'], 'const STORY_TALK =');
const scenes = literal(sources['public/adventures.js'], 'global.SonaAdventures =');
const talkScenes = literal(sources['public/talk-stories.js'], 'global.SonaTalkStories =');
function asset(path) {
  if (!/^\/assets\/(adventure|crafted)\/[a-z0-9/_-]+\.webp$/.test(path) || !existsSync(join(root, 'public', path))) throw new Error('Missing original art: ' + path);
  return path;
}
function story(meta, body, day, talk) {
  if (!body) throw new Error('Missing story: ' + meta.id);
  function pages(list) {
    return list.map(page => {
      const big = typeof page.line === 'string' ? page.line : page.line.big;
      const little = typeof page.line === 'string' ? page.line : page.line.little;
      if (!big || !little || big.length > 120 || little.length > 120) throw new Error('Invalid canonical caption: ' + meta.id + '/' + page.art);
      return {
        id: page.art,
        art: asset('/assets/adventure/' + meta.id + '/' + page.art + '.webp'),
        ages: page.ages, big, little,
        ...(page.key ? { key: page.key } : {})
      };
    });
  }
  return {
    id: meta.id, day, talk, sound: meta.sound || null,
    title: meta.title, hook: meta.line, game: meta.game || meta.id, gameName: meta.name,
    cover: asset('/assets/crafted/home-' + meta.hero + '.webp'), wash: body.wash,
    intro: pages(body.intro), ending: pages(body.ending)
  };
}
const stories = days.map((meta, i) => story(meta, scenes[meta.id], i + 1, false))
  .concat(talking.map(meta => story(meta, talkScenes[meta.id], 1, true)));
if (new Set(stories.map(s => s.id)).size !== stories.length) throw new Error('Duplicate story ids.');
const result = {
  version: 1,
  sources: Object.fromEntries(files.map(file => [file, createHash('sha256').update(sources[file]).digest('hex')])),
  stories
};
const destination = process.env.SONA_ADVENTURE_OUTPUT || join(root, 'native/family-ios/SonaNativePreview/Content/Adventures.json');
const output = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!existsSync(destination) || readFileSync(destination, 'utf8') !== output) throw new Error('Adventures.json differs from canonical sources. Re-export it.');
} else {
  writeFileSync(destination, output);
}
console.log(stories.length + ' canonical adventures, ' + stories.reduce((n, s) => n + s.intro.length + s.ending.length, 0) + ' exact scenes; ' + talking.length + ' sound-specific Day 1 choices.');
