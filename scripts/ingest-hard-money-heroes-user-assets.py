#!/usr/bin/env python
"""Ingest user-provided Hard Money Heroes reference art into runtime-ready assets.

This keeps the original PNG/MP3 references under apps/portal/assets/hard-money-heroes/reference
and exports browser-sized 128x128 character/enemy frames plus menu screens that the Canvas runtime
can load directly. The generated frame manifest is intentionally small and deterministic so tests
can verify paths and dimensions without requiring the original Desktop source folder.
"""
from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR_ENV = "HMH_ART_SOURCE_DIR"
SOURCE_DIR = Path(os.environ[SOURCE_DIR_ENV]) if os.environ.get(SOURCE_DIR_ENV) else None
OUT_DIR = REPO_ROOT / "apps" / "portal" / "assets" / "hard-money-heroes"
FRAME_SIZE = (128, 128)


def optional_source_path(env_var: str) -> Path | None:
    value = os.environ.get(env_var)
    return Path(value) if value else None

MUSIC_SOURCES = [
    (
        "getting-lit-vocals",
        "Lester and Lilly Rap - Getting Lit (Vocals)",
        optional_source_path("HMH_MUSIC_GETTING_LIT_VOCALS"),
        "lester-and-lilly-rap-getting-lit-vocals.mp3",
    ),
    (
        "going-to-the-moon",
        "LitVM Going To The Moon",
        optional_source_path("HMH_MUSIC_GOING_TO_THE_MOON"),
        "litvm-going-to-the-moon-new-2.mp3",
    ),
    (
        "testnet-teaser",
        "LitVM TestNet Teaser",
        optional_source_path("HMH_MUSIC_TESTNET_TEASER"),
        "litvm-testnet-teaser.mp3",
    ),
    (
        "rise-to-the-occasion",
        "Rise to the Occasion",
        optional_source_path("HMH_MUSIC_RISE_TO_THE_OCCASION"),
        "rise-to-the-occasion.mp3",
    ),
]

CHARACTER_SOURCES = {
    "lester": {
        "sourcePrefix": "Lester",
        "states": {
            "idle": "Lester-idle*.png",
            "walk": "Lester-walk*.png",
            "run": "Lester-run*.png",
            "jump": "Lester-jump*.png",
            "attack": "Lester-attack*.png",
        },
        "weaponAnimations": {
            "knife": {
                "stabAnimation": "Lester-stab*.png",
            },
        },
        "stills": {
            "machineGunFacing": "Lester-Facing-Machine-Gun.png",
            "machineGunRight": "Lester-RightSide-Machine-Gun.png",
            "machineGunLeft": "Lester-LeftSide-Machine-Gun.png",
            "knifeFacing": "Lester-Facing-Melee-Knife.png",
            "knifeRight": "Lester-RightSide-Melee-Knife.png",
            "grenadeFacing": "Lester-Facing-Grenade.png",
            "grenadeRight": "Lester-RightSide-Grenade.png",
            "grenadeLeft": "Lester-LeftSide-Grenade.png",
        },
    },
    "lilly": {
        "sourcePrefix": "Lilly",
        "states": {
            "idle": "Lilly-idle*.png",
            "walk": "Lilly-walk*.png",
            "run": "Lilly-run*.png",
            "jump": "Lilly-jump*.png",
            "attack": "Lilly-attack*.png",
        },
        "stills": {
            "machineGunFacing": "Lilly-Facing-MachineGun.png",
            "machineGunRight": "Lilly-RightSide-MachineGun.png",
            "machineGunLeft": "Lilly-LeftSide-MachineGun.png",
            "knifeFacing": "Lilly-Facing-Melee-Knife.png",
            "knifeRight": "Lilly-RightSide-Melee-Knife.png",
            "knifeLeft": "Lilly-LeftSide-Melee-Knife.png",
            "grenadeFacing": "Lilly-Facing-Grenade.png",
            "grenadeRight": "Lilly-RightSide-Grenade.png",
            "grenadeLeft": "Lilly-LeftSide-Grenade.png",
            "pistolFacing": "Lilly-Facing-Pistol.png",
            "shotgunFacing": "Lilly-Facing-Shotgun.png",
        },
    },
}

