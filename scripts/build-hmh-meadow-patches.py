"""Native Blender ground-hugging flora, with no paid generation or simulation code.

Blender: -b --factory-startup --disable-autoexec --python-exit-code 1 -P SCRIPT -- OUT
Primary Python: SCRIPT --pack OUT RUNTIME_DIRECTORY
Source PNGs and .blend remain in OUT outside Git; only two WebP tiers ship.
"""
import sys, math, random, json, hashlib
from pathlib import Path

NAMES = ['grass','clover','flowers','pebbles']

def pack(out, destination):
    from PIL import Image
    import numpy as np
    atlas = Image.new('RGBA',(1024,256))
    for index,name in enumerate(NAMES):
        frame = Image.open(out/f'{name}.png').convert('RGBA').resize((256,256),Image.Resampling.LANCZOS)
        atlas.paste(frame,(index*256,0))
    destination.mkdir(parents=True,exist_ok=True)
    files=[]
    for suffix,size in [('',(1024,256)),('@0.5x',(512,128))]:
        path=destination/f'meadow-ground-details{suffix}.webp'
        pixels=np.asarray(atlas.resize(size,Image.Resampling.LANCZOS)).copy()
        pixels[pixels[:,:,3]==0,:3]=0
        Image.fromarray(pixels).save(path,'WEBP',lossless=True,exact=True,method=6)
        files.append({'file':path.name,'size':list(size),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    receipt={'schema':'native-meadow-details/v1','generator':'Blender native meshes','scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'frames':NAMES,'frameSize':256,'maxPlantHeightMetres':0.16,'files':files}
    (destination/'meadow-ground-details.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt))

def render(out):
    import bpy
    from mathutils import Vector
    out.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE' if bpy.app.version >= (5,0,0) else 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.world.color=(0.23,0.25,0.21)
    materials=[]
    for name,color in [('leaf-dark',(0.06,0.16,0.025)),('leaf-mid',(0.15,0.28,0.06)),('leaf-light',(0.26,0.37,0.10)),('clover',(0.095,0.20,0.045)),('petal-ivory',(0.63,0.66,0.52)),('petal-lilac',(0.31,0.24,0.44)),('pollen',(0.34,0.26,0.08)),('stone',(0.045,0.06,0.042)),('stone-light',(0.10,0.115,0.08))]:
        mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True
        shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*color,1);shader.inputs['Roughness'].default_value=.84
        materials.append(mat)
    bpy.ops.object.camera_add(location=(0,-2.1,2.6));camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,.025))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=1.28;scene.camera=camera
    for location,power,size in [((-2,-3,4),180,4),((2,1,3),80,3)]:
        bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object
        light.data.energy=power;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
    patch=[]
    def mesh(name,vertices,faces,material):
        data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.materials.append(materials[material])
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);patch.append(obj)
        return obj
    def leaf(x,y,z,angle,length,width,material):
        ux,uy=math.cos(angle),math.sin(angle);vx,vy=-uy,ux
        contour=[(0,0),(.18,.56),(.43,1),(.72,.95),(.93,.55),(1,0),(.93,-.55),(.72,-.95),(.43,-1),(.18,-.56)]
        vertices=[(x+ux*length*.5,y+uy*length*.5,z+.019)]
        vertices.extend((x+ux*length*t+vx*width*w,y+uy*length*t+vy*width*w,z+.004+math.sin(t*math.pi)*.007) for t,w in contour)
        obj=mesh('soft-leaf',vertices,[(0,k+1,(k+1)%len(contour)+1) for k in range(len(contour))],material)
        for poly in obj.data.polygons:poly.use_smooth=True
        return obj
    for name in NAMES:
        for obj in patch:bpy.data.objects.remove(obj,do_unlink=True)
        patch=[];rng=random.Random(2200+NAMES.index(name))
        count={'grass':120,'clover':82,'flowers':70,'pebbles':22}[name]
        for n in range(count):
            angle=rng.uniform(0,math.tau);radius=math.sqrt(rng.random())*.42
            x,y=math.cos(angle)*radius,math.sin(angle)*radius*.78
            if name=='pebbles':
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=rng.uniform(.025,.07),location=(x,y,.013))
                obj=bpy.context.object;obj.scale=(1.3,rng.uniform(.7,1.2),.42);obj.rotation_euler=(.1,.1,angle);obj.data.materials.append(materials[7+n%2]);patch.append(obj)
                continue
            if name=='grass':
                for blade in range(4):
                    a=angle+blade*1.5;h=rng.uniform(.045,.16);dx,dy=math.cos(a)*.026,math.sin(a)*.026
                    mesh('blade',[(x-.005,y,0),(x+.005,y,0),(x+dx+.002,y+dy,h*.7),(x+dx*1.2,y+dy*1.2,h)],[(0,1,2),(0,2,3)],n%3)
            else:
                for k in range(3):leaf(x,y,rng.uniform(.005,.025),angle+k*math.tau/3,rng.uniform(.035,.065),.018 if name=='clover' else .012,3 if name=='clover' else n%3)
                if name=='flowers' and n%3==0:
                    z=rng.uniform(.055,.105)
                    for k in range(5):
                        a=k*math.tau/5
                        leaf(x,y,z,a,.028,.012,4 if n%2==0 else 5)
                    mesh('pollen',[(x-.006,y-.006,z+.02),(x+.006,y-.006,z+.02),(x+.006,y+.006,z+.02),(x-.006,y+.006,z+.02)],[(0,1,2,3)],6)
        scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'native-meadow-patches.blend'))
    print('NATIVE_MEADOW_BAKE_COMPLETE',str(out))

if __name__=='__main__':
    if '--pack' in sys.argv:
        args=sys.argv[sys.argv.index('--pack')+1:];pack(Path(args[0]),Path(args[1]))
    else:
        args=sys.argv[sys.argv.index('--')+1:];render(Path(args[0]))
