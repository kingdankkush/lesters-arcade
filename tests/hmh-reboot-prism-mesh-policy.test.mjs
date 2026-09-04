import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// prism_mesh writes both cap faces with a winding that points their normals
// INWARD. EEVEE flips the normal toward the viewer for non-culled backfaces,
// so it is invisible in the authored-props pipeline -- 53 assets ship on it,
// including every A2 plant. Workbench performs no such flip, so the identical
// geometry renders inside-out there.
//
// Cycle 072/073 moved the enemy roster to EEVEE (P-4), so no authored-asset
// pipeline renders under Workbench any more and the inside-out failure mode is
// currently unreachable. The policy is deliberately kept rather than retired:
// the caps are still wound inward, so the helper is still only correct by
// accident, and any future Workbench, Cycle-035-style determinism fallback,
// backface-culling material, or normal-dependent shader would expose it again.
// The tests below therefore assert the CONDITION the helper depends on (every
// pipeline that uses it renders under EEVEE) and keep the documentation pinned
// at the definition, rather than asserting a particular engine per pipeline.

const blenderDir = fileURLToPath(new URL('../scripts/hmh-blender/', import.meta.url));
const manifestDir = fileURLToPath(new URL('../apps/hmh-reboot/assets/source/blender/', import.meta.url));

const readManifest = (name) => JSON.parse(readFileSync(`${manifestDir}${name}`, 'utf8'));

test('the authored-props pipeline that uses prism_mesh renders under EEVEE', () => {
  const manifest = readManifest('hmh-authored-props.json');
  assert.equal(
    manifest.render.engine,
    'BLENDER_EEVEE',
    'prism_mesh relies on EEVEE flipping backface normals toward the viewer',
  );
});

test('Cycle 073 leaves no authored-asset pipeline rendering under Workbench', () => {
  // The enemy roster was the last Workbench pipeline. P-4 moved it to EEVEE so
  // heroes, enemies and props share one light rig and one engine. If a
  // pipeline is ever moved back, the prism_mesh caps below become a live bug
  // in whatever that pipeline renders, so revisit the winding rather than
  // updating this assertion to match.
  for (const name of ['hmh-enemy-roster.json', 'hmh-authored-props.json', 'hmh-production-heroes.json']) {
    assert.equal(readManifest(name).render.engine, 'BLENDER_EEVEE', `${name} must render under EEVEE`);
  }
});

test('prism_mesh has not spread beyond the pipeline whose engine hides its inward caps', () => {
  // Still a hygiene guard after the EEVEE flip: the caps remain wound inward,
  // so reusing the helper in a second pipeline copies geometry that is only
  // correct because of a renderer-specific backface flip. The enemy roster is
  // the pipeline most likely to grow a prop helper, and its render is 1,368
  // frames, so a late discovery is expensive.
  const enemyScripts = readdirSync(blenderDir).filter((name) => name.includes('enemy-roster'));
  assert.ok(enemyScripts.length > 0, 'expected the enemy roster builder to exist');
  for (const name of enemyScripts) {
    const source = readFileSync(`${blenderDir}${name}`, 'utf8');
    assert.ok(
      !source.includes('prism_mesh'),
      `${name} uses prism_mesh, whose caps face inward. Only EEVEE's backface `
      + 'normal flip hides that, so the geometry is correct by accident. Fix '
      + 'the cap winding before reusing the helper here.',
    );
  }
});

test('the inward-facing normals are documented where the helper is defined', () => {
  const source = readFileSync(`${blenderDir}create-hmh-authored-props.py`, 'utf8');
  const start = source.indexOf('def prism_mesh(');
  assert.ok(start > 0, 'prism_mesh definition not found');
  const docstring = source.slice(start, source.indexOf('"""', source.indexOf('"""', start) + 3));
  assert.match(docstring, /EEVEE ONLY/);
  assert.match(docstring, /INWARD/);
  assert.match(docstring, /Workbench/);
});
