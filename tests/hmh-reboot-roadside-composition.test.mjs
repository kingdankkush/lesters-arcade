import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAuthoredWorldPropPlacements, createAuthoredPropAtlasIndex, AUTHORED_DRESSING_SEED } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { createTripoPropAppearance } from '../apps/hmh-reboot/src/tripo-prop-appearance.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_GROUND_PATHS } from '../apps/hmh-reboot/src/world-design-layout.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';
import { resolveWorldDesignSprite } from '../apps/hmh-reboot/src/world-design-native-assets.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const index = createAuthoredPropAtlasIndex(read('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json'));
const metadata = read('../apps/portal/assets/generated/hmh-reboot-tripo-props/hmh-tripo-props.json');
const native = createTripoPropAppearance(metadata, metadata.pages.map(p => ({ source: { width: p.width, height: p.height } })), index);
const ground = createLevelOneGroundQuery();
const build = seed => buildAuthoredWorldPropPlacements({ worldId: world.id, seed: seed ?? AUTHORED_DRESSING_SEED });
const cameras = [{ name: 'opening', x: 800, y: 2400 }, { name: 'woodland approach', x: 6550, y: 2350 }, { name: 'town approach', x: 10250, y: 2450 }];
const paintedBounds = (placement, camera, view) => {
  const frame = native.get(placement.assetId)?.frame;
  if (!frame) return null;
  const projection = resolveWorldDesignSprite({ frame, placement, groundZ: ground(placement.x, placement.y).groundZ, zoom: camera.zoom });
  const point = worldToScreen({ ...placement, z: projection.groundZ }, camera, view);
  const a = frame.alphaBounds;
  const left = point.x + (a.x - frame.anchor.x * frame.frame.w) * projection.scaleX;
  const top = point.y + (a.y - frame.anchor.y * frame.frame.h) * projection.scaleY;
  return { left, top, right: left + a.w * projection.scaleX, bottom: top + a.h * projection.scaleY };
};
const visible = (placement, camera, view) => {
  const bounds = paintedBounds(placement, camera, view);
  return bounds && Math.min(bounds.right, view.width) - Math.max(bounds.left, 0) >= 8
    && Math.min(bounds.bottom, view.height) - Math.max(bounds.top, 0) >= 8;
};

for (const view of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`native roadside groups are visible from normal route cameras at ${view.width}x${view.height}`, () => {
    for (const location of cameras) {
      const camera = { ...location, zoom: 2.112, groundZ: ground(location.x, location.y).groundZ, shakeX: 0, shakeY: 0 };
      const inView = build().filter(p => visible(p, camera, view));
      assert.ok(inView.length >= (view.width > 600 ? 3 : 1), `${location.name}: only ${inView.length} native dressing props visible`);
    }
  });
}

test('authored shoulder groups reuse the existing budget and stay fixed across run seeds', () => {
  const before = JSON.stringify(world);
  const a = build(), b = build(17);
  assert.equal(a.length, 200);
  const groups = a.filter(p => p.composition === 'roadside');
  assert.ok(groups.length >= 12 && groups.length <= 30);
  assert.deepEqual(groups, b.filter(p => p.composition === 'roadside'));
  assert.ok(groups.every(p => native.has(p.assetId) && p.runtimeAuthority === 'projection-only' && !p.collisionBlockerId));
  assert.equal(JSON.stringify(world), before);
});

test('nearby native silhouettes leave the opening hero and immediate combat space unobscured', () => {
  const view = { width: 1440, height: 900 };
  const camera = { ...cameras[0], zoom: 2.112, groundZ: ground(800, 2400).groundZ, shakeX: 0, shakeY: 0 };
  const center = worldToScreen({ x: 800, y: 2400, z: camera.groundZ }, camera, view);
  const clear = { left: center.x - 100 * camera.zoom, right: center.x + 100 * camera.zoom,
    top: center.y - 150 * camera.zoom, bottom: center.y + 120 * camera.zoom };
  for (const placement of build().filter(p => p.composition === 'roadside')) {
    const bounds = paintedBounds(placement, camera, view);
    assert.ok(bounds.right <= clear.left || bounds.left >= clear.right || bounds.bottom <= clear.top || bounds.top >= clear.bottom,
      `${placement.id} obscures the opening combat space`);
  }
});

function distance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
test('roadside bases clear collision, all main and exploration routes, water and interaction approaches', () => {
  const nodes = new Map(world.routeGraph.nodes.map(p => [p.id,p]));
  const paths = [...world.routes.map(p => ({ ...p, points: p.nodeIds.map(id => nodes.get(id)) })), ...WORLD_DESIGN_GROUND_PATHS];
  const body = createCollisionBody({ id: 'dressing-clearance', kind: 'player', radius: 24, minZ: 0, maxZ: 42 });
  for (const p of build().filter(p => p.composition === 'roadside')) {
    const collision = resolveSweptCircleMotion({ body, start: { ...p, z: 0 }, delta: { x: 0, y: 0 }, blockers: world.collisionBlockers, bounds: world.bounds });
    assert.equal(collision.depenetrations.length, 0, `${p.id} clips collision`);
    const surface = ground(p.x,p.y);
    assert.equal(surface.walkable, true, p.id);
    assert.equal(surface.deepWater, false, p.id);
    assert.notEqual(surface.kind, 'water', p.id);
    const frame = native.get(p.assetId).frame;
    const footprintRadius = Math.max(24, frame.alphaBounds.w * frame.runtimeScale * (p.scale ?? 1) / 2);
    for (const path of paths) for (let i=1;i<path.points.length;i++) assert.ok(distance(p,path.points[i-1],path.points[i]) >= path.width/2+footprintRadius, `${p.id} clips ${path.id}`);
    for (const poi of world.pointsOfInterest) assert.ok(Math.hypot(p.x-poi.anchor.x,p.y-poi.anchor.y) >= 80, `${p.id} covers ${poi.id}`);
    for (const site of WORLD_DESIGN_SITES) assert.ok(Math.hypot(p.x-site.x,p.y-site.y) >= 120, `${p.id} covers ${site.id}`);
  }
});
