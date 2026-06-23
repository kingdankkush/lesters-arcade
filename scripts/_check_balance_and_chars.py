import asyncio, json, sys
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

TOKEN = "7f098cf2-1fc2-4f27-8af9-8ce3e0a352af"
URL = "https://api.pixellab.ai/mcp"

async def main():
    async with streamablehttp_client(URL, headers={"Authorization": f"Bearer {TOKEN}"}) as (read, write, _):
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
