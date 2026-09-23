import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOfficialPlayRoutes } from '../apps/portal/src/routes/official-play-routes.mjs';
import { buildGameModeSelectModel } from '../apps/portal/src/arcade-core.mjs';
import { PORTAL_COPY, PORTAL_FLAGS, PORTAL_GAMES, escapeHtml, portalCopyFor } from '../apps/portal/src/portal-content.mjs';
import { buildPortalPages } from '../scripts/build-portal-pages.mjs';

// Contract A33: the mode-select cards are what a player reads just before
// choosing Ranked. The SPA route and the prerendered pages must say the same
// thing, and both must follow SETTLEMENT_LIVE and HOSTED_PROFILE_SYNC.
const portal = fileURLToPath(new URL('../apps/portal/', import.meta.url));
const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false });
const hostedPreview = portalCopyFor({ settlementLive: false, hostedProfileSync: true });
const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
const SITE_COPY_GAMES = ['lester-blaster', 'chikun'];

function node(tag = 'div', props = {}) {
  return {
    tag, children: [], dataset: {}, style: {}, attrs: {}, hidden: false, textContent: '',
    ...props,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return this.attrs[name] ?? null; },
  };
}

function renderModeSelect({ gameId, connectedWallet = '0xabc', portalCopy } = {}) {
  const keys = ['officialModeSelect', 'officialModeEyebrow', 'officialModeTitle', 'officialModeCopy', 'officialModeArtNote', 'officialFreeModeButton', 'officialRankedModeButton', 'officialFreeModeBanner', 'officialRankedModeBanner', 'officialFreeModeTitle', 'officialRankedModeTitle', 'officialFreeModeCopy', 'officialRankedModeCopy', 'officialRankedTooltip'];
  const dom = Object.fromEntries(keys.map(key => [key, node(key)]));
  const routes = createOfficialPlayRoutes({
    dom,
    getContext: () => ({ connectedWallet }),
    selectedGame: () => ({ id: gameId }),
    buildGameModeSelectModel,
    applyGameModeSelectBackground: () => {},
    appendText: (parent, tag, text) => parent.append(node(tag, { textContent: text })),
    el: (tag, props = {}) => node(tag, props),
    SETTLEMENT_LIVE: false,
    ...(portalCopy ? { portalCopy } : {}),
  });
  routes.renderModeSelect();
  const tooltip = dom.officialRankedTooltip.children.map(child => child.textContent);
  return { mode: dom.officialModeCopy.textContent, ranked: dom.officialRankedModeCopy.textContent, free: dom.officialFreeModeCopy.textContent, tooltip };
}

const block = (html, key) => html.match(new RegExp(`<!-- copy:${key}:start -->([\\s\\S]*?)<!-- copy:${key}:end -->`))?.[1];
const slugOf = gameId => PORTAL_GAMES.find(game => game.id === gameId).slug;

test('the HMH and Chikun mode-select cards show the site copy for every flag state', () => {
  for (const [name, copy] of Object.entries({ preview, hostedPreview, launch })) {
    for (const gameId of SITE_COPY_GAMES) {
      const descriptor = buildGameModeSelectModel(gameId);
      const view = renderModeSelect({ gameId, portalCopy: copy });
      assert.equal(view.mode, copy.modeSelect[gameId].copy, `${name} ${gameId} mode line`);
      assert.equal(view.ranked, copy.modeSelect[gameId].ranked, `${name} ${gameId} Ranked card`);
      assert.deepEqual(view.tooltip, [`${descriptor.ranked.label}: ${copy.modeRankedTooltip}`, copy.modeSelect[gameId].ranked], `${name} ${gameId} Ranked tooltip`);
      assert.equal(view.free, descriptor.free.copy, 'the Free card keeps its descriptor copy, true in both states');
    }
  }
});

test('without an injected copy the route uses the committed flags', () => {
  for (const gameId of SITE_COPY_GAMES) {
    const view = renderModeSelect({ gameId });
    assert.equal(view.mode, PORTAL_COPY.modeSelect[gameId].copy);
    assert.equal(view.ranked, PORTAL_COPY.modeSelect[gameId].ranked);
  }
  assert.deepEqual(PORTAL_COPY.modeSelect, portalCopyFor(PORTAL_FLAGS).modeSelect);
});

