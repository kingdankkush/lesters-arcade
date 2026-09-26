"""Pack the Chikun obstacle renders into shipped WebP strips, a manifest, the
runtime catalog and the coverage masks.

    python scripts/build-chikun-obstacle-pack.py [--cache ../chikun-render-cache/obstacles]

Reads the Blender render cache (scripts/chikun-blender/build-chikun-obstacles.py)
and, per sprite:
  * adds a 1 px ink contour (2 px at t2) around gameplay silhouettes, coloured
    from the sprite's own darkened edge colour, so obstacles separate from any
    backdrop (skipped for the storm, pits, forest wall, water sheets);
  * trims the union of all frames to the opaque bounds (even t2 pixels, so the
    logical frame stays on whole pixels and t1 halves exactly);
  * lays animation frames side by side with a transparent gap, bleeds colour
    into transparent pixels, derives t1 in premultiplied space, encodes WebP;
  * packs the emission pass (lit windows, LEDs, lamps) as a t1 light strip;
  * writes a coverage mask per frame on a 2 logical px grid (a cell is art
    when its mean alpha is >= 0.5) to tests/chikun-obstacle-masks.json, which
    tests/chikun-obstacle-art.test.mjs uses to prove the art covers the
    collision shapes it was built for (not shipped to players).
Outputs: apps/portal/assets/generated/chikun-obstacles-v2/{<kit>/{t1,t2}/*.webp,
manifest.json}, apps/chikun/src/obstacle-catalog.mjs and the masks.
"""
import argparse, base64, hashlib, io, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/portal/assets/generated/chikun-obstacles-v2'
CATALOG = ROOT / 'apps/chikun/src/obstacle-catalog.mjs'
MASKS = ROOT / 'tests/chikun-obstacle-masks.json'
MASK_CELL = 2     # logical px per mask cell
KITS = ['common', 'farmland', 'forest', 'town', 'city', 'industrial', 'suburbs', 'coast']
NO_CONTOUR_PREFIX = ('storm', 'pit-', 'forest-', 'waterfall-sheet-')
GAP = 2          # logical px between animation frames
QUALITY = 86
# Large rect-filling sprites compress harder (their detail is foliage and cloud texture).
QUALITY_BY = {'storm': 72, 'canopy-forest': 38, 'canopy-scaffold': 72, 'canopy-rack': 72, 'forest-column-a': 58, 'forest-column-b': 58, 'forest-base': 70,
              'waterfall-mossy': 80, 'waterfall-basalt': 80, 'shiba': 80, 'crown-oak': 80, 'crown-maple': 80, 'crown-cherry': 80, 'crown-willow': 80,
              'bird-hawk': 82, 'bird-eagle': 82, 'bird-pelican': 82}
LEGACY = ROOT / 'apps/portal/assets/generated/chikun-open-air-v1'


def load(path):
    im = Image.open(path)
    a = np.asarray(im, dtype=np.float64)
    a = a / (65535.0 if a.max() > 255 else 255.0)
    if a.shape[-1] == 3:
        a = np.concatenate([a, np.ones(a.shape[:2] + (1,))], -1)
    return a


def to_image(rgba):
    return Image.fromarray(np.clip(np.round(rgba * 255), 0, 255).astype(np.uint8), 'RGBA')


def downsample(rgba, size):
    pm = rgba.copy(); pm[..., :3] *= pm[..., 3:4]
    chans = [np.asarray(Image.fromarray((pm[..., i] * 65535).astype(np.float32), 'F').resize(size, Image.LANCZOS)) / 65535 for i in range(4)]
    out = np.clip(np.stack(chans, -1), 0, 1)
    a = out[..., 3:4]
    out[..., :3] = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0)
    return np.clip(out, 0, 1)


def sharpen(rgba, amount=0.3):
    im = to_image(rgba)
    rgb = im.convert('RGB').filter(ImageFilter.UnsharpMask(radius=0.7, percent=int(amount * 100), threshold=1))
    return np.concatenate([np.asarray(rgb, dtype=np.float64) / 255.0, rgba[..., 3:4]], -1)


def bleed(rgba, iterations=8):
    out = rgba.copy()
    known = out[..., 3] > 0.02
    for _ in range(iterations):
        if known.all(): break
        acc = np.zeros(out.shape[:2] + (3,)); cnt = np.zeros(out.shape[:2])
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(np.roll(out[..., :3], dy, 0), dx, 1); k = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += sh * k[..., None]; cnt += k
        grow = (~known) & (cnt > 0)
        out[grow, :3] = acc[grow] / cnt[grow][:, None]
        known = known | grow
    return out


