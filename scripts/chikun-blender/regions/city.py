"""City: night into a golden-pink dawn, then morning (asphalt terrain).

Palette: steel #3C5972, glass #6FA5B8, asphalt #3B4248. Night: neon #FF4FA8,
#3FE3FF, #FFC15A, sodium #FFB050.
"""
import math, random
import bmesh
from mathutils import Vector, Matrix
from chikun_lib import kit, shading
from chikun_lib.periodic import Periodic1D, smoothstep, Scatter
from chikun_lib.shading import srgb
from regions import common, urbankit as uk

GLASS = ['#3c5972', '#4b6a80', '#5e7f92', '#34495c', '#6f8796', '#566676']
STONE = ['#8c8a86', '#a09a90', '#7b7f86', '#b3aa9b', '#6f7780']


def build(layer, ctx):
    return {'far': far, 'mid': mid, 'near': near, 'ground': ground, 'front': front}[layer](ctx)


def office(name, colour, scale=1.0, lit=0.5, strip=False, seed=0, building_lit=1.0):
    if strip:
        win = dict(w=4.6 * scale, h=2.2 * scale, cols_px=5.0 * scale, rows_px=4.0 * scale, x0=0.0, z0=1.0 * scale, z_min=3.0 * scale, z_max=1e9, glass='#1d2a36', glass_hi='#4f6d82', lit='#ffe0a8', lit2='#bfe6ff', lit_prob=lit, building_lit=building_lit)
    else:
        win = dict(w=2.4 * scale, h=3.0 * scale, cols_px=4.0 * scale, rows_px=4.6 * scale, x0=0.5 * scale, z0=1.0 * scale, z_min=3.0 * scale, z_max=1e9, glass='#1d2a36', glass_hi='#4f6d82', lit='#ffd89a', lit2='#cfe8ff', lit_prob=lit, building_lit=building_lit)
    return shading.wall(name, colour, window=win, rough=0.6)


def blinker(coll, x, y, z, r=1.4, name='blink'):
    kit.sphere(name, coll, shading.lamp('blinkred', color='#ff3a2e', body='#6b2020', strength=1.0), x, y, z, r, subdiv=1)


