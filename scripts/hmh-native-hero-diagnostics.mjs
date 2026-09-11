import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PRODUCTION_HERO_ASSETS, PRODUCTION_HERO_RUNTIME_SCALE, createProductionHeroAtlasIndex, resolveProductionHeroPose } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';

// Inspect the delivered pixels using the same poses as the game. Source-render
// contact sheets can survive a later atlas replacement and are not this proof.
const clips = [
  ['idle', 2, 2], ['run', 6, 12], ['aim', 2, 2],
  ['pistol-fire', 3, 15], ['hurt', 2, 10], ['dash', 4, 15],
  ['melee', 5, 15], ['grenade', 5, 12], ['death', 6, 8],
];

export function buildHeroDiagnosticPlan(index) {
  const sample = pose => ({ pose, frameIds: resolveProductionHeroPose(index, pose).map(frame => frame.id) });
  return {
    actorId: index.actorId,
    runtimeScale: PRODUCTION_HERO_RUNTIME_SCALE,
    actions: clips.map(([id, count, fps]) => ({
      id, count, fps,
      samples: Array.from({ length: count * 8 }, (_, position) => {
        const frame = Math.floor(position / 8), direction = position % 8;
        const tick = Math.ceil(frame * 60 / fps);
        return { frame, direction, ...sample({ simulationTick: tick, actionTick: tick, locomotion: id === 'run' ? 'moving' : 'idle', legDirection: direction, torsoDirection: direction, action: ['idle', 'run', 'aim'].includes(id) ? 'aim' : id }) };
      }),
    })),
    waist: Array.from({ length: 64 }, (_, position) => sample({ simulationTick: 0, actionTick: 0, locomotion: 'idle', legDirection: Math.floor(position / 8), torsoDirection: position % 8, action: 'aim' })),
  };
}

function main() {
  const repoRoot = fileURLToPath(new URL('../', import.meta.url));
  const output = process.argv[2];
  if (!output) throw new Error('Usage: node scripts/hmh-native-hero-diagnostics.mjs <new-output-directory>');
  const outputRoot = path.resolve(output);
  mkdirSync(outputRoot, { recursive: false });
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const receipts = [];
  for (const asset of Object.values(PRODUCTION_HERO_ASSETS)) {
    const metadataPath = path.join(repoRoot, 'apps/portal', asset.metadataUrl);
    const imagePath = path.join(repoRoot, 'apps/portal', asset.imageUrl);
    const bytes = readFileSync(metadataPath), metadata = JSON.parse(bytes);
    const plan = buildHeroDiagnosticPlan(createProductionHeroAtlasIndex(metadata, asset));
    plan.inputs = { metadataPath, imagePath, metadataSha256: hash(bytes), imageSha256: hash(readFileSync(imagePath)) };
    const planPath = path.join(outputRoot, `${asset.actorId}-plan.json`);
    writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
    const render = spawnSync(process.env.PYTHON ?? 'python', [path.join(repoRoot, 'scripts/hmh_native_hero_diagnostics.py'), planPath, outputRoot], { encoding: 'utf8', windowsHide: true });
    if (render.status !== 0) throw new Error(`${asset.actorId}: ${render.stderr || render.stdout}`);
    receipts.push(JSON.parse(render.stdout));
  }
  const report = { schema: 'hmh-native-hero-diagnostics-v1', authority: 'offline delivered-pixel diagnostics; not browser, physical-device or human animation acceptance', heroes: receipts };
  writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
