import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { verifyRetirementGate } from '../scripts/hmh-reboot-test-retirement-gate.mjs';

const repoRoot = path.resolve('retirement-gate-fixture-repo');
const legacyFile = path.join(repoRoot, 'tests', 'legacy-art.test.mjs');
const differentFile = path.join(repoRoot, 'tests', 'different.test.mjs');
const runtimeFile = path.join(repoRoot, 'tests', 'runtime.test.mjs');
const ledger = {
  schema: 'hmh-reboot-legacy-test-retirement-v1',
  failures: [
    {
      file: 'tests/legacy-art.test.mjs',
      assertion: 'retired binary art contract (1.25ms)',
      reason: 'retired legacy HMH binary art contract',
    },
  ],
};

function exactEvents() {
  return [
    {
      type: 'test:fail',
      name: 'retired binary art contract',
      file: legacyFile,
      detailsType: 'test',
      nesting: 0,
    },
    {
      type: 'test:summary',
      success: false,
      counts: {
        tests: 2,
        failed: 1,
        passed: 1,
        cancelled: 0,
        skipped: 0,
        todo: 0,
        topLevel: 2,
        suites: 0,
      },
    },
  ];
}

test('retirement gate accepts only the exact ledgered file and assertion failure set', () => {
  const result = verifyRetirementGate({ ledger, events: exactEvents(), repoRoot });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
  assert.equal(result.expectedFailureCount, 1);
  assert.equal(result.observedFailureCount, 1);
});

test('retirement gate rejects any extra failure', () => {
  const events = exactEvents();
  events.splice(1, 0, {
    type: 'test:fail',
    name: 'new runtime regression',
    file: runtimeFile,
    detailsType: 'test',
    nesting: 0,
  });
  events.at(-1).counts.failed = 2;
  events.at(-1).counts.tests = 3;

  const result = verifyRetirementGate({ ledger, events, repoRoot });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unexpected failure.*tests\/runtime\.test\.mjs.*new runtime regression/i);
});

test('retirement gate rejects a missing ledger failure', () => {
  const events = exactEvents().slice(1);
  events[0].counts.failed = 0;
  events[0].counts.tests = 1;
  events[0].success = true;

  const result = verifyRetirementGate({ ledger, events, repoRoot });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /missing ledger failure.*tests\/legacy-art\.test\.mjs/i);
});

test('retirement gate matches the failure file as well as its assertion name', () => {
  const events = exactEvents();
  events[0].file = differentFile;

  const result = verifyRetirementGate({ ledger, events, repoRoot });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /missing ledger failure/i);
  assert.match(result.errors.join('\n'), /unexpected failure/i);
});

test('retirement gate rejects skipped, cancelled, or todo tests', () => {
  for (const key of ['skipped', 'cancelled', 'todo']) {
    const events = exactEvents();
    events.at(-1).counts[key] = 1;
    const result = verifyRetirementGate({ ledger, events, repoRoot });
    assert.equal(result.ok, false, `${key} must block release`);
    assert.match(result.errors.join('\n'), new RegExp(`${key}.*must be 0`, 'i'));
  }
});

test('retirement gate rejects missing or inconsistent aggregate summaries', () => {
  const missing = verifyRetirementGate({ ledger, events: exactEvents().slice(0, 1), repoRoot });
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join('\n'), /aggregate test summary is missing/i);

  const inconsistentEvents = exactEvents();
  inconsistentEvents.at(-1).counts.failed = 2;
  const inconsistent = verifyRetirementGate({ ledger, events: inconsistentEvents, repoRoot });
  assert.equal(inconsistent.ok, false);
  assert.match(inconsistent.errors.join('\n'), /summary failed count 2 does not match observed failures 1/i);
});

test('Vercel uses the ledger-checked release suite without weakening raw npm test', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts.test, 'node --test tests/*.test.mjs tests/projectile-pool.test.mjs');
  assert.equal(packageJson.scripts['test:release'], 'node scripts/hmh-reboot-test-retirement-gate.mjs');
  assert.match(packageJson.scripts['vercel:build'], /npm run test:release/);
  assert.doesNotMatch(packageJson.scripts['vercel:build'], /(?:^|&&\s*)npm test(?:\s*&&|$)/);
});
