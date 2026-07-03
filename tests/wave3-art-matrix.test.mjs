import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  buildWave3ArtMatrixReport,
  buildWave3ArtMatrixMarkdown,
} from '../apps/portal/src/wave3-art-matrix.mjs';

test('Wave 3 art matrix gates full hero state-direction coverage and enemy readability states', () => {
  const report = buildWave3ArtMatrixReport();

  assert.equal(report.policy.legacyFallbacksAllowed, false);
  assert.deepEqual(report.policy.disallowedFallbacks, ['still-only-runtime', 'rectangle-fallback', 'cross-character-roster-swap', 'legacy-combatArt-enemies']);
  assert.equal(report.heroes.summary.totalCells, 4 * 8 * 8);
  assert.equal(report.heroes.summary.missingCells, 0);
  assert.equal(report.heroes.rows.every((row) => row.complete === true), true);
  assert.equal(report.heroes.rows.find((row) => row.actorId === 'lester' && row.state === 'shoot').directions.length, 8);

  assert.equal(report.enemies.summary.requiredActorCount >= 16, true);
  assert.equal(report.enemies.summary.missingStateCells, 0);
  assert.equal(report.enemies.rows.every((row) => row.complete === true), true);
  assert.equal(report.enemies.rows.some((row) => row.state === 'attack-tell'), true);
  assert.equal(report.gates.every((gate) => gate.status === 'pass'), true);
});

test('Wave 3 art matrix report script and docs artifacts stay wired into project gates', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['design:wave3-art'], 'node scripts/write-wave3-art-matrix-report.mjs');

  const markdown = buildWave3ArtMatrixMarkdown(buildWave3ArtMatrixReport());
  assert.match(markdown, /# Hard Money Heroes Wave 3 Art Matrix/);
  assert.match(markdown, /Legacy fallback policy/);
  assert.match(markdown, /Hero matrix/);
  assert.match(markdown, /Enemy readability matrix/);

  assert.equal(existsSync(new URL('../docs/game-design/hard-money-heroes-wave3-art-matrix.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../docs/game-design/hard-money-heroes-wave3-art-matrix.json', import.meta.url)), true);
});
