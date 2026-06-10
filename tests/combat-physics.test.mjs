import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sweptAABB, circlesOverlap, stepProjectile, knockback, validatePhysics } from '../apps/portal/src/combat-physics.mjs';

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
});
