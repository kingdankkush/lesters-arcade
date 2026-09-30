// Validates the HD Tripo prop package manifest against its files, with no
// browser and no image library: WebP headers are parsed directly.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const PACKAGE = path.join(root, 'apps/portal/assets/generated/hmh-reboot-tripo-props-hd');
const RECEIPTS = path.join(root, 'docs/2.0/receipts/tripo-props-hd-20260930');
const MANIFEST = path.join(PACKAGE, 'hmh-tripo-props-hd.json');
const CLASSES = ['plants', 'props', 'structures', 'pickups'];
const FRAME_SIZE = { plants: 512, props: 512, structures: 768, pickups: 512 };
const MAX_PAGES_PER_CLASS = 2;
const HASH = /^[a-f0-9]{64}$/;
const ASSET_ID = /^b[12]-\d{2}$/;
const PAGE_NAME = /^tripo-props-hd-(plants|props|structures|pickups)-(\d{2})\.webp$/;

const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const expectedRoster = [
  ...Array.from({ length: 56 }, (_, i) => `b1-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 40 }, (_, i) => `b2-${String(i + 41).padStart(2, '0')}`),
];

function webpDimensions(file) {
  const data = readFileSync(file);
  assert.equal(data.toString('latin1', 0, 4), 'RIFF', `${file}: not RIFF`);
  assert.equal(data.toString('latin1', 8, 12), 'WEBP', `${file}: not WEBP`);
  assert.equal(data.readUInt32LE(4) + 8, data.length, `${file}: RIFF size mismatch`);
  const chunk = data.toString('latin1', 12, 16);
  if (chunk === 'VP8X') {
    return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1, lossless: null };
  }
  if (chunk === 'VP8L') {
    assert.equal(data[20], 0x2f, `${file}: bad VP8L signature`);
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, lossless: true };
  }
  if (chunk === 'VP8 ') {
    assert.deepEqual([data[23], data[24], data[25]], [0x9d, 0x01, 0x2a], `${file}: bad VP8 start code`);
    return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff, lossless: false };
  }
  assert.fail(`${file}: unknown WebP chunk ${chunk}`);
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

test('HD package manifest declares a projection-only, unaccepted candidate', () => {
  assert.equal(manifest.pipelineId, 'hmh-tripo-static-props-hd/v1');
  assert.equal(manifest.runtimeAuthority, 'projection-only');
  assert.equal(manifest.certified, false);
  assert.equal(manifest.canonicalAdoption, false);
  assert.equal(manifest.artAccepted, false);
  assert.equal(manifest.settlementLive, false);
  assert.equal(manifest.reviewed, true, 'package must be packed against a completed review');
  assert.equal(manifest.maxPageSize, 2048);
  assert.deepEqual(manifest.frameSizeByClass, FRAME_SIZE);
  assert.deepEqual(Object.keys(manifest.classes).sort(), [...CLASSES].sort());
  assert.ok(HASH.test(manifest.sources.b1.catalogSha256) && HASH.test(manifest.sources.b2.catalogSha256));
  for (const item of manifest.items) assert.equal(item.runtimeApproved, false);
});

test('every page file exists, hashes match, dimensions decode from the WebP header, and byte accounting is exact', () => {
  assert.ok(manifest.pages.length > 0);
  const seen = new Set();
  for (const [index, page] of manifest.pages.entries()) {
    const match = PAGE_NAME.exec(page.image);
    assert.ok(match, `page name ${page.image}`);
    assert.equal(match[1], page.class);
    assert.equal(Number(match[2]), page.classPageIndex);
    assert.ok(!seen.has(page.image)); seen.add(page.image);
    const file = path.join(PACKAGE, page.image);
    assert.ok(existsSync(file), `missing ${page.image}`);
    assert.equal(sha(file), page.sha256, `sha256 ${page.image}`);
    assert.equal(statSync(file).size, page.encodedBytes, `encodedBytes ${page.image}`);
    const dims = webpDimensions(file);
    assert.deepEqual([dims.width, dims.height], [page.width, page.height], `header dims ${page.image}`);
    assert.ok(page.width <= 2048 && page.height <= 2048);
    assert.equal(page.decodedBytes, page.width * page.height * 4, `decodedBytes ${page.image}`);
    assert.equal(page.lossless, true); assert.equal(page.exact, true); assert.equal(dims.lossless, true);
    assert.ok(HASH.test(page.decodedRgbaSha256));
    assert.equal(manifest.classes[page.class].pages[page.classPageIndex], page.image);
    assert.equal(page.itemCount, manifest.items.filter(item => item.page === index).length);

    const half = page.halfRes;
    assert.equal(half.image, page.image.replace(/\.webp$/, '@0.5x.webp'));
    const halfFile = path.join(PACKAGE, half.image);
    assert.ok(existsSync(halfFile), `missing ${half.image}`);
    assert.equal(sha(halfFile), half.sha256, `sha256 ${half.image}`);
    assert.equal(statSync(halfFile).size, half.encodedBytes);
    const halfDims = webpDimensions(halfFile);
    assert.deepEqual([halfDims.width, halfDims.height], [page.width / 2, page.height / 2], `half dims ${half.image}`);
    assert.deepEqual([half.width, half.height], [page.width / 2, page.height / 2]);
    assert.equal(half.decodedBytes, half.width * half.height * 4);
    assert.equal(half.lossless, false);
  }
  const sum = key => manifest.pages.reduce((total, page) => total + page[key], 0);
  assert.equal(manifest.totals.pages, manifest.pages.length);
  assert.equal(manifest.totals.items, manifest.items.length);
  assert.equal(manifest.totals.encodedBytes, sum('encodedBytes'));
  assert.equal(manifest.totals.decodedBytes, sum('decodedBytes'));
  assert.equal(manifest.totals.halfResEncodedBytes, manifest.pages.reduce((t, p) => t + p.halfRes.encodedBytes, 0));
  assert.equal(manifest.totals.halfResDecodedBytes, manifest.pages.reduce((t, p) => t + p.halfRes.decodedBytes, 0));
});

test('pages are grouped by class and no class needs more than two pages', () => {
  for (const name of CLASSES) {
    const group = manifest.classes[name];
    assert.equal(group.frameSize, FRAME_SIZE[name]);
    assert.ok(group.pages.length >= 1 && group.pages.length <= MAX_PAGES_PER_CLASS, `${name} uses ${group.pages.length} pages`);
    for (const image of group.pages) assert.equal(manifest.pages.find(page => page.image === image)?.class, name);
    const items = manifest.items.filter(item => item.class === name).map(item => item.assetId).sort();
    assert.deepEqual([...group.items].sort(), items, `${name} class roster`);
  }
  const listed = CLASSES.flatMap(name => manifest.classes[name].pages);
  assert.deepEqual(listed, manifest.pages.map(page => page.image), 'pages are listed class by class');
});

test('every item rectangle lies inside its page, is even-aligned, and never overlaps another rectangle', () => {
  const ids = new Set();
  const byPage = new Map();
  for (const item of manifest.items) {
    assert.ok(ASSET_ID.test(item.assetId), item.assetId);
    assert.ok(!ids.has(item.assetId), `duplicate ${item.assetId}`); ids.add(item.assetId);
    assert.equal(item.assetId, `${item.batch}-${item.sourceId}`);
    assert.ok(CLASSES.includes(item.class));
    assert.equal(item.frameSize, FRAME_SIZE[item.class]);
    const page = manifest.pages[item.page];
    assert.ok(page, `${item.assetId} page index`);
    assert.equal(page.image, item.pageImage);
    assert.equal(page.class, item.class, `${item.assetId} sits on a page of another class`);
    const rect = item.frame;
    for (const key of ['x', 'y', 'w', 'h']) {
      assert.ok(Number.isInteger(rect[key]) && rect[key] >= 0 && rect[key] % 2 === 0, `${item.assetId} frame.${key}`);
    }
    assert.ok(rect.w > 0 && rect.h > 0);
    assert.ok(rect.x + rect.w <= page.width && rect.y + rect.h <= page.height, `${item.assetId} outside page`);
    assert.ok(rect.w <= item.frameSize && rect.h <= item.frameSize, `${item.assetId} larger than its render frame`);
    const trim = item.renderFrame.trim;
    assert.equal(item.renderFrame.size, item.frameSize);
    assert.ok(trim.x >= 0 && trim.y >= 0 && trim.x + rect.w <= item.frameSize && trim.y + rect.h <= item.frameSize);
    const alpha = item.alphaBounds;
    assert.ok(alpha.x >= 0 && alpha.y >= 0 && alpha.w > 0 && alpha.h > 0 && alpha.x + alpha.w <= rect.w && alpha.y + alpha.h <= rect.h, `${item.assetId} alpha bounds`);
    const pivot = item.groundAnchorPixels;
    assert.ok(pivot.x >= 0 && pivot.y >= 0 && pivot.x <= rect.w - 1 && pivot.y <= rect.h - 1, `${item.assetId} pivot`);
    assert.ok(Math.abs(item.anchor.x - pivot.x / (rect.w - 1)) < 1e-9 && Math.abs(item.anchor.y - pivot.y / (rect.h - 1)) < 1e-9, `${item.assetId} anchor`);
    assert.ok(pivot.y >= alpha.y, `${item.assetId} ground pivot floats above the painted top`);
    assert.equal(item.groundFootprintPixels.length, 4);
    for (const point of item.groundFootprintPixels) assert.ok(point.every(Number.isFinite));
    assert.equal(item.modelDimensions.length, 3);
    assert.ok([0, 90, 180, 270].includes(item.cameraYawDegrees));
    for (const key of ['sourceModelSha256', 'renderFileSha256', 'sourcePixelSha256']) assert.ok(HASH.test(item[key]), `${item.assetId} ${key}`);
    assert.ok(['ok', 'fixed'].includes(item.review), `${item.assetId} review ${item.review}`);
    const list = byPage.get(item.page) ?? [];
    for (const prior of list) assert.ok(!overlaps(prior.frame, rect), `${item.assetId} overlaps ${prior.assetId}`);
    list.push(item); byPage.set(item.page, list);
  }
});

test('accepted plus rejected items cover both delivery rosters exactly once', () => {
  const accepted = manifest.items.map(item => item.assetId);
  const rejected = manifest.rejected.map(item => item.assetId);
  for (const item of manifest.rejected) assert.ok(typeof item.reason === 'string' && item.reason.length > 0);
  for (const id of rejected) assert.ok(!accepted.includes(id), `rejected ${id} still packed`);
  assert.deepEqual([...accepted, ...rejected].sort(), expectedRoster);
  const review = JSON.parse(readFileSync(path.join(RECEIPTS, 'review.json'), 'utf8'));
  assert.deepEqual(Object.keys(review.items).sort(), expectedRoster);
  for (const item of manifest.items) assert.equal(review.items[item.assetId].status, item.review);
  for (const id of rejected) assert.equal(review.items[id].status, 'rejected');
});

test('receipts and contact sheets are bound to the manifest by hash', () => {
  assert.equal(sha(path.join(RECEIPTS, 'render-receipts.json')), manifest.renderReceiptsSha256);
  const receipts = JSON.parse(readFileSync(path.join(RECEIPTS, 'render-receipts.json'), 'utf8'));
  for (const item of manifest.items) {
    const receipt = receipts.items[item.assetId];
    assert.ok(receipt, `${item.assetId} receipt`);
    assert.equal(receipt.status, 'pass');
    assert.equal(receipt.sourceModelsUnchanged, true);
    assert.equal(receipt.sourceModelSha256Before, item.sourceModelSha256);
    assert.equal(receipt.sourceModelSha256After, item.sourceModelSha256);
    assert.equal(receipt.renderFileSha256.a, item.renderFileSha256);
    const comparison = receipt.comparison;
    assert.ok(comparison, `${item.assetId} A/B comparison`);
    if (comparison.exact !== true) {
      // Sub-perceptual z-fight noise is tolerated only within the receipt's own recorded bound.
      assert.equal(comparison.withinTolerance, true, `${item.assetId} A/B beyond tolerance`);
      assert.ok(comparison.differingPixels <= 64 && comparison.maxAbsDelta <= 8, `${item.assetId} A/B tolerance bound`);
      assert.equal(item.review, 'fixed', `${item.assetId} non-exact A/B must be reviewed as fixed`);
    }
    assert.equal(receipt.cameraYawDegrees, item.cameraYawDegrees);
  }
  assert.equal(manifest.contactSheets.length, manifest.pages.length);
  for (const sheet of manifest.contactSheets) {
    const file = path.join(RECEIPTS, sheet.image);
    assert.ok(existsSync(file), `missing ${sheet.image}`);
    assert.equal(sha(file), sheet.sha256, `sha256 ${sheet.image}`);
    assert.ok(manifest.pages.some(page => page.image === `${sheet.page}.webp`));
  }
});
