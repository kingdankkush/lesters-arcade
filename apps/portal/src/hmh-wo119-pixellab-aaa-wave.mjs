import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { assetSrcForFrameRef } from './atlas-frame-ref.mjs';
import {
  LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS,
  LEVEL_1_PIXELLAB_RUNTIME_MAP_UPGRADES,
  getLevelOnePixellabRuntimeSceneObjects,
} from './authored-world-layout.mjs';

const ROOT_URL = new URL('../../../', import.meta.url);
export const WO119_REQUIRED_STATES = Object.freeze(['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in']);
export const WO119_REQUIRED_DIRECTIONS = Object.freeze(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);

function repoPath(path) {
  return fileURLToPath(new URL(path, ROOT_URL));
}

function frameExists(src) {
  const assetSrc = assetSrcForFrameRef(src);
  return typeof assetSrc === 'string' && assetSrc.startsWith('./assets/generated/') && existsSync(repoPath(`apps/portal/${assetSrc.replace(/^\.\//, '')}`));
}

function buildPaperHandMatrix(entry = HMH_ANIMATED_ROSTER['paper-hand']) {
  const rows = [];
  for (const state of WO119_REQUIRED_STATES) {
    for (const direction of WO119_REQUIRED_DIRECTIONS) {
      const frames = entry?.animations?.[state]?.[direction] ?? [];
      rows.push(Object.freeze({
        actorKey: 'paper-hand',
        state,
        direction,
        frameCount: frames.length,
        firstFrame: frames[0] ?? null,
        exists: frames.length > 0 && frames.every(frameExists),
      }));
    }
  }
  return Object.freeze(rows);
}

function readCandidateManifest() {
  const text = readFileSync(repoPath('apps/portal/assets/generated/hmh-coherent-world/level1-reference-style/candidates/level1-pixellab-candidates.manifest.json'), 'utf8');
  return JSON.parse(text);
}

function buildWorldRows() {
  const manifest = readCandidateManifest();
  const entries = new Map(manifest.entries.map((entry) => [entry.key, entry]));
  const runtimeAssetKeys = Object.values(LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS);
  return Object.freeze(runtimeAssetKeys.map((runtimeKey) => {
    const manifestKey = runtimeKey.replace('level1-reference-style/candidates/', '');
    const entry = entries.get(manifestKey);
    const sceneObjects = Object.values(LEVEL_1_PIXELLAB_RUNTIME_MAP_UPGRADES)
      .flat()
      .filter((object) => object.assetKey === runtimeKey);
    return Object.freeze({
      runtimeKey,
      manifestKey,
      src: entry?.src ?? `./assets/generated/hmh-coherent-world/${runtimeKey}.png`,
      exists: existsSync(repoPath(`apps/portal/assets/generated/hmh-coherent-world/${runtimeKey}.png`)),
      alphaClean: entry?.alphaClean === true,
      runtimeIntegrated: entry?.runtimeIntegrated === true || entry?.runtimeSurfaceIntegrated === true,
      routeBeats: Object.freeze([...new Set(sceneObjects.map((object) => object.routeBeat).filter(Boolean))]),
      districts: Object.freeze([...new Set(sceneObjects.map((object) => object.districtId).filter(Boolean))]),
      roles: Object.freeze([...new Set(sceneObjects.map((object) => object.role).filter(Boolean))]),
    });
  }));
}

const paperHand = HMH_ANIMATED_ROSTER['paper-hand'];
const paperHandMatrix = buildPaperHandMatrix(paperHand);
const worldRows = buildWorldRows();
const districtSceneObjectCounts = Object.freeze({
  desertApproach: getLevelOnePixellabRuntimeSceneObjects('desert-approach').length,
  ghostTown: getLevelOnePixellabRuntimeSceneObjects('ghost-town').length,
  countryRoad: getLevelOnePixellabRuntimeSceneObjects('country-road').length,
  residentialEdge: getLevelOnePixellabRuntimeSceneObjects('residential-edge').length,
  innerCityThreshold: getLevelOnePixellabRuntimeSceneObjects('inner-city-threshold').length,
});

export const HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION = Object.freeze({
  id: 'hmh-wo119-pixellab-aaa-wave-v1',
  enemyReplacement: Object.freeze({
    actorKey: 'paper-hand',
    characterId: paperHand?.character_id ?? null,
    source: paperHand?.source ?? null,
    qualityTarget: paperHand?.quality_target ?? null,
    stateCount: WO119_REQUIRED_STATES.length,
    directionCount: WO119_REQUIRED_DIRECTIONS.length,
    frameCount: paperHandMatrix.reduce((sum, row) => sum + row.frameCount, 0),
    matrix: paperHandMatrix,
  }),
  levelDesign: Object.freeze({
    runtimeAssetCount: worldRows.length,
    worldRows,
    districtSceneObjectCounts,
    requiredDistrictCount: 5,
  }),
  docs: Object.freeze({
    proofSheet: 'docs/game-design/wo119-pixellab-aaa-wave/wo119-pixellab-aaa-wave-proof.png',
    certificationJson: 'docs/game-design/wo119-pixellab-aaa-wave/wo119-pixellab-aaa-wave-certification.json',
    readme: 'docs/game-design/wo119-pixellab-aaa-wave/README.md',
  }),
  gates: Object.freeze({
    fullPaperHandMatrix: paperHandMatrix.every((row) => row.exists && row.frameCount >= 7),
    paperHandSourceIsPixellabAaaWave: paperHand?.source === 'pixellab-aaa-quality-wave-v1',
    worldAssetsExist: worldRows.every((row) => row.exists),
    worldAssetsRuntimeIntegrated: worldRows.every((row) => row.runtimeIntegrated),
    allLevelOneDistrictsHavePixellabRuntimeObjects: Object.values(districtSceneObjectCounts).every((count) => count > 0),
  }),
});
