// ST-N01 visualizer facelift: link webs, layered geometric rings, side glows
// and an edge vignette shared by every music world. Presentation only: it
// reads the world geometry the atmosphere already computed and never touches
// simulation, scoring or the game RNG.
//
// Budget rules: every pool is sized once (WEB_CAPACITY / RING_COUNT / two
// glows / one vignette), the web plan lives in caller-owned Int16Arrays, and
// nothing allocates per frame. Flash rules (visuals §7.2): every form uses the
// normal blend, so the additive contribution is 0 at every tier and setting;
// FORM_CEILINGS is the most any single form reaches at intensity 1 (the glow
// value is its stacked centre alpha); beat, bass and high only move, rotate or
// scale forms while alpha follows the slow level envelope; the vignette only
// darkens. reduceMotion arrives as time = beat = bands = 0, which makes every
// form static.
export const WEB_CAPACITY = Object.freeze({ desktop: 324, mobile: 216 });
export const RING_COUNT = 8;
export const FORM_CEILINGS = Object.freeze({ glow: 0.22, web: 0.5, ring: 0.5, vignette: 0.30 });
const POLYGONS = [3, 6, 12];
const GLOW_STOPS = [[1, .04], [.78, .04], [.58, .045], [.4, .045], [.24, .05]];
const VIGNETTE_BANDS = [[.2, .08], [.12, .1], [.06, .12]];

// Plans the triangulating links for one frame: pairs (a[k], b[k]) of point
// indexes that share an organism, strand, ring or tower side. Returns the
// pair count, never more than a.length.
export function planWebs({ mode, count, perOrganism = 72, a, b }) {
  let n = 0;
  const push = (i, j) => { if (n < a.length && j < count) { a[n] = i; b[n] = j; n++; } };
  if (mode === 'living') {
    const stride = Math.max(1, Math.floor(perOrganism / 3));
    for (let i = 0; i + stride < count; i += 2) if (Math.floor(i / perOrganism) === Math.floor((i + stride) / perOrganism)) push(i, i + stride);
  } else if (mode === 'aurora' || mode === 'orbit') {
    const per = Math.floor(count / 6);
    for (let group = 0; group < 6; group++) {
      if (group % 3 === 2) continue; // the outer strand or ring on each side has no neighbour
      for (let u = 0; u < per; u++) { const i = group * per + u; push(i, i + per); if (u % 2 === 0 && u + 1 < per) push(i, i + per + 1); }
    }
  } else {
    const per = Math.floor(count / 2);
    for (let side = 0; side < 2; side++) for (let local = 1; local + 2 < per; local += 2) {
      const i = side * per + local; push(i, i + 2);
      if ((local >> 1) % 2 === 0 && local + 4 < per) push(i, i + 4);
    }
  }
  return n;
}

