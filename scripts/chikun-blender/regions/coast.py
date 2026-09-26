"""Coast: the climax, sunset into moonlit night (sand terrain).

The beach is the near ground (Chikun runs on sand); the sea fills the far
ground bands, so the near and mid layers stand in the water: a pier, rocks,
moored boats, sea stacks, sailboats and the lighthouse headland.
Palette: sea #2E8FB1 -> #7DD5D8, deep #1C4B63, sand #E9D3A1, foam #F2F6F2.
"""
import math, random
import bmesh
from mathutils import Vector, Matrix, noise
from chikun_lib import kit, shading
from chikun_lib.periodic import Periodic1D, Periodic2D, smoothstep, ridged, Scatter
from chikun_lib.shading import srgb
from regions import common, urbankit as uk


def build(layer, ctx):
    return {'far': far, 'mid': mid, 'near': near, 'ground': ground, 'front': front}[layer](ctx)


def rock_stack(name, coll, mat, x, y, h, r, seed):
    bm = bmesh.new()
    rings = 10; segs = 12
    prof = []
    for i in range(rings + 1):
        t = i / rings
        prof.append((r * (1.0 - 0.45 * t) * (1 + 0.15 * math.sin(t * 7 + seed)), h * t))
    verts = []
    off = Vector((seed * 3.1, seed * 1.7, 0))
    for rr, z in prof:
        ring = []
        for k in range(segs):
            a = k / segs * math.tau
            p = Vector((math.cos(a) * rr, math.sin(a) * rr * 0.8, z))
            p += Vector((noise.noise(p * 0.12 + off) * rr * 0.35, noise.noise(p * 0.12 + off + Vector((5, 1, 3))) * rr * 0.3, 0))
            ring.append(bm.verts.new(p + Vector((x, y, 0))))
        verts.append(ring)
    for a, b in zip(verts, verts[1:]):
        for k in range(segs):
            bm.faces.new((a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]))
    bm.faces.new(verts[-1])
    bm.normal_update()
    return kit.mesh_object(name, bm, coll, mat, smooth=True)


def sailboat(coll, hull, sail, x, y, s, rng, lit=None):
    kit.box(f'hull{x:.0f}', coll, hull, x, y, 0, 18 * s, 5 * s, 3 * s)
    kit.box(f'mast{x:.0f}', coll, shading.flat('mast', '#d8d2c4'), x, y, 3 * s, 0.6 * s, 0.6 * s, 26 * s)
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(x - 0.3 * s, y - 0.5, 4 * s), (x - 0.3 * s, y - 0.5, 28 * s), (x - 9 * s, y - 0.5, 4.5 * s)]]
    bm.faces.new(v)
    v = [bm.verts.new(p) for p in [(x + 0.3 * s, y - 0.5, 6 * s), (x + 0.3 * s, y - 0.5, 24 * s), (x + 7 * s, y - 0.5, 6 * s)]]
    bm.faces.new(v)
    kit.mesh_object('sail', bm, coll, sail)
    if lit is not None:
        kit.sphere(f'nav{x:.0f}', coll, lit, x, y - 2.6 * s, 29 * s, 0.9 * s, subdiv=1)


def foam_ring(coll, mat, x, y, r):
    kit.sphere(f'foam{x:.0f}', coll, mat, x, y, 0.2, r, subdiv=2, squash=(1.3, 0.7, 0.12), displace=0.35, seed=int(x))


