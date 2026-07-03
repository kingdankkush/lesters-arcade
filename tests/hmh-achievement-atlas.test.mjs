import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { ACHIEVEMENT_LIST, buildPlayerArcadeSnapshot, createInitialArcadeState } from '../apps/portal/src/arcade-core.mjs';
import {
  HMH_ACHIEVEMENT_ATLAS,
  achievementBadgeAssetById,
  achievementTierAssetById,
  achievementUnlockTypeAssetById,
} from '../apps/portal/assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

function repoText(relativePath) {
  return readFileSync(repoPath(relativePath), 'utf8');
}

const REQUIRED_TIERS = Object.freeze(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic']);
const REQUIRED_UNLOCK_TYPES = Object.freeze([...new Set(ACHIEVEMENT_LIST.map((achievement) => achievement.unlockType))].sort());
const GENERATED_LEVEL2_IDS = Object.freeze([
  'l2-survive-5min',
  'l2-bridge-exploiter',
  'l2-whale-slayer',
  'l2-obfuscator',
  'l2-51-percent',
  'l2-ngmi',
  'l2-no-damage-ngmi',
]);

test('achievement atlas covers every runtime achievement plus tier and unlock-type language', () => {
  assert.equal(HMH_ACHIEVEMENT_ATLAS.id, 'hmh-achievement-atlas-v1');
  assert.match(HMH_ACHIEVEMENT_ATLAS.sourcePolicy, /Original repo-owned/i);
  assert.equal(HMH_ACHIEVEMENT_ATLAS.achievementCount, ACHIEVEMENT_LIST.length);
  assert.deepEqual(Object.keys(HMH_ACHIEVEMENT_ATLAS.tiersById).sort(), [...REQUIRED_TIERS].sort());
  assert.deepEqual(Object.keys(HMH_ACHIEVEMENT_ATLAS.unlockTypesById).sort(), REQUIRED_UNLOCK_TYPES);

  for (const tier of REQUIRED_TIERS) {
    const asset = achievementTierAssetById(tier);
    assert.ok(asset, `${tier} tier style asset exists`);
    assert.equal(asset.width, 64);
    assert.equal(asset.height, 64);
    assert.equal(existsSync(repoPath(asset.src.replace('./', 'apps/portal/'))), true, `${tier} tier icon exists on disk`);
  }

  for (const unlockType of REQUIRED_UNLOCK_TYPES) {
    const asset = achievementUnlockTypeAssetById(unlockType);
    assert.ok(asset, `${unlockType} unlock-type motif exists`);
    assert.equal(asset.width, 48);
    assert.equal(asset.height, 48);
    assert.equal(existsSync(repoPath(asset.src.replace('./', 'apps/portal/'))), true, `${unlockType} motif exists on disk`);
  }

  for (const achievement of ACHIEVEMENT_LIST) {
    const asset = achievementBadgeAssetById(achievement.id);
    assert.ok(asset, `${achievement.id} badge asset exists`);
    assert.equal(asset.runtimeId, achievement.id);
    assert.equal(asset.tier, achievement.tier);
    assert.equal(asset.unlockType, achievement.unlockType);
    assert.ok(asset.src.endsWith(`${achievement.id}.png`) || asset.src.includes(`/achievement-${achievement.id}.png`));
    assert.equal(existsSync(repoPath(asset.src.replace('./', 'apps/portal/'))), true, `${achievement.id} unlocked badge exists on disk`);
    assert.equal(existsSync(repoPath(asset.lockedSrc.replace('./', 'apps/portal/'))), true, `${achievement.id} locked badge exists on disk`);
  }
});

test('achievement atlas supplies generated Level 2 badges that were missing from the older expanded pack', () => {
  for (const id of GENERATED_LEVEL2_IDS) {
    const asset = achievementBadgeAssetById(id);
    assert.ok(asset, `${id} generated atlas entry exists`);
    assert.equal(asset.generatedByAtlas, true);
    assert.match(asset.src, /hmh-achievement-atlas\/achievement-/);
    assert.match(asset.lockedSrc, /hmh-achievement-atlas\/locked-achievement-/);
  }
});

test('achievement snapshot and profile UI consume manifest-backed badge image sources', () => {
  const state = createInitialArcadeState();
  const wallet = '0x1234567890abcdef1234567890abcdef12345678';
  const profile = state.profiles[wallet] ?? (state.profiles[wallet] = {
    wallet,
    handle: 'TestHero',
    displayName: 'TestHero',
    joinedAt: '2026-01-01T00:00:00.000Z',
    achievements: ['cabinet-pioneer'],
    totalPaidRuns: 1,
    totalFreeRuns: 0,
    unlocks: { characters: {} },
    preferences: {},
    avatar: null,
    rank: 1,
    xp: 0,
  });
  profile.achievements = ['cabinet-pioneer'];
  const snapshot = buildPlayerArcadeSnapshot(state, wallet);
  const unlocked = snapshot.achievements.find((achievement) => achievement.id === 'cabinet-pioneer');
  const locked = snapshot.achievements.find((achievement) => achievement.id === 'l2-ngmi');
  assert.match(unlocked.iconSrc, /achievement-badges\/cabinet-pioneer\.png|hmh-achievement-atlas\/achievement-cabinet-pioneer\.png/);
  assert.match(locked.iconSrc, /locked-achievement-l2-ngmi\.png/);

  const main = repoText('apps/portal/main.js');
  assert.equal(main.includes('renderAchievementIcon'), true, 'main.js should render badge images via a helper');
  assert.equal(main.includes("el('img'"), true, 'achievement helper should create img nodes');
  assert.equal(main.includes('a.iconSrc'), true, 'achievement grid should consume model iconSrc');
  assert.equal(main.includes("appendText(badge, 'span', a.unlocked ? (a.icon ?? '🏅') : '🔒', 'achievement-icon')"), false, 'achievement grid should not be emoji-only');
});

test('achievement atlas generator and tests are wired into project gates', () => {
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(packageJson.includes('assets:hmh:achievement-atlas'), true);
  assert.equal(syntaxCheck.includes('scripts/generate-hmh-achievement-atlas.py'), true);
  assert.equal(syntaxCheck.includes('apps/portal/assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-achievement-atlas.test.mjs'), true);
});
