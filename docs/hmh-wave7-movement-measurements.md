# HMH Wave 7 movement and camera measurement

Date: 2026-08-06
Profile: canonical fixed step, 60 Hz, default movement and dash tiers

## Measured locomotion

| Metric | Result |
| --- | ---: |
| First-tick speed | 50 world units/s |
| Time to maximum 240 units/s | 6 fixed ticks (100 ms) |
| Maximum speed | 240 world units/s |
| Speed on first release tick | 173.333 units/s |
| Time from release to below 1 unit/s | 3 fixed ticks (50 ms) |
| Coasting distance after release | 5.334 world units |

The response is already inside the intended twin-stick envelope: fast acquisition, faster stopping, and bounded coasting. No gameplay-authority retune was made merely to create a change.

## Measured dash

| Metric | Result |
| --- | ---: |
| Active duration | 8 fixed ticks (133.33 ms) |
| Distance | 192 world units |
| Base cooldown | 600 fixed ticks (10 s) |
| Tier-1 cooldown | 480 fixed ticks (8 s) |
| Tier-2 cooldown | 360 fixed ticks (6 s) |

The base cooldown remains a build-progression lever. Wave 7 adds deterministic start, landing, and ready feedback without changing combat authority.

## Camera closure

- Velocity and aim look-ahead remain bounded by `maxLookAhead`.
- Boss framing adds an optional focus pull capped at 25% weight and 40% of the short viewport edge before weighting.
- The player remains the camera anchor.
- Shake remains render-only and cannot perturb pointer-to-world aim authority.

## Traversal forgiveness and feedback

- Swept traversal continues to prevent tunnelling through deep water and illegal elevation changes.
- Authored one-way drops retain their permissive directional edge behavior.
- Drop transitions now propagate deterministic `dropped` and `dropDeltaZ` authority so landing dust and audio trigger exactly once at the crossing tick.
