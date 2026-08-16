# HMH AAA Continuous Improvement Cycle 052

Date: `2026-08-16`
Status: `LOCAL SOURCE CERTIFIED · COMMITTED 7837888a · BROWSER ENDURANCE PASS · INHERITED VISUAL BASELINE DRIFT OPEN · PREVIEW/PRODUCTION UNCHANGED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `a4cb02da7244d9f87d968ae783449036a72b76ed`
Source commit: `7837888af7592c195eaf526921305b77a3307472`
Exact source patch SHA-256: `9381fc018b413c16d5e5ceee08c0661feb8ed73e6a893bc527546ad5c3a8f843`

## Bounded slice

Close the remaining Wave 10 browser-soak truth gap by proving `128` real active enemy bodies for serial desktop and mobile wall-clock intervals. The route must reuse current enemy selection, population insertion, fixed-tick movement/safety, attack-token, projectile, effect, production-art, and telemetry authorities; it must be unreachable unless both `evidenceSafe=1` and `endurancePressurePilot=1` are present.

## RED → GREEN

RED was established before implementation:

```text
node --test tests/hmh-reboot-enemy-endurance-soak.test.mjs
exit 1: encounter-director.mjs did not export buildEnduranceEncounterCandidates
```

GREEN focused result after implementation and release-contract reconciliation:

```text
node --test tests/hmh-reboot-enemy-attack-presentation.test.mjs \
  tests/hmh-reboot-enemy-role-detail.test.mjs \
  tests/hmh-reboot-enemy-simulation.test.mjs \
  tests/hmh-reboot-opening-balance.test.mjs \
  tests/hmh-reboot-encounter-director.test.mjs \
  tests/hmh-reboot-enemy-endurance-soak.test.mjs
