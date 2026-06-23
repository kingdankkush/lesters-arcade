
import asyncio, json, re, sys

async def main():
    from mcp.client.streamable_http import streamablehttp_client
    from mcp import ClientSession

    # Read auth from ~/.claude.json
    with open(sys.argv[1] if len(sys.argv) > 1 else "C:/Users/just_/.claude.json", "r") as f:
        claude_config = json.load(f)

    # Find pixellab config for the lesters-arcade project
    projects = claude_config.get("projects", {})
    pixellab_cfg = None
    for proj, cfg in projects.items():
        mcp = cfg.get("mcpServers", {})
        if "pixellab" in mcp:
            pixellab_cfg = mcp["pixellab"]
            break

    if not pixellab_cfg:
        print("ERROR: No pixellab MCP config found")
        return

    url = pixellab_cfg["url"]
    headers = pixellab_cfg.get("headers", {})

    async with streamablehttp_client(url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # Check balance
            try:
                result = await session.call_tool("get_balance", {})
                print("=== BALANCE ===")
                for c in result.content:
                    if hasattr(c, 'text'):
                        print(c.text)
            except Exception as e:
                print(f"Balance error: {e}")

            # List characters
            try:
                result = await session.call_tool("list_characters", {})
                print("\n=== CHARACTERS ===")
                for c in result.content:
                    if hasattr(c, 'text'):
                        text = c.text
                        # Try to parse as JSON
                        try:
                            chars = json.loads(text)
                            if isinstance(chars, list):
                                print(f"Total characters: {len(chars)}")
                                for ch in chars:
                                    if isinstance(ch, dict):
                                        cid = ch.get('id', 'N/A')
                                        name = ch.get('name', ch.get('description', 'N/A'))[:80]
                                        dirs = ch.get('n_directions', ch.get('directions', '?'))
                                        anims = ch.get('animations', [])
                                        anim_count = len(anims) if isinstance(anims, list) else anims
                                        print(f"  {name[:50]:50s} id={cid[:12]}... dirs={dirs} anims={anim_count}")
                                    else:
                                        print(f"  {str(ch)[:120]}")
                            else:
                                print(text[:3000])
                        except json.JSONDecodeError:
                            print(text[:3000])
            except Exception as e:
                print(f"List characters error: {e}")

asyncio.run(main())
