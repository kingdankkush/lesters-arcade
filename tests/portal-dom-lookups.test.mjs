// main.js resolves its `dom` table once, at load. A lookup for an id that no
// portal page has stays null, and a renderer that writes to it throws as soon
// as anything calls it. That is how the legacy backstage renderers
// (renderParentOps, renderMenuModel, renderUiQualityGuide, ...) sat uncalled
// in main.js for weeks after 372c7ef9 removed their markup. Every lookup must
// find an element in a page that loads main.js, or be listed below with the
// reason its null is harmless.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const portal = new URL('../apps/portal/', import.meta.url);
const main = readFileSync(new URL('main.js', portal), 'utf8');
const candidatePages = ['index.html', ...readdirSync(new URL('discover/', portal)).filter((name) => name.endsWith('.html')).map((name) => `discover/${name}`)];
const pages = candidatePages
  .map((path) => ({ path, html: readFileSync(new URL(path, portal), 'utf8') }))
  .filter(({ html }) => /<script type="module" src="\.\/dist\/main\.js/.test(html));

const KNOWN_MISSING = new Map([
  ['splashFeaturedCabinet', 'official-shell-routes.mjs renders into it only when the element exists'],
  ['runStatus', 'renderOfficialRunStatus() returns early without it'],
  ['runDetails', 'renderOfficialRunStatus() returns early without it'],
  ['leaderboardPanel', 'renderLeaderboard() has no caller'],
  ['combatCanvas', 'legacy Canvas combat loop, superseded by the PixiJS HMH child'],
  ['combatRunStatus', 'legacy Canvas combat sandbox status'],
]);

function domTable() {
  const start = main.indexOf('\nconst dom = {\n');
  assert.ok(start >= 0, 'main.js declares the dom table');
  const end = main.indexOf('\n};\n', start);
  const lines = main.slice(start + '\nconst dom = {\n'.length, end).split('\n').filter((line) => line.trim());
  return lines.map((line) => {
    const match = line.match(/^ {2}(\w+): document\.querySelector\('#([\w-]+)'\),$/);
    assert.ok(match, `unexpected dom table line: ${line}`);
    return { key: match[1], id: match[2] };
  });
}

const inSomePage = (id) => pages.some(({ html }) => new RegExp(`\\sid="${id}"`).test(html));

test('the portal pages that load main.js are found', () => {
  assert.ok(pages.some(({ path }) => path === 'index.html'), 'index.html loads main.js');
  assert.ok(pages.length >= 2, `pages: ${pages.map(({ path }) => path).join(', ')}`);
});

test('every dom lookup in main.js finds an element in a portal page', () => {
  const missing = domTable().filter(({ key, id }) => !KNOWN_MISSING.has(key) && !inSomePage(id));
  assert.deepEqual(missing.map(({ key, id }) => `dom.${key} -> #${id}`), []);
});

test('the known-missing list has no stale entries', () => {
  const table = new Map(domTable().map(({ key, id }) => [key, id]));
  for (const key of KNOWN_MISSING.keys()) {
    assert.ok(table.has(key), `dom.${key} is gone; drop it from KNOWN_MISSING`);
    assert.equal(inSomePage(table.get(key)), false, `#${table.get(key)} exists now; drop dom.${key} from KNOWN_MISSING`);
  }
});
