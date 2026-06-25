#!/usr/bin/env python
"""Generate original animated Level 1 environment polish props.

Spritesheets are horizontal strips. They are original repo-owned pixel/isometric
props and do not copy downloaded pixels.
"""
from __future__ import annotations

import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'apps/portal/assets/generated/hmh-coherent-world/level1-final-animated'
DOC_ASSETS=ROOT/'docs/game-design/assets'
DOC=ROOT/'docs/game-design/hard-money-heroes-level-1-final-animated-props.md'
FRAMES=6
ASSETS=[]

P={
 'outline':(31,27,30,255),'shadow':(12,12,16,90),'pine1':(19,73,42,255),'pine2':(41,132,64,255),'pine3':(110,203,88,255),
 'leaf1':(43,92,46,255),'leaf2':(88,157,66,255),'leaf3':(164,210,83,255),'wood':(109,65,31,255),'wood2':(206,130,58,255),
 'crop1':(45,92,33,255),'crop2':(98,167,48,255),'crop3':(232,190,64,255),'water':(36,149,195,170),'reed':(155,125,61,255),
 'sign':(224,149,69,255),'stone':(126,116,102,255),'roof':(179,57,39,255),
}

def sheet(frames):
    w,h=frames[0].size
    out=Image.new('RGBA',(w*len(frames),h),(0,0,0,0))
    for i,f in enumerate(frames): out.alpha_composite(f,(i*w,0))
    return out

def save(name, category, role, frames, notes):
    OUT.mkdir(parents=True,exist_ok=True)
    img=sheet(frames)
    img.save(OUT/f'{name}.png', optimize=True)
    w,h=frames[0].size
    rec={'key':f'level1-final-animated/{name}','category':category,'role':role,'src':f'./assets/generated/hmh-coherent-world/level1-final-animated/{name}.png','width':w,'height':h,'animated':True,'frames':len(frames),'frameWidth':w,'frameHeight':h,'sheetWidth':w*len(frames),'frameMs':130,'sourcePolicy':'Original repo-owned final animated prop; no downloaded pixels copied.','notes':notes}
    ASSETS.append(rec)

def shadow(d,cx,cy,rx,ry): d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry), fill=P['shadow'])

