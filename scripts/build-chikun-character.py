"""Blender 5.1: preserve the owner's Tripo colors, rig, animate, export and render.
blender -b --factory-startup --python scripts/build-chikun-character.py -- --source MODEL.obj --out DIRECTORY
No external assets, automatic weights, or simulation changes. Frames are orthographic RGBA.
"""
import bpy, math, json, sys, argparse, hashlib
from mathutils import Vector, Euler, Matrix, Quaternion
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

def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def arm_mask(co,paint):
 x,y,z=co;ax=abs(x)
 boundary=(.165 if z<.32 else .165-(min(z,.50)-.32)*.21)+y*.46
 arm=smooth(boundary-.003,boundary+.003,ax)*(1-smooth(.59,.67,z)) if .235<z<.67 and y<.075 else 0
 if z<.365:arm=1 if .235<z and ax>.13 and paint[1]>.06 and paint[2]>.045 else 0
 if z<.53 and paint[0]>paint[1]*2 and paint[0]>.07:arm=0
 return arm

# The generated surface welds sleeves into the coat. Separate that contact seam
# before skinning so a raised sleeve cannot pull triangles out of the coat.
original=mesh.data;paints=[tuple(c.color) for c in original.color_attributes[0].data]
mask=[arm_mask(v.co,paints[v.index]) for v in original.vertices]
verts=[];faces=[];colors=[];regions=[];lookup={}
for face in original.polygons:
 arm=sum(mask[i]>.5 for i in face.vertices)>=2
 region=('L' if face.center.x<0 else 'R') if arm else 'body'
 indices=[]
 for i in face.vertices:
  key=(i,region)
  if key not in lookup:
   lookup[key]=len(verts);verts.append(tuple(original.vertices[i].co));colors.append(paints[i]);regions.append(region)
  indices.append(lookup[key])
 faces.append(indices)
surface=bpy.data.meshes.new('Chikun_Separated_Sleeve_Seams');surface.from_pydata(verts,[],faces);surface.update()
attribute=surface.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(colors):attribute.data[i].color=c
surface.materials.append(mat)
for f in surface.polygons:f.use_smooth=True
mesh.data=surface

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
for v in mesh.data.vertices:
 x,y,z=v.co;side='L' if x<0 else 'R';ax=abs(x);w={}
 arm=(1-smooth(.57,.65,z)) if regions[v.index]!='body' else 0
 if regions[v.index]!='body':
  hand=1-smooth(.345,.385,z);w={'spine':1-arm,'arm.'+side:arm*(1-hand),'hand.'+side:arm*hand}
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

names=['ready','takeoff','cruise','accelerate','climb','crest','descend','dive','brake','recover','squeeze','dodge_high','dodge_low','collect','barrel_roll','impact','tumble','fall']
loops={'ready','cruise','climb','descend','dive','squeeze'}
# Upright model axes -> flight: height points right (+X), chest faces down (-Z),
# shoulder span runs into the scene (+Y). This is a prone flight pose, not a
# sideways rotation of an upright hover. The neck looks forward and arms extend.
flight_basis=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_quaternion()
def pose(name,t):
 for b in rig.pose.bones:
  b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
 wave=math.sin(t*math.tau);wave2=math.sin(t*math.tau+.8);pulse=math.sin(math.pi*t)**2
 ease=t*t*(3-2*t)
 pitch=.015;bank=.025*wave;extension=1;leg=.025;head=-1.18;spread=.035;recoil=0
 if name=='ready':pitch=.16;extension=.90;leg=.12;bank=.035*wave
 elif name=='takeoff':pitch=.16*(1-ease);extension=.90+.10*ease;leg=.12*(1-ease)
 elif name=='accelerate':pitch=.045*pulse;extension=1+.045*pulse;bank=-.065*pulse
 elif name=='climb':pitch=.19+.01*wave;bank=-.045
 elif name=='crest':pitch=.12*(1-ease);bank=-.025*(1-ease)
 elif name=='descend':pitch=-.12+.009*wave;bank=.025
 elif name=='dive':pitch=-.25+.01*wave;extension=1.025
 elif name=='brake':pitch=.11*pulse;extension=1-.12*pulse;leg=.28*pulse;spread=.05
 elif name=='recover':pitch=.11*(1-ease);extension=.88+.12*ease;leg=.28*(1-ease)
 elif name=='squeeze':spread=.006;extension=1.035;bank=-.06+.01*wave
 elif name=='dodge_high':pitch=-.12*pulse;bank=.17*pulse;extension=1-.06*pulse;leg=.09*pulse
 elif name=='dodge_low':pitch=.16*pulse;bank=-.16*pulse;extension=1+.02*pulse;leg=.09*pulse
 elif name=='collect':bank=-.075*pulse;head=-1.18-.04*pulse;extension=1+.03*pulse
 elif name=='barrel_roll':bank=math.tau*ease;pitch=.015
 elif name=='impact':pitch=.12*pulse;bank=-.22*pulse;recoil=.30*pulse;extension=1-.25*pulse;leg=.38*pulse;head=-1.18+.25*pulse
 elif name=='tumble':bank=-.22+math.tau*ease;pitch=-.12-.38*ease;extension=.75-.12*pulse;leg=.38;head=-.93
 elif name=='fall':bank=.55;pitch=-.65;extension=.65;leg=.26;head=-.82
 def rot(n,x=0,y=0,z=0):
  b=rig.pose.bones[n];basis=b.bone.matrix_local.to_quaternion();b.rotation_quaternion=basis.conjugated() @ Euler((x,y,z),'XYZ').to_quaternion() @ basis
 root=rig.pose.bones['root'];basis=root.bone.matrix_local.to_quaternion()
 world=Euler((bank,-pitch,0),'XYZ').to_quaternion() @ flight_basis
 root.rotation_quaternion=basis.conjugated() @ world @ basis
 root.location.y=.004*wave
 rot('spine',-.025+.012*wave+recoil,0,0)
 rot('head',head+.012*wave,0,-.025)
 rot('crest',.055+.035*wave2,0,.015*wave)
 for side,sign in [('L',-1),('R',1)]:
  rot('arm.'+side,-2.78*extension+.012*wave2,sign*spread,sign*.025)
  rig.pose.bones['arm.'+side].scale.y=1.14
  rot('hand.'+side,-.06+.018*wave2,sign*.05,0)
  rot('leg.'+side,leg+.018*math.sin(t*math.tau+sign),sign*.015,0)
  rot('boot.'+side,1.02+.035*wave2,0,0)
  rot('coat.'+side,.15+.055*math.sin(t*math.tau+sign*.7),sign*(.05+.025*wave2),sign*.02)
 rot('coat.back',.18+.055*math.sin(t*math.tau-1),.015*wave,0)

