# Chikun's Escape upgrade backlog

Date: 2026-08-11
Release target: Chikun cabinet 0.4.0

## Shipping in this wave

1. **Progressive difficulty with no abrupt cliffs**
   - Tighten fork gaps and increase scroll speed gradually as forks are cleared.
   - Preserve the fixed 60 Hz deterministic replay contract and parent-issued Ranked seed.
   - Expose current difficulty, speed, and gap size in immutable snapshots.

2. **Near-miss skill bonus**
   - Reward precise flights that pass close to a fork edge without colliding.
   - Award each fork at most once and include near misses in canonical replay, result stats, bridge validation, profile run stats, and result UI.

3. **Stronger run feedback**
   - Show best combo and near-miss stats in the HUD/result card.
   - Add milestone callouts for fork streaks and near misses.
   - Add deterministic visual particles, impact flash, and light screen shake that never affect simulation.

4. **Better onboarding and accessibility**
   - Clarify controls and objectives before flight.
   - Add visible keyboard hints and a high-contrast safe-gap guide during the opening.
   - Honor parent reduced-motion settings for parallax, particles, shake, and flashes.
   - Keep all controls keyboard/touch accessible and preserve mobile containment.

5. **Input and lifecycle hardening**
   - Buffer one flap across zero-step render frames rather than losing rapid input.
   - Cap fixed-step catch-up at the repository-standard four steps.
   - Clear stale accumulated time after hidden-tab pause/resume.
   - Keep audio nodes bounded and close the audio context on disposal.
   - Pause animation work while disposed and preload/decode sprites before the run begins when supported.

6. **Audio polish**
   - Distinct bounded cues for flap, coin, fork pass, near miss, milestone, pause, and crash.
   - Resume suspended audio only after player interaction and respect mute/music settings.

7. **Production and cache/version closure**
   - Bump cabinet/runtime/manifest versions.
   - Update build-hash assertions, service-worker cache marker, precache coverage, and hosted smoke contracts.
   - Re-certify Free and Ranked desktop/mobile flows and exact parent replay verification.

## Future upgrades after this wave

- Daily seeded challenge and ghost/replay comparison.
- Additional obstacle families with deterministic telegraphs.
- Unlockable Chikun cosmetic trails and cabinet themes earned through achievements.
- Dedicated authored music loop and layered adaptive mix.
- Replay viewer with flap timeline and shareable local run cards.
- Optional practice modifiers such as slow training speed and visible collision bounds, excluded from Ranked.
- More achievements and long-form mastery medals.
- Seasonal score-board resets once authoritative verification/settlement policy is ready.

## Non-goals and safety boundary

- No wallet prompts or contract calls inside the child runtime.
- No on-chain deployment, settlement enablement, fee changes, or authority migration.
- Free Mode remains isolated from Ranked profile and leaderboard writes.
- Visual effects remain projection-only and cannot change canonical collision or scoring.
