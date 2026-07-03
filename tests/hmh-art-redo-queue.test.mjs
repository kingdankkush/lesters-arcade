import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ACHIEVEMENT_LIST, LESTER_BLASTER_POWER_UPS } from '../apps/portal/src/arcade-core.mjs';
import { HMH_FINAL_COMBAT_VFX_PACK } from '../apps/portal/assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs';
import { buildArtRedoQueue, renderArtRedoQueueMarkdown } from '../scripts/art-redo-queue.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-20 redo queue covers pickups, achievements, VFX, and UI chrome', () => {
  const queue = buildArtRedoQueue();
  const categoryIds = queue.categories.map((category) => category.id);

  assert.equal(queue.version, 'wo-20-pickups-achievements-vfx-ui-redo-v1');
  assert.deepEqual(categoryIds, ['pickups', 'achievements', 'vfx', 'ui-chrome']);
  for (const category of queue.categories) {
    assert.ok(category.items.length > 0, `${category.id} has queue items`);
    assert.ok(category.items.every((item) => item.priority && item.sourcePolicy && item.acceptance.length >= 2), `${category.id} items are actionable`);
  }
});

test('WO-20 pickup queue includes every runtime power-up with rarity and action', () => {
  const queue = buildArtRedoQueue();
  const pickupCategory = queue.categories.find((category) => category.id === 'pickups');
  const pickupIds = new Set(pickupCategory.items.map((item) => item.runtimeId));

  assert.equal(pickupCategory.items.length, LESTER_BLASTER_POWER_UPS.length);
  for (const powerUp of LESTER_BLASTER_POWER_UPS) {
    assert.equal(pickupIds.has(powerUp.id), true, `${powerUp.id} is queued`);
  }
  assert.ok(pickupCategory.items.some((item) => item.rarity === 'super-rare'));
  assert.equal(pickupCategory.coverage.manifestId, 'hmh-pickup-icons-p0-v1');
  const p0Pickups = pickupCategory.items.filter((item) => item.priority === 'P0');
  assert.equal(p0Pickups.length, 5);
  assert.equal(p0Pickups.every((item) => item.status === 'manifest-backed-runtime-icon'), true, 'P0 pickup icons should now be manifest-backed');
  assert.equal(p0Pickups.every((item) => item.iconSrc?.includes('hmh-pickup-icons')), true);
});

test('WO-20 achievement and VFX queues are tied to runtime definitions and final VFX manifest', () => {
  const queue = buildArtRedoQueue();
  const achievements = queue.categories.find((category) => category.id === 'achievements');
  const vfx = queue.categories.find((category) => category.id === 'vfx');

  assert.equal(achievements.coverage.runtimeAchievementCount, ACHIEVEMENT_LIST.length);
  assert.equal(achievements.coverage.tiers.includes('mythic'), true);
  assert.ok(achievements.items.some((item) => /badge atlas/i.test(item.title)));
  assert.equal(vfx.coverage.manifestAssetCount, HMH_FINAL_COMBAT_VFX_PACK.assetCount);
  assert.ok(vfx.items.some((item) => item.runtimeId === 'coin-pickup-pop'));
  assert.ok(vfx.items.some((item) => /missing/i.test(item.status)));
});

test('WO-20 markdown and scripts are wired into verification', () => {
  const queue = buildArtRedoQueue();
  const markdown = renderArtRedoQueueMarkdown(queue);
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.match(markdown, /# Hard Money Heroes Art Redo Queue/i);
  assert.match(markdown, /UI chrome/i);
  assert.equal(packageJson.includes('design:art-redo'), true);
  assert.equal(packageJson.includes('design:art-redo'), true);
  assert.equal(syntaxCheck.includes('scripts/art-redo-queue.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-art-redo-queue.test.mjs'), true);
});
