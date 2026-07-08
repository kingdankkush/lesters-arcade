import { HMH_WO103_CONTINUOUS_GROUND } from '../assets/generated/hmh-level-one-ground/wo103-continuous/wo103-continuous-ground-manifest.mjs';
import { HMH_WO104_106_WORLD_KIT } from '../assets/generated/hmh-wo104-106-world-kit/hmh-wo104-106-world-kit-manifest.mjs';
import { HMH_ANIMATED_ROSTER } from '../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { HMH_FINAL_BOSS_ANIMATION_PACK } from '../assets/generated/hmh-final-boss-animations/hmh-final-boss-animations-manifest.mjs';
import { HMH_WO110_BOSS_REDO } from '../assets/generated/hmh-wo110-boss-redo/hmh-wo110-boss-redo-manifest.mjs';
import { HMH_FINAL_COMBAT_VFX_PACK } from '../assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs';
import { HMH_VFX_UI_CHROME_PACK } from '../assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs';
import { HMH_PICKUP_ICON_PACK } from '../assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs';
import { HMH_ACHIEVEMENT_ATLAS } from '../assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs';
import { buildLevelOneWo98AcceptanceTour } from './hmh-wo98-world-assembly.mjs';
import { HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION } from './hmh-wo86-89-audio-av.mjs';
import { HMH_HURTBOX_TRUTH_POLICY, deriveSpriteHitProfile } from './hmh-hurtbox-truth.mjs';
import { HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION } from './hmh-wo111-114-ship-candidate.mjs';

const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

function countAnimatedWaterAssets() {
  return HMH_WO103_CONTINUOUS_GROUND.assets.filter((asset) => asset.category === 'water' && asset.animated).length;
}

function countWorldKitAssets(prefix) {
  return HMH_WO104_106_WORLD_KIT.assets.filter((asset) => asset.key.startsWith(prefix)).length;
}

function animatedRosterStats() {
  const actorIds = Object.keys(HMH_ANIMATED_ROSTER);
  const actorsWithFrames = actorIds.filter((actorId) => {
    const animations = HMH_ANIMATED_ROSTER[actorId]?.animations ?? {};
    return Object.values(animations).some((directions) => Object.values(directions ?? {}).some((frames) => Array.isArray(frames) && frames.length > 0));
  });
  const enemiesWithFrames = actorIds.filter((actorId) => {
    const row = HMH_ANIMATED_ROSTER[actorId];
    const animations = row?.animations ?? {};
    return row?.role !== 'hero' && Object.values(animations).some((directions) => Object.values(directions ?? {}).some((frames) => Array.isArray(frames) && frames.length > 0));
  });
  return Object.freeze({ actorCount: actorIds.length, actorsWithFrames: actorsWithFrames.length, enemiesWithFrames: enemiesWithFrames.length });
}

function workOrder(id, title, status, evidence, openDebt = []) {
  return Object.freeze({
    id,
    title,
    status,
    evidence: freeze(evidence),
    openDebt: freeze(openDebt.map((item) => typeof item === 'string' ? { item } : item)),
  });
}

