"""Forest: golden hour into moonlit night (loam terrain).

Palette (day albedo): pine #2C5645, moss #6E9A45, bark #4A3526, fern #5E8E4D,
mist #B7C2C9. Night emissives: lantern #FFC27A, bioluminescence #7CF2D2.
"""
import math, random
import bmesh
from mathutils import Vector, Matrix
from chikun_lib import kit, shading
from chikun_lib.periodic import Periodic1D, Periodic2D, smoothstep, ridged, Scatter
from chikun_lib.shading import srgb
from regions import common


def build(layer, ctx):
    return {'far': far, 'mid': mid, 'near': near, 'ground': ground, 'front': front}[layer](ctx)


def conifer_mats():
    m = common.mats_basic()
    return m, [shading.foliage(f'pine{i}', d, mi, l, scale=0.3, bump=0.6) for i, (d, mi, l) in enumerate([
        ('#17302a', '#24483c', '#36604b'), ('#1b3527', '#2c5645', '#3f6b50'), ('#203a2c', '#335a3f', '#4d7550')])]


def conifer_band(coll, protos, hfn, y0, y1, spacing, rng, scale=(0.7, 1.2), sink=1.0, W=1280):
    for x in Scatter(rng.randint(0, 1 << 30)).slots(W, spacing, jitter=0.5):
        y = rng.uniform(y0, y1)
        kit.instance(rng.choice(protos), coll, (x, y, hfn(x, y) - sink), scale=rng.uniform(*scale), rot_z=rng.uniform(0, 6.28))


