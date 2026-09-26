"""Ground-plane and front-face builders shared by every region.

Ground: a flat, x-periodic plane seen by the perspective ground camera. Depth y
maps to screen row 560 + 130 * 2000 / y, so bands of the plane become bands of
rows (the packer re-cuts each band to its own scroll rate). Keep 3D detail low
(under ~6 px) so a detail never spans rows that scroll at different rates.

Front: the cut face under the running line, seen by a level orthographic camera.
"""
import math, random
import bmesh
from mathutils import Vector, Matrix
from chikun_lib import kit, shading, core
from chikun_lib.periodic import Scatter
from regions import common

FOCAL = 2000.0
PERIOD = 1280.0


def depth_of_row(row):
    rho = max(0.004, (row - 560.0) / 130.0)
    return FOCAL / rho


def plane(coll, mat, y0=1200.0, y1=1.5e6, half=2.0e5):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(-half, y0, 0), (half, y0, 0), (half, y1, 0), (-half, y1, 0)]]
    bm.faces.new(v)
    return kit.mesh_object('groundplane', bm, coll, mat)


def ground_material(name, base_stops, bands, scale=0.08, stripes=None, speckle=None, bump=0.35):
    """bands: [(row_top, row_bottom, stops, soft_rows)] painted over the base in
    screen-row terms (converted to depth). stripes: (row_top, row_bottom, pitch_units,
    colour, strength) furrow lines parallel to the run."""
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        vec, w = nb.periodic(pos, PERIOD)
        y = nb.separate(pos)[1]
        # Depth-scaled coordinates keep features a similar size in screen space.
        n = nb.noise(vec, scale=scale, detail=6.0, rough=0.6, w=w)
        nf = nb.noise(vec, scale=scale * 0.12, detail=3.0, rough=0.5, w=nb.math('ADD', nb.math('MULTIPLY', y, scale * 0.12), 17.0))
        c = nb.ramp(nb.math('ADD', nb.math('MULTIPLY', n, 0.7), nb.math('MULTIPLY', nf, 0.3)), base_stops)
        for top, bottom, stops, soft in bands:
            yf, yn = depth_of_row(top), depth_of_row(bottom)
            sf, sn = (depth_of_row(top - soft) - yf), (yn - depth_of_row(bottom + soft))
            f = nb.math('MULTIPLY', nb.maprange(y, yn - sn, yn + sn, 0, 1, smooth=True), nb.maprange(y, yf - sf, yf + sf, 1, 0, smooth=True))
            bc = nb.ramp(nb.math('ADD', nb.math('MULTIPLY', n, 0.65), nb.math('MULTIPLY', nf, 0.35)), stops)
            c = nb.mix(c, bc, f)
        if stripes:
            for top, bottom, pitch, col, strength in stripes:
                yf, yn = depth_of_row(top), depth_of_row(bottom)
                inside = nb.math('MULTIPLY', nb.math('GREATER_THAN', y, yn), nb.math('LESS_THAN', y, yf))
                wob = nb.math('MULTIPLY', nb.noise(vec, scale=0.004, detail=2.0, w=3.0), pitch * 0.5)
                s = nb.math('SINE', nb.math('MULTIPLY', nb.math('ADD', y, wob), math.tau / pitch))
                s = nb.maprange(s, 0.2, 1.0, 0.0, 1.0, smooth=True)
                c = nb.mix(c, col, nb.math('MULTIPLY', nb.math('MULTIPLY', s, inside), strength))
        if speckle:
            col, density, sc = speckle
            v = nb.voronoi(vec, scale=sc, w=w, feature='F1')
            dots = nb.math('LESS_THAN', v.outputs['Distance'], density)
            c = nb.mix(c, col, nb.math('MULTIPLY', dots, 0.85))
        normal = nb.bump(n, strength=bump, distance=1.0)
        return dict(color=c, rough=0.92, normal=normal, spec=0.12)
    return shading.material(name, build, haze=False)


def ground_tile(ctx, haze=None):
    coll = common.tile(ctx, PERIOD, haze or dict(color=shading.srgb('#cbd8e0'), y0=2000.0, y1=40000.0, near=0.0, far=0.0), copies=(-2, -1, 1, 2))
    root = core.collection(ctx['scene'], 'plane')
    return coll, root


def scatter_front(coll, protos, row_top, row_bottom, spacing, rng, scale=(0.8, 1.3)):
    """Scatter small props across one period between two screen rows."""
    y0, y1 = depth_of_row(row_bottom), depth_of_row(row_top)
    for x in Scatter(rng.randint(0, 1 << 30)).slots(PERIOD, spacing, jitter=0.5):
        kit.instance(rng.choice(protos), coll, (x, rng.uniform(y0, y1), 0.0), scale=rng.uniform(*scale), rot_z=rng.uniform(-0.4, 0.4))


