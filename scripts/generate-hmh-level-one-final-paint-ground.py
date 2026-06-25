#!/usr/bin/env python
"""Generate original final-paint HMH Level 1 isometric ground tiles.

This pass is original repo-owned artwork. The SBS CC0 tiles remain as the
geometry/reference foundation and fallback, but no SBS/downloaded pixels are
copied into these final-paint tiles.
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/portal/assets/generated/hmh-level-one-ground/final-paint"
DOC_ASSETS = ROOT / "docs/game-design/assets"
DOC = ROOT / "docs/game-design/hard-money-heroes-level-1-final-paint-ground.md"
W, H = 128, 64
FRAMES = 6

PALETTES = {
    "grass": {"base": (62, 130, 58, 255), "dark": (32, 83, 45, 255), "light": (132, 199, 77, 255), "accent": (205, 170, 62, 255)},
    "dirt": {"base": (139, 93, 49, 255), "dark": (78, 49, 35, 255), "light": (214, 146, 76, 255), "accent": (95, 66, 44, 255)},
    "sand": {"base": (199, 166, 97, 255), "dark": (136, 103, 59, 255), "light": (248, 219, 134, 255), "accent": (238, 187, 80, 255)},
    "rocky": {"base": (112, 107, 96, 255), "dark": (60, 58, 56, 255), "light": (189, 178, 151, 255), "accent": (139, 97, 67, 255)},
    "road": {"base": (58, 61, 66, 255), "dark": (28, 31, 38, 255), "light": (126, 127, 124, 255), "accent": (235, 199, 74, 255)},
    "water": {"base": (34, 135, 181, 235), "dark": (18, 70, 116, 245), "light": (117, 220, 235, 230), "accent": (44, 184, 209, 210)},
}

@dataclass(frozen=True)
class Asset:
    key: str
    role: str
    category: str
    filename: str
    width: int = W
    height: int = H
    preferred: bool = False
    animated: bool = False
    frames: int = 1
    frame_ms: int = 120
    description: str = ""

ASSETS: list[dict] = []
ROLE_MAP: dict[str, list[str]] = {}

def diamond() -> list[tuple[int, int]]:
    return [(W//2, 0), (W-1, H//2), (W//2, H-1), (0, H//2)]

def make_mask() -> Image.Image:
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(diamond(), fill=255)
    return m

MASK = make_mask()

def mix(a, b, t):
    return tuple(int(a[i]*(1-t)+b[i]*t) for i in range(4))

def seeded(name: str) -> random.Random:
    return random.Random(sum((i+1)*ord(c) for i, c in enumerate(name)))

def in_diamond(x, y):
    return MASK.getpixel((x, y)) > 0

def base_tile(kind: str, name: str, variant: int = 0) -> Image.Image:
    p = PALETTES[kind]
    img = Image.new('RGBA', (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    # Hand-painted isometric lighting: upper-left highlight, lower-right shade.
    for y in range(H):
        for x in range(W):
            if not in_diamond(x, y):
                continue
            shade = (y / max(1, H-1)) * 0.35 + (x / max(1, W-1)) * 0.12
            c = mix(p['base'], p['dark'], min(0.55, shade))
            if x < W*0.48 and y < H*0.48:
                c = mix(c, p['light'], 0.10)
            img.putpixel((x, y), c)
    # Pixel-art rim; bottom/right darker for depth.
    d.line([(W//2,0),(W-1,H//2),(W//2,H-1),(0,H//2),(W//2,0)], fill=mix(p['dark'], (0,0,0,255), 0.16), width=1)
    d.line([(0,H//2),(W//2,H-1),(W-1,H//2)], fill=mix(p['dark'], (0,0,0,255), 0.30), width=2)
    rng = seeded(name)
    # Purposeful AAA-ish micro detail: clumps, stones, blade strokes, cracks.
    for i in range(70):
        x = rng.randrange(8, W-8); y = rng.randrange(7, H-7)
        if not in_diamond(x, y):
            continue
        if kind == 'grass':
            col = p['light'] if i % 3 else p['dark']
            d.line((x, y, x+rng.choice([-1,0,1]), y-rng.randrange(1,4)), fill=col, width=1)
            if i % 13 == 0:
                d.ellipse((x-1,y-1,x+2,y+1), fill=p['accent'])
        elif kind == 'rocky':
            col = p['light'] if i % 4 == 0 else p['dark']
            d.polygon([(x,y-2),(x+3,y),(x+1,y+2),(x-2,y+1)], fill=col)
            d.point((x+1,y-1), fill=(220,210,178,180))
        elif kind == 'road':
            col = p['light'] if i % 5 == 0 else p['dark']
            d.rectangle((x,y,x+rng.randrange(1,3),y), fill=col)
            if i % 23 == 0:
                d.line((x-5,y,x+5,y+1), fill=p['accent'], width=1)
        else:
            col = p['light'] if i % 4 == 0 else p['dark']
            d.line((x, y, x+rng.randrange(-3,4), y+rng.randrange(-1,2)), fill=col, width=1)
    return img

def transition_tile(name: str, role: str, left_kind: str, right_kind: str, variant: int = 0) -> Image.Image:
    a = base_tile(left_kind, name+'-a', variant)
    b = base_tile(right_kind, name+'-b', variant)
    img = Image.new('RGBA', (W,H), (0,0,0,0))
    rng = seeded(name)
    for y in range(H):
        for x in range(W):
            if not in_diamond(x,y):
                continue
            seam = W/2 + math.sin(y*0.24 + variant)*10 + (rng.randrange(-2,3) if (x+y)%11==0 else 0)
            soft = max(0, min(1, (x - seam + 9) / 18))
            ca = a.getpixel((x,y)); cb = b.getpixel((x,y))
            img.putpixel((x,y), mix(ca, cb, soft))
    d = ImageDraw.Draw(img)
    # hand-painted seam flecks
    pa, pb = PALETTES[left_kind], PALETTES[right_kind]
    for i in range(36):
        y = rng.randrange(8,H-8); x = int(W/2 + math.sin(y*0.24+variant)*10 + rng.randrange(-8,9))
        if in_diamond(max(0,min(W-1,x)), y):
            d.point((x,y), fill=pa['light'] if i%2 else pb['light'])
    return img

def shore_tile(name: str, land_kind: str, frame: int = 0) -> Image.Image:
    land = base_tile(land_kind, name+str(frame), frame)
    img = land.copy(); d=ImageDraw.Draw(img)
    wp = PALETTES['water']
    # lower-right water inlet with animated foam/ripple.
    water_poly = [(W//2+4, H-4),(W-2,H//2+3),(W-2,H-2),(W//2,H-2)]
    d.polygon(water_poly, fill=wp['base'])
    d.line([(W//2+4,H-4),(W-2,H//2+3)], fill=wp['light'], width=1)
    for i in range(5):
        off=(frame*5+i*13)%36
        x0=W//2+14+off; y0=H-14-i*4
        d.arc((x0-18,y0-6,x0+18,y0+7), 185, 330, fill=(205,250,245,160), width=1)
    return img

def water_frame(name: str, frame: int, variant: int = 0) -> Image.Image:
    p=PALETTES['water']; img=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    for y in range(H):
        for x in range(W):
            if not in_diamond(x,y): continue
            wave = math.sin((x*0.10)+(frame*0.95)+(variant*0.7)) * 0.08 + math.sin((x+y)*0.055+frame*0.65)*0.06
            c = mix(p['base'], p['dark'], y/H*0.35)
            c = mix(c, p['light'], max(0,wave))
            img.putpixel((x,y), c)
    d.line(diamond()+[(W//2,0)], fill=(16,65,105,210), width=1)
    rng=seeded(name+str(frame))
    for i in range(12):
        x=rng.randrange(12,W-12); y=rng.randrange(12,H-10)
        if not in_diamond(x,y): continue
        length=rng.randrange(8,18)
        d.arc((x-length,y-4,x+length,y+5), 190, 350, fill=(177,250,246,150), width=1)
    return img

def cyber_water_frame(name: str, frame: int) -> Image.Image:
    img=water_frame(name, frame, 2); d=ImageDraw.Draw(img)
    # Litecoin/cyber glints, subtle enough to keep gameplay readable.
    for i in range(5):
        x=18 + ((frame*17 + i*23) % 92); y=18 + ((frame*7+i*11) % 26)
        if in_diamond(x,y):
            d.line((x-3,y,x+3,y), fill=(235,252,150,190)); d.point((x,y-1), fill=(255,255,210,210))
    return img

def spritesheet(frames: list[Image.Image]) -> Image.Image:
    out=Image.new('RGBA',(W*len(frames),H),(0,0,0,0))
    for i,frame in enumerate(frames): out.alpha_composite(frame,(i*W,0))
    return out

def save(asset: Asset, image: Image.Image):
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT/asset.filename, optimize=True)
    record = {
        'key': asset.key,
        'role': asset.role,
        'category': asset.category,
        'src': './assets/generated/hmh-level-one-ground/final-paint/' + asset.filename,
        'width': asset.width,
        'height': asset.height,
        'preferred': asset.preferred,
        'animated': asset.animated,
        'description': asset.description,
        'sourcePolicy': 'Original repo-owned final-paint terrain generated from HMH art direction; no downloaded pixels copied.',
    }
    if asset.animated:
        record.update({'frames': asset.frames, 'frameWidth': W, 'frameHeight': H, 'sheetWidth': W*asset.frames, 'frameMs': asset.frame_ms})
    ASSETS.append(record)
    ROLE_MAP.setdefault(asset.role, []).append(asset.key)

def make_all():
    specs: list[tuple[Asset, Callable[[], Image.Image]]] = []
    def add(name, role, category, fn, preferred=False, animated=False, desc=''):
        specs.append((Asset('final-paint/'+name, role, category, name+'.png', preferred=preferred, animated=animated, frames=FRAMES if animated else 1, description=desc), fn))
    add('grass-handpaint-01','grass','terrain',lambda:base_tile('grass','grass-handpaint-01',0),True,False,'lush Crypto Wasteland grass with hand-painted blade clusters')
    add('grass-handpaint-02','grass','terrain',lambda:base_tile('grass','grass-handpaint-02',1),False,False,'alternate grass patch for broad fields')
    add('dirt-handpaint-01','dirt','terrain',lambda:base_tile('dirt','dirt-handpaint-01',0),True,False,'warm dirt trail tile')
    add('dirt-handpaint-02','dirt','terrain',lambda:base_tile('dirt','dirt-handpaint-02',1),False,False,'pebbled dirt variation')
    add('sand-handpaint-01','sand','terrain',lambda:base_tile('sand','sand-handpaint-01',0),True,False,'desert sand with wind streaks')
    add('sand-handpaint-02','sand','terrain',lambda:base_tile('sand','sand-handpaint-02',1),False,False,'brighter dune sand variant')
    add('rocky-handpaint-01','rocky','terrain',lambda:base_tile('rocky','rocky-handpaint-01',0),True,False,'rocky mesa ground with chips')
    add('rocky-handpaint-02','rocky','terrain',lambda:base_tile('rocky','rocky-handpaint-02',1),False,False,'darker cliff-foot rocky ground')
    add('road-asphalt-handpaint-01','road','road',lambda:base_tile('road','road-asphalt-handpaint-01',0),True,False,'dark broken asphalt with Litecoin-yellow paint flecks')
    add('road-dirt-handpaint-01','road','road',lambda:transition_tile('road-dirt-handpaint-01','road','road','dirt',0),False,False,'asphalt-to-dirt rural road blend')
    add('grass-dirt-handpaint-01','grass-to-dirt','transition',lambda:transition_tile('grass-dirt-handpaint-01','grass-to-dirt','grass','dirt',0),True,False,'soft grass-to-dirt transition')
    add('grass-dirt-handpaint-02','grass-to-dirt','transition',lambda:transition_tile('grass-dirt-handpaint-02','grass-to-dirt','grass','dirt',1),False,False,'alternate grass-to-dirt transition')
    add('dirt-sand-handpaint-01','dirt-to-sand','transition',lambda:transition_tile('dirt-sand-handpaint-01','dirt-to-sand','dirt','sand',0),True,False,'dusty dirt-to-desert blend')
    add('dirt-sand-handpaint-02','dirt-to-sand','transition',lambda:transition_tile('dirt-sand-handpaint-02','dirt-to-sand','dirt','sand',1),False,False,'alternate dirt-to-desert blend')
    add('grass-sand-handpaint-01','grass-to-sand','transition',lambda:transition_tile('grass-sand-handpaint-01','grass-to-sand','grass','sand',0),True,False,'grassland fading into desert')
    add('grass-water-handpaint-01','grass-to-water','transition',lambda:spritesheet([shore_tile('grass-water-handpaint-01','grass',f) for f in range(FRAMES)]),'',True,'animated grass bank with water edge')
    add('water-ripple-handpaint-01','water','water',lambda:spritesheet([water_frame('water-ripple-handpaint-01',f,0) for f in range(FRAMES)]),True,True,'six-frame hand-painted water ripple')
    add('water-litecoin-glint-01','water','water',lambda:spritesheet([cyber_water_frame('water-litecoin-glint-01',f) for f in range(FRAMES)]),False,True,'six-frame water with subtle Litecoin glints')
    add('shore-grass-water-handpaint-01','shore','shore',lambda:spritesheet([shore_tile('shore-grass-water-handpaint-01','grass',f) for f in range(FRAMES)]),True,True,'animated grass shoreline foam')
    add('shore-dirt-water-handpaint-01','shore','shore',lambda:spritesheet([shore_tile('shore-dirt-water-handpaint-01','dirt',f) for f in range(FRAMES)]),False,True,'animated dirt shoreline foam')
    add('shore-sand-water-handpaint-01','shore','shore',lambda:spritesheet([shore_tile('shore-sand-water-handpaint-01','sand',f) for f in range(FRAMES)]),False,True,'animated sand shoreline foam')
    for asset, fn in specs:
        save(asset, fn())

def contact_sheet():
    DOC_ASSETS.mkdir(parents=True, exist_ok=True)
    cellw, cellh, cols = 218, 142, 4
    rows = math.ceil(len(ASSETS)/cols)
    sheet=Image.new('RGB',(cols*cellw,rows*cellh+44),(22,24,30)); d=ImageDraw.Draw(sheet)
    d.text((12,12),'HMH Level 1 final-paint ground + animated water', fill=(242,245,255))
    for i,a in enumerate(ASSETS):
        im=Image.open(OUT/(a['key'].split('/')[1]+'.png')).convert('RGBA')
        if a.get('animated'):
            im=im.crop((0,0,W,H))
        bg=Image.new('RGBA',(W,H),(36,38,44,255)); bg.alpha_composite(im)
        thumb=bg.convert('RGB').resize((W*1,H*1), Image.Resampling.NEAREST)
        x=(i%cols)*cellw; y=(i//cols)*cellh+44
        d.rectangle((x+5,y+5,x+cellw-5,y+cellh-5), fill=(38,42,52), outline=(76,85,103))
        sheet.paste(thumb,(x+(cellw-W)//2,y+12))
        label=a['key'].replace('final-paint/','')[:31]
        d.text((x+10,y+86),label, fill=(170,222,255))
        d.text((x+10,y+104),f"{a['role']} · {'anim' if a.get('animated') else 'static'}", fill=(222,222,222))
        if a.get('animated'):
            d.text((x+10,y+122),f"{a['frames']} frames @ {a['frameMs']}ms", fill=(168,245,190))
    sheet.save(DOC_ASSETS/'hmh-level-1-final-paint-ground-contact-sheet.png', quality=95)

def write_manifest():
    manifest = {
        'id':'hmh-level-one-final-paint-ground-v1',
        'source':'Original HMH final-paint terrain generation pass',
        'license':'Repo-owned / Lester Arcade project art',
        'sourcePolicy':'Original repo-owned final-paint terrain generated from HMH art direction; no downloaded pixels copied. SBS CC0 pack remains only geometry/fallback reference.',
        'tileWidth':W,
        'tileHeights':[H],
        'assetCount':len(ASSETS),
        'roles':ROLE_MAP,
        'assets':ASSETS,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'final-paint-level-one-ground-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    helper = (
        '// Generated by scripts/generate-hmh-level-one-final-paint-ground.py\n'
        'export const HMH_LEVEL_ONE_FINAL_PAINT_GROUND = Object.freeze(' + json.dumps(manifest, indent=2) + ');\n\n'
        'const FINAL_PAINT_GROUND_BY_KEY = new Map(HMH_LEVEL_ONE_FINAL_PAINT_GROUND.assets.map((asset) => [asset.key, Object.freeze(asset)]));\n'
        'export function finalPaintGroundAssetByKey(key) { return FINAL_PAINT_GROUND_BY_KEY.get(key) ?? null; }\n'
    )
    (OUT/'final-paint-level-one-ground-manifest.mjs').write_text(helper, encoding='utf-8')

def write_doc():
    DOC.write_text(
        '# Hard Money Heroes Level 1 final-paint ground pass\n\n'
        '_Last updated: 2026-06-25_\n\n'
        'This pass adds original repo-owned final-paint terrain and animated water/shore spritesheets for Level 1. The earlier SBS CC0 ingestion remains as the geometry/fallback foundation, but these PNGs do not copy downloaded pixels.\n\n'
        f'- Runtime folder: `apps/portal/assets/generated/hmh-level-one-ground/final-paint/`\n'
        f'- Asset count: **{len(ASSETS)}**\n'
        '- Animated tiles: water ripple, Litecoin water glint, grass/dirt/sand shoreline, and grass-water bank.\n'
        '- Contact sheet: `docs/game-design/assets/hmh-level-1-final-paint-ground-contact-sheet.png`\n\n'
        '## Runtime intent\n\n'
        'The selector now prefers `final-paint/*` tiles for Level 1 while preserving SBS CC0 tiles as fallback metadata/art. Animated water and shore spritesheets are frame-stripped in the renderer so water reads alive without touching gameplay determinism.\n',
        encoding='utf-8'
    )

def main():
    make_all(); contact_sheet(); write_manifest(); write_doc()
    print(json.dumps({'assetCount':len(ASSETS), 'outDir':str(OUT)}, indent=2))

if __name__ == '__main__':
    main()
