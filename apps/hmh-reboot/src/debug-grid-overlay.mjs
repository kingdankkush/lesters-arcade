import { finite, freezeDeep } from './value-guards.mjs';

export function buildDebugGridOverlay({ bounds = { minX: 0, minY: 0, maxX: 4096, maxY: 4096 }, spacing, queryGround }) {
  const worldBounds = Object.freeze({
    minX: finite(bounds.minX, 'bounds.minX'), minY: finite(bounds.minY, 'bounds.minY'),
    maxX: finite(bounds.maxX, 'bounds.maxX'), maxY: finite(bounds.maxY, 'bounds.maxY'),
  });
  if (worldBounds.maxX <= worldBounds.minX || worldBounds.maxY <= worldBounds.minY) throw new TypeError('bounds must have positive finite area');
  finite(spacing, 'grid spacing');
  if (spacing <= 0) throw new TypeError('grid spacing must be positive');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  const lines = [];
  const labels = [];
  for (let x = worldBounds.minX; x <= worldBounds.maxX + Number.EPSILON; x += spacing) {
    lines.push({ axis: 'x', value: x, from: { x, y: worldBounds.minY }, to: { x, y: worldBounds.maxY } });
  }
  for (let y = worldBounds.minY; y <= worldBounds.maxY + Number.EPSILON; y += spacing) {
    lines.push({ axis: 'y', value: y, from: { x: worldBounds.minX, y }, to: { x: worldBounds.maxX, y } });
  }
  for (let y = worldBounds.minY; y <= worldBounds.maxY + Number.EPSILON; y += spacing) {
    for (let x = worldBounds.minX; x <= worldBounds.maxX + Number.EPSILON; x += spacing) {
      const height = finite(queryGround(x, y)?.groundZ, 'debug ground height');
      labels.push({ x, y, height, text: `x=${x} y=${y} h=${height}` });
    }
  }
  return freezeDeep({ bounds: worldBounds, spacing, lines, labels });
}
