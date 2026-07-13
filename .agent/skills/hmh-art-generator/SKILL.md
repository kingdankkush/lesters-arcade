---
name: hmh-art-generator
description: Use when generating or replacing Hard Money Heroes isometric actors, terrain, props, UI art, or VFX from approved design canon.
version: 1.0.0
license: MIT
---

# HMH Art Generator

## Trigger
Use for new or replacement HMH visual assets. Read `AGENTS.md`, `docs/game-design/hard-money-heroes-design-bible-v2.md`, and the active build-risk addendum first.

## Workflow
1. Identify the exact runtime role, camera angle, dimensions, animation states, directions, palette, and collision footprint.
2. Treat reference games as composition/readability inspiration only. Never copy their pixels, logos, characters, or protected silhouettes.
3. Generate with PixelLab or an approved tool. Keep prompts and raw outputs in `~/lesters-arcade-vault/`, not the repo.
4. Normalize alpha, top-left lighting, scale, ground contact, palette, and selective outlines.
5. For actors, require the needed state × direction matrix. Do not fill missing directions with unrelated character art.
6. Promote only accepted frames into a runtime manifest or atlas. Record provenance and source policy.

## Safety
- Never upload secrets, wallet material, private user art, or unapproved third-party assets.
- No contract, account, payment, or production deployment actions.
- Preserve Justin’s Lester/Lilly canon and the original Crypto Wasteland identity.

## Verification
- Run the pack-specific tests and `npm run design:art-census`.
- Run `npm run check` and `npm run build`.
- If rendering changes, run `npm run visual:regression` and inspect captures.
- Confirm raw generations remain outside tracked runtime folders.
