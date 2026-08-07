import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  createLightningLedgerState,
  resolveLightningLedgerUpgradePolicy,
  selectLightningLedgerChain,
  stepLightningLedger,
} from '../apps/hmh-reboot/src/lightning-ledger.mjs';

const policy = resolveLightningLedgerUpgradePolicy({
  branches: { conductivity: 3, voltage: 3, reconciliation: 3 },
  capstoneId: 'proof-of-network',
});
const origin = Object.freeze({ x: 0, y: 0 });
const targetCluster = (count) => Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
  id: `enemy-${String(index).padStart(2, '0')}`,
  x: 90 + index * 64,
  y: index % 2 === 0 ? -24 : 24,
  active: true,
})));

const results = [];
for (const size of [4, 8]) {
  const targets = targetCluster(size);
  const chain = selectLightningLedgerChain({ origin, targets: [...targets].reverse(), policy });
  assert.equal(chain.length, size);
  assert.deepEqual(chain.map((target) => target.id), selectLightningLedgerChain({ origin, targets, policy }).map((target) => target.id));

  const state = createLightningLedgerState();
  let pulses = 0;
  let hits = 0;
  let maxEventsPerTick = 0;
  for (let tick = 0; tick < 180; tick += 1) {
    const frame = stepLightningLedger(state, {
      tick,
      fire: true,
      validPrimary: true,
      origin,
      targets,
      policy,
    });
    maxEventsPerTick = Math.max(maxEventsPerTick, frame.events.length);
    for (const event of frame.events) {
      if (event.type !== 'ledger:pulse') continue;
      pulses += 1;
      hits += event.chainIds.length;
    }
  }
  assert.ok(pulses > 0);
  assert.equal(hits, pulses * size);
  assert.ok(maxEventsPerTick <= 3);

  const iterations = 10_000;
  const started = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const measured = selectLightningLedgerChain({ origin, targets, policy });
    assert.equal(measured.length, size);
  }
  const elapsedMs = performance.now() - started;
  assert.ok(elapsedMs < 2_000, `cluster ${size} benchmark exceeded 2s: ${elapsedMs.toFixed(3)}ms`);
  results.push({
    clusterSize: size,
    iterations,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    pulses,
    hits,
    maxEventsPerTick,
  });
}

console.log(JSON.stringify({ status: 'pass', benchmark: 'hmh-lightning-ledger-v1', results }));
