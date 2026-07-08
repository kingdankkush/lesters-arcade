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
import re
import time
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/portal/assets/generated/hmh-aaa-pixellab-quality-wave"
LEDGER = OUT / "aaa-quality-wave-ledger.json"
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
}


def load_server() -> dict[str, Any]:
    data = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for project in data.get("projects", {}).values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit("No PixelLab MCP config found in ~/.claude.json")


def text_of(result: Any) -> str:
    return "\n".join(c.text for c in getattr(result, "content", []) or [] if hasattr(c, "text"))


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"id": "hmh-aaa-pixellab-quality-wave-v1", "style": STYLE, "targets": {}}


def save_ledger(ledger: dict[str, Any]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")


def selected_targets(names: str | None) -> list[str]:
    if names:
        return [name.strip() for name in names.split(",") if name.strip()]
    return sorted(TARGETS, key=lambda k: (TARGETS[k]["priority"], k))


async def balance() -> None:
    server = load_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print(text_of(await session.call_tool("get_balance", {})))


async def create(limit: int | None, targets: str | None) -> None:
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


def inflight_count(txt: str) -> int:
    return len(re.findall(r"processing", txt, re.I))


async def animate(limit: int | None, targets: str | None, max_inflight: int) -> None:
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
                for anim, desc in ANIMS.items():
                    if limit is not None and queued >= limit:
                        save_ledger(ledger)
                        print(json.dumps({"queued_now": queued}, indent=2))
                        return
                    anim_entry = entry.setdefault("animations", {}).setdefault(anim, {})
                    raw_status = str(anim_entry.get("raw") or anim_entry.get("error") or "").lower()
                    if anim_entry.get("status") == "complete":
                        continue
                    if anim_entry.get("status") == "queued" and not raw_status.startswith("error"):
                        continue
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
                        while True:
                            out = text_of(await session.call_tool("animate_character", {
                                "character_id": cid,
                                "mode": "v3",
                                "animation_name": anim,
                                "action_description": desc,
                                "directions": DIRECTIONS,
                                "frame_count": 6,
                                "confirm_cost": True,
                            }))
                            if out.lower().startswith("error:"):
                                anim_entry.update({"status": "queue-error", "directions": DIRECTIONS, "job_ids": [], "queued_at": int(time.time()), "raw": out[:500]})
                                print(f"  PixelLab slot/error for {key}/{anim}: {out.splitlines()[0]}; wait 75s", flush=True)
                                save_ledger(ledger)
                                time.sleep(75)
                                continue
                            break
                        ids = [u for u in UUID_RE.findall(out) if u != cid]
                        anim_entry.update({"status": "queued", "directions": DIRECTIONS, "job_ids": ids, "queued_at": int(time.time()), "raw": out[:500]})
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
ANIM_URL_RE = re.compile(r"/animations/([0-9a-f-]{36})/([a-z-]+)/(\d+)\.png")


def parse_character_listing(text: str) -> tuple[list[tuple[str, str]], dict[str, dict[str, list[tuple[int, str]]]]]:
    labels = LABEL_RE.findall(text)
    groups: dict[str, dict[str, list[tuple[int, str]]]] = {}
    order: list[str] = []
    for url in URL_RE.findall(text):
        match = ANIM_URL_RE.search(url)
        if not match:
            continue
        aid, direction, frame = match.group(1), match.group(2), int(match.group(3))
        if aid not in groups:
            order.append(aid)
        groups.setdefault(aid, {}).setdefault(direction, []).append((frame, url))
    ordered_labels: list[tuple[str, str]] = []
    for index, aid in enumerate(order):
        if index < len(labels):
            ordered_labels.append(labels[index])
        else:
            first_dir = next(iter(groups[aid]), "south")
            ordered_labels.append((f"anim{index}", first_dir))
    return ordered_labels, {aid: groups[aid] for aid in order}


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


async def collect(limit: int | None, targets: str | None) -> None:
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
                text = text_of(await session.call_tool("get_character", {"character_id": cid}))
                if "processing" in text.lower() or "creating" in text.lower():
                    print(f"{key}: still processing", flush=True)
                    continue
                labels, groups = parse_character_listing(text)
                manifest_anims: dict[str, dict[str, list[str]]] = {}
                for (aid, dirs), (name, _label_dir) in zip(groups.items(), labels):
                    canonical = canonical_state_from_label(name)
                    for direction, frames in dirs.items():
                        rels: list[str] = []
                        for frame_index, url in sorted(frames):
                            dest = OUT / "actors" / key / canonical / direction / f"{frame_index:02d}.png"
                            if download(url, dest):
                                rels.append(f"./assets/generated/hmh-aaa-pixellab-quality-wave/actors/{key}/{canonical}/{direction}/{frame_index:02d}.png")
                        if rels:
                            manifest_anims.setdefault(canonical, {})[direction] = rels
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
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "hmh-aaa-quality-wave-manifest.mjs").write_text(
        "// Generated by scripts/pixellab-hmh-aaa-quality-wave.py. Review candidates before runtime replacement.\n"
        f"export const HMH_AAA_QUALITY_WAVE = Object.freeze({json.dumps(manifest, indent=2)});\n",
        encoding="utf-8",
    )
    thumbs = []
    for key, entry in manifest.items():
        for state in ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in"]:
            frames = entry.get("animations", {}).get(state, {}).get("south") or []
            if frames:
                thumbs.append((key, state, ROOT / "apps/portal" / frames[0].replace("./", "")))
                break
    if not thumbs:
        return
    cell = 132
    label_h = 26
    cols = min(4, len(thumbs))
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
    sheet.save(OUT / "hmh-aaa-quality-wave-contact-sheet.png")


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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("cmd", choices=["balance", "create", "animate", "collect", "status"])
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--targets", default=None)
    parser.add_argument("--max-inflight", type=int, default=3)
    args = parser.parse_args()
    if args.cmd == "balance":
        asyncio.run(balance())
    elif args.cmd == "create":
        asyncio.run(create(args.limit, args.targets))
    elif args.cmd == "animate":
        asyncio.run(animate(args.limit, args.targets, args.max_inflight))
    elif args.cmd == "collect":
        asyncio.run(collect(args.limit, args.targets))
    else:
        status()


if __name__ == "__main__":
    main()
