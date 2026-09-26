"""Turn a Tripo rigged GLB into a repo-owned native enemy derivative (art wave 1).

Two stages, both projection-only. Nothing here touches collision, damage, AI,
spawning, RNG, progression or results; the derivative feeds the deterministic
native roster exporter exactly like the five shipped derivatives do.

  --stage source      raw Tripo rig GLB -> normalised source GLB
                      (bones renamed to the HMH semantic names by geometry,
                      rest facing -Y, feet on z=0, metres at targetHeight,
                      mesh decimated into the roster's vertex band, textures
                      capped at 2048 and packed). The output is the file that
                      gets committed under apps/hmh-reboot/assets/source/models/
                      through Git LFS and becomes the derivative's baseSource.
  --stage derivative  committed source GLB -> editable derivative .blend plus
                      source-receipt.json (phase accessories, the actor's
                      RoleLight accent material, six baked HMH_<actor>_<state>
                      actions retargeted from the procedural pose table, and
                      the per-actor render contract the exporter reads).

Run under Blender 5.1.2:
  blender --background --factory-startup --python scripts/hmh-blender/build-hmh-tripo-native-derivative.py -- \
      --stage source --actor the-liquidator --input <tripo rig .glb> --output .tmp/<dir>/the-liquidator.glb \
      --target-height 2.4 --target-faces 125000 --facing +X
  blender --background --factory-startup --python scripts/hmh-blender/build-hmh-tripo-native-derivative.py -- \
      --stage derivative --actor the-liquidator --source apps/hmh-reboot/assets/source/models/the-liquidator/the-liquidator.glb \
      --output .tmp/native-roster-final/the-liquidator
"""
import argparse, hashlib, importlib.util, json, math, sys
from pathlib import Path
import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hmh_enemy_poses as poses  # noqa: E402
from hmh_native_roster_poses import native_role_pose  # noqa: E402

TEXTURE_EDGE = 2048
SEMANTIC_BONES = ['root', 'hips', 'pelvis', 'chest', 'neck', 'head', 'upper_arm.L', 'forearm.L', 'hand.L',
                  'upper_arm.R', 'forearm.R', 'hand.R', 'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R']


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', required=True, choices=['source', 'derivative'])
    parser.add_argument('--actor', required=True)
    parser.add_argument('--input', help='source stage: raw Tripo rig GLB')
    parser.add_argument('--input-sha256', help='source stage: expected SHA-256 of the raw GLB')
    parser.add_argument('--source', help='derivative stage: committed normalised GLB (repo-relative)')
    parser.add_argument('--output', required=True)
    parser.add_argument('--target-height', type=float, default=2.4, help='source stage: metres, feet to crown')
    parser.add_argument('--target-faces', type=int, default=125000)
    parser.add_argument('--facing', default='+X', choices=['+X', '-X', '+Y', '-Y'], help='raw model forward axis in Blender space')
    parser.add_argument('--provenance', help='source stage: JSON with the Tripo task ids to embed')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def fresh_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path: Path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    rig = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if rig is None:
        raise ValueError('Tripo GLB carries no armature')
    # The glTF importer adds bone display shapes as real mesh objects; they
    # carry no weights and would render as giant spheres.
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
# Stage 1: geometry-driven semantic bone mapping
# --------------------------------------------------------------------------

def _forward_lateral(facing: str):
    axis = {'+X': Vector((1, 0, 0)), '-X': Vector((-1, 0, 0)), '+Y': Vector((0, 1, 0)), '-Y': Vector((0, -1, 0))}[facing]
    left = Vector((0, 0, 1)).cross(axis)  # up x forward = actor's left
    return axis, left


