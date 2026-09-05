import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  activeCarouselIndex,
  compareHeroStats,
  formatStatDelta,
  nextHeroIndex,
  referenceHeroId,
  restFrameIndex,
} from '../apps/portal/src/hmh-hero-select-ui.mjs';
import { HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES } from '../apps/portal/src/hmh-character-config.mjs';
import { createOfficialPlayRoutes } from '../apps/portal/src/routes/official-play-routes.mjs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const SPIN_ORDER = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];

function rosterEntries(selectedId = 'lit-commando', locked = ['lester-original', 'lilly']) {
  return Object.values(HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES).map((identity) => ({
    id: identity.id,
    legacyId: identity.id,
    name: identity.name,
    tagline: `${identity.name} tagline`,
    bio: `${identity.name} bio`,
    startingWeaponId: 'coin-blaster',
    passive: { title: 'Passive', description: `${identity.name} passive` },
    cta: 'SELECT',
    stats: identity.stats,
    locked: locked.includes(identity.id),
    selected: identity.id === selectedId,
  }));
}

test('compareHeroStats reports per-stat deltas against the reference hero and marks the roster best', () => {
  const comparison = compareHeroStats(rosterEntries(), 'lit-commando');
  assert.deepEqual(comparison.map((hero) => hero.id), ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']);
  const byId = Object.fromEntries(comparison.map((hero) => [hero.id, hero]));
  assert.equal(byId['lit-commando'].isReference, true);
  assert.equal(byId['lit-valkyrie'].isReference, false);

  const stat = (heroId, label) => byId[heroId].stats.find((entry) => entry.label === label);
  assert.deepEqual(stat('lit-commando', 'Power'), { label: 'Power', value: 5, referenceValue: 5, delta: 0, best: true, tie: false });
  assert.deepEqual(stat('lit-valkyrie', 'Power'), { label: 'Power', value: 4, referenceValue: 5, delta: -1, best: false, tie: false });
  assert.deepEqual(stat('lit-valkyrie', 'Speed'), { label: 'Speed', value: 5, referenceValue: 3, delta: 2, best: true, tie: false });
  assert.deepEqual(stat('lester-original', 'Power'), { label: 'Power', value: 3, referenceValue: 5, delta: -2, best: false, tie: false });
  assert.deepEqual(stat('lilly', 'Luck'), { label: 'Luck', value: 4, referenceValue: 3, delta: 1, best: false, tie: false });
  assert.equal(stat('lit-valkyrie', 'Luck').best, true);
  assert.equal(stat('lit-commando', 'Armor').best, true);
  // Every stat has exactly one best hero in the shipped roster.
  for (const label of ['Power', 'Speed', 'Armor', 'Luck']) {
    assert.equal(comparison.filter((hero) => hero.stats.find((entry) => entry.label === label).best).length, 1, label);
  }
});

test('compareHeroStats shares best across ties, tolerates missing stats, and falls back when the reference is absent', () => {
  const entries = [
    { id: 'a', stats: [['Power', 4], ['Speed', 2]], selected: false, locked: false },
    { id: 'b', stats: [['Power', 4], ['Speed', 5]], selected: true, locked: false },
    { id: 'c', stats: {}, selected: false, locked: true },
  ];
  const comparison = compareHeroStats(entries, 'b');
  const power = (id) => comparison.find((hero) => hero.id === id).stats.find((entry) => entry.label === 'Power');
  assert.deepEqual(power('a'), { label: 'Power', value: 4, referenceValue: 4, delta: 0, best: true, tie: true });
  assert.deepEqual(power('b'), { label: 'Power', value: 4, referenceValue: 4, delta: 0, best: true, tie: true });
  assert.deepEqual(comparison.find((hero) => hero.id === 'c').stats, []);
  // Unknown reference: compare against the first entry, still pure.
  const fallback = compareHeroStats(entries, 'missing');
  assert.equal(fallback[0].isReference, true);
  assert.deepEqual(compareHeroStats([], 'b'), []);
  assert.deepEqual(compareHeroStats(null, 'b'), []);
});

test('referenceHeroId prefers the selected hero, then the first unlocked, then the first card', () => {
  assert.equal(referenceHeroId(rosterEntries('lilly', [])), 'lilly');
  assert.equal(referenceHeroId(rosterEntries(null, ['lit-commando'])), 'lit-valkyrie');
  assert.equal(referenceHeroId(rosterEntries(null, ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly'])), 'lit-commando');
  assert.equal(referenceHeroId([]), null);
});

test('formatStatDelta uses a signed compact label with a typographic minus', () => {
  assert.equal(formatStatDelta(2), '+2');
  assert.equal(formatStatDelta(-1), '−1');
  assert.equal(formatStatDelta(0), '=');
  assert.equal(formatStatDelta(Number.NaN), '=');
});

test('nextHeroIndex wraps arrow keys, jumps with Home/End, skips locked cards, and ignores other keys', () => {
  assert.equal(nextHeroIndex(0, 'ArrowRight', 4), 1);
  assert.equal(nextHeroIndex(3, 'ArrowRight', 4), 0);
  assert.equal(nextHeroIndex(0, 'ArrowLeft', 4), 3);
  assert.equal(nextHeroIndex(2, 'Home', 4), 0);
  assert.equal(nextHeroIndex(1, 'End', 4), 3);
  assert.equal(nextHeroIndex(1, 'ArrowRight', 4, { locked: [2, 3] }), 0);
  assert.equal(nextHeroIndex(0, 'ArrowLeft', 4, { locked: [2, 3] }), 1);
  assert.equal(nextHeroIndex(0, 'End', 4, { locked: [3] }), 2);
  assert.equal(nextHeroIndex(3, 'Home', 4, { locked: [0] }), 1);
  assert.equal(nextHeroIndex(0, 'ArrowRight', 4, { locked: [0, 1, 2, 3] }), null);
  assert.equal(nextHeroIndex(-1, 'ArrowRight', 4), 0, 'no focused card: ArrowRight lands on the first unlocked card');
  assert.equal(nextHeroIndex(-1, 'ArrowLeft', 4), 3, 'no focused card: ArrowLeft lands on the last unlocked card');
  assert.equal(nextHeroIndex(0, 'Enter', 4), null);
  assert.equal(nextHeroIndex(0, 'ArrowDown', 4), null);
  assert.equal(nextHeroIndex(0, 'ArrowRight', 0), null);
});

test('activeCarouselIndex picks the card whose centre is nearest the visible centre from real offsets', () => {
  const cards = [0, 354, 708, 1062].map((offsetLeft) => ({ offsetLeft, width: 340 }));
  assert.equal(activeCarouselIndex({ scrollLeft: 0, clientWidth: 390, cards }), 0);
  assert.equal(activeCarouselIndex({ scrollLeft: 340, clientWidth: 390, cards }), 1);
  assert.equal(activeCarouselIndex({ scrollLeft: 700, clientWidth: 390, cards }), 2);
  assert.equal(activeCarouselIndex({ scrollLeft: 5000, clientWidth: 390, cards }), 3);
  assert.equal(activeCarouselIndex({ scrollLeft: 0, clientWidth: 390, cards: [] }), 0);
  assert.equal(activeCarouselIndex({ scrollLeft: Number.NaN, clientWidth: 390, cards }), 0);
});

test('restFrameIndex resolves the south rest frame inside the spin order', () => {
  assert.equal(restFrameIndex(SPIN_ORDER, 'south'), 6);
  assert.equal(restFrameIndex(SPIN_ORDER), 6);
  assert.equal(restFrameIndex(SPIN_ORDER, 'nowhere'), 0);
  assert.equal(restFrameIndex([], 'south'), 0);
});

function fakeNode(tag = 'div', props = {}) {
  const classes = new Set(String(props.className ?? '').split(/\s+/u).filter(Boolean));
  return {
    tag, children: [], dataset: {}, listeners: {}, style: {}, attrs: {}, hidden: false, disabled: false,
    ...props,
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
      contains: (value) => classes.has(value),
      toggle: (value, force) => { if (force) classes.add(value); else classes.delete(value); },
    },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    getAttribute(name) { return this.attrs[name] ?? null; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    focus() { this.focused = true; },
    scrollIntoView() { this.scrolled = true; },
  };
}

test('character select renders comparison chips, identity attributes, and arrow-key roving focus', () => {
  const roster = fakeNode('roster');
  const dom = { officialCharacterSelect: fakeNode('section'), officialCharacterRoster: roster };
  const combat = { characterId: 'lit-commando' };
  const views = [];
  const rows = [];
  const routes = createOfficialPlayRoutes({
    dom,
    getContext: () => ({ connectedWallet: null, state: { profiles: {} }, combat }),
    appendText: (parent, tag, text, className = '') => parent.append(fakeNode(tag, { textContent: text, className })),
    applyHardMoneyHeroScreenBackground: () => {},
    buildCharacterSelectEntries: () => rosterEntries('lit-commando', ['lilly']),
    el: (tag, props = {}) => fakeNode(tag, props),
    HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG: {}, HERO_ROSTER_BASE: [],
    heroRotationSprite: () => null,
    persistArcadeStateSoon: () => {}, playSfxCue: () => {},
    renderArcadeIcon: () => fakeNode('icon'),
    renderHeroStatBars: (container, stats, decorateRow) => {
      for (const [label, value] of stats) {
        const row = fakeNode('div', { className: 'hero-stat-row' });
        container.append(row);
        rows.push(row);
        decorateRow?.(row, label, value);
      }
    },
    renderRotatingCabinetSprite: () => fakeNode('sprite'),
    resolveSelectedCharacterId: () => 'lit-commando',
    setPreferredCharacter: () => {},
    setView: (view) => views.push(view),
    weaponById: () => ({ title: 'Coin Blaster' }),
  });

  routes.renderCharacterSelect();
  const cards = roster.children;
  assert.equal(cards.length, 4);
  assert.deepEqual(cards.map((card) => card.dataset.characterId), ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']);
  assert.deepEqual(cards.map((card) => card.attrs['aria-pressed']), ['true', 'false', 'false', 'false']);
  assert.equal(roster.attrs.role, 'group');
  assert.equal(cards[0].dataset.compareRole, 'reference');
  assert.equal(cards[1].dataset.compareRole, 'challenger');

  const chips = rows.flatMap((row) => row.children.filter((child) => child.classList.contains('hero-stat-delta')));
  assert.equal(chips.length, 16, 'one comparison chip per stat per card');
  assert.ok(rows.every((row) => row.classList.contains('has-delta')));
  const valkyrieSpeed = rows[5];
  const valkyrieSpeedChip = valkyrieSpeed.children.find((child) => child.classList.contains('hero-stat-delta'));
  assert.equal(valkyrieSpeedChip.textContent, '+2');
  assert.equal(valkyrieSpeedChip.dataset.trend, 'up');
  assert.equal(valkyrieSpeedChip.dataset.best, 'true');
  const commandoPowerChip = rows[0].children.find((child) => child.classList.contains('hero-stat-delta'));
  assert.equal(commandoPowerChip.textContent, '5/5');
  assert.equal(commandoPowerChip.dataset.best, 'true');
  const lesterPowerChip = rows[8].children.find((child) => child.classList.contains('hero-stat-delta'));
  assert.equal(lesterPowerChip.textContent, '−2');
  assert.equal(lesterPowerChip.dataset.trend, 'down');

  // Roving focus: ArrowRight from the first card lands on the second; locked lilly is skipped from lester.
  const keydown = roster.listeners.keydown;
  assert.equal(typeof keydown, 'function');
  let prevented = 0;
  keydown({ key: 'ArrowRight', target: cards[0], preventDefault: () => { prevented += 1; } });
  assert.equal(cards[1].focused, true);
  assert.equal(cards[1].scrolled, true);
  keydown({ key: 'ArrowRight', target: cards[2], preventDefault: () => { prevented += 1; } });
  assert.equal(cards[0].focused, true, 'ArrowRight from lester wraps past locked lilly to the first card');
  keydown({ key: 'End', target: cards[0], preventDefault: () => { prevented += 1; } });
  assert.equal(cards[2].focused, true, 'End lands on the last unlocked card');
  keydown({ key: 'Enter', target: cards[0], preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 3, 'Enter is left to the native button activation');
  assert.deepEqual(views, []);
});

test('select-screen stylesheets carry the reduced-motion guard, crisp rotator sampling, dots, and delta chips', () => {
  const styles = read('apps/portal/styles.css');
  const polish = read('apps/portal/styles-arcade-polish.css');
  const rotatorRule = styles.match(/\.hero-character-rotator \.cabinet-rotation-frame \{[^}]*\}/u)?.[0] ?? '';
  assert.match(rotatorRule, /image-rendering: auto/u);
  assert.doesNotMatch(rotatorRule, /pixelated/u, 'a 384 px source must be resampled smoothly, not pixelated');
  const reducedBlocks = [...styles.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/gu)].map((match) => match[1]);
  const rotatorGuard = reducedBlocks.find((block) => block.includes('.hmh-cabinet-rotator'));
  assert.ok(rotatorGuard, 'styles.css needs a prefers-reduced-motion block for the rotator');
  assert.match(rotatorGuard, /\.cabinet-rotation-frame\[data-rest-frame="true"\]/u);
  assert.match(rotatorGuard, /animation: none/u);
  assert.match(polish, /\.hero-carousel-dots/u);
  assert.match(polish, /\.hero-stat-delta/u);
  assert.match(polish, /\.hero-stat-row\.has-delta/u);
  const polishReduced = [...polish.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/gu)].map((match) => match[1]);
  assert.ok(polishReduced.some((block) => block.includes('.hero-card.active:hover')), 'hover lift must be stilled under reduced motion');
  const main = read('apps/portal/main.js');
  assert.match(main, /restFrameIndex/u);
  assert.match(main, /dataset\.restFrame = 'true'/u);
  assert.doesNotMatch(main, /displayScale: 1\.28/u, 'the 160 px selector upscale is retired');
  const routes = read('apps/portal/src/routes/official-play-routes.mjs');
  assert.match(routes, /hmh-hero-select-ui\.mjs/u);
  assert.match(routes, /hero-carousel-dots/u);
  assert.match(routes, /activeCarouselIndex/u);
});
