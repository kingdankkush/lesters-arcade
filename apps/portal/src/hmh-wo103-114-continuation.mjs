import { HMH_WO103_CONTINUOUS_GROUND } from '../assets/generated/hmh-level-one-ground/wo103-continuous/wo103-continuous-ground-manifest.mjs';
import { HMH_WO104_106_WORLD_KIT } from '../assets/generated/hmh-wo104-106-world-kit/hmh-wo104-106-world-kit-manifest.mjs';
import { HMH_ANIMATED_ROSTER } from '../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { HMH_FINAL_BOSS_ANIMATION_PACK } from '../assets/generated/hmh-final-boss-animations/hmh-final-boss-animations-manifest.mjs';
import { HMH_FINAL_COMBAT_VFX_PACK } from '../assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs';
import { HMH_VFX_UI_CHROME_PACK } from '../assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs';
import { HMH_PICKUP_ICON_PACK } from '../assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs';
import { HMH_ACHIEVEMENT_ATLAS } from '../assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs';
import { buildLevelOneWo98AcceptanceTour } from './hmh-wo98-world-assembly.mjs';
import { HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION } from './hmh-wo86-89-audio-av.mjs';
import { HMH_HURTBOX_TRUTH_POLICY, deriveSpriteHitProfile } from './hmh-hurtbox-truth.mjs';

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
    workOrder('WO-106', 'Vehicles, micro-scenes, and ambient life', 'certified-runtime-art-progress', [
      { kind: 'vehicle-microscene-life-kit', id: HMH_WO104_106_WORLD_KIT.id, assetCount: countWorldKitAssets('wo106-world/'), roles: ['vehicle', 'ambient-hazard'] },
      { kind: 'ambient-quota-plan', calmPocketRule: 'vehicles and critter burrows are visual life only; no boss-lock clutter' },
    ], [
      'True flee behaviors for critters are still gameplay debt beyond the static burrow cue.',
    ]),
    workOrder('WO-107', 'Full world assembly and lighting checkpoint 2', 'checkpoint-ready-with-verdict-open', [
      { kind: 'six-biome-tour', id: tour.id, stepCount: tour.steps.length, placedObjectCount: tour.summary.placedObjectCount },
      { kind: 'checkpoint-gate', label: 'Playtest Checkpoint 2', verdict: 'Justin verdict gate remains open' },
    ], [
      'Playtest Checkpoint 2 notice is generated in docs, but Justin verdict remains open until reviewed.',
    ]),
    workOrder('WO-108', 'Sprite-derived hurtbox truth', 'implemented-runtime-policy', [
      { kind: 'hurtbox-policy', id: HMH_HURTBOX_TRUTH_POLICY.id, status: 'implemented', scalePolicy: HMH_HURTBOX_TRUTH_POLICY.scalePolicy },
      { kind: 'boss-multi-capsules', status: 'implemented', capsuleCount: bossSample.bossCapsules.length, debugOverlay: 'debugHitboxes' },
    ], [
      'Large enemy overlay captures and DPS retune remain balance/capture follow-up after runtime overlay is wired visually.',
    ]),
    workOrder('WO-109', 'Enemy redesign batches', 'certified-roster-progress', [
      { kind: 'animated-roster', actorCount: roster.actorCount, actorsWithFrames: roster.actorsWithFrames, enemiesWithFrames: roster.enemiesWithFrames },
      { kind: 'proof-sheet', path: 'docs/game-design/wo109-enemy-animation-proof/wo109-clean-enemy-animation-proof-sheet.png' },
    ], [
      'Not every enemy has full 8-dir state coverage yet; the roster intentionally preserves partial/zero-frame debt rows.',
    ]),
    workOrder('WO-110', 'Boss redo checkpoint 3', 'certified-boss-pack-progress', [
      { kind: 'true-scale-boss-pack', id: HMH_FINAL_BOSS_ANIMATION_PACK.id, actorCount: HMH_FINAL_BOSS_ANIMATION_PACK.actorCount, stateCount: HMH_FINAL_BOSS_ANIMATION_PACK.states.length, assetCount: HMH_FINAL_BOSS_ANIMATION_PACK.assetCount },
      { kind: 'checkpoint-gate', label: 'Playtest Checkpoint 3', verdict: 'Justin verdict gate remains open' },
    ], [
      'Boss fight checkpoint sheet needs final played fight captures before ship-candidate signoff.',
    ]),
    workOrder('WO-111', 'Final VFX art pass', 'certified-vfx-pack-progress', [
      { kind: 'combat-vfx-pack', id: HMH_FINAL_COMBAT_VFX_PACK.id, assetCount: HMH_FINAL_COMBAT_VFX_PACK.assetCount, excludesNormalBulletSprites: HMH_FINAL_COMBAT_VFX_PACK.excludesNormalBulletSprites },
    ], [
      'Minute-8 density capture still needs a deterministic visual smoke run after final actor timing changes.',
    ]),
    workOrder('WO-112', 'Audio sync refresh', 'certified-audio-plan-progress', [
      { kind: 'audio-av-certification', id: HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION.id, status: HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION.status, gateCount: HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION.gates.length },
    ], [
      'Listen-through HALTs and mix-density checks still require human ears after final animation timing.',
    ]),
    workOrder('WO-113', 'UI skin ship candidate', 'certified-ui-art-progress', [
      { kind: 'ui-skin-pack', id: HMH_VFX_UI_CHROME_PACK.id, assetCount: HMH_VFX_UI_CHROME_PACK.assetCount },
      { kind: 'pickup-and-achievement-icons', assetCount: HMH_PICKUP_ICON_PACK.assetCount + HMH_ACHIEVEMENT_ATLAS.achievementCount, pickupCount: HMH_PICKUP_ICON_PACK.assetCount, achievementCount: HMH_ACHIEVEMENT_ATLAS.achievementCount },
      { kind: 'checkpoint-gate', label: 'Playtest Checkpoint 4', verdict: 'ship-candidate gate remains open' },
    ], [
      'HUD/cards/minimap/boss/game-over visual capture still needs final screenshot pass.',
    ]),
    workOrder('WO-114', 'Coherence baseline lock', 'baseline-gates-defined', [
      { kind: 'coherence-baseline', seed: 1337, visualBaselineCommand: 'npm run visual:regression', artCensusCommand: 'npm run design:art-census', placeholderPolicy: 'zero placeholders/legacy draw-set claim requires final census output' },
    ], [
      'SHIP_ART_CENSUS lock is not final until the full visual/art-census gate is rerun after all capture approvals.',
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
