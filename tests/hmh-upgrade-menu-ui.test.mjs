import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildLevelUpInteractionGate,
  buildLevelUpViewportLayout,
  buildUpgradeMenuPresentation,
  canActivateLevelUpChoice,
  isLevelUpInteractionReady,
  upgradeCategoryStyle,
} from '../apps/portal/src/hmh-upgrade-menu-ui.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const SAMPLE_CHOICES = Object.freeze([
  Object.freeze({ id: 'damage', title: 'Damage', category: 'offense', currentLevel: 1, nextLevel: 2, maxLevel: 5, perLevelPercent: 8, description: 'Bullets hit harder.' }),
  Object.freeze({ id: 'shield', title: 'Cold Wallet Shield', category: 'defense', currentLevel: 0, nextLevel: 1, maxLevel: 4, perLevelPercent: 10, description: 'More survivability.' }),
  Object.freeze({ id: 'hash-rail-rate', title: 'Hash Rail Rate', category: 'weapon', currentLevel: 2, nextLevel: 3, maxLevel: 3, perLevelPercent: 12, description: 'Weapon branch upgrade.', weaponId: 'hash-rail' }),
]);

test('WO-73 upgrade menu presentation labels the two-card continuation/new draft', () => {
  const model = buildUpgradeMenuPresentation({
    choices: [
      { ...SAMPLE_CHOICES[0], slotRole: 'continuation', slotLabel: 'CONTINUE YOUR BUILD' },
      { ...SAMPLE_CHOICES[1], slotRole: 'new', slotLabel: 'NEW TREE' },
    ],
    rerollsRemaining: 2,
    colorblindTags: true,
  });

  assert.equal(model.version, 'tactical-upgrade-draft-v4');
  assert.equal(model.title, 'Choose Your Edge');
  assert.equal(model.instructions, 'Compare the effect, then press 1 or 2.');
  assert.equal(model.cards.length, 2);
  assert.equal(model.shell.layout, 'tactical-two-card-draft');
  assert.equal(model.reroll.enabled, true);
  assert.equal(model.reroll.label, 'Reroll Both (2)');
  assert.equal(model.cards[0].slotLabel, 'CONTINUE YOUR BUILD');
  assert.equal(model.cards[1].slotLabel, 'NEW TREE');
  assert.equal(model.cards[0].category.label, 'Offense');
  assert.equal(model.cards[0].category.colorblindTag, 'TONE RED');
  assert.equal(model.cards[0].tooltip, 'Bullets hit harder.');
  assert.equal(model.cards[0].effectLabel, '+8%');
  assert.equal(model.cards[0].rarityLabel, 'COMMON');
  assert.equal(model.cards[0].decisionLabel, 'STAY COURSE');
  assert.match(model.cards[0].ariaLabel, /Bullets hit harder/);
  assert.deepEqual(model.cards[0].rankPips.map((pip) => pip.state), ['filled', 'next', 'empty', 'empty', 'empty']);
});

test('legacy gameplay categories map to distinct semantic production icons', () => {
  const model = buildUpgradeMenuPresentation({
    choices: [
      { id: 'damage-alpha', title: 'Damage Alpha', category: 'damage' },
      { id: 'max-health', title: 'Cold Storage', category: 'max-hp' },
      { id: 'move-speed', title: 'Street Runner', category: 'movement-speed' },
      { id: 'grenade-capacity', title: 'Nade Pockets', category: 'grenade-capacity' },
    ],
  });
  assert.deepEqual(model.cards.map((card) => card.iconId), ['offense', 'defense', 'mobility', 'throwable']);
  assert.deepEqual(model.cards.map((card) => card.branchLabel), ['Offense', 'Defense', 'Mobility', 'Throwable']);
});

test('WO-40 upgrade category style covers all live card categories with production SVG icon IDs', () => {
  const source = repoText('apps/portal/src/hmh-upgrade-menu-ui.mjs');
  const sprite = repoText('apps/portal/assets/icons/arcade-ui.svg');
  for (const category of ['offense', 'defense', 'mobility', 'utility', 'economy', 'control', 'throwable', 'status', 'weapon', 'unknown']) {
    const style = upgradeCategoryStyle(category);
    assert.ok(style.iconId.length > 0, `${category} icon ID`);
    assert.match(sprite, new RegExp(`id=["']${style.iconId}["']`), `${category} icon exists in sprite`);
    assert.ok(style.tone.length > 0, `${category} tone`);
    assert.ok(style.label.length > 0, `${category} label`);
  }
  assert.doesNotMatch(source, /⚔|🛡|🥾|💎|🌀|💣|🔥|🔫/);
});

test('WO-40 upgrade menu supports locked previews and mobile-safe shell metadata', () => {
  const model = buildUpgradeMenuPresentation({
    choices: SAMPLE_CHOICES.slice(0, 2),
    rerollsRemaining: 0,
    lockedPreviews: [
      { id: 'launcher-rig', title: 'Launcher Rig', gateHint: 'REQUIRES LEVEL 10' },
      { id: 'revive', title: 'Emergency Fork', gateHint: 'REQUIRES LEVEL 20' },
    ],
  });

  assert.equal(model.reroll.enabled, false);
  assert.equal(model.shell.layout, 'tactical-two-card-draft');
  assert.ok(model.shell.accessibility.includes('tooltip/ARIA'));
  assert.equal(model.lockedPreviewRail.length, 2);
  assert.match(model.lockedPreviewRail[0].gateHint, /LEVEL 10/);
});