54 tests · 54 pass · 0 fail
```

The candidate-builder contract proves exact deterministic equality for one seed, divergence for another seed, `128` unique stable IDs, all six human/zombie production archetypes, requested melee/ranged/area/support pressure roles, in-bounds/non-deep/non-blocked positions, and fail-closed validation above capacity.

## Runtime integration

- `buildEnduranceEncounterCandidates(...)` produces deterministic authored-ground candidates; it does not insert entities or become a second population authority.
- `main.mjs` routes every candidate through `attemptScheduledEnemyInsertion(...)` against the existing `192` body and `640` threat capacities.
- The pilot uses the existing immutable endurance-band snapshot beginning at exact tick `75,600` for `64` full-AI slots and family-token caps `6/5/4/2`.
- Normal opening composition, two-second enemy movement hold, eight-second attack grace, director schedule, and roster-preview behavior remain intact.
- The pilot URL is fail-closed behind both evidence flags. The pilot flag is immutable for the session.
- Every fixed tick still runs canonical collision, traversal, elevation, bounds, stuck recovery, attack reservations, projectile resolution, and effect compaction.
- Runtime telemetry now exposes family-token counts plus simulation frame steps, catch-up saturation, and dropped time. This is read-only evidence.
- Cache marker advanced to `lesters-arcade-v20-hmh-browser-endurance`; no deployment consumed it.

## Serial real-browser evidence

Command:

```text
npm run smoke:hmh:enemy-endurance -- --seconds=30
```

Tracked reports:

- `docs/testing/hmh-reboot-enemy-endurance-browser.json`
- `docs/testing/hmh-reboot-enemy-endurance-browser.md`

### Desktop — 1440×900

- wall-clock sample: `30s`;
- bodies: `128–128`;
- threat peak: `497/640`;
- token peaks: melee `6/6`, ranged `5/5`, area `4/4`, support `2/2`;
- animated-enemy peak: `64`;
- projectile/effect peaks: `1/13`;
- fixed-tick safety steps per tick: `128`;
- collision/traversal peak: `3/0`;
- simulation advance: `1,787` ticks;
- median FPS: `144.93`;
- p95 frame time: `7.1 ms` against `28 ms` ceiling;
- catch-up saturation: `0%`;
- dropped simulation time: `0 ms`;
- long tasks: `0`;
- retained heap delta after explicit GC: `-43,918,661` bytes;
- console/network issues: `0/0`.

### Mobile touch — 390×844 CSS viewport

- wall-clock sample: `30s`, run serially after desktop;
- bodies: `128–128`;
- threat peak: `497/640`;
- token peaks: melee `6/6`, ranged `5/5`, area `4/4`, support `2/2`;
- animated-enemy peak: `64`;
- projectile/effect peaks: `1/13`;
- fixed-tick safety steps per tick: `128`;
- collision/traversal peak: `3/0`;
- simulation advance: `1,784` ticks;
- median FPS: `144.93`;
- p95 frame time: `7.0 ms` against `28 ms` ceiling;
- catch-up saturation: `0%`;
- dropped simulation time: `0 ms`;
- long tasks: `0`;
- retained heap delta after explicit GC: `+2,598,348` bytes against `32 MiB` ceiling;
- console/network issues: `0/0`;
- all five shipped touch controls were visible.

Production Blender hero art, production enemy-roster atlas art, authored props, authored terrain, and canvas visibility were required on every sample. Screenshots were captured locally to the ignored `docs/testing/VISUAL_BASELINES/current/enemy-endurance/` evidence directory. Pixel checks confirmed nonblank full-size captures: desktop `1440×900`, `2,368,160` bytes, `94,519` unique colors; mobile DPR capture `488×1055`, `793,572` bytes, `93,016` unique colors. Screenshots remain supporting evidence, not the sole performance verdict.

## Broader verification

- `npm run test:release`: **PASS**, `2,201` evaluated = `2,150` passed + `51` exact expected legacy failures; unexpected failures `0`.
- `npm run check`: **PASS**, `342` JavaScript modules + `49` Python scripts.
- `npm run build`: **PASS**.
  - HMH entry: `388,054` bytes.
  - Pixi vendor: `575,891` bytes.
  - Combined initial HMH JavaScript: `963,945 / 1,048,576` bytes.
  - Headroom: `84,631` bytes.
- `npm run smoke:hmh:performance`: **PASS**, desktop/mobile p95 `7.0 / 7.0 ms`, retained heap `-396,388 / -560,112` bytes, no steady-state long tasks or errors.
- `npm run audit:hmh:network`: **PASS**, four local clean/warm portal/HMH scenarios, zero HTTP/request/console/page failures.
- `npm run assets:verify`: **PASS**.
- `npm run contracts:check`: **PASS**.
- `npm run design:long-run`: **PASS**.
- `npm run design:security-audit`: **PASS**, `5/5` checks and `0` findings; generated timestamp churn was restored.
- `npm run repo:health:strict`: **PASS**, `2,591` tracked files and SHIP budget passed.

## Visual gate and blocker truth

`npm run visual:reboot` remains **BLOCKED** on the same two inherited signatures documented by Cycle 051 and reproduced from baseline HEAD there:

- `frontier-relay-mobile`: mean delta `1.708`, max-cell delta `42`, changed cells `79`;
- `combat-engaged-desktop`: mean delta `0.571`, max-cell delta `22`, changed cells `34`.

All other ten scenes remained within the existing gate. No baseline was accepted, weakened, or rewritten. Cycle 052 changes only an evidence-safe route and telemetry and do not affect normal-play visual scenes, but the repository-wide visual gate is reported honestly as open.

## Exact-index review

The frozen staged patch SHA-256 was:

```text
9381fc018b413c16d5e5ceee08c0661feb8ed73e6a893bc527546ad5c3a8f843
```

Hosted Hermes delegation could not start because the configured Nous provider had no token. A first local offline review produced findings contradicted by the patch (it claimed direct array insertion despite the explicit `attemptScheduledEnemyInsertion(...)` loop, assumed an immutable boot parameter could toggle, and treated the exact endurance-band boundary as arbitrary), so it was not counted. A bounded correction review against the same frozen hash returned `PASS` with no blockers. The one-parent binary commit patch for `7837888a` matches the reviewed hash exactly.

## Files changed

- `apps/hmh-reboot/src/encounter-director.mjs`
- `apps/hmh-reboot/src/main.mjs`
- `apps/portal/sw.js`
- `scripts/hmh-reboot-enemy-endurance-browser-smoke.mjs`
- `scripts/syntax-check.mjs`
- `package.json`
- `tests/hmh-load-speed.test.mjs`
- `tests/hmh-reboot-encounter-director.test.mjs`
- `tests/hmh-reboot-enemy-endurance-soak.test.mjs`
- `tests/hmh-reboot-enemy-simulation.test.mjs`
- `tests/hmh-reboot-shell.test.mjs`
- `docs/testing/hmh-reboot-enemy-endurance-browser.json`
- `docs/testing/hmh-reboot-enemy-endurance-browser.md`

## Boundaries

- Production, Preview, aliases, rollback, and `main` were untouched.
- No push, deployment, promotion, publication, external upload, paid service, or credential use occurred.
- No wallet, contract, transaction, settlement, or LitVM write occurred.
- `SETTLEMENT_LIVE=false` and the LitVM HALT gate remain unchanged.
- Human/zombie-only combat canon, fixed `60 Hz`, maximum four catch-up steps, parent authority, and all runtime caps remain unchanged.

## Next bounded slice

Reconcile `frontier-relay-mobile` and `combat-engaged-desktop` against the last accepted visual baseline without using `--accept` until the player-visible delta is explained. Once the inherited visual gate is resolved, begin the smallest Wave 11 Liquidator build-matrix slice: baseline versus high/low DPS using existing phase/damage-window telemetry, without rewriting boss authority.
