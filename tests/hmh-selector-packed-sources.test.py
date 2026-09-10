"""Focused Blender-free contracts; all scratch writes stay in the SELECTOR lane."""
import copy
from contextlib import redirect_stdout
import io
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace


def load_python(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('selector_runner', ROOT / 'scripts/run-hmh-hero-selector-render.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class PackedSelectorTests(unittest.TestCase):
    def setUp(self):
        lane = ROOT / '.tmp/team/hero-owner-pass/scratch'
        lane.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=lane)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.root_patch = patch.object(runner, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.manifest = json.loads((ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json').read_text())
        self.manifest['scene'].update(sourceMode='packed-gameplay-sources')
        for key in ('sourceBlend', 'sourceBlendFingerprint', 'sourceBuilder'):
            self.manifest['scene'].pop(key, None)
        self.inputs = {'pilots': []}
        for i, hero in enumerate(self.manifest['heroes']):
            data = b'BLENDER-test-fixture-not-a-render-' + hero['actorId'].encode()
            path = f'apps/hmh-reboot/assets/source/models/tripo-gameplay/{hero["actorId"]}.blend'
            (self.root / path).parent.mkdir(parents=True, exist_ok=True)
            (self.root / path).write_bytes(data)
            self.inputs['pilots'].append({'actorId': hero['actorId'], 'sourceModel': {
                'path': path, 'format': 'blend', 'kind': 'packed-textured-blend',
                'sourceSha256': hashlib.sha256(data).hexdigest(), 'sourceBytes': len(data),
                'externalDependencyCount': 0, 'packedTextureCount': 1,
            }, 'clipActions': {'aim': 'HMH_Aim', 'idle': 'HMH_Idle'}})
        self.manifest_path = self.root / 'apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json'
        self.sync()
        for key in ('exporter', 'heroExporter', 'runner'):
            path = self.root / self.manifest['scene'][key]
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((ROOT / self.manifest['scene'][key]).read_bytes())
        # The production helper's bytes, not a fabricated source receipt.
        helper = ROOT / 'scripts/hmh_selector_native_sources.py'
        if helper.exists():
            (self.root / 'scripts/hmh_selector_native_sources.py').write_bytes(helper.read_bytes())

    def sync(self):
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        (self.root / self.manifest['scene']['sourceManifest']).write_text(json.dumps(self.inputs))
        self.manifest_path.write_text(json.dumps(self.manifest))

    def sources(self):
        return runner.packed_gameplay_sources(self.manifest, self.root)

    def pointer(self, pilot, oid=None, size=None):
        source = pilot['sourceModel']
        (self.root / source['path']).write_text(
            f'version https://git-lfs.github.com/spec/v1\noid sha256:{oid or source["sourceSha256"]}\nsize {size or source["sourceBytes"]}\n')

    def assert_binding_rejected_before_mutation(self, manifest_path):
        def snapshot():
            return {p.relative_to(self.root).as_posix():
                    hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else 'directory'
                    for p in self.root.rglob('*')}
        before = snapshot()
        for entry in (runner.load_manifest, runner.render, runner.check, runner.main):
            with self.subTest(entry=entry.__name__), \
                 patch.object(runner, 'parse_args', return_value=SimpleNamespace(manifest=str(manifest_path), check=False)), \
                 patch.object(runner, 'BLENDER', manifest_path), \
                 patch.object(runner, 'blender_version', side_effect=AssertionError('Blender before binding')), \
                 patch.object(runner.subprocess, 'run', side_effect=AssertionError('subprocess before binding')), \
                 patch.object(runner, 'run_checked', side_effect=AssertionError('Blender before binding')), \
                 patch.object(runner, 'exclusive_pipeline_lock', side_effect=AssertionError('lock before binding')), \
                 patch.object(runner.shutil, 'rmtree', side_effect=AssertionError('rmtree before binding')), \
                 patch.object(Path, 'mkdir', side_effect=AssertionError('mkdir before binding')), \
                 patch.object(Path, 'write_text', side_effect=AssertionError('write before binding')), \
                 patch.object(Path, 'write_bytes', side_effect=AssertionError('write before binding')):
                with self.assertRaisesRegex(ValueError, 'canonical|contract|capsule|path|atlas|direction'):
                    entry() if entry is runner.main else entry(manifest_path)
            self.assertEqual(snapshot(), before)

    def private_manifest(self):
        capsule = '.tmp/team/selector-candidate'
        candidate = copy.deepcopy(self.manifest)
        candidate['render']['rawOutputDirectory'] = capsule + '/raw'
        candidate['atlas'].update(outputDirectory=capsule + '/generated', module=capsule + '/module.mjs')
        return candidate, self.root / capsule / 'render.json'

    def test_two_pass_drift_report_stays_in_active_capsule_even_on_failure(self):
        candidate, path = self.private_manifest()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(candidate))
        canonical_report = self.root / '.tmp/hmh-reboot-hero-selector-drift-report.json'
        canonical_report.write_text('canonical sentinel')
        before = {p: p.read_bytes() for p in self.root.rglob('*') if p.is_file() and not p.is_relative_to(path.parent)}
        a = runner.Image.new('RGBA', (384, 384), (0, 0, 0, 255))
        b = a.copy()
        reports = [{'wallSeconds': 1}, {'wallSeconds': 2}]
        # Keep the old global destination in the disposable root even on RED.
        with patch.object(runner, 'DRIFT_REPORT_PATH', canonical_report):
            observed = runner.verify_two_passes(candidate, {'test.png': a}, {'test.png': b}, reports, '5.1.2')
            self.assertEqual(observed['maxChangedVisiblePixels'], 0)
            self.assertEqual({p: p.read_bytes() for p in self.root.rglob('*') if p.is_file() and not p.is_relative_to(path.parent)}, before)
            local = path.parent / 'hmh-reboot-hero-selector-drift-report.json'
            self.assertEqual(json.loads(local.read_text())['status'], 'pass')
            b.putpixel((1, 1), (255, 255, 255, 255))
            with self.assertRaisesRegex(RuntimeError, 'not reproducible'):
                runner.verify_two_passes(candidate, {'test.png': a}, {'test.png': b}, reports, '5.1.2')
            self.assertEqual(json.loads(local.read_text())['status'], 'fail')
            self.assertEqual(canonical_report.read_text(), 'canonical sentinel')
            # The canonical invocation retains its established report destination.
            runner.verify_two_passes(self.manifest, {'test.png': a}, {'test.png': a}, reports, '5.1.2')
            self.assertEqual(json.loads(canonical_report.read_text())['status'], 'pass')

    def exporter_module(self):
        with patch.dict(sys.modules, {'bpy': SimpleNamespace(),
                'bpy_extras.object_utils': SimpleNamespace(world_to_camera_view=None)}):
            return load_python('selector_destination_test', ROOT / 'scripts/hmh-blender/export-hmh-hero-selector.py')

    def export_destinations(self, manifest=None, actor='lit-commando', label='run-a'):
        manifest = manifest or self.manifest
        raw_root = self.root / manifest['render']['rawOutputDirectory']
        suffix = '-' + actor if actor else ''
        return raw_root / label, raw_root / (label + '-report' + suffix + '.json')

    def assert_export_preflight_rejects(self, manifest_path, raw, report):
        exporter = self.exporter_module()
        args = SimpleNamespace(manifest=str(manifest_path), repo_root=str(self.root),
            raw_output=str(raw), report_output=str(report), actor_id='lit-commando')
        before = {p.relative_to(self.root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in self.root.rglob('*') if p.is_file()}
        with patch.object(exporter, 'blender_args', return_value=args), \
             patch.object(exporter, 'load_module', side_effect=AssertionError('Blender module before preflight')), \
             patch.object(Path, 'mkdir', side_effect=AssertionError('mkdir before preflight')):
            with self.assertRaisesRegex(ValueError, 'path|capsule|destination|lane'):
                exporter.main()
        self.assertEqual({p.relative_to(self.root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in self.root.rglob('*') if p.is_file()}, before)

    def test_direct_exporter_rejects_unowned_and_uncoupled_destinations_before_work(self):
        candidate, candidate_path = self.private_manifest()
        candidate_path.parent.mkdir(parents=True, exist_ok=True)
        candidate_path.write_text(json.dumps(candidate))
        for manifest, path in [(self.manifest, self.manifest_path), (candidate, candidate_path)]:
            raw, report = self.export_destinations(manifest)
            for bad_raw, bad_report in [
                (self.root / 'outside', report), (raw, self.root / 'outside.json'),
                (raw / '../../escape', report), (raw, report.parent / '../escape.json'),
                (raw, report.with_name('run-b-report-lit-commando.json')),
                (raw, report.with_name('run-a-report-lilly.json')),
                (self.root / '.tmp/team/selector-correction/raw/run-a', report),
                (raw, self.root / '.tmp/team/selector-correction/raw/run-a-report-lit-commando.json'),
            ]:
                with self.subTest(raw=str(bad_raw), report=str(bad_report)):
                    self.assert_export_preflight_rejects(path, bad_raw, bad_report)

    def test_direct_exporter_rejects_real_junction_and_resolved_child_alias(self):
        raw, report = self.export_destinations()
        target = self.root / '.tmp/team/other-owner'
        target.mkdir(parents=True)
        (target / 'keep.txt').write_text('sentinel')
        raw.parent.mkdir(parents=True, exist_ok=True)
        if sys.platform == 'win32':
            import _winapi
            _winapi.CreateJunction(str(target), str(raw))
        else:
            raw.symlink_to(target, target_is_directory=True)
        try:
            self.assert_export_preflight_rejects(self.manifest_path, raw, report)
        finally:
            raw.rmdir() if sys.platform == 'win32' else raw.unlink()
        original_resolve = Path.resolve
        for alias in [report, raw / runner.frame_filename('lit-commando', 'east')]:
            def resolved(path, *args, **kwargs):
                return target / 'keep.txt' if path == alias else original_resolve(path, *args, **kwargs)
            with self.subTest(alias=str(alias)), patch.object(Path, 'resolve', resolved):
                self.assert_export_preflight_rejects(self.manifest_path, raw, report)

    def test_direct_preflight_accepts_real_runner_jobs_in_both_coupled_lanes(self):
        candidate, path = self.private_manifest()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(candidate))
        exporter = self.exporter_module()
        for manifest, manifest_path in [(self.manifest, self.manifest_path), (candidate, path)]:
            for label in ('run-a', 'run-b'):
                raw, report = self.export_destinations(manifest, actor=None, label=label)
                jobs = runner.selector_render_jobs(manifest, manifest_path, raw, report)
                for job in jobs:
                    self.assertEqual(exporter.validate_selector_export_destinations(
                        manifest, self.root, manifest_path, raw, job['report'], job['source']['actorId']),
                        (raw, job['report']))

    def test_private_quality_caps_cannot_be_relaxed_or_type_confused(self):
        original, path = self.private_manifest()
        path.parent.mkdir(parents=True, exist_ok=True)
        cases = [
            ('render', 'frameSize', [256, 256]), ('render', 'frameSize', [384, 385]),
            ('render', 'transparentFilm', False), ('render', 'alphaThreshold', 9),
            ('render', 'format', 'WEBP'), ('atlas', 'imageSuffix', '-selector-atlas.webp'),
            ('atlas', 'grid', [8, 1]), ('atlas', 'grid', [4, 3]), ('atlas', 'perHero', False),
            ('atlas', 'maxBytesPerAtlas', 524289), ('atlas', 'maxTotalBytes', 2097153),
            ('atlas', 'maxBytesPerAtlas', True), ('atlas', 'maxTotalBytes', float('inf')),
            ('reproducibilityBudget', 'maxChangedVisiblePixels', 9),
            ('reproducibilityBudget', 'maxChannelDelta', 3),
            ('reproducibilityBudget', 'maxTotalChannelDelta', 33),
            ('reproducibilityBudget', 'maxChangedVisiblePixels', True),
            ('reproducibilityBudget', 'maxChannelDelta', -1),
            ('reproducibilityBudget', 'maxTotalChannelDelta', float('nan')),
            ('groundContact', 'pivotTolerancePx', 0.6),
            ('groundContact', 'footLineEnvelopePx', {'minBelowPivot': 7, 'maxBelowPivot': 64}),
            ('groundContact', 'footLineEnvelopePx', {'minBelowPivot': 8, 'maxBelowPivot': 65}),
        ]
        for section, key, value in cases:
            with self.subTest(section=section, key=key, value=value):
                candidate = copy.deepcopy(original)
                candidate[section][key] = value
                path.write_text(json.dumps(candidate))
                with self.assertRaisesRegex(ValueError, 'contract|atlas|path'):
                    runner.load_manifest(path)
                self.assert_binding_rejected_before_mutation(path)
        for key in original['reproducibilityBudget']:
            with self.subTest(missing=key):
                candidate = copy.deepcopy(original)
                del candidate['reproducibilityBudget'][key]
                path.write_text(json.dumps(candidate))
                with self.assertRaisesRegex(ValueError, 'contract'):
                    runner.load_manifest(path)
                self.assert_binding_rejected_before_mutation(path)

    def test_private_quality_retains_lookdev_and_tighter_budgets(self):
        candidate, path = self.private_manifest()
        candidate['render'].update(exposure=-0.35, cameraOrthoScale=2.8, cameraPitchDegrees=54, compression=30)
        candidate['atlas'].update(maxBytesPerAtlas=500000, maxTotalBytes=2000000)
        candidate['reproducibilityBudget'] = {key: 0 for key in candidate['reproducibilityBudget']}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(candidate))
        self.assertEqual(runner.load_manifest(path), candidate)

    def test_private_checker_rejects_non_png_bytes_and_oversized_layout_with_truthful_hashes(self):
        self.manifest, self.manifest_path = self.private_manifest()
        self.sync()
        for variant in ('WEBP', 'padded-PNG'):
            with self.subTest(variant=variant):
                metadata, paths = self.install_checker_fixture()
                hero = self.manifest['heroes'][0]
                entry = metadata['heroes'][hero['portalHeroId']]
                target = paths['image'](hero['actorId'])
                image = runner.Image.open(target).convert('RGBA')
                if variant == 'WEBP':
                    image.save(target, format='WEBP', lossless=True)
                else:
                    padded = runner.Image.new('RGBA', (image.width + 1, image.height))
                    padded.paste(image, (0, 0))
                    padded.save(target, format='PNG', compress_level=9)
                    entry['atlasSize']['width'] = padded.width
                    entry['frames'] = [f"{entry['image']}#frame={x},{y},384,384,{padded.width},{padded.height}"
                        for x, y in [runner.grid_cell(self.manifest, i) for i in range(8)]]
                data = target.read_bytes()
                metadata['metrics']['totalImageBytes'] += len(data) - entry['imageBytes']
                entry.update(imageBytes=len(data), imageSha256=runner.sha256_bytes(data))
                metadata['metrics']['perAtlasBytes'][hero['portalHeroId']] = len(data)
                self.assertLessEqual(len(data), 524288)
                paths['metadata'].write_text(json.dumps(metadata))
                paths['module'].write_bytes(runner.module_bytes(metadata))
                with self.assertRaisesRegex(SystemExit, 'PNG|dimensions'):
                    runner.check(self.manifest_path)

    def test_canonical_binding_accepts_real_manifest_and_no_git_fixture(self):
        with patch.object(runner, 'ROOT', ROOT):
            actual_path = ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json'
            self.assertEqual(runner.load_manifest(actual_path), json.loads(actual_path.read_text()))
        self.assertFalse((self.root / '.git').exists())
        self.assertEqual(runner.load_manifest(self.manifest_path), self.manifest)

    def test_each_approved_private_capsule_binds_its_manifest_and_all_targets(self):
        for name in ('selector', 'selector-candidate', 'selector-correction'):
            with self.subTest(capsule=name):
                capsule = '.tmp/team/' + name
                candidate = copy.deepcopy(self.manifest)
                candidate['scene']['sourceManifest'] = '.tmp/hero-delivery-manifest.json'
                candidate['render'].update(rawOutputDirectory=capsule + '/raw', exposure=-0.35)
                candidate['atlas'].update(outputDirectory=capsule + '/generated', module=capsule + '/module.mjs')
                path = self.root / capsule / 'render.json'
                path.parent.mkdir(parents=True, exist_ok=True)
                (self.root / '.tmp/hero-delivery-manifest.json').write_text(json.dumps(self.inputs))
                path.write_text(json.dumps(candidate))
                self.assertEqual(runner.load_manifest(path), candidate)
                self.assertEqual(len(runner.packed_gameplay_sources(candidate, self.root)), 4)
                self.assertEqual(runner.output_paths(candidate)['module'], self.root / capsule / 'module.mjs')
                candidate['atlas']['module'] = capsule + '/selector-atlas.mjs'
                path.write_text(json.dumps(candidate))
                self.assertEqual(runner.load_manifest(path), candidate)

    def test_noncanonical_manifest_cannot_borrow_canonical_targets(self):
        for lane in ('.tmp/team/selector', '.tmp/team/selector-candidate', '.tmp/team/selector-correction',
                     'apps/hmh-reboot/assets/source/blender'):
            with self.subTest(lane=lane):
                path = self.root / lane / 'private-render.json'
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(self.manifest))
                self.assert_binding_rejected_before_mutation(path)

    def test_canonical_manifest_cannot_approve_its_own_changed_contract(self):
        original = copy.deepcopy(self.manifest)
        cases = [
            ('scene', 'sourceManifest', '.tmp/hero-delivery-manifest.json'),
            ('scene', 'readOnly', False), ('scene', 'blenderVersion', '5.1.3'),
            ('scene', 'sourceBlend', 'apps/hmh-reboot/assets/source/blender/legacy.blend'),
            ('scene', 'runner', 'scripts/other.py'),
            ('render', 'engine', 'CYCLES'), ('render', 'frameSize', [256, 256]),
            ('render', 'transparentFilm', False), ('render', 'alphaThreshold', 9),
            ('render', 'cameraOrthoScale', 2.8), ('render', 'exposure', -0.35),
            ('render', 'cameraPitchDegrees', 54), ('render', 'compression', 21),
            ('render', 'unapprovedControl', 1),
            ('reproducibilityBudget', 'maxChangedVisiblePixels', 9),
            ('reproducibilityBudget', 'maxChannelDelta', 3),
            ('reproducibilityBudget', 'maxTotalChannelDelta', 33),
            ('atlas', 'perHero', False), ('atlas', 'perHero', 1), ('atlas', 'grid', [8, 1]),
            ('atlas', 'maxBytesPerAtlas', 524289), ('atlas', 'maxTotalBytes', 2097153),
            ('groundContact', 'contract', 'alpha-bounds'), ('groundContact', 'pivotTolerancePx', 1),
            ('groundContact', 'footLineEnvelopePx', {'minBelowPivot': 7, 'maxBelowPivot': 64}),
            ('groundContact', 'footLineEnvelopePx', {'minBelowPivot': 8, 'maxBelowPivot': 65}),
            ('groundContact', 'unapprovedControl', True),
            ('pose', 'frameIndex', 1), ('pose', 'frameCount', 2), ('pose', 'loop', 0),
        ]
        for section, key, value in cases:
            with self.subTest(section=section, key=key, value=value):
                self.manifest = copy.deepcopy(original)
                self.manifest[section][key] = value
                self.manifest_path.write_text(json.dumps(self.manifest))
                self.assert_binding_rejected_before_mutation(self.manifest_path)
        for mode in ('static-textured-models', 'gameplay-pose'):
            with self.subTest(mode=mode):
                self.manifest = copy.deepcopy(original)
                self.manifest['scene'].update(sourceMode=mode, sourceBlend='apps/hmh-reboot/assets/source/blender/legacy.blend')
                self.manifest_path.write_text(json.dumps(self.manifest))
                self.assert_binding_rejected_before_mutation(self.manifest_path)
        for key, value in [('schema', 'changed'), ('pipelineId', 'changed'), ('frameDurationMs', 261), ('restDirection', 'east')]:
            with self.subTest(key=key):
                self.manifest = dict(copy.deepcopy(original), **{key: value})
                self.manifest_path.write_text(json.dumps(self.manifest))
                self.assert_binding_rejected_before_mutation(self.manifest_path)

    def test_private_manifest_and_targets_cannot_cross_capsules(self):
        capsules = ['.tmp/team/' + name for name in ('selector', 'selector-candidate', 'selector-correction')]
        for owner in capsules:
            path = self.root / owner / 'render.json'
            path.parent.mkdir(parents=True, exist_ok=True)
            for other in capsules:
                if owner == other:
                    continue
                for target in ('all', 'raw', 'output', 'module'):
                    with self.subTest(owner=owner, other=other, target=target):
                        candidate = copy.deepcopy(self.manifest)
                        candidate['render']['rawOutputDirectory'] = owner + '/raw'
                        candidate['atlas'].update(outputDirectory=owner + '/generated', module=owner + '/module.mjs')
                        if target in ('all', 'raw'):
                            candidate['render']['rawOutputDirectory'] = other + '/raw'
                        if target in ('all', 'output'):
                            candidate['atlas']['outputDirectory'] = other + '/generated'
                        if target in ('all', 'module'):
                            candidate['atlas']['module'] = other + '/module.mjs'
                        path.write_text(json.dumps(candidate))
                        self.assert_binding_rejected_before_mutation(path)

    def test_ground_contact_note_is_commentary_not_a_structural_gate(self):
        metadata, paths = self.install_checker_fixture()
        # Keep numeric/structural grounding identical, but allow independent notes.
        self.manifest['groundContact']['note'] = 'Native gameplay rig root; projection only.'
        self.manifest_path.write_text(json.dumps(self.manifest))
        metadata['sources'] = runner.provenance(self.manifest, self.manifest_path)
        metadata['groundContact']['note'] = 'Historical commentary, not geometry.'
        paths['metadata'].write_text(json.dumps(metadata))
        paths['module'].write_bytes(runner.module_bytes(metadata))
        self.assertEqual(runner.load_manifest(self.manifest_path), self.manifest)
        with redirect_stdout(io.StringIO()):
            runner.check(self.manifest_path)

    def test_exact_ordered_sources_and_default_real_aim(self):
        sources = self.sources()
        self.assertEqual([s['actorId'] for s in sources], [h['actorId'] for h in self.manifest['heroes']])
        for source, pilot in zip(sources, self.inputs['pilots']):
            self.assertEqual(source, {'actorId': pilot['actorId'], 'path': pilot['sourceModel']['path'],
                'sha256': pilot['sourceModel']['sourceSha256'], 'bytes': pilot['sourceModel']['sourceBytes'],
                'nativePose': {'action': 'HMH_Aim', 'frameIndex': 0, 'frameCount': 1, 'loop': False}})

    def test_canonical_lfs_for_every_hero_and_forged_oid_size_rejected(self):
        original = self.sources()
        for pilot in self.inputs['pilots']:
            self.pointer(pilot)
        self.assertEqual(self.sources(), original)
        for pilot in self.inputs['pilots']:
            for values in ({'oid': '0' * 64}, {'size': 999}):
                with self.subTest(actor=pilot['actorId'], values=values):
                    self.pointer(pilot, **values)
                    with self.assertRaisesRegex((RuntimeError, ValueError), 'mismatch'):
                        self.sources()
                    self.pointer(pilot)
        self.assertRaisesRegex(RuntimeError, 'materialized', runner.packed_gameplay_sources, self.manifest, self.root, require_materialized=True)

    def test_reject_missing_duplicate_unpacked_unsafe_and_tampered_sources(self):
        original = copy.deepcopy(self.inputs)
        mutations = [
            lambda: self.inputs['pilots'].pop(),
            lambda: self.inputs['pilots'].append(copy.deepcopy(self.inputs['pilots'][0])),
            lambda: self.inputs['pilots'][0]['sourceModel'].update(kind='glb'),
            lambda: self.inputs['pilots'][0]['sourceModel'].update(externalDependencyCount=1),
            lambda: self.inputs['pilots'][0]['sourceModel'].update(path='../escape.blend'),
            lambda: self.inputs['pilots'][0]['sourceModel'].update(sourceSha256='0' * 64),
            lambda: self.inputs['pilots'][0]['sourceModel'].update(sourceBytes=True),
        ]
        for mutate in mutations:
            self.inputs = copy.deepcopy(original)
            mutate()
            self.sync()
            with self.assertRaises((ValueError, RuntimeError)):
                self.sources()

    def test_explicit_native_pose_and_invalid_sampling_fail_closed(self):
        self.manifest['heroes'][0]['nativePose'] = {'action': 'HMH_Idle', 'frameIndex': 1, 'frameCount': 2, 'loop': True}
        with self.assertRaisesRegex(ValueError, 'native pose'):
            self.sources()
        for pose in ({'action': 'Invented'}, {'frameIndex': 1}, {'frameCount': 0}, {'loop': 'false'}, {'frameIndex': True}):
            self.manifest['heroes'][0]['nativePose'] = pose
            with self.assertRaises((ValueError, RuntimeError)):
                self.sources()
        self.manifest['heroes'][0].pop('nativePose')
        self.manifest['pose'] = {'mode': 'source-rest-pose', 'rigged': False}
        self.assertRaises(ValueError, self.sources)

    def test_native_pose_is_fixed_for_each_hero_and_manifest(self):
        fixed = dict(self.manifest['pose'])
        fixed.pop('mode')
        for hero in self.manifest['heroes']:
            hero['nativePose'] = dict(fixed)
        self.assertTrue(all(s['nativePose'] == fixed for s in self.sources()))
        for key, value in [('action', 'HMH_Idle'), ('frameIndex', 1), ('frameCount', 2),
                           ('loop', True), ('frameIndex', False), ('frameCount', True), ('loop', 0)]:
            for target in [self.manifest['pose'], *[h['nativePose'] for h in self.manifest['heroes']]]:
                with self.subTest(key=key, value=value, target=target):
                    old = target[key]
                    target[key] = value
                    with self.assertRaisesRegex(ValueError, 'native pose'):
                        try:
                            self.sources()
                        finally:
                            target[key] = old

    def test_roster_requires_four_exact_ordered_portal_actor_pairs(self):
        original = copy.deepcopy(self.manifest['heroes'])
        swapped_actors = copy.deepcopy(original)
        swapped_actors[0]['actorId'], swapped_actors[1]['actorId'] = swapped_actors[1]['actorId'], swapped_actors[0]['actorId']
        variants = [original[:3], [], original + [original[0]], original[::-1], swapped_actors,
                    [dict(original[0], portalHeroId='lester'), *original[1:]],
                    [dict(original[0], actorId='lilly'), *original[1:]]]
        for heroes in variants:
            with self.subTest(heroes=heroes):
                self.manifest['heroes'] = heroes
                with self.assertRaisesRegex(ValueError, 'selector.*(roster|mapping)'):
                    self.sources()
        self.manifest['heroes'] = original
        self.assertEqual(len(self.sources()), 4)

    def test_manifest_paths_fail_before_render_mutation_or_check_output_read(self):
        original = copy.deepcopy(self.manifest)
        sentinel = self.root / '.tmp/team/other-owner/keep.txt'
        sentinel.parent.mkdir(parents=True)
        sentinel.write_text('immutable sentinel')
        cases = [
            ('render', 'rawOutputDirectory', value) for value in
            ['.', '.tmp', '.tmp/team', '.tmp/team/other-owner', '.tmp/team/selector-candidate',
             '../escape', '/absolute', 'C:/escape', '.tmp/../apps', '.tmp\\escape']
        ] + [
            ('scene', 'exporter', 'scripts/hmh-blender/export-hmh-production-hero-pilot.py'),
            ('scene', 'heroExporter', 'scripts/hmh-blender/export-hmh-hero-selector.py'),
            ('scene', 'exporter', str(self.root / original['scene']['exporter'])),
            ('scene', 'sourceManifest', 'apps/hmh-reboot/assets/source/blender/../blender/hmh-production-heroes.json'),
            ('atlas', 'outputDirectory', 'apps/portal/src'),
            ('atlas', 'module', 'apps/portal/src/main.mjs'),
            ('atlas', 'metadata', '../keep.txt'),
            ('atlas', 'imageSuffix', '/../../keep.txt'),
            ('atlas', 'publicUrlBase', '/assets/../outside'),
            ('atlas', 'outputDirectory', '.tmp/team/selector-candidate/generated'),
        ]
        for section, key, value in cases:
            with self.subTest(section=section, key=key, value=value):
                self.manifest = copy.deepcopy(original)
                self.manifest[section][key] = value
                self.manifest_path.write_text(json.dumps(self.manifest))
                # Never execute Blender or delete anything, even on RED. The traps
                # turn a reached unsafe operation into an assertion, not a render.
                with patch.object(runner, 'BLENDER', self.manifest_path), \
                     patch.object(runner, 'blender_version', side_effect=AssertionError('executable used before validation')), \
                     patch.object(runner.shutil, 'rmtree', side_effect=AssertionError('destructive mutation')), \
                     patch.object(runner, 'run_checked', side_effect=AssertionError('Blender forbidden')):
                    with self.assertRaisesRegex(ValueError, '(path|lane|capsule|exporter|atlas)'):
                        runner.render(self.manifest_path)
                real_read = runner.read_json
                def manifest_only(path):
                    if path != self.manifest_path:
                        raise AssertionError('check used a file before path validation')
                    return real_read(path)
                with patch.object(runner, 'read_json', side_effect=manifest_only):
                    with self.assertRaisesRegex(ValueError, '(path|lane|capsule|exporter|atlas)'):
                        runner.check(self.manifest_path)
                self.assertEqual(sentinel.read_text(), 'immutable sentinel')

    def test_unsafe_raw_deletion_and_check_reads_are_independently_blocked(self):
        self.manifest['render']['rawOutputDirectory'] = '.tmp/team/other-owner'
        self.manifest_path.write_text(json.dumps(self.manifest))
        sentinel = self.root / '.tmp/team/other-owner/keep.txt'
        sentinel.parent.mkdir(parents=True)
        sentinel.write_text('immutable sentinel')
        with self.subTest(entry='render'), \
             patch.object(runner, 'BLENDER', self.manifest_path), \
             patch.object(runner, 'blender_version', return_value=self.manifest['scene']['blenderVersion']), \
             patch.object(runner.shutil, 'rmtree', side_effect=AssertionError('unsafe deletion reached')):
            with self.assertRaisesRegex(ValueError, '(path|lane|capsule)'):
                runner.render(self.manifest_path)
        real_read = runner.read_json
        def manifest_only(path):
            if path != self.manifest_path:
                raise AssertionError('unsafe check read reached')
            return real_read(path)
        with self.subTest(entry='check'), patch.object(runner, 'read_json', side_effect=manifest_only):
            with self.assertRaisesRegex(ValueError, '(path|lane|capsule)'):
                runner.check(self.manifest_path)
        self.assertEqual(sentinel.read_text(), 'immutable sentinel')

    def test_direction_cannot_inject_render_filename_path(self):
        self.manifest['directions'][0] = '../../other-owner/keep'
        with self.assertRaisesRegex(ValueError, '(path|direction)'):
            runner.output_paths(self.manifest)

    def test_existing_candidate_uses_only_explicit_readonly_source_lanes(self):
        candidate = copy.deepcopy(self.manifest)
        candidate['scene']['sourceManifest'] = '.tmp/hero-delivery-manifest.json'
        candidate['render']['rawOutputDirectory'] = '.tmp/team/selector-candidate/raw'
        candidate['atlas'].update(outputDirectory='.tmp/team/selector-candidate/generated',
                                  module='.tmp/team/selector-candidate/selector-atlas.mjs')
        # Use only the candidate's explicit lane values, not its artifacts/rigs.
        paths = runner.output_paths(candidate)
        self.assertEqual(paths['dir'], self.root / '.tmp/team/selector-candidate/generated')

    def test_selector_capsule_paths_are_coupled_and_canonical(self):
        self.assertEqual(runner.output_paths(self.manifest)['dir'],
                         self.root / self.manifest['atlas']['outputDirectory'])
        capsule = '.tmp/team/selector-candidate'
        self.manifest['render']['rawOutputDirectory'] = capsule + '/raw'
        self.manifest['atlas'].update(outputDirectory=capsule + '/generated', module=capsule + '/module.mjs')
        self.assertEqual(runner.output_paths(self.manifest)['module'], self.root / capsule / 'module.mjs')
        self.manifest['atlas']['module'] = capsule + '/selector-atlas.mjs'
        runner.output_paths(self.manifest)
        for value in ['.tmp/team/selector-correction/module.mjs', '.tmp/team/other-owner/module.mjs',
                      capsule + '/raw/module.mjs', capsule + '/generated/../module.mjs']:
            with self.subTest(value=value):
                self.manifest['atlas']['module'] = value
                with self.assertRaisesRegex(ValueError, '(path|capsule|lane)'):
                    runner.output_paths(self.manifest)

    def test_resolved_output_aliases_cannot_escape_owned_lane(self):
        # Deterministic symlink/junction resolution witness, no OS privilege changes.
        original_resolve = Path.resolve
        output = self.root / self.manifest['atlas']['outputDirectory']
        sentinel = self.root / '.tmp/team/other-owner/keep.txt'
        sentinel.parent.mkdir(parents=True)
        sentinel.write_text('immutable sentinel')
        def resolved(path, *args, **kwargs):
            if path == output or path.is_relative_to(output):
                return sentinel.parent / path.relative_to(output)
            return original_resolve(path, *args, **kwargs)
        with patch.object(Path, 'resolve', resolved):
            with self.assertRaisesRegex(ValueError, '(path|symlink|lane)'):
                runner.output_paths(self.manifest)
        self.assertEqual(sentinel.read_text(), 'immutable sentinel')

    def test_real_directory_link_cannot_redirect_raw_deletion_or_check(self):
        sentinel = self.root / '.tmp/team/other-owner/keep.txt'
        sentinel.parent.mkdir(parents=True)
        sentinel.write_text('immutable sentinel')
        raw = self.root / self.manifest['render']['rawOutputDirectory']
        raw.parent.mkdir(parents=True, exist_ok=True)
        if sys.platform == 'win32':
            import _winapi
            _winapi.CreateJunction(str(sentinel.parent), str(raw))
        else:
            raw.symlink_to(sentinel.parent, target_is_directory=True)
        # Remove only the link, never recursively traverse the sentinel target.
        def remove_link():
            if sys.platform == 'win32':
                raw.rmdir()
            else:
                raw.unlink()
        self.addCleanup(remove_link)
        self.assertEqual((raw / 'keep.txt').read_text(), 'immutable sentinel')
        for entry in (runner.render, runner.check):
            with self.subTest(entry=entry.__name__), \
                 patch.object(runner.shutil, 'rmtree', side_effect=AssertionError('unsafe deletion')), \
                 patch.object(runner, 'blender_version', side_effect=AssertionError('Blender forbidden')):
                with self.assertRaisesRegex(ValueError, 'path.*(symlink|alias)'):
                    entry(self.manifest_path)
            self.assertEqual(sentinel.read_text(), 'immutable sentinel')

    def test_source_models_cannot_use_other_repository_lanes(self):
        source = self.inputs['pilots'][0]['sourceModel']
        original = self.root / source['path']
        target = self.root / 'scripts/borrowed.blend'
        target.write_bytes(original.read_bytes())
        source['path'] = 'scripts/borrowed.blend'
        self.sync()
        with self.assertRaisesRegex(ValueError, '(path|lane)'):
            self.sources()

    def install_checker_fixture(self):
        paths = runner.output_paths(self.manifest)
        canonical_dir = ROOT / 'apps/portal/assets/generated/hmh-reboot-hero-selector'
        metadata = json.loads((canonical_dir / 'hmh-reboot-hero-selector-atlas.json').read_text())
        # CPU fixture evidence only; never bless canonical generated provenance.
        metadata['sources'] = runner.provenance(self.manifest, self.manifest_path)
        paths['dir'].mkdir(parents=True, exist_ok=True)
        paths['module'].parent.mkdir(parents=True, exist_ok=True)
        for hero in self.manifest['heroes']:
            entry = metadata['heroes'][hero['portalHeroId']]
            local_url = paths['url'](hero['actorId'])
            entry['image'] = local_url
            entry['frames'] = [local_url + ref[ref.index('#frame='):] for ref in entry['frames']]
            target = paths['image'](hero['actorId'])
            target.write_bytes((canonical_dir / target.name).read_bytes())
        return metadata, paths

    def test_check_rejects_metadata_camera_pitch_drift_with_unchanged_module_and_pixels(self):
        metadata, paths = self.install_checker_fixture()
        paths['metadata'].write_text(json.dumps(metadata))
        paths['module'].write_bytes(runner.module_bytes(metadata))
        with redirect_stdout(io.StringIO()):
            runner.check(self.manifest_path)
        metadata['render']['cameraPitchDegrees'] = 35
        paths['metadata'].write_text(json.dumps(metadata))
        with redirect_stdout(io.StringIO()), self.assertRaisesRegex(SystemExit, 'render.cameraPitchDegrees'):
            runner.check(self.manifest_path)

    def test_private_check_rejects_frame_actor_ownership_drift_with_unchanged_module_and_pixels(self):
        self.manifest, self.manifest_path = self.private_manifest()
        self.sync()
        metadata, paths = self.install_checker_fixture()
        paths['metadata'].write_text(json.dumps(metadata))
        paths['module'].write_bytes(runner.module_bytes(metadata))
        with redirect_stdout(io.StringIO()):
            runner.check(self.manifest_path)
        record = metadata['frames'][0]
        record['actorId'] = 'lilly' if record['actorId'] != 'lilly' else 'lit-commando'
        paths['metadata'].write_text(json.dumps(metadata))
        with redirect_stdout(io.StringIO()), self.assertRaisesRegex(SystemExit, 'frame .* ownership'):
            runner.check(self.manifest_path)

    def test_private_output_urls_bind_to_capsule_images(self):
        self.manifest, self.manifest_path = self.private_manifest()
        self.sync()
        paths = runner.output_paths(self.manifest)
        for hero in self.manifest['heroes']:
            expected = '/' + paths['image'](hero['actorId']).relative_to(self.root).as_posix()
            self.assertEqual(paths['url'](hero['actorId']), expected)

    def test_check_rejects_changed_or_missing_authorities_even_with_matching_module(self):
        original, paths = self.install_checker_fixture()
        contract = {'classification': 'production-art', 'runtimeAuthority': 'projection-only', 'gameplayAuthority': 'none'}
        for key in contract:
            for value in ['authoritative', None]:
                for change_manifest in [False, True]:
                    with self.subTest(key=key, value=value, change_manifest=change_manifest):
                        metadata = copy.deepcopy(original)
                        if value is None:
                            metadata.pop(key)
                        else:
                            metadata[key] = value
                        if change_manifest:
                            if value is None:
                                self.manifest.pop(key)
                            else:
                                self.manifest[key] = value
                        self.manifest_path.write_text(json.dumps(self.manifest))
                        metadata['sources']['renderManifestSha256'] = runner.sha256_file(self.manifest_path)
                        paths['metadata'].write_text(json.dumps(metadata))
                        # Match the consumed module even when a declaration is absent.
                        complete = dict(metadata)
                        complete.setdefault(key, '__missing__')
                        module = runner.module_bytes(complete).decode()
                        if value is None:
                            module = module.replace(json.dumps(key) + ':"__missing__",', '')
                        paths['module'].write_text(module, newline='\n')
                        self.manifest[key] = contract[key]
                        with redirect_stdout(io.StringIO()):
                            with self.assertRaisesRegex((SystemExit, ValueError), key):
                                runner.check(self.manifest_path)

    def test_runner_only_change_makes_real_check_stale_without_changing_outputs(self):
        producer = self.root / 'scripts/run-hmh-hero-selector-render.py'
        producer.write_bytes((ROOT / 'scripts/run-hmh-hero-selector-render.py').read_bytes())
        (self.root / 'scripts/hmh_pipeline_lock.py').write_bytes((ROOT / 'scripts/hmh_pipeline_lock.py').read_bytes())
        import subprocess
        def cli_check():
            return subprocess.run([sys.executable, '-B', str(producer), '--manifest', str(self.manifest_path), '--check'],
                cwd=self.root, capture_output=True, text=True, encoding='utf-8')
        metadata, paths = self.install_checker_fixture()
        paths['metadata'].write_text(json.dumps(metadata))
        paths['module'].write_bytes(runner.module_bytes(metadata))
        args = SimpleNamespace(manifest=str(self.manifest_path), check=True)
        with patch.object(runner, 'parse_args', return_value=args), redirect_stdout(io.StringIO()):
            runner.main()
        initial_cli = cli_check()
        self.assertEqual(initial_cli.returncode, 0, initial_cli.stderr)
        outputs_before = {p: p.read_bytes() for p in [paths['metadata'], paths['module'],
            *[paths['image'](h['actorId']) for h in self.manifest['heroes']]]}
        producer.write_bytes(producer.read_bytes() + b'\n# runner-only stale-output challenge\n')
        with patch.object(runner, 'parse_args', return_value=args), redirect_stdout(io.StringIO()), \
             patch.object(runner, 'run_checked', side_effect=AssertionError('Blender forbidden')):
            with self.assertRaisesRegex(SystemExit, 'sources.runnerSha256'):
                runner.main()
        stale_cli = cli_check()
        self.assertNotEqual(stale_cli.returncode, 0)
        self.assertIn('sources.runnerSha256', stale_cli.stderr)
        self.assertEqual({p: p.read_bytes() for p in outputs_before}, outputs_before)
        self.assertEqual(runner.source_provenance_drift(metadata['sources'],
            runner.provenance(self.manifest, self.manifest_path)), ['runnerSha256'])

    def test_provenance_has_per_hero_list_not_combined_scene(self):
        result = runner.provenance(self.manifest, self.manifest_path)
        self.assertEqual(result['sourceMode'], 'packed-gameplay-sources')
        self.assertEqual(result['sourceAssets'], self.sources())
        self.assertNotIn('sourceBlend', result)
        self.assertNotIn('sourceBlendSha256', result)
        self.assertNotIn('sourceBuilder', result)
        self.assertEqual(result['sourceHelperSha256'], runner.sha256_file(self.root / 'scripts/hmh_selector_native_sources.py'))
        stale = dict(result, sourceBlend='fictional-combined.blend')
        self.assertIn('sourceBlend', runner.source_provenance_drift(stale, result))
        self.assertIn('sourceBlend', runner.source_provenance_drift(dict(result, sourceBlend=None), result))
        stale = copy.deepcopy(result)
        stale['sourceAssets'].reverse()
        self.assertIn('sourceAssets', runner.source_provenance_drift(stale, result))

    def test_check_walks_all_native_pointer_sources_and_rejects_combined_or_reordered_receipts(self):
        # Unit fixture only: reuse static selector pixels to exercise the checker.
        # This does not assert that those pixels were rendered from native models.
        paths = runner.output_paths(self.manifest)
        metadata_rel = paths['metadata'].relative_to(self.root)
        metadata = json.loads((ROOT / metadata_rel).read_text())
        metadata['pose'] = self.manifest['pose']
        metadata['sources'] = runner.provenance(self.manifest, self.manifest_path)
        paths['dir'].mkdir(parents=True)
        paths['module'].parent.mkdir(parents=True)
        paths['module'].write_bytes(runner.module_bytes(metadata))
        for hero in self.manifest['heroes']:
            target = paths['image'](hero['actorId'])
            target.write_bytes((ROOT / target.relative_to(self.root)).read_bytes())
        for pilot in self.inputs['pilots']:
            self.pointer(pilot)
        def check_fixture(record):
            paths['metadata'].write_text(json.dumps(record))
            with redirect_stdout(io.StringIO()), patch.object(runner, 'run_checked', side_effect=AssertionError('Blender forbidden')):
                runner.check(self.manifest_path)
        check_fixture(metadata)
        for mutate, error in [
                (lambda r: r['sources']['sourceAssets'].reverse(), 'sources.sourceAssets'),
                (lambda r: r['sources'].update(sourceBlend='combined.blend'), 'sources.sourceBlend'),
                (lambda r: r['sources']['sourceAssets'].pop(), 'sources.sourceAssets'),
                (lambda r: r['sources'].update(heroExporterSha256='0' * 64), 'sources.heroExporterSha256')]:
            changed = copy.deepcopy(metadata)
            mutate(changed)
            with self.assertRaisesRegex(SystemExit, error):
                check_fixture(changed)
        for pilot in self.inputs['pilots']:
            self.pointer(pilot, oid='0' * 64)
            with self.assertRaisesRegex(RuntimeError, 'Source LFS pointer mismatch'):
                check_fixture(metadata)
            self.pointer(pilot)

    def test_commands_are_one_immutable_blend_per_hero_with_autoexec_disabled_first(self):
        jobs = runner.selector_render_jobs(self.manifest, self.manifest_path, self.root / 'raw', self.root / 'report.json')
        self.assertEqual(len(jobs), 4)
        for job, source in zip(jobs, self.sources()):
            command = job['command']
            blend = str(self.root / source['path'])
            self.assertEqual([x for x in command if x.endswith('.blend')], [blend])
            self.assertLess(command.index('--disable-autoexec'), command.index(blend))
            self.assertEqual(command[command.index('--actor-id') + 1], source['actorId'])
            self.assertEqual(command[command.index('--python-exit-code') + 1], '1')
        self.assertEqual(len({str(job['report']) for job in jobs}), 4)
        # Legacy modes remain available only in an explicitly owned private capsule.
        capsule = '.tmp/team/selector-candidate'
        self.manifest_path = self.root / capsule / 'legacy-render.json'
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        self.manifest['render']['rawOutputDirectory'] = capsule + '/raw'
        self.manifest['atlas'].update(outputDirectory=capsule + '/generated', module=capsule + '/module.mjs')
        for mode in ('static-textured-models', 'gameplay-pose'):
            self.manifest['scene'].update(sourceMode=mode, sourceBlend='apps/hmh-reboot/assets/source/blender/legacy.blend')
            self.manifest_path.write_text(json.dumps(self.manifest))
            self.assertEqual(runner.load_manifest(self.manifest_path), self.manifest)
            jobs = runner.selector_render_jobs(self.manifest, self.manifest_path, self.root / 'raw', self.root / 'report.json')
            self.assertEqual(len(jobs), 1)
            self.assertNotIn('--actor-id', jobs[0]['command'])
            self.assertLess(jobs[0]['command'].index('--disable-autoexec'), jobs[0]['command'].index(str(self.root / 'apps/hmh-reboot/assets/source/blender/legacy.blend')))

    def test_native_binding_uses_real_action_slot_and_sampling_without_trig_reset(self):
        action = SimpleNamespace(name='HMH_Aim', frame_range=(1, 21))
        slot = object()
        frames = []
        bpy = SimpleNamespace(data=SimpleNamespace(actions={'HMH_Aim': action}),
            context=SimpleNamespace(scene=SimpleNamespace(frame_set=frames.append)))
        extras = SimpleNamespace(anim_utils=SimpleNamespace(action_get_first_suitable_slot=lambda a, kind: slot))
        with patch.dict(sys.modules, {'bpy': bpy, 'bpy_extras': extras,
                'bpy_extras.object_utils': SimpleNamespace(world_to_camera_view=None)}):
            exporter = load_python('selector_exporter_test', ROOT / 'scripts/hmh-blender/export-hmh-hero-selector.py')
            native = load_python('hero_exporter_test', ROOT / 'scripts/hmh-blender/export-hmh-production-hero-pilot.py')
        track = SimpleNamespace(mute=False)
        rig = SimpleNamespace(animation_data=SimpleNamespace(nla_tracks=[track]))
        with patch.object(native, 'reset_pose', side_effect=AssertionError('native quaternion pose must not reset')):
            receipt = exporter.apply_native_selector_pose(native, rig,
                {'action': 'HMH_Aim', 'frameIndex': 1, 'frameCount': 2, 'loop': True})
        self.assertIs(rig.animation_data.action, action)
        self.assertIs(rig.animation_data.action_slot, slot)
        self.assertTrue(track.mute)
        self.assertEqual(frames, [11])
        self.assertEqual(receipt, {'action': 'HMH_Aim', 'sampledFrame': 11})
        with self.assertRaisesRegex(RuntimeError, 'Missing clip action'):
            exporter.apply_native_selector_pose(native, rig,
                {'action': 'Missing', 'frameIndex': 0, 'frameCount': 1, 'loop': False})

    def test_exporter_main_isolates_each_hero_and_keeps_native_action_for_eight_directions(self):
        self.exercise_exporter_main()

    def test_exporter_main_measures_pitch_and_rejects_mismatched_camera(self):
        self.exercise_exporter_main(camera_pitch=35, reject_pitch=True)

    def test_exporter_reports_measured_not_declared_pitch(self):
        self.exercise_exporter_main(camera_pitch=55.00001)

    def exercise_exporter_main(self, camera_pitch=55, reject_pitch=False):
        # bpy is a boundary double: record render requests, never run Blender or emit images.
        class Obj(dict):
            def __init__(self, name, kind, **tags):
                super().__init__(tags)
                self.name, self.type, self.hide_render = name, kind, False
        class Objects(list):
            def get(self, name):
                return next((obj for obj in self if obj.name == name), None)
        self.inputs['scene'] = {'armature': 'unused-default'}
        self.inputs['directionAngles'] = json.loads((ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text())['directionAngles']
        for pilot in self.inputs['pilots']:
            pilot.update(armature=pilot['actorId'] + '-rig', layers=['shadow', 'lower-body', 'torso-head', 'weapon'])
        self.sync()
        for hero, pilot in zip(self.manifest['heroes'], self.inputs['pilots']):
            actor = hero['actorId']
            rig = Obj(pilot['armature'], 'ARMATURE', hmh_actor_id=actor)
            rig.rotation_mode, rig.rotation_euler, rig.location = 'XYZ', [0, 0, 0], [0, 0, 0]
            rig.matrix_world = SimpleNamespace(translation=(0, 0, 0))
            rig.animation_data = SimpleNamespace(nla_tracks=[SimpleNamespace(mute=False)])
            meshes = [Obj(layer, 'MESH', hmh_actor_id=actor, hmh_layer=layer) for layer in pilot['layers']]
            excluded = [Obj('demo', 'MESH', hmh_actor_id=actor, hmh_prop_role='satoshi-frag-released'), Obj('unowned', 'MESH')]
            action = SimpleNamespace(name='HMH_Aim', frame_range=(1, 21))
            slot = object()
            scene = SimpleNamespace(render=SimpleNamespace(engine='BLENDER_EEVEE', image_settings=SimpleNamespace()),
                camera=SimpleNamespace(data=SimpleNamespace(ortho_scale=2.75),
                    matrix_world=((1, 0, math.sin(math.radians(camera_pitch)), 0),
                                  (0, 1, 0, 0), (0, 0, math.cos(math.radians(camera_pitch)), 0), (0, 0, 0, 1))),
                view_settings=SimpleNamespace(exposure=-0.45),
                frame_set=lambda frame: None)
            scene.camera.evaluated_get = lambda graph: scene.camera
            renders, reports = [], []
            def request_render(**kwargs):
                self.assertIs(rig.animation_data.action, action)
                self.assertIs(rig.animation_data.action_slot, slot)
                self.assertTrue(all(not obj.hide_render for obj in meshes))
                self.assertTrue(all(obj.hide_render for obj in excluded))
                self.assertEqual((scene.render.resolution_x, scene.render.resolution_y), (384, 384))
                renders.append((Path(scene.render.filepath).name, rig.rotation_euler[2]))
            bpy = SimpleNamespace(data=SimpleNamespace(filepath=str(self.root / pilot['sourceModel']['path']),
                objects=Objects([rig, *meshes, *excluded]), actions={'HMH_Aim': action}),
                context=SimpleNamespace(scene=scene, view_layer=SimpleNamespace(update=lambda: None),
                    evaluated_depsgraph_get=lambda: object()),
                ops=SimpleNamespace(render=SimpleNamespace(render=request_render)))
            extras = SimpleNamespace(anim_utils=SimpleNamespace(action_get_first_suitable_slot=lambda a, kind: slot))
            with patch.dict(sys.modules, {'bpy': bpy, 'bpy_extras': extras,
                    'bpy_extras.object_utils': SimpleNamespace(world_to_camera_view=lambda *args: SimpleNamespace(x=0.5, y=0.2))}):
                exporter = load_python('selector_main_test', ROOT / 'scripts/hmh-blender/export-hmh-hero-selector.py')
                args = SimpleNamespace(manifest=str(self.manifest_path), repo_root=str(self.root),
                    raw_output=str(self.export_destinations(actor=actor)[0]),
                    report_output=str(self.export_destinations(actor=actor)[1]), actor_id=actor)
                with patch.object(exporter, 'blender_args', return_value=args), patch.object(exporter, 'write_lf_json', side_effect=lambda path, value: reports.append(value)), redirect_stdout(io.StringIO()):
                    if reject_pitch:
                        with self.assertRaisesRegex(RuntimeError, "camera pitch"), \
                             patch.object(Path, "mkdir", side_effect=AssertionError("mkdir before camera assertion")):
                            exporter.main()
                        self.assertEqual(renders, [])
                        self.assertEqual(reports, [])
                        continue
                    exporter.main()
            self.assertIn('cameraPitchDegrees', reports[0], 'exporter must report its camera measurement')
            self.assertAlmostEqual(reports[0]["cameraPitchDegrees"], camera_pitch, places=8)
            self.assertEqual(len(renders), 8)
            self.assertEqual(len({angle for _, angle in renders}), 8)
            self.assertEqual(reports[0]['frames'], [runner.frame_filename(actor, d) for d in self.manifest['directions']])
            self.assertEqual(list(reports[0]['heroes']), [hero['portalHeroId']])
            self.assertEqual(reports[0]['sourceAssets'], [self.sources()[self.manifest['heroes'].index(hero)]])
            self.assertEqual(reports[0]['heroes'][hero['portalHeroId']]['nativePose'], {'action': 'HMH_Aim', 'sampledFrame': 1})
            self.assertIs(reports[0]['saved'], False)

    def test_packed_metadata_retains_measured_camera_pitch(self):
        metadata, paths = self.install_checker_fixture()
        frames = {}
        for record in metadata['frames']:
            image = runner.Image.open(paths['image'](record['actorId'])).convert('RGBA')
            f = record['frame']
            frames[runner.frame_filename(record['actorId'], record['direction'])] = runner.canonical_rgba(
                image.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])))
        reports = [{'engine': self.manifest['render']['engine'], 'cameraPitchDegrees': 55.00001,
                    'pivotPixels': {name: metadata['render']['projectedPivot'] for name in frames}} for _ in range(2)]
        built, _ = runner.build_outputs(self.manifest, self.manifest_path, frames,
            metadata['metrics']['reproducibilityObserved'], '5.1.2', reports)
        self.assertEqual(built['render']['cameraPitchDegrees'], 55.00001)

    def test_render_report_requires_exact_sources_frames_and_no_save(self):
        sources = self.sources()
        jobs = runner.selector_render_jobs(self.manifest, self.manifest_path, self.root / 'raw', self.root / 'report.json')
        reports = []
        for job, source in zip(jobs, sources):
            frames = [runner.frame_filename(source['actorId'], d) for d in self.manifest['directions']]
            reports.append({'status': 'pass', 'saved': False, 'frameCount': 8, 'frameSize': [384, 384],
                'engine': self.manifest['render']['engine'], 'cameraPitchDegrees': 55.00001,
                'frames': frames, 'pivotPixels': {f: [192, 300] for f in frames},
                'sourceAssets': [source], 'heroes': {job['hero']['portalHeroId']: {'actorId': source['actorId']}},
                'sourceBlend': str(self.root / source['path'])})
        with patch.object(runner, 'run_checked', return_value=''), patch.object(runner, 'read_json', side_effect=reports):
            report = runner.render_pass(self.manifest, self.manifest_path, None, self.root / 'raw', self.root / 'report.json', 'test')
        self.assertEqual(report['frameCount'], 32)
        self.assertEqual(report['sourceAssets'], sources)
        for key, value in [('saved', True), ('sourceAssets', []), ('frames', []), ('sourceBlend', 'other.blend'),
                           ('cameraPitchDegrees', 35), ('cameraPitchDegrees', None), ('cameraPitchDegrees', float('nan'))]:
            altered = copy.deepcopy(reports)
            altered[0][key] = value
            with patch.object(runner, 'run_checked', return_value=''), patch.object(runner, 'read_json', side_effect=altered):
                self.assertRaises(RuntimeError, runner.render_pass, self.manifest, self.manifest_path, None, self.root / 'raw', self.root / 'report.json', 'test')


if __name__ == '__main__':
    unittest.main(verbosity=2)
