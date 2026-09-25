// Projection-only enemy/corpse display pool (perf step: enemy-display-pool).
//
// Spawns and kills used to destroy and rebuild every enemy display. The pool
// keeps displays per key, resets them to their freshly built state on reuse,
// and syncs markers incrementally. The equivalence test below replays a
// seeded crowd through BOTH the old full-rebuild wiring and the pooled wiring
// and requires the same visible output after every render: the same depth
// order (exact zIndex ties included), poses, transforms and corpses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Container, RenderLayer } from 'pixi.js';
import { createEnemyDisplayPool } from '../apps/hmh-reboot/src/enemy-display-pool.mjs';
import { prepareWorldDesignEnemyPose } from '../apps/hmh-reboot/src/world-design-life.mjs';

// A display honouring the contract main.mjs relies on: construction applies
// the idle pose with the elite flag, and applyPose owns every pose field.
function makeDisplay(kind, archetypeId, elite) {
  const display = new Container();
  display.kind = kind;
  display.archetypeId = archetypeId;
  display.applyPose = (pose) => {
    display.pose = { state: pose.state, tick: pose.tick, direction: pose.direction, elite: pose.elite === true };
    display.eliteProjection = pose.elite === true;
    return { frame: `${kind}:${pose.state}:${pose.direction}:${pose.tick}` };
  };
  display.applyPose({ state: 'idle', tick: 0, direction: 0, elite });
  return display;
}

const eliteOf = (id) => id.endsWith('7');

const idleCount = (pool) => [...pool.idle.values()].reduce((sum, bucket) => sum + bucket.length, 0);

function subject({ rosterLoaded = new Set(), idleCap } = {}) {
  let created = 0;
  const markers = new Map();
  const parent = new Container();
  const layer = new RenderLayer({ sortableChildren: true });
  const keyFor = (archetypeId, elite) => (rosterLoaded.has(archetypeId) ? `roster:${archetypeId}` : `vector:${archetypeId}:${elite}`);
  const pool = createEnemyDisplayPool({
    create: (archetypeId, elite) => { created += 1; return makeDisplay(rosterLoaded.has(archetypeId) ? 'roster' : 'vector', archetypeId, elite); },
    keyFor,
    eliteOf,
    markers,
    parent,
    depthLayer: layer,
    ...(idleCap === undefined ? {} : { idleCap }),
  });
  const dispose = () => { parent.destroy({ children: true }); layer.destroy(); };
  return { pool, rosterLoaded, markers, parent, layer, dispose, created: () => created };
}

// Everything a render reads off a display, including the pose memo that
// decides whether a budget-frozen body is re-posed.
const visualState = (display) => ({
  kind: display.kind,
  x: display.position.x,
  y: display.position.y,
  scaleX: display.scale.x,
  scaleY: display.scale.y,
  rotation: display.rotation,
  alpha: display.alpha,
  visible: display.visible,
  zIndex: display.zIndex,
  pose: display.pose,
  eliteProjection: display.eliteProjection,
  poseInput: display.worldDesignPoseInput,
  lastPose: display.worldDesignLastPose,
});

test('a released display is reused for its key and reset to its freshly built state', () => {
  const s = subject({ rosterLoaded: new Set(['forkrunner']) });
  const { parent, layer } = s;
  const display = s.pool.acquire('forkrunner', true);
  assert.equal(s.created(), 1);
  parent.addChild(display);
  layer.attach(display);
  prepareWorldDesignEnemyPose(display, false, { state: 'run', tick: 40, direction: 3, elite: true, phaseTick: null });
  display.applyPose({ state: 'death', tick: 90, direction: 5, elite: true });
  display.position.set(310, 422);
  display.scale.set(0.61, 0.58);
  display.rotation = 0.4;
  display.alpha = 0.25;
  display.visible = false;
  display.zIndex = 777;

  s.pool.release(display);
  assert.equal(display.parent, null, 'a pooled display leaves the scene graph');
  assert.equal(display.parentRenderLayer, null, 'a pooled display leaves the depth layer');
  assert.equal(layer.renderLayerChildren.length, 0);
  assert.equal(display.destroyed, false, 'pooling keeps the display instead of destroying it');

  const reused = s.pool.acquire('forkrunner', false);
  assert.equal(reused, display, 'the same key hands the pooled display back');
  assert.equal(s.created(), 1, 'reuse constructs nothing');
  assert.deepEqual(visualState(reused), visualState(makeDisplay('roster', 'forkrunner', false)),
    'a reused display is indistinguishable from a freshly built one');
  assert.deepEqual(s.pool.stats, { created: 1, reused: 1, disposed: 0 });
  s.dispose();
});

