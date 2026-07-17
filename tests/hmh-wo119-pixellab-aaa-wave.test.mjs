import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION,
  WO119_REQUIRED_DIRECTIONS,
  WO119_REQUIRED_STATES,
} from '../apps/portal/src/hmh-wo119-pixellab-aaa-wave.mjs';
import { repairRuntimeActorKey } from '../apps/portal/src/hmh-art-repair.mjs';
import { buildRosterCoverageReport } from '../scripts/roster-coverage-report.mjs';

function repoUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}

function readText(path) {
  return readFileSync(repoUrl(path), 'utf8');
}

test('WO-119 promotes Paper Hand to a complete PixelLab AAA 8-direction runtime replacement', () => {
  const cert = HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION;
  assert.equal(cert.id, 'hmh-wo119-pixellab-aaa-wave-v1');
  assert.equal(cert.enemyReplacement.actorKey, 'paper-hand');
  assert.equal(cert.enemyReplacement.source, 'pixellab-aaa-quality-wave-v1');
  assert.equal(cert.gates.paperHandSourceIsPixellabAaaWave, true);
  assert.equal(cert.gates.fullPaperHandMatrix, true);
  assert.equal(cert.enemyReplacement.frameCount, WO119_REQUIRED_STATES.length * WO119_REQUIRED_DIRECTIONS.length * 7);

  for (const row of cert.enemyReplacement.matrix) {
    assert.ok(WO119_REQUIRED_STATES.includes(row.state), `${row.state} is a required runtime state`);
    assert.ok(WO119_REQUIRED_DIRECTIONS.includes(row.direction), `${row.direction} is a required direction`);
    assert.equal(row.exists, true, `${row.actorKey}/${row.state}/${row.direction} frames exist`);
    assert.equal(row.firstFrame.startsWith('./assets/generated/hmh-animated-roster-atlas/paper-hand/'), true);
  }

  const repair = repairRuntimeActorKey('paper-hand');
  assert.equal(repair.repaired, false, 'paper-hand should use its direct PixelLab runtime kit, not repair fallback');

  const report = buildRosterCoverageReport();
  const paper = report.actors['paper-hand'];
  assert.equal(paper?.summary?.status, 'complete');
});

test('WO-119 Level 1 PixelLab world assets are present, alpha-clean, and route-integrated', () => {
  const cert = HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION;
  assert.equal(cert.gates.worldAssetsExist, true);
  assert.equal(cert.gates.worldAssetsRuntimeIntegrated, true);
  assert.equal(cert.gates.allLevelOneDistrictsHavePixellabRuntimeObjects, true);
  assert.equal(cert.levelDesign.runtimeAssetCount >= 20, true, 'expected broad Level 1 PixelLab runtime asset set');

  for (const row of cert.levelDesign.worldRows) {
    assert.equal(row.runtimeKey.startsWith('level1-reference-style/candidates/'), true);
    assert.equal(row.exists, true, `${row.runtimeKey} exists`);
    assert.equal(row.alphaClean, true, `${row.runtimeKey} alpha-clean`);
    assert.equal(row.runtimeIntegrated, true, `${row.runtimeKey} runtime-integrated`);
  }

  for (const [district, count] of Object.entries(cert.levelDesign.districtSceneObjectCounts)) {
    assert.equal(count > 0, true, `${district} has PixelLab runtime scene objects`);
  }
});

test('WO-119 docs, proof, syntax gate, and PixelLab generator are wired', () => {
  const cert = HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION;
  for (const path of Object.values(cert.docs)) {
    assert.equal(existsSync(repoUrl(path)), true, `${path} exists`);
  }
  const json = JSON.parse(readText(cert.docs.certificationJson));
  assert.equal(json.enemyReplacement.frameCount, 448);
  assert.equal(json.gates.paperHandFull8DirectionStateMatrix, true);

  const syntax = readText('scripts/syntax-check.mjs');
  assert.equal(syntax.includes('apps/portal/src/hmh-wo119-pixellab-aaa-wave.mjs'), true);
  assert.equal(syntax.includes('tests/hmh-wo119-pixellab-aaa-wave.test.mjs'), true);
  assert.equal(syntax.includes('scripts/pixellab-hmh-aaa-quality-wave.py'), true);
  assert.equal(syntax.includes('scripts/write-wo119-pixellab-aaa-wave.py'), true);

  assert.equal(existsSync(repoUrl('scripts/pixellab-hmh-aaa-quality-wave.py')), true);
  assert.equal(existsSync(repoUrl('apps/portal/assets/generated/hmh-aaa-pixellab-quality-wave/aaa-quality-wave-ledger.json')), true);

  const generator = readText('scripts/pixellab-hmh-aaa-quality-wave.py');
  for (const actor of ['coyote-pack-runner', 'wild-boar', 'buzzard', 'rattlesnake', 'scorpion-ambusher', 'sybil-drone']) {
    assert.match(generator, new RegExp(`"${actor}"`), `${actor} should be in the human/zombie PixelLab wave`);
  }
  assert.match(generator, /pixellab-aaa-human-zombie-wave-v1/);
  assert.match(generator, /promote requires --targets/);
  assert.match(generator, /for state in ANIMS/);
  assert.match(generator, /for direction in DIRECTIONS/);
  assert.match(generator, /len\(frames\) >= 6/);
  assert.match(generator, /frames=\{len\(frames\)\}\/6/);
  assert.match(generator, /PixelLab slots busy/);
  assert.match(generator, /--collect-timeout/);
  assert.match(generator, /collect-timeout/);
  assert.match(generator, /GROUP_HEADER_RE/);
  assert.match(generator, /completed_states_from_listing/);
  assert.match(generator, /state_direction_coverage_from_listing/);
  assert.match(generator, /directions_to_queue/);
  assert.match(generator, /repair pass/);
  assert.match(generator, /requeue missing remote state/);
  assert.match(generator, /runtime_frame_size/);
  assert.match(generator, /normalize_downloaded_frame/);
  assert.match(generator, /--download-workers/);
  assert.match(generator, /ThreadPoolExecutor/);
  assert.match(generator, /atomic_promote_staged/);

  const packer = readText('scripts/pack-hmh-animated-roster.py');
  assert.match(packer, /--only/);
  assert.match(packer, /--file-count-cap/);
  assert.match(packer, /projected_tracked_file_count/);
  assert.match(packer, /--cleanup-loose/);
  assert.match(packer, /packed: dict\[str, dict\] = dict\(roster\)/);
});

