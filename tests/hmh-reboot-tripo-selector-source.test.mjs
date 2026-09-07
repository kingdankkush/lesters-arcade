import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('selector explicitly uses the four real textured Tripo heroes without claiming gameplay rigs', () => {
  const render = load('apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json');
  assert.equal(render.scene.sourceMode, 'static-textured-models');
  assert.equal(render.scene.readOnly, true);
  assert.notEqual(render.scene.sourceBlend, load('apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').scene.sourceBlend);
  const sources = load(render.scene.sourceManifest);
  assert.equal(sources.schema, 'hmh-tripo-selector-sources-v1');
  assert.deepEqual(sources.heroes.map((h) => h.actorId), ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']);
  assert.equal(sources.heroes.length, 4);
  for (const hero of sources.heroes) {
    assert.match(hero.sourceSha256, /^[a-f0-9]{64}$/u);
    assert.ok(Number.isSafeInteger(hero.sourceBytes) && hero.sourceBytes > 0);
    assert.equal(hero.imageCount, 3);
    assert.equal(hero.rigged, false);
    assert.equal(hero.gameplayIntegrated, false);
  }
  assert.deepEqual(render.pose, { mode: 'source-rest-pose', rigged: false });
});

test('selector provenance verifies real bytes and canonical manifest-bound LFS pointers, rejecting forgeries', () => {
  const python = String.raw`
import hashlib, importlib.util, pathlib, sys, tempfile
sys.path.insert(0, str(pathlib.Path('scripts').resolve()))
spec=importlib.util.spec_from_file_location('selector','scripts/run-hmh-hero-selector-render.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
f=getattr(m,'verified_source_sha',None)
assert callable(f), 'selector needs real-or-manifest-bound-LFS source verification'
with tempfile.TemporaryDirectory() as folder:
 p=pathlib.Path(folder)/'source.blend';raw=b'BLENDER-v300source-fixture';digest=hashlib.sha256(raw).hexdigest();expected={'sha256':digest,'bytes':len(raw)}
 p.write_bytes(raw);assert f(p,expected)==digest
 pointer=f'version https://git-lfs.github.com/spec/v1\noid sha256:{digest}\nsize {len(raw)}\n'.encode()
 p.write_bytes(pointer);assert f(p,expected)==digest
 for bad in [pointer.replace(digest.encode(),b'0'*64),pointer.replace(f'size {len(raw)}'.encode(),b'size 999'),pointer+b'garbage\n',b'BLENDER-tampered']:
  p.write_bytes(bad)
  try:f(p,expected)
  except (RuntimeError,ValueError):pass
  else:raise AssertionError('forged source accepted')
 p.write_bytes(pointer)
 for malformed in [{'sha256':'INVALID','bytes':len(raw)},{'sha256':digest,'bytes':0},{'sha256':digest,'bytes':True}]:
  try:f(p,malformed)
  except (RuntimeError,ValueError):pass
  else:raise AssertionError('malformed expected source descriptor accepted')
print('PASS: raw, canonical LFS, tamper rejection, malformed-descriptor rejection')
`;
  const result = spawnSync('python', ['-c', python], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS: raw, canonical LFS/u);
});
