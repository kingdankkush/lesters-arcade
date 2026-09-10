import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const root = fileURLToPath(new URL('../', import.meta.url));
const moduleUrl = new URL('../scripts/hmh-tripo-production-asset-qa.mjs', import.meta.url);
const canonical = path.join(root, 'apps/portal/assets/generated/hmh-reboot-tripo-props');
async function audit(options = {}) {
  assert.ok(existsSync(moduleUrl), 'portable native Tripo production asset QA is not implemented');
  const { auditTripoProductionAssets } = await import(moduleUrl);
  return auditTripoProductionAssets({ repoRoot: root, ...options });
}
async function fixture(fn) {
  // Copy real local runtime artifacts only into an explicitly disposable
  // corruption fixture. A successful fixture is not a new native render.
  const temp = mkdtempSync(path.join(tmpdir(), 'hmh-native-qa-'));
  try { cpSync(canonical, temp, { recursive: true }); await fn(temp); }
  finally { rmSync(temp, { recursive: true, force: true }); }
}
const load = dir => JSON.parse(readFileSync(path.join(dir, 'hmh-tripo-props.json'), 'utf8'));
const save = (dir, data) => writeFileSync(path.join(dir, 'hmh-tripo-props.json'), JSON.stringify(data));
const sha = data => createHash('sha256').update(data).digest('hex');

test('portable native QA verifies every runtime page, source frame, item and current producer without Blender', async () => {
  const report = await audit();
  assert.equal(report.status, 'pass');
  assert.equal(report.assetCount, 56);
  assert.equal(report.framesVerified, 56);
  assert.equal(report.itemImagesVerified, 56);
  assert.equal(report.pageCount, 2);
  assert.equal(report.filesVerified, 60);
  assert.ok(report.decodedTextureBytes <= 32 * 1024 * 1024);
  assert.ok(report.runtimeAtlasBytes > 0);
  assert.ok(report.boundCanonicalIds > 0);
  assert.equal(report.releaseCertified, false);
});

test('portable native QA rejects missing pages, damaged bytes and stale producer identity', async () => {
  await fixture(async dir => {
    const original = load(dir);
    const page = path.join(dir, original.pages[0].image);
    const bytes = readFileSync(page);
    rmSync(page);
    await assert.rejects(audit({ assetRoot: dir }), /ENOENT|missing/i);
    writeFileSync(page, Buffer.concat([bytes, Buffer.from('corrupt fixture')]));
    await assert.rejects(audit({ assetRoot: dir }), /hash|bytes/i);
    writeFileSync(page, bytes);
    const data = structuredClone(original);
    data.adoption.nativeProducerSha256.nativeRenderer = '0'.repeat(64);
    save(dir, data);
    await assert.rejects(audit({ assetRoot: dir }), /producer/i);
  });
});

test('portable native QA uses the real runtime metadata validator', async () => {
  await fixture(async dir => {
    const original = load(dir);
    for (const change of [
      m => { m.assetCount = 55; },
      m => { m.frames[0].category = 'power-up'; },
      m => { m.pages[0].image = '../outside.webp'; },
      m => { m.frames[0].itemImage = '../outside.webp'; },
    ]) {
      const data = structuredClone(original); change(data); save(dir, data);
      await assert.rejects(audit({ assetRoot: dir }), /roster|category|image|path/i);
    }
  });
});

test('rehashing a corrupted item does not bypass exact decoded source-pixel verification', async () => {
  await fixture(async dir => {
    const data = load(dir);
    const target = path.join(dir, 'items', data.frames[0].itemImage);
    const code = 'import sys; from PIL import Image; p=sys.argv[1]; im=Image.open(p).convert("RGBA"); im.putpixel((0,0),(255,0,255,255)); im.save(p,format="WEBP",lossless=True,exact=True)';
    const result = spawnSync(process.env.PYTHON ?? 'python', ['-B','-c',code,target], {encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    data.frames[0].itemSha256 = sha(readFileSync(target)); save(dir,data);
    await assert.rejects(audit({ assetRoot: dir }), /pixel|reconstruct|source/i);
  });
});

test('rehashing a corrupted atlas does not bypass exact per-frame reconstruction', async () => {
  await fixture(async dir => {
    const data = load(dir); const frame = data.frames[0]; const page = data.pages[frame.page];
    const target = path.join(dir, page.image);
    const code = 'import sys,hashlib; from PIL import Image; p=sys.argv[1]; im=Image.open(p).convert("RGBA"); im.putpixel((int(sys.argv[2]),int(sys.argv[3])),(255,0,255,255)); im.save(p,format="WEBP",lossless=True,exact=True); print(hashlib.sha256(im.tobytes()).hexdigest())';
    const result = spawnSync(process.env.PYTHON ?? 'python', ['-B','-c',code,target,String(frame.frame.x),String(frame.frame.y)], {encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    page.sha256 = sha(readFileSync(target)); page.decodedRgbaSha256 = result.stdout.trim(); save(dir,data);
    await assert.rejects(audit({ assetRoot: dir }), /pixel|reconstruct|source/i);
  });
});

test('unified production QA actually includes the native package report', () => {
  const result = spawnSync(process.execPath, ['scripts/hmh-reboot-production-asset-qa.mjs'], {cwd:root,encoding:'utf8',timeout:120000});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.equal(report.nativePropReport?.assetCount, 56, 'unified production QA omitted the native Tripo package');
  assert.equal(report.nativePropReport?.framesVerified, 56);
  assert.equal(report.nativePropReport?.itemImagesVerified, 56);
});
