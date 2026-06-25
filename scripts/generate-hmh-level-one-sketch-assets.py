#!/usr/bin/env python
"""Generate original Level 1 sketch-map environment assets.

This is a deterministic local pixel-art/blockout production wave for Justin's
Level 1 map sketch. It creates repo-owned transparent PNG assets for the first
runtime craft slice: asphalt roads, animated water source frames, cliffs/hills,
town fronts, farmstead pieces, flora variants, and bridges.

These are intentionally original game assets, not crops from Justin's sketch.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-coherent-world" / "sketch-level1"
DOC_ASSETS = ROOT / "docs" / "game-design" / "assets"
MANIFEST_JSON = OUT / "sketch-level1-asset-manifest.json"
MANIFEST_MJS = OUT / "sketch-level1-asset-manifest.mjs"
DOC_MD = ROOT / "docs" / "game-design" / "hard-money-heroes-level-1-sketch-asset-wave.md"
CONTACT = DOC_ASSETS / "hmh-level-1-sketch-asset-wave-contact-sheet.png"

SCALE = 3

def iso_poly(cx, cy, w, h):
    return [(cx, cy - h // 2), (cx + w // 2, cy), (cx, cy + h // 2), (cx - w // 2, cy)]

def shadow(draw, box, alpha=90):
    draw.ellipse(box, fill=(8, 10, 14, alpha))

def line(draw, pts, fill, width=1):
    draw.line(pts, fill=fill, width=width, joint='curve')

def pix(size=(96, 72)):
    return Image.new('RGBA', size, (0, 0, 0, 0))

def save(key, img, category, role, notes, animated=False, frame=0, frames=1):
    path = OUT / f"{key}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    # Pixel-art hard upscale: assets are drawn at authored resolution already; keep crisp.
    img.save(path)
    rel = path.relative_to(ROOT).as_posix()
    entry = {
        "key": f"sketch-level1/{key}",
        "path": rel,
        "width": img.width,
        "height": img.height,
        "category": category,
        "role": role,
        "notes": notes,
        "animated": animated,
        "frame": frame,
        "frames": frames,
    }
    ASSETS.append(entry)

ASSETS = []

# Palette: SNES-ish desert/town.
ASPHALT = (45, 48, 54, 255)
ASPHALT_DARK = (29, 31, 36, 255)
PAINT = (235, 214, 120, 255)
SAND = (190, 144, 79, 255)
DIRT = (116, 78, 48, 255)
GRASS = (70, 119, 64, 255)
WATER = (33, 118, 176, 255)
WATER_LIGHT = (81, 190, 217, 255)
WOOD = (116, 73, 42, 255)
WOOD_LIGHT = (169, 111, 61, 255)
STONE = (98, 89, 78, 255)
STONE_DARK = (58, 54, 50, 255)
ROOF = (114, 54, 44, 255)
WALL = (159, 122, 84, 255)
CROP = (218, 177, 65, 255)
CROP_DARK = (118, 118, 43, 255)
LEAF = (37, 102, 61, 255)
LEAF_DARK = (17, 63, 45, 255)
CACTUS = (42, 127, 76, 255)


def road_straight(key, orientation='horizontal'):
    img = pix((112, 72)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (10, 46, 102, 65), 70)
    if orientation == 'horizontal':
        d.polygon(iso_poly(56, 38, 102, 34), fill=ASPHALT, outline=ASPHALT_DARK)
        d.polygon(iso_poly(56, 38, 104, 42), outline=(81, 58, 39, 180))
        for x in [28, 46, 64, 82]:
            d.line([(x-5, 37), (x+5, 37)], fill=PAINT, width=3)
    else:
        d.polygon([(55, 4), (78, 24), (58, 68), (35, 48)], fill=ASPHALT, outline=ASPHALT_DARK)
        for y in [17, 31, 45, 58]:
            d.line([(56, y-4), (56, y+4)], fill=PAINT, width=3)
    save(key, img, 'road', 'route-ground', f'{orientation} asphalt road tile with painted lane markers')


def road_curve(key):
    img = pix((112, 80)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (12, 52, 104, 74), 70)
    d.polygon([(13,43),(42,24),(100,45),(72,66)], fill=ASPHALT, outline=ASPHALT_DARK)
    d.polygon([(42,24),(64,9),(101,29),(100,45)], fill=ASPHALT, outline=ASPHALT_DARK)
    d.arc((45, 17, 88, 56), 205, 295, fill=PAINT, width=3)
    save(key, img, 'road', 'route-ground', 'curved asphalt road tile with readable painted turn')


def road_junction(key, kind='cross'):
    img = pix((112, 80)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (10, 48, 103, 75), 70)
    d.polygon(iso_poly(56, 42, 104, 34), fill=ASPHALT, outline=ASPHALT_DARK)
    if kind == 'cross':
        d.polygon([(56,6),(78,28),(56,75),(34,52)], fill=ASPHALT, outline=ASPHALT_DARK)
    else:
        d.polygon([(56,6),(78,28),(56,45),(34,28)], fill=ASPHALT, outline=ASPHALT_DARK)
    d.line([(30,42),(44,42)], fill=PAINT, width=3); d.line([(68,42),(84,42)], fill=PAINT, width=3)
    d.line([(56,18),(56,31)], fill=PAINT, width=3); d.line([(56,54),(56,66)], fill=PAINT, width=3)
    save(key, img, 'road', 'route-ground', f'{kind} asphalt road junction with paint')


def transition_tile(key):
    img = pix((112, 72)); d = ImageDraw.Draw(img, 'RGBA')
    d.polygon(iso_poly(56, 38, 106, 42), fill=SAND, outline=(104,72,41,255))
    d.polygon([(4,38),(55,13),(55,64),(4,54)], fill=DIRT)
    d.polygon([(50,17),(108,41),(56,66),(50,60)], fill=ASPHALT, outline=ASPHALT_DARK)
    for y in [31,43,55]:
        d.line([(58,y),(70,y+5)], fill=PAINT, width=2)
    save(key, img, 'road', 'ground-transition', 'sand/dirt shoulder blending into asphalt')


def water_tile(key, kind='river', frame=0, frames=4):
    img = pix((112, 72)); d = ImageDraw.Draw(img, 'RGBA')
    bank = (137, 104, 65, 255)
    if kind == 'pond':
        d.ellipse((18,18,96,57), fill=bank)
        d.ellipse((24,21,90,54), fill=WATER, outline=(20,81,137,255))
        for i in range(3):
            off = (frame * 5 + i * 18) % 46
            d.arc((30+off//2, 26+i*5, 62+off//2, 40+i*5), 185, 350, fill=WATER_LIGHT, width=2)
    elif kind == 'lake':
        d.polygon([(4,39),(54,14),(109,39),(59,67)], fill=bank)
        d.polygon([(14,39),(55,20),(99,39),(60,61)], fill=WATER, outline=(20,81,137,255))
        for i in range(4):
            x = 22 + ((frame*7 + i*19) % 64)
            d.line([(x,38+i*3),(x+12,34+i*3)], fill=WATER_LIGHT, width=2)
    else:
        d.polygon([(3,32),(21,20),(111,42),(91,56)], fill=bank)
        d.polygon([(9,34),(25,25),(103,42),(88,51)], fill=WATER, outline=(20,81,137,255))
        for i in range(4):
            x = 18 + ((frame*8 + i*22) % 72)
            d.line([(x,35),(x+14,38)], fill=WATER_LIGHT, width=2)
    suffix = f"-{frame:02d}" if frames > 1 else ''
    save(f"{key}{suffix}", img, 'water', f'{kind}-animated-frame', f'{kind} water loop frame {frame+1}/{frames}', True, frame, frames)


def cliff(key, variant='face'):
    img = pix((112, 96)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (16, 66, 100, 86), 80)
    top = [(18,32),(58,12),(101,32),(61,53)]
    face = [(18,32),(61,53),(61,83),(18,62)]
    face2 = [(61,53),(101,32),(101,62),(61,83)]
    d.polygon(top, fill=(132,119,91,255), outline=STONE_DARK)
    d.polygon(face, fill=STONE, outline=STONE_DARK)
    d.polygon(face2, fill=(77,72,67,255), outline=STONE_DARK)
    for x,y in [(32,43),(50,53),(72,45),(87,56),(38,65)]:
        d.line([(x,y),(x+8,y+3)], fill=(48,45,41,180), width=2)
    if variant == 'mesa':
        d.rectangle((38,12,80,21), fill=(158,119,75,255), outline=STONE_DARK)
    save(key, img, 'terrain', 'cliff-elevation', f'isometric {variant} cliff/hill elevation blocker')


def town_front(key, style=0):
    img = pix((104, 112)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (16, 82, 90, 102), 80)
    base_y = 80
    wall = [WALL, (124,91,73,255), (116,102,86,255)][style % 3]
    roof = [ROOF, (82,69,82,255), (65,72,92,255)][style % 3]
    d.polygon([(22,39),(55,22),(89,40),(56,58)], fill=roof, outline=(43,32,35,255))
    d.polygon([(22,39),(56,58),(56,96),(22,78)], fill=wall, outline=(66,48,38,255))
    d.polygon([(56,58),(89,40),(89,78),(56,96)], fill=tuple(max(0,c-24) if i<3 else c for i,c in enumerate(wall)), outline=(66,48,38,255))
    d.rectangle((37,61,49,83), fill=(39,28,24,255), outline=(226,178,87,255))
    d.rectangle((66,58,80,70), fill=(42,93,114,255), outline=(220,185,105,255))
    d.rectangle((30,48,82,56), fill=(236,196,91,255), outline=(54,39,33,255))
    d.text((36,48), ['BANK','SHOP','FEED'][style%3], fill=(39,31,29,255))
    save(key, img, 'structure', 'modular-town-front', 'tileable town boundary/storefront facade')


def farm_building(key, kind='barn'):
    img = pix((112, 112)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (13,84,102,104), 80)
    if kind == 'barn':
        d.polygon([(20,45),(56,20),(94,45),(57,67)], fill=(143,37,39,255), outline=(67,30,31,255))
        d.polygon([(20,45),(57,67),(57,96),(20,75)], fill=(156,50,43,255), outline=(67,30,31,255))
        d.polygon([(57,67),(94,45),(94,75),(57,96)], fill=(112,37,37,255), outline=(67,30,31,255))
        d.rectangle((37,67,52,91), fill=(65,36,27,255), outline=(235,212,154,255))
        d.line([(20,75),(57,96),(94,75)], fill=(235,212,154,255), width=2)
    elif kind == 'farmhouse':
        d.polygon([(22,49),(57,29),(93,49),(58,69)], fill=(91,54,45,255), outline=(49,36,31,255))
        d.polygon([(22,49),(58,69),(58,95),(22,75)], fill=(201,174,124,255), outline=(71,57,42,255))
        d.polygon([(58,69),(93,49),(93,75),(58,95)], fill=(170,139,95,255), outline=(71,57,42,255))
        d.rectangle((38,67,50,88), fill=(53,39,32,255)); d.rectangle((68,62,82,73), fill=(48,111,126,255))
    else:
        d.rectangle((47,25,67,78), fill=(168,154,118,255), outline=(70,63,53,255))
        d.ellipse((39,15,75,42), fill=(136,127,102,255), outline=(70,63,53,255))
        d.rectangle((44,74,70,91), fill=(110,82,49,255), outline=(70,63,53,255))
    save(key, img, 'farm', kind, f'{kind} farmstead landmark')


def crop(key, frame=0, frames=4):
    img = pix((96, 56)); d = ImageDraw.Draw(img, 'RGBA')
    d.polygon(iso_poly(48, 32, 86, 34), fill=(93,91,45,255), outline=(69,60,34,255))
    for row in range(4):
        y = 20 + row*6
        for col in range(6):
            x = 19 + col*10 + ((row%2)*4)
            sway = int(math.sin((frame + col + row) * 1.7) * 2)
            d.line([(x,y+8),(x+sway,y)], fill=CROP_DARK, width=2)
            d.line([(x+sway,y),(x+sway+3,y+4)], fill=CROP, width=2)
    save(f"{key}-{frame:02d}", img, 'farm', 'animated-crop-frame', f'crop row sway loop frame {frame+1}/{frames}', True, frame, frames)


def hay(key):
    img = pix((72,56)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (12,38,62,52), 70)
    d.rectangle((18,24,55,43), fill=(205,156,55,255), outline=(106,76,29,255))
    for x in [23,31,39,47]: d.line([(x,24),(x+4,43)], fill=(235,194,89,255), width=2)
    save(key, img, 'farm', 'hay-bale', 'farm dressing hay bale')


def tree(key, kind='oak', frame=None):
    img = pix((80,104)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (18,78,64,95), 75)
    d.rectangle((36,55,45,85), fill=(96,58,36,255), outline=(54,35,24,255))
    if kind == 'pine':
        offset = (frame or 0) % 2
        for i,(w,y) in enumerate([(52,26),(44,41),(36,55)]):
            d.polygon([(40+offset,y-18),(40+w//2,y+14),(40-w//2,y+14)], fill=LEAF if i<2 else LEAF_DARK, outline=(13,52,35,255))
    else:
        offset = int(math.sin((frame or 0)*1.7)*2)
        for box in [(15+offset,22,52+offset,59),(32+offset,20,67+offset,57),(22-offset,38,63-offset,75)]:
            d.ellipse(box, fill=LEAF, outline=LEAF_DARK)
    suffix = f"-{frame:02d}" if frame is not None else ''
    save(f"{key}{suffix}", img, 'flora', f'{kind}-tree', f'{kind} tree variant' + (f' sway frame {frame+1}/4' if frame is not None else ''), frame is not None, frame or 0, 4 if frame is not None else 1)


def cactus(key):
    img = pix((64,80)); d = ImageDraw.Draw(img, 'RGBA')
    shadow(d, (12,60,54,73), 70)
    d.rounded_rectangle((28,20,41,64), radius=5, fill=CACTUS, outline=(20,78,48,255))
    d.line([(31,32),(17,32),(17,45)], fill=CACTUS, width=8)
    d.line([(39,42),(53,42),(53,29)], fill=CACTUS, width=8)
    d.line([(34,24),(34,60)], fill=(95,173,95,255), width=2)
    save(key, img, 'flora', 'cactus', 'desert cactus cluster')


def bridge(key):
    img = pix((112,72)); d = ImageDraw.Draw(img, 'RGBA')
    d.polygon(iso_poly(56,38,96,34), fill=WATER, outline=(20,81,137,255))
    d.polygon([(15,34),(29,26),(99,45),(85,54)], fill=WOOD, outline=(58,35,23,255))
    for i in range(8):
        x=23+i*8
        d.line([(x,28+i//3),(x+2,48+i//3)], fill=WOOD_LIGHT, width=2)
    d.line([(22,29),(91,47)], fill=(69,41,25,255), width=3)
    d.line([(18,39),(87,56)], fill=(69,41,25,255), width=3)
    save(key, img, 'bridge', 'road-bridge', 'bridge with rail and water shadow')

# Generate assets.
road_straight('asphalt-road-straight-ew', 'horizontal')
road_straight('asphalt-road-straight-ns', 'vertical')
road_curve('asphalt-road-curve')
road_junction('asphalt-road-crossroad', 'cross')
road_junction('asphalt-road-tjunction', 'tjunction')
transition_tile('dirt-asphalt-farm-driveway')
for kind in ['river','lake','pond']:
    for f in range(4):
        water_tile(f'{kind}-water-loop', kind, f, 4)
cliff('cliff-face-north')
cliff('mesa-hill-plateau', 'mesa')
cliff('cliff-corner-shadow')
for i in range(3): town_front(f'town-front-{i+1}', i)
farm_building('barn-red', 'barn')
farm_building('farmhouse-cream', 'farmhouse')
farm_building('silo-stone', 'silo')
for f in range(4): crop('corn-row-loop', f, 4)
hay('hay-bale')
for f in range(4):
    tree('oak-tree-sway', 'oak', f)
    tree('pine-tree-sway', 'pine', f)
tree('oak-tree-static', 'oak')
tree('pine-tree-static', 'pine')
cactus('cactus-cluster')
bridge('road-bridge-wood')

# Manifest.
OUT.mkdir(parents=True, exist_ok=True)
DOC_ASSETS.mkdir(parents=True, exist_ok=True)
manifest = {
    "id": "hmh-level-one-sketch-asset-wave-v1",
    "generatedFrom": "deterministic local script scripts/generate-hmh-level-one-sketch-assets.py",
    "sourcePolicy": "original repo-owned pixel art; Justin sketch used only as layout reference",
    "assetCount": len(ASSETS),
    "contactSheet": CONTACT.relative_to(ROOT).as_posix(),
    "assets": ASSETS,
}
MANIFEST_JSON.write_text(json.dumps(manifest, indent=2), encoding='utf-8')

mjs = "export const HMH_LEVEL_ONE_SKETCH_ASSET_WAVE = Object.freeze(" + json.dumps(manifest, indent=2) + ");\n"
MANIFEST_MJS.write_text(mjs, encoding='utf-8')

# Contact sheet.
thumb_w, thumb_h = 128, 126
cols = 5
rows = math.ceil(len(ASSETS) / cols)
sheet = Image.new('RGBA', (cols*thumb_w, rows*thumb_h + 44), (21, 22, 29, 255))
d = ImageDraw.Draw(sheet)
d.text((12, 10), f"HMH Level 1 sketch asset wave v1 — {len(ASSETS)} assets", fill=(235, 232, 210, 255))
for idx, entry in enumerate(ASSETS):
    img = Image.open(ROOT / entry['path']).convert('RGBA')
    x = (idx % cols) * thumb_w
    y = 44 + (idx // cols) * thumb_h
    d.rectangle((x+4, y+4, x+thumb_w-4, y+thumb_h-4), fill=(35, 38, 47, 255), outline=(72, 77, 92, 255))
    scale = min((thumb_w-18)/img.width, (thumb_h-42)/img.height, 1.5)
    w, h = max(1, int(img.width*scale)), max(1, int(img.height*scale))
    preview = img.resize((w,h), Image.Resampling.NEAREST)
    sheet.alpha_composite(preview, (x+(thumb_w-w)//2, y+8))
    label = entry['key'].split('/')[-1]
    d.text((x+8, y+thumb_h-28), label[:22], fill=(230, 230, 220, 255))
    if entry['animated']:
        d.text((x+8, y+thumb_h-15), f"loop {entry['frame']+1}/{entry['frames']}", fill=(111, 214, 255, 255))
CONTACT.parent.mkdir(parents=True, exist_ok=True)
sheet.convert('RGB').save(CONTACT)

# Doc summary.
by_cat = {}
for a in ASSETS:
    by_cat.setdefault(a['category'], 0)
    by_cat[a['category']] += 1
lines = [
    '# HMH Level 1 sketch asset wave v1',
    '',
    'Deterministic original pixel-art assets generated from the Level 1 sketch layout plan. The sketch itself remains reference-only and is not used as runtime art.',
    '',
    f'- Asset count: {len(ASSETS)}',
    f'- Manifest: `{MANIFEST_JSON.relative_to(ROOT).as_posix()}`',
    f'- Runtime module: `{MANIFEST_MJS.relative_to(ROOT).as_posix()}`',
    f'- Contact sheet: `{CONTACT.relative_to(ROOT).as_posix()}`',
    '',
    '## Category counts',
    '',
]
for cat, count in sorted(by_cat.items()):
    lines.append(f'- {cat}: {count}')
lines.extend(['', '## Notes', '', '- P0 coverage includes asphalt roads, water loops, cliffs/elevation, town fronts, and farmstead landmarks.', '- P1 coverage starts tree sway, cactus, and bridge variants.', '- Assets are source-controlled transparent PNGs under `hmh-coherent-world/sketch-level1/`.'])
DOC_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')

print(json.dumps({"assetCount": len(ASSETS), "manifest": str(MANIFEST_JSON), "contactSheet": str(CONTACT)}, indent=2))
