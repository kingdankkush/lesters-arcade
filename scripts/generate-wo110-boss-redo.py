#!/usr/bin/env python
"""Generate WO-110 true-scale boss redo assets and proof sheet."""
from __future__ import annotations
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/portal/assets/generated/hmh-wo110-boss-redo'
DOCS = ROOT / 'docs/game-design/wo110-boss-redo-checkpoint3'
FW = FH = 216
ART_W = ART_H = 108
ACTOR = {'id': 'rug-pull-baron', 'name': 'Rug Pull Baron'}
ASSETS = []
PAL = {
    'ink': (13, 12, 20, 255), 'outline': (31, 23, 34, 255), 'shadow': (0, 0, 0, 92),
    'skin': (214, 151, 112, 255), 'skin_hi': (244, 190, 139, 255), 'skin_lo': (137, 75, 64, 255),
    'hair': (39, 25, 25, 255), 'coat': (121, 31, 49, 255), 'coat_hi': (184, 50, 68, 255),
    'coat_lo': (70, 24, 39, 255), 'leather': (70, 47, 39, 255), 'leather_hi': (126, 83, 55, 255),
    'gold': (232, 171, 58, 255), 'gold_hi': (255, 224, 111, 255), 'gold_lo': (139, 87, 31, 255),
    'rug': (55, 35, 78, 255), 'rug_hi': (111, 54, 111, 255), 'rug_red': (154, 46, 68, 255),
    'pink': (255, 75, 170, 255), 'purple': (104, 66, 177, 255), 'cyan': (68, 230, 255, 255),
    'white': (246, 239, 211, 255), 'orange': (255, 129, 45, 255), 'green': (89, 224, 124, 255),
}

def blank():
    return Image.new('RGBA', (ART_W, ART_H), (0, 0, 0, 0))

