"""Build the HMH weapon model package (pipeline hmh-weapon-models/v1).

Two phases:

  export  One fresh ``--factory-startup --disable-autoexec`` Blender process per
          weapon runs scripts/hmh-blender/export-hmh-weapon-models.py against
          the owner-supplied source GLB (read-only, hashed before and after).
          GPU bakes and review renders run under the shared heavy lock.

  pack    Re-validates every export report, parses each GLB (triangles, texture,
          extras), copies the GLBs into the package, derives the per-hero grip
          frames from the shipped held-weapon calibration and the runtime hero
          GLBs, writes manifest.json, the labelled contact sheet and receipts.

Usage (Windows repo checkout):

  python scripts/run-hmh-weapon-models.py export --work <workdir> --blender D:/Apps/Blender/blender.exe [--ids coin-blaster ...]
  python scripts/run-hmh-weapon-models.py pack --work <workdir> \
      --package apps/portal/assets/generated/hmh-weapon-models \
      --receipts docs/2.0/receipts/hmh-weapon-models-20260930

No paid asset generation: every model already exists on the owner's disk.
Projection-only art; nothing here can alter gameplay authority.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
EXPORTER = SCRIPT_DIR / "hmh-blender" / "export-hmh-weapon-models.py"
PIPELINE_ID = "hmh-weapon-models/v1"
DEFAULT_SOURCE_ROOT = r"C:\Users\just_\Desktop\Projects\LestersArcade-Assets"
HEAVY_LOCK = Path(r"C:\Users\just_\lesters-arcade-wt\.locks\heavy.lock")
HERO_IDS = ("lit-commando", "lilly", "lit-valkyrie", "lester-original")
BUDGETS = {"maxBytes": 150 * 1024, "maxTriangles": 3000, "maxTextureSize": 512}
GUNMETAL = [0.34, 0.36, 0.40]
BLUED = [0.26, 0.29, 0.36]

# Casting table. forwardHint/upHint are in the owner model's imported Blender
# axes (glTF Y-up -> Blender Z-up), read off the read-only orientation sheets.
WEAPONS: dict[str, dict[str, Any]] = {
    "coin-blaster": {
        "source": "pistol 3d model.glb", "slot": "gun", "title": "The Settler (Pistol)",
        "forwardHint": [-1, 0, 0], "upHint": [0, 0, 1], "refitSlide": True, "boreSlice": True,
        "lengthMetres": 0.29, "gripAlong": 0.38, "boreHeight": 0.10, "tint": GUNMETAL, "metallic": 0.7, "roughness": 0.5,
        "reload": {"dipRadians": 0.35, "ticks": 90}, "equip": {"ticks": 10, "twoHanded": False},
        "note": "Compact rugged handgun; matches the Rugged Futuristic Handgun sheet. The desert eagle handgun (textured) is the alternate.",
    },
    "scatter-shotgun": {
        "source": "rugged shotgun 3d model.glb", "slot": "gun", "title": "The Block Breaker (Shotgun)",
        "forwardHint": [-1, 0, 0], "upHint": [0, 0, 1], "refitSlide": True, "boreSlice": True,
        "refitFront": True, "lengthMetres": 1.05, "gripAlong": 0.30, "boreHeight": 0.09, "tint": [0.33, 0.30, 0.27], "metallic": 0.45, "roughness": 0.6,
        "reload": {"dipRadians": 0.45, "ticks": 120}, "equip": {"ticks": 14, "twoHanded": True},
        "note": "Rugged pump shotgun; matches the Rugged Post-Apocalyptic Shotgun sheet.",
    },
    "auto-miner": {
        "source": "military minigun 3d model.glb", "slot": "gun", "title": "The Hashstorm (Machine Gun)",
        "forwardHint": [0, -1, 0], "upHint": [0, 0, 1], "refitSlide": False, "boreSlice": False,
        "refitFront": True, "lengthMetres": 1.10, "gripAlong": 0.22, "boreHeight": 0.08, "tint": BLUED, "metallic": 0.75, "roughness": 0.5,
        "reload": {"dipRadians": 0.30, "ticks": 180}, "equip": {"ticks": 18, "twoHanded": True},
        "note": "Rotary minigun; matches the Worn Heavy Machine Gun sheet.",
    },
    "hash-rail": {
        "source": "hunting rifle 3d model.glb", "slot": "gun", "title": "Railgun",
        "forwardHint": [1, 0, 0], "upHint": [0, 0, 1], "refitSlide": True, "boreSlice": True,
        "refitFront": True, "targetTriangles": 1500, "jpegQuality": 70, "lengthMetres": 1.15, "gripAlong": 0.28, "boreHeight": 0.09, "tint": GUNMETAL, "metallic": 0.5, "roughness": 0.55,
        "reload": {"dipRadians": 0.40, "ticks": 156}, "equip": {"ticks": 16, "twoHanded": True},
        "note": "Textured scoped bolt rifle: the long precise lane weapon. Rugged Rifle sheet.",
    },
    "lightning-ledger": {
        "source": "rifle with scope 3d model.glb", "slot": "gun", "title": "The Lightning Ledger (Arc Rifle)",
        "forwardHint": [-1, 0, 0], "upHint": [0, 0, 1], "refitSlide": True, "boreSlice": True,
        "refitFront": True, "lengthMetres": 1.10, "gripAlong": 0.28, "boreHeight": 0.09, "tint": [0.30, 0.36, 0.44], "metallic": 0.7, "roughness": 0.45,
        "reload": {"dipRadians": 0.40, "ticks": 144}, "equip": {"ticks": 16, "twoHanded": True},
        "note": "Scoped rifle stand-in for the arc rifle: the owner's futuristic gun GLB is an exploded two-body export and is unusable as delivered.",
    },
    "bear-market-burner": {
        "source": "assault rifle 3d model.glb", "slot": "gun", "title": "Bear Market Burner (Flamethrower)",
        "forwardHint": [-1, 0, 0], "upHint": [0, 0, 1], "refitSlide": True, "boreSlice": True,
        "lengthMetres": 0.95, "gripAlong": 0.32, "boreHeight": 0.09, "tint": [0.40, 0.30, 0.24], "metallic": 0.6, "roughness": 0.55,
        "reload": {"dipRadians": 0.30, "ticks": 90}, "equip": {"ticks": 16, "twoHanded": True},
        "note": "STAND-IN. No flamethrower model was supplied; the assault rifle is the closest two-handed body. Needs an owner flamethrower model.",
    },
    "forked-standard": {
        "source": "chainsaw 3d model.glb", "slot": "gun", "title": "The Forked Standard (War Fork)",
        "forwardHint": [0, -1, 0], "upHint": [0, 0, 1], "refitSlide": False, "boreSlice": False,
        "targetTriangles": 1300, "jpegQuality": 66, "lengthMetres": 0.95, "gripAlong": 0.14, "boreHeight": 0.06, "tint": [0.55, 0.16, 0.12], "metallic": 0.4, "roughness": 0.6,
        "reload": {"dipRadians": 0.0, "ticks": 0}, "equip": {"ticks": 18, "twoHanded": True},
        "note": "STAND-IN. The war fork is a two-handed melee weapon and no fork model was supplied; the textured chainsaw (Weathered Red Chainsaw sheet) is the melee stand-in.",
    },
    "launcher-rig": {
        "source": "grenade launcher 3d model.glb", "slot": "gun", "title": "Launcher Rig (Grenade Launcher)",
        "forwardHint": [0, -1, 0], "upHint": [0, 0, 1], "refitSlide": True, "boreSlice": True,
        "lengthMetres": 0.80, "gripAlong": 0.35, "boreHeight": 0.09, "tint": [0.28, 0.32, 0.30], "metallic": 0.6, "roughness": 0.55,
        "reload": {"dipRadians": 0.45, "ticks": 144}, "equip": {"ticks": 16, "twoHanded": True},
        "note": "Drum grenade launcher; matches the Sci-Fi Grenade Launcher sheet.",
    },
    "litecoin-knife": {
        "source": "rugged hunting knife 3d model.glb", "slot": "knife", "title": "Litecoin Knife",
        "forwardHint": [1, 0, 1], "upHint": [0, 0, 1], "refitSlide": False, "boreSlice": False,
        "targetTriangles": 1500, "jpegQuality": 70, "lengthMetres": 0.34, "gripAlong": 0.18, "boreHeight": 0.02, "tint": GUNMETAL, "metallic": 0.5, "roughness": 0.45,
        "reload": {"dipRadians": 0.0, "ticks": 0}, "equip": {"ticks": 8, "twoHanded": False},
        "note": "Textured survival knife; matches the Rugged Survival Knife sheet.",
    },
    "satoshi-frag": {
        "source": "hand grenade 3d model.glb", "slot": "grenade", "title": "Satoshi Frag (Hand Grenade)",
        "forwardHint": [1, 0, 0], "upHint": [0, 0, 1], "align": "up", "refitSlide": False, "boreSlice": False,
        "targetTriangles": 1400, "jpegQuality": 70, "lengthMetres": 0.13, "gripAlong": 0.5, "boreHeight": 0.0, "tint": [0.30, 0.34, 0.26], "metallic": 0.4, "roughness": 0.6,
        "reload": {"dipRadians": 0.0, "ticks": 0}, "equip": {"ticks": 8, "twoHanded": False},
        "note": "Textured pineapple grenade; matches the Weathered Military Grenade sheet.",
    },
}
WEAPON_ORDER = list(WEAPONS)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("export", "pack"):
        p = sub.add_parser(name)
        p.add_argument("--work", required=True)
        p.add_argument("--source-root", default=DEFAULT_SOURCE_ROOT)
        if name == "export":
            p.add_argument("--blender", required=True)
            p.add_argument("--ids", nargs="*")
            p.add_argument("--target-triangles", type=int, default=1900)
            p.add_argument("--cpu-only", action="store_true", help="Cycles CPU bakes and previews; no GPU step, so the heavy lock is not taken")
        else:
            p.add_argument("--package", required=True)
            p.add_argument("--receipts", required=True)
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def acquire_lock(token: str) -> None:
    HEAVY_LOCK.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(46):
        try:
            fd = os.open(str(HEAVY_LOCK), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except (FileExistsError, PermissionError):
            if attempt == 45:
                raise RuntimeError("heavy lock held for 45 minutes; giving up")
            print(f"heavy lock held by {HEAVY_LOCK.read_text(errors='replace').strip()!r}; waiting 60 s", flush=True)
            time.sleep(60)
            continue
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(token)
        return


def release_lock(token: str) -> None:
    try:
        if HEAVY_LOCK.read_text(encoding="utf-8").strip() == token:
            HEAVY_LOCK.unlink()
    except FileNotFoundError:
        pass


def export(args: argparse.Namespace) -> None:
    ids = args.ids or WEAPON_ORDER
    unknown = [weapon_id for weapon_id in ids if weapon_id not in WEAPONS]
    if unknown:
        raise SystemExit(f"unknown weapon ids {unknown}")
    work = Path(args.work).resolve()
    source_root = Path(args.source_root).resolve(strict=True)
    token = f"claude-weapons-{os.getpid()}-{dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}"
    if not args.cpu_only:
        acquire_lock(token)
    try:
        for weapon_id in ids:
            spec = WEAPONS[weapon_id]
            source = source_root / spec["source"]
            weapon_work = work / weapon_id
            if weapon_work.exists():
                shutil.rmtree(weapon_work)
            weapon_work.mkdir(parents=True)
            request = {
                "weaponId": weapon_id, "spec": spec, "sourcePath": str(source), "sourceSha256": sha256_file(source),
                "sourceBytes": source.stat().st_size, "workDir": str(weapon_work), "outputGlb": str(weapon_work / f"{weapon_id}.glb"),
                "targetTriangles": args.target_triangles, "triangleLimit": BUDGETS["maxTriangles"], "bakeSamples": 64, "jpegQuality": 78, "cpuOnly": bool(args.cpu_only),
            }
            write_json(weapon_work / "request.json", request)
            command = [args.blender, "-b", "--factory-startup", "--disable-autoexec", "--python", str(EXPORTER), "--", "--request", str(weapon_work / "request.json")]
            environment = dict(os.environ, PYTHONHASHSEED="0")
            started = time.time()
            print(f"[{weapon_id}] exporting from {spec['source']}", flush=True)
            result = subprocess.run(command, cwd=str(ROOT), env=environment, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            (weapon_work / "blender.stdout.log").write_bytes(result.stdout)
            (weapon_work / "blender.stderr.log").write_bytes(result.stderr)
            report_path = weapon_work / "report.json"
            if result.returncode != 0 or not report_path.is_file() or b"HMH_WEAPON_EXPORT_DONE" not in result.stdout:
                tail = result.stdout.decode(errors="replace")[-3000:] + result.stderr.decode(errors="replace")[-3000:]
                raise SystemExit(f"[{weapon_id}] Blender export failed (rc={result.returncode})\n{tail}")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            print(f"[{weapon_id}] {report['lowTriangles']} tris, {report['outputBytes']:,} bytes, {time.time() - started:.0f} s on {report['device']}", flush=True)
    finally:
        if not args.cpu_only:
            release_lock(token)


def parse_glb(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError(f"{path} is not a GLB v2 container")
    json_length, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("first chunk must be JSON")
    document = json.loads(data[20:20 + json_length])
    bin_offset = 20 + json_length
    bin_length, bin_type = struct.unpack_from("<II", data, bin_offset)
    if bin_type != 0x004E4942:
        raise ValueError("second chunk must be BIN")
    binary = data[bin_offset + 8: bin_offset + 8 + bin_length]
    triangles = 0
    vertices = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh["primitives"]:
            triangles += document["accessors"][primitive["indices"]]["count"] // 3
            vertices += document["accessors"][primitive["attributes"]["POSITION"]]["count"]
    images = []
    for image in document.get("images", []):
        view = document["bufferViews"][image["bufferView"]]
        blob = binary[view.get("byteOffset", 0): view.get("byteOffset", 0) + view["byteLength"]]
        images.append({"mimeType": image["mimeType"], "bytes": len(blob), **image_dimensions(blob, image["mimeType"])})
    extras = next((node.get("extras", {}) for node in document.get("nodes", []) if "mesh" in node), {})
    return {"triangles": triangles, "vertices": vertices, "images": images, "extras": extras, "meshes": len(document.get("meshes", [])),
            "nodes": len(document.get("nodes", [])), "materials": len(document.get("materials", [])), "extensionsRequired": document.get("extensionsRequired", [])}


def image_dimensions(blob: bytes, mime: str) -> dict[str, int]:
    if mime == "image/png":
        return {"width": struct.unpack_from(">I", blob, 16)[0], "height": struct.unpack_from(">I", blob, 20)[0]}
    if mime == "image/jpeg":
        index = 2
        while index < len(blob):
            if blob[index] != 0xFF:
                raise ValueError("JPEG marker expected")
            marker = blob[index + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                height, width = struct.unpack_from(">HH", blob, index + 5)
                return {"width": width, "height": height}
            index += 2 + struct.unpack_from(">H", blob, index + 2)[0]
    raise ValueError(f"unsupported texture {mime}")


def hero_grip_frames() -> dict[str, Any]:
    """Per-hero grip frame in ``pistol_prop`` joint space from the shipped held-weapon calibration,
    cross-checked against a principal-axis fit of the runtime GLB's native pistol."""
    import numpy as np

    result: dict[str, Any] = {}
    for hero in HERO_IDS:
        held_path = ROOT / "apps/portal/assets/generated/hmh-held-weapons" / hero / f"{hero}-held-weapons.json"
        held = json.loads(held_path.read_text(encoding="utf-8"))
        pistol = held["pistolFrame"]
        glb_path = ROOT / "apps/portal/assets/generated/hmh-actor-3d-pilot" / f"{hero}.glb"
        data = glb_path.read_bytes()
        json_length = struct.unpack_from("<I", data, 12)[0]
        document = json.loads(data[20:20 + json_length])
        binary = data[28 + json_length:]
        names = [node.get("name") for node in document["nodes"]]
        joints = document["skins"][0]["joints"]
        socket_node = names.index(pistol["socketBone"])
        joint_index = joints.index(socket_node)

        def accessor(index: int) -> np.ndarray:
            entry = document["accessors"][index]
            view = document["bufferViews"][entry["bufferView"]]
            width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[entry["type"]]
            dtype = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32}[entry["componentType"]]
            offset = view.get("byteOffset", 0) + entry.get("byteOffset", 0)
            return np.frombuffer(binary, dtype=dtype, count=entry["count"] * width, offset=offset).reshape(entry["count"], width)

        inverse_bind = accessor(document["skins"][0]["inverseBindMatrices"]).reshape(-1, 4, 4)[joint_index].T.astype(np.float64)
        pistol_node = next(node for node in document["nodes"] if "mesh" in node and (node["name"].endswith("coin-blaster") or "Coin Blaster" in node["name"]))
        primitive = document["meshes"][pistol_node["mesh"]]["primitives"][0]
        positions = accessor(primitive["attributes"]["POSITION"]).astype(np.float64)
        local = (inverse_bind @ np.c_[positions, np.ones(len(positions))].T).T[:, :3]
        # Same fit the held-weapon exporter used: the bore axis from the upper
        # 40% of the pistol along its up direction, not the grip-heavy body.
        up = np.array(pistol["axesInSocket"]["up"], dtype=np.float64)
        heights = (local - local.mean(axis=0)) @ up
        slide = local[heights >= np.quantile(heights, 0.6)]
        centred = slide - slide.mean(axis=0)
        _, _, vt = np.linalg.svd(centred, full_matrices=False)
        axis = vt[0] / np.linalg.norm(vt[0])
        forward = np.array(pistol["axesInSocket"]["forward"], dtype=np.float64)
        deviation = math.degrees(math.acos(min(1.0, abs(float(axis @ forward)))))
        anchor = np.array(pistol["anchorInSocket"], dtype=np.float64)
        inside = bool(np.all(anchor >= local.min(axis=0) - 0.02) and np.all(anchor <= local.max(axis=0) + 0.02))
        if deviation > 15.0 or not inside:
            raise RuntimeError(f"{hero}: held-weapon grip frame disagrees with the runtime pistol (deviation {deviation:.1f} deg, anchor inside={inside})")
        # The native pistol's muzzle in the same grip frame (front of its
        # canonical extent at bore height) and in socket space, so the 3D hero
        # gets a measured muzzle with the native pistol too.
        native_muzzle = [round(float(pistol["pistolExtentCanonical"][1][0]), 5), 0.0, float(held["gripFrame"]["boreHeight"])]
        axes = np.array([pistol["axesInSocket"]["forward"], pistol["axesInSocket"]["left"], pistol["axesInSocket"]["up"]], dtype=np.float64).T
        native_socket = (axes @ np.array(native_muzzle) + anchor).round(6).tolist()
        result[hero] = {
            "file": f"{hero}.glb", "sha256": sha256_file(glb_path), "socketJoint": pistol["socketBone"], "socketNodeIndex": socket_node,
            "nativePistolMuzzle": native_muzzle, "nativePistolMuzzleSocket": native_socket,
            "socketJointIndex": joint_index, "axesInSocket": pistol["axesInSocket"], "anchorInSocket": pistol["anchorInSocket"],
            "heldWeaponManifest": str(held_path.relative_to(ROOT)).replace("\\", "/"), "heldWeaponManifestSha256": sha256_file(held_path),
            "runtimePistolAxisDeviationDegrees": round(deviation, 3), "runtimePistolSocketBounds": [local.min(axis=0).round(4).tolist(), local.max(axis=0).round(4).tolist()],
        }
    return result


