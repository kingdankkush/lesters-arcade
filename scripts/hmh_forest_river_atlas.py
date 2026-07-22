"""Deterministic AAA-style forest, meadow, river, dirt, and elevation atlas for HMH Level 1."""
from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw

TILE_W, TILE_H = 128, 64
PHASES = 4
ROLES = ("meadow", "forest", "water", "dirt")
TRANSITIONS = (
    ("meadow-forest", "meadow", "forest", "soft"),
    ("forest-river", "forest", "water", "river"),
    ("forest-dirt", "forest", "dirt", "dirt"),
)
ATLAS_COLUMNS = 16
ATLAS_WIDTH = ATLAS_COLUMNS * TILE_W
ATLAS_HEIGHT = 13 * TILE_H + 96
SOURCE_POLICY = (
    "Original repo-owned HMH terrain. PixelLab rendered candidates supplied palette and texture direction only; "
    "runtime corner topology, phase variants, shoreline bands, and seams are deterministic repo-local construction."
)


def rgba(value: str) -> tuple[int, int, int, int]:
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


PALETTES = {
    "meadow": [rgba(v) for v in ("#304c31", "#3e6138", "#4d7540", "#5f8849", "#739d52", "#8ab05c")],
    "forest": [rgba(v) for v in ("#14251f", "#1b3026", "#243b2c", "#2e4833", "#3a573a", "#65573a")],
    "water": [rgba(v) for v in ("#315873", "#3c6a87", "#4b7d99", "#6092ab", "#78a9bd", "#a7cbd5")],
    "dirt": [rgba(v) for v in ("#55372d", "#684232", "#7b4e36", "#8e5b3b", "#a06b45", "#b68054")],
}
BANK = [rgba(v) for v in ("#342b26", "#49352b", "#624634", "#7e5d40")]
FOAM = [rgba(v) for v in ("#96becb", "#c2d9dc")]
FRINGE = [rgba(v) for v in ("#1b3427", "#2a4b30", "#49633a")]


def hash_cell(x: int, y: int, seed: int) -> int:
    value = ((x + 11) * 0x45D9F3B) ^ ((y + 17) * 0x119DE1F3) ^ (seed * 0x27D4EB2D)
    value = (value ^ (value >> 16)) * 0x45D9F3B
    return (value ^ (value >> 16)) & 0xFFFFFFFF


