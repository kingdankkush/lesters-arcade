"""2.0 trophy and founder achievement badges (plan track G1, badge art lane).

Six badges in the tier-frame style of generate-game-achievement-badges.py: the
Hard Money Heroes tier frame (apps/portal/assets/generated/hmh-achievement-atlas/
tier-<tier>.png) with a composed glyph, as 48x48 RGBA PNGs next to the HMH badges:

    apps/portal/assets/generated/achievement-badges/<id>.png
    apps/portal/assets/generated/achievement-badges/locked-<id>.png

Glyphs are layered Pillow vector shapes plus crops of existing repo art (the
Chikun cabinet marquee rooster, the STACKED cabinet blocks); no downloaded or AI-generated pixels. Glyphs are drawn at 4x and
Lanczos-reduced once, so the result reads at 64 px and 48 px. Locked variants
are the unlocked badge in dimmed greyscale, like the other badges.

    python scripts/generate-trophy-achievement-badges.py          write the badges
    python scripts/generate-trophy-achievement-badges.py --check  fail if they differ
"""
import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "apps" / "portal" / "assets"
TIER_FRAMES = ASSETS / "generated" / "hmh-achievement-atlas"
OUT = ASSETS / "generated" / "achievement-badges"
SIZE = 48
GLYPH = 28
SCALE = 4
CANVAS = GLYPH * SCALE
WINDOW_CENTER = (24, 20)
BUDGET_BYTES = 40 * 1024

# id -> (tier, drawing function name). Tiers follow the catalogs.
BADGES = {
    "early-supporter": "gold",
    "full-roster-run": "mythic",
    "boss-rush-fifty": "mythic",
    "world-escape": "mythic",
    "stacked-final-zone": "mythic",
    "chikun-escape-complete": "platinum",
}

INK = (10, 12, 24, 255)
PAPER = (236, 240, 250, 255)
GOLD = (255, 213, 74, 255)
GOLD_DEEP = (196, 132, 24, 255)
DAWN = (255, 150, 72, 255)
DAWN_SKY = (120, 70, 140, 255)
MYTHIC = (255, 75, 211, 255)
MYTHIC_DEEP = (122, 24, 96, 255)
PLATINUM = (123, 246, 255, 255)
STEEL = (170, 184, 204, 255)
STEEL_DEEP = (74, 86, 110, 255)
GRASS = (72, 150, 88, 255)
GRASS_DEEP = (36, 84, 52, 255)
ROAD = (92, 94, 110, 255)
ROAD_LINE = (255, 232, 140, 255)
TALLY = (255, 71, 111, 255)
RING = (255, 232, 77, 255)

SOURCES = {
    "chikun": ASSETS / "generated" / "chikun-cabinet" / "chikun-cabinet-front.png",
    "stacked": ASSETS / "stacked-cabinet" / "stacked-cabinet-turnaround-v1.png",
}


def S(*values):
    """Scale badge-space coordinates (28 px glyph space) to the 4x canvas."""
    return [v * SCALE for v in values]


def canvas():
    return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))


def lifted_crop(path, box, floor):
    """Crop existing art and lift it off its dark background (as the game badges do)."""
    art = Image.open(path).convert("RGBA").crop(box)
    value = art.convert("L")
    alpha = value.point(lambda v: 0 if v < floor else min(255, (v - floor) * 4))
    art.putalpha(ImageOps.autocontrast(alpha) if alpha.getbbox() else alpha)
    bbox = art.getbbox()
    if bbox is None:
        raise SystemExit(f"crop of {path.name} is empty")
    return art.crop(bbox)


def fit(art, width, height):
    scale = min(width / art.size[0], height / art.size[1])
    size = (max(1, round(art.size[0] * scale)), max(1, round(art.size[1] * scale)))
    return art.resize(size, Image.LANCZOS)


