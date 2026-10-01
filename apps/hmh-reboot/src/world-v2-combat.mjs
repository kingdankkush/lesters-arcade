// Ten-area gameplay wiring (slice HMH-TEN-AREA-GAMEPLAY-WIRING): the live
// district bosses, the six 2.0 enemies, and cover + traversal for the
// unofficial ten-area Free world only. Lazy: reached only through
// world-v2-runtime-context.mjs, so the legacy Ranked world never loads it and
// main.mjs calls into it only through a null-guarded `combat` handle.
//
// Simulation pieces here are pure deterministic functions of the run seed and
// the input stream (no RNG stream, clock or DOM). Presentation helpers (boss
// tint, hero clips, prompt rings) read state and never write it back.
import { freezeDeep } from './value-guards.mjs';
import { ENEMY_ARCHETYPES, registerEnemyArchetypes } from './enemy-archetypes.mjs';
import { NEW_ENEMY_ARCHETYPES } from './enemy-archetypes-2.mjs';
import { DISTRICT_BOSS_KITS } from './boss-slots.mjs';
import { dropCourtGenesisSeal } from './boss-courts-world-v1.mjs';
import { LIQUIDATOR_PHASES } from './liquidator-boss.mjs';
import { COVER_RULES_V1, applyCoverToDamage, coverFaceIndex, createCoverState, stepCover } from './cover-system.mjs';
import {
  TRAVERSAL_RULES_V1,
  beginLandRecovery,
  createTraversalMarker,
  createTraversalState,
  stepTraversal,
  traversalInvulnerability,
} from './traversal-system.mjs';
import { isWorldV2PointClear } from './world-v2-runtime-world.mjs';

// --- New enemies ------------------------------------------------------------

// Areas whose tier gate lacks the role a 2.0 enemy fills gain that role.
// Encounter bands still gate it by time (bruiser and demolition from 18,000).
export const WORLD_V2_EXTRA_ROLES = freezeDeep({
  'litecoin-city': ['demolition'],
  'halving-farms': ['bruiser'],
  'scrypt-bayou': ['bruiser'],
  'hashwood-river': ['bruiser'],
});

// Per-area archetype pools by role (the director's ROLE_ARCHETYPES for that
// area). The 2.0 enemy leads its pool; the legacy one alternates with it.
export const WORLD_V2_DISTRICT_ARCHETYPES = freezeDeep({
  'litecoin-city': { flanker: ['rug-puller', 'forkrunner'], demolition: ['money-printer', 'gas-bomber'] },
  'rugpull-woods': { flanker: ['rug-puller', 'forkrunner'] },
  'halving-farms': { bruiser: ['pump-and-dump-bloater'] },
  'scrypt-bayou': { bruiser: ['pump-and-dump-bloater', 'whale-enforcer'] },
  'hashwood-river': { bruiser: ['tollkeeper'] },
  'fork-fortress': { bruiser: ['tollkeeper', 'whale-enforcer'] },
  'hollow-pines': { rusher: ['hodl-revenant', 'bagholder-rusher'] },
  'ledger-ridge': { suppressor: ['oracle-marksman', 'liquidator-agent'] },
});

// The runtime rows this world registers: the 2.0 table verbatim except that
// its insertion gate counts the temporary presentation (the tinted legacy
// roster sprite, the 3D pilot GLB when enabled) as runtime-complete. The
// source table keeps productionComplete: false for the art review.
export const WORLD_V2_NEW_ENEMY_RUNTIME = freezeDeep(Object.fromEntries(Object.entries(NEW_ENEMY_ARCHETYPES).map(([id, archetype]) => [id, {
  ...archetype,
  visual: { ...archetype.visual, productionComplete: true, runtimePresentation: 'sprite-fallback' },
}])));

export const WORLD_V2_ENEMY_ARCHETYPES = freezeDeep({ ...ENEMY_ARCHETYPES, ...WORLD_V2_NEW_ENEMY_RUNTIME });

export function worldV2SpriteFallback(archetypeId) {
  return Object.hasOwn(NEW_ENEMY_ARCHETYPES, archetypeId) ? NEW_ENEMY_ARCHETYPES[archetypeId].spriteFallback : null;
}

