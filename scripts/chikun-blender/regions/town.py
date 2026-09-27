"""Town: deep night on lap 1, so it is designed night-first (cobble terrain).

Palette (day albedo): sandstone #CBB38C, terracotta #B5563E, timber #5B3E2A,
shutter teal #3E7C7A. Night: lamp #FFB65E, window #FFD48C.
"""
import math, random
import bmesh
from mathutils import Vector, Matrix
from chikun_lib import kit, shading
from chikun_lib.periodic import Periodic1D, Periodic2D, smoothstep, Scatter
from chikun_lib.shading import srgb
from regions import common, urbankit as uk

WALLS = ['#cbb38c', '#d9c7a4', '#e3d4b8', '#c79a72', '#b98f6a', '#d8b98e', '#a8b39a', '#c9a88a']
ROOFS = ['#b5563e', '#a4492f', '#8e4a38', '#6b4a3e', '#9b5a3c']


def build(layer, ctx):
    return {'far': far, 'mid': mid, 'near': near, 'ground': ground, 'front': front}[layer](ctx)


def facade(name, colour, scale=1.0, lit=0.6, timber=False, seed=0.0):
    return shading.wall(name, colour, window=dict(w=2.6 * scale, h=3.6 * scale, cols_px=6.0 * scale, rows_px=7.5 * scale, x0=1.0 * scale, z0=2.0 * scale, z_min=3.0 * scale, z_max=1e9, glass='#223038', glass_hi='#3e5462', frame=0.5 * scale, frame_color='#e9dfc8', lit='#ffc877', lit2='#ffe2a6', lit_prob=lit, building_lit=0.7),
                        trim=[(0, 1.2 * scale, '#6d6154')], timber=dict(spacing=6.0 * scale, floor=7.5 * scale, width=0.35 * scale, color='#4a3324', **{'from': 7.5 * scale}) if timber else None)


