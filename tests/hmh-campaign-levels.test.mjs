import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HMH_CAMPAIGN_LEVELS,
  HMH_LEVEL_ONE_WASTELAND_ENEMIES,
  HMH_LEVEL_ONE_WASTELAND_MACRO_LAYOUT,
  HMH_LEVEL_ONE_WASTELAND_POIS,
  getInitialHmhCampaignLevelId,
  getHmhCampaignLevel,
  getNextHmhCampaignLevel,
  formatHmhCampaignLevelBanner,
  buildHmhCampaignObjectiveState,
  buildHmhExtractionGuidance,
} from '../apps/portal/src/hmh-campaign-levels.mjs';

test('campaign levels expose authored Level 1 to Level 3 roadmap metadata', () => {
  assert.equal(HMH_CAMPAIGN_LEVELS.length >= 3, true);
  assert.equal(getInitialHmhCampaignLevelId(), 'level-1-crypto-wasteland');
  assert.equal(getHmhCampaignLevel().shortTitle, 'Crypto Wasteland');
  assert.equal(getNextHmhCampaignLevel('level-1-crypto-wasteland')?.id, 'level-2-litecoin-city');
  assert.equal(getNextHmhCampaignLevel('level-2-litecoin-city')?.id, 'level-3-the-getaway');
  assert.equal(getNextHmhCampaignLevel('level-3-the-getaway'), null);
  assert.equal(formatHmhCampaignLevelBanner('level-2-litecoin-city'), 'Level 2 — Litecoin City');
  assert.equal(formatHmhCampaignLevelBanner('level-3-the-getaway'), 'Level 3 — The Getaway');
});

test('level 1 metadata locks the authored macro model and canon reconciliation', () => {
  const level = getHmhCampaignLevel('level-1-crypto-wasteland');
  assert.equal(level.hybridModel.macro, 'authored district graph with fixed main spine, hubs, rivers, and optional POI spurs');
  assert.equal(level.hybridModel.confirmedBy, 'Justin brief on 2026-06-19');
  assert.equal(level.canonReconciliation.oldLevelOneTitle, 'The Slums / Underchain District');
  assert.equal(level.canonReconciliation.newLevelOneTitle, 'Crypto Wasteland');
  assert.equal(level.canonReconciliation.codeWatchlist.includes('arcade-core Level 1 display copy'), true);
  assert.deepEqual(HMH_LEVEL_ONE_WASTELAND_MACRO_LAYOUT.mainSpine, ['desert-approach', 'ghost-town', 'country-road', 'residential-edge', 'inner-city-threshold']);
  assert.equal(HMH_LEVEL_ONE_WASTELAND_MACRO_LAYOUT.citySeam.destinationLevelId, 'level-2-litecoin-city');
});

test('level 1 POIs define telegraphed optional risk-reward arenas', () => {
  assert.equal(HMH_LEVEL_ONE_WASTELAND_POIS.length >= 6, true);
  const crossroads = HMH_LEVEL_ONE_WASTELAND_POIS.find((poi) => poi.id === 'crossroads-trading-post');
  const rugpull = HMH_LEVEL_ONE_WASTELAND_POIS.find((poi) => poi.id === 'rugpull-gulch');
  assert.ok(crossroads);
  assert.ok(rugpull);
  assert.equal(crossroads.lane, 'south-spur');
  assert.match(crossroads.reward.type, /reroll-economy/i);
  assert.match(rugpull.telegraph, /water tower/i);
  assert.equal(rugpull.miniBoss.phases, 2);
  assert.equal(rugpull.miniBoss.telegraphFrames >= 24, true);
});

test('level 1 enemy roster covers new wasteland archetypes with readable telegraphs', () => {
  assert.equal(HMH_LEVEL_ONE_WASTELAND_ENEMIES.length >= 8, true);
  const roles = new Set(HMH_LEVEL_ONE_WASTELAND_ENEMIES.map((enemy) => enemy.role));
  assert.equal(roles.has('melee-pack-animal'), true);
  assert.equal(roles.has('ranged-human'), true);
  assert.equal(roles.has('charger-animal'), true);
  assert.equal(roles.has('flyer-animal'), true);
  assert.equal(roles.has('ambusher-animal'), true);
  assert.equal(roles.has('elite-human'), true);
  assert.equal(roles.has('contextual-grunt'), true);
  HMH_LEVEL_ONE_WASTELAND_ENEMIES.forEach((enemy) => {
    assert.equal(enemy.telegraphFrames >= 24, true, `${enemy.id} should meet minimum telegraph frames`);
    assert.equal(typeof enemy.counterplay, 'string');
    assert.equal(enemy.counterplay.length > 20, true);
  });
});

test('level 1 objective phases progress from survive to optional detour to boss to extraction to clear', () => {
  const preBoss = buildHmhCampaignObjectiveState({ levelId: 'level-1-crypto-wasteland', elapsedSeconds: 120 });
  assert.equal(preBoss.phase, 'survive');
  assert.match(preBoss.detail, /road network/i);

  const detour = buildHmhCampaignObjectiveState({
    levelId: 'level-1-crypto-wasteland',
    elapsedSeconds: 140,
    activePoi: {
      title: 'Rugpull Gulch',
      rewardType: 'weapon-or-shield',
      telegraph: 'water tower visible off the main road',
    },
  });
  assert.equal(detour.phase, 'detour');
  assert.match(detour.label, /Rugpull Gulch/i);
  assert.match(detour.detail, /weapon-or-shield/i);

  const boss = buildHmhCampaignObjectiveState({ levelId: 'level-1-crypto-wasteland', elapsedSeconds: 320, bossTriggered: true });
  assert.equal(boss.phase, 'boss');
  assert.match(boss.label, /Rug Pull Baron/i);

  const extract = buildHmhCampaignObjectiveState({ levelId: 'level-1-crypto-wasteland', elapsedSeconds: 500, extractionSpawned: true });
  assert.equal(extract.phase, 'extract');
  assert.equal(extract.shortLabel, 'EXTRACT');

  const clear = buildHmhCampaignObjectiveState({ levelId: 'level-1-crypto-wasteland', cleared: true, nextLevelId: 'level-2-litecoin-city' });
  assert.equal(clear.phase, 'cleared');
  assert.match(clear.detail, /Litecoin City/);
});

test('extraction guidance reports heading and distance in tiles', () => {
  const guidance = buildHmhExtractionGuidance({ playerX: 0, playerY: 0, targetX: 3, targetY: -3 });
  assert.equal(guidance.heading, 'NE');
  assert.equal(guidance.distanceTiles, 4.2);
  assert.equal(guidance.label, 'NE · 4.2t');
});

test('level 3 objective state reflects the discrete getaway finale', () => {
  const advance = buildHmhCampaignObjectiveState({ levelId: 'level-3-the-getaway', elapsedSeconds: 120 });
  const boss = buildHmhCampaignObjectiveState({ levelId: 'level-3-the-getaway', elapsedSeconds: 320, bossTriggered: true });
  const extract = buildHmhCampaignObjectiveState({ levelId: 'level-3-the-getaway', elapsedSeconds: 500, extractionSpawned: true });

  assert.equal(advance.shortLabel, 'GETAWAY');
  assert.match(advance.detail, /Mainnet Express/i);
  assert.equal(boss.shortLabel, 'FINALE BOSS');
  assert.equal(extract.shortLabel, 'ESCAPE');
});
