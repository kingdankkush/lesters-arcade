"""Render the authored held weapons in one production hero's hands.

Runs inside the hero's packed source scene (opened read-only, never saved).
The weapon meshes are appended from the repository-owned held-weapon scene,
parented to the hero rig, skinned 1.0 to the pistol's own bone and placed with
the pistol's principal frame, so they take the exact camera, lights, colour
management, clip actions and hand gestures the shipped pistol frames take.

The reload and idle-check gestures are the same IK gestures
export-hmh-hero-motion.py bakes for the torso and native pistol; that file's
hash is pinned by the asset QA gate, so the gesture is repeated here verbatim
instead of being imported from it.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--hero-manifest', required=True)
    parser.add_argument('--actor', required=True)
    parser.add_argument('--weapons-blend', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--receipt', required=True)
    parser.add_argument('--weapons', default='')
    parser.add_argument('--directions', default='')
    parser.add_argument('--clips', default='')
    parser.add_argument('--max-frames', type=int, default=0, help='iteration aid: cap frames rendered per clip')
    return parser.parse_args(argv)


def load_hero_exporter():
    spec = importlib.util.spec_from_file_location('hero_exporter', ROOT / 'scripts/hmh-blender/export-hmh-production-hero-pilot.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def find_pistol(actor_id: str):
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.get('hmh_actor_id') != actor_id or obj.get('hmh_layer') != 'weapon':
            continue
        if obj.get('hmh_runtime_weapon_id') == 'coin-blaster' or obj.get('hmh_prop_role') == 'coin-blaster':
            return obj
    raise RuntimeError(f'No native coin-blaster mesh for {actor_id}')


def pistol_frame(rig, pistol, bone_name: str, anchor_about_mean) -> tuple[Matrix, dict]:
    """Canonical grip frame -> rig-local rest matrix, from the pistol's own mesh.

    Principal axes of the pistol vertices in weapon_socket rest space give the
    bore (forward), slide (up) and thickness directions; the grip anchor is a
    fixed offset from the vertex mean of the shared pistol mesh.
    """
    socket = rig.data.bones[bone_name]
    socket_rest = socket.matrix_local
    inv = socket_rest.inverted() @ pistol.matrix_basis
    count = len(pistol.data.vertices)
    co = np.empty(count * 3, dtype=np.float64)
    pistol.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    m = np.array(inv)
    pts = co @ m[:3, :3].T + m[:3, 3]
    mean = pts.mean(axis=0)
    centered = pts - mean
    def principal_axes(points):
        vals, vecs = np.linalg.eigh(points.T @ points / len(points))
        return vecs[:, np.argsort(vals)[::-1]].T

    def orient(axes):
        # At rest the pistol hangs muzzle-down (socket -Z) with its slide
        # facing forward (socket +Y); those signs make the frame unambiguous.
        forward = axes[0] if axes[0] @ np.array([0.0, 0.0, -1.0]) > 0 else -axes[0]
        up = axes[1] if axes[1] @ np.array([0.0, 1.0, 0.0]) > 0 else -axes[1]
        up = up - forward * (up @ forward)
        up /= np.linalg.norm(up)
        return forward, up

    forward, up = orient(principal_axes(centered))
    # The whole-body principal axis leans toward the grip mass, so the bore
    # would read a few degrees nose-up. Re-fit the forward axis on the slide
    # alone (the upper 40% of the pistol along the first estimate's up axis).
    heights = centered @ up
    slide = centered[heights > heights.min() + 0.6 * (heights.max() - heights.min())]
    slide_forward = principal_axes(slide - slide.mean(axis=0))[0]
    forward = slide_forward if slide_forward @ forward > 0 else -slide_forward
    up = up - forward * (up @ forward)
    up /= np.linalg.norm(up)
    left = np.cross(up, forward)
    rotation = np.stack([forward, left, up], axis=1)
    anchor = mean + rotation @ np.array(anchor_about_mean, dtype=np.float64)
    local = centered @ rotation
    extent = [local.min(axis=0).tolist(), local.max(axis=0).tolist()]
    anchor_index = pistol.get('hmh_grip_anchor_vertex')
    anchor_check = None
    if anchor_index is not None:
        vertex = local[int(anchor_index)]
        anchor_check = vertex.tolist()
        if abs(vertex[0] - anchor_about_mean[0]) > 0.02 or abs(vertex[2] - anchor_about_mean[2]) > 0.02:
            raise RuntimeError(f'Pistol grip anchor vertex {anchor_index} at {anchor_check} disagrees with the manifest anchor {anchor_about_mean}')
    frame_in_socket = Matrix.Identity(4)
    for row in range(3):
        for column in range(3):
            frame_in_socket[row][column] = float(rotation[row][column])
        frame_in_socket[row][3] = float(anchor[row])
    rig_local = socket_rest @ frame_in_socket
    report = {
        'pistolObject': pistol.name, 'vertexCount': count, 'socketBone': bone_name,
        'axesInSocket': {'forward': forward.tolist(), 'left': left.tolist(), 'up': up.tolist()},
        'anchorInSocket': anchor.tolist(), 'anchorAboutMean': list(anchor_about_mean), 'anchorVertex': anchor_index, 'anchorVertexAboutMean': anchor_check,
        'pistolExtentCanonical': extent, 'frameRigLocal': [list(row) for row in rig_local],
    }
    return rig_local, report


def append_weapons(weapons_blend: Path, weapon_ids: list[str]) -> dict:
    names = [f'HMH_HeldWeapon_{weapon_id}' for weapon_id in weapon_ids]
    with bpy.data.libraries.load(str(weapons_blend), link=False) as (data_from, data_to):
        missing = [name for name in names if name not in data_from.objects]
        if missing:
            raise RuntimeError(f'Held-weapon scene is missing {missing}')
        data_to.objects = names
    objects = {}
    for obj in data_to.objects:
        if obj is None:
            raise RuntimeError('Held-weapon append returned a null object')
        bpy.context.scene.collection.objects.link(obj)
        objects[obj['hmh_weapon_id']] = obj
    return objects


def skin_to_rig(obj, rig, frame: Matrix, bone_name: str) -> None:
    obj.parent = rig
    obj.parent_type = 'OBJECT'
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.matrix_basis = frame
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    modifier = obj.modifiers.new('HMH held weapon skin', 'ARMATURE')
    modifier.object = rig
    modifier.use_vertex_groups = True
    obj.hide_render = True


def project(scene, camera, point_world: Vector, size):
    view = world_to_camera_view(scene, camera, point_world)
    return [round(view.x * size[0], 3), round((1.0 - view.y) * size[1], 3)]


def main() -> None:
    args = blender_args()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding='utf-8'))
    hero_manifest = json.loads(Path(args.hero_manifest).resolve().read_text(encoding='utf-8'))
    pilot = next(p for p in hero_manifest['pilots'] if p['actorId'] == args.actor)
    exporter = load_hero_exporter()
    rig = exporter.resolve_rig(hero_manifest, pilot)
    bone_name = manifest['scene']['weaponBone']
    if bone_name not in rig.pose.bones or hero_manifest['scene']['weaponSocket'] not in rig.pose.bones:
        raise RuntimeError(f'{args.actor} rig lacks {bone_name} / weapon_socket')
    scene = bpy.context.scene
    camera = scene.camera
    if camera is None or camera.data.type != 'ORTHO':
        raise RuntimeError('Hero scene camera must be orthographic')
    hero_frame_size = tuple(pilot.get('frameSize', hero_manifest['render']['frameSize']))
    if hero_frame_size[0] != hero_frame_size[1]:
        raise RuntimeError(f'{args.actor} hero frame must be square: {hero_frame_size}')
    hero_frame = int(hero_frame_size[0])
    coverage = float(manifest['render']['coverage'])
    density = float(manifest['render']['pixelDensity'])
    size = round(hero_frame * coverage * density)
    frame_size = (size, size)
    hero_ortho = camera.data.ortho_scale
    camera.data.ortho_scale = hero_ortho * coverage
    scene.render.resolution_x, scene.render.resolution_y = frame_size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 20

    weapon_ids = [w['weaponId'] for w in manifest['weapons']]
    if args.weapons:
        chosen = args.weapons.split(',')
        unknown = [w for w in chosen if w not in weapon_ids]
        if unknown:
            raise RuntimeError(f'Unknown weapons {unknown}')
        weapon_ids = [w for w in weapon_ids if w in chosen]
    directions = hero_manifest['directions']
    if args.directions:
        directions = [d for d in directions if d in args.directions.split(',')]
    clips = manifest['clips']
    if args.clips:
        clips = {k: v for k, v in clips.items() if k in args.clips.split(',')}

    pistol = find_pistol(args.actor)
    frame, frame_report = pistol_frame(rig, pistol, bone_name, manifest['pistolGripAnchorAboutMean'])
    weapons = append_weapons(Path(args.weapons_blend).resolve(), weapon_ids)
    for obj in weapons.values():
        skin_to_rig(obj, rig, frame, bone_name)
    actor_objects = exporter.active_actor_objects(args.actor)
    for obj in bpy.data.objects:
        if obj.get('hmh_actor_id'):
            obj.hide_render = True

    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    for stale in output.glob('*.png'):
        stale.unlink()

    # Gesture controls, exactly as the hero motion exporter builds them.
    gesture_constraints = []
    hand_controls = {}
    for side in ('L', 'R'):
        target = bpy.data.objects.new(f'HMH_HeldWeaponWrist_{side}', None)
        scene.collection.objects.link(target)
        target.parent = rig
        target.rotation_mode = 'QUATERNION'
        ik = rig.pose.bones[f'forearm.{side}'].constraints.new('IK')
        ik.target = target
        ik.chain_count = 2
        ik.use_stretch = False
        ik.iterations = 64
        orient = rig.pose.bones[f'hand.{side}'].constraints.new('COPY_ROTATION')
        orient.target = target
        for constraint in (ik, orient):
            constraint.mute = True
            gesture_constraints.append(constraint)
        hand_controls[side] = target

    def reach_path(progress, points):
        for (start, a), (end, b) in zip(points, points[1:]):
            if progress <= end:
                t = max(0, min(1, (progress - start) / (end - start)))
                return a.lerp(b, t * t * (3 - 2 * t))
        return points[-1][1].copy()

    def rotate(name, x=0, y=0, z=0):
        bone = rig.pose.bones.get(name)
        if bone is None or bone.rotation_mode != 'XYZ':
            raise ValueError(f'Expected native Euler control {name}')
        bone.rotation_euler.x += math.radians(x)
        bone.rotation_euler.y += math.radians(y)
        bone.rotation_euler.z += math.radians(z)

    personality = {'lit-commando': .8, 'lit-valkyrie': 1.1, 'lester-original': 1.2, 'lilly': .95}[args.actor]
    bone_rest_inverse = rig.data.bones[bone_name].matrix_local.inverted()
    rig.rotation_euler.z = 0.0
    scene.frame_set(scene.frame_start)
    bpy.context.view_layer.update()
    origin_px = project(scene, camera, rig.matrix_world.translation, frame_size)

    def weapon_point(obj, canonical):
        rest = obj.matrix_basis @ Vector(canonical)
        posed = rig.pose.bones[bone_name].matrix @ bone_rest_inverse @ rest
        return rig.matrix_world @ posed

    frames = []
    calibration = []
    for state, clip in clips.items():
        native_state = clip['native']
        gesture = clip.get('gesture')
        action = exporter.set_clip_action(rig, pilot['clipActions'][native_state])
        for direction in directions:
            for index in range(min(clip['frames'], args.max_frames) if args.max_frames else clip['frames']):
                for constraint in gesture_constraints:
                    constraint.mute = True
                if gesture:
                    action = exporter.set_clip_action(rig, pilot['clipActions'][native_state])
                exporter.sample_clip_frame(action, index, clip['frames'], clip.get('loop', True))
                if gesture:
                    basis = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
                    rig.animation_data.action = None
                    for bone in rig.pose.bones:
                        bone.matrix_basis = basis[bone.name]
                rig.rotation_euler.z = math.radians(hero_manifest['directionAngles'][direction])
                progress = index / max(1, clip['frames'] - 1)
                if gesture == 'reload':
                    reach = math.sin(math.pi * progress) ** 2
                    rotate('chest', x=3 * reach)
                    rotate('head', x=8 * reach)
                    bpy.context.view_layer.update()
                    right = rig.pose.bones['hand.R'].matrix.copy()
                    left = rig.pose.bones['hand.L'].matrix.copy()
                    height = rig.pose.bones['head'].head.z
                    unit = height / 1.687
                    right_goal = right.translation + Vector((.20 * unit, .015 * unit, -.04 * unit))
                    hand_controls['R'].location = right.translation.lerp(right_goal, reach)
                    pouch = Vector((.24 * unit, -.025 * unit, height - .60 * unit))
                    magazine = right_goal + Vector((.075 * unit, .045 * unit, -.07 * unit))
                    hand_controls['L'].location = reach_path(progress, [
                        (0, left.translation), (.23, pouch), (.37, pouch),
                        (.57, magazine), (.70, magazine), (1, left.translation),
                    ])
                    for side, matrix in (('R', right), ('L', left)):
                        hand_controls[side].rotation_quaternion = matrix.to_quaternion()
                    for constraint in gesture_constraints:
                        constraint.mute = False
                elif gesture == 'idle-check':
                    scan = math.sin(2 * math.pi * progress) * math.sin(math.pi * progress)
                    breath = math.sin(math.pi * progress) ** 2
                    rotate('head', z=14 * scan * personality, x=-3 * breath)
                    rotate('chest', z=3 * scan)
                    rotate('upper_arm.L', x=4 * breath * personality)
                bpy.context.view_layer.update()
                if state == 'aim' and index == 0:
                    depsgraph = bpy.context.evaluated_depsgraph_get()
                    evaluated = pistol.evaluated_get(depsgraph)
                    matrix = evaluated.matrix_world
                    count = len(evaluated.data.vertices)
                    co = np.empty(count * 3, dtype=np.float64)
                    evaluated.data.vertices.foreach_get('co', co)
                    co = co.reshape(-1, 3)
                    m = np.array(matrix)
                    world = co @ m[:3, :3].T + m[:3, 3]
                    xs, ys = [], []
                    for vertex in world[::7]:
                        view = world_to_camera_view(scene, camera, Vector(vertex))
                        xs.append(view.x * frame_size[0])
                        ys.append((1.0 - view.y) * frame_size[1])
                    calibration.append({'direction': direction, 'nativePistolBox': [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)],
                                        'socket': project(scene, camera, rig.matrix_world @ rig.pose.bones[bone_name].matrix.translation, frame_size)})
                for weapon_id in weapon_ids:
                    obj = weapons[weapon_id]
                    for other in weapons.values():
                        other.hide_render = other is not obj
                    filename = f'{args.actor}__{weapon_id}__{state}__{direction}__{index:03d}.png'
                    scene.render.filepath = str(output / filename)
                    bpy.ops.render.render(write_still=True)
                    frames.append({
                        'id': filename[:-4], 'filename': filename, 'weaponId': weapon_id, 'state': state, 'direction': direction, 'frameIndex': index,
                        'fps': clip['fps'], 'loop': clip.get('loop', True),
                        'grip': project(scene, camera, weapon_point(obj, obj['hmh_grip']), frame_size),
                        'muzzle': project(scene, camera, weapon_point(obj, obj['hmh_muzzle']), frame_size),
                    })
                    obj.hide_render = True
    for obj in weapons.values():
        obj.hide_render = True
    receipt = {
        'status': 'pass', 'actorId': args.actor, 'source': pilot['sourceModel'], 'sourceSaved': False, 'runtimeAuthority': 'projection-only',
        'frameSize': list(frame_size), 'heroFrameSize': hero_frame, 'heroOrthoScale': hero_ortho, 'orthoScale': hero_ortho * coverage, 'originPixels': origin_px,
        'pistolFrame': frame_report, 'weapons': weapon_ids, 'directions': directions, 'clips': list(clips), 'frameCount': len(frames), 'frames': frames,
        'calibration': calibration, 'nativeActions': pilot['clipActions'], 'derivedGestures': ['reload', 'idle-check'],
    }
    receipt_path = Path(args.receipt).resolve()
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'pass', 'actorId': args.actor, 'frameCount': len(frames)}, sort_keys=True))


if __name__ == '__main__':
    main()
