"""Build the half-resolution mobile variants of the big HMH texture pages.

Perf step 6. Phones (runtime profile `mobile`) load `<name>@0.5x.webp` next to
each full-size page listed below instead of the page itself. `@0.5x` is Pixi's
own resolution suffix: the half-size file loads with `source.resolution = 0.5`,
so its logical size is the full page size. Every frame rectangle, anchor and
pivot in the existing full-size metadata therefore stays valid in logical
pixels, and nothing drawn changes on-screen size or ground position. No
metadata is rewritten.

Resampling
  * Premultiplied alpha, float32, Lanczos (Pillow LANCZOS, a = 3), exactly 2:1.
  * Atlas pages are resampled frame by frame. Each frame's own rectangle is
    isolated on a transparent canvas aligned to the 2:1 grid, resampled, and
    only the texels its rectangle touches are written. A neighbouring frame
    can therefore never bleed into another frame's texels, whatever the
    packing gutter (the shipped atlases pack frames 2 px apart at odd
    offsets). The script refuses a page whose frame footprints overlap.
  * Repeating terrain tiles wrap on both axes; edge strips (fringes and
    overlays) wrap along U and clamp along V, which is how the runtime
    addresses them, so the half tiles stay seamless.
  * Values are clamped to the valid premultiplied range, then un-premultiplied
    and rounded. Fully transparent texels store RGB 0.

Encoding
  * Atlas pages: lossy WebP, quality 90, lossless alpha, method 6.
  * Terrain: lossless WebP, exact, method 6 (tiles must wrap bit-for-bit).

The manifest `apps/portal/assets/generated/hmh-mobile-half-res.json` records,
per page, the source file and its SHA-256, the output file, its SHA-256, byte
size and dimensions. `tests/hmh-mobile-half-res-textures.test.mjs` fails when a
source page changes without its variant being rebuilt.

Usage
  python scripts/build-hmh-mobile-half-res.py            # rebuild every variant
  python scripts/build-hmh-mobile-half-res.py --check    # verify, write nothing
  python scripts/build-hmh-mobile-half-res.py --only hmh-native-roster

Projection-only art; it cannot alter gameplay geometry, collision or results.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import platform
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image
import PIL

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "apps" / "portal" / "assets" / "generated"
MANIFEST = GENERATED / "hmh-mobile-half-res.json"
PIPELINE_ID = "hmh-mobile-half-res/v1"
SUFFIX = "@0.5x.webp"
HEROES = ("lester-original", "lilly", "lit-commando", "lit-valkyrie")
NATIVE_ROSTER = ("forkrunner", "gas-bomber", "liquidator-agent", "the-liquidator", "validator-cultist", "whale-enforcer")
# Lanczos a = 3 reaches 3 output texels at a 2:1 reduction. The frame canvas
# carries that much transparent margin so every written texel sees its whole
# kernel.
PAD_TEXELS = 3
ATLAS_WEBP = {"quality": 90, "alpha_quality": 100, "method": 6}
TERRAIN_WEBP = {"lossless": True, "exact": True, "method": 6}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(GENERATED).as_posix()


def variant_path(source: Path) -> Path:
    return source.with_name(source.stem + SUFFIX)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def rect_of(frame: dict) -> tuple[int, int, int, int]:
    r = frame["frame"]
    values = (r["x"], r["y"], r["w"], r["h"])
    if not all(isinstance(v, int) for v in values) or values[2] <= 0 or values[3] <= 0:
        raise ValueError(f"invalid frame rectangle {r}")
    return values


def targets() -> list[dict]:
    """Every full-size page the mobile runtime can load, with its frames."""
    jobs: list[dict] = []

    def atlas(image: Path, rects) -> None:
        jobs.append({"kind": "atlas", "source": image, "rects": sorted(set(rects))})

    for actor in NATIVE_ROSTER:
        folder = GENERATED / "hmh-native-roster" / actor
        meta = load_json(folder / f"{actor}-native-roster.json")
        atlas(folder / meta["image"].removeprefix("./"), (rect_of(f) for f in meta["frames"]))
    folder = GENERATED / "hmh-reboot-enemy-roster" / "bagholder-rusher"
    meta = load_json(folder / "bagholder-rusher-roster-atlas.json")
    atlas(folder / meta["image"].removeprefix("./"), (rect_of(f) for f in meta["frames"]))
    for hero in HEROES:
        folder = GENERATED / "hmh-reboot-production-heroes" / hero
        meta = load_json(folder / f"{hero}-production-pilot-atlas.json")
        atlas(folder / meta["image"].removeprefix("./"), (rect_of(f) for f in meta["frames"]))
        folder = GENERATED / "hmh-hero-motion" / hero
        meta = load_json(folder / f"{hero}-motion.json")
        atlas(folder / meta["image"].removeprefix("./"), (rect_of(f) for f in meta["frames"]))
        folder = GENERATED / "hmh-held-weapons" / hero
        meta = load_json(folder / f"{hero}-held-weapons.json")
        for weapon in meta["weapons"].values():
            for page_index, page in enumerate(weapon["pages"]):
                atlas(folder / page["image"].removeprefix("./"),
                      (rect_of(f) for f in weapon["frames"] if f["page"] == page_index))
    folder = GENERATED / "hmh-reboot-authored-props"
    meta = load_json(folder / "hmh-authored-props-atlas.json")
    atlas(folder / meta["image"].removeprefix("./"), (rect_of(f) for f in meta["frames"]))
    folder = GENERATED / "hmh-reboot-tripo-props"
    meta = load_json(folder / "hmh-tripo-props.json")
    for page_index, page in enumerate(meta["pages"]):
        atlas(folder / page["image"], (rect_of(f) for f in meta["frames"] if f["page"] == page_index))
    folder = GENERATED / "hmh-terrain-tiles"
    meta = load_json(folder / "hmh-terrain-tiles.json")
    for entry in meta["materials"]:
        jobs.append({"kind": "tile", "source": folder / entry["file"].removeprefix("./")})
    for entry in [*meta["fringes"], *meta["overlays"]]:
        jobs.append({"kind": "strip", "source": folder / entry["file"].removeprefix("./")})
    seen = set()
    for job in jobs:
        if job["source"] in seen:
            raise ValueError(f"duplicate page {rel(job['source'])}")
        seen.add(job["source"])
    return jobs


def premultiplied(image: Image.Image) -> np.ndarray:
    values = np.asarray(image.convert("RGBA"), dtype=np.float32) / np.float32(255)
    out = values.copy()
    out[..., :3] *= out[..., 3:4]
    return out


def half_planes(canvas: np.ndarray) -> np.ndarray:
    """Exact 2:1 Lanczos reduction of an (h, w, 4) float32 array, per channel."""
    height, width = canvas.shape[:2]
    if height % 2 or width % 2:
        raise ValueError("2:1 reduction needs even dimensions")
    planes = []
    for channel in range(4):
        plane = Image.fromarray(np.ascontiguousarray(canvas[..., channel]), mode="F")
        planes.append(np.asarray(plane.resize((width // 2, height // 2), Image.Resampling.LANCZOS), dtype=np.float32))
    return np.stack(planes, axis=-1)


def footprint(rect: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    """Half-resolution texels [x0, x1) x [y0, y1) a source rectangle touches."""
    x, y, w, h = rect
    return x // 2, y // 2, -(-(x + w) // 2), -(-(y + h) // 2)


def reduce_atlas(source: np.ndarray, rects) -> tuple[np.ndarray, int]:
    height, width = source.shape[:2]
    out = np.zeros((height // 2, width // 2, 4), dtype=np.float32)
    owner = np.full((height // 2, width // 2), -1, dtype=np.int32)
    for number, rect in enumerate(rects):
        x, y, w, h = rect
        if x < 0 or y < 0 or x + w > width or y + h > height:
            raise ValueError(f"frame {rect} outside page {width}x{height}")
        tx0, ty0, tx1, ty1 = footprint(rect)
        claimed = owner[ty0:ty1, tx0:tx1]
        if (claimed >= 0).any():
            raise ValueError(f"frame {rect} shares half-resolution texels with frame {rects[int(claimed.max())]}")
        claimed[...] = number
        ox, oy = 2 * (tx0 - PAD_TEXELS), 2 * (ty0 - PAD_TEXELS)
        canvas = np.zeros((2 * (ty1 - ty0 + 2 * PAD_TEXELS), 2 * (tx1 - tx0 + 2 * PAD_TEXELS), 4), dtype=np.float32)
        canvas[y - oy:y - oy + h, x - ox:x - ox + w] = source[y:y + h, x:x + w]
        reduced = half_planes(canvas)
        out[ty0:ty1, tx0:tx1] = reduced[PAD_TEXELS:PAD_TEXELS + ty1 - ty0, PAD_TEXELS:PAD_TEXELS + tx1 - tx0]
    return out, len(rects)


def reduce_repeating(source: np.ndarray, wrap_y: bool) -> np.ndarray:
    pad = 2 * PAD_TEXELS + 2
    padded = np.pad(source, ((0, 0), (pad, pad), (0, 0)), mode="wrap")
    padded = np.pad(padded, ((pad, pad), (0, 0), (0, 0)), mode="wrap" if wrap_y else "edge")
    reduced = half_planes(padded)
    half = pad // 2
    return reduced[half:half + source.shape[0] // 2, half:half + source.shape[1] // 2]


def to_straight_rgba(premul: np.ndarray) -> Image.Image:
    alpha = np.clip(premul[..., 3], 0.0, 1.0)
    rgb = np.minimum(np.clip(premul[..., :3], 0.0, None), alpha[..., None])
    safe = np.where(alpha > 0, alpha, 1.0)[..., None]
    straight = np.where(alpha[..., None] > 0, rgb / safe, 0.0)
    values = np.concatenate([straight, alpha[..., None]], axis=-1)
    return Image.fromarray(np.clip(np.rint(values * 255.0), 0, 255).astype(np.uint8), mode="RGBA")


def build(job: dict) -> dict:
    source_path: Path = job["source"]
    data = source_path.read_bytes()
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        width, height = image.size
        if width % 2 or height % 2:
            raise ValueError(f"{rel(source_path)} has odd dimensions {width}x{height}")
        premul = premultiplied(image)
    frames = None
    if job["kind"] == "atlas":
        reduced, frames = reduce_atlas(premul, job["rects"])
        options = ATLAS_WEBP
    else:
        reduced = reduce_repeating(premul, wrap_y=job["kind"] == "tile")
        options = TERRAIN_WEBP
    buffer = io.BytesIO()
    to_straight_rgba(reduced).save(buffer, "WEBP", **options)
    encoded = buffer.getvalue()
    output = variant_path(source_path)
    return {
        "kind": job["kind"],
        "source": rel(source_path),
        "sourceSha256": sha256_bytes(data),
        "sourceBytes": len(data),
        "sourceWidth": width,
        "sourceHeight": height,
        "output": rel(output),
        "outputSha256": sha256_bytes(encoded),
        "outputBytes": len(encoded),
        "width": width // 2,
        "height": height // 2,
        **({"frames": frames} if frames is not None else {}),
        "_bytes": encoded,
    }


def manifest_for(entries: list[dict]) -> dict:
    return {
        "schemaVersion": 1,
        "pipelineId": PIPELINE_ID,
        "classification": "derived-mobile-variant",
        "runtimeAuthority": "projection-only",
        "generator": "scripts/build-hmh-mobile-half-res.py",
        "profile": "mobile",
        "resolution": 0.5,
        "suffix": SUFFIX,
        "frameSpace": "full-size metadata in logical pixels; Pixi source.resolution 0.5 maps it onto the half page",
        "resampling": {
            "filter": "lanczos3",
            "space": "premultiplied-float32",
            "atlas": "per-frame isolation on the 2:1 grid; only a frame's own footprint texels are written",
            "tile": "wrap U and V",
            "strip": "wrap U, clamp V",
        },
        "encoding": {"atlas": {"format": "webp", **ATLAS_WEBP}, "terrain": {"format": "webp", **TERRAIN_WEBP}},
        "toolchain": {"python": platform.python_version(), "pillow": PIL.__version__, "numpy": np.__version__},
        "totals": {
            "pages": len(entries),
            "sourceBytes": sum(e["sourceBytes"] for e in entries),
            "outputBytes": sum(e["outputBytes"] for e in entries),
            "sourceRgbaBytes": sum(e["sourceWidth"] * e["sourceHeight"] * 4 for e in entries),
            "outputRgbaBytes": sum(e["width"] * e["height"] * 4 for e in entries),
        },
        "pages": entries,
    }


def frame_alignment(full_alpha: np.ndarray, half_alpha: np.ndarray, rects) -> float:
    """Largest alpha-centroid offset, in source pixels, between a frame on the
    full page and the same frame read back from the half page. Frames with
    less than 64 px of coverage are skipped: their centroid is noise."""
    worst = 0.0
    for x, y, w, h in rects:
        full = full_alpha[y:y + h, x:x + w]
        if full.sum() < 64:
            continue
        tx0, ty0, tx1, ty1 = footprint((x, y, w, h))
        half = half_alpha[ty0:ty1, tx0:tx1]
        if half.sum() <= 0:
            return float("inf")
        fy, fx = np.mgrid[y:y + h, x:x + w] + 0.5
        hy, hx = (np.mgrid[ty0:ty1, tx0:tx1] + 0.5) * 2
        dx = (half * hx).sum() / half.sum() - (full * fx).sum() / full.sum()
        dy = (half * hy).sum() / half.sum() - (full * fy).sum() / full.sum()
        worst = max(worst, abs(dx), abs(dy))
    return worst


def check(jobs: list[dict]) -> int:
    manifest = load_json(MANIFEST)
    listed = {entry["source"]: entry for entry in manifest["pages"]}
    problems = []
    worst_offset = 0.0
    for job in jobs:
        source = rel(job["source"])
        entry = listed.pop(source, None)
        if entry is None:
            problems.append(f"{source}: no variant listed")
            continue
        if sha256_bytes(job["source"].read_bytes()) != entry["sourceSha256"]:
            problems.append(f"{source}: source changed since its variant was built")
        output = GENERATED / entry["output"]
        if not output.exists() or sha256_bytes(output.read_bytes()) != entry["outputSha256"]:
            problems.append(f"{entry['output']}: missing or not the recorded bytes")
            continue
        with Image.open(output) as image:
            if image.size != (entry["width"], entry["height"]):
                problems.append(f"{entry['output']}: decoded {image.size}")
                continue
            half_alpha = np.asarray(image.convert("RGBA"), dtype=np.float64)[..., 3] / 255.0
        if job["kind"] == "atlas":
            with Image.open(job["source"]) as image:
                full_alpha = np.asarray(image.convert("RGBA"), dtype=np.float64)[..., 3] / 255.0
            offset = frame_alignment(full_alpha, half_alpha, job["rects"])
            worst_offset = max(worst_offset, offset)
            if offset > 0.5:
                problems.append(f"{entry['output']}: a frame's alpha centroid moved {offset:.3f} source px")
    print(f"worst frame alpha-centroid offset: {worst_offset:.3f} source px")
    problems.extend(f"{source}: listed but no longer a runtime page" for source in listed)
    for problem in problems:
        print(problem)
    print(f"{len(jobs)} pages checked, {len(problems)} problems")
    return 1 if problems else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="verify the manifest and variants; write nothing")
    parser.add_argument("--only", help="rebuild only pages whose path contains this text (others are kept)")
    parser.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 1))
    args = parser.parse_args()
    jobs = targets()
    if args.check:
        return check(jobs)
    previous = {e["source"]: e for e in load_json(MANIFEST)["pages"]} if MANIFEST.exists() and args.only else {}
    todo = [job for job in jobs if not args.only or args.only in rel(job["source"])]
    entries: dict[str, dict] = {}
    with ProcessPoolExecutor(max_workers=max(1, args.workers)) as pool:
        for result in pool.map(build, todo):
            encoded = result.pop("_bytes")
            (GENERATED / result["output"]).write_bytes(encoded)
            entries[result["source"]] = result
            print(f"{result['output']}: {result['width']}x{result['height']} {result['outputBytes']} B "
                  f"(source {result['sourceBytes']} B)", flush=True)
    ordered = []
    for job in jobs:
        source = rel(job["source"])
        entry = entries.get(source) or previous.get(source)
        if entry is None:
            raise SystemExit(f"{source}: no variant built or recorded; run without --only")
        ordered.append(entry)
    MANIFEST.write_text(json.dumps(manifest_for(ordered), indent=2) + "\n", encoding="utf-8", newline="\n")
    totals = manifest_for(ordered)["totals"]
    print(json.dumps(totals))
    return 0


if __name__ == "__main__":
    sys.exit(main())
