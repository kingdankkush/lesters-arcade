"""Blender-free, fail-closed source binding for native selector turntables."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re

PACKED_MODE = "packed-gameplay-sources"
SELECTOR_ROSTER = (
    ("lit-commando", "lit-commando"), ("lit-valkyrie", "lit-valkyrie"),
    ("lester", "lester-original"), ("lilly", "lilly"),
)
SELECTOR_DIRECTIONS = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"]
SELECTOR_CAPSULES = frozenset(f".tmp/team/{name}" for name in ("selector", "selector-candidate", "selector-correction"))
SOURCE_LANE = "apps/hmh-reboot/assets/source"
AUTHORITY_CONTRACT = {"classification": "production-art", "runtimeAuthority": "projection-only", "gameplayAuthority": "none"}

# Independently pinned production controls: never read the candidate manifest as
# the authority for its own calibration, provenance mode, or acceptance budgets.
CANONICAL_RENDER_MANIFEST = "apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json"
CANONICAL_SELECTOR_CONTRACT = {
    "schema": "hmh-reboot-hero-selector-render-v1",
    "pipelineId": "hmh-reboot-hero-selector-atlas-v3",
    "scene": {
        "sourceManifest": "apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json",
        "heroExporter": "scripts/hmh-blender/export-hmh-production-hero-pilot.py",
        "exporter": "scripts/hmh-blender/export-hmh-hero-selector.py",
        "runner": "scripts/run-hmh-hero-selector-render.py",
        "blenderVersion": "5.1.2", "readOnly": True, "sourceMode": PACKED_MODE,
    },
    "render": {
        "engine": "BLENDER_EEVEE", "frameSize": [384, 384], "transparentFilm": True,
        "rawOutputDirectory": ".tmp/hmh-reboot-hero-selector", "alphaThreshold": 8,
        "cameraOrthoScale": 2.75, "exposure": -0.45, "cameraPitchDegrees": 55, "compression": 20,
    },
    "pose": {"mode": "native-action", "action": "HMH_Aim", "frameIndex": 0, "frameCount": 1, "loop": False},
    "restDirection": "south", "frameDurationMs": 260,
    "reproducibilityBudget": {"maxChangedVisiblePixels": 8, "maxChannelDelta": 2, "maxTotalChannelDelta": 32},
    "atlas": {
        "perHero": True, "grid": [4, 2],
        "outputDirectory": "apps/portal/assets/generated/hmh-reboot-hero-selector",
        "publicUrlBase": "/assets/generated/hmh-reboot-hero-selector",
        "imageSuffix": "-selector-atlas.png", "metadata": "hmh-reboot-hero-selector-atlas.json",
        "module": "apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs",
        "maxBytesPerAtlas": 524288, "maxTotalBytes": 2097152,
    },
    "groundContact": {
        "contract": "source-root-projection", "pivotTolerancePx": 0.5,
        "footLineEnvelopePx": {"minBelowPivot": 8, "maxBelowPivot": 64},
    },
}


def ground_contact_contract(record: dict) -> dict:
    """Commentary is provenance text, not a numeric/structural grounding control."""
    return {key: value for key, value in record.items() if key != "note"} if isinstance(record, dict) else record


def source_path(root: Path, value: str) -> Path:
    if (not isinstance(value, str) or not value or value == "." or "\\" in value or ":" in value
            or PurePosixPath(value).is_absolute() or ".." in PurePosixPath(value).parts
            or PurePosixPath(value).as_posix() != value
            or any(part.endswith((".", " ")) for part in PurePosixPath(value).parts)
            or any(ord(char) < 32 or char in '<>"|?*' for char in value)):
        raise ValueError(f"Source path must be canonical repo-relative: {value!r}")
    root = root.resolve()
    lexical = root / value
    path = lexical.resolve()
    if not path.is_relative_to(root) or path != lexical:
        raise ValueError(f"Source path symlink/alias escapes canonical lane: {value}")
    return path


def source_input_path(root: Path, value: str, *, model: bool = False) -> Path:
    path = source_path(root, value)
    if model:
        allowed = any(value.startswith(lane + "/") for lane in (
            SOURCE_LANE + "/models", SOURCE_LANE + "/blender", ".tmp/textured-rollout-sources"))
        allowed = allowed and path.suffix.lower() in (".blend", ".glb")
    else:
        allowed = (value.startswith(SOURCE_LANE + "/blender/")
                   or value == ".tmp/hero-delivery-manifest.json"
                   or PurePosixPath(value).parent.as_posix() in SELECTOR_CAPSULES)
        allowed = allowed and path.suffix == ".json"
    if not allowed:
        raise ValueError(f"Source path outside approved {'model' if model else 'manifest'} lane: {value}")
    return path


def validate_selector_roster(manifest: dict) -> None:
    heroes = manifest.get("heroes")
    if (not isinstance(heroes, list) or any(not isinstance(hero, dict) for hero in heroes)
            or tuple((hero.get("portalHeroId"), hero.get("actorId")) for hero in heroes) != SELECTOR_ROSTER):
        raise ValueError("selector roster must contain the four exact ordered portal/actor mappings")


def validate_selector_paths(manifest: dict, root: Path, manifest_path: Path | None = None) -> None:
    """Validate every manifest-controlled file target before any file use/mutation.

    Private writes are an explicit selector capsule, never an arbitrary .tmp
    subtree. The destructive raw child cannot contain configs, models or outputs.
    """
    validate_selector_roster(manifest)
    if manifest.get("directions") != SELECTOR_DIRECTIONS:
        raise ValueError("selector direction path contract must use the eight canonical directions")
    scene, atlas = manifest["scene"], manifest["atlas"]
    for key, expected in {
        "exporter": "scripts/hmh-blender/export-hmh-hero-selector.py",
        "heroExporter": "scripts/hmh-blender/export-hmh-production-hero-pilot.py",
    }.items():
        source_path(root, scene.get(key))
        if scene[key] != expected:
            raise ValueError(f"selector exporter path {key} must be {expected}")
    for key, expected in {
        "runner": "scripts/run-hmh-hero-selector-render.py",
        "sourceBuilder": "scripts/hmh-blender/create-hmh-tripo-selector-scene.py",
    }.items():
        if key in scene:
            source_path(root, scene[key])
            if scene[key] != expected:
                raise ValueError(f"selector script path {key} must be {expected}")
    source_input_path(root, scene.get("sourceManifest"))
    if scene.get("sourceMode") != PACKED_MODE:
        if scene.get("sourceMode") not in ("static-textured-models", "gameplay-pose"):
            raise ValueError("selector source path mode is not approved")
        source_input_path(root, scene.get("sourceBlend"), model=True)
    raw = manifest["render"]["rawOutputDirectory"]
    source_path(root, raw)
    source_path(root, atlas.get("outputDirectory"))
    source_path(root, atlas.get("module"))
    canonical_dir = "apps/portal/assets/generated/hmh-reboot-hero-selector"
    canonical_module = "apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs"
    if raw == ".tmp/hmh-reboot-hero-selector":
        if atlas["outputDirectory"] != canonical_dir or atlas["module"] != canonical_module:
            raise ValueError("selector atlas paths must use the canonical owned output lane")
    else:
        capsule = PurePosixPath(raw).parent.as_posix()
        if capsule not in SELECTOR_CAPSULES or raw != capsule + "/raw":
            raise ValueError("selector raw path must use an explicitly owned capsule/raw lane")
        if (atlas["outputDirectory"] != capsule + "/generated"
                or atlas["module"] not in (capsule + "/module.mjs", capsule + "/selector-atlas.mjs")):
            raise ValueError("selector private output paths must belong to the same capsule")
    for key, expected in {
        "metadata": "hmh-reboot-hero-selector-atlas.json", "imageSuffix": "-selector-atlas.png",
        "publicUrlBase": "/assets/generated/hmh-reboot-hero-selector",
    }.items():
        if atlas.get(key) != expected:
            raise ValueError(f"selector atlas path {key} must be {expected}")
    # Check existing child aliases too, not only their parent output directory.
    source_path(root, atlas["outputDirectory"] + "/" + atlas["metadata"])
    for _, actor in SELECTOR_ROSTER:
        source_path(root, atlas["outputDirectory"] + "/" + actor + atlas["imageSuffix"])
    source_path(root, "scripts/hmh_selector_native_sources.py")
    canonical_path = source_path(root, CANONICAL_RENDER_MANIFEST)
    canonical_outputs = raw == ".tmp/hmh-reboot-hero-selector"
    if manifest_path is not None:
        if canonical_outputs and manifest_path != canonical_path:
            raise ValueError("canonical selector output paths require the exact canonical render manifest location")
        if not canonical_outputs and manifest_path.parent != source_path(root, capsule):
            raise ValueError("selector manifest path and private output paths must belong to the same capsule")
    if canonical_outputs or manifest_path == canonical_path:
        for key, expected in CANONICAL_SELECTOR_CONTRACT.items():
            actual = manifest.get(key)
            if key == "groundContact":
                actual = ground_contact_contract(actual)
            # JSON comparison also rejects bool/int aliases (True == 1 in Python).
            if json.dumps(actual, sort_keys=True) != json.dumps(expected, sort_keys=True):
                raise ValueError(f"canonical selector {key} contract must match the approved production controls")
    if not canonical_outputs:
        validate_private_selector_quality(manifest)


def validate_private_selector_quality(manifest: dict) -> None:
    """Lookdev may recalibrate presentation, never relax resolution or acceptance."""
    for section in ('render', 'atlas', 'reproducibilityBudget'):
        actual = manifest.get(section)
        expected = CANONICAL_SELECTOR_CONTRACT[section]
        if not isinstance(actual, dict) or set(actual) != set(expected):
            raise ValueError(f'private selector {section} contract requires the approved control keys')
    for section, keys in {
        'render': ('engine', 'frameSize', 'transparentFilm', 'alphaThreshold'),
        'atlas': ('perHero', 'grid', 'imageSuffix'),
    }.items():
        for key in keys:
            if json.dumps(manifest[section][key]) != json.dumps(CANONICAL_SELECTOR_CONTRACT[section][key]):
                raise ValueError(f'private selector {section}.{key} contract cannot relax production quality')
    for section, keys, minimum in [
        ('atlas', ('maxBytesPerAtlas', 'maxTotalBytes'), 1),
        ('reproducibilityBudget', tuple(CANONICAL_SELECTOR_CONTRACT['reproducibilityBudget']), 0),
    ]:
        for key in keys:
            value = manifest[section][key]
            if type(value) is not int or not minimum <= value <= CANONICAL_SELECTOR_CONTRACT[section][key]:
                raise ValueError(f'private selector {section}.{key} contract exceeds the approved cap')
    if json.dumps(ground_contact_contract(manifest.get('groundContact')), sort_keys=True) != json.dumps(
            CANONICAL_SELECTOR_CONTRACT['groundContact'], sort_keys=True):
        raise ValueError('private selector groundContact contract must preserve the approved acceptance envelope')
    render = manifest['render']
    for key in ('cameraOrthoScale', 'cameraPitchDegrees', 'exposure'):
        if type(render[key]) not in (int, float) or not math.isfinite(render[key]):
            raise ValueError(f'private selector {key} contract must be finite')
    if (render['cameraOrthoScale'] <= 0 or not 0 < render['cameraPitchDegrees'] < 90
            or type(render['compression']) is not int or not 0 <= render['compression'] <= 100):
        raise ValueError('private selector camera/compression contract is invalid')


def validate_camera_pitch(measured: float, expected: float) -> float:
    # Blender transforms are float32; this is numeric measurement tolerance in
    # degrees, not a visual drift budget or permission to recalibrate a camera.
    if (type(measured) not in (int, float) or type(expected) not in (int, float)
            or not math.isfinite(measured) or not math.isfinite(expected)
            or abs(measured - expected) > 0.0001):
        raise RuntimeError(f"Scene camera pitch {measured!r} != manifest {expected!r}")
    return measured


def selector_cli_path(root: Path, path: Path) -> Path:
    """Accept CLI absolute paths without erasing traversal or resolved aliases."""
    root = root.resolve()
    value = path.relative_to(root).as_posix() if path.is_absolute() else path.as_posix()
    return source_path(root, value)


def validate_selector_export_destinations(manifest: dict, root: Path, manifest_path: Path,
                                          raw_output: Path, report_output: Path,
                                          actor_id: str | None) -> tuple[Path, Path]:
    """Direct Blender CLI uses only the runner's coupled A/B destinations."""
    manifest_path = selector_cli_path(root, manifest_path)
    validate_selector_paths(manifest, root, manifest_path)
    validate_authorities(manifest)
    raw = selector_cli_path(root, raw_output)
    report = selector_cli_path(root, report_output)
    raw_root = source_path(root, manifest['render']['rawOutputDirectory'])
    actors = [hero['actorId'] for hero in manifest['heroes']]
    packed = manifest['scene'].get('sourceMode') == PACKED_MODE
    if (packed and actor_id not in actors) or (not packed and actor_id is not None):
        raise ValueError('selector destination requires the configured packed actor or no legacy actor')
    if raw.parent != raw_root or raw.name not in ('run-a', 'run-b'):
        raise ValueError('selector raw destination must be its configured raw/run-a or raw/run-b lane')
    suffix = '-' + actor_id if packed else ''
    if report != raw_root / (raw.name + '-report' + suffix + '.json'):
        raise ValueError('selector report destination must be coupled to the same raw pass and actor')
    for actor in ([actor_id] if packed else actors):
        for direction in manifest['directions']:
            selector_cli_path(root, raw / f'{actor}__selector__{direction}.png')
    return raw, report


