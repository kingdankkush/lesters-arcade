import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORTAL_COPY, PORTAL_GAMES, escapeHtml, portalCopyFor, portalPageMeta, portalSchema, renderCatalog, renderGameDetails } from '../apps/portal/src/portal-content.mjs';
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
  for (const settlementLive of [false, true]) {
    const copy = portalCopyFor({ settlementLive, hostedProfileSync: settlementLive });
    assert.doesNotMatch(portalSchema('/games', copy), /aggregateRating|prize|global leaderboard/i, `structured data with SETTLEMENT_LIVE=${settlementLive}`);
  }
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
  // The Ranked wording follows the settlement flags (contract A33).
  assert.ok(html.includes(escapeHtml(PORTAL_COPY.scoresNote)), 'the scores section states the current Ranked status');
  for (const [question, answer] of PORTAL_COPY.faq) assert.ok(html.includes(`<summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p>`), question);
  assert.doesNotMatch(html, /\byearly\b/i, 'the scoreboards are Weekly, Monthly and All-time');
  assert.ok(html.indexOf('id="officialGuestEnterButton"')<html.indexOf('id="splashLoopVideo"'));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size,'the static app shell has no duplicate control IDs');
});

// Contract A33: the SPA game view and the head metadata take the copy by
// injection, so the launch wording is rendered here without flipping a flag.
test('the SPA game details and metadata render the copy they are given', async () => {
  const { gameDetailsNode, syncDiscoveryMeta } = await import('../apps/portal/src/portal-discovery.mjs');
  const element = tag => ({
    tag, textContent: '', className: '', attrs: {}, children: [],
    setAttribute(name, value) { this.attrs[name] = value; },
    append(...children) { this.children.push(...children); },
  });
  const text = node => [node.textContent, ...node.children.map(text)].join(' ');
  const documentRef = { createElement: element };
  const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
  for (const game of PORTAL_GAMES) {
    const rendered = text(gameDetailsNode(documentRef, game.slug, launch));
    assert.ok(rendered.includes(launch.rankedDetail[game.id]), `${game.slug} launch detail`);
    assert.doesNotMatch(rendered, /device-local|preview/i);
    assert.ok(text(gameDetailsNode(documentRef, game.slug)).includes(PORTAL_COPY.rankedDetail[game.id]), `${game.slug} default detail`);
  }
  assert.equal(gameDetailsNode(documentRef, 'not-a-game', launch), null);

  const head = new Map();
  const headDocument = {
    title: '',
    querySelector: selector => {
      if (!head.has(selector)) head.set(selector, { attrs: {}, textContent: '', setAttribute(name, value) { this.attrs[name] = value; } });
      return head.get(selector);
    },
  };
  syncDiscoveryMeta(headDocument, '/', launch);
  assert.equal(head.get('meta[name="description"]').attrs.content, launch.description);
  assert.equal(head.get('meta[property="og:description"]').attrs.content, launch.description);
  const website = JSON.parse(head.get('#portalStructuredData').textContent)['@graph'].find(node => node['@type'] === 'WebSite');
  assert.equal(website.description, launch.description);
  syncDiscoveryMeta(headDocument, '/');
  assert.equal(head.get('meta[name="description"]').attrs.content, PORTAL_COPY.description);
});