# ---------------------------------------------------------------- FAR
def far(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#b9c6cc'), y0=0.0, y1=360.0, near=0.18, far=0.55))
    peaks = Periodic1D(71, W, k_min=2, k_max=30, beta=1.1)
    rock = common.mountain_material(W, rock=('#4c5a5e', '#76858a'), snow='#dfe7ea', snow_line=104.0, name='forest_peaks')
    common.mountain_range(coll, rock, W, 170.0, 190.0, lambda x: 56 + 58 * ridged(peaks(x)) ** 1.4, seed=72, freq=0.014)
    m, pines = conifer_mats()
    protos = [kit.tree_proto(f'fp{i}', coll, m['bark'], pines[i % 3], 'conifer', 16 + i * 3, seed=80 + i) for i in range(4)]
    rng = random.Random('forest-far')
    for k, (y, base, amp) in enumerate([(90, 16, 20), (20, 8, 12)]):
        p = Periodic1D(73 + k, W, k_min=1, k_max=14, beta=1.2)
        hf = lambda x, yy, p=p, base=base, amp=amp, y=y: (base + amp * (0.5 + 0.5 * p(x))) * smoothstep(0, 1, (yy - y) / 26.0)
        mat = shading.terrain(f'ridge{k}', [(0.3, '#1d3a30'), (0.7, '#2c4d3c')], W, scale=0.05, bump=0.3)
        kit.heightfield(f'ridge{k}', coll, mat, 0, W, y, y + 40, 4.0, 5.0, hf)
        conifer_band(coll, protos, hf, y + 8, y + 36, 4.2, rng, scale=(0.6, 1.1))
    return {}


# ---------------------------------------------------------------- MID
def mid(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#b7c2c9'), y0=0.0, y1=300.0, near=0.05, far=0.32))
    p = Periodic2D(74, W, depth_scale=200.0, k_max=18)
    q = Periodic1D(75, W, k_min=1, k_max=8, beta=1.2)
    h = lambda x, y: smoothstep(0, 30, y) * (y * 0.1 + 10 * p(x, y) + 20 * smoothstep(120, 280, y) * (0.5 + 0.5 * q(x)))
    moss = shading.terrain('forest_floor', [(0.3, '#35472b'), (0.6, '#4b5e33'), (0.9, '#5f7240')], W, scale=0.04, bump=0.4)
    kit.heightfield('floor', coll, moss, 0, W, 0, 300, 5.0, 6.0, h)
    m, pines = conifer_mats()
    rng = random.Random('forest-mid')
    protos = [kit.tree_proto(f'mp{i}', coll, m['bark'], pines[i % 3], 'conifer', 34 + i * 7, seed=90 + i) for i in range(5)]
    conifer_band(coll, protos, h, 150, 290, 4.5, rng, scale=(0.7, 1.25))
    for x in Scatter(83).slots(W, 9.0, jitter=0.5):
        y = rng.uniform(60, 150)
        if abs(x - 980) < 80 and y < 150: continue
        kit.instance(rng.choice(protos), coll, (x, y, h(x, y) - 1), scale=rng.uniform(0.8, 1.3), rot_z=rng.uniform(0, 6.28))
    # Colonnade of giant redwoods: tall bare trunks under high dark crowns.
    redwood = shading.flat('redwood', '#5a3526', rough=0.9, jitter=0.18, scale=0.12)
    crown = shading.foliage('redcrown', '#16291f', '#223d2e', '#33533d', scale=0.25)
    giants = [kit.tree_proto(f'giant{i}', coll, redwood, crown, 'pine', 120 + 18 * i, seed=130 + i) for i in range(3)]
    for x in Scatter(76).slots(W, 64, jitter=0.4):
        if abs(x - 980) < 90: continue
        y = rng.uniform(46, 100)
        kit.instance(rng.choice(giants), coll, (x, y, h(x, y) - 2), scale=(rng.uniform(1.5, 2.0), 1.6, rng.uniform(0.9, 1.1)), rot_z=rng.uniform(0, 6.28))
    # Fire-lookout tower with a lit cab.
    lx, ly = 420, 150; lz = h(lx, ly)
    wood = m['wood']
    for dx in (-5, 5):
        for dy in (-4, 4):
            kit.box(f'leg{dx}{dy}', coll, wood, lx + dx, ly + dy, lz, 1.2, 1.2, 72)
    cab = shading.wall('cab', '#6b5236', window=dict(w=3.4, h=3.6, cols_px=4.5, rows_px=6.0, x0=0.0, z0=0.0, z_min=0.5, z_max=6.0, glass='#20262a', lit='#ffc27a', lit_prob=0.95))
    kit.box('cab', coll, cab, lx, ly, lz + 72, 14, 11, 7)
    kit.gable_roof('cabroof', coll, shading.roof('shingle', '#3d2e26', tile=1.5), lx, ly, lz + 79, 14, 11, 5, overhang=1.5, hip=True)
    # Landmark waterfall: a two-tier fall in a notch of a stepped, mossy cliff,
    # white water at the lip and the ledge, a foaming plunge pool and boulders.
    wx, wy = 980, 120; wz = h(wx, wy)
    waterfall(coll, W, wx, wy, wz, h)
    conifer_band(coll, protos, lambda x, y: h(x, y) + (96 if abs(x - wx) < 64 and abs(y - wy - 16) < 16 else 0), wy + 2, wy + 30, 6.0, random.Random('falls'), scale=(0.5, 0.8))
    return {'emissive': True, 'landmarks': [{'id': 'waterfall', 'u': wx}]}


def cliff_material(name='cliff'):
    """Dark wet rock in horizontal strata, moss on every upward-facing ledge."""
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        x, y, z = nb.separate(pos)
        n = nb.noise(pos, scale=0.07, detail=6.0, rough=0.62)
        strata = nb.noise(nb.combine(nb.math('MULTIPLY', x, 0.05), nb.math('MULTIPLY', y, 0.05), z), scale=0.17, detail=3.0, distortion=0.6)
        big = nb.noise(pos, scale=0.018, detail=2.0)
        f = nb.math('ADD', nb.math('ADD', nb.math('MULTIPLY', n, 0.6), nb.math('MULTIPLY', strata, 0.32)), nb.math('MULTIPLY', nb.math('SUBTRACT', big, 0.5), 0.5))
        rock = nb.ramp(f, [(0.32, '#1f2623'), (0.5, '#3a433e'), (0.68, '#5d675f'), (0.8, '#737d72')])
        up = nb.separate(nb.geometry().outputs['Normal'])[2]
        moss_mask = nb.maprange(nb.math('ADD', up, nb.math('MULTIPLY', nb.math('SUBTRACT', n, 0.5), 0.9)), 0.42, 0.72, 0.0, 1.0, smooth=True)
        moss = nb.ramp(n, [(0.35, '#26391f'), (0.55, '#3d5a2c'), (0.72, '#5e7a3c')])
        c = nb.mix(rock, moss, moss_mask)
        normal = nb.bump(nb.math('ADD', n, strata), strength=0.9, distance=2.0)
        return dict(color=c, rough=0.9, normal=normal, spec=0.3)
    return shading.material(name, build)


def falls_material(z0, z1, name='falls'):
    """Falling water: broad vertical streaks from slate shadow to white, with
    white water where it leaves the lip (z1) and where it lands (z0)."""
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        x, y, z = nb.separate(pos)
        streak = nb.noise(nb.combine(x, y, nb.math('MULTIPLY', z, 0.03)), scale=0.3, detail=3.0, rough=0.55)
        fine = nb.noise(nb.combine(nb.math('MULTIPLY', x, 1.7), y, nb.math('MULTIPLY', z, 0.09)), scale=0.45, detail=2.0)
        f = nb.math('ADD', nb.math('MULTIPLY', streak, 0.75), nb.math('MULTIPLY', fine, 0.25))
        c = nb.ramp(f, [(0.34, '#4f7684'), (0.45, '#8fb6c0'), (0.55, '#d4e8ec'), (0.64, '#ffffff')])
        churn = nb.noise(pos, scale=0.35, detail=3.0)
        white = nb.math('MAXIMUM', nb.maprange(z, z1 - 9.0, z1 - 1.0, 0.0, 1.0, smooth=True), nb.maprange(z, z0 + 12.0, z0 + 2.0, 0.0, 1.0, smooth=True))
        white = nb.math('MULTIPLY', white, nb.maprange(churn, 0.35, 0.6, 0.55, 1.0))
        c = nb.mix(c, '#f7fbfb', white)
        return dict(color=c, rough=0.22, spec=0.55)
    return shading.material(name, build)


def rock_mass(name, coll, mat, cx, cy, z0, w, d, h, seed, cuts=10, amp=(9.0, 5.0, 7.0), terrace=10.0, taper=0.26):
    """A displaced block of rock whose front face steps back in ledges."""
    from mathutils import noise
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((cx, cy, z0 + h / 2)) @ Matrix.Diagonal((w, d, h, 1)))
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        p = v.co.copy()
        n1, n2 = noise.noise(p * 0.045 + off), noise.noise(p * 0.12 + off * 1.3)
        up = max(0.0, (p.z - z0) / h)
        t = ((p.z - z0) / terrace + 0.37 * n1) % 1.0
        ledge = 3.2 * t ** 3 if p.y < cy else 0.0
        k = 1.0 - taper * up
        v.co = Vector((cx + (p.x - cx) * k + (n1 + 0.35 * n2) * amp[0],
                       p.y + (n1 + 0.4 * n2) * amp[1] + ledge,
                       p.z + (noise.noise(p * 0.05 + off * 0.7) * amp[2] if p.z > z0 + 1 else -2.0)))
    bm.normal_update()
    return kit.mesh_object(name, bm, coll, mat, smooth=True)


def falls_sheet(name, coll, mat, cx, y, z0, z1, w0, w1, seed, lip=4.0):
    """A thin sheet of falling water, widening as it falls, arcing out over its lip."""
    from mathutils import noise
    bm = bmesh.new()
    cols, rows = 8, 24
    grid = []
    for j in range(rows + 1):
        z = z1 + (z0 - z1) * j / rows
        s = (z - z0) / max(1e-6, z1 - z0)
        width = w0 + (w1 - w0) * s
        out = lip * (1.0 - smoothstep(0.0, 0.3, 1.0 - s))
        row = []
        for i in range(cols + 1):
            u = i / cols - 0.5
            wob = noise.noise(Vector((u * 3.0 + seed, z * 0.08, seed))) * 0.8
            row.append(bm.verts.new((cx + u * width + wob, y - out - 0.6 * (1 - 4 * u * u), z)))
        grid.append(row)
    for j in range(rows):
        for i in range(cols):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bm.normal_update()
    return kit.mesh_object(name, bm, coll, mat, smooth=True)


def waterfall(coll, W, wx, wy, wz, h):
    cliff = cliff_material()
    rock_mass('cliff', coll, cliff, wx, wy + 18, wz - 2, 150, 32, 112, seed=3, cuts=12)
    # Buttresses either side put the falls in a notch the water has cut.
    rock_mass('buttressL', coll, cliff, wx - 30, wy + 4, wz - 2, 30, 18, 96, seed=5, cuts=8, amp=(6.0, 4.0, 6.0), terrace=8.0, taper=0.34)
    rock_mass('buttressR', coll, cliff, wx + 33, wy + 5, wz - 2, 28, 18, 104, seed=7, cuts=8, amp=(6.0, 4.0, 6.0), terrace=9.0, taper=0.34)
    rock_mass('ledge', coll, cliff, wx + 2, wy + 2, wz - 2, 30, 14, 56, seed=9, cuts=5, amp=(3.0, 2.0, 2.0), terrace=14.0, taper=0.05)
    lip, step, foot = wz + 108, wz + 58, wz + 1
    # Each tier is its own object with its own white water at the lip and the foot.
    falls_sheet('fallsUpper', coll, falls_material(step, lip, 'fallsUpper'), wx - 1, wy - 3.0, step - 2, lip, 16.0, 20.0, seed=1.3, lip=3.0)
    falls_sheet('fallsLower', coll, falls_material(foot, step + 2, 'fallsLower'), wx + 2, wy - 5.5, foot, step + 2, 22.0, 30.0, seed=4.1, lip=5.0)
    foam = shading.flat('foam', '#eef5f5', rough=0.55, jitter=0.16, scale=0.2)
    rng = random.Random('falls-foam')
    # White water churning on the ledge and around the landing.
    for i in range(6):
        kit.sphere(f'ledgefoam{i}', coll, foam, wx - 9 + i * 3.6 + rng.uniform(-1, 1), wy - 2 + rng.uniform(-1.5, 1.5), step + rng.uniform(-1, 1.5), rng.uniform(2.4, 3.6), subdiv=2, squash=(1.3, 0.9, 0.7), displace=0.35, seed=20 + i)
    for i in range(18):
        u = (i + 0.5) / 18 - 0.5
        x = wx + 2 + u * 44 + rng.uniform(-2, 2)
        y = wy - 12 + rng.uniform(-5, 4) + 8 * abs(u)
        r = rng.uniform(2.5, 6.0) * (1.0 - 0.9 * abs(u))
        kit.sphere(f'foam{i}', coll, foam, x, y, h(x, y) + r * 0.25, max(1.6, r), subdiv=2, squash=(1.4, 0.9, 0.6), displace=0.4, seed=40 + i)
    pool = shading.water('pool', '#1b3a44', '#5d8f98', W, scale=0.09)
    px, py = wx + 2, wy - 16
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=40, radius1=36, radius2=36, depth=1.2, matrix=Matrix.Translation((px, py, h(px, py))) @ Matrix.Diagonal((1.0, 0.42, 1.0, 1.0)))
    kit.mesh_object('pool', bm, coll, pool, smooth=True)
    boulder = cliff_material('boulder')
    for i, (bx, by, br) in enumerate(((wx - 34, wy - 20, 7.5), (wx - 22, wy - 27, 4.5), (wx + 30, wy - 22, 6.5), (wx + 40, wy - 13, 8.0), (wx + 14, wy - 29, 3.8))):
        kit.sphere(f'boulder{i}', coll, boulder, bx, by, h(bx, by) + br * 0.3, br, subdiv=2, squash=(1.25, 0.9, 0.75), displace=0.3, seed=60 + i)


