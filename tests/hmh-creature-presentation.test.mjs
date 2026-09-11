import test from 'node:test';
import assert from 'node:assert/strict';
import { creatureAnimationTick, liquidatorPose } from '../apps/hmh-reboot/src/creature-presentation.mjs';

test('horde strides are varied without consuming simulation randomness; impacts restart on contact', () => {
  const phases = new Set(Array.from({length: 32}, (_, i) => creatureAnimationTick(`enemy-${i}`, 600, 'run')));
  assert.ok(phases.size > 6);
  assert.equal(creatureAnimationTick('enemy-1', 600, 'run'), creatureAnimationTick('enemy-1', 600, 'run'));
  assert.equal(creatureAnimationTick('enemy-1', 601, 'hit', 600), 1);
  assert.equal(creatureAnimationTick('enemy-1', 1001, 'death', 1000), 1);
});

test('boss plays anticipation, strike, recovery and death in event order and faces the player', () => {
  const boss = Object.freeze({active: true, x: 0, y: 0, phaseId: 'x', pendingAttacks: Object.freeze([])});
  const player = Object.freeze({x: 0, y: -100});
  const base = {boss, player, tick: 605, lastAttack: {tick: 600, attackId: 'crash-lane'}, hitUntil: -1, deathUntil: -1};
  assert.deepEqual(liquidatorPose(base), {state: 'attack', tick: 605, phaseTick: 5, direction: 6, phase: 'x', elite: true});
  assert.equal(liquidatorPose({...base,tick: 640}).state, 'idle');
  const pending = {attackId:'crash-lane', resolveTick: 645, target: {x:100,y:0}};
  assert.deepEqual(liquidatorPose({...base,boss:{...boss,pendingAttacks:[pending]}}), {state:'tell',tick:605,phaseTick:5,direction:0,phase:'x',elite:true});
  assert.equal(liquidatorPose({...base,hitUntil:610}).state,'hit');
  const dead = liquidatorPose({...base,boss:{...boss,active:false},tick:700,deathUntil:745});
  assert.equal(dead.state,'death'); assert.equal(dead.tick,0);
  assert.equal(boss.pendingAttacks.length,0);
});
