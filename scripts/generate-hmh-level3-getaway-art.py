#!/usr/bin/env python
"""Generate original HMH Level 3 getaway world-art and ground packs."""
from __future__ import annotations
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
WORLD_DIR = ROOT / 'apps/portal/assets/generated/hmh-coherent-world/level3-final-getaway'
GROUND_DIR = ROOT / 'apps/portal/assets/generated/hmh-level-three-ground/final-getaway'
DOCS = ROOT / 'docs/game-design'
DOC_ASSETS = DOCS / 'assets'

PAL = {
    'ink': (15, 17, 26, 255), 'shadow': (0, 0, 0, 82), 'tar': (36, 38, 50, 255),
    'tar2': (50, 53, 67, 255), 'glass': (84, 137, 178, 180), 'glass2': (139, 215, 255, 210),
    'ltc': (183, 204, 255, 255), 'cyan': (72, 235, 255, 255), 'blue': (69, 130, 255, 255),
    'pink': (255, 62, 199, 255), 'gold': (255, 211, 83, 255), 'orange': (255, 128, 45, 255),
    'red': (255, 54, 84, 255), 'green': (97, 234, 129, 255), 'storm': (58, 67, 91, 255),
    'steel': (119, 135, 159, 255), 'darksteel': (64, 73, 91, 255), 'white': (241, 248, 255, 255),
}

