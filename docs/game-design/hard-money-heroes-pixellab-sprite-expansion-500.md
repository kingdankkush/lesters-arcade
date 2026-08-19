# Hard Money Heroes — PixelLab Sprite Expansion 500

Generated/updated: 2026-08-19T01:08:54+00:00

## Scope

This PixelLab wave is a 500-sprite expansion for animation frames, weapons, bullets/projectiles, level-up/power-up sprites, menu UI, damage models, special effects, death-animation frames, and level-design sprites.

All jobs are intended as one PixelLab `create_map_object` output per sprite asset/frame. Animation and death-animation packs are represented as sequential frame PNGs so they can be assembled into sprite sheets or runtime animation arrays later.

## Current status

- Jobs manifest: `apps/portal/assets/generated/hmh-pixellab-sprite-expansion-500/pixellab-sprite-expansion-500-jobs.json`
- Runtime manifest: `pending until package has local PNGs`
- Contact sheets: `pending until package has local PNGs`
- Desired asset count: `500`
- Ledger jobs: `500`
- Complete jobs with PNGs: `0`
- Local PNG count: `0`
- Job counts by status: `{"not_started": 500}`
- Job counts by category: `{"animations": 72, "bullets": 54, "damage-models": 54, "death-animations": 64, "level-design": 28, "level-up": 48, "menu-ui": 54, "special-effects": 72, "weapons": 54}`

## Blocker

- PixelLab generation unavailable: subscription/remaining-generations check is blocked. Renew PixelLab to unlock MCP generation.

## Commands

```bash
python scripts/pixellab-hmh-sprite-expansion-500.py preflight
python scripts/pixellab-hmh-sprite-expansion-500.py queue --limit 25
python scripts/pixellab-hmh-sprite-expansion-500.py poll --limit 50
python scripts/pixellab-hmh-sprite-expansion-500.py package
python scripts/pixellab-hmh-sprite-expansion-500.py status
```

## QA rules

- Reject assets with pseudo-text, logos, watermarks, official cryptocurrency marks, bad silhouettes, or unusable scale.
- Menu UI assets must stay blank/no-text so real labels can be rendered by the game UI.
- Active actor frames must visibly read as generic human survivors or zombies; do not use animals, vehicles, robots, mechs, or abstract actor proxies.
- Treat this pack as source art until curated, budgeted, and smoke-tested in the runtime.
- No API keys or auth headers are stored in this doc or the manifest.
