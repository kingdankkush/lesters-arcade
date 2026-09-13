"""Bake denser locomotion, breathing, inspection and reload gestures from native rigs."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--manifest', required=True)
parser.add_argument('--actor', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
manifest = json.loads(Path(args.manifest).read_text())
pilot = next(p for p in manifest['pilots'] if p['actorId'] == args.actor)
spec = importlib.util.spec_from_file_location('exporter', ROOT / 'scripts/hmh-blender/export-hmh-production-hero-pilot.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
rig = exporter.resolve_rig(manifest, pilot)
scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y = pilot['frameSize']
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.image_settings.compression = 20
scene.render.film_transparent = True
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
objects = exporter.active_actor_objects(args.actor)
gesture_constraints = []
hand_controls = {}
for side in ('L', 'R'):
    target = bpy.data.objects.new(f'HMH_MotionWrist_{side}', None)
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
            t = max(0, min(1, (progress-start)/(end-start)))
            return a.lerp(b, t*t*(3-2*t))
    return points[-1][1].copy()

def rotate(name, x=0, y=0, z=0):
    bone = rig.pose.bones.get(name)
    if bone is None or bone.rotation_mode != 'XYZ':
        raise ValueError(f'Expected native Euler control {name}')
    bone.rotation_euler.x += math.radians(x)
    bone.rotation_euler.y += math.radians(y)
    bone.rotation_euler.z += math.radians(z)

frames = []
control_samples = []
for layer, clips in pilot['clips'].items():
    for state, clip in clips.items():
        native_state = 'aim' if state in ('reload', 'idle-check') else state
        action = exporter.set_clip_action(rig, pilot['clipActions'][native_state])
        for direction in manifest['directions']:
            for index in range(clip['frames']):
                for constraint in gesture_constraints:
                    constraint.mute = True
                if state in ('reload', 'idle-check'):
                    # Rendering evaluates the active action again. Preserve its
                    # sampled pose, then detach it before adding the gesture so
                    # that the source aim curves cannot overwrite the new pose.
                    action = exporter.set_clip_action(rig, pilot['clipActions'][native_state])
                exporter.sample_clip_frame(action, index, clip['frames'], clip.get('loop', True))
                if state in ('reload', 'idle-check'):
                    basis = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
                    rig.animation_data.action = None
                    for bone in rig.pose.bones:
                        bone.matrix_basis = basis[bone.name]
                rig.rotation_euler.z = math.radians(manifest['directionAngles'][direction])
                progress = index / max(1, clip['frames'] - 1)
                if state == 'reload':
                    reach = math.sin(math.pi * progress) ** 2
                    rotate('chest', x=3 * reach)
                    rotate('head', x=8 * reach)
                    bpy.context.view_layer.update()
                    right = rig.pose.bones['hand.R'].matrix.copy()
                    left = rig.pose.bones['hand.L'].matrix.copy()
                    height = rig.pose.bones['head'].head.z
                    unit = height / 1.687
                    # Bring the pistol inward, reach to the belt pouch, seat
                    # the magazine under the grip, then recover to the exact
                    # authored aim pose. IK keeps elbows attached to the body.
                    right_goal = right.translation + Vector((.20*unit, .015*unit, -.04*unit))
                    hand_controls['R'].location = right.translation.lerp(right_goal, reach)
                    pouch = Vector((.24*unit, -.025*unit, height-.60*unit))
                    magazine = right_goal + Vector((.075*unit, .045*unit, -.07*unit))
                    hand_controls['L'].location = reach_path(progress, [
                        (0, left.translation), (.23, pouch), (.37, pouch),
                        (.57, magazine), (.70, magazine), (1, left.translation),
                    ])
                    for side, matrix in (('R', right), ('L', left)):
                        hand_controls[side].rotation_quaternion = matrix.to_quaternion()
                    for constraint in gesture_constraints:
                        constraint.mute = False
                elif state == 'idle-check':
                    scan = math.sin(2 * math.pi * progress) * math.sin(math.pi * progress)
                    breath = math.sin(math.pi * progress) ** 2
                    personality = {'lit-commando': .8, 'lit-valkyrie': 1.1, 'lester-original': 1.2, 'lilly': .95}[args.actor]
                    rotate('head', z=14 * scan * personality, x=-3 * breath)
                    rotate('chest', z=3 * scan)
                    rotate('upper_arm.L', x=4 * breath * personality)
                for obj in bpy.data.objects:
                    if obj.get('hmh_actor_id'):
                        obj.hide_render = obj not in objects or obj.get('hmh_layer') != layer
                bpy.context.view_layer.update()
                if state == 'reload' and layer == 'torso-head' and direction == 'east':
                    errors = {side: (rig.pose.bones[f'hand.{side}'].head-hand_controls[side].location).length for side in ('L', 'R')}
                    if max(errors.values()) > .035:
                        raise ValueError(f'Reload wrist target is unreachable: {errors}')
                    control_samples.append({'state': state, 'frame': index, 'wristTargetErrors': errors,
                        'leftWrist': list(rig.pose.bones['hand.L'].head), 'rightWrist': list(rig.pose.bones['hand.R'].head)})
                filename = f'{args.actor}__{layer}__{state}__{direction}__{index:03d}.png'
                scene.render.filepath = str(output / filename)
                bpy.ops.render.render(write_still=True)
                frames.append(filename)
(output.parent / (output.name + '-receipt.json')).write_text(json.dumps({
    'actorId': args.actor, 'source': pilot['sourceModel'], 'frames': frames,
    'runtimeAuthority': 'projection-only', 'nativeActions': pilot['clipActions'],
    'derivedGestures': ['reload', 'idle-check'], 'sourceSaved': False,
    'gestureControlSamples': control_samples,
}, indent=2))