rig.animation_data_create();clips=[]
for name in names:
 act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data.action=act
 for i in range(25):
  t=i/24;pose(name,t)
  for b in rig.pose.bones:
   b.keyframe_insert('rotation_quaternion',frame=i+1,group=b.name);b.keyframe_insert('location',frame=i+1,group=b.name);b.keyframe_insert('scale',frame=i+1,group=b.name)
 clips.append({'name':name,'frames':24,'fps':30,'loop':name in loops,'sheet':name+'.webp'})
rig.animation_data.action=bpy.data.actions['cruise']
s=bpy.context.scene;s.render.fps=30;s.frame_start=1;s.frame_end=25;s.frame_set(1)
s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.use_persistent_data=True
s.render.resolution_x=256;s.render.resolution_y=256;s.render.resolution_percentage=100;s.render.film_transparent=True
s.view_settings.view_transform='Standard';s.view_settings.look='Medium High Contrast';s.world.color=(.2,.2,.2)
center=Vector((.10,0,.45));bpy.ops.object.camera_add(location=(.50,-3.5,1.65));cam=bpy.context.object;cam.name='Gameplay_Rightward_Flight';cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.45;s.camera=cam
for name,loc,power,size,color in [('Warm key',(-2,-3,4),160,3,(1,.90,.76)),('Sky fill',(3,-2,2),100,3,(.67,.84,1)),('Coat rim',(.4,2,2.4),220,2,(.65,.85,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.name=name;l.data.energy=power;l.data.color=color;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(center-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
report={'schema':'chikun-native-character-v2','flightPose':'prone-superman-right','source_sha256':hashlib.sha256(Path(a.source).read_bytes()).hexdigest(),'source_vertices':source_vertices,'source_triangles':source_triangles,'triangles':len(mesh.data.polygons),'bones':list(bones),'vertex_color_attribute':color.layer_name if hasattr(color,'layer_name') else mesh.data.color_attributes[0].name,'frameSize':256,'columns':4,'rows':6,'clips':clips,'character':'chikun-original','notes':'Owner mesh and colors, rightward prone Superman flight with raised arms and forward neck aim. 18 motion states, 30fps projection. No separate UV texture was present in source.'}
(out/'character.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Chikun-Superman-Rig.blend'),compress=True)
if not a.preview:
 bpy.ops.export_scene.gltf(filepath=str(out/'Chikun-Superman-Animations.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_anim_slide_to_zero=True,export_all_influences=False,export_def_bones=True)
for clip in clips if not a.preview else [clips[i] for i in [0,1,2,4,7,8,14,15]]:
 rig.animation_data.action=bpy.data.actions[clip['name']]
 for i in range(24) if not a.preview else [6]:
  s.frame_set(i+1);s.render.filepath=str(frames/(clip['name']+'-'+str(i).zfill(2)+'.png'));bpy.ops.render.render(write_still=True)
 print('CLIP_DONE',clip['name'],flush=True)
print('CHIKUN_BUILD_COMPLETE',flush=True)
