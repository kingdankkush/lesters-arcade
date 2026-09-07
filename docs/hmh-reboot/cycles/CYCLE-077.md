# Cycle 077: textured hero selection turntables

## Candidate scope

Replace pre-game turntable art for Lit Commando, Lit Valkyrie, Lester and Lilly with the owner's latest textured Tripo models. Keep a separate packed static Blender scene and byte-preserving, source-only Git LFS GLBs. Gameplay production rigs and animation atlases are unchanged.

- Source scene: `apps/hmh-reboot/assets/source/blender/hmh-tripo-selector.blend`.
- Source ledger: `apps/hmh-reboot/assets/source/blender/hmh-tripo-selector-sources.json`.
- Producer: `scripts/run-hmh-hero-selector-render.py`.
- Runtime owner: `apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs`.
- Eight 384 px PNG frames per hero; 512 KiB per hero and 2 MiB total caps retained.
- All four delivered PNG atlases total 1,638,626 bytes.
- Existing direction map, ground contact, layout, lazy loading, reduced-motion rest frame and hero IDs/stats remain intact.
- Hero descriptions now match the accepted textured sources.
- Portal token: `hmh-aaa-cycle-077-textured-heroes`.
- Service worker: `lesters-arcade-v29-hmh-textured-heroes`.

## Verification boundary

New source/copy contracts and initial static-scene tests were observed RED before implementation. Source hashes and sizes are validated from actual bytes or canonical manifest-bound LFS pointers, including forged-pointer rejection. Local two-pass rendering is pixel-reproducible; focused selector contracts and desktop/mobile/reduced-motion browser checks passed. Cache-token regression was observed RED, then GREEN after updating preload, script and service-worker markers together.

The earlier focused code review `deleg_22465d32` passed without security or logic findings. Its angle-map suggestion was resolved against the unchanged production source convention and actual atlas ordering. That review predates the release cache update and is not the final exact-index release verdict. Local evidence is retained under `.tmp/cycle077-*` and `.hermes/evidence/hmh-hero-selector-cycle-013/` (the browser harness directory name is historical).

This document describes the candidate, not a claim of deployment. Exact release gates, host/no-smudge proof, independent frozen-index reviews and hosted/public verification are recorded in the release handoff after they complete. Cycle075 production is the rollback baseline until then.

## Explicitly unfinished and isolated

The new Tripo source GLBs have no gameplay skinning or animation. Fourteen runtime-pinned bones, nine required clips, waist-layer split, 256 px gameplay atlases, grip/release behavior, visual likeness and mobile runtime gates remain open. Source intake or a static turntable is not gameplay-animation acceptance.

Cycle076 movement/AI, crossing/boss markers, enemy cleanup, weapon and grenade pilots remain separate in their existing worktree. No unfinished sources are published as runtime art. Continue characters, enemies, weapons, VFX/particles, levels/world and audio through independent verified batches, as the owner requested. Existing fixed-tick gameplay, saves, bridge and wallet/settlement authority are unchanged.
