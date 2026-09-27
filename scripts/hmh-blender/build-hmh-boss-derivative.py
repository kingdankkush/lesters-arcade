"""Build a dark district boss (art wave 2b) from a Tripo rig: source GLB, then the editable derivative.

The boss sibling of build-hmh-tripo-native-derivative.py (the Liquidator
pilot). It differs where a boss differs:

  --stage source      raw Tripo animate_rig GLB -> normalised source GLB. The
                      bone classifier accepts both Tripo biped topologies seen
                      so far (a separate hips bone, or legs parented straight
                      to the root, in which case a weightless `hips` bone is
                      inserted so the pelvis beat can carry the legs), maps
                      clavicles when the rig has them, rests the model facing
                      -Y with feet on z=0 at the design height, optionally
                      shortens the legs (`--leg-scale`, casting doc 2.8),
                      decimates, caps textures at 2048 and packs them.
  --stage derivative  committed source GLB -> editable .blend + receipt: the
                      boss's accessory kit (rigid props on bones, phase
                      dressings as accessory swaps tagged hmh_visible_phases),
                      emissive accent lamps located from the texture itself,
                      and one baked action per clip in hmh_boss_clips.

Run under Blender 5.1.2 (see docs/hmh-reboot/ART-WAVE-2B-20260926.md).
Projection-only: nothing here touches collision, damage, AI, spawning, RNG,
progression or results.
"""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hmh_enemy_poses as poses  # noqa: E402
import hmh_boss_clips as boss_clips  # noqa: E402

TEXTURE_EDGE = 2048
REQUIRED_BONES = ['root', 'hips', 'pelvis', 'chest', 'head', 'upper_arm.L', 'forearm.L', 'hand.L',
                  'upper_arm.R', 'forearm.R', 'hand.R', 'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R']
ROSTER = ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-boss-roster.json'


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', required=True, choices=['source', 'derivative'])
    parser.add_argument('--role', required=True, help='v7 boss role id, e.g. lockkeeper')
    parser.add_argument('--input')
    parser.add_argument('--input-sha256')
    parser.add_argument('--source')
    parser.add_argument('--output', required=True)
    parser.add_argument('--target-height', type=float)
    parser.add_argument('--target-faces', type=int, default=125000)
    parser.add_argument('--leg-scale', type=float, default=1.0)
    parser.add_argument('--facing', default='+X', choices=['+X', '-X', '+Y', '-Y'])
    parser.add_argument('--provenance')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def fresh_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path: Path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    rig = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if rig is None:
        raise ValueError('GLB carries no armature')
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and not obj.vertex_groups:
            bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if len(meshes) != 1:
        raise ValueError(f'expected exactly one skinned mesh, found {len(meshes)}')
    rig.rotation_mode = 'XYZ'
    for bone in rig.pose.bones:
        bone.rotation_mode = 'XYZ'
        bone.custom_shape = None
    bpy.context.view_layer.update()
    return rig, meshes[0]


# --------------------------------------------------------------------------
# Stage 1: bone classification, normalisation, optional leg shortening
# --------------------------------------------------------------------------

def _axes(facing):
    forward = {'+X': Vector((1, 0, 0)), '-X': Vector((-1, 0, 0)), '+Y': Vector((0, 1, 0)), '-Y': Vector((0, -1, 0))}[facing]
    return forward, Vector((0, 0, 1)).cross(forward)


