# HMH AAA Continuous Improvement Cycle 047

Date: `2026-08-02`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `0d8b7a77` (Cycle 046)

## Scope: owner playtest round 2 — combat feel and input trust

Four items from the 2026-08-02 owner playtest, one reviewed packet.

1. **Empty-weapon auto-fallback (SIMULATION)** — the owner ran a shotgun
   dry and was stranded weaponless until death. `stepWeaponLoadout` now
   hands control back to the always-owned pistol the moment the active
   finite-reserve weapon has no clip, no reserve, and no reload in flight,
   emitting a deterministic `weapon:auto-fallback` event exactly once.
   RED-first (2 tests): fallback fires and is deterministic; the pistol
   itself reloads instead of falling back. Desktop swap audit: Digit1-4
   slot selection already exists; discoverability rides the future
   controls-help cycle.
2. **Aim reticle replaces the aim line (projection)** — no more line from
   the hero. Pointer aim draws a crosshair reticle at the cursor (OS cursor
   hidden over the stage); gamepad/touch aim draws the same reticle at the
   projected aim point. Color still answers fire state.
3. **Grenades hit much harder (SIMULATION + parent design record)** —
   `satoshi-frag` damage `14 → 34` (one-shots ordinaries in the blast),
   blast radius `92 → 150`, knockback `32 → 56`, in both the child
   definition and the parent `arcade-core` design record; the blast-warning
   telegraph and VFX scale automatically from the authoritative values.
   Grenades stay scarce (3 charges) so this is a tactical peak, not spam.
4. **Touch-release ground truth (input hardening)** — chasing a mobile
   smoke failure ("hero kept moving after the touch ended") exposed that
   stick release depended entirely on pointer events; a dropped synthesized
   `pointerup` latched the stick forever. `TouchControlState.endAllPointers`
   plus window `touchend`/`touchcancel` listeners now release every engaged
   control whenever the platform reports zero remaining touches. The smoke
   failure that had become intermittent on iphone-13-portrait passes
   repeatedly with the guard; the same defect class on real devices (the
   worst possible mobile experience) is closed permanently.

Replay note: items 1 and 3 are simulation changes — pre-047 replays diverge
under 047 playback. Determinism within the build is unchanged and covered
by the deterministic traces in the weapon and grenade suites.

## Gates

- check 337+49; weapon suites 37/37 (2 RED-first fallback tests); grenade
  suites 13/13; input 19/19 (RED-first release guard)
- test:release `1,843 / 1,791 / 52 / 0`
- visual regression 8/8
- browser certification five profiles; combat/collectibles smokes PASS
  (grenade warning-radius locks updated 92 → 150)
- mobile controls 4/4 twice consecutively after the release guard
- performance p95 `7 / 7.1 ms`, bundle `1,040,127 / 1,050,000`
