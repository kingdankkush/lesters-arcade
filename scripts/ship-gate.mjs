import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gates = [
  'design:tokens',
  'docs:links',
  'assets:hmh:curated-level-kit-runtime',
  'assets:verify',
  'assets:qa',
  'test',
  'check',
  'contracts:check',
  'contracts:test',
  'contracts:slither',
  'design:art-census',
  'design:hero-cert',
  'design:combat-feedback',
  'design:boss-balance',
  'design:audio-system',
  'design:balance',
  'design:long-run',
  'design:playtest-sweep',
  'design:load-speed',
  'design:device-input',
  'design:security-audit',
  'design:web3-audit',
  'smoke:portal',
  'smoke:portal:interactions',
  'visual:regression',
  'profile:wo71',
  'build',
  'repo:health:strict',
];

const started = Date.now();
for (const gate of gates) {
  console.log(`\n=== SHIP GATE: npm run ${gate} ===`);
  const result = spawnSync(npm, ['run', gate], { cwd: repoRoot, stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    console.error(`\nSHIP GATE FAILED at ${gate} after ${Math.round((Date.now() - started) / 1000)}s.`);
    process.exit(result.status || 1);
  }
}
console.log(`\nSHIP GATE PASSED in ${Math.round((Date.now() - started) / 1000)}s.`);
