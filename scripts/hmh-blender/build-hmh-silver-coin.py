"""Native silver coin, 12 fixed spin frames. Run inside Blender 5.1.2."""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'apps/portal/assets/generated/hmh-silver-coin'
SOURCE=ROOT/'assets-source/hmh-silver-coin'
RAW=ROOT/'work/silver-coin-frames'
for p in (OUT,SOURCE,RAW):p.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=96;scene.render.resolution_y=96;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.dither_intensity=0
scene.world.color=(.18,.18,.18)
scene.view_settings.view_transform='Standard'
def material(name,color,metallic,roughness):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=roughness;return m
silver=material('Brushed silver',(.68,.74,.80),.75,.28)
dark=material('Engraved silver',(.065,.085,.11),.4,.4)
coin=bpy.data.objects.new('Silver Litecoin collectible',None);scene.collection.objects.link(coin)
bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1,depth=.17,rotation=(math.pi/2,0,0))
body=bpy.context.object;body.name='Milled silver coin';body.parent=coin;body.data.materials.append(silver)
bevel=body.modifiers.new('Soft rim','BEVEL');bevel.width=.045;bevel.segments=3
body.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
for front in (True,False):
    y=-.093 if front else .093
    bpy.ops.mesh.primitive_torus_add(major_radius=.86,minor_radius=.018,major_segments=64,minor_segments=8,location=(0,y,0),rotation=(math.pi/2,0,0))
    rim=bpy.context.object;rim.parent=coin;rim.data.materials.append(dark)
    bpy.ops.object.text_add(location=(0,y+(-.008 if front else .008),-.045),rotation=(math.pi/2,0,0 if front else math.pi))
    text=bpy.context.object;text.name='Litecoin face';text.parent=coin;text.data.body='Ł';text.data.align_x='CENTER';text.data.align_y='CENTER';text.data.size=1.5;text.data.extrude=.008;text.data.materials.append(dark)
for i in range(40):
    a=i*math.tau/40
    bpy.ops.mesh.primitive_cube_add(size=1,location=(math.sin(a)*.992,0,math.cos(a)*.992))
    edge=bpy.context.object;edge.parent=coin;edge.scale=(.012,.13,.026);edge.rotation_euler.y=a;edge.data.materials.append(dark)
bpy.ops.object.camera_add(location=(0,-6,3.1))
camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.55;scene.camera=camera
for name,pos,power,size in [('Key',(-3,-4,5),500,4),('Rim',(3,2,4),700,3),('Fill',(2,-3,1),220,3)]:
    bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'silver-litecoin.blend'))
width,height=576,192;pixels=[0.]*(width*height*4)
for frame in range(12):
    coin.rotation_euler.z=frame*math.tau/12;scene.render.filepath=str(RAW/f'{frame:02}.png');bpy.ops.render.render(write_still=True)
    image=bpy.data.images.load(scene.render.filepath,check_existing=False);data=list(image.pixels);col=frame%6;row=frame//6
    # Blender stores rows bottom-up. Row zero is the top of the exported atlas.
    for y in range(96):
        start=((1-row)*96+y)*width*4+col*96*4;pixels[start:start+96*4]=data[y*96*4:(y+1)*96*4]
    bpy.data.images.remove(image)
atlas=bpy.data.images.new('Silver coin atlas',width=width,height=height,alpha=True);atlas.pixels=pixels;atlas.filepath_raw=str(OUT/'silver-coin.png');atlas.file_format='PNG';atlas.save()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'schema':1,'kind':'cosmetic-game-collectible','scoreXpAuthority':'none','blenderVersion':bpy.app.version_string,'frameSize':96,'columns':6,'frames':12,'image':'silver-coin.png','imageSha256':sha(OUT/'silver-coin.png'),'source':'assets-source/hmh-silver-coin/silver-litecoin.blend','sourceSha256':sha(SOURCE/'silver-litecoin.blend'),'recipe':'scripts/hmh-blender/build-hmh-silver-coin.py','recipeSha256':sha(Path(__file__))}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('SILVER_COIN_COMPLETE',json.dumps(manifest))
