"""Native Ridge cliff modules using the archived sandstone's packed colour texture.

Blender: -b --factory-startup --disable-autoexec -P SCRIPT -- OUTPUT
Primary Python: SCRIPT --pack OUTPUT RUNTIME
The archive is read-only. Native scenes and renders stay outside Git.
"""
import sys, math, random, json, hashlib
from pathlib import Path

SOURCE = Path('C:/Users/just_/Desktop/Projects/LestersArcade-Assets/Tripo-Environment-Powerups/native/42/42 - Stylized Layered Sandstone Rock Formation - Textured Master.blend')
NAMES = ['fractured','shelves','weathered','talus','lip','foot']
FRAMES = [(0,0,512,192),(512,0,512,192),(0,192,512,192),(512,192,512,192),(0,384,512,128),(512,384,512,128)]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def pack(out, destination):
    from PIL import Image
    import numpy as np
    atlas=Image.new('RGBA',(1024,512))
    for name,(x,y,w,h) in zip(NAMES,FRAMES):
        image=Image.open(out/f'{name}.png').convert('RGBA')
        if image.size!=(w,h): raise ValueError(f'{name}: wrong native dimensions')
        atlas.paste(image,(x,y))
    destination.mkdir(parents=True,exist_ok=True)
    files=[]
    for suffix,size in [('',(1024,512)),('@0.5x',(512,256))]:
        image=atlas.resize(size,Image.Resampling.LANCZOS)
        pixels=np.asarray(image).copy();pixels[pixels[:,:,3]==0,:3]=0
        path=destination/f'ridge-cliff-kit{suffix}.webp'
        Image.fromarray(pixels).save(path,'WEBP',quality=92,method=6,exact=True)
        files.append({'file':path.name,'size':list(size),'bytes':path.stat().st_size,'decodedBytes':size[0]*size[1]*4,'sha256':digest(path)})
    receipt={'schema':'native-ridge-cliff-kit/v1','source':'archived B1-42 sandstone packed colour image + native fractured geometry','sourceSha256':digest(SOURCE),'scriptSha256':digest(Path(__file__)),'blender':'5.1.2','frames':[{ 'name':n,'rect':list(f)} for n,f in zip(NAMES,FRAMES)],'files':files}
    (destination/'ridge-cliff-kit.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt))

def render(out):
    import bpy
    from mathutils import Vector
    out.mkdir(parents=True,exist_ok=True)
    before=digest(SOURCE)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    with bpy.data.libraries.load(str(SOURCE),link=False) as (source,destination):
        destination.materials=list(source.materials)
    colour=next(node.image for mat in destination.materials if mat and mat.use_nodes for node in mat.node_tree.nodes if node.type=='TEX_IMAGE' and node.image and 'Color_' in node.image.name)
    # The source's warm rock colour carries real surface detail. Neutralise its
    # red hue for Ridge's grey/ochre palette; never rewrite the archive material.
    mat=bpy.data.materials.new('Ridge-source-stone');mat.use_nodes=True
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=.9
    coords=nodes.new('ShaderNodeTexCoord');texture=nodes.new('ShaderNodeTexImage');texture.image=colour;texture.projection='BOX';texture.projection_blend=.25
    links.new(coords.outputs['Generated'],texture.inputs['Vector'])
    grey=nodes.new('ShaderNodeRGBToBW');links.new(texture.outputs['Color'],grey.inputs[0])
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.08;ramp.color_ramp.elements[0].color=(.045,.055,.056,1)
    ramp.color_ramp.elements[1].position=.72;ramp.color_ramp.elements[1].color=(.62,.56,.43,1)
    links.new(grey.outputs[0],ramp.inputs[0]);links.new(ramp.outputs[0],shader.inputs['Base Color'])
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=28;noise.inputs['Detail'].default_value=2
    links.new(coords.outputs['Generated'],noise.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.016
    links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],shader.inputs['Normal'])
    dark=mat.copy();dark.name='Ridge-deep-joints';dark.node_tree.nodes.get(ramp.name).color_ramp.elements[1].color=(.21,.23,.21,1)
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE' if bpy.app.version>=(5,0,0) else 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_percentage=100;scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.world.color=(.18,.20,.22)
    bpy.ops.object.camera_add(location=(0,-6,1.2));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=5.4;scene.camera=camera
    for pos,power,size in [((-3,-4,6),850,4),((4,-2,3),230,5)]:
        bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=power;light.data.size=size
        light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
    patches=[]
    def block(x,z,width,height,depth,rng,material=mat,y=0):
        # Jagged heptagonal outcrops and angled fracture planes avoid the
        # rectangular block courses that made the first bake read as masonry.
        contour=[(-.54,-.23),(-.46,.30),(-.15,.54),(.39,.46),(.56,.06),(.36,-.42),(-.16,-.53)]
        corners=[]
        for iy in [-1,1]:
            corners.extend((x+px*width+rng.uniform(-.07,.07)*width,y+iy*depth*.5+rng.uniform(-.04,.04),z+pz*height+rng.uniform(-.08,.08)*height) for px,pz in contour)
        # A slightly proud interior ridge makes broad rock faces catch the key.
        corners.append((x+width*.07,y-depth*.5-.045,z+height*.07))
        faces=[(14,(k+1)%7,k) for k in range(7)]+[tuple(range(7,14))]+[(k,(k+1)%7,(k+1)%7+7,k+7) for k in range(7)]
        mesh=bpy.data.meshes.new('fractured-bed');mesh.from_pydata(corners,[],faces)
        mesh.materials.append(material);obj=bpy.data.objects.new('Ridge-slab',mesh);scene.collection.objects.link(obj);patches.append(obj)
        bevel=obj.modifiers.new('chipped-edge','BEVEL');bevel.width=min(.028,height*.12);bevel.segments=1
        return obj
    for index,name in enumerate(NAMES):
        for obj in patches:bpy.data.objects.remove(obj,do_unlink=True)
        patches=[];rng=random.Random(22030+index)
        if index<4:
            rowheight=[.56,.78,.42,.65][index]
            z=-.24
            while z<2.65:
                height=rowheight*rng.uniform(.72,1.24);x=-3.8
                while x<3.8:
                    width=rng.uniform(.65,1.65)*(1.15 if index==1 else 1)
                    block(x+width*.5,z+height*.5+rng.uniform(-.08,.08),width*1.18,height*rng.uniform(1.0,1.3),rng.uniform(.3,.6),rng,y=rng.uniform(-.14,.14))
                    x+=width
                z+=height
            block(0,1.2,8,3,.05,rng,dark,y=.30)
            camera.location=(0,-6,1.2);target=Vector((0,0,1.2));scene.render.resolution_x=512;scene.render.resolution_y=192
        else:
            for n in range(26 if name=='lip' else 60):
                x=-3.5+n*7/(25 if name=='lip' else 59)
                width=rng.uniform(.16,.34) if name=='lip' else rng.uniform(.10,.29)
                block(x,rng.uniform(.015,.04),width,rng.uniform(.10,.18) if name=='lip' else rng.uniform(.035,.10),rng.uniform(.16,.34),rng,y=rng.uniform(-.06,.06) if name=='lip' else rng.uniform(-.26,.26))
            camera.location=(0,-4,3.2);target=Vector((0,0,.025));scene.render.resolution_x=512;scene.render.resolution_y=128
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        # Separate reconstructible scenes provide a native source for every frame.
        bpy.ops.wm.save_as_mainfile(filepath=str(out/f'{name}.blend'))
        scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)
        print('RIDGE_FRAME_DONE',name)
    if digest(SOURCE)!=before: raise RuntimeError('archive changed')

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    if args and args[0]=='--pack':pack(Path(args[1]),Path(args[2]))
    else:render(Path(args[0]))
