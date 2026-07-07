const POLICY_ID = 'wo108-sprite-derived-hurtbox-truth-v1';

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function bias(direction = 'south') {
  if (direction.includes('east')) return { x: 0.04, y: direction.includes('north') ? -0.035 : 0.025 };
  if (direction.includes('west')) return { x: -0.04, y: direction.includes('north') ? -0.035 : 0.025 };
  if (direction === 'north') return { x: 0, y: -0.045 };
  if (direction === 'south') return { x: 0, y: 0.035 };
  return { x: 0, y: 0 };
}

function rect(x, y, w, h) {
  return Object.freeze({ x: +x.toFixed(3), y: +y.toFixed(3), w: +w.toFixed(3), h: +h.toFixed(3) });
}

function capsules(width, height, direction) {
  const b = bias(direction);
  const centerX = b.x * width;
  const top = -height;
  const headH = height * 0.24;
  const torsoH = height * 0.42;
  const legH = height * 0.26;
  const radius = clamp(width * 0.18, 12, 46);
  return Object.freeze([
    Object.freeze({ kind: 'head', x: +centerX.toFixed(3), y: +(top + headH * 0.5).toFixed(3), radius: +(radius * 0.86).toFixed(3), h: +headH.toFixed(3) }),
    Object.freeze({ kind: 'torso', x: +(centerX * 0.6).toFixed(3), y: +(top + headH + torsoH * 0.5).toFixed(3), radius: +(radius * 1.32).toFixed(3), h: +torsoH.toFixed(3) }),
    Object.freeze({ kind: 'legs', x: +(centerX * 0.35).toFixed(3), y: +(top + headH + torsoH + legH * 0.5).toFixed(3), radius: +(radius * 1.08).toFixed(3), h: +legH.toFixed(3) }),
  ]);
}

function boundsForCapsules(list, sx, sy) {
  const boxes = list.map((c) => ({ x1: sx + c.x - c.radius, y1: sy + c.y - c.h / 2, x2: sx + c.x + c.radius, y2: sy + c.y + c.h / 2 }));
  const x1 = Math.min(...boxes.map((box) => box.x1));
  const y1 = Math.min(...boxes.map((box) => box.y1));
  const x2 = Math.max(...boxes.map((box) => box.x2));
  const y2 = Math.max(...boxes.map((box) => box.y2));
  return rect(x1, y1, x2 - x1, y2 - y1);
}

function layer(kind, box, stroke, fill) {
  return Object.freeze({ kind, rect: box, stroke, fill, lineWidth: kind === 'hurt' ? 2 : 1 });
}

export function buildRuntimeSpriteHitboxes({ actorKey = 'unknown-actor', screenX = 0, screenY = 0, drawWidth = 1, drawHeight = 1, direction = 'south', boss = false, debugHitboxes = false } = {}) {
  const sx = n(screenX);
  const sy = n(screenY);
  const width = Math.max(1, n(drawWidth, 1));
  const height = Math.max(1, n(drawHeight, 1));
  const b = bias(direction);
  const bodyW = clamp(width * (boss ? 0.66 : 0.58), 14, width * 0.9);
  const bodyH = clamp(height * (boss ? 0.76 : 0.7), 18, height * 0.9);
  const hurtW = clamp(width * (boss ? 0.48 : 0.42), 10, bodyW * 0.9);
  const hurtH = clamp(height * (boss ? 0.58 : 0.56), 12, bodyH * 0.86);
  const bodyBox = rect(sx - bodyW / 2 + b.x * width * 0.45, sy - bodyH, bodyW, bodyH);
  const hurtRect = rect(sx - hurtW / 2 + b.x * width, sy - hurtH + height * 0.05 + b.y * height, hurtW, hurtH);
  const bossCapsules = boss ? capsules(width, height, direction) : Object.freeze([]);
  const hurtBox = bossCapsules.length ? boundsForCapsules(bossCapsules, sx, sy) : hurtRect;
  const overlay = debugHitboxes ? Object.freeze({
    enabled: true,
    policyId: POLICY_ID,
    actorKey,
    direction,
    layers: Object.freeze([
      layer('body', bodyBox, '#3aa7ff', 'rgba(58, 167, 255, 0.12)'),
      layer('hurt', hurtRect, '#ff3a5e', 'rgba(255, 58, 94, 0.16)'),
      ...bossCapsules.map((capsule) => Object.freeze({ kind: 'boss-capsule', capsule: Object.freeze({ ...capsule, x: +(sx + capsule.x).toFixed(3), y: +(sy + capsule.y).toFixed(3) }), stroke: '#ffd166', fill: 'rgba(255, 209, 102, 0.14)', lineWidth: 2 })),
    ]),
  }) : Object.freeze({ enabled: false, actorKey, layers: Object.freeze([]) });
  return Object.freeze({ policyId: POLICY_ID, actorKey, direction, screenAnchor: Object.freeze({ x: sx, y: sy }), drawWidth: width, drawHeight: height, bodyBox, hurtBox, bossCapsules, collisionBox: hurtBox, overlay });
}

export function runtimeEnemyHitbox(enemy, options = {}) {
  const mini = Boolean(enemy?.miniBoss);
  const baseWidth = mini ? 68 : enemy?.class === 'armored' ? 42 : 30;
  const drawWidth = n(enemy?.runtimeDrawSize, mini ? 132 : enemy?.class === 'armored' ? 112 : 88);
  return buildRuntimeSpriteHitboxes({ actorKey: enemy?.id ?? enemy?.enemyKey ?? 'enemy', screenX: n(enemy?.x) + baseWidth / 2, screenY: n(enemy?.y), drawWidth, drawHeight: n(enemy?.runtimeDrawHeight, drawWidth), direction: enemy?.direction ?? enemy?.facing ?? 'south', boss: mini || Boolean(enemy?.finalBossProxy), debugHitboxes: options.debugHitboxes });
}

export function runtimeBossHitbox(boss, { groundY = 0, debugHitboxes = false } = {}) {
  if (!boss) return null;
  const phaseScale = 1 + (n(boss.phase, 1) - 1) * 0.08;
  const drawWidth = Math.round(150 * phaseScale);
  return buildRuntimeSpriteHitboxes({ actorKey: boss.id ?? boss.title ?? 'boss', screenX: n(boss.x) + 47, screenY: n(groundY) - 2, drawWidth, drawHeight: drawWidth, direction: boss.direction ?? 'south', boss: true, debugHitboxes });
}
