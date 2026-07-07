# Hard Money Heroes Playtest Checkpoint 2

- Checkpoint ID: `wo107-level-one-checkpoint-2-v1`
- Seed: `1337`
- Scope: Full Level 1 world assembly and lighting pass acceptance tour across six approved biomes.
- Status: checkpoint-ready-verdict-open
- Six-biome route: `neon-city-core` → `industrial-yard` → `old-canal-riverfront` → `lakeside-park-old-growth` → `farmstead-outskirts` → `extraction-plaza`
- Route beats: `spawn`, `first-arena`, `arena`, `pressure`, `chokepoint`, `loop`, `breather`, `boss`, `extract`
- Placed objects: 135
- Micro-scenes: 12

## All-Biome Acceptance Tour

| # | biome | route beats | camera | expected families | lighting acceptance |
|---:|---|---|---|---|---|
| 1 | `neon-city-core` | `spawn`<br>`first-arena` | 4,5 ±18 | `buildings`<br>`critters`<br>`ground`<br>`poi`<br>`vegetation`<br>`vehicles`<br>`water` | dynamic lighting pass runs after world sprites and before bullets/HUD<br>vision fog remains above world art without hiding player, nearby enemies, or route cues<br>water edges stay readable under dusk tint and do not become black slabs |
| 2 | `industrial-yard` | `arena`<br>`pressure` | 10,5 ±18 | `buildings`<br>`critters`<br>`ground`<br>`poi`<br>`vegetation`<br>`vehicles`<br>`water` | dynamic lighting pass runs after world sprites and before bullets/HUD<br>vision fog remains above world art without hiding player, nearby enemies, or route cues<br>water edges stay readable under dusk tint and do not become black slabs |
| 3 | `old-canal-riverfront` | `chokepoint` | 62,6 ±18 | `buildings`<br>`critters`<br>`ground`<br>`poi`<br>`vegetation`<br>`vehicles`<br>`water` | dynamic lighting pass runs after world sprites and before bullets/HUD<br>vision fog remains above world art without hiding player, nearby enemies, or route cues<br>water edges stay readable under dusk tint and do not become black slabs |
| 4 | `lakeside-park-old-growth` | `loop`<br>`breather` | 78,5 ±18 | `buildings`<br>`critters`<br>`ground`<br>`poi`<br>`vegetation`<br>`vehicles`<br>`water` | dynamic lighting pass runs after world sprites and before bullets/HUD<br>vision fog remains above world art without hiding player, nearby enemies, or route cues<br>water edges stay readable under dusk tint and do not become black slabs |
| 5 | `farmstead-outskirts` | `loop`<br>`pressure` | 78,5 ±18 | `buildings`<br>`critters`<br>`ground`<br>`poi`<br>`vegetation`<br>`vehicles` | dynamic lighting pass runs after world sprites and before bullets/HUD<br>vision fog remains above world art without hiding player, nearby enemies, or route cues<br>landmark silhouettes stay readable under dusk tint |
| 6 | `extraction-plaza` | `boss`<br>`extract` | 92,6 ±18 | `buildings`<br>`critters`<br>`ground`<br>`poi`<br>`vegetation`<br>`vehicles` | dynamic lighting pass runs after world sprites and before bullets/HUD<br>vision fog remains above world art without hiding player, nearby enemies, or route cues<br>landmark silhouettes stay readable under dusk tint |

## Lighting Pass

- Dusk/noir dynamic lighting is required after world sprites and before bullets/HUD.
- Vision fog must preserve player, nearby threat, route-cue, and boss-readability silhouettes.
- Water and plaza edges must remain readable under tint; no black slab/checkerboard artifacts.

## Justin Verdict Gate

- Owner: Justin
- Status: open
- Blocks ship candidate: yes
- Prompt: Justin should approve Checkpoint 2 for Level 1 world assembly/lighting or request revisions before WO-113 ship-candidate skin lock.

## Verification Commands

- `node --test tests/hmh-wo107-checkpoint2.test.mjs`
- `npm run visual:regression`
- `npm run vercel:build`
