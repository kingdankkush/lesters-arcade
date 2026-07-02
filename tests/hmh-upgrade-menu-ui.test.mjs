import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildUpgradeMenuPresentation, upgradeCategoryStyle } from '../apps/portal/src/hmh-upgrade-menu-ui.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const SAMPLE_CHOICES = Object.freeze([
  Object.freeze({ id: 'damage', title: 'Damage', category: 'offense', currentLevel: 1, nextLevel: 2, maxLevel: 5, perLevelPercent: 8, description: 'Bullets hit harder.' }),
  Object.freeze({ id: 'shield', title: 'Cold Wallet Shield', category: 'defense', currentLevel: 0, nextLevel: 1, maxLevel: 4, perLevelPercent: 10, description: 'More survivability.' }),
  Object.freeze({ id: 'hash-rail-rate', title: 'Hash Rail Rate', category: 'weapon', currentLevel: 2, nextLevel: 3, maxLevel: 3, perLevelPercent: 12, description: 'Weapon branch upgrade.', weaponId: 'hash-rail' }),
]);

test('WO-40 upgrade menu presentation builds readable cards with category, rank, and reroll metadata', () => {
  const model = buildUpgradeMenuPresentation({ choices: SAMPLE_CHOICES, rerollsRemaining: 2, colorblindTags: true });

  assert.equal(model.version, 'wo-40-upgrade-menu-ui-v1');
  assert.equal(model.title, 'Choose One Augment');
  assert.equal(model.cards.length, 3);
  assert.equal(model.reroll.enabled, true);
  assert.equal(model.reroll.label, 'Reroll (2)');
  assert.equal(model.cards[0].category.label, 'Offense');
  assert.equal(model.cards[0].category.colorblindTag, 'TONE RED');
  assert.deepEqual(model.cards[0].rankPips.map((pip) => pip.state), ['filled', 'next', 'empty', 'empty', 'empty']);
  assert.equal(model.cards[2].branchLabel, 'Weapon Branch');
  assert.equal(model.cards[2].completionLabel, 'MAX THIS PICK');
});

test('WO-40 upgrade category style covers all live card categories with text-safe fallbacks', () => {
  for (const category of ['offense', 'defense', 'mobility', 'utility', 'economy', 'control', 'throwable', 'status', 'weapon', 'unknown']) {
    const style = upgradeCategoryStyle(category);
    assert.ok(style.icon.length > 0, `${category} icon`);
    assert.ok(style.tone.length > 0, `${category} tone`);
    assert.ok(style.label.length > 0, `${category} label`);
  }
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
  assert.equal(model.shell.layout, 'focused-card-stack');
  assert.ok(model.shell.accessibility.includes('44px'));
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
  assert.equal(css.includes('.level-up-shell'), true);
  assert.equal(css.includes('.upgrade-card-meter'), true);
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-upgrade-menu-ui.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-upgrade-menu-ui.test.mjs'), true);
});
