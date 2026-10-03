"""Small native forest-floor atlas; existing fern mesh and tree bark material reused.

Blender: -b --factory-startup --disable-autoexec --python-exit-code 1 -P SCRIPT -- OUT
Primary Python: SCRIPT --pack OUT RUNTIME
Archived sources are read-only; source PNG/.blend stay outside Git.
"""
import sys, math, random, json, hashlib
from pathlib import Path

ROOT=Path('C:/Users/just_/Desktop/Projects/LestersArcade-Assets/Tripo-Environment-Powerups/native')
SOURCES=[ROOT/'04/04 - Fern Cluster - Textured Master.blend',ROOT/'50/50 - Stylized Layered Evergreen Tree - Textured Master.blend']
NAMES=['leaf-litter','needle-bed','fern-bed','moss-root']
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def pack(out,destination):
    from PIL import Image
    import numpy as np
    atlas=Image.new('RGBA',(1024,256))
    for i,name in enumerate(NAMES):
        image=Image.open(out/f'{name}.png').convert('RGBA')
        if image.size!=(512,512):raise ValueError(f'{name}: wrong native render size')
        atlas.paste(image.resize((256,256),Image.Resampling.LANCZOS),(i*256,0))
    destination.mkdir(parents=True,exist_ok=True);files=[]
    for suffix,size in [('',(1024,256)),('@0.5x',(512,128))]:
        pixels=np.asarray(atlas.resize(size,Image.Resampling.LANCZOS)).copy();pixels[pixels[:,:,3]==0,:3]=0
        path=destination/f'forest-ground-details{suffix}.webp'
        Image.fromarray(pixels).save(path,'WEBP',lossless=True,exact=True,method=6)
        files.append({'file':path.name,'size':list(size),'bytes':path.stat().st_size,'decodedBytes':size[0]*size[1]*4,'sha256':digest(path)})
    receipt={'schema':'native-forest-floor/v1','source':'archived B1-04 fern mesh, B1-50 bark material, native leaf/needle/moss geometry','sources':[{'name':s.name,'sha256':digest(s)}for s in SOURCES],'scriptSha256':digest(Path(__file__)),'frames':NAMES,'frameSize':256,'maxHeightMetres':.18,'files':files}
    (destination/'forest-ground-details.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt))

def render(out):
    import bpy
    from mathutils import Vector
    out.mkdir(parents=True,exist_ok=True);before=[digest(s)for s in SOURCES]
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    with bpy.data.libraries.load(str(SOURCES[0]),link=False)as(src,dst):dst.objects=list(src.objects)
    fern=[o for o in dst.objects if o and o.type=='MESH']
    if not fern:raise ValueError('source fern has no mesh')
    points=[o.matrix_world@Vector(v)for o in fern for v in o.bound_box]
    low=Vector([min(v[i]for v in points)for i in range(3)]);high=Vector([max(v[i]for v in points)for i in range(3)])
    with bpy.data.libraries.load(str(SOURCES[1]),link=False)as(src,dst):dst.materials=list(src.materials)
    sourceMat=next((m for m in dst.materials if m and m.use_nodes and any(n.type=='TEX_IMAGE'and n.image for n in m.node_tree.nodes)),None)
    if not sourceMat:raise ValueError('source evergreen has no textured material')
    sourceImage=next(n.image for n in sourceMat.node_tree.nodes if n.type=='TEX_IMAGE'and n.image and 'Color_'in n.image.name)
    bark=bpy.data.materials.new('neutral-source-bark');bark.use_nodes=True
    nodes=bark.node_tree.nodes;links=bark.node_tree.links;p=nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.95
    tex=nodes.new('ShaderNodeTexImage');tex.image=sourceImage;tex.projection='BOX';tex.projection_blend=.3
    coords=nodes.new('ShaderNodeTexCoord');links.new(coords.outputs['Generated'],tex.inputs['Vector'])
    grey=nodes.new('ShaderNodeRGBToBW');links.new(tex.outputs['Color'],grey.inputs[0])
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.035,.025,.014,1);ramp.color_ramp.elements[1].color=(.28,.19,.09,1)
    links.new(grey.outputs[0],ramp.inputs[0]);links.new(ramp.outputs[0],p.inputs['Base Color'])
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'if bpy.app.version>=(5,0,0)else'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.world.color=(.18,.21,.19)
    mats=[]
    for name,c in [('ochre',(.24,.16,.065)),('umber',(.11,.075,.035)),('leaf-dark',(.075,.12,.035)),('leaf-light',(.18,.22,.07)),('ash',(.17,.17,.15)),('moss',(.08,.14,.045))]:
        m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.91;mats.append(m)
    bpy.ops.object.camera_add(location=(0,-2.6,3.2));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.02))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.75;scene.camera=camera
    for location,power,size in [((-2,-3,4),240,4),((2,1,3),95,3)]:
        bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
    patch=[]
    def mesh(name,verts,faces,mat):
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.materials.append(mat);o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);patch.append(o);return o
    def leaf(x,y,a,length,width,mat):
        ux,uy=math.cos(a),math.sin(a);vx,vy=-uy,ux;contour=[(0,0),(.18,.5),(.5,1),(.84,.62),(1,0),(.84,-.62),(.5,-1),(.18,-.5)]
        verts=[(x+ux*length*.5,y+uy*length*.5,.02)]+[(x+ux*t*length+vx*w*width,y+uy*t*length+vy*w*width,.006+math.sin(t*math.pi)*.009)for t,w in contour]
        return mesh('fallen-leaf',verts,[(0,k+1,(k+1)%8+1)for k in range(8)],mat)
    def twig(x,y,a,length):
        bpy.ops.mesh.primitive_cylinder_add(vertices=7,radius=.009,depth=length,location=(x,y,.02));o=bpy.context.object;o.rotation_euler=(math.pi/2,0,a);o.data.materials.append(bark);patch.append(o)
    for index,name in enumerate(NAMES):
        for o in patch:bpy.data.objects.remove(o,do_unlink=True)
        patch=[];rng=random.Random(22020+index)
        for n in range(210 if name=='leaf-litter'else 270 if name in ['moss-root','fern-bed']else 120):
            a=rng.uniform(0,math.tau);r=math.sqrt(rng.random())*.64;x,y=math.cos(a)*r,math.sin(a)*r*.78
            if name=='leaf-litter':leaf(x,y,a,rng.uniform(.035,.085),rng.uniform(.009,.024),mats[n%4])
            elif name=='needle-bed':
                if n%5==0:twig(x,y,a,rng.uniform(.16,.30))
                for k in range(5):leaf(x,y,a+k*.44,rng.uniform(.035,.085),.004,mats[1 if n%3 else 4])
            else:
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=rng.uniform(.013,.037),location=(x,y,.012));o=bpy.context.object;o.scale=(1.2,.85,.55);o.data.materials.append(mats[5 if n%3 else 2]);patch.append(o)
                for poly in o.data.polygons:poly.use_smooth=True
                if name=='moss-root'and n%34==0:twig(x,y,a,rng.uniform(.12,.24))
        if name=='fern-bed':
            centre=(low+high)/2;centre.z=low.z;extent=high-low
            for n in range(5):
                a=n*2.4;r=.13+(.09 if n%2 else .18);x,y=math.cos(a)*r,math.sin(a)*r*.8
                for original in fern:
                    o=original.copy();o.data=original.data.copy();scene.collection.objects.link(o)
                    # Bake the source transform into a copy; never save over the master.
                    for v in o.data.vertices:
                        p=original.matrix_world@v.co-centre;v.co=Vector((p.x*.32/max(extent.x,extent.y),p.y*.32/max(extent.x,extent.y),p.z*.18/extent.z))
                    o.matrix_world.identity();o.location=(x,y,.006);o.rotation_euler.z=a;patch.append(o)
        scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'native-forest-floor.blend'))
    if [digest(s)for s in SOURCES]!=before:raise ValueError('archive source changed')
    print('NATIVE_FOREST_FLOOR_COMPLETE')

if __name__=='__main__':
    if '--pack'in sys.argv:
        args=sys.argv[sys.argv.index('--pack')+1:];pack(Path(args[0]),Path(args[1]))
    else:
        args=sys.argv[sys.argv.index('--')+1:];render(Path(args[0]))
