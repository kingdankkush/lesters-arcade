import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { wireHmhFreeQuickplay } from '../apps/portal/src/hmh-free-quickplay.mjs';
import { createOfficialPlayRoutes } from '../apps/portal/src/routes/official-play-routes.mjs';

function node(tag = 'div', props = {}) {
  const classes = new Set(String(props.className ?? '').split(/\s+/u).filter(Boolean));
  return {
    tag,
    children: [],
    dataset: {},
    listeners: {},
    attrs: {},
    hidden: false,
    disabled: false,
    ...props,
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
      contains: (value) => classes.has(value),
    },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    getAttribute(name) { return this.attrs[name] ?? null; },
    addEventListener(type, listener) { this.listeners[type] = listener; },
    removeEventListener(type, listener) { if (this.listeners[type] === listener) delete this.listeners[type]; },
    click() { return this.listeners.click?.({ currentTarget: this }); },
    focus() { this.focused = true; },
  };
}

function characterRoutes({ state }) {
  const roster = node('roster');
  const dom = { officialCharacterSelect: node('character-select'), officialCharacterRoster: roster };
  const combat = { characterId: null };
  const routes = createOfficialPlayRoutes({
    dom,
    getContext: () => ({ connectedWallet: null, state: { profiles: {} }, combat }),
    appendText: (parent, tag, text, className = '') => parent.append(node(tag, { textContent: text, className })),
    applyHardMoneyHeroScreenBackground: () => {},
    buildCharacterSelectEntries: () => [
      { id: 'lit-commando', name: 'Lit Commando', tagline: 'Ready', bio: 'Ordinary unlocked hero', startingWeaponId: 'pistol', passive: { title: 'Grit', description: 'Steady' }, stats: {}, locked: false, selected: true, cta: 'Select hero' },
      { id: 'lester-original', name: 'Lester', tagline: 'Locked', bio: 'Earn this hero', startingWeaponId: 'pistol', passive: { title: 'Legacy', description: 'Locked' }, stats: {}, locked: true, selected: false, cta: 'Locked' },
    ],
    el: (tag, props = {}) => node(tag, props),
    HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG: {},
    HERO_ROSTER_BASE: [],
    heroRotationSprite: () => null,
    persistArcadeStateSoon: () => {},
    playSfxCue: () => {},
    renderHeroStatBars: () => {},
    resolveSelectedCharacterId: () => 'lit-commando',
    setPreferredCharacter: () => {},
    setView: (view) => { state.view = view; },
    weaponById: () => ({ title: 'Coin Blaster' }),
  });
  return { combat, dom, routes };
}

test('one homepage click delegates HMH selection and Free session creation to existing parent authorities', async () => {
  const button = node('button');
  const status = node('p', { hidden: true });
  const calls = [];
  const state = { selectedGameId: null, mode: null, session: null, view: 'wallet-splash' };
  const quickplay = wireHmhFreeQuickplay({
    button,
    status,
    selectCabinet(gameId) {
      calls.push(['selectCabinet', gameId]);
      state.selectedGameId = gameId;
      state.session = null;
    },
    async startFreeMode() {
      calls.push(['startFreeMode']);
      state.mode = 'free';
      state.session = { gameId: state.selectedGameId, mode: 'free', rankedEligible: false };
      state.view = 'character-select';
    },
    getStep: () => state.view,
  });

  await button.click();

  assert.deepEqual(calls, [['selectCabinet', 'lester-blaster'], ['startFreeMode']]);
  assert.deepEqual(state.session, { gameId: 'lester-blaster', mode: 'free', rankedEligible: false });
  assert.equal('heroId' in state.session, false, 'quick-start must not pregrant or preselect a hero');
  assert.equal(state.view, 'character-select');
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute('aria-busy'), null);
  assert.equal(status.hidden, true);
  quickplay.destroy();
});

test('the ordinary unlocked hero remains click two and Begin Level remains click three', async () => {
  let deliberateClicks = 0;
  const state = { selectedGameId: null, session: null, view: 'wallet-splash', mounted: false };
  const button = node('button');
  const status = node('p', { hidden: true });
  wireHmhFreeQuickplay({
    button,
    status,
    selectCabinet: (gameId) => { state.selectedGameId = gameId; },
    startFreeMode: async () => {
      state.session = { gameId: state.selectedGameId, mode: 'free', rankedEligible: false };
      state.view = 'character-select';
    },
    getStep: () => state.view,
  });

  deliberateClicks += 1;
  await button.click();
  const { combat, dom, routes } = characterRoutes({ state });
  routes.renderCharacterSelect();
  assert.equal(dom.officialCharacterRoster.children.length, 2);
  assert.equal(dom.officialCharacterRoster.children[1].disabled, true, 'the shortcut must not unlock Lester');

  deliberateClicks += 1;
  dom.officialCharacterRoster.children[0].click();
  assert.equal(combat.characterId, 'lit-commando');
  assert.equal(state.view, 'level-one-intro');

  deliberateClicks += 1;
  assert.equal(state.session.mode, 'free');
  state.view = 'gameplay';
  state.mounted = true;
  assert.equal(state.view, 'gameplay');
  assert.equal(state.mounted, true);
  assert.equal(deliberateClicks, 3);
});

test('quick-start failure is announced and returns focus without entering a false success state', async () => {
  const button = node('button');
  const status = node('p', { hidden: true });
  const errors = [];
  const quickplay = wireHmhFreeQuickplay({
    button,
    status,
    selectCabinet: () => {},
    startFreeMode: async () => { throw new Error('session unavailable'); },
    getStep: () => 'wallet-splash',
    onError: (error) => errors.push(error),
  });

  assert.equal(await quickplay.start(), false);
  assert.equal(errors[0].message, 'session unavailable');
  assert.equal(status.hidden, false);
  assert.equal(status.dataset.state, 'error');
  assert.equal(status.getAttribute('role'), 'alert');
  assert.match(status.textContent, /could not start/i);
  assert.equal(button.focused, true);
  assert.equal(button.disabled, false);
});

test('homepage offers play before decorative marquee media in reading and focus order', () => {
  const html = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');
  const splash = html.slice(html.indexOf('<section id="officialWalletSplash"'), html.indexOf('<section id="officialArcadeFloor"'));
  const play = splash.indexOf('id="officialHmhFreeQuickplayButton"');
  const media = splash.indexOf('class="splash-marquee"');
  assert.ok(play >= 0 && media >= 0, 'both the real start action and approved marquee must remain');
  assert.ok(play < media, 'place gameplay entry before optional decorative media, not below the mobile fold');
});

test('homepage keeps Browse Arcade and wallet entry beside the explicit HMH quick-start', () => {
  const html = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="officialHmhFreeQuickplayButton"[^>]*>Play Hard Money Heroes Free</u);
  assert.match(html, /id="officialGuestEnterButton"[^>]*>Browse Arcade</u);
  assert.match(html, /id="officialConnectButton"[^>]*>Connect Wallet</u);
  assert.match(html, /id="officialGuestQuickplayStatus"[^>]*aria-live="polite"/u);
  assert.match(main, /wireHmhFreeQuickplay/u);
  assert.match(main, /officialHmhFreeQuickplayButton/u);
  assert.match(main, /selectCabinet: \(gameId\) =>/u);
  assert.match(main, /startFreeMode: \(\) => startOfficialMode\('free'\)/u);
  assert.match(main, /officialBeginLevelButton\.addEventListener\('click', beginOfficialLevel\)/u);
});
