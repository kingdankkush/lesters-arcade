import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ENEMY_ARCHETYPES, ENEMY_ARCHETYPE_IDS, REQUIRED_ENEMY_VISUAL_STATES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import {
  ENEMY_PRODUCTION_ART,
  LIQUIDATOR_PRODUCTION_ART,
  isEliteEnemyProjection,
  resolveEnemyProductionPose,
} from '../apps/hmh-reboot/src/enemy-production-art.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const EXPECTED_IDS = [
  'bagholder-rusher',
  'forkrunner',
  'gas-bomber',
  'liquidator-agent',
  'validator-cultist',
  'whale-enforcer',
];

const EXPECTED_STATES = ['idle', 'run', 'tell', 'attack', 'hit', 'death'];

test('all six enemy families have complete production and elite visual contracts', () => {
  assert.deepEqual([...ENEMY_ARCHETYPE_IDS].sort(), EXPECTED_IDS);
  assert.deepEqual([...REQUIRED_ENEMY_VISUAL_STATES], EXPECTED_STATES);
  assert.deepEqual(Object.keys(ENEMY_PRODUCTION_ART).sort(), EXPECTED_IDS);
  for (const id of EXPECTED_IDS) {
    const archetype = ENEMY_ARCHETYPES[id];
    const art = ENEMY_PRODUCTION_ART[id];
    assert.equal(archetype.visual.productionComplete, true, id);
    assert.equal(archetype.visual.eliteEnabled, true, id);
    assert.equal(art.actorId, id);
    assert.equal(art.classification, 'production-art');
    assert.equal(art.runtimeAuthority, 'projection-only');
    assert.deepEqual(art.states, EXPECTED_STATES);
    assert.deepEqual(art.elite.layers, ['aura', 'crown', 'outline']);
    assert.equal(typeof art.palette.body, 'number');
    assert.equal(typeof art.palette.accent, 'number');
    assert.equal(typeof art.telegraphColor, 'number');
    assert.ok(art.silhouette.width > 0 && art.silhouette.height > 0);
    assert.ok(art.identityCues.length >= 3);
  }
});

test('enemy production pose deterministically covers run tell attack hit and death motion', () => {
  for (const id of EXPECTED_IDS) {
    const idle = resolveEnemyProductionPose({ archetypeId: id, state: 'idle', tick: 60, direction: 0, elite: false });
    const runA = resolveEnemyProductionPose({ archetypeId: id, state: 'run', tick: 60, direction: 2, elite: false });
    const runB = resolveEnemyProductionPose({ archetypeId: id, state: 'run', tick: 66, direction: 2, elite: false });
    const tell = resolveEnemyProductionPose({ archetypeId: id, state: 'tell', tick: 60, direction: 4, elite: true });
    const attack = resolveEnemyProductionPose({ archetypeId: id, state: 'attack', tick: 60, direction: 4, elite: false });
    const hit = resolveEnemyProductionPose({ archetypeId: id, state: 'hit', tick: 60, direction: 4, elite: false });
    const death = resolveEnemyProductionPose({ archetypeId: id, state: 'death', tick: 60, direction: 4, elite: false });
    assert.equal(idle.state, 'idle');
    assert.notEqual(runA.legPhase, runB.legPhase, `${id} run must animate`);
    assert.equal(tell.eliteVisible, true);
    assert.ok(tell.tellPulse > 0);
    assert.ok(attack.recoil > 0);
    assert.equal(hit.tint, 0xffb3b3);
    assert.ok(death.rotation > 0 && death.alpha < 1);
    assert.deepEqual(resolveEnemyProductionPose({ archetypeId: id, state: 'death', tick: 60, direction: 4, elite: false }), death);
  }
  assert.throws(() => resolveEnemyProductionPose({ archetypeId: 'unknown', state: 'idle', tick: 0, direction: 0 }), /Unknown production enemy/);
  assert.throws(() => resolveEnemyProductionPose({ archetypeId: EXPECTED_IDS[0], state: 'dance', tick: 0, direction: 0 }), /Unsupported enemy visual state/);
});

