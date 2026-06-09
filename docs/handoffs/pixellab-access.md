# PixelLab Access (Lester's Arcade art pipeline)

MCP server registered in `~/.claude.json` under `mcpServers.pixellab`:
- `type: http`, `url: https://api.pixellab.ai/mcp`, `headers.Authorization: Bearer <key>`
- Key is **gitignored / never printed**. (Justin pasted it in chat 2026-06-08 — advise rotating after this batch.)
- Repo scripts read creds via `load_server()` scanning `~/.claude.json` `projects[*].mcpServers.pixellab` AND top-level `mcpServers.pixellab` (both populated).

Account: **Tier 3 "Pixel Architect"**, subscription active, ~8,055 generations remaining (checked 2026-06-08). Generations are the budget unit, not $ credits.

## Tools available (from `list_tools`)
- Characters: `create_character`, `create_character_state`, `animate_character`, `get_character`, `list_characters`, `delete_character`, `delete_animation`
- Tiles: `create_isometric_tile`, `get_isometric_tile`, `list_isometric_tiles`, `create_topdown_tileset`, `create_sidescroller_tileset`, `create_tiles_pro`, `get_tiles_pro`, `list_tiles_pro`
- Objects: `create_map_object`, `create_1_direction_object`, `create_8_direction_object`, `get_object`, `list_objects`, `animate_object`, `create_object_state`, `select_object_frames`, `delete_object`
- Meta: `get_balance`, `list_projects`, `dismiss_review`, `agent_feedback`, `agent_help`

## Ready-to-run pipelines
- `scripts/pixellab-new-heroes-pipeline.py` — already has correct prompts for **lit-commando** (silver/Litecoin-blue armor, glowing cyan visor) + **lit-valkyrie** (teal/cyan plasma, short teal hair) at `n_directions=8, size=96`, with full kit: idle/walk/run/fire-pistol/melee-knife/throw-axe/fire-shotgun/fire-machinegun/hurt/stun/pickup/levelup/death. Run `create` → `poll-create` → `animate [--max-inflight N]` → `status`.
- Other waves: `pixellab-hmh-environment-wave-3-replacement.py`, `pixellab-hmh-fx-powerups-wave.py`, `pixellab-hmh-isometric-production-wave.py`, etc.

## Pitfalls (from skill refs)
- `create_*_object`/`create_character` returns only BASE frame; animation needs a separate `animate_*` pass then poll + package.
- 8-dir harvests fragment into walk/walk-2…walk-8 (one direction each) — consolidate with `scripts/consolidate-hmh-roster-directions.py`.
- Filter real frames with `/frame_\d+/`; `000-unknown.png` is the spritesheet base.
- Never deploy a raw harvest; wire + visually verify first.
