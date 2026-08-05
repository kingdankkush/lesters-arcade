import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  RUN_UPGRADE_CATALOG,
  createRunProgression,
  getRunProgressionSnapshot,
  recordRunDefeat,
  selectRunUpgrade,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import {
  buildRunResultMessages,
  createRunScoreChecksum,
  getWeb3AdapterStatus,
} from '../apps/hmh-reboot/src/run-adapters.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function cloneProgression(seed = 1234) {
  return createRunProgression({ seed });
}

test('run progression is deterministic, bounded, and exposes two concrete upgrade choices', () => {
  const first = cloneProgression();
  const second = cloneProgression();
  for (let index = 0; index < 3; index += 1) {
    assert.deepEqual(
      recordRunDefeat(first, { enemyId: `enemy-${index}`, threatCost: 4, tick: index + 1 }),
      recordRunDefeat(second, { enemyId: `enemy-${index}`, threatCost: 4, tick: index + 1 }),
    );
  }
  const snapshot = getRunProgressionSnapshot(first);
  assert.ok(snapshot.score > 0);
  assert.ok(snapshot.xp > 0);
  assert.ok(snapshot.level >= 2);
  assert.equal(snapshot.pendingChoices.length, 2);
  assert.equal(new Set(snapshot.pendingChoices.map((choice) => choice.id)).size, 2);
  assert.ok(snapshot.pendingChoices.every((choice) => Object.isFrozen(choice)));
});

test('skill tree has nine core upgrades plus repeatable mastery picks and applies only offered choices', () => {
  const core = Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => upgrade.repeatable !== true);
  const repeatable = Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => upgrade.repeatable === true);
  // Seven core: the mobility branch gained a movement-speed pick, which was
  // the only branch with a single upgrade capped at two ranks.
  // Nine core after S3 added the critical-strike branch (Precision Ledger,
  // Hard Fork Rounds) to the power line.
  assert.equal(core.length, 9);
  assert.equal(repeatable.length, 3);
  assert.deepEqual(new Set(core.map((upgrade) => upgrade.branch)), new Set(['power', 'survival', 'mobility', 'utility']));
  assert.ok(Object.values(RUN_UPGRADE_CATALOG).every((upgrade) => upgrade.title && upgrade.mechanicalLabel && upgrade.maxRank >= 2));
  // Mastery ranks must stay individually weaker than the core ranks they echo.
  assert.ok(RUN_UPGRADE_CATALOG['compound-interest'].amount < RUN_UPGRADE_CATALOG['proof-of-work'].amount);
  assert.ok(RUN_UPGRADE_CATALOG['hardened-wallet'].amount < RUN_UPGRADE_CATALOG['diamond-hands'].amount);
  assert.ok(RUN_UPGRADE_CATALOG['layer-two'].amount < RUN_UPGRADE_CATALOG['hot-wallet'].amount);
  const state = cloneProgression();
  recordRunDefeat(state, { enemyId: 'whale', threatCost: 20, tick: 1 });
  const offered = getRunProgressionSnapshot(state).pendingChoices;
  assert.equal(offered.length, 2);
  const unofferedId = Object.keys(RUN_UPGRADE_CATALOG).find((id) => !offered.some((choice) => choice.id === id));
  assert.throws(() => selectRunUpgrade(state, unofferedId), /not currently offered/);
  const result = selectRunUpgrade(state, offered[0].id);
  assert.equal(result.selected.id, offered[0].id);
  assert.equal(result.selected.rank, 1);
  assert.ok(Object.values(result.effects).every(Number.isFinite));
});

test('score and XP events reject replays and impossible inputs', () => {
  const state = cloneProgression();
  recordRunDefeat(state, { enemyId: 'enemy-a', threatCost: 2, tick: 4 });
  assert.throws(() => recordRunDefeat(state, { enemyId: 'enemy-a', threatCost: 2, tick: 5 }), /already recorded/);
  assert.throws(() => recordRunDefeat(state, { enemyId: '', threatCost: 2, tick: 5 }), /enemyId/);
  assert.throws(() => recordRunDefeat(state, { enemyId: 'enemy-b', threatCost: -1, tick: 5 }), /threatCost/);
  assert.throws(() => selectRunUpgrade(state, '__proto__'), /authored upgrade/);
});

