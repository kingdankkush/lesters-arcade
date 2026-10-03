// Refresh a measured pilot manifest from real exported bytes and Blender's
// independent re-import receipts. No Git or simulation modules are involved.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectActorGlb } from './lib/hmh-actor-glb.mjs';
import { decodeActor3dGlb } from '../apps/hmh-reboot/src/actor-3d-model.mjs';

const root = new URL('../', import.meta.url);
const directory = new URL('apps/portal/assets/generated/hmh-actor-3d-pilot/', root);
const scratch = new URL('.tmp/hmh-actor-3d-pilot/', root);
const receiptDirectory = new URL('docs/2.0/receipts/', root);
mkdirSync(receiptDirectory, { recursive: true });
const bossOnly = process.argv.slice(2).join(' ') === '--actor=the-liquidator';
const heroId = ['lilly', 'lit-valkyrie', 'lester-original'].find(id => process.argv.slice(2).join(' ') === `--actor=${id}`);
const enemyId = ['forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist', 'rug-puller', 'pump-and-dump-bloater', 'tollkeeper', 'hodl-revenant', 'money-printer', 'oracle-marksman'].find(id => process.argv.slice(2).join(' ') === `--actor=${id}`);
if (process.argv.length > 2 && !bossOnly && !heroId && !enemyId) throw new Error('unknown alternate actor export manifest');
const required = enemyId ? { [enemyId]: ['idle', 'run', 'tell', 'attack', 'hit', 'death'] } : heroId ? { [heroId]: ['idle', 'run', 'aim', 'pistol-fire', 'hurt', 'dash', 'melee', 'grenade', 'death'] } : bossOnly ? { 'the-liquidator': ['idle', 'run', 'tell', 'attack', 'hit', 'death'] } : {
  'lit-commando': ['idle', 'run', 'aim', 'pistol-fire', 'hurt', 'dash', 'melee', 'grenade', 'death'],
  'bagholder-rusher': ['idle', 'run', 'tell', 'attack', 'hit', 'death'],
};
const actors = {};
const HERO_IDS = ['lit-commando', 'lilly', 'lit-valkyrie', 'lester-original'];
const readJson = url => { try { return JSON.parse(readFileSync(url)); } catch { return null; } };
for (const [actorId, baseClips] of Object.entries(required)) {
  const bytes = readFileSync(new URL(`${actorId}.glb`, directory));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  // Heroes carry the authored clip library after their nine native clips; every
  // library clip is required so a dropped animation fails the manifest gate.
  const library = HERO_IDS.includes(actorId) ? readJson(new URL(`${actorId}-clips.json`, directory)) : null;
  if (library && library.glbSha256 !== sha256) throw new Error(`${actorId}-clips.json does not describe the current GLB bytes`);
  const requiredClips = library ? [...baseClips, ...library.libraryClips.map(clip => clip.name)] : baseClips;
  const deaths = readJson(new URL(`${actorId}-deaths.json`, directory));
  if (deaths) {
    if (deaths.glbSha256 !== sha256 || deaths.authority !== 'presentation-only') throw new Error('Native death receipt does not match runtime bytes');
    for (const clip of deaths.requiredClips) if (!requiredClips.includes(clip)) requiredClips.push(clip);
  }
  // The immutable .blend inspection only changes when the source changes; when
  // the scratch receipt is absent, carry the previously measured source identity.
  const previousManifest = readJson(new URL(HERO_IDS.includes(actorId) && actorId !== 'lit-commando' ? `${actorId}-manifest.json` : 'manifest.json', directory))?.actors?.[actorId];
  const source = readJson(new URL(`${actorId}-inspection.json`, scratch)) ?? (previousManifest && { sourceSha256: previousManifest.sourceSha256, sourceBytes: previousManifest.sourceBytes, meshes: [{ triangles: previousManifest.sourceTriangles }] });
  if (!source) throw new Error(`no source inspection for ${actorId}`);
  // A re-import receipt must describe these exact bytes; a scratch receipt wins,
  // otherwise the committed receipt is accepted only when its digest still matches.
  const committedReimport = readJson(new URL(`${actorId}-glb-reimport.json`, receiptDirectory));
  const reimport = readJson(new URL(`${actorId}-reimport.json`, scratch)) ?? (committedReimport?.glbSha256 === sha256 ? committedReimport : null);
  if (!reimport) throw new Error(`no re-import receipt for the current ${actorId}.glb bytes`);
  if (reimport.glbSha256 !== sha256 || reimport.verification !== 'offline-Blender-reimport-not-runtime') throw new Error('re-import receipt does not match runtime bytes');
  actors[actorId] = { file: `${actorId}.glb`, sha256, sourceSha256: source.sourceSha256,
    sourceBytes: source.sourceBytes, sourceTriangles: source.meshes.reduce((sum, mesh) => sum + mesh.triangles, 0),
    requiredClips, inspection: inspectActorGlb(bytes, { requiredClips }),
    ...(library ? { clipLibrary: { manifest: `${actorId}-clips.json`, nativeClips: baseClips.length, libraryClips: library.libraryClips.length, fidgets: library.fidgets, libraryBytes: library.libraryBytes } } : {}),
    ...(deaths ? { deathVariants: { manifest:`${actorId}-deaths.json`,clips:['death',deaths.variant],selection:'stable-presentation-identity-fnv1a' } } : {}) };
  if (bossOnly) {
    if (source.phase !== 'market-open' || source.sourceSha256 !== '56a9e240a8cc053f09e2ef95046bf84520ffa65ec561c5dec5e1f46c6ebed574'
      || createHash('sha256').update(readFileSync(new URL(source.source,root))).digest('hex') !== source.sourceSha256) throw new Error('real opening-phase boss source identity mismatch');
    actors[actorId].drawInventory = inspectActorGlb(bytes, { requiredClips, includeDrawInventory: true }).drawInventory;
    try {
      decodeActor3dGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
      actors[actorId].currentRuntimeDecoder = { supported: true, loaderExtended: false };
    } catch(error) { actors[actorId].currentRuntimeDecoder = { supported: false, loaderExtended: false, reason: error.message }; }
    actors[actorId].sourceInspection = { selectedMeshes: source.meshes.length, excludedPhaseMeshes: source.excludedPhaseMeshes.map(mesh=>mesh.name),
      materials: source.materials, rawTriangles: source.meshes.reduce((sum,mesh)=>sum+mesh.triangles,0),
      evaluatedTriangles: source.meshes.reduce((sum,mesh)=>sum+mesh.evaluatedTriangles,0) };
    const exported = JSON.parse(readFileSync(new URL(`${actorId}-export.json`,scratch)));
    if(exported.export.sha256 !== sha256) throw new Error('export optimization receipt does not match runtime bytes');
    actors[actorId].sourceConstantPbrFallbacks = exported.export.sourceConstantPbrFallbacks;
    const json = JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))), allPrimitives = json.meshes.flatMap(mesh=>mesh.primitives);
    actors[actorId].runtimeIncompatibilities = {
      primitiveCount: allPrimitives.length, currentPrimitiveLimit:6,
      primitivesMissingUv: allPrimitives.filter(p=>p.attributes.TEXCOORD_0===undefined).length,
      primitivesMissingTangents: allPrimitives.filter(p=>p.attributes.TANGENT===undefined).length,
      scope:'measured source/export layout; runtime packing/UV/material bake remains a separate prerequisite, no loader limit change' };
  }
  writeFileSync(new URL(`${actorId}-glb-reimport.json`, receiptDirectory), JSON.stringify(reimport, null, 2) + '\n');
}
const manifest = { schema: 1, classification: bossOnly ? 'unapproved-runtime-boss-export' : 'unapproved-runtime-character-pilot',
  activeRuntimeIntegration: false, cameraDegreesFromVertical: 55,
  groundPivot: 'existing-world-foot-position', simulationAuthority: 'none', actors };
