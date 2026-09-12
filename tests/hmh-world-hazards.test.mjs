import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_HAZARD_RULES, WORLD_ENVIRONMENT_WEAPON_IDS, worldHazardPhase, worldHazardField, buildWorldHazardHits, withholdLethalHazardHits } from '../apps/hmh-reboot/src/world-hazards.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';
import { createWorldDesignLife } from '../apps/hmh-reboot/src/world-design-life.mjs';
import { createWorldDesignState } from '../apps/hmh-reboot/src/world-design-interactions.mjs';

const HAZARDS = LEVEL_ONE_WORLD.interactions.hazards;
const byKind = (kind) => HAZARDS.find((h) => h.kind === kind);
const flat = () => ({ groundZ: 0 });

test('periodic hazards idle, warn for exactly warningTicks, then impact on the period boundary, never on the spawn tick', () => {
  for (const kind of ['rockfall', 'damage-zone']) {
    const hazard = byKind(kind), rule = WORLD_HAZARD_RULES[kind];
    assert.equal(worldHazardPhase(hazard, 0).phase, 'idle');
    for (let cycle = 1; cycle <= 3; cycle++) {
      const impact = cycle * rule.periodTicks;
      assert.equal(worldHazardPhase(hazard, impact - rule.warningTicks - 1).phase, 'idle');
      for (let t = impact - rule.warningTicks; t < impact; t++) {
        const phase = worldHazardPhase(hazard, t);
        assert.equal(phase.phase, 'warning', `${kind} tick ${t}`);
        assert.ok(phase.progress >= 0 && phase.progress < 1);
      }
      assert.deepEqual(worldHazardPhase(hazard, impact), { phase: 'impact', progress: 1, cycle });
      assert.equal(worldHazardPhase(hazard, impact + 1).phase, 'idle');
    }
    // Two independent evaluations agree: the schedule is the tick alone.
    for (const t of [0, 233, 234, 299, 300, 301, 899]) assert.deepEqual(worldHazardPhase(hazard, t), worldHazardPhase(hazard, t));
  }
  for (const kind of ['area-slow', 'moving-hazard', 'deep-water']) assert.equal(worldHazardPhase(byKind(kind), 300).phase, 'idle');
});

test('hazard hits fire only on impact, respect the height band and inactive targets, and keep environmental attribution through real combat resolution', () => {
  const rock = byKind('rockfall'), grid = byKind('damage-zone');
  const at = (hazard, id, extra = {}) => ({ id, x: hazard.anchor.x + 40, y: hazard.anchor.y - 30, groundZ: 0, ...extra });
  const targets = [at(rock, 'forkrunner'), at(rock, 'player'), at(rock, 'ledge', { groundZ: 64 }), at(rock, 'dead', { active: false }), at(rock, 'far', { x: rock.anchor.x + 200 }), at(grid, 'yard')];
  assert.equal(buildWorldHazardHits(HAZARDS, { tick: 299, targets, queryGround: flat }).length, 0);
  assert.equal(buildWorldHazardHits(HAZARDS, { tick: 0, targets, queryGround: flat }).length, 0);
  const rockHits = buildWorldHazardHits(HAZARDS, { tick: 300, targets, queryGround: flat });
  assert.deepEqual(rockHits.map((h) => h.targetId), ['forkrunner', 'player']);
  for (const hit of rockHits) {
    assert.equal(hit.sourceId, rock.id);
    assert.equal(hit.weaponId, 'world-rockfall');
    assert.equal(hit.damage, 24);
    assert.equal(hit.criticalChance, 0);
  }
  const gridHits = buildWorldHazardHits(HAZARDS, { tick: 240, targets, queryGround: flat });
  assert.deepEqual(gridHits.map((h) => [h.targetId, h.weaponId, h.damage, h.sourceId]), [['yard', 'world-grid', 14, grid.id]]);
  // Tick 1200 is a multiple of both periods: both hazards fall in one tick.
  assert.equal(buildWorldHazardHits(HAZARDS, { tick: 1200, targets, queryGround: flat }).length, 3);
  const result = resolveCombatHits({ sessionSeed: 7, hits: rockHits, targets: [
    { id: 'forkrunner', health: 64, maxHealth: 64, armor: 1, shieldCharges: 0 },
    { id: 'player', health: 100, maxHealth: 100, armor: 1, shieldCharges: 0 },
  ] });
  assert.equal(result.targets.forkrunner.health, 40);
  assert.equal(result.targets.player.health, 76);
  for (const event of result.damageEvents) assert.notEqual(event.sourceId, 'player');
  // Same tick, same hits: nothing here consults a random stream.
  assert.deepEqual(buildWorldHazardHits(HAZARDS, { tick: 300, targets, queryGround: flat }), rockHits);
});

