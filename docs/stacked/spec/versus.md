# STACKED — Versus, Lockstep Readiness, and Two-Board Structure

> Precedence: `../STACKED-CONTRACTS.md` overrides this specification wherever they disagree.

**Scope.** Two Player does not ship in Phase 1. This document specifies the structural commitments
Phase 1 must make so Two Player is later a data-and-network change rather than a rewrite — the frozen
garbage attack table, a lockstep-capable simulation, a two-board render tree, and reserved schema
fields — and fully specifies the deferred phase: local two-player, the online backend option
comparison and recommendation, and matchmaking. Everything here is subordinate to
`docs/stacked/STACKED-CONTRACTS.md`; where a name, id, or constant appears in both, the contract wins.
Terminology follows contract §1: the four-line clear displays as **HALVING**, its identifier root is
**`quad`**, `clearType` is `'quad'`, the rotation-clear family is **SPIN** (`'spin-full'` /
`'spin-mini'`, displayed FORK / MINI FORK), a rising garbage row is a **REORG**, and simulation time
is counted in **ticks**, never frames.

**Contents**

1. The garbage attack table — Phase 1 data module, zero runtime importers
2. Lockstep-ready simulation requirements
3. Render structure for two boards on one canvas
4. Local Two Player
5. Online Two Player — options and recommendation
6. Matchmaking (design level, deferred)
7. Phase 1 scope — what must be in
8. Phase 1 scope — what must not be in

**Owned elsewhere.** Piece mechanics, gravity, lock delay, scoring, and the solo rising-ledger cadence
are `mechanics.md`. Particles, zones, quality tiers, and bloom are `visuals.md`. Touch input and the
cell-size solver are `mobile.md`. The `SIC1` codec, the plausibility gate, and replay verification are
`integrity.md`. Cabinet registration, leaderboards, achievements, CSP, and the bridge protocol are
`portal.md`. Build budgets, smokes, and certification are `gates.md`.

---

## 1. The garbage attack table

**File:** `apps/portal/src/stacked-versus-table.mjs` (new, Phase 1).
**Runtime importers in Phase 1: none.** The only importer is `tests/stacked-versus-table.test.mjs`.
The match wrapper (§2.1) receives the table **by injection**, so no Phase 1 import edge exists and the
zero-importer property is testable rather than aspirational.

**Why parent `src/` and not the child runtime.** The deferred relay re-simulation (§5.2) runs this
table in a Cloudflare Worker with no DOM. Portal `src/` is the repo's DOM-free, plain-Node-importable
pool, and cross-app import in this direction is established precedent: `apps/chikun/src/main.mjs`
line 5 imports `'../../portal/src/chikun-cabinet.mjs'` and line 12
`'../../portal/src/chikun-bridge-protocol.mjs'`; `apps/hmh-reboot/src/combat-audio.mjs` imports
`'../../portal/src/hmh-audio-system.mjs'`. One table, three consumers (child runtime, parent verifier,
relay), no fork.

The inverse rule follows and must be obeyed: any STACKED module that reads `navigator`, `window`, or
`document` — the device router of §4.3 is the one that does — belongs in `apps/stacked/src/`, never in
portal `src/`, or it poisons the Worker import path.

Both the module and its test must be appended to `NODE_CHECK_FILES` in `scripts/syntax-check.mjs`;
that array is an explicit non-globbed allowlist ("no globbing, so nothing silently escapes the gate"),
so an unlisted module skips `npm run check`. The test *run* gate does glob — `npm test` is
`node --test tests/*.test.mjs tests/projectile-pool.test.mjs` — so a new `tests/*.test.mjs` executes
without registration.

### 1.1 Data shape

```js
export const STACKED_VERSUS_TABLE_VERSION = 'stacked-versus-table-v1';

export const STACKED_ATTACK_TABLE = Object.freeze({
  version: STACKED_VERSUS_TABLE_VERSION,

  // Base rows sent, indexed by lines cleared (index 0 unused). Every non-spin
  // clearType indexes this array; 'quad' is the lines === 4 case, named separately
  // because it qualifies for CHAIN (back-to-back).
  base: Object.freeze([0, 0, 1, 2, 4]),

  // Spin clears REPLACE the base value (never stack with it), but never pay LESS
  // than the same line count would as a plain clear: resolved value is
  // max(spin[variant][lines], base[lines]). Without the floor a mini spin triple
  // (1) pays less than a plain triple (2) — pricing a harder move below an easier one.
  spin: Object.freeze({
    full: Object.freeze([0, 2, 4, 6, 6]),   // 1/2/3 lines -> 2/4/6
    mini: Object.freeze([0, 0, 1, 1, 1]),   // 1 line -> 0, 2 lines -> 1
  }),

  // Flat bonus when this clear continues a CHAIN. Applied ONLY when lines >= 2 (§1.5).
  backToBack: 1,
  backToBackMinLines: 2,
  // Which clearTypes set/continue the CHAIN flag. A qualifying single still
  // CONTINUES the chain; it just collects no bonus.
  backToBackQualifiers: Object.freeze(['quad', 'spin-full', 'spin-mini']),

  // MEMPOOL bonus, indexed by the combo counter AFTER increment (0 = first clear of
  // a chain). Values past the end clamp to the last entry.
  combo: Object.freeze([0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5]),

  // GENESIS (perfect clear). Replaces base+spin, keeps combo and CHAIN.
  perfectClear: 10,

  // Garbage arriving at a board is held before it locks in.
  chargeTicks: 60,          // 1.0 s at 60 Hz before queued rows can rise
  maxRowsPerLock: 8,        // at most 8 rows rise on a single piece lock
  // Rows are NEVER dropped. Above this many queued rows the "clear a line to buy a
  // tick" defence stops working and rows rise on EVERY lock, cleared or not. A hard
  // cap that DISCARDED rows would make a full queue a permanent immunity.
  queuePressureThreshold: 20,
});
```

Two constants that look like contract constants and are not:

- **This table's `combo` array is not `STACKED_COMBO_BONUS_CAP`.** The contract's cap of 20 governs
  the solo *score* term; this 13-entry array governs *attack rows* and clamps at 5.
- **`maxRowsPerLock: 8` is not `GARBAGE_PENDING_MAX: 8`.** The contract's `GARBAGE_PENDING_MAX` bounds
  queued solo REORG **groups** and raises `terminalReason: 'garbage-out'`; `maxRowsPerLock` bounds
  **rows** rising from the versus queue on one lock. The shared value 8 is coincidence and the two must
  not be collapsed into one constant.

**Deliberately not in this table:** the hole-column draw and the board geometry. Solo uses the rising
ledger in Phase 1 (contract §2.5), so `garbageHoleColumn` has a Phase 1 consumer and lives in
`apps/portal/src/stacked-sim.mjs`, reading `BOARD_WIDTH`, `GARBAGE_HOLE_REPEAT_NUM` and
`GARBAGE_HOLE_REPEAT_DEN` from `apps/portal/src/stacked-contracts.mjs`. That split is the only reason
the zero-importer claim above is true.

### 1.2 Pure functions (Phase 1: exported, tested, unused)

```js
// Deterministic. No RNG, no clock, no board reference.
export function computeAttack({
  lines,              // 0..4
  clearType,          // 'none'|'single'|'double'|'triple'|'quad'|'spin-full'|'spin-mini'
  comboCountBefore,   // the sim's stored combo counter BEFORE this lock; -1 = no chain live
  backToBackActive,   // boolean: was the CHAIN live BEFORE this clear
  perfectClear,       // boolean
}) -> { rows, nextBackToBack, nextComboCount }
```

`comboCountBefore` is deliberately the **pre-increment** value and `computeAttack` owns the increment.
Caller-increments is a bug factory: after a no-clear lock the stored counter is `-1`, and passing `-1`
back in indexes `combo[-1]` → `undefined` → `rows` is `NaN` → `stateHash` and every downstream result
are silently poisoned. One increment, inside this function.

```js
// Deterministic garbage exchange for one player's piece lock. Pure: neither draws
// RNG nor mutates its inputs.
export function resolveGarbageExchange({ outgoingRows, queue, tick, chargeTicks })
  -> {
       cancelledRows,   // integer consumed from the front of `queue`
       queue,           // NEW frozen array: `queue` minus the cancelled rows
       sent,            // null, or a frozen entry ready to push onto the OPPONENT:
                        // { rows, chargeReadyTick: tick + 1 + chargeTicks }
     }
```

Three details an implementer will otherwise invent, and two inventions desync:

- **Cancel first, then send.** `cancelledRows = min(outgoingRows, totalQueuedRows)`; `sent` carries
  `outgoingRows - cancelledRows`. When that difference is `0`, **`sent` is `null`** — never a zero-row
  entry. A 4-row attack against a 4-row queue sends nothing and leaves an empty queue.
- **Cancellation consumes the oldest entry from index 0 of its `holeColumns`**, the same end and order
  the rise consumes from, so a partially cancelled entry's surviving columns are its tail.
  `holeColumns[0]` is always the next row to rise, i.e. the bottom-most row of that batch.
- **`queue` is returned as a new frozen array**; the caller replaces its reference. Untouched entries
  are returned by identity (already frozen), so the no-cancellation case allocates one array only.

The sim's hole-column draw, quoted here because its exact draw counts are a lockstep invariant:

```js
// apps/portal/src/stacked-sim.mjs. `rng` is the match-level 'garbage' SeededRng;
// `previousColumn` is -1 for the first group of a match. ONE draw sequence per
// garbage GROUP (contract §2.5), never per row.
export function garbageHoleColumn(rng, previousColumn, columns = BOARD_WIDTH) {
  if (previousColumn < 0) return rng.int(0, columns - 1);              // first group: exactly 1 draw
  if (rng.int(0, GARBAGE_HOLE_REPEAT_DEN - 1) < GARBAGE_HOLE_REPEAT_NUM) {
    return previousColumn;                                             // 3/5 repeat: exactly 1 draw
  }
  const offset = rng.int(0, columns - 2);                              // 0..8, never `columns - 1`
  return (previousColumn + 1 + offset) % columns;                      // exactly 2 draws; never repeats
}
```

Exact draw counts, which the test must assert: **first group → 1; repeat branch → 1; shift branch
→ 2.** The early `previousColumn < 0` return is not style. The obvious spelling — one guard combining
`previousColumn >= 0 && rng.int(...)`, then an unconditional `offset` draw — computes `offset` on the
first group and throws it away, burning a stream position. `SeededRng.snapshot()` returns
`{ seed, count }` and that count is part of the evidence cursor (`apps/portal/src/seeded-rng.mjs`), so
a burned draw shifts every subsequent hole column and every re-verification that reconstructs the
stream by count. `rng.int(0, 4) < 3` yields 3 of 5 outcomes (0–2), the contract's 60%.

