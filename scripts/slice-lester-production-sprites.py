#!/usr/bin/env python
"""Slice Justin-provided Lester production sprite sheets into browser runtime frames.

Input lives in the user's Downloads folder so the original handoff files can be
kept unchanged. Output is deterministic and checked by tests.
"""

from __future__ import annotations

import json
import shutil
from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_CANDIDATE_DIRS = [
    Path.home() / "Downloads",
    Path.home() / "Desktop" / "My Stuff" / "Lester's Arcade" / "Hard Money Heroes" / "Art Assets" / "Lester",
]
OUT_DIR = ROOT / "apps" / "portal" / "assets" / "lester-production"
SOURCE_DIR = OUT_DIR / "source"
FRAMES_DIR = OUT_DIR / "frames"
STILLS_DIR = OUT_DIR / "stills"
MANIFEST_PATH = OUT_DIR / "lester-production-sprite-manifest.json"

GRID_COLUMNS = 5
GRID_ROWS = 5
SOURCE_FRAME_SIZE = 256
RUNTIME_FRAME_SIZE = 128
STILL_SIZE = 256

ANIMATION_SHEETS = {
    "idle": {
        "filename": "Lester-idle.png",
        "fps": 8,
        "loop": True,
        "notes": "Breathing/idle stance sheet from Justin.",
    },
    "walk": {
        "filename": "Lester-walk.png",
        "fps": 10,
        "loop": True,
        "notes": "Side-scrolling walk cycle sheet from Justin.",
    },
    "run": {
        "filename": "Lester-run.png",
        "fps": 14,
        "loop": True,
        "notes": "Side-scrolling run cycle sheet from Justin.",
    },
    "jump": {
        "filename": "Lester-jump.png",
        "fps": 12,
        "loop": False,
        "notes": "Jump arc/action sheet from Justin.",
    },
}

STILL_SHEETS = {
    "facing": "Lester-Facing.png",
    "leftSideProfile": "Lester-Left-SideProfile.png",
    "rightSideProfile": "Lester-Right-SideProfile.png",
    "facingShotgun": "Lester-Facing-Shotgun.png",
    "leftSideShotgun": "Lester-Left-Side-Shotgun.png",
    "rightSideShotgun": "Lester-Right-Side-Shotgun.png",
}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def ensure_dirs() -> None:
    for directory in (SOURCE_DIR, FRAMES_DIR, STILLS_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def copy_source(filename: str) -> Path:
    source = next((candidate / filename for candidate in SOURCE_CANDIDATE_DIRS if (candidate / filename).exists()), None)
    if source is None:
        searched = ', '.join(str(candidate / filename) for candidate in SOURCE_CANDIDATE_DIRS)
        raise FileNotFoundError(f"Missing Lester sprite source {filename}; searched: {searched}")
    target = SOURCE_DIR / filename
    shutil.copy2(source, target)
    return target


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.convert("RGBA").getchannel("A").getbbox()


def fit_to_canvas(image: Image.Image, size: int, bottom_pad: int = 6) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = alpha_bbox(rgba)
    if bbox:
        rgba = rgba.crop(bbox)
    max_w = size - 12
    max_h = size - 10
    rgba.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - rgba.width) // 2
    y = size - rgba.height - bottom_pad
    canvas.alpha_composite(rgba, (x, y))
    return canvas


def looks_like_edge_background(pixel: tuple[int, int, int, int], samples: list[tuple[int, int, int]]) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return True
    # Transparent-checker exports are RGB but very light gray/white at the edges.
    if min(r, g, b) >= 228 and max(r, g, b) - min(r, g, b) <= 18:
        return True
    for sr, sg, sb in samples:
        if abs(r - sr) + abs(g - sg) + abs(b - sb) <= 42:
            return True
    return False


