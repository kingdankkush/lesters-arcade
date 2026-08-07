import { freezeDeep } from './value-guards.mjs';

export const BEAR_MARKET_BURNER_EVENT_BOUNDS = freezeDeep({ minTick: 7_200, maxTick: 32_400, protectedRadius: 140 });
const DISTRICTS = new Set(['rugpull-ravine', 'mining-camp', 'liquidation-yard']);
const OFFSETS = freezeDeep([{ x: 210, y: 0 }, { x: 0, y: 210 }, { x: -210, y: 0 }, { x: 0, y: -210 }]);
const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const mix = (value) => {
  let hash = value >>> 0;
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
};

export function createBearMarketBurnerEvent({ seed, candidates, protectedPoints = [], queryGround, isBlocked, isRouteReachable } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 64) throw new TypeError('one to 64 Burner event candidates are required');
  if (!Array.isArray(protectedPoints) || protectedPoints.length > 256) throw new TypeError('protectedPoints must be bounded');
  if (![queryGround, isBlocked, isRouteReachable].every((callback) => typeof callback === 'function')) throw new TypeError('Burner event safety callbacks are required');
  const points = protectedPoints.map((point) => {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new TypeError('protected point must be finite');
    return point;
  });
  const ordered = candidates.map((candidate) => {
    if (!candidate || typeof candidate.id !== 'string' || !candidate.id || typeof candidate.pointOfInterestId !== 'string' || !candidate.pointOfInterestId) throw new TypeError('Burner event candidate requires authored IDs');
    if (!DISTRICTS.has(candidate.districtId)) throw new TypeError(`unsupported Burner event district ${String(candidate.districtId)}`);
    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) throw new TypeError('Burner event coordinates must be finite');
    return candidate;
  }).sort((a, b) => lexical(a.id, b.id));
  const normalizedSeed = seed >>> 0;
  const candidateStart = mix(normalizedSeed ^ 0xb34a4e7) % ordered.length;
  const offsetStart = mix(normalizedSeed ^ 0xf1a4e55) % OFFSETS.length;
  for (let c = 0; c < ordered.length; c += 1) {
    const candidate = ordered[(candidateStart + c) % ordered.length];
    for (let o = 0; o < OFFSETS.length; o += 1) {
      const offset = OFFSETS[(offsetStart + o) % OFFSETS.length];
      const point = { ...candidate, x: candidate.x + offset.x, y: candidate.y + offset.y };
      if (points.some((entry) => Math.hypot(point.x - entry.x, point.y - entry.y) < BEAR_MARKET_BURNER_EVENT_BOUNDS.protectedRadius)) continue;
      if (isBlocked(point)) continue;
      const ground = queryGround(point.x, point.y);
      if (!ground || !Number.isFinite(ground.groundZ) || ground.kind === 'deep-water') continue;
      if (!isRouteReachable(point, ground)) continue;
      const availableTick = BEAR_MARKET_BURNER_EVENT_BOUNDS.minTick
        + mix(normalizedSeed ^ 0xb007e4) % (BEAR_MARKET_BURNER_EVENT_BOUNDS.maxTick - BEAR_MARKET_BURNER_EVENT_BOUNDS.minTick + 1);
      return freezeDeep({
        id: `rare-burner:${normalizedSeed.toString(16).padStart(8, '0')}`,
        pointOfInterestId: candidate.pointOfInterestId,
        assetId: 'bear-market-burner-cache', category: 'high-risk-biome-event', districtId: candidate.districtId,
        hook: 'weapon', x: point.x, y: point.y, groundZ: ground.groundZ, availableTick,
        runtimeAuthority: 'fixed-tick-collectible',
      });
    }
  }
  throw new Error('no safe Bear Market Burner event placement');
}
