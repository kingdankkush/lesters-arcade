"""Review plates for the Chikun scenery: composite each region at the four light
keys (noon, golden hour, night, dawn) the way the runtime does, without a browser.

    python scripts/build-chikun-review-plates.py [--regions farmland,forest] [--distance 3000]

Uses the shipped T1 WebP layers, the catalog geometry and the runtime light rig
(scripts/lib/chikun-rig-dump.mjs prints computeLightRig() for each key), then:
sky gradient, stars, sun or moon, procedural clouds, ground bands and strips with
per-depth fog, the time-of-day grade, lit windows, the running line's cut face,
the 1.8.2 obstacle sprites for scale, and Chikun. Each obstacle's luminance
contrast against a 12 px ring around it is measured (target >= 3:1).

Full plates go to the render cache (outside the repository); a small contact
sheet per region and plates.json with the contrast receipts go to docs/chikun/review/.
"""
import argparse, json, math, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'apps/portal/assets/generated/chikun-scenery-v2'
PROPS = ROOT / 'apps/portal/assets/generated/chikun-ground-props-v1'
CHIKUN = ROOT / 'apps/portal/assets/generated/chikun-ground-motion-v1/run.webp'
REVIEW = ROOT / 'docs/chikun/review'
CACHE = ROOT.parent / 'chikun-render-cache' / 'plates'
KEYS = ['noon', 'golden', 'night', 'dawn']
BACK_TOP, BACK_BOTTOM = 280, 694


def catalog():
    text = (ROOT / 'apps/chikun/src/scenery-catalog.mjs').read_text(encoding='utf8')
    start = text.index('const CATALOG = ') + len('const CATALOG = ')
    return json.loads(text[start:text.index(';\n', start)])


def rigs():
    out = subprocess.run(['node', str(ROOT / 'scripts/lib/chikun-rig-dump.mjs')], capture_output=True, text=True, check=True, cwd=ROOT)
    return json.loads(out.stdout)


def img(path):
    return np.asarray(Image.open(path).convert('RGBA'), dtype=np.float64) / 255.0


def premul(a):
    out = a.copy(); out[..., :3] *= out[..., 3:4]; return out


def over(dst, src, x, y, alpha=1.0):
    """Premultiplied source-over of src at integer (x, y)."""
    H, W = dst.shape[:2]; h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x] * alpha
    d = dst[y0:y1, x0:x1]
    d[...] = s + d * (1 - s[..., 3:4])


def add(dst, src, x, y, alpha=1.0):
    H, W = dst.shape[:2]; h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x] * alpha
    dst[y0:y1, x0:x1, :3] = np.minimum(1.0, dst[y0:y1, x0:x1, :3] + s[..., :3])


def periodic(dst, src, scroll, y, alpha=1.0):
    period = src.shape[1]
    x = -int(round(scroll % period))
    while x < dst.shape[1]:
        over(dst, src, x, y, alpha); x += period


def atop(dst, colour, alpha):
    """'source-atop' fill of a solid colour on a premultiplied canvas."""
    if alpha <= 0.002: return
    c = np.array(colour, dtype=np.float64) / 255.0
    a = dst[..., 3:4]
    dst[..., :3] = dst[..., :3] * (1 - alpha) + c * alpha * a


def radial(size, stops):
    r = size / 2
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.sqrt((xx + 0.5 - r) ** 2 + (yy + 0.5 - r) ** 2) / r
    out = np.zeros((size, size, 4))
    for (o0, c0), (o1, c1) in zip(stops, stops[1:]):
        m = (d >= o0) & (d <= o1)
        t = ((d - o0) / max(1e-6, o1 - o0))[m][:, None]
        out[m] = np.array(c0) * (1 - t) + np.array(c1) * t
    out[..., :3] = out[..., :3] / 255.0
    return premul(out)


def sky(width, rig):
    H = 720
    stops = [(0, rig['skyTop']), (0.5, [(a + b) / 2 for a, b in zip(rig['skyTop'], rig['horizon'])]), (0.72, rig['horizon']), (1, rig['skyBottom'])]
    ys = np.arange(H) / 720.0
    col = np.zeros((H, 3))
    for (o0, c0), (o1, c1) in zip(stops, stops[1:]):
        m = (ys >= o0) & (ys <= o1); t = ((ys - o0) / (o1 - o0))[m][:, None]
        col[m] = (np.array(c0) * (1 - t) + np.array(c1) * t) / 255.0
    out = np.ones((H, width, 4)); out[..., :3] = col[:, None, :]
    return out


