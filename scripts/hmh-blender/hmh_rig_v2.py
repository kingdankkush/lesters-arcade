"""HMH_HumanRig_v2: build the v2 template on an approved hero rig, in memory.

Design package 7.3. The approved v1 bones keep their rest transforms, so the
approved bone-heat weights stay valid; new bones (neck, clavicles, twist
bones, 9 bones per hand, toes, the offhand socket) take their weights by
deterministic rule-based carving from their parents. Nothing here saves the
packed source. Poses are solved analytically (two-bone IK for arms and legs,
armature-axis deltas for the spine) and written as plain FK bases, so no
constraint ever evaluates at render time and two cold passes solve
identically.
"""
from __future__ import annotations

import math

import bpy
import numpy as np
from mathutils import Matrix, Vector, Quaternion

FINGERS = ('thumb', 'index', 'grip')


def ramp(value, a, wa, b, wb):
    """Linear ramp from weight wa at a to wb at b, clamped (a may exceed b)."""
    if a == b:
        return wb if value >= b else wa
    t = (value - a) / (b - a)
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return wa + (wb - wa) * t


def _v(values):
    return Vector((float(values[0]), float(values[1]), float(values[2])))


def _edit_add(edit_bones, name, head, tail, parent, roll_like=None):
    if name in edit_bones:
        raise RuntimeError(f'v2 bone already exists: {name}')
    bone = edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if roll_like is not None:
        bone.align_roll(roll_like)
    bone.parent = edit_bones[parent]
    bone.use_connect = False
    return bone


def build_rig_v2(rig, meshes, template: dict, landmarks: dict) -> dict:
    """Extend `rig` into HMH_HumanRig_v2 and carve weights on `meshes`."""
    bpy.context.view_layer.objects.active = rig
    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj == rig)
    rest_before = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    lm = landmarks['bones']
    for name in ('neck', 'clavicle.L', 'clavicle.R'):
        spec = lm[name]
        up = Vector((0, -1, 0)) if name == 'neck' else Vector((0, 0, 1))
        _edit_add(eb, name, _v(spec['head']), _v(spec['tail']), spec['parent'], roll_like=up)
    for child, parent in template['reparent'].items():
        eb[child].use_connect = False
        eb[child].parent = eb[parent]
    for side in ('L', 'R'):
        for base in ('upper_arm', 'forearm'):
            bone = eb[f'{base}.{side}']
            head = bone.head.lerp(bone.tail, 0.5)
            twist = _edit_add(eb, f'{base}_twist.{side}', head, bone.tail.copy(), bone.name)
            twist.roll = bone.roll
        hand = eb[f'hand.{side}']
        axis = (hand.tail - hand.head)
        length = axis.length
        direction = axis.normalized()
        side_axis = hand.x_axis.normalized()
        segments = template['fingers']['gripSegments']
        for finger, offset in (('thumb', 0.028), ('index', -0.012), ('grip', 0.0)):
            parent = hand.name
            for index in range(3):
                start = [0.45, 0.64, 0.82][index]
                end = [0.64, 0.82, 1.0][index]
                if finger == 'thumb':
                    start, end = [0.20, 0.38, 0.52][index], [0.38, 0.52, 0.64][index]
                head = hand.head + direction * (length * start) + side_axis * offset
                tail = hand.head + direction * (length * end) + side_axis * offset
                bone = _edit_add(eb, f'{finger}_{index + 1:02d}.{side}', head, tail, parent)
                bone.roll = hand.roll
                parent = bone.name
        foot = eb[f'foot.{side}']
        spec = lm[f'toe.{side}']
        flat = Vector((foot.tail.x - foot.head.x, foot.tail.y - foot.head.y, 0)).normalized()
        base = Vector((foot.head.x, foot.head.y, 0))
        head = base + flat * spec['ball'] + Vector((0, 0, spec['height']))
        tail = base + flat * spec['tip'] + Vector((0, 0, spec['height'] * 0.8))
        toe = _edit_add(eb, f'toe.{side}', head, tail, foot.name, roll_like=Vector((0, 0, 1)))
    hand = eb['hand.L']
    palm = hand.head.lerp(hand.tail, 0.42)
    socket = _edit_add(eb, 'offhand_socket', palm, palm + (hand.tail - hand.head).normalized() * 0.08, 'hand.L')
    socket.roll = hand.roll
    for name in template['addedSocketBones']:
        eb[name].use_deform = False
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.name = template['template']
    rig.data.name = template['template']
    for bone in rig.pose.bones:
        bone.rotation_mode = 'XYZ' if bone.rotation_mode != 'QUATERNION' else bone.rotation_mode
    moved = [name for name, matrix in rest_before.items()
             if max(abs(a - b) for row_a, row_b in zip(matrix, rig.data.bones[name].matrix_local) for a, b in zip(row_a, row_b)) > 1e-6]
    print('HMH rig v2 rest drift', {n: max(abs(a - b) for ra, rb in zip(rest_before[n], rig.data.bones[n].matrix_local) for a, b in zip(ra, rb)) for n in moved}, flush=True)
    drift = {name: max(abs(a - b) for row_a, row_b in zip(rest_before[name], rig.data.bones[name].matrix_local) for a, b in zip(row_a, row_b)) for name in moved}
    if moved and max(drift.values()) > 1e-4:
        raise RuntimeError(f'v1 rest transforms changed: {drift}')
    carve = carve_weights(rig, meshes, template, landmarks)
    return {'template': template['template'], 'boneCount': len(rig.data.bones),
            'deformBoneCount': sum(1 for b in rig.data.bones if b.use_deform),
            'addedBones': sorted(set(rig.data.bones.keys()) - set(rest_before)), 'weights': carve}


