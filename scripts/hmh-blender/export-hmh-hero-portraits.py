"""Portrait views of the unchanged native gameplay rigs. Never saves a Blend."""
import bpy
import json
import math
import sys
import importlib.util
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
config = json.loads((root / 'apps/hmh-reboot/assets/source/blender/hmh-hero-portrait-render.json').read_text())
manifest = json.loads((root / config['sourceManifest']).read_text())
actor, output = sys.argv[sys.argv.index('--') + 1:]
pilot = next(p for p in manifest['pilots'] if p['actorId'] == actor)
assert Path(bpy.data.filepath).resolve() == (root / pilot['sourceModel']['path']).resolve()
spec = importlib.util.spec_from_file_location('hero_exporter', root / 'scripts/hmh-blender/export-hmh-production-hero-pilot.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
rig = exporter.resolve_rig(manifest, pilot)
action = exporter.set_clip_action(rig, config['action'])
exporter.sample_clip_frame(action, 0, 1, False)
objects = exporter.active_actor_objects(actor)
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.hide_render = obj not in objects or obj.get('hmh_layer') in config['hideLayers']

scene = bpy.context.scene
camera = scene.camera
target = Vector((0, 0, config['cameraTargetHeight']))
horizontal = math.hypot(camera.location.x, camera.location.y)
camera.location = Vector((camera.location.x, camera.location.y,
                          target.z + horizontal / math.tan(math.radians(config['cameraPitchDegrees']))))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.ortho_scale = config['cameraOrthoScale']
scene.render.resolution_x = scene.render.resolution_y = config['frameSize']
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
out = Path(output)
assert out.resolve().is_relative_to((root / '.tmp/hero-portraits').resolve())
out.mkdir(parents=True, exist_ok=True)
for index, angle in enumerate(config['angles']):
    rig.rotation_euler.z = math.radians(manifest['directionAngles']['south'] + angle)
    bpy.context.view_layer.update()
    scene.render.filepath = str(out / f'{actor}-{index}.png')
    bpy.ops.render.render(write_still=True)
print(json.dumps({'actor':actor,'frames':len(config['angles']),'saved':False,'pose':action.name,'cameraPitchDegrees':config['cameraPitchDegrees']}))
