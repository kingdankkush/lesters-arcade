import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSourceReference } from './shared/validate-lfs-pointer.mjs';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'apps/hmh-reboot/assets/source/reference/heroes/references.json');
const actorIds = ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly'];


test('owner hero reference intake preserves all eight source images with pixel dimensions and exact provenance', () => {
  assert.ok(existsSync(manifestPath), 'missing committed reference intake manifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.schema, 'hmh-hero-reference-intake-v1');
  assert.equal(manifest.authority, 'owner-supplied-design-reference');
  assert.equal(manifest.runtimeAuthority, 'none');
  assert.deepEqual(manifest.heroes.map(hero => hero.actorId).sort(), [...actorIds].sort());
  const paths = new Set();
  for (const hero of manifest.heroes) {
    assert.deepEqual(Object.keys(hero.images).sort(), ['front', 'turnaround']);
    for (const role of ['front', 'turnaround']) {
      const image = hero.images[role];
      assert.equal(image.path, `apps/hmh-reboot/assets/source/reference/heroes/${hero.actorId}/${role}.png`);
      assert.ok(!paths.has(image.path), `duplicate ${image.path}`);
      paths.add(image.path);
      const bytes = readFileSync(resolve(root, image.path));
      validateSourceReference(bytes, image);
      assert.ok(image.originalFilename.endsWith('.png'));
    }
  }
  assert.equal(paths.size, 8);
});

test('owner hero references use LFS and remain outside the portal runtime tree', () => {
  const attributes = readFileSync(resolve(root, '.gitattributes'), 'utf8');
  assert.match(attributes, /^apps\/hmh-reboot\/assets\/source\/reference\/\*\*\/\*\.png filter=lfs diff=lfs merge=lfs -text$/m);
  assert.ok(!manifestPath.includes('apps/portal/assets/'));
});