// --- District bosses --------------------------------------------------------

// Presentation until the boss GLBs land: the Liquidator's sprite and 3D body
// with a per-boss tint and scale (model heights 2.25 / 2.50 / 2.30 m).
export const DISTRICT_BOSS_LOOK = freezeDeep({
  'rug-pull-baron': { actorId: 'boss-rug-pull-baron', tint: 0xff7a6a, scale: 0.98 },
  'fifty-one-percent-foreman': { actorId: 'boss-51-foreman', tint: 0xffb45a, scale: 1.09 },
  lockkeeper: { actorId: 'boss-lockkeeper', tint: 0x8fd99a, scale: 1 },
});

const kitOf = (boss) => (boss && Object.hasOwn(DISTRICT_BOSS_KITS, boss.bossId) ? DISTRICT_BOSS_KITS[boss.bossId] : null);

// The live slot's boss, else the most recently started one (a defeated boss
// keeps its death beat). One boss lives at a time (boss-slots.mjs).
export function activeWorldV2Boss(slots) {
  let latest = null;
  for (const slot of Object.values(slots.slots)) {
    if (slot.status === 'live' && slot.boss) return slot.boss;
    if (slot.boss && (!latest || slot.initiatedTick > latest.initiatedTick)) latest = slot;
  }
  return latest?.boss ?? null;
}

export function closedWorldV2BossWalls(slots) {
  return slots ? Object.values(slots.slots).flatMap((slot) => slot.closedWalls) : [];
}

// The Liquidator presentation pose for a district boss: same beats, the boss's
// own tell lengths.
function districtBossPose(kit, { boss, player, tick, lastAttack, hitUntil, deathUntil }) {
  const pending = boss.pendingAttacks[0];
  const target = pending?.target ?? player;
  const direction = (Math.round(Math.atan2(target.y - boss.y, target.x - boss.x) / (Math.PI / 4)) + 8) % 8;
  let state = 'idle', phaseTick = null, poseTick = tick;
  if (!boss.active) { state = 'death'; poseTick = Math.max(0, tick - (deathUntil - 45)); }
  else if (tick <= hitUntil) { state = 'hit'; poseTick = Math.max(0, tick - (hitUntil - 6)); }
  else if (pending) {
    state = 'tell';
    phaseTick = Math.max(0, tick - pending.resolveTick + (kit.definition.attacks[pending.attackId]?.tellTicks ?? 0));
  } else if (lastAttack && tick >= lastAttack.tick && tick - lastAttack.tick < 30) {
    state = 'attack'; phaseTick = tick - lastAttack.tick;
  }
  // The shared Liquidator sprite knows only his own phase silhouettes.
  return { state, tick: poseTick, phaseTick, direction, phase: LIQUIDATOR_PHASES[Math.min(boss.phaseIndex, LIQUIDATOR_PHASES.length - 1)].id, elite: true };
}

// The district boss GLBs carry ten clips (idle, run, tell, attack, attack-2,
// super-tell, super, hit, stagger, death); the simulation state picks one.
export function districtBoss3dPose(kit, { boss, player, tick, lastAttack, hitUntil, deathUntil }) {
  const pending = boss.pendingAttacks[0];
  const target = pending?.target ?? player;
  const direction = (Math.round(Math.atan2(target.y - boss.y, target.x - boss.x) / (Math.PI / 4)) + 8) % 8;
  const attacks = kit.definition.attacks;
  let state = 'idle', phaseTick = tick;
  if (!boss.active) { state = 'death'; phaseTick = Math.max(0, tick - (deathUntil - 45)); }
  else if (tick <= hitUntil) { state = 'hit'; phaseTick = Math.max(0, tick - (hitUntil - 6)); }
  else if (tick <= boss.staggerUntil) { state = 'stagger'; phaseTick = Math.max(0, tick - (boss.staggerUntil - 90)); }
  else if (pending) {
    state = attacks[pending.attackId]?.tier === 'super' ? 'super-tell' : 'tell';
    phaseTick = Math.max(0, tick - pending.tellStartTick);
  } else if (lastAttack && tick >= lastAttack.tick && tick - lastAttack.tick < 30) {
    const clip = attacks[lastAttack.attackId]?.clip;
    state = clip === 'attack-2' || clip === 'super' ? clip : 'attack';
    phaseTick = tick - lastAttack.tick;
  } else if (boss.motion) state = 'run';
  return { state, direction, phaseTick };
}