export function buildWo103114ContinuationCertification() {
  const tour = buildLevelOneWo98AcceptanceTour({ seed: 1337 });
  const roster = animatedRosterStats();
  const bossSample = deriveSpriteHitProfile({ actorKey: 'whale-dumper-boss', drawWidth: 224, drawHeight: 256, direction: 'south-east', boss: true });
  const workOrders = freeze([
    workOrder('WO-103', 'Ground and water biomes', 'certified-runtime-art-progress', [
      { kind: 'manifest', id: HMH_WO103_CONTINUOUS_GROUND.id, assetCount: HMH_WO103_CONTINUOUS_GROUND.assetCount, roles: Object.keys(HMH_WO103_CONTINUOUS_GROUND.roles).length },
      { kind: 'animated-water', assetCount: countAnimatedWaterAssets(), framePolicy: 'six-frame water sheets with frameMs timing' },
      { kind: 'proof-sheet', path: HMH_WO103_CONTINUOUS_GROUND.contactSheet },
    ], [
      'All-biome live capture tour still needs final human review.',
      'Old desert texture vault sweep remains a separate cleanup gate.',
    ]),
    workOrder('WO-105', 'Buildings, roads, and arenas', 'certified-runtime-art-progress', [
      { kind: 'arena-road-building-kit', id: HMH_WO104_106_WORLD_KIT.id, assetCount: countWorldKitAssets('wo105-world/'), roles: ['landmark', 'wall', 'road'] },
      { kind: 'acceptance-tour', id: tour.id, stepCount: tour.steps.length, criticalPath: tour.criticalPath },
    ], [
      'Full bank/forest/container/extraction arena capture tour still needs screenshots from a played run.',
    ]),
    workOrder('WO-106', 'Vehicles, micro-scenes, and ambient life', 'runtime-flee-behavior-integrated', [
      { kind: 'vehicle-microscene-life-kit', id: HMH_WO104_106_WORLD_KIT.id, assetCount: countWorldKitAssets('wo106-world/'), roles: ['vehicle', 'ambient-hazard'] },
      { kind: 'ambient-quota-plan', calmPocketRule: 'vehicles and critter burrows are visual life only; no boss-lock clutter' },
      { kind: 'critter-flee-behavior', policyId: 'wo106-level-one-ambient-life-v1', runtimePath: 'apps/portal/src/hmh-ambient-life.mjs' },
    ], [
      'Integrated runtime captures still need periodic refresh after later lighting/UI changes.',
    ]),
    workOrder('WO-107', 'Full world assembly and lighting checkpoint 2', 'checkpoint-ready-with-verdict-open', [
      { kind: 'six-biome-tour', id: tour.id, stepCount: tour.steps.length, placedObjectCount: tour.summary.placedObjectCount },
      { kind: 'lighting-checkpoint-module', path: 'apps/portal/src/hmh-wo107-checkpoint2.mjs', passes: ['dynamic-noir-lighting', 'vision-fog', 'readability-rim'] },
      { kind: 'checkpoint-gate', label: 'Playtest Checkpoint 2', notice: 'docs/game-design/PLAYTEST_CHECKPOINT_2_NOTICE.md', verdict: 'Justin verdict gate remains open' },
    ], [
      'Justin verdict remains open until reviewed.',
    ]),
    workOrder('WO-108', 'Sprite-derived hurtbox truth', 'runtime-integrated-with-overlay-proof', [
      { kind: 'hurtbox-policy', id: HMH_HURTBOX_TRUTH_POLICY.id, status: 'implemented', scalePolicy: HMH_HURTBOX_TRUTH_POLICY.scalePolicy },
      { kind: 'runtime-adapter', path: 'apps/portal/src/hmh-hurtbox-runtime.mjs', collisionTarget: 'hurtBox', debugOverlay: 'debugHitboxes' },
      { kind: 'boss-multi-capsules', status: 'implemented', capsuleCount: bossSample.bossCapsules.length, debugOverlay: 'debugHitboxes' },
      { kind: 'overlay-capture', path: 'docs/game-design/wo108-hurtbox-proof/wo108-hitbox-overlay-proof.png', actors: ['armored-claim-jumper', 'coyote-pack-runner-mini', 'whale-dumper-boss'] },
    ], [
      'DPS retune remains a post-capture balance pass only if playtest feel regresses; collision math now targets sprite-derived hurt cores.',
    ]),
    workOrder('WO-109', 'Enemy redesign batches', 'batch-one-runtime-integrated', [
      { kind: 'animated-roster', actorCount: roster.actorCount, actorsWithFrames: roster.actorsWithFrames, enemiesWithFrames: roster.enemiesWithFrames },
      { kind: 'batch-one-8dir-matrix', actors: ['crypto-bro-rusher', 'gas-beast-tank', 'evil-banker-ranged', 'liquidation-cascade-golem', 'scorpion-ambusher'], states: ['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in'], directions: 8 },
      { kind: 'proof-sheet', path: 'docs/game-design/wo109-enemy-redesign-batch/wo109-enemy-redesign-batch1-proof.png' },
      { kind: 'coverage-report', path: 'docs/art/ROSTER_COVERAGE.md', zeroAnimationActorsAfterBatch: 4 },
    ], [
      'Batch one removes five high-priority Level-1 runtime gaps; remaining zero-animation rows are boss/deferred actors outside this batch.',
    ]),
    workOrder('WO-110', 'Boss redo checkpoint 3', 'checkpoint3-runtime-integrated', [
      { kind: 'legacy-boss-pack', id: HMH_FINAL_BOSS_ANIMATION_PACK.id, actorCount: HMH_FINAL_BOSS_ANIMATION_PACK.actorCount, stateCount: HMH_FINAL_BOSS_ANIMATION_PACK.states.length, assetCount: HMH_FINAL_BOSS_ANIMATION_PACK.assetCount },
      { kind: 'true-scale-boss-redo', id: HMH_WO110_BOSS_REDO.id, actorId: HMH_WO110_BOSS_REDO.actor.id, assetCount: HMH_WO110_BOSS_REDO.assetCount, trueScaleRangePx: HMH_WO110_BOSS_REDO.trueScaleRangePx, phaseCount: HMH_WO110_BOSS_REDO.phaseCount, superMoveTelegraphCount: HMH_WO110_BOSS_REDO.superMoveTelegraphCount, deathSpectacleCount: HMH_WO110_BOSS_REDO.deathSpectacleCount },
      { kind: 'proof-sheet', path: 'docs/game-design/wo110-boss-redo-checkpoint3/wo110-boss-checkpoint3-proof.png' },
      { kind: 'checkpoint-gate', label: 'Playtest Checkpoint 3', verdict: 'Justin verdict gate remains open' },
    ], [
      'Checkpoint 3 is ready for boss-fight review; final approval still requires Justin playtest verdict.',
    ]),
    workOrder('WO-111', 'Final VFX art pass', HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo111.status, [
      { kind: 'combat-vfx-pack', id: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo111.vfxPackId, assetCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo111.assetCount, excludesNormalBulletSprites: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo111.excludesNormalBulletSprites },
      { kind: 'vfx-timing-lock', timingRowCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo111.timingRows.length, minute8ElapsedSeconds: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo111.minute8DensityCapture.elapsedSeconds, command: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo111.minute8DensityCapture.command },
    ]),
    workOrder('WO-112', 'Audio sync refresh', HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo112.status, [
      { kind: 'audio-av-certification', id: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo112.audioCertId, gateCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo112.gateCount, gatesPass: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo112.gatesPass },
      { kind: 'audio-sync-halts', syncRowCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo112.syncRows.length, haltCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo112.mixDensity.haltCount, bossWarningExclusive: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo112.mixDensity.bossWarningExclusive },
    ]),
    workOrder('WO-113', 'UI skin ship candidate', HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.status, [
      { kind: 'ui-skin-pack', id: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.uiChromePackId, assetCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.uiChromeAssetCount },
      { kind: 'pickup-and-achievement-icons', assetCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.pickupIconCount + HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.achievementIconCount, pickupCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.pickupIconCount, achievementCount: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.achievementIconCount },
      { kind: 'checkpoint-gate', label: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.checkpoint4.label, notice: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.checkpoint4.noticePath, verdict: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo113.checkpoint4.verdict },
    ], [
      'Justin final ship-candidate playtest verdict remains open.',
    ]),
    workOrder('WO-114', 'Coherence baseline lock', HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo114.status, [
      { kind: 'ship-art-census', seed: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo114.seed, path: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo114.artCensusPath, markdownPath: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo114.artCensusMarkdownPath },
      { kind: 'coherence-baseline', seed: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo114.seed, visualBaselineCommand: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo114.visualBaselineCommand, artCensusCommand: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo114.artCensusCommand, placeholderPolicy: HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.wo114.placeholderPolicy },
    ]),
  ]);
  const byId = Object.freeze(Object.fromEntries(workOrders.map((row) => [row.id, row])));
  const openDebtCount = workOrders.reduce((total, row) => total + row.openDebt.length, 0);
  const certifiedEvidenceCount = workOrders.reduce((total, row) => total + row.evidence.length, 0);
  return Object.freeze({
    id: 'hmh-wo103-114-continuation-cert-v1',
    seed: 1337,
    generatedFrom: Object.freeze([
      HMH_WO103_CONTINUOUS_GROUND.id,
      HMH_WO104_106_WORLD_KIT.id,
      HMH_FINAL_BOSS_ANIMATION_PACK.id,
      HMH_FINAL_COMBAT_VFX_PACK.id,
      HMH_VFX_UI_CHROME_PACK.id,
      HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION.id,
      HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION.id,
      HMH_HURTBOX_TRUTH_POLICY.id,
    ]),
    workOrders,
    byId,
    summary: Object.freeze({
      totalWorkOrders: workOrders.length,
      certifiedEvidenceCount,
      openDebtCount,
      verdict: 'continuation-certified; Justin verdict gate remains open for checkpoints 2-4 and final SHIP_ART_CENSUS lock',
    }),
  });
}

