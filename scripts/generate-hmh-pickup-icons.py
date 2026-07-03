from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'apps' / 'portal' / 'assets' / 'generated' / 'hmh-pickup-icons'
MANIFEST_JSON = OUT_DIR / 'hmh-pickup-icons-manifest.json'
MANIFEST_MJS = OUT_DIR / 'hmh-pickup-icons-manifest.mjs'
CONTACT_SHEET = OUT_DIR / 'hmh-pickup-icons-contact-sheet.png'

P0_PICKUPS = [
    {
        'runtimeId': 'bonus-life',
        'title': 'Extra Hard Money Hero',
        'effect': 'life',
        'rarity': 'rare',
        'file': 'bonus-life.png',
        'description': 'Tiny Lester-inspired extra-life head icon with silver-blue halo.',
    },
    {
        'runtimeId': 'hash-rail-core',
        'title': 'Hash Rail Core',
        'effect': 'weapon',
        'rarity': 'rare',
        'file': 'hash-rail-core.png',
        'description': 'Glowing cyan-white rail core for the Hash Rail weapon pickup.',
    },
    {
        'runtimeId': 'time-dilation',
        'title': 'Block-Time Dilation',
        'effect': 'slowEnemies',
        'rarity': 'rare',
        'file': 'time-dilation.png',
        'description': 'Blue hourglass and block-time swirl for enemy slow pickup.',
    },
    {
        'runtimeId': 'berserk-candle',
        'title': 'Green-Candle Berserk',
        'effect': 'berserk',
        'rarity': 'rare',
        'file': 'berserk-candle.png',
        'description': 'Red/green market candle flame for berserk damage pickup.',
    },
    {
        'runtimeId': 'nuke-liquidation',
        'title': 'Liquidation Nuke',
        'effect': 'screenNuke',
        'rarity': 'super-rare',
        'file': 'nuke-liquidation.png',
        'description': 'Red screen-clear nuke silhouette with liquidation shock glow.',
    },
]

EDGE = (10, 15, 28, 255)
SILVER = (209, 222, 240, 255)
CYAN = (47, 233, 255, 255)
BLUE = (54, 93, 204, 255)
GOLD = (255, 218, 92, 255)
RED = (236, 65, 72, 255)
GREEN = (69, 255, 138, 255)
ORANGE = (255, 126, 47, 255)
PURPLE = (171, 108, 255, 255)
SHADOW = (0, 0, 0, 84)


def glow(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, color) -> None:
    for i, alpha in enumerate((34, 25, 18, 12)):
        r = rx + i * 4
        fill = (color[0], color[1], color[2], alpha)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)


def pixel_diamond(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill, outline=EDGE) -> None:
    pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
    draw.polygon(pts, fill=outline)
    inset = 4
    pts2 = [(cx, cy - r + inset), (cx + r - inset, cy), (cx, cy + r - inset), (cx - r + inset, cy)]
    draw.polygon(pts2, fill=fill)


def draw_bonus_life(draw: ImageDraw.ImageDraw) -> None:
    glow(draw, 32, 31, 23, CYAN)
    draw.ellipse((14, 10, 50, 46), outline=(CYAN[0], CYAN[1], CYAN[2], 190), width=4)
    draw.ellipse((18, 16, 46, 48), fill=EDGE)
    draw.rectangle((20, 29, 44, 43), fill=EDGE)
    draw.rectangle((21, 20, 43, 35), fill=(37, 73, 120, 255))
    draw.rectangle((24, 24, 40, 32), fill=(116, 205, 230, 255))
    draw.rectangle((26, 26, 30, 30), fill=(232, 255, 255, 255))
    draw.rectangle((34, 26, 38, 30), fill=(232, 255, 255, 255))
    draw.rectangle((25, 38, 39, 43), fill=(212, 137, 91, 255))
    draw.rectangle((27, 40, 37, 42), fill=(246, 185, 132, 255))
    draw.polygon([(32, 49), (41, 59), (23, 59)], fill=EDGE)
    draw.polygon([(32, 51), (37, 57), (27, 57)], fill=SILVER)


def draw_hash_rail_core(draw: ImageDraw.ImageDraw) -> None:
    glow(draw, 32, 32, 22, CYAN)
    draw.line((12, 45, 52, 19), fill=EDGE, width=9)
    draw.line((12, 45, 52, 19), fill=SILVER, width=5)
    draw.line((17, 48, 57, 22), fill=CYAN, width=2)
    pixel_diamond(draw, 32, 32, 16, (232, 255, 255, 255), EDGE)
    pixel_diamond(draw, 32, 32, 9, CYAN, BLUE)
    draw.rectangle((24, 30, 40, 34), fill=(240, 255, 255, 255))
    draw.rectangle((30, 24, 34, 40), fill=(240, 255, 255, 255))


