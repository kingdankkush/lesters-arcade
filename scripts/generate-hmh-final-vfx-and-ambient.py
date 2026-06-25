#!/usr/bin/env python
"""Generate original final combat VFX and ambient world animation packs for HMH."""
from __future__ import annotations
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
VFX_DIR = ROOT / 'apps/portal/assets/generated/hmh-final-combat-vfx'
AMBIENT_DIR = ROOT / 'apps/portal/assets/generated/hmh-coherent-world/level-final-ambient'
DOCS = ROOT / 'docs/game-design'
DOC_ASSETS = DOCS / 'assets'

VFX_ASSETS = []
AMBIENT_ASSETS = []

PAL = {
    'white': (255, 250, 221, 255), 'gold': (255, 210, 100, 255), 'orange': (255, 132, 54, 255),
    'red': (230, 45, 70, 255), 'blood': (145, 18, 48, 255), 'cyan': (74, 224, 214, 255),
    'blue': (55, 130, 217, 255), 'brass': (212, 168, 56, 255), 'smoke': (104, 111, 126, 170),
    'dust': (205, 162, 92, 180), 'leaf': (67, 150, 76, 220), 'leaf2': (153, 190, 77, 220),
    'neon': (255, 72, 180, 255), 'outline': (22, 21, 28, 255), 'shadow': (0, 0, 0, 70),
}

