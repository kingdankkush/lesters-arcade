# Hard Money Heroes — Level 2: Litecoin City (World & Level Design Plan)

Status: design draft for the Level 2 authored world. Companion to
`hard-money-heroes-level-1-authored-world-plan.md` (Crypto Wasteland) and governed by
`hard-money-heroes-confirmed-decisions-2026-06-19.md`. Where this doc and the older
`hard-money-heroes-design-bible-v2.md` Act II material conflict on **run structure**,
the confirmed-decisions doc wins (see "Run-structure reconciliation" below).

Date: 2026-06-19
Cabinet: `lester-blaster`

---

## 1. Identity

Level 2 is **Litecoin City** — the modern / near-future metropolis that glowed on the
horizon as the destination seam throughout Level 1's Crypto Wasteland. The player has
crossed the badlands and now fights *into and through* the city itself.

- **Tone shift from Level 1**: open sun-bleached badlands → dense vertical city.
  Sand, salvage, and ghost towns give way to chrome, glass, neon, server-rack hum,
  ring-light glow, transit rails, and rain-slick rooftops.
- **Litecoin / Web3 flavor**: the city is the financial machine the wasteland was the
  wreckage of — DeFi, exchanges, validator towers, influencer culture, and old-money
  crypto wealth all rendered as real districts.

## 2. Entry handoff (from Level 1)

Per confirmed decisions #3:

1. Level 1 (Crypto Wasteland, ~8 min) completes via the extraction point — either the
   8-minute timed spawn or the early unlock (all mini-bosses + main boss, optional POI
   special items).
2. On completion → **Level 2 loading screen** (Justin to supply Level 2 background
   artwork). The loading screen is the seam between discrete levels, not a mid-run act
   transition.
3. Level 2 begins at the **city threshold** — the same skyline the player saw on the
   Level 1 horizon, now at street level.

## 3. District roster (authored macro)

Per confirmed decisions #1, the **world map, district layout, areas of interest, and
asset placement are all authored / hand-crafted**. Procedural is limited to enemy
spawns and power-up / item drops. Districts below are designed AOIs, not random scatter.

| District | Role / vibe | Signature landmarks (AOIs) | Hazards / traversal |
| --- | --- | --- | --- |
| **City Threshold** | Entry seam from the wasteland; outskirts → downtown ramp | Toll gate arch, on-ramp overpass, first neon strip | Tutorial-light reintroduction to denser cover |
| **Litecoin Plaza** | Central civic hub; the city's heart and crossroads | Central LTC monument/fountain, big-screen ticker wall, transit spokes | Open sightlines; ranged pressure; hub spokes to other districts |
| **Financial District** | Chrome/glass exchange towers, server-rack corridors | Exchange atrium, server-rack canyons, elevator edges, glass skybridges | Verticality cues, knockback edges, sterile cold-blue palette |
| **DeFi Harbor** | Waterfront docks, liquidity "pools", shipping/bridge motif | Harbor cranes, pier boardwalks, container stacks, the Bridge | Water knockback edges, dock gaps, tide/flood beats |
| **MimbleWimble Grove** | Luxury / old-money private neighborhood (privacy-coin pun) | Gated estates, hedge mazes, private vault villas, infinity pools | Tight authored sightline control; ambush hedges; "private" no-go zones |
| **Artisan District** | Creator / NFT / maker quarter; murals, galleries, studios | Gallery row, mural alleys, maker workshops, rooftop studios | Verticality via fire escapes; mixed-cover alley fights |
| **Parks / Green Belt** | Breather + connective tissue between dense districts | Central park, botanical dome, riverwalk, amphitheater | Open lanes, line-of-sight breaks, lower spawn density "valve" |
| **Penthouse Rain (seam to Level 3)** | Rooftop endgame approach; storm + ring-light glow | Rooftop tar fields, glass parapets, helipad, sponsored-post billboards | Open-air knockback edges, rain, wind cues; boss seam |

Connective model mirrors Level 1: an **authored spine** (Threshold → Plaza → district
loop → Penthouse seam) with **optional district spurs** off the Plaza hub, so the city
reads as a designed place with recognizable landmarks rather than generic fill.

## 4. Enemy & boss direction

Build on the existing v2 bible city roster (faithful, not a fork):

- **City enemies (from bible)**: Evil Banker, Crypto Bro, Bot Swarm, MEV Reaper,
  Phishing Angler, Slippage Skater, plus ranged/verticality-pressure archetypes.
- **Boss seam**: **Mr. NGMI — The Influencer** (ring-light KOL, rotating Sybil Drone
  shield, shill-beam sweep, "Going Viral" bullet-hell). Currently the Act II / Penthouse
  seam boss in the bible; he anchors the Level 2 → Level 3 handoff.
- Per confirmed decisions #4/#5: new enemy art should lean **human + animal** archetypes
  themed to Litecoin / blockchain / Web3 culture, with full sprite kits, telegraphed
  attacks, AI patterns, and balance (health/damage) tuned to the rest of the game.
- District-flavored elites are encouraged (e.g. Harbor → bridge-exploit/MEV themes,
  Grove → privacy/old-money guards, Artisan → counterfeit-NFT mimics).

## 5. Run-structure reconciliation (IMPORTANT — needs main-agent + Justin alignment)

There is a **structural conflict** between two canon sources that must be reconciled
before Level 2 is implemented:

- **`design-bible-v2.md`** models the whole game as ONE continuous 20-minute roguelite
  run with three *acts*: Act I Crypto Wasteland (0:00–6:30) → Act II Litecoin City
  (6:30–13:30) → Act III The Getaway / Mainnet Express (13:30–20:00), extraction at
  20:00. Litecoin City is an *act*, not a separate level.
- **`confirmed-decisions-2026-06-19.md` (#3)** models Level 1 as a **discrete ~8-minute
  level** with its own extraction point and a **loading-screen handoff** to a separate
  **Level 2 = Litecoin City**.

These are different containers (continuous act-based run vs. discrete level-by-level
campaign with loading screens). **The confirmed-decisions doc wins** per its own
precedence rule, so the intended direction is **discrete levels**. Open questions to
settle before build:

1. Does the 20-minute survival arc get **re-scoped into per-level timers** (e.g. ~8 min
   Level 1, a Level 2 city duration, etc.), or does Level 2 keep its own target length?
2. Where does **Act III / The Getaway (Mainnet Express)** land — folded into Level 2's
   Penthouse seam, or promoted to its own **Level 3**?
3. Do the **extraction / early-unlock** mechanics from Level 1 repeat per level?
4. Persisted IDs, leaderboard keys, achievement IDs, profile schema stay **untouched**
   (carried over from the Level 1 reconciliation lock).

> Recommendation: treat each level as its own bounded encounter with its own
> extraction, and promote The Getaway to Level 3, so the city is a full level rather
> than a mid-run act. Flagged here for Justin / main-agent confirmation rather than
> decided unilaterally.

## 6. Asset needs (for later art passes)

- Level 2 **loading-screen background** (Justin-supplied).
- City threshold / skyline approach matte (should match the Level 1 horizon seam).
- District landmark art per §3 (isometric, repo-local, manifest-ready before runtime).
- City enemy + Mr. NGMI sprite kits per §4.

## 7. Non-goals

- No deploy, branding, or real-funds changes.
- No persisted-ID migrations.
- This doc does not implement runtime — it is the authored world/level design plan that
  a later build slice (and the run-structure reconciliation above) will execute against.