export function createWorldForms({ layer, Graphics, mobile = false }) {
  const capacity = mobile ? WEB_CAPACITY.mobile : WEB_CAPACITY.desktop;
  const a = new Int16Array(capacity), b = new Int16Array(capacity);
  const strand = new Graphics().rect(0, -0.5, 1, 1).fill(0xffffff);
  const webs = Array.from({ length: capacity }, (_, i) => i ? strand.clone() : strand);
  const halo = new Graphics();
  for (const [radius, alpha] of GLOW_STOPS) halo.circle(0, 0, radius * 100).fill({ color: 0xffffff, alpha });
  const glows = [halo, halo.clone()];
  const polygons = POLYGONS.map(sides => new Graphics().poly(Array.from({ length: sides * 2 }, (_, k) => (k % 2 ? Math.sin : Math.cos)(Math.floor(k / 2) / sides * Math.PI * 2) * 100), true).stroke({ color: 0xffffff, width: 1 }));
  const used = POLYGONS.map(() => false);
  const rings = Array.from({ length: RING_COUNT }, (_, k) => { const index = Math.min(2, k >> 1); if (used[index]) return polygons[index].clone(); used[index] = true; return polygons[index]; });
  const vignette = new Graphics();
  let vignetteWidth = 0, vignetteHeight = 0;
  const under = [...glows, ...rings, ...webs], over = [vignette];
  layer?.addChild(...under);
  return {
    under, over, capacity,
    draw({ mode, x, y, weight = null, count, perOrganism = 72, cohesion = 1, generation = 0, width, height, time = 0, level = 0, bass = 0, high = 0, beat = 0, intensity = .7, fade = 1, minimal = false, reduceFlash = false, palette }) {
      if (width !== vignetteWidth || height !== vignetteHeight) {
        // Rebuilt on resize only. The bands overlap at the corners, which is the point.
        vignetteWidth = width; vignetteHeight = height; vignette.clear();
        const edge = Math.min(width, height);
        for (const [size, alpha] of VIGNETTE_BANDS) { const d = edge * size; vignette.rect(-width / 2, -height / 2, width, d).rect(-width / 2, height / 2 - d, width, d).rect(-width / 2, -height / 2, d, height).rect(width / 2 - d, -height / 2, d, height).fill({ color: 0x000000, alpha }); }
      }
      const shown = count > 0 && intensity > 0, strength = Math.min(1, intensity) * fade;
      const spread = Math.min(width * .19, height * .2), lane = width * (width < height ? .4 : .33);
      vignette.alpha = shown ? .7 + intensity * .3 : 0;
      for (let s = 0; s < 2; s++) {
        const glow = glows[s], side = s ? 1 : -1;
        glow.visible = shown; if (!shown) continue;
        glow.position.set(side * lane + Math.sin(time * .21 + s * 2) * spread * .08, Math.sin(time * .23 + s) * height * .03);
        glow.scale.set(spread / 100 * (1.15 + beat * .08 + bass * .12));
        glow.tint = palette.color;
        glow.alpha = strength * (reduceFlash ? .6 : 1) * (minimal ? .5 : 1) * (.8 + level * .2);
      }
      for (let k = 0; k < RING_COUNT; k++) {
        const ring = rings[k], side = k % 2 ? 1 : -1, depth = k >> 1;
        const wanted = mode === 'orbit' || (mode === 'aurora' ? depth >= 2 : mode === 'spectrum' ? depth <= 1 : depth === 3);
        ring.visible = shown && wanted && !(minimal && depth % 2); if (!ring.visible) continue;
        const radius = spread * (mode === 'living' ? 1.45 : .5 + depth * .34) * (1 + beat * (.03 + depth * .012) + bass * .05);
        ring.position.set(side * lane + Math.sin(time * .19 + depth * 1.7) * spread * .06 * (1 - depth * .22), Math.sin(time * .16 + k) * height * .025 * (1 - depth * .2));
        ring.scale.set(radius / 100); ring.rotation = time * (.04 + depth * .025) * (k % 2 ? -1 : 1) + generation * .3 + depth * .4;
        ring.tint = depth % 3 === 0 ? palette.color : depth % 3 === 1 ? palette.accent : palette.deep;
        ring.alpha = FORM_CEILINGS.ring * strength * (.35 + .65 / (1 + depth)) * (.7 + level * .3);
      }
      const n = shown ? planWebs({ mode, count, perOrganism, a, b }) : 0;
      const limit = Math.min(width, height) * (mode === 'living' ? .16 : .34), thickness = mode === 'aurora' ? 2.4 : mode === 'living' ? 1.1 : 1.4;
      for (let k = 0; k < capacity; k++) {
        const web = webs[k];
        web.visible = k < n; if (!web.visible) continue;
        const i = a[k], j = b[k], dx = x[j] - x[i], dy = y[j] - y[i], distance = Math.hypot(dx, dy);
        if (distance > limit || distance < 1) { web.visible = false; continue; }
        web.position.set(x[i], y[i]); web.scale.set(distance, thickness); web.rotation = Math.atan2(dy, dx);
        web.tint = (k + generation) % 3 ? palette.deep : palette.accent;
        web.alpha = FORM_CEILINGS.web * strength * cohesion * (1 - distance / limit * (mode === 'living' ? 1 : .5)) * (weight ? Math.min(1, (weight[i] + weight[j]) * .4) : 1) * (.6 + level * .25 + high * .15);
      }
      return n;
    },
    destroy() {
      const contexts = [strand, halo, ...polygons].map(owner => owner.context);
      for (const visual of [...under, ...over]) visual.destroy();
      for (const context of contexts) context?.destroy?.();
    },
  };
}
