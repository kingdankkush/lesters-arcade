"""Append authored locomotion to the repaired owner model; render transparent clips.
Uses the existing native rig and paint. Run Blender --background --python this.py.
"""
import bpy, math, json, sys, argparse
from pathlib import Path
from mathutils import Vector, Euler, Matrix
p=argparse.ArgumentParser();p.add_argument('--preview',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'ground-motion';OUT.mkdir(exist_ok=True);(OUT/'frames').mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'apps/chikun/assets/source/Chikun-Superman-Rig.blend'))
rig=bpy.data.objects['Chikun_Flight_Rig'];mesh=bpy.data.objects['Chikun_Owner_Tripo_Surface'];scene=bpy.context.scene
names=['walk','run','jump','hurdle_jump','high_jump','jump_flight','land','land_roll','land_slide','ground_impact']
flight=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_quaternion()
# Face right while upright, with shoulder depth along the camera's sight line.
upright=Euler((0,0,math.pi/2),'XYZ').to_quaternion()
def rot(name,x=0,y=0,z=0):
 b=rig.pose.bones[name];basis=b.bone.matrix_local.to_quaternion();b.rotation_quaternion=basis.conjugated()@Euler((x,y,z),'XYZ').to_quaternion()@basis
def pose(name,t):
 for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
 wave=math.sin(t*math.tau);pulse=math.sin(math.pi*t);ease=t*t*(3-2*t)
 world=upright.copy();lean=.09;stride=.68;arm=.53;head=-.05;lift=0
 if name=='walk':stride=.32;arm=.28;lean=.03
 elif name in ['jump','hurdle_jump','high_jump']:stride=0;arm=.3;lean=.10;lift=.03*pulse
 elif name=='jump_flight':world=upright.slerp(flight,ease);stride=0;arm=0;lean=0;head=-1.18*ease
 elif name in ['land','land_roll','land_slide']:
  stride=.2*(1-ease);arm=.2;lean=.38*(1-ease);lift=-.075*math.sin(math.pi*t)**2
  if name=='land_roll':world=Euler((0,-math.tau*(1-ease),0),'XYZ').to_quaternion()@upright
  if name=='land_slide':lean=.7*(1-ease);stride=.65*(1-ease)
 elif name=='ground_impact':world=Euler((0,-.65*ease,0),'XYZ').to_quaternion()@upright;stride=.45;arm=1.2;lift=-.1*ease
 b=rig.pose.bones['root'];basis=b.bone.matrix_local.to_quaternion();b.rotation_quaternion=basis.conjugated()@world@basis;b.location.y=lift
 rot('spine',lean);rot('head',head);rot('crest',.05+.06*wave)
 for side,sign in [('L',-1),('R',1)]:
  swing=wave*sign
  leg=stride*swing;arms=-arm*swing
  if name in ['jump','hurdle_jump','high_jump']:
   leg=(-.60 if side=='L' else .28)*pulse;arms=-1.0*pulse
   if name=='hurdle_jump':leg=(-1.25 if side=='L' else .85)*pulse;arms=-.7*pulse
   if name=='high_jump':leg=-.8*pulse;arms=-2.45*pulse
  if name=='jump_flight':leg=.025*ease;arms=-2.78*ease
  rot('leg.'+side,leg,sign*.015);rot('boot.'+side,.16*max(0,-swing) if name in ['walk','run'] else .3*pulse)
  rot('arm.'+side,arms,sign*.10);rot('hand.'+side,-.08-.1*max(0,swing))
  rot('coat.'+side,.08+.09*math.sin(t*math.tau+sign),sign*.025)
 rot('coat.back',.12+.06*wave)
clips=[]
for name in names:
 act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data.action=act
 for i in range(25):
  pose(name,i/24)
  for b in rig.pose.bones:
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=i+1,group=b.name)
 clips.append({'name':name,'frames':24,'fps':30,'loop':name in ['walk','run'],'sheet':name+'.webp'})
scene.render.resolution_x=scene.render.resolution_y=256;scene.cycles.samples=8;scene.render.use_persistent_data=True
scene.camera.location=(.50,-3.5,1.65)
report={'schema':'chikun-ground-motion-v1','source':'repaired Chikun-Superman-Rig.blend','frameSize':256,'columns':4,'rows':6,'clips':clips,'notes':'Ten authored ground/flight transition actions. Original 21 actions, surface paint and closed seams retained.'}
(OUT/'character.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Chikun-Ground-Sky-Rig.blend'),compress=True)
for clip in clips:
 rig.animation_data.action=bpy.data.actions[clip['name']]
 for i in ([6] if a.preview else range(24)):
  scene.frame_set(i+1);scene.render.filepath=str(OUT/'frames'/f'{clip["name"]}-{i:02}.png');bpy.ops.render.render(write_still=True)
 print('CLIP_DONE',clip['name'],flush=True)