def _bone_axis(rig, name):
    bone = rig.data.bones[name]
    head = bone.head_local.copy()
    tail = bone.tail_local.copy()
    return head, tail


def carve_weights(rig, meshes, template, landmarks) -> dict:
    rules = landmarks['carve']
    quantum = template['limits']['weightQuantum']
    max_influences = template['limits']['maxInfluences']
    report = {}
    grip_segments = template['fingers']['gripSegments']
    for obj in meshes:
        groups = {g.name: g for g in obj.vertex_groups}
        index_to_name = {g.index: g.name for g in obj.vertex_groups}
        count = len(obj.data.vertices)
        co = np.empty(count * 3, dtype=np.float64)
        obj.data.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        world = np.array(obj.matrix_world)
        to_rig = np.array(rig.matrix_world.inverted()) @ world
        pts = co @ to_rig[:3, :3].T + to_rig[:3, 3]
        weights = []
        for vertex in obj.data.vertices:
            weights.append({index_to_name[g.group]: g.weight for g in vertex.groups if g.weight > 0})
        touched = set()

        def move(i, source, target, fraction):
            w = weights[i].get(source, 0.0)
            if w <= 0 or fraction <= 0:
                return
            amount = w * min(1.0, fraction)
            weights[i][source] = w - amount
            weights[i][target] = weights[i].get(target, 0.0) + amount
            touched.add(i)

        def axis_value(p, axis):
            return {'x': p[0], '-x': -p[0], 'y': p[1], '-y': -p[1], 'z': p[2]}[axis]

        for target in ('neck', 'clavicle.L', 'clavicle.R'):
            for rule in rules[target]:
                source = rule['from']
                if source not in groups:
                    continue
                a, wa, b, wb = rule['ramp']
                for i in range(count):
                    if source not in weights[i]:
                        continue
                    p = pts[i]
                    f = ramp(axis_value(p, rule['axis']), a, wa, b, wb)
                    if 'gate' in rule:
                        ga, gwa, gb, gwb = rule['gate']['ramp']
                        f *= ramp(axis_value(p, rule['gate']['axis']), ga, gwa, gb, gwb)
                    if 'radial' in rule:
                        cx, cy = rule['radial']['centre']
                        ra, rwa, rb, rwb = rule['radial']['ramp']
                        f *= ramp(math.hypot(p[0] - cx, p[1] - cy), ra, rwa, rb, rwb)
                    move(i, source, target, f)
        for side in ('L', 'R'):
            for base, key in (('upper_arm', 'upper_arm_twist'), ('forearm', 'forearm_twist')):
                source = f'{base}.{side}'
                if source not in groups:
                    continue
                head, tail = _bone_axis(rig, source)
                h = np.array(head)
                d = np.array(tail - head)
                length = np.linalg.norm(d)
                d /= length
                a, wa, b, wb = rules[key]['ramp']
                for i in range(count):
                    if source in weights[i]:
                        t = float((pts[i] - h) @ d) / length
                        move(i, source, f'{key}.{side}', ramp(t, a, wa, b, wb))
            source = f'hand.{side}'
            if source in groups:
                head, tail = _bone_axis(rig, source)
                h = np.array(head)
                d = np.array(tail - head)
                length = np.linalg.norm(d)
                d /= length
                for i in range(count):
                    if source not in weights[i]:
                        continue
                    t = float((pts[i] - h) @ d) / length
                    # Mitten: memberships along the hand axis; each segment
                    # takes its share of whatever the hand still owns.
                    shares = []
                    for a0, a1, b0, b1 in grip_segments:
                        up = ramp(t, a0, 0.0, a1, 1.0)
                        down = ramp(t, b0, 1.0, b1, 0.0)
                        shares.append(min(up, down))
                    total = weights[i][source]
                    for index, share in enumerate(shares):
                        if share > 0:
                            weights[i][source] -= total * share
                            weights[i][f'grip_{index + 1:02d}.{side}'] = weights[i].get(f'grip_{index + 1:02d}.{side}', 0.0) + total * share
                            touched.add(i)
            source = f'foot.{side}'
            if source in groups:
                head, tail = _bone_axis(rig, source)
                flat = np.array([tail.x - head.x, tail.y - head.y, 0.0])
                flat /= np.linalg.norm(flat)
                base = np.array([head.x, head.y, 0.0])
                a, wa, b, wb = rules['toe']['ramp']
                for i in range(count):
                    if source in weights[i]:
                        s = float((pts[i] - base) @ flat)
                        move(i, source, f'toe.{side}', ramp(s, a, wa, b, wb))
        # Limit influences, quantize and renormalize every touched vertex.
        new_groups = set()
        rows = {}
        for i in touched:
            items = sorted(((w, n) for n, w in weights[i].items() if w > 1e-6), reverse=True)[:max_influences]
            total = sum(w for w, _ in items)
            q = [(max(1, round(w / total * quantum)), n) for w, n in items]
            rows[i] = {n: k / quantum for k, n in q}
            for _, n in q:
                if n not in groups:
                    new_groups.add(n)
        for name in sorted(new_groups):
            groups[name] = obj.vertex_groups.new(name=name)
        by_group = {}
        for i in sorted(touched):
            for name in weights[i]:
                if name in groups:
                    by_group.setdefault(name, set())
            for name, w in rows[i].items():
                by_group.setdefault(name, set())
        for name in sorted(by_group):
            groups[name].remove(sorted(touched))
        buckets = {}
        for i in sorted(touched):
            for name, w in rows[i].items():
                buckets.setdefault((name, w), []).append(i)
        for (name, w), indices in sorted(buckets.items()):
            groups[name].add(indices, w, 'REPLACE')
        max_inf = 0
        unweighted = 0
        for vertex in obj.data.vertices:
            n = sum(1 for g in vertex.groups if g.weight > 0)
            max_inf = max(max_inf, n)
            unweighted += n == 0
        carved = {}
        for rows_i in rows.values():
            for name in rows_i:
                if name in new_groups or any(name.startswith(prefix) for prefix in ('neck', 'clavicle', 'upper_arm_twist', 'forearm_twist', 'grip_', 'toe.')):
                    carved[name] = carved.get(name, 0) + 1
        if max_inf > max_influences or unweighted:
            raise RuntimeError(f'{obj.name}: weight limits failed ({max_inf} influences, {unweighted} unweighted)')
        report[obj.name] = {'vertices': count, 'touched': len(touched), 'maxInfluences': max_inf,
                            'unweightedVertices': unweighted, 'carvedVertices': dict(sorted(carved.items()))}
    return report


