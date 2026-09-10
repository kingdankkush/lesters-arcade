"""Bake a single source view using the current native prop camera/light helpers."""
import bpy,sys,json,math,importlib.util,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index('--')+1:]
manifest_path,job_id,output_path=args
payload=json.loads(Path(manifest_path).read_text())
job=next(j for j in payload['jobs'] if j['id']==job_id)
out=Path(output_path);assert not out.exists();out.mkdir(parents=True)
helper=Path(__file__).with_name('export-hmh-tripo-props.py')
spec=importlib.util.spec_from_file_location('native_props',helper);native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)
source=Path(job['sourcePath']);sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source)==job['sourceSha256']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
imported=list(bpy.context.scene.objects)
for ob in list(imported):
 if ob.type in {'CAMERA','LIGHT'}:imported.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
meshes=[o for o in imported if o.type=='MESH' and not o.hide_render]
original=native.dimensions(native.mesh_bound_points(meshes))[2]
normalization=2/max(original) if job['bridge'] else 1
for ob in imported:
 if ob.parent is None:ob.matrix_world=Matrix.Rotation(math.radians(job['yawDegrees']),4,'Z')@Matrix.Scale(normalization,4)@ob.matrix_world
bpy.context.view_layer.update()
points,target=native.center_and_ground(imported,meshes)
lo,hi,size=native.dimensions(points)
pixels=payload['frameSize'];frame=[pixels*2,pixels] if job['bridge'] else [pixels,pixels]
scene,camera=native.configure_scene({'engine':'BLENDER_EEVEE','frameSize':frame,'exposure':0,'cameraPitchDegrees':45,'cameraYawDegrees':0},target,max(size))
scene.render.threads=2
if job['bridge']:
 bpy.context.view_layer.update();inverse=camera.matrix_world.inverted();q=[inverse@p for p in points]
 minx,maxx=min(p.x for p in q),max(p.x for p in q);miny,maxy=min(p.y for p in q),max(p.y for p in q)
 camera.location+=camera.rotation_euler.to_matrix()@Vector(((minx+maxx)/2,(miny+maxy)/2,0))
 camera.data.ortho_scale=max(maxx-minx,(maxy-miny)*2)/0.78
 bpy.context.view_layer.update()
 assert all(0<p.x<1 and 0<p.y<1 for p in [world_to_camera_view(scene,camera,v) for v in points])
else:native.fit_orthographic_camera(scene,camera,points,0.78)
png=out/'frame.png';scene.render.filepath=str(png);bpy.ops.render.render(write_still=True)
audit=native.audit_render(png)
ground=world_to_camera_view(scene,camera,Vector((0,0,0)))
rows=[]
for p in [Vector((0,0,0)),Vector((1,0,0)),Vector((0,-1,0)),Vector((0,0,1))]:
 projected=world_to_camera_view(scene,camera,p);rows.append({'source':list(p),'pixel':[projected.x*frame[0],(1-projected.y)*frame[1]]})
report={**job,**audit,'frameSha256':sha(png),'blenderVersion':bpy.app.version_string,'engine':scene.render.engine,'frameSize':frame,'normalizedDimensions':list(size),'sourceNormalization':normalization,'sourceWorldBounds':{'min':list(lo/normalization),'max':list(hi/normalization)},'anchorPixels':{'x':ground.x*frame[0],'y':(1-ground.y)*frame[1]},'orthoScale':camera.data.ortho_scale,'projectionSamples':rows,'nativeHelperSha256':sha(helper),'rendererSha256':sha(Path(__file__)),'materials':native.material_concerns(),'sourcePreserved':sha(source)==job['sourceSha256']}
assert report['sourcePreserved']
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print('WORLD_NATIVE_FRAME '+job_id,flush=True)
