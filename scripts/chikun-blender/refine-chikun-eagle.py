"""Refine the existing native eagle; render an eight-pose presentation atlas source."""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

args=argparse.ArgumentParser();args.add_argument('--source',required=True);args.add_argument('--output',required=True)
opt=args.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(opt.source);out=Path(opt.output)
before=hashlib.sha256(source.read_bytes()).hexdigest();out.mkdir(parents=True,exist_ok=False)
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
scene=bpy.context.scene
def material(name,color,roughness=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=roughness
    return m
brown=material('Eagle umber plumage',(.115,.067,.035));edge=material('Warm flight feather edges',(.22,.135,.075))
ivory=material('Warm ivory head and tail',(.82,.80,.69));gold=material('Horn gold',(.56,.30,.035),.4)
dark=material('Eye and beak seam',(.008,.006,.004),.3);iris=material('Amber iris',(.52,.34,.065),.3)
def ellipsoid(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
def mesh(name,verts,faces,mat):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(mat);return o
def feather(name,base,tip,width,mat,depth=.006):
    # A shallow ridged vane, broad at its middle and tapering to an actual tip.
    a,b=Vector(base),Vector(tip);axis=b-a;side=Vector((-axis.z,0,axis.x)).normalized();verts=[]
    for i in range(9):
        t=i/8;center=a+axis*t;w=width*math.sin(math.pi*t)**.65
        verts += [tuple(center-side*w),tuple(center+Vector((0,-depth*math.sin(math.pi*t),0))),tuple(center+side*w)]
    faces=[]
    for i in range(8):
        k=i*3;faces.extend([(k,k+3,k+4,k+1),(k+1,k+4,k+5,k+2)])
    return mesh(name,verts,faces,mat)
for o in list(bpy.data.objects):
    if o.type=='MESH' and (o.name.startswith('Layered flight feather') or o.name.startswith('Pointed beak') or o.name=='Eye'):
        bpy.data.objects.remove(o,do_unlink=True)
body=bpy.data.objects.get('Bird body');body.data.materials.clear();body.data.materials.append(brown)
head=bpy.data.objects.get('Bird head');head.data.materials.clear();head.data.materials.append(ivory)
head.scale=(.125,.105,.108)
# Neck ruff overlaps the body organically; silhouette remains within the existing sprite footprint.
ellipsoid('White neck ruff',(-.23,0,.48),(.135,.125,.115),ivory)
for i in range(6):
    feather('Neck contour '+str(i),(-.245+i*.012,-.117,.51),(-.12+i*.005,-.10,.42+i*.011),.018,ivory)
mesh('Hooked upper beak',[(-.40,-.045,.535),(-.40,.04,.535),(-.535,-.01,.495),(-.52,-.018,.443),(-.477,-.022,.479),(-.40,-.044,.482)],[(0,1,2),(0,2,3,4,5),(1,5,4,3,2),(0,5,1)],gold)
mesh('Lower mandible',[(-.405,-.032,.482),(-.475,-.016,.474),(-.43,-.026,.461),(-.40,.025,.478)],[(0,1,2),(0,3,1),(1,3,2)],gold)
ellipsoid('Amber eye',(-.351,-.099,.537),(.018,.012,.016),iris)
ellipsoid('Focused pupil',(-.355,-.109,.537),(.008,.004,.010),dark)
ellipsoid('Eye catchlight',(-.359,-.113,.543),(.0024,.001,.0024),ivory)
mesh('Swept eye brow',[(-.383,-.103,.565),(-.307,-.106,.568),(-.325,-.118,.547),(-.372,-.117,.55)],[(0,1,2,3)],ivory)
for i in range(7):
    feather('White tail vane '+str(i),(.24,-.03+i*.01,.445),(.60,-.07+i*.023,.43+(i-3)*.014),.023,ivory)
wing_objects=[]
for side in [1,-1]:
    y=side*.11
    wing=mesh('Wing shoulder '+str(side),[(-.11,y,.51),(.05,y,.73),(.22,y,.77),(.34,y,.53),(.20,y,.49)],[(0,1,2,3,4)],brown);wing_objects.append((wing,side))
    for i in range(9):
        o=feather('Broad primary '+str(side)+' '+str(i),(-.02+i*.029,y-.004,.57+i*.012),(.20+i*.046,y-.008,.90-i*.045),.035,edge if i%3==0 else brown)
        wing_objects.append((o,side))
    for i in range(7):
        o=feather('Layered covert '+str(side)+' '+str(i),(-.09+i*.035,y-.015,.53),(.04+i*.039,y-.02,.72-i*.012),.032,edge if i%2==0 else brown)
        wing_objects.append((o,side))
for i in range(11):
    feather('Breast contour '+str(i),(-.16+i*.035,-.153,.49),(-.08+i*.034,-.143,.425),.015,edge if i%3==0 else brown)
ellipsoid('Folded talon',(.18,-.075,.33),(.07,.018,.016),gold)
for i in range(3):
    feather('Claw '+str(i),(.19+i*.016,-.092,.337),(.23+i*.016,-.095,.31),.005,dark)
bpy.context.view_layer.update();bases={o.name:o.matrix_world.copy() for o,_ in wing_objects}
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=512;scene.render.resolution_y=256;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'eagle-refined.blend'),compress=True)
frames=[];pivot=Vector((-.06,0,.50))
for index in range(8):
    for o,side in wing_objects:
        angle=math.sin(index*math.tau/8+(0 if side<0 else .18))*.62
        o.matrix_world=Matrix.Translation(pivot)@Matrix.Rotation(angle,4,'Y')@Matrix.Translation(-pivot)@bases[o.name]
    bpy.context.view_layer.update();file=out/f'{index:02}.png';scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
    frames.append({'frame':index,'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()});print('EAGLE_POSE',index,flush=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before,'Original source changed'
(out/'source-note.json').write_text(json.dumps({'sourceSha256':before,'sourceUnchanged':True,'derivedSource':'eagle-refined.blend','frames':frames,'scope':'Presentation-only existing eagle refinement; no collision/course changes'},indent=2))