// Wraps main.mjs's Liquidator bindings so the one boss code path steps,
// damages, targets and poses whichever boss is live. A Liquidator call goes to
// the original function with the original arguments.
export function createWorldV2BossDispatch(api, gameplay, sightBlockers = []) {
  const sealArena = (bossId, arenaId) => {
    const court = gameplay.districtCourts[bossId];
    if (court?.id === arenaId) return court;
    const floor = gameplay.liquidatorFloor;
    return floor.id === arenaId ? { ...floor, pedestal: floor.centre } : null;
  };
  // The slot the last defeat settled, for the Seal drop that follows it.
  let defeated = null;
  const liveSlot = (slots) => Object.values(slots.slots).find((slot) => slot.status === 'live') ?? null;
  return Object.freeze({
    // main.mjs settles a defeat as { bossId: 'liquidator' } (the legacy map
    // has no other boss); in this world the defeated boss is the live slot's.
    defeatBossSlot: (slots, { tick }) => {
      const slot = liveSlot(slots);
      defeated = { bossId: slot.bossId, arena: slot.arena };
      return api.defeatBossSlot(slots, { bossId: slot.bossId, tick });
    },
    // A district boss also reads the world's collision list: he walks around
    // court props instead of through them (a boss parked inside a tall screen
    // could not be shot), retreats to marks the hero can see, and closes in
    // when screened.
    stepLiquidatorBoss: (options) => (kitOf(options.boss)
      ? kitOf(options.boss).step({ ...options, blockers: [...(options.blockers ?? []), ...sightBlockers], sightBlockers })
      : api.stepLiquidatorBoss(options)),
    applyLiquidatorDamage: (options) => (kitOf(options.boss) ? kitOf(options.boss).applyDamage(options) : api.applyLiquidatorDamage(options)),
    isLiquidatorTargetable: (boss, tick) => (kitOf(boss) ? kitOf(boss).isTargetable(boss, tick) : api.isLiquidatorTargetable(boss, tick)),
    getLiquidatorVulnerability: (boss, tick) => (kitOf(boss) ? kitOf(boss).vulnerability(boss, tick) : api.getLiquidatorVulnerability(boss, tick)),
    liquidatorPose: (options) => (kitOf(options.boss) ? districtBossPose(kitOf(options.boss), options) : api.liquidatorPose(options)),
    // Every boss of this world drops its Seal on its own court's pedestal
    // (the Liquidator's on his floor's centre); the legacy pedestal table is
    // the legacy map's.
    dropGenesisSeal: (drops, { bossId, tick, arenaId }) => {
      const settled = defeated;
      defeated = null;
      const id = settled?.bossId ?? bossId;
      const arena = sealArena(id, settled?.arena?.id ?? arenaId);
      return arena ? dropCourtGenesisSeal(drops, { bossId: id, tick, arena }) : api.dropGenesisSeal(drops, { bossId: id, tick, arenaId });
    },
  });
}

function bossName(gameplay, bossId) {
  return gameplay.bossDefinitions[bossId]?.name ?? bossId;
}

// --- Traversal markers from the greybox -------------------------------------

const MARKER_ZONE_DEPTH = 40;
const MARKER_ZONE_GAP = 6;
const MARKER_TRAVEL = 96;
const MARKER_EDGE_SEARCH = 120;

function markerSide(queryGround, centre, direction, topZ) {
  for (let distance = 4; distance <= MARKER_EDGE_SEARCH; distance += 4) {
    const ground = queryGround(centre.x + direction.x * distance, centre.y + direction.y * distance);
    if (!ground.walkable || ground.kind === 'deep-water') return null;
    if (Math.abs(ground.groundZ - topZ) < 0.5) continue;
    // The low side must be flat for the whole landing run.
    const lowZ = queryGround(centre.x + direction.x * (distance + 8), centre.y + direction.y * (distance + 8)).groundZ;
    for (let probe = distance + 8; probe <= distance + MARKER_TRAVEL; probe += 8) {
      const sample = queryGround(centre.x + direction.x * probe, centre.y + direction.y * probe);
      if (!sample.walkable || sample.kind === 'deep-water' || Math.abs(sample.groundZ - lowZ) > 0.5) return null;
    }
    return { edge: distance, lowZ };
  }
  return null;
}

