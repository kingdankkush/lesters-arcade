import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  GRENADE_BLAST_REFERENCE_RADIUS,
  GRENADE_FEEDBACK_ART_ID,
  GRENADE_FEEDBACK_CLASSES,
  GRENADE_FX_LIFETIME_TICKS,
  MAX_GRENADE_FX_EVENTS,
  MAX_GRENADE_FX_PARTICLES,
  BOUNCE_PUFF_LIFETIME_TICKS,
  buildBouncePuff,
  buildFragmentBurst,
  buildShockwaveRing,
  capGrenadeFxParticles,
  grenadeBlastShake,
  grenadeFeedbackClass,
  grenadeFragmentCount,
  grenadeModeFromId,
  resolveGrenadeArcShadow,
  resolveGrenadeFuseBlink,
} from '../apps/hmh-reboot/src/grenade-feedback.mjs';

const moduleUrl = new URL('../apps/hmh-reboot/src/grenade-feedback.mjs', import.meta.url);
const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const grenadesUrl = new URL('../apps/hmh-reboot/src/grenades.mjs', import.meta.url);

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

// ---------------------------------------------------------------------------
// 1. Class table and per-class shake
// ---------------------------------------------------------------------------

test('the grenade feedback class table is frozen, two-class, and keeps the hand blast as the shake ceiling', () => {
  assert.equal(GRENADE_FEEDBACK_ART_ID, 'projection-grenade-feedback-v1');
  assert.ok(Object.isFrozen(GRENADE_FEEDBACK_CLASSES));
  assert.deepEqual(Object.keys(GRENADE_FEEDBACK_CLASSES).sort(), ['hand', 'launcher']);
  for (const [mode, entry] of Object.entries(GRENADE_FEEDBACK_CLASSES)) {
    assert.ok(Object.isFrozen(entry), `${mode} class must be frozen`);
    for (const key of ['shake', 'fragments', 'puffFootprint', 'shadowFootprint', 'ringWidth', 'coreFlashTicks']) {
      assert.ok(Number.isFinite(entry[key]) && entry[key] > 0, `${mode}.${key} must be a positive number`);
    }
  }
  // combat-feedback.mjs documents "Ceiling is the grenade blast at 10" and the
  // c2 test pins every weapon recoil <= 10; the hand class must stay at 10.
  assert.equal(GRENADE_FEEDBACK_CLASSES.hand.shake, 10);
  assert.ok(GRENADE_FEEDBACK_CLASSES.launcher.shake < GRENADE_FEEDBACK_CLASSES.hand.shake, 'a launcher shell is lighter on the camera than a frag');
  // Boss defeat shakes at 12 and must remain the loudest thing in the run.
  assert.ok(GRENADE_FEEDBACK_CLASSES.hand.shake <= 12);
  assert.ok(GRENADE_FEEDBACK_CLASSES.launcher.shake <= 12);
  assert.equal(GRENADE_BLAST_REFERENCE_RADIUS, 150);
});

test('grenadeFeedbackClass and grenadeModeFromId degrade to the hand class instead of throwing in the frame loop', () => {
  assert.equal(grenadeFeedbackClass('hand'), GRENADE_FEEDBACK_CLASSES.hand);
  assert.equal(grenadeFeedbackClass('launcher'), GRENADE_FEEDBACK_CLASSES.launcher);
  assert.equal(grenadeFeedbackClass('shaped-charge'), GRENADE_FEEDBACK_CLASSES.hand);
  assert.equal(grenadeFeedbackClass(undefined), GRENADE_FEEDBACK_CLASSES.hand);
  assert.equal(grenadeModeFromId('launcher-rig:00000003'), 'launcher');
  assert.equal(grenadeModeFromId('satoshi-frag:00000003'), 'hand');
  assert.equal(grenadeModeFromId(null), 'hand');
});