test('PixelLab remote completion merges one-direction repair groups into their canonical state', () => {
  const probe = spawnSync('python', ['-c', String.raw`
import builtins, importlib.util
from pathlib import Path
p = Path('scripts/pixellab-hmh-aaa-quality-wave.py').resolve()
spec = importlib.util.spec_from_file_location('wave', p)
m = importlib.util.module_from_spec(spec)
real_import = builtins.__import__
def optional_deps_absent(name, *args, **kwargs):
    if name.split('.')[0] in {'PIL', 'mcp'}:
        raise ModuleNotFoundError(name)
    return real_import(name, *args, **kwargs)
builtins.__import__ = optional_deps_absent
try:
    spec.loader.exec_module(m)
finally:
    builtins.__import__ = real_import
gid = '11111111-1111-1111-1111-111111111111'
def direction_line(direction):
    urls = ', '.join(f'https://example.invalid/animations/{gid}/{direction}/{i}.png' for i in range(6))
    return f'    {direction}: {urls}'
text = '  walk — 1 dir, 6 frames\n' + direction_line('east') + '\n'
text += '  walk — 7 dirs, 42 frames\n' + '\n'.join(direction_line(d) for d in m.DIRECTIONS if d != 'east')
assert m.completed_states_from_listing(text) == {'walk'}, m.completed_states_from_listing(text)
coverage = m.state_direction_coverage_from_listing(text)
assert set(coverage['walk']) == set(m.DIRECTIONS), coverage
`], {
    cwd: fileURLToPath(repoUrl('.')),
    encoding: 'utf8',
  });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
});

test('PixelLab promotion restores the prior actor when atomic manifest commit fails', () => {
  const probe = spawnSync('python', ['-c', String.raw`
import importlib.util, os, tempfile
from pathlib import Path
p = Path('scripts/pixellab-hmh-aaa-quality-wave.py').resolve()
spec = importlib.util.spec_from_file_location('wave', p)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as raw:
    root = Path(raw)
    m.ROSTER_ROOT = root / 'roster'
    m.ROSTER_MANIFEST = m.ROSTER_ROOT / 'hmh-animated-roster.mjs'
    m.ROSTER_ROOT.mkdir(parents=True)
    destination = m.ROSTER_ROOT / 'actor'
    destination.mkdir()
    (destination / 'old.txt').write_text('old', encoding='utf-8')
    m.ROSTER_MANIFEST.write_text('old-manifest', encoding='utf-8')
    stage = root / 'stage'
    (stage / 'actor').mkdir(parents=True)
    (stage / 'actor' / 'new.txt').write_text('new', encoding='utf-8')
    real_replace = m.os.replace
    def fail_manifest_replace(src, dst):
        if Path(dst) == m.ROSTER_MANIFEST:
            raise OSError('injected manifest failure')
        return real_replace(src, dst)
    m.os.replace = fail_manifest_replace
    try:
        m.atomic_promote_staged(stage, ['actor'], 'new-manifest')
        raise AssertionError('promotion should fail')
    except OSError as exc:
        assert 'injected manifest failure' in str(exc)
    finally:
        m.os.replace = real_replace
    assert (destination / 'old.txt').read_text(encoding='utf-8') == 'old'
    assert not (destination / 'new.txt').exists()
    assert m.ROSTER_MANIFEST.read_text(encoding='utf-8') == 'old-manifest'
`], {
    cwd: fileURLToPath(repoUrl('.')),
    encoding: 'utf8',
  });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
});
