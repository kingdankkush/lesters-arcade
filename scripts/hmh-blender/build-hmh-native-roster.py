"""Create editable, skinned enemy derivatives with role-specific costumes and actions."""
import argparse, hashlib, importlib.util, json, math, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Euler, Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import hmh_enemy_poses as poses
from hmh_native_roster_poses import native_role_pose
spec=importlib.util.spec_from_file_location('props',ROOT/'scripts/hmh-blender/create-hmh-authored-props.py')
props=importlib.util.module_from_spec(spec); spec.loader.exec_module(props)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--actor',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
roster=json.loads((ROOT/'apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json').read_text())
actor=next(a for a in roster['actors'] if a['actorId']==args.actor)
if args.actor=='bagholder-rusher': raise ValueError('The existing Bagholder source is preserved')
heroes=json.loads((ROOT/'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text())
hero_id={'forkrunner':'lilly','liquidator-agent':'lit-commando'}.get(args.actor)
if hero_id:
    hero=next(p for p in heroes['pilots'] if p['actorId']==hero_id)
    source=ROOT/hero['sourceModel']['path']; expected=hero['sourceModel']['sourceSha256']
else:
    native=roster['actors'][0]['sourceModel']; source=ROOT/native['path']; expected=native['sourceSha256']
if hashlib.sha256(source.read_bytes()).hexdigest()!=expected: raise ValueError('Native body source identity changed')
output=(ROOT/args.output).resolve()
if not output.is_relative_to(ROOT/'.tmp') or output.exists(): raise ValueError('Use a fresh private native model candidate')
output.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.name=args.actor+' Native Rig'
if rig.parent: rig.parent.location=(0,0,0)
rig.rotation_mode='XYZ'; rig.rotation_euler=(0,0,0)
if rig.animation_data:
    rig.animation_data.action=None
    for track in rig.animation_data.nla_tracks: track.mute=True
for bone in rig.pose.bones:
    bone.rotation_mode='XYZ'; bone.matrix_basis=Matrix.Identity(4)
for obj in list(bpy.data.objects):
    keep=obj.type=='MESH' and (obj.get('hmh_layer') in {'torso-head','lower-body'} if hero_id else bool(obj.get('hmh_primary_skinned_body')))
    if obj.type=='MESH' and not keep: bpy.data.objects.remove(obj,do_unlink=True)
    elif keep:
        obj.hide_render=False; obj['hmh_actor_id']=args.actor; obj['hmh_layer']='body'
        obj['hmh_native_body']=True
    elif obj.type in {'LIGHT','CAMERA'}: bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.view_layer.update()
body_meshes=[o for o in bpy.data.objects if o.type=='MESH']
height=rig.data.bones['head'].tail_local.z+.045
unit=height/1.75
primary={'forkrunner':'#145463','liquidator-agent':'#161b29','whale-enforcer':'#43391f',
    'gas-bomber':'#a34d18','validator-cultist':'#362347','the-liquidator':'#46172e'}[args.actor]
cloth=props.material(args.actor+'_WovenCloth',primary,roughness=.86)
cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=tuple(
    v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in props.rgba(primary)[:3])+(1,)
metal=props.material(args.actor+'_Armor','#39434d' if hero_id else '#514736',metallic=.52,roughness=.67)
dark=props.material(args.actor+'_Straps','#101820',roughness=.8)
accent=props.material(args.actor+'_RoleLight',actor['palette']['accent'],metallic=.10,emission=.08,roughness=.52)
silver=props.material(args.actor+'_BladeEdge','#c7d1d4',metallic=.85,roughness=.28)
nodes=cloth.node_tree.nodes; links=cloth.node_tree.links
noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=135
bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.16; bump.inputs['Distance'].default_value=.018
links.new(noise.outputs['Fac'],bump.inputs['Height']); links.new(bump.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
wear=nodes.new('ShaderNodeTexNoise'); wear.inputs['Scale'].default_value=18; wear.inputs['Detail'].default_value=4
ramp=nodes.new('ShaderNodeValToRGB')
base=tuple(nodes.get('Principled BSDF').inputs['Base Color'].default_value)
ramp.color_ramp.elements[0].position=.23; ramp.color_ramp.elements[0].color=tuple(v*.33 for v in base[:3])+(1,)
ramp.color_ramp.elements[1].position=.8; ramp.color_ramp.elements[1].color=base
links.new(wear.outputs['Fac'],ramp.inputs['Fac']); links.new(ramp.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
for mat in (metal,dark,accent,silver):
    node=mat.node_tree.nodes.get('Principled BSDF'); color=tuple(node.inputs['Base Color'].default_value)
    node.inputs['Base Color'].default_value=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in color[:3])+(1,)
    if mat==accent: node.inputs['Emission Color'].default_value=node.inputs['Base Color'].default_value
nodes=metal.node_tree.nodes; links=metal.node_tree.links
noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=95; noise.inputs['Detail'].default_value=5
ramp=nodes.new('ShaderNodeValToRGB'); base=tuple(nodes.get('Principled BSDF').inputs['Base Color'].default_value)
ramp.color_ramp.elements[0].color=tuple(v*.22 for v in base[:3])+(1,); ramp.color_ramp.elements[1].color=base
links.new(noise.outputs['Fac'],ramp.inputs['Fac']); links.new(ramp.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.25; bump.inputs['Distance'].default_value=.006*unit
links.new(noise.outputs['Fac'],bump.inputs['Height']); links.new(bump.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])

def attach(obj,bone):
    bpy.context.view_layer.update(); matrix=obj.matrix_world.copy()
    obj.parent=rig; obj.parent_type='BONE'; obj.parent_bone=bone; obj.matrix_world=matrix
    obj.hide_render=False
    obj['hmh_actor_id']=args.actor; obj['hmh_layer']='body'; obj['hmh_role_gear']=True
    return obj
def box(name,loc,size,mat=metal,bone='chest',rotation=(0,0,0)):
    return attach(props.cube(args.actor+'_'+name,tuple(v*unit for v in loc),tuple(v*unit for v in size),mat,args.actor,bevel=.012*unit,rotation=rotation),bone)
def cyl(name,loc,radius,depth,mat=metal,bone='chest',rotation=(0,0,0)):
    return attach(props.cylinder(args.actor+'_'+name,tuple(v*unit for v in loc),radius*unit,depth*unit,mat,args.actor,rotation=rotation,vertices=24),bone)
def ring(name,loc,radius,thickness,mat=accent,bone='chest',rotation=(0,0,0)):
    return attach(props.torus(args.actor+'_'+name,tuple(v*unit for v in loc),radius*unit,thickness*unit,mat,args.actor,rotation=rotation),bone)
def ellipsoid(name,loc,size,mat=cloth,bone='head'):
    return attach(props.sphere(args.actor+'_'+name,tuple(v*unit for v in loc),tuple(v*unit for v in size),mat,args.actor),bone)

def hood():
    bands=[(1.40,.18,.15),(1.54,.19,.16),(1.70,.18,.15),(1.82,.13,.11),(1.87,.025,.035)]
    vertices=[]; faces=[]; segments=24
    # Open at the face, stitched around the sides and the back of the head.
    for z,rx,ry in bands:
        for i in range(segments+1):
            a=math.radians(-35+250*i/segments)
            vertices.append((rx*math.cos(a)*unit,(.035+ry*math.sin(a))*unit,z*unit))
    for band in range(len(bands)-1):
        for i in range(segments):
            a=band*(segments+1)+i; faces.append((a,a+1,a+segments+2,a+segments+1))
    mesh=bpy.data.meshes.new('Open cloth hood'); mesh.from_pydata(vertices,[],faces); mesh.update()
    obj=bpy.data.objects.new(args.actor+'_OpenHood',mesh); bpy.context.scene.collection.objects.link(obj); obj.data.materials.append(cloth)
    solid=obj.modifiers.new('Folded hood hem','SOLIDIFY'); solid.thickness=.015*unit
    sub=obj.modifiers.new('Sewn hood folds','SUBSURF'); sub.levels=1
    for face in mesh.polygons: face.use_smooth=True
    attach(obj,'head')

def shoulder(side,boss=False):
    bone='upper_arm.L' if side>0 else 'upper_arm.R'
    for row in range(3):
        box('ShoulderPlate'+str(side)+str(row),(side*(.26+row*.046),0,1.41-row*.045),(.13,.31,.055),metal,bone,rotation=(0,side*.18,0))
        for y in (-.13,.13):
            cyl('ArmorRivet'+str(side)+str(row)+str(y),(side*(.26+row*.046),y,1.445-row*.045),.011,.008,silver,bone)

def garment(name,bands):
    vertices=[]; faces=[]; segments=32
    for z,rx,ry in bands:
        for i in range(segments):
            angle=i*math.tau/segments
            fold=1+.025*math.sin(i*3.0+z*9)
            vertices.append((rx*math.cos(angle)*fold*unit,ry*math.sin(angle)*fold*unit,z*unit))
    for band in range(len(bands)-1):
        for i in range(segments):
            a=band*segments+i; b=band*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(vertices,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(cloth); obj.parent=rig
    for bone in ['pelvis','spine','chest','thigh.L','thigh.R']: obj.vertex_groups.new(name=bone)
    for i,v in enumerate(vertices):
        z=v[2]/unit
        if z<.8:
            thigh='thigh.L' if v[0]>0 else 'thigh.R'; weight=min(.8,max(0,(.85-z)/.7))
            obj.vertex_groups[thigh].add([i],weight,'REPLACE'); obj.vertex_groups['pelvis'].add([i],1-weight,'REPLACE')
        else:
            weight=min(1,max(0,(z-.9)/.4))
            obj.vertex_groups['chest'].add([i],weight,'REPLACE'); obj.vertex_groups['pelvis'].add([i],1-weight,'REPLACE')
    arm=obj.modifiers.new('Native skinning','ARMATURE'); arm.object=rig
    solid=obj.modifiers.new('Cloth thickness','SOLIDIFY'); solid.thickness=.012*unit
    bevel=obj.modifiers.new('Tailored seams','BEVEL'); bevel.width=.008*unit; bevel.segments=2
    for polygon in mesh.polygons: polygon.use_smooth=True
    obj['hmh_actor_id']=args.actor; obj['hmh_layer']='body'; obj['hmh_skinned_costume']=True

long_robe=args.actor in {'validator-cultist','the-liquidator'}
if args.actor!='liquidator-agent':
    garment(args.actor+' Weighted Coat',[(.28,.24,.17),(.65,.23,.16),(.90,.21,.16),(1.15,.24,.17),(1.35,.26,.15),(1.43,.12,.10)] if long_robe
        else [(.82,.20,.14),(1.0,.23,.16),(1.2,.245,.16),(1.36,.26,.14),(1.43,.12,.10)])
for side in (-1,1):
    box('Harness'+str(side),(side*.17,-.235,1.18),(.032,.022,.21),dark)
    for z in (1.08,1.31): box('Buckle'+str(side)+str(z),(side*.17,-.27,z),(.040,.014,.027),metal)
box('Belt',(0,-.205,.86),(.26,.030,.048),dark,bone='pelvis')
for x in (-.22,.20): box('BeltPouch'+str(x),(x,-.23,.81),(.064,.064,.10),cloth,bone='pelvis')

if args.actor=='gas-bomber':
    hood()
    box('Mask',(0,-.19,1.57),(.16,.075,.085),dark,bone='head')
    for side in (-1,1):
        cyl('Respirator'+str(side),(side*.14,-.26,1.54),.07,.10,metal,bone='head',rotation=(math.pi/2,0,0))
        box('Goggle'+str(side),(side*.085,-.233,1.68),(.06,.025,.038),accent,bone='head')
        cyl('FuelTank'+str(side),(side*.20,.29,1.20),.13,.62,cloth)
        for z in (.98,1.37): ring('TankBand'+str(side)+str(z),(side*.20,.29,z),.132,.02,metal)
        cyl('Valve'+str(side),(side*.20,.29,1.56),.045,.12,metal)
    box('PackFrame',(0,.29,1.10),(.31,.065,.10),metal)
elif args.actor=='whale-enforcer':
    for side in (-1,1):
        shoulder(side)
        for i in range(3): box('ShoulderRib'+str(side)+str(i),(side*(.22+i*.07),-.20,1.41),(.025,.025,.10),accent,'upper_arm.L' if side>0 else 'upper_arm.R')
        bone='hand.L' if side>0 else 'hand.R'; p=rig.data.bones[bone].head_local/unit
        box('ChargeGauntlet'+str(side),tuple(p),(.15,.16,.18),metal,bone)
        ring('GauntletCore'+str(side),(p.x,p.y-.17,p.z),.10,.025,accent,bone,rotation=(math.pi/2,0,0))
    box('Breastplate',(0,-.28,1.18),(.25,.055,.20),metal)
    box('ChargeCell',(0,-.35,1.20),(.12,.025,.075),accent)
elif args.actor in {'validator-cultist','the-liquidator'}:
    hood()
    if args.actor=='validator-cultist':
        bone='hand.L'; p=rig.data.bones[bone].head_local/unit
        cyl('Staff',(p.x,p.y-.04,1.0),.026,1.65,dark,bone)
        ring('ValidatorRing',(p.x,p.y-.04,1.84),.20,.032,accent,bone,rotation=(math.pi/2,0,0))
        for i in range(4):
            angle=i*math.pi/2
            box('StaffGlyph'+str(i),(p.x+math.cos(angle)*.20,p.y-.04,1.84+math.sin(angle)*.20),(.045,.045,.045),metal,bone)
    else:
        ring('CrownBand',(0,.02,1.78),.19,.018,metal,'head')
        for i in range(7):
            angle=i*math.tau/7
            obj=props.cone(args.actor+'_CrownPoint'+str(i),(math.cos(angle)*.18*unit,(.02+math.sin(angle)*.18)*unit,1.86*unit),.024*unit,.17*unit,metal,args.actor)
            attach(obj,'head')
        for side in (-1,1):
            shoulder(side,True)
            for i in range(3): box('ArmorCell'+str(side)+str(i),(side*(.22+i*.07),-.22,1.42),(.022,.026,.11),accent)
        for side in (-1,1):
            for i in range(3):
                obj=props.cone(args.actor+'_MarginSpike'+str(side)+str(i),(side*(.30+i*.07)*unit,0,(1.54+i*.03)*unit),.045*unit,.25*unit,accent,args.actor)
                attach(obj,'upper_arm.L' if side>0 else 'upper_arm.R'); obj['hmh_visible_phases']='margin-call,total-liquidation'
        obj=ring('LiquidationHalo',(0,.13,1.94),.36,.025,accent,'head',rotation=(math.pi/2,0,0))
        obj['hmh_visible_phases']='total-liquidation'
    box('ChestSeal',(0,-.27,1.20),(.08,.03,.13),accent)
elif args.actor=='forkrunner':
    box('FaceGuard',(0,-.185,1.61),(.14,.045,.045),dark,'head')
    box('Visor',(0,-.231,1.68),(.17,.020,.023),accent,'head')
    for side in (-1,1):
        bone='hand.L' if side>0 else 'hand.R'; p=rig.data.bones[bone].head_local/unit
        cyl('BladeGrip'+str(side),tuple(p),.037,.16,dark,bone)
        for tine in (-1,1):
            box('ForkBlade'+str(side)+str(tine),(p.x+tine*.055,p.y-.18,p.z-.08),(.020,.27,.025),silver,bone)
        box('BladeGuard'+str(side),(p.x,p.y-.08,p.z-.08),(.14,.03,.025),accent,bone)
elif args.actor=='liquidator-agent':
    box('TacticalMask',(0,-.18,1.57),(.145,.055,.072),dark,'head')
    box('Visor',(0,-.226,1.69),(.17,.018,.027),accent,'head')
    box('TacticalVest',(0,-.15,1.18),(.34,.075,.28),cloth)
    for x in (-.10,0,.10): box('MagazinePouch'+str(x),(x,-.205,1.12),(.07,.045,.12),dark)
    registry=json.loads((ROOT/'apps/hmh-reboot/assets/source/blender/hmh-native-weapons.json').read_text())
    rifle=next(s for s in registry['sources'] if s['weaponId']=='liquidator-rifle'); rifle_path=ROOT/rifle['path']
    if hashlib.sha256(rifle_path.read_bytes()).hexdigest()!=rifle['sha256']: raise ValueError('Rifle source changed')
    with bpy.data.libraries.load(str(rifle_path),link=False) as (data_from,data_to): data_to.objects=list(data_from.objects)
    imported=[obj for obj in data_to.objects if obj]
    for obj in imported:
        bpy.context.scene.collection.objects.link(obj)
        if obj.animation_data:
            obj.animation_data.action=None
            for track in obj.animation_data.nla_tracks: track.mute=True
    bpy.context.view_layer.update()
    gun_parts=[obj for obj in imported if obj.type=='MESH']
    matrices={obj.name:obj.matrix_world.copy() for obj in gun_parts}
    placement=Matrix.Translation(Vector((-.12,-.29,1.20))*unit)@Matrix.Rotation(-math.pi/2,4,'Z')@Matrix.Scale(unit,4)
    for obj in gun_parts:
        obj.parent=None; obj.matrix_world=placement@matrices[obj.name]; attach(obj,'chest')
    for obj in imported:
        if obj.type!='MESH': bpy.data.objects.remove(obj,do_unlink=True)
    for side,position in [('R',(-.12,-.29,1.20)),('L',(-.12,-.54,1.23))]:
        target=bpy.data.objects.new(args.actor+' grip '+side,None); bpy.context.scene.collection.objects.link(target)
        target.location=Vector(position)*unit; attach(target,'chest')
        constraint=rig.pose.bones['forearm.'+side].constraints.new('IK'); constraint.target=target; constraint.chain_count=2; constraint.use_stretch=False

# Retarget the measured role poses into each native bone's rest axes. This
# handles the different bone rolls without replacing the native skin weights.
profile=actor.get('animationProfile',{})
bindings={}; source_counts={'idle':2,'run':24,'tell':2,'attack':3,'hit':2,'death':4}
def apply_role(state,index,count):
    for b in rig.pose.bones: b.matrix_basis=Matrix.Identity(4)
    pose=native_role_pose(profile.get('kind','shared-roster-v1'),profile.get('damageResponse','shared-impact-v1'),state,index,count,actor['build']['stoop'],boss=bool(actor.get('boss')))
    for name,values in pose['rotations'].items():
        target_name='weapon_socket' if name=='prop_socket' else name
        if target_name not in rig.pose.bones: continue
        target=rig.data.bones[target_name].matrix_local.to_3x3().normalized()
        original=Matrix(poses.BONE_REST[name][2]).transposed()
        delta=Euler(tuple(math.radians(v) for v in values),'XYZ').to_matrix()
        rig.pose.bones[target_name].rotation_euler=(target.inverted()@original@delta@original.inverted()@target).to_euler('XYZ')
    for name,values in pose['locations'].items():
        target=rig.data.bones[name].matrix_local.to_3x3().normalized()
        original=Matrix(poses.BONE_REST[name][2]).transposed()
        rig.pose.bones[name].location=target.inverted()@original@Vector(values)*unit

for state,count in source_counts.items():
    action=bpy.data.actions.new('HMH_'+args.actor+'_'+state)
    rig.animation_data_create().action=action
    for index in range(count+(1 if state in {'idle','run'} else 0)):
        sample=index%count; frame=1+24*index/(count if state in {'idle','run'} else count-1)
        apply_role(state,sample,count)
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_euler',frame=frame,group=bone.name)
            bone.keyframe_insert('location',frame=frame,group=bone.name)
    action['hmh_state']=state; action['hmh_loop']=state in {'idle','run'}
    action.use_fake_user=True; bindings[state]=action.name
rig.animation_data.action=bpy.data.actions[bindings['idle']]
bpy.context.scene.frame_set(1)
for image in bpy.data.images:
    if image.type not in {'RENDER_RESULT','COMPOSITING'} and image.size[0] and image.users:
        if max(image.size)>2048:
            ratio=2048/max(image.size); image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
        image.pack()
bpy.context.preferences.filepaths.save_version=0
target=output/(args.actor+'.blend'); bpy.ops.wm.save_as_mainfile(filepath=str(target))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
receipt={'schema':1,'status':'editable-native-candidate','actorId':args.actor,'identityForm':actor['identityForm'],
    'boss':bool(actor.get('boss')),'phaseVisuals':actor.get('phaseVisuals',{}),
    'baseSource':source.relative_to(ROOT).as_posix(),'baseSha256':expected,'sourceUnchanged':hashlib.sha256(source.read_bytes()).hexdigest()==expected,
    'source':target.name,'sourceSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'sourceBytes':target.stat().st_size,
    'armature':rig.name,'bones':len(rig.data.bones),'nativeBodyVertices':sum(len(o.data.vertices) for o in body_meshes),
    'costumeMeshes':sum(bool(o.get('hmh_skinned_costume')) for o in meshes),'gearMeshes':sum(bool(o.get('hmh_role_gear')) for o in meshes),
    'clipActions':bindings,'runtimeAuthority':'projection-only','height':height,'animationProfile':profile,
    'builderSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'poseAuthorSha256':hashlib.sha256((Path(__file__).parent/'hmh_native_roster_poses.py').read_bytes()).hexdigest()}
(output/'source-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt),flush=True)
