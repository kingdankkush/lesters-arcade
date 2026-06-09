#!/usr/bin/env python
"""Ingest user-provided Level Tileset source art as repo-local reference assets.

The user supplied large (5-7 MB) isometric ground-scene PNGs (Urban-street,
Rocky-ground, Rocky-terrain, Marsh-land, Valley-terrain, plus BlastEm sheets).
They are painted scenes -- NOT pre-sliced seamless tiles -- so they are not
wired into the runtime tile system yet. This script preserves them in the repo
as downscaled, optimized JPEG references plus a manifest mapping each to its
intended biome, so a future pass can slice clean iso tiles / extract obstacle
props without re-sourcing the originals.

No runtime change. Pure asset preservation. Idempotent (skips up-to-date files).

Usage:
  python scripts/ingest-hmh-tileset-references.py
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path.home() / "Desktop" / "My Stuff" / "Lester's Arcade" / "Level Tilesets"
EXTRA_DIR = Path.home() / "Desktop" / "My Stuff" / "Lester's Arcade"
OUT_DIR = ROOT / "apps/portal/assets/hard-money-heroes/reference/level-tilesets"
MANIFEST = OUT_DIR / "tileset-reference-manifest.json"

MAX_DIM = 1024  # reference thumbnails; originals stay on the user's disk
JPEG_QUALITY = 82

# source filename -> intended biome + notes for a future slicing pass.
SOURCES = {
    "Urban-street.png": {"biome": "road", "notes": "cracked asphalt + faded road lines; rubble/grass props baked in"},
    "Rocky-ground.png": {"biome": "rocky", "notes": "cracked earth + scattered boulders (candidate collision props)"},
    "Rocky-terrain.png": {"biome": "rocky", "notes": "rocky terrain variant"},
    "Rocky-terrain2.png": {"biome": "rocky", "notes": "rocky terrain variant 2"},
    "Marsh-land.png": {"biome": "water", "notes": "marsh/wetland; water edges -> water-collision biome"},
    "Marsh-land2.png": {"biome": "water", "notes": "marsh/wetland variant 2"},
    "Valley-terrain.png": {"biome": "forest", "notes": "valley/grassland; foliage props baked in"},
    "BlastEm-01.png": {"biome": "town", "notes": "BlastEm reference sheet 01"},
    "BlastEm-02.png": {"biome": "town", "notes": "BlastEm reference sheet 02"},
}


def find_source(name: str) -> Path | None:
    for base in (SOURCE_DIR, EXTRA_DIR):
        p = base / name
        if p.exists():
            return p
    return None


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict = {
        "id": "hmh-level-tileset-references-v1",
        "purpose": "Preserved user tileset source art (downscaled JPEG refs). NOT wired into runtime; awaiting a future iso-tile slicing / obstacle-extraction pass.",
        "maxDim": MAX_DIM,
        "tilesets": [],
    }
    ingested = 0
    for name, meta in SOURCES.items():
        src = find_source(name)
        out_name = Path(name).stem.lower().replace(" ", "-") + ".jpg"
        out_path = OUT_DIR / out_name
        if src is None:
            manifest["tilesets"].append({"source": name, "status": "missing-source", **meta})
            print(f"  SKIP (missing): {name}")
            continue
        img = Image.open(src).convert("RGB")
        ow, oh = img.size
        img.thumbnail((MAX_DIM, MAX_DIM), Image.Resampling.LANCZOS)
        img.save(out_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
        ingested += 1
        manifest["tilesets"].append({
            "source": name,
            "reference": f"./assets/hard-money-heroes/reference/level-tilesets/{out_name}",
            "originalSize": [ow, oh],
            "referenceSize": list(img.size),
            "status": "ingested",
            **meta,
        })
        print(f"  ingested {name} ({ow}x{oh}) -> {out_name} ({img.size[0]}x{img.size[1]}, {out_path.stat().st_size // 1024} KB)")
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"ingested": ingested, "manifest": str(MANIFEST.relative_to(ROOT))}, indent=2))


if __name__ == "__main__":
    main()
