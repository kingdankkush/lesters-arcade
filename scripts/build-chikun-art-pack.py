"""Pack the Chikun scenery renders into shipped WebP tiers, a manifest and the
runtime catalog.

    python scripts/build-chikun-art-pack.py [--cache ../chikun-render-cache] [--regions farmland,forest] [--no-plates]

Reads the Blender render cache (scripts/chikun-blender/build-chikun-scenery.py),
then per region and layer:
  * crops the overscan margins and proves the strip wraps (seam gate: the right
    margin must repeat the left edge of the tile);
  * compresses value and saturation by depth so backdrops never compete with
    the play layer (backdrop L* range caps: far 20, mid 30, near 40);
  * derives T1 (1x) from the T2 (2x) render in premultiplied space;
  * turns the emission pass into additive light chunks packed into an atlas;
  * cuts the perspective ground render into per-rate bands (each band re-cut to
    its own exact period so it tiles);
  * encodes WebP, writes apps/portal/assets/generated/chikun-scenery-v2/manifest.json
    and generates apps/chikun/src/scenery-catalog.mjs.
Every output records its bytes, dimensions and SHA-256; the manifest also
records the Blender scripts' hashes from the render metadata.
"""
import argparse, hashlib, io, json, math, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT / 'scripts/chikun-blender/scenery-spec.json').read_text(encoding='utf8'))
OUT = ROOT / 'apps/portal/assets/generated/chikun-scenery-v2'
CATALOG = ROOT / 'apps/chikun/src/scenery-catalog.mjs'
REGIONS = ['farmland', 'forest', 'town', 'city', 'industrial', 'suburbs', 'coast']
QUALITY = dict(far=70, mid=78, near=78, front=82, ground=80, emit=72)
L_RANGE = dict(far=28.0, mid=34.0, near=42.0, front=60.0)
CHROMA = dict(far=0.7, mid=0.85, near=0.95, front=1.0)
L_BOUNDS = dict(far=(40.0, 92.0), mid=(32.0, 84.0), near=(26.0, 82.0), front=(8.0, 80.0))
PAD = 8          # wrap padding around each ground band, in tier pixels
EMIT_CHUNK = 32  # emissive chunk width, logical px
EMIT_GAP = 10    # unlit rows that split a chunk column into separate runs


def layer_spec(region, layer):
    base = dict(SPEC['layers'][layer]); base.update(SPEC['regions'].get(region, {}).get(layer, {}))
    base['baseline'] = SPEC['horizonY'] + (SPEC['runY'] - SPEC['horizonY']) * base['rate'] if layer != 'front' else SPEC['runY']
    return base


# ---------------------------------------------------------------- colour helpers
def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


M_XYZ = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
M_RGB = np.linalg.inv(M_XYZ)
WHITE = np.array([0.95047, 1.0, 1.08883])


def rgb_to_lab(rgb):
    xyz = srgb_to_linear(rgb) @ M_XYZ.T / WHITE
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_rgb(lab):
    fy = (lab[..., 0] + 16) / 116; fx = fy + lab[..., 1] / 500; fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 216 / 24389, f ** 3, (116 * f - 16) / (24389 / 27)) * WHITE
    return linear_to_srgb(xyz @ M_RGB.T)


