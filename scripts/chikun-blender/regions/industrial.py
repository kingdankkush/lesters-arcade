"""Industrial: morning into noon smog (concrete terrain). Kept desaturated so
the hazard-striped obstacles pop.

Palette: rust #A55B33, oxide teal #4F8A86, concrete #A7A69A, smog #CABFA7,
sodium #FF9B3D, furnace #FF6A2A.
"""
import math, random
import bmesh
from mathutils import Vector, Matrix
from chikun_lib import kit, shading
from chikun_lib.periodic import Periodic1D, smoothstep, Scatter
from chikun_lib.shading import srgb
from regions import common, urbankit as uk


def build(layer, ctx):
    return {'far': far, 'mid': mid, 'near': near, 'ground': ground, 'front': front}[layer](ctx)


def lathe(name, coll, mat, x, y, z, profile, segs=24):
    """Revolve [(radius, height)] around the vertical axis at (x, y, z)."""
    bm = bmesh.new()
    rings = []
    for r, h in profile:
        ring = [bm.verts.new((x + r * math.cos(a), y + r * math.sin(a), z + h)) for a in (i / segs * math.tau for i in range(segs))]
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    bm.faces.new(list(reversed(rings[0]))) if profile[0][0] > 0 else None
    bm.normal_update()
    return kit.mesh_object(name, bm, coll, mat, smooth=True)


def cooling_tower(coll, mat, x, y, h, r):
    prof = [(r * (0.62 + 0.38 * ((t - 0.72) / 0.72) ** 2), h * t) for t in (i / 12 for i in range(13))]
    return lathe(f'cool{x:.0f}', coll, mat, x, y, 0, prof)


def banded(name, a, b, band=6.0):
    def build(nb):
        z = nb.separate(nb.texcoord().outputs['Object'])[2]
        s = nb.math('GREATER_THAN', nb.math('FRACT', nb.math('DIVIDE', z, band * 2)), 0.5)
        return dict(color=nb.mix(a, b, s), rough=0.7)
    return shading.material(name, build)


def chimney(coll, body, bands, x, y, h, r):
    kit.cylinder(f'chim{x:.0f}', coll, body, x, y, 0, r, h * 0.82, segs=14, r_top=r * 0.8)
    kit.cylinder(f'chimtop{x:.0f}', coll, bands, x, y, h * 0.82, r * 0.8, h * 0.18, segs=14, r_top=r * 0.75)


def plume(coll, mat, x, y, z, size, rng, n=5):
    for i in range(n):
        kit.sphere(f'plume{x:.0f}_{i}', coll, mat, x + i * size * 0.7 + rng.uniform(-2, 2), y + 2, z + i * size * 0.45, size * (0.6 + 0.12 * i), subdiv=2, squash=(1.2, 1, 0.8), displace=0.3, seed=int(x) + i)


def container_mat(name, colour):
    def build(nb):
        x = nb.separate(nb.texcoord().outputs['Object'])[0]
        rib = nb.math('GREATER_THAN', nb.math('FRACT', nb.math('DIVIDE', x, 1.6)), 0.55)
        n = nb.noise(nb.texcoord().outputs['Object'], scale=0.2, detail=4.0)
        c = nb.mix(nb.rgb(colour), (0, 0, 0), nb.math('ADD', nb.math('MULTIPLY', rib, 0.18), nb.math('MULTIPLY', n, 0.15)))
        return dict(color=c, rough=0.6, spec=0.3, normal=nb.bump(rib, strength=0.4, distance=0.3))
    return shading.material(name, build)


