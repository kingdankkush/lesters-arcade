from __future__ import annotations

import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-blend", required=True)
    parser.add_argument("--inspection-output", required=True)
    return parser.parse_args(argv)


def load_module(path: Path, module_name: str = "hmh_commando_concepts"):
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load concept generator: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def find_variant(concept_manifest: dict, actor_id: str, variant_id: str) -> tuple[dict, dict]:
    actor = next((entry for entry in concept_manifest["actors"] if entry["id"] == actor_id), None)
    if actor is None:
        raise RuntimeError(f"Unknown actor: {actor_id}")
    variant = next((entry for entry in actor["variants"] if entry["id"] == variant_id), None)
    if variant is None:
        raise RuntimeError(f"Unknown variant: {actor_id}/{variant_id}")
    return actor, variant


def find_reference_model(reference_manifest: dict, actor_id: str, model_spec_id: str) -> dict:
    model = next((entry for entry in reference_manifest["models"] if entry["actorId"] == actor_id), None)
    if model is None or model.get("modelSpecId") != model_spec_id:
        raise RuntimeError(f"Unknown reference model: {actor_id}/{model_spec_id}")
    if model.get("anatomy") != "human" or model.get("runtimeAuthority") != "projection-only":
        raise RuntimeError(f"Invalid reference model authority: {actor_id}/{model_spec_id}")
    return model


def replace_rifle_with_pistol(concept, collection, rig, mats, actor_id: str, variant_id: str) -> None:
    for obj in list(collection.objects):
        if "_Weapon_" in obj.name:
            bpy.data.objects.remove(obj, do_unlink=True)

    prefix = f"{actor_id}_{variant_id}_Pistol"
    concept.cylinder(
        prefix + "_Barrel",
        (0.0, -0.48, 1.26),
        0.042,
        0.34,
        mats["charcoal"],
        collection,
        rotation=(math.radians(90), 0, 0),
        bone="weapon_socket",
        rig=rig,
        vertices=24,
    )
    concept.cylinder(
        prefix + "_Muzzle",
        (0.0, -0.66, 1.26),
        0.065,
        0.05,
        mats["silver_dark"],
        collection,
        rotation=(math.radians(90), 0, 0),
        bone="weapon_socket",
        rig=rig,
        vertices=24,
    )
    concept.cube(
        prefix + "_Receiver",
        (0.0, -0.31, 1.25),
        (0.11, 0.17, 0.095),
        mats["silver_dark"],
        collection,
        bevel=0.035,
        bone="weapon_socket",
        rig=rig,
    )
    concept.cube(
        prefix + "_Slide",
        (0.0, -0.36, 1.34),
        (0.09, 0.19, 0.045),
        mats["blue"],
        collection,
        bevel=0.025,
        bone="weapon_socket",
        rig=rig,
    )
    concept.cube(
        prefix + "_EnergyCell",
        (0.105, -0.31, 1.26),
        (0.025, 0.10, 0.045),
        mats["cyan"],
        collection,
        bevel=0.012,
        bone="weapon_socket",
        rig=rig,
    )
    concept.cube(
        prefix + "_Grip",
        (0.0, -0.14, 1.10),
        (0.075, 0.065, 0.14),
        mats["charcoal"],
        collection,
        bevel=0.025,
        rotation=(math.radians(-10), 0, 0),
        bone="weapon_socket",
        rig=rig,
    )


def semantic_layer(obj) -> str:
    name = obj.name
    if "GroundShadow" in name:
        return "shadow"
    if "_Pistol_" in name:
        return "weapon"
    lower_tokens = (
        "_Pelvis",
        "_Thigh_",
        "_Knee_",
        "_Shin_",
        "_Boot_",
        "_HipPlate",
        "_EnergyBelt",
        "_CoatPanel_",
        "_CargoThigh_",
        "_CargoPocket_",
        "_GoldBelt",
        "_ReferenceBelt",
        "_ReferenceBuckle",
        "_ReferencePouch_",
        "_ReferenceKneeGuard_",
        "_ReferenceBootSole_",
        "_ReferenceKnife",
        "_ReferenceHolster",
    )
    if any(token in name for token in lower_tokens):
        return "lower-body"
    return "torso-head"


def actor_materials(concept, mats, actor_id: str) -> dict:
    themed = dict(mats)
    if actor_id == "lester-original":
        themed.update({
            "blue": concept.material("Lester blue", "#155bd7", metallic=0.18),
            "cyan": concept.material("Lester mask white", "#f4f8ff"),
            "silver": concept.material("Lester cargo tan", "#8a744f"),
            "silver_dark": concept.material("Lester boot black", "#141b22", metallic=0.12),
            "charcoal": concept.material("Lester tactical black", "#1c252b"),
            "teal": concept.material("Lester scarf blue", "#0c48ba"),
            "teal_light": concept.material("Lester brass", "#c58b32", metallic=0.42),
            "olive": concept.material("Lester olive vest", "#3d4932", metallic=0.06),
            "olive_dark": concept.material("Lester olive webbing", "#242d22", metallic=0.08),
        })
    elif actor_id == "lilly":
        themed.update({
            "blue": concept.material("Lilly veteran gold", "#c8932f", metallic=0.38),
            "cyan": concept.material("Lilly lens cyan", "#7af5ed", emission=0.25),
            "silver": concept.material("Lilly gold plate", "#d4a542", metallic=0.45),
            "silver_dark": concept.material("Lilly dark plate", "#20272c", metallic=0.22),
            "charcoal": concept.material("Lilly tactical black", "#11191d"),
            "teal": concept.material("Lilly hair teal", "#079e9b"),
            "teal_light": concept.material("Lilly teal light", "#59eee4", emission=0.38),
            "teal_dark": concept.material("Lilly deep teal", "#045f62", metallic=0.12),
            "gold": concept.material("Lilly piping gold", "#d8a93b", metallic=0.48),
            "skin": concept.material("Lilly skin", "#d3a080"),
            "eye_white": concept.material("Lilly eye white", "#f4fbf9"),
            "eye_teal": concept.material("Lilly teal green eyes", "#22cbb7", emission=0.12),
            "lens": concept.material("Lilly teal lenses", "#78e9df", alpha=0.62, emission=0.12),
            "lip": concept.material("Lilly lips", "#9b5968"),
        })
    elif actor_id == "lit-commando":
        themed.update({
            "blue": concept.material("Commando olive shirt", "#4c5835"),
            "cyan": concept.material("Commando brass", "#b68a43", metallic=0.34),
            "silver": concept.material("Commando gunmetal", "#46505a", metallic=0.30),
            "silver_dark": concept.material("Commando boot dark", "#151b1d", metallic=0.08),
            "charcoal": concept.material("Commando cargo charcoal", "#232a27"),
            "teal": concept.material("Commando olive webbing", "#313a27"),
            "teal_light": concept.material("Commando brass light", "#d1a755", metallic=0.40),
            "skin": concept.material("Commando skin", "#b97956"),
            "eye_white": concept.material("Commando eye white", "#f0e9dc"),
            "eye_dark": concept.material("Commando dark eyes", "#35281f"),
            "hair_dark": concept.material("Commando dark hair", "#17191a"),
            "headband_red": concept.material("Commando headband red", "#a92525"),
            "olive": concept.material("Commando olive field shirt", "#59643d"),
            "olive_dark": concept.material("Commando webbing black olive", "#252c21"),
            "steel": concept.material("Commando knife steel", "#9ba4a6", metallic=0.55),
            "scar": concept.material("Commando scar", "#8c4f3d"),
        })
    elif actor_id == "lit-valkyrie":
        themed.update({
            "blue": concept.material("Valkyrie field olive", "#5b6844"),
            "cyan": concept.material("Valkyrie mint identification", "#7be1cf", emission=0.18),
            "silver": concept.material("Valkyrie field steel", "#667078", metallic=0.24),
            "silver_dark": concept.material("Valkyrie boot charcoal", "#171d20", metallic=0.08),
            "charcoal": concept.material("Valkyrie cargo charcoal", "#242a2b"),
            "teal": concept.material("Valkyrie fitted olive top", "#4d5c3d", metallic=0.04),
            "teal_light": concept.material("Valkyrie mint accent", "#72d8c6", emission=0.16),
            "skin": concept.material("Valkyrie skin", "#d2a083"),
            "eye_white": concept.material("Valkyrie eye white", "#f5f2e9"),
            "eye_dark": concept.material("Valkyrie eye dark", "#273136"),
            "eye_mint": concept.material("Valkyrie mint eyes", "#55bfae", emission=0.08),
            # Audit 2026-07-30: platinum #e4ddc5 against shadow #aaa58f and skin
            # #d2a083 left the entire head within a narrow lightness band, so at
            # 160px the face vanished into the hair. The shadow tone now sits a
            # full value step down and a dedicated dark brow anchors the face.
            "hair_platinum": concept.material("Valkyrie platinum hair", "#e8dfc2", metallic=0.03),
            "hair_shadow": concept.material("Valkyrie platinum shadow", "#78715a", metallic=0.02),
            "brow_dark": concept.material("Valkyrie brow", "#3c382b"),
            "olive": concept.material("Valkyrie olive top", "#586644"),
            "olive_dark": concept.material("Valkyrie black olive harness", "#293126"),
            "mint": concept.material("Valkyrie restrained mint", "#6fd0bd", emission=0.30),
            "steel": concept.material("Valkyrie holster steel", "#929b9d", metallic=0.42),
            "lip": concept.material("Valkyrie lips", "#9f6770"),
        })
    return themed


