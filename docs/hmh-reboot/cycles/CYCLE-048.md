# HMH AAA Continuous Improvement Cycle 048

Date: `2026-08-02`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `52499502` (Cycle 047 closeout; production promoted)

## Scope: review hotfix + movement-smoke root cause

### 1. Mobile SWAP trap (review BLOCKER on the live Cycle 047)

The 047 auto-fallback bounced any selected-but-exhausted weapon back to the
pistol next tick; with SWAP as the only mobile switch, cycling restarted
from the pistol and re-picked the exhausted weapon — every LATER slot
became unreachable until a refill. Fix: `weaponSelectable` — cycling and
direct slots skip weapons with no clip and no reserve (the pistol is always
selectable). Source-guarded test.

### 2. Launcher declaration truthed to the grenade it fires

Cycle 047 raised satoshi-frag to 34/150 but the launcher's declared
weapon-system record still said 14/92 — an undeclared 2.4× gap between the
benchmark/HUD description and live detonations. The declaration now mirrors
the authoritative grenade definition (guarded by a test that compares them),
the shaped-charge capstone widened 128 → 210 so it stays a capstone above
the new base, and the weapon benchmark was regenerated.

### 3. Movement smoke: real root cause found and isolated

The intermittent "hero kept moving after the touch ended" failure was NOT a
dropped input (the Cycle 047 touchend guard stays as hardening): the player
is a combat target even under evidence-safe (damage blocked, knockback
NOT), and since Cycle 043 enemies actually path to a stationary hero — a
melee shove landing inside the measurement window flipped the assertion on
whichever profile lost the timing race. Two harness fixes: `settle` now
waits for observed stillness (two stable 150 ms samples, bounded) instead
of a fixed 450 ms; and the smoke spawns via `worldTour=mining`, ~7,900
units from the opening enemies, isolating movement mechanics from combat —
the same tour-spawn pattern the combat smoke uses. 3/3 consecutive passes.

### Follow-ups recorded

- The performance smoke's heap-delta assertion is high-variance (observed
  −32 MB to +38 MB on near-identical builds; budget 24 MB) — it should
  force a GC before sampling or take a median-of-N. Until then treat
  isolated heap failures as re-run-once signals, never re-run-until-green.
- Knockback applying to an evidence-safe (invulnerable) player is intended
  feedback but worth an explicit design note in the combat contract.

## Gates

- weapon suites green incl. 2 new guards; ledger `1,845 / 1,793 / 52 / 0`
- visual 8/8; certification five profiles; combat + collectibles smokes
- mobile controls 3/3 consecutive with the isolated harness
- performance PASS ×2 (bundle `1,040,213 / 1,050,000`, p95 7 ms)

## Production promotion and verification incident (2026-08-02)

Promoted `f702bb47` → `dpl_2iXBUqq2F1i9PAAE5NJu3FBdwPTY`
(`lesters-arcade-ibu2j9z69`). During verification the public alias began
returning 403 for ALL automated clients (curl, headless certification) —
this was Vercel's **Security Checkpoint** bot challenge (most likely
auto-triggered by the day's heavy automated certification traffic), not an
outage: the site renders normally in a real browser. Before identifying
that, a precautionary rollback to the 047 deployment was performed and then
reversed; final production is the 048 deployment.

Live verification was therefore performed through a REAL browser: the
portal renders, and the HMH runtime boots to a ready session (pistol 8/8,
3 grenades, 100 HP, HUD/minimap live) on <https://lestersarcade.io>.
Byte-hash comparison and headless live-certification are BLOCKED at the
edge until automation access exists.

**Owner action item:** add a Vercel Protection-Bypass-for-Automation secret
(or review the checkpoint setting) so CI certification can run against
production again. Security settings were deliberately not changed from this
environment.

Rollback remains the 047 deployment (`h4s9ihqe9`).