test('pools are keyed: archetypes and vector elite variants never share displays', () => {
  const s = subject();
  const plain = s.pool.acquire('forkrunner', false);
  s.pool.release(plain);
  const elite = s.pool.acquire('forkrunner', true);
  assert.notEqual(elite, plain, 'the vector fallback bakes its elite default, so elite is part of its key');
  const other = s.pool.acquire('gas-bomber', false);
  assert.notEqual(other, plain);
  assert.equal(s.pool.acquire('forkrunner', false), plain);
  assert.equal(s.created(), 3);
});

test('sync adds and removes only the changed ids and keeps survivors', () => {
  const s = subject({ rosterLoaded: new Set(['forkrunner', 'gas-bomber']) });
  const { markers, parent, layer } = s;
  const enemies = ['e01', 'e02', 'e03'].map((id, index) => ({ id, archetypeId: index === 1 ? 'gas-bomber' : 'forkrunner' }));
  const sync = (rebuild = false) => s.pool.sync(enemies, rebuild);
  sync();
  assert.equal(s.created(), 3);
  const [first, second, third] = enemies.map((enemy) => markers.get(enemy.id));
  enemies.splice(1, 1);
  sync();
  assert.equal(markers.get('e01'), first, 'survivors keep their display');
  assert.equal(markers.get('e03'), third);
  assert.equal(markers.has('e02'), false);
  assert.equal(second.parent, null, 'the retired display left the scene');
  assert.equal(parent.children.length, 2);
  assert.deepEqual(layer.renderLayerChildren, [first, third]);
  enemies.push({ id: 'e04', archetypeId: 'gas-bomber' });
  sync();
  assert.equal(markers.get('e04'), second, 'a new body of the same archetype reuses the retired display');
  assert.equal(s.created(), 3, 'no construction after warm-up');
  assert.equal(parent.children.length, 3);
  s.dispose();
});

test('stale keys are destroyed instead of pooled once the roster atlas arrives', () => {
  const s = subject();
  const { markers } = s;
  const enemies = [{ id: 'e01', archetypeId: 'forkrunner' }, { id: 'e02', archetypeId: 'forkrunner' }];
  const sync = (rebuild = false) => s.pool.sync(enemies, rebuild);
  sync();
  const vectorCorpse = s.pool.acquire('forkrunner', false);
  const idleVector = s.pool.acquire('forkrunner', false);
  s.pool.release(idleVector);
  const vectors = [...markers.values()];
  s.rosterLoaded.add('forkrunner');
  sync(true);
  assert.ok(vectors.every((display) => display.destroyed), 'vector bodies are swapped for roster bodies and destroyed');
  assert.equal(idleVector.destroyed, true, 'an idle vector display that can never be acquired again is destroyed');
  assert.ok([...markers.values()].every((display) => display.kind === 'roster'));
  s.pool.release(vectorCorpse);
  assert.equal(vectorCorpse.destroyed, true, 'a vector corpse released after the swap is destroyed, not pooled');
  assert.equal(idleCount(s.pool), 0);
  s.dispose();
});

test('an atlas rebuild leaves every live body exactly as the old full reset built it', () => {
  // The old reset rebuilt every marker, so a frame drawn before the next
  // renderWorld (an upgrade overlay keeps the ticker drawing) showed fresh
  // displays. The rebuild path must hand back the same state.
  const s = subject({ rosterLoaded: new Set(['forkrunner', 'gas-bomber']) });
  const enemies = ['e01', 'e17', 'e03'].map((id, index) => ({ id, archetypeId: index === 2 ? 'gas-bomber' : 'forkrunner' }));
  s.pool.sync(enemies);
  for (const marker of s.markers.values()) {
    prepareWorldDesignEnemyPose(marker, false, { state: 'attack', tick: 70, direction: 6, elite: false, phaseTick: 4 });
    marker.position.set(90, 140);
    marker.scale.set(0.7);
    marker.alpha = 0.5;
    marker.visible = false;
    marker.zIndex = 140;
  }
  s.pool.sync(enemies, true);
  for (const enemy of enemies) {
    assert.deepEqual(visualState(s.markers.get(enemy.id)), visualState(makeDisplay('roster', enemy.archetypeId, eliteOf(enemy.id))), enemy.id);
  }
  assert.deepEqual(s.layer.renderLayerChildren, enemies.map((enemy) => s.markers.get(enemy.id)));
  s.dispose();
});