### 1.3 `computeAttack` order of operations, pinned

0. `nextComboCount = lines > 0 ? comboCountBefore + 1 : -1`. Everything below uses `nextComboCount`,
   so the first clear of a chain indexes `combo[0]`.
1. `lines === 0` → `rows = 0`, skip to step 4. Otherwise resolve the base value:
   - `perfectClear` → `rows = perfectClear` (10), ignoring `clearType` and `lines`.
   - `'single'` / `'double'` / `'triple'` / `'quad'` → `rows = base[lines]`.
   - `'spin-full'` → `rows = max(spin.full[lines], base[lines])`.
   - `'spin-mini'` → `rows = max(spin.mini[lines], base[lines])`.
2. `+ backToBack` (1) if `backToBackActive` **and** `clearType` ∈ `backToBackQualifiers` **and**
   `lines >= backToBackMinLines`. A perfect clear takes the bonus if the *actual* `clearType`
   qualifies — the perfect-clear branch replaces the base value only, not the qualification test.
3. `+ combo[min(nextComboCount, combo.length - 1)]`.
4. `nextBackToBack = lines === 0 ? backToBackActive : backToBackQualifiers.includes(clearType)`. A
   plain clear of 1–3 lines breaks the CHAIN; `'none'` leaves it untouched.

**`clearType` precedence when a clear qualifies as more than one thing** (a four-line clear that also
satisfies the spin test is legal for some piece/kick combinations): the sim resolves in the order
`perfectClear` > `'spin-full'` > `'spin-mini'` > `'quad'` > plain > `'none'` and passes exactly one
string, so `computeAttack` never sees an ambiguous clear. Because of the `max()` floor a four-line
full spin pays `max(6, 4) = 6`, not 4. This deliberately differs from *scoring*, where contract §2.4
rules that a four-line clear always scores `HALVING`; attack rows and score are separate tables and
are allowed to disagree.

All integer arithmetic. No `Math.hypot`, `Math.sin`, `Math.pow`, or non-exact `Math.sqrt` in this
module or the sim — `apps/portal/src/chikun-cabinet.mjs` line 291 calls `Math.hypot(dx, dy)` inside
`createChikunRuntime`'s step, and `Math.hypot` is implementation-defined in ECMA-262, so a run
recorded on one engine can fail re-verification on another. STACKED does not repeat that.

### 1.4 The counter / cancellation rule, pinned

Garbage is **queued, not applied**, and outgoing attacks cancel from the front of the queue before
anything is sent.

```
On player P locking a piece at tick T:
  1. outgoing = computeAttack(...)                     // rows P earned this lock
  2. { cancelledRows, queue, sent } = resolveGarbageExchange({
       outgoingRows: outgoing.rows, queue: P.garbageQueue, tick: T,
       chargeTicks: STACKED_ATTACK_TABLE.chargeTicks })
     - cancellation consumes rows from the OLDEST queue entry first, 1:1
     - cancellation is unlimited; a 4-row attack fully cancels 4 queued rows
     - already-charged rows are still cancellable right up to the tick they rise
  3. if (sent) the match router resolves sent.rows hole columns NOW, in send order,
     from the match 'garbage' substream (§2.4 rule 3), and pushes
     { rows, chargeReadyTick: T + 1 + chargeTicks, holeColumns: Uint8Array }
     onto the OPPONENT's queue.
     (the +1 makes delivery strictly next-tick, never same-tick — §2.4 rule 2)
  4. Rows rise into P's board when EITHER
       (a) P cleared NO lines this lock, OR
       (b) P's total queued rows > queuePressureThreshold (20).
     Rising consumes queue entries whose chargeReadyTick <= T, oldest first, up to
     maxRowsPerLock (8) rows. A partially consumed entry keeps its remaining rows
     and its remaining holeColumns and stays at the front.
```

Hole columns are drawn at **send** time and stored on the queue entry. Cancelled rows consume their
pre-drawn columns and discard them; deterministic and intentional.

The rise itself, pinned:

- Rows shift the existing stack up by `n`. Each new bottom row is full except its `holeColumns[i]`
  cell.
- The active piece shifts up by the same `n`. If that would place it outside `BOARD_ROWS` (24), or
  overlapping a filled cell it cannot be nudged out of, the board is terminal with
  `terminalReason: 'garbage-out'`.
- If the shift would push any filled cell past `BOARD_ROWS`, likewise `'garbage-out'`. There is no
  separate `'buried'` reason — contract §1.3 rejected it, because a second name for one condition is
  how two verifiers disagree.
- Rise happens on a lock, never on a timer, so a player is never killed mid-piece.

Two consequences not to "improve" away: a clear producing zero attack rows (a single at combo 0)
cancels nothing but still **prevents the rise this lock** — the intended "buy a tick" defence, with
rule 4(b) as the price for abusing it; and no queued row is ever discarded, so pressure is always
eventually paid.

### 1.5 Justification of the values

The load-bearing metric is **attack rows per piece placed**. One cleared row costs 10 cells; one piece
is 4 cells; clearing N rows therefore costs `2.5 × N` pieces of stack before setup overhead. CHAIN
assumed live.

| Line | Rows cleared | Pieces (2.5 × rows) | Attack rows | Rows / piece |
|---|---|---|---|---|
| Plain double | 2 | 5.0 | 1 | 0.20 |
| Plain triple | 3 | 7.5 | 2 | 0.27 |
| Mini spin double + CHAIN | 2 | 5.0 | 1 + 1 = 2 | 0.40 |
| **HALVING (quad) + CHAIN** | 4 | 10.0 | 4 + 1 = 5 | **0.50** ← the baseline everything is measured against |
| Full spin single (no CHAIN bonus, `lines < 2`) | 1 | 2.5 | 2 | 0.80 |
| Full spin triple + CHAIN | 3 | 7.5 | 6 + 1 = 7 | 0.93 |
| Full spin double + CHAIN | 2 | 5.0 | 4 + 1 = 5 | **1.00** ← the efficiency ceiling for a repeatable line |
| 10-clear single combo | 10 | 25.0 | 0+0+1+1+1+2+2+3+3+4 = 17 | 0.68 |
| GENESIS + CHAIN | 4 | 10.0 | 10 + 1 = 11 | 1.10 |

Intended ordering, which the numbers produce: **spin doubles are the skill ceiling at 2× the HALVING
baseline, combos sit between at 1.4×, and GENESIS is the only thing above spin doubles — conditional,
rare, and unloopable.**

Three consequences that must not be undone:

- **Why `backToBackMinLines: 2` exists.** With a flat +1 on singles, a full spin single pays 3 rows
  for 2.5 pieces = **1.20 rows/piece**, beating the spin double and making the repeating spin-single
  loop the dominant strategy. The `lines >= 2` gate drops it to 0.80, back below the spin double. This
  is the one place where the obvious implementation is the wrong one.
- **The table ignores setup overhead**, which is what keeps the top rows from being auto-win. A
  repeatable spin double costs roughly 2–3 extra non-clearing pieces to build the overhang, taking its
  effective rate to ≈0.65 rows/piece against ≈0.50 for a HALVING loop at ~0 setup pieces — a ~1.3×
  reward for much harder execution. **Estimate, not measurement.** Instrument
  `rowsSent / piecesPlaced` per clear type in the first playtest build and re-tune from data.
- **The 10-combo total is exactly 17 rows, not "about 20".** The array is 13 entries capped at 5; a
  10-clear chain indexes entries 0..9 and sums to 17.

| Value | Choice | Why |
|---|---|---|
| single = 0 | 0 rows | If a single sends anything, the optimal line collapses to "clear as fast as possible" and the stacking game disappears. Zero forces players to build. |
| double = 1, triple = 2 | 1, 2 | Sub-linear. Two doubles (2 rows for 10 pieces) must be worth less than one HALVING (4 rows for 10 pieces), or nobody builds a well. |
| `quad` = 4 | 4 rows | The 2× jump from triple is the most load-bearing number in the genre; it is what makes a 10-wide board with a 1-wide well the default opening shape. |
| spin full: 2 / 4 / 6 | equals or beats the same line count | A spin double at 4 equals a HALVING at 4 for half the pieces — that 2× is the entire reason to learn spins. Spin triple at 6 is the highest repeatable payoff. |
| spin mini: 0 / 1 | tiny, floored at `base[lines]` | Minis are cheap and frequent; paying them like full spins turns the game into mini-farming, and 0 for a mini single prices out the degenerate line. The floor exists because the raw array pays 1 for a mini triple against 2 for a plain triple; with it, a mini triple pays 2 and a mini quad 4. |
| CHAIN = +1 flat, `lines >= 2` | flat, not multiplicative, not on singles | A multiplicative or escalating chain rewards a player already winning and lengthens blowouts. Flat +1 rewards consistency by exactly 25% on a HALVING (4 → 5) with no runaway. The gate is the anti-spin-single-loop rule above. If playtests say matches are too passive, escalate later — a one-line data change in this frozen table, which is why it lives here. |
| combo `[0,0,1,1,1,2,2,3,3,4,4,4,5]` | 13 entries, caps at 5 | A combo must be a real alternate strategy (0.68 rows/piece, 1.4× the HALVING baseline) without becoming the only one. Capping at 5 stops a lucky infinite-combo well from being an auto-win. |
| GENESIS = 10 | flat 10 | Rare, requires reading the whole board, should visibly end a game. 10 is two and a half HALVINGs — decisive but survivable by a player with a clean board and a full counter buffer. |
| `chargeTicks` = 60 | 1.0 s | Below ~40 ticks defence is reflex-only and the faster player always wins; above ~90 ticks garbage never lands and matches never end. At 150–200 pieces/min (2.5–3.33 locks/s), 60 ticks is **2.5 to 3.3 placements** — enough to fire one counter-clear if the shape already exists, not enough to build one from a flat board. It rewards *prepared* defence, not reaction speed. |
| `maxRowsPerLock` = 8 | 8 | An unbounded rise can top out a player from one lock with no counterplay. 8 rows is survivable from a low stack and lethal from a high one — the difference is the player's own stack management. |
| `queuePressureThreshold` = 20 | 20 rows | Two full `maxRowsPerLock` rises plus change. Past it, clearing a line no longer blocks the rise, so a player cannot survive indefinitely by chain-clearing singles while 30 rows sit charged. A cap that *discarded* rows would make the same state an immunity. |
| hole repeat 3/5 (contract §2.5, not this table) | 60% | Independent hole columns make garbage unclearable noise. A 60% repeat produces the "clean garbage" runs that reward digging, with occasional shifts that punish autopilot. Expected clean run is `1 / 0.4 = 2.5` rows, so an 8-row batch is typically 3–4 wells, not 8 scattered holes. |

