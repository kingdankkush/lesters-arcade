---
name: hmh-level-integrator
description: Use when integrating authored Hard Money Heroes terrain, props, enemies, encounters, hazards, pickups, or progression into a campaign level.
version: 1.0.0
license: MIT
---

# HMH Level Integrator

## Trigger
Use for runtime level/world changes after assets and design intent are approved.

## Workflow
1. Read the v2 design bible, active build-risk addendum, campaign-level metadata, and existing authored world contracts.
2. Define semantic route beats, POIs, combat arenas, safe lanes, gates, extraction, and pacing before placing art.
3. Keep collision, LOS, projectiles, cover, doors, hazards, pickups, and interaction-critical objects as explicit metadata/entities.
4. Route visuals through existing manifests and render layers. Do not hardcode one-off loose paths in gameplay code.
5. Preserve deterministic seed behavior and authored semantic maps. Avoid random prop scatter.
6. Check projection, ground contact, depth sorting, obstacle placement, spawn distances, and camera fit.
7. Add source-level tests for math/policy and update docs when the canon or route contract changes.

## Safety
No contract deployment, wallet transaction, external post, or production account change.

## Verification
- Run focused level/collision/AI tests.
- Run `npm run test`, `npm run check`, and `npm run contracts:check`.
- On Windows/MSYS, verify Foundry before the full gate: `command -v forge || export PATH="$HOME/.foundry/bin:$PATH"`.
- Run `npm run visual:responsive` after menu, HUD, or level-up changes and require all 30 captures to pass.
- Always run `npm run visual:regression` for render/world changes and inspect seed 1337 captures before `npm run visual:accept`.
- Run `npm run ship:gate` on the final stable tree; do not change tracked files while it is running.
- Serve `apps/portal` as the web root and inspect the browser console.
