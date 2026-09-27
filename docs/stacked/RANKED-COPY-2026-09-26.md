# STACKED in-game Ranked copy (2026-09-26)

Owner direction (via the integration owner, 2026-09-26): every menu explains the new steps, pricing, faucet and how Ranked works, aimed at easy conversion plus complete help. The portal side is the `fable/pd-ranked-onboarding` slice. This note covers the STACKED child. Copy only: no behaviour, simulation, evidence or bridge change.

Canonical wording and facts: `docs/handoffs/ranked-onboarding-20260926/ranked-onboarding.md`.

## Where it shows

STACKED has one dialog panel (`#gameOverlay .panel`) for the menu, the pause screen and the results, so one set of elements serves all three.

| Surface | File | What |
|---|---|---|
| Ranked mode tile | `apps/portal/stacked/index.html` (`#rankedModeTile .tile-hint`) | "Verified runs" became "0.012 zkLTC per run" (price visible before any click; one pin in `tests/stacked-ranked-settlement.test.mjs` updated) |
| Right after the share row, before the medal shelf | `apps/portal/stacked/index.html` (`<p id="rankedHint">`) | "Free play needs no wallet and never touches the chain. How Ranked works" (the single guide anchor). On Free results it sits under the share buttons; on the menu it reads as a mode note under the tiles |
| Collapsed explainer | `apps/portal/stacked/index.html` (`<details id="rankedHelp">`) | Summary "Free and Ranked · 0.012 zkLTC per run"; body holds the Free, Price, Faucet (linked), Proof + Value lines verbatim |
| Styles | `apps/portal/stacked/game.css` (appended block) | Panel type scale; `.summary-hint` keeps "zkLTC" in its own case; `overflow-wrap:anywhere` for the faucet URL |

Mode gating is CSS only: the runtime already sets `aria-current` on the mode tiles, so `#menuTiles:has(#rankedModeTile[aria-current="true"])~.ranked-hint .free-line{display:none}` drops the Free sentence while Ranked is active (the guide link stays). Browsers without `:has()` simply show the sentence, which is true in any mode.

Keyboard and gamepad: the dialog focus trap (`apps/stacked/src/overlay-focus.mjs`) already includes `a[href]` and `summary`, and the new stops sit between `#continueButton` and `#volumeRange`, so the pinned first/last stops (`tests/stacked-shell-ui.test.mjs`) are unchanged. Gamepad menu stops (`menu-navigation.mjs`) walk `summary` and skip anchors by design; the link stays reachable with Tab.

Links open in a new tab with `target="_blank" rel="noopener noreferrer"`; the STACKED host sandbox already grants `allow-popups allow-popups-to-escape-sandbox`. No new bridge message type.

## Byte caps

0 B change to `apps/stacked/src/*`; `dist/stacked/game.js` stays at its baseline size against the 29,000 B cap (`tests/stacked-contracts.test.mjs`). Host HTML/CSS are not counted by any cap.

## Fee truth

"0.012 testnet zkLTC per run" is true only after the fee release (`fable/ranked-fee-001`: entry 0.01, settle floor 0.012). The branch carrying this copy merges in that release or after it, never before.

## Gate

`tests/ranked-in-game-copy.test.mjs`, plus the unchanged `tests/stacked-shell-ui.test.mjs`, `tests/integration-glue-copy.test.mjs` (D17) and `tests/stacked-menu-navigation.test.mjs`.

## Left in the child JS (other branches are editing `apps/stacked/src/main.mjs`)

`finish()` still sets "Verifying your recorded run…" while the parent replays the run. Aligning it to the canonical "checked" wording is a JS string change and belongs to a follow-up once the concurrent `main.mjs` edits land.
