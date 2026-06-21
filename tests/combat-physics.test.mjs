import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sweptAABB, circlesOverlap, stepProjectile, knockback, planGrenadeThrow, grenadeBlastDamageAt, explosionImpulseAt, validatePhysics } from '../apps/portal/src/combat-physics.mjs';

describe('combat-physics', () => {
  it('sweptAABB detects fast-moving bullet through enemy', () => {
    // Bullet moves from x=0 to x=100 at y=10, enemy box at x=50, y=0 w=10 h=20
    const t = sweptAABB(0, 10, 100, 10, 50, 0, 10, 20);
    assert.notEqual(t, null);
    assert.ok(t >= 0 && t <= 1);
  });

  it('sweptAABB returns null when bullet misses', () => {
    // Bullet moves horizontally at y=100, enemy at y=0
    const t = sweptAABB(0, 100, 100, 100, 50, 0, 10, 20);
    assert.equal(t, null);
  });

  it('sweptAABB detects stationary overlap', () => {
    const t = sweptAABB(50, 10, 50, 10, 50, 0, 10, 20);
    // Stationary bullet at (50,10) should be inside box (50,0,10,20)
    assert.notEqual(t, null);
  });

  it('circlesOverlap detects overlapping circles', () => {
    assert.ok(circlesOverlap(0, 0, 5, 8, 0, 5)); // 8 apart, r=5 each
  });

  it('circlesOverlap rejects distant circles', () => {
    assert.ok(!circlesOverlap(0, 0, 5, 50, 0, 5)); // 50 apart, r=5 each
  });

  it('stepProjectile applies gravity and bounce', () => {
    const p = stepProjectile({ x: 0, y: 0, vx: 1, vy: -2, gravity: 0.5 });
    assert.ok(p.y < 0); // should rise with negative vy
    assert.equal(p.vx, 1); // no drag by default
  });

  it('stepProjectile bounces grenade on ground', () => {
    const p = stepProjectile({ x: 0, y: 420, vx: 1, vy: 2, gravity: 0.5, groundY: 420 });
    assert.ok(p.bounced);
    assert.ok(p.vy < 0); // should bounce upward
  });

  it('knockback scales with damage and armor', () => {
    const kb1 = knockback({ sourceDamage: 10, armored: false });
    const kb2 = knockback({ sourceDamage: 10, armored: true });
    assert.ok(Math.abs(kb1.vx) > Math.abs(kb2.vx)); // armored resists more
    assert.equal(kb1.durationFrames, 10);
  });

  it('knockback scales with damage type', () => {
    const kb1 = knockback({ sourceDamage: 10, sourceType: 'explosion' });
    const kb2 = knockback({ sourceDamage: 10, sourceType: 'bullet' });
    assert.ok(Math.abs(kb1.vx) > Math.abs(kb2.vx)); // explosion pushes harder
  });

  it('validatePhysics passes all invariants', () => {
    const result = validatePhysics();
    assert.ok(result.ok, result.errors.join(', '));
  });

  it('planGrenadeThrow lands along the aim vector and clamps to max range', () => {
    const plan = planGrenadeThrow({ originX: 10, originY: 10, aimX: 0, aimY: 1, reach: 99, maxRange: 6, blastRadius: 2 });
    assert.equal(plan.distance, 6); // clamped to maxRange
    assert.equal(plan.landX, 10); // pure-y aim, x unchanged
    assert.equal(plan.landY, 16); // origin + 6 along +y
    assert.equal(plan.marker.radius, 2); // landing-shadow telegraph radius == blast radius
    assert.equal(plan.marker.x, plan.landX);
    assert.equal(plan.marker.y, plan.landY);
  });

  it('planGrenadeThrow is deterministic for the same inputs (replay-safe)', () => {
    const a = planGrenadeThrow({ originX: 3, originY: 7, aimX: 0.6, aimY: -0.8, reach: 1.4 });
    const b = planGrenadeThrow({ originX: 3, originY: 7, aimX: 0.6, aimY: -0.8, reach: 1.4 });
    assert.deepEqual(a, b);
  });

  it('grenadeBlastDamageAt falls off from center to rim and is zero outside radius', () => {
    const center = grenadeBlastDamageAt({ distance: 0, radius: 2, baseDamage: 30 });
    const mid = grenadeBlastDamageAt({ distance: 1, radius: 2, baseDamage: 30 });
    const rim = grenadeBlastDamageAt({ distance: 2, radius: 2, baseDamage: 30 });
    assert.ok(center > mid && mid > rim);
    assert.ok(rim > 0); // still chips at the rim
    assert.equal(grenadeBlastDamageAt({ distance: 2.01, radius: 2, baseDamage: 30 }), 0);
  });

  it('explosionImpulseAt pushes targets radially outward with falloff', () => {
    const near = explosionImpulseAt({ sourceX: 0, sourceY: 0, targetX: 0.5, targetY: 0, radius: 2, power: 4 });
    const far = explosionImpulseAt({ sourceX: 0, sourceY: 0, targetX: 1.5, targetY: 0, radius: 2, power: 4 });
    assert.ok(near.inRange && far.inRange);
    assert.ok(near.vx > far.vx); // closer target pushed harder (more falloff weight)
    assert.ok(near.vx > 0); // pushed away from the blast (+x)
    const outside = explosionImpulseAt({ sourceX: 0, sourceY: 0, targetX: 5, targetY: 0, radius: 2, power: 4 });
    assert.equal(outside.inRange, false);
    assert.equal(outside.vx, 0);
  });
});