test('a withdrawn roster atlas swaps its bodies back at the next ordinary sync', () => {
  // requestEnemyRosterAtlas withdraws index and texture together when a later
  // step of the load throws; the old reset then rebuilt those bodies as vector.
  const s = subject({ rosterLoaded: new Set(['forkrunner']) });
  const enemies = [{ id: 'e01', archetypeId: 'forkrunner' }, { id: 'e02', archetypeId: 'gas-bomber' }];
  s.pool.sync(enemies);
  const vector = s.markers.get('e02');
  s.rosterLoaded.delete('forkrunner');
  s.pool.sync(enemies);
  assert.equal(s.markers.get('e01').kind, 'vector', 'the stale roster body is replaced');
  assert.equal(s.markers.get('e02'), vector, 'an unaffected body is kept');
  s.dispose();
});

test('the idle cap destroys the surplus instead of hoarding displays', () => {
  const s = subject({ idleCap: 2 });
  const displays = [0, 1, 2].map(() => s.pool.acquire('forkrunner', false));
  for (const display of displays) s.pool.release(display);
  assert.equal(idleCount(s.pool), 2);
  assert.equal(displays[2].destroyed, true);
  assert.equal(s.pool.stats.disposed, 1);
});

// Seeded xorshift so the scenario is reproducible.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

// The pre-pool wiring from main.mjs, verbatim in behaviour: every sync
// destroys all markers and builds new ones; corpses are built per kill and
// destroyed on expiry.
function legacyWorld(rosterLoaded) {
  const world = { markers: new Map(), corpses: new Map(), parent: new Container(), deaths: new Container(), layer: new RenderLayer({ sortableChildren: true }), created: 0 };
  const build = (archetypeId, elite) => { world.created += 1; return makeDisplay(rosterLoaded.has(archetypeId) ? 'roster' : 'vector', archetypeId, elite); };
  world.sync = (enemies) => {
    for (const child of world.parent.removeChildren()) { world.layer.detach(child); child.destroy(); }
    world.markers.clear();
    for (const enemy of enemies) {
      const graphic = build(enemy.archetypeId, eliteOf(enemy.id));
      world.markers.set(enemy.id, graphic);
      world.parent.addChild(graphic);
      world.layer.attach(graphic);
    }
  };
  world.queueCorpse = (enemy, tick) => {
    const graphic = build(enemy.archetypeId, eliteOf(enemy.id));
    graphic.zIndex = enemy.y;
    world.corpses.set(enemy.id, { graphic, x: enemy.x, y: enemy.y, startTick: tick, direction: enemy.direction, elite: eliteOf(enemy.id) });
    world.deaths.addChild(graphic);
    world.layer.attach(graphic);
  };
  world.expireCorpse = (id) => {
    const death = world.corpses.get(id);
    world.layer.detach(death.graphic);
    world.deaths.removeChild(death.graphic);
    death.graphic.destroy();
    world.corpses.delete(id);
  };
  return world;
}

function pooledWorld(rosterLoaded) {
  const world = { markers: new Map(), corpses: new Map(), parent: new Container(), deaths: new Container(), layer: new RenderLayer({ sortableChildren: true }), created: 0 };
  world.pool = createEnemyDisplayPool({
    create: (archetypeId, elite) => { world.created += 1; return makeDisplay(rosterLoaded.has(archetypeId) ? 'roster' : 'vector', archetypeId, elite); },
    keyFor: (archetypeId, elite) => (rosterLoaded.has(archetypeId) ? `roster:${archetypeId}` : `vector:${archetypeId}:${elite}`),
    eliteOf,
    markers: world.markers,
    parent: world.parent,
    depthLayer: world.layer,
  });
  world.sync = (enemies, rebuild = false) => world.pool.sync(enemies, rebuild);
  world.queueCorpse = (enemy, tick) => {
    const graphic = world.pool.acquire(enemy.archetypeId, eliteOf(enemy.id));
    graphic.zIndex = enemy.y;
    world.corpses.set(enemy.id, { graphic, x: enemy.x, y: enemy.y, startTick: tick, direction: enemy.direction, elite: eliteOf(enemy.id) });
    world.deaths.addChild(graphic);
    world.layer.attach(graphic);
  };
  world.expireCorpse = (id) => {
    world.pool.release(world.corpses.get(id).graphic);
    world.corpses.delete(id);
  };
  return world;
}

