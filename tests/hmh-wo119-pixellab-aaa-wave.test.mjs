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

test('PixelLab quality wave preserves the influencer runtime ID while replacing the drone with a human camera operator', () => {
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
actor = m.TARGETS['influencer-camera-drone']
assert actor['body_type'] == 'humanoid', actor
description = actor['description'].lower()
assert 'human' in description and 'camera' in description, description
for forbidden in ('floating ring-light bot', 'robot head', 'mechanical body'):
    assert forbidden not in description, description
progress = '''custom-walking (west): 95% ~0s
custom-walking (north): 0% ~900s'''
assert m.remote_jobs_busy(progress), progress
assert m.inflight_count(progress) == 2, m.inflight_count(progress)
overlap = '''processing: 50% ~30s
creating animation'''
assert m.inflight_count(overlap) == 2, m.inflight_count(overlap)
assert not m.remote_jobs_busy('reprocessing complete'), 'busy matching must use whole status words'
assert not m.remote_jobs_busy('custom-walking (west): 100% ~0s'), '100 percent is complete, not inflight'
assert m.inflight_count('custom-walking (west): 100% ~0s') == 0
assert not m.remote_jobs_busy('idle — 8 dir complete'), 'completed listings must not stay busy'
`], {
    cwd: fileURLToPath(repoUrl('.')),
    encoding: 'utf8',
  });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
});

test('promoted influencer camera operator ships a complete human 8-state runtime matrix', async () => {
  const { HMH_ANIMATED_ROSTER } = await import('../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs');
  const actor = HMH_ANIMATED_ROSTER['influencer-camera-drone'];
  assert.ok(actor, 'runtime/save ID must remain stable');
  assert.equal(actor.visualType, 'human');
  assert.equal(actor.character_id, 'a7caa385-ae1c-47c7-a9a9-a5e7950ad4b5');
  assert.match(actor.source, /pixellab-aaa-human-zombie-wave-v1/);
  const expectedStates = ['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in'];
  const expectedDirections = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
  for (const state of expectedStates) {
    assert.deepEqual(Object.keys(actor.animations[state] ?? {}).sort(), expectedDirections.toSorted(), `${state} must ship all eight facings`);
    for (const direction of expectedDirections) {
      assert.ok(actor.animations[state][direction].length >= 6, `${state}/${direction} needs at least six frames`);
    }
  }
});

test('PixelLab ledger compaction preserves resumability while dropping raw responses and staging manifests', () => {
  const scriptPath = fileURLToPath(repoUrl('scripts/pixellab-hmh-aaa-quality-wave.py'));
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const probe = spawnSync('python', ['-c', String.raw`
import importlib.util, os
from pathlib import Path
path = Path(os.environ['HMH_WAVE_SCRIPT'])
spec = importlib.util.spec_from_file_location('hmh_wave', path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ledger = {
  'targets': {
    'influencer-camera-drone': {
      'spec': {'body_type': 'humanoid'},
      'character_id': 'human-camera-operator',
      'status': 'collected',
      'created_at': 1,
      'collected_at': 2,
      'raw_create': 'large remote response',
      'manifest': {'animations': {'idle': {'south': ['staging.png']}}},
      'animations': {
        'idle': {
          'status': 'complete',
          'directions': ['south'],
          'job_ids': ['job-1', 'job-1'],
          'queued_at': 3,
          'raw': 'large queue response',
          'repair_attempts': 2,
        }
      },
    },
    'bad-actor': {
      'status': 'collected',
      'raw_create': 'keep until every selected target validates',
      'manifest': {'animations': {}},
      'animations': {'idle': {'status': 'complete', 'repair_attempts': 'invalid'}},
    },
    'missing-status': {'raw_create': 'invalid entry', 'animations': {}},
    'queued-actor': {'status': 'queued', 'raw_create': 'still needed', 'animations': {}},
    'unharvested-actor': {'status': 'collected', 'raw_create': 'missing manifest', 'animations': {}},
    'untouched': {'status': 'collected', 'manifest': {'keep': True}},
  }
}
m.load_ledger = lambda: ledger
m.save_ledger = lambda value: None
m.selected_targets = lambda targets: [item.strip() for item in targets.split(',')]
try:
  m.compact_ledger(None)
  raise AssertionError('compact-ledger must require an explicit target')
except SystemExit as exc:
  assert '--targets' in str(exc)
try:
  m.compact_ledger('missing-actor')
  raise AssertionError('compact-ledger must reject unknown targets')
except SystemExit as exc:
  assert 'missing-actor' in str(exc)
ledger['targets']['influencer-camera-drone']['animations']['idle']['repair_attempts'] = 'invalid'
try:
  m.compact_ledger('influencer-camera-drone')
  raise AssertionError('compact-ledger must reject malformed repair metadata')
except SystemExit as exc:
  assert 'repair_attempts' in str(exc)
assert 'raw_create' in ledger['targets']['influencer-camera-drone'], 'failed compaction must not save a partial entry'
ledger['targets']['influencer-camera-drone']['animations']['idle']['repair_attempts'] = 2
try:
  m.compact_ledger('influencer-camera-drone,bad-actor')
  raise AssertionError('multi-target validation must be atomic')
except SystemExit as exc:
  assert 'bad-actor/idle' in str(exc)
assert 'raw_create' in ledger['targets']['influencer-camera-drone'], 'a later invalid target must not compact an earlier target in memory'
try:
  m.compact_ledger('missing-status')
  raise AssertionError('compact-ledger must reject missing status metadata')
except SystemExit as exc:
  assert 'missing status' in str(exc)
try:
  m.compact_ledger('queued-actor')
  raise AssertionError('compact-ledger must preserve in-progress generation metadata')
except SystemExit as exc:
  assert 'not collected or promoted' in str(exc)
try:
  m.compact_ledger('unharvested-actor')
  raise AssertionError('compact-ledger must preserve collected entries until their manifest exists')
except SystemExit as exc:
  assert 'missing its staging manifest' in str(exc)
m.compact_ledger('influencer-camera-drone')
entry = ledger['targets']['influencer-camera-drone']
assert entry['status'] == 'promoted'
assert entry['character_id'] == 'human-camera-operator'
assert entry['animations']['idle']['job_ids'] == ['job-1']
assert entry['animations']['idle']['repair_attempts'] == 2
assert 'raw' not in entry['animations']['idle']
assert 'raw_create' not in entry
assert 'manifest' not in entry
assert ledger['targets']['untouched']['manifest'] == {'keep': True}
`], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, HMH_WAVE_SCRIPT: scriptPath },
  });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
  assert.match(readFileSync(scriptPath, 'utf8'), /compact-ledger/);
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
