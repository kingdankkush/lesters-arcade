import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json');
const exporterPath = path.join(root, 'scripts/hmh-blender/export-hmh-production-hero-pilot.py');
const generatedRoot = path.join(root, 'apps/portal/assets/generated/hmh-reboot-production-heroes');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const expectedProfileIds = new Map([
  ['lit-commando', 'heavy-vanguard-motion-v1'],
  ['lit-valkyrie', 'agile-striker-motion-v1'],
  ['lester-original', 'scrappy-gunslinger-motion-v1'],
  ['lilly', 'disciplined-veteran-motion-v1'],
]);

const numericFields = [
  'idleBreathScale',
  'runStrideScale',
  'runLiftScale',
  'recoilScale',
  'hurtScale',
  'dashScale',
  'meleeScale',
  'grenadeScale',
  'deathSide',
];

test('all four production heroes declare distinct bounded animation profiles', () => {
  assert.equal(manifest.pilots.length, 4);
  const serialized = new Set();
  for (const pilot of manifest.pilots) {
    const profile = pilot.animationProfile;
    assert.ok(profile, `${pilot.actorId} is missing animationProfile`);
    assert.equal(profile.id, expectedProfileIds.get(pilot.actorId));
    assert.equal(pilot.runtimeAuthority, 'projection-only');
    assert.equal(pilot.gameplayBodyProfile, 'human-medium-collision-v1');
    for (const field of numericFields) {
      assert.equal(Number.isFinite(profile[field]), true, `${pilot.actorId}.${field} must be finite`);
    }
    assert.ok(profile.idleBreathScale >= 0.7 && profile.idleBreathScale <= 1.4);
    assert.ok(profile.runStrideScale >= 0.8 && profile.runStrideScale <= 1.3);
    assert.ok(profile.runLiftScale >= 0.7 && profile.runLiftScale <= 1.4);
    for (const field of ['recoilScale', 'hurtScale', 'dashScale', 'meleeScale', 'grenadeScale']) {
      assert.ok(profile[field] >= 0.7 && profile[field] <= 1.4, `${pilot.actorId}.${field} out of bounds`);
    }
    assert.ok(profile.deathSide === -1 || profile.deathSide === 1);
    serialized.add(JSON.stringify(profile));
  }
  assert.equal(serialized.size, 4, 'hero motion profiles must not collapse to one shared profile');
});

test('Blender exporter consumes profile parameters across locomotion and action poses', () => {
  const source = readFileSync(exporterPath, 'utf8');
  assert.match(source, /def apply_pose\([^)]*animation_profile/);
  assert.match(source, /apply_pose\([^\n]*pilot\["animationProfile"\]/);
  for (const field of numericFields) {
    assert.match(source, new RegExp(`animation_profile\\["${field}"\\]`), `exporter must consume ${field}`);
  }
});

test('generated atlas metadata and metrics preserve exact animation profile provenance', () => {
  for (const pilot of manifest.pilots) {
    const output = pilot.output;
    const metadata = JSON.parse(readFileSync(path.join(generatedRoot, output.metadata), 'utf8'));
    const metrics = JSON.parse(readFileSync(path.join(generatedRoot, output.metrics), 'utf8'));
    assert.deepEqual(metadata.animationProfile, pilot.animationProfile, `${pilot.actorId} atlas profile drift`);
    assert.deepEqual(metrics.animationProfile, pilot.animationProfile, `${pilot.actorId} metrics profile drift`);
  }
});
