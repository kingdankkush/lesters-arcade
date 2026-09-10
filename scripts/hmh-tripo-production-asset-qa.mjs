import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuthoredPropAtlasIndex, AUTHORED_PROP_ATLAS_METADATA_URL } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { createTripoPropAppearance, TRIPO_PROP_METADATA_URL } from '../apps/hmh-reboot/src/tripo-prop-appearance.mjs';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function auditTripoProductionAssets({ repoRoot = defaultRoot, assetRoot = null } = {}) {
  const portal = path.join(repoRoot, 'apps/portal');
  const directory = assetRoot ?? path.dirname(path.join(portal, TRIPO_PROP_METADATA_URL.replace(/^\//, '')));
  const metadata = readJson(path.join(directory, 'hmh-tripo-props.json'));
  const legacy = createAuthoredPropAtlasIndex(readJson(path.join(portal, AUTHORED_PROP_ATLAS_METADATA_URL.replace(/^\//, ''))));
  // Use the actual runtime validator for aliases, paths, rectangles, categories,
  // anchors and page limits. Pixel dimensions are independently decoded below.
  const textures = (metadata.pages ?? []).map(page => ({source:{pixelWidth:page.width,pixelHeight:page.height}}));
  const appearance = createTripoPropAppearance(metadata, textures, legacy);
  assert.equal(metadata.canonicalAdoption, true, 'native props lack canonical adoption');
  const adoption = metadata.adoption;
  assert.equal(adoption?.scope, 'local-runtime-evaluation', 'native props lack an adoption scope');
  for (const key of ['nativeReceiptSha256', 'visualReviewSha256', 'sourceCatalogSha256']) {
    assert.ok(validHash(adoption[key]), `native adoption provenance missing: ${key}`);
  }
  const producers = {
    intakeAndPacker: 'scripts/hmh_tripo_props.py',
    nativeRenderer: 'scripts/hmh-blender/export-hmh-tripo-props.py',
    orchestrator: 'scripts/run-hmh-tripo-props.py',
  };
  for (const [key, relative] of Object.entries(producers)) {
    assert.equal(adoption.nativeProducerSha256?.[key], sha(path.join(repoRoot, relative)), `native producer changed: ${key}`);
  }
  assert.equal(adoption.adoptionProducerSha256, sha(path.join(repoRoot, 'scripts/hmh_tripo_adoption.py')), 'native adoption producer changed');
  const result = spawnSync(process.env.PYTHON ?? 'python', [
    '-B', path.join(repoRoot, 'scripts/hmh-tripo-published-image-qa.py'), '--asset-root', directory,
  ], {cwd:repoRoot,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
  assert.equal(result.status, 0, `native Tripo image QA failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.framesVerified, metadata.assetCount, 'native decoded frame QA coverage');
  assert.equal(report.itemImagesVerified, metadata.assetCount, 'native item QA coverage');
  return {...report, boundCanonicalIds:appearance.size, metadataSha256:sha(path.join(directory, 'hmh-tripo-props.json'))};
}
