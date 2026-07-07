#!/usr/bin/env python3
"""Remove generated matte backgrounds from WO-102 PixelLab mega-prop candidates.

This does not synthesize or draw replacement art. It flood-fills only pixels
connected to image corners and makes that matte transparent so PixelLab output
can be used as runtime sprites without rectangular cards.
"""
from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
WO_ROOT = ROOT / "apps/portal/assets/generated/hmh-wo102-megaprops"
LEDGER = WO_ROOT / "wo102-megaprops-ledger.json"
CANDIDATES = WO_ROOT / "candidates"
PROCESSED = WO_ROOT / "processed"
SHEET = WO_ROOT / "wo102-megaprops-alpha-sheet.png"


def color_dist(a, b):
    return sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)) ** 0.5


def remove_corner_matte(src: Path, dest: Path, tolerance: float = 30.0) -> dict:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    pix = im.load()
    corner_colors = [pix[0, 0], pix[w - 1, 0], pix[0, h - 1], pix[w - 1, h - 1]]
    visited = bytearray(w * h)
    q = deque([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    removed = 0
    while q:
        x, y = q.popleft()
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        idx = y * w + x
        if visited[idx]:
            continue
        px = pix[x, y]
        # Only remove opaque-ish corner-connected matte colors. This preserves
        # object interiors, strong baked shadows, and colored ground apron islands.
        if min(color_dist(px, c) for c in corner_colors) > tolerance:
            continue
        visited[idx] = 1
        pix[x, y] = (px[0], px[1], px[2], 0)
        removed += 1
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    alphas = [a for *_, a in im.getdata()]
    corners = [im.getpixel((0, 0))[3], im.getpixel((w - 1, 0))[3], im.getpixel((0, h - 1))[3], im.getpixel((w - 1, h - 1))[3]]
    return {
        "src": str(src.relative_to(ROOT)).replace("\\", "/"),
        "dest": str(dest.relative_to(ROOT)).replace("\\", "/"),
        "removedPixels": removed,
        "transparentRatio": round(sum(1 for a in alphas if a == 0) / len(alphas), 4),
        "cornerAlpha": corners,
        "alphaClean": all(a == 0 for a in corners),
    }


def process_all() -> list[dict]:
    results = []
    for src in sorted(CANDIDATES.glob("*/*.png")):
        dest = PROCESSED / src.parent.name / src.name
        results.append(remove_corner_matte(src, dest))
    (WO_ROOT / "wo102-alpha-postprocess-report.json").write_text(json.dumps({"processed": results}, indent=2) + "\n", encoding="utf-8")
    return results


def write_sheet() -> None:
    files = sorted(PROCESSED.glob("*/*.png"))
    if not files:
        print("no processed files")
        return
    thumb = 160
    label_h = 28
    cols = 5
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * thumb, rows * (thumb + label_h)), (24, 20, 16, 255))
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(files):
        im = Image.open(path).convert("RGBA")
        im.thumbnail((thumb, thumb), Image.Resampling.NEAREST)
        x0 = (i % cols) * thumb + (thumb - im.width) // 2
        y0 = (i // cols) * (thumb + label_h)
        # checker helps verify transparency without becoming asset content
        for yy in range(y0, y0 + thumb, 8):
            for xx in range((i % cols) * thumb, (i % cols + 1) * thumb, 8):
                c = (54, 50, 44, 255) if ((xx // 8 + yy // 8) % 2) else (84, 78, 70, 255)
                draw.rectangle([xx, yy, xx + 7, yy + 7], fill=c)
        sheet.alpha_composite(im, (x0, y0))
        label = f"{path.parent.name.replace('wo102-', '')[:15]} {path.stem[-2:]}"
        draw.text(((i % cols) * thumb + 4, y0 + thumb + 4), label, fill=(255, 232, 77, 255))
    sheet.save(SHEET)
    print(f"wrote {SHEET.relative_to(ROOT)} with {len(files)} processed candidates")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["process", "sheet", "all"])
    args = parser.parse_args()
    if args.action in {"process", "all"}:
        results = process_all()
        print(json.dumps({"processed": len(results), "alphaClean": sum(1 for r in results if r["alphaClean"])}, indent=2))
    if args.action in {"sheet", "all"}:
        write_sheet()


if __name__ == "__main__":
    main()
