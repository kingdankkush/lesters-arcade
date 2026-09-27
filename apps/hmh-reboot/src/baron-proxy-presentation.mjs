// Greybox proxy for the Rug Pull Baron (slice S3.1, dark behind bossesV2).
// Package 4.4's art (his own rig from art wave 1) replaces the body; until
// then he is drawn as a plain human figure that keeps his top-plane read, "a
// disc on a diagonal bar": a wide black gambler's hat over a pear-shaped body
// in a cutaway jacket, oxblood waistcoat and a cream shirt, with the rolled
// carpet strapped diagonally across his back until phase 2 puts it on the
// floor. Nothing glows (package 4.4 palette: dust brown, black and cream;
// non-emissive oxblood and gold).
//
// The arena dressing is drawn on the ground layer: the carpet in its phase
// shape (whole, rolled, torn into strips), the brass anchor-peg rings (lit
// green, where a yank cannot pull), the Welcome Mat, the yank's chevrons
// streaming in the pull direction while a tell or a slide runs, and the gold
// top-hat ring where an Exit Scam will land. Projection only: every shape and
// tick comes from the boss state and the arena; nothing here is written back.
import { baronCarpetRects } from './rug-pull-baron-boss.mjs';

export const BARON_PROXY_COLORS = Object.freeze({
  carpet: 0x6e1c26,
  carpetBorder: 0xc9a227,
  peg: 0x83f28f,
  mat: 0x8a2b2b,
  hat: 0x14110f,
  hatBand: 0x6b1f2a,
  jacket: 0x1d1a18,
  waistcoat: 0x6b1f2a,
  shirt: 0xe8d9b0,
  skin: 0xd9a47a,
  trousers: 0x4a4a4a,
  spats: 0xf2efe6,
  rug: 0x7a2130,
  rugGold: 0xc9a227,
  chevron: 0xffc857,
});

const rectPoints = (r) => [{ x: r.minX, y: r.minY }, { x: r.maxX, y: r.minY }, { x: r.maxX, y: r.maxY }, { x: r.minX, y: r.maxY }];

function drawArena(ground, { arena, phaseIndex, project, zoom, tick, mat }) {
  let primitives = 0;
  for (const rect of baronCarpetRects(arena, phaseIndex)) {
    ground.poly(rectPoints(rect).map(project).flatMap((p) => [p.x, p.y]), true)
      .fill({ color: BARON_PROXY_COLORS.carpet, alpha: 0.72 })
      .stroke({ color: BARON_PROXY_COLORS.carpetBorder, width: 3, alpha: 0.9 });
    primitives += 1;
  }
  // The centre medallion (the trapdoor he climbs out of).
  const medallion = project(arena.spawn);
  ground.circle(medallion.x, medallion.y, 34 * zoom).stroke({ color: BARON_PROXY_COLORS.carpetBorder, width: 2, alpha: 0.8 });
  primitives += 1;
  for (const peg of arena.pegs) {
    const p = project(peg);
    ground.circle(p.x, p.y, arena.pegRadius * zoom).fill({ color: BARON_PROXY_COLORS.peg, alpha: 0.12 }).stroke({ color: BARON_PROXY_COLORS.peg, width: 2, alpha: 0.85 });
    ground.circle(p.x, p.y, 6 * zoom).fill({ color: BARON_PROXY_COLORS.carpetBorder, alpha: 1 });
    primitives += 2;
  }
  if (mat) {
    const half = { x: mat.radius, y: mat.radius * 0.62 };
    ground.poly(rectPoints({ minX: mat.x - half.x, minY: mat.y - half.y, maxX: mat.x + half.x, maxY: mat.y + half.y }).map(project).flatMap((p) => [p.x, p.y]), true)
      .fill({ color: BARON_PROXY_COLORS.mat, alpha: 0.9 })
      .stroke({ color: BARON_PROXY_COLORS.carpetBorder, width: 3, alpha: 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(tick / 12)) });
    primitives += 1;
  }
  return primitives;
}