# ---------------------------------------------------------------- FAR
def far(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#b9c3cc'), y0=0.0, y1=320.0, near=0.16, far=0.5))
    p = Periodic1D(201, W, k_min=1, k_max=10, beta=1.3)
    def hill(x, y):
        dx = ((x - 330 + W / 2) % W) - W / 2
        return (26 + 30 * (0.5 + 0.5 * p(x)) + 60 * math.exp(-dx * dx / 26000.0)) * smoothstep(0, 1, (y - 120) / 90)
    mat = shading.terrain('townhill', [(0.3, '#34503c'), (0.7, '#4a664b')], W, scale=0.03, bump=0.3)
    kit.heightfield('hill', coll, mat, 0, W, 120, 260, 4.0, 6.0, hill)
    rng = random.Random('town-far')
    stone = facade('castlestone', '#a39e92', scale=1.2, lit=0.45)
    slate = shading.roof('castleroof', '#4d5560', tile=1.5)
    cx, cy = 330, 220; cz = hill(cx, cy)
    kit.box('keep', coll, stone, cx, cy, cz - 2, 26, 18, 40)
    for dx, hh in [(-26, 30), (22, 34), (-48, 22), (44, 24)]:
        kit.cylinder(f'tw{dx}', coll, stone, cx + dx, cy - 4, cz - 2, 6.5, hh, segs=10)
        kit.cylinder(f'twr{dx}', coll, slate, cx + dx, cy - 4, cz - 2 + hh, 7.2, 12, segs=10, r_top=0.2)
    kit.box('curtain', coll, stone, cx, cy + 2, cz - 2, 100, 6, 18)
    kit.cylinder('keeproof', coll, slate, cx, cy, cz + 38, 15, 16, segs=4, r_top=0.2)
    # Old-town roofs at the foot of the hill.
    for i in range(46):
        x = rng.uniform(0, W); y = rng.uniform(20, 110); w = rng.uniform(8, 14)
        o = uk.townhouse(coll, f'ft{i}', x, y, w, 8, rng.uniform(8, 14), facade(f'ftw{i%4}', WALLS[i % len(WALLS)], 0.6, 0.35), shading.roof(f'ftr{i%3}', ROOFS[i % 3], tile=1.2), rng, style=rng.choice(['front', 'side']))
    church_x = 930
    kit.box('church', coll, facade('churchw', '#d4ccb8', 1.0, 0.5), church_x, 90, 0, 24, 14, 20)
    kit.gable_roof('churchr', coll, slate, church_x, 90, 20, 24, 14, 10)
    kit.box('bell', coll, facade('bellw', '#d4ccb8', 1.0, 0.3), church_x - 16, 86, 0, 8, 8, 42)
    kit.cylinder('bellspire', coll, slate, church_x - 16, 86, 42, 6, 22, segs=4, r_top=0.1)
    return {'emissive': True}


# ---------------------------------------------------------------- MID
def mid(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#bcc4cc'), y0=0.0, y1=260.0, near=0.04, far=0.3))
    p = Periodic1D(210, W, k_min=1, k_max=8, beta=1.3)
    h = lambda x, y: smoothstep(0, 30, y) * (y * 0.12 + 8 * p(x))
    ground = shading.terrain('townground', [(0.3, '#6d6a5e'), (0.7, '#86826f')], W, scale=0.05)
    kit.heightfield('base', coll, ground, 0, W, 0, 260, 8.0, 8.0, h)
    rng = random.Random('town-mid')
    walls = [facade(f'mw{i}', c, 0.9, 0.42, timber=(i % 3 == 0)) for i, c in enumerate(WALLS)]
    roofs = [shading.roof(f'mr{i}', c, tile=1.6) for i, c in enumerate(ROOFS)]
    chimney = shading.flat('chim', '#7a5a4a', jitter=0.1)
    for row, y in enumerate([24, 58, 92, 126, 160, 194, 228]):
        x = rng.uniform(0, 12)
        while x < W - 6:
            w = rng.uniform(14, 26)
            if abs(x - 640) < 22 and 100 < y < 150: x += 30; continue
            hh = rng.uniform(14, 28) - row * 0.5
            objs = uk.townhouse(coll, f'm{row}_{x:.0f}', x + w / 2, y + rng.uniform(-3, 3), w - 1.0, 14, hh, rng.choice(walls), rng.choice(roofs), rng, style=rng.choice(['front', 'front', 'side', 'hip']), chimney=chimney if rng.random() < 0.6 else None)
            uk.place(objs, h(x + w / 2, y) - 1)
            x += w + rng.uniform(0.5, 4)
    leaf = shading.foliage('mtree', '#253f28', '#3b5c33', '#56773f', scale=0.25)
    trees = [kit.tree_proto(f'mt{i}', coll, common.mats_basic()['bark'], leaf, 'round', 16 + i * 4, seed=220 + i) for i in range(3)]
    for i in range(30):
        x = rng.uniform(0, W); y = rng.uniform(10, 240)
        kit.instance(rng.choice(trees), coll, (x, y - 8, h(x, y) - 1), scale=rng.uniform(0.7, 1.1))
    # Landmark clock tower.
    cx, cy = 640, 124; cz = h(cx, cy) - 2
    stone = facade('clockstone', '#cdbf9f', 1.0, 0.3)
    kit.box('ct', coll, stone, cx, cy, cz, 18, 18, 92)
    kit.box('ctbelfry', coll, stone, cx, cy, cz + 92, 20, 20, 14)
    kit.cylinder('ctroof', coll, roofs[3], cx, cy, cz + 106, 15, 30, segs=4, r_top=0.2)
    face = shading.lamp('clockface', color='#ffe2a8', body='#efe6cf', strength=1.0)
    clock = kit.cylinder('clock', coll, face, 0, 0, -0.6, 6.2, 1.2, segs=24)
    clock.location = (cx, cy - 9.6, cz + 78); clock.rotation_euler = (math.pi / 2, 0, 0)
    hands = shading.flat('hands', '#2a2622')
    for a, L in [(0.6, 4.5), (2.4, 3.2)]:
        hnd = kit.box(f'hand{a}', coll, hands, 0, 0, 0, 0.7, 0.4, L)
        hnd.location = (cx, cy - 10.4, cz + 78); hnd.rotation_euler = (0, a, 0)
    return {'emissive': True, 'landmarks': [{'id': 'clocktower', 'u': cx}]}


# ---------------------------------------------------------------- NEAR
NEAR_W = 2560


def near(ctx):
    W = NEAR_W
    coll = common.tile(ctx, W, dict(color=srgb('#bcc4cc'), y0=0.0, y1=120.0, near=0.0, far=0.06))
    cobble = shading.terrain('pavement', [(0.3, '#77705f'), (0.6, '#8a8270'), (0.9, '#9a917c')], W, scale=0.3, bump=0.5)
    kit.heightfield('street', coll, cobble, 0, W, 0, 40, 8.0, 10.0, lambda x, y: 0.0)
    rng = random.Random('town-near')
    walls = [facade(f'nw{i}', c, 1.9, 0.4, timber=(i % 2 == 0)) for i, c in enumerate(WALLS)]
    roofs = [shading.roof(f'nr{i}', c, tile=2.6) for i, c in enumerate(ROOFS)]
    chimney = shading.flat('nchim', '#7a5a4a', jitter=0.1)
    awn = [uk.stripe_material(f'awn{i}', a, b, width=3.0) for i, (a, b) in enumerate([('#b8423a', '#efe6d2'), ('#2f6f6c', '#efe6d2'), ('#3e5a8a', '#f2e8d0'), ('#c9892e', '#f2e8d0')])]
    iron = shading.flat('iron', '#2e3034', rough=0.5, spec=0.4)
    glow = shading.lamp('streetglow', color='#ffb65e', body='#e8d7b0', strength=1.1)
    bulb = shading.lamp('bulb', color='#ffd48c', body='#e9e2cc', strength=1.0)
    boxes = shading.flat('flowerbox', '#6b4a32')
    flowers = shading.flat('flowers', '#d84d63', jitter=0.3)
    leaf = shading.foliage('ntree', '#223b24', '#3a5b31', '#56783e', scale=0.12)
    tree = kit.tree_proto('ntree', coll, common.mats_basic()['bark'], leaf, 'round', 70, seed=240)
    x = 20.0
    cluster = 0
    while x < W - 60:
        n = rng.randint(3, 5)
        for k in range(n):
            w = rng.uniform(34, 50)
            if x + w > W - 10: break
            hh = rng.uniform(58, 92)
            y = 30 + rng.uniform(-2, 2)
            objs = uk.townhouse(coll, f'n{x:.0f}', x + w / 2, y, w - 0.6, 26, hh, rng.choice(walls), rng.choice(roofs), rng, style=rng.choice(['front', 'front', 'side']), chimney=chimney if rng.random() < 0.5 else None, roof_h=w * rng.uniform(0.5, 0.7))
            if rng.random() < 0.55:
                uk.awning(coll, rng.choice(awn), x + w / 2, y - 13, 16, w * 0.8, 7, 4)
            if rng.random() < 0.6:
                for fz in (24, 36):
                    kit.box(f'fb{x:.0f}{fz}', coll, boxes, x + w / 2, y - 13.8, fz, w * 0.5, 2.0, 2.0)
                    kit.box(f'fl{x:.0f}{fz}', coll, flowers, x + w / 2, y - 14, fz + 2.0, w * 0.46, 1.6, 1.4)
            if rng.random() < 0.35:
                # Hanging icon sign on an iron bracket (no text).
                kit.box(f'br{x:.0f}', coll, iron, x + 4, y - 16, 30, 1.0, 6, 1.0)
                kit.cylinder(f'sg{x:.0f}', coll, rng.choice(awn), 0, 0, -0.5, 4.0, 1.0, segs=16).location = (x + 4, y - 19, 26)
            x += w
        # A gap: lamp posts with string lights, a tree, a glimpse of the rooftops behind.
        gap = rng.uniform(70, 150)
        gx0 = x + 10
        uk.street_lamp(coll, iron, glow, gx0, 8, 0, h=42, arm=6)
        uk.street_lamp(coll, iron, glow, gx0 + gap - 20, 8, 0, h=42, arm=6)
        uk.string_lights(coll, bulb, iron, gx0 + 6, gx0 + gap - 14, 8, 40, sag=6, spacing=5)
        kit.instance(tree, coll, (gx0 + gap / 2, 30, 0), scale=rng.uniform(0.8, 1.0), rot_z=rng.uniform(0, 6.28))
        x += gap
        cluster += 1
    return {'emissive': True}


# ---------------------------------------------------------------- GROUND / FRONT
def ground(ctx):
    from regions import groundkit
    coll, root = groundkit.ground_tile(ctx)
    cob = [(0.25, '#5e574c'), (0.55, '#6f675a'), (0.85, '#80776a')]
    mat = groundkit.ground_material('town_ground', [(0.3, '#6a6256'), (0.6, '#7a7163'), (0.9, '#8a8070')], [
        (598, 612, [(0.3, '#8e8676'), (0.6, '#a09684'), (0.9, '#b0a693')], 1.0),
        (612, 668, cob, 1.0),
        (668, 672, [(0.3, '#9a9282'), (0.6, '#aaa190'), (0.9, '#b8ae9c')], 0.5),
        (672, 693, [(0.25, '#5a544a'), (0.55, '#686157'), (0.85, '#777064')], 1.0),
    ], scale=0.35, stripes=[(645, 646.5, 26.0, '#2f2c28', 0.8), (656, 657.5, 26.0, '#2f2c28', 0.8)],
       cobbles=(612, 693, 7.0, '#3a352f', 0.45))
    groundkit.plane(root, mat)
    return {'focal': groundkit.FOCAL}


def front(ctx):
    from regions import groundkit
    return groundkit.cobble_face(ctx, stone='#8a8272', dark='#5a544a', curb='#a59c8a', seed=3)
