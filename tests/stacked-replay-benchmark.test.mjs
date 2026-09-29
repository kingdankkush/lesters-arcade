import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withReplayHeavyLock, assessReplaySamples } from '../scripts/lib/stacked-replay-benchmark.mjs';

test('performance lock refuses competing ownership and releases only its own empty folder', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'stacked-replay-lock-'));
  const lockPath = join(parent, 'heavy.lock');
  try {
    await withReplayHeavyLock(async () => {
      const owner = JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8'));
      assert.equal(owner.owner, 'stacked-replay-benchmark');
      await assert.rejects(withReplayHeavyLock(async () => assert.fail('competing job ran'), { lockPath }), /EEXIST/);
      assert.equal(JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8')).token, owner.token);
    }, { lockPath });
    assert.equal(existsSync(lockPath), false);
    await assert.rejects(withReplayHeavyLock(async () => { throw new Error('measurement failed'); }, { lockPath }), /measurement failed/);
    assert.equal(existsSync(lockPath), false, 'failed measurement must release its own lock');
  } finally { rmdirSync(parent); }
});

test('changed lock ownership is preserved even after the job exits', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'stacked-replay-lock-'));
  const lockPath = join(parent, 'heavy.lock'), ownerPath = join(lockPath, 'owner.json');
  try {
    await assert.rejects(withReplayHeavyLock(async () => writeFileSync(ownerPath, JSON.stringify({ token: 'other-owner' })), { lockPath }), /ownership changed/);
    assert.equal(JSON.parse(readFileSync(ownerPath, 'utf8')).token, 'other-owner');
  } finally { unlinkSync(ownerPath); rmdirSync(lockPath); rmdirSync(parent); }
});

test('slow first-use observations stay visible instead of being erased by faster samples', () => {
  const samples = Array.from({ length: 7 }, (_, index) => ({ index, phase: 'replay', ok: true, wallMs: index === 0 ? 300 : 90 }));
  samples.push({ index: 0, phase: 'verify', ok: true, wallMs: 95 });
  const result = assessReplaySamples(samples);
  assert.equal(result.passed, false);
  assert.equal(result.phases.replay.p50Ms, 90);
  assert.equal(result.phases.replay.p95Ms, 300);
  assert.equal(result.phases.replay.maxMs, 300);
  assert.equal(result.samples.length, 8);
});
