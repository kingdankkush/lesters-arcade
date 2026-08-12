import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const PHASE_DURATION_TICKS = 1_200;
const phaseScale = (elapsedTick) => 1 + Number(elapsedTick < 2_445) * Math.max(0, 45 - (elapsedTick % PHASE_DURATION_TICKS)) / 250;

test('Liquidator phase-transition scale is deterministic and bounded', () => {
  assert.equal(phaseScale(0), 1.18);
  assert.equal(phaseScale(44), 1.004);
  assert.equal(phaseScale(45), 1);
  assert.equal(phaseScale(PHASE_DURATION_TICKS), 1.18);
  assert.equal(phaseScale(PHASE_DURATION_TICKS + 22), 1.092);
  assert.equal(phaseScale(PHASE_DURATION_TICKS + 45), 1);
  assert.equal(phaseScale((PHASE_DURATION_TICKS * 2) + 44), 1.004);
  assert.equal(phaseScale(PHASE_DURATION_TICKS * 3), 1);
  assert.equal(phaseScale(PHASE_DURATION_TICKS * 4), 1);
});

test('the runtime projects the phase beat through boss visuals only', async () => {
  const source = await readFile(mainUrl, 'utf8');
  assert.match(source, /const bossPhaseTick = lastBossStep\?\.elapsedTick \?\? 45/);
  assert.match(source, /bossVisual\.scale\.set\([^\n]*bossPhaseTick < 2_445 && Math\.max\(0, 45 - \(bossPhaseTick % 1_200\)\) \/ 250/);
  assert.match(source, /const bossLabel = new Text/);
  assert.match(source, /const bossBarY = view\.width < 560 \? 292 : 124/);
  assert.match(source, /bossLabel\.text = `THE LIQUIDATOR \/\/ \$\{liquidatorBoss\.phaseId\.replaceAll\('-', ' '\)\.toUpperCase\(\)\}`/);
  assert.doesNotMatch(source, /bossVisual\.alpha[^\n]*lastBossStep/);
  assert.doesNotMatch(source, /Math\.max\(0, 45[^\n]*(damage|collision|health|attackCooldown|spawn)/i);
});

test('phase audio consumes one-shot arena-change events instead of polling elapsed ticks', async () => {
  const source = await readFile(mainUrl, 'utf8');
  assert.match(source, /event\.type === 'arena-change'[^\n]*combatAudio\.play\('boss-phase'/);
  assert.doesNotMatch(source, /bossPhaseTick[^\n]*combatAudio\.play/);
});
