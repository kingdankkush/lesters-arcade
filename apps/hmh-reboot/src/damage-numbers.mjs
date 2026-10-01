// 2.1 damage numbers (upgrade guide §2.3). Presentation only: fed with
// primitive copies of hits the simulation already resolved, drawn on a stage
// layer, never read back by the simulation, evidence or results.
//
// - A fixed pool (MAX_DAMAGE_NUMBERS) of typed-array slots, so the count
//   plateaus by construction; a full pool steals the oldest number.
// - Per-enemy aggregation: a hit on an enemy whose number is still fresh adds
//   to that number (it counts up) instead of stacking another; the window
//   widens during a swarm.
// - Rise RISE_PX over LIFE_MS with an ease-out, then fade. Crits get a 1.3x
//   pop and the accent colour.
// - Glyphs come from a pre-baked atlas (ten digits drawn once to a canvas):
//   Pixi's BitmapText is not in the HMH vendor build and Text re-rasterises on
//   every change, so each number is a few pooled digit sprites whose texture
//   is swapped only when its value changes.

export const MAX_DAMAGE_NUMBERS = 32;
export const DAMAGE_NUMBER_DIGITS = 5;
export const DAMAGE_NUMBER_LIFE_MS = 600;
export const DAMAGE_NUMBER_RISE_PX = 28;
export const DAMAGE_NUMBER_WINDOW_MS = 180;
export const DAMAGE_NUMBER_SWARM_WINDOW_MS = 450;
export const DAMAGE_NUMBER_SWARM_AT = 12;
export const DAMAGE_NUMBER_CRIT_POP = 1.3;
export const DAMAGE_NUMBER_CRIT_REST = 1.12;
export const DAMAGE_NUMBER_POP_MS = 160;
export const DAMAGE_NUMBER_COLOR = 0xffffff;
export const DAMAGE_NUMBER_CRIT_COLOR = 0xffc857;
// Glyph cell height in CSS px at scale 1: readable on a 375 px viewport.
export const DAMAGE_NUMBER_GLYPH_PX = 24;
const FADE_FROM = 0.6;

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

// Rise, alpha and scale of a number `ageMs` old (crit pops 1.3x and settles).
export function damageNumberMotion(ageMs, critical, out = { rise: 0, alpha: 1, scale: 1 }) {
  const t = Math.min(1, Math.max(0, ageMs / DAMAGE_NUMBER_LIFE_MS));
  out.rise = DAMAGE_NUMBER_RISE_PX * easeOutCubic(t);
  out.alpha = t < FADE_FROM ? 1 : Math.max(0, 1 - (t - FADE_FROM) / (1 - FADE_FROM));
  // A crit lands at 1.3x and settles to a slightly larger resting size.
  const pop = Math.max(0, 1 - Math.max(0, ageMs) / DAMAGE_NUMBER_POP_MS);
  out.scale = critical ? DAMAGE_NUMBER_CRIT_REST + (DAMAGE_NUMBER_CRIT_POP - DAMAGE_NUMBER_CRIT_REST) * pop : 1;
  return out;
}

export function createDamageNumberModel({ max = MAX_DAMAGE_NUMBERS } = {}) {
  const active = new Uint8Array(max);
  const critical = new Uint8Array(max);
  const value = new Float64Array(max);
  const born = new Float64Array(max);
  const last = new Float64Array(max);
  const wx = new Float64Array(max);
  const wy = new Float64Array(max);
  const wz = new Float64Array(max);
  const version = new Uint32Array(max);
  const target = new Array(max).fill(null);
  const stats = { spawned: 0, aggregated: 0, stolen: 0, peak: 0, active: 0 };
  const retire = (index) => { active[index] = 0; target[index] = null; stats.active -= 1; };
  return {
    max, active, critical, value, born, last, wx, wy, wz, version, stats,
    add(targetKey, amount, isCritical, x, y, z, nowMs) {
      if (!(amount > 0) || !Number.isFinite(amount) || !Number.isFinite(nowMs)) return -1;
      const window = stats.active >= DAMAGE_NUMBER_SWARM_AT ? DAMAGE_NUMBER_SWARM_WINDOW_MS : DAMAGE_NUMBER_WINDOW_MS;
      for (let i = 0; i < max; i += 1) {
        if (!active[i] || target[i] !== targetKey || nowMs - last[i] > window) continue;
        value[i] += amount;
        last[i] = nowMs;
        if (isCritical) critical[i] = 1;
        // Keep a counting number up: hold it near the top of its rise.
        born[i] = Math.max(born[i], nowMs - DAMAGE_NUMBER_LIFE_MS * 0.3);
        version[i] += 1;
        stats.aggregated += 1;
        return i;
      }
      let slot = -1;
      let oldest = Infinity;
      for (let i = 0; i < max; i += 1) {
        if (!active[i]) { slot = i; break; }
        if (born[i] < oldest) { oldest = born[i]; slot = i; }
      }
      if (active[slot]) { retire(slot); stats.stolen += 1; }
      active[slot] = 1;
      critical[slot] = isCritical ? 1 : 0;
      value[slot] = amount;
      born[slot] = nowMs;
      last[slot] = nowMs;
      wx[slot] = x; wy[slot] = y; wz[slot] = z;
      target[slot] = targetKey;
      version[slot] += 1;
      stats.spawned += 1;
      stats.active += 1;
      if (stats.active > stats.peak) stats.peak = stats.active;
      return slot;
    },
    // Retires expired numbers; returns the live count.
    update(nowMs) {
      for (let i = 0; i < max; i += 1) if (active[i] && nowMs - born[i] >= DAMAGE_NUMBER_LIFE_MS) retire(i);
      return stats.active;
    },
    clear() {
      for (let i = 0; i < max; i += 1) if (active[i]) retire(i);
    },
  };
}

