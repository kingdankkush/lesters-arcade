"""Narrow native-source branch of the owned enemy source/render/pack pipeline.

The packed derivative is the immutable source. Reopening it is NOT rebuilding
its original authoring source. This module never adopts canonical artifacts.
"""
from __future__ import annotations
import copy
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ACTOR = 'bagholder-rusher'
KIND = 'packed-native-enemy-blend'
SOURCE_ROOT = ROOT / 'apps/hmh-reboot/assets/source/models/native-enemies'
GPU_GRANT = ROOT / '.tmp/team/bagholder-integration/gpu-go.json'
BUDGET = {'maxChangedVisiblePixels': 8, 'maxChannelDelta': 2, 'maxTotalChannelDelta': 32}
EXPECTED_BLENDER_VERSION = '5.1.2'
EXPECTED_SEMANTICS_SHA256 = 'a6239d7a9802ff72c0fcbb517309df2415bd04f219df344e34d397ef8f70901c'
EXPECTED_RAW_DERIVATIVE_SEMANTICS_SHA256 = '18018cfcef79d617d0d2208d0950dc6834d2b77e8f72e14a33eec51ea51b6707'
EXPECTED_SEMANTIC_COUNTS = {'objects': 3, 'materials': 5, 'images': 10, 'actions': 6}
PROJECTION_ROOT = 'HMH_Enemy_Projection_Root'
RIG_NAME = 'bagholder-rusher Rig'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def semantic_digest(value):
    """Recompute the Blender helper's canonical semantic digest on CPU."""
    encoded = json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def validate_semantic_proof(proof):
    """Require the complete immutable semantic snapshot, not a self-selected subset."""
    categories = set(EXPECTED_SEMANTIC_COUNTS)
    for side in ('source', 'derivative'):
        snapshot = proof.get(side)
        if not isinstance(snapshot, dict) or set(snapshot) != categories or any(
                not isinstance(snapshot[name], dict) or len(snapshot[name]) != count
                for name, count in EXPECTED_SEMANTIC_COUNTS.items()):
            raise ValueError(f'native semantic inventory incomplete: {side}')
    source_digest = semantic_digest(proof['source'])
    if proof.get('sourceSemanticsSha256') != source_digest or source_digest != EXPECTED_SEMANTICS_SHA256:
        raise ValueError('native semantic digest mismatch: source')
    raw_derivative_digest = semantic_digest(proof['derivative'])
    if (proof.get('rawDerivativeSemanticsSha256') != raw_derivative_digest
            or raw_derivative_digest != EXPECTED_RAW_DERIVATIVE_SEMANTICS_SHA256):
        raise ValueError('native semantic digest mismatch: raw derivative')
    normalized = copy.deepcopy(proof['derivative'])
    rig = normalized['objects'].get(RIG_NAME)
    if not isinstance(rig, dict) or rig.get('parent') != PROJECTION_ROOT or rig.get('parentType') != 'OBJECT' or rig.get('parentBone') != '':
        raise ValueError('native semantic derivative projection-parent contract drift')
    rig['parent'] = None
    derivative_digest = semantic_digest(normalized)
    if proof.get('derivativeSemanticsSha256') != derivative_digest or derivative_digest != EXPECTED_SEMANTICS_SHA256:
        raise ValueError('native semantic digest mismatch: normalized derivative')
    if (proof.get('match') is not True or proof.get('savedReopened') is not True
            or proof.get('inputHashesUnchanged') is not True or proof.get('differences') != []):
        raise ValueError('native semantic preservation proof is not an exact saved/reopened match')
    return proof


def semantic_proof(actor):
    reference = actor.get('sourceModel', {}).get('preservation', {})
    proof_path = (ROOT / reference.get('path', '')).resolve()
    if not proof_path.is_relative_to(SOURCE_ROOT.resolve()) or proof_path.suffix != '.json':
        raise ValueError('native semantic proof path is outside source custody')
    if not re.fullmatch('[0-9a-f]{64}', reference.get('sha256', '')) or sha(proof_path) != reference['sha256']:
        raise ValueError('native semantic proof hash mismatch')
    return validate_semantic_proof(json.loads(proof_path.read_text(encoding='utf-8')))


