import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildRosterCoverageReport,
  renderRosterCoverageMarkdown,
} from '../scripts/roster-coverage-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function buildReport() {
  return buildRosterCoverageReport({ repoRoot: ROOT });
}

test('roster coverage report inventories every actor and reflects the native critical animation pass', () => {
  const report = buildReport();

  assert.ok(report.summary.actorCount >= 37, `expected current animated roster actor count, got ${report.summary.actorCount}`);
  assert.equal(report.summary.zeroAnimationActorCount, 0);
  assert.equal(report.actors.lester.states.dash.status, 'complete');
  assert.equal(report.actors.lester.states.victory.status, 'complete');
  assert.equal(report.actors['gas-beast-tank'].summary.status, 'complete');
  assert.equal(report.actors['crypto-bro-rusher'].summary.status, 'complete');
  assert.equal(report.actors['liquidation-cascade-golem'].summary.status, 'complete');
  assert.equal(report.actors['chain-reaper-boss'].summary.status, 'complete');
  assert.equal(report.actors['bit-whale-boss'].summary.status, 'complete');
  assert.equal(report.actors['warren-spear-rider'].summary.status, 'complete');
  assert.equal(report.actors['fud-goblin'].states['attack-tell'].directionCount, 8);
  assert.equal(report.actors['fud-goblin'].states['attack-tell'].status, 'complete');
});

test('runtime-derived readability remains marked for actors that are not yet native-promoted', () => {
  const report = buildReport();

  for (const actorKey of ['fud-goblin', 'gas-fee-wisp']) {
    const spawn = report.actors[actorKey].states['spawn-in'];
    assert.equal(spawn.status, 'complete', `${actorKey} should have a complete native spawn-in state`);
    assert.equal(spawn.derived, false, `${actorKey} spawn-in should now be native, not derived`);
    assert.doesNotMatch(spawn.matchedState, /^derived:/, `${actorKey} should not report native art as derived`);
  }

  for (const actorKey of ['coyote-pack-runner', 'wild-boar', 'buzzard', 'rattlesnake']) {
    const spawn = report.actors[actorKey].states['spawn-in'];
    assert.equal(spawn.status, 'complete', `${actorKey} should have a complete runtime spawn-in state`);
    assert.equal(spawn.derived, true, `${actorKey} spawn-in should be explicitly marked as derived runtime readability`);
    assert.match(spawn.matchedState, /^derived:/, `${actorKey} should not pretend derived spawn art is native`);
  }

  const slippageTell = report.actors['slippage-skater'].states['attack-tell'];
  assert.equal(slippageTell.status, 'complete');
  assert.equal(slippageTell.derived, true);
  assert.match(slippageTell.matchedState, /^derived:/);
});

test('Level 1 ship-scope rows are derived from runtime catalog and boss proxy data', () => {
  const report = buildReport();
  const ids = new Set(report.levelOneShipScope.map((row) => row.enemyId));
  const actorKeys = new Set(report.levelOneShipScope.map((row) => row.actorKey));

  assert.ok(ids.has('claim-jumper'));
  assert.ok(ids.has('gas-beast'));
  assert.ok(ids.has('bandit-captain'));
  assert.ok(actorKeys.has('gas-beast-tank'), 'boss proxy gas-beast-tank should be in the ship-scope matrix');
  assert.ok(actorKeys.has('evil-banker-ranged'), 'boss proxy evil-banker-ranged should be in the ship-scope matrix');
  assert.equal(report.scopeRuling.recommendedKeep.includes('gas-beast-tank'), true);
  assert.equal(report.scopeRuling.deferred.includes('chain-reaper-boss'), true);
});

test('Lester splinter directories were vaulted and are no longer referenced by the manifest', () => {
  const report = buildReport();

  assert.deepEqual(report.fragmentation.lester.splinterDirs, []);
  assert.equal(report.fragmentation.lester.manifestReferencesSplinterDirs.length, 0);
  assert.equal(report.fragmentation.lester.recommendation, 'clean');
});

test('coverage markdown renders the Wave 3 scoreboard and scope ruling', () => {
  const report = buildReport();
  const markdown = renderRosterCoverageMarkdown(report);

  assert.match(markdown, /^# Hard Money Heroes Roster Coverage/m);
  assert.match(markdown, /## Level 1 ship-scope actor ruling/m);
  assert.match(markdown, /gas-beast-tank/);
  assert.match(markdown, /fud-goblin/);
  assert.match(markdown, /dash/);
});

test('generated coverage document exists after running the report script', () => {
  assert.equal(existsSync(path.join(ROOT, 'docs/art/ROSTER_COVERAGE.md')), true);
});