test('Liquidator boss art covers all phases and attacks without gameplay authority', () => {
  assert.equal(LIQUIDATOR_PRODUCTION_ART.actorId, 'the-liquidator');
  assert.equal(LIQUIDATOR_PRODUCTION_ART.classification, 'production-art');
  assert.equal(LIQUIDATOR_PRODUCTION_ART.runtimeAuthority, 'projection-only');
  assert.deepEqual(LIQUIDATOR_PRODUCTION_ART.phases, ['market-open', 'margin-call', 'total-liquidation']);
  assert.deepEqual(LIQUIDATOR_PRODUCTION_ART.states, EXPECTED_STATES);
  assert.ok(LIQUIDATOR_PRODUCTION_ART.identityCues.includes('executive exosuit'));
  assert.ok(LIQUIDATOR_PRODUCTION_ART.identityCues.includes('red liquidation tie'));
  assert.ok(LIQUIDATOR_PRODUCTION_ART.identityCues.includes('gold market crown'));
});

test('elite treatment is a stable ID-only projection with bounded frequency', () => {
  const sample = Array.from({ length: 128 }, (_, index) => isEliteEnemyProjection(`enemy-${String(index).padStart(4, '0')}`));
  assert.deepEqual(sample, Array.from({ length: 128 }, (_, index) => isEliteEnemyProjection(`enemy-${String(index).padStart(4, '0')}`)));
  const elites = sample.filter(Boolean).length;
  assert.ok(elites >= 8 && elites <= 24, String(elites));
  assert.throws(() => isEliteEnemyProjection(''), /enemyId/);
});