def draw_litecoin_l(draw, cx, cy, h, color, width):
    """A plain Ł: vertical stem, base foot, crossing stroke (vector, no font)."""
    top = cy - h / 2
    bottom = cy + h / 2
    stem_x = cx - h * 0.12
    draw.line(S(stem_x, top, stem_x, bottom), fill=color, width=round(width * SCALE))
    draw.line(S(stem_x - width / 2, bottom, cx + h * 0.32, bottom), fill=color, width=round(width * SCALE))
    draw.line(S(cx - h * 0.4, cy + h * 0.12, cx + h * 0.16, cy - h * 0.14), fill=color, width=round(width * 0.85 * SCALE))


def glyph_early_supporter():
    img = canvas()
    d = ImageDraw.Draw(img)
    # Dawn sky and sun on the horizon.
    d.rectangle(S(1, 13, 27, 27), fill=DAWN_SKY)
    d.pieslice(S(6, 15, 22, 31), 180, 360, fill=DAWN)
    d.pieslice(S(9, 18, 19, 28), 180, 360, fill=GOLD)
    d.rectangle(S(1, 23, 27, 27), fill=GRASS_DEEP)
    d.line(S(1, 23, 27, 23), fill=GOLD, width=SCALE)
    # Lit marquee: dark board, bulb rail, Ł in gold.
    d.rounded_rectangle(S(3, 1, 25, 17), radius=3 * SCALE, fill=INK)
    d.rounded_rectangle(S(4.5, 2.5, 23.5, 15.5), radius=2 * SCALE, fill=GOLD_DEEP)
    d.rounded_rectangle(S(6, 4, 22, 14), radius=1.5 * SCALE, fill=INK)
    for x in (5.2, 9.5, 14, 18.5, 22.8):
        for y in (3.2, 14.8):
            d.ellipse(S(x - 0.9, y - 0.9, x + 0.9, y + 0.9), fill=PAPER)
    draw_litecoin_l(d, 14, 9, 8.5, GOLD, 2.2)
    return img


def silhouette(d, cx, top, w, kind):
    """A boss silhouette: steel body with an ink rim and one distinguishing mark."""
    h = w * 1.25
    rim = round(0.7 * SCALE)
    d.ellipse(S(cx - w * 0.28, top, cx + w * 0.28, top + w * 0.56), fill=STEEL, outline=INK, width=rim)
    d.rounded_rectangle(S(cx - w / 2, top + w * 0.5, cx + w / 2, top + h), radius=SCALE, fill=STEEL, outline=INK, width=rim)
    if kind == "baron":  # top hat
        d.rectangle(S(cx - w * 0.3, top - w * 0.35, cx + w * 0.3, top + w * 0.1), fill=STEEL, outline=INK, width=rim)
        d.rectangle(S(cx - w * 0.45, top + 0.02 * w, cx + w * 0.45, top + w * 0.16), fill=STEEL, outline=INK, width=rim)
    elif kind == "lockkeeper":  # keyring
        d.ellipse(S(cx + w * 0.3, top + w * 0.7, cx + w * 0.62, top + w * 1.02), fill=INK)
        d.ellipse(S(cx + w * 0.38, top + w * 0.78, cx + w * 0.54, top + w * 0.94), fill=STEEL)
    elif kind == "foreman":  # hard hat
        d.pieslice(S(cx - w * 0.36, top - w * 0.12, cx + w * 0.36, top + w * 0.5), 180, 360, fill=GOLD, outline=INK, width=rim)
        d.rectangle(S(cx - w * 0.42, top + w * 0.17, cx + w * 0.42, top + w * 0.27), fill=GOLD, outline=INK, width=rim)
    elif kind == "liquidator":  # mask slits
        d.rectangle(S(cx - w * 0.2, top + w * 0.22, cx - w * 0.05, top + w * 0.3), fill=INK)
        d.rectangle(S(cx + w * 0.05, top + w * 0.22, cx + w * 0.2, top + w * 0.3), fill=INK)


