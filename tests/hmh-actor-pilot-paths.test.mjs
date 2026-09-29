import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
test('pure actor exporter path gate rejects source paths before any Blender work', () => {
  const run = spawnSync('python', [fileURLToPath(new URL('./hmh-actor-pilot-paths.test.py', import.meta.url))],
    { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stderr, /Ran 3 tests/);
  assert.match(run.stderr, /\nOK\s*$/);
});
