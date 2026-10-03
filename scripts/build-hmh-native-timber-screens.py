"""Native registered timber cover/court replacements; archive is read-only.

Blender: SCRIPT -- OUTPUT. Primary Python: SCRIPT --pack OUTPUT RUNTIME.
The 45-degree orthographic bake preserves the runtime projection y - z:
both native y and z project with the same factor, removed by common cropping.
"""
import sys,math,json,hashlib
from pathlib import Path
SOURCE=Path('C:/Users/just_/Desktop/Projects/LestersArcade-Assets/Tripo-Environment-Powerups/native/13/13 - Covered Market Stall Row - Textured Master.blend')
FRAMES=[('garden-screen','mweb-meadows-court-wall',70,260,128),('marquee-west','hashwood-river-marquee-west-post',70,90,160),('marquee-east','hashwood-river-marquee-east-post',70,90,160),('court-screen','hashwood-river-court-tall-screen',80,160,128)]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pack(out,dest):
 from PIL import Image,ImageDraw
 import numpy as np
 atlas=Image.new('RGBA',(512,256));records=[];board=Image.new('RGB',(512,300),'#435448');draw=ImageDraw.Draw(board)
 for i,(name,piece,w,d,h)in enumerate(FRAMES):
  image=Image.open(out/(name+'.png')).convert('RGBA');b=image.getchannel('A').point(lambda a:255 if a>4 else 0).getbbox()
  if not b or b[0]<2 or b[1]<2 or b[2]>image.width-2 or b[3]>image.height-2:raise ValueError(name+' native framing clipped')
  # Explicit two-pixel frame gutters survive the half resize. Each crop is
  # registered to the exact physical W and D+H extent, never a house facade.
  frame=Image.new('RGBA',(128,256));frame.paste(image.crop(b).resize((124,252),Image.Resampling.LANCZOS),(2,2));atlas.paste(frame,(i*128,0));board.paste(frame,(i*128,25),frame);draw.text((i*128+4,5),name,fill='white');records.append({'name':name,'pieceId':piece,'physicalWorldBounds':[w,d,h],'nativeCrop':list(b),'frame':[i*128,0,128,256],'gutter':2})
 files=[];dest.mkdir(parents=True,exist_ok=True)
 for suffix,size in[('',(512,256)),('@0.5x',(256,128))]:
  pixels=np.asarray(atlas.resize(size,Image.Resampling.LANCZOS)).copy();pixels[pixels[:,:,3]==0,:3]=0;file=dest/f'native-timber-screens{suffix}.webp';Image.fromarray(pixels).save(file,'WEBP',quality=95,method=6,exact=True);files.append({'file':file.name,'size':list(size),'bytes':file.stat().st_size,'decodedBytes':size[0]*size[1]*4,'sha256':sha(file)})
 receipt=json.loads((out/'native-receipt.json').read_text());receipt.update(schema='native-timber-screens/v1',frames=records,files=files,scriptSha256=sha(Path(__file__)));(dest/'native-timber-screens.json').write_text(json.dumps(receipt,indent=2)+'\n');board.save(out/'timber-contact-sheet.png');print(json.dumps(files))