def box_blur(x, r):
    """Separable box blur of radius r (edge-clamped), float in, float out."""
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]; pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(x, pad, mode='edge'), axis=axis)
        hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
        lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
        x = (hi - lo) / (2 * r + 1)
    return x


def contour(rgba, radius=2, strength=0.9, darken=0.3):
    """Ink outline: dilate the silhouette by `radius` px and fill the ring with
    the sprite's own edge colour, darkened; the sprite is composited on top."""
    a = rgba[..., 3]
    ai = Image.fromarray((a * 255).astype(np.uint8), 'L')
    dil = np.asarray(ai.filter(ImageFilter.MaxFilter(radius * 2 + 1)), dtype=np.float64) / 255.0
    pm = rgba[..., :3] * a[..., None]
    blur = lambda x: box_blur(x, radius + 1)
    s = np.stack([blur(pm[..., i]) for i in range(3)], -1)
    w = blur(a)[..., None]
    col = np.where(w > 1e-4, s / np.maximum(w, 1e-4), 0)
    lum = (col * [0.3, 0.59, 0.11]).sum(-1, keepdims=True)
    col = (col * 0.6 + lum * 0.4) * darken
    ring_a = dil * strength
    out_a = a + ring_a * (1 - a)
    out_rgb = (rgba[..., :3] * a[..., None] + col * ring_a[..., None] * (1 - a[..., None])) / np.maximum(out_a[..., None], 1e-6)
    return np.concatenate([np.clip(out_rgb, 0, 1), out_a[..., None]], -1)