def compress_values(rgba, layer, params=None):
    """Value-compress opaque pixels around their median and scale chroma.
    Pass `params` (from a previous call) to apply the same mapping to a
    sprite that belongs to that layer."""
    a = rgba[..., 3]
    mask = a > 0.5
    if not mask.any(): return rgba, {}
    lab = rgb_to_lab(rgba[..., :3])
    L = lab[..., 0][mask]
    if params is None:
        lo, med, hi = np.percentile(L, [2, 50, 98])
        k = min(1.0, L_RANGE[layer] / max(1e-3, hi - lo))
    else:
        lo, med, hi = params['lBefore']; k = params['scale']
    lab[..., 0] = med + (lab[..., 0] - med) * k
    lmin, lmax = L_BOUNDS[layer]
    lab[..., 0] = np.clip(lab[..., 0], lmin, lmax)
    lab[..., 1:] *= CHROMA[layer]
    out = rgba.copy(); out[..., :3] = lab_to_rgb(lab)
    after = lab[..., 0][mask]
    return out, dict(lBefore=[round(float(lo), 3), round(float(med), 3), round(float(hi), 3)], lAfter=[round(float(np.percentile(after, 2)), 1), round(float(np.percentile(after, 50)), 1), round(float(np.percentile(after, 98)), 1)], chroma=CHROMA[layer], scale=round(k, 5))


# ---------------------------------------------------------------- image helpers
def load(path):
    return np.asarray(Image.open(path).convert('RGBA'), dtype=np.float64) / 255.0


def to_image(rgba):
    return Image.fromarray(np.clip(np.round(rgba * 255), 0, 255).astype(np.uint8), 'RGBA')


def downsample(rgba, size):
    """Premultiplied LANCZOS resize (no dark fringes at alpha edges)."""
    pm = rgba.copy(); pm[..., :3] *= pm[..., 3:4]
    chans = [np.asarray(Image.fromarray((pm[..., i] * 65535).astype(np.float32), 'F').resize(size, Image.LANCZOS)) / 65535 for i in range(4)]
    out = np.clip(np.stack(chans, -1), 0, 1)
    a = out[..., 3:4]
    out[..., :3] = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0)
    return np.clip(out, 0, 1)


def sharpen(rgba, amount=0.35):
    im = to_image(rgba)
    rgb = im.convert('RGB').filter(ImageFilter.UnsharpMask(radius=0.8, percent=int(amount * 100), threshold=1))
    out = np.asarray(rgb, dtype=np.float64) / 255.0
    return np.concatenate([out, rgba[..., 3:4]], -1)


def bleed(rgba, iterations=6):
    """Spread opaque colour into transparent pixels so resampling never pulls black."""
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