test('environmental damage wears the boss down but never lands the killing blow, so boss defeat stays on the weapon-attributed authority path', () => {
  const grid = byKind('damage-zone');
  const boss = { id: 'boss-liquidator', x: grid.anchor.x + 10, y: grid.anchor.y, groundZ: 0, active: true };
  const enemy = { id: 'forkrunner', x: grid.anchor.x - 10, y: grid.anchor.y, groundZ: 0 };
  const raw = buildWorldHazardHits(HAZARDS, { tick: 240, targets: [boss, enemy], queryGround: flat });
  assert.deepEqual(raw.map((h) => [h.targetId, h.damage]), [['boss-liquidator', 14], ['forkrunner', 14]]);
  const targetsFor = (health) => [
    { id: 'boss-liquidator', health, maxHealth: 100, armor: 1, shieldCharges: 0 },
    { id: 'forkrunner', health: 10, maxHealth: 64, armor: 1, shieldCharges: 0 },
  ];
  // Uncapped, the resolution retires the boss under a world-* weapon that no run-summary row can credit.
  assert.deepEqual(resolveCombatHits({ sessionSeed: 7, hits: raw, targets: targetsFor(10) }).scoreEvents.map((e) => [e.enemyId, e.weaponId]), [['boss-liquidator', 'world-grid'], ['forkrunner', 'world-grid']]);
  const capped = withholdLethalHazardHits(raw, { targetId: 'boss-liquidator', health: 10 });
  assert.deepEqual(capped.map((h) => [h.targetId, h.damage]), [['boss-liquidator', 9], ['forkrunner', 14]]);
  const result = resolveCombatHits({ sessionSeed: 7, hits: capped, targets: targetsFor(10) });
  assert.equal(result.targets['boss-liquidator'].health, 1);
  assert.equal(result.targets['boss-liquidator'].active, true);
  assert.deepEqual(result.scoreEvents.map((e) => e.enemyId), ['forkrunner']);
  // Full damage lands while the boss has headroom; at 1 HP (or a fraction) the hit is withheld outright.
  assert.deepEqual(withholdLethalHazardHits(raw, { targetId: 'boss-liquidator', health: 100 }), raw);
  assert.deepEqual(withholdLethalHazardHits(raw, { targetId: 'boss-liquidator', health: 15 }).map((h) => h.damage), [14, 14]);
  assert.deepEqual(withholdLethalHazardHits(raw, { targetId: 'boss-liquidator', health: 1 }).map((h) => h.targetId), ['forkrunner']);
  assert.deepEqual(withholdLethalHazardHits(raw, { targetId: 'boss-liquidator', health: 1.5 }).map((h) => h.targetId), ['forkrunner']);
  assert.deepEqual(withholdLethalHazardHits(raw, { targetId: 'boss-liquidator', health: 0 }).map((h) => h.targetId), ['forkrunner']);
  // Same input, same output: no state and no random stream.
  assert.deepEqual(withholdLethalHazardHits(raw, { targetId: 'boss-liquidator', health: 10 }), capped);
});