// Three rows of chevrons per field, streaming along its pull.
function drawChevrons(ground, { fields, project, zoom, tick, alpha }) {
  let primitives = 0;
  for (const field of fields) {
    const { rect, pull } = field;
    const length = Math.hypot(pull.x, pull.y) || 1;
    const d = { x: pull.x / length, y: pull.y / length };
    const across = { x: -d.y, y: d.x };
    const centre = { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };
    const halfAlong = Math.abs(d.x) > 0 ? (rect.maxX - rect.minX) / 2 : (rect.maxY - rect.minY) / 2;
    const halfAcross = Math.abs(d.x) > 0 ? (rect.maxY - rect.minY) / 2 : (rect.maxX - rect.minX) / 2;
    const drift = ((tick * 3) % 60) - 30;
    for (let row = -1; row <= 1; row += 1) {
      for (let k = -2; k <= 2; k += 1) {
        const along = k * 60 + drift;
        if (Math.abs(along) > halfAlong - 16) continue;
        const base = { x: centre.x + d.x * along + across.x * row * halfAcross * 0.55, y: centre.y + d.y * along + across.y * row * halfAcross * 0.55 };
        const tip = project({ x: base.x + d.x * 14, y: base.y + d.y * 14 });
        const left = project({ x: base.x - d.x * 6 + across.x * 12, y: base.y - d.y * 6 + across.y * 12 });
        const right = project({ x: base.x - d.x * 6 - across.x * 12, y: base.y - d.y * 6 - across.y * 12 });
        ground.moveTo(left.x, left.y).lineTo(tip.x, tip.y).lineTo(right.x, right.y).stroke({ color: BARON_PROXY_COLORS.chevron, width: 3 * Math.max(0.6, zoom), alpha });
        primitives += 1;
      }
    }
  }
  return primitives;
}

// The body: feet at `foot` (screen), `scale` screen px per world unit.
function drawBody(body, { foot, scale, facing, phaseIndex, alpha, stagger }) {
  const s = scale;
  const lean = stagger ? 0.18 : 0;
  const side = facing.x >= 0 ? 1 : -1;
  const x = (dx, dy) => foot.x + (dx + dy * lean * side) * s;
  const y = (dy) => foot.y - dy * s;
  // Thin legs in striped trousers and white spats.
  body.moveTo(x(-7, 0), y(0)).lineTo(x(-6, 30), y(30)).moveTo(x(7, 0), y(0)).lineTo(x(6, 30), y(30))
    .stroke({ color: BARON_PROXY_COLORS.trousers, width: 6 * s, alpha });
  body.ellipse(x(-7, 2), y(2), 6 * s, 3 * s).ellipse(x(7, 2), y(2), 6 * s, 3 * s).fill({ color: BARON_PROXY_COLORS.spats, alpha });
  // Pear body: cream belly under an oxblood waistcoat, black cutaway jacket.
  body.ellipse(x(0, 46), y(46), 21 * s, 20 * s).fill({ color: BARON_PROXY_COLORS.jacket, alpha });
  body.ellipse(x(0, 46), y(46), 14 * s, 17 * s).fill({ color: BARON_PROXY_COLORS.waistcoat, alpha });
  body.ellipse(x(0, 43), y(43), 7 * s, 10 * s).fill({ color: BARON_PROXY_COLORS.shirt, alpha });
  // Arms, thumbs in the lapels.
  body.moveTo(x(-15, 58), y(58)).lineTo(x(-18, 40), y(40)).moveTo(x(15, 58), y(58)).lineTo(x(18, 40), y(40))
    .stroke({ color: BARON_PROXY_COLORS.jacket, width: 6 * s, alpha });
  // Head.
  body.circle(x(0, 70), y(70), 8 * s).fill({ color: BARON_PROXY_COLORS.skin, alpha });
  // The rolled carpet across his back (phase 1 only): the diagonal bar.
  if (phaseIndex === 0) {
    body.moveTo(x(-22, 34), y(34)).lineTo(x(22, 66), y(66)).stroke({ color: BARON_PROXY_COLORS.rug, width: 9 * s, alpha, cap: 'round' });
    body.moveTo(x(-22, 34), y(34)).lineTo(x(22, 66), y(66)).stroke({ color: BARON_PROXY_COLORS.rugGold, width: 2 * s, alpha });
  }
  // The hat: a disc wider than his shoulders (dented and ripped later).
  const brim = phaseIndex >= 2 ? 22 : 27;
  body.ellipse(x(0, 78), y(78), brim * s, 7 * s).fill({ color: BARON_PROXY_COLORS.hat, alpha });
  body.roundRect(x(-9, 88), y(88), 18 * s, 10 * s, 3 * s).fill({ color: BARON_PROXY_COLORS.hat, alpha });
  body.rect(x(-9, 80), y(80), 18 * s, 2.5 * s).fill({ color: BARON_PROXY_COLORS.hatBand, alpha });
  return 12;
}

