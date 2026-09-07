import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStackedRuntime, buildStackedResultTuple } from '../apps/portal/src/stacked-sim.mjs';
import { createStackedMatch } from '../apps/portal/src/stacked-match.mjs';
import { STACKED_ATTACK_TABLE } from '../apps/portal/src/stacked-versus-table.mjs';
import { STACKED_MAX_LINES } from '../apps/portal/src/stacked-contracts.mjs';

const terminalSnapshot = () => {
  const runtime = createStackedRuntime({ seed: 1, maxTicks: 1 });
  runtime.step(0);
  return runtime.snapshot();
};

for (const config of [{ buildHash: ' bad' }, { seasonId: 'BAD' }]) {
  test(`runtime rejects malformed identity at construction: ${Object.keys(config)[0]}`, () => {
    assert.throws(() => createStackedRuntime({ seed: 1, maxTicks: 1, config }), /buildHash|seasonId/);
  });
}

test('the review-regression module is registered in the syntax gate', () => {
  const source = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('"tests/stacked-s03-review-regressions.test.mjs"'));
});

test('state hash separates reachable input histories before their next hold diverges', () => {
  const first = createStackedRuntime({ seed: 1, maxTicks: 1000, config: { startLevel: 15 } });
  const second = createStackedRuntime({ seed: 1, maxTicks: 1000, config: { startLevel: 15 } });
  first.step(128); second.step(128);
  while (!first.terminal && first.snapshot().piecesLocked === 0) {
    first.step(128); second.step(0);
  }
  assert.equal(first.terminal, false);
  assert.deepEqual(first.snapshot().board, second.snapshot().board);
  assert.notEqual(first.snapshot().prevMask, second.snapshot().prevMask);
  const before = [first.stateHash(), second.stateHash()];
  first.step(128); second.step(128);
  assert.notEqual(first.snapshot().holdsUsed, second.snapshot().holdsUsed, 'same next input proves future divergence');
  assert.notEqual(before[0], before[1], 'pre-divergence state must already distinguish input history');
});

test('state hash includes the immutable start level', () => {
  assert.notEqual(
    createStackedRuntime({ seed: 1, config: { startLevel: 1 } }).stateHash(),
    createStackedRuntime({ seed: 1, config: { startLevel: 15 } }).stateHash(),
  );
});

test('state hash includes the configured terminal ceiling', () => {
  assert.notEqual(
    createStackedRuntime({ seed: 1, maxTicks: 10 }).stateHash(),
    createStackedRuntime({ seed: 1, maxTicks: 20 }).stateHash(),
  );
});

test('match state hash includes its immutable attack configuration', () => {
  const args = { seed: 28, playerConfigs: [{ startLevel: 1 }, { startLevel: 1 }] };
  const first = createStackedMatch({ ...args, attackTable: { ...STACKED_ATTACK_TABLE, base: [0, 1, 1, 2, 4] } });
  const second = createStackedMatch({ ...args, attackTable: { ...STACKED_ATTACK_TABLE, base: [0, 2, 1, 2, 4] } });
  assert.notEqual(first.stateHash(), second.stateHash());
});

test('result validation rejects more holds than spawned pieces', () => {
  const snapshot = terminalSnapshot();
  assert.throws(() => buildStackedResultTuple({ ...snapshot, holdsUsed: snapshot.piecesSpawned + 1 }), /holds/i);
});

test('result validation requires the configured ceiling for a tick-ceiling result', () => {
  const { maxTicks, ...snapshot } = terminalSnapshot();
  assert.equal(maxTicks, 1);
  assert.throws(() => buildStackedResultTuple(snapshot), /maxTicks|ceiling/i);
});

for (const value of [2 ** 53, 2 ** 32, Number.MAX_SAFE_INTEGER]) {
  test(`attack-table construction rejects oversized row count ${value}`, () => {
    assert.throws(() => createStackedMatch({
      seed: 28, playerConfigs: [{ startLevel: 1 }, { startLevel: 1 }],
      attackTable: { ...STACKED_ATTACK_TABLE, base: [0, value, 1, 2, 4] },
    }), /attackTable/i);
  });
}

test('attack-table construction rejects sparse numeric arrays', () => {
  const base = [0, 1, 1, 2, 4];
  delete base[1];
  assert.throws(() => createStackedMatch({ seed: 1, playerConfigs: [{}], attackTable: { ...STACKED_ATTACK_TABLE, base } }), /attackTable/i);
});

test('attack-table construction rejects sparse qualifier arrays', () => {
  const backToBackQualifiers = new Array(1);
  assert.throws(() => createStackedMatch({ seed: 1, playerConfigs: [{}], attackTable: { ...STACKED_ATTACK_TABLE, backToBackQualifiers } }), /attackTable/i);
});

test('attack-table construction rejects an oversized hash version string', () => {
  const version = 'v'.repeat(200_000);
  assert.throws(() => createStackedMatch({ seed: 1, playerConfigs: [{}], attackTable: { ...STACKED_ATTACK_TABLE, version } }), /attackTable/i);
});

test('attack-table construction bounds the combined send, not only its components', () => {
  assert.throws(() => createStackedMatch({
    seed: 28, playerConfigs: [{ startLevel: 1 }, { startLevel: 1 }],
    attackTable: { ...STACKED_ATTACK_TABLE, base: [0, STACKED_MAX_LINES, 1, 2, 4] },
  }), /attackTable/i);
});