// The greybox climb/drop markers carry a zone on a deck edge but no direction
// or heights yet (HMH-COVER-TRAVERSAL-V1 §5). Each marker is completed from
// the ground itself: the short axis of its zone crosses the edge, the side
// that falls away is the low side, and the trigger strip and travel are laid
// so every landing is clear walkable ground at the far height. A marker whose
// ground does not support that (a ramp, water, a rise outside the rules) is
// reported and left out.
export function deriveWorldV2TraversalMarkers(world, queryGround, rules = TRAVERSAL_RULES_V1) {
  const pieces = (world.artPlans?.authored?.pieces ?? [])
    .filter((piece) => piece.kind === 'climb-marker' || piece.kind === 'drop-marker')
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const markers = [];
  const rejected = [];
  for (const piece of pieces) {
    const b = piece.visible.bounds;
    const centre = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    const acrossX = b.maxX - b.minX < b.maxY - b.minY;
    const halfLateral = (acrossX ? b.maxY - b.minY : b.maxX - b.minX) / 2;
    const topZ = queryGround(centre.x, centre.y).groundZ;
    const sides = [-1, 1].map((sign) => {
      const out = acrossX ? { x: sign, y: 0 } : { x: 0, y: sign };
      return { out, side: markerSide(queryGround, centre, out, topZ) };
    }).filter((entry) => entry.side && topZ - entry.side.lowZ >= rules.climbMinRise);
    if (sides.length !== 1) {
      rejected.push({ id: piece.id, reason: sides.length ? 'two-low-sides' : 'no-low-side' });
      continue;
    }
    const [{ out, side }] = sides;
    const climb = piece.kind === 'climb-marker';
    // Distances along `out` from the zone centre: the climb strip waits on the
    // low ground past the edge, the drop strip on the deck before it.
    const near = climb ? side.edge + MARKER_ZONE_GAP : side.edge - MARKER_ZONE_GAP - MARKER_ZONE_DEPTH;
    const far = near + MARKER_ZONE_DEPTH;
    const direction = climb ? { x: -out.x, y: -out.y } : { ...out };
    const along = (distance, lateral) => (acrossX
      ? { x: centre.x + out.x * distance, y: centre.y + lateral }
      : { x: centre.x + lateral, y: centre.y + out.y * distance });
    const a = along(near, -halfLateral);
    const c = along(far, halfLateral);
    const zone = { minX: Math.min(a.x, c.x), minY: Math.min(a.y, c.y), maxX: Math.max(a.x, c.x), maxY: Math.max(a.y, c.y) };
    const fromZ = climb ? side.lowZ : topZ;
    const toZ = climb ? topZ : side.lowZ;
    let marker;
    try {
      marker = createTraversalMarker({ id: piece.id, kind: climb ? 'climb' : 'drop', zone, direction, fromZ, toZ, travel: MARKER_TRAVEL, areaId: piece.visible.areaId ?? null, rules });
    } catch (error) {
      rejected.push({ id: piece.id, reason: String(error.message) });
      continue;
    }
    // Every landing from the zone's corners and mid-lines is clear ground at toZ.
    let landingOk = true;
    for (const distance of [near, (near + far) / 2, far]) {
      for (const lateral of [-halfLateral, 0, halfLateral]) {
        const from = along(distance, lateral);
        const landing = { x: from.x + direction.x * MARKER_TRAVEL, y: from.y + direction.y * MARKER_TRAVEL };
        const ground = queryGround(landing.x, landing.y);
        if (Math.abs(ground.groundZ - toZ) > 0.5 || !isWorldV2PointClear(world, queryGround, landing)) landingOk = false;
      }
    }
    if (!landingOk) {
      rejected.push({ id: piece.id, reason: 'landing-not-clear' });
      continue;
    }
    markers.push(marker);
  }
  return freezeDeep({ markers, rejected });
}

// --- Cover + traversal run state -------------------------------------------

