// Gore setting (2.0 overhaul, owner decision): three levels, Off / Reduced /
// Full, default Full. The level lives in the presentation layer only: the
// gore pools, the weapon-vfx blood tints and the pause menu. The simulation,
// the combat event stream, the RNG streams, evidence and results never see it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_GORE_LEVEL,
  GORE_LEVELS,
  GORE_LIMITS,
  GORE_REDUCED_LIMITS,
  createGorePresentation,
  normalizeGoreLevel,
} from '../apps/hmh-reboot/src/gore-presentation.mjs';
import { corpsePresentation, createCorpseClock } from '../apps/hmh-reboot/src/corpse-presentation.mjs';
import { FLASH_SAFE, resolveImpactBurst, resolveKillBurst } from '../apps/hmh-reboot/src/weapon-vfx.mjs';
import { resolveEnemyHitReaction } from '../apps/hmh-reboot/src/enemy-hit-feedback.mjs';
import { validateChildMessage, validateParentMessage, createBridgeEnvelope } from '../sdk/hmh-bridge-protocol.mjs';
import {
  HMH_PLAYER_SETTINGS_DEFAULTS,
  mergeHmhRuntimeSettings,
  normalizeHmhPlayerSettings,
  projectHmhRuntimeSettings,
} from '../apps/portal/src/hmh-player-settings.mjs';

const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

// A Graphics stand-in recording draw ops, like tests/hmh-render-alloc.test.mjs.
class RecordingLayer {
  constructor() { this.ops = []; this.context = { instructions: [] }; }
  clear() { this.ops = []; this.context.instructions.length = 0; return this; }
}
for (const name of ['ellipse', 'circle', 'poly']) {
  RecordingLayer.prototype[name] = function draw(...args) { this.ops.push([name, ...args]); return this; };
}
for (const name of ['fill', 'stroke']) {
  RecordingLayer.prototype[name] = function paint(style) { this.ops.push([name, { ...style }]); this.context.instructions.push(name); return this; };
}
const identity = (point) => ({ x: point.x, y: point.y - point.z });
const renderAt = (fx, tick, settings = { gore: true, reduceMotion: false }) => {
  const ground = new RecordingLayer(); const air = new RecordingLayer();
  const drawn = fx.render({ ground, air, tick, settings, particleScale: 10, camera: { zoom: 1 }, view: { width: 4000, height: 4000 }, project: identity });
  return { ground: ground.ops, air: air.ops, drawn: { ...drawn } };
};

// The scripted combat visual stream: what main.mjs's pushCombatVisualEvent
// hands the gore pools. Frozen, so any write by any level throws.
const scriptedEvents = () => deepFreeze([
  { type: 'impact', surface: 'flesh', tick: 10, point: { x: 100, y: 50, z: 22 }, direction: { x: 1, y: 0 } },
  { type: 'impact', surface: 'metal', tick: 11, point: { x: 140, y: 50, z: 22 }, direction: { x: 1, y: 0 } },
  { type: 'impact', surface: 'flesh', shielded: true, tick: 12, point: { x: 160, y: 60, z: 22 }, direction: { x: 0, y: 1 } },
  { type: 'kill', tick: 20, point: { x: 300, y: 300, z: 24 }, color: 0xff00ff, dismember: true, direction: { x: 0, y: -1 } },
  { type: 'kill', tick: 26, point: { x: 340, y: 320, z: 24 }, color: 0x00ffff, dismember: false, direction: { x: 1, y: 1 } },
  { type: 'kill', tick: 40, point: { x: 420, y: 380, z: 24 }, color: 0xffff00, dismember: true, direction: null },
  { type: 'muzzle', tick: 41, point: { x: 10, y: 10, z: 30 } },
]);
const feed = (fx, events) => { for (const event of events) fx.add(event, 0); };