def classify_bones(rig, facing: str) -> dict:
    """Map Tripo's generic bone names onto the HMH semantic names by position."""
    arm = rig.data
    forward, left = _forward_lateral(facing)
    heads = {b.name: Vector(b.head_local) for b in arm.bones}
    tails = {b.name: Vector(b.tail_local) for b in arm.bones}
    children = {b.name: [c.name for c in b.children] for b in arm.bones}
    parent = {b.name: (b.parent.name if b.parent else None) for b in arm.bones}
    roots = [n for n, p in parent.items() if p is None]
    if len(roots) != 1:
        raise ValueError(f'expected one root bone, found {roots}')
    root = roots[0]

    def lateral(name):
        return heads[name].dot(left)

    def deepest_tail_z(name):
        z = tails[name].z
        for child in children[name]:
            z = min(z, deepest_tail_z(child))
        return z

    def chain_length(name):
        return 1 + max((chain_length(c) for c in children[name]), default=0)

    root_kids = children[root]
    if len(root_kids) < 2:
        raise ValueError('root must parent a spine base and a hips bone')
    # hips: the root child whose subtree reaches the floor; pelvis: the one that climbs.
    hips = min(root_kids, key=deepest_tail_z)
    pelvis = max(root_kids, key=lambda n: tails[n].z)
    if hips == pelvis:
        raise ValueError('could not separate hips from spine base')
    # spine chain: centre-line children climbing from the pelvis
    mapping = {root: 'root', hips: 'hips', pelvis: 'pelvis'}
    chain = [pelvis]
    current = pelvis
    while True:
        centre = [c for c in children[current] if abs(lateral(c)) < 0.06 * (tails[current].z - heads[hips].z + 1e-6) + 0.02 and tails[c].z > tails[current].z - 1e-6]
        if not centre:
            break
        current = max(centre, key=lambda n: tails[n].z)
        chain.append(current)
    if len(chain) < 3:
        raise ValueError(f'spine chain too short: {chain}')
    # chest = the last chain bone that owns lateral (arm) children
    chest = None
    for name in chain:
        if len([c for c in children[name] if abs(lateral(c)) > 0.03]) >= 2:
            chest = name
    if chest is None:
        raise ValueError('no chest bone with two arm chains')
    after = chain[chain.index(chest) + 1:]
    if len(after) < 1:
        raise ValueError('no head above the chest')
    head = after[-1]
    mapping[chest] = 'chest'
    mapping[head] = 'head'
    if len(after) >= 2:
        mapping[after[-2]] = 'neck'
    between = chain[1:chain.index(chest)]
    if between:
        mapping[between[0]] = 'spine'

    def limb(start, names):
        node = start
        for label in names:
            mapping[node] = label
            kids = children[node]
            if not kids:
                return
            node = max(kids, key=lambda n: (tails[n] - heads[n]).length)

    arms = [c for c in children[chest] if abs(lateral(c)) > 0.03]
    left_arms = sorted([c for c in arms if lateral(c) > 0], key=lateral, reverse=True)
    right_arms = sorted([c for c in arms if lateral(c) < 0], key=lateral)
    if not left_arms or not right_arms:
        raise ValueError('arm chains missing on one side')
    limb(left_arms[0], ['upper_arm.L', 'forearm.L', 'hand.L'])
    limb(right_arms[0], ['upper_arm.R', 'forearm.R', 'hand.R'])
    legs = [c for c in children[hips] if abs(lateral(c)) > 0.03 and chain_length(c) >= 3]
    legs = sorted(legs, key=deepest_tail_z)[:4]
    left_legs = [c for c in legs if lateral(c) > 0]
    right_legs = [c for c in legs if lateral(c) < 0]
    if not left_legs or not right_legs:
        raise ValueError('leg chains missing on one side')
    limb(min(left_legs, key=deepest_tail_z), ['thigh.L', 'shin.L', 'foot.L'])
    limb(min(right_legs, key=deepest_tail_z), ['thigh.R', 'shin.R', 'foot.R'])
    found = set(mapping.values())
    missing = [n for n in SEMANTIC_BONES if n not in found]
    if missing:
        raise ValueError(f'semantic bones unresolved: {missing}; mapping={mapping}')
    return mapping


def rename_bones(rig, mesh, mapping: dict):
    for old, new in mapping.items():
        if old == new:
            continue
        bone = rig.data.bones[old]
        bone.name = new
        group = mesh.vertex_groups.get(old)
        if group is not None:
            group.name = new
    for group in mesh.vertex_groups:
        if group.name not in rig.data.bones:
            raise ValueError(f'vertex group without a bone after rename: {group.name}')


