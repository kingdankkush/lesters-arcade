import {
  HMH_WO86_AUDIO_BAKEOFF,
  HMH_WO87_FULL_SFX_INVENTORY,
  HMH_WO88_SCORE_PLAN,
  HMH_WO89_AV_SYNC_POLISH,
} from './hmh-post-anchor-work-orders.mjs';
import { HMH_SFX_CUE_REGISTRY, validateHmhAudioSystem } from './hmh-audio-system.mjs';

const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

export const HMH_WO86_89_SHOWCASE_REEL_SHOTLIST = freeze([
  { second: '00-08', beat: 'spawn-ready', visual: 'Lit hero at compact Level 1 spawn', audio: 'base rain pulse + level-start sting', cue: 'level-start' },
  { second: '08-18', beat: 'pickup-and-first-hit', visual: 'pickup sparkle into first enemy hit', audio: 'pickup sparkle on beat, enemy-hit transient', cue: 'pickup' },
  { second: '18-30', beat: 'pressure-layer', visual: 'swarm pressure with weapon cadence', audio: 'combat arpeggio + weapon-fire/impact ducking', cue: 'weapon-fire' },
  { second: '30-42', beat: 'boss-warning', visual: 'boss warning/telegraph and screen shake', audio: 'boss brass hit layer, warning swell', cue: 'boss-warning' },
  { second: '42-53', beat: 'death-burst', visual: 'elite death or signature boss spectacle', audio: 'death burst tail with impact duck', cue: 'enemy-death' },
  { second: '53-60', beat: 'victory-settle', visual: 'upgrade or victory UI settle', audio: 'victory release sting + UI confirm', cue: 'level-up' },
]);

export function buildWo8689AudioAvCertification({ manifestCues = [], runtimeCues = Object.keys(HMH_SFX_CUE_REGISTRY) } = {}) {
  const validation = validateHmhAudioSystem({ manifestCues, runtimeCues });
  const inventoryCueCoverage = HMH_WO87_FULL_SFX_INVENTORY.map((row) => ({
    ...row,
    registryCue: row.cue === 'weapon-fire' ? 'weapon-fire'
      : row.cue === 'boss-warning' ? 'boss-warning'
        : row.cue === 'game-over' ? 'game-over'
          : row.cue === 'pickup' ? 'pickup'
            : row.cue === 'enemy-hit' ? 'enemy-hit'
              : row.cue === 'player-hit' ? 'player-hit'
                : row.cue === 'dash' ? 'jump'
                  : row.cue === 'level-clear' ? 'level-up'
                    : null,
  }));
  const missingInventoryCues = inventoryCueCoverage.filter((row) => row.registryCue && !HMH_SFX_CUE_REGISTRY[row.registryCue]);

  return Object.freeze({
    id: 'hmh-wo86-87-88-89-audio-av-cert-v1',
    workOrders: Object.freeze(['WO-86', 'WO-87', 'WO-88', 'WO-89']),
    status: validation.ok && missingInventoryCues.length === 0 ? 'certified-runtime-audio-av-plan' : 'blocked-by-audio-gaps',
    sourcePolicy: 'Use existing WebAudio synth/sample fallback first; commit only final runtime-safe audio assets with provenance after A/B review.',
    wo86Bakeoff: HMH_WO86_AUDIO_BAKEOFF,
    wo87SfxInventory: HMH_WO87_FULL_SFX_INVENTORY,
    wo88ScorePlan: HMH_WO88_SCORE_PLAN,
    wo89AvSync: HMH_WO89_AV_SYNC_POLISH,
    showcaseReelShotlist: HMH_WO86_89_SHOWCASE_REEL_SHOTLIST,
    audioValidation: validation,
    gates: freeze([
      { id: 'sfx-registry-validation', status: validation.ok ? 'pass' : 'fail', metric: `${validation.cueCount} cues, ${validation.gaps.length} gaps` },
      { id: 'sfx-inventory-mapping', status: missingInventoryCues.length === 0 ? 'pass' : 'fail', metric: `${inventoryCueCoverage.length} inventory rows` },
      { id: 'pressure-stems', status: HMH_WO88_SCORE_PLAN.stems.length >= 5 ? 'pass' : 'fail', metric: `${HMH_WO88_SCORE_PLAN.stems.length} stems` },
      { id: 'av-sync-moments', status: HMH_WO89_AV_SYNC_POLISH.syncMoments.length >= 5 ? 'pass' : 'fail', metric: `${HMH_WO89_AV_SYNC_POLISH.syncMoments.length} moments` },
      { id: 'showcase-shotlist', status: HMH_WO86_89_SHOWCASE_REEL_SHOTLIST.length === 6 ? 'pass' : 'fail', metric: '60 second reel / 6 beats' },
    ]),
    inventoryCueCoverage: freeze(inventoryCueCoverage),
  });
}

export const HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION = buildWo8689AudioAvCertification();
