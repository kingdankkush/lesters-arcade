const freeze = (value) => Object.freeze(value);

export const GRENADE_AIM_INPUT = freeze({
  tapThresholdMs: 150,
  minTiles: 2.5,
});

export const GRENADE_AIM_TYPES = freeze({
  'satoshi-frag': freeze({ id: 'satoshi-frag', minRange: 2.5, maxRange: 7, chargeMs: 900, preview: 'lob-ellipse', cancelDragTiles: 1.25 }),
  'launcher-rig': freeze({ id: 'launcher-rig', minRange: 3, maxRange: 11, chargeMs: 650, preview: 'flat-line', cancelDragTiles: 1.25 }),
  'homing-cluster': freeze({ id: 'homing-cluster', minRange: 0, maxRange: 7, chargeMs: 250, preview: 'cluster-lock', cancelDragTiles: 1.25 }),
  'block-buster': freeze({ id: 'block-buster', minRange: 2.5, maxRange: 6, chargeMs: 1050, preview: 'heavy-blast-ring', cancelDragTiles: 1.25 }),
});

export function grenadeAimType(typeId = 'satoshi-frag') {
  return GRENADE_AIM_TYPES[typeId] ?? GRENADE_AIM_TYPES['satoshi-frag'];
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizedAim(aimX = 1, aimY = 0) {
  const x = Number(aimX);
  const y = Number(aimY);
  const len = Math.hypot(x, y) || 1;
  return freeze({ x: x / len, y: y / len });
}

export function grenadeChargeProgress({ heldMs = 0, chargeMs = 900 } = {}) {
  const t = clamp01((Number(heldMs) || 0) / Math.max(1, Number(chargeMs) || 900));
  // Ease-out cubic: fast initial response, still reaches max predictably.
  return 1 - Math.pow(1 - t, 3);
}

export function grenadeAimDistance({ typeId = 'satoshi-frag', heldMs = 0 } = {}) {
  const type = grenadeAimType(typeId);
  const t = grenadeChargeProgress({ heldMs, chargeMs: type.chargeMs });
  return type.minRange + (type.maxRange - type.minRange) * t;
}

export function classifyGrenadeRelease({ heldMs = 0, canceled = false, thresholdMs = GRENADE_AIM_INPUT.tapThresholdMs } = {}) {
  if (canceled) return 'cancel';
  return (Number(heldMs) || 0) < thresholdMs ? 'quick' : 'aimed';
}

export function buildGrenadeAimPreview({
  typeId = 'satoshi-frag',
  heldMs = 0,
  playerX = 0,
  playerY = 0,
  aimX = 1,
  aimY = 0,
  blastRadius = 2,
  radiusMultiplier = 1,
  enemies = [],
} = {}) {
  const type = grenadeAimType(typeId);
  const aim = normalizedAim(aimX, aimY);
  const radius = Math.max(0.25, (Number(blastRadius) || 2) * Math.max(0.1, Number(radiusMultiplier) || 1));
  if (type.preview === 'cluster-lock') {
    const living = enemies.filter((enemy) => enemy && (enemy.hp ?? 1) > 0);
    let best = null;
    let bestScore = -Infinity;
    for (const enemy of living) {
      const nearby = living.filter((other) => Math.hypot((other.mapX ?? 0) - (enemy.mapX ?? 0), (other.mapY ?? 0) - (enemy.mapY ?? 0)) <= radius * 1.8).length;
      const distancePenalty = Math.hypot((enemy.mapX ?? 0) - playerX, (enemy.mapY ?? 0) - playerY) * 0.08;
      const score = nearby - distancePenalty;
      if (score > bestScore) { bestScore = score; best = enemy; }
    }
    if (best) {
      const dx = (best.mapX ?? playerX) - playerX;
      const dy = (best.mapY ?? playerY) - playerY;
      const dir = normalizedAim(dx, dy);
      const distance = Math.min(type.maxRange, Math.hypot(dx, dy));
      return freeze({
        mode: 'homing-lock',
        typeId: type.id,
        preview: type.preview,
        aimX: dir.x,
        aimY: dir.y,
        distance,
        landX: best.mapX ?? playerX,
        landY: best.mapY ?? playerY,
        lockedEnemyId: best.id ?? best.enemyKey ?? null,
        marker: freeze({ kind: 'grenade-reticle', variant: type.preview, x: best.mapX ?? playerX, y: best.mapY ?? playerY, radius }),
      });
    }
  }
  const distance = grenadeAimDistance({ typeId: type.id, heldMs });
  const landX = Number(playerX) + aim.x * distance;
  const landY = Number(playerY) + aim.y * distance;
  return freeze({
    mode: 'manual-target',
    typeId: type.id,
    preview: type.preview,
    aimX: aim.x,
    aimY: aim.y,
    distance,
    landX,
    landY,
    marker: freeze({ kind: 'grenade-reticle', variant: type.preview, x: landX, y: landY, radius }),
  });
}

export function isGrenadeAimCancel({ startX = 0, startY = 0, currentX = 0, currentY = 0, cancelZoneY = -Infinity, secondFingerTap = false } = {}) {
  if (secondFingerTap) return true;
  return Number(currentY) <= Number(cancelZoneY) && Math.hypot(Number(currentX) - Number(startX), Number(currentY) - Number(startY)) > 24;
}
