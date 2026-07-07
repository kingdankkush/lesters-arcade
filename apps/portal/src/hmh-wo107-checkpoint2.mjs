import {
  LEVEL_1_WO98_ACCEPTANCE_SEED,
  LEVEL_1_WO98_CRITICAL_PATH,
  LEVEL_1_WO98_ROUTE_BEATS,
  buildLevelOneWo98AcceptanceTour,
} from './hmh-wo98-world-assembly.mjs';
import { buildLevelOnePolishAcceptanceTour } from './hmh-level-one-polish-tour.mjs';

const freeze = (value) => Object.freeze(value);

function unique(items) {
  return [...new Set(items)];
}

function lightingForStep(step) {
  const water = step.biomeId.includes('canal') || step.expectedFamilies.includes('water');
  const city = step.biomeId.includes('city') || step.biomeId.includes('industrial') || step.biomeId.includes('extraction');
  return freeze({
    phase: 'dusk',
    hasDynamicLightingPass: true,
    hasVisionFogPass: true,
    palette: city ? 'noir neon warm/cool pools' : water ? 'moonlit water rim + shoreline contrast' : 'warm route rim + cool shadow pockets',
    acceptance: freeze([
      'dynamic lighting pass runs after world sprites and before bullets/HUD',
      'vision fog remains above world art without hiding player, nearby enemies, or route cues',
      water ? 'water edges stay readable under dusk tint and do not become black slabs' : 'landmark silhouettes stay readable under dusk tint',
    ]),
  });
}

function cameraForBiomeStep(step, polishTour) {
  const beats = LEVEL_1_WO98_ROUTE_BEATS[step.biomeId] ?? [];
  const polishStep = polishTour.steps.find((candidate) => beats.includes(candidate.routeBeat)) ?? polishTour.steps[Math.min(step.index, polishTour.steps.length - 1)];
  return freeze({
    playerX: polishStep?.camera?.playerX ?? step.index * 14,
    playerY: polishStep?.camera?.playerY ?? 5,
    window: Math.max(18, polishStep?.camera?.window ?? 18),
  });
}

export const HMH_WO107_CHECKPOINT2 = freeze({
  id: 'wo107-level-one-checkpoint-2-v1',
  status: 'checkpoint-ready-verdict-open',
  seed: LEVEL_1_WO98_ACCEPTANCE_SEED,
  scope: 'Full Level 1 world assembly and lighting pass acceptance tour across six approved biomes.',
  requiredCommands: freeze([
    'node --test tests/hmh-wo107-checkpoint2.test.mjs',
    'npm run visual:regression',
    'npm run vercel:build',
  ]),
});

export function buildWo107Checkpoint2Tour() {
  const assemblyTour = buildLevelOneWo98AcceptanceTour({ seed: LEVEL_1_WO98_ACCEPTANCE_SEED });
  const polishTour = buildLevelOnePolishAcceptanceTour();
  const steps = assemblyTour.steps.map((step) => freeze({
    index: step.index,
    seed: step.seed,
    biomeId: step.biomeId,
    routeBeats: freeze(step.routeBeats),
    camera: cameraForBiomeStep(step, polishTour),
    expectedFamilies: freeze(step.expectedFamilies),
    expectedObjects: freeze(step.expectedObjects),
    lighting: lightingForStep(step),
    acceptance: freeze([
      ...step.acceptance,
      'silhouette hierarchy and negative space stay readable before boss-density pressure',
      'camera shows next route cue or authored boundary inside two seconds',
    ]),
  }));
  const routeBeatCoverage = unique(steps.flatMap((step) => step.routeBeats));
  return freeze({
    id: HMH_WO107_CHECKPOINT2.id,
    seed: HMH_WO107_CHECKPOINT2.seed,
    purpose: HMH_WO107_CHECKPOINT2.scope,
    steps: freeze(steps),
    summary: freeze({
      biomeCoverage: freeze([...LEVEL_1_WO98_CRITICAL_PATH]),
      routeBeatCoverage: freeze(routeBeatCoverage),
      placedObjectCount: assemblyTour.summary.placedObjectCount,
      microSceneCount: assemblyTour.summary.microSceneCount,
      connectorTypes: assemblyTour.summary.connectorTypes,
      lightingPasses: freeze(['dynamic-noir-lighting', 'vision-fog', 'readability-rim']),
      requiredCommands: HMH_WO107_CHECKPOINT2.requiredCommands,
    }),
    verdictGate: freeze({
      owner: 'Justin',
      status: 'open',
      blocksShipCandidate: true,
      prompt: 'Justin should approve Checkpoint 2 for Level 1 world assembly/lighting or request revisions before WO-113 ship-candidate skin lock.',
    }),
  });
}

export function renderWo107Checkpoint2Markdown(tour = buildWo107Checkpoint2Tour()) {
  const lines = [
    '# Hard Money Heroes Playtest Checkpoint 2',
    '',
    `- Checkpoint ID: \`${tour.id}\``,
    `- Seed: \`${tour.seed}\``,
    `- Scope: ${tour.purpose}`,
    `- Status: ${HMH_WO107_CHECKPOINT2.status}`,
    `- Six-biome route: ${tour.summary.biomeCoverage.map((biome) => `\`${biome}\``).join(' → ')}`,
    `- Route beats: ${tour.summary.routeBeatCoverage.map((beat) => `\`${beat}\``).join(', ')}`,
    `- Placed objects: ${tour.summary.placedObjectCount}`,
    `- Micro-scenes: ${tour.summary.microSceneCount}`,
    '',
    '## All-Biome Acceptance Tour',
    '',
    '| # | biome | route beats | camera | expected families | lighting acceptance |',
    '|---:|---|---|---|---|---|',
  ];
  for (const step of tour.steps) {
    lines.push(`| ${step.index + 1} | \`${step.biomeId}\` | ${step.routeBeats.map((beat) => `\`${beat}\``).join('<br>')} | ${step.camera.playerX},${step.camera.playerY} ±${step.camera.window} | ${step.expectedFamilies.map((family) => `\`${family}\``).join('<br>')} | ${step.lighting.acceptance.join('<br>')} |`);
  }
  lines.push(
    '',
    '## Lighting Pass',
    '',
    '- Dusk/noir dynamic lighting is required after world sprites and before bullets/HUD.',
    '- Vision fog must preserve player, nearby threat, route-cue, and boss-readability silhouettes.',
    '- Water and plaza edges must remain readable under tint; no black slab/checkerboard artifacts.',
    '',
    '## Justin Verdict Gate',
    '',
    `- Owner: ${tour.verdictGate.owner}`,
    `- Status: ${tour.verdictGate.status}`,
    `- Blocks ship candidate: ${tour.verdictGate.blocksShipCandidate ? 'yes' : 'no'}`,
    `- Prompt: ${tour.verdictGate.prompt}`,
    '',
    '## Verification Commands',
    '',
    ...tour.summary.requiredCommands.map((command) => `- \`${command}\``),
  );
  return `${lines.join('\n')}\n`;
}
