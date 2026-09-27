"""Pre-Tripo input hygiene (art wave 2b): matte a concept's floor shadow and optionally retint a lamp hue band.

Casting doc section 6: floor shadows mesh as slabs in image-to-3D and lamp
colours must match the accent table before any model spend. The shadow is
flood-matted from the image border below --shadow-top (neutral pixels only,
stopped at luminance steps over --max-step so bright steel survives), shadow
islands the flood cannot reach are folded in, and the seam is feathered.
--retint rotates a hue band inside a box to a target hue.

  python scripts/hmh-tripo-input-hygiene.py in.png out.png --shadow-top 1560 --max-step 0.035
  python scripts/hmh-tripo-input-hygiene.py in.png out.png --shadow-top 1480 --retint 840,560,1340,960,280,346,348
"""
import argparse, colorsys, hashlib, json
from collections import deque
import numpy as np
from PIL import Image
p = argparse.ArgumentParser()
p.add_argument('src'); p.add_argument('dst')
p.add_argument('--shadow-top', type=int, default=1500)
p.add_argument('--max-step', type=float, default=1.0)
p.add_argument('--retint', help='x0,y0,x1,y1,hmin,hmax,target_hue_deg')
a = p.parse_args()
im = np.array(Image.open(a.src).convert('RGB')).astype(np.float32) / 255
h, w, _ = im.shape
mx = im.max(2); mn = im.min(2); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
bg_like = (sat < 0.09) & (mx > 0.30)
seen = np.zeros((h, w), bool); q = deque()
for x in range(w):
    if bg_like[h-1, x]: q.append((h-1, x)); seen[h-1, x] = True
for y in range(a.shadow_top, h):
    for x in (0, w-1):
        if bg_like[y, x] and not seen[y, x]: q.append((y, x)); seen[y, x] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y+dy, x+dx
        if a.shadow_top <= ny < h and 0 <= nx < w and not seen[ny, nx] and bg_like[ny, nx] and abs(mx[ny, nx] - mx[y, x]) < a.max_step:
            seen[ny, nx] = True; q.append((ny, nx))
out = im.copy()
# Islands of shadow the flood could not reach (darker than the threshold) are
# the non-background components in the matte band that do not continue the
# figure above it. Label them and fold them into the matte.
top = a.shadow_top
label = np.zeros((h, w), np.int32); comps = []
for sy in range(top, h):
    for sx in range(w):
        if seen[sy, sx] or label[sy, sx]: continue
        n = len(comps) + 1; label[sy, sx] = n; qq = deque([(sy, sx)]); pix = []; touches = False
        while qq:
            y, x = qq.popleft(); pix.append((y, x)); touches |= (y == top)
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny, nx = y+dy, x+dx
                if top <= ny < h and 0 <= nx < w and not seen[ny, nx] and not label[ny, nx]:
                    label[ny, nx] = n; qq.append((ny, nx))
        comps.append((touches, pix))
for touches, pix in comps:
    if not touches:
        for y, x in pix: seen[y, x] = True
row = top - 10
bgrow = im[row][bg_like[row]]
fill = np.median(bgrow, axis=0)
out[seen] = fill
# feather the seam into the untouched background above
for i, y in enumerate(range(top - 24, top)):
    t = (i + 1) / 25
    m = bg_like[y]
    out[y, m] = out[y, m] * (1 - t) + fill * t
changed = int(seen.sum())
retinted = 0
if a.retint:
    x0, y0, x1, y1, hmin, hmax, target = [float(v) for v in a.retint.split(',')]
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            r, g, b = out[y, x]
            hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
            if ss > 0.30 and vv > 0.45 and hmin <= hh*360 <= hmax:
                out[y, x] = colorsys.hsv_to_rgb(target/360, ss, vv); retinted += 1
Image.fromarray((out*255+0.5).clip(0,255).astype(np.uint8)).save(a.dst)
print(json.dumps({'src': a.src, 'srcSha256': hashlib.sha256(open(a.src,'rb').read()).hexdigest(), 'dst': a.dst,
  'dstSha256': hashlib.sha256(open(a.dst,'rb').read()).hexdigest(), 'shadowPixelsMatted': changed, 'lampPixelsRetinted': retinted}))