def farm_ground(ctx):
    coll, root = ground_tile(ctx)
    pasture = [(0.25, '#56713a'), (0.55, '#688543'), (0.85, '#7c974d')]
    mat = ground_material('farm_ground', [(0.3, '#5b7437'), (0.6, '#6c8641'), (0.9, '#80984c')], [
        (598, 612, [(0.3, '#8f7a3e'), (0.6, '#a68d48'), (0.9, '#b99e55')], 1.0),
        (612, 618, [(0.3, '#2f4527'), (0.6, '#3b5530'), (0.9, '#4a6537')], 0.8),
        (618, 641, pasture, 1.2),
        (641, 656, [(0.3, '#5b4633'), (0.6, '#6d563f'), (0.9, '#806750')], 1.0),
        (656, 665, pasture, 1.2),
        (665, 693, [(0.25, '#415d2c'), (0.55, '#4f6c33'), (0.85, '#617d3d')], 1.0),
    ], scale=0.11, stripes=[(598, 612, 420.0, '#6f5f30', 0.6), (618, 641, 900.0, '#4c6534', 0.35), (644, 654, 150.0, '#46362a', 0.5)], speckle=('#d9d2a8', 0.05, 0.02))
    plane(root, mat)
    rng = random.Random('farmland-ground')
    tuft_mat = shading.flat('g_tuft', '#6c9241', rough=0.8, jitter=0.2)
    tufts = [common.grass_tuft_proto(tuft_mat, h=3.0 + i, seed=80 + i, spread=2.0) for i in range(4)]
    scatter_front(coll, tufts, 668, 690, 4.0, rng)
    scatter_front(coll, tufts, 658, 668, 9.0, rng, scale=(1.0, 1.8))
    flower_mat = shading.flat('g_flower', '#f1e6b4', rough=0.7, jitter=0.2)
    flowers = [kit.prop_proto(f'clover{i}', lambda bm, i=i: bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.9 + 0.3 * i, matrix=Matrix.Translation((0, 0, 1.2))), [flower_mat]) for i in range(2)]
    scatter_front(coll, flowers, 670, 690, 22.0, rng)
    stone = shading.flat('g_stone', '#a19684', rough=0.95, jitter=0.2)
    pebbles = [common.rock_proto(stone, r=1.1 + 0.5 * i, seed=90 + i) for i in range(3)]
    scatter_front(coll, pebbles, 643, 657, 16.0, rng)
    return {'focal': FOCAL}


def front_face(ctx, soil, lip, lip_dark, pebbles, roots, seed=1, grass=True, W=1280.0):
    coll = common.tile(ctx, W, dict(color=shading.srgb('#cbd8e0'), y0=0.0, y1=1.0, near=0.0, far=0.0))
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        vec, w = nb.periodic(pos, W)
        z = nb.separate(pos)[2]
        n = nb.noise(vec, scale=0.08, detail=6.0, rough=0.62, w=w)
        strata = nb.math('SINE', nb.math('ADD', nb.math('MULTIPLY', z, 0.55), nb.math('MULTIPLY', n, 4.0)))
        c = nb.ramp(nb.math('ADD', nb.math('MULTIPLY', n, 0.7), nb.math('MULTIPLY', strata, 0.12)), [(0.25, soil[2]), (0.55, soil[0]), (0.85, soil[1])])
        top = nb.maprange(z, -5.0, -0.5, 0.0, 1.0, smooth=True)
        c = nb.mix(c, lip_dark, nb.math('MULTIPLY', top, 0.8))
        deep = nb.maprange(z, -30.0, -12.0, 0.35, 0.0, smooth=True)
        c = nb.mix(c, (0.0, 0.0, 0.0), deep)
        normal = nb.bump(nb.math('ADD', n, nb.math('MULTIPLY', strata, 0.1)), strength=0.6, distance=1.5)
        return dict(color=c, rough=0.95, normal=normal)
    slab = shading.material('soil', build, haze=False)
    kit.box('slab', coll, slab, W / 2, 20.0, -60.0, W, 40.0, 60.0)
    rng = random.Random(f'front:{seed}')
    stone = shading.flat('pebble', pebbles, rough=0.9, jitter=0.25)
    protos = [common.rock_proto(stone, r=1.3 + 0.7 * i, seed=seed * 10 + i, squash=(1.2, 0.8, 0.9)) for i in range(4)]
    for x in Scatter(seed + 3).slots(W, 26.0, jitter=0.5):
        o = kit.instance(rng.choice(protos), coll, (x, -0.5, -rng.uniform(6, 28)), scale=rng.uniform(0.7, 1.3), rot_z=rng.uniform(0, 6.28))
    root_mat = shading.flat('root', roots, rough=0.9, jitter=0.1)
    bm = bmesh.new()
    for x in Scatter(seed + 4).slots(W, 70.0, jitter=0.5):
        z = -rng.uniform(3, 12); length = rng.uniform(12, 30); a = rng.uniform(-0.5, 0.5)
        for s in range(6):
            t = s / 5
            m = Matrix.Translation((x + math.cos(a) * length * t, -0.2, z - length * 0.35 * t * t)) @ Matrix.Rotation(a - 0.6 * t, 4, 'Y')
            bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.9 * (1 - t * 0.6), radius2=0.7 * (1 - t * 0.6), depth=length / 5, matrix=m @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
    kit.mesh_object('roots', bm, coll, root_mat)
    if grass:
        lip_mat = shading.flat('lip', lip, rough=0.8, jitter=0.2)
        tufts = [common.grass_tuft_proto(lip_mat, h=3.5 + i * 0.8, seed=seed * 100 + i, spread=2.4) for i in range(4)]
        for x in Scatter(seed + 5).slots(W, 3.2, jitter=0.5):
            kit.instance(rng.choice(tufts), coll, (x, rng.uniform(0.5, 6.0), -0.3), scale=rng.uniform(0.8, 1.2), rot_z=rng.uniform(-0.3, 0.3))
    return {}