const MELEE_GEOMETRY = new Set(['melee-circle', 'shove-lane']);
const ONE_SHOT_CLIP_TICKS = Object.freeze({ enter: 12, leave: 14, drop: 10, land: 6 });

function rightOf(facing) {
  return { x: -facing.y, y: facing.x };
}

// Pose -> named hero clip (HMH-COVER-TRAVERSAL-V1 §4, HMH-HERO-CLIP-LIBRARY).
export function heroClipForPose({ coverPose, coverKind, peekMode, shuffleSide, traversalPose }) {
  if (traversalPose === 'mantle' || traversalPose === 'drop' || traversalPose === 'land') return traversalPose;
  const tall = coverKind === 'tall';
  switch (coverPose) {
    case 'cover-enter': return tall ? 'cover-enter-tall' : 'cover-enter-short';
    case 'cover-idle-l': return tall ? 'cover-idle-tall-l' : 'cover-idle-short';
    case 'cover-idle-r': return tall ? 'cover-idle-tall-r' : 'cover-idle-short';
    case 'cover-shuffle': return `cover-shuffle-${shuffleSide === 'l' ? 'l' : 'r'}`;
    case 'cover-peek-fire': return peekMode === 'pop' ? 'cover-popup-fire' : peekMode === 'lean-l' ? 'cover-peek-fire-l' : 'cover-peek-fire-r';
    case 'cover-blind-fire': case 'cover-reload': case 'cover-hit':
    case 'cover-leave-step': case 'cover-leave-run': case 'cover-leave-roll':
      return coverPose;
    default: return null;
  }
}

const oneShotTicks = (clip) => (clip?.startsWith('cover-enter') ? ONE_SHOT_CLIP_TICKS.enter
  : clip?.startsWith('cover-leave') ? ONE_SHOT_CLIP_TICKS.leave : clip === 'drop' ? ONE_SHOT_CLIP_TICKS.drop : 0);

// The run summary's movement rules version (schema 8, HMH-COVER-TRAVERSAL-V1 §6).
export const WORLD_V2_MOVEMENT_RULES_VERSION = `${COVER_RULES_V1.rulesVersion}+${TRAVERSAL_RULES_V1.rulesVersion}`;