def expected_action_bindings(proof):
    bindings = {}
    for action_name, record in proof['source']['actions'].items():
        state = record.get('properties', {}).get('hmh_state')
        if not isinstance(state, str) or state in bindings:
            raise ValueError('native semantic action state is missing or duplicated')
        bindings[state] = action_name
    return bindings


def is_procedural_actor(actor):
    # Reserve this actor even if an edit accidentally removes its source field.
    if actor.get('actorId') == ACTOR:
        return False
    if actor.get('sourceModel', {}).get('kind') == KIND:
        raise ValueError('native enemy source is approved only for bagholder-rusher')
    return True


def validate_source_bytes(data, source, *, source_only=False):
    oid, size = source.get('sourceSha256'), source.get('sourceBytes')
    if not re.fullmatch('[0-9a-f]{64}', oid or '') or type(size) is not int or not 0 < size <= 96 * 1024 * 1024:
        raise ValueError('invalid native source identity or source-only size cap')
    if data.startswith(b'version https://git-lfs.github.com/spec/v1'):
        match = re.fullmatch(rb'version https://git-lfs.github.com/spec/v1\r?\noid sha256:([0-9a-f]{64})\r?\nsize ([1-9][0-9]*)\r?\n', data)
        if not match or match[1].decode() != oid or int(match[2]) != size:
            raise ValueError('native source LFS pointer identity mismatch')
        if not source_only:
            raise ValueError('native rendering requires real packed Blend bytes; LFS pointer is source-only')
        return 'lfs-pointer'
    if len(data) != size or hashlib.sha256(data).hexdigest() != oid:
        raise ValueError('native source bytes/hash mismatch')
    return 'source-original'


def actor_manifest(manifest, actor, *, source_only=False):
    source = actor.get('sourceModel', {})
    if actor.get('actorId') != ACTOR or source.get('kind') != KIND:
        raise ValueError('approved packed native enemy source is required')
    path = (ROOT / source.get('path', '')).resolve()
    if not path.is_relative_to(SOURCE_ROOT.resolve()) or path.suffix != '.blend':
        raise ValueError('native source must be a repo-owned source-only Blend')
    if source.get('sourceSha256') != 'd71630544fb236ad3a165a3e9d3e3f7aa2f5bbd254311b6d8f9c7a1f92b85856':
        raise ValueError('immutable native source identity changed')
    validate_source_bytes(path.read_bytes(), source, source_only=source_only)
    proof = semantic_proof(actor)
    if actor.get('poseAuthoring', {}).get('sourceFrameSamples') != {'hit': [12, 25]}:
        raise ValueError('native hit sampling must retain measured peak/recovery [12, 25]')
    if manifest['reproducibilityBudget'] != BUDGET or manifest['atlas'] != {'maxSize': 2048, 'padding': 2}:
        raise ValueError('native enemy must keep existing atlas and reproducibility limits')
    if actor.get('frameSize') != [208, 208] or actor.get('cameraOrthoScale') != 3.055:
        raise ValueError('native overscan/density contract drift')
    expected = {'idle': (2, 3), 'run': (6, 12), 'tell': (2, 6), 'attack': (3, 14), 'hit': (2, 12), 'death': (4, 10)}
    if {k: (v['frames'], v['fps']) for k, v in manifest['clips'].items()} != expected:
        raise ValueError('native enemy cadence drift')
    if actor.get('clipActions') != expected_action_bindings(proof):
        raise ValueError('native state-to-action binding drift')
    if set(actor.get('clipActions', {})) != set(expected) or len(manifest['directions']) != 8:
        raise ValueError('native action/direction coverage incomplete')
    result = copy.deepcopy(manifest)
    result['actors'] = [copy.deepcopy(actor)]
    result['scene'].update(sourceBlend=source['path'], armature=actor['armature'])
    result['poseAuthoring'] = copy.deepcopy(actor['poseAuthoring'])
    # Order matches the genuine original native render pass, preserving GPU order.
    result['clips'] = {state: {**manifest['clips'][state], 'loop': state in {'idle', 'run'}} for state in sorted(expected)}
    return result


