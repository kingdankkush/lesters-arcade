const DEFAULT_OUTLINE = 0xffffff;
const DEFAULT_HEAD = 0xd7e0e8;

function freezePart(id, geometry) {
  return Object.freeze({ id, geometry: Object.freeze(geometry) });
}

function finiteRadius(radius) {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('radius must be a positive finite number');
  return radius;
}

export function createPrototypeHumanoidDescriptor({
  radius,
  bodyColor,
  outlineColor = DEFAULT_OUTLINE,
  headColor = DEFAULT_HEAD,
  weapon = false,
} = {}) {
  const actorRadius = finiteRadius(radius);
  if (!Number.isInteger(bodyColor) || bodyColor < 0 || bodyColor > 0xffffff) {
    throw new RangeError('bodyColor must be a 24-bit integer');
  }

  const parts = Object.freeze([
    freezePart('head', {
      type: 'circle',
      x: 0,
      y: actorRadius * -0.65,
      radius: actorRadius * 0.28,
    }),
    freezePart('torso', {
      type: 'ellipse',
      x: 0,
      y: actorRadius * -0.02,
      radiusX: actorRadius * 0.46,
      radiusY: actorRadius * 0.52,
    }),
    freezePart('left-arm', {
      type: 'line',
      fromX: actorRadius * -0.34,
      fromY: actorRadius * -0.22,
      toX: actorRadius * -0.72,
      toY: actorRadius * 0.24,
    }),
    freezePart('right-arm', {
      type: 'line',
      fromX: actorRadius * 0.34,
      fromY: actorRadius * -0.22,
      toX: actorRadius * 0.72,
      toY: actorRadius * 0.24,
    }),
    freezePart('left-leg', {
      type: 'line',
      fromX: actorRadius * -0.2,
      fromY: actorRadius * 0.34,
      toX: actorRadius * -0.38,
      toY: actorRadius * 0.86,
    }),
    freezePart('right-leg', {
      type: 'line',
      fromX: actorRadius * 0.2,
      fromY: actorRadius * 0.34,
      toX: actorRadius * 0.38,
      toY: actorRadius * 0.86,
    }),
  ]);

  const weaponDescriptor = weapon
    ? Object.freeze({
        id: 'rifle',
        geometry: Object.freeze({
          type: 'line',
          fromX: actorRadius * 0.18,
          fromY: actorRadius * -0.28,
          toX: actorRadius * 0.18,
          toY: actorRadius * -0.96,
        }),
      })
    : null;

  return Object.freeze({
    kind: 'prototype-human-graybox',
    radius: actorRadius,
    bodyColor,
    outlineColor,
    headColor,
    limbWidth: Math.max(3, actorRadius * 0.22),
    parts,
    weapon: weaponDescriptor,
  });
}

function drawLine(graphics, geometry, style) {
  graphics
    .moveTo(geometry.fromX, geometry.fromY)
    .lineTo(geometry.toX, geometry.toY)
    .stroke(style);
}

export function drawPrototypeHumanoid(graphics, descriptor) {
  if (!graphics || typeof graphics.moveTo !== 'function') throw new TypeError('graphics adapter is required');
  if (descriptor?.kind !== 'prototype-human-graybox') throw new TypeError('prototype human descriptor is required');

  const limbStyle = {
    color: descriptor.bodyColor,
    width: descriptor.limbWidth,
    alpha: 0.96,
    cap: 'round',
  };
  for (const part of descriptor.parts.filter((candidate) => candidate.geometry.type === 'line')) {
    drawLine(graphics, part.geometry, limbStyle);
  }

  if (descriptor.weapon) {
    drawLine(graphics, descriptor.weapon.geometry, {
      color: 0xf1d37a,
      width: Math.max(3, descriptor.radius * 0.16),
      alpha: 1,
      cap: 'round',
    });
  }

  const torso = descriptor.parts.find((part) => part.id === 'torso').geometry;
  graphics
    .ellipse(torso.x, torso.y, torso.radiusX, torso.radiusY)
    .fill({ color: descriptor.bodyColor, alpha: 0.98 })
    .stroke({ color: descriptor.outlineColor, width: Math.max(2, descriptor.radius * 0.11), alpha: 0.96 });

  const head = descriptor.parts.find((part) => part.id === 'head').geometry;
  graphics
    .circle(head.x, head.y, head.radius)
    .fill({ color: descriptor.headColor, alpha: 1 })
    .stroke({ color: descriptor.outlineColor, width: Math.max(2, descriptor.radius * 0.1), alpha: 0.98 });

  graphics.label = descriptor.kind;
  return graphics;
}
