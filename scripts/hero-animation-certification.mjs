import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { HMH_FINAL_ANIMATION_COMPLETION_PACK } from '../apps/portal/assets/generated/hmh-final-animation-completion/hmh-final-animation-completion-manifest.mjs';

export const HERO_CORE_STATES = Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death']);
export const ISO_8_DIRECTIONS = Object.freeze(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function framesFor(actor, state, direction) {
  return actor?.animations?.[state]?.[direction] ?? [];
}

function stateReport(actor, state) {
  const counts = ISO_8_DIRECTIONS.map((direction) => framesFor(actor, state, direction).length);
  const minFrames = counts.length ? Math.min(...counts) : 0;
  const maxFrames = counts.length ? Math.max(...counts) : 0;
  return Object.freeze({
    state,
    directionsPresent: counts.filter((count) => count > 0).length,
    minFrames,
    maxFrames,
    complete: counts.every((count) => count > 0),
    smooth: minFrames >= 7 && maxFrames <= 12 && maxFrames - minFrames <= 5,
  });
}

function heroReport(key, actor) {
  const states = Object.freeze(HERO_CORE_STATES.map((state) => stateReport(actor, state)));
  const allDirectionFrames = states.flatMap((state) => ISO_8_DIRECTIONS.map((direction) => framesFor(actor, state.state, direction).length));
  const minFrames = Math.min(...allDirectionFrames);
  const maxFrames = Math.max(...allDirectionFrames);
  const coreCertified = states.every((state) => state.complete && state.smooth);
  return Object.freeze({
    key,
    characterId: actor.character_id ?? key,
    role: actor.role ?? 'hero',
    coreCertified,
    states,
    directionCoverage: Object.freeze({
      requiredDirections: ISO_8_DIRECTIONS,
      complete: states.every((state) => state.directionsPresent === ISO_8_DIRECTIONS.length),
    }),
    smoothness: Object.freeze({
      pass: states.every((state) => state.smooth),
      minFramesPerStateDirection: minFrames,
      maxFramesPerStateDirection: maxFrames,
      rule: 'All core state-direction clips must have 7-12 frames and no state spread above 5 frames.',
    }),
  });
}

export function buildHeroAnimationCertification({ roster = HMH_ANIMATED_ROSTER } = {}) {
  const heroes = Object.freeze(Object.entries(roster)
    .filter(([, actor]) => actor?.role === 'hero')
    .map(([key, actor]) => heroReport(key, actor))
    .sort((a, b) => a.key.localeCompare(b.key)));
  const totalStateReports = heroes.flatMap((hero) => hero.states);
  const averageMinFramesPerState = totalStateReports.length
    ? Number((totalStateReports.reduce((sum, state) => sum + state.minFrames, 0) / totalStateReports.length).toFixed(2))
    : 0;
  const coreCertifiedHeroCount = heroes.filter((hero) => hero.coreCertified).length;
  return Object.freeze({
    version: 'wo-19-hero-animation-certification-v1',
    generatedBy: 'scripts/hero-animation-certification.mjs',
    requiredCoreStates: HERO_CORE_STATES,
    requiredDirections: ISO_8_DIRECTIONS,
    summary: Object.freeze({
      heroCount: heroes.length,
      coreCertifiedHeroCount,
      failedHeroCount: heroes.length - coreCertifiedHeroCount,
      averageMinFramesPerState,
    }),
    finalCompletionPack: Object.freeze({
      id: HMH_FINAL_ANIMATION_COMPLETION_PACK.id,
      heroActorCount: HMH_FINAL_ANIMATION_COMPLETION_PACK.actors.filter((actor) => actor.role === 'hero').length,
      heroPolishStates: Object.freeze([...(HMH_FINAL_ANIMATION_COMPLETION_PACK.heroPolishStates ?? [])]),
      framesPerDirection: HMH_FINAL_ANIMATION_COMPLETION_PACK.framesPerDirection,
    }),
    heroes,
    recommendations: Object.freeze([
      'Use the runtime roster, not still fallbacks, as the hero certification source of truth.',
      'Treat final completion-pack polish states as additive; core gameplay certification remains idle/walk/run/shoot/melee/throw/hurt/death across all 8 directions.',
      'Regenerate with `npm run design:hero-cert` after hero art or frame-selection changes.',
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

export function renderHeroAnimationCertificationMarkdown(cert) {
  const heroRows = cert.heroes.map((hero) => [
    hero.key,
    hero.coreCertified ? 'certified' : 'needs work',
    hero.directionCoverage.complete ? '8/8 dirs' : 'incomplete',
    hero.smoothness.pass ? 'pass' : 'fail',
    `${hero.smoothness.minFramesPerStateDirection}-${hero.smoothness.maxFramesPerStateDirection}`,
  ]);
  const stateRows = cert.heroes.flatMap((hero) => hero.states.map((state) => [
    hero.key,
    state.state,
    `${state.directionsPresent}/8`,
    `${state.minFrames}-${state.maxFrames}`,
    state.complete && state.smooth ? 'pass' : 'fail',
  ]));
  return `# Hard Money Heroes Hero Animation Certification\n\nGenerated by \`${cert.generatedBy}\`.\n\n## Summary\n\n- Version: ${cert.version}\n- Heroes certified: ${cert.summary.coreCertifiedHeroCount}/${cert.summary.heroCount}\n- Failed heroes: ${cert.summary.failedHeroCount}\n- Average minimum frames per state-direction: ${cert.summary.averageMinFramesPerState}\n- Core states: ${cert.requiredCoreStates.join(', ')}\n- Directions: ${cert.requiredDirections.join(', ')}\n\n## Smoothness rule\n\n${cert.heroes[0]?.smoothness.rule ?? 'No rule available.'}\n\n## Hero certification\n\n${table(['Hero', 'Certification', 'Direction coverage', 'Smoothness', 'Frame range'], heroRows)}\n\n## State detail\n\n${table(['Hero', 'State', 'Directions', 'Frame range', 'Status'], stateRows)}\n\n## Final completion-pack polish\n\n- Pack: ${cert.finalCompletionPack.id}\n- Hero actors: ${cert.finalCompletionPack.heroActorCount}\n- Frames per direction: ${cert.finalCompletionPack.framesPerDirection}\n- Additive polish states: ${cert.finalCompletionPack.heroPolishStates.join(', ')}\n\n## Recommendations\n\n${cert.recommendations.map((item) => `- ${item}`).join('\n')}\n`;
}

export function writeHeroAnimationCertification({ repoRoot = repoRootFromHere() } = {}) {
  const cert = buildHeroAnimationCertification();
  const outputDir = path.join(repoRoot, 'docs', 'art');
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'HERO_ANIMATION_CERTIFICATION.json');
  const mdPath = path.join(outputDir, 'HERO_ANIMATION_CERTIFICATION.md');
  writeFileSync(jsonPath, `${JSON.stringify(cert, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, renderHeroAnimationCertificationMarkdown(cert), 'utf8');
  return Object.freeze({ cert, jsonPath, mdPath });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const { cert, jsonPath, mdPath } = writeHeroAnimationCertification();
  console.log(`Hero animation certification written: ${jsonPath}`);
  console.log(`Hero animation certification markdown written: ${mdPath}`);
  console.log(`Certified heroes: ${cert.summary.coreCertifiedHeroCount}/${cert.summary.heroCount}; failed: ${cert.summary.failedHeroCount}`);
}