def remove_connected_checker_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()

    border_samples: list[tuple[int, int, int]] = []
    for x in range(0, width, max(1, width // 24)):
        for y in (0, height - 1):
            r, g, b, _ = pixels[x, y]
            border_samples.append((r, g, b))
    for y in range(0, height, max(1, height // 24)):
        for x in (0, width - 1):
            r, g, b, _ = pixels[x, y]
            border_samples.append((r, g, b))

    queue: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def push(x: int, y: int) -> None:
        idx = y * width + x
        if visited[idx]:
            return
        visited[idx] = 1
        if looks_like_edge_background(pixels[x, y], border_samples):
            queue.append((x, y))

    for x in range(width):
        push(x, 0)
        push(x, height - 1)
    for y in range(height):
        push(0, y)
        push(width - 1, y)

    while queue:
        x, y = queue.popleft()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                push(nx, ny)

    return rgba


def slice_animation(state: str, config: dict[str, object]) -> dict[str, object]:
    source_path = copy_source(str(config["filename"]))
    sheet = Image.open(source_path).convert("RGBA")
    expected = (GRID_COLUMNS * SOURCE_FRAME_SIZE, GRID_ROWS * SOURCE_FRAME_SIZE)
    if sheet.size != expected:
        raise ValueError(f"{source_path.name} expected {expected[0]}x{expected[1]}, got {sheet.size[0]}x{sheet.size[1]}")

    state_dir = FRAMES_DIR / state
    state_dir.mkdir(parents=True, exist_ok=True)

    frames = []
    index = 0
    for row in range(GRID_ROWS):
        for column in range(GRID_COLUMNS):
            box = (
                column * SOURCE_FRAME_SIZE,
                row * SOURCE_FRAME_SIZE,
                (column + 1) * SOURCE_FRAME_SIZE,
                (row + 1) * SOURCE_FRAME_SIZE,
            )
            cell = sheet.crop(box)
            normalized = fit_to_canvas(cell, RUNTIME_FRAME_SIZE)
            frame_path = state_dir / f"lester-{state}-{index:02d}.png"
            normalized.save(frame_path)
            bbox = alpha_bbox(cell)
            frames.append(
                {
                    "index": index,
                    "src": rel(frame_path),
                    "grid": {"column": column, "row": row, "box": list(box)},
                    "sourceAlphaBounds": list(bbox) if bbox else None,
                    "size": [RUNTIME_FRAME_SIZE, RUNTIME_FRAME_SIZE],
                }
            )
            index += 1

    return {
        "source": rel(source_path),
        "fps": config["fps"],
        "loop": config["loop"],
        "notes": config["notes"],
        "frames": frames,
    }


def make_still(pose: str, filename: str) -> dict[str, object]:
    source_path = copy_source(filename)
    raw = Image.open(source_path)
    rgba = raw.convert("RGBA")
    if raw.mode == "RGB":
        rgba = remove_connected_checker_background(raw)
    normalized = fit_to_canvas(rgba, STILL_SIZE, bottom_pad=10)
    still_path = STILLS_DIR / f"lester-{pose.replace('Side', '-side').replace('Profile', '-profile').lower()}.png"
    still_path.name
    # normalize camelCase to dash-case more predictably
    dash_name = []
    for ch in pose:
        if ch.isupper():
            dash_name.append('-')
            dash_name.append(ch.lower())
        else:
            dash_name.append(ch)
    still_path = STILLS_DIR / f"lester-{''.join(dash_name)}.png"
    normalized.save(still_path)
    return {
        "source": rel(source_path),
        "src": rel(still_path),
        "size": [STILL_SIZE, STILL_SIZE],
        "sourceMode": raw.mode,
    }


def build_manifest() -> dict[str, object]:
    ensure_dirs()
    animations = {state: slice_animation(state, config) for state, config in ANIMATION_SHEETS.items()}
    stills = {pose: make_still(pose, filename) for pose, filename in STILL_SHEETS.items()}
    manifest = {
        "character": "Lester",
        "source": "Justin-provided production sprite sheets",
        "generatedBy": "scripts/slice-lester-production-sprites.py",
        "frameGrid": {
            "columns": GRID_COLUMNS,
            "rows": GRID_ROWS,
            "sourceFrameSize": {"width": SOURCE_FRAME_SIZE, "height": SOURCE_FRAME_SIZE},
            "runtimeFrameSize": {"width": RUNTIME_FRAME_SIZE, "height": RUNTIME_FRAME_SIZE},
        },
        "runtime": {
            "defaultFacing": "right",
            "anchor": "bottom-center",
            "drawSize": {"width": 104, "height": 104},
            "fallback": "apps/portal/assets/generated/sliced Lester frames",
        },
        "animations": animations,
        "stills": stills,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    manifest = build_manifest()
    frame_count = sum(len(animation["frames"]) for animation in manifest["animations"].values())
    print(
        f"Sliced Lester production sprites: {frame_count} frames, "
        f"{len(manifest['stills'])} stills -> {MANIFEST_PATH.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
