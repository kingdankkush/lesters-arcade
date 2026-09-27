// C4 ambient life (1.9.0 world pass, lazy chunk). Projection only.
//
// - Smoke and signage are sampled at 7.5 Hz (every 8th simulation tick), the
//   stepped cadence of hand-drawn animation, so they read as authored cels
//   rather than as smooth particle noise.
// - Scorch and debris: a fixed set of seeded marks per district, each with its
//   own threshold, baked once from the world layout; a mark shows once that
//   district's kill progress passes its threshold, so the ground wears in
//   where the fighting happened.
// - A fixed pool of glow sprites is reassigned every frame to the lamps
//   nearest the camera; their strength follows the district mood.
//
// Everything is a pure function of placements, the district table, kill
// counts derived from corpses already on screen, entity ids and the tick.
import { microLifeBlink } from './world-mood.mjs';

export const AMBIENT_FX_ART_ID = 'projection-ambient-fx-v1';
export const AMBIENT_STEP_TICKS = 8;
export const SCORCH_MARKS_PER_DISTRICT = 36;
export const SCORCH_FULL_KILLS = 40;

const F = Object.freeze;
const TAU = Math.PI * 2;
function hashUnit(text, lane = 0) {
  let hash = 2166136261 ^ Math.imul(lane + 1, 0x9e3779b1);
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x1_0000_0000;
}

// lift: head height above the prop's ground point in world units.
export const LAMP_SPECS = F({
  streetlamp: F({ lift: 66, color: 0xffd48a, radius: 52 }),
  'warning-beacon': F({ lift: 36, color: 0xff6848, radius: 30 }),
  'proof-pylon': F({ lift: 56, color: 0x8feaff, radius: 38 }),
  'liquidation-terminal': F({ lift: 30, color: 0xff4fb0, radius: 36, sign: true }),
  'relay-console': F({ lift: 24, color: 0x5ff2ff, radius: 28, sign: true }),
  'bridge-warning-sign': F({ lift: 30, color: 0xffc04a, radius: 24, sign: true }),
  'faction-banner': F({ lift: 48, color: 0xff7a5a, radius: 18 }),
});
export const SMOKE_SPECS = F({
  'campfire-ring': F({ lift: 18, puffs: 3, rise: 78, color: 0x9a9690 }),
  'burned-snag': F({ lift: 40, puffs: 2, rise: 64, color: 0x6e6a66 }),
  'miners-shack': F({ lift: 62, puffs: 2, rise: 70, color: 0x8c8884 }),
});

export function buildAmbientSources(placements = []) {
  const lamps = [], smoke = [];
  for (const placement of placements) {
    const lamp = LAMP_SPECS[placement.assetId];
    if (lamp) lamps.push(F({ id: placement.id, x: placement.x, y: placement.y, ...lamp, phase: hashUnit(placement.id, 1) }));
    const plume = SMOKE_SPECS[placement.assetId];
    if (plume) smoke.push(F({ id: placement.id, x: placement.x, y: placement.y, ...plume, phase: hashUnit(placement.id, 2) }));
  }
  return F({ lamps: F(lamps), smoke: F(smoke) });
}

/**
 * Indices of the `count` lamps nearest (cx, cy), nearest first, written into
 * `out` (no allocation). Ties break on list order, so the choice is stable.
 */
export function selectNearestLamps(lamps, cx, cy, count, out, distances) {
  out.length = 0;
  distances.length = 0;
  for (let index = 0; index < lamps.length; index += 1) {
    const d = (lamps[index].x - cx) ** 2 + (lamps[index].y - cy) ** 2;
    let at = out.length;
    if (at >= count && d >= distances[count - 1]) continue;
    if (at >= count) at = count - 1;
    while (at > 0 && distances[at - 1] > d) {
      out[at] = out[at - 1];
      distances[at] = distances[at - 1];
      at -= 1;
    }
    out[at] = index;
    distances[at] = d;
    if (out.length > count) { out.length = count; distances.length = count; }
  }
  return out;
}

/** 7.5 Hz signage: the stepped cel index and whether the sign is lit on it. */
export function signageFrame(id, tick) {
  const step = Math.floor(tick / AMBIENT_STEP_TICKS);
  const flicker = hashUnit(`${id}:${step}`, 3);
  return F({ step, lit: flicker > 0.1, level: flicker > 0.1 ? 0.8 + 0.2 * ((step % 3) / 2) : 0.25 });
}

/** One smoke puff, sampled on the 7.5 Hz step. */
export function resolveSmokePuff(source, index, tick) {
  const stepped = Math.floor(tick / AMBIENT_STEP_TICKS) * AMBIENT_STEP_TICKS;
  const period = 112;
  const phase = ((stepped / period + source.phase + index / source.puffs) % 1 + 1) % 1;
  return F({
    x: source.x + Math.sin(TAU * (source.phase + phase * 0.6)) * 6 + phase * 22,
    y: source.y,
    z: source.lift + phase * source.rise,
    size: 10 + 20 * phase,
    alpha: 0.26 * Math.min(1, phase * 5) * (1 - phase),
  });
}

