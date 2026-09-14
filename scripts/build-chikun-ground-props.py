"""Newly authored Blender props for the v3 ground/sky course. No downloaded art."""
import bpy,math,random,json,hashlib
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'ground-props';OUT.mkdir(exist_ok=True)
SOURCE=ROOT/'apps/chikun/assets/source/ground-sky';SOURCE.mkdir(exist_ok=True)
random.seed(140926)
def mat(name,c,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.65;bs.inputs['Metallic'].default_value=metal;return m
def ball(name,loc,scale,m,detail=2):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=detail,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def box(name,loc,size,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;o.data.materials.append(m);be=o.modifiers.new('Worn edges','BEVEL');be.width=.015;be.segments=2;return o
def rod(name,a,b,r,m,r2=None):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o
def setup(w,h):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.resolution_x=w;s.render.resolution_y=h;s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.world.color=(.23,.26,.29);s.view_settings.view_transform='AgX'
 target=Vector((0,0,.5));bpy.ops.object.camera_add(location=(0,-7,.5));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=max(1.10,1.10*w/h);s.camera=cam
 for loc,power,color in [((-3,-4,5),380,(1,.87,.70)),((3,-2,3),240,(.65,.84,1)),((1,3,4),450,(1,.91,.74))]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.size=4;l.data.color=color;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
 return s
receipts=[]
for name in ['willow','cherry','maple','oak','rock','log','crate','hurdle','thorn','shiba','hawk','eagle','pelican','plane']:
 tree=name in ['willow','cherry','maple','oak'];s=setup(256,512) if tree else setup(384,192)
 wood=mat(name+' bark',(.26,.125,.05));lightwood=mat(name+' grain',(.55,.32,.12));ivory=mat(name+' cream',(.85,.81,.65));dark=mat(name+' dark',(.035,.05,.065));red=mat(name+' caution',(.65,.18,.07));metal=mat(name+' metal',(.30,.41,.45),.65)
 if tree:
  palette={'willow':[(.14,.29,.075),(.27,.43,.10),(.40,.51,.15)],'cherry':[(.67,.19,.33),(.95,.43,.54),(.96,.66,.69)],'maple':[(.55,.09,.025),(.86,.22,.03),(.94,.45,.07)],'oak':[(.07,.23,.045),(.15,.36,.065),(.35,.46,.12)]}[name]
  leaves=[mat(name+' leaf '+str(i),c) for i,c in enumerate(palette)]
  rod('Rooted trunk',(0,0,0),(0,0,.81),.037,wood,.013)
  for i in range(6):
   angle=i*math.tau/6;rod('Visible root',(math.cos(angle)*.14,math.sin(angle)*.08,.01),(0,0,.18),.013,wood,.035)
  crowns=[(0,.78,.185),(-.12,.67,.14),(.12,.66,.13)]
  for cx,cz,r in crowns:
   rod('Spreading bough',(0,0,.30),(cx,0,cz),.024,wood,.009)
   ball('Dense crown',(cx,.03,cz),(r*.95,.10,r*.9),leaves[0])
   verts=[];faces=[];mats=[]
   for j in range(420):
    theta=random.random()*math.tau;u=random.uniform(-1,1);rr=r*random.uniform(.75,1);q=Vector((cx+math.sqrt(1-u*u)*math.cos(theta)*rr,math.sqrt(1-u*u)*math.sin(theta)*rr*.7,cz+u*rr));ln=random.uniform(.012,.025);v=len(verts)
    verts.extend([tuple(q+Vector((-ln,0,0))),tuple(q+Vector((0,-ln/3,ln))),tuple(q+Vector((ln,0,0))),tuple(q+Vector((0,ln/3,-ln))) ]);faces.extend([(v,v+1,v+2),(v,v+2,v+3)]);mats.extend([random.randrange(3)]*2)
   mesh=bpy.data.meshes.new(name+' leaf mesh');mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new('Individual foliage',mesh);bpy.context.collection.objects.link(o)
   for m in leaves:mesh.materials.append(m)
   for f,mi in zip(mesh.polygons,mats):f.material_index=mi
  if name=='willow':
   for i in range(18):
    xx=(i-8.5)*.020;top=.72+.12*math.sin(i*.61);rod('Hanging willow frond',(xx,0,top),(xx+.025,-.05,top-.22-random.random()*.10),.006,leaves[i%3],.003)
 elif name=='rock':
  stone=mat('Granite',(.28,.34,.36));ball('Granite boulder',(0,0,.30),(.56,.29,.28),stone)
  for i in range(8):ball('Quartz inclusion',(random.uniform(-.42,.42),-.245,random.uniform(.20,.43)),(.025,.014,.015),ivory,1)
 elif name=='log':
  rod('Fallen ridged trunk',(-.65,0,.28),(.65,0,.28),.22,wood);rod('Cut end grain',(.653,0,.28),(.66,0,.28),.205,lightwood)
  for i in range(7):rod('Bark channel',(-.64,-.15,.14+i*.043),(.63,-.15,.14+i*.043),.010,lightwood)
 elif name=='crate':
  box('Wooden crate',(0,0,.33),(.66,.35,.65),wood)
  for i in range(6):box('Individual plank',(-.27+i*.108,-.19,.33),(.09,.022,.59),lightwood)
  for z in [.065,.59]:box('Iron strap',(0,-.23,z),(.70,.032,.065),metal)
 elif name=='hurdle':
  for x in [-.48,.48]:box('Hurdle foot',(x,0,.05),(.27,.24,.09),metal);box('Hurdle upright',(x,0,.31),(.06,.08,.58),metal)
  box('Striped crossbar',(0,0,.60),(1.12,.12,.14),ivory)
  for x in [-.42,-.14,.14,.42]:box('Red safety stripe',(x,-.066,.60),(.12,.01,.14),red)
 elif name=='thorn':
  leaf=mat('Thorn foliage',(.16,.29,.06))
  for i in range(18):
   x=random.uniform(-.58,.58);z=random.uniform(.10,.45);rod('Twisted briar',(x,0,.02),(x+.12,0,z),.025,wood,.009);ball('Thorn bush leaf',(x,-.01,z),(.08,.04,.10),leaf)
   rod('Pale sharp thorn',(x+.02,-.04,z-.03),(x-.07,-.055,z+.10),.026,ivory,0)
 elif name=='shiba':
  fur=mat('Shiba amber fur',(.67,.29,.065));cream=mat('Shiba cream muzzle',(.95,.82,.57))
  ball('Shiba body',(-.03,0,.35),(.40,.18,.22),fur,3);ball('Cream chest',(-.32,-.04,.30),(.14,.17,.20),cream)
  for x in [-.28,.21]:
   for y in [-.10,.10]:rod('Running leg',(x,y,.31),(x-.08,y,.05),.057,fur,.045);ball('Paw',(x-.10,y,.055),(.09,.06,.05),cream)
  ball('Shiba alert head',(-.39,-.015,.55),(.19,.15,.18),fur,3);ball('Cream muzzle',(-.55,-.055,.49),(.13,.11,.075),cream)
  ball('Nose',(-.65,-.06,.515),(.042,.045,.027),dark);ball('Watchful eye',(-.465,-.147,.59),(.025,.015,.025),dark)
  for x in [-.48,-.29]:rod('Pointed ear',(x,0,.64),(x-.02,0,.83),.075,fur,0)
  for i in range(8):theta=i*.39;ball('Curled tail',(.36+.13*math.cos(theta),0,.48+.14*math.sin(theta)),(.075,.07,.07),fur)
 elif name in ['hawk','eagle','pelican']:
  feather=mat(name+' feathers',(.22,.11,.045) if name=='hawk' else (.10,.12,.15) if name=='eagle' else (.72,.76,.72));gold=mat('Beak ochre',(.88,.48,.07))
  ball('Bird body',(0,0,.44),(.35,.16,.15),feather,3);ball('Bird head',(-.31,0,.51),(.13,.11,.13),ivory if name!='hawk' else feather)
  rod('Pointed beak',(-.39,0,.48),(-.67 if name=='pelican' else -.53,0,.48),.045,gold,0)
  for side in [-1,1]:
   for i in range(8):rod('Layered flight feather',(.02+i*.025,side*.05,.52),(.18+i*.055,side*.18,.78-i*.025),.040,feather,.015)
  ball('Eye',(-.35,-.105,.55),(.021,.015,.021),dark)
 elif name=='plane':
  ball('Propeller plane fuselage',(0,0,.49),(.80,.12,.13),ivory,3);box('Main wing',(0,0,.50),(.42,1.1,.035),red);box('Tailplane',(.59,0,.52),(.23,.40,.027),red);box('Tail fin',(.63,0,.63),(.18,.025,.25),red);ball('Cockpit',(-.10,-.01,.60),(.20,.10,.09),metal);rod('Propeller',(-.80,-.01,.18),(-.80,-.01,.80),.018,dark)
 scene_path=SOURCE/(name+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(scene_path),compress=True);s.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
 receipts.append({'name':name,'source':scene_path.name,'sha256':hashlib.sha256(scene_path.read_bytes()).hexdigest()});print('PROP_DONE',name,flush=True)
(SOURCE/'provenance.json').write_text(json.dumps({'schema':'chikun-ground-props-v1','author':'New native Blender geometry authored for Lester’s Arcade','sources':receipts},indent=2))
