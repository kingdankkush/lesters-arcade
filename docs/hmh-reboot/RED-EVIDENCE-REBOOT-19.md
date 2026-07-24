# Red Evidence: Reboot 19

Generated: 2026-07-24T05:12:59Z

## Portal lifecycle

The first lifecycle regression run failed before `createHmhRebootPortalLifecycle` existed.

Evidence: `.tmp/reboot-19-portal-lifecycle-red.log`

The implemented lifecycle now synchronizes state and pause, finalizes game-over once, rejects duplicate/mismatched results, forwards achievements, uses canonical session identity, and tears down the adapter.

## Opening balance and roster

The opening balance test first failed before deterministic movement/attack grace existed.

Evidence: `.tmp/reboot-19-opening-balance-red.log`

The opening roster extension then failed before the initial population was restricted to the authored Bagholder Rusher and Forkrunner pair.

Evidence: `.tmp/reboot-19-opening-roster-red.log`

The opening-health extension failed before authored opening-only HP variants existed.

Evidence: `.tmp/reboot-19-opening-health-red.log`

The final policy holds enemy movement for 120 fixed ticks, attacks for 480 fixed ticks, and allows the opening pair to be defeated before full-strength director enemies enter.

## Point-blank projectile collision

The initial projectile-origin regression failed because the first collision sweep began at the muzzle and could skip a target between actor and muzzle.

Evidence: `.tmp/reboot-19-projectile-origin-red.log`

New projectiles now retain the actor origin as their previous point for the first authoritative sweep.

## Input focus and automatic aim

The focus regression failed before pointer interaction explicitly restored keyboard focus.

Evidence: `.tmp/reboot-19-input-focus-red.log`

The stale-pointer regression failed before idle manual pointer aim expired.

Evidence: `.tmp/reboot-19-pointer-expiry-red.log`

Pointerdown now focuses the game surface with `preventScroll`. Pointer aim expires after one second of inactivity, allowing automatic targeting to reacquire enemies while active pointer movement remains manual.

## Durable session feed

The persistence regression failed because saved `runHistory` restored profile progress but the Profile session feed read only in-memory `officialSessions`.

Evidence: `.tmp/reboot-19-session-feed-red.log`

The profile snapshot now merges and deduplicates persisted run history with richer in-memory official session records. Save/load tests verify restored Ranked-preview count, score, kills, and survival time.

## Release suite

The first revised release-gate run failed closed with:

- one missing ledger failure, because restored combat VFX converted a historical failure into a real pass;
- one unexpected shell assertion, because pause handling moved from inline portal code to the dedicated lifecycle module.

The retirement ledger was reduced from 53 to 52 exact failures. The shell contract now verifies `main → lifecycle.handleState → game:pause`. The final gate passed with 1,604 tests, 1,552 passes, exactly 52 ledger-matched failures, and zero unexpected failures.

## Edge visual capture

One Edge mobile-landscape run failed closed with 10,325 changed pixels. Visual inspection showed identical content; pixel analysis showed broad transient GPU raster variation, including 30 pixels above a one-channel delta. The tolerance was not weakened. A clean rerun passed, followed by a final isolated Edge certification in which all five anchors reproduced exactly. Chrome’s final isolated five-profile certification also reproduced every anchor exactly.
