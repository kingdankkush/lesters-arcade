# HMH AAA Continuous Improvement Cycle 011

Date: 2026-07-26
Status: `LOCAL CERTIFIED · COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `774522ad` — Cycle 010 projectile recovery

## Objective

Restore truthful Liquidator attack readability by making the live Pixi renderer
consume every canonical boss telegraph geometry:

1. draw the missing Debt Collection `melee-circle` warning,
2. read safe-zone radius from canonical `geometry.radius`,
3. behaviorally verify every authored tell produces finite visible primitives,
4. expose evidence-only live primitive/attack telemetry,
5. preserve boss simulation, collision, damage, phase timing, replay, save, portal,
   Ranked/Free, and Web3 authority.

## Reproduction

`liquidator-boss.mjs` emits Debt Collection as:

```text
geometry.type = "melee-circle"
```

The committed live renderer in `main.mjs` only handled:

```text
geometry.type === "circle" || geometry.type === "melee"
```

Therefore the boss still resolved Debt Collection damage, but the matching red
warning circle never rendered. The same inline renderer read safe-circle radius
from `zone.radius`, although canonical safe-circle events store it at
`geometry.radius`.

## RED

`tests/hmh-reboot-liquidator-boss.test.mjs` first imported the intended
projection helper and executed all 15 authored tells through a recording Graphics
contract. Before implementation the suite failed with `ERR_MODULE_NOT_FOUND`.

The contract requires:

- every authored tell to produce at least one visible primitive and stroke;
- every projected coordinate and circle radius to be finite;
- Debt Collection `melee-circle` to produce exactly one circle;
- canonical safe-circle geometry to use the shared finite radius.

## Implementation

### Canonical projection helper

`apps/hmh-reboot/src/liquidator-telegraph-renderer.mjs` now owns projection-only
boss warning drawing for:

- line and dash-line;
- circle and melee-circle;
- ring;
- safe-circles;
- summon-sites.

It returns a frozen primitive-count report for behavioral tests and runtime
evidence. Unknown future geometry fails observably with zero primitives rather
than being mislabeled as rendered.

### Live runtime route

`apps/hmh-reboot/src/main.mjs` delegates all pending boss warnings to the helper.
The debug/evidence telemetry reports:

- `bossPendingAttackIds`;
- `bossTelegraphPrimitives`.

These fields describe projection only and do not enter gameplay state, replay,
saves, bridge messages, score, wallet, or settlement.

### Permanent browser contract

`scripts/hmh-reboot-combat-browser-smoke.mjs` waits for the real deterministic
Debt Collection pending event and requires:

```json
{
  "bossPendingAttackIds": ["debt-collection"],
  "bossPendingTells": 1,
  "bossTelegraphPrimitives": 1
}
```

A real 1440×900 Pixi/WebGL frame was also frozen at simulation tick 305 with the
production Liquidator atlas active. Visual inspection confirmed a clear centered
red warning circle inside the canvas with no serious clipping or terrain
occlusion. The temporary screenshot was deleted after inspection.

## Preserved invariants

- PixiJS remains `8.19.0`.
- Simulation remains fixed at 60 Hz with at most four catch-up steps.
- Liquidator attack plan, targets, tells, resolution timing, damage, safe zones,
  body, phase transitions, endless cadence, and event caps are unchanged.
- Gameplay collision remains authoritative; the new helper is projection-only.
- Replay/session IDs, RNG, save schema 2, and bridge `hmh-bridge/v1` are unchanged.
- Free Mode does not write Ranked progress.
- Parent portal retains identity, leaderboard, analytics, wallet, official
  completion, and settlement authority.
- `SETTLEMENT_LIVE=false` remains unchanged.

## Verification

### Focused and adjacent

- Liquidator boss: `14/14` pass.
- Boss/director/art/atlas adjacency matrix: `58/58` pass.
- All 15 authored boss tells produce finite visible projection primitives.
- Deterministic Liquidator timelines remain equal at 60/30/20 render partitions.
- Syntax: 332 JavaScript modules and 49 Python scripts.
- Build: PASS; HMH child bundle `995,364 / 1,050,000` bytes.

### Browser and visual

- Real Debt Collection browser contract: PASS with one pending tell and one
  rendered warning primitive.
- Combat browser smoke: desktop, mobile, and bridge world tour pass.
- Visual regression: all eight scenes unchanged; no baselines accepted.
- Five-profile release browser certification: desktop, ultrawide, tablet
  landscape, mobile portrait, and mobile landscape pass.
- Performance:
  - desktop p95 `7 ms`, max `13.9 ms`;
  - mobile p95 `7 ms`, max `20.9 ms`;
  - bundle remains under budget and both profiles report zero errors.
- Cockpit browser smoke: desktop/mobile pass.
- Parent portal E2E: six implemented flows pass with zero console errors.
- Network/console audit: four clean/warm scenarios pass with zero HTTP, request,
  console, or page errors.

### Full release and repository

- Retirement ledger: `1,700 total / 1,648 passed / 52 accepted / 0 unexpected`.
- HMH security audit: 5/5, zero findings.
- Third-party sandbox security: 3/3 pass.
- Production asset QA: four hero atlases, seven enemy/boss atlases, and 29
  authored props pass.
- Strict repository health: pass.
- CDN gate: 33 candidates / 101 MB, no destructive action.
- Documentation links: eight current/public documents pass.
- Repository audit: 599 files scanned, 24,127 unique references; generated CDN
  report drift was restored.

## Known debt and next program

Cycle 011 closes the concrete invisible-boss-warning defect. The next authorized
program is the broader pre-deployment polish pass requested on 2026-07-26:

- gameworld and authored level-design polish;
- art assets/models, hero and enemy designs, animation completeness;
- combat, movement, sound, VFX, and power-up polish;
- menus/UI, rotating animated hero selection, pause/settings;
- level-up, skill-tree, tooltip, onboarding, and accessibility completion;
- thorough desktop/mobile bug testing and playtesting;
- final replacement-candidate report and remaining deployment-task list.

Firefox/WebKit remain unavailable locally. Hardened Web3 remains blocked on
separate deployment and trusted-attestation prerequisites.

## Deployment state

No push, preview/production deployment, promotion, LitVM action, transaction,
wallet/signature request, or settlement change occurred. Production remains
`dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`; `SETTLEMENT_LIVE=false`.

## Exact-index policy

Stage and freeze the intended candidate with literal
`git diff --cached --binary | sha256sum`. Independent review must inspect that
exact patch. Any later edit requires a new hash and fresh review.