def hash01(n):
    x = ((n + 17) * 2654435761) & 0xffffffff
    x ^= x >> 13
    return ((x * 2246822519) & 0xffffffff) / 4294967296


def cloud_sprite(i):
    """Numpy take on atmosphere.mjs cloudSprite (grey-lit cumulus)."""
    far = i < 5
    w = int(190 + hash01(i + 5) * 120) if far else int(300 + hash01(i + 9) * 170)
    h = int(62 + hash01(i + 6) * 26) if far else int(96 + hash01(i + 10) * 40)
    seed = 31 + i * 7
    base = h * 0.78; n = 12 + int(hash01(seed) * 8)
    yy, xx = np.mgrid[0:h, 0:w]
    body = np.zeros((h, w)); light = np.zeros((h, w))
    for k in range(n):
        t = (k + 0.5) / n; bell = math.sin(math.pi * t)
        r = h * (0.16 + 0.26 * bell * (0.6 + 0.4 * hash01(seed + k)))
        px = w * (0.08 + 0.84 * t) + (hash01(seed + k + 40) - 0.5) * w * 0.06
        py = base - r * (0.35 + 0.55 * bell * hash01(seed + k + 80))
        d = np.sqrt((xx - px) ** 2 + (yy - py) ** 2) / r
        a = np.clip(np.where(d < 0.72, 1.0, (1 - d) / 0.28), 0, 1)
        body = body + a * (1 - body)
        dl = np.sqrt((xx - (px - r * 0.28)) ** 2 + (yy - (py - r * 0.34)) ** 2) / (r * 0.95)
        l = np.clip(np.where(dl < 0.6, 0.98 - dl * 0.38, 0.75 * (1 - dl) / 0.4), 0, 1)
        light = light + l * (1 - light)
    fade = np.clip(1 - (yy - (base - h * 0.05)) / (h - base + h * 0.05), 0, 1)
    body *= fade
    grey = np.array([150, 160, 178]) / 255.0; white = np.array([1.0, 1.0, 1.0])
    rgb = grey * (1 - light[..., None]) + white * light[..., None]
    out = np.concatenate([rgb * body[..., None], body[..., None]], -1)
    return out, dict(y=(70 + hash01(i + 7) * 190) if far else (150 + hash01(i + 11) * 170), rate=0.01 if far else 0.03, offset=hash01(i + 13) * 2400, alpha=0.78 if far else 0.92)


CLOUDS = [cloud_sprite(i) for i in range(9)]


def grade_sprite(s, rig, wk=2.4, ak=1.15):
    out = s.copy()
    g = rig['grade']
    atop(out, g['W'], min(0.6, g['w'] * wk)); atop(out, g['D'], min(0.75, g['a'] * ak))
    return out


def load_region(cat, region):
    reg = cat['regions'][region]
    layers = {}
    for name, layer in reg['layers'].items():
        t = layer['tiers']['t1']
        layers[name] = dict(meta=layer, img=premul(img(ART / t['src'])))
        if layer.get('emit'):
            e = layer['emit']
            layers[name]['emit'] = dict(chunks=e['chunks'], img=premul(img(ART / e['tiers']['t1']['src'])))
    ground = None
    if reg.get('ground'):
        g = reg['ground']; t = g['tiers']['t1']; atlas = premul(img(ART / t['src']))
        bands = []
        for (y0, y1, rate), (ax, ay, aw, ah) in zip(g['bands'], t['rects']):
            bands.append(dict(y0=y0, y1=y1, rate=rate, img=atlas[ay:ay + ah - 1, ax:ax + aw]))
        ground = bands
    return layers, ground


def emit_layer(dst, layer, scroll, top, alpha):
    e = layer.get('emit')
    if not e or alpha <= 0.01: return
    period = layer['img'].shape[1]
    for u, y, w, h, ax, ay in e['chunks']:
        piece = e['img'][ay:ay + h, ax:ax + w]
        x = u - int(round(scroll % period))
        while x + w > 0: x -= period
        x += period
        while x < dst.shape[1]:
            add(dst, piece, x, top + y, alpha); x += period


