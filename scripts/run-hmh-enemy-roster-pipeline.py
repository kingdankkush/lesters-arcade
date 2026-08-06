"""Deterministic Blender -> atlas pipeline for the HMH enemy/boss roster.

Mirrors the certified production-hero pipeline: build the scene, render every
required visual state across eight directions, then trim and shelf-pack one
atlas per actor with per-frame pivots so the runtime can place sprites on the
ground contact.

Outputs are projection-only. Collision radius, damage, AI and spawn behaviour
come from enemy-archetypes.mjs and are never derived from these files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

from hmh_pipeline_lock import exclusive_pipeline_lock

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "apps" / "hmh-reboot" / "assets" / "source" / "blender" / "hmh-enemy-roster.json"
OUTPUT_ROOT = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-reboot-enemy-roster"
EXPECTED_BLENDER_VERSION = "Blender 5.1.2"
TRACEBACK_MARKER = "Traceback (most recent call last)"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the HMH enemy/boss sprite roster.")
    parser.add_argument("--skip-scene", action="store_true", help="Reuse the committed .blend source.")
    parser.add_argument("--skip-render", action="store_true", help="Reuse raw frames already on disk.")
    parser.add_argument("--verify-reproducible", action="store_true",
                        help="Render twice and require byte-identical atlases.")
    return parser.parse_args()


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def run_checked(command: list[str], label: str) -> str:
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    combined = (completed.stdout or "") + (completed.stderr or "")
    if completed.returncode != 0 or TRACEBACK_MARKER in combined:
        raise RuntimeError(f"{label} failed ({completed.returncode})\n{combined[-9000:]}")
    return combined


def build_scene(blender: Path, blend_path: Path) -> None:
    """Rebuild the source scene from the manifest for a cold reproducibility pass."""
    run_checked([
        str(blender), "--background", "--factory-startup",
        "--python", str(ROOT / "scripts" / "hmh-blender" / "create-hmh-enemy-roster.py"),
        "--",
        "--manifest", str(MANIFEST_PATH),
        "--source-blend", str(blend_path),
        "--inspection-output", str(ROOT / ".tmp" / "hmh-enemy-roster-scene.json"),
    ], "enemy roster scene build")
    backup = blend_path.with_suffix(blend_path.suffix + "1")
    if backup.exists():
        backup.unlink()


def render_roster_by_actor(
    blender: Path,
    blend_path: Path,
    manifest: dict,
    raw_dir: Path,
    report_stem: str,
    label: str,
) -> None:
    """Render each actor in a fresh Blender process to isolate GPU render state."""
    for actor in manifest["actors"]:
        actor_id = actor["actorId"]
        run_checked([
            str(blender), "--background", str(blend_path),
            "--python", str(ROOT / "scripts" / "hmh-blender" / "export-hmh-enemy-roster.py"),
            "--",
            "--manifest", str(MANIFEST_PATH),
            "--raw-output", str(raw_dir),
            "--report-output", str(ROOT / ".tmp" / f"{report_stem}-{actor_id}.json"),
            "--actor-id", actor["actorId"],
        ], f"{label}: {actor_id}")


LSB_TOLERANCE_MAX_CHANNEL_DELTA = 1
LSB_TOLERANCE_MAX_SUBPIXELS_PER_FRAME = 8
RGB_CANONICALIZATION_STEP = 8
RGB_CANONICALIZATION_OFFSET = RGB_CANONICALIZATION_STEP // 2


def roster_json_drift_is_derived(first_path: Path, second_path: Path, tolerated_frames: set[str]) -> bool:
    """True when two atlas JSONs differ ONLY in the per-frame sourcePixelSha256
    of frames whose pixels drifted within the LSB tolerance. Every geometric and
    animation field (frame rects, pivots, trims, states, directions, image) must
    still be exactly equal; any other difference is real metadata drift."""
    a = json.loads(first_path.read_text(encoding="utf-8"))
    b = json.loads(second_path.read_text(encoding="utf-8"))
    a_frames = a.pop("frames", None)
    b_frames = b.pop("frames", None)
    if a != b or a_frames is None or b_frames is None or len(a_frames) != len(b_frames):
        return False
    for fa, fb in zip(a_frames, b_frames):
        if fa == fb:
            continue
        keys = set(fa) | set(fb)
        differing = {key for key in keys if fa.get(key) != fb.get(key)}
        if differing != {"sourcePixelSha256"}:
            return False
        if f"{fa.get('id')}.png" not in tolerated_frames:
            return False
    return True


def frames_within_lsb_tolerance(first_dir: Path, second_dir: Path, frame_names: list[str]):
    """Return {frame: differing_subpixels} if every drifted frame is within the
    documented Workbench rasterizer jitter (<=1 LSB on <=8 subpixels), else None.

    Three consecutive cold rebuilds on 2026-07-31 flipped one LSB on a
    different frame each run - including an actor whose source had not changed
    at all - so an exact-byte gate on this renderer is structurally flaky. Real
    non-determinism (geometry, pose, material or alpha drift) changes hundreds
    of subpixels and still fails. Metadata JSON must remain byte-exact.
    """
    report = {}
    for name in frame_names:
        first_path = first_dir / name
        second_path = second_dir / name
        if not first_path.exists() or not second_path.exists():
            return None
        first = canonical_rgba(Image.open(first_path))
        second = canonical_rgba(Image.open(second_path))
        if first.size != second.size:
            return None
        a = first.tobytes()
        b = second.tobytes()
        differing = 0
        for index in range(len(a)):
            delta = a[index] - b[index]
            if delta:
                if abs(delta) > LSB_TOLERANCE_MAX_CHANNEL_DELTA:
                    return None
                differing += 1
                if differing > LSB_TOLERANCE_MAX_SUBPIXELS_PER_FRAME:
                    return None
        report[name] = differing
    return report


def generated_artifact_hashes() -> dict[str, str]:
    """Hash every shipped actor image and metadata artifact, excluding run metrics."""
    patterns = (
        "*-roster-atlas.png",
        "*-roster-atlas.json",
        "*-roster-contact-sheet.png",
    )
    paths = sorted({path for pattern in patterns for path in OUTPUT_ROOT.rglob(pattern)})
    return {
        path.relative_to(OUTPUT_ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in paths
    }


def decoded_frame_hashes(raw_dir: Path) -> dict[str, str]:
    return {
        path.name: hashlib.sha256(canonical_rgba(Image.open(path)).tobytes()).hexdigest()
        for path in sorted(raw_dir.glob("*.png"))
    }


def canonical_rgba(image: Image.Image) -> Image.Image:
    return image.convert("RGBA") if image.mode != "RGBA" else image


def canonicalize_rendered_rgb(image: Image.Image) -> Image.Image:
    """Remove bounded backend RGB jitter without changing authored alpha.

    Round visible RGB to the nearest 8-value bucket (maximum adjustment 4)
    and zero invisible RGB. A floor mask is intentionally not used: preserved
    cold-pass evidence showed one-LSB values straddling a floor boundary.
    """
    image = canonical_rgba(image)
    data = bytearray(image.tobytes())
    for index in range(0, len(data), 4):
        if data[index + 3] == 0:
            data[index:index + 3] = b"\0\0\0"
            continue
        for channel in range(3):
            value = data[index + channel]
            data[index + channel] = min(
                255,
                ((value + RGB_CANONICALIZATION_OFFSET) // RGB_CANONICALIZATION_STEP)
                * RGB_CANONICALIZATION_STEP,
            )
    return Image.frombytes("RGBA", image.size, bytes(data))


def remove_tiny_alpha_components(
    image: Image.Image,
    alpha_threshold: int,
    min_pixels: int,
) -> Image.Image:
    """Remove disconnected antialiasing specks without touching authored components."""
    if min_pixels < 1:
        raise RuntimeError(f"minAlphaComponentPixels must be positive, received {min_pixels}")
    result = canonical_rgba(image).copy()
    alpha = result.getchannel("A")
    alpha_pixels = alpha.load()
    output_pixels = result.load()
    width, height = result.size
    visited = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or alpha_pixels[x, y] <= alpha_threshold:
                continue
            visited[index] = 1
            component = [(x, y)]
            for current_x, current_y in component:
                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_index = next_y * width + next_x
                    if visited[next_index] or alpha_pixels[next_x, next_y] <= alpha_threshold:
                        continue
                    visited[next_index] = 1
                    component.append((next_x, next_y))
            if len(component) < min_pixels:
                for component_x, component_y in component:
                    output_pixels[component_x, component_y] = (0, 0, 0, 0)
    return result


def normalize_rendered_frames(manifest: dict, raw_dir: Path) -> None:
    """Deterministically downsample supersampled Blender output to runtime frame sizes."""
    render_scale = manifest["render"].get("renderScale", 1)
    if render_scale == 1:
        return
    if not isinstance(render_scale, int) or render_scale < 1:
        raise RuntimeError(f"renderScale must be a positive integer, received {render_scale!r}")
    default_size = tuple(manifest["render"]["frameSize"])
    for actor in manifest["actors"]:
        actor_id = actor["actorId"]
        target_size = tuple(actor.get("frameSize", default_size))
        rendered_size = (target_size[0] * render_scale, target_size[1] * render_scale)
        phases = list(actor.get("phaseVisuals", {})) or [None]
        for boss_phase in phases:
            for state, clip in manifest["clips"].items():
                for direction in manifest["directions"]:
                    for frame_index in range(clip["frames"]):
                        phase_token = f"__{boss_phase}" if boss_phase else ""
                        filename = f"{actor_id}__body{phase_token}__{state}__{direction}__{frame_index:03d}.png"
                        path = raw_dir / filename
                        image = canonical_rgba(Image.open(path))
                        if image.size != rendered_size:
                            raise RuntimeError(
                                f"Unexpected supersampled dimensions for {filename}: {image.size}; expected {rendered_size}"
                            )
                        normalized = image.resize(target_size, Image.Resampling.LANCZOS)
                        normalized = remove_tiny_alpha_components(
                            normalized,
                            manifest["render"]["alphaThreshold"],
                            manifest["render"]["minAlphaComponentPixels"],
                        )
                        normalized = canonicalize_rendered_rgb(normalized)
                        normalized.save(
                            path, optimize=False, compress_level=9,
                        )


def alpha_bbox(image: Image.Image, threshold: int):
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    return mask.getbbox()


def shelf_pack(records: list[dict], padding: int, max_size: int):
    ordered = sorted(records, key=lambda record: (-(record["bbox"][3] - record["bbox"][1]), record["id"]))
    size = 128
    while size <= max_size:
        placements = {}
        x = padding
        y = padding
        shelf_height = 0
        fitted = True
        for record in ordered:
            width = record["bbox"][2] - record["bbox"][0]
            height = record["bbox"][3] - record["bbox"][1]
            if x + width + padding > size:
                x = padding
                y += shelf_height + padding
                shelf_height = 0
            if y + height + padding > size:
                fitted = False
                break
            placements[record["id"]] = (x, y, width, height)
            x += width + padding
            shelf_height = max(shelf_height, height)
        if fitted:
            return size, placements
        size *= 2
    raise RuntimeError(f"Enemy frames exceed max atlas size {max_size}")


def analyse(actor: dict, manifest: dict, raw_dir: Path) -> list[dict]:
    actor_id = actor["actorId"]
    threshold = manifest["render"]["alphaThreshold"]
    default_size = manifest["render"]["frameSize"]
    # The boss renders three phase silhouettes, so it carries three times the
    # frames and gets its own frame size to stay inside the atlas budget.
    frame_size = tuple(actor.get("frameSize", default_size))
    # The pivot is authored against the default frame; scale it so an actor
    # rendered at another size keeps the same ground contact.
    pivot = (
        round(manifest["pivot"]["x"] * frame_size[0] / default_size[0]),
        round(manifest["pivot"]["y"] * frame_size[1] / default_size[1]),
    )
    records = []
    empty = []
    hashes = defaultdict(list)
    phases = list(actor.get("phaseVisuals", {})) or [None]
    for boss_phase in phases:
        for state, clip in manifest["clips"].items():
            for direction in manifest["directions"]:
                for frame_index in range(clip["frames"]):
                    phase_token = f"__{boss_phase}" if boss_phase else ""
                    filename = f"{actor_id}__body{phase_token}__{state}__{direction}__{frame_index:03d}.png"
                    path = raw_dir / filename
                    if not path.exists():
                        raise RuntimeError(f"Missing rendered frame: {filename}")
                    image = canonical_rgba(Image.open(path))
                    if image.size != frame_size:
                        raise RuntimeError(f"Unexpected dimensions for {filename}: {image.size}")
                    bbox = alpha_bbox(image, threshold)
                    frame_id = filename.removesuffix(".png")
                    if bbox is None:
                        empty.append(frame_id)
                        continue
                    x0, y0, x1, y1 = bbox
                    x0 = min(x0, pivot[0])
                    y0 = min(y0, pivot[1])
                    x1 = max(x1, pivot[0] + 1)
                    y1 = max(y1, pivot[1] + 1)
                    digest = hashlib.sha256(image.tobytes()).hexdigest()
                    hashes[digest].append(frame_id)
                    records.append({
                        "id": frame_id,
                        "filename": filename,
                        "phase": boss_phase,
                        "state": state,
                        "direction": direction,
                        "frameIndex": frame_index,
                        "fps": clip["fps"],
                        "image": image,
                        "bbox": (x0, y0, x1, y1),
                        "sourcePixelSha256": digest,
                        "pivot": pivot,
                    })
    if empty:
        raise RuntimeError(f"{actor_id}: empty frames {empty[:6]}")
    duplicates = [{"sha256": digest, "frameIds": ids} for digest, ids in sorted(hashes.items()) if len(ids) > 1]
    if duplicates:
        raise RuntimeError(
            f"{actor_id}: {len(duplicates)} duplicate rendered frames -- a pose is not distinct: "
            f"{duplicates[:3]}"
        )
    return records


def build_atlas(actor: dict, manifest: dict, records: list[dict], output_dir: Path) -> dict:
    padding = manifest["atlas"]["padding"]
    atlas_size, placements = shelf_pack(records, padding, manifest["atlas"]["maxSize"])
    atlas = Image.new("RGBA", (atlas_size, atlas_size), (0, 0, 0, 0))
    pivot = records[0]["pivot"] if records else (manifest["pivot"]["x"], manifest["pivot"]["y"])
    frames = []
    for record in sorted(records, key=lambda item: item["id"]):
        x0, y0, x1, y1 = record["bbox"]
        crop = record["image"].crop((x0, y0, x1, y1))
        atlas_x, atlas_y, width, height = placements[record["id"]]
        atlas.alpha_composite(crop, (atlas_x, atlas_y))
        opaque = sum(1 for value in crop.getchannel("A").tobytes() if value > manifest["render"]["alphaThreshold"])
        frames.append({
            "id": record["id"],
            "phase": record["phase"],
            "state": record["state"],
            "direction": record["direction"],
            "frameIndex": record["frameIndex"],
            "fps": record["fps"],
            "frame": {"x": atlas_x, "y": atlas_y, "w": width, "h": height},
            "pivot": {"x": pivot[0] - x0, "y": pivot[1] - y0},
            "anchor": {"x": round((pivot[0] - x0) / max(width, 1), 6), "y": round((pivot[1] - y0) / max(height, 1), 6)},
            "sourcePivot": {"x": pivot[0], "y": pivot[1]},
            "opaquePixels": opaque,
            "rotated": False,
            "trimmed": True,
            "sourcePixelSha256": record["sourcePixelSha256"],
        })

    output_dir.mkdir(parents=True, exist_ok=True)
    atlas_path = output_dir / f"{actor['actorId']}-roster-atlas.png"
    atlas.save(atlas_path, optimize=False, compress_level=9)

    metadata = {
        "schemaVersion": 1,
        "pipelineId": manifest["pipelineId"],
        "classification": manifest["classification"],
        "runtimeAuthority": manifest["runtimeAuthority"],
        "gameplayBodyProfile": manifest["gameplayBodyProfile"],
        "actorId": actor["actorId"],
        "identityForm": actor["identityForm"],
        "silhouette": actor["silhouette"],
        "detailKit": actor.get("detailKit"),
        "animationProfile": actor.get("animationProfile", {"kind": "shared-roster-v1"}),
        "boss": bool(actor.get("boss", False)),
        "image": f"./{atlas_path.name}",
        "directions": manifest["directions"],
        "states": list(manifest["clips"].keys()),
        "phases": list(actor.get("phaseVisuals", {})),
        "frames": frames,
    }
    metadata_path = output_dir / f"{actor['actorId']}-roster-atlas.json"
    write_lf_json(metadata_path, metadata)

    # Contact sheet: a flat strip of the south-facing frames per state, for
    # human review of silhouette and identity.
    sheet_frames = [record for record in records if record["direction"] == "south"]
    sheet_frames.sort(key=lambda item: (item["phase"] or "", item["state"], item["frameIndex"]))
    cell = manifest["render"]["frameSize"][0]
    sheet = Image.new("RGBA", (cell * max(len(sheet_frames), 1), cell), (10, 14, 20, 255))
    for index, record in enumerate(sheet_frames):
        sheet.alpha_composite(record["image"], (index * cell, 0))
    sheet_path = output_dir / f"{actor['actorId']}-roster-contact-sheet.png"
    sheet.save(sheet_path, optimize=False, compress_level=9)

    return {
        "actorId": actor["actorId"],
        "frameCount": len(frames),
        "atlasSize": atlas_size,
        "atlasBytes": atlas_path.stat().st_size,
        "metadataBytes": metadata_path.stat().st_size,
        "contactSheetBytes": sheet_path.stat().st_size,
        "uniqueSourceFrames": len({frame["sourcePixelSha256"] for frame in frames}),
    }


def main() -> None:
    args = parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    blender = Path(os.environ.get("BLENDER_EXECUTABLE", r"D:\Apps\Blender\blender.exe"))
    raw_dir = ROOT / manifest["render"]["rawOutputDirectory"]
    blend_path = ROOT / manifest["scene"]["sourceBlend"]

    if not args.skip_render or not args.skip_scene:
        if not blender.exists():
            raise FileNotFoundError(f"Blender executable not found: {blender}")
        version = run_checked([str(blender), "--version"], "blender --version").splitlines()
        first = version[0].strip() if version else ""
        if first != EXPECTED_BLENDER_VERSION:
            raise RuntimeError(f"expected {EXPECTED_BLENDER_VERSION!r}, received {first!r}")

    if not args.skip_scene:
        build_scene(blender, blend_path)

    if not args.skip_render:
        render_roster_by_actor(
            blender, blend_path, manifest, raw_dir,
            "hmh-enemy-roster-render", "enemy roster render",
        )
        normalize_rendered_frames(manifest, raw_dir)

    results = []
    for actor in manifest["actors"]:
        records = analyse(actor, manifest, raw_dir)
        results.append(build_atlas(actor, manifest, records, OUTPUT_ROOT / actor["actorId"]))

    tolerated_frames = {}
    if args.verify_reproducible:
        first_pass = generated_artifact_hashes()
        first_frame_pass = decoded_frame_hashes(raw_dir)
        repro_snapshot = ROOT / ".tmp" / "hmh-enemy-roster-repro-first"
        artifact_snapshot = ROOT / ".tmp" / "hmh-enemy-roster-artifacts-repro-first"
        if repro_snapshot.exists():
            shutil.rmtree(repro_snapshot)
        if artifact_snapshot.exists():
            shutil.rmtree(artifact_snapshot)
        shutil.copytree(raw_dir, repro_snapshot)
        shutil.copytree(OUTPUT_ROOT, artifact_snapshot)
        build_scene(blender, blend_path)
        render_roster_by_actor(
            blender, blend_path, manifest, raw_dir,
            "hmh-enemy-roster-render-verify", "enemy roster verification render",
        )
        normalize_rendered_frames(manifest, raw_dir)
        for actor in manifest["actors"]:
            records = analyse(actor, manifest, raw_dir)
            build_atlas(actor, manifest, records, OUTPUT_ROOT / actor["actorId"])
        second_pass = generated_artifact_hashes()
        second_frame_pass = decoded_frame_hashes(raw_dir)
        drifted = sorted(name for name, digest in first_pass.items() if second_pass.get(name) != digest)
        drifted_frames = sorted(
            name for name, digest in first_frame_pass.items() if second_frame_pass.get(name) != digest
        )
        tolerated_frames = {}
        if drifted:
            report = None
            if drifted_frames:
                report = frames_within_lsb_tolerance(repro_snapshot, raw_dir, drifted_frames)
            if report is not None:
                # Atlas JSON drift is acceptable only as a pure derivative of
                # the tolerated pixels: each drifted JSON may differ solely in
                # the sourcePixelSha256 of exactly those frames.
                tolerated_set = set(report)
                for name in (n for n in drifted if n.endswith(".json")):
                    if not roster_json_drift_is_derived(
                        artifact_snapshot / name, OUTPUT_ROOT / name, tolerated_set,
                    ):
                        report = None
                        break
            if report is None:
                raise RuntimeError(
                    "generated art is not reproducible across cold scene rebuilds: "
                    f"artifacts={drifted}; decodedFrames={drifted_frames}"
                )
            tolerated_frames = report
            # Within the documented one-LSB rasterizer jitter: bless the FIRST
            # pass so the shipped artifact is a deterministic choice rather
            # than whichever render happened to finish last. Raw frames are
            # restored with it so a later --skip-render run compares against
            # the pass that actually shipped.
            shutil.copytree(artifact_snapshot, OUTPUT_ROOT, dirs_exist_ok=True)
            shutil.rmtree(raw_dir)
            shutil.copytree(repro_snapshot, raw_dir)
            # Review finding (Cycle 037): the byte ledger below must describe
            # the RESTORED first-pass artifacts, not the discarded second pass,
            # or assets:qa fails on the first genuinely tolerated run.
            for entry in results:
                actor_dir = OUTPUT_ROOT / entry["actorId"]
                entry["atlasBytes"] = (actor_dir / f"{entry['actorId']}-roster-atlas.png").stat().st_size
                entry["metadataBytes"] = (actor_dir / f"{entry['actorId']}-roster-atlas.json").stat().st_size
                entry["contactSheetBytes"] = (actor_dir / f"{entry['actorId']}-roster-contact-sheet.png").stat().st_size
        shutil.rmtree(repro_snapshot)
        shutil.rmtree(artifact_snapshot)

    metrics = {
        "status": "pass",
        "pipelineId": manifest["pipelineId"],
        "reproducibilityPolicy": {
            "kind": "exact-or-single-lsb",
            "maxChannelDelta": LSB_TOLERANCE_MAX_CHANNEL_DELTA,
            "maxDifferingSubpixelsPerFrame": LSB_TOLERANCE_MAX_SUBPIXELS_PER_FRAME,
            "metadataExactExceptDerivedPixelSha": True,
            "rgbCanonicalization": {
                "kind": "nearest-step",
                "step": RGB_CANONICALIZATION_STEP,
                "maxChannelDelta": RGB_CANONICALIZATION_OFFSET,
                "preserveAlpha": True,
            },
            "toleratedFrames": tolerated_frames if args.verify_reproducible else None,
        },
        "blender": EXPECTED_BLENDER_VERSION,
        "actorCount": len(results),
        "totalFrames": sum(entry["frameCount"] for entry in results),
        "totalAtlasBytes": sum(entry["atlasBytes"] for entry in results),
        "reproducibleVerified": bool(args.verify_reproducible),
        "duplicateFrames": 0,
        "actors": results,
    }
    write_lf_json(OUTPUT_ROOT / "hmh-enemy-roster-metrics.json", metrics)
    print(json.dumps({k: v for k, v in metrics.items() if k != "actors"}, sort_keys=True))


if __name__ == "__main__":
    with exclusive_pipeline_lock(ROOT / ".tmp" / "hmh-enemy-roster-pipeline.lock", "HMH enemy roster pipeline"):
        main()
