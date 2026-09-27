"""Review plates for the Chikun obstacle art, without a browser.

    python scripts/build-chikun-obstacle-review.py [--regions farmland,city] [--distance 3000]

For each region: the region's backdrop at the four light keys (noon, golden
hour, night, dawn; composited by scripts/build-chikun-review-plates.py with the
runtime light rig), then every obstacle kind the region can spawn, laid out by
the runtime's own layoutObstacleArt() (scripts/chikun-blender/chikun-obstacle-layout-dump.mjs)
from the shipped t1 sprites: sprites graded at gameplay strength (0.72),
building facades graded over their collision rects, lights added at
night, collision outlines optional (--hitbox), each draw with the runtime's value
separation (obstacle-separation.mjs, from the layout dump). Each obstacle's
luminance contrast against a 12 px ring of the backdrop around it is measured;
flyers, which cross the whole view, at seven positions along their row (the
median is the receipt, the worst position is kept as bodyMin). Targets
(obstacle-contrast slice): median >= 3:1 at noon with no kind below 2.2:1,
median >= 2.5:1 at night; scripts/chikun-obstacle-contrast-summary.py checks them.

Full plates go to the render cache; a contact sheet per region (noon and
night) and obstacles.json with the contrast receipts go to docs/chikun/review/.
"""
import argparse, importlib.util, json, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('plates', ROOT / 'scripts/build-chikun-review-plates.py')
plates = importlib.util.module_from_spec(spec); spec.loader.exec_module(plates)
ART = ROOT / 'apps/portal/assets/generated/chikun-obstacles-v2'
REVIEW = ROOT / 'docs/chikun/review'
CACHE = ROOT.parent / 'chikun-render-cache' / 'plates'
STRENGTH = 0.72


def catalog():
    text = (ROOT / 'apps/chikun/src/obstacle-catalog.mjs').read_text(encoding='utf8')
    start = text.index('const CATALOG = ') + len('const CATALOG = ')
    return json.loads(text[start:text.index(';\n', start)])


def layouts():
    out = subprocess.run(['node', str(ROOT / 'scripts/chikun-blender/chikun-obstacle-layout-dump.mjs')], capture_output=True, text=True, check=True, cwd=ROOT)
    return json.loads(out.stdout)


class Sprites:
    def __init__(self, cat):
        self.desc, self.cache = {}, {}
        for kit in cat['kits'].values():
            for name, sp in kit['sprites'].items(): self.desc[name] = sp

    def strip(self, name, emit=False):
        key = (name, emit)
        if key not in self.cache:
            sp = self.desc[name]
            src = sp['emit']['src'] if emit else sp['tiers']['t1']['src']
            self.cache[key] = plates.premul(plates.img(ART / src))
        return self.cache[key]


def grade_premul(piece, g, s):
    out = piece.copy()
    a = out[..., 3:4]
    w, al = g['w'] * s, g['a'] * s
    out[..., :3] = out[..., :3] * (1 - w) + np.array(g['W']) / 255 * w * a
    out[..., :3] = out[..., :3] * (1 - al) + np.array(g['D']) / 255 * al * a
    return out


def separate_premul(piece, sep):
    """The runtime's value separation on a graded copy (obstacle-art.mjs
    gradedCanvas): a source-atop fill of the deep colour (deepen), then the
    copy added onto itself ('lighter' at the exposure alpha, clamped per
    channel) and a source-atop wash of the key colour (lift)."""
    mode, colour, exposure, wash, deepen, deep = sep[0], sep[2], sep[4], sep[5], sep[6], sep[7]
    if mode == 'none': return piece
    out = piece.copy()
    if deepen > 0: out[..., :3] = out[..., :3] * (1 - deepen) + np.array(deep) / 255 * deepen * out[..., 3:4]
    if exposure > 0: out = np.minimum(1.0, out * (1 + exposure))
    if wash > 0: out[..., :3] = out[..., :3] * (1 - wash) + np.array(colour) / 255 * wash * out[..., 3:4]
    return out


