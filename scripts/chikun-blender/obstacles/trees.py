"""Trees (willow, cherry, maple, oak) and the forest wall.

Tree collision (chikun-ground-course.mjs), relative to the tree's left edge and
its top (690 - height): a trunk capsule of radius 12 on x = w/2 from the ground
up to y = 55, and three crown circles at (w/2, 68, 0.40w), (w/2 - 0.22w, 101,
0.27w), (w/2 + 0.23w, 106, 0.26w). Width is 185 for the willow, 155 otherwise;
height varies from 200 to 415, so a tree is two sprites: a crown fitted to the
circles (drawn at the top) and a trunk column (anchored on the running line,
cropped at the top under the crown).

Forest collision: four 117.5 px columns, heights H, H - 38, H, H - 38 with H in
[250, 375]. A column sprite is anchored at its top and cropped at the running
line; an undergrowth sprite covers the cut.
"""
import math, random
from mathutils import Vector, noise
from . import mats, geo, fit
from .rig import P, SP, CP

SPECIES = {
    'oak': dict(w=155, leaf=('#264a1f', '#46752f', '#8db34c'), bark=dict(base='#5a4331', dark='#271a11', light='#85705a'), blossom=None, shape='round'),
    'maple': dict(w=155, leaf=('#7a2213', '#c4501d', '#f2a032'), bark=dict(base='#6d655b', dark='#35302b', light='#9a9186'), blossom=None, shape='round'),
    'cherry': dict(w=155, leaf=('#a8466a', '#e38aac', '#fbd6e2'), bark=dict(base='#5b3a33', dark='#2a1814', light='#8a6259'), blossom=('#3f6a2c',), shape='round'),
    'willow': dict(w=185, leaf=('#3f5f22', '#7c9a3a', '#c7d77e'), bark=dict(base='#6a6152', dark='#2e2a24', light='#958b7a'), blossom=None, shape='weeping'),
}


def circles(w):
    cx = w / 2
    return [(cx, 68.0, w * 0.40), (cx - w * 0.22, 101.0, w * 0.27), (cx + w * 0.23, 106.0, w * 0.26)]


def crown_frame(species):
    w = SPECIES[species]['w']
    return (-14, -10, w + 28, 172)


def trunk_frame(species):
    w = SPECIES[species]['w']
    return (w / 2 - 46, -336, 92, 344)


def _leaf_cards(M, card, rng, blobs, count, size=(2.6, 3.8)):
    return geo.scatter_on_blobs(rng, blobs, count, lambda p, n: M.card(card, p, size[0] * rng.uniform(0.85, 1.25), size[1] * rng.uniform(0.85, 1.25), n, twist=rng.uniform(0, 6.28)), inside_limit=0.8)


def clump_mat(name, dark, mid, light):
    """Foliage-textured clump cores (cell breakup + bump), so gaps between leaf
    cards read as deeper leaves rather than a smooth ball."""
    return mats.leaves(name, dark, mid, light, cards=False, scale=0.55, translucent=0.2, bump=0.9)


