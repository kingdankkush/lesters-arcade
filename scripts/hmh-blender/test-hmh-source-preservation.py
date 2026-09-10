"""Exercise native preservation fingerprints without saving any scene."""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import bpy

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--actor-id', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    source = Path(args.source).resolve()
    report = Path(args.report).resolve()
    assert report.is_relative_to(ROOT / '.tmp'), 'test receipts stay private'
    assert not report.exists(), 'preserve previous native test receipt'
    spec = importlib.util.spec_from_file_location('preparation', ROOT / 'scripts/hmh-blender/prepare-hmh-textured-gameplay-source.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert callable(getattr(module, 'native_signature', None)), 'native preservation fingerprint must cover mesh, skin, rig, materials and action channels'

    def load():
        bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
        return module.native_signature(bpy, args.actor_id)

    def body():
        return next(obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.get('hmh_actor_id') == args.actor_id and obj.get('hmh_layer') == 'lower-body')

    baseline = load()
    assert baseline == load(), 'unmodified native reopen must be stable'
    results = []

    def challenge(label, mutate):
        before = load()
        mutate()
        bpy.context.view_layer.update()
        after = module.native_signature(bpy, args.actor_id)
        assert after != before, f'{label} changed without invalidating native signature'
        results.append({'mutation': label, 'detected': True})

    def weight():
        obj = body()
        obj.vertex_groups[0].add([0], 0.123456, 'REPLACE')

    def topology():
        mesh = body().data
        indices = [loop.vertex_index for loop in mesh.loops]
        assert indices[0] != indices[1]
        indices[0], indices[1] = indices[1], indices[0]
        mesh.loops.foreach_set('vertex_index', indices)
        mesh.update()

    def material():
        obj = body()
        obj.data.materials.append(obj.data.materials[0].copy())
        obj.data.polygons[0].material_index = len(obj.data.materials) - 1

    def transform():
        body().location.x += 0.25

    def modifier():
        armature = next(modifier for modifier in body().modifiers if modifier.type == 'ARMATURE')
        armature.show_render = not armature.show_render

    def action():
        action = bpy.data.actions['HMH_Run']
        for slot in action.slots:
            for layer in action.layers:
                for strip in layer.strips:
                    bag = strip.channelbag(slot)
                    if bag and bag.fcurves:
                        bag.fcurves[0].keyframe_points[0].co.y += 0.125
                        return
        raise AssertionError('source run action has no editable channel')

    def bind():
        rig = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        rig.data.edit_bones[0].head.x += 0.125
        bpy.ops.object.mode_set(mode='OBJECT')

    for label, mutate in [('skin-weight', weight), ('face-topology', topology), ('material-assignment', material), ('object-transform', transform), ('armature-modifier', modifier), ('action-channel', action), ('bone-bind', bind)]:
        challenge(label, mutate)
    assert len(results) == 7
    assert load() == baseline, 'all challenges must leave the source file unchanged'
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({'passed': True, 'actorId': args.actor_id, 'sourceFile': source.name, 'mutationCount': len(results), 'mutations': results}, indent=2) + '\n', encoding='utf-8')
    print(report.read_text())


if __name__ == '__main__':
    main()
