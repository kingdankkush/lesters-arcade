// Music-reactive board (owner direction 2026-09-16): the well frame glow and the
// active piece halo follow the beat and energy envelopes by a tiny amount.
// Presentation only: it reads the committed snapshot's active piece and the
// atmosphere's envelopes; nothing here feeds the simulation.
//
// Readability first: PULSE_CEILINGS are the most any node reaches at intensity
// 1, the halo sits under the active piece so only a 3 px rim shows, and the
// frame ring lives outside the opaque well. Off under reduceMotion, reduceFlash,
// audioReactive = false or the "Music-reactive board" toggle.
import { boardCellToAuthored, PIECE_COLORS } from './board-view.mjs';

export const PULSE_CEILINGS = Object.freeze({ frame: 0.2, piece: 0.26, tintMix: 0.35 });
const unit = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
const mixColor = (a, b, t) => [16, 8, 0].reduce((n, shift) => n | Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift, 0);

export const boardPulseEnabled = settings => settings?.video?.reactiveBoard !== false && settings?.video?.audioReactive !== false && !settings?.accessibility?.reduceMotion && !settings?.accessibility?.reduceFlash;

// Pure amplitude model shared by the renderer and the tests.
export function boardPulseAmplitude({ level = 0, beat = 0, high = 0 } = {}, settings = {}) {
  if (!boardPulseEnabled(settings)) return { frame: 0, piece: 0, mix: 0 };
  // Intensity eases the glow (70% reads as 80%); 0 switches it off.
  const raw = unit(settings.video?.effectsIntensity ?? 0.7), intensity = raw > 0 ? 0.35 + raw * 0.65 : 0, l = unit(level), b = unit(beat);
  return {
    frame: PULSE_CEILINGS.frame * intensity * (0.4 * l + 0.6 * b),
    piece: PULSE_CEILINGS.piece * intensity * (0.35 * l + 0.65 * b),
    mix: PULSE_CEILINGS.tintMix * unit(high),
  };
}

export function createBoardPulse({ board, Graphics, geometry }) {
  const frame = new Graphics().rect(-5, -5, 330, 650).stroke({ color: 0xffffff, width: 6 });
  const cell = new Graphics().roundRect(-2, -2, 36, 36, 7).fill(0xffffff);
  const halos = Array.from({ length: 4 }, (_, i) => (i ? cell.clone() : cell));
  const context = cell.context;
  frame.visible = false; for (const halo of halos) halo.visible = false;
  board.root.addChildAt(frame, 0);
  board.layers.garbageWarnLayer.addChild(...halos);
  const result = { frame: 0, piece: 0, enabled: false };
  return {
    frame, halos, result,
    draw({ settings, signals = {}, palette = {}, snapshot = null }) {
      const amplitude = boardPulseAmplitude(signals, settings);
      const x = board.frame === 'wide' ? 96 : 0;
      result.frame = amplitude.frame; result.piece = amplitude.piece; result.enabled = amplitude.frame > 0 || amplitude.piece > 0;
      frame.visible = amplitude.frame > 0;
      if (frame.visible) { frame.position.set(x, 0); frame.tint = mixColor(palette.color ?? 0x35f2ff, palette.accent ?? 0xffffff, amplitude.mix); frame.alpha = amplitude.frame; }
      const piece = snapshot?.active, cells = piece && amplitude.piece > 0 && geometry?.PIECE_CELLS?.[piece.kind] ? geometry.cellsFor(piece.kind, (piece.rotation ?? 0) & 3, piece.x ?? 0, piece.y ?? 0) : null;
      for (let i = 0; i < halos.length; i++) {
        const halo = halos[i], point = cells?.[i] ? boardCellToAuthored({ x: cells[i][0], y: cells[i][1], frame: board.frame }) : null;
        halo.visible = !!point?.visible; if (!halo.visible) continue;
        halo.position.set(point.x, point.y); halo.tint = PIECE_COLORS[piece.kind] ?? 0xa8bdca; halo.alpha = amplitude.piece;
      }
      return result;
    },
    destroy() { frame.destroy(); for (const halo of halos) halo.destroy(); context?.destroy?.(); },
  };
}