ENEMY_SOURCES = {
    "trench-degen": {
        "sourcePrefix": "Trench Degen",
        "states": {
            "idle": "Trench Degen-idle*.png",
            "walk": "Trench Degen-walk*.png",
            "run": "Trench Degen-run*.png",
            "jump": "Trench Degen-jump*.png",
            "attack": "Trench Degen-attack*.png",
        },
        "stills": ["Enemy-Facing-Trench-Degen.png", "Enemy-LeftSide-Trench-Degen.png", "Enemy-RightSide-Trench-Degen.png"],
    },
    "evil-banker": {
        "sourcePrefix": "Evil Banker",
        "states": {
            "idle": "Evil Banker-idle*.png",
            "walk": "Evil Banker-walk*.png",
            "run": "Evil Banker-run*.png",
            "jump": "Evil Banker-jump*.png",
            "attack": "Evil Banker-attack*.png",
        },
        "stills": ["Enemy-Facing-EvilBanker.png", "Enemy-LeftSide-EvilBanker.png", "Enemy-RightSide-EvilBanker.png"],
    },
    "warren-spear-rider": {
        "sourcePrefix": "Evil Boss",
        "states": {
            "idle": "Evil Boss-idle*.png",
            "walk": "Evil Boss-walk*.png",
            "run": "Evil Boss-run*.png",
            "jump": "Evil Boss-jump*.png",
            "attack": "Evil Boss-attack*.png",
        },
        "stills": ["Enemy-Boss-WarrenIndian-Facing.png", "Enemy-Boss-WarrenIndian-LeftSide.png", "Enemy-Boss-WarrenIndian-RightSide.png"],
        "extraFramesIngested": True,
    },
    "crypto-bro": {
        "sourcePrefix": "Crypto Bro",
        "states": {
            "idle": "Crypto Bro-idle*.png",
            "walk": "Crypto Bro-walk*.png",
            "run": "Crypto Bro-run*.png",
            "jump": "Crypto Bro-jump*.png",
            "attack": "Crypto Bro-attack*.png",
        },
        "stills": ["CryptoBroKOL-Facing.png", "CryptoBroKOL-LeftProfile.png", "CryptoBroKOL-Facing-CharacterSheet.png"],
    },
    "gas-beast": {
        "sourcePrefix": "Gas Beast",
        "states": {
            "idle": "Gas Beast-idle*.png",
            "walk": "Gas Beast-walk*.png",
            "run": "Gas Beast-run*.png",
            "jump": "Gas Beast-jump*.png",
            "attack": "Gas Beast-attack*.png",
        },
        "stills": ["Eth-Gas-Beast-Facing.png", "Eth-Gas-Beast-LeftProfile.png", "Eth-Gas-Beast-CharacterSheet.png"],
    },
}

SCREEN_SOURCES = {
    "splash": ("Hard-Money-Heroes-KeyArt.png", "boot-splash.png"),
    "mainMenu": ("Hard-Money-Heroes-KeyArt-GameMenu.png", "main-menu.png"),
    "options": ("Hard-Money-Heroes-KeyArt-GameOptions.png", "options.png"),
    "modeSelect": ("Hard-Money-Heroes-KeyArt-StartScreen.png", "mode-select.png"),
}


def sort_key(path: Path) -> tuple[int, str]:
    match = re.search(r"\((\d+)\)", path.stem)
    index = int(match.group(1)) if match else 0
    return (index, path.name.lower())


def repo_src(path: Path) -> str:
    return "./" + path.relative_to(REPO_ROOT / "apps" / "portal").as_posix()


def crop_to_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return rgba
    left, top, right, bottom = bbox
    pad_x = max(8, int((right - left) * 0.08))
    pad_y = max(8, int((bottom - top) * 0.08))
    left = max(0, left - pad_x)
    top = max(0, top - pad_y)
    right = min(rgba.width, right + pad_x)
    bottom = min(rgba.height, bottom + pad_y)
    return rgba.crop((left, top, right, bottom))