// Ten white digits with a dark outline, drawn once. Returns null where the
// document cannot draw (headless harness), which leaves the model running and
// the view off.
export function createDamageGlyphAtlas({ documentRef, TextureClass, RectangleClass, px = DAMAGE_NUMBER_GLYPH_PX, resolution = 2 } = {}) {
  const canvas = documentRef?.createElement?.('canvas');
  const context = canvas?.getContext?.('2d');
  if (!context || typeof TextureClass?.from !== 'function') return null;
  const font = `900 ${px * resolution}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  context.font = font;
  const pad = Math.ceil(3 * resolution);
  const widths = [];
  for (let digit = 0; digit < 10; digit += 1) widths.push(Math.ceil(context.measureText(String(digit)).width) + pad * 2);
  const cell = Math.ceil(px * resolution * 1.25) + pad * 2;
  canvas.width = widths.reduce((sum, width) => sum + width, 0);
  canvas.height = cell;
  context.font = font;
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(2, 3 * resolution);
  context.strokeStyle = 'rgba(4, 10, 16, 0.92)';
  context.fillStyle = '#ffffff';
  const base = TextureClass.from(canvas);
  const textures = [];
  let x = 0;
  for (let digit = 0; digit < 10; digit += 1) {
    context.strokeText(String(digit), x + pad, cell / 2);
    context.fillText(String(digit), x + pad, cell / 2);
    textures.push(new TextureClass({ source: base.source, frame: new RectangleClass(x, 0, widths[digit], cell) }));
    x += widths[digit];
  }
  base.source.update?.();
  return {
    textures,
    widths: widths.map((width) => width / resolution),
    height: cell / resolution,
    resolution,
    base,
  };
}

// The pooled view: one container per model slot holding DAMAGE_NUMBER_DIGITS
// digit sprites. Textures change only when a slot's value version changes.
export function createDamageNumberView({ model, atlas, ContainerClass, SpriteClass }) {
  const layer = new ContainerClass();
  layer.label = 'hmh-damage-numbers';
  const slots = [];
  const motion = { rise: 0, alpha: 1, scale: 1 };
  const screen = { x: 0, y: 0 };
  for (let i = 0; i < model.max; i += 1) {
    const container = new ContainerClass();
    container.visible = false;
    const digits = [];
    for (let d = 0; d < DAMAGE_NUMBER_DIGITS; d += 1) {
      const sprite = new SpriteClass({ texture: atlas.textures[0] });
      sprite.scale.set(1 / atlas.resolution);
      sprite.visible = false;
      container.addChild(sprite);
      digits.push(sprite);
    }
    layer.addChild(container);
    slots.push({ container, digits, glyphs: new Uint8Array(DAMAGE_NUMBER_DIGITS), version: 0, shown: -1 });
  }
  // Glyph outlines overlap a little so the number reads as one word.
  const KERN = 4;
  const layout = (slot, value) => {
    const shown = Math.min(10 ** DAMAGE_NUMBER_DIGITS - 1, value);
    let count = 0;
    let rest = shown;
    do { count += 1; rest = Math.floor(rest / 10); } while (rest > 0);
    let width = 0;
    rest = shown;
    for (let d = count - 1; d >= 0; d -= 1) {
      const digit = rest % 10;
      rest = Math.floor(rest / 10);
      slot.glyphs[d] = digit;
      slot.digits[d].texture = atlas.textures[digit];
      slot.digits[d].visible = true;
      width += atlas.widths[digit] - KERN;
    }
    for (let d = count; d < DAMAGE_NUMBER_DIGITS; d += 1) slot.digits[d].visible = false;
    let x = -width / 2 - KERN / 2;
    for (let d = 0; d < count; d += 1) {
      slot.digits[d].position.set(x, -atlas.height / 2);
      x += atlas.widths[slot.glyphs[d]] - KERN;
    }
  };
  return {
    layer,
    // `project(x, y, z, out)` writes the screen point; (offsetX, offsetY) is
    // the world container's shake offset, so numbers stay on their bodies.
    draw(nowMs, project, offsetX = 0, offsetY = 0) {
      let visible = 0;
      for (let i = 0; i < model.max; i += 1) {
        const slot = slots[i];
        if (!model.active[i]) { if (slot.container.visible) slot.container.visible = false; continue; }
        const shown = Math.round(model.value[i]);
        if (shown <= 0) { slot.container.visible = false; continue; }
        if (slot.version !== model.version[i] || slot.shown !== shown) {
          slot.version = model.version[i];
          slot.shown = shown;
          layout(slot, shown);
        }
        damageNumberMotion(nowMs - model.born[i], model.critical[i] === 1, motion);
        project(model.wx[i], model.wy[i], model.wz[i], screen);
        const tint = model.critical[i] ? DAMAGE_NUMBER_CRIT_COLOR : DAMAGE_NUMBER_COLOR;
        for (let d = 0; d < DAMAGE_NUMBER_DIGITS; d += 1) slot.digits[d].tint = tint;
        slot.container.position.set(screen.x + offsetX, screen.y + offsetY - motion.rise);
        slot.container.scale.set(motion.scale);
        slot.container.alpha = motion.alpha;
        slot.container.visible = true;
        visible += 1;
      }
      return visible;
    },
    hide() {
      for (const slot of slots) slot.container.visible = false;
    },
    destroy() {
      layer.destroy({ children: true });
      atlas.base?.destroy?.(true);
    },
  };
}
