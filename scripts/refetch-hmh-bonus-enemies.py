#!/usr/bin/env python
"""Re-fetch the 3 generated 'additional enemy' actors from PixelLab.

These are bonus enemies (NOT canonical hand-made characters): FUD Goblin,
Gas Fee Wisp, Whale Dumper boss. Their PixelLab characters already exist; this
downloads their animation frames into the repo + emits sprite-pipeline manifests.
Auth from local Claude PixelLab MCP config. Browser UA required for B2 downloads.
"""
from __future__ import annotations
import asyncio, json, re, urllib.request
from pathlib import Path
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/portal/assets/generated/hmh-bonus-enemies"
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")

ACTORS = {
    "fud-goblin": {"cid": "d0470066-7d2b-4195-bcb6-9e7c6f4638d8", "size": 92, "role": "enemy"},
    "gas-fee-wisp": {"cid": "afb5c6c3-9d0a-48a0-a059-edc00b97aa50", "size": 92, "role": "enemy"},
    "whale-dumper": {"cid": "6b17f44f-4c87-48a4-8df3-d8f15a40d2c0", "size": 160, "role": "boss"},
}
STATE_FPS = {"idle": 8, "walk": 12, "attack-tell": 10, "attack": 14, "hit": 14, "death": 12, "special": 10}
STATE_LOOP = {"idle": True, "walk": True}


def server_cfg():
    data = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for proj in data.get("projects", {}).values():
        s = (proj.get("mcpServers") or {}).get("pixellab")
        if s:
            return s
    raise SystemExit("no pixellab MCP config")


def dl(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (HMH)"})
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
        if data[:8] == b"\x89PNG\r\n\x1a\n":
            dest.write_bytes(data)
            return True
    except Exception:
        pass
    return False


def parse_anims(text: str) -> dict[str, list[str]]:
    out, cur, inseg = {}, None, False
    for ln in text.splitlines():
        s = ln.strip()
        if s.startswith("animations ("):
            inseg = True; continue
        if inseg and (s.startswith("pending jobs") or s.startswith("download:")):
            inseg = False; continue
        if not inseg or not s:
            continue
        if s.startswith("frames:") and cur:
            out[cur] = [u for u in URL_RE.findall(s) if ".png" in u.lower()]
        elif "(" in s and not s.startswith("http"):
            cur = s.split(" (")[0].strip()
    return out


async def main():
    cfg = server_cfg()
    DIRECTIONS = ["east","south-east","south","south-west","west","north-west","north","north-east"]
    emitted = []
    async with streamablehttp_client(cfg["url"], headers=cfg.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            for aid, meta in ACTORS.items():
                res = await s.call_tool("get_character", {"character_id": meta["cid"]})
                txt = "\n".join(getattr(c, "text", "") for c in res.content)
                anims = parse_anims(txt)
                states = {}
                for name, urls in anims.items():
                    if not urls:
                        continue
                    adir = OUT / aid / name
                    adir.mkdir(parents=True, exist_ok=True)
                    rels = []
                    for i, u in enumerate(urls):
                        dest = adir / f"south-{i:02d}.png"
                        if dest.exists() or dl(u, dest):
                            rels.append("./" + str(dest.relative_to(ROOT / "apps/portal")).replace("\\", "/"))
                    if rels:
                        states[name] = {"fps": STATE_FPS.get(name, 10), "loop": STATE_LOOP.get(name, False), "frames": {"south": rels}}
                if not states:
                    continue
                export = "HMH_BONUS_" + aid.upper().replace("-", "_")
                manifest = {
                    "id": aid, "role": meta["role"], "frameSize": [meta["size"], meta["size"]],
                    "anchor": "bottom-center", "directions": DIRECTIONS, "defaultDirection": "south",
                    "targetFps": 60, "source": "PixelLab generated bonus enemy (not a canonical character)",
                    "stateAliases": {"run": "walk", "melee-counter": "hit"}, "states": states,
                }
                p = OUT / aid / f"{aid}.mjs"
                p.write_text(f"export const {export} = Object.freeze(" + json.dumps(manifest, indent=2) + ");\n", encoding="utf-8")
                emitted.append({"actor": aid, "states": list(states), "frames": sum(len(v["frames"]["south"]) for v in states.values())})
    print(json.dumps({"emitted": emitted}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
