"""Placeholder achievement badges for Chikun's Escape and STACKED.

Each badge is the Hard Money Heroes tier frame
(apps/portal/assets/generated/hmh-achievement-atlas/tier-<tier>.png) with a small
glyph cut from that game's existing cabinet art, as 48x48 RGBA PNGs:

    apps/portal/assets/generated/achievement-badges/<game>/<tier>.png
    apps/portal/assets/generated/achievement-badges/<game>/locked-<tier>.png

The locked badge is the unlocked one in dimmed greyscale. Nothing else is
written: no intermediate or raw output reaches the repo (AGENTS.md asset
hygiene). The art is a launch placeholder; the owner plans a full upgrade.

    python scripts/generate-game-achievement-badges.py          write the badges
    python scripts/generate-game-achievement-badges.py --check  fail if they differ
"""
import io
import sys
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "apps" / "portal" / "assets"
TIER_FRAMES = ASSETS / "generated" / "hmh-achievement-atlas"
OUT = ASSETS / "generated" / "achievement-badges"
TIERS = ("bronze", "silver", "gold", "platinum")
SIZE = 48
GLYPH = 20
# The frame's round window, in 48 px badge space (the 64 px frame scaled by 0.75).
WINDOW_CENTER = (24, 20)
BUDGET_BYTES = 60 * 1024

# Glyph sources: a crop box of existing cabinet art and how to lift it off its
# dark background (pixels darker than `floor` become transparent).
GAMES = {
    "chikun": {
        "source": ASSETS / "generated" / "chikun-cabinet" / "chikun-cabinet-front.png",
        "box": (94, 76, 122, 111),  # the rooster head on the marquee
        "floor": 34,
    },
    "stacked": {
        "source": ASSETS / "stacked-cabinet" / "stacked-cabinet-turnaround-v1.png",
        "box": (1168, 138, 1238, 208),  # the three glowing blocks on the back panel
        "floor": 70,
    },
}


def glyph_for(spec):
    art = Image.open(spec["source"]).convert("RGBA").crop(spec["box"])
    value = art.convert("L")
    alpha = value.point(lambda v: 0 if v < spec["floor"] else min(255, (v - spec["floor"]) * 4))
    art.putalpha(ImageOps.autocontrast(alpha) if alpha.getbbox() else alpha)
    bbox = art.getbbox()
    if bbox is None:
        raise SystemExit(f"glyph crop for {spec['source'].name} is empty")
    art = art.crop(bbox)
    scale = GLYPH / max(art.size)
    size = (max(1, round(art.size[0] * scale)), max(1, round(art.size[1] * scale)))
    return art.resize(size, Image.LANCZOS)


def badge(tier, glyph):
    frame = Image.open(TIER_FRAMES / f"tier-{tier}.png").convert("RGBA").resize((SIZE, SIZE), Image.NEAREST)
    # A 1 px dark outline keeps the glyph legible on every tier colour.
    pad = Image.new("L", (glyph.size[0] + 2, glyph.size[1] + 2), 0)
    pad.paste(glyph.getchannel("A"), (1, 1))
    ring = pad.point(lambda a: 255 if a > 40 else 0).filter(ImageFilter.MaxFilter(3))
    outline = Image.new("RGBA", pad.size, (10, 12, 24, 0))
    outline.putalpha(ring.point(lambda a: a * 9 // 10))
    x = WINDOW_CENTER[0] - glyph.size[0] // 2
    y = WINDOW_CENTER[1] - glyph.size[1] // 2
    frame.alpha_composite(outline, (x - 1, y - 1))
    frame.alpha_composite(glyph, (x, y))
    return frame


def locked(image):
    grey = ImageOps.grayscale(image).point(lambda v: 28 + v * 45 // 100)
    out = Image.merge("RGBA", (grey, grey, grey, image.getchannel("A")))
    return out


def png_bytes(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def render():
    files = {}
    for game, spec in GAMES.items():
        glyph = glyph_for(spec)
        for tier in TIERS:
            unlocked = badge(tier, glyph)
            files[OUT / game / f"{tier}.png"] = png_bytes(unlocked)
            files[OUT / game / f"locked-{tier}.png"] = png_bytes(locked(unlocked))
    total = sum(len(data) for data in files.values())
    if total > BUDGET_BYTES:
        raise SystemExit(f"badges total {total} bytes, over the {BUDGET_BYTES} byte budget")
    return files, total


def main():
    check = "--check" in sys.argv[1:]
    files, total = render()
    stale = []
    for path, data in files.items():
        if path.exists() and path.read_bytes() == data:
            continue
        if check:
            stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    if stale:
        raise SystemExit("badges differ from the generator:\n" + "\n".join(stale))
    print(f"{'Checked' if check else 'Wrote'} {len(files)} badges, {total} bytes")


if __name__ == "__main__":
    main()
