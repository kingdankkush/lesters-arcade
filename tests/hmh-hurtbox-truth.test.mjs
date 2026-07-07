import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HMH_HURTBOX_TRUTH_POLICY,
  buildDebugHitboxOverlayModel,
  deriveSpriteHitProfile,
  deriveSpriteHitProfilesForDirections,
} from '../apps/portal/src/hmh-hurtbox-truth.mjs';

const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

test('WO-108 hurtbox truth derives separate body and hurt boxes from sprite draw dimensions', () => {
  const profile = deriveSpriteHitProfile({ actorKey: 'fud-goblin', drawWidth: 64, drawHeight: 88, direction: 'south' });

  assert.equal(profile.policyId, HMH_HURTBOX_TRUTH_POLICY.id);
  assert.equal(profile.actorKey, 'fud-goblin');
  assert.equal(profile.direction, 'south');
  assert.ok(profile.bodyBox.w > profile.hurtBox.w, 'body box should include readability padding beyond vulnerable hurt box');
  assert.ok(profile.bodyBox.h > profile.hurtBox.h, 'body box should include head/feet padding beyond vulnerable hurt box');
  assert.ok(profile.hurtBox.y > profile.bodyBox.y, 'hurt box should avoid top hair/hat pixels');
  assert.ok(profile.hurtBox.h >= 44, '88px enemy should keep a substantial targetable core');
  assert.equal(profile.debugHitboxes.body.stroke, '#3aa7ff');
  assert.equal(profile.debugHitboxes.hurt.stroke, '#ff3a5e');
});

test('WO-108 per-direction profiles produce eight deterministic facings with directional offsets', () => {
  const profiles = deriveSpriteHitProfilesForDirections({ actorKey: 'rattlesnake', drawWidth: 72, drawHeight: 96 });

  assert.deepEqual(Object.keys(profiles), DIRECTIONS);
  assert.deepEqual(Object.keys(profiles).map((dir) => profiles[dir].direction), DIRECTIONS);
  assert.notEqual(profiles.east.hurtBox.x, profiles.west.hurtBox.x, 'east/west facings should bias the vulnerable core differently');
  assert.notEqual(profiles.north.hurtBox.y, profiles.south.hurtBox.y, 'north/south facings should bias the vulnerable core differently');
  assert.equal(JSON.stringify(profiles), JSON.stringify(deriveSpriteHitProfilesForDirections({ actorKey: 'rattlesnake', drawWidth: 72, drawHeight: 96 })));
});

test('WO-108 boss profiles expose multi-capsules for large enemies without scaling runtime sprites', () => {
  const profile = deriveSpriteHitProfile({ actorKey: 'whale-dumper-boss', drawWidth: 224, drawHeight: 256, direction: 'south-east', boss: true });

  assert.equal(profile.boss, true);
  assert.equal(profile.scalePolicy, 'runtime-scale-100-percent');
  assert.equal(profile.bossCapsules.length >= 3, true, 'large boss should split into head/body/leg capsules');
  assert.equal(profile.bossCapsules.every((capsule) => capsule.radius > 8 && capsule.h > 20), true);
  assert.equal(profile.debugHitboxes.bossCapsules.length, profile.bossCapsules.length);
});

test('WO-108 debugHitboxes overlay model can be consumed by a renderer without recomputing collision math', () => {
  const profile = deriveSpriteHitProfile({ actorKey: 'buzzard', drawWidth: 60, drawHeight: 90, direction: 'north-west' });
  const overlay = buildDebugHitboxOverlayModel(profile, { screenX: 320, screenY: 180, enabled: true });

  assert.equal(overlay.enabled, true);
  assert.equal(overlay.actorKey, 'buzzard');
  assert.deepEqual(overlay.layers.map((layer) => layer.kind), ['body', 'hurt']);
  assert.equal(overlay.layers.every((layer) => Number.isFinite(layer.rect.x) && Number.isFinite(layer.rect.y)), true);
  assert.equal(buildDebugHitboxOverlayModel(profile, { enabled: false }).layers.length, 0);
});
