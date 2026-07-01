#!/usr/bin/env python
"""Generate original final POI setpiece assets for HMH Level 1 arenas."""
from __future__ import annotations
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'apps/portal/assets/generated/hmh-coherent-world/level-final-setpiece'
MANIFEST_DIR=ROOT/'apps/portal/assets/generated/hmh-final-setpiece-kit'
DOCS=ROOT/'docs/game-design'
DOC_ASSETS=DOCS/'assets'
ASSETS=[]
P={'outline':(28,24,25,255),'shadow':(8,9,12,85),'rock':(101,91,82,255),'rock2':(154,137,112,255),'wood':(112,64,34,255),'wood2':(180,103,47,255),'fire':(255,173,54,255),'fire2':(255,70,48,255),'pine':(32,101,56,255),'pine2':(76,160,78,255),'water':(41,157,197,155),'reed':(164,129,67,255),'gold':(240,191,75,255),'red':(184,54,44,255),'cyan':(81,232,240,255)}

def save(name, category, role, size, draw_fn, notes):
    ART.mkdir(parents=True, exist_ok=True); MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    img=Image.new('RGBA',size,(0,0,0,0)); d=ImageDraw.Draw(img); draw_fn(d, size)
    path=ART/f'{name}.png'; img.save(path,optimize=True)
    ASSETS.append({'key':f'level-final-setpiece/{name}','category':category,'role':role,'src':f'./assets/generated/hmh-coherent-world/level-final-setpiece/{name}.png','width':size[0],'height':size[1],'animated':False,'sourcePolicy':'Original repo-owned final POI setpiece art; no downloaded pixels copied.','notes':notes})

def shadow(d,cx,cy,rx,ry): d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry), fill=P['shadow'])
def poly(d,pts,fill): d.polygon(pts, fill=fill, outline=P['outline'])

def cave_rocks(d,s):
    shadow(d,64,92,50,9)
    for pts,c in [([(16,84),(36,40),(62,34),(82,86)],P['rock']), ([(50,88),(76,30),(112,44),(122,89)],P['rock2']), ([(22,89),(54,58),(92,64),(108,94)],(75,69,67,255))]: poly(d,pts,c)
    d.arc((39,44,99,118),180,360,fill=(18,17,20,255),width=18); d.arc((48,52,90,106),180,360,fill=(0,0,0,200),width=15)
def torch(d,s):
    shadow(d,50,70,32,5)
    for x in [28,52,76]:
        d.line((x,66,x,30),fill=P['outline'],width=5); d.line((x,66,x,30),fill=P['wood'],width=3)
        d.polygon([(x,18),(x+8,31),(x,39),(x-8,31)],fill=P['fire'],outline=P['outline']); d.polygon([(x,23),(x+4,31),(x,36),(x-4,31)],fill=P['fire2'])