test('the movement field slows inside the spore bed, drifts inside the conveyor capsule, and composes', () => {
  const spore = byKind('area-slow'), belt = byKind('moving-hazard');
  const still = { speed: 1, drift: { x: 0, y: 0 } };
  assert.deepEqual(worldHazardField(HAZARDS, { x: spore.anchor.x + 60, y: spore.anchor.y, groundZ: 0 }), { speed: 0.55, drift: { x: 0, y: 0 } });
  assert.deepEqual(worldHazardField(HAZARDS, { x: spore.anchor.x + 121, y: spore.anchor.y, groundZ: 0 }), still);
  assert.deepEqual(worldHazardField(HAZARDS, { x: spore.anchor.x, y: spore.anchor.y, groundZ: 64 }), still);
  assert.deepEqual(worldHazardField(HAZARDS, { x: belt.anchor.x - 150, y: belt.anchor.y + 60, groundZ: 0 }), { speed: 1, drift: { x: 150, y: 0 } });
  assert.deepEqual(worldHazardField(HAZARDS, { x: belt.anchor.x, y: belt.anchor.y + 71, groundZ: 0 }), still);
  assert.deepEqual(worldHazardField(HAZARDS, { x: belt.anchor.x + 161, y: belt.anchor.y, groundZ: 0 }), still);
  // Overlapping authored circles multiply and sum rather than replace.
  const stacked = [spore, { ...spore, id: 'spore-b' }, belt, { ...belt, id: 'belt-b', anchor: spore.anchor }];
  const inside = worldHazardField(stacked, { x: spore.anchor.x, y: spore.anchor.y, groundZ: 0 });
  assert.ok(Math.abs(inside.speed - 0.55 * 0.55) < 1e-12);
  assert.deepEqual(inside.drift, { x: 150, y: 0 });
  // The hashwood shrine stays outside the bed so resting there is never slowed.
  const query = createLevelOneGroundQuery();
  assert.equal(worldHazardField(HAZARDS, { x: 7380, y: 3450, groundZ: query(7380, 3450).groundZ }).speed, 1);
  assert.deepEqual([...WORLD_ENVIRONMENT_WEAPON_IDS], ['world-steam', 'world-rockfall', 'world-grid']);
  for (const id of WORLD_ENVIRONMENT_WEAPON_IDS) assert.ok(!(id in HMH_RUN_SUMMARY_CATALOGS.weapons) && !Object.values(HMH_RUN_SUMMARY_CATALOGS.weapons).includes(id), `${id} must stay off the run-summary weapon catalog`);
});

class FakeGraphics {
  constructor() { this.commands = []; }
  clear() { this.commands = []; return this; }
}
for (const name of ['circle', 'rect', 'roundRect', 'moveTo', 'lineTo', 'stroke', 'fill']) FakeGraphics.prototype[name] = function (...args) { this.commands.push([name, ...args]); return this; };
class FakeContainer { constructor() { this.children = []; } addChild(...c) { this.children.push(...c); } }
class FakeText { constructor() { this.anchor = { set() {} }; this.position = { set() {} }; this.style = {}; this.text = ''; this.visible = false; } }

function renderAt({ tick, actor, hazards = HAZARDS, announce = null, life = createWorldDesignLife({ ContainerClass: FakeContainer, GraphicsClass: FakeGraphics, TextClass: FakeText }), particleBudget = 10, reduceMotion = false, reduceFlash = false }) {
  const report = life.render({ state: createWorldDesignState(), actor, camera: { zoom: 1 }, view: { width: 20_000, height: 20_000 }, worldToScreen: (p) => ({ x: p.x, y: p.y - p.z }), queryGround: flat, tick, particleBudget, reduceMotion, reduceFlash, hazards, announce });
  return { report, ground: JSON.stringify(life.ground.commands), commands: life.ground.commands, effects: JSON.stringify(life.overlay.children[0].commands), life };
}

