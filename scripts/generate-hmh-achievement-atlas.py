from __future__ import annotations

import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'apps' / 'portal' / 'assets' / 'generated' / 'hmh-achievement-atlas'
MANIFEST_JSON = OUT_DIR / 'hmh-achievement-atlas-manifest.json'
MANIFEST_MJS = OUT_DIR / 'hmh-achievement-atlas-manifest.mjs'
CONTACT_SHEET = OUT_DIR / 'hmh-achievement-atlas-contact-sheet.png'
EXISTING_BADGES = ROOT / 'apps' / 'portal' / 'assets' / 'generated' / 'achievement-badges'

TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic']
TIER_COLORS = {
    'bronze': (205, 127, 50, 255),
    'silver': (199, 208, 220, 255),
    'gold': (255, 213, 74, 255),
    'platinum': (123, 246, 255, 255),
    'diamond': (120, 155, 255, 255),
    'mythic': (255, 75, 211, 255),
}
UNLOCK_COLORS = {
    'boss': (255, 71, 111, 255),
    'level-clear': (69, 255, 138, 255),
    'skill': (123, 246, 255, 255),
    'score': (255, 232, 77, 255),
    'kill': (255, 126, 47, 255),
    'grenade': (255, 91, 63, 255),
    'collection': (171, 108, 255, 255),
    'survival': (47, 233, 255, 255),
    'combo': (255, 155, 63, 255),
    'enemy-hunt': (255, 105, 105, 255),
    'melee': (210, 222, 240, 255),
    'weapon': (85, 190, 255, 255),
    'volume': (255, 218, 92, 255),
    'login': (110, 255, 204, 255),
    'paid-run': (112, 146, 255, 255),
}
EDGE = (8, 13, 28, 255)
DARK = (12, 18, 34, 255)
SILVER = (212, 225, 244, 255)
LOCK = (86, 98, 124, 255)


def load_achievements() -> list[dict]:
    script = """
import { ACHIEVEMENT_LIST } from './apps/portal/src/arcade-core.mjs';
console.log(JSON.stringify(ACHIEVEMENT_LIST.map(({id,title,tier,unlockType,description,icon}) => ({id,title,tier,unlockType,description,icon}))));
"""
    result = subprocess.run(
        ['node', '--input-type=module', '-e', script],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def transparent(size: int) -> Image.Image:
    return Image.new('RGBA', (size, size), (0, 0, 0, 0))


def draw_glow(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color, strength: int = 30) -> None:
    for i, alpha in enumerate((strength, int(strength * 0.7), int(strength * 0.45), int(strength * 0.25))):
        rr = r + i * 4
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(color[0], color[1], color[2], alpha))


def draw_badge_frame(draw: ImageDraw.ImageDraw, size: int, color, locked: bool = False) -> None:
    cx = cy = size // 2
    r = size // 2 - 5
    tone = LOCK if locked else color
    draw_glow(draw, cx, cy, r - 4, tone, 24 if not locked else 12)
    pts = [(cx, cy - r), (cx + r - 5, cy - 8), (cx + r - 11, cy + r - 8), (cx, cy + r), (cx - r + 11, cy + r - 8), (cx - r + 5, cy - 8)]
    draw.polygon(pts, fill=EDGE)
    inner = [(cx, cy - r + 5), (cx + r - 10, cy - 6), (cx + r - 15, cy + r - 10), (cx, cy + r - 5), (cx - r + 15, cy + r - 10), (cx - r + 10, cy - 6)]
    draw.polygon(inner, fill=(tone[0], tone[1], tone[2], 230))
    core = [(cx, cy - r + 14), (cx + r - 21, cy), (cx, cy + r - 14), (cx - r + 21, cy)]
    draw.polygon(core, fill=(18, 25, 45, 255) if not locked else (31, 36, 50, 255))


def draw_lock(draw: ImageDraw.ImageDraw, size: int) -> None:
    cx = size // 2
    draw.rounded_rectangle((cx - 13, 29, cx + 13, 49), radius=3, fill=EDGE)
    draw.rounded_rectangle((cx - 10, 31, cx + 10, 47), radius=2, fill=LOCK)
    draw.arc((cx - 10, 15, cx + 10, 36), 190, 350, fill=SILVER, width=4)
    draw.rectangle((cx - 3, 38, cx + 3, 44), fill=EDGE)


