from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'apps' / 'portal' / 'assets' / 'generated' / 'hmh-vfx-ui-chrome'
MANIFEST_JSON = OUT_DIR / 'hmh-vfx-ui-chrome-manifest.json'
MANIFEST_MJS = OUT_DIR / 'hmh-vfx-ui-chrome-manifest.mjs'
CONTACT_SHEET = OUT_DIR / 'hmh-vfx-ui-chrome-contact-sheet.png'

EDGE = (8, 13, 28, 255)
CYAN = (25, 247, 255, 255)
GREEN = (69, 255, 138, 255)
GOLD = (255, 232, 77, 255)
RED = (255, 71, 111, 255)
PURPLE = (171, 108, 255, 255)
SILVER = (213, 229, 244, 255)
DARK = (13, 19, 36, 255)
BLUE = (54, 93, 204, 255)

VFX_SPECS = [
    ('achievement-unlock-burst', 'achievement', 'Reusable badge unlock radial starburst.', 64, 64, 6, GOLD),
    ('pickup-rarity-beams', 'pickup', 'Vertical rare-pickup beam/halo tell.', 48, 80, 6, CYAN),
    ('ui-confirm-spark', 'ui', 'Small confirmation spark for menus and submit states.', 40, 40, 5, GREEN),
]
UI_SPECS = [
    ('combat-hud-frame', 'hud', 'Diegetic combat HUD frame and stat chip border.', 192, 64, CYAN),
    ('level-up-card-frame', 'upgrade', 'Upgrade card frame with rarity-ready corners.', 128, 160, GOLD),
    ('achievement-toast-frame', 'achievement', 'Achievement toast frame with badge socket.', 192, 72, PURPLE),
    ('minimap-frame', 'map', 'Finite-map minimap frame and scan corners.', 96, 96, GREEN),
    ('wallet-ranked-badges', 'web3', 'Wallet/ranked/testnet status badge strip.', 160, 48, BLUE),
    ('mobile-control-chrome', 'touch', 'Touch control circular chrome and thumb affordance.', 96, 96, SILVER),
]


def transparent(w: int, h: int) -> Image.Image:
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def glow(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color, alpha: int = 36) -> None:
    for i, a in enumerate((alpha, int(alpha * 0.7), int(alpha * 0.45), int(alpha * 0.25))):
        rr = r + i * 4
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(color[0], color[1], color[2], a))


