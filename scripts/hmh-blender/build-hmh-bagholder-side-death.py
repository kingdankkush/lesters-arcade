"""Author one side collapse on the existing native rig; never save source art."""
import hashlib, importlib.util, json, math, sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
spec=importlib.util.spec_from_file_location('pilot_exporter',Path(__file__).with_name('export-hmh-actor-glb-pilot.py'))
pilot=importlib.util.module_from_spec(spec);spec.loader.exec_module(pilot)
actor='bagholder-rusher'; actor_spec=pilot.ACTORS[actor]
source=pilot.resolve_source(actor_spec)
if pilot.digest(source) != actor_spec['sha256']:raise ValueError('Immutable native source changed')
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
output=(ROOT/(args[args.index('--output')+1] if '--output' in args else '.tmp/hmh-bagholder-side-death')).resolve()
if not output.is_relative_to(ROOT/'.tmp'):raise ValueError('Output must stay in worktree scratch')
if output.exists():raise ValueError('Use a fresh scratch output; inspect failures before retrying')
output.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
rig=bpy.data.objects[actor_spec['rig']]
pilot.set_action(rig,bpy.data.actions[actor_spec['clips']['idle']]);bpy.context.scene.frame_set(1)
rest={b.name:(b.location.copy(),b.rotation_euler.copy(),b.scale.copy()) for b in rig.pose.bones}
# Local Y is up and local Z is the facing axis on this measured human rig.
# A right-side shoulder/hip landing replaces the existing sagittal collapse:
# buckle first, extend the catching arm, roll the pelvis, settle the limbs.
frames=[(1,0,0),(5,.12,.1),(10,.38,.6),(16,.75,1),(22,.97,.75),(25,1,.65)]
action=bpy.data.actions.new('HMH_Enemy_Death_Side');action.slots.new('OBJECT',rig.name);pilot.set_action(rig,action)
for frame,fall,brace in frames:
    for b in rig.pose.bones:
        b.rotation_mode='XYZ';b.location=rest[b.name][0];b.rotation_euler=rest[b.name][1];b.scale=rest[b.name][2]
    rotations={
        'pelvis':(8*fall,0,90*fall),'chest':(16*fall,0,-10*fall),'head':(12*fall,0,-14*fall),
        'thigh.L':(-30*brace,0,-8*fall),'thigh.R':(-48*brace,0,8*fall),
        'shin.L':(52*brace,0,0),'shin.R':(76*brace,0,0),
        'upper_arm.L':(-12*fall,0,-18*brace),'forearm.L':(-40*fall,0,0),
        'upper_arm.R':(-30*brace,0,58*brace),'forearm.R':(-20*brace,0,0),
    }
    for name,degrees in rotations.items():
        bone=rig.pose.bones.get(name)
        if bone is None:raise ValueError('Native joint missing: '+name)
        for axis,value in enumerate(degrees):bone.rotation_euler[axis]+=math.radians(value)
    rig.pose.bones['pelvis'].location.y-=.75*fall
    for bone in rig.pose.bones:
        for path in ['location','rotation_euler','scale']:bone.keyframe_insert(data_path=path,frame=frame,group=bone.name)
for layer in action.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for curve in bag.fcurves:
    for key in curve.keyframe_points:key.interpolation='LINEAR'
actor_spec['clips']={'death-side':action.name}
meshes=pilot.actor_meshes(actor,rig)
receipt=pilot.export(actor,output/'side-source.glb',rig,meshes,actor_spec)
if pilot.digest(source) != actor_spec['sha256']:raise ValueError('Native source was modified')
(output/'source-proof.json').write_text(json.dumps({'actorId':actor,'source':actor_spec['source'],'sourceSha256':actor_spec['sha256'],
    'sourceUnchanged':True,'rig':rig.name,'clip':'death-side','nativeAction':action.name,'keyFrames':frames,
    'authoringScriptSha256':pilot.digest(Path(__file__)),'blenderVersion':bpy.app.version_string,'export':receipt},indent=2)+'\n')
print('HMH_SIDE_DEATH_EXPORTED='+str(output))
