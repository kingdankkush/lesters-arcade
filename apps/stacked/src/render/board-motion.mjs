// Board motion (1.9.0 feel pass). Presentation only: it reads committed
// snapshots, keeps its own clock-driven state and moves the board container,
// never anything the simulation, evidence or result can see.
//
// - Lock thud: a damped spring on the board container. A lock kicks its
//   velocity so the board dips at most LOCK_THUD_PX (2 authored px) and rings
//   out; the closed-form response depends only on the frame clock.
// - Trauma shake: a HALVING, a ledger rise and a garbage-out top-out add
//   trauma (0..1); the shake is trauma squared, so small events stay subtle,
//   and trauma decays linearly. Reduced flashes halve it.
// - Row squash: cleared rows flatten in place over SQUASH_MS before the
//   collapsed stack shows through, drawn from the pre-lock board.
// - HALVING cue: static chevrons bracket the four cleared rows for
//   HALVING_CUE_MS, a shape (not a flash or motion) that also shows under
//   reduced motion and reduced flashes.
// Reduced motion (or zero effects intensity) zeroes the three motions.
import { locateCommittedLock } from './lock-projection.mjs';

export const LOCK_THUD_PX = 2;
export const SHAKE_MAX_PX = 7;
export const SQUASH_MS = 150;
export const HALVING_CUE_MS = 600;
export const TRAUMA = Object.freeze({ halving: .55, ledger: .18, garbageOut: .85 });
const OMEGA = 34, ZETA = .42, TRAUMA_DECAY_PER_S = 1.5, SPRING_MS = 420;
const DAMPED = OMEGA * Math.sqrt(1 - ZETA * ZETA);
// Peak displacement of x'' + 2ζωx' + ω²x = 0 from x = 0 with unit velocity.
const UNIT_PEAK = Math.exp(-ZETA * OMEGA * Math.atan2(DAMPED, ZETA * OMEGA) / DAMPED) / OMEGA;
const intensityFor = settings => settings?.accessibility?.reduceMotion ? 0 : Math.max(0, Math.min(1, settings?.video?.effectsIntensity ?? .7));

export function createBoardMotion() {
  let y0 = 0, v0 = 0, t0 = -1e9, trauma = 0, traumaAt = 0, squashAt = -1e9, squashRows = 0, lastTick = -1, halvingAt = -1e9, halvingRow = 1.5;
  const rows = new Int8Array(4).fill(-1), cells = new Uint8Array(40);
  const springAt = now => {
    const t = (now - t0) / 1000;
    if (t < 0 || t * 1000 >= SPRING_MS) return [0, 0];
    const e = Math.exp(-ZETA * OMEGA * t), c = Math.cos(DAMPED * t), s = Math.sin(DAMPED * t), b = (v0 + ZETA * OMEGA * y0) / DAMPED;
    return [e * (y0 * c + b * s), e * ((b * DAMPED - ZETA * OMEGA * y0) * c - (y0 * DAMPED + ZETA * OMEGA * b) * s)];
  };
  const traumaAtTime = now => Math.max(0, trauma - TRAUMA_DECAY_PER_S * Math.max(0, now - traumaAt) / 1000);
  const reset = () => { y0 = v0 = trauma = 0; t0 = squashAt = halvingAt = -1e9; squashRows = 0; rows.fill(-1); lastTick = -1; };
  const kick = (now, peakPx) => {
    const [y, v] = springAt(now), dv = peakPx / UNIT_PEAK;
    // Rapid locks re-kick from the live state, but never past one thud's energy.
    y0 = y; v0 = Math.min(v + dv, dv); t0 = now;
  };
  const addTrauma = (now, amount) => { trauma = Math.min(1, traumaAtTime(now) + amount); traumaAt = now; };
  const step = (before, after, now, settings, geometry = null) => {
    if (after.tick < before.tick || after.piecesLocked < before.piecesLocked) { reset(); return; }
    if (after.tick <= lastTick) return;
    lastTick = after.tick;
    const strength = intensityFor(settings);
    const halving = after.piecesLocked > before.piecesLocked && after.lines - before.lines >= 4;
    const placement = after.piecesLocked > before.piecesLocked && after.lines > before.lines && geometry ? locateCommittedLock(before, after, geometry) : null;
    if (!strength) {
      reset(); lastTick = after.tick;
      // The HALVING shape cue is not motion: it survives reduced motion.
      if (halving) { halvingAt = now; halvingRow = placement ? placement.rows.reduce((sum, row) => sum + row, 0) / placement.rows.length : 1.5; }
      return;
    }
    if (halving) { halvingAt = now; halvingRow = placement ? placement.rows.reduce((sum, row) => sum + row, 0) / placement.rows.length : 1.5; }
    if (after.piecesLocked > before.piecesLocked) {
      kick(now, Math.min(LOCK_THUD_PX, (after.hardDropCells > before.hardDropCells ? LOCK_THUD_PX : 1.2) * (.5 + strength * .5)));
      const cleared = Math.min(4, after.lines - before.lines);
      if (cleared > 0 && geometry) {
        if (placement) {
          const id = 'IJLOSTZ'.indexOf(after.holdsUsed > before.holdsUsed ? (before.hold ?? before.queue?.[0]) : before.active?.kind) + 1;
          squashRows = 0;
          for (const row of placement.rows) {
            if (squashRows >= 4 || row >= 20) continue;
            rows[squashRows] = row;
            for (let x = 0; x < 10; x += 1) cells[squashRows * 10 + x] = before.board[row * 10 + x] || (placement.cells.some(([cx, cy]) => cx === x && cy === row) ? id : 0);
            squashRows += 1;
          }
          squashAt = now;
        }
      }
      if (cleared >= 4) addTrauma(now, TRAUMA.halving);
    }
    if ((after.garbageRowsReceived ?? 0) > (before.garbageRowsReceived ?? 0)) addTrauma(now, TRAUMA.ledger);
    if (after.terminal && !before.terminal && after.terminalReason === 'garbage-out') addTrauma(now, TRAUMA.garbageOut);
  };
  // The board container offset for this frame, in authored px (y grows down).
  const offset = (now, settings) => {
    const strength = intensityFor(settings);
    if (!strength) return { x: 0, y: 0, spring: 0, trauma: 0 };
    // A stream of locks re-kicks a live spring; the dip still never exceeds one thud.
    const spring = Math.max(-LOCK_THUD_PX, Math.min(LOCK_THUD_PX, springAt(now)[0])), level = traumaAtTime(now);
    const amplitude = level * level * SHAKE_MAX_PX * strength * (settings.accessibility.reduceFlash ? .5 : 1);
    // Smooth, aperiodic wobble from the frame clock (projection only).
    const t = now / 1000;
    const x = amplitude * (Math.sin(t * 47.3 + 1.1) * .6 + Math.sin(t * 29.1 + 4.2) * .4);
    const y = amplitude * (Math.sin(t * 41.7 + 2.3) * .6 + Math.sin(t * 23.9 + .4) * .4);
    return { x, y: spring + y, spring, trauma: level };
  };
  // Rows mid-squash: progress 0..1, or none once SQUASH_MS has passed.
  const squash = now => {
    const progress = (now - squashAt) / SQUASH_MS;
    return progress >= 0 && progress < 1 ? { progress, count: squashRows, rows, cells } : { progress: 1, count: 0, rows, cells };
  };
  // HALVING chevrons: 0..1 progress and the centre row, or null.
  const halvingCue = now => {
    const progress = (now - halvingAt) / HALVING_CUE_MS;
    return progress >= 0 && progress < 1 ? { progress, row: halvingRow } : null;
  };
  return { step, offset, squash, halvingCue, reset, kick, addTrauma, get trauma() { return trauma; } };
}

