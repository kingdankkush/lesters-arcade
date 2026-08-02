// Minimap fog model (MAP-REDO slice 4, handoff §H8-11). Pure projection of
// simulation state: `explored` geography persists (the reveal system already
// owns that), live enemy positions exist only inside current visibility, and
// POI markers appear on discovery and persist. Nothing here mutates
// simulation state except the caller-owned discovery set, which is
// projection bookkeeping (what the player has seen), not gameplay authority.

// Matches the authored reveal radius so "what the map shows live" equals
// "what the world reveals around you".
export const MINIMAP_VISIBILITY_RADIUS = 420;

// Render cost cap: a swarm can exceed 100 actors; the map stays readable and
// cheap by marking the nearest slice of them.
const MAX_ENEMY_MARKERS = 64;

export function createMinimapDiscoveryState() {
  return { discoveredPoiIds: new Set() };
}

function normalize(bounds, x, y) {
  return {
    x: (x - bounds.minX) / (bounds.maxX - bounds.minX),
    y: (y - bounds.minY) / (bounds.maxY - bounds.minY),
  };
}

export function computeMinimapModel({
  bounds,
  player,
  enemies = [],
  boss = null,
  pointsOfInterest = [],
  discovery,
} = {}) {
  if (!bounds || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) {
    throw new TypeError('bounds and a finite player position are required');
  }
  if (!(discovery?.discoveredPoiIds instanceof Set)) throw new TypeError('discovery state is required');

  const radius = MINIMAP_VISIBILITY_RADIUS;

  const liveEnemies = [];
  for (const enemy of enemies) {
    if (!enemy?.active || !(enemy.health > 0)) continue;
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance > radius) continue;
    liveEnemies.push({ id: enemy.id, distance, worldX: enemy.x, worldY: enemy.y });
  }
  liveEnemies.sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : 1));
  const enemyMarkers = liveEnemies.slice(0, MAX_ENEMY_MARKERS).map((enemy) => ({
    id: enemy.id,
    kind: 'enemy',
    ...normalize(bounds, enemy.worldX, enemy.worldY),
  }));

  let bossMarker = null;
  if (boss?.active && boss.health > 0
    && Math.hypot(boss.x - player.x, boss.y - player.y) <= radius) {
    bossMarker = { kind: 'boss', ...normalize(bounds, boss.x, boss.y) };
  }

  // Discovery is monotonic: entering visibility of a POI records it forever.
  for (const poi of pointsOfInterest) {
    if (discovery.discoveredPoiIds.has(poi.id)) continue;
    if (Math.hypot(poi.anchor.x - player.x, poi.anchor.y - player.y) <= radius) {
      discovery.discoveredPoiIds.add(poi.id);
    }
  }
  const poiMarkers = pointsOfInterest
    .filter((poi) => discovery.discoveredPoiIds.has(poi.id))
    .map((poi) => ({
      id: poi.id,
      kind: 'poi',
      hook: poi.hook,
      worldX: poi.anchor.x,
      worldY: poi.anchor.y,
      ...normalize(bounds, poi.anchor.x, poi.anchor.y),
    }));

  return {
    player: { kind: 'player', ...normalize(bounds, player.x, player.y) },
    enemies: enemyMarkers,
    boss: bossMarker,
    pointsOfInterest: poiMarkers,
    visibilityRadius: radius,
  };
}
