"""Additive whole-actor projection correction; original native action data is immutable."""
import copy
import bpy
import numpy as np
ROOT_NAME='HMH_Enemy_Projection_Root'
RIG_NAME='bagholder-rusher Rig'
BODY_NAME='bagholder-rusher Skinned Primary Body'


def without_projection_parent(record):
    """Normalize exactly one declared added object-parent edge, never bone hierarchy."""
    result=copy.deepcopy(record)
    rig=result['objects'][RIG_NAME]
    if rig['parent']==ROOT_NAME:
        assert rig['parentType']=='OBJECT' and rig['parentBone']==''
        rig['parent']=None
    return result


def minimum_z(obj):
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh=evaluated.to_mesh()
    try:
        coords=np.empty(len(mesh.vertices)*3,dtype=np.float32)
        mesh.vertices.foreach_get('co',coords)
        matrix=np.asarray(evaluated.matrix_world,dtype=np.float64)
        z=coords.reshape(-1,3)@matrix[2,:3]+matrix[2,3]
        assert len(z) and np.isfinite(z).all()
        return float(z.min())
    finally:
        evaluated.to_mesh_clear()


def ground_native_frame(rig):
    root=bpy.data.objects.get(ROOT_NAME)
    assert root and root.type=='EMPTY' and rig.name==RIG_NAME and rig.parent==root
    assert tuple(root.scale)==(1,1,1) and tuple(root.rotation_euler)==(0,0,0)
    assert root.location.x==root.location.y==0
    body=bpy.data.objects[BODY_NAME]
    assert body.parent==rig and body.get('hmh_primary_skinned_body')
    root.location.z=0
    bpy.context.view_layer.update()
    before=minimum_z(body)
    root.location.z=-before
    bpy.context.view_layer.update()
    after=minimum_z(body)
    assert abs(after)<0.0001,after
    return {'beforeMinimumZ':before,'offsetZ':float(root.location.z),'afterMinimumZ':after}


def install(exporter,manifest):
    """Wrap only native frame sampling; canonical filename/direction/render logic stays intact."""
    assert len(manifest['actors'])==1 and manifest['actors'][0]['actorId']=='bagholder-rusher'
    actor=manifest['actors'][0]
    assert actor['armature']==RIG_NAME
    native_sample=exporter.sample_clip_frame
    records=[]
    def grounded_sample(action,index,count,loop):
        state=action.get('hmh_state')
        assert state in actor['clipActions'] and actor['clipActions'][state]==action.name
        assert count==manifest['clips'][state]['frames'] and loop==manifest['clips'][state]['loop']
        if state == 'hit':
            samples = actor['poseAuthoring'].get('sourceFrameSamples', {}).get('hit')
            assert samples == [12, 25] and count == 2 and not loop
            assert tuple(float(v) for v in action.frame_range) == (1.0, 25.0)
            # Measured peak of this immutable action, then its authored recovery.
            # Only evaluation time changes; never edit curves, rig or weights.
            frame = samples[index]
            bpy.context.scene.frame_set(frame)
        else:
            frame=native_sample(action,index,count,loop)
        rig=exporter.resolve_rig(manifest,actor)
        correction=ground_native_frame(rig)
        records.append({'state':state,'frameIndex':index,'nativeFrame':frame,'yawRadians':rig.rotation_euler.z,**correction})
        return frame
    exporter.sample_clip_frame=grounded_sample
    return records
