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
    approvedDirection: '16-bit-isometric-crypto-wasteland',
  }),
]);

const LANDMARK_BY_KEY = new Map(LANDMARKS.map((asset) => [asset.key, asset]));

export const HMH_LEVEL_ONE_WORLD_V3_LANDMARKS = Object.freeze({
  id: 'hmh-level-one-world-v3-landmarks-v1',
  status: 'runtime-ready',
  assets: LANDMARKS,
});

export function levelOneWorldV3LandmarkAssetByKey(key) {
  return LANDMARK_BY_KEY.get(key) ?? null;
}
