// Data-only export of the shipping shelf. Does not run a page or change public/.
// Run from any directory: node native/family-ios/tools/export-books.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = readFileSync(join(root, 'public/library.html'), 'utf8');
const marker = /\bvar STORIES\s*=\s*\[/g.exec(source);
if (!marker) throw new Error('Shipping STORIES array was not found.');
const start = source.indexOf('[', marker.index);
let quote = '', comment = '', escaped = false, depth = 0, end = -1;
for (let i = start; i < source.length; i++) {
  const c = source[i], next = source[i + 1];
  if (comment === 'line') { if (c === '\n') comment = ''; continue; }
  if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
  if (quote) {
    if (escaped) escaped = false;
    else if (c === '\\') escaped = true;
    else if (c === quote) quote = '';
    continue;
  }
  if (c === '/' && next === '/') { comment = 'line'; i++; continue; }
  if (c === '/' && next === '*') { comment = 'block'; i++; continue; }
  if (c === '"' || c === "'") { quote = c; continue; }
  if (c === '[') depth++;
  if (c === ']' && --depth === 0) { end = i + 1; break; }
}
if (end < 0) throw new Error('Shipping STORIES array is not balanced.');
// Only the array literal is evaluated, in an empty context with no page APIs.
const stories = vm.runInNewContext('(' + source.slice(start, end) + ')', Object.create(null), { timeout: 1000 });
if (!Array.isArray(stories) || !stories.length) throw new Error('Empty shipping shelf.');

function approvedAsset(asset) {
  if (!/^\/assets\/books\/[a-z0-9/_-]+\.webp$/.test(asset || '')) throw new Error('Unexpected book art path: ' + asset);
  if (!existsSync(join(root, 'public', asset))) throw new Error('Missing original artwork: ' + asset);
  return asset;
}

const ids = new Set();
const books = stories.map(story => {
  const id = story.painted ? 'painted-' + story.painted : (story.cover || '').split('/')[3];
  if (!id || ids.has(id)) throw new Error('Missing or duplicate stable book id: ' + id);
  ids.add(id);
  if (!story.title || !story.sound || !story.pages?.length) throw new Error('Incomplete story: ' + id);
  const cover = approvedAsset(story.cover || '/assets/books/painted/' + story.painted + '-cover.webp');
  const book = {
    id, title: story.title, sound: story.sound, emoji: story.emoji || '📖',
    colors: story.colors || [], cover, coverAlt: story.coverAlt || '',
    pages: story.pages.map((page, index) => {
      if (!page.t) throw new Error('Missing canonical page text: ' + id + '/' + index);
      const art = approvedAsset(page.art || '/assets/books/painted/' + story.painted + '.webp');
      return {
        text: page.t, art, alt: page.alt || '', emoji: page.e || story.emoji || '📖',
        ...(story.keys?.[index] ? { key: story.keys[index] } : {}),
        ...(!page.art && story.painted ? { crop: { column: index % 3, row: Math.floor(index / 3), columns: 3, rows: 2 } } : {})
      };
    })
  };
  if (story.opens) book.opens = story.opens;
  if (story.season) book.season = { startsOn: story.season.startsOn, endsOn: story.season.endsOn };
  return book;
});
const catalog = {
  version: 1,
  source: 'public/library.html:STORIES',
  sourceSHA256: createHash('sha256').update(source).digest('hex'),
  books
};
const destination = join(root, 'native/family-ios/SonaNativePreview/Content/Books.json');
writeFileSync(destination, JSON.stringify(catalog, null, 2) + '\n');
console.log('Exported ' + books.length + ' original books, ' + books.reduce((n, b) => n + b.pages.length, 0) + ' pages; ' + books.filter(b => b.season).length + ' seasonal.');