def encode(rgba, path, quality, alpha_quality=90, lossless_alpha=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    im = to_image(rgba)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6, alpha_quality=alpha_quality, exact=False)
    data = buf.getvalue()
    path.write_bytes(data)
    return dict(src=path.relative_to(OUT).as_posix(), w=im.width, h=im.height, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def seam_receipt(tile):
    """The wrap column pair (last -> first) must look like interior column pairs.
    Robust to an object edge that happens to land on the wrap: the score is the
    median over opaque rows, so a lighting or texture seam (every row a little
    off) fails while a single flower edge does not."""
    a = tile[:, -1]; b = tile[:, 0]
    opaque = np.maximum(a[..., 3], b[..., 3]) > 0.5
    if opaque.sum() < 4: return dict(wrapDelta=0.0, interiorP95=0.0, ok=True)
    wrap = float(np.median(np.abs(a[opaque, :3] - b[opaque, :3]).mean(-1)))
    d = np.abs(np.diff(tile[..., :3], axis=1)).mean(-1)
    op = (np.maximum(tile[:, 1:, 3], tile[:, :-1, 3]) > 0.5)
    step = max(1, d.shape[1] // 400)
    cols = [float(np.median(d[op[:, i], i])) for i in range(0, d.shape[1], step) if op[:, i].sum() >= 4]
    p95 = float(np.percentile(cols, 95)); med = float(np.median(cols))
    ok = wrap <= max(p95, 2.0 * med, 3 / 255)
    return dict(wrapDelta=round(wrap, 5), interiorMedian=round(med, 5), interiorP95=round(p95, 5), ok=bool(ok))


# ---------------------------------------------------------------- strips
def pack_strip(region, layer, cache, receipts):
    ls = layer_spec(region, layer)
    src = cache / region / f'{layer}.png'
    if not src.exists(): return None
    meta = json.loads((cache / region / f'{layer}.json').read_text(encoding='utf8'))
    tier = meta['tier']; m = SPEC['marginPx'] * tier; W = ls['width'] * tier; H = ls['height'] * tier
    full = load(src)
    assert full.shape[1] == W + 2 * m and full.shape[0] == H, f'{region}/{layer}: render is {full.shape}, expected {(H, W + 2 * m)}'
    tile = full[:, m:m + W].copy()
    seam = seam_receipt(tile)
    if not seam['ok']: raise SystemExit(f'SEAM GATE FAILED {region}/{layer}: {seam}')
    base_row = (ls['baseline'] - ls['top']) * tier
    rows = np.arange(H)[:, None]
    if layer != 'front':
        # Nothing below the baseline; a short fade into the ground bands above it.
        fade = np.clip((base_row - rows) / (2.5 * tier), 0, 1)
        tile[..., 3] *= fade
    tile, values = compress_values(tile, layer)
    tile = bleed(tile)
    out = dict(rate=ls['rate'], top=ls['top'], height=ls['height'], width=ls['width'], baseline=round(ls['baseline'], 3), fog=ls['fog'], tiers={})
    for t in ls['tiers']:
        scale = SPEC['tiers'][t]
        img = tile if scale == tier else sharpen(downsample(tile, (ls['width'] * scale, ls['height'] * scale)))
        out['tiers'][t] = encode(img, OUT / region / t / f'{layer}.webp', QUALITY[layer], alpha_quality=90)
    receipts[f'{region}/{layer}'] = dict(seam=seam, values=values, render=dict(blender=meta.get('blender'), samples=meta.get('samples'), seconds=meta.get('renderSeconds'), scripts=meta.get('scripts')))
    emit = cache / region / f'{layer}-emit.png'
    if emit.exists():
        out['emit'] = pack_emit(region, layer, load(emit)[:, m:m + W], ls, tier)
    if meta.get('anchors'):
        out['anchors'] = [dict(id=a['id'], kind=a['kind'], u=round(((a['pivotPx'][0] / tier) - SPEC['marginPx']) % ls['width'], 3), y=round(a['pivotPx'][1] / tier, 3)) for a in meta['anchors']]
    if meta.get('sprites'):
        out['sprites'] = [pack_sprite(region, layer, sp, cache, ls, tier, m, values) for sp in meta['sprites']]
    return out


def pack_sprite(region, layer, sp, cache, ls, tier, m, values):
    """An animated landmark part: cropped to its alpha, pivot recorded in strip
    coordinates, graded with its layer's value mapping."""
    img = load(cache / region / f"{layer}-sprite-{sp['id']}.png")
    ys, xs = np.where(img[..., 3] > 0.01)
    pad = 4 * tier
    x0 = int(max(0, (xs.min() - pad) // tier * tier)); y0 = int(max(0, (ys.min() - pad) // tier * tier))
    x1 = int(min(img.shape[1], -(-(xs.max() + pad) // tier) * tier)); y1 = int(min(img.shape[0], -(-(ys.max() + pad) // tier) * tier))
    crop, _ = compress_values(img[y0:y1, x0:x1].copy(), layer, values)
    crop = bleed(crop)
    px, py = sp['pivotPx']
    entry = dict(id=sp['id'], motion=sp['motion'], speed=sp['speed'], u=round(((px / tier) - SPEC['marginPx']) % ls['width'], 3), y=round(py / tier, 3),
                 px=round(float(px - x0) / tier, 3), py=round(float(py - y0) / tier, 3), w=int((x1 - x0) // tier), h=int((y1 - y0) // tier), tiers={})
    for t in ls['tiers']:
        scale = SPEC['tiers'][t]
        im = crop if scale == tier else downsample(crop, (entry['w'] * scale, entry['h'] * scale))
        entry['tiers'][t] = encode(im, OUT / region / t / f"{layer}-sprite-{sp['id']}.webp", QUALITY[layer], alpha_quality=90)
    return entry


def merge_chunks(chunks, waste=0.3, max_w=256):
    """Greedily merge horizontally adjacent runs whose bounding box wastes at
    most `waste` of its area: far fewer draw calls for a little more memory."""
    out = []
    for u, y, w, h in sorted(chunks, key=lambda c: (c[0], c[1])):
        best = None
        for c in out:
            if c[0] + c[2] != u or c[2] + w > max_w: continue
            y0, y1 = min(c[1], y), max(c[1] + c[3], y + h)
            union = (c[2] + w) * (y1 - y0)
            if union - (c[2] * c[3] + w * h) <= waste * union and (best is None or union < best[1]):
                best = (c, union, y0, y1)
        if best:
            c, _, y0, y1 = best
            c[1], c[2], c[3] = y0, c[2] + w, y1 - y0
        else:
            out.append([u, y, w, h])
    return sorted(out, key=lambda c: (c[0], c[1]))


def pack_emit(region, layer, rgba, ls, tier):
    """Additive light: alpha = brightest channel. Split into EMIT_CHUNK columns,
    crop each to its lit rows, shelf-pack into one atlas per tier."""
    light = rgba[..., :3] * rgba[..., 3:4]
    glow = np.stack([np.asarray(Image.fromarray((light[..., i] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3 * tier))) / 255.0 for i in range(3)], -1)
    light = np.clip(light + glow * 0.35, 0, 1)
    H, W = light.shape[:2]
    lum = light.max(-1)
    chunks = []
    cw = EMIT_CHUNK
    for u in range(0, ls['width'], cw):
        col = lum[:, u * tier:(u + cw) * tier]
        lit = col.reshape(ls['height'], tier, -1).max(axis=(1, 2)) > 6 / 255   # per logical row
        rows = np.where(lit)[0]
        if not len(rows): continue
        start = prev = rows[0]
        for r in list(rows[1:]) + [None]:
            if r is None or r - prev > EMIT_GAP:
                y0 = max(0, int(start) - 1); y1 = min(ls['height'], int(prev) + 2)
                chunks.append([u, y0, cw, y1 - y0])
                if r is not None: start = r
            if r is not None: prev = r
    if not chunks: return None
    chunks = merge_chunks(chunks)
    # Shelf pack at logical scale (atlas width 1024 logical).
    AW, x, y, shelf = 1024, 0, 0, 0
    placed = []
    for u, cy, w, h in sorted(chunks, key=lambda c: -c[3]):
        if x + w + 2 > AW: x = 0; y += shelf + 2; shelf = 0
        placed.append([u, cy, w, h, x + 1, y + 1]); x += w + 2; shelf = max(shelf, h)
    AH = y + shelf + 2
    placed.sort(key=lambda c: c[0])
    atlas = np.zeros((AH * tier, AW * tier, 4))
    for u, cy, w, h, ax, ay in placed:
        piece = light[cy * tier:(cy + h) * tier, u * tier:(u + w) * tier]
        a = piece.max(-1, keepdims=True)
        rgb = np.where(a > 1e-4, piece / np.maximum(a, 1e-4), 0)
        atlas[ay * tier:(ay + h) * tier, ax * tier:(ax + w) * tier] = np.concatenate([rgb, a], -1)
    # Lights ship at 1x only: the loader prescales them to the device once, and
    # a soft upscale reads as bloom. This quarters their bytes at t2.
    out = dict(chunks=placed, tiers={})
    img = downsample(atlas, (AW, AH)) if tier != 1 else atlas
    out['tiers']['t1'] = encode(img, OUT / region / 't1' / f'{layer}-emit.webp', QUALITY['emit'], alpha_quality=80)
    stale = OUT / region / 't2' / f'{layer}-emit.webp'
    if stale.exists(): stale.unlink()
    return out


# ---------------------------------------------------------------- ground bands
def pack_ground(region, cache, receipts):
    src = cache / region / 'ground.png'
    if not src.exists(): return None
    meta = json.loads((cache / region / 'ground.json').read_text(encoding='utf8'))
    tier = meta['tier']; cam = meta['camera']; m = SPEC['marginPx'] * tier
    full = load(src)
    top = cam['top']; period = SPEC['ground']['period']
    edges = SPEC['ground']['edges']
    horizon, run = SPEC['horizonY'], SPEC['runY']
    bands = []
    for y0, y1 in zip(edges, edges[1:]):
        rate = ((y0 + y1) / 2 - horizon) / (run - horizon)
        bands.append((y0, y1, round(rate, 6)))
    tiers = {}
    for t in SPEC['ground']['tiers']:
        scale = SPEC['tiers'][t]
        pieces = []
        for y0, y1, rate in bands:
            bw = max(8, int(round(period * rate * scale)))
            bh = (y1 - y0) * scale + 1
            rows = []
            for r in range(bh):
                acc = 0
                for sy in (-0.25, 0.25):
                    yl = y0 + (min(r, bh - 2) + 0.5 + sy) / scale          # logical row (2x2 supersampled)
                    rr = min(max(int((yl - top) * tier), 0), full.shape[0] - 1)
                    rho = max(1e-3, (yl - horizon) / (run - horizon))
                    p_row = period * rho * tier                          # render px per period at this row
                    row = full[rr]
                    for sx in (-0.25, 0.25):
                        xs = (np.arange(bw + 2 * PAD) - PAD + 0.5 + sx) * (p_row / bw)
                        xs = np.mod(xs, p_row) + m
                        i0 = np.floor(xs).astype(int); f = (xs - i0)[:, None]
                        i1 = np.minimum(i0 + 1, row.shape[0] - 1)
                        s = row[i0] * (1 - f) + row[i1] * f
                        s[:, :3] *= s[:, 3:4]
                        acc = acc + s
                acc = acc / 4
                acc[:, :3] = np.where(acc[:, 3:4] > 1e-4, acc[:, :3] / np.maximum(acc[:, 3:4], 1e-4), 0)
                rows.append(acc)
            piece = np.stack(rows, 0)
            # Horizontal minification where a row period is much wider than the band tile.
            pieces.append((y0, y1, rate, bw, bh, piece))
        # Stack vertically with 2 px gaps.
        AW = max(p[3] for p in pieces) + 2 * PAD
        AH = sum(p[4] + 2 for p in pieces)
        atlas = np.zeros((AH, AW, 4)); rects = []; yy = 0
        for y0, y1, rate, bw, bh, piece in pieces:
            atlas[yy:yy + bh, 0:bw + 2 * PAD] = piece
            rects.append([PAD, yy, bw, bh]); yy += bh + 2
        atlas, values = compress_values(atlas, 'near')
        tiers[t] = encode(atlas, OUT / region / t / 'ground.webp', QUALITY['ground'], alpha_quality=90)
        tiers[t]['rects'] = rects
    receipts[f'{region}/ground'] = dict(render=dict(blender=meta.get('blender'), seconds=meta.get('renderSeconds'), scripts=meta.get('scripts')), bands=len(bands))
    drift = SPEC['regions'].get(region, {}).get('ground', {}).get('drift', [])
    out = dict(bands=[[y0, y1, rate] for y0, y1, rate in bands], pad=PAD, period=period, tiers=tiers)
    if drift:
        out['drift'] = [next((d for a, b, d in drift if y0 >= a and y1 <= b), 0) for y0, y1, _ in bands]
    return out


# ---------------------------------------------------------------- catalog
def bytes_for(region_entry, tier):
    total = 0
    for layer in region_entry['layers'].values():
        t = layer['tiers'].get(tier) or layer['tiers'].get('t1')
        total += t['bytes']
        if layer.get('emit'): total += (layer['emit']['tiers'].get(tier) or layer['emit']['tiers']['t1'])['bytes']
        for sp in layer.get('sprites', []): total += (sp['tiers'].get(tier) or sp['tiers']['t1'])['bytes']
    if region_entry.get('ground'): total += region_entry['ground']['tiers'][tier]['bytes']
    return total


def emit_px(region_entry):
    """Light atlases stay at their 1x source size (drawn scaled, additive)."""
    return sum(l['emit']['tiers']['t1']['w'] * l['emit']['tiers']['t1']['h'] for l in region_entry['layers'].values() if l.get('emit'))


def logical_px(region_entry):
    """Decoded logical pixels once prescaled (device px = logical * density^2)."""
    px = 0
    for name, layer in region_entry['layers'].items():
        px += layer['width'] * layer['height']
        px += sum(sp['w'] * sp['h'] for sp in layer.get('sprites', []))
    if region_entry.get('ground'):
        g = region_entry['ground']
        px += sum((round(g['period'] * r) + 2 * PAD) * (y1 - y0 + 1) for y0, y1, r in g['bands'])
    return px


def write_catalog(regions, manifest):
    spec = dict(horizonY=SPEC['horizonY'], runY=SPEC['runY'], canvasHeight=SPEC['canvasHeight'], groundEdges=SPEC['ground']['edges'])
    body = json.dumps(dict(version='chikun-scenery-v2', base='/assets/generated/chikun-scenery-v2/', spec=spec, regions=regions), separators=(',', ':'))
    CATALOG.write_text(
        '// Generated by scripts/build-chikun-art-pack.py from the Blender scenery renders. Do not edit.\n'
        '// Regions missing here fall back to the code-drawn painters in world.mjs.\n'
        f'const CATALOG = {body};\n'
        'const deepFreeze = value => { if (value && typeof value === "object") { Object.freeze(value); for (const v of Object.values(value)) deepFreeze(v); } return value; };\n'
        'export const SCENERY_CATALOG = deepFreeze(CATALOG);\n', encoding='utf8', newline='\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=str(ROOT.parent / 'chikun-render-cache'))
    ap.add_argument('--regions', default=','.join(REGIONS))
    ap.add_argument('--no-plates', action='store_true')
    a = ap.parse_args()
    cache = Path(a.cache).resolve()
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8')) if manifest_path.exists() else dict(schema='chikun-scenery-v2', regions={}, receipts={})
    for region in [r for r in a.regions.split(',') if r]:
        receipts = {}
        layers = {}
        for layer in ('far', 'mid', 'near', 'front'):
            packed = pack_strip(region, layer, cache, receipts)
            if packed: layers[layer] = packed
        ground = pack_ground(region, cache, receipts)
        if not layers: continue
        entry = dict(layers=layers, ground=ground)
        entry['bytes'] = dict(t1=bytes_for(entry, 't1'), t2=bytes_for(entry, 't2'))
        entry['logicalPx'] = logical_px(entry)
        entry['emitPx'] = emit_px(entry)
        manifest['regions'][region] = entry
        manifest['receipts'].update(receipts)
        print(region, 'bytes t1', entry['bytes']['t1'], 't2', entry['bytes']['t2'], 'logical px', entry['logicalPx'], 'emit px', entry['emitPx'])
    manifest['tool'] = dict(script='scripts/build-chikun-art-pack.py', sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), pillow=Image.__version__, numpy=np.__version__)
    ordered = {r: manifest['regions'][r] for r in REGIONS if r in manifest['regions']}
    manifest['regions'] = ordered
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=1) + '\n', encoding='utf8', newline='\n')
    write_catalog({r: {k: v for k, v in e.items() if k != 'receipts'} for r, e in ordered.items()}, manifest)
    if not a.no_plates:
        subprocess.run([sys.executable, str(ROOT / 'scripts/build-chikun-review-plates.py')] + (['--regions', a.regions] if a.regions else []), check=True)


if __name__ == '__main__':
    main()