def classify_bones(rig, facing):
    arm = rig.data
    _, left = _axes(facing)
    heads = {b.name: Vector(b.head_local) for b in arm.bones}
    tails = {b.name: Vector(b.tail_local) for b in arm.bones}
    children = {b.name: [c.name for c in b.children] for b in arm.bones}
    parent = {b.name: (b.parent.name if b.parent else None) for b in arm.bones}
    roots = [n for n, p in parent.items() if p is None]
    if len(roots) != 1:
        raise ValueError(f'expected one root bone, found {roots}')
    root = roots[0]
    height = max(t.z for t in tails.values()) - min(t.z for t in tails.values())
    lateral = lambda n: heads[n].dot(left)

    def subtree(n):
        out = [n]
        for c in children[n]:
            out += subtree(c)
        return out

    def lowest(n):
        return min(tails[m].z for m in subtree(n))

    def chain(start, count):
        out, node = [start], start
        while len(out) < count and children[node]:
            node = max(children[node], key=lambda c: (tails[c] - heads[c]).length * (1 + len(subtree(c))))
            out.append(node)
        return out

    floor = min(t.z for t in tails.values())
    # Legs: downward chains whose subtree reaches the floor, one per side.
    legs = [n for n in arm.bones.keys() if abs(lateral(n)) > 0.02 * height and heads[n].z < 0.6 * height
            and tails[n].z < heads[n].z and lowest(n) < floor + 0.04 * height and parent[n] is not None
            and not (tails[parent[n]].z < heads[parent[n]].z and abs(lateral(parent[n])) > 0.02 * height)]
    left_legs = sorted([n for n in legs if lateral(n) > 0], key=lambda n: -heads[n].z)
    right_legs = sorted([n for n in legs if lateral(n) < 0], key=lambda n: -heads[n].z)
    if not left_legs or not right_legs:
        raise ValueError(f'leg chains missing: {legs}')
    leg_l, leg_r = left_legs[0], right_legs[0]
    carrier = parent[leg_l]
    if parent[leg_r] != carrier:
        raise ValueError('legs hang from different bones')
    mapping = {root: 'root'}
    synthesise_hips = carrier == root
    if not synthesise_hips:
        mapping[carrier] = 'hips'
    climbing = [c for c in children[root] if c not in (leg_l, leg_r, carrier) and tails[c].z > heads[c].z]
    if not climbing:
        raise ValueError('no spine base above the root')
    pelvis = max(climbing, key=lambda n: len(subtree(n)))
    mapping[pelvis] = 'pelvis'
    spine = [pelvis]
    node = pelvis
    while True:
        centre = [c for c in children[node] if abs(lateral(c)) < 0.035 * height and tails[c].z > tails[node].z - 1e-6]
        if not centre:
            break
        node = max(centre, key=lambda n: len(subtree(n)))
        spine.append(node)
    chest = None
    for name in spine:
        if len([c for c in children[name] if abs(lateral(c)) > 0.02 * height]) >= 2:
            chest = name
    if chest is None:
        raise ValueError(f'no chest with two arm chains in {spine}')
    mapping[chest] = 'chest'
    after = spine[spine.index(chest) + 1:]
    if not after:
        raise ValueError('no head above the chest')
    mapping[after[0]] = 'head'
    between = spine[1:spine.index(chest)]
    if between:
        mapping[between[0]] = 'spine'
    arms = [c for c in children[chest] if abs(lateral(c)) > 0.02 * height]
    for side, pick in (('L', max), ('R', min)):
        start = pick([c for c in arms if (lateral(c) > 0) == (side == 'L')], key=lateral)
        bones = chain(start, 4)
        first = bones[0]
        vec = tails[first] - heads[first]
        # A mostly horizontal first bone is a clavicle; the arm starts below it.
        if len(bones) >= 4 and abs(vec.z) < 0.6 * vec.length:
            mapping[first] = f'shoulder.{side}'
            bones = bones[1:]
        for bone, label in zip(bones, ['upper_arm', 'forearm', 'hand']):
            mapping[bone] = f'{label}.{side}'
    for side, start in (('L', leg_l), ('R', leg_r)):
        for bone, label in zip(chain(start, 3), ['thigh', 'shin', 'foot']):
            mapping[bone] = f'{label}.{side}'
    found = set(mapping.values()) | ({'hips'} if synthesise_hips else set())
    missing = [n for n in REQUIRED_BONES if n not in found]
    if missing:
        raise ValueError(f'semantic bones unresolved: {missing}; mapping={mapping}')
    return mapping, synthesise_hips


def rename_bones(rig, mesh, mapping):
    for old, new in mapping.items():
        if old == new:
            continue
        rig.data.bones[old].name = new
        group = mesh.vertex_groups.get(old)
        if group is not None:
            group.name = new


def insert_hips(rig):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    bones = rig.data.edit_bones
    root = bones['root']
    hips = bones.new('hips')
    top = (bones['thigh.L'].head + bones['thigh.R'].head) / 2
    hips.head = Vector((top.x, top.y, top.z))
    hips.tail = hips.head + Vector((0, 0, 0.12 * (bones['pelvis'].tail - bones['pelvis'].head).length + 0.05))
    hips.parent = root
    for side in ('L', 'R'):
        bones[f'thigh.{side}'].parent = hips
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.pose.bones['hips'].rotation_mode = 'XYZ'


