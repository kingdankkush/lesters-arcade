# In-game Ranked onboarding copy (fable/in-game-ranked-copy, 2026-09-26)

**Owner request (2026-09-26, via the integration owner):** update every game menu with the new steps, pricing, faucet and how Ranked works, aimed at easy conversion plus complete help. The portal half (guide page, FAQ, homepage, modal, mode-select lines, README, docs) is `fable/pd-ranked-onboarding`. This branch is the in-game half: the three game children's host pages. Copy only: no behaviour, no simulation, no bridge protocol change, 0 B change to any child JS entry.

**Branch:** `fable/in-game-ranked-copy`, worktree `C:/Users/just_/lesters-arcade-wt/ranked-copy`, based on `fable/master-list-20260916` at `32018fbd`.
**Facts and wording:** `docs/handoffs/ranked-onboarding-20260926/ranked-onboarding.md` (the only numbers any copy may use).

## Merge order (fee truth)

"Ranked costs 0.012 testnet zkLTC per run" is true only after the fee release `fable/ranked-fee-001` (entry 0.01, settle floor 0.012). **Merge this branch with or after `fable/ranked-fee-001`, never before.** Until then the live price the modal quotes and the price this copy states disagree.

## Canonical strings (verbatim on all three host pages)

- Price: "Ranked costs 0.012 testnet zkLTC per run: 0.01 entry + 0.002 to publish your score on chain."
- Faucet: "Get free testnet zkLTC from the LiteForge faucet (0.05 per request, enough for 4 Ranked runs):" followed by the faucet URL (a link on Chikun and STACKED, plain text on HMH).
- Free: "Free play needs no wallet and never touches the chain."
- Proof: "Ranked runs are checked by the arcade's server and published on LitVM, then appear on the leaderboards, your profile and your achievements."
- Value: "Testnet zkLTC has no monetary value."
- Guide link text: "How Ranked works", path exactly `/how-ranked-works` (never `.html`; the portal slice adds `apps/portal/how-ranked-works.html` plus the `vercel.json` rewrite).

House style: no "verified", "prize", "earn", no monetary promise, no em dash in the new blocks (pinned by the test).

## Placements

| Game | Surface | File and element | Notes |
|---|---|---|---|
| HMH | Level briefing card, after the three tips and before the progress bar; shown before every run in both modes | `apps/portal/hmh-reboot/index.html` `<section class="hmh-startup-modes" aria-labelledby="hmhStartupModesTitle">`; styles in `apps/portal/hmh-reboot/styles.css` (`.hmh-startup-modes`, phone `<=600px` and short-desktop compact rules as separate lines) | Heading "Free and Ranked", Free, Price + Faucet (URL as text), Proof + Value, then "How Ranked works: lestersarcade.io/how-ranked-works" as text. No anchor: the HMH host sandbox is `allow-scripts allow-same-origin allow-pointer-lock` (no `allow-popups`, pinned by `tests/hmh-reboot-host.test.mjs`) and `hmh-bridge/v1` has no open-URL message; none was added. Pause panel, cockpit and every live-run surface untouched. |
| Chikun | Start overlay, under the key hints below the Start button | `apps/portal/chikun/index.html` `<details id="rankedHelp" class="ranked-help">` | Collapsed by default. Summary "Free and Ranked · 0.012 zkLTC per run"; body = Free, Price, Faucet (link), Proof + Value, "How Ranked works" link. |
| Chikun | Free results overlay, right after the share row | `apps/portal/chikun/index.html` `<p id="rankedHint" class="ranked-hint">` | "Free play needs no wallet and never touches the chain. How Ranked works" (link). Hidden in Ranked by the existing `#gameShell[data-mode="ranked"]` (CSS only). Styles appended to `apps/portal/chikun/game.css`: compact under 700 px, portrait inner scroll (34dvh) when expanded, `max-height:450px` compact, hidden at `max-height:260px` like the mode tease. |
| STACKED | Ranked mode tile hint | `apps/portal/stacked/index.html` `#rankedModeTile .tile-hint` | "Verified runs" became "0.012 zkLTC per run" (price visible before any click). One pin updated in `tests/stacked-ranked-settlement.test.mjs`. |
| STACKED | Right after the share row (the one dialog panel serves menu, pause and Free results) | `apps/portal/stacked/index.html` `<p id="rankedHint" class="ranked-hint">` and `<details id="rankedHelp" class="ranked-help">` | Free sentence (`.free-line`) + the single guide anchor; collapsed explainer with the four canonical lines and the faucet link. `#menuTiles:has(#rankedModeTile[aria-current="true"])~.ranked-hint .free-line{display:none}` drops the Free sentence while Ranked is active (guide link stays). Focus trap already includes `a[href]` and `summary`; pinned first/last stops unchanged. Styles appended to `apps/portal/stacked/game.css`. |

