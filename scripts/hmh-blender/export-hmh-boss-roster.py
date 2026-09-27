"""Render every frame of a dark boss derivative's clip plan (art wave 2b) without modifying its source.

Reads the derivative receipt written by build-hmh-boss-derivative.py and the
clip plan from hmh_boss_clips.py, and renders each (phase, clip, direction,
frame) at the boss's render contract: the 35 degree hero camera, the shared
hero light rig, 256 px frames. Phase dressings are accessory swaps
(`hmh_visible_phases`), the accent recolour and emission come from the boss
roster's phaseVisuals, and `wetBelowChest` darkens and glosses the body below
the chest line (the Lockkeeper's soaked phases). Projection-only.

  blender --background --factory-startup --python scripts/hmh-blender/export-hmh-boss-roster.py -- \
      --source-directory .tmp/wave2b/drv-lk --output .tmp/wave2b/render-lk/run-a [--preview]
"""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from bpy_extras.object_utils import world_to_camera_view
from bpy_extras import anim_utils
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from hmh_native_enemy_projection import minimum_z  # noqa: E402
import hmh_boss_clips as boss_clips  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-directory', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--preview', action='store_true')
parser.add_argument('--only-phase')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
directory = (ROOT / args.source_directory).resolve()
receipt = json.loads((directory / 'source-receipt.json').read_text())
source = directory / receipt['source']
if hashlib.sha256(source.read_bytes()).hexdigest() != receipt['sourceSha256']:
    raise ValueError('Boss derivative source changed')
role = receipt['roleId']
if receipt['clipManifest'] != boss_clips.clip_manifest(role):
    raise ValueError('Clip library changed since the derivative was baked; rebuild the derivative')
output = (ROOT / args.output).resolve()
if not output.is_relative_to(ROOT / '.tmp') or output.exists():
    raise ValueError('Use a fresh private boss render output under .tmp')
output.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
scene = bpy.context.scene
rig = bpy.data.objects[receipt['armature']]
rig.parent = None
rig.location = (0, 0, 0)
rig.rotation_euler = (0, 0, 0)
root = bpy.data.objects.new('HMH_Boss_Render_Root', None)
scene.collection.objects.link(root)
rig.parent = root
body = [o for o in bpy.data.objects if o.get('hmh_native_body')]
if not body:
    raise ValueError('Boss body mesh is missing')
for obj in list(bpy.data.objects):
    if obj.type in {'CAMERA', 'LIGHT'}:
        bpy.data.objects.remove(obj, do_unlink=True)
contract = receipt['renderContract']
camera_data = bpy.data.cameras.new('HMH_Boss_Camera')
camera = bpy.data.objects.new('HMH_Boss_Camera', camera_data)
scene.collection.objects.link(camera)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = contract['cameraOrthoScale']
camera_data.clip_end = 60
pitch = math.radians(contract['cameraPitchDegrees'])
target = Vector((0, 0, contract['cameraTargetZ']))
camera.location = target + Vector((0, -12 * math.cos(pitch), 12 * math.sin(pitch)))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
light_rig = json.loads((ROOT / 'scripts/hmh-blender/hmh-light-rig.json').read_text())
family = contract['lightRigFamily']
if family not in light_rig['energy']:
    raise ValueError('Unknown shared light-rig family: ' + family)
# The shared rig positions scaled with the boss (the shipped rig lights a
# 1.75 m actor from these offsets; a 2.6 m boss needs the same angles).
light_scale = receipt['height'] / 1.75
for channel, position in [('key', (-3, -4, 5)), ('fill', (3, -2, 3)), ('rim', (0, 3, 4))]:
    data = bpy.data.lights.new('HMH_Boss_' + channel, 'AREA')
    data.energy = light_rig['energy'][family][channel] * light_scale * light_scale
    data.color = light_rig['colors'][channel]
    data.shape = 'DISK'
    data.size = 3 * light_scale
    obj = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(obj)
    obj.location = Vector(position) * light_scale
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
world = bpy.data.worlds.new('HMH_Boss_World')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.015, .02, .04, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .25
scene.world = world
scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.render.dither_intensity = 0
size = 384 if args.preview else contract['frameSize']
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.image_settings.compression = 20
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -.25