def pack(args: argparse.Namespace) -> None:
    from PIL import Image, ImageDraw

    work = Path(args.work).resolve()
    package = Path(args.package).resolve()
    receipts = Path(args.receipts).resolve()
    if package.exists():
        shutil.rmtree(package)
    package.mkdir(parents=True)
    receipts.mkdir(parents=True, exist_ok=True)
    weapons: dict[str, Any] = {}
    reports: dict[str, Any] = {}
    rows = []
    for weapon_id in WEAPON_ORDER:
        spec = WEAPONS[weapon_id]
        weapon_work = work / weapon_id
        report = json.loads((weapon_work / "report.json").read_text(encoding="utf-8"))
        request = json.loads((weapon_work / "request.json").read_text(encoding="utf-8"))
        if report["sourceSha256Before"] != request["sourceSha256"] or report["sourceSha256After"] != request["sourceSha256"]:
            raise RuntimeError(f"{weapon_id}: source hash drifted during export")
        exported = weapon_work / f"{weapon_id}.glb"
        if sha256_file(exported) != report["outputSha256"]:
            raise RuntimeError(f"{weapon_id}: exported GLB changed since its report")
        parsed = parse_glb(exported)
        size = exported.stat().st_size
        if size > BUDGETS["maxBytes"] or parsed["triangles"] > BUDGETS["maxTriangles"] or len(parsed["images"]) != 1 \
                or max(parsed["images"][0]["width"], parsed["images"][0]["height"]) > BUDGETS["maxTextureSize"] or parsed["extensionsRequired"]:
            raise RuntimeError(f"{weapon_id}: budget failure {size} bytes / {parsed['triangles']} tris / {parsed['images']}")
        muzzle = parsed["extras"].get("hmh_muzzle")
        if not muzzle or list(map(float, muzzle)) != list(map(float, report["placement"]["muzzle"])):
            raise RuntimeError(f"{weapon_id}: muzzle extras missing from the GLB")
        shutil.copyfile(exported, package / f"{weapon_id}.glb")
        weapons[weapon_id] = {
            "file": f"{weapon_id}.glb", "bytes": size, "sha256": report["outputSha256"], "triangles": parsed["triangles"], "vertices": parsed["vertices"],
            "texture": parsed["images"][0], "slot": spec["slot"], "title": spec["title"], "standIn": spec["note"].startswith("STAND-IN"),
            "castingNote": spec["note"], "lengthMetres": spec["lengthMetres"], "grip": [0.0, 0.0, 0.0], "forward": "+X", "muzzle": [round(float(v), 5) for v in muzzle],
            "boreHeight": spec["boreHeight"], "reload": spec["reload"], "equip": spec["equip"],
            "source": {"file": spec["source"], "sha256": request["sourceSha256"], "bytes": request["sourceBytes"], "triangles": report["sourceTriangles"], "textured": report["sourceTextured"]},
            "material": {"metallic": spec["metallic"], "roughness": spec["roughness"], "tint": spec["tint"]},
        }
        reports[weapon_id] = report
        rows.append((weapon_id, weapon_work, report, parsed, size))
    heroes = hero_grip_frames()
    manifest = {
        "schemaVersion": 1, "pipelineId": PIPELINE_ID, "classification": "native-render-candidate", "runtimeAuthority": "projection-only",
        "artAccepted": False, "canonicalAdoption": False, "settlementLive": False,
        "gripFrame": {
            "origin": "trigger-hand palm point on the grip", "forward": "+X toward the muzzle", "left": "+Y", "up": "+Z",
            "units": "metres at hero scale (hero GLBs are 2.1 m tall)", "glbAxes": "+X forward, +Y up, +Z right (glTF Y-up export of the Blender grip frame)",
            "glbToGrip": "grip = (x, -z, y) of the GLB vertex", "socketJoint": "pistol_prop (identity child of weapon_socket under hand.R)",
            "attachment": "socketLocal = axesInSocket * grip + anchorInSocket; model = jointWorld[pistol_prop] * socketLocal",
        },
        "budgets": BUDGETS, "heroes": heroes, "weapons": weapons,
        "scripts": {"exporter": str(EXPORTER.relative_to(ROOT)).replace("\\", "/"), "exporterSha256": sha256_file(EXPORTER),
                    "orchestrator": "scripts/run-hmh-weapon-models.py", "orchestratorSha256": sha256_file(Path(__file__).resolve())},
        "blender": reports[WEAPON_ORDER[0]]["blender"],
        "generatedUtc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
    }
    write_json(package / "manifest.json", manifest)
    # Contact sheet: source side | low side | low three-quarter | low top | texture.
    cell = 256
    sheet = Image.new("RGB", (cell * 5 + 300, cell * len(rows)), (18, 18, 22))
    draw = ImageDraw.Draw(sheet)
    for row, (weapon_id, weapon_work, report, parsed, size) in enumerate(rows):
        y = row * cell
        draw.text((8, y + 8), f"{weapon_id}", fill=(255, 255, 255))
        draw.text((8, y + 24), WEAPONS[weapon_id]["title"], fill=(200, 200, 200))
        draw.text((8, y + 44), f"src {WEAPONS[weapon_id]['source']}", fill=(150, 150, 150))
        draw.text((8, y + 60), f"src {report['sourceTriangles']:,} tris -> {parsed['triangles']:,} tris", fill=(150, 150, 150))
        draw.text((8, y + 76), f"{size:,} bytes, {parsed['images'][0]['width']}x{parsed['images'][0]['height']} {parsed['images'][0]['mimeType'].split('/')[1]}", fill=(150, 150, 150))
        draw.text((8, y + 92), f"length {WEAPONS[weapon_id]['lengthMetres']} m, muzzle x {report['placement']['muzzle'][0]:.3f}", fill=(150, 150, 150))
        if WEAPONS[weapon_id]["note"].startswith("STAND-IN"):
            draw.text((8, y + 112), "STAND-IN", fill=(255, 170, 60))
        for column, key in enumerate(["source:side", "low:side", "low:three-quarter", "low:top"]):
            frame = Image.open(weapon_work / report["reviews"][key]).convert("RGBA").resize((cell, cell))
            backdrop = Image.new("RGBA", (cell, cell), (70, 74, 82, 255))
            backdrop.alpha_composite(frame)
            sheet.paste(backdrop.convert("RGB"), (300 + column * cell, y))
            draw.text((304 + column * cell, y + 4), key, fill=(255, 230, 120))
        texture = Image.open(weapon_work / report["textureJpeg"]).convert("RGB").resize((cell, cell))
        sheet.paste(texture, (300 + 4 * cell, y))
        draw.text((304 + 4 * cell, y + 4), "texture", fill=(255, 230, 120))
    sheet_path = receipts / "hmh-weapon-models-contact-sheet.png"
    sheet.save(sheet_path)
    write_json(receipts / "export-reports.json", reports)
    write_json(receipts / "pack-summary.json", {
        "pipelineId": PIPELINE_ID, "manifestSha256": sha256_file(package / "manifest.json"), "contactSheetSha256": sha256_file(sheet_path),
        "weapons": {weapon_id: {"bytes": entry["bytes"], "triangles": entry["triangles"], "sha256": entry["sha256"], "standIn": entry["standIn"]} for weapon_id, entry in weapons.items()},
        "totalBytes": sum(entry["bytes"] for entry in weapons.values()),
    })
    print(f"packed {len(weapons)} weapons, {sum(entry['bytes'] for entry in weapons.values()):,} bytes; sheet {sheet_path}")


def main() -> None:
    args = parse_args()
    if args.command == "export":
        export(args)
    else:
        pack(args)


if __name__ == "__main__":
    main()
