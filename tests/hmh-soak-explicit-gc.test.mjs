import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ensureExplicitGc } from '../scripts/hmh-soak-explicit-gc.mjs';

test('soak GC helper stays in-process when explicit GC is already available', () => {
  let spawned = false;
  let exited = false;
  const result = ensureExplicitGc('file:///C:/repo/soak.mjs', {
    gc: () => {},
    spawn: () => { spawned = true; },
    exit: () => { exited = true; },
  });
  assert.deepEqual(result, { relaunched: false });
  assert.equal(spawned, false);
  assert.equal(exited, false);
});

test('soak GC helper relaunches the exact script with --expose-gc and propagates status', () => {
  const calls = [];
  let exitStatus = null;
  const result = ensureExplicitGc('file:///C:/repo/soak.mjs', {
    gc: undefined,
    execPath: 'node',
    env: { TEST: '1' },
    spawn: (...args) => {
      calls.push(args);
      return { status: 7, error: null };
    },
    exit: (status) => { exitStatus = status; },
  });
  assert.deepEqual(result, { relaunched: true, status: 7 });
  assert.equal(exitStatus, 7);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'node');
  assert.deepEqual(calls[0][1], ['--expose-gc', fileURLToPath('file:///C:/repo/soak.mjs')]);
  assert.deepEqual(calls[0][2], { stdio: 'inherit', env: { TEST: '1' } });
});

test('soak GC helper surfaces relaunch failures', () => {
  const expected = new Error('spawn failed');
  assert.throws(() => ensureExplicitGc('file:///C:/repo/soak.mjs', {
    gc: undefined,
    spawn: () => ({ status: null, error: expected }),
    exit: () => assert.fail('exit must not run after spawn failure'),
  }), expected);
});
