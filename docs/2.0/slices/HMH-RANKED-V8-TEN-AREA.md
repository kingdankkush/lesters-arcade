# HMH-RANKED-V8-TEN-AREA — the ten-area world as Level 1, Free and Ranked (schema 8)

Branch `claude/201-ranked-v8`, based on the live 2.0.0 head `f044868ff`.

**Owner decision implemented:** the ten-area world (`ten-area-frontier`, map
version 2) is the default Level 1 for both Free Mode and Ranked from game
**2.1.0**. Every change is behind the game version: until the release commit
sets `GAME_VERSION` to 2.1.0, the child, the portal and the tests behave
exactly as 2.0.0 (the ten-area world stays the unofficial Free preview). No
site, game, cabinet or service-worker version was changed here; nothing was
deployed or pushed.

Old runs (schema 6 and 7 on `forked-frontier` v1) verify byte-identically
(§7). HMH Ranked stays plausibility-verified, not replayed.

## 1. The gate

`sdk/hmh-run-v8-build.mjs` (tiny, on the child's and portal's initial path):

- `HMH_RUN_SUMMARY_V8_MIN_GAME_VERSION = '2.1.0'`
- `isHmhV8GameVersion(version)`: numeric X.Y.Z compare
- `isHmhV8Build(buildHash)`: the `game-X.Y.Z` segment of the session build hash ≥ 2.1.0

The child reads its own `GAME_VERSION` (portal `version-tracking.mjs`) in
`world-context.mjs` (`HMH_TEN_AREA_LEVEL_ONE`); the portal reads the same in
`hmh-frontier-preview.mjs`; the server reads the session build hash.

## 2. Contracts: schema 8 and map v2

`sdk/hmh-run-summary-schema-v8.mjs` — `HMH_RUN_SUMMARY_CATALOGS_V8` and a
validator for schema 1–8 (schema 1–7 answered word for word by the v7
module):

| Catalogue | Schema 8 |
|---|---|
| `enemyRoles` | the 16 v7 roles: 6 legacy, the Liquidator, the six 2.0 archetypes (`rug-puller`, `pump-and-dump-bloater`, `tollkeeper`, `hodl-revenant`, `money-printer`, `oracle-marksman`), the three district bosses |
| `districts` + `districtAreas` | the ten areas of the world, by id, with their rects (pinned against the child) |
| `pointsOfInterest` | the ten `<area>-cache` sites |
| `objectives`, `worldSites` | `ten-area-meadows-relay`, `ten-area-woods-camp` (switch class) |
| `secrets`, `prisonerSlots` | empty (none on this map) |
| `bosses` | v7 order: Rug Pull Baron, Lockkeeper, 51% Foreman, Liquidator |
| `movementFields` | the movement row (below) |

Rules S1–S18 are the v7 rules over these catalogues, with two map facts:
`kills.boss` and `bossEngagedTick` still mean the Liquidator (S6, S7: the
achievements and the on-chain boss id keep their meaning), and
`progression.revivesUsed` must be 0 (S16: the only revive is the Golden
Parachute of a Dark Pool win; this map has no Dark Pool). S19 checks the
movement row's identities (an enter is a cover tick, a leave follows an
enter, a kill in cover is a kill, mantle and landing ticks are run ticks).

**Movement row** (HMH-COVER-TRAVERSAL-V1 §6, as proposed):
`rulesVersion` (`cover-v1+traversal-v1`), `coverTicks`, `coverEnters`,
`coverLeaves`, `coverKills`, `coverDamageReduced`, `mantles`, `drops`,
`mantleTicks`, `landTicks`.

`sdk/hmh-run-contract-v8.mjs` — frozen copies of every child value the
verifier bounds, each pinned by `tests/hmh-ranked-v8-contract.test.mjs`:

- **Run rules:** the v7 ones (director schedule, multipliers, combo, cache
  XP, silver, opening enemies, objective XP).
