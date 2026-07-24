# Reboot 18 Release Certification

Date: 2026-07-23
Branch: `reboot/hmh-topdown-2_5d`
Parent: `fa5c0c55b1c41e16d004cd8c14121d278825fe3d`
Verdict: **PASS**

The structured source of truth is `RELEASE-CERTIFICATION-REBOOT-18.json`.

## Aggregate gate

- Release retirement wrapper: **1,592 tests; 1,539 passes; exactly 53 accepted failures; 0 unexpected failures**.
- Syntax: **319 JavaScript modules and 40 Python scripts**.
- HMH security audit: **5/5**, no findings.
- Third-party sandbox security: **3/3**.
- Contract structure: **PASS**.
- Production build: **PASS**.
- Strict repository health: **PASS**.
- CDN/file-budget gate: **PASS**.

The 53 accepted failures are valid only through exact identity matching against `LEGACY-TEST-RETIREMENT.json`. Raw `npm test` remains unchanged; deployment remains fail-closed through `npm run test:release`.

## Deterministic and soak certification

All six reboot soak programs passed.

- Enemy: 128 bodies for 3,600 fixed ticks; 60/30/20 FPS partitions produced the same SHA-256 state; maximum average simulation cost was `0.989003 ms/tick`; heap drift after GC was `555,848` bytes.
- Combat: weapon, melee, grenade, replay, catch-up, and repeat-hash contracts passed.
- Projectile: 3,600 ticks at a fixed 128-projectile capacity; deterministic hash `e57ed205`; heap drift `267,392` bytes.
- Dash: cooldown tiers and 60/30/20 FPS partitions matched through 72,000 ticks per profile.
- Level 1: all six districts and authored surfaces completed across 60/30/20 FPS partitions with the same hash and no timing loss.
- Director/boss: 107 maximum director bodies; 32 boss events; zero dropped boss events; DPS windows and partition hashes passed; heap drift `368,856` bytes.

Simulation authority remains fixed at 60 Hz with at most four catch-up steps. Art, culling, effects, UI, and certification telemetry remain projection-only.

## Browser and responsive certification

The new fail-closed gate `npm run certify:hmh:browser` ran in both installed browser products:

- Google Chrome
- Microsoft Edge

Each browser passed all five profiles:

1. Desktop `1440x900`
2. Ultrawide `1920x800`
3. Tablet landscape `1024x768`
4. Mobile portrait `390x844`
5. Mobile landscape `844x390`

The gate verifies the actual reboot bundle and service worker, rejects Vercel Authentication content, uses a fixed seed, captures two fixed-tick upgrade anchors, requires one canvas and three authored upgrade choices, checks root overflow and viewport geometry, verifies all eight touch targets on mobile/tablet, performs real keyboard movement, proves pause freezes the authoritative tick, proves resume advances it, and rejects page or console errors.

Chrome reproduced all five anchors exactly. Edge reproduced four exactly; ultrawide differed by two pixels with maximum channel delta 1. The fail-closed thresholds are at most 32 pixels and maximum channel delta 2. The earlier progression-pilot screenshot variance was traced to differing terminal simulation ticks, then eliminated with `evidenceSafe=1&releaseAnchor=1`, which enters upgrade mode at deterministic tick 0 and renders once. That path cannot activate without `evidenceSafe=1`.

Existing combat, cockpit, embedded bridge, performance, Blender-pilot, and all four production-hero browser regressions also passed.

## Visual certification

The final contact sheet covers deterministic upgrade and live interaction states for all five profiles:

`.hermes/evidence/hmh-reboot-18-release/responsive-contact-sheet.png`

Strict inspection found:

- no blank or missing layers;
- no HUD, modal, touch-control, or safe-area release blocker;
- no debug-grid contamination;
- no unsafe target text;
- readable player, enemy, world, and choice hierarchy across all profiles.

The apparent mobile-landscape bottom clipping in a reduced contact-sheet cell was checked against the raw `844x390` capture. All joystick rings were complete with bottom clearance. The certification gate now verifies every touch target's actual browser bounding rectangle.

## Performance and payload

- HMH child bundle: `961,218 / 1,050,000` bytes.
- Desktop p95/p99: `7.0 / 7.1 ms`; browser errors: 0.
- Mobile p95/p99: `7.0 / 7.1 ms`; browser errors: 0.
- Desktop/mobile visible hazard particles: `10 / 6`.
- Desktop heap delta: `-850,433` bytes.
- Mobile heap delta: `10,407,037` bytes, within the browser gate.

## Active asset certification

`npm run assets:qa:hmh-reboot` validates the four active production hero atlases:

- exactly four approved identities and variants;
- projection-only runtime authority;
- 168 frames per atlas;
- required layer order;
- valid PNG decoding, transparency, and nonblank pixels;
- unique IDs, in-bounds frame rectangles, anchors, pivots, and source pivots;
- no rotated frames;
- at most 1 MiB per atlas and 4 MiB total.

Result: **4 atlases, 672 authored frame entries, 2,569,321 total bytes, PASS**.

The older `npm run assets:qa` command targets 44 legacy atlas pages intentionally removed by the approved cleanup in `ASSET-ARCHIVE.json`. It therefore fails on the reboot branch by design and is not the active reboot asset gate. It remains unchanged until production cutover so its historical purpose is explicit rather than silently repointed.

## Remaining boundary

`reboot-18` certifies the local content-complete branch. It does not certify a hosted preview and does not promote production. Preview publication, shareable access through Deployment Protection, and actual game-route verification belong to `reboot-19`. An authentication page or redirect returning HTTP 200 is not accepted as game verification.
