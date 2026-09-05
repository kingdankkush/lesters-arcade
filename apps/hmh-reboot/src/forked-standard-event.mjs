import { FORKED_STANDARD_CONFIG } from './forked-standard.mjs';
import { mix } from './deterministic-hash.mjs';
import { freezeDeep } from './value-guards.mjs';

const DISTRICTS = new Set(['hashwood', 'mining-camp', 'liquidation-yard']);
const OFFSETS = freezeDeep([{ x: 170, y: 0 }, { x: 0, y: 170 }, { x: -170, y: 0 }, { x: 0, y: -170 }]);
const PROTECTED_RADIUS = 140;
const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;
export function createForkedStandardEvent({ seed, candidates, protectedPoints = [], queryGround, isBlocked, isRouteReachable } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 64) throw new TypeError('one to 64 Forked Standard event candidates are required');
  if (!Array.isArray(protectedPoints) || protectedPoints.length > 256) throw new TypeError('protectedPoints must be bounded');
  if (![queryGround, isBlocked, isRouteReachable].every((callback) => typeof callback === 'function')) throw new TypeError('Forked Standard event safety callbacks are required');
  const points = protectedPoints.map((point) => {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new TypeError('protected point must be finite');
    return point;
  });
  const candidateIds = new Set();
  const ordered = candidates.map((candidate) => {
    if (!candidate || typeof candidate.id !== 'string' || !candidate.id || typeof candidate.pointOfInterestId !== 'string' || !candidate.pointOfInterestId) throw new TypeError('Forked Standard event candidate requires authored IDs');
    if (candidateIds.has(candidate.id)) throw new TypeError(`duplicate Forked Standard event candidate ${candidate.id}`);
    candidateIds.add(candidate.id);
    if (!DISTRICTS.has(candidate.districtId)) throw new TypeError(`unsupported Forked Standard event district ${String(candidate.districtId)}`);
    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) throw new TypeError('Forked Standard event coordinates must be finite');
    return candidate;
  }).sort((left, right) => lexical(left.id, right.id));
  const normalizedSeed = seed >>> 0;
  const candidateStart = mix(normalizedSeed ^ 0xf04ced) % ordered.length;
  const offsetStart = mix(normalizedSeed ^ 0x57a4da2d) % OFFSETS.length;
  for (let candidateIndex = 0; candidateIndex < ordered.length; candidateIndex += 1) {
    const candidate = ordered[(candidateStart + candidateIndex) % ordered.length];
    for (let offsetIndex = 0; offsetIndex < OFFSETS.length; offsetIndex += 1) {
      const offset = OFFSETS[(offsetStart + offsetIndex) % OFFSETS.length];
      const point = { ...candidate, x: candidate.x + offset.x, y: candidate.y + offset.y };
      if (points.some((entry) => Math.hypot(point.x - entry.x, point.y - entry.y) < PROTECTED_RADIUS)) continue;
      if (isBlocked(point)) continue;
      const ground = queryGround(point.x, point.y);
      if (!ground || !Number.isFinite(ground.groundZ) || ground.kind === 'deep-water' || ground.deepWater === true || ground.walkable === false) continue;
      if (!isRouteReachable(point, ground)) continue;
      const availableTick = FORKED_STANDARD_CONFIG.eventMinTick
        + mix(normalizedSeed ^ 0xca110ca1) % (FORKED_STANDARD_CONFIG.eventMaxTick - FORKED_STANDARD_CONFIG.eventMinTick + 1);
      return freezeDeep({
        id: `rare-standard:${normalizedSeed.toString(16).padStart(8, '0')}`,
        pointOfInterestId: candidate.pointOfInterestId,
        assetId: 'forked-standard-cache',
        category: 'high-risk-biome-event',
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
  throw new Error('no safe Forked Standard event placement');
}