test('blast shake is per class and scales with the authoritative radius, capped at 1.2x', () => {
  assert.equal(grenadeBlastShake({ mode: 'hand', radius: 150 }), 10);
  assert.equal(grenadeBlastShake({ mode: 'launcher', radius: 150 }), GRENADE_FEEDBACK_CLASSES.launcher.shake);
  // The shaped-charge capstone (splash 210) is not plumbed into the sim today;
  // when it is, the render set must scale without a code change.
  assert.ok(Math.abs(grenadeBlastShake({ mode: 'hand', radius: 210 }) - 12) < 1e-9);
  assert.ok(Math.abs(grenadeBlastShake({ mode: 'hand', radius: 400 }) - 12) < 1e-9, 'radius scaling is capped at 1.2x');
  assert.equal(grenadeBlastShake({ mode: 'hand', radius: 90 }), 10, 'a smaller radius never drops below the class base');
  assert.equal(grenadeBlastShake({ mode: 'unknown', radius: 150 }), 10, 'unknown mode falls back to hand');
  assert.equal(grenadeBlastShake({ mode: 'hand', radius: Number.NaN }), 10, 'a corrupt radius falls back to the class base');
  assert.equal(grenadeBlastShake({}), 10);
});

// ---------------------------------------------------------------------------
// 2. Fuse blink
// ---------------------------------------------------------------------------

test('fuse blink accelerates toward detonation and never hides the danger under reduced flash', () => {
  const spawnTick = 100;
  const detonateTick = 139;
  const periods = [];
  let previousPeriod = Number.POSITIVE_INFINITY;
  let sawOff = false;
  for (let tick = spawnTick; tick <= detonateTick; tick += 1) {
    const blink = resolveGrenadeFuseBlink({ tick, spawnTick, detonateTick, reduceFlash: false });
    const repeated = resolveGrenadeFuseBlink({ tick, spawnTick, detonateTick, reduceFlash: false });
    assert.deepEqual(blink, repeated, 'blink is fixed-tick deterministic');
    assert.ok(Object.isFrozen(blink));
    assert.equal(blink.remainingTicks, detonateTick - tick);
    assert.ok(blink.periodTicks <= previousPeriod, 'period never lengthens as the fuse burns');
    assert.ok(blink.intensity >= 0.35 - 1e-9 && blink.intensity <= 0.95 + 1e-9);
    previousPeriod = blink.periodTicks;
    periods.push(blink.periodTicks);
    if (!blink.on) sawOff = true;
    const reduced = resolveGrenadeFuseBlink({ tick, spawnTick, detonateTick, reduceFlash: true });
    assert.equal(reduced.on, true, 'reduced flash must never strobe the fuse off');
    assert.ok(reduced.intensity > 0);
    assert.equal(reduced.periodTicks, blink.periodTicks, 'accessibility settings change only the on/off strobe');
    assert.equal(reduced.remainingTicks, blink.remainingTicks);
  }
  assert.ok(sawOff, 'the normal fuse must actually blink off at some point');
  assert.equal(resolveGrenadeFuseBlink({ tick: spawnTick, spawnTick, detonateTick }).periodTicks, 12);
  assert.equal(resolveGrenadeFuseBlink({ tick: detonateTick - 24, spawnTick, detonateTick }).periodTicks, 6);
  assert.equal(resolveGrenadeFuseBlink({ tick: detonateTick - 12, spawnTick, detonateTick }).periodTicks, 3);
  assert.deepEqual([...new Set(periods)], [12, 6, 3], 'the blink doubles twice');
  const early = resolveGrenadeFuseBlink({ tick: spawnTick, spawnTick, detonateTick });
  const late = resolveGrenadeFuseBlink({ tick: detonateTick, spawnTick, detonateTick });
  assert.ok(late.intensity > early.intensity, 'intensity ramps toward detonation');
  assert.ok(Math.abs(early.intensity - 0.35) < 1e-9);
  assert.ok(Math.abs(late.intensity - 0.95) < 1e-9);
});

test('fuse blink fails closed on corrupt renderer inputs', () => {
  assert.throws(() => resolveGrenadeFuseBlink({ tick: -1, spawnTick: 0, detonateTick: 39 }), /tick/iu);
  assert.throws(() => resolveGrenadeFuseBlink({ tick: 5, spawnTick: 10, detonateTick: 10 }), /detonateTick/iu);
  assert.throws(() => resolveGrenadeFuseBlink({ tick: 5, spawnTick: Number.NaN, detonateTick: 39 }), /spawnTick/iu);
});

// ---------------------------------------------------------------------------
// 3. Arc shadow, bounce puff, fragment burst, cap
// ---------------------------------------------------------------------------