def _darker(hex_value, k):
    r, g, b = (int(hex_value[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % (int(r * k), int(g * k), int(b * k))


def foliage_volume(M, cards, rng, inside, box, count, size=(3.4, 4.8), clump=0.045, keep=0.42, outward=None, seed=0):
    """Leaf cards scattered through a volume rather than on sphere skins:
    `inside(p)` returns (depth_into_volume, outward_normal) or None; a 3D noise
    gathers the leaves into irregular clusters with gaps, most cards sit in the
    outer shell, and each card faces mostly outward and up. `cards` is a list of
    (material, weight)."""
    off = Vector((seed * 3.7, seed * 1.3, seed * 5.9))
    total = sum(w for _, w in cards)
    placed = tries = 0
    x0, y0, z0, x1, y1, z1 = box
    while placed < count and tries < count * 40:
        tries += 1
        p = Vector((rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(z0, z1)))
        hit = inside(p)
        if hit is None: continue
        depth, nrm = hit
        # shell: dense near the surface, sparse deep inside
        if rng.random() > max(0.12, 1.0 - depth / 9.0): continue
        n1 = noise.noise(p * clump + off)
        if n1 < -keep + 0.5 * rng.random() * keep: continue
        if outward: nrm = outward(p, nrm)
        n = (nrm * 0.75 + Vector((0, 0, 0.45)) + Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rng.uniform(-0.3, 0.5)))).normalized()
        r = rng.random() * total
        for mat, w in cards:
            r -= w
            if r <= 0: break
        M.card(mat, p, size[0] * rng.uniform(0.8, 1.25), size[1] * rng.uniform(0.8, 1.25), n, twist=rng.uniform(0, 6.28))
        placed += 1
    return placed


def crown(species):
    def build(ctx):
        sp = SPECIES[species]
        rng = random.Random('crown:' + species)
        dark, mid, light = sp['leaf']
        core = clump_mat(species + '-crown-core', _darker(dark, 0.45), _darker(dark, 0.75), _darker(mid, 0.6))
        card = mats.leaves(species + '-leaf', dark, mid, light, cards=True, scale=0.4, translucent=0.16)
        cards = [(card, 1.0)]
        if species == 'cherry':
            cards.append((mats.leaves('cherry-green', '#2f5a24', '#4f7f33', '#86ad4a', cards=True, scale=0.4), 0.2))
        branch = mats.bark(species + '-branch', **sp['bark'], scale=1.3)
        M = geo.Mesh(species + '-crown', [core])
        w = sp['w']
        spheres = [(P(cx, cy, 0.0), r) for (cx, cy, r) in circles(w)]
        # a dark core so nothing shows through the leaves
        for c, r in spheres:
            M.blob(core, c, r * 0.84, squash=(1, 0.8, 1), displace=0.18, freq=1.2, seed=int(r), subdiv=3)
        # limbs from the trunk top into the lower crown
        top = P(w / 2, 60.0, 0.0)
        for (bx, by, _r) in circles(w)[1:]:
            M.tube(branch, [top, P(w / 2 + (bx - w / 2) * 0.5, 86.0, -4.0), P(bx, by + 12, -6.0)], [5.5, 4.0, 2.4], segs=8)

        lobe_off = Vector((len(species) * 2.1, 0.7, 3.3))

        def inside(p):
            best = None
            for c, r in spheres:
                d = Vector(((p.x - c.x), (p.y - c.y) / 0.8, (p.z - c.z)))
                # lobed skin: +-8 % of the radius, so the crown is clumpy, not a topiary ball
                dn = d.normalized() if d.length > 1e-6 else Vector((0, 0, 1))
                lobe = 0.08 * noise.noise(dn * 2.2 + lobe_off) + 0.04 * noise.noise(dn * 5.0 + lobe_off)
                depth = r * (1.0 + lobe) - d.length
                if depth >= 0 and (best is None or depth > best[0]):
                    best = (depth, d.normalized())
            if best is None: return None
            return (max(0.0, best[0]), best[1])
        xs = [c.x for c, r in spheres]; ys = [c.y for c, r in spheres]; zs = [c.z for c, r in spheres]; R = max(r for c, r in spheres)
        box = (min(xs) - R, min(ys) - R, min(zs) - R, max(xs) + R, max(ys) + R, max(zs) + R)
        deep = mats.leaves(species + '-leaf-deep', _darker(dark, 0.7), _darker(mid, 0.72), _darker(light, 0.75), cards=True, scale=0.4, translucent=0.12)
        foliage_volume(M, cards + [(deep, 0.45)], rng, inside, box, 32000 if w < 170 else 38000, seed=len(species), keep=0.18, clump=0.06)
        if sp['shape'] == 'weeping':
            frond = mats.leaves('willow-frond', '#445f24', '#86a33f', '#cddb86', cards=True, scale=0.4, translucent=0.2)
            for i in range(70):
                a = rng.uniform(math.pi * 0.05, math.pi * 0.95)
                (cx, cy, r) = rng.choice(circles(w))
                sx = cx + math.cos(a) * r * rng.uniform(0.2, 0.95); sy = cy + math.sin(a) * r * rng.uniform(0.3, 0.92)
                depth = rng.uniform(-r * 0.4, -r * 0.05)
                start = P(sx, sy, depth)
                L = rng.uniform(16, 30)
                limit = 0.0
                for (ccx, ccy, cr) in circles(w):
                    if abs(sx - ccx) < cr:
                        limit = max(limit, ccy + math.sqrt(max(0.0, cr * cr - (sx - ccx) ** 2)) + 9.0)
                L = max(4.0, min(L, limit - sy))
                steps = int(L / 2.2)
                for k in range(steps):
                    q = start + Vector((rng.uniform(-0.6, 0.6) + k * 0.12, rng.uniform(-0.4, 0.4), -k * 2.2 / CP))
                    M.card(frond, q, 1.3, 3.6, Vector((0, -1, 0.1)), up=(0, 0, 1), twist=rng.uniform(-0.5, 0.5))
        return [M.done(ctx['coll'])]
    return build


def trunk(species):
    def build(ctx):
        sp = SPECIES[species]
        rng = random.Random('trunk:' + species)
        bark = mats.bark(species + '-bark', **sp['bark'], scale=1.0, lichen='#9aa27a' if species in ('oak', 'willow') else None)
        grass = mats.leaves('trunk-grass', '#2c4a1e', '#5a7d31', '#9cb455', cards=True, scale=0.6)
        M = geo.Mesh(species + '-trunk', [bark])
        w = sp['w']
        cx = w / 2
        # trunk: tapers from r 13.5 at the base to 11 at the top (collision r 12)
        pts, radii = [], []
        for k in range(15):
            t = k / 14
            sy = -336 * t
            wob = 1.3 * math.sin(t * 7.0 + len(species)) + 0.8 * math.sin(t * 17.0)
            pts.append(P(cx + wob, sy, 12.0))
            radii.append(13.5 - 2.5 * t)
        M.tube(bark, pts, radii, segs=18)
        # root flare: roots spread along the ground on both sides and toward the viewer
        for i in range(7):
            a = -math.pi * 0.08 + math.pi * 1.16 * i / 6
            L = rng.uniform(22, 36)
            d = Vector((math.cos(a), -abs(math.sin(a)) * 0.9 - 0.2, 0.0)).normalized()
            base = Vector((cx, 12.0, 14.0))
            mid = base + d * (L * 0.5) + Vector((0, 0, -9.0))
            tip = base + d * L + Vector((0, 0, -13.5))
            M.tube(bark, [base, mid, tip], [8.0, 4.5, 1.2], segs=10)
        for _ in range(150):
            x = cx + rng.uniform(-40, 40)
            b = P(x, 0.0, rng.uniform(-4, 16))
            d = Vector((rng.uniform(-0.6, 0.6), rng.uniform(-0.3, 0.1), 1)).normalized()
            L = rng.uniform(4, 9)
            M.card(grass, b + d * L / 2, 1.5, L, Vector((0, -1, 0.2)), up=d)
        return [M.done(ctx['coll'])]
    return build


# ---------------------------------------------------------------- forest wall

FOREST_W = 117.5


def forest_frame():
    return (-10, -12, FOREST_W + 20, 412)


def forest_base_frame():
    return (-10, -74, FOREST_W + 20, 82)


def forest_column(variant):
    """A column of dense woodland, anchored at its top (y = 0 is the rect top):
    a leafy slab whose top edge rises into lobed crowns (at most ~9 px above
    the rect) and dips a few px between them, trunks glimpsed through pockets
    in the lower half, darkness behind."""
    def build(ctx):
        rng = random.Random(f'forest:{variant}')
        core = clump_mat(f'forest-core-{variant}', '#0b170b', '#132613', '#223e1f')
        pal = [('#1f3a1b', '#3f6b2b', '#7fa447'), ('#23401d', '#4a7a31', '#95b957'), ('#18301d', '#2f5636', '#5f8a4f')]
        cards = [(mats.leaves(f'forest-leaf-{variant}-{i}', *pal[i], cards=True, scale=0.4, translucent=0.14), wgt) for i, wgt in enumerate((0.5, 0.3, 0.35))]
        bark = mats.bark(f'forest-bark-{variant}', base='#4a3a2c', dark='#1e1510', light='#6d5b49', scale=1.0)
        M = geo.Mesh(f'forest-{variant}', [core])
        W = FOREST_W
        off = Vector((3.3 if variant == 'a' else 8.1, 1.7, 0.4))
        # darkness behind the leaves: a slab of dark clumps
        for k in range(14):
            for j in range(3):
                M.blob(core, P(8 + j * (W - 16) / 2 + rng.uniform(-5, 5), 34 + k * 28, 44.0), rng.uniform(22, 28), displace=0.25, freq=1.4, seed=3000 + k * 3 + j, subdiv=2)
        for tx in ((W * 0.25, W * 0.7) if variant == 'a' else (W * 0.15, W * 0.52, W * 0.88)):
            M.tube(bark, [P(tx, 430, 26), P(tx + rng.uniform(-3, 3), 200, 26), P(tx + rng.uniform(-6, 6), 60, 26)], [8.0, 6.5, 4.0], segs=10)

        def top_edge(x):
            # crowns: a few broad lobes, peaks ~8 px above the rect top, valleys ~5 px below
            return -1.5 - 7.0 * noise.noise(Vector((x * 0.05, 0.3, 0.0) ) + off) - 3.0 * abs(noise.noise(Vector((x * 0.13, 1.9, 0.0)) + off))

        def inside(q):
            sx, sy = q.x, -(q.y * SP + q.z * CP)
            if sx < -6 or sx > W + 6 or sy > 422: return None
            t = top_edge(sx)
            if sy < t: return None
            front = lobes(sx, sy)
            if q.y < front or q.y > 40: return None
            d_front = q.y - front
            d_top = (sy - t) * 0.9
            d_side = min(sx + 6, W + 6 - sx)
            d = min(d_front, d_top, d_side)
            if d == d_front:
                # the normal follows the lobes, so the key light models round tree forms
                gx = (lobes(sx + 2, sy) - lobes(sx - 2, sy)) / 4; gy = (lobes(sx, sy + 2) - lobes(sx, sy - 2)) / 4
                nrm = Vector((-gx * 2.2, -1, gy * 2.2))
            else:
                nrm = Vector((0, -0.3, 1)) if d == d_top else Vector((-1 if sx < W / 2 else 1, -0.3, 0))
            return (d, nrm.normalized())

        def lobes(sx, sy):
            # big rounded masses (tree crowns stacked down the wall) plus leafy detail
            return -10.0 * abs(noise.noise(Vector((sx * 0.028, sy * 0.024, 1.3)) + off)) ** 0.7 * 1.6 + 2.0 * noise.noise(Vector((sx * 0.09, sy * 0.09, 2.0)) + off) + 8.0
        box = (-8, -4, P(0, 440, 0).z - 20, W + 8, 40, P(0, -20, 0).z + 10)
        foliage_volume(M, cards, rng, inside, box, 52000, size=(3.5, 5.0), keep=0.22, clump=0.05, seed=11 if variant == 'a' else 29)
        return [M.done(ctx['coll'])]
    return build


def forest_base(ctx):
    """Undergrowth across the foot of a forest column: ferns, roots, stones."""
    rng = random.Random('forest-base')
    fern = mats.leaves('forest-fern', '#1d3a17', '#3e6d25', '#76a043', cards=True, scale=0.6, translucent=0.15)
    fern2 = mats.leaves('forest-fern-2', '#26401c', '#4f7329', '#8fae4f', cards=True, scale=0.6, translucent=0.15)
    core = clump_mat('forest-base-core', '#0d1a0d', '#1a301a', '#2d4a24')
    stone = mats.stone('forest-base-stone', [(0.2, '#4b4f4a'), (0.5, '#6f7269'), (0.8, '#979889')], scale=0.1, moss='#5f8a2e')
    M = geo.Mesh('forest-base', [core])
    W = FOREST_W
    for k in range(7):
        M.blob(core, P(-4 + k * (W + 8) / 6, -22, 26.0), 20, squash=(1, 1, 0.8), displace=0.25, freq=0.15, seed=500 + k, subdiv=2)
    for i in range(3):
        M.blob(stone, P(rng.uniform(10, W - 10), -6, rng.uniform(-8, 2)), rng.uniform(5, 8), squash=(1.3, 1, 0.7), displace=0.2, seed=i, subdiv=2)
    for _ in range(420):
        x = rng.uniform(-6, W + 6)
        b = P(x, 0.0, rng.uniform(-10, 24))
        a = rng.uniform(-1.2, 1.2)
        d = Vector((math.sin(a), rng.uniform(-0.6, 0.1), math.cos(a) * 1.2)).normalized()
        L = rng.uniform(14, 34) * (0.6 if abs(a) > 0.9 else 1.0)
        mat = fern if rng.random() < 0.6 else fern2
        # a frond: a chain of leaflets
        for k in range(int(L / 3.2)):
            t = k / max(1, int(L / 3.2))
            q = b + d * (L * t) + Vector((0, 0, -3.0 * t * t * L / 12))
            M.card(mat, q, 3.4 * (1 - 0.6 * t), 2.6, Vector((0, -1, 0.3)), up=d, twist=0.0)
    objs = [M.done(ctx['coll'])]
    return objs
