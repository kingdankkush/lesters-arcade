import { HMH_FINAL_COMBAT_VFX_PACK } from '../assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs';
import { HMH_VFX_UI_CHROME_PACK } from '../assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs';
import { HMH_PICKUP_ICON_PACK } from '../assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs';
import { HMH_ACHIEVEMENT_ATLAS } from '../assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs';
import { HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION } from './hmh-wo86-89-audio-av.mjs';

const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

const VFX_EVENT_BINDINGS = Object.freeze({
  'muzzle-flash-pistol': Object.freeze({ event: 'weapon-fire', actorFrame: 'hero/shoot frame 0-1', timing: 'starts on muzzle frame, clears before next projectile tracer' }),
  'muzzle-flash-rail': Object.freeze({ event: 'weapon-fire-rare', actorFrame: 'hero/shoot frame 0-1', timing: 'starts on Hash Rail charge release, never replaces coded rail tracer' }),
  'hit-spark-metal': Object.freeze({ event: 'impact-armored', actorFrame: 'enemy/hit frame 0', timing: 'lands on damage confirmation frame' }),
  'hit-spark-flesh': Object.freeze({ event: 'impact-soft', actorFrame: 'enemy/hit frame 0', timing: 'lands on damage confirmation frame' }),
  'shell-casing-brass': Object.freeze({ event: 'weapon-fire-casing', actorFrame: 'hero/shoot frame 1', timing: 'ejects after muzzle flash so shot readability stays clear' }),
  'coin-pickup-pop': Object.freeze({ event: 'pickup', actorFrame: 'pickup contact frame', timing: 'spawns on pickup collection and resolves under 0.5s' }),
  'grenade-explosion-ring': Object.freeze({ event: 'grenade-impact', actorFrame: 'grenade detonation frame', timing: 'frame 0 aligns with blast damage application' }),
  'death-dust-burst': Object.freeze({ event: 'enemy-death', actorFrame: 'enemy/death frame 0', timing: 'starts on death state entry, below body silhouette' }),
  'gore-pixel-splatter': Object.freeze({ event: 'gore-enabled-death', actorFrame: 'enemy/death frame 0', timing: 'only after gore toggle and density dampening' }),
  'level-up-burst': Object.freeze({ event: 'level-up', actorFrame: 'level-up UI open', timing: 'starts when player control is paused for reward selection' }),
});

function vfxTimingRows() {
  return freeze(HMH_FINAL_COMBAT_VFX_PACK.assets.map((asset) => ({
    key: asset.key,
    category: asset.category,
    role: asset.role,
    frames: asset.frames,
    frameMs: asset.frameMs,
    durationMs: asset.frames * asset.frameMs,
    ...(VFX_EVENT_BINDINGS[asset.key] ?? { event: 'unbound', actorFrame: 'n/a', timing: 'unbound' }),
  })));
}

function audioSyncRows() {
  return freeze([
    { animationEvent: 'hero/shoot frame 0', cue: 'weapon-fire', mixLane: 'transient', maxSimultaneous: 5, haltIfMissing: true },
    { animationEvent: 'enemy/hit frame 0', cue: 'enemy-hit', mixLane: 'impact', maxSimultaneous: 8, haltIfMissing: true },
    { animationEvent: 'enemy/death frame 0', cue: 'enemy-death', mixLane: 'impact-tail', maxSimultaneous: 4, haltIfMissing: true },
    { animationEvent: 'boss/super-telegraph frame 0', cue: 'boss-warning', mixLane: 'warning', maxSimultaneous: 1, haltIfMissing: true },
    { animationEvent: 'pickup/contact frame', cue: 'pickup', mixLane: 'reward', maxSimultaneous: 3, haltIfMissing: true },
    { animationEvent: 'level-up modal open', cue: 'level-up', mixLane: 'reward', maxSimultaneous: 1, haltIfMissing: true },
  ]);
}

function uiSkinRows() {
  return freeze([
    ...HMH_VFX_UI_CHROME_PACK.uiChrome.map((asset) => ({ key: asset.key, kind: asset.kind, role: asset.role, width: asset.width, height: asset.height, src: asset.src })),
    ...HMH_VFX_UI_CHROME_PACK.vfx.map((asset) => ({ key: asset.key, kind: asset.kind, role: asset.role, width: asset.width, height: asset.height, src: asset.src })),
  ]);
}

export function buildWo111114ShipCandidateCertification() {
  const vfxRows = vfxTimingRows();
  const audioRows = audioSyncRows();
  const audioGatesPass = HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION.gates.every((gate) => gate.status === 'pass');
  const uiRows = uiSkinRows();
  return Object.freeze({
    id: 'hmh-wo111-114-ship-candidate-lock-v1',
    seed: 1337,
    generatedBy: 'apps/portal/src/hmh-wo111-114-ship-candidate.mjs',
    workOrders: Object.freeze(['WO-111', 'WO-112', 'WO-113', 'WO-114']),
    wo111: Object.freeze({
      status: 'final-vfx-timing-locked',
      vfxPackId: HMH_FINAL_COMBAT_VFX_PACK.id,
      assetCount: HMH_FINAL_COMBAT_VFX_PACK.assetCount,
      excludesNormalBulletSprites: HMH_FINAL_COMBAT_VFX_PACK.excludesNormalBulletSprites,
      timingRows: vfxRows,
      minute8DensityCapture: Object.freeze({ seed: 1337, elapsedSeconds: 480, command: 'npm run visual:regression', status: 'automated-baseline-gate' }),
    }),
    wo112: Object.freeze({
      status: audioGatesPass ? 'audio-sync-mix-density-locked' : 'blocked-by-audio-gates',
      audioCertId: HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION.id,
      gateCount: HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION.gates.length,
      gatesPass: audioGatesPass,
      syncRows: audioRows,
      mixDensity: Object.freeze({ maxTransientVoices: 8, bossWarningExclusive: true, haltCount: audioRows.filter((row) => row.haltIfMissing).length }),
    }),
    wo113: Object.freeze({
      status: 'ship-candidate-ui-skin-locked',
      uiChromePackId: HMH_VFX_UI_CHROME_PACK.id,
      uiChromeAssetCount: HMH_VFX_UI_CHROME_PACK.assetCount,
      pickupIconCount: HMH_PICKUP_ICON_PACK.assetCount,
      achievementIconCount: HMH_ACHIEVEMENT_ATLAS.achievementCount,
      skinRows: uiRows,
      checkpoint4: Object.freeze({ label: 'Playtest Checkpoint 4', noticePath: 'docs/game-design/PLAYTEST_CHECKPOINT_4_NOTICE.md', verdict: 'ship-candidate build ready; Justin final playtest verdict remains open' }),
    }),
    wo114: Object.freeze({
      status: 'ship-art-census-baseline-locked',
      artCensusPath: 'docs/art/GLOBAL_ART_CENSUS.json',
      artCensusMarkdownPath: 'docs/art/GLOBAL_ART_CENSUS.md',
      artCensusCommand: 'npm run design:art-census',
      visualBaselineCommand: 'npm run visual:regression',
      seed: 1337,
      placeholderPolicy: 'No unresolved zero-animation actors remain in SHIP_ART_CENSUS; repaired/deferred legacy rows are explicit and test-covered.',
    }),
  });
}

export const HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION = buildWo111114ShipCandidateCertification();