# --------------------------------------------------------------------------
# Analytic FK / IK solve
# --------------------------------------------------------------------------

def rot_arm(pitch=0.0, yaw=0.0, roll=0.0) -> Matrix:
    """Rotation in armature axes (degrees): pitch about +X leans forward
    (the hero faces -Y), yaw about +Z turns left, roll about +Y leans left."""
    return (Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(pitch), 3, 'X')
            @ Matrix.Rotation(math.radians(roll), 3, 'Y'))


def frame_from_axes(x: Vector, y: Vector, origin: Vector) -> Matrix:
    x = x.normalized()
    y = (y - x * y.dot(x)).normalized()
    z = x.cross(y)
    m = Matrix.Identity(4)
    for row in range(3):
        m[row][0], m[row][1], m[row][2], m[row][3] = x[row], y[row], z[row], origin[row]
    return m


class Skeleton:
    """Rest data plus a deterministic FK evaluator for bases."""

    def __init__(self, rig):
        self.rig = rig
        self.rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in rig.data.bones}
        self.length = {b.name: b.length for b in rig.data.bones}
        order = []
        seen = set()

        def visit(name):
            if name in seen:
                return
            if self.parent[name]:
                visit(self.parent[name])
            seen.add(name)
            order.append(name)
        for name in sorted(self.rest):
            visit(name)
        self.order = order
        self.rest_inv = {name: m.inverted() for name, m in self.rest.items()}
        self.hinge_sign = {}
        self.twist_offset = {}
        for side in ('L', 'R'):
            self._chain_reference(f'upper_arm.{side}', f'forearm.{side}')
            self._chain_reference(f'thigh.{side}', f'shin.{side}')
        # Finger curl sign: the fingertip must move toward the body's centre.
        self.curl_sign = {}
        for side in ('L', 'R'):
            name = f'grip_01.{side}'
            rest = self.rest[name]
            tip = rest @ Vector((0, self.length[name], 0))
            for sign in (1, -1):
                r = rest @ Matrix.Rotation(math.radians(30 * sign), 4, 'Z')
                moved = r @ Vector((0, self.length[name], 0))
                if abs(moved.x) < abs(tip.x):
                    self.curl_sign[side] = sign
                    break
            else:
                self.curl_sign[side] = 1

    def _chain_reference(self, upper, lower):
        ru, rl = self.rest[upper], self.rest[lower]
        yu = Vector((ru[0][1], ru[1][1], ru[2][1]))
        yl = Vector((rl[0][1], rl[1][1], rl[2][1]))
        n = yu.cross(yl)
        if n.length < 1e-4:
            raise RuntimeError(f'{upper}/{lower} rest chain is straight; no hinge reference')
        n.normalize()
        for name, y in ((upper, yu), (lower, yl)):
            r = self.rest[name]
            x = Vector((r[0][0], r[1][0], r[2][0]))
            e2 = y.cross(n)
            self.twist_offset[name] = math.atan2(x.dot(e2), x.dot(n))
        self.hinge_sign[upper] = 1

    def evaluate(self, bases: dict) -> dict:
        pose = {}
        for name in self.order:
            parent = self.parent[name]
            local = bases.get(name, Matrix.Identity(4))
            if parent is None:
                pose[name] = self.rest[name] @ local
            else:
                pose[name] = pose[parent] @ self.rest_inv[parent] @ self.rest[name] @ local
        return pose

    def inherited(self, pose: dict, name: str) -> Matrix:
        parent = self.parent[name]
        if parent is None:
            return self.rest[name].copy()
        return pose[parent] @ self.rest_inv[parent] @ self.rest[name]

    def basis_for(self, pose: dict, name: str, target: Matrix) -> Matrix:
        return self.inherited(pose, name).inverted() @ target

    def delta_basis(self, name: str, rotation3: Matrix) -> Matrix:
        rest3 = self.rest[name].to_3x3()
        return (rest3.inverted() @ rotation3 @ rest3).to_4x4()

    def oriented(self, name: str, head: Vector, y: Vector, n: Vector) -> Matrix:
        """Bone frame with +Y along `y`, twist fixed by hinge normal `n` and
        the rest twist offset, so the chain never corkscrews."""
        y = y.normalized()
        n = (n - y * n.dot(y)).normalized()
        e2 = y.cross(n)
        phi = self.twist_offset[name]
        x = n * math.cos(phi) + e2 * math.sin(phi)
        return frame_from_axes(x, y, head)