if (bossOnly) {
  manifest.phase = 'market-open';
  const two = JSON.parse(readFileSync(new URL('manifest.json',directory))).actors;
  const fleet = [['lit-commando',1,two['lit-commando']],['bagholder-rusher',60,two['bagholder-rusher']],['the-liquidator',1,actors['the-liquidator']]];
  manifest.fleetAssetEstimate = { bodies:62, visibleBodiesObserved:null, actualGpuDrawsObserved:null, perBodyUpdateCadenceObserved:null,
    trianglesIfAllExportedPrimitivesVisible:fleet.reduce((sum,[,count,actor])=>sum+count*actor.inspection.triangles,0),
    upperBoundMeshSubmissions:fleet.reduce((sum,[id,count,actor])=>sum+count*(actor.drawInventory ?? inspectActorGlb(readFileSync(new URL(`${id}.glb`,directory)),{includeDrawInventory:true}).drawInventory).primitives.length,0),
    sharedTextureRgba8EstimateBytes:fleet.reduce((sum,[,,actor])=>sum+actor.inspection.textureBytesRgba8,0),
    sharedTextureRgba8WithMipmapsEstimateBytes:fleet.reduce((sum,[,,actor])=>sum+actor.inspection.textureBytesRgba8Mipmaps,0),
    scope:'static asset arithmetic; models shared within archetype, excludes world, driver, decode and framebuffer memory; no frame/performance proof' };
}
const outputName = enemyId ? `${enemyId}-manifest.json` : heroId ? `${heroId}-manifest.json` : bossOnly ? 'the-liquidator-manifest.json' : 'manifest.json';
if (outputName === 'manifest.json') {
  // The shipped Liquidator entry in manifest.json was produced by the corrected
  // boss export (its own receipt shape), not by this two-actor run. Carry any
  // such entry forward instead of dropping it; its bytes stay test-verified.
  let previous = {};
  try { previous = JSON.parse(readFileSync(new URL('manifest.json', directory))).actors ?? {}; } catch {}
  for (const [actorId, actor] of Object.entries(previous)) if (!(actorId in actors)) actors[actorId] = actor;
}
writeFileSync(new URL(outputName, directory), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Measured actor pilot: ${fileURLToPath(new URL(outputName, directory))}`);
