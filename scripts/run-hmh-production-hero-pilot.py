from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

from hmh_pipeline_lock import exclusive_pipeline_lock


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json"
GENERATOR_PATH = ROOT / "scripts/hmh-blender/create-hmh-production-hero-pilot.py"
EXPORTER_PATH = ROOT / "scripts/hmh-blender/export-hmh-production-hero-pilot.py"
BLENDER = Path(r"D:\Apps\Blender\blender.exe")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the HMH production hero atlases.")
    # The throwaway skinned-actor gate drives this same pipeline from its own
    # manifest into its own .tmp output root, so the shipped hero atlases are
    # never touched by a pipeline test.
    parser.add_argument("--manifest", default=str(MANIFEST_PATH))
    parser.add_argument("--output-root", default="")
    return parser.parse_args()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


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


def expected_frames(manifest: dict, pilot: dict) -> list[dict]:
    frames = []
    for layer in pilot["layers"]:
        for state, clip in pilot["clips"][layer].items():
            for direction in manifest["directions"]:
                for frame_index in range(clip["frames"]):
                    frame_id = f"{pilot['actorId']}__{layer}__{state}__{direction}__{frame_index:03d}"
                    frames.append({
                        "id": frame_id,
                        "filename": frame_id + ".png",
                        "layer": layer,
                        "state": state,
                        "direction": direction,
                        "frameIndex": frame_index,
                        "fps": clip["fps"],
                        "loop": clip.get("loop", True),
                    })
    return frames


