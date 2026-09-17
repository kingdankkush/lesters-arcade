"""Author the held-weapon models the production heroes carry in their hands.

HMH-N03 (2026-09-16). The Coin Blaster pistol reaches the hero's hand as a
textured mesh skinned 1.0 to the ``pistol_prop`` bone of each hero rig and is
rendered per direction / clip frame by the production hero pipeline. Every
other weapon used to be a flat 256 px prop crop rotated toward the aim. This
scene authors one detailed low-poly model per weapon in a shared *grip frame*
so the exporter can drop each one into a hero's hand exactly where the pistol
sits:

    origin  = the trigger hand's palm point on the grip
    +X      = forward, along the bore toward the muzzle
    +Y      = the shooter's left
    +Z      = up
    units   = metres at hero scale (the heroes stand about 1.7 m)

The pistol's own bore runs ~0.10 m above the palm point, its grip reaches
~0.06 m below it, and the muzzle sits ~0.23 m forward, so every gun here keeps
its bore near z = 0.10 and its grip around the origin. Materials share one
silver / Litecoin-blue palette with dark polymer furniture and a single
emissive accent per weapon (the identity colour the muzzle VFX already uses).

Repository-owned, deterministic, no downloaded pixels, projection-only.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--source-blend', required=True)
    parser.add_argument('--inspection-output', required=True)
    parser.add_argument('--measure-only', action='store_true', help='report authored lengths instead of enforcing the manifest')
    return parser.parse_args(argv)


def rgba(value: str, alpha: float = 1.0):
    token = value.removeprefix('#')
    return tuple(int(token[index:index + 2], 16) / 255 for index in (0, 2, 4)) + (alpha,)


_MATERIALS: dict[str, bpy.types.Material] = {}


def material(name: str, color: str, *, metallic: float = 0.0, roughness: float = 0.5, emission: float = 0.0, emission_color: str | None = None):
    key = f'HMH_Held_{name}'
    if key in _MATERIALS:
        return _MATERIALS[key]
    mat = bpy.data.materials.new(key)
    color_value = rgba(color)
    mat.diffuse_color = color_value
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = color_value
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    if emission:
        node.inputs['Emission Color'].default_value = rgba(emission_color or color)
        node.inputs['Emission Strength'].default_value = emission
    _MATERIALS[key] = mat
    return mat


# Shared palette: brushed silver steel, gunmetal, Litecoin blue, dark polymer.
def palette(accent: str):
    return {
        'steel': material('steel', '#b9c4cf', metallic=0.92, roughness=0.36),
        'steel_bright': material('steel_bright', '#d5dde6', metallic=0.95, roughness=0.28),
        'gunmetal': material('gunmetal', '#4b5663', metallic=0.85, roughness=0.42),
        'dark': material('dark', '#1c232b', metallic=0.55, roughness=0.5),
        'polymer': material('polymer', '#171b20', metallic=0.05, roughness=0.62),
        'blue': material('blue', '#345d9d', metallic=0.7, roughness=0.32),
        'blue_light': material('blue_light', '#5e8fd6', metallic=0.6, roughness=0.3),
        'brass': material('brass', '#c9a24a', metallic=0.9, roughness=0.3),
        'accent': material(f'accent_{accent.lstrip("#")}', accent, metallic=0.15, roughness=0.3, emission=2.4),
        'accent_dim': material(f'accent_dim_{accent.lstrip("#")}', accent, metallic=0.2, roughness=0.35, emission=0.9),
    }


class Builder:
    """Collects beveled primitives for one weapon and joins them into a mesh."""

    def __init__(self, weapon_id: str):
        self.weapon_id = weapon_id
        self.parts: list[bpy.types.Object] = []

    def _finish(self, obj, mat, bevel, segments=2):
        obj.name = f'{self.weapon_id}_{len(self.parts):03d}'
        if bevel:
            modifier = obj.modifiers.new('bevel', 'BEVEL')
            modifier.width = bevel
            modifier.segments = segments
            modifier.limit_method = 'ANGLE'
            modifier.angle_limit = math.radians(50)
        obj.data.materials.append(mat)
        self.parts.append(obj)
        return obj

    def box(self, center, size, mat, *, rotation=(0.0, 0.0, 0.0), bevel=0.004):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=center, rotation=rotation)
        obj = bpy.context.object
        obj.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        return self._finish(obj, mat, bevel)

    def cyl_x(self, x0, x1, radius, mat, *, y=0.0, z=0.0, vertices=24, bevel=0.0, pitch=0.0):
        """Cylinder along +X from x0 to x1 (optionally pitched about Y)."""
        length = x1 - x0
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=((x0 + x1) / 2, y, z), rotation=(0.0, math.radians(90) + pitch, 0.0))
        obj = bpy.context.object
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        return self._finish(obj, mat, bevel)

    def cyl_y(self, center, radius, depth, mat, *, vertices=24, bevel=0.0):
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center, rotation=(math.radians(90), 0.0, 0.0))
        obj = bpy.context.object
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        return self._finish(obj, mat, bevel)

    def cyl_z(self, center, radius, depth, mat, *, vertices=24, bevel=0.0):
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
        obj = bpy.context.object
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        return self._finish(obj, mat, bevel)

    def cone_x(self, x0, x1, r0, r1, mat, *, y=0.0, z=0.0, vertices=24):
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r0, radius2=r1, depth=x1 - x0, location=((x0 + x1) / 2, y, z), rotation=(0.0, math.radians(90), 0.0))
        obj = bpy.context.object
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        return self._finish(obj, mat, 0.0)

    def ring_x(self, x, major, minor, mat, *, y=0.0, z=0.0, segments=28):
        bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=10, location=(x, y, z), rotation=(0.0, math.radians(90), 0.0))
        obj = bpy.context.object
        bpy.ops.object.shade_smooth()
        return self._finish(obj, mat, 0.0)

    def ring_y(self, center, major, minor, mat, *, segments=28):
        bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=10, location=center, rotation=(math.radians(90), 0.0, 0.0))
        obj = bpy.context.object
        bpy.ops.object.shade_smooth()
        return self._finish(obj, mat, 0.0)

    def sphere(self, center, radius, mat):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=center)
        obj = bpy.context.object
        bpy.ops.object.shade_smooth()
        return self._finish(obj, mat, 0.0)

    def grip(self, mats, *, x=0.0, height=0.09, rake=16.0, width=0.034, depth=0.05):
        """A raked pistol grip hanging below the palm point at (x, 0, 0)."""
        rot = (0.0, math.radians(-rake), 0.0)
        self.box((x - 0.006, 0.0, -height / 2 + 0.012), (depth, width, height), mats['polymer'], rotation=rot, bevel=0.006)
        # Checkered panel and steel back strap
        self.box((x - 0.006, 0.0, -height / 2 + 0.012), (depth * 0.7, width + 0.006, height * 0.55), mats['dark'], rotation=rot, bevel=0.003)
        self.box((x - 0.006 - depth * 0.42, 0.0, -height / 2 + 0.012), (0.008, width * 0.8, height * 0.9), mats['gunmetal'], rotation=rot, bevel=0.002)
        # Trigger guard and trigger
        self.ring_y((x + 0.03, 0.0, 0.03), 0.026, 0.004, mats['gunmetal'], segments=20)
        self.box((x + 0.026, 0.0, 0.032), (0.006, 0.008, 0.024), mats['steel'], bevel=0.001)
        return self

    def join(self, muzzle, extra_props=None):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in self.parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0]
        # Apply the bevels so the joined mesh is plain geometry the hero rig can
        # skin without any modifier stack ordering surprises.
        for obj in self.parts:
            bpy.context.view_layer.objects.active = obj
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
        # Bake every part's placement into its vertices before joining so the
        # joined weapon carries an identity transform in the grip frame.
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.context.view_layer.objects.active = self.parts[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = f'HMH_HeldWeapon_{self.weapon_id}'
        obj.data.name = obj.name
        obj['hmh_weapon_id'] = self.weapon_id
        obj['hmh_runtime_authority'] = 'projection-only'
        obj['hmh_grip'] = [0.0, 0.0, 0.0]
        obj['hmh_muzzle'] = list(muzzle)
        for key, value in (extra_props or {}).items():
            obj[key] = value
        return obj


# --- weapons -----------------------------------------------------------------
# Bore height BORE, palm point at the origin. Lengths in metres at hero scale.
BORE = 0.10


def build_scatter_shotgun(mats):
    b = Builder('scatter-shotgun')
    # Receiver block with ejection port and loading gate
    b.box((0.05, 0.0, BORE - 0.012), (0.20, 0.056, 0.076), mats['steel'], bevel=0.006)
    b.box((0.09, -0.024, BORE + 0.004), (0.06, 0.004, 0.026), mats['dark'], bevel=0.001)
    b.box((0.04, 0.0, BORE - 0.05), (0.07, 0.03, 0.01), mats['blue'], bevel=0.002)
    # Twin barrels over a magazine tube
    for y in (-0.014, 0.014):
        b.cyl_x(0.14, 0.60, 0.015, mats['steel_bright'], y=y, z=BORE + 0.016)
        b.cyl_x(0.585, 0.605, 0.0165, mats['gunmetal'], y=y, z=BORE + 0.016)
    b.cyl_x(0.14, 0.50, 0.012, mats['gunmetal'], z=BORE - 0.016)
    b.box((0.30, 0.0, BORE), (0.03, 0.036, 0.04), mats['gunmetal'], bevel=0.003)
    b.box((0.50, 0.0, BORE), (0.02, 0.036, 0.04), mats['gunmetal'], bevel=0.003)
    # Ribbed pump with blue accent bands
    b.box((0.36, 0.0, BORE - 0.026), (0.11, 0.05, 0.036), mats['polymer'], bevel=0.006)
    for index in range(5):
        b.box((0.32 + index * 0.02, 0.0, BORE - 0.026), (0.006, 0.046, 0.038), mats['dark'], bevel=0.001)
    b.box((0.31, 0.0, BORE - 0.026), (0.008, 0.048, 0.04), mats['blue'], bevel=0.001)
    b.box((0.41, 0.0, BORE - 0.026), (0.008, 0.048, 0.04), mats['blue'], bevel=0.001)
    # Front bead and vented rib
    b.sphere((0.59, 0.0, BORE + 0.036), 0.006, mats['accent'])
    b.box((0.37, 0.0, BORE + 0.036), (0.42, 0.008, 0.006), mats['gunmetal'], bevel=0.001)
    # Stock: tapered polymer with steel butt plate and blue cheek stripe
    b.box((-0.12, 0.0, 0.066), (0.14, 0.038, 0.066), mats['polymer'], rotation=(0.0, math.radians(-6), 0.0), bevel=0.008)
    b.box((-0.195, 0.0, 0.058), (0.016, 0.044, 0.088), mats['steel'], rotation=(0.0, math.radians(-6), 0.0), bevel=0.003)
    b.box((-0.12, 0.0, 0.096), (0.10, 0.042, 0.008), mats['blue'], rotation=(0.0, math.radians(-6), 0.0), bevel=0.001)
    b.grip(mats)
    return b.join((0.605, 0.0, BORE + 0.016))


def build_auto_miner(mats):
    b = Builder('auto-miner')
    # Rear motor housing, carry handle and ammo drum
    b.box((-0.10, 0.0, BORE - 0.01), (0.18, 0.09, 0.10), mats['gunmetal'], bevel=0.008)
    b.box((-0.10, 0.0, BORE + 0.05), (0.12, 0.03, 0.02), mats['steel'], bevel=0.003)
    b.box((-0.10, 0.0, BORE + 0.065), (0.08, 0.02, 0.014), mats['polymer'], bevel=0.003)
    b.cyl_y((-0.09, 0.03, BORE - 0.07), 0.05, 0.05, mats['steel'], bevel=0.003)
    b.ring_y((-0.09, 0.03, BORE - 0.07), 0.046, 0.005, mats['blue'])
    b.box((-0.18, 0.0, BORE - 0.01), (0.02, 0.07, 0.08), mats['dark'], bevel=0.003)
    # Rotor housing with glow ring, then six barrels in a ring with clamps
    b.cyl_x(-0.01, 0.06, 0.05, mats['steel'], z=BORE, bevel=0.003)
    b.ring_x(0.062, 0.042, 0.006, mats['accent'], z=BORE)
    for index in range(6):
        angle = math.tau * index / 6
        y = math.cos(angle) * 0.03
        z = BORE + math.sin(angle) * 0.03
        b.cyl_x(0.06, 0.52, 0.009, mats['steel_bright'], y=y, z=z, vertices=14)
        b.cyl_x(0.505, 0.525, 0.011, mats['gunmetal'], y=y, z=z, vertices=14)
    b.cyl_x(0.05, 0.065, 0.012, mats['dark'], z=BORE, vertices=12)
    for x in (0.22, 0.40):
        b.cyl_x(x - 0.012, x + 0.012, 0.045, mats['gunmetal'], z=BORE, bevel=0.003)
        b.ring_x(x, 0.046, 0.004, mats['blue'], z=BORE)
    # Feed chute and foregrip
    b.box((-0.02, 0.035, BORE - 0.045), (0.12, 0.024, 0.03), mats['dark'], bevel=0.004)
    b.box((0.16, 0.0, BORE - 0.075), (0.05, 0.032, 0.05), mats['polymer'], bevel=0.006)
    b.box((0.16, 0.0, BORE - 0.048), (0.06, 0.04, 0.012), mats['steel'], bevel=0.002)
    b.grip(mats)
    return b.join((0.525, 0.0, BORE))


def build_launcher_rig(mats):
    b = Builder('launcher-rig')
    # Revolving six-chamber cylinder behind a fat launch tube
    b.cyl_x(-0.09, 0.05, 0.05, mats['steel'], z=BORE, bevel=0.004)
    for index in range(6):
        angle = math.tau * index / 6
        b.cyl_x(-0.095, 0.052, 0.014, mats['dark'], y=math.cos(angle) * 0.032, z=BORE + math.sin(angle) * 0.032, vertices=12)
    b.ring_x(-0.02, 0.052, 0.005, mats['blue'], z=BORE)
    b.cyl_x(0.05, 0.46, 0.034, mats['steel'], z=BORE, bevel=0.003)
    b.cyl_x(0.44, 0.52, 0.042, mats['gunmetal'], z=BORE, bevel=0.004)
    b.cyl_x(0.50, 0.522, 0.03, mats['dark'], z=BORE)
    for x in (0.12, 0.24, 0.36):
        b.ring_x(x, 0.036, 0.004, mats['blue'], z=BORE)
    # Frame, folding stock, foregrip, ladder sight and blue cell
    b.box((0.0, 0.0, BORE - 0.05), (0.22, 0.05, 0.03), mats['gunmetal'], bevel=0.005)
    b.box((-0.15, 0.0, BORE - 0.02), (0.12, 0.02, 0.02), mats['steel'], bevel=0.003)
    b.box((-0.15, 0.0, BORE - 0.06), (0.12, 0.02, 0.02), mats['steel'], bevel=0.003)
    b.box((-0.21, 0.0, BORE - 0.04), (0.02, 0.05, 0.09), mats['polymer'], bevel=0.005)
    b.box((0.22, 0.0, BORE - 0.07), (0.05, 0.03, 0.055), mats['polymer'], bevel=0.006)
    b.box((0.10, 0.0, BORE + 0.042), (0.04, 0.02, 0.03), mats['gunmetal'], bevel=0.002)
    b.box((0.10, 0.0, BORE + 0.06), (0.03, 0.012, 0.006), mats['accent'], bevel=0.001)
    b.box((-0.08, 0.03, BORE + 0.02), (0.04, 0.012, 0.02), mats['accent_dim'], bevel=0.002)
    b.grip(mats)
    return b.join((0.522, 0.0, BORE))


def build_hash_rail(mats):
    b = Builder('hash-rail')
    # Long silver receiver, capacitor block and twin rails with charge coils
    b.box((0.04, 0.0, BORE), (0.30, 0.06, 0.084), mats['steel'], bevel=0.007)
    b.box((0.02, 0.0, BORE + 0.046), (0.20, 0.036, 0.016), mats['gunmetal'], bevel=0.003)
    b.box((-0.02, 0.0, BORE + 0.056), (0.12, 0.016, 0.006), mats['accent'], bevel=0.001)
    b.box((0.06, -0.026, BORE - 0.01), (0.14, 0.006, 0.04), mats['blue'], bevel=0.002)
    for y in (-0.02, 0.02):
        b.cyl_x(0.19, 0.78, 0.013, mats['steel_bright'], y=y, z=BORE + 0.006, vertices=16)
    b.box((0.75, 0.0, BORE + 0.006), (0.04, 0.056, 0.03), mats['gunmetal'], bevel=0.004)
    for x in (0.30, 0.44, 0.58):
        b.ring_x(x, 0.036, 0.007, mats['accent'], z=BORE + 0.006)
        b.cyl_x(x - 0.02, x + 0.02, 0.028, mats['gunmetal'], z=BORE + 0.006, bevel=0.003)
    b.box((0.37, 0.0, BORE - 0.02), (0.36, 0.03, 0.014), mats['gunmetal'], bevel=0.003)
    # Stock, cheek rest and grip
    b.box((-0.16, 0.0, BORE - 0.02), (0.12, 0.04, 0.06), mats['polymer'], rotation=(0.0, math.radians(-5), 0.0), bevel=0.008)
    b.box((-0.225, 0.0, BORE - 0.03), (0.016, 0.046, 0.09), mats['steel'], rotation=(0.0, math.radians(-5), 0.0), bevel=0.003)
    b.box((-0.16, 0.0, BORE + 0.012), (0.09, 0.044, 0.008), mats['blue'], rotation=(0.0, math.radians(-5), 0.0), bevel=0.001)
    b.grip(mats)
    return b.join((0.78, 0.0, BORE + 0.006))


def build_lightning_ledger(mats):
    b = Builder('lightning-ledger')
    # Boxy receiver with six exposed capacitor cells and a forked emitter
    b.box((0.06, 0.0, BORE), (0.30, 0.056, 0.09), mats['steel'], bevel=0.007)
    b.box((0.06, 0.0, BORE + 0.05), (0.22, 0.03, 0.012), mats['gunmetal'], bevel=0.002)
    for index in range(6):
        x = -0.06 + index * 0.044
        b.cyl_y((x, -0.03, BORE - 0.006), 0.012, 0.02, mats['accent'], vertices=14)
        b.ring_y((x, -0.036, BORE - 0.006), 0.013, 0.003, mats['gunmetal'], segments=16)
    b.box((0.06, 0.03, BORE - 0.006), (0.28, 0.004, 0.05), mats['blue'], bevel=0.001)
    b.cyl_x(0.20, 0.30, 0.03, mats['gunmetal'], z=BORE, bevel=0.003)
    b.ring_x(0.31, 0.04, 0.006, mats['accent'], z=BORE)
    for y in (-0.03, 0.03):
        b.cone_x(0.30, 0.56, 0.012, 0.007, mats['steel_bright'], y=y, z=BORE)
        b.sphere((0.56, y, BORE), 0.011, mats['accent'])
        b.box((0.42, y, BORE + 0.016), (0.08, 0.008, 0.006), mats['blue_light'], bevel=0.001)
    b.box((0.36, 0.0, BORE), (0.03, 0.06, 0.012), mats['gunmetal'], bevel=0.002)
    b.box((0.47, 0.0, BORE), (0.02, 0.06, 0.01), mats['gunmetal'], bevel=0.002)
    # Stock and grip
    b.box((-0.15, 0.0, BORE - 0.015), (0.12, 0.04, 0.06), mats['polymer'], rotation=(0.0, math.radians(-8), 0.0), bevel=0.008)
    b.box((-0.21, 0.0, BORE - 0.03), (0.016, 0.046, 0.08), mats['steel'], rotation=(0.0, math.radians(-8), 0.0), bevel=0.003)
    b.grip(mats)
    return b.join((0.56, 0.0, BORE))


def build_bear_market_burner(mats):
    b = Builder('bear-market-burner')
    # Rear fuel tank with gauge bands, armoured pump body, barrel and nozzle
    b.cyl_x(-0.27, -0.10, 0.05, mats['gunmetal'], z=BORE - 0.01, bevel=0.005)
    b.cyl_x(-0.275, -0.265, 0.036, mats['steel'], z=BORE - 0.01)
    for x in (-0.23, -0.15):
        b.ring_x(x, 0.05, 0.005, mats['blue'], z=BORE - 0.01)
    b.box((-0.19, 0.0, BORE + 0.044), (0.08, 0.024, 0.012), mats['accent_dim'], bevel=0.002)
    b.box((0.02, 0.0, BORE - 0.005), (0.24, 0.06, 0.09), mats['steel'], bevel=0.008)
    b.box((0.02, 0.0, BORE + 0.05), (0.16, 0.04, 0.014), mats['gunmetal'], bevel=0.003)
    b.cyl_y((0.0, -0.036, BORE - 0.02), 0.02, 0.016, mats['brass'], vertices=16)
    b.cyl_x(0.14, 0.52, 0.02, mats['steel'], z=BORE)
    b.cyl_x(0.16, 0.20, 0.026, mats['gunmetal'], z=BORE, bevel=0.003)
    # Perforated heat shield over the barrel
    b.box((0.33, 0.0, BORE + 0.028), (0.26, 0.05, 0.008), mats['gunmetal'], bevel=0.002)
    for index in range(6):
        b.box((0.24 + index * 0.036, 0.0, BORE + 0.028), (0.012, 0.056, 0.012), mats['dark'], bevel=0.001)
    b.cone_x(0.52, 0.60, 0.03, 0.042, mats['gunmetal'], z=BORE)
    b.cyl_x(0.595, 0.605, 0.034, mats['dark'], z=BORE)
    b.ring_x(0.575, 0.041, 0.005, mats['accent'], z=BORE)
    b.sphere((0.60, 0.0, BORE + 0.034), 0.006, mats['accent'])
    # Foregrip and fuel line
    b.box((0.26, 0.0, BORE - 0.05), (0.05, 0.03, 0.05), mats['polymer'], bevel=0.006)
    b.cyl_x(-0.10, 0.20, 0.007, mats['dark'], z=BORE - 0.048, vertices=10)
    b.grip(mats)
    return b.join((0.605, 0.0, BORE))


def build_forked_standard(mats):
    b = Builder('forked-standard')
    # A two-tine war fork: the hand closes around the shaft at the origin
    b.cyl_x(-0.40, 0.74, 0.017, mats['gunmetal'], vertices=16)
    for x in (-0.09, -0.04, 0.04, 0.09):
        b.ring_x(x, 0.015, 0.004, mats['polymer'], segments=16)
    b.box((0.0, 0.0, 0.0), (0.18, 0.036, 0.036), mats['polymer'], bevel=0.006)
    b.cyl_x(-0.45, -0.39, 0.024, mats['steel'], vertices=16, bevel=0.003)
    b.sphere((-0.46, 0.0, 0.0), 0.016, mats['blue'])
    for x in (-0.24, 0.34):
        b.ring_x(x, 0.016, 0.004, mats['blue'], segments=16)
    b.box((0.72, 0.0, 0.0), (0.09, 0.07, 0.046), mats['steel'], bevel=0.006)
    b.box((0.70, 0.0, 0.0), (0.02, 0.14, 0.02), mats['blue'], bevel=0.003)
    for y in (-0.04, 0.04):
        b.box((0.88, y, 0.006), (0.26, 0.028, 0.024), mats['steel_bright'], rotation=(0.0, 0.0, math.radians(3 if y > 0 else -3)), bevel=0.003)
        b.cone_x(1.00, 1.16, 0.022, 0.003, mats['accent'], y=y * 1.15, z=0.008)
    b.box((0.80, 0.0, 0.0), (0.04, 0.08, 0.012), mats['gunmetal'], bevel=0.002)
    return b.join((1.16, 0.0, 0.008), {'hmh_shaft_held': True})


BUILDERS = {
    'scatter-shotgun': build_scatter_shotgun,
    'auto-miner': build_auto_miner,
    'launcher-rig': build_launcher_rig,
    'hash-rail': build_hash_rail,
    'lightning-ledger': build_lightning_ledger,
    'bear-market-burner': build_bear_market_burner,
    'forked-standard': build_forked_standard,
}


def measure(obj) -> dict:
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    return {'min': [min(xs), min(ys), min(zs)], 'max': [max(xs), max(ys), max(zs)]}


def main() -> None:
    args = blender_args()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding='utf-8'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    collection = bpy.data.collections.new(manifest['scene']['collection'])
    scene.collection.children.link(collection)
    built = []
    for weapon in manifest['weapons']:
        weapon_id = weapon['weaponId']
        builder = BUILDERS.get(weapon_id)
        if builder is None:
            raise RuntimeError(f'No held-weapon builder for {weapon_id}')
        mats = palette(weapon['accent'])
        obj = builder(mats)
        for user in list(obj.users_collection):
            user.objects.unlink(obj)
        collection.objects.link(obj)
        bounds = measure(obj)
        expected = weapon['lengthMeters']
        length = bounds['max'][0] - bounds['min'][0]
        if abs(length - expected) > 0.02 and not args.measure_only:
            raise RuntimeError(f'{weapon_id} authored length {length:.3f} m drifted from manifest {expected:.3f} m')
        if any(abs(a - b) > 1e-6 for a, b in zip(obj['hmh_muzzle'], weapon['muzzle'])):
            raise RuntimeError(f'{weapon_id} muzzle {list(obj["hmh_muzzle"])} differs from manifest {weapon["muzzle"]}')
        built.append({'weaponId': weapon_id, 'object': obj.name, 'vertices': len(obj.data.vertices), 'faces': len(obj.data.polygons), 'materials': [m.name for m in obj.data.materials], 'bounds': bounds, 'lengthMeters': round(length, 4), 'muzzle': list(obj['hmh_muzzle'])})
    blend_path = Path(args.source_blend).resolve()
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    inspection = {'status': 'pass', 'pipelineId': manifest['pipelineId'], 'runtimeAuthority': manifest['runtimeAuthority'], 'weaponCount': len(built), 'weapons': built, 'externalDependencyCount': 0}
    output = Path(args.inspection_output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(inspection, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'pass', 'weaponCount': len(built)}, sort_keys=True))


if __name__ == '__main__':
    main()
