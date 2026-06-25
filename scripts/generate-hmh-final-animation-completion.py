#!/usr/bin/env python
"""Generate original HMH final animation completion spritesheets.

This pack closes the asset-production contract for hero polish states and enemy
readability states without copying third-party pixels. Sheets are horizontal:
8 directions × N frames per direction.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/portal/assets/generated/hmh-final-animation-completion'
DOCS = ROOT / 'docs/game-design'
DOC_ASSETS = DOCS / 'assets'
DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
HERO_STATES = ['crouch', 'fall', 'victory']
ENEMY_STATES = ['attack-tell', 'melee-counter', 'hit', 'death', 'optional-gore-overlay']
FRAMES = 4
FRAME_W = 64
FRAME_H = 72
ASSETS = []

HEROES = [
    {'id':'lit-commando','label':'Lit Commando','colors':{'body':(44,170,88,255),'trim':(96,245,151,255),'skin':(232,174,118,255),'hair':(52,38,28,255)}},
    {'id':'lit-valkyrie','label':'Lit Valkyrie','colors':{'body':(81,113,222,255),'trim':(255,213,82,255),'skin':(228,170,125,255),'hair':(244,214,111,255)}},
    {'id':'lester','label':'Lester','colors':{'body':(219,72,59,255),'trim':(255,226,87,255),'skin':(232,178,126,255),'hair':(86,54,35,255)}},
    {'id':'lilly','label':'Lilly','colors':{'body':(197,72,180,255),'trim':(99,234,238,255),'skin':(230,170,126,255),'hair':(71,42,76,255)}},
]

ENEMIES = [
    ('trench-degen',(104,88,66,255),(237,156,65,255),'humanoid'),
    ('evil-banker-ranged',(52,61,83,255),(85,235,148,255),'humanoid'),
    ('crypto-bro-rusher',(73,116,205,255),(255,226,83,255),'humanoid'),
    ('gas-beast-tank',(112,92,70,255),(99,231,118,255),'beast'),
    ('claim-jumper',(128,78,38,255),(247,182,77,255),'humanoid'),
    ('coyote-pack-runner',(130,95,54,255),(229,172,88,255),'quadruped'),
    ('scorpion-ambusher',(79,55,95,255),(235,79,82,255),'crawler'),
    ('wild-boar',(89,63,48,255),(221,134,74,255),'quadruped'),
    ('rattlesnake',(104,132,53,255),(237,205,88,255),'serpent'),
    ('paper-hand',(198,190,162,255),(247,246,229,255),'humanoid'),
    ('honeypot-turret',(118,74,39,255),(248,194,75,255),'turret'),
    ('slippage-skater',(69,154,176,255),(245,99,210,255),'humanoid'),
    ('phishing-angler',(45,92,121,255),(88,235,218,255),'humanoid'),
    ('mev-reaper',(52,42,71,255),(202,90,255,255),'humanoid'),
    ('sybil-drone',(84,96,130,255),(105,234,255,255),'drone'),
    ('rug-rat',(122,75,49,255),(255,114,82,255),'crawler'),
]

P = {
    'outline': (20,18,24,255),
    'shadow': (7,8,12,82),
    'white': (236,239,231,255),
    'red': (230,54,58,255),
    'blood': (145,20,30,255),
    'gold': (246,205,78,255),
    'cyan': (69,225,240,255),
}

def safe(name: str) -> str:
    return ''.join(c if c.isalnum() or c == '-' else '-' for c in name.lower()).strip('-')

def shadow(d, cx=32, cy=63, rx=18, ry=5):
    d.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=P['shadow'])

def dir_dx(direction):
    return {'east':3,'north-east':2,'south-east':2,'west':-3,'north-west':-2,'south-west':-2}.get(direction,0)

def dir_eye(direction):
    if 'east' in direction: return 3
    if 'west' in direction: return -3
    return 0

def draw_humanoid(d, direction, state, body, trim, skin, hair, frame):
    dx = dir_dx(direction)
    bob = int(math.sin((frame / FRAMES) * math.tau) * 2)
    lean = 0
    yoff = 0
    if state == 'crouch': yoff = 9
    elif state == 'fall': yoff = -6 + frame * 2; lean = 4 if 'east' in direction else -4 if 'west' in direction else 0
    elif state == 'victory': bob = -2 if frame % 2 else 0
    elif state == 'attack-tell': lean = 2 if frame % 2 else -1
    elif state == 'melee-counter': lean = -3 if frame < 2 else 3
    elif state == 'hit': lean = -4 + frame * 2
    elif state == 'death': yoff = 12 + frame * 3; lean = 7
    x = 32 + dx + lean
    base = 58 + yoff + bob
    if state == 'death':
        d.rounded_rectangle((x-20, base-12, x+22, base+2), radius=4, fill=body, outline=P['outline'])
        d.ellipse((x+8, base-19, x+25, base-4), fill=skin, outline=P['outline'])
        d.line((x-18, base-4, x+18, base-12), fill=trim, width=3)
        return
    # legs
    if state == 'crouch':
        d.line((x-9, base-16, x-17, base-4), fill=P['outline'], width=5)
        d.line((x+9, base-16, x+17, base-4), fill=P['outline'], width=5)
        d.line((x-9, base-16, x-17, base-4), fill=body, width=3)
        d.line((x+9, base-16, x+17, base-4), fill=body, width=3)
    else:
        leg_swing = -3 if frame % 2 == 0 else 3
        d.line((x-8, base-24, x-12-leg_swing, base), fill=P['outline'], width=5)
        d.line((x+8, base-24, x+12+leg_swing, base), fill=P['outline'], width=5)
        d.line((x-8, base-24, x-12-leg_swing, base), fill=body, width=3)
        d.line((x+8, base-24, x+12+leg_swing, base), fill=body, width=3)
    # torso/head
    d.rounded_rectangle((x-14, base-47, x+14, base-19), radius=5, fill=body, outline=P['outline'])
    d.rectangle((x-12, base-36, x+12, base-31), fill=trim)
    d.ellipse((x-11, base-64, x+11, base-43), fill=skin, outline=P['outline'])
    d.pieslice((x-13, base-67, x+13, base-47), 180, 360, fill=hair, outline=P['outline'])
    eye = dir_eye(direction)
    d.rectangle((x+eye-4, base-55, x+eye-2, base-53), fill=P['outline'])
    d.rectangle((x+eye+4, base-55, x+eye+6, base-53), fill=P['outline'])
    # arms / state detail
    arm_y = base-35
    if state == 'victory':
        raise_y = base-62 + (frame % 2) * 2
        d.line((x-12, arm_y, x-24, raise_y), fill=P['outline'], width=5)
        d.line((x+12, arm_y, x+24, raise_y), fill=P['outline'], width=5)
        d.line((x-12, arm_y, x-24, raise_y), fill=trim, width=3)
        d.line((x+12, arm_y, x+24, raise_y), fill=trim, width=3)
        d.polygon([(x, base-72),(x+8,base-70),(x+2,base-65),(x+6,base-58),(x,base-62),(x-6,base-58),(x-2,base-65),(x-8,base-70)], fill=P['gold'], outline=P['outline'])
    elif state in ('attack-tell','melee-counter'):
        reach = 18 + frame * 2
        d.line((x+10, arm_y, x+reach, arm_y-5), fill=P['outline'], width=5)
        d.line((x+10, arm_y, x+reach, arm_y-5), fill=trim, width=3)
        d.polygon([(x+reach,arm_y-7),(x+reach+8,arm_y-10),(x+reach+5,arm_y-3)], fill=P['cyan'], outline=P['outline'])
        d.line((x-10, arm_y, x-22, arm_y+6), fill=P['outline'], width=5)
        d.line((x-10, arm_y, x-22, arm_y+6), fill=trim, width=3)
    elif state == 'hit':
        d.line((x-11, arm_y, x-25, arm_y-3), fill=P['outline'], width=5)
        d.line((x+11, arm_y, x+25, arm_y+3), fill=P['outline'], width=5)
        d.polygon([(x-25,base-60),(x-18,base-57),(x-25,base-52)], fill=P['red'])
    elif state == 'optional-gore-overlay':
        for i in range(5):
            px = x-16 + i*8 + (frame%2)*2
            py = base-48 + (i%3)*7
            d.ellipse((px-2,py-2,px+3,py+3), fill=P['blood'])
    else:
        d.line((x-11, arm_y, x-25, arm_y+7), fill=P['outline'], width=5)
        d.line((x+11, arm_y, x+25, arm_y+7), fill=P['outline'], width=5)
        d.line((x-11, arm_y, x-25, arm_y+7), fill=trim, width=3)
        d.line((x+11, arm_y, x+25, arm_y+7), fill=trim, width=3)

def draw_quadruped(d, direction, state, body, trim, frame):
    dx = dir_dx(direction); x = 32 + dx; base = 58
    if state == 'death':
        d.ellipse((x-24,base-16,x+20,base+2), fill=body, outline=P['outline']); d.ellipse((x+8,base-25,x+26,base-9), fill=trim, outline=P['outline']); return
    body_y = base-25 + int(math.sin(frame/FRAMES*math.tau)*2)
    d.ellipse((x-24,body_y-8,x+20,body_y+13), fill=body, outline=P['outline'])
    d.ellipse((x+10,body_y-18,x+28,body_y-1), fill=trim, outline=P['outline'])
    for ox in [-16,-6,8,17]:
        step = (-2 if (frame+ox)%2 else 2)
        d.line((x+ox,body_y+9,x+ox+step,base), fill=P['outline'], width=4)
        d.line((x+ox,body_y+9,x+ox+step,base), fill=body, width=2)
    if state in ('attack-tell','melee-counter','attack'):
        d.arc((x+18,body_y-21,x+38,body_y+1), 210, 320, fill=P['red'], width=3)
    if state == 'hit': d.polygon([(x-24,body_y-12),(x-34,body_y-16),(x-28,body_y-6)], fill=P['red'])
    if state == 'optional-gore-overlay':
        for i in range(4): d.ellipse((x-12+i*7,body_y-10+i%2*8,x-8+i*7,body_y-6+i%2*8), fill=P['blood'])

def draw_crawler(d, direction, state, body, trim, frame):
    x=32+dir_dx(direction); base=58
    if state=='death':
        d.ellipse((x-24,base-14,x+24,base+2), fill=(body[0]//2,body[1]//2,body[2]//2,255), outline=P['outline']); return
    d.ellipse((x-20,base-28,x+20,base-6), fill=body, outline=P['outline'])
    for side in [-1,1]:
        for i in range(3):
            y=base-24+i*7; leg=12+((frame+i)%2)*3
            d.line((x+side*10,y,x+side*leg,y+6), fill=P['outline'], width=3)
            d.line((x+side*10,y,x+side*leg,y+6), fill=trim, width=2)
    if state in ('attack-tell','melee-counter'):
        d.arc((x-25,base-50,x+25,base-4), 210, 330, fill=trim, width=4)
    if state=='hit': d.polygon([(x-3,base-35),(x+8,base-43),(x+4,base-28)], fill=P['red'])
    if state=='optional-gore-overlay':
        for i in range(5): d.ellipse((x-18+i*8,base-28+(i%2)*5,x-14+i*8,base-24+(i%2)*5), fill=P['blood'])

def draw_serpent(d, direction, state, body, trim, frame):
    x=32+dir_dx(direction); base=58
    pts=[]
    for i in range(6):
        pts.append((x-24+i*10, base-10-int(math.sin(frame+i)*5)))
    d.line(pts, fill=P['outline'], width=11)
    d.line(pts, fill=body, width=8)
    d.ellipse((x+20,base-23,x+35,base-8), fill=trim, outline=P['outline'])
    if state in ('attack-tell','melee-counter'): d.line((x+34,base-16,x+46,base-20), fill=P['red'], width=2)
    if state=='death': d.line(pts, fill=(body[0]//2,body[1]//2,body[2]//2,255), width=8)
    if state=='hit': d.polygon([(x,base-25),(x+10,base-31),(x+5,base-18)], fill=P['red'])
    if state=='optional-gore-overlay': d.ellipse((x-4,base-22,x+5,base-14), fill=P['blood'])

def draw_turret_or_drone(d, direction, state, body, trim, frame, drone=False):
    x=32+dir_dx(direction); base=49 if drone else 58
    if not drone: d.rectangle((x-14,base-16,x+14,base), fill=body, outline=P['outline'])
    d.ellipse((x-18,base-42,x+18,base-12), fill=body, outline=P['outline'])
    d.rectangle((x-9,base-32,x+9,base-24), fill=trim, outline=P['outline'])
    if drone:
        d.line((x-25,base-30,x-39,base-36), fill=P['outline'], width=3); d.line((x+25,base-30,x+39,base-36), fill=P['outline'], width=3)
        d.ellipse((x-44,base-40,x-34,base-30), fill=trim); d.ellipse((x+34,base-40,x+44,base-30), fill=trim)
    if state in ('attack-tell','melee-counter'):
        d.rectangle((x+17,base-31,x+37,base-25), fill=trim, outline=P['outline'])
    if state=='hit': d.polygon([(x-15,base-46),(x-25,base-55),(x-19,base-38)], fill=P['red'])
    if state=='death':
        for i in range(4): d.line((x,base-25,x-15+i*10,base-45+(i%2)*12), fill=P['red'], width=2)
    if state=='optional-gore-overlay':
        for i in range(4): d.rectangle((x-14+i*8,base-36,x-10+i*8,base-31), fill=P['blood'])

def draw_frame(actor, role, state, direction, frame):
    img = Image.new('RGBA', (FRAME_W, FRAME_H), (0,0,0,0)); d=ImageDraw.Draw(img); shadow(d)
    if role == 'hero':
        c = actor['colors']
        draw_humanoid(d, direction, state, c['body'], c['trim'], c['skin'], c['hair'], frame)
    else:
        _, body, trim, kind = actor
        if kind == 'humanoid': draw_humanoid(d, direction, state, body, trim, (208,155,104,255), (43,35,37,255), frame)
        elif kind == 'quadruped' or kind == 'beast': draw_quadruped(d, direction, state, body, trim, frame)
        elif kind == 'crawler': draw_crawler(d, direction, state, body, trim, frame)
        elif kind == 'serpent': draw_serpent(d, direction, state, body, trim, frame)
        elif kind == 'turret': draw_turret_or_drone(d, direction, state, body, trim, frame, False)
        elif kind == 'drone': draw_turret_or_drone(d, direction, state, body, trim, frame, True)
    # tiny direction tick in bottom-left so directions are visually unique without UI text.
    angle = DIRECTIONS.index(direction) * math.tau / len(DIRECTIONS)
    cx, cy = 7, 65
    d.line((cx,cy,cx+math.cos(angle)*5,cy+math.sin(angle)*5), fill=(255,255,255,145), width=1)
    return img

def make_sheet(actor, role, state):
    sheet = Image.new('RGBA', (FRAME_W * FRAMES * len(DIRECTIONS), FRAME_H), (0,0,0,0))
    for di, direction in enumerate(DIRECTIONS):
        for fi in range(FRAMES):
            frame = draw_frame(actor, role, state, direction, fi)
            sheet.alpha_composite(frame, ((di * FRAMES + fi) * FRAME_W, 0))
    return sheet

def add_asset(actor_id, role, label, state, sheet):
    subdir = OUT / role / actor_id
    subdir.mkdir(parents=True, exist_ok=True)
    path = subdir / f'{state}.png'
    sheet.save(path, optimize=True)
    rel = './assets/generated/hmh-final-animation-completion/' + '/'.join(path.relative_to(OUT).parts)
    key = f'{role}/{actor_id}/{state}'
    ASSETS.append({
        'key': key,
        'actorId': actor_id,
        'label': label,
        'role': role,
        'state': state,
        'src': rel,
        'directions': DIRECTIONS,
        'framesPerDirection': FRAMES,
        'frameWidth': FRAME_W,
        'frameHeight': FRAME_H,
        'sheetWidth': FRAME_W * FRAMES * len(DIRECTIONS),
        'sheetHeight': FRAME_H,
        'animated': True,
        'sourcePolicy': 'Original repo-owned pixel art generated for HMH final animation completion; no downloaded pixels copied.',
    })

def generate():
    OUT.mkdir(parents=True, exist_ok=True)
    for hero in HEROES:
        for state in HERO_STATES:
            add_asset(hero['id'], 'hero', hero['label'], state, make_sheet(hero, 'hero', state))
    for enemy in ENEMIES:
        actor_id, _, _, _ = enemy
        for state in ENEMY_STATES:
            add_asset(actor_id, 'enemy', actor_id.replace('-', ' ').title(), state, make_sheet(enemy, 'enemy', state))

def write_manifest():
    actors = []
    for hero in HEROES:
        actors.append({'id':hero['id'], 'label':hero['label'], 'role':'hero', 'states':HERO_STATES})
    for enemy in ENEMIES:
        actors.append({'id':enemy[0], 'label':enemy[0].replace('-', ' ').title(), 'role':'enemy', 'states':ENEMY_STATES})
    manifest = {
        'id': 'hmh-final-animation-completion-v1',
        'sourcePolicy': 'Original repo-owned HMH final animation completion pixel art; no downloaded pixels copied.',
        'directions': DIRECTIONS,
        'framesPerDirection': FRAMES,
        'heroPolishStates': HERO_STATES,
        'enemyReadabilityStates': ENEMY_STATES,
        'actorCount': len(actors),
        'assetCount': len(ASSETS),
        'actors': actors,
        'assets': ASSETS,
    }
    (OUT / 'hmh-final-animation-completion-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    mjs = "// Generated by scripts/generate-hmh-final-animation-completion.py\n"
    mjs += "export const HMH_FINAL_ANIMATION_COMPLETION_PACK = Object.freeze(" + json.dumps(manifest, indent=2) + ");\n\n"
    mjs += "const FINAL_ANIMATION_BY_KEY = new Map(HMH_FINAL_ANIMATION_COMPLETION_PACK.assets.map((asset) => [asset.key, Object.freeze(asset)]));\n"
    mjs += "export function finalAnimationAssetByKey(key) { return FINAL_ANIMATION_BY_KEY.get(key) ?? null; }\n"
    mjs += "export function completionAssetsForActor(actorId) { return Object.freeze(HMH_FINAL_ANIMATION_COMPLETION_PACK.assets.filter((asset) => asset.actorId === actorId)); }\n"
    mjs += "export function completionCoverageSummary() {\n"
    mjs += "  const heroActors = HMH_FINAL_ANIMATION_COMPLETION_PACK.actors.filter((actor) => actor.role === 'hero');\n"
    mjs += "  const enemyActors = HMH_FINAL_ANIMATION_COMPLETION_PACK.actors.filter((actor) => actor.role === 'enemy');\n"
    mjs += "  const missingAssets = [];\n"
    mjs += "  for (const actor of HMH_FINAL_ANIMATION_COMPLETION_PACK.actors) {\n"
    mjs += "    for (const state of actor.states ?? []) { if (!FINAL_ANIMATION_BY_KEY.has(`${actor.role}/${actor.id}/${state}`)) missingAssets.push(`${actor.role}/${actor.id}/${state}`); }\n"
    mjs += "  }\n"
    mjs += "  return Object.freeze({ heroActors: heroActors.length, enemyActors: enemyActors.length, heroStates: Object.freeze([...HMH_FINAL_ANIMATION_COMPLETION_PACK.heroPolishStates]), enemyStates: Object.freeze([...HMH_FINAL_ANIMATION_COMPLETION_PACK.enemyReadabilityStates]), totalAssets: HMH_FINAL_ANIMATION_COMPLETION_PACK.assets.length, missingAssets: Object.freeze(missingAssets) });\n"
    mjs += "}\n"
    (OUT / 'hmh-final-animation-completion-manifest.mjs').write_text(mjs, encoding='utf-8')

def contact_sheet():
    DOC_ASSETS.mkdir(parents=True, exist_ok=True)
    cols, cellw, cellh = 5, 190, 126
    samples = ASSETS[:12] + [a for a in ASSETS if a['role']=='enemy'][:18]
    rows = math.ceil(len(samples)/cols)
    img = Image.new('RGB', (cols*cellw, rows*cellh+42), (21,23,31)); d=ImageDraw.Draw(img)
    d.text((12,12), 'HMH final animation completion pack — first-frame samples', fill=(238,242,255))
    for i,a in enumerate(samples):
        src = OUT / a['src'].split('hmh-final-animation-completion/')[1]
        sheet = Image.open(src).convert('RGBA')
        frame = sheet.crop((0,0,FRAME_W,FRAME_H))
        bg = Image.new('RGBA', frame.size, (35,39,48,255)); bg.alpha_composite(frame)
        thumb = bg.convert('RGB'); thumb = thumb.resize((FRAME_W*2, FRAME_H*2), Image.Resampling.NEAREST)
        x=(i%cols)*cellw; y=(i//cols)*cellh+42
        d.rectangle((x+4,y+4,x+cellw-4,y+cellh-4), fill=(36,40,52), outline=(75,85,103))
        img.paste(thumb, (x+12,y+8))
        d.text((x+12,y+82), a['key'][:28], fill=(169,225,255))
        d.text((x+12,y+100), f"{a['directions'][0]}.. · {a['framesPerDirection']}f", fill=(218,230,210))
    img.save(DOC_ASSETS / 'hmh-final-animation-completion-contact-sheet.png', quality=95)

def docs():
    text = f"""# Hard Money Heroes final animation completion pack

