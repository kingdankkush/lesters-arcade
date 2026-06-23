
import asyncio, json, sys

async def main():
    from mcp.client.streamable_http import streamablehttp_client
    from mcp import ClientSession

    with open("C:/Users/just_/.claude.json", "r") as f:
        claude_config = json.load(f)

    pixellab_cfg = None
    for proj, cfg in claude_config.get("projects", {}).items():
        mcp = cfg.get("mcpServers", {})
        if "pixellab" in mcp:
            pixellab_cfg = mcp["pixellab"]
            break

    url = pixellab_cfg["url"]
    headers = pixellab_cfg.get("headers", {})

    async with streamablehttp_client(url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            all_chars = []
            offset = 0
            while True:
                result = await session.call_tool("list_characters", {"offset": offset})
                for c in result.content:
                    if hasattr(c, 'text'):
                        text = c.text
                        try:
                            data = json.loads(text)
                            if isinstance(data, dict) and "characters" in data:
                                chars = data["characters"]
                            elif isinstance(data, list):
                                chars = data
                            else:
                                # Try to parse the text format
                                lines = text.strip().split("\n")
                                for line in lines:
                                    if "|" in line and len(line) > 30:
                                        all_chars.append({"raw": line.strip()})
                                break
                        except:
                            lines = text.strip().split("\n")
                            for line in lines:
                                if "|" in line and len(line) > 30:
                                    all_chars.append({"raw": line.strip()})
                            break

                        if isinstance(chars, list):
                            all_chars.extend(chars)
                        if len(chars) < 10:
                            break
                        offset += 10
                    else:
                        break

            print(f"=== ALL CHARACTERS ({len(all_chars)}) ===")
            for ch in all_chars:
                if isinstance(ch, dict):
                    if "raw" in ch:
                        print(ch["raw"])
                    else:
                        cid = ch.get('id', 'N/A')
                        desc = ch.get('name', ch.get('description', ''))[:70]
                        dirs = ch.get('n_directions', ch.get('directions', '?'))
                        anims = ch.get('animations', [])
                        anim_count = len(anims) if isinstance(anims, list) else (anims if isinstance(anims, int) else '?')
                        size = ch.get('size', ch.get('width', '?'))
                        print(f"  {desc:70s} | id={cid[:8]}... | {dirs}dir | {anim_count}anim | {size}px")

asyncio.run(main())