def draw_star(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color) -> None:
    pts = [(cx, cy - r), (cx + r // 4, cy - r // 4), (cx + r, cy), (cx + r // 4, cy + r // 4), (cx, cy + r), (cx - r // 4, cy + r // 4), (cx - r, cy), (cx - r // 4, cy - r // 4)]
    draw.polygon(pts, fill=color, outline=EDGE)


def draw_vfx_frame(key: str, frame_w: int, frame_h: int, frame: int, frames: int, color) -> Image.Image:
    img = transparent(frame_w, frame_h)
    draw = ImageDraw.Draw(img)
    t = frame / max(1, frames - 1)
    cx, cy = frame_w // 2, frame_h // 2
    if key == 'achievement-unlock-burst':
        glow(draw, cx, cy, int(10 + 18 * t), color, 42)
        draw_star(draw, cx, cy, int(10 + 14 * t), color)
        draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=SILVER, outline=EDGE)
        for angle in range(0, 360, 45):
            import math
            rad = math.radians(angle)
            x1 = cx + int(math.cos(rad) * (18 + 6 * t))
            y1 = cy + int(math.sin(rad) * (18 + 6 * t))
            x2 = cx + int(math.cos(rad) * (27 + 10 * t))
            y2 = cy + int(math.sin(rad) * (27 + 10 * t))
            draw.line((x1, y1, x2, y2), fill=color, width=2)
    elif key == 'pickup-rarity-beams':
        glow(draw, cx, frame_h - 18, 18, color, 34)
        beam_w = max(4, int(18 - t * 8))
        draw.polygon([(cx - beam_w, frame_h - 8), (cx + beam_w, frame_h - 8), (cx + 5, 8), (cx - 5, 8)], fill=(color[0], color[1], color[2], 42 + int(90 * (1 - t))))
        draw.ellipse((cx - 16, frame_h - 26, cx + 16, frame_h - 10), outline=color, width=3)
        draw.rectangle((cx - 3, 10, cx + 3, frame_h - 16), fill=(SILVER[0], SILVER[1], SILVER[2], 120))
    else:
        glow(draw, cx, cy, int(8 + 9 * t), color, 36)
        draw_star(draw, cx, cy, int(7 + 7 * t), color)
        draw.line((cx - 14, cy, cx + 14, cy), fill=SILVER, width=2)
        draw.line((cx, cy - 14, cx, cy + 14), fill=SILVER, width=2)
    return img


def write_vfx_sheet(key: str, role: str, notes: str, frame_w: int, frame_h: int, frames: int, color) -> dict:
    sheet = transparent(frame_w * frames, frame_h)
    frame_records = []
    for frame in range(frames):
        frame_img = draw_vfx_frame(key, frame_w, frame_h, frame, frames, color)
        sheet.alpha_composite(frame_img, (frame_w * frame, 0))
        frame_file = f'{key}-frame-{frame:02d}.png'
        frame_img.save(OUT_DIR / frame_file)
        frame_records.append({
            'index': frame,
            'src': f'./assets/generated/hmh-vfx-ui-chrome/{frame_file}',
            'width': frame_w,
            'height': frame_h,
            'durationMs': 55,
        })
    file = f'{key}.png'
    sheet.save(OUT_DIR / file)
    return {
        'key': key,
        'kind': 'vfx',
        'role': role,
        'src': f'./assets/generated/hmh-vfx-ui-chrome/{file}',
        'animated': True,
        'frames': frames,
        'frameList': frame_records,
        'frameMs': 55,
        'frameWidth': frame_w,
        'frameHeight': frame_h,
        'width': frame_w * frames,
        'height': frame_h,
        'sourcePolicy': 'Original repo-owned VFX spritesheet; no downloaded pixels copied.',
        'notes': notes,
    }


def draw_ui_frame(key: str, w: int, h: int, color) -> Image.Image:
    img = transparent(w, h)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((1, 1, w - 2, h - 2), radius=10, fill=(DARK[0], DARK[1], DARK[2], 190), outline=EDGE, width=3)
    draw.rounded_rectangle((5, 5, w - 6, h - 6), radius=7, outline=color, width=2)
    # Corner brackets.
    for sx in (0, 1):
        for sy in (0, 1):
            x = 10 if sx == 0 else w - 26
            y = 10 if sy == 0 else h - 26
            draw.line((x, y, x + 16, y), fill=SILVER, width=2)
            draw.line((x, y, x, y + 16), fill=SILVER, width=2)
    if key == 'combat-hud-frame':
        for i in range(3):
            x = 18 + i * 54
            draw.rounded_rectangle((x, 22, x + 42, 42), radius=5, outline=(color[0], color[1], color[2], 210), width=2)
            draw.rectangle((x + 5, 29, x + 35, 35), fill=(color[0], color[1], color[2], 95))
    elif key == 'level-up-card-frame':
        draw.polygon([(w // 2, 18), (w - 20, h // 2), (w // 2, h - 18), (20, h // 2)], outline=color, fill=None)
        draw.rounded_rectangle((22, 28, w - 22, h - 28), radius=9, outline=(SILVER[0], SILVER[1], SILVER[2], 180), width=2)
    elif key == 'achievement-toast-frame':
        draw.ellipse((16, 16, 56, 56), outline=GOLD, width=3)
        draw.line((68, 24, w - 22, 24), fill=color, width=3)
        draw.line((68, 44, w - 40, 44), fill=SILVER, width=2)
    elif key == 'minimap-frame':
        for x in range(22, w - 20, 18):
            draw.line((x, 18, x, h - 18), fill=(color[0], color[1], color[2], 55), width=1)
        for y in range(22, h - 20, 18):
            draw.line((18, y, w - 18, y), fill=(color[0], color[1], color[2], 55), width=1)
        draw.ellipse((w // 2 - 5, h // 2 - 5, w // 2 + 5, h // 2 + 5), fill=color)
    elif key == 'wallet-ranked-badges':
        labels = [(16, CYAN), (62, GOLD), (108, GREEN)]
        for x, tone in labels:
            draw.rounded_rectangle((x, 12, x + 36, 36), radius=8, outline=tone, width=2)
            draw.polygon([(x + 18, 16), (x + 29, 24), (x + 18, 32), (x + 7, 24)], fill=tone)
    elif key == 'mobile-control-chrome':
        draw.ellipse((14, 14, w - 14, h - 14), outline=color, width=4)
        draw.ellipse((30, 30, w - 30, h - 30), fill=(color[0], color[1], color[2], 75), outline=SILVER, width=2)
        draw.line((w // 2, 18, w // 2, 30), fill=SILVER, width=2)
        draw.line((w // 2, h - 30, w // 2, h - 18), fill=SILVER, width=2)
    return img


def write_ui_asset(key: str, role: str, notes: str, w: int, h: int, color) -> dict:
    img = draw_ui_frame(key, w, h, color)
    file = f'{key}.png'
    img.save(OUT_DIR / file)
    return {
        'key': key,
        'kind': 'ui-chrome',
        'role': role,
        'src': f'./assets/generated/hmh-vfx-ui-chrome/{file}',
        'animated': False,
        'width': w,
        'height': h,
        'sourcePolicy': 'Original repo-owned UI chrome sprite; no downloaded pixels copied.',
        'notes': notes,
    }


def write_contact_sheet(assets: list[dict]) -> None:
    cell_w, cell_h = 216, 120
    cols = 3
    rows = (len(assets) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell_w, rows * cell_h), (12, 18, 32, 255))
    for i, asset in enumerate(assets):
        img = Image.open(OUT_DIR / asset['src'].split('/')[-1]).convert('RGBA')
        if asset['kind'] == 'vfx':
            img = img.crop((0, 0, asset['frameWidth'], asset['frameHeight']))
        scale = min(1, (cell_w - 24) / img.width, (cell_h - 24) / img.height)
        if scale < 1:
            img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.Resampling.NEAREST)
        x = (i % cols) * cell_w + (cell_w - img.width) // 2
        y = (i // cols) * cell_h + (cell_h - img.height) // 2
        sheet.alpha_composite(img, (x, y))
    sheet.save(CONTACT_SHEET)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    vfx = [write_vfx_sheet(*spec) for spec in VFX_SPECS]
    ui = [write_ui_asset(*spec) for spec in UI_SPECS]
    assets = vfx + ui
    manifest = {
        'id': 'hmh-vfx-ui-chrome-v1',
        'sourcePolicy': 'Original repo-owned VFX/UI chrome pack for Art Redo Queue P0/P1; no downloaded pixels copied.',
        'assetCount': len(assets),
        'vfx': vfx,
        'uiChrome': ui,
        'assets': assets,
        'assetsByKey': {asset['key']: asset for asset in assets},
    }
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    manifest_js = json.dumps(manifest, indent=2)
    MANIFEST_MJS.write_text(
        '// Generated by scripts/generate-hmh-vfx-ui-chrome.py.\n'
        f'export const HMH_VFX_UI_CHROME_PACK = Object.freeze({manifest_js});\n\n'
        'export function vfxUiChromeAssetByKey(key) {\n'
        '  return HMH_VFX_UI_CHROME_PACK.assetsByKey?.[key] ?? null;\n'
        '}\n',
        encoding='utf-8',
    )
    write_contact_sheet(assets)
    print(f'Generated {len(vfx)} VFX and {len(ui)} UI chrome assets in {OUT_DIR}')


if __name__ == '__main__':
    main()
