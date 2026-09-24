import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LITEFORGE_FEE_HEADROOM,
  LITEFORGE_MIN_MAX_FEE_PER_GAS_WEI,
  liteForgeFeeOverrides,
  liteForgeMaxFeePerGas,
} from '../apps/portal/src/liteforge-fees.mjs';

test('the fee cap is ten times the latest base fee and never below 5 gwei', () => {
  assert.equal(LITEFORGE_FEE_HEADROOM, 10n);
  assert.equal(LITEFORGE_MIN_MAX_FEE_PER_GAS_WEI, 5_000_000_000n);
  // 2026-09-23 peak (1.7 gwei) and 2026-09-24 readings (0.07 then 0.26 gwei).
  assert.equal(liteForgeMaxFeePerGas(1_714_352_000n), 17_143_520_000n);
  assert.equal(liteForgeMaxFeePerGas(71_618_333n), 5_000_000_000n);
  assert.equal(liteForgeMaxFeePerGas('0x0f4240'), 5_000_000_000n);
  assert.equal(liteForgeMaxFeePerGas(null), 5_000_000_000n);
  assert.equal(liteForgeMaxFeePerGas('not a number'), 5_000_000_000n);
});

test('overrides come from the latest block and fall back to the floor', async () => {
  const calls = [];
  const provider = { async getBlock(tag) { calls.push(tag); return { baseFeePerGas: 1_469_367_000n }; } };
  assert.deepEqual(await liteForgeFeeOverrides(provider), { maxFeePerGas: 14_693_670_000n, maxPriorityFeePerGas: 0n });
  assert.deepEqual(calls, ['latest']);
  const down = { async getBlock() { throw new Error('RPC down'); } };
  assert.deepEqual(await liteForgeFeeOverrides(down), { maxFeePerGas: 5_000_000_000n, maxPriorityFeePerGas: 0n });
  assert.deepEqual(await liteForgeFeeOverrides(null), { maxFeePerGas: 5_000_000_000n, maxPriorityFeePerGas: 0n });
});
