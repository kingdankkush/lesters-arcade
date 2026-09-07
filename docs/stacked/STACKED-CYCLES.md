# STACKED — Phased implementation plan

Implementation authority for **sequencing**. This document owns what lands, in what order, with which
tests written first, and what "done" means for each slice.

It does **not** restate mechanics, visuals, portal wiring, integrity, mobile, versus, or gate design.
Those live in `docs/stacked/spec/` and are cited by path. It does not restate a single name or
constant either: every one of those is frozen in `docs/stacked/STACKED-CONTRACTS.md`, which wins over
this file and over every spec document.

House style: `docs/hmh-reboot/AAA-ROADMAP.md` §7 (dependency-ordered phases, owner gates, risk
register) plus `docs/hmh-reboot/cycles/CYCLE-072.md` (one bounded slice, one ledger entry, numbered
scope, runtime evidence, verification list, honest note, boundaries). Every cycle below is one such
entry, with its ledger at `docs/stacked/cycles/CYCLE-0NN.md`.

---

## 0. Current state — read this first

**Nothing is implemented. No STACKED code exists in this checkout.**

| Thing | State as of `ff2934db` (2026-09-05) |
| --- | --- |
| `apps/stacked/` | Does not exist. |
| `apps/portal/src/stacked-*.mjs` | None exist. Not one module. |
| `apps/portal/games/stacked/` | Does not exist. No manifest. |
| `ARCADE_GAMES`, the app shell, `REGISTERED_GAMES`, both router tables | **No STACKED entry.** The cabinet does not exist to the portal in any form, behind any flag. |
| `tests/stacked-*.test.mjs` | None exist. |
| `vercel.json`, `apps/portal/sw.js`, `build.mjs` | Untouched by STACKED. No `/stacked/` CSP block, no precache entry, no build target. |
| Cabinet art, achievements, leaderboard columns, seeds, replays | None. Zero rows anywhere. |
| `docs/stacked/` | **Docs only, and currently untracked.** `STACKED-CONTRACTS.md` (frozen), `spec/*.md` (seven design documents), this file. S-01 commits them. |

**The first cycle to pick up is S-01.** Do not start S-02 or anything on tracks B or C until S-01's
constants module and its duplicate-declaration scan are green **and `docs/stacked/DECISIONS.md` exists
with all nineteen §6 owner gates opened** — that file is where every cycle writes a blocked gate before
stopping, and it is a different file from the repo-root `DECISIONS.md` the ship cycle appends narrative
entries to.

The word `stacked` occurs in the tree today only as ordinary English prose and as asset keys
(`interior/stacked-boxes` and similar) — never as an id, slug, storage key, or route segment. See
`docs/stacked/STACKED-CONTRACTS.md` §3 for the full collision check.

**Nothing in this plan proposes paid entry, a non-zero `entryFeeMicroUsdc`, settlement activation,
contract deployment, or a production promotion.** Those require a separate explicit HALT approval
naming the exact action and candidate.

---

## 1. Non-negotiables carried into every cycle

Inherited from `AGENTS.md` and `docs/hmh-reboot/AAA-ROADMAP.md` §1.1.

- Fixed 60 Hz simulation, maximum four catch-up steps. Same-seed determinism and replay integrity.
- Art, interpolation, particles, shaders, audio, animation LOD and quality tiers are
  **projection-only** and may never change collision, RNG, spawning, scoring, evidence, or results.
- The parent owns wallets, profiles, leaderboards, analytics, canonical sessions, seeds and
  settlement. The child never requests a wallet, never signs, never sends a transaction, never writes
  parent persistence, never grants an achievement, never replaces the parent-issued seed.
- Free Mode never advances Ranked progress.
- `SETTLEMENT_LIVE = false`; `entryFeeMicroUsdc` stays `DEFAULT_ENTRY_FEE_MICRO_USDC` (`0`);
  `devWallet` stays `null`. No cycle below changes any of these.
- Bridge messages stay ≤ `65,536` bytes, measured as
  `new TextEncoder().encode(JSON.stringify(message)).byteLength`.
- Every new `.mjs` — source **and** test — is appended to `NODE_CHECK_FILES` in
  `scripts/syntax-check.mjs`. That list is hand-maintained and un-globbed; an omission escapes
  `npm run check` **silently**, including inside `vercel:build`.
- **No `t.skip()`, `{ skip: true }`, or `todo` in any STACKED test.** `test:release` fails the
  aggregate on a single one, and no STACKED test may ever be added to
  `docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json`.
- Any runtime, asset, routing, CSP, service-worker or release-harness change creates a new deployment
  candidate requiring fresh certification. **Never run two browser gates in parallel**, including
  across two cycles on one machine.
- Work branches from the certified continuation branch (`reboot/hmh-aaa-continuous` or a branch from
  it). Never land on `main`.
- The trademarked genre name, and the trademarked term for a four-line clear, appear in no shipped
  string: not in `gameId`, `seasonId`, achievement ids, evidence/protocol version strings, flag codes,
  particle preset ids, asset filenames, or UI copy.

**The freeze rule.** Nothing from S-02 onward may re-open a contract in
`docs/stacked/STACKED-CONTRACTS.md` without a `STACKED_CABINET_VERSION` bump and an explicit note in
the cycle ledger. `cabinetVersion` feeds `buildHash` feeds the derived session seed
(`apps/portal/src/arcade-core.mjs:5234-5236`), so a contract change **rotates every seed and retires
the season's stored replays**. That is correct behaviour and it is stated policy.

### 1.1 Verified harness facts the cycles depend on

Checked against this checkout; re-verify if a cycle behaves unexpectedly.

- `npm test` is `node --test tests/*.test.mjs tests/projectile-pool.test.mjs`. New
  `tests/*.test.mjs` files need no `package.json` change.
- `vercel:build` is `assets:hmh:curated-level-kit-runtime && assets:verify && test:release && check &&
  contracts:check && build` — Node-only, no browser. Keep it that way (G-13).
- `test:soak` is **30 minutes**, not 40. A 40-minute STACKED soak is a new script.
- `visual:responsive`, `smoke:portal`, `smoke:portal:interactions`, `smoke:portal:e2e`,
  `smoke:chikun:ranked`, `design:security-audit`, `design:third-party-security`,
  `design:integrity-bounds`, `design:tokens`, `repo:health:strict`, `docs:cabinets`, `docs:links`,
  `assets:verify`, `contracts:check` and `ship:gate` all exist as named.
- The portal's catch-all CSP block already carries `worker-src 'self' blob:`, so the parent-side
  verification Worker needs no CSP change. The catch-all also sets `frame-ancestors 'none'`, which is
  why the `/stacked/(.*)` block and the catch-all lookahead extension are **both mandatory in one
  commit** (S-11).

---

## 2. Cycle map

| ID | Title | Size | Track | Blocked by | Parallel-safe with |
| --- | --- | --- | --- | --- | --- |
| S-01 | Contract freeze and identity spine | M | — | — | nothing (spine) |
| S-02 | Deterministic core I — board, pieces, rotation, bag, hold, gravity, lock delay | L | A | S-01 | S-06, S-07 |
| S-03 | Deterministic core II — clears, scoring, rising ledger, top-out, result tuple | L | A | S-02 | S-06, S-07, S-08 |
| S-04 | Input codec, evidence chunking, deterministic re-simulation | L | A | S-03 | S-08, S-09, S-11 |
| S-05 | Difficulty model artifact and the soak pilot policy | M | A | S-03 | S-09, S-11, S-12 |
| S-06 | Cabinet registration behind `?devCabinets=1` | M | B | S-01 | S-02, S-03 |
| S-07 | Leaderboard engine hygiene — `compareRows` + `pruneCadenceLeaderboards` | S | B | S-01 | anything |
| S-08 | Run summary schema and the `runStats` projection | M | B | S-01, S-03 | S-04, S-11 |
| S-09 | `game-stat-schema.mjs` extraction — HMH and Chikun first, no visual change | L | B | S-06, S-07, S-08 | **land alone** |
| S-10 | Run-verifier registry and achievement scoping | M | B | S-09 | S-12, S-13 |
| S-11 | Build, CSP, service worker, child shell | M | C | S-01 | S-04, S-08 |
| S-12 | Renderer skeleton — layers, board view, pure layout, root fit | L | C | S-02, S-11 | S-08, S-09 |
| S-13 | Zones, backdrop, particles, quality tiers, flash limiter | L | C | S-12 | S-10, S-15 |
| S-14 | Audio-reactive pipeline and the projection firewall proof | L | C | S-13 | S-15 |
| S-15 | Mobile layout, touch, gamepad, haptics, thermal governor | L | C | S-12 | S-13, S-14 |
| S-16 | Bridge, host, lifecycle — **Free Mode playable behind `?devCabinets=1`** | L | — | S-04, S-06, S-11, S-12 | S-17 |
| S-17 | Player settings and the cabinet settings registry | M | — | S-16 | S-18 |
| S-18 | Ranked integrity — plausibility gate, replay claim, verified stamp, trust column | L | — | S-04, S-10, S-16 | S-19 |
| S-19 | Achievements — 16 definitions, resolver, badge atlas, Free medal shelf | M | — | S-10, S-18 | S-20 |
| S-20 | STACKED leaderboard columns and profile surfaces | M | — | S-09, S-18 | S-19 |
| S-21 | Gate build-out — visual regression, performance smoke, soak, security sweep | M | — | S-13, S-14, S-15, S-16 | S-19, S-20 |
| S-22 | **Ship gate** — flip to playable, enable Ranked writes | S | — | all | none |

The manifest `status` stays `coming-soon` and the app-shell `playable` stays `false` from S-06 through
S-21. **Only S-22 flips them**, under owner gates G-1, G-2 and G-3.

The dependency spine in one line:
**pure sim → codec/replay → portal registration → build/shell → rendering → audio reactivity →
bridge/lifecycle (Free playable) → integrity → leaderboard/profile/achievements → gates → ship.**

---

## 3. The cycles

### S-01 — Contract freeze and identity spine

**Goal:** turn `docs/stacked/STACKED-CONTRACTS.md` into one frozen, machine-checked constants module,
so no later cycle can invent a second value for anything.

**Files**
- new `apps/portal/src/stacked-contracts.mjs` — the single frozen source for every constant in
  `STACKED-CONTRACTS.md` §2, plus the identity strings of §3 and the `terminalReason` enum of §1.3.
  **Imports nothing.** Nothing else in the tree may declare any of these.
- new `apps/portal/src/stacked-cabinet.mjs` — stub exporting `STACKED_CABINET_VERSION = '0.1.0'` only.
  It **must not import `arcade-core.mjs`**: a back-import through a module loaded during
  `arcade-core`'s own evaluation makes the constant read `undefined` on the `ARCADE_GAMES` entry.
- commit the currently-untracked `docs/stacked/STACKED-CONTRACTS.md`, `docs/stacked/STACKED-CYCLES.md`
  and `docs/stacked/spec/*.md`.
- new `docs/stacked/DECISIONS.md` — the §6 owner-gate list, each marked open, each with its exact ask.
- new `scripts/write-stacked-contracts.mjs` emitting `docs/stacked/contracts.json`.
- changed `scripts/syntax-check.mjs`, `package.json` (one script: `design:stacked-contracts`).

**RED tests first**
- `tests/stacked-contracts.test.mjs`
  - every export is deeply frozen, and `STACKED_GRAVITY_Q16` is a frozen plain array, **not** a frozen
    `Int32Array` (`Object.freeze` throws `TypeError` on a typed array with elements);
  - the committed `docs/stacked/contracts.json` is byte-identical to a fresh derivation — precedent
    triple is `scripts/write-hmh-integrity-bounds.mjs` / `docs/security/hmh-integrity-bounds.json` /
    `tests/hmh-integrity-bounds.test.mjs`;
  - the action bit order equals the frozen table (`moveLeft`, `moveRight`, `softDrop`, `hardDrop`,
    `rotateCW`, `rotateCCW`, `rotate180`, `hold`) and `STACKED_ACTION_COUNT === 8`;
  - `STACKED_TERMINAL_REASONS` is exactly the five frozen values, in order, frozen;
  - `STACKED_MAX_EVIDENCE_CHUNKS * STACKED_EVIDENCE_CHUNK_RAW_BYTES > STACKED_MAX_EVIDENCE_BYTES`
    (33 × 42,000 = 1,386,000 > 1,302,000), so envelope rounding can never make a legal stream illegal;
  - the ceiling-ordering proof: `STACKED_MAX_EVIDENCE_BYTES / STACKED_MAX_TICKS` (3.014) exceeds the
    3-byte worst-case record, therefore `'tick-ceiling'` always fires before `'evidence-ceiling'`;
  - `STACKED_MAX_INPUT_TRANSITIONS === STACKED_MAX_TICKS`;
  - `STACKED_EVIDENCE_CHUNK_RAW_BYTES % 3 === 0` and `_B64_CHARS === RAW * 4 / 3` exactly;
  - a **`grep`-style duplicate-declaration scan**: no second declaration of any frozen constant name
    exists under `apps/`, `sdk/`, `scripts/` or `tests/`;
  - `STACKED_ENTRY_JS_CAP` and `STACKED_INITIAL_JS_CAP` are `null`, and `assertStackedJsBudget` throws
    `Error('STACKED_ENTRY_JS_CAP has no measured baseline yet')` — a readable failure, not the
    `TypeError` `safeByteCount()` would raise.

**Acceptance bar**
- Exactly one value per contract row, exported from exactly one module, duplicate-declaration scan
  passing.
- `docs/stacked/DECISIONS.md` opens with the §6 owner-gate list, each marked open, with the exact ask
  and what it blocks.
- The seven spec documents in `docs/stacked/spec/` are committed **as-is**, with a header line on each
  stating that `STACKED-CONTRACTS.md` overrides it wherever they disagree. Corrections to their text
  are follow-up work, not S-01 work.

**Verification:** `npm run check` · `npm test` · `npm run docs:links` · `npm run test:release`

**Size: M.** Small in bytes, large in consequence. The adjudication is already done; this cycle makes
it enforceable.

---

### S-02 — Deterministic core I: board, pieces, rotation, randomizer, hold, gravity, lock delay

**Goal:** a pure, DOM-free, integer-only simulation that places a piece identically on every engine,
before anything can render it.

Spec: `docs/stacked/spec/mechanics.md` §1–§5. Constants: `STACKED-CONTRACTS.md` §2.1, §2.3.

**Files**
- new `apps/portal/src/stacked-sim.mjs` — `createStackedRuntime({ seed, maxTicks, config })` returning
  a frozen `{ step, snapshot, stateHash, result, get terminal }` (the `createChikunRuntime` contract,
  including a `step` that throws once terminal). Board geometry, `PIECE_CELLS` / `SPAWN_ORIGIN`, the
  three kick tables and spin detection, 7-bag plus queue and hold discipline, the `STACKED_GRAVITY_Q16`
  lookup and the lock-delay/reset table.
- changed `apps/portal/src/seeded-rng.mjs` — **additive only**: `uint32()` and `nextBelow(n)`. Existing
  `float()` / `count` semantics untouched so `tests/seeded-rng.test.mjs`'s pinned sequence still passes.
- new `scripts/stacked-sim-purity-check.mjs` + `npm run design:stacked-purity`.
- changed `scripts/syntax-check.mjs`, `package.json`.

