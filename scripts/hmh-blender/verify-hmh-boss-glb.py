"""Re-import a boss runtime GLB, measure its actual skinned poses and render fit views.

Slice HMH-BOSSES-2-4. Offline Blender inspection, never a game screenshot: the
receipt records per-clip evaluated bounds at five fractions and the native body
foot residual; --render adds the 55-degree gameplay-angle fit renders that the
contact sheet under docs/2.0/receipts/hmh-bosses-20260930/ is built from.
Rendering is a GPU step and runs under the shared heavy lock.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from hmh_boss_poses import BOSS_IDS, BOSS_CLIP_FRAMES

FIT_POSES = [('idle', 0), ('run', .5), ('tell', 1), ('attack', .5), ('attack-2', .5), ('super-tell', 1), ('super', .25), ('hit', .5), ('stagger', 1), ('death', 1)]
FIT_HEADINGS = {'south': 0, 'east': 90, 'north': 180}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def activate_clip(clip):
    ranges = []
    for obj in bpy.data.objects:
        adt = obj.animation_data
        if not adt: continue
        adt.action = None
        for track in adt.nla_tracks:
            matches = track.name == clip; track.mute = not matches
            if matches:
                for strip in track.strips: ranges.append((strip.frame_start, strip.frame_end))
    if not ranges: raise RuntimeError('Imported clip has no actual NLA track: ' + clip)
    return min(start for start, _ in ranges), max(end for _, end in ranges)


def evaluated_bounds(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get(); low = [float('inf')] * 3; high = [-float('inf')] * 3
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph); mesh = evaluated.to_mesh()
        try:
            for vertex in mesh.vertices:
                point = evaluated.matrix_world @ vertex.co
                for i in range(3): low[i] = min(low[i], point[i]); high[i] = max(high[i], point[i])
        finally: evaluated.to_mesh_clear()
    return {'min': low, 'max': high}


def setup_render(height):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'; scene.render.resolution_x = scene.render.resolution_y = 384; scene.render.resolution_percentage = 100
    scene.render.film_transparent = False; scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('Boss fit world'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.04, .05, .08, 1); scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .3
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'; scene.view_settings.exposure = -.3
    bpy.ops.object.camera_add(); camera = bpy.context.object; camera.data.type = 'ORTHO'; camera.data.ortho_scale = height * 2.2
    target = Vector((0, 0, height * .5)); camera.location = Vector((0, -4, target.z + 4 / math.tan(math.radians(55))))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler(); scene.camera = camera
    for name, position, energy, color, size in [('key', (3, -4, 6), 900, (1, .88, .75), 3), ('fill', (-4, -2, 3), 420, (.65, .8, 1), 2.6), ('rim', (2, 3, 5), 700, (1, .82, .64), 2.2)]:
        bpy.ops.object.light_add(type='AREA', location=position); light = bpy.context.object; light.name = 'Boss fit ' + name
        light.data.energy = energy; light.data.color = color; light.data.shape = 'DISK'; light.data.size = size
        light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -.002)); floor = bpy.context.object; floor.name = 'Boss fit floor'
    material = bpy.data.materials.new('Boss fit floor'); material.use_nodes = True
    material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.12, .13, .11, 1); floor.data.materials.append(material)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--boss', required=True, choices=list(BOSS_IDS))
    parser.add_argument('--output-directory', required=True)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    output = (ROOT / args.output_directory).resolve()
    if not output.is_relative_to(ROOT / '.tmp'): raise ValueError('Boss verification output must stay under .tmp')
    output.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'apps/portal/assets/generated/hmh-actor-3d-pilot' / f'{args.boss}.glb'
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH' and any(mod.type == 'ARMATURE' for mod in obj.modifiers)]
    rigs = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']
    body = [obj for obj in meshes if obj.get('hmh_native_body')]
    if not body: raise RuntimeError('Reimported native boss body identity missing')
    scene = bpy.context.scene; clips = []; worst_foot = 0
    for clip in BOSS_CLIP_FRAMES:
        start, end = activate_clip(clip); samples = []
        for fraction in [0, .25, .5, .75, 1]:
            frame = start + (end - start) * fraction; scene.frame_set(int(frame), subframe=frame % 1)
            sample = {'frame': frame, **evaluated_bounds(meshes), 'nativeBodyMinimumZ': evaluated_bounds(body)['min'][2]}
            worst_foot = max(worst_foot, abs(sample['nativeBodyMinimumZ'])); samples.append(sample)
        minimums = [sample['min'][2] for sample in samples]
        clips.append({'name': clip, 'frameRange': [start, end], 'samples': samples, 'minimumWorldZ': min(minimums), 'maximumMinimumWorldZ': max(minimums)})
    if worst_foot > .002: raise RuntimeError(f'Reimported boss foot grounding failed: {worst_foot}')
    rest = evaluated_bounds(meshes); height = rest['max'][2] - rest['min'][2]
    receipt = {'schema': 1, 'actorId': args.boss, 'glbSha256': digest(source), 'verification': 'offline-Blender-reimport-not-runtime', 'cameraDegreesFromVertical': 55,
               'meshes': len(meshes), 'bones': sum(len(rig.data.bones) for rig in rigs), 'maximumNativeFootResidualMetres': worst_foot, 'clips': clips, 'renders': []}
    if args.render:
        setup_render(height); rig = rigs[0]; rig.rotation_mode = 'XYZ'
        for clip, fraction in FIT_POSES:
            start, end = activate_clip(clip); frame = start + (end - start) * fraction; scene.frame_set(int(frame), subframe=frame % 1)
            for heading, yaw in FIT_HEADINGS.items():
                rig.rotation_euler.z = math.radians(yaw); bpy.context.view_layer.update()
                name = f'{args.boss}__{clip}__{fraction}__{heading}.png'; scene.render.filepath = str(output / name); bpy.ops.render.render(write_still=True)
                receipt['renders'].append(name)
        rig.rotation_euler.z = 0
    (output / f'{args.boss}-reimport.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print('HMH_BOSS_REIMPORT_RECEIPT=' + json.dumps({k: v for k, v in receipt.items() if k not in {'clips', 'renders'}}), flush=True)


if __name__ == '__main__':
    main()
