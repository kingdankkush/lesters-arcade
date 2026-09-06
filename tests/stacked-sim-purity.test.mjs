import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('shipped STACKED sim passes its executable purity audit', () => {
  const result = spawnSync(process.execPath, ['scripts/stacked-sim-purity-check.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