def glyph_full_roster_run():
    img = canvas()
    d = ImageDraw.Draw(img)
    # The Litecoin mark in the middle, the four bosses closing in from the corners.
    d.ellipse(S(7, 7, 21, 21), fill=INK)
    d.ellipse(S(8.2, 8.2, 19.8, 19.8), fill=GOLD)
    d.ellipse(S(9.6, 9.6, 18.4, 18.4), outline=GOLD_DEEP, width=SCALE)
    draw_litecoin_l(d, 14.2, 14, 7, INK, 1.6)
    for cx, top, kind in ((4.5, 1.5, "baron"), (23.5, 1.5, "lockkeeper"), (4.5, 19, "foreman"), (23.5, 19, "liquidator")):
        silhouette(d, cx, top, 7, kind)
    return img


def glyph_boss_rush_fifty():
    img = canvas()
    d = ImageDraw.Draw(img)
    # Liquidator mask: pale plate, dark rim, eye slits, breathing holes.
    d.rounded_rectangle(S(5, 2, 23, 26), radius=7 * SCALE, fill=INK)
    d.rounded_rectangle(S(6.5, 3.5, 21.5, 24.5), radius=6 * SCALE, fill=STEEL)
    d.rounded_rectangle(S(8, 5, 20, 12), radius=2 * SCALE, fill=PAPER)
    d.rectangle(S(9, 8, 13, 10), fill=INK)
    d.rectangle(S(15, 8, 19, 10), fill=INK)
    for x in (11, 14, 17):
        for y in (15, 18):
            d.ellipse(S(x - 0.6, y - 0.6, x + 0.6, y + 0.6), fill=STEEL_DEEP)
    d.line(S(10, 21.5, 18, 21.5), fill=STEEL_DEEP, width=SCALE)
    # Tally marks scratched across the cheek: four strokes and the fifth diagonal.
    for i in range(4):
        x = 8.5 + i * 2.7
        d.line(S(x, 13, x, 20), fill=TALLY, width=round(1.3 * SCALE))
    d.line(S(7.5, 19.5, 18.5, 13.5), fill=TALLY, width=round(1.3 * SCALE))
    return img


def glyph_world_escape():
    img = canvas()
    d = ImageDraw.Draw(img)
    # The ten-area map as a green land mass with area patches.
    d.ellipse(S(1, 9, 27, 29), fill=GRASS_DEEP)
    d.ellipse(S(2.5, 10.5, 25.5, 27.5), fill=GRASS)
    for x, y in ((5, 15), (21, 14), (8, 23), (20, 23), (14, 25)):
        d.ellipse(S(x - 1.6, y - 1.1, x + 1.6, y + 1.1), fill=GRASS_DEEP)
    # Fortress keep on the horizon: crenellated tower and walls.
    d.rectangle(S(7.5, 5.5, 20.5, 11), fill=INK)
    d.rectangle(S(10.5, 1.5, 17.5, 11), fill=INK)
    d.rectangle(S(8.5, 6.5, 19.5, 11), fill=STEEL_DEEP)
    d.rectangle(S(11.5, 2.5, 16.5, 11), fill=STEEL)
    for x in (11.5, 13.9, 16.3):
        d.rectangle(S(x, 1, x + 1.2, 2.5), fill=STEEL)
    for x in (8.5, 18.3):
        d.rectangle(S(x, 5, x + 1.2, 6.5), fill=STEEL_DEEP)
    d.rectangle(S(13.4, 7, 14.6, 9.5), fill=MYTHIC)
    # The road leaving the map toward the viewer, past the lower edge.
    d.polygon(S(13, 11, 15, 11, 21, 28, 7, 28), fill=INK)
    d.polygon(S(13.3, 11.5, 14.7, 11.5, 20, 28, 8, 28), fill=ROAD)
    d.polygon(S(13.6, 11, 14.4, 11, 15.3, 16, 12.7, 16), fill=ROAD_LINE)
    d.polygon(S(13.2, 18, 14.8, 18, 15.6, 23, 12.4, 23), fill=ROAD_LINE)
    d.polygon(S(12.8, 25, 15.2, 25, 16.2, 28, 11.8, 28), fill=ROAD_LINE)
    return img