def require_gpu_grant(path=GPU_GRANT):
    grant = json.loads(Path(path).read_text(encoding='utf-8'))
    if grant.get('gpuOwner') != 'bagholder-integration':
        raise ValueError('GPU is not owned by bagholder-integration')
    return grant


def render_actor(blender, manifest, actor, raw_dir, report_path, *, grant_checked=False):
    if not grant_checked:
        require_gpu_grant()
    selected = actor_manifest(manifest, actor)
    raw_dir, report_path = Path(raw_dir), Path(report_path)
    if any(raw_dir.glob(f'{ACTOR}__*.png')) or report_path.exists():
        raise FileExistsError('preserve prior native render and failure; use a fresh output')
    report_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path = report_path.with_suffix('.manifest.json')
    if manifest_path.exists():
        raise FileExistsError(manifest_path)
    manifest_path.write_text(json.dumps(selected, indent=2) + '\n')
    command = [str(blender), '--background', '--factory-startup', '--disable-autoexec', '--threads', '2',
               '--python-exit-code', '1', '--python', str(ROOT / 'scripts/hmh-blender/export-hmh-native-enemy.py'), '--',
               '--manifest', str(manifest_path), '--raw-output', str(raw_dir), '--report-output', str(report_path), '--actor-id', ACTOR]
    log = report_path.with_suffix('.log')
    with log.open('x', encoding='utf-8') as output:
        completed = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
    if completed.returncode or 'Traceback (most recent call last)' in log.read_text(encoding='utf-8', errors='replace'):
        raise RuntimeError(f'native render failed ({completed.returncode}); preserved log: {log}')
    validate_export_report(report_path, selected, manifest_path)
    return command


def validate_export_report(report_path, selected, manifest_path):
    """Bind a successful process to the exact Blender/source/manifest render receipt."""
    report_path = Path(report_path)
    if not report_path.is_file():
        raise ValueError('native export report missing after Blender process exit')
    try:
        report = json.loads(report_path.read_text(encoding='utf-8'))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError('native export report is unreadable') from error
    actor = selected['actors'][0]
    expected = {
        'status': 'pass',
        'pipelineId': selected['pipelineId'],
        'engine': selected['render']['engine'],
        'frameCount': 152,
        'framesPerActor': {ACTOR: 152},
        'states': list(selected['clips']),
        'directions': selected['directions'],
        'rendered': True,
        'sourceSemanticMatch': True,
        'sourceUnchanged': True,
        'sourceRebuilt': False,
        'sourceBlendSha256': actor['sourceModel']['sourceSha256'],
        'sourceSemanticsSha256': EXPECTED_SEMANTICS_SHA256,
        'manifestSha256': sha(manifest_path),
        'adapterSha256': sha(ROOT / 'scripts/hmh-blender/export-hmh-native-enemy.py'),
        'blenderVersion': EXPECTED_BLENDER_VERSION,
        'actionBindings': actor['clipActions'],
    }
    for name, value in expected.items():
        if report.get(name) != value:
            raise ValueError(f'native export report mismatch: {name}')
    frames = report.get('frames')
    if not isinstance(frames, list) or len(frames) != 152:
        raise ValueError('native export report frame coverage mismatch')
    counts = {}
    for frame in frames:
        state = frame.get('state') if isinstance(frame, dict) else None
        index = frame.get('frameIndex') if isinstance(frame, dict) else None
        if state not in selected['clips'] or type(index) is not int or not 0 <= index < selected['clips'][state]['frames']:
            raise ValueError('native export report contains an invalid state/frame binding')
        counts[(state, index)] = counts.get((state, index), 0) + 1
        if state == 'hit' and frame.get('nativeFrame') != actor['poseAuthoring']['sourceFrameSamples']['hit'][index]:
            raise ValueError('native export report hit samples are not measured peak/recovery [12, 25]')
    expected_counts = {(state, index): len(selected['directions'])
                       for state, clip in selected['clips'].items() for index in range(clip['frames'])}
    if counts != expected_counts:
        raise ValueError('native export report does not cover every state/direction sample exactly once')
    return report