test('the periodic telegraph plate covers exactly the ground the hit test covers', () => {
  // Zoom 1, flat ground and a top-down projection: screen shapes are world shapes.
  for (const kind of ['damage-zone', 'rockfall']) {
    const hazard = byKind(kind), rule = WORLD_HAZARD_RULES[kind], impact = rule.periodTicks;
    const far = { x: 100, y: 100, groundZ: 0 };
    for (const tick of [impact - rule.warningTicks + 1, impact - 8, impact]) {
      const { commands } = renderAt({ tick, actor: far, hazards: [hazard] });
      // Every plate stroke or fill is a circle on the anchor; no slab, no offset rectangle.
      const plates = commands.filter((c) => c[0] === 'circle' && c[1] === hazard.anchor.x && c[2] === hazard.anchor.y);
      assert.ok(plates.length > 0, `${kind} tick ${tick} draws a plate`);
      assert.ok(!commands.some((c) => c[0] === 'rect' && Math.abs(c[1] + c[3] / 2 - hazard.anchor.x) < rule.radius * 2), `${kind} tick ${tick} draws no slab`);
      const smallest = Math.min(...plates.map((c) => c[3]));
      assert.ok(smallest >= rule.radius - 1e-9 && (tick !== impact || smallest === rule.radius), `${kind} tick ${tick} plate radius ${smallest}`);
      const damagedAt = (dx, dy) => buildWorldHazardHits([hazard], { tick: impact, targets: [{ id: 't', x: hazard.anchor.x + dx, y: hazard.anchor.y + dy, groundZ: 0 }], queryGround: flat }).length === 1;
      const r = rule.radius;
      // Circle edge at 0/90/180/270 degrees, the old slab corners, and just outside.
      for (const [dx, dy, expected] of [[r, 0, true], [0, r, true], [-r, 0, true], [0, -r, true], [0, 130, kind === 'damage-zone'], [140, 100, false], [-145, -104, false], [0, r + 1, false]]) {
        const telegraphed = Math.hypot(dx, dy) <= smallest;
        assert.equal(damagedAt(dx, dy), expected, `${kind} offset ${dx},${dy} damaged`);
        // Every damaged point sits under the plate at every warning tick. The
        // rockfall ring deliberately starts wide and collapses onto the damage
        // circle, so the converse (safe ground is never telegraphed) is exact
        // for the grid at every tick and for the rockfall at impact.
        if (expected || kind === 'damage-zone' || tick === impact) assert.equal(telegraphed, expected, `${kind} tick ${tick} offset ${dx},${dy} telegraphed`);
      }
    }
  }
});

test('reduceFlash steadies the grid blink and removes the impact fill while keeping the shape cues and particles', () => {
  const grid = byKind('damage-zone'), rock = byKind('rockfall');
  const far = { x: 100, y: 100, groundZ: 0 };
  const gridStrokeAlphas = (tick, reduceFlash) => renderAt({ tick, actor: far, hazards: [grid], reduceFlash }).commands.filter((c) => c[0] === 'stroke' && c[1].color === 0x7ee0ff).map((c) => c[1].alpha);
  // Ticks 230 and 231 sit on opposite sides of a blink parity flip.
  assert.deepEqual(gridStrokeAlphas(230, false), [0.7]);
  assert.deepEqual(gridStrokeAlphas(231, false), [0.18]);
  assert.deepEqual(gridStrokeAlphas(230, true), [0.7]);
  assert.deepEqual(gridStrokeAlphas(231, true), [0.7]);
  assert.equal(renderAt({ tick: 230, actor: far, hazards: [grid], reduceFlash: true }).ground, renderAt({ tick: 231, actor: far, hazards: [grid], reduceFlash: true }).ground);
  for (let tick = 192; tick < 240; tick++) assert.deepEqual(gridStrokeAlphas(tick, true), [0.7], `steady stroke at tick ${tick}`);
  // Impact: no plate fill under reduceFlash, a steady stroke instead; the pulse is still reported and the particles still fall.
  const fills = (tick, hazard, reduceFlash, color) => renderAt({ tick, actor: far, hazards: [hazard], reduceFlash }).commands.filter((c) => c[0] === 'fill' && c[1].color === color).length;
  assert.equal(fills(240, grid, false, 0x7ee0ff), 1);
  assert.equal(fills(240, grid, true, 0x7ee0ff), 0);
  assert.equal(fills(300, rock, false, 0xf1e6d2), 1);
  assert.equal(fills(300, rock, true, 0xf1e6d2), 0);
  const steady = renderAt({ tick: 240, actor: far, hazards: [grid], reduceFlash: true });
  assert.deepEqual(steady.report.hazardTelegraphs, [`${grid.id}:impact`]);
  assert.ok(steady.report.particles > 0);
  assert.ok(steady.commands.some((c) => c[0] === 'stroke' && c[1].color === 0x7ee0ff && c[1].alpha === 0.7));
  // The rockfall ring collapse and shadow swell are shape changes, not flashes: they survive reduceFlash.
  assert.notEqual(renderAt({ tick: 250, actor: far, hazards: [rock], reduceFlash: true }).ground, renderAt({ tick: 251, actor: far, hazards: [rock], reduceFlash: true }).ground);
});

