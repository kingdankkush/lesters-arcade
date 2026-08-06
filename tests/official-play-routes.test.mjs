import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createOfficialPlayRoutes } from '../apps/portal/src/routes/official-play-routes.mjs';

function node(tag = 'div', props = {}) {
  const classes = new Set();
  return {
    tag, children: [], dataset: {}, listeners: {}, style: {}, attrs: {}, hidden: false,
    ...props,
    classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value), contains: (value) => classes.has(value) },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    getAttribute(name) { return this.attrs[name] ?? null; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
  };
}

function modeDom() {
  const keys = ['officialModeSelect', 'officialModeEyebrow', 'officialModeTitle', 'officialModeCopy', 'officialModeArtNote', 'officialFreeModeButton', 'officialRankedModeButton', 'officialFreeModeBanner', 'officialRankedModeBanner', 'officialFreeModeTitle', 'officialRankedModeTitle', 'officialFreeModeCopy', 'officialRankedModeCopy', 'officialRankedTooltip'];
  return Object.fromEntries(keys.map((key) => [key, node(key)]));
}

test('play routes preserve character selection, cabinet reset, mode gating, and gameplay labels', async () => {
  const dom = {
    officialCharacterSelect: node('character-select'), officialCharacterRoster: node('roster'), officialCabinetGrid: node('grid'),
    ...modeDom(), officialGameModeTitle: node('game-title'), officialGameStateCopy: node('game-copy'), combatStatus: node('status'),
  };
  const combat = { characterId: 'lit-commando' };
  const context = {
    connectedWallet: '0xabc', state: { profiles: { '0xabc': {} } }, combat,
    officialSelectedMode: 'free', hmhRebootActive: false, game: { id: 'lester-blaster', title: 'Hard Money Heroes' },
  };
  const calls = { views: [], selected: [], preferred: [], loads: 0, persisted: 0 };
  const routes = createOfficialPlayRoutes({
    dom,
    getContext: () => context,
    appendText: (parent, tag, text, className = '') => parent.append(node(tag, { textContent: text, className })),
    applyGameModeSelectBackground: () => {}, applyHardMoneyHeroScreenBackground: () => {},
    buildCharacterSelectEntries: () => [{ id: 'lit-valkyrie', legacyId: 'lilly', name: 'Lilly', tagline: 'Fast', bio: 'Hero', startingWeaponId: 'pistol', passive: { title: 'Luck', description: 'More luck' }, stats: {}, locked: false, selected: false, cta: 'Select' }],
    buildGameModeSelectModel: () => ({ gameId: 'lester-blaster', artStatus: 'production', eyebrow: 'Select Mode', title: 'Hard Money Heroes', copy: 'Choose', free: { label: 'Free Mode', copy: 'Practice', bannerAsset: '/free.png', bannerAlt: 'Free' }, ranked: { label: 'Ranked', copy: 'Compete', bannerAsset: '/ranked.png', bannerAlt: 'Ranked', requiresZkLtc: true, faucetUrl: 'https://example.test' } }),
    cabinetPlayableInCurrentMode: () => true,
    DEV_CABINETS_ENABLED: true,
    el: (tag, props = {}) => node(tag, props),
    HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG: {}, HERO_ROSTER_BASE: [],
    heroRotationSprite: () => null,
    LESTERS_ARCADE_V2_APP_SHELL: { cabinets: [{ id: 'chikun', gameId: 'chikun', title: 'Chikun', description: 'Dev cabinet', playable: false }] },
    loadChikunGame: async () => { calls.loads += 1; },
    persistArcadeStateSoon: () => { calls.persisted += 1; },
    playSfxCue: () => {}, productionCabinetSprite: () => null, renderArcadeIcon: () => node('icon'), renderHeroStatBars: () => {}, renderRotatingCabinetSprite: () => node('sprite'),
    resolveSelectedCharacterId: () => 'lit-commando',
    selectCabinet: (id) => calls.selected.push(id),
    selectedGame: () => context.game,
    SETTLEMENT_LIVE: false,
    setPreferredCharacter: (_profile, id) => calls.preferred.push(id),
    setView: (view) => calls.views.push(view),
    weaponById: () => ({ title: 'Coin Blaster' }),
  });

  routes.renderCharacterSelect();
  assert.equal(dom.officialCharacterRoster.children.length, 1);
  dom.officialCharacterRoster.children[0].listeners.click();
  assert.equal(combat.characterId, 'lilly');
  assert.deepEqual(calls.preferred, ['lilly']);
  assert.equal(calls.persisted, 1);
  assert.deepEqual(calls.views, ['level-one-intro']);

  routes.renderCabinets();
  await dom.officialCabinetGrid.children[0].listeners.click();
  assert.equal(calls.loads, 1);
  assert.deepEqual(calls.selected, ['chikun']);
  assert.deepEqual(calls.views, ['level-one-intro', 'mode-select']);

  context.connectedWallet = null;
  routes.renderModeSelect();
  assert.equal(dom.officialRankedModeButton.dataset.needsWallet, 'true');
  assert.equal(dom.officialRankedTooltip.dataset.state, 'guest');

  routes.renderGameplay();
  assert.match(dom.officialGameModeTitle.textContent, /Top-Down Reboot \/\/ Free Mode/);
  context.game = { id: 'chikun', title: "Chikun's Escape" };
  context.officialSelectedMode = 'ranked';
  routes.renderGameplay();
  assert.match(dom.officialGameModeTitle.textContent, /Chikun's Escape \/\/ Ranked Testnet/);
});

test('main delegates every remaining official play renderer', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /createOfficialPlayRoutes/);
  for (const name of ['renderOfficialCharacterSelect', 'renderOfficialCabinets', 'renderOfficialModeSelect', 'renderOfficialGameplay']) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`));
  }
  assert.match(main, /selectCabinet: \(gameId\) => \{[\s\S]*?currentSession = null;[\s\S]*?lastCompletedSession = null;[\s\S]*?lastRunResult = null;/);
});
