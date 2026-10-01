// The real HMH child, headless, in the unofficial ten-area Free world: cover
// and a district boss fight through the actual fixed-step tick (slice
// HMH-TEN-AREA-GAMEPLAY-WIRING). Each scenario boots main.mjs in its own
// process through scripts/hmh-ten-area-wiring-probe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const probe = fileURLToPath(new URL('../scripts/hmh-ten-area-wiring-probe.mjs', import.meta.url));
const run = (scenario, frames, env = {}) => JSON.parse(execFileSync(process.execPath, ['--max-old-space-size=3072', probe, scenario, String(frames)], {
  encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'ignore'], timeout: 300_000,
}).trim().split('\n').at(-1));

test('cover: the hero walks to a tall face, enters, peeks and leaves inside the real tick', () => {
  const result = run('cover', 4_000);
  assert.deepEqual(result.errors, []);
  assert.equal(result.runSummaries, 0, 'an unofficial world sends no run summary');
  assert.equal(result.traversalMarkers, 12);
  assert.ok(result.cover.enters >= 1);
  assert.ok(result.cover.coverTicks > 900);
  for (const pose of ['cover-enter', 'cover-peek-fire']) assert.ok(result.cover.poses.includes(pose), pose);
  assert.equal(result.cover.phase, 'free', 'the hero stepped back out');
});

test('court: the Rug Pull Baron spawns past his threshold, seals the court, phases, dies, drops his Seal and reopens the court', () => {
  const result = run('court:rug-pull-baron', 6_000);
  assert.deepEqual(result.errors, []);
  assert.equal(result.boss.firstLiveTick, 120, 'the evidence court is ready at tick 120');
  assert.equal(result.boss.lockedAtTick, 120);
  assert.deepEqual(result.boss.phases, ['grand-opening', 'the-rug-pull', 'curtain-call']);
  assert.ok(result.boss.defeatedTick > 120 && result.boss.defeatedTick < 6_000);
  assert.equal(result.boss.opened, true);
  assert.deepEqual(result.boss.seals, [{ bossId: 'rug-pull-baron', x: 6_600, y: 12_650, arenaId: 'hashwood-river-court' }]);
});

test('ledge: the hero mantles a derived climb (18 locked ticks) and drops a derived ledge (6 landing ticks)', () => {
  const result = run('ledge', 2_000);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.traversal, { climbId: 'mweb-meadows-climb-intent', mantles: 1, drops: 1, mantleTicks: 18, landTicks: 6 });
});
