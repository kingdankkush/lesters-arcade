import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'apps', 'hmh-reboot', 'assets', 'source', 'blender', 'hmh-enemy-roster.json');
const exporterPath = path.join(root, 'scripts', 'hmh-blender', 'export-hmh-enemy-roster.py');
const generatedRoot = path.join(root, 'apps', 'portal', 'assets', 'generated', 'hmh-reboot-enemy-roster');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const exporterSource = readFileSync(exporterPath, 'utf8');

const expected = new Map([
  ['bagholder-rusher', 'snapback-stumble-v1'],
  ['forkrunner', 'crossed-fork-guard-break-v1'],
  ['liquidator-agent', 'rifle-shoulder-recoil-v1'],
  ['whale-enforcer', 'armored-shoulder-absorb-v1'],
  ['gas-bomber', 'canister-protective-stagger-v1'],
  ['validator-cultist', 'staff-braced-shock-v1'],
]);

test('all six ordinary enemy profiles own distinct damage responses', () => {
  const actual = new Map(manifest.actors
    .filter((actor) => actor.actorId !== 'the-liquidator')
    .map((actor) => [actor.actorId, actor.animationProfile?.damageResponse]));
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual.values()).size, 6);
});

test('enemy exporter consumes every authored damage response in the hit state', () => {
  assert.match(exporterSource, /damage_kind\s*=\s*actor\.get\("animationProfile", \{\}\)\.get\("damageResponse", "shared-impact-v1"\)/u);
  const hitStart = exporterSource.indexOf('elif state == "hit":');
  const deathStart = exporterSource.indexOf('elif state == "death":', hitStart);
  assert.ok(hitStart >= 0 && deathStart > hitStart, 'hit-state exporter branch missing');
  const hitBranch = exporterSource.slice(hitStart, deathStart);
  for (const damageResponse of expected.values()) {
    assert.ok(hitBranch.includes(`damage_kind == "${damageResponse}"`), `hit branch missing ${damageResponse}`);
  }
});

test('generated atlases preserve damage provenance and two distinct hit frames', () => {
  for (const [actorId, damageResponse] of expected) {
    const metadata = JSON.parse(readFileSync(path.join(generatedRoot, actorId, `${actorId}-roster-atlas.json`), 'utf8'));
    assert.equal(metadata.animationProfile?.damageResponse, damageResponse, `${actorId} generated damage profile is stale`);
    const hitFrames = metadata.frames.filter((frame) => frame.state === 'hit');
    assert.equal(hitFrames.length, 16, `${actorId} must keep two hit frames across eight directions`);
    for (const direction of manifest.directions) {
      const directional = hitFrames.filter((frame) => frame.direction === direction);
      assert.equal(directional.length, 2, `${actorId}/${direction} hit cadence drift`);
      assert.equal(new Set(directional.map((frame) => frame.sourcePixelSha256)).size, 2, `${actorId}/${direction} duplicated hit response`);
    }
  }
});
