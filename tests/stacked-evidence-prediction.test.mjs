import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as sim from '../apps/portal/src/stacked-sim.mjs';

const sourceDir = new URL('../apps/portal/src/', import.meta.url);
const varintBytes = value => {
  let bytes = 1;
  while (value >= 128) { value = Math.floor(value / 128); bytes += 1; }
  return bytes;
};
function assertSizeAgreement(module) {
  const runtime = module.createStackedRuntime({ seed: 1, maxTicks: 200 });
  const recorder = module.createStackedInputRecorder({ seed: 1 });
  const schedule = new Map([[1, 1], [17, 0], [18, 3], [147, 7], [148, 6], [149, 0], [150, 16], [167, 32], [200, 0]]);
  const recordSizes = new Set();
  let mask = 0, previous = runtime.snapshot().encodedEvidenceBytes;
  assert.equal(recorder.encode().byteLength, previous + 2);
  for (let tick = 1; tick <= 200; tick += 1) {
    if (schedule.has(tick)) mask = schedule.get(tick);
    recorder.sample(tick, mask);
    const snapshot = runtime.step(recorder.commit());
    const bytes = recorder.encode();
    // The canonical counter covers header and records; SIC1 also needs its terminator.
    assert.equal(bytes.byteLength, snapshot.encodedEvidenceBytes + 1 + varintBytes(tick), `tick ${tick}`);
    assert.equal(module.decodeSic1(bytes).transitionCount, snapshot.transitionCount);
    recordSizes.add(snapshot.encodedEvidenceBytes - previous);
    previous = snapshot.encodedEvidenceBytes;
  }
  assert.deepEqual(recordSizes, new Set([0, 1, 3, 4]));
  assert.equal(runtime.result().ticks, 200);
  assert.deepEqual(module.replayStackedRun(recorder.encode(), { maxTicks: 200 }), runtime.result());
}

test('real-run SIC1 size matches the simulation predictor at every tick and reachable record class', () => {
  assertSizeAgreement(sim);
});

test('size coupling rejects a deliberately broken predictor in an isolated source copy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacked-size-mutant-'));
  try {
    for (const name of ['seeded-rng.mjs', 'stacked-contracts.mjs']) await copyFile(new URL(name, sourceDir), join(directory, name));
    const source = await readFile(new URL('stacked-sim.mjs', sourceDir), 'utf8');
    const needle = 'if (sicSingleBit(previousMask ^ mask) && gap <= 16) return 1;';
    assert.equal(source.split(needle).length, 2);
    await writeFile(join(directory, 'stacked-sim.mjs'), source.replace(needle, 'if (sicSingleBit(previousMask ^ mask) && gap <= 16) return 2;'));
    const mutant = await import(pathToFileURL(join(directory, 'stacked-sim.mjs')));
    assert.throws(() => assertSizeAgreement(mutant), assert.AssertionError);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const seed of [0, 1, 2, 42, 0xdeadbeef, 0xffffffff]) {
  test(`helper and runtime use identical named bag streams for seed ${seed}`, () => {
    const expected = sim.drawStackedPieces(seed, 64).pieces;
    const runtime = sim.createStackedRuntime({ seed });
    let seen = 0;
    while (true) {
      const state = runtime.snapshot();
      if (state.piecesSpawned !== seen) {
        seen = state.piecesSpawned;
        assert.equal(state.active.kind, expected[seen - 1]);
        assert.deepEqual(state.queue, expected.slice(seen, seen + state.queue.length));
        const helper = sim.drawStackedPieces(seed, seen);
        assert.equal(state.bagRefills, helper.bagRefills);
        assert.equal(state.bagDraws, helper.bagDraws);
      }
      if (runtime.terminal) break;
      runtime.step((state.tick + 1) % 2 === 0 ? 8 : 0);
    }
    assert.ok(seen >= 8, 'witness must cross a seven-piece refill boundary');
  });
  test(`zero-count draw deliberately prefills two bags without changing any external stream for seed ${seed}`, () => {
    const zero = sim.drawStackedPieces(seed, 0);
    const fresh = sim.createStackedRuntime({ seed }).snapshot();
    assert.deepEqual(zero.pieces, []);
    assert.equal(zero.bagRefills, 2);
    assert.equal(zero.bagRefills, fresh.bagRefills);
    assert.equal(zero.bagDraws, fresh.bagDraws);
    assert.ok(zero.bagDraws >= 12, 'rejection sampling may require extra draws');
    assert.deepEqual(sim.drawStackedPieces(seed, 0), zero);
  });
}
