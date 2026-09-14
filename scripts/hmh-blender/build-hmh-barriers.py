"""Native Level 1 barrier library. Blender source and repeat-rendered views."""
import bpy, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets-source/hmh-barriers/barrier-library.blend'
RAW=ROOT/'work/barrier-frames'
SOURCE.parent.mkdir(parents=True,exist_ok=True);RAW.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.dither_intensity=0
scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('Overcast quarry daylight');scene.world.color=(.22,.24,.27)

def mat(name,color,metal=0,rough=.7):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=12;noise.inputs['Detail'].default_value=3
    bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.2;bump.inputs['Distance'].default_value=.055
    m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m
stone=[mat('Granite course '+str(i),(.28+i*.032,.30+i*.027,.26+i*.023)) for i in range(5)]
concrete=mat('Aged concrete',(.43,.46,.43));dark=mat('Dark recesses',(.07,.085,.075))
wood=[mat('Weathered oak '+str(i),(.19+i*.045,.105+i*.023,.044+i*.016)) for i in range(4)]
steel=mat('Galvanized steel',(.36,.43,.48),.75,.36);rust=mat('Oxidized joints',(.24,.085,.033),.35)
blue=mat('Litecoin enamel',(.04,.25,.48),.15,.32);silver=mat('Silver lettering',(.75,.80,.83),.6,.3)
sandstone=[mat('Quarry strata '+str(i),(.25+i*.035,.12+i*.024,.07+i*.018)) for i in range(5)]
kinds=['stone-wall','concrete-wall','concrete-barrier','wood-fence','steel-fence','rock-formation','boulders']
roots={};collections={};active=None;root=None
def own(ob,material):
    for c in list(ob.users_collection):c.objects.unlink(ob)
    active.objects.link(ob);ob.parent=root;ob.data.materials.append(material);return ob
def box(name,pos,size,material,bevel=.05):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=own(bpy.context.object,material);o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Worn edges','BEVEL');b.width=bevel;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def rod(name,a,b,r,material):
    a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=own(bpy.context.object,material);o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def plaque(z=2.4):
    box('Blue Litecoin identification plate',(0,-1.012,z),(1.25,.075,.75),blue,.04)
    bpy.ops.object.text_add(location=(0,-1.059,z-.23),rotation=(math.pi/2,0,0));o=own(bpy.context.object,silver);o.name='Raised Litecoin mark';o.data.body='Ł';o.data.align_x='CENTER';o.data.size=.68;o.data.extrude=.012
def rock(name,pos,size,material,seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=pos);o=own(bpy.context.object,material);o.name=name
    rng=random.Random(seed)
    for v in o.data.vertices:
        v.co*=.9+rng.random()*.16
        v.co.x*=size[0];v.co.y*=size[1];v.co.z*=size[2]
    bevel=o.modifiers.new('Fractured edge softness','BEVEL');bevel.width=.035;bevel.segments=1
