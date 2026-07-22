import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildCombatOptionsMenuModel,
  buildGameOverSummaryModel,
} from '../apps/portal/src/arcade-core.mjs';

const repoFile = (relative) => readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');

test('disabled settlement renders a canonical preview without publish actions', () => {
  const session = { isPaid: true, mode: 'paid', leaderboardEligible: true };
  const summary = buildGameOverSummaryModel({
    session,
    score: 1234,
    elapsedSeconds: 90,
    kills: 12,
    settlementLive: false,
  });
  assert.equal(summary.state, 'ranked-preview-saved');
  assert.equal(summary.title, 'Ranked Preview Saved');
  assert.equal(summary.settlement.status, 'verified-preview');
  assert.equal(summary.actions.some((action) => action.id === 'submit-official-score'), false);
  assert.match(summary.trackingCopy, /No transaction was sent/);

  const menu = buildCombatOptionsMenuModel({
    gameOver: true,
    currentMode: 'paid',
    officialSubmissionEnabled: false,
  });
  assert.equal(menu.actions.some((action) => action.id === 'submit-official-score'), false);
  assert.match(menu.copy, /Verified publishing is disabled/);
});

test('production source has no simulated transaction fallback', () => {
  const main = repoFile('apps/portal/main.js');
  assert.equal(main.includes('Official score recorded (simulated settlement'), false);
  assert.match(main, /if \(!SETTLEMENT_LIVE\)/);
  assert.match(main, /Canonical Ranked preview saved locally/);
});

test('brand tokens load before portal styles and public metadata is truthful', () => {
  const html = repoFile('apps/portal/index.html');
  const tokensAt = html.indexOf('src/design-tokens.css');
  const stylesAt = html.indexOf('styles.css');
  assert.ok(tokensAt > 0 && tokensAt < stylesAt);
  assert.equal(html.includes('automatically submitted on-chain'), false);
  assert.match(html, /verified on-chain publishing remains disabled/i);
});

test('fixed-step runtime recovers rare long frames without an unbounded catch-up spiral', () => {
  const main = repoFile('apps/portal/main.js');
  assert.match(main, /const MAX_FIXED_STEPS_PER_FRAME = 4;/);
  assert.match(main, /const FIXED_STEP_MS = 1000 \/ LESTER_BLASTER_PERFORMANCE_TARGETS\.targetFps;/);
});

test('fullscreen auto-entry is persisted and uses the READY user gesture', () => {
  const main = repoFile('apps/portal/main.js');
  assert.match(main, /autoEnterFullscreen: true/);
  assert.match(main, /id: 'auto-fullscreen'/);
  assert.match(main, /waitForPlayerReady/);
  assert.match(main, /void requestCombatFullscreen\(\)\.catch\(/, 'READY must not await a fullscreen promise that can remain pending');
  assert.match(main, /const target = dom\.officialGameplay \?\? dom\.officialCombatMount \?\? dom\.combatCanvas/, 'fullscreen must contain HUD, canvas, and game controls');
  assert.match(main, /\(dom\.officialGameplay \?\? document\.body\)\.append\(layer\)/, 'touch controls must live inside the fullscreen gameplay subtree');
  assert.match(main, /finally \{\s*cleanup\(\);\s*\}/, 'fullscreen rejection must never strand the READY overlay');
  assert.match(main, /Add to Home Screen/);
  assert.match(main, /event\.altKey && key === 'enter'/);
});