test('hazard telegraphs are a pure function of (hazard, tick, actor), draw nothing when idle, and stay under the particle budget', () => {
  const rock = byKind('rockfall');
  const far = { x: 100, y: 100, groundZ: 0 };
  const idle = renderAt({ tick: 100, actor: far }), bare = renderAt({ tick: 100, actor: far, hazards: [] });
  // Static dressing (bed ring, belt chevrons) is allowed while idle; the periodic hazards add nothing.
  assert.deepEqual(idle.report.hazardTelegraphs, []);
  assert.equal(renderAt({ tick: 100, actor: far, hazards: HAZARDS.filter((h) => h.kind === 'rockfall' || h.kind === 'damage-zone') }).ground, bare.ground);
  const warnA = renderAt({ tick: 250, actor: far }), warnB = renderAt({ tick: 250, actor: far });
  assert.equal(warnA.ground, warnB.ground);
  // Tick 250: the rockfall (300-period) is warning, the grid (240-period) is 10 ticks past its pulse.
  assert.deepEqual(warnA.report.hazardTelegraphs, [rock.id]);
  assert.deepEqual(renderAt({ tick: 230, actor: far }).report.hazardTelegraphs, [byKind('damage-zone').id]);
  assert.notEqual(warnA.ground, idle.ground);
  assert.notEqual(warnA.ground, renderAt({ tick: 251, actor: far }).ground, 'the ring collapses tick by tick');
  const impact = renderAt({ tick: 300, actor: far });
  assert.deepEqual(impact.report.hazardTelegraphs, [`${rock.id}:impact`]);
  assert.ok(impact.report.particles <= 10 && impact.report.particles > 0);
  assert.equal(renderAt({ tick: 300, actor: far, particleBudget: 0 }).report.particles, 0);
  assert.equal(renderAt({ tick: 300, actor: far, reduceMotion: true }).report.particles, 0);
  assert.deepEqual(renderAt({ tick: 308, actor: far }).report.hazardTelegraphs, []);
  // Standing in the bed tints the hero; the effects layer is untouched elsewhere.
  const spore = byKind('area-slow');
  const slowed = renderAt({ tick: 100, actor: { x: spore.anchor.x, y: spore.anchor.y, groundZ: 0 } });
  assert.deepEqual(slowed.report.hazardTelegraphs, ['hero-slow']);
  assert.notEqual(slowed.effects, idle.effects);
  assert.equal(renderAt({ tick: 100, actor: { x: spore.anchor.x, y: spore.anchor.y, groundZ: 64 } }).effects, idle.effects);
});

test('the warning caption fires once per cycle and only for a hero close enough to be under the fall', () => {
  const rock = byKind('rockfall');
  const captions = [];
  const life = createWorldDesignLife({ ContainerClass: FakeContainer, GraphicsClass: FakeGraphics, TextClass: FakeText });
  const under = { x: rock.anchor.x + 20, y: rock.anchor.y, groundZ: 0 };
  for (const tick of [233, 234, 235, 260, 299, 300, 534, 535]) renderAt({ tick, actor: under, life, announce: (text) => captions.push([tick, text]) });
  assert.deepEqual(captions, [[234, 'Rockfall warning: move clear.'], [534, 'Rockfall warning: move clear.']]);
  const quiet = [];
  renderAt({ tick: 240, actor: { x: rock.anchor.x + 400, y: rock.anchor.y, groundZ: 0 }, announce: (text) => quiet.push(text) });
  assert.deepEqual(quiet, []);
});

