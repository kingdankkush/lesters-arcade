#!/usr/bin/env python3
"""
Lester's Arcade — Asset Optimization Script

Compresses large PNG images and optimizes the portal for faster loading.
Uses Pillow (PIL) for lossless PNG optimization + JPEG re-compression.

Usage: python scripts/optimize-assets.py
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Pillow is not installed. Install with: pip install Pillow")
    sys.exit(1)

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "apps" / "portal" / "assets"

# Files larger than this (in bytes) get optimized
THRESHOLD = 100_000  # 100KB

# Directories to optimize
TARGET_DIRS = [
    ASSETS / "generated" / "hmh-key-art",
    ASSETS / "generated" / "hmh-level-environment",
    ASSETS / "generated" / "hmh-canonical-art",
    ASSETS / "generated" / "hmh-production-art-pass",
    ASSETS / "generated" / "hmh-banners",
    ASSETS / "hard-money-heroes" / "screens",
    ASSETS / "hard-money-heroes" / "reference",
    ASSETS / "hard-money-heroes" / "cabinet" / "source",
    ASSETS / "hard-money-heroes" / "stills",
]

def optimize_png(path):
    """Optimize a PNG file by re-saving with maximum compression."""
    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img)
            # Preserve mode (RGBA for sprites, RGB for photos)
            original_size = path.stat().st_size
            img.save(path, format="PNG", optimize=True, compress_level=9)
            new_size = path.stat().st_size
            saved = original_size - new_size
            if saved > 0:
                pct = (saved / original_size) * 100
                return (original_size, new_size, saved, pct)
            return (original_size, new_size, 0, 0)
    except Exception as e:
        print(f"  ERROR: {path.name}: {e}")
        return (0, 0, 0, 0)

def optimize_jpg(path):
    """Re-compress a JPEG at quality 85 (visually lossless for web)."""
    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode != "RGB":
                img = img.convert("RGB")
            original_size = path.stat().st_size
            img.save(path, format="JPEG", quality=85, optimize=True, progressive=True)
            new_size = path.stat().st_size
            saved = original_size - new_size
            if saved > 0:
                pct = (saved / original_size) * 100
                return (original_size, new_size, saved, pct)
            return (original_size, new_size, 0, 0)
    except Exception as e:
        print(f"  ERROR: {path.name}: {e}")
        return (0, 0, 0, 0)

def main():
    total_original = 0
    total_new = 0
    files_optimized = 0
    files_skipped = 0

    print("=== Lester's Arcade Asset Optimization ===")
    print(f"Threshold: files > {THRESHOLD // 1024}KB")
    print()

    for target_dir in TARGET_DIRS:
        if not target_dir.exists():
            continue

        print(f"Scanning: {target_dir.relative_to(REPO)}")
        for root, dirs, files in os.walk(target_dir):
            for fname in files:
                fpath = Path(root) / fname
                if not fpath.is_file():
                    continue

                fsize = fpath.stat().st_size
                if fsize < THRESHOLD:
                    files_skipped += 1
                    continue

                ext = fpath.suffix.lower()
                if ext == ".png":
                    orig, new, saved, pct = optimize_png(fpath)
                elif ext in (".jpg", ".jpeg"):
                    orig, new, saved, pct = optimize_jpg(fpath)
                else:
                    continue

                if saved > 0:
                    total_original += orig
                    total_new += new
                    files_optimized += 1
                    if saved > 1000:
                        print(f"  {fname}: {orig // 1024}KB -> {new // 1024}KB (-{pct:.0f}%)")
                else:
                    total_original += orig
                    total_new += orig

    print()
    print("=== Optimization Complete ===")
    print(f"Files optimized: {files_optimized}")
    print(f"Files skipped (under threshold): {files_skipped}")
    if total_original > 0:
        total_saved = total_original - total_new
        pct = (total_saved / total_original) * 100
        print(f"Total: {total_original // (1024*1024)}MB -> {total_new // (1024*1024)}MB (saved {total_saved // (1024*1024)}MB, {pct:.1f}%)")

if __name__ == "__main__":
    main()
