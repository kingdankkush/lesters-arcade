import { COVER_RULES_V1 } from './cover-system.mjs';

// Reads the current cover face; never calls the damage reducer or writes back
// to cover, counters, hero position or input. Two paths, no filter or texture.
export function createCoverReadability({ badge = null } = {}) {
  // Pixi Polygon accepts a plain numeric array; a typed array is interpreted
  // as a point object and compiles into undefined coordinates.
  const edge = [0, 0, 0, 0];
  function reset() {
    if (badge && !badge.hidden) badge.hidden = true;
  }
  return {
    reset,
    draw({ graphics, cover, hero, project, zoom = 1 }) {
      const valid = cover?.phase === 'cover' && (cover.kind === 'tall' || cover.kind === 'short')
        && Number.isFinite(cover.anchor?.x) && Number.isFinite(cover.anchor?.y)
        && Number.isFinite(cover.tangent?.x) && Number.isFinite(cover.tangent?.y)
        && Number.isFinite(cover.along) && Number.isFinite(cover.length)
        && Number.isFinite(hero?.groundZ) && Number.isFinite(zoom)
        && cover.length > 0 && zoom > 0;
      if (!valid) { reset(); return; }
      const reduction = Math.round(100 * (1 - COVER_RULES_V1[`${cover.kind}DamageMultiplier`]));
      if (badge) {
        const text = `${reduction}% cover`;
        if (badge.textContent !== text) badge.textContent = text;
        const title = `${cover.kind === 'tall' ? 'Tall' : 'Short'} cover: ${reduction}% less damage from the covered side. Move away to leave.`;
        if (badge.title !== title) badge.title = title;
        if (badge.hidden) badge.hidden = false;
      }
      const from = Math.max(0, cover.along - 48), to = Math.min(cover.length, cover.along + 48);
      const z = hero.groundZ + .5;
      const a = project({ x: cover.anchor.x + cover.tangent.x * from, y: cover.anchor.y + cover.tangent.y * from, z });
      const b = project({ x: cover.anchor.x + cover.tangent.x * to, y: cover.anchor.y + cover.tangent.y * to, z });
      edge[0] = a.x; edge[1] = a.y; edge[2] = b.x; edge[3] = b.y;
      // Each stroke owns its path: Pixi consumes the previous path on stroke.
      graphics.poly(edge, false).stroke({ color: 0x102a31, alpha: .8, width: 6, cap: 'round' });
      graphics.poly(edge, false).stroke({ color: 0x8ce0cf, alpha: .85, width: 2, cap: 'round' });
    },
  };
}
