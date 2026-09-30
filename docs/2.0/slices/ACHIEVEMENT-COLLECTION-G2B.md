# G2b — checked achievement collection preview

The hosted profile has an optional, read-only collection at
`?achievementCollection=collection-v1`. An absent, wrong or duplicate value keeps
the current profile and makes no collection-module, CSS or population request.
The initial public default is unchanged. No ownership, earning criteria, unlock
history, wallet, chain, simulation or verifier write was introduced.

The display contains the available 124-entry catalog (44 HMH, 40 Chikun, 40
STACKED), unique verified earned records, per-cabinet completion and 13 existing
trophy-achievement counts. Cabinet, owned/locked/trophy, search and ordering
controls use native inputs. The rarest earned item compares exact integer ratios
across cabinet populations; early cohorts or missing counts never invent rarity.
Token decoration still requires the existing chain-confirmed held-token check.

Population reads are anonymous, cabinet-specific, coalesced and cached for five
minutes. A five-second timeout, abort-on-dispose, 64 KiB JSON ceiling and strict
full-catalog validation prevent stale or malformed responses from replacing earned
records. Optional-module failure retains the existing verified list without a
retry loop. Late imports render the current viewed profile. Pagehide disposes the
controller and invalidates a pending import; restored pageshow recreates it.
Open requirements and keyboard focus survive asynchronous population repaints.

## Observed checks

- The independent review produced six real failures (focus/open-state, public
  wording, three lazy profile cases and exact-fraction ordering), then 44/44 pass.
- Actual built Chrome exposed another issue: the portal DOM factory does not
  assign native option values, placeholder or maxLength. The browser timeout is
  retained; a focused test reproduced it before explicit property assignment.
- Final related checks: 45/45; exact 12-file source copy with no Git, no modules
  and empty PATH: 19/19. No skips/cancellations.
- Fresh local build: HMH initial plus shared 1,039,992 B (8,584 B headroom);
  STACKED 577,431 B (29,569 B headroom).
- Actual built Chrome: seven checks for delayed-focus preservation, filters,
  lifecycle restoration, phone framing/reduced motion, default/duplicate-off
  loading and malformed population. Nine fixture-owned badges remain visible.
  Desktop1440x1000 and phone414x896 at2x captures are preserved at full file
  resolution; no page error or horizontal overflow; controls meet44 CSS px.
- Actual Chrome exit0/null signal and HTTP close were observed, owned Node
  children closed and matching heavy markers released for both browser attempts.

Original raw outputs, failures and harnesses are losslessly archived under
`../receipts/achievement-collection-profile/receipt.json`. The earlier pure-model
checkpoint remains as historical evidence; this slice adds exact sorting and UI.

## Visual review and remaining scope

This is a usable collection layout, not final 2.0 badge/trophy art. Existing pixel
badge images, surrounding profile panels and oversized page heading remain. The
phone search placeholder is naturally clipped within its two-column control, but
its separate visible Search label remains readable. The desktop capture includes
an existing skip-link focus indicator. Custom badge materials/shaders, 3D trophies,
new earning definitions, reward migration, Locker and full profile redesign remain.

Browser fixtures are synthetic public data, not real player rarity or settlement.
The pagehide/pageshow check exercises actual browser controller handling with
dispatched lifecycle events; it does not claim an actual restored BFCache entry.
Phone viewport checks are not physical iPhone performance/soak acceptance. No full
release gate, production deployment or art sign-off is claimed.
