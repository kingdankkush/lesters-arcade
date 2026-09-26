# Chikun's Escape in-game Ranked copy (2026-09-26)

Owner direction (via the integration owner, 2026-09-26): every menu explains the new steps, pricing, faucet and how Ranked works, aimed at easy conversion plus complete help. The portal side is the `fable/pd-ranked-onboarding` slice. This note covers the Chikun child. Copy only: no behaviour, simulation, replay or bridge change.

Canonical wording and facts: `docs/handoffs/ranked-onboarding-20260926/ranked-onboarding.md`.

## Where it shows

| Surface | File | What |
|---|---|---|
| Start overlay, under the key hints, below the Start button | `apps/portal/chikun/index.html` (`<details id="rankedHelp" class="ranked-help">`) | Collapsed by default. Summary "Free and Ranked · 0.012 zkLTC per run"; body holds the Free, Price, Faucet (linked), Proof + Value lines verbatim and a "How Ranked works" link |
| Results overlay, right after the share row | `apps/portal/chikun/index.html` (`<p id="rankedHint" class="ranked-hint">`) | "Free play needs no wallet and never touches the chain. How Ranked works" (link) |
| Styles | `apps/portal/chikun/game.css` (appended block) | Matches the mode-tease type; 44 px summary; compact rules under 700 px, portrait, and short landscape; hidden at `max-height:260px` like the tease |

Mode gating is CSS only: the child already sets `#gameShell[data-mode]`, so `.game-shell[data-mode="ranked"] .ranked-hint{display:none}` keeps the Free hint off Ranked results (the parent results screen owns Ranked sharing and copy). The results overlay also hides its direct `<p>` children during replay playback and in very short viewports, which the hint inherits.

Links open in a new tab with `target="_blank" rel="noopener noreferrer"`; the Chikun host sandbox already grants `allow-popups allow-popups-to-escape-sandbox` (pinned by `tests/share-links.test.mjs` and `tests/chikun-host.test.mjs`). No new bridge message type.

The guide path appears twice on the page (start overlay and results overlay are separate DOM trees); the test pins every occurrence to exactly `/how-ranked-works`.

## Byte caps

0 B change to `apps/chikun/src/*` and to the bridge/replay payloads. Host HTML/CSS are not counted by any cap.

## Fee truth

"0.012 testnet zkLTC per run" is true only after the fee release (`fable/ranked-fee-001`: entry 0.01, settle floor 0.012). The branch carrying this copy merges in that release or after it, never before.

## Gate

`tests/ranked-in-game-copy.test.mjs`. The pinned copy tests `tests/chikun-regions.test.mjs` (tease placement) and `tests/chikun-runtime-shell.test.mjs` (ids) are unchanged and pass.

## Left in the child JS (other branches are editing `apps/chikun/src/main.mjs`)

`setModePresentation` and the result copy still say "Verified Flight" and "sent to Lester's Arcade for verification" (pinned by `tests/stacked-ranked-settlement.test.mjs`). Aligning them to the canonical "checked" wording is a JS string change and belongs to a follow-up once the concurrent `main.mjs` edits land.