def block_face(ctx, body, joint, cap, seed=1, block=(14.0, 7.0), cap_h=3.5, W=1280.0, grit=None, lip=None):
    """Urban cut face: a cap course (curb or slab edge) over coursed blocks or
    poured layers. block = (width, height); None for poured material."""
    coll = common.tile(ctx, W, dict(color=shading.srgb('#cbd8e0'), y0=0.0, y1=1.0, near=0.0, far=0.0))
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        x, y, z = nb.separate(pos)
        vec, w = nb.periodic(pos, W)
        n = nb.noise(vec, scale=0.12, detail=5.0, w=w)
        c = nb.ramp(n, [(0.3, body[0]), (0.7, body[1])])
        if block:
            bw, bh = block
            bw = W / max(1, round(W / bw))  # whole blocks per period so the face wraps
            row = nb.math('FLOOR', nb.math('DIVIDE', nb.math('SUBTRACT', 0.0, z), bh))
            off = nb.math('MULTIPLY', nb.math('FLOORED_MODULO', row, 2.0), bw * 0.5)
            fx = nb.math('FRACT', nb.math('DIVIDE', nb.math('ADD', x, off), bw))
            fz = nb.math('FRACT', nb.math('DIVIDE', nb.math('SUBTRACT', 0.0, z), bh))
            ex = nb.math('MINIMUM', nb.math('MULTIPLY', fx, bw), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, fx), bw))
            ez = nb.math('MINIMUM', nb.math('MULTIPLY', fz, bh), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, fz), bh))
            j = nb.maprange(nb.math('MINIMUM', ex, ez), 0.0, 0.9, 1.0, 0.0, smooth=True)
            rv = nb.white(nb.combine(nb.math('FLOORED_MODULO', nb.math('FLOOR', nb.math('DIVIDE', nb.math('ADD', x, off), bw)), W / bw), row, float(seed)))[0]
            c = nb.mix(c, nb.mix(c, (0, 0, 0), 0.25), nb.math('MULTIPLY', rv, 0.6))
            c = nb.mix(c, joint, j)
        capm = nb.maprange(z, -cap_h - 0.4, -cap_h + 0.4, 0.0, 1.0, smooth=True)
        c = nb.mix(c, cap, capm)
        c = nb.mix(c, (0, 0, 0), nb.maprange(z, -30.0, -12.0, 0.3, 0.0, smooth=True))
        normal = nb.bump(nb.math('ADD', n, 0.0), strength=0.5, distance=1.0)
        return dict(color=c, rough=0.9, normal=normal)
    slab = shading.material('blockface', build, haze=False)
    kit.box('slab', coll, slab, W / 2, 20.0, -60.0, W, 40.0, 60.0)
    rng = random.Random(f'blockface:{seed}')
    if grit:
        stone = shading.flat('grit', grit, rough=0.9, jitter=0.25)
        protos = [common.rock_proto(stone, r=0.8 + 0.4 * i, seed=seed * 10 + i) for i in range(3)]
        for x in Scatter(seed + 11).slots(W, 14.0, jitter=0.5):
            kit.instance(rng.choice(protos), coll, (x, rng.uniform(1, 8), -0.4), scale=rng.uniform(0.6, 1.1))
    if lip:
        lip_mat = shading.flat('lip', lip, rough=0.8, jitter=0.2)
        tufts = [common.grass_tuft_proto(lip_mat, h=3.0 + i * 0.7, seed=seed * 100 + i, spread=2.4) for i in range(3)]
        for x in Scatter(seed + 5).slots(W, 5.0, jitter=0.5):
            kit.instance(rng.choice(tufts), coll, (x, rng.uniform(0.5, 6.0), -0.3), scale=rng.uniform(0.8, 1.2))
    return {}


def cobble_face(ctx, stone, dark, curb, seed=3):
    return block_face(ctx, [dark, stone], '#3b3730', curb, seed=seed, block=(11.0, 6.0), cap_h=4.0, grit='#9a9282')