def material_color(terrain: str, x: int, y: int, phase: int) -> tuple[int, int, int, int]:
    palette = PALETTES[terrain]
    block = hash_cell((x + phase * 5) // 4, (y + phase * 3) // 2, 101 + len(terrain) * 17)
    detail = hash_cell(x, y, 503 + phase * 31 + len(terrain) * 13)
    index = 1 if block % 13 == 0 else 3 if block % 7 == 0 else 4 if block % 5 == 0 else 2
    if terrain == "water":
        index = 2 if block % 5 else 3
        if y % 6 == (phase * 2) % 6 and detail % 9 in {0, 1, 2}:
            index = 4
        elif detail % 47 == 0:
            index = 1
    elif terrain == "forest":
        index = min(index, 3)
        if detail % 71 == 0:
            index = 5
    elif terrain == "meadow" and detail % 61 == 0:
        index = 5
    elif terrain == "dirt":
        index = min(index, 4)
        if y % 9 == phase and detail % 13 in {0, 1}:
            index = 1
    return palette[index]


def inside_diamond(x: int, y: int) -> bool:
    return abs((x + 0.5) - TILE_W / 2) / (TILE_W / 2) + abs((y + 0.5) - TILE_H / 2) / (TILE_H / 2) <= 1.0


def uv_for_pixel(x: int, y: int) -> tuple[float, float]:
    sx, sy = (x + 0.5) - TILE_W / 2, y + 0.5
    return max(0.0, min(1.0, sy / TILE_H + sx / TILE_W)), max(0.0, min(1.0, sy / TILE_H - sx / TILE_W))


def field_value(mask: int, u: float, v: float, phase: int) -> float:
    nw, ne, sw, se = (1.0 if mask & bit else 0.0 for bit in (8, 4, 2, 1))
    value = nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v
    ripple = math.sin(math.pi * u) * math.sin(math.pi * v)
    return value + math.sin((u * 7 + v * 5 + phase * 0.71) * math.pi) * 0.075 * ripple


def base_tile(terrain: str, phase: int) -> Image.Image:
    logical = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    pixels = logical.load()
    for y in range(32):
        for x in range(64):
            if inside_diamond(x * 2, y * 2):
                pixels[x, y] = material_color(terrain, x, y, phase)
    return logical.resize((TILE_W, TILE_H), Image.Resampling.NEAREST)


def transition_tile(first: str, second: str, mask: int, phase: int, kind: str) -> Image.Image:
    logical = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    pixels = logical.load()
    for y in range(32):
        for x in range(64):
            px, py = x * 2, y * 2
            if not inside_diamond(px, py):
                continue
            u, v = uv_for_pixel(px, py)
            value = field_value(mask, u, v, phase)
            terrain = first if value >= 0.5 else second
            color = material_color(terrain, x, y, phase)
            distance = abs(value - 0.5)
            if kind == "river" and 0 < mask < 15 and distance < 0.095:
                if terrain == first:
                    color = BANK[(hash_cell(x, y, phase + 301) // 7) % len(BANK)]
                elif distance < 0.042 and hash_cell(x, y, phase + 401) % 3:
                    color = FOAM[hash_cell(x, y, phase + 409) % len(FOAM)]
            elif kind == "dirt" and 0 < mask < 15 and distance < 0.065 and terrain == first:
                color = FRINGE[hash_cell(x, y, phase + 503) % len(FRINGE)]
            pixels[x, y] = color
    return logical.resize((TILE_W, TILE_H), Image.Resampling.NEAREST)


def elevation_master() -> Image.Image:
    logical = Image.new("RGBA", (64, 48), (0, 0, 0, 0))
    draw = ImageDraw.Draw(logical)
    draw.polygon([(0, 16), (32, 32), (32, 47), (0, 31)], fill="#624b39")
    draw.polygon([(63, 16), (32, 32), (32, 47), (63, 31)], fill="#3f3933")
    for y, left, right in ((35, "#846146", "#55483b"), (40, "#4e4035", "#302f2d"), (44, "#76543d", "#493b33")):
        draw.line((8, y - 4, 32, y + 8), fill=left)
        draw.line((32, y + 8, 56, y - 4), fill=right)
    logical.alpha_composite(base_tile("forest", 1).resize((64, 32), Image.Resampling.NEAREST), (0, 0))
    draw.line((0, 16, 32, 32), fill="#4c6840")
    draw.line((32, 32, 63, 16), fill="#334f34")
    return logical.resize((128, 96), Image.Resampling.NEAREST)


def base_rect(role: str, phase: int) -> dict[str, int]:
    index = ROLES.index(role) * PHASES + phase
    return {"x": index * TILE_W, "y": 0, "width": TILE_W, "height": TILE_H}


def transition_rect(family: str, phase: int, mask: int) -> dict[str, int]:
    row = 1 + next(index for index, spec in enumerate(TRANSITIONS) if spec[0] == family) * PHASES + phase
    return {"x": mask * TILE_W, "y": row * TILE_H, "width": TILE_W, "height": TILE_H}


def elevation_rect() -> dict[str, int]:
    return {"x": 0, "y": 13 * TILE_H, "width": 128, "height": 96}


def seam_topology() -> dict[str, int | str]:
    samples = mismatches = 0
    for a in (0, 1):
        for b in (0, 1):
            left_mask = (4 if a else 0) | (1 if b else 0)
            right_mask = (8 if a else 0) | (2 if b else 0)
            for step in range(65):
                samples += 1
                if (field_value(left_mask, 1, step / 64, 0) >= 0.5) != (field_value(right_mask, 0, step / 64, 3) >= 0.5):
                    mismatches += 1
    return {"samples": samples, "mismatches": mismatches, "status": "PASS" if mismatches == 0 else "FAIL"}


def build_forest_river_atlas(path: Path) -> dict:
    atlas = Image.new("RGBA", (ATLAS_WIDTH, ATLAS_HEIGHT), (0, 0, 0, 0))
    color_counts = []
    for role in ROLES:
        for phase in range(PHASES):
            image = base_tile(role, phase)
            rect = base_rect(role, phase)
            atlas.alpha_composite(image, (rect["x"], rect["y"]))
            color_counts.append(len(image.getcolors(maxcolors=1_000_000) or []))
    for family, first, second, kind in TRANSITIONS:
        for phase in range(PHASES):
            for mask in range(16):
                image = transition_tile(first, second, mask, phase, kind)
                rect = transition_rect(family, phase, mask)
                atlas.alpha_composite(image, (rect["x"], rect["y"]))
                color_counts.append(len(image.getcolors(maxcolors=1_000_000) or []))
    atlas.alpha_composite(elevation_master(), (0, 13 * TILE_H))
    path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(path, optimize=True)
    seam = seam_topology()
    if seam["status"] != "PASS" or atlas.size != (ATLAS_WIDTH, ATLAS_HEIGHT):
        raise RuntimeError("forest-river atlas certification failed")
    return {
        "id": "hmh-forest-river-terrain-atlas-v1",
        "status": "runtime-ready-seam-certified",
        "src": "./assets/generated/hmh-level-one-world-v3/materials/forest-river-terrain-atlas-v1.png",
        "width": ATLAS_WIDTH,
        "height": ATLAS_HEIGHT,
        "tileGeometry": [TILE_W, TILE_H],
        "logicalPixelGrid": [64, 32],
        "phaseCount": PHASES,
        "baseTiles": len(ROLES) * PHASES,
        "transitionTiles": len(TRANSITIONS) * PHASES * 16,
        "elevationMasters": 1,
        "totalTiles": len(ROLES) * PHASES + len(TRANSITIONS) * PHASES * 16 + 1,
        "tileColorRange": [min(color_counts), max(color_counts)],
        "seamTopology": seam,
        "decodedBytes": ATLAS_WIDTH * ATLAS_HEIGHT * 4,
        "sourcePolicy": SOURCE_POLICY,
    }
