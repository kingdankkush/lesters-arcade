"""Anatomical locomotion corrections for newly authored native enemy derivatives."""
from hmh_enemy_poses import role_pose

def native_role_pose(kind, damage_kind, state, frame_index, frame_count, stoop, boss=False):
    pose=role_pose(kind,damage_kind,state,frame_index,frame_count,stoop,boss=boss)
    if state in {'idle','run'}:
        # In the measured rest skeleton, local Y is world up. The historical
        # primitive gait put its bounce on local Z, which points forward.
        pelvis=pose['locations']['pelvis']
        pose['locations']['pelvis']=[pelvis[0],pelvis[2],0.0]
    if state=='run':
        # A human knee flexes toward the back of the leg. Preserve the
        # alternating lift and stride phase while correcting the hinge sign.
        for side in ('L','R'):
            rotation=pose['rotations'][f'shin.{side}']
            rotation[0]=abs(rotation[0])
    return pose
