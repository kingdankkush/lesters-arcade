// Refresh a measured pilot manifest from real exported bytes and Blender's
// independent re-import receipts. No Git or simulation modules are involved.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectActorGlb } from './lib/hmh-actor-glb.mjs';

const root = new URL('../', import.meta.url);
const directory = new URL('apps/portal/assets/generated/hmh-actor-3d-pilot/', root);
const scratch = new URL('.tmp/hmh-actor-3d-pilot/', root);
const receiptDirectory = new URL('docs/2.0/receipts/', root);
mkdirSync(receiptDirectory, { recursive: true });
const required = {
  'lit-commando': ['idle', 'run', 'aim', 'pistol-fire', 'hurt', 'dash', 'melee', 'grenade', 'death'],
  'bagholder-rusher': ['idle', 'run', 'tell', 'attack', 'hit', 'death'],
};
const actors = {};
for (const [actorId, requiredClips] of Object.entries(required)) {
  const bytes = readFileSync(new URL(`${actorId}.glb`, directory));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const source = JSON.parse(readFileSync(new URL(`${actorId}-inspection.json`, scratch)));
  const reimport = JSON.parse(readFileSync(new URL(`${actorId}-reimport.json`, scratch)));
  if (reimport.glbSha256 !== sha256 || reimport.verification !== 'offline-Blender-reimport-not-runtime') throw new Error('re-import receipt does not match runtime bytes');
  actors[actorId] = { file: `${actorId}.glb`, sha256, sourceSha256: source.sourceSha256,
    sourceBytes: source.sourceBytes, sourceTriangles: source.meshes.reduce((sum, mesh) => sum + mesh.triangles, 0),
    requiredClips, inspection: inspectActorGlb(bytes, { requiredClips }) };
  writeFileSync(new URL(`${actorId}-glb-reimport.json`, receiptDirectory), JSON.stringify(reimport, null, 2) + '\n');
}
const manifest = { schema: 1, classification: 'unapproved-runtime-character-pilot',
  activeRuntimeIntegration: false, cameraDegreesFromVertical: 55,
  groundPivot: 'existing-world-foot-position', simulationAuthority: 'none', actors };
writeFileSync(new URL('manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Measured actor pilot: ${fileURLToPath(new URL('manifest.json', directory))}`);
