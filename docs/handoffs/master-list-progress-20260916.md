# Master-list progress — 2026-09-16 session

Working branch `fable/master-list-20260916`, cut from `codex/mobile-worlds-aquatic-20260914` (`17e2d1b7`, the live lineage). Source of truth for scope: `C:/Users/just_/Desktop/LESTERS-ARCADE-MASTER-REMAINING-WORK-2026-09-16.md` (IDs X-*, HMH-N*, CH-N*, ST-N*).

## Slice 1 — HMH weapon swap, weapon wheel, railgun lane (HMH-N01, HMH-N04) — committed `ee0b04d6`

- One manual weapon control. Keyboard `Q` (alternate `E`), gamepad right bumper (button 5), touch `SWAP` button on the grenade row. `weaponNext` is a buffered one-tick edge in `apps/hmh-reboot/src/input.mjs`; held input never repeats it.
- Weapon wheel: `Tab`, or the armed-weapon cockpit card (`#hmhHudWeapon`, now `role="button"`), opens `apps/hmh-reboot/src/weapon-wheel.mjs` (lazy `import()`, not in the initial bundle). The simulation holds in a new `menu` state (`DeterministicSimulation.enterMenu/leaveMenu`); a pick becomes `InputState.requestWeaponSlot(slot)` consumed by the next admitted tick, so the wheel never writes the loadout. Digits 1–8 pick, arrows/WASD move focus, Escape/Tab/backdrop close. Pause closes the wheel first. Ring radius is width-aware so the 3/9 o'clock cards fit a 320 px phone.
- Runtime: `switchWeapon()` and `nextOwnedWeaponId()` in `weapon-system.mjs` are applied inside the tick before `stepWeaponLoadout` (the same rule `grantWeaponPickup` uses), record a `swap` run event and announce the armed weapon.
- Railgun: `hash-rail` policy `pierce maxTargets 6` (Deep Proof 7, Settler Rail 8). Projectiles carry `pierceHitIds`; each tick the stepped projectile state excludes those bodies (`createProjectileState({ excludeTargetIds })`) and carries only the remaining budget; the slug ends on cover, range or budget. Damage is flat along the lane; boss health is 12,000 so the rail is never a one-shot there.
- Contract updates: bridge settings schema (`sdk/hmh-bridge-protocol.mjs`) accepts the seventh binding; cockpit help, briefing copy, touch hint; smokes `hmh-reboot-mobile-controls`, `production-hero`, `release-browser-certification` expect `['aim','move','pause','power','swap']`.
- Evidence: `tests/hmh-reboot-weapon-swap.test.mjs` (10 tests); `npm run smoke:hmh:weapon-wheel` (new, desktop + 390×844 touch, screenshots under `.hermes/evidence/hmh-reboot-weapon-wheel/`); release gate green except the README marker, now bumped to `lesters-arcade-v51-weapon-wheel`. Initial HMH JS 1,040,578 / 1,048,576 B (7.7 KB headroom; the wheel chunk is lazy).

## Slice 2 — end-of-run share for all three games (X-13)

- `apps/portal/src/share-links.mjs`: `buildShareLinks` (x.com intent, Facebook sharer, Discord copy text), `buildHmhShareText`, `buildStackedShareText`, `createShareRow` (createElement only; native share when available, X and Facebook anchors with `rel="noopener noreferrer"`, Discord copy via clipboard).
- HMH: parent game-over summary (`renderGameOverSummary` in `apps/portal/main.js`) appends the row under the recap.
- Chikun: `#shareRow` under the result actions, beside the existing `Share Run` native button (`apps/chikun/src/main.mjs renderShareRow`).
- STACKED: `#shareRow` in the results panel (`apps/stacked/src/main.mjs renderShareRow`).
- Hosts: Chikun and STACKED iframes gain `allow-popups allow-popups-to-escape-sandbox` and `web-share; clipboard-write` (first-party runtimes only; third-party manifests stay scripts-only).
- Evidence: `tests/share-links.test.mjs`.

## Not yet done in this session (see master list)

Web3 lane X-01..X-12, HMH-N02/N03 art, CH-N01/N02, ST-N01..N03. Physical-device acceptance remains owner/tester work.