def px_star(d, cx, cy, r, fill):
    d.polygon([(cx, cy-r), (cx+max(1, r//3), cy-max(1, r//3)), (cx+r, cy),
               (cx+max(1, r//3), cy+max(1, r//3)), (cx, cy+r),
               (cx-max(1, r//3), cy+max(1, r//3)), (cx-r, cy),
               (cx-max(1, r//3), cy-max(1, r//3))], fill=fill)

def chain(d, points, color=None):
    color = color or PAL['gold_hi']
    for index, (x, y) in enumerate(points):
        d.ellipse((x-2, y-1, x+2, y+1), outline=PAL['ink'], fill=PAL['gold_lo'])
        d.rectangle((x-1, y, x+1, y+1), fill=color)
        if index and index % 2: d.point((x, y-1), fill=PAL['white'])

def rug_pattern(d, polygon, phase):
    d.polygon(polygon, fill=PAL['rug'], outline=PAL['ink'])
    rows = [(46, 54, 62), (40, 48, 68), (36, 43, 73), (33, 39, 77)]
    for row, (y, left, right) in enumerate(rows):
        accent = PAL['rug_red'] if (row + phase) % 2 else PAL['gold_lo']
        d.line((left, y, 54, y+4, right, y), fill=accent, width=2)
        d.line((left+2, y+3, 54, y+7, right-2, y+3), fill=PAL['rug_hi'])
    d.line((35, 76, 45, 73, 54, 78, 66, 73, 75, 76), fill=PAL['gold'])

def draw_super_telegraph(d, telegraph):
    if telegraph == 'whale-dump':
        for x, y, r in [(24, 24, 3), (39, 15, 2), (57, 19, 3), (74, 13, 2), (89, 26, 3)]:
            d.ellipse((x-r, y-r//2, x+r, y+r//2+1), fill=PAL['gold_lo'], outline=PAL['ink'])
            d.line((x, y-r//2, x, y+r//2), fill=PAL['gold_hi'])
            d.line((x, y+4, x-2, y+11), fill=PAL['pink'])
            d.line((x, y+4, x+2, y+11), fill=PAL['pink'])
    elif telegraph == 'rug-pull-chain':
        points = []
        for index in range(21):
            angle = math.pi + index / 20 * math.pi
            points.append((54 + int(math.cos(angle) * 45), 61 + int(math.sin(angle) * 32)))
        chain(d, points)
        d.polygon([(8, 63), (17, 58), (21, 66), (11, 70)], fill=PAL['rug_red'], outline=PAL['ink'])
        d.polygon([(87, 66), (92, 58), (101, 63), (97, 70)], fill=PAL['rug_red'], outline=PAL['ink'])
    elif telegraph == 'liquidation-wave':
        d.arc((5, 38, 103, 103), 190, 350, fill=PAL['cyan'], width=3)
        d.arc((11, 45, 97, 99), 190, 350, fill=PAL['purple'], width=2)
        for x in range(13, 99, 11):
            y = 85 - abs(54-x)//4
            px_star(d, x, y, 2 + (x//11)%2, PAL['cyan'])

def draw_death(d):
    d.ellipse((17, 89, 93, 101), fill=PAL['shadow'])
    d.polygon([(25, 79), (46, 64), (85, 78), (75, 95), (38, 94)], fill=PAL['coat_lo'], outline=PAL['ink'])
    d.polygon([(30, 77), (48, 67), (77, 78), (64, 90), (39, 88)], fill=PAL['coat'], outline=PAL['outline'])
    d.polygon([(49, 69), (64, 62), (76, 71), (62, 78)], fill=PAL['rug'], outline=PAL['ink'])
    d.line((55, 69, 67, 67, 73, 72), fill=PAL['gold'], width=2)
    d.ellipse((25, 65, 37, 76), fill=PAL['skin_lo'], outline=PAL['ink'])
    d.polygon([(19, 65), (41, 61), (38, 66), (22, 69)], fill=PAL['leather'], outline=PAL['ink'])
    d.rectangle((26, 57, 35, 64), fill=PAL['leather_hi'], outline=PAL['ink'])
    d.polygon([(75, 84), (91, 88), (88, 94), (72, 91)], fill=PAL['leather'], outline=PAL['ink'])
    for x, y in [(19, 50), (32, 42), (48, 47), (67, 40), (84, 51), (94, 67), (14, 77)]:
        px_star(d, x, y, 2, PAL['gold_hi'] if x % 2 else PAL['cyan'])
    chain(d, [(66+i*3, 63+i//2) for i in range(9)], PAL['gold_hi'])

def draw_boss(d, *, phase=1, attack=False, death=False, telegraph=None):
    if telegraph: draw_super_telegraph(d, telegraph)
    if death:
        draw_death(d)
        return

    cx = 54
    accent = [PAL['gold'], PAL['pink'], PAL['cyan']][phase-1]
    d.ellipse((24, 91, 85, 102), fill=PAL['shadow'])

    # Back rug-cape and coat tails establish a broad, readable con-artist silhouette.
    cape = [(43, 42), (30-phase*2, 54), (31-phase*2, 78), (39, 91), (52, 78), (63, 91), (78+phase, 72), (72, 49), (61, 41)]
    rug_pattern(d, cape, phase)
    d.polygon([(40, 69), (50, 64), (54, 94), (38, 92), (31, 80)], fill=PAL['coat_lo'], outline=PAL['ink'])
    d.polygon([(55, 65), (66, 67), (76, 84), (68, 94), (54, 93)], fill=PAL['coat_lo'], outline=PAL['ink'])

    # Legs and boots use unequal foreshortening to preserve the three-quarter isometric stance.
    d.polygon([(41, 72), (52, 73), (49, 91), (38, 92)], fill=PAL['leather'], outline=PAL['ink'])
    d.polygon([(55, 73), (64, 71), (72, 88), (62, 92)], fill=PAL['leather_hi'], outline=PAL['ink'])
    d.polygon([(36, 89), (50, 88), (48, 96), (32, 96)], fill=PAL['ink'])
    d.polygon([(61, 88), (75, 86), (80, 92), (65, 96), (59, 94)], fill=PAL['ink'])
    d.line((38, 90, 48, 90), fill=PAL['leather_hi'])
    d.line((64, 89, 74, 87), fill=PAL['gold_lo'])

    # Torso, lapels, belt, and asymmetric arms.
    d.polygon([(40, 42), (55, 37), (68, 44), (67, 70), (57, 78), (40, 70)], fill=PAL['coat'], outline=PAL['ink'])
    d.polygon([(42, 43), (52, 40), (49, 63), (40, 69)], fill=PAL['coat_hi'])
    d.polygon([(52, 40), (58, 39), (63, 46), (55, 52), (49, 46)], fill=PAL['white'], outline=PAL['outline'])
    d.polygon([(52, 45), (57, 43), (58, 58), (53, 63), (49, 50)], fill=PAL['coat_lo'])
    d.rectangle((40, 63, 66, 68), fill=PAL['leather'], outline=PAL['ink'])
    d.rectangle((51, 63, 57, 68), fill=PAL['gold'], outline=PAL['gold_hi'])
    d.line((41, 70, 57, 77, 66, 69), fill=accent, width=2)

    d.polygon([(39, 43), (31, 48), (27, 65), (34, 69), (42, 56)], fill=PAL['coat'], outline=PAL['ink'])
    d.polygon([(67, 44), (76, 50), (82, 63), (75, 68), (65, 57)], fill=PAL['coat_lo'], outline=PAL['ink'])
    d.polygon([(25, 62), (34, 61), (38, 68), (31, 72), (25, 68)], fill=PAL['leather'], outline=PAL['ink'])
    d.ellipse((75, 63, 83, 71), fill=PAL['skin'], outline=PAL['ink'])

    # Contract ledger and dangling coin chain reinforce the Rug Pull Baron identity.
    d.polygon([(20, 57), (32, 54), (35, 66), (23, 69)], fill=(48, 60, 73, 255), outline=PAL['ink'])
    d.line((23, 59, 31, 57), fill=PAL['gold_hi'])
    d.line((24, 62, 32, 60), fill=PAL['white'])
    d.line((25, 65, 32, 63), fill=PAL['gold_lo'])
    chain(d, [(80+i*2, 69+i*2) for i in range(7)], accent)
    d.ellipse((90, 82, 97, 88), fill=PAL['gold'], outline=PAL['ink'])
    d.line((93, 83, 93, 87), fill=PAL['gold_hi'])

    # Neck, face, swept hair, moustache, and wide-brim market-gambler hat.
    d.rectangle((49, 33, 59, 42), fill=PAL['skin_lo'], outline=PAL['ink'])
    d.polygon([(45, 18), (57, 15), (66, 22), (64, 37), (56, 42), (45, 36)], fill=PAL['hair'], outline=PAL['ink'])
    d.polygon([(46, 20), (58, 18), (64, 23), (61, 36), (54, 39), (47, 34)], fill=PAL['skin'], outline=PAL['outline'])
    d.polygon([(47, 21), (57, 19), (62, 23), (58, 25), (49, 25)], fill=PAL['skin_hi'])
    d.rectangle((50, 27, 53, 29), fill=PAL['ink'])
    d.rectangle((58, 26, 61, 28), fill=accent)
    d.line((54, 31, 61, 32), fill=PAL['hair'], width=2)
    d.line((54, 34, 60, 34), fill=PAL['skin_lo'])
    d.polygon([(43, 16), (58, 10), (68, 17), (66, 21), (48, 21)], fill=PAL['leather_hi'], outline=PAL['ink'])
    d.polygon([(38, 18), (58, 15), (74, 20), (65, 24), (43, 22)], fill=PAL['leather'], outline=PAL['ink'])
    d.line((46, 19, 66, 21), fill=PAL['gold'], width=2)
    d.rectangle((57, 18, 61, 21), fill=accent)

    # Phase escalation remains character-driven: torn coat, luminous seams, spectral debt marks.
    if phase >= 2:
        d.line((31, 50, 37, 55, 32, 61), fill=PAL['pink'], width=2)
        d.line((70, 47, 75, 55, 72, 62), fill=PAL['pink'])
        d.polygon([(28, 74), (34, 72), (31, 83), (25, 80)], fill=PAL['rug_red'], outline=PAL['ink'])
    if phase >= 3:
        d.line((45, 43, 51, 50, 47, 58, 53, 64), fill=PAL['cyan'], width=2)
        d.line((64, 42, 60, 49, 65, 55), fill=PAL['cyan'])
        for x, y in [(31, 35), (76, 34), (22, 48), (88, 49), (69, 15)]:
            px_star(d, x, y, 2, PAL['cyan'])
    if attack or telegraph:
        d.line((81, 66, 91, 58, 98, 61), fill=accent, width=2)
        px_star(d, 99, 60, 3, accent)

def save_asset(key, *, phase=None, state, label, telegraph=None, death=False):
    low_res = blank(); d = ImageDraw.Draw(low_res)
    draw_boss(d, phase=phase or 3, attack=state == 'attack', telegraph=telegraph, death=death)
    img = low_res.resize((FW, FH), Image.Resampling.NEAREST)
    path = OUT / f'{key}.png'; OUT.mkdir(parents=True, exist_ok=True); img.save(path, optimize=True)
    asset = {
        'key': f'wo110/{key}', 'actorId': ACTOR['id'], 'displayName': ACTOR['name'], 'label': label,
        'state': state, 'phase': phase, 'superMove': telegraph, 'deathSpectacle': death,
        'src': f'./assets/generated/hmh-wo110-boss-redo/{key}.png', 'frameWidth': FW, 'frameHeight': FH,
        'trueScalePx': FW, 'renderWidth': FW, 'renderHeight': FH,
        'sourcePolicy': 'Original repo-owned WO-110 true-scale boss pixel art; no downloaded pixels copied.',
    }
    ASSETS.append(asset)

def manifests():
    manifest = {
        'id': 'hmh-wo110-boss-redo-v2', 'actor': ACTOR,
        'artDirection': 'Original human market baron with gambler hat, contract ledger, coin chain, and woven rug cape.',
        'sourcePolicy': 'Original repo-owned WO-110 true-scale boss pixel art; no downloaded pixels copied.',
        'checkpoint': 'PLAYTEST_CHECKPOINT_3', 'trueScaleRangePx': [192, 256],
        'assetCount': len(ASSETS), 'phaseCount': 3, 'superMoveTelegraphCount': 3,
        'deathSpectacleCount': sum(1 for a in ASSETS if a['deathSpectacle']), 'assets': ASSETS,
    }
    (OUT / 'hmh-wo110-boss-redo-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    mjs = '// Generated by scripts/generate-wo110-boss-redo.py\n'
    mjs += 'export const HMH_WO110_BOSS_REDO = Object.freeze(' + json.dumps(manifest, indent=2) + ');\n\n'
    mjs += 'const WO110_BY_PHASE_STATE = new Map(HMH_WO110_BOSS_REDO.assets.map((asset) => [`${asset.phase ?? "none"}/${asset.state}/${asset.superMove ?? "none"}`, Object.freeze(asset)]));\n'
    mjs += 'const WO110_BY_KEY = new Map(HMH_WO110_BOSS_REDO.assets.map((asset) => [asset.key, Object.freeze(asset)]));\n'
    mjs += 'export function wo110BossAssetByKey(key) { return WO110_BY_KEY.get(key) ?? null; }\n'
    mjs += 'export function wo110BossAssetForPhaseState(phase, state, superMove = null) { return WO110_BY_PHASE_STATE.get(`${phase ?? "none"}/${state}/${superMove ?? "none"}`) ?? WO110_BY_PHASE_STATE.get(`${phase ?? "none"}/${state}/none`) ?? null; }\n'
    (OUT / 'hmh-wo110-boss-redo-manifest.mjs').write_text(mjs, encoding='utf-8')

def proof():
    DOCS.mkdir(parents=True, exist_ok=True)
    cellw, cellh, cols = 170, 214, 4
    rows = math.ceil(len(ASSETS)/cols)
    sheet = Image.new('RGB', (cols*cellw, rows*cellh+42), (17, 19, 29)); d = ImageDraw.Draw(sheet)
    d.text((12, 12), 'WO-110 human boss redo - phase forms, super telegraphs, death spectacle', fill=(235,242,255))
    for idx, asset in enumerate(ASSETS):
        im = Image.open(OUT / asset['src'].split('/')[-1]).convert('RGBA')
        bg = Image.new('RGBA', (FW, FH), (31, 35, 48, 255)); bg.alpha_composite(im)
        bg.thumbnail((148, 150), Image.Resampling.NEAREST)
        x, y = (idx % cols) * cellw, (idx // cols) * cellh + 42
        d.rectangle((x+6, y+6, x+cellw-6, y+cellh-6), fill=(36,42,56), outline=(92,106,130))
        sheet.paste(bg.convert('RGB'), (x+(cellw-bg.width)//2, y+12))
        d.text((x+10, y+168), asset['label'][:25], fill=(150,224,255))
        d.text((x+10, y+186), f"{asset['frameWidth']}px {asset['state']}", fill=(230,230,210))
    sheet.save(DOCS / 'wo110-boss-checkpoint3-proof.png', quality=95)
    (DOCS / 'README.md').write_text('# WO-110 Boss Redo Checkpoint 3\n\nTrue-scale 216px Rug Pull Baron phase forms, super-move telegraphs, and death spectacle proof. Justin verdict gate remains open until playtest approval.\n', encoding='utf-8')

def notice():
    (ROOT / 'docs/game-design/PLAYTEST_CHECKPOINT_3_NOTICE.md').write_text('# Playtest Checkpoint 3 — Boss Fight Verdict Gate\n\nWO-110 is ready for boss-fight review. The Rug Pull Baron now has true-scale 216px phase forms, three super-move telegraphs, and a death spectacle proof sheet.\n\nVerdict: **OPEN — awaiting Justin playtest approval.**\n', encoding='utf-8')

def main():
    save_asset('rug-pull-baron-phase-1', phase=1, state='phase-form', label='Phase 1 market baron')
    save_asset('rug-pull-baron-phase-2', phase=2, state='phase-form', label='Phase 2 rug-pull cloak')
    save_asset('rug-pull-baron-phase-3', phase=3, state='phase-form', label='Phase 3 liquidation demon')
    save_asset('rug-pull-baron-super-whale-dump', phase=1, state='super-telegraph', label='Super: whale dump', telegraph='whale-dump')
    save_asset('rug-pull-baron-super-rug-pull-chain', phase=2, state='super-telegraph', label='Super: rug-pull chain', telegraph='rug-pull-chain')
    save_asset('rug-pull-baron-super-liquidation-wave', phase=3, state='super-telegraph', label='Super: liquidation wave', telegraph='liquidation-wave')
    save_asset('rug-pull-baron-death-spectacle', phase=3, state='death-spectacle', label='Death spectacle', death=True)
    manifests(); proof(); notice()
    print(json.dumps({'assetCount': len(ASSETS), 'out': str(OUT)}, indent=2))

if __name__ == '__main__': main()
