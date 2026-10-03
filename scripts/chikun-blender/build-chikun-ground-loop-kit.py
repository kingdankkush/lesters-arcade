"""Polish original Shiba/hurdle scenes and bake registered cosmetic loops."""
import argparse,math,json,hashlib,sys
from pathlib import Path
import bpy
from mathutils import Vector,Matrix
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(a.source);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def mat(name,c,rough=.6,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*c,1);s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal;return m
def recolor(o,m):o.data.materials.clear();o.data.materials.append(m)
def ball(name,loc,size,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 bpy.context.view_layer.update();return o
def box(name,loc,size,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;o.data.materials.append(m);b=o.modifiers.new('Fitted rounded edges','BEVEL');b.width=.008;b.segments=3;return o
def line(name,pts,r,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for b,v in zip(s.bezier_points,pts):b.co=v;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(m);return o
receipt={'schema':'chikun-ground-loop-native-v1','assets':[]}
for kind in ['shiba','hurdle']:
 path=source/(kind+'.blend');before=sha(path);bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False);scene=bpy.context.scene
 fur=mat('Warm copper coat',(.54,.215,.043),.86);cream=mat('Soft cream markings',(.94,.82,.56),.9);dark=mat('Nose and eyes',(.014,.009,.007),.32);inner=mat('Inner ear suede',(.32,.105,.051),.91);iron=mat('Powder coated steel',(.18,.24,.255),.44,.65);rubber=mat('Fitted rubber feet',(.031,.042,.04),.95);red=mat('Faded hazard vermilion',(.65,.043,.027),.8);white=mat('Warm safety enamel',(.83,.79,.63),.58);bolt=mat('Bolt heads',(.37,.44,.44),.25,.85)
 animated=[];tape=None
 if kind=='shiba':
  for o in bpy.data.objects:
   if o.type=='MESH':
    recolor(o,dark if o.name.startswith(('Nose','Watchful eye')) else cream if o.name.startswith(('Cream','Paw')) else fur)
    for f in o.data.polygons:f.use_smooth=True
    if o.name.startswith('Curled tail'):animated.append((o,o.matrix_world.copy(),Vector((.34,0,.46)),'tail'))
    if o.name.startswith('Pointed ear'):animated.append((o,o.matrix_world.copy(),Vector((o.location.x,0,.645)),'ear'))
  for x in [-.48,-.29]:
   o=ball('Soft inner ear',(x-.007,-.034,.735),(.029,.012,.057),inner);animated.append((o,o.matrix_world.copy(),Vector((x,0,.645)),'ear'))
  # Subtle facial planes/markings, not painted noise.
  ball('Cream cheek',(-.422,-.144,.502),(.097,.022,.050),cream)
  ball('Visible brow',(-.474,-.148,.635),(.044,.015,.012),cream)
  ball('Eye glint',(-.474,-.162,.598),(.008,.006,.008),white)
  line('Muzzle smile',[(-.647,-.098,.486),(-.58,-.119,.476),(-.53,-.115,.481)],.003,dark)
  for i in range(6):
   x=-.18+i*.062
   line('Coat shoulder tuft',[(x,-.171,.42),(x+.020,-.178,.413),(x+.031,-.173,.405)],.004,cream if i<2 else fur)
 else:
  for o in bpy.data.objects:
   if o.type=='MESH':recolor(o,red if o.name.startswith('Red safety')else white if o.name.startswith('Striped')else iron)
  for x in [-.48,.48]:
   box('Rubber foot shoe',(x,-.008,.028),(.295,.26,.05),rubber);box('Upright clamp',(x,-.025,.527),(.082,.10,.077),iron)
   for z in [.18,.52]:ball('Steel fastening',(x,-.058,z),(.015,.012,.015),bolt)
  # Loose end of the hazard wrap; the rigid obstacle never wobbles.
  data=bpy.data.meshes.new('Loose hazard tape mesh');verts=[(.29+i*.019,-.075,.555-j*.045)for i in range(7)for j in range(2)];faces=[(i*2,i*2+1,i*2+3,i*2+2)for i in range(6)];data.from_pydata(verts,[],faces);tape=bpy.data.objects.new('Loose hazard tape',data);bpy.context.collection.objects.link(tape);data.materials.append(red);tapeBase=[v.co.copy()for v in data.vertices]
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.seed=2203;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=512;scene.render.resolution_y=256;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.35
 scene.camera.location=(.5,-7,1.15);scene.camera.rotation_euler=(Vector((-.03,0,.41))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=1.95
 for frame in range(8):
  phase=frame*math.tau/8
  for o,base,pivot,role in animated:
   angle=(.15 if role=='tail'else .09)*math.sin(phase+(0 if role=='tail'else .6));o.matrix_world=Matrix.Translation(pivot)@Matrix.Rotation(angle,4,'Z'if role=='tail'else'Y')@Matrix.Translation(-pivot)@base
  if kind=='shiba':
   body=bpy.data.objects.get('Shiba body');body.scale.z=.22*(1+.026*math.sin(phase+.4))
  else:
   for v,b in zip(tape.data.vertices,tapeBase):
    v.co=b;weight=(b.x-.29)/.114;v.co.y-=.032*weight*math.sin(phase-weight*1.6);v.co.z+=.009*weight*math.cos(phase+weight)
  scene.frame_set(frame+1);scene.render.filepath=str(out/f'{kind}-{frame}.png');bpy.ops.render.render(write_still=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(out/(kind+'-refined.blend')),compress=True);assert sha(path)==before
 receipt['assets'].append({'name':kind,'sourceSha256':before,'sourceUnchanged':True,'derivedSource':kind+'-refined.blend','renderHashes':[sha(out/f'{kind}-{f}.png')for f in range(8)]});print('LOOP_NATIVE',kind,flush=True)
(out/'native-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
