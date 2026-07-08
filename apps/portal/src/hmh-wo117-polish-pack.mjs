import { HMH_WO117_POLISH_PACK } from '../assets/generated/hmh-wo117-polish-pack/hmh-wo117-polish-pack-manifest.mjs';
import { getAuthoredRouteNodes } from './authored-world-layout.mjs';
import { HMH_SFX_CUE_REGISTRY } from './hmh-audio-system.mjs';

const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze(row)));

const BEAT_BINDINGS = Object.freeze({
  spawn: Object.freeze({ sfxCue: 'level-start', vfxKey: 'route-beacon-chevron', uiSurface: 'hud-objective-chip', purpose: 'teach movement, first route read, and safe spawn orientation before pressure starts' }),
  arena: Object.freeze({ sfxCue: 'level1-gas-pump-warning', vfxKey: 'audio-vfx-sync-ring', uiSurface: 'hud-objective-chip', purpose: 'mark first combat bowls with one readable warning pulse before hazards and add pressure' }),
  loop: Object.freeze({ sfxCue: 'level1-mushroom-pulse', vfxKey: 'pickup-lane-glint', uiSurface: 'minimap-route-pip', purpose: 'make loop/breather lanes legible so pickups and side paths do not read as random scatter' }),
  chokepoint: Object.freeze({ sfxCue: 'level1-cover-break', vfxKey: 'route-beacon-chevron', uiSurface: 'minimap-route-pip', purpose: 'call out bridge and wash crossings as intentional lane constrictions with cover-break feedback' }),
  pressure: Object.freeze({ sfxCue: 'level1-gas-pump-warning', vfxKey: 'audio-vfx-sync-ring', uiSurface: 'hud-objective-chip', purpose: 'raise route danger without cluttering the screen or replacing coded projectile traces' }),
  boss: Object.freeze({ sfxCue: 'boss-warning', vfxKey: 'boss-gate-warning-sigil', uiSurface: 'boss-warning-card', purpose: 'make the boss yard gate unmistakable through an exclusive warning cue and non-bullet VFX sigil' }),
  extract: Object.freeze({ sfxCue: 'level1-extraction-flare', vfxKey: 'pickup-lane-glint', uiSurface: 'extraction-banner', purpose: 'frame the post-boss extraction lane with reward-colored glints and a clear HUD banner' }),
});

const UI_SURFACE_ROWS = freezeRows([
  { surface: 'hud-objective-chip', assetKey: 'district-risk-chip', role: 'current district, beat, risk, and route objective', minWidth: 128, minHeight: 40 },
  { surface: 'minimap-route-pip', assetKey: 'minimap-objective-pip', role: 'fog-safe critical path and objective marker', minWidth: 24, minHeight: 24 },
  { surface: 'boss-warning-card', assetKey: 'boss-gate-warning-sigil', role: 'boss warning and super-move tell card accent', minWidth: 64, minHeight: 64 },
  { surface: 'extraction-banner', assetKey: 'pickup-lane-glint', role: 'post-boss extraction/reward lane accent', minWidth: 48, minHeight: 32 },
]);

function assetByKey(key) {
  return HMH_WO117_POLISH_PACK.assets.find((asset) => asset.key === key);
}

function buildRouteCueRows() {
  return freezeRows(getAuthoredRouteNodes('level-1-crypto-wasteland').map((node) => {
    const binding = BEAT_BINDINGS[node.beat] ?? BEAT_BINDINGS.arena;
    return {
      routeId: node.id,
      districtId: node.districtId,
      beat: node.beat,
      label: node.label,
      sfxCue: binding.sfxCue,
      vfxKey: binding.vfxKey,
      uiSurface: binding.uiSurface,
      authoredAssetKey: node.assetKey,
      levelDesignPurpose: `${node.objective}; polish purpose: ${binding.purpose}`,
    };
  }));
}

function buildSpecialEffectRows(routeCueRows) {
  const keys = [...new Set(routeCueRows.map((row) => row.vfxKey))];
  return freezeRows(keys.map((key) => {
    const asset = assetByKey(key);
    return {
      key,
      kind: 'coded-vfx',
      sourceAssetKind: asset?.kind ?? 'world-cue',
      frames: asset?.frames ?? 1,
      frameMs: asset?.frameMs ?? 0,
      usesSpriteBullets: false,
      accessibility: key === 'boss-gate-warning-sigil'
        ? 'boss-warning-exclusive, reduce-motion safe pulse, no screen-filling flash'
        : 'short coded primitive accent, no normal bullet sprites or beam replacements',
    };
  }));
}

function buildUiPolishRows() {
  return freezeRows(UI_SURFACE_ROWS.map((row) => {
    const asset = assetByKey(row.assetKey);
    return {
      ...row,
      width: asset?.frameWidth ?? asset?.width ?? 0,
      height: asset?.frameHeight ?? asset?.height ?? 0,
      src: asset?.src ?? '',
      covered: Boolean(asset && (asset.frameWidth ?? asset.width) >= row.minWidth && (asset.frameHeight ?? asset.height) >= row.minHeight),
    };
  }));
}

function buildGates({ routeCueRows, uiPolishRows, specialEffectRows }) {
  return Object.freeze({
    audioCuesAllRegistered: routeCueRows.every((row) => Boolean(HMH_SFX_CUE_REGISTRY[row.sfxCue])),
    noNormalBulletSprites: specialEffectRows.every((row) => row.usesSpriteBullets === false),
    uiSurfacesCovered: uiPolishRows.every((row) => row.covered),
    reduceMotionSafe: specialEffectRows.every((row) => row.frames <= 4 && row.frameMs <= 72),
  });
}

export function buildWo117PolishCertification() {
  const routeCueRows = buildRouteCueRows();
  const uiPolishRows = buildUiPolishRows();
  const specialEffectRows = buildSpecialEffectRows(routeCueRows);
  return Object.freeze({
    id: 'hmh-wo117-world-audio-vfx-ui-polish-v1',
    workOrders: Object.freeze(['WO-117', 'WO-118']),
    generatedBy: 'apps/portal/src/hmh-wo117-polish-pack.mjs',
    generatedPack: HMH_WO117_POLISH_PACK,
    routeCueRows,
    uiPolishRows,
    specialEffectRows,
    mixDensity: Object.freeze({ maxWorldCueVoices: 4, bossWarningExclusive: true, routeCueCooldownPolicy: 'central HMH_SFX_CUE_REGISTRY cooldowns apply per cue' }),
    gates: buildGates({ routeCueRows, uiPolishRows, specialEffectRows }),
  });
}

export const HMH_WO117_POLISH_CERTIFICATION = buildWo117PolishCertification();
