import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createOfficialProfileRoute } from '../apps/portal/src/routes/official-profile-route.mjs';

function node(tag = 'div', props = {}) {
  return {
    tag,
    children: [],
    listeners: {},
    classList: { values: [], add(value) { this.values.push(value); } },
    ...props,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
  };
}

test('profile route renders guest local stats and connect CTA without wallet dependencies', () => {
  const grid = node('grid');
  const calls = { connect: 0, sfx: [] };
  const routeState = { gameId: 'lester-blaster', avatarJustSaved: false, usernameJustSaved: false };
  const context = {
    connectedWallet: null,
    connectedChainId: null,
    walletConnector: null,
    state: {},
    combat: { score: 12345, kills: 67, longestSurvivalThisRun: 125 },
  };
  const route = createOfficialProfileRoute({
    dom: { officialCabinetGrid: grid },
    routeState,
    getContext: () => context,
    el: (tag, props = {}) => node(tag, props),
    appendText: (parent, tag, text, className = '') => parent.append(node(tag, { textContent: text, className })),
    renderAvatarChip: () => node('avatar'),
    isSimulatedWalletActive: () => false,
    playSfxCue: (cue) => calls.sfx.push(cue),
    connectWallet: () => { calls.connect += 1; },
    buildPlayerArcadeSnapshot: () => { throw new Error('wallet snapshot must not run for guests'); },
    buildProfileExperienceV2Model: () => { throw new Error('profile v2 must not run for guests'); },
  });

  route.renderProfile();
  assert.equal(grid.children.length, 2);
  assert.ok(grid.classList.values.includes('profile-command-grid'));
  const guestCard = grid.children[1];
  const flat = JSON.stringify(guestCard);
  assert.match(flat, /12,345/);
  assert.match(flat, /67/);
  assert.match(flat, /2:05/);
  const connectButton = guestCard.children.find((child) => child.tag === 'button');
  assert.ok(connectButton);
  connectButton.listeners.click();
  assert.deepEqual(calls.sfx, ['menu-click']);
  assert.equal(calls.connect, 1);

  context.combat.score = 54321;
  route.renderProfile();
  assert.match(JSON.stringify(grid.children[1]), /54,321/, 'route must read fresh context on every render');
});

test('main delegates profile rendering and profile view state to the route module', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /createOfficialProfileRoute/);
  assert.match(main, /const profileRouteState =/);
  assert.match(main, /createOfficialProfileRoute\([\s\S]*?documentRef: document/);
  assert.doesNotMatch(main, /function renderOfficialProfile\(/);
  assert.doesNotMatch(main, /let profileAvatarJustSaved/);
  assert.doesNotMatch(main, /let profileUsernameJustSaved/);
  assert.doesNotMatch(main, /let profileGameId/);
});
