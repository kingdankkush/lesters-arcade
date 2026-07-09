#!/usr/bin/env python3
"""Remove adjacent-frame bleed islands from Wasteland Debt Collector runtime PNGs."""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ROSTER_DIR = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-animated-roster" / "wasteland-debt-collector"
REPORT = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-animated-roster" / "wasteland-debt-collector" / "frame-polish-report.json"


def components(image: Image.Image, alpha_threshold: int = 24):
    rgba = image.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    seen = bytearray(w * h)
    found = []
    for sy in range(h):
        for sx in range(w):
            idx = sy * w + sx
            if seen[idx]:
                continue
            seen[idx] = 1
            if px[sx, sy][3] <= alpha_threshold:
                continue
            stack = [(sx, sy)]
            pts = []
            minx = maxx = sx
            miny = maxy = sy
            while stack:
                x, y = stack.pop()
                pts.append((x, y))
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nidx = ny * w + nx
                    if seen[nidx]:
                        continue
                    seen[nidx] = 1
                    if px[nx, ny][3] > alpha_threshold:
                        stack.append((nx, ny))
            found.append({"pixels": len(pts), "bbox": (minx, miny, maxx + 1, maxy + 1), "points": pts})
    found.sort(key=lambda c: c["pixels"], reverse=True)
    return found


def intersects_expanded(a, b, pad: int = 42) -> bool:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ax0 -= pad; ay0 -= pad; ax1 += pad; ay1 += pad
    return not (bx1 < ax0 or bx0 > ax1 or by1 < ay0 or by0 > ay1)


def clean_frame(path: Path):
    im = Image.open(path).convert("RGBA")
    comps = components(im)
    if len(comps) <= 1:
        return {"path": str(path.relative_to(ROOT)).replace("\\", "/"), "componentsBefore": len(comps), "removedComponents": 0, "removedPixels": 0}
    main = comps[0]
    px = im.load()
    removed_components = 0
    removed_pixels = 0
    for comp in comps[1:]:
        keep = False
        # Keep only islands that are close enough to the main body silhouette to
        # read as a hand/weapon/collapse fragment. Neighboring-frame bleed usually
        # appears as a disconnected strip near a canvas edge or floating above the
        # actor, so even large distant islands should be removed.
        main_box = main["bbox"]
        comp_box = comp["bbox"]
        floating_above = comp_box[3] <= main_box[1] + 12
        detached_side = comp_box[0] > main_box[2] + 18 or comp_box[2] < main_box[0] - 18
        if (not floating_above and not detached_side and intersects_expanded(main_box, comp_box, 24) and comp["pixels"] >= 40):
            keep = True
        if keep:
            continue
        removed_components += 1
        removed_pixels += comp["pixels"]
        for x, y in comp["points"]:
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    if removed_components:
        im.save(path, optimize=True)
    after = components(im)
    return {
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "componentsBefore": len(comps),
        "componentsAfter": len(after),
        "removedComponents": removed_components,
        "removedPixels": removed_pixels,
    }


def main() -> None:
    paths = sorted(p for p in ROSTER_DIR.rglob("*.png") if p.is_file())
    results = [clean_frame(path) for path in paths]
    changed = [r for r in results if r["removedComponents"]]
    report = {
        "id": "wasteland-debt-collector-frame-polish-v1",
        "policy": "Remove small disconnected alpha islands from sliced frames; preserve the main body silhouette and nearby weapon/death fragments.",
        "checkedFrames": len(results),
        "changedFrames": len(changed),
        "removedComponents": sum(r["removedComponents"] for r in changed),
        "removedPixels": sum(r["removedPixels"] for r in changed),
        "changed": changed,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
