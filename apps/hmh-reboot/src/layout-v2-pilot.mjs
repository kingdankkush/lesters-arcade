import {
  LAYOUT_V2_MASS_MATERIALS,
  LAYOUT_V2_ROAD_TIERS,
  buildLayoutV2World,
  layoutV2PieceBounds,
  layoutV2Vertices,
} from './layout-v2-kit.mjs';
import { LAYOUT_V2_MAP } from './layout-v2-map.mjs';

// Layout v2 dark pilot (?evidenceSafe=1&layoutV2=1, never Ranked). Lazily
// imported by main.mjs only when the pilot flag is set, so the default map,
// its collision, navgrid and evidence never see this module. It returns the
// v2 collision set and ground query for the runtime to adopt, and draws the
// greybox: ground, terraces and ramps, water, road tiles, chasm faces, deck
// planks and rails, mass tops with edge strips, gates, arenas and markers.
// Presentation here is projection-only.

const DISTRICT_GROUND = Object.freeze({
  'frontier-relay': 0x74824f,
  'rugpull-ravine': 0x9c7753,
  'liquidity-crossing': 0x6c8163,
  hashwood: 0x52704a,
  'mining-camp': 0x7d776c,
  'liquidation-yard': 0x6d6470,
});
const ROAD_COLOR = Object.freeze({ highway: 0x34363b, road: 0x5b534a, lane: 0x86704f, trail: 0xa58c62 });
const GATE_COLOR = Object.freeze({ 'arena-lock': 0xd8434b, reward: 0xe7a42d, secret: 0x9d6ce0, vault: 0xe0c04e });
const MARKER_COLOR = Object.freeze({ machine: 0x3fd0e0, prisoner: 0xff8a3d, key: 0xffe04a, secret: 0xb57cff, reward: 0xffd166, poi: 0xf2f2f2, 'boss-trigger': 0xf4ede0, gate: 0xe7a42d });
const DECK_COLOR = Object.freeze({ 'stone-arch-viaduct': 0xa69b8a, 'stone-arch': 0xa69b8a, 'steel-through-truss': 0x8d949c, 'steel-lock-gate': 0x8d949c, 'steel-bascule': 0x8d949c });

function shade(color, factor) {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function flat(vertices) {
  return vertices.flatMap((vertex) => [vertex.x, vertex.y]);
}

function drawPolyline(graphics, points, width, color, alpha = 1) {
  graphics.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) graphics.lineTo(points[index][0], points[index][1]);
  graphics.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}

function drawDashes(graphics, points, dash, gap, width, color) {
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    const length = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t < length; t += dash + gap) {
      const end = Math.min(length, t + dash);
      graphics.moveTo(ax + (bx - ax) * t / length, ay + (by - ay) * t / length).lineTo(ax + (bx - ax) * end / length, ay + (by - ay) * end / length);
    }
  }
  graphics.stroke({ width, color, alpha: 0.9 });
}