export function renderBaronProxy({ ground, body, slot, arena, mat = null, tick, camera, view, worldToScreen, deathUntil = -1 } = {}) {
  if (!ground || !body || !arena || typeof worldToScreen !== 'function') throw new TypeError('ground, body, arena and worldToScreen are required');
  const zoom = camera.zoom;
  const project = (p) => worldToScreen({ x: p.x, y: p.y, z: 0 }, camera, view);
  const boss = slot?.boss ?? null;
  const phaseIndex = slot?.status === 'defeated' ? 2 : boss?.phaseIndex ?? 0;
  let primitives = drawArena(ground, { arena, phaseIndex, project, zoom, tick, mat: slot?.status === 'live' || slot?.status === 'defeated' ? null : mat });
  // The crates roll in with the boulders (they are closed like locks).
  for (const prop of arena.props ?? []) {
    if (!slot?.closedWalls.includes(prop.id)) continue;
    const c = prop.shape.a;
    const r = prop.shape.radius;
    ground.poly(rectPoints({ minX: c.x - r, minY: c.y - r, maxX: c.x + r, maxY: c.y + r }).map(project).flatMap((p) => [p.x, p.y]), true)
      .fill({ color: 0x6b4a2b, alpha: 0.95 }).stroke({ color: 0x2a1c10, width: 3, alpha: 0.95 });
    primitives += 1;
  }
  body.visible = false;
  if (!boss) return Object.freeze({ primitives, bodyVisible: false });
  // The yank's chevrons: faint during the tell, bright while bodies slide.
  const telling = boss.pendingAttacks.filter((pending) => pending.yank);
  for (const pending of telling) primitives += drawChevrons(ground, { fields: pending.yank.fields, project, zoom, tick, alpha: 0.35 });
  for (const drift of boss.drifts) if (tick >= drift.fromTick && tick <= drift.untilTick) primitives += drawChevrons(ground, { fields: drift.fields, project, zoom, tick, alpha: 0.9 });
  // The gold top-hat ring glows at the landing 45 ticks before he lands.
  if (boss.vanish && tick >= boss.vanish.untilTick - 45) {
    const p = project(boss.vanish.target);
    ground.circle(p.x, p.y, 40 * zoom).stroke({ color: BARON_PROXY_COLORS.carpetBorder, width: 4, alpha: 0.9 });
    primitives += 1;
  }
  const visible = !boss.vanished && (boss.active || tick < deathUntil);
  if (!visible) return Object.freeze({ primitives, bodyVisible: false });
  const intro = boss.startTick + boss.introTicks - tick;
  const alpha = !boss.active ? Math.max(0.15, 1 - (tick - (deathUntil - 45)) / 45) : intro > 0 ? Math.max(0.2, 1 - intro / boss.introTicks) : 1;
  const foot = worldToScreen({ x: boss.x, y: boss.y, z: boss.groundZ }, camera, view);
  body.clear();
  primitives += drawBody(body, { foot, scale: zoom, facing: boss.facing ?? { x: 0, y: 1 }, phaseIndex: boss.phaseIndex, alpha, stagger: tick <= boss.staggerUntil });
  body.visible = true;
  return Object.freeze({ primitives, bodyVisible: true });
}
