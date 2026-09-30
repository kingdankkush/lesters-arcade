"""Explicit, hash-pinned local authoring inputs. Never selects a default archive.

This helper reads only the requested source. It does not copy, remove or write
artwork, and it is not a cloud-build substitute for an actual native source gate.
Before/after checks detect changed inputs; they do not lock a file against a
concurrent external writer or prove Blender conversion fidelity.
"""
from contextlib import contextmanager
from dataclasses import dataclass, field
import hashlib
from pathlib import Path
import re
import stat


@dataclass(frozen=True)
class VerifiedSourceArtifact:
    path: Path
    bytes: int
    sha256: str
    root: Path = field(repr=False)
    relative: str = field(repr=False)


def _reject_link(path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
        raise ValueError('Source-art path must not contain a link or reparse point')
    return info


def _checked_path(root, relative):
    if not isinstance(root, (str, Path)) or not str(root):
        raise ValueError('An explicit absolute source-art root is required')
    root = Path(root)
    if not root.is_absolute() or '..' in root.parts:
        raise ValueError('An explicit absolute source-art root is required')
    # Inspect each root ancestor before resolving it; a junction must never
    # become an implicitly trusted canonical archive through resolve().
    for ancestor in reversed((root, *root.parents)):
        _reject_link(ancestor)
    if not root.is_dir():
        raise ValueError('Source-art root must be a directory')
    if not isinstance(relative, str) or not relative or any(c in relative for c in '\\:\x00'):
        raise ValueError('Source-art path must be a canonical relative POSIX path')
    parts = relative.split('/')
    if any(not part or part in ('.', '..') or part.endswith(('.', ' ')) for part in parts):
        raise ValueError('Source-art path must be a canonical relative POSIX path')
    path = root
    for part in parts:
        path = path / part
        _reject_link(path)
    return root, path


def _fingerprint(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def verify_source_artifact(root, relative, *, expected_sha256, expected_bytes):
    """Require an existing regular source with its exact declared byte identity."""
    if not isinstance(expected_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', expected_sha256):
        raise ValueError('Source-art identity requires a lowercase SHA-256')
    if type(expected_bytes) is not int or expected_bytes <= 0:
        raise ValueError('Source-art identity requires a positive byte length')
    root, path = _checked_path(root, relative)
    before = path.stat()
    if not stat.S_ISREG(before.st_mode):
        raise ValueError('Source-art input must be a regular file')
    if before.st_size != expected_bytes:
        raise ValueError('Source-art byte length differs from the declared identity')
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    _checked_path(root, relative)
    if _fingerprint(before) != _fingerprint(path.stat()):
        raise ValueError('Source-art input changed during its identity check')
    if digest.hexdigest() != expected_sha256:
        raise ValueError('Source-art SHA-256 differs from the declared identity')
    return VerifiedSourceArtifact(path, expected_bytes, expected_sha256, root, relative)


@contextmanager
def verified_source_artifact(root, relative, *, expected_sha256, expected_bytes):
    """Check identity before and after an authoring operation, including failure.

    If both the operation and final check fail, Python retains the original
    operation exception as context. An unchanged source preserves that exception.
    """
    artifact = verify_source_artifact(root, relative, expected_sha256=expected_sha256,
                                      expected_bytes=expected_bytes)
    try:
        yield artifact.path
    finally:
        verify_source_artifact(artifact.root, artifact.relative,
                               expected_sha256=artifact.sha256, expected_bytes=artifact.bytes)
