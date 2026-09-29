// Run under the shared heavy lock; all repetitions are fresh processes.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { assessReplaySamples, parseReplaySample, currentSourceHashes, loadMaximalFixture, sourceRoot, STACKED_BENCHMARK_PHASES, withReplayHeavyLock } from './lib/stacked-replay-benchmark.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const found = args.find(arg => arg.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
for (const arg of args) if (!/^--(?:samples|out|owned-lock-token)=/.test(arg)) throw new Error(`unknown argument: ${arg}`);
const count = Number(option('samples', 7));
if (!Number.isInteger(count) || count < 5 || count > 30) throw new Error('samples must be 5..30; no fastest-of retry policy');
const out = resolve(sourceRoot, option('out', 'docs/2.0/slices/STACKED-S0-baseline.json'));
const perform = async () => {
  const { fixture } = loadMaximalFixture();
  const samples = [];
  for (let index = 0; index < count; index += 1) for (const phase of STACKED_BENCHMARK_PHASES) {
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('./stacked-replay-benchmark-sample.mjs', import.meta.url)), phase], { cwd: sourceRoot, encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    samples.push(parseReplaySample(child, { index, phase, fixture }));
  }
  const assessment = assessReplaySamples(samples, count);
  const report = { v: 'stacked-replay-benchmark-v1', measuredAt: new Date().toISOString(), policy: 'all fresh-process first-use observations below 250 ms; no retries or hidden fastest samples', samplesPerPhase: count, fixtureEvidenceSha256: fixture.evidence.sha256, sourceHashes: currentSourceHashes(), ...assessment };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ report: out, passed: report.passed, budgetMs: report.budgetMs, phases: report.phases }) + '\n');
  if (!report.passed) process.exitCode = 1;
};

// A coordinated fixture-generation batch may already own the lock. An explicit
// token must match the real owner; there is no unlocked command-line mode.
const ownedToken = option('owned-lock-token', null);
if (ownedToken) {
  const { readFileSync } = await import('node:fs');
  const owner = JSON.parse(readFileSync(join(sourceRoot, '../.locks/heavy.lock/owner.json'), 'utf8'));
  if (owner.token !== ownedToken) throw new Error('shared heavy lock token mismatch');
  await perform();
} else await withReplayHeavyLock(perform);