- **Threats** (`HMH_V8_ROLE_THREAT`): what the 2.1.0 child actually grants —
  the 2.0 enemies at their runtime rows' `costs.threat` (3/6/6/2/5/4, the
  balance sources' stats, not the v7 planning values), and **every boss at
  48**: main.mjs's one defeat block awards `LIQUIDATOR_THREAT_COST` to
  whichever boss is live (owner decision 1, §9).
- **Bosses:** courts in Hashwood River (Baron), Scrypt Bayou (Lockkeeper),
  Fork Fortress (Foreman), Litecoin City (Liquidator, bell only); v7 ready
  ticks (7,200 / 18,000 / 27,000 / 36,000) and silver bursts; a 300-tick
  minimum fight for every boss (intros ≥ 120 and two 90-tick halts; no Dark
  Pool start). The whole court lies inside its area (pinned).
- **Travel** (`HMH_V8_TRAVEL`): entry = the Meadows start (12,500, 6,700);
  15 edges = the 14 authored roads plus Meadows–River (the Meadows and River
  woods paths share a junction south of the Meadows without entering an
  area). The edge set is **re-derived from the child's ground** by
  `scripts/hmh-ranked-v8/derive-travel-graph.mjs` (walkable samples outside
  every area joined into regions, regions less than 100 units apart merged
  because a tick moves at most 96, blockers ignored → a superset of real
  passages) and pinned equal. `maxStepPx` 48 and `allowancePx` 480 as on
  v6/v7 (a drop moves 96 in one tick then locks six; a mantle 96 over 18).
- **Placements:** the child's ten-area collectible placements per effect (10
  area caches, 3 seeded events, 8 objective rewards whose legacy objectives
  this map never completes, the Liquidator vault), derived from the child in
  the test.
- **Movement rules:** `cover-v1+traversal-v1`, enter 6, mantle 18, land 6.

## 3. Child (2.1.0 behaviour; off at 2.0.0)

`world-context.mjs` selection with the gate on:

| Page | World | official | Ranked-eligible |
|---|---|---|---|
| no `world`, or `world=ten-area`, or anything unknown | ten-area | yes | yes |
| exactly one `world=legacy` and exactly one `mode=free` | forked-frontier | yes (schema 7, Free result) | **no** |
| `world=legacy` without exactly `mode=free` | ten-area | yes | yes |

`sessionAllowedForWorld`: a Ranked session on the ten-area Level 1 also needs
a 2.1.0+ session build hash (refused before play rather than rejected after);
the Free-only legacy world refuses every Ranked or rankedEligible session.
Gate off: the 2.0.x rules, unchanged (pinned with `tenAreaLevelOne: false`).

Recording: `createWorldV2RuntimeContext` builds the world with
`officialRun`/`rankedEligible` from the selection and, when official, a
`runSummary` module (`run-summary-v8.mjs`) with the same API names as
`run-summary-v7.mjs`. main.mjs adopts it through the existing `summaryV7`
seam (one assignment in the lazy loader, one in `adoptWorldContext`), so the
accumulator, the bridge validation, the finalize call and every pinned
literal stay as they were. Two null-guarded `tenAreaRun?.creditKill()` calls
count kills in cover. The accumulator (`sdk/hmh-run-summary.mjs`) for schema
8 takes the area from the hero's position (`districtAreas`; a road between
areas sets no bit), attributes each boss defeat to its own role from the
bosses rows (the shared defeat block records every boss under
`'liquidator'`), and copies the movement row. The movement run
(`world-v2-combat.mjs`) counts leaves, kills in cover and cover damage
reduction; nothing in the simulation reads them.

**Bug found and fixed:** the corpus crashed in a 51% Foreman fight —
`selectLightningLedgerChain` deep-froze its links (shallow copies of the
targets), freezing the live boss's `pendingEvents`/`pendingAttacks`, and the
boss's next step threw every tick. The legacy Liquidator has the same fault
in **live 2.0.0** whenever the Ledger chains onto him (reproduced in
`tests/hmh-ledger-boss-freeze.test.mjs`). Fixed by freezing the links
shallowly (`e4c1064ad`); values unchanged, so no run that did not throw can
differ.

