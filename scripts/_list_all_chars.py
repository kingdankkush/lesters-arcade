import asyncio, json, os
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

home = os.path.expanduser("~")
with open(os.path.join(home, ".claude.json"), "r") as f:
    cj = json.load(f)
TOKEN = ""
for proj_path, config in cj.get("projects", {}).items():
    mcp = config.get("mcpServers", {})
    if "pixellab" in mcp:
        auth = mcp["pixellab"].get("headers", {}).get("Authorization", "")
        TOKEN = auth.replace("Bearer ", "")
        break
if not TOKEN:
    TOKEN = cj.get("mcpServers", {}).get("pixellab", {}).get("headers", {}).get("Authorization", "").replace("Bearer ", "")

URL = "https://api.pixellab.ai/mcp"

async def main():
    async with streamablehttp_client(URL, headers={"Authorization": f"Bearer {TOKEN}"}) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            offset = 0
            while True:
                result = await session.call_tool("list_characters", {"offset": offset})
                text = ""
                for c in result.content:
                    text += c.text if hasattr(c, "text") else str(c)
                print(text)
                print("---PAGE_BREAK---")
                if "next: list_characters" not in text:
                    break
                offset += 10
                if offset >= 60:
                    break

asyncio.run(main())
