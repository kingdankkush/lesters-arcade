import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('local source-art boundary validates exact identity and rejects path aliases and mutations', () => {
  const run = spawnSync('python', [fileURLToPath(new URL('./test_source_art_paths.py', import.meta.url))], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(run.error, undefined, run.error?.message);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stderr, /Ran 17 tests/);
  assert.match(run.stderr, /\nOK\s*$/);
  assert.doesNotMatch(run.stderr, /skipped|expected failure/i);
});