# ---------------------------------------------------------------- NEAR
NEAR_W = 2560
S = 1.5


def near(ctx):
    W = NEAR_W
    coll = common.tile(ctx, W, dict(color=srgb('#b7c2c9'), y0=0.0, y1=120.0, near=0.0, far=0.1))
    p = Periodic2D(77, W, depth_scale=80.0, k_max=60)
    edge = Periodic1D(78, W, k_min=4, k_max=90, beta=0.9)
    depth = lambda x: 90 + 16 * edge(x)
    h = lambda x, y: smoothstep(0, 30, y) * (6.0 + 4.0 * p(x, y))
    floor = shading.terrain('litter', [(0.3, '#3a3122'), (0.55, '#4d4a2c'), (0.8, '#5c6236')], W, scale=0.06, detail=7, bump=0.6)
    kit.heightfield('bank', coll, floor, 0, W, 0, 112, 4.0, 4.0, lambda x, y: h(x, y) if y < depth(x) else -40.0)
    m, pines = conifer_mats()
    rng = random.Random('forest-near')
    fern_mat = shading.foliage('fern', '#223b22', '#3d6232', '#5e8e4d', scale=0.4, bump=0.5)
    ferns = [kit.tree_proto(f'fern{i}', coll, m['bark'], fern_mat, 'bush', (10 + 3 * i) * S, seed=100 + i) for i in range(3)]
    for x in Scatter(79).slots(W, 26, jitter=0.5):
        y = rng.uniform(6, 70)
        kit.instance(rng.choice(ferns), coll, (x, y, h(x, y) - 1), scale=rng.uniform(0.7, 1.2), rot_z=rng.uniform(0, 6.28))
    tall = [kit.tree_proto(f'np{i}', coll, m['bark'], pines[i % 3], 'conifer', hgt, seed=110 + i) for i, hgt in enumerate((150, 128, 110))]
    for x in Scatter(80).slots(W, 150, jitter=0.4):
        kit.instance(rng.choice(tall), coll, (x, depth(x) - 8, 3), scale=rng.uniform(0.85, 1.05), rot_z=rng.uniform(0, 6.28))
    moss_bush = shading.foliage('mossbush', '#1f3522', '#34502c', '#4f7038', scale=0.2)
    bushes = [kit.tree_proto(f'fb{i}', coll, m['bark'], moss_bush, 'bush', (16 + 5 * i) * S, seed=120 + i) for i in range(3)]
    for x in Scatter(81).slots(W, 46, jitter=0.45):
        kit.instance(rng.choice(bushes), coll, (x, depth(x) - 4, 4), scale=rng.uniform(0.7, 1.2), rot_z=rng.uniform(0, 6.28))
    bark = shading.flat('logbark', '#4a3526', rough=0.95, jitter=0.2, scale=0.2)
    for i, x in enumerate((340, 1180, 1960)):
        y = 40 + i * 8; z = h(x, y)
        log = kit.cylinder(f'log{i}', coll, bark, 0, 0, -30 * S, 5 * S, 60 * S, segs=12)
        log.location = (x, y, z + 4 * S); log.rotation_euler = (0, math.pi / 2, rng.uniform(-0.3, 0.3))
    stump = shading.flat('stump', '#5a4230', rough=0.9, jitter=0.15)
    for x in (700, 1540, 2300):
        y = rng.uniform(30, 60)
        kit.cylinder(f'stump{x}', coll, stump, x, y, h(x, y) - 1, 7 * S, 9 * S, segs=12, r_top=6 * S)
    # Glowing mushrooms (bioluminescent at night).
    cap = shading.lamp('mushcap', color='#7cf2d2', body='#c9b89a', strength=0.95)
    stem = shading.flat('mushstem', '#e2d9c4', rough=0.8)
    shroom = kit.prop_proto('shroom', lambda bm: (bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.7, radius2=0.6, depth=4, matrix=Matrix.Translation((0, 0, 2))), bmesh.ops.create_icosphere(bm, subdivisions=1, radius=2.2, matrix=Matrix.Translation((0, 0, 4.2)) @ Matrix.Diagonal((1, 1, 0.45, 1)))), [stem, cap])
    for f in shroom.data.polygons: f.material_index = 0 if f.center.z < 3.4 else 1
    for cx in Scatter(82).slots(W, 180, jitter=0.5):
        for k in range(rng.randint(3, 6)):
            x = cx + rng.uniform(-10, 10); y = rng.uniform(10, 50)
            kit.instance(shroom, coll, (x, y, h(x, y) - 0.3), scale=rng.uniform(0.9, 1.6) * S)
    # Mossy stone lantern.
    stone = shading.flat('lanternstone', '#7a8174', rough=0.95, jitter=0.2)
    glow = shading.lamp('lanternglow', color='#ffc27a', body='#3a332a', strength=1.1)
    lx, ly = 1480, 50; lz = h(lx, ly)
    kit.cylinder('lan_base', coll, stone, lx, ly, lz - 1, 5 * S, 3 * S, segs=8)
    kit.cylinder('lan_post', coll, stone, lx, ly, lz + 2 * S, 2.2 * S, 12 * S, segs=8)
    kit.box('lan_box', coll, glow, lx, ly, lz + 14 * S, 6 * S, 6 * S, 6 * S)
    kit.gable_roof('lan_roof', coll, stone, lx, ly, lz + 20 * S, 7 * S, 7 * S, 4 * S, overhang=1.5, hip=True)
    return {'emissive': True}


