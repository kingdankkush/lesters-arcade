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
// This is a latent trap rather than a live bug: the only Workbench pipeline is
// the enemy roster, and it does not use the helper today. The failure mode if
// someone copies it across is silently wrong shading in a 1,368-frame render,
// which is expensive to discover late. Cheap to prevent here.

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

test('the enemy roster still renders under Workbench', () => {
  // If this ever changes the policy below needs revisiting rather than the
  // assertion being updated to match.
  const manifest = readManifest('hmh-enemy-roster.json');
  assert.equal(manifest.render.engine, 'BLENDER_WORKBENCH');
});

test('prism_mesh has not spread into the Workbench enemy pipeline', () => {
  const enemyScripts = readdirSync(blenderDir).filter((name) => name.includes('enemy-roster'));
  assert.ok(enemyScripts.length > 0, 'expected the enemy roster builder to exist');
  for (const name of enemyScripts) {
    const source = readFileSync(`${blenderDir}${name}`, 'utf8');
    assert.ok(
      !source.includes('prism_mesh'),
      `${name} uses prism_mesh, whose caps face inward. EEVEE hides this; `
      + 'Workbench does not, so the roster would render inside-out. Fix the '
      + 'cap winding before reusing the helper here.',
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
