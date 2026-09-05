/**
 * Bake the ground-decal placements into a runtime asset.
 *
 * The placements are pure derivations of the world contract, so they could be
 * computed in the child at boot -- and were, until the numbers came in. The
 * placement logic costs 4,451 B minified against a child bundle that had
 * 3,218 B of headroom left. The upgrade program is explicit that art fetched
 * at runtime does not consume bundle bytes while code work must come with size
 * accounting, so the derivation moves to build time and the child ships only
 * the small draw pass.
 *
 * Side benefit: the decals become reviewable data rather than an opaque
 * function, which is how the atlases already work.
 *
 * `npm run assets:hmh:world-decals`
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { AUTHORED_SETPIECE_ANCHORS } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { buildWorldDecals, DECAL_KINDS, MAX_WORLD_DECALS } from '../apps/hmh-reboot/src/world-decals.mjs';

const SEED = 0x484d4432;

// W-6 (Cycle 074): the composed set-piece anchors each get a ground ring. The
// anchors are read here at build time so the child never imports the prop
// composition into the decal module.
const decals = buildWorldDecals({ world: LEVEL_ONE_WORLD, seed: SEED, landmarks: AUTHORED_SETPIECE_ANCHORS });
// Same-input drift check, matching the other deterministic pipelines.
const again = buildWorldDecals({ world: LEVEL_ONE_WORLD, seed: SEED, landmarks: AUTHORED_SETPIECE_ANCHORS });
if (JSON.stringify(decals) !== JSON.stringify(again)) {
  throw new Error('world decals drifted across identical same-seed runs');
}
if (decals.length > MAX_WORLD_DECALS) {
  throw new Error(`world decals ${decals.length} exceeds the ${MAX_WORLD_DECALS} cap`);
}

const byKind = {};
for (const decal of decals) byKind[decal.kind] = (byKind[decal.kind] ?? 0) + 1;

const payload = {
  schemaVersion: 1,
  pipelineId: 'hmh-world-decals-v1',
  runtimeAuthority: 'projection-only',
  worldId: LEVEL_ONE_WORLD.id,
  seed: SEED,
  kinds: DECAL_KINDS,
  counts: byKind,
  note: 'Derived from the level-one world contract at build time. Baked rather than computed in the child because the placement logic did not fit the bundle budget; art fetched at runtime costs no bundle bytes.',
  decals,
};

const body = `${JSON.stringify(payload, null, 2)}\n`;
const outDir = fileURLToPath(new URL('../apps/portal/assets/generated/hmh-world-decals/', import.meta.url));
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}hmh-world-decals.json`, body, 'utf8');

console.log(JSON.stringify({
  status: 'pass',
  pipelineId: payload.pipelineId,
  decals: decals.length,
  cap: MAX_WORLD_DECALS,
  counts: byKind,
  bytes: Buffer.byteLength(body),
  sha256: createHash('sha256').update(body).digest('hex'),
}, null, 2));