test('the arc shadow shrinks and fades with height and never inverts', () => {
  const grounded = resolveGrenadeArcShadow({ mode: 'hand', lift: 0, zoom: 1 });
  const apex = resolveGrenadeArcShadow({ mode: 'hand', lift: 40, zoom: 1 });
  assert.ok(Object.isFrozen(grounded));
  // The shadow footprint is wider than the 4-unit body: at 1440x900 a 9 px
  // footprint (19 px blob) barely exceeded the 16 px ball and vanished in the
  // road texture even at a 40% luminance dip.
  assert.equal(grounded.footprintPx, GRENADE_FEEDBACK_CLASSES.hand.shadowFootprint);
  assert.ok(GRENADE_FEEDBACK_CLASSES.hand.shadowFootprint >= 12);
  assert.ok(GRENADE_FEEDBACK_CLASSES.launcher.shadowFootprint < GRENADE_FEEDBACK_CLASSES.hand.shadowFootprint);
  assert.equal(resolveGrenadeArcShadow({ mode: 'launcher', lift: 0, zoom: 2 }).footprintPx, GRENADE_FEEDBACK_CLASSES.launcher.shadowFootprint * 2);
  assert.ok(apex.alpha < grounded.alpha, 'a lifted grenade casts a fainter shadow');
  assert.ok(apex.alpha > 0, 'the ground cue never disappears');
  assert.ok(apex.lift > 0 && apex.lift <= 40, 'lift passed to the pool is scaled, never amplified');
  assert.equal(grounded.lift, 0);
  let previous = grounded.alpha;
  for (let lift = 4; lift <= 60; lift += 4) {
    const next = resolveGrenadeArcShadow({ mode: 'hand', lift, zoom: 1 });
    assert.ok(next.alpha <= previous, 'alpha is monotonic in lift');
    previous = next.alpha;
  }
  assert.deepEqual(resolveGrenadeArcShadow({ mode: 'hand', lift: 12, zoom: 1.5 }), resolveGrenadeArcShadow({ mode: 'hand', lift: 12, zoom: 1.5 }));
  assert.throws(() => resolveGrenadeArcShadow({ mode: 'hand', lift: Number.NaN, zoom: 1 }), /lift/iu);
  // Evidence at 1440x900: with the raw pool fade the apex shadow sat at the
  // pool's 0.06 floor under the danger-ring tint and vanished, so the arc had
  // no ground cue. The lift handed to the pool is capped so the resolved
  // alpha stays readable, and the body grows slightly as it rises so the ball
  // visibly leaves its shadow.
  const highest = resolveGrenadeArcShadow({ mode: 'hand', lift: 80, zoom: 1 });
  assert.ok(highest.alpha >= 0.18, `apex shadow must stay readable, got ${highest.alpha}`);
  assert.ok(highest.lift <= highest.footprintPx * 2.5 * 0.6, 'the pool lift is capped below its saturation reach');
  assert.equal(grounded.bodyScale, 1);
  assert.ok(apex.bodyScale > 1 && apex.bodyScale <= 1.4);
  assert.ok(resolveGrenadeArcShadow({ mode: 'hand', lift: 400, zoom: 1 }).bodyScale <= 1.4, 'body growth is capped');
});