def plate(region, layers, ground, rig, D, width, props, chikun):
    left = rig['view']['left']
    canvas = sky(width, rig)
    # Stars, moon, sun.
    if rig['stars'] > 0.02:
        rng = np.random.default_rng(811)
        n = int(width * 430 / 5200)
        for _ in range(n):
            x, y, b = rng.random() * width, rng.random() * 430 * (0.35 + 0.65 * rng.random()), rng.random()
            add(canvas, np.array([[[0.9, 0.95, 1.0, 1.0]]]) * (0.35 + 0.6 * b), int(x), int(y), rig['stars'])
    if rig['moon']['alpha'] > 0.01:
        mx, my = rig['moon']['x'] - left, rig['moon']['y']
        over(canvas, radial(380, [(0, [170, 205, 235, .3]), (0.3, [140, 180, 220, .12]), (1, [120, 160, 210, 0])]), int(mx - 190), int(my - 190), rig['moon']['alpha'])
        over(canvas, radial(52, [(0, [246, 248, 242, 1]), (0.7, [223, 230, 228, 1]), (0.97, [184, 198, 201, 1]), (1, [184, 198, 201, 0])]), int(mx - 26), int(my - 26), rig['moon']['alpha'])
    if rig['sun']['alpha'] > 0.01:
        sx, sy = rig['sun']['x'] - left, rig['sun']['y']
        warm = min(1.0, rig['dusk'] * 1.4)
        over(canvas, radial(480, [(0, [255, 236, 196, .55]), (0.18, [255, 220, 168, .32]), (0.5, [255, 206, 150, .10]), (1, [255, 200, 140, 0])]), int(sx - 240), int(sy - 240), rig['sun']['alpha'] * (1 - 0.6 * warm))
        if warm > 0.01: over(canvas, radial(600, [(0, [255, 170, 96, .6]), (0.25, [255, 140, 80, .28]), (0.6, [240, 110, 80, .08]), (1, [230, 100, 80, 0])]), int(sx - 300), int(sy - 300), rig['sun']['alpha'] * warm)
        over(canvas, radial(80, [(0, [255, 253, 240, 1]), (0.78, [255, 246, 214, 1]), (0.86, [255, 236, 190, .5]), (1, [255, 230, 180, 0])]), int(sx - 40), int(sy - 40), rig['sun']['alpha'])
    span = max(2400, width + 700)
    for s, c in CLOUDS:
        u = (c['offset'] - 20 * 5 - D * c['rate']) % span - 350
        over(canvas, grade_sprite(s, rig), int(u), int(c['y']), c['alpha'])
    # Backdrop.
    back = np.zeros((BACK_BOTTOM - BACK_TOP, width, 4))
    fog = rig['fog']; fogc = rig['fogColor']
    edges = [b['y0'] for b in ground] + [ground[-1]['y1']] if ground else []
    bi = 0

    def draw_bands(upto):
        nonlocal bi
        while bi < len(ground) and ground[bi]['y0'] < upto:
            b = ground[bi]
            tile = b['img']
            scroll = D * b['rate'] + left
            periodic(back, tile, scroll, b['y0'] - BACK_TOP)
            bi += 1

    emits = []
    for name in ('far', 'mid', 'near'):
        L = layers.get(name)
        if not L: continue
        m = L['meta']
        if ground: draw_bands(m['baseline'])
        scroll = D * m['rate'] + left
        periodic(back, L['img'], scroll, m['top'] - BACK_TOP)
        emits.append((L, scroll, m['top'], name))
        atop(back, fogc, fog[name])
    if ground: draw_bands(10_000)
    g = rig['grade']
    atop(back, g['W'], g['w']); atop(back, g['D'], g['a'])
    over(canvas, back, 0, BACK_TOP)
    for L, scroll, top, name in emits:
        left_fog = {'far': 1 - fog['far'] - fog['mid'], 'mid': 1 - fog['mid'] - fog['near'] * 0.5, 'near': 1 - fog['near']}[name]
        emit_layer(canvas, L, scroll, top, rig['lightsOn'] * max(0.2, left_fog) * {'far': 0.6, 'mid': 0.8, 'near': 1.0}[name])
    # Front face.
    if 'front' in layers:
        F = layers['front']
        periodic(canvas, F['img'], D + left, F['meta']['top'])
        strip = canvas[690:]
        a = np.ones_like(strip[..., 3:4])
        strip[..., :3] = strip[..., :3] * (1 - g['w'] * .85) + np.array(g['W']) / 255 * g['w'] * .85
        strip[..., :3] = strip[..., :3] * (1 - g['a'] * .85) + np.array(g['D']) / 255 * g['a'] * .85
    receipts = []
    for name, sprite, x, y in props:
        xs = int(x - left)
        receipts.append(dict(prop=name, contrast=contrast(canvas, sprite, xs, y)))
        over(canvas, sprite, xs, y)
    over(canvas, chikun, int(280 - left - 75), 690 - 150 + 22)
    return canvas, receipts


