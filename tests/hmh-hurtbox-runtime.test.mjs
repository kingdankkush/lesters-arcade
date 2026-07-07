import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildRuntimeSpriteHitboxes,
  runtimeBossHitbox,
  runtimeEnemyHitbox,
} from '../apps/portal/src/hmh-hurtbox-runtime.mjs';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

test('WO-108 runtime enemy hitbox uses the derived hurt box as the damage target', () => {
  const runtime = runtimeEnemyHitbox({ id: 'fud-goblin', x: 120, y: 240, class: 'grunt', direction: 'east' }, { debugHitboxes: true });
  assert.equal(runtime.policyId, 'wo108-sprite-derived-hurtbox-truth-v1');
  assert.equal(runtime.actorKey, 'fud-goblin');
  assert.equal(runtime.collisionBox, runtime.hurtBox);
  assert.equal(runtime.bodyBox.w > runtime.hurtBox.w, true, 'body box stays wider than vulnerable hurt box');
  assert.equal(runtime.overlay.enabled, true);
  assert.deepEqual(runtime.overlay.layers.map((layer) => layer.kind), ['body', 'hurt']);
});

test('WO-108 runtime boss hitbox aggregates multi-capsules without scaling the sprite down', () => {
  const boss = runtimeBossHitbox({ id: 'whale-dumper-boss', x: 650, phase: 2 }, { groundY: 330, debugHitboxes: true });
  assert.equal(boss.actorKey, 'whale-dumper-boss');
  assert.equal(boss.bossCapsules.length >= 3, true);
  assert.equal(boss.drawWidth, 162);
  assert.equal(boss.drawHeight, 162);
  assert.equal(boss.collisionBox.w > 40, true);
  assert.equal(boss.overlay.layers.some((layer) => layer.kind === 'boss-capsule'), true);
});

test('WO-108 generic adapter is deterministic for overlay captures', () => {
  const a = buildRuntimeSpriteHitboxes({ actorKey: 'buzzard', screenX: 320, screenY: 180, drawWidth: 88, drawHeight: 88, direction: 'north-west', debugHitboxes: true });
  const b = buildRuntimeSpriteHitboxes({ actorKey: 'buzzard', screenX: 320, screenY: 180, drawWidth: 88, drawHeight: 88, direction: 'north-west', debugHitboxes: true });
  assert.deepEqual(a, b);
});

test('WO-108 main runtime consumes hmh-hurtbox-runtime for enemy/boss hitboxes and debug overlays', () => {
  const main = readFileSync(repoPath('apps/portal/main.js'), 'utf8');
  assert.match(main, /hmh-hurtbox-runtime\.mjs/);
  assert.match(main, /runtimeEnemyHitbox\(/);
  assert.match(main, /runtimeBossHitbox\(/);
  assert.match(main, /drawRuntimeHitboxOverlay\(/);
  assert.match(main, /debugHitboxes/);
});

test('WO-108 runtime files are covered by the explicit syntax gate', () => {
  const syntaxSource = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.match(syntaxSource, /apps\/portal\/src\/hmh-hurtbox-runtime\.mjs/);
  assert.match(syntaxSource, /tests\/hmh-hurtbox-runtime\.test\.mjs/);
});
