"""Course-two art pack for Chikun's Escape: existing assets only, no generation.

Composes projection-only sprites from the committed HD Tripo kit cards
(apps/portal/assets/generated/hmh-reboot-tripo-props-hd) plus small Pillow
drawing, and writes apps/portal/assets/generated/chikun-course-two-v1/.

* tractor.webp   eight-frame bob/roll loop of the b2-54 rusted pickup truck with
                 a baked dust trail. Frame = the runtime chase body (138x94
                 logical) at 2x; the half-res sheet is 1x logical.
* trellis.webp   the raised vine trellis: b2-75 hedgerow crown over timber posts
                 with b1-04 fern sprigs. 300x150 logical at 2x, plus half-res.
* pickups.webp   shield (b1-29 Layer Two), magnet (b1-26 Hard Fork Rounds,
                 tinted to the magnet orange) and a drawn glide feather, each in
                 a 48x48 logical badge at 2x, plus half-res.

The hawk chase reuses chikun-obstacle-loop-v1/eagle-*.webp at runtime (tinted
in the view), so it adds no bytes; the manifest records those sheet hashes.

CPU only (Pillow). Deterministic: no randomness, no timestamps in the images.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / 'apps/portal/assets/generated/hmh-reboot-tripo-props-hd'
EAGLE = ROOT / 'apps/portal/assets/generated/chikun-obstacle-loop-v1'
OUT = ROOT / 'apps/portal/assets/generated/chikun-course-two-v1'
WEBP = dict(quality=90, method=6, alpha_quality=100)

kit = json.loads((KIT / 'hmh-tripo-props-hd.json').read_text('utf8'))
items = {it['assetId']: it for it in kit['items']}
pages = {}


def card(asset_id):
    it = items[asset_id]
    page = it['pageImage']
    if page not in pages:
        pages[page] = Image.open(KIT / page).convert('RGBA')
    f, a = it['frame'], it['alphaBounds']
    return pages[page].crop((f['x'] + a['x'], f['y'] + a['y'], f['x'] + a['x'] + a['w'], f['y'] + a['y'] + a['h']))


def fit(im, w, h):
    s = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tint(im, dark, light):
    """Colorize by luminance, keeping the card's alpha."""
    lum = ImageOps.autocontrast(im.convert('L'))
    out = ImageOps.colorize(lum, dark, light).convert('RGBA')
    out.putalpha(im.getchannel('A'))
    return out


def save(name, im, frames=1, columns=1, logical=None):
    path = OUT / f'{name}.webp'
    im.save(path, 'WEBP', **WEBP)
    half = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    half_path = OUT / f'{name}@0.5x.webp'
    half.save(half_path, 'WEBP', **WEBP)
    return {
        'name': name, 'file': path.name, 'width': im.width, 'height': im.height, 'frames': frames, 'columns': columns,
        'scale': 2, 'logical': logical, 'bytes': path.stat().st_size, 'decodedBytes': im.width * im.height * 4, 'sha256': sha(path),
        'half': {'file': half_path.name, 'width': half.width, 'height': half.height, 'scale': 1, 'bytes': half_path.stat().st_size,
                 'decodedBytes': half.width * half.height * 4, 'sha256': sha(half_path)},
    }