export function createWorldV2MovementRun({ faces, markers }) {
  const cover = createCoverState();
  const traversal = createTraversalState();
  let shuffleSide = 'r';
  // Run-summary counters the cover and traversal states do not keep
  // themselves. Recorded only; nothing in the simulation reads them.
  const tally = { leaves: 0, coverKills: 0, coverDamageReduced: 0 };
  // Presentation memo only: which named clip is showing and since when.
  const shown = { clip: null, startTick: 0, holdUntil: -1 };
  const run = {
    cover,
    traversal,
    faces,
    markers,
    // A mantle or landing locks the hero, dodges included.
    locked: () => traversal.phase !== 'free',
    // Rolling out of cover with a neutral stick goes along the cover facing.
    dodgeLastMove: (lastMove) => (cover.phase === 'cover' ? { ...cover.facing } : lastMove),
    // Steps B and C of the slice plan: traversal first (never skipped), then
    // cover unless a mantle or landing holds the hero. Both read the
    // pre-movement hero and this tick's input.
    step({ tick, player, move, fire = false, aimHeld = false, dodge = false, reload = false, hit = false }) {
      const traversalStep = stepTraversal(traversal, { player, input: { move }, markers, tick });
      const alongBefore = cover.along;
      const coverStep = traversalStep.movementLocked ? null
        : stepCover(cover, { player, input: { move, fire, aimHeld, dodge, reload, hit }, faces, tick });
      if (coverStep?.event?.startsWith('leave')) tally.leaves += 1;
      if (coverStep?.pose === 'cover-shuffle' && cover.along !== alongBefore) {
        const right = rightOf(cover.facing);
        const sign = cover.along > alongBefore ? 1 : -1;
        shuffleSide = (cover.tangent.x * sign * right.x + cover.tangent.y * sign * right.y) > 0 ? 'r' : 'l';
      }
      const position = traversalStep.movementLocked ? traversalStep.position : coverStep?.inCover ? coverStep.position : null;
      return freezeDeep({
        traversal: traversalStep,
        cover: coverStep,
        position,
        // The ground under the hero is trusted again once a transition has
        // put it on authored ground (mid-mantle it is off the walkable grid).
        reground: traversalStep.event === 'drop' || traversalStep.event === 'mantle-complete' || traversalStep.event === 'land-complete',
        inCover: Boolean(coverStep?.inCover),
        locomotion: traversalStep.phase !== 'free' || traversalStep.movementLocked ? (traversalStep.phase === 'free' ? 'landing' : traversalStep.phase)
          : coverStep?.inCover ? 'cover' : null,
      });
    },
    // Step E: an authored one-way ledge drop gets the same land recovery.
    landRecovery(tick, position) {
      return beginLandRecovery(traversal, { tick, position });
    },
    // Step G: melee is refused during a mantle; lanes and blasts still land.
    meleeInvulnerable(event) {
      return traversalInvulnerability(traversal).melee && MELEE_GEOMETRY.has(event?.geometry?.type);
    },
    // Steps I and J: damage reaching a hero in cover from the covered side.
    coverDamage(origin, damage) {
      const applied = applyCoverToDamage(cover, origin, damage);
      tally.coverDamageReduced += damage - applied;
      return applied;
    },
    // A kill recorded while the hero holds cover (schema 8 coverKills).
    creditKill() {
      if (cover.phase === 'cover') tally.coverKills += 1;
    },
    // The schema-8 movement row (HMH-COVER-TRAVERSAL-V1 §6).
    movementRow() {
      return freezeDeep({
        rulesVersion: WORLD_V2_MOVEMENT_RULES_VERSION,
        coverTicks: cover.coverTicks,
        coverEnters: cover.enters,
        coverLeaves: tally.leaves,
        coverKills: tally.coverKills,
        coverDamageReduced: Math.round(tally.coverDamageReduced),
        mantles: traversal.mantles,
        drops: traversal.drops,
        mantleTicks: traversal.mantleTicks,
        landTicks: traversal.landTicks,
      });
    },
    // Presentation: the named library clip for this frame, or null.
    heroClip(tick) {
      const wanted = heroClipForPose({ coverPose: cover.pose, coverKind: cover.kind, peekMode: cover.peekMode, shuffleSide, traversalPose: traversal.pose });
      const holding = shown.clip && tick < shown.holdUntil && tick >= shown.startTick;
      const idleish = !wanted || wanted.startsWith('cover-idle');
      if (!(holding && idleish) && wanted !== shown.clip) {
        shown.clip = wanted;
        shown.startTick = tick;
        shown.holdUntil = wanted ? tick + oneShotTicks(wanted) : -1;
      }
      if (!shown.clip) return null;
      return { clip: shown.clip, clipTick: Math.max(0, tick - shown.startTick) };
    },
    // Presentation: a small pulsing ground ring per prompt, drawn into the
    // caller's per-frame graphics.
    drawPrompts(graphics, { hero, radius, project, zoom, tick, dataset = null }) {
      const rings = run.prompts(hero, radius);
      // Read-only telemetry for browser evidence.
      if (dataset) Object.assign(dataset, { tenAreaCover: cover.pose, tenAreaTraversal: traversal.pose, tenAreaPrompts: rings.map((ring) => ring.kind).join(','), tenAreaHero: `${Math.round(hero.x)},${Math.round(hero.y)}` });
      for (const ring of rings) {
        const at = project(ring);
        const pulse = 0.55 + 0.45 * Math.sin(((tick % 60) / 60) * Math.PI * 2);
        const r = 15 * zoom;
        graphics.ellipse(at.x, at.y, r, r * 0.5).stroke({ color: 0x080d12, width: 4, alpha: 0.5 })
          .ellipse(at.x, at.y, r, r * 0.5).stroke({ color: ring.kind.startsWith('cover') ? 0x7fe7ff : 0xffd166, width: 2, alpha: 0.45 + pulse * 0.4 });
      }
    },
    // Presentation: rings for the cover face and the ledge the hero could
    // take from here (nothing while in cover or mid-transition).
    prompts(hero, radius = 24) {
      if (cover.phase === 'cover' || traversal.phase !== 'free') return [];
      const rings = [];
      let best = null;
      for (const face of faces) {
        if (face.baseZ !== null && Math.abs(hero.groundZ - face.baseZ) > 8) continue;
        const rx = hero.x - face.a.x;
        const ry = hero.y - face.a.y;
        const outward = rx * face.normal.x + ry * face.normal.y;
        const gap = outward - radius;
        if (outward < 0 || gap > 72) continue;
        const along = rx * face.tangent.x + ry * face.tangent.y;
        // The same span stepCover accepts (entry clamps the hero inside the face).
        if (along < 0 || along > face.length) continue;
        if (!best || gap < best.gap) best = { gap, face, along };
      }
      if (best) {
        const { face, along } = best;
        const at = Math.min(Math.max(along, Math.ceil(radius)), face.length - Math.ceil(radius));
        rings.push({ kind: face.kind === 'tall' ? 'cover-tall' : 'cover-short',
          x: face.a.x + face.tangent.x * at + face.normal.x * (radius + 1), y: face.a.y + face.tangent.y * at + face.normal.y * (radius + 1), z: hero.groundZ });
      }
      for (const marker of markers) {
        const z = marker.zone;
        if (hero.x < z.minX - 64 || hero.x > z.maxX + 64 || hero.y < z.minY - 64 || hero.y > z.maxY + 64 || Math.abs(hero.groundZ - marker.fromZ) > 8) continue;
        rings.push({ kind: marker.kind, x: (z.minX + z.maxX) / 2, y: (z.minY + z.maxY) / 2, z: marker.fromZ, direction: marker.direction });
        break;
      }
      return rings;
    },
  };
  return run;
}