test('bounce puffs expand and fade over a bounded life, with blocker puffs narrower and taller', () => {
  assert.equal(BOUNCE_PUFF_LIFETIME_TICKS, 10);
  const groundYoung = buildBouncePuff({ seed: 'g:1', kind: 'ground', age: 0, zoom: 1 });
  const groundOld = buildBouncePuff({ seed: 'g:1', kind: 'ground', age: 8, zoom: 1 });
  const blockerYoung = buildBouncePuff({ seed: 'g:1', kind: 'blocker', age: 0, zoom: 1 });
  assert.ok(Object.isFrozen(groundYoung));
  assert.deepEqual(groundYoung, buildBouncePuff({ seed: 'g:1', kind: 'ground', age: 0, zoom: 1 }));
  assert.ok(groundOld.spreadX > groundYoung.spreadX, 'dust spreads outward');
  assert.ok(groundOld.alpha < groundYoung.alpha, 'dust fades');
  assert.ok(groundYoung.spreadX > groundYoung.spreadY, 'a ground puff lies flat on the plane');
  assert.ok(blockerYoung.spreadX < groundYoung.spreadX, 'a wall puff is narrower');
  assert.ok(blockerYoung.spreadY > groundYoung.spreadY, 'a wall puff climbs');
  assert.equal(buildBouncePuff({ seed: 'g:1', kind: 'ground', age: BOUNCE_PUFF_LIFETIME_TICKS, zoom: 1 }).alpha, 0, 'expired puffs draw nothing');
  assert.equal(buildBouncePuff({ seed: 'g:1', kind: 'ground', age: 30, zoom: 1 }).alpha, 0);
  assert.ok(buildBouncePuff({ seed: 'g:1', kind: 'ground', age: 2, zoom: 2 }).spreadX > buildBouncePuff({ seed: 'g:1', kind: 'ground', age: 2, zoom: 1 }).spreadX, 'puffs scale with the camera');
  assert.notDeepEqual(buildBouncePuff({ seed: 'a', kind: 'ground', age: 2, zoom: 1 }), buildBouncePuff({ seed: 'b', kind: 'ground', age: 2, zoom: 1 }), 'the seed varies the puff');
  for (const puff of [groundYoung, groundOld, blockerYoung]) {
    for (const [key, value] of Object.entries(puff)) {
      if (key === 'lobes') continue;
      assert.ok(Number.isFinite(value) || typeof value === 'string', `${key}: no NaN reaches the graphics layer`);
    }
  }
  // Evidence at 1440x900: a single 11 px ellipse at age 1 read as a smudge,
  // not dust. The puff opens wider and carries seeded lobes so it reads as a
  // kicked-up cloud while still retiring inside ten ticks.
  assert.ok(groundYoung.spreadX >= 9 * 1, 'the puff is readable from its first frame');
  assert.ok(groundOld.spreadX >= 24, 'the puff opens wide enough to read as dust');
  assert.ok(groundYoung.alpha >= 0.3);
  assert.equal(groundYoung.lobes.length, 3);
  assert.ok(Object.isFrozen(groundYoung.lobes));
  for (const lobe of groundYoung.lobes) {
    for (const key of ['dx', 'dy', 'radius']) assert.ok(Number.isFinite(lobe[key]), `lobe.${key} must be finite`);
    assert.ok(lobe.radius > 0);
  }
  assert.ok(groundOld.lobes[0].radius > groundYoung.lobes[0].radius, 'lobes swell with age');
});

test('fragment counts follow the performance tier exactly like impact sparks', () => {
  assert.equal(grenadeFragmentCount({ mode: 'hand', particleScale: 10 }), 14);
  assert.equal(grenadeFragmentCount({ mode: 'launcher', particleScale: 10 }), 10);
  assert.equal(grenadeFragmentCount({ mode: 'hand', particleScale: 6 }), 8);
  assert.equal(grenadeFragmentCount({ mode: 'launcher', particleScale: 6 }), 6);
  assert.equal(grenadeFragmentCount({ mode: 'hand', particleScale: 0 }), 0);
  assert.equal(grenadeFragmentCount({ mode: 'launcher', particleScale: 0 }), 0);
  assert.equal(grenadeFragmentCount({ mode: 'hand', particleScale: Number.NaN }), 0);
});