/**
 * Seeded scorch and debris marks per district, clustered on the encounter
 * arenas and the route nodes where fights happen. Each carries a threshold in
 * (0, 1]; progress in a district reveals the marks at or under it.
 */
export function buildScorchMarks(world, perDistrict = SCORCH_MARKS_PER_DISTRICT) {
  const marks = [];
  for (const district of world.districts) {
    const inside = (point) => point.x >= district.area.minX && point.x < district.area.maxX;
    const hubs = [
      ...world.encounterArenas.filter((arena) => arena.districtId === district.id).map((arena) => ({ x: arena.anchor.x, y: arena.anchor.y, r: arena.radius * 0.8 })),
      ...world.routeGraph.nodes.filter(inside).map((node) => ({ x: node.x, y: node.y, r: 120 })),
    ];
    if (hubs.length === 0) continue;
    for (let index = 0; index < perDistrict; index += 1) {
      const key = `${district.id}:${index}`;
      const hub = hubs[Math.floor(hashUnit(key, 4) * hubs.length)];
      const angle = TAU * hashUnit(key, 5);
      const reach = hub.r * Math.sqrt(hashUnit(key, 6));
      const x = Math.min(district.area.maxX - 20, Math.max(district.area.minX + 20, hub.x + Math.cos(angle) * reach));
      const y = Math.min(district.area.maxY - 20, Math.max(district.area.minY + 20, hub.y + Math.sin(angle) * reach));
      marks.push(F({
        districtId: district.id,
        x, y,
        // Stratified thresholds, shuffled by the hash: the first few kills
        // always show something and the last marks need a real fight.
        threshold: (index + 0.5 + (hashUnit(key, 7) - 0.5) * 0.9) / perDistrict,
        debris: index % 3 === 2,
        size: 34 + 46 * hashUnit(key, 8),
        rotation: TAU * hashUnit(key, 9),
      }));
    }
  }
  return F(marks);
}

/**
 * Kill counts per district from the corpses the runtime already queues. A
 * corpse id is counted once; a new run (tick going backwards) starts over.
 */
export function createKillTracker(districts) {
  const counts = new Map(districts.map((district) => [district.id, 0]));
  const seen = new Set();
  let lastTick = -1;
  const districtAt = (x) => {
    for (const district of districts) if (x >= district.area.minX && x < district.area.maxX) return district.id;
    return null;
  };
  return F({
    counts,
    observe(deaths, tick) {
      if (tick < lastTick) { seen.clear(); for (const key of counts.keys()) counts.set(key, 0); }
      lastTick = tick;
      if (!deaths) return;
      for (const [id, death] of deaths) {
        if (seen.has(id)) continue;
        seen.add(id);
        const districtId = districtAt(death.x);
        if (districtId) counts.set(districtId, counts.get(districtId) + 1);
      }
    },
    progress(districtId) {
      return Math.min(1, (counts.get(districtId) ?? 0) / SCORCH_FULL_KILLS);
    },
  });
}

/** A tiny two-bank sprite pool (normal under additive), claimed per frame. */
export function createSpritePool({ ContainerClass, SpriteClass, label, max = 32, additiveBank = true } = {}) {
  const container = new ContainerClass();
  container.label = label;
  const bank = (blendMode) => {
    const layer = new ContainerClass();
    layer.blendMode = blendMode;
    container.addChild(layer);
    return { layer, sprites: [], cursor: 0 };
  };
  const banks = additiveBank ? [bank('normal'), bank('add')] : [bank('normal')];
  let placed = 0;
  return F({
    container,
    begin() { for (const target of banks) target.cursor = 0; placed = 0; },
    place(texture, x, y, width, height, rotation, tint, alpha, additive = false) {
      if (!texture || placed >= max || !(alpha > 0.004) || !(width > 0) || !(height > 0)) return false;
      const target = banks[additive && banks.length > 1 ? 1 : 0];
      let sprite = target.sprites[target.cursor];
      if (!sprite) {
        sprite = new SpriteClass({ texture });
        sprite.anchor.set(0.5, 0.5);
        target.sprites.push(sprite);
        target.layer.addChild(sprite);
      }
      target.cursor += 1;
      placed += 1;
      sprite.texture = texture;
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.width = width;
      sprite.height = height;
      sprite.rotation = rotation;
      sprite.tint = tint;
      sprite.alpha = Math.min(1, alpha);
      return true;
    },
    finish() { for (const target of banks) for (let index = target.cursor; index < target.sprites.length; index += 1) target.sprites[index].visible = false; },
    get placed() { return placed; },
  });
}

