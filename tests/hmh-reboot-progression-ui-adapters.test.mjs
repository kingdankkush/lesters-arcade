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

test('run progression is deterministic, bounded, and exposes three concrete upgrade choices', () => {
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
  assert.equal(snapshot.pendingChoices.length, 3);
  assert.equal(new Set(snapshot.pendingChoices.map((choice) => choice.id)).size, 3);
  assert.ok(snapshot.pendingChoices.every((choice) => Object.isFrozen(choice)));
});

test('skill tree has six authored upgrades across meaningful branches and applies only offered choices', () => {
  assert.equal(Object.keys(RUN_UPGRADE_CATALOG).length, 6);
  assert.deepEqual(new Set(Object.values(RUN_UPGRADE_CATALOG).map((upgrade) => upgrade.branch)), new Set(['power', 'survival', 'mobility', 'utility']));
  assert.ok(Object.values(RUN_UPGRADE_CATALOG).every((upgrade) => upgrade.title && upgrade.mechanicalLabel && upgrade.maxRank >= 2));
  const state = cloneProgression();
  recordRunDefeat(state, { enemyId: 'whale', threatCost: 20, tick: 1 });
  const offered = getRunProgressionSnapshot(state).pendingChoices;
  assert.equal(offered.length, 3);
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
  for (const id of ['hmhRunScore', 'hmhRunLevel', 'hmhRunXpFill', 'hmhMusicToggle', 'hmhMenuToggle', 'hmhProfileToggle', 'hmhPausePanel', 'hmhUpgradePanel', 'hmhUpgradeChoices', 'hmhAdapterStatus']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /aria-controls="hmhPausePanel"/);
  assert.match(html, /aria-controls="hmhProfilePanel"/);
  assert.match(css, /backdrop-filter:\s*blur/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media[^{}]*max-width:\s*600px/);
  assert.match(main, /createRunProgression/);
  assert.match(main, /recordRunDefeat/);
  assert.match(main, /selectRunUpgrade/);
  assert.match(main, /game:score-result/);
  assert.match(main, /progressionPilotEnabled = evidenceSafeEnabled && runtimeParams\.get\('progressionPilot'\) === '1'/);
  assert.match(cockpit, /SAFE_DYNAMIC_TAGS/);
  assert.match(cockpit, /element\.textContent = String\(text\)/);
  assert.doesNotMatch(cockpit, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(main, /localStorage|window\.ethereum|eth_requestAccounts/);
});
