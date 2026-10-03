"""Native cartoon obstacle facades. Reuses the shipped scenery urban geometry kit.

Three fixed designs per existing town/city/suburb family, not animated frames.
Sources remain in the asset archive; only bounded alpha WebPs enter the game.
"""
import argparse, hashlib, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.dont_write_bytecode=True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from regions import urbankit as uk
from chikun_lib import kit

p=argparse.ArgumentParser();p.add_argument('--output',required=True)
opt=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(opt.output);out.mkdir(parents=True,exist_ok=True)

def material(name, color, metal=0, rough=.58, glow=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1)
 b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
 if glow:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=glow
 return m

def box(name, coll, mat, x,y,z,w,d,h, bevel=.10):
 o=kit.box(name,coll,mat,x,y,z,w,d,h)
 if bevel:
  mod=o.modifiers.new('Soft cartoon edges','BEVEL');mod.width=bevel;mod.segments=3
  o.modifiers.new('Weighted facade normals','WEIGHTED_NORMAL')
 return o

def glass_window(coll, name, x,z,w,h, frame, glass, warm, lit=False, shutters=None):
 box(name+'.recess',coll,frame,x,-3.64,z,w+.48,.22,h+.48)
 box(name+'.glass',coll,warm if lit else glass,x,-3.82,z+.12,w,.12,h-.24,.04)
 box(name+'.sill',coll,frame,x,-3.98,z-.18,w+.72,.72,.23,.07)
 box(name+'.mullion',coll,frame,x,-3.95,z+.1,.13,.10,h-.18,.015)
 box(name+'.crossbar',coll,frame,x,-3.96,z+h*.49,w,.10,.12,.015)
 if shutters:
  for side in [-1,1]:
   xx=x+side*(w*.5+.42);box(name+'.shutter',coll,shutters,xx,-3.76,z,.48,.2,h)
   for i in range(6):box(name+'.slat',coll,frame,xx,-3.89,z+.25+i*(h-.5)/6,.36,.08,.10,.01)

def shop_lettering(coll, title, x,y,z,size,mat):
 curve=bpy.data.curves.new('Integrated facade lettering','FONT');curve.body=title;curve.align_x='CENTER'
 curve.size=size;curve.extrude=.012;curve.bevel_depth=.005
 o=bpy.data.objects.new('Native shop identity '+title,curve);coll.objects.link(o)
 o.location=(x,y,z);o.rotation_euler.x=math.pi/2;curve.materials.append(mat)

