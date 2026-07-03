from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'apps' / 'portal' / 'assets' / 'generated' / 'hmh-level-one-authored-stamp-art'
MANIFEST_JSON = OUT_DIR / 'hmh-level-one-authored-stamp-art-manifest.json'
MANIFEST_MJS = OUT_DIR / 'hmh-level-one-authored-stamp-art-manifest.mjs'
CONTACT_SHEET = OUT_DIR / 'hmh-level-one-authored-stamp-art-contact-sheet.png'

ASSETS = [
    {
        'key': 'level1-authored-stamp/river-bridge-arrow-sign',
        'file': 'river-bridge-arrow-sign.png',
        'role': 'route-marker',
        'routeBeat': 'chokepoint',
        'label': 'River bridge arrow sign',
        'description': 'Wood-and-Litecoin arrow marker for the River Bridge / Wash Crossing route read.',
        'palette': {'wood': (106, 69, 43, 255), 'edge': (40, 28, 25, 255), 'gold': (236, 172, 46, 255), 'glow': (255, 226, 108, 180), 'blue': (79, 173, 210, 255)},
    },
    {
        'key': 'level1-authored-stamp/boss-yard-warning-pylon',
        'file': 'boss-yard-warning-pylon.png',
        'role': 'boss-yard-telegraph',
        'routeBeat': 'boss',
        'label': 'Boss yard warning pylon',
        'description': 'Chunky hazard pylon that frames the Second Town / Extraction Yard threshold.',
        'palette': {'metal': (74, 80, 91, 255), 'edge': (28, 31, 38, 255), 'red': (218, 68, 54, 255), 'gold': (241, 171, 49, 255), 'glow': (255, 93, 67, 170)},
    },
    {
        'key': 'level1-authored-stamp/extraction-pad-litcoin-beacon',
        'file': 'extraction-pad-litcoin-beacon.png',
        'role': 'extraction-beacon',
        'routeBeat': 'extract',
        'label': 'Litecoin extraction pad beacon',
        'description': 'Blue-gold extraction beacon for the final pad route read.',
        'palette': {'metal': (62, 70, 86, 255), 'edge': (25, 28, 35, 255), 'blue': (74, 185, 218, 255), 'gold': (246, 190, 70, 255), 'glow': (89, 213, 255, 150)},
    },
]


def iso_shadow(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int) -> None:
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(0, 0, 0, 70))


def draw_coin(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill, edge) -> None:
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=edge)
    draw.ellipse((cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3), fill=fill)
    # Pixel-safe Litecoin-like mark without font dependency.
    draw.line((cx - 2, cy - 9, cx - 2, cy + 8), fill=edge, width=4)
    draw.line((cx - 7, cy + 1, cx + 7, cy - 4), fill=edge, width=4)
    draw.line((cx - 3, cy + 8, cx + 8, cy + 8), fill=edge, width=4)