**RED tests first**
- `tests/stacked-sim.test.mjs`
  - every piece kind × every rotation state × both directions resolves to a golden cell set on an
    empty board;
  - **every kick offset in all three tables is exercised at least once against a constructed blocking
    board, asserting the chosen kick index**, not merely "it rotated";
  - a rotation with no legal kick leaves piece, lock timer, reset counter and `lastActionWasRotation`
    untouched;
  - the CW generating rule reproduces every state from its predecessor for all seven kinds;
  - `O` never displaces and never qualifies as a spin;
  - the immobility spin test requires immobility in **all four** directions including up;
  - the pinned simultaneous-bit precedence: `lastHorizontal` latch on opposing move bits;
    `rotateCCW > rotateCW > rotate180`; `hold` before `hardDrop` on one tick; `hardDrop` beats
    `softDrop`; `hold` while used is a no-op with no lock-delay reset.
- `tests/stacked-sim-determinism.test.mjs` (part 1)
  - over 10,000 consecutive draws from one seed, every 7-window is a permutation with no repeat inside
    a window and a maximum same-piece gap ≤ 12;
  - repeated across 256 seeds with ≥ 250 distinct first-bag orderings (guards a collapsed seed mix);
  - `bagRefills === 2 + floor(pieces / 7)` exactly, and `bagDraws >= 6 * bagRefills` (rejections from
    `nextBelow` legitimately raise draws above the floor);
  - a golden first-40-piece sequence for a pinned seed.
- `tests/stacked-sim-purity.test.mjs` — the purity script passes on the shipped sim. Banned tokens
  include **the `**` operator** (a scanner that bans only `Math.pow` lets `**` straight through) and
  `Math.hypot`, whose result is implementation-defined in ECMA-262.

**Acceptance bar**
- Same seed + same input stream produces a byte-identical snapshot chain, twice in one process and once
  through a freshly imported module instance; a different seed diverges.
- `apps/portal/src/stacked-sim.mjs` contains no `Date`, `performance`, `Math.random`, `Math.hypot`,
  `Math.pow`, `**`, `toFixed`, `window`, `document` or `navigator`, and imports nothing outside
  `./seeded-rng.mjs` and `./stacked-contracts.mjs` — proven by the purity script, not by review.
- A test drives four catch-up steps in a single frame from one held-state mask and asserts **exactly
  one** hard drop. Edge detection is **inside** the sim against the previous tick's mask, so this holds
  by construction; the test proves the construction.
- Stepping a stream in batches of 4 produces the same terminal `stateHash` as stepping it one tick at a
  time.

**Verification:** `npm run check` · `npm test` · `npm run design:stacked-purity` · `npm run test:release`

**Size: L.** Three complete kick tables — one an original 180 set with no upstream reference — seven
piece geometries, a generating-rule proof, and the bag/queue cursor discipline every stored replay
depends on. The golden fixtures alone are most of the work.

---

### S-03 — Deterministic core II: clears, scoring, the rising ledger, top-out, result tuple

**Goal:** finish the rulebook — the parts that produce the numbers the leaderboard ranks.

Spec: `docs/stacked/spec/mechanics.md` §8–§9, `docs/stacked/spec/versus.md` §1 and §7 items 1 and 3.
Constants: `STACKED-CONTRACTS.md` §2.4 (scoring block), §2.5 (rising ledger **and the HASHPOWER
economy** — `HASHPOWER_PER_CLEAR`, `HASHPOWER_MAX = 8`, `REORG_COST_PERIOD_TICKS`, `REORG_COST_MAX = 12`,
and the 24:00 defence wall those two imply), §4.3 (result tuple).

**Files**
- changed `apps/portal/src/stacked-sim.mjs` — line detection and naive compaction; the REORG schedule
  (`garbageIntervalTicks`, `nextGarbageHole`, `reorgCost`) and the HASHPOWER economy; the scoring block
  and its integer application order **with `STACKED_COMBO_BONUS_CAP` applied and no score clamp**;
  **all five** terminal conditions; `buildStackedResultTuple`; `boardHash`; and `zoneForTick` as a pure
  function of tick.
- new `apps/portal/src/stacked-versus-table.mjs` — frozen `STACKED_ATTACK_TABLE`, `computeAttack`,
  `resolveGarbageExchange`. **Zero runtime consumers in Phase 1.**
- new `apps/portal/src/stacked-match.mjs` — `createStackedMatch({ seed, playerConfigs, attackTable = null })`
  returning a frozen `{ stepAll, snapshot, stateHash, result, get terminal }` (versus §7 item 3, §3).
  **This is the D-14 seam and it is a Phase 1 deliverable, not a Phase 2 one:** the solo runtime never
  talks to the attack table, the *match* owns the garbage router, and that single boundary is what makes
  Two Player a data change rather than the rewrite D-14 exists to prevent. Constructed with
  `playerConfigs.length === 1` and `attackTable: null` throughout Phase 1, which makes the router inert.
  It imports `./stacked-sim.mjs`, `./stacked-contracts.mjs` and `./seeded-rng.mjs` and **must not import
  `./stacked-versus-table.mjs`** — the table arrives through the `attackTable` argument, or the
  zero-importer proof dies. One match seed, a per-board `bag` instance derived from it, one shared
  match-level `garbage` stream.
- changed `scripts/syntax-check.mjs`.

**RED tests first**
- `tests/stacked-sim.test.mjs` (extended)
  - table-driven scoring, one case per (lines × spin flag × `chainActive` × combo count × level),
    asserting the exact integer;
  - a spin row **replaces** the plain clear row and is never summed; a four-line clear always scores
    `HALVING` (800), spin or not;
  - `Math.floor(scaled * 3 / 2)` for CHAIN, never `* 1.5`;
  - the combo bonus is capped at `STACKED_COMBO_BONUS_CAP` (20) and no path yields a non-integer,
    a negative delta, or a clamp at `999_999_999`;
  - score is monotone in level; `level === min(30, startLevel + floor(lines / 10))`;
  - REORG pushes only at a lock boundary, never mid-piece;
  - **one RNG draw per garbage group, not per row**, and hole repetition (`3/5`) consumes the correct
    number of `garbage`-substream draws on **both** branches;
  - the **`garbage-out`** terminal path is exercised by a deliberate synthetic test, because ordinary
    play never reaches it;
  - each of the five `terminalReason` values fires independently, freezes the result, and makes a
    further `step()` throw; the reason set is exactly the five values and is frozen.
- `tests/stacked-sim.test.mjs` (zones) — zone index is a pure function of tick, not of wall clock, not
  of score, not of an animation completing; a top-out on the exact tick of a zone boundary produces the
  same canonical result as one a tick either side; the zone never appears in the result tuple.
- `tests/stacked-versus-table.test.mjs` — the table is frozen and complete; the `backToBackMinLines`
  gate; the `max(spin, base)` floor; the `sent === null` zero-row case; the rows-per-piece assertions;
  **a grep assertion that no file under `apps/` imports the module** — including `stacked-match.mjs`.
- `tests/stacked-match.test.mjs` — `createStackedMatch` with one board produces a `stateHash` chain and a
  result **byte-identical** to driving `createStackedRuntime` directly over the same input stream, so the
  wrapper is provably transparent in Phase 1; `stepAll` consumes one distinct input byte per fixed step
  dequeued from a tick-indexed ring, and replaying one frame's snapshot across four catch-up steps is
  **not** how it behaves; `attackTable: null` leaves the garbage router inert and never touches a board;
  `stateHash()` covers all boards and all queues and is a `uint32`; `step`/`stepAll` throws once terminal
  (the `createChikunRuntime` contract); constructing with `playerConfigs.length === 2` gives both boards
  the identical piece sequence from the one match seed. The two-board path is asserted here even though
  nothing renders it, which is what stops the seam rotting.
- `tests/stacked-sim-determinism.test.mjs` (completed) — golden vector
  `tests/fixtures/stacked-golden-run.json` (seed, input stream, expected canonical result JSON,
  expected digest); comparison **field by field against an explicit ordered list**, never
  `JSON.stringify` equality, so key order and digit counts never become load-bearing across a season of
  stored claims; survival reported in **ticks**, seconds derived as `ticks / 60`.

**Acceptance bar**
- The golden fixture reproduces exactly. Any change to it is a deliberate `STACKED_CABINET_VERSION` bump
  flagged in review.
- Every integer in the result tuple satisfies the identities in `STACKED-CONTRACTS.md` §4.3/§4.4 on the
  golden run: `singles + 2*doubles + 3*triples + 4*quadClears === lines`,
  `lines <= floor(pieces * 4 / 10) + garbageRowsReceived`, `bagRefills === 2 + floor(pieces / 7)`,
  `bagDraws >= 6 * bagRefills`, `garbageDraws >= garbageGroups`,
  `garbageRowsCleared <= garbageRowsReceived`.
- `createStackedMatch` with one board is **provably transparent**: its `stateHash` chain and result are
  byte-identical to driving `createStackedRuntime` directly over the same stream, and
  `tests/stacked-versus-table.test.mjs`'s grep still finds zero importers of the attack table.
- The 24:00 defence wall is asserted directly: at any tick ≥ 86,400 no REORG is ever rejected, because
  `reorgCost(tick) >= 9 > HASHPOWER_MAX = 8`. A test that only checks `reorgCost`'s arithmetic misses it.
- No float appears anywhere in `snapshot()`, `stateHash()`, or the result tuple.

**Verification:** `npm run check` · `npm test` · `npm run design:stacked-purity` · `npm run test:release`

**Size: L.** A 14-row scoring table plus two lookup rules the table does not encode, a REORG economy
with eight interacting constants, five terminal conditions one of which is unreachable in normal play,
the match wrapper that has to be provably transparent at one board, and the result tuple every
downstream gate and stored replay is defined against.

---

### S-04 — Input codec, evidence chunking, deterministic re-simulation

**Goal:** record a run as bytes, ship those bytes across a 65,536-byte-capped bridge, and re-simulate
them back to the identical result tuple.

Spec: `docs/stacked/spec/integrity.md` §3 (SIC1 body format survives whole; its §0 "no chunking" claim
is void). Constants: `STACKED-CONTRACTS.md` §2.3, §4.1.

**Files**
- changed `apps/portal/src/stacked-sim.mjs` — `encodeSic1`, `decodeSic1`, `simulateStackedRun`,
  `replayStackedRun`, `STACKED_SIM_CONSTANTS`.
- new `apps/portal/src/stacked-bridge-protocol.mjs` — `stacked-bridge/v1`, exact-key validation in both
  directions (the `exactKeys()` discipline of `chikun-bridge-protocol.mjs`, which rejects unexpected
  **and** missing fields, plus `sdk/hmh-run-summary-schema.mjs`'s key-**count** guard),
  `STACKED_MAX_MESSAGE_BYTES = 65_536`, its own `validateSettings` (HMH's is HMH-shaped and rejects
  unknown keys), the `game:evidence-chunk` message
  `{ sessionId, messageId, chunkIndex, chunkCount, totalRawBytes, payload }`. The `game:result` payload
  is exactly contract §4.5's **seven** top-level keys and carries **no** `versus` key — the two-player
  reservation is `summary.versus`'s seven integer zeros in the run summary (S-08) and nowhere else.
  Contract §1.2's last row records `versus: null` and `custom.versus` as rejected variants.
- new `apps/stacked/src/verify-worker.mjs` — imports `stacked-sim.mjs` only; rendering-free by
  construction. Becomes a build entry point in S-11 (`dist/stacked/verify-worker.js`).
- new `apps/portal/src/stacked-replay-store.mjs` — `stacked-replay-v1:<sessionId>` keys plus
  `stacked-replay-v1:index`, `STACKED_MAX_STORED_REPLAY_CHARS = 240_000`, a 2-replay LRU, and writes
  **outside** `snapshotArcadeState` (a fat replay inside it trades the whole `cadenceLeaderboards`
  slice under quota pressure — `persistence.mjs:98-113`).
- changed `scripts/syntax-check.mjs`.

**RED tests first**
- `tests/stacked-input-codec.test.mjs` — the held-state mask contract: the byte recorded for tick T is
  exactly the byte handed to `step()` on tick T; the three recorder invariants (at most one record per
  tick with pending-record overwrite and equal-mask drop; tick 0's mask forced to `0`; a synthesised
  mask-`0` release on pause, `blur` and `visibilitychange` to hidden); auto-shift expansion happens
  outside the sim and stops at the wall.
- `tests/stacked-evidence-codec.test.mjs`
  - encode→decode identity over 10,000 randomly generated legal streams;
  - the short (1-byte), general (3–5 byte) and terminator (2–4 byte) forms;
  - a multi-bit same-tick change encodes as one general record;
  - lead bytes `0x81`–`0xFE` rejected; a terminator tick index disagreeing with the header rejected;
    truncation, over-cap, non-monotonic ticks, an out-of-range tick and trailing bytes all rejected;
  - **every chunk message, JSON-serialised with its envelope and measured with
    `new TextEncoder().encode(JSON.stringify(msg)).byteLength`, is under 65,536**;
  - reassembly rejects a missing index, a duplicated index, a `chunkCount` mismatch, a `totalRawBytes`
    mismatch, a bad `"SIC1"` magic, a bad header checksum, and more than
    `STACKED_MAX_EVIDENCE_CHUNKS` (33);
  - **the ceiling ordering is asserted directly**: at 3 bytes/tick worst case and one record per tick
    max, a legal stream always hits `'tick-ceiling'` first; `'evidence-ceiling'` is reachable only from
    a synthetic hostile stream, and that stream is rejected at reassembly.
- `tests/stacked-replay-store.test.mjs` — LRU eviction at 2; a cap-sized write measured against the
  240,000-character budget in an in-memory storage mock; an over-budget stream is refused with reason
  `replay-too-large` **without failing the run**; a write failure is non-fatal.
- `tests/stacked-sim-determinism.test.mjs` (extended) — a synthetic maximal-length replay re-simulates
  in **under 400 ms on this host, with the measured figure printed**, and the test fails loudly if the
  sim regresses past it. The spec's 1–2 µs/tick figure is an estimate; this is the cycle that turns it
  into a measurement. If the real cost is 4× the estimate, the Worker stops being optional and S-18's
  inline fallback becomes the exception rather than the rule.

**Acceptance bar**
- A synthetic run at the stress input rate encodes, chunks, reassembles and re-simulates to a result
  tuple byte-identical to the live run's, with the chunk count asserted as a named constant. If the
  count is wrong, the **encoding** changes, not the constant.
- Worst-case replay storage is **measured**, not estimated, and recorded in the ledger as a share of
  the documented character budget.
- Re-simulation of a maximal run is under 400 ms, with the measurement in the ledger.

**Verification:** `npm run check` · `npm test` · `npm run design:stacked-purity` · `npm run test:release`

**Size: L.** Two codecs (transition encoding and chunk framing), a bounded decoder that must reject
nine distinct malformed shapes, the repo's first `new Worker(` entry point, and a storage layer that
must not be able to evict the leaderboard.

---

### S-05 — Difficulty model artifact and the soak pilot policy

**Goal:** make the difficulty curve a committed, regenerable artifact instead of hand arithmetic, and
give CI something that can actually play a 40-minute run.

Spec: `docs/stacked/spec/mechanics.md` §10.

**Files**
- new `scripts/write-stacked-difficulty-model.mjs` → `docs/stacked/difficulty-model.json`.
- new `apps/stacked/src/dev/soak-pilot.mjs` — a dev-only greedy placement policy behind `stackPilot=1`,
  dynamically imported so it tree-shakes out of the default bundle.
- changed `scripts/syntax-check.mjs`, `package.json`.

**RED tests first**
- `tests/stacked-difficulty-model.test.mjs` — the committed JSON is byte-identical to a fresh
  derivation, and **every tier's predicted top-out sits inside its target band** (2–3 / 4–6 / 6–12 /
  12–30 / 30–40 min). The model must be produced by actual numerical integration in the script, not by
  transcribing the spec's hand steps, or the byte-stability test just locks in the hand arithmetic.
  **The integrator must implement mechanics §10's `g = inj` branch for `reorgCost(tick) > HASHPOWER_MAX`**
  — defence is impossible from tick 86,400, and a model that keeps rejecting past it predicts god tier
  about 1.3 minutes late. Assert directly that the god trace's rejection rate is zero for every step
  after 24:00. The spec's hand steps predict 2.70 / 5.47 / 9.54 / 20.07 / 33.4 min; the script's output
  should land within a few tenths of those, and a larger gap means one of the two is wrong.
