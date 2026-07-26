# HMH AAA Continuous Improvement Cycle 014

Date: 2026-07-26
Status: `LOCAL CERTIFIED · COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `b50d5aac` — Cycle 013 rotating production hero selector

## Defect

The prop atlas and 57 placements were loaded, but world dressing was restricted to far north/south shoulders. Certified district cameras usually showed zero or one authored prop, leaving otherwise strong routes, elevations, and arenas visually sparse.

## Correction

- Added six deterministic outer landmark placements per district around canonical visual anchors.
- Added two smaller mobile-only near-field markers per district for portrait framing.
- Kept every new placement `projection-only`; collision and route authority are unchanged.
- Added bounded placement scale and responsive mobile-only culling.
- Added total/category onscreen reporting distinct from the wider render cull margin.
- Published `authoredLandmarkVisible` only through approved debug/release telemetry.
- Required at least three onscreen landmarks in every desktop scene and two on mobile.
- Accepted eight reviewed visual signature changes; raw screenshots remain untracked.

## RED / GREEN

RED:

- no district landmark builder export;
- Frontier desktop initially reported zero true onscreen landmarks;
- portrait mobile initially reported zero after desktop alignment;
- first dense pass was rejected visually as repetitive clutter.

GREEN:

- 48 frozen landmark placements: six outer + two mobile-only per district;
- six districts, unique IDs, 140–530 unit anchor distance, 1.3–1.9 scale;
- balanced desktop/mobile screenshots passed visual review;
- accepted signatures immediately re-passed at zero delta.

## Certification

- focused world/art/hero/enemy/animation/visual tests: `54/54`
- release: `1,705 / 1,653 / 52 accepted / 0 unexpected`
- visual: `8/8`, zero delta after acceptance
- five-profile browser certification: PASS
- combat, portal E2E, cockpit, network-console: PASS
- performance: desktop p95 `7 ms`; mobile p95 `7 ms`
- reboot bundle: `999,045 / 1,050,000` bytes
- security: `5/5`, zero findings
- asset QA, strict repository health, CDN gate, docs links: PASS

## Boundaries

No collision, movement, combat, replay, save, bridge, portal, Free/Ranked, Web3, settlement, deployment, or production behavior changed. `SETTLEMENT_LIVE=false` remains unchanged.