---

## 2. Lockstep-ready simulation requirements

### 2.1 Structure

The sim is a pure stepper with no clock, no DOM, no `Math.random`, and no renderer reference. Phase 1
builds all of it for solo; the only Phase 2 change is constructing two of them.

```js
// apps/portal/src/stacked-sim.mjs   (Phase 1; contract §2.10 owns this module)
export function createStackedRuntime({ seed, playerConfig }) -> Object.freeze({
  step(inputBits),        // inputBits: uint8, ONE tick. Throws if terminal.
  snapshot(),             // frozen plain-data view for render + desync hashing
  stateHash(),            // uint32 FNV-1a over the canonical sim fields
  result(),               // null until terminal
  get terminal(),
})

// apps/portal/src/stacked-match.mjs   (NEW Phase 1 module; constructed with ONE board)
export function createStackedMatch({ seed, playerConfigs, attackTable = null })
  -> Object.freeze({
       stepAll(inputBitsByPlayer),  // Uint8Array indexed by player slot
       snapshot(),                  // { tick, boards: [...], pendingAttacks: [...] }
       stateHash(),                 // uint32 over ALL boards + all queues
       result(),
       get terminal(),
     })
```

`stacked-match.mjs` is in the contract §2.10 module map with its import rules, is scheduled in **S-03**
alongside `stacked-versus-table.mjs`, and is appended to `NODE_CHECK_FILES` in that cycle. It
imports `./stacked-sim.mjs`, `./stacked-contracts.mjs` and `./seeded-rng.mjs` and **nothing else** —
in particular not `./stacked-versus-table.mjs`; the table arrives through `attackTable`, `null` in
Phase 1, supplied by Phase 2's entry point. With `attackTable: null` the garbage router is inert,
which is correct with one board.

The frozen-object-with-a-throwing-stepper shape is the repo's pure-stepper precedent:
`createChikunRuntime` in `apps/portal/src/chikun-cabinet.mjs` returns
`Object.freeze({ step, snapshot, result, get terminal })` and its `step` throws
`'Chikun runtime is already terminal'` once terminal. Copy that contract exactly.

Phase 1 uses `createStackedMatch` with `playerConfigs.length === 1`. The solo runtime never talks to
the attack table; the **match** owns the garbage router. That single boundary is what makes Two Player
a data change.

**One match seed, not a seed per player.** Both boards must receive the identical piece sequence or
versus is not a fair contest, so `createStackedMatch` takes a single `seed`. Each board constructs its
**own** `SeededRng` for `bag` from that same seed — two independent instances at one seed produce the
same sequence, whereas one shared instance would interleave draws by lock order and diverge. The
`garbage` stream is a single match-level instance shared by the router, because rows are drawn in one
global send order.

**Do not use `DeterministicSimulation.nextRandom`.** `apps/hmh-reboot/src/simulation.mjs` line 7
hard-codes `const RANDOM_STREAMS = new Set(['encounters', 'drops'])`, and `nextRandom` throws
`TypeError: Unknown deterministic random stream: <name>` for any other name (line 216;
`getRandomState` at 223 repeats the guard, and the class has no `randomInt`). STACKED uses
`createSeededSubstreams(seed, ['bag', 'garbage', 'zone'])` from `apps/portal/src/seeded-rng.mjs`,
whose derivation is `streamSeed = hashSeed(baseSeed ^ hashStreamName(name))` — a stream's seed depends
only on the base seed and its own name, so adding a fourth stream later does not shift the first
three, and **renaming an existing stream silently reseeds it**. Stream names are part of the replay
contract and are frozen alongside the protocol version. `mulberry32` divides by `4294967296` (range
`[0,1)`), so `SeededRng.int(min, max)` — `Math.floor(this.range(min, max + 1))` — cannot return
`max + 1`.

**Who draws from `zone`.** Only the sim step, and only on the tick `zoneIndex` advances, to pick a
deterministic zone variant. `zoneIndex` is sim state and part of `stateHash`; the palette, background
layer, and particle preset it selects are presentation (`visuals.md`). The renderer must never draw
from a sim RNG stream — that would make frame rate change the stream cursor.

### 2.2 Frame driver wiring

`DeterministicSimulation` from `apps/hmh-reboot/src/simulation.mjs` is the correct **frame driver** —
reuse it rather than hand-rolling a third accumulator (`apps/chikun/src/main.mjs` hand-rolled the
second). It provides `FIXED_STEP_MS = 1000 / 60`, `MAX_CATCH_UP_STEPS = 4`, a default
`maxFrameDeltaMs` of 100, `freezeClone` input validation, `interpolationAlpha`, and the
`rawWallClockLossMs` / `accumulatorOverflowMs` / `totalDroppedMs` loss metrics. Four wiring rules,
because the default wiring is wrong for lockstep:

- **Call `update(deltaMs, null)`.** Pass `null` as `inputSnapshot` and ignore `step.input`; the step
  callback reads its byte from the ring buffer at `step.tick` (§2.3). `DeterministicSimulation` calls
  `freezeClone(inputSnapshot)` once per `update()` and hands that *same* frozen object to every
  catch-up step — exactly the convention §2.3 rejects. `null` makes it inert rather than subtly wrong.
- **`step.tick` is the driver's own monotonic counter and is the match tick.** Construct the driver at
  the same origin as the match; assert `driverTick === matchTick` in a debug build.
- **A stall is "do not call `update()` this frame".** Do not call `update(0)`, do not accumulate.
  `update()` clamps `rawDeltaMs` to `maxFrameDeltaMs` (100 ms) and the accumulator to 4 steps, so a
  resumed frame after a long stall **discards** the wall-clock debt rather than bursting through it.
  That is what we want — a lockstep client must never fast-forward — but the local sim stays that far
  behind wall clock. Call `resetAccumulator()` on resume and accept the latency; the relay's tick
  alignment (§6.5), not the accumulator, closes a real gap.
- **`pause()` throws** from any state other than `'active'` or `'upgrade'`
  (`Cannot pause simulation from <state>`, line 104). Every pause path in §2.8 checks `state` first.

### 2.3 Per-tick input delivery

The input encoding — one `uint8` held-state mask per tick, the frozen bit order, the simultaneous-bit
precedence table, DAS/ARR/DCD outside the sim, and the `SIC1` transition encoding — is frozen in
contract §2.3 and specified in `mechanics.md` and `integrity.md`. Only delivery is lockstep's
business:

**The frame driver dequeues one distinct input byte per fixed step from a per-player tick-indexed ring
buffer.** `apps/hmh-reboot/src/simulation.mjs` hands one frozen `input` object to every catch-up step
in a frame (up to 4); `apps/chikun/src/main.mjs` consumes its queued flap on the first executed step
only (`flapQueued` cleared inside the `steps` loop, lines 681–683). Both are deterministic; STACKED
picks neither. Anything that reuses one frame's input across catch-up steps makes a 4-step catch-up
frame differ from four 1-step frames, breaking lockstep the instant two machines differ in frame
timing.

Ring buffer: **256 bytes per player** — 4.27 s at 60 Hz, 32× the 8-tick maximum input delay. Index by
`tick & 255`.

**256 is a delivery jitter buffer, not a backlog buffer.** The worst *stall* tolerated is 10 s (600
ticks — §6.5 and the hidden-tab row of §2.8), which does not fit in 256 entries and must not be made
to: widening the ring would let the driver quietly wrap and overwrite unconsumed input. Instead the
relay client holds a separate FIFO of arrived-but-unsimulated frames and drains it into the ring only
as the driver consumes ticks. That FIFO is bounded by the forfeit timer, so its worst case is
600 ticks × 1 byte × 2 players = **1.2 KB** — a plain array, no eviction policy. If the ring is ever
asked to write an index whose current occupant has not been consumed, that is a driver bug: `throw`,
do not wrap.

Under-run behaviour by mode:

- **Solo and local 2P:** impossible; the local device fills tick T before the driver asks. If it
  happens it is a bug — `throw`.
- **Online:** the peer's byte for tick T has not arrived. The driver **stalls** — skips `update()`
  entirely for that frame, presentation shows a connection-stall indicator. It never guesses, repeats
  the last byte, or steps with zeros. Stalling is the entire point of delay-based lockstep. On resume,
  `resetAccumulator()`.

`tests/iso-runtime-determinism.test.mjs` already pins the property this protects: its third case,
`'a fixed seed produces a stable snapshot across step granularities of the same stream'`, runs four
identical simulations and `assert.deepEqual`s runs 1–3 against run 0. STACKED's equivalent
(`tests/stacked-sim-determinism.test.mjs`) must go further and assert that **four single-tick
`stepAll` calls and one batched four-tick advance produce the same `stateHash`** — the exact invariant
a per-frame input snapshot replayed into catch-up steps would break.

### 2.4 Deterministic ordering rules (non-negotiable)

1. Within `stepAll`, boards advance in **ascending player-slot order**, always, on every machine.
2. Attacks generated at tick `T` are appended with `chargeReadyTick = T + 1 + chargeTicks`. **No
   attack is ever visible to a board in the same tick it was generated.** This removes the only
   ordering-sensitive interaction between boards and makes slot order provably irrelevant to the
   result — the order is still pinned, because a future feature could reintroduce coupling.
3. Garbage hole columns are drawn from the match-level `'garbage'` substream **at send time, in
   ascending player-slot order**, and stored on the queue entry as a `Uint8Array`. Never at rise time.
   One shared stream for the whole match; both clients draw the same sequence in the same order.
4. Zone advance is evaluated **before** the terminal check on the same tick, so a board that tops out
   on the tick it would advance a zone still records the higher `zoneIndex`. Order within a lock
   resolution, extending contract §2.3's within-tick order: line clear → score/combo/CHAIN →
   `computeAttack` → cancellation → send → zone advance → garbage rise → terminal check → spawn.
5. Every sim number is an integer — gravity is contract §2.1's Q16 accumulator; lock delay, DAS and
   ARR are integer tick counters. No floats anywhere in the sim, which makes `stateHash()` exact and
   cross-engine safe.

### 2.5 Input delay vs rollback — DECIDED: delay-based lockstep, 0 ticks locally, adaptive 3–8 online

**Ship delay-based lockstep. Solo and local 2P run at input delay 0. Online runs an adaptive 3–8 tick
delay, typically 5. Do not build rollback.**

- The genre's reaction budget is 100–250 ms (reading a piece, planning a placement), not 16 ms; a
  uniform 50–85 ms input delay is below the threshold where falling-block players report input lag.