def draw(canvas, ob, S, rig, left, key):
    g = rig['grade']
    rect = ob['kind'] == 'town'
    H, W = canvas.shape[:2]
    before = canvas.copy()
    mask = np.zeros((H, W), bool)
    for p in ob['ops']:
        sp = S.desc[p['name']]
        strip = S.strip(p['name'])
        f0 = p['frame'] * (sp['w'] + sp['gap'])
        y0, y1, x0, x1 = int(round(p['sy0'])), int(round(p['sy1'])), int(round(p['sx0'])), int(round(p['sx1']))
        piece = strip[y0:y1, f0 + x0:f0 + x1]
        if not (rect and p['name'].startswith('facade-')): piece = separate_premul(grade_premul(piece, g, STRENGTH), p['sep'][key])
        X, Y = int(round(p['x'] + x0 - left)), int(round(p['y'] + y0))
        plates.over(canvas, piece, X, Y)
        cx0, cy0 = max(0, X), max(0, Y); cx1, cy1 = min(W, X + piece.shape[1]), min(H, Y + piece.shape[0])
        if cx1 > cx0 and cy1 > cy0: mask[cy0:cy1, cx0:cx1] |= piece[cy0 - Y:cy1 - Y, cx0 - X:cx1 - X, 3] > 0.5
    if rect:
        facades = [p['sep'][key] for p in ob['ops'] if p['name'].startswith('facade-')]
        for i, (x, y, w, h) in enumerate(ob['tint']):
            X0, Y0 = int(round(x - left)), int(round(max(0, y))); X1, Y1 = int(round(x + w - left)), int(round(y + h))
            reg = canvas[max(0, Y0):min(H, Y1), max(0, X0):min(W, X1)]
            reg[..., :3] = reg[..., :3] * (1 - g['w'] * STRENGTH) + np.array(g['W']) / 255 * g['w'] * STRENGTH
            reg[..., :3] = reg[..., :3] * (1 - g['a'] * STRENGTH) + np.array(g['D']) / 255 * g['a'] * STRENGTH
            if i < len(facades) and facades[i][0] != 'none':
                f = facades[i]
                if f[6] > 0: reg[..., :3] = reg[..., :3] * (1 - f[6]) + np.array(f[7]) / 255 * f[6]
                if f[2] and f[5] > 0: reg[..., :3] = reg[..., :3] * (1 - f[5]) + np.array(f[2]) / 255 * f[5]
    if rig['lightsOn'] > 0.01:
        for p in ob['ops']:
            sp = S.desc[p['name']]
            if 'emit' not in sp: continue
            e = S.strip(p['name'], emit=True)
            f0 = p['frame'] * (sp['w'] + sp['gap'])
            y0, y1, x0, x1 = int(round(p['sy0'])), int(round(p['sy1'])), int(round(p['sx0'])), int(round(p['sx1']))
            plates.add(canvas, e[y0:y1, f0 + x0:f0 + x1], int(round(p['x'] + x0 - left)), int(round(p['y'] + y0)), min(1.0, rig['lightsOn']))
    return contrast(before, canvas, mask)


FLYERS = {'drone', 'plane', 'hawk', 'eagle', 'pelican'}
SWEEP = 7


