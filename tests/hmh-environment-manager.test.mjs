import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  WEATHER_PRESETS,
  buildAmbientZoneModel,
  buildCombatReadabilityProfile,
  buildEnvironmentState,
  buildNoirLightingPlan,
} from '../apps/portal/src/hmh-environment-manager.mjs';

test('buildEnvironmentState is deterministic for a given seed and escalates from dusk toward night over a run', () => {
  const openingA = buildEnvironmentState({ seed: 12345, elapsedSeconds: 30 });
  const openingB = buildEnvironmentState({ seed: 12345, elapsedSeconds: 30 });
  const late = buildEnvironmentState({ seed: 12345, elapsedSeconds: 16 * 60 });

  assert.deepEqual(openingA, openingB);
  assert.equal(openingA.timeOfDay.phase, 'dusk');
  assert.equal(late.timeOfDay.phase, 'night');
  assert.equal(late.timeOfDay.ambientDarkness > openingA.timeOfDay.ambientDarkness, true);
  assert.equal(typeof openingA.wind.x, 'number');
  assert.equal(typeof openingA.wind.y, 'number');
  assert.equal(typeof openingA.weather.id, 'string');
  assert.equal(openingA.weather.id in WEATHER_PRESETS, true);
});

test('buildEnvironmentState encodes seeded gameplay-facing weather modifiers separately from cosmetic wind/time data', () => {
  const storm = buildEnvironmentState({ seed: 7, elapsedSeconds: 11 * 60 });
  assert.equal(typeof storm.weather.gameplay.sightRadiusMul, 'number');
  assert.equal(typeof storm.weather.gameplay.projectileDriftMul, 'number');
  assert.equal(storm.weather.gameplay.sightRadiusMul <= 1, true);
});

test('buildCombatReadabilityProfile damps ambient/background FX as threat density rises', () => {
  const calm = buildCombatReadabilityProfile({ enemyCount: 4, projectileCount: 2, weatherId: 'clear' });
  const chaos = buildCombatReadabilityProfile({ enemyCount: 44, projectileCount: 18, weatherId: 'dust-storm' });

  assert.equal(chaos.ambientFxMul < calm.ambientFxMul, true);
  assert.equal(chaos.backgroundFxMul < calm.backgroundFxMul, true);
  assert.equal(chaos.maxAmbientProps <= calm.maxAmbientProps, true);
  assert.equal(chaos.weatherOverlayAlpha >= calm.weatherOverlayAlpha, true);
});

test('buildAmbientZoneModel maps district families and POIs to biome-extensible ambient beds and danger cues', () => {
  const desert = buildAmbientZoneModel({ districtFamily: 'desert_approach', weatherId: 'clear' });
  const forestPoi = buildAmbientZoneModel({ districtFamily: 'country_road', poiId: 'dry-forest-cave', weatherId: 'fog' });
  const rugpull = buildAmbientZoneModel({ districtFamily: 'ghost_town', poiId: 'rugpull-gulch', weatherId: 'dust-storm' });

  assert.equal(desert.ambientBed, 'desert-wind');
  assert.equal(forestPoi.ambientBed, 'forest-cave-hush');
  assert.equal(forestPoi.dangerCue, 'cave-mouth-drip');
  assert.equal(rugpull.ambientBed, 'ghost-town-creak');
  assert.equal(rugpull.poiTensionCue, 'rugpull-mainstreet-tension');
});

test('WO-50 noir lighting plan supports BLACKOUT while preserving silhouette and perf gates', () => {
  const environmentState = buildEnvironmentState({ seed: 12345, elapsedSeconds: 16 * 60 });
  const calmReadability = buildCombatReadabilityProfile({ enemyCount: 4, projectileCount: 1, weatherId: environmentState.weather.id });
  const chaosReadability = buildCombatReadabilityProfile({ enemyCount: 52, projectileCount: 20, weatherId: 'dust-storm' });

  const calm = buildNoirLightingPlan({ environmentState, readability: calmReadability });
  const blackout = buildNoirLightingPlan({
    environmentState,
    readability: chaosReadability,
    activeThreatBeat: { type: 'BLACKOUT', composition: { ambientDimPct: 40 } },
  });

  assert.equal(calm.id, 'level1-noir-lighting-plan-v1');
  assert.equal(calm.blackout.active, false);
  assert.equal(blackout.blackout.active, true);
  assert.equal(blackout.blackout.hook, 'LEVEL_ONE_THREAT_BEAT_BLACKOUT');
  assert.equal(blackout.ambientDarkness > calm.ambientDarkness, true);
  assert.equal(blackout.backgroundDimMul < calm.backgroundDimMul, true);
  assert.equal(blackout.silhouetteRimAlpha >= 0.36, true);
  assert.equal(blackout.muzzleFlashBoost > calm.muzzleFlashBoost, true);
  assert.equal(blackout.weatherOverlayAlpha <= chaosReadability.weatherOverlayAlpha, true, 'BLACKOUT must not stack haze until actors disappear');
  assert.equal(blackout.perf.maxLightSources <= calm.perf.maxLightSources, true);
  assert.equal(blackout.perf.maxLightSources <= 14, true);
  assert.equal(blackout.perf.cacheStaticGradients, true);
  assert.deepEqual(blackout.layerOrder, ['night-tint', 'light-pools', 'colored-glow', 'silhouette-rim', 'weather-haze', 'edge-vignette']);
});

test('WO-50 runtime source consumes noir lighting plan and active BLACKOUT beat in drawSceneLighting', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const lightingBlock = mainSource.slice(mainSource.indexOf('function drawSceneLighting'), mainSource.indexOf('function drawCombatScene'));

  assert.match(mainSource, /buildNoirLightingPlan/);
  assert.match(mainSource, /levelOneThreatBeatAt/);
  assert.match(lightingBlock, /currentLevelOneThreatBeat\(/);
  assert.match(lightingBlock, /lightingPlan\.blackout\.active/);
  assert.match(lightingBlock, /lightingPlan\.perf\.maxLightSources/);
  assert.match(lightingBlock, /silhouetteRimAlpha/);
  assert.match(lightingBlock, /muzzleFlashBoost/);
});
