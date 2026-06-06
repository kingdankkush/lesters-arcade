#!/usr/bin/env python
"""Slice generated Hard Money Heroes concept sheets into browser-ready sprite assets.

The portal consumes small PNGs from apps/portal/assets/generated/sliced/ so the
runtime can load clean Lester frames, enemy frames, weapon/pickup icons,
achievement badges, and Level 1+ parallax layers without doing canvas cropping
in the browser.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, Tuple

from PIL import Image, ImageOps

REPO_ROOT = Path(__file__).resolve().parents[1]
GENERATED_DIR = REPO_ROOT / "apps" / "portal" / "assets" / "generated"
MANIFEST_PATH = GENERATED_DIR / "generated-asset-manifest.json"
REPORT_PATH = GENERATED_DIR / "sliced" / "asset-slice-report.json"

SPRITE_SIZE = (128, 128)
ICON_SIZE = (96, 96)
PARALLAX_SIZE = (1024, 256)
PARALLAX_Y_SLICES = {
    "sky": 0,
    "skyline": 96,
    "midground": 192,
    "street": 320,
}


def repo_path(path_string: str) -> Path:
    return REPO_ROOT / path_string


def open_rgba(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def centered_resize(crop: Image.Image, size: Tuple[int, int]) -> Image.Image:
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    resized = ImageOps.contain(crop, size, Image.Resampling.LANCZOS)
    x = (size[0] - resized.width) // 2
    y = (size[1] - resized.height) // 2
    result.alpha_composite(resized, (x, y))
    return result


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def slice_grid(group: Dict, output_size: Tuple[int, int]) -> Iterable[Dict]:
    source = open_rgba(GENERATED_DIR / group["source"])
    cols = int(group["cols"])
    rows = int(group["rows"])
    cell_w = source.width // cols
    cell_h = source.height // rows

    for index, (frame_id, output_path) in enumerate(group["frames"].items()):
        col = index % cols
        row = index // cols
        if row >= rows:
            raise ValueError(f"Frame {frame_id} exceeds {cols}x{rows} grid for {group['source']}")
        crop = source.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        output = repo_path(output_path)
        save_png(centered_resize(crop, output_size), output)
        yield {
            "id": frame_id,
            "source": group["source"],
            "output": output_path,
            "sourceBox": [col * cell_w, row * cell_h, cell_w, cell_h],
            "size": list(output_size),
        }


def slice_parallax(level_id: str, level: Dict) -> Iterable[Dict]:
    source = open_rgba(GENERATED_DIR / level["source"])
    for layer_id, output_path in level["layers"].items():
        y = PARALLAX_Y_SLICES[layer_id]
        crop = source.crop((0, y, min(source.width, PARALLAX_SIZE[0]), min(source.height, y + PARALLAX_SIZE[1])))
        layer = Image.new("RGBA", PARALLAX_SIZE, (0, 0, 0, 0))
        layer.alpha_composite(crop.resize(PARALLAX_SIZE, Image.Resampling.LANCZOS), (0, 0))
        output = repo_path(output_path)
        save_png(layer, output)
        yield {
            "id": f"{level_id}.{layer_id}",
            "source": level["source"],
            "output": output_path,
            "sourceBox": [0, y, source.width, min(PARALLAX_SIZE[1], source.height - y)],
            "size": list(PARALLAX_SIZE),
        }


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    generated = []

    for group in manifest["sprites"].values():
        generated.extend(slice_grid(group, SPRITE_SIZE))

    for group_id, group in manifest["icons"].items():
        size = ICON_SIZE
        generated.extend({**entry, "group": group_id} for entry in slice_grid(group, size))

    for level_id, level in manifest["parallaxLayers"].items():
        generated.extend(slice_parallax(level_id, level))

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps({
        "generatedCount": len(generated),
        "spriteSize": list(SPRITE_SIZE),
        "iconSize": list(ICON_SIZE),
        "parallaxSize": list(PARALLAX_SIZE),
        "assets": generated,
    }, indent=2), encoding="utf-8")

    print(json.dumps({
        "generatedCount": len(generated),
        "report": str(REPORT_PATH),
    }, indent=2))


if __name__ == "__main__":
    main()