test('fragment bursts are seeded, tiered, class-sized and reach 85% of the blast radius at end of life', () => {
  const base = { seed: 'blast:1', mode: 'hand', radius: 150, zoom: 1, particleScale: 10 };
  const young = buildFragmentBurst({ ...base, age: 0 });
  const old = buildFragmentBurst({ ...base, age: GRENADE_FX_LIFETIME_TICKS });
  assert.equal(young.length, 14);
  assert.ok(Object.isFrozen(young));
  assert.deepEqual(young, buildFragmentBurst({ ...base, age: 0 }));
  assert.notDeepEqual(young, buildFragmentBurst({ ...base, seed: 'blast:2', age: 0 }));
  assert.equal(buildFragmentBurst({ ...base, mode: 'launcher', age: 0 }).length, 10);
  assert.equal(buildFragmentBurst({ ...base, particleScale: 6, age: 0 }).length, 8);
  assert.deepEqual(buildFragmentBurst({ ...base, particleScale: 0, age: 0 }), []);
  assert.equal(buildFragmentBurst({ ...base, maxCount: 5, age: 0 }).length, 5, 'the per-frame cap trims the fan');
  for (const fragment of young) {
    for (const key of ['inner', 'outer', 'angle', 'width', 'alpha']) assert.ok(Number.isFinite(fragment[key]), `${key} must be finite`);
    assert.ok(fragment.outer > fragment.inner);
    assert.ok(fragment.alpha > 0 && fragment.alpha <= 1);
  }
  const maxReach = Math.max(...old.map((fragment) => fragment.outer));
  assert.ok(Math.abs(maxReach - 0.85 * 150) < 1e-6, `fragments end on 0.85R, got ${maxReach}`);
  assert.ok(Math.max(...young.map((fragment) => fragment.outer)) < maxReach, 'fragments travel outward with age');
  assert.ok(old[0].alpha < young[0].alpha, 'fragments fade with age');
  const zoomed = buildFragmentBurst({ ...base, zoom: 2, age: GRENADE_FX_LIFETIME_TICKS });
  assert.ok(Math.abs(Math.max(...zoomed.map((fragment) => fragment.outer)) - 0.85 * 300) < 1e-6, 'reach scales with the camera');
  const wide = buildFragmentBurst({ ...base, radius: 210, age: GRENADE_FX_LIFETIME_TICKS });
  assert.ok(Math.abs(Math.max(...wide.map((fragment) => fragment.outer)) - 0.85 * 210) < 1e-6, 'a wider class scales automatically');
  const angles = young.map((fragment) => fragment.angle).sort((a, b) => a - b);
  for (let index = 1; index < angles.length; index += 1) assert.ok(angles[index] - angles[index - 1] > 0.05, 'fragments do not stack on one angle');
});

test('the per-frame particle cap trims the oldest bursts first so sixteen simultaneous blasts cannot exceed it', () => {
  assert.equal(MAX_GRENADE_FX_PARTICLES, 64);
  assert.equal(MAX_GRENADE_FX_EVENTS, 32);
  assert.equal(GRENADE_FX_LIFETIME_TICKS, 12);
  const bursts = Array.from({ length: 16 }, (_, index) => ({ tick: 100 + index, count: 14 }));
  const allowance = capGrenadeFxParticles(bursts, MAX_GRENADE_FX_PARTICLES);
  assert.equal(allowance.length, 16);
  assert.ok(Object.isFrozen(allowance));
  const total = allowance.reduce((sum, count) => sum + count, 0);
  assert.equal(total, 64);
  assert.equal(allowance[15], 14, 'the newest burst keeps its full fan');
  assert.equal(allowance[14], 14);
  assert.equal(allowance[13], 14);
  assert.equal(allowance[12], 14);
  assert.equal(allowance[11], 8, 'the fifth-newest takes the remainder');
  for (let index = 0; index < 11; index += 1) assert.equal(allowance[index], 0, 'older bursts are trimmed first');
  assert.deepEqual(capGrenadeFxParticles([{ tick: 5, count: 10 }, { tick: 3, count: 10 }], 64), [10, 10], 'under the cap nothing is trimmed');
  assert.deepEqual(capGrenadeFxParticles([], 64), []);
  // Same-tick bursts must resolve in a stable order so a replay draws the same frame.
  assert.deepEqual(capGrenadeFxParticles([{ tick: 7, count: 40 }, { tick: 7, count: 40 }], 64), [24, 40]);
  assert.deepEqual(capGrenadeFxParticles([{ tick: 7, count: 40 }, { tick: 7, count: 40 }], 64), capGrenadeFxParticles([{ tick: 7, count: 40 }, { tick: 7, count: 40 }], 64));
});

// ---------------------------------------------------------------------------
// 4. Shockwave ring
// ---------------------------------------------------------------------------

