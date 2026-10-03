"""Refine four existing native ground props; static geometry only, originals read-only."""
import argparse,math,random,json,hashlib,sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(args.source);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def mat(name,c,rough=.85,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*c,1);s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal;return m
def grain(name,low,high,wood=False):
 m=mat(name,low);n=m.node_tree.nodes;l=m.node_tree.links;s=n.get('Principled BSDF');coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(2.2,26,19)if wood else(3,3,3);l.new(coord.outputs['Generated'],mapping.inputs[0]);noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=2;l.new(mapping.outputs[0],noise.inputs['Vector']);ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*low,1);ramp.color_ramp.elements[1].color=(*high,1);l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],s.inputs['Base Color']);bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.012;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],s.inputs['Normal']);return m
def recolor(o,m):o.data.materials.clear();o.data.materials.append(m)
def ball(name,loc,size,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;o.data.materials.append(m);return o
def box(name,loc,size,m,angle=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;o.rotation_euler.y=angle;o.data.materials.append(m);be=o.modifiers.new('Rounded worn corners','BEVEL');be.width=.009;be.segments=2;return o
def rod(name,a,b,r,m,end=None):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r,radius2=r if end is None else end,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o
def line(name,points,r,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=10;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for b,point in zip(s.bezier_points,points):b.co=point;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(m);return o
def mesh(name,v,f,m):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(m);return o
def remove(prefix):
 for o in list(bpy.data.objects):
  if o.type=='MESH'and o.name.startswith(prefix):bpy.data.objects.remove(o,do_unlink=True)

receipt={'schema':'chikun-ground-obstacle-native-v1','assets':[]}
for kind in ['rock','log','thorn','crate']:
 path=source/(kind+'.blend');before=sha(path);bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False);rng=random.Random(2203+len(kind));scene=bpy.context.scene
 bark=grain('Ridged dark bark',(.055,.025,.012),(.26,.13,.045),True);wood=grain('Weathered cut timber',(.20,.095,.031),(.55,.31,.10),True);iron=mat('Oxidised fitted iron',(.10,.14,.15),.48,.65);dark=mat('Deep wood fissure',(.025,.012,.006));ivory=mat('Broken thorn tips',(.30,.24,.12))
 if kind=='rock':
  remove('Quartz inclusion');rock=bpy.data.objects.get('Granite boulder');recolor(rock,grain('Warm fractured granite',(.12,.14,.125),(.41,.42,.32)))
  for v in rock.data.vertices:
   v.co*=.92+.12*math.sin(v.co.x*8+v.co.z*5)+.06*math.cos(v.co.y*9)
  for poly in rock.data.polygons:poly.use_smooth=False
  rock.modifiers.new('Small eroded ridge bevel','BEVEL').width=.009
  # Real inset dark fissures and small fractured wedges interrupt the silhouette.
  stone=rock.data.materials[0]
  mesh('Recessed front fissure',[(-.14,-.28,.07),(-.08,-.29,.32),(.04,-.26,.44),(.015,-.278,.25),(-.035,-.292,.08)],[(0,1,2,3,4)],mat('Granite crevice',(.055,.065,.055)))
  ball('Broken foot fragment',(-.40,-.10,.073),(.17,.16,.095),stone);ball('Angular side fragment',(.43,.035,.10),(.15,.12,.14),stone)
 elif kind=='log':
  remove('Bark channel');trunk=bpy.data.objects.get('Fallen ridged trunk');recolor(trunk,bark);recolor(bpy.data.objects.get('Cut end grain'),wood)
  for v in trunk.data.vertices:
   v.co.x*=1+.07*math.sin(v.co.z*17);v.co.y*=1+.05*math.cos(v.co.z*14)
  for i in range(14):
   a=i*math.tau/14;yy,zz=math.cos(a)*.218,.28+math.sin(a)*.218
   line('Natural bark furrow',[(-.64,yy,zz),(-.20,yy-.008,zz+.009),(.24,yy+.009,zz-.012),(.63,yy,zz)],.006,dark)
  for radius in [.055,.105,.15,.19]:
   line('Cut growth ring',[(.662,math.cos(a)*radius,.28+math.sin(a)*radius)for a in [n*math.tau/24 for n in range(25)]],.003,dark)
  rod('Broken branch',(0.18,0,.40),(.30,.01,.61),.064,bark,.035);rod('Branch cut',(.30,.01,.61),(.305,.01,.619),.035,wood)
  rod('Side knot',(-.32,-.19,.27),(-.32,-.228,.27),.047,wood);line('Split cut end',[(.664,-.18,.30),(.664,-.02,.28),(.664,.08,.36)],.005,dark)
 elif kind=='crate':
  for o in list(bpy.data.objects):
   if o.type!='MESH':continue
   recolor(o,iron if o.name.startswith('Iron strap')else wood if o.name.startswith('Individual plank')else bark)
  for sign in [-1,1]:box('Fitted diagonal timber brace',(0,-.227,.33),(.65,.036,.065),wood,sign*.66)
  for x in [-.30,.30]:
   for z in [.066,.59]:ball('Recessed iron rivet',(x,-.255,z),(.009,.007,.009),iron)
  for i in range(5):
   x=-.215+i*.107
   line('Plank end split',[(x,-.204,.51),(x+.006,-.207,.45),(x-.003,-.207,.42)],.0018,dark)
  box('Fitted top lip',(0,-.21,.665),(.71,.055,.045),wood);box('Fitted left edge',(-.35,-.22,.33),(.055,.04,.66),bark);box('Fitted right edge',(.35,-.22,.33),(.055,.04,.66),bark)
 elif kind=='thorn':
  anchors=[o.location.copy()for o in bpy.data.objects if o.type=='MESH'and o.name.startswith('Thorn bush leaf')]
  remove('Twisted briar');remove('Thorn bush leaf');remove('Pale sharp thorn')
  leafM=[mat('Briar leaf olive',(.11,.20,.035)),mat('Briar leaf light',(.24,.30,.065))]
  for i,pnt in enumerate(anchors):
   x,z=pnt.x,pnt.z
   points=[(x-.09,.035,.035),(x-.03,.01,z*.60),(x+.06,0,z+.015),(x+.14,.015,z*.73)]
   line('Curved woody briar',points,.016,bark)
   for j in range(3):
    px=x-.02+j*.07;pz=z*.68+math.sin(j*1.9)*.09
    rod('Sharp bramble hook',(px,-.012,pz),(px-.032,-.027,pz+.065),.012,ivory,0)
    a=rng.uniform(-.7,.7);length=.065;v=[(px,-.033,pz),(px+.045,-.04,pz+.026),(px+.09,-.031,pz+.018),(px+.055,-.048,pz-.012),(px+.04,-.062,pz+.013)]
    mesh('Pointed veined briar leaf',v,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],leafM[(i+j)%2])
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=768;scene.render.resolution_y=384;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.3
 scene.camera.location=(1.8,-7,1.3);target=Vector((0,0,.31));scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=1.82
 bpy.ops.wm.save_as_mainfile(filepath=str(out/(kind+'-refined.blend')),compress=True);scene.render.filepath=str(out/(kind+'.png'));bpy.ops.render.render(write_still=True)
 assert sha(path)==before,'original source changed'
 receipt['assets'].append({'name':kind,'sourceSha256':before,'sourceUnchanged':True,'derivedSource':kind+'-refined.blend','renderSha256':sha(out/(kind+'.png'))});print('GROUND_NATIVE',kind,flush=True)
(out/'native-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