def setup(name):
 bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene
 s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True;s.cycles.device='CPU'
 s.render.threads_mode='FIXED';s.render.threads=6;s.render.resolution_x=384;s.render.resolution_y=704
 s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.image_settings.file_format='PNG'
 s.render.image_settings.color_mode='RGBA';s.view_settings.view_transform='AgX'
 s.world=bpy.data.worlds.new('Cool cartoon ambient');s.world.color=(.17,.20,.24)
 target=Vector((0,0,13.6));bpy.ops.object.camera_add(location=(3.2,-40,16.2));camera=bpy.context.object
 camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO'
 camera.data.ortho_scale=30.8;s.camera=camera
 for loc,power,color in [((-15,-22,35),1700,(1,.83,.63)),((17,-14,20),1100,(.55,.81,1)),((6,12,30),2100,(.84,.94,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.size=16
  lamp.data.color=color;lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
 return s,bpy.context.scene.collection

receipts=[]
for family in ['town','city','suburb']:
 hashes=[]
 for style in range(3):
  s,coll=setup(family);rng=random.Random(family+str(style))
  cream=material('Cream stone trim',(.78,.70,.54));timber=material('Dark stained timber',(.13,.075,.045))
  teal=material('Weathered teal',(.045,.28,.27));brass=material('Warm brass details',(.65,.38,.075),.55)
  glass=material('Blue glass',(.055,.15,.23),.18,.25);warm=material('Warm window interior',(.88,.48,.16),0,.52,.3)
  roof=material('Terracotta or slate',[(.43,.16,.09),(.18,.23,.27),(.26,.095,.07)][style])
  if family=='town':
   wall=material('Town stucco',[(.71,.49,.29),(.54,.62,.52),(.66,.38,.29)][style])
   uk.tower(coll,'Cafe facade',0,0,12,7,26,wall,cream,rng)
   box('Stone shop plinth',coll,cream,0,-.08,0,12.2,7.16,.85)
   for z in [7.9,17.8,25.7]:box('Carved cornice',coll,cream,0,-.10,z,12.4,7.2,.35)
   for x in [-3.05,3.05]:
    glass_window(coll,'Upper sash',x,19.25,2.7,4.3,cream,glass,warm,style%2==0,teal)
    glass_window(coll,'Middle sash',x,10.55,2.7,4.7,cream,glass,warm,False,teal)
   for x in [-3.4,3.4]:glass_window(coll,'Storefront',x,1.6,3.5,4.6,timber,glass,warm,True)
   box('Shop door',coll,timber,0,-3.70,.75,2.35,.3,5.45)
   box('Door glazing',coll,glass,0,-3.90,2.3,1.7,.08,3.1)
   box('Door brass handle',coll,brass,.71,-4.05,2.85,.10,.16,.70,.03)
   striped=uk.stripe_material('Canvas awning stripe',teal.diffuse_color,cream.diffuse_color,width=.68)
   uk.awning(coll,striped,0,-3.65,8.4,11.65,1.4,.85)
   box('Awning front scallop',coll,teal,0,-5.08,7.3,11.7,.19,.6)
   box('Inset brass sign',coll,brass,0,-3.86,8.95,8.4,.22,1.02)
   box('Sign dark inset',coll,teal,0,-4.02,9.09,7.96,.12,.73)
   shop_lettering(coll,['LITE CAFE','ARCADE','POST'][style],0,-4.095,9.19,.61,cream)
   for x in [-5.3,5.3]:box('Corner dressed stone',coll,cream,x,-3.67,1,1.0,.20,24.7)
  elif family=='city':
   steel=material('City blue-grey metal',[(.13,.23,.30),(.20,.26,.33),(.19,.30,.32)][style],.24)
   uk.tower(coll,'City block',0,0,12,7,26,steel,cream,rng)
   for z in [0,7.5,14.5,21.5,25.7]:box('Horizontal stone ledge',coll,cream,0,-.06,z,12.3,7.2,.34)
   for x in [-5.5,-1.85,1.85,5.5]:box('Vertical metal pilaster',coll,teal,x,-3.64,.40,.25,.2,25.0,.03)
   for row,z in enumerate([8.4,15.4,22.3]):
    for col,x in enumerate([-3.68,0,3.68]):glass_window(coll,'City window',x,z,2.35,2.75,steel,glass,warm,(row+col+style)%4==0)
   box('Ground entry surround',coll,cream,0,-3.72,.75,3.5,.27,5.8)
   box('Entry glass',coll,glass,0,-3.91,.95,2.95,.11,5.27)
   for x in [-3.8,3.8]:glass_window(coll,'Bank storefront',x,1.2,2.85,4.7,steel,glass,warm,False)
   box('Entrance canopy',coll,teal,0,-4.14,6.85,6.0,2.3,.32)
   shop_lettering(coll,['LITE BANK','EXCHANGE','HODL INC'][style],0,-5.31,6.87,.24,cream)
   for x in [-2.3,2.3]:box('Canopy brass edge',coll,brass,x,-5.17,6.91,.15,.18,.14,.025)
   for row in range(12):
    for x in [-5.83,5.83]:box('Corner block joint',coll,steel,x,-3.61,1+row*2,.27,.16,.08,.01)
  else:
   wall=material('Suburban painted siding',[(.70,.58,.38),(.38,.54,.57),(.67,.40,.31)][style])
   # Reuse the same authored gable kit as the scenery. Porch and windows stay
   # inside the base footprint, so the whole sheet uses one collision rectangle.
   uk.townhouse(coll,'Suburban home',0,0,12,7,21.5,wall,roof,rng,style='front',roof_h=5.8)
   for z in [1+i*.95 for i in range(22)]:box('Horizontal siding lap',coll,cream,0,-3.57,z,11.9,.11,.08,.01)
   for x in [-5.5,5.5]:box('House cornerboard',coll,cream,x,-3.64,.7,.42,.22,20.7,.025)
   for x in [-3.05,3.05]:glass_window(coll,'Upstairs casement',x,13.0,2.9,5.15,cream,glass,warm,False,teal)
   glass_window(coll,'Porch window',-3.1,3.8,3.5,4.55,cream,glass,warm,True,teal)
   box('Front door surround',coll,cream,2.30,-3.75,1.0,2.6,.2,7.2)
   box('Front door',coll,teal,2.30,-3.91,1.18,2.15,.14,6.80)
   box('Door glass pane',coll,warm,2.30,-4.0,5.45,1.42,.07,1.75)
   box('Door knob',coll,brass,3.00,-4.15,4,.17,.15,.17,.06)
   box('Porch step',coll,cream,2.3,-3.94,.20,3.9,1.2,.58)
   box('Porch awning',coll,roof,2.3,-3.90,8.30,4.0,1.5,.30)
   box('Gable vent',coll,teal,0,-3.62,22.6,1.70,.14,1.65)
   for i in range(5):box('Vent slats',coll,cream,0,-3.72,22.70+i*.28,1.40,.08,.08,.01)
  # Sparsely authored material wear, not high-frequency phone noise.
  for i in range(8):box('Facade patched wear',coll,cream,-5.4+(i%2)*10.8,-3.64,.9+i*2.7,.21,.08,.12,.015)
  s.render.filepath=str(out/(family+'-'+str(style)+'.png'));bpy.ops.render.render(write_still=True)
  source=out/(family+'-'+str(style)+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
  hashes.append(hashlib.sha256(source.read_bytes()).hexdigest());print('FACADE_BAKED',family,style,flush=True)
 receipts.append({'name':family,'frames':3,'columns':3,'variation':'static-designs','sourceSha256':hashlib.sha256(''.join(hashes).encode()).hexdigest()})
(out/'native-receipt.json').write_text(json.dumps({'schema':'chikun-building-kit-native-v1','assets':receipts},indent=2))