function evidenceLine(row) {
  const metric = row.assetCount != null ? `${row.assetCount} assets`
    : row.actorCount != null ? `${row.actorCount} actors`
      : row.stepCount != null ? `${row.stepCount} steps`
        : row.status ?? row.id ?? row.label ?? 'tracked';
  return `  - ${row.kind}: ${metric}`;
}

export function renderWo103114ContinuationMarkdown(cert = HMH_WO103_114_CONTINUATION_CERTIFICATION) {
  const lines = [
    '# HMH WO-103–WO-114 Continuation Certification',
    '',
    `Seed: ${cert.seed}`,
    `Status: ${cert.summary.verdict}`,
    '',
    'This document records shipped runtime/art evidence for the remaining HMH work-order wave without claiming final human verdicts prematurely.',
    '',
    'Checkpoint gates:',
    '- Playtest Checkpoint 2: full world assembly and lighting. Justin verdict gate remains open.',
    '- Playtest Checkpoint 3: boss fight checkpoint. Justin verdict gate remains open.',
    '- Playtest Checkpoint 4: UI skin ship-candidate build. Justin verdict gate remains open.',
    '',
    '## Work orders',
  ];
  for (const wo of cert.workOrders) {
    lines.push('', `### ${wo.id}: ${wo.title}`, `Status: ${wo.status}`, '', 'Evidence:');
    lines.push(...wo.evidence.map(evidenceLine));
    lines.push('', 'Open debt:');
    lines.push(...wo.openDebt.map((debt) => `  - ${debt.item}`));
  }
  lines.push('', '## Debug overlays', '', `WO-108 exposes ${HMH_HURTBOX_TRUTH_POLICY.id} with separate body/hurt boxes, boss capsules, and debugHitboxes overlay descriptors.`);
  lines.push('', '## Final note', '', 'Justin verdict gate remains open until the played capture sheets, listen-through HALTs, and final SHIP_ART_CENSUS/visual baseline lock are accepted.');
  return `${lines.join('\n')}\n`;
}

export const HMH_WO103_114_CONTINUATION_CERTIFICATION = buildWo103114ContinuationCertification();
