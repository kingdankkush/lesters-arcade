"""Render actual native character surface parts for cosmetic ragdolls."""
import bpy,bmesh,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'ragdoll-parts';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'apps/chikun/assets/source/Chikun-Superman-Rig.blend'))
rig=bpy.data.objects['Chikun_Flight_Rig'];source=bpy.data.objects['Chikun_Owner_Tripo_Surface'];rig.animation_data.action=bpy.data.actions['cruise'];s=bpy.context.scene;s.frame_set(7);s.cycles.samples=8
parts=['torso','head','armL','armR','legL','legR'];groups={g.index:g.name for g in source.vertex_groups}
def category(v):
 weights={groups[g.group]:g.weight for g in v.groups};name=max(weights,key=weights.get) if weights else 'root'
 if name in ['head','crest']:return 'head'
 if name.startswith(('arm.','hand.')):return 'arm'+name[-1]
 if name.startswith(('leg.','boot.')):return 'leg'+name[-1]
 return 'torso'
cats=[category(v) for v in source.data.vertices]
for name in parts:
 obj=source.copy();obj.data=source.data.copy();bpy.context.collection.objects.link(obj);obj.name='Ragdoll '+name
 bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
 removed=[face for face in bm.faces if max(set(cats[v.index] for v in face.verts),key=lambda c:sum(cats[v.index]==c for v in face.verts))!=name]
 bmesh.ops.delete(bm,geom=removed,context='FACES');bm.to_mesh(obj.data);bm.free();obj.hide_render=True
source.hide_render=True
for name in parts:
 obj=bpy.data.objects['Ragdoll '+name];obj.hide_render=False;s.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True);obj.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'apps/chikun/assets/source/Chikun-Ragdoll-Parts.blend'),compress=True)
