import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORTAL_GAMES, portalPageMeta, portalSchema, renderCatalog, renderGameDetails } from '../apps/portal/src/portal-content.mjs';
import { CABINET_FRAMING, cabinetFramePresentation } from '../apps/portal/src/cabinet-presentation.mjs';

test('public discovery describes all three real games and keeps private session URLs out of indexing', () => {
  assert.deepEqual(PORTAL_GAMES.map(game => game.slug), ['hard-money-heroes', 'chikun', 'stacked']);
  const titles = new Set(['/', '/games', ...PORTAL_GAMES.map(game => `/games/${game.slug}`)].map(url => portalPageMeta(url).title));
  assert.equal(titles.size, 5);
  for (const game of PORTAL_GAMES) {
    const meta = portalPageMeta(`/play/${game.slug}`);
    assert.equal(meta.canonical, `https://lestersarcade.io/games/${game.slug}`);
    assert.match(renderCatalog(), new RegExp(`href="/play/${game.slug}"`));
    assert.ok(renderGameDetails(game.slug).includes(game.controls));
  }
  for (const url of ['/profile', '/settings', '/scores', '/play/hard-money-heroes/game-session-000000001']) assert.equal(portalPageMeta(url).robots, 'noindex, follow');
});

test('structured discovery reuses a single brand identity and makes no prize or worldwide ranking claims', () => {
  const schema = JSON.parse(portalSchema('/games'));
  assert.equal(schema['@context'], 'https://schema.org');
  const games = schema['@graph'].filter(item => item['@type'] === 'VideoGame');
  assert.equal(games.length, 3);
  for (const game of games) { assert.equal(game.isAccessibleForFree, true); assert.equal(game.publisher['@id'], 'https://lestersarcade.io/#organization'); }
  assert.doesNotMatch(JSON.stringify(schema), /aggregateRating|prize|global leaderboard/i);
});

test('every cabinet view has the same visible height and ground line without stretching', () => {
  for (const [id, frames] of Object.entries(CABINET_FRAMING)) {
    assert.equal(frames.length, 6);
    for (let index=0; index<frames.length; index++) {
      const [w,h,x,y,right,bottom]=frames[index];
      const style=cabinetFramePresentation(id,index);
      assert.ok(Math.abs(style.height*(bottom-y)/h-100)<0.001, `${id}/${index} visible height`);
      assert.ok(Math.abs(style.top+style.height*y/h)<0.001, `${id}/${index} top`);
      assert.ok(Math.abs(style.width/style.height-w/h)<0.001, `${id}/${index} source aspect ratio`);
      assert.ok((right-x)/(bottom-y) <= 1, 'cabinet fits the square stage');
    }
  }
  assert.equal(cabinetFramePresentation('hero-lilly',0), null, 'hero art never gets cabinet framing');
});

test('home discovery is readable before JavaScript and primary links precede optional media', () => {
  const html=readFileSync(new URL('../apps/portal/index.html',import.meta.url),'utf8');
  assert.match(html, /<h1[^>]*>[\s\S]*?One more run\./);
  assert.match(html, /href="\/games"/);
  for(const game of PORTAL_GAMES) assert.ok(html.includes(`/games/${game.slug}`));
  assert.match(html, /How does Lester's Arcade work/);
  assert.match(html, /device-local/i);
  assert.ok(html.indexOf('id="officialGuestEnterButton"')<html.indexOf('id="splashLoopVideo"'));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size,'the static app shell has no duplicate control IDs');
});
