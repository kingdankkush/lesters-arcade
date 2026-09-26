"""Buildings and street furniture for the town, city, suburbs and industrial
regions. Walls carry window grids (lit in the emission pass); everything is
bmesh-built from seeded parameters."""
import math, random
import bmesh
from mathutils import Vector, Matrix
from chikun_lib import kit, shading
from chikun_lib.shading import srgb


def gable_front(name, coll, mat, cx, cy, z0, w, d, h, overhang=1.2):
    """Roof with the ridge running into the depth: the camera sees the gable end."""
    bm = bmesh.new()
    x0, x1 = cx - w / 2 - overhang, cx + w / 2 + overhang
    y0, y1 = cy - d / 2 - overhang, cy + d / 2 + overhang
    v = [bm.verts.new(p) for p in [(x0, y0, z0), (x1, y0, z0), (cx, y0, z0 + h), (x0, y1, z0), (x1, y1, z0), (cx, y1, z0 + h)]]
    bm.faces.new((v[0], v[1], v[2])); bm.faces.new((v[5], v[4], v[3]))
    bm.faces.new((v[0], v[2], v[5], v[3])); bm.faces.new((v[1], v[4], v[5], v[2])); bm.faces.new((v[0], v[3], v[4], v[1]))
    bm.normal_update()
    return kit.mesh_object(name, bm, coll, mat)


def gable_wall(name, coll, mat, cx, cy, z0, w, h):
    """Triangular wall filling a front gable (same material as the facade)."""
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(cx - w / 2, cy, z0), (cx + w / 2, cy, z0), (cx, cy, z0 + h)]]
    bm.faces.new(v)
    return kit.mesh_object(name, bm, coll, mat)


def townhouse(coll, name, x, y, w, d, h, wall, roof, rng, style='front', chimney=None, roof_h=None):
    objs = [kit.box(name + '.w', coll, wall, x, y, 0.0, w, d, h)]
    rh = roof_h if roof_h is not None else w * rng.uniform(0.45, 0.7)
    if style == 'front':
        objs.append(gable_front(name + '.r', coll, roof, x, y, h, w, d, rh))
        objs.append(gable_wall(name + '.g', coll, wall, x, y - d / 2 + 0.01, h, w, rh * 0.92))
    elif style == 'side':
        objs.append(kit.gable_roof(name + '.r', coll, roof, x, y, h, w, d, rh * 0.8, overhang=1.2))
    elif style == 'hip':
        objs.append(kit.gable_roof(name + '.r', coll, roof, x, y, h, w, d, rh * 0.7, overhang=1.2, hip=True))
    elif style == 'flat':
        objs.append(kit.box(name + '.p', coll, roof, x, y, h, w + 0.8, d + 0.8, 2.0))
    if chimney is not None and style != 'flat':
        cx = x + w * rng.uniform(-0.3, 0.3)
        objs.append(kit.box(name + '.c', coll, chimney, cx, y + d * 0.2, h, max(2.0, w * 0.1), max(2.0, w * 0.1), rh * 0.85))
    return objs


def place(objs, z):
    for o in objs: o.location.z += z
    return objs


def tower(coll, name, x, y, w, d, h, wall, top, rng, crown=None):
    objs = [kit.box(name + '.w', coll, wall, x, y, 0.0, w, d, h)]
    objs.append(kit.box(name + '.t', coll, top, x, y, h, w + 0.6, d + 0.6, 1.6))
    if crown == 'units':
        for i in range(rng.randint(1, 3)):
            objs.append(kit.box(f'{name}.u{i}', coll, top, x + rng.uniform(-w * 0.3, w * 0.3), y + rng.uniform(-d * 0.2, d * 0.2), h + 1.6, rng.uniform(3, 7), rng.uniform(3, 6), rng.uniform(2, 5)))
    elif crown == 'setback':
        objs.append(kit.box(name + '.s', coll, wall, x, y, h + 1.6, w * 0.7, d * 0.7, h * rng.uniform(0.12, 0.25)))
    return objs


def street_lamp(coll, pole, glow, x, y, z, h=30.0, arm=5.0):
    kit.cylinder(f'lamp{x:.0f}', coll, pole, x, y, z, 0.8, h, segs=8, r_top=0.6)
    kit.box(f'arm{x:.0f}', coll, pole, x + arm / 2, y, z + h - 1.0, arm, 0.8, 0.8)
    kit.sphere(f'bulb{x:.0f}', coll, glow, x + arm, y, z + h - 2.4, 1.9, subdiv=2)


def car_proto(body, glass, tyre, s=1.0, seed=1):
    r = random.Random(seed)
    L = 22 * s * r.uniform(0.9, 1.1)
    def build(bm):
        kit._bm_box(bm, 0, 0, 2.2 * s, L, 9 * s, 4.2 * s)
        for f in bm.faces: f.material_index = 0
        before = set(bm.faces)
        kit._bm_box(bm, -1.5 * s, 0, 6.2 * s, L * 0.55, 8 * s, 3.6 * s)
        for f in bm.faces:
            if f not in before: f.material_index = 1
        before = set(bm.faces)
        for dx in (-L * 0.32, L * 0.32):
            bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=2.3 * s, radius2=2.3 * s, depth=9.4 * s, matrix=Matrix.Translation((dx, 0, 2.3 * s)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
        for f in bm.faces:
            if f not in before: f.material_index = 2
    return kit.prop_proto('car', build, [body, glass, tyre])


def awning(coll, mat, x, y, z, w, depth, drop):
    """Sloped shop awning projecting toward the camera."""
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(x - w / 2, y, z), (x + w / 2, y, z), (x + w / 2, y - depth, z - drop), (x - w / 2, y - depth, z - drop)]]
    bm.faces.new(v)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.4)
    return kit.mesh_object('awning', bm, coll, mat)


def stripe_material(name, a, b, width=2.0, emit=None):
    def build(nb):
        x = nb.separate(nb.texcoord().outputs['Object'])[0]
        s = nb.math('GREATER_THAN', nb.math('FRACT', nb.math('DIVIDE', x, width * 2)), 0.5)
        return dict(color=nb.mix(a, b, s), rough=0.8)
    return shading.material(name, build)


def string_lights(coll, bulb, wire, x0, x1, y, z, sag=4.0, spacing=4.0):
    n = max(2, int((x1 - x0) / spacing))
    bm = bmesh.new()
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        zz = z - sag * 4 * t * (1 - t)
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.7, matrix=Matrix.Translation((x, y, zz)))
    kit.mesh_object('bulbs', bm, coll, bulb)


def sign(coll, mat, x, y, z, w, h, depth=1.0):
    return kit.box('sign', coll, mat, x, y, z, w, depth, h)
