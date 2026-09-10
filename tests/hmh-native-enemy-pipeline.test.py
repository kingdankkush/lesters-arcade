"""CPU-only contracts exercising the owning enemy pipeline (no Blender renders)."""
import copy
from contextlib import contextmanager
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('enemy_pipeline', ROOT / 'scripts/run-hmh-enemy-roster-pipeline.py')
pipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipe)
from PIL import Image
MANIFEST = json.loads((ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json').read_text())
SCRATCH = ROOT / '.tmp/team/bagholder-correction/tests'
SCRATCH.mkdir(parents=True, exist_ok=True)

class NativePipelineTests(unittest.TestCase):
    def native(self):
        self.assertTrue(hasattr(pipe, 'native_enemy'), 'owning pipeline must expose its native-source branch')
        return pipe.native_enemy

    @contextmanager
    def cpu_native_fixture(self, *, adapt_manifest=True):
        """Exact pointer fixture for mocked CPU lanes; never native render evidence."""
        from unittest.mock import patch
        native = self.native()
        original_actor_manifest = native.actor_manifest
        manifest = copy.deepcopy(MANIFEST)
        actor = manifest['actors'][0]
        source = actor['sourceModel']
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            fixture_root = Path(temp)
            source_root = fixture_root / 'apps/hmh-reboot/assets/source/models/native-enemies'
            source_path = fixture_root / source['path']
            source_path.parent.mkdir(parents=True, exist_ok=True)
            source_path.write_bytes(
                f"version https://git-lfs.github.com/spec/v1\noid sha256:{source['sourceSha256']}\nsize {source['sourceBytes']}\n".encode()
            )
            proof_path = fixture_root / source['preservation']['path']
            proof_path.parent.mkdir(parents=True, exist_ok=True)
            proof_path.write_bytes((ROOT / source['preservation']['path']).read_bytes())
            fixture_output = fixture_root / pipe.OUTPUT_ROOT.relative_to(ROOT)
            fixture_output.mkdir(parents=True, exist_ok=True)
            fixture_output.joinpath('hmh-enemy-roster-metrics.json').write_bytes(
                (pipe.OUTPUT_ROOT / 'hmh-enemy-roster-metrics.json').read_bytes()
            )

            def mocked_cpu_actor_manifest(selected_manifest, selected_actor, *, source_only=False):
                # The renderer is mocked in every caller of this adapter. Exercise the
                # complete real manifest/source validation without pretending a pointer
                # is renderable by the production path.
                return original_actor_manifest(selected_manifest, selected_actor, source_only=True)

            with patch.object(native, 'ROOT', fixture_root), \
                    patch.object(native, 'SOURCE_ROOT', source_root), \
                    patch.object(pipe, 'OUTPUT_ROOT', fixture_output):
                selected = original_actor_manifest(manifest, actor, source_only=True)
                self.assertEqual(selected['scene']['sourceBlend'], source['path'])
                if not adapt_manifest:
                    yield native, manifest, actor, fixture_root
                else:
                    with patch.object(native, 'actor_manifest', side_effect=mocked_cpu_actor_manifest):
                        yield native, manifest, actor, fixture_root

    def test_pointer_fixture_never_enters_the_unadapted_native_render_or_candidate_path(self):
        from unittest.mock import patch
        with self.cpu_native_fixture(adapt_manifest=False) as (native, manifest, actor, fixture_root):
            with patch.object(native, 'require_gpu_grant'), \
                    patch.object(native.subprocess, 'run', side_effect=AssertionError('pointer reached Blender')) as render:
                with self.assertRaisesRegex(ValueError, 'pointer|hydrated'):
                    native.render_actor(Path('blender.exe'), manifest, actor,
                                        fixture_root/'raw', fixture_root/'report.json')
                with self.assertRaisesRegex(ValueError, 'pointer|hydrated'):
                    native.candidate(pipe, manifest, fixture_root/'candidate')
                render.assert_not_called()

    def test_manifest_preserves_native_source_and_six_clips(self):
        actor = MANIFEST['actors'][0]
        self.assertEqual(actor.get('sourceModel', {}).get('kind'), 'packed-native-enemy-blend')
        native = self.native()
        manifest = native.actor_manifest(MANIFEST, actor, source_only=True)
        self.assertEqual(len(manifest['actors']), 1)
        self.assertEqual(sum(c['frames'] for c in manifest['clips'].values()) * len(manifest['directions']), 152)
        self.assertEqual(manifest['actors'][0]['frameSize'], [208, 208])
        self.assertEqual(manifest['poseAuthoring']['mode'], 'preserved-native-actions')
        self.assertNotIn('module', manifest['poseAuthoring'])
        self.assertEqual(manifest['scene']['sourceBlend'], actor['sourceModel']['path'])

    def test_manifest_rejects_state_to_native_action_permutation(self):
        native = self.native()
        actor = copy.deepcopy(MANIFEST['actors'][0])
        actor['clipActions']['hit'], actor['clipActions']['tell'] = actor['clipActions']['tell'], actor['clipActions']['hit']
        with self.assertRaisesRegex(ValueError, 'state.*action|action.*binding'):
            native.actor_manifest(MANIFEST, actor, source_only=True)

    def test_semantic_proof_requires_complete_inventory_and_recomputed_digest(self):
        native = self.native()
        proof_path = ROOT / MANIFEST['actors'][0]['sourceModel']['preservation']['path']
        proof = json.loads(proof_path.read_text())
        reduced = copy.deepcopy(proof)
        rig = MANIFEST['actors'][0]['armature']
        for side in ['source', 'derivative']:
            reduced[side] = {'objects': {rig: reduced[side]['objects'][rig]}, 'materials': {}, 'images': {}, 'actions': {}}
            reduced[f'{side}SemanticsSha256'] = native.semantic_digest(reduced[side])
        with self.assertRaisesRegex(ValueError, 'semantic.*inventory|semantic.*digest'):
            native.validate_semantic_proof(reduced)

    def test_source_identity_accepts_only_exact_pointer_for_source_only(self):
        native = self.native()
        actor = MANIFEST['actors'][0]
        source = actor['sourceModel']
        pointer = f"version https://git-lfs.github.com/spec/v1\noid sha256:{source['sourceSha256']}\nsize {source['sourceBytes']}\n".encode()
        self.assertEqual(native.validate_source_bytes(pointer, source, source_only=True), 'lfs-pointer')
        with self.assertRaises(ValueError): native.validate_source_bytes(pointer, source, source_only=False)
        for corrupted in [pointer.replace(b'sha256:', b'sha256:0'), pointer.replace(str(source['sourceBytes']).encode(), b'1'), pointer + b'extra\n']:
            with self.assertRaises(ValueError): native.validate_source_bytes(corrupted, source, source_only=True)
        data = (ROOT / source['path']).read_bytes()
        actual_kind = native.validate_source_bytes(data, source, source_only=True)
        self.assertIn(actual_kind, ['source-original', 'lfs-pointer'])
        if actual_kind == 'source-original':
            self.assertEqual(native.validate_source_bytes(data, source, source_only=False), 'source-original')
        with self.assertRaises(ValueError): native.validate_source_bytes(data + b'x', source, source_only=True)

    def test_native_source_rejects_other_actor_and_external_paths(self):
        native = self.native()
        for change in [{'actorId': 'forkrunner'}, {'sourceModel': {**MANIFEST['actors'][0]['sourceModel'], 'path': '../outside.blend'}}]:
            actor = {**MANIFEST['actors'][0], **change}
            with self.assertRaises(ValueError): native.actor_manifest(MANIFEST, actor)

    def test_gpu_grant_fails_closed_without_polling_or_render(self):
        native = self.native()
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            grant = Path(temp) / 'gpu-go.json'
            with self.assertRaises((ValueError, FileNotFoundError)): native.require_gpu_grant(grant)
            grant.write_text(json.dumps({'gpuOwner': 'another-lane'}))
            with self.assertRaises(ValueError): native.require_gpu_grant(grant)
            grant.write_text(json.dumps({'gpuOwner': 'bagholder-integration'}))
            native.require_gpu_grant(grant)

    def test_native_candidate_validates_blender_before_output_or_render(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        native = self.native()
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            shim = Path(temp) / 'not-blender.exe'
            shim.write_bytes(b'not blender')
            args = SimpleNamespace(native_candidate=Path(temp) / 'candidate', reuse_native_pair=None,
                                   skip_render=False, skip_scene=False, verify_reproducible=False)
            with patch.object(pipe, 'parse_args', return_value=args), \
                    patch.object(pipe, 'run_checked', return_value='not Blender\n'), \
                    patch.object(native, 'candidate', side_effect=AssertionError('candidate reached before Blender validation')), \
                    patch.dict(os.environ, {'BLENDER_EXECUTABLE': str(shim)}), \
                    patch.dict(sys.modules, {'enemy_pipeline': pipe}):
                with self.assertRaisesRegex(RuntimeError, r'expected.*Blender 5\.1\.2'):
                    pipe.main()
            self.assertFalse(args.native_candidate.exists())

    def test_native_render_requires_a_valid_export_report_after_process_exit_zero(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        with self.cpu_native_fixture() as (native, manifest, actor, fixture_root):
            out = fixture_root / '.tmp/report'
            out.mkdir(parents=True)
            with patch.object(native, 'require_gpu_grant'), \
                    patch.object(native.subprocess, 'run', return_value=SimpleNamespace(returncode=0)):
                with self.assertRaisesRegex((ValueError, FileNotFoundError), 'export report'):
                    native.render_actor(Path('blender.exe'), manifest, actor,
                                        out / 'raw', out / 'export-report.json')

    def test_failed_candidate_receipt_never_claims_render_or_cold_opens(self):
        from unittest.mock import patch
        with self.cpu_native_fixture() as (native, manifest, _actor, fixture_root):
            out = fixture_root / '.tmp/candidate'
            with patch.object(native, 'require_gpu_grant'), \
                    patch.object(native, 'render_actor', side_effect=ValueError('native export report missing')):
                with self.assertRaisesRegex(ValueError, 'export report'):
                    native.candidate(pipe, manifest, out)
            receipt = json.loads((out / 'receipt.json').read_text())
            self.assertEqual(receipt['status'], 'failed-preserved')
            self.assertFalse(receipt['renderedByThisRun'])
            self.assertFalse(receipt['independentNativeColdOpens'])

    def test_export_report_binds_exact_blender_manifest_adapter_and_hit_samples(self):
        native = self.native()
        actor = MANIFEST['actors'][0]
        selected = native.actor_manifest(MANIFEST, actor, source_only=True)
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            temp = Path(temp)
            manifest_path = temp / 'selected.manifest.json'
            manifest_path.write_text(json.dumps(selected, indent=2) + '\n')
            frames = []
            for state, clip in selected['clips'].items():
                for direction_index, _direction in enumerate(selected['directions']):
                    for index in range(clip['frames']):
                        native_frame = actor['poseAuthoring']['sourceFrameSamples']['hit'][index] if state == 'hit' else index + 1
                        frames.append({'state': state, 'frameIndex': index, 'nativeFrame': native_frame,
                                       'yawRadians': direction_index * 0.7853981633974483})
            report = {
                'status': 'pass', 'pipelineId': selected['pipelineId'], 'engine': selected['render']['engine'],
                'frameCount': 152, 'framesPerActor': {'bagholder-rusher': 152},
                'states': list(selected['clips']), 'directions': selected['directions'], 'rendered': True,
                'sourceSemanticMatch': True, 'sourceUnchanged': True, 'sourceRebuilt': False,
                'sourceBlendSha256': actor['sourceModel']['sourceSha256'],
                'sourceSemanticsSha256': native.EXPECTED_SEMANTICS_SHA256,
                'manifestSha256': native.sha(manifest_path),
                'adapterSha256': native.sha(ROOT / 'scripts/hmh-blender/export-hmh-native-enemy.py'),
                'blenderVersion': '5.1.2', 'actionBindings': actor['clipActions'], 'frames': frames,
            }
            report_path = temp / 'export-report.json'
            report_path.write_text(json.dumps(report))
            self.assertEqual(native.validate_export_report(report_path, selected, manifest_path)['frameCount'], 152)
            for field, value in [('blenderVersion', '5.0.0'), ('manifestSha256', '0' * 64)]:
                bad = copy.deepcopy(report); bad[field] = value; report_path.write_text(json.dumps(bad))
                with self.assertRaisesRegex(ValueError, 'export report'):
                    native.validate_export_report(report_path, selected, manifest_path)
            bad = copy.deepcopy(report)
            next(frame for frame in bad['frames'] if frame['state'] == 'hit')['nativeFrame'] = 1
            report_path.write_text(json.dumps(bad))
            with self.assertRaisesRegex(ValueError, 'export report.*hit'):
                native.validate_export_report(report_path, selected, manifest_path)

    def test_normal_render_dispatch_routes_native_before_legacy(self):
        native = self.native()
        calls = []
        original_run, original_render = pipe.run_checked, native.render_actor
        pipe.run_checked = lambda cmd, label: calls.append(('legacy', cmd))
        native.render_actor = lambda *args, **kwargs: calls.append(('native', args))
        try:
            pipe.render_roster_by_actor(Path('blender'), Path('legacy.blend'), MANIFEST, SCRATCH, 'test', 'test')
        finally:
            pipe.run_checked, native.render_actor = original_run, original_render
        self.assertEqual([c[0] for c in calls].count('native'), 1)
        self.assertEqual([c[0] for c in calls].count('legacy'), 6)
        self.assertTrue(all('--disable-autoexec' in cmd and '--python-exit-code' in cmd for kind, cmd in calls if kind == 'legacy'))

    def test_procedural_builder_cannot_replace_native_actor(self):
        native = self.native()
        self.assertFalse(native.is_procedural_actor(MANIFEST['actors'][0]))
        self.assertTrue(all(native.is_procedural_actor(a) for a in MANIFEST['actors'][1:]))
        source = (ROOT / 'scripts/hmh-blender/create-hmh-enemy-roster.py').read_text()
        self.assertIn('if not native_enemy.is_procedural_actor(actor):', source)
        self.assertIn('native_enemy.actor_manifest(manifest, actor)', source)

    def test_contact_sheet_uses_actual_overscan_cell_not_shared_160(self):
        actor = copy.deepcopy(MANIFEST['actors'][0]); actor['frameSize'] = [208, 208]
        image = Image.new('RGBA', (208, 208), (0, 0, 0, 0)); image.putpixel((207, 207), (255, 0, 0, 255))
        records = [{'id': f'test{i}', 'phase': None, 'state': 'idle', 'direction': 'south', 'frameIndex': i,
                    'fps': 3, 'image': image, 'bbox': (0, 0, 208, 208), 'sourcePixelSha256': 'a'*64, 'pivot': (83, 151)} for i in range(2)]
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            pipe.build_atlas(actor, MANIFEST, records, Path(temp))
            with Image.open(Path(temp) / f"{actor['actorId']}-roster-contact-sheet.png") as sheet:
                self.assertEqual(sheet.size, (416, 208))
                self.assertEqual(sheet.getpixel((207, 207)), (255, 0, 0, 255))
                self.assertEqual(sheet.getpixel((415, 207)), (255, 0, 0, 255))

    def test_small_legacy_actor_contact_sheet_retains_original_160_cells(self):
        actor = copy.deepcopy(MANIFEST['actors'][-1])
        width, height = actor['frameSize']
        image = Image.new('RGBA', (width, height), (30, 50, 70, 255))
        records = [{'id': 'legacy', 'phase': None, 'state': 'idle', 'direction': 'south', 'frameIndex': 0,
                    'fps': 3, 'image': image, 'bbox': (0, 0, width, height), 'sourcePixelSha256': 'a'*64, 'pivot': (1, 1)}]
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            pipe.build_atlas(actor, MANIFEST, records, Path(temp))
            with Image.open(Path(temp) / f"{actor['actorId']}-roster-contact-sheet.png") as sheet:
                self.assertEqual(sheet.size, tuple(MANIFEST['render']['frameSize']))

    def test_native_atlas_never_claims_procedural_pose_provenance(self):
        self.native()
        actor = MANIFEST['actors'][0]
        image = Image.new('RGBA', (208, 208), (30, 50, 70, 255))
        record = {'id': 'frame', 'phase': None, 'state': 'idle', 'direction': 'south', 'frameIndex': 0,
                  'fps': 3, 'image': image, 'bbox': (0, 0, 208, 208), 'sourcePixelSha256': 'a'*64, 'pivot': (83, 151)}
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            pipe.build_atlas(actor, MANIFEST, [record], Path(temp))
            metadata = json.loads((Path(temp) / f"{actor['actorId']}-roster-atlas.json").read_text())
            self.assertEqual(metadata['poseAuthoring']['mode'], 'preserved-native-actions')
            self.assertNotIn('module', metadata['poseAuthoring'])
            self.assertEqual(metadata['sourceModel'], actor['sourceModel'])
            self.assertEqual(metadata['animationProfile']['kind'], 'preserved-native-actions')

    def test_normal_native_pipeline_refuses_unproven_skip_render_before_writes(self):
        from types import SimpleNamespace
        original, original_analyse = pipe.parse_args, pipe.analyse
        pipe.parse_args = lambda: SimpleNamespace(native_candidate=None, reuse_native_pair=None, skip_render=True, skip_scene=True, verify_reproducible=False)
        def blocked_pack(*args):
            raise ValueError('unguarded legacy packing reached')
        pipe.analyse = blocked_pack  # RED must never write any canonical artifact.
        try:
            with self.assertRaisesRegex(ValueError, 'native.*skip-render'):
                pipe.main()
        finally:
            pipe.parse_args, pipe.analyse = original, original_analyse

    def test_mixed_source_policy_never_claims_native_source_rebuild(self):
        self.assertTrue(hasattr(pipe, 'apply_native_source_policy'), 'normal regeneration must publish truthful mixed source provenance')
        metrics = {'reproducibleVerified': True, 'reproducibilityPolicy': {'coldSceneRebuild': True}}
        pipe.apply_native_source_policy(metrics, MANIFEST, {})
        self.assertFalse(metrics['reproducibilityPolicy']['coldSceneRebuild'])
        self.assertEqual(metrics['nativeSource']['sourceModel'], MANIFEST['actors'][0]['sourceModel'])
        self.assertEqual(metrics['reproducibilityPolicy']['sourceModes']['forkrunner'], 'cold-procedural-scene-rebuild')

    def test_full_decoded_changes_survive_zero_premultiplied_drift(self):
        native = self.native()
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            a, b = Path(temp)/'a', Path(temp)/'b'; a.mkdir(); b.mkdir()
            image = Image.new('RGBA', (4, 4), (0, 0, 0, 0)); image.putpixel((1, 1), (1, 0, 0, 1)); image.save(a/'f.png')
            image.putpixel((1, 1), (2, 0, 0, 1)); image.save(b/'f.png')
            names, report = native.compare_pair(pipe, a, b)
            self.assertEqual(names, ['f.png'])
            self.assertEqual(report['f.png']['changed'], 0)
            b.joinpath('f.png').unlink()
            with self.assertRaises(ValueError): native.compare_pair(pipe, a, b)

    def test_unverified_native_policy_rejected_without_mutation(self):
        metrics = {'reproducibleVerified': False, 'reproducibilityPolicy': {'coldSceneRebuild': True}}
        before = copy.deepcopy(metrics)
        with self.assertRaisesRegex(ValueError, 'verified.*native|native.*verified'):
            pipe.apply_native_source_policy(metrics, MANIFEST, {})
        self.assertEqual(metrics, before)

    def test_unverified_native_main_rejected_before_render_or_scene(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        for skip_scene in [False, True]:
            with self.subTest(skip_scene=skip_scene), patch.object(pipe, 'parse_args', return_value=SimpleNamespace(
                    native_candidate=None, reuse_native_pair=None, skip_render=False, skip_scene=skip_scene, verify_reproducible=False)), \
                    patch.object(pipe, 'run_checked', side_effect=AssertionError('must reject before Blender')):
                with self.assertRaisesRegex(ValueError, 'native.*verify-reproducible'):
                    pipe.main()

    def test_procedural_unverified_policy_is_unchanged(self):
        manifest = copy.deepcopy(MANIFEST); manifest['actors'] = manifest['actors'][1:]
        metrics = {'reproducibleVerified': False, 'reproducibilityPolicy': {'coldSceneRebuild': True}}
        before = copy.deepcopy(metrics)
        pipe.apply_native_source_policy(metrics, manifest, {})
        self.assertEqual(metrics, before)

    def test_untrusted_reuse_is_disabled_before_candidate_mutations(self):
        native = self.native()
        with tempfile.TemporaryDirectory(dir=SCRATCH) as temp:
            reuse = Path(temp)/'forged'; reuse.mkdir()
            (reuse/'receipt.json').write_text(json.dumps({'finished': True,
                'sourceBlendSha256': MANIFEST['actors'][0]['sourceModel']['sourceSha256'],
                'results': [{'exitCode': 0, 'observedFrames': 152}]*2}))
            for lane in ['pass-a', 'pass-b']:
                self.fixture_render(None, MANIFEST, MANIFEST['actors'][0], reuse/lane/'raw', None)
            out = Path(temp)/'candidate'
            with self.assertRaisesRegex(ValueError, 'reuse.*disabled|unsupported.*reuse'):
                native.candidate(pipe, MANIFEST, out, reuse_pair=reuse)
            self.assertFalse(out.exists())

    def fixture_render(self, blender, manifest, actor, raw, report, **kwargs):
        # CPU fixture only: never a production/native render receipt.
        from PIL import ImageDraw
        raw.mkdir(parents=True)
        for n, name in enumerate(sorted(f"bagholder-rusher__body__{s}__{d}__{i:03d}.png"
                for s, c in manifest['clips'].items() for d in manifest['directions'] for i in range(c['frames']))):
            image = Image.new('RGBA', (416, 416))
            ImageDraw.Draw(image).rectangle((160, 180, 210, 280), fill=(n+40, 80, 90, 255))
            image.save(raw/name)
        return ['CPU-UNIT-FIXTURE-NOT-RENDER-EVIDENCE']

    def test_fresh_candidate_normalizes_copies_and_measures_preservation(self):
        from unittest.mock import patch
        native = self.native()
        normalize = pipe.normalize_rendered_frames
        seen = []
        def check_copy(manifest, normalized):
            original = normalized.parent/'raw'
            self.assertNotEqual(normalized, original, 'normalization must never target original raw')
            hashes = {p.name: native.sha(p) for p in original.glob('*.png')}
            self.assertEqual(len(hashes), 152)
            normalize(manifest, normalized)
            self.assertEqual(hashes, {p.name: native.sha(p) for p in original.glob('*.png')})
            seen.append(hashes)
        with self.cpu_native_fixture() as (native, manifest, _actor, fixture_root):
            with patch.object(native, 'require_gpu_grant'), \
                    patch.object(native, 'render_actor', side_effect=self.fixture_render), \
                    patch.object(pipe, 'normalize_rendered_frames', side_effect=check_copy):
                out = fixture_root / '.tmp/candidate'
                result = native.candidate(pipe, manifest, out)
            self.assertEqual(len(seen), 2)
            self.assertEqual(result['originalRawFilesPreserved'], sum(map(len, seen)))
            self.assertTrue(all(p['metrics']['uniqueSourceFrames'] == 152 for p in result['passes'].values()))
            metrics = json.loads((out/'ready-to-adopt/hmh-enemy-roster-metrics.json').read_text())
            policy = metrics['reproducibilityPolicy']
            self.assertFalse(any(n.startswith('bagholder-rusher__') for n in policy['toleratedFrames']), 'aggregate must remove superseded native drift')
            self.assertEqual(policy['observed'], pipe.summarize_observed_drift(policy['toleratedFrames']))

    def test_candidate_rejects_duplicate_images_in_either_pass(self):
        from unittest.mock import patch
        import shutil
        native = self.native()
        for bad_lane in ['pass-a', 'pass-b']:
            def render(*args, **kwargs):
                command = self.fixture_render(*args, **kwargs)
                raw = args[3]
                if raw.parent.name == bad_lane:
                    files = sorted(raw.glob('*.png')); shutil.copyfile(files[0], files[1])
                return command
            with self.subTest(lane=bad_lane), self.cpu_native_fixture() as (native, manifest, _actor, fixture_root):
                with patch.object(native, 'require_gpu_grant'), patch.object(native, 'render_actor', side_effect=render):
                    out = fixture_root / '.tmp/candidate'
                    with self.assertRaisesRegex((ValueError, RuntimeError), 'duplicate|unique'):
                        native.candidate(pipe, manifest, out)
                    self.assertFalse((out/'ready-to-adopt').exists())

    def test_candidate_explicitly_gates_unique_metrics_in_both_passes(self):
        from unittest.mock import patch
        native = self.native(); build = pipe.build_atlas
        for bad_lane in ['pass-a', 'pass-b']:
            def corrupt_metrics(actor, manifest, records, out):
                result = build(actor, manifest, records, out)
                if out.parent.name == bad_lane: result['uniqueSourceFrames'] = 151
                return result
            with self.subTest(lane=bad_lane), self.cpu_native_fixture() as (native, manifest, _actor, fixture_root):
                with patch.object(native, 'require_gpu_grant'), patch.object(native, 'render_actor', side_effect=self.fixture_render), \
                        patch.object(pipe, 'build_atlas', side_effect=corrupt_metrics):
                    out = fixture_root / '.tmp/candidate'
                    with self.assertRaisesRegex(ValueError, '152.*unique|unique.*152'):
                        native.candidate(pipe, manifest, out)
                    self.assertFalse((out/'ready-to-adopt').exists())

    def test_candidate_detects_original_tampering_after_normalization(self):
        from unittest.mock import patch
        native = self.native(); normalize = pipe.normalize_rendered_frames
        def tamper(manifest, normalized):
            normalize(manifest, normalized)
            original = next((normalized.parent/'raw').glob('*.png'))
            original.write_bytes(original.read_bytes()+b'tamper')
        with self.cpu_native_fixture() as (native, manifest, _actor, fixture_root):
            with patch.object(native, 'require_gpu_grant'), \
                    patch.object(native, 'render_actor', side_effect=self.fixture_render), \
                    patch.object(pipe, 'normalize_rendered_frames', side_effect=tamper):
                with self.assertRaisesRegex(ValueError, 'original.*raw.*changed'):
                    native.candidate(pipe, manifest, fixture_root / '.tmp/candidate')

    def test_hit_source_sampling_metadata_pins_peak_then_recovery(self):
        actor = MANIFEST['actors'][0]
        self.assertEqual(actor['poseAuthoring'].get('sourceFrameSamples'), {'hit': [12, 25]})
        self.assertEqual(MANIFEST['clips']['hit']['frames'], 2)
        self.assertEqual(MANIFEST['clips']['hit']['fps'], 12)

if __name__ == '__main__': unittest.main(verbosity=2)
