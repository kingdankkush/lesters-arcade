// Hard Money Heroes banner art refresh (docs/art/HMH-BANNERS-20260926.md).
// The derivatives, their manifest and the two generated data modules must agree,
// and the Python builder's --check must pass (it needs no source PNGs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const artDir = join(root, 'apps/portal/assets/hmh-art');
const manifest = JSON.parse(readFileSync(join(artDir, 'manifest.json'), 'utf8'));
const HEROES = ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly'];

// Width and height of a WebP (VP8, VP8L or VP8X) or baseline/progressive JPEG.
function imageSize(bytes) {
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (chunk === 'VP8 ') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    if (chunk === 'VP8L') {
      const bits = bytes.readUInt32LE(21);
      return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
    }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc2) return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
      offset += 2 + length;
    }
  }
  return null;
}

const outputs = () => [...manifest.images.flatMap((image) => image.outputs), manifest.og];

test('every manifest output exists with its recorded size, dimensions and hash', () => {
  for (const output of outputs()) {
    const bytes = readFileSync(join(artDir, output.path));
    assert.equal(bytes.length, output.bytes, output.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), output.sha256, output.path);
    assert.deepEqual(imageSize(bytes), [output.width, output.height], output.path);
  }
  const files = readdirSync(artDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(artDir, join(entry.parentPath ?? entry.path, entry.name)).split(sep).join('/'))
    .filter((path) => path !== 'manifest.json');
  assert.deepEqual(files.sort(), outputs().map((output) => output.path).sort(), 'no stray files under hmh-art');
  const total = outputs().reduce((sum, output) => sum + output.bytes, 0);
  assert.ok(total < 9_000_000, `derivatives total ${total} B`);
});

test('the pool covers every hero, uses 16:9 outputs and records no source PNG in the repository', () => {
  const pool = manifest.images.filter((image) => image.role === 'loading');
  assert.equal(pool.length, 18, '15 Level-Load images plus HMH-Extra, HMH-Extra2 and HMH-Extra3');
  for (const hero of HEROES) {
    const own = manifest.heroLoading[hero];
    assert.ok(pool.some((image) => image.id === own && image.heroes.length === 1 && image.heroes[0] === hero), hero);
    assert.ok(pool.filter((image) => image.heroes.includes(hero)).length >= 5, `${hero} has a set of its own`);
  }
  for (const image of manifest.images) {
    assert.match(image.sourceSha256, /^[0-9a-f]{64}$/);
    assert.ok(image.alt.length > 20, `${image.id} alt text`);
    for (const output of image.outputs) assert.equal(output.width * 9, output.height * 16, output.path);
  }
  const tracked = spawnSync('git', ['ls-files', '--', 'apps/portal/assets/hmh-art'], { cwd: root, encoding: 'utf8' }).stdout;
  assert.doesNotMatch(tracked, /\.png$/m, 'the owner PNGs stay in the vault');
});

test('the og image is a 1200x630 JPEG under 300 KB, fit for X and Discord', () => {
  assert.equal(manifest.og.width, 1200);
  assert.equal(manifest.og.height, 630);
  assert.match(manifest.og.path, /\.jpg$/);
  assert.ok(manifest.og.bytes <= 300_000);
});

test('the generated data modules match the manifest', async () => {
  const banners = await import('../apps/portal/src/generated/hmh-banner-art.mjs');
  const loading = await import('../apps/portal/src/generated/hmh-loading-art.mjs');
  const byId = new Map(manifest.images.map((image) => [image.id, image]));
  for (const [surface, id] of Object.entries(manifest.bannerSurfaces)) {
    const entry = banners.HMH_BANNER_ART[surface];
    assert.equal(entry.id, id, surface);
    assert.equal(entry.alt, byId.get(id).alt);
    for (const output of byId.get(id).outputs) {
      assert.ok(banners.hmhBannerSrcset(id).includes(`/assets/hmh-art/${output.path} ${output.width}w`), output.path);
      assert.equal(banners.hmhBannerSrc(id, output.width), `/assets/hmh-art/${output.path}`);
    }
  }
  assert.equal(banners.HMH_FREE_SHARE_OG.src, `/assets/hmh-art/${manifest.og.path}`);
  assert.deepEqual(loading.HMH_HERO_LOADING, manifest.heroLoading);
  assert.deepEqual(loading.HMH_LOADING_POOL.map((entry) => entry.id), manifest.images.filter((image) => image.role === 'loading').map((image) => image.id));
  for (const entry of loading.HMH_LOADING_POOL) {
    for (const url of [entry.src, entry.thumb, ...entry.srcset.split(', ').map((part) => part.split(' ')[0])]) {
      assert.ok(existsSync(join(root, 'apps/portal', url)), url);
    }
  }
});

test('the Python builder --check passes and is registered with npm run check', () => {
  const run = spawnSync('python', ['scripts/build-hmh-banner-art.py', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const check = readFileSync(join(root, 'scripts/syntax-check.mjs'), 'utf8');
  for (const file of ['scripts/build-hmh-banner-art.py', 'apps/portal/src/generated/hmh-banner-art.mjs', 'apps/portal/src/generated/hmh-loading-art.mjs']) {
    assert.ok(check.includes(`'${file}'`), `${file} is listed in scripts/syntax-check.mjs`);
  }
});
