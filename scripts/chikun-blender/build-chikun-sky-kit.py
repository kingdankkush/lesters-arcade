"""Refine immutable existing sky models and bake eight presentation poses each."""
import argparse,hashlib,json,math,sys
from pathlib import Path
import bpy
from mathutils import Matrix,Vector
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True)
opt=p.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(opt.source);out=Path(opt.output);out.mkdir(parents=True,exist_ok=True)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def material(name,color,roughness=.6,metallic=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Roughness'].default_value=roughness;s.inputs['Metallic'].default_value=metallic;return m
def mesh(name,verts,faces,mat):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(mat);return o
def sphere(name,loc,size,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=bpy.context.object;o.name=name;o.scale=size;o.data.materials.append(mat)
 for face in o.data.polygons:face.use_smooth=True
 return o
def feather(name,base,tip,width,mat):
 a,b=Vector(base),Vector(tip);axis=b-a;side=Vector((-axis.z,0,axis.x)).normalized();verts=[]
 for i in range(9):
  t=i/8;c=a+axis*t;w=width*math.sin(math.pi*t)**.65;verts.extend([tuple(c-side*w),tuple(c+Vector((0,-.009*math.sin(math.pi*t),0))),tuple(c+side*w)])
 faces=[]
 for i in range(8):
  k=i*3;faces.extend([(k,k+3,k+4,k+1),(k+1,k+4,k+5,k+2)])
 return mesh(name,verts,faces,mat)
def recolor(name,mat):
 o=bpy.data.objects.get(name);assert o and o.type=='MESH',name;o.data.materials.clear();o.data.materials.append(mat);return o
def aim(camera,target):camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
def bird(kind):
 pelican=kind=='pelican';dark=material('Ink primary tips',(.035,.045,.05));cream=material('Ivory plumage',(.82,.79,.66));rust=material('Rust hawk mantle',(.31,.095,.028));brown=material('Umber plumage',(.13,.069,.038));gold=material('Horn bill',(.70,.35,.07),.42);eye=material('Amber eye',(.64,.38,.025),.3)
 plumage=cream if pelican else brown;edge=cream if pelican else rust
 for o in list(bpy.data.objects):
  if o.type=='MESH' and (o.name.startswith('Layered flight feather') or o.name.startswith('Pointed beak') or o.name=='Eye'):bpy.data.objects.remove(o,do_unlink=True)
 body=recolor('Bird body',plumage);head=recolor('Bird head',cream if pelican else rust);head.scale=(.115,.10,.11)
 sphere('Breast plumage',(-.06,-.08,.397),(.25,.095,.09),cream)
 sphere('Amber watchful eye',(-.355,-.10,.54),(.019,.011,.016),eye);sphere('Focused pupil',(-.357,-.11,.54),(.009,.004,.01),dark);sphere('Eye glint',(-.36,-.114,.547),(.002,.001,.002),cream)
 if pelican:
  mesh('Long tapered bill',[(-.40,-.04,.53),(-.40,.04,.53),(-.79,.01,.50),(-.79,-.01,.49),(-.40,-.04,.47),(-.40,.04,.47)],[(0,1,2),(0,2,3,4),(1,5,2),(4,3,2,5)],gold)
  sphere('Throat pouch',(-.53,-.015,.455),(.17,.04,.044),material('Peach throat pouch',(.72,.36,.15)))
  for i in range(5):feather('Pelican swept crest '+str(i),(-.31+i*.015,-.03,.59),(-.19+i*.025,-.02,.625),.011,cream)
 else:
  mesh('Hawk hooked bill',[(-.40,-.04,.535),(-.40,.035,.535),(-.54,-.01,.485),(-.51,-.018,.441),(-.477,-.021,.478),(-.40,-.04,.482)],[(0,1,2),(0,2,3,4,5),(1,5,4,3,2)],gold)
  mesh('Hawk brow',[(-.39,-.106,.565),(-.307,-.11,.57),(-.325,-.117,.55),(-.374,-.117,.549)],[(0,1,2,3)],cream)
 for i in range(8):feather('Tail vane '+str(i),(.22,-.035+i*.01,.44),(.59,-.08+i*.025,.40+(i-3)*.012),.022,dark if pelican else rust)
 wings=[]
 for side in [1,-1]:
  y=side*.11;o=mesh('Wing shoulder '+str(side),[(-.11,y,.51),(.04,y,.73),(.20,y,.78),(.36,y,.55),(.20,y,.49)],[(0,1,2,3,4)],plumage);wings.append((o,side))
  for i in range(10):
   o=feather('Primary '+str(side)+' '+str(i),(-.02+i*.029,y-.005,.57+i*.011),(.19+i*.048,y-.009,.91-i*.042),.032,dark if pelican else (rust if i%3==0 else brown));wings.append((o,side))
  for i in range(7):
   o=feather('Covert '+str(side)+' '+str(i),(-.09+i*.035,y-.017,.53),(.04+i*.039,y-.022,.73-i*.012),.034,cream if pelican else rust);wings.append((o,side))
 for i in range(10):feather('Breast streak '+str(i),(-.16+i*.034,-.158,.485),(-.09+i*.033,-.152,.417),.011,cream if pelican else brown)
 sphere('Folded foot',(.18,-.077,.32),(.07,.018,.014),gold)
 for i in range(3):feather('Talon '+str(i),(.20+i*.016,-.096,.327),(.24+i*.016,-.097,.305),.005,dark)
 return wings
def plane():
 ivory=material('Warm enamel',(.83,.76,.59),.33,.15);red=material('Oxide red enamel',(.51,.046,.025),.30,.16);metal=material('Brushed steel',(.22,.28,.30),.30,.68);black=material('Dark rubber',(.025,.028,.03),.6);glass=material('Smoked teal cockpit',(.055,.18,.21),.16,.45)
 recolor('Propeller plane fuselage',ivory);recolor('Main wing',red);recolor('Tail fin',red);recolor('Tailplane',ivory);recolor('Cockpit',glass)
 old=bpy.data.objects.get('Propeller');bpy.data.objects.remove(old,do_unlink=True)
 sphere('Engine cowling',(-.66,0,.49),(.13,.14,.14),red);sphere('Propeller hub',(-.818,0,.49),(.045,.04,.04),metal)
 prop=[]
 for sign in [-1,1]:
  o=mesh('Sculpted propeller '+str(sign),[(-.819,-.02,.49),(-.826,-.025,.49+sign*.245),(-.817,.025,.49+sign*.235),(-.813,.018,.49+sign*.065)],[(0,1,2,3)],metal);prop.append((o,0))
 # Recognizable vintage details instead of a plain block silhouette.
 for i in range(6):sphere('Exhaust port '+str(i),(-.50+i*.07,-.113,.45),(.014,.009,.012),black)
 for i in range(5):sphere('Fuselage rivet '+str(i),(-.35+i*.14,-.12,.51),(.004,.003,.004),metal)
 for x in [-.28,.18]:
  sphere('Landing strut '+str(x),(x,-.08,.305),(.012,.018,.09),metal);sphere('Rubber wheel '+str(x),(x,-.085,.235),(.048,.026,.048),black);sphere('Wheel hub '+str(x),(x,-.112,.235),(.019,.006,.019),metal)
 mesh('Tail cream stripe',[(.53,-.027,.66),(.74,-.027,.69),(.75,-.027,.73),(.53,-.027,.70)],[(0,1,2,3)],ivory)
 mesh('Cockpit highlight',[(-.245,-.081,.63),(-.12,-.106,.665),(.035,-.086,.628),(-.11,-.10,.64)],[(0,1,2,3)],material('Glass sky reflection',(.42,.73,.77),.2,.2))
 return prop
receipt={'schema':'chikun-sky-native-v1','scope':'Presentation only; immutable existing sources, fixed eight-pose registration','assets':[]}
for kind in ['hawk','pelican','plane']:
 path=source/(kind+'.blend');before=sha(path);bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False);scene=bpy.context.scene
 parts=plane() if kind=='plane' else bird(kind);bpy.context.view_layer.update();bases={o.name:o.matrix_world.copy() for o,_ in parts}
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=512;scene.render.resolution_y=256;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
 camera=scene.camera;camera.data.ortho_scale=2.30 if kind=='plane' else 2.45;camera.location=(0,-7,1.15 if kind=='plane' else .56);aim(camera,(0,0,.50));scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.5
 for light in [o for o in bpy.data.objects if o.type=='LIGHT']:light.data.energy*=1.2
 frames=[];pivot=Vector((-.819,0,.49) if kind=='plane' else (-.06,0,.50))
 for index in range(8):
  scene.frame_set(index*5+1)
  for o,side in parts:
   # A non-symmetric half turn samples distinct propeller silhouettes; birds flap about their shoulders.
   phase=index*math.tau/8;angle=index*math.pi/8 if kind=='plane' else math.sin(phase+(0 if side<0 else .18))*.56
   # Recovery strokes tuck their span slightly: neutral crossings have distinct real mesh poses.
   span=1 if kind=='plane' else 1+.08*math.cos(phase)
   o.matrix_world=Matrix.Translation(pivot)@Matrix.Rotation(angle,4,'X' if kind=='plane' else 'Y')@Matrix.Diagonal((span,1,span,1))@Matrix.Translation(-pivot)@bases[o.name];o.keyframe_insert(data_path='location',frame=index*5+1);o.keyframe_insert(data_path='rotation_euler',frame=index*5+1);o.keyframe_insert(data_path='scale',frame=index*5+1)
  bpy.context.view_layer.update();file=out/(kind+'-'+str(index)+'.png');scene.render.filepath=str(file);bpy.ops.render.render(write_still=True);frames.append({'frame':index,'file':file.name,'sha256':sha(file)});print('SKY_POSE',kind,index,flush=True)
 assert sha(path)==before,'Original source changed';bpy.ops.wm.save_as_mainfile(filepath=str(out/(kind+'-refined.blend')),compress=True)
 receipt['assets'].append({'name':kind,'sourceSha256':before,'sourceUnchanged':True,'derivedSource':kind+'-refined.blend','frames':frames})
(out/'native-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
