"""Farmland: the template region (everyone sees it first, noon into golden hour).

Palette (day albedo): wheat #D9AE52, meadow #86A04E, hedgerow #4E6B3A,
barn #B04A34, cream #EFE2C0, far hills #7E9CA6.
"""
import math, random
from mathutils import Vector
from chikun_lib import kit, shading, core
from chikun_lib.periodic import Periodic1D, Periodic2D, smoothstep, ridged, Scatter
from chikun_lib.shading import srgb
from regions import common


def build(layer, ctx):
    return {'far': far, 'mid': mid, 'near': near, 'ground': ground, 'front': front}[layer](ctx)


# ---------------------------------------------------------------- FAR
def far(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#c6d4de'), y0=0.0, y1=360.0, near=0.12, far=0.46))
    peaks = Periodic1D(11, W, k_min=2, k_max=36, beta=1.0)
    snowcaps = common.mountain_material(W, snow_line=82.0)
    common.mountain_range(coll, snowcaps, W, 150.0, 200.0, lambda x: 62 + 64 * ridged(peaks(x)) ** 1.5, seed=12)
    hills = [(40, 30, 16, 26, '#6e8f84', 21), (0, 26, 10, 18, '#78976c', 22)]
    for y, depth, base, amp, col, seed in hills:
        p = Periodic1D(seed, W, k_min=1, k_max=16, beta=1.2)
        mat = shading.terrain(f'hill{seed}', [(0.3, shade(col, -0.1)), (0.7, shade(col, 0.08))], W, scale=0.03, bump=0.3)
        kit.heightfield(f'hill{seed}', coll, mat, 0, W, y, y + depth, 4.0, 6.0,
                        lambda x, yy, p=p, base=base, amp=amp, y=y, depth=depth: (base + amp * (0.5 + 0.5 * p(x))) * smoothstep(0, 1, (yy - y) / depth * 1.6), skirt=0)
    m = common.mats_basic()
    p1 = Periodic1D(21, W, k_min=1, k_max=16, beta=1.2)
    top = lambda x: 16 + 26 * (0.5 + 0.5 * p1(x))
    for x in (420, 431, 445):
        kit.cylinder(f'silo{x}', coll, m['white'], x, 66, top(x) - 3, 2.6, 13, segs=12)
    kit.box('church', coll, m['white'], 980, 64, top(980) - 3, 9, 7, 9)
    kit.cylinder('spire', coll, shading.flat('slate', '#5e6670'), 983, 64, top(980) + 6, 2.2, 14, segs=4, r_top=0.1)
    return {}


def shade(hex_col, amount):
    c = srgb(hex_col)
    return tuple(max(0.0, min(1.0, v * (1 + amount * 2.2))) for v in c)


# ---------------------------------------------------------------- MID
MID_W = 1280
MID_DEPTH = 270.0
CELL_W, ROW_D, ROW_Y0 = 116.0, 44.0, 26.0


def mid_height():
    amp = [Periodic1D(31 + k, MID_W, k_min=1, k_max=8, beta=1.3) for k in range(3)]
    wob = [Periodic1D(41 + k, MID_W, k_min=1, k_max=6, beta=1.3) for k in range(3)]
    crests = [(78.0, 13.0, 30.0), (160.0, 21.0, 34.0), (240.0, 31.0, 40.0)]
    def h(x, y):
        z = y * 0.045
        for k, (c, a, wd) in enumerate(crests):
            t = (y - (c + 16 * wob[k](x))) / wd
            z += a * (0.55 + 0.45 * amp[k](x)) * math.exp(-t * t) * (1.0 if t < 0 else math.exp(-t * t * 0.4))
        return z * smoothstep(0.0, 26.0, y)
    return h


def mid(ctx):
    W = MID_W
    coll = common.tile(ctx, W, dict(color=srgb('#c7d3dc'), y0=0.0, y1=MID_DEPTH, near=0.04, far=0.38))
    h = mid_height()
    palette = ['#d4aa50', '#86a04e', '#c7ae66', '#6c8c3d', '#a1b05c', '#9a7652', '#deb962', '#7a9748', '#b89a5a']
    mat = shading.fields('fields', W, CELL_W, ROW_D, palette, hedge='#3d5731', hedge_w=1.6, y_start=ROW_Y0, stripe_pitch=2.6, seed=1.0, blank=('#7f9a4a', ROW_Y0))
    kit.heightfield('hills', coll, mat, 0, W, 0, MID_DEPTH, 5.0, 5.0, h)
    m = common.mats_basic()
    rng = random.Random('farmland-mid')
    hedge_leaf = shading.foliage('hedge_leaf', '#233a22', '#3b5a2f', '#5b7a3b', scale=0.35, bump=0.6)
    leaf = shading.foliage('leaf', '#2c4527', '#4b6c34', '#789746', scale=0.18)
    orchard_leaf = shading.foliage('orchard', '#3b5a2b', '#66873a', '#98ae56', scale=0.3)
    poplar_leaf = shading.foliage('poplar_leaf', '#233d25', '#3b5c31', '#58793a', scale=0.25)
    bushes = [kit.tree_proto(f'hb{i}', coll, m['bark'], hedge_leaf, 'bush', 6.5 + i * 1.2, seed=100 + i) for i in range(4)]
    trees = [kit.tree_proto(f'tree{i}', coll, m['bark'], leaf, 'round', 22 + i * 4, seed=i + 1) for i in range(5)]
    poplar = kit.tree_proto('poplar', coll, m['bark'], poplar_leaf, 'poplar', 40, seed=9)
    orchard = kit.tree_proto('orchardtree', coll, m['bark'], orchard_leaf, 'round', 12, seed=12)
    rows, verticals = kit.field_grid(W, CELL_W, ROW_D, ROW_Y0, MID_DEPTH - 10, seed=1.0)
    for y in rows:
        kit.hedge(coll, bushes, h, [(0, y), (W, y)], 5.5, rng, gap=0.18)
    for x, y0, y1 in verticals:
        if rng.random() < 0.8:
            kit.hedge(coll, bushes, h, [(x, y0), (x, y1)], 5.5, rng, gap=0.15)
        if rng.random() < 0.45:
            kit.instance(rng.choice(trees), coll, (x, y0, h(x, y0) - 1), scale=rng.uniform(0.7, 1.1), rot_z=rng.uniform(0, 6.28))
    for i in range(26):
        x = rng.uniform(0, W); y = rng.choice(rows) + rng.uniform(-2, 2)
        kit.instance(rng.choice(trees), coll, (x, y, h(x, y) - 1), scale=rng.uniform(0.7, 1.15), rot_z=rng.uniform(0, 6.28))
    # Orchard block and a poplar windbreak on the upper slopes.
    for gx in range(11):
        for gy in range(3):
            x = 400 + gx * 10 + (gy % 2) * 5; y = ROW_Y0 + ROW_D * 3 + 8 + gy * 11
            kit.instance(orchard, coll, (x, y, h(x, y) - 0.5), scale=rng.uniform(0.85, 1.1), rot_z=rng.uniform(0, 6.28))
    for i in range(22):
        x = 620 + i * 9.5 + rng.uniform(-1.5, 1.5); y = ROW_Y0 + ROW_D * 4 + rng.uniform(-2, 2)
        kit.instance(poplar, coll, (x, y, h(x, y) - 1), scale=rng.uniform(0.85, 1.15))
    # Farmstead.
    cream = shading.wall('cream', '#efe2c0', window=dict(w=3.6, h=4.6, cols_px=8.0, rows_px=9.0, x0=0.5, z0=1.8, z_min=2.5, z_max=18.0, glass='#2b3440', frame=0.7, frame_color='#f6f1e6', lit_prob=0.75), trim=[(0, 1.6, '#8c7f6c')])
    barn_red = shading.wall('barn', '#b04a34', window=dict(w=4.0, h=5.0, cols_px=16.0, rows_px=26.0, x0=4.0, z0=12.0, z_min=13.0, z_max=19.0, glass='#2a221e', frame=0.9, frame_color='#f2ece0', lit_prob=0.5))
    roof_dark = shading.roof('roof_dark', '#5b3a33', tile=2.4)
    roof_slate = shading.roof('roof_slate', '#4e5660', tile=2.4)
    def place(objs, x, y):
        z = h(x, y) - 1.2
        for o in objs: o.location.z += z
    place(kit.house(coll, 'farmhouse', 150, 58, 34, 18, 18, cream, roof_dark, roof_h=11, chimney_mat=m['stone'], rng=rng), 150, 58)
    place(kit.house(coll, 'barn', 208, 72, 44, 26, 21, barn_red, roof_slate, roof_h=17, roof='gambrel', rng=rng), 208, 72)
    for i, (sx, sy, r, hh) in enumerate([(248, 80, 6.5, 40), (261, 84, 5.5, 34)]):
        z = h(sx, sy) - 1.2
        kit.cylinder(f'silo{i}', coll, shading.flat(f'silo{i}', '#c9ccc8', rough=0.5, spec=0.4), sx, sy, z, r, hh, segs=20)
        kit.sphere(f'silodome{i}', coll, m['metal'], sx, sy, z + hh, r, subdiv=2, squash=(1, 1, 0.6))
    for x, y in [(118, 50), (182, 44), (276, 70)]:
        kit.instance(trees[3], coll, (x, y, h(x, y) - 1), scale=0.9)
    place(kit.house(coll, 'farm2', 1060, 190, 26, 15, 14, cream, roof_dark, roof_h=9, chimney_mat=m['stone'], rng=rng), 1060, 190)
    # Landmark windmill on the middle crest.
    wx, wy = 880, 150
    wz = h(wx, wy) - 2
    tower = shading.flat('mill', '#e9e2cf', rough=0.8, jitter=0.05)
    kit.cylinder('mill_tower', coll, tower, wx, wy, wz, 10, 66, segs=8, r_top=6.2)
    kit.sphere('mill_cap', coll, roof_dark, wx, wy, wz + 66, 8.0, subdiv=2, squash=(1, 1, 0.75))
    door = shading.flat('mill_door', '#4a3a2c')
    kit.box('mill_door', coll, door, wx, wy - 9.4, wz, 5, 1, 9)
    sail = shading.flat('sail', '#d9d1bd', rough=0.9, jitter=0.1)
    hub = Vector((wx, wy - 9.5, wz + 64))
    rotor = []
    for k in range(4):
        # Blades lie in the x-z plane (facing the camera) and turn about the view axis.
        blade = kit.box(f'sail{k}', coll, sail, 2.6, 0, 3, 7, 0.8, 44)
        spar = kit.box(f'spar{k}', coll, m['wood'], 0, 0, 0, 1.3, 1.2, 47)
        for o in (blade, spar):
            o.location = hub
            o.rotation_euler = (0, math.radians(45 + 90 * k), 0)
            rotor.append(o.name)
    rotor.append(kit.sphere('mill_hub', coll, m['dark'], hub.x, hub.y - 1, hub.z, 2.4).name)
    # The rotor ships as its own sprite and turns at runtime (0.25 rev/s).
    return {'emissive': True, 'landmarks': [{'id': 'windmill', 'u': wx}], 'sprites': [dict(id='windmill', objects=rotor, pivot=tuple(hub), motion='spin', speed=0.25)]}


# ---------------------------------------------------------------- NEAR
NEAR_W = 2560
NEAR_S = 1.55  # props read at ~30% of the play layer's scale


def near(ctx):
    W, S = NEAR_W, NEAR_S
    coll = common.tile(ctx, W, dict(color=srgb('#c9d5dc'), y0=0.0, y1=120.0, near=0.0, far=0.08))
    p = Periodic2D(41, W, depth_scale=80.0, k_max=60)
    edge = Periodic1D(42, W, k_min=4, k_max=90, beta=0.9)
    def h(x, y):
        return smoothstep(0, 30, y) * (5.0 + 3.5 * p(x, y))
    grass = shading.terrain('meadow', [(0.3, '#5f7d36'), (0.55, '#748f44'), (0.8, '#8ea552')], W, scale=0.05, detail=7, bump=0.5)
    depth = lambda x: 88 + 18 * edge(x)
    kit.heightfield('bank', coll, grass, 0, W, 0, 112, 4.0, 4.0, lambda x, y: h(x, y) if y < depth(x) else -40.0)
    m = common.mats_basic()
    rng = random.Random('farmland-near')
    common.fence_split_rail(coll, m['grey_wood'], 60, 900, 22, h=15 * S, spacing=34, seed=3)
    common.fence_split_rail(coll, m['grey_wood'], 1480, 2120, 24, h=15 * S, spacing=34, seed=4)
    straw = shading.terrain('straw', [(0.3, '#a8813f'), (0.7, '#cda75a')], W, scale=0.4, detail=4, bump=0.6)
    bale = common.hay_bale_proto(straw, r=8.5 * S, length=13 * S)
    for x, y in [(1010, 52), (1044, 60), (1080, 46), (1150, 66), (2300, 60), (2342, 68)]:
        kit.instance(bale, coll, (x, y, h(x, y) - 1), rot_z=rng.uniform(-0.5, 0.5))
    cow = common.cow_proto(common.cow_material(), m['dark'], s=S)
    for x, y, r in [(380, 64, 0.3), (446, 74, -2.9), (540, 60, 0.1), (1700, 70, 3.0), (1780, 78, 0.4)]:
        kit.instance(cow, coll, (x, y, h(x, y) - 0.5), rot_z=r)
    petal = shading.flat('petal', '#e9b92c', rough=0.7, jitter=0.08)
    disc = shading.flat('disc', '#4a2e1a', rough=0.9)
    stem = shading.flat('stem', '#4f7a34', rough=0.8)
    flowers = [common.sunflower_proto(stem, petal, disc, h=(20 + i * 3) * S, seed=i) for i in range(3)]
    for i in range(80):
        x = 2170 + rng.uniform(0, 320); y = rng.uniform(10, 64)
        kit.instance(rng.choice(flowers), coll, (x, y, h(x, y) - 0.5), scale=rng.uniform(0.85, 1.1), rot_z=rng.uniform(-0.25, 0.25))
    # Scarecrow.
    sx, sy = 1270, 56; sz = h(sx, sy)
    kit.box('sc_pole', coll, m['wood'], sx, sy, sz - 1, 1.6 * S, 1.6 * S, 34 * S)
    kit.box('sc_arm', coll, m['wood'], sx, sy, sz + 24 * S, 26 * S, 1.4 * S, 1.4 * S)
    kit.box('sc_shirt', coll, shading.flat('shirt', '#8a3b35', jitter=0.1), sx, sy - 1.2, sz + 15 * S, 11 * S, 3 * S, 12 * S)
    kit.sphere('sc_head', coll, straw, sx, sy - 1.2, sz + 31 * S, 3.6 * S)
    kit.cylinder('sc_hat', coll, shading.flat('hat', '#6b5234'), sx, sy - 1.2, sz + 33.5 * S, 7 * S, 1.2 * S, segs=14)
    kit.cylinder('sc_crown', coll, shading.flat('hat2', '#6b5234'), sx, sy - 1.2, sz + 34.5 * S, 3.5 * S, 4 * S, segs=10, r_top=2.6 * S)
    leaf = shading.foliage('near_leaf', '#2a4428', '#476a33', '#739347', scale=0.07, bump=0.7)
    oaks = [kit.tree_proto(f'oak{i}', coll, m['bark'], leaf, 'round', hgt, seed=51 + i) for i, hgt in enumerate((132, 110, 96))]
    for x, i in [(760, 0), (1890, 1), (1320, 2), (2480, 1), (160, 2)]:
        kit.instance(oaks[i], coll, (x, depth(x) - 6, 3), scale=rng.uniform(0.92, 1.05), rot_z=rng.uniform(0, 6.28))
    bushp = [kit.tree_proto(f'bush{i}', coll, m['bark'], leaf, 'bush', (18 + 5 * i) * S, seed=60 + i) for i in range(3)]
    for x in Scatter(7).slots(W, 52, jitter=0.45):
        if rng.random() < 0.85:
            kit.instance(rng.choice(bushp), coll, (x, depth(x) - 5, 4), scale=rng.uniform(0.7, 1.25), rot_z=rng.uniform(0, 6.28))
    tuft_mat = shading.flat('tuft', '#648a3a', rough=0.8, jitter=0.15)
    tufts = [common.grass_tuft_proto(tuft_mat, h=(6 + i) * S, seed=70 + i, spread=3.5) for i in range(3)]
    for x in Scatter(8).slots(W, 8, jitter=0.5):
        y = rng.uniform(1, 44)
        kit.instance(rng.choice(tufts), coll, (x, y, h(x, y) - 0.3), scale=rng.uniform(0.8, 1.4), rot_z=rng.uniform(-0.3, 0.3))
    wild = shading.flat('wildflower', '#e9e2c4', rough=0.7, jitter=0.3)
    blooms = [kit.prop_proto(f'bloom{i}', lambda bm, i=i: __import__('bmesh').ops.create_icosphere(bm, subdivisions=1, radius=1.3 + 0.4 * i, matrix=__import__('mathutils').Matrix.Translation((0, 0, 6 + 2 * i))), [wild]) for i in range(2)]
    for x in Scatter(9).slots(W, 21, jitter=0.5):
        y = rng.uniform(4, 60)
        kit.instance(rng.choice(blooms), coll, (x, y, h(x, y)), scale=1.0)
    return {}


# ---------------------------------------------------------------- GROUND (perspective rows)
def ground(ctx):
    from regions import groundkit
    return groundkit.farm_ground(ctx)


# ---------------------------------------------------------------- FRONT (cut face)
def front(ctx):
    from regions import groundkit
    return groundkit.front_face(ctx, soil=['#5c4632', '#7a5d40', '#3f2f22'], lip='#7da046', lip_dark='#557a33', pebbles='#a39a88', roots='#3a2a1c', seed=1)