def compare_pair(pipe, first, second):
    a, b = pipe.decoded_frame_hashes(first), pipe.decoded_frame_hashes(second)
    if not a or a.keys() != b.keys():
        raise ValueError('independent native passes must contain identical nonempty frame sets')
    changed = sorted(name for name in a if a[name] != b[name])
    # Full decoded changes include zero-premultiplied deltas; never filter them out.
    return changed, pipe.compare_frames_premultiplied(first, second, changed)


def candidate(pipe, manifest, output, *, reuse_pair=None, blender=None):
    """Generate private first-pass candidate, plus both originals and fail-closed receipts."""
    from PIL import Image
    if reuse_pair is not None:
        raise ValueError('native reuse is disabled: mutable receipts cannot attest native rendering; generate fresh A/B')
    output = Path(output).resolve()
    canonical = ROOT / 'apps/portal/assets/generated'
    if output.exists() or output.is_relative_to(canonical.resolve()) or not output.is_relative_to(ROOT):
        raise ValueError('candidate requires a fresh private repository directory, never canonical output')
    actor = next(a for a in manifest['actors'] if a['actorId'] == ACTOR)
    selected = actor_manifest(manifest, actor)
    require_gpu_grant()  # Once at the render step; no polling and no competing Blender.
    output.mkdir(parents=True)
    receipt = {'status': 'running', 'actorId': ACTOR, 'sourceRebuiltBetweenPasses': False,
               'independentNativeColdOpens': False, 'renderedByThisRun': False,
               'runtimeIntegrated': False, 'canonicalAdopted': False, 'budget': BUDGET, 'passes': {}}
    receipt_path = output / 'receipt.json'
    def save(): pipe.write_lf_json(receipt_path, receipt)
    save()
    try:
        names = sorted(f'{ACTOR}__body__{s}__{d}__{i:03d}.png' for s, c in selected['clips'].items() for d in selected['directions'] for i in range(c['frames']))
        originals = {}
        for lane in ['pass-a', 'pass-b']:
            original = output / lane / 'raw'
            command = render_actor(blender, manifest, actor, original, output / lane / 'export-report.json', grant_checked=True)
            receipt.setdefault('renderCommands', []).append(command)
            if sorted(p.name for p in original.glob('*.png')) != names:
                raise ValueError(f'{lane}: expected exact 152 raw IDs')
            originals[lane] = {n: sha(original / n) for n in names}
            receipt['passes'][lane] = {'rawSha256': originals[lane]}
            save()  # Freeze original identities before normalization or packing can fail.
            raw = output / lane / 'normalized'
            shutil.copytree(original, raw)
            pipe.normalize_rendered_frames(selected, raw)
            for name in names:
                with Image.open(raw / name) as image:
                    box = pipe.alpha_bbox(image, selected['render']['alphaThreshold'])
                    if box is None or box[0] == 0 or box[1] == 0 or box[2] == image.width or box[3] == image.height:
                        raise ValueError(f'blank or border-clipped native frame: {name}')
            records = pipe.analyse(actor, selected, raw)
            atlas_dir = output / lane / 'atlas'
            metrics = pipe.build_atlas(actor, selected, records, atlas_dir)
            if metrics['frameCount'] != 152 or metrics['uniqueSourceFrames'] != 152:
                raise ValueError(f'{lane}: native candidate requires 152 unique frames')
            if metrics['atlasSize'] > 2048 or metrics['atlasBytes'] > 2 * 1024 * 1024:
                raise ValueError('native PNG exceeds unchanged 2MiB budget')
            metadata = json.loads((atlas_dir / f'{ACTOR}-roster-atlas.json').read_text())
            by_id = {r['id']: r for r in records}
            # Verify exact packed crop pixels against canonical normalized source.
            with Image.open(atlas_dir / f'{ACTOR}-roster-atlas.png') as atlas:
                for frame in metadata['frames']:
                    r = by_id[frame['id']]; f = frame['frame']
                    decoded = atlas.crop((f['x'], f['y'], f['x']+f['w'], f['y']+f['h'])).convert('RGBA')
                    if decoded.tobytes() != r['image'].crop(r['bbox']).tobytes():
                        raise ValueError(f'lossless packed reconstruction failed: {frame["id"]}')
            receipt['passes'][lane].update(metrics=metrics, borderClips=0, packedCropReconstruction=True)
            save()
        changed, drift = compare_pair(pipe, output/'pass-a/normalized', output/'pass-b/normalized')
        pipe.write_lf_json(output/'per-frame-drift.json', drift)
        derived = pipe.roster_json_drift_is_derived(output/f'pass-a/atlas/{ACTOR}-roster-atlas.json', output/f'pass-b/atlas/{ACTOR}-roster-atlas.json', set(changed))
        receipt.update(decodedChangedFrameCount=len(changed), observed=pipe.summarize_observed_drift(drift), metadataExactExceptDerivedPixelSha=derived,
                       exceededFrames=pipe.frames_exceeding_budget(drift, BUDGET))
        save()
        if receipt['exceededFrames'] or not derived:
            raise ValueError('native A/B exceeds unchanged pixel/metadata gate')
        preserved = 0
        if set(originals) != {'pass-a', 'pass-b'}:
            raise ValueError('both original native raw passes are required')
        for lane, hashes in originals.items():
            if len(hashes) != 152 or any(sha(output/lane/'raw'/n) != h for n, h in hashes.items()):
                raise ValueError('original native raw files changed')
            preserved += len(hashes)
            receipt['passes'][lane]['originalRawFilesPreserved'] = len(hashes)
        receipt['originalRawFilesPreserved'] = preserved
        receipt['renderedByThisRun'] = True
        receipt['independentNativeColdOpens'] = True
        ready = output / 'ready-to-adopt'
        shutil.copytree(output/'pass-a/atlas', ready/ACTOR)
        # Keep all other existing actor bytes/receipts. Mixed provenance is explicit.
        metrics = json.loads((pipe.OUTPUT_ROOT/'hmh-enemy-roster-metrics.json').read_text())
        old_policy = copy.deepcopy(metrics['reproducibilityPolicy'])
        metrics['actors'] = [receipt['passes']['pass-a']['metrics'] if e['actorId'] == ACTOR else e for e in metrics['actors']]
        metrics['totalAtlasBytes'] = sum(e['atlasBytes'] for e in metrics['actors'])
        # Replace the old native actor's observations, not just its byte count.
        # The other actors retain their historical procedural A/B evidence.
        retained_drift = {name: value for name, value in old_policy['toleratedFrames'].items()
                          if not name.startswith(ACTOR + '__')}
        metrics['reproducibilityPolicy'] = pipe.build_reproducibility_policy(BUDGET, {**retained_drift, **drift}, verified=True)
        metrics['reproducibleVerified'] = True
        metrics['reproducibilityPolicy']['coldSceneRebuild'] = False
        metrics['reproducibilityPolicy']['sourceModes'] = {a['actorId']: ('independent-native-cold-opens' if a['actorId'] == ACTOR else 'cold-procedural-scene-rebuild') for a in manifest['actors']}
        metrics['reproducibilityPolicy']['priorProceduralPolicy'] = old_policy
        metrics['nativeSource'] = {'actorId': ACTOR, 'sourceModel': actor['sourceModel'], 'observed': receipt['observed'], 'decodedChangedFrameCount': len(changed), 'metadataExactExceptDerivedPixelSha': True}
        pipe.write_lf_json(ready/'hmh-enemy-roster-metrics.json', metrics)
        receipt.update(status='ready-for-parent-adoption', firstPassSelected=True,
                       outputs={p.relative_to(ready).as_posix(): {'sha256': sha(p), 'bytes': p.stat().st_size} for p in ready.rglob('*') if p.is_file()})
        save()
    except Exception as error:
        receipt.update(status='failed-preserved', error=str(error)); save(); raise
    return receipt