const KIND_BY_ID = Object.freeze([null, 'I', 'J', 'L', 'O', 'S', 'T', 'Z', 'garbage']);

export function createBoardMotionView({ board, Graphics, geometry }) {
  const motion = createBoardMotion();
  const template = new Graphics().roundRect(-15, -15, 30, 30, 5).fill(0xffffff);
  const context = template.context;
  const nodes = Array.from({ length: 40 }, (_, i) => (i ? template.clone() : template));
  for (const node of nodes) { node.visible = false; board.layers.effectLayer.addChild(node); }
  // Chevrons pointing into the well; on the HUD layer so reduced motion keeps them.
  const chevrons = [0, 1].map(() => { const node = new Graphics().poly([0, -1, 1, 0, 0, 1, .45, 0]).fill(0xffffff); node.visible = false; board.layers.hudLayer.addChild(node); return node; });
  const draw = (now, settings, colors) => {
    const move = motion.offset(now, settings);
    board.applyShake(move.x, move.y);
    const { progress, count, rows, cells } = motion.squash(now);
    const on = count > 0 && !settings.accessibility.reduceMotion;
    const left = board.frame === 'wide' ? 96 : 0, eased = progress * progress;
    for (let i = 0; i < 40; i += 1) {
      const node = nodes[i], row = Math.floor(i / 10), id = cells[i];
      node.visible = on && row < count && id > 0;
      if (!node.visible) continue;
      node.position.set(left + (i % 10) * 32 + 16, (19 - rows[row]) * 32 + 16);
      node.scale.set(1 + .14 * progress, Math.max(.02, 1 - eased));
      node.tint = colors?.[KIND_BY_ID[id]] ?? 0xa8bdca;
      node.alpha = (1 - progress * .6) * (settings.accessibility.reduceFlash ? .7 : .95);
    }
    const cue = motion.halvingCue(now);
    for (let side = 0; side < 2; side += 1) {
      const node = chevrons[side];
      node.visible = !!cue && cue.row < 20;
      if (!node.visible) continue;
      node.position.set(side ? left + 314 : left + 6, (19 - cue.row) * 32 + 16);
      node.scale.set(side ? -16 : 16, 60);
      node.tint = 0xfff2b8;
      node.alpha = .9 * (1 - cue.progress * cue.progress);
    }
    return { ...move, squashing: on ? count : 0, halvingCue: !!cue };
  };
  return {
    step: (before, after, now, settings) => motion.step(before, after, now, settings, geometry),
    draw,
    reset() { motion.reset(); board.applyShake(0, 0); for (const node of [...nodes, ...chevrons]) node.visible = false; },
    destroy() { for (const node of [...nodes, ...chevrons]) node.destroy(); context.destroy?.(); board.applyShake(0, 0); },
    motion,
  };
}
