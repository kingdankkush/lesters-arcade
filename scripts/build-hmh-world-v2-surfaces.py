"""Bake authored seamless ground surfaces for the ten-area presentation layer.

No legacy pixels are overwritten. Broad organic material islands and sparse
relief marks replace amplified uniform grain; the splat field owns biome colour
and route placement. Every mark wraps. No simulation RNG or Blender required.
"""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/portal/assets/generated/hmh-terrain-tiles'
SIZE = 512

def noise(period, seed):
    rng = np.random.default_rng(seed)  # Bake-only, never part of the game.
    lattice = rng.random((period, period))
    u = np.arange(SIZE) / SIZE * period
    i = np.floor(u).astype(int)
    f = u - i
    f = f * f * (3 - 2 * f)
    top = lattice[i[:, None] % period, i[None, :] % period] * (1 - f[None, :]) + lattice[i[:, None] % period, (i[None, :] + 1) % period] * f[None, :]
    bottom = lattice[(i[:, None] + 1) % period, i[None, :] % period] * (1 - f[None, :]) + lattice[(i[:, None] + 1) % period, (i[None, :] + 1) % period] * f[None, :]
    return top * (1 - f[:, None]) + bottom * f[:, None]

def draw_wrapped(draw, points, color, width=1, polygon=False):
    for dy in (-SIZE, 0, SIZE):
        for dx in (-SIZE, 0, SIZE):
            pts = [(x + dx, y + dy) for x, y in points]
            if polygon:
                draw.polygon(pts, fill=color)
            else:
                draw.line(pts, fill=color, width=width)

