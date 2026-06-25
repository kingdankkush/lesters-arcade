#!/usr/bin/env python
"""Generate original HMH Level 1 polish props inspired by downloaded references.

No downloaded pixels are copied. The downloaded trees/plants/buildings are used
only as reference direction for original repo-owned pixel/isometric props.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/portal/assets/generated/hmh-coherent-world/level1-polish"
DOC_ASSETS = ROOT / "docs/game-design/assets"
DOC = ROOT / "docs/game-design/hard-money-heroes-level-1-polish-assets.md"

PALETTE = {
    "outline": (34, 28, 28, 255),
    "shadow": (20, 18, 24, 95),
    "pine_dark": (20, 74, 45, 255),
    "pine_mid": (36, 126, 65, 255),
    "pine_light": (92, 185, 92, 255),
    "leaf_dark": (44, 85, 48, 255),
    "leaf_mid": (78, 138, 62, 255),
    "leaf_light": (136, 194, 78, 255),
    "wood_dark": (92, 54, 28, 255),
    "wood_mid": (151, 91, 43, 255),
    "wood_light": (215, 152, 82, 255),
    "roof_red": (136, 42, 34, 255),
    "roof_hi": (218, 83, 54, 255),
    "crop_dark": (54, 91, 35, 255),
    "crop_mid": (93, 151, 50, 255),
    "crop_hi": (215, 179, 56, 255),
    "reed": (143, 122, 63, 255),
    "water": (55, 165, 210, 180),
    "stone_dark": (77, 70, 68, 255),
    "stone_mid": (130, 117, 95, 255),
    "stone_hi": (203, 182, 139, 255),
}

ASSETS: list[dict] = []

def iso_shadow(draw, cx, cy, rx, ry):
    draw.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=PALETTE["shadow"])

def save(name, category, role, img, notes, animated=False):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    img.save(path, optimize=True)
    ASSETS.append({
        "key": f"level1-polish/{name}",
        "category": category,
        "role": role,
        "src": "./" + str(path.relative_to(ROOT / "apps/portal")).replace("\\", "/"),
        "width": img.width,
        "height": img.height,
        "animated": animated,
        "sourcePolicy": "Original repo-owned art generated from reference direction; no downloaded pixels copied.",
        "notes": notes,
    })


def tree_cluster(name, pine=True, count=3):
    img = Image.new("RGBA", (128, 140), (0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d, 64, 125, 45, 12)
    offsets=[(-28,10),(0,0),(26,12),(-6,24)]
    for i,(ox,oy) in enumerate(offsets[:count]):
        x=64+ox; base=114+oy//2; h=70-(i%2)*8
        d.rectangle((x-4, base-h//2, x+4, base), fill=PALETTE['wood_dark'])
        if pine:
            for level in range(4):
                yy=base-h+level*16
                w=18+level*9
                color=[PALETTE['pine_light'], PALETTE['pine_mid'], PALETTE['pine_mid'], PALETTE['pine_dark']][level]
                d.polygon([(x, yy-10), (x-w, yy+18), (x+w, yy+18)], fill=color, outline=PALETTE['outline'])
                d.line((x-w+5, yy+13, x+w-5, yy+13), fill=(120,210,105,130))
        else:
            for r,c in [(26,PALETTE['leaf_dark']),(22,PALETTE['leaf_mid']),(12,PALETTE['leaf_light'])]:
                d.ellipse((x-r, base-h-r//3, x+r, base-h+r), fill=c, outline=PALETTE['outline'])
            d.arc((x-18,base-h-4,x+20,base-h+18), 190, 350, fill=(180,225,100,180), width=2)
    return img


def reeds(name, flowers=False):
    img=Image.new("RGBA",(96,76),(0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d,48,62,34,7)
    d.ellipse((14,48,82,68), fill=(28,120,150,110))
    for i in range(22):
        x=20+(i*7)%58; y=58-(i%3)*2; h=18+(i*5)%22
        d.line((x,y,x+((i%5)-2),y-h), fill=PALETTE['reed'], width=2)
        if flowers and i%4==0:
            d.ellipse((x-2,y-h-3,x+3,y-h+2), fill=(221,144,75,255))
    return img


def crop_patch(name, color='corn'):
    img=Image.new("RGBA",(128,72),(0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d,64,58,50,8)
    for row in range(4):
        y=24+row*9
        for col in range(9):
            x=20+col*10+row*5
            d.line((x,y+24,x+4,y), fill=PALETTE['crop_dark'], width=2)
            d.line((x+3,y+22,x+7,y+3), fill=PALETTE['crop_mid'], width=2)
            if (row+col)%2==0:
                d.point((x+5,y+8), fill=PALETTE['crop_hi'])
    return img


def hay_bales(name):
    img=Image.new("RGBA",(104,70),(0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d,52,58,35,7)
    for i,(x,y) in enumerate([(28,32),(50,26),(66,42),(40,46)]):
        d.rounded_rectangle((x-13,y-9,x+13,y+9), radius=5, fill=(196,151,58,255), outline=PALETTE['outline'])
        d.line((x-10,y-1,x+10,y-1), fill=(245,206,93,255))
        d.line((x-7,y+5,x+8,y+4), fill=(128,91,38,255))
    return img


def farmhouse(name, barn=False):
    img=Image.new("RGBA",(160,132),(0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d,80,116,58,12)
    wall=(196,149,89,255) if barn else (207,174,118,255)
    roof=PALETTE['roof_red'] if barn else (96,62,46,255)
    d.polygon([(35,62),(80,38),(126,62),(80,88)], fill=roof, outline=PALETTE['outline'])
    d.polygon([(35,62),(80,88),(80,116),(35,90)], fill=(wall[0]-35,wall[1]-30,wall[2]-20,255), outline=PALETTE['outline'])
    d.polygon([(126,62),(80,88),(80,116),(126,90)], fill=wall, outline=PALETTE['outline'])
    d.line((45,64,80,45,116,64), fill=PALETTE['roof_hi'], width=2)
    d.rectangle((68,88,86,116), fill=PALETTE['wood_dark'], outline=PALETTE['outline'])
    for x,y in [(48,76),(104,76)]:
        d.rectangle((x,y,x+14,y+12), fill=(76,114,132,255), outline=PALETTE['outline'])
        d.line((x+7,y,x+7,y+12), fill=(180,225,240,180))
    if barn:
        d.line((69,90,85,114), fill=(231,210,160,255), width=2)
        d.line((85,90,69,114), fill=(231,210,160,255), width=2)
    else:
        d.rectangle((30,92,58,100), fill=PALETTE['wood_light'], outline=PALETTE['outline'])
        d.rectangle((104,91,132,99), fill=PALETTE['wood_light'], outline=PALETTE['outline'])
    return img


def town_front(name):
    img=Image.new("RGBA",(152,126),(0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d,76,111,55,11)
    d.polygon([(34,54),(76,34),(119,54),(76,76)], fill=(52,48,55,255), outline=PALETTE['outline'])
    d.polygon([(34,54),(76,76),(76,112),(34,90)], fill=(120,78,48,255), outline=PALETTE['outline'])
    d.polygon([(119,54),(76,76),(76,112),(119,90)], fill=(163,105,62,255), outline=PALETTE['outline'])
    d.rectangle((43,73,61,91), fill=(60,37,30,255), outline=PALETTE['outline'])
    d.rectangle((90,72,109,88), fill=(75,119,137,255), outline=PALETTE['outline'])
    d.rectangle((29,50,123,60), fill=(206,159,78,255), outline=PALETTE['outline'])
    d.text((47,49), "BANK", fill=(58,38,26,255))
    d.line((32,92,75,116,120,92), fill=(224,174,88,255), width=3)
    return img


def signpost(name, label="FARM"):
    img=Image.new("RGBA",(72,86),(0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d,36,74,22,5)
    d.rectangle((34,24,40,74), fill=PALETTE['wood_dark'], outline=PALETTE['outline'])
    d.polygon([(19,22),(56,22),(63,34),(19,34)], fill=PALETTE['wood_light'], outline=PALETTE['outline'])
    d.text((23,23), label[:5], fill=(50,31,18,255))
    d.line((16,42,57,52), fill=PALETTE['wood_mid'], width=5)
    d.line((16,42,57,52), fill=PALETTE['outline'], width=1)
    return img


def cliff_switchback(name):
    img=Image.new("RGBA",(150,116),(0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d,76,101,57,11)
    d.polygon([(20,60),(72,32),(132,60),(77,90)], fill=PALETTE['stone_hi'], outline=PALETTE['outline'])
    d.polygon([(20,60),(77,90),(77,110),(20,78)], fill=PALETTE['stone_dark'], outline=PALETTE['outline'])
    d.polygon([(132,60),(77,90),(77,110),(132,79)], fill=PALETTE['stone_mid'], outline=PALETTE['outline'])
    for i in range(5):
        y=62+i*8
        d.line((38+i*8,y,102+i*2,y+4), fill=(92,72,47,255), width=3)
    d.line((34,62,110,78), fill=(218,187,128,180), width=2)
    return img


def mailbox(name):
    img=Image.new("RGBA",(64,62),(0,0,0,0)); d=ImageDraw.Draw(img)
    iso_shadow(d,32,54,19,4)
    d.rectangle((30,29,35,54), fill=PALETTE['wood_dark'], outline=PALETTE['outline'])
    d.rounded_rectangle((18,18,48,34), radius=8, fill=(61,75,87,255), outline=PALETTE['outline'])
    d.rectangle((18,27,48,38), fill=(86,101,112,255), outline=PALETTE['outline'])
    d.rectangle((43,14,47,25), fill=PALETTE['roof_red'], outline=PALETTE['outline'])
    return img


def make_assets():
    save('forest-wall-pine-cluster', 'flora', 'tree', tree_cluster('forest-wall-pine-cluster', True, 4), 'Dense pine wall for west/north boundaries.')
    save('forest-wall-oak-cluster', 'flora', 'tree', tree_cluster('forest-wall-oak-cluster', False, 3), 'Broadleaf boundary cluster for living forest edges.')
    save('oasis-reeds-flower', 'water', 'water-strip', reeds('oasis-reeds-flower', True), 'Reeds and flowers for lake/pond banks.')
    save('oasis-reeds-tall', 'water', 'water-strip', reeds('oasis-reeds-tall', False), 'Tall reed strips for river and pond seams.')
    save('crop-patch-corn-dense', 'farm', 'decor', crop_patch('crop-patch-corn-dense'), 'Dense corn rows for southeast farm loops.')
    save('crop-patch-wheat-dense', 'farm', 'decor', crop_patch('crop-patch-wheat-dense'), 'Wheat/crop rows for farm district identity.')
    save('hay-bale-stack', 'farm', 'smallprop', hay_bales('hay-bale-stack'), 'Stacked hay bales for farm yards and road edges.')
    save('farmhouse-porch', 'structure', 'building', farmhouse('farmhouse-porch', False), 'Original farmhouse with porch for farm hub.')
    save('barn-red-polished', 'structure', 'building', farmhouse('barn-red-polished', True), 'Polished red barn landmark variant.')
    save('town-bank-front', 'structure', 'building', town_front('town-bank-front'), 'Western bank/town front for northeast town block.')
    save('roadside-farm-sign', 'road', 'sign', signpost('roadside-farm-sign', 'FARM'), 'Farm branch signpost for readable navigation.')
    save('roadside-town-sign', 'road', 'sign', signpost('roadside-town-sign', 'TOWN'), 'Town branch signpost for route telegraphing.')
    save('mailbox-rural', 'road', 'smallprop', mailbox('mailbox-rural'), 'Rural mailbox for lived-in farm/residential road.')
    save('cliff-switchback-detail', 'terrain', 'edge', cliff_switchback('cliff-switchback-detail'), 'Cliff/switchback detail for mesa and north boundary.')


def contact_sheet():
    DOC_ASSETS.mkdir(parents=True, exist_ok=True)
    cellw, cellh = 220, 164; cols=4; rows=math.ceil(len(ASSETS)/cols)
    sheet=Image.new('RGB',(cols*cellw,rows*cellh+42),(24,26,32)); d=ImageDraw.Draw(sheet)
    d.text((12,12),'HMH Level 1 original polish assets', fill=(245,245,245))
    for idx,a in enumerate(ASSETS):
        im=Image.open(ROOT/'apps/portal'/a['src'].lstrip('./')).convert('RGBA')
        bg=Image.new('RGBA', im.size, (36,38,44,255)); bg.alpha_composite(im)
        thumb=bg.convert('RGB'); thumb.thumbnail((166,110), Image.Resampling.NEAREST)
        x=(idx%cols)*cellw; y=(idx//cols)*cellh+42
        d.rectangle((x+5,y+5,x+cellw-5,y+cellh-5), outline=(78,84,98), fill=(38,41,50))
        sheet.paste(thumb,(x+(cellw-thumb.width)//2,y+10))
        d.text((x+10,y+122), a['key'][:30], fill=(182,222,255))
        d.text((x+10,y+140), f"{a['category']} · {a['role']}", fill=(210,210,210))
    out=DOC_ASSETS/'hmh-level-1-polish-assets-contact-sheet.png'
    sheet.save(out, quality=95)


def manifest_and_doc():
    manifest={
        'id':'hmh-level-one-polish-assets-v1',
        'sourcePolicy':'Original repo-owned HMH art generated from downloaded reference direction; no third-party pixels copied.',
        'assetCount':len(ASSETS),
        'assets':ASSETS,
    }
    (OUT/'level1-polish-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (OUT/'level1-polish-manifest.mjs').write_text(
        '// Generated by scripts/generate-hmh-level-one-polish-assets.py\n'
        f'export const HMH_LEVEL_ONE_POLISH_ASSETS = Object.freeze({json.dumps(manifest, indent=2)});\n',
        encoding='utf-8')
    counts={}
    for a in ASSETS: counts[a['category']]=counts.get(a['category'],0)+1
    DOC.write_text('# HMH Level 1 original polish asset wave\n\n'
        '_Last updated: 2026-06-25_\n\n'
        'Original repo-owned props generated after the downloaded asset audit. The downloads were used as reference direction only; no downloaded pixels are copied.\n\n'
        f'- Asset count: **{len(ASSETS)}**\n'
        '- Runtime set: `apps/portal/assets/generated/hmh-coherent-world/level1-polish/`\n'
        '- Manifest: `apps/portal/assets/generated/hmh-coherent-world/level1-polish/level1-polish-manifest.mjs`\n'
        '- Contact sheet: `docs/game-design/assets/hmh-level-1-polish-assets-contact-sheet.png`\n\n'
        '## Category counts\n\n' + ''.join(f'- {k}: {v}\n' for k,v in sorted(counts.items())) +
        '\n## Runtime intent\n\nThese assets deepen the Level 1 authored templates: forest perimeter walls, oasis/riverside reeds, farm rows/hay/buildings, town fronts, rural navigation signs, mailboxes, and cliff switchback details.\n', encoding='utf-8')


def main():
    make_assets(); contact_sheet(); manifest_and_doc(); print(json.dumps({'assetCount':len(ASSETS),'outDir':str(OUT)}, indent=2))

if __name__ == '__main__':
    main()
