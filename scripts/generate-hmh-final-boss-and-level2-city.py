#!/usr/bin/env python
"""Generate original HMH final boss animation and Level 2 city world-art packs."""
from __future__ import annotations
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BOSS_DIR = ROOT / 'apps/portal/assets/generated/hmh-final-boss-animations'
CITY_DIR = ROOT / 'apps/portal/assets/generated/hmh-coherent-world/level2-final-city'
DOCS = ROOT / 'docs/game-design'
DOC_ASSETS = DOCS / 'assets'

BOSSES = [
    ('rug-pull-baron', 'Rug Pull Baron', (197, 61, 72, 255), (255, 181, 72, 255), 'cape'),
    ('claim-jumper-sheriff', 'Claim-Jumper Sheriff', (116, 74, 43, 255), (255, 218, 103, 255), 'hat'),
    ('cave-warren-alpha', 'Cave Warren Alpha', (91, 65, 48, 255), (216, 112, 67, 255), 'beast'),
    ('salvage-mercenary', 'Salvage Mercenary', (92, 104, 117, 255), (97, 226, 255, 255), 'rifle'),
    ('sandbar-apex', 'Sandbar Apex', (65, 117, 91, 255), (87, 226, 200, 255), 'beast'),
    ('ridge-raider', 'Ridge Raider', (89, 82, 112, 255), (255, 90, 126, 255), 'rifle'),
    ('bandit-captain', 'Bandit Captain', (141, 69, 45, 255), (255, 204, 83, 255), 'banner'),
    ('plaza-warden', 'Plaza Warden', (79, 94, 141, 255), (192, 215, 255, 255), 'shield'),
    ('bridge-exploiter', 'The Bridge Exploiter', (54, 105, 129, 255), (79, 228, 255, 255), 'chain'),
    ('the-whale', 'The Whale', (37, 50, 103, 255), (255, 78, 178, 255), 'bulk'),
    ('the-obfuscator', 'The Obfuscator', (71, 55, 93, 255), (116, 255, 173, 255), 'cloak'),
    ('fifty-one-percent', 'The 51% Boss', (114, 87, 40, 255), (255, 136, 43, 255), 'rig'),
    ('the-counterfeiter', 'The Counterfeiter', (110, 67, 105, 255), (255, 203, 111, 255), 'press'),
    ('park-warden', 'Park Warden', (61, 120, 80, 255), (191, 248, 111, 255), 'shield'),
    ('mr-ngmi', 'Mr. NGMI', (106, 46, 126, 255), (255, 70, 208, 255), 'phone'),
]
STATES = ['intro', 'idle', 'attack-tell', 'attack', 'hit', 'death']
DIRS = ['S','SE','E','NE','N','NW','W','SW']
BOSS_ASSETS=[]
CITY_ASSETS=[]
PAL = {
 'ink': (18,18,26,255), 'shadow': (0,0,0,70), 'white': (246,248,241,255), 'silver': (196,211,232,255),
 'blue': (69,146,255,255), 'cyan': (78,232,255,255), 'pink': (255,78,200,255), 'gold': (255,208,80,255),
 'orange': (255,132,54,255), 'green': (95,224,126,255), 'glass': (93,126,170,210), 'concrete': (99,105,119,255),
 'dark': (34,35,48,255), 'water': (45,142,188,210), 'neon': (255,63,206,255), 'ltc': (183,204,255,255),
}