# ---------------------------------------------------------------- FAR
def far(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#c6d6de'), y0=0.0, y1=320.0, near=0.14, far=0.48))
    rng = random.Random('coast-far')
    rock = shading.terrain('isle', [(0.3, '#5d6f6a'), (0.7, '#7b8c7c')], W, scale=0.04, bump=0.3)
    for k, (ix, iy, rx, ry, hh) in enumerate([(120, 240, 150, 50, 46), (520, 260, 90, 30, 28), (880, 230, 200, 60, 58), (1180, 250, 70, 24, 22)]):
        kit.island(f'isle{k}', coll, rock, ix, iy, rx, ry, lambda x, y, ix=ix, iy=iy, rx=rx, ry=ry, hh=hh: hh * max(0.0, 1 - ((x - ix) / rx) ** 2 - ((y - iy) / ry) ** 2) ** 0.7 * (1 + 0.25 * noise.noise(Vector((x * 0.03, y * 0.03, 2.0)))))
    hull = shading.flat('shiphull', '#4a4f55', rough=0.6)
    deck = shading.wall('shipdeck', '#d9d6cc', window=dict(w=1.6, h=1.4, cols_px=3.0, rows_px=3.2, x0=0, z0=0, z_min=4.0, z_max=40, glass='#39424b', lit='#ffe2a0', lit_prob=0.7))
    for sx in (260, 700, 1090):
        s = rng.uniform(0.8, 1.2)
        kit.box(f'ship{sx}', coll, hull, sx, 120, 0, 60 * s, 8, 6 * s)
        kit.box(f'shipsup{sx}', coll, deck, sx + 14 * s, 120, 6 * s, 16 * s, 6, 10 * s)
        kit.cylinder(f'funnel{sx}', coll, shading.flat('funnel', '#b8412f'), sx + 18 * s, 120, 16 * s, 2.2 * s, 6 * s, segs=10)
    return {'emissive': True}


# ---------------------------------------------------------------- MID
def mid(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#c8d8e0'), y0=0.0, y1=260.0, near=0.04, far=0.28))
    rng = random.Random('coast-mid')
    stone = common.mountain_material(W, rock=('#5b554d', '#8a8174'), snow='#9aa08a', snow_line=46.0, name='cliffrock')
    foam = shading.flat('mfoam', '#eef4f2', rough=0.9, jitter=0.05)
    # Headland: a cliff mass rising from the sea on the right of the tile.
    def head(x, y):
        e = max(0.0, 1 - ((x - 1000) / 170.0) ** 2 - ((y - 150) / 110.0) ** 2)
        return 78 * e ** 0.55 * (1 + 0.18 * noise.noise(Vector((x * 0.02, y * 0.02, 1.0))))
    kit.island('headland', coll, stone, 1000, 150, 170, 110, head)
    foam_ring(coll, foam, 1000, 50, 150)
    grass = shading.foliage('capgrass', '#4d6a3a', '#66844a', '#86a05c', scale=0.3)
    cap = kit.tree_proto('capbush', coll, common.mats_basic()['bark'], grass, 'bush', 9, seed=610)
    for i in range(160):
        a = rng.uniform(0, math.tau); t = rng.uniform(0, 0.75) ** 0.5
        x, y = 1000 + math.cos(a) * 170 * t, 150 + math.sin(a) * 110 * t
        if head(x, y) > 30: kit.instance(cap, coll, (x, y, head(x, y) - 1), scale=rng.uniform(0.7, 1.3))
    # Lighthouse (landmark).
    lx, ly = 1010, 170; lz = head(lx, ly) - 2
    stripe = shading.material('lhstripe', lambda nb: dict(color=nb.mix('#efeae0', '#c0392b', nb.math('GREATER_THAN', nb.math('FRACT', nb.math('DIVIDE', nb.separate(nb.texcoord().outputs['Object'])[2], 14.0)), 0.5)), rough=0.6))
    kit.cylinder('lh', coll, stripe, lx, ly, lz, 8, 70, segs=16, r_top=5.5)
    kit.cylinder('lhgallery', coll, shading.flat('lhgal', '#2e3236'), lx, ly, lz + 70, 7.5, 2, segs=16)
    lamp = shading.lamp('lhlamp', color='#ffe3a0', body='#dfe8e8', strength=1.0)
    kit.cylinder('lhlamp', coll, lamp, lx, ly, lz + 72, 4.2, 7, segs=12)
    kit.cylinder('lhcap', coll, shading.flat('lhcap', '#8e2d22'), lx, ly, lz + 79, 5.4, 6, segs=12, r_top=0.5)
    kit.box('keeper', coll, shading.wall('keeper', '#efe8d8', window=dict(w=2.4, h=3, cols_px=6, rows_px=8, x0=0, z0=2, z_min=2, z_max=14, glass='#2a3036', lit='#ffd48c', lit_prob=0.8)), lx + 22, ly + 4, lz - 1, 20, 12, 12)
    kit.gable_roof('keeperroof', coll, shading.roof('keeperroof', '#8e3a2c', tile=1.4), lx + 22, ly + 4, lz + 11, 20, 12, 6)
    # Sea stacks with foam at the waterline.
    for sx, h, r in [(170, 70, 14), (240, 44, 10), (520, 58, 12), (600, 30, 8)]:
        rock_stack(f'stack{sx}', coll, stone, sx, 60 + rng.uniform(-10, 20), h, r, seed=sx)
        foam_ring(coll, foam, sx, 58, r * 1.4)
    hull = [shading.flat(f'hull{i}', c, rough=0.5) for i, c in enumerate(['#efe8dc', '#2f4f6f', '#8e2d22'])]
    sail = shading.flat('sail', '#f4efe2', rough=0.9)
    nav = shading.lamp('nav', color='#ffe7b0', body='#dddddd', strength=1.0)
    for bx in (360, 720, 860, 1200):
        sailboat(coll, rng.choice(hull), sail, bx, rng.uniform(40, 110), rng.uniform(0.9, 1.2), rng, lit=nav)
    return {'emissive': True, 'landmarks': [{'id': 'lighthouse', 'u': lx}], 'anchors': [dict(id='lighthouse', kind='beam', at=(lx, ly - 4.5, lz + 75.5))]}


# ---------------------------------------------------------------- NEAR
NEAR_W = 2560


def near(ctx):
    W = NEAR_W
    coll = common.tile(ctx, W, dict(color=srgb('#c8d8e0'), y0=0.0, y1=120.0, near=0.0, far=0.06))
    rng = random.Random('coast-near')
    wood = shading.flat('pierwood', '#7a5f45', rough=0.9, jitter=0.15)
    foam = shading.flat('nfoam', '#f2f6f2', rough=0.9, jitter=0.05)
    rock = shading.flat('nrock', '#5f5850', rough=0.95, jitter=0.2)
    # Pier segments on piles.
    for px0, px1 in [(120, 760), (1500, 2080)]:
        kit.box(f'deck{px0}', coll, wood, (px0 + px1) / 2, 50, 20, px1 - px0, 16, 3)
        for x in range(px0, px1 + 1, 30):
            for dy in (-7, 7):
                kit.cylinder(f'pile{x}{dy}', coll, wood, x, 50 + dy, -4, 1.8, 24, segs=8)
                foam_ring(coll, foam, x, 50 + dy - 1, 2.6)
        for x in range(px0, px1 + 1, 30): kit.box(f'post{x}', coll, wood, x, 43, 23, 1.4, 1.4, 12)
        kit.box(f'rail{px0}', coll, wood, (px0 + px1) / 2, 43, 33, px1 - px0, 1.2, 1.4)
    lamp = shading.lamp('pierlamp', color='#ffd48c', body='#e9e2cc', strength=1.0)
    iron = shading.flat('iron', '#2e3034', rough=0.5)
    for x in (240, 520, 1640, 1960):
        uk.street_lamp(coll, iron, lamp, x, 44, 23, h=30, arm=4)
    # Rock outcrops with foam, moored boats and buoys.
    for cx in Scatter(620).slots(W, 260, jitter=0.4):
        if 700 < cx < 1500 or cx > 2150 or cx < 100:
            for k in range(rng.randint(2, 4)):
                x = cx + rng.uniform(-30, 30); r = rng.uniform(6, 14)
                o = kit.instance(common.rock_proto(rock, r=r, seed=int(x)), coll, (x, rng.uniform(30, 70), -r * 0.3))
                foam_ring(coll, foam, x, 30, r * 1.3)
    hull = [shading.flat(f'nhull{i}', c, rough=0.5) for i, c in enumerate(['#e8e2d6', '#3a5f7f', '#b04a34'])]
    sail = shading.flat('nsail', '#f4efe2', rough=0.9)
    for bx in (900, 1180, 2250):
        sailboat(coll, rng.choice(hull), sail, bx, rng.uniform(60, 90), 1.7, rng)
    buoy = shading.material('buoy', lambda nb: dict(color=nb.mix('#c0392b', '#f2eee4', nb.math('GREATER_THAN', nb.math('FRACT', nb.math('DIVIDE', nb.separate(nb.texcoord().outputs['Object'])[2], 4.0)), 0.5)), rough=0.5))
    for bx in Scatter(621).slots(W, 330, jitter=0.5):
        kit.cylinder(f'buoy{bx:.0f}', coll, buoy, bx, 20, -1, 2.6, 9, segs=12, r_top=1.2)
        foam_ring(coll, foam, bx, 19, 4)
    return {'emissive': True}


# ---------------------------------------------------------------- GROUND / FRONT
def ground(ctx):
    from regions import groundkit
    coll, root = groundkit.ground_tile(ctx)
    sea = [(0.25, '#1f5f7c'), (0.55, '#2e8fb1'), (0.85, '#58b6c6')]
    mat = groundkit.ground_material('coast_ground', sea, [
        (605, 612, [(0.3, '#7ccfd2'), (0.6, '#b8e6e0'), (0.9, '#eef6f2')], 0.8),
        (612, 628, [(0.25, '#9a8a66'), (0.55, '#ae9d77'), (0.85, '#c2b088')], 1.0),
        (628, 693, [(0.25, '#d2bb8a'), (0.55, '#e1c997'), (0.85, '#ecd6a6')], 1.2),
    ], scale=0.16, stripes=[(560, 605, 140.0, '#eaf4f0', 0.35), (628, 693, 260.0, '#c8ae7e', 0.3)], speckle=('#f4f6f0', 0.04, 0.03))
    groundkit.plane(root, mat)
    rng = random.Random('coast-ground')
    shell = shading.flat('shell', '#f1e7d6', rough=0.6, jitter=0.25)
    shells = [kit.prop_proto(f'shell{i}', lambda bm, i=i: bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.8 + 0.3 * i, matrix=Matrix.Diagonal((1.3, 1, 0.5, 1))), [shell]) for i in range(3)]
    groundkit.scatter_front(coll, shells, 640, 690, 14.0, rng)
    grass = [common.grass_tuft_proto(shading.flat('marram', '#9aa86a', jitter=0.2), h=3.5 + i, seed=630 + i, spread=1.8) for i in range(2)]
    groundkit.scatter_front(coll, grass, 660, 690, 40.0, rng)
    return {'focal': groundkit.FOCAL}


def front(ctx):
    from regions import groundkit
    return groundkit.front_face(ctx, soil=['#c8ae7c', '#dcc394', '#a88c60'], lip='#9aa86a', lip_dark='#b39a6c', pebbles='#efe4d0', roots='#8a7050', seed=7, grass=False)