test('WO-40 runtime, styles, and syntax gate are wired', () => {
  const main = repoText('apps/portal/main.js');
  const css = repoText('apps/portal/styles.css');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(main.includes("./src/hmh-upgrade-menu-ui.mjs"), true);
  assert.equal(main.includes('buildUpgradeMenuPresentation({'), true);
  assert.equal(main.includes('level-up-shell'), true);
  assert.equal(main.includes('level-up-slot-label'), true);
  assert.equal(main.includes('upgrade-card-tooltip'), true);
  assert.equal(main.includes('badge.append(renderArcadeIcon(card.iconId'), true);
  assert.equal(main.includes("appendText(button, 'p', card.description, 'upgrade-card-desc')"), false);
  assert.equal(main.includes('upgrade-locked-preview-rail'), false);
  assert.equal(main.includes("document.addEventListener('lostpointercapture', releaseLevelUpPointer, true)"), true);
  assert.equal(main.includes("if (combat.levelUpPaused) renderLevelUpActionGrid();"), true);
  assert.equal(css.includes('.level-up-shell'), true);
  assert.equal(css.includes('.level-up-slot-label'), true);
  assert.equal(css.includes('.upgrade-card-meter'), true);
  assert.equal(css.includes('.upgrade-card-tooltip'), true);
  assert.equal(css.includes('.pause-console-shell'), true);
  assert.equal(css.includes('.upgrade-card-effect'), true);
  assert.match(css, /\.mode-card span \{[\s\S]*?white-space: normal/);
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-upgrade-menu-ui.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-upgrade-menu-ui.test.mjs'), true);
});

test('active gameplay focus mode removes redundant portal chrome and touch overdraw', () => {
  const css = repoText('apps/portal/styles.css');

  assert.match(css, /html\[data-ingame="true"\] \.official-nav/);
  assert.match(css, /html\[data-ingame="true"\] \.official-footer/);
  assert.match(css, /html\[data-ingame="true"\] \.gameplay-control-bar/);
  assert.match(css, /html\[data-level-up="true"\] \.touch-controls/);
  assert.match(css, /html\[data-touch="true"\] \.level-up-overlay[\s\S]*?backdrop-filter: none/);
});

test('responsive level-up layout fills a portrait viewport without clipping cards', () => {
  const layout = buildLevelUpViewportLayout({
    width: 390,
    height: 844,
    safeAreaTop: 12,
    safeAreaBottom: 24,
    cardCount: 2,
    isTouch: true,
  });

  assert.equal(layout.mode, 'portrait-sheet');
  assert.equal(layout.columns, 1);
  assert.equal(layout.compact, false);
  assert.equal(layout.insetTop, 20);
  assert.equal(layout.insetBottom, 32);
  assert.equal(layout.maxHeight, 792);
  assert.equal(layout.maxWidth, 374);
  assert.equal(layout.cardsScrollable, true);
});

test('responsive level-up layout uses a compact two-column grid in short landscape', () => {
  const layout = buildLevelUpViewportLayout({
    width: 844,
    height: 390,
    safeAreaLeft: 18,
    safeAreaRight: 18,
    cardCount: 2,
    isTouch: true,
  });

  assert.equal(layout.mode, 'landscape-grid');
  assert.equal(layout.columns, 2);
  assert.equal(layout.compact, true);
  assert.equal(layout.maxHeight, 374);
  assert.equal(layout.maxWidth, 792);
  assert.equal(layout.cardsScrollable, true);
});

test('touch tablets use a centered two-column draft instead of a stretched phone sheet', () => {
  const layout = buildLevelUpViewportLayout({
    width: 768,
    height: 1024,
    cardCount: 2,
    isTouch: true,
  });

  assert.equal(layout.mode, 'tablet-grid');
  assert.equal(layout.columns, 2);
  assert.equal(layout.compact, false);
  assert.equal(layout.maxWidth, 752);
  assert.equal(layout.maxHeight, 520);
  assert.equal(layout.insetTop, 252);
});

test('level-up interaction gate waits for shield time and preexisting pointer release', () => {
  const gate = buildLevelUpInteractionGate({
    openedAt: 1_000,
    shieldMs: 420,
    activePointerIds: [7],
  });

  assert.equal(isLevelUpInteractionReady(gate, { now: 1_419, activePointerIds: [] }), false, 'shield still active');
  assert.equal(isLevelUpInteractionReady(gate, { now: 1_500, activePointerIds: [7] }), false, 'held firing pointer still active');
  assert.equal(isLevelUpInteractionReady(gate, { now: 1_500, activePointerIds: [] }), true, 'released after shield');
  assert.equal(canActivateLevelUpChoice(gate, {
    now: 1_500,
    activePointerIds: [],
    interactionStartedAt: 1_419,
  }), false, 'a press started before arming cannot leak into a card');
  assert.equal(canActivateLevelUpChoice(gate, {
    now: 1_500,
    activePointerIds: [],
    interactionStartedAt: 1_450,
  }), true, 'a new intentional press can select');
});
