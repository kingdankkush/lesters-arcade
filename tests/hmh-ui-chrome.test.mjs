import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ACHIEVEMENTS,
  LESTER_BLASTER_HUD_OVERLAY_MODEL,
  buildCombatHudOverlayModel,
} from '../apps/portal/src/arcade-core.mjs';
import { buildUpgradeMenuPresentation } from '../apps/portal/src/hmh-upgrade-menu-ui.mjs';

test('P0 combat HUD exposes manifest-backed arcade chrome metadata on shell and widgets', () => {
  assert.equal(LESTER_BLASTER_HUD_OVERLAY_MODEL.chrome.id, 'combat-hud-frame');
  assert.equal(LESTER_BLASTER_HUD_OVERLAY_MODEL.chrome.priority, 'P0');
  assert.match(LESTER_BLASTER_HUD_OVERLAY_MODEL.chrome.assetPath, /combat-hud-frame/);
  assert.match(LESTER_BLASTER_HUD_OVERLAY_MODEL.chrome.className, /hmh-combat-hud-frame/);

  const hud = buildCombatHudOverlayModel({
    health: 12,
    score: 12345,
    elapsedSeconds: 77,
    grenades: 1,
    powerUpsCollected: 2,
    weaponTitle: 'Hash Rail',
    stageIndex: 4,
    stageCount: 13,
    status: 'SCROLL LOCK // clear Stage 4 engagement',
  });

  assert.equal(hud.chrome.id, 'combat-hud-frame');
  assert.match(hud.className, /hmh-combat-hud-frame/);
  for (const widget of hud.widgets) {
    assert.equal(widget.dataset.uiChrome, 'combat-hud-frame', `${widget.id} should carry the HUD frame chrome id`);
    assert.match(widget.chromeSlot, /^hud-(left|center|right|status)-rail$/, `${widget.id} should name a HUD chrome rail slot`);
  }
  assert.equal(hud.widgetMap.status.chromeSlot, 'hud-status-rail');
});

test('P0 level-up draft cards expose rarity/category chrome instead of generic glow cards', () => {
  const presentation = buildUpgradeMenuPresentation({
    level: 8,
    colorblindTags: true,
    rerollsRemaining: 1,
    choices: [
      {
        id: 'damage-alpha',
        title: 'Hash Damage',
        description: 'Bullets hit harder.',
        category: 'offense',
        rarity: 'rare',
        currentLevel: 2,
        nextLevel: 3,
        maxLevel: 5,
        perLevelPercent: 12,
      },
      {
        id: 'self-custody-regen',
        title: 'Self Custody Regen',
        description: 'Recover between waves.',
        category: 'defense',
        rarity: 'golden',
        currentLevel: 0,
        nextLevel: 1,
        maxLevel: 1,
        presentation: { tone: 'gold', label: 'GOLDEN EVOLUTION', icon: '★' },
      },
    ],
  });

  assert.equal(presentation.shell.chrome.id, 'level-up-card-frame');
  assert.equal(presentation.shell.chrome.priority, 'P0');
  assert.match(presentation.shell.className, /hmh-level-up-card-frame/);
  assert.match(presentation.shell.accessibility, /rarity/i);

  for (const card of presentation.cards) {
    assert.equal(card.chrome.id, 'level-up-card-frame', `${card.id} should use the level-up card frame`);
    assert.match(card.chrome.className, /hmh-upgrade-card-frame/);
    assert.equal(card.dataset.uiChrome, 'level-up-card-frame');
    assert.equal(card.dataset.chromeTone, card.tone);
    assert.ok(card.chrome.rarityLabel.length > 0);
    assert.ok(card.chrome.cornerPips >= 2 && card.chrome.cornerPips <= 4);
  }
  assert.equal(presentation.cards[0].chrome.rarityLabel, 'RARE');
  assert.equal(presentation.cards[1].chrome.rarityLabel, 'GOLDEN EVOLUTION');
});

test('P0 achievement definitions expose toast-frame chrome and runtime CSS selectors', () => {
  const firstBlood = ACHIEVEMENTS.FIRST_BLOOD;
  assert.equal(firstBlood.uiChrome.toastFrameId, 'achievement-toast-frame');
  assert.equal(firstBlood.uiChrome.badgeFrameId, 'achievement-tier-bronze');
  assert.match(firstBlood.uiChrome.toastClassName, /hmh-achievement-toast-frame/);
  assert.match(firstBlood.uiChrome.badgeClassName, /achievement-badge/);
  assert.match(firstBlood.uiChrome.assetPath, /achievement-toast-frame/);

  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');
  for (const selector of [
    '.hmh-combat-hud-frame',
    '.hmh-level-up-card-frame',
    '.hmh-upgrade-card-frame',
    '.hmh-achievement-toast-frame',
  ]) {
    assert.equal(styleSource.includes(selector), true, `${selector} CSS selector should exist`);
  }
});
