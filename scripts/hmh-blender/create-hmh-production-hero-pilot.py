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


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location("hmh_commando_concepts", path)
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


def add_unlockable_details(concept, collection, rig, mats, actor_id: str, variant_id: str, model_spec: dict) -> tuple[dict, dict]:
    themed = actor_materials(concept, mats, actor_id)
    prefix = f"{actor_id}_{variant_id}"
    female = actor_id == "lilly"
    concept.add_base_body(collection, rig, themed, actor_id, variant_id, female=female)
    if actor_id == "lester-original":
        report = add_lester_reference_details(concept, collection, rig, themed, actor_id, variant_id, model_spec)
    elif actor_id == "lilly":
        report = add_lilly_reference_details(concept, collection, rig, themed, actor_id, variant_id, model_spec)
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

    rig = concept.create_rig()
    rig.name = manifest["scene"]["armature"]
    rig.data.name = manifest["scene"]["armature"]
    rig["hmh_gameplay_body_profile"] = manifest["gameplayBodyProfile"]
    rig["hmh_runtime_authority"] = "projection-only"

    objects_by_actor = {}
    variants_by_actor = {}
    reference_reports = {}
    for pilot in manifest["pilots"]:
        if pilot["actorId"] in {"lester-original", "lilly"}:
            actor = {"id": pilot["actorId"]}
            variant = {"id": pilot["variantId"]}
        else:
            actor, variant = find_variant(concept_manifest, pilot["actorId"], pilot["variantId"])
        collection = bpy.data.collections.new(f"Production__{actor['id']}__{variant['id']}")
        scene.collection.children.link(collection)
        actor_mats = mats
        model_spec = find_reference_model(reference_manifest, actor["id"], pilot["modelSpecId"])
        if actor["id"] in {"lester-original", "lilly"}:
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
    bones = sorted(bone.name for bone in rig.data.bones)
    inspection = {
        "armature": rig.name,
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
        "gameplayBodyProfile": rig["hmh_gameplay_body_profile"],
        "runtimeAuthority": rig["hmh_runtime_authority"],
    }
    write_lf_json(inspection_output, inspection)
    object_count = sum(len(objects) for layers in objects_by_actor.values() for objects in layers.values())
    print(json.dumps({"status": "pass", "sourceBlend": str(source_blend), "actors": sorted(objects_by_actor), "objects": object_count}, sort_keys=True))


if __name__ == "__main__":
    main()