export function resolveAmbientBudget(profile) {
  const tier = profile?.particlesPerHazard ?? 0;
  const mobile = profile?.id === 'mobile';
  return F({ glows: mobile ? 5 : 9, smoke: tier === 0 ? 0 : mobile ? 6 : 14, scorch: mobile ? 18 : 30 });
}

export function createAmbientFx({ ContainerClass, SpriteClass, textures, world, placements, profile } = {}) {
  const sources = buildAmbientSources(placements);
  const marks = buildScorchMarks(world);
  const kills = createKillTracker(world.districts);
  const budget = resolveAmbientBudget(profile);
  const ground = createSpritePool({ ContainerClass, SpriteClass, label: 'world-ambient-ground', max: budget.scorch, additiveBank: false });
  const air = createSpritePool({ ContainerClass, SpriteClass, label: 'world-ambient-air', max: budget.glows + budget.smoke });
  const nearest = [], distances = [];
  const point = { x: 0, y: 0, z: 0 };
  const report = { glows: 0, smoke: 0, scorch: 0, blinks: 0 };
  const project = (worldToScreen, camera, view, x, y, z) => {
    point.x = x; point.y = y; point.z = z;
    return worldToScreen(point, camera, view);
  };
  const render = ({ camera, view, tick, worldToScreen, queryGround, current, reduceMotion = false, deaths = null } = {}) => {
    ground.begin();
    air.begin();
    report.glows = report.smoke = report.scorch = report.blinks = 0;
    const zoom = camera.zoom;
    const halfW = view.width / (2 * zoom) + 80, halfH = view.height / (2 * zoom) + 120;
    kills.observe(deaths, tick);
    // Scorch and debris wear, thresholded by per-district kill progress.
    for (const mark of marks) {
      if (Math.abs(mark.x - camera.x) > halfW || Math.abs(mark.y - camera.y) > halfH) continue;
      if (mark.threshold > kills.progress(mark.districtId)) continue;
      const screen = project(worldToScreen, camera, view, mark.x, mark.y, queryGround(mark.x, mark.y).groundZ);
      const size = mark.size * zoom;
      if (!ground.place(mark.debris ? textures.debris : textures.scorch, screen.x, screen.y, size, size * 0.62, mark.debris ? mark.rotation : 0, mark.debris ? 0x2a2622 : 0x120c08, mark.debris ? 0.7 : 0.5)) break;
      report.scorch += 1;
    }
    // Lamp glows: the fixed pool follows the nearest lamps. Strength is the
    // mood's glow; signage flickers on the 7.5 Hz step, lamps blink on the
    // micro-life cycle.
    const glow = Math.max(0, Math.min(1, current?.glow ?? 0.4));
    selectNearestLamps(sources.lamps, camera.x, camera.y, budget.glows, nearest, distances);
    for (const index of nearest) {
      const lamp = sources.lamps[index];
      if (Math.abs(lamp.x - camera.x) > halfW + lamp.radius || Math.abs(lamp.y - camera.y) > halfH + lamp.radius) continue;
      let level = 1;
      if (lamp.sign) level = reduceMotion ? 0.9 : signageFrame(lamp.id, tick).level;
      else if (!reduceMotion && microLifeBlink(lamp.id, tick)) { level = 0.45; report.blinks += 1; }
      const screen = project(worldToScreen, camera, view, lamp.x, lamp.y, queryGround(lamp.x, lamp.y).groundZ + lamp.lift);
      const radius = lamp.radius * (0.7 + 0.5 * glow) * zoom;
      if (!air.place(textures.glow, screen.x, screen.y, radius * 2, radius * 2, 0, lamp.color, (0.16 + 0.5 * glow) * level, true)) break;
      report.glows += 1;
    }
    // Smoke, stepped at 7.5 Hz.
    if (!reduceMotion && budget.smoke > 0) {
      for (const source of sources.smoke) {
        if (report.smoke >= budget.smoke) break;
        if (Math.abs(source.x - camera.x) > halfW || Math.abs(source.y - camera.y) > halfH + source.rise) continue;
        const groundZ = queryGround(source.x, source.y).groundZ;
        for (let index = 0; index < source.puffs && report.smoke < budget.smoke; index += 1) {
          const puff = resolveSmokePuff(source, index, tick);
          const screen = project(worldToScreen, camera, view, puff.x, puff.y, groundZ + puff.z);
          const size = puff.size * zoom;
          if (air.place(textures.puff, screen.x, screen.y, size, size, 0, source.color, puff.alpha * (1 - 0.35 * (current?.night ?? 0)), false)) report.smoke += 1;
        }
      }
    }
    ground.finish();
    air.finish();
    return report;
  };
  return F({ artId: AMBIENT_FX_ART_ID, runtimeAuthority: 'projection-only', ground: ground.container, air: air.container, sources, marks, kills, render });
}
