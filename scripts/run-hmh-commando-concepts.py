from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "apps" / "hmh-reboot" / "assets" / "source" / "blender" / "hmh-commando-concepts.json"
GENERATOR = ROOT / "scripts" / "hmh-blender" / "create-hmh-commando-concepts.py"
EXPECTED_BLENDER = "5.1.2"


def run(command: list[str], *, label: str) -> str:
    process = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    output = process.stdout + process.stderr
    if process.returncode != 0 or "Traceback (most recent call last)" in output:
        raise RuntimeError(f"{label} failed ({process.returncode})\n{output}")
    return output


def blender_executable() -> Path:
    configured = os.environ.get("BLENDER_EXECUTABLE", r"D:\Apps\Blender\blender.exe")
    path = Path(configured)
    if not path.is_file():
        raise FileNotFoundError(f"Blender executable not found: {path}")
    output = run([str(path), "--version"], label="Blender version probe")
    match = re.search(r"Blender\s+(\d+\.\d+\.\d+)", output)
    if not match or match.group(1) != EXPECTED_BLENDER:
        raise RuntimeError(f"Blender {EXPECTED_BLENDER} required, got {match.group(1) if match else output[:120]}")
    return path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def decoded_frame_hashes(directory: Path, expected_names: list[str]) -> dict[str, str]:
    actual_names = sorted(path.name for path in directory.glob("*.png"))
    if actual_names != sorted(expected_names):
        raise RuntimeError(json.dumps({
            "missing": sorted(set(expected_names) - set(actual_names)),
            "unexpected": sorted(set(actual_names) - set(expected_names)),
        }, indent=2))
    result = {}
    for name in expected_names:
        image = Image.open(directory / name).convert("RGBA")
        canonical = bytearray(image.tobytes())
        for index in range(0, len(canonical), 4):
            if canonical[index + 3] == 0:
                canonical[index] = 0
                canonical[index + 1] = 0
                canonical[index + 2] = 0
        result[name] = hashlib.sha256(canonical).hexdigest()
    return result


def compare_premultiplied_rgba(directory_a: Path, directory_b: Path, expected_names: list[str]) -> dict:
    per_frame = {}
    maxima = {
        "maxChangedVisiblePixels": 0,
        "maxChannelDelta": 0,
        "maxTotalChannelDelta": 0,
    }
    for name in expected_names:
        image_a = Image.open(directory_a / name).convert("RGBA")
        image_b = Image.open(directory_b / name).convert("RGBA")
        changed_visible = 0
        max_channel = 0
        total_delta = 0
        for pixel_a, pixel_b in zip(image_a.get_flattened_data(), image_b.get_flattened_data()):
            if pixel_a[3] == 0 and pixel_b[3] == 0:
                continue
            premultiplied_a = tuple(round(channel * pixel_a[3] / 255) for channel in pixel_a[:3]) + (pixel_a[3],)
            premultiplied_b = tuple(round(channel * pixel_b[3] / 255) for channel in pixel_b[:3]) + (pixel_b[3],)
            deltas = [abs(value_a - value_b) for value_a, value_b in zip(premultiplied_a, premultiplied_b)]
            if any(deltas):
                changed_visible += 1
                max_channel = max(max_channel, max(deltas))
                total_delta += sum(deltas)
        per_frame[name] = {
            "changedVisiblePixels": changed_visible,
            "maxChannelDelta": max_channel,
            "totalChannelDelta": total_delta,
        }
        maxima["maxChangedVisiblePixels"] = max(maxima["maxChangedVisiblePixels"], changed_visible)
        maxima["maxChannelDelta"] = max(maxima["maxChannelDelta"], max_channel)
        maxima["maxTotalChannelDelta"] = max(maxima["maxTotalChannelDelta"], total_delta)
    return {"maxima": maxima, "perFrame": per_frame}


def inspect_frames(directory: Path, expected_names: list[str]) -> dict:
    empty = []
    clipped = []
    alpha_bounds = {}
    for name in expected_names:
        image = Image.open(directory / name).convert("RGBA")
        if image.size != (256, 256):
            raise RuntimeError(f"{name} has unexpected size {image.size}")
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if bbox is None:
            empty.append(name)
            continue
        alpha_bounds[name] = list(bbox)
        corners = [alpha.getpixel((0, 0)), alpha.getpixel((255, 0)), alpha.getpixel((0, 255)), alpha.getpixel((255, 255))]
        if any(value > 8 for value in corners):
            clipped.append(name)
    return {
        "emptyFrames": empty,
        "transparentCornerFailures": clipped,
        "alphaBounds": alpha_bounds,
    }


