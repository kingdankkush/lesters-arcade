import bpy,math
from mathutils import Matrix,Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'ground-prop-motion';OUT.mkdir(exist_ok=True)
for name in ['shiba','hawk','eagle','pelican']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'apps/chikun/assets/source/ground-sky'/(name+'.blend')));s=bpy.context.scene;s.cycles.samples=8
 objects=[o for o in bpy.data.objects if o.type=='MESH'];originals={o.name:o.matrix_world.copy() for o in objects}
 for i in range(8):
  t=i/8;wave=math.sin(t*math.tau)
  for k,o in enumerate(objects):
   m=originals[o.name];o.matrix_world=m
   if name=='shiba':
    if o.name.startswith(('Running leg','Paw')):o.location.x+=math.sin(t*math.tau+(k%2)*math.pi)*.065;o.location.z+=max(0,math.cos(t*math.tau+(k%2)*math.pi))*.025
    if o.name.startswith('Shiba alert head'):o.rotation_euler.y=wave*.075
   elif o.name.startswith('Layered flight feather'):
    pivot=Vector((.02,0,.48));o.matrix_world=Matrix.Translation(pivot)@Matrix.Rotation(wave*.75,4,'Y')@Matrix.Translation(-pivot)@m
   for prop in ['location','rotation_euler','scale']:o.keyframe_insert(prop,frame=i+1)
  s.render.filepath=str(OUT/f'{name}-{i}.png');bpy.ops.render.render(write_still=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'apps/chikun/assets/source/ground-sky'/(name+'-motion.blend')),compress=True)
