#!/usr/bin/env python3
"""Remove accidental solid/fake backgrounds from HMH level-design sprites.

PixelLab occasionally returns opaque PNGs even when a sprite prompt asks for a
transparent background. This script scans level-design sprite folders, preserves
canvas sizes, skips intentional full-canvas terrain/background assets, and clears
only border-connected bright/white background pixels plus their light halo.

The cleanup is intentionally conservative: it does not crop, it does not touch
parallax backgrounds or terrain tile sheets, and it leaves dark/colored art that
is connected to the border alone unless it matches the bright background test.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, deque
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
GENERATED_ROOT = REPO_ROOT / "apps" / "portal" / "assets" / "generated"

# Runtime/level-design sprite scopes. Backgrounds, parallax layers, and tile kits
# are deliberately excluded below even if they live under these top-level roots.
INCLUDE_PREFIXES = (
    "hmh-coherent-world/",
    "hmh-level-environment/prop/",
    "hmh-level-environment/decor/",
    "hmh-environment-pixellab-wave-2/static_map_object/",
    "hmh-environment-pixellab-wave-2/animated_object_base/",
    "hmh-environment-pixellab-wave-2/object_animation/",
    "hmh-expanded-pixel-pack/props/",
)

SKIP_PARTS = {
    "contact-sheets",
    "parallax-bg",
    "parallax_bg",
    "background",
    "backgrounds",
    "tiles_pro",
    "isometric_tile",
    "tile",
    "tiles",
    "terrain",
}

# These are full-canvas coherent-world terrain pieces. They are supposed to be
# rectangular opaque tiles and should not be cut out as sprites.
FULL_CANVAS_TILE_NAMES = {
    "road-crossroad.png",
    "shoreline-water-edge.png",
}

ALPHA_CLEAR = 8
OPAQUE = 220


@dataclass
class Result:
    relpath: str
    action: str
    width: int
    height: int
    transparent_before_pct: float
    transparent_after_pct: float
    cleared_pixels: int = 0
    bright_edge_pct: float = 0.0
    edge_transparent_pct: float = 0.0
    reason: str = ""


def rel_for(path: Path) -> str:
    return path.relative_to(GENERATED_ROOT).as_posix()


def in_scope(path: Path) -> bool:
    rel = rel_for(path)
    lower = rel.lower()
    parts = set(lower.split("/"))
    if path.name in FULL_CANVAS_TILE_NAMES:
        return True  # report as skipped-full-canvas-tile
    if parts & SKIP_PARTS:
        return False
    return lower.startswith(INCLUDE_PREFIXES)


def iter_assets(paths: Iterable[str] | None = None) -> Iterable[Path]:
    if paths:
        for raw in paths:
            p = Path(raw)
            if not p.is_absolute():
                p = REPO_ROOT / p
            if p.is_file() and p.suffix.lower() == ".png":
                yield p
        return
    for path in sorted(GENERATED_ROOT.rglob("*.png")):
        if in_scope(path):
            yield path


def is_full_canvas_tile(path: Path) -> bool:
    return path.name in FULL_CANVAS_TILE_NAMES


def alpha_stats(image: Image.Image) -> tuple[float, float]:
    alpha = image.getchannel("A")
    hist = alpha.histogram()
    total = image.width * image.height
    transparent = sum(hist[:ALPHA_CLEAR]) / total * 100
    return transparent, hist[255] / total * 100


def edge_pixels(image: Image.Image) -> list[tuple[int, int, int, int]]:
    px = image.load()
    width, height = image.size
    edge: list[tuple[int, int, int, int]] = []
    for x in range(width):
        edge.append(px[x, 0])
        edge.append(px[x, height - 1])
    for y in range(height):
        edge.append(px[0, y])
        edge.append(px[width - 1, y])
    return edge


def is_bright_bg(rgb: tuple[int, int, int]) -> bool:
    """True for white/light gray PixelLab backgrounds, not saturated art."""
    r, g, b = rgb
    avg = (r + g + b) / 3
    spread = max(rgb) - min(rgb)
    return avg >= 218 and min(rgb) >= 185 and spread <= 58


def color_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def bg_seed_colors(edge: list[tuple[int, int, int, int]]) -> list[tuple[int, int, int]]:
    bright = [(r, g, b) for r, g, b, a in edge if a >= OPAQUE and is_bright_bg((r, g, b))]
    counts = Counter(bright)
    # Include the main light tones and nearby anti-aliased light grays.
    return [color for color, count in counts.most_common(24) if count >= 2]


def should_clear(pixel: tuple[int, int, int, int], seeds: list[tuple[int, int, int]]) -> bool:
    r, g, b, a = pixel
    if a < ALPHA_CLEAR:
        return False
    rgb = (r, g, b)
    if is_bright_bg(rgb):
        return True
    # Catch off-white anti-alias pixels around the matte, while avoiding road,
    # rock, wood, smoke, and other real art tones.
    if min(rgb) >= 175 and seeds and min(color_dist(rgb, seed) for seed in seeds) <= 72:
        return True
    return False


def find_border_background_mask(image: Image.Image, seeds: list[tuple[int, int, int]]) -> set[tuple[int, int]]:
    if not seeds:
        return set()

    width, height = image.size
    px = image.load()
    queue: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()

    def maybe_add(x: int, y: int) -> None:
        key = (x, y)
        if key in seen:
            return
        if should_clear(px[x, y], seeds):
            seen.add(key)
            queue.append(key)

    for x in range(width):
        maybe_add(x, 0)
        maybe_add(x, height - 1)
    for y in range(height):
        maybe_add(0, y)
        maybe_add(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                maybe_add(nx, ny)
    return seen


def add_light_halo(mask: set[tuple[int, int]], image: Image.Image, seeds: list[tuple[int, int, int]], passes: int = 2) -> set[tuple[int, int]]:
    width, height = image.size
    px = image.load()
    expanded = set(mask)
    frontier = set(mask)
    for _ in range(passes):
        new: set[tuple[int, int]] = set()
        for x, y in frontier:
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < width and 0 <= ny < height) or (nx, ny) in expanded:
                    continue
                if should_clear(px[nx, ny], seeds):
                    new.add((nx, ny))
        expanded.update(new)
        frontier = new
        if not frontier:
            break
    return expanded


def clean_image(path: Path, *, dry_run: bool) -> Result:
    rel = rel_for(path)
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    transparent_before, _opaque_before = alpha_stats(image)
    edge = edge_pixels(image)
    edge_transparent_pct = sum(1 for p in edge if p[3] < ALPHA_CLEAR) / len(edge) * 100
    bright_edge_pct = sum(1 for r, g, b, a in edge if a >= OPAQUE and is_bright_bg((r, g, b))) / len(edge) * 100

    if is_full_canvas_tile(path):
        return Result(rel, "skipped-full-canvas-tile", width, height, transparent_before, transparent_before, 0, bright_edge_pct, edge_transparent_pct)

    seeds = bg_seed_colors(edge)
    if not seeds:
        return Result(rel, "unchanged", width, height, transparent_before, transparent_before, 0, bright_edge_pct, edge_transparent_pct, "no-bright-border-background")

    # Require a meaningful bright matte on the border. This avoids cutting real
    # object pixels that merely have a small white highlight near transparency.
    if bright_edge_pct < 12 and transparent_before >= 1:
        return Result(rel, "unchanged", width, height, transparent_before, transparent_before, 0, bright_edge_pct, edge_transparent_pct, "already-transparent-or-no-matte")

    mask = find_border_background_mask(image, seeds)
    mask = add_light_halo(mask, image, seeds)

    if not mask:
        return Result(rel, "unchanged", width, height, transparent_before, transparent_before, 0, bright_edge_pct, edge_transparent_pct, "no-connected-background")

    # Conservative damage guard: accidental mattes in these assets are large, but
    # clearing most of an image probably means it was actually a tile/background.
    cleared_pct = len(mask) / (width * height) * 100
    if cleared_pct > 82:
        return Result(rel, "skipped-damage-guard", width, height, transparent_before, transparent_before, len(mask), bright_edge_pct, edge_transparent_pct, f"would-clear-{cleared_pct:.1f}%")

    out = image.copy()
    px = out.load()
    for x, y in mask:
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)

    transparent_after, _opaque_after = alpha_stats(out)
    if not dry_run:
        out.save(path, optimize=True)

    return Result(rel, "would-clean" if dry_run else "cleaned", width, height, transparent_before, transparent_after, len(mask), bright_edge_pct, edge_transparent_pct)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", help="Optional PNG paths to process instead of the default level-design sprite scope.")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing files.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON summary.")
    args = parser.parse_args()

    results = [clean_image(path, dry_run=args.dry_run) for path in iter_assets(args.paths)]
    summary = Counter(result.action for result in results)
    changed = [asdict(result) for result in results if result.action in {"cleaned", "would-clean", "skipped-damage-guard", "skipped-full-canvas-tile"}]

    if args.json:
        print(json.dumps({"summary": dict(summary), "interesting": changed}, indent=2))
    else:
        print("HMH level-design alpha cleanup")
        for action, count in sorted(summary.items()):
            print(f"  {action}: {count}")
        for result in results:
            if result.action in {"cleaned", "would-clean", "skipped-damage-guard", "skipped-full-canvas-tile"}:
                print(
                    f"  {result.action}: {result.relpath} "
                    f"T {result.transparent_before_pct:.1f}% -> {result.transparent_after_pct:.1f}% "
                    f"cleared={result.cleared_pixels} brightEdge={result.bright_edge_pct:.1f}%"
                )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
