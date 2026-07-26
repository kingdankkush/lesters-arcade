# HMH AAA Continuous Improvement Cycle 012

Date: 2026-07-26
Status: `LOCAL CERTIFIED · COMMITTED 43f11925 · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `c66e2b74` — Cycle 011 Liquidator telegraph projection

## Objective

Remove mobile/tablet gameplay occlusion before the wider pre-deployment polish pass:

- stop the status card and run rail from overlapping;
- keep all touch controls clear of the run rail;
- keep Pause and Weapon clear of the minimap;
- preserve portrait layout, safe insets, and all eight touch actions;
- compact the in-canvas combat readout without hiding health, ammo, grenades, enemy count, or kills;
- preserve simulation, replay, save, portal, Free/Ranked, and Web3 authority.

## Player-facing defect

The prior release browser gate checked only viewport clipping. It did not check one UI surface against another.

At `1024×768`, the status card and run rail overlapped by `2,030 px²`. At `844×390`, the run rail painted above Dash and Grenade, Pause and Weapon sat inside the minimap, and the long in-canvas combat readout crossed the Weapon control.

All controls were technically inside the viewport, so certification passed despite a materially obstructed mobile playfield.

## RED evidence

The real five-profile browser certification was strengthened to measure rectangle intersections for:

- status card vs run rail;
- each touch control vs run rail;
- Pause/Weapon vs minimap.

The unchanged baseline failed:

```text
AssertionError: tablet-landscape status/run rail overlap area 2030.00px²
```

## Implementation

### Shared responsive layout authority

`apps/hmh-reboot/src/hud-layout.mjs` now owns:

- compact-landscape detection;
- deterministic minimap size and placement;
- minimap outer exclusion bounds;
- combat-status position, font size, compactness, and multiline behavior.

The helper is frozen, validates all finite/positive inputs, and is projection-only.

### Touch controls

`computeTouchControlLayout()` now moves Pause and Weapon left of the authored minimap exclusion zone on every landscape touch viewport. Short landscape uses a bounded `140 px` minimap.

Movement, aim, Fire, Melee, Grenade, Dash, Pause, and Weapon all remain present and inside safe bounds.

### Responsive cockpit CSS

- tablet/coarse-pointer run rail begins below the full status card;
- short landscape collapses the status card to its three runtime actions;
- the run rail becomes a compact top strip with no status/control overlap;
- narrow short-landscape fallbacks preserve usable HUD width.

### Combat vital line

Touch landscape now renders a compact projection-only line:

```text
HP 100 // AMMO 3 // FRAG 3 // E 2 // K 0
```

Phone landscape places it below the compact top strip; tablet places it below the full run rail. Portrait and desktop behavior remain unchanged.

### Browser contract

Release certification now records `touchComposition` and fails on visible overlap, not merely clipping. Minimap telemetry is available only through the existing debug/release-telemetry boundary.

## GREEN evidence

### Focused and adjacent

- device/input/shell matrix: `62 / 62`
- pure landscape utility/minimap exclusion tests: PASS
- desktop/portrait/phone-landscape/tablet status layout tests: PASS
- syntax and whitespace: PASS

### Browser and visual

- five-profile release browser certification: PASS
- all touch controls in bounds: PASS
- status/run rail intersections: `0`
- touch/run rail intersections: `0`
- Pause/Weapon/minimap intersections: `0`
- visual regression: `8 / 8`
- desktop/mobile combat smoke: PASS
- portal E2E: PASS
- cockpit desktop/mobile: PASS
- performance smoke: PASS
- network/console audit: zero HTTP, request, console, or page errors

Manual review of regenerated `844×390`, `1024×768`, and `390×844` evidence confirmed the compact vital line, minimap, HUD, and controls remain readable without overlap.

### Performance

- reboot bundle: `996,963 / 1,050,000` bytes
- desktop average / p95 / p99: `6.966 / 7.0 / 7.1 ms`
- mobile average / p95 / p99: `6.966 / 7.0 / 7.1 ms`
- desktop heap delta: `+13,574,567` bytes, within retained gate
- mobile heap delta: `-3,022,084` bytes

### Full release and repository gates

- release: `1,702 / 1,650 / 52 accepted / 0 unexpected`
- security: `5 / 5`, zero findings
- third-party sandbox security: `3 / 3`
- production asset QA: four heroes, seven enemies, 29 props PASS
- strict repository health: PASS
- CDN gate: PASS, no destructive action
- docs links: `8` current/public documents

## Compatibility and authority

Unchanged:

- PixiJS `8.19.0`;
- deterministic 60 Hz fixed-step simulation and catch-up policy;
- input action semantics and eight-control inventory;
- collision, projectile, melee, grenade, boss, and progression authority;
- replay/save/bridge schemas;
- Free/Ranked boundaries;
- `SETTLEMENT_LIVE=false`;
- production deployment and Web3 state.

## Remaining pre-deployment program

Cycle 012 clears the highest-severity mobile blocker. The larger requested pass continues with:

1. four-hero rotating selection visual certification and polish;
2. opening-world/authored-district composition and art density;
3. deterministic collectible power-ups and effects;
4. combat/movement/SFX/VFX readability;
5. menu, pause/settings, level-up/skill-tree, and tooltip polish;
6. long desktop/mobile playtests and release-candidate review.

No push, deployment, promotion, wallet request, signature, transaction, LitVM action, or settlement change occurred.