- Rollback's artifacts are catastrophic *specifically here*: rolling back a garbage rise or a line
  clear means rows visibly appear and un-appear.
- Rollback doubles the anti-cheat surface — a rollback client speculatively executes unverified remote
  input, so a malicious peer can probe the local sim by feeding and retracting inputs.
- Rollback costs a snapshot ring buffer, a re-sim loop, and a class of desync bugs, for a benefit this
  genre does not collect.
- Delay-based lockstep at delay 0 *is* local Two Player, so local 2P is free once the sim is
  lockstep-shaped.

**Adaptive delay rule (Phase 2).** The relay reports each client's p95 RTT *to the relay* every 2 s.
The quantity that matters is the client-to-peer path *through* the relay, `rttA / 2 + rttB / 2` — not
`rtt / 2` of either client alone, and not their difference:

```js
// clamp(value, min, max) — argument order pinned, because clamp(3, 8, x) is the
// other convention and silently produces 3 for every input.
delayTicks = clamp(Math.ceil((p95RttA / 2 + p95RttB / 2 + 12) / (1000 / 60)), 3, 8);
```

`+ 12 ms` is jitter headroom; `1000 / 60 = 16.667`.

| p95 RTT A / B | `rttA/2 + rttB/2 + 12` | ÷ 16.667 | `delayTicks` |
|---|---|---|---|
| 60 / 60 ms | 72 ms | 4.32 | **5** |
| 100 / 100 ms | 112 ms | 6.72 | **7** |
| 140 / 180 ms | 172 ms | 10.3 | **8** (clamped) |
| 240 / 240 ms | 252 ms | 15.1 | **8** (clamped — §6.2 rejects this pairing before it is made) |

**The `3` floor is almost never reached** — it requires `rttA + rttB ≤ 76 ms`, two players on ~38 ms
connections. Treat 5 as the realistic default and 3 as a LAN-grade edge case.

The delay changes **only between games in a set, never mid-game**, and is echoed identically to both
clients. A mid-game delay change is a determinism hazard and is banned.

### 2.6 Sim state vs presentation state

| In the sim (hashed, replayed, evidence) | Presentation only (never affects a result) |
|---|---|
| `board` — 10 × 24 `Uint8Array` (`BOARD_WIDTH` × `BOARD_ROWS`), one cell id per cell | Piece position interpolation between ticks |
| `active` — `{ pieceId, x, y, subCellY, rotation, spawnTick }`, all integers | Ghost piece rendering (position *derived* from sim state each frame) |
| `bag` — `{ current: Uint8Array(7), index, rng.snapshot() }` | Line-clear flash, particles, screen shake |
| `hold` — `{ pieceId \| null, usedThisPiece }` | Zone palette, background layer, particle preset |
| `queue` — next-piece preview ids (sim-owned: previews come from the bag) | Live audio-band bloom/energy (projection-only per `AGENTS.md`) |
| `gravity` — Q16 accumulator | Garbage warning bar animation and colour |
| `lock` — `{ delayTicks, elapsedTicks, resets, maxResets }` | Attack-sent floating numbers, combo text |
| `das` / `arr` — `{ chargeTicks, repeatTicks, direction, lastHorizontal }` | Opponent mini-board scale and position |
| `garbageQueue` — `[{ rows, chargeReadyTick, holeColumns }]` | Countdown, "READY?", results overlay |
| `garbageRng.snapshot()`, `previousHoleColumn` | Camera, letterboxing, HUD layout |
| `zoneIndex`, `zoneVariant` | Interpolation alpha, quality tier, particle counts |
| `combo`, `backToBackActive`, `linesCleared`, `score`, `level`, `piecesPlaced` | Board `frame` choice (`'wide'` / `'tall'`), §3.3 |
| `tick`, `terminal`, `terminalReason` | Stall indicator, ping display, reconnect banner |

**DAS, ARR and DCD are player-configurable and live outside `step()`** (contract §2.3), which keeps a
replay independent of handling. Lockstep adds a consequence solo does not have: the *expanded* per-tick
move bits are produced locally by each client's own input layer, so peers never need to agree on
handling — but `lock.delayTicks` and `lock.maxResets`, which *are* read inside `step()`, must be
identical on both peers. They are echoed in the match header at match start and asserted equal before
tick 0. A mismatch is a match-setup error, not a desync to discover at checkpoint 60.

### 2.7 Desync detection (Phase 2 network, Phase 1 hook)

Phase 1 exports `stateHash()` on both the runtime and the match: a uint32 FNV-1a over, in this fixed
order, `tick`, the 240 board bytes, active piece fields, bag index + `rng.count`, hold, garbage queue
entries (rows, `chargeReadyTick`, each hole column), `garbageRng.count`, `previousHoleColumn`,
`zoneIndex`, combo, CHAIN flag, lines, score. Integers are fed low-byte-first so the hash is
endian-independent.

Byte count per board at `BOARD_ROWS = 24`: 4 (`tick`) + 240 (10 × 24 board) + 24 (six active-piece
integers) + 8 (bag index, `rng.count`) + 2 (hold) + 4 (`garbageRng.count`) + 1 (`previousHoleColumn`)
+ 4 (`zoneIndex`) + 4 (combo) + 1 (CHAIN) + 4 (lines) + 4 (score) = **300 bytes**, plus `8 + rows` per
queued garbage entry — ~310 in a typical mid-match state. Once per 60 ticks that is well under 0.5 µs
of work per board.

Phase 1 uses the hash for the same-seed determinism test.
`tests/iso-runtime-determinism.test.mjs` is the precedent shape (`'same seed reproduces a
byte-identical model run'` `assert.deepEqual`s a second run against the first; `'different seeds
diverge'` `assert.notDeepEqual`s two seeds). Its own SCOPE NOTE says `apps/portal/main.js` is
DOM-coupled and cannot be imported headless, so it never drives a real step function. STACKED's sim is
DOM-free from the start, so `tests/stacked-sim-determinism.test.mjs` can and must drive
`createStackedMatch().stepAll` directly over a scripted 20,000-tick input stream.

Phase 2 exchanges the hash every 60 ticks via the relay; a mismatch immediately voids the match with
`resolution: 'desync'`, no rating change, both input streams captured for triage. A uint32 hash misses
a given divergence with probability 2⁻³², and a real desync persists across many consecutive
checkpoints, so the practical miss rate is negligible; 32 bits is chosen over 64 because it is one
integer in the frame message.

### 2.8 Interruption and state-change matrix (pinned)

The sim has no clock, so every row is a driver-level or match-level decision, never a sim input. Each
must be implemented in Phase 1 even though only the first two columns apply to solo.

| Event | Free (solo) | Ranked (solo) | Local 2P | Online 2P |
|---|---|---|---|---|
| Player presses Pause | Sim stops being stepped; `DeterministicSimulation.pause()` guarded on `state === 'active'` first (it throws otherwise, and it calls `resetAccumulator`, so no catch-up burst on resume); unlimited | Allowed. The 3-second unpause countdown is **wall-clock and presentation-only — the sim is not stepped during it** — and its 3 s is added to `pausedMs`. Stepping the countdown as real ticks would run gravity and drop the active piece while the player reads "3… 2… 1". Pause count and `pausedMs` go into the evidence; the Ranked pause budget itself is `portal.md`'s | Either player may pause; both boards stop | Pause is a relay-ordered match event applied at an agreed future tick; one 30 s tactical pause per player per game |
| Tab hidden / `visibilitychange` | Auto-pause | Auto-pause, counted against the Ranked pause budget | Auto-pause | **Not** a pause, and **not** a 60 Hz pump — `requestAnimationFrame` stops in a hidden tab and a `setTimeout` pump does not rescue it (background tabs clamp to ~1 Hz). While hidden the client **buffers relay frames without simulating**; on return to visible it replays the buffered timeline in an explicit bounded catch-up loop (`stepAll` in a `while` loop, **not** a giant delta into `update()`, which clamps at 100 ms / 4 steps). A hidden tab stalling past 10 s forfeits (§6.5), capping catch-up at 600 ticks × 2 boards ≈ 2.4 ms |
| Window resize / orientation change | `layoutMatch()` re-runs; nothing else | Same | Same; if width drops below 900 CSS px the match auto-pauses with a "rotate or widen" overlay (§3.3) | Same, but the match does **not** pause — the local player's layout problem is not the opponent's; the portrait mini layout takes over |
| Gamepad disconnect | n/a | n/a | Immediate pause, resume on reclaim; never a forfeit | Immediate local pause request through the relay; the 30 s tactical budget is bypassed for a hardware event, once per game |
| Terminal condition on the same tick as a zone advance | Zone advance resolves first (§2.4 rule 4) | Same | Same | Same |
| Terminal condition on the same tick as a garbage rise | Rise resolves, then the terminal check; `terminalReason` is `'garbage-out'` when the rise did it, otherwise `'block-out'` or `'lock-out'` | Same | Same | Same; the loser's `terminalReason` is part of the certified result |
| Both boards terminal on the same tick | n/a | n/a | `resolution: 'draw'` | `resolution: 'draw'`, Glicko-2 updated at score 0.5 both sides |
| Player restarts mid-run | Allowed and instant. The old runtime is discarded and a **new** `createStackedMatch` constructed — never `reset()` on a live one, because a reset path is a second way to reach initial state and the two will drift | **Refused.** The restart control is not rendered at all rather than rendered-and-disabled, so there is no path to it | Allowed between games, never within one | Not offered; use rematch (§6.4) |
| Player rebinds a key mid-run | Allowed; DAS/ARR/lock-delay unchanged so the sim is untouched | **Refused** — copy `rebindKeyboardAction`'s `rankedActive` guard (§4.2) | Refused during a game | Refused during a game; bindings are part of the match header |
| Browser reload mid-run | Run is lost | Run is lost; there is no mid-run Ranked resume. `activeSessionCheckpoint` in `apps/portal/src/persistence.mjs` is a session marker written by `saveActiveSessionCheckpoint`, not a sim snapshot, and restoring a sim from a snapshot would create a save-scum path | Match is lost | 10 s reconnect grace, §6.5 |

---

## 3. Render structure for two boards on one canvas

### 3.1 Container hierarchy

The six root layers, the `stackedRoot` name, and the z-order are frozen in contract §2.8 and owned by
`visuals.md`. Versus owns the `boardRoot` subtree and the per-board view.

