#!/usr/bin/env python3
"""Remove solid/fake-transparent PixelLab backgrounds from HMH coherent-world PNGs.

PixelLab sometimes returns an RGB/opaque PNG even when the prompt asks for a
transparent background. This utility preserves the original canvas size and
flood-fills only border-connected background pixels to alpha=0, so runtime
placement/collision math can keep using stable source dimensions.

By default it cleans the Crypto Wasteland sprite/overlay sets and skips the
few full-canvas terrain tiles that intentionally occupy the whole square.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, deque
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-coherent-world"
DEFAULT_SETS = ("crypto", "crypto-wasteland")

# These read as full-canvas terrain tiles instead of cut-out props/overlays.
# Keeping them opaque avoids cutting away sidewalks/water/sand that are meant to
# reach the image edge. Pass --include-full-tiles to override.
FULL_CANVAS_TILE_SLUGS = {
    "road-crossroad",
    "shoreline-water-edge",
}


def edge_coordinates(width: int, height: int) -> Iterable[tuple[int, int]]:
    for x in range(width):
        yield x, 0
        yield x, height - 1
    for y in range(height):
        yield 0, y
        yield width - 1, y


def max_channel_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))


def neutralish(rgb: tuple[int, int, int]) -> bool:
    """True for likely paper/checkerboard/fake alpha colors."""

    spread = max(rgb) - min(rgb)
    return (spread <= 45 and (max(rgb) >= 185 or min(rgb) >= 170)) or (
        min(rgb) >= 205 and spread <= 70
    )


def threshold_for_slug(slug: str) -> int:
    if slug in {"road-straight", "road-tjunction"}:
        return 42
    if slug.startswith("ground-") or slug == "road-cap-end":
        return 38
    return 34


def alpha_stats(image: Image.Image) -> dict[str, float | int]:
    alpha = image.getchannel("A")
    hist = alpha.histogram()
    total = image.width * image.height
    transparent = sum(hist[:8])
    semi = sum(hist[8:255])
    opaque = hist[255]
    return {
        "transparent_pct": round(100 * transparent / total, 2),
        "semi_pct": round(100 * semi / total, 2),
        "opaque_pct": round(100 * opaque / total, 2),
        "alpha_min": min(i for i, count in enumerate(hist) if count),
        "alpha_max": max(i for i, count in enumerate(hist) if count),
    }


def seed_colors_from_edges(image: Image.Image) -> list[tuple[int, int, int]]:
    pixels = image.load()
    edge_rgbs: list[tuple[int, int, int]] = []
    for x, y in edge_coordinates(image.width, image.height):
        r, g, b, a = pixels[x, y]
        if a >= 200:
            edge_rgbs.append((r, g, b))

    if not edge_rgbs:
        return []

    counts = Counter(edge_rgbs)
    min_count = max(4, int(len(edge_rgbs) * 0.01))
    seeds = [rgb for rgb, count in counts.most_common(6) if count >= min_count]

    for x, y in (
        (0, 0),
        (image.width - 1, 0),
        (0, image.height - 1),
        (image.width - 1, image.height - 1),
    ):
        r, g, b, a = pixels[x, y]
        rgb = (r, g, b)
        if a >= 200 and rgb not in seeds:
            seeds.append(rgb)

    # PixelLab often bakes in a fake checkerboard. Include neutral edge colors
    # beyond the dominant color so flood fill can eat both checker values.
    for rgb, count in counts.most_common(20):
        if neutralish(rgb) and count >= 4 and rgb not in seeds:
            seeds.append(rgb)

    return seeds


def clean_png(path: Path, *, dry_run: bool = False, include_full_tiles: bool = False) -> dict[str, object]:
    slug = path.stem
    rel = path.relative_to(ROOT).as_posix()
    if slug in FULL_CANVAS_TILE_SLUGS and not include_full_tiles:
        return {"path": rel, "status": "skipped-full-canvas-tile"}

    with Image.open(path) as source:
        image = source.convert("RGBA")

    before = alpha_stats(image)
    seeds = seed_colors_from_edges(image)
    if not seeds:
        return {"path": rel, "status": "unchanged", "reason": "no-opaque-edge-background", "before": before}

    pixels = image.load()
    threshold = threshold_for_slug(slug)

    def is_background_candidate(x: int, y: int) -> bool:
        r, g, b, a = pixels[x, y]
        if a < 16:
            return True
        rgb = (r, g, b)
        if any(max_channel_distance(rgb, seed) <= threshold for seed in seeds):
            return True
        if neutralish(rgb) and any(
            neutralish(seed) and max_channel_distance(rgb, seed) <= 70 for seed in seeds
        ):
            return True
        return False

    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque(edge_coordinates(image.width, image.height))
    to_clear: list[tuple[int, int]] = []
    changed = 0

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        if not is_background_candidate(x, y):
            continue

        to_clear.append((x, y))
        if pixels[x, y][3] >= 16:
            changed += 1

        if x > 0:
            queue.append((x - 1, y))
        if x < image.width - 1:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y < image.height - 1:
            queue.append((x, y + 1))

    if changed == 0:
        return {"path": rel, "status": "unchanged", "reason": "already-transparent", "before": before}

    for x, y in to_clear:
        r, g, b, _a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

    after = alpha_stats(image)
    if not dry_run:
        image.save(path)

    return {
        "path": rel,
        "status": "would-clean" if dry_run else "cleaned",
        "cleared_pixels": changed,
        "cleared_pct": round(100 * changed / (image.width * image.height), 2),
        "before": before,
        "after": after,
        "seed_colors": seeds[:8],
    }


def iter_pngs(sets: Iterable[str]) -> Iterable[Path]:
    for set_name in sets:
        set_dir = ASSET_ROOT / set_name
        if not set_dir.exists():
            continue
        yield from sorted(set_dir.glob("*.png"))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sets",
        nargs="+",
        default=list(DEFAULT_SETS),
        help="hmh-coherent-world set directories to clean",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing PNGs")
    parser.add_argument(
        "--include-full-tiles",
        action="store_true",
        help="Also process full-canvas terrain tiles that are normally skipped",
    )
    parser.add_argument("--json", action="store_true", help="Print full per-file JSON results")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    results = [
        clean_png(path, dry_run=args.dry_run, include_full_tiles=args.include_full_tiles)
        for path in iter_pngs(args.sets)
    ]
    counts: dict[str, int] = {}
    for result in results:
        status = str(result.get("status", "unknown"))
        counts[status] = counts.get(status, 0) + 1

    summary = {
        "asset_root": ASSET_ROOT.relative_to(ROOT).as_posix(),
        "sets": args.sets,
        "scanned": len(results),
        "counts": counts,
    }
    if args.json:
        print(json.dumps({"summary": summary, "results": results}, indent=2))
    else:
        print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