// The marker and corpse half of renderWorld: culled bodies only hide, visible
// ones go through the budgeted pose memo, then the layer sorts by depth.
function render(world, enemies, tick) {
  for (const enemy of enemies) {
    const marker = world.markers.get(enemy.id);
    marker.visible = enemy.onScreen;
    if (!enemy.onScreen) continue;
    prepareWorldDesignEnemyPose(marker, enemy.animate, { state: enemy.state, tick, direction: enemy.direction, elite: eliteOf(enemy.id), phaseTick: null });
    marker.position.set(enemy.x, enemy.y);
    marker.scale.set(0.55 * 1.25);
    marker.rotation = 0;
    marker.alpha = 1;
    marker.zIndex = enemy.y;
  }
  for (const death of world.corpses.values()) {
    death.graphic.visible = true;
    death.graphic.applyPose({ state: 'death', tick: tick - death.startTick, direction: death.direction, elite: death.elite });
    death.graphic.position.set(death.x, death.y);
    death.graphic.scale.set(0.55 * 1.25);
    death.graphic.alpha = 1 - (tick - death.startTick) / 40;
  }
  world.layer.sortRenderLayerChildren();
}

// What reaches the screen: visible layer members in draw order, each with
// its identity and full visual state.
function screen(world, props) {
  const ids = new Map();
  for (const [id, marker] of world.markers) ids.set(marker, `enemy:${id}`);
  for (const [id, death] of world.corpses) ids.set(death.graphic, `corpse:${id}`);
  for (const prop of props) ids.set(prop, prop.label);
  return world.layer.renderLayerChildren.filter((item) => item.visible).map((item) => {
    const identity = ids.get(item);
    assert.ok(identity, 'every drawn layer member must be a live marker, corpse or prop');
    return { identity, ...(item.pose ? visualState(item) : { zIndex: item.zIndex }) };
  });
}

