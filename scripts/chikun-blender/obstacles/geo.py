"""bmesh geometry for the obstacle kits: seeded, reproducible, no bpy.ops.

Mesh(name) accumulates parts (each with a material slot) and becomes one
object. Everything is built in world units = logical pixels (see rig.py).
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise

_PASS = [0]


def link(obj, coll):
    _PASS[0] += 1
    obj.pass_index = (_PASS[0] * 7919) % 32749
    coll.objects.link(obj)
    return obj


class Mesh:
    def __init__(self, name, mats):
        self.name = name
        self.mats = list(mats)
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')

    def slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _tag(self, faces, mat, smooth):
        i = self.slot(mat)
        for f in faces:
            f.material_index = i
            f.smooth = smooth
        return faces

    def box(self, mat, center, size, bevel=0.0, segments=2, rot=None, smooth=False, taper=None):
        """Axis box of size (w, d, h) centred at `center` (optional rotation matrix)."""
        before = set(self.bm.faces)
        m = Matrix.Translation(center)
        if rot is not None:
            m = m @ rot.to_4x4()
        m = m @ Matrix.Diagonal((*size, 1.0))
        ret = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        verts = ret['verts']
        if taper is not None:
            # taper = (top_scale_x, top_scale_y): narrower top (jersey barrier, stacks)
            cz = center[2]
            for v in verts:
                if v.co.z > cz:
                    v.co.x = center[0] + (v.co.x - center[0]) * taper[0]
                    v.co.y = center[1] + (v.co.y - center[1]) * taper[1]
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=edges + list(verts), offset=bevel, segments=segments, affect='EDGES', profile=0.5, clamp_overlap=True)
        faces = [f for f in self.bm.faces if f not in before]
        self._box_uv(faces)
        return self._tag(faces, mat, smooth)

    def _box_uv(self, faces):
        for f in faces:
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            u_i, v_i = [(1, 2), (0, 2), (0, 1)][ax]
            for loop in f.loops:
                loop[self.uv].uv = (loop.vert.co[u_i] * 0.05, loop.vert.co[v_i] * 0.05)

    def cylinder(self, mat, a, b, r, r2=None, segs=16, cap=True, smooth=True, bevel=0.0):
        """Cylinder (or cone) from point a to point b."""
        before = set(self.bm.faces)
        a, b = Vector(a), Vector(b)
        d = b - a
        L = d.length
        rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        m = Matrix.Translation((a + b) / 2) @ rot
        ret = bmesh.ops.create_cone(self.bm, cap_ends=cap, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=L, matrix=m)
        if bevel > 0 and cap:
            rim = [e for e in {e for v in ret['verts'] for e in v.link_edges} if len(e.link_faces) == 2 and abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.5]
            if rim:
                bmesh.ops.bevel(self.bm, geom=rim, offset=bevel, segments=2, affect='EDGES', clamp_overlap=True)
        faces = [f for f in self.bm.faces if f not in before]
        for f in faces:
            for loop in f.loops:
                co = loop.vert.co - a
                ang = math.atan2(co.dot(rot.col[0].xyz), co.dot(rot.col[1].xyz))
                loop[self.uv].uv = (ang / math.tau, co.dot(d) / max(L, 1e-6))
        # flat caps, smooth sides
        for f in faces:
            f.smooth = smooth and abs(f.normal.dot(d.normalized())) < 0.7
            f.material_index = self.slot(mat)
        return faces

    def blob(self, mat, center, r, squash=(1, 1, 1), displace=0.25, freq=1.6, seed=0, subdiv=3, smooth=True, flatten_below=None):
        before = set(self.bm.faces)
        ret = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=1.0)
        off = Vector((seed * 13.37, seed * 7.13, seed * 3.31))
        c = Vector(center)
        for v in ret['verts']:
            co = v.co.copy()
            n = noise.noise(co * freq + off) + 0.5 * noise.noise(co * freq * 2.3 + off * 1.7)
            co *= r * (1.0 + displace * n)
            p = Vector((co.x * squash[0], co.y * squash[1], co.z * squash[2])) + c
            if flatten_below is not None and p.z < flatten_below:
                p.z = flatten_below + (p.z - flatten_below) * 0.15
            v.co = p
        faces = [f for f in self.bm.faces if f not in before]
        for f in faces:
            for loop in f.loops:
                loop[self.uv].uv = (loop.vert.co.x * 0.05, loop.vert.co.z * 0.05)
        return self._tag(faces, mat, smooth)

    def quad(self, mat, corners, uvs=((0, 0), (1, 0), (1, 1), (0, 1)), smooth=False):
        vs = [self.bm.verts.new(c) for c in corners]
        f = self.bm.faces.new(vs)
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        return self._tag([f], mat, smooth)

    def card(self, mat, center, w, h, normal, up=(0, 0, 1), twist=0.0):
        """A flat card (leaf, feather, straw) centred at `center` facing `normal`."""
        n = Vector(normal).normalized()
        u = Vector(up)
        side = u.cross(n)
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        upv = n.cross(side).normalized()
        if twist:
            q = Matrix.Rotation(twist, 3, n)
            side, upv = q @ side, q @ upv
        c = Vector(center)
        corners = [c - side * w / 2 - upv * h / 2, c + side * w / 2 - upv * h / 2, c + side * w / 2 + upv * h / 2, c - side * w / 2 + upv * h / 2]
        return self.quad(mat, corners)

    def prism(self, mat, profile, x0, x1, smooth=False):
        """Extrude a (y, z) profile polygon along x from x0 to x1."""
        before = set(self.bm.faces)
        left = [self.bm.verts.new((x0, y, z)) for y, z in profile]
        right = [self.bm.verts.new((x1, y, z)) for y, z in profile]
        n = len(profile)
        for i in range(n):
            j = (i + 1) % n
            self.bm.faces.new((left[i], left[j], right[j], right[i]))
        self.bm.faces.new(list(reversed(left)))
        self.bm.faces.new(right)
        faces = [f for f in self.bm.faces if f not in before]
        self._box_uv(faces)
        return self._tag(faces, mat, smooth)

    def tube(self, mat, points, radii, segs=8, smooth=True, cap=True):
        """A tube along a polyline with per-point radius (stems, vines, tails)."""
        before = set(self.bm.faces)
        pts = [Vector(p) for p in points]
        rings = []
        prev_side = None
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            ref = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
            side = t.cross(ref).normalized() if prev_side is None else (prev_side - t * prev_side.dot(t)).normalized()
            prev_side = side
            other = t.cross(side).normalized()
            r = radii[i] if isinstance(radii, (list, tuple)) else radii
            ring = []
            for k in range(segs):
                a = k / segs * math.tau
                ring.append(self.bm.verts.new(p + (side * math.cos(a) + other * math.sin(a)) * r))
            rings.append(ring)
        for i in range(len(rings) - 1):
            for k in range(segs):
                k2 = (k + 1) % segs
                self.bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
        if cap:
            self.bm.faces.new(list(reversed(rings[0])))
            self.bm.faces.new(rings[-1])
        faces = [f for f in self.bm.faces if f not in before]
        for f in faces:
            for loop in f.loops:
                loop[self.uv].uv = (loop.vert.co.x * 0.05, loop.vert.co.z * 0.05)
        return self._tag(faces, mat, smooth)

    def transform(self, faces, matrix):
        verts = {v for f in faces for v in f.verts}
        bmesh.ops.transform(self.bm, matrix=matrix, verts=list(verts))

    def done(self, coll, location=(0, 0, 0)):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        obj = bpy.data.objects.new(self.name, me)
        obj.location = location
        return link(obj, coll)


def scatter_on_blobs(rng, blobs, count, fn, inside_limit=0.92):
    """Call fn(point, normal) for `count` random points on the union of
    (center, radius, squash) ellipsoids, only where a point is not inside
    another ellipsoid (so leaf cards sit on the outer skin)."""
    def inside(p, skip):
        for j, (c, r, sq) in enumerate(blobs):
            if j == skip: continue
            d = Vector(((p.x - c[0]) / (r * sq[0]), (p.y - c[1]) / (r * sq[1]), (p.z - c[2]) / (r * sq[2])))
            if d.length < inside_limit: return True
        return False
    placed = 0
    tries = 0
    while placed < count and tries < count * 30:
        tries += 1
        j = rng.randrange(len(blobs))
        c, r, sq = blobs[j]
        u = rng.uniform(-1, 1); th = rng.uniform(0, math.tau); s = math.sqrt(1 - u * u)
        n = Vector((s * math.cos(th), s * math.sin(th), u))
        p = Vector(c) + Vector((n.x * r * sq[0], n.y * r * sq[1], n.z * r * sq[2])) * rng.uniform(0.9, 1.04)
        if inside(p, j): continue
        fn(p, Vector((n.x / sq[0], n.y / sq[1], n.z / sq[2])).normalized())
        placed += 1
    return placed