test('the shockwave ring starts inside the blast and ends exactly on the authoritative danger boundary', () => {
  const start = buildShockwaveRing({ radius: 150, age: 0, zoom: 1, mode: 'hand' });
  const end = buildShockwaveRing({ radius: 150, age: 12, zoom: 1, mode: 'hand' });
  assert.ok(Object.isFrozen(start));
  assert.ok(Math.abs(start.radius - 30) < 1e-9, 'starts at 0.2R');
  assert.ok(Math.abs(end.radius - 150) < 1e-9, 'ends exactly on R');
  assert.ok(Math.abs(buildShockwaveRing({ radius: 150, age: 12, zoom: 1.5, mode: 'hand' }).radius - 225) < 1e-9, 'scales with the camera');
  assert.ok(Math.abs(buildShockwaveRing({ radius: 210, age: 12, zoom: 1, mode: 'launcher' }).radius - 210) < 1e-9, 'a wider class scales automatically');
  let previous = start.radius;
  for (let age = 1; age <= 12; age += 1) {
    const ring = buildShockwaveRing({ radius: 150, age, zoom: 1, mode: 'hand' });
    assert.ok(ring.radius > previous, 'the ring only expands');
    previous = ring.radius;
  }
  assert.ok(buildShockwaveRing({ radius: 150, age: 3, zoom: 1, mode: 'hand' }).radius - start.radius
    > end.radius - buildShockwaveRing({ radius: 150, age: 9, zoom: 1, mode: 'hand' }).radius, 'eased: fast early, slow late');
  assert.ok(Math.abs(start.width - (GRENADE_FEEDBACK_CLASSES.hand.ringWidth + 1)) < 1e-9);
  assert.ok(Math.abs(end.width - 1) < 1e-9, 'the ring thins to a hairline');
  assert.ok(buildShockwaveRing({ radius: 150, age: 0, zoom: 1, mode: 'launcher' }).width < start.width, 'launcher ring is tighter');
  assert.ok(start.alpha > end.alpha && end.alpha >= 0);
  assert.ok(start.fillAlpha > end.fillAlpha && end.fillAlpha >= 0);
  assert.deepEqual(start, buildShockwaveRing({ radius: 150, age: 0, zoom: 1, mode: 'hand' }));
});

test('the core flash is bounded per class and removed, but only the flash, under reduced flash', () => {
  const hand = GRENADE_FEEDBACK_CLASSES.hand.coreFlashTicks;
  const launcher = GRENADE_FEEDBACK_CLASSES.launcher.coreFlashTicks;
  assert.equal(buildShockwaveRing({ radius: 150, age: hand - 1, zoom: 1, mode: 'hand' }).coreFlash, true);
  assert.equal(buildShockwaveRing({ radius: 150, age: hand, zoom: 1, mode: 'hand' }).coreFlash, false);
  assert.equal(buildShockwaveRing({ radius: 150, age: launcher - 1, zoom: 1, mode: 'launcher' }).coreFlash, true);
  assert.equal(buildShockwaveRing({ radius: 150, age: launcher, zoom: 1, mode: 'launcher' }).coreFlash, false);
  const normal = buildShockwaveRing({ radius: 150, age: 0, zoom: 1, mode: 'hand', reduceFlash: false });
  const reduced = buildShockwaveRing({ radius: 150, age: 0, zoom: 1, mode: 'hand', reduceFlash: true });
  assert.equal(normal.coreFlash, true);
  assert.equal(reduced.coreFlash, false);
  assert.equal(reduced.radius, normal.radius, 'geometry is untouched by accessibility settings');
  assert.equal(reduced.width, normal.width);
  assert.ok(reduced.alpha > 0, 'the ring stays visible');
  assert.ok(reduced.fillAlpha <= normal.fillAlpha, 'the fill never gets brighter under reduced flash');
  assert.ok(normal.coreRadius > 0 && Number.isFinite(normal.coreRadius));
});

test('shockwave and fragment builders fail closed on corrupt renderer inputs', () => {
  assert.throws(() => buildShockwaveRing({ radius: 0, age: 0, zoom: 1, mode: 'hand' }), /radius/iu);
  assert.throws(() => buildShockwaveRing({ radius: 150, age: -1, zoom: 1, mode: 'hand' }), /age/iu);
  assert.throws(() => buildShockwaveRing({ radius: 150, age: 0, zoom: Number.NaN, mode: 'hand' }), /zoom/iu);
  assert.throws(() => buildFragmentBurst({ seed: 's', mode: 'hand', radius: Number.NaN, age: 0, zoom: 1, particleScale: 10 }), /radius/iu);
  assert.throws(() => buildBouncePuff({ seed: 's', kind: 'ground', age: Number.NaN, zoom: 1 }), /age/iu);
});

// ---------------------------------------------------------------------------
// 5. Source pins: wiring and isolation
// ---------------------------------------------------------------------------

