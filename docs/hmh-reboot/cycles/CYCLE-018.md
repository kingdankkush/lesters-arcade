# HMH AAA Continuous Improvement Cycle 018

Date: 2026-07-26
Status: `LOCAL CERTIFIED · INCLUDED IN THIS CYCLE COMMIT · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `c07b6e8e` — `feat(hmh): add responsive upgrade details`

## Player-facing problems

1. The pause dialog offered only Resume, Restart, and Exit. Players could not change live audio/accessibility settings without leaving the run.
2. The run had a deterministic ranked upgrade tree but no pause-time view of acquired ranks.
3. A settings implementation could have become cosmetic, diverged from the validated bridge, or reset after Restart.
4. The first short-landscape layout hid the action row below the viewport.

## Bounded implementation

- Added four truthful pause controls backed by existing live consumers:
  - Music
  - Screen shake
  - Reduced motion
  - Reduced flash
- Deliberately did not expose dormant `gore` or `colorblindTags` protocol fields because the reboot renderer does not consume them.
- Centralized setting synchronization across:
  - top-level Music button
  - pause controls
  - combat audio
  - render accessibility paths
  - semantic stage telemetry
  - validated `game:settings` bridge messages
  - portal-originated settings messages
  - the current session snapshot used by Restart
- Added a current-build list derived from the canonical progression snapshot and `RUN_UPGRADE_CATALOG`.
- Preserved upgrade IDs, ranks, effects, choice order, simulation, replay, save, bridge, Free/Ranked, and settlement authority.
- Added two-column desktop/tablet layout, one-column portrait layout, and compact short-landscape layout.
- Kept every real setting/action control at least 44 px high.
- Styled Restart as caution and enabled Exit as danger; standalone disabled Exit remains truthful.

## TDD evidence

1. **RED** — the four-profile cockpit smoke required four pause setting inputs and failed `0 !== 4` on the untouched UI.
2. **GREEN** — real controls and current-build rendering were wired to existing runtime state.
3. **Persistence** — browser automation toggled Reduced Motion and Reduced Flash, restarted the run, reopened pause, and proved Music off + both accessibility settings remained selected.
4. **Runtime truth** — stage telemetry changed to `settingReduceMotion=true` and `settingReduceFlash=true` while the paused dialog stayed open.
5. **Responsive correction** — a stronger geometry assertion rejected clipped actions; the short-landscape layout was compacted until all three 44 px actions were initially visible.

## Browser matrix

`node scripts/hmh-reboot-cockpit-browser-smoke.mjs`

- Desktop `1440×900`: two-column settings/build cockpit and three actions.
- Tablet `768×1024`: contained pause cockpit plus certified upgrade layout.
- Phone `390×844`: one-column settings, build, and all actions contained.
- Short landscape `844×390`: all settings, build, and actions visible without scrolling.
- Each profile showed `Validator Training · Rank 1/3 · +25% XP gain` after the deterministic first choice.
- All profiles preserved setting values through Restart and reported zero browser errors.

Visual evidence remains only under ignored `.hermes/evidence/hmh-reboot-16-cockpit/`.

## Certification

- Focused progression/shell/protocol/bridge tests: `34/34` PASS.
- Visual regression: `8/8` PASS, zero delta.
- Performance: desktop/mobile p95 `7 ms`.
- Release gate: `1,714 total / 1,662 passing / 52 accepted legacy / 0 unexpected`.
- Five-profile browser release certification: PASS.
- Security: `5/5`, zero findings.
- Network: four scenarios PASS, zero HTTP/request/console/page errors.
- Repository strict, CDN, and docs gates: PASS.
- Bundle: `1,010,293 / 1,050,000` bytes.
- Syntax, build, and diff check: PASS.

## Safety statement

- `SETTLEMENT_LIVE=false` unchanged.
- No wallet request, signature request, transaction, LitVM operation, settlement change, push, deployment, or production replacement occurred.