# Wet phases: darken and gloss the body below the chest line (rest-pose object space).
# Soaked to the chest: the waterline sits 60 percent up the chest bone.
chest = rig.data.bones['chest']
chest_z = chest.head_local.z + 0.6 * (chest.tail_local.z - chest.head_local.z)
wet_inputs = []
for slot in body[0].material_slots:
    material = slot.material
    if not material or not material.node_tree:
        continue
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    if bsdf is None:
        continue
    coords = nodes.new('ShaderNodeTexCoord')
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(coords.outputs['Object'], split.inputs[0])
    below = nodes.new('ShaderNodeMath')
    below.operation = 'LESS_THAN'
    below.inputs[1].default_value = chest_z
    links.new(split.outputs['Z'], below.inputs[0])
    amount = nodes.new('ShaderNodeMath')
    amount.operation = 'MULTIPLY'
    amount.inputs[1].default_value = 0.0
    links.new(below.outputs[0], amount.inputs[0])
    base_link = next((l for l in links if l.to_socket == bsdf.inputs['Base Color']), None)
    if base_link is not None:
        darken = nodes.new('ShaderNodeMix')
        darken.data_type = 'RGBA'
        darken.blend_type = 'MULTIPLY'
        links.new(amount.outputs[0], darken.inputs['Factor'])
        links.new(base_link.from_socket, darken.inputs['A'])
        darken.inputs['B'].default_value = (0.5, 0.52, 0.55, 1)
        links.new(darken.outputs['Result'], bsdf.inputs['Base Color'])
    rough_link = next((l for l in links if l.to_socket == bsdf.inputs['Roughness']), None)
    gloss = nodes.new('ShaderNodeMix')
    gloss.data_type = 'FLOAT'
    links.new(amount.outputs[0], gloss.inputs['Factor'])
    if rough_link is not None:
        links.new(rough_link.from_socket, gloss.inputs['A'])
    else:
        gloss.inputs['A'].default_value = bsdf.inputs['Roughness'].default_value
    gloss.inputs['B'].default_value = 0.22
    links.new(gloss.outputs['Result'], bsdf.inputs['Roughness'])
    wet_inputs.append(amount.inputs[1])

manifest = receipt['clipManifest']
directions = dict(zip(boss_clips.DIRECTIONS_ALL, [0, 45, 90, 135, 180, 225, 270, 315]))
accent_material = bpy.data.materials[role + '_RoleLight']
accent_node = accent_material.node_tree.nodes.get('Principled BSDF')
base_scale = accent_material.get('hmh_accent_base_scale', 1.0)
records = []
for phase in manifest['phases']:
    if args.only_phase and phase != args.only_phase:
        continue
    style = receipt['phaseVisuals'][phase]
    for obj in bpy.data.objects:
        if obj.get('hmh_visible_phases'):
            obj.hide_render = phase not in obj['hmh_visible_phases'].split(',')
    colour = tuple(int(style['accent'][i:i + 2], 16) / 255 for i in (1, 3, 5))
    accent_node.inputs['Base Color'].default_value = tuple(v * base_scale for v in colour) + (1,)
    accent_node.inputs['Emission Color'].default_value = colour + (1,)
    accent_node.inputs['Emission Strength'].default_value = style.get('emission', 1.4)
    for socket in wet_inputs:
        socket.default_value = 0.45 if style.get('wetBelowChest') else 0.0
    for clip_id in manifest['phaseClips'][phase]:
        clip = manifest['clips'][clip_id]
        action = bpy.data.actions[receipt['clipActions'][clip_id]]
        rig.animation_data.action = action
        rig.animation_data.action_slot = anim_utils.action_get_first_suitable_slot(action, 'OBJECT')
        samples = sorted({0, clip['frames'] // 2, clip['frames'] - 1}) if args.preview else range(clip['frames'])
        clip_directions = clip['directions']
        if args.preview:
            clip_directions = [d for d in clip_directions if d in ('south', 'east', 'north-east')]
        for direction in clip_directions:
            rig.rotation_euler.z = math.radians(directions[direction])
            for index in samples:
                scene.frame_set(1 + index)
                root.location.z = 0
                bpy.context.view_layer.update()
                floor = min(minimum_z(obj) for obj in body)
                root.location.z = -floor
                bpy.context.view_layer.update()
                residual = min(minimum_z(obj) for obj in body)
                if abs(residual) > .0001:
                    raise ValueError('Boss feet failed to ground')
                pivot = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
                name = f'{role}__{phase}__{clip_id}__{direction}__{index:03d}'
                scene.render.filepath = str(output / (name + '.png'))
                bpy.ops.render.render(write_still=True)
                records.append({'id': name, 'phase': phase, 'clip': clip_id, 'direction': direction, 'frameIndex': index,
                                'fps': clip['fps'], 'loop': clip['loop'], 'sourceSize': [size, size],
                                'sourcePivot': [round(pivot.x * size), round((1 - pivot.y) * size)], 'groundResidual': residual})
(output / 'render-receipt.json').write_text(json.dumps({
    'roleId': role, 'preview': args.preview, 'sourceSha256': receipt['sourceSha256'],
    'sourceUnchanged': hashlib.sha256(source.read_bytes()).hexdigest() == receipt['sourceSha256'],
    'exporterSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'clipLibrarySha256': hashlib.sha256((Path(__file__).parent / 'hmh_boss_clips.py').read_bytes()).hexdigest(),
    'frames': records, 'blenderVersion': bpy.app.version_string}, indent=2) + '\n')
