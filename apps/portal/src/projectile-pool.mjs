// Hard Money Heroes — Projectile Pooling (Level Design Bible §10, Slice #1 tail).
//
// Reusable pool of projectile objects to avoid constant allocations/deallocations
// during intense combat, improving performance and reducing garbage collection.
// All pure functions; no DOM access; deterministic for replays.

export function createProjectilePool({ capacity = 100 } = {}) {
  const pool = [];
  for (let i = 0; i < capacity; i += 1) {
    pool.push(createPooledProjectile());
  }
  return { pool, activeCount: 0, capacity };
}

// Creates a bare-bones projectile object ready for pooling.
function createPooledProjectile() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, ttl: 0, type: 'player', damage: 0, radius: 0, owner: null };
}

// Gets an inactive projectile from the pool. Resets its state.
export function getPooledProjectile(pool) {
  let p = null;
  for (const candidate of pool.pool) {
    if (!candidate.active) {
      p = candidate;
      break;
    }
  }
  if (!p) {
    // Pool exhausted, create a new one (increases capacity dynamically, but logs a warning).
    p = createPooledProjectile();
    pool.pool.push(p);
    pool.capacity += 1;
    console.warn('Projectile pool exhausted, dynamically increasing capacity.', pool.capacity);
  }
  p.active = true;
  pool.activeCount += 1;
  // Reset essential properties (others will be overwritten by the caller).
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.ttl = 0; p.type = 'player'; p.damage = 0; p.radius = 0; p.owner = null;
  return p;
}

// Returns an active projectile to the pool, marking it inactive.
export function returnPooledProjectile(pool, projectile) {
  if (!projectile.active) {
    console.warn('Attempted to return an inactive projectile to the pool.');
    return;
  }
  projectile.active = false;
  pool.activeCount -= 1;
}

// Validates the projectile pool invariants (called during npm test).
export function validateProjectilePool() {
  const errors = [];
  const pool = createProjectilePool({ capacity: 5 });
  if (pool.pool.length !== 5) errors.push('pool should have initial capacity');
  if (pool.activeCount !== 0) errors.push('pool should start with 0 active');

  const p1 = getPooledProjectile(pool);
  if (pool.activeCount !== 1) errors.push('getPooledProjectile should increment activeCount');
  if (!p1.active) errors.push('retrieved projectile should be active');

  returnPooledProjectile(pool, p1);
  if (pool.activeCount !== 0) errors.push('returnPooledProjectile should decrement activeCount');
  if (p1.active) errors.push('returned projectile should be inactive');

  // Exhaust pool and check dynamic growth
  const active = [];
  for (let i = 0; i < 5; i += 1) active.push(getPooledProjectile(pool));
  if (pool.activeCount !== 5) errors.push('pool should have 5 active after exhausting');
  const p6 = getPooledProjectile(pool);
  if (pool.capacity !== 6) errors.push('pool capacity should increase dynamically');
  if (pool.activeCount !== 6) errors.push('activeCount should be 6 after dynamic growth');
  return { ok: errors.length === 0, errors };
}
