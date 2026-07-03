import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { HMH_FINAL_ANIMATION_COMPLETION_PACK } from '../apps/portal/assets/generated/hmh-final-animation-completion/hmh-final-animation-completion-manifest.mjs';
import { HMH_FINAL_BOSS_ANIMATION_PACK } from '../apps/portal/assets/generated/hmh-final-boss-animations/hmh-final-boss-animations-manifest.mjs';
import { HMH_FINAL_COMBAT_VFX_PACK } from '../apps/portal/assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs';
import { HMH_FINAL_SETPIECE_KIT } from '../apps/portal/assets/generated/hmh-final-setpiece-kit/hmh-final-setpiece-kit-manifest.mjs';
import { HMH_CURATED_LEVEL_KIT } from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';
import { HMH_LEVEL_ONE_FINAL_PAINT_GROUND } from '../apps/portal/assets/generated/hmh-level-one-ground/final-paint/final-paint-level-one-ground-manifest.mjs';
import { HMH_FINAL_WORLD_AMBIENT_ASSETS } from '../apps/portal/assets/generated/hmh-coherent-world/level-final-ambient/level-final-ambient-manifest.mjs';
import { buildRosterCoverageReport } from './roster-coverage-report.mjs';
import { buildArtPurgeRepairPlan } from '../apps/portal/src/hmh-art-repair.mjs';

const VERSION = 'wo-17-global-art-census-v1';

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pct(numerator, denominator) {
  if (!denominator) return 100;
  return Math.round((Math.max(0, numerator) / denominator) * 100);
}

function policyTextCompliant(text = '') {
  return /repo-owned|original|curated approved|justin-curated/i.test(String(text ?? ''));
}

function policyCompliantCount(assets = [], layerPolicy = '') {
  const layerCompliant = policyTextCompliant(layerPolicy);
  return assets.filter((asset) => {
    const text = String(asset.sourcePolicy ?? '');
    if (text) return policyTextCompliant(text);
    return layerCompliant;
  }).length;
}

function layerFromPack({ id, label, pack, assetCount = null, actorCount = null, notes = [] }) {
  const assets = safeArray(pack?.assets);
  const total = Number.isFinite(assetCount) ? assetCount : Number(pack?.assetCount ?? assets.length) || assets.length;
  return Object.freeze({
    id,
    label,
    manifestId: pack?.id ?? id,
    sourcePolicy: pack?.sourcePolicy ?? pack?.license ?? 'unknown',
    assetCount: total,
    actorCount: Number.isFinite(actorCount) ? actorCount : Number(pack?.actorCount ?? 0) || 0,
    animatedAssetCount: assets.filter((asset) => Boolean(asset.animated)).length,
    policyCompliantAssetCount: policyCompliantCount(assets, pack?.sourcePolicy ?? pack?.license ?? ''),
    sampleKeys: Object.freeze(assets.slice(0, 8).map((asset) => asset.key ?? asset.id ?? asset.src).filter(Boolean)),
    notes: Object.freeze(notes),
  });
}

function runtimeRosterLayer(rosterReport) {
  const actors = Object.values(HMH_ANIMATED_ROSTER);
  const actorCount = actors.length;
  const animationStateCount = actors.reduce((sum, actor) => sum + Object.keys(actor.animations ?? {}).length, 0);
  const frameRefCount = actors.reduce((sum, actor) => sum + Object.values(actor.animations ?? {}).reduce((stateSum, dirMap) => (
    stateSum + Object.values(dirMap ?? {}).reduce((dirSum, frames) => dirSum + safeArray(frames).length, 0)
  ), 0), 0);
  return Object.freeze({
    id: 'runtimeAnimatedRoster',
    label: 'Runtime animated roster',
    manifestId: 'hmh-animated-roster',
    sourcePolicy: 'Runtime manifest for canonical actors; coverage judged by roster-coverage-report role matrix.',
    actorCount,
    assetCount: frameRefCount,
    animationStateCount,
    completeActorCount: rosterReport.summary.completeActorCount,
    partialActorCount: rosterReport.summary.partialActorCount,
    zeroAnimationActorCount: rosterReport.summary.zeroAnimationActorCount,
    levelOneShipEnemyCount: rosterReport.summary.levelOneShipEnemyCount,
    sampleKeys: Object.freeze(Object.keys(HMH_ANIMATED_ROSTER).slice(0, 8)),
    notes: Object.freeze([
      'Counts frame references, not unique PNG files; it is the live runtime coverage layer.',
      'Partial and zero-animation actors intentionally remain visible for WO-18/WO-19 decisions.',
    ]),
  });
}