// --- Evidence spawns (evidenceSafe only, never in a real run) ---------------

// `?evidenceSafe=1&tenAreaEvidence=court:<bossId>` stands the hero 200 west of
// a court's threshold with the boss ready at tick 120;
// `tenAreaEvidence=cover` stands it 60 out from the tall cover face nearest
// the spawn; `tenAreaEvidence=ledge` in the nearest derived climb strip. Smoke tooling, like main.mjs's ?boss=1.
export function worldV2EvidenceReady({ value, gameplay, bossSlots }) {
  const bossId = typeof value === 'string' && value.startsWith('court:') ? value.slice(6) : null;
  if (!bossId || !gameplay.districtCourts[bossId] || !bossSlots?.slots[bossId]) return false;
  bossSlots.slots[bossId].readyAt = 120;
  return true;
}

export function worldV2EvidenceSpawn({ value, gameplay, faces, markers = [], spawn, isClear = () => true }) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('court:')) {
    const bossId = value.slice(6);
    const court = gameplay.districtCourts[bossId];
    if (!court) return null;
    // The first clear spot 200 off the threshold (west, east, north, south)
    // inside the court; the smoke walks back along `walk` into the disk.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const spot = { x: court.threshold.x + dx * 200, y: court.threshold.y + dy * 200 };
      if (spot.x <= court.bounds.minX || spot.x >= court.bounds.maxX || spot.y <= court.bounds.minY || spot.y >= court.bounds.maxY) continue;
      if (isClear(spot)) return { id: `evidence-${bossId}`, ...spot, walk: { x: -dx, y: -dy } };
    }
    return null;
  }
  if (value === 'ledge') {
    // The derived climb marker nearest the spawn: stand in its strip.
    let best = null;
    for (const marker of markers) {
      if (marker.kind !== 'climb') continue;
      const centre = { x: (marker.zone.minX + marker.zone.maxX) / 2, y: (marker.zone.minY + marker.zone.maxY) / 2 };
      const distance = Math.hypot(centre.x - spawn.x, centre.y - spawn.y);
      if (!best || distance < best.distance) best = { marker, centre, distance };
    }
    return best ? { id: `evidence-ledge-${best.marker.id}`, ...best.centre, walk: { ...best.marker.direction }, markerId: best.marker.id } : null;
  }
  if (value === 'cover') {
    let best = null;
    for (const face of faces) {
      if (face.kind !== 'tall' || Math.abs(face.normal.x) + Math.abs(face.normal.y) !== 1) continue;
      const mid = { x: face.a.x + face.tangent.x * face.length / 2, y: face.a.y + face.tangent.y * face.length / 2 };
      const distance = Math.hypot(mid.x - spawn.x, mid.y - spawn.y);
      if (!best || distance < best.distance) best = { face, mid, distance };
    }
    if (!best) return null;
    const { face, mid } = best;
    return { id: `evidence-cover-${face.id}`, x: mid.x + face.normal.x * 60, y: mid.y + face.normal.y * 60, walk: { x: -face.normal.x, y: -face.normal.y }, faceId: face.id };
  }
  return null;
}