- `tests/stacked-soak-pilot.test.mjs` — the pilot emits only held-state masks the codec can record; it
  is refused when `mode === 'ranked'`; a pilot-driven run of ≥ 100,000 ticks reaches a terminal state
  with a valid result tuple.

**Acceptance bar**
- Five predicted top-outs, five bands, five passes, regenerable from source, with the fitted parameters
  named in the artifact as **assumptions with no telemetry behind them**.
- A headless pilot run reaches ≥ 80 % of the target tick count for a 40-minute session without a
  restart, so S-21's soak has something to drive. If it cannot, the ledger records that and S-21's soak
  degrades to a shorter scripted run rather than silently passing on an idle tab.
- `dist/stacked/game.js` does not contain the string `soak-pilot` (asserted in S-21 once the bundle
  exists).

**Verification:** `npm run check` · `npm test` · `npm run docs:links` · `npm run test:release`

**Size: M.** The integrator and the artifact are small; a pilot policy that survives 40 minutes without
topping out is the real work, and it is unproven.

---

### S-06 — Cabinet registration behind `?devCabinets=1`

**Goal:** the cabinet exists to the portal — boards, progress key, routes, art — and is reachable
**only** behind the dev flag.

Spec: `docs/stacked/spec/portal.md` §2. Identity: `STACKED-CONTRACTS.md` §3 (every id, slug, key and
route, already collision-checked).

**Files**
- changed `apps/portal/src/arcade-core.mjs` — the `ARCADE_GAMES` entry (`id: 'stacked'`,
  `livesPaid: 1`, `entryFeeMicroUsdc: DEFAULT_ENTRY_FEE_MICRO_USDC`,
  `rankedSeasonId: 'stacked-season-preview-1'`, `cabinetVersion` from `stacked-cabinet.mjs`,
  `status: 'coming-soon'`, `publicPlayable: false`, `devPlayable: true`, first-party 100/0/0/0 fee
  split with `devWallet: null`); the `LESTERS_ARCADE_V2_APP_SHELL.cabinets` entry with
  `playable: false`, `devPlayable: true`; `CABINET_MODE_SELECT_PRESENTATIONS.stacked`; the
  `discoveryTags` branch; and the one-line `allowDevCabinet` pass-through in `beginTrackedSession`
  without which `?devCabinets=1` reaches mode select and then throws on start.
- changed `apps/portal/src/arcade-router.mjs` — `ARCADE_GAME_SLUGS` (`stacked: 'stacked'`),
  `ARCADE_GAME_IDS_BY_SLUG` (`stacked` **and** the `stack` alias, which belongs in **that** map only),
  `GAME_TITLE_BY_SLUG`.
- changed `apps/portal/src/game-registry.mjs` — first-party entry in the built-in registry map,
  `adapter: null`.
- new `apps/portal/games/stacked/game.manifest.json` — `id: 'stacked'`, `status: 'coming-soon'`,
  `version: '0.1.0'`, `aspectSupport: ['9:16','16:9']`, `rankedEligible: true`, `controlScheme` set to
  the nearest legal `CONTROL_SCHEMES` value with the mismatch recorded in the ledger (the shipping
  default is a gesture scheme the shared validator has no value for; editing the shared validator is a
  separate change).
- new `apps/portal/games/stacked/main.mjs` — the re-export shim. **Nothing fails loudly without it**;
  the manifest validator only checks that `entry` is a non-empty relative string, so it goes in the art
  test.
- new placeholder SVGs: `apps/portal/assets/cabinet-stacked.svg`, `apps/portal/assets/cartridge-stacked.svg`,
  and the mode-select key art under `apps/portal/assets/stacked/`. Hand-authored in the register of
  `cabinet-generic-brawler.svg`, **not** under `assets/generated/`, and not modelled on
  `cabinet-chikun.svg` (a "COMING SOON" plate — the wrong artefact for a cabinet that will ship
  playable).

**RED tests first**
- `tests/stacked-public-integration.test.mjs` — the string `stacked` is the id in `ARCADE_GAMES`, the
  app shell (with `gameId` matching), `CABINET_MODE_SELECT_PRESENTATIONS`, `REGISTERED_GAMES`, both
  router tables and the manifest; `validateGameManifest()` accepts the on-disk file;
  **`gameSlugFor('stacked') === 'stacked'`** (not the `DEFAULT_GAME_SLUG` fallback);
  `gameIdForSlug('stack') === 'stacked'`; `buildPlatformShellModel('mode-select', …).breadcrumbs`
  contains a crumb labelled `STACKED` (the only public proof that the module-private
  `GAME_TITLE_BY_SLUG` moved); `buildGameModeSelectModel('stacked')` is non-null;
  `createInitialArcadeState()` produces both board slots; `ensureAllGameProgress` creates
  `progress.stacked`; `rankedSeasonId === 'stacked-season-preview-1'`; the app-shell `playable` flag and
  the `ARCADE_GAMES` `status` agree.
- `tests/stacked-cabinet-art.test.mjs` — every referenced asset path exists under `apps/portal/`, ends
  `.svg`, parses as XML with a root `<svg>`, is under its byte cap, and contains none of `<script`,
  `<foreignObject`, `xlink:href`, `data:image`, `#frame=`; **the STACKED entry sets `bannerArt` and
  does NOT set `desktopCabinetSprite`** (per the locked placeholder-art decision — the shared rotator's
  keyframes hard-code a six-frame duty cycle, and Phase 1 does not author a sprite sheet); the
  `games/stacked/main.mjs` shim resolves.
- `tests/persistence.test.mjs` (extended) — a v3 save with no `progress.stacked` restores without
  throwing and gains the key lazily. **`ARCADE_PERSIST_VERSION` stays `3`.**

**Acceptance bar**
- With `?devCabinets=1` the STACKED card renders on the floor and mode select reaches a non-`null` model
  with `dataset.artStatus !== 'unconfigured'`. Without the flag it is absent from the floor and from
  `publicLeaderboardCabinets()`.
- `npm run docs:cabinets` passes with the manifest at `coming-soon` and **no README roster row**.
- No STACKED seed rows exist; both boards start empty.

**Verification:** `npm run check` · `npm test` · `npm run docs:cabinets` · `npm run design:security-audit` · `npm run test:release`

**Size: M.** Three independent declarations inside `arcade-core.mjs`, three router tables, the
placeholder art, and a parity test whose whole job is to make a fourth cabinet impossible to
half-register.

---

### S-07 — Leaderboard engine hygiene

**Goal:** fix two engine problems that already affect HMH and Chikun, before a third cabinet triples the
rate.

**Files**
- changed `apps/portal/src/leaderboard-engine.mjs` — an optional `compareRows` on `getLeaderboard`
  defaulting to `null`, threaded through **both** the per-wallet dedup and the final sort (otherwise two
  rows from one wallet sort by clock while two rows from different wallets sort by skill); and
  `pruneCadenceLeaderboards(state, { keepDaily, keepWeekly, keepMonthly, keepYearly })`.
- changed `apps/portal/main.js` — call the prune once, immediately after `loadArcadeState`.

**RED tests first**
- `tests/leaderboard-engine.test.mjs` (extended) — the default `compareRows` path is byte-identical to
  today's ordering for HMH and Chikun fixtures; the prune keeps the current period for every cadence and
  **never touches `all-time`**; a saturated multi-year fixture shrinks to the retention window.

**Acceptance bar**
- Historical-bucket growth is bounded. Nothing deletes an old `periodKey` today, and at current limits a
  saturated season is measured in megabytes per game against a ~5 MB quota, at which point
  `saveArcadeState` silently drops `cadenceLeaderboards` for **every** cabinet.
- Zero behaviour change for HMH and Chikun, proven by the existing suite plus the new default-path case.
- **The prune is destructive on existing saves.** The cycle ledger records exactly what it deletes and
  states plainly that it is irreversible (owner gate G-17).

**Verification:** `npm run check` · `npm test` · `npm run test:release`

**Size: S.** Two functions, one call site, one regression test. Isolated on purpose — land it early
because every later cycle depends on the boards not degrading.

---

### S-08 — Run summary schema and the `runStats` projection

**Goal:** one validated payload shape between child and parent, and a deliberately small persisted
projection of it.

Contract: `STACKED-CONTRACTS.md` §4.4 (seven blocks, 42 fields, bounds table, eleven cross-field rules,
the 16-key projection).

**Files**
- new `sdk/stacked-run-summary-schema.mjs` — `STACKED_RUN_SUMMARY_VERSION = 1`, the seven exact-key
  blocks (`identity` / `totals` / `clears` / `technique` / `pressure` / `handling` / `versus`), every
  bound **imported from `stacked-contracts.mjs`, never retyped**, the seven cross-field rules, and
  `projectStackedRunStats(summary)` returning a **flat 16-key** object.
- changed `scripts/syntax-check.mjs`.

**RED tests first**
- `tests/stacked-run-summary-schema.test.mjs`
  - exact-key rejection for an extra field **and** for a missing field, plus the key-count guard, at
    every level;
  - every numeric bound, including `pressure.maxStackHeight <= BOARD_ROWS` (24, **not** 40) and
    `clears.quadClears <= STACKED_MAX_QUAD_CLEARS` (21,600);
  - all seven cross-field rules, with rule 1
    (`singles + 2*doubles + 3*triples + 4*quadClears === linesCleared`) asserted as an **equality**;
  - `totals.elapsedMs === round(survivalTicks * 50 / 3) ± 1`;
  - every `versus.*` field rejected unless exactly `0` at `schemaVersion 1`;
  - the `handling` block accepts only `dasTicks 4..18`, `arrTicks 1..6`, `dcdTicks 0..8` and
    `inputDevice ∈ 'keyboard' | 'touch' | 'gamepad' | 'mixed'`, and a test asserts it is **never
    hashed, never ranked, and never passed to the verifier**;
  - `terminalReason` invariants for all five reasons;
  - `projectStackedRunStats` returns **exactly** the 16 frozen keys, asserted as an exact set —
    `survivalTicks` is in it, and it is the only time quantity, so S-20's `m:ss` cell renders
    `ticks / 60` from the same schema expression that sorts.

**Acceptance bar**
- A representative projected `runStats` is measured with `JSON.stringify` and is at most half the bytes
  of the full summary; a cadence row carrying it is measured and recorded in the ledger.
- No float anywhere in the summary or the projection.
- Every leaderboard column and profile cell S-20 will render is present in the 16 keys, and nothing else
  is.

**Verification:** `npm run check` · `npm test` · `npm run test:release`

**Size: M.** Forty-two fields, seven cross-field rules, and a derivation chain where setting two bounds
independently is exactly how a schema starts rejecting legal runs.

---

### S-09 — `game-stat-schema.mjs` extraction

**Goal:** replace the per-game ternaries in the leaderboard and profile routes with a registry, with
**zero** rendered-output change for HMH and Chikun.

**Files**
- new `apps/portal/src/game-stat-schema.mjs` — `getGameStatSchema(gameId)` returning
  `{ leaderboardColumns, compareRows, youCardLine, aggregateSessions, profileStatCells, breakdownCards,
  recentRunLine, emptyStateCopy, reduceProgress, trustFor }`. DOM-free; imports nothing from
  `arcade-core.mjs` (helpers arrive as arguments).
- changed `apps/portal/src/routes/official-leaderboard-route.mjs` — remove the five sites that branch on
  `const chikunBoard = routeState.gameId === 'chikun'`; move the `survive` accessor **and** its formatter
  into the schema (they are the only pair not game-branched today, and STACKED ranks on ticks while HMH
  ranks on seconds); validate `routeState.sortKey` against the active schema and reset to `'score'`
  otherwise, fixing the latent default that sorts by score while the arrow points elsewhere.
- changed `apps/portal/src/routes/official-profile-route.mjs` — the six extraction sites, plus deletion
  of the five dead `let` declarations.
- changed `apps/portal/src/arcade-core.mjs` — `custom: {}` on `createEmptyGameProgress`, and the
  `progress.custom ??= {}` + `reduceProgress` hook in `updateProgressFromRun`. Every read stays
  `progress.custom?.x ?? DEFAULT` forever, because `ensureGameProgress` uses `??=` and a profile
  persisted before `custom` existed never gains it on restore.

**RED tests first**
- `tests/game-stat-schema.test.mjs` — the `lester-blaster` and `chikun` schemas produce **byte-identical**
  column keys, labels, sort keys, accessor outputs, formatted strings, trust labels, stat cells,
  breakdown cards and empty-state copy to today's hard-coded arrays, against fixtures **captured before
  the change**. Nothing in the repo snapshots that DOM today, so establishing the baseline is the first
  commit of this cycle, not the last.
- `tests/official-leaderboard-route.test.mjs` (extended) — the dead-`let` assertion extended to
  `official-profile-route.mjs`; an unknown `sortKey` resets to `'score'`.

**Acceptance bar**
- Every existing HMH and Chikun assertion passes unchanged, and the new byte-identity fixtures pass.
  `npm run visual:responsive` shows zero changed cells on the scores and profile states.
- No route file contains a `gameId === '<literal>'` comparison for column, cell or copy selection.

**Verification:** `npm run check` · `npm test` · `npm run visual:responsive` · `npm run smoke:portal` · `npm run smoke:portal:interactions` · `npm run test:release`

**Size: L, and it must land alone.** The highest-regression-risk cycle in the plan: it rewrites the
rendering path of two shipped cabinets to prove a third can join it. Its entire value is the "nothing
changed" evidence, and bundling any STACKED feature into it destroys that evidence.

---

### S-10 — Run-verifier registry and achievement scoping

**Goal:** delete the two hard-coded `game.id === 'chikun'` verification branches, and stop one cabinet's
ranked run unlocking another cabinet's badges.

**Files**
- new `apps/portal/src/run-verifier-registry.mjs` — `registerRunVerifier` / `getRunVerifier`, with the
  `canonicalize` hook.
- changed `apps/portal/src/arcade-core.mjs` — both call sites (`recordScore` and
  `buildParentSyncPacket`) collapse to the same two lines, with `requiresRunVerifier` on the affected
  `ARCADE_GAMES` entries; `defineAchievement` gains a `gameId` field defaulting to `'lester-blaster'` so
  all 57 existing definitions keep their meaning, with `gameId: null` for `CABINET_PIONEER` and
  `FIRST_PAID_RUN` only; `maybeUnlockRunAchievements` takes `session.gameId` and dispatches to a per-game
  resolver (HMH's existing `resolveAchievementUnlocksForRun` becomes the `lester-blaster` resolver,
  unchanged); a sibling `achievementSummaryByGame` is added while the global `achievementSummary` is left
  alone, because it lives inside `buildPlayerArcadeSnapshot` which has no gameId parameter and several
  existing callers; `ACHIEVEMENT_TIER_UNLOCK_PCT` gains `mythic: 1`, fixing six existing mythic badges
  that currently fall back to `?? 40` and read as more common than gold.
