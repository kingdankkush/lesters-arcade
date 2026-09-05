"""Cycle 074 (P-6): convert one shipped hero atlas into the candidate formats.

Scratch measurement only. Nothing this script writes is a shipped asset; the
outputs land in the directory the caller names (by default under .tmp/) and
the node harness (scripts/hmh-hero-atlas-format-harness.mjs) serves them to a
browser to time fetch, decode and upload.

Variants
  png             byte copy of the shipped atlas (the control)
  webp-lossless   Pillow WEBP lossless=True method=6 exact=True
                  (exact=True is mandatory: Pillow's default rewrites RGB under
                  alpha 0, which would break every RGBA hash pin in the atlas
                  metadata even though no visible pixel changes)
  webp-q90        Pillow WEBP quality=90 method=6 (alpha_quality default 100)

KTX2 is probed (toktx / basisu / ktx on PATH) and reported as not measurable
when no encoder is installed; nothing is guessed.

Usage
  python scripts/hmh-hero-atlas-format-convert.py --hero lester-original --out .tmp/p6
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import shutil
import sys
import time
from pathlib import Path

from PIL import Image, features

REPO_ROOT = Path(__file__).resolve().parents[1]
HERO_ROOT = REPO_ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-reboot-production-heroes"
KTX2_ENCODERS = ("toktx", "basisu", "ktx")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fidelity(source: Image.Image, candidate: Image.Image) -> dict:
    """RGBA fidelity of `candidate` against `source`, restricted to visible pixels.

    Uses numpy when available (the host toolchain); falls back to a slower
    pure-Pillow path built on getdata() so the script never depends on
    Image.get_flattened_data, which the Vercel image's Pillow 11.3 lacks.
    """
    if source.size != candidate.size:
        raise ValueError(f"size mismatch {source.size} vs {candidate.size}")
    try:
        import numpy as np  # type: ignore

        a = np.asarray(source.convert("RGBA"), dtype=np.int16)
        b = np.asarray(candidate.convert("RGBA"), dtype=np.int16)
        delta = np.abs(a - b)
        visible = a[..., 3] > 0
        visible_count = int(visible.sum())
        rgb_delta = delta[..., :3]
        visible_rgb = rgb_delta[visible]
        return {
            "identical": bool((delta == 0).all()),
            "alphaChanged": int((delta[..., 3] != 0).sum()),
            "visiblePixels": visible_count,
            "visiblePixelShare": round(visible_count / (a.shape[0] * a.shape[1]), 4),
            "visibleMaxChannelDelta": int(visible_rgb.max()) if visible_count else 0,
            "visibleMeanRgbDelta": round(float(visible_rgb.mean()), 3) if visible_count else 0.0,
            "visibleChangedPixels": int((visible_rgb.max(axis=1) > 0).sum()) if visible_count else 0,
            "transparentRgbChanged": int((rgb_delta[~visible].max(axis=1) > 0).sum()) if (~visible).any() else 0,
            "method": "numpy",
        }
    except ImportError:
        pass

    src = list(source.convert("RGBA").getdata())
    cand = list(candidate.convert("RGBA").getdata())
    alpha_changed = 0
    visible_count = 0
    visible_changed = 0
    transparent_rgb_changed = 0
    max_delta = 0
    total_delta = 0
    for (sr, sg, sb, sa), (cr, cg, cb, ca) in zip(src, cand):
        if sa != ca:
            alpha_changed += 1
        dr, dg, db = abs(sr - cr), abs(sg - cg), abs(sb - cb)
        if sa > 0:
            visible_count += 1
            local_max = max(dr, dg, db)
            if local_max:
                visible_changed += 1
            max_delta = max(max_delta, local_max)
            total_delta += dr + dg + db
        elif dr or dg or db:
            transparent_rgb_changed += 1
    return {
        "identical": alpha_changed == 0 and visible_changed == 0 and transparent_rgb_changed == 0,
        "alphaChanged": alpha_changed,
        "visiblePixels": visible_count,
        "visiblePixelShare": round(visible_count / len(src), 4),
        "visibleMaxChannelDelta": max_delta,
        "visibleMeanRgbDelta": round(total_delta / (visible_count * 3), 3) if visible_count else 0.0,
        "visibleChangedPixels": visible_changed,
        "transparentRgbChanged": transparent_rgb_changed,
        "method": "pillow-getdata",
    }


def encode(source: Image.Image, target: Path, **save_kwargs) -> float:
    started = time.perf_counter()
    source.save(target, **save_kwargs)
    return round((time.perf_counter() - started) * 1000.0, 1)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hero", default="lester-original")
    parser.add_argument("--out", required=True, help="scratch output directory (never a shipped path)")
    parser.add_argument("--quality", type=int, default=90)
    args = parser.parse_args(argv)

    hero_dir = HERO_ROOT / args.hero
    atlas_png = hero_dir / f"{args.hero}-production-pilot-atlas.png"
    atlas_json = hero_dir / f"{args.hero}-production-pilot-atlas.json"
    if not atlas_png.is_file() or not atlas_json.is_file():
        print(f"hero atlas not found: {atlas_png}", file=sys.stderr)
        return 2
    out = Path(args.out).resolve()
    if REPO_ROOT in out.parents and ".tmp" not in out.relative_to(REPO_ROOT).parts:
        print(f"refusing to write variants inside the repo outside .tmp/: {out}", file=sys.stderr)
        return 2
    out.mkdir(parents=True, exist_ok=True)

    metadata = json.loads(atlas_json.read_text(encoding="utf-8"))
    frames = metadata.get("frames", [])
    frame_size = int(frames[0]["sourceSize"]["w"]) if frames else None

    source = Image.open(atlas_png)
    source.load()
    if source.mode != "RGBA":
        source = source.convert("RGBA")
    width, height = source.size

    variants: dict[str, dict] = {}

    png_copy = out / f"{args.hero}.png"
    shutil.copyfile(atlas_png, png_copy)
    variants["png"] = {
        "file": png_copy.name,
        "bytes": png_copy.stat().st_size,
        "encodeMs": 0.0,
        "encoder": "byte copy of the shipped atlas",
        "sha256": sha256_of(png_copy),
        "fidelity": fidelity(source, Image.open(png_copy)),
    }

    lossless = out / f"{args.hero}.lossless.webp"
    lossless_ms = encode(source, lossless, format="WEBP", lossless=True, quality=100, method=6, exact=True)
    variants["webp-lossless"] = {
        "file": lossless.name,
        "bytes": lossless.stat().st_size,
        "encodeMs": lossless_ms,
        "encoder": "Pillow WEBP lossless=True quality=100 method=6 exact=True",
        "sha256": sha256_of(lossless),
        "fidelity": fidelity(source, Image.open(lossless)),
    }

    lossy = out / f"{args.hero}.q{args.quality}.webp"
    lossy_ms = encode(source, lossy, format="WEBP", quality=args.quality, method=6)
    variants[f"webp-q{args.quality}"] = {
        "file": lossy.name,
        "bytes": lossy.stat().st_size,
        "encodeMs": lossy_ms,
        "encoder": f"Pillow WEBP quality={args.quality} method=6 alpha_quality=100",
        "sha256": sha256_of(lossy),
        "fidelity": fidelity(source, Image.open(lossy)),
    }

    ktx2_probe = {name: shutil.which(name) for name in KTX2_ENCODERS}
    try:
        import numpy  # type: ignore

        numpy_version = numpy.__version__
    except ImportError:
        numpy_version = None

    report = {
        "schema": "hmh-hero-atlas-format-conversion-v1",
        "hero": args.hero,
        "source": {
            "path": str(atlas_png.relative_to(REPO_ROOT)).replace("\\", "/"),
            "bytes": atlas_png.stat().st_size,
            "sha256": variants["png"]["sha256"],
            "width": width,
            "height": height,
            "mode": source.mode,
            "frames": len(frames),
            "frameSize": frame_size,
            "metadataBytes": atlas_json.stat().st_size,
        },
        "variants": variants,
        "ktx2": {
            "encoderFound": any(ktx2_probe.values()),
            "probed": ktx2_probe,
            "status": "not measurable on this host: no encoder installed" if not any(ktx2_probe.values()) else "encoder present; KTX2 encode not implemented in this harness",
        },
        "toolchain": {
            "python": platform.python_version(),
            "pillow": Image.__version__ if hasattr(Image, "__version__") else __import__("PIL").__version__,
            "libwebp": features.version("webp"),
            "numpy": numpy_version,
        },
        "shippedAssetTouched": False,
    }
    (out / "conversion.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
