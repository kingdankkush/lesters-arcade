"""Add bounded source-authored action weight to a NEW gameplay derivative.

The immutable master, meshes, UVs, skin weights, rest rig, materials and prop
visibility are retained. Only five named actions' body rotations and measured
pelvis grounding are changed. This does not publish or bind an atlas.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from hmh_textured_action_polish import POLISHED_ACTIONS, ground_by_measured_response, pose_offsets_degrees


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--actor-id', required=True)
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)
    spec = importlib.util.spec_from_file_location('prepare', ROOT / 'scripts/hmh-blender/prepare-hmh-textured-gameplay-source.py')
    prepare = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prepare)
    source, _, output = prepare.validate_paths(Path(args.source), Path(args.source), Path(args.output))
    report_path = output.with_suffix('.motion.json')
    if report_path.exists():
        raise FileExistsError(f'preserving motion receipt: {report_path}')
    import bpy
    from bpy_extras import anim_utils
    import numpy as np

    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    assert not scene.get('hmh_authored_action_polish'), 'do not apply additive polish twice'
    before = prepare.native_signature(bpy, args.actor_id)
    rigs = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']
    assert len(rigs) == 1
    rig = rigs[0]
    bodies = [obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.get('hmh_actor_id') == args.actor_id and obj.get('hmh_layer') in ('lower-body', 'torso-head')]
    assert len(bodies) == 2
    assert len(bpy.data.actions) == 9 and all(name in bpy.data.actions for name in POLISHED_ACTIONS)

    def minimum_z():
        values = []
        graph = bpy.context.evaluated_depsgraph_get()
        for obj in bodies:
            evaluated = obj.evaluated_get(graph)
            mesh = evaluated.to_mesh()
            try:
                coordinates = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
                mesh.vertices.foreach_get('co', coordinates)
                matrix = np.asarray(evaluated.matrix_world)
                values.append(float((coordinates.reshape((-1, 3)) @ matrix[2, :3] + matrix[2, 3]).min()))
            finally:
                evaluated.to_mesh_clear()
        return min(values)

    pattern = re.compile(r'^pose\.bones\["([^\"]+)"\]\.rotation_euler$')
    changes, grounding = [], []
    for name in POLISHED_ACTIONS:
        action = bpy.data.actions[name]
        start, end = map(float, action.frame_range)
        assert end > start and start.is_integer() and end.is_integer()
        slot = anim_utils.action_get_first_suitable_slot(action, 'OBJECT')
        assert slot is not None
        rig.animation_data.action = action
        rig.animation_data.action_slot = slot
        touched = 0
        for layer in action.layers:
            for strip in layer.strips:
                bag = strip.channelbag(slot)
                if bag is None:
                    continue
                for curve in bag.fcurves:
                    match = pattern.fullmatch(curve.data_path)
                    if not match:
                        continue
                    bone = match.group(1)
                    assert rig.pose.bones[bone].rotation_mode == 'XYZ'
                    for point in curve.keyframe_points:
                        progress = (float(point.co.x) - start) / (end - start)
                        degrees = pose_offsets_degrees(name, progress).get(bone, (0, 0, 0))[curve.array_index]
                        if abs(degrees) < 1e-12:
                            continue
                        delta = math.radians(degrees)
                        point.co.y += delta
                        point.handle_left.y += delta
                        point.handle_right.y += delta
                        touched += 1
                    curve.update()
        assert touched > 0, f'no authored channels changed: {name}'
        changes.append({'action': name, 'rotationKeysChanged': touched})
        for frame in range(int(start), int(end) + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            initial, residual = ground_by_measured_response(rig.pose.bones['pelvis'], minimum_z, bpy.context.view_layer.update)
            rig.pose.bones['pelvis'].keyframe_insert(data_path='location', index=1, frame=frame, group='pelvis')
            grounding.append({'action': name, 'frame': frame, 'minimumBefore': initial, 'residualAfter': residual})
        print(json.dumps({'actor': args.actor_id, 'polishedAction': name, 'rotationKeysChanged': touched}), flush=True)

    scene['hmh_authored_action_polish'] = 'weighted-anticipation-followthrough-v1'
    scene.frame_set(1)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(output), load_ui=False, use_scripts=False)
    after = prepare.native_signature(bpy, args.actor_id)
    original_actions = {row['name']: row for row in before.pop('actions')}
    output_actions = {row['name']: row for row in after.pop('actions')}
    assert before == after, 'action polish changed geometry, skin, rest rig or materials'
    for name in original_actions:
        if name in POLISHED_ACTIONS:
            assert original_actions[name] != output_actions[name], f'polish was not preserved: {name}'
        else:
            assert original_actions[name] == output_actions[name], f'unrelated action changed: {name}'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
    result = {'actorId': args.actor_id, 'sourceFile': source.name, 'sourceSha256': source_hash, 'output': output.relative_to(ROOT).as_posix(), 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'outputBytes': output.stat().st_size, 'changedActions': changes, 'unchangedActions': sorted(set(original_actions) - set(POLISHED_ACTIONS)), 'nativeNonActionPreservationPassed': True, 'groundedFrameCount': len(grounding), 'maximumGroundResidual': max(abs(row['residualAfter']) for row in grounding), 'grounding': grounding, 'runtimeIntegration': False}
    report_path.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'grounding'}), flush=True)


if __name__ == '__main__':
    main()