# ---------------------------------------------------------------- GROUND / FRONT
def ground(ctx):
    from regions import groundkit
    coll, root = groundkit.ground_tile(ctx)
    moss = [(0.25, '#2f3f25'), (0.55, '#3e5230'), (0.85, '#51663a')]
    litter = [(0.25, '#3d3022'), (0.55, '#54432c'), (0.85, '#6a5536')]
    mat = groundkit.ground_material('forest_ground', [(0.3, '#2c3b25'), (0.6, '#394b2c'), (0.9, '#4a5e36')], [
        (598, 622, litter, 1.2),
        (622, 640, moss, 1.2),
        (640, 655, [(0.3, '#4a3b28'), (0.6, '#5c4a32'), (0.9, '#6f5a3e')], 1.0),
        (655, 693, [(0.25, '#2c3a22'), (0.55, '#3a4b2b'), (0.85, '#4b5d33')], 1.0),
    ], scale=0.13, stripes=[(598, 622, 520.0, '#2c2419', 0.4), (643, 653, 200.0, '#3a2d20', 0.45)], speckle=('#8a6a3c', 0.08, 0.03))
    groundkit.plane(root, mat)
    rng = random.Random('forest-ground')
    m = common.mats_basic()
    leaf = shading.flat('g_leaf', '#8a5a2e', rough=0.8, jitter=0.35)
    leaves = [kit.prop_proto(f'leaf{i}', lambda bm, i=i: bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.1 + 0.3 * i, matrix=Matrix.Diagonal((1.4, 1.0, 0.25, 1))), [leaf]) for i in range(3)]
    groundkit.scatter_front(coll, leaves, 655, 690, 3.5, rng)
    fern = shading.foliage('g_fern', '#1f3520', '#34522c', '#4c7038', scale=0.6)
    tufts = [common.grass_tuft_proto(shading.flat('g_moss', '#46632f', jitter=0.2), h=3.0 + i, seed=140 + i, spread=2.0) for i in range(3)]
    groundkit.scatter_front(coll, tufts, 660, 690, 6.0, rng)
    return {'focal': groundkit.FOCAL}


def front(ctx):
    from regions import groundkit
    return groundkit.front_face(ctx, soil=['#3d2e20', '#56412c', '#281d14'], lip='#4d6b34', lip_dark='#33472a', pebbles='#7c7466', roots='#2a1c12', seed=2)
