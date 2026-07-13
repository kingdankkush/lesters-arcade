import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { HMH_FINAL_ANIMATION_COMPLETION_PACK } from '../assets/generated/hmh-final-animation-completion/hmh-final-animation-completion-manifest.mjs';
import { assetSrcForFrameRef } from './atlas-frame-ref.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const WAVE3_HERO_ACTORS = Object.freeze(['lit-commando', 'lit-valkyrie', 'lester', 'lilly']);
export const WAVE3_HERO_STATES = Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death']);
export const WAVE3_HERO_DIRECTIONS = Object.freeze(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);
export const WAVE3_ENEMY_READABILITY_STATES = Object.freeze(['attack-tell', 'melee-counter', 'hit', 'death', 'optional-gore-overlay']);

function resolveRuntimeAsset(src) {
  return resolve(repoRoot, 'apps', 'portal', assetSrcForFrameRef(src).replace(/^\.\//, ''));
}

function heroMatrixRows() {
  const rows = [];
  for (const actorId of WAVE3_HERO_ACTORS) {
    const animations = HMH_ANIMATED_ROSTER[actorId]?.animations ?? {};
    for (const state of WAVE3_HERO_STATES) {
      const directions = WAVE3_HERO_DIRECTIONS.map((direction) => {
        const frames = animations[state]?.[direction] ?? [];
        const existingFrames = frames.filter((frame) => existsSync(resolveRuntimeAsset(frame)));
        return Object.freeze({ direction, frameCount: frames.length, firstFrame: frames[0] ?? null, complete: existingFrames.length > 0 });
      });
      rows.push(Object.freeze({
        actorId,
        state,
        directions: Object.freeze(directions),
        missingDirections: Object.freeze(directions.filter((direction) => !direction.complete).map((direction) => direction.direction)),
        frameCount: directions.reduce((sum, direction) => sum + direction.frameCount, 0),
        complete: directions.every((direction) => direction.complete),
      }));
    }
  }
  return rows;
}

function enemyMatrixRows() {
  const enemyActors = HMH_FINAL_ANIMATION_COMPLETION_PACK.actors
    .filter((actor) => actor.role === 'enemy')
    .sort((a, b) => a.id.localeCompare(b.id));
  const rows = [];
  for (const actor of enemyActors) {
    const states = new Set(actor.states ?? []);
    for (const state of WAVE3_ENEMY_READABILITY_STATES) {
      rows.push(Object.freeze({
        actorId: actor.id,
        label: actor.label,
        state,
        sourcePack: HMH_FINAL_ANIMATION_COMPLETION_PACK.id,
        complete: states.has(state),
      }));
    }
  }
  return rows;
}

function summarizeHeroRows(rows) {
  const totalCells = rows.length * WAVE3_HERO_DIRECTIONS.length;
  const missingCells = rows.reduce((sum, row) => sum + row.missingDirections.length, 0);
  return Object.freeze({
    actorCount: WAVE3_HERO_ACTORS.length,
    stateCount: WAVE3_HERO_STATES.length,
    directionCount: WAVE3_HERO_DIRECTIONS.length,
    totalCells,
    completeCells: totalCells - missingCells,
    missingCells,
  });
}

function summarizeEnemyRows(rows) {
  const requiredActorCount = new Set(rows.map((row) => row.actorId)).size;
  const missingStateCells = rows.filter((row) => !row.complete).length;
  return Object.freeze({
    requiredActorCount,
    readabilityStateCount: WAVE3_ENEMY_READABILITY_STATES.length,
    totalStateCells: rows.length,
    completeStateCells: rows.length - missingStateCells,
    missingStateCells,
  });
}

export function buildWave3ArtMatrixReport() {
  const heroRows = heroMatrixRows();
  const enemyRows = enemyMatrixRows();
  const heroSummary = summarizeHeroRows(heroRows);
  const enemySummary = summarizeEnemyRows(enemyRows);
  const policy = Object.freeze({
    legacyFallbacksAllowed: false,
    disallowedFallbacks: Object.freeze(['still-only-runtime', 'rectangle-fallback', 'cross-character-roster-swap', 'legacy-combatArt-enemies']),
    productionRule: 'Runtime heroes must resolve to one locked roster with bounded atlas or loose frames for each required state/direction; enemy readability must come from the final completion pack, not old combatArt or rectangle placeholders.',
  });
  const gates = Object.freeze([
    Object.freeze({ id: 'hero-state-direction-matrix', status: heroSummary.missingCells === 0 ? 'pass' : 'fail', metric: `${heroSummary.completeCells}/${heroSummary.totalCells} cells` }),
    Object.freeze({ id: 'enemy-readability-matrix', status: enemySummary.missingStateCells === 0 ? 'pass' : 'fail', metric: `${enemySummary.completeStateCells}/${enemySummary.totalStateCells} cells` }),
    Object.freeze({ id: 'legacy-fallback-policy', status: policy.legacyFallbacksAllowed ? 'fail' : 'pass', metric: policy.disallowedFallbacks.join(', ') }),
  ]);
  return Object.freeze({
    generatedBy: 'npm run design:wave3-art',
    sourcePacks: Object.freeze({
      animatedRoster: 'apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs',
      finalCompletionPack: HMH_FINAL_ANIMATION_COMPLETION_PACK.id,
      sourcePolicy: HMH_FINAL_ANIMATION_COMPLETION_PACK.sourcePolicy,
    }),
    policy,
    heroes: Object.freeze({ rows: Object.freeze(heroRows), summary: heroSummary }),
    enemies: Object.freeze({ rows: Object.freeze(enemyRows), summary: enemySummary }),
    gates,
  });
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell)).join(' | ')} |`),
  ].join('\n');
}

export function buildWave3ArtMatrixMarkdown(report = buildWave3ArtMatrixReport()) {
  const heroRows = report.heroes.rows.map((row) => [
    row.actorId,
    row.state,
    row.complete ? 'PASS' : 'FAIL',
    row.frameCount,
    row.missingDirections.join(', ') || 'none',
  ]);
  const enemyRows = report.enemies.rows.map((row) => [row.actorId, row.label, row.state, row.complete ? 'PASS' : 'FAIL', row.sourcePack]);
  const gateRows = report.gates.map((gate) => [gate.id, gate.status.toUpperCase(), gate.metric]);
  return `# Hard Money Heroes Wave 3 Art Matrix\n\nGenerated by \`${report.generatedBy}\`.\n\n## Legacy fallback policy\n\n- Legacy fallbacks allowed: ${report.policy.legacyFallbacksAllowed}\n- Disallowed fallbacks: ${report.policy.disallowedFallbacks.join(', ')}\n- Rule: ${report.policy.productionRule}\n\n## Gates\n\n${markdownTable(['Gate', 'Status', 'Metric'], gateRows)}\n\n## Hero matrix\n\nRequired: ${report.heroes.summary.actorCount} heroes × ${report.heroes.summary.stateCount} states × ${report.heroes.summary.directionCount} directions = ${report.heroes.summary.totalCells} cells. Missing cells: ${report.heroes.summary.missingCells}.\n\n${markdownTable(['Hero', 'State', 'Status', 'Frames', 'Missing directions'], heroRows)}\n\n## Enemy readability matrix\n\nRequired: ${report.enemies.summary.requiredActorCount} enemies × ${report.enemies.summary.readabilityStateCount} readability states = ${report.enemies.summary.totalStateCells} cells. Missing cells: ${report.enemies.summary.missingStateCells}.\n\n${markdownTable(['Enemy', 'Label', 'State', 'Status', 'Source'], enemyRows)}\n\n## Follow-up\n\n- Keep \`npm run design:wave3-art\` green after every sprite import.\n- Do not re-enable still-only, rectangle, cross-character, or legacy combatArt enemy fallbacks to hide gaps.\n- User approval is still required before spending credits or choosing a new generated-art batch/tool.\n`;
}