_Last updated: 2026-06-25_

This generated pack adds original repo-owned pixel-art spritesheets for the remaining high-value animation-production gaps:

- Hero polish states: `{', '.join(HERO_STATES)}` for Lit Commando, Lit Valkyrie, Lester, and Lilly.
- Enemy readability states: `{', '.join(ENEMY_STATES)}` for {len(ENEMIES)} active enemy roster keys.

Runtime folder:

```text
apps/portal/assets/generated/hmh-final-animation-completion/
```

Contact sheet:

```text
docs/game-design/assets/hmh-final-animation-completion-contact-sheet.png
```

Source policy: original repo-owned pixel art generated specifically for HMH. No downloaded pixels copied.

These sheets are a completion-pack asset layer: horizontal spritesheets ordered by the shared 8-direction contract, with {FRAMES} frames per direction. They are intentionally separated from older runtime roster manifests so the renderer can opt into them cleanly without corrupting the harvested PixelLab roster ledger.
"""
    (DOCS / 'hard-money-heroes-final-animation-completion-pack.md').write_text(text, encoding='utf-8')

def main():
    generate(); write_manifest(); contact_sheet(); docs()
    print(json.dumps({'assetCount':len(ASSETS),'actors':len(HEROES)+len(ENEMIES),'out':str(OUT)}, indent=2))

if __name__ == '__main__':
    main()
