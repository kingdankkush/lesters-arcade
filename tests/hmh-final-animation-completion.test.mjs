import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HMH_FINAL_ANIMATION_COMPLETION_PACK,
  finalAnimationAssetByKey,
  completionAssetsForActor,
  completionCoverageSummary,
} from '../apps/portal/assets/generated/hmh-final-animation-completion/hmh-final-animation-completion-manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const HEROES = ['lit-commando', 'lit-valkyrie', 'lester', 'lilly'];
const HERO_POLISH_STATES = ['crouch', 'fall', 'victory'];
const ENEMY_READABILITY_STATES = ['attack-tell', 'melee-counter', 'hit', 'death', 'optional-gore-overlay'];
const MIN_ENEMY_ACTORS = 12;

function runtimePath(src) {
  return path.resolve(ROOT, 'apps/portal', String(src).replace(/^\.\//, ''));
}

test('final animation completion pack ships hero polish states for every playable roster', () => {
  assert.equal(HMH_FINAL_ANIMATION_COMPLETION_PACK.id, 'hmh-final-animation-completion-v1');
  assert.match(HMH_FINAL_ANIMATION_COMPLETION_PACK.sourcePolicy, /original repo-owned/i);

  for (const hero of HEROES) {
    for (const state of HERO_POLISH_STATES) {
      const asset = finalAnimationAssetByKey(`hero/${hero}/${state}`);
      assert.ok(asset, `${hero}/${state} completion asset exists`);
      assert.equal(asset.actorId, hero);
      assert.equal(asset.role, 'hero');
      assert.equal(asset.state, state);
      assert.deepEqual(asset.directions, DIRECTIONS);
      assert.equal(asset.framesPerDirection >= 4, true, `${asset.key} has enough frames`);
      assert.equal(asset.frameWidth > 0 && asset.frameHeight > 0, true, `${asset.key} dimensions`);
      assert.equal(asset.sheetWidth, asset.frameWidth * asset.framesPerDirection * DIRECTIONS.length, `${asset.key} sheet width contract`);
      assert.equal(existsSync(runtimePath(asset.src)), true, `${asset.src} exists`);
    }
  }
});

test('final animation completion pack ships enemy readability states for active bespoke roster keys', () => {
  const enemyActors = HMH_FINAL_ANIMATION_COMPLETION_PACK.actors.filter((actor) => actor.role === 'enemy');
  assert.equal(enemyActors.length >= MIN_ENEMY_ACTORS, true, 'broad enemy actor coverage');

  for (const actor of enemyActors) {
    for (const state of ENEMY_READABILITY_STATES) {
      const asset = finalAnimationAssetByKey(`enemy/${actor.id}/${state}`);
      assert.ok(asset, `${actor.id}/${state} completion asset exists`);
      assert.equal(asset.role, 'enemy');
      assert.equal(asset.actorId, actor.id);
      assert.equal(asset.state, state);
      assert.deepEqual(asset.directions, DIRECTIONS);
      assert.equal(asset.framesPerDirection >= 4, true, `${asset.key} has enough frames`);
      assert.equal(existsSync(runtimePath(asset.src)), true, `${asset.src} exists`);
    }
  }
});

test('final animation completion helpers summarize full actor/state coverage', () => {
  const lesterAssets = completionAssetsForActor('lester');
  assert.equal(lesterAssets.filter((asset) => asset.role === 'hero').length, HERO_POLISH_STATES.length);

  const summary = completionCoverageSummary();
  assert.equal(summary.heroActors, HEROES.length);
  assert.equal(summary.heroStates.every((state) => HERO_POLISH_STATES.includes(state)), true);
  assert.equal(summary.enemyStates.every((state) => ENEMY_READABILITY_STATES.includes(state)), true);
  assert.equal(summary.missingAssets.length, 0);
  assert.equal(summary.totalAssets, HMH_FINAL_ANIMATION_COMPLETION_PACK.assets.length);
});


test('HMH lazy loader exposes final animation completion pack to runtime consumers', () => {
  const loaderSource = readFileSync(fileURLToPath(new URL('../apps/portal/src/games/hmh/loader.mjs', import.meta.url)), 'utf8');
  assert.equal(loaderSource.includes('HMH_FINAL_ANIMATION_COMPLETION_PACK'), true);
  assert.equal(loaderSource.includes('hmh-final-animation-completion-manifest.mjs'), true);
});


test('animation coverage audit reports the final completion-pack layer', () => {
  const auditSource = readFileSync(fileURLToPath(new URL('../scripts/report-hmh-animation-coverage.mjs', import.meta.url)), 'utf8');
  assert.equal(auditSource.includes('HMH_FINAL_ANIMATION_COMPLETION_PACK'), true);
  assert.equal(auditSource.includes('completionPackSummary'), true);
});
