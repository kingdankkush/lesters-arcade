"""Build the small arcade avatar thumbnails (contract §7.8, guide §3.5).

The Lit Commando, Lit Valkyrie, Lester and Lilly arcade avatars used to point
at the full hero-selector portrait strips (1920x384, about 0.5 MB each), which
the leaderboard rows, the podium, the profile hero and the name editor show as
56 px chips. This crops a head-and-shoulders square from the first portrait
frame (centred on the head, found from the alpha channel) and writes a 128 px
WebP next to the other generated art, so a board of avatars stays small on a
phone. The avatar ids and 'lestersarcade:avatar/<id>' URIs do not change.

Usage: python scripts/build-arcade-avatar-thumbnails.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PORTRAITS = ROOT / "apps/portal/assets/generated/hmh-hero-portraits"
OUT_DIR = ROOT / "apps/portal/assets/generated/arcade-avatars"

# avatar id (apps/portal/src/arcade-avatars.mjs) -> hero portrait strip
AVATARS = {
    "lit-commando": "lit-commando.webp",
    "lit-valkyrie": "lit-valkyrie.webp",
    "lester": "lester-original.webp",
    "lilly": "lilly.webp",
}
FRAME = 384  # the strips are five 384x384 frames side by side
CROP = 192  # head and shoulders
TOP = 24
HEAD_BAND = (36, 120)  # rows that hold the head in every portrait
SIZE = 128
QUALITY = 82


def head_centre_x(frame: Image.Image) -> int:
    alpha = frame.getchannel("A")
    box = alpha.crop((0, HEAD_BAND[0], FRAME, HEAD_BAND[1])).getbbox()
    if not box:
        return FRAME // 2
    return (box[0] + box[2]) // 2


def build() -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = {}
    for avatar_id, source_name in AVATARS.items():
        source = PORTRAITS / source_name
        with Image.open(source) as strip:
            frame = strip.convert("RGBA").crop((0, 0, FRAME, FRAME))
        centre = head_centre_x(frame)
        left = min(max(0, centre - CROP // 2), FRAME - CROP)
        crop = (left, TOP, left + CROP, TOP + CROP)
        thumb = frame.crop(crop).resize((SIZE, SIZE), Image.LANCZOS)
        target = OUT_DIR / f"{avatar_id}.webp"
        thumb.save(target, "WEBP", quality=QUALITY, method=6)
        records[avatar_id] = {
            "source": source.relative_to(ROOT).as_posix(),
            "crop": list(crop),
            "size": SIZE,
            "bytes": target.stat().st_size,
        }
    manifest = {
        "generatedBy": "scripts/build-arcade-avatar-thumbnails.py",
        "avatars": records,
    }
    (OUT_DIR / "arcade-avatars.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    return manifest


if __name__ == "__main__":
    for avatar_id, record in build()["avatars"].items():
        print(f"{avatar_id}: {record['bytes']} B from {record['source']} crop {record['crop']}")
