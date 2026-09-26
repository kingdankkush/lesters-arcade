"""Suburbs: afternoon into golden hour (pavement terrain).

Palette: mint #A9D6C3, butter #F2DA8B, blush #EA9C85, powder #A8C6E6,
lawn #80B34F, lavender shadow #6C6A8C. Night: porch #FFD07C, TV #7FB9FF.
"""
import math, random
import bmesh
from mathutils import Vector, Matrix
from chikun_lib import kit, shading
from chikun_lib.periodic import Periodic1D, Periodic2D, smoothstep, Scatter
from chikun_lib.shading import srgb
from regions import common, urbankit as uk

WALLS = ['#a9d6c3', '#f2da8b', '#ea9c85', '#a8c6e6', '#efe6d4', '#d9c3e0', '#c9dcb8', '#f4c9a8']
ROOFS = ['#6c6a8c', '#5b4d4a', '#7a5a4e', '#4f5a66', '#8a6a5e']


def build(layer, ctx):
    return {'far': far, 'mid': mid, 'near': near, 'ground': ground, 'front': front}[layer](ctx)


def house_wall(name, colour, scale=1.0, lit=0.45):
    return shading.wall(name, colour, window=dict(w=3.2 * scale, h=3.4 * scale, cols_px=8.5 * scale, rows_px=9.5 * scale, x0=2.0 * scale, z0=2.5 * scale, z_min=3.0 * scale, z_max=1e9, glass='#2a3642', glass_hi='#6f8ea8', frame=0.6 * scale, frame_color='#f6f2ea', lit='#ffd07c', lit2='#9fc6ff', lit_prob=lit, building_lit=0.8),
                        trim=[(0, 1.0 * scale, '#8a8378')])


def pylon(coll, mat, x, y, h):
    bm = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            m = Matrix.Translation((x + sx * 4, y + sy * 3, h / 2)) @ Matrix.Rotation(-sx * 0.08, 4, 'Y') @ Matrix.Diagonal((0.7, 0.7, h, 1))
            bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    for z, w in ((h * 0.72, 22), (h * 0.9, 16), (h * 0.55, 12)):
        kit._bm_box(bm, x, y, z, w, 1.0, 0.8)
    kit.mesh_object('pylon', bm, coll, mat)


