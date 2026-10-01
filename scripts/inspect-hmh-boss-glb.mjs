// Slice HMH-BOSSES-2-4: refresh each district boss's measured manifest and
// committed receipts from the real exported bytes, Blender's independent
// re-import, and the private source receipts under .tmp/hmh-boss-native/.
// Also archives the editable .blend outside Git with a SHA-256 receipt.
//   node scripts/inspect-hmh-boss-glb.mjs [--archive-root=<dir>]
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectActorGlb } from './lib/hmh-actor-glb.mjs';
import { decodeActor3dGlb } from '../apps/hmh-reboot/src/actor-3d-model.mjs';

export const BOSS_GLB_IDS = Object.freeze(['boss-rug-pull-baron', 'boss-51-foreman', 'boss-lockkeeper']);
export const BOSS_REQUIRED_CLIPS = Object.freeze(['idle', 'run', 'tell', 'attack', 'attack-2', 'super-tell', 'super', 'hit', 'stagger', 'death']);
const DEFAULT_ARCHIVE = 'C:/Users/just_/Desktop/Projects/LestersArcade-Assets/2.0/Source/Legacy-Integration-04366747/apps/hmh-reboot/assets/source/models/native-enemies';

const root = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const archiveRoot = (process.argv.find(arg => arg.startsWith('--archive-root=')) ?? `--archive-root=${DEFAULT_ARCHIVE}`).slice('--archive-root='.length);

for (const id of BOSS_GLB_IDS) {
  const lane = new URL(`.tmp/hmh-boss-native/${id}/`, root);
  const source = JSON.parse(readFileSync(new URL('source-receipt.json', lane)));
  const exported = JSON.parse(readFileSync(new URL('export-receipt.json', lane)));
  const reimport = JSON.parse(readFileSync(new URL(`verify/${id}-reimport.json`, lane)));
  const bytes = readFileSync(new URL(`apps/portal/assets/generated/hmh-actor-3d-pilot/${id}.glb`, root));
  const glbSha = sha(bytes);
  if (exported.sha256 !== glbSha || reimport.glbSha256 !== glbSha) throw new Error(`${id}: export/reimport receipts do not match the runtime bytes`);
  const blend = readFileSync(new URL(source.source, lane));
  if (sha(blend) !== source.sourceSha256 || exported.sourceSha256 !== source.sourceSha256) throw new Error(`${id}: private source changed after export`);
  decodeActor3dGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const inspection = inspectActorGlb(bytes, { requiredClips: BOSS_REQUIRED_CLIPS });

  // The editable source leaves Git: archived beside the other native enemies.
  const archiveDir = `${archiveRoot}/${id}`;
  mkdirSync(archiveDir, { recursive: true });
  const archived = `${archiveDir}/${source.source}`;
  copyFileSync(fileURLToPath(new URL(source.source, lane)), archived);
  writeFileSync(`${archiveDir}/source-receipt.json`, json(source));
  const archivedSha = sha(readFileSync(archived));
  if (archivedSha !== source.sourceSha256) throw new Error(`${id}: archived source hash mismatch`);

  const receiptDir = new URL(`apps/hmh-reboot/assets/source/models/native-enemies/${id}/`, root);
  mkdirSync(receiptDir, { recursive: true });
  writeFileSync(new URL('source-receipt.json', receiptDir), json(source));
  writeFileSync(new URL('archive-receipt.json', receiptDir), json({
    schema: 1, actorId: id, sourceInGit: false, source: source.source, sourceSha256: source.sourceSha256, sourceBytes: blend.length,
    archivedTo: archived.replace(/^C:\/Users\/[^/]+\//, '~/'), archivedSha256: archivedSha, archivedUnchanged: archivedSha === source.sourceSha256,
  }));
  writeFileSync(new URL(`docs/2.0/receipts/${id}-glb-reimport.json`, root), json(reimport));
  const manifest = {
    schema: 1, classification: 'unapproved-runtime-boss-export', activeRuntimeIntegration: false, cameraDegreesFromVertical: 55,
    groundPivot: 'existing-world-foot-position', simulationAuthority: 'none',
    actors: { [id]: {
      file: `${id}.glb`, sha256: glbSha, sourceSha256: source.sourceSha256, sourceBytes: blend.length,
      sourceTriangles: source.sourceTriangles, ownerSource: source.ownerSource, ownerSourceSha256: source.ownerSourceSha256,
      height: source.height, heroHeightRatio: source.heroHeightRatio, identityForm: source.identityForm,
      requiredClips: [...BOSS_REQUIRED_CLIPS], inspection,
      maximumNativeFootResidualMetres: reimport.maximumNativeFootResidualMetres,
    } },
  };
  writeFileSync(new URL(`apps/portal/assets/generated/hmh-actor-3d-pilot/${id}-manifest.json`, root), json(manifest));
  console.log(`${id}: ${inspection.bytes} B, ${inspection.triangles} tris, ${inspection.vertices} verts, ${inspection.clips.length} clips, archived ${archivedSha.slice(0, 12)}`);
}
if (!existsSync(new URL('docs/2.0/receipts/', root))) throw new Error('receipt directory missing');