def save_asset(spec: dict) -> dict:
    img = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    p = spec['palette']
    key = spec['key']
    if key.endswith('river-bridge-arrow-sign'):
        iso_shadow(d, 64, 106, 34, 9)
        d.rectangle((57, 47, 65, 103), fill=p['edge'])
        d.rectangle((59, 48, 63, 103), fill=p['wood'])
        d.polygon([(23, 45), (77, 45), (77, 36), (107, 58), (77, 80), (77, 70), (23, 70)], fill=p['edge'])
        d.polygon([(27, 48), (80, 48), (80, 42), (100, 58), (80, 74), (80, 67), (27, 67)], fill=p['wood'])
        d.line((35, 57, 86, 57), fill=p['gold'], width=4)
        d.polygon([(86, 49), (101, 57), (86, 65)], fill=p['gold'])
        draw_coin(d, 37, 57, 10, p['gold'], p['edge'])
        d.arc((18, 80, 110, 125), 200, 340, fill=p['blue'], width=3)
        d.ellipse((86, 94, 97, 101), fill=p['glow'])
    elif key.endswith('boss-yard-warning-pylon'):
        iso_shadow(d, 64, 108, 30, 10)
        d.polygon([(47, 103), (81, 103), (74, 48), (54, 48)], fill=p['edge'])
        d.polygon([(52, 99), (76, 99), (70, 52), (58, 52)], fill=p['metal'])
        for y in (60, 74, 88):
            d.line((54, y + 6, 74, y - 2), fill=p['gold'], width=5)
            d.line((55, y + 9, 75, y + 1), fill=p['edge'], width=2)
        d.rectangle((43, 42, 85, 52), fill=p['edge'])
        d.rectangle((48, 44, 80, 49), fill=p['red'])
        d.ellipse((38, 34, 90, 86), outline=p['glow'], width=3)
        d.polygon([(64, 19), (75, 39), (53, 39)], fill=p['edge'])
        d.polygon([(64, 24), (70, 36), (58, 36)], fill=p['red'])
    elif key.endswith('extraction-pad-litcoin-beacon'):
        iso_shadow(d, 64, 108, 38, 12)
        d.polygon([(29, 101), (64, 83), (99, 101), (64, 120)], fill=p['edge'])
        d.polygon([(37, 100), (64, 87), (91, 100), (64, 114)], fill=(38, 47, 58, 255))
        d.polygon([(49, 99), (64, 92), (79, 99), (64, 107)], fill=p['blue'])
        d.rectangle((58, 43, 70, 98), fill=p['edge'])
        d.rectangle((61, 47, 67, 96), fill=p['metal'])
        d.ellipse((45, 25, 83, 63), fill=p['edge'])
        d.ellipse((50, 30, 78, 58), fill=p['blue'])
        draw_coin(d, 64, 44, 10, p['gold'], p['edge'])
        d.ellipse((28, 9, 100, 81), outline=p['glow'], width=4)
        d.arc((17, 2, 111, 96), 210, 330, fill=p['glow'], width=3)
    else:
        raise ValueError(key)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / spec['file']
    img.save(path)
    return {
        'key': spec['key'],
        'src': f'./assets/generated/hmh-level-one-authored-stamp-art/{spec["file"]}',
        'file': spec['file'],
        'width': img.width,
        'height': img.height,
        'role': spec['role'],
        'routeBeat': spec['routeBeat'],
        'label': spec['label'],
        'description': spec['description'],
        'source': 'repo-generated-original-pillow-pixel-art',
    }


def write_contact_sheet(records: list[dict]) -> None:
    cell_w, cell_h = 160, 160
    sheet = Image.new('RGBA', (cell_w * len(records), cell_h), (20, 24, 32, 255))
    for i, rec in enumerate(records):
        img = Image.open(OUT_DIR / rec['file']).convert('RGBA')
        x = i * cell_w + (cell_w - img.width) // 2
        y = 12
        sheet.alpha_composite(img, (x, y))
    sheet.save(CONTACT_SHEET)


def main() -> None:
    records = [save_asset(spec) for spec in ASSETS]
    manifest = {
        'id': 'hmh-level-one-authored-stamp-art-v1',
        'policy': 'Original repo-generated route-readability props for WO-66/WO-68 exposed Level 1 gaps.',
        'assetCount': len(records),
        'assets': records,
    }
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    records_js = json.dumps(manifest, indent=2)
    MANIFEST_MJS.write_text(
        '// Generated by scripts/generate-hmh-level-one-authored-stamp-art.py.\n'
        f'export const HMH_LEVEL_ONE_AUTHORED_STAMP_ART = Object.freeze({records_js});\n\n'
        'const AUTHORED_STAMP_ASSETS_BY_KEY = new Map(HMH_LEVEL_ONE_AUTHORED_STAMP_ART.assets.map((asset) => [asset.key, Object.freeze(asset)]));\n\n'
        'export function authoredStampAssetByKey(key) {\n'
        '  return AUTHORED_STAMP_ASSETS_BY_KEY.get(key) ?? null;\n'
        '}\n',
        encoding='utf-8',
    )
    write_contact_sheet(records)
    print(f'Generated {len(records)} authored stamp assets in {OUT_DIR}')


if __name__ == '__main__':
    main()