## 4. Server

- `resolveHmhMapContext`: schema 8 from a v8 build →
  `{ mapId: 'ten-area-frontier', mapVersion: 2, schemaVersion: 8, validatePlausibility: validateV8RunPlausibility }`;
  schema 6/7 unchanged; schema 8 from an older build, unknown schemas and bad
  identities → null.
- `hmh.mjs`: Ranked accepts schema 6, 7, 8; schema 8 needs game ≥ 2.1.0
  (`run summary schema 8 requires game 2.1.0 or later`); the validator is the
  schema 1–8 module. `hmhBossResult(runSummary)` generalises the boss result:
  `bossesDefeated` lists every defeated boss (bosses rows on 7/8, the
  Liquidator on 6); `bossId` (the attestation and `verified_sessions.boss_id`)
  stays `boss-liquidator` when kills.boss counts him, else null, because it
  is the only HMH boss id the score registry and indexer know (owner
  decision 3).
- `server/verify/hmh-plausibility-v8.mjs` — `validateV8RunPlausibility`,
  modelled rule for rule on v7 (the v6/v7 module is untouched). Rejects:
  `build-predates-schema-8`, the run-time rejects, `level-xp-mismatch`, the
  four boss timing rejects, `kills-above-capacity`, the sixteen consistency
  mirrors with ten-area tables, `standard-kills-above-contacts`,
  `collectibles-above-capacity`, `node-xp-above-level`,
  `node-in-unvisited-district` (objectives and boss initiations),
  `district-path-invalid` (visited areas not connected in the travel graph
  through the Meadows), `districts-before-travel-time` (straight-line bound:
  every area's distance from the entry, and for every pair the nearer one's
  distance plus the gap between them), the movement rejects
  (`movement-rules-mismatch`, `cover-enters-above-cadence`,
  `cover-without-cover-ticks`, `mantle-ticks-mismatch`,
  `land-ticks-below-drops`) and the XP/score ceilings. Flags as v7.

## 5. Portal

- Host: forwards `world=<ten-area|legacy>` (+ `mode=free`) only for an
  unranked Free session; no request → the child's default.
- Mode select (`hmh-frontier-preview.mjs`): at 2.1.0 the "New Frontier
  (preview)" button becomes **"Play the original map (Free only)"** (title
  "Original map (Free only)"), requesting `legacy`. The preview copy
  (unfinished / unranked / no result / no share card) appears only on the
  2.0.x preview. A 2.1.0 ten-area or original-map Free run is an ordinary
  Free run: result screen, recap, history and the gore-free share card.
- The portal bridge, run history and achievement stats read the schema 1–8
  module.

## 6. Achievements

Stats map schema-8 rows through `hmhRunSummaryCatalogs(8)`: all 16 roles in
`killsByRole` (district bosses and 2.0 enemies), `districtsVisited` counts
areas, `bossKills` stays the Liquidator. `full-roster-run` unlocks for a
schema-8 run with all four bosses down and not for a Baron-only run;
`beat-level-1-boss` stays the Liquidator. **`world-escape` stays
unavailable**: the ten-area world has no exit and every verified HMH run must
end `defeated` (a `completed` schema-8 run is refused `run-summary-not-terminal`,
tested).

## 7. Evidence

**Real-child honest corpus v8** —
`tests/fixtures/hmh-honest-corpus/real-child-2.1.0-ten-area.json`: 43 runs of
the 2.1.0-labelled child (`HMH_HARNESS_RELEASE=2.1.0`, child source
`e4c1064ad`) on its default world under Ranked identities, all four heroes,
pilots in `scripts/hmh-honest-corpus/pilot-ten-area.mjs` (suicide, idle,
brawler, hunter, explorer, turtle, camper, cover, ledge, grenadier, and boss
seekers for each court). Results: see §7a. `node
scripts/hmh-honest-corpus/batch.mjs run|verify|export --ten-area` with
`HMH_HARNESS_RELEASE=2.1.0` reproduces it; the legacy plan and pilot are
untouched.

