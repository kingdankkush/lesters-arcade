import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  GATE_REPORT_RELATIVE_PATH,
  buildGateReport,
  verifyRetirementGate,
} from '../scripts/hmh-reboot-test-retirement-gate.mjs';

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

test('gate report keeps the failure diagnosis, which stderr alone did not survive piping', () => {
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

  const report = buildGateReport(verifyRetirementGate({ ledger, events, repoRoot }));
  assert.equal(report.status, 'FAIL');
  assert.equal(report.gate, 'hmh-reboot-test-retirement');
  assert.match(report.errors.join('\n'), /unexpected failure.*new runtime regression/i);
});

test('gate report records the passing counts a promote decision is made from', () => {
  const report = buildGateReport(verifyRetirementGate({ ledger, events: exactEvents(), repoRoot }));
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.errors, []);
  assert.equal(report.expectedFailureCount, 1);
  assert.equal(report.counts.tests, 2);
  assert.equal(report.counts.passed, 1);
});

test('gate report survives the failure modes that leave no aggregate summary', () => {
  // Child exit status, non-empty stderr, and termination by signal all report
  // FAIL with no summary event. That is precisely when the reasons matter, so
  // building the report must not throw on the missing counts.
  const noSummary = buildGateReport(verifyRetirementGate({ ledger, events: exactEvents().slice(0, 1), repoRoot }));
  assert.equal(noSummary.status, 'FAIL');
  assert.equal(noSummary.counts, null);
  assert.match(noSummary.errors.join('\n'), /aggregate test summary is missing/i);

  const empty = buildGateReport({});
  assert.equal(empty.status, 'FAIL');
  assert.equal(empty.counts, null);
  assert.equal(empty.expectedFailureCount, null);
  assert.deepEqual(empty.errors, []);
});

test('gate report is written where the other release evidence lives', () => {
  assert.equal(GATE_REPORT_RELATIVE_PATH, 'docs/testing/hmh-reboot-test-retirement-gate.json');
});

test('Vercel uses the ledger-checked release suite without weakening raw npm test', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const gateSource = await readFile(new URL('../scripts/hmh-reboot-test-retirement-gate.mjs', import.meta.url), 'utf8');
  assert.equal(packageJson.scripts.test, 'node --test tests/*.test.mjs tests/projectile-pool.test.mjs');
  assert.equal(packageJson.scripts['test:release'], 'node scripts/hmh-reboot-test-retirement-gate.mjs');
  assert.match(packageJson.scripts['vercel:build'], /npm run test:release/);
  assert.doesNotMatch(packageJson.scripts['vercel:build'], /(?:^|&&\s*)npm test(?:\s*&&|$)/);
  assert.match(gateSource, /--test-concurrency=1/, 'release suite must serialize test files so CPU timing assertions are not distorted by shared CI cores');
});
