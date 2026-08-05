import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  WEAPON_RECOIL_SHAKE,
  weaponRecoilShake,
  impactSprayAngles,
  IMPACT_SPRAY_CONE,
} from '../apps/hmh-reboot/src/combat-feedback.mjs';

const mainSource = readFileSync(
  fileURLToPath(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url)),
  'utf8',
);

// C2. Two concrete gaps in the impact/death feedback.
//
// Firing produced NO camera shake at all -- the only three shake sites were a
// grenade blast and two damage events -- so a pistol and a grenade launcher
// had identical recoil weight on screen. And impact sparks fanned at fully
// random angles, so a hit sprayed backwards into the shooter as often as away.
//
// Both are projection-only: they change what is drawn and never collision,
// damage, AI, spawning, RNG or progression.

const WEAPONS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig']);

test('every weapon declares a recoil shake magnitude', () => {
  for (const weaponId of WEAPONS) {
    const magnitude = weaponRecoilShake(weaponId);
    assert.ok(Number.isFinite(magnitude) && magnitude >= 0, `${weaponId} magnitude ${magnitude}`);
    assert.ok(WEAPON_RECOIL_SHAKE[weaponId] !== undefined, `${weaponId} missing from the table`);
  }
});

test('recoil weight is ordered by weapon class, not uniform', () => {
  const pistol = weaponRecoilShake('coin-blaster');
  const shotgun = weaponRecoilShake('scatter-shotgun');
  const minigun = weaponRecoilShake('auto-miner');
  const launcher = weaponRecoilShake('launcher-rig');
  assert.ok(launcher > shotgun, 'a launcher must outweigh a shotgun');
  assert.ok(shotgun > pistol, 'a shotgun must outweigh a pistol');
  // The minigun fires far faster than the rest, so its per-shot kick has to
  // stay small or sustained fire becomes an unreadable blur.
  assert.ok(minigun < pistol, 'sustained-fire recoil must be the lightest per shot');
  assert.equal(new Set([pistol, shotgun, minigun, launcher]).size, 4, 'weapons must not share a magnitude');
});

test('an unknown weapon degrades instead of throwing in the frame loop', () => {
  assert.ok(Number.isFinite(weaponRecoilShake('not-a-weapon')));
});

// Shake must never grow past the grenade blast, which is the authored ceiling
// for a projection-only camera offset.
test('no weapon out-shakes the grenade blast', () => {
  for (const weaponId of WEAPONS) {
    assert.ok(weaponRecoilShake(weaponId) <= 10, `${weaponId} exceeds the blast shake ceiling`);
  }
});

test('impact spray is directional rather than a full circle', () => {
  const direction = { x: 1, y: 0 };
  const angles = impactSprayAngles({ seed: 'a', direction, count: 12 });
  assert.equal(angles.length, 12);
  // Sparks fly back along the impact normal, so every angle sits within the
  // cone centred on the REVERSE of travel.
  const centre = Math.atan2(-direction.y, -direction.x);
  for (const angle of angles) {
    let delta = angle - centre;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    assert.ok(
      Math.abs(delta) <= IMPACT_SPRAY_CONE / 2 + 1e-9,
      `spark at ${angle.toFixed(3)} escaped the cone (delta ${delta.toFixed(3)})`,
    );
  }
});

test('impact spray follows the impact direction', () => {
  const right = impactSprayAngles({ seed: 'same', direction: { x: 1, y: 0 }, count: 6 });
  const up = impactSprayAngles({ seed: 'same', direction: { x: 0, y: 1 }, count: 6 });
  // Same seed, different direction: the fan must rotate with the hit, not
  // stay put. Otherwise it is decoration rather than feedback.
  assert.notDeepEqual(right, up);
});

test('impact spray is deterministic for replay', () => {
  const first = impactSprayAngles({ seed: 'replay-me', direction: { x: 0.6, y: -0.8 }, count: 9 });
  const second = impactSprayAngles({ seed: 'replay-me', direction: { x: 0.6, y: -0.8 }, count: 9 });
  assert.deepEqual(first, second);
});

test('a zero-length direction still produces a usable fan', () => {
  // A point-blank hit can resolve with no travel vector; the renderer must not
  // emit NaN angles into the graphics layer.
  const angles = impactSprayAngles({ seed: 'z', direction: { x: 0, y: 0 }, count: 5 });
  assert.equal(angles.length, 5);
  for (const angle of angles) assert.ok(Number.isFinite(angle), 'NaN angle');
});

test('weapon fire is wired to camera shake', () => {
  assert.match(mainSource, /triggerCameraShake\(tick, weaponRecoilShake\(/);
});

test('the impact renderer uses the directional spray', () => {
  assert.match(mainSource, /impactSprayAngles\(/);
});

// Recoil shake only draws when the screenShake setting is on, and standalone
// deliberately defaults it OFF: standalone is the evidence-capture path and
// stable visual baselines need no camera jitter. The portal path, which is how
// the game is actually played, defaults it on. Recorded here because the
// difference cost a real debugging detour -- the effect measured zero in a
// standalone probe while being correctly wired.
test('standalone keeps screen shake off and the portal keeps it on', () => {
  const standalone = readFileSync(
    fileURLToPath(new URL('../apps/hmh-reboot/src/standalone-session.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(standalone, /screenShake:\s*false/, 'standalone must keep evidence captures shake-free');
  const portal = readFileSync(
    fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)),
    'utf8',
  );
  assert.match(portal, /screenShake:\s*true/, 'the played path must have shake on by default');
});

// Without telemetry the effect is unobservable from outside: the visual gate
// captures a paused frame and may never land on an active shake, so per-weapon
// recoil could regress to zero silently.
test('camera shake exposes telemetry so it can be measured', () => {
  assert.match(mainSource, /dataset\.cameraShake\s*=/);
});