def bake(kind, seed):
    rng = np.random.default_rng(seed)
    macro = noise(3, seed) - 0.5
    mid = noise(11, seed + 3) - 0.5
    fine = noise(48, seed + 7) - 0.5
    value = 128 + macro * 19 + mid * 14 + fine * 2.4
    # Material-specific authored directional structure, not white noise.
    yy, xx = np.mgrid[:SIZE, :SIZE]
    if kind == 'sand':
        value += np.sin((yy + noise(4, seed + 11) * 27) / SIZE * math.tau * 10) * 2.6
    if kind == 'paving':
        row_x = (xx + (yy // 128 % 2) * 64) % 128
        joint = (np.minimum(row_x, 128 - row_x) < 2) | (np.minimum(yy % 128, 128 - yy % 128) < 2)
        value -= joint * 12
    if kind == 'mud':
        value += np.maximum(0, noise(5, seed + 13) - 0.54) * 45
    image = Image.fromarray(np.clip(np.repeat(value[:, :, None], 3, axis=2), 0, 255).astype(np.uint8), 'RGB')
    draw = ImageDraw.Draw(image)
    count = {'grass': 46, 'earth': 26, 'gravel': 100, 'sand': 12, 'stone': 25, 'mud': 19, 'paving': 13, 'asphalt': 14, 'litter': 65, 'needles': 85}[kind]
    for _ in range(count):
        x, y = rng.uniform(0, SIZE, 2)
        angle = rng.uniform(0, math.tau)
        length = rng.uniform(5, 15)
        if kind == 'grass':
            # Three curved blades per tuft with offset low shadow and lit edge.
            for blade in range(3):
                spread = (blade - 1) * 3
                pts = [(x + spread, y), (x + spread + math.cos(angle) * length * .35, y - length * .4), (x + spread + math.cos(angle) * length, y - length)]
                draw_wrapped(draw, [(px + 2, py + 2) for px, py in pts], (111, 111, 111), 2)
                draw_wrapped(draw, pts, (145, 147, 141), 1)
        elif kind == 'litter':
            # Fallen broad leaves: pointed silhouettes and a central vein,
            # gathered over larger dark decomposing material islands.
            dx, dy = math.cos(angle)*length*.6, math.sin(angle)*length*.6
            sx, sy = -math.sin(angle)*3, math.cos(angle)*3
            pts = [(x-dx,y-dy),(x+sx,y+sy),(x+dx,y+dy),(x-sx,y-sy)]
            shade = int(rng.uniform(112,143))
            draw_wrapped(draw, [(px+1,py+2) for px,py in pts], (108,108,108), polygon=True)
            draw_wrapped(draw, pts, (shade,shade,shade), polygon=True)
            draw_wrapped(draw, [pts[0],pts[2]], (min(151,shade+6),)*3)
        elif kind == 'needles':
            for needle in range(3):
                a = angle + (needle-1)*.35
                pts = [(x+needle*2,y),(x+needle*2+math.cos(a)*length,y+math.sin(a)*length)]
                draw_wrapped(draw, [(px+1,py+1) for px,py in pts], (111,111,111))
                draw_wrapped(draw, pts, (139,139,139))
        elif kind in ('gravel', 'earth', 'sand', 'mud'):
            rx, ry = rng.uniform(2, 6), rng.uniform(1.5, 4)
            pts = [(x-rx, y), (x-rx*.35, y-ry), (x+rx*.6, y-ry*.65), (x+rx, y+ry*.3), (x-rx*.2, y+ry)]
            draw_wrapped(draw, [(px+1.5, py+2) for px, py in pts], (112,112,112), polygon=True)
            shade = int(rng.uniform(132, 151))
            draw_wrapped(draw, pts, (shade,shade,shade), polygon=True)
            draw_wrapped(draw, pts[:3], (min(158,shade+7),)*3)
        else:
            pts = [(x, y), (x+length*.6, y+math.sin(angle)*length*.5), (x+length, y+math.sin(angle)*length)]
            draw_wrapped(draw, pts, (111,111,111), 1)
    return image

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    means = {}
    for index, kind in enumerate(('grass','earth','gravel','sand','stone','mud','paving','asphalt','litter','needles')):
        name = 'surface-' + kind
        image = bake(kind, 22000 + index * 7919)
        arr = np.asarray(image).astype(float)
        mean = np.round(arr.mean(axis=(0,1)), 3).tolist()
        means[name] = mean
        # A quiet periodic edge profile: fringe samples share the surface pixels.
        fringe = image.crop((0,0,SIZE,128)).convert('RGBA')
        alpha = np.tile(np.clip(1-np.arange(128)/127,0,1)[:,None] ** 1.6, (1,SIZE))
        fringe.putalpha(Image.fromarray(np.round(alpha*255).astype(np.uint8)))
        assets = []
        for suffix, im in (('',image),('-fringe',fringe)):
            for half in (False,True):
                file = name + suffix + ('@0.5x.webp' if half else '.png')
                target = im.resize((im.width//2,im.height//2),Image.Resampling.LANCZOS) if half else im
                if half:
                    target.save(OUT/file, 'WEBP', quality=90, method=6)
                else:
                    target.save(OUT/file, 'PNG', optimize=True)
                data = (OUT/file).read_bytes()
                assets.append({'file':file,'width':target.width,'height':target.height,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        luma = arr.mean(axis=2)
        rows.append({'id':name,'mean':mean,'assets':assets,'metrics':{'neighborLumaDelta':round(float((np.abs(np.diff(luma,axis=0)).mean()+np.abs(np.diff(luma,axis=1)).mean())/2),4),'wrapLumaDelta':round(float((np.abs(luma[:,0]-luma[:,-1]).mean()+np.abs(luma[0]-luma[-1]).mean())/2),4),'lumaRange':round(float(luma.max()-luma.min()),2)}})
    manifest = {'pipeline':'hmh-world-v2-authored-surfaces/v1','authority':'presentation-only','size':SIZE,'materials':rows,'encodedBytes':sum(a['bytes'] for r in rows for a in r['assets'])}
    (OUT/'world-v2-surfaces.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    module = '// Generated by scripts/build-hmh-world-v2-surfaces.py; measured runtime tile means.\nexport const SURFACE_TILE_MEANS = Object.freeze('+json.dumps(means,indent=2)+');\n'
    (ROOT/'apps/hmh-reboot/src/world-v2-surface-materials.mjs').write_text(module,encoding='utf-8')
    print(json.dumps({'materials':len(rows),'encodedBytes':manifest['encodedBytes'],'maxNeighborDelta':max(r['metrics']['neighborLumaDelta'] for r in rows)}))

if __name__ == '__main__':
    main()
