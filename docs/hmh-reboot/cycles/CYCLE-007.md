# HMH AAA Continuous Improvement Cycle 007

Date: 2026-07-26
Status: `LOCAL CERTIFIED · COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `807bc9434aefec1ab89623128b12777bfe73ab55`

## Objective

Complete the authored-art transition for the remaining important gameplay presentation debt. Cycle 007 aligns actor projection, expands hero action animation, gives the Liquidator authored phase silhouettes, replaces weapon, pickup, upgrade-icon, and world-prop vector holdouts with repository-owned Blender assets, and certifies every authored family through one fail-closed asset gate.

## Preserved invariants

- Fixed simulation remains 60 Hz with at most four catch-up steps.
- Art is projection-only. Collision, damage, AI, RNG, replay, progression, save schema, Ranked evidence, and results do not derive from atlas metadata.
- Enemy facing history lives in a render-only `Map`; deterministic enemy entities are not mutated.
- Hero, enemy, boss, weapon, pickup, icon, and world-prop failures retain playable vector/graybox fallbacks.
- Atlases remain lazy-loaded and outside the game bundle.
- The parent portal retains wallet, identity, profile, canonical session, leaderboard, analytics, settlement, and completion authority.
- HMH does not request a wallet or transact.
- `SETTLEMENT_LIVE` remains false. Production and LitVM are untouched.

## Authored actors

### Shared projection and materials

Hero and enemy manifests now declare the same 55-degree gameplay camera pitch. Enemy skin and limb materials use a warmer, rougher, low-reflection policy. Generated source scenes remain pinned to Blender 5.1.2.

### Hero animation expansion

All four production heroes now publish 648 frames each, up from 168. The atlas contains authored dash, melee, grenade, and death clips alongside idle, run, aim, pistol-fire, and hurt. Metadata `fps` and `loop` values are authoritative at runtime; non-looping clips clamp instead of wrapping and death holds its final frame.

The four hero atlases contain 2,592 frames total. Each atlas reports 648 unique frame IDs and 640 unique animated frames; only the eight directionally duplicated shadow frames are accepted duplicates. Two-pass bounded premultiplied-RGBA reproducibility passed with zero observed pixel delta.

### Enemy and boss expansion

Six ordinary roster actors remain 152 frames each. The Liquidator now renders 456 frames across three authored phase silhouettes:

- `market-open` — badge/chart identity.
- `margin-call` — spike/pressure identity.
- `total-liquidation` — ray/core identity.

The roster pipeline reports 1,368 total frames, 1,368 unique source frames, zero duplicate frames, and reproducibility PASS. Runtime cadence comes from authored metadata. Stationary enemies retain their last movement direction without adding visual state to deterministic simulation entities.

## Authored props and UI art

A third Blender pipeline now owns 29 assets:

- 4 held weapons.
- 5 pickup/reward icons.
- 8 power-up/upgrade icons.
- 12 district world props.

The manifest, `.blend`, headless exporter, deterministic packer, atlas metadata, direct item PNGs, contact sheet, metrics, and npm regeneration commands are repository-owned. The pipeline rejects missing, empty, corner-clipped, or duplicate frames and supports two-pass reproducibility verification.

World dressing is generated from deterministic world/district seeds and remains presentation-only. Props use authored ground pivots, culling, and the existing world depth pass. Ordinary world accents are non-emissive; energy/interaction shapes retain controlled emission. Upgrade cards use direct authored item PNGs. Held weapons follow the projected aim direction while the embedded hero weapon layer remains fallback and action authority; runtime policy allows only one weapon renderer to be visible at a time.

The nine level-one reward/weapon icons are static point-of-interest markers, not simulation pickups. Their IDs, coordinates, districts, and `weapon`/`reward`/`hazard-reward`/`upgrade`/`objective` hooks derive directly from `LEVEL_ONE_WORLD.pointsOfInterest`. They do not bob or claim collectible authority. The five pickup assets are certified and available for a future collector system without misrepresenting the current simulation.

## Runtime and safety behavior

- Hero action selection is driven by simulation events already present in the fixed-step runtime.
- Boss `phaseId` selects authored Liquidator phase art but does not affect phase authority.
- Art loaders publish ready/error telemetry and stop retrying after terminal failure.
- `enemyVisualFacing` entries are removed for inactive entities and cleared on run reset.
- Missing or corrupt hero, roster, boss, or prop art cannot abort boot or terminate a run.
- Authored POI markers mirror authoritative level hooks but never grant rewards or mutate gameplay.
- Blender runners remove `.blend1` backups after scene generation; raw frames and review montages remain ignored temporary evidence.

## Asset certification

`npm run assets:qa:hmh-reboot` PASS:

| Family | Atlases | Frames/assets | Bytes | Budget |
| --- | ---: | ---: | ---: | ---: |
| Heroes | 4 | 2,592 frames | 10,461,922 | 12,582,912 |
| Enemy/boss roster | 7 | 1,368 frames | 4,671,584 | 10,485,760 |
| Props/icons/pickups | 1 | 29 assets | 57,080 | 524,288 |

The unified gate verifies metadata shape, projection-only authority, source-pixel SHA-256 values, frame uniqueness, phase coverage, generated-file existence, alpha bounds, and reproducibility reports.

## Visual certification

The reboot visual harness now waits for hero, roster, and prop readiness and captures on the authoritative published simulation tick.

1. The pre-accept run reported one intentional changed scene: `hashwood-foliage-desktop`, localized to eight signature cells after deterministic stump/crystal dressing.
2. All eight current screenshots were inspected for grounding, scale, held-weapon alignment, depth order, clipping, blank textures, responsive containment, and UI overlap.
3. Over-emissive stump rings were corrected and the prop atlas was regenerated reproducibly.
4. The intentional baseline was accepted.
5. Two independent final-candidate reruns passed all eight scenes with identical within-tolerance metrics and zero browser errors.

## Release gates

- `npm run test:release` — PASS: 1,690 total, 1,638 passed, exactly 52 accepted legacy failures, 0 unexpected.
- Focused Cycle 007 suite — PASS: 35/35.
- Updated production-art contract suite — PASS: 10/10.
- `npm run check` — PASS: 332 JavaScript modules and 49 Python scripts.
- Python compile for modified Blender runners — PASS.
- `npm run build` — PASS: HMH bundle 992,376 bytes / 1,050,000 maximum; SHA-256 `9f98baf9a5ffad3dbb393a064421a641d9631ccc7a5c424947cab7dac8ea1379`.
- Chrome release browser certification — PASS on desktop, ultrawide, tablet landscape, mobile portrait, and mobile landscape.
- Portal E2E — PASS all six implemented flows; zero console errors.
- Network/console — PASS four clean/warm scenarios; zero HTTP, request, console, or page failures.
- Performance — PASS; desktop/mobile p95 7 ms / 7 ms; no browser errors.
- Security — PASS 5/5 with zero findings; third-party sandbox 3/3.
- Web3 settlement boundary — PASS 9/9.
- Web3 live readiness — correctly PARTIAL 3/4; on-chain registry/economy approval remains blocked.
- `repo:health:strict`, `repo:cdn-gate`, and `docs:links` — PASS.
- Reboot-native browser soak harness — replaces the stale legacy-cabinet selector path; uses an exclusive PID lock, accumulates active ticks across run restarts, and separates raw V8 allocation from GC-stabilized retained memory.
- Thirty-minute reboot browser soak — PASS: 30.011 minutes, 60 samples, 143.92 median FPS, 7 ms p95, 95,570 active ticks across one natural restart, 120 maximum enemies, 96 maximum animated enemies, live boss combat, and zero console/network issues.
- GC-stabilized third-to-fourth-quartile retained heap growth — PASS: 27,422,415 bytes (26.72%); DOM remained 78 → 78 nodes and maximum forced-GC pause was 100.5 ms.

## Source artifacts

| Artifact | SHA-256 |
| --- | --- |
| HMH reboot bundle | `9f98baf9a5ffad3dbb393a064421a641d9631ccc7a5c424947cab7dac8ea1379` |
| Production hero `.blend` | `426e0fcfb391545d39ea38776dc5c77ee3b5d7696119ca6157fb709f6762ddf8` |
| Enemy roster `.blend` | `3671386b642e4f389c4b3dc2250237fd0bf5de6c5fb865d58ea2ee29cb2aafd5` |
| Authored props `.blend` | `0fb6499ffe0b154a2db4ae2f2a18a86e6b33e3fd8a96a586f40f642964767ec4` |
| Authored prop atlas | `91350b6ce292f42bf36d100eac68bb66b309996f2468dc788cc362862f129d96` |

## Known debt

- Browser retained memory is now measured directly by the reboot soak with warmed, GC-stabilized steady-state windows; the final candidate remains within the bounded 64 MiB/150% gate and introduces no unbounded visual-facing cache.
- Firefox and WebKit are not locally available; Chrome is the certified browser for this candidate.
- Web3 live readiness remains blocked at on-chain registry/economy approval and does not represent real-wallet hardened E2E readiness.
- Carried gameplay/world debt not in this art slice remains tracked separately: melee height-lock, ledge-base projectile dead zone, route clipping, and ground-detail-over-road cleanup.

## Deployment state

No deployment or promotion occurred. Production remains unchanged from the Cycle 006 handoff. No production alias changed, no LitVM deployment or transaction occurred, and no settlement flag changed. The requested endpoint for Cycle 007 is a reviewed local commit only.

## Exact-index policy

The entire intended candidate will be staged after temporary artifacts are removed. `git diff --cached --binary | sha256sum` will then freeze the exact index. Independent reviewers must review that frozen hash; any subsequent edit invalidates those verdicts. The frozen hash is recorded in the local commit message and final handoff rather than embedded into this staged file, avoiding a self-referential candidate hash.