def add_weapon_socket(rig, unit):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    parent = rig.data.edit_bones['forearm.R']
    socket = rig.data.edit_bones.new('weapon_socket')
    socket.head = parent.tail.copy()
    socket.tail = parent.tail + Vector((0.0, -0.25 * unit, 0.0))
    socket.parent = parent
    socket.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.pose.bones['weapon_socket'].rotation_mode = 'XYZ'


def bake_transform(rig, mesh, fn):
    """Apply a point function to every bone end and vertex (armature space), then reset objects."""
    bpy.context.view_layer.objects.active = rig
    world = rig.matrix_world.copy()
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in rig.data.edit_bones:
        if isinstance(fn, Affine):
            bone.transform(fn.matrix @ world, scale=True, roll=True)
            continue
        head, tail = fn(world @ bone.head), fn(world @ bone.tail)
        roll = bone.roll
        bone.head, bone.tail = head, tail
        bone.roll = roll
    bpy.ops.object.mode_set(mode='OBJECT')
    matrix = mesh.matrix_world.copy()
    coords = np.empty(len(mesh.data.vertices) * 3, dtype=np.float64)
    mesh.data.vertices.foreach_get('co', coords)
    points = coords.reshape(-1, 3)
    rot, loc = np.array(matrix.to_3x3()), np.array(matrix.translation)
    points = points @ rot.T + loc
    points = fn.vectorised(points)
    mesh.data.vertices.foreach_set('co', points.reshape(-1))
    mesh.data.update()
    rig.matrix_world = Matrix.Identity(4)
    mesh.matrix_parent_inverse = Matrix.Identity(4)
    mesh.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


class Affine:
    def __init__(self, matrix: Matrix):
        self.matrix = matrix
        self.np = np.array(matrix)

    def __call__(self, v: Vector) -> Vector:
        return self.matrix @ v

    def vectorised(self, points):
        return points @ self.np[:3, :3].T + self.np[:3, 3]


class LegSquash:
    """z' = s*z below the hip line and z - (1-s)*h above it: shorter legs, same body."""

    def __init__(self, hip_z: float, scale: float):
        self.h, self.s = hip_z, scale

    def __call__(self, v: Vector) -> Vector:
        z = v.z * self.s if v.z < self.h else v.z - (1 - self.s) * self.h
        return Vector((v.x, v.y, z))

    def vectorised(self, points):
        out = points.copy()
        low = out[:, 2] < self.h
        out[low, 2] *= self.s
        out[~low, 2] -= (1 - self.s) * self.h
        return out


def mesh_bounds(mesh):
    coords = np.empty(len(mesh.data.vertices) * 3)
    mesh.data.vertices.foreach_get('co', coords)
    matrix = np.array(mesh.matrix_world)
    pts = coords.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
    return Vector(pts.min(0)), Vector(pts.max(0))


def decimate(mesh, target_faces):
    before = len(mesh.data.polygons)
    if before <= target_faces:
        return {'before': before, 'after': before, 'ratio': 1.0}
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    modifier = mesh.modifiers.new('Roster vertex band', 'DECIMATE')
    modifier.decimate_type = 'COLLAPSE'
    modifier.ratio = target_faces / before
    bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return {'before': before, 'after': len(mesh.data.polygons), 'ratio': target_faces / before}


def cap_textures():
    report = []
    for image in bpy.data.images:
        if image.type in {'RENDER_RESULT', 'COMPOSITING'} or not image.size[0]:
            continue
        original = list(image.size)
        if max(image.size) > TEXTURE_EDGE:
            factor = TEXTURE_EDGE / max(image.size)
            image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
        image.pack()
        report.append({'name': image.name, 'from': original, 'to': list(image.size), 'packed': bool(image.packed_file)})
    return report


