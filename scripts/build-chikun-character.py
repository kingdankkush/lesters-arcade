"""Blender 5.1: preserve the owner's Tripo colors, rig, animate, export and render.
blender -b --factory-startup --python scripts/build-chikun-character.py -- --source MODEL.obj --out DIRECTORY
No external assets, automatic weights, or simulation changes. Frames are orthographic RGBA.
"""
import bpy, math, json, sys, argparse, hashlib
from mathutils import Vector, Euler
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--out',required=True);p.add_argument('--preview',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
out=Path(a.out).resolve();a.source=str(Path(a.source).resolve());out.mkdir(parents=True,exist_ok=True);frames=out/'frames';frames.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=a.source)
mesh=bpy.context.object;mesh.name='Chikun_Owner_Tripo_Surface'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
source_vertices=len(mesh.data.vertices);source_triangles=len(mesh.data.polygons)
zmin=min(v.co.z for v in mesh.data.vertices);height=max(v.co.z for v in mesh.data.vertices)-zmin
for v in mesh.data.vertices:v.co=(v.co-Vector((0,0,zmin)))/height
dec=mesh.modifiers.new('Game mesh reduction preserving vertex colors','DECIMATE');dec.ratio=60000/source_triangles;bpy.ops.object.modifier_apply(modifier=dec.name)
for f in mesh.data.polygons:f.use_smooth=True
mat=bpy.data.materials.new('Original Tripo vertex paint');mat.use_nodes=True
color=mat.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name=mesh.data.color_attributes[0].name
bs=mat.node_tree.nodes.get('Principled BSDF');mat.node_tree.links.new(color.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.56;bs.inputs['Specular IOR Level'].default_value=.28
mesh.data.materials.clear();mesh.data.materials.append(mat)

data=bpy.data.armatures.new('Chikun_Flight_Skeleton');rig=bpy.data.objects.new('Chikun_Flight_Rig',data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);mesh.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
# Uniform vertical bone axes make the authored rotations easy to audit and edit.
bones={'root':((0,0,.43),None),'spine':((0,0,.49),'root'),'head':((0,0,.68),'spine'),'crest':((0,0,.87),'head'),
 'arm.L':((-.18,0,.61),'spine'),'hand.L':((-.20,-.025,.35),'arm.L'),'arm.R':((.18,0,.61),'spine'),'hand.R':((.20,-.025,.35),'arm.R'),
 'leg.L':((-.087,0,.38),'root'),'boot.L':((-.09,0,.10),'leg.L'),'leg.R':((.087,0,.38),'root'),'boot.R':((.09,0,.10),'leg.R'),
 'coat.L':((-.145,.02,.43),'spine'),'coat.R':((.145,.02,.43),'spine'),'coat.back':((0,.09,.43),'spine')}
for name,(pos,parent) in bones.items():
 b=data.edit_bones.new(name);b.head=pos;b.tail=Vector(pos)+Vector((0,0,.10))
 if parent:b.parent=data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
groups={n:mesh.vertex_groups.new(name=n) for n in bones}
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for v in mesh.data.vertices:
 x,y,z=v.co;side='L' if x<0 else 'R';ax=abs(x);w={}
 boundary=(.165 if z<.32 else .165-(min(z,.50)-.32)*.21)+y*.46
 arm=smooth(boundary-.003,boundary+.003,ax)*(1-smooth(.59,.67,z)) if .235<z<.67 and y<.075 else 0
 paint=mesh.data.color_attributes[0].data[v.index].color
 if z<.365:
  arm=1 if .235<z and ax>.13 and paint[1]>.06 and paint[2]>.045 else 0
 if z<.53 and paint[0]>paint[1]*2 and paint[0]>.07:arm=0
 if arm>.99:
  hand=1-smooth(.345,.385,z);w={'arm.'+side:1-hand,'hand.'+side:hand}
 elif z>.68:
  crest=smooth(.86,.94,z);head=smooth(.66,.74,z);w={'spine':1-head,'head':head*(1-crest),'crest':head*crest}
 elif z>.355:
  hand=1-smooth(.34,.40,z)
  w={'spine':1-arm,'arm.'+side:arm*(1-hand),'hand.'+side:arm*hand}
 else:
  # The long coat is exterior/back of the legs; keep its independent tails.
  coat=max(smooth(.115,.16,ax),smooth(.055,.10,y))*smooth(.13,.23,z)
  tail='coat.back' if y>.095 and ax<.115 else 'coat.'+side
  foot=1-smooth(.09,.16,z);pelvis=smooth(.33,.40,z)
  w={tail:coat,'root':(1-coat)*pelvis,'leg.'+side:(1-coat)*(1-pelvis)*(1-foot),'boot.'+side:(1-coat)*(1-pelvis)*foot}
 for name,weight in w.items():
  if weight>0:groups[name].add([v.index],weight,'REPLACE')
mesh.parent=rig;mod=mesh.modifiers.new('Chikun skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True

names=['idle_hover','idle_breathe','idle_look','idle_ready','takeoff','flap_power','flap_soft','rise_fast','rise_soft','apex','glide','glide_fast','fall_soft','fall_fast','dive','brake','recover','bank_up','bank_down','gust','near_miss_high','near_miss_low','collect','streak','celebrate','hit_front','hit_ceiling','hit_ground','death_tumble','death_fall']
loops=set(names[:4]+['rise_fast','rise_soft','glide','glide_fast','fall_soft','fall_fast','dive'])
def pose(name,t):
 for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0)
 wave=math.sin(t*math.tau);wave2=math.sin(t*math.tau+.8);pulse=math.sin(math.pi*t)**2
 pitch=-.16;roll=.10;arm=.20;flap=.10;leg=.08;body=0;head=0;twist=0
 if name=='idle_breathe':arm=.12;flap=.04;pitch=-.05;body=.013*wave
 elif name=='idle_look':twist=.25*wave;head=.06*wave;flap=.06
 elif name=='idle_ready':arm=.32;flap=.06;roll=.13*wave
 elif name=='takeoff':pitch=-.16-.33*pulse;arm=.3;flap=.48*pulse;leg=.32*pulse;body=.035*pulse
 elif name=='flap_power':pitch=-.30;arm=.40;flap=.52*math.sin(math.tau*t);leg=.24;body=.012*wave
 elif name=='flap_soft':arm=.29;flap=.25*wave;pitch=-.22
 elif name=='rise_fast':pitch=-.40;arm=.56;flap=.22;leg=.32;roll=-.12
 elif name=='rise_soft':pitch=-.27;arm=.35;flap=.12;leg=.16
 elif name=='apex':pitch=-.12+.15*t;arm=.48;flap=.06;leg=.18*pulse
 elif name=='glide':pitch=-.21;arm=.48;flap=.06;leg=.22
 elif name=='glide_fast':pitch=-.46;arm=.62;flap=.07;leg=.30
 elif name=='fall_soft':pitch=.05;arm=.32;flap=.09;leg=.13
 elif name=='fall_fast':pitch=.23;arm=.64;flap=.14;leg=.30
 elif name=='dive':pitch=.44;arm=.22;flap=.03;leg=.36
 elif name=='brake':pitch=.28*pulse;arm=.85*pulse+.2;flap=.05;leg=-.18*pulse
 elif name=='recover':pitch=.20-.48*t;arm=.30+.36*pulse;flap=.10;roll=.20*(1-t)
 elif name=='bank_up':roll=-.24*pulse;pitch=-.38;arm=.50;leg=.25
 elif name=='bank_down':roll=.28*pulse;pitch=.22;arm=.48;leg=.16
 elif name=='gust':roll=.32*wave*(1-t);twist=.16*wave;arm=.60;flap=.20;leg=.16
 elif name=='near_miss_high':pitch=.30*pulse;head=.18*pulse;arm=.10;leg=.36*pulse;body=-.025*pulse
 elif name=='near_miss_low':pitch=-.40*pulse;arm=.55;leg=.55*pulse;body=.024*pulse
 elif name=='collect':twist=-.14*pulse;arm=.62;flap=.18;head=-.10*pulse
 elif name=='streak':roll=-.18*pulse;arm=.75;flap=.12;leg=.26
 elif name=='celebrate':arm=1.15*pulse+.24;roll=.14*wave;head=-.12*pulse
 elif name=='hit_front':pitch=.52*pulse;roll=-.35*pulse;arm=.75*pulse;leg=.48*pulse;head=.22*pulse
 elif name=='hit_ceiling':pitch=.27*pulse;arm=.22;leg=.42*pulse;head=.34*pulse;body=-.03*pulse
 elif name=='hit_ground':pitch=-.26*pulse;arm=.76*pulse;leg=-.38*pulse;head=.22*pulse
 elif name=='death_tumble':roll=math.tau*t;pitch=.5;arm=.72;leg=.42;head=.18;twist=.4*wave
 elif name=='death_fall':roll=.95;pitch=.48;arm=.62-.24*t;leg=.36;head=.28;body=-.035*t
 def rot(n,x=0,y=0,z=0):
  b=rig.pose.bones[n];basis=b.bone.matrix_local.to_quaternion();b.rotation_quaternion=basis.conjugated() @ Euler((x,y,z),'XYZ').to_quaternion() @ basis
 rot('root',-pitch,roll,twist);rig.pose.bones['root'].location.y=body+.005*wave
 rot('spine',.025*wave,0,.025*wave2);rot('head',head-.035*wave,-roll*.2,-twist*.45);rot('crest',.035*wave2,0,.04*wave)
 for side,sign in [('L',-1),('R',1)]:
  # The generated cuffs touch the coat. A restrained arm arc preserves that surface.
  rot('arm.'+side,-.06-.04*wave,-sign*.28*math.tanh((arm+flap*wave)*2),sign*.035)
  rot('hand.'+side,.08*wave2,sign*.10,0)
  rot('leg.'+side,leg+.07*math.sin(t*math.tau+sign),sign*.04,0)
  rot('boot.'+side,-.10-.08*wave2,0,0)
  rot('coat.'+side,-.20+pitch*.35+.10*wave2,sign*(.06+.04*wave),sign*.02)
 rot('coat.back',-.24+pitch*.3+.10*math.sin(t*math.tau-1),.03*wave,0)

rig.animation_data_create();clips=[]
for name in names:
 act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data.action=act
 for i in range(17):
  t=i/16;pose(name,t)
  for b in rig.pose.bones:
   b.keyframe_insert('rotation_quaternion',frame=i+1,group=b.name);b.keyframe_insert('location',frame=i+1,group=b.name)
 clips.append({'name':name,'frames':16,'fps':24,'loop':name in loops,'sheet':name+'.webp'})
rig.animation_data.action=bpy.data.actions['glide']
s=bpy.context.scene;s.render.fps=24;s.frame_start=1;s.frame_end=17;s.frame_set(1)
s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.use_persistent_data=True
s.render.resolution_x=256;s.render.resolution_y=256;s.render.resolution_percentage=100;s.render.film_transparent=True
s.view_settings.view_transform='Standard';s.view_settings.look='Medium High Contrast';s.world.color=(.2,.2,.2)
center=Vector((0,0,.50));bpy.ops.object.camera_add(location=(-1.65,-3.4,1.0));cam=bpy.context.object;cam.name='Gameplay_ThreeQuarter';cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.30;s.camera=cam
for name,loc,power,size,color in [('Warm key',(-2,-3,4),160,3,(1,.90,.76)),('Sky fill',(3,-2,2),100,3,(.67,.84,1)),('Coat rim',(.4,2,2.4),220,2,(.65,.85,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.name=name;l.data.energy=power;l.data.color=color;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(center-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
report={'schema':'chikun-native-character-v1','source_sha256':hashlib.sha256(Path(a.source).read_bytes()).hexdigest(),'source_vertices':source_vertices,'source_triangles':source_triangles,'triangles':len(mesh.data.polygons),'bones':list(bones),'vertex_color_attribute':color.layer_name if hasattr(color,'layer_name') else mesh.data.color_attributes[0].name,'frameSize':256,'columns':4,'rows':4,'clips':clips,'character':'chikun-original','notes':'Owner-supplied Tripo surface; authored spatial skin weights, 30 bone actions; 24fps baked runtime projection. No separate UV texture was present in source.'}
(out/'character.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Chikun-Flight-Rig.blend'),compress=True)
if not a.preview:
 bpy.ops.export_scene.gltf(filepath=str(out/'Chikun-30-Animations.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_anim_slide_to_zero=True,export_all_influences=False,export_def_bones=True)
for clip in clips if not a.preview else [clips[0],clips[5],clips[10],clips[28]]:
 rig.animation_data.action=bpy.data.actions[clip['name']]
 for i in range(16) if not a.preview else [4]:
  s.frame_set(i+1);s.render.filepath=str(frames/(clip['name']+'-'+str(i).zfill(2)+'.png'));bpy.ops.render.render(write_still=True)
 print('CLIP_DONE',clip['name'],flush=True)
print('CHIKUN_BUILD_COMPLETE',flush=True)