def two_bone(S: Vector, T: Vector, P: Vector, l1: float, l2: float):
    d = T - S
    dist = d.length
    lo, hi = abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4
    reach_error = 0.0
    if dist > hi:
        reach_error = dist - hi
        dist = hi
    elif dist < lo:
        reach_error = lo - dist
        dist = lo
    direction = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    pv = (P - S) - direction * (P - S).dot(direction)
    if pv.length < 1e-6:
        pv = Vector((0, -1, 0)) - direction * Vector((0, -1, 0)).dot(direction)
    bend = pv.normalized()
    E = S + direction * a + bend * h
    return E, S + direction * dist, direction.cross(bend).normalized(), reach_error


def shoulder_positions(skel: Skeleton, spec: dict) -> dict:
    """Posed shoulder joints for a spec's pelvis and spine deltas."""
    bases = {}
    pelvis = spec.get('pelvis', {})
    bases['pelvis'] = Matrix.Translation(skel.rest_inv['pelvis'].to_3x3() @ Vector(pelvis.get('offset', (0, 0, 0)))) @ skel.delta_basis('pelvis', rot_arm(*pelvis.get('rot', (0, 0, 0))))
    for name in ('spine', 'chest', 'neck', 'head', 'clavicle.L', 'clavicle.R'):
        if name in spec.get('fk', {}):
            bases[name] = skel.delta_basis(name, rot_arm(*spec['fk'][name]))
    pose = skel.evaluate(bases)
    return {side: skel.inherited(pose, f'upper_arm.{side}').translation.copy() for side in ('L', 'R')}


