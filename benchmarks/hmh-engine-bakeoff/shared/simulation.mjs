export const BENCH_COUNTS = Object.freeze({ enemies: 150, projectiles: 500, particles: 1500, props: 300 });

function scaledCounts(scale) {
  return Object.fromEntries(Object.entries(BENCH_COUNTS).map(([key, value]) => [key, Math.round(value * scale)]));
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function createPool(count, random, speedMin, speedMax) {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    x[index] = random();
    y[index] = random();
    const angle = random() * Math.PI * 2;
    const speed = speedMin + random() * (speedMax - speedMin);
    vx[index] = Math.cos(angle) * speed;
    vy[index] = Math.sin(angle) * speed;
  }
  return { count, x, y, vx, vy };
}

export function createSimulation(seed = 0x1e57e2, scale = 1) {
  const random = mulberry32(seed);
  const counts = scaledCounts(scale);
  return {
    elapsed: 0,
    counts,
    enemies: createPool(counts.enemies, random, 0.035, 0.085),
    projectiles: createPool(counts.projectiles, random, 0.18, 0.42),
    particles: createPool(counts.particles, random, 0.06, 0.22),
    props: createPool(counts.props, random, 0, 0),
  };
}

function stepPool(pool, dt, swirl, elapsed) {
  for (let index = 0; index < pool.count; index += 1) {
    const turn = Math.sin(elapsed * 0.0017 + index * 0.37) * swirl * dt;
    const vx = pool.vx[index];
    const vy = pool.vy[index];
    pool.vx[index] = vx - vy * turn;
    pool.vy[index] = vy + vx * turn;
    let x = pool.x[index] + pool.vx[index] * dt;
    let y = pool.y[index] + pool.vy[index] * dt;
    if (x < 0) { x = -x; pool.vx[index] = Math.abs(pool.vx[index]); }
    if (x > 1) { x = 2 - x; pool.vx[index] = -Math.abs(pool.vx[index]); }
    if (y < 0) { y = -y; pool.vy[index] = Math.abs(pool.vy[index]); }
    if (y > 1) { y = 2 - y; pool.vy[index] = -Math.abs(pool.vy[index]); }
    pool.x[index] = x;
    pool.y[index] = y;
  }
}

export function stepSimulation(simulation, dt) {
  simulation.elapsed += dt;
  stepPool(simulation.enemies, dt, 0.00055, simulation.elapsed);
  stepPool(simulation.projectiles, dt, 0.0002, simulation.elapsed);
  stepPool(simulation.particles, dt, 0.00085, simulation.elapsed);
}

export function simulationChecksum(simulation) {
  let checksum = 0;
  for (const pool of [simulation.enemies, simulation.projectiles, simulation.particles]) {
    for (let index = 0; index < pool.count; index += 1) {
      checksum = (checksum + Math.round(pool.x[index] * 1000003) + Math.round(pool.y[index] * 1000033)) >>> 0;
    }
  }
  return checksum;
}