```
app.stage
└─ stackedRoot                      Container   (global shake applies HERE)
   ├─ layerBackdrop      z=0        Container   zone shader Mesh + parallax TilingSprites
   ├─ layerParticleFar   z=10       ParticleContainer
   ├─ boardRoot          z=20       Container
   │    ├─ boardSlot[0]             Container   position + scale set ONLY by layoutMatch()
   │    │   └─ boardView            Container   createStackedBoardView() output
   │    │       ├─ wellFrame         Graphics
   │    │       ├─ stackLayer        Container   (locked cells)
   │    │       ├─ garbageWarnLayer  Container   (queued-rows indicator strip)
   │    │       ├─ ghostLayer        Container
   │    │       ├─ activeLayer       Container   (falling piece)
   │    │       ├─ effectLayer       Container   (per-board particles, clear flashes)
   │    │       └─ hudLayer          Container   (hold, next queue, score, name)
   │    └─ boardSlot[1]             Container   created, empty, visible = false in Phase 1
   ├─ layerParticleNear  z=30       ParticleContainer
   ├─ layerPost          z=40       Container   bloom composite Sprite (blendMode 'add')
   └─ layerHud           z=50       Container
```

**Files.** `createLayerStack()` in `apps/stacked/src/render/layers.mjs` builds the root and is the sole
`app.stage.addChild` caller. `createStackedBoardView()` in `apps/stacked/src/render/board-view.mjs`
builds one `boardView`. `layoutMatch()` lives in `apps/portal/src/stacked-layout.mjs` (pure, no Pixi).

**Phase 1 creates `boardSlot[1]` and leaves it empty and hidden** — one `new Container()`, and the
Phase 2 diff never touches root assembly.

### 3.2 Rules that make this a data change instead of a rewrite

Four hard rules, enforced by `tests/stacked-render-tree.test.mjs`:

1. **`app.stage.addChild` is called exactly once**, in `createLayerStack()`, with `stackedRoot` as its
   only argument. `apps/hmh-reboot/src/main.mjs` line 535 does
   `app.stage.addChild(world, overlayVisuals, bossLabel, minimap)` — four siblings at stage level. Do
   not copy that; a second board would have to reparent four things.
2. **No module below `boardSlot[n]` may read `app.screen`, `window.innerWidth`, or
   `devicePixelRatio`.** A board view is authored in a fixed local coordinate space chosen by its
   `frame` argument; all responsiveness is `boardSlot.scale` and `boardSlot.position`, set by one pure
   function.
3. **Two authored frames, `CELL_PX = 32`:**

   | `frame` | Authored box | Arrangement | Used by |
   |---|---|---|---|
   | `'wide'` | 512 × 640 | 96 px hold + garbage-warn column, 320 px well (10 cells × 32 px, 20 visible rows), 96 px next-queue + score column | landscape solo, both landscape 2P slots |
   | `'tall'` | 320 × 800 | 320 px well, HUD in 80 px strips above and below | portrait solo, portrait own-board, portrait opponent mini (with `hudLayer.visible = false`) |

   The sim board is 10 × `BOARD_ROWS` (24); **rows 0–19 are drawn and rows 20–23 are the spawn/kick
   buffer, never rendered.** The `frame` choice is presentation-only and is decided by `layoutMatch()`,
   never by the view.
4. **All per-board state lives on the object returned by `createStackedBoardView()`**, never in
   module-scope variables. `apps/hmh-reboot/src/main.mjs` holds `world` (line 423), `enemyVisuals`
   (466) and `actorVisual` (524) as function-scope singletons through the `addChild` at 535 — fine for
   one board, fatal for two.

**Testability requirement, or rule 1 is untestable.** `npm test` is `node --test` with no DOM and no
WebGL, so a real `PIXI.Application` cannot be constructed there. `createLayerStack` and
`createStackedBoardView` must take their display-object constructors by injection —
`createLayerStack({ stage, Container, Graphics })` — so the test can pass stubs that record `addChild`
calls; the production call site passes the real Pixi classes. Without it, rule 1 is enforced by code
review alone, which is how it will regress.

### 3.3 Layout (`layoutMatch` return values)

```js
// apps/portal/src/stacked-layout.mjs — pure, no Pixi, parent-side, imported by the child
export function layoutMatch({ viewportWidth, viewportHeight, boardCount, opponentMini })
  -> Object.freeze([{ slot, frame, x, y, scale, visible }, ...])
```

`x`/`y` are the CSS-pixel position of the slot container's origin, and **that origin is the TOP-LEFT
of the authored box**, not its centre, so a slot occupies
`[x, x + frameWidth × scale] × [y, y + frameHeight × scale]`. `scale` is uniform (one number, both
axes — authored boxes are never stretched). All four values are integers, so a board never lands on a
half-pixel. The array is returned in ascending `slot` order and always has `boardCount` entries,
hidden ones included. Phase 1 calls it with `boardCount: 1`; Phase 2 with `2`. Nothing else changes.

`GUTTER = round(0.04 × viewportWidth)`.

| Case | Frame | Slots | Scale | Notes |
|---|---|---|---|---|
| Solo, landscape (`vw ≥ vh`, `vw ≥ 900`) | `wide` | 1 centred | `min(vh × 0.90 / 640, vw × 0.90 / 512)` | Phase 1's only case |
| Solo, portrait (`vw < vh`) | `tall` | 1 centred | `min(vh × 0.72 / 800, vw × 0.94 / 320)` | HUD strips above and below the well; the remaining ~28% of height is the touch control band (`mobile.md`) |
| Local 2P, landscape (`vw ≥ 900`) | `wide` | 2 side by side | `min(vh × 0.90 / 640, (vw × 0.92 − GUTTER) / (2 × 512))` | Phase 2 |
| Local 2P, portrait | — | **refused** | — | Two boards on a phone are unreadable. Local 2P requires ≥ 900 CSS px width; below that the mode is hidden with an explicit "rotate or use a wider screen" message, and a mid-match drop below 900 px auto-pauses (§2.8) |
| Online 2P, landscape (`vw ≥ 900`) | `wide` | as local 2P | same formula | Phase 2 |
| Online 2P, portrait | `tall` (both) | own board centred at solo portrait scale; opponent as a **mini** at `scale × 0.34`, pinned top-right with a 12 logical-px margin, `hudLayer.visible = false` | see notes | `opponentMini: true` is the flag; this keeps the 9:16 manifest requirement satisfiable in versus |

**The two-board scale is derived, not chosen.** Two `'wide'` boards side by side occupy 1024 authored
px against 640 authored height — aspect 1.60, *narrower* than 16:9 (1.78). So on any 16:9-or-wider
viewport, **height binds in both the one-board and the two-board case and the two-board scale is
identical to the solo scale.** A flat `× 0.72` shrink factor would have shrunk every board below by
28% for no reason.

| Viewport | Solo scale | 2P scale | Binding constraint |
|---|---|---|---|
| 1920 × 1080 | `min(1.519, 3.375) = 1.519` | `min(1.519, (1766 − 77) / 1024 = 1.650) = 1.519` | height, both |
| 1280 × 720 | `min(1.013, 2.250) = 1.013` | `min(1.013, (1178 − 51) / 1024 = 1.100) = 1.013` | height, both |
| 900 × 500 | `min(0.703, 1.582) = 0.703` | `min(0.703, (828 − 36) / 1024 = 0.773) = 0.703` | height, both |
| 1600 × 600 (ultrawide) | `min(0.844, 2.813) = 0.844` | `min(0.844, (1472 − 64) / 1024 = 1.375) = 0.844` | height, both |

Width binds only below roughly a 1.6 viewport aspect. Solving the crossover at the 900 px landscape
floor: width binds when `(900 × 0.92 − 36) / 1024 = 0.7734 < vh × 0.90 / 640 = vh × 0.00140625`, i.e.
when **`vh > 550`**. So at 900 × 500 height binds and at 900 × 600 width binds, and there the formula
shrinks the boards on its own.

Portrait solo worked example, 390 × 844:
`min(844 × 0.72 / 800 = 0.760, 390 × 0.94 / 320 = 1.146) = 0.760` → a 243 × 608 board using 72% of
screen height, leaving 236 px for the touch control band. The opponent mini at
`0.760 × 0.34 = 0.258` is 83 × 206 px — 8.3 px per cell, which reads as a threat gauge, which is all
it needs to be.

**Particles in two-board mode.** Quality tiers, particle capacities and the frame-budget governor are
frozen in contract §2.6 and owned by `visuals.md`. The only versus rule: in two-board mode, halve
per-clear emission for the **per-board `effectLayer`** only. `layerParticleFar`, `layerParticleNear`
and `layerPost` keep their full budget because there is still one of each, and the tier's
`particleCapacity` is a whole-scene ceiling, not a per-board one. All projection-only per `AGENTS.md`
and never readable from the sim.

---

## 4. Local Two Player

Local 2P is the *free* mode: the lockstep sim at input delay 0 with both input streams on one machine.
No network, no protocol, no relay, no rating. Build it first in Phase 2 — it validates the entire
lockstep structure with zero infrastructure.

### 4.1 Device split — DECIDED

| Config | P0 | P1 | Verdict |
|---|---|---|---|
| Keyboard split | Left cluster | Right cluster + numpad | Offered, with an explicit warning. Commodity membrane keyboards ghost on 4+ simultaneous keys across the same matrix row, and two players holding DAS in opposite directions plus a rotate is exactly that case. Never the default. |
| **Keyboard + gamepad** | Keyboard (solo bindings, unchanged) | Gamepad | **Default.** No ghosting, no rebinding, P0 keeps muscle memory from solo. |
| Two gamepads | Gamepad index A | Gamepad index B | Best experience. Auto-selected when two pads are connected at match start. |

Gamepad plumbing exists to copy: `apps/hmh-reboot/src/input.mjs` exports
`mapGamepadSnapshot(gamepad, { deadzone = 0.2, sensitivity = 1, responseCurve = 1 })` (line 60, built
on `normalizeAxisPair` at line 37), and `InputState` tracks `this.gamepad` / `this.gamepadAt` with
per-device recency arbitration. The HMH host sets
`iframe.setAttribute('allow', 'fullscreen; gamepad')` alongside
`iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock')` in
`apps/portal/src/hmh-reboot-host.mjs` lines 121–122, so gamepads reach a sandboxed cabinet iframe —
**the STACKED host must copy the `allow` attribute or pads are silently dead with no error.**

`InputState`'s recency arbitration merges every device into one action record, which is exactly wrong
for 2P. STACKED's router (§4.3) binds each device to one slot and never merges.

### 4.2 Bindings

