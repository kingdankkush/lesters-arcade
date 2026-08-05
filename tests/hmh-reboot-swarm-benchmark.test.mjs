import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const benchmark = JSON.parse(readFileSync(
  fileURLToPath(new URL('../docs/qa/hmh-weapon-benchmark.json', import.meta.url)),
  'utf8',
));

// C6. The benchmark covered static and moving SINGLE targets, so every balance
// question about crowds -- which weapon actually clears a pack, how much
// damage the launcher wastes on small enemies, whether spread is worth its
// reload -- had no evidence behind it. The handoff calls this the missing
// input for S1 and S5.
const WEAPONS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig']);

test('the benchmark declares its swarm parameters', () => {
  assert.ok(benchmark.schemaVersion >= 3, `schemaVersion ${benchmark.schemaVersion} predates the swarm pass`);
  assert.ok(Array.isArray(benchmark.swarmRows), 'swarmRows missing');
  assert.ok(benchmark.swarm, 'swarm parameter block missing');
  assert.ok(benchmark.swarm.packSizes.length >= 2, 'need more than one pack size to see scaling');
  assert.ok(benchmark.swarm.enemyHealth > 0);
  assert.ok(benchmark.swarm.spacing > 0);
});

test('every weapon and tier is measured against every pack size', () => {
  const seen = new Set(benchmark.swarmRows.map((row) => `${row.weaponId}:${row.tier}:${row.packSize}`));
  for (const weaponId of WEAPONS) {
    for (const tier of ['base', 'maxed']) {
      for (const packSize of benchmark.swarm.packSizes) {
        assert.ok(seen.has(`${weaponId}:${tier}:${packSize}`), `missing swarm row ${weaponId}/${tier}/${packSize}`);
      }
    }
  }
});

test('swarm rows carry the metrics a balance decision needs', () => {
  for (const row of benchmark.swarmRows) {
    assert.ok(Number.isInteger(row.packSize) && row.packSize > 0, 'packSize');
    assert.ok(Number.isInteger(row.killed) && row.killed >= 0 && row.killed <= row.packSize, `${row.weaponId} killed ${row.killed}/${row.packSize}`);
    assert.ok(Number.isFinite(row.damageApplied) && row.damageApplied >= 0, 'damageApplied');
    // Overkill is the point of the pack test: damage landed on an enemy that
    // was already dead is wasted, and it is how a launcher looks strong on
    // paper while clearing slowly.
    assert.ok(Number.isFinite(row.overkillDamage) && row.overkillDamage >= 0, 'overkillDamage');
    assert.ok(row.overkillRatio >= 0 && row.overkillRatio <= 1, `${row.weaponId} overkillRatio ${row.overkillRatio}`);
    assert.ok(Number.isInteger(row.projectilesEmitted) && row.projectilesEmitted >= 0, 'projectilesEmitted');
    assert.ok(Number.isFinite(row.contactsPerProjectile) && row.contactsPerProjectile >= 0, 'contactsPerProjectile');
    // Null means the pack was never cleared inside the window, which is itself
    // a finding and must be representable rather than coerced to a number.
    assert.ok(
      row.clearSeconds === null || (Number.isFinite(row.clearSeconds) && row.clearSeconds > 0),
      `${row.weaponId} clearSeconds ${row.clearSeconds}`,
    );
    assert.ok(
      row.timeToFirstKillSeconds === null || row.timeToFirstKillSeconds > 0,
      'timeToFirstKillSeconds',
    );
  }
});

// A benchmark that reports the same number for every weapon measures nothing.
test('the swarm benchmark actually separates the weapons', () => {
  for (const packSize of benchmark.swarm.packSizes) {
    const rows = benchmark.swarmRows.filter((row) => row.tier === 'base' && row.packSize === packSize);
    const kills = new Set(rows.map((row) => row.killed));
    const overkill = new Set(rows.map((row) => row.overkillRatio));
    assert.ok(
      kills.size > 1 || overkill.size > 1,
      `at pack size ${packSize} every weapon reports identical swarm performance`,
    );
  }
});

// Multi-target weapons should show it here or the metric is not measuring what
// it claims. Spread and blast both put one trigger pull onto several bodies.
test('spread and blast weapons register multi-target contact', () => {
  for (const weaponId of ['scatter-shotgun', 'launcher-rig']) {
    const rows = benchmark.swarmRows.filter((row) => row.weaponId === weaponId && row.packSize === Math.max(...benchmark.swarm.packSizes));
    assert.ok(rows.length > 0, `${weaponId} has no largest-pack row`);
    assert.ok(
      rows.some((row) => row.contactsPerProjectile > 0),
      `${weaponId} never contacted a swarm target`,
    );
  }
});

test('the swarm pass is deterministic and says so', () => {
  assert.equal(benchmark.swarm.deterministic, true, 'the swarm pass must be drift-checked like the rest');
  assert.ok(typeof benchmark.swarm.note === 'string' && benchmark.swarm.note.length > 20);
});