def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))
def line(d, xy, c, width=1): d.line(xy, fill=c, width=width)
def rect(d, x, y, w, h, c, outline=None): d.rectangle((x, y, x+w, y+h), fill=c, outline=outline)
def star(d, cx, cy, r, c): d.polygon([(cx,cy-r),(cx+r//3,cy-r//3),(cx+r,cy),(cx+r//3,cy+r//3),(cx,cy+r),(cx-r//3,cy+r//3),(cx-r,cy),(cx-r//3,cy-r//3)], fill=c)
def ellipse_shadow(d, w, h): d.ellipse((10, h-15, w-10, h-5), fill=PAL['shadow'])

WORLD_DEFS = [
 ('penthouse-evac-lane','penthouse-launch-pad','route',160,104,8), ('helipad-evac-chopper','penthouse-launch-pad','landmark',160,120,8), ('vip-luggage-barricade','penthouse-launch-pad','cover',136,88,6), ('roof-garden-planter-row','penthouse-launch-pad','cover',136,88,6), ('wind-torn-banner-line','penthouse-launch-pad','sign',160,80,8), ('emergency-stair-glow','penthouse-launch-pad','edge',112,128,8),
 ('skybridge-fracture-span','skybridge-breakpoint','bridge',176,96,8), ('warning-rail-blink','skybridge-breakpoint','edge',160,72,8), ('glass-floor-crack-web','skybridge-breakpoint','hazard',136,96,6), ('vertical-drop-parallax','skybridge-breakpoint','backdrop',160,128,8), ('ad-panel-sparking','skybridge-breakpoint','decor',136,96,8), ('overhead-pursuit-drone','skybridge-breakpoint','enemy-prop',112,96,8),
 ('mainnet-train-roof-car','mainnet-express','train',176,104,8), ('armored-conductor-car','mainnet-express','train',176,112,8), ('train-door-seam-lights','mainnet-express','edge',136,80,8), ('power-conduit-sparks','mainnet-express','hazard',136,88,8), ('speed-line-billboard','mainnet-express','sign',160,96,8), ('coupler-gap-warning','mainnet-express','hazard',136,72,6),
 ('extraction-car-beacon','finale-extraction','landmark',176,120,8), ('finale-storm-clouds','finale-extraction','backdrop',176,112,8), ('mainnet-exit-sign','finale-extraction','sign',136,88,6), ('escape-ladder-drop','finale-extraction','edge',112,128,8), ('coin-cache-crate','finale-extraction','pickup',112,88,6), ('rail-tunnel-mouth','finale-extraction','landmark',176,120,8),
]
GROUND_DEFS = [
 ('rooftop-tar-prime','rooftop-tar',False,1), ('rooftop-tar-rain-sheen','rooftop-tar',True,6), ('roof-edge-warning-stripe','roof-edge',False,1), ('roof-edge-beacon-rain','roof-edge',True,6), ('glass-skybridge-prime','glass-bridge',False,1), ('glass-skybridge-cracked','glass-bridge',False,1), ('train-roof-prime','train-roof',False,1), ('train-roof-rivet-line','train-roof',False,1), ('rail-coupler-gap','rail-gap',False,1), ('rail-gap-warning-flash','rail-gap',True,6), ('storm-runoff-flow','storm-runoff',True,8), ('storm-runoff-puddle','storm-runoff',True,6), ('speed-lines-blue','speed-lines',True,8), ('speed-lines-gold','speed-lines',True,8), ('maintenance-grate','maintenance-grate',False,1), ('maintenance-grate-spark','maintenance-grate',True,6), ('extraction-car-floor','extraction-car',False,1), ('extraction-car-beacon-floor','extraction-car',True,6), ('transition-roof-to-train','roof-to-train',False,1), ('transition-glass-to-rail','glass-to-rail',False,1),]

def draw_world(key, d, i, w, h):
    ellipse_shadow(d, w, h)
    pulse = i % 2 == 0
    if 'evac-lane' in key:
        rect(d,18,34,w-36,38,PAL['tar'],PAL['ink']); line(d,(20,53,w-20,53),PAL['gold'] if pulse else PAL['ltc'],3); d.text((45,43),'EVAC →',fill=PAL['white'])
        for n in range(5): rect(d,25+n*24,66,10,8,PAL['orange'] if (i+n)%2 else PAL['red'],PAL['ink'])
    elif 'chopper' in key:
        d.ellipse((22,58,w-22,h-18), outline=PAL['cyan'], width=3); d.text((w//2-5,70),'H',fill=PAL['ltc']); line(d,(36,26,w-36,26+math.sin(i)*5),PAL['white'],3); rect(d,w//2-24,34,48,20,PAL['darksteel'],PAL['ink']); line(d,(w//2,54,w//2,h-20),PAL['steel'],3)
    elif 'luggage' in key or 'crate' in key:
        for n,c in enumerate([PAL['pink'],PAL['blue'],PAL['gold'],PAL['steel']]): rect(d,18+n*25,48-(n%2)*6,28,22,c,PAL['ink'])
        star(d,104,42+(i%3),4,PAL['cyan'])
    elif 'planter' in key:
        for n in range(5): rect(d,12+n*25,56,20,18,PAL['darksteel'],PAL['ink']); d.ellipse((10+n*25,38+math.sin(i+n)*4,36+n*25,63),fill=PAL['green'],outline=PAL['ink'])
    elif 'banner' in key:
        line(d,(16,26,w-16,20+math.sin(i)*5),PAL['steel'],3)
        for n in range(4): d.polygon([(32+n*28,27),(52+n*28,24+math.sin(i+n)*5),(50+n*28,50),(30+n*28,52)], fill=[PAL['pink'],PAL['cyan'],PAL['gold'],PAL['red']][n], outline=PAL['ink'])
    elif 'stair' in key or 'ladder' in key:
        rect(d,38,12,36,h-24,PAL['darksteel'],PAL['ink']);
        for y in range(24,h-20,14): line(d,(38,y,74,y),PAL['cyan'] if (i+y//14)%2 else PAL['ltc'],2)
    elif 'skybridge' in key:
        d.polygon([(8,36),(w-8,26),(w-24,h-32),(24,h-22)], fill=PAL['glass'], outline=PAL['ltc']); line(d,(26,43,w-33,36),PAL['white'],2); line(d,(42,h-38,w-50,h-44),PAL['cyan'],2)
    elif 'rail' in key:
        line(d,(8,30,w-8,30),PAL['steel'],4); line(d,(8,54,w-8,54),PAL['steel'],4)
        for n in range(8): star(d,18+n*18,30,4,PAL['red'] if (i+n)%2 else PAL['gold'])
    elif 'crack' in key:
        rect(d,18,18,w-36,h-36,PAL['glass'],PAL['ltc']);
        for n in range(8): line(d,(w//2, h//2, 18+n*14, 20+(n*17+i*3)%(h-40)),PAL['white'],1)
    elif 'drop' in key:
        for n in range(8): line(d,(20+n*18,12,10+n*14,h-18),PAL['blue'] if n%2 else PAL['pink'],1); star(d,22+n*18,22+(i+n)*7%(h-42),2,PAL['white'])
    elif 'sparking' in key or 'conduit' in key:
        rect(d,18,30,w-36,34,PAL['darksteel'],PAL['ink']);
        for n in range(6): star(d,30+n*18,45+math.sin(i+n)*12,5,[PAL['cyan'],PAL['gold'],PAL['red']][n%3])
    elif 'drone' in key:
        rect(d,w//2-22,38,44,18,PAL['darksteel'],PAL['ink']); line(d,(w//2-40,34,w//2+40,34+math.sin(i)*4),PAL['steel'],3); star(d,w//2,47,5,PAL['red'] if pulse else PAL['cyan'])
    elif 'train-roof' in key or 'conductor' in key:
        rect(d,12,34,w-24,44,PAL['steel'] if 'conductor' not in key else PAL['darksteel'],PAL['ink']); line(d,(20,44,w-20,44),PAL['cyan'],2); line(d,(22,66,w-22,66),PAL['gold'] if pulse else PAL['ltc'],2)
        for n in range(7): rect(d,24+n*20,52,10,8,PAL['tar'],PAL['ink'])
    elif 'door-seam' in key:
        rect(d,16,26,w-32,32,PAL['steel'],PAL['ink']);
        for n in range(5): star(d,24+n*22,42,4,PAL['green'] if (i+n)%2 else PAL['red'])
    elif 'billboard' in key or 'sign' in key:
        rect(d,14,20,w-28,h-42,PAL['ink'],PAL['pink']); d.text((28,34),'MAINNET' if 'exit' in key else 'SPEED',fill=PAL['cyan'] if pulse else PAL['gold'])
        for n in range(9): rect(d,24+n*12,h-50+(i+n)%4*2,6,2,[PAL['cyan'],PAL['pink'],PAL['gold']][n%3])
    elif 'coupler' in key:
        rect(d,18,28,42,26,PAL['steel'],PAL['ink']); rect(d,w-60,28,42,26,PAL['steel'],PAL['ink']); line(d,(62,41,w-62,41),PAL['red'] if pulse else PAL['gold'],5)
    elif 'beacon' in key:
        rect(d,14,44,w-28,34,PAL['steel'],PAL['ink']); d.ellipse((w//2-24,18,w//2+24,66),outline=PAL['cyan'],width=3); star(d,w//2,42,10,PAL['gold'] if pulse else PAL['white'])
    elif 'storm' in key:
        for n in range(5): d.ellipse((12+n*28,20+math.sin(i+n)*5,58+n*28,58+math.sin(i+n)*5),fill=PAL['storm'],outline=PAL['ink']);
        line(d,(50,62,40,88,60,76,52,100),PAL['gold'] if pulse else PAL['ltc'],3)
    elif 'tunnel' in key:
        d.arc((18,16,w-18,h+38),180,360,fill=PAL['steel'],width=7); rect(d,38,55,w-76,36,PAL['ink']); line(d,(38,90,w-38,90),PAL['cyan'],3)
    else:
        rect(d,20,30,w-40,36,PAL['steel'],PAL['ink']); star(d,w//2,h//2,6,PAL['cyan'])

def save_world_asset(key, district, role, fw, fh, frames):
    sheet=blank(fw*frames,fh)
    for i in range(frames):
        fr=blank(fw,fh); d=ImageDraw.Draw(fr); draw_world(key,d,i,fw,fh); sheet.alpha_composite(fr,(i*fw,0))
    WORLD_DIR.mkdir(parents=True, exist_ok=True); path=WORLD_DIR/f'{key}.png'; sheet.save(path,optimize=True)
    return {'key':f'level3-final-getaway/{key}','district':district,'role':role,'src':f'./assets/generated/hmh-coherent-world/level3-final-getaway/{key}.png','animated':True,'frames':frames,'frameMs':95,'frameWidth':fw,'frameHeight':fh,'sheetWidth':sheet.width,'sheetHeight':sheet.height,'sourcePolicy':'Original repo-owned Level 3 getaway pixel-art spritesheet; no downloaded pixels copied.'}

def draw_ground(role, variant, d, i, w, h):
    base = {'rooftop-tar':PAL['tar'],'roof-edge':PAL['tar2'],'glass-bridge':(55,92,125,210),'train-roof':PAL['steel'],'rail-gap':PAL['ink'],'storm-runoff':(46,83,116,220),'speed-lines':PAL['darksteel'],'maintenance-grate':PAL['darksteel'],'extraction-car':PAL['steel'],'roof-to-train':PAL['tar2'],'glass-to-rail':(70,115,145,220)}.get(role,PAL['tar'])
    d.polygon([(w//2,0),(w,h//2),(w//2,h),(0,h//2)], fill=base, outline=PAL['ink'])
    # iso grid / texture
    for n in range(-2,6):
        x=n*28 + (i*7 if role=='speed-lines' else 0)%28
        line(d,(x, h//2, x+w//2, 0), PAL['cyan'] if role in ['speed-lines','glass-bridge'] else PAL['storm'], 1)
        line(d,(x, h//2, x+w//2, h), PAL['pink'] if role=='speed-lines' else PAL['darksteel'], 1)
    if role == 'roof-edge': line(d,(12,h//2,w-12,h//2), PAL['gold'] if i%2 else PAL['red'], 4)
    if role == 'train-roof':
        for n in range(5): d.ellipse((24+n*16,h//2-5,30+n*16,h//2+1), fill=PAL['ink']); line(d,(18,h//2+12,w-18,h//2+12),PAL['cyan'],2)
    if role == 'rail-gap': line(d,(20,h//2-10,w-20,h//2+10),PAL['red'] if i%2 else PAL['gold'],4)
    if role == 'storm-runoff':
        for n in range(6): d.arc((15+n*15,25+math.sin(i+n)*3,42+n*15,48+math.sin(i+n)*3),180,350,fill=PAL['white'],width=2)
    if role == 'maintenance-grate':
        for n in range(5): line(d,(28+n*14,24,28+n*14,h-24),PAL['steel'],2)
        if 'spark' in variant: star(d,82,36+(i%4)*3,5,PAL['gold'])
    if role == 'extraction-car': star(d,w//2,h//2,7,PAL['gold'] if i%2 else PAL['cyan'])
    if role in ['roof-to-train','glass-to-rail']:
        d.polygon([(0,h//2),(w//2,0),(w//2,h)], fill=PAL['glass'] if role=='glass-to-rail' else PAL['steel'])

def save_ground_asset(name, role, animated, frames):
    fw, fh = 128, 72
    sheet=blank(fw*frames,fh)
    for i in range(frames):
        fr=blank(fw,fh); d=ImageDraw.Draw(fr); draw_ground(role,name,d,i,fw,fh); sheet.alpha_composite(fr,(i*fw,0))
    GROUND_DIR.mkdir(parents=True, exist_ok=True); path=GROUND_DIR/f'{name}.png'; sheet.save(path,optimize=True)
    return {'key':f'level3-ground/{name}','role':role,'src':f'./assets/generated/hmh-level-three-ground/final-getaway/{name}.png','width':fw,'height':fh,'animated':animated,'frames':frames,'frameMs':90,'frameWidth':fw,'frameHeight':fh,'sheetWidth':sheet.width,'sheetHeight':sheet.height,'preferred':name.endswith('prime') or name.endswith('blue') or name.endswith('flow'),'sourcePolicy':'Original repo-owned Level 3 final getaway isometric ground texture; no downloaded pixels copied.'}

def write_manifests(world_assets, ground_assets):
    world_manifest={'id':'hmh-level-three-final-getaway-v1','sourcePolicy':'Original repo-owned Level 3 getaway animated setpieces; no downloaded pixels copied.','assetCount':len(world_assets),'assets':world_assets}
    (WORLD_DIR/'level3-final-getaway-manifest.json').write_text(json.dumps(world_manifest,indent=2),encoding='utf-8')
    (WORLD_DIR/'level3-final-getaway-manifest.mjs').write_text('// Generated by scripts/generate-hmh-level3-getaway-art.py\nexport const HMH_LEVEL_THREE_FINAL_GETAWAY_ASSETS = Object.freeze('+json.dumps(world_manifest,indent=2)+');\n\nconst LEVEL_THREE_FINAL_GETAWAY_BY_KEY = new Map(HMH_LEVEL_THREE_FINAL_GETAWAY_ASSETS.assets.map((asset) => [asset.key, Object.freeze(asset)]));\nexport function levelThreeFinalGetawayAssetByKey(key) { return LEVEL_THREE_FINAL_GETAWAY_BY_KEY.get(key) ?? null; }\n',encoding='utf-8')
    roles={}
    for a in ground_assets: roles.setdefault(a['role'],[]).append(a['key'])
    ground_manifest={'id':'hmh-level-three-final-getaway-ground-v1','sourcePolicy':'Original repo-owned Level 3 final getaway ground textures; no downloaded pixels copied.','tileWidth':128,'tileHeight':72,'assetCount':len(ground_assets),'roles':roles,'assets':ground_assets}
    (GROUND_DIR/'level3-final-getaway-ground-manifest.json').write_text(json.dumps(ground_manifest,indent=2),encoding='utf-8')
    (GROUND_DIR/'level3-final-getaway-ground-manifest.mjs').write_text('// Generated by scripts/generate-hmh-level3-getaway-art.py\nexport const HMH_LEVEL_THREE_FINAL_GROUND = Object.freeze('+json.dumps(ground_manifest,indent=2)+');\n\nconst LEVEL_THREE_FINAL_GROUND_BY_KEY = new Map(HMH_LEVEL_THREE_FINAL_GROUND.assets.map((asset) => [asset.key, Object.freeze(asset)]));\nexport function levelThreeFinalGroundAssetByKey(key) { return LEVEL_THREE_FINAL_GROUND_BY_KEY.get(key) ?? null; }\n',encoding='utf-8')

def contact_sheet(assets, base, path, title, cols=5):
    DOC_ASSETS.mkdir(parents=True,exist_ok=True); cellw, cellh = 192, 126; rows=math.ceil(len(assets)/cols)
    out=Image.new('RGB',(cols*cellw,rows*cellh+36),(17,19,28)); d=ImageDraw.Draw(out); d.text((12,12),title,fill=(235,242,255))
    for idx,a in enumerate(assets):
        im=Image.open(base/a['src'].split('/')[-1]).convert('RGBA'); fw=a.get('frameWidth',a.get('width',128)); fh=a.get('frameHeight',a.get('height',72)); frame=im.crop((0,0,fw,fh)); bg=Image.new('RGBA',(fw,fh),(34,38,51,255)); bg.alpha_composite(frame); thumb=bg.convert('RGB'); thumb.thumbnail((152,78),Image.Resampling.NEAREST)
        x=(idx%cols)*cellw; y=(idx//cols)*cellh+36; d.rectangle((x+5,y+5,x+cellw-5,y+cellh-5),fill=(38,43,56),outline=(82,91,116)); out.paste(thumb,(x+(cellw-thumb.width)//2,y+8)); d.text((x+10,y+90),a['key'][-34:],fill=(138,226,255)); d.text((x+10,y+108),a.get('role',''),fill=(222,230,205))
    out.save(path,quality=95)

def docs(world_assets, ground_assets):
    DOCS.mkdir(parents=True,exist_ok=True)
    (DOCS/'hard-money-heroes-level3-final-getaway-art-pack.md').write_text('# Hard Money Heroes Level 3 final getaway art pack\n\n_Last updated: 2026-06-25_\n\nAdds original repo-owned Level 3 / Mainnet Express setpiece animations and final getaway ground textures for penthouse launch, skybridge break, train-roof finale, and extraction car route reads.\n',encoding='utf-8')
    contact_sheet(world_assets, WORLD_DIR, DOC_ASSETS/'hmh-level3-final-getaway-contact-sheet.png','HMH Level 3 final getaway setpieces')
    contact_sheet(ground_assets, GROUND_DIR, DOC_ASSETS/'hmh-level3-final-ground-contact-sheet.png','HMH Level 3 final getaway ground')

def main():
    world_assets=[save_world_asset(*args) for args in WORLD_DEFS]
    ground_assets=[save_ground_asset(*args) for args in GROUND_DEFS]
    write_manifests(world_assets, ground_assets); docs(world_assets, ground_assets)
    print(json.dumps({'worldAssets':len(world_assets),'groundAssets':len(ground_assets)},indent=2))
if __name__=='__main__': main()
