"""Scene setup and props shared by several regions."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise
from chikun_lib import core, shading, kit
from chikun_lib.shading import srgb

KEY = dict(strength=3.4, azimuth=-35.0, elevation=40.0, angle=3.0)


def tile(ctx, width, haze, copies=(-1, 1), key=None, fill=(0.62, 0.72, 0.9), fill_strength=0.38, rim=True):
    """Light rig + haze + the periodic tile collection (instanced at +-width)."""
    scene = ctx['scene']
    shading.HAZE.update(haze)
    shading.TILE['period'] = float(width)
    k = dict(KEY); k.update(key or {})
    core.sun(scene, **k)
    if rim:
        # A faint cool back light from the upper right separates silhouettes.
        core.sun(scene, strength=0.55, azimuth=150.0, elevation=28.0, angle=8.0, color=(0.78, 0.86, 1.0), name='Rim')
    core.world(scene, fill, fill_strength)
    coll = core.collection(scene, 'tile')
    core.tile_instances(scene, coll, width, copies)
    ctx['coll'] = coll
    ctx['width'] = width
    return coll


def rng(ctx, salt):
    # String seeds hash through SHA-512, so builds do not depend on PYTHONHASHSEED.
    return random.Random(f"{ctx['region']}:{ctx['layer']}:{salt}")


# ---------------------------------------------------------------- materials

def mats_basic():
    return dict(
        bark=shading.flat('bark', '#5a4330', rough=0.9, jitter=0.12, scale=0.3),
        wood=shading.flat('wood', '#8a6a48', rough=0.85, jitter=0.1, scale=0.2),
        grey_wood=shading.flat('grey_wood', '#9a8f80', rough=0.9, jitter=0.12, scale=0.2),
        stone=shading.flat('stone', '#8b877d', rough=0.95, jitter=0.15, scale=0.15),
        metal=shading.flat('metal', '#6e7479', rough=0.45, jitter=0.05, spec=0.5),
        dark=shading.flat('dark', '#2d3033', rough=0.7, jitter=0.05),
        white=shading.flat('white', '#e8e3d6', rough=0.8, jitter=0.05),
    )


# ---------------------------------------------------------------- props

def fence_split_rail(coll, mat, x0, x1, y, h=14.0, spacing=26.0, seed=1):
    r = random.Random(seed)
    bm = bmesh.new()
    x = x0
    posts = []
    while x <= x1:
        yy = y + r.uniform(-1.2, 1.2)
        kit._bm_box(bm, x, yy, 0.0, 2.2, 2.2, h + r.uniform(-1, 1.5))
        posts.append((x, yy))
        x += spacing * r.uniform(0.9, 1.1)
    for (ax, ay), (bx, by) in zip(posts, posts[1:]):
        for zr in (h * 0.45, h * 0.82):
            length = math.hypot(bx - ax, by - ay) + 3
            m = Matrix.Translation(((ax + bx) / 2, (ay + by) / 2, zr + r.uniform(-0.6, 0.6))) @ Matrix.Rotation(math.atan2(by - ay, bx - ax), 4, 'Z') @ Matrix.Diagonal((length, 1.4, 1.6, 1))
            bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return kit.mesh_object('fence', bm, coll, mat)


def fence_picket(coll, mat, x0, x1, y, h=12.0, spacing=4.0):
    bm = bmesh.new()
    x = x0
    while x <= x1:
        verts = kit._bm_box(bm, x, y, 0.0, 2.4, 0.8, h)
        top = [v for v in verts if v.co.z > h - 0.01]
        cx = sum(v.co.x for v in top) / len(top)
        apex = bm.verts.new((cx, y, h + 1.6))
        x += spacing
    for zr in (h * 0.3, h * 0.75):
        kit._bm_box(bm, (x0 + x1) / 2, y + 0.9, zr, x1 - x0, 0.6, 1.2)
    return kit.mesh_object('picket', bm, coll, mat)


def hay_bale_proto(mat, r=8.0, length=12.0):
    def build(bm):
        m = Matrix.Rotation(math.pi / 2, 4, 'X') @ Matrix.Diagonal((1, 1, 1, 1))
        ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=r, radius2=r, depth=length, matrix=Matrix.Translation((0, 0, r)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
        for v in ret['verts']:
            v.co.x *= 1.0; v.co.z = r + (v.co.z - r) * 0.93
    return kit.prop_proto('bale', build, [mat])


def cow_proto(body_mat, dark_mat, s=1.0):
    def build(bm):
        def ell(c, rad, sq, mi):
            ret = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=rad)
            for v in ret['verts']: v.co = Vector((v.co.x * sq[0], v.co.y * sq[1], v.co.z * sq[2])) + Vector(c)
            for f in bm.faces:
                if all(v in ret['verts'] for v in f.verts): f.material_index = mi
        ell((0, 0, 14 * s), 10 * s, (1.35, 0.62, 0.72), 0)
        ell((13 * s, 0, 17 * s), 4.5 * s, (1.1, 0.8, 0.9), 0)
        ell((16.5 * s, 0, 15.5 * s), 2.6 * s, (1.0, 0.9, 0.8), 1)
        for dx in (-8, -4, 5, 9):
            ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=1.4 * s, radius2=1.7 * s, depth=9 * s, matrix=Matrix.Translation((dx * s, (1 if dx % 2 else -1) * 2.5 * s, 4.5 * s)))
            for f in bm.faces:
                if all(v in ret['verts'] for v in f.verts): f.material_index = 1 if dx > 0 else 0
    return kit.prop_proto('cow', build, [body_mat, dark_mat])


def cow_material():
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        v = nb.voronoi(nb.vmath('MULTIPLY', pos, (1.0, 1.0, 1.0)), scale=0.12, w=nb.math('MULTIPLY', nb.object_random(), 10.0), feature='F1')
        spots = nb.math('LESS_THAN', nb.noise(pos, scale=0.09, detail=2.0, w=nb.math('MULTIPLY', nb.object_random(), 7.0)), 0.44)
        c = nb.mix('#efece4', '#26262a', spots)
        return dict(color=c, rough=0.8)
    return shading.material('cow', build)


def sunflower_proto(stem_mat, petal_mat, disc_mat, h=22.0, seed=1):
    r = random.Random(seed)
    def build(bm):
        ret = bmesh.ops.create_cone(bm, cap_ends=False, segments=5, radius1=0.7, radius2=0.5, depth=h, matrix=Matrix.Translation((0, 0, h / 2)))
        for f in bm.faces: f.material_index = 0
        tilt = Matrix.Translation((0, -1.0, h + 1.5)) @ Matrix.Rotation(math.radians(80 + r.uniform(-12, 12)), 4, 'X')
        p = bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=5.2, radius2=5.2, depth=0.6, matrix=tilt)
        for v in p['verts']:
            a = math.atan2(v.co.y, v.co.x)
        for f in bm.faces:
            if all(v in p['verts'] for v in f.verts): f.material_index = 1
        d = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=2.6, radius2=2.6, depth=1.4, matrix=tilt @ Matrix.Translation((0, 0, -0.5)))
        for f in bm.faces:
            if all(v in d['verts'] for v in f.verts): f.material_index = 2
        for leaf in range(2):
            l = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=2.2)
            for v in l['verts']: v.co = Vector((v.co.x * 1.4 + (2.5 if leaf else -2.5), v.co.y * 0.3, v.co.z * 0.5 + h * (0.45 + 0.2 * leaf)))
            for f in bm.faces:
                if all(v in l['verts'] for v in f.verts): f.material_index = 0
    return kit.prop_proto('sunflower', build, [stem_mat, petal_mat, disc_mat])


def grass_tuft_proto(mat, h=5.0, blades=7, seed=1, spread=2.5):
    r = random.Random(seed)
    def build(bm):
        for i in range(blades):
            a = r.uniform(-0.5, 0.5)
            x = r.uniform(-spread, spread); y = r.uniform(-spread * 0.4, spread * 0.4)
            hh = h * r.uniform(0.6, 1.1)
            v0 = bm.verts.new((x - 0.35, y, 0)); v1 = bm.verts.new((x + 0.35, y, 0))
            v2 = bm.verts.new((x + math.sin(a) * hh, y, hh))
            bm.faces.new((v0, v1, v2))
    return kit.prop_proto('tuft', build, [mat])


def rock_proto(mat, r=6.0, seed=1, squash=(1.2, 1.0, 0.7)):
    def build(bm):
        ret = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
        off = Vector((seed * 2.7, seed * 1.3, seed * 0.7))
        for v in ret['verts']:
            n = noise.noise(v.co / r * 1.3 + off)
            co = v.co * (1 + 0.3 * n)
            v.co = Vector((co.x * squash[0], co.y * squash[1], max(-r * 0.2, co.z * squash[2]) + r * 0.45 * squash[2]))
    return kit.prop_proto('rock', build, [mat])


def lamp_post_proto(pole_mat, lamp_mat, h=30.0, arm=6.0):
    def build(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.9, radius2=0.7, depth=h, matrix=Matrix.Translation((0, 0, h / 2)))
        kit._bm_box(bm, arm / 2, 0, h - 1.2, arm, 1.0, 1.0)
        for f in bm.faces: f.material_index = 0
        ret = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.9)
        for v in ret['verts']: v.co += Vector((arm, 0, h - 3.0))
        for f in bm.faces:
            if all(v in ret['verts'] for v in f.verts): f.material_index = 1
    return kit.prop_proto('lamppost', build, [pole_mat, lamp_mat])


def scatter_on(coll, proto, xs, y_fn, z_fn, scale_fn=None, rot=True, seed=1):
    r = random.Random(seed)
    out = []
    for x in xs:
        y = y_fn(x, r)
        s = scale_fn(r) if scale_fn else 1.0
        out.append(kit.instance(proto, coll, (x, y, z_fn(x, y)), scale=s, rot_z=r.uniform(-0.4, 0.4) if rot else 0.0))
    return out


# ---------------------------------------------------------------- ranges
def mountain_range(coll, mat, W, y0, depth, peak_fn, seed=1, step=3.0, skirt=160.0, freq=0.012, sharp=1.0):
    """A deep, x-periodic mountain mass with real ridges: height = envelope(depth)
    x peak_fn(x) x ridged multifractal noise sampled on a circle in x (so the
    strip wraps exactly). Lit from the upper left, every ridge gets a lit and a
    shadowed face."""
    import math
    from mathutils import Vector, noise
    from chikun_lib.periodic import smoothstep
    R = W / math.tau
    off = Vector((seed * 31.7, seed * 17.3, seed * 7.9))
    def h(x, y):
        t = (y - y0) / depth
        env = smoothstep(0.0, 0.7, t) * (1.0 - 0.3 * smoothstep(0.85, 1.0, t))
        a = math.tau * x / W
        p = Vector((R * math.cos(a), R * math.sin(a), y)) * freq + off
        r = noise.ridged_multi_fractal(p, 1.0, 2.1, 6, 1.0, 2.0, noise_basis='PERLIN_ORIGINAL')
        r = max(0.0, min(1.6, r)) / 1.6
        return max(0.0, peak_fn(x) * env * (0.35 + 0.65 * r ** sharp))
    return kit.heightfield('range', coll, mat, 0, W, y0, y0 + depth, step, step, h, skirt=skirt)


def mountain_material(W, rock=('#56626f', '#8391a0'), snow='#eef2f5', snow_line=80.0, name='mountains'):
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        vec, w = nb.periodic(pos, W)
        n = nb.noise(vec, scale=0.03, detail=7.0, rough=0.6, w=w)
        streak = nb.noise(nb.vmath('MULTIPLY', vec, (1.0, 1.0, 0.25)), scale=0.09, detail=4.0, w=w)
        c = nb.ramp(nb.math('ADD', nb.math('MULTIPLY', n, 0.6), nb.math('MULTIPLY', streak, 0.5)), [(0.3, rock[0]), (0.75, rock[1])])
        z = nb.separate(pos)[2]
        up = nb.separate(nb.geometry().outputs['Normal'])[2]
        line = nb.math('ADD', snow_line, nb.math('MULTIPLY', nb.math('SUBTRACT', n, 0.5), 34.0))
        cover = nb.math('MULTIPLY', nb.maprange(nb.math('SUBTRACT', z, line), -3.0, 5.0, 0.0, 1.0, smooth=True), nb.maprange(up, 0.35, 0.65, 0.0, 1.0, smooth=True))
        c = nb.mix(c, snow, cover)
        normal = nb.bump(nb.math('ADD', n, streak), strength=0.6, distance=2.0)
        return dict(color=c, rough=0.92, normal=normal)
    return shading.material(name, build)