def font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def checker(draw: ImageDraw.ImageDraw, bounds: tuple[int, int, int, int], size: int = 16):
    left, top, right, bottom = bounds
    colors = ((22, 30, 54, 255), (34, 45, 76, 255))
    for y in range(top, bottom, size):
        for x in range(left, right, size):
            color = colors[((x - left) // size + (y - top) // size) % 2]
            draw.rectangle((x, y, min(x + size - 1, right - 1), min(y + size - 1, bottom - 1)), fill=color)


def build_contact_sheet(manifest: dict, raw_directory: Path, output: Path):
    cell = 256
    label_width = 250
    header = 108
    footer = 54
    concepts = [(actor, variant) for actor in manifest["actors"] for variant in actor["variants"]]
    width = label_width + cell * len(manifest["directions"])
    height = header + cell * len(concepts) + footer
    sheet = Image.new("RGBA", (width, height), (8, 12, 26, 255))
    draw = ImageDraw.Draw(sheet)
    title_font = font(23)
    header_font = font(16)
    label_font = font(15)
    small_font = font(11)
    draw.text((18, 16), "HMH REBOOT / STARTER COMMANDO CONCEPT GATE", fill=(241, 211, 122, 255), font=title_font)
    draw.text((18, 52), "CONCEPT REVIEW ONLY | SHARED HUMAN-MEDIUM GAMEPLAY BODY | REPOSITORY-OWNED BLENDER 5.1.2", fill=(158, 179, 220, 255), font=small_font)
    for column, direction in enumerate(manifest["directions"]):
        x = label_width + column * cell
        draw.text((x + 88, 79), direction.upper(), fill=(232, 236, 242, 255), font=header_font)

    row = 0
    for actor, variant in concepts:
        top = header + row * cell
        family_color = (140, 183, 255, 255) if actor["id"] == "lit-commando" else (127, 232, 201, 255)
        draw.rectangle((0, top, label_width - 1, top + cell - 1), fill=(14, 20, 38, 255), outline=(43, 58, 92, 255))
        draw.text((16, top + 18), actor["displayName"].upper(), fill=family_color, font=small_font)
        draw.text((16, top + 47), variant["displayName"], fill=(248, 251, 255, 255), font=label_font)
        draw.text((16, top + 78), variant["id"], fill=(158, 179, 220, 255), font=small_font)
        cue_y = top + 112
        for cue in variant["silhouette"]:
            draw.text((16, cue_y), f"- {cue}", fill=(201, 210, 225, 255), font=small_font)
            cue_y += 25
        draw.text((16, top + 222), "socket: weapon_socket", fill=(201, 163, 78, 255), font=small_font)

        for column, direction in enumerate(manifest["directions"]):
            left = label_width + column * cell
            checker(draw, (left, top, left + cell, top + cell))
            image = Image.open(raw_directory / f"{actor['id']}__{variant['id']}__{direction}.png").convert("RGBA")
            sheet.alpha_composite(image, (left, top))
            draw.rectangle((left, top, left + cell - 1, top + cell - 1), outline=(43, 58, 92, 255))
        row += 1

    footer_y = header + cell * len(concepts)
    draw.text((18, footer_y + 18), "Gate: choose one male and one female direction before production animation. Artwork has no gameplay authority.", fill=(180, 191, 214, 255), font=small_font)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output, format="PNG", optimize=False, compress_level=9)


def render_pass(blender: Path, manifest: dict, run_name: str, source_blend: Path):
    raw = ROOT / ".tmp" / "hmh-reboot-commando-concepts" / run_name / "raw"
    inspection = ROOT / ".tmp" / "hmh-reboot-commando-concepts" / run_name / "inspection.json"
    if raw.parent.exists():
        shutil.rmtree(raw.parent)
    raw.mkdir(parents=True, exist_ok=True)
    command = [
        str(blender),
        "--background",
        "--factory-startup",
        "--python",
        str(GENERATOR),
        "--",
        "--manifest",
        str(MANIFEST_PATH),
        "--raw-output",
        str(raw),
        "--source-blend",
        str(source_blend),
        "--inspection-output",
        str(inspection),
    ]
    run(command, label=f"commando concept render {run_name}")
    return raw, json.loads(inspection.read_text(encoding="utf-8"))


def main():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    blender = blender_executable()
    canonical_blend = ROOT / manifest["scene"]["sourceBlend"]
    comparison_blend = ROOT / ".tmp" / "hmh-reboot-commando-concepts" / "comparison.blend"
    expected_names = [
        f"{actor['id']}__{variant['id']}__{direction}.png"
        for actor in manifest["actors"]
        for variant in actor["variants"]
        for direction in manifest["directions"]
    ]

    raw_a, inspection_a = render_pass(blender, manifest, "run-a", canonical_blend)
    hashes_a = decoded_frame_hashes(raw_a, expected_names)
    frame_inspection = inspect_frames(raw_a, expected_names)
    raw_b, inspection_b = render_pass(blender, manifest, "run-b", comparison_blend)
    hashes_b = decoded_frame_hashes(raw_b, expected_names)

    reproducibility = compare_premultiplied_rgba(raw_a, raw_b, expected_names)
    reproducibility_budget = {
        "maxChangedVisiblePixels": 8,
        "maxChannelDelta": 2,
        "maxTotalChannelDelta": 32,
    }
    exceeded = {
        key: {"observed": reproducibility["maxima"][key], "budget": budget}
        for key, budget in reproducibility_budget.items()
        if reproducibility["maxima"][key] > budget
    }
    if exceeded:
        raise RuntimeError(f"visible render reproducibility exceeded budget: {json.dumps(exceeded, indent=2)}")
    if frame_inspection["emptyFrames"] or frame_inspection["transparentCornerFailures"]:
        raise RuntimeError(json.dumps(frame_inspection, indent=2))
    if len(set(hashes_a.values())) != len(expected_names):
        raise RuntimeError("concept evidence contains duplicate decoded frames")
    if inspection_a["externalDependencyCount"] or inspection_b["externalDependencyCount"]:
        raise RuntimeError("concept source scene has external dependencies")
    if not inspection_a["weaponSocket"] or not inspection_b["weaponSocket"]:
        raise RuntimeError("concept source scene is missing weapon_socket")

    contact_sheet = ROOT / manifest["output"]["contactSheet"]
    metrics_path = ROOT / manifest["output"]["metrics"]
    build_contact_sheet(manifest, raw_a, contact_sheet)
    metrics = {
        "schema": "hmh-reboot-commando-concept-metrics-v1",
        "status": "pass",
        "pipelineId": manifest["pipelineId"],
        "runtimeClassification": manifest["runtimeClassification"],
        "gameplayBodyProfile": manifest["gameplayBodyProfile"],
        "conceptCount": sum(len(actor["variants"]) for actor in manifest["actors"]),
        "directionCount": len(manifest["directions"]),
        "renderCount": len(expected_names),
        "reproducibility": "pass",
        "reproducibilityMode": "bounded-premultiplied-rgba-v1",
        "reproducibilityBudget": reproducibility_budget,
        "reproducibilityObserved": reproducibility["maxima"],
        "rawFrameSetSha256": hashlib.sha256("".join(hashes_a[name] for name in sorted(expected_names)).encode("ascii")).hexdigest(),
        "uniqueDecodedFrameCount": len(set(hashes_a.values())),
        "emptyFrameCount": len(frame_inspection["emptyFrames"]),
        "transparentCornerFailureCount": len(frame_inspection["transparentCornerFailures"]),
        "externalDependencyCount": inspection_a["externalDependencyCount"],
        "armature": inspection_a["armature"],
        "boneCount": len(inspection_a["bones"]),
        "weaponSocket": inspection_a["weaponSocket"],
        "sourceBlendSha256": sha256(canonical_blend),
        "contactSheetSha256": sha256(contact_sheet),
    }
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_bytes((json.dumps(metrics, indent=2) + "\n").encode("utf-8"))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"HMH commando concept pipeline failed: {error}", file=sys.stderr)
        raise
