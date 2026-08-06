import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { projectGasBomberCanister } from '../apps/hmh-reboot/src/enemy-attack-presentation.mjs';

const bomber = Object.freeze({
  archetypeId: 'gas-bomber',
  attackPhase: 'tell',
  attackTellStartedTick: 100,
  attackPhaseUntilTick: 140,
  x: 20,
  y: 40,
  groundZ: 6,
  telegraphTarget: Object.freeze({ x: 220, y: 140, groundZ: 10 }),
});

test('gas-bomber canister follows a deterministic bounded arc through the locked tell', () => {
  const start = projectGasBomberCanister({ enemy: bomber, tick: 100 });
  const middle = projectGasBomberCanister({ enemy: bomber, tick: 120 });
  const end = projectGasBomberCanister({ enemy: bomber, tick: 140 });
  assert.deepEqual(start, { x: 20, y: 40, z: 34, rotation: 0, progress: 0 });
  assert.deepEqual(middle, { x: 120, y: 90, z: 108, rotation: Math.PI * 2, progress: 0.5 });
  assert.equal(end.x, 220);
  assert.equal(end.y, 140);
  assert.ok(Math.abs(end.z - 38) < 1e-9);
  assert.equal(end.rotation, Math.PI * 4);
  assert.equal(end.progress, 1);
  assert.equal(Object.isFrozen(middle), true);
});

test('canister projection fails closed outside the gas-bomber tell and never mutates authority', () => {
  const snapshot = structuredClone(bomber);
  assert.equal(projectGasBomberCanister({ enemy: { ...bomber, archetypeId: 'liquidator-agent' }, tick: 120 }), null);
  assert.equal(projectGasBomberCanister({ enemy: { ...bomber, attackPhase: 'attack' }, tick: 140 }), null);
  assert.equal(projectGasBomberCanister({ enemy: { ...bomber, telegraphTarget: null }, tick: 120 }), null);
  assert.deepEqual(bomber, snapshot);
});

test('browser evidence can exercise normal attacks only behind both evidence-safe roster flags', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /rosterCombatEnabled = rosterPreviewEnabled && runtimeParams\.get\('rosterCombat'\) === '1'/);
  assert.match(source, /\(!rosterPreviewEnabled \|\| rosterCombatEnabled\) && openingEnemyAttacksEnabled\(tick\)/);
});

test('browser certification proves the canister draw branch serially', async () => {
  const runtime = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const smoke = await readFile(new URL('../scripts/hmh-reboot-enemy-boss-presentation-browser-smoke.mjs', import.meta.url), 'utf8');
  assert.match(runtime, /if \(releaseTelemetryEnabled\) dataset\.gasCanisterProgress = canister\.progress\.toFixed\(3\)/);
  assert.match(smoke, /Number\(stage\.dataset\.gasCanisterProgress\) > 0/);
  assert.doesNotMatch(smoke, /Promise\.all/);
});
