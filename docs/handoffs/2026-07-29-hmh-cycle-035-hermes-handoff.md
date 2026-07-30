# Hard Money Heroes — Cycle 035 Hermes handoff

Date: 2026-07-29 PDT
Continuation branch: `reboot/hmh-aaa-continuous`
Cycle 035 source: `0e4a0cc7dbe553196b64b5181ed5cd70d3c70e9f`
Cycle 035 exact commit patch SHA-256: `697b72230da401d5ef686cea3145fb643c9ea274ad7116377b9dbdc166aa698f`
Production source: `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`
Production: <https://lestersarcade.io>
Settlement: `SETTLEMENT_LIVE=false`
Status: certified local-only; not pushed, previewed, promoted, or deployed

## Read this first

Cycle 035 completes the ordinary-enemy role-art wave and repairs the Blender roster reproducibility contract.

The Liquidator Agent now reads as a human tactical ranged survivor with authored rifle equipment, burst anticipation, and recoil. The Validator Cultist now reads as a humanoid zombie cultist with robes, staff/casting equipment, channel anticipation, and pulse release.

The old Cycle 034 check rendered an already-built scene twice. It was not an independent cold-scene contract. Fresh scene builds later exposed `93 / 1,368` source-frame hash mismatches, mostly decoded RGB. Cycle 035 does not hide or tolerate that drift. It replaces the check with independent scene rebuilds, fresh actor processes, and exact decoded/artifact comparisons.

## Source of truth

The complete repository-owned chain remains:

1. `apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json`
2. `scripts/hmh-blender/create-hmh-enemy-roster.py`
3. `scripts/hmh-blender/export-hmh-enemy-roster.py`
4. `apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.blend`
5. `scripts/run-hmh-enemy-roster-pipeline.py`
6. source-frame PNGs in ignored `.tmp/` work directories
7. tracked atlas JSON/PNG/contact-sheet artifacts under `apps/portal/assets/generated/hmh-reboot-enemy-roster/`

Do not manually repaint shipped atlas pixels.

## Final Cycle 035 contracts

### Liquidator Agent

- `identityForm: human-survivor`
- `detailKit: liquidator-tactical-suppressor-v1`
- `animationProfile: suppression-rifle-burst-v1`
- ordinary scale remains `0.75`
- 19 authored role-detail objects
- scene objects `27 → 46`
- atlas `693,363 → 830,360` bytes

### Validator Cultist

- `identityForm: zombie`
- `detailKit: validator-undead-cultist-v1`
- `animationProfile: validator-staff-channel-v1`
- ordinary scale remains `0.75`
- 24 authored role-detail objects
- scene objects `29 → 53`
- atlas `699,997 → 872,976` bytes

### Exact cold-scene policy

- Blender engine: `BLENDER_WORKBENCH`
- Studio light and material colors
- Workbench cavity disabled; it caused residual boss-frame drift
- material specular IOR level `0`
- cast shadows disabled
- render dither `0`
- `2×` render scale with Lanczos downsampling to 160×160 RGBA
- disconnected alpha components below nine pixels removed deterministically
- two independently created `.blend` scenes
- fresh Blender process per actor for both passes
- isolated first/second source and artifact directories
- exact decoded source-frame RGBA hashes
- exact atlas PNG, atlas JSON, contact-sheet, and aggregate metrics hashes

Final verification: 7 actors, 1,368 frames, 0 duplicates, exact reproducibility PASS.

## Projection-only boundary

Cycle 035 does not change:

- fixed 60 Hz simulation or catch-up policy;
- collision, body profiles, navigation, or elevation;
- Cycle 033 ordinary hurtboxes (`0.90`, minimum radius `10`, half-length `8`);
- Cycle 032 scales (`0.75` ordinary, `0.86` boss);
- damage, attack timing, projectiles, support targeting, AI, spawning, or RNG;
- replay, XP, progression, saves, bridge messages, settlement, wallet, or parent authority.

## Certification evidence

- Python compile: PASS
- Cycle 035 source/provenance contracts: 12/12 PASS
- focused enemy/runtime contracts: 59/59 PASS
- roster cold verification: PASS
- HMH asset QA: PASS
- `npm run check`: 657 JavaScript files and 136 inline scripts PASS
- release ledger: 1,794 total, 1,742 passing, 52 accepted legacy asset gaps, 0 unexpected
- production build: PASS
- visual regression: 8/8 unchanged; no baseline acceptance
- enemy-detail browser smoke: desktop/mobile PASS
- browser certification: 5 profiles PASS, 0 errors
- mobile controls: 4/4 PASS
- performance: 7 ms p95 desktop/mobile
- game bundle: 1,021,923 / 1,050,000 bytes
- aggregate enemy atlases: 7,254,726 / 10,485,760 bytes
- repository/CDN, security, third-party, Web3 source, and docs-link gates: PASS
- full-resolution eight-direction/six-state Hermes native-vision reviews: PASS
- final alpha connected-component audits: Liquidator minimum 14 px; Validator minimum 10 px; 0 components below 9 px

`npm test` still reports the pre-existing checkout-isolation asset gaps for omitted portal/game bundles. `npm run test:release` classifies all 52 as accepted and reports zero unexpected failures.

## Exact-index review truth

The approved implementation index was frozen at:

`697b72230da401d5ef686cea3145fb643c9ea274ad7116377b9dbdc166aa698f`

Two independent read-only reviewers recomputed that exact digest and returned explicit no-blocker PASS verdicts for deterministic/gameplay authority and security/performance/accessibility/release scope.

A third delegated visual reviewer returned `BLOCKED` solely because its paid vision model was unavailable; it did not identify a product blocker and did not count as approval. Hermes' active native-vision model independently inspected the final post-cavity-disabled full-resolution Liquidator and Validator sheets and the desktop/mobile browser evidence with no concrete blocker.

The earlier digest `d6a195325730ec4f733226612e9b9dd70258a764ea4edabd04782eed930430e9` is stale. It preceded restoration of incidental Forkrunner/Whale geometry and the final cavity-disabled cold-render correction. Its reviews must not be reused.

## Production and Git safety

- Cycle 035 is committed locally only.
- No push occurred.
- No Vercel preview was created.
- No deployment was promoted.
- Production remains `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`.
- `SETTLEMENT_LIVE=false` remains unchanged.

## Next bounded slice

Cycle 036 should move from the completed ordinary-enemy role-art wave into deterministic combat readability and weapon-role measurement:

1. measure per-weapon same-seed TTK, projectile budget, hit readability, and mobile/controller parity before tuning;
2. add RED contracts for one bounded weakness only;
3. preserve authoritative damage, timing, replay, and collision unless a separately measured gameplay cycle explicitly changes them;
4. exercise the actual desktop/mobile browser path and repeat release certification.

Do not begin by changing balance values from feel alone.