**Adversarial** (`tests/server-verify-hmh-v8.test.mjs`, forged from real
runs): district teleport (Meadows+Bayou, Meadows+Coast, Meadows+Ridge, no
Meadows, an eleventh bit) → `district-path-invalid`; all ten areas in fewer
ticks than the bound → `districts-before-travel-time`; Baron run without the
River bit, and a claimed Foreman kill without the Fortress →
`node-in-unvisited-district` (+ `boss-before-ready`); a 120-tick fight →
`boss-fight-too-short`; a revive → schema error; unknown, extra or missing
roles and legacy objective ids → schema errors (verification stops at
`run-summary-invalid`); score ×10 → `score-above-ceiling` /
`implausible-run`; movement forgeries → the movement rejects or S19; schema
8 under a 2.0.0 build → refused before plausibility.

**Legacy identity** (`tests/server-verify-hmh-v8-legacy-identity.test.mjs`):
329 stored runs (248 real-child summaries 1.8.3/1.8.4/1.9.0, 6 committed
Ranked fixtures with full `verifyRankedRun`, 75 model runs) through the v7
schema, the base schema, `validateRebootRunPlausibility` and the map context
hash to `0a7eec5e…4895`, the value taken on `f044868ff` before any change;
the schema 1–8 validator answers all 254 stored summaries exactly as the
schema 1–7 one.

### 7a. Corpus results

43 / 43 runs reach a schema-8 summary with 0 child errors and 0 invalid
bridge messages; 681,031 ticks in all (shortest 7,400, median 14,154,
longest 37,722). Every run verifies through `verifyRankedRun` (status ok);
plausibility: 39 `ok`, 4 `flagged` with the soft `kills-near-capacity` only
(t00, t01 suicide, t04 brawler, t19 turtle; 0.91–0.92 of capacity, the same
pattern as the 1.9.0 corpus), **0 rejected**. Coverage: all ten areas (one
run saw nine), all four heroes, all four bosses started (Baron ×4 incl. one
honest defeat at 9,012, Lockkeeper, Foreman, Liquidator at his bell), ten
roles killed (incl. Rug Puller, HODL Revenant, Oracle Marksman, Tollkeeper),
both machines, cover enters/kills, mantles and drops. Pinned digest
`e4474f1c…a8e1`.

**Legacy child identity:** the 16-run legacy sample
(`batch.mjs run --sample`) on a `git archive` of `f044868ff` and on this
branch: 16 / 16 runs identical in every emitted field (final tick and state,
errors, run events, score result, game-over, run summary, upgrade log, pilot
statistics, health, message counts).

## 8. Tests and bytes

- New: `hmh-ranked-v8-contract` (9), `hmh-ranked-v8-child` (7, incl. the real
  child headless), `hmh-world-option` (4), `hmh-ledger-boss-freeze` (2, RED
  before the fix), `server-verify-hmh-v8` (11), `server-verify-hmh-v8-corpus`
  (4), `server-verify-hmh-v8-legacy-identity` (2).
- Updated for intended 2.1.0 facts (each keeps its 2.0.x assertion with the
  gate off): `hmh-world-context`, `hmh-frontier-preview`,
  `hmh-world-v2-verifier-freeze`, `hmh-world-v2-gameplay`,
  `hmh-run-summary-v7-emission`, `server-verify-hmh-v7` (the unknown-schema
  message now names 6, 7 or 8), `server-verify-hmh-real-corpus-harness`.
