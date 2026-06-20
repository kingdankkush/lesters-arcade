# Hard Money Heroes — Level 1 Canon Reconciliation

Date: 2026-06-19
Cabinet: `lester-blaster`

## Decision

Level 1 is now **The Crypto Wasteland**, not the neon-city Underchain opener from the earlier v2 bible draft.

This is a reconciliation, not a fork:

- **Level 1** becomes the outer badlands before the city: desert flats, ghost towns, dry forests, rivers, lakes, mesas, salvage camps.
- **Level 2** inherits the neon-city / financial-core material that previously appeared too early.
- The city remains visible in Level 1 as the destination seam on the horizon.
- Persisted IDs, leaderboard keys, achievement IDs, and profile schema keys stay untouched.

## Old -> new level mapping

| Old draft slot | New canon slot |
| --- | --- |
| Level 1: The Slums / Underchain District | Level 1: Crypto Wasteland |
| Industrial foundry / scam-market opener content | Reframed as wasteland ghost-town, salvage, canyon, and roadside outpost content where possible |
| Financial District / penthouse city climb | Level 2: Litecoin City |

## Runtime implications

The runtime should use a **hybrid authored/procedural model**:

- **Authored macro layout**: district graph, road spine, rivers/culverts, city seam, POI spurs, landmark sightlines.
- **Procedural micro fill**: enemy spawns, elite composition, pickups, ambient props, and reusable filler between landmarks.

## Code/constants to watch

- `apps/portal/src/district-generator.mjs`
  - Level 1 belt families, route graph, POI metadata, branch lanes, city seam cues.
- `apps/portal/src/scene-templates.mjs`
  - Wasteland POI templates and their preferred template pools.
- `apps/portal/src/hmh-campaign-levels.mjs`
  - Campaign titles, macro layout data, POI specs, enemy roster, asset-library focus.
- `apps/portal/src/arcade-core.mjs`
  - Display strings and any legacy player-facing copy that still says slums/foundry for Level 1.
- `tests/district-generator.test.mjs`
  - Graph reachability, branch-lane, and POI expectations.
- `tests/hmh-campaign-levels.test.mjs`
  - Campaign metadata expectations.

## Approved Level 1 starter POIs

- Rugpull Gulch
- Dry Forest & Cave
- Old Hashrate Camp
- Oasis / Lakeside
- Mesa Overlook
- Crossroads Trading Post

## Non-goals of this reconciliation

- No deploy or public-branding changes.
- No real-funds changes.
- No persisted-ID migrations.
- No ranked/practice rule changes.