test('gore levels: three values, default full, unknown input falls back', () => {
  assert.deepEqual([...GORE_LEVELS], ['off', 'reduced', 'full']);
  assert.equal(DEFAULT_GORE_LEVEL, 'full');
  assert.equal(normalizeGoreLevel('reduced'), 'reduced');
  assert.equal(normalizeGoreLevel('max'), 'full');
  assert.equal(normalizeGoreLevel(undefined, 'off'), 'off');
  assert.equal(normalizeGoreLevel(true), 'full');
  assert.equal(createGorePresentation().level, 'full');
  assert.equal(createGorePresentation({ level: 'off' }).level, 'off');
  assert.equal(createGorePresentation({ level: 'nope' }).level, 'full');
});

test('full is the current behaviour: an explicit full presentation draws byte-for-byte what the default draws', () => {
  const events = scriptedEvents();
  const plain = createGorePresentation(); const full = createGorePresentation({ level: 'full' });
  feed(plain, events); feed(full, events);
  for (const tick of [12, 24, 30, 60, 120, 400]) {
    assert.deepEqual(full.frame(tick, { enabled: true }), plain.frame(tick, { enabled: true }), `frame ${tick}`);
    assert.deepEqual(renderAt(full, tick), renderAt(plain, tick), `render ${tick}`);
  }
  assert.ok(plain.frame(24, { enabled: true }).limbs.length >= 2, 'full still dismembers');
});

test('reduced keeps blood at reduced counts and never throws limb chunks', () => {
  assert.equal(GORE_REDUCED_LIMITS.limbs, 0);
  assert.ok(GORE_REDUCED_LIMITS.marks < GORE_LIMITS.marks && GORE_REDUCED_LIMITS.droplets < GORE_LIMITS.droplets);
  assert.ok(GORE_REDUCED_LIMITS.dropletsPerImpact < GORE_LIMITS.dropletsPerImpact && GORE_REDUCED_LIMITS.dropletsPerKill < GORE_LIMITS.dropletsPerKill);
  assert.ok(GORE_REDUCED_LIMITS.fragments < GORE_LIMITS.fragments);
  const fx = createGorePresentation({ level: 'reduced' });
  fx.add({ type: 'impact', surface: 'flesh', tick: 10, point: { x: 100, y: 50, z: 22 }, direction: { x: 1, y: 0 } }, 0);
  const hit = fx.frame(12, { enabled: true });
  assert.equal(hit.marks.length, 1, 'the hit mark still lands');
  assert.equal(hit.droplets.length, GORE_REDUCED_LIMITS.dropletsPerImpact);
  fx.add({ type: 'kill', tick: 60, point: { x: 300, y: 300, z: 24 }, dismember: true, direction: { x: 0, y: -1 } }, 0);
  // Tick 64: the hit droplet from tick 10 has long landed, so only the kill spray flies.
  const kill = fx.frame(64, { enabled: true });
  assert.equal(kill.limbs.length, 0, 'a dismembering kill crumples instead of throwing limbs');
  assert.equal(kill.droplets.length, GORE_REDUCED_LIMITS.dropletsPerKill);
  assert.ok(kill.marks.some((mark) => mark.kill), 'the kill splat still reads');
  assert.ok(kill.fragments.length <= GORE_REDUCED_LIMITS.fragments);
  for (let i = 0; i < 100; i += 1) fx.add({ type: 'kill', tick: 100 + i, point: { x: i, y: i, z: 24 }, dismember: true, direction: { x: 1, y: 0 } }, 0);
  const crowded = fx.frame(199, { enabled: true });
  assert.ok(crowded.marks.length <= GORE_REDUCED_LIMITS.marks, `marks ${crowded.marks.length}`);
  assert.ok(crowded.droplets.length <= GORE_REDUCED_LIMITS.droplets, `droplets ${crowded.droplets.length}`);
  assert.equal(crowded.limbs.length, 0);
  // A limb is the only gore shape with a bone-white cap (0xe9d9c8); no such
  // fill is drawn on either layer while the pools are crowded with kills.
  const { ground, air } = renderAt(fx, 199);
  assert.ok([...ground, ...air].every((op) => op[0] !== 'fill' || op[1].color !== 0xe9d9c8), 'no limb chunks drawn');
  assert.ok(ground.length > 0, 'blood marks are still painted');
});