def write_centered_sprite(source: Path, destination: Path, size: tuple[int, int] = FRAME_SIZE) -> None:
    with Image.open(source) as image:
        crop = crop_to_alpha(image)
        resized = ImageOps.contain(crop, size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        canvas.alpha_composite(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, "PNG", optimize=True)


def frame_sources(pattern: str, fallback_patterns: Iterable[str] = ()) -> list[Path]:
    files = sorted(SOURCE_DIR.rglob(pattern), key=sort_key)
    if files:
        return files
    for fallback in fallback_patterns:
        files = sorted(SOURCE_DIR.rglob(fallback), key=sort_key)
        if files:
            return files
    return []


def generate_state_frames(actor_id: str, state: str, pattern: str, min_frames: int = 8) -> dict:
    sources = frame_sources(pattern)
    if not sources:
        raise FileNotFoundError(f"No source frames found for {actor_id} {state}: {pattern}")
    count = max(min_frames, len(sources))
    frames = []
    for index in range(count):
        source = sources[index % len(sources)]
        destination = OUT_DIR / "frames" / actor_id / state / f"{actor_id}-{state}-{index:02}.png"
        write_centered_sprite(source, destination)
        frames.append({
            "src": repo_src(destination),
            "source": source.name,
            "size": list(FRAME_SIZE),
        })
    return {"selectedFrom": sources[0].name, "frames": frames}


def copy_if_exists(source: Path | None, destination: Path) -> dict | None:
    if source is None or not source.exists():
        return None
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return {"src": repo_src(destination), "source": source.name, "bytes": destination.stat().st_size}


def ingest_actor(actor_id: str, config: dict) -> dict:
    animations = {state: generate_state_frames(actor_id, state, pattern) for state, pattern in config["states"].items()}
    weapon_animations = {}
    for weapon_id, animation_map in config.get("weaponAnimations", {}).items():
        weapon_animations[weapon_id] = {}
        for animation_id, pattern in animation_map.items():
            state = re.sub(r"Animation$", "", animation_id)
            weapon_animations[weapon_id][animation_id] = generate_state_frames(actor_id, state, pattern)
    stills = {}
    for still_id, filename in config.get("stills", {}).items():
        copied = copy_if_exists(SOURCE_DIR / filename, OUT_DIR / "stills" / actor_id / f"{actor_id}-{still_id}.png")
        if copied:
            stills[still_id] = copied
    return {"animations": animations, "stills": stills, "weaponAnimations": weapon_animations}


def ingest_enemy(enemy_id: str, config: dict) -> dict:
    animations = {state: generate_state_frames(enemy_id, state, pattern) for state, pattern in config["states"].items()}
    stills = []
    for index, filename in enumerate(config.get("stills", [])):
        copied = copy_if_exists(SOURCE_DIR / filename, OUT_DIR / "stills" / enemy_id / f"{enemy_id}-{index:02}.png")
        if not copied:
            # New-drop stills may live in the Enemies/ subfolder.
            matches = sorted(SOURCE_DIR.rglob(filename))
            if matches:
                copied = copy_if_exists(matches[0], OUT_DIR / "stills" / enemy_id / f"{enemy_id}-{index:02}.png")
        if copied:
            stills.append(copied)
    result = {"animations": animations, "stills": stills}
    if config.get("extraFramesIngested"):
        result["extraFramesIngested"] = True
    return result


def copy_reference_pngs() -> int:
    reference_dir = OUT_DIR / "reference"
    reference_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for source in SOURCE_DIR.rglob("*.png"):
        relative = source.relative_to(SOURCE_DIR)
        destination = reference_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        count += 1
    return count


def main() -> None:
    if SOURCE_DIR is None:
        raise FileNotFoundError(f"Set {SOURCE_DIR_ENV} to the Hard Money Heroes source art folder before running this ingest script.")
    if not SOURCE_DIR.exists():
        raise FileNotFoundError(f"Hard Money Heroes source art folder not found: {SOURCE_DIR}")

    copied_reference_count = copy_reference_pngs()
    characters = {actor_id: ingest_actor(actor_id, config) for actor_id, config in CHARACTER_SOURCES.items()}
    enemies = {enemy_id: ingest_enemy(enemy_id, config) for enemy_id, config in ENEMY_SOURCES.items()}

    screens = {}
    for screen_id, (source_name, out_name) in SCREEN_SOURCES.items():
        copied = copy_if_exists(SOURCE_DIR / source_name, OUT_DIR / "screens" / out_name)
        if not copied:
            raise FileNotFoundError(f"Missing screen source: {source_name}")
        screens[screen_id] = copied

    music = []
    music_dir = REPO_ROOT / "apps" / "portal" / "assets" / "audio" / "music"
    for track_id, title, source, out_name in MUSIC_SOURCES:
        copied = copy_if_exists(source, music_dir / out_name)
        if copied:
            music.append({"id": track_id, "title": title, **copied})

    manifest = {
        "id": "hard-money-heroes-user-assets-v1",
        "sourceDir": "user-provided Hard Money Heroes art assets (source path redacted)",
        "frameSize": list(FRAME_SIZE),
        "referencePngCount": copied_reference_count,
        "characters": characters,
        "enemies": enemies,
        "screens": screens,
        "musicTracks": music,
    }
    manifest_path = OUT_DIR / "hard-money-heroes-user-asset-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(json.dumps({
        "manifest": str(manifest_path),
        "characters": sorted(characters.keys()),
        "enemies": sorted(enemies.keys()),
        "screens": sorted(screens.keys()),
        "musicTracks": len(music),
        "referencePngCount": copied_reference_count,
    }, indent=2))


if __name__ == "__main__":
    main()
