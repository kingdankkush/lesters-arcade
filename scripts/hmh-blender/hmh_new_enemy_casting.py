"""Casting table for the six 2.0 enemy types (Blender-free, shared by tooling and docs).

Every entry binds one owner-supplied, licensed humanoid GLB (read-only, outside
the repository) to one new archetype. The GLBs are unrigged Tripo exports; four
are multi-figure turnaround sheets whose front (leftmost, tallest) figure is
extracted, and two carry no image textures and receive a baked palette instead.
Nothing here is gameplay authority: collision, damage, AI, spawning and results
come from `enemy-archetypes.mjs`.
"""
from __future__ import annotations

OWNER_ASSET_ROOT = r"C:\Users\just_\Desktop\Projects\LestersArcade-Assets"
NEW_ENEMY_IDS = (
    "rug-puller",
    "pump-and-dump-bloater",
    "tollkeeper",
    "hodl-revenant",
    "money-printer",
    "oracle-marksman",
)

# Heights are the normalised rest height in metres. Ordinary enemies stay at
# comparable human scale to the shipped six (Bagholder 1.67 m, Forkrunner 2.10 m).
CASTING = {
    "rug-puller": {
        "name": "Rug Puller",
        "sourceFile": "female combatant 3d model.glb",
        "sheetFigure": "front",
        "textured": True,
        "identityForm": "human",
        "height": 1.78,
        "stoop": 0.03,
        "reference": "Enemy and Boss References 03_31_07/03_31_08 (rug, rope and hook)",
        "rationale": "Poppie demolitionist body: the lightest, most agile licensed textured figure; the rolled rug and hook are costume geometry.",
        "animationProfile": {"kind": "forkrunner-quick-fork-slash-v1", "damageResponse": "crossed-fork-guard-break-v1"},
        "palette": {"accent": "#c05bff", "primary": "#5b2a7a"},
    },
    "pump-and-dump-bloater": {
        "name": "Pump-and-Dump Bloater",
        "sourceFile": "armored soldier 3d model.glb",
        "sheetFigure": "front",
        "textured": True,
        "identityForm": "human",
        "height": 1.92,
        "stoop": 0.12,
        "reference": "Enemy and Boss References 03_31_32/03_31_33 (bloated body, bike pump)",
        "rationale": "Whiteout armored mercenary: the heaviest licensed silhouette (widest shoulders, deepest torso); the hand pump is costume geometry.",
        "animationProfile": {"kind": "undead-shoulder-charge-v1", "damageResponse": "armored-shoulder-absorb-v1"},
        "palette": {"accent": "#9be15d", "primary": "#4b6b2a"},
    },
    "tollkeeper": {
        "name": "Tollkeeper",
        "sourceFile": "armored soldier 3d model (1).glb",
        "sheetFigure": "front",
        "textured": True,
        "identityForm": "human",
        "height": 1.88,
        "stoop": 0.02,
        "reference": "Enemy and Boss References 03_31_58/03_31_59 (hi-vis, hard hat, striped barrier shield)",
        "rationale": "Rugged riot enforcer: heavy riot armor is the closest licensed body; the striped toll barrier and beacon hard hat are costume geometry.",
        "animationProfile": {"kind": "shared-roster-v1", "damageResponse": "shared-impact-v1"},
        "palette": {"accent": "#ff8a1f", "primary": "#e63b2e"},
    },
    "hodl-revenant": {
        "name": "HODL Revenant",
        "sourceFile": "zombie warrior 3d model.glb",
        "sheetFigure": "front",
        "textured": False,
        "identityForm": "zombie",
        "height": 1.76,
        "stoop": 0.26,
        "reference": "Enemy and Boss References 03_32_30/03_32_31 (hooded, chained, ragged wraith)",
        "rationale": "Untextured zombie warrior figure (the brief's Revenant = zombie warrior); receives a pale undead/rag palette bake, an open hood and chain rings so it does not read as the Bagholder.",
        "animationProfile": {"kind": "undead-straight-lunge-v1", "damageResponse": "snapback-stumble-v1"},
        "palette": {"accent": "#8fd3ff", "primary": "#3d3a3a"},
        "bodyPalette": {"boot": "#1c1a1a", "leg": "#4a4341", "torso": "#3d3a3a", "skin": "#b9c2b3"},
    },
    "money-printer": {
        "name": "Money Printer",
        "sourceFile": "military character 3d model.glb",
        "sheetFigure": "front",
        "textured": True,
        "identityForm": "human",
        "height": 1.84,
        "stoop": 0.04,
        "reference": "Enemy and Boss References 03_34_03 (brass printing press backpack, banknotes, green visor)",
        "rationale": "Cyber berserker: the remaining licensed textured human; the brass press backpack, note roll and green visor are costume geometry (the reference's suit is not represented).",
        "animationProfile": {"kind": "gas-bomber-canister-lob-v1", "damageResponse": "canister-protective-stagger-v1"},
        "palette": {"accent": "#5cff8a", "primary": "#8a6a2a"},
    },
    "oracle-marksman": {
        "name": "Oracle Marksman",
        "sourceFile": "post apocalyptic warrior 3d model.glb",
        "sheetFigure": "front",
        "textured": False,
        "identityForm": "human",
        "height": 1.82,
        "stoop": 0.02,
        "reference": "Enemy and Boss References 03_34_13/03_34_14 (ghillie sniper, purple oracle scope)",
        "rationale": "Dusty blue sniper operative: the only sniper-like licensed figure (long coat, rifle slung on the back); untextured, so it receives a dusty-blue palette bake and an emissive oracle scope.",
        "animationProfile": {"kind": "suppression-rifle-burst-v1", "damageResponse": "rifle-shoulder-recoil-v1"},
        "palette": {"accent": "#b36bff", "primary": "#3f5670"},
        "bodyPalette": {"boot": "#1f1c19", "leg": "#3a3d44", "torso": "#3f5670", "skin": "#c9a487"},
    },
}

# Measured on 2026-09-30 from the owner's read-only files (SHA-256 of the GLB bytes).
SOURCE_SHA256 = {
    "female combatant 3d model.glb": "f3b693bb5acbd23226103837f6d1313abb29a90e85a5f384b4bba747b507b6ae",
    "armored soldier 3d model.glb": "10c589cbc64d8ad295c214054298e072e59ad7f00dd59b651e689ddc6f35509c",
    "armored soldier 3d model (1).glb": "2aa5a15c66588dcdfc4e98863a9497e1cf7ef86209a94e6a3c25e9c6b299ef47",
    "zombie warrior 3d model.glb": "f45683a9bf3932f3a083800e7d2d91e8db4331d6aa6e3f8a9b890e28cafcb64b",
    "military character 3d model.glb": "af40b958cd2079a440756dff05161b151c99f5a473cecbd7bf12d835a1040709",
    "post apocalyptic warrior 3d model.glb": "d24f5604e1c239aa1b73213df31cd5522f0b631fadfc558a12f1790f7d02f54b",
}


def casting(actor_id: str) -> dict:
    if actor_id not in CASTING:
        raise KeyError(f"Unknown new enemy: {actor_id}")
    entry = dict(CASTING[actor_id])
    entry["sourceSha256"] = SOURCE_SHA256[entry["sourceFile"]]
    return entry
