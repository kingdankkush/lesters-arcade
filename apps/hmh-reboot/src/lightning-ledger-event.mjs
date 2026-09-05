import { freezeDeep } from './value-guards.mjs';
import { mix } from './deterministic-hash.mjs';

const MIN_EVENT_TICK = 3_600;
const MAX_EVENT_TICK = 28_800;
const PROTECTED_RADIUS = 120;
const RARE_DISTRICTS = new Set(['liquidity-crossing', 'hashwood', 'mining-camp']);
const OFFSETS = Object.freeze([
  Object.freeze({ x: 180, y: 0 }),
  Object.freeze({ x: 0, y: 180 }),
  Object.freeze({ x: -180, y: 0 }),
  Object.freeze({ x: 0, y: -180 }),
]);

const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function unsignedSeed(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  return value >>> 0;
}

function validateCandidate(candidate) {
  if (!candidate || typeof candidate.id !== 'string' || !candidate.id || typeof candidate.pointOfInterestId !== 'string' || !candidate.pointOfInterestId) {
    throw new TypeError('Ledger event candidate requires bounded authored IDs');
  }
  if (!RARE_DISTRICTS.has(candidate.districtId)) throw new TypeError(`unsupported rare-event district ${String(candidate.districtId)}`);
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) throw new TypeError('Ledger event candidate coordinates must be finite');
  return candidate;
}

export function createLightningLedgerRareEvent({
  seed,
  candidates,
  protectedPoints = [],
  queryGround,
  isBlocked,
  isRouteReachable,
} = {}) {
  const normalizedSeed = unsignedSeed(seed);
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 64) throw new TypeError('one to 64 Ledger event candidates are required');
  if (!Array.isArray(protectedPoints) || protectedPoints.length > 256) throw new TypeError('protectedPoints must be a bounded array');
  if (![queryGround, isBlocked, isRouteReachable].every((callback) => typeof callback === 'function')) throw new TypeError('Ledger event safety callbacks are required');
  const points = protectedPoints.map((point) => {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new TypeError('protected point must be finite');
    return point;
  });
  const ordered = candidates.map(validateCandidate).sort((left, right) => lexical(left.id, right.id));
  const candidateStart = mix(normalizedSeed) % ordered.length;
  const offsetStart = mix(normalizedSeed ^ 0xa11ce55d) % OFFSETS.length;

  for (let candidateOffset = 0; candidateOffset < ordered.length; candidateOffset += 1) {
    const candidate = ordered[(candidateStart + candidateOffset) % ordered.length];
    for (let offsetIndex = 0; offsetIndex < OFFSETS.length; offsetIndex += 1) {
      const offset = OFFSETS[(offsetStart + offsetIndex) % OFFSETS.length];
      const point = { ...candidate, x: candidate.x + offset.x, y: candidate.y + offset.y };
      if (points.some((protectedPoint) => Math.hypot(point.x - protectedPoint.x, point.y - protectedPoint.y) < PROTECTED_RADIUS)) continue;
      if (isBlocked(point)) continue;
      const ground = queryGround(point.x, point.y);
      if (!ground || !Number.isFinite(ground.groundZ) || ground.kind === 'deep-water') continue;
      if (!isRouteReachable(point, ground)) continue;
      const availableTick = MIN_EVENT_TICK + mix(normalizedSeed ^ 0x1ed6e7) % (MAX_EVENT_TICK - MIN_EVENT_TICK + 1);
      return freezeDeep({
        id: `rare-ledger:${normalizedSeed.toString(16).padStart(8, '0')}`,
        pointOfInterestId: candidate.pointOfInterestId,
        assetId: 'lightning-ledger-cache',
        category: 'rare-biome-event',
        districtId: candidate.districtId,
        hook: 'weapon',
        x: point.x,
        y: point.y,
        groundZ: ground.groundZ,
        availableTick,
        runtimeAuthority: 'fixed-tick-collectible',
      });
    }
  }
  throw new Error('no safe Lightning Ledger event placement');
}
