"""Verify the actual saved Blender surface, skin and every exported action pose.
Run in Blender: --python-exit-code 1 --python scripts/verify-chikun-native.py -- MODEL.blend REPORT.json
"""
import bpy,bmesh,json,sys,math
import numpy as np
from pathlib import Path
model,output=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=str(Path(model).resolve()))
mesh=bpy.data.objects['Chikun_Owner_Tripo_Surface'];rig=bpy.data.objects['Chikun_Flight_Rig'];scene=bpy.context.scene
bm=bmesh.new();bm.from_mesh(mesh.data)
report={'schema':'chikun-surface-and-pose-audit-v1','boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'vertices':len(bm.verts),'triangles':len(bm.faces),'unweightedVertices':sum(abs(sum(g.weight for g in v.groups)-1)>.0001 for v in mesh.data.vertices),'clips':[]}
bm.free()
assert report['boundaryEdges']==0,'Uncapped surfaces let the background show through'
assert report['nonManifoldEdges']==0,'Every edge must belong to two faces'
assert report['unweightedVertices']==0,'Every surface vertex needs normalized skin weights'
camera=np.array(scene.camera.matrix_world.inverted(),dtype=np.float64)
for action in sorted(bpy.data.actions,key=lambda a:a.name):
 rig.animation_data.action=action
 low=np.array([1.,1.]);high=np.array([0.,0.])
 for frame in range(1,25):
  scene.frame_set(frame);evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());surface=evaluated.to_mesh()
  xyz=np.empty(len(surface.vertices)*3,dtype=np.float64);surface.vertices.foreach_get('co',xyz);xyz=xyz.reshape((-1,3))
  transform=camera@np.array(evaluated.matrix_world)
  projected=(xyz@transform[:3,:3].T+transform[:3,3])[:,:2]/scene.camera.data.ortho_scale+.5
  assert np.isfinite(projected).all(),action.name
  low=np.minimum(low,projected.min(axis=0));high=np.maximum(high,projected.max(axis=0))
  evaluated.to_mesh_clear()
 assert min(low)>.01 and max(high)<.99,f'{action.name} clips outside the atlas: {low}, {high}'
 report['clips'].append({'name':action.name,'framesChecked':24,'minimum':low.tolist(),'maximum':high.tolist()})
assert len(report['clips'])==21,'All 21 authored actions must be present'
Path(output).write_text(json.dumps(report,indent=2))
print(json.dumps({'surface':'closed','clips':len(report['clips']),'frames':sum(c['framesChecked'] for c in report['clips']),'report':output}),flush=True)