def pine_wall(d,s):
    shadow(d,72,110,54,9)
    for i,x in enumerate([24,45,66,88,110]):
        h=54+(i%2)*18; base=105-(i%2)*4
        d.rectangle((x-4,base-h//2,x+4,base),fill=P['wood'],outline=P['outline'])
        for l in range(3): poly(d,[(x,base-h+l*18),(x-20+l*3,base-h+25+l*14),(x+20-l*3,base-h+25+l*14)], P['pine2'] if l==0 else P['pine'])
def reeds(d,s):
    shadow(d,64,62,46,5); d.ellipse((12,48,120,66),fill=P['water'])
    for i in range(32):
        x=15+(i*11)%102; y=58-(i%4); h=18+(i*7)%29; bend=(-3+(i%7))
        d.line((x,y,x+bend,y-h),fill=P['reed'],width=2)
def driftwood(d,s):
    shadow(d,68,60,48,6); d.ellipse((8,42,124,63),fill=(211,169,93,110))
    d.line((22,43,104,34),fill=P['outline'],width=11); d.line((22,43,104,34),fill=P['wood2'],width=8)
    d.line((58,38,44,21),fill=P['outline'],width=7); d.line((58,38,44,21),fill=P['wood'],width=4)
def ripple(d,s):
    shadow(d,68,52,50,4)
    for i in range(5): d.arc((8+i*8,30+i%2*5,126-i*5,66+i%2*2), 190, 350, fill=(96,230,255,160), width=2)
    for x in [25,55,84]: d.ellipse((x,39,x+8,45),fill=(255,255,255,75))
def wagon(d,s):
    shadow(d,74,89,50,8)
    d.polygon([(30,52),(84,40),(118,61),(61,76)],fill=P['wood2'],outline=P['outline'])
    d.polygon([(30,52),(61,76),(61,96),(30,72)],fill=P['wood'],outline=P['outline'])
    d.polygon([(118,61),(61,76),(61,96),(118,79)],fill=(147,78,39,255),outline=P['outline'])
    for x,y in [(42,80),(100,80)]: d.ellipse((x-10,y-10,x+10,y+10),fill=(38,32,28,255),outline=P['outline']); d.ellipse((x-4,y-4,x+4,y+4),fill=P['gold'])
def signpost(d,s):
    shadow(d,48,77,26,4); d.rectangle((44,21,51,80),fill=P['wood'],outline=P['outline'])
    for y,txt,flip in [(23,'CAVE',1),(39,'BANK',-1),(55,'FARM',1)]:
        pts=[(22 if flip>0 else 48,y),(78 if flip>0 else 18,y+3),(70 if flip>0 else 26,y+16),(22 if flip>0 else 48,y+14)]
        poly(d,pts,P['gold']); d.text((30 if flip>0 else 30,y+3),txt,fill=(44,27,16,255))
def lanterns(d,s):
    shadow(d,80,55,54,4); d.line((16,22,144,31),fill=P['wood'],width=3)
    for i,x in enumerate([30,54,80,106,132]):
        y=23+i%2*4; d.line((x,y,x,y+16),fill=P['outline'],width=1); d.rectangle((x-5,y+15,x+5,y+29),fill=P['fire'],outline=P['outline'])
def cliff(d,s):
    shadow(d,70,104,54,8); poly(d,[(22,50),(80,22),(126,48),(70,76)],P['rock2']); poly(d,[(22,50),(70,76),(70,108),(22,80)],P['rock']); poly(d,[(126,48),(70,76),(70,108),(126,78)],(86,76,73,255)); d.line((41,70,105,45),fill=(226,202,135,255),width=3)
def glint(d,s):
    shadow(d,46,86,24,4); d.rectangle((43,25,50,88),fill=P['wood'],outline=P['outline']); d.polygon([(50,30),(80,36),(50,47)],fill=P['red'],outline=P['outline']); d.line((86,16,86,49),fill=P['cyan'],width=2); d.line((72,32,100,32),fill=P['cyan'],width=2)
def guardrail(d,s):
    shadow(d,72,65,56,4)
    for x in [24,56,90,120]: d.rectangle((x,35,x+6,65),fill=P['wood'],outline=P['outline'])
    d.line((16,38,127,30),fill=P['outline'],width=7); d.line((16,38,127,30),fill=P['wood2'],width=4); d.line((64,50,104,47),fill=P['outline'],width=7); d.line((64,50,104,47),fill=P['wood2'],width=4)
def false_front(d,s):
    shadow(d,78,113,56,10); d.rectangle((30,38,126,111),fill=(122,70,42,255),outline=P['outline']); d.polygon([(24,38),(78,17),(132,38)],fill=P['red'],outline=P['outline']); d.rectangle((48,70,68,111),fill=(58,37,30,255),outline=P['outline']); d.rectangle((89,65,113,85),fill=(55,94,117,255),outline=P['outline']); d.text((45,43),'NO RUGS',fill=P['gold'])
def wagon_ring(d,s):
    wagon(d,s); d.arc((26,26,130,112),205,330,fill=P['gold'],width=3); d.arc((18,20,136,116),25,150,fill=(255,255,255,120),width=2)
def vault(d,s):
    shadow(d,78,100,48,8); d.rectangle((36,34,120,103),fill=(65,70,82,255),outline=P['outline']); d.rectangle((43,22,113,43),fill=P['gold'],outline=P['outline']); d.text((55,25),'VAULT',fill=(43,32,16,255)); d.ellipse((60,48,100,88),fill=(92,100,115,255),outline=P['outline']); d.ellipse((73,61,87,75),fill=P['gold'],outline=P['outline'])

def cohesive_barrel(d,s):
    shadow(d,58,85,38,7); d.ellipse((26,28,90,46),fill=P['wood2'],outline=P['outline']); d.rectangle((26,37,90,84),fill=P['wood'],outline=P['outline']); d.ellipse((26,73,90,94),fill=(88,45,28,255),outline=P['outline']);
    for x in [36,58,80]: d.line((x,39,x,82),fill=(58,32,24,255),width=2)
    d.arc((34,47,82,77),200,340,fill=P['gold'],width=3); d.text((45,52),'LTC',fill=P['gold'])
def cohesive_ghost_sign(d,s):
    shadow(d,54,82,34,5); d.rectangle((50,28,58,88),fill=P['wood'],outline=P['outline']); d.polygon([(20,34),(88,26),(98,50),(30,58)],fill=(139,74,41,255),outline=P['outline']); d.text((31,36),'RUGS?',fill=P['gold']); d.line((21,61,91,55),fill=(92,50,34,255),width=4)
def cohesive_mushroom_ring(d,s):
    shadow(d,72,76,54,8); d.ellipse((20,42,124,88),outline=(255,122,48,190),width=4); 
    for i,x in enumerate([32,48,64,82,100,115]):
        y=66+(i%2)*8; d.ellipse((x-8,y-12,x+8,y),fill=(255,112,43,255),outline=P['outline']); d.rectangle((x-2,y-1,x+2,y+10),fill=(214,178,116,255),outline=P['outline'])
    d.ellipse((55,54,88,73),fill=(255,180,67,70))
def cohesive_ford_planks(d,s):
    shadow(d,70,62,52,5); d.ellipse((10,38,130,70),fill=P['water']);
    for i,x in enumerate([25,43,61,79,97]):
        d.polygon([(x,33+i%2*2),(x+20,39+i%2*2),(x+15,51+i%2*2),(x-6,46+i%2*2)],fill=P['wood2'],outline=P['outline'])
    for x in [20,54,88]: d.arc((x,44,x+42,68),200,345,fill=(127,240,255,135),width=2)
def cohesive_cache(d,s):
    shadow(d,66,78,44,7); d.polygon([(25,42),(76,30),(113,48),(62,63)],fill=(193,120,55,255),outline=P['outline']); d.polygon([(25,42),(62,63),(62,91),(25,68)],fill=(117,69,38,255),outline=P['outline']); d.polygon([(113,48),(62,63),(62,91),(113,72)],fill=(151,84,42,255),outline=P['outline']); d.rectangle((51,48,77,63),fill=P['gold'],outline=P['outline']); d.text((55,50),'Ł',fill=(40,28,16,255))
def cohesive_gas_pump(d,s):
    shadow(d,58,91,34,6); d.rectangle((34,24,82,89),fill=(174,50,46,255),outline=P['outline']); d.rectangle((43,34,72,52),fill=(60,117,130,255),outline=P['outline']); d.text((45,57),'GAS',fill=P['gold']); d.line((82,48,104,60),fill=P['outline'],width=5); d.line((82,48,104,60),fill=(30,30,34,255),width=3); d.polygon([(105,52),(116,64),(103,70)],fill=P['fire'],outline=P['outline']); d.line((28,18,20,8),fill=P['cyan'],width=2); d.line((25,16,13,18),fill=P['cyan'],width=2)
def cohesive_crates(d,s):
    shadow(d,76,88,52,7)
    for ox,oy,c in [(20,48,P['wood']),(62,38,P['wood2']),(78,62,(128,72,38,255))]:
        d.rectangle((ox,oy,ox+42,oy+34),fill=c,outline=P['outline']); d.line((ox+4,oy+4,ox+38,oy+30),fill=(70,42,29,255),width=3); d.line((ox+38,oy+4,ox+4,oy+30),fill=(70,42,29,255),width=3)
def cohesive_boss_gate(d,s):
    shadow(d,85,120,66,9); d.rectangle((26,46,44,118),fill=(72,47,40,255),outline=P['outline']); d.rectangle((126,46,144,118),fill=(72,47,40,255),outline=P['outline']); d.polygon([(25,40),(85,16),(145,40),(139,55),(85,32),(31,55)],fill=(121,57,44,255),outline=P['outline']); d.text((61,37),'RUGPULL',fill=P['gold']);
    for x in [54,75,96,117]: d.rectangle((x,55,x+10,116),fill=(96,62,46,255),outline=P['outline'])
def cohesive_warning(d,s):
    shadow(d,54,85,34,5); d.rectangle((50,30,58,88),fill=P['wood'],outline=P['outline']); d.polygon([(24,30),(92,30),(102,56),(16,56)],fill=(191,58,45,255),outline=P['outline']); d.text((30,36),'NO EXIT',fill=P['gold']); d.polygon([(54,62),(70,78),(38,78)],fill=P['gold'],outline=P['outline'])
def cohesive_extraction(d,s):
    shadow(d,84,74,62,6); d.polygon([(18,56),(84,34),(150,56),(84,78)],fill=(55,58,62,255),outline=P['outline']); d.polygon([(38,56),(84,43),(130,56),(84,69)],outline=P['cyan'],fill=(64,93,100,180)); d.text((68,52),'EXIT',fill=P['gold']);
    for x in [32,136]: d.polygon([(x,43),(x+7,57),(x,70),(x-7,57)],fill=P['fire'],outline=P['outline']); d.ellipse((x-14,52,x+14,66),fill=(81,232,240,80))

def main():
    save('cave-mouth-rocks','dry-forest-cave','wall',(136,104),cave_rocks,'Cave-mouth rock funnel and dark entrance.')
    save('torch-pockets','dry-forest-cave','lamp',(104,82),torch,'Torch pocket telegraphs cave ambush light.')
    save('pine-wall-shadow','dry-forest-cave','tree',(144,122),pine_wall,'Dense pine shadow boundary.')
    save('reed-bank-ring','oasis-lakeside','water-strip',(132,76),reeds,'Oasis reed-bank ring soft boundary.')
    save('driftwood-sandbar','oasis-lakeside','smallprop',(136,72),driftwood,'Driftwood sandbar lane split.')
    save('shoreline-ripple-line','oasis-lakeside','water-strip',(136,72),ripple,'Shoreline ripple slow-water telegraph.')
    save('wagon-circle','crossroads-trading-post','crate',(144,104),wagon,'Crossroads wagon circle cover.')
    save('signpost-fork','crossroads-trading-post','sign',(96,88),signpost,'Multi-direction fork signpost.')
    save('lantern-string','crossroads-trading-post','lamp',(160,72),lanterns,'Lantern string sightline guide.')
    save('cliff-switchback','mesa-overlook','wall',(144,120),cliff,'Mesa switchback elevation cue.')
    save('ridge-glint-post','mesa-overlook','sign',(112,96),glint,'Ridge glint warning post.')
    save('broken-guardrail','mesa-overlook','fence',(144,76),guardrail,'Broken guardrail partial cover.')
    save('false-front-barricade','rugpull-gulch','wall',(156,124),false_front,'False-front barricade for Rugpull Gulch.')
    save('wagon-ring','rugpull-gulch','crate',(144,112),wagon_ring,'Wagon ring arena core.')
    save('vault-signage','rugpull-gulch','sign',(156,112),vault,'Vault signage sniper-lane read.')
    save('cohesive-saloon-cover-barrel','cohesive-level1','crate',(116,104),cohesive_barrel,'Cohesive palette replacement interactive destructible saloon cover barrel.')
    save('cohesive-ghost-road-sign','cohesive-level1','sign',(116,98),cohesive_ghost_sign,'Cohesive palette replacement ghost-town route sign.')
    save('cohesive-mushroom-spore-ring','cohesive-level1','hazard',(144,104),cohesive_mushroom_ring,'Cohesive palette interactive mushroom hazard replacement.')
    save('cohesive-shoreline-ford-planks','cohesive-level1','bridge',(144,86),cohesive_ford_planks,'Cohesive palette shoreline ford bridge/readability replacement.')
    save('cohesive-desert-cache-crate','cohesive-level1','crate',(136,104),cohesive_cache,'Cohesive palette interactive Litecoin reward-cache replacement.')
    save('cohesive-gas-pump-explosive','cohesive-level1','barrel',(124,108),cohesive_gas_pump,'Cohesive palette interactive explosive gas-pump replacement.')
    save('cohesive-warehouse-crate-stack','cohesive-level1','crate',(148,112),cohesive_crates,'Cohesive palette destructible warehouse crate replacement.')
    save('cohesive-boss-yard-gate','cohesive-level1','gate',(170,132),cohesive_boss_gate,'Cohesive palette boss-yard gate replacement and final lock read.')
    save('cohesive-rugpull-warning-sign','cohesive-level1','sign',(116,98),cohesive_warning,'Cohesive palette Rugpull warning sign replacement.')
    save('cohesive-extraction-flare-road','cohesive-level1','sign',(168,92),cohesive_extraction,'Cohesive palette extraction flare road cue replacement.')
    manifest={'id':'hmh-final-setpiece-kit-v1','sourcePolicy':'Original repo-owned final POI setpiece art for HMH Level 1; no downloaded pixels copied.','assetCount':len(ASSETS),'assets':ASSETS}
    (MANIFEST_DIR/'hmh-final-setpiece-kit-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    mjs='// Generated by scripts/generate-hmh-final-setpiece-kit.py\nexport const HMH_FINAL_SETPIECE_KIT = Object.freeze('+json.dumps(manifest,indent=2)+');\n\nconst FINAL_SETPIECE_BY_KEY = new Map(HMH_FINAL_SETPIECE_KIT.assets.map((asset) => [asset.key, Object.freeze(asset)]));\nexport function finalSetpieceAssetByKey(key) { return FINAL_SETPIECE_BY_KEY.get(key) ?? null; }\n'
    (MANIFEST_DIR/'hmh-final-setpiece-kit-manifest.mjs').write_text(mjs,encoding='utf-8')
    DOC_ASSETS.mkdir(parents=True,exist_ok=True); cols,cellw,cellh=5,192,140; rows=math.ceil(len(ASSETS)/cols); sheet=Image.new('RGB',(cols*cellw,rows*cellh+42),(22,24,31)); d=ImageDraw.Draw(sheet); d.text((12,12),'HMH final Level 1 POI setpiece kit',fill=(240,244,255))
    for i,a in enumerate(ASSETS):
        im=Image.open(ART/(a['key'].split('/')[1]+'.png')).convert('RGBA'); bg=Image.new('RGBA',im.size,(36,39,48,255)); bg.alpha_composite(im); thumb=bg.convert('RGB'); thumb.thumbnail((150,90),Image.Resampling.NEAREST); x=(i%cols)*cellw; y=(i//cols)*cellh+42; d.rectangle((x+5,y+5,x+cellw-5,y+cellh-5),fill=(38,42,52),outline=(74,85,105)); sheet.paste(thumb,(x+(cellw-thumb.width)//2,y+10)); d.text((x+10,y+104),a['key'].split('/')[1][:28],fill=(170,225,255)); d.text((x+10,y+122),a['category'],fill=(218,230,210))
    sheet.save(DOC_ASSETS/'hmh-final-setpiece-kit-contact-sheet.png',quality=95)
    (DOCS/'hard-money-heroes-final-setpiece-kit.md').write_text('# Hard Money Heroes final Level 1 setpiece kit\n\n_Last updated: 2026-06-25_\n\nAdds original repo-owned pixel-art setpiece assets for authored POI arenas: Dry Forest Cave, Oasis Lakeside, Crossroads Trading Post, Mesa Overlook, and Rugpull Gulch. Runtime scene objects now reference these `level-final-setpiece/*` assets instead of generic placeholder props.\n',encoding='utf-8')
    print(json.dumps({'assetCount':len(ASSETS),'artDir':str(ART)},indent=2))
if __name__=='__main__': main()
