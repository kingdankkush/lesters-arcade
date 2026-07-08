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
ACTOR = {'id': 'rug-pull-baron', 'name': 'Rug Pull Baron'}
ASSETS = []
PAL = {
    'ink': (14, 14, 22, 255), 'shadow': (0, 0, 0, 80), 'gold': (255, 203, 82, 255),
    'red': (212, 46, 70, 255), 'pink': (255, 71, 166, 255), 'purple': (91, 52, 151, 255),
    'cyan': (68, 230, 255, 255), 'white': (246, 248, 242, 255), 'orange': (255, 129, 45, 255),
    'dark': (36, 32, 47, 255), 'green': (89, 224, 124, 255),
}

def blank(): return Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
def star(d, cx, cy, r, fill):
    d.polygon([(cx,cy-r),(cx+r//3,cy-r//3),(cx+r,cy),(cx+r//3,cy+r//3),(cx,cy+r),(cx-r//3,cy+r//3),(cx-r,cy),(cx-r//3,cy-r//3)], fill=fill)
def glow_ring(d, cx, cy, r, color, width=4):
    for i in range(3): d.ellipse((cx-r-i*5, cy-r-i*3, cx+r+i*5, cy+r+i*3), outline=color[:3]+(90-i*25,), width=width)

def draw_boss(d, *, phase=1, attack=False, death=False, telegraph=None):
    cx, base_y = 108, 153
    scale = 1 + (phase - 1) * 0.18
    cloak = [PAL['purple'], PAL['red'], PAL['dark']][phase-1]
    accent = [PAL['gold'], PAL['pink'], PAL['cyan']][phase-1]
    d.ellipse((34, 188, 182, 207), fill=PAL['shadow'])
    if telegraph:
        ring = {'whale-dump': PAL['pink'], 'rug-pull-chain': PAL['gold'], 'liquidation-wave': PAL['cyan']}[telegraph]
        glow_ring(d, cx, 112, 78, ring, 5)
        for n in range(10):
            a = n / 10 * math.tau
            star(d, cx + int(math.cos(a)*76), 112 + int(math.sin(a)*47), 5, ring)
    if death:
        for n in range(18):
            star(d, 28 + (n*19)%160, 34 + (n*31)%142, 4 + n%4, [PAL['gold'], PAL['pink'], PAL['white'], PAL['orange']][n%4])
        d.polygon([(45,126),(108,177),(171,126),(146,195),(70,195)], fill=(65,24,38,235), outline=PAL['ink'])
    else:
        d.polygon([(42, 78), (108, 194), (174, 78), (145, 198), (71, 198)], fill=cloak, outline=PAL['ink'])
    body_w, body_h = int(54*scale), int(78*scale)
    y = base_y - body_h
    d.rounded_rectangle((cx-body_w//2, y, cx+body_w//2, y+body_h), radius=14, fill=(184,54,65,255), outline=PAL['ink'], width=4)
    d.ellipse((cx-29, y-49, cx+29, y+9), fill=(197,61,72,255), outline=PAL['ink'], width=4)
    d.rectangle((cx-48, y+14, cx-22, y+48), fill=PAL['dark'], outline=PAL['ink'], width=3)
    d.rectangle((cx+22, y+14, cx+48, y+48), fill=PAL['dark'], outline=PAL['ink'], width=3)
    d.rectangle((cx-18, y-19, cx+18, y-11), fill=accent)
    d.rectangle((cx-35, y-53, cx+35, y-44), fill=PAL['ink'])
    d.rectangle((cx-22, y-72, cx+22, y-46), fill=cloak, outline=PAL['ink'], width=3)
    d.rectangle((cx-40, y+body_h-2, cx-18, y+body_h+31), fill=(130,42,50,255), outline=PAL['ink'], width=3)
    d.rectangle((cx+18, y+body_h-2, cx+40, y+body_h+31), fill=(130,42,50,255), outline=PAL['ink'], width=3)
    if attack or telegraph:
        for n in range(8):
            a = n/8*math.tau + phase*.35
            d.line((cx, y+26, cx+int(math.cos(a)*82), y+26+int(math.sin(a)*52)), fill=accent, width=5)
    if phase >= 2:
        d.arc((33, 39, 183, 177), 205, 335, fill=PAL['pink'], width=5)
    if phase >= 3:
        d.arc((20, 24, 196, 201), 200, 340, fill=PAL['cyan'], width=4)
        for x in [63, 153]: d.ellipse((x-14, 90, x+14, 141), fill=(65, 18, 35, 210), outline=accent, width=3)
    if death:
        d.line((54, 189, 162, 111), fill=PAL['white'], width=5)
        d.line((54, 111, 162, 189), fill=PAL['orange'], width=5)

def save_asset(key, *, phase=None, state, label, telegraph=None, death=False):
    img = blank(); d = ImageDraw.Draw(img)
    draw_boss(d, phase=phase or 3, attack=state == 'attack', telegraph=telegraph, death=death)
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
        'id': 'hmh-wo110-boss-redo-v1', 'actor': ACTOR,
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
    d.text((12, 12), 'WO-110 true-scale boss redo — phase forms, super telegraphs, death spectacle', fill=(235,242,255))
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
