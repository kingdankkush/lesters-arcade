#!/usr/bin/env python
"""Ingest Justin's hand-made Level Environment Assets into the repo.

Source: .../Art Assets/Level Environment Assets (148 transparent PNGs, a mix of
wide parallax background strips and standalone building/prop objects).

This tool copies them into the repo under a stable, content-hashed name, trims
fully-transparent margins, classifies each by aspect ratio into
'parallax-bg' (wide strips) vs 'prop' (buildings/objects), downscales oversized
images to a sane runtime max, and emits a manifest the level renderer consumes.

No regeneration here — these are canonical authored assets. Generation tools are
only used elsewhere to ADD new tiles/VFX.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

SRC = Path(r"C:/Users/just_/Desktop/My Stuff/Lester's Arcade/Hard Money Heroes/Art Assets/Level Environment Assets")
ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-level-environment")
OUT_ROOT = ROOT / PUBLIC_ROOT
MANIFEST_MJS = OUT_ROOT / "hmh-level-environment.mjs"

MAX_W = 1600   # runtime cap for width (parallax strips)
MAX_H = 900


def trim_transparent(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def classify(w: int, h: int) -> str:
    aspect = w / max(1, h)
    if aspect >= 2.4:
        return "parallax-bg"   # wide scrolling strip
    if 0.6 <= aspect <= 1.7:
        return "prop"          # building / object
    return "decor"             # tall or odd -> set dressing


def downscale(im: Image.Image) -> Image.Image:
    w, h = im.size
    scale = min(1.0, MAX_W / w, MAX_H / h)
    if scale < 1.0:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    return im


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"source not found: {SRC}")
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    entries = []
    by_class = {"parallax-bg": 0, "prop": 0, "decor": 0}
    errors = 0
    for sp in sorted(SRC.glob("*.png")):
        try:
            im = trim_transparent(Image.open(sp))
            im = downscale(im)
            w, h = im.size
            kind = classify(w, h)
            # Stable content-hash filename (avoids leaking the ChatGPT timestamp names).
            digest = hashlib.sha1(sp.read_bytes()).hexdigest()[:12]
            name = f"{kind}-{digest}.png"
            dest = OUT_ROOT / kind / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest)
            entries.append({
                "id": f"{kind}-{digest}",
                "kind": kind,
                "src": f"./assets/generated/hmh-level-environment/{kind}/{name}",
                "width": w,
                "height": h,
            })
            by_class[kind] += 1
        except Exception as exc:
            (OUT_ROOT / f"{sp.stem}.error.txt").write_text(str(exc), encoding="utf-8")
            errors += 1

    manifest = {
        "id": "hmh-level-environment-v1",
        "source": "Justin canonical hand-made level environment art (trimmed, downscaled)",
        "counts": by_class,
        "total": len(entries),
        "parallaxBackgrounds": [e for e in entries if e["kind"] == "parallax-bg"],
        "props": [e for e in entries if e["kind"] == "prop"],
        "decor": [e for e in entries if e["kind"] == "decor"],
    }
    MANIFEST_MJS.write_text(
        "// Canonical level-environment manifest (Justin's hand-made art).\n"
        "export const HMH_LEVEL_ENVIRONMENT = Object.freeze(" + json.dumps(manifest, indent=2) + ");\n",
        encoding="utf-8",
    )
    print(json.dumps({"ingested": len(entries), "by_class": by_class, "errors": errors}, indent=2))


if __name__ == "__main__":
    main()
