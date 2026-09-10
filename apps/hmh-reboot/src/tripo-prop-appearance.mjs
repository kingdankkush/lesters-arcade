// Native art aliases only. Simulation, drops, unlocks and held weapons retain
// their existing authorities. Ambiguous/unassigned source variants stay unbound.
export const TRIPO_PROP_METADATA_URL = '/assets/generated/hmh-reboot-tripo-props/hmh-tripo-props.json';
export const TRIPO_PROP_BINDINGS = Object.freeze({
  'scrub-bush': '01', 'thorn-bramble': '02', 'birch-cluster': '03',
  'fern-cluster': '04', 'burned-snag': '05', 'flowering-weeds': '06',
  'mining-headframe-setpiece': '11', 'ruined-tenement': '52',
  'market-stall': '13', 'watchtower': '15', 'watch-platform': '15',
  'ore-cart': '16', 'sandbag-nest': '17', 'scrap-barricade': '18',
  'liquidation-terminal': '20',
  'block-reward': '21', 'cold-storage': '22', 'compound-interest': '23',
  'diamond-hands': '24', 'gas-optimization': '25', 'hard-fork-rounds': '26',
  'hardened-wallet': '27', 'hot-wallet': '28', 'layer-two': '29',
  'precision-ledger': '30', 'proof-of-work': '31', 'validator-training': '32',
  'bonus-life': '33', 'berserk-candle': '34', 'time-dilation': '35',
  'nuke-liquidation': '36', 'hash-rail-core': '37', 'lightning-ledger-cache': '38',
  'bear-market-burner-cache': '39', 'forked-standard-cache': '40',
  'balanced-boulder': '42', 'rock-shelf': '42', 'cargo-container': '43',
  'wrecked-sedan': '45', 'water-tower': '47', 'miners-shack': '48',
  'hashwood-stump': '49', 'hashwood-pine': '50', 'canopy-edge-tree': '50',
  'awning-shopfront': '51', 'dead-pine': '53', 'hashwood-tree': '54',
  'sapling-thicket': '55',
});
const HASH = /^[a-f0-9]{64}$/;
const SOURCE_ID = /^(?:0[1-9]|[1-4][0-9]|5[0-6])$/;
const positive = (value) => Number.isFinite(value) && value > 0;
const integer = (value) => Number.isInteger(value) && value >= 0;
const fail = (message) => { throw new TypeError(`Native Tripo props: ${message}`); };

function validatePages(metadata, textures) {
  if (!Array.isArray(metadata.pages) || !metadata.pages.length || metadata.pages.length > 2) fail('page budget exceeded');
  if (!Array.isArray(textures) || textures.length !== metadata.pages.length) fail('texture page count mismatch');
  const names = new Set();
  for (const [i, page] of metadata.pages.entries()) {
    if (!/^[a-z0-9-]+\.webp$/.test(page.image) || names.has(page.image)) fail('invalid or duplicate page image');
    names.add(page.image);
    if (!positive(page.width) || !positive(page.height) || !Number.isInteger(page.width) || !Number.isInteger(page.height) || page.width > 2048 || page.height > 2048) fail('invalid page size');
    if (page.lossless !== true || page.exact !== true || !HASH.test(page.sha256) || !HASH.test(page.decodedRgbaSha256)) fail('page encoding or hash contract missing');
    const source = textures[i]?.source;
    if (!source || (source.pixelWidth ?? source.width) !== page.width || (source.pixelHeight ?? source.height) !== page.height) fail('decoded texture dimensions do not match page metadata');
  }
}

