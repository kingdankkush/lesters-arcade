const DIRECTIONS = Object.freeze(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);

export const HMH_HURTBOX_TRUTH_POLICY = Object.freeze({
  id: 'wo108-sprite-derived-hurtbox-truth-v1',
  workOrder: 'WO-108',
  scalePolicy: 'runtime-scale-100-percent',
  bodyBox: 'broad readable body/collision silhouette derived from draw dimensions',
  hurtBox: 'smaller vulnerable core derived per facing so hair/weapons/empty wings do not take damage',
  bossCapsules: 'large actors use multiple vertical capsules instead of globally scaling sprites down',
  debugOverlay: 'debugHitboxes renderer consumes precomputed body/hurt/capsule descriptors',
});

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedRect(rect) {
  return Object.freeze({
    x: Number(rect.x.toFixed(3)),
    y: Number(rect.y.toFixed(3)),
    w: Number(rect.w.toFixed(3)),
    h: Number(rect.h.toFixed(3)),
  });
}

function directionBias(direction) {
  switch (direction) {
    case 'east': return { x: 0.055, y: 0 };
    case 'west': return { x: -0.055, y: 0 };
    case 'south': return { x: 0, y: 0.035 };
    case 'north': return { x: 0, y: -0.045 };
    case 'south-east': return { x: 0.04, y: 0.025 };
    case 'north-east': return { x: 0.04, y: -0.035 };
    case 'north-west': return { x: -0.04, y: -0.035 };
    case 'south-west': return { x: -0.04, y: 0.025 };
    default: return { x: 0, y: 0 };
  }
}

function buildBossCapsules({ drawWidth, drawHeight, direction }) {
  const bias = directionBias(direction);
  const centerX = bias.x * drawWidth;
  const top = -drawHeight;
  const headH = drawHeight * 0.24;
  const torsoH = drawHeight * 0.42;
  const legH = drawHeight * 0.26;
  const radius = clamp(drawWidth * 0.18, 12, 46);
  return Object.freeze([
    Object.freeze({ kind: 'head', x: Number(centerX.toFixed(3)), y: Number((top + headH * 0.5).toFixed(3)), radius: Number((radius * 0.86).toFixed(3)), h: Number(headH.toFixed(3)) }),
    Object.freeze({ kind: 'torso', x: Number((centerX * 0.6).toFixed(3)), y: Number((top + headH + torsoH * 0.5).toFixed(3)), radius: Number((radius * 1.32).toFixed(3)), h: Number(torsoH.toFixed(3)) }),
    Object.freeze({ kind: 'legs', x: Number((centerX * 0.35).toFixed(3)), y: Number((top + headH + torsoH + legH * 0.5).toFixed(3)), radius: Number((radius * 1.08).toFixed(3)), h: Number(legH.toFixed(3)) }),
  ]);
}

function debugLayer(kind, rect, stroke, fill) {
  return Object.freeze({
    kind,
    rect,
    stroke,
    fill,
    lineWidth: kind === 'hurt' ? 2 : 1,
  });
}

export function deriveSpriteHitProfile({ actorKey = 'unknown-actor', drawWidth = 0, drawHeight = 0, direction = 'south', boss = false } = {}) {
  const width = Math.max(1, finiteNumber(drawWidth, 1));
  const height = Math.max(1, finiteNumber(drawHeight, 1));
  const facing = DIRECTIONS.includes(direction) ? direction : 'south';
  const bias = directionBias(facing);

  const bodyW = clamp(width * (boss ? 0.66 : 0.58), 14, width * 0.9);
  const bodyH = clamp(height * (boss ? 0.76 : 0.7), 18, height * 0.9);
  const bodyBox = roundedRect({
    x: -bodyW / 2 + bias.x * width * 0.45,
    y: -bodyH,
    w: bodyW,
    h: bodyH,
  });

  const hurtW = clamp(width * (boss ? 0.48 : 0.42), 10, bodyW * 0.9);
  const hurtH = clamp(height * (boss ? 0.58 : 0.56), 12, bodyH * 0.86);
  const hurtBox = roundedRect({
    x: -hurtW / 2 + bias.x * width,
    y: -hurtH + height * 0.05 + bias.y * height,
    w: hurtW,
    h: hurtH,
  });

  const bossCapsules = boss ? buildBossCapsules({ drawWidth: width, drawHeight: height, direction: facing }) : Object.freeze([]);
  const debugHitboxes = Object.freeze({
    body: debugLayer('body', bodyBox, '#3aa7ff', 'rgba(58, 167, 255, 0.12)'),
    hurt: debugLayer('hurt', hurtBox, '#ff3a5e', 'rgba(255, 58, 94, 0.16)'),
    bossCapsules: Object.freeze(bossCapsules.map((capsule) => Object.freeze({
      kind: 'boss-capsule',
      capsule,
      stroke: '#ffd166',
      fill: 'rgba(255, 209, 102, 0.14)',
      lineWidth: 2,
    }))),
  });

  return Object.freeze({
    policyId: HMH_HURTBOX_TRUTH_POLICY.id,
    actorKey,
    direction: facing,
    drawWidth: width,
    drawHeight: height,
    boss: Boolean(boss),
    scalePolicy: HMH_HURTBOX_TRUTH_POLICY.scalePolicy,
    bodyBox,
    hurtBox,
    bossCapsules,
    debugHitboxes,
  });
}

export function deriveSpriteHitProfilesForDirections(options = {}) {
  return Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    deriveSpriteHitProfile({ ...options, direction }),
  ])));
}

function translateRect(rect, screenX, screenY) {
  return Object.freeze({
    x: Number((screenX + rect.x).toFixed(3)),
    y: Number((screenY + rect.y).toFixed(3)),
    w: rect.w,
    h: rect.h,
  });
}

function translateCapsule(capsule, screenX, screenY) {
  return Object.freeze({
    ...capsule,
    x: Number((screenX + capsule.x).toFixed(3)),
    y: Number((screenY + capsule.y).toFixed(3)),
  });
}

export function buildDebugHitboxOverlayModel(profile, { screenX = 0, screenY = 0, enabled = false } = {}) {
  if (!enabled || !profile) {
    return Object.freeze({ enabled: false, actorKey: profile?.actorKey ?? null, layers: Object.freeze([]) });
  }
  const sx = finiteNumber(screenX, 0);
  const sy = finiteNumber(screenY, 0);
  const layers = [
    Object.freeze({ ...profile.debugHitboxes.body, rect: translateRect(profile.bodyBox, sx, sy) }),
    Object.freeze({ ...profile.debugHitboxes.hurt, rect: translateRect(profile.hurtBox, sx, sy) }),
    ...profile.debugHitboxes.bossCapsules.map((layer) => Object.freeze({
      ...layer,
      capsule: translateCapsule(layer.capsule, sx, sy),
    })),
  ];
  return Object.freeze({
    enabled: true,
    policyId: profile.policyId,
    actorKey: profile.actorKey,
    direction: profile.direction,
    layers: Object.freeze(layers),
  });
}
