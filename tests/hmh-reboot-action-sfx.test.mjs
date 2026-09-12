import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createCombatAudio } from '../apps/hmh-reboot/src/combat-audio.mjs';
import { weaponFireGain } from '../apps/hmh-reboot/src/weapon-audio.mjs';
import { createWeaponLoadout, stepWeaponLoadout } from '../apps/hmh-reboot/src/weapon-system.mjs';

const root = new URL('../apps/portal/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets/audio/sfx/hmh-weapon-sfx-manifest.json', root)));
class AudioProbe {
  static voices = [];
  constructor(src) { this.src = src; this.paused = true; this.ended = false; AudioProbe.voices.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
function pcm(src) {
  const bytes = readFileSync(new URL(src.replace('../assets/', 'assets/'), root));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.readUInt16LE(22), 1);
  const rate = bytes.readUInt32LE(24);
  const samples = Array.from({ length: bytes.readUInt32LE(40) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32768);
  return { bytes, samples, rate };
}
const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / Math.max(1, values.length));

test('pistol and automatic fire carry a sustained pressure body as well as an initial crack', () => {
  for (const id of ['coin-blaster', 'auto-miner']) {
    const cue = manifest.cues[`hmh-fire-${id}`];
    const { samples, rate } = pcm(cue.src.replace('./', '../'));
    const body = rms(samples.slice(Math.floor(rate * .015), Math.floor(rate * .075)));
    assert.ok(body >= .12, `${id}: 15–75ms pressure body RMS ${body} is too thin`);
    assert.ok(weaponFireGain(id) >= .18, `${id}: routed gain must remain audible over gameplay music`);
  }
});

test('hits, reloads, power-ups and reward choices reach distinct authored samples through the real player', () => {
  AudioProbe.voices = [];
  const player = createCombatAudio({ AudioCtor: AudioProbe });
  const cues = ['hmh-weapon-reload', 'reload-complete', 'enemy-hit', 'player-hit', 'grenade', 'grenade-boom',
    'health-pickup', 'ammo-pickup', 'time-dilation-activate', 'berserk-activate', 'pickup', 'upgrade-offer', 'upgrade-pick'];
  cues.forEach((cue, index) => assert.equal(player.play(cue, { now: index * 1000, volume: .14 }).played, true));
  const hashes = AudioProbe.voices.map(voice => {
    assert.match(voice.src, /\/hmh-[a-z-]+\.wav$/, voice.src);
    return createHash('sha256').update(pcm(voice.src).bytes).digest('hex');
  });
  assert.equal(new Set(hashes).size, cues.length, 'different combat/reward events must be distinguishable by sound');
  player.destroy();
});

test('reload release and final chamber cues correspond to separate authoritative ammo events', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /event\.type === 'weapon:reload-start'[\s\S]{0,160}play\('hmh-weapon-reload'/);
  assert.match(source, /event\.type === 'weapon:reload-complete'[\s\S]{0,160}play\('reload-complete'/);
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster'], seed: 17 });
  const events = [];
  for (let tick = 1; tick <= 232; tick++) {
    const frame = stepWeaponLoadout(state, { tick, fire: true, direction: { x: 1, y: 0 } });
    events.push(...frame.events.filter(event => event.type.startsWith('weapon:reload-')));
  }
  assert.deepEqual(events.map(event => event.type), ['weapon:reload-start', 'weapon:reload-complete']);
  assert.equal(events[1].tick, events[0].completeTick);
  assert.equal(events[1].tick - events[0].tick, 90);
  assert.ok(manifest.cues['hmh-weapon-reload'].durationMs < 1000 * (events[1].tick - events[0].tick) / 60);
  assert.notEqual(manifest.cues['hmh-weapon-reload'].sha256, manifest.cues['hmh-reload-complete'].sha256);
});

test('authored sample manifest binds shipped PCM and leaves clean attack/tail and peak headroom', () => {
  let totalBytes = 0;
  for (const [id, cue] of Object.entries(manifest.cues)) {
    const { bytes, samples, rate } = pcm(cue.src.replace('./', '../'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), cue.sha256, id);
    assert.equal(bytes.length, cue.bytes, id);
    assert.ok(Math.abs(samples[0]) <= 1 / 32768 && Math.abs(samples.at(-1)) <= 1 / 32768, `${id}: click at file boundary`);
    assert.ok(Math.max(...samples.map(Math.abs)) <= .781, `${id}: insufficient resampling headroom`);
    assert.ok(Math.abs(samples.reduce((sum, value) => sum + value, 0) / samples.length) < .008, `${id}: DC bias`);
    assert.ok(samples.length / rate < 1.6, `${id}: long tail would crowd the combat mix`);
    totalBytes += bytes.length;
  }
  assert.ok(totalBytes <= 1_750_000, `short mono sample budget exceeded: ${totalBytes}`);
});

test('rapid combat audio respects the voice cap, protects damage, and still obeys mute and pause', () => {
  AudioProbe.voices = [];
  const player = createCombatAudio({ AudioCtor: AudioProbe, maxVoices: 16 });
  for (let i = 0; i < 96; i++) {
    player.play(i % 2 ? 'enemy-hit' : 'hmh-fire-auto-miner', { now: i * 50, volume: .22 });
    assert.ok(player.status().activeVoices <= 16);
  }
  assert.equal(player.play('player-hit', { now: 4900, volume: .14 }).played, true);
  assert.ok(AudioProbe.voices.filter(voice => !voice.paused).length <= 16);
  player.setBusLevels({ sfxVolume: 0 });
  player.play('hmh-fire-coin-blaster', { now: 5000, volume: .22 });
  assert.equal(AudioProbe.voices.at(-1).volume, 0);
  player.pause();
  assert.ok(AudioProbe.voices.every(voice => voice.paused));
  assert.equal(player.play('hmh-fire-coin-blaster', { now: 6000 }).played, false);
  player.destroy();
});

test('creature deaths, melee and ranged warnings, and each boss beat have distinct original samples', () => {
  AudioProbe.voices=[];
  const player=createCombatAudio({AudioCtor:AudioProbe});
  const cues=['enemy-death','enemy-melee-tell','enemy-ranged-tell','boss-phase','boss-hit','boss-death','dash','footstep-dirt','footstep-road'];
  for(const [i,cue] of cues.entries())assert.equal(player.play(cue,{now:i*1500}).played,true,cue);
  const hashes=AudioProbe.voices.map(voice=>createHash('sha256').update(pcm(voice.src).bytes).digest('hex'));
  assert.equal(new Set(hashes).size,cues.length);
  player.destroy();
});

// Dry fire. The shipped input model carries no trigger: input.mjs writes
// fire:false into every snapshot ("retiring manual combat extras"), so
// aimIntent.fire is the autofire request. It rises when aim activates or a
// target is acquired and never on a button press, which means a click keyed
// off that edge would sound on a mouse wake and stay silent on a real press.
// This drives the real input, aim and weapon modules to prove both halves,
// and pins the runtime to 'hmh-weapon-empty' on the authoritative
// 'weapon:auto-fallback' event only.
test('the input model carries no trigger edge, so hmh-weapon-empty stays on the authoritative auto-fallback', async () => {
  const { InputState, POINTER_AIM_IDLE_MS } = await import('../apps/hmh-reboot/src/input.mjs');
  const { createAimState, resolveAimIntent } = await import('../apps/hmh-reboot/src/aim.mjs');
  const { createCameraState } = await import('../apps/hmh-reboot/src/world-space.mjs');
  const { getWeaponReadabilityStatus } = await import('../apps/hmh-reboot/src/weapon-system.mjs');
  const actor = { x: 100, y: 100, z: 0, visualLiftZ: 0 };
  const context = { actor, camera: createCameraState({ x: 100, y: 100 }), viewport: { width: 800, height: 600 } };
  const input = new InputState();
  const aim = createAimState({ autoFireEnabled: true });
  const intents = [];
  let tick = 0;
  const step = (nowMs, targets) => {
    const snapshot = input.snapshot({ ...context, nowMs });
    assert.equal(snapshot.actions.fire, false, 'the retired trigger never reaches the simulation');
    assert.equal(snapshot.heldActions.fire, false);
    const intent = resolveAimIntent(aim, { tick: tick++, actor, input: snapshot.actions, targets });
    intents.push(intent);
    return intent;
  };
  const risingEdge = () => intents.length > 1 && intents.at(-1).fire && !intents.at(-2).fire;

  // Pointer aim with no target: aiming is the fire request.
  input.setPointer({ screenX: 700, screenY: 300, fire: false }, 0);
  const aiming = step(5, []);
  assert.deepEqual([aiming.fire, aiming.automatic, aiming.source], [true, false, 'manual']);
  // A real left-button press changes nothing: no rising edge to click on.
  input.setPointer({ screenX: 700, screenY: 300, fire: true }, 10);
  const pressed = step(15, []);
  assert.equal(pressed.fire, true);
  assert.equal(risingEdge(), false, 'a genuine press never produces an edge');
  input.setPointer({ screenX: 700, screenY: 300, fire: false }, 20);
  input.setPointer({ screenX: 700, screenY: 300, fire: true }, 30);
  step(35, []);
  assert.equal(risingEdge(), false, 'a re-press never produces an edge either');
  // The only edge the runtime can observe is aim activation: the pointer
  // goes idle for POINTER_AIM_IDLE_MS, then moves with no button held.
  input.setPointer({ screenX: 700, screenY: 300, fire: false }, 40);
  const idle = step(40 + POINTER_AIM_IDLE_MS + 1, []);
  assert.equal(idle.fire, false);
  input.setPointer({ screenX: 710, screenY: 300, fire: false }, 40 + POINTER_AIM_IDLE_MS + 10);
  const woken = step(40 + POINTER_AIM_IDLE_MS + 15, []);
  assert.deepEqual([woken.fire, woken.automatic, risingEdge()], [true, false, true], 'a mouse wake with no button is the "manual" edge');
  // With a target in range autofire holds fire high through a whole reload,
  // so no press, release or re-press during it could ever click.
  const targets = [{ id: 'e1', x: 300, y: 100, active: true }];
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster'], seed: 17 });
  let reloadTicks = 0;
  let edges = 0;
  for (let i = 0; i < 232; i++) {
    const at = 3000 + i * 16;
    input.setPointer({ screenX: 700, screenY: 300, fire: i % 3 === 0 }, at);
    const intent = step(at + 1, targets);
    if (risingEdge()) edges += 1;
    stepWeaponLoadout(state, { tick: i + 1, fire: intent.fire, direction: intent.direction });
    if (getWeaponReadabilityStatus(state, { tick: i + 1 }).mode === 'reloading') reloadTicks += 1;
  }
  assert.equal(reloadTicks, 90, 'the pistol reloaded once inside the loop');
  assert.equal(edges, 0, 'autofire on a target leaves no edge for a click');

  // Hence the runtime never derives a click: the empty cue plays once, on
  // the auto-fallback event, through the one combat audio player.
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.equal(source.match(/play\('hmh-weapon-empty'/g).length, 1, 'exactly one hmh-weapon-empty play site');
  assert.match(source, /event\.type === 'weapon:auto-fallback'[\s\S]{0,160}play\('hmh-weapon-empty'/);
  assert.doesNotMatch(source, /lastFireIntent|resolveDryFireClick|DRY_FIRE_CLICK/, 'no projection trigger edge in the runtime');
  assert.doesNotMatch(source, /new Audio\('[^']*weapon-empty/, 'no second player path for the click');
  const weaponAudio = await import('../apps/hmh-reboot/src/weapon-audio.mjs');
  assert.equal(weaponAudio.resolveDryFireClick, undefined, 'the initial-JS audio registry carries no click predicate');
});

test('the reload-complete chamber glow keys off the same authoritative event as the cue and resets with the run', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /event\.type === 'weapon:reload-complete'[\s\S]{0,160}play\('reload-complete'[\s\S]{0,320}lastReloadComplete = \{ tick, weaponId: event\.weaponId \};/);
  assert.match(source, /lastWeaponFire = null;\s*lastReloadComplete = null;/);
});
