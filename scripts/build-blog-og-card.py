"""Compose the 1200x630 share image for the 2.0.0 release article.

Pure Pillow over committed, gore-free art: the text-free HMH cabinet key art
and the Chikun and STACKED share cards. The title is set in a system font
(Bahnschrift, then Segoe UI Bold, then Pillow's default) so nothing is
downloaded or generated. Output: apps/portal/assets/share-cards/blog/.

    python scripts/build-blog-og-card.py
"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "apps" / "portal" / "assets"
OUT = ASSETS / "share-cards" / "blog" / "lesters-arcade-2-0-first-drop.jpg"
W, H = 1200, 630
NAVY = (5, 7, 15)
CYAN = (25, 247, 255)
WHITE = (236, 238, 244)
MUTED = (160, 168, 190)
FONT_CANDIDATES = ["bahnschrift.ttf", "segoeuib.ttf", "arialbd.ttf"]


def font(size: int) -> ImageFont.ImageFont:
    fonts_dir = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    for name in FONT_CANDIDATES:
        path = fonts_dir / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size)


def cover(image: Image.Image, box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    """Crop `box` from `image`, then scale it to fill `size` exactly."""
    crop = image.crop(box)
    scale = max(size[0] / crop.width, size[1] / crop.height)
    resized = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def rounded(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius=radius, fill=255)
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def main() -> None:
    hmh = Image.open(ASSETS / "generated" / "hmh-cabinet-key-art-textfree.png").convert("RGB")
    chikun = Image.open(ASSETS / "share-cards" / "chikun.png").convert("RGB")
    stacked = Image.open(ASSETS / "share-cards" / "stacked.png").convert("RGB")

    canvas = Image.new("RGB", (W, H), NAVY)
    backdrop = ImageEnhance.Brightness(cover(stacked, (0, 0, 1200, 630), (W, H))).enhance(0.45)
    backdrop = backdrop.filter(ImageFilter.GaussianBlur(6))
    canvas.paste(backdrop, (0, 0))
    # A dark top band keeps the title legible over the backdrop.
    band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(band).rectangle((0, 0, W, 300), fill=(5, 7, 15, 200))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), band)

    tile = (340, 290)
    tiles = [
        cover(hmh, (60, 380, 516, 940), tile),
        cover(ImageEnhance.Brightness(chikun).enhance(1.6), (40, 40, 720, 500), tile),
        cover(ImageEnhance.Brightness(stacked).enhance(1.5), (330, 120, 870, 540), tile),
    ]
    for index, art in enumerate(tiles):
        x = 40 + index * 390
        y = 310
        frame = Image.new("RGBA", (tile[0] + 4, tile[1] + 4), (0, 0, 0, 0))
        ImageDraw.Draw(frame).rounded_rectangle((0, 0, tile[0] + 3, tile[1] + 3), radius=22, fill=(25, 247, 255, 110))
        canvas.alpha_composite(frame, (x - 2, y - 2))
        canvas.alpha_composite(rounded(art, 20), (x, y))

    draw = ImageDraw.Draw(canvas)
    draw.text((40, 48), "LESTER'S ARCADE 2.0", font=font(92), fill=CYAN)
    draw.text((42, 162), "The visual overhaul, first drop", font=font(48), fill=WHITE)
    draw.text((42, 228), "Hard Money Heroes  ·  Chikun's Escape  ·  STACKED", font=font(30), fill=MUTED)
    draw.text((W - 40, 48), "lestersarcade.io", font=font(28), fill=MUTED, anchor="ra")
    draw.ellipse((W - 48 - 8, 100, W - 48 + 8, 116), fill=(255, 232, 77))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    final = canvas.convert("RGB")
    quality = 86
    while True:
        final.save(OUT, "JPEG", quality=quality, optimize=True, progressive=True)
        if OUT.stat().st_size <= 300_000 or quality <= 50:
            break
        quality -= 4
    print(f"{OUT.relative_to(ROOT)}: {final.size[0]}x{final.size[1]}, {OUT.stat().st_size} bytes, quality {quality}")


if __name__ == "__main__":
    main()
