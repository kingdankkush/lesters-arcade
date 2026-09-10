"""Character-select turntable pipeline (hmh-reboot-hero-selector-atlas-v3).

Renders the four production heroes from the committed hero scene at selector
resolution (Blender 5.1.2, the version pinned by hmh-hero-selector-render.json),
proves two cold renders agree within the hero reproducibility budget, packs one
PNG atlas per hero, and emits the tracked JSON + frozen ESM module the portal
select screen consumes. In packed-gameplay-sources mode each pilot's immutable
packed Blend is opened in its own cold process; provenance lists those exact
sources and native poses rather than a fictional combined scene.

Isolation contract:
- the hero scene (.blend) is opened read-only and never regenerated or saved;
- the shipped 160 px gameplay atlases are not inputs and are never written;
- both the selector lock and the hero-pilot lock are held for the whole run so a
  concurrent hero regeneration cannot swap the scene between the two passes.

`--check` is Blender-free (it runs inside `npm run test:release` on the Vercel
image: CPython 3.12 + Pillow 11.3, no .git) and re-verifies every tracked byte:
per-frame decoded pixel hashes, per-atlas bytes/sha, dimensions, caps, the
module derivation, and the provenance hashes of the committed scene and scripts.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
from pathlib import Path
import shutil
import subprocess
import sys
import time

from PIL import Image

from hmh_pipeline_lock import exclusive_pipeline_lock
from hmh_selector_native_sources import (
    PACKED_MODE, packed_gameplay_sources, source_path, source_input_path,
    validate_selector_paths, validate_authorities, ground_contact_contract, validate_camera_pitch,
)


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json"
BLENDER = Path(r"D:\Apps\Blender\blender.exe")
SELECTOR_LOCK = ROOT / ".tmp" / "hmh-reboot-hero-selector.lock"
HERO_PILOT_LOCK = ROOT / ".tmp" / "hmh-production-hero-pipeline.lock"
DRIFT_REPORT_PATH = ROOT / ".tmp" / "hmh-reboot-hero-selector-drift-report.json"
REPRODUCIBILITY_MODE = "bounded-premultiplied-rgba-v1"
MODULE_KEYS = [
    "schemaVersion",
    "pipelineId",
    "classification",
    "runtimeAuthority",
    "gameplayAuthority",
    "frameSize",
    "frameCount",
    "directions",
    "restDirection",
    "restFrameIndex",
    "heroes",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render or verify the HMH character-select turntable atlases.")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH))
    parser.add_argument("--check", action="store_true", help="Blender-free verification of the tracked outputs")
    return parser.parse_args()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def selector_manifest_path(path: Path) -> Path:
    # The CLI/default may supply an absolute path; manifest-controlled values
    # never may. Do not resolve away traversal or aliases before validating.
    value = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    return source_input_path(ROOT, value)


def load_manifest(path: Path) -> dict:
    path = selector_manifest_path(path)
    manifest = read_json(path)
    validate_selector_paths(manifest, ROOT, path)
    validate_authorities(manifest)
    return manifest


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_checked(command: list[str], label: str) -> str:
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    combined = completed.stdout + completed.stderr
    if completed.returncode != 0 or "Traceback (most recent call last)" in combined:
        raise RuntimeError(f"{label} failed ({completed.returncode})\n{combined[-12000:]}")
    return combined


def blender_version() -> str:
    completed = subprocess.run([str(BLENDER), "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if completed.returncode != 0:
        raise RuntimeError(completed.stdout + completed.stderr)
    return completed.stdout.splitlines()[0].replace("Blender ", "").strip()


def canonical_rgba(image: Image.Image) -> Image.Image:
    """Straight RGBA with fully transparent pixels zeroed, so hashes ignore hidden colour."""
    image = image.convert("RGBA")
    data = bytearray(image.tobytes())
    for index in range(0, len(data), 4):
        if data[index + 3] == 0:
            data[index] = 0
            data[index + 1] = 0
            data[index + 2] = 0
    return Image.frombytes("RGBA", image.size, bytes(data))


def alpha_bounds(image: Image.Image, threshold: int) -> dict | None:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        return None
    return {"x": bbox[0], "y": bbox[1], "w": bbox[2] - bbox[0], "h": bbox[3] - bbox[1]}


def opaque_pixel_count(image: Image.Image) -> int:
    alpha = image.getchannel("A")
    return sum(1 for value in alpha.tobytes() if value > 0)


def frame_record(image: Image.Image, threshold: int) -> dict:
    bounds = alpha_bounds(image, threshold)
    if bounds is None:
        raise RuntimeError("blank selector frame")
    return {
        "opaquePixels": opaque_pixel_count(image),
        "alphaBounds": bounds,
        "footLineY": bounds["y"] + bounds["h"],
        "pixelSha256": sha256_bytes(image.tobytes()),
    }


def compare_premultiplied(image_a: Image.Image, image_b: Image.Image) -> dict:
    """Per-frame premultiplied RGBA drift: changed pixels, max channel delta, total delta, histogram."""
    changed = 0
    max_delta = 0
    total_delta = 0
    histogram: dict[int, int] = {}
    for pixel_a, pixel_b in zip(image_a.convert("RGBA").getdata(), image_b.convert("RGBA").getdata()):
        premul_a = tuple(round(channel * pixel_a[3] / 255) for channel in pixel_a[:3]) + (pixel_a[3],)
        premul_b = tuple(round(channel * pixel_b[3] / 255) for channel in pixel_b[:3]) + (pixel_b[3],)
        deltas = [abs(left - right) for left, right in zip(premul_a, premul_b)]
        if any(deltas):
            changed += 1
            worst = max(deltas)
            max_delta = max(max_delta, worst)
            total_delta += sum(deltas)
            histogram[worst] = histogram.get(worst, 0) + 1
    return {"changed": changed, "maxDelta": max_delta, "totalDelta": total_delta, "histogram": histogram}


def module_bytes(metadata: dict) -> bytes:
    module_json = json.dumps({key: metadata[key] for key in MODULE_KEYS}, separators=(",", ":"))
    return (
        "function freezeDeep(value) {\n"
        "  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;\n"
        "  for (const child of Object.values(value)) freezeDeep(child);\n"
        "  return Object.freeze(value);\n"
        "}\n\n"
        f"export const HMH_REBOOT_HERO_SELECTOR_ATLAS = freezeDeep({module_json});\n"
    ).encode("utf-8")


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def frame_filename(actor_id: str, direction: str) -> str:
    return f"{actor_id}__selector__{direction}.png"


def output_paths(manifest: dict) -> dict:
    validate_selector_paths(manifest, ROOT)
    output_dir = source_path(ROOT, manifest["atlas"]["outputDirectory"])
    canonical_dir = "apps/portal/assets/generated/hmh-reboot-hero-selector"
    url_base = (manifest["atlas"]["publicUrlBase"]
                if manifest["atlas"]["outputDirectory"] == canonical_dir
                else "/" + manifest["atlas"]["outputDirectory"])
    return {
        "dir": output_dir,
        "metadata": output_dir / manifest["atlas"]["metadata"],
        "module": source_path(ROOT, manifest["atlas"]["module"]),
        "image": lambda actor_id: output_dir / f"{actor_id}{manifest['atlas']['imageSuffix']}",
        # Private evidence modules must resolve to their coupled capsule images,
        # never to the canonical portal assets named by the production contract.
        "url": lambda actor_id: f"{url_base}/{actor_id}{manifest['atlas']['imageSuffix']}",
    }


def grid_cell(manifest: dict, index: int) -> tuple[int, int]:
    columns, rows = manifest["atlas"]["grid"]
    if index >= columns * rows:
        raise RuntimeError(f"Selector grid {columns}x{rows} cannot hold frame {index}")
    size = manifest["render"]["frameSize"][0]
    return (index % columns) * size, (index // columns) * size


def verified_source_sha(path: Path, expected: dict | None = None) -> str:
    """Verify real bytes or a canonical LFS pointer bound to the source ledger."""
    if expected is None:
        return sha256_file(path)
    digest, size = expected.get("sha256"), expected.get("bytes")
    if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None or type(size) is not int or size <= 0:
        raise ValueError(f"Invalid source descriptor for {path}")
    if path.stat().st_size <= 200:
        pointer = re.fullmatch(
            rb"version https://git-lfs.github.com/spec/v1\noid sha256:([0-9a-f]{64})\nsize ([1-9][0-9]*)\n",
            path.read_bytes().replace(b"\r\n", b"\n"),
        )
        if pointer is not None:
            if pointer[1].decode("ascii") == digest and int(pointer[2]) == size:
                return digest
            raise RuntimeError(f"Source LFS pointer mismatch: {path}")
    if path.stat().st_size != size or sha256_file(path) != digest:
        raise RuntimeError(f"Source bytes mismatch: {path}")
    return digest


def provenance(manifest: dict, manifest_path: Path) -> dict:
    manifest_path = selector_manifest_path(manifest_path)
    validate_selector_paths(manifest, ROOT, manifest_path)
    result = {
        "sourceManifest": manifest["scene"]["sourceManifest"],
        "sourceManifestSha256": sha256_file(ROOT / manifest["scene"]["sourceManifest"]),
        "renderManifest": manifest_path.relative_to(ROOT).as_posix(),
        "renderManifestSha256": sha256_file(manifest_path),
        "runner": "scripts/run-hmh-hero-selector-render.py",
        "runnerSha256": sha256_file(source_path(ROOT, "scripts/run-hmh-hero-selector-render.py")),
        "exporter": manifest["scene"]["exporter"],
        "exporterSha256": sha256_file(ROOT / manifest["scene"]["exporter"]),
        "heroExporter": manifest["scene"]["heroExporter"],
        "heroExporterSha256": sha256_file(ROOT / manifest["scene"]["heroExporter"]),
    }
    if manifest["scene"].get("sourceMode") == PACKED_MODE:
        result["sourceMode"] = PACKED_MODE
        result["sourceAssets"] = packed_gameplay_sources(manifest, ROOT)
        result["sourceHelper"] = "scripts/hmh_selector_native_sources.py"
        result["sourceHelperSha256"] = sha256_file(ROOT / result["sourceHelper"])
        return result
    result["sourceBlend"] = manifest["scene"]["sourceBlend"]
    result["sourceBlendSha256"] = verified_source_sha(ROOT / result["sourceBlend"], manifest["scene"].get("sourceBlendFingerprint"))
    if manifest["scene"].get("sourceMode") == "static-textured-models":
        inputs = read_json(ROOT / manifest["scene"]["sourceManifest"])
        result["sourceMode"] = "static-textured-models"
        result["sourceBuilder"] = manifest["scene"]["sourceBuilder"]
        result["sourceBuilderSha256"] = sha256_file(ROOT / result["sourceBuilder"])
        result["sourceAssets"] = [{
            "actorId": hero["actorId"], "path": hero["sourcePath"], "bytes": hero["sourceBytes"],
            "sha256": verified_source_sha(source_input_path(ROOT, hero["sourcePath"], model=True), {"sha256": hero["sourceSha256"], "bytes": hero["sourceBytes"]}),
        } for hero in inputs["heroes"]]
    return result


def source_provenance_drift(actual: dict, expected: dict) -> list[str]:
    # Reject legacy combined-scene claims as well as missing/reordered native sources.
    return sorted(key for key in actual.keys() | expected.keys()
                  if key not in actual or key not in expected or actual[key] != expected[key])


def selector_render_jobs(manifest: dict, manifest_path: Path, raw_output: Path, report_output: Path) -> list[dict]:
    manifest_path = selector_manifest_path(manifest_path)
    validate_selector_paths(manifest, ROOT, manifest_path)
    packed = manifest["scene"].get("sourceMode") == PACKED_MODE
    sources = packed_gameplay_sources(manifest, ROOT, require_materialized=True) if packed else [None]
    jobs = []
    for index, source in enumerate(sources):
        hero = manifest["heroes"][index] if packed else None
        blend = ROOT / (source["path"] if packed else manifest["scene"]["sourceBlend"])
        report = report_output.with_name(f"{report_output.stem}-{source['actorId']}.json") if packed else report_output
        command = [
            str(BLENDER), "--background", "--factory-startup", "--disable-autoexec", str(blend),
            "--python-exit-code", "1", "--python", str(ROOT / manifest["scene"]["exporter"]), "--",
            "--manifest", str(manifest_path), "--repo-root", str(ROOT),
            "--raw-output", str(raw_output), "--report-output", str(report),
        ]
        if packed:
            command.extend(["--actor-id", source["actorId"]])
        jobs.append({"command": command, "report": report, "hero": hero, "source": source, "blend": blend})
    return jobs


def render_pass(manifest: dict, manifest_path: Path, source_blend: Path, raw_output: Path, report_output: Path, label: str) -> dict:
    started = time.perf_counter()
    reports = []
    for job in selector_render_jobs(manifest, manifest_path, raw_output, report_output):
        run_checked(job["command"], label)
        report = read_json(job["report"])
        validate_camera_pitch(report.get("cameraPitchDegrees"), manifest["render"]["cameraPitchDegrees"])
        heroes = [job["hero"]] if job["hero"] else manifest["heroes"]
        frames = [frame_filename(hero["actorId"], direction) for hero in heroes for direction in manifest["directions"]]
        if (report.get("status") != "pass" or report.get("frameCount") != len(frames) or report.get("saved") is not False
                or report.get("frameSize") != list(manifest["render"]["frameSize"])
                or report.get("frames") != frames or set(report.get("pivotPixels", {})) != set(frames)
                or report.get("engine") != manifest["render"]["engine"]):
            raise RuntimeError(f"{label}: exporter report invalid: {report}")
        if job["source"] and (report.get("sourceAssets") != [job["source"]]
                or Path(report.get("sourceBlend", "")).resolve() != job["blend"].resolve()
                or set(report.get("heroes", {})) != {job["hero"]["portalHeroId"]}):
            raise RuntimeError(f"{label}: native source report mismatch: {report}")
        reports.append(report)
    report = dict(reports[0])
    if manifest["scene"].get("sourceMode") == PACKED_MODE:
        report.pop("sourceBlend", None)
        report["sourceAssets"] = [source for item in reports for source in item["sourceAssets"]]
        report["frames"] = [frame for item in reports for frame in item["frames"]]
        report["frameCount"] = len(report["frames"])
        report["pivotPixels"] = {key: value for item in reports for key, value in item["pivotPixels"].items()}
        report["heroes"] = {key: value for item in reports for key, value in item["heroes"].items()}
    report["wallSeconds"] = round(time.perf_counter() - started, 3)
    return report


def load_pass(manifest: dict, raw_output: Path) -> dict[str, Image.Image]:
    frame_size = tuple(manifest["render"]["frameSize"])
    threshold = manifest["render"]["alphaThreshold"]
    frames = {}
    for hero in manifest["heroes"]:
        for direction in manifest["directions"]:
            filename = frame_filename(hero["actorId"], direction)
            image = canonical_rgba(Image.open(raw_output / filename))
            if image.size != frame_size:
                raise RuntimeError(f"{filename}: rendered {image.size}, expected {frame_size}")
            corners = [image.getpixel((0, 0))[3], image.getpixel((frame_size[0] - 1, 0))[3], image.getpixel((0, frame_size[1] - 1))[3], image.getpixel((frame_size[0] - 1, frame_size[1] - 1))[3]]
            if max(corners) > threshold:
                raise RuntimeError(f"{filename}: hero touches the frame corner (alpha {corners})")
            frames[filename] = image
    return frames


def drift_report_path(manifest: dict) -> Path:
    validate_selector_paths(manifest, ROOT)
    raw = source_path(ROOT, manifest["render"]["rawOutputDirectory"])
    directory = raw.parent
    return source_path(ROOT, (directory / DRIFT_REPORT_PATH.name).relative_to(ROOT).as_posix())


def verify_two_passes(manifest: dict, pass_a: dict[str, Image.Image], pass_b: dict[str, Image.Image], reports: list[dict], blender: str) -> dict:
    report_path = drift_report_path(manifest)
    budget = manifest["reproducibilityBudget"]
    per_frame = {}
    observed = {"maxChangedVisiblePixels": 0, "maxChannelDelta": 0, "maxTotalChannelDelta": 0}
    histogram: dict[str, int] = {}
    worst = None
    for filename, image_a in pass_a.items():
        result = compare_premultiplied(image_a, pass_b[filename])
        if result["changed"]:
            per_frame[filename] = {"changed": result["changed"], "maxDelta": result["maxDelta"], "totalDelta": result["totalDelta"]}
            for delta, count in result["histogram"].items():
                histogram[str(delta)] = histogram.get(str(delta), 0) + count
        candidate = (result["changed"], result["maxDelta"], result["totalDelta"])
        if worst is None or candidate > worst[0]:
            worst = (candidate, filename)
        observed["maxChangedVisiblePixels"] = max(observed["maxChangedVisiblePixels"], result["changed"])
        observed["maxChannelDelta"] = max(observed["maxChannelDelta"], result["maxDelta"])
        observed["maxTotalChannelDelta"] = max(observed["maxTotalChannelDelta"], result["totalDelta"])
    observed["driftedFrameCount"] = len(per_frame)
    observed["worstFrameId"] = worst[1] if worst and worst[0][0] else None
    exceeded = [key for key in budget if observed[key] > budget[key]]
    drift_report = {
        "schema": "hmh-reboot-hero-selector-drift-report-v1",
        "pipelineId": manifest["pipelineId"],
        "reproducibilityMode": REPRODUCIBILITY_MODE,
        "blenderVersion": blender,
        "status": "fail" if exceeded else "pass",
        "budget": budget,
        "observed": observed,
        "exceeded": exceeded,
        "frameCount": len(pass_a),
        "driftedFrames": dict(sorted(per_frame.items())),
        "premultipliedDeltaHistogram": dict(sorted(histogram.items(), key=lambda item: int(item[0]))),
        "passes": [{"label": "run-a", "wallSeconds": reports[0]["wallSeconds"]}, {"label": "run-b", "wallSeconds": reports[1]["wallSeconds"]}],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(drift_report, indent=2) + "\n", encoding="utf-8", newline="\n")
    if exceeded:
        raise RuntimeError(
            f"Selector render is not reproducible within budget ({exceeded}): observed={observed} budget={budget}; "
            f"drift report at {report_path.relative_to(ROOT).as_posix()}"
        )
    return observed


def resolve_pivot(manifest: dict, reports: list[dict]) -> list[int]:
    """One pixel pivot for all 32 frames of both passes, or the fixed-camera contract is broken."""
    tolerance = manifest["groundContact"]["pivotTolerancePx"]
    projected = [tuple(value) for report in reports for value in report["pivotPixels"].values()]
    if len(projected) != 2 * len(manifest["heroes"]) * len(manifest["directions"]):
        raise RuntimeError(f"Exporter recorded {len(projected)} pivots, expected one per frame per pass")
    reference = projected[0]
    for candidate in projected:
        if max(abs(candidate[axis] - reference[axis]) for axis in (0, 1)) > tolerance:
            raise RuntimeError(f"Ground-contact pivot moved between frames: {reference} vs {candidate}")
    # The camera aims at the rig column, so the pivot must sit on the frame's centre column.
    if abs(reference[0] - manifest["render"]["frameSize"][0] / 2) > tolerance:
        raise RuntimeError(f"Projected pivot {reference} is off the frame centre column")
    return [round(reference[0]), round(reference[1])]


def build_outputs(manifest: dict, manifest_path: Path, frames: dict[str, Image.Image], observed: dict, blender: str, reports: list[dict]) -> tuple[dict, dict[str, bytes]]:
    paths = output_paths(manifest)
    threshold = manifest["render"]["alphaThreshold"]
    size = manifest["render"]["frameSize"][0]
    columns, rows = manifest["atlas"]["grid"]
    atlas_size = {"width": columns * size, "height": rows * size}
    heroes = {}
    records = []
    images: dict[str, bytes] = {}
    per_atlas_bytes = {}
    foot_line_spread = {}
    pivot = resolve_pivot(manifest, reports)
    envelope = manifest["groundContact"]["footLineEnvelopePx"]
    for hero in manifest["heroes"]:
        atlas = Image.new("RGBA", (atlas_size["width"], atlas_size["height"]), (0, 0, 0, 0))
        frame_refs = []
        foot_lines = []
        url = paths["url"](hero["actorId"])
        for index, direction in enumerate(manifest["directions"]):
            image = frames[frame_filename(hero["actorId"], direction)]
            record = frame_record(image, threshold)
            x, y = grid_cell(manifest, index)
            atlas.alpha_composite(image, (x, y))
            frame_refs.append(f"{url}#frame={x},{y},{size},{size},{atlas_size['width']},{atlas_size['height']}")
            foot_lines.append(record["footLineY"])
            records.append({
                "portalHeroId": hero["portalHeroId"],
                "actorId": hero["actorId"],
                "direction": direction,
                "frame": {"x": x, "y": y, "w": size, "h": size},
                **record,
            })
        # The alpha-bbox bottom is the shadow ellipse's front edge, which turns
        # with the hero; it is recorded as information. The jitter contract is
        # the pivot: every foot line must sit inside the ground-contact envelope.
        foot_line_spread[hero["portalHeroId"]] = max(foot_lines) - min(foot_lines)
        for direction, foot_line in zip(manifest["directions"], foot_lines):
            if foot_line < pivot[1] + envelope["minBelowPivot"] or foot_line > pivot[1] + envelope["maxBelowPivot"]:
                raise RuntimeError(f"{hero['actorId']}/{direction}: foot line {foot_line} outside the ground-contact envelope around pivot row {pivot[1]} ({envelope})")
        data = png_bytes(atlas)
        if len(data) > manifest["atlas"]["maxBytesPerAtlas"]:
            raise RuntimeError(f"{hero['actorId']}: selector atlas {len(data)} bytes exceeds maxBytesPerAtlas {manifest['atlas']['maxBytesPerAtlas']}")
        images[hero["actorId"]] = data
        per_atlas_bytes[hero["portalHeroId"]] = len(data)
        heroes[hero["portalHeroId"]] = {
            "actorId": hero["actorId"],
            "image": url,
            "imageBytes": len(data),
            "imageSha256": sha256_bytes(data),
            "atlasSize": atlas_size,
            "frames": frame_refs,
            "frameDurationMs": manifest["frameDurationMs"],
        }
    total_bytes = sum(per_atlas_bytes.values())
    if total_bytes > manifest["atlas"]["maxTotalBytes"]:
        raise RuntimeError(f"Selector payload {total_bytes} bytes exceeds maxTotalBytes {manifest['atlas']['maxTotalBytes']}")

    metadata = {
        "schemaVersion": 3,
        "pipelineId": manifest["pipelineId"],
        "classification": manifest["classification"],
        "runtimeAuthority": manifest["runtimeAuthority"],
        "gameplayAuthority": manifest["gameplayAuthority"],
        "frameSize": size,
        "frameCount": len(records),
        "directions": list(manifest["directions"]),
        "restDirection": manifest["restDirection"],
        "restFrameIndex": manifest["directions"].index(manifest["restDirection"]),
        "heroes": heroes,
        "render": {
            "engine": reports[0]["engine"],
            "frameSize": list(manifest["render"]["frameSize"]),
            "cameraOrthoScale": manifest["render"]["cameraOrthoScale"],
            "exposure": manifest["render"]["exposure"],
            "cameraPitchDegrees": reports[0]["cameraPitchDegrees"],
            "alphaThreshold": threshold,
            "compression": manifest["render"]["compression"],
            "blenderVersion": blender,
            "pivotPixels": pivot,
            "projectedPivot": [round(value, 3) for value in reports[0]["pivotPixels"][frame_filename(manifest["heroes"][0]["actorId"], manifest["directions"][0])]],
        },
        "groundContact": manifest["groundContact"],
        "pose": manifest["pose"],
        "frames": records,
        "sources": provenance(manifest, manifest_path),
        "metrics": {
            "status": "pass",
            "renderPasses": 2,
            "reproducibility": "pass",
            "reproducibilityMode": REPRODUCIBILITY_MODE,
            "reproducibilityBudget": manifest["reproducibilityBudget"],
            "reproducibilityObserved": observed,
            "perAtlasBytes": per_atlas_bytes,
            "totalImageBytes": total_bytes,
            "maxBytesPerAtlas": manifest["atlas"]["maxBytesPerAtlas"],
            "maxTotalBytes": manifest["atlas"]["maxTotalBytes"],
            "footLineSpreadPx": foot_line_spread,
        },
    }
    return metadata, images


def render(manifest_path: Path) -> None:
    manifest_path = selector_manifest_path(manifest_path)
    manifest = load_manifest(manifest_path)
    sources_before = provenance(manifest, manifest_path)
    if not BLENDER.exists():
        raise RuntimeError(f"Blender not found: {BLENDER}")
    if manifest["scene"].get("readOnly") is not True:
        raise RuntimeError("Selector manifest must declare the hero scene read-only")
    required = manifest["scene"]["blenderVersion"]
    actual = blender_version()
    if actual != required:
        raise RuntimeError(f"Blender version mismatch: expected {required}, got {actual}")
    packed = manifest["scene"].get("sourceMode") == PACKED_MODE
    source_blend = None if packed else ROOT / manifest["scene"]["sourceBlend"]
    source_paths = ([ROOT / source["path"] for source in packed_gameplay_sources(manifest, ROOT, require_materialized=True)]
                    if packed else [source_blend])
    source_hashes = {path: sha256_file(path) for path in source_paths}
    temp_root = source_path(ROOT, manifest["render"]["rawOutputDirectory"])
    if any(path.resolve().is_relative_to(temp_root.resolve()) for path in source_paths):
        raise RuntimeError("Raw output directory must not contain immutable selector sources")
    shutil.rmtree(temp_root, ignore_errors=True)
    run_a = temp_root / "run-a"
    run_b = temp_root / "run-b"
    reports = [
        render_pass(manifest, manifest_path, source_blend, run_a, temp_root / "run-a-report.json", "selector render run A"),
        render_pass(manifest, manifest_path, source_blend, run_b, temp_root / "run-b-report.json", "selector render run B"),
    ]
    if any(sha256_file(path) != digest for path, digest in source_hashes.items()):
        raise RuntimeError("A committed hero source changed during the selector render; the exporter must never save it")
    if provenance(manifest, manifest_path) != sources_before:
        raise RuntimeError("Selector source/config provenance changed during rendering")
    pass_a = load_pass(manifest, run_a)
    pass_b = load_pass(manifest, run_b)
    observed = verify_two_passes(manifest, pass_a, pass_b, reports, actual)
    # Bless pass A: the shipped pixels are a deterministic choice, not whichever pass finished last.
    metadata, images = build_outputs(manifest, manifest_path, pass_a, observed, actual, reports)
    paths = output_paths(manifest)
    paths["dir"].mkdir(parents=True, exist_ok=True)
    for actor_id, data in images.items():
        paths["image"](actor_id).write_bytes(data)
    paths["metadata"].write_bytes((json.dumps(metadata, indent=2) + "\n").encode("utf-8"))
    paths["module"].parent.mkdir(parents=True, exist_ok=True)
    paths["module"].write_bytes(module_bytes(metadata))
    print(json.dumps({
        "status": "BUILT",
        "pipelineId": manifest["pipelineId"],
        "blenderVersion": actual,
        "frames": metadata["frameCount"],
        "perAtlasBytes": metadata["metrics"]["perAtlasBytes"],
        "totalImageBytes": metadata["metrics"]["totalImageBytes"],
        "reproducibilityObserved": observed,
        "passWallSeconds": [report["wallSeconds"] for report in reports],
        "driftReport": drift_report_path(manifest).relative_to(ROOT).as_posix(),
    }, indent=2))


def check(manifest_path: Path) -> None:
    manifest_path = selector_manifest_path(manifest_path)
    manifest = load_manifest(manifest_path)
    paths = output_paths(manifest)
    drift: list[str] = []

    def rel(path: Path) -> str:
        return path.relative_to(ROOT).as_posix()

    if not paths["metadata"].exists():
        raise SystemExit(f"selector atlas drift: missing {rel(paths['metadata'])}")
    metadata = read_json(paths["metadata"])
    # Independent production contract, not merely a matching mutable module.
    validate_authorities(metadata)
    for key in ("classification", "runtimeAuthority", "gameplayAuthority"):
        if metadata[key] != manifest[key]:
            drift.append(f"{rel(paths['metadata'])}: {key}")
    if metadata.get("pipelineId") != manifest["pipelineId"] or metadata.get("schemaVersion") != 3:
        drift.append(f"{rel(paths['metadata'])}: pipeline identity")
    if metadata.get("directions") != manifest["directions"] or metadata.get("restDirection") != manifest["restDirection"]:
        drift.append(f"{rel(paths['metadata'])}: directions")
    if metadata.get("restFrameIndex") != manifest["directions"].index(manifest["restDirection"]):
        drift.append(f"{rel(paths['metadata'])}: restFrameIndex")
    size = manifest["render"]["frameSize"][0]
    if metadata.get("frameSize") != size or metadata.get("pose") != manifest["pose"]:
        drift.append(f"{rel(paths['metadata'])}: frame contract")
    render_record = metadata.get("render", {})
    expected_render = {
        "engine": manifest["render"]["engine"],
        "frameSize": manifest["render"]["frameSize"],
        "cameraOrthoScale": manifest["render"]["cameraOrthoScale"],
        "exposure": manifest["render"]["exposure"],
        "alphaThreshold": manifest["render"]["alphaThreshold"],
        "compression": manifest["render"]["compression"],
        "blenderVersion": manifest["scene"]["blenderVersion"],
    }
    for key, expected in expected_render.items():
        if json.dumps(render_record.get(key)) != json.dumps(expected):
            drift.append(f"{rel(paths['metadata'])}: render.{key}")
    try:
        validate_camera_pitch(render_record.get("cameraPitchDegrees"), manifest["render"]["cameraPitchDegrees"])
    except (TypeError, RuntimeError):
        drift.append(f"{rel(paths['metadata'])}: render.cameraPitchDegrees")
    pivot = render_record.get("pivotPixels")
    if (
        ground_contact_contract(metadata.get("groundContact")) != ground_contact_contract(manifest["groundContact"])
        or not (isinstance(pivot, list) and len(pivot) == 2 and all(isinstance(value, int) for value in pivot))
        or abs(pivot[0] - size / 2) > manifest["groundContact"]["pivotTolerancePx"]
        or not 0 < pivot[1] < size
    ):
        drift.append(f"{rel(paths['metadata'])}: ground-contact pivot")
        pivot = [size // 2, size // 2]
    envelope = manifest["groundContact"]["footLineEnvelopePx"]
    expected_hero_ids = [hero["portalHeroId"] for hero in manifest["heroes"]]
    if list(metadata.get("heroes", {}).keys()) != expected_hero_ids:
        drift.append(f"{rel(paths['metadata'])}: hero set")
    if metadata.get("frameCount") != len(expected_hero_ids) * len(manifest["directions"]) or len(metadata.get("frames", [])) != metadata.get("frameCount"):
        drift.append(f"{rel(paths['metadata'])}: frameCount")

    expected_sources = provenance(manifest, manifest_path)
    for key in source_provenance_drift(metadata.get("sources", {}), expected_sources):
        drift.append(f"{rel(paths['metadata'])}: sources.{key}")

    metrics = metadata.get("metrics", {})
    if metrics.get("status") != "pass" or metrics.get("reproducibility") != "pass" or metrics.get("reproducibilityMode") != REPRODUCIBILITY_MODE:
        drift.append(f"{rel(paths['metadata'])}: metrics status")
    budget = manifest["reproducibilityBudget"]
    observed = metrics.get("reproducibilityObserved", {})
    if metrics.get("reproducibilityBudget") != budget or any(observed.get(key, budget[key] + 1) > budget[key] for key in budget):
        drift.append(f"{rel(paths['metadata'])}: reproducibility budget")

    threshold = manifest["render"]["alphaThreshold"]
    total_bytes = 0
    frames_by_hero: dict[str, list[dict]] = {}
    for record in metadata.get("frames", []):
        if not isinstance(record, dict):
            drift.append(f"{rel(paths['metadata'])}: frame record")
            continue
        frames_by_hero.setdefault(record.get("portalHeroId"), []).append(record)
    for hero in manifest["heroes"]:
        hero_id = hero["portalHeroId"]
        entry = metadata["heroes"].get(hero_id, {})
        image_path = paths["image"](hero["actorId"])
        if entry.get("actorId") != hero["actorId"] or entry.get("image") != paths["url"](hero["actorId"]):
            drift.append(f"{rel(paths['metadata'])}: heroes.{hero_id} identity")
        if entry.get("frameDurationMs") != manifest["frameDurationMs"]:
            drift.append(f"{rel(paths['metadata'])}: heroes.{hero_id} frameDurationMs")
        if not image_path.exists():
            drift.append(f"missing {rel(image_path)}")
            continue
        data = image_path.read_bytes()
        total_bytes += len(data)
        if entry.get("imageBytes") != len(data) or entry.get("imageSha256") != sha256_bytes(data):
            drift.append(f"{rel(image_path)}: imageBytes/imageSha256")
        if metrics.get("perAtlasBytes", {}).get(hero_id) != len(data):
            drift.append(f"{rel(paths['metadata'])}: metrics.perAtlasBytes.{hero_id}")
        if len(data) > manifest["atlas"]["maxBytesPerAtlas"]:
            drift.append(f"{rel(image_path)}: exceeds maxBytesPerAtlas")
        try:
            encoded = Image.open(io.BytesIO(data))
            if encoded.format != 'PNG':
                drift.append(f"{rel(image_path)}: selector format must be PNG")
            columns, rows = manifest['atlas']['grid']
            if encoded.size != (columns * size, rows * size):
                drift.append(f"{rel(image_path)}: selector atlas dimensions must match the approved grid")
                continue
            atlas = canonical_rgba(encoded)
        except Exception:
            drift.append(f"{rel(image_path)}: undecodable")
            continue
        if {"width": atlas.width, "height": atlas.height} != entry.get("atlasSize"):
            drift.append(f"{rel(image_path)}: atlasSize")
        hero_frames = frames_by_hero.get(hero_id, [])
        if len(hero_frames) != len(manifest["directions"]) or len(entry.get("frames", [])) != len(manifest["directions"]):
            drift.append(f"{rel(paths['metadata'])}: heroes.{hero_id} frame count")
            continue
        for index, (direction, record, ref) in enumerate(zip(manifest["directions"], hero_frames, entry["frames"])):
            x, y = grid_cell(manifest, index)
            expected_ref = f"{entry['image']}#frame={x},{y},{size},{size},{atlas.width},{atlas.height}"
            if record.get("portalHeroId") != hero_id or record.get("actorId") != hero["actorId"]:
                drift.append(f"{rel(paths['metadata'])}: heroes.{hero_id} frame {direction} ownership")
                continue
            if ref != expected_ref or record.get("direction") != direction or record.get("frame") != {"x": x, "y": y, "w": size, "h": size}:
                drift.append(f"{rel(paths['metadata'])}: heroes.{hero_id} frame {direction} placement")
                continue
            crop = atlas.crop((x, y, x + size, y + size))
            actual = frame_record(crop, threshold) if alpha_bounds(crop, threshold) else None
            if actual is None or actual["pixelSha256"] != record.get("pixelSha256"):
                drift.append(f"{rel(image_path)}: {hero_id}/{direction} pixelSha256")
            elif actual["opaquePixels"] != record.get("opaquePixels") or actual["alphaBounds"] != record.get("alphaBounds") or actual["footLineY"] != record.get("footLineY"):
                drift.append(f"{rel(paths['metadata'])}: {hero_id}/{direction} frame analysis")
            elif actual["footLineY"] < pivot[1] + envelope["minBelowPivot"] or actual["footLineY"] > pivot[1] + envelope["maxBelowPivot"]:
                drift.append(f"{rel(paths['metadata'])}: {hero_id}/{direction} foot line outside the ground-contact envelope")
    if metrics.get("totalImageBytes") != total_bytes:
        drift.append(f"{rel(paths['metadata'])}: metrics.totalImageBytes")
    if total_bytes > manifest["atlas"]["maxTotalBytes"]:
        drift.append("selector payload exceeds maxTotalBytes")

    if not paths["module"].exists() or paths["module"].read_bytes() != module_bytes(metadata):
        drift.append(rel(paths["module"]))

    drift = list(dict.fromkeys(drift))
    if drift:
        raise SystemExit("selector atlas drift: " + "; ".join(drift))
    print(json.dumps({
        "status": "PASS",
        "pipelineId": manifest["pipelineId"],
        "blender": False,
        "heroes": len(expected_hero_ids),
        "frames": metadata["frameCount"],
        "totalImageBytes": total_bytes,
    }, indent=2))


def main() -> None:
    args = parse_args()
    manifest_path = selector_manifest_path(Path(args.manifest))
    # Reject unsafe manifests before either pipeline lock can mutate the FS.
    load_manifest(manifest_path)
    if args.check:
        check(manifest_path)
        return
    with exclusive_pipeline_lock(SELECTOR_LOCK, "HMH hero selector render"):
        with exclusive_pipeline_lock(HERO_PILOT_LOCK, "HMH production hero pipeline"):
            render(manifest_path)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"HMH hero selector render failed: {error}", file=sys.stderr)
        raise
