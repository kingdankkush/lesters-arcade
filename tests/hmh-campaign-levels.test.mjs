import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HMH_CAMPAIGN_LEVELS,
  HMH_LEVEL_ONE_WASTELAND_ENEMIES,
  HMH_LEVEL_ONE_WASTELAND_MACRO_LAYOUT,
  HMH_LEVEL_ONE_WASTELAND_POIS,
  HMH_LEVEL_TWO_LITECOIN_CITY_POIS,
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
  assert.equal(level.authoredSetpieceSystem.packIds.includes('desert-wash-and-dunes'), true);
  assert.equal(level.authoredSetpieceSystem.packIds.includes('town-mainstreet-lived-in'), true);
  assert.equal(level.authoredLevelGrammar.layers.route.minClearTiles >= 4, true);
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

test('level 2 Litecoin City POIs define hub-and-spoke district arenas with mini-bosses', () => {
  assert.ok(HMH_LEVEL_TWO_LITECOIN_CITY_POIS.length >= 5, 'should have at least 5 L2 POIs');
  // Hub must exist and be the routing center.
  const hub = HMH_LEVEL_TWO_LITECOIN_CITY_POIS.find((poi) => poi.id === 'litecoin-square-hub');
  assert.ok(hub);
  assert.equal(hub.lane, 'hub');
  // DeFi Harbor spoke (the Bible's recommended first district for water systems).
  const harbor = HMH_LEVEL_TWO_LITECOIN_CITY_POIS.find((poi) => poi.id === 'defi-harbor');
  assert.ok(harbor);
  assert.equal(harbor.lane, 'east-spur');
  assert.ok(harbor.miniBoss.phases >= 3, 'Bridge Exploiter should be a 3-phase boss');
  // Every POI must have a telegraph, mini-boss with phases, and a reward type.
  for (const poi of HMH_LEVEL_TWO_LITECOIN_CITY_POIS) {
    assert.ok(poi.telegraph, `${poi.id} needs a telegraph`);
    assert.ok(poi.miniBoss && poi.miniBoss.phases >= 2, `${poi.id} needs a mini-boss with >= 2 phases`);
    assert.ok(poi.reward && poi.reward.type, `${poi.id} needs a reward type`);
    assert.ok(poi.riskRewardRead, `${poi.id} needs a risk/reward read`);
  }
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

test('level 1 objective phases progress from survive to optional detour to boss beat to clear without extraction timer', () => {
  const preBoss = buildHmhCampaignObjectiveState({ levelId: 'level-1-crypto-wasteland', elapsedSeconds: 120 });
  assert.equal(preBoss.phase, 'survive');
  assert.match(preBoss.detail, /no extraction timer/i);

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
  assert.equal(boss.shortLabel, 'BOSS BEAT');

  const ignoredExtraction = buildHmhCampaignObjectiveState({ levelId: 'level-1-crypto-wasteland', elapsedSeconds: 500, extractionSpawned: true });
  assert.equal(ignoredExtraction.phase, 'survive');
  assert.equal(ignoredExtraction.shortLabel, 'SURVIVE');

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
