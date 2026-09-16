// Piece presentation layer (owner direction 2026-09-16, ST-N03). Presentation
// only: it consumes committed snapshots, never feeds the simulation, and it
// fills the gaps the spark layer leaves: hold/save, level transition, ledger
// rise, perfect clear, top-out and the danger band, plus a lock "thud" that
// settles the well's inner layers by a few authored pixels.
//
// Budget rules (ST-P02): one fixed typed-array ring buffer, one pooled
// Graphics per slot cloned from a shared context, no allocation per event.
// Flash rules (visuals §7.2): every band is confined to the well interior,
// additive alpha <= 0.12 (0.07 with reduceFlash), and the danger pulse runs
// at ~0.5 Hz so it can never count as a flash. reduceMotion zeroes motion,
// shake and bands exactly like the spark layer's shipped gate.

export const PIECE_FX_EVENTS = Object.freeze(['hold', 'level', 'ledger', 'perfect', 'terminal', 'lock']);
const intensityFor = settings => settings.accessibility.reduceMotion ? 0 : Math.max(0, Math.min(1, settings.video.effectsIntensity ?? .7));
const WELL_W = 320, WELL_H = 640;
const SHAKE_MS = 160;

export function createPiecePresentation({ mobile = false } = {}) {
  const capacity = mobile ? 192 : 288;
  const fields = Object.fromEntries(['x', 'y', 'vx', 'vy', 'born', 'life', 'size', 'delay'].map(key => [key, new Float32Array(capacity)]));
  const color = new Uint32Array(capacity), alive = new Uint8Array(capacity);
  const state = {
    ...fields, color, alive, capacity, count: 0, emitted: 0, lastEvent: '', lastEventAt: -10000,
    shakeAmplitude: 0, shakeAt: -10000,
    holdAt: -10000, levelAt: -10000, ledgerAt: -10000, perfectAt: -10000, terminalAt: -10000, danger: 0, level: 1,
  };
  let cursor = 0, lastTick = -1;
  const reset = () => {
    alive.fill(0); state.count = 0; state.lastEvent = ''; state.lastEventAt = -10000;
    state.shakeAmplitude = 0; state.shakeAt = state.holdAt = state.levelAt = state.ledgerAt = state.perfectAt = state.terminalAt = -10000;
    lastTick = -1;
  };
  const emit = (x, y, vx, vy, life, size, tint, now, delay = 0) => {
    const i = cursor; cursor = (cursor + 1) % capacity;
    if (!alive[i]) state.count++;
    alive[i] = 1; fields.x[i] = x; fields.y[i] = y; fields.vx[i] = vx; fields.vy[i] = vy;
    fields.born[i] = now; fields.life[i] = life; fields.size[i] = size; fields.delay[i] = delay; color[i] = tint; state.emitted++;
  };
  const stackTop = board => {
    for (let i = board.length - 1; i >= 0; i--) if (board[i]) return Math.min(19, Math.floor(i / 10));
    return -1;
  };
  const step = (before, after, now, settings) => {
    if (after.tick < before.tick || after.piecesLocked < before.piecesLocked || after.lines < before.lines) { reset(); return; }
    if (after.tick <= lastTick) return;
    lastTick = after.tick;
    state.level = after.level ?? 1;
    const strength = intensityFor(settings);
    if (!strength) { reset(); lastTick = after.tick; return; }
    const scale = (settings.video.reducedEffects ? .4 : 1) * (.5 + strength * .5);
    const n = value => Math.max(1, Math.ceil(value * scale));
    const mark = (event) => { state.lastEvent = event; state.lastEventAt = now; };

    if (after.piecesLocked > before.piecesLocked) {
      // Lock thud: hard drops land harder (bounded 4 authored px).
      const dropped = Math.max(0, (after.hardDropCells ?? 0) - (before.hardDropCells ?? 0));
      state.shakeAmplitude = Math.min(4, (dropped > 0 ? 1.6 + dropped * .12 : 1)) * strength;
      state.shakeAt = now;
      mark('lock');
    }
    if ((after.holdsUsed ?? 0) > (before.holdsUsed ?? 0)) {
      // Save piece: a streak of motes travels from the hold box to the spawn.
      state.holdAt = now;
      const count = n(14);
      for (let i = 0; i < count; i++) {
        const t = i / count;
        emit(-56 + t * (160 + 56), 40 - t * 24, 0, -8, 420, 1.6, 0xd9fbff, now, i * 18);
      }
      mark('hold');
    }
    if ((after.level ?? 1) > (before.level ?? 1)) {
      // Level transition: a shimmer band rises through the well, motes drift up.
      state.levelAt = now;
      const count = n(24);
      for (let i = 0; i < count; i++) emit(12 + (i * 97) % (WELL_W - 24), WELL_H - 8 - (i * 53) % 96, 0, -(60 + (i % 5) * 18), 900, 1.4, 0x9be7ff, now, (i % 6) * 40);
      mark('level');
    }
    if ((after.garbageRowsReceived ?? 0) > (before.garbageRowsReceived ?? 0)) {
      // Ledger rise: dust kicked up along the bottom of the well.
      state.ledgerAt = now;
      const count = n(16);
      for (let i = 0; i < count; i++) emit(10 + (i * 61) % (WELL_W - 20), WELL_H - 6, (i % 2 ? 1 : -1) * (10 + (i % 3) * 6), -(40 + (i % 4) * 12), 480, 1.5, 0xffb27a, now, (i % 4) * 25);
      mark('ledger');
    }
    if ((after.perfectClears ?? 0) > (before.perfectClears ?? 0)) {
      // Perfect clear: slow sparkles across the empty well.
      state.perfectAt = now;
      const count = n(40);
      for (let i = 0; i < count; i++) emit(8 + (i * 89) % (WELL_W - 16), 8 + (i * 151) % (WELL_H - 16), (i % 2 ? 6 : -6), -12, 1100, 1.3, i % 3 ? 0xfff2b8 : 0xb8f5ff, now, (i % 8) * 60);
      mark('perfect');
    }
    if (after.terminal && !before.terminal) {
      // Top-out: the top rows of the stack crumble into dust.
      state.terminalAt = now;
      const top = stackTop(after.board);
      const count = n(48);
      for (let i = 0; i < count; i++) {
        const row = Math.max(0, top - (i % 4));
        emit(8 + (i * 67) % (WELL_W - 16), (19 - row) * 32 + 16, (i % 2 ? 1 : -1) * (14 + (i % 5) * 9), -(30 + (i % 6) * 14), 900, 2.2, 0x9fb3c8, now, (i % 5) * 30);
      }
      mark('terminal');
    }
  };
  const update = (now, settings, danger = 0) => {
    const strength = intensityFor(settings);
    state.danger = strength ? Math.max(0, Math.min(1, danger)) : 0;
    let count = 0;
    for (let i = 0; i < capacity; i++) {
      if (!alive[i]) continue;
      if (now - fields.born[i] - fields.delay[i] > fields.life[i]) { alive[i] = 0; continue; }
      count++;
    }
    state.count = count;
    if (!strength) { state.shakeAmplitude = 0; }
    return state;
  };
  // Vertical settle offset for the well's inner layers: a damped half-sine so
  // the stack dips and returns inside SHAKE_MS. Zero when motion is reduced.
  const shakeOffset = (now, settings) => {
    if (!intensityFor(settings) || !state.shakeAmplitude) return 0;
    const t = (now - state.shakeAt) / SHAKE_MS;
    if (t < 0 || t >= 1) return 0;
    return state.shakeAmplitude * Math.sin(t * Math.PI) * (1 - t);
  };
  return { state, step, update, reset, shakeOffset };
}

