"""Deterministic seamless terrain tile bakery for Hard Money Heroes.

Playtest feedback: "the level design doesn't have very good terrain tiling and
it's hard to know what you're walking on, what's elevated, what's water."

The runtime drew every surface as a flat colour fill, so water, walkable
ground, road and raised decks were distinguishable only by hue. This bakes a
distinct, physically-shaded material per surface type.

Seamlessness is mathematical, not eyeballed: value noise is sampled on a
periodic lattice whose period divides the tile size, so the left edge is the
same lattice column as the right edge by construction. Tiles cannot seam.

Shading is a real lit surface -- multi-octave height field -> screen-space
normal -> Lambert + specular against a fixed light -- so each material reads
as a physical substance rather than a colour. Output is projection-only art:
nothing here informs collision, elevation, damage or AI.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-terrain-tiles"
TILE_SIZE = 512
# Authored periods below are tuned against the original 256px bake. Scaling
# them with the tile size keeps every feature the same size in world units --
# a bigger bake buys texel density, not bigger pebbles.
PERIOD_SCALE = TILE_SIZE // 256
PIPELINE_ID = "hmh-terrain-tiles-v2"

# Light direction for every material, so surfaces share one lighting model and
# read as one world. Normalised at use.
LIGHT = (-0.55, -0.72, 0.42)


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(a[index] + (b[index] - a[index]) * t) for index in range(3))


def hash01(x: int, y: int, seed: int) -> float:
    """Deterministic 0..1 hash. No RNG, so output is reproducible."""
    h = (x * 374761393 + y * 668265263 + seed * 2246822519) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 0xFFFFFFFF


def smootherstep(t: float) -> float:
    return t * t * t * (t * (t * 6 - 15) + 10)


def wrapped_value_noise(size: int, period: int, seed: int) -> list[list[float]]:
    """Value noise on a lattice of `period` cells across `size` pixels.

    Lattice coordinates wrap modulo `period`, so sampling at x = size is
    identical to x = 0. That is what guarantees a seamless tile.
    """
    cell = size / period
    field = [[0.0] * size for _ in range(size)]
    for py in range(size):
        gy = py / cell
        y0 = int(math.floor(gy)) % period
        y1 = (y0 + 1) % period
        fy = smootherstep(gy - math.floor(gy))
        for px in range(size):
            gx = px / cell
            x0 = int(math.floor(gx)) % period
            x1 = (x0 + 1) % period
            fx = smootherstep(gx - math.floor(gx))
            n00 = hash01(x0, y0, seed)
            n10 = hash01(x1, y0, seed)
            n01 = hash01(x0, y1, seed)
            n11 = hash01(x1, y1, seed)
            top = n00 + (n10 - n00) * fx
            bottom = n01 + (n11 - n01) * fx
            field[py][px] = top + (bottom - top) * fy
    return field


def fbm(size: int, octaves: list[tuple[int, float]], seed: int) -> list[list[float]]:
    """Sum of wrapped octaves. Every period divides `size`, so the sum wraps."""
    total = [[0.0] * size for _ in range(size)]
    weight = 0.0
    for index, (period, amplitude) in enumerate(octaves):
        layer = wrapped_value_noise(size, period, seed + index * 7919)
        for y in range(size):
            row = total[y]
            src = layer[y]
            for x in range(size):
                row[x] += src[x] * amplitude
        weight += amplitude
    if weight > 0:
        for y in range(size):
            row = total[y]
            for x in range(size):
                row[x] /= weight
    return total


def normalise(vector):
    length = math.sqrt(sum(component * component for component in vector))
    return tuple(component / length for component in vector) if length else vector


def shade(height: list[list[float]], size: int, relief: float) -> list[list[tuple[float, float]]]:
    """Return (lambert, specular) per pixel from the height field.

    Neighbours are sampled with wraparound so the lighting is seamless too --
    shading a tile with clamped edges would reintroduce a visible seam.
    """
    light = normalise(LIGHT)
    out = [[(0.0, 0.0)] * size for _ in range(size)]
    for y in range(size):
        up = height[(y - 1) % size]
        down = height[(y + 1) % size]
        row = height[y]
        for x in range(size):
            dx = (row[(x + 1) % size] - row[(x - 1) % size]) * relief
            dy = (down[x] - up[x]) * relief
            normal = normalise((-dx, -dy, 1.0))
            lambert = max(0.0, sum(normal[i] * light[i] for i in range(3)))
            # Blinn-style highlight against a straight-down viewer.
            half = normalise((light[0], light[1], light[2] + 1.0))
            spec = max(0.0, sum(normal[i] * half[i] for i in range(3))) ** 24
            out[y][x] = (lambert, spec)
    return out


def apply_structure(height: list[list[float]], size: int, structure: str, period: int) -> None:
    """Carve regular joints into the height field, in place.

    Periods divide the tile size so the structure wraps with the noise.
    """
    if structure == "planks":
        # Long boards across X with a recessed seam every `period` pixels.
        for y in range(size):
            seam = (y % period) / period
            groove = 1.0 if seam < 0.045 or seam > 0.955 else 0.0
            board = (y // period) * 7919
            for x in range(size):
                height[y][x] = height[y][x] * 0.55 + 0.22 + hash01(board, 0, 31) * 0.12
                if groove:
                    height[y][x] -= 0.42
                # End-joint every two board lengths, offset per row.
                if (x + (y // period) * (period // 2)) % (period * 3) < 3:
                    height[y][x] -= 0.34
    elif structure == "slab-grid":
        for y in range(size):
            gy = (y % period) / period
            for x in range(size):
                gx = (x % period) / period
                joint = gx < 0.04 or gx > 0.96 or gy < 0.04 or gy > 0.96
                panel = hash01(x // period, y // period, 613)
                height[y][x] = height[y][x] * 0.6 + 0.2 + panel * 0.16
                if joint:
                    height[y][x] -= 0.4


def bake(material: dict) -> Image.Image:
    size = TILE_SIZE
    seed = material["seed"]
    # Octave periods are lattice CELL COUNTS per tile (cell = size / period),
    # so they are already resolution-independent: a period-8 field spans the
    # same world distance at any bake size. Only pixel-domain values
    # (structure joints, fringe profile) need PERIOD_SCALE.
    height = fbm(size, material["octaves"], seed)
    structure = material.get("structure")
    if structure:
        apply_structure(height, size, structure, material.get("structurePeriod", 64) * PERIOD_SCALE)
    lighting = shade(height, size, material["relief"])
    detail = fbm(size, material.get("detailOctaves", [(64, 1.0)]), seed + 4001)
    # Painted-style layering: broad colour blotches, as if underpainted with a
    # wide brush before the detail pass. Low-frequency and wrapped, so the
    # paint reads as deliberate variation rather than noise or a seam.
    paint = fbm(size, [(3, 1.0), (6, 0.55)], seed + 8009)

    base = hex_rgb(material["base"])
    shadow = hex_rgb(material["shadow"])
    highlight = hex_rgb(material["highlight"])
    accent = hex_rgb(material.get("accent", material["highlight"]))
    accent_amount = material.get("accentAmount", 0.0)
    accent_threshold = material.get("accentThreshold", 0.82)

    image = Image.new("RGBA", (size, size))
    pixels = image.load()
    ambient = material.get("ambient", 0.42)
    spec_amount = material.get("specular", 0.16)

    # Cycle 049 visibility pass: the owner read the ground as "single color,
    # no texture" at gameplay zoom — the painted layering was real but
    # value-compressed into invisibility. Underpainting, banding, and grain
    # all step up; per-material grain/accent scale below.
    paint_amount = material.get("paintAmount", 0.30)
    band_count = material.get("valueBands", 5)
    band_mix = material.get("bandMix", 0.34)

    for y in range(size):
        for x in range(size):
            lambert, spec = lighting[y][x]
            light_amount = ambient + (1.0 - ambient) * lambert
            # Quantized value bands underneath the continuous shading make the
            # lighting read as blocked-in brushwork instead of a photo gradient.
            banded = round(light_amount * band_count) / band_count
            light_amount = light_amount * (1.0 - band_mix) + banded * band_mix
            colour = mix(shadow, base, min(1.0, light_amount * 1.15))
            colour = mix(colour, highlight, max(0.0, (light_amount - 0.72)) * 1.6)
            # Underpainting: broad warm/cool blotches pulling toward shadow or
            # highlight, centred so the mean colour is unchanged.
            blotch = (paint[y][x] - 0.5) * 2.0
            if blotch > 0:
                colour = mix(colour, highlight, blotch * paint_amount)
            else:
                colour = mix(colour, shadow, -blotch * paint_amount)
            # Grain: fine detail modulating value, keeps flats from reading dead.
            # Sampling the detail field with an integer 45-degree shear turns
            # isotropic noise into directional strokes; the shear is modulo the
            # tile size, so seamlessness is preserved exactly. The 1.6x
            # visibility multiplier is the Cycle 049 contrast step.
            stroke = detail[y][(x + y) % size]
            grain = (stroke - 0.5) * material.get("grain", 0.12) * 1.6
            colour = tuple(max(0, min(255, round(channel * (1.0 + grain)))) for channel in colour)
            if accent_amount > 0 and detail[y][x] > accent_threshold:
                colour = mix(colour, accent, accent_amount)
            if spec_amount > 0:
                colour = mix(colour, (255, 255, 255), spec * spec_amount)
            pixels[x, y] = (colour[0], colour[1], colour[2], 255)
    return image


# Surface materials. Each must be identifiable at a glance from the others --
# that is the whole point of the change.
MATERIALS = {
    # Walkable ground per district.
    "packed-earth": {
        "seed": 11, "base": "#2f5f52", "shadow": "#173a32", "highlight": "#4d8a76",
        "accent": "#6fbfa1", "accentAmount": 0.3, "octaves": [(8, 1.0), (16, 0.5), (32, 0.25), (64, 0.12)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 46, "grain": 0.14, "specular": 0.06,
    },
    "red-rock": {
        "seed": 23, "base": "#6b3b33", "shadow": "#3a1d19", "highlight": "#a3614a",
        "accent": "#d97852", "accentAmount": 0.35, "octaves": [(6, 1.0), (12, 0.6), (24, 0.3), (48, 0.16)],
        "detailOctaves": [(48, 1.0), (96, 0.6)], "relief": 62, "grain": 0.18, "specular": 0.08,
    },
    "wet-bank": {
        "seed": 37, "base": "#2a5a63", "shadow": "#123239", "highlight": "#4d8f95",
        "accent": "#7fc4c8", "accentAmount": 0.27, "octaves": [(8, 1.0), (16, 0.5), (32, 0.28)],
        "detailOctaves": [(64, 1.0), (128, 0.45)], "relief": 40, "grain": 0.12, "specular": 0.2,
    },
    "forest-floor": {
        "seed": 53, "base": "#2c5434", "shadow": "#14301c", "highlight": "#4a8850",
        "accent": "#7fc878", "accentAmount": 0.41, "octaves": [(6, 1.0), (14, 0.6), (28, 0.32), (56, 0.18)],
        "detailOctaves": [(56, 1.0), (112, 0.6)], "relief": 56, "grain": 0.2, "specular": 0.05,
    },
    "crushed-ore": {
        "seed": 71, "base": "#4a4b4e", "shadow": "#26272a", "highlight": "#78797d",
        "accent": "#f0ae4c", "accentAmount": 0.32, "octaves": [(10, 1.0), (20, 0.55), (40, 0.3), (80, 0.18)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 58, "grain": 0.22, "specular": 0.14,
    },
    "industrial-slab": {
        "seed": 89, "base": "#4a2b3f", "shadow": "#24121e", "highlight": "#734a63",
        "structure": "slab-grid", "structurePeriod": 64,
        "accent": "#ff527e", "accentAmount": 0.24, "octaves": [(4, 1.0), (16, 0.4), (32, 0.2)],
        "detailOctaves": [(64, 1.0), (128, 0.4)], "relief": 30, "grain": 0.1, "specular": 0.12,
    },
    # Shared, non-district surfaces. These carry the semantic load the player
    # complained about: am I on a road, in water, or on something raised?
    "road": {
        "seed": 101, "base": "#8a7350", "shadow": "#4f4130", "highlight": "#bda278",
        "accent": "#d8c199", "accentAmount": 0.22, "octaves": [(12, 1.0), (24, 0.5), (48, 0.3), (96, 0.2)],
        "detailOctaves": [(64, 1.0), (128, 0.55)], "relief": 52, "grain": 0.16, "specular": 0.07,
    },
    "water": {
        "seed": 131, "base": "#12617f", "shadow": "#07374d", "highlight": "#3fa7c4",
        "accent": "#a8ecff", "accentAmount": 0.46, "accentThreshold": 0.74,
        "octaves": [(4, 1.0), (8, 0.55), (16, 0.3)],
        "detailOctaves": [(16, 1.0), (32, 0.6)], "relief": 26, "grain": 0.08, "specular": 0.42, "ambient": 0.5,
    },
    "shallow-water": {
        "seed": 137, "base": "#1c7f92", "shadow": "#0d4a58", "highlight": "#5fc6d6",
        "accent": "#bff4ff", "accentAmount": 0.49, "accentThreshold": 0.7,
        "octaves": [(4, 1.0), (8, 0.6), (16, 0.34)],
        "detailOctaves": [(16, 1.0), (32, 0.6)], "relief": 22, "grain": 0.08, "specular": 0.38, "ambient": 0.54,
    },
    "bridge-deck": {
        "seed": 149, "base": "#7a5c3c", "shadow": "#3f2e1d", "highlight": "#a98254",
        "structure": "planks", "structurePeriod": 32,
        "accent": "#c9a878", "accentAmount": 0.27, "octaves": [(4, 1.0), (32, 0.35), (64, 0.2)],
        "detailOctaves": [(64, 1.0), (128, 0.4)], "relief": 44, "grain": 0.14, "specular": 0.1,
    },
    "ledge-top": {
        "seed": 163, "base": "#5d5344", "shadow": "#2e2820", "highlight": "#8d7f68",
        "accent": "#b8a888", "accentAmount": 0.27, "octaves": [(8, 1.0), (16, 0.5), (32, 0.28), (64, 0.16)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 50, "grain": 0.16, "specular": 0.1,
    },
}


FRINGE_HEIGHT = 64 * PERIOD_SCALE


def bake_fringe(name: str, tile: Image.Image, seed: int) -> Image.Image:
    """Cut a horizontally-tileable fringe strip from a baked tile.

    The strip carries the material's own pixels with a ragged, dithered alpha
    falloff, so two ground materials meet as a broken organic edge instead of
    a hard flat rectangle. Deterministic: the edge profile and dither derive
    from the same integer hash as the tile noise.
    """
    fringe = Image.new("RGBA", (TILE_SIZE, FRINGE_HEIGHT))
    profile_field = wrapped_value_noise(TILE_SIZE, 32, seed ^ 0x0F12_19E5)
    profile = profile_field[0]
    for x in range(TILE_SIZE):
        edge = (10 + profile[x] * 26) * PERIOD_SCALE
        for y in range(FRINGE_HEIGHT):
            r, g, b, _ = tile.getpixel((x, y))
            if y <= edge:
                alpha = 255
            else:
                fade = max(0.0, 1.0 - (y - edge) / (FRINGE_HEIGHT * 0.62 - edge * 0.4))
                # Ordered dither keeps the falloff from reading as an airbrush
                # gradient at gameplay zoom.
                dither = ((x * 7 + y * 13 + (seed & 31)) % 4) / 8.0
                alpha = int(255 * max(0.0, min(1.0, fade - dither)))
            fringe.putpixel((x, y), (r, g, b, alpha))
    return fringe


def main() -> None:
    parser = argparse.ArgumentParser(description="Bake seamless HMH terrain tiles.")
    parser.add_argument("--verify-seamless", action="store_true",
                        help="Assert opposite edges match within tolerance.")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    fringe_records = []
    seam_stats = {}
    for name, material in sorted(MATERIALS.items()):
        image = bake(material)

        if args.verify_seamless:
            # A seam is not "opposite edges are identical" -- for high-frequency
            # detail they should differ as much as any neighbouring pair. A seam
            # is when the WRAP difference is anomalous versus normal interior
            # variation. Compare the two directly.
            def mean_abs_delta(pairs):
                total = 0
                for left, right in pairs:
                    total += sum(abs(a - b) for a, b in zip(left[:3], right[:3])) / 3
                return total / max(1, len(pairs))

            wrap_x = mean_abs_delta([(image.getpixel((TILE_SIZE - 1, i)), image.getpixel((0, i))) for i in range(TILE_SIZE)])
            wrap_y = mean_abs_delta([(image.getpixel((i, TILE_SIZE - 1)), image.getpixel((i, 0))) for i in range(TILE_SIZE)])
            # Sample the whole interior distribution, not one midline column: a
            # single sample that happens to land on a structural joint inflates
            # the limit and lets a genuine edge step through.
            def column_delta(col):
                return mean_abs_delta([(image.getpixel((col, i)), image.getpixel((col + 1, i))) for i in range(TILE_SIZE)])

            def row_delta(row):
                return mean_abs_delta([(image.getpixel((i, row)), image.getpixel((i, row + 1))) for i in range(TILE_SIZE)])

            columns = sorted(column_delta(col) for col in range(0, TILE_SIZE - 1, 8))
            rows = sorted(row_delta(row) for row in range(0, TILE_SIZE - 1, 8))
            # Median: robust to the joints that make a few samples large.
            interior_x = columns[len(columns) // 2]
            interior_y = rows[len(rows) // 2]
            # Allow a small absolute floor so near-flat materials, where interior
            # delta is ~0, do not divide by nothing.
            limit_x = max(2.0, interior_x * 3.0)
            limit_y = max(2.0, interior_y * 3.0)
            if wrap_x > limit_x or wrap_y > limit_y:
                raise RuntimeError(
                    f"{name}: seam detected -- wrap delta x={wrap_x:.2f}/y={wrap_y:.2f} "
                    f"vs interior x={interior_x:.2f}/y={interior_y:.2f}"
                )
            seam_stats[name] = {
                "wrapX": round(wrap_x, 3), "wrapY": round(wrap_y, 3),
                "interiorX": round(interior_x, 3), "interiorY": round(interior_y, 3),
            }

        path = OUTPUT_DIR / f"{name}.png"
        image.save(path, optimize=True, compress_level=9)
        records.append({
            "id": name,
            "file": f"./{path.name}",
            "size": TILE_SIZE,
            "bytes": path.stat().st_size,
        })

        fringe = bake_fringe(name, image, material["seed"])
        fringe_path = OUTPUT_DIR / f"{name}-fringe.png"
        fringe.save(fringe_path, optimize=True)
        fringe_records.append({
            "id": name,
            "file": f"./{fringe_path.name}",
            "width": TILE_SIZE,
            "height": FRINGE_HEIGHT,
            "bytes": fringe_path.stat().st_size,
        })

    manifest = {
        "schemaVersion": 1,
        "pipelineId": PIPELINE_ID,
        "classification": "production-art",
        "runtimeAuthority": "projection-only",
        "tileSize": TILE_SIZE,
        "fringeHeight": FRINGE_HEIGHT,
        "paintedLayering": True,
        "fringes": fringe_records,
        "seamlessVerified": bool(args.verify_seamless),
        "seamStatistics": seam_stats,
        "materials": records,
    }
    manifest_path = OUTPUT_DIR / "hmh-terrain-tiles.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({
        "status": "pass",
        "pipelineId": PIPELINE_ID,
        "materialCount": len(records),
        "totalBytes": sum(entry["bytes"] for entry in records),
        "seamlessVerified": manifest["seamlessVerified"],
    }, sort_keys=True))


if __name__ == "__main__":
    main()