// --- The handle the runtime context hands main.mjs --------------------------

export function createWorldV2Combat({ world, gameplay, queryGround }) {
  // The six 2.0 archetypes join the enemy simulation's lookup for this page
  // only (the legacy table and its ids are untouched).
  registerEnemyArchetypes(WORLD_V2_NEW_ENEMY_RUNTIME);
  const faces = coverFaceIndex(world.collisionBlockers);
  const traversalMarkers = deriveWorldV2TraversalMarkers(world, queryGround);
  let currentRun = null;
  return Object.freeze({
    archetypes: WORLD_V2_ENEMY_ARCHETYPES,
    districtArchetypes: WORLD_V2_DISTRICT_ARCHETYPES,
    coverFaces: faces,
    traversalMarkers: traversalMarkers.markers,
    rejectedTraversalMarkers: traversalMarkers.rejected,
    spriteFallback: worldV2SpriteFallback,
    bossDispatch: (api) => createWorldV2BossDispatch(api, gameplay, world.collisionBlockers),
    activeBoss: activeWorldV2Boss,
    closedBossWalls: closedWorldV2BossWalls,
    createRun: () => (currentRun = createWorldV2MovementRun({ faces, markers: traversalMarkers.markers })),
    // The run createRun made last (the session's), for its summary row.
    currentRun: () => currentRun,
    evidenceSpawn: (value, spawn) => worldV2EvidenceSpawn({ value, gameplay, faces, markers: traversalMarkers.markers, spawn, isClear: (point) => isWorldV2PointClear(world, queryGround, point) }),
    evidenceReady: (value, bossSlots) => worldV2EvidenceReady({ value, gameplay, bossSlots }),
    // Accessible status lines for a district boss; null keeps the
    // Liquidator's own wording.
    bossText(event) {
      if (!event || !Object.hasOwn(DISTRICT_BOSS_KITS, event.bossId)) return null;
      const name = bossName(gameplay, event.bossId);
      if (event.type === 'boss-initiated') return `${name} takes the court. The exits lock behind you.`;
      if (event.type === 'boss-withdrawn') return event.reason === 'retreat' ? `You slip out. ${name} withdraws to recover.` : `You left the court. ${name} withdraws.`;
      if (event.type === 'boss-defeated') return `${name} is defeated. The court opens and a Genesis Seal drops.`;
      return null;
    },
    // Presentation: tint and scale the shared Liquidator sprite per boss.
    styleBoss(display, boss) {
      const look = boss && Object.hasOwn(DISTRICT_BOSS_LOOK, boss.bossId) ? DISTRICT_BOSS_LOOK[boss.bossId] : null;
      display.tint = look ? look.tint : 0xffffff;
      if (look) display.scale.set(display.scale.x * look.scale);
    },
    // Presentation: the 3D row for a live district boss (its own GLB through
    // the controller's district-boss list), or null for the Liquidator, who
    // keeps his own entry. A boss whose GLB is not resident keeps its sprite.
    districtBoss3d(boss, frame) {
      const look = boss && Object.hasOwn(DISTRICT_BOSS_LOOK, boss.bossId) ? DISTRICT_BOSS_LOOK[boss.bossId] : null;
      if (!look) return null;
      const pose = districtBoss3dPose(DISTRICT_BOSS_KITS[boss.bossId], { boss, ...frame });
      return [{ actorId: look.actorId, active: boss.active || frame.tick < frame.deathUntil, visible: frame.visible, alpha: boss.active ? frame.alpha : 1,
        x: frame.x, y: frame.y, z: boss.groundZ, bodyHeight: frame.bodyHeight * look.scale, pose, originals: frame.originals }];
    },
  });
}
