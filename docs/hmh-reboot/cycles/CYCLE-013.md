# HMH AAA Continuous Improvement Cycle 013

Date: 2026-07-26
Status: `LOCAL CERTIFIED · COMMITTED b50d5aac · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `43f11925` — Cycle 012 mobile composition

## Objective

Replace the blank portal hero cards with a compact, reproducible presentation of all four certified reboot heroes. Preserve gameplay identity, unlock rules, Free/Ranked boundaries, and lazy gameplay-atlas loading.

## Reproduced defects

- With `HMH_REBOOT_ENABLED`, the portal skipped the legacy HMH loader, but `heroRotationSprite()` still read only `HMH_ANIMATED_ROSTER`; every showcase returned `null`.
- Real desktop and 390×844 captures showed empty hero stages.
- Mobile retained deep smooth-scroll position and clipped the first hero at about `top=-92px`.
- Four stacked mobile cards produced a page near 3,930px tall.
- The floating desktop Jukebox covered locked-card content.

The browser RED required four cards, four rotators, eight ready canvases per hero, nonzero alpha pixels, and an unclipped first card. It failed before gameplay.

## Implementation

1. `build-hmh-reboot-hero-selector-atlas.py` composites shadow, lower-body, torso-head, and weapon layers from the four certified production atlases.
2. The deterministic output is one 1280×640, 32-frame PNG plus JSON provenance and a frozen browser manifest.
3. The selector reuses existing atlas-region canvases and marks each rendered frame ready for pixel inspection.
4. The direct mode transition now routes through `setOfficialView()`; character selection disables smooth scroll/anchoring and aligns the actual panel.
5. Mobile uses a horizontal scroll-snap carousel with a visible swipe hint.
6. Selector sprites use a shared 1.28 display scale. The desktop Jukebox is hidden only on this screen while music continues.
7. Active production asset QA now verifies selector SHA, dimensions, transparency, frame count, and a 512KB cap.

## Certification

- Selector atlas: 349,015 bytes; SHA-256 `5da8efbe120484a8f6d30de1e564c11d947266d7a2ae0ea79b428243cf7e1b10`.
- Deterministic builder `--check`: PASS.
- Desktop/mobile selector smoke: PASS; 32/32 canvases nonblank; animation pixels changed; zero errors.
- Portal E2E: all six implemented flows PASS.
- Mobile: horizontal roster `1408 / 362px`, first card `top=302.375px`, document height 1,717px.
- Visual reboot: 8/8 unchanged.
- Performance: bundle 996,963 / 1,050,000 bytes; desktop p95 7ms; mobile p95 7ms.
- Five-profile browser, combat, cockpit, network, asset, security, repository, CDN, and docs gates: PASS.
- Release: `1,704 / 1,652 / 52 accepted / 0 unexpected`.

## Constraints and known debt

- Selector art is projection-only and does not change simulation, saves, replay, bridge messages, unlock authority, wallets, or settlement.
- A pre-existing generic `arcade-core` test still expects two retired legacy HD-atlas files. The authoritative reboot release gate remains green; final cleanup must reconcile that stale legacy assertion separately.
- No push, deployment, production replacement, LitVM action, transaction, signature request, or settlement change occurred.