def blank(w,h): return Image.new('RGBA',(w,h),(0,0,0,0))
def star(d,cx,cy,r,color): d.polygon([(cx,cy-r),(cx+r//3,cy-r//3),(cx+r,cy),(cx+r//3,cy+r//3),(cx,cy+r),(cx-r//3,cy+r//3),(cx-r,cy),(cx-r//3,cy-r//3)], fill=color)
def line(d, xy, color, width=1): d.line(xy, fill=color, width=width)
def rect(d,x,y,w,h,color): d.rectangle((x,y,x+w,y+h), fill=color)

def draw_boss_frame(d, boss, state, direction_index, frame_index, w, h):
    actor, name, base, accent, archetype = boss
    cx = w//2 + int((direction_index-3.5)*1.1)
    bob = int(math.sin((frame_index/4)*math.tau)*3)
    if state == 'intro': bob -= 4-frame_index
    if state == 'hit': cx += [-4,3,-2,2][frame_index%4]
    if state == 'death': bob += frame_index*5
    # shadow
    d.ellipse((cx-25,h-16,cx+25,h-6), fill=PAL['shadow'])
    scale = 1.0 + (0.12 if archetype in ['bulk','rig'] else 0) + (0.08 if state == 'attack' else 0)
    body_w, body_h = int(28*scale), int(40*scale)
    y = h-54 + bob
    # cloak/cape back shape
    if archetype in ['cape','cloak','banner']:
        d.polygon([(cx-body_w//2-10,y+6),(cx,y+body_h+12),(cx+body_w//2+10,y+6)], fill=(max(base[0]-25,0),max(base[1]-25,0),max(base[2]-25,0),255), outline=PAL['ink'])
    # legs
    for side in [-1,1]:
        legx = cx + side*8 + (frame_index%2)*side*2
        d.rectangle((legx-5,y+body_h-2,legx+5,y+body_h+18), fill=base, outline=PAL['ink'])
    # body/head
    d.rounded_rectangle((cx-body_w//2,y,cx+body_w//2,y+body_h), radius=8, fill=base, outline=PAL['ink'], width=2)
    d.ellipse((cx-15,y-24,cx+15,y+6), fill=base, outline=PAL['ink'], width=2)
    d.rectangle((cx-10,y-10,cx+10,y-6), fill=accent)
    # archetype props
    if archetype == 'hat':
        d.rectangle((cx-20,y-25,cx+20,y-20), fill=PAL['ink']); d.rectangle((cx-12,y-34,cx+12,y-22), fill=base)
    elif archetype == 'rifle':
        line(d,(cx+10,y+14,cx+42+(8 if state=='attack' else 0),y+8-frame_index),accent,4); rect(d,cx+35,y+5,8,4,PAL['ink'])
    elif archetype == 'beast':
        d.polygon([(cx-16,y-15),(cx-25,y-31),(cx-10,y-22)], fill=accent, outline=PAL['ink']); d.polygon([(cx+16,y-15),(cx+25,y-31),(cx+10,y-22)], fill=accent, outline=PAL['ink'])
        d.ellipse((cx-34,y+18,cx-22,y+29), fill=accent, outline=PAL['ink']); d.ellipse((cx+22,y+18,cx+34,y+29), fill=accent, outline=PAL['ink'])
    elif archetype == 'banner':
        line(d,(cx+22,y-20,cx+22,y+45),PAL['ink'],3); d.polygon([(cx+22,y-20),(cx+52,y-13),(cx+22,y+2)], fill=accent, outline=PAL['ink'])
    elif archetype == 'shield':
        d.rounded_rectangle((cx-38,y+5,cx-18,y+33), radius=5, fill=accent, outline=PAL['ink'], width=2)
    elif archetype == 'chain':
        for n in range(5): d.ellipse((cx+22+n*7,y+12+math.sin(frame_index+n)*5,cx+31+n*7,y+20+math.sin(frame_index+n)*5), outline=accent, width=2)
    elif archetype == 'bulk':
        d.ellipse((cx-36,y+8,cx+36,y+44), fill=base, outline=PAL['ink'], width=2); star(d,cx,y+7,6,accent)
    elif archetype == 'cloak':
        for n in range(5): line(d,(cx-30+n*15,y+body_h,cx-35+n*16,y+body_h+18),accent,2)
    elif archetype == 'rig':
        d.rectangle((cx-42,y+3,cx-25,y+38), fill=PAL['dark'], outline=PAL['ink']); d.rectangle((cx+25,y+3,cx+42,y+38), fill=PAL['dark'], outline=PAL['ink']); star(d,cx,y+8,5,accent)
    elif archetype == 'press':
        d.rectangle((cx-42,y+12,cx-27,y+42), fill=accent, outline=PAL['ink']); d.line((cx-35,y+12,cx-35,y-15), fill=PAL['ink'], width=3)
    elif archetype == 'phone':
        d.rectangle((cx+25,y-6,cx+39,y+18), fill=PAL['dark'], outline=accent); star(d,cx+32,y+3,3,accent)
    # state effects
    if state == 'attack-tell':
        d.arc((cx-42,y-36,cx+42,y+48), 210, 330, fill=accent, width=3)
        star(d,cx,y-35,5,accent)
    elif state == 'attack':
        for n in range(6):
            a = n/6*math.tau + frame_index*.6; line(d,(cx,y+10,cx+math.cos(a)*42,y+10+math.sin(a)*28),accent,3)
    elif state == 'hit':
        star(d,cx-22,y+5,5,PAL['white']); star(d,cx+23,y+18,4,PAL['orange'])
    elif state == 'death':
        for n in range(8): star(d,cx-25+n*7,y+5+(n%3)*10,3,[accent,PAL['orange'],PAL['white']][n%3])

def save_boss_sheet(boss, state):
    actor = boss[0]; fw, fh, frames = 96, 96, 4
    sheet = blank(fw*frames*len(DIRS), fh)
    for di,_ in enumerate(DIRS):
        for fi in range(frames):
            fr=blank(fw,fh); d=ImageDraw.Draw(fr); draw_boss_frame(d,boss,state,di,fi,fw,fh); sheet.alpha_composite(fr, ((di*frames+fi)*fw,0))
    out = BOSS_DIR/actor; out.mkdir(parents=True, exist_ok=True); path=out/f'{state}.png'; sheet.save(path,optimize=True)
    asset={'key':f'{actor}/{state}','actorId':actor,'displayName':boss[1],'state':state,'src':f'./assets/generated/hmh-final-boss-animations/{actor}/{state}.png','animated':True,'directions':8,'directionOrder':DIRS,'framesPerDirection':frames,'frameMs':90 if state not in ['hit','death'] else 75,'frameWidth':fw,'frameHeight':fh,'sheetWidth':sheet.width,'sheetHeight':sheet.height,'sourcePolicy':'Original repo-owned boss pixel-art spritesheet; no downloaded pixels copied.'}
    BOSS_ASSETS.append(asset)

# City asset drawing
CITY_DEFS = [
 ('ltc-monument-fountain','hub','landmark',136,104,8), ('ticker-billboard-loop','hub','sign',136,72,6), ('plaza-streetlight-line','hub','lamp',96,104,6),
 ('harbor-crane-swing','harbor','landmark',160,128,8), ('shipping-container-stack','harbor','cover',136,88,4), ('bridge-exploiter-gate','harbor','landmark',160,112,8), ('harbor-water-ripple','harbor','water-strip',160,56,8),
 ('chrome-tower-facade','financial','building',136,160,6), ('elevator-shaft-glow','financial','edge',112,160,8), ('server-rack-corridor','financial','cover',136,96,6),
 ('privacy-hedge-wall','grove','wall',136,96,8), ('privacy-lantern-fog','grove','decor',112,96,8), ('confidential-vault-greenhouse','grove','landmark',144,120,8),
 ('mining-rig-array','hashrate','landmark',160,104,8), ('cooling-vent-steam','hashrate','hazard',112,96,8), ('asic-led-wall','hashrate','cover',136,88,6),
 ('artisan-kiln-glow','artisan','hazard',112,104,8), ('gallery-mural-neon','artisan','decor',136,88,6), ('park-greenhouse-dome','park','landmark',144,120,8), ('silver-park-fountain','park','water-strip',136,96,8),
 ('rooftop-helipad-lights','penthouse','landmark',160,104,8), ('storm-billboard-ngmi','penthouse','sign',160,104,8), ('skybridge-glass-span','penthouse','bridge',160,80,6), ('glass-parapet-edge','penthouse','edge',136,72,6),
]

def draw_city(key,d,i,w,h):
    d.ellipse((10,h-14,w-10,h-5), fill=PAL['shadow'])
    if 'monument' in key:
        d.ellipse((18,h-38,w-18,h-12), fill=PAL['water'], outline=PAL['cyan'], width=2); d.rectangle((w//2-10,24,w//2+10,h-28), fill=PAL['ltc'], outline=PAL['dark']); d.text((w//2-5,36),'Ł',fill=PAL['dark']);
        for n in range(6): star(d,28+n*16,h-34+math.sin(i+n)*4,3,PAL['white'])
    elif 'billboard' in key or 'mural' in key:
        d.rectangle((12,14,w-12,h-18), fill=PAL['dark'], outline=PAL['neon'], width=2); d.text((22,28),'NGMI' if 'ngmi' in key else 'LTC', fill=PAL['cyan'] if i%2 else PAL['neon']);
        for n in range(10): rect(d,20+n*10, h-36+(i+n)%4*3, 5,2, [PAL['cyan'],PAL['neon'],PAL['gold']][n%3])
    elif 'streetlight' in key:
        for x in [24,50,76]: line(d,(x,20,x,h-16),PAL['dark'],3); star(d,x,18,7,PAL['gold'] if i%2 else PAL['ltc'])
    elif 'crane' in key:
        line(d,(30,h-20,30,20),PAL['orange'],5); line(d,(30,24,w-24,18+math.sin(i*.5)*8),PAL['orange'],4); line(d,(w-35,24,w-35,56+math.sin(i*.5)*8),PAL['dark'],2); rect(d,w-46,56+math.sin(i*.5)*8,20,14,PAL['gold'])
    elif 'container' in key:
        for n,c in enumerate([PAL['blue'],PAL['orange'],PAL['green']]): d.rectangle((18+n*28,h-42-n*8,62+n*28,h-14-n*8), fill=c, outline=PAL['dark'])
    elif 'gate' in key:
        d.rectangle((16,28,w-16,h-16), outline=PAL['cyan'], width=4); d.arc((28,18,w-28,h-10),180,360,fill=PAL['neon'],width=3); d.text((42,48),'BRIDGE',fill=PAL['ltc'])
    elif 'water' in key or 'fountain' in key:
        d.ellipse((8,h//2,w-8,h-14), fill=PAL['water'], outline=PAL['cyan']);
        for n in range(8): d.arc((18+n*16,h//2+math.sin(i+n)*4,40+n*16,h//2+12+math.sin(i+n)*4),180,350,fill=PAL['white'],width=2)
    elif 'tower' in key:
        d.polygon([(30,h-10),(48,14),(w-48,14),(w-30,h-10)], fill=PAL['glass'], outline=PAL['dark']);
        for n in range(7): line(d,(43,26+n*18,w-43,26+n*18),PAL['cyan'] if (i+n)%2 else PAL['ltc'],1)
    elif 'elevator' in key:
        d.rectangle((28,8,w-28,h-8), fill=PAL['dark'], outline=PAL['ltc'], width=3); d.rectangle((w//2-7,16,w//2+7,h-16), fill=(30,80,120,220));
        star(d,w//2,28+(i*10%(h-56)),6,PAL['cyan'])
    elif 'server' in key or 'asic' in key or 'rig' in key:
        for n in range(4): d.rectangle((14+n*34,22,40+n*34,h-18), fill=PAL['dark'], outline=PAL['concrete']);
        for n in range(16): star(d,24+(n%8)*16,34+(n//8)*26+(i%2)*2,2,[PAL['green'],PAL['orange'],PAL['cyan']][n%3])
    elif 'hedge' in key:
        for n in range(9): d.rounded_rectangle((8+n*14,28+math.sin(i+n)*3,26+n*14,h-16), radius=7, fill=(41,128,76,255), outline=PAL['dark'])
    elif 'lantern' in key:
        for n in range(6): star(d,18+n*16,24+math.sin(i+n)*5,5,PAL['green']); d.arc((10,42,w-10,h-20),190,350,fill=(130,255,190,90),width=3)
    elif 'greenhouse' in key:
        d.arc((18,20,w-18,h+30),180,360,fill=PAL['green'],width=5); d.rectangle((24,h-44,w-24,h-14), fill=(50,100,80,190), outline=PAL['dark']); star(d,w//2,38,4,PAL['white'])
    elif 'vent' in key:
        d.rectangle((24,h-28,w-24,h-12), fill=PAL['concrete'], outline=PAL['dark']);
        for n in range(5): d.arc((30+n*14,18+i%6,54+n*14,h-22-n*3),200,520,fill=(210,220,230,130),width=2)
    elif 'kiln' in key:
        d.rounded_rectangle((30,28,w-30,h-12), radius=10, fill=(95,52,45,255), outline=PAL['dark']); d.ellipse((w//2-18,46,w//2+18,h-20), fill=PAL['orange'] if i%2 else PAL['gold'])
    elif 'helipad' in key:
        d.ellipse((18,26,w-18,h-16), fill=PAL['dark'], outline=PAL['neon'], width=3); d.text((w//2-6,h//2-8),'H',fill=PAL['ltc']);
        for n in range(8): star(d,22+n*16,h-22,3,PAL['neon'] if (i+n)%2 else PAL['cyan'])
    elif 'skybridge' in key:
        d.rectangle((10,28,w-10,h-22), fill=PAL['glass'], outline=PAL['ltc'], width=3); line(d,(18,34,w-18,h-28),PAL['cyan'],1)
    elif 'parapet' in key:
        d.rectangle((10,24,w-10,h-18), fill=PAL['glass'], outline=PAL['ltc']);
        for n in range(7): line(d,(16+n*18,24,16+n*18,h-18),PAL['white'],1)

def save_city_asset(key,category,role,fw,fh,frames):
    sheet=blank(fw*frames,fh)
    for i in range(frames):
        fr=blank(fw,fh); d=ImageDraw.Draw(fr); draw_city(key,d,i,fw,fh); sheet.alpha_composite(fr,(i*fw,0))
    CITY_DIR.mkdir(parents=True, exist_ok=True); path=CITY_DIR/f'{key}.png'; sheet.save(path,optimize=True)
    CITY_ASSETS.append({'key':f'level2-final-city/{key}','category':category,'role':role,'src':f'./assets/generated/hmh-coherent-world/level2-final-city/{key}.png','animated':True,'frames':frames,'frameMs':110,'frameWidth':fw,'frameHeight':fh,'sheetWidth':sheet.width,'sheetHeight':sheet.height,'sourcePolicy':'Original repo-owned Level 2 city pixel-art spritesheet; no downloaded pixels copied.'})

def write_manifests():
    boss_manifest={'id':'hmh-final-boss-animations-v1','sourcePolicy':'Original repo-owned boss and mini-boss pixel-art spritesheets; no downloaded pixels copied.','actorCount':len(BOSSES),'assetCount':len(BOSS_ASSETS),'states':STATES,'actors':[{'id':b[0],'name':b[1]} for b in BOSSES],'assets':BOSS_ASSETS}
    BOSS_DIR.mkdir(parents=True, exist_ok=True)
    (BOSS_DIR/'hmh-final-boss-animations-manifest.json').write_text(json.dumps(boss_manifest,indent=2),encoding='utf-8')
    (BOSS_DIR/'hmh-final-boss-animations-manifest.mjs').write_text('// Generated by scripts/generate-hmh-final-boss-and-level2-city.py\nexport const HMH_FINAL_BOSS_ANIMATION_PACK = Object.freeze('+json.dumps(boss_manifest,indent=2)+');\n\nconst FINAL_BOSS_BY_ACTOR_STATE = new Map(HMH_FINAL_BOSS_ANIMATION_PACK.assets.map((asset) => [`${asset.actorId}/${asset.state}`, Object.freeze(asset)]));\nexport function finalBossAnimationAssetByActorState(actorId, state) { return FINAL_BOSS_BY_ACTOR_STATE.get(`${actorId}/${state}`) ?? null; }\n',encoding='utf-8')
    city_manifest={'id':'hmh-level-two-final-city-v1','sourcePolicy':'Original repo-owned Level 2 Litecoin City world-art spritesheets; no downloaded pixels copied.','assetCount':len(CITY_ASSETS),'assets':CITY_ASSETS}
    (CITY_DIR/'level2-final-city-manifest.json').write_text(json.dumps(city_manifest,indent=2),encoding='utf-8')
    (CITY_DIR/'level2-final-city-manifest.mjs').write_text('// Generated by scripts/generate-hmh-final-boss-and-level2-city.py\nexport const HMH_LEVEL_TWO_FINAL_CITY_ASSETS = Object.freeze('+json.dumps(city_manifest,indent=2)+');\n\nconst LEVEL_TWO_FINAL_CITY_BY_KEY = new Map(HMH_LEVEL_TWO_FINAL_CITY_ASSETS.assets.map((asset) => [asset.key, Object.freeze(asset)]));\nexport function levelTwoFinalCityAssetByKey(key) { return LEVEL_TWO_FINAL_CITY_BY_KEY.get(key) ?? null; }\n',encoding='utf-8')

def contact_sheet(assets, path, title, base_dir, actor_mode=False):
    DOC_ASSETS.mkdir(parents=True,exist_ok=True); cols=5; cellw=190; cellh=126; rows=math.ceil(len(assets)/cols)
    sheet=Image.new('RGB',(cols*cellw,rows*cellh+38),(18,20,29)); d=ImageDraw.Draw(sheet); d.text((12,12),title,fill=(235,242,255))
    for idx,a in enumerate(assets):
        p = (BOSS_DIR/a['src'].split('/hmh-final-boss-animations/')[-1]) if actor_mode else (base_dir/a['src'].split('/')[-1])
        im=Image.open(p).convert('RGBA'); fw=a['frameWidth']; fh=a['frameHeight']; frame=im.crop((0,0,fw,fh)); bg=Image.new('RGBA',(fw,fh),(34,38,50,255)); bg.alpha_composite(frame); thumb=bg.convert('RGB'); thumb.thumbnail((150,76),Image.Resampling.NEAREST)
        x=(idx%cols)*cellw; y=(idx//cols)*cellh+38; d.rectangle((x+5,y+5,x+cellw-5,y+cellh-5),fill=(37,42,54),outline=(82,90,112)); sheet.paste(thumb,(x+(cellw-thumb.width)//2,y+9)); d.text((x+10,y+88),a['key'][-32:],fill=(143,224,255)); d.text((x+10,y+106),a.get('state') or a.get('category',''),fill=(222,230,205))
    sheet.save(path,quality=95)

def docs():
    DOCS.mkdir(parents=True,exist_ok=True)
    (DOCS/'hard-money-heroes-final-boss-and-level2-city-pack.md').write_text('# Hard Money Heroes final boss animation + Level 2 city art pack\n\n_Last updated: 2026-06-25_\n\nAdds original repo-owned final boss/miniboss animation sheets for authored Level 1/2 encounters plus Level 2 Litecoin City world-art setpieces and animated props.\n',encoding='utf-8')
    contact_sheet(BOSS_ASSETS[:60], DOC_ASSETS/'hmh-final-boss-animation-contact-sheet.png', 'HMH final boss animation pack', BOSS_DIR, actor_mode=True)
    contact_sheet(CITY_ASSETS, DOC_ASSETS/'hmh-level2-final-city-contact-sheet.png', 'HMH Level 2 final city world pack', CITY_DIR)

def main():
    for boss in BOSSES:
        for st in STATES: save_boss_sheet(boss, st)
    for args in CITY_DEFS: save_city_asset(*args)
    write_manifests(); docs()
    print(json.dumps({'bossActors':len(BOSSES),'bossSheets':len(BOSS_ASSETS),'cityAssets':len(CITY_ASSETS)},indent=2))
if __name__=='__main__': main()
