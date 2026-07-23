# Encounter Director and Liquidator Boss

Status: deterministic prototype runtime complete; production enemy and boss art remains gated to later art phases.

## Encounter director

The director in `apps/hmh-reboot/src/encounter-director.mjs` is a pure fixed-tick system. It uses no wall clock or random sampling.

### Legacy cadence and progression remap

The reboot preserves stable gameplay semantics from `apps/portal/src/hmh-campaign-levels.mjs`, `hmh-authored-setpieces.mjs`, `hmh-long-run-simulator.mjs`, and the old `arcade-core.mjs` schedule without inheriting the retired renderer, animal/mech proxies, or child authority.

| Existing contract | Reboot mapping |
|---|---|
| Authored main spine, shoulder loops, and optional POI spurs | Six sequential reboot districts with authored routes; optional POIs must telegraph risk/reward before commitment and reconnect cleanly. |
| POI miniboss, reward cache, rest/hub, and skip-versus-commit beats | Elite reservations and five-minute near-POI rest windows; reward/pickup authority remains deferred to the progression phase. |
| Desert approach and orientation | Frontier Relay opening/build bands. |
| Ghost-town pressure | Rugpull Ravine pressure lanes. |
| Country road, water crossing, and forest detours | Liquidity Crossing and Hashwood traversal/combat gates. |
| Old hashrate camp and ranged salvage pressure | Mining Camp elite band. |
| Inner-city threshold and major-boss beat | Liquidation Yard and the 20-minute Liquidator band. |
| 5/10/20/30/45-minute long-run checkpoints | Exact 5/10/20/30-minute director snapshots now; 45 minutes remains an endurance certification checkpoint. |
| Repeated old mini/major beats at 210/510/690/870/1050/1230/1410/1590 seconds | Retired as repeated boss recycling. Their alternating pressure rhythm maps to future authored POI/elite moments; one full Liquidator encounter begins at 1,200 seconds. |
| Old animal/mech enemies | Retired. Only readable role mechanics map into the six approved human/zombie archetypes. |
| XP, pickup, upgrade, score, and build-profile progression | Preserved as future content contracts only. The director does not own or emit those authoritative outcomes. |

### Pacing bands

| Band | Fixed ticks | Run time | Body | Threat | Ranged | Projectiles | Effects | Full AI | Animated | Attack tokens M/R/A/S | Reserved |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Opening | 0-3,599 | 0-1 min | 32 | 64 | 4 | 64 | 96 | 24 | 32 | 2/1/1/0 | none |
| Build | 3,600-17,999 | 1-5 min | 64 | 128 | 8 | 96 | 128 | 28 | 40 | 3/2/1/1 | 2 elite bodies |
| Pressure | 18,000-35,999 | 5-10 min | 100 | 240 | 16 | 128 | 160 | 32 | 48 | 4/3/2/1 | 4 elite bodies |
| Elite | 36,000-71,999 | 10-20 min | 128 | 360 | 20 | 160 | 192 | 32 | 56 | 5/4/3/2 | 8 elite bodies |
| Boss | 72,000-75,599 | 20-21 min | 128 | 512 | 18 | 192 | 256 | 40 | 64 | 3/3/3/2 | 8 elite bodies, one boss plus add space |
| Endurance | 75,600+ | 21+ min | 160 | 640 | 28 | 220 | 320 | 32 | 64 | 6/5/4/2 | 16 elite bodies and one boss body |

Body, threat, ranged, projectile, effect, attack-token-family, full-AI, and animation budgets are independent. Ordinary spawns cannot consume elite or boss reservations. The 5, 10, 20, and 30-minute snapshots are fixed test fixtures.

### Spawn safety

Only authored spawn points are candidates. Every attempted insertion must pass all of these checks:

- correct district and authored region;
- outside the active camera bounds;
- outside the protected hero radius;
- not inside collision blockers;
- not in deep water or illegal elevation deltas;
- connected to an authored route;
- inside independent body, threat, and ranged budgets.

Rejected placement does not advance the spawn schedule, consume a stable ID, or burn the ordinal. Successful insertion uses the exact validated point. Five-minute POI rest windows suppress ordinary pressure only when the player is near a reward POI.

