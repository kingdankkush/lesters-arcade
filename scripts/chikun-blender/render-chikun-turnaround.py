"""Render front / side / back turnaround plates of the Chikun rig for review.
"D:/Apps/Blender/blender.exe" -b apps/chikun/assets/source/Chikun-Ground-Sky-Rig.blend -P scripts/chikun-blender/render-chikun-turnaround.py -- OUT_DIR [ACTION] [FRAME]
The mesh is shown upright in the requested action (default: rest pose) with the
gameplay lights; the camera orbits the model at head height, orthographic.
"""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
out=Path(args[0] if args else 'turnaround').resolve();out.mkdir(parents=True,exist_ok=True)
action=args[1] if len(args)>1 else '';frame=int(args[2]) if len(args)>2 else 1
rig=bpy.data.objects['Chikun_Flight_Rig'];mesh=bpy.data.objects['Chikun_Owner_Tripo_Surface'];scene=bpy.context.scene
if action:rig.animation_data.action=bpy.data.actions[action];scene.frame_set(frame)
else:
 rig.animation_data.action=None
 for b in rig.pose.bones:b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
 scene.frame_set(1)
scene.render.resolution_x=scene.render.resolution_y=768;scene.render.film_transparent=False
scene.world.color=(.16,.19,.24);scene.cycles.samples=24
cam=bpy.data.objects.new('Turnaround',bpy.data.cameras.new('Turnaround'));scene.collection.objects.link(cam);cam.data.type='ORTHO';cam.data.ortho_scale=1.3;scene.camera=cam
depsgraph=bpy.context.evaluated_depsgraph_get();ev=mesh.evaluated_get(depsgraph)
zs=[(ev.matrix_world@v.co).z for v in ev.data.vertices];centre=Vector((0,0,(max(zs)+min(zs))/2))
# The rest pose faces -Y; every upright action turns the model to face +X for the gameplay camera.
front=0 if action else -math.pi/2
for name,angle in [('front',front),('side',front+math.pi/2),('back',front+math.pi),('three-quarter',front+math.radians(35))]:
 cam.location=centre+Vector((math.cos(angle)*4,math.sin(angle)*4,0));cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)
# Head close-up for the eye / crest / beak read.
cam.data.ortho_scale=.55;head=Vector((0,0,max(zs)-.2))
for name,angle in [('head-front',front),('head-three-quarter',front+math.radians(35)),('head-side',front+math.pi/2)]:
 cam.location=head+Vector((math.cos(angle)*4,math.sin(angle)*4,0));cam.rotation_euler=(head-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)
print('TURNAROUND_DONE',out,flush=True)