export function drawLayoutV2Greybox({ layout = LAYOUT_V2_MAP, GraphicsClass, ContainerClass, TextClass = null }) {
  const root = new ContainerClass();
  root.label = 'layout-v2-greybox';
  const ground = new GraphicsClass();
  const upper = new GraphicsClass();
  const marks = new GraphicsClass();
  root.addChild(ground, upper, marks);
  const { minX, minY, maxX, maxY } = layout.bounds;

  // Ground, one tint per district, with a faint 400-unit survey grid.
  for (const district of layout.districts) ground.rect(district.minX, minY, district.maxX - district.minX, maxY - minY).fill({ color: DISTRICT_GROUND[district.id] ?? 0x707070 });
  for (let x = minX; x <= maxX; x += 400) ground.moveTo(x, minY).lineTo(x, maxY);
  for (let y = minY; y <= maxY; y += 400) ground.moveTo(minX, y).lineTo(maxX, y);
  ground.stroke({ width: 2, color: 0x000000, alpha: 0.08 });

  // Terraces (z24): a lighter top and a south face strip; ramps striped.
  for (const terrace of layout.terraces ?? []) {
    const box = layoutV2PieceBounds(terrace);
    const base = DISTRICT_GROUND[terrace.district] ?? 0x707070;
    ground.poly(flat(layoutV2Vertices(terrace))).fill({ color: shade(base, 1.18) });
    ground.rect(box.minX, box.maxY, box.maxX - box.minX, 26).fill({ color: shade(base, 0.62) });
    ground.poly(flat(layoutV2Vertices(terrace))).stroke({ width: 6, color: shade(base, 1.45), alpha: 0.9 });
    for (const ramp of terrace.ramps ?? []) {
      const [rx0, ry0, rx1, ry1] = ramp.rect;
      ground.rect(rx0, ry0, rx1 - rx0, ry1 - ry0).fill({ color: shade(base, 1.08) });
      const alongY = ramp.top === 'north' || ramp.top === 'south';
      for (let step = 0; step < (alongY ? ry1 - ry0 : rx1 - rx0); step += 24) {
        if (alongY) ground.moveTo(rx0, ry0 + step).lineTo(rx1, ry0 + step);
        else ground.moveTo(rx0 + step, ry0).lineTo(rx0 + step, ry1);
      }
      ground.stroke({ width: 3, color: shade(base, 0.7), alpha: 0.7 });
    }
  }

  // Shallow water under the roads, deep water and chasms over them (a road
  // only ever crosses deep water on a deck, which is drawn later).
  for (const water of layout.water ?? []) {
    if (water.depth !== 'shallow') continue;
    ground.poly(flat(layoutV2Vertices(water))).fill({ color: 0x6aa6a8, alpha: 0.9 });
    ground.poly(flat(layoutV2Vertices(water))).stroke({ width: 10, color: 0xb9c79a, alpha: 0.8 });
  }
  const roads = [...(layout.roads ?? [])].sort((a, b) => LAYOUT_V2_ROAD_TIERS[b.tier].tier - LAYOUT_V2_ROAD_TIERS[a.tier].tier);
  for (const road of roads) {
    const tier = LAYOUT_V2_ROAD_TIERS[road.tier];
    drawPolyline(ground, road.points, tier.art + 16, shade(ROAD_COLOR[road.tier], 0.75), 0.9);
    drawPolyline(ground, road.points, tier.art, ROAD_COLOR[road.tier]);
    if (road.tier === 'highway') drawDashes(ground, road.points, 60, 50, 8, 0xe2c96c);
  }
  for (const water of layout.water ?? []) {
    if (water.depth === 'shallow') continue;
    const vertices = layoutV2Vertices(water);
    ground.poly(flat(vertices)).fill({ color: 0x1f5c84 });
    ground.poly(flat(vertices)).stroke({ width: 18, color: 0xc2b58a, alpha: 0.95 });
    const box = layoutV2PieceBounds(water);
    for (let y = box.minY + 60; y < box.maxY - 30; y += 90) ground.moveTo(box.minX + 30, y).lineTo(box.maxX - 30, y);
    ground.stroke({ width: 4, color: 0x8fc4df, alpha: 0.35 });
  }
  for (const chasm of layout.chasms ?? []) {
    const box = layoutV2PieceBounds(chasm);
    ground.poly(flat(layoutV2Vertices(chasm))).fill({ color: 0x1b120d });
    // The far (north) wall face, then rims on every edge.
    ground.rect(box.minX, box.minY, box.maxX - box.minX, Math.min(90, box.maxY - box.minY)).fill({ color: 0x5c3b27 });
    ground.poly(flat(layoutV2Vertices(chasm))).stroke({ width: 10, color: 0xd1a879 });
  }
  for (const piece of layout.grounds ?? []) {
    ground.poly(flat(layoutV2Vertices(piece))).fill({ color: DISTRICT_GROUND[piece.district] ?? 0x707070 });
  }

  // Decks: planks across the span, ramps at raised ends, rails along the sides.
  for (const deck of layout.decks ?? []) {
    const [dx0, dy0, dx1, dy1] = deck.rect;
    const color = DECK_COLOR[deck.style] ?? 0x8c6a42;
    const spanX = deck.span !== 'y';
    if (deck.z > 0) {
      const ramp = deck.rampLength ?? 100;
      if (spanX) upper.rect(dx0 - ramp, dy0, ramp, dy1 - dy0).rect(dx1, dy0, ramp, dy1 - dy0);
      else upper.rect(dx0, dy0 - ramp, dx1 - dx0, ramp).rect(dx0, dy1, dx1 - dx0, ramp);
      upper.fill({ color: shade(color, 0.85) });
    }
    upper.rect(dx0, dy0, dx1 - dx0, dy1 - dy0).fill({ color });
    for (let step = 20; step < (spanX ? dx1 - dx0 : dy1 - dy0); step += 22) {
      if (spanX) upper.moveTo(dx0 + step, dy0).lineTo(dx0 + step, dy1);
      else upper.moveTo(dx0, dy0 + step).lineTo(dx1, dy0 + step);
    }
    upper.stroke({ width: 3, color: shade(color, 0.7), alpha: 0.8 });
    upper.rect(dx0, dy0, dx1 - dx0, dy1 - dy0).stroke({ width: 5, color: shade(color, 0.55) });
  }

  // Masses: top material, a south face strip and modular edge strips.
  const blockers = buildLayoutV2World(layout, { gates: 'open' }).collisionBlockers;
  for (const mass of layout.masses ?? []) {
    const material = LAYOUT_V2_MASS_MATERIALS[mass.material];
    const vertices = layoutV2Vertices(mass);
    const box = layoutV2PieceBounds(mass);
    const face = Math.min(46, Math.max(14, (mass.maxZ ?? material.maxZ) * 0.22));
    upper.rect(box.minX, box.maxY, box.maxX - box.minX, face).fill({ color: shade(material.edge, 0.8), alpha: 0.95 });
    upper.poly(flat(vertices)).fill({ color: material.color });
    upper.poly(flat(vertices)).stroke({ width: 14, color: material.edge, alpha: 0.9, alignment: 1 });
  }
  for (const blocker of blockers) {
    if (blocker.shape.type !== 'capsule') continue;
    const { a, b, radius } = blocker.shape;
    upper.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: radius * 2, color: 0x2e241b, cap: 'round' });
  }

  // Gates (drawn closed), arenas, hazards, lairs, entries, sites, landmarks.
  for (const gate of layout.gates ?? []) {
    marks.moveTo(gate.a[0], gate.a[1]).lineTo(gate.b[0], gate.b[1]).stroke({ width: (gate.radius ?? 24) * 2, color: GATE_COLOR[gate.role], alpha: 0.85, cap: 'round' });
  }
  for (const arena of layout.arenas ?? []) marks.circle(arena.center[0], arena.center[1], arena.radius).stroke({ width: 10, color: 0xd8434b, alpha: 0.55 });
  for (const hazard of layout.hazards ?? []) marks.circle(hazard.x, hazard.y, hazard.radius).stroke({ width: 6, color: 0xff7a1a, alpha: 0.8 });
  for (const lair of layout.lairs ?? []) {
    marks.moveTo(lair.x - 34, lair.y - 34).lineTo(lair.x + 34, lair.y + 34).moveTo(lair.x + 34, lair.y - 34).lineTo(lair.x - 34, lair.y + 34);
  }
  marks.stroke({ width: 10, color: 0xb3262e, alpha: 0.85 });
  for (const entry of layout.entries ?? []) marks.circle(entry.x, entry.y, 46).stroke({ width: 10, color: 0x5fe08a });
  for (const site of layout.interactions ?? []) {
    const color = MARKER_COLOR[site.kind] ?? 0xffffff;
    if (site.kind === 'prisoner') marks.poly([site.x, site.y - 30, site.x + 30, site.y, site.x, site.y + 30, site.x - 30, site.y]).fill({ color });
    else marks.rect(site.x - 22, site.y - 22, 44, 44).fill({ color });
    marks.rect(site.x - 22, site.y - 22, 44, 44).stroke({ width: 4, color: 0x111111, alpha: 0.7 });
  }
  for (const landmark of layout.landmarks ?? []) marks.poly([landmark.x, landmark.y - 60, landmark.x + 44, landmark.y + 24, landmark.x - 44, landmark.y + 24]).fill({ color: 0xffffff, alpha: 0.9 });

  if (TextClass) {
    const label = (text, x, y, size = 30) => {
      const node = new TextClass({ text, style: { fill: 0xffffff, fontFamily: 'system-ui', fontSize: size, fontWeight: '800', stroke: { color: 0x101010, width: 6 } } });
      node.anchor.set(0.5);
      node.position.set(x, y);
      root.addChild(node);
    };
    for (const deck of layout.decks ?? []) label(deck.id.replaceAll('-', ' '), (deck.rect[0] + deck.rect[2]) / 2, deck.rect[1] - 60, 28);
    for (const arena of layout.arenas ?? []) label(`${arena.id.replaceAll('-', ' ')} (arena)`, arena.center[0], arena.center[1] - arena.radius - 30, 30);
    for (const district of layout.districts) label(`${district.name} · ${district.status}`, (district.minX + district.maxX) / 2, 330, 40);
  }
  return root;
}

// Adopts the v2 world at its start state: arena locks open, every chain,
// secret and vault gate shut.
export function mountLayoutV2Pilot({ GraphicsClass, ContainerClass, TextClass, world, hide = [], at = 1 }) {
  const built = buildLayoutV2World(LAYOUT_V2_MAP, { gates: (gate) => gate.role === 'arena-lock' });
  for (const layer of hide) if (layer) layer.visible = false;
  const layer = drawLayoutV2Greybox({ GraphicsClass, ContainerClass, TextClass });
  world.addChildAt(layer, Math.min(at, world.children.length));
  return Object.freeze({ world: built, queryGround: built.queryGround, layer });
}