def canonical_rgba(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    data = bytearray(image.tobytes())
    for index in range(0, len(data), 4):
        if data[index + 3] == 0:
            data[index] = 0
            data[index + 1] = 0
            data[index + 2] = 0
    return Image.frombytes("RGBA", image.size, bytes(data))


def alpha_bbox(image: Image.Image, threshold: int) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    return mask.getbbox()


def analyze_frame_set(directory: Path, frames: list[dict], frame_size: tuple[int, int], pivot: tuple[int, int], threshold: int) -> dict:
    actual = sorted(path.name for path in directory.glob("*.png"))
    expected = sorted(frame["filename"] for frame in frames)
    if actual != expected:
        missing = sorted(set(expected) - set(actual))
        unexpected = sorted(set(actual) - set(expected))
        raise RuntimeError(f"Frame set mismatch: missing={missing[:8]} unexpected={unexpected[:8]}")

    records = []
    empty = []
    corner_failures = []
    hashes = defaultdict(list)
    for frame in frames:
        image = canonical_rgba(Image.open(directory / frame["filename"]))
        if image.size != frame_size:
            raise RuntimeError(f"Unexpected dimensions for {frame['filename']}: {image.size}")
        bbox = alpha_bbox(image, threshold)
        if bbox is None:
            empty.append(frame["id"])
            continue
        corners = [image.getpixel((0, 0))[3], image.getpixel((frame_size[0] - 1, 0))[3], image.getpixel((0, frame_size[1] - 1))[3], image.getpixel((frame_size[0] - 1, frame_size[1] - 1))[3]]
        if max(corners) > threshold:
            corner_failures.append(frame["id"])
        x0, y0, x1, y1 = bbox
        x0 = min(x0, pivot[0])
        y0 = min(y0, pivot[1])
        x1 = max(x1, pivot[0] + 1)
        y1 = max(y1, pivot[1] + 1)
        decoded_hash = hashlib.sha256(image.tobytes()).hexdigest()
        hashes[decoded_hash].append(frame["id"])
        opaque = sum(1 for alpha in image.getchannel("A").get_flattened_data() if alpha > threshold)
        records.append({**frame, "image": image, "bbox": (x0, y0, x1, y1), "decodedHash": decoded_hash, "opaquePixels": opaque})
    if empty or corner_failures:
        raise RuntimeError(f"Invalid frame evidence: empty={empty[:8]} cornerFailures={corner_failures[:8]}")
    duplicate_groups = [{"sha256": digest, "frameIds": ids} for digest, ids in sorted(hashes.items()) if len(ids) > 1]
    illegal_duplicates = [group for group in duplicate_groups if any("__shadow__" not in frame_id for frame_id in group["frameIds"])]
    if illegal_duplicates:
        raise RuntimeError(f"Animated decoded-frame duplicates: {illegal_duplicates[:4]}")
    animated_hashes = {record["decodedHash"] for record in records if record["layer"] != "shadow"}
    return {
        "records": records,
        "empty": empty,
        "cornerFailures": corner_failures,
        "duplicateGroups": duplicate_groups,
        "uniqueAnimatedFrameCount": len(animated_hashes),
    }


def compare_premultiplied(directory_a: Path, directory_b: Path, frames: list[dict]) -> dict:
    observed = {"maxChangedVisiblePixels": 0, "maxChannelDelta": 0, "maxTotalChannelDelta": 0}
    worst = None
    for frame in frames:
        image_a = Image.open(directory_a / frame["filename"]).convert("RGBA")
        image_b = Image.open(directory_b / frame["filename"]).convert("RGBA")
        changed = 0
        max_delta = 0
        total_delta = 0
        for pixel_a, pixel_b in zip(image_a.get_flattened_data(), image_b.get_flattened_data()):
            premul_a = tuple(round(channel * pixel_a[3] / 255) for channel in pixel_a[:3]) + (pixel_a[3],)
            premul_b = tuple(round(channel * pixel_b[3] / 255) for channel in pixel_b[:3]) + (pixel_b[3],)
            deltas = [abs(left - right) for left, right in zip(premul_a, premul_b)]
            if any(deltas):
                changed += 1
                max_delta = max(max_delta, max(deltas))
                total_delta += sum(deltas)
        candidate = (changed, max_delta, total_delta)
        if worst is None or candidate > worst[0]:
            worst = (candidate, frame["id"])
        observed["maxChangedVisiblePixels"] = max(observed["maxChangedVisiblePixels"], changed)
        observed["maxChannelDelta"] = max(observed["maxChannelDelta"], max_delta)
        observed["maxTotalChannelDelta"] = max(observed["maxTotalChannelDelta"], total_delta)
    observed["worstFrameId"] = worst[1] if worst else None
    return observed


def shelf_pack(records: list[dict], padding: int, max_size: int) -> tuple[int, dict[str, tuple[int, int, int, int]]]:
    for size in (1024, 2048):
        if size > max_size:
            continue
        x = padding
        y = padding
        row_height = 0
        placements = {}
        ok = True
        ordered = sorted(records, key=lambda record: (-(record["bbox"][3] - record["bbox"][1]), record["id"]))
        for record in ordered:
            x0, y0, x1, y1 = record["bbox"]
            width = x1 - x0
            height = y1 - y0
            if x + width + padding > size:
                x = padding
                y += row_height + padding
                row_height = 0
            if y + height + padding > size:
                ok = False
                break
            placements[record["id"]] = (x, y, width, height)
            x += width + padding
            row_height = max(row_height, height)
        if ok:
            return size, placements
    raise RuntimeError(f"Frames exceed max atlas size {max_size}")


def pilot_frame_size(manifest: dict, pilot: dict) -> tuple[int, int]:
    return tuple(pilot.get("frameSize", manifest["render"]["frameSize"]))


def pilot_pivot(manifest: dict, pilot: dict) -> tuple[int, int]:
    """The pivot is authored against the manifest's default frame.

    An actor rendered at another size keeps the same ground contact only if the
    pivot scales with it, the same rule run-hmh-enemy-roster-pipeline.py uses
    for the boss.
    """
    default_size = manifest["render"]["frameSize"]
    frame_size = pilot_frame_size(manifest, pilot)
    source = manifest["pivot"]["sourcePixels"]
    return tuple(round(source[axis] * frame_size[axis] / default_size[axis]) for axis in (0, 1))


def build_atlas(manifest: dict, pilot: dict, analysis: dict, output_dir: Path) -> tuple[Path, Path, dict]:
    padding = manifest["atlas"]["padding"]
    atlas_size, placements = shelf_pack(analysis["records"], padding, manifest["atlas"]["maxSize"])
    atlas = Image.new("RGBA", (atlas_size, atlas_size), (0, 0, 0, 0))
    metadata_frames = []
    record_by_id = {record["id"]: record for record in analysis["records"]}
    frame_size = pilot_frame_size(manifest, pilot)
    source_pivot = pilot_pivot(manifest, pilot)
    for frame in expected_frames(manifest, pilot):
        record = record_by_id[frame["id"]]
        x0, y0, x1, y1 = record["bbox"]
        crop = record["image"].crop((x0, y0, x1, y1))
        atlas_x, atlas_y, width, height = placements[frame["id"]]
        atlas.alpha_composite(crop, (atlas_x, atlas_y))
        pivot_x = source_pivot[0] - x0
        pivot_y = source_pivot[1] - y0
        metadata_frames.append({
            "id": frame["id"], "layer": frame["layer"], "state": frame["state"], "direction": frame["direction"], "frameIndex": frame["frameIndex"], "fps": frame["fps"], "loop": frame["loop"],
            "frame": {"x": atlas_x, "y": atlas_y, "w": width, "h": height}, "rotated": False, "trimmed": True,
            "sourceSize": {"w": frame_size[0], "h": frame_size[1]},
            "spriteSourceSize": {"x": x0, "y": y0, "w": width, "h": height},
            "sourcePivot": {"x": source_pivot[0], "y": source_pivot[1]}, "pivot": {"x": pivot_x, "y": pivot_y},
            "anchor": {"x": round(pivot_x / width, 6), "y": round(pivot_y / height, 6)},
            "opaquePixels": record["opaquePixels"], "sourcePixelSha256": record["decodedHash"],
        })
    atlas_path = output_dir / Path(pilot["output"]["atlas"]).name
    metadata_path = output_dir / Path(pilot["output"]["metadata"]).name
    atlas.save(atlas_path, optimize=False, compress_level=9)
    metadata = {
        "schemaVersion": 1, "pipelineId": manifest["pipelineId"], "actorId": pilot["actorId"], "variantId": pilot["variantId"], "animationProfile": pilot["animationProfile"],
        "classification": manifest["classification"], "runtimeAuthority": pilot["runtimeAuthority"], "gameplayBodyProfile": manifest["gameplayBodyProfile"],
        "image": "./" + atlas_path.name, "directions": manifest["directions"], "layers": pilot["layers"],
        "composition": {"independentDirections": True, "weaponSocket": manifest["scene"]["weaponSocket"], "layerOrder": pilot["composition"]},
        "frames": metadata_frames,
    }
    write_lf_json(metadata_path, metadata)
    return atlas_path, metadata_path, {"width": atlas_size, "height": atlas_size}


def composite_frame(directory: Path, actor_id: str, direction: str, lower_state: str, lower_index: int, torso_state: str, torso_index: int, weapon_state: str, weapon_index: int, size: tuple[int, int]) -> Image.Image:
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    specs = [("shadow", "idle", 0), ("lower-body", lower_state, lower_index), ("torso-head", torso_state, torso_index), ("weapon", weapon_state, weapon_index)]
    for layer, state, index in specs:
        filename = f"{actor_id}__{layer}__{state}__{direction}__{index:03d}.png"
        result.alpha_composite(canonical_rgba(Image.open(directory / filename)))
    return result


def build_contact_sheet(manifest: dict, pilot: dict, directory: Path, output_dir: Path) -> Path:
    frame_size = pilot_frame_size(manifest, pilot)

    def renderable(row) -> bool:
        # composite_frame opens one PNG per layer per row, so a row naming a
        # state an actor does not have would crash the sheet. Imported actors
        # can carry a reduced clip table.
        _, lower_state, lower_index, torso_state, torso_index, weapon_state, weapon_index = row
        for layer, state, index in (
            ("lower-body", lower_state, lower_index),
            ("torso-head", torso_state, torso_index),
            ("weapon", weapon_state, weapon_index),
        ):
            clips = pilot["clips"].get(layer, {})
            if not (state in pilot["clips"].get(layer, {}) and index < clips[state]["frames"]):
                return False
        return True

    rows = [("IDLE / AIM", "idle", 0, "aim", 0, "aim", 0)]
    rows += [(f"RUN {index + 1}/6", "run", index, "aim", index % 2, "aim", index % 2) for index in range(6)]
    rows += [(f"PISTOL FIRE {index + 1}/3", "idle", index % 2, "pistol-fire", index, "pistol-fire", index) for index in range(3)]
    rows += [(f"HURT {index + 1}/2", "idle", index, "hurt", index, "aim", index) for index in range(2)]
    # Action contact rows make the new authored coverage human-inspectable
    # without expanding the sheet to every intermediate frame.
    for state in ("dash", "melee", "grenade", "death"):
        if not (state in pilot["clips"].get("torso-head", {})):
            continue
        count = pilot["clips"]["torso-head"][state]["frames"]
        for index in sorted({0, count // 2, count - 1}):
            rows.append((f"{state.upper()} {index + 1}/{count}", state, index, state, index, state, index))
    rows = [row for row in rows if renderable(row)]
    if not rows:
        raise RuntimeError(f"No contact-sheet row survives the clip table for {pilot['actorId']}")
    label_width = 190
    header_height = 104
    sheet = Image.new("RGBA", (label_width + frame_size[0] * len(manifest["directions"]), header_height + frame_size[1] * len(rows)), (7, 12, 27, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    actor_label = pilot["actorId"].replace("-", " ").upper()
    variant_label = pilot["variantId"].replace("-", " ").upper()
    draw.text((18, 16), f"HMH PRODUCTION HERO PILOT | {actor_label} | {variant_label}", fill=(238, 245, 255, 255), font=font)
    draw.text((18, 38), "PROJECTION ONLY | SHARED HUMAN-MEDIUM GAMEPLAY BODY | 8 DIRECTIONS | 4 LAYERS", fill=(127, 220, 255, 255), font=font)
    for direction_index, direction in enumerate(manifest["directions"]):
        draw.text((label_width + direction_index * frame_size[0] + 8, 76), direction.upper(), fill=(173, 190, 222, 255), font=font)
    for row_index, row in enumerate(rows):
        label, lower_state, lower_index, torso_state, torso_index, weapon_state, weapon_index = row
        y = header_height + row_index * frame_size[1]
        draw.text((18, y + 12), label, fill=(238, 245, 255, 255), font=font)
        for direction_index, direction in enumerate(manifest["directions"]):
            composed = composite_frame(directory, pilot["actorId"], direction, lower_state, lower_index, torso_state, torso_index, weapon_state, weapon_index, frame_size)
            sheet.alpha_composite(composed, (label_width + direction_index * frame_size[0], y))
    path = output_dir / Path(pilot["output"]["contactSheet"]).name
    sheet.save(path, optimize=False, compress_level=9)
    return path


def process_pilot(manifest: dict, pilot: dict, source_blend: Path, temp_root: Path, inspection: dict, actual_version: str, manifest_path: Path, generated_root: Path) -> dict:
    actor_temp = temp_root / pilot["actorId"]
    run_a = actor_temp / "run-a"
    run_b = actor_temp / "run-b"
    report_a = actor_temp / "run-a-report.json"
    report_b = actor_temp / "run-b-report.json"
    output_root = generated_root / pilot["actorId"]
    run_a.mkdir(parents=True, exist_ok=True)
    run_b.mkdir(parents=True, exist_ok=True)
    output_root.mkdir(parents=True, exist_ok=True)

    for raw_output, report_output, label in ((run_a, report_a, "render run A"), (run_b, report_b, "render run B")):
        run_checked([
            str(BLENDER), "--background", str(source_blend), "--python", str(EXPORTER_PATH), "--",
            "--manifest", str(manifest_path), "--actor-id", pilot["actorId"],
            "--raw-output", str(raw_output), "--report-output", str(report_output),
        ], f"{pilot['actorId']} {label}")

    frames = expected_frames(manifest, pilot)
    declared_frame_count = sum(
        clip["frames"] * len(manifest["directions"])
        for layer in pilot["layers"]
        for clip in pilot["clips"][layer].values()
    )
    if len(frames) != declared_frame_count:
        raise RuntimeError(f"Manifest frame contract drifted for {pilot['actorId']}: {len(frames)} != {declared_frame_count}")
    frame_size = pilot_frame_size(manifest, pilot)
    pivot = pilot_pivot(manifest, pilot)
    threshold = manifest["render"]["alphaThreshold"]
    analysis_a = analyze_frame_set(run_a, frames, frame_size, pivot, threshold)
    analyze_frame_set(run_b, frames, frame_size, pivot, threshold)
    observed = compare_premultiplied(run_a, run_b, frames)
    budget = manifest["reproducibilityBudget"]
    exceeded = [key for key in budget if observed[key] > budget[key]]
    if exceeded:
        raise RuntimeError(f"Reproducibility budget exceeded for {pilot['actorId']} ({exceeded}): observed={observed} budget={budget}")

    report = read_json(report_a)
    actor_inspection = inspection["actors"].get(pilot["actorId"])
    if actor_inspection is None:
        raise RuntimeError(f"Missing source inspection for {pilot['actorId']}")
    if inspection["externalDependencyCount"] != 0 or not inspection["weaponSocket"] or report["frameCount"] != len(frames):
        raise RuntimeError(f"Source/export inspection failed for {pilot['actorId']}: inspection={inspection} report={report}")
    if set(actor_inspection["objectsByLayer"]) != set(pilot["layers"]):
        raise RuntimeError(f"Actor inspection layers mismatch for {pilot['actorId']}: {actor_inspection}")
    expected_animated_frames = len(frames) - sum(
        clip["frames"] * len(manifest["directions"])
        for clip in pilot["clips"]["shadow"].values()
    )
    if analysis_a["uniqueAnimatedFrameCount"] != expected_animated_frames:
        raise RuntimeError(
            f"Expected {expected_animated_frames} unique animated frames for {pilot['actorId']}, "
            f"got {analysis_a['uniqueAnimatedFrameCount']}"
        )

    atlas_path, metadata_path, atlas_size = build_atlas(manifest, pilot, analysis_a, output_root)
    contact_sheet_path = build_contact_sheet(manifest, pilot, run_a, output_root)
    metrics_path = output_root / Path(pilot["output"]["metrics"]).name
    metrics = {
        "schema": "hmh-reboot-production-hero-pilot-metrics-v1", "status": "pass", "actorId": pilot["actorId"], "variantId": pilot["variantId"], "animationProfile": pilot["animationProfile"],
        "blenderVersion": actual_version, "gameplayBodyProfile": manifest["gameplayBodyProfile"], "runtimeAuthority": pilot["runtimeAuthority"],
        "frameCount": len(frames), "uniqueFrameIdCount": len({frame["id"] for frame in frames}), "uniqueAnimatedFrameCount": analysis_a["uniqueAnimatedFrameCount"],
        "duplicateDecodedFrameGroups": analysis_a["duplicateGroups"], "emptyFrameCount": len(analysis_a["empty"]), "transparentCornerFailureCount": len(analysis_a["cornerFailures"]),
        "externalDependencyCount": inspection["externalDependencyCount"], "weaponSocket": inspection["weaponSocket"], "boneCount": len(inspection["bones"]),
        "reproducibility": "pass", "reproducibilityMode": "bounded-premultiplied-rgba-v1", "reproducibilityBudget": budget, "reproducibilityObserved": observed,
        "frameSize": list(frame_size), "pivotPixels": list(pivot), "mode": report.get("mode", "trig-pose"),
        "sourceModelSha256": pilot.get("sourceModel", {}).get("sourceSha256"),
        "atlasSize": atlas_size, "sourceBlendSha256": sha256_file(source_blend), "atlasSha256": sha256_file(atlas_path), "metadataSha256": sha256_file(metadata_path),
        "contactSheetSha256": sha256_file(contact_sheet_path),
    }
    write_lf_json(metrics_path, metrics)
    return {
        "status": "pass", "actorId": pilot["actorId"], "frames": len(frames),
        "atlas": str(atlas_path.relative_to(ROOT)), "atlasSize": atlas_size,
        "reproducibilityObserved": observed,
    }


def main(args: argparse.Namespace | None = None) -> None:
    if args is None:
        args = parse_args()
    if not BLENDER.exists():
        raise RuntimeError(f"Blender not found: {BLENDER}")
    manifest_path = Path(args.manifest).resolve()
    manifest = read_json(manifest_path)
    required_version = manifest["scene"]["blenderVersion"]
    actual_version = blender_version()
    if actual_version != required_version:
        raise RuntimeError(f"Blender version mismatch: expected {required_version}, got {actual_version}")
    source_blend = ROOT / manifest["scene"]["sourceBlend"]
    temp_root = ROOT / manifest["render"]["rawOutputDirectory"]
    inspection_path = temp_root / "source-inspection.json"
    generated_output_root = Path(args.output_root).resolve() if args.output_root else ROOT / manifest["atlas"]["outputDirectory"]
    shutil.rmtree(temp_root, ignore_errors=True)
    shutil.rmtree(generated_output_root, ignore_errors=True)
    temp_root.mkdir(parents=True, exist_ok=True)

    run_checked([str(BLENDER), "--background", "--factory-startup", "--python", str(GENERATOR_PATH), "--", "--manifest", str(manifest_path), "--source-blend", str(source_blend), "--inspection-output", str(inspection_path)], "source generation")
    backup = source_blend.with_suffix(source_blend.suffix + "1")
    if backup.exists():
        backup.unlink()
    inspection = read_json(inspection_path)
    if set(inspection.get("actors", {})) != {pilot["actorId"] for pilot in manifest["pilots"]}:
        raise RuntimeError(f"Source actor inspection mismatch: {inspection}")

    summaries = [
        process_pilot(manifest, pilot, source_blend, temp_root, inspection, actual_version, manifest_path, generated_output_root)
        for pilot in manifest["pilots"]
    ]
    print(json.dumps({"status": "pass", "actors": summaries}, sort_keys=True))


if __name__ == "__main__":
    try:
        with exclusive_pipeline_lock(ROOT / ".tmp" / "hmh-production-hero-pipeline.lock", "HMH production hero pipeline"):
            main()
    except Exception as error:
        print(f"HMH production hero pilot failed: {error}", file=sys.stderr)
        raise