def sweep(canvas, clean, ob, S, rig, key, width):
    """Flyers cross the whole view, so one position is luck: measure the flyer
    at SWEEP positions along its row, each over a copy of the bare backdrop
    (not over the lineup's other obstacles), and report the median, the worst
    position and the plate's own position (drawn into the plate)."""
    left = rig['view']['left']
    runs = []
    for x in np.linspace(160, width - 160 - ob['width'], SWEEP):
        runs.append(draw(clean.copy(), ob, S, rig, left - (x - ob['x']), key))
    placed = draw(canvas, ob, S, rig, left, key)
    runs = [r for r in runs if r]
    bodies = sorted(r['body'] for r in runs)
    mid = runs[[r['body'] for r in runs].index(bodies[len(bodies) // 2])]
    return dict(body=mid['body'], edge=mid['edge'], L=mid['L'], bodyMin=bodies[0], sweep=[r['body'] for r in runs], placed=placed['body'] if placed else None)


def ratio(a, b):
    hi, lo = max(a, b), min(a, b)
    return round(float((hi + 0.05) / (lo + 0.05)), 2)


def contrast(before, after, mask):
    """body: mean luminance of the obstacle vs a 12 px ring of the backdrop
    (the plan's metric); edge: the silhouette's 2 px inner band (the ink
    contour) vs the 3 px of backdrop just outside it."""
    if not mask.any(): return None
    ys, xs = np.nonzero(mask)
    y0, y1 = max(0, ys.min() - 16), min(mask.shape[0], ys.max() + 17)
    x0, x1 = max(0, xs.min() - 16), min(mask.shape[1], xs.max() + 17)
    mask, before, after = mask[y0:y1, x0:x1], before[y0:y1, x0:x1], after[y0:y1, x0:x1]
    m8 = Image.fromarray(mask.astype(np.uint8) * 255)
    ring = (np.asarray(m8.filter(ImageFilter.MaxFilter(25))) > 0) & ~mask
    outer = (np.asarray(m8.filter(ImageFilter.MaxFilter(7))) > 0) & ~mask
    inner = mask & ~(np.asarray(m8.filter(ImageFilter.MinFilter(5))) > 0)
    L0, L1 = plates.luminance(before[..., :3]), plates.luminance(after[..., :3])
    return dict(body=ratio(L1[mask].mean(), L0[ring].mean()), edge=ratio(L1[inner].mean(), L0[outer].mean()),
                L=[round(float(L1[mask].mean()), 3), round(float(L0[ring].mean()), 3)])


def outline(im, ob, left):
    d = ImageDraw.Draw(im)
    for s in ob['shapes']:
        if s['type'] == 'rect': d.rectangle([s['x'] - left, s['y'], s['x'] + s['width'] - left, s['y'] + s['height']], outline=(255, 40, 80))
        elif s['type'] == 'circle': d.ellipse([s['x'] - s['radius'] - left, s['y'] - s['radius'], s['x'] + s['radius'] - left, s['y'] + s['radius']], outline=(255, 40, 80))
        else:
            r = s['radius']
            d.rounded_rectangle([min(s['ax'], s['bx']) - r - left, min(s['ay'], s['by']) - r, max(s['ax'], s['bx']) + r - left, max(s['ay'], s['by']) + r], radius=r, outline=(255, 40, 80))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--regions', default='')
    ap.add_argument('--distance', type=float, default=3000.0)
    ap.add_argument('--hitbox', action='store_true')
    ap.add_argument('--no-separation', action='store_true', help='composite without the value separation (comparison only; writes obstacles-no-separation.json to the render cache)')
    a = ap.parse_args()
    cat, scen, R, L = catalog(), plates.catalog(), plates.rigs(), layouts()
    if a.no_separation:
        for lay in L.values():
            for ob in lay['obstacles']:
                for op in ob['ops']: op['sep'] = {k: ['none', 0, None, 1, 0, 0, 0, [0, 0, 0]] for k in op['sep']}
    S = Sprites(cat)
    chikun = plates.chikun_sprite()
    CACHE.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)
    path = (CACHE / 'obstacles-no-separation.json') if a.no_separation else (REVIEW / 'obstacles.json')
    receipts = json.loads(path.read_text(encoding='utf8')) if path.exists() else {}
    regions = [r for r in (a.regions.split(',') if a.regions else L.keys())]
    for region in regions:
        lay = L[region]; width = lay['width']
        layers, ground = plates.load_region(scen, region)
        rows = []
        receipts[region] = {}
        for key in plates.KEYS:
            rig = R[region][key]['landscape']
            canvas, _ = plates.plate(region, layers, ground, rig, a.distance, width, [], chikun)
            rec = {}
            clean = canvas.copy()
            for ob in lay['obstacles']:
                c = sweep(canvas, clean, ob, S, rig, key, width) if ob['kind'] in FLYERS else draw(canvas, ob, S, rig, rig['view']['left'], key)
                name = ob['kind'] if ob['kind'] not in ('tree', 'town') else ob['variant']
                rec[name] = c
            im = plates.to_image(canvas)
            if a.hitbox:
                for ob in lay['obstacles']: outline(im, ob, rig['view']['left'])
            im.save(CACHE / f"obstacles-{region}-{key}{'-nosep' if a.no_separation else ''}.png")
            rows.append(im)
            receipts[region][key] = rec
            print(region, key, json.dumps(rec))
        # contact sheet: noon and night (golden hour and dawn plates stay in the cache)
        sw = 1280
        keep = [rows[plates.KEYS.index('noon')], rows[plates.KEYS.index('night')]]
        sheet = Image.new('RGB', (sw, sum(int(r.height * sw / r.width) for r in keep)), (12, 18, 26))
        y = 0
        for r in keep:
            h = int(r.height * sw / r.width)
            sheet.paste(r.resize((sw, h), Image.LANCZOS), (0, y)); y += h
        if not a.no_separation: sheet.save(REVIEW / f'obstacles-{region}.webp', quality=70, method=6)
    path.write_text(json.dumps(receipts, indent=1) + '\n', encoding='utf8', newline='\n')


if __name__ == '__main__':
    main()
