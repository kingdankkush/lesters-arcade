import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAimState, resolveAimIntent } from '../apps/hmh-reboot/src/aim.mjs';
import { createLiquidatorBoss } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';

// Execute the runtime's actual aim call with the real aim and cover modules.
// Testing resolveAimIntent alone cannot detect a boss omitted by its caller.
const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const call = source.match(/aimIntent = (resolveAimIntent\(aimState, \{[\s\S]*?\n {6}\}\));/);
assert.ok(call, 'the simulation step must contain the runtime aim call');
const resolveRuntimeAim = new Function('context', `
  const { resolveAimIntent, aimState, tick, motion, actor, tickInput,
    grayboxEnemies, liquidatorBoss, traceHeightAwareLineOfSight,
    PROJECTILE_FLIGHT_HEIGHT, WORLD_BLOCKERS } = context;
  return ${call[1]};
`);
const projectileHeight = Number(source.match(/const PROJECTILE_FLIGHT_HEIGHT = (\d+);/)?.[1]);
assert.ok(Number.isFinite(projectileHeight), 'use the runtime projectile height for cover checks');

function boss(overrides = {}) {
  return Object.assign(createLiquidatorBoss({ id: 'boss-liquidator', x: 100, y: 0, startTick: 72_000 }), overrides);
}

function aim({ tick = 72_000, liquidatorBoss = boss(), grayboxEnemies = [], blockers = [], input = {} } = {}) {
  return resolveRuntimeAim({
    resolveAimIntent,
    aimState: createAimState(),
    tick,
    motion: { x: 0, y: 0 },
    actor: { groundZ: 0 },
    tickInput: { aim: { x: 0, y: 0, active: false }, fire: false, ...input },
    grayboxEnemies,
    liquidatorBoss,
    traceHeightAwareLineOfSight,
    PROJECTILE_FLIGHT_HEIGHT: projectileHeight,
    WORLD_BLOCKERS: blockers,
  });
}

test('runtime autofire acquires the Liquidator alone on its arrival tick', () => {
  const result = aim();
  assert.equal(result.targetId, 'boss-liquidator');
  assert.equal(result.source, 'autofire');
  assert.equal(result.fire, true);
  assert.deepEqual(result.direction, { x: 1, y: 0 });
});

test('runtime autofire reacquires the boss after its nearby adds are cleared', () => {
  const result = aim({ tick: 72_500, grayboxEnemies: [{ id: 'defeated-add', active: false, x: 20, y: 0, groundZ: 0 }] });
  assert.equal(result.targetId, 'boss-liquidator');
  assert.equal(result.fire, true);
});

for (const [name, options] of [
  ['before arrival', { tick: 71_999 }],
  ['inactive', { liquidatorBoss: boss({ active: false }) }],
  ['dead even before the active flag is cleared', { liquidatorBoss: boss({ health: 0 }) }],
  ['not created', { liquidatorBoss: null }],
  ['outside weapon range', { liquidatorBoss: boss({ x: 721 }) }],
]) {
  test(`runtime does not autofire at a boss ${name}`, () => {
    const result = aim(options);
    assert.equal(result.targetId, null);
    assert.equal(result.fire, false);
  });
}

test('runtime boss aiming respects solid cover and can shoot over low cover', () => {
  const cover = { id: 'cover', shape: { type: 'capsule', a: { x: 50, y: -10 }, b: { x: 50, y: 10 }, radius: 4 }, minZ: 0, maxZ: 80 };
  assert.equal(aim({ blockers: [cover] }).fire, false);
  assert.equal(aim({ blockers: [{ ...cover, maxZ: 24 }] }).targetId, 'boss-liquidator');
});

test('runtime boss support preserves nearest-enemy selection and manual aim', () => {
  const nearer = { id: 'nearby-rusher', active: true, x: 0, y: 20, groundZ: 0 };
  const result = aim({ grayboxEnemies: [nearer] });
  assert.equal(result.targetId, nearer.id);
  assert.deepEqual(result.direction, { x: 0, y: 1 });
  const manual = aim({ input: { aim: { x: -1, y: 0, active: true } } });
  assert.equal(manual.source, 'manual');
  assert.deepEqual(manual.direction, { x: -1, y: 0 });
});