def stage_source(args):
    raw = Path(args.input).resolve()
    raw_sha = sha(raw)
    if args.input_sha256 and raw_sha != args.input_sha256:
        raise ValueError('raw Tripo GLB identity mismatch')
    output = Path(args.output).resolve()
    if output.exists():
        raise ValueError(f'refusing to overwrite {output}')
    output.parent.mkdir(parents=True, exist_ok=True)
    fresh_scene()
    rig, mesh = import_glb(raw)
    raw_counts = {'vertices': len(mesh.data.vertices), 'faces': len(mesh.data.polygons), 'bones': len(rig.data.bones)}
    mapping, synth = classify_bones(rig, args.facing)
    rename_bones(rig, mesh, mapping)
    if synth:
        insert_hips(rig)
    forward, _ = _axes(args.facing)
    yaw = math.atan2(-1.0, 0.0) - math.atan2(forward.y, forward.x)
    lo, hi = mesh_bounds(mesh)
    rotation = Matrix.Rotation(yaw, 4, 'Z')
    centre = rotation @ Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    bake_transform(rig, mesh, Affine(Matrix.Scale(args.target_height / (hi.z - lo.z), 4) @ Matrix.Translation(-centre) @ rotation))
    squash = None
    if abs(args.leg_scale - 1.0) > 1e-6:
        hip_z = (rig.data.bones['thigh.L'].head_local.z + rig.data.bones['thigh.R'].head_local.z) / 2
        bake_transform(rig, mesh, LegSquash(hip_z, args.leg_scale))
        lo, hi = mesh_bounds(mesh)
        bake_transform(rig, mesh, Affine(Matrix.Scale(args.target_height / (hi.z - lo.z), 4)))
        squash = {'hipZ': hip_z, 'scale': args.leg_scale}
    lo, hi = mesh_bounds(mesh)
    add_weapon_socket(rig, (hi.z - lo.z) / 1.75)
    decimation = decimate(mesh, args.target_faces)
    textures = cap_textures()
    mesh.name = f'{args.role} Skinned Primary Body'
    rig.name = f'{args.role} Source Rig'
    for obj in (rig, mesh):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True, export_apply=False,
                              export_skins=True, export_all_influences=True, export_animations=False,
                              export_yup=True, export_def_bones=False, export_rest_position_armature=True,
                              export_image_format='AUTO', export_image_quality=92, export_materials='EXPORT',
                              export_extras=True)
    provenance = json.loads(Path(args.provenance).read_text()) if args.provenance else {}
    lo, hi = mesh_bounds(mesh)
    report = {
        'schema': 1, 'stage': 'source', 'roleId': args.role, 'runtimeAuthority': 'projection-only',
        'rawInput': {'sha256': raw_sha, 'bytes': raw.stat().st_size, 'facing': args.facing, **raw_counts},
        'tripo': provenance, 'boneMapping': mapping, 'hipsSynthesised': synth, 'targetHeight': args.target_height,
        'legSquash': squash, 'yawDegrees': math.degrees(yaw), 'decimation': decimation, 'textures': textures,
        'bounds': {'min': list(lo), 'max': list(hi)},
        'output': {'path': output.name, 'sha256': sha(output), 'bytes': output.stat().st_size,
                   'vertices': len(mesh.data.vertices), 'faces': len(mesh.data.polygons), 'bones': len(rig.data.bones)},
        'builderSha256': sha(Path(__file__)), 'blenderVersion': bpy.app.version_string,
    }
    output.with_name('source-provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({k: v for k, v in report.items() if k not in {'boneMapping', 'textures'}}), flush=True)


# --------------------------------------------------------------------------
# Stage 2: accessories, accent lamps and baked clip actions
# --------------------------------------------------------------------------

def linear(hex_color):
    rgb = tuple(int(hex_color.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1.0,)


def material(name, color, *, metallic=0.0, roughness=0.7, emission=0.0, base_scale=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    value = linear(color)
    node.inputs['Base Color'].default_value = tuple(v * base_scale for v in value[:3]) + (1.0,)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    if emission:
        node.inputs['Emission Color'].default_value = value
        node.inputs['Emission Strength'].default_value = emission
    mat['hmh_accent_base_scale'] = base_scale
    return mat


def _primitive(op, name, location, rotation, mat, **kwargs):
    op(location=location, rotation=rotation, **kwargs)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def cylinder(name, a, b, radius, mat, vertices=16):
    a, b = Vector(a), Vector(b)
    axis = b - a
    rot = axis.to_track_quat('Z', 'Y').to_euler()
    return _primitive(bpy.ops.mesh.primitive_cylinder_add, name, (a + b) / 2, rot, mat, radius=radius, depth=axis.length, vertices=vertices)


def box(name, centre, size, mat, rotation=(0, 0, 0)):
    obj = _primitive(bpy.ops.mesh.primitive_cube_add, name, centre, rotation, mat, size=1.0)
    obj.scale = size
    return obj


def sphere(name, centre, radius, mat, segments=16):
    return _primitive(bpy.ops.mesh.primitive_uv_sphere_add, name, centre, (0, 0, 0), mat, radius=radius, segments=segments, ring_count=segments // 2)


def cone(name, a, b, radius, mat, radius2=0.0, vertices=12):
    a, b = Vector(a), Vector(b)
    axis = b - a
    rot = axis.to_track_quat('Z', 'Y').to_euler()
    return _primitive(bpy.ops.mesh.primitive_cone_add, name, (a + b) / 2, rot, mat, radius1=radius, radius2=radius2, depth=axis.length, vertices=vertices)


def texture_colours(body):
    """Per-vertex albedo sampled from the base-colour texture (first UV)."""
    image = None
    for slot in body.material_slots:
        for node in slot.material.node_tree.nodes if slot.material and slot.material.node_tree else []:
            if node.type == 'TEX_IMAGE' and node.image and 'Color' in node.image.name:
                image = node.image
    if image is None:
        raise ValueError('no base-colour texture on the body')
    w, h = image.size
    pixels = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(h, w, 4)
    mesh = body.data
    uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    loop_vertex = np.empty(len(mesh.loops), dtype=np.int64)
    mesh.loops.foreach_get('vertex_index', loop_vertex)
    px = np.clip((uv[:, 0] % 1.0) * w, 0, w - 1).astype(np.int64)
    py = np.clip((uv[:, 1] % 1.0) * h, 0, h - 1).astype(np.int64)
    colours = np.zeros((len(mesh.vertices), 3), dtype=np.float32)
    colours[loop_vertex] = pixels[py, px, :3]
    coords = np.empty(len(mesh.vertices) * 3)
    mesh.vertices.foreach_get('co', coords)
    return colours, coords.reshape(-1, 3)


def hsv(colours):
    # Byte sRGB textures expose their stored (display-encoded) values.
    c = np.clip(colours, 0.0, 1.0)
    mx, mn = c.max(1), c.min(1)
    delta = mx - mn
    s = np.where(mx > 0, delta / np.maximum(mx, 1e-6), 0)
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    hue = np.zeros_like(mx)
    safe = np.maximum(delta, 1e-6)
    hue = np.where(mx == r, ((g - b) / safe) % 6, hue)
    hue = np.where(mx == g, (b - r) / safe + 2, hue)
    hue = np.where(mx == b, (r - g) / safe + 4, hue)
    return hue * 60, s, mx


def clusters(points, radius):
    """Deterministic grid clustering: cells of `radius`, 26-connected components."""
    if not len(points):
        return []
    cells = {}
    keys = np.floor(points / radius).astype(np.int64)
    for index, key in enumerate(map(tuple, keys)):
        cells.setdefault(key, []).append(index)
    seen, groups = set(), []
    for key in sorted(cells):
        if key in seen:
            continue
        stack, members = [key], []
        seen.add(key)
        while stack:
            cell = stack.pop()
            members += cells[cell]
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for dz in (-1, 0, 1):
                        other = (cell[0] + dx, cell[1] + dy, cell[2] + dz)
                        if other in cells and other not in seen:
                            seen.add(other)
                            stack.append(other)
        groups.append(sorted(members))
    return groups


def nearest_bone(rig, point):
    best, best_d = None, 1e9
    for bone in rig.data.bones:
        a, b = Vector(bone.head_local), Vector(bone.tail_local)
        ab = b - a
        t = max(0.0, min(1.0, (Vector(point) - a).dot(ab) / max(ab.length_squared, 1e-9)))
        d = (Vector(point) - (a + ab * t)).length
        if bone.name not in {'root', 'hips', 'weapon_socket'} and d < best_d:
            best, best_d = bone.name, d
    return best


def build_lockkeeper(rig, body, unit, role, mats, report):
    height = unit * 1.75
    colours, coords = texture_colours(body)
    hue, sat, val = hsv(colours)
    # Six padlock signal lamps: the retinted #ff476f discs on the bandolier.
    lamp = ((hue > 330) | (hue < 8)) & (sat > 0.3) & (val > 0.8) & (coords[:, 2] > 0.40 * height) & (coords[:, 2] < 0.75 * height) & (coords[:, 1] < 0)
    points = coords[lamp]
    groups = [g for g in clusters(points, 0.009 * height) if len(g) >= 3] if len(points) else []
    groups = sorted(groups, key=len, reverse=True)[:6]
    lamps = []
    for index, group in enumerate(sorted(groups, key=lambda g: points[g].mean(0)[0])):
        centre = Vector(points[group].mean(0))
        offset = Vector((0, -0.012 * height, 0))
        obj = sphere(f'{role}_PadlockLamp{index}', centre + offset, 0.010 * height, mats['accent'])
        lamps.append((obj, nearest_bone(rig, centre)))
    report['padlockLamps'] = len(lamps)
    # The windlass key (casting 2.8: a Blender primitive build): a cast-iron
    # shaft as tall as he is, gripped in the right fist and standing upright,
    # the L crank at the top so the key reads as the L of "a barrel with an L".
    # Built in the idle pose (frame 0) so the key stands upright in the fist
    # the way he carries it, not at the A-pose arm angle.
    mats['pose'](boss_clips.boss_pose(role, 'idle', 0))
    bpy.context.view_layer.update()
    hand = rig.pose.bones['hand.R']
    grip = (rig.matrix_world @ hand.head).lerp(rig.matrix_world @ hand.tail, 0.6)
    bottom = Vector((grip.x, grip.y, 0.06 * height))
    top = Vector((grip.x, grip.y, height * 1.02))
    iron = mats['iron']
    parts = [cylinder(f'{role}_KeyShaft', bottom, top, 0.024 * height, iron),
             box(f'{role}_KeySocket', bottom + Vector((0, 0, 0.03 * height)), (0.06 * height, 0.06 * height, 0.08 * height), iron)]
    crank_end = top + Vector((0.26 * height * (1 if grip.x > 0 else -1), 0, 0))
    parts.append(cylinder(f'{role}_KeyCrank', top, crank_end, 0.021 * height, iron))
    parts.append(cylinder(f'{role}_KeyHandle', crank_end, crank_end + Vector((0, 0, -0.12 * height)), 0.028 * height, mats['brass']))
    parts.append(sphere(f'{role}_KeyKnuckle', top, 0.034 * height, iron))
    for obj in parts:
        attach(rig, obj, 'weapon_socket', role)
    # Phase 3 dressing: a snapped length of chain coiled round the key shaft.
    for i in range(5):
        z = grip.z + (0.30 + 0.05 * i) * height
        ring = _primitive(bpy.ops.mesh.primitive_torus_add, f'{role}_SnappedChain{i}', (grip.x, grip.y, z),
                          (math.radians(90 * (i % 2)), 0, math.radians(35 * i)), mats['rust'],
                          major_radius=0.030 * height, minor_radius=0.007 * height)
        attach(rig, ring, 'weapon_socket', role, ['spillway'])
    for b in rig.pose.bones:
        b.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    for obj, bone in lamps:
        attach(rig, obj, bone, role)
    return report


def build_foreman(rig, body, unit, role, mats, report):
    height = unit * 1.75
    colours, coords = texture_colours(body)
    hue, sat, val = hsv(colours)
    head = rig.data.bones['head']
    head_z = Vector(head.head_local).z
    # Headlamp: the brightest amber cluster on the front of the hat.
    amber = (hue > 18) & (hue < 40) & (sat > 0.4) & (val > 0.8) & (coords[:, 2] > head_z) & (coords[:, 1] < Vector(head.head_local).y)
    points = coords[amber]
    bright = val[amber]
    candidates = [g for g in clusters(points, 0.02 * height) if len(g) >= 5] if len(points) else []
    report['headlampCandidates'] = len(candidates)
    if candidates:
        group = max(candidates, key=len)
        lamp_centre = Vector(points[group].mean(0))
        front = Vector(points[group][np.argmin(points[group][:, 1])])
        lamp_centre.y = min(lamp_centre.y, front.y)
        report['headlampFrom'] = 'texture'
    else:
        lamp_centre = Vector(head.tail_local) + Vector((0, -0.09 * height, 0.02 * height))
        report['headlampFrom'] = 'head-bone-fallback'
    lens = cylinder(f'{role}_HeadlampLens', lamp_centre + Vector((0, 0.004 * height, 0)), lamp_centre + Vector((0, -0.010 * height, 0)),
                    0.030 * height, mats['accent'], vertices=24)
    attach(rig, lens, 'head', role)
    # Tank top: the highest body point behind the head (the gauge).
    back = coords[(coords[:, 1] > Vector(head.head_local).y + 0.05 * height)]
    tank_top = Vector(back[np.argmax(back[:, 2])]) if len(back) else Vector((0, 0.18 * height, 0.95 * height))
    chest_bone = 'chest'
    # Phase 2 dressing: the gauge glows and steam leaks from the valve.
    gauge = sphere(f'{role}_GaugeGlow', tank_top + Vector((0, 0, -0.01 * height)), 0.028 * height, mats['gauge'])
    attach(rig, gauge, chest_bone, role, ['hashrate-surge', 'majority-rule'])
    for i, (dx, dz, r) in enumerate([(0.00, 0.04, 0.026), (0.02, 0.08, 0.034), (-0.015, 0.13, 0.042)]):
        puff = sphere(f'{role}_SteamLeak{i}', tank_top + Vector((dx * height, 0.01 * height, dz * height)), r * height, mats['steam'])
        attach(rig, puff, chest_bone, role, ['hashrate-surge'])
    # Phase 3 dressing: the tank top ruptured and peeled open, a permanent plume.
    hole = cylinder(f'{role}_RuptureHole', tank_top + Vector((0, 0, -0.03 * height)), tank_top + Vector((0, 0, -0.022 * height)),
                    0.05 * height, mats['soot'], vertices=20)
    attach(rig, hole, chest_bone, role, ['majority-rule'])
    for i in range(6):
        angle = 2 * math.pi * i / 6 + 0.3
        base = tank_top + Vector((math.cos(angle) * 0.045 * height, math.sin(angle) * 0.045 * height, -0.03 * height))
        tip = base + Vector((math.cos(angle) * 0.07 * height, math.sin(angle) * 0.07 * height, 0.05 * height))
        petal = cone(f'{role}_RupturePetal{i}', base, tip, 0.026 * height, mats['brass'], vertices=4)
        attach(rig, petal, chest_bone, role, ['majority-rule'])
    for i in range(3):
        puff = sphere(f'{role}_Plume{i}', tank_top + Vector((0.012 * height * (i % 2), 0.03 * height * (i + 1), (0.05 + 0.05 * i) * height)),
                      (0.022 + 0.008 * i) * height, mats['steam'])
        attach(rig, puff, chest_bone, role, ['majority-rule'])
    # Phase 3: the cracked hat (a dark split across the crown).
    crown = Vector(head.tail_local) + Vector((0, -0.01 * height, 0.035 * height))
    crack = box(f'{role}_HatCrack', crown, (0.006 * height, 0.11 * height, 0.012 * height), mats['soot'], rotation=(0.2, 0, 0.5))
    attach(rig, crack, 'head', role, ['majority-rule'])
    report['tankTop'] = list(tank_top)
    report['headlamp'] = list(lamp_centre)
    return report


def attach(rig, obj, bone, role, phases=None):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    obj.matrix_world = matrix
    obj.hide_render = False
    obj['hmh_actor_id'] = role
    obj['hmh_layer'] = 'body'
    obj['hmh_role_gear'] = True
    if phases:
        obj['hmh_visible_phases'] = ','.join(phases)
    return obj


def stage_derivative(args):
    source = (ROOT / args.source).resolve()
    if not source.is_file():
        raise ValueError(f'committed source missing: {source}')
    source_sha = sha(source)
    output = Path(args.output).resolve()
    if not output.is_relative_to(ROOT / '.tmp') or output.exists():
        raise ValueError('Use a fresh private boss candidate under .tmp')
    output.mkdir(parents=True)
    roster = json.loads(ROSTER.read_text())
    entry = next(a for a in roster['bosses'] if a['roleId'] == args.role)
    table = boss_clips.BOSS_CLIPS[args.role]
    fresh_scene()
    rig, body = import_glb(source)
    for bone in REQUIRED_BONES + ['weapon_socket']:
        if bone not in rig.data.bones:
            raise ValueError(f'committed source lacks semantic bone {bone}')
    rig.name = f'{args.role} Boss Rig'
    body.name = f'{args.role} Skinned Primary Body'
    body['hmh_native_body'] = True
    body['hmh_primary_skinned_body'] = True
    body['hmh_identity_form'] = entry['identityForm']
    body['hmh_runtime_authority'] = 'projection-only'
    body['hmh_source_sha256'] = source_sha
    for image in bpy.data.images:
        if image.type not in {'RENDER_RESULT', 'COMPOSITING'} and image.size[0]:
            if max(image.size) > TEXTURE_EDGE:
                raise ValueError(f'committed source texture over {TEXTURE_EDGE}: {image.name}')
            if not (image.packed_file or len(image.packed_files)):
                image.pack()
    lo, hi = mesh_bounds(body)
    height = hi.z - lo.z
    unit = height / 1.75
    accent = entry['phaseVisuals'][table['phases'][0]]['accent']
    mats = {
        'accent': material(args.role + '_RoleLight', accent, emission=1.0, roughness=0.4, base_scale=0.2),
        'iron': material(args.role + '_CastIron', '#3a3d40', metallic=0.8, roughness=0.55),
        'brass': material(args.role + '_Brass', '#9c7a3c', metallic=0.85, roughness=0.42),
        'rust': material(args.role + '_Rust', '#6a3a22', metallic=0.5, roughness=0.8),
        'soot': material(args.role + '_Soot', '#141212', roughness=0.9),
        'steam': material(args.role + '_Steam', '#a4aab0', roughness=0.95),
        'gauge': material(args.role + '_GaugeGlow', '#f0ae4c', emission=1.2, roughness=0.4, base_scale=0.3),
    }
    # Retarget each sampled clip pose into this rig's rest axes.
    rotation_targets = {'pelvis': ['pelvis', 'hips'], 'prop_socket': ['weapon_socket']}
    location_targets = {'pelvis': ['root']}

    def apply(pose):
        for b in rig.pose.bones:
            b.matrix_basis = Matrix.Identity(4)
        for name, values in pose['rotations'].items():
            for target_name in rotation_targets.get(name, [name]):
                if target_name not in rig.pose.bones:
                    continue
                target = rig.data.bones[target_name].matrix_local.to_3x3().normalized()
                original = Matrix(poses.BONE_REST[name][2]).transposed()
                delta = Euler(tuple(math.radians(v) for v in values), 'XYZ').to_matrix()
                rig.pose.bones[target_name].rotation_euler = (target.inverted() @ original @ delta @ original.inverted() @ target).to_euler('XYZ')
        for name, values in pose['locations'].items():
            for target_name in location_targets.get(name, [name]):
                target = rig.data.bones[target_name].matrix_local.to_3x3().normalized()
                original = Matrix(poses.BONE_REST[name][2]).transposed()
                rig.pose.bones[target_name].location = target.inverted() @ original @ Vector(values) * unit

    report = {}
    mats['pose'] = apply
    {'lockkeeper': build_lockkeeper, 'fifty-one-percent-foreman': build_foreman}[args.role](rig, body, unit, args.role, mats, report)
    bpy.context.view_layer.update()

    bindings = {}
    rig.animation_data_create()
    for clip_id, clip in table['clips'].items():
        action = bpy.data.actions.new(f'HMH_{args.role}_{clip_id}')
        rig.animation_data.action = action
        for index in range(clip['frames']):
            apply(boss_clips.boss_pose(args.role, clip_id, index))
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_euler', frame=1 + index, group=bone.name)
                bone.keyframe_insert('location', frame=1 + index, group=bone.name)
        for fcurve in getattr(action, 'fcurves', []):
            for key in fcurve.keyframe_points:
                key.interpolation = 'CONSTANT'
        action['hmh_clip'] = clip_id
        action['hmh_loop'] = clip['loop']
        action.use_fake_user = True
        bindings[clip_id] = action.name
    rig.animation_data.action = bpy.data.actions[bindings['idle']]
    bpy.context.scene.frame_set(1)
    bpy.context.preferences.filepaths.save_version = 0
    target = output / f'{args.role}.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    receipt = {
        'schema': 1, 'status': 'editable-boss-candidate', 'roleId': args.role, 'actorId': table['actorId'],
        'identityForm': entry['identityForm'], 'boss': True, 'phaseVisuals': entry['phaseVisuals'],
        'baseSource': source.relative_to(ROOT).as_posix(), 'baseSha256': source_sha, 'sourceUnchanged': sha(source) == source_sha,
        'source': target.name, 'sourceSha256': sha(target), 'sourceBytes': target.stat().st_size,
        'armature': rig.name, 'bones': len(rig.data.bones), 'nativeBodyVertices': len(body.data.vertices),
        'gearMeshes': sum(bool(o.get('hmh_role_gear')) for o in meshes), 'accessoryReport': report,
        'clipActions': bindings, 'clipManifest': boss_clips.clip_manifest(args.role), 'height': height,
        'renderContract': entry['renderContract'], 'runtimeAuthority': 'projection-only',
        'builderSha256': sha(Path(__file__)), 'clipLibrarySha256': sha(Path(__file__).parent / 'hmh_boss_clips.py'),
        'blenderVersion': bpy.app.version_string,
    }
    (output / 'source-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({k: receipt[k] for k in ('roleId', 'sourceSha256', 'bones', 'nativeBodyVertices', 'gearMeshes', 'accessoryReport', 'height')}), flush=True)


if __name__ == '__main__':
    arguments = parse_args()
    if arguments.stage == 'source':
        stage_source(arguments)
    else:
        stage_derivative(arguments)
