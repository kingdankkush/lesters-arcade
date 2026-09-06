import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const testPaths = ['tests/hmh-hero-reference-intake.test.mjs', 'tests/hmh-weapon-reference-intake.test.mjs'];

test('actual complete hero and weapon intake suites accept no-smudge checkout; forged OID/size fail', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'hmh-source-nosmudge-'));
  const put = (path, bytes) => { const dest = join(fixture, path); mkdirSync(dirname(dest), {recursive: true}); writeFileSync(dest, bytes); };
  const pointer = image => `version https://git-lfs.github.com/spec/v1\noid sha256:${image.sha256}\nsize ${image.bytes}\n`;
  // An isolated node:test invocation must not inherit the parent runner marker.
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  const run = () => spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...testPaths], {cwd: fixture, env, encoding: 'utf8'});
  try {
    for (const path of [...testPaths, 'tests/shared/validate-lfs-pointer.mjs', '.gitattributes']) put(path, readFileSync(new URL(path, root)));
    const records = [];
    for (const group of ['heroes', 'weapons']) {
      const path = `apps/hmh-reboot/assets/source/reference/${group}/references.json`;
      const bytes = readFileSync(new URL(path, root)); put(path, bytes);
      const ledger = JSON.parse(bytes);
      records.push(...(group === 'heroes' ? ledger.heroes.flatMap(hero => Object.values(hero.images)) : ledger.assets.map(asset => asset.image)));
    }
    assert.equal(records.length, 19);
    assert.equal(new Set(records.map(image => image.path)).size, 19);
    for (const image of records) put(image.path, pointer(image));
    let result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /# tests 4\b/);
    assert.match(result.stdout, /# skipped 0\b/);
    for (const [image, field, value] of [[records[0], 'sha256', 'a'.repeat(64)], [records.at(-1), 'bytes', records.at(-1).bytes + 1]]) {
      put(image.path, pointer({...image, [field]: value}));
      result = run();
      assert.equal(result.status, 1, `forged provenance must fail the actual intake suites: ${result.stdout} ${result.stderr}`);
      assert.match(result.stdout, /LFS (OID|size) mismatch/);
      put(image.path, pointer(image));
    }
  } finally { rmSync(fixture, {recursive: true, force: true}); }
});