def render(out):
 import bpy
 from mathutils import Vector
 before=sha(SOURCE);out.mkdir(parents=True,exist_ok=True);bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 with bpy.data.libraries.load(str(SOURCE),link=False)as(src,dst):dst.materials=list(src.materials)
 sourceMat=next(m for m in dst.materials if m and m.use_nodes and any(n.type=='TEX_IMAGE'and n.image for n in m.node_tree.nodes));images=[n.image for n in sourceMat.node_tree.nodes if n.type=='TEX_IMAGE'and n.image];image=next((im for im in images if 'Color' in im.name),images[0])
 def material(name,low,high,wood=False,metal=0):
  m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;s=n.get('Principled BSDF');s.inputs['Roughness'].default_value=.86 if not metal else .55;s.inputs['Metallic'].default_value=metal
  coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(8,8,1.3)if wood else(2.8,2.8,2.8);l.new(coord.outputs['Generated'],mapping.inputs[0]);noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=2;l.new(mapping.outputs[0],noise.inputs['Vector']);tex=n.new('ShaderNodeTexImage');tex.image=image;tex.projection='BOX';tex.projection_blend=.24;l.new(coord.outputs['Generated'],tex.inputs['Vector']);grey=n.new('ShaderNodeRGBToBW');l.new(tex.outputs['Color'],grey.inputs[0]);mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.25;l.new(noise.outputs['Fac'],mix.inputs[1]);l.new(grey.outputs[0],mix.inputs[2]);ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*low,1);ramp.color_ramp.elements[1].color=(*high,1);l.new(mix.outputs[0],ramp.inputs[0]);l.new(ramp.outputs[0],s.inputs['Base Color']);bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.018;l.new(mix.outputs[0],bump.inputs['Height']);l.new(bump.outputs[0],s.inputs['Normal']);return m
 wood=[material('Worn muted oak',(.085,.06,.037),(.31,.265,.18),True),material('Sun silvered timber',(.10,.10,.08),(.30,.29,.22),True),material('Dark sheltered joints',(.035,.029,.018),(.12,.115,.076),True)]
 stone=material('Rough footing stone',(.15,.16,.125),(.32,.33,.25));canvas=material('Source canvas muted flax',(.22,.235,.19),(.51,.51,.405));patch=material('Source canvas mended patch',(.14,.17,.15),(.31,.34,.27));iron=material('Dull straps and nails',(.025,.036,.035),(.115,.14,.12),metal=.6)
 objects=[]
 def box(name,loc,size,m,rotation=None):
  bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);b=o.modifiers.new('Eroded fitted edges','BEVEL');b.width=.022;b.segments=2
  if rotation:o.rotation_euler=rotation
  objects.append(o);return o
 def fabric(name,w,d,z,m):
  verts=[];faces=[];nx,ny=12,14
  for y in range(ny+1):
   for x in range(nx+1):
    u,v=x/nx,y/ny;verts.append(((u-.5)*w,(v-.5)*d,z-.19*abs(u-.5)*2-.09*math.sin(v*math.pi)+.018*math.sin(u*31+v*9)))
  for y in range(ny):
   for x in range(nx):i=y*(nx+1)+x;faces.append((i,i+1,i+nx+2,i+nx+1))
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(m);objects.append(o)
  for f in mesh.polygons:f.use_smooth=True
  return o
 def curtain(name,w,y,z0,z1,m):
  v=[];f=[]
  for row in range(9):
   for col in range(17):
    u,t=col/16,row/8;v.append(((u-.5)*w,y-.055*math.sin(u*math.pi*9)*(1-.35*t),z0+(z1-z0)*t+.015*math.sin(u*13)*(1-t)))
  for row in range(8):
   for col in range(16):i=row*17+col;f.append((i,i+1,i+18,i+17))
  data=bpy.data.meshes.new(name);data.from_pydata(v,[],f);o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(m);objects.append(o)
  for face in data.polygons:face.use_smooth=True
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=256;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.2;scene.world.color=(.27,.29,.25)
 bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';scene.camera=camera
 for loc,power,color in[((-8,-8,12),1900,(1,.93,.80)),((7,-3,8),950,(.79,.85,1)),((0,7,10),1300,(.89,.93,.82))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=7;o.data.color=color;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
 for index,(name,piece,W,D,H)in enumerate(FRAMES):
  for o in objects:bpy.data.objects.remove(o,do_unlink=True)
  objects=[];w,d,h=W/40,D/40,H/40
  if index in[0,3]:
   # A closed timber windbreak/storage screen with substantial capped joints,
   # recessed plank panels, restrained stone footing and diagonal front brace.
   box('Grounded stone plinth',(0,0,.12),(w*.96,d*.985,.24),stone)
   panelN=max(3,round(d/.72));pitch=d/panelN
   for y in range(panelN):
    yy=-d/2+(y+.5)*pitch
    box('Weathered panel top',(0,yy,h-.11+.012*math.sin(y*1.7)),(w*.92,pitch-.012,.15),wood[0])
    for side in[-1,1]:box('Recessed vertical board',(side*(w/2-.08),yy,h/2),(.13,pitch-.035,h-.20),wood[(y+index)%2])
   for x in[-w/2+.13,w/2-.13]:
    box('Continuous weathered top rail',(x,0,h-.08),(.14,d,.16),wood[1])
    for yy in[-d/2+.13,-d/2+d/3,d/2-d/3,d/2-.13]:
     box('Capped upright',(x,yy,h/2),(.22,.22,h),wood[0]);box('Fitted cap',(x,yy,h-.035),(.26,.26,.07),wood[1])
   for i in range(5):box('Front close board',(-w*.4+i*w*.2,-d/2+.10,h*.46),(w*.19,.15,h*.81),wood[i%2])
   box('Front upper rail',(0,-d/2+.07,h*.82),(w,.14,.16),wood[0]);box('Front lower rail',(0,-d/2+.065,.35),(w,.16,.17),wood[0]);box('Diagonal fitted brace',(0,-d/2-.006,h*.51),(w*.90,.08,.12),wood[1],(0,.75,0))
   for x in[-w*.40,w*.40]:
    for z in[.36,h*.82]:box('Iron front rivet',(x,-d/2-.025,z),(.055,.025,.055),iron)
  else:
   # The original market material language, rebuilt as a narrow covered
   # timber stand on this exact post's footprint, not a rescaled house front.
   box('Market stand footing',(0,0,.13),(w*.98,d*.98,.26),stone)
   for x in[-w/2+.10,w/2-.10]:
    for y in[-d/2+.10,d/2-.10]:box('Full height frame post',(x,y,h/2),(.18,.18,h-.04),wood[0])
   box('Fitted counter',(0,0,1.17),(w,d,.16),wood[1])
   for i in range(5):box('Counter front individual board',(-w*.40+i*w*.20,-d/2+.09,.67),(w*.18,.14,.98),wood[(i+index)%2])
   for z in[.27,1.07]:box('Counter iron tie',(0,-d/2+.008,z),(w*.97,.045,.055),iron)
   for y in[-d/2+.075,d/2-.075]:box('Canopy carrying beam',(0,y,h-.14),(w,.17,.20),wood[0])
   fabric('Patched cloth canopy',w,d,h-.02,canvas)
   # Draped backing keeps the visibly blocked mass solid under its canopy.
   curtain('Pleated cloth backing',w*.83,d/2-.10,1.25,h-.25,canvas)
   box('Cloth front valance',(0,-d/2+.03,h-.41),(w*.80,.04,.36),canvas)
   box('Mended valance patch',((-.22 if index==1 else .27)*w,-d/2+.005,h-.41),(.28,.012,.20),patch)
   # A stitched patch follows the actual canopy slope, rather than a flat
   # contrasting rectangle stamped across every panel.
   box('Mended canopy patch',((-.22 if index==1 else .22)*w,.17,h-.135),(.38,.42,.008),patch,(0,-.18 if index==1 else .18,0))
   for x in[-w*.4,w*.4]:box('Canvas peg',(x,-d/2-.005,h-.21),(.065,.065,.065),wood[1])
  target=Vector((0,0,h/2));camera.location=target+Vector((0,-15,15));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=max(w*2.2,(d+h)/math.sqrt(2)*1.12)
  scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True);bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'.blend')));print('TIMBER_NATIVE',name,flush=True)
 assert sha(SOURCE)==before;(out/'native-receipt.json').write_text(json.dumps({'sourceUnchanged':True,'source':SOURCE.name,'sourceSha256':before,'materialImage':image.name,'materialUse':'Packed market-stall texture luminance plus new muted timber/cloth palette; modeled fitted beams, panels, canvas and hardware','projection':'orthographic equal y/z scale, no camera/projection change','nativeRenders':[{'name':n,'sha256':sha(out/(n+'.png'))}for n,*_ in FRAMES]},indent=2)+'\n')
if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:]if '--'in sys.argv else sys.argv[1:]
 if args[0]=='--pack':pack(Path(args[1]),Path(args[2]))
 else:render(Path(args[0]))