# ---------------------------------------------------------------- FAR
def far(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#c3cfd8'), y0=0.0, y1=320.0, near=0.14, far=0.45))
    rng = random.Random('sub-far')
    for k, (y, base, amp, col, seed) in enumerate([(200, 30, 44, '#6f8f76', 501), (110, 18, 28, '#7a9a6a', 502), (30, 10, 16, '#86a468', 503)]):
        p = Periodic1D(seed, W, k_min=1, k_max=10, beta=1.3)
        hf = lambda x, yy, p=p, base=base, amp=amp, y=y: (base + amp * (0.5 + 0.5 * p(x))) * smoothstep(0, 1, (yy - y) / 50)
        mat = shading.terrain(f'shill{k}', [(0.3, col), (0.7, '#9ab07a')], W, scale=0.03, bump=0.2)
        kit.heightfield(f'shill{k}', coll, mat, 0, W, y, y + 80, 5.0, 8.0, hf)
        leaf = shading.foliage(f'sft{k}', '#2e4a30', '#46683c', '#5f8248', scale=0.4)
        tp = kit.tree_proto(f'sfp{k}', coll, common.mats_basic()['bark'], leaf, 'round', 10, seed=510 + k)
        for tx in Scatter(520 + k).slots(W, 9, jitter=0.5):
            if rng.random() < 0.55:
                ty = rng.uniform(y + 30, y + 70)
                kit.instance(tp, coll, (tx, ty, hf(tx, ty) - 0.5), scale=rng.uniform(0.7, 1.3))
        if k == 1:
            steel = shading.flat('pylon', '#9aa0a4', rough=0.5)
            for px in range(40, W, 160):
                py = y + 50
                pylon(coll, steel, px, py, 44)
            wire = shading.flat('wire', '#4a4d50', period=W)
            for dz in (32, 40):
                kit.box(f'wire{dz}', coll, wire, W / 2, y + 50, hf(0, y + 50) + dz, W, 0.4, 0.4)
    return {}


# ---------------------------------------------------------------- MID
def mid(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#c3cfd8'), y0=0.0, y1=260.0, near=0.04, far=0.28))
    rng = random.Random('sub-mid')
    p = Periodic1D(530, W, k_min=1, k_max=8, beta=1.3)
    h = lambda x, y: smoothstep(0, 30, y) * (y * 0.08 + 6 * p(x))
    lawn = shading.terrain('mlawn', [(0.3, '#6f9a48'), (0.7, '#86ad56')], W, scale=0.04)
    kit.heightfield('base', coll, lawn, 0, W, 0, 260, 8.0, 8.0, h)
    walls = [house_wall(f'mw{i}', c, 0.8) for i, c in enumerate(WALLS)]
    roofs = [shading.roof(f'mr{i}', c, tile=1.4) for i, c in enumerate(ROOFS)]
    leaf = shading.foliage('mleaf', '#2b4a2c', '#46703a', '#6a9450', scale=0.25)
    trees = [kit.tree_proto(f'mt{i}', coll, common.mats_basic()['bark'], leaf, 'round', 20 + 5 * i, seed=540 + i) for i in range(3)]
    for row, y in enumerate([30, 70, 110, 150, 190, 230]):
        x = rng.uniform(0, 20)
        while x < W - 10:
            w = rng.uniform(18, 26)
            if abs(x - 700) < 40 and 90 < y < 170: x += 50; continue
            objs = uk.townhouse(coll, f's{row}_{x:.0f}', x + w / 2, y + rng.uniform(-4, 4), w, 14, rng.uniform(10, 16), rng.choice(walls), rng.choice(roofs), rng, style=rng.choice(['side', 'hip', 'side']), roof_h=w * 0.45)
            uk.place(objs, h(x + w / 2, y) - 1)
            if rng.random() < 0.8:
                tx = x + w + rng.uniform(3, 8)
                kit.instance(rng.choice(trees), coll, (tx, y + 4, h(tx, y) - 1), scale=rng.uniform(0.7, 1.1))
            x += w + rng.uniform(12, 24)
    # School: a long low building with a flagpole.
    school = house_wall('school', '#d8b48c', 0.9, lit=0.3)
    kit.box('school', coll, school, 380, 120, h(380, 120) - 1, 110, 24, 18)
    kit.box('schoolroof', coll, shading.flat('sroof', '#5e5a58'), 380, 120, h(380, 120) + 17, 112, 26, 2)
    # Landmark water tower.
    wx, wy = 700, 130; wz = h(wx, wy) - 1
    steel = shading.flat('wtsteel', '#8fa6ad', rough=0.4, spec=0.5)
    for dx, dy in ((-8, -6), (8, -6), (-8, 6), (8, 6)):
        leg = kit.box(f'wtleg{dx}{dy}', coll, steel, 0, 0, 0, 1.6, 1.6, 62)
        leg.location = (wx + dx, wy + dy, wz); leg.rotation_euler = (math.atan2(dy, 60) * 0.6, -math.atan2(dx, 60) * 0.6, 0)
    kit.cylinder('wttank', coll, shading.flat('wttank', '#b9d0d6', rough=0.4, spec=0.5), wx, wy, wz + 60, 17, 22, segs=24)
    kit.cylinder('wtroof', coll, steel, wx, wy, wz + 82, 18, 8, segs=24, r_top=1.0)
    kit.box('wtband', coll, shading.flat('wtband', '#d65a4a'), wx, wy - 17.2, wz + 67, 14, 0.6, 6)
    return {'emissive': True, 'landmarks': [{'id': 'watertower', 'u': wx}]}


# ---------------------------------------------------------------- NEAR
NEAR_W = 2560


def near(ctx):
    W = NEAR_W
    coll = common.tile(ctx, W, dict(color=srgb('#c3cfd8'), y0=0.0, y1=120.0, near=0.0, far=0.06))
    rng = random.Random('sub-near')
    lawn = shading.terrain('nlawn', [(0.3, '#6d9a45'), (0.6, '#80b34f'), (0.9, '#94c05e')], W, scale=0.06, bump=0.4)
    kit.heightfield('lawn', coll, lawn, 0, W, 0, 100, 8.0, 8.0, lambda x, y: smoothstep(0, 20, y) * 3.0)
    walls = [house_wall(f'nw{i}', c, 1.6) for i, c in enumerate(WALLS)]
    roofs = [shading.roof(f'nr{i}', c, tile=2.4) for i, c in enumerate(ROOFS)]
    white = shading.flat('trim', '#f4f0e6', rough=0.7)
    porch = shading.lamp('porch', color='#ffd07c', body='#e9e0c8', strength=0.9)
    leaf = shading.foliage('nleaf', '#28462a', '#436c38', '#658f4c', scale=0.12)
    tree = kit.tree_proto('ntree', coll, common.mats_basic()['bark'], leaf, 'round', 92, seed=560)
    hedge = [kit.tree_proto(f'nh{i}', coll, common.mats_basic()['bark'], leaf, 'bush', 16 + 4 * i, seed=565 + i) for i in range(2)]
    x = 30.0
    while x < W - 150:
        w = rng.uniform(70, 96); d = 36; hh = rng.uniform(40, 52); y = 62
        uk.townhouse(coll, f'h{x:.0f}', x + w / 2, y, w, d, hh, rng.choice(walls), rng.choice(roofs), rng, style=rng.choice(['side', 'front', 'side']), roof_h=w * 0.4, chimney=white if rng.random() < 0.4 else None)
        # Porch with a lamp.
        kit.box(f'porch{x:.0f}', coll, white, x + w * 0.3, y - d / 2 - 5, 16, w * 0.35, 10, 1.5)
        for dx in (-w * 0.16, w * 0.16): kit.box(f'pp{x:.0f}{dx:.0f}', coll, white, x + w * 0.3 + dx, y - d / 2 - 9, 0, 1.2, 1.2, 16)
        kit.sphere(f'pl{x:.0f}', coll, porch, x + w * 0.3, y - d / 2 - 1, 13, 1.5, subdiv=1)
        # Picket fence along the front.
        common.fence_picket(coll, white, x - 6, x + w + 6, 16, h=12.0, spacing=4.5)
        # Mailbox.
        kit.box(f'mb{x:.0f}', coll, white, x + w + 10, 14, 0, 1.2, 1.2, 12)
        kit.box(f'mbb{x:.0f}', coll, shading.flat('mailbox', '#3f5a86'), x + w + 10, 14, 12, 5, 3, 3.2)
        for hx in range(int(x + w * 0.55), int(x + w), 9):
            kit.instance(rng.choice(hedge), coll, (hx, 30, 0.5), scale=rng.uniform(0.7, 1.0))
        gap = rng.uniform(40, 110)
        kit.instance(tree, coll, (x + w + gap / 2 + 10, 80, 0.5), scale=rng.uniform(0.8, 1.05), rot_z=rng.uniform(0, 6.28))
        x += w + gap + 20
    # A swing set in one yard.
    sx = 1180
    steel = shading.flat('swing', '#c24a3a', rough=0.5)
    for dx in (-14, 14):
        for dy in (-5, 5):
            leg = kit.box(f'sw{dx}{dy}', coll, steel, 0, 0, 0, 1.2, 1.2, 30)
            leg.location = (sx + dx, 40 + dy, 0); leg.rotation_euler = (math.atan2(-dy, 30), 0, 0)
    kit.box('swbar', coll, steel, sx, 40, 29, 30, 1.2, 1.2)
    for dx in (-6, 6):
        kit.box(f'swseat{dx}', coll, shading.flat('seat', '#2e3a44'), sx + dx, 40, 8, 5, 3, 0.8)
    return {'emissive': True}


# ---------------------------------------------------------------- GROUND / FRONT
def ground(ctx):
    from regions import groundkit
    coll, root = groundkit.ground_tile(ctx)
    lawn_a = [(0.25, '#5f8a3c'), (0.55, '#6f9a45'), (0.85, '#80a952')]
    mat = groundkit.ground_material('sub_ground', [(0.3, '#6a9442'), (0.6, '#79a44c'), (0.9, '#8ab35a')], [
        (598, 612, [(0.3, '#8d8b85'), (0.6, '#9d9b94'), (0.9, '#adaba3')], 1.0),
        (612, 640, [(0.25, '#4a4f55'), (0.55, '#565c62'), (0.85, '#62686e')], 0.8),
        (640, 650, [(0.3, '#9c9a93'), (0.6, '#acaaa2'), (0.9, '#bcbab1')], 0.8),
        (650, 693, lawn_a, 1.0),
    ], scale=0.2, stripes=[(650, 693, 140.0, '#5a8238', 0.55), (598, 612, 60.0, '#77756f', 0.4)])
    groundkit.plane(root, mat)
    paint = shading.flat('centreline', '#e3c85a', rough=0.6)
    bm = bmesh.new()
    y0, y1 = groundkit.depth_of_row(626.8), groundkit.depth_of_row(625.6)
    x = 0.0
    while x < groundkit.PERIOD:
        kit._bm_box(bm, x + 24, (y0 + y1) / 2, 0.0, 48, y1 - y0, 0.2); x += 96
    kit.mesh_object('centre', bm, coll, paint)
    rng = random.Random('sub-ground')
    tufts = [common.grass_tuft_proto(shading.flat('g_lawn', '#6b9a44', jitter=0.2), h=2.5 + i * 0.6, seed=580 + i, spread=1.6) for i in range(3)]
    groundkit.scatter_front(coll, tufts, 668, 690, 5.0, rng)
    return {'focal': groundkit.FOCAL}


def front(ctx):
    from regions import groundkit
    return groundkit.block_face(ctx, ['#8f8d86', '#a3a199'], '#6b6962', '#c2c0b8', seed=6, block=(58.0, 26.0), cap_h=4.0, lip='#6d9a44')
