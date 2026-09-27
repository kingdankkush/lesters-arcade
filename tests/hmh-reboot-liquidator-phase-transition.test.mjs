import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// S1.5: the Liquidator's phases change at HP thresholds, each with a 90-tick
// Trading Halt. The phase beat is projection only: a 45-tick swell from the
// halt's first tick.
const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const haltBeat = (tick, haltFrom) => (haltFrom >= 0 ? Math.max(0, 45 - (tick - haltFrom)) / 250 : 0);

test('the halt beat is deterministic, bounded and over within 45 ticks', () => {
  assert.equal(haltBeat(1_000, -1), 0, 'no halt, no beat');
  assert.equal(haltBeat(1_000, 1_000), 0.18);
  assert.equal(haltBeat(1_044, 1_000), 0.004);
  assert.equal(haltBeat(1_045, 1_000), 0);
  assert.equal(haltBeat(9_999, 1_000), 0);
});

test('the runtime projects the phase beat through boss visuals only', async () => {
  const source = await readFile(mainUrl, 'utf8');
  assert.match(source, /const bossHaltBeat = liquidatorBoss\.haltFrom >= 0 \? Math\.max\(0, 45 - \(bossVisualTick - liquidatorBoss\.haltFrom\)\) \/ 250 : 0;/);
  assert.match(source, /bossVisual\.scale\.set\([^\n]*\(1 \+ bossHaltBeat\)\)/);
  assert.match(source, /const bossLabel = new Text/);
  assert.match(source, /const bossBarY = view\.width < 560 \? 292 : 124/);
  assert.match(source, /bossLabel\.text = `\$\{bossHud\.name\.toUpperCase\(\)\} \/\/ \$\{bossHud\.phaseId\.replaceAll\('-', ' '\)\.toUpperCase\(\)\}`/);
  assert.doesNotMatch(source, /bossVisual\.alpha[^\n]*lastBossStep/);
  assert.doesNotMatch(source, /Math\.max\(0, 45[^\n]*(damage|collision|health|attackCooldown|spawn)/i);
});

test('phase changes and tells are silent; the caption setting still names the halt', async () => {
  const source = await readFile(mainUrl, 'utf8');
  assert.doesNotMatch(source, /combatAudio\.play\('boss-phase'/);
  assert.match(source, /event\.type === 'tell' \|\| event\.type === 'halt'/);
  assert.match(source, /trading halt, \$\{event\.phaseId\.replaceAll\('-', ' '\)\}/);
});