District role gates are deterministic. If a requested role is unavailable in the current time band, telemetry preserves the requested role and reports `band-gated-role`; it never falsely claims the fallback was applied.

## Liquidator boss

`apps/hmh-reboot/src/liquidator-boss.mjs` defines a 3,600-tick, one-minute target fight with a 12,000-health prototype boss.

### Concept selection

Three gameplay-first options were considered:

1. **The Liquidator:** a colorful corporate executioner using market-crash lanes, liquidation zones, margin-call dashes, and bad-debt zombie adds. **Selected** because all six attacks communicate through simple ground geometry and reuse the approved human/zombie direction.
2. **Rug Pull Baron Reboot:** a larger showman built around disappearing floor strips and deceptive arena pulls. Retained for a future alternate boss or skin because its floor-removal identity depends on the authored boss arena phase.
3. **Margin Reaper:** an abstract spectral debt collector using scythes and orbiting ledgers. Rejected for Level 1 because the silhouette and vocabulary drift from the grounded colorful corporate/human cast.

This selection is a prototype gameplay concept, not final production art approval.

### Phases

| Phase | Fixed ticks | Arena state |
|---|---:|---|
| Market Open | 0-1,199 | open arena |
| Margin Spiral | 1,200-2,399 | closing arena |
| Forced Liquidation | 2,400-3,599 | volatile arena |

Six primitives are scheduled in stable order: crash lane, liquidation zone, debt collection, margin-call dash, bad-debt summon, and short-squeeze burst. Two supers, circuit breaker and total liquidation, use explicit safe-circle geometry. Add waves and arena changes are bounded scheduled events.

The frozen boss readability reservation is four animation layers, four simultaneous telegraphs, 24 active effects, six audio voices, and six active adds. These are hard design ceilings for later art/audio integration, not permission to exceed the director's global boss-band caps.

Every damaging resolution reuses the geometry captured by its visible tell. Targets are locked when the tell begins, so movement after the tell is a real dodge. Support add events deal no direct damage. Boss events are capped at eight per fixed tick.

The boss pressure body is `kind: "boss"`, radius 56, with an 84-unit separation radius and deterministic tangential escape. The runtime consumes the pressure resolver's allowed velocity, preventing hard pin traps.

### Authority boundary

Boss damage flows through the canonical child combat resolver. A boss defeat emits exactly one `game:run-event` with `eventType: "boss-defeated"`. It does not emit score, wallet, contract, settlement, persistence, achievement, or analytics authority. Player game-over remains the existing exactly-once `score: 0` boundary.

## Evidence

- Director/boss contract tests: 19/19.
- Shell/director/boss slice: 27/27; load-speed slice: 18/18.
- Reboot-focused suite: 230/230.
- Full suite: 1,517 total = 1,464 passing plus exactly the existing 53 retired-art ledger failures; zero skipped/cancelled/todo and no new failure file.
- Security: audit 5/5 with zero findings; sandbox security 3/3.
- Production build, sequential load, and strict repository health: PASS.
- Thirty-minute director soak: two deterministic runs equal at SHA-256 `23fbb5d02e663f5ac50266e954d86992bdd648f9b25ffea46daaae2a37722695`; 107 stable unique insertions and 107 simultaneous bodies; 793.097 ms total for both runs.
- One-minute boss soak across 60/30/20 render partitions: equal SHA-256 `d3ba341820209c5a088d403357beb93405a26da89673bc460c8ddec316efa896`; 32 events, zero drops, 12.753 ms total, and +368,312 heap bytes for the combined director/boss soak process.
- DPS simulations: no-hit survives at 12,000 health; normal defeats at tick 3,000; high DPS at tick 600; low DPS times out with 4,800 health.
- Desktop and mobile browser smoke: PASS.
- Browser telemetry: desktop reached eight enemies after two exact director insertions; mobile reached seven after one; all six archetype IDs were represented; enemy and boss tells were observed; boss active in `market-open` with 12,000 health; zero enemy or boss event drops; zero console/page errors.
- Desktop and mobile screenshot review: PASS after on-screen debug-only boss placement and mobile HUD safe-area correction.

Debug query flags only accelerate evidence setup. Normal runtime starts the director at tick 600 and the boss at tick 72,000. Production spawn timing and boss location are not changed by evidence flags.
