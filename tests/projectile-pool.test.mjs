import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectilePool, getPooledProjectile, returnPooledProjectile, validateProjectilePool } from '../apps/portal/src/projectile-pool.mjs';

describe('projectile-pool', () => {
  it('createProjectilePool initializes a pool with specified capacity', () => {
    const pool = createProjectilePool({ capacity: 10 });
    assert.equal(pool.pool.length, 10);
    assert.equal(pool.activeCount, 0);
    assert.equal(pool.capacity, 10);
  });

  it('getPooledProjectile retrieves an inactive projectile and marks it active', () => {
    const pool = createProjectilePool({ capacity: 1 });
    const projectile = getPooledProjectile(pool);
    assert.equal(pool.activeCount, 1);
    assert.equal(projectile.active, true);
    assert.ok(pool.pool.includes(projectile));
  });

  it('getPooledProjectile dynamically increases pool capacity if exhausted', () => {
    const pool = createProjectilePool({ capacity: 1 });
    getPooledProjectile(pool); // Exhausts the initial pool
    const newProjectile = getPooledProjectile(pool);
    assert.equal(pool.capacity, 2);
    assert.equal(pool.activeCount, 2);
    assert.equal(newProjectile.active, true);
  });

  it('returnPooledProjectile marks a projectile inactive and decrements activeCount', () => {
    const pool = createProjectilePool({ capacity: 1 });
    const projectile = getPooledProjectile(pool);
    returnPooledProjectile(pool, projectile);
    assert.equal(pool.activeCount, 0);
    assert.equal(projectile.active, false);
  });

  it('returnPooledProjectile handles attempts to return inactive projectiles gracefully', () => {
    const pool = createProjectilePool({ capacity: 1 });
    const projectile = getPooledProjectile(pool);
    returnPooledProjectile(pool, projectile);
    // Attempt to return again
    returnPooledProjectile(pool, projectile);
    assert.equal(pool.activeCount, 0); // Should still be 0
    assert.equal(projectile.active, false); // Should still be false
  });

  it('validateProjectilePool passes all invariants', () => {
    const result = validateProjectilePool();
    assert.ok(result.ok, result.errors.join(', '));
  });
});