def solve_pose(skel: Skeleton, spec: dict) -> tuple[dict, dict]:
    """Solve one pose spec into bases. Returns (bases, measurements)."""
    bases = {}
    info = {}
    pelvis = spec.get('pelvis', {})
    root_off = Vector(pelvis.get('offset', (0, 0, 0)))
    bases['pelvis'] = Matrix.Translation(skel.rest_inv['pelvis'].to_3x3() @ root_off) @ skel.delta_basis('pelvis', rot_arm(*pelvis.get('rot', (0, 0, 0))))
    for name in ('spine', 'chest', 'neck', 'head', 'clavicle.L', 'clavicle.R'):
        if name in spec.get('fk', {}):
            bases[name] = skel.delta_basis(name, rot_arm(*spec['fk'][name]))
    pose = skel.evaluate(bases)
    # Arms.
    for side in ('L', 'R'):
        hand = spec.get('hands', {}).get(side)
        upper, fore, wrist = f'upper_arm.{side}', f'forearm.{side}', f'hand.{side}'
        if hand is None:
            for name, rot in spec.get('armFk', {}).get(side, {}).items():
                bases[name] = skel.delta_basis(name, rot_arm(*rot))
            continue
        target = hand['matrix']
        S = skel.inherited(pose, upper).translation
        E, T, n, reach = two_bone(S, target.translation, hand['pole'], skel.length[upper], skel.length[fore])
        m_upper = skel.oriented(upper, S, E - S, n)
        bases[upper] = skel.basis_for(pose, upper, m_upper)
        pose = skel.evaluate(bases)
        m_fore = skel.oriented(fore, E, T - E, n)
        bases[fore] = skel.basis_for(pose, fore, m_fore)
        pose = skel.evaluate(bases)
        m_hand = target.copy()
        m_hand.translation = T
        bases[wrist] = skel.basis_for(pose, wrist, m_hand)
        # Forearm twist carries half of the wrist's roll about the forearm.
        fy = Vector((m_fore[0][1], m_fore[1][1], m_fore[2][1]))
        fx = Vector((m_fore[0][0], m_fore[1][0], m_fore[2][0]))
        hx = Vector((m_hand[0][0], m_hand[1][0], m_hand[2][0]))
        hx_p = hx - fy * hx.dot(fy)
        roll = math.atan2(fx.cross(hx_p).dot(fy), fx.dot(hx_p)) if hx_p.length > 1e-6 else 0.0
        bases[f'forearm_twist.{side}'] = Matrix.Rotation(roll * 0.5, 4, 'Y')
        info[f'reach.{side}'] = reach
        pose = skel.evaluate(bases)
        curl = hand.get('curl', 0.0)
        if curl:
            for index in range(3):
                bases[f'grip_{index + 1:02d}.{side}'] = Matrix.Rotation(math.radians(curl * [55, 65, 45][index] * skel.curl_sign[side]), 4, 'Z')
            thumb = hand.get('thumb', curl)
            for index in range(3):
                bases[f'thumb_{index + 1:02d}.{side}'] = Matrix.Rotation(math.radians(thumb * [20, 25, 20][index] * skel.curl_sign[side]), 4, 'Z')
    pose = skel.evaluate(bases)
    # Legs.
    for side in ('L', 'R'):
        foot = spec.get('feet', {}).get(side)
        thigh, shin, ankle = f'thigh.{side}', f'shin.{side}', f'foot.{side}'
        if foot is None:
            for name, rot in spec.get('legFk', {}).get(side, {}).items():
                bases[name] = skel.delta_basis(name, rot_arm(*rot))
            continue
        target = foot['matrix']
        S = skel.inherited(pose, thigh).translation
        E, T, n, reach = two_bone(S, target.translation, foot['pole'], skel.length[thigh], skel.length[shin])
        bases[thigh] = skel.basis_for(pose, thigh, skel.oriented(thigh, S, E - S, n))
        pose = skel.evaluate(bases)
        bases[shin] = skel.basis_for(pose, shin, skel.oriented(shin, E, T - E, n))
        pose = skel.evaluate(bases)
        m_foot = target.copy()
        m_foot.translation = T
        bases[ankle] = skel.basis_for(pose, ankle, m_foot)
        if foot.get('toe'):
            bases[f'toe.{side}'] = Matrix.Rotation(math.radians(foot['toe']), 4, 'X')
        info[f'legReach.{side}'] = reach
        pose = skel.evaluate(bases)
    # Props: absolute armature-space placements or hidden (zero scale).
    for name, placement in spec.get('props', {}).items():
        if placement is None:
            bases[name] = Matrix.Diagonal((1e-4, 1e-4, 1e-4, 1.0))
        elif placement == 'rest':
            bases.pop(name, None)
        else:
            pose = skel.evaluate(bases)
            bases[name] = skel.basis_for(pose, name, placement)
    pose = skel.evaluate(bases)
    return bases, info, pose


def apply_bases(rig, bases: dict) -> None:
    for pb in rig.pose.bones:
        pb.matrix_basis = bases.get(pb.name, Matrix.Identity(4))