def glyph_stacked_final_zone():
    img = canvas()
    d = ImageDraw.Draw(img)
    # Final zone ring at the top, the tower of blocks climbing into it.
    d.ellipse(S(7, 1, 21, 15), outline=RING, width=round(1.6 * SCALE))
    d.ellipse(S(9.5, 3.5, 18.5, 12.5), outline=(255, 255, 255, 110), width=SCALE)
    blocks = lifted_crop(SOURCES["stacked"], (1168, 138, 1238, 208), 70)
    tiers = ((2, 26, 10), (5, 21, 8), (8, 16.5, 6), (11, 12.5, 4.5))  # (x, y, width) of each course
    for i, (x, y, w) in enumerate(tiers):
        colour = (MYTHIC, PLATINUM, RING, PAPER)[i]
        count = 3 if i < 2 else 2
        bw = w / count * 2 if i < 2 else w
        for j in range(count):
            bx = 14 - (count * bw) / 2 + j * bw
            d.rectangle(S(bx + 0.3, y, bx + bw - 0.3, y + 3.8), fill=INK)
            d.rectangle(S(bx + 0.9, y + 0.6, bx + bw - 0.9, y + 3.2), fill=colour)
    glow = fit(blocks, 7 * SCALE, 7 * SCALE)
    img.alpha_composite(glow, ((CANVAS - glow.size[0]) // 2, round(3.5 * SCALE)))
    return img


def glyph_chikun_escape_complete():
    img = canvas()
    d = ImageDraw.Draw(img)
    # Finish gate: two posts, a checkered banner, the ground line.
    d.rectangle(S(2, 3, 4, 27), fill=INK)
    d.rectangle(S(24, 3, 26, 27), fill=INK)
    d.rectangle(S(2, 2, 26, 8), fill=INK)
    for col in range(8):
        for row in range(2):
            if (col + row) % 2 == 0:
                d.rectangle(S(3.2 + col * 2.7, 3 + row * 2.2, 3.2 + col * 2.7 + 2.7, 3 + row * 2.2 + 2.2), fill=PAPER)
    d.rectangle(S(1, 26, 27, 27.5), fill=STEEL_DEEP)
    # Chikun bursting through: the marquee rooster lifted from the cabinet art, with a motion streak.
    for i, a in enumerate((90, 60, 30)):
        d.line(S(4 + i * 2, 15 + i * 2.5, 10 + i * 2, 15 + i * 2.5), fill=(PLATINUM[0], PLATINUM[1], PLATINUM[2], a), width=SCALE)
    rooster = fit(lifted_crop(SOURCES["chikun"], (94, 76, 122, 111), 34), 15 * SCALE, 16 * SCALE)
    img.alpha_composite(rooster, (round(9 * SCALE), round(9.5 * SCALE)))
    return img


GLYPHS = {
    "early-supporter": glyph_early_supporter,
    "full-roster-run": glyph_full_roster_run,
    "boss-rush-fifty": glyph_boss_rush_fifty,
    "world-escape": glyph_world_escape,
    "stacked-final-zone": glyph_stacked_final_zone,
    "chikun-escape-complete": glyph_chikun_escape_complete,
}


def badge(tier, glyph_4x):
    frame = Image.open(TIER_FRAMES / f"tier-{tier}.png").convert("RGBA").resize((SIZE, SIZE), Image.NEAREST)
    glyph = glyph_4x.resize((GLYPH, GLYPH), Image.LANCZOS)
    # A 1 px dark outline keeps the glyph legible on every tier colour (as the game badges do).
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
    return Image.merge("RGBA", (grey, grey, grey, image.getchannel("A")))


def png_bytes(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def render():
    files = {}
    for badge_id, tier in BADGES.items():
        unlocked = badge(tier, GLYPHS[badge_id]())
        files[OUT / f"{badge_id}.png"] = png_bytes(unlocked)
        files[OUT / f"locked-{badge_id}.png"] = png_bytes(locked(unlocked))
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