def encode(rgba, path, quality=QUALITY, alpha_quality=90):
    path.parent.mkdir(parents=True, exist_ok=True)
    im = to_image(rgba)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6, alpha_quality=alpha_quality, exact=False)
    data = buf.getvalue()
    path.write_bytes(data)
    return dict(src=path.relative_to(OUT).as_posix(), w=im.width, h=im.height, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def mask_bits(alpha_logical):
    """Row-major bitset (1 = alpha >= 0.5), base64."""
    bits = (alpha_logical >= 0.5).astype(np.uint8).ravel()
    return base64.b64encode(np.packbits(bits).tobytes()).decode('ascii')


def logical_alpha(alpha_t2, cell=MASK_CELL):
    """Mean alpha per `cell` x `cell` logical px (t2 input: 2 px per logical px)."""
    k = 2 * cell
    h, w = alpha_t2.shape
    H, W = -(-h // k) * k, -(-w // k) * k
    a = np.zeros((H, W)); a[:h, :w] = alpha_t2
    return a.reshape(H // k, k, W // k, k).mean((1, 3))


def pack_sprite(meta, d):
    name, T = meta['name'], meta['tier']
    assert T == 2, 'the packer expects t2 renders'
    frames = [load(d / f'f{i:02d}.png') for i in range(meta['frames'])]
    emits = [load(d / f'f{i:02d}-emit.png') for i in range(meta['frames'])] if meta.get('emit') and (d / 'f00-emit.png').exists() else []
    if not name.startswith(NO_CONTOUR_PREFIX):
        frames = [contour(f) for f in frames]
    fx, fy, fw, fh = meta['frame']
    if meta['anchor'] == 'sheet':
        return pack_sheet(meta, frames, fw, fh)
    # a one-logical-pixel transparent margin, so snapping the crop to whole
    # logical pixels never runs off the render
    frames = [np.pad(f, ((T, T), (T, T), (0, 0))) for f in frames]
    emits = [np.pad(e, ((T, T), (T, T), (0, 0))) for e in emits]
    fx, fy = fx - 1, fy - 1
    H, W = frames[0].shape[:2]
    alpha = np.max([f[..., 3] for f in frames], axis=0)
    ys, xs = np.nonzero(alpha > 1 / 255)
    if len(xs) == 0:
        raise SystemExit(f'{name}: empty render')
    x0, x1 = max(0, xs.min() - 2), min(W, xs.max() + 3)
    y0, y1 = max(0, ys.min() - 2), min(H, ys.max() + 3)
    # frame origin in t2 px (the frame may start on a half logical pixel)
    ox, oy = -fx * T, -fy * T
    # snap the crop so its logical origin is a whole pixel
    def snap_lo(v, o): return int(np.floor((v - o) / T) * T + o) if (v - o) % T else int(v)
    def snap_hi(v, o): return int(np.ceil((v - o) / T) * T + o) if (v - o) % T else int(v)
    x0, y0 = snap_lo(x0, ox % T), snap_lo(y0, oy % T)
    x1, y1 = snap_hi(x1, ox % T), snap_hi(y1, oy % T)
    x0, y0 = max(x0, int(ox % T)), max(y0, int(oy % T))
    x1 = min(x1, W - int((W - ox % T) % T)); y1 = min(y1, H - int((H - oy % T) % T))
    frames = [f[y0:y1, x0:x1] for f in frames]
    emits = [e[y0:y1, x0:x1] for e in emits]
    lx, ly = fx + x0 / T, fy + y0 / T
    lw, lh = (x1 - x0) // T, (y1 - y0) // T
    assert abs(lx - round(lx)) < 1e-6 and abs(ly - round(ly)) < 1e-6, (name, lx, ly)
    frames = [f[:lh * T, :lw * T] for f in frames]
    emits = [e[:lh * T, :lw * T] for e in emits]
    n = len(frames)
    strip = {}
    for tier, s in (('t2', 2), ('t1', 1)):
        g = GAP * s
        img = np.zeros((lh * s, n * lw * s + (n - 1) * g, 4))
        for i, f in enumerate(frames):
            ff = f if s == 2 else sharpen(downsample(f, (lw, lh)), 0.25)
            img[:, i * (lw * s + g): i * (lw * s + g) + lw * s] = ff
        strip[tier] = encode(bleed(img), OUT / meta['kit'] / tier / f'{name}.webp', quality=QUALITY_BY.get(name, QUALITY))
    entry = dict(anchor=meta['anchor'], kind=meta['kind'], x=int(round(lx)), y=int(round(ly)), w=lw, h=lh, frames=n, fps=meta.get('fps', 0), gap=GAP, tiers=strip)
    if emits:
        lit = [np.clip(e[..., :3].max(-1), 0, 1) for e in emits]
        if max(float(l.max()) for l in lit) > 0.02:
            img = np.zeros((lh, n * lw + (n - 1) * GAP, 4))
            for i, e in enumerate(emits):
                small = downsample(np.concatenate([e[..., :3], np.clip(e[..., :3].max(-1, keepdims=True) * 1.4, 0, 1)], -1), (lw, lh))
                img[:, i * (lw + GAP): i * (lw + GAP) + lw] = small
            entry['emit'] = encode(bleed(img), OUT / meta['kit'] / 't1' / f'{name}-emit.webp', quality=72, alpha_quality=80)
    masks = [mask_bits(logical_alpha(f[..., 3])) for f in frames]
    cols = -(-lw // MASK_CELL)
    receipt = dict(blender=meta.get('blender'), samples=meta.get('samples'), device=meta.get('device'), renderSeconds=meta.get('renderSeconds'), scripts=meta.get('scripts'),
                   contour=not name.startswith(NO_CONTOUR_PREFIX), note=meta.get('note', ''))
    return entry, dict(x=entry['x'], y=entry['y'], w=lw, h=lh, cols=cols, frames=masks), receipt


def pack_sheet(meta, frames, fw, fh):
    """Periodic tiles (the waterfall sheet) ship untrimmed so they repeat exactly."""
    name = meta['name']
    f = frames[0]
    strip = {}
    for tier, s in (('t2', 2), ('t1', 1)):
        img = f if s == 2 else downsample(f, (int(fw), int(fh)))
        strip[tier] = encode(bleed(img), OUT / meta['kit'] / tier / f'{name}.webp', quality=62, alpha_quality=55)
    entry = dict(anchor='sheet', kind=meta['kind'], x=0, y=0, w=int(fw), h=int(fh), frames=1, fps=0, gap=GAP, tiers=strip)
    receipt = dict(blender=meta.get('blender'), samples=meta.get('samples'), device=meta.get('device'), renderSeconds=meta.get('renderSeconds'), scripts=meta.get('scripts'), contour=False, note=meta.get('note', ''))
    return entry, dict(x=0, y=0, w=int(fw), h=int(fh), cols=-(-int(fw) // MASK_CELL), frames=[mask_bits(logical_alpha(f[..., 3]))]), receipt


def legacy_masks():
    """Coverage masks of the shipped v1 open-air sprites (legacy flight replays),
    for the alignment receipts against obstacle-shapes.json."""
    out = {}
    def grid(a, w, h):
        # sample the source alpha at each cell centre of a w x h logical box
        ys = ((np.arange(0, h, MASK_CELL) + MASK_CELL / 2) / h * a.shape[0]).astype(int).clip(0, a.shape[0] - 1)
        xs = ((np.arange(0, w, MASK_CELL) + MASK_CELL / 2) / w * a.shape[1]).astype(int).clip(0, a.shape[1] - 1)
        return a[np.ix_(ys, xs)]
    tree = np.asarray(Image.open(LEGACY / 'tree.webp').convert('RGBA'), dtype=np.float64)[..., 3] / 255
    drone = np.asarray(Image.open(LEGACY / 'drone.webp').convert('RGBA'), dtype=np.float64)[..., 3] / 255
    cells = [drone[r * 128:(r + 1) * 128, c * 256:(c + 1) * 256] for r in range(2) for c in range(4)]
    # the v1 sprites are drawn stretched over the obstacle's render box, so the
    # masks are sampled on a reference box (tree at scale 64: 204.8 x 307.2; drone 184 x 92)
    out['tree'] = dict(source='chikun-open-air-v1/tree.webp', box=[204.8, 307.2], cols=len(range(0, 205, MASK_CELL)) - 0, frames=[mask_bits(grid(tree, 204.8, 307.2))])
    out['drone'] = dict(source='chikun-open-air-v1/drone.webp', box=[184.0, 92.0], cols=len(range(0, 184, MASK_CELL)), frames=[mask_bits(grid(c, 184.0, 92.0)) for c in cells])
    return out


def kit_bytes(kit, tier):
    total = 0
    for sp in kit['sprites'].values():
        total += sp['tiers'][tier]['bytes'] + (sp['emit']['bytes'] if 'emit' in sp else 0)
    return total


def write_catalog(kits):
    body = json.dumps(dict(version='chikun-obstacles-v2', base='/assets/generated/chikun-obstacles-v2/', kits=kits), separators=(',', ':'))
    CATALOG.write_text(
        '// Generated by scripts/build-chikun-obstacle-pack.py from the Blender obstacle renders. Do not edit.\n'
        '// Obstacles whose sprites are missing here or fail to load keep the code-drawn fallback (ground-world.mjs).\n'
        f'const CATALOG = {body};\n'
        'const deepFreeze = value => { if (value && typeof value === "object") { Object.freeze(value); for (const v of Object.values(value)) deepFreeze(v); } return value; };\n'
        'export const OBSTACLE_CATALOG = deepFreeze(CATALOG);\n', encoding='utf8', newline='\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=str(ROOT.parent / 'chikun-render-cache' / 'obstacles'))
    a = ap.parse_args()
    cache = Path(a.cache).resolve()
    kits, masks, receipts = {}, {}, {}
    for kit in KITS:
        kd = cache / kit
        if not kd.exists(): continue
        sprites = {}
        for d in sorted(p for p in kd.iterdir() if (p / 'meta.json').exists()):
            meta = json.loads((d / 'meta.json').read_text(encoding='utf8'))
            entry, mask, receipt = pack_sprite(meta, d)
            sprites[meta['name']] = entry
            masks[meta['name']] = mask
            receipts[meta['name']] = receipt
            print(kit, meta['name'], 't2', entry['tiers']['t2']['bytes'], 't1', entry['tiers']['t1']['bytes'], 'emit', entry.get('emit', {}).get('bytes', 0), f"{entry['w']}x{entry['h']}x{entry['frames']}")
        if sprites:
            kits[kit] = dict(sprites=sprites)
            kits[kit]['bytes'] = dict(t1=kit_bytes(kits[kit], 't1'), t2=kit_bytes(kits[kit], 't2'))
            kits[kit]['logicalPx'] = sum(s['w'] * s['h'] * s['frames'] for s in sprites.values())
            print('KIT', kit, kits[kit]['bytes'], 'logical px', kits[kit]['logicalPx'])
    masks['legacy'] = legacy_masks()
    scriptSets = []
    for r in receipts.values():
        sc = r.pop('scripts', None) or {}
        if sc not in scriptSets: scriptSets.append(sc)
        r['scriptSet'] = scriptSets.index(sc)
    manifest = dict(schema='chikun-obstacles-v2', kits=kits, receipts=receipts, scriptSets=scriptSets,
                    tool=dict(script='scripts/build-chikun-obstacle-pack.py', sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), pillow=Image.__version__, numpy=np.__version__))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n', encoding='utf8', newline='\n')
    MASKS.write_text(json.dumps(dict(schema='chikun-obstacle-masks-v1', cell=MASK_CELL, masks=masks), separators=(',', ':')) + '\n', encoding='utf8', newline='\n')
    stale = OUT / 'masks.json'
    if stale.exists(): stale.unlink()
    write_catalog(kits)


if __name__ == '__main__':
    main()