# ---------------------------------------------------------------- FAR
def far(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#aebcc8'), y0=0.0, y1=300.0, near=0.2, far=0.55))
    rng = random.Random('city-far')
    top = shading.flat('roofdark', '#3a434c', rough=0.7)
    walls = [office(f'fo{i}', c, 1.2, 0.42, strip=(i % 2 == 0), building_lit=0.5) for i, c in enumerate(GLASS + STONE)]
    for band, (y0, y1, hmin, hmax, step) in enumerate([(160, 300, 90, 185, 26), (40, 150, 50, 130, 22)]):
        x = rng.uniform(0, 10)
        while x < W:
            w = rng.uniform(16, 38)
            y = rng.uniform(y0, y1); hh = rng.uniform(hmin, hmax) * (1.0 - 0.35 * (y - y0) / (y1 - y0) if band == 0 else 1.0)
            uk.tower(coll, f'f{band}_{x:.0f}', x + w / 2, y, w, rng.uniform(14, 26), hh, rng.choice(walls), top, rng, crown=rng.choice(['units', 'setback', None]))
            if hh > 150 and rng.random() < 0.6:
                kit.cylinder(f'ant{x:.0f}', coll, top, x + w / 2, y, hh + 1.6, 0.6, 18, segs=6)
                blinker(coll, x + w / 2, y - 0.5, hh + 20, name=f'bl{x:.0f}')
            x += w + rng.uniform(1, step * 0.4)
    return {'emissive': True}


# ---------------------------------------------------------------- MID
def mid(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#b4c0ca'), y0=0.0, y1=260.0, near=0.04, far=0.3))
    rng = random.Random('city-mid')
    top = shading.flat('mroof', '#3a434c', rough=0.7)
    walls = [office(f'mo{i}', c, 1.0, 0.45, strip=(i % 3 == 0), building_lit=0.6) for i, c in enumerate(GLASS + STONE)]
    ground = shading.flat('plaza', '#5d636a', rough=0.9, period=W)
    kit.box('plaza', coll, ground, W / 2, 130, -2, W, 260, 2)
    for row, y in enumerate([200, 150, 100]):
        x = rng.uniform(0, 10)
        while x < W:
            w = rng.uniform(22, 44)
            if abs(x + w / 2 - 880) < 30 and row == 0: x += 40; continue
            hh = rng.uniform(40, 150) * (1.0 + 0.25 * row)
            uk.tower(coll, f'm{row}_{x:.0f}', x + w / 2, y + rng.uniform(-8, 8), w, rng.uniform(18, 28), hh, rng.choice(walls), top, rng, crown=rng.choice(['units', 'setback', None, 'units']))
            x += w + rng.uniform(2, 10)
    # Elevated viaduct with arches and a parked train.
    concrete = shading.flat('viaduct', '#7c7a74', rough=0.9, jitter=0.1, period=W)
    kit.box('deck', coll, concrete, W / 2, 50, 30, W, 12, 4)
    for x in range(0, W, 40):
        kit.box(f'pier{x}', coll, concrete, x + 20, 50, 0, 5, 10, 30)
    train = shading.wall('train', '#c9ced2', window=dict(w=3.4, h=2.4, cols_px=5.0, rows_px=8.0, x0=0.0, z0=36.5, z_min=35.0, z_max=40.0, glass='#1f2a33', lit='#fff0c8', lit_prob=0.9), rough=0.4)
    for k in range(5):
        kit.box(f'car{k}', coll, train, 300 + k * 27, 50, 34, 25, 8, 8)
    # Landmark spire tower.
    sx, sy = 880, 200
    spire = office('spire', '#44657c', 1.0, 0.5, strip=True)
    kit.box('spire0', coll, spire, sx, sy, 0, 36, 26, 120)
    kit.box('spire1', coll, spire, sx, sy, 120, 28, 20, 40)
    kit.box('spire2', coll, spire, sx, sy, 160, 18, 14, 24)
    kit.cylinder('spire3', coll, shading.flat('spiretop', '#c7ccd0', rough=0.3, spec=0.6), sx, sy, 184, 5, 22, segs=8, r_top=0.4)
    blinker(coll, sx, sy - 1, 207, r=1.6, name='spireblink')
    crown = shading.lamp('crownlight', color='#9fe4ff', body='#7b8f9c', strength=1.0)
    kit.box('crownband', coll, crown, sx, sy - 0.2, 180, 19, 14.6, 2)
    leaf = shading.foliage('cleaf', '#223822', '#365532', '#4e7040', scale=0.3)
    trees = [kit.tree_proto(f'ct{i}', coll, common.mats_basic()['bark'], leaf, 'round', 16 + 4 * i, seed=300 + i) for i in range(2)]
    for x in Scatter(301).slots(W, 36, jitter=0.4):
        kit.instance(rng.choice(trees), coll, (x, 22, 0), scale=rng.uniform(0.8, 1.1))
    return {'emissive': True, 'landmarks': [{'id': 'spire', 'u': sx}]}


# ---------------------------------------------------------------- NEAR
NEAR_W = 2560


def near(ctx):
    W = NEAR_W
    coll = common.tile(ctx, W, dict(color=srgb('#b4c0ca'), y0=0.0, y1=120.0, near=0.0, far=0.06))
    rng = random.Random('city-near')
    walk = shading.terrain('sidewalk', [(0.3, '#7a7c7c'), (0.7, '#8e908e')], W, scale=0.3, bump=0.4)
    kit.heightfield('walk', coll, walk, 0, W, 0, 50, 8.0, 10.0, lambda x, y: 0.0)
    brick = [shading.wall(f'brick{i}', c, window=dict(w=5.2, h=7.0, cols_px=10.0, rows_px=13.0, x0=1.0, z0=24.0, z_min=26.0, z_max=1e9, glass='#1b242c', glass_hi='#3d5566', frame=0.8, frame_color='#d9d2c4', lit='#ffcf8a', lit_prob=0.5, building_lit=0.6), rough=0.85,
                          trim=[(0, 22.0, '#2b2f33')]) for i, c in enumerate(['#8a4a3a', '#6f5a4e', '#9a7a5e', '#5d6670', '#7b6a5a'])]
    top = shading.flat('ntop', '#2e3238')
    neon = [shading.lamp(f'neon{i}', color=c, body='#2a2d33', strength=1.0) for i, c in enumerate(['#ff4fa8', '#3fe3ff', '#ffc15a', '#8dff7a'])]
    shopglass = shading.lamp('shopwindow', color='#ffc98a', body='#26313a', strength=0.5)
    iron = shading.flat('fire', '#23262a', rough=0.5, spec=0.4)
    sodium = shading.lamp('sodium', color='#ffb050', body='#dcd2b8', strength=1.1)
    x = 10.0
    while x < W - 40:
        w = rng.uniform(46, 74)
        if x + w > W - 8: break
        hh = rng.uniform(80, 128)
        y = 40
        uk.tower(coll, f'b{x:.0f}', x + w / 2, y, w - 1, 30, hh, rng.choice(brick), top, rng, crown=rng.choice(['units', None]))
        kit.box(f'shop{x:.0f}', coll, shopglass, x + w / 2, y - 15.2, 3, w * 0.7, 0.6, 14)
        if rng.random() < 0.6:
            # Neon icon sign (a bar or a disc), no text.
            m = rng.choice(neon)
            if rng.random() < 0.5: kit.box(f'neon{x:.0f}', coll, m, x + w / 2, y - 16.5, 19, w * 0.5, 1.0, 3.0)
            else: kit.cylinder(f'neond{x:.0f}', coll, m, 0, 0, -0.5, 5.0, 1.0, segs=20).location = (x + 6, y - 20, 34)
        if rng.random() < 0.5:
            # Fire escape: landings and ladders on the facade.
            for fz in range(34, int(hh) - 10, 16):
                kit.box(f'fe{x:.0f}{fz}', coll, iron, x + w * 0.62, y - 16, fz, w * 0.3, 3.0, 0.8)
                kit.box(f'fr{x:.0f}{fz}', coll, iron, x + w * 0.62, y - 17.4, fz + 3.5, w * 0.3, 0.4, 0.5)
        x += w + (rng.uniform(40, 110) if rng.random() < 0.35 else rng.uniform(0, 3))
    leaf = shading.foliage('streettree', '#1f3622', '#34522f', '#4b6c3d', scale=0.14)
    tree = kit.tree_proto('stree', coll, common.mats_basic()['bark'], leaf, 'round', 64, seed=320)
    for tx in Scatter(321).slots(W, 180, jitter=0.4):
        kit.instance(tree, coll, (tx, 12, 0), scale=rng.uniform(0.85, 1.05), rot_z=rng.uniform(0, 6.28))
    for lx in Scatter(322).slots(W, 150, jitter=0.2):
        uk.street_lamp(coll, iron, sodium, lx, 4, 0, h=52, arm=10)
    body = [shading.flat(f'carbody{i}', c, rough=0.35, spec=0.6) for i, c in enumerate(['#8e1f22', '#1f3f66', '#c9c3b6', '#2b2d31', '#6b7c3a'])]
    glass = shading.flat('carglass', '#1c2630', rough=0.1, spec=0.8)
    tyre = shading.flat('tyre', '#16171a', rough=0.9)
    cars = [uk.car_proto(body[i], glass, tyre, s=1.5, seed=330 + i) for i in range(5)]
    for cx in Scatter(323).slots(W, 120, jitter=0.45):
        if rng.random() < 0.7: kit.instance(rng.choice(cars), coll, (cx, 2, 0), rot_z=0.0)
    # Bus shelter with a lit ad panel.
    shelter = shading.flat('shelter', '#9fb3bd', rough=0.2, spec=0.7)
    ad = shading.lamp('adpanel', color='#bfe8ff', body='#34424c', strength=0.9)
    bx = 1420
    kit.box('sh_roof', coll, top, bx, 20, 30, 40, 12, 1.5)
    for dx in (-19, 19): kit.box(f'sh_post{dx}', coll, iron, bx + dx, 20, 0, 1.2, 1.2, 30)
    kit.box('sh_back', coll, shelter, bx, 25, 2, 38, 0.6, 26)
    kit.box('sh_ad', coll, ad, bx + 22, 20, 3, 1.2, 10, 22)
    return {'emissive': True}


# ---------------------------------------------------------------- GROUND / FRONT
def ground(ctx):
    from regions import groundkit
    coll, root = groundkit.ground_tile(ctx)
    asphalt = [(0.25, '#2f3439'), (0.55, '#383e44'), (0.85, '#43494f')]
    mat = groundkit.ground_material('city_ground', [(0.3, '#6c6e70'), (0.6, '#7b7d7e'), (0.9, '#8b8d8c')], [
        (598, 610, [(0.3, '#707272'), (0.6, '#7f8180'), (0.9, '#8f918f')], 1.0),
        (610, 662, asphalt, 0.8),
        (662, 666, [(0.3, '#9a9892'), (0.6, '#aaa89f'), (0.9, '#bab7ad')], 0.5),
        (666, 693, [(0.25, '#6a6c6d'), (0.55, '#77797a'), (0.85, '#858786')], 1.0),
    ], scale=0.25, stripes=[(666, 693, 45.0, '#55585a', 0.5), (598, 610, 60.0, '#5e6061', 0.4)])
    groundkit.plane(root, mat)
    rng = random.Random('city-ground')
    paint = shading.flat('lanepaint', '#d8d4c2', rough=0.6, jitter=0.05)
    amber = shading.flat('amberpaint', '#d9a441', rough=0.6, jitter=0.05)
    bm = bmesh.new()
    for row, (colour_rows, dash, gap) in enumerate([((626, 627.5), 40.0, 40.0), ((642, 643.5), 40.0, 40.0)]):
        y0, y1 = groundkit.depth_of_row(colour_rows[1]), groundkit.depth_of_row(colour_rows[0])
        x = 0.0
        while x < groundkit.PERIOD:
            kit._bm_box(bm, x + dash / 2, (y0 + y1) / 2, 0.0, dash, y1 - y0, 0.2)
            x += dash + gap
    kit.mesh_object('dashes', bm, coll, paint)
    bm = bmesh.new()
    y0, y1 = groundkit.depth_of_row(660.5), groundkit.depth_of_row(659)
    kit._bm_box(bm, groundkit.PERIOD / 2, (y0 + y1) / 2, 0.0, groundkit.PERIOD, y1 - y0, 0.2)
    kit.mesh_object('edge', bm, coll, amber)
    return {'focal': groundkit.FOCAL}


def front(ctx):
    from regions import groundkit
    return groundkit.block_face(ctx, ['#3a3f45', '#4a5057'], '#2a2e33', '#a4a39c', seed=4, block=(40.0, 30.0), cap_h=5.0, grit='#6f7478')
