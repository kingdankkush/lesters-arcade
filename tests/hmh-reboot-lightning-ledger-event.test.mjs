import assert from 'node:assert/strict';
import test from 'node:test';

import { createLightningLedgerRareEvent } from '../apps/hmh-reboot/src/lightning-ledger-event.mjs';

const candidates = Object.freeze([
  Object.freeze({ id: 'hashwood-shrine', pointOfInterestId: 'hashwood-shrine', districtId: 'hashwood', x: 6700, y: 3200 }),
  Object.freeze({ id: 'mining-control-room', pointOfInterestId: 'mining-control-room', districtId: 'mining-camp', x: 9350, y: 1600 }),
  Object.freeze({ id: 'crossing-bank-cache', pointOfInterestId: 'crossing-bank-cache', districtId: 'liquidity-crossing', x: 5300, y: 1000 }),
]);

const safeCallbacks = Object.freeze({
  queryGround: () => ({ kind: 'route', groundZ: 0 }),
  isBlocked: () => false,
  isRouteReachable: () => true,
});

test('W8B rare Ledger event is same-seed stable, seed-variable, and available within eight minutes', () => {
  const first = createLightningLedgerRareEvent({ seed: 42, candidates, protectedPoints: [], ...safeCallbacks });
  const repeat = createLightningLedgerRareEvent({ seed: 42, candidates: [...candidates].reverse(), protectedPoints: [], ...safeCallbacks });
  const variation = createLightningLedgerRareEvent({ seed: 43, candidates, protectedPoints: [], ...safeCallbacks });
  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, variation);
  assert.ok(first.availableTick >= 3_600 && first.availableTick <= 28_800);
  assert.equal(first.assetId, 'lightning-ledger-cache');
  assert.equal(first.runtimeAuthority, 'fixed-tick-collectible');
});

test('W8B rare Ledger event deterministically rejects blocked, protected, deep-water, and unreachable placements', () => {
  const result = createLightningLedgerRareEvent({
    seed: 7,
    candidates,
    protectedPoints: [{ x: 6840, y: 3200 }],
    queryGround: (x) => ({ kind: x > 9000 ? 'deep-water' : 'route', groundZ: 0 }),
    isBlocked: (point) => point.districtId === 'liquidity-crossing',
    isRouteReachable: (point) => point.districtId === 'hashwood',
  });
  assert.equal(result.districtId, 'hashwood');
  assert.ok(Math.hypot(result.x - 6840, result.y - 3200) >= 120);
});

test('W8B rare Ledger event fails closed when no bounded placement is safe', () => {
  assert.throws(() => createLightningLedgerRareEvent({
    seed: 1,
    candidates,
    protectedPoints: [],
    queryGround: () => ({ kind: 'deep-water', groundZ: 0 }),
    isBlocked: () => false,
    isRouteReachable: () => false,
  }), /no safe Lightning Ledger event placement/i);
});