export function createBoardPiecePresentation({ board, Graphics, mobile = false }) {
  const fx = createPiecePresentation({ mobile });
  const mote = new Graphics().circle(0, 0, 1).fill(0xffffff);
  const context = mote.context;
  const visuals = Array.from({ length: fx.state.capacity }, (_, i) => (i ? mote.clone() : mote));
  const bands = Object.fromEntries(['level', 'ledger', 'danger', 'terminal', 'perfect', 'hold'].map(id => [id, new Graphics().rect(0, 0, 1, 1).fill(0xffffff)]));
  for (const node of [...visuals, ...Object.values(bands)]) { node.visible = false; board.layers.effectLayer.addChild(node); }
  const shaken = ['stackLayer', 'ghostLayer', 'activeLayer', 'effectLayer'];
  const draw = (now, settings, danger = 0) => {
    const s = fx.update(now, settings, danger), offset = board.frame === 'wide' ? 96 : 0, intensity = intensityFor(settings);
    const flash = settings.accessibility.reduceFlash ? .07 : .12;
    for (let i = 0; i < s.capacity; i++) {
      const node = visuals[i];
      const age = now - s.born[i] - s.delay[i];
      node.visible = !!s.alive[i] && age >= 0;
      if (!node.visible) continue;
      const t = age / 1000, fade = 1 - age / s.life[i];
      const x = s.x[i] + s.vx[i] * t, y = s.y[i] + s.vy[i] * t + (s.color[i] === 0x9fb3c8 ? 120 * t * t : 0);
      node.visible = x > -80 && x < WELL_W + 80 && y > 1 && y < WELL_H - 1;
      node.position.set(offset + x, y);
      node.scale.set(s.size[i] * (.6 + fade * .8));
      node.tint = s.color[i]; node.alpha = Math.max(0, fade) * .8 * intensity;
    }
    const band = (id, visible, x, y, w, h, alpha, tint) => {
      const node = bands[id]; node.visible = visible && alpha > 0;
      if (!node.visible) return;
      node.position.set(offset + x, y); node.scale.set(w, h); node.alpha = alpha; node.tint = tint;
    };
    const levelAge = (now - s.levelAt) / 600;
    band('level', levelAge >= 0 && levelAge < 1, 0, WELL_H - 48 - levelAge * (WELL_H - 48), WELL_W, 48, (1 - levelAge) * flash * intensity, 0x9be7ff);
    const ledgerAge = (now - s.ledgerAt) / 260;
    band('ledger', ledgerAge >= 0 && ledgerAge < 1, 0, WELL_H - 32 - ledgerAge * 32, WELL_W, 3, (1 - ledgerAge) * flash * intensity, 0xff9a62);
    const perfectAge = (now - s.perfectAt) / 700;
    band('perfect', perfectAge >= 0 && perfectAge < 1, 0, 0, WELL_W, WELL_H, (1 - perfectAge) * flash * .5 * intensity, 0xfff2b8);
    const holdAge = (now - s.holdAt) / 300;
    band('hold', holdAge >= 0 && holdAge < 1, -96, 0, 88, 88, (1 - holdAge) * flash * intensity, 0xd9fbff);
    const terminalAge = (now - s.terminalAt) / 600;
    // Darkening only: not a flash. Holds at its final value once the run ends.
    band('terminal', s.terminalAt > -10000 && terminalAge >= 0, 0, 0, WELL_W, WELL_H, Math.min(1, terminalAge) * (settings.accessibility.reduceFlash ? .12 : .16) * (intensity || (settings.accessibility.reduceMotion ? 0 : 1)), 0x06101c);
    // Danger: a slow pulse (~0.5 Hz) along the top of the well, never a strobe.
    const pulse = .5 + .5 * Math.sin(now / 1000 * 3.1);
    band('danger', s.danger > 0, 0, 0, WELL_W, 64, s.danger * flash * (.5 + .5 * pulse) * intensity, 0xff6a5a);
    const dy = fx.shakeOffset(now, settings);
    for (const name of shaken) board.layers[name].position.y = dy;
    return Object.freeze({ count: s.count, emitted: s.emitted, lastEvent: s.lastEvent, capacity: s.capacity, shake: dy, danger: s.danger });
  };
  return {
    state: fx.state,
    step: fx.step,
    reset() { fx.reset(); for (const name of shaken) board.layers[name].position.y = 0; },
    draw,
    destroy() { for (const node of [...visuals, ...Object.values(bands)]) node.destroy(); context.destroy(); fx.reset(); for (const name of shaken) board.layers[name].position.y = 0; },
  };
}