def luminance(rgb):
    c = np.where(rgb <= 0.03928, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def contrast(canvas, sprite, x, y):
    H, W = canvas.shape[:2]; h, w = sprite.shape[:2]
    mask = np.zeros((H, W), bool)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return None
    mask[y0:y1, x0:x1] = sprite[y0 - y:y1 - y, x0 - x:x1 - x, 3] > 0.5
    if not mask.any(): return None
    ring = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(25))) > 0
    ring &= ~mask
    s = sprite[..., :3] / np.maximum(sprite[..., 3:4], 1e-4)
    fg = luminance(s[sprite[..., 3] > 0.5]).mean()
    bg = luminance(canvas[..., :3][ring]).mean()
    hi, lo = max(fg, bg), min(fg, bg)
    return round(float((hi + 0.05) / (lo + 0.05)), 2)


def prop_sprites():
    def load(name, height):
        im = Image.open(PROPS / f'{name}.webp').convert('RGBA')
        w = max(1, round(im.width * height / im.height))
        return premul(np.asarray(im.resize((w, height), Image.LANCZOS), dtype=np.float64) / 255.0)
    return [('oak', load('oak', 230), 700, 690 - 230), ('rock', load('rock', 58), 520, 690 - 58), ('crate', load('crate', 70), 980, 690 - 70), ('hawk', load('hawk', 40), 860, 300)]


def chikun_sprite():
    im = Image.open(CHIKUN).convert('RGBA').crop((0, 0, 192, 192)).resize((150, 150), Image.LANCZOS)
    return premul(np.asarray(im, dtype=np.float64) / 255.0)


def to_image(canvas):
    rgb = canvas[..., :3] + (1 - canvas[..., 3:4]) * 0
    return Image.fromarray(np.clip(np.round(rgb * 255), 0, 255).astype(np.uint8), 'RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--regions', default='')
    ap.add_argument('--distance', type=float, default=3000.0)
    a = ap.parse_args()
    cat = catalog(); R = rigs()
    props = prop_sprites(); chikun = chikun_sprite()
    CACHE.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)
    receipts_path = REVIEW / 'plates.json'
    receipts = json.loads(receipts_path.read_text(encoding='utf8')) if receipts_path.exists() else {}
    regions = [r for r in (a.regions.split(',') if a.regions else cat['regions'].keys()) if r in cat['regions']]
    for region in regions:
        layers, ground = load_region(cat, region)
        sheet = Image.new('RGB', (1280, 720 + 360), (12, 18, 26))
        receipts[region] = {}
        for i, key in enumerate(KEYS):
            land, rec = plate(region, layers, ground, R[region][key]['landscape'], a.distance, 1280, props, chikun)
            port, _ = plate(region, layers, ground, R[region][key]['portrait'], a.distance, 405, [], chikun)
            li, pi = to_image(land), to_image(port)
            li.save(CACHE / f'{region}-{key}-landscape.png'); pi.save(CACHE / f'{region}-{key}-portrait.png')
            sheet.paste(li.resize((640, 360), Image.LANCZOS), ((i % 2) * 640, (i // 2) * 360))
            sheet.paste(pi.resize((202, 360), Image.LANCZOS), (i * 212 + 214, 720))
            receipts[region][key] = rec
        sheet.save(REVIEW / f'{region}.webp', quality=74, method=6)
        print(region, json.dumps(receipts[region]))
    receipts_path.write_text(json.dumps(receipts, indent=1) + '\n', encoding='utf8', newline='\n')


if __name__ == '__main__':
    main()