test('the preview cards promise no publishing and the launch cards state the fee and the check', () => {
  for (const gameId of SITE_COPY_GAMES) {
    const now = renderModeSelect({ gameId, portalCopy: preview });
    const text = [now.mode, now.ranked, ...now.tooltip].join(' ');
    assert.match(now.ranked, /nothing is published on chain yet/);
    assert.doesNotMatch(text, /Publish your score|zkLTC|LiteForge|0\.102|replayed/i, `${gameId} preview`);
  }
  const hmh = renderModeSelect({ gameId: 'lester-blaster', portalCopy: launch });
  assert.match(hmh.ranked, /^0\.102 testnet zkLTC per run\. The arcade server plausibility-checks your run \(it is not replayed\) and publishes it on LitVM\.$/);
  const chikun = renderModeSelect({ gameId: 'chikun', portalCopy: launch });
  assert.match(chikun.ranked, /^0\.102 testnet zkLTC per run\. The arcade server replays your run from its inputs and publishes it on LitVM\.$/);
  for (const view of [hmh, chikun]) {
    const text = [view.mode, view.ranked, ...view.tooltip].join(' ');
    assert.match(text, /LitVM testnet/);
    assert.doesNotMatch(text, /preview|Free on testnet|safely gated|canonical|temporarily disabled|device|local/i, 'no preview statement survives the flip');
  }
  assert.equal(hmh.tooltip[0], 'Play Ranked: verified and published on LitVM');
});

test('the guest tooltip and STACKED keep their own descriptors', () => {
  const guest = renderModeSelect({ gameId: 'lester-blaster', connectedWallet: null, portalCopy: launch });
  const hmh = buildGameModeSelectModel('lester-blaster');
  assert.equal(guest.tooltip[0], `${hmh.free.label} is open to guests`);
  // STACKED's card copy belongs to the ranked-client slice (contract §10.2);
  // only the tooltip heading comes from the site copy.
  const stacked = buildGameModeSelectModel('stacked');
  for (const copy of [preview, launch]) {
    const view = renderModeSelect({ gameId: 'stacked', portalCopy: copy });
    assert.equal(view.mode, stacked.copy);
    assert.equal(view.ranked, stacked.ranked.copy);
    assert.equal(view.tooltip[0], `${stacked.ranked.label}: ${copy.modeRankedTooltip}`);
  }
  assert.equal(PORTAL_COPY.modeSelect.stacked, undefined);
});

test('the prerendered mode-select blocks match what the SPA shows', () => {
  const index = readFileSync(join(portal, 'index.html'), 'utf8');
  assert.equal(block(index, 'mode-copy'), escapeHtml(PORTAL_COPY.modeSelect['lester-blaster'].copy));
  assert.equal(block(index, 'mode-ranked'), escapeHtml(PORTAL_COPY.modeSelect['lester-blaster'].ranked));
  const dir = mkdtempSync(join(tmpdir(), 'portal-mode-select-'));
  try {
    buildPortalPages({ flags: 'live', outDir: dir });
    for (const [pages, copy] of [[portal, PORTAL_COPY], [dir, launch]]) {
      for (const game of PORTAL_GAMES) {
        const html = readFileSync(join(pages, `discover/${game.slug}.html`), 'utf8');
        const expected = copy.modeSelect[game.id]?.ranked ?? copy.modeRanked;
        assert.equal(block(html, 'mode-ranked'), escapeHtml(expected), `${game.slug} Ranked card (${copy.state})`);
        if (copy.modeSelect[game.id]) assert.equal(renderModeSelect({ gameId: game.id, portalCopy: copy }).ranked, expected);
      }
    }
    assert.equal(block(readFileSync(join(dir, 'index.html'), 'utf8'), 'mode-ranked'), escapeHtml(launch.modeSelect['lester-blaster'].ranked));
    assert.match(readFileSync(join(dir, `discover/${slugOf('stacked')}.html`), 'utf8'), /<!-- copy:mode-ranked:start -->0\.102 testnet zkLTC per run\. The arcade server checks your run and publishes it on LitVM\.<!-- copy:mode-ranked:end -->/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
