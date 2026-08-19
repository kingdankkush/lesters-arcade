import asyncio
import os
import sys

from mcp.client.streamable_http import streamable_http_client
from mcp import ClientSession

TOKEN = os.environ.get("PIXELLAB_API_TOKEN")
URL = os.environ.get("PIXELLAB_MCP_URL", "https://api.pixellab.ai/mcp")

async def main():
    if not TOKEN:
        print("Set PIXELLAB_API_TOKEN before checking PixelLab balance/characters.", file=sys.stderr)
        raise SystemExit(2)
    async with streamable_http_client(URL, headers={"Authorization": f"Bearer {TOKEN}"}) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            result = await session.call_tool("get_balance", {})
            print("=== BALANCE ===")
            for c in result.content:
                print(c.text if hasattr(c, 'text') else str(c))
            
            result = await session.call_tool("list_characters", {})
            print("\n=== EXISTING CHARACTERS ===")
            for c in result.content:
                print(c.text if hasattr(c, 'text') else str(c))

asyncio.run(main())
