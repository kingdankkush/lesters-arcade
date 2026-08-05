import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HMH_WEAPON_SFX, weaponFireCueId } from '../apps/hmh-reboot/src/weapon-audio.mjs';

const repoUrl = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(readFileSync(
  repoUrl('apps/portal/assets/audio/sfx/hmh-weapon-sfx-manifest.json'),
  'utf8',
));
const combatAudioSource = readFileSync(repoUrl('apps/hmh-reboot/src/combat-audio.mjs'), 'utf8');
const mainSource = readFileSync(repoUrl('apps/hmh-reboot/src/main.mjs'), 'utf8');

// C1. Every weapon shared one weapon-fire.ogg, so a pistol, a shotgun, a
// minigun and a grenade launcher were audibly the same gun. The existing SFX
// are hand-sourced CC0 packs, which cannot be regenerated from repo source, so
// these are SYNTHESISED deterministically instead -- same determinism rule the
// Blender pipelines follow.
const WEAPONS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig']);

test('every weapon declares its own fire cue', () => {
  for (const weaponId of WEAPONS) {
    const cueId = weaponFireCueId(weaponId);
    assert.ok(typeof cueId === 'string' && cueId.length > 0, `${weaponId} has no fire cue`);
    assert.ok(HMH_WEAPON_SFX[cueId], `${cueId} is not in the weapon SFX registry`);
  }
  const cueIds = WEAPONS.map(weaponFireCueId);
  assert.equal(new Set(cueIds).size, WEAPONS.length, 'weapons must not share a fire cue');
});

test('an unknown weapon falls back rather than throwing inside the audio path', () => {
  // combatAudio.play runs inside the frame loop; a throw here would kill the
  // run, so an unrecognised weapon has to degrade to a generic cue.
  const cueId = weaponFireCueId('not-a-weapon');
  assert.ok(HMH_WEAPON_SFX[cueId], 'fallback cue must exist');
});

test('reload and empty-click cues exist alongside fire', () => {
  for (const cueId of ['hmh-weapon-reload', 'hmh-weapon-empty']) {
    assert.ok(HMH_WEAPON_SFX[cueId], `${cueId} missing from the registry`);
  }
});

test('every registered cue has a rendered file and a manifest entry', () => {
  for (const [cueId, cue] of Object.entries(HMH_WEAPON_SFX)) {
    assert.match(cue.src, /^\.\.\/assets\/audio\/sfx\/hmh-.*\.wav$/, `${cueId} src`);
    const relative = cue.src.replace('../assets/', 'apps/portal/assets/');
    assert.ok(existsSync(repoUrl(relative)), `${cueId} file missing at ${relative}`);
    const entry = manifest.cues[cueId];
    assert.ok(entry, `${cueId} missing from the synth manifest`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${cueId} has no content hash`);
    assert.ok(entry.bytes > 0, `${cueId} is empty`);
    assert.ok(entry.durationMs >= 40 && entry.durationMs <= 2_500, `${cueId} duration ${entry.durationMs}ms`);
  }
});

// The whole point is that the four guns sound different. Identical hashes
// would mean the synth parameters collapsed to the same waveform.
test('no two weapon fire cues are byte-identical', () => {
  const hashes = WEAPONS.map((weaponId) => manifest.cues[weaponFireCueId(weaponId)].sha256);
  assert.equal(new Set(hashes).size, WEAPONS.length, 'two weapons render the same audio');
});

test('the synth manifest records the parameters it rendered from', () => {
  assert.equal(manifest.pipelineId, 'hmh-weapon-sfx-v1');
  assert.equal(manifest.license, 'synthesised-in-repo');
  assert.ok(manifest.sampleRate >= 22_050, 'sample rate too low for a fire transient');
  for (const cue of Object.values(manifest.cues)) {
    assert.ok(cue.synth && typeof cue.synth === 'object', 'each cue must record its synth parameters');
  }
});

test('the child audio layer resolves every weapon cue to a real file', () => {
  // combat-audio maps the registry in bulk rather than listing cue ids, so
  // assert the wiring is present and that every path it will produce exists.
  assert.match(combatAudioSource, /import \{ HMH_WEAPON_SFX \} from '\.\/weapon-audio\.mjs';/);
  assert.match(combatAudioSource, /Object\.entries\(HMH_WEAPON_SFX\)\.map\(\(\[cueId, cue\]\) => \[cueId, cue\.src\]\)/);
  // The spread must come BEFORE the sourced cues, so a name collision cannot
  // silently replace an existing hand-sourced sample.
  const spreadAt = combatAudioSource.indexOf('Object.entries(HMH_WEAPON_SFX)');
  const sourcedAt = combatAudioSource.indexOf("'weapon-fire': '../assets/audio/sfx/weapon-fire.ogg'");
  assert.ok(spreadAt > 0 && sourcedAt > spreadAt, 'synthesised cues must not override sourced ones');
});

// The regression this slice exists to prevent: one hardcoded cue for every gun.
test('the fire call site is weapon-aware rather than hardcoded', () => {
  assert.ok(
    mainSource.includes('weaponFireCueId('),
    'main.mjs still selects weapon audio without weaponFireCueId',
  );
  assert.doesNotMatch(
    mainSource,
    /combatAudio\.play\(\s*event\.weaponId === 'launcher-rig' \? 'grenade' : 'weapon-fire'/,
    'the hardcoded two-way weapon audio branch is still present',
  );
});

// A synthesised cue nobody triggers is dead weight in the manifest. Both of
// these events already existed and were silent -- the player learned about an
// empty weapon from the HUD alone, which is how the exhausted-shotgun trap
// went unnoticed in the owner playtest.
test('reload and dry-fire cues are triggered by real combat events', () => {
  assert.match(mainSource, /event\.type === 'weapon:reload-start'[\s\S]{0,160}hmh-weapon-reload/);
  assert.match(mainSource, /event\.type === 'weapon:auto-fallback'[\s\S]{0,160}hmh-weapon-empty/);
});
