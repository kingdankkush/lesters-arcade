import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const RETIREMENT_LEDGER_SCHEMA = 'hmh-reboot-legacy-test-retirement-v1';

function normalizeAssertion(value) {
  return String(value ?? '').replace(/\s+\(\d+(?:\.\d+)?ms\)$/, '').trim();
}

function normalizeFile(value, repoRoot) {
  const absolute = path.resolve(String(value ?? ''));
  const relative = path.relative(path.resolve(repoRoot), absolute).replaceAll('\\', '/');
  return relative;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function failureKey(file, assertion) {
  return `${file} :: ${assertion}`;
}

export function verifyRetirementGate({ ledger, events, repoRoot = process.cwd() }) {
  const errors = [];
  const expected = new Map();
  const observed = new Map();
  const failures = Array.isArray(ledger?.failures) ? ledger.failures : [];

  if (ledger?.schema !== RETIREMENT_LEDGER_SCHEMA) {
    errors.push(`unsupported retirement ledger schema: ${ledger?.schema ?? '<missing>'}`);
  }
  if (!Array.isArray(ledger?.failures)) {
    errors.push('retirement ledger failures must be an array');
  }
  if (ledger?.summary?.fail != null && ledger.summary.fail !== failures.length) {
    errors.push(`ledger summary fail count ${ledger.summary.fail} does not match ledger failures ${failures.length}`);
  }

  for (const entry of failures) {
    const file = String(entry?.file ?? '').replaceAll('\\', '/');
    const assertion = normalizeAssertion(entry?.assertion);
    if (!file || !assertion) {
      errors.push('retirement ledger contains an entry without file or assertion');
      continue;
    }
    const key = failureKey(file, assertion);
    increment(expected, key);
    if (expected.get(key) > 1) errors.push(`duplicate ledger failure: ${key}`);
  }

  const observedFailureEvents = (events ?? []).filter((event) => event?.type === 'test:fail');
  for (const event of observedFailureEvents) {
    const file = normalizeFile(event.file, repoRoot);
    const assertion = normalizeAssertion(event.name);
    const key = failureKey(file, assertion);
    increment(observed, key);
    if (event.detailsType !== 'test' || event.nesting !== 0) {
      errors.push(`unexpected non-top-level test failure: ${key}`);
    }
  }

  for (const [key, count] of expected) {
    const actual = observed.get(key) ?? 0;
    for (let index = actual; index < count; index += 1) errors.push(`missing ledger failure: ${key}`);
  }
  for (const [key, count] of observed) {
    const allowed = expected.get(key) ?? 0;
    for (let index = allowed; index < count; index += 1) errors.push(`unexpected failure: ${key}`);
  }

  const aggregateSummaries = (events ?? []).filter((event) => event?.type === 'test:summary' && !event.file);
  if (aggregateSummaries.length !== 1) {
    errors.push(`aggregate test summary is missing or ambiguous: found ${aggregateSummaries.length}`);
  } else {
    const summary = aggregateSummaries[0];
    const counts = summary.counts ?? {};
    if (counts.failed !== observedFailureEvents.length) {
      errors.push(`summary failed count ${counts.failed ?? '<missing>'} does not match observed failures ${observedFailureEvents.length}`);
    }
    for (const key of ['cancelled', 'skipped', 'todo']) {
      if (counts[key] !== 0) errors.push(`${key} test count must be 0, received ${counts[key] ?? '<missing>'}`);
    }
    if (!Number.isInteger(counts.tests) || counts.tests <= 0) errors.push('summary test count must be a positive integer');
    if (!Number.isInteger(counts.passed) || counts.passed <= 0) errors.push('summary passed count must be a positive integer');
    if (failures.length > 0 && summary.success !== false) errors.push('aggregate summary must report failure when ledgered tests fail');
  }

  return {
    ok: errors.length === 0,
    errors,
    expectedFailureCount: failures.length,
    observedFailureCount: observedFailureEvents.length,
    summary: aggregateSummaries[0] ?? null,
  };
}

export function runRetirementGate({ repoRoot = process.cwd() } = {}) {
  const ledgerPath = path.join(repoRoot, 'docs', 'hmh-reboot', 'LEGACY-TEST-RETIREMENT.json');
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const testsDir = path.join(repoRoot, 'tests');
  const testFiles = readdirSync(testsDir)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => path.join('tests', name));
  const reporter = './scripts/hmh-reboot-test-retirement-reporter.mjs';
  const child = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`, ...testFiles], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const parseErrors = [];
  const events = [];
  for (const [index, line] of String(child.stdout ?? '').split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      parseErrors.push(`reporter line ${index + 1} is not JSON: ${error.message}`);
    }
  }

  const result = verifyRetirementGate({ ledger, events, repoRoot });
  result.errors.push(...parseErrors);
  if (child.error) result.errors.push(`test process failed to start: ${child.error.message}`);
  if (child.signal) result.errors.push(`test process terminated by signal ${child.signal}`);
  if (child.status !== 1) result.errors.push(`raw test process exit must be 1 for the ledgered suite, received ${child.status}`);
  if (String(child.stderr ?? '').trim()) result.errors.push(`test reporter stderr was not empty: ${String(child.stderr).trim()}`);
  result.ok = result.errors.length === 0;

  if (result.ok) {
    const counts = result.summary.counts;
    console.log(`HMH_REBOOT_TEST_RETIREMENT_GATE PASS tests=${counts.tests} passed=${counts.passed} expected_failures=${result.expectedFailureCount}`);
    return 0;
  }

  console.error('HMH_REBOOT_TEST_RETIREMENT_GATE FAIL');
  for (const error of result.errors) console.error(`- ${error}`);
  return 1;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) process.exitCode = runRetirementGate();
