import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HMH_SFX_MANIFEST } from '../apps/portal/assets/audio/sfx/sfx-manifest.mjs';
import { COMBAT_FEEDBACK_MOMENTS } from '../apps/portal/src/hmh-combat-feedback.mjs';
import {
  HMH_SFX_CUE_REGISTRY,
  hmhSfxToneFor,
  resolveHmhSfxCuePlan,
  validateHmhAudioSystem,
} from '../apps/portal/src/hmh-audio-system.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function runtimeCueIds() {
  const main = repoText('apps/portal/main.js');
  const literalCues = [...main.matchAll(/playSfxCue\(['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const feedbackCues = Object.values(COMBAT_FEEDBACK_MOMENTS).map((moment) => moment.cues.sfxCue);
  const levelOneInteractiveCues = [...main.matchAll(/level1-(?:cache-open|gas-pump-warning|gas-pump-detonate|cover-break|mushroom-pulse|gate-unlock|extraction-flare)/g)].map((match) => match[0]);
  return [...new Set([...literalCues, ...feedbackCues, ...levelOneInteractiveCues])].sort();
}

test('WO-41 audio registry covers manifest and runtime SFX cues', () => {
  const validation = validateHmhAudioSystem({
    manifestCues: Object.keys(HMH_SFX_MANIFEST.cues),
    runtimeCues: runtimeCueIds(),
  });
  assert.equal(validation.ok, true, validation.gaps.join('\n'));
  assert.ok(validation.cueCount >= 24);
});

test('WO-41 SFX plans apply per-cue cooldowns and volume mix rules', () => {
  const first = resolveHmhSfxCuePlan('weapon-fire', { requestedVolume: 0.5, now: 1000, lastPlayedAt: 0 });
  assert.equal(first.allowed, true);
  assert.ok(first.volume <= 0.16);
  assert.equal(first.family, 'weapon');

  const blocked = resolveHmhSfxCuePlan('weapon-fire', { requestedVolume: 0.5, now: 1030, lastPlayedAt: 1000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'cooldown');

  const boss = resolveHmhSfxCuePlan('boss-warning', { requestedVolume: 0.1, now: 2000, lastPlayedAt: 0, reduceMotion: true });
  assert.equal(boss.allowed, true);
  assert.equal(boss.family, 'boss');
  assert.ok(boss.volume < 0.125, 'reduced motion should dampen heavy boss cue volume');
});

test('WO-41 synth tones remain available for sample gaps and new gameplay cues', () => {
  for (const cue of ['hero-select', 'enemy-death', 'xp-pickup', 'grenade-boom', 'level-up', 'level1-gate-unlock']) {
    const tone = hmhSfxToneFor(cue);
    assert.ok(Array.isArray(tone), `${cue} tone array`);
    assert.ok(tone.length >= 1, `${cue} tone length`);
    assert.ok(tone.every((frequency) => frequency > 0), `${cue} positive frequencies`);
  }
});

test('WO-41 runtime playSfxCue uses the central audio system planner', () => {
  const main = repoText('apps/portal/main.js');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(main.includes("./src/hmh-audio-system.mjs"), true);
  assert.equal(main.includes('resolveHmhSfxCuePlan('), true);
  assert.equal(main.includes('hmhSfxToneFor(cue)'), true);
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-audio-system.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-audio-system.test.mjs'), true);
});

test('WO-41 registry keeps existing CC0 sample manifest cues sample-preferred', () => {
  for (const cue of Object.keys(HMH_SFX_MANIFEST.cues)) {
    assert.equal(HMH_SFX_CUE_REGISTRY[cue].samplePreferred, true, `${cue} should prefer the CC0 sample`);
  }
});

test('SHIP audio inventory provides at least 64 playable and meaningfully distinct cues', () => {
  const entries = Object.entries(HMH_SFX_CUE_REGISTRY);
  assert.ok(entries.length >= 64, `expected >=64 cues, received ${entries.length}`);
  const required = [
    'menu-confirm', 'menu-back', 'pause', 'resume', 'low-health',
    'settler-fire', 'auto-miner-fire', 'hash-rail-charge', 'hash-rail-fire',
    'spread-ltc-fire', 'litecoin-blade-swing', 'litecoin-blade-hit',
    'reload-start', 'reload-complete', 'empty-clip', 'critical-hit',
    'shield-hit', 'shield-break', 'elite-spawn', 'boss-phase', 'boss-death',
    'health-pickup', 'ammo-pickup', 'shield-pickup', 'one-up-pickup',
    'upgrade-offer', 'upgrade-pick', 'achievement-unlock', 'wave-start',
    'wave-clear', 'extraction-ready', 'extraction-complete', 'victory',
  ];
  for (const cue of required) assert.ok(HMH_SFX_CUE_REGISTRY[cue], `missing ${cue}`);
  const families = new Set(entries.map(([, spec]) => spec.family));
  assert.ok(families.size >= 9, `expected broad family coverage, received ${families.size}`);
  const signatures = new Set(entries.map(([, spec]) => `${spec.synth}:${spec.tone.join('/')}:${spec.cooldownMs}`));
  assert.ok(signatures.size >= 52, `expected >=52 distinct cue signatures, received ${signatures.size}`);
});

test('SHIP runtime routes major gameplay moments into the expanded cue inventory', () => {
  const main = repoText('apps/portal/main.js');
  for (const cue of ['settler-fire', 'auto-miner-fire', 'hash-rail-fire', 'spread-ltc-fire', 'litecoin-blade-swing', 'reload-start', 'reload-complete', 'pause', 'resume', 'boss-phase', 'boss-death', 'upgrade-offer', 'upgrade-pick', 'low-health']) {
    assert.match(main, new RegExp(`['"]${cue}['"]`), `runtime missing ${cue}`);
  }
});
