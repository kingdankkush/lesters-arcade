# PixelLab Access (Lester's Arcade art pipeline)

MCP server is registered in `~/.claude.json` under `mcpServers.pixellab`.

- Endpoint: `https://api.pixellab.ai/mcp`
- Authorization header: configured locally and redacted from repo docs
- Key handling: gitignored, never printed, and should be rotated if it ever appears in chat or logs
- Repo scripts read credentials via `load_server()` scanning `~/.claude.json` `projects[*].mcpServers.pixellab` and top-level `mcpServers.pixellab`

Account: **Tier 3 "Pixel Architect"**, subscription active, **10,000 generations remaining** during the WO-99 check. Generations are the budget unit, not dollar credits.

Current production rule: PixelLab may be used for high-end enemy/boss completion, but only repo-owned final manifests/contact sheets/tests are committed. Raw prompt logs, raw harvest clutter, and secrets stay out of git.

## Tools available (from `list_tools`)

- Characters: `create_character`, `create_character_state`, `animate_character`, `get_character`, `list_characters`, `delete_character`, `delete_animation`
- Tiles: `create_isometric_tile`, `get_isometric_tile`, `list_isometric_tiles`, `create_topdown_tileset`, `create_sidescroller_tileset`, `create_tiles_pro`, `get_tiles_pro`, `list_tiles_pro`
- Objects: `create_map_object`, `create_1_direction_object`, `create_8_direction_object`, `get_object`, `list_objects`, `animate_object`, `create_object_state`, `select_object_frames`, `delete_object`
- Meta: `get_balance`, `list_projects`, `dismiss_review`, `agent_feedback`, `agent_help`

## Ready-to-run pipelines

- `scripts/pixellab-new-heroes-pipeline.py`: prompts for **lit-commando** and **lit-valkyrie** at `n_directions=8, size=96`, with full kit states: idle, walk, run, fire-pistol, melee-knife, throw-axe, fire-shotgun, fire-machinegun, hurt, stun, pickup, levelup, death. Run `create` to `poll-create` to `animate [--max-inflight N]` to `status`.
- Other waves: `pixellab-hmh-environment-wave-3-replacement.py`, `pixellab-hmh-fx-powerups-wave.py`, `pixellab-hmh-isometric-production-wave.py`, etc.

## Pitfalls

- `create_*_object` and `create_character` return only a base frame. Animation needs a separate `animate_*` pass, then poll and package.
- 8-direction harvests fragment into walk/walk-2...walk-8, one direction each. Consolidate with `scripts/consolidate-hmh-roster-directions.py`.
- Filter real frames with `/frame_\d+/`; `000-unknown.png` is the spritesheet base.
- Never deploy a raw harvest. Wire it, test it, and visually verify it first.