def draw_unlock_motif(draw: ImageDraw.ImageDraw, unlock_type: str, size: int, color) -> None:
    cx = cy = size // 2
    if unlock_type == 'boss':
        draw.polygon([(cx, 10), (cx + 17, cy), (cx, size - 10), (cx - 17, cy)], fill=color)
        draw.line((cx - 14, cy, cx + 14, cy), fill=SILVER, width=4)
        draw.line((cx, 14, cx, size - 14), fill=SILVER, width=3)
    elif unlock_type == 'level-clear':
        draw.polygon([(12, 36), (23, 20), (34, 32), (45, 14), (38, 45), (16, 45)], fill=color)
        draw.line((13, 47, 46, 47), fill=SILVER, width=3)
    elif unlock_type == 'skill':
        draw.polygon([(cx, 9), (cx + 9, cy - 3), (cx + 20, cy), (cx + 8, cy + 8), (cx, size - 9), (cx - 8, cy + 8), (cx - 20, cy), (cx - 9, cy - 3)], fill=color)
        draw.polygon([(cx, 18), (cx + 7, cy), (cx, size - 18), (cx - 7, cy)], fill=SILVER)
    elif unlock_type in ('score', 'volume', 'paid-run', 'login'):
        draw.ellipse((11, 11, size - 11, size - 11), fill=color, outline=EDGE, width=4)
        draw.rectangle((cx - 4, 18, cx + 4, size - 18), fill=EDGE)
        draw.rectangle((18, cy - 4, size - 18, cy + 4), fill=EDGE)
    elif unlock_type in ('kill', 'enemy-hunt'):
        draw.ellipse((14, 12, size - 14, size - 12), fill=color, outline=EDGE, width=4)
        draw.rectangle((21, cy + 5, 27, cy + 11), fill=EDGE)
        draw.rectangle((size - 27, cy + 5, size - 21, cy + 11), fill=EDGE)
        draw.rectangle((cx - 8, cy + 16, cx + 8, cy + 20), fill=EDGE)
    elif unlock_type == 'grenade':
        draw.ellipse((18, 20, size - 16, size - 10), fill=color, outline=EDGE, width=4)
        draw.rectangle((25, 13, 39, 25), fill=SILVER, outline=EDGE, width=2)
        draw.line((38, 14, 48, 8), fill=color, width=3)
    elif unlock_type in ('weapon', 'melee'):
        draw.line((12, size - 15, size - 12, 15), fill=EDGE, width=9)
        draw.line((12, size - 15, size - 12, 15), fill=color, width=5)
        draw.rectangle((18, size - 23, 31, size - 16), fill=SILVER)
    elif unlock_type == 'collection':
        for dx, dy in [(-10, -8), (10, -8), (0, 10)]:
            draw.polygon([(cx + dx, cy + dy - 10), (cx + dx + 10, cy + dy), (cx + dx, cy + dy + 10), (cx + dx - 10, cy + dy)], fill=color, outline=EDGE)
    elif unlock_type == 'survival':
        draw.polygon([(cx, 10), (cx + 17, 22), (cx + 10, size - 13), (cx, size - 6), (cx - 10, size - 13), (cx - 17, 22)], fill=color, outline=EDGE)
        draw.line((cx, 17, cx, size - 16), fill=SILVER, width=3)
    elif unlock_type == 'combo':
        draw.line((14, 40, 28, 22, 42, 40, 50, 20), fill=color, width=6)
        draw.line((14, 40, 28, 22, 42, 40, 50, 20), fill=SILVER, width=2)
    else:
        draw.polygon([(cx, 9), (size - 10, cy), (cx, size - 9), (10, cy)], fill=color, outline=EDGE)


def draw_tier_icon(tier: str) -> dict:
    color = TIER_COLORS[tier]
    img = transparent(64)
    draw = ImageDraw.Draw(img)
    draw_badge_frame(draw, 64, color)
    cx = cy = 32
    if tier == 'diamond':
        draw.polygon([(cx, 10), (49, 28), (cx, 54), (15, 28)], fill=(196, 232, 255, 255), outline=EDGE)
        draw.polygon([(cx, 17), (41, 29), (cx, 47), (23, 29)], fill=color)
    elif tier == 'mythic':
        draw.polygon([(cx, 8), (39, 25), (56, 25), (42, 37), (47, 55), (cx, 44), (17, 55), (22, 37), (8, 25), (25, 25)], fill=color, outline=EDGE)
        draw.polygon([(cx, 18), (38, 32), (cx, 40), (26, 32)], fill=(255, 232, 77, 255))
    else:
        draw.ellipse((18, 15, 46, 43), fill=color, outline=EDGE, width=3)
        draw.rectangle((24, 39, 40, 54), fill=EDGE)
        draw.polygon([(24, 39), (32, 48), (40, 39)], fill=SILVER)
    file = f'tier-{tier}.png'
    img.save(OUT_DIR / file)
    return {'id': tier, 'src': f'./assets/generated/hmh-achievement-atlas/{file}', 'width': 64, 'height': 64, 'sourcePolicy': 'Original repo-owned tier badge icon.'}


def draw_unlock_icon(unlock_type: str) -> dict:
    color = UNLOCK_COLORS.get(unlock_type, (200, 220, 255, 255))
    img = transparent(48)
    draw = ImageDraw.Draw(img)
    draw_glow(draw, 24, 24, 18, color, 18)
    draw_unlock_motif(draw, unlock_type, 48, color)
    file = f'unlock-{unlock_type}.png'
    img.save(OUT_DIR / file)
    return {'id': unlock_type, 'src': f'./assets/generated/hmh-achievement-atlas/{file}', 'width': 48, 'height': 48, 'sourcePolicy': 'Original repo-owned unlock-type motif icon.'}