def add_lester_reference_details(concept, collection, rig, themed, actor_id: str, variant_id: str, model_spec: dict) -> dict:
    detail_kit = model_spec.get("detailKit", {})
    if detail_kit.get("kind") != "reference-lester-combat-v1":
        raise RuntimeError(f"Unknown reference detail kit: {detail_kit.get('kind')}")
    prefix = f"{actor_id}_{variant_id}"
    before = set(collection.objects.keys())

    # Mascot identity: a large blue spherical head, readable white italic-L
    # construction, expressive eyes/brows and a smile. These are separate
    # meshes so future face animation can remain projection-only.
    concept.sphere(prefix + "_ReferenceBlueMaskShell", (0, 0, 1.82), (0.285, 0.265, 0.295), themed["blue"], collection, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceLogoStemUpper", (-0.030, -0.210, 1.965), (0.044, 0.008, 0.085), themed["cyan"], collection, bevel=0.016, rotation=(0, 0, math.radians(-6)), bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceLogoStemLower", (-0.014, -0.258, 1.805), (0.046, 0.008, 0.100), themed["cyan"], collection, bevel=0.016, rotation=(0, 0, math.radians(-6)), bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceLogoCrossbar", (0.025, -0.263, 1.755), (0.145, 0.008, 0.032), themed["cyan"], collection, bevel=0.013, rotation=(0, 0, math.radians(-6)), bone="head", rig=rig)
    for side, sign in (("L", -1), ("R", 1)):
        concept.sphere(prefix + f"_ReferenceEyeWhite_{side}", (sign * 0.102, -0.248, 1.87), (0.071, 0.009, 0.080), themed["cyan"], collection, bone="head", rig=rig)
        concept.sphere(prefix + f"_ReferenceEyePupil_{side}", (sign * 0.102, -0.259, 1.87), (0.027, 0.005, 0.036), themed["charcoal"], collection, bone="head", rig=rig)
        concept.cube(prefix + f"_ReferenceBrow_{side}", (sign * 0.105, -0.220, 1.965), (0.060, 0.006, 0.012), themed["charcoal"], collection, bevel=0.008, rotation=(0, 0, math.radians(sign * 8)), bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceSmileCenter", (0, -0.245, 1.695), (0.105, 0.006, 0.014), themed["charcoal"], collection, bevel=0.010, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceSmileL", (-0.105, -0.228, 1.713), (0.030, 0.006, 0.012), themed["charcoal"], collection, bevel=0.008, rotation=(0, 0, math.radians(-22)), bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceSmileR", (0.105, -0.228, 1.713), (0.030, 0.006, 0.012), themed["charcoal"], collection, bevel=0.008, rotation=(0, 0, math.radians(22)), bone="head", rig=rig)

    # Pixel-sheet combat silhouette: olive vest/webbing, bandolier, cargo
    # storage, gloves, knee protection, scarf tails and heavy boots.
    concept.cube(prefix + "_ReferenceVestFront", (0, -0.205, 1.29), (0.315, 0.085, 0.275), themed["olive"], collection, bevel=0.070, bone="chest", rig=rig)
    for side, sign in (("L", -1), ("R", 1)):
        concept.cube(prefix + f"_ReferenceVestSide_{side}", (sign * 0.285, -0.03, 1.28), (0.075, 0.155, 0.245), themed["olive_dark"], collection, bevel=0.045, bone="chest", rig=rig)
        concept.cube(prefix + f"_ReferenceShoulderStrap_{side}", (sign * 0.19, -0.255, 1.43), (0.040, 0.020, 0.175), themed["olive_dark"], collection, bevel=0.014, bone="chest", rig=rig)
        concept.cylinder(prefix + f"_ReferenceCargoThigh_{side}", (sign * 0.16, 0, 0.54), 0.148, 0.44, themed["silver"], collection, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceCargoPocket_{side}", (sign * 0.22, -0.14, 0.56), (0.082, 0.038, 0.105), themed["olive"], collection, bevel=0.025, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceGlove_{side}", (sign * 0.46, -0.15, 0.92), (0.105, 0.105, 0.072), themed["olive_dark"], collection, bevel=0.040, bone=f"forearm.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceWristWrap_{side}", (sign * 0.49, -0.08, 1.035), (0.112, 0.125, 0.048), themed["teal"], collection, bevel=0.025, bone=f"forearm.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceKneeGuard_{side}", (sign * 0.16, -0.155, 0.35), (0.145, 0.075, 0.105), themed["olive_dark"], collection, bevel=0.050, bone=f"shin.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceBootSole_{side}", (sign * 0.16, -0.10, 0.018), (0.15, 0.235, 0.030), themed["silver_dark"], collection, bevel=0.018, bone=f"shin.{side}", rig=rig)

    concept.cube(prefix + "_ReferenceBelt", (0, -0.215, 0.87), (0.30, 0.036, 0.050), themed["olive_dark"], collection, bevel=0.016, bone="pelvis", rig=rig)
    concept.cube(prefix + "_ReferenceBuckle", (0, -0.258, 0.87), (0.065, 0.018, 0.055), themed["teal_light"], collection, bevel=0.012, bone="pelvis", rig=rig)
    for index, x in enumerate((-0.235, -0.12, 0.12, 0.235)):
        concept.cube(prefix + f"_ReferencePouch_{index}", (x, -0.245, 0.84), (0.052, 0.040, 0.075), themed["olive"], collection, bevel=0.018, bone="pelvis", rig=rig)
    concept.cube(prefix + "_ReferenceBandolierStrap", (0, -0.270, 1.30), (0.315, 0.022, 0.035), themed["olive_dark"], collection, bevel=0.015, rotation=(0, 0, math.radians(-26)), bone="chest", rig=rig)
    for index in range(8):
        x = -0.205 + index * 0.058
        z = 1.47 - index * 0.052
        concept.cube(prefix + f"_ReferenceBandolierRound_{index}", (x, -0.300, z), (0.025, 0.024, 0.055), themed["teal_light"], collection, bevel=0.011, rotation=(0, 0, math.radians(-26)), bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceScarfCollar", (0, -0.02, 1.53), (0.265, 0.17, 0.080), themed["teal"], collection, bevel=0.055, bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceScarfTailA", (-0.18, 0.15, 1.43), (0.060, 0.21, 0.052), themed["teal"], collection, bevel=0.032, rotation=(math.radians(18), 0, math.radians(-22)), bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceScarfTailB", (-0.04, 0.18, 1.39), (0.052, 0.18, 0.047), themed["teal"], collection, bevel=0.030, rotation=(math.radians(-12), 0, math.radians(12)), bone="chest", rig=rig)

    authored_names = sorted(set(collection.objects.keys()) - before)
    minimum = detail_kit.get("minimumAuthoredParts")
    if not isinstance(minimum, int) or len(authored_names) < minimum:
        raise RuntimeError(f"Lester reference detail kit has {len(authored_names)} parts; minimumAuthoredParts={minimum}")
    return {
        "detailKitKind": detail_kit["kind"],
        "authoredReferencePartCount": len(authored_names),
        "authoredReferenceParts": authored_names,
    }


def add_lilly_reference_details(concept, collection, rig, themed, actor_id: str, variant_id: str, model_spec: dict) -> dict:
    detail_kit = model_spec.get("detailKit", {})
    if detail_kit.get("kind") != "reference-lilly-combat-v1":
        raise RuntimeError(f"Unknown Lilly reference detail kit: {detail_kit.get('kind')}")
    hair_spec = model_spec.get("hair", {})
    minimum_locks = hair_spec.get("minimumRiggedLocks")
    if not isinstance(minimum_locks, int) or minimum_locks < 9:
        raise RuntimeError(f"Invalid Lilly minimumRiggedLocks: {minimum_locks}")

    prefix = f"{actor_id}_{variant_id}"
    # Remove the generic five-block pilot hair/temple proxy before the
    # reference kit is measured. The rounded crown remains as an under-mass.
    for suffix in ("_ShortHair", "_TempleGuard"):
        stale = collection.objects.get(prefix + suffix)
        if stale is not None:
            bpy.data.objects.remove(stale, do_unlink=True)
    before = set(collection.objects.keys())

    # Recognizable face: separate eyes, pupils, brows, nose and softly shaped
    # mouth remain readable under the glasses at the 160x160 camera contract.
    for side, sign in (("L", -1), ("R", 1)):
        concept.sphere(prefix + f"_ReferenceEyeWhite_{side}", (sign * 0.078, -0.183, 1.80), (0.058, 0.012, 0.050), themed["eye_white"], collection, bone="head", rig=rig)
        concept.sphere(prefix + f"_ReferenceEyePupil_{side}", (sign * 0.078, -0.198, 1.80), (0.022, 0.006, 0.027), themed["eye_teal"], collection, bone="head", rig=rig)
        concept.cube(prefix + f"_ReferenceBrow_{side}", (sign * 0.080, -0.186, 1.870), (0.052, 0.008, 0.010), themed["teal_dark"], collection, bevel=0.007, rotation=(0, 0, math.radians(sign * 7)), bone="head", rig=rig)
    concept.sphere(prefix + "_ReferenceNose", (0, -0.199, 1.748), (0.025, 0.014, 0.034), themed["skin"], collection, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceLipCenter", (0, -0.198, 1.695), (0.060, 0.008, 0.011), themed["lip"], collection, bevel=0.008, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceLipL", (-0.055, -0.193, 1.701), (0.020, 0.007, 0.009), themed["lip"], collection, bevel=0.006, rotation=(0, 0, math.radians(-10)), bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceLipR", (0.055, -0.193, 1.701), (0.020, 0.007, 0.009), themed["lip"], collection, bevel=0.006, rotation=(0, 0, math.radians(10)), bone="head", rig=rig)

    # Teal-lens round glasses. The translucent lenses sit behind the gold
    # rims, preserving eye color while keeping the signature silhouette.
    for side, sign in (("L", -1), ("R", 1)):
        concept.sphere(prefix + f"_ReferenceGlassesLens_{side}", (sign * 0.083, -0.205, 1.80), (0.074, 0.008, 0.067), themed["lens"], collection, bone="head", rig=rig)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.078, minor_radius=0.010, major_segments=24, minor_segments=8, location=(sign * 0.083, -0.214, 1.80), rotation=(math.radians(90), 0, 0))
        glasses = bpy.context.object
        glasses.name = prefix + f"_ReferenceRoundGlasses_{side}"
        glasses.data.materials.append(themed["gold"])
        concept.move_to_collection(glasses, collection)
        concept.attach_to_bone(glasses, rig, "head")
    concept.cube(prefix + "_ReferenceGlassesBridge", (0, -0.214, 1.80), (0.024, 0.010, 0.009), themed["gold"], collection, bevel=0.007, bone="head", rig=rig)

    # Twelve separated crown/side/back lock groups replace the five box proxy.
    # Their staggered masses create a wavy mid-back silhouette from all views
    # while leaving the front shoulders and weapon stock clear.
    hair_locks = (
        (-0.185, 0.135, 1.58, 0.072, 0.082, 0.255),
        (-0.115, 0.165, 1.50, 0.075, 0.085, 0.300),
        (-0.040, 0.180, 1.47, 0.076, 0.090, 0.325),
        (0.040, 0.180, 1.47, 0.076, 0.090, 0.325),
        (0.115, 0.165, 1.50, 0.075, 0.085, 0.300),
        (0.185, 0.135, 1.58, 0.072, 0.082, 0.255),
        (-0.215, 0.020, 1.61, 0.066, 0.070, 0.225),
        (0.215, 0.020, 1.61, 0.066, 0.070, 0.225),
        (-0.185, -0.045, 1.70, 0.060, 0.055, 0.175),
        (0.185, -0.045, 1.70, 0.060, 0.055, 0.175),
        (-0.095, 0.025, 1.94, 0.105, 0.115, 0.115),
        (0.095, 0.025, 1.94, 0.105, 0.115, 0.115),
    )
    for index, (x, y, z, sx, sy, sz) in enumerate(hair_locks):
        material = themed["teal"] if index % 3 else themed["teal_dark"]
        concept.sphere(prefix + f"_ReferenceHairLock_{index:02d}", (x, y, z), (sx, sy, sz), material, collection, bone="head", rig=rig)

    # Practical black/teal combat jacket with gold piping, shoulder identity,
    # gloves, cargo storage, knee protection and grounded lace-up boot accents.
    for side, sign in (("L", -1), ("R", 1)):
        concept.cube(prefix + f"_ReferenceJacketFront_{side}", (sign * 0.125, -0.215, 1.28), (0.112, 0.045, 0.225), themed["charcoal"], collection, bevel=0.040, bone="chest", rig=rig)
        concept.cube(prefix + f"_ReferenceTealLapel_{side}", (sign * 0.105, -0.266, 1.355), (0.075, 0.018, 0.115), themed["teal_dark"], collection, bevel=0.018, rotation=(0, 0, math.radians(sign * 12)), bone="chest", rig=rig)
        concept.cube(prefix + f"_ReferenceGoldPiping_{side}", (sign * 0.218, -0.258, 1.28), (0.014, 0.016, 0.220), themed["gold"], collection, bevel=0.008, bone="chest", rig=rig)
        concept.cube(prefix + f"_ReferenceShoulderPiping_{side}", (sign * 0.300, -0.165, 1.47), (0.090, 0.020, 0.016), themed["gold"], collection, bevel=0.008, bone=f"upper_arm.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceGlove_{side}", (sign * 0.46, -0.15, 0.92), (0.105, 0.105, 0.072), themed["charcoal"], collection, bevel=0.040, bone=f"forearm.{side}", rig=rig)
        concept.cylinder(prefix + f"_ReferenceCargoThigh_{side}", (sign * 0.16, 0, 0.54), 0.140, 0.43, themed["teal_dark"], collection, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceCargoPocket_{side}", (sign * 0.215, -0.135, 0.56), (0.072, 0.036, 0.095), themed["charcoal"], collection, bevel=0.022, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceKneeGuard_{side}", (sign * 0.16, -0.150, 0.35), (0.135, 0.070, 0.100), themed["charcoal"], collection, bevel=0.045, bone=f"shin.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceBootSole_{side}", (sign * 0.16, -0.105, 0.018), (0.145, 0.230, 0.028), themed["gold"], collection, bevel=0.015, bone=f"shin.{side}", rig=rig)
    concept.cube(prefix + "_ReferenceGoldWaistPiping", (0, -0.258, 1.075), (0.220, 0.016, 0.015), themed["gold"], collection, bevel=0.008, bone="spine", rig=rig)
    concept.cube(prefix + "_ReferenceGoldCollar", (0, -0.190, 1.49), (0.215, 0.040, 0.050), themed["gold"], collection, bevel=0.022, bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceShoulderPatch", (-0.305, -0.190, 1.43), (0.080, 0.016, 0.062), themed["teal_dark"], collection, bevel=0.015, bone="upper_arm.L", rig=rig)
    concept.cube(prefix + "_ReferenceShoulderLStem", (-0.315, -0.210, 1.435), (0.012, 0.006, 0.036), themed["gold"], collection, bevel=0.005, bone="upper_arm.L", rig=rig)
    concept.cube(prefix + "_ReferenceShoulderLCrossbar", (-0.295, -0.210, 1.407), (0.030, 0.006, 0.010), themed["gold"], collection, bevel=0.005, bone="upper_arm.L", rig=rig)
    concept.cube(prefix + "_ReferenceBelt", (0, -0.215, 0.87), (0.275, 0.034, 0.048), themed["charcoal"], collection, bevel=0.015, bone="pelvis", rig=rig)
    concept.cube(prefix + "_ReferenceBuckle", (0, -0.255, 0.87), (0.060, 0.016, 0.052), themed["gold"], collection, bevel=0.011, bone="pelvis", rig=rig)
    concept.cube(prefix + "_ReferenceBuckleLStem", (-0.006, -0.273, 0.878), (0.009, 0.005, 0.027), themed["teal_dark"], collection, bevel=0.004, bone="pelvis", rig=rig)
    concept.cube(prefix + "_ReferenceBuckleLCrossbar", (0.008, -0.273, 0.858), (0.022, 0.005, 0.008), themed["teal_dark"], collection, bevel=0.004, bone="pelvis", rig=rig)
    for index, x in enumerate((-0.225, -0.115, 0.115, 0.225)):
        concept.cube(prefix + f"_ReferencePouch_{index}", (x, -0.242, 0.82), (0.048, 0.036, 0.070), themed["teal_dark"], collection, bevel=0.016, bone="pelvis", rig=rig)

    authored_names = sorted(set(collection.objects.keys()) - before)
    hair_names = [name for name in authored_names if "_ReferenceHairLock_" in name]
    if len(hair_names) < minimum_locks:
        raise RuntimeError(f"Lilly reference hair has {len(hair_names)} locks; minimumRiggedLocks={minimum_locks}")
    minimum = detail_kit.get("minimumAuthoredParts")
    if not isinstance(minimum, int) or len(authored_names) < minimum:
        raise RuntimeError(f"Lilly reference detail kit has {len(authored_names)} parts; minimumAuthoredParts={minimum}")
    return {
        "detailKitKind": detail_kit["kind"],
        "riggedHairLockCount": len(hair_names),
        "authoredReferencePartCount": len(authored_names),
        "authoredReferenceParts": authored_names,
    }


def add_lit_commando_reference_details(concept, collection, rig, themed, actor_id: str, variant_id: str, model_spec: dict) -> dict:
    detail_kit = model_spec.get("detailKit", {})
    if detail_kit.get("kind") != "lit-commando-rambo-v1":
        raise RuntimeError(f"Unknown reference detail kit: {detail_kit.get('kind')}")
    prefix = f"{actor_id}_{variant_id}"

    # Remove the concept-pilot helmet, visor and plated arms. The reference
    # identity is a visible human survivor with bare muscular arms.
    removable_suffixes = (
        "_Helmet", "_Visor", "_Shoulder_L", "_Shoulder_R",
        "_UpperArm_L", "_UpperArm_R", "_Forearm_L", "_Forearm_R",
    )
    for suffix in removable_suffixes:
        obj = bpy.data.objects.get(prefix + suffix)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)

    before = set(collection.objects.keys())

    # Human square-jawed face, dark eyes, field scar and layered dark hair.
    for side, sign in (("L", -1), ("R", 1)):
        concept.sphere(prefix + f"_ReferenceEyeWhite_{side}", (sign * 0.078, -0.184, 1.79), (0.057, 0.014, 0.043), themed["eye_white"], collection, bone="head", rig=rig)
        concept.sphere(prefix + f"_ReferencePupil_{side}", (sign * 0.078, -0.199, 1.79), (0.025, 0.010, 0.027), themed["eye_dark"], collection, bone="head", rig=rig)
        concept.cube(prefix + f"_ReferenceBrow_{side}", (sign * 0.078, -0.196, 1.855), (0.060, 0.012, 0.013), themed["hair_dark"], collection, bevel=0.008, rotation=(0, 0, math.radians(sign * -7)), bone="head", rig=rig)
        concept.cube(prefix + f"_ReferenceJaw_{side}", (sign * 0.153, -0.040, 1.665), (0.052, 0.112, 0.078), themed["skin"], collection, bevel=0.030, rotation=(0, 0, math.radians(sign * 5)), bone="head", rig=rig)
    concept.sphere(prefix + "_ReferenceNose", (0, -0.199, 1.735), (0.033, 0.025, 0.045), themed["skin"], collection, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceMouth", (0, -0.198, 1.682), (0.060, 0.010, 0.010), themed["scar"], collection, bevel=0.006, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceChin", (0, -0.146, 1.642), (0.112, 0.052, 0.052), themed["skin"], collection, bevel=0.032, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceScarA", (-0.118, -0.199, 1.780), (0.010, 0.006, 0.048), themed["scar"], collection, bevel=0.004, rotation=(0, 0, math.radians(-18)), bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceScarB", (-0.104, -0.199, 1.745), (0.009, 0.006, 0.025), themed["scar"], collection, bevel=0.004, rotation=(0, 0, math.radians(24)), bone="head", rig=rig)
    concept.sphere(prefix + "_ReferenceHairCap", (0, 0.045, 1.895), (0.205, 0.185, 0.135), themed["hair_dark"], collection, bone="head", rig=rig)
    for index, (x, y, z, rz) in enumerate(((-0.105, -0.015, 1.980, -18), (0.0, -0.025, 2.010, 0), (0.105, -0.010, 1.980, 18))):
        concept.cube(prefix + f"_ReferenceHairTuft_{index}", (x, y, z), (0.065, 0.080, 0.065), themed["hair_dark"], collection, bevel=0.035, rotation=(0, math.radians(rz * 0.35), math.radians(rz)), bone="head", rig=rig)

    # Red combat headband and two trailing tails retain a strong directional
    # read without becoming a helmet or obscuring the weapon line.
    concept.cube(prefix + "_ReferenceHeadbandFront", (0, -0.188, 1.887), (0.195, 0.025, 0.028), themed["headband_red"], collection, bevel=0.012, bone="head", rig=rig)
    for side, sign in (("L", -1), ("R", 1)):
        concept.cube(prefix + f"_ReferenceHeadbandSide_{side}", (sign * 0.184, -0.015, 1.885), (0.025, 0.150, 0.028), themed["headband_red"], collection, bevel=0.012, bone="head", rig=rig)
    concept.sphere(prefix + "_ReferenceHeadbandKnot", (0.145, 0.155, 1.875), (0.055, 0.050, 0.050), themed["headband_red"], collection, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceHeadbandTail_L", (0.105, 0.260, 1.775), (0.035, 0.145, 0.026), themed["headband_red"], collection, bevel=0.014, rotation=(math.radians(-18), 0, math.radians(-10)), bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceHeadbandTail_R", (0.190, 0.240, 1.815), (0.035, 0.125, 0.026), themed["headband_red"], collection, bevel=0.014, rotation=(math.radians(14), 0, math.radians(18)), bone="head", rig=rig)

    # Bare muscular arms and compact wrist wraps replace the metallic pilot
    # pauldrons while keeping the shared fourteen-bone animation contract.
    for side, sign in (("L", -1), ("R", 1)):
        concept.sphere(prefix + f"_ReferenceShoulderMuscle_{side}", (sign * 0.365, 0, 1.430), (0.155, 0.175, 0.155), themed["skin"], collection, bone=f"upper_arm.{side}", rig=rig)
        concept.cylinder(prefix + f"_ReferenceUpperArm_{side}", (sign * 0.430, 0, 1.235), 0.112, 0.38, themed["skin"], collection, rotation=(0, math.radians(sign * 18), 0), bone=f"upper_arm.{side}", rig=rig)
        concept.cylinder(prefix + f"_ReferenceForearm_{side}", (sign * 0.500, -0.040, 1.035), 0.104, 0.34, themed["skin"], collection, rotation=(0, math.radians(sign * 12), 0), bone=f"forearm.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceWristWrap_{side}", (sign * 0.480, -0.090, 0.930), (0.115, 0.110, 0.065), themed["olive_dark"], collection, bevel=0.040, bone=f"forearm.{side}", rig=rig)

    # Sleeveless olive field shirt, black-olive webbing, ammunition and tags.
    concept.cube(prefix + "_ReferenceShirtFront_L", (-0.130, -0.220, 1.285), (0.125, 0.040, 0.270), themed["olive"], collection, bevel=0.045, bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceShirtFront_R", (0.130, -0.220, 1.285), (0.125, 0.040, 0.270), themed["olive"], collection, bevel=0.045, bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceShirtCollar", (0, -0.245, 1.505), (0.145, 0.025, 0.042), themed["olive_dark"], collection, bevel=0.018, bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceShirtHem", (0, -0.245, 1.055), (0.275, 0.025, 0.035), themed["olive_dark"], collection, bevel=0.014, bone="spine", rig=rig)
    concept.cube(prefix + "_ReferenceWebbingA", (-0.105, -0.270, 1.300), (0.040, 0.020, 0.300), themed["olive_dark"], collection, bevel=0.012, rotation=(0, 0, math.radians(-18)), bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceWebbingB", (0.105, -0.270, 1.300), (0.040, 0.020, 0.300), themed["olive_dark"], collection, bevel=0.012, rotation=(0, 0, math.radians(18)), bone="chest", rig=rig)
    for index, x in enumerate((-0.155, -0.095, -0.035, 0.025, 0.085, 0.145)):
        concept.cube(prefix + f"_ReferenceAmmo_{index}", (x, -0.303, 1.340 - index * 0.015), (0.022, 0.018, 0.060), themed["teal_light"], collection, bevel=0.008, rotation=(0, 0, math.radians(-18)), bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceDogTagChain", (0, -0.294, 1.410), (0.006, 0.008, 0.090), themed["steel"], collection, bevel=0.003, bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceDogTag", (0, -0.304, 1.325), (0.025, 0.010, 0.035), themed["steel"], collection, bevel=0.008, bone="chest", rig=rig)

    # Cargo trousers, practical pouches, knife sheath and grounded heavy boots.
    concept.cube(prefix + "_ReferenceBelt", (0, -0.215, 0.870), (0.300, 0.034, 0.050), themed["olive_dark"], collection, bevel=0.014, bone="pelvis", rig=rig)
    concept.cube(prefix + "_ReferenceBuckle", (0, -0.255, 0.870), (0.060, 0.018, 0.050), themed["teal_light"], collection, bevel=0.010, bone="pelvis", rig=rig)
    for index, x in enumerate((-0.235, -0.115, 0.115, 0.235)):
        concept.cube(prefix + f"_ReferencePouch_{index}", (x, -0.245, 0.810), (0.050, 0.038, 0.072), themed["olive_dark"], collection, bevel=0.016, bone="pelvis", rig=rig)
    for side, sign in (("L", -1), ("R", 1)):
        concept.cube(prefix + f"_ReferenceCargoThigh_{side}", (sign * 0.160, -0.080, 0.570), (0.145, 0.105, 0.205), themed["charcoal"], collection, bevel=0.050, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceCargoPocket_{side}", (sign * 0.245, -0.120, 0.580), (0.055, 0.045, 0.095), themed["olive_dark"], collection, bevel=0.018, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceKneeGuard_{side}", (sign * 0.160, -0.195, 0.340), (0.145, 0.055, 0.112), themed["olive"], collection, bevel=0.035, bone=f"shin.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceBootSole_{side}", (sign * 0.160, -0.115, 0.035), (0.155, 0.235, 0.035), themed["silver_dark"], collection, bevel=0.022, bone=f"shin.{side}", rig=rig)
    concept.cube(prefix + "_ReferenceKnifeSheath", (0.255, -0.055, 0.570), (0.050, 0.065, 0.175), themed["silver_dark"], collection, bevel=0.020, rotation=(0, 0, math.radians(-7)), bone="thigh.R", rig=rig)
    concept.cube(prefix + "_ReferenceKnifeHandle", (0.255, -0.070, 0.735), (0.045, 0.050, 0.070), themed["steel"], collection, bevel=0.015, rotation=(0, 0, math.radians(-7)), bone="thigh.R", rig=rig)

    authored_names = sorted(set(collection.objects.keys()) - before)
    minimum = detail_kit.get("minimumAuthoredParts")
    if not isinstance(minimum, int) or len(authored_names) < minimum:
        raise RuntimeError(f"Lit Commando reference detail kit has {len(authored_names)} parts; minimumAuthoredParts={minimum}")
    return {
        "detailKitKind": detail_kit["kind"],
        "authoredReferencePartCount": len(authored_names),
        "authoredReferenceParts": authored_names,
    }


def add_lit_valkyrie_reference_details(concept, collection, rig, themed, actor_id: str, variant_id: str, model_spec: dict) -> dict:
    detail_kit = model_spec.get("detailKit", {})
    if detail_kit.get("kind") != "lit-valkyrie-rambo-v1":
        raise RuntimeError(f"Unknown Lit Valkyrie reference detail kit: {detail_kit.get('kind')}")
    hair_spec = model_spec.get("hair", {})
    minimum_locks = hair_spec.get("minimumRiggedLocks")
    if not isinstance(minimum_locks, int) or minimum_locks < 7:
        raise RuntimeError(f"Invalid Lit Valkyrie minimumRiggedLocks: {minimum_locks}")

    prefix = f"{actor_id}_{variant_id}"
    # Remove the generic armored pilot shell and short-hair proxy. The
    # reference identity is an athletic human commando with a visible face,
    # bare arms and a long high ponytail/braid.
    removable_suffixes = (
        "_ChestPlate", "_ChestStripe", "_Shoulder_L", "_Shoulder_R",
        "_UpperArm_L", "_UpperArm_R", "_Forearm_L", "_Forearm_R",
        "_Knee_L", "_Knee_R", "_HairCap", "_ShortHair", "_TempleGuard",
    )
    for suffix in removable_suffixes:
        obj = bpy.data.objects.get(prefix + suffix)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)

    before = set(collection.objects.keys())

    # Visible feminine face with restrained mint identification marks. No
    # visor, glasses or helmet covers the human facial read.
    for side, sign in (("L", -1), ("R", 1)):
        concept.sphere(prefix + f"_ReferenceEyeWhite_{side}", (sign * 0.076, -0.186, 1.785), (0.064, 0.015, 0.050), themed["eye_white"], collection, bone="head", rig=rig)
        concept.sphere(prefix + f"_ReferenceEyeIris_{side}", (sign * 0.076, -0.200, 1.785), (0.034, 0.011, 0.034), themed["eye_mint"], collection, bone="head", rig=rig)
        concept.sphere(prefix + f"_ReferenceEyePupil_{side}", (sign * 0.076, -0.208, 1.785), (0.016, 0.008, 0.018), themed["eye_dark"], collection, bone="head", rig=rig)
        # Brows were drawn in the pale hair-shadow tone and disappeared against
        # the skin; they are the strongest single facial anchor at 160px.
        concept.cube(prefix + f"_ReferenceBrow_{side}", (sign * 0.078, -0.196, 1.850), (0.060, 0.011, 0.014), themed["brow_dark"], collection, bevel=0.007, rotation=(0, 0, math.radians(sign * -8)), bone="head", rig=rig)
        concept.cube(prefix + f"_ReferenceCheekMark_{side}", (sign * 0.125, -0.190, 1.720), (0.032, 0.009, 0.012), themed["mint"], collection, bevel=0.005, rotation=(0, 0, math.radians(sign * 12)), bone="head", rig=rig)
    concept.sphere(prefix + "_ReferenceNose", (0, -0.198, 1.735), (0.030, 0.023, 0.043), themed["skin"], collection, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceMouth", (0, -0.197, 1.682), (0.055, 0.009, 0.010), themed["lip"], collection, bevel=0.006, bone="head", rig=rig)

    # Platinum crown, swept fringe and nine separated braid groups. The
    # tied chain sits left of the back-webbing/weapon line and remains rigidly
    # head-bound for this initial deterministic model cycle.
    concept.sphere(prefix + "_ReferenceHairUnderCap", (0, 0.062, 1.872), (0.212, 0.182, 0.132), themed["hair_shadow"], collection, bone="head", rig=rig)
    concept.sphere(prefix + "_ReferenceHairCap", (0, 0.050, 1.885), (0.205, 0.175, 0.130), themed["hair_platinum"], collection, bone="head", rig=rig)
    concept.cube(prefix + "_ReferenceHairPart", (-0.045, 0.020, 1.985), (0.014, 0.150, 0.030), themed["hair_shadow"], collection, bevel=0.008, rotation=(0, 0, math.radians(-10)), bone="head", rig=rig)
    for index, (x, z, rz) in enumerate(((-0.115, 1.925, -18), (0.0, 1.955, 0), (0.112, 1.920, 16))):
        concept.cube(prefix + f"_ReferenceHairFringe_{index}", (x, -0.125, z), (0.070, 0.060, 0.070), themed["hair_platinum"], collection, bevel=0.035, rotation=(0, 0, math.radians(rz)), bone="head", rig=rig)
    concept.sphere(prefix + "_ReferencePonytailRoot", (-0.105, 0.165, 1.925), (0.115, 0.100, 0.105), themed["hair_platinum"], collection, bone="head", rig=rig)
    concept.cylinder(prefix + "_ReferencePonytailTie", (-0.105, 0.190, 1.860), 0.070, 0.075, themed["mint"], collection, bone="head", rig=rig)
    braid_points = (
        (-0.115, 0.215, 1.820, 0.100, 0.100, 0.100),
        (-0.160, 0.225, 1.745, 0.095, 0.095, 0.095),
        (-0.120, 0.230, 1.665, 0.092, 0.092, 0.092),
        (-0.168, 0.235, 1.585, 0.088, 0.088, 0.088),
        (-0.128, 0.240, 1.505, 0.084, 0.084, 0.084),
        (-0.170, 0.245, 1.430, 0.080, 0.080, 0.080),
        (-0.135, 0.250, 1.360, 0.075, 0.075, 0.075),
        (-0.165, 0.252, 1.295, 0.068, 0.068, 0.068),
        (-0.142, 0.255, 1.238, 0.058, 0.058, 0.065),
    )
    for index, (x, y, z, sx, sy, sz) in enumerate(braid_points):
        material = themed["hair_platinum"] if index % 2 == 0 else themed["hair_shadow"]
        concept.sphere(prefix + f"_ReferenceHairLock_{index:02d}", (x, y, z), (sx, sy, sz), material, collection, bone="head", rig=rig)

    # Bare athletic arms and compact fingerless gloves preserve the shared
    # rig while replacing the robotic shoulder and forearm armor.
    for side, sign in (("L", -1), ("R", 1)):
        concept.sphere(prefix + f"_ReferenceShoulder_{side}", (sign * 0.330, 0, 1.425), (0.125, 0.145, 0.125), themed["skin"], collection, bone=f"upper_arm.{side}", rig=rig)
        concept.cylinder(prefix + f"_ReferenceUpperArm_{side}", (sign * 0.415, 0, 1.235), 0.092, 0.370, themed["skin"], collection, rotation=(0, math.radians(sign * 18), 0), bone=f"upper_arm.{side}", rig=rig)
        concept.cylinder(prefix + f"_ReferenceForearm_{side}", (sign * 0.490, -0.040, 1.040), 0.087, 0.320, themed["skin"], collection, rotation=(0, math.radians(sign * 12), 0), bone=f"forearm.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceGlove_{side}", (sign * 0.462, -0.142, 0.915), (0.102, 0.102, 0.060), themed["charcoal"], collection, bevel=0.038, bone=f"forearm.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceWristAccent_{side}", (sign * 0.475, -0.082, 0.980), (0.100, 0.105, 0.025), themed["mint"], collection, bevel=0.012, bone=f"forearm.{side}", rig=rig)

    # Fitted olive sleeveless top and compact cross harness avoid broad sci-fi
    # armor while retaining strong diagonal identification at gameplay scale.
    for side, sign in (("L", -1), ("R", 1)):
        concept.cube(prefix + f"_ReferenceShirtFront_{side}", (sign * 0.112, -0.215, 1.285), (0.108, 0.042, 0.270), themed["olive"], collection, bevel=0.045, bone="chest", rig=rig)
        concept.cube(prefix + f"_ReferenceShirtSide_{side}", (sign * 0.220, -0.020, 1.275), (0.055, 0.155, 0.245), themed["olive_dark"], collection, bevel=0.035, bone="chest", rig=rig)
        concept.cube(prefix + f"_ReferenceHarness_{side}", (sign * 0.105, -0.272, 1.310), (0.035, 0.020, 0.290), themed["olive_dark"], collection, bevel=0.010, rotation=(0, 0, math.radians(sign * 20)), bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceShirtCollar", (0, -0.235, 1.505), (0.145, 0.025, 0.040), themed["olive_dark"], collection, bevel=0.016, bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceShirtHem", (0, -0.235, 1.055), (0.245, 0.024, 0.032), themed["olive_dark"], collection, bevel=0.012, bone="spine", rig=rig)
    concept.cube(prefix + "_ReferenceHarnessBuckle", (0, -0.298, 1.260), (0.048, 0.015, 0.050), themed["steel"], collection, bevel=0.010, bone="chest", rig=rig)
    concept.cube(prefix + "_ReferenceMintBadge", (-0.155, -0.286, 1.430), (0.042, 0.010, 0.032), themed["mint"], collection, bevel=0.008, bone="chest", rig=rig)

    # Charcoal cargo trousers, compact utility storage, thigh holster, knee
    # protection and grounded combat boots complete the army-survivor read.
    concept.cube(prefix + "_ReferenceBelt", (0, -0.215, 0.870), (0.275, 0.034, 0.048), themed["olive_dark"], collection, bevel=0.014, bone="pelvis", rig=rig)
    concept.cube(prefix + "_ReferenceBuckle", (0, -0.255, 0.870), (0.055, 0.016, 0.048), themed["mint"], collection, bevel=0.010, bone="pelvis", rig=rig)
    for index, x in enumerate((-0.210, 0.210)):
        concept.cube(prefix + f"_ReferencePouch_{index}", (x, -0.242, 0.815), (0.050, 0.036, 0.070), themed["olive_dark"], collection, bevel=0.016, bone="pelvis", rig=rig)
    for side, sign in (("L", -1), ("R", 1)):
        concept.cube(prefix + f"_ReferenceCargoThigh_{side}", (sign * 0.160, -0.075, 0.565), (0.137, 0.102, 0.205), themed["charcoal"], collection, bevel=0.048, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceCargoPocket_{side}", (sign * 0.235, -0.120, 0.580), (0.052, 0.044, 0.092), themed["olive_dark"], collection, bevel=0.017, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceKneeGuard_{side}", (sign * 0.160, -0.185, 0.340), (0.132, 0.055, 0.100), themed["olive"], collection, bevel=0.032, bone=f"shin.{side}", rig=rig)
        concept.cube(prefix + f"_ReferenceBootSole_{side}", (sign * 0.160, -0.115, 0.035), (0.148, 0.230, 0.033), themed["silver_dark"], collection, bevel=0.020, bone=f"shin.{side}", rig=rig)
    concept.cube(prefix + "_ReferenceHolsterBody", (0.245, -0.070, 0.590), (0.052, 0.065, 0.150), themed["olive_dark"], collection, bevel=0.018, rotation=(0, 0, math.radians(-6)), bone="thigh.R", rig=rig)
    concept.cube(prefix + "_ReferenceHolsterStrapTop", (0.220, -0.060, 0.680), (0.100, 0.032, 0.025), themed["mint"], collection, bevel=0.010, bone="thigh.R", rig=rig)
    concept.cube(prefix + "_ReferenceHolsterStrapLower", (0.220, -0.060, 0.510), (0.100, 0.032, 0.025), themed["olive_dark"], collection, bevel=0.010, bone="thigh.R", rig=rig)
    concept.cube(prefix + "_ReferenceHolsterGrip", (0.245, -0.082, 0.735), (0.043, 0.047, 0.065), themed["steel"], collection, bevel=0.014, rotation=(0, 0, math.radians(-6)), bone="thigh.R", rig=rig)

    authored_names = sorted(set(collection.objects.keys()) - before)
    hair_names = [name for name in authored_names if "_ReferenceHairLock_" in name]
    if len(hair_names) < minimum_locks:
        raise RuntimeError(f"Lit Valkyrie reference hair has {len(hair_names)} locks; minimumRiggedLocks={minimum_locks}")
    minimum = detail_kit.get("minimumAuthoredParts")
    if not isinstance(minimum, int) or len(authored_names) < minimum:
        raise RuntimeError(f"Lit Valkyrie reference detail kit has {len(authored_names)} parts; minimumAuthoredParts={minimum}")
    return {
        "detailKitKind": detail_kit["kind"],
        "riggedHairLockCount": len(hair_names),
        "authoredReferencePartCount": len(authored_names),
        "authoredReferenceParts": authored_names,
    }


def add_unlockable_details(concept, collection, rig, mats, actor_id: str, variant_id: str, model_spec: dict) -> tuple[dict, dict]:
    themed = actor_materials(concept, mats, actor_id)
    prefix = f"{actor_id}_{variant_id}"
    female = actor_id in {"lilly", "lit-valkyrie"}
    concept.add_base_body(collection, rig, themed, actor_id, variant_id, female=female)
    if actor_id == "lester-original":
        report = add_lester_reference_details(concept, collection, rig, themed, actor_id, variant_id, model_spec)
    elif actor_id == "lilly":
        report = add_lilly_reference_details(concept, collection, rig, themed, actor_id, variant_id, model_spec)
    elif actor_id == "lit-commando":
        report = add_lit_commando_reference_details(concept, collection, rig, themed, actor_id, variant_id, model_spec)
    elif actor_id == "lit-valkyrie":
        report = add_lit_valkyrie_reference_details(concept, collection, rig, themed, actor_id, variant_id, model_spec)
    else:
        raise RuntimeError(f"Unknown production unlockable: {actor_id}")
    return themed, {
        "modelSpecId": model_spec["modelSpecId"],
        "implementationStatus": model_spec["implementationStatus"],
        **report,
    }


def main() -> None:
    args = blender_args()
    manifest_path = Path(args.manifest).resolve()
    repo_root = manifest_path.parents[5]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    concept_manifest_path = repo_root / manifest["scene"]["conceptManifest"]
    concept_manifest = json.loads(concept_manifest_path.read_text(encoding="utf-8"))
    reference_manifest_path = repo_root / manifest["scene"]["referenceModelManifest"]
    reference_manifest = json.loads(reference_manifest_path.read_text(encoding="utf-8"))
    concept = load_module(repo_root / "scripts/hmh-blender/create-hmh-commando-concepts.py")
    source_blend = Path(args.source_blend).resolve()
    inspection_output = Path(args.inspection_output).resolve()
    source_blend.parent.mkdir(parents=True, exist_ok=True)

    scene, mats = concept.configure_scene(concept_manifest)
    frame_width, frame_height = manifest["render"]["frameSize"]
    scene.render.resolution_x = frame_width
    scene.render.resolution_y = frame_height
    scene.view_settings.exposure = manifest["render"]["exposure"]
    scene.camera.data.ortho_scale = manifest["render"]["cameraOrthoScale"]
    # Keep every gameplay atlas on one declared camera contract. The concept
    # scene uses a diagonal azimuth, so derive the camera height from the
    # manifest pitch while preserving the approved target and XY framing.
    camera_pitch = math.radians(manifest["render"]["cameraPitchDegrees"])
    camera_target = Vector((0.0, 0.0, 1.0))
    horizontal = math.hypot(scene.camera.location.x, scene.camera.location.y)
    scene.camera.location.z = camera_target.z + horizontal / math.tan(camera_pitch)
    scene.camera.rotation_euler = (camera_target - scene.camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = ""

    # The shared procedural rig exists only for procedural pilots. An
    # external-model pilot brings its own armature out of the importer, and
    # building a second rig under the manifest's armature name would collide
    # with it.
    procedural_pilots = [entry for entry in manifest["pilots"] if "sourceModel" not in entry]
    external_pilots = [entry for entry in manifest["pilots"] if "sourceModel" in entry]
    rig = None
    if procedural_pilots:
        rig = concept.create_rig()
        rig.name = manifest["scene"]["armature"]
        rig.data.name = manifest["scene"]["armature"]
        rig["hmh_gameplay_body_profile"] = manifest["gameplayBodyProfile"]
        rig["hmh_runtime_authority"] = "projection-only"
    importer = None
    if external_pilots:
        importer = load_module(
            repo_root / "scripts/hmh-blender/import-hmh-external-model.py",
            "hmh_external_model_importer",
        )

    objects_by_actor = {}
    variants_by_actor = {}
    reference_reports = {}
    external_armatures = {}
    for pilot in manifest["pilots"]:
        # An external-model pilot must branch before the four hardcoded actor
        # ids below: find_reference_model fails closed on an unknown actorId,
        # and none of the concept/reference detail kits apply to an imported
        # mesh.
        if "sourceModel" in pilot:
            collection = bpy.data.collections.new(f"Production__{pilot['actorId']}__{pilot['variantId']}")
            scene.collection.children.link(collection)
            report = importer.import_external_actor(manifest, pilot, repo_root, collection)
            objects_by_layer = {layer: list(names) for layer, names in report["objectsByLayer"].items()}
            if set(layer for layer, objects in objects_by_layer.items() if objects) != set(pilot["layers"]):
                raise RuntimeError(f"Layer assignment incomplete for {pilot['actorId']}: {objects_by_layer}")
            objects_by_actor[pilot["actorId"]] = objects_by_layer
            variants_by_actor[pilot["actorId"]] = pilot["variantId"]
            external_armatures[pilot["actorId"]] = bpy.data.objects[report["armature"]]
            reference_reports[pilot["actorId"]] = {
                "modelSpecId": pilot.get("modelSpecId"),
                "implementationStatus": "external-model",
                "detailKitKind": None,
                "authoredReferencePartCount": 0,
                "authoredReferenceParts": [],
                "sourceSha256": report["sourceSha256"],
                "armature": report["armature"],
                "actions": sorted(report["actions"]),
                "lookDev": report["lookDev"],
                "contentSha256": report["contentSha256"],
            }
            continue
        if pilot["actorId"] in {"lester-original", "lilly", "lit-commando", "lit-valkyrie"}:
            actor = {"id": pilot["actorId"]}
            variant = {"id": pilot["variantId"]}
        else:
            actor, variant = find_variant(concept_manifest, pilot["actorId"], pilot["variantId"])
        collection = bpy.data.collections.new(f"Production__{actor['id']}__{variant['id']}")
        scene.collection.children.link(collection)
        actor_mats = mats
        model_spec = find_reference_model(reference_manifest, actor["id"], pilot["modelSpecId"])
        if actor["id"] in {"lester-original", "lilly", "lit-commando", "lit-valkyrie"}:
            actor_mats, reference_report = add_unlockable_details(concept, collection, rig, mats, actor["id"], variant["id"], model_spec)
        else:
            concept.add_variant_details(
                collection,
                rig,
                mats,
                actor["id"],
                variant["id"],
                female=actor["id"] == "lit-valkyrie",
            )
            reference_report = {
                "modelSpecId": model_spec["modelSpecId"],
                "implementationStatus": model_spec["implementationStatus"],
                "detailKitKind": None,
                "authoredReferencePartCount": 0,
                "authoredReferenceParts": [],
            }
        replace_rifle_with_pistol(concept, collection, rig, actor_mats, actor["id"], variant["id"])

        objects_by_layer = {layer: [] for layer in pilot["layers"]}
        for obj in collection.objects:
            if obj.type != "MESH":
                continue
            layer = semantic_layer(obj)
            obj["hmh_layer"] = layer
            obj["hmh_actor_id"] = actor["id"]
            obj["hmh_variant_id"] = variant["id"]
            obj["hmh_runtime_authority"] = "projection-only"
            objects_by_layer[layer].append(obj.name)
            if layer == "shadow":
                concept.attach_to_bone(obj, rig, "root")

        expected_layers = set(pilot["layers"])
        if set(layer for layer, objects in objects_by_layer.items() if objects) != expected_layers:
            raise RuntimeError(f"Layer assignment incomplete for {actor['id']}: {objects_by_layer}")
        objects_by_actor[actor["id"]] = objects_by_layer
        variants_by_actor[actor["id"]] = variant["id"]
        reference_reports[actor["id"]] = reference_report

    if rig is not None:
        # Procedural rig only. Forcing XYZ on an imported quaternion-keyed
        # armature would leave every rotation channel unevaluated and freeze
        # the actor at rest for every rendered frame.
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode="POSE")
        for pose_bone in rig.pose.bones:
            pose_bone.rotation_mode = "XYZ"
            pose_bone.matrix_basis.identity()
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(source_blend), compress=True)

    external_dependencies = concept.external_dependencies()
    inspection_rig = rig if rig is not None else external_armatures[sorted(external_armatures)[0]]
    bones = sorted(bone.name for bone in inspection_rig.data.bones)
    inspection = {
        "armature": inspection_rig.name,
        "bones": bones,
        "weaponSocket": manifest["scene"]["weaponSocket"] in bones,
        "actors": {
            actor_id: {
                "actorId": actor_id,
                "variantId": variants_by_actor[actor_id],
                "objectsByLayer": {layer: sorted(objects) for layer, objects in layers.items()},
                **reference_reports[actor_id],
            }
            for actor_id, layers in objects_by_actor.items()
        },
        "externalDependencies": external_dependencies,
        "externalDependencyCount": len(external_dependencies),
        "gameplayBodyProfile": inspection_rig["hmh_gameplay_body_profile"],
        "runtimeAuthority": inspection_rig["hmh_runtime_authority"],
    }
    write_lf_json(inspection_output, inspection)
    object_count = sum(len(objects) for layers in objects_by_actor.values() for objects in layers.values())
    print(json.dumps({"status": "pass", "sourceBlend": str(source_blend), "actors": sorted(objects_by_actor), "objects": object_count}, sort_keys=True))


if __name__ == "__main__":
    main()