test('pooled sync draws exactly what the full rebuild drew, frame for frame', () => {
  const next = random(0x484d4804);
  const rosterLegacy = new Set(['forkrunner']);
  const rosterPooled = new Set(['forkrunner']);
  const legacy = legacyWorld(rosterLegacy);
  const pooled = pooledWorld(rosterPooled);
  // Props share the depth layer and are attached first, as at boot. Their
  // depths sit on the same coarse grid the bodies use, so exact ties between
  // bodies, corpses and props happen constantly.
  const props = [0, 1, 2].map((index) => {
    const pair = [new Container(), new Container()];
    for (const prop of pair) { prop.label = `prop:${index}`; prop.zIndex = 100 + index * 50; }
    return pair;
  });
  legacy.layer.attach(...props.map((pair) => pair[0]));
  pooled.layer.attach(...props.map((pair) => pair[1]));
  const archetypes = ['forkrunner', 'gas-bomber', 'whale-enforcer'];
  const states = ['idle', 'run', 'tell', 'attack', 'hit'];
  let serial = 0;
  const spawn = () => {
    serial += 1;
    return {
      id: `e${String(serial).padStart(3, '0')}`,
      archetypeId: archetypes[Math.floor(next() * archetypes.length)],
      x: Math.floor(next() * 12) * 25,
      y: Math.floor(next() * 12) * 25,
      direction: Math.floor(next() * 8),
      state: 'run',
      onScreen: true,
      animate: true,
    };
  };
  const enemies = [];
  for (let index = 0; index < 18; index += 1) enemies.push(spawn());
  legacy.sync(enemies);
  pooled.sync(enemies);
  let syncs = 0;
  for (let tick = 1; tick <= 400; tick += 1) {
    let changed = false;
    if (tick === 180 || tick === 290) {
      // A roster atlas finishing its load rebuilds every live body.
      const loaded = tick === 180 ? 'gas-bomber' : 'whale-enforcer';
      rosterLegacy.add(loaded);
      rosterPooled.add(loaded);
      legacy.sync(enemies);
      pooled.sync(enemies, true);
      syncs += 1;
    }
    if (next() < 0.35 && enemies.length > 4) {
      for (let kills = 1 + Math.floor(next() * 2); kills > 0 && enemies.length > 4; kills -= 1) {
        const [enemy] = enemies.splice(Math.floor(next() * enemies.length), 1);
        if (!legacy.corpses.has(enemy.id)) { legacy.queueCorpse(enemy, tick); pooled.queueCorpse(enemy, tick); }
      }
      changed = true;
    }
    if (next() < 0.3 && enemies.length < 40) {
      for (let spawns = 1 + Math.floor(next() * 3); spawns > 0; spawns -= 1) enemies.push(spawn());
      enemies.sort((left, right) => (left.id < right.id ? -1 : 1));
      changed = true;
    }
    if (changed) { legacy.sync(enemies); pooled.sync(enemies); syncs += 1; }
    for (const [id, death] of [...legacy.corpses]) {
      if (tick - death.startTick >= 40) { legacy.expireCorpse(id); pooled.expireCorpse(id); }
    }
    for (const enemy of enemies) {
      if (next() < 0.3) enemy.y = Math.max(0, Math.min(275, enemy.y + (Math.floor(next() * 3) - 1) * 25));
      if (next() < 0.2) enemy.x = Math.floor(next() * 12) * 25;
      if (next() < 0.1) enemy.direction = Math.floor(next() * 8);
      if (next() < 0.1) enemy.state = states[Math.floor(next() * states.length)];
      enemy.onScreen = next() < 0.85;
      enemy.animate = next() < 0.4;
    }
    render(legacy, enemies, tick);
    render(pooled, enemies, tick);
    assert.deepEqual(screen(pooled, props.map((pair) => pair[1])), screen(legacy, props.map((pair) => pair[0])), `frame ${tick} diverged`);
    // runtime-telemetry-writer counts elite markers over every marker, culled
    // and never-posed ones included, so a reused display must carry its new
    // body's elite flag from the moment it is acquired.
    const eliteMarkers = (world) => [...world.markers.values()].filter((marker) => marker.eliteProjection).length;
    assert.equal(eliteMarkers(pooled), eliteMarkers(legacy), `frame ${tick} elite telemetry diverged`);
  }
  assert.ok(syncs > 150, `the scenario must exercise many spawn/kill syncs (${syncs})`);
  assert.ok(pooled.created * 4 < legacy.created, `pooling must construct far fewer displays (${pooled.created} vs ${legacy.created})`);
  for (const world of [legacy, pooled]) { world.parent.destroy({ children: true }); world.deaths.destroy({ children: true }); world.layer.destroy(); }
});

test('main.mjs routes every enemy and corpse display through the pool', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const count = (pattern) => (source.match(pattern) ?? []).length;
  assert.equal(count(/resetEnemyMarkers/g), 0, 'the destroy-and-rebuild marker reset is gone');
  // Initial JS is capped: the pool is a lazy chunk fetched during renderer
  // init and awaited before the first marker is built.
  assert.equal(count(/^import[^;]*enemy-display-pool/gm), 0, 'the pool never joins the initial bundle');
  const fetched = source.indexOf("const enemyDisplayPoolModule = import('./enemy-display-pool.mjs');");
  assert.ok(fetched > 0 && fetched < source.indexOf('await app.init('), 'the chunk is requested before the renderer init wait');
  assert.ok(source.indexOf('const { createEnemyDisplayPool } = await enemyDisplayPoolModule;') < source.indexOf('bridge.activate();'), 'and resolved before any session can build a marker');
  assert.equal(count(/createEnemyDisplayPool\(\{\s*create: createRosterOrVectorDisplay,/g), 1, 'the pool builds with the existing roster/vector factory');
  assert.equal(count(/createRosterOrVectorDisplay\(/g), 0, 'nothing builds an enemy display outside the pool');
  assert.equal(count(/syncEnemyMarkers\(grayboxEnemies\);/g), 4, 'boot, director, boss-add and retirement syncs are incremental');
  assert.equal(count(/syncEnemyMarkers\(grayboxEnemies, true\);/g), 1, 'a finished roster atlas rebuilds every live body, as before');
  assert.equal(count(/syncEnemyMarkers\(\[\]\);/g), 1, 'the run reset releases every marker');
  assert.equal(count(/(?:death|oldest)\.graphic\.destroy\(/g), 0, 'corpses return to the pool instead of being destroyed');
  assert.equal(count(/const graphic = enemyDisplayPool\.acquire\(enemy\.archetypeId, eliteProjection\);/g), 1, 'corpses are acquired from the pool');
});