test('off draws nothing: no blood, no droplets, no limbs, no decals, and add() is a no-op', () => {
  const fx = createGorePresentation({ level: 'off' });
  feed(fx, scriptedEvents());
  for (const tick of [12, 24, 60]) {
    assert.deepEqual(fx.frame(tick, { enabled: true }), { marks: [], fragments: [], droplets: [], limbs: [] });
    const { ground, air, drawn } = renderAt(fx, tick);
    assert.deepEqual(ground, []); assert.deepEqual(air, []);
    assert.deepEqual(drawn, { marks: 0, fragments: 0 });
  }
});

test('setLevel switches mid-run: full to reduced drops limbs and trims pools, off clears, full resumes', () => {
  const fx = createGorePresentation();
  feed(fx, scriptedEvents());
  assert.ok(fx.frame(24, { enabled: true }).limbs.length >= 2);
  assert.equal(fx.setLevel('reduced'), 'reduced');
  assert.equal(fx.level, 'reduced');
  const reduced = fx.frame(24, { enabled: true });
  assert.equal(reduced.limbs.length, 0);
  assert.ok(reduced.marks.length > 0, 'existing blood marks survive the step down');
  assert.ok(reduced.droplets.length <= GORE_REDUCED_LIMITS.droplets);
  assert.equal(fx.setLevel('bogus'), 'reduced', 'an unknown level keeps the current one');
  assert.equal(fx.setLevel('off'), 'off');
  assert.deepEqual(fx.frame(25, { enabled: true }), { marks: [], fragments: [], droplets: [], limbs: [] });
  fx.add({ type: 'kill', tick: 30, point: { x: 1, y: 1, z: 24 }, dismember: true }, 0);
  assert.deepEqual(fx.frame(31, { enabled: true }), { marks: [], fragments: [], droplets: [], limbs: [] }, 'off ignores new events');
  assert.equal(fx.setLevel('full'), 'full');
  fx.add({ type: 'kill', tick: 40, point: { x: 1, y: 1, z: 24 }, dismember: true }, 0);
  assert.ok(fx.frame(44, { enabled: true }).limbs.length >= 2, 'full dismembers again');
});

test('determinism proof: the frozen event stream and the corpse projection are identical across all three levels', () => {
  const events = scriptedEvents();
  const before = JSON.stringify(events);
  const renders = {};
  for (const level of GORE_LEVELS) {
    const fx = createGorePresentation({ level });
    for (const event of events) {
      fx.add(event, 0);
      // Every event is handed over frozen; a level that wrote to it would throw
      // above, and the serialized stream is compared below regardless.
      assert.ok(Object.isFrozen(event));
    }
    renders[level] = [12, 24, 60].map((tick) => renderAt(fx, tick));
  }
  assert.equal(JSON.stringify(events), before, 'no level rewrote the combat visual stream');
  // The corpse clock and projection take no gore input at all: the crumple is
  // the same object for every level.
  const clock = createCorpseClock(120, 2000);
  const crumple = [0, 30, 119, 120, 240].map((age) => corpsePresentation(clock, 120 + age, 2000 + age * (1000 / 60)));
  assert.deepEqual(crumple, [0, 30, 119, 120, 240].map((age) => corpsePresentation(clock, 120 + age, 2000 + age * (1000 / 60))));
  assert.ok(crumple[0].alpha === 1 && crumple.at(-1).expired === true);
  // The three levels do draw differently; this test is about their inputs.
  assert.notDeepEqual(renders.full, renders.reduced);
  assert.notDeepEqual(renders.reduced, renders.off);
});

