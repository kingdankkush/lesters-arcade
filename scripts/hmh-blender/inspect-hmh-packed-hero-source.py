"""Read exact prepared scene facts in an isolated background Blender process."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--source-blend', required=True)
parser.add_argument('--manifest', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
manifest = json.loads(Path(args.manifest).read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(Path(args.source_blend).resolve()), load_ui=False, use_scripts=False)
actors, bones, sockets = {}, set(), []
for pilot in manifest['pilots']:
    rig = bpy.data.objects.get(pilot.get('armature', manifest['scene']['armature']))
    assert rig is not None and rig.type == 'ARMATURE'
    bones.update(bone.name for bone in rig.data.bones)
    sockets.append(manifest['scene']['weaponSocket'] in rig.pose.bones)
    objects = {layer: [obj.name for obj in bpy.data.objects if obj.type == 'MESH' and obj.get('hmh_actor_id') == pilot['actorId'] and obj.get('hmh_layer') == layer] for layer in pilot['layers']}
    assert all(objects.values()), f'Missing actual layer meshes: {objects}'
    assert all(name in bpy.data.actions for name in pilot['clipActions'].values())
    actors[pilot['actorId']] = {'objectsByLayer': objects, 'armature': rig.name, 'actions': list(pilot['clipActions'].values())}
external = [f'library:{library.filepath}' for library in bpy.data.libraries]
images = {}
for image in bpy.data.images:
    if image.source != 'FILE':
        continue
    packed = [image.packed_file] if image.packed_file else [entry.packed_file for entry in image.packed_files]
    if not packed:
        external.append(f'image:{image.filepath}')
    else:
        images[image.name] = [hashlib.sha256(item.data).hexdigest() for item in packed]
report = {'actors': actors, 'bones': sorted(bones), 'weaponSocket': all(sockets), 'externalDependencyCount': len(external), 'externalDependencies': external, 'packedImageHashes': images}
Path(args.output).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