| Action | P0 keyboard (solo default) | P0 keyboard-split | P1 keyboard-split | Gamepad |
|---|---|---|---|---|
| Move left / right | `ArrowLeft` / `ArrowRight` | `KeyA` / `KeyD` | `ArrowLeft` / `ArrowRight` | D-pad or left stick |
| Soft drop | `ArrowDown` | `KeyS` | `ArrowDown` | D-pad down |
| Hard drop | `Space` | `KeyW` | `ArrowUp` | A / Cross |
| Rotate CW | `KeyX` | `KeyG` | `Numpad3` | B / Circle |
| Rotate CCW | `KeyZ` | `KeyF` | `Numpad1` | X / Square |
| Rotate 180 | `KeyA` | `KeyH` | `Numpad2` | Y / Triangle |
| Hold | `ShiftLeft` (alt `KeyC`) | `KeyT` | `Numpad0` | Left bumper |
| Pause | `Escape` | `Escape` (P0 only) | — | Menu |

Follow the `apps/hmh-reboot/src/action-map.mjs` pattern: one `entries` array of
`[id, label, keyboard, gamepad, touch, help]` frozen into `STACKED_ACTION_MAP` via `freezeDeep`; a
`DEFAULT_KEYBOARD_BINDINGS` map of one primary code per action; a `DEFAULT_ALTERNATES` map for
secondary codes (how HMH gives `moveUp` both `KeyW` and `ArrowUp`, and where `KeyC` for Hold goes);
and `normalizeKeyboardBindings` rejecting codes outside an allowed set and de-duplicating collisions.
`rebindKeyboardAction` throws
`TypeError('keyboard bindings are locked during an active ranked run')` when `rankedActive` is true
(line 56) — **copy that guard**: bindings are locked during a Ranked run and during any versus game.

Two things must NOT be copied verbatim:

- **`ALLOWED_KEY_CODES` in `action-map.mjs` contains no `Numpad*` codes.** Exactly: `Space`, `Escape`,
  `Tab`, `Enter`; `ShiftLeft`/`ShiftRight`, `ControlLeft`/`ControlRight`, `AltLeft`/`AltRight` (three
  modifiers × 2 — there is no `Meta`); the four arrows; `KeyA`–`KeyZ`; `Digit0`–`Digit9`. That is
  4 + 6 + 4 + 26 + 10 = **50 codes**. The P1 keyboard-split column would be silently rewritten to
  fallback codes: `normalizeKeyboardBindings` does **not** throw on an unknown code, it substitutes
  (line 44 falls back to the default, line 48 picks the first unused code from the set). Only
  `rebindKeyboardAction` throws, and only on a direct rebind call. The set is also **module-private**
  (declared `const`, never exported), so STACKED could not import it if it wanted to. Define
  `STACKED_ALLOWED_KEY_CODES` = that set plus `Numpad0`–`Numpad9`, `NumpadAdd`, `NumpadEnter`,
  `NumpadDecimal`.
- **`normalizeKeyboardBindings` de-duplicates within a single binding map.** Two players have two
  maps, so it cannot see a cross-player collision — and `Escape` is deliberately shared. Add
  `normalizeSplitBindings(p0, p1)`, which normalizes each map and then rejects any code present in
  both except an explicit `SHARED_CODES` set (`Escape`). Without it, the split config ships with P0
  and P1 both able to move P0's piece.

### 4.3 Device router

This module reads `navigator.getGamepads()`, so by the rule in §1 it lives in the **child runtime**.

```js
// apps/stacked/src/input-router.mjs   (Phase 2)
export function createStackedInputRouter({ config }) -> {
  claim({ slot, device }),        // device: { kind: 'keyboard-left'|'keyboard-right'|'gamepad', index? }
  pollTick(nowMs) -> Uint8Array,  // length === claimed slot count, index = slot
  releasedSlots(),                // slots whose device vanished this tick
}
```

One device drives exactly one slot; `claim` throws on a double-claim. Gamepads bind by the
`gamepad.index` captured at claim time and are re-validated every poll against
`navigator.getGamepads()[index]?.id`, because indices are reused after a disconnect. `pollTick`
returns `0` bits for a released slot in the tick the loss is detected, `releasedSlots()` is non-empty
on that tick, and the driver pauses the match immediately. Local 2P is never forfeited on a device
unplug — that is a hardware event, not a game result.

### 4.4 Local 2P session model

Local 2P is **Free-mode only, never leaderboard-eligible, and does not call `recordScore` at all.**

`recordScore` in `apps/portal/src/arcade-core.mjs` does short-circuit a session with falsy
`leaderboardEligible`, returning
`{ acceptedForGlobalLeaderboard: false, trackingDisabled: true, localScore: { …, ephemeral: true }, unlockedAchievements: [] }`
(lines 5496–5514). But it is **not** a clean no-op: `ensureProfile(state, session.wallet)` (5493) and
`ensureGameProgress(profile, game.id)` (5494) both run *before* that early return, creating a profile
record and a zeroed `stacked` progress entry as a side effect. Harmless for solo Free; for a couch
match it would attribute a two-player session to the one wallet signed in on the machine.

So: local 2P renders its own end-of-match screen, writes nothing to the parent, and needs **no**
parent-side work beyond a mode-select entry.

---

## 5. Online Two Player — options and recommendation

There is no backend. `submitGameRun` in `apps/portal/src/game-registry.mjs` (line 80) is a stub that
`console.log`s and returns a synthetic success object; the real write path is `recordScore` running
entirely in the browser. Online versus is the first feature in this product that genuinely requires a
server.

### 5.1 Option A — WebRTC peer-to-peer DataChannel + a signaling service

| Axis | Read |
|---|---|
| Latency | Best available. Direct path, typically 20–60 ms RTT within a region → a 3–5 tick delay by the §2.5 formula. |
| Cost | Signaling is trivial (a few messages per match). TURN relay for the connections that fail direct is the real cost: metered bandwidth, and you pay for the worst-connected players. |
| Anti-cheat | **Worst.** Both peers run the sim; there is no neutral witness. A `stateHash` mismatch proves *disagreement*, never *who lied*. A modified client can feed a legal-looking input stream that its own patched sim scores differently, and the honest peer has no authority to reject the result. Ranked wins and losses under P2P are not defensible. |
| NAT / TURN | Realistically 10–20% of connections need TURN (symmetric NAT, carrier-grade NAT on mobile, corporate networks) — also the players most likely to blame the game. |
| CSP / certification | Signaling needs `connect-src wss://<signaling-origin>`. STUN/TURN URLs are configured in JS and the directives that would govern the peer connection are not uniformly implemented, so the current CSP would not meaningfully constrain it — itself a security-review finding. New origins plus a CSP edit means fresh certification per `AGENTS.md`. |

### 5.2 Option B — Authoritative relay (Cloudflare Durable Objects, or PartyKit, which is DO underneath)

One Durable Object per match room. Both clients connect over WSS, send input frames, receive the
merged frame; the DO is the sole ordering authority and the sole result authority.

| Axis | Read |
|---|---|
| Latency | Client → nearest Cloudflare PoP → client, roughly 10–25 ms one-way over direct P2P for same-region players. Absorbed by the §2.5 formula moving input delay one to two ticks — a 60/60 ms same-region pairing goes from 5 ticks direct to 6–7 through the relay, still inside the 8-tick cap. |
| Cost | Batch input at **20 Hz** (three ticks per message), not 60 Hz. A 6-minute match is 7,200 messages per player inbound (14,400 to the DO) and 14,400 merged frames out — ~28,800 WebSocket messages per match. Cloudflare bills incoming WebSocket messages at a 20:1 discount against requests, so ~720 request-equivalents plus ~360 s of DO duration: fractions of a cent per match, and a *typical* match is 90–150 s, a third of that. (Re-check the 20:1 ratio against published pricing at implementation time — vendor term, not a repo fact; the order-of-magnitude conclusion survives at 1:1.) Do not send 60 messages/second/player: 3× the traffic for no perceptible benefit at a 3–5 tick delay. |
| Bandwidth | A merged frame is 3 input bytes × 2 players plus a tick counter — under 20 bytes of payload. At 20 Hz, well under 2 KB/s per client each way. Bandwidth is not a consideration; message *count* is. |
| Anti-cheat | **Best, and the reason to pick this.** The sim is pure, DOM-free JS (`apps/portal/src/stacked-sim.mjs` + `stacked-match.mjs`) and runs unmodified inside a Worker. The DO holds both authoritative input streams and, **after the match ends**, re-simulates the whole match server-side and emits the certified result and both `stateHash` chains. A 6-minute match is 21,600 ticks × 2 boards; at 2 µs per board-step that is ~86 ms of DO CPU, far inside limits and off the hot path. **The 2 µs figure is an unmeasured estimate** and is the one number here that can invalidate the recommendation — benchmark the real `stepAll` in Node before committing, because a 20 µs step turns 86 ms into 860 ms and moves re-simulation out of the "free" column. This is the owner's requirement met exactly: strong anti-cheat without impacting gameplay, because clients still run lockstep locally with zero added input latency beyond the relay hop. |
| NAT / TURN | Not applicable. Plain WSS on 443, works everywhere a web page loads — which alone removes the worst class of support tickets. |
| CSP / certification | One new `connect-src wss://<worker-host>` entry in the STACKED CSP block in `vercel.json`. The `/hmh-reboot/(.*)` block already carries a named allow-list (`https://liteforge.rpc.caldera.xyz wss://liteforge.rpc.caldera.xyz https://liteforge.explorer.caldera.xyz https://liteforge.hub.caldera.xyz https://testnet.litvm.com`), so a named `wss://` origin is an established, reviewable pattern. One CSP edit, one new origin, one certification cycle. |

### 5.3 Option C — Async ghost / race

No live opponent. A player races a stored input stream from a prior human match at a nearby rating,
with the attack table applied from the recorded stream's timeline.

| Axis | Read |
|---|---|
| Latency | Not applicable. |
| Cost | Zero. Ghost streams are the evidence blobs the Ranked path already produces. |
| Anti-cheat | Identical to solo Ranked — the same parent-side replay verification. Nothing new to defend. |
| NAT / CSP | Zero change. No new origin, no CSP edit, no certification cycle. |
| Experience | Honestly, this is not versus. The core of the mode is live counter/cancellation pressure — reading an incoming 4-row attack in the 60-tick charge window and deciding to counter or dig. A ghost cannot react to *you*, so the entire defensive half of the skill tree is inert. Good warm-up, retention, and matchmaking fallback (§6.3); not a substitute for live play. |

### 5.4 Recommendation

**Ship Option C first as the "Ghost Duel" interim, then build Option B as the real online mode. Reject
Option A.**

- Reject A: peer-to-peer has no neutral witness, so Ranked wins and losses are undefendable, and the
  10–20% of players who need TURN get the worst experience while costing the most money.