- `node --test` over `server-verify-*`, `hmh-ranked-v8-*`, `hmh-world-*`,
  `hmh-frontier-preview`, `hmh-run-summary*`, `hmh-ten-area-*`, `hmh-boss-*`,
  `hmh-district-bosses`, `hmh-reboot-lightning-ledger`, `achievement*`,
  `ranked-*`, `hmh-reboot-host`, `hmh-run-history`, `hmh-run-recap`,
  `arcade-core`: 1,109 tests, 1,106 pass; the 3 failures are missing
  generated art assets (HD sprite atlas, final boss and Level 2 art packs)
  and fail identically without this branch's working changes.
- `node scripts/syntax-check.mjs`: passed (1,408 JS modules + 171 Python).
- `node build.mjs` (under the heavy lock): HMH entry 327,398 B; HMH initial
  JS 798,256 B; **HMH initial + shared 998,059 B** against the 1,048,576 B
  cap (50,517 B headroom). STACKED initial 581,120 B (unchanged).

## 9. Owner decisions

1. **District boss rewards.** The child awards every boss the Liquidator's
   threat (1,040 XP / 1,300 score before multipliers) because the shared
   defeat block uses `LIQUIDATOR_THREAT_COST`; the v7 plan said 560 / 720 /
   880 XP for Baron / Lockkeeper / Foreman. The v8 contract follows the
   child. Changing the child later needs a contract change in the same
   commit.
2. **2.0 enemy threats** follow their runtime balance sources (Rug Puller 3,
   Bloater 6, Tollkeeper 6, Revenant 2, Printer 5, Oracle 4), not the v7
   planning table (4/4/6/5/6/5).
3. **On-chain boss id.** A district boss defeat has no on-chain boss id
   (`BOSS_IDS` knows only the Liquidator); adding ids is a contract/indexer
   change outside this lane.
4. **Cached old child under a 2.1.0 portal.** A 2.0.x child (legacy map,
   schema 7) cached by the service worker under a 2.1.0 portal still
   verifies, as cached 1.8.x children do today. If Ranked must be ten-area
   only from 2.1.0, the server could refuse schema 7 from 2.1.0+ build
   hashes; stored runs (older builds) would be unaffected.
5. **Achievement copy.** "Visited all six Level 1 districts" (Getaway Clear,
   Hard Fork Hero) now counts any six of the ten areas; the text is pinned to
   the arcade-core parity list and was not changed.
6. **Travel bound** is the straight-line one (all ten areas ≥ 307 ticks); a
   geodesic bound over the walkable ground would be tighter but needs its
   own soundness margin.

## 10. Release-commit notes

Setting `SITE_VERSION`/`GAME_VERSION` to 2.1.0 turns everything on. The
tests do not pin the version: the 2.0.x rules are pinned with the gate off,
the 2.1.0 rules with the gate on, and the gate-dependent tests
(`server-verify-hmh-real-corpus-harness`, `hmh-world-option`) read it. The
legacy real-child harness (`batch.mjs` without `--ten-area`) runs the
default world, which at 2.1.0 is the ten-area one; reproduce legacy runs
with an older label.

## 11. Review follow-ups (independent review)

- **Stale tabs (required):** E15's deployed child schema follows the game
  version (8 from 2.1.0), so its HMH ticket minimum is 2.1.0 there and a
  2.0.x tab gets 409 `client-outdated` before paying (`9e8aaeea1`). The 2.1.0
  ten-area child also refuses a Free or Ranked session from a pre-2.1.0 build
  with `game:error client-outdated` and a reload message, so a stale portal
  never plays a run its v7 bridge would drop at game over.
- **Review hold:** HMH `nft: true` trophies are withheld from runs with a
  `*-near-ceiling`, `*-above-selected-upgrades` or `kills-near-capacity` flag
  and recorded as `pendingReviewAchievementIds` in the stored plausibility
  (`e7478a3c9`). Of the honest corpus, the 4 flagged runs would be held.
- **Spawnable roles:** `enemy-role-not-in-visited-areas` rejects kills of
  ordinary roles outside the visited areas' director pools, the opening pair
  and the Liquidator's adds (`bd7f3482d`); the corpus stays 43/43, the
  Tollkeeper relabel forge is refused.
