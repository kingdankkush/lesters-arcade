# HMH in-game Ranked copy (2026-09-26)

Owner direction (via the integration owner, 2026-09-26): every menu explains the new steps, pricing, faucet and how Ranked works, aimed at easy conversion plus complete help. The portal side (guide page, FAQ, homepage, modal, mode-select lines, README) is the `fable/pd-ranked-onboarding` slice. This note covers the Hard Money Heroes child. Copy only: no behaviour, simulation or bridge change.

Canonical wording and facts: `docs/handoffs/ranked-onboarding-20260926/ranked-onboarding.md`.

## Where it shows

| Surface | File | What |
|---|---|---|
| Level briefing card, after the three tips, before the progress bar | `apps/portal/hmh-reboot/index.html` (`<section class="hmh-startup-modes">`) | Heading "Free and Ranked", then the Free, Price + Faucet, Proof + Value lines verbatim, then "How Ranked works: lestersarcade.io/how-ranked-works" as text |
| Styles | `apps/portal/hmh-reboot/styles.css` (`.hmh-startup-modes`, phone and short-desktop compact rules) | Same type scale and rule as the tips block; `overflow-wrap:anywhere` for the two URLs so the card never scrolls sideways at 320 px |

The briefing is shown before every run in both modes, so the block is true for Free and Ranked players alike. Nothing was added to the cockpit, the pause panel or any live-run surface.

## Why the guide is text, not a link

The HMH host iframe sandbox is `allow-scripts allow-same-origin allow-pointer-lock` (`apps/portal/src/hmh-reboot-host.mjs`, pinned by `tests/hmh-reboot-host.test.mjs`): no `allow-popups`, so a `target="_blank"` anchor would silently do nothing, and the `hmh-bridge/v1` protocol has no open-URL message (and this slice adds none). The path lives once, in `data-guide-path="/how-ranked-works"`; the visible text repeats it for the player. Granting `allow-popups` to the HMH host is a host security-surface change and a new release candidate under `AGENTS.md`; it is listed as owner-gated follow-up, not done here.

## Byte caps

0 B change to `apps/hmh-reboot/src/*`; the child entry and the initial + shared-chunk budget (`scripts/hmh-reboot-bundle-budget.mjs`, 1,048,576 B cap with under 4 KB headroom) are untouched. Host HTML/CSS are not counted by any cap.

## Fee truth

"0.012 testnet zkLTC per run" is true only after the fee release (`fable/ranked-fee-001`: entry 0.01, settle floor 0.012). The branch carrying this copy merges in that release or after it, never before.

## Gate

`tests/ranked-in-game-copy.test.mjs` pins the canonical strings verbatim, the exact guide constant (never `.html`), the placement inside the startup card only, the absence of anchors in the HMH block, and that `apps/hmh-reboot/src/main.mjs` carries none of the copy.

## Left for the portal slice

`apps/portal/src/hmh-copy-sheet.mjs` `modeSelect.ranked.copy` still says "Free on testnet; you only need zkLTC gas from the faucet", which is stale against the 0.012 price; it is portal-owned and pinned by `tests/hmh-copy-sheet.test.mjs`.
