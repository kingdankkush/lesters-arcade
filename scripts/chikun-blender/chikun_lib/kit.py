"""Mesh kitbash for the scenery: terrain, foliage, buildings and props.

Everything is built with bmesh from seeded parameters (no bpy.ops), so a
build is reproducible and fast. Repeated props are linked duplicates of one
prototype mesh; per-object colour variation comes from Object Info > Random.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise

UP = Vector((0, 0, 1))


_COUNTER = [0]


def link(obj, coll):
    # Deterministic per-object index (creation order) for colour variation;
    # see shading.NB.object_random().
    _COUNTER[0] += 1
    obj.pass_index = (_COUNTER[0] * 7919) % 32749
    coll.objects.link(obj)
    return obj


def mesh_object(name, bm, coll, mat=None, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    if mat is not None:
        me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    return link(obj, coll)


def instance(proto, coll, loc, scale=1.0, rot_z=0.0, name=None):
    obj = bpy.data.objects.new(name or proto.name + '.i', proto.data)
    obj.location = loc
    obj.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    obj.rotation_euler = (0, 0, rot_z)
    return link(obj, coll)


def assign(bm, index):
    for f in bm.faces: f.material_index = index


# ---------------------------------------------------------------- terrain

def heightfield(name, coll, mat, x0, x1, y0, y1, step_x, step_y, hfn, skirt=0.0):
    """Grid over [x0,x1] x [y0,y1] with z = hfn(x, y). A negative skirt drops the
    front edge below the ground so nothing shows under the baseline."""
    bm = bmesh.new()
    nx = max(2, int(round((x1 - x0) / step_x)) + 1)
    ny = max(2, int(round((y1 - y0) / step_y)) + 1)
    grid = []
    for j in range(ny):
        y = y0 + (y1 - y0) * j / (ny - 1)
        row = []
        for i in range(nx):
            x = x0 + (x1 - x0) * i / (nx - 1)
            row.append(bm.verts.new((x, y, hfn(x, y))))
        grid.append(row)
    for j in range(ny - 1):
        for i in range(nx - 1):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    if skirt:
        front = [bm.verts.new((v.co.x, v.co.y, v.co.z - skirt)) for v in grid[0]]
        for i in range(nx - 1):
            bm.faces.new((front[i + 1], front[i], grid[0][i], grid[0][i + 1]))
    bm.normal_update()
    bm.verts.index_update()
    # Normals from the height function itself (central differences), not from
    # the mesh: at the tile edges the mesh only sees one side, which would
    # leave a lighting seam where the strip wraps.
    ex, ey = (x1 - x0) / (nx - 1) * 0.5, (y1 - y0) / (ny - 1) * 0.5
    normals = []
    for v in bm.verts:
        x, y = v.co.x, v.co.y
        if v.index >= nx * ny:
            normals.append((0.0, -1.0, 0.0)); continue
        dzx = (hfn(x + ex, y) - hfn(x - ex, y)) / (2 * ex)
        dzy = (hfn(x, min(y1, y + ey)) - hfn(x, max(y0, y - ey))) / (min(y1, y + ey) - max(y0, y - ey))
        n = Vector((-dzx, -dzy, 1.0)).normalized()
        normals.append(tuple(n))
    obj = mesh_object(name, bm, coll, mat, smooth=True)
    obj.data.normals_split_custom_set_from_vertices(normals)
    return obj


def ridge_profile(name, coll, mat, period, hfn, y, depth=40.0, base=-20.0, step=4.0):
    """A thin extruded silhouette (distant ranges): front face follows hfn(x),
    periodic in x. Cheap and crisp for far layers."""
    return heightfield(name, coll, mat, 0.0, period, y, y + depth, step, depth / 2, lambda x, yy: hfn(x) * (1.0 - 0.15 * (yy - y) / depth), skirt=-base if base < 0 else 0.0)


# ---------------------------------------------------------------- primitives

def _bm_box(bm, cx, cy, z0, w, d, h):
    m = Matrix.Translation((cx, cy, z0 + h / 2)) @ Matrix.Diagonal((w, d, h, 1))
    return bmesh.ops.create_cube(bm, size=1.0, matrix=m)['verts']


def box(name, coll, mat, cx, cy, z0, w, d, h, bevel=0.0):
    bm = bmesh.new(); _bm_box(bm, cx, cy, z0, w, d, h)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect='EDGES')
    return mesh_object(name, bm, coll, mat)


def cylinder(name, coll, mat, cx, cy, z0, r, h, segs=16, r_top=None, cap=True):
    bm = bmesh.new()
    m = Matrix.Translation((cx, cy, z0 + h / 2))
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs, radius1=r, radius2=r if r_top is None else r_top, depth=h, matrix=m)
    return mesh_object(name, bm, coll, mat, smooth=True)


def sphere(name, coll, mat, cx, cy, cz, r, subdiv=2, squash=(1, 1, 1), displace=0.0, seed=0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    off = Vector((seed * 13.37, seed * 7.1, seed * 3.3))
    for v in bm.verts:
        co = v.co.copy()
        if displace:
            n = noise.noise(co / r * 1.6 + off)
            co *= 1.0 + displace * n
        v.co = Vector((co.x * squash[0] + cx, co.y * squash[1] + cy, co.z * squash[2] + cz))
    bm.normal_update()
    return mesh_object(name, bm, coll, mat, smooth=True)


def gable_roof(name, coll, mat, cx, cy, z0, w, d, h, overhang=2.0, hip=False):
    """Ridge runs along x (the camera sees the long sloped face)."""
    bm = bmesh.new()
    x0, x1 = cx - w / 2 - overhang, cx + w / 2 + overhang
    y0, y1 = cy - d / 2 - overhang, cy + d / 2 + overhang
    inset = (w / 2) * 0.8 if hip else 0.0
    v = [bm.verts.new(p) for p in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0 + inset, cy, z0 + h), (x1 - inset, cy, z0 + h)]]
    bm.faces.new((v[0], v[1], v[5], v[4]))
    bm.faces.new((v[2], v[3], v[4], v[5]))
    bm.faces.new((v[3], v[0], v[4]))
    bm.faces.new((v[1], v[2], v[5]))
    bm.faces.new((v[0], v[3], v[2], v[1]))
    bm.normal_update()
    return mesh_object(name, bm, coll, mat)


def gambrel_roof(name, coll, mat, cx, cy, z0, w, d, h, overhang=2.0):
    """Barn roof: ridge along x, double-pitched front and back."""
    bm = bmesh.new()
    x0, x1 = cx - w / 2 - overhang, cx + w / 2 + overhang
    prof = [(-d / 2 - overhang, 0), (-d * 0.36, h * 0.62), (0, h), (d * 0.36, h * 0.62), (d / 2 + overhang, 0)]
    left = [bm.verts.new((x0, cy + py, z0 + pz)) for py, pz in prof]
    right = [bm.verts.new((x1, cy + py, z0 + pz)) for py, pz in prof]
    for i in range(len(prof) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    bm.faces.new(list(reversed(left)))
    bm.faces.new(right)
    bm.normal_update()
    return mesh_object(name, bm, coll, mat)


# ---------------------------------------------------------------- foliage prototypes

def tree_proto(name, coll, trunk_mat, leaf_mat, kind='round', height=40.0, seed=1):
    """One tree mesh (trunk + crown clumps) with origin at the trunk base.
    kinds: round, poplar, conifer, pine, willow, blossom, bush, palm."""
    rng = random.Random(seed)
    bm = bmesh.new()
    trunk_h = height * {'round': 0.45, 'poplar': 0.2, 'conifer': 0.15, 'pine': 0.55, 'willow': 0.45, 'blossom': 0.45, 'bush': 0.02, 'palm': 0.85}.get(kind, 0.4)
    trunk_r = height * (0.045 if kind != 'palm' else 0.03)
    if kind != 'bush':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=7, radius1=trunk_r, radius2=trunk_r * 0.6, depth=trunk_h + height * 0.1, matrix=Matrix.Translation((0, 0, (trunk_h + height * 0.1) / 2)))
    trunk = set(bm.faces)  # faces of the trunk; everything added later is foliage
    off = Vector((seed * 3.1, seed * 1.7, seed * 5.3))

    def clump(c, r, squash=(1, 1, 1), disp=0.28, sub=2):
        ret = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
        for v in ret['verts']:
            co = v.co.copy()
            n = noise.noise(co / r * 1.8 + off + c)
            co *= 1.0 + disp * n
            v.co = Vector((co.x * squash[0], co.y * squash[1], co.z * squash[2])) + c

    if kind in ('round', 'blossom', 'willow'):
        crown_r = height * 0.32
        cz = trunk_h + crown_r * 0.75
        for i in range(rng.randint(4, 6)):
            a = rng.random() * math.tau
            d = crown_r * rng.uniform(0.2, 0.55)
            c = Vector((math.cos(a) * d, math.sin(a) * d * 0.6, cz + rng.uniform(-0.3, 0.45) * crown_r))
            sq = (1, 1, 0.85) if kind != 'willow' else (1.05, 1, 1.25)
            clump(c, crown_r * rng.uniform(0.55, 0.8), sq)
        if kind == 'willow':
            for i in range(9):
                a = i / 9 * math.tau
                c = Vector((math.cos(a) * crown_r * 0.8, math.sin(a) * crown_r * 0.5, cz - crown_r * 0.6))
                clump(c, crown_r * 0.4, (0.55, 0.55, 1.6), disp=0.2, sub=1)
    elif kind == 'poplar':
        clump(Vector((0, 0, trunk_h + height * 0.4)), height * 0.16, (1, 1, 2.6), disp=0.18)
    elif kind == 'bush':
        for i in range(rng.randint(3, 5)):
            a = rng.random() * math.tau
            c = Vector((math.cos(a) * height * 0.3, math.sin(a) * height * 0.2, height * 0.35 + rng.uniform(-0.1, 0.15) * height))
            clump(c, height * rng.uniform(0.3, 0.45), (1.2, 1, 0.8))
    elif kind in ('conifer', 'pine'):
        tiers = 5 if kind == 'conifer' else 3
        base = trunk_h
        for t in range(tiers):
            f = t / tiers
            r = height * (0.28 if kind == 'conifer' else 0.22) * (1 - f * 0.75)
            h = height * (0.34 if kind == 'conifer' else 0.2)
            z = base + (height - base) * f * 0.82
            ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r, radius2=r * 0.08, depth=h, matrix=Matrix.Translation((0, 0, z + h / 2)))
            for v in ret['verts']:
                n = noise.noise(v.co * 0.3 + off)
                v.co.x *= 1 + 0.18 * n; v.co.y *= 1 + 0.18 * n
    elif kind == 'palm':
        top = trunk_h + height * 0.1
        for i in range(8):
            a = i / 8 * math.tau
            c = Vector((math.cos(a) * height * 0.22, math.sin(a) * height * 0.22, top - height * 0.06))
            clump(c, height * 0.2, (1.4, 0.35, 0.18), disp=0.1, sub=1)
    for f in bm.faces:
        is_trunk = f in trunk
        f.material_index = 0 if is_trunk else 1
        f.smooth = not is_trunk
    me = bpy.data.meshes.new(name)
    bm.normal_update(); bm.to_mesh(me); bm.free()
    me.materials.append(trunk_mat); me.materials.append(leaf_mat)
    obj = bpy.data.objects.new(name, me)
    return obj  # prototype: not linked; use instance()


def prop_proto(name, build, mats):
    """build(bm) fills a bmesh (face material indices set by build)."""
    bm = bmesh.new(); build(bm); bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    return bpy.data.objects.new(name, me)


def field_grid(period, cell_w, row_depth, y_start, y_end, seed=0.0):
    """Boundaries of shading.fields(): (row lines [(y)], cell lines [(x, y0, y1)])."""
    cells = int(round(period / cell_w)); cw = period / cells
    rows, verticals = [], []
    k = 0
    while y_start + k * row_depth < y_end:
        y0 = y_start + k * row_depth; y1 = min(y_end, y0 + row_depth)
        rows.append(y0)
        roff = ((k * 0.6180339 + seed * 0.1) % 1.0) * cw
        for j in range(cells + 1):
            x = (j * cw - roff) % period
            verticals.append((x, y0, y1))
        k += 1
    return rows, verticals


def hedge(coll, protos, hfn, points, spacing, rng, scale=(0.7, 1.2), gap=0.12, sink=0.6):
    """Bushes along a polyline on the terrain; `gap` is the chance of a break."""
    out = []
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        length = math.hypot(bx - ax, by - ay)
        n = max(1, int(length / spacing))
        for i in range(n):
            if rng.random() < gap: continue
            t = (i + rng.uniform(0.2, 0.8)) / n
            x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            out.append(instance(rng.choice(protos), coll, (x, y, hfn(x, y) - sink), scale=rng.uniform(*scale), rot_z=rng.uniform(0, 6.28)))
    return out


# ---------------------------------------------------------------- buildings

def house(coll, name, cx, cy, w, d, h, wall_mat, roof_mat, roof_h=None, roof='gable', trim_mat=None, chimney_mat=None, rng=None):
    """Walls + roof (+ chimney). Walls carry their own window grid material."""
    rng = rng or random.Random(1)
    objs = [box(name + '.walls', coll, wall_mat, cx, cy, 0.0, w, d, h)]
    rh = roof_h if roof_h is not None else min(w, d) * 0.45
    if roof == 'gable':
        objs.append(gable_roof(name + '.roof', coll, roof_mat, cx, cy, h, w, d, rh))
    elif roof == 'hip':
        objs.append(gable_roof(name + '.roof', coll, roof_mat, cx, cy, h, w, d, rh, hip=True))
    elif roof == 'gambrel':
        objs.append(gambrel_roof(name + '.roof', coll, roof_mat, cx, cy, h, w, d, rh))
    elif roof == 'flat':
        objs.append(box(name + '.parapet', coll, trim_mat or roof_mat, cx, cy, h, w + 1.0, d + 1.0, max(2.0, h * 0.04)))
    if chimney_mat is not None and roof in ('gable', 'hip'):
        objs.append(box(name + '.chimney', coll, chimney_mat, cx + w * rng.uniform(-0.3, 0.3), cy + d * 0.15, h, w * 0.08, w * 0.08, rh * 0.9))
    return objs


def island(name, coll, mat, cx, cy, rx, ry, hfn, rings=18, segs=64, rim=-2.0):
    """A polar-grid landmass (headland, island): z = hfn(x, y) inside the ellipse,
    sinking to `rim` at its edge, so no flat plane surrounds it."""
    bm = bmesh.new()
    centre = bm.verts.new((cx, cy, hfn(cx, cy)))
    prev = None
    for i in range(1, rings + 1):
        t = i / rings
        ring = []
        for k in range(segs):
            a = k / segs * math.tau
            x, y = cx + math.cos(a) * rx * t, cy + math.sin(a) * ry * t
            edge = (t ** 3)
            ring.append(bm.verts.new((x, y, hfn(x, y) * (1 - edge) + rim * edge)))
        if prev is None:
            for k in range(segs): bm.faces.new((centre, ring[k], ring[(k + 1) % segs]))
        else:
            for k in range(segs): bm.faces.new((prev[k], ring[k], ring[(k + 1) % segs], prev[(k + 1) % segs]))
        prev = ring
    bm.normal_update()
    return mesh_object(name, bm, coll, mat, smooth=True)