test('static proof: no simulation, evidence or result module reads the gore level; only presentation and UI do', () => {
  const PRESENTATION_OWNERS = new Set(['gore-presentation.mjs', 'main.mjs', 'cockpit-ui.mjs', 'weapon-vfx.mjs', 'standalone-session.mjs', 'runtime-performance.mjs']);
  const dir = new URL('../apps/hmh-reboot/src/', import.meta.url);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.mjs') || PRESENTATION_OWNERS.has(file)) continue;
    const text = readFileSync(new URL(file, dir), 'utf8');
    assert.doesNotMatch(text, /goreLevel|settings\.gore\b|GORE_LEVELS/, `${file} must not read the gore setting`);
  }
  for (const file of ['apps/hmh-reboot/src/simulation.mjs', 'apps/hmh-reboot/src/enemy-simulation.mjs', 'apps/hmh-reboot/src/combat-lifecycle.mjs',
    'apps/hmh-reboot/src/run-summary-v7.mjs', 'apps/hmh-reboot/src/enemy-combat.mjs', 'apps/hmh-reboot/src/collision.mjs',
    'sdk/hmh-run-summary.mjs', 'sdk/hmh-run-summary-schema.mjs', 'sdk/hmh-run-summary-schema-v7.mjs']) {
    assert.doesNotMatch(src(file), /gore/i, `${file} is simulation, evidence or result authority and never mentions gore`);
  }
  // gore-presentation.mjs stays a pure consumer: it imports only the hash.
  const gore = src('apps/hmh-reboot/src/gore-presentation.mjs');
  assert.deepEqual([...gore.matchAll(/^import .* from '([^']+)';/gm)].map((match) => match[1]), ['./deterministic-hash.mjs']);
  // main.mjs: the level feeds only the settings sync, the pause menu callback,
  // the telemetry dataset and the presentation instance. The pools consume
  // events at a single site, after the frozen copy is taken for the visual
  // list, never inside a simulation step.
  const main = src('apps/hmh-reboot/src/main.mjs');
  const lines = main.split('\n').filter((line) => line.includes('goreLevel'));
  assert.ok(lines.length >= 4, 'main.mjs wires the level');
  const allowed = /normalizeGoreLevel|key !== 'goreLevel'|settings\.goreLevel|goreLevel: level|gore: goreLevel !== 'off'|dataset\.settingGoreLevel|GORE_LEVELS|applyPauseChoice|setLevel\(|createGorePresentation\(\{ level/;
  for (const line of lines) assert.match(line, allowed, `unexpected goreLevel use in main.mjs: ${line.trim()}`);
  assert.equal((main.match(/gorePresentation\?\.add\(/g) ?? []).length, 1);
  assert.match(main, /const pushCombatVisualEvent = \(event\) => \{\n\s*if \(settings\.gore && event\.point\) gorePresentation\?\.add\(/);
  assert.match(main, /const applyPauseChoice = \(key, value\) => \{[\s\S]*?if \(key !== 'goreLevel'\) throw/);
  assert.match(main, /gore: goreLevel !== 'off'/, 'the legacy boolean the vfx call sites and the bridge require is derived from the level');
  assert.match(main, /gorePresentation\?\.setLevel\(settings\.goreLevel\)/);
  assert.match(main, /createGorePresentation\(\{ level: settings\.goreLevel \}\)/);
  assert.match(main, /dataset\.settingGoreLevel = settings\.goreLevel/);
});

test('reduced flash still applies at every gore level', () => {
  const goreOf = { off: false, reduced: true, full: true };
  for (const level of GORE_LEVELS) {
    const gore = goreOf[level];
    const kill = resolveKillBurst({ age: 2, color: 0x123456, reduceFlash: true, gore });
    assert.equal(kill.ringColor, 0x123456, `${level}: no hot white ring under reduced flash`);
    assert.ok(kill.ringAlpha <= FLASH_SAFE.maxCoreAlpha && kill.innerAlpha <= FLASH_SAFE.maxHaloAlpha, `${level}: ring alpha clamped`);
    assert.ok(kill.puff.alpha <= FLASH_SAFE.maxHaloAlpha, `${level}: puff alpha clamped`);
    const hot = resolveKillBurst({ age: 2, color: 0x123456, reduceFlash: false, gore });
    assert.notEqual(hot.ringColor, 0x123456, `${level}: the hot ring is a reduceFlash decision, not a gore one`);
    const impact = resolveImpactBurst({ surface: 'flesh', weaponId: 'coin-blaster', critical: true, age: 1, sparkBase: 4, reduceFlash: true, gore });
    assert.notEqual(impact.ringColor, 0xfff06a, `${level}: no hot critical ring under reduced flash`);
    assert.notEqual(impact.sparkColor, 0xfff06a, `${level}: no hot critical sparks under reduced flash`);
    const reaction = resolveEnemyHitReaction({ age: 0, knockback: { x: 3, y: 0 }, reduceFlash: true, seed: level });
    assert.equal(reaction.flash, false, `${level}: no body flash under reduced flash`);
    assert.equal(reaction.ring.color, 0xffffff);
  }
  // The kill/impact call sites pass both flags from the live settings.
  const main = src('apps/hmh-reboot/src/main.mjs');
  const kill = main.slice(main.indexOf('resolveKillBurst({'), main.indexOf('resolveKillBurst({') + 200);
  assert.match(kill, /reduceFlash: settings\.reduceFlash/); assert.match(kill, /gore: settings\.gore/);
  const impact = main.slice(main.indexOf('resolveImpactBurst({'), main.indexOf('resolveImpactBurst({') + 560);
  assert.match(impact, /reduceFlash: settings\.reduceFlash/); assert.match(impact, /gore: settings\.gore/);
});

test('bridge: goreLevel is an optional enum on portal:settings and game:settings; the boolean gore stays required', () => {
  const base = projectHmhRuntimeSettings();
  assert.equal(base.goreLevel, 'full');
  assert.equal(base.gore, true);
  const envelope = (type, settings) => createBridgeEnvelope({ type, sessionId: 'game-session-000000001', messageId: `x-${type}`, payload: { settings } });
  for (const [type, validate] of [['portal:settings', validateParentMessage], ['game:settings', validateChildMessage]]) {
    for (const level of GORE_LEVELS) assert.equal(validate(envelope(type, { ...base, goreLevel: level })).ok, true, `${type} ${level}`);
    const { goreLevel, ...withoutLevel } = base;
    assert.equal(validate(envelope(type, withoutLevel)).ok, true, `${type}: an older parent without goreLevel is still valid`);
    assert.match(validate(envelope(type, { ...base, goreLevel: 'max' })).error, /goreLevel/, `${type}: unknown level`);
    assert.match(validate(envelope(type, { ...base, goreLevel: true })).error, /goreLevel/, `${type}: wrong type`);
    const { gore, ...withoutGore } = base;
    assert.match(validate(envelope(type, withoutGore)).error, /missing field: gore/, `${type}: the boolean stays required`);
  }
});

test('portal persistence: gameplay.goreLevel defaults to full, projects coherently with the legacy toggle, and round-trips from the child', () => {
  assert.equal(HMH_PLAYER_SETTINGS_DEFAULTS.gameplay.goreLevel, 'full');
  assert.equal(normalizeHmhPlayerSettings({ gameplay: { goreLevel: 'reduced' } }).gameplay.goreLevel, 'reduced');
  assert.equal(normalizeHmhPlayerSettings({ gameplay: { goreLevel: 'extreme' } }).gameplay.goreLevel, 'full');
  assert.equal(normalizeHmhPlayerSettings({ goreLevel: 'off' }).gameplay.goreLevel, 'off', 'flat legacy shape');
  // The legacy portal toggle off projects as level off; back on restores the stored level.
  const toggledOff = projectHmhRuntimeSettings(normalizeHmhPlayerSettings({ gameplay: { gore: false, goreLevel: 'reduced' } }));
  assert.equal(toggledOff.goreLevel, 'off'); assert.equal(toggledOff.gore, false);
  // The child always sends the boolean derived from its level, so a stored
  // (on, off) pair only comes from the legacy portal toggle being flipped on
  // after the pause menu chose Off: the later action wins.
  const toggledBackOn = projectHmhRuntimeSettings(normalizeHmhPlayerSettings({ gameplay: { gore: true, goreLevel: 'off' } }));
  assert.equal(toggledBackOn.goreLevel, 'full'); assert.equal(toggledBackOn.gore, true);
  const reduced = projectHmhRuntimeSettings(normalizeHmhPlayerSettings({ gameplay: { gore: true, goreLevel: 'reduced' } }));
  assert.equal(reduced.goreLevel, 'reduced'); assert.equal(reduced.gore, true);
  // The child sends the level on game:settings; the parent stores it and keeps
  // the boolean coherent, under 'hmh-settings' like every other pause setting.
  const fromChild = mergeHmhRuntimeSettings(HMH_PLAYER_SETTINGS_DEFAULTS, { goreLevel: 'off', gore: false });
  assert.equal(fromChild.gameplay.goreLevel, 'off'); assert.equal(fromChild.gameplay.gore, false);
  const backOn = mergeHmhRuntimeSettings(fromChild, { goreLevel: 'reduced', gore: true }, { rankedActive: true });
  assert.equal(backOn.gameplay.goreLevel, 'reduced'); assert.equal(backOn.gameplay.gore, true, 'a cosmetic setting is editable during ranked');
  const untouched = mergeHmhRuntimeSettings(backOn, { sfxVolume: 0.5 });
  assert.equal(untouched.gameplay.goreLevel, 'reduced', 'a payload without the level keeps the stored one');
});

test('standalone dev sessions start at the owner default, full', () => {
  const standalone = src('apps/hmh-reboot/src/standalone-session.mjs');
  assert.match(standalone, /gore: true,\s*goreLevel: 'full'/);
});

test('share cards and banners are static, gore-free art: no HMH path captures the live scene', () => {
  // The Free card is composed server-side from the token and these committed
  // files only (api/free-card.mjs); the Ranked card uses the same background.
  // Their hashes are the reviewed art (docs/2.0/slices/HMH-GORE-SETTING.md).
  const expected = {
    'apps/portal/assets/share-cards/lester-blaster.png': 'a2261a76c7f2d0fef5ee6001b7960d3a9b8d5109c551f8096323ef1dc39a0ea7',
    'apps/portal/assets/share-cards/lester-blaster-free.png': '902331ecf5501f39785e8b16d1ba400e7704d09ea8e68fca343f0221493c221f',
    'apps/portal/assets/share-cards/heroes/lit-commando.png': '2b8ce0b459859458b229c2d5026c144a6582ffddb976f809f988f30d643e59c9',
    'apps/portal/assets/share-cards/heroes/lit-valkyrie.png': '62e49216c3fa29b77914e903026baaba2389cc5007c58c9f3493b26d5f66f95b',
    'apps/portal/assets/share-cards/heroes/lester-original.png': '9093004e968e4e99ac270f9bfd26271e489883fd677e8dd2b3df917492781b2e',
    'apps/portal/assets/share-cards/heroes/lilly.png': '02ca2197e1c164e487a582245bf6dd304d7e9546fa991ab243009642b2a73f2b',
  };
  for (const [path, sha256] of Object.entries(expected)) {
    const digest = createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex');
    assert.equal(digest, sha256, `${path} changed; re-review it for gore and update docs/2.0/slices/HMH-GORE-SETTING.md`);
  }
  // No canvas capture anywhere in the child or the share pipeline.
  const dir = new URL('../apps/hmh-reboot/src/', import.meta.url);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.mjs')) continue;
    assert.doesNotMatch(readFileSync(new URL(file, dir), 'utf8'), /toDataURL|toBlob|renderer\.extract|preserveDrawingBuffer|captureStream/, `${file} captures the scene`);
  }
  for (const file of ['api/free-card.mjs', 'server/share/render-free-card.mjs', 'server/share/render-card.mjs', 'apps/portal/src/share-file.mjs', 'apps/portal/src/share-links.mjs']) {
    assert.doesNotMatch(src(file), /toDataURL|toBlob|renderer\.extract|captureStream|html2canvas/, `${file} captures a live scene`);
  }
  assert.match(src('api/free-card.mjs'), /share-cards\/lester-blaster\.png/);
});
