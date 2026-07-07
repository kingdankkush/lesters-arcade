#!/usr/bin/env python3
"""Generate original WO-104/105/106 Level 1 world-kit pixel props.

These are transparent, repo-owned runtime sprites for authored level-design reads:
vegetation/cliffs/canopy/fireflies, building/road/container arena markers,
and vehicle/micro-scene life props. They are intentionally compact 128px sprites
so they can be used in the exact-key prefab-stamp runtime path without bloating
bundles.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/portal/assets/generated/hmh-wo104-106-world-kit"
DOC = ROOT / "docs/game-design/assets/hmh-wo104-106-world-kit-contact-sheet.png"

ASSETS = [
    {"key":"wo104-world/forest-canopy-sway","file":"forest-canopy-sway.png","role":"canopy-occluder","routeBeat":"forest","label":"Forest canopy sway", "description":"Layered pine/oak canopy cluster for authored forest loops; role includes occluder so renderer applies subtle sway."},
    {"key":"wo104-world/mossy-cliff-wall","file":"mossy-cliff-wall.png","role":"wall","routeBeat":"forest","label":"Mossy cliff wall", "description":"Dark green rock wall used to bound forest/cave reads."},
    {"key":"wo104-world/reed-bank-fireflies","file":"reed-bank-fireflies.png","role":"ambient-hazard","routeBeat":"lakeside","label":"Reed bank fireflies", "description":"Reed bank plus cyan/gold fireflies for lakeside ambience; bobbing role keeps it alive."},
    {"key":"wo104-world/park-tree-bench-cluster","file":"park-tree-bench-cluster.png","role":"landmark","routeBeat":"park","label":"Park tree bench cluster", "description":"Small park/lawn identity cluster for residential/farm edge."},
    {"key":"wo105-world/bank-plaza-kiosk","file":"bank-plaza-kiosk.png","role":"landmark","routeBeat":"arena","label":"Bank plaza kiosk", "description":"Gold/blue ATM kiosk and low plinth for bank-plaza arena read."},
    {"key":"wo105-world/town-bank-frontage","file":"town-bank-frontage.png","role":"landmark","routeBeat":"arena","label":"Town bank frontage", "description":"False-front bank/town building row that replaces generic small building placeholders in the ghost-town arena."},
    {"key":"wo105-world/forest-log-arena-ring","file":"forest-log-arena-ring.png","role":"wall","routeBeat":"forest","label":"Forest log arena ring", "description":"Curved fallen-log and stone cover ring for the forest arena read."},
    {"key":"wo105-world/second-town-building-row","file":"second-town-building-row.png","role":"landmark","routeBeat":"road","label":"Second town building row", "description":"Compact second-town facade row for the road-to-extraction transition."},
    {"key":"wo105-world/extraction-yard-warehouse","file":"extraction-yard-warehouse.png","role":"landmark","routeBeat":"boss","label":"Extraction yard warehouse", "description":"Industrial warehouse silhouette for the container/extraction arena; de-references old level-1 building art."},
    {"key":"wo105-world/container-cover-line","file":"container-cover-line.png","role":"wall","routeBeat":"arena","label":"Container cover line", "description":"Stacked red/teal cargo containers for extraction yard cover."},
    {"key":"wo105-world/cracked-road-barricade","file":"cracked-road-barricade.png","role":"road","routeBeat":"road","label":"Cracked road barricade", "description":"Broken asphalt apron with cones and barrier for sensible road transitions."},
    {"key":"wo105-world/cracked-road-junction","file":"cracked-road-junction.png","role":"road","routeBeat":"road","label":"Cracked road junction", "description":"T-junction asphalt plate with lane paint for sensible road branching into arenas."},
    {"key":"wo106-world/abandoned-pickup","file":"abandoned-pickup.png","role":"vehicle","routeBeat":"micro-scene","label":"Abandoned pickup", "description":"Rusty pickup truck with LTC tarp; vehicle identity without gameplay collision clutter."},
    {"key":"wo106-world/delivery-van-cache","file":"delivery-van-cache.png","role":"vehicle","routeBeat":"micro-scene","label":"Delivery van cache", "description":"Small delivery van and loot crate micro-scene for roadside life."},
    {"key":"wo106-world/critter-dust-burrow","file":"critter-dust-burrow.png","role":"ambient-hazard","routeBeat":"critter","label":"Critter dust burrow", "description":"Tiny burrow, paw marks, and dust puffs telegraph fleeing critters without actor AI yet."},
]


def px(draw, rect, fill):
    draw.rectangle(rect, fill=fill)


def diamond(draw, cx, cy, w, h, fill, outline=None):
    pts=[(cx,cy-h//2),(cx+w//2,cy),(cx,cy+h//2),(cx-w//2,cy)]
    draw.polygon(pts, fill=fill, outline=outline)


def add_shadow(img, bbox=(20,84,108,118), alpha=72):
    shadow=Image.new('RGBA', img.size, (0,0,0,0)); d=ImageDraw.Draw(shadow); d.ellipse(bbox, fill=(0,0,0,alpha)); shadow=shadow.filter(ImageFilter.GaussianBlur(4)); img.alpha_composite(shadow)


def draw_asset(spec):
    img=Image.new('RGBA',(128,128),(0,0,0,0)); d=ImageDraw.Draw(img)
    key=spec['key']
    add_shadow(img)
    if 'forest-canopy' in key:
        for x,y,c in [(35,54,(20,70,48,255)),(54,45,(31,97,58,255)),(74,54,(22,82,55,255)),(64,36,(42,118,72,255)),(48,68,(14,55,42,255)),(85,68,(17,64,48,255))]:
            d.ellipse((x-24,y-16,x+24,y+18), fill=c, outline=(7,32,28,255), width=2)
        for x in [48,65,81]: px(d,(x,62,x+6,98),(76,49,34,255))
        diamond(d,64,104,90,22,(25,62,41,180))
    elif 'mossy-cliff' in key:
        d.polygon([(22,40),(96,30),(112,80),(88,104),(36,100),(14,70)], fill=(56,60,63,255), outline=(20,25,31,255))
        for poly,c in [([(28,45),(55,38),(48,65),(24,66)],(78,82,82,255)), ([(60,38),(93,34),(102,67),(68,62)],(43,48,52,255)), ([(38,72),(72,67),(82,96),(34,94)],(66,69,64,255))]: d.polygon(poly, fill=c)
        for x,y in [(35,48),(72,42),(91,70),(48,82),(78,88)]: d.ellipse((x,y,x+16,y+8), fill=(41,122,62,255))
    elif 'reed-bank-fireflies' in key:
        diamond(d,64,92,94,30,(37,82,59,220),(12,38,32,255))
        for x in range(24,106,10): d.line((x,92,x+3,55+(x%4)*4), fill=(47,111,73,255), width=3)
        for x,y,c in [(38,43,(83,255,214,255)),(54,32,(255,218,75,255)),(82,39,(83,255,214,255)),(96,52,(255,218,75,255)),(67,49,(170,255,126,255))]:
            d.ellipse((x-2,y-2,x+2,y+2), fill=c); d.ellipse((x-5,y-5,x+5,y+5), outline=(*c[:3],90))
    elif 'park-tree-bench' in key:
        d.ellipse((26,24,78,72), fill=(42,119,61,255), outline=(13,50,32,255), width=2); px(d,(49,62,57,96),(91,58,35,255))
        px(d,(64,76,104,84),(116,67,43,255)); px(d,(64,86,104,92),(86,48,36,255)); px(d,(70,92,75,106),(45,35,34,255)); px(d,(94,92,99,106),(45,35,34,255))
        diamond(d,66,108,92,18,(42,105,58,180))
    elif 'bank-plaza' in key:
        diamond(d,64,90,96,42,(57,67,82,255),(20,27,38,255)); diamond(d,64,88,72,28,(74,88,109,255))
        px(d,(46,40,82,86),(24,54,72,255)); px(d,(50,44,78,56),(246,201,66,255)); px(d,(54,60,74,72),(37,219,205,255)); px(d,(42,82,86,90),(13,20,28,255))
        d.text((55,45),'LTC',fill=(21,27,39,255))
    elif 'town-bank-frontage' in key:
        diamond(d,64,96,108,28,(46,43,39,210),(18,20,24,255))
        px(d,(22,52,106,88),(92,62,50,255)); px(d,(26,42,102,54),(43,66,84,255)); px(d,(31,34,97,44),(225,178,62,255))
        for x in [32,54,76]:
            px(d,(x,58,x+14,76),(51,178,192,255)); px(d,(x+2,60,x+12,74),(18,44,58,255))
        px(d,(58,66,72,88),(41,33,31,255)); d.text((51,35),'BANK',fill=(19,24,31,255))
        for x in [24,48,72,96]: d.line((x,52,x,88), fill=(45,35,32,255), width=2)
    elif 'forest-log-arena' in key:
        diamond(d,64,96,110,30,(31,74,45,180),(11,30,22,255))
        for x1,y1,x2,y2 in [(24,72,64,84),(64,84,104,72),(34,98,68,108),(68,108,100,96)]:
            d.line((x1,y1,x2,y2), fill=(92,55,35,255), width=9); d.line((x1,y1,x2,y2), fill=(142,87,47,255), width=4)
        for x,y in [(27,69),(101,69),(35,95),(96,93)]: d.ellipse((x-8,y-6,x+8,y+6), fill=(53,58,50,255), outline=(19,24,22,255), width=2)
        for x,y in [(52,65),(76,66),(58,104)]: d.ellipse((x-4,y-3,x+4,y+3), fill=(255,198,73,180))
    elif 'second-town-building-row' in key:
        diamond(d,64,98,110,26,(38,43,51,190),(16,20,25,255))
        colors=[(77,91,104,255),(96,64,55,255),(64,84,68,255)]
        for i,x in enumerate([22,50,78]):
            px(d,(x,50,x+28,88),colors[i]); d.polygon([(x-2,50),(x+14,34),(x+30,50)], fill=(38,43,52,255), outline=(16,20,25,255))
            px(d,(x+6,60,x+16,72),(67,197,205,255)); px(d,(x+18,68,x+25,88),(33,28,29,255))
        d.line((18,89,110,89), fill=(222,164,48,255), width=3)
    elif 'extraction-yard-warehouse' in key:
        diamond(d,64,98,112,28,(35,39,48,210),(13,18,23,255))
        px(d,(24,48,104,90),(63,72,83,255)); d.polygon([(20,48),(64,30),(108,48)], fill=(30,37,48,255), outline=(12,17,24,255))
        for x in [34,52,70,88]: d.line((x,52,x,88), fill=(26,32,39,255), width=2)
        px(d,(44,62,84,88),(30,36,42,255)); px(d,(48,66,80,84),(106,122,134,255)); px(d,(28,54,42,66),(242,186,55,255))
        d.text((52,38),'YARD',fill=(235,191,65,255))
    elif 'container-cover' in key:
        diamond(d,64,95,100,28,(37,44,56,160))
        for x,y,c in [(28,50,(158,52,47,255)),(52,60,(33,124,139,255)),(76,48,(188,118,44,255))]:
            d.polygon([(x,y),(x+42,y+8),(x+38,y+32),(x-4,y+24)], fill=c, outline=(18,23,30,255))
            for k in range(4): d.line((x+5+k*8,y+4+k%2,x+1+k*8,y+24+k%2), fill=(13,25,35,160), width=2)
    elif 'cracked-road-barricade' in key:
        diamond(d,64,91,108,44,(51,55,61,255),(18,23,29,255));
        d.line((40,84,55,89,49,99,71,104,88,95), fill=(15,19,25,255), width=2)
        px(d,(33,72,82,78),(222,174,45,255)); px(d,(29,68,36,90),(240,112,45,255)); px(d,(88,82,95,104),(240,112,45,255))
    elif 'cracked-road-junction' in key:
        diamond(d,64,92,112,48,(49,53,60,255),(17,22,28,255))
        d.polygon([(48,56),(80,56),(72,92),(56,92)], fill=(57,61,68,255), outline=(20,24,30,255))
        px(d,(61,58,67,98),(226,181,48,255)); px(d,(36,83,92,89),(226,181,48,255))
        d.line((38,80,51,85,47,96,60,102,78,94,91,99), fill=(13,17,23,255), width=2)
        for x,y in [(31,78),(94,85),(74,62)]: px(d,(x,y,x+7,y+18),(238,111,43,255))
    elif 'abandoned-pickup' in key:
        diamond(d,63,100,96,22,(40,38,34,180)); px(d,(35,58,92,82),(128,71,45,255)); px(d,(52,44,78,60),(152,83,48,255)); px(d,(58,48,74,58),(83,184,194,255)); px(d,(82,62,100,78),(88,54,42,255))
        for x in [45,86]: d.ellipse((x-7,76,x+7,90), fill=(18,19,22,255)); d.ellipse((x-3,80,x+3,86), fill=(82,90,96,255))
        px(d,(30,66,37,74),(238,196,55,255))
    elif 'delivery-van' in key:
        diamond(d,63,100,94,20,(40,38,34,170)); px(d,(34,52,96,82),(45,108,134,255)); px(d,(42,56,60,68),(171,230,226,255)); px(d,(68,56,88,70),(241,204,70,255)); px(d,(96,72,108,88),(99,62,42,255))
        d.text((68,58),'LTC',fill=(18,34,44,255))
        for x in [47,84]: d.ellipse((x-7,76,x+7,90), fill=(17,19,22,255))
    elif 'critter-dust' in key:
        diamond(d,65,98,82,22,(91,69,47,200)); d.ellipse((50,72,78,92), fill=(45,34,26,255)); d.ellipse((55,76,74,88), fill=(18,13,10,255))
        for x,y in [(82,70),(91,64),(99,72),(37,75),(29,69)]: d.ellipse((x-5,y-3,x+5,y+3), fill=(167,137,90,160))
        for x,y in [(44,57),(50,53),(58,55),(74,58),(80,54)]: d.ellipse((x,y,x+3,y+2), fill=(50,35,22,180))
    return img


def contact_sheet(records):
    cols=5; cellw=180; cellh=168
    sheet=Image.new('RGBA',(cols*cellw, ((len(records)+cols-1)//cols)*cellh),(12,16,24,255)); d=ImageDraw.Draw(sheet)
    for i,rec in enumerate(records):
        x=(i%cols)*cellw; y=(i//cols)*cellh
        im=Image.open(OUT/rec['file']).convert('RGBA')
        sheet.alpha_composite(im,(x+26,y+8))
        d.text((x+8,y+138), rec['key'].split('/')[-1][:26], fill=(220,235,240,255))
        d.text((x+8,y+152), rec['role'][:26], fill=(105,229,211,255))
    return sheet


def main():
    OUT.mkdir(parents=True, exist_ok=True); DOC.parent.mkdir(parents=True, exist_ok=True)
    for rec in ASSETS:
        draw_asset(rec).save(OUT/rec['file'])
    records=[]
    for rec in ASSETS:
        records.append({**rec, "src": f"./assets/generated/hmh-wo104-106-world-kit/{rec['file']}", "width": 128, "height": 128, "source": "repo-generated-original-pillow-pixel-art"})
    manifest={"id":"hmh-wo104-106-world-kit-v1","policy":"Original repo-generated transparent pixel-art sprites for WO-104 nature, WO-105 arenas/roads/buildings, and WO-106 vehicles/micro-scenes.","assetCount":len(records),"assets":records}
    (OUT/'hmh-wo104-106-world-kit-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    body=json.dumps(manifest, indent=2)
    (OUT/'hmh-wo104-106-world-kit-manifest.mjs').write_text("// AUTO-GENERATED by scripts/generate-hmh-wo104-106-world-kit.py. Do not hand-edit.\n"+f"export const HMH_WO104_106_WORLD_KIT = Object.freeze({body});\n\nconst ASSETS_BY_KEY = new Map(HMH_WO104_106_WORLD_KIT.assets.map((asset) => [asset.key, Object.freeze(asset)]));\n\nexport function wo104106WorldKitAssetByKey(key) {{\n  return ASSETS_BY_KEY.get(key) ?? null;\n}}\n",encoding='utf-8')
    contact_sheet(ASSETS).save(DOC)
    print(json.dumps({"assetCount":len(ASSETS),"out":str(OUT),"contactSheet":str(DOC)},indent=2))

if __name__=='__main__':
    main()