- Pick B: the only option where an authoritative party can re-simulate and certify the result, paid
  for with ~15 ms of relay hop — one extra tick of input delay, invisible next to the genre's
  100–250 ms reaction budget.
- Ship C first: costs nothing, changes no CSP, reuses the Ranked evidence format, and gives versus a
  matchmaking fallback that will be needed on day one of B anyway.

Sequencing after Phase 1: local 2P (no infra) → Ghost Duel (no infra) → relay online (one new origin,
one certification cycle).

### 5.5 Evidence transport in versus

The codec, chunking, and every ceiling are frozen in contract §2.3 and owned by `integrity.md`: `SIC1`
transition encoding, `STACKED_MAX_EVIDENCE_BYTES = 1_302_000`,
`STACKED_EVIDENCE_CHUNK_RAW_BYTES = 42_000`, `STACKED_EVIDENCE_CHUNK_B64_CHARS = 56_000`,
`STACKED_MAX_EVIDENCE_CHUNKS = 33`, `STACKED_MAX_INPUT_TRANSITIONS = 432_000`, shipped to the parent
as ordered `game:evidence-chunk` messages under the 65,536-byte envelope cap. Three versus-only
consequences:

1. **Chunking is not a versus feature and must not be deferred to Phase 2.** A 40-minute solo Ranked
   run is roughly 6,000 pieces × ~20 post-expansion transitions ≈ 120,000 transitions ≈ 132,000 raw
   bytes ≈ 176,000 base64 chars ≈ 4 chunks. A single message cannot carry it; Phase 1 needs the
   chunked path for solo alone.
2. **A match produces two independent streams, and neither travels through the other player's
   bridge.** Each client submits only its own stream to its own parent. The relay holds both and is
   the only party that ever sees the pair, which is what makes server-side re-simulation the
   authoritative result and the local submission a claim.
3. **Versus network traffic goes directly from the child runtime to the relay**, never through the
   parent bridge. The parent bridge carries only the init context, the chunked evidence, and the final
   result.

One repo hazard constraining all of the above: `apps/portal/src/session-integrity.mjs` line 2 sets
`MAX_INPUT_TRANSITIONS = 20_000` (module-private, consumed by `recordSessionInput`, which increments
`evidence.droppedInputs` on overflow at line 118), and `finalizeSessionEvidence` then **throws**
`'session evidence overflowed its bounded logs'` whenever `droppedInputs` is non-zero (line 143). A
god-tier run would not merely lose its tail; it would fail hard at finalization and produce no
submittable run at all. **STACKED keeps its own evidence buffer with the contract's constants and must
neither reuse nor change `session-integrity.mjs`'s.**

---

## 6. Matchmaking (design level, deferred)

### 6.1 Rating

No rating exists in the repo. `updateRank(profile)` (`apps/portal/src/arcade-core.mjs` line 5125,
module-private) sets `profile.rank` to one of four XP-threshold strings — `'Arcade Legend'` at
`xp >= 1000`, `'Boss Hunter'` at `>= 500`, `'Quarter Master'` at `>= 150`, else `'New Challenger'`.
That is a progression badge, not a skill measure, and must not be used for matchmaking. There is no
Elo, rating, or MMR field anywhere in `arcade-core.mjs` or `leaderboard-engine.mjs`.

Introduce a versus rating under `profile.progress.stacked.custom.versus` — **a P2 addition, not a
Phase 1 reservation**; `custom` is frozen at eleven keys until then (§7 item 2, `portal.md` §2.5).
**Use Glicko-2, not Elo:** a
small arcade playerbase produces exactly the two conditions Elo handles badly — very low game counts
and long inactivity gaps. Glicko-2's rating deviation makes a new player's first ten matches move fast
and then settle.

Constants, pinned (Glicko-2 has no useful defaults if you do not state them):

```
initialRating     = 1500      // Glicko-2 convention
initialRd         = 350
initialVolatility = 0.06
tau               = 0.5       // system constant; 0.3–1.2 is the sane band, lower = less volatile
rdFloor           = 50        // stops a grinder's RD collapsing to near-zero
rdCeiling         = 350
ratingPeriod      = 24 h UTC  // idle RD inflation runs once per period, per Glicko-2's pre-period step
```

Seed a first-time versus rating from the player's solo Ranked standing so match one is not a coin
flip:

```js
const board = getLeaderboard(state, 'stacked', 'all-time', {
  wallet, limit: 1,
  filterToCurrentVersion: false,   // REQUIRED — see below
});
// board.playerRank is 1-based and null when the wallet has no ranked entry;
// board.total is the number of distinct wallets on the board.
if (board.playerRank === null || board.total < 8) {
  rating = 1500;                                  // unseeded default
} else {
  const topFraction = 1 - (board.playerRank - 1) / (board.total - 1);  // 1.0 = best
  rating = 1300 + Math.round(topFraction * 400);  // 1300..1700
}
rd = 350;   // full uncertainty; the seed is a hint, not a claim
```

Three things an implementer will otherwise get wrong:

- **The percentile direction is easy to invert.** `rank / total` puts the *best* player at ~0 and the
  *worst* at 1.0, so a naive `1000 + percentile * 800` hands the champion the lowest rating in the
  pool. `topFraction` above is the corrected form; the `total - 1` denominator plus the `total < 8`
  guard removes the division-by-zero and the meaningless two-player case.
- **`filterToCurrentVersion` defaults to `true`** (`apps/portal/src/leaderboard-engine.mjs` line 119):
  `getLeaderboard` drops rows whose `version` is not the current deploy version, so each deploy starts
  with fresh leaderboards. At the default, every seed read the day after a deploy sees a near-empty
  board and returns 1500 for everyone. Pass `false`.
- **`recordCadenceScore` caps each period bucket at `limitPerPeriod = 100` *rows*** (line 77, applied
  at line 105) **and `getLeaderboard` then dedupes to one best row per wallet.** So `board.total` is
  at most 100 and usually fewer — one player holding ten top-100 runs shrinks the distinct-wallet
  count to 91, and anyone outside the stored top 100 rows gets `playerRank: null` and the 1500
  default. Acceptable (the seed is a hint that RD 350 erases in ten matches) but it must be stated,
  not discovered. Do not build a percentile model that assumes the board is the whole playerbase, and
  do not read `topEntries.length` as the population: `limit` truncates `topEntries` only, while
  `total` and `playerRank` are computed over the full deduped list.

The state path is `state.cadenceLeaderboards[gameId][cadence][periodKey]` — four levels, not three.
Read it through `getLeaderboard`, never by indexing the store.
`LEADERBOARD_CADENCES = Object.freeze(['daily','weekly','monthly','yearly','all-time'])` (line 16) and
`getLeaderboard(state, gameId, cadence, options)` are already `gameId`-generic, so the percentile read
needs no engine change.

### 6.2 Queue and bracket widening

| Elapsed in queue | Accepted rating band |
|---|---|
| 0–5 s | ±100 |
| 5–10 s | ±150 |
| … +50 per 5 s … | |
| 40 s+ | ±500 (cap) |
| 45 s | fall back (§6.3) |

Two additional constraints:

- **Pair only when the resulting input delay is playable, and the rule is on the *sum*, not the
  difference.** Reject a pairing unless `ceil((p95RttA / 2 + p95RttB / 2 + 12) / 16.667) <= 8`.
  Solving: `rttA/2 + rttB/2 <= 133.33 − 12 = 121.33`, so **`rttA + rttB <= 242 ms`**. A difference
  rule does not work: lockstep delay is symmetric, so two players at 300 ms each have a difference of
  zero and an unplayable 19-tick delay (`(150 + 150 + 12) / 16.667 = 18.7 → 19`), while a 10 ms /
  120 ms pair has a difference of 110 ms and plays fine at 5 ticks
  (`(5 + 60 + 12) / 16.667 = 4.62 → 5`).
- Never pair the same two players twice within 3 matches unless both accept a rematch.

### 6.3 Timeout fallback — DECIDED: ghost first, bot second

At 45 seconds with no human match:

1. **Ghost** — replay the nearest-rating stored human input stream (within ±200 rating). Preferred: a
   real person's play, costs nothing to author, the evidence format already exists, and no player can
   accuse it of rubber-banding.
2. **Bot** — only if no ghost exists within ±200. A deterministic policy driven by the same sim at a
   rating-matched pieces-per-minute and placement-error rate.

**Neither writes rating and neither writes a W/L.** Both return `resolution: 'unranked-fallback'`. Any
bot or ghost that awards rating is a rating farm within a week.

### 6.4 Rematch

Rematch keeps the lobby and the relay room. Each game is a distinct certified result with its own
parent-issued **match seed** (one seed per game, shared by both boards — §2.1); a best-of-3 set is a
client-side presentation over three independent results, **not** a leaderboard object. Either player
may leave between games with no penalty. Input delay may be re-negotiated between games (§2.5) and
never within one.

### 6.5 Disconnect handling and match resolution

10-second reconnect grace. The DO holds the room and the authoritative input timeline, so a
reconnecting client resyncs by **replaying from tick 0**. Cheap on both axes: the whole match is a few
tens of kilobytes of transition-encoded input (§5.5), and re-simulating 21,600 ticks × 2 boards at
2 µs per board-step is ~86 ms of client CPU — two orders of magnitude inside the 10 s grace, on the
same unmeasured 2 µs estimate flagged in §5.2. Replay-from-tick-0 is chosen over snapshot-transfer
deliberately: a snapshot is a second way to reach a sim state, and two ways to reach a state is how a
lockstep build desyncs.

```js
export const STACKED_MATCH_RESOLUTIONS = Object.freeze([
  'decided', 'draw', 'forfeit', 'void', 'desync', 'rejected', 'unranked-fallback',
]);
```

This is a **match-level** enum and is not `STACKED_TERMINAL_REASONS` (contract §1.3), which is
per-board and lives in the run summary. `'topped-out'` deliberately does not appear: contract §1.3
rejected it as a `terminalReason` value, and reusing a rejected string in a second namespace is how
two verifiers end up disagreeing.

| Situation | `resolution` | W / L | Rating |
|---|---|---|---|
| Normal terminal condition on one board | `'decided'` | W / L | Full Glicko-2 update both sides |
| Disconnector's board had already gone terminal | `'decided'` | W / L | Full |
| Both boards terminal on the same tick | `'draw'` | none | Full Glicko-2 update at score 0.5 both sides |
| Player drops > 10 s, game live | `'forfeit'` | W to the survivor, L to the disconnector | Asymmetric — see below |
| Both clients report the same relay close code (room/infra failure) | `'void'` | none | none |
| `stateHash` mismatch at any 60-tick checkpoint | `'desync'` | none | none; both input streams captured for triage |
| Server-side re-simulation disagrees with the reported result | `'rejected'` | none | none; the run is flagged for review |
| Ghost or bot fallback (§6.3) | `'unranked-fallback'` | none | none |