def draw_generated_achievement_badge(achievement: dict, locked: bool = False) -> str:
    color = TIER_COLORS.get(achievement['tier'], (200, 220, 255, 255))
    img = transparent(48)
    draw = ImageDraw.Draw(img)
    draw_badge_frame(draw, 48, color, locked)
    if locked:
        draw_lock(draw, 48)
    else:
        draw_unlock_motif(draw, achievement['unlockType'], 48, UNLOCK_COLORS.get(achievement['unlockType'], color))
        draw.rectangle((12, 39, 36, 43), fill=(color[0], color[1], color[2], 230))
    prefix = 'locked-achievement' if locked else 'achievement'
    file = f'{prefix}-{achievement["id"]}.png'
    img.save(OUT_DIR / file)
    return f'./assets/generated/hmh-achievement-atlas/{file}'


def make_contact_sheet(tiers: list[dict], unlocks: list[dict], generated: list[dict]) -> None:
    previews = tiers + unlocks + generated[:12]
    cell = 72
    cols = 8
    rows = (len(previews) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, max(1, rows) * cell), (12, 18, 32, 255))
    for i, asset in enumerate(previews):
        path = ROOT / 'apps' / 'portal' / asset['src'].replace('./assets/', 'assets/')
        icon = Image.open(path).convert('RGBA')
        x = (i % cols) * cell + (cell - icon.width) // 2
        y = (i // cols) * cell + 8
        sheet.alpha_composite(icon, (x, y))
    sheet.save(CONTACT_SHEET)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    achievements = load_achievements()
    tiers = [draw_tier_icon(tier) for tier in TIER_ORDER]
    unlock_type_ids = sorted({a['unlockType'] for a in achievements})
    unlocks = [draw_unlock_icon(unlock_type) for unlock_type in unlock_type_ids]

    achievement_assets = []
    generated = []
    for achievement in achievements:
        existing_src = EXISTING_BADGES / f"{achievement['id']}.png"
        existing_locked = EXISTING_BADGES / f"locked-{achievement['id']}.png"
        generated_by_atlas = not (existing_src.exists() and existing_locked.exists())
        if generated_by_atlas:
            src = draw_generated_achievement_badge(achievement, locked=False)
            locked_src = draw_generated_achievement_badge(achievement, locked=True)
        else:
            src = f"./assets/generated/achievement-badges/{achievement['id']}.png"
            locked_src = f"./assets/generated/achievement-badges/locked-{achievement['id']}.png"
        record = {
            'runtimeId': achievement['id'],
            'title': achievement['title'],
            'tier': achievement['tier'],
            'unlockType': achievement['unlockType'],
            'src': src,
            'lockedSrc': locked_src,
            'width': 48,
            'height': 48,
            'generatedByAtlas': generated_by_atlas,
            'sourcePolicy': 'Existing repo-owned badge asset' if not generated_by_atlas else 'Original repo-owned generated Level 2 badge asset.',
        }
        achievement_assets.append(record)
        if generated_by_atlas:
            generated.append(record)

    manifest = {
        'id': 'hmh-achievement-atlas-v1',
        'sourcePolicy': 'Original repo-owned achievement atlas metadata, tier icons, unlock-type motifs, and missing runtime badges; no downloaded pixels copied.',
        'achievementCount': len(achievement_assets),
        'tierCount': len(tiers),
        'unlockTypeCount': len(unlocks),
        'generatedAchievementCount': len(generated),
        'tiers': tiers,
        'tiersById': {asset['id']: asset for asset in tiers},
        'unlockTypes': unlocks,
        'unlockTypesById': {asset['id']: asset for asset in unlocks},
        'achievements': achievement_assets,
        'achievementsById': {asset['runtimeId']: asset for asset in achievement_assets},
    }
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    manifest_js = json.dumps(manifest, indent=2)
    MANIFEST_MJS.write_text(
        '// Generated by scripts/generate-hmh-achievement-atlas.py.\n'
        f'export const HMH_ACHIEVEMENT_ATLAS = Object.freeze({manifest_js});\n\n'
        'export function achievementBadgeAssetById(runtimeId) {\n'
        '  return HMH_ACHIEVEMENT_ATLAS.achievementsById?.[runtimeId] ?? null;\n'
        '}\n\n'
        'export function achievementTierAssetById(tierId) {\n'
        '  return HMH_ACHIEVEMENT_ATLAS.tiersById?.[tierId] ?? null;\n'
        '}\n\n'
        'export function achievementUnlockTypeAssetById(unlockTypeId) {\n'
        '  return HMH_ACHIEVEMENT_ATLAS.unlockTypesById?.[unlockTypeId] ?? null;\n'
        '}\n',
        encoding='utf-8',
    )
    make_contact_sheet(tiers, unlocks, generated)
    print(f'Generated achievement atlas: {len(achievement_assets)} achievements, {len(tiers)} tiers, {len(unlocks)} unlock motifs, {len(generated)} generated runtime badges')


if __name__ == '__main__':
    main()