def add_weapon_socket(rig, unit: float):
    if 'weapon_socket' in rig.data.bones:
        return
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    parent = rig.data.edit_bones['forearm.R']
    socket = rig.data.edit_bones.new('weapon_socket')
    socket.head = parent.tail.copy()
    socket.tail = parent.tail + Vector((0.0, -0.25 * unit, 0.0))  # points forward, like the shipped rigs
    socket.parent = parent
    socket.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.pose.bones['weapon_socket'].rotation_mode = 'XYZ'


def bake_transform(rig, mesh, matrix: Matrix):
    """Apply one armature-space matrix to bones and vertices, then reset objects."""
    bpy.context.view_layer.objects.active = rig
    bone_matrix = matrix @ rig.matrix_world
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in rig.data.edit_bones:
        bone.transform(bone_matrix, scale=True, roll=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    mesh_matrix = matrix @ mesh.matrix_world
    for vertex in mesh.data.vertices:
        vertex.co = mesh_matrix @ vertex.co
    mesh.data.update()
    rig.matrix_world = Matrix.Identity(4)
    mesh.matrix_parent_inverse = Matrix.Identity(4)
    mesh.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def mesh_bounds(mesh):
    matrix = mesh.matrix_world
    pts = [matrix @ v.co for v in mesh.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def decimate(mesh, target_faces: int):
    before = len(mesh.data.polygons)
    if before <= target_faces:
        return {'before': before, 'after': before, 'ratio': 1.0}
    ratio = target_faces / before
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    modifier = mesh.modifiers.new('Roster vertex band', 'DECIMATE')
    modifier.decimate_type = 'COLLAPSE'
    modifier.ratio = ratio
    bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return {'before': before, 'after': len(mesh.data.polygons), 'ratio': ratio}


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
    mapping = classify_bones(rig, args.facing)
    rename_bones(rig, mesh, mapping)
    # Rest facing -Y, feet on the ground, metres at the design height.
    forward, _ = _forward_lateral(args.facing)
    yaw = math.atan2(-1.0, 0.0) - math.atan2(forward.y, forward.x)
    lo, hi = mesh_bounds(mesh)
    raw_height = hi.z - lo.z
    scale = args.target_height / raw_height
    rotation = Matrix.Rotation(yaw, 4, 'Z')
    centre = rotation @ Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    fix = Matrix.Scale(scale, 4) @ Matrix.Translation(-centre) @ rotation
    bake_transform(rig, mesh, fix)
    lo, hi = mesh_bounds(mesh)
    unit = (hi.z - lo.z) / 1.75
    add_weapon_socket(rig, unit)
    decimation = decimate(mesh, args.target_faces)
    textures = cap_textures()
    mesh.name = f'{args.actor} Skinned Primary Body'
    rig.name = f'{args.actor} Source Rig'
    for obj in (rig, mesh):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True, export_apply=False,
                              export_skins=True, export_all_influences=True, export_animations=False,
                              export_yup=True, export_def_bones=False, export_rest_position_armature=True,
                              export_image_format='AUTO', export_image_quality=92, export_materials='EXPORT',
                              export_extras=True)
    provenance = json.loads(Path(args.provenance).read_text()) if args.provenance else {}
    report = {
        'schema': 1, 'stage': 'source', 'actorId': args.actor, 'runtimeAuthority': 'projection-only',
        'rawInput': {'sha256': raw_sha, 'bytes': raw.stat().st_size, 'facing': args.facing, **raw_counts},
        'tripo': provenance,
        'boneMapping': mapping, 'targetHeight': args.target_height, 'rawHeight': raw_height, 'scale': scale,
        'yawDegrees': math.degrees(yaw), 'decimation': decimation, 'textures': textures,
        'output': {'path': output.name, 'sha256': sha(output), 'bytes': output.stat().st_size,
                   'vertices': len(mesh.data.vertices), 'faces': len(mesh.data.polygons), 'bones': len(rig.data.bones)},
        'builderSha256': sha(Path(__file__)), 'blenderVersion': bpy.app.version_string,
    }
    (output.with_suffix('.source-provenance.json')).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({k: v for k, v in report.items() if k not in {'boneMapping', 'textures'}}), flush=True)


