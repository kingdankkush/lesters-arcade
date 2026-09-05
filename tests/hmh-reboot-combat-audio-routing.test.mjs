// Cycle 074 (S-2): the child's combat cues must route through the portal cue
// registry -- categories (families), voice limits and ducking -- rather than
// fall through the registry gate silently.
//
// The defect this file exists for: combat-audio.mjs refuses any cue that is
// not in HMH_SFX_CUE_REGISTRY, and twelve of the fourteen synthesised weapon
// cues (weapon-audio.mjs) were never registered. Every gun except Hash Rail,
// plus reload, dry-fire and the Lightning Ledger interrupt cues, therefore
// returned `unknown-cue` in production since 9d669796 (2026-08-05) while the
// static wiring tests kept passing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createCombatAudio } from '../apps/hmh-reboot/src/combat-audio.mjs';
import { HMH_WEAPON_SFX } from '../apps/hmh-reboot/src/weapon-audio.mjs';
import { HMH_AUDIO_MIX, HMH_SFX_CUE_REGISTRY, validateHmhAudioSystem } from '../apps/portal/src/hmh-audio-system.mjs';

class FakeAudio {
  static instances = [];

  constructor(src) {
    this.src = src;
    this.volume = 1;
    this.ended = false;
    this.paused = true;
    this.pauseCalls = 0;
    FakeAudio.instances.push(this);
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
}

function fresh(options = {}) {
  FakeAudio.instances = [];
  return createCombatAudio({ AudioCtor: FakeAudio, ...options });
}

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

// Every literal the child hands to combatAudio.play(), plus every synthesised
// weapon cue id it can hand over through weaponFireCueId(). The portal-side
// coverage test scans apps/portal/main.js only; this is the child's half.
function childRuntimeCueIds() {
  const main = repoText('apps/hmh-reboot/src/main.mjs');
  const literalCues = [...main.matchAll(/combatAudio\.play\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return [...new Set([...literalCues, ...Object.keys(HMH_WEAPON_SFX)])].sort();
}

test('S-2: every synthesised weapon cue is registered and plays through the registry', () => {
  const audio = fresh();
  const silent = [];
  let now = 0;
  for (const [cueId, cue] of Object.entries(HMH_WEAPON_SFX)) {
    now += 1_000;
    const result = audio.play(cueId, { now, volume: cue.gain });
    if (!result.played) silent.push(`${cueId}: ${result.reason}`);
  }
  assert.deepEqual(silent, [], 'synthesised cues that the registry gate refuses');
  assert.equal(FakeAudio.instances.length, Object.keys(HMH_WEAPON_SFX).length);
  for (const instance of FakeAudio.instances) assert.match(instance.src, /^\.\.\/assets\/audio\/sfx\/hmh-[a-z-]+\.wav$/);
});

test('S-2: the child runtime cue set validates against the portal registry', () => {
  const validation = validateHmhAudioSystem({ runtimeCues: childRuntimeCueIds() });
  assert.equal(validation.ok, true, validation.gaps.join('\n'));
});

test('S-2: the registered weapon cues live in an existing capped family with sane priorities', () => {
  for (const cueId of Object.keys(HMH_WEAPON_SFX)) {
    const spec = HMH_SFX_CUE_REGISTRY[cueId];
    assert.ok(spec, `${cueId} missing from the registry`);
    assert.equal(spec.family, 'weapon', `${cueId} must share the weapon family cap`);
    assert.ok(HMH_AUDIO_MIX.familyCaps[spec.family] > 0, `${cueId} family has no mix cap`);
    assert.ok(spec.priority >= 2 && spec.priority <= 4, `${cueId} priority ${spec.priority}`);
    assert.ok(spec.cooldownMs >= 40 && spec.cooldownMs <= 400, `${cueId} cooldown ${spec.cooldownMs}`);
    assert.equal(spec.samplePreferred, true, `${cueId} is a rendered sample, not a synth tone`);
  }
});

test('S-2: the portal-side coverage floors survive the additions', () => {
  const entries = Object.entries(HMH_SFX_CUE_REGISTRY);
  const families = new Set(entries.map(([, spec]) => spec.family));
  const signatures = new Set(entries.map(([, spec]) => `${spec.synth}:${spec.tone.join('/')}:${spec.cooldownMs}`));
  assert.ok(entries.length >= 64);
  assert.ok(families.size >= 9);
  assert.ok(signatures.size >= 52);
  for (const family of families) assert.ok(HMH_AUDIO_MIX.familyCaps[family] > 0, `${family} has no cap`);
});

test('S-2: reduceMotion from the settings channel dampens heavy-family cues like the portal player does', () => {
  const plain = fresh();
  plain.play('player-hit', { now: 1_000, volume: 0.1 });
  const plainVolume = FakeAudio.instances[0].volume;

  const reduced = fresh();
  // Same object the child passes today: combatAudio.setBusLevels(settings).
  reduced.setBusLevels({ musicEnabled: true, screenShake: true, gore: false, reduceMotion: true, reduceFlash: false, colorblindTags: false });
  reduced.play('player-hit', { now: 1_000, volume: 0.1 });
  const reducedVolume = FakeAudio.instances[0].volume;

  assert.ok(plainVolume > 0);
  assert.ok(Math.abs(reducedVolume - plainVolume * HMH_AUDIO_MIX.accessibility.reduceMotionVolumeMul) < 1e-3,
    `expected ${plainVolume} x 0.82, received ${reducedVolume}`);

  // Non-heavy families are untouched by the accessibility multiplier.
  const reducedWeapon = fresh();
  reducedWeapon.setBusLevels({ reduceMotion: true });
  reducedWeapon.play('weapon-fire', { now: 1_000, volume: 0.1 });
  const reducedWeaponVolume = FakeAudio.instances[0].volume;
  const plainWeapon = fresh();
  plainWeapon.play('weapon-fire', { now: 1_000, volume: 0.1 });
  assert.equal(reducedWeaponVolume, FakeAudio.instances[0].volume);
  assert.equal(reducedWeaponVolume, 0.068);
  assert.equal(reducedWeapon.status().reduceMotion, true);
  assert.equal(plainWeapon.status().reduceMotion, false);
  // The pinned bus shape stays byte-identical for the existing X2 bus test.
  assert.deepEqual(Object.keys(plainWeapon.status().buses), ['music', 'sfx', 'ui', 'dynamicRange']);
});

test('S-2: a live boss cue ducks weapon, movement and reward cues for a bounded window', () => {
  const audio = fresh();
  assert.equal(audio.play('boss-phase', { now: 1_000, volume: 0.14 }).played, true);
  audio.play('weapon-fire', { now: 1_100, volume: 0.1 });
  audio.play('dash', { now: 1_150, volume: 0.1 });
  audio.play('pickup', { now: 1_200, volume: 0.1 });
  audio.play('player-hit', { now: 1_250, volume: 0.1 });
  audio.play('menu-click', { now: 1_300, volume: 0.1 });
  const [, weapon, dash, pickup, damage, ui] = FakeAudio.instances;

  const reference = fresh();
  reference.play('weapon-fire', { now: 1_100, volume: 0.1 });
  reference.play('dash', { now: 1_150, volume: 0.1 });
  reference.play('pickup', { now: 1_200, volume: 0.1 });
  reference.play('player-hit', { now: 1_250, volume: 0.1 });
  reference.play('menu-click', { now: 1_300, volume: 0.1 });
  const [refWeapon, refDash, refPickup, refDamage, refUi] = FakeAudio.instances;

  const close = (a, b) => Math.abs(a - b) < 1e-3;
  assert.ok(close(weapon.volume, refWeapon.volume * 0.7), `weapon ${weapon.volume} vs ${refWeapon.volume}`);
  assert.ok(close(dash.volume, refDash.volume * 0.7), `movement ${dash.volume} vs ${refDash.volume}`);
  assert.ok(close(pickup.volume, refPickup.volume * 0.7), `reward ${pickup.volume} vs ${refPickup.volume}`);
  assert.equal(damage.volume, refDamage.volume, 'damage is never ducked');
  assert.equal(ui.volume, refUi.volume, 'ui is never ducked');

  // The window is time-based, not voice-lifetime-based: a boss voice that
  // never reports `ended` cannot hold the duck past the window.
  audio.play('weapon-fire', { now: 1_700, volume: 0.1 });
  const late = FakeAudio.instances.at(-1);
  assert.equal(late.volume, refWeapon.volume, 'duck must release after the window even while the boss voice is held');
});

test('S-2: the boss cue itself keeps its 0.16 clamp and is never ducked by another boss voice', () => {
  const reference = fresh();
  reference.play('combo-boss-threshold', { now: 1_100, volume: 0.14 });
  const referenceVolume = FakeAudio.instances[0].volume;
  const audio = fresh();
  audio.play('boss-phase', { now: 1_000, volume: 0.14 });
  audio.play('combo-boss-threshold', { now: 1_100, volume: 0.14 });
  assert.equal(FakeAudio.instances[0].volume, 0.16);
  assert.equal(FakeAudio.instances[1].volume, referenceVolume);
  assert.ok(referenceVolume > 0.15);
});

test('S-2: status counts registry-gate refusals so a browser gate can assert zero', () => {
  const audio = fresh();
  assert.equal(audio.status().unknownCues, 0);
  assert.deepEqual(audio.play('not-a-cue', { now: 1 }), { played: false, reason: 'unknown-cue' });
  assert.deepEqual(audio.play('also-not-a-cue', { now: 2 }), { played: false, reason: 'unknown-cue' });
  assert.equal(audio.status().unknownCues, 2);
  assert.equal(FakeAudio.instances.length, 0);
  audio.play('weapon-fire', { now: 3, volume: 0.1 });
  assert.equal(audio.status().unknownCues, 2, 'a played cue does not change the refusal count');
});

test('S-2: the child exposes the refusal count beside audioVoices for the browser smokes', () => {
  const main = repoText('apps/hmh-reboot/src/main.mjs');
  assert.match(main, /dataset\.audioVoices = String\(combatAudio\.status\(\)\.activeVoices\);/);
  assert.match(main, /dataset\.audioUnknownCues = String\(combatAudio\.status\(\)\.unknownCues\);/);
  // Pinned by other suites; must stay byte-identical.
  assert.match(main, /combatAudio\.setBusLevels\(settings\);/);
  assert.doesNotMatch(main, /sfxVolume: [0-9.]+/);
});

test('S-2: the registry gate itself is kept -- routing is the fix, not a wider gate', () => {
  const source = repoText('apps/hmh-reboot/src/combat-audio.mjs');
  assert.match(source, /if \(!samplePath \|\| !HMH_SFX_CUE_REGISTRY\[cue\]\)/);
  assert.match(source, /import \{ HMH_WEAPON_SFX \} from '\.\/weapon-audio\.mjs';/);
});