def validate_authorities(record: dict) -> None:
    for key, expected in AUTHORITY_CONTRACT.items():
        if record.get(key) != expected:
            raise ValueError(f"selector {key} must explicitly declare {expected}")


def verify_packed_source(path: Path, digest: str, size: int, require_materialized: bool) -> None:
    if (not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None
            or type(size) is not int or size <= 0):
        raise ValueError(f"Invalid packed source fingerprint: {path}")
    if not path.is_file():
        raise RuntimeError(f"Missing packed source: {path}")
    if path.stat().st_size <= 200:
        pointer = re.fullmatch(
            rb"version https://git-lfs.github.com/spec/v1\noid sha256:([0-9a-f]{64})\nsize ([1-9][0-9]*)\n",
            path.read_bytes().replace(b"\r\n", b"\n"),
        )
        if pointer is not None:
            if pointer[1].decode("ascii") != digest or int(pointer[2]) != size:
                raise RuntimeError(f"Source LFS pointer mismatch: {path}")
            if require_materialized:
                raise RuntimeError(f"Rendering requires materialized packed source, not an LFS pointer: {path}")
            return
    actual = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            actual.update(chunk)
    if path.stat().st_size != size or actual.hexdigest() != digest:
        raise RuntimeError(f"Source bytes mismatch: {path}")