test('runtime projects production enemy and boss art without mutating combat authority', () => {
  const source = read('apps/hmh-reboot/src/main.mjs');
  assert.match(source, /createProductionEnemyDisplay/);
  assert.match(source, /createLiquidatorProductionDisplay/);
  assert.match(source, /resolveEnemyRuntimeVisualState/);
  assert.match(source, /enemyMarker\.applyPose\(\{/);
  assert.match(source, /bossVisual\.applyPose\(\{/);
  assert.match(source, /queueEnemyDeathVisual\(defeatedEnemy, tick\)/);
  assert.match(source, /endTick: tick \+ 30/);
  assert.ok(source.indexOf('queueEnemyDeathVisual(defeatedEnemy, tick)') < source.indexOf('retireEnemyFromPopulation(enemyPopulation, scoreEvent.enemyId'));
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyDeathVisuals/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyEliteVisuals/);
  assert.match(source, /enemy\.hitUntilTick = tick \+ 6/);
  assert.match(source, /bossDeathVisualUntilTick = tick \+ 45/);
  assert.match(source, /bossHitVisualUntilTick = tick \+ 6/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.bossVisualState/);
  // Enemies and the boss now render from authored Blender roster atlases when
  // those resolve, and fall back to this vector projection otherwise, so the
  // art telemetry reports whichever actually rendered.
  assert.match(source, /dataset\.enemyArt = enemyRosterIndexes\.size > 0 \? 'production-roster-atlas-v1' : 'production-vector-enemies-v1'/);
  assert.match(source, /dataset\.bossArt = enemyRosterIndexes\.has\('the-liquidator'\) \? 'production-roster-atlas-v1' : 'production-vector-liquidator-v1'/);
  assert.doesNotMatch(source, /(?:enemyMarker|bossVisual)\.(?:damage|health|collision|score|wallet|settlement)\s*=/);
});

// ---------------------------------------------------------------------------
// Cycle 074 (E-3): the attack-phase tick lets the roster frames follow the
// simulation's own tell -> strike -> recovery windows instead of the global
// clock. Read-only projection over the enemy's attack fields.
// ---------------------------------------------------------------------------

test('the attack phase tick is read-only and counts from the phase the simulation is in', async () => {
  const { resolveEnemyAttackPhaseTick, resolveEnemyRosterPoseSelection, resolveEnemyRuntimeVisualState: resolveState } = await import('../apps/hmh-reboot/src/enemy-production-art.mjs');
  const { ENEMY_STRIKE_TICKS } = await import('../apps/hmh-reboot/src/enemy-combat.mjs');
  // A bagholder-rusher tell that started on tick 100: tellTicks 15, strike at
  // 115, recovery until 115 + 24 = 139 (see enemy-combat.test.mjs).
  const tell = Object.freeze({
    archetypeId: 'bagholder-rusher', active: true, health: 10, attackPhase: 'tell',
    attackTellStartedTick: 100, attackPhaseUntilTick: 115, velocity: Object.freeze({ x: 0, y: 0 }),
  });
  assert.equal(resolveEnemyAttackPhaseTick(tell, 100), 0);
  assert.equal(resolveEnemyAttackPhaseTick(tell, 109), 9);
  assert.equal(resolveEnemyAttackPhaseTick(tell, 114), 14);
  const strike = Object.freeze({ ...tell, attackPhase: 'attack', attackPhaseUntilTick: 115 + ENEMY_STRIKE_TICKS, attackRecoveryUntilTick: 139 });
  assert.equal(resolveEnemyAttackPhaseTick(strike, 115), 0, 'the overshoot frame opens the strike');
  assert.equal(resolveEnemyAttackPhaseTick(strike, 120), 5);
  const recovery = Object.freeze({ ...strike, attackPhase: 'recovery', attackPhaseUntilTick: 139 });
  assert.equal(resolveEnemyAttackPhaseTick(recovery, 121), ENEMY_STRIKE_TICKS, 'recovery continues the attack clip past the strike');
  assert.equal(resolveEnemyAttackPhaseTick(recovery, 138), 23);
  assert.equal(resolveEnemyAttackPhaseTick({ ...tell, attackPhase: 'ready' }, 200), null);
  assert.equal(resolveEnemyAttackPhaseTick({ ...tell, attackPhase: undefined }, 200), null);
  assert.equal(resolveEnemyAttackPhaseTick({ ...tell, attackTellStartedTick: undefined }, 130), 0, 'a tell without a start tick shows the anticipation frame');
  const snapshot = structuredClone(recovery);
  resolveEnemyAttackPhaseTick(recovery, 130);
  resolveEnemyRosterPoseSelection(recovery, 130);
  assert.deepEqual(recovery, snapshot, 'projection never writes back into the simulation entity');

  // The roster selection exposes recovery as the held final attack frame, but
  // never over a hit reaction or a corpse; the vector fallback keeps using
  // resolveEnemyRuntimeVisualState unchanged.
  assert.deepEqual(resolveEnemyRosterPoseSelection(tell, 105), { state: 'tell', phaseTick: 5 });
  assert.deepEqual(resolveEnemyRosterPoseSelection(strike, 117), { state: 'attack', phaseTick: 2 });
  assert.deepEqual(resolveEnemyRosterPoseSelection(recovery, 130), { state: 'attack', phaseTick: 15 });
  assert.deepEqual(resolveEnemyRosterPoseSelection({ ...recovery, hitUntilTick: 132 }, 130), { state: 'hit', phaseTick: null });
  assert.deepEqual(resolveEnemyRosterPoseSelection({ ...recovery, health: 0 }, 130), { state: 'death', phaseTick: null });
  assert.deepEqual(resolveEnemyRosterPoseSelection({ ...tell, attackPhase: 'ready', velocity: { x: 3, y: 0 } }, 130), { state: 'run', phaseTick: null });
  assert.equal(resolveState(recovery, 130), 'idle', 'the six-state runtime resolver is unchanged');
  assert.throws(() => resolveEnemyAttackPhaseTick(null, 1), /enemy/);
});

test('the runtime plumbs the phase tick into roster poses and draws elite ground rings under animated bodies', () => {
  const source = read('apps/hmh-reboot/src/main.mjs');
  const applyPoseStart = source.indexOf('enemyMarker.applyPose({');
  const applyPoseBlock = source.slice(applyPoseStart, source.indexOf('});', applyPoseStart));
  assert.match(applyPoseBlock, /phaseTick/, 'roster tell/attack frames must be phase-relative');
  assert.match(source, /resolveEnemyRosterPoseSelection/);
  assert.match(source, /const eliteGroundLayer = new Graphics\(\)/);
  assert.match(source, /bossTelegraphs, eliteGroundLayer, enemyVisuals/, 'the elite ring draws above telegraphs and under bodies');
  assert.match(source, /eliteGroundLayer\.clear\(\)/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyEliteVisuals/);
});