**The asymmetric forfeit, stated precisely.** The disconnector takes a full, canonical Glicko-2 loss —
rating, RD, and volatility all updated as normal. The survivor is a deliberate deviation from
canonical Glicko-2: compute the normal win update, apply **40% of the rating delta**, and leave the
survivor's RD and volatility **unchanged**. Scaling the rating delta while also updating RD would
corrupt the deviation model, which is the part of Glicko-2 doing the real work. This is a
rating-integrity trade made on purpose: losing 100% for quitting while the opponent gains only 40%
makes rage-quitting strictly worse than playing the loss out, and makes it unprofitable to farm rating
by killing your own network on a friend's account. Three `'forfeit'` results in a rolling window of 20
matches triggers a 15-minute queue cooldown.

Free-mode versus never writes any of this. Only Ranked versus produces W/L and rating, and only when
the relay's server-side re-simulation agrees with the reported result.

---

## 7. Phase 1 scope — what must be in

Each item is hours of work in Phase 1 and days-to-weeks of rework if skipped.

1. **`apps/portal/src/stacked-versus-table.mjs`** — the frozen `STACKED_ATTACK_TABLE` plus
   `computeAttack` and `resolveGarbageExchange`, fully unit-tested in
   `tests/stacked-versus-table.test.mjs`: the `backToBackMinLines` gate, the `max(spin, base)` floor,
   the `sent === null` zero-row case, the `clearType` precedence order, and the rows-per-piece
   assertions from §1.5. **Imported by no runtime code** — and the test must assert that by grepping
   the tree for importers, because the claim decays silently the first time someone needs a constant
   from it. (`garbageHoleColumn` and the board geometry live in `stacked-sim.mjs` and
   `stacked-contracts.mjs`, because solo's rising ledger consumes them in Phase 1; that split is the
   only reason the zero-importer claim is true.)
2. **Reserved versus fields in the run summary — as an object of integer zeros, in exactly one place.**
   Contract §4.4 freezes the shape: `summary.versus = { wins, losses, draws, garbageSent,
   garbageReceived, kos, roundsPlayed }`, every one an integer bounded `0..100_000` and **exactly `0`
   in Phase 1**, with the validator rejecting any other value. That is the whole reservation.

   **Three shapes an earlier draft of this section proposed are dead**, and contract §1.2's last row
   records them as rejected. `versus: null` on the `game:result` payload: §4.5 freezes that payload at
   exactly seven top-level keys and `versus` is not one of them. `versus: null` in the stored
   `runStats`: §4.4's projection is exactly sixteen keys and `versus` is not one of them. And
   `custom.versus = { wins, losses, rating, ratingDeviation, volatility }` on the per-game progress
   record: `portal.md` §2.5 freezes `progress.stacked.custom` at exactly eleven keys, and S-20's test
   asserts that exact set. Under exact-key **and** key-count validation the `null` shape and the
   object-of-zeros shape reject each other — only one can ship, and it is the object of zeros, because
   every field validates through the same integer-bounds path as the rest of the summary and no
   consumer needs a null branch.

   The reason the reservation must happen *now* is unchanged and is the point of this item. Bridge
   validators here use exact-key checking in both directions —
   `apps/portal/src/chikun-bridge-protocol.mjs` has `exactKeys(value, expected, label)` (line 16),
   rejecting both unexpected and missing keys, and `sdk/hmh-run-summary-schema.mjs` has a
   `keys(value, expected, label)` helper that additionally rejects a payload whose key *count* differs,
   with `validateRunSummaryPayload` gating each added field group behind a `schemaVersion` check. Both
   helpers are module-private, so STACKED writes its own copy — copy the two-direction check exactly,
   including the key-count guard. **Adding a field group to `stacked-bridge/v1` after ship therefore
   costs a protocol version bump and a parallel validator branch**, which is why the seven zeros go in
   at S-08 and not at P2.

   The progress-record groundwork P2 needs is `custom` itself, not `custom.versus`.
   `createEmptyGameProgress` (`apps/portal/src/arcade-core.mjs` line 4927) is 21 HMH-specific fields
   (`bestPaidScore`, `bestFreeScore`, `paidRuns`, `freeRuns`, `longestRunSeconds`,
   `bestDistanceMeters`, `totalKills`, `grenadeKills`, `meleeKills`, `bossKills`, `perfectBossKills`,
   `cumulativeSeconds`, `cumulativePowerUps`, `maxCombo`, `maxDamageCombo`, `enemyKillsByType`,
   `weaponIdsUsed`, `uniquePowerUps`, `bossesDefeated`, `lastSessionId`, `lastPlayedAt`) with no
   generic `custom` bag. Adding one is strictly additive, and `restoreArcadeState` in
   `apps/portal/src/persistence.mjs` copies each profile wholesale with
   `state.profiles[wallet] = { ...profile }` under a snapshot-version accept-list and no migration
   function, so it needs **no** persist-version bump. **But** `ensureGameProgress` uses
   `profile.progress[gameId] ??= createEmptyGameProgress(gameId)` (line 4956), so a profile persisted
   before `custom` existed never gains it on restore. Every read of a `custom` key must therefore
   defend — `progress.custom?.<key> ?? 0`, forever. When P2 lands, `custom` moves from eleven keys to
   twelve (`roundsPlayed`) in the same commit that widens S-20's exact-set test; nothing before that
   commit may test for a twelfth.
3. **The deterministic, lockstep-capable sim** — `createStackedRuntime` in
   `apps/portal/src/stacked-sim.mjs` (S-02) plus `createStackedMatch` in
   `apps/portal/src/stacked-match.mjs` (**S-03**, with `tests/stacked-match.test.mjs`), with the §2.4 ordering rules, integer-only state, one input
   byte per tick dequeued from a 256-entry tick-indexed ring buffer (never a per-frame snapshot
   replayed into catch-up steps), `stateHash()` exported, one match seed with a per-board `bag`
   instance, and `createSeededSubstreams(seed, ['bag','garbage','zone'])` for RNG. Constructed with
   one board and `attackTable: null` in Phase 1.
4. **The §2.8 interruption matrix implemented for the solo columns**, including the hidden-tab rule.
   Retrofitting pause semantics into a lockstep match later is a protocol change, not a UI change.
5. **Chunked evidence in `apps/portal/src/stacked-bridge-protocol.mjs`.** Chunking is not a versus
   feature — a 40-minute solo Ranked run needs it (§5.5). Message shapes and constants are
   `portal.md`'s and contract §4.1's, and the `game:result` payload carries **no** `versus` key: the
   reservation lives in `summary.versus` only, per item 2.
6. **The two-board-capable render tree** — `createLayerStack()` as the sole `app.stage.addChild`
   caller with injected display-object constructors, `createStackedBoardView({ frame })` returning a
   self-contained container with no viewport reads, `boardSlot[1]` created and hidden, and
   `layoutMatch()` as a pure function in `apps/portal/src/stacked-layout.mjs` called with
   `boardCount: 1`.
7. **Two regression tests that pin the structure.** `tests/stacked-render-tree.test.mjs`: assert
   `stage.children.length === 1`; assert `stackedRoot` has exactly the six documented children in
   z-order; assert `boardSlot[n]` contains exactly the seven documented board-view children; assert
   `layoutMatch({ boardCount: 2, … })` returns two visible slots today even though nothing renders
   them; assert the §3.3 worked scale values. `tests/stacked-sim-determinism.test.mjs`: drive
   `stepAll` over a scripted 20,000-tick stream twice from one seed and assert identical `stateHash`
   chains; assert a different seed diverges; assert that stepping the same stream in batches of 4
   produces the same terminal `stateHash` as stepping it one tick at a time (the §2.3 granularity
   invariant); and assert `garbageHoleColumn`'s per-branch RNG draw counts (1 / 1 / 2), so a burned
   draw is caught at the unit level rather than as a mysterious replay mismatch.

Both modules (`stacked-match.mjs`, `stacked-versus-table.mjs`) and both tests
(`tests/stacked-match.test.mjs`, `tests/stacked-versus-table.test.mjs`) land in **S-03** and are
appended to `NODE_CHECK_FILES` in `scripts/syntax-check.mjs` there. Both modules are in the contract
§2.10 module map with their import rules.

## 8. Phase 1 scope — what must not be in

1. **Any network code at all:** no WebRTC, no WebSocket, no signaling, no relay Worker, no PartyKit
   dependency, and **no new `connect-src` origin** in `vercel.json`. Phase 1 *does* touch `vercel.json`
   for the STACKED cabinet's own CSP block, cache-control source, and catch-all lookahead — those
   edits and their exact strings are contract §3 and `portal.md`. What is banned here is spending a
   *second* certification cycle on a versus `wss://` origin.
2. Any second board actually instantiated, rendered, or simulated. `boardSlot[1]` stays empty.
3. Any versus entry in `CABINET_MODE_SELECT_PRESENTATIONS`
   (`apps/portal/src/arcade-core.mjs` line 496), any versus button, lobby, or queue UI.
4. Any rating storage, W/L display, Glicko-2 implementation, or versus column in
   `apps/portal/src/routes/official-leaderboard-route.mjs`. Reserve the progress fields (§7 item 2);
   do not compute or render them. That route hard-codes its column model behind a single
   `const chikunBoard = routeState.gameId === 'chikun'` boolean (line 242) rather than a per-game
   column descriptor registry, so a third game's columns need a real refactor — and that refactor
   belongs to the solo leaderboard cycle, not to versus.
5. Bot policy, ghost playback in versus, or any opponent-simulation code.
6. Rollback machinery: no snapshot ring buffer, no re-sim loop, no speculative remote input. §2.5
   decided against rollback; do not build it "just in case".
7. A generalized multi-cabinet "match" bridge protocol. `stacked-bridge/v1` is single-player-shaped in
   Phase 1, and its only versus reservation is `summary.versus`'s seven integer zeros (§7 item 2);
   versus traffic later goes runtime-to-relay, not through the parent bridge.
8. Any change to `DeterministicSimulation`'s `RANDOM_STREAMS`, `FIXED_STEP_MS`, or
   `MAX_CATCH_UP_STEPS`, and any change to `MAX_INPUT_TRANSITIONS` in
   `apps/portal/src/session-integrity.mjs`. Fixed 60 Hz simulation and a maximum of four catch-up
   steps are `AGENTS.md` preserve-items for HMH; STACKED uses its own RNG module and its own evidence
   buffer and reuses the frame driver as-is.
