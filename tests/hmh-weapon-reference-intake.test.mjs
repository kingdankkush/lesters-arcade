import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSourceReference } from './shared/validate-lfs-pointer.mjs';

const root = resolve(import.meta.dirname, '..');
const base = 'apps/hmh-reboot/assets/source/reference/weapons';
const expected = {
  'sci-fi-grenade': 'Sci-Fi Grenade Turnaround Sheet.png',
  'spiked-steampunk-grenade': 'Spiked Steampunk Grenade Turntable Sheet.png',
  'weathered-military-grenade': 'Weathered Military Grenade Turnaround Views.png',
  'rugged-rifle': 'Rugged Rifle Concept Showcase.png',
  'sci-fi-grenade-launcher': 'Sci-Fi Grenade Launcher Model Sheet.png',
  'rugged-survival-knife': 'Rugged Survival Knife Reference Sheet.png',
  'steampunk-raygun': 'Steampunk Raygun Six-View Asset Sheet.png',
  'rugged-shotgun': 'Rugged Post-Apocalyptic Shotgun Showcase.png',
  'worn-heavy-machine-gun': 'Worn Heavy Machine Gun Reference Sheet.png',
  'weathered-smg': 'Weathered Post-Apocalyptic SMG Concept Sheet.png',
  'rugged-handgun': 'Rugged Futuristic Handgun Turnaround Sheet.png',
};

test('all eleven owner weapon sheets are preserved with exact provenance outside runtime', () => {
  const path = resolve(root, base, 'references.json');
  assert.ok(existsSync(path), 'missing weapon reference intake manifest');
  const ledger = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(ledger.schema, 'hmh-weapon-reference-intake-v1');
  assert.equal(ledger.runtimeAuthority, 'none');
  assert.equal(ledger.authority, 'owner-supplied-design-reference');
  assert.deepEqual(ledger.assets.map(a => a.assetId).sort(), Object.keys(expected).sort());
  assert.equal(new Set(ledger.assets.map(a => a.image.path)).size, 11);
  for (const asset of ledger.assets) {
    const image = asset.image;
    assert.equal(image.originalFilename, expected[asset.assetId]);
    assert.equal(image.path, `${base}/${asset.assetId}/sheet.png`);
    const data = readFileSync(resolve(root, image.path));
    validateSourceReference(data, image);
    assert.equal(asset.modelStatus, 'not-generated');
    assert.equal(asset.runtimeId, null, 'reference filenames do not authorize new gameplay IDs');
  }
});

test('weapon references inherit source-only LFS policy', () => {
  assert.match(readFileSync(resolve(root, '.gitattributes'), 'utf8'), /^apps\/hmh-reboot\/assets\/source\/reference\/\*\*\/\*\.png filter=lfs diff=lfs merge=lfs -text$/m);
  assert.ok(!base.includes('apps/portal/'));
});