def draw_time_dilation(draw: ImageDraw.ImageDraw) -> None:
    glow(draw, 32, 32, 24, BLUE)
    draw.ellipse((9, 9, 55, 55), outline=(CYAN[0], CYAN[1], CYAN[2], 170), width=3)
    draw.arc((14, 14, 50, 50), 210, 40, fill=PURPLE, width=3)
    draw.polygon([(21, 13), (43, 13), (36, 30), (43, 51), (21, 51), (28, 30)], fill=EDGE)
    draw.polygon([(25, 17), (39, 17), (33, 30), (39, 47), (25, 47), (31, 30)], fill=(61, 111, 213, 255))
    draw.polygon([(28, 20), (36, 20), (33, 28), (31, 28)], fill=(213, 245, 255, 255))
    draw.polygon([(31, 34), (33, 34), (37, 44), (27, 44)], fill=CYAN)
    draw.rectangle((23, 11, 41, 15), fill=SILVER)
    draw.rectangle((23, 49, 41, 53), fill=SILVER)


def draw_berserk_candle(draw: ImageDraw.ImageDraw) -> None:
    glow(draw, 32, 31, 22, GREEN)
    draw.ellipse((16, 50, 48, 58), fill=SHADOW)
    draw.rectangle((25, 28, 39, 53), fill=EDGE)
    draw.rectangle((28, 30, 36, 52), fill=(222, 229, 218, 255))
    draw.rectangle((28, 35, 36, 39), fill=GREEN)
    draw.rectangle((28, 43, 36, 47), fill=RED)
    draw.polygon([(32, 8), (43, 24), (34, 32), (24, 25)], fill=EDGE)
    draw.polygon([(32, 12), (39, 24), (33, 29), (26, 24)], fill=RED)
    draw.polygon([(32, 16), (36, 24), (32, 27), (28, 24)], fill=GREEN)
    draw.rectangle((30, 24, 34, 31), fill=ORANGE)


def draw_nuke_liquidation(draw: ImageDraw.ImageDraw) -> None:
    glow(draw, 32, 33, 26, RED)
    draw.ellipse((10, 46, 54, 57), fill=SHADOW)
    draw.polygon([(32, 9), (48, 39), (16, 39)], fill=EDGE)
    draw.polygon([(32, 14), (43, 36), (21, 36)], fill=RED)
    draw.rectangle((26, 38, 38, 51), fill=EDGE)
    draw.rectangle((29, 38, 35, 50), fill=SILVER)
    draw.polygon([(19, 51), (28, 43), (32, 52)], fill=EDGE)
    draw.polygon([(45, 51), (36, 43), (32, 52)], fill=EDGE)
    draw.polygon([(22, 50), (28, 46), (31, 52)], fill=ORANGE)
    draw.polygon([(42, 50), (36, 46), (33, 52)], fill=ORANGE)
    draw.ellipse((23, 20, 41, 38), outline=(255, 235, 148, 255), width=3)
    draw.line((24, 36, 40, 20), fill=GOLD, width=3)
    draw.line((24, 20, 40, 36), fill=GOLD, width=3)


DRAWERS = {
    'bonus-life': draw_bonus_life,
    'hash-rail-core': draw_hash_rail_core,
    'time-dilation': draw_time_dilation,
    'berserk-candle': draw_berserk_candle,
    'nuke-liquidation': draw_nuke_liquidation,
}


def save_icon(spec: dict) -> dict:
    img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    DRAWERS[spec['runtimeId']](draw)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / spec['file']
    img.save(path)
    return {
        'runtimeId': spec['runtimeId'],
        'title': spec['title'],
        'effect': spec['effect'],
        'rarity': spec['rarity'],
        'src': f'./assets/generated/hmh-pickup-icons/{spec["file"]}',
        'file': spec['file'],
        'width': 64,
        'height': 64,
        'frameCount': 1,
        'sourcePolicy': 'Original repo-owned pickup pixel icon; no downloaded pixels copied.',
        'description': spec['description'],
    }


def write_contact_sheet(records: list[dict]) -> None:
    cell = 96
    sheet = Image.new('RGBA', (cell * len(records), cell), (14, 18, 30, 255))
    for index, record in enumerate(records):
        icon = Image.open(OUT_DIR / record['file']).convert('RGBA')
        x = index * cell + 16
        y = 12
        sheet.alpha_composite(icon, (x, y))
    sheet.save(CONTACT_SHEET)


def main() -> None:
    records = [save_icon(spec) for spec in P0_PICKUPS]
    assets_by_id = {record['runtimeId']: record for record in records}
    manifest = {
        'id': 'hmh-pickup-icons-p0-v1',
        'sourcePolicy': 'Original repo-owned P0 pickup pixel icons for the Art Redo Queue; no downloaded pixels copied.',
        'p0RuntimeIds': [spec['runtimeId'] for spec in P0_PICKUPS],
        'assetCount': len(records),
        'assets': records,
        'assetsById': assets_by_id,
    }
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    manifest_js = json.dumps(manifest, indent=2)
    MANIFEST_MJS.write_text(
        '// Generated by scripts/generate-hmh-pickup-icons.py.\n'
        f'export const HMH_PICKUP_ICON_PACK = Object.freeze({manifest_js});\n\n'
        'export function pickupIconAssetById(runtimeId) {\n'
        '  return HMH_PICKUP_ICON_PACK.assetsById?.[runtimeId] ?? null;\n'
        '}\n',
        encoding='utf-8',
    )
    write_contact_sheet(records)
    print(f'Generated {len(records)} P0 pickup icons in {OUT_DIR}')


if __name__ == '__main__':
    main()