def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))
def star(d, cx, cy, r, color):
    d.polygon([(cx, cy-r), (cx+r//3, cy-r//3), (cx+r, cy), (cx+r//3, cy+r//3), (cx, cy+r), (cx-r//3, cy+r//3), (cx-r, cy), (cx-r//3, cy-r//3)], fill=color)
def rect(d, x, y, w, h, color): d.rectangle((x, y, x+w, y+h), fill=color)
def line(d, xy, color, width=1): d.line(xy, fill=color, width=width)

def save_sheet(kind, key, frames, frame_w, frame_h, draw_frame, meta):
    out_dir = VFX_DIR if kind == 'vfx' else AMBIENT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet = blank(frame_w * frames, frame_h)
    for i in range(frames):
        fr = blank(frame_w, frame_h); d = ImageDraw.Draw(fr); draw_frame(d, i, frame_w, frame_h)
        sheet.alpha_composite(fr, (i * frame_w, 0))
    name = f'{key}.png'
    sheet.save(out_dir / name, optimize=True)
    asset = {
        'key': key if kind == 'vfx' else f'level-final-ambient/{key}',
        'category': meta['category'], 'role': meta['role'],
        'src': f'./assets/generated/hmh-final-combat-vfx/{name}' if kind == 'vfx' else f'./assets/generated/hmh-coherent-world/level-final-ambient/{name}',
        'animated': True, 'frames': frames, 'frameMs': meta.get('frameMs', 90),
        'frameWidth': frame_w, 'frameHeight': frame_h, 'sheetWidth': frame_w * frames, 'sheetHeight': frame_h,
        'sourcePolicy': 'Original repo-owned pixel-art spritesheet; no downloaded pixels copied.',
        'notes': meta.get('notes', ''),
    }
    (VFX_ASSETS if kind == 'vfx' else AMBIENT_ASSETS).append(asset)

def draw_muzzle(colors):
    def fn(d, i, w, h):
        cx, cy = w//2, h//2; r = max(3, 12 - i * 2)
        star(d, cx, cy, r+2, PAL['white']); star(d, cx, cy, r, colors[i % len(colors)])
        rect(d, cx-2, cy-1, 4, 2, PAL['outline'])
    return fn

def draw_sparks(colors):
    def fn(d, i, w, h):
        cx, cy = w//2, h//2
        for n in range(10):
            a = (n / 10) * math.tau + i * 0.32; r = 8 + i * 3 + (n % 3) * 2
            x, y = cx + math.cos(a)*r, cy + math.sin(a)*r
            line(d, (cx, cy, x, y), colors[n % len(colors)], 2 if n % 2 else 1)
    return fn

def draw_shell(d, i, w, h):
    cx = 14 + i * 5; cy = 22 + int(math.sin(i)*4)
    d.ellipse((cx-10, h-10, cx+28, h-3), fill=PAL['shadow'])
    d.polygon([(cx,cy),(cx+13,cy+2),(cx+12,cy+7),(cx-1,cy+5)], fill=PAL['brass'], outline=PAL['outline'])
    rect(d, cx+11, cy+3, 3, 4, PAL['gold'])

def draw_coin(d, i, w, h):
    cx, cy = w//2, h//2; r = 7 + i
    d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=PAL['gold'], outline=PAL['outline'])
    d.text((cx-3, cy-5), '$', fill=(70, 44, 20, 255))
    for n in range(5): star(d, 8+n*10, 9 + ((i+n)%3)*5, 3, PAL['white'])

def draw_explosion(d, i, w, h):
    cx, cy = w//2, h//2; r = 10 + i*6
    d.ellipse((cx-r, cy-r//2, cx+r, cy+r//2), outline=PAL['orange'], width=3)
    for n in range(16):
        a = n/16*math.tau; rr = r + (n%3)*4
        star(d, cx+math.cos(a)*rr, cy+math.sin(a)*rr*0.55, 4, [PAL['white'], PAL['gold'], PAL['red']][n%3])

def draw_dust(d, i, w, h):
    cx, cy = w//2, h//2+10
    for n in range(14):
        a = n/14*math.tau + i*.15; rr = 8+i*4+(n%4)
        d.ellipse((cx+math.cos(a)*rr-3, cy+math.sin(a)*rr*.45-3, cx+math.cos(a)*rr+3, cy+math.sin(a)*rr*.45+3), fill=PAL['dust'])

def draw_gore(d, i, w, h):
    cx, cy = w//2, h//2
    for n in range(18):
        a = (n/18)*math.tau; rr = 5 + i*5 + (n%5)
        d.rectangle((cx+math.cos(a)*rr-2, cy+math.sin(a)*rr-2, cx+math.cos(a)*rr+2, cy+math.sin(a)*rr+2), fill=[PAL['red'], PAL['blood'], PAL['orange']][n%3])

def draw_level(d, i, w, h):
    cx, cy = w//2, h//2
    for n in range(12):
        a = n/12*math.tau + i*.35; r = 9 + n%2*7
        star(d, cx+math.cos(a)*r, cy+math.sin(a)*r, 3, [PAL['cyan'], PAL['gold'], PAL['white']][n%3])
    d.ellipse((cx-12, cy-12, cx+12, cy+12), outline=PAL['cyan'], width=2)

def draw_dust_devil(d, i, w, h):
    d.ellipse((16, h-13, w-16, h-5), fill=PAL['shadow'])
    for n in range(5):
        y = h-15-n*8; rx = 30-n*4; shift = math.sin((i+n)*.8)*8
        d.arc((w//2-rx+shift, y-4, w//2+rx+shift, y+10), 200, 520, fill=PAL['dust'], width=2)

def draw_leaf_swirl(d, i, w, h):
    d.ellipse((14, h-12, w-14, h-5), fill=PAL['shadow'])
    for n in range(12):
        a = n/12*math.tau + i*.35; r = 10 + (n%4)*5
        x = w//2+math.cos(a)*r; y = h//2+math.sin(a)*r*.55
        d.rectangle((x-2,y-1,x+3,y+2), fill=PAL['leaf'] if n%2 else PAL['leaf2'])

def draw_water_sparkle(d, i, w, h):
    d.ellipse((8, h//2+6, w-8, h//2+20), fill=(41,157,197,90))
    for n in range(7):
        x = 12+n*15; y = h//2+10+math.sin((i+n)*.8)*5
        d.arc((x-7,y-3,x+12,y+5), 190, 350, fill=PAL['cyan'], width=2)
        if (i+n)%3==0: star(d,x+3,y-4,3,PAL['white'])

def draw_neon(d, i, w, h):
    d.rectangle((12, 12, w-12, h-10), fill=(36, 31, 45, 210), outline=PAL['outline'])
    color = PAL['neon'] if i % 2 else PAL['cyan']
    d.rectangle((20, 22, w-20, h-26), outline=color, width=3)
    d.text((25, 27), 'LIT', fill=color)

def draw_heat(d, i, w, h):
    for n in range(6):
        y = 12+n*8
        pts=[]
        for x in range(8, w-8, 8): pts.append((x, y + math.sin((x+i*6+n*5)/11)*3))
        line(d, pts, (255, 210, 100, 105), 2)

def draw_coin_dust(d, i, w, h):
    for n in range(10):
        x=10+n*10; y=h-18-int((i+n)%5)*5
        d.ellipse((x-2,y-2,x+2,y+2), fill=PAL['gold'] if n%3 else PAL['dust'])

def draw_static(d, i, w, h):
    for n in range(20):
        x=(n*17+i*9)%w; y=(n*11+i*5)%h
        rect(d,x,y,2+(n%3),1,[PAL['cyan'],PAL['neon'],PAL['white']][n%3])

def draw_fireflies(d, i, w, h):
    for n in range(12):
        x=8+(n*19+i*3)%max(1,w-16); y=10+((n*13+i*5)%max(1,h-22))
        star(d,x,y,2+(n+i)%2,PAL['gold'])

def draw_ash(d, i, w, h):
    for n in range(16):
        x=8+(n*13+i*4)%max(1,w-16); y=8+((n*17-i*3)%max(1,h-16))
        d.rectangle((x,y,x+2,y+2), fill=PAL['smoke'] if n%2 else PAL['red'])

def write_manifest():
    VFX_DIR.mkdir(parents=True, exist_ok=True); AMBIENT_DIR.mkdir(parents=True, exist_ok=True)
    vfx = {'id':'hmh-final-combat-vfx-v1','sourcePolicy':'Original repo-owned combat VFX pixel spritesheets; no downloaded pixels copied.','excludesNormalBulletSprites':True,'assetCount':len(VFX_ASSETS),'assets':VFX_ASSETS}
    (VFX_DIR/'hmh-final-combat-vfx-manifest.json').write_text(json.dumps(vfx, indent=2), encoding='utf-8')
    (VFX_DIR/'hmh-final-combat-vfx-manifest.mjs').write_text('// Generated by scripts/generate-hmh-final-vfx-and-ambient.py\nexport const HMH_FINAL_COMBAT_VFX_PACK = Object.freeze('+json.dumps(vfx,indent=2)+');\n\nconst FINAL_COMBAT_VFX_BY_KEY = new Map(HMH_FINAL_COMBAT_VFX_PACK.assets.map((asset) => [asset.key, Object.freeze(asset)]));\nexport function finalCombatVfxAssetByKey(key) { return FINAL_COMBAT_VFX_BY_KEY.get(key) ?? null; }\nexport function finalCombatVfxKeys() { return [...FINAL_COMBAT_VFX_BY_KEY.keys()]; }\n', encoding='utf-8')
    ambient = {'id':'hmh-level-one-final-ambient-world-v1','sourcePolicy':'Original repo-owned animated ambient world detail loops; no downloaded pixels copied.','assetCount':len(AMBIENT_ASSETS),'assets':AMBIENT_ASSETS}
    (AMBIENT_DIR/'level-final-ambient-manifest.json').write_text(json.dumps(ambient, indent=2), encoding='utf-8')
    (AMBIENT_DIR/'level-final-ambient-manifest.mjs').write_text('// Generated by scripts/generate-hmh-final-vfx-and-ambient.py\nexport const HMH_FINAL_WORLD_AMBIENT_ASSETS = Object.freeze('+json.dumps(ambient,indent=2)+');\n\nconst FINAL_WORLD_AMBIENT_BY_KEY = new Map(HMH_FINAL_WORLD_AMBIENT_ASSETS.assets.map((asset) => [asset.key, Object.freeze(asset)]));\nexport function finalWorldAmbientAssetByKey(key) { return FINAL_WORLD_AMBIENT_BY_KEY.get(key) ?? null; }\n', encoding='utf-8')

def contact_sheet(assets, base_dir, path, title):
    DOC_ASSETS.mkdir(parents=True, exist_ok=True)
    cols, cellw, cellh = 5, 178, 118; rows = math.ceil(len(assets)/cols)
    sheet=Image.new('RGB',(cols*cellw,rows*cellh+38),(20,22,30)); d=ImageDraw.Draw(sheet); d.text((12,12),title,fill=(235,242,255))
    for i,a in enumerate(assets):
        name=a['src'].split('/')[-1]; im=Image.open(base_dir/name).convert('RGBA')
        frame=im.crop((0,0,a['frameWidth'],a['frameHeight'])); bg=Image.new('RGBA',frame.size,(35,39,50,255)); bg.alpha_composite(frame); thumb=bg.convert('RGB'); thumb.thumbnail((130,64),Image.Resampling.NEAREST)
        x=(i%cols)*cellw; y=(i//cols)*cellh+38; d.rectangle((x+5,y+5,x+cellw-5,y+cellh-5),fill=(37,42,53),outline=(78,86,106)); sheet.paste(thumb,(x+(cellw-thumb.width)//2,y+10)); d.text((x+10,y+78),a['key'][-28:],fill=(150,225,255)); d.text((x+10,y+96),a['category'],fill=(220,230,200))
    sheet.save(path, quality=95)

def docs():
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS/'hard-money-heroes-final-vfx-and-ambient-pack.md').write_text('# Hard Money Heroes final VFX and ambient world pack\n\n_Last updated: 2026-06-25_\n\nAdds original repo-owned combat VFX spritesheets for readable large effects and ambient animated world-detail loops for Level 1. Normal bullets remain coded tracer/projectile primitives rather than spritesheets.\n', encoding='utf-8')
    contact_sheet(VFX_ASSETS, VFX_DIR, DOC_ASSETS/'hmh-final-combat-vfx-contact-sheet.png', 'HMH final combat VFX pack')
    contact_sheet(AMBIENT_ASSETS, AMBIENT_DIR, DOC_ASSETS/'hmh-final-ambient-world-contact-sheet.png', 'HMH final ambient world loops')

def main():
    save_sheet('vfx','muzzle-flash-pistol',6,48,48,draw_muzzle([PAL['gold'],PAL['orange'],PAL['white']]),{'category':'weapon','role':'muzzle','frameMs':35})
    save_sheet('vfx','muzzle-flash-rail',6,56,48,draw_muzzle([PAL['cyan'],PAL['blue'],PAL['white']]),{'category':'weapon','role':'muzzle','frameMs':35})
    save_sheet('vfx','hit-spark-metal',6,64,64,draw_sparks([PAL['white'],PAL['cyan'],PAL['gold']]),{'category':'impact','role':'hit-spark','frameMs':45})
    save_sheet('vfx','hit-spark-flesh',6,64,64,draw_sparks([PAL['orange'],PAL['red'],PAL['gold']]),{'category':'impact','role':'hit-spark','frameMs':45})
    save_sheet('vfx','shell-casing-brass',8,48,48,draw_shell,{'category':'weapon','role':'shell-casing','frameMs':60})
    save_sheet('vfx','coin-pickup-pop',8,48,48,draw_coin,{'category':'pickup','role':'pickup-pop','frameMs':55})
    save_sheet('vfx','grenade-explosion-ring',8,96,96,draw_explosion,{'category':'explosion','role':'explosion','frameMs':60})
    save_sheet('vfx','death-dust-burst',8,80,64,draw_dust,{'category':'death','role':'death-burst','frameMs':65})
    save_sheet('vfx','gore-pixel-splatter',8,80,64,draw_gore,{'category':'gore','role':'gore-overlay','frameMs':70})
    save_sheet('vfx','level-up-burst',8,72,72,draw_level,{'category':'reward','role':'level-up','frameMs':55})
    save_sheet('ambient','desert-dust-devil',8,96,80,draw_dust_devil,{'category':'desert','role':'decor','frameMs':120})
    save_sheet('ambient','leaf-swirl',8,96,80,draw_leaf_swirl,{'category':'forest','role':'decor','frameMs':120})
    save_sheet('ambient','water-sparkle-line',8,120,48,draw_water_sparkle,{'category':'water','role':'water-strip','frameMs':110})
    save_sheet('ambient','neon-window-flicker',6,96,72,draw_neon,{'category':'town','role':'decor','frameMs':140})
    save_sheet('ambient','road-heat-haze',8,120,48,draw_heat,{'category':'road','role':'decor','frameMs':115})
    save_sheet('ambient','coin-dust-motes',8,96,56,draw_coin_dust,{'category':'fx','role':'decor','frameMs':120})
    save_sheet('ambient','billboard-static',6,96,64,draw_static,{'category':'town','role':'sign','frameMs':90})
    save_sheet('ambient','firefly-pocket',8,96,72,draw_fireflies,{'category':'forest','role':'decor','frameMs':130})
    save_sheet('ambient','ash-ember-drift',8,96,72,draw_ash,{'category':'desert','role':'decor','frameMs':120})
    save_sheet('ambient','shore-foam-sparkle',8,120,48,draw_water_sparkle,{'category':'water','role':'water-strip','frameMs':100})
    write_manifest(); docs()
    print(json.dumps({'vfxAssets':len(VFX_ASSETS),'ambientAssets':len(AMBIENT_ASSETS)},indent=2))

if __name__ == '__main__': main()