for k in kinds:
    active=bpy.data.collections.new(k);scene.collection.children.link(active);collections[k]=active
    root=bpy.data.objects.new(k+'-root',None);active.objects.link(root);roots[k]=root
    if k=='stone-wall':
        box('Mortar bed',(0,0,1.8),(3.94,1.85,3.5),dark)
        for row in range(4):
            for col in range(4):
                x=-1.5+col;z=.45+row*.86
                o=box('Individual ashlar block',(x,0,z),(.96,1.97,.81),stone[(row*3+col)%5],.08)
                o.rotation_euler.z=((row+col)%3-1)*.01
        box('Coping stone',(0,0,3.7),(4,2, .4),stone[3],.075)
    elif k=='concrete-wall':
        box('Concrete panel',(0,0,1.9),(4,2,3.8),concrete,.095)
        for x in [-1.45,1.45]:
            for z in [.65,2.95]:box('Formwork tie recess',(x,-1.005,z),(.13,.035,.13),dark,.02)
        box('Rain cap',(0,0,3.9),(4,2,.16),stone[3],.04);plaque()
    elif k=='concrete-barrier':
        # Closed Jersey profile, broad foot and narrower crown.
        cross=[(-1,0),(1,0),(1,.35),(.40,1.65),(.30,3.8),(-.30,3.8),(-.40,1.65),(-1,.35)]
        verts=[(x,y,z) for x in [-2,2] for y,z in cross];faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
        mesh=bpy.data.meshes.new('Jersey barrier closed mesh');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Concrete Jersey barrier',mesh);active.objects.link(o);o.parent=root;o.data.materials.append(concrete)
        b=o.modifiers.new('Chipped edges','BEVEL');b.width=.075;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
        for x in [-1.3,1.3]:box('Reflective blue marker',(x,-.32,2.85),(.46,.045,.42),blue,.025)
        rod('Lifting eye',(-.25,0,3.82),(.25,0,3.82),.06,steel)
    elif k=='wood-fence':
        for x in [-1.77,1.77]:box('Square timber post',(x,0,1.95),(.45,1.3,3.9),wood[1],.045)
        for z in [1,2.75]:box('Rear cross rail',(0,.32,z),(4,.30,.28),wood[0],.025)
        for i in range(7):
            x=-1.65+i*.55;top=3.6+(i%3)*.08
            box('Uneven oak paling',(x,-.25,top/2),(.49,.34,top),wood[i%4],.04)
            for z in [1,2.75]:box('Iron nail',(x,-.435,z),(.065,.025,.065),rust,.01)
    elif k=='steel-fence':
        for x in [-1.85,1.85]:rod('Galvanized post',(x,0,0),(x,0,4),.14,steel)
        for z in [.3,3.7]:rod('Welded frame',(-1.85,0,z),(1.85,0,z),.10,steel)
        for x in [i*.4 for i in range(-4,5)]:rod('Vertical fence bar',(x,0,.35),(x,0,3.65),.035,steel)
        for z in [.7,1.5,2.3,3.1]:rod('Wire crossbar',(-1.8,0,z),(1.8,0,z),.027,steel)
        box('Blue access plate',(0,-.1,2.2),(.7,.05,.5),blue,.02)
    elif k=='rock-formation':
        for i in range(4):rock('Layered quarry rock',((i%2-.5)*1.35,0,.48+i*.55),(1.3,.99,.72),sandstone[i],i+31)
    else:
        rock('Large granite boulder',(-.68,0,1.05),(1.3,1,1.13),stone[1],58)
        rock('Split companion boulder',(.91,.05,.73),(1.01,.9,.8),stone[3],96)

bpy.ops.object.camera_add(location=(0,-9,10.4));camera=bpy.context.object;camera.name='Barrier camera'
camera.rotation_euler=(Vector((0,0,1.4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=8;scene.camera=camera
for name,pos,power,size in [('Key',(-5,-7,10),1400,7),('Fill',(6,-1,7),950,6),('Rim',(0,5,9),1200,5)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
for k,c in collections.items():c.hide_render=k!='stone-wall'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
rows=[]
for repeat in ['A','B']:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE));scene=bpy.context.scene
    for k in kinds:
        for other in kinds:bpy.data.collections[other].hide_render=other!=k
        for direction in range(4):
            # The boulder choke follows the authored 240-by-60 diagonal.
            yaw=math.atan2(1,4) if k=='boulders' and direction==0 else direction*math.pi/4
            bpy.data.objects[k+'-root'].rotation_euler.z=-yaw
            folder=RAW/repeat;folder.mkdir(exist_ok=True)
            scene.render.filepath=str(folder/f'{k}-{direction}.png');bpy.ops.render.render(write_still=True)
            if repeat=='A':
                ground=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
                rows.append({'assetId':f'hmh-barrier-{k}-{direction}','kind':k,'direction':direction,'yawRadians':yaw,'file':f'{k}-{direction}.png','anchor':{'x':ground.x,'y':1-ground.y},'runtimeScale':8/256,'projectionY':math.sqrt(2)})
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(RAW/'source.json').write_text(json.dumps({'schema':'hmh-barriers/v1','source':str(SOURCE.relative_to(ROOT)).replace('\\','/'),'sourceSha256':sha(SOURCE),'recipeSha256':sha(Path(__file__)),'blenderVersion':bpy.app.version_string,'frames':rows},indent=2)+'\n')
print('NATIVE_BARRIERS_RENDERED',flush=True)
