#!/usr/bin/env python3
"""List all PixelLab characters with their animation counts."""
import json, sys, os, re

# Read the MCP config
claude_json = os.path.expanduser("~/.claude.json")
with open(claude_json, "r") as f:
    config = json.load(f)

# Find pixellab server config
pixellab_url = None
pixellab_auth = None
for proj_path, proj_config in config.get("projects", {}).items():
    mcp = proj_config.get("mcpServers", {})
    if "pixellab" in mcp:
        pixellab_url = mcp["pixellab"].get("url", "https://api.pixellab.ai/mcp")
        pixellab_auth = mcp["pixellab"].get("headers", {}).get("Authorization", "")
        break

if not pixellab_auth:
    print("ERROR: No pixellab auth found in ~/.claude.json")
    sys.exit(1)

from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

async def main():
    headers = {"Authorization": pixellab_auth}
    async with streamablehttp_client(pixellab_url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            all_chars = []
            offset = 0
            while True:
                result = await session.call_tool("list_characters", {"offset": offset, "limit": 50})
                text = result.content[0].text if result.content else ""
                
                # Parse character lines
                lines = text.strip().split("\n")
                found_any = False
                for line in lines:
                    # Match: UUID | description | dims | anims
                    m = re.match(r"\s*([0-9a-fA-F-]{36})\s*\|\s*(.+?)(?:\s*\|\s*(\d+dir\s+\d+x\d+))?(?:\s*\|\s*(\d+)anim)?", line)
                    if m:
                        cid = m.group(1)
                        desc = m.group(2).strip()[:80]
                        dims = m.group(3) or ""
                        anims = m.group(4) or "0"
                        all_chars.append({"id": cid, "desc": desc, "dims": dims, "anims": anims})
                        found_any = True
                
                if not found_any:
                    break
                offset += 50
                if offset > 200:
                    break
            
            for c in all_chars:
                anim_str = f"{c['anims']:>3s} anim" if c['anims'] != '0' else "       "
                print(f"{c['id'][:12]}... | {anim_str} | {c['dims']:<16s} | {c['desc']}")
            print(f"\nTotal: {len(all_chars)} characters")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
