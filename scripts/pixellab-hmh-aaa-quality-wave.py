#!/usr/bin/env python3
"""PixelLab AAA-quality character replacement wave for Hard Money Heroes.

Creates high-detail 8-direction replacement candidates for weak/incomplete enemy
sprites, then queues full readable animation kits with a slot-aware throttle.
Auth is read from ~/.claude.json and never persisted.

Usage:
  python scripts/pixellab-hmh-aaa-quality-wave.py balance
  python scripts/pixellab-hmh-aaa-quality-wave.py create --limit 4
  python scripts/pixellab-hmh-aaa-quality-wave.py animate --targets paper-hand,trench-degen --limit 8
  python scripts/pixellab-hmh-aaa-quality-wave.py status
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw
except ModuleNotFoundError:
    Image = None
    ImageDraw = None

try:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client
except ModuleNotFoundError:
    ClientSession = None
    streamablehttp_client = None


def require_pillow() -> None:
    if Image is None or ImageDraw is None:
        raise RuntimeError("Pillow is required for image normalization and contact-sheet generation")


def require_mcp_client() -> None:
    if ClientSession is None or streamablehttp_client is None:
        raise RuntimeError("The Python MCP client is required for PixelLab remote commands")


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/portal/assets/generated/hmh-aaa-pixellab-quality-wave"
QA_OUT = ROOT / ".hermes/tmp/hmh-aaa-pixellab-quality-wave"
LEDGER = OUT / "aaa-quality-wave-ledger.json"
ROSTER_ROOT = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
ROSTER_MANIFEST = ROSTER_ROOT / "hmh-animated-roster.mjs"
UUID_RE = re.compile(r"[0-9a-fA-F-]{36}")
DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
NO_TEXT = "no readable words, no letters, no numbers, no logos, no watermark"
STYLE = (
    "AAA premium isometric pixel-art game sprite, high top-down 3/4 view, transparent background, "
    "Hades and Dead Cells level of animation readability, Age of Empires 2 Definitive Edition style pre-rendered clarity, "
    "hand-painted high-bit pixel art, strong silhouette at 1x scale, readable from gameplay camera, "
    "crisp dark selective outline, dramatic warm/cool rim light, Litecoin silver, cyan neon, burnt umber, dusty ochre accents, "
    "original Crypto Wasteland/Web3 outlaw design, no copyrighted characters, no traced references, "
    + NO_TEXT
)

ANIMS = {
    "idle": "combat idle breathing, weight shift, weapon or claws ready, readable silhouette",
    "walk": "walking forward in a cautious combat patrol, feet grounded and body weight clear",
    "run": "fast aggressive run forward, strong leg motion and readable pursuit pose",
    "attack-tell": "clear anticipation wind-up before attacking, raised weapon or body lean, no hit yet",
    "attack": "committed forward attack strike, readable impact pose and follow-through",
    "hit": "brief recoil from taking damage, body snapped back but still recognizable",
    "death": "dramatic defeated collapse, readable final fall without gore overload",
    "spawn-in": "materializing into the arena from dust and neon pixels, short entrance pose",
}

LABEL_TO_STATE = {
    "combat idle breathing": "idle",
    "walking forward in a cautious": "walk",
    "fast aggressive run forward": "run",
    "clear anticipation wind-up": "attack-tell",
    "committed forward attack": "attack",
    "brief recoil from taking": "hit",
    "dramatic defeated collapse": "death",
    "materializing into the arena": "spawn-in",
}


def canonical_state_from_label(label: str) -> str:
    cleaned = label.lower().replace("custom-", "").strip()
    for needle, state in LABEL_TO_STATE.items():
        if needle in cleaned:
            return state
    return cleaned.replace(" ", "-")[:32]

TARGETS = {
    "paper-hand": {
        "name": "HMH AAA Paper Hand",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "priority": 1,
        "reason": "Level 1 runtime enemy missing attack-tell and spawn-in; current kit reads too plain for AAA target.",
        "description": "cowardly paper-handed crypto speculator enemy, twitchy folded-paper armor plates, loose receipt-cloak strips, anxious glowing cyan eyes, brittle origami gauntlets, sneaky outlaw posture",
    },
    "trench-degen": {
        "name": "HMH AAA Trench Degen",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "priority": 1,
        "reason": "Level 1 cave FUD proxy is missing attack/death/spawn-in and needs a stronger authored silhouette.",
        "description": "trench-coat crypto degen cave raider, dusty long coat, patched tactical vest, glowing scam-token goggles, jagged knife and satchel, hunched predatory silhouette",
    },
    "phishing-angler": {
        "name": "HMH AAA Phishing Angler",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "priority": 1,
        "reason": "Runtime enemy is missing hit/death/spawn-in and needs a cleaner hook/angler read.",
        "description": "phishing angler cyber-bandit enemy, ragged poncho, luminous lure-hook staff, net cables, hooked phishing line, hunched baiting posture, sinister cyan lure glow",
    },
    "mev-reaper": {
        "name": "HMH AAA MEV Reaper",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "priority": 1,
        "reason": "Level 1 runtime enemy has only run coverage; needs full high-quality replacement kit.",
        "description": "MEV reaper enemy, tall skeletal arbitrage outlaw, tattered black market cloak, cyan order-book scythe, sharp silhouette, predatory executioner stance",
    },
    "slippage-skater": {
        "name": "HMH AAA Slippage Skater",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "priority": 2,
        "reason": "Current kit is mostly complete but missing attack-tell/spawn-in; replace if the new candidate is stronger.",
        "description": "slippage skater enemy, rogue courier on cracked hover-skates, scarf and price-chart shoulder pads, low fast stance, cyan wheel sparks, aggressive slash posture",
    },
    "bitcoin-maximalist-riot-cop": {
        "name": "HMH AAA Bitcoin Maximalist Riot Cop",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 144,
        "priority": 2,
        "reason": "Partial two-state kit needs a complete replacement before use in richer encounters.",
        "description": "bitcoin maximalist riot cop enemy, heavy orange-black riot armor, cracked visor, coin-shield silhouette, shock baton, authoritarian march pose, crypto wasteland dust",
    },
    "nft-valet": {
        "name": "HMH AAA NFT Valet",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "priority": 3,
        "reason": "Current candidate has only attack/death and uneven death directions; needs AAA replacement.",
        "description": "smarmy NFT valet enemy, glossy torn tuxedo, neon key fob claws, fake luxury mask, gallery-rope belt, slippery lunge posture, cyan and magenta highlights",
    },
    "stablecoin-socialite": {
        "name": "HMH AAA Stablecoin Socialite",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "priority": 3,
        "reason": "Current candidate has idle only; needs complete replacement if kept in roster.",
        "description": "stablecoin socialite enemy, elegant corrupted gala outfit, coin-clutch purse, champagne-glass dagger, porcelain mask, smug poised silhouette, cool silver and cyan palette",
    },
    "influencer-camera-drone": {
        "name": "HMH AAA Influencer Camera Operator",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "runtime_frame_size": 144,
        "priority": 1,
        "reason": "Replace the legacy floating camera drone with a human camera operator while preserving the runtime and save ID.",
        "description": "human wasteland influencer camera operator enemy, torn luxury streetwear, shoulder-mounted broadcast camera, broken ring-light backpack, handheld flash controller, smug exhausted human face, cyan lens flare, lean paparazzi silhouette",
        "animationDescriptions": {
            "attack-tell": "human camera operator plants both feet, shoulders the broadcast camera, and holds a bright cyan focus light on the target before firing, clear ranged anticipation",
            "attack": "human camera operator triggers a harsh camera-flash blast with visible recoil, then lowers the shoulder camera into a readable recovery pose",
        },
    },
    "coyote-pack-runner": {
        "name": "HMH AAA Road Zombie Runner",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "runtime_frame_size": 172,
        "priority": 1,
        "reason": "Replace the old coyote silhouette with a fast human zombie that preserves the authored rusher lane role.",
        "description": "feral road zombie runner, formerly human wasteland courier, torn denim jacket, dusty work boots, cyan infected eyes, emaciated athletic build, low forward sprint posture, clawed hands",
        "animationDescriptions": {
            "attack-tell": "zombie runner drops one shoulder and coils low before a committed pounce, clear anticipation with no hit yet",
            "attack": "zombie runner performs a fast forward clawing pounce with readable impact and recovery",
        },
    },
    "wild-boar": {
        "name": "HMH AAA Armored Zombie Brute",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 144,
        "runtime_frame_size": 204,
        "priority": 1,
        "reason": "Replace the old boar and proxy heavy-creature art with one readable armored zombie tank.",
        "description": "massive armored human zombie brute, rusted road-sign shoulder plates, torn utility vest, heavy boots, broad undead frame, cracked riot helmet, orange infected glow through visor, charging tank silhouette",
        "animationDescriptions": {
            "attack-tell": "armored zombie brute plants both feet and lowers its helmet before a straight charge, unmistakable wind-up",
            "attack": "armored zombie brute commits to a heavy shoulder charge and body slam with strong follow-through",
        },
    },
    "buzzard": {
        "name": "HMH AAA Wasteland Raider Scout",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "runtime_frame_size": 160,
        "priority": 1,
        "reason": "Replace the flying buzzard proxy with a human ranged scout that still owns the harass lane.",
        "description": "lean human wasteland raider scout, dusty hood and goggles, cropped desert poncho, light rifle, cyan scope glint, agile boots, high-contrast ranged silhouette, original crypto outlaw gear",
        "animationDescriptions": {
            "attack-tell": "raider scout shoulders a rifle and holds a bright cyan scope glint before firing, clear ranged anticipation",
            "attack": "raider scout fires one controlled rifle shot forward with visible recoil and stable planted feet",
        },
    },
    "rattlesnake": {
        "name": "HMH AAA Zombie Trapper",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 120,
        "runtime_frame_size": 144,
        "priority": 1,
        "reason": "Replace the rattlesnake and small-creature proxies with an upright human zombie ambusher.",
        "description": "upright bipedal former-human zombie trapper standing on two separate booted human legs, exactly two human arms, torn sleeveless work shirt, leather trap harness, steel jaw trap carried in the left hand, rusted cleaver carried in the right hand, pale dusty human face, cyan infected eyes, compact hunched human silhouette",
        "animationDescriptions": {
            "idle": "upright human zombie trapper idles on two planted boots while holding a steel jaw trap and cleaver, readable biped silhouette",
            "walk": "upright human zombie trapper stalks forward on two booted legs with trap held low and cleaver ready",
            "run": "upright human zombie trapper sprints forward on two legs with a compact predatory human gait",
            "attack-tell": "zombie trapper plants both boots, opens the steel jaw trap forward, and raises the cleaver before striking, clear anticipation",
            "attack": "zombie trapper commits to a low cleaver slash while thrusting the steel jaw trap forward, then recovers upright",
        },
    },
    "scorpion-ambusher": {
        "name": "HMH AAA Mine Zombie Ambusher",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "runtime_frame_size": 144,
        "priority": 1,
        "reason": "Replace the scorpion and cave-goblin proxies with a buried mine zombie that supports ambush and lobber beats.",
        "description": "undead human mine worker ambusher, unmistakable exposed decayed human face with two infected eyes and visible nose and mouth, cracked yellow hardhat with a small separate cyan lamp mounted above the forehead, shredded coveralls, rusted pickaxe, dust-caked human skin, half-buried rising posture, no face mask, no cyclops visor, no robot head, no mechanical facial features, readable miner zombie silhouette",
        "animationDescriptions": {
            "attack-tell": "mine zombie raises its glowing hardhat and pickaxe above the sand before striking, clear anticipation",
            "attack": "mine zombie swings a rusted pickaxe forward in a committed overhead strike with dust follow-through",
        },
    },
    "sybil-drone": {
        "name": "HMH AAA Masked Sybil Gunner",
        "role": "enemy",
        "body_type": "humanoid",
        "size": 128,
        "runtime_frame_size": 144,
        "priority": 1,
        "reason": "Replace the drone and turret silhouettes with a human masked formation gunner.",
        "description": "masked human Sybil gunner, identical blank wallet mask, patched tactical coat, compact machine pistol, cyan target laser, lean formation-fighter silhouette, coordinated crypto cult raider",
        "animationDescriptions": {
            "attack-tell": "masked gunner raises a machine pistol and paints a cyan target laser before firing, clear ranged wind-up",
            "attack": "masked gunner fires a short controlled burst forward with readable weapon recoil and muzzle pose",
        },
    },
}


def load_server() -> dict[str, Any]:
    data = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    candidates = [
        project.get("mcpServers", {}).get("pixellab")
        for project in data.get("projects", {}).values()
    ]
    candidates.append(data.get("mcpServers", {}).get("pixellab"))
    for server in candidates:
        if server and str(server.get("url", "")).endswith("/mcp"):
            return server
    raise SystemExit("No working PixelLab /mcp config found in ~/.claude.json")


def text_of(result: Any) -> str:
    return "\n".join(c.text for c in getattr(result, "content", []) or [] if hasattr(c, "text"))


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
        ledger.setdefault("id", "hmh-aaa-pixellab-quality-wave-v1")
        ledger.setdefault("style", STYLE)
        ledger.setdefault("targets", {})
        return ledger
    return {"id": "hmh-aaa-pixellab-quality-wave-v1", "style": STYLE, "targets": {}}


def save_ledger(ledger: dict[str, Any]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")


def selected_targets(names: str | None) -> list[str]:
    if names:
        return [name.strip() for name in names.split(",") if name.strip()]
    return sorted(TARGETS, key=lambda k: (TARGETS[k]["priority"], k))


async def balance() -> None:
    require_mcp_client()
    server = load_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print(text_of(await session.call_tool("get_balance", {})))


async def create(limit: int | None, targets: str | None) -> None:
    require_mcp_client()
    ledger = load_ledger()
    server = load_server()
    made = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for key in selected_targets(targets):
                spec = TARGETS[key]
                entry = ledger["targets"].setdefault(key, {"spec": spec, "animations": {}})
                if entry.get("character_id"):
                    continue
                if limit is not None and made >= limit:
                    break
                args = {
                    "name": spec["name"],
                    "description": f"{spec['description']}, {STYLE}",
                    "body_type": spec["body_type"],
                    "mode": "v3",
                    "n_directions": 8,
                    "size": spec["size"],
                    "view": "high top-down",
                }
                print(f"creating {key}...", flush=True)
                try:
                    out = text_of(await session.call_tool("create_character", args))
                    ids = UUID_RE.findall(out)
                    entry["character_id"] = ids[-1] if ids else None
                    entry["status"] = "creating" if entry.get("character_id") else "create-response-without-id"
                    entry["created_at"] = int(time.time())
                    entry["raw_create"] = out[:500]
                    made += 1
                    print(f"  {key} -> {entry.get('character_id')}", flush=True)
                except Exception as exc:
                    entry["status"] = "create-error"
                    entry["error"] = str(exc)[:500]
                    print(f"  create error {key}: {exc}", flush=True)
                save_ledger(ledger)
                time.sleep(2)
    save_ledger(ledger)
    print(json.dumps({"created_now": made, "tracked": len(ledger["targets"])}, indent=2))


REMOTE_BUSY_WORD_RE = re.compile(r"\b(?:processing|creating)\b", re.I)
REMOTE_PROGRESS_RE = re.compile(r":\s*(?:\d|[1-9]\d)%\s*~", re.I)


def inflight_count(txt: str) -> int:
    return sum(
        1
        for line in txt.splitlines()
        if REMOTE_BUSY_WORD_RE.search(line) or REMOTE_PROGRESS_RE.search(line)
    )


def remote_jobs_busy(txt: str) -> bool:
    return bool(REMOTE_BUSY_WORD_RE.search(txt) or REMOTE_PROGRESS_RE.search(txt))


async def animate(limit: int | None, targets: str | None, max_inflight: int) -> None:
    require_mcp_client()
    ledger = load_ledger()
    server = load_server()
    queued = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for key in selected_targets(targets):
                entry = ledger["targets"].get(key)
                if not entry or not entry.get("character_id"):
                    print(f"skip {key}: no character_id", flush=True)
                    continue
                cid = entry["character_id"]
                remote_text = text_of(await session.call_tool("get_character", {"character_id": cid}))
                remote_coverage = state_direction_coverage_from_listing(remote_text)
                remote_completed_states = completed_states_from_listing(remote_text)
                remote_busy = remote_jobs_busy(remote_text)
                animation_specs = {
                    **ANIMS,
                    **(entry.get("spec", {}).get("animationDescriptions") or {}),
                }
                for anim, desc in animation_specs.items():
                    if limit is not None and queued >= limit:
                        save_ledger(ledger)
                        print(json.dumps({"queued_now": queued}, indent=2))
                        return
                    anim_entry = entry.setdefault("animations", {}).setdefault(anim, {})
                    raw_status = str(anim_entry.get("raw") or anim_entry.get("error") or "").lower()
                    if anim in remote_completed_states:
                        anim_entry.update({"status": "complete", "verified_at": int(time.time())})
                        continue
                    if anim_entry.get("status") == "queued" and not raw_status.startswith("error") and remote_busy:
                        continue
                    is_repair = anim_entry.get("status") in {"queued", "complete"} and not remote_busy
                    directions_to_queue = [
                        direction
                        for direction in DIRECTIONS
                        if len(remote_coverage.get(anim, {}).get(direction, [])) < 6
                    ] or list(DIRECTIONS)
                    repair_attempt = int(anim_entry.get("repair_attempts") or 0)
                    action_description = desc
                    if is_repair:
                        repair_attempt += 1
                        action_description = f"{desc}, repair pass {repair_attempt} for {', '.join(directions_to_queue)}"
                        print(f"  requeue missing remote state {key}/{anim}: {', '.join(directions_to_queue)}", flush=True)
                    while True:
                        txt = text_of(await session.call_tool("get_character", {"character_id": cid}))
                        if "creating" in txt.lower():
                            print(f"  {key} still creating; wait 20s", flush=True)
                            time.sleep(20)
                            continue
                        active = inflight_count(txt)
                        if active < max_inflight:
                            break
                        print(f"  {key}: {active} inflight >= {max_inflight}; wait 20s", flush=True)
                        time.sleep(20)
                    print(f"queue anim {key}/{anim}", flush=True)
                    try:
                        queue_error = None
                        while True:
                            out = text_of(await session.call_tool("animate_character", {
                                "character_id": cid,
                                "mode": "v3",
                                "animation_name": anim,
                                "action_description": action_description,
                                "directions": directions_to_queue,
                                "frame_count": 6,
                                "confirm_cost": True,
                            }))
                            if not out.lower().startswith("error:"):
                                break
                            anim_entry.update({"status": "queue-error", "directions": directions_to_queue, "job_ids": [], "queued_at": int(time.time()), "raw": out[:500]})
                            save_ledger(ledger)
                            wait_match = re.search(r"wait\s+(\d+)s", out, re.I)
                            if "job slots" not in out.lower() and not wait_match:
                                queue_error = out
                                print(f"  PixelLab queue error for {key}/{anim}: {out.splitlines()[0]}", flush=True)
                                break
                            wait_seconds = min(180, max(20, int(wait_match.group(1)) + 5 if wait_match else 80))
                            print(f"  PixelLab slots busy for {key}/{anim}: wait {wait_seconds}s", flush=True)
                            time.sleep(wait_seconds)
                        if queue_error:
                            continue
                        ids = [u for u in UUID_RE.findall(out) if u != cid]
                        anim_entry.update({"status": "queued", "directions": directions_to_queue, "job_ids": ids, "queued_at": int(time.time()), "raw": out[:500], "repair_attempts": repair_attempt})
                        queued += 1
                        print(f"  queued {key}/{anim} ids={len(ids)}", flush=True)
                    except Exception as exc:
                        anim_entry.update({"status": "queue-error", "error": str(exc)[:500], "queued_at": int(time.time())})
                        print(f"  anim error {key}/{anim}: {exc}", flush=True)
                    save_ledger(ledger)
                    time.sleep(4)
    save_ledger(ledger)
    print(json.dumps({"queued_now": queued}, indent=2))


URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")
LABEL_RE = re.compile(r"^\s+(.+?)\s*\((south-east|north-east|north-west|south-west|south|north|east|west),", re.M)
GROUP_HEADER_RE = re.compile(r"^\s{2}(.+?)\s+—\s+\d+\s+dir\b")
DIRECTION_LINE_RE = re.compile(r"^\s{4}(south-east|north-east|north-west|south-west|south|north|east|west):\s+(.+)$")
ANIM_URL_RE = re.compile(r"/animations/([0-9a-f-]{36})/([a-z-]+)/(\d+)\.png")


def parse_character_listing(text: str) -> tuple[list[tuple[str, str]], dict[str, dict[str, list[tuple[int, str]]]]]:
    labels: list[tuple[str, str]] = []
    groups: dict[str, dict[str, list[tuple[int, str]]]] = {}
    current_group: str | None = None
    for line in text.splitlines():
        header = GROUP_HEADER_RE.match(line)
        if header:
            state_name = header.group(1).strip()
            current_group = f"{state_name}:{len(labels)}"
            labels.append((state_name, "south"))
            groups[current_group] = {}
            continue
        direction_line = DIRECTION_LINE_RE.match(line)
        if not direction_line or current_group is None:
            continue
        direction = direction_line.group(1)
        frames: list[tuple[int, str]] = []
        for url in URL_RE.findall(direction_line.group(2)):
            match = ANIM_URL_RE.search(url)
            if match:
                frames.append((int(match.group(3)), url))
        if frames:
            groups[current_group][direction] = frames
    if groups:
        return labels, groups

    # Compatibility with the older PixelLab listing shape, which emitted one
    # label beside each direction-specific animation UUID.
    legacy_labels = LABEL_RE.findall(text)
    legacy_groups: dict[str, dict[str, list[tuple[int, str]]]] = {}
    order: list[str] = []
    for url in URL_RE.findall(text):
        match = ANIM_URL_RE.search(url)
        if not match:
            continue
        aid, direction, frame = match.group(1), match.group(2), int(match.group(3))
        if aid not in legacy_groups:
            order.append(aid)
        legacy_groups.setdefault(aid, {}).setdefault(direction, []).append((frame, url))
    ordered_labels: list[tuple[str, str]] = []
    for index, aid in enumerate(order):
        ordered_labels.append(legacy_labels[index] if index < len(legacy_labels) else (f"anim{index}", next(iter(legacy_groups[aid]), "south")))
    return ordered_labels, {aid: legacy_groups[aid] for aid in order}


def state_direction_coverage_from_listing(text: str) -> dict[str, dict[str, list[str]]]:
    labels, groups = parse_character_listing(text)
    merged: dict[str, dict[str, list[str]]] = {}
    for (_group_id, directions), (name, _label_dir) in zip(groups.items(), labels):
        state = canonical_state_from_label(name)
        state_directions = merged.setdefault(state, {})
        for direction, frames in directions.items():
            urls = [url for _frame, url in frames]
            if len(urls) >= len(state_directions.get(direction, [])):
                state_directions[direction] = urls
    return merged


def completed_states_from_listing(text: str) -> set[str]:
    merged = state_direction_coverage_from_listing(text)
    return {
        state
        for state, directions in merged.items()
        if all(len(directions.get(direction, [])) >= 6 for direction in DIRECTIONS)
    }


def normalize_downloaded_frame(path: Path, runtime_frame_size: int | None) -> None:
    target = int(runtime_frame_size or 0)
    if target <= 0:
        return
    require_pillow()
    with Image.open(path) as source:
        image = source.convert("RGBA")
    if image.size == (target, target):
        return
    scale = min(target / image.width, target / image.height)
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    resized = image.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((target - width) // 2, target - height))
    canvas.save(path)


def download(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "hmh-aaa-pixellab-quality-wave"})
    with urllib.request.urlopen(req, timeout=120) as response:
        data = response.read()
    if not data.startswith(bytes.fromhex("89504e470d0a1a0a")):
        return False
    dest.write_bytes(data)
    return dest.stat().st_size > 0


def download_and_normalize(url: str, dest: Path, runtime_frame_size: int | None) -> tuple[Path, bool, str | None]:
    try:
        ok = download(url, dest)
        if ok:
            normalize_downloaded_frame(dest, runtime_frame_size)
        return dest, ok, None if ok else "invalid-png"
    except Exception as exc:
        return dest, False, f"{type(exc).__name__}:{exc}"


async def collect(limit: int | None, targets: str | None, wait_seconds: int = 1800, download_workers: int = 16) -> None:
    require_mcp_client()
    ledger = load_ledger()
    server = load_server()
    collected_chars = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for key in selected_targets(targets):
                entry = ledger.get("targets", {}).get(key)
                if not entry or not entry.get("character_id"):
                    continue
                if limit is not None and collected_chars >= limit:
                    break
                cid = entry["character_id"]
                deadline = time.monotonic() + max(0, wait_seconds)
                labels: list[tuple[str, str]] = []
                groups: dict[str, dict[str, list[tuple[int, str]]]] = {}
                while True:
                    text = text_of(await session.call_tool("get_character", {"character_id": cid}))
                    labels, groups = parse_character_listing(text)
                    discovered: dict[str, set[str]] = {}
                    for (_aid, dirs), (name, _label_dir) in zip(groups.items(), labels):
                        discovered.setdefault(canonical_state_from_label(name), set()).update(
                            direction for direction, frames in dirs.items() if len(frames) >= 6
                        )
                    missing = [
                        f"{state}/{direction}"
                        for state in ANIMS
                        for direction in DIRECTIONS
                        if direction not in discovered.get(state, set())
                    ]
                    still_processing = "processing" in text.lower() or "creating" in text.lower()
                    if not still_processing and not missing:
                        break
                    if time.monotonic() >= deadline:
                        entry["status"] = "collect-timeout"
                        entry["collect_error"] = {
                            "stillProcessing": still_processing,
                            "missing": missing,
                            "waitSeconds": wait_seconds,
                        }
                        print(f"{key}: collect timeout; missing {len(missing)} state-directions", flush=True)
                        save_ledger(ledger)
                        groups = {}
                        break
                    print(f"{key}: waiting for complete 8x8 matrix; missing {len(missing)}", flush=True)
                    time.sleep(20)
                if not groups:
                    continue
                manifest_anims: dict[str, dict[str, list[str]]] = {}
                download_jobs: dict[Path, tuple[str, Path, int | None]] = {}
                runtime_frame_size = entry.get("spec", {}).get("runtime_frame_size")
                for (_aid, dirs), (name, _label_dir) in zip(groups.items(), labels):
                    canonical = canonical_state_from_label(name)
                    for direction, frames in dirs.items():
                        rels: list[str] = []
                        for frame_index, url in sorted(frames):
                            dest = OUT / "actors" / key / canonical / direction / f"{frame_index:02d}.png"
                            download_jobs[dest] = (url, dest, runtime_frame_size)
                            rels.append(f"./assets/generated/hmh-aaa-pixellab-quality-wave/actors/{key}/{canonical}/{direction}/{frame_index:02d}.png")
                        if rels:
                            manifest_anims.setdefault(canonical, {})[direction] = rels
                download_errors: list[str] = []
                worker_count = max(1, min(int(download_workers), 32))
                print(f"{key}: downloading {len(download_jobs)} frames with {worker_count} workers", flush=True)
                with ThreadPoolExecutor(max_workers=worker_count) as executor:
                    futures = {
                        executor.submit(download_and_normalize, url, dest, size): dest
                        for dest, (url, _dest, size) in download_jobs.items()
                    }
                    for future in as_completed(futures):
                        dest, ok, error = future.result()
                        if not ok:
                            download_errors.append(f"{dest}:{error}")
                if download_errors:
                    entry["status"] = "collect-download-error"
                    entry["collect_error"] = {"downloadErrors": download_errors[:50], "count": len(download_errors)}
                    print(f"{key}: download errors {len(download_errors)}", flush=True)
                    save_ledger(ledger)
                    continue
                if manifest_anims:
                    entry["status"] = "collected"
                    entry["collected_at"] = int(time.time())
                    entry["manifest"] = {"role": entry.get("spec", {}).get("role", "enemy"), "character_id": cid, "animations": manifest_anims}
                    for anim_name, directions in manifest_anims.items():
                        status = "complete" if all(direction in directions for direction in DIRECTIONS) else "partial"
                        entry.setdefault("animations", {}).setdefault(anim_name, {})["status"] = status
                    collected_chars += 1
                    print(f"{key}: collected {len(manifest_anims)} animation groups", flush=True)
                save_ledger(ledger)
    write_manifest_and_sheet(ledger)
    print(json.dumps({"collected_chars": collected_chars}, indent=2))


def write_manifest_and_sheet(ledger: dict[str, Any]) -> None:
    manifest = {key: entry["manifest"] for key, entry in ledger.get("targets", {}).items() if entry.get("manifest")}
    QA_OUT.mkdir(parents=True, exist_ok=True)
    (QA_OUT / "hmh-aaa-quality-wave-manifest.mjs").write_text(
        "// Generated by scripts/pixellab-hmh-aaa-quality-wave.py. Review candidates before runtime replacement.\n"
        f"export const HMH_AAA_QUALITY_WAVE = Object.freeze({json.dumps(manifest, indent=2)});\n",
        encoding="utf-8",
    )
    thumbs = []
    qa_states = ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in"]
    for key, entry in manifest.items():
        for state in qa_states:
            frames = entry.get("animations", {}).get(state, {}).get("south") or []
            if frames:
                thumbs.append((key, state, ROOT / "apps/portal" / frames[0].replace("./", "")))
    if not thumbs:
        return
    require_pillow()
    cell = 132
    label_h = 26
    cols = min(len(qa_states), len(thumbs))
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGBA", (cell * cols, (cell + label_h) * rows), (10, 8, 22, 255))
    draw = ImageDraw.Draw(sheet)
    for idx, (key, state, path) in enumerate(thumbs):
        if not path.exists():
            continue
        image = Image.open(path).convert("RGBA")
        image.thumbnail((112, 112), Image.Resampling.NEAREST)
        x = (idx % cols) * cell + (cell - image.width) // 2
        y = (idx // cols) * (cell + label_h) + 4
        sheet.alpha_composite(image, (x, y))
        draw.text(((idx % cols) * cell + 4, y + 114), f"{key[:18]} {state}", fill=(255, 232, 77, 255))
    sheet.save(QA_OUT / "hmh-aaa-quality-wave-contact-sheet.png")


def parse_runtime_roster() -> tuple[str, dict[str, Any]]:
    text = ROSTER_MANIFEST.read_text(encoding="utf-8")
    marker = "export const HMH_ANIMATED_ROSTER = Object.freeze("
    marker_index = text.index(marker)
    payload_start = marker_index + len(marker)
    payload_end = text.rindex(");")
    return text[:marker_index], json.loads(text[payload_start:payload_end])


def atomic_promote_staged(stage_root: Path, actor_keys: list[str], manifest_text: str) -> None:
    backup_root = stage_root / ".rollback"
    backup_root.mkdir(parents=True, exist_ok=True)
    manifest_temp = stage_root / ".hmh-animated-roster.mjs.tmp"
    with manifest_temp.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(manifest_text)
        handle.flush()
        os.fsync(handle.fileno())

    swapped: list[tuple[str, bool]] = []
    try:
        ROSTER_ROOT.mkdir(parents=True, exist_ok=True)
        for key in actor_keys:
            source = stage_root / key
            destination = ROSTER_ROOT / key
            backup = backup_root / key
            if not source.is_dir():
                raise FileNotFoundError(f"Missing staged actor directory: {source}")
            had_existing = destination.exists()
            if had_existing:
                destination.replace(backup)
            swapped.append((key, had_existing))
            source.replace(destination)
        os.replace(manifest_temp, ROSTER_MANIFEST)
    except Exception:
        for key, had_existing in reversed(swapped):
            destination = ROSTER_ROOT / key
            backup = backup_root / key
            if destination.exists():
                shutil.rmtree(destination)
            if had_existing and backup.exists():
                backup.replace(destination)
        raise
    finally:
        shutil.rmtree(stage_root, ignore_errors=True)


def promote(targets: str | None) -> None:
    if not targets:
        raise SystemExit("promote requires --targets; broad implicit promotion is disabled")
    ledger = load_ledger()
    prefix, roster = parse_runtime_roster()
    selected = selected_targets(targets)
    stage_root = ROSTER_ROOT.parent / f".hmh-promote-{os.getpid()}-{time.time_ns()}"
    stage_root.mkdir(parents=True, exist_ok=False)
    staged: list[str] = []
    failures: dict[str, list[str]] = {}
    for key in selected:
        entry = ledger.get("targets", {}).get(key) or {}
        manifest = entry.get("manifest") or {}
        animations = manifest.get("animations") or {}
        missing: list[str] = []
        for state in ANIMS:
            directions = animations.get(state) or {}
            for direction in DIRECTIONS:
                frames = directions.get(direction) or []
                if len(frames) < 6:
                    missing.append(f"{state}/{direction}:frames={len(frames)}/6")
                    continue
                for frame in frames:
                    source = ROOT / "apps/portal" / frame.removeprefix("./")
                    if not source.exists():
                        missing.append(f"missing-file:{state}/{direction}/{source.name}")
                        break
        if missing:
            failures[key] = missing
            continue
        source_dir = OUT / "actors" / key
        staged_destination = stage_root / key
        if not source_dir.is_dir():
            failures[key] = ["missing-actor-directory"]
            continue
        try:
            shutil.copytree(source_dir, staged_destination)
        except Exception as exc:
            failures[key] = [f"stage-copy-failed:{type(exc).__name__}:{exc}"]
            continue
        canonical_animations: dict[str, dict[str, list[str]]] = {}
        for state, directions in animations.items():
            canonical_animations[state] = {
                direction: [
                    frame.replace(
                        f"./assets/generated/hmh-aaa-pixellab-quality-wave/actors/{key}/",
                        f"./assets/generated/hmh-animated-roster/{key}/",
                    )
                    for frame in frames
                ]
                for direction, frames in directions.items()
            }
        spec = entry.get("spec") or {}
        visual_type = "zombie" if "zombie" in f"{spec.get('name', '')} {spec.get('description', '')}".lower() else "human"
        roster[key] = {
            "role": manifest.get("role", "enemy"),
            "character_id": manifest.get("character_id"),
            "source": "pixellab-aaa-human-zombie-wave-v1",
            "visualType": visual_type,
            "animations": canonical_animations,
        }
        staged.append(key)
    if failures:
        shutil.rmtree(stage_root, ignore_errors=True)
        raise SystemExit(json.dumps({"promotionRejected": failures}, indent=2))
    marker = "export const HMH_ANIMATED_ROSTER = Object.freeze("
    manifest_text = prefix + marker + json.dumps(roster, separators=(",", ":")) + ");\n"
    atomic_promote_staged(stage_root, staged, manifest_text)
    print(json.dumps({"stagedForAtlasPacking": staged, "requiredStates": list(ANIMS), "directions": DIRECTIONS}, indent=2))


def status() -> None:
    ledger = load_ledger()
    rows = {}
    for key, entry in ledger.get("targets", {}).items():
        anims = entry.get("animations", {})
        by = {}
        for value in anims.values():
            by[value.get("status", "unknown")] = by.get(value.get("status", "unknown"), 0) + 1
        rows[key] = {"status": entry.get("status"), "character_id": entry.get("character_id"), "animations": by, "reason": entry.get("spec", {}).get("reason")}
    print(json.dumps({"targets": rows, "ledger": str(LEDGER)}, indent=2))


def compact_ledger(targets: str | None = None) -> None:
    if not targets:
        raise SystemExit("compact-ledger requires --targets; compact promoted actors explicitly")
    ledger = load_ledger()
    selected = set(selected_targets(targets))
    missing = sorted(selected - set(ledger.get("targets", {})))
    if missing:
        raise SystemExit(f"compact-ledger targets are absent from the ledger: {', '.join(missing)}")
    compacted_entries: dict[str, dict[str, Any]] = {}
    for key, entry in list(ledger.get("targets", {}).items()):
        if key not in selected:
            continue
        status = entry.get("status")
        if not status:
            raise SystemExit(f"compact-ledger target is missing status metadata: {key}")
        if status not in {"collected", "promoted"}:
            raise SystemExit(f"compact-ledger target is not collected or promoted: {key} ({status})")
        if status == "collected" and not entry.get("manifest"):
            raise SystemExit(f"compact-ledger collected target is missing its staging manifest: {key}")
        animations: dict[str, dict[str, Any]] = {}
        for state, animation in entry.get("animations", {}).items():
            job_ids = list(dict.fromkeys(animation.get("job_ids", [])))
            compact_animation = {
                field: animation[field]
                for field in ("status", "directions", "queued_at", "verified_at")
                if field in animation
            }
            if job_ids:
                compact_animation["job_ids"] = job_ids
            if animation.get("repair_attempts"):
                try:
                    compact_animation["repair_attempts"] = int(animation["repair_attempts"])
                except (TypeError, ValueError) as exc:
                    raise SystemExit(f"invalid repair_attempts for {key}/{state}") from exc
            animations[state] = compact_animation
        compact_entry = {
            field: entry[field]
            for field in ("spec", "character_id", "created_at", "collected_at", "rejected_character_ids")
            if field in entry
        }
        compact_entry["status"] = "promoted" if status in {"collected", "promoted"} else status
        compact_entry["animations"] = animations
        compacted_entries[key] = compact_entry
    ledger["targets"].update(compacted_entries)
    save_ledger(ledger)
    print(json.dumps({"compacted": sorted(compacted_entries), "ledger": str(LEDGER)}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("cmd", choices=["balance", "create", "animate", "collect", "promote", "compact-ledger", "status"])
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--targets", default=None)
    parser.add_argument("--max-inflight", type=int, default=3)
    parser.add_argument("--collect-timeout", type=int, default=1800)
    parser.add_argument("--download-workers", type=int, default=16)
    args = parser.parse_args()
    if args.cmd == "balance":
        asyncio.run(balance())
    elif args.cmd == "create":
        asyncio.run(create(args.limit, args.targets))
    elif args.cmd == "animate":
        asyncio.run(animate(args.limit, args.targets, args.max_inflight))
    elif args.cmd == "collect":
        asyncio.run(collect(args.limit, args.targets, args.collect_timeout, args.download_workers))
    elif args.cmd == "promote":
        promote(args.targets)
    elif args.cmd == "compact-ledger":
        compact_ledger(args.targets)
    else:
        status()


if __name__ == "__main__":
    main()
