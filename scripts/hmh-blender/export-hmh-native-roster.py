"""Render and measure an editable native enemy candidate without modifying its source."""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from hmh_native_enemy_projection import minimum_z
from bpy_extras import anim_utils
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-directory',required=True)
parser.add_argument('--output',required=True)
parser.add_argument('--preview',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
directory=(ROOT/args.source_directory).resolve()
receipt=json.loads((directory/'source-receipt.json').read_text())
source=directory/receipt['source']
if hashlib.sha256(source.read_bytes()).hexdigest()!=receipt['sourceSha256']: raise ValueError('Native enemy source changed')
output=(ROOT/args.output).resolve()
if not output.is_relative_to(ROOT/'.tmp') or output.exists(): raise ValueError('Use a fresh private native enemy render output')
output.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
scene=bpy.context.scene; rig=bpy.data.objects[receipt['armature']]
rig.parent=None; rig.location=(0,0,0); rig.rotation_euler=(0,0,0)
root=bpy.data.objects.new('HMH_Native_Render_Root',None); scene.collection.objects.link(root)
rig.parent=root
root.scale=(1.75/receipt['height'],)*3
body=[o for o in bpy.data.objects if o.get('hmh_native_body')]
if not body: raise ValueError('Native body mesh is missing')
for obj in list(bpy.data.objects):
    if obj.type in {'CAMERA','LIGHT'}: bpy.data.objects.remove(obj,do_unlink=True)
camera_data=bpy.data.cameras.new('HMH_Native_Camera'); camera=bpy.data.objects.new('HMH_Native_Camera',camera_data)
scene.collection.objects.link(camera); camera_data.type='ORTHO'; camera_data.ortho_scale=3.8
target=Vector((0,0,.88)); camera.location=target+Vector((0,-4,5.712))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); scene.camera=camera
light_rig=json.loads((ROOT/'scripts/hmh-blender/hmh-light-rig.json').read_text())
for channel,position in [('key',(-3,-4,5)),('fill',(3,-2,3)),('rim',(0,3,4))]:
    data=bpy.data.lights.new('HMH_Native_'+channel,'AREA'); data.energy=light_rig['energy']['enemy'][channel]
    data.color=light_rig['colors'][channel]; data.shape='DISK'; data.size=3
    obj=bpy.data.objects.new(data.name,data); scene.collection.objects.link(obj); obj.location=position
    obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
world=bpy.data.worlds.new('HMH_Native_World'); world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.015,.02,.04,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25; scene.world=world
scene.render.engine='BLENDER_EEVEE'; scene.render.film_transparent=True; scene.render.dither_intensity=0
size=512 if args.preview else 192 if receipt.get('boss') else 256
scene.render.resolution_x=scene.render.resolution_y=size; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.image_settings.color_depth='8'; scene.render.image_settings.compression=20
scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.25
clips={'idle':(4,6),'run':(12,24),'tell':(4,12),'attack':(6,24),'hit':(3,12),'death':(6,12)}
directions={'south':0,'south-east':45,'east':90,'north-east':135,'north':180,'north-west':225,'west':270,'south-west':315}
if args.preview: directions={key:directions[key] for key in ['south','south-east','east','north']}
records=[]
phases=receipt.get('phaseVisuals',{}) or {None:None}
for phase,style in phases.items():
 for obj in bpy.data.objects:
    if obj.get('hmh_visible_phases'): obj.hide_render=phase not in obj['hmh_visible_phases'].split(',')
 if style:
    color=tuple(int(style['accent'][i:i+2],16)/255 for i in (1,3,5))+(1,)
    node=bpy.data.materials[receipt['actorId']+'_RoleLight'].node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=color; node.inputs['Emission Color'].default_value=color
 for state,(count,fps) in clips.items():
    action=bpy.data.actions[receipt['clipActions'][state]]
    rig.animation_data.action=action
    rig.animation_data.action_slot=anim_utils.action_get_first_suitable_slot(action,'OBJECT')
    samples=[0,count//2,count-1] if args.preview else range(count)
    for direction,yaw in directions.items():
        rig.rotation_euler.z=math.radians(yaw)
        for index in samples:
            frame=1+24*index/(count if state in {'idle','run'} else count-1)
            scene.frame_set(int(frame),subframe=frame-int(frame))
            root.location.z=0; bpy.context.view_layer.update()
            floor=min(minimum_z(obj) for obj in body); root.location.z=-floor
            bpy.context.view_layer.update()
            residual=min(minimum_z(obj) for obj in body)
            if abs(residual)>.0001: raise ValueError('Native enemy feet failed to ground')
            pivot=world_to_camera_view(scene,camera,Vector((0,0,0)))
            phase_token=f'__{phase}' if phase else ''
            name=f"{receipt['actorId']}__body{phase_token}__{state}__{direction}__{index:03d}"
            scene.render.filepath=str(output/(name+'.png')); bpy.ops.render.render(write_still=True)
            records.append({'id':name,'phase':phase,'state':state,'direction':direction,'frameIndex':index,'fps':fps,'loop':state in {'idle','run'},
                'sourceSize':[size,size],'sourcePivot':[round(pivot.x*size),round((1-pivot.y)*size)],'groundResidual':residual,'nativeFrame':frame})
(output/'render-receipt.json').write_text(json.dumps({'actorId':receipt['actorId'],'preview':args.preview,
    'sourceSha256':receipt['sourceSha256'],'sourceUnchanged':hashlib.sha256(source.read_bytes()).hexdigest()==receipt['sourceSha256'],
    'exporterSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'frames':records,
    'runtimeScale':.5*(1.5 if receipt.get('boss') else 1)*(camera_data.ortho_scale/3.055)*(208/size),'blenderVersion':bpy.app.version_string},indent=2)+'\n')