# ---------------------------------------------------------------- FAR
def far(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#c7bda8'), y0=0.0, y1=320.0, near=0.14, far=0.42))
    rng = random.Random('ind-far')
    concrete = shading.flat('fconc', '#a7a69a', rough=0.9, jitter=0.08)
    steel = shading.flat('fsteel', '#7f8686', rough=0.5, spec=0.4)
    rust = shading.flat('frust', '#8a5a3c', rough=0.8)
    bands = banded('fbands', '#b8412f', '#e8e2d6', 5.0)
    smoke = shading.flat('fsmoke', '#d9d4ca', rough=1.0, jitter=0.05)
    ground = shading.terrain('fyard', [(0.3, '#77756b'), (0.7, '#8b887c')], W, scale=0.03)
    kit.heightfield('yard', coll, ground, 0, W, 0, 300, 10.0, 10.0, lambda x, y: 0.0)
    for x in (140, 210, 820):
        cooling_tower(coll, concrete, x, 220, rng.uniform(90, 110), 26)
        plume(coll, smoke, x + 4, 222, 105, 16, rng, n=4)
    for x in (380, 405, 980, 1005, 1180):
        r = rng.uniform(12, 18)
        kit.cylinder(f'tank{x}', coll, steel, x, 150, 0, r, r * 1.3, segs=20)
        kit.sphere(f'tankdome{x}', coll, steel, x, 150, r * 1.3, r, subdiv=2, squash=(1, 1, 0.35))
    for x in (520, 560, 700, 1100):
        chimney(coll, concrete, bands, x, 180, rng.uniform(120, 150), 5)
    # Refinery columns and pipe racks.
    for x in range(600, 690, 14):
        kit.cylinder(f'col{x}', coll, rust, x, 120, 0, 3.4, rng.uniform(50, 80), segs=10)
    kit.box('rack', coll, rust, 645, 118, 30, 110, 4, 3)
    flare = shading.lamp('flare', color='#ff8a3a', body='#6a5a4a', strength=1.0)
    kit.cylinder('flarestack', coll, steel, 760, 160, 0, 2.4, 140, segs=8)
    kit.sphere('flame', coll, flare, 760, 159, 146, 5, subdiv=2, squash=(0.8, 0.8, 1.6))
    for x in Scatter(401).slots(W, 60, jitter=0.5):
        uk.tower(coll, f'fb{x:.0f}', x, rng.uniform(40, 100), rng.uniform(30, 60), 20, rng.uniform(20, 40), shading.flat(f'fbw{int(x)%3}', ['#8f8c82', '#7a7c78', '#9a8f7e'][int(x) % 3]), shading.flat('fbroof', '#5b5a55'), rng)
    return {'emissive': True}


# ---------------------------------------------------------------- MID
def mid(ctx):
    W = 1280
    coll = common.tile(ctx, W, dict(color=srgb('#c9bfaa'), y0=0.0, y1=260.0, near=0.03, far=0.22))
    rng = random.Random('ind-mid')
    ground = shading.terrain('myard', [(0.3, '#7b786d'), (0.7, '#8f8b7e')], W, scale=0.04)
    kit.heightfield('yard', coll, ground, 0, W, 0, 260, 10.0, 10.0, lambda x, y: 0.0)
    shed = [shading.wall(f'shed{i}', c, window=dict(w=5, h=4, cols_px=9, rows_px=40, x0=0, z0=14, z_min=8, z_max=22, glass='#26302f', lit='#ffb56a', lit_prob=0.6, building_lit=0.7), rough=0.9) for i, c in enumerate(['#9a988c', '#8a6a52', '#6f8580', '#a39884'])]
    roof = shading.flat('sawroof', '#5a5d5c', rough=0.7)
    glass = shading.lamp('rooflight', color='#ffd49a', body='#7fa0a8', strength=0.8)
    x = 0.0
    while x < W - 40:
        w = rng.uniform(80, 150); y = rng.uniform(60, 140); h = rng.uniform(22, 34)
        m = rng.choice(shed)
        kit.box(f'shed{x:.0f}', coll, m, x + w / 2, y, 0, w, 40, h)
        n = max(2, int(w / 20))
        for t in range(n):
            tx = x + (t + 0.5) * w / n
            bm = bmesh.new()
            p = [(tx - w / n / 2, y - 20, h), (tx + w / n / 2, y - 20, h), (tx + w / n / 2, y + 20, h), (tx - w / n / 2, y + 20, h), (tx + w / n / 2 - 1, y - 20, h + 12), (tx + w / n / 2 - 1, y + 20, h + 12)]
            v = [bm.verts.new(q) for q in p]
            bm.faces.new((v[0], v[1], v[4])); bm.faces.new((v[3], v[5], v[2])); bm.faces.new((v[0], v[4], v[5], v[3])); bm.faces.new((v[1], v[2], v[5], v[4]))
            kit.mesh_object('saw', bm, coll, roof)
            kit.box(f'sl{tx:.0f}', coll, glass, tx + w / n / 2 - 1.4, y, h + 1, 0.6, 38, 10)
        x += w + rng.uniform(10, 60)
    concrete = shading.flat('mconc', '#a4a296', rough=0.9)
    bands = banded('mbands', '#b8412f', '#e8e2d6', 6.0)
    smoke = shading.flat('msmoke', '#e2ddd3', rough=1.0, jitter=0.05)
    for sx in (190, 560, 1010):
        chimney(coll, concrete, bands, sx, 170, rng.uniform(150, 175), 7)
        plume(coll, smoke, sx + 4, 172, 170, 13, rng, n=5)
    rust = shading.flat('mrust', '#8f5536', rough=0.8)
    # Conveyor gantries.
    for cx in (330, 780):
        belt = kit.box(f'conv{cx}', coll, rust, 0, 0, 0, 120, 5, 4)
        belt.location = (cx, 40, 36); belt.rotation_euler = (0, -0.35, 0)
        for dx in (-45, 0, 40): kit.box(f'cleg{cx}{dx}', coll, rust, cx + dx, 40, 0, 2, 2, 36 - dx * 0.35)
    # Landmark gantry crane.
    gx = 900
    yellow = shading.flat('craneyellow', '#c99a2e', rough=0.6)
    for dx in (-26, 26):
        kit.box(f'cr_leg{dx}', coll, yellow, gx + dx, 60, 0, 4, 4, 120)
    kit.box('cr_beam', coll, yellow, gx, 60, 120, 150, 6, 7)
    kit.box('cr_cab', coll, shading.wall('crcab', '#d9c9a0', window=dict(w=3, h=3, cols_px=5, rows_px=5, x0=0, z0=110, z_min=108, z_max=116, glass='#26302f', lit='#ffd79a', lit_prob=1.0)), gx - 30, 58, 108, 10, 8, 10)
    kit.box('cr_cable', coll, shading.flat('cable', '#2c2e30'), gx + 40, 60, 60, 0.8, 0.8, 60)
    kit.box('cr_hook', coll, shading.flat('hook', '#2c2e30'), gx + 40, 60, 56, 4, 3, 4)
    beacon = shading.lamp('beacon', color='#ff9b3d', body='#5a3a1a', strength=1.0)
    for bx in (gx - 75, gx + 75): kit.sphere(f'beacon{bx}', coll, beacon, bx, 58, 128, 1.8, subdiv=1)
    return {'emissive': True, 'landmarks': [{'id': 'crane', 'u': gx}]}


# ---------------------------------------------------------------- NEAR
NEAR_W = 2560


def near(ctx):
    W = NEAR_W
    coll = common.tile(ctx, W, dict(color=srgb('#c9bfaa'), y0=0.0, y1=120.0, near=0.0, far=0.08))
    rng = random.Random('ind-near')
    slab = shading.terrain('nslab', [(0.3, '#7d7b72'), (0.7, '#918e83')], W, scale=0.2)
    kit.heightfield('yard', coll, slab, 0, W, 0, 80, 10.0, 10.0, lambda x, y: 0.0)
    colours = ['#a55b33', '#4f8a86', '#39597a', '#8e3b30', '#6b7b4a', '#b08a3e', '#5e5a55']
    cmat = [container_mat(f'box{i}', c) for i, c in enumerate(colours)]
    cw, ch, cd = 50.0, 21.0, 21.0
    x = 20.0
    while x < W - 60:
        if rng.random() < 0.55:
            cols = rng.randint(1, 3); y = rng.uniform(40, 60)
            for c in range(cols):
                for level in range(rng.randint(1, 4)):
                    kit.box(f'ct{x:.0f}{c}{level}', coll, rng.choice(cmat), x + c * (cw + 0.8) + cw / 2, y + (level % 2) * 1.5, level * (ch + 0.4), cw, cd, ch)
            x += cols * (cw + 0.8) + rng.uniform(20, 70)
        else:
            x += rng.uniform(60, 120)
    steel = shading.flat('fence', '#6d7272', rough=0.5, spec=0.4)
    for fx in range(0, W, 26):
        kit.box(f'fp{fx}', coll, steel, fx, 16, 0, 1.2, 1.2, 22)
    for fz in (6, 14, 21):
        kit.box(f'fr{fz}', coll, shading.flat('rail', '#7a7f80', rough=0.5, period=W), W / 2, 16, fz, W, 0.6, 0.8)
    drum = [shading.flat(f'drum{i}', c, rough=0.6) for i, c in enumerate(['#3e5f86', '#a0422f', '#c79a36', '#4f7a55'])]
    for bx in Scatter(402).slots(W, 90, jitter=0.5):
        for k in range(rng.randint(2, 5)):
            kit.cylinder(f'drum{bx:.0f}{k}', coll, rng.choice(drum), bx + k * 5.5, rng.uniform(26, 32), 0, 2.6, 8, segs=12)
    wood = shading.flat('pallet', '#9a7a52', jitter=0.15)
    for px in Scatter(403).slots(W, 140, jitter=0.5):
        for k in range(rng.randint(1, 4)): kit.box(f'pal{px:.0f}{k}', coll, wood, px, 34, k * 2.2, 14, 12, 1.6)
    # Forklift.
    fk = 1300
    kit.box('fk_body', coll, shading.flat('fkbody', '#d19a2c', rough=0.5), fk, 30, 3, 16, 10, 10)
    kit.box('fk_mast', coll, steel, fk + 9, 30, 0, 1.6, 8, 24)
    kit.box('fk_fork', coll, steel, fk + 14, 30, 2, 8, 6, 0.8)
    kit.box('fk_cab', coll, steel, fk - 2, 30, 13, 10, 9, 0.8)
    for dx in (-5, 5): kit.cylinder(f'fkw{dx}', coll, shading.flat('fkt', '#1b1c1e'), 0, 0, -1.5, 3.2, 3, segs=12).location = (fk + dx, 24, 3.2)
    beacon = shading.lamp('nbeacon', color='#ff9b3d', body='#5a3a1a', strength=1.0)
    sodium = shading.lamp('nsodium', color='#ff9b3d', body='#d8cfb8', strength=1.0)
    for lx in Scatter(404).slots(W, 220, jitter=0.2):
        uk.street_lamp(coll, steel, sodium, lx, 10, 0, h=56, arm=9)
    kit.sphere('fkbeacon', coll, beacon, fk - 2, 30, 15, 1.6, subdiv=1)
    return {'emissive': True}


# ---------------------------------------------------------------- GROUND / FRONT
def ground(ctx):
    from regions import groundkit
    coll, root = groundkit.ground_tile(ctx)
    conc = [(0.25, '#7a786f'), (0.55, '#8a887e'), (0.85, '#9a978c')]
    mat = groundkit.ground_material('ind_ground', [(0.3, '#6f6d64'), (0.6, '#7e7c72'), (0.9, '#8d8a7f')], [
        (598, 618, conc, 1.0),
        (618, 632, [(0.3, '#5c5750'), (0.6, '#6b655c'), (0.9, '#797269')], 0.8),
        (632, 666, conc, 1.0),
        (666, 693, [(0.25, '#6c6a62'), (0.55, '#7a776e'), (0.85, '#88857b')], 1.0),
    ], scale=0.25, stripes=[(632, 666, 70.0, '#5b5953', 0.6), (666, 693, 45.0, '#5e5c56', 0.5)])
    groundkit.plane(root, mat)
    yellow = shading.flat('safety', '#d0a332', rough=0.6, jitter=0.05)
    steel = shading.flat('railsteel', '#8d8f8c', rough=0.3, spec=0.7)
    bm = bmesh.new()
    for rows in ((648, 649.5), (661, 662.5)):
        y0, y1 = groundkit.depth_of_row(rows[1]), groundkit.depth_of_row(rows[0])
        kit._bm_box(bm, groundkit.PERIOD / 2, (y0 + y1) / 2, 0.0, groundkit.PERIOD, y1 - y0, 0.2)
    kit.mesh_object('safetylines', bm, coll, yellow)
    bm = bmesh.new()
    for rows in ((622, 622.8), (627, 627.8)):
        y0, y1 = groundkit.depth_of_row(rows[1]), groundkit.depth_of_row(rows[0])
        kit._bm_box(bm, groundkit.PERIOD / 2, (y0 + y1) / 2, 0.5, groundkit.PERIOD, y1 - y0, 1.0)
    kit.mesh_object('rails', bm, coll, steel)
    return {'focal': groundkit.FOCAL}


def front(ctx):
    from regions import groundkit
    return groundkit.block_face(ctx, ['#6d6a62', '#8a877c'], '#4a4843', '#b2afa3', seed=5, block=(64.0, 12.0), cap_h=6.0, grit='#7a766c')