def pine_frame(t):
    img=Image.new('RGBA',(136,144),(0,0,0,0)); d=ImageDraw.Draw(img); shadow(d,68,128,46,10)
    sway=math.sin(t/FRAMES*math.tau)*3
    for i,(ox,oy,scale) in enumerate([(-28,8,.95),(0,0,1.08),(28,12,.9),(-4,28,.75)]):
        x=68+ox+sway*(1+i*.15); base=118+oy; h=int(76*scale)
        d.rectangle((x-4,base-h//2,x+4,base), fill=P['wood'], outline=P['outline'])
        for level in range(4):
            yy=base-h+level*17; w=int((18+level*9)*scale); col=[P['pine3'],P['pine2'],P['pine2'],P['pine1']][level]
            d.polygon([(x,yy-10),(x-w+sway*.3,yy+18),(x+w+sway*.3,yy+18)], fill=col, outline=P['outline'])
    return img

def oak_frame(t):
    img=Image.new('RGBA',(136,136),(0,0,0,0)); d=ImageDraw.Draw(img); shadow(d,68,121,42,9)
    sway=math.sin(t/FRAMES*math.tau)*2.5
    for i,(ox,oy) in enumerate([(-24,10),(4,2),(28,16)]):
        x=68+ox+sway; base=112+oy
        d.rectangle((x-5,base-42,x+5,base), fill=P['wood'], outline=P['outline'])
        for r,c,dx,dy in [(28,P['leaf1'],0,-58),(23,P['leaf2'],-4,-60),(13,P['leaf3'],7,-65)]:
            d.ellipse((x-r+dx+sway,base+r//5+dy,x+r+dx+sway,base+r+dy), fill=c, outline=P['outline'])
    return img

def reeds_frame(t):
    img=Image.new('RGBA',(104,82),(0,0,0,0)); d=ImageDraw.Draw(img); shadow(d,52,68,35,6); d.ellipse((15,53,90,72), fill=P['water'])
    for i in range(24):
        x=19+(i*7)%66; y=64-(i%3); h=18+(i*5)%24; bend=math.sin(t/FRAMES*math.tau+i*.4)*3
        d.line((x,y,x+bend,y-h), fill=P['reed'], width=2)
        if i%6==0: d.ellipse((x+bend-2,y-h-3,x+bend+3,y-h+2), fill=(229,143,70,255))
    return img

def crop_frame(t, wheat=False):
    img=Image.new('RGBA',(132,76),(0,0,0,0)); d=ImageDraw.Draw(img); shadow(d,66,64,48,7)
    for row in range(4):
        for col in range(9):
            x=20+col*10+row*5; y=24+row*9; bend=math.sin(t/FRAMES*math.tau+col*.6+row)*3
            colr=P['crop3'] if wheat and (row+col)%2==0 else P['crop2']
            d.line((x,y+26,x+bend+3,y), fill=P['crop1'], width=2)
            d.line((x+4,y+23,x+bend+8,y+3), fill=colr, width=2)
    return img

def sign_frame(t, label='FARM'):
    img=Image.new('RGBA',(76,88),(0,0,0,0)); d=ImageDraw.Draw(img); shadow(d,38,77,23,5)
    sway=math.sin(t/FRAMES*math.tau)*2
    d.rectangle((35,26,41,78), fill=P['wood'], outline=P['outline'])
    d.polygon([(18+sway,22),(57+sway,22),(64+sway,34),(18+sway,34)], fill=P['sign'], outline=P['outline'])
    d.text((23+sway,23), label, fill=(48,29,17,255))
    d.line((16,43,58,53), fill=P['wood2'], width=5); d.line((16,43,58,53), fill=P['outline'], width=1)
    return img

def bank_flicker_frame(t):
    img=Image.new('RGBA',(156,128),(0,0,0,0)); d=ImageDraw.Draw(img); shadow(d,78,113,56,10)
    pulse=30 if t%2==0 else 0
    d.polygon([(34,55),(78,34),(122,55),(78,78)], fill=(59+pulse//3,52,59,255), outline=P['outline'])
    d.polygon([(34,55),(78,78),(78,114),(34,91)], fill=(123,77,47,255), outline=P['outline'])
    d.polygon([(122,55),(78,78),(78,114),(122,91)], fill=(166,105,61,255), outline=P['outline'])
    d.rectangle((29,50,126,60), fill=(218+pulse,166+pulse//2,79,255), outline=P['outline']); d.text((48,49),'BANK',fill=(45,28,18,255))
    d.rectangle((91,73,111,89), fill=(78+pulse,124+pulse,143+pulse,255), outline=P['outline'])
    d.rectangle((44,74,62,93), fill=(61,38,31,255), outline=P['outline'])
    return img

def barn_flag_frame(t):
    img=Image.new('RGBA',(160,134),(0,0,0,0)); d=ImageDraw.Draw(img); shadow(d,80,117,56,11)
    flag=math.sin(t/FRAMES*math.tau)*3
    d.polygon([(35,63),(80,39),(126,63),(80,89)], fill=P['roof'], outline=P['outline'])
    d.polygon([(35,63),(80,89),(80,118),(35,91)], fill=(148,58,44,255), outline=P['outline'])
    d.polygon([(126,63),(80,89),(80,118),(126,91)], fill=(189,74,50,255), outline=P['outline'])
    d.rectangle((68,89,86,118), fill=P['wood'], outline=P['outline']); d.line((69,91,85,115), fill=(238,210,160,255), width=2); d.line((85,91,69,115), fill=(238,210,160,255), width=2)
    d.line((116,50,116,28), fill=P['wood'], width=2); d.polygon([(116,30),(136+flag,34),(116,40)], fill=(235,208,76,255), outline=P['outline'])
    return img

def make():
    save('forest-wall-pine-sway','flora','tree',[pine_frame(t) for t in range(FRAMES)],'dense pine cluster with wind sway')
    save('forest-wall-oak-sway','flora','tree',[oak_frame(t) for t in range(FRAMES)],'broadleaf cluster with wind sway')
    save('oasis-reeds-sway','water','water-strip',[reeds_frame(t) for t in range(FRAMES)],'animated oasis reeds and water edge')
    save('corn-patch-wind','farm','decor',[crop_frame(t,False) for t in range(FRAMES)],'corn rows swaying in wind')
    save('wheat-patch-wind','farm','decor',[crop_frame(t,True) for t in range(FRAMES)],'wheat rows with wind shimmer')
    save('roadside-sign-sway','road','sign',[sign_frame(t,'FARM') for t in range(FRAMES)],'route sign with subtle sway')
    save('town-bank-flicker','structure','building',[bank_flicker_frame(t) for t in range(FRAMES)],'town bank neon/window flicker')
    save('barn-flag-wave','structure','building',[barn_flag_frame(t) for t in range(FRAMES)],'barn with animated flag')

def contact():
    DOC_ASSETS.mkdir(parents=True,exist_ok=True); cellw,cellh,cols=224,156,4; rows=math.ceil(len(ASSETS)/cols)
    sheet_img=Image.new('RGB',(cols*cellw,rows*cellh+42),(22,24,31)); d=ImageDraw.Draw(sheet_img); d.text((12,12),'HMH Level 1 final animated polish props', fill=(242,245,255))
    for i,a in enumerate(ASSETS):
        im=Image.open(OUT/(a['key'].split('/')[1]+'.png')).convert('RGBA').crop((0,0,a['frameWidth'],a['frameHeight']))
        bg=Image.new('RGBA',im.size,(36,38,44,255)); bg.alpha_composite(im); thumb=bg.convert('RGB'); thumb.thumbnail((160,104),Image.Resampling.NEAREST)
        x=(i%cols)*cellw; y=(i//cols)*cellh+42; d.rectangle((x+5,y+5,x+cellw-5,y+cellh-5), fill=(38,42,52), outline=(76,85,103))
        sheet_img.paste(thumb,(x+(cellw-thumb.width)//2,y+12)); d.text((x+10,y+116),a['key'].split('/')[1][:29], fill=(170,222,255)); d.text((x+10,y+134),f"{a['category']} · {a['frames']} frames", fill=(210,230,210))
    sheet_img.save(DOC_ASSETS/'hmh-level-1-final-animated-props-contact-sheet.png', quality=95)

def manifest():
    m={'id':'hmh-level-one-final-animated-polish-v1','sourcePolicy':'Original repo-owned animated Level 1 polish props; no downloaded pixels copied.','assetCount':len(ASSETS),'assets':ASSETS}
    (OUT/'level1-final-animated-manifest.json').write_text(json.dumps(m,indent=2),encoding='utf-8')
    (OUT/'level1-final-animated-manifest.mjs').write_text('// Generated by scripts/generate-hmh-level-one-final-animated-props.py\nexport const HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS = Object.freeze('+json.dumps(m,indent=2)+');\n\nconst ANIMATED_POLISH_BY_KEY = new Map(HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS.assets.map((asset) => [asset.key, Object.freeze(asset)]));\nexport function animatedPolishAssetByKey(key) { return ANIMATED_POLISH_BY_KEY.get(key) ?? null; }\n',encoding='utf-8')

def doc():
    DOC.write_text('# Hard Money Heroes Level 1 final animated prop pass\n\n_Last updated: 2026-06-25_\n\nAdds original animated spritesheet props for high-visibility Level 1 scenes: forest-wall sway, oasis reeds, crop wind, road signs, town bank flicker, and barn flag motion.\n\n- Runtime folder: `apps/portal/assets/generated/hmh-coherent-world/level1-final-animated/`\n- Contact sheet: `docs/game-design/assets/hmh-level-1-final-animated-props-contact-sheet.png`\n- Source policy: original repo-owned art; no downloaded pixels copied.\n',encoding='utf-8')

def main():
    make(); contact(); manifest(); doc(); print(json.dumps({'assetCount':len(ASSETS),'outDir':str(OUT)},indent=2))
if __name__=='__main__': main()
