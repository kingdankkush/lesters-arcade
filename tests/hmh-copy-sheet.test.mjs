import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_COPY_SHEET,
  collectHmhCopyTexts,
  hmhCopy,
  validateHmhCopySheet,
} from '../apps/portal/src/hmh-copy-sheet.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-30 copy sheet validates concise player-facing copy', () => {
  const validation = validateHmhCopySheet();
  assert.equal(validation.ok, true, validation.gaps.join('\n'));
  assert.ok(validation.textCount >= 30);
  assert.ok(validation.surfaceCount >= 5);
});

test('WO-30 copy avoids stale paid/prototype framing and em dashes', () => {
  const texts = collectHmhCopyTexts();
  for (const entry of texts) {
    assert.equal(entry.text.includes('—'), false, `${entry.path} contains an em dash`);
    assert.equal(/\bpaid\b/i.test(entry.text), false, `${entry.path} says paid`);
    assert.equal(/\bprototype\b/i.test(entry.text), false, `${entry.path} says prototype`);
  }
});

// ranked-onboarding (2026-09-26): Ranked is no longer free on testnet. The line names the
// ranked-facts.mjs price and the faucet instead of the old "free, gas only" wording.
test('WO-30 official testnet mode copy is explicit about the price and the faucet', () => {
  const copy = hmhCopy('modeSelect.ranked.copy');
  assert.match(copy, /^Ranked costs 0\.012 testnet zkLTC per run\./);
  assert.match(copy, /free from the LiteForge faucet/i);
  assert.doesNotMatch(copy, /Free on testnet|zkLTC gas/i);
  assert.equal(copy.includes('real funds'), false);
  assert.equal(hmhCopy('modeSelect.free.copy'), 'Free play needs no wallet and never touches the chain. It costs nothing, and runs are not ranked.');
});

test('WO-30 source wiring consumes the copy sheet in runtime-visible surfaces', () => {
  const arcadeCore = repoText('apps/portal/src/arcade-core.mjs');
  const main = repoText('apps/portal/main.js');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(arcadeCore.includes("./hmh-copy-sheet.mjs"), true);
  assert.equal(arcadeCore.includes('HMH_COPY_SHEET.modeSelect.free.copy'), true);
  assert.equal(arcadeCore.includes('HMH_COPY_SHEET.modeSelect.ranked.copy'), true);
  assert.equal(main.includes("./src/hmh-copy-sheet.mjs"), true);
  assert.equal(main.includes('HMH_COPY_SHEET.readyOverlay.hint'), true);
  assert.equal(main.includes('HMH_COPY_SHEET.combatStatus.runLive'), true);
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-copy-sheet.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-copy-sheet.test.mjs'), true);
});

test('WO-30 copy sheet includes all declared surfaces with approved text', () => {
  const ids = HMH_COPY_SHEET.surfaces.map((surface) => surface.id);
  assert.deepEqual(ids, ['mode-free', 'mode-ranked', 'level-intro-goal', 'ready-hint', 'combat-live-status']);
  for (const surface of HMH_COPY_SHEET.surfaces) {
    assert.ok(surface.file.startsWith('apps/portal/'));
    assert.ok(surface.text.length > 20);
  }
});