test('the runtime feeds one invulnerability-aware target list to both hazard hooks and retires every environmental kill', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.equal(source.match(/const playerInvulnerable = evidenceSafeEnabled \|\| isDashInvulnerable\(dashState, tick\);/g).length, 1);
  const hoisted = source.indexOf('const playerInvulnerable = evidenceSafeEnabled');
  const targets = source.indexOf('const hazardTargets = [');
  const steam = source.indexOf('buildWorldDesignHazardHits(worldDesignState,{tick,targets:hazardTargets,');
  const hazards = source.indexOf('buildWorldHazardHits(LEVEL_ONE_WORLD.interactions.hazards, { tick, targets: hazardTargets, queryGround })');
  const hurt = source.indexOf('const playerHurtTarget = playerHealth > 0 && !playerInvulnerable');
  assert.ok(hoisted > 0 && hoisted < targets && targets < steam && steam < hazards && hazards < hurt);
  assert.match(source, /const hazardTargets = \[\s*\.\.\.\(playerInvulnerable \? \[\] : \[\{ \.\.\.actor, id: 'player' \}\]\),\s*\.\.\.grayboxEnemies,\s*\.\.\.\(liquidatorBoss\.active && tick >= liquidatorBoss\.startTick \? \[liquidatorBoss\] : \[\]\),\s*\];/);
  assert.match(source, /if\(WORLD_ENVIRONMENT_WEAPON_IDS\.has\(scoreEvent\.weaponId\)\) \{/);
  assert.ok(!source.includes("scoreEvent.weaponId==='world-steam'"));
  // Movement: the slow multiplies after the run effects, the drift lands before the swept collision.
  assert.match(source, /speedMultiplier: terrainSpeedMultiplier[\s\S]{0,160}runEffects\.moveSpeedMultiplier\s*\* playerHazardField\.speed/);
  const drift = source.indexOf('motion.x += playerHazardField.drift.x * dtSeconds;');
  const sweep = source.indexOf('lastCollision = resolveSweptCircleMotion({\n          body: playerBody,\n          start: movementStart,');
  assert.ok(drift > 0 && drift < sweep);
  assert.match(source, /fieldAt: \(x, y, ground\) => worldHazardField\(LEVEL_ONE_WORLD\.interactions\.hazards, \{ x, y, groundZ: ground\.groundZ \}\),/);
  // Boss non-lethality: both hazard hooks pass through the cap, hazard hits skip
  // the role-check/punish scaling, and the apply step clamps again at 1 HP.
  assert.match(source, /const bossHazardCap = \{ targetId: liquidatorBoss\.id, health: liquidatorBoss\.health \};/);
  assert.equal(source.match(/withholdLethalHazardHits\(buildWorld(?:Design)?HazardHits\(/g).length, 2);
  assert.ok(source.indexOf('const bossHazardCap = ') < steam);
  assert.match(source, /if \(!targetKind \|\| WORLD_ENVIRONMENT_WEAPON_IDS\.has\(hit\.weaponId\)\) return hit;/);
  assert.match(source, /const bossHitAmount = WORLD_ENVIRONMENT_WEAPON_IDS\.has\(damageEvent\.weaponId\)\s*\? Math\.min\(damageEvent\.damageApplied, Math\.max\(0, liquidatorBoss\.health - 1\)\)\s*: damageEvent\.damageApplied;\s*const bossDamage = applyLiquidatorDamage\(\{ boss: liquidatorBoss, amount: bossHitAmount, tick \}\);/);
  // The telegraph renderer receives the reduceFlash setting alongside reduceMotion.
  assert.match(source, /worldLife\.render\(\{[^\n]*reduceMotion:settings\.reduceMotion,reduceFlash:settings\.reduceFlash,/);
});