test('run result adapter is deterministic, protocol-shaped, and has no wallet authority', () => {
  const input = { seed: 42, score: 9_250, kills: 17, elapsedMs: 61_000 };
  const checksum = createRunScoreChecksum(input);
  assert.match(checksum, /^hmh-score:[a-f0-9]{16}$/);
  assert.equal(checksum, createRunScoreChecksum(input));
  const messages = buildRunResultMessages(input);
  assert.deepEqual(Object.keys(messages).sort(), ['gameOver', 'scoreResult']);
  assert.equal(messages.scoreResult.checksum, checksum);
  assert.equal(messages.gameOver.reason, 'defeated');
  assert.deepEqual(getWeb3AdapterStatus({ embedded: false, rankedEligible: false }), {
    mode: 'offline',
    authority: 'none',
    label: 'Offline run · no wallet requested',
  });
  assert.equal(getWeb3AdapterStatus({ embedded: true, rankedEligible: true }).authority, 'portal');
  const source = fs.readFileSync(path.join(root, 'apps/hmh-reboot/src/run-adapters.mjs'), 'utf8');
  assert.doesNotMatch(source, /window\.ethereum|eth_requestAccounts|sendTransaction|privateKey|seedPhrase/i);
});

test('cockpit markup exposes real run data, accessible controls, and distinct menu/upgrade panels', () => {
  const html = fs.readFileSync(path.join(root, 'apps/portal/hmh-reboot/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'apps/portal/hmh-reboot/styles.css'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'apps/hmh-reboot/src/main.mjs'), 'utf8');
  const cockpit = fs.readFileSync(path.join(root, 'apps/hmh-reboot/src/cockpit-ui.mjs'), 'utf8');
  for (const id of ['hmhRunScore', 'hmhRunLevel', 'hmhRunXpFill', 'hmhMusicToggle', 'hmhMenuToggle', 'hmhProfileToggle', 'hmhPausePanel', 'hmhUpgradePanel', 'hmhUpgradeChoices', 'hmhAdapterStatus', 'hmhSettingMusic', 'hmhSettingScreenShake', 'hmhSettingReduceMotion', 'hmhSettingReduceFlash', 'hmhBuildEmpty', 'hmhBuildSummary']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /aria-controls="hmhPausePanel"/);
  assert.match(html, /aria-controls="hmhProfilePanel"/);
  assert.match(css, /backdrop-filter:\s*blur/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media[^{}]*max-width:\s*600px/);
  assert.match(css, /\.hmh-setting-toggle[^}]*min-height:\s*52px/);
  assert.match(css, /max-height:\s*520px[\s\S]*\.hmh-setting-toggle[^}]*min-height:\s*44px/);
  assert.match(main, /PAUSE_SETTING_KEYS = new Set\(\['musicEnabled', 'screenShake', 'reduceMotion', 'reduceFlash'\]\)/);
  assert.match(main, /syncRuntimeSettings\(\{ \.\.\.settings, \[key\]: Boolean\(enabled\) \}, \{ notify: true \}\)/);
  assert.match(main, /sessionPayload = \{ \.\.\.sessionPayload, settings: \{ \.\.\.settings \} \}/);
  assert.match(main, /stageElement\.dataset\.settingReduceMotion/);
  assert.match(main, /createRunProgression/);
  assert.match(main, /recordRunDefeat/);
  assert.match(main, /selectRunUpgrade/);
  assert.match(main, /game:score-result/);
  assert.match(main, /progressionPilotEnabled = evidenceSafeEnabled && runtimeParams\.get\('progressionPilot'\) === '1'/);
  assert.match(cockpit, /SAFE_DYNAMIC_TAGS/);
  assert.match(cockpit, /element\.textContent = String\(text\)/);
  assert.match(cockpit, /option\.append\(button, detail\)/);
  assert.match(cockpit, /detail\.append\(summary, description\)/);
  assert.match(cockpit, /summary\.setAttribute\('aria-expanded'/);
  assert.match(cockpit, /RUN_UPGRADE_CATALOG/);
  assert.match(cockpit, /className: 'hmh-build-rank'/);
  assert.match(cockpit, /onSettingToggle\(key, enabled\)/);
  assert.doesNotMatch(html, /hmhSettingGore|hmhSettingColorblind/);
  assert.match(css, /\.hmh-upgrade-details summary[^}]*min-height:\s*44px/);
  assert.doesNotMatch(css, /\.hmh-upgrade-choice p\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(cockpit, /button\.append\([^)]*description/);
  assert.doesNotMatch(cockpit, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(main, /localStorage|window\.ethereum|eth_requestAccounts/);
});

test('cockpit browser restart settles the fresh progression pilot upgrade before reopening pause', () => {
  const smoke = fs.readFileSync(path.join(root, 'scripts/hmh-reboot-cockpit-browser-smoke.mjs'), 'utf8');
  const restart = smoke.indexOf("await page.click('#hmhRestartButton')");
  const waitForUpgrade = smoke.indexOf("await page.waitForSelector('#hmhUpgradePanel:not([hidden])')", restart);
  const selectUpgrade = smoke.indexOf("await page.locator('.hmh-upgrade-choice').first().click()", waitForUpgrade);
  const waitForUpgradeClose = smoke.indexOf("document.querySelector('#hmhUpgradePanel')?.hidden === true", selectUpgrade);
  const reopenPause = smoke.indexOf("await page.click('#hmhMenuToggle')", waitForUpgradeClose);
  assert.ok(restart >= 0, 'browser smoke must exercise Restart');
  assert.ok(waitForUpgrade > restart, 'browser smoke must wait for the restarted progression pilot upgrade');
  assert.ok(selectUpgrade > waitForUpgrade, 'browser smoke must select the restarted upgrade');
  assert.ok(waitForUpgradeClose > selectUpgrade, 'browser smoke must wait for the restarted upgrade modal to close');
  assert.ok(reopenPause > waitForUpgradeClose, 'browser smoke must reopen Pause only after upgrade selection settles');
});

test('the pending level queue is always drainable — no level awards dead XP', () => {
  const state = createRunProgression({ seed: 7 });
  for (let kill = 0; kill < 400; kill += 1) {
    const snapshot = recordRunDefeat(state, { enemyId: `enemy-${kill}`, threatCost: 3, tick: kill * 10 });
    let guard = 0;
    let current = snapshot;
    while (current.pendingLevels > 0 && current.pendingChoices.length > 0 && guard < 64) {
      current = selectRunUpgrade(state, current.pendingChoices[0].id).snapshot;
      guard += 1;
    }
    assert.ok(
      current.pendingLevels === 0 || current.pendingChoices.length > 0,
      `kill ${kill}: ${current.pendingLevels} pending levels with nothing to spend them on`,
    );
  }
});

test('late-run mastery picks keep offering choices after the authored ranks are exhausted', () => {
  const state = createRunProgression({ seed: 11 });
  for (let kill = 0; kill < 400; kill += 1) {
    let snapshot = recordRunDefeat(state, { enemyId: `enemy-${kill}`, threatCost: 4, tick: kill * 10 });
    let guard = 0;
    while (snapshot.pendingLevels > 0 && snapshot.pendingChoices.length > 0 && guard < 64) {
      snapshot = selectRunUpgrade(state, snapshot.pendingChoices[0].id).snapshot;
      guard += 1;
    }
  }
  const finalSnapshot = getRunProgressionSnapshot(state);
  assert.ok(finalSnapshot.level > 18, `expected to pass the authored rank ceiling, got level ${finalSnapshot.level}`);
  const repeatable = Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => upgrade.repeatable === true);
  assert.ok(repeatable.length >= 2, 'the tree needs repeatable late-run sinks');
  const totalRepeatableRanks = repeatable.reduce((sum, upgrade) => sum + (state.ranks[upgrade.id] ?? 0), 0);
  assert.ok(totalRepeatableRanks > 0, 'late levels must actually spend into the mastery picks');
});
