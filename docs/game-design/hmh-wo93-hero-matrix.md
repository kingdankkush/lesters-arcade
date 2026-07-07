# HMH WO-93 — Hero 8-Direction Matrix

Status: reference-first pilot matrix generated from Justin-approved HERO_CANON refs.

This pass creates transparent fixed-canvas frames for every required state/direction so WO-94 runtime wiring can proceed against a complete manifest. It is deterministic and can be regenerated with `scripts/build-hmh-wo93-hero-matrix.py`.

## Scope

- Directions: south, south-east, east, north-east, north, north-west, west, south-west
- States: idle, walk, run, shoot-pistol, shoot-shotgun, shoot-mg, melee, throw-grenade, hurt, death, dash, victory
- Frame size: 128×128 PNG, bottom-center anchor
- Source of truth: `docs/art/HERO_CANON.md` and `docs/art/canon/hero-canon-manifest.json`

## Generated outputs

| hero | frames | manifest | contact sheet |
|---|---:|---|---|
| lester | 392 | `apps/portal/assets/generated/hmh-hero-matrix/wo93-v1/lester/lester.mjs` | `apps/portal/assets/generated/hmh-hero-matrix/wo93-v1/lester/lester-wo93-matrix-contact-sheet.jpg` |
| lilly | 392 | `apps/portal/assets/generated/hmh-hero-matrix/wo93-v1/lilly/lilly.mjs` | `apps/portal/assets/generated/hmh-hero-matrix/wo93-v1/lilly/lilly-wo93-matrix-contact-sheet.jpg` |

## QA notes

- These are production-pipeline frames derived from approved refs, not generic lookalikes.
- South/east/west weapon poses use direct source refs where available; diagonals/north directions use deterministic source selection/mirroring when no direct canon drawing exists.
- WO-94 should wire these manifests behind the canonical actor import and run visual regression before replacing the current runtime hero actors.
