import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createOfficialLeaderboardRoute } from '../apps/portal/src/routes/official-leaderboard-route.mjs';

function node(tag = 'div', props = {}) {
  return {
    tag,
    children: [],
    dataset: {},
    listeners: {},
    ...props,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this[name] = value; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
  };
}

test('leaderboard route restores default state and renders an empty ranked board', () => {
  const grid = node('grid');
  const routeState = { cadence: 'all-time', gameId: 'lester-blaster', search: '', sortKey: 'score', sortDir: 'desc' };
  const route = createOfficialLeaderboardRoute({
    dom: { officialCabinetGrid: grid },
    routeState,
    getContext: () => ({ connectedWallet: null, state: { profiles: {} } }),
    appendText: (parent, tag, text, className = '') => parent.append(node(tag, { textContent: text, className })),
    buildLeaderboardExperienceV2Model: (_state, input) => ({
      cadence: input.cadence,
      periodKey: 'all-time',
      topEntries: [],
      total: 0,
      trustSummary: { flaggedRuns: 0 },
      playerRank: null,
      playerEntry: null,
    }),
    documentRef: { createTextNode: (text) => ({ text }), querySelector: () => null },
    el: (tag, props = {}) => node(tag, props),
    formatSurvive: () => '0:00',
    getAllCadenceLeaderboards: () => [{ cadence: 'all-time' }, { cadence: 'weekly' }],
    getGame: () => ({ title: 'Hard Money Heroes' }),
    humanList: (items) => items.join(', '),
    leaderboardEntryProvenance: () => ({ official: false, label: 'HOUSE SCORE' }),
    playableCabinetNames: () => ['Hard Money Heroes'],
    publicLeaderboardCabinets: () => [{ gameId: 'lester-blaster', title: 'Hard Money Heroes' }],
    renderArcadeIcon: () => node('icon'),
    renderAvatarChip: () => node('avatar'),
    resolveDisplayName: (_profile, wallet) => wallet,
    summarizeVisibleLeaderboardProvenance: () => ({ label: 'Showing 0 players · 0 official · 0 house scores', houseScoreCount: 0, officialCount: 0 }),
  });

  route.renderLeaderboards();
  assert.equal(grid.children.length, 2);
  assert.match(JSON.stringify(grid.children[0]), /Leaderboard Filters/);
  assert.match(JSON.stringify(grid.children[1]), /No ranked scores in this period yet/);
  assert.deepEqual(routeState, { cadence: 'all-time', gameId: 'lester-blaster', search: '', sortKey: 'score', sortDir: 'desc' });

  const weekly = JSON.stringify(grid.children[0]).includes('WEEKLY');
  assert.equal(weekly, true);
});

test('main delegates leaderboard rendering and all view state to the route module', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /createOfficialLeaderboardRoute/);
  assert.match(main, /const leaderboardRouteState =/);
  assert.doesNotMatch(main, /function renderOfficialLeaderboards\(/);
  for (const name of ['officialLeaderboardCadence', 'leaderboardGameId', 'leaderboardSearch', 'leaderboardSortKey', 'leaderboardSortDir']) {
    assert.doesNotMatch(main, new RegExp(`let ${name}\\s*=`));
  }
});
