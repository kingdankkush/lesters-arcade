import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
test('packed selector source, native pose, provenance and isolated command contracts (Blender-free)', () => {
  const result = spawnSync('python', ['-B', 'tests/hmh-selector-packed-sources.test.py'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  console.log(result.stderr.trim());
  assert.match(result.stderr, /Ran [1-9][0-9]* tests in/u);
  assert.match(result.stderr, /\nOK\s*$/u);
  assert.doesNotMatch(result.stderr, /skipped|expected failure|unexpected success/u);
});