function strictRuntimeActorCategory(rosterSummary, repairPlan) {
  const actorCount = Math.max(0, rosterSummary.actorCount ?? 0);
  const zeroCount = Math.max(0, rosterSummary.zeroAnimationActorCount ?? 0);
  const autoRepaired = repairPlan.summary.autoRepairCount ?? 0;
  const deferredOrPurged = repairPlan.summary.deferOrPurgeCount ?? 0;
  const unresolved = repairPlan.summary.unresolvedCount ?? 0;
  const ruledZeroCount = autoRepaired + deferredOrPurged;
  const score = zeroCount === 0 ? 100 : Math.round(((zeroCount - unresolved) / zeroCount) * 100);
  const strictRenderableActorCount = Math.max(0, actorCount - deferredOrPurged - unresolved);
  const unresolvedEntries = repairPlan.repairs.filter((entry) => !entry.repaired && entry.action !== 'defer-or-purge');
  return Object.freeze({
    score,
    summary: Object.freeze({
      runtimeActorCount: actorCount,
      rawZeroAnimationActorCount: zeroCount,
      autoRepairedZeroAnimationActorCount: autoRepaired,
      deferredOrPurgedZeroAnimationActorCount: deferredOrPurged,
      ruledZeroAnimationActorCount: ruledZeroCount,
      unresolvedZeroAnimationActorCount: unresolved,
      strictRenderableActorCount,
    }),
    text: unresolved === 0
      ? `${zeroCount}/${zeroCount} zero-animation actor(s) have runtime repair or defer/purge rulings; ${strictRenderableActorCount}/${actorCount} actors remain strict-runtime renderable.`
      : `${unresolved}/${zeroCount} zero-animation actor(s) still lack runtime repair or defer/purge rulings.`,
    gaps: Object.freeze(unresolvedEntries.map((entry) => `${entry.from}: unresolved zero-animation actor`)),
  });
}

function scorecardFor(layers, rosterReport, repairPlan) {
  const rosterSummary = rosterReport.summary;
  const actorCount = Math.max(1, rosterSummary.actorCount);
  const complete = rosterSummary.completeActorCount;
  const nonZero = actorCount - rosterSummary.zeroAnimationActorCount;
  const animationScore = Math.round((complete / actorCount) * 70 + (nonZero / actorCount) * 30);

  const policyAssets = Object.values(layers).reduce((sum, layer) => sum + (layer.policyCompliantAssetCount ?? 0), 0);
  const policyTotal = Object.values(layers).reduce((sum, layer) => sum + (layer.assetCount ?? 0), 0);
  const sourcePolicyScore = pct(policyAssets, policyTotal);

  const gameplayLayerIds = ['combatVfx', 'finalSetpieces', 'curatedLevelKit', 'finalPaintGround', 'ambientWorld'];
  const gameplayReady = gameplayLayerIds.filter((id) => (layers[id]?.assetCount ?? 0) > 0).length;
  const gameplayReadabilityScore = pct(gameplayReady, gameplayLayerIds.length);

  const strictRuntimeActors = strictRuntimeActorCategory(rosterSummary, repairPlan);
  const purgeReadinessScore = strictRuntimeActors.summary.unresolvedZeroAnimationActorCount === 0
    ? 100
    : Math.max(35, 80 - strictRuntimeActors.summary.unresolvedZeroAnimationActorCount * 8);
  const overallScore = Math.round((animationScore * 0.25) + (sourcePolicyScore * 0.20) + (gameplayReadabilityScore * 0.25) + (purgeReadinessScore * 0.15) + (strictRuntimeActors.score * 0.15));

  return Object.freeze({
    overallScore,
    categories: Object.freeze({
      animationCoverage: Object.freeze({
        score: animationScore,
        summary: `${complete}/${actorCount} actors complete; ${rosterSummary.zeroAnimationActorCount} zero-animation actors`,
        gaps: Object.freeze([
          ...rosterReport.zeroAnimationActors.map((actor) => `${actor}: zero-animation`),
          ...rosterReport.partialActors.slice(0, 16).map((actor) => `${actor}: partial coverage`),
        ]),
      }),
      sourcePolicy: Object.freeze({
        score: sourcePolicyScore,
        summary: `${policyAssets}/${policyTotal} counted assets carry repo-owned/original/curated policy text`,
        gaps: Object.freeze(Object.values(layers)
          .filter((layer) => (layer.assetCount ?? 0) > 0 && (layer.policyCompliantAssetCount ?? layer.assetCount) < (layer.assetCount ?? 0))
          .map((layer) => `${layer.label}: ${layer.policyCompliantAssetCount ?? 0}/${layer.assetCount} policy-compliant counted assets`)),
      }),
      gameplayReadability: Object.freeze({
        score: gameplayReadabilityScore,
        summary: `${gameplayReady}/${gameplayLayerIds.length} gameplay-readability art layers populated`,
        gaps: Object.freeze(gameplayLayerIds.filter((id) => (layers[id]?.assetCount ?? 0) <= 0).map((id) => `${id}: empty layer`)),
      }),
      purgeReadiness: Object.freeze({
        score: purgeReadinessScore,
        summary: strictRuntimeActors.summary.unresolvedZeroAnimationActorCount === 0
          ? 'Every zero-animation runtime actor has an auto-repair or defer/purge ruling.'
          : `${strictRuntimeActors.summary.unresolvedZeroAnimationActorCount} zero-animation actor(s) still need keep/defer/purge ruling`,
        gaps: strictRuntimeActors.gaps,
      }),
      strictRuntimeActors: Object.freeze({
        score: strictRuntimeActors.score,
        summary: strictRuntimeActors.summary,
        text: strictRuntimeActors.text,
        gaps: strictRuntimeActors.gaps,
      }),
    }),
  });
}

