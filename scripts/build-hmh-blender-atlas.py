from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "apps" / "hmh-reboot" / "assets" / "source" / "blender" / "hmh-character-pipeline.json"
MASTER_PALETTE = (
    "#173B72", "#345D9D", "#4E82D8", "#8CB7FF",
    "#E8ECF2", "#C9D2DE", "#A8B4C4", "#5C6B80", "#2E3A4D",
    "#F1D37A", "#C9A34E", "#8C6724", "#4A3514",
    "#C9FF6A", "#7FE84A", "#3FAE3B", "#1F5C2E",
    "#FF78D1", "#E040A0", "#992B78", "#4B1844",
    "#0B0E1A", "#10162A", "#1A2138", "#2B3A5C",
    "#F0E66A", "#D4B830", "#9C7D16", "#4B3A0B",
    "#FFE29A", "#FF9B3D", "#E34A2E", "#7A1414",
    "#A01828", "#5A0B16", "#151515", "#3A342F",
    "#F8FBFF", "#C7D0E0", "#6F7B91", "#11151F",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--repo-root", default=str(ROOT))
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def next_power_of_two(value: int) -> int:
    if value <= 1:
        return 1
    return 1 << (value - 1).bit_length()


def expected_frames(manifest: dict) -> list[dict]:
    frames = []
    for layer, states in manifest["clips"].items():
        for state, budget in states.items():
            for direction in manifest["directions"]:
                for frame_index in range(budget["frames"]):
                    frame_id = f"{manifest['actor']['id']}__{layer}__{state}__{direction}__{frame_index:03d}"
                    frames.append({
                        "id": frame_id,
                        "layer": layer,
                        "state": state,
                        "direction": direction,
                        "frameIndex": frame_index,
                        "fps": budget["fps"],
                    })
    return frames


def threshold_bbox(image: Image.Image, threshold: int, source_pivot: tuple[int, int]) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        return None
    left, top, right, bottom = bbox
    pivot_x, pivot_y = source_pivot
    left = min(left, pivot_x)
    top = min(top, pivot_y)
    right = max(right, pivot_x + 1)
    bottom = max(bottom, pivot_y + 1)
    return left, top, right, bottom


def opaque_pixels(image: Image.Image, threshold: int) -> int:
    return sum(1 for value in image.getchannel("A").get_flattened_data() if value > threshold)


def mean_alpha(image: Image.Image, threshold: int) -> float:
    values = [value for value in image.getchannel("A").get_flattened_data() if value > threshold]
    return sum(values) / len(values) if values else 0


def corner_failure(image: Image.Image, threshold: int) -> bool:
    alpha = image.getchannel("A")
    points = [(0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1)]
    return any(alpha.getpixel(point) > threshold for point in points)


def palette_ratio(image: Image.Image, threshold: int, distance_threshold: float) -> float:
    palette = [tuple(int(value[index : index + 2], 16) for index in (1, 3, 5)) for value in MASTER_PALETTE]
    opaque = 0
    off_palette = 0
    for r, g, b, a in image.get_flattened_data():
        if a <= threshold:
            continue
        opaque += 1
        nearest = min(math.dist((r, g, b), swatch) for swatch in palette)
        if nearest > distance_threshold:
            off_palette += 1
    return off_palette / opaque if opaque else 1.0


def pack_frames(frames: list[dict], padding: int, max_size: int) -> tuple[int, dict[str, tuple[int, int]]]:
    total_area = sum((frame["crop"].width + padding) * (frame["crop"].height + padding) for frame in frames)
    size = next_power_of_two(max(256, math.ceil(math.sqrt(total_area))))
    while size <= max_size:
        x = padding
        y = padding
        row_height = 0
        positions: dict[str, tuple[int, int]] = {}
        fits = True
        for item in frames:
            image = item["crop"]
            if x + image.width + padding > size:
                x = padding
                y += row_height + padding
                row_height = 0
            if y + image.height + padding > size:
                fits = False
                break
            positions[item["id"]] = (x, y)
            x += image.width + padding
            row_height = max(row_height, image.height)
        if fits:
            return size, positions
        size *= 2
    raise RuntimeError(f"atlas exceeds {max_size}x{max_size}")


def composite(raw: dict[str, Image.Image], manifest: dict, direction: str, lower_state: str, lower_frame: int) -> Image.Image:
    actor = manifest["actor"]["id"]
    result = Image.new("RGBA", tuple(manifest["render"]["frameSize"]), (0, 0, 0, 0))
    ids = [
        f"{actor}__shadow__idle__{direction}__000",
        f"{actor}__lower-body__{lower_state}__{direction}__{lower_frame:03d}",
        f"{actor}__torso-head__aim__{direction}__000",
        f"{actor}__weapon__aim__{direction}__000",
    ]
    for frame_id in ids:
        result.alpha_composite(raw[frame_id])
    return result


def contact_sheet(raw: dict[str, Image.Image], manifest: dict) -> Image.Image:
    directions = manifest["directions"]
    cell = 128
    label_width = 104
    header = 30
    row_specs = [
        ("COMPOSITE IDLE", lambda direction: composite(raw, manifest, direction, "idle", 0)),
        ("COMPOSITE RUN 0", lambda direction: composite(raw, manifest, direction, "run", 0)),
        ("COMPOSITE RUN 1", lambda direction: composite(raw, manifest, direction, "run", 1)),
        ("COMPOSITE RUN 2", lambda direction: composite(raw, manifest, direction, "run", 2)),
        ("COMPOSITE RUN 3", lambda direction: composite(raw, manifest, direction, "run", 3)),
        ("SHADOW", lambda direction: raw[f"{manifest['actor']['id']}__shadow__idle__{direction}__000"]),
        ("LOWER RUN", lambda direction: raw[f"{manifest['actor']['id']}__lower-body__run__{direction}__000"]),
        ("TORSO AIM", lambda direction: raw[f"{manifest['actor']['id']}__torso-head__aim__{direction}__000"]),
        ("WEAPON AIM", lambda direction: raw[f"{manifest['actor']['id']}__weapon__aim__{direction}__000"]),
        ("MOBILE 50%", lambda direction: composite(raw, manifest, direction, "run", 0).resize((64, 64), Image.Resampling.LANCZOS)),
    ]
    sheet = Image.new("RGBA", (label_width + cell * len(directions), header + cell * len(row_specs)), (11, 14, 26, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, direction in enumerate(directions):
        draw.text((label_width + index * cell + 4, 8), direction.upper(), fill=(232, 236, 242, 255), font=font)
    for row, (label, producer) in enumerate(row_specs):
        y = header + row * cell
        draw.text((6, y + 8), label, fill=(241, 211, 122, 255), font=font)
        for column, direction in enumerate(directions):
            frame = producer(direction)
            x = label_width + column * cell
            checker_size = 16
            for checker_y in range(y, y + cell, checker_size):
                for checker_x in range(x, x + cell, checker_size):
                    checker_index = ((checker_x - x) // checker_size + (checker_y - y) // checker_size) % 2
                    fill = (26, 33, 56, 255) if checker_index == 0 else (43, 58, 92, 255)
                    draw.rectangle((checker_x, checker_y, min(checker_x + checker_size - 1, x + cell - 1), min(checker_y + checker_size - 1, y + cell - 1)), fill=fill)
            px = x + (cell - frame.width) // 2
            py = y + (cell - frame.height) // 2
            sheet.alpha_composite(frame, (px, py))
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), outline=(43, 58, 92, 255), width=1)
    return sheet


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw_dir = repo_root / manifest["render"]["rawOutputDirectory"]
    output_dir = repo_root / manifest["atlas"]["outputDirectory"]
    output_dir.mkdir(parents=True, exist_ok=True)
    expected = expected_frames(manifest)
    expected_ids = [entry["id"] for entry in expected]
    actual_paths = {path.stem: path for path in sorted(raw_dir.glob("*.png"))}
    missing = sorted(set(expected_ids) - set(actual_paths))
    unexpected = sorted(set(actual_paths) - set(expected_ids))
    if missing or unexpected:
        raise RuntimeError(json.dumps({"missing": missing, "unexpected": unexpected}, indent=2))

    alpha_threshold = manifest["render"]["alphaThreshold"]
    source_pivot = tuple(manifest["pivot"]["sourcePixels"])
    raw: dict[str, Image.Image] = {}
    packed: list[dict] = []
    transparent_corner_failures = 0
    empty_frame_failures = 0
    off_palette_ratios = []
    for entry in expected:
        image = Image.open(actual_paths[entry["id"]]).convert("RGBA")
        raw[entry["id"]] = image.copy()
        transparent_corner_failures += int(corner_failure(image, alpha_threshold))
        bbox = threshold_bbox(image, alpha_threshold, source_pivot)
        if bbox is None:
            empty_frame_failures += 1
            continue
        crop = image.crop(bbox)
        count = opaque_pixels(image, alpha_threshold)
        off_palette_ratios.append(palette_ratio(image, alpha_threshold, manifest["qa"]["paletteDistanceThreshold"]))
        packed.append({
            **entry,
            "rawPath": actual_paths[entry["id"]],
            "sourcePixelSha256": sha256_bytes(image.tobytes()),
            "crop": crop,
            "bbox": bbox,
            "opaquePixels": count,
            "meanAlpha": mean_alpha(image, alpha_threshold),
        })

    if empty_frame_failures:
        raise RuntimeError(f"{empty_frame_failures} empty frame(s)")
    size, positions = pack_frames(packed, manifest["atlas"]["padding"], manifest["atlas"]["maxSize"])
    atlas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    frame_records = []
    for item in packed:
        x, y = positions[item["id"]]
        crop = item["crop"]
        left, top, right, bottom = item["bbox"]
        pivot_x = source_pivot[0] - left
        pivot_y = source_pivot[1] - top
        atlas.alpha_composite(crop, (x, y))
        frame_records.append({
            "id": item["id"],
            "layer": item["layer"],
            "state": item["state"],
            "direction": item["direction"],
            "frameIndex": item["frameIndex"],
            "fps": item["fps"],
            "frame": {"x": x, "y": y, "w": crop.width, "h": crop.height},
            "rotated": False,
            "trimmed": True,
            "sourceSize": {"w": manifest["render"]["frameSize"][0], "h": manifest["render"]["frameSize"][1]},
            "spriteSourceSize": {"x": left, "y": top, "w": right - left, "h": bottom - top},
            "sourcePivot": {"x": source_pivot[0], "y": source_pivot[1]},
            "pivot": {"x": pivot_x, "y": pivot_y},
            "anchor": {"x": round(pivot_x / crop.width, 6), "y": round(pivot_y / crop.height, 6)},
            "opaquePixels": item["opaquePixels"],
            "meanAlpha": round(item["meanAlpha"], 3),
            "sourcePixelSha256": item["sourcePixelSha256"],
        })

    atlas_path = output_dir / manifest["atlas"]["image"]
    atlas.save(atlas_path, format="PNG", optimize=False, compress_level=9)
    blend_path = repo_root / manifest["scene"]["sourceBlend"]
    metadata = {
        "schemaVersion": 1,
        "pipelineId": manifest["id"],
        "actorId": manifest["actor"]["id"],
        "classification": manifest["actor"]["classification"],
        "image": f"./{manifest['atlas']['image']}",
        "directions": manifest["directions"],
        "layers": [layer["id"] for layer in manifest["layers"]],
        "composition": manifest["composition"],
        "frames": frame_records,
        "meta": {
            "format": "RGBA8888",
            "size": {"width": size, "height": size},
            "scale": 1,
            "padding": manifest["atlas"]["padding"],
            "sourceBlend": manifest["scene"]["sourceBlend"],
            "sourceBlendSha256": sha256(blend_path),
        },
    }
    metadata_path = output_dir / manifest["atlas"]["metadata"]
    metadata_path.write_bytes((json.dumps(metadata, indent=2) + "\n").encode("utf-8"))

    sheet = contact_sheet(raw, manifest)
    contact_path = output_dir / manifest["atlas"]["contactSheet"]
    sheet.convert("RGB").save(contact_path, format="PNG", optimize=False, compress_level=9)

    max_off_palette_ratio = max(off_palette_ratios, default=0)
    off_palette_failure = max_off_palette_ratio > manifest["qa"]["maxOffPaletteRatio"]
    min_opaque_pixels_by_layer = {
        layer["id"]: min(record["opaquePixels"] for record in frame_records if record["layer"] == layer["id"])
        for layer in manifest["layers"]
    }
    mean_alpha_by_layer = {
        layer["id"]: round(
            sum(record["meanAlpha"] for record in frame_records if record["layer"] == layer["id"])
            / len([record for record in frame_records if record["layer"] == layer["id"]]),
            3,
        )
        for layer in manifest["layers"]
    }
    shadow_alpha_failure = not (
        manifest["qa"]["shadowMeanAlphaMin"]
        <= mean_alpha_by_layer["shadow"]
        <= manifest["qa"]["shadowMeanAlphaMax"]
    )
    metrics = {
        "schemaVersion": 1,
        "pipelineId": manifest["id"],
        "status": "pass" if not (missing or unexpected or transparent_corner_failures or empty_frame_failures or off_palette_failure or shadow_alpha_failure) else "fail",
        "classification": manifest["actor"]["classification"],
        "frameCount": len(frame_records),
        "missingFrames": missing,
        "unexpectedFrames": unexpected,
        "maxPivotVariancePx": 0,
        "transparentCornerFailures": transparent_corner_failures,
        "emptyFrameFailures": empty_frame_failures,
        "minOpaquePixelsByLayer": min_opaque_pixels_by_layer,
        "meanAlphaByLayer": mean_alpha_by_layer,
        "maxFrameWidth": max(record["frame"]["w"] for record in frame_records),
        "maxFrameHeight": max(record["frame"]["h"] for record in frame_records),
        "maxOffPaletteRatio": round(max_off_palette_ratio, 6),
        "maxOffPaletteRatioBudget": manifest["qa"]["maxOffPaletteRatio"],
        "sourceBlendSha256": sha256(blend_path),
        "atlasSha256": sha256(atlas_path),
        "metadataSha256": sha256(metadata_path),
        "rawFrameSetSha256": sha256_bytes("".join(record["sourcePixelSha256"] for record in frame_records).encode("ascii")),
        "atlasSize": {"width": size, "height": size},
        "contactSheet": f"./{manifest['atlas']['contactSheet']}",
    }
    metrics_path = output_dir / manifest["atlas"]["metrics"]
    metrics_path.write_bytes((json.dumps(metrics, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({
        "status": metrics["status"],
        "frameCount": metrics["frameCount"],
        "atlasSize": metrics["atlasSize"],
        "atlasSha256": metrics["atlasSha256"],
        "maxOffPaletteRatio": metrics["maxOffPaletteRatio"],
        "output": str(output_dir),
    }))


if __name__ == "__main__":
    main()
