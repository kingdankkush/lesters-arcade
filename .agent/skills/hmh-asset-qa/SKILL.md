---
name: hmh-asset-qa
description: Use when accepting, rejecting, or certifying Hard Money Heroes art, animation, atlas, audio, UI, VFX, or world assets.
version: 1.0.0
license: MIT
---

# HMH Asset QA

## Trigger
Use before promoting generated or imported assets into runtime manifests.

## Workflow
1. Read the asset manifest and provenance fields. Reject unknown licensing or copied reference pixels.
2. Validate file existence, decode success, dimensions, alpha bounds, duplicate hashes, naming, and manifest reachability.
3. Inspect contact sheets at gameplay zoom, not only full resolution.
4. For actors, audit state × direction × frame coverage, silhouette consistency, footing, attack tells, hit/death readability, and identity drift.
5. For terrain/props, audit seams, 2:1 projection, grounding, collision cues, shadow direction, route readability, and visual noise.
6. For audio, audit cue uniqueness, silence, clipping, peak/RMS headroom, cooldowns, priority, and event mapping.
7. Record automated proof separately from subjective human approval.

## Rejection Rules
Reject placeholders, broken alpha, baked text/logos, random scatter, mismatched camera angle, mixed character identity, duplicate filler frames, or assets not referenced by a runtime manifest.

## Verification
- Run relevant focused tests.
- Run `npm run test`, `npm run check`, and `npm run build`.
- Rendering changes also require `npm run visual:regression`.
- Confirm accepted assets are repo-local/atlas-backed and raw sources are in the vault.
