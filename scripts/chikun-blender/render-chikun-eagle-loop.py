"""Eight unsaved native eagle wing poses using the immutable existing model."""
import hashlib,json,math,sys
from pathlib import Path
import bpy
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from chikun_native_transforms import capture_native_transforms,restore_native_transforms
SOURCE=ROOT/'apps/chikun/assets/source/ground-sky/eagle.blend'
EXPECTED='375640a1d171f7a4b17e618098a9a5860ea08e2cf4f5934227a3e5475e99c4af'
OUT=ROOT/'.tmp/chikun-obstacle-loop/eagle-render-v2'
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def identity(objects):
 return hashlib.sha256(json.dumps([{'name':o.name,'matrix':[list(row)for row in o.matrix_world],'positions':[list(v.co)for v in o.data.vertices],'faces':[list(p.vertices)for p in o.data.polygons],'materials':[m.name if m else None for m in o.data.materials]}for o in sorted(objects,key=lambda obj:obj.name)],separators=(',',':')).encode()).hexdigest()
if OUT.exists() or sha(SOURCE)!=EXPECTED:raise RuntimeError('Immutable eagle source changed or literal render lane already exists')
OUT.mkdir(parents=True)
record={'schema':'chikun-eagle-loop-native-v1','source':SOURCE.relative_to(ROOT).as_posix(),'sourceSha256':EXPECTED,'scope':'Eight unsaved presentation poses, original camera/materials/light, two CPU threads; no source save, simulation or runtime admission','runtimeAdmission':False,'frames':[],'restored':False}
objects=[];originals={};native_transforms=None
try:
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False,use_scripts=False)
 bpy.context.view_layer.update()
 scene=bpy.context.scene;objects=[o for o in bpy.data.objects if o.type=='MESH'];originals={o.name:o.matrix_world.copy()for o in objects};native_transforms=capture_native_transforms(objects);record['meshIdentityBefore']=identity(objects)
 feathers=[o for o in objects if o.name.startswith('Layered flight feather')]
 if len(feathers)!=16 or not scene.camera or scene.camera.data.type!='ORTHO':raise RuntimeError('Reviewed native eagle feather/camera contract changed')
 record['featherCount']=len(feathers);record['camera']={'matrix':[list(row)for row in scene.camera.matrix_world],'orthographicScale':scene.camera.data.ortho_scale}
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=512;scene.render.resolution_y=256;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
 pivot=Vector((.02,0,.48))
 for index in range(8):
  restore_native_transforms(objects,native_transforms)
  angle=math.sin(index*math.tau/8)*.65
  for obj in feathers:obj.matrix_world=Matrix.Translation(pivot)@Matrix.Rotation(angle,4,'Y')@Matrix.Translation(-pivot)@originals[obj.name]
  bpy.context.view_layer.update();file=OUT/f'{index:02}.png';scene.render.filepath=str(file);bpy.ops.render.render(write_still=True);record['frames'].append({'frame':index,'wingAngle':angle,'file':file.name,'bytes':file.stat().st_size,'sha256':sha(file)});print('EAGLE_LOOP_FRAME='+str(index),flush=True)
 record['completed']=True
except Exception as error:
 record['failure']=str(error);record['completed']=False;raise
finally:
 record['restored']=False
 try:
  if native_transforms is not None:restore_native_transforms(objects,native_transforms)
 except Exception as error:record['restorationFailure']=str(error)
 try:
  if objects:
   bpy.context.view_layer.update();record['meshIdentityAfter']=identity(objects)
   record['restored']=record.get('meshIdentityBefore') is not None and record['meshIdentityAfter']==record['meshIdentityBefore'] and 'restorationFailure' not in record
 except Exception as error:record['captureFailure']=str(error)
 try:record['sourceSha256After']=sha(SOURCE)
 except Exception as error:record['sourceHashFailure']=str(error)
 record['completed']=bool(record.get('completed') and record['restored'] and record.get('sourceSha256After')==EXPECTED and not any(key in record for key in ('failure','restorationFailure','captureFailure','sourceHashFailure')))
 (OUT/'native-receipt.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
if not record['completed'] or not record['restored'] or record.get('sourceSha256After')!=EXPECTED:raise RuntimeError('Original eagle source/mesh transformations did not restore')
