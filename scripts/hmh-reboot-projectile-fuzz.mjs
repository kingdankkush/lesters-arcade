import assert from 'node:assert/strict';
import {
  UniformHurtboxGrid,
  createHurtTarget,
  createProjectileState,
  queryProjectileCandidates,
  resolveProjectilePath,
} from '../apps/hmh-reboot/src/projectile-physics.mjs';

const CASES = 20_000;
const TARGET_COUNT = 150;
const SEED = 0x8f31d2a7;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function hashString(hash, value) {
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

function buildTargets(random) {
  return Array.from({ length: TARGET_COUNT }, (_, index) => {
    const x = 24 + random() * 2000;
    const y = 24 + random() * 2000;
    const previousX = x + (random() - 0.5) * 36;
    const previousY = y + (random() - 0.5) * 36;
    const groundZ = random() < 0.2 ? 48 : 0;
    return createHurtTarget({
      id: `target-${String(index).padStart(3, '0')}`,
      bodyShape: { type: 'circle', radius: 14 },
      hurtShape: { type: 'capsule', a: { x: 0, y: -6 }, b: { x: 0, y: 6 }, radius: 10 },
      previousGround: { x: previousX, y: previousY, z: groundZ },
      currentGround: { x, y, z: groundZ },
      minZ: 2,
      maxZ: 58,
      health: 20,
    });
  });
}

function run(seed) {
  const random = rng(seed);
  const targets = buildTargets(random);
  const grid = new UniformHurtboxGrid({ targets, cellSize: 96 });
  let hash = 2166136261;
  let candidateCount = 0;
  let hitCount = 0;
  for (let index = 0; index < CASES; index += 1) {
    const start = { x: random() * 2048, y: random() * 2048, z: random() < 0.2 ? 64 : 32 };
    const angle = random() * Math.PI * 2;
    const length = 40 + random() * 900;
    const shot = createProjectileState({
      id: `shot-${String(index).padStart(5, '0')}`,
      ownerId: 'fuzz-player',
      previous: start,
      current: { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length, z: start.z },
      radius: 1 + random() * 3,
      damage: 3,
      policy: { type: 'stop' },
    });
    const scanIds = queryProjectileCandidates({ projectile: shot, targets }).map(({ id }) => id);
    const gridIds = grid.query(shot).map(({ id }) => id);
    assert.deepEqual(gridIds, scanIds, `candidate mismatch at case ${index}`);
    const scanResolution = resolveProjectilePath({ projectile: shot, targets });
    const gridResolution = resolveProjectilePath({ projectile: shot, targets, broadphase: grid });
    assert.deepEqual(gridResolution, scanResolution, `resolution mismatch at case ${index}`);
    candidateCount += scanIds.length;
    hitCount += scanResolution.hits.length;
    hash = hashString(hash, `${scanIds.join(',')}|${scanResolution.hits.map(({ targetId }) => targetId).join(',')};`);
  }
  return { hash: hash.toString(16).padStart(8, '0'), candidateCount, hitCount };
}

const first = run(SEED);
const second = run(SEED);
assert.deepEqual(second, first);
console.log(JSON.stringify({ status: 'PASS', seed: `0x${SEED.toString(16)}`, cases: CASES, targets: TARGET_COUNT, ...first }));