- changed `apps/portal/src/routes/official-profile-route.mjs` — the achievement grid filters to
  `gameId === null || gameId === routeState.gameId`.

**RED tests first**
- `tests/stacked-achievements.test.mjs` (part 1) — a `chikun` ranked run unlocks **no**
  `lester-blaster`-scoped badge; **an HMH ranked run's unlock set is byte-identical to today's**, against
  a fixture captured before the change; `ACHIEVEMENT_TIER_UNLOCK_PCT.mythic` exists and is below
  `diamond`; every achievement **title** is unique across `ACHIEVEMENT_DEFINITIONS` (the profile grid
  resolves unlocked state by title, not id, so two badges sharing a title light up together).
- `tests/chikun-portal-lifecycle.test.mjs`, `tests/chikun-runtime.test.mjs` — unchanged and passing; they
  are the regression bar for the registry refactor. The sync packet's chikun `canonicalRunStats` and
  `canonicalReplayClaim` must be byte-identical.
- `tests/arcade-core.test.mjs` (extended) — every `requiresRunVerifier` cabinet has a registration path,
  and `recordScore` throws for a ranked session on such a cabinet with no verifier registered.

**Acceptance bar**
- Chikun's observable behaviour is byte-identical after the refactor.
- HMH's unlock set for a fixed ranked run is byte-identical before and after scoping.
- No third `game.id === '<cabinet>'` string comparison exists on the verification path.

**Verification:** `npm run check` · `npm test` · `npm run smoke:chikun:ranked` · `npm run test:release`

**Size: M.** Small diff, shipped-behaviour blast radius. Achievement scoping changes something two live
cabinets already do, which is why the no-regression fixtures are the deliverable, not the refactor.

---

### S-11 — Build, CSP, service worker, child shell

**Goal:** a fourth build target that ships a Pixi-externalized bundle from a correctly-headered directory
that a returning browser can actually load.

Spec: `docs/stacked/spec/gates.md` §5–§6, `docs/stacked/spec/portal.md` §6.
Contract: `STACKED-CONTRACTS.md` §2.7 (bundle caps, and the `createHmhPixiPlugin` prerequisite), §3
(CSP, cache and service-worker rows).

**Files**
- changed `build.mjs` — `'stacked/game'` and `'stacked/verify-worker'` entry points; widen
  `createHmhPixiPlugin`'s importer test from the literal `/apps/hmh-reboot/src/` substring to a prefix
  set including `/apps/stacked/src/`. **Widening the externaliser is free and is not the G-5 decision**;
  it changes which importers get the external, not what the chunk contains. `pixi-vendor.mjs` itself is
  frozen at nine exports until G-5 (contract §2.7) and this cycle does not open it (without this the entry inlines the whole 575,891-byte Pixi vendor
  and overshoots by ~3×; the relative external path resolves unchanged because `dist/stacked/` sits at
  the same depth as `dist/hmh-reboot/`); split the bundle assertion per G-5.
- changed `scripts/hmh-reboot-bundle-budget.mjs` — independent vendor / per-entry caps alongside the
  existing `assertHmhInitialJsBudget`, plus `assertStackedJsBudget` measuring **entry plus every
  statically imported `chunks/chunk-*.js`**, excluding the vendor chunk which is counted separately. A
  cap on the entry file alone is trivially evaded by esbuild moving one module into a shared chunk.
- changed `scripts/hmh-reboot-performance-browser-smoke.mjs` — import the entry cap instead of its own
  `BUNDLE_MAX_BYTES = 1_050_000` literal, which today means something different from the
  identically-valued cap in `build.mjs`.
- changed `vercel.json` — a `/stacked/(.*)` header block **placed before the catch-all**, modelled on
  the `/chikun/(.*)` block, with `frame-ancestors 'self'`, `connect-src 'self'`, no `'unsafe-inline'` on
  `script-src`, and `worker-src 'self' blob:`; the catch-all lookahead extended to
  `/((?!(?:hmh-reboot|chikun|stacked)/).*)`; and the cache source extended to
  `/dist/(hmh-reboot|chikun|stacked)/(.*)`. All three edits or the cabinet does not work.
- changed `apps/portal/sw.js` — `/stacked/index.html`, `/stacked/game.css` and `/dist/stacked/game.js`
  added to `PRECACHE_URLS` as literal URLs (the list is not globbed), and a `CACHE_VERSION` bump.