export function buildGlobalArtCensus({ repoRoot = repoRootFromHere() } = {}) {
  const rosterReport = buildRosterCoverageReport({ repoRoot });
  const layers = Object.freeze({
    runtimeAnimatedRoster: runtimeRosterLayer(rosterReport),
    finalAnimationCompletion: layerFromPack({ id: 'finalAnimationCompletion', label: 'Final animation completion pack', pack: HMH_FINAL_ANIMATION_COMPLETION_PACK }),
    finalBossAnimations: layerFromPack({ id: 'finalBossAnimations', label: 'Final boss and mini-boss animations', pack: HMH_FINAL_BOSS_ANIMATION_PACK }),
    combatVfx: layerFromPack({ id: 'combatVfx', label: 'Final combat VFX', pack: HMH_FINAL_COMBAT_VFX_PACK }),
    finalSetpieces: layerFromPack({ id: 'finalSetpieces', label: 'Final Level 1 setpieces', pack: HMH_FINAL_SETPIECE_KIT }),
    curatedLevelKit: layerFromPack({
      id: 'curatedLevelKit',
      label: 'Curated Level 1 kit',
      pack: HMH_CURATED_LEVEL_KIT,
      assetCount: safeArray(HMH_CURATED_LEVEL_KIT.assets).length,
      notes: ['Justin-curated approved assets only; legacy editor sprite library is intentionally excluded.'],
    }),
    finalPaintGround: layerFromPack({ id: 'finalPaintGround', label: 'Final Level 1 ground paint', pack: HMH_LEVEL_ONE_FINAL_PAINT_GROUND }),
    ambientWorld: layerFromPack({ id: 'ambientWorld', label: 'Final ambient world assets', pack: HMH_FINAL_WORLD_AMBIENT_ASSETS }),
  });
  const totalAssets = Object.values(layers).reduce((sum, layer) => sum + (layer.assetCount ?? 0), 0);
  const totalActors = Object.values(layers).reduce((sum, layer) => sum + (layer.actorCount ?? 0), 0);
  const scorecard = scorecardFor(layers, rosterReport, buildArtPurgeRepairPlan({ roster: HMH_ANIMATED_ROSTER, zeroAnimationActors: rosterReport.zeroAnimationActors }));
  const strictRuntimeActors = scorecard.categories.strictRuntimeActors.summary;
  return Object.freeze({
    version: VERSION,
    generatedBy: 'scripts/global-art-census.mjs',
    summary: Object.freeze({
      totalAssets,
      totalActors,
      layerCount: Object.keys(layers).length,
      runtimeActorCount: rosterReport.summary.actorCount,
      runtimeCompleteActorCount: rosterReport.summary.completeActorCount,
      runtimePartialActorCount: rosterReport.summary.partialActorCount,
      runtimeZeroAnimationActorCount: rosterReport.summary.zeroAnimationActorCount,
      runtimeStrictRenderableActorCount: strictRuntimeActors.strictRenderableActorCount,
      runtimeAutoRepairedZeroAnimationActorCount: strictRuntimeActors.autoRepairedZeroAnimationActorCount,
      runtimeDeferredOrPurgedZeroAnimationActorCount: strictRuntimeActors.deferredOrPurgedZeroAnimationActorCount,
      runtimeUnresolvedZeroAnimationActorCount: strictRuntimeActors.unresolvedZeroAnimationActorCount,
      complianceScore: scorecard.overallScore,
    }),
    layers,
    scorecard,
    recommendations: Object.freeze([
      'WO-18: use this census as the approved keep/defer/purge ledger; purge or repair zero-animation runtime actors before declaring art complete.',
      'WO-19: certify hero smoothness against the runtime roster plus final animation completion pack; do not rely on still fallback coverage alone.',
      'WO-20: route pickups, achievements, VFX, and UI chrome through the same source-policy scorecard before replacing runtime art.',
      'Regenerate with `npm run design:art-census` after every generated-art or manifest change.',
    ]),
  });
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replaceAll('\n', ' ').replaceAll('|', '\\|')).join(' | ')} |`),
  ].join('\n');
}

export function renderGlobalArtCensusMarkdown(census) {
  const layerRows = Object.values(census.layers).map((layer) => [
    layer.label,
    layer.assetCount,
    layer.actorCount || 'n/a',
    layer.animatedAssetCount ?? 'n/a',
    layer.sourcePolicy,
  ]);
  const scoreRows = Object.entries(census.scorecard.categories).map(([key, entry]) => [
    key,
    `${entry.score}/100`,
    entry.text ?? entry.summary,
    entry.gaps.length ? entry.gaps.slice(0, 8).join('; ') : 'none',
  ]);
  return `# Hard Money Heroes Global Art Census\n\nGenerated by \`${census.generatedBy}\`.\n\n## Summary\n\n- Census version: ${census.version}\n- Counted art layers: ${census.summary.layerCount}\n- Counted assets/frame references: ${census.summary.totalAssets}\n- Counted actors across art packs: ${census.summary.totalActors}\n- Runtime roster actors: ${census.summary.runtimeActorCount}\n- Runtime complete actors: ${census.summary.runtimeCompleteActorCount}\n- Runtime partial actors: ${census.summary.runtimePartialActorCount}\n- Runtime zero-animation actors: ${census.summary.runtimeZeroAnimationActorCount}\n- Runtime strict-renderable actors after repair/defer rulings: ${census.summary.runtimeStrictRenderableActorCount}\n- Runtime auto-repaired zero-animation actors: ${census.summary.runtimeAutoRepairedZeroAnimationActorCount}\n- Runtime deferred/purged zero-animation actors: ${census.summary.runtimeDeferredOrPurgedZeroAnimationActorCount}\n- Runtime unresolved zero-animation actors: ${census.summary.runtimeUnresolvedZeroAnimationActorCount}\n- Overall compliance score: ${census.scorecard.overallScore}/100\n\n## Compliance scorecard\n\n${table(['Category', 'Score', 'Summary', 'Top gaps'], scoreRows)}\n\n## Art layers\n\n${table(['Layer', 'Assets', 'Actors', 'Animated assets', 'Source policy'], layerRows)}\n\n## Runtime animated roster\n\nThe runtime animated roster is counted separately from final generated packs because it decides what the live game can draw right now. Its frame count is a frame-reference count rather than a unique-PNG count.\n\n## Recommendations\n\n${census.recommendations.map((item) => `- ${item}`).join('\n')}\n`;
}

export function writeGlobalArtCensus({ repoRoot = repoRootFromHere() } = {}) {
  const census = buildGlobalArtCensus({ repoRoot });
  const outputDir = path.join(repoRoot, 'docs', 'art');
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'GLOBAL_ART_CENSUS.json');
  const mdPath = path.join(outputDir, 'GLOBAL_ART_CENSUS.md');
  writeFileSync(jsonPath, `${JSON.stringify(census, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, renderGlobalArtCensusMarkdown(census), 'utf8');
  return Object.freeze({ census, jsonPath, mdPath });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const { census, jsonPath, mdPath } = writeGlobalArtCensus();
  console.log(`Global art census written: ${jsonPath}`);
  console.log(`Global art census markdown written: ${mdPath}`);
  console.log(`Compliance score: ${census.scorecard.overallScore}/100; assets: ${census.summary.totalAssets}; runtime actors: ${census.summary.runtimeActorCount}`);
}