# --------------------------------------------------------------------------
# Stage 2: derivative .blend with accessories, accent material and baked actions
# --------------------------------------------------------------------------

def load_props_module():
    spec = importlib.util.spec_from_file_location('props', ROOT / 'scripts/hmh-blender/create-hmh-authored-props.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def linear(hex_color: str):
    rgb = tuple(int(hex_color.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1.0,)


def ring_radius_at(mesh, z: float, band: float, axis_x: float = 0.0, axis_y: float = 0.0) -> float:
    radii = [math.hypot(v.co.x - axis_x, v.co.y - axis_y) for v in mesh.data.vertices if abs(v.co.z - z) <= band]
    if not radii:
        raise ValueError(f'no vertices in the band around z={z}')
    return max(radii)


def half_width_at(mesh, z: float, band: float) -> float:
    xs = [abs(v.co.x) for v in mesh.data.vertices if abs(v.co.z - z) <= band]
    if not xs:
        raise ValueError(f'no vertices in the band around z={z}')
    return max(xs)


def stage_derivative(args):
    source = (ROOT / args.source).resolve()
    if not source.is_file():
        raise ValueError(f'committed source missing: {source}')
    source_sha = sha(source)
    output = Path(args.output).resolve()
    if not output.is_relative_to(ROOT / '.tmp') or output.exists():
        raise ValueError('Use a fresh private native model candidate under .tmp')
    output.mkdir(parents=True)
    roster = json.loads((ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json').read_text())
    actor = next(a for a in roster['actors'] if a['actorId'] == args.actor)
    props = load_props_module()
    fresh_scene()
    rig, body = import_glb(source)
    for bone in SEMANTIC_BONES + ['weapon_socket']:
        if bone not in rig.data.bones:
            raise ValueError(f'committed source lacks semantic bone {bone}')
    rig.name = f'{args.actor} Native Rig'
    body.name = f'{args.actor} Skinned Primary Body'
    body.hide_render = False
    body['hmh_actor_id'] = args.actor
    body['hmh_layer'] = 'body'
    body['hmh_native_body'] = True
    body['hmh_primary_skinned_body'] = True
    body['hmh_identity_form'] = actor['identityForm']
    body['hmh_runtime_authority'] = 'projection-only'
    body['hmh_source_sha256'] = source_sha
    for image in bpy.data.images:
        if image.type not in {'RENDER_RESULT', 'COMPOSITING'} and image.size[0]:
            if max(image.size) > TEXTURE_EDGE:
                raise ValueError(f'committed source texture over {TEXTURE_EDGE}: {image.name}')
            if not (image.packed_file or len(image.packed_files)):
                image.pack()
    height = rig.data.bones['head'].tail_local.z + .045
    unit = height / 1.75
    bpy.context.view_layer.update()

    # The accent is an LED band, so it is emission-led: under the hero rig's
    # 560 W key a lit #ff496c base clips to pink-white in AgX. The base is
    # dimmed by hmh_accent_base_scale (which the exporter's per-phase recolour
    # honours) and the colour comes from the emission instead.
    accent_base_scale = 0.18
    # Emission 0.7 keeps #ff496c inside AgX's saturated range; at 2.0 it drifted to pink-white.
    accent = props.material(args.actor + '_RoleLight', actor['palette']['accent'], metallic=0.0, emission=0.7, roughness=.60)
    accent['hmh_accent_base_scale'] = accent_base_scale
    node = accent.node_tree.nodes.get('Principled BSDF')
    node.inputs['Emission Color'].default_value = linear(actor['palette']['accent'])
    node.inputs['Base Color'].default_value = tuple(v * accent_base_scale for v in node.inputs['Emission Color'].default_value[:3]) + (1.0,)
    gold = props.material(args.actor + '_TarnishedGold', '#b08a3a', metallic=.85, roughness=.45)
    node = gold.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = linear('#b08a3a')

    def attach(obj, bone, phases=None):
        bpy.context.view_layer.update()
        matrix = obj.matrix_world.copy()
        obj.parent = rig
        obj.parent_type = 'BONE'
        obj.parent_bone = bone
        obj.matrix_world = matrix
        obj.hide_render = False
        obj['hmh_actor_id'] = args.actor
        obj['hmh_layer'] = 'body'
        obj['hmh_role_gear'] = True
        if phases:
            obj['hmh_visible_phases'] = ','.join(phases)
        return obj

    # Crown LED band: the phase accent ring the exporter recolours per phase.
    head = rig.data.bones['head']
    band_z = head.head_local.z + 0.86 * (head.tail_local.z - head.head_local.z)  # crown base, clear of the brow
    head_axis_x = (head.head_local.x + head.tail_local.x) / 2
    head_axis_y = (head.head_local.y + head.tail_local.y) / 2
    band_radius = ring_radius_at(body, band_z, 0.012 * unit, head_axis_x, head_axis_y) + 0.004 * unit
    attach(props.torus(args.actor + '_CrownBand', (head_axis_x, head_axis_y, band_z), band_radius, .009 * unit, accent, args.actor), 'head')
    # Margin spikes: gold cones standing on the epaulette plates from phase 2.
    chest = rig.data.bones['chest']
    shoulder_z = chest.tail_local.z + 0.02 * unit
    shoulder_half = half_width_at(body, shoulder_z, 0.03 * unit)
    for side in (-1, 1):
        for i in range(3):
            x = side * shoulder_half * (0.58 + 0.16 * i)
            obj = props.cone(f'{args.actor}_MarginSpike{side}{i}', (x, 0.0, shoulder_z + 0.10 * unit), .035 * unit, .22 * unit, gold, args.actor,
                             rotation=(0.0, side * 0.35, 0.0))
            attach(obj, 'chest', ['margin-call', 'total-liquidation'])
            tip = props.cone(f'{args.actor}_MarginSpikeTip{side}{i}', (x + side * 0.03 * unit, 0.0, shoulder_z + 0.19 * unit), .018 * unit, .10 * unit, accent, args.actor,
                             rotation=(0.0, side * 0.35, 0.0))
            attach(tip, 'chest', ['margin-call', 'total-liquidation'])
    # Total Liquidation halo: a ring of burning ticker tape above the cracked crown.
    halo = props.torus(args.actor + '_LiquidationHalo', (head_axis_x, head_axis_y, head.tail_local.z + 0.20 * unit), band_radius * 1.9, .022 * unit, accent, args.actor,
                       rotation=(0.0, 0.0, 0.0))
    attach(halo, 'head', ['total-liquidation'])
    # Sledgehammer gavel (4.3: "a tall T with a hammer"; it separates him from
    # the rifle-carrying Agent). Authored as rigid primitives on the weapon
    # socket, the casting doc's rule for simple mechanical props, so no Tripo
    # credit and no prop-scale guesswork. It rests head-up in the right fist
    # and swings with the forearm through the retargeted attack beat.
    steel = props.material(args.actor + '_GavelSteel', '#7d858c', metallic=.85, roughness=.38)
    steel.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = linear('#7d858c')
    grip = props.material(args.actor + '_GavelGrip', '#2b1d1a', roughness=.85)
    grip.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = linear('#2b1d1a')
    socket = rig.data.bones['weapon_socket']
    wrist = Vector(socket.head_local)
    lean = Matrix.Rotation(math.radians(-10.0), 3, 'Y')  # top of the handle leans away from the coat
    up = lean @ Vector((0.0, 0.0, 1.0))

    def along(distance):
        point = wrist + up * (distance * unit)
        return (point.x, point.y, point.z)

    tilt = (0.0, math.radians(-10.0), 0.0)
    attach(props.cylinder(args.actor + '_GavelHandle', along(0.19), .022 * unit, .62 * unit, steel, args.actor, rotation=tilt, vertices=16), 'weapon_socket')
    attach(props.cylinder(args.actor + '_GavelGrip', along(-0.01), .030 * unit, .22 * unit, grip, args.actor, rotation=tilt, vertices=16), 'weapon_socket')
    head_rotation = (0.0, math.radians(90.0 - 10.0), 0.0)  # head axis across the handle
    attach(props.cylinder(args.actor + '_GavelHead', along(0.50), .072 * unit, .30 * unit, steel, args.actor, rotation=head_rotation, vertices=24), 'weapon_socket')
    across = lean @ Vector((1.0, 0.0, 0.0))
    for sign in (-1, 1):
        cap = wrist + up * (0.50 * unit) + across * (sign * 0.165 * unit)
        attach(props.cylinder(f'{args.actor}_GavelCap{sign}', (cap.x, cap.y, cap.z), .080 * unit, .05 * unit, gold, args.actor, rotation=head_rotation, vertices=24), 'weapon_socket')
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj is not body:
            for polygon in obj.data.polygons:
                polygon.use_smooth = True

    # Retarget the authored role poses into each bone's own rest axes, exactly
    # as build-hmh-native-roster.py does for the Bagholder-based derivatives.
    profile = actor.get('animationProfile', {})
    bindings = {}
    source_counts = {'idle': 2, 'run': 24, 'tell': 2, 'attack': 3, 'hit': 2, 'death': 4}
    rotation_targets = {'pelvis': ['pelvis', 'hips'], 'prop_socket': ['weapon_socket']}
    location_targets = {'pelvis': ['root']}

    def apply_role(state, index, count):
        for b in rig.pose.bones:
            b.matrix_basis = Matrix.Identity(4)
        pose = native_role_pose(profile.get('kind', 'shared-roster-v1'), profile.get('damageResponse', 'shared-impact-v1'),
                                state, index, count, actor['build']['stoop'], boss=bool(actor.get('boss')))
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
                if target_name not in rig.pose.bones:
                    continue
                target = rig.data.bones[target_name].matrix_local.to_3x3().normalized()
                original = Matrix(poses.BONE_REST[name][2]).transposed()
                rig.pose.bones[target_name].location = target.inverted() @ original @ Vector(values) * unit

    for state, count in source_counts.items():
        action = bpy.data.actions.new('HMH_' + args.actor + '_' + state)
        rig.animation_data_create().action = action
        for index in range(count + (1 if state in {'idle', 'run'} else 0)):
            sample = index % count
            frame = 1 + 24 * index / (count if state in {'idle', 'run'} else count - 1)
            apply_role(state, sample, count)
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_euler', frame=frame, group=bone.name)
                bone.keyframe_insert('location', frame=frame, group=bone.name)
        action['hmh_state'] = state
        action['hmh_loop'] = state in {'idle', 'run'}
        action.use_fake_user = True
        bindings[state] = action.name
    rig.animation_data.action = bpy.data.actions[bindings['idle']]
    bpy.context.scene.frame_set(1)
    bpy.context.preferences.filepaths.save_version = 0
    target = output / (args.actor + '.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    receipt = {
        'schema': 1, 'status': 'editable-native-candidate', 'actorId': args.actor, 'identityForm': actor['identityForm'],
        'boss': bool(actor.get('boss')), 'phaseVisuals': actor.get('phaseVisuals', {}),
        'baseSource': source.relative_to(ROOT).as_posix(), 'baseSha256': source_sha, 'sourceUnchanged': sha(source) == source_sha,
        'baseSourceKind': 'tripo-rigged-glb-normalised', 'source': target.name, 'sourceSha256': sha(target), 'sourceBytes': target.stat().st_size,
        'armature': rig.name, 'bones': len(rig.data.bones), 'nativeBodyVertices': len(body.data.vertices),
        'costumeMeshes': 0, 'gearMeshes': sum(bool(o.get('hmh_role_gear')) for o in meshes),
        'clipActions': bindings, 'runtimeAuthority': 'projection-only', 'height': height, 'animationProfile': profile,
        'renderContract': actor.get('renderContract', {}),
        'builderSha256': sha(Path(__file__)),
        'poseAuthorSha256': sha(Path(__file__).parent / 'hmh_native_roster_poses.py'),
    }
    (output / 'source-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__':
    arguments = parse_args()
    if arguments.stage == 'source':
        stage_source(arguments)
    else:
        stage_derivative(arguments)
