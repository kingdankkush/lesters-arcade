"""Export a reviewed district-boss source to its runtime GLB (slice HMH-BOSSES-2-4).

Cold-opens the private boss .blend from build-hmh-boss-native.py, never saves it,
and writes exactly one owned destination:
apps/portal/assets/generated/hmh-actor-3d-pilot/<boss-id>.glb.

The textured Tripo body keeps its UVs and (<= 1024 px) maps. Every authored
gear piece and the skinned garment carry constant Principled colours, so they
are packed into ONE costume mesh with a palette atlas (base colour,
metallic-roughness and emission cells) instead of a Cycles bake: the runtime
decoder allows at most six primitives, and one body + one costume keeps every
boss inside that with room to spare. Clips export as muted NLA tracks with the
same foot-grounding root the Liquidator export uses.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bmesh
import bpy
from bpy_extras import anim_utils
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from hmh_boss_poses import BOSS_IDS, BOSS_CLIP_FRAMES

TRIANGLE_CAP = 30_000
BYTE_CAP = 8_500_000
PALETTE_CELLS = 8
PALETTE_SIZE = 64


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def approved_output(boss_id, output):
    expected = (ROOT / 'apps/portal/assets/generated/hmh-actor-3d-pilot' / f'{boss_id}.glb').resolve()
    if boss_id not in BOSS_IDS or Path(output).resolve() != expected: raise ValueError('Output must be the approved boss runtime destination')
    return expected


def selected(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_set(False); obj.hide_viewport = False; obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def triangles(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def evaluated_min_z(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get(); low = float('inf')
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph); mesh = evaluated.to_mesh()
        try:
            for vertex in mesh.vertices: low = min(low, (evaluated.matrix_world @ vertex.co).z)
        finally: evaluated.to_mesh_clear()
    return low


def apply_geometry(rig, meshes):
    rig.data.pose_position = 'REST'; bpy.context.view_layer.update(); records = []
    for obj in meshes:
        selected([obj]); applied = []
        for modifier in list(obj.modifiers):
            if modifier.type == 'ARMATURE': continue
            if modifier.type not in {'SOLIDIFY', 'BEVEL', 'SUBSURF'}: raise RuntimeError('Unreviewed boss modifier: ' + obj.name + '/' + modifier.type)
            kind, name = modifier.type, modifier.name; bpy.ops.object.modifier_apply(modifier=name); applied.append({'name': name, 'type': kind})
        records.append({'mesh': obj.name, 'applied': applied})
    return records


def weight_rigid_gear(rig, meshes):
    for obj in meshes:
        if obj.parent_type != 'BONE': continue
        bone_name = obj.parent_bone; world = obj.matrix_world.copy()
        obj.parent = rig; obj.parent_type = 'OBJECT'; obj.parent_bone = ''; obj.matrix_world = world
        group = obj.vertex_groups.get(bone_name) or obj.vertex_groups.new(name=bone_name)
        group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        modifier = obj.modifiers.new('Rigid gear skin', 'ARMATURE'); modifier.object = rig


def material_constants(material):
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    base = tuple(bsdf.inputs['Base Color'].default_value)[:3]
    emission = tuple(bsdf.inputs['Emission Color'].default_value)[:3] if bsdf.inputs['Emission Strength'].default_value > 0 else (0, 0, 0)
    return {'base': base, 'roughness': bsdf.inputs['Roughness'].default_value, 'metallic': bsdf.inputs['Metallic'].default_value, 'emission': emission}


def linear_to_srgb(v):
    return 12.92 * v if v <= .0031308 else 1.055 * v ** (1 / 2.4) - .055


def palette_images(boss_id, materials, directory):
    """One 64 px atlas per semantic: material i owns cell i of an 8 x 8 grid."""
    images = {}
    for semantic in ('baseColor', 'metallicRoughness', 'emission'):
        image = bpy.data.images.new(f'{boss_id} palette {semantic}', PALETTE_SIZE, PALETTE_SIZE, alpha=True, float_buffer=False)
        image.colorspace_settings.name = 'sRGB' if semantic != 'metallicRoughness' else 'Non-Color'
        pixels = [0.0] * (PALETTE_SIZE * PALETTE_SIZE * 4); cell = PALETTE_SIZE // PALETTE_CELLS
        for index, material in enumerate(materials):
            constants = material_constants(material)
            if semantic == 'baseColor': rgb = [linear_to_srgb(v) for v in constants['base']]
            elif semantic == 'emission': rgb = [linear_to_srgb(v) for v in constants['emission']]
            else: rgb = [1.0, constants['roughness'], constants['metallic']]
            cx, cy = (index % PALETTE_CELLS) * cell, (index // PALETTE_CELLS) * cell
            for y in range(cy, cy + cell):
                for x in range(cx, cx + cell):
                    offset = (y * PALETTE_SIZE + x) * 4; pixels[offset:offset + 4] = [*rgb, 1.0]
        image.pixels.foreach_set(pixels)
        # Save the generated pixels to a real PNG before packing: a packed
        # generated buffer exported as black in the first Baron fit pass.
        image.filepath_raw = str(directory / f'{boss_id}-palette-{semantic}.png'); image.file_format = 'PNG'; image.save(); image.pack()
        images[semantic] = image
    return images


def palette_uvs(obj, material_index_of):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    for layer in list(bm.loops.layers.uv): bm.loops.layers.uv.remove(layer)
    uv = bm.loops.layers.uv.new('HMH_BossPalette'); cell = 1 / PALETTE_CELLS
    for face in bm.faces:
        index = material_index_of[obj.material_slots[face.material_index].material.name]
        # Blender UV v and image rows both count up from the bottom (the first
        # export sampled the empty top rows and rendered every gear piece black).
        u = (index % PALETTE_CELLS + .5) * cell; v = (index // PALETTE_CELLS + .5) * cell
        for loop in face.loops: loop[uv].uv = (u, v)
    bm.to_mesh(obj.data); bm.free(); obj.data.update()


def packed_material(boss_id, images):
    material = bpy.data.materials.new(boss_id + ' Packed Costume'); material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links; bsdf = nodes.get('Principled BSDF')
    for semantic, image in images.items():
        texture = nodes.new('ShaderNodeTexImage'); texture.image = image; texture.interpolation = 'Closest'
        if semantic == 'baseColor': links.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
        elif semantic == 'metallicRoughness':
            split = nodes.new('ShaderNodeSeparateColor'); split.mode = 'RGB'
            links.new(texture.outputs['Color'], split.inputs[0]); links.new(split.outputs[1], bsdf.inputs['Roughness']); links.new(split.outputs[2], bsdf.inputs['Metallic'])
        else:
            links.new(texture.outputs['Color'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 1
    return material


def pack_costume(boss_id, rig, costume, directory):
    rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
    materials = sorted({slot.material.name: slot.material for obj in costume for slot in obj.material_slots if slot.material}.items())
    if len(materials) > PALETTE_CELLS * PALETTE_CELLS: raise RuntimeError('Boss costume palette overflow')
    index_of = {name: index for index, (name, _) in enumerate(materials)}
    images = palette_images(boss_id, [material for _, material in materials], directory)
    for obj in costume:
        selected([obj]); modifier = obj.modifiers.new('Costume triangles', 'TRIANGULATE')
        if hasattr(modifier, 'keep_custom_normals'): modifier.keep_custom_normals = True
        bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0); bpy.ops.object.modifier_apply(modifier=modifier.name)
        palette_uvs(obj, index_of)
    selected(costume); bpy.ops.object.join(); combined = bpy.context.object
    combined.name = boss_id + ' Packed Costume'; combined.data.materials.clear(); combined.data.materials.append(packed_material(boss_id, images))
    for face in combined.data.polygons: face.material_index = 0
    modifiers = [m for m in combined.modifiers if m.type == 'ARMATURE']
    for extra in modifiers[1:]: combined.modifiers.remove(extra)
    combined['hmh_actor_id'] = boss_id; combined['hmh_layer'] = 'body'; combined['hmh_packed_costume'] = True
    rig.data.pose_position = 'POSE'
    return combined, {'materials': [name for name, _ in materials], 'palette': list(images)}


def limit_textures(maximum=1024):
    records = []
    for image in bpy.data.images:
        if image.type != 'IMAGE' or not image.size[0]: continue
        before = list(image.size)
        if max(before) > maximum:
            ratio = maximum / max(before); image.scale(round(before[0] * ratio), round(before[1] * ratio))
        # The runtime decoder accepts embedded PNG only; Tripo maps arrive as JPEG.
        image.file_format = 'PNG'; image.pack()
        records.append({'image': image.name, 'sourceSize': before, 'exportSize': list(image.size), 'format': 'png'})
    return records


def set_action(rig, action):
    adt = rig.animation_data or rig.animation_data_create()
    for track in adt.nla_tracks: track.mute = True
    adt.action = action; slot = anim_utils.action_get_first_suitable_slot(action, 'OBJECT')
    if slot is None: raise RuntimeError('No suitable armature action slot: ' + action.name)
    adt.action_slot = slot


def prepare_clip_tracks(rig, body, clips):
    adt = rig.animation_data or rig.animation_data_create()
    for track in list(adt.nla_tracks): adt.nla_tracks.remove(track)
    root = bpy.data.objects.new('HMH_Boss_Foot_Root', None); bpy.context.scene.collection.objects.link(root)
    rig.parent = root; rig.matrix_parent_inverse = Matrix.Identity(4)
    grounding = {}
    for clip, action_name in clips.items():
        action = bpy.data.actions[action_name]; set_action(rig, action); start, end = action.frame_range
        if root.animation_data: root.animation_data.action = None
        offsets = []
        for frame in range(int(start), int(end) + 1):
            bpy.context.scene.frame_set(frame); root.location.z = 0; bpy.context.view_layer.update()
            root.location.z = -evaluated_min_z([body]); root.keyframe_insert(data_path='location', index=2, frame=frame); offsets.append(round(root.location.z, 5))
        root_action = root.animation_data.action; root_action.name = 'BossFoot_' + clip; root_slot = root.animation_data.action_slot
        root.animation_data.action = None; root_track = root.animation_data.nla_tracks.new(); root_track.name = clip
        strip = root_track.strips.new(clip, int(start), root_action); strip.action_slot = root_slot; root_track.mute = True
        track = adt.nla_tracks.new(); track.name = clip; strip = track.strips.new(clip, int(start), action)
        strip.action_slot = anim_utils.action_get_first_suitable_slot(action, 'OBJECT'); track.mute = True
        grounding[clip] = {'minOffsetZ': min(offsets), 'maxOffsetZ': max(offsets)}
    adt.action = None; root.location.z = 0
    return root, grounding


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--boss', required=True, choices=list(BOSS_IDS))
    parser.add_argument('--source-directory', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    output = approved_output(args.boss, args.output)
    directory = (ROOT / args.source_directory).resolve(); receipt = json.loads((directory / 'source-receipt.json').read_text(encoding='utf-8'))
    source = directory / receipt['source']
    if receipt['actorId'] != args.boss or digest(source) != receipt['sourceSha256']: raise RuntimeError('Boss source identity mismatch')
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    rig = bpy.data.objects[receipt['armature']]
    meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.get('hmh_actor_id') == args.boss]
    body = next(obj for obj in meshes if obj.get('hmh_native_body'))
    if rig.animation_data:
        rig.animation_data.action = None
        for track in rig.animation_data.nla_tracks: track.mute = True
    applied = apply_geometry(rig, meshes)
    weight_rigid_gear(rig, meshes)
    costume = [obj for obj in meshes if obj is not body]
    combined, packing = pack_costume(args.boss, rig, costume, directory)
    export_meshes = [body, combined]
    for obj in export_meshes:
        obj.data.validate(clean_customdata=False); obj.data.update(); selected([obj])
        bpy.ops.object.vertex_group_limit_total(limit=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    total = sum(triangles(obj) for obj in export_meshes)
    if total > TRIANGLE_CAP: raise RuntimeError(f'Boss exceeds the runtime triangle cap: {total}')
    textures = limit_textures()
    root, grounding = prepare_clip_tracks(rig, body, receipt['clipActions'])
    selected([root, rig, *export_meshes]); bpy.context.view_layer.objects.active = rig
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_yup=True, export_skins=True, export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_anim_slide_to_zero=True, export_force_sampling=True,
                              export_optimize_animation_size=False, export_optimize_animation_keep_anim_object=True, export_apply=False,
                              export_image_format='AUTO', export_extras=True, export_tangents=True, use_active_scene=True, use_selection=True,
                              export_cameras=False, export_lights=False)
    size = output.stat().st_size
    if size > BYTE_CAP: raise RuntimeError(f'Boss GLB exceeds the byte budget: {size}')
    export_receipt = {
        'schema': 1, 'classification': 'unapproved-runtime-boss-export', 'actorId': args.boss, 'source': receipt['source'], 'sourceSha256': receipt['sourceSha256'],
        'sourceBytes': receipt['sourceBytes'], 'sourceUnchanged': digest(source) == receipt['sourceSha256'], 'blenderVersion': bpy.app.version_string,
        'output': output.relative_to(ROOT).as_posix(), 'sha256': digest(output), 'bytes': size, 'triangles': total,
        'meshes': [{'name': obj.name, 'triangles': triangles(obj), 'vertices': len(obj.data.vertices)} for obj in export_meshes],
        'appliedGeometryModifiers': applied, 'costumePacking': packing, 'textures': textures, 'grounding': grounding,
        'clips': list(receipt['clipActions']), 'clipFrames': BOSS_CLIP_FRAMES, 'exporterSha256': digest(Path(__file__)), 'runtimeIntegration': False,
    }
    (directory / 'export-receipt.json').write_text(json.dumps(export_receipt, indent=2) + '\n', encoding='utf-8')
    if digest(source) != receipt['sourceSha256']: raise RuntimeError('Boss source changed during export')
    print('HMH_BOSS_EXPORT_RECEIPT=' + json.dumps({k: v for k, v in export_receipt.items() if k not in {'textures', 'appliedGeometryModifiers'}}), flush=True)


if __name__ == '__main__':
    main()
