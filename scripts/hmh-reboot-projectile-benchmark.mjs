import {
  UniformHurtboxGrid,
  createHurtTarget,
  createProjectileState,
  queryProjectileCandidates,
} from '../apps/hmh-reboot/src/projectile-physics.mjs';

function targetsForCount(count) {
  return Array.from({ length: count }, (_, index) => {
    const column = index % 15;
    const row = Math.floor(index / 15);
    return createHurtTarget({
      id: `enemy-${String(index).padStart(3, '0')}`,
      bodyShape: { type: 'circle', radius: 18 },
      hurtShape: { type: 'capsule', a: { x: 0, y: -6 }, b: { x: 0, y: 6 }, radius: 12 },
      previousGround: { x: column * 96 + 32, y: row * 96 + 32, z: 0 },
      currentGround: { x: column * 96 + 34, y: row * 96 + 31, z: 0 },
      minZ: 4,
      maxZ: 58,
      health: 20,
    });
  });
}

function projectilesForCount(count, rows) {
  return Array.from({ length: count }, (_, index) => {
    const row = index % rows;
    const offset = (index * 17) % 48;
    return createProjectileState({
      id: `shot-${index}`,
      ownerId: 'benchmark',
      previous: { x: -40, y: row * 96 + 20 + offset, z: 28 },
      current: { x: 1480, y: row * 96 + 20 + offset, z: 28 },
      radius: 2,
      damage: 1,
      policy: { type: 'stop' },
    });
  });
}

function elapsedMs(callback) {
  const start = process.hrtime.bigint();
  const hash = callback();
  return { milliseconds: Number(process.hrtime.bigint() - start) / 1e6, hash };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function benchmark(count) {
  const targets = targetsForCount(count);
  const rows = Math.ceil(count / 15);
  const projectiles = projectilesForCount(2_000, rows);
  const gridBuild = elapsedMs(() => new UniformHurtboxGrid({ targets, cellSize: 96 }));
  const grid = gridBuild.hash;
  const scanRounds = [];
  const gridRounds = [];
  let scanHash = 0;
  let gridHash = 0;
  for (let round = 0; round < 7; round += 1) {
    const scan = elapsedMs(() => {
      let hash = 2166136261;
      for (const projectile of projectiles) {
        for (const target of queryProjectileCandidates({ projectile, targets })) hash = Math.imul(hash ^ target.id.charCodeAt(6), 16777619) >>> 0;
      }
      return hash;
    });
    const spatial = elapsedMs(() => {
      let hash = 2166136261;
      for (const projectile of projectiles) {
        for (const target of grid.query(projectile)) hash = Math.imul(hash ^ target.id.charCodeAt(6), 16777619) >>> 0;
      }
      return hash;
    });
    if (round > 0) {
      scanRounds.push(scan.milliseconds);
      gridRounds.push(spatial.milliseconds);
    }
    scanHash = scan.hash;
    gridHash = spatial.hash;
  }
  if (scanHash !== gridHash) throw new Error(`broadphase parity failed at ${count} targets`);
  const scanMedianMs = median(scanRounds);
  const gridMedianMs = median(gridRounds);
  return {
    targets: count,
    projectiles: projectiles.length,
    cellSize: 96,
    buildMs: Number(gridBuild.milliseconds.toFixed(3)),
    scanMedianMs: Number(scanMedianMs.toFixed(3)),
    gridMedianMs: Number(gridMedianMs.toFixed(3)),
    speedup: Number((scanMedianMs / gridMedianMs).toFixed(2)),
    candidateHash: scanHash,
    parity: 'PASS',
  };
}

console.log(JSON.stringify({ benchmark: 'hmh-reboot-projectile-broadphase', results: [benchmark(100), benchmark(150)] }, null, 2));