- changed `README.md` line 17 (production cache marker) **in the same commit**.
- new `apps/portal/stacked/index.html` + `apps/portal/stacked/game.css` — `#stackedStage`,
  `modulepreload` of the vendor chunk, loads `../dist/stacked/game.js`. (Chikun's `game.css` naming, not
  HMH's `styles.css`.)
- new `apps/stacked/src/main.mjs` — wiring stub only.

**RED tests first**
- `tests/stacked-shell.test.mjs` — modelled on `tests/hmh-reboot-shell.test.mjs` and
  `tests/chikun-runtime-shell.test.mjs`: the `/stacked/(.*)` bucket exists, carries no `'unsafe-inline'`
  on `script-src`, carries `frame-ancestors 'self'`, `connect-src 'self'` with **no** external host, and
  `worker-src 'self' blob:`; the catch-all's `frame-ancestors 'none'` source excludes `stacked`; a
  `dist` + `stacked` Cache-Control rule exists with `must-revalidate`; **no STACKED artifact is emitted
  under `/dist/chunks/`**, which is `immutable` for a year with no content hash.
- `tests/stacked-bundle-budget.test.mjs` — `assertStackedJsBudget` throws the readable null-sentinel
  error before the first measurement, throws on entry-cap and graph-cap overrun after it, and returns a
  frozen result under both caps.
- `tests/production-doc-drift-check.test.mjs` — passes with the bumped marker (it asserts the README
  marker equals `sw.js`'s `CACHE_VERSION`, offline, inside `npm test`).

**Acceptance bar**
- `npm run build` produces `apps/portal/dist/stacked/game.js` containing **no second copy of Pixi**,
  proven by the measured entry-plus-chunks cap. This is the cycle that replaces
  `STACKED_ENTRY_JS_CAP: null` and `STACKED_INITIAL_JS_CAP: null` with `measured × 1.08` rounded up to
  the nearest 1,000, with the measurement quoted in the ledger.
- **Real HMH initial JS is recorded before and after.** `assertHmhInitialJsBudget` undercounts by design
  — it sees only entry + vendor and misses ~64 KB of shared chunks — so the true figure is close to the
  cap. Record `dist/main.js`, both existing child entries and every `dist/chunks/chunk-*.js` before and
  after. **If HMH's true initial JS crosses 1,050,000, that is a stop, not a cap bump**, and
  `HMH_INITIAL_JS_CAP` is never retargeted at the sum of the split caps.
- Every precache URL is verified to resolve against the running static server before the commit
  (`cache.addAll` swallows failures, so a mistyped path breaks the whole precache silently).

**Verification:** `npm run check` · `npm test` · `npm run build` · `npm run design:security-audit` · `npm run docs:production` (expected to fail between commit and deploy — that is the gate working) · `npm run test:release`

**Size: M.** Four shared files, one of which (`vercel.json`) creates a new certification candidate on its
own.

---

### S-12 — Renderer skeleton: layers, board view, pure layout, root fit

**Goal:** the board draws, deterministically and testably, with the two-board structure already in place
and no audio anywhere near it.

Spec: `docs/stacked/spec/visuals.md` §1, `docs/stacked/spec/versus.md` §3.
Contract: `STACKED-CONTRACTS.md` §2.8 (the six-layer tree, the four enforced rules, `layoutMatch`'s
signature and top-left origin, `CELL_PX = 32` and the two authored frames).

**Files**
- new `apps/stacked/src/render/layers.mjs` — `createLayerStack()` with a frozen `LAYER_ORDER`, building
  exactly the six layers under one `stackedRoot`.
- new `apps/stacked/src/render/board-view.mjs` — `createStackedBoardView()` with the seven per-board
  sub-layers, and the renderer that owns `present()`. `app.stage.addChild` is called **exactly once**,
  with `stackedRoot` as its only argument.
- new `apps/portal/src/stacked-layout.mjs` — `layoutMatch({ viewportWidth, viewportHeight, boardCount,
  opponentMini })`, **pure, no Pixi, parent-side**, returning a frozen ascending-slot array with integer
  `x`/`y`/`scale`.
- `apps/hmh-reboot/src/pixi-vendor.mjs` — **do not touch it in this cycle.** Contract §2.7 freezes it at
  nine exports until **G-5** is answered. STACKED's renderer needs seven more symbols
  (`ParticleContainer`, `Particle`, `Filter`, `GlProgram`, `RenderTexture`, `Mesh`, `Geometry`) and
  `visuals.md` §1.2 prices them at a measured +21,469 bytes, which puts real HMH initial JS at 1,060,857
  against a 1,050,000 cap — a stop, not a cap bump (`gates.md` §6.2). Anything in S-12 or S-13 that needs
  one of the seven is **blocked on G-5**; write the ask into `docs/stacked/DECISIONS.md` and stop. Build
  the layer tree and board view against the nine that exist, with the particle layers as `Container`
  placeholders if necessary, so the structure lands and only the symbol source is gated.
- changed `scripts/syntax-check.mjs`.

**RED tests first**
- `tests/stacked-layout.test.mjs` — the solver is a pure function with no Pixi import; solo returns one
  centred slot; **`boardCount: 2` returns two slots today even though nothing renders them**; the array
  always has `boardCount` entries including hidden ones, in ascending `slot` order; `x`/`y` are the
  **top-left** of the authored box, not its centre; all four values are integers; the worked scale
  values from `docs/stacked/spec/versus.md` §3.3; frame selection is `'wide'` 512×640 or `'tall'`
  320×800 and is decided here, never by the view.
- `tests/stacked-render-tree.test.mjs` — `stage.children.length === 1`; the root has exactly the six
  frozen children in the frozen order; `boardSlot[1]` is created, empty and `visible === false`; no
  module below `boardSlot[n]` reads `app.screen`, `window.innerWidth` or `devicePixelRatio`; no
  module-level Pixi object; no `boardIndex === 0` special case anywhere in the tree;
  `app.stage.sortableChildren` is never set. Display-object constructors are **injected**
  (`buildMatchRoot({ stage, Container, Graphics })`) so this test runs under `node --test` with stub
  classes — there is no precedent for this in the repo and it is the first discipline that will be
  dropped under time pressure, so the test is what enforces it.
- `tests/stacked-root-fit.test.mjs` — a uniform letterboxed scale over a fixed logical rectangle; a
  resize changes only `scale` and `position`.

**Acceptance bar**
- One grid cell is exactly `1.0 × 1.0` in board-local units; pixels appear only in `layoutMatch`'s
  output.
- Particles carry a `boardIndex` and a snapshotted root transform (S-13 consumes it), so a board that
  moves mid-flight cannot drag its particles.
- The HUD layer is outside every shake and every filter, **structurally** — not by convention.

**Verification:** `npm run check` · `npm test` · `npm run build` · `npm run test:release`

**Size: L.** Two-board readiness is not free: every geometry decision has to be authored in board-local
units, the logical-root rectangle has to be right the first time (retrofitting it strands every in-flight
particle on a resize), and the layout function has to be pure enough to test with no browser.

---

### S-13 — Zones, backdrop, particles, quality tiers, flash limiter

**Goal:** the full visual system, driven by tick and tier only — still no audio.

Spec: `docs/stacked/spec/visuals.md` §3–§5, §9.
Contract: `STACKED-CONTRACTS.md` §2.6 (the one tier module, the five-step ladder with `&&`, the
capacities, the degradation levels, the telemetry dataset keys) and §2.9 (the six zone ids, the 150-tick
cross-fade).

**Files**
- new `apps/portal/src/stacked-zones.mjs` — `STACKED_ZONES` (six ids, linear-light palettes),
  `zoneIndexForTick`, `zoneBlendForTick`. Pure data plus two pure functions, no Pixi import. Parent-side
  so the tests are plain Node and the results screen can import it for copy.
- new `apps/stacked/src/render/quality-tier.mjs` — `STACKED_QUALITY_TIERS` and
  `selectStackedQualityTier(...)`; three tiers `desktopHigh` / `desktopLow` / `mobile`; reduced motion is
  a **modifier**, never a tier. **This module is owned here; S-15 imports it and does not define one.**
- new render modules: backdrop, bloom, the SoA pooled particle system, the preset table (including the
  `quadClear` preset id), the frame-budget guard, the flash limiter.
- changed `scripts/syntax-check.mjs`.

**RED tests first**
- `tests/stacked-zones.test.mjs` — over `STACKED_ZONES` as pure data: every palette stop satisfies
  `R / (R + G + B) < 0.70` in linear light (**not** `R − max(G,B) < 0.20`, which is not what the
  photosensitivity guidance measures and which rejects the correct amber stops); every stop is a 3-tuple
  of finite values in `[0,1]`; `bloom.base ≤ bloom.ceiling`, no ceiling above the tier `bloomCap`
  (0.35 / 0.22 / 0), `bloom.threshold − 0.12 > 0`; `entryTick` values are non-negative integers, strictly
  increasing, starting at 0; `index` matches array position; ids are exactly the six frozen ids in order;
  every particle override names a real preset; the well-interior contrast floor of 3:1 holds for locked
  minos in every zone; every mino colour has relative luminance ≥ 0.19.
- `tests/stacked-quality-tier.test.mjs` — the five-step selection ladder in order, with the tablet
  predicate as an **`&&`** (`coarsePointer === true && width <= 820`); a wide touch device resolves to
  `desktopLow`; `undefined` `hardwareConcurrency` / `deviceMemory` treated as "not low" and falling
  through; the per-tier `maxPixelArea` clamp (4,000,000 / 1,600,000 / 1,600,000) biting where it should
  and not where it should not; `resolutionCap` 2 / 1.5 / 1.25 with a resolution floor of 1; particle
  capacities exactly 6,000 / 2,600 / 1,200; `reducedMotion` reported as a separate boolean.
- `tests/stacked-particle-system.test.mjs` — dense alive-prefix pooling; `setCapacity` never reallocates;
  shrinking below `aliveCount` kills newest-first immediately; the four degradation levels move only the
  alive ceiling.
- `tests/stacked-flash-limiter.test.mjs` — the rate limit clamps a fourth flash's rising edge; the
  absolute additive ceiling; the area rule; the red-saturation guard passes ember and fails saturated red.

**Acceptance bar**
- With `evidenceSafe=1` the renderer is fully deterministic: a fixed synthetic band vector, the guard
  pinned to level 0, a fixed VFX RNG seed, pinned time, a fixed render-tick count, the flash limiter
  reset, and `dataset.renderTick` / `dataset.rootScale` published.
- The particle system produces exactly two particle containers, and therefore two draw calls for the
  whole system, at any count.
- The minimal-effects setting renders exactly zero particles and zero bloom.
- The frame-budget guard's CPU budgets and long-frame ratios are **written as placeholders and replaced
  by S-21's first measured run**; they are reasoned starting values, not measurements, and the ledger
  says so.

**Verification:** `npm run check` · `npm test` · `npm run build` · `npm run test:release`

**Size: L.** Six zones of authored data (only zone 0's palette is specified numerically today — the other
five need an art pass or explicitly-labelled placeholder palettes, G-18), a shader backdrop, a bloom
chain whose transform is easy to get subtly wrong, a pooled SoA store, a hysteretic degradation guard,
and an accessibility limiter that has to be right rather than approximately right.

---

### S-14 — Audio-reactive pipeline and the projection firewall proof

**Goal:** live music drives the visuals, and a test proves it cannot reach the simulation.

Spec: `docs/stacked/spec/visuals.md` §7–§8.

**Files**
- new `apps/portal/src/audio-band-analysis.mjs` — pure band/flux/onset math, **no Web Audio import**,
  Node-testable against synthetic spectra.
- new `apps/portal/src/arcade-audio-analyser.mjs` — the graph
  `source → musicGain → analyserSmooth → destination`, plus `analyserRaw → silentGain(0) → destination`.
  **No `AnalyserNode` exists anywhere in the portal today**; this is new parent-side surface, and a child
  iframe cannot build a Web Audio graph over an element it does not own, which is why it lives here.
- new child-side ingest/interpolate/idle module + `applyAudioMappings`.
- changed `apps/portal/main.js` — create the analyser when a STACKED session mounts and suspend it on
  destroy; add the `musicGain` branch to `applyArcadeMusicVolume()` **returning the computed product,
  not `audio.volume`**; pump `portal:audio-frame` at 30 Hz.
- changed `apps/portal/src/stacked-bridge-protocol.mjs` — the `portal:audio-frame` message, all-integer
  payload, exact-key validated.

**RED tests first**
- `tests/stacked-audio-band-analysis.test.mjs` — bin boundaries at 44,100 and 48,000 Hz; adaptive
  floor/ceiling convergence so a synthetic loud track and a synthetic quiet track normalise comparably;
  onset hysteresis with no double-fire inside the refractory window and no missed onset after a sustained
  loud passage; the silence gate.
- **`tests/stacked-projection-firewall.test.mjs` — the load-bearing test.** A headless harness drives a
  fixed 20,000-tick input fixture under **twelve** combinations: three tiers × three audio states
  (absent / silent / a scripted non-random loud sequence), plus minimal effects, plus the frame-budget
  guard forced to its lowest level, plus reduced motion with reduced flash. All twelve result hashes must
  be byte-identical **and equal to the pure `simulateStackedRun` path with no renderer at all**.
  **Two things the twelve do not cover** — the thermal governor and every non-keyboard input path — land
  in S-15 and are proved by `tests/stacked-thermal-governor.test.mjs` and
  `tests/stacked-input-device-parity.test.mjs`. Those three files are the firewall's joint proof; the
  ledger must cite all three and must not describe the twelve as covering the governor.
- **Import-graph proof** — `apps/portal/src/stacked-sim.mjs` imports nothing from the audio-analysis
  module, the Pixi vendor, or any render module. This structural guarantee is worth more than any
  behavioural test.
- `tests/stacked-audio-graph.test.mjs` — a failed analyser construction leaves the parent's existing
  volume path untouched; `destroy()` reconnects the source directly to `destination` and restores the last
  computed product; the source node is created once and cached for the page lifetime.

**Acceptance bar**
- The arcade music player behaves identically with the analyser present, absent, and after a cabinet
  teardown. This is the failure mode that silences music for the rest of the session and it must be
  proven, not assumed.
- Twelve identical result hashes, plus the no-renderer path.
- The `portal:audio-frame` payload is all integers (bar its two booleans), exact-key validated, and stays
  inside the self-imposed 30 Hz send against a 60 messages/second ceiling in either direction. It is the
  **sixth** parent→child message type in contract §4.1 — `tests/stacked-bridge-protocol.test.mjs` must
  assert the six-message set, not five, or S-16's bridge test and this cycle's transport disagree.

**Verification:** `npm run check` · `npm test` · `npm run build` · `npm run smoke:portal` · `npm run design:security-audit` · `npm run test:release`

**Size: L.** A Web Audio graph that must not break a shipped player, an adaptive normaliser with six tuned
time constants that are plausible but unmeasured, and the twelve-case firewall harness.

---

### S-15 — Mobile layout, touch, gamepad, haptics, thermal governor

**Goal:** first-class 9:16, a touch scheme that produces the same deterministic mask stream as a
keyboard, and a device that degrades instead of dying.

Spec: `docs/stacked/spec/mobile.md`.
Contract: `STACKED-CONTRACTS.md` §2.3 — `STACKED_MAX_MOVE_STEPS_PER_TICK = 1` (structural),
`STACKED_MOVE_QUEUE_MAX = 9`, `STACKED_INPUT_BUFFER_TICKS = 4`, DAS `8` (`4..18`), ARR `2` (`1..6`),
DCD `0` (`0..8`), and the rule that all of it lives **outside** the sim.

**Files**
- new modules for the two-pass cell-size solver (feeding `layoutMatch`'s `scale`, never replacing it),
  safe-area insets, touch tuning, the gesture classifier, the on-screen pad layout, the intent-to-mask
  classifier, gamepad, haptics, and the thermal governor. **The quality-tier module is S-13's; import
  it.**
- changed `scripts/syntax-check.mjs`.

**RED tests first**
- `tests/stacked-layout.test.mjs` (extended from S-12) — golden solved layouts for nine viewports
  (390×844 dpr3, 360×800, 320×568, 428×926, 844×390, 568×320, 820×1180, 1180×820, 1440×900 dpr1); the
  cell bounds `14 ≤ cell ≤ 44`; `cell × snapResolution` integral on every one, with `snapResolution` from
  the **resolved** clamp chain and **not** from `resolutionCap`; **no control rect overlaps the board
  rect**; nothing inside the safe-area insets; the 20 playfield rows never clipped; the pass-1 branch
  never re-decided by pass 2.
- `tests/stacked-layout-hysteresis.test.mjs` — exactly one transition each way, and **no aspect inside the
  dead band changes the mode from either prior state** (the swapped-threshold bug that flips the mode on
  every re-solve); a 700×700 viewport whose visual height swings 90 px never changes mode.
- `tests/stacked-touch-gestures.test.mjs` — a just-under and a just-over case for **every** threshold; a
  diagonal flick does not hard drop; a fast horizontal drag banks steps into the move queue rather than
  dropping them; an uncoalesced jump banks at most `STACKED_MOVE_QUEUE_MAX` (9) and increments
  `droppedInputs` beyond it; a flick inside the spawn lockout is swallowed; a hard-drop pointer clears the
  soft-drop bit in the same tick and emits nothing after.
- `tests/stacked-commit-queue.test.mjs` — the classifier drains **exactly one move step per tick**
  (`STACKED_MAX_MOVE_STEPS_PER_TICK = 1`, structural in a one-byte mask), so crossing a 10-wide board
  costs ≤ 9 ticks / 150 ms; a zero-step frame does not drain the queue; the banked action survives to the
  next stepping tick; it is discarded after the documented bound; **a full 9-step drain does not trip the
  integrity gate's sustained-rate check.**
- **`tests/stacked-input-device-parity.test.mjs`** — the same intent list from synthetic keyboard, pointer
  and gamepad sources produces a byte-identical run result **and byte-identical evidence**.
- `tests/stacked-autoshift.test.mjs` — the ms→tick conversion is `clamp(round(dasMs / (1000/60)), 4, 18)`
  and the UI displays the snapped value; auto-shift is expanded in ticks inside the fixed step, stops at
  the wall, and re-arms on spawn / rotation / direction change; DCD sets remaining charge to
  `min(DAS, DCD)`; **no DAS path exists for gesture input**.
- `tests/stacked-thermal-governor.test.mjs` — step-down and step-up hysteresis; windows containing boot, a
  relayout or a resume are discarded; **the lowest and highest levels produce identical run results and an
  identical layout cell**.
- `tests/stacked-haptics.test.mjs` — no-op without `navigator.vibrate`; a `false` return disables the
  channel; the limiter supersedes rather than queues; forced off under reduced motion.

**Acceptance bar**
- Every threshold in the touch tuning table has a passing just-under/just-over pair.
- Device parity: one intent list, three input sources, one byte-identical result and one byte-identical
  evidence stream. The ledger must state plainly that this guarantees **determinism**, not **parity of
  difficulty** (R-14 / G-19).
- **This cycle completes the projection firewall's proof.** S-14's twelve-case harness covers neither
  the thermal governor nor any non-keyboard input path; `tests/stacked-thermal-governor.test.mjs` and
  `tests/stacked-input-device-parity.test.mjs` are what close those two, and the ledger must name all
  three files together. If either mechanism is later restructured, extend the S-14 harness rather than
  leaning on these two alone.
- Auto-shift is expanded **in ticks inside the fixed step**, never in milliseconds off the frame loop, so
  a 120 Hz phone and a 45 Hz phone emit the same edges.
- iOS ships with no haptics (no `navigator.vibrate` in a sandboxed iframe, and the design correctly
  refuses to fake it with audio). Recorded as a known platform gap, not worked around.

**Verification:** `npm run check` · `npm test` · `npm run build` · `npm run test:release`

**Size: L.** Nine modules, a two-pass cell solver with a hysteresis band, a gesture classifier with a
dozen thresholds, and the parity proof that ties them all back to one 8-bit alphabet.

---

### S-16 — Bridge, host, lifecycle: Free Mode playable behind `?devCabinets=1`

**Goal:** the first end-to-end milestone — a real person plays a real Free run in the real portal.

Spec: `docs/stacked/spec/portal.md` §3–§5, `docs/stacked/spec/versus.md` §2.8 (the pinned interruption
and state-change matrix — implement its **solo** columns; retrofitting pause semantics into a lockstep
match later is a protocol change, not a UI change). Contract: `STACKED-CONTRACTS.md` §4.1 (**six**
parent→child message types, including `portal:audio-frame`), §4.5, and the Free-mode DOM ids in §3.

**Files**
- new `apps/portal/src/stacked-bridge.mjs`, `stacked-host.mjs`, `stacked-portal-lifecycle.mjs` (the only
  new module allowed to import `arcade-core.mjs`).
- new `apps/portal/src/games/stacked/loader.mjs`.
- changed `apps/stacked/src/main.mjs` — bridge → sim, sim → render, parent audio → render. Wiring only.
- changed `apps/portal/main.js` — mount / destroy / restart; a `CABINET_MOUNTS` table replacing the
  growing if-chain; teardown added to `returnToOfficialGameMenu`, `exitToArcade` and the global key
  handlers.
- changed `apps/portal/src/routes/official-play-routes.mjs` — a `cabinetLoaders` map replacing the named
  `loadChikunGame` parameter; a STACKED gameplay-header copy branch.
- changed `apps/portal/index.html` — `#officialFreeModeOptions`, `#officialFreeStartLevel` and
  `#officialFreeStartLevelValue`, placed as a **sibling after** the mode grid (a range input inside a
  button is not operable, and a third child of a two-column grid becomes a third card).

**RED tests first**
- `tests/stacked-bridge-protocol.test.mjs` — exact-key accept/reject for every message type in both
  directions; the serialized byte cap; `session.seed` an integer in `[0, 0xffffffff]`;
  `fixedStepHz === 60`; `session.rankedEligible === (mode === 'ranked')`; the `gameId` literal
  `'stacked'`; the `sessionId` and `messageId` patterns.
- `tests/stacked-parent-bridge.test.mjs` — child-origin equality on the iframe `src`; `sessionId` binding
  on every child message; a replayed `messageId` rejected; a protocol error tears the bridge down.
- `tests/stacked-host.test.mjs` — `dataset.embeddedCabinet` is set to `'stacked'` on mount and deleted on
  destroy **only when it still equals `'stacked'`** (chikun's guard; HMH's unconditional delete is the bug
  to avoid, and without the flag phones draw the parent touch controls over the cabinet); a READY timeout
  destroys the session; `mount.replaceChildren(iframe)` leaves exactly one iframe.
- `tests/stacked-portal-lifecycle.test.mjs` — the `inFlight` latch rejects a concurrent second result
  before the first resolves and the `finalized` latch rejects a later one; a malformed payload is rejected
  by the lifecycle's **own** shape check; a restart for a ranked session is refused **at the host**, not
  merely hidden in the UI. **Free-mode isolation asserted precisely**: no cadence row, no flat-leaderboard
  row, no `paidRuns` increment, no XP change, no `updateProgressFromRun` effect, no achievement unlock, no
  persist call — *not* "mutates nothing", which is false, because `recordScore` reaches `ensureProfile` /
  `ensureGameProgress` before the eligibility short-circuit.
- `tests/stacked-run-lifecycle-states.test.mjs` — pause, hidden-tab catch-up, resize mid-run, and
  interruption behave as the interruption matrix states, for the solo columns; every loop stop synthesises
  a mask-`0` release record.

**Acceptance bar**
- With `?devCabinets=1`: splash → floor → STACKED card → mode select → Free → gameplay mounts exactly one
  `<canvas>` in exactly one iframe → scripted inputs produce a real line clear → top out → results screen
  → exit to the floor, with **zero page errors, zero console errors, and zero CSP violation reports**.
- Instant restart works in Free and is refused in Ranked at the host.
- The starting-level selector appears for STACKED and is `hidden` on every other cabinet and every Ranked
  path.

**Verification:** `npm run check` · `npm test` · `npm run build` · `node scripts/stacked-ranked-browser-smoke.mjs` in free mode (both viewports, sequentially) · `npm run smoke:portal` · `npm run smoke:portal:interactions` · `npm run design:security-audit` · `npm run test:release`

**Size: L.** Three new parent modules, a bridge in both directions, mount and teardown inside a
14,000-line `main.js`, and the first cycle where all three tracks have to agree.

---

### S-17 — Player settings and the cabinet settings registry

**Goal:** handling, quality and accessibility editable in-run and out-of-run, without forking a
120-line HMH-shaped panel.

Spec: `docs/stacked/spec/portal.md` §12.

**Files**
- new `apps/portal/src/stacked-player-settings.mjs` — a strict sibling of `hmh-player-settings.mjs`;
  storage key `stacked-player-settings-v1`; normalize on every read, never trust storage.
- new `apps/portal/src/cabinet-settings-registry.mjs` — `gameId -> buildSettingsModel(settings)` returning
  sections of controls with a **read/write pair per control** (the existing panel reads from two different
  stores, so a single dotted path cannot express it).
- changed `apps/portal/main.js` — the settings panel renders the model generically; the HMH model is
  today's panel expressed as data.
- changed `apps/portal/src/routes/official-shell-routes.mjs` — a per-cabinet settings card.

**RED tests first**
- `tests/stacked-player-settings.test.mjs` — every clamp: `dasMs` snapping into `4..18` ticks, `arrMs`
  into `1..6`, `dcdMs` into `0..8`, quantised **at the moment they are applied**, never held as
  milliseconds against a wall clock; **`SOFT_DROP_FACTOR` is asserted NOT to be a player setting** (it is
  a frozen sim constant read inside `step()`; a per-player value would have to travel in the evidence
  header and be applied by the verifier); a keyboard rebind throws while a ranked run is active; a corrupt
  stored blob normalises to defaults.
- `tests/cabinet-settings-registry.test.mjs` — the HMH model's rendered DOM is **byte-identical** to
  today's panel for a fixed settings fixture.
- `tests/stacked-settings-hot-frozen.test.mjs` — every setting marked frozen is refused mid-Ranked; every
  hot setting applies immediately and changes no simulation value; the quality override is boot-only and
  says so in the UI.

**Acceptance bar**
- HMH's settings panel DOM is unchanged, proven against a captured fixture.
- No frozen setting can change mid-Ranked; no hot setting can reach `snapshot()`.
- Handling values are quantised to whole ticks at apply time, and the UI displays the snapped value, so
  the number the player sees is the number the run uses.

**Verification:** `npm run check` · `npm test` · `npm run visual:responsive` · `npm run smoke:portal:interactions` · `npm run test:release`

**Size: M.** The registry is straightforward; the byte-identity proof for HMH's existing panel is the cost.

---

### S-18 — Ranked integrity: plausibility gate, replay claim, verified stamp, trust column

**Goal:** a Ranked run is written from the parent's own re-simulation, and the verdict survives a reload
and is actually visible.

Spec: `docs/stacked/spec/integrity.md` §4–§5.
Contract: `STACKED-CONTRACTS.md` §4.3 (three hashes, three jobs; `resultHash16` on the row), §4.5 (the
six-step validation order and the sixteen-field gate signature), §2.5 (the gate imports
`GARBAGE_INTERVAL_FLOOR_TICKS`, and `GARBAGE_RISE_INTERVAL_FRAMES` does not exist).

**Files**
- new `apps/portal/src/stacked-run-integrity.mjs` — `STACKED_INTEGRITY_TOLERANCE`,
  `deriveStackedRunCeilings`, `validateStackedRunPlausibility`, with **every ceiling imported from
  `stacked-contracts.mjs`, never retyped**, and `maxGarbageRowsReceived` / `maxGarbageGroups` computed as
  `floor((ticks - GARBAGE_START_TICK) / GARBAGE_INTERVAL_FLOOR_TICKS) + 1`, clamped at 0 below
  `GARBAGE_START_TICK`.
- changed `apps/portal/src/stacked-cabinet.mjs` — `startStackedRankedSession()`, which calls
  `startPlaySession({ wallet, gameId, mode: 'paid' })` and **forwards neither `sessionNonce` nor
  `urlSessionId`** (closing the in-product seed-shopping path); `buildStackedReplayClaim`;
  `verifyStackedReplayClaim({ expectedSeed, expectedBuildHash, expectedSeasonId, … })`;
  `assertStackedVerifiedStamp` identity-checked against an in-page `WeakSet`.
- changed `apps/portal/src/stacked-portal-lifecycle.mjs` — validate → reassemble → decode → gate →
  re-simulate (in the Worker when constructible, inline otherwise, behind a visible verifying state) →
  gate again → stamp → `recordScoreRef(state, session, canonical.score, runStats)`; checkpoint saved at
  start and cleared with `{ submitted: true }` after a successful write, which is what finally populates
  `submittedSessionIds` (no cabinet has ever done so — the reachable call site passes
  `{ submitted: false }`).
- changed `apps/portal/src/arcade-core.mjs` — register the STACKED verifier via `registerRunVerifier`;
  `recordRunIntegrityVerdict`; `leaderboardRowTrust` reads `row.runStats.trustVerdict` ahead of the
  session lookup.
- changed `apps/portal/src/leaderboard-seed.mjs` — a replay-verified provenance in
  `leaderboardEntryProvenance` and `filterLeaderboardEntriesBySource`.
- changed `apps/portal/src/routes/official-leaderboard-route.mjs` — render the trust label for a
  cabinet-owned verdict instead of the literal `LOCAL`.

**RED tests first**
- `tests/stacked-run-integrity.test.mjs` — one case per reject flag and one per suspect flag, each firing
  on its own; the flag code for the four-line-clear check is **`quad-clears-exceed-lines`**; **an inflated
  `garbageRowsReceived` is rejected on its own terms and does not widen `maxLines`**; a `NaN` field is
  rejected rather than passing every ceiling; a run whose `bagDraws` exceeds `6 * bagRefills` by a few
  (simulated `nextBelow` rejections) still returns `ok`; a 20-second high-rate sprint returns `ok` (the
  sustained-window guard); a realistic 20-minute run returns `ok`; the gate takes exactly the sixteen
  documented fields and returns a frozen `{ ok, verdict, rankable, flags, ceilings }` with flags shaped
  `{ code, severity, detail }`; **a test that reads `stacked-portal-lifecycle.mjs` and asserts it imports
  and calls `validateStackedRunPlausibility`** — the assertion that keeps the gate wired.
- `tests/stacked-replay-claim.test.mjs` — the tamper matrix, each case asserting a **throw**, not a falsy
  return: wrong seed · a seed not derivable from the `sessionId` · wrong `buildHash` · wrong `seasonId`
  (`stacked-season-preview-1`) · an altered claim version · score mutated by 1 · any single secondary stat
  mutated · mutated `boardHash` · mutated RNG cursors · mutated `bagRefills` · one input tick removed /
  added / reordered · truncated evidence · altered `fixedStepHz` · a missing or duplicated chunk index · a
  null-prototype claim · an extra key · a stamp object not in the lifecycle `WeakSet`.
- `tests/stacked-portal-lifecycle.test.mjs` (extended) — the score written is `canonical.score`, never the
  submitted number; each of the six payload-validation steps fails closed with its own reason code; a
  verification throw yields a rejected verdict with **no** leaderboard write; a `Worker` constructor that
  throws falls back inline and still produces a verdict; the replay blob is written **after** the score
  write, so storage never holds a replay for a run that did not rank.
- `tests/stacked-trust-column.test.mjs` — a verified row renders its trust label after a full save/restore
  round trip at `ARCADE_PERSIST_VERSION = 3`, from the three small fields carried inside the persisted
  `runStats` bag.

**Acceptance bar**
- The three verified trust-column defects are fixed **together**: the verdict is written, it survives a
  reload, and the badge renders it. Fixing any two of the three produces a correct verdict nobody can see.
- Every `reject` flag is a combinatorial impossibility or an exact identity, so no legitimate run trips
  one; every `suspect` flag still ranks and is marked for review. The one judgement number
  (`SUSTAINED_PPS_SOFT`) is **soft-only**, so a wrong guess flags rather than blocks, and the ledger says
  it must be re-derived from the first ~100 real ranked runs.
- Row copy says **"Replay verified"**, never "Verified". The existing on-screen disclosure that official
  anti-cheat verification is still in progress **must not be softened**.
- All hashing happens before `recordScore`, which stays synchronous.

**Verification:** `npm run check` · `npm test` · `npm run design:integrity-bounds` · `npm run design:security-audit` · `npm run test:release`

**Size: L.** A gate whose ceilings are derived rather than guessed, an async hashing path that must not
make `recordScore` async, a Worker with an inline fallback, and three fixes to shipped trust rendering
that only work as a set.

---

### S-19 — Achievements: 16 definitions, resolver, badge atlas, Free medal shelf

**Goal:** Ranked play unlocks STACKED badges and only STACKED badges, and Free play still shows progress.

Spec: `docs/stacked/spec/portal.md` §10. Ids: `STACKED-CONTRACTS.md` §1.1 and §3 —
`stacked-first-quad` (`STACKED_FIRST_QUAD`) and `stacked-quad-10` (`STACKED_QUAD_10`) carry the frozen
`quad` root; their **titles** (`Halving Day`, `Ten Halvings`) are display copy and move with G-1.

**Files**
- changed `apps/portal/src/arcade-core.mjs` — the 16 `defineAchievement` entries (`gameId: 'stacked'`) and
  the STACKED resolver.
- regenerated badge PNGs and `HMH_ACHIEVEMENT_ATLAS` via `npm run assets:hmh:achievement-atlas`
  (`achievementCount` moves 57 → 73).
- new child-side `free-medals` module — device-local `stacked-free-medals-v1`, results-screen only, never
  in the arcade save and never over the bridge.

**RED tests first**
- `tests/stacked-achievements.test.mjs` (completed) — all 16 ids **and titles** unique across
  `ACHIEVEMENT_DEFINITIONS`; ids carry the `quad` root, not the display name; a Free session unlocks
  nothing; a Ranked STACKED session unlocks no `lester-blaster`-scoped badge; the resolver is a pure
  function of `(runStats, progress)`; every threshold field it reads is present in the 16-key projection;
  every `unlockType` and `difficulty` value is one the atlas already knows (an unknown `unlockType`
  resolves its icon to `null`).
- `tests/hmh-achievement-atlas.test.mjs` — passes with the regenerated atlas. It iterates every achievement
  and asserts the unlocked and locked PNGs exist and that tier/unlockType match the definition, so **the
  definitions and the regenerated atlas must land in one commit** or `npm test` and `vercel:build` both
  fail on 32 missing files.
- `tests/stacked-free-medals.test.mjs` — the shelf never reaches `profile.achievements`,
  `achievementSummary`, or the bridge.

**Acceptance bar**
- 16 definitions, 32 badge files, one atlas manifest, one commit.
- No tier inversion: no achievement whose threshold strictly implies another's sits at a lower tier.
- The two threshold values derived from assumed placement rates are labelled in the ledger as the
  least-grounded numbers in the set, with a note that regenerating the atlas makes them expensive to
  change later (G-19 context, and the reason to get them approximately right now).
- Profile copy states plainly that Free medals are practice-only and stay on the device.

**Verification:** `npm run check` · `npm test` · `npm run assets:verify` · `npm run test:release`

**Size: M.** Mechanically simple; the constraint is that the atlas generator's colour maps are closed
dictionaries, so the set may only reuse existing tiers and unlock types.

---

### S-20 — STACKED leaderboard columns and profile surfaces

**Goal:** the numbers a player earned are visible and correctly sorted.

Contract: `STACKED-CONTRACTS.md` §4.4 — the six columns are `score` · `linesCleared` (`LINES`) ·
`survivalTicks` (`SURVIVED`, rendered `ticks / 60`) · `maxCombo` (`COMBO`) · `quadClears` (`HALVING`) ·
`level` (`LVL`).

**Files**
- changed `apps/portal/src/game-stat-schema.mjs` — register the STACKED schema: those six columns, the
  tie-break comparator, the stat cells, the cadence rank strip, the breakdown cards, the recent
  ranked-run line, the empty-state copy, `reduceProgress`, `trustFor`.
- changed `apps/portal/src/routes/official-leaderboard-route.mjs` — route the STACKED game tab's
  `routeState.source` so a first visit does not render an empty board under a verified-ranked heading.

**RED tests first**
- `tests/stacked-leaderboard-profile.test.mjs` — a ranked `recordScore` writes one row into all five
  cadences and the flat top-10; the stored `runStats` bag contains **exactly** the 16 projected keys,
  asserted as an exact set; the tie-break comparator orders a fixture correctly and the per-wallet dedup
  uses the same comparator; the `HALVING` column header reads the display name while the underlying key is
  `quadClears`; the STACKED profile tab renders from `profile.progress.stacked.custom`, **not** from the
  unpersisted `state.sessions`; **`progress.custom` holds exactly the eleven documented keys and no
  twelfth** (`portal.md` §2.5 — there is no `custom.versus`; the two-player reservation lives only in
  `summary.versus`, contract §4.4); the cadence rank strip renders an em-dash where `playerRank` is
  null. **That em-dash is a rendered value, not copy-sheet text**, and `collectStackedCopyTexts()`
  excludes it (`portal.md` §9.2, `gates.md` §4.10) — otherwise this assertion and S-22's `em-dash`
  banned-pattern scan collide.

**Acceptance bar**
- Ranking is on **ticks**; the rendered `m:ss` is `ticks / 60`; the sort key and the rendered string come
  from the same schema expression.
- A reload preserves every profile stat cell, because none of them reads unpersisted state.
- HMH and Chikun boards and profiles are unchanged, re-proven against S-09's fixtures.

**Verification:** `npm run check` · `npm test` · `npm run visual:responsive` · `npm run smoke:portal:e2e` · `npm run smoke:portal:e2e:mobile` · `npm run test:release`

**Size: M.** Data, given S-09 did the structural work. Its risk is entirely in re-proving S-09's
no-change property still holds.

---

### S-21 — Gate build-out: visual regression, performance smoke, soak, security sweep

**Goal:** convert every promise in the design into a command that fails.

Spec: `docs/stacked/spec/gates.md`.

**Files**
- new `scripts/stacked-visual-regression.mjs` — **imports** the HMH signature constants and helpers rather
  than re-declaring them (the HMH script guards its runner behind an `isMain` check, so importing executes
  no capture). Baselines are luma-signature JSON under `docs/testing/VISUAL_BASELINES/stacked/`.
- new `scripts/stacked-performance-browser-smoke.mjs`, `scripts/stacked-browser-soak.mjs`,
  `scripts/stacked-touch-browser-smoke.mjs`, `scripts/stacked-ranked-browser-smoke.mjs`. All honour
  `STACKED_BROWSER_EXECUTABLE` and `STACKED_ORIGIN` — do **not** copy the HMH smoke's hard-coded
  `executablePath`.
- changed `scripts/responsive-matrix.mjs` — add one `stacked-mode-select` state.
- changed `scripts/hmh-security-audit-sweep.mjs` — add `apps/stacked` to `scopeDirs`.
- changed `package.json` — `visual:stacked`, `visual:stacked:accept`, `smoke:stacked:performance`,
  `smoke:stacked:touch`, `test:soak:stacked`, `test:soak:stacked:mobile`. (`test:soak` is 30 minutes and
  is not reused.)

**RED tests first**
- The gates themselves are the tests, and each must be observed **failing first** against a deliberately
  broken build: a scene whose signature is all zeros must fail (a failed capture is not a pass); the entry
  byte cap must fail with the Pixi plugin predicate reverted; the soak must fail with the particle pool
  leaked; the flash-per-second assertion must fail with the limiter disabled.
- `tests/stacked-telemetry-contract.test.mjs` — the dataset keys the smoke and soak read are the keys the
  renderer publishes on `#stackedStage` (`qualityProfile`, `reducedMotion`, `renderResolution`,
  `renderedParticles`, `particlePoolSize`, `simulationTick`, `runScore`, `garbageRowsInserted`,
  `runRestarts`, `longestRunTicks`, `assetsReady`), so a copied harness never asserts on `NaN`.
  **`qualityProfile` is asserted to be one of `desktopHigh` / `desktopLow` / `mobile`, with
  `reducedMotion` as a separate boolean** — contract §2.6's vocabulary, which `docs/stacked/spec/gates.md`
  §6.1 already asserts. Assert too that `renderedParticles` is **greater than zero** under the
  `reduceMotion` modifier (it scales particle motion, it does not disable particles) and exactly zero
  only under `stackedEffects=minimal` or guard level 3. Telemetry is gated behind `telemetry=1` so a Ranked player's live
  score is not sitting in the DOM of a shipped build.

**Acceptance bar**
- Every threshold is recorded in the cycle ledger **as a measurement**, and any loosened threshold is
  changed with its measurement quoted beside it. This is the cycle that replaces S-13's placeholder CPU
  budgets with numbers.
- All visual scenes settle on both `dataset.simulationTick` and `dataset.renderTick` across two consecutive
  reads before capture, and `dataset.rootScale` is published so a mismatch is readable.
- The photosensitivity limit holds across a 30-second scripted run including a `HALVING`, a level-up, a
  zone transition and a top-out.
- The 40-minute soak is green on desktop and mobile, **run sequentially**, with a PID lock, and a minimum
  tick advance proving the run actually simulated rather than a tab idling.
- `dist/stacked/game.js` does not contain the string `soak-pilot`.
- The security sweep passes with `apps/stacked` in scope. All cabinet UI is `createElement` +
  `textContent`; no `.innerHTML =` anywhere in the portal-side modules or the tests. The ledger states that
  the sweep's name overstates its coverage until `apps/hmh-reboot` and `apps/chikun` are added too.
- A manual on-device pass on the reference phone class is recorded, because the mobile frame budget is
  arithmetic, not measurement.

**Verification:** `npm run check` · `npm test` · `npm run build` · `npm run visual:stacked` · `npm run visual:responsive` · `npm run smoke:stacked:performance` · `npm run smoke:stacked:touch` · `npm run test:soak:stacked` · `npm run test:soak:stacked:mobile` · `npm run design:security-audit` · `npm run design:third-party-security` · `npm run repo:health:strict` · `npm run test:release`

**Size: M.** Four harnesses ported from working precedents, but every browser gate runs serially and two
40-minute soaks time the cycle rather than the code.

---

### S-22 — Ship gate

**Goal:** flip the cabinet public and enable Ranked writes, in one commit, under owner approval.

**Files (one commit — they must move together)**
- changed `apps/portal/games/stacked/game.manifest.json` — `status: 'playable'`, `version` matching
  `STACKED_CABINET_VERSION`.
- changed `apps/portal/src/arcade-core.mjs` — `ARCADE_GAMES` `status: 'playable'`, `publicPlayable: true`;
  app-shell `status: 'playable'`, `playable: true`, `leaderboardEligible: true`.
- changed `README.md` — a roster row keyed exactly on the manifest `name`, with a State cell carrying **no**
  coming-soon phrase and a stated semver equal to `manifest.version`.
- changed `AGENTS.md`, `docs/THIRD_PARTY_GAME_ONBOARDING.md` — swept for the naming trap.
- new `docs/stacked/cycles/CYCLE-022.md`; a `CHANGELOG.md` release heading carrying the mandatory
  verbatim **Deployment boundary** paragraph; **at least five narrative entries appended to the
  repo-root `DECISIONS.md`** in its existing four-part form (`gates.md` §8.4 names the five); and
  `docs/stacked/DECISIONS.md` — the **different** file S-01 created — brought current, with every one
  of the nineteen owner gates marked answered or explicitly still open. The ship check is two counts:
  nineteen gate records in the first file, five-or-more narrative entries in the second.

**RED tests first**
- `tests/stacked-copy-sheet.test.mjs` — the forbidden genre trademark, and the trademarked term for a
  four-line clear, appear in **none** of the copy sheet, the manifest, the STACKED entries in
  `arcade-core.mjs`, any STACKED achievement id/title/description, the evidence/claim/protocol version
  strings, the particle preset ids, or the child's user-facing string table, in any case; the four-line
  clear is referred to only by its approved in-universe display name (`HALVING` unless G-1 rules
  otherwise) and every identifier uses the frozen `quad` root; the copy-sheet style rules hold.
- `npm run docs:cabinets`, run **first with the roster row missing** so the failure is observed.

**Acceptance bar**
- `npm run docs:cabinets` green with the manifest playable and the roster row present.
- `tests/stacked-copy-sheet.test.mjs` is green and was observed **failing first** — it is one of the
  two mandatory ship-gate tests (contract §2.10) and the only machine check that D-2's trademark rule
  holds in shipped strings. Its `em-dash` banned pattern governs authored copy only;
  `collectStackedCopyTexts()` excludes rendered placeholders such as the cadence rank strip's `—`
  (`portal.md` §9.2), or it collides with S-20's assertion that the strip renders one.
- **The naming trap is clear**: no line in the three governed docs contains the word "stacked" (any case,
  whole word or prefix) alongside any coming-soon phrase, and no coming-soon line sits under a heading
  naming the cabinet. Verified by running the gate, not by reading.
- `npm run vercel:build` green. A new deployment candidate is **declared** in the ledger and **not
  promoted**.
- `entryFeeMicroUsdc` is still `0`, `SETTLEMENT_LIVE` is still `false`, `devWallet` unchanged, no contract
  touched.

**Verification:** the full ship list — `npm run check` · `npm test` · `npm run test:release` · `npm run docs:cabinets` · `npm run docs:links` · `npm run assets:verify` · `npm run contracts:check` · `npm run design:security-audit` · `npm run design:third-party-security` · `npm run design:tokens` · `npm run repo:health:strict` · `npm run visual:stacked` · `npm run visual:responsive` · `npm run smoke:stacked:performance` · `node scripts/stacked-ranked-browser-smoke.mjs` (both viewports, sequentially) · `npm run smoke:portal` · `npm run smoke:portal:interactions` · `npm run vercel:build`

**Size: S in bytes, and it is the only cycle that cannot start without an owner.** Gates G-1, G-2, G-3.

---

## 4. Parallelization

**Strictly sequential, no exceptions.**
- **S-01 before everything.** Nothing else may start.
- Track A: **S-02 → S-03 → S-04.** The codec is defined against the result tuple, and the tuple against
  the rules.
- Track C: **S-11 → S-12 → S-13 → S-14.** Audio consumes the mapping targets S-13 creates; S-12 cannot
  build without S-11's entry point and externalized vendor.
- **S-09 → S-10 → S-20.**
- **S-04 + S-16 → S-18.** Integrity needs both the codec and a live lifecycle.
- **Everything → S-21 → S-22.**

**Safely parallel.**
- Tracks A (pure sim), B (portal data plumbing) and C (build + rendering) are independent after S-01 and
  touch disjoint files, with the collision exceptions below.
- **S-07** can land at any point after S-01, and is worth landing early because it repairs a live problem
  for two shipped cabinets.
- **S-05** runs alongside S-09 / S-11 / S-12 once S-03 lands.
- **S-13 and S-15** are parallel (`render/` vs the input/cell-solver modules). S-13 owns
  `quality-tier.mjs`; S-15 imports it and defines no tier module.
- **S-19 and S-20** are parallel after S-18.
- **S-06 and S-07** are parallel with the whole of track A.

**Shared-file collision points that force serialisation even across tracks.**
- `scripts/syntax-check.mjs` — touched by nearly every cycle. Trivial merges, but never two cycles in one
  branch without rebasing.
- `apps/portal/src/arcade-core.mjs` — S-06, S-09, S-10, S-18, S-19 all edit it. Land them in that order.
- `apps/portal/src/stacked-layout.mjs` and `tests/stacked-layout.test.mjs` — created by S-12, extended by
  S-15. S-15 rebases on S-12.
- `build.mjs` and `scripts/hmh-reboot-bundle-budget.mjs` — S-11 owns both; S-12's vendor-symbol change must
  land after S-11's cap split, or the red build is unreadable.
- `apps/portal/main.js` — S-07, S-14, S-16, S-17 all edit it.
- `vercel.json` — S-11 only. A second edit is a second certification candidate.
- **Never run two browser gates concurrently**, including across parallel cycles on one machine. S-21's
  soaks are wall-clock serial by construction.

---

## 5. Later phases — named, scoped, not detailed

Real, designed for, and **none of them in Phase 1**. Each gets its own plan section when scheduled.

| Phase | Scope | What Phase 1 already paid for | Owner gate |
| --- | --- | --- | --- |
| **P2 — Local two player** | Two boards on one canvas, one keyboard split or two gamepads, side-by-side in 16:9, no network, no profile write. | `layoutMatch` already returns two slots and is tested; `boardSlot[1]` exists and is hidden; the match root is constructed once; `STACKED_ATTACK_TABLE` is frozen data with zero consumers. | Whether a couch match that leaves zero trace is acceptable, or wants a machine-local scoreboard. Also whether tablet-portrait local 2P is supported at all (it needs a stacked-pair layout below the 900 px width floor). |
| **P3 — Same-seed local ghost** | A second, non-interactive board replaying the player's own best run on the same seed. Projection-only; never a Ranked input. | Ranked input recording and `replayStackedRun` make it nearly free. Chikun's ghost is the shipped precedent. | Replay retention (2 per browser today) and the storage key shape change with it. Whether a ghost may ever use another player's recorded stream without explicit opt-in. |
| **P4 — Results replay viewer** | Seek-safe animated playback of a finished run from its stored SIC1 stream. | The codec, the deterministic sim, and the replay store. Chikun's seek-safe viewer is the precedent. | Retention and storage key shape; whether Free mode records evidence at all. |
| **P5 — Daily challenge seed** | A parent-owned daily UTC seed with its own board. | `deriveSessionSeed` and the cadence engine already do this for Chikun. | Whether the daily board is a sixth cadence or its own `gameId`. |
| **P6 — Online two player** | Matchmaking, a server-authoritative relay, delay-based lockstep, rating. | The lockstep-capable sim, `createStackedMatch` as the garbage-router seam, one input byte per tick, `stateHash()`, the frozen attack table, and `summary.versus`'s seven reserved integer zeros in the run summary. **Not** the progress record: `progress.stacked.custom` is eleven keys in Phase 1 and gains its twelfth (`roundsPlayed`) in this phase's own commit. | **Large — G-16.** Backend choice, relay operator and recurring cost, a new `connect-src` origin, whether rating may live server-side (the first genuinely server-authoritative player state in the product), whether ranked versus charges an entry fee (and its refund problem on void/desync with no backend), whether the asymmetric forfeit deviation from canonical Glicko-2 is wanted, and whether versus is a column or a second board. |
| **P7 — Consistent cabinet art pass** | Every arcade cabinet redone to one art direction, replacing all placeholder SVGs including STACKED's. | Placeholders are hand-authored SVGs at documented paths with a test that resolves every reference. | Art direction, and its prerequisite: the shared rotator's hard-coded six-frame keyframes must become frame-count-driven before any cabinet gains a `desktopCabinetSprite`. |

---

## 6. Owner gates

Only the owner can give these. Agents do every part that does not depend on the gate, write the exact ask
into `docs/stacked/DECISIONS.md`, and stop. **Do not fake, mock, or work around an owner gate.**

Five of these are also stated as questions with options in `docs/stacked/STACKED-CONTRACTS.md` §5:
G-1, G-4, G-18, G-19, and the `SPAWN_DELAY_TICKS = 0` confirmation.

| ID | Decision | Blocks | Recommendation |
| --- | --- | --- | --- |
| **G-1** | **The player-facing name for the four-line clear** — `HALVING`, `LEDGER BLOCK`, or something new. | the copy sheet, S-22 | `HALVING`. **It no longer blocks S-02**: the display name is decoupled from the `quad` root used by the schema field, the achievement ids, the particle preset id and the flag code, so a rename touches copy strings and achievement titles only — no id, no seed, no stored replay. |
| **G-2** | **Flip the cabinet to `playable`.** | S-22 | Only after S-21's gates are green and the manual on-device pass is recorded. |
| **G-3** | **Enable Ranked leaderboard writes.** | S-22 | Ship it described as exactly what it is: a **local, unshared, zero-fee integrity prototype**. |
| **G-4** | **Confirm `STACKED_LEVEL_CAP = 30` and `STACKED_COMBO_BONUS_CAP = 20` ship.** Both are frozen on the recommendation; the design consequence should be seen, not discovered. | nothing (frozen), but a reversal after S-03 rotates every seed | Ship both. With a level cap, score above L30 grows linearly with survival time, so **the board ranks endurance with score as a skill weighting** — a 35-minute competent run generally outscores a 12-minute brilliant one. If that is unwanted, the fix is a secondary sort or a second board, not an uncapped multiplier. |
| **G-5** | **Pixi vendor chunk policy.** Grow the shared chunk, emit a renamed `arcade-pixi-v1.js`, or give STACKED its own — plus whether `HMH_INITIAL_JS_CAP` splits into vendor + per-entry caps. | S-11, S-12, S-13 | **Rename rather than edit.** `/dist/chunks/` is served `immutable` for a year with no content hash, so a mutated chunk cannot be relied on to reach returning browsers. |
| **G-6** | **A second `'unsafe-eval'` route.** Pixi's runtime program generation failed closed on the first custom-domain cutover under a strict policy; this would widen the exception from one route to two, and a CSP change requires fresh certification. | S-11 | Author strict, run the smoke, add it only on a recorded violation with the Pixi call site quoted in the ledger. Budget one extra certification pass. `worker-src 'self' blob:` goes in on day one either way. |
| **G-7** | **Ranked pause policy.** Uncapped, a budget (3 pauses / 120 s, and a 15-minute suspend limit with auto-submit were all proposed), or no pause at all — and whether an over-limit suspended run is submitted or discarded. | S-16, S-18 | Record `pauseCount` and `pausedWallClockMs` either way and decide from data. The pause budget is invented by the design and has no precedent in HMH or Chikun. |
| **G-8** | **Achievement scoping now, or a declared known defect.** Fixing it changes shipped Chikun and HMH behaviour (a Chikun ranked run already unlocks an HMH achievement today). | S-10 | Fix it, with the HMH no-regression fixture as the deliverable. A third cabinet makes the leak untenable. |
| **G-9** | **Season identity.** *Resolved in the contract as `stacked-season-preview-1`* (dedicated, following `chikun-season-preview-1`). Listed so the owner can object before S-06, because it feeds the seed. | S-06 | Dedicated. An HMH season rollover must not reset STACKED boards. |
| **G-10** | **Free Mode aids** — the undo-last-placement rewind (the only aid that rewinds simulation state), the starting-level range, and whether the device-local Free medal shelf satisfies "some achievements count in Free". A profile-visible Free achievement requires a deliberate isolation exception only the owner can authorise. | S-16, S-19 | Keep undo, keep the shelf device-local, do not breach isolation. |
| **G-11** | **Ghost piece on in Ranked.** Presentation-only and identical for every player; off is a one-line change that makes the mode materially harder than every game players compare it to. | S-16 | On. |
| **G-12** | **Where cabinet settings live** — new markup in the shared parent settings panel, or an in-cabinet pause menu the child owns. | S-17 | Registry-driven parent panel; a child menu forks the model. |
| **G-13** | **Gate placement.** Do the new browser gates join `vercel:build`, or only `ship:gate`? Adding Playwright and a Chrome binary to the Vercel build image (CPython 3.12 + Pillow, no `.git`) is almost certainly not viable. | S-21 | Ship gate only; `vercel:build` stays Node-only. |
| **G-14** | **Committed dev autoplay.** `stackPilot=1` is code that plays the game, and it is the only way to reach a 40-minute run in CI until a real recorded run exists. | S-05, S-21 | Accept it now; replace it with a committed 40-minute recorded input stream once one exists. |
| **G-15** | **Deployment promotion**, per deployment, by ID. Standing rule, restated because S-11, S-16 and S-22 each create a new certification candidate. | S-22 and any deploy | Never promote without naming the exact deployment. |
| **G-16 (later)** | **Online-multiplayer backend** — relay operator, recurring cost, a new `connect-src` origin, and whether versus rating may live server-side. | P6 | Do not start any P6 work before this. |
| **G-17** | **`pruneCadenceLeaderboards` is destructive on existing saves.** It deletes historical leaderboard buckets no UI has ever read, for HMH and Chikun as well as STACKED. Ship it inside S-07, or split it into its own approved change? | S-07 | Ship it in S-07 with the deletion disclosed in the ledger; the alternative is silent quota loss for every cabinet. |
| **G-18** | **Zone art scope.** `STACKED_ZONE_COUNT = 6` is frozen (the count feeds a run-summary bound and cannot float), but only zone 0's palette is specified numerically. The other five must satisfy hard constraints — red-ratio, deep-stop luminance, `bloomCap ≤ 0.35`, every mino colour at relative luminance ≥ 0.19, which rules out very dark blues and purples. Real art pass in Phase 1, or labelled placeholder palettes? | S-13, S-21 | Placeholder palettes for zones 1–5, replaced in a later art cycle. Palettes are data and cost nothing to replace; dropping to five zones later is a bound change and a `STACKED_CABINET_VERSION` bump. |
| **G-19** | **Cross-device Ranked fairness.** A keyboard player gets DAS wall-charge and a hard 1-tick ARR floor; a gesture-touch player gets neither (`STACKED_MAX_MOVE_STEPS_PER_TICK = 1` is structural), and touch sensitivity still varies ~1.6× to 0.9× across devices. One board with an `inputDevice` column, one board with a device filter, or separate boards? | S-15, S-20 | One board, `handling.inputDevice` shown as a column — the `handling` block collects the data from run one, and a column is reversible where a board split is not. Competitive-fairness call, not a technical one: the S-15 ledger must **not** describe its determinism proof as a fairness proof. |

**Explicitly not requested anywhere in this plan and not up for a gate here:** paid entry, a non-zero
`entryFeeMicroUsdc`, settlement activation, contract deployment, or a production promotion. Those need a
separate explicit HALT approval naming the exact action and candidate.

---

## 7. Risk register

| # | Risk | Impact | Mitigation / early warning sign |
| --- | --- | --- | --- |
| **R-1** | **A frozen contract gets re-opened implicitly, cycle by cycle, instead of through a `STACKED_CABINET_VERSION` bump.** | Two cycles implement two values; every replay stored before the reconciliation is void; the plausibility gate rejects legal runs. Highest-probability failure in the plan. | S-01's frozen module, byte-stable `contracts.json`, and duplicate-declaration scan. **Warning sign:** any commit after S-01 that declares a constant `STACKED-CONTRACTS.md` §2 lists, or a spec document being cited where the contract disagrees with it. |
| **R-2** | **S-09's extraction silently changes an HMH or Chikun rendered string.** | A regression in two shipped cabinets, found by a player, not a test. Nothing in the repo snapshots that DOM today. | Byte-identity fixtures captured **before** the change, as the first commit of the cycle; S-09 lands alone; `visual:responsive` must show zero changed cells. **Warning sign:** a fixture updated in the same commit as the refactor. |
| **R-3** | **Evidence exceeds the 65,536-byte bridge cap at real god-tier input rates.** Every byte budget rests on modelled transition rates (~20 per piece) with no measurement behind them. | A 35-minute run cannot submit — exactly the runs the leaderboard exists to rank. | Chunking at 42,000 raw bytes with a 33-chunk ceiling that provably sits above the byte ceiling, and S-04 asserts the **measured** size of a stress-rate stream. **Warning sign:** the first real long run's measured transition rate exceeding ~20/piece; well above that, `STACKED_MAX_STORED_REPLAY_CHARS` must be re-derived too. |
| **R-4** | **The audio graph breaks the arcade music player.** `createMediaElementSource` may be called once per element and permanently reroutes output; creating it in a realm that is later torn down silences music for the rest of the session. | Every cabinet loses music after one STACKED session. Not hypothetical — it is the default outcome of the naive approach. | The analyser lives in the parent; the source node is cached for the page lifetime; construction is in a try/catch that touches volume only on success; `destroy()` reconnects to `destination`. S-14 tests all three paths. **Warning sign:** any `createMediaElementSource` call inside `apps/stacked/`. |
| **R-5** | **Bundle budget.** `assertHmhInitialJsBudget` sees only entry + vendor and misses ~64 KB of shared chunks, so true HMH headroom is roughly 10 KB, not 75 KB. Added Pixi symbols consume it for code HMH never runs, and the unhashed vendor chunk is served `immutable` for a year. | A red HMH build blocking an unrelated cycle, or a returning browser stuck on a stale vendor chunk with no recovery. | G-5 decided before S-11; per-entry caps so a STACKED regression fails by name; **rename rather than edit**; before/after chunk sizes recorded in the S-11 ledger. **Warning sign:** any cap raised to make a red build green without a measurement quoted. |
| **R-6** | **Difficulty bands are unvalidated.** The model is closed-form with per-tier parameters asserted from judgement; no STACKED playtest data exists, and it cannot see burst dynamics. | The shipped curve misses every band and the fix is a tuning cycle after ship. | The model is a committed regenerable artifact with its assumptions named, and the tuning dials ranked by computed leverage. **Warning sign:** the first ten real runs clustering outside the predicted band for their tier. |
| **R-7** | **Performance budgets are arithmetic, not measurement.** The ≤1.0 ms desktop bloom, the 1.60 ms mobile bloom (resting on an assumed ~400 Mpx/s fill rate), the 6.50 ms Pixi render row, and the frame-budget guard's CPU thresholds are all derived. | The mobile tier misses 60 fps on the reference class and the bloom pass is rewritten late. | A documented fallback ladder (single wider blur pass before dropping the effect); the frame-budget guard degrades within a session; **a manual pass on the reference phone is a required S-21 deliverable**. **Warning sign:** the smoke's p95 sitting near its cap on an idle machine. |
| **R-8** | **Replay verification proves nothing about who played.** A script emitting frame-perfect masks and driving the sim headlessly in Node produces a claim that passes every check, in seconds, at a score no human will match. | Marketing or UI copy implying anti-cheat on a board that has none. | Ship it as a local, unshared, zero-fee integrity prototype and say so **in the product**. Keep the existing on-screen disclosure verbatim. Collect the Phase 1 replay corpus tagged with refresh rate and `handling.inputDevice` — input-timing statistics are the real anti-TAS signal and they need a human baseline. **Warning sign:** any copy change that removes "prototype" or softens the disclosure. |
| **R-9** | **Seed shopping is open and free.** `deriveSessionSeed` is a 32-bit FNV-1a over a caller-influenceable string; an offline UUID search finds a favourable seed in milliseconds with no session start and no simulation. | A ranked board topped by chosen-seed runs, with no detectable signal — an offline search leaves no abandoned checkpoints. | S-18's Ranked wrapper forwards no caller-supplied nonce, closing the in-product path. Nothing client-side closes the console path; say so in the UI rather than claiming a protection that does not exist. Fixed only by a server-minted session identity. |
| **R-10** | **The `stacked` naming trap.** Once the manifest is playable, the doc-drift gate fires against ordinary English: any line — or any line under a heading — combining "stacked" with a coming-soon phrase in three governed docs fails `npm test`. | A red build from a prose edit in a doc nobody thought was gated. | Documented in S-22's acceptance bar and verified by **running** the gate, not reading. **Warning sign:** the word "stacked" used as a verb or adjective in `README.md`, `AGENTS.md`, or the onboarding doc. |
| **R-11** | **`state.sessions` is not persisted**, so the profile's recent-runs list is empty after every reload, for every cabinet. | A STACKED profile card built on it is permanently blank, and it looks like a STACKED bug. | S-20 routes every durable stat through `profile.progress.stacked.custom`; the ephemeral list is labelled as such. This plan does **not** fix the underlying gap — migrating that list to a persisted history is its own cycle. |
| **R-12** | **Quota pressure drops all leaderboards for all cabinets.** Historical period buckets are never pruned, and a third cabinet triples the rate against a ~5 MB quota that also holds profiles and avatars. | Every board silently stops persisting, for every cabinet. | S-07 lands the prune early and game-agnostically; S-08's 16-key projection roughly halves the row; replays live outside `snapshotArcadeState` under their own 2-entry LRU. All three are needed. **Warning sign:** `saveArcadeState` reaching its second or third degradation step in any manual session. |
| **R-13** | **The trust column's three defects only work as a set.** Verdicts are never persisted, `state.sessions` dies on reload, and the badge renders `LOCAL` for every unsettled row. | Fixing two of three produces a correct verdict nobody can see — worse than no column. | S-18 fixes all three in one cycle with a save/restore round-trip test. **Warning sign:** a change touching `leaderboardRowTrust` without touching `leaderboard-seed.mjs` and the route. |
| **R-14** | **Cross-device Ranked fairness (G-19).** A keyboard player gets DAS wall-charge and a hard 1-tick ARR floor; a gesture-touch player gets neither, and the CSS-px move-step floor makes touch sensitivity vary ~1.6× to 0.9× across devices. A mid-run rotation changes it again. | One board ranks two materially different games. | S-15's parity test guarantees **determinism**, not **parity of difficulty** — different claims, and the ledger must not conflate them. Owner decides one board vs a device column vs a separate board. |
| **R-15** | **Browser gates are serial and each soak is 40 minutes per profile.** | S-21 and S-22 are wall-clock bound rather than code bound, and a parallel run silently produces meaningless numbers. | PID lock directories per profile, the standing serial rule, and S-21 scheduled as a full cycle rather than a tail on another one. |
| **R-16** | **The soak pilot may not be able to drive a meaningful 40-minute run at all.** A greedy placement policy that survives god-tier gravity is unproven. | The soak passes on a run that topped out at minute three, or on an idling tab — a green gate that proves nothing. | S-05's acceptance bar requires ≥ 80 % of the target tick count before S-21 depends on it; S-21 asserts a minimum tick advance. **Warning sign:** the pilot's median survival falling as the level curve steepens during tuning. |
| **R-17** | **Injected display-object constructors have no precedent in this repo.** Neither HMH nor Chikun does it, and it is the discipline most likely to be dropped under time pressure — at which point the single-`addChild` and two-board-readiness rules are enforced by code review alone. | P2 becomes a rewrite instead of a feature, and the render-tree test quietly stops testing anything. | S-12's render-tree test is written against stub constructors under `node --test`, so dropping injection breaks the test rather than passing silently. **Warning sign:** a real Pixi import appearing in a render module's test. |

---

## 8. Open questions still owned by the owner (not yet gates)

None blocks a cycle, but each should be answered before the thing it touches is frozen.

1. Are the session-length bands a **median** or a **p90** ceiling? The model predicts a median; if they
   are p90 targets, every tier's attainment parameter needs re-fitting before playtesting starts.
2. If beginner sessions come back short, the cleanest dial pushes beginner to ~3.2 min — outside the band —
   and barely moves intermediate. Is the beginner band or the single-clear-mints-nothing rule the one to
   bend?
3. Should `pauseCount` / `pausedWallClockMs` be a public leaderboard column, or an integrity-only field?
4. Should a `rejected` run appear on the board with a Rejected badge (transparency), or never be written
   (the current design)?
5. Should abandoned-Ranked-start counts be public on the profile, or internal? They are a weak signal, so
   publishing may overstate what they catch.
6. Should the STACKED boards ship with seeded house rows, or launch empty? The current design routes the
   game tab to the local source on switch, which is a workaround for launching unseeded.
7. **Mid-run resume across a page kill.** Phase 1 loses a Ranked run if the tab is unloaded. The persistence
   layer has a checkpoint slot, so it is technically cheap — but it creates a save-scumming surface that
   needs its own integrity design. Ship without, or fund the work?
8. Zone milestone ticks are derived from the session-length targets but are a feel decision. Is a beginner
   seeing only one zone in a 2–3 minute run acceptable, and is zone 5 at ~25 minutes — which most players
   never reach — the right place for the payoff zone?
9. Should the reduced-motion OS preference be one-directional (it can only turn reduced motion **on**, and
   a player cannot turn it back off from inside the cabinet)?
10. Should the on-screen-button scheme be **auto-selected** when the OS reports accessibility signals, or
    only offered? Auto-switching a control scheme is intrusive; the design defaults to offer-only.
11. Does `CHAIN` stay a flat ×1.5, or become an escalating chain? One line in a frozen table, but it changes
    the intended competitive feel and the versus blowout profile.
12. Does the I-piece's true 180 rotation ship as-is (it moves the bar one row down or one column left —
    mathematically correct, visibly a quirk), or is it kick-corrected to appear in place?
13. `FORK` detection uses the corner rule for the T-shaped piece and 4-way immobility for the rest, which
    accepts some flat placements as spins. Confirm guideline parity is preferred over strictness.
14. A 0-line spin scores its points but mints no `HASHPOWER`, to close a defence farm. Should a spin with no
    clear be worth points at all?
15. Does `rotate180` ship in Phase 1? It holds bit 6 of the frozen 8-bit alphabet and the schema is
    agnostic, but it is a feel decision — and bit 7 is the last one, so a ninth action forces
    `stacked-bridge/v2`.
16. `STACKED_MAX_SCORE` bounds a god-tier run comfortably, but a fixed-width leaderboard column may want a
    lower display cap or different formatting.
17. Should the ethers-in-the-cabinet finding (a large dependency shipped into a sandboxed child with
    `walletAccess: false`) get its own fix cycle for Chikun, or only the forward-looking import rule for
    STACKED?
18. Should `apps/hmh-reboot/` and `apps/chikun/` join the security-sweep scope in a follow-up? S-21
    deliberately adds only `apps/stacked` so the cycle cannot surface pre-existing findings — which means
    the gate's name overstates its coverage until that cleanup happens.
19. Should `CHANGELOG.md`'s heading sequence and `package.json`'s version be reconciled before the STACKED
    release entry?
20. Does STACKED ship as `1.0.0`, or as a labelled preview (Chikun shipped `0.5.0` as a vertical slice)?
    `STACKED_CABINET_VERSION` is frozen at `0.1.0` today; the README roster row's stated semver and the
    manifest must move together either way, and a version bump rotates every seed.
21. Does the mode-select key art get the same placeholder treatment as the cabinet art, or reuse existing
    committed art until a real pass?

---

## 9. Definition of done for Phase 1

- All 22 cycles ticked, each with a ledger entry at `docs/stacked/cycles/CYCLE-0NN.md` in the
  `CYCLE-072.md` shape: numbered scope, runtime/determinism evidence, verification list, honest note,
  boundaries.
- Every contract in `docs/stacked/STACKED-CONTRACTS.md` frozen in one module, regenerable, byte-stable,
  with no second declaration anywhere in the tree.
- Same-seed determinism proven across three quality tiers, three audio states, two accessibility modes, a
  pinned degradation level, and three input devices — **all against the pure no-renderer path**.
- A Ranked run is written from the parent's own re-simulation, never from the child's number; its verdict
  survives a reload and is visible on the board with honest copy.
- Free Mode writes nothing to the profile, the boards, XP, rank, achievements, or official sessions —
  asserted field by field, not as "mutates nothing".
- 9:16 and 16:9 both shipped and gated; the reference mobile class holds its budget in a **recorded manual
  device pass**, not only in the arithmetic.
- Visual baselines, performance smoke, 40-minute soak (desktop and mobile), security sweep, responsive
  matrix, and `vercel:build` all green, with every threshold recorded **as a measurement**.
- The trademarked genre name, and the trademarked term for a four-line clear, appear in no shipped string,
  proven by a gate.
- `entryFeeMicroUsdc` `0`, `SETTLEMENT_LIVE` `false`, `devWallet` unchanged, no contract touched.
- A new deployment candidate **declared with its certification evidence, and not promoted** without owner
  approval naming that exact deployment.
