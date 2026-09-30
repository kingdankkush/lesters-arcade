"""Fixture-only tests for the local authoring source boundary; no Git or assets."""
import hashlib
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('source_art_paths', ROOT / 'scripts/lib/source_art_paths.py')
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class SourceArtPathsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='hmh-source-art-')
        self.base = Path(self.temp.name)
        self.root = self.base / 'archive'
        self.root.mkdir()
        self.source = self.root / 'family' / 'original.blend'
        self.source.parent.mkdir()
        self.payload = b'fixture source; never a real model\x00\xff'
        self.source.write_bytes(self.payload)
        self.sha = hashlib.sha256(self.payload).hexdigest()

    def tearDown(self):
        self.temp.cleanup()

    def verify(self, root=None, relative='family/original.blend', sha=None, size=None):
        return module.verify_source_artifact(
            self.root if root is None else root, relative,
            expected_sha256=self.sha if sha is None else sha,
            expected_bytes=len(self.payload) if size is None else size)

    def junction(self, target, alias):
        if os.name == 'nt':
            import _winapi
            _winapi.CreateJunction(str(target), str(alias))
        else:
            alias.symlink_to(target, target_is_directory=True)
        self.assertTrue(alias.exists())

    def test_exact_identity_and_read_only_context(self):
        record = self.verify()
        self.assertEqual(record.path, self.source)
        self.assertEqual(record.sha256, self.sha)
        self.assertEqual(record.bytes, len(self.payload))
        with module.verified_source_artifact(self.root, 'family/original.blend',
                                            expected_sha256=self.sha, expected_bytes=len(self.payload)) as path:
            self.assertEqual(path.read_bytes(), self.payload)
        self.assertEqual(self.source.read_bytes(), self.payload)

    def test_explicit_existing_absolute_root_required(self):
        for root in (None, '', Path('archive'), self.base / 'missing'):
            with self.subTest(root=str(root)):
                with self.assertRaises((ValueError, FileNotFoundError)):
                    self.verify(root=root if root is not None else '')

    def test_root_file_rejected(self):
        with self.assertRaises(ValueError):
            self.verify(root=self.source)

    def test_no_relative_path_aliases_or_escape(self):
        for relative in ('', '.', '..', '../outside.blend', 'family/../original.blend',
                         '/original.blend', 'C:/original.blend', 'family\\original.blend',
                         '//server/share.blend', 'family//original.blend', 'family/./original.blend',
                         'family/original.blend/', 'family/original.blend:stream', 'family./original.blend',
                         'family /original.blend', 'family/\x00original.blend'):
            with self.subTest(relative=repr(relative)):
                with self.assertRaises(ValueError):
                    self.verify(relative=relative)

    def test_missing_source_fails(self):
        with self.assertRaises(FileNotFoundError):
            self.verify(relative='family/missing.blend')

    def test_directory_is_not_source_file(self):
        with self.assertRaises(ValueError):
            self.verify(relative='family')

    def test_hash_mismatch_fails(self):
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            self.verify(sha='0' * 64)

    def test_byte_mismatch_fails(self):
        with self.assertRaisesRegex(ValueError, 'byte'):
            self.verify(size=len(self.payload) + 1)

    def test_identity_metadata_is_required_and_strict(self):
        for sha in ('', 'a' * 63, 'g' * 64, self.sha.upper(), None):
            with self.subTest(sha=sha):
                with self.assertRaises(ValueError):
                    module.verify_source_artifact(self.root, 'family/original.blend',
                                                  expected_sha256=sha, expected_bytes=len(self.payload))
        for size in (-1, 0, True, 1.2, '10', None):
            with self.subTest(size=size):
                with self.assertRaises(ValueError):
                    module.verify_source_artifact(self.root, 'family/original.blend',
                                                  expected_sha256=self.sha, expected_bytes=size)

    def test_junction_escape_rejected_without_reading_target(self):
        outside = self.base / 'outside'
        outside.mkdir()
        witness = outside / 'original.blend'
        witness.write_bytes(self.payload)
        alias = self.root / 'alias'
        self.junction(outside, alias)
        with self.assertRaisesRegex(ValueError, 'link|reparse'):
            self.verify(relative='alias/original.blend')
        self.assertEqual(witness.read_bytes(), self.payload)

    def test_even_in_root_junction_rejected(self):
        alias = self.root / 'alias'
        self.junction(self.source.parent, alias)
        with self.assertRaisesRegex(ValueError, 'link|reparse'):
            self.verify(relative='alias/original.blend')

    def test_root_junction_rejected(self):
        alias = self.base / 'root-alias'
        self.junction(self.root, alias)
        with self.assertRaisesRegex(ValueError, 'link|reparse'):
            self.verify(root=alias)

    def test_changed_input_detected_on_success(self):
        with self.assertRaisesRegex(ValueError, 'SHA-256|byte'):
            with module.verified_source_artifact(self.root, 'family/original.blend',
                                                expected_sha256=self.sha, expected_bytes=len(self.payload)):
                self.source.write_bytes(b'x' * len(self.payload))

    def test_deleted_input_detected_on_success(self):
        with self.assertRaises(FileNotFoundError):
            with module.verified_source_artifact(self.root, 'family/original.blend',
                                                expected_sha256=self.sha, expected_bytes=len(self.payload)):
                self.source.unlink()

    def test_original_operation_error_preserved_if_source_unchanged(self):
        original = RuntimeError('fixture authoring failure')
        with self.assertRaises(RuntimeError) as caught:
            with module.verified_source_artifact(self.root, 'family/original.blend',
                                                expected_sha256=self.sha, expected_bytes=len(self.payload)):
                raise original
        self.assertIs(caught.exception, original)

    def test_changed_source_checked_even_when_operation_fails(self):
        original = RuntimeError('fixture authoring failure')
        with self.assertRaisesRegex(ValueError, 'SHA-256|byte') as caught:
            with module.verified_source_artifact(self.root, 'family/original.blend',
                                                expected_sha256=self.sha, expected_bytes=len(self.payload)):
                self.source.write_bytes(b'x' * len(self.payload))
                raise original
        self.assertIs(caught.exception.__context__, original)

    def test_source_directory_replaced_by_junction_is_detected(self):
        outside = self.base / 'outside'
        outside.mkdir()
        witness = outside / 'original.blend'
        witness.write_bytes(self.payload)
        with self.assertRaisesRegex(ValueError, 'link|reparse'):
            with module.verified_source_artifact(self.root, 'family/original.blend',
                                                expected_sha256=self.sha, expected_bytes=len(self.payload)):
                self.source.unlink()
                self.source.parent.rmdir()
                self.junction(outside, self.source.parent)
        self.assertEqual(witness.read_bytes(), self.payload)


if __name__ == '__main__':
    unittest.main()
