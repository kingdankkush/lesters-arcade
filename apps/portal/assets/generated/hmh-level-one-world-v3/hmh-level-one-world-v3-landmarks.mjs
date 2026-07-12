const LANDMARKS = Object.freeze([
  Object.freeze({
    key: 'world-v3-landmark/wrecked-litecoin-lighthouse',
    src: './assets/generated/hmh-level-one-world-v3/landmarks/wrecked-litecoin-lighthouse.png',
    width: 256,
    height: 256,
    frameWidth: 256,
    frameHeight: 256,
    frames: 1,
    animated: false,
    role: 'landmark',
    footprintTiles: Object.freeze({ w: 4.2, h: 3.2 }),
    source: 'original-fal-flux2-klein-plus-alpha-cleanup-palette-normalization',
    provenance: Object.freeze({
      provider: 'fal.ai',
      model: 'flux-2-klein-9b',
      sourceArtifact: 'wrecked-litecoin-lighthouse-source.png',
      sourceSha256: '4122e866868e13166bc8eeca919fbdefabbb8eccdbc5993e27857056bf05a079',
      processing: 'connected-background alpha cleanup; 48-color quantization; 256x256 nearest-neighbor normalization',
    }),
    approvedDirection: '16-bit-isometric-crypto-wasteland',
  }),
  Object.freeze({
    key: 'world-v3-landmark/ghost-saloon-square',
    src: './assets/generated/hmh-level-one-world-v3/landmarks/ghost-saloon-square.png',
    width: 256, height: 256, frameWidth: 256, frameHeight: 256,
    frames: 1, animated: false, role: 'landmark',
    footprintTiles: Object.freeze({ w: 5.0, h: 3.6 }),
    source: 'original-fal-flux2-klein-plus-alpha-cleanup-palette-normalization',
    provenance: Object.freeze({
      provider: 'fal.ai',
      model: 'flux-2-klein-9b',
      sourceArtifact: 'ghost-saloon-square-source.png',
      sourceSha256: 'a0a135121e981efb616f3535d8aee4c7e8a54e199174a4760b70cdefe465b347',
      processing: 'magenta-family alpha cleanup; 64-color maximum quantization; bottom-center 256x256 nearest-neighbor normalization',
    }),
    approvedDirection: '16-bit-isometric-crypto-wasteland',
  }),
  Object.freeze({
    key: 'world-v3-landmark/dry-forest-cave-mouth',
    src: './assets/generated/hmh-level-one-world-v3/landmarks/dry-forest-cave-mouth.png',
    width: 256, height: 256, frameWidth: 256, frameHeight: 256,
    frames: 1, animated: false, role: 'landmark',
    footprintTiles: Object.freeze({ w: 5.2, h: 4.0 }),
    source: 'original-fal-flux2-klein-plus-alpha-cleanup-palette-normalization',
    provenance: Object.freeze({
      provider: 'fal.ai',
      model: 'flux-2-klein-9b',
      sourceArtifact: 'dry-forest-cave-mouth-source.png',
      sourceSha256: '10594e793d0f6a0b4e0d87eee71c2373fb847e424173c3c1da98d2deb18ba2fd',
      processing: 'magenta-family alpha cleanup; 64-color maximum quantization; bottom-center 256x256 nearest-neighbor normalization',
    }),
    approvedDirection: '16-bit-isometric-crypto-wasteland',
  }),
  Object.freeze({
    key: 'world-v3-landmark/mesa-overlook-outcrop',
    src: './assets/generated/hmh-level-one-world-v3/landmarks/mesa-overlook-outcrop.png',
    width: 256, height: 256, frameWidth: 256, frameHeight: 256,
    frames: 1, animated: false, role: 'landmark',
    footprintTiles: Object.freeze({ w: 5.0, h: 4.0 }),
    source: 'original-fal-flux2-klein-plus-alpha-cleanup-palette-normalization',
    provenance: Object.freeze({
      provider: 'fal.ai',
      model: 'flux-2-klein-9b',
      sourceArtifact: 'mesa-overlook-outcrop-source.png',
      sourceSha256: '74a17540a6c0c40d67a70f1c88ad7981b4a6ffd3f0ebd9ecb2b6aa24bc2de222',
      processing: 'magenta-family alpha cleanup; 64-color maximum quantization; bottom-center 256x256 nearest-neighbor normalization',
    }),
    approvedDirection: '16-bit-isometric-crypto-wasteland',
  }),
  Object.freeze({
    key: 'world-v3-landmark/frontier-town-exchange-hall',
    src: './assets/generated/hmh-level-one-world-v3/landmarks/frontier-town-exchange-hall.png',
    width: 256, height: 256, frameWidth: 256, frameHeight: 256,
    frames: 1, animated: false, role: 'landmark',
    footprintTiles: Object.freeze({ w: 4.8, h: 3.5 }),
    source: 'original-fal-flux2-klein-plus-alpha-cleanup-palette-normalization',
    provenance: Object.freeze({
      provider: 'fal.ai',
      model: 'flux-2-klein-9b',
      sourceArtifact: 'frontier-town-exchange-hall-source.png',
      sourceSha256: '1f5c4db862d47607c4962b4788e16d72cf2b2d569ef1122b912d74f14a6cb128',
      processing: 'magenta-family alpha cleanup; 64-color maximum quantization; bottom-center 256x256 nearest-neighbor normalization',
    }),
    approvedDirection: '16-bit-isometric-crypto-wasteland',
  }),
  Object.freeze({
    key: 'world-v3-landmark/litecoin-city-threshold-gate',
    src: './assets/generated/hmh-level-one-world-v3/landmarks/litecoin-city-threshold-gate.png',
    width: 256, height: 256, frameWidth: 256, frameHeight: 256,
    frames: 1, animated: false, role: 'landmark',
    footprintTiles: Object.freeze({ w: 4.8, h: 3.0 }),
    source: 'original-fal-flux2-klein-plus-alpha-cleanup-palette-normalization',
    provenance: Object.freeze({
      provider: 'fal.ai',
      model: 'flux-2-klein-9b',
      sourceArtifact: 'litecoin-city-threshold-gate-source.png',
      sourceSha256: '41580734cd4e271c99ae845b4e1b8a9afc19c9a0fb698cea0e4652a7d45e4925',
      processing: 'magenta-family alpha cleanup; 64-color maximum quantization; bottom-center 256x256 nearest-neighbor normalization',
    }),
    approvedDirection: '16-bit-isometric-crypto-wasteland',
  }),
]);

const LANDMARK_BY_KEY = new Map(LANDMARKS.map((asset) => [asset.key, asset]));

export const HMH_LEVEL_ONE_WORLD_V3_LANDMARKS = Object.freeze({
  id: 'hmh-level-one-world-v3-landmarks-v2',
  status: 'runtime-ready',
  assets: LANDMARKS,
});

export function levelOneWorldV3LandmarkAssetByKey(key) {
  return LANDMARK_BY_KEY.get(key) ?? null;
}