def native_pose(manifest: dict, hero: dict, pilot: dict) -> dict:
    pose = {"action": "HMH_Aim", "frameIndex": 0, "frameCount": 1, "loop": False}
    for configured, expected in ((manifest.get("pose"), dict(pose, mode="native-action")),
                                 (hero.get("nativePose", pose), pose)):
        if (not isinstance(configured, dict) or configured != expected
                or any(type(configured[key]) is not type(value) for key, value in expected.items())):
            raise ValueError(f"{hero['actorId']}: native pose must be exactly HMH_Aim/frameIndex0/frameCount1/loopFalse")
    if pose["action"] not in pilot.get("clipActions", {}).values():
        raise ValueError(f"{hero['actorId']}: native pose must name a gameplay clipActions action")
    return pose


def packed_gameplay_sources(manifest: dict, root: Path, require_materialized: bool = False) -> list[dict]:
    validate_selector_roster(manifest)
    if manifest["scene"].get("sourceMode") != PACKED_MODE or manifest["scene"].get("readOnly") is not True:
        raise ValueError("Packed selector sources require explicit packed-gameplay-sources/readOnly mode")
    inputs = json.loads(source_input_path(root, manifest["scene"]["sourceManifest"]).read_text(encoding="utf-8"))
    pilots = {}
    for pilot in inputs["pilots"]:
        if pilot["actorId"] in pilots:
            raise ValueError(f"Duplicate gameplay pilot: {pilot['actorId']}")
        pilots[pilot["actorId"]] = pilot
    sources, actor_ids, portal_ids, paths = [], set(), set(), set()
    for hero in manifest["heroes"]:
        actor = hero["actorId"]
        if (not isinstance(actor, str) or re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", actor) is None
                or actor in actor_ids or hero["portalHeroId"] in portal_ids or actor not in pilots):
            raise ValueError(f"Missing or duplicate selector pilot: {actor}")
        pilot = pilots[actor]
        source = pilot.get("sourceModel", {})
        path = source_input_path(root, source.get("path"), model=True)
        if (source.get("format") != "blend" or source.get("kind") != "packed-textured-blend"
                or path.suffix.lower() != ".blend" or path in paths
                or type(source.get("externalDependencyCount")) is not int or source["externalDependencyCount"] != 0
                or type(source.get("packedTextureCount")) is not int or source["packedTextureCount"] <= 0):
            raise ValueError(f"{actor}: expected a unique packed textured Blend without external dependencies")
        digest, size = source.get("sourceSha256"), source.get("sourceBytes")
        verify_packed_source(path, digest, size, require_materialized)
        sources.append({"actorId": actor, "path": source["path"], "sha256": digest, "bytes": size,
                        "nativePose": native_pose(manifest, hero, pilot)})
        actor_ids.add(actor)
        portal_ids.add(hero["portalHeroId"])
        paths.add(path)
    if not sources:
        raise ValueError("Packed selector requires heroes")
    return sources
