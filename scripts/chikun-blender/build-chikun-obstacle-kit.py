"""Authored alpha obstacle kit, cartoon materials, native geometry and lighting.

No downloaded art, no simulation source and no paid generation. Bake sources
belong in the local asset archive; only small runtime WebPs belong in Git LFS.
"""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--loops',action='store_true')
opt=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(opt.output);out.mkdir(parents=True,exist_ok=True)
SPECS={'pipe':(128,256),'drone':(256,128),'canopy':(256,448),'storm':(256,448),'waterfall':(384,256),'gap-lip':(96,128)}
def mat(name,c,metal=0,rough=.55,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
 if emission:b.inputs['Emission Color'].default_value=(*c,1);b.inputs['Emission Strength'].default_value=emission
 return m
def box(name,loc,scale,m,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:mod=o.modifiers.new('Soft authored edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return o
def sphere(name,loc,scale,m,detail=2):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=detail,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o
def rod(name,a,b,r,m,r2=None):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o
def setup(name):
 bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.cycles.device='CPU';s.render.threads_mode='FIXED';s.render.threads=6
 s.render.resolution_x,s.render.resolution_y=SPECS[name];s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.view_settings.view_transform='AgX';s.world=bpy.data.worlds.new('Cool ambient studio');s.world.color=(.20,.24,.30)
 aspect=SPECS[name][0]/SPECS[name][1];target=Vector((0,0,1));bpy.ops.object.camera_add(location=(0,-9,1.8));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=max(2.18,2.18*aspect);s.camera=cam
 for loc,power,color in [((-3,-4,5),450,(1,.84,.63)),((3,-3,3),260,(.57,.83,1)),((1,3,4),700,(.73,.90,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.size=3;l.data.color=color;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
 return s,aspect
receipts=[]
for name in SPECS:
 s,aspect=setup(name)
 teal=mat('Enamel turquoise',(.07,.34,.34),.28);dark=mat('Deep blue steel',(.025,.065,.11),.4);brass=mat('Warm brass trim',(.70,.42,.10),.65);ivory=mat('Warm ivory',(.85,.83,.70));orange=mat('Safety orange',(.94,.28,.055));blue=mat('Cool water',(.055,.40,.65),.28,.27);foam=mat('Foam pearl',(.63,.91,.94),0,.4);rock=mat('Weathered slate',(.14,.23,.25));moss=mat('Living moss',(.17,.33,.10));leaf=mat('Sunlit leaf',(.18,.43,.10));leafdark=mat('Canopy leaf shade',(.035,.15,.09));wood=mat('Warm twisted bark',(.22,.11,.035))
 if name=='pipe':
  rod('Fluted pressure pipe',(0,0,.10),(0,0,1.80),.38,teal);rod('Brass upper collar',(0,0,1.73),(0,0,1.89),.47,brass);rod('Dark hollow mouth',(0,0,1.895),(0,0,1.902),.36,dark)
  rod('Foot flange',(0,0,.08),(0,0,.23),.46,dark)
  for z in [.35,1.52]:rod('Riveted pipe band',(0,0,z),(0,0,z+.06),.395,brass)
  for x in [-.27,0,.27]:sphere('Collar brass bolt',(x,-.40,1.81),(.035,.025,.035),dark)
  box('Warning plate',(0,-.382,1.03),(.51,.05,.28),dark,.025)
  for x in [-.16,0,.16]:box('Reflective safety stripe',(x,-.417,1.03),(.078,.025,.19),orange,.008)
  for x in [-.23,.23]:rod('Long enamel rib',(x,-.32,.48),(x,-.32,1.40),.017,teal)
 elif name=='drone':
  sphere('Armoured patrol shell',(0,0,1),(.58,.29,.25),ivory,3);box('Teal lower chassis',(0,-.02,.86),(.96,.37,.15),teal)
  box('Black visor',(0,-.27,1.02),(.72,.07,.12),dark,.045);lens=mat('Orange scanner',(.95,.20,.035),0,.24,2);sphere('Scanner lens',(-.20,-.325,1.015),(.065,.025,.045),lens,3)
  for x in [-.80,.80]:
   rod('Rotor strut',(0,0,.98),(x,0,1.10),.045,dark);rod('Brass motor',(x,0,1.08),(x,0,1.22),.095,brass)
   bpy.ops.mesh.primitive_torus_add(major_radius=.27,minor_radius=.018,major_segments=32,minor_segments=8,location=(x,0,1.15));bpy.context.object.name='Rotor protective hoop';bpy.context.object.data.materials.append(teal)
   for a in [0,math.pi/2]:o=box('Rotor blade',(x,0,1.24),(.47,.07,.015),dark,.01);o.rotation_euler.z=a
  for x in [-.34,.34]:rod('Landing leg',(x,0,.86),(x+.07,-.07,.68),.025,dark);box('Landing foot',(x+.07,-.06,.68),(.19,.16,.035),brass)
 elif name=='canopy':
  for i in range(5):
   x=(i-2)*.22;rod('Interlocking upper bough',(x-.3,.10,1.83),(x+.28,.05,1.58),.045,wood)
  for row in range(6):
   for col in range(5):
    x=(col-2)*.21+math.sin(row*2.8+col*1.7)*.07;z=1.98-row*.26+math.sin(row*1.7+col*2.1)*.09;size=.16+.055*(1+math.sin(row*5.2+col*3.1))
    sphere('Irregular layered hanging crown',(x,.04-row*.008,z),(size,.13,size*1.18),leafdark if (row+col)%3==0 else leaf,2)
    for k in range(5):
     angle=k*2.4+row+col*.9;o=sphere('Individual broad leaf',(x+math.sin(angle)*size*.70,-.13,z+math.cos(angle)*size*.68),(.054+.015*math.sin(angle),.021,.026),moss if k==1 else leaf,2);o.rotation_euler.y=angle
  for i in range(8):
   x=(i-3.5)*.13;rod('Hanging vine',(x,-.03,.7),(x+.035,-.04,.14+(i%3)*.07),.010,wood)
   for j in range(3):sphere('Vine paired leaves',(x+(-1 if j%2 else 1)*.027,-.065,.25+j*.11),(.045,.02,.075),leaf)
 elif name=='storm':
  cloud=mat('Storm slate blue',(.13,.19,.29));edge=mat('Cloud silver rim',(.29,.39,.49))
  for row in range(3):
   for col in range(5):sphere('Sculpted rolling storm cloud',((col-2)*.23,.02+row*.05,1.80+row*.055+math.sin(col*2.2)*.08),(.24,.18,.17),cloud if row<2 else edge,3)
  # Rain forms a readable continuous hazard silhouette, with a transparent edge.
  rain=mat('Blue rain streaks',(.17,.48,.64),.1,.38)
  for i in range(25):
   x=(i-12)*.044
   for j in range(4):z=.18+j*.31+(i%3)*.03;rod('Layered rain streak',(x,.09,z),(x+.035,.09,z+.23),.006,rain)
  for i in range(4):sphere('Lower mist puff',((i-1.5)*.26,.13,.13),(.20,.08,.10),cloud,2)
 elif name=='waterfall':
  for side in [-1,1]:
   for i in range(4):sphere('Rounded bank slate',(side*1.25,.04,.29+i*.4),(.24,.28,.30),rock,2)
   for i in range(4):sphere('Moss bank lip',(side*1.22,-.12,1.72+i*.05),(.23,.13,.09),moss,2)
  # A corrugated continuous surface catches light like flowing water, instead
  # of a wall of cylindrical pipes. Fine pale ribbons are sparse and uneven.
  verts=[];faces=[];nx=50;nz=14
  for j in range(nz):
   z=.13+j*1.67/(nz-1)
   for i in range(nx):
    x=-1.125+i*2.25/(nx-1);verts.append((x,.08+.026*math.sin(i*.91+j*.12)+.01*math.sin(j*.8+i),z))
  for j in range(nz-1):
   for i in range(nx-1):a=j*nx+i;faces.append((a,a+1,a+nx+1,a+nx))
  mesh=bpy.data.meshes.new('Continuous falling water surface');mesh.from_pydata(verts,[],faces);mesh.update();surface=bpy.data.objects.new('Pleated water curtain',mesh);bpy.context.collection.objects.link(surface);mesh.materials.append(blue)
  for f in mesh.polygons:f.use_smooth=True
  for i in range(9):
   x=(i-4)*.235;rod('Fine irregular foam streak',(x,-.004,.17+(i%3)*.09),(x+.012,-.004,1.73-(i%2)*.18),.008,foam)
  for i in range(16):sphere('Top crest foam',((i-7.5)*.15,-.07,1.81),(.12,.09,.058),foam,2)
  for i in range(16):sphere('Tumbling bottom foam',((i-7.5)*.16,-.06,.16+abs(math.sin(i*1.8))*.05),(.15,.11,.095),foam,2)
 elif name=='gap-lip':
  for i in range(5):sphere('Stratified fractured bank',(-.10+(i%2)*.07,.06,.25+i*.32),(.42,.30,.23),rock,1)
  for i in range(8):sphere('Grass tuft at cut bank',(-.38+i*.10,-.05,1.72),(.07,.10,.11),moss if i%2 else leaf,2)
  for i in range(5):rod('Exposed roots',(-.25+i*.12,-.22,1.54),(-.19+i*.12,-.26,1.08+(i%3)*.13),.017,wood,.005)
 frames=8 if opt.loops and name in ['drone','canopy','storm','waterfall'] else 1
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];poses={o.name:(o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for o in meshes};surface=bpy.data.objects.get('Pleated water curtain');surface_base=[v.co.copy() for v in surface.data.vertices] if surface else []
 for f in range(frames):
  s.frame_set(f+1)
  phase=f*math.tau/frames
  for i,o in enumerate(meshes):
   loc,rot,scale=poses[o.name];o.location=loc;o.rotation_euler=rot;o.scale=scale
   if name=='drone':
    o.location.z+=math.sin(phase)*.022
    if o.name.startswith('Rotor blade'):o.rotation_euler.z+=phase*2
   elif name=='canopy':
    if o.name.startswith(('Individual broad leaf','Vine paired leaves')):o.rotation_euler.y+=math.sin(phase+i*.31)*.11;o.location.x+=math.sin(phase+i*.31)*.012
    elif o.name.startswith('Irregular layered hanging crown'):o.location.x+=math.sin(phase+i*.4)*.012
   elif name=='storm':
    if o.name.startswith('Layered rain streak'):o.location.z+=math.sin(phase+i*.27)*.10;o.location.x-=math.sin(phase+i*.27)*.012
    elif o.name.startswith('Sculpted rolling storm cloud'):o.location.x+=math.sin(phase+i*.65)*.021;o.scale.z*=1+.035*math.cos(phase+i*.5)
   elif name=='waterfall':
    if o.name.startswith(('Top crest foam','Tumbling bottom foam')):o.location.z+=math.sin(phase+i*.47)*.02;o.scale.x*=1+.06*math.sin(phase+i*.47)
    elif o.name.startswith('Fine irregular foam streak'):o.location.z+=math.sin(phase+i*.65)*.08
  if surface:
   for i,v in enumerate(surface.data.vertices):v.co=surface_base[i];v.co.y=.08+.026*math.sin((i%50)*.91+(i//50)*.12+phase)+.01*math.sin((i//50)*.8+(i%50)+phase)
  # Persist authored transform keys, so the source opens as a playable native
  # loop as well as generating real rendered frames. Simulation reads none.
  for o in meshes:
   o.keyframe_insert(data_path='location',frame=f+1);o.keyframe_insert(data_path='rotation_euler',frame=f+1);o.keyframe_insert(data_path='scale',frame=f+1)
  s.render.filepath=str(out/(name+('-'+str(f) if frames>1 else '')+'.png'));bpy.ops.render.render(write_still=True)
  print('OBSTACLE_FRAME',name,f,flush=True)
 s.frame_start=1;s.frame_end=frames;s.render.fps=12;source=out/(name+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
 receipts.append({'name':name,'width':SPECS[name][0],'height':SPECS[name][1],'frames':frames,'fps':12,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()});print('OBSTACLE_BAKED',name,flush=True)
(out/'native-receipt.json').write_text(json.dumps({'schema':'chikun-obstacle-kit-native-v1','assets':receipts},indent=2))