test('the grenade feedback module is projection-only and imports no simulation module', async () => {
  const source = stripComments(await readFile(moduleUrl, 'utf8'));
  assert.doesNotMatch(source, /from '\.\/(grenades|simulation|weapon-system|enemy-simulation|movement|collision|elevation|liquidator-boss|encounter-director)\.mjs'/u);
  assert.doesNotMatch(source, /from 'pixi\.js'/u);
  assert.doesNotMatch(source, /Math\.random/u);
  // Word-bounded: `spawnTick` and `detonateTick` are legitimate sim inputs.
  assert.doesNotMatch(source, /\b(collision|damage|health|spawn|wallet|settlement)\b/iu);
  const grenades = stripComments(await readFile(grenadesUrl, 'utf8'));
  assert.doesNotMatch(grenades, /grenade-feedback/u, 'the simulation must never depend on its own feedback art');
});

test('main.mjs wires bounce puffs, class shake, the blast mode and the new telemetry keys', async () => {
  const source = stripComments(await readFile(mainUrl, 'utf8'));
  assert.match(source, /from '\.\/grenade-feedback\.mjs'/u);
  assert.match(source, /grenadeFrame\.bounces/u, 'the simulation already emits bounces; the renderer must consume them');
  assert.match(source, /triggerCameraShake\(tick, grenadeBlastShake\(/u, 'blast shake is per class');
  assert.doesNotMatch(source, /triggerCameraShake\(tick, 10\)/u, 'the flat blast shake is gone');
  assert.match(source, /type: 'blast', tick, point: detonation\.point, radius: detonation\.radius, mode/u, 'the blast event carries its class');
  assert.match(source, /resolveGrenadeFuseBlink\(/u);
  assert.doesNotMatch(source, /\/ 39\)\)/u, 'the hardcoded fuse length is gone');
  assert.match(source, /buildShockwaveRing\(/u);
  assert.match(source, /buildFragmentBurst\(/u);
  assert.match(source, /buildBouncePuff\(/u);
  assert.match(source, /capGrenadeFxParticles\(/u);
  assert.match(source, /resolveGrenadeArcShadow\(/u);
  assert.match(source, /event\.type [!=]== 'grenade-bounce'/u, 'the bounce event must be rendered');
  assert.match(source, /dataset\.grenadeFxParticles/u);
  assert.match(source, /dataset\.grenadeFxEvents/u);
  assert.doesNotMatch(source, /Math\.random/u);
  // The bounce queue is separate from the 64-slot combat pool so
  // effectPoolPressure and impact feedback are unaffected.
  assert.match(source, /grenadeFxEvents = \[\]/u);
  assert.match(source, /MAX_GRENADE_FX_EVENTS/u);
  // Pinned telemetry the browser smokes read must stay byte-identical.
  assert.match(source, /dataset\.grenadeCount = String\(grenadeSystem\?\.active\.length \?\? 0\);/u);
  assert.match(source, /dataset\.activeGrenadeWarningRadius = String\(activeGrenadeWarningRadius\);/u);
  assert.match(source, /dataset\.lastGrenadeReason = lastGrenadeDetonation\?\.reason \?\? '';/u);
  assert.match(source, /dataset\.effectPoolPressure = `\$\{combatVisualEvents\.length\}\/\$\{MAX_COMBAT_VISUAL_EVENTS\}`;/u);
  assert.match(source, /dataset\.worldRenderedParticles = String\(worldArtReport\?\.renderedParticleCount \?\? 0\);/u, 'grenade fragments never count as world particles');
  // The reset path must clear the queue or a restarted run replays stale puffs.
  const resets = source.match(/grenadeFxEvents = \[\];/gu) ?? [];
  assert.ok(resets.length >= 2, `expected the queue to be declared and reset, found ${resets.length} assignments`);
  // Layer order stays as the contact-shadow test pinned it: no new layers.
  const order = /world\.addChild\(([^)]*)\)/u.exec(source);
  assert.ok(order);
  const names = order[1].split(',').map((entry) => entry.trim());
  assert.ok(names.indexOf('grenadeVisuals') < names.indexOf('actorVisual'));
  assert.ok(names.indexOf('combatVisuals') > names.indexOf('actorVisual'));
  assert.equal(names.filter((name) => /grenade/iu.test(name)).length, 1, 'no new grenade layer was added');
});
