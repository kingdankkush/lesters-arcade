# HMH AAA Continuous Improvement Cycle 027

Date: 2026-07-28
Status: `LOCAL CERTIFIED · COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `a844942ca02d` - Cycle 026 Claude handoff

## Bounded slice

Improve the two weakest rank-and-file role silhouettes at gameplay scale and add a durable, non-vacuous enemy-art browser gate.

- Forkrunner: front/side-readable forearm guards, crossbars, and twin three-tine fork weapons.
- Gas Bomber: accent respirator, enlarged filters, hoses, separated belt bombs, caps, and hazard badge.
- Rank-and-file projection scale: `0.42` to `0.50` so production art better matches health bars and attack footprints.
- Evidence-safe roster preview: compact, static six-family formation for desktop/mobile visual review.
- Release rail repair: browser certification now executes the freshly built child candidate instead of a stale service-worker or HTTP-cached bundle.

## RED evidence

1. `tests/hmh-reboot-enemy-role-detail.test.mjs` failed because neither actor declared a role detail kit and the Blender builder had no fail-closed role-kit consumer.
2. The same test failed because no evidence-safe all-roster preview route existed.
3. The first live preview was telemetry-complete but visually vacuous on mobile because the fixed world positions were outside the camera.
4. `tests/hmh-reboot-release-browser-candidate.test.mjs` failed because the five-profile certifier did not pin the current bundle or tracked local assets.
5. The full battery exposed two stale/flaky rails:
   - opening-balance source assertions did not understand the debug-only initial roster branch;
   - mobile combat used instantaneous synthetic key presses that could complete between 60 Hz simulation samples.

## Implementation

### Authored enemy geometry

- Added manifest `detailKit` contracts to `hmh-enemy-roster.json`.
- Added fail-closed `build_role_detail_kit(...)` handling in `create-hmh-enemy-roster.py`.
- Forkrunner kit authors 10 bound parts.
- Gas Bomber kit authors 11 bound parts.
- Scene inspection reports detail-kit kind and authored part count.
- Rebuilt the shared Blender scene and all seven deterministic production roster outputs.

### Runtime projection

- Increased `ENEMY_ROSTER_RUNTIME_SCALE` to `0.50`.
- Added `evidenceSafe=1&rosterPreview=1` only for visual certification.
- The preview:
  - derives a compact two-row formation from `runtimePlayerSpawn`;
  - disables autofire, enemy movement, enemy attacks, and director insertion;
  - emits explicit preview, autofire, and director telemetry;
  - does not alter normal gameplay, hitboxes, health, collision, replay, or settlement authority.

### Durable browser evidence

- Added `npm run smoke:hmh:enemy-details`.
- Desktop `1440x900` and mobile `390x844` both require:
  - the exact six authored archetypes;
  - all six production atlas IDs loaded;
  - one current candidate-bundle request;
  - `rosterPreview=true`;
  - `autofire=false`;
  - zero director insertions;
  - no canvas duplication, overflow, page errors, console errors, or HTTP errors.
- The harness serves the tracked terrain family locally and fails every unrelated resource error.

### Release rail repairs

- `hmh-reboot-release-browser-certification.mjs` now:
  - blocks service workers;
  - disables browser cache through CDP;
  - fulfills the freshly built child bundle exactly once per page;
  - maps canonical `https://lestersarcade.io/assets/**` requests to traversal-protected tracked local files;
  - retains the Cycle 025 four-control child contract.
- Mobile combat smoke now holds `Digit2`, `KeyE`, and `ShiftLeft` across fixed simulation samples.
- Opening-balance source tests now require the normal opening list plus the evidence-only full-roster branch.

## Authored pipeline proof

`npm run assets:hmh:enemy-roster:verify`

- Blender: `5.1.2`
- Actors: `7`
- Frames: `1,368`
- Duplicate frames: `0`
- Atlas bytes: `6,448,834`
- Reproducibility: `PASS`
- Raw frame trees removed after verification.

## Visual review

Reviewed pre/post contact sheets plus live desktop and mobile frames.

- Forkrunner forks remain attached and readable from front and angled views.
- Gas Bomber respirator and side bombs no longer read as extra limbs.
- All six preview actors are visible, grounded, separated, and aligned with health bars.
- Hero, minimap, status, and touch controls remain unobstructed.
- No clipping, horizontal overflow, or canon drift was accepted.

## Gate results

- Focused model, roster, opening, shell, and candidate-delivery tests: `PASS`
- `npm run check`: `PASS`
- Release: `1,773 / 1,721 / 52 accepted / 0 unexpected`
- Build: `PASS`
- Visual regression: `8/8`, max channel delta `2`
- Enemy-detail browser gate: desktop/mobile `PASS`
- Five-profile local candidate certification: `PASS`
- Combat browser smoke: desktop/mobile/world-tour `PASS`
- Cockpit, portal E2E, and four-device mobile controls: `PASS`
- Network audit: four scenarios, zero failures
- Performance:
  - bundle `1,021,358 / 1,050,000` bytes
  - desktop p95 `7 ms`
  - mobile p95 `7 ms`
- Security: `5/5`, zero findings
- Third-party security: `3/3`
- Production asset QA, strict repository health, CDN gate, and docs links: `PASS`

## Authority boundaries

- PixiJS remains `8.19.0`.
- Fixed-step simulation, catch-up cap, render partitions, replay, saves, bridge messages, collision, portals, Free/Ranked, and settlement authority are unchanged.
- Model geometry, scale, roster preview, telemetry, and browser routes are projection/evidence only.
- `SETTLEMENT_LIVE=false` remains unchanged.
- No wallet request, signature, transaction, LitVM action, settlement change, deployment, or production promotion occurred.

## Remaining highest-value work

1. Add front/side-readable role kits for Bagholder Rusher, Liquidator Agent, Whale Enforcer, Validator Cultist, and The Liquidator.
2. Add mechanical secondary motion and distinct recovery/death beats without changing authoritative timing.
3. Replace remaining primitive environment/landmark geometry with stronger authored building, tree, and damage-state silhouettes.
4. Add mobile-long-press melee and weapon-switch ergonomics only if full-device review proves the four-control layout is insufficient.
5. Harden the authored-prop reproducibility gate against renderer noise, then relight and human-review the 31-prop contact sheet.
6. Complete physical-device acceptance and the HALT-gated Web3 prerequisites before any production promotion.
