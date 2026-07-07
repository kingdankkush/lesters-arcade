import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

const manifest = JSON.parse(readFileSync(repoPath('docs/art/canon/hero-canon-manifest.json'), 'utf8'));

const REQUIRED_DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const REQUIRED_STATES = ['idle', 'walk', 'run', 'shoot-pistol', 'shoot-shotgun', 'shoot-mg', 'melee', 'throw-grenade', 'hurt', 'death', 'dash', 'victory'];

test('WO-92 hero canon manifest captures Justin-approved Lester and Lilly refs', () => {
  assert.equal(manifest.id, 'hmh-hero-canon-refs-v1');
  assert.equal(manifest.productionTarget.approval.includes('Justin approved'), true);
  assert.deepEqual(manifest.productionTarget.directions, REQUIRED_DIRECTIONS);
  assert.deepEqual(manifest.productionTarget.states, REQUIRED_STATES);
  assert.equal(manifest.heroes.lester.count >= 19, true, `expected at least 19 Lester refs, got ${manifest.heroes.lester.count}`);
  assert.equal(manifest.heroes.lilly.count >= 19, true, `expected at least 19 Lilly refs, got ${manifest.heroes.lilly.count}`);
});

test('WO-92 canon refs have unique ids, repo-local files, previews, and contact sheets', () => {
  for (const hero of ['lester', 'lilly']) {
    const heroManifest = manifest.heroes[hero];
    assert.equal(existsSync(repoPath(heroManifest.contactSheet)), true, `${hero} contact sheet should exist`);
    const ids = new Set();
    const repoPaths = new Set();
    for (const entry of heroManifest.entries) {
      assert.equal(ids.has(entry.id), false, `${hero} duplicate id ${entry.id}`);
      assert.equal(repoPaths.has(entry.repo_path), false, `${hero} duplicate repo path ${entry.repo_path}`);
      ids.add(entry.id);
      repoPaths.add(entry.repo_path);
      assert.equal(existsSync(repoPath(entry.repo_path)), true, `${entry.repo_path} should exist`);
      assert.equal(existsSync(repoPath(entry.preview_path)), true, `${entry.preview_path} should exist`);
      assert.equal(entry.width > 0 && entry.height > 0, true, `${entry.id} dimensions should be positive`);
    }
  }
});

test('WO-92 canon refs cover hero identity sheets plus action/weapon pose refs', () => {
  for (const hero of ['lester', 'lilly']) {
    const entries = manifest.heroes[hero].entries;
    const roles = new Set(entries.map((entry) => entry.role));
    const directions = new Set(entries.map((entry) => entry.direction));
    assert.equal(roles.has('character-sheet'), true, `${hero} needs character sheet refs`);
    assert.equal(roles.has('idle'), true, `${hero} needs idle refs`);
    assert.equal(roles.has('walk'), true, `${hero} needs walk refs`);
    assert.equal(roles.has('run'), true, `${hero} needs run refs`);
    assert.equal(roles.has('grenade'), true, `${hero} needs grenade refs`);
    assert.equal(roles.has('machine-gun'), true, `${hero} needs machine gun refs`);
    assert.equal(roles.has('melee-knife'), true, `${hero} needs melee refs`);
    assert.equal(directions.has('south'), true, `${hero} needs front/south refs`);
    assert.equal(directions.has('east'), true, `${hero} needs right/east refs`);
    assert.equal(directions.has('west'), true, `${hero} needs left/west refs`);
  }
});