function validateFrames(metadata) {
  if (metadata.assetCount !== 56 || !Array.isArray(metadata.frames) || metadata.frames.length !== 56) fail('complete 56-source roster required');
  const frames = new Map(); const rectangles = [];
  for (const frame of metadata.frames) {
    if (!SOURCE_ID.test(frame.sourceId) || frame.assetId !== `tripo-${frame.sourceId}` || frames.has(frame.sourceId)) fail('duplicate or mismatched source identity');
    if (!integer(frame.page) || !metadata.pages[frame.page]) fail('invalid frame page');
    const rect = frame.frame; const page = metadata.pages[frame.page]; const alpha = frame.alphaBounds;
    if (!rect || !integer(rect.x) || !integer(rect.y) || !positive(rect.w) || !positive(rect.h) || !Number.isInteger(rect.w) || !Number.isInteger(rect.h) || rect.x + rect.w > page.width || rect.y + rect.h > page.height) fail('frame bounds outside page');
    if (!alpha || !integer(alpha.x) || !integer(alpha.y) || !positive(alpha.w) || !positive(alpha.h) || alpha.x + alpha.w > rect.w || alpha.y + alpha.h > rect.h) fail('invalid painted alpha bounds');
    if (!frame.anchor || !Number.isFinite(frame.anchor.x) || !Number.isFinite(frame.anchor.y) || frame.anchor.x < 0 || frame.anchor.x > 1 || frame.anchor.y < 0 || frame.anchor.y > 1) fail('invalid ground anchor');
    if (!HASH.test(frame.sourceModelSha256) || !HASH.test(frame.sourcePixelSha256)) fail('source model/pixel hash missing');
    if (frame.itemImage !== undefined && (frame.itemImage !== `${frame.assetId}.webp` || !HASH.test(frame.itemSha256))) fail('item image source identity or hash mismatch');
    const expectedCategory = Number(frame.sourceId) >= 21 && Number(frame.sourceId) <= 40 ? 'power-up' : 'environment';
    if (frame.category !== expectedCategory) fail('source category mismatch');
    for (const prior of rectangles) {
      if (prior.page === frame.page && rect.x < prior.x + prior.w && rect.x + rect.w > prior.x && rect.y < prior.y + prior.h && rect.y + rect.h > prior.y) fail('overlapping packed frame bounds');
    }
    rectangles.push({ page: frame.page, ...rect });
    frames.set(frame.sourceId, frame);
  }
  for (let id = 1; id <= 56; id += 1) if (!frames.has(String(id).padStart(2, '0'))) fail('missing source identity');
  return frames;
}

export function createTripoPropAppearance(metadata, textures, legacyIndex) {
  if (metadata?.pipelineId !== 'hmh-tripo-static-props/v1' || metadata.classification !== 'production-art' || metadata.runtimeAuthority !== 'projection-only') fail('adopted production-art projection-only metadata required; candidate art is not accepted');
  if (typeof legacyIndex?.frameFor !== 'function') fail('existing authored prop index required');
  validatePages(metadata, textures);
  const sourceFrames = validateFrames(metadata); const result = new Map();
  for (const [assetId, sourceId] of Object.entries(TRIPO_PROP_BINDINGS)) {
    const legacy = legacyIndex.frameFor(assetId);
    if (!legacy) fail(`unknown canonical binding ${assetId}`);
    const source = sourceFrames.get(sourceId);
    const oldWidth = legacy.frame.w * legacy.runtimeScale;
    const maxHeight = 2 * Math.max(legacy.frame.w, legacy.frame.h) * legacy.runtimeScale;
    const runtimeScale = Math.min(oldWidth / source.alphaBounds.w, maxHeight / source.alphaBounds.h);
    if (!positive(runtimeScale)) fail('invalid projected scale');
    const frame = Object.freeze({
      ...source, category: legacy.category, runtimeScale,
      frame: Object.freeze({ ...source.frame }), anchor: Object.freeze({ ...source.anchor }),
      alphaBounds: Object.freeze({ ...source.alphaBounds }),
    });
    const itemUrl = source.itemImage ? `/assets/generated/hmh-reboot-tripo-props/items/${source.itemImage}` : null;
    result.set(assetId, Object.freeze({ frame, texture: textures[source.page], sourceAssetId: source.assetId, itemUrl }));
  }
  return result;
}

export async function loadTripoPropAppearance(legacyIndex, loadTexture, fetcher = fetch) {
  const response = await fetcher(TRIPO_PROP_METADATA_URL, { credentials: 'same-origin', cache: 'no-cache' });
  if (!response.ok) fail(`metadata request failed with ${response.status}`);
  const metadata = await response.json();
  if (metadata?.classification !== 'production-art' || metadata.runtimeAuthority !== 'projection-only') fail('adopted metadata required before texture loading');
  if (!Array.isArray(metadata.pages) || !metadata.pages.length || metadata.pages.length > 2 || metadata.pages.some(page => !/^[a-z0-9-]+\.webp$/.test(page.image))) fail('unsafe native page path or count');
  const textures = await Promise.all(metadata.pages.map(page => loadTexture(`/assets/generated/hmh-reboot-tripo-props/${page.image}`)));
  return createTripoPropAppearance(metadata, textures, legacyIndex);
}