Links on Chikun and STACKED open with `target="_blank" rel="noopener noreferrer"`; both hosts already grant `allow-popups allow-popups-to-escape-sandbox`. No new bridge message type anywhere.

## Guide-path constant per child (retarget here if the URL changes)

| Child | Where the path lives | Occurrences |
|---|---|---|
| HMH | `apps/portal/hmh-reboot/index.html`: `<span data-guide-path="/how-ranked-works">lestersarcade.io/how-ranked-works</span>` inside `.hmh-startup-guide` | 1 attribute + the visible text |
| Chikun | `apps/portal/chikun/index.html`: `href="/how-ranked-works"` on the `#rankedHelp` body link and on the `#rankedHint` link (two separate overlays) | 2 |
| STACKED | `apps/portal/stacked/index.html`: `href="/how-ranked-works"` on the `#rankedHint` link | 1 |

`tests/ranked-in-game-copy.test.mjs` pins every occurrence to exactly `/how-ranked-works` and fails on `.html`.

## Byte deltas (`npm run build`, unchanged versus baseline)

| Bundle | Size | Cap |
|---|---|---|
| STACKED entry `dist/stacked/game.js` | 27,775 B | 29,000 B (`tests/stacked-contracts.test.mjs`) |
| Chikun entry | 44,054 B | unchanged |
| HMH child entry | 356,867 B | 480,000 B |
| HMH initial + shared chunks | 1,044,585 B | 1,048,576 B (3,991 B headroom, `scripts/hmh-reboot-bundle-budget.mjs`) |

All copy lives in the static host HTML/CSS, which no cap counts. `apps/hmh-reboot/src/*`, `apps/chikun/src/*` and `apps/stacked/src/*` are untouched (0 B), so this branch does not collide with the concurrent `main.mjs` edits on other branches.

## Tests

- New: `tests/ranked-in-game-copy.test.mjs` (registered in `scripts/syntax-check.mjs`): canonical wording matches the brief; every host page carries the four facts, the faucet line and its URL verbatim; the guide path is exactly `/how-ranked-works` everywhere; each block sits on a pre-run or post-run surface only; the child JS entries carry none of the copy; house style; the CSS mode gates and phone containment rules exist.
- Updated: `tests/stacked-ranked-settlement.test.mjs` (Ranked tile hint pin).
- Per-game notes: `docs/hmh-reboot/RANKED-COPY-2026-09-26.md`, `docs/chikun/RANKED-COPY-2026-09-26.md`, `docs/stacked/RANKED-COPY-2026-09-26.md`.

## Verification

(filled in below after the browser runs and the release gate)

## Left for follow-ups (not in this branch)

- `apps/portal/src/hmh-copy-sheet.mjs` `modeSelect.ranked.copy` still says "Free on testnet; you only need zkLTC gas from the faucet" (portal-owned, pinned by `tests/hmh-copy-sheet.test.mjs`); belongs to the portal slice.
- Chikun `setModePresentation` / result copy ("Verified Flight", "sent to Lester's Arcade for verification") and STACKED `finish()` ("Verifying your recorded run…") are JS strings in files other branches are editing; align them to the canonical "checked" wording once those `main.mjs` edits land.
- Granting `allow-popups` to the HMH host so the guide can be a real link is a host security-surface change and a new release candidate under `AGENTS.md`; owner-gated.