def build_tractor():
    # Runtime chase body: 138x94 logical; the solid rect is (x+12, y+10, 112x84) and
    # its bottom sits on the ground line, so the wheels land on the frame bottom.
    fw, fh, frames, cols = 276, 188, 8, 4
    truck = fit(card('b2-54'), 236, 150)
    sheet = Image.new('RGBA', (fw * cols, fh * (frames // cols)), (0, 0, 0, 0))
    for i in range(frames):
        t = i / frames * math.tau
        bob = round(3 * math.sin(t))
        roll = 1.6 * math.sin(t + .9)
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        # Dust trail behind the rear wheels (left side: the truck drives right).
        dust = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        dd = ImageDraw.Draw(dust)
        for k in range(5):
            ph = (i / frames + k * .23) % 1
            r = 14 + 26 * ph
            cx = 52 - 70 * ph + 10 * k
            cy = fh - 22 - 30 * ph + 6 * math.sin(t + k)
            a = int(215 * (1 - ph) ** 1.2)
            dd.ellipse((cx - r, cy - r * .7, cx + r, cy + r * .7), fill=(196, 170, 128, a))
        dust = dust.filter(ImageFilter.GaussianBlur(6))
        frame.alpha_composite(dust)
        body = truck.rotate(roll, resample=Image.BICUBIC, expand=False)
        frame.alpha_composite(body, (fw - body.width - 2, fh - body.height - 6 + bob))
        sheet.alpha_composite(frame, ((i % cols) * fw, (i // cols) * fh))
    return save('tractor', sheet, frames, cols, [138, 94])


def build_trellis():
    w, h = 600, 300  # 300x150 logical at 2x: exactly the fork-route collision rect
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Timber posts and rail (drawn): three posts from y=100 to the ground band.
    for px in (36, 300, 564):
        d.rectangle((px - 15, 90, px + 15, h), fill=(84, 63, 44, 255))
        d.rectangle((px - 15, 90, px - 8, h), fill=(110, 86, 58, 255))
        for gy in range(110, h, 26):
            d.line((px - 10, gy, px + 12, gy + 5), fill=(60, 42, 28, 200), width=2)
    d.rectangle((0, 86, w, 104), fill=(106, 82, 52, 255))
    d.rectangle((0, 86, w, 91), fill=(150, 126, 84, 255))
    # Lattice wires between the posts for the vines to climb.
    for lx in range(20, w, 54):
        d.line((lx, 104, lx + 40, 294), fill=(140, 120, 80, 150), width=3)
        d.line((lx + 40, 104, lx, 294), fill=(140, 120, 80, 150), width=3)
    # Hedgerow crown (b2-75) across the top; it covers the upper collision band.
    hedge = card('b2-75').resize((w + 24, h + 20), Image.LANCZOS)
    im.alpha_composite(hedge, (-12, -10))
    # Hanging vine sprigs (b1-04 fern cluster) at the posts.
    fern = fit(card('b1-04'), 150, 140)
    for fx, flip in ((0, False), (225, True), (450, False)):
        sprig = ImageOps.mirror(fern) if flip else fern
        im.alpha_composite(sprig, (fx, 168))
    # Ground shadow under the crown so the lower path reads as a clear tunnel.
    shade = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle((0, 200, w, 232), fill=(20, 32, 20, 90))
    im.alpha_composite(shade.filter(ImageFilter.GaussianBlur(10)))
    return save('trellis', im, 1, 1, [300, 150])


def feather(size):
    """A drawn glide feather in the Chikun palette (green quill)."""
    s = size
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = []
    n = 40
    for k in range(n + 1):
        u = k / n
        x = s * .18 + u * s * .64
        y = s * .82 - u * s * .62
        wid = s * .17 * math.sin(math.pi * min(1, u * 1.15)) * (1 - u * .25)
        pts.append((x - wid * .6, y - wid))
    for k in range(n, -1, -1):
        u = k / n
        x = s * .18 + u * s * .64
        y = s * .82 - u * s * .62
        wid = s * .17 * math.sin(math.pi * min(1, u * 1.15)) * (1 - u * .25)
        pts.append((x + wid * .6, y + wid))
    d.polygon(pts, fill=(193, 239, 183, 255))
    for k in range(1, n, 2):
        u = k / n
        x = s * .18 + u * s * .64
        y = s * .82 - u * s * .62
        wid = s * .17 * math.sin(math.pi * min(1, u * 1.15)) * (1 - u * .25)
        d.line((x, y, x - wid * .6, y - wid), fill=(120, 190, 140, 170), width=max(1, s // 48))
        d.line((x, y, x + wid * .6, y + wid), fill=(120, 190, 140, 170), width=max(1, s // 48))
    d.line((s * .14, s * .86, s * .84, s * .18), fill=(72, 124, 92, 255), width=max(2, s // 24))
    return im


def build_pickups():
    cell = 96  # 48x48 logical at 2x; pickup radius is 23 logical
    colors = {'shield': ((112, 229, 240), (19, 62, 97)), 'magnet': ((255, 191, 101), (117, 49, 69)), 'feather': ((193, 239, 183), (36, 84, 88))}
    sheet = Image.new('RGBA', (cell * 3, cell), (0, 0, 0, 0))
    icons = {
        'shield': fit(card('b1-29'), 62, 62),
        'magnet': fit(tint(card('b1-26'), (150, 24, 18), (255, 128, 64)).rotate(180, expand=True), 44, 62),
        'feather': feather(66),
    }
    for i, kind in enumerate(('shield', 'magnet', 'feather')):
        edge, base = colors[kind]
        badge = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
        d = ImageDraw.Draw(badge)
        d.ellipse((4, 4, cell - 4, cell - 4), fill=base + (255,), outline=edge + (255,), width=5)
        d.arc((12, 12, cell - 12, cell - 12), 200, 320, fill=(255, 255, 255, 140), width=2)
        icon = icons[kind]
        badge.alpha_composite(icon, ((cell - icon.width) // 2, (cell - icon.height) // 2))
        sheet.alpha_composite(badge, (i * cell, 0))
    return save('pickups', sheet, 3, 3, [48, 48])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assets = [build_tractor(), build_trellis(), build_pickups()]
    eagle = json.loads((EAGLE / 'manifest.json').read_text('utf8'))
    manifest = {
        'schema': 'chikun-course-two-art-v1',
        'projectionOnly': True,
        'assets': assets,
        'hawk': {'reuses': 'chikun-obstacle-loop-v1', 'tiers': {t: {'file': v['file'], 'sha256': v['sha256'], 'bytes': v['bytes']} for t, v in eagle['tiers'].items()}, 'addedBytes': 0},
        'sources': {aid: {'name': items[aid]['name'], 'pageImage': items[aid]['pageImage'], 'sourcePixelSha256': items[aid]['sourcePixelSha256']} for aid in ('b2-54', 'b2-75', 'b1-04', 'b1-29', 'b1-26')},
        'totals': {
            'encodedBytes': sum(a['bytes'] for a in assets), 'halfEncodedBytes': sum(a['half']['bytes'] for a in assets),
            'decodedBytes': sum(a['decodedBytes'] for a in assets), 'halfDecodedBytes': sum(a['half']['decodedBytes'] for a in assets),
        },
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n', 'utf8')
    print(json.dumps(manifest['totals']))
    for a in assets:
        print(a['name'], a['width'], 'x', a['height'], a['bytes'], 'B; half', a['half']['bytes'], 'B')


if __name__ == '__main__':
    sys.exit(main())
