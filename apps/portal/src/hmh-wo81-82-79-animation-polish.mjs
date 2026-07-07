import { HMH_WO81_ANIMATION_PRINCIPLES_GATES, HMH_WO79_AMBIENT_MOTION_PLAN, HMH_WO82_HERO_POLISH_PLAN } from './hmh-post-anchor-work-orders.mjs';
import { buildWave3ArtMatrixReport } from './wave3-art-matrix.mjs';

const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

export function buildWo818279AnimationPolishCertification({ matrix = buildWave3ArtMatrixReport() } = {}) {
  const heroGate = matrix.gates.find((gate) => gate.id === 'hero-state-direction-matrix');
  const enemyGate = matrix.gates.find((gate) => gate.id === 'enemy-readability-matrix');
  const fallbackGate = matrix.gates.find((gate) => gate.id === 'legacy-fallback-policy');
  const litHeroRows = matrix.heroes.rows.filter((row) => row.actorId === 'lit-commando' || row.actorId === 'lit-valkyrie');
  const litHeroMissingCells = litHeroRows.reduce((sum, row) => sum + row.missingDirections.length, 0);

  return Object.freeze({
    id: 'hmh-wo81-82-79-animation-polish-cert-v1',
    workOrders: Object.freeze(['WO-81', 'WO-82', 'WO-79']),
    status: heroGate?.status === 'pass' && fallbackGate?.status === 'pass' ? 'certified-runtime-polish-gates' : 'blocked-by-animation-gaps',
    sourcePolicy: 'Use existing runtime manifests and final completion packs; do not mask missing animation with still-only, rectangle, or cross-character fallbacks.',
    wo81Principles: HMH_WO81_ANIMATION_PRINCIPLES_GATES,
    wo82HeroPolish: HMH_WO82_HERO_POLISH_PLAN,
    wo79AmbientMotion: HMH_WO79_AMBIENT_MOTION_PLAN,
    gates: freeze([
      { id: 'wo81-principles-defined', status: HMH_WO81_ANIMATION_PRINCIPLES_GATES.length === 5 ? 'pass' : 'fail', metric: `${HMH_WO81_ANIMATION_PRINCIPLES_GATES.length}/5 gates` },
      { id: 'wo82-lit-hero-coverage', status: litHeroMissingCells === 0 ? 'pass' : 'fail', metric: `${litHeroRows.length} rows, ${litHeroMissingCells} missing direction cells` },
      { id: 'wo79-ambient-motion-plan', status: HMH_WO79_AMBIENT_MOTION_PLAN.quotas.length >= 4 ? 'pass' : 'fail', metric: `${HMH_WO79_AMBIENT_MOTION_PLAN.quotas.length} quota classes` },
      { id: 'wave3-hero-state-direction-matrix', status: heroGate?.status ?? 'missing', metric: heroGate?.metric ?? 'missing' },
      { id: 'wave3-enemy-readability-matrix', status: enemyGate?.status ?? 'missing', metric: enemyGate?.metric ?? 'missing' },
      { id: 'legacy-fallback-policy', status: fallbackGate?.status ?? 'missing', metric: fallbackGate?.metric ?? 'missing' },
    ]),
    litHeroSummary: Object.freeze({
      actors: Object.freeze(['lit-commando', 'lit-valkyrie']),
      rowCount: litHeroRows.length,
      missingDirectionCells: litHeroMissingCells,
      certified: litHeroMissingCells === 0,
    }),
    ambientMotionRuntimeRules: freeze([
      { rule: 'reduced-motion-safe', acceptance: HMH_WO79_AMBIENT_MOTION_PLAN.reducedMotion },
      { rule: 'critters-never-in-boss-lock', acceptance: 'ambient critter loops are calm-pocket-only and stay out of boss locks' },
      { rule: 'weather-under-perf-budget', acceptance: 'weather loops use capped rain/ripple/steam passes and never block combat readability' },
      { rule: 'blank-signage-only', acceptance: 'signage animation stays textless and uses glow/flicker, not readable words/logos' },
    ]),
  });
}

export const HMH_WO81_82_79_ANIMATION_POLISH_CERTIFICATION = buildWo818279AnimationPolishCertification();
