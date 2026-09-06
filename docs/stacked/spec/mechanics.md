# STACKED — Core Mechanics & Tuning

> Precedence: `../STACKED-CONTRACTS.md` overrides this specification wherever they disagree.

**Scope.** Implementation authority for STACKED's deterministic falling-block simulation and nothing
else: board, piece and kick tables, spin detection, randomizer, hold, gravity and lock-delay curves,
the input mask as the sim consumes it, the rising-ledger garbage model and its HASHPOWER defence
economy, the scoring table, the terminal conditions, the derivation showing the shipped constants hit
the owner's session-length bands, and the Free-vs-Ranked rule differences. Evidence encoding and
verification, rendering, touch and layout, portal wiring, two-player and CI gates are owned by sibling
documents in `docs/stacked/spec/` and are cross-referenced, never restated. Every value here is either
frozen in `docs/stacked/STACKED-CONTRACTS.md` — which wins on any disagreement — or derived here from
one that is. A missing value is an open question, not a coder's judgement call.

**Where the values ship.** Every constant named in `STACKED-CONTRACTS.md` §2 is exported from
`apps/portal/src/stacked-contracts.mjs`, which imports nothing; a second declaration anywhere fails
`tests/stacked-contracts.test.mjs`. The tables that exist only in this document (`PIECE_CELLS`,
`SPAWN_ORIGIN`, the three kick tables, `HASHPOWER_PER_CLEAR`, `REORG_COST_*`, `PERFECT_CLEAR_BONUS`)
are exported from `apps/portal/src/stacked-sim.mjs` as `STACKED_SIM_CONSTANTS`. `stacked-sim.mjs` is
the sim's only home: DOM-free, importable by a plain `node --test` file and by the child runtime, and
it may import nothing but `./seeded-rng.mjs` and `./stacked-contracts.mjs`. It is **not**
`stacked-cabinet.mjs`, which holds only `STACKED_CABINET_VERSION` and the replay claim.

**Trademark note, stated once.** The four-line clear is **HALVING** in player-facing copy and `quad`
in every identifier. The competing brand name other falling-block games use for that clear appears
nowhere in STACKED's code, assets, copy, ids or version strings.

## Contents

1. Board
2. Pieces, spawn orientation, spawn position
3. Rotation, wall kicks, spin detection
4. Randomizer, next queue, hold, ghost
5. Gravity, lock delay, drops
6. The input mask as the simulation consumes it
7. Spawn, top-out, pause and interruption
8. Line clears and the rising ledger
9. Scoring
10. Difficulty validation against the owner's session bands
11. Timestep, integer discipline, and the sim/presentation boundary
12. Free Mode vs Ranked Mode

---

## 1. Board

| Constant | Value | Why |
| --- | --- | --- |
| `BOARD_WIDTH` | `10` | The only width the §3 kick tables are defined against. Narrower breaks I-piece kicks; wider invalidates §8's garbage/hashpower arithmetic. |
| `BOARD_VISIBLE_ROWS` | `20` | Legible cell size in 9:16 portrait and full-bleed in 16:9 without letterboxing. |
| `BOARD_BUFFER_ROWS` | `4` | Two rows for spawn (all seven pieces spawn wholly inside rows 20–21), two for I-piece vertical kicks and to detect garbage-out one row before it is unrecoverable. |
| `BOARD_ROWS` | `24` | `BOARD_VISIBLE_ROWS + BOARD_BUFFER_ROWS`. Not 40: lock-out fires at `y >= 20`, so no piece ever rests above row 23. |
| `BOARD_CELLS` | `240` | One `Uint8Array(240)`. Small enough that a full-board scan every lock is free, which deletes an entire class of incremental-bookkeeping desync bugs. |

Coordinates: `x` is `0..9` left to right, `y` is `0..23` **bottom to top** (`y = 0` is the floor).
Index = `y * 10 + x`. Visible rows `y = 0..19`; buffer rows `y = 20..23`.

Cell values: `0` empty, `1..7` piece colours in the order `I J L O S T Z`, `8` garbage. Store nothing
else — the board bytes are part of the replay comparison and of `boardHash`.

y-up is chosen because rising garbage, gravity and stack height all read naturally in that frame. The
§3 kick tables are therefore printed **already converted to y-up**; do not flip their signs again.

---

## 2. Pieces, spawn orientation, spawn position

Four rotation states per piece: `0` (spawn), `R` (one clockwise), `2` (180), `L` (one
counter-clockwise). A state is four `(bx, by)` offsets inside a bounding box whose bottom-left corner
is the piece origin `(x, y)`. Board cell = `(x + bx, y + by)`. `I` and `O` use a 4×4 box; `J L S T Z`
use a 3×3 box.

Generating rule: a clockwise rotation maps `(bx, by) -> (by, N-1-bx)`, `N` = box size (3 or 4). Every
state below is the CW image of the one before it; `tests/stacked-sim-determinism.test.mjs` must assert
that for all seven kinds and all four transitions per kind, comparing cell **sets**, not array order.
The printed tables pass that check mechanically on all 28 transitions, so a failing test means the
table was edited.

```js
// apps/portal/src/stacked-sim.mjs
export const PIECE_CELLS = Object.freeze({
  I: Object.freeze([
    Object.freeze([[0,2],[1,2],[2,2],[3,2]]), // 0
    Object.freeze([[2,3],[2,2],[2,1],[2,0]]), // R
    Object.freeze([[0,1],[1,1],[2,1],[3,1]]), // 2
    Object.freeze([[1,3],[1,2],[1,1],[1,0]]), // L
  ]),
  O: Object.freeze([                          // identical in all four states
    Object.freeze([[1,2],[2,2],[1,1],[2,1]]),
    Object.freeze([[1,2],[2,2],[1,1],[2,1]]),
    Object.freeze([[1,2],[2,2],[1,1],[2,1]]),
    Object.freeze([[1,2],[2,2],[1,1],[2,1]]),
  ]),
  J: Object.freeze([
    Object.freeze([[0,2],[0,1],[1,1],[2,1]]),
    Object.freeze([[1,2],[2,2],[1,1],[1,0]]),
    Object.freeze([[0,1],[1,1],[2,1],[2,0]]),
    Object.freeze([[1,2],[1,1],[0,0],[1,0]]),
  ]),
  L: Object.freeze([
    Object.freeze([[2,2],[0,1],[1,1],[2,1]]),
    Object.freeze([[1,2],[1,1],[1,0],[2,0]]),
    Object.freeze([[0,1],[1,1],[2,1],[0,0]]),
    Object.freeze([[0,2],[1,2],[1,1],[1,0]]),
  ]),
  S: Object.freeze([
    Object.freeze([[1,2],[2,2],[0,1],[1,1]]),
    Object.freeze([[1,2],[1,1],[2,1],[2,0]]),
    Object.freeze([[1,1],[2,1],[0,0],[1,0]]),
    Object.freeze([[0,2],[0,1],[1,1],[1,0]]),
  ]),
  T: Object.freeze([
    Object.freeze([[1,2],[0,1],[1,1],[2,1]]),
    Object.freeze([[1,2],[1,1],[2,1],[1,0]]),
    Object.freeze([[0,1],[1,1],[2,1],[1,0]]),
    Object.freeze([[1,2],[0,1],[1,1],[1,0]]),
  ]),
  Z: Object.freeze([
    Object.freeze([[0,2],[1,2],[1,1],[2,1]]),
    Object.freeze([[2,2],[1,1],[2,1],[1,0]]),
    Object.freeze([[0,1],[1,1],[1,0],[2,0]]),
    Object.freeze([[1,2],[0,1],[1,1],[0,0]]),
  ]),
});

export const SPAWN_ORIGIN = Object.freeze({
  I: Object.freeze({ x: 3, y: 18 }), // cells land on cols 3-6, board row 20
  O: Object.freeze({ x: 3, y: 19 }), // cells land on cols 4-5, board rows 20-21
  J: Object.freeze({ x: 3, y: 19 }), // 3-wide kinds land on cols 3-5, board rows 20-21
  L: Object.freeze({ x: 3, y: 19 }),
  S: Object.freeze({ x: 3, y: 19 }),
  T: Object.freeze({ x: 3, y: 19 }),
  Z: Object.freeze({ x: 3, y: 19 }),
});
```

Every piece spawns in state `0`, wholly inside the buffer (rows 20–21): with the 3×3 origins at
`y = 19` no state-`0` cell has `by = 0`, so the lowest occupied row is 20 for all seven kinds.
Immediately after spawn the sim attempts exactly one free downward shift (`y -= 1`); if that cell set
is clear the piece takes it, so the player normally sees the piece straddling rows 19–20. The free
shift is **not** a move for lock-delay purposes: it does not set `lastActionWasRotation`, does not
touch `lockResetsUsed`, and `lowestYReached` is initialised to the piece's `y` *after* it.

**Collision, stated once.** A cell set collides if any cell has `x < 0`, `x > 9`, `y < 0`,
`y >= BOARD_ROWS` (i.e. `y > 23`), or lands on a non-zero board byte. The `y > 23` half matters: `I`
in state `R` is four rows tall and a `+2` kick from the spawn region can reach rows 22–23, so "off the
top" must be a collision rather than an unchecked write. There is no wrap and no clamp anywhere in the
sim.

**The first piece spawns during construction**, before tick 1: `createStackedRuntime` fills the queue
(§4), spawns, and applies the free downward shift, so `snapshot()` is already a legal playable state
before the host runs a fixed step. Every later spawn happens inside `step()`, at the end of the tick
that locked the previous piece.

---

## 3. Rotation, wall kicks, spin detection

Rotate by transforming to the target state at the same origin, then trying each offset in the relevant
list **in order**; the first collision-free result wins. If every offset fails the rotation is
rejected and nothing changes — not the piece, not the lock timer, not the reset counter, not
`lastActionWasRotation`. `O` never kicks and never rotates: an `O` rotation is accepted (it consumes
the input and counts as a successful action for lock-delay reset) but the cell set and origin are
unchanged, and `lastKickIndex` is `0`.

**`STACKED_KICKS_JLSTZ`** — offsets `[dx, dy]`, y-up:

| Transition | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| `0 -> R` | `0,0` | `-1,0` | `-1,+1` | `0,-2` | `-1,-2` |
| `R -> 0` | `0,0` | `+1,0` | `+1,-1` | `0,+2` | `+1,+2` |
| `R -> 2` | `0,0` | `+1,0` | `+1,-1` | `0,+2` | `+1,+2` |
| `2 -> R` | `0,0` | `-1,0` | `-1,+1` | `0,-2` | `-1,-2` |
| `2 -> L` | `0,0` | `+1,0` | `+1,+1` | `0,-2` | `+1,-2` |
| `L -> 2` | `0,0` | `-1,0` | `-1,-1` | `0,+2` | `-1,+2` |
| `L -> 0` | `0,0` | `-1,0` | `-1,-1` | `0,+2` | `-1,+2` |
| `0 -> L` | `0,0` | `+1,0` | `+1,+1` | `0,-2` | `+1,-2` |

**`STACKED_KICKS_I`**:

| Transition | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| `0 -> R` | `0,0` | `-2,0` | `+1,0` | `-2,-1` | `+1,+2` |
| `R -> 0` | `0,0` | `+2,0` | `-1,0` | `+2,+1` | `-1,-2` |
| `R -> 2` | `0,0` | `-1,0` | `+2,0` | `-1,+2` | `+2,-1` |
| `2 -> R` | `0,0` | `+1,0` | `-2,0` | `+1,-2` | `-2,+1` |
| `2 -> L` | `0,0` | `+2,0` | `-1,0` | `+2,+1` | `-1,-2` |
| `L -> 2` | `0,0` | `-2,0` | `+1,0` | `-2,-1` | `+1,+2` |
| `L -> 0` | `0,0` | `+1,0` | `-2,0` | `+1,-2` | `-2,+1` |
| `0 -> L` | `0,0` | `-1,0` | `+2,0` | `-1,+2` | `+2,-1` |

**`STACKED_KICKS_180`** — six offsets, shared by `I J L S T Z` (**`O` excluded**: an `O` 180 is the
identity and never displaces the piece):

| Transition | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| `0 -> 2` | `0,0` | `0,+1` | `+1,+1` | `-1,+1` | `+1,0` | `-1,0` |
| `2 -> 0` | `0,0` | `0,-1` | `-1,-1` | `+1,-1` | `-1,0` | `+1,0` |
| `R -> L` | `0,0` | `+1,0` | `+1,+2` | `+1,+1` | `0,+2` | `0,+1` |
| `L -> R` | `0,0` | `-1,0` | `-1,+2` | `-1,+1` | `0,+2` | `0,+1` |

Those four are the complete 180 set (`0<->2`, `R<->L`). Offset 1 (`0,0`) is the true 180 about the
bounding-box centre for **all seven kinds**: applying `(bx, by) -> (N-1-bx, N-1-by)` to every state `0`
and state `R` in `PIECE_CELLS` reproduces state `2` and state `L` exactly, with no origin offset. A
unit test must assert that alongside §2's CW test. Two consequences to expect and not "fix": for
`J L S T Z` the true 180 preserves the flat three-cell row, so a free-air `0 -> 2` at offset 1 does not
move the piece at all (only the odd cell flips side); for `I` the box centre `(1.5, 1.5)` lies between
cells, so the true 180 *does* translate — `0 -> 2` moves the bar down one row and `R -> L` one column
left. Offsets 2–6 are ordinary kicks on top.

180 rotation ships enabled and bound by default, and is a rotation like any other for lock-delay reset
and spin detection.

### 3.1 Spin detection

Evaluate at the moment of lock, in this order.

1. `O` is never a spin. `O` rotations succeed unconditionally, so allowing them to qualify would make
   every flat 2-wide well a free spin bonus.
2. The last successful action before the lock must have been a rotation
   (`lastActionWasRotation === true`). A shift, a gravity step, a soft-drop step or a hard drop clears
   the flag.
3. Then, by kind:
   - **`I J L S Z` — 4-way immobility.** The locked piece must be unable to move down, left, right
     **or up**. Without the `up` test, any bar or skew resting on flat floor between two walls of
     stack qualifies and ordinary tucks score spin values. Every qualifying non-`T` placement is a
     **mini spin** (`clearType: 'spin-mini'`), regardless of kick index.
   - **`T` — the corner rule, and *not* the immobility test.** At least 3 of the 4 diagonal corners of
     the T's 3×3 box must be occupied-or-out-of-bounds. **Full spin** (`clearType: 'spin-full'`) when
     at least 2 of those 3 are the corners adjacent to the nub, or when the accepted kick index was
     `4` (the last, largest offset), which is what promotes deep tuck-spins. Otherwise **mini spin**.

`T` is exempt from immobility because most guideline T-spin singles and doubles leave the T free to
move *up* after landing; requiring immobility would delete most of that vocabulary. Non-`T` kinds have
no corner rule to lean on, so immobility is the right test there, and they therefore only ever score
mini values (§9). `lastKickIndex` is stored in sim state so the promotion test is replayable.

---

## 4. Randomizer, next queue, hold, ghost

**7-bag.** `['I','J','L','O','S','T','Z']` shuffled with an in-place Fisher–Yates consuming exactly
**6** draws from the `bag` substream:

```js
function shuffleBag(rng) {                       // rng: SeededRng
  const bag = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  for (let i = 6; i > 0; i -= 1) {
    const j = Math.floor(rng.float() * (i + 1)); // float() is [0,1), so j <= i
    const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
  }
  return bag;
}
```

Streams come from `createSeededSubstreams(seed, ['bag', 'garbage', 'zone'])`
(`apps/portal/src/seeded-rng.mjs:129`), which derives each as
`new SeededRng(hashSeed(safeSeed ^ hashStreamName(name)))`. The sim draws from `bag` and `garbage`
only; `zone` is reserved for the projection layer and the sim must never touch it. Do not fork
`mulberry32` into a fourth copy — that module's header records that it exists because two copies had
already drifted into `drop-tables.mjs` and `leaderboard-seed.mjs`.

**Seed normalisation, because the two ends must agree exactly.** The bridge accepts `session.seed` as
any uint32 (`sdk/hmh-bridge-protocol.mjs:108` validates
`integerInRange(payload.session.seed, 0, 0xffff_ffff)`), but `SeededRng` and `createSeededSubstreams`
both coerce with `Math.floor(Number(seed) || 1) >>> 0` (`seeded-rng.mjs:69`, `:130`), so **seed `0`
silently becomes seed `1`**. STACKED normalises once, explicitly:

```js
export const normalizeSeed = (seed) => (Math.floor(Number(seed) || 1) >>> 0) || 1;
```

Store the normalised value in the evidence header; the verifier normalises with the same function
before re-simulating.

Use `SeededRng.float()` and nothing else — `range()`, `int()`, `chance()` and `pick()` are float paths
whose exact expression this document does not pin. Every STACKED draw is `Math.floor(rng.float() * n)`
for integer `n`. `SeededRng.snapshot()` returns `{ seed, count }`; both substreams' `count` values are
mirrored into sim state as `bagRngCount` / `garbageRngCount` every tick and recorded at run end as an
RNG-cursor cross-check.

Refill: once before the first spawn, then after every spawn,
`while (queue.length < NEXT_QUEUE_BUFFER) queue.push(...shuffleBag(bagRng))`. Traced: the initial
refill gives 7; each spawn pops one and the refill fires only at 6, taking it back to 13. Length
**after** every refill is in `7..13`, never below the 6 entries a Free-mode player may display; `6`
occurs only transiently inside the spawn step. Draw order is a pure function of tick history, so
`bagRefills` is exactly `2 + floor(pieces / 7)` and `bagDraws` exactly `6 × bagRefills` — both
cross-checked by the plausibility gate (`integrity.md`).

| Constant | Value | Note |
| --- | --- | --- |
| `NEXT_QUEUE_VISIBLE` | `5` | Ranked fixed at 5. Free Mode may show 1–6 (§12). |
| `NEXT_QUEUE_BUFFER` | `7` | Internal refill threshold, never player-visible. |

**Hold.** One swap per lock. `holdUsed` is set on swap and cleared on the next **lock**, not on spawn:
a hold swap itself spawns a piece, so clearing on spawn would clear the flag immediately and give an
unbounded hold loop. First hold: active piece goes to hold, next piece spawns. Later holds: swap; the
incoming piece spawns at its `SPAWN_ORIGIN` in state `0`, takes the same one free downward shift as a
normal spawn, and resets lock delay, `lockResetsUsed` and `lowestYReached`. A hold that would spawn
into occupied cells is a block-out (§7). A `hold` bit set while `holdUsed` is true is a no-op and does
**not** reset lock delay.

**Ghost.** Presentation only (§11): the active piece hard-dropped, recomputed every render frame from
the sim snapshot. Never in sim state, never in evidence, never in the hash. The hard-drop action does
**not** read the ghost — it recomputes the landing row inside `step()` from the board; the two reach
the same row by the same rule and do not share a value. Ghost rendering is **on in Ranked** — identical
for every player, so it is not an advantage (owner gate G-11; recommendation on, a one-line
presentation change either way).

---

## 5. Gravity, lock delay, drops

**Gravity** is an integer Q16.16 accumulator:

```js
// softDropHeld = bit 2 of this tick's mask (§6). G = STACKED_GRAVITY_Q16[gravityLevel].
gravityAccQ16 += (softDropHeld ? Math.min(G * SOFT_DROP_FACTOR, 20 * 65536) : G);
while (gravityAccQ16 >= 65536) {
  if (!canMoveDown()) { gravityAccQ16 = 0; break; }
  y -= 1; gravityAccQ16 -= 65536;
}
```

`gravityLevel = Math.min(level, GRAVITY_LEVEL_CAP)`, `GRAVITY_LEVEL_CAP = 15`. Gravity caps there
deliberately: past 2 cells/tick the game stops being about stacking, and the difficulty driver is the
rising ledger. Levels above 15 keep shortening lock delay and raising the score multiplier up to
`STACKED_LEVEL_CAP = 30`.

| gravityLevel | frames/cell | `G` (Q16.16) |
| --- | --- | --- |
| 1 | 60 | `1092` |
| 2 | 48 | `1365` |
| 3 | 37 | `1771` |
| 4 | 28 | `2341` |
| 5 | 21 | `3121` |
| 6 | 16 | `4096` |
| 7 | 12 | `5461` |
| 8 | 9 | `7282` |
| 9 | 7 | `9362` |
| 10 | 5 | `13107` |
| 11 | 4 | `16384` |
| 12 | 3 | `21845` |
| 13 | 2 | `32768` |
| 14 | 1 | `65536` |
| 15 | 0.5 (2 cells/tick) | `131072` |

Every entry is `round(65536 / framesPerCell)`; the rounded integers **are** the truth and must not be
re-derived at runtime, or a future engine's division reintroduces a float into the sim.

```js
export const STACKED_GRAVITY_Q16 = Object.freeze([
  1092, 1092, 1365, 1771, 2341, 3121, 4096, 5461,
  7282, 9362, 13107, 16384, 21845, 32768, 65536, 131072,
]);
```

Index `0` duplicates index `1` so the lookup is total. Ship a frozen plain array, **not** a frozen
`Int32Array`: `Object.freeze` throws `TypeError` on a typed array that has elements.

**Level.** `level = Math.min(STACKED_LEVEL_CAP, startLevel + Math.floor(linesCleared / 10))`, with
`startLevel = 1` in Ranked and `1..15` player-selectable in Free (§12). It must stay a **pure function
of lines**, or `integrity.md`'s `level-inconsistent-with-lines` flag has to be dropped rather than
fudged. Ranked reaches the cap at 290 lines.

**Lock delay**, keyed by `lockLevel = Math.min(level, LOCK_LEVEL_CAP)`, `LOCK_LEVEL_CAP = 20`:

| lockLevel | `LOCK_DELAY_TICKS` | `LOCK_RESET_CAP` |
| --- | --- | --- |
| 1–10 | 30 | 15 |
| 11–13 | 26 | 15 |
| 14–16 | 22 | 12 |
| 17–18 | 18 | 10 |
| 19 | 15 | 8 |
| 20+ | 12 | 6 |

The lock timer runs only while the piece cannot move down. Any successful move or rotation refills it
to `LOCK_DELAY_TICKS` and increments `lockResetsUsed`; once `lockResetsUsed >= LOCK_RESET_CAP` moves
and rotations still work but stop resetting the timer. `lockResetsUsed` returns to `0` (and the timer
refills) whenever the piece reaches a new lowest `y` (`y < lowestYReached`, which is then updated) —
the standard step-reset escape hatch. `lowestYReached` is initialised at spawn per §2.

`SPAWN_DELAY_TICKS = 0` and `LINE_CLEAR_DELAY_TICKS = 0`: zero delay is what competitive players
expect and it deletes a class of replay-boundary ambiguity. With §6's "a tick that locks ends there"
rule, the true placement floor is `STACKED_MIN_PLACEMENT_TICKS = 2` ticks per piece, from which
`STACKED_MAX_PIECES = 216_000` and `STACKED_MAX_LINES = 86_400` follow. Those bounds are looser than
the plausibility gate's author assumed, and deliberately so: a tighter bound would reject legal runs
(`STACKED-CONTRACTS.md` §5.3, owner gate).

**Soft drop.** `SOFT_DROP_FACTOR = 20`, a frozen sim constant in **both** modes, never a player
setting: it is read inside `step()`, so a per-player value would have to travel in the evidence header
and be applied by the verifier — deferred as a possible later cycle with that header requirement as
its precondition. Soft-dropping onto the stack does not lock instantly; it starts the normal lock
timer. It awards 1 point per cell actually moved **while bit 2 is set on that tick**, and
`softDropCells` counts only those cells, so the counter cannot be inflated by surviving at high
gravity.

**Hard drop.** Moves the piece down to the lowest collision-free position (computed inside `step()`)
and locks on the same tick, bypassing lock delay. Awards 2 points per cell moved.

---

## 6. The input mask as the simulation consumes it

**The sim's input is one `uint8` held-state mask per tick, and nothing else the player does reaches
the sim.** The mask recorded for tick `T` is exactly the mask handed to `step()` on tick `T`, so a
verifier feeding recorded bytes straight into `step()` needs no host adapter.

**Bit order — part of the codec version, never to be reordered:**

| Bit | Action | Trigger |
| --- | --- | --- |
| 0 | `moveLeft` | rising edge, detected inside the sim |
| 1 | `moveRight` | rising edge |
| 2 | `softDrop` | **level** — the only held bit; applies on every tick it is set |
| 3 | `hardDrop` | rising edge |
| 4 | `rotateCW` | rising edge |
| 5 | `rotateCCW` | rising edge |
| 6 | `rotate180` | rising edge |
| 7 | `hold` | rising edge |

All eight bits are allocated. A ninth sim action widens the record, invalidates every stored replay and
forces `stacked-bridge/v2`. **Pause is not an input bit**, and nothing presentational — camera, zoom,
mute, HUD toggle — is ever an input bit.

**Edge detection lives inside `step()`**, comparing against the previous tick's mask (`prevMask`, part
of sim state, initialised to `0`). This removes the catch-up multiplication trap by construction:
`DeterministicSimulation` (`apps/hmh-reboot/src/simulation.mjs`) hands the *same* frozen input to every
catch-up step of a frame, up to `MAX_CATCH_UP_STEPS = 4`; under a rising-edge test a bit set across
those four ticks fires **once**, so one hard-drop press can never lock four pieces on a stuttering
frame. No host-side edge clearing exists — a determinism invariant in the host can be wrong silently.

**DAS, ARR, DCD and every touch/gesture/gamepad threshold live in the input layer, outside the sim**,
expanding a held direction into discrete per-tick move bits *before* the mask is built, so handling
configuration can never change a replay: a Ranked run recorded on any DAS/ARR re-simulates identically
on a verifier running defaults. Auto-shift is expanded in ticks, evaluated once per fixed step, never
per rAF.

| Setting | Default | Range | Unit |
| --- | --- | --- | --- |
| `dasTicks` (delayed auto shift) | `8` (133 ms) | `4..18` (60–300 ms) | ticks before auto-repeat begins |
| `arrTicks` (auto repeat rate) | `2` (33 ms) | `1..6` (17–100 ms) | ticks between repeats |
| `dcdTicks` (DAS cut delay on direction change) | `0` | `0..8` | ticks |

Values are stored in ms for the UI and converted once at run start via
`clamp(round(ms / (1000/60)), lo, hi)`; the UI displays the snapped value, so the number the player
sees is the number the run uses. `dcdTicks` semantics, since "DAS cut delay" is named three
incompatible ways across the genre: on a held-direction *change* the controller sets the remaining
charge to `min(dasTicks, dcdTicks)`, so `0` is an immediate re-fire in the new direction. No
`arrTicks = 0` is offered — 1 tick is already the floor.

**Auto-shift stops at the wall.** Once the sim reports the piece cannot move further in the held
direction, expansion stops and re-arms on the next spawn, rotation, or direction change. Without it,
holding against a wall emits up to 60 dead edges per second — an evidence-size problem *and* a
plausibility-gate false positive.

| Constant | Value | Meaning |
| --- | --- | --- |
| `STACKED_ACTION_COUNT` | `8` | The bit order above. |
| `STACKED_MAX_MOVE_STEPS_PER_TICK` | `1` | **Structural.** A one-byte mask carries at most one move bit per tick, so one column per tick (60 cells/s) is the fastest the encoding can express. A full-row slide in one tick is not representable and is not offered; that is the price of the byte-per-tick evidence primitive, and it is the right price. |
| `STACKED_MOVE_QUEUE_MAX` | `9` | Input-layer queue depth: a fast drag banks up to 9 column steps and the classifier drains exactly one per tick, so crossing a 10-wide board costs ≤ 9 ticks (150 ms) instead of dropping input. Overflow is dropped and counted into `droppedInputs`. |
| `STACKED_INPUT_BUFFER_TICKS` | `4` | A tap shorter than one tick is held up to 4 ticks so it survives high-refresh frames (`ceil(refreshHz/60) - 1` zero-step frames: 1 at 120 Hz, 2 at 144 Hz, 4 at 300 Hz). |

**Simultaneous-bit precedence, pinned** (an implementer will otherwise invent one, and two inventions
desync):

1. `moveLeft` and `moveRight` both set: a 1-bit `lastHorizontal` latch, updated on each rising edge,
   wins. On release of one, the other takes over immediately with DAS charge reset to 0. Opposing bits
   do **not** cancel — cancelling drops the input entirely.
2. Multiple rotate bits rising on one tick: `rotateCCW` > `rotateCW` > `rotate180`. Exactly one
   rotation is attempted; the others do not re-fire until they fall and rise again.
3. `hold` and `hardDrop` rising on one tick: `hold` resolves first, `hardDrop` is ignored for that
   tick. A swapped-in piece is never instantly slammed.
4. `softDrop` and `hardDrop` on one tick: `hardDrop` wins.
5. `hold` while `holdUsed`: no-op, no lock-delay reset.

**Within-tick resolution order:**

```
hold -> rotate -> shift -> hardDrop -> gravity/softDrop -> lock timer -> lock
     -> line clears -> pending garbage -> spawn
```

A mask carrying both `hold` and a rotate applies the rotation to the *incoming* piece. **A tick that
locks ends there**: once a lock resolves (line clears, pending garbage, spawn), no further action bits
from that mask apply, and the newly spawned piece takes no gravity, shift or rotation until the next
tick. That rule is what makes `STACKED_MIN_PLACEMENT_TICKS = 2` (§5).

**Recording, chunking and verification are owned by `integrity.md`** — the `SIC1` transition codec, its
24-byte header, the recorder invariants, the `game:evidence-chunk` transport and the byte ceilings all
live there. Two consequences belong here because they bound sim constants:

- `STACKED_MAX_INPUT_TRANSITIONS = 432_000`, set **equal to** `STACKED_MAX_TICKS`. The recorder emits
  at most one record per tick, so a live run provably cannot reach it and it can only fire on a
  submitted blob during verification. It is the analogue of `CHIKUN_MAX_FLAP_TRANSITIONS = 4096`
  (`apps/portal/src/chikun-cabinet.mjs:7`) and, like it, throws when exceeded. Any smaller value is a
  live-run hazard, not a safety margin.
- `STACKED_MAX_EVIDENCE_BYTES = 1_302_000` is a terminal condition inside the sim
  (`terminalReason: 'evidence-ceiling'`) tracking **encoded** bytes. The worst legal encoding is
  3 bytes/tick and `1_302_000 / 432_000 = 3.014`, so the tick ceiling always fires first and this one
  is unreachable in legal play; it bounds the parent's reassembly buffer against a hostile client.

---

## 7. Spawn, top-out, pause and interruption

| Condition | Rule | `terminalReason` |
| --- | --- | --- |
| Block-out | The spawn cell set (before the free downward shift) intersects an occupied cell. | `block-out` |
| Lock-out | A piece locks with all four cells at `y >= BOARD_VISIBLE_ROWS` (20). | `lock-out` |
| Garbage-out | A pending push would move an occupied cell to `y >= BOARD_ROWS` (24), or an enqueue would take the pending queue above `GARBAGE_PENDING_MAX = 8`. | `garbage-out` |
| Tick ceiling | `tick >= STACKED_MAX_TICKS` (`432_000` = 2 h at 60 Hz). | `tick-ceiling` |
| Evidence ceiling | Encoded evidence bytes `>= STACKED_MAX_EVIDENCE_BYTES`. Unreachable in legal play (§6). | `evidence-ceiling` |

All five are integer comparisons evaluated **inside the sim**, and all five rank normally — a
validator-only cap silently loses a legitimate run instead of ending it cleanly, which is forbidden.
`STACKED_TERMINAL_REASONS` is the one enum; `'topped-out'`, `'time-cap'`, `'frame-cap'`, `'buried'`,
`'abandoned'` and `'runtime-error'` are not values of it.

On terminal the runtime freezes state and throws on any further `step()`, matching
`createChikunRuntime`, whose `step` throws `'Chikun runtime is already terminal'`
(`apps/portal/src/chikun-cabinet.mjs:261`).

Ranked constructs the runtime with `maxTicks: STACKED_MAX_TICKS`; the constructor takes `maxTicks` as
an argument (mirroring `createChikunRuntime({ seed, maxTicks })`, `chikun-cabinet.mjs:231`) so Free
Mode can shorten it for practice drills, and the evidence header records the value the run actually
used so a verifier cannot be handed a longer ceiling than the run was played under. The 2-hour ceiling
sits 3.6× above §10's god-tier prediction of ~33.4 min and above every dial's effect on it.

**Pause** is a host-layer state, not a sim state. While paused the host runs no fixed steps, so `tick`
does not advance and every tick-derived timer — gravity accumulator, lock delay, garbage timer,
`reorgCost` — freezes with it; pause is not exploitable for survival. The host must call
`DeterministicSimulation.pause()` / `.resume()` (both reset the frame accumulator) so resuming cannot
deliver a catch-up burst, and must force a pause on `visibilitychange` to hidden and on window blur.
**Guard those calls against re-entry**: `pause()` throws `Cannot pause simulation from ${state}`
(`apps/hmh-reboot/src/simulation.mjs:104`) for any state that is not `active` or `upgrade`, and
`visibilitychange` and `blur` routinely fire together — so test `sim.state === 'active'` before pausing
and `sim.state === 'paused'` before resuming. (`update()` while paused is safe: it resets the
accumulator and returns zero steps.) No mask is recorded for a paused frame, and the recorder writes a
mask-`0` record at the current tick before the loop stops, so a key held across a pause does not keep
charging DAS on resume. `runStats` records `pauseCount` and `pausedWallClockMs`; `integrity.md` owns
what is done with them.

**Interruption.** A bridge disconnect, a runtime error, or a host teardown ends the run without a
`terminalReason` from the table above; the run is abandoned, not scored, and no Ranked write occurs.
That is distinct from a top-out and must not be mapped onto one — an abandoned run submits nothing, so
`'abandoned'` can never appear in a result tuple.

**Resize and quality changes mid-run.** The sim has no viewport, no aspect ratio and no quality tier,
so a resize, orientation change, DPR change or quality-tier switch cannot alter it; they relayout the
renderer and the touch-control geometry only (`visuals.md`, `mobile.md`). A zone/EPOCH transition is
likewise pure presentation — 150 ticks of cross-fade, nothing paused, nothing modal over the well — and
a top-out during one changes nothing about the transition or the result.

---

## 8. Line clears and the rising ledger

**Detection.** After a lock, scan `y = 0..23`; a row is full when all ten cells are non-zero. Collect
the full row indices, then compact: copy every non-full row downward preserving order and zero-fill the
top. **Naive gravity — no cascade, no sticky, no connected-component fall**, because cascade gravity
makes spin scoring and combo attribution ambiguous. A garbage push cannot create a full row — it only
translates existing rows and writes one row that has a hole by construction — so the scan runs on lock
only.

**The rising ledger.** Thematically a chain **REORG**: an attacker rewrites rows underneath you.

| Constant | Value | Meaning |
| --- | --- | --- |
| `GARBAGE_START_TICK` | `3_600` | 60 s of clean board before the first REORG. |
| `GARBAGE_INTERVAL_START_TICKS` | `720` | 12 s between REORGs at the start. |
| `GARBAGE_INTERVAL_STEP_TICKS` | `30` | 0.5 s removed per step. |
| `GARBAGE_INTERVAL_STEP_PERIOD_TICKS` | `2_700` | One step every 45 s. |
| `GARBAGE_INTERVAL_FLOOR_TICKS` | `120` | 2 s, reached after 20 steps at tick 57,600 (16 min). |
| `GARBAGE_ROWS_PER_INJECTION` | `1` | Always one row; the interval carries the whole curve. |
| `GARBAGE_PENDING_MAX` | `8` | More than 8 queued REORGs is a garbage-out. |
| `GARBAGE_HOLE_REPEAT_NUM` / `_DEN` | `3` / `5` | 60% chance the hole repeats the previous column. |

```js
export function garbageIntervalTicks(tick) {
  if (tick < GARBAGE_START_TICK) return Number.POSITIVE_INFINITY;
  const steps = Math.floor((tick - GARBAGE_START_TICK) / GARBAGE_INTERVAL_STEP_PERIOD_TICKS);
  return Math.max(
    GARBAGE_INTERVAL_FLOOR_TICKS,
    GARBAGE_INTERVAL_START_TICKS - GARBAGE_INTERVAL_STEP_TICKS * steps,
  );
}
```

The sentinel is never stored: `garbageTimerTicks` is armed to `GARBAGE_INTERVAL_START_TICKS` exactly
once, on the first tick where `tick >= GARBAGE_START_TICK`, and is reloaded from
`garbageIntervalTicks(tick)` thereafter, so no non-integer enters sim state.

Derived schedule, for review: 12.0 s at t = 60 s, 10.0 s from t = 4.0 min, 8.0 s from t = 7.0 min,
6.0 s from t = 10.0 min, 4.0 s from t = 13.0 min, 3.0 s from t = 14.5 min, floor 2.0 s from t = 16 min.
In injections/min: `5.0, 6.0, 7.5, 10.0, 15.0, 20.0, 30.0`. (Each step lasts 45 s, so
`interval = 12 - 0.5 * floor((t_seconds - 60) / 45)` seconds, floored at 2.)

Because the interval is a curve, no flat `GARBAGE_RISE_INTERVAL_*` constant exists. The plausibility
gate bounds garbage with `GARBAGE_INTERVAL_FLOOR_TICKS` — the curve's minimum, the only value sound at
every point on it (`integrity.md`).

**Hole placement** uses the `garbage` substream and only that substream:

```js
export function nextGarbageHole(rng, prevHole) {
  const roll = Math.floor(rng.float() * GARBAGE_HOLE_REPEAT_DEN); // draw 1 -> 0..4
  if (prevHole >= 0 && roll < GARBAGE_HOLE_REPEAT_NUM) return prevHole;
  return Math.floor(rng.float() * 10);                            // draw 2 -> 0..9
}
```

`lastGarbageHole` starts at `-1`, so the first injection always consumes both draws. The 60% repeat
makes a stack of reorg rows clearable with one well-placed piece, so digging is skilful rather than
random. The draw count per injection varies (1 or 2); that is safe because nothing else reads this
substream, and `garbageRngCount` pins the cursor either way.

**One draw sequence per garbage *group*, not per row.** Consecutive rows in a group share a hole
column, so `garbageGroups` is counted and recorded and never inferred from `garbageRowsReceived`. With
`GARBAGE_ROWS_PER_INJECTION = 1` a group is one row in Phase 1; the distinction is kept because the
two-player attack feed (`versus.md`) sends multi-row groups.

**When the push happens.** The garbage timer decrements every tick; at zero it enqueues one pending
injection and reloads from `garbageIntervalTicks(tick)`. Pending injections are applied **only at a
lock boundary**, after that lock's line clears resolve and before the next spawn — never mid-piece,
because displacing the active piece into a collision is the worst source of "unfair" top-outs. A push
shifts every row up by one (`y -> y + 1`; the discarded top row `y = 23` must be empty or it is a
garbage-out) and writes row 0 as nine cells of value `8` plus one hole.

**The whole pending queue drains at that boundary**, one row at a time in queue order until empty —
not one row per lock. §10's model assumes this (garbage arrives at the full injection rate `inj`, not
throttled to the player's lock rate); one-row-per-lock would silently cap arrival at `piecesPerMinute`
and change every predicted top-out. A burst of two or three rows can therefore arrive on a single lock
after a long piece, which is intended.

`GARBAGE_PENDING_MAX = 8` is consequently a **safety net, not a live mechanism**: with the queue fully
draining at every lock, and lock delay plus `LOCK_RESET_CAP` (§5) making indefinite hovering impossible
on a 24-row board, ordinary play never accumulates more than the injections landing between two
consecutive locks — under one at the 2 s floor and expert pace (90 pieces/min). It trips at 9 pending,
which at the 2 s floor is 18 s of no locks and at the opening 12 s interval is 108 s.

### 8.1 HASHPOWER — the defence economy

The player can stop the ledger temporarily, never permanently. Multi-line clears mint **HASHPOWER**;
spending it rejects a REORG. The attacker's cost rises with time.

| Constant | Value |
| --- | --- |
| `HASHPOWER_PER_CLEAR` | `{ 0: 0, 1: 0, 2: 1, 3: 2, 4: 4 }` (lines cleared -> hashpower) |
| Spin bonus | `+1` when the clear was a spin clear |
| Chain bonus | `+1` when back-to-back was live **going into** the clear |
| `HASHPOWER_MAX` | `8` |
| `REORG_COST_PERIOD_TICKS` | `10_800` (3 min) |
| `REORG_COST_MAX` | `12` |

```js
export function reorgCost(tick) {
  return Math.min(REORG_COST_MAX, 1 + Math.floor(tick / REORG_COST_PERIOD_TICKS));
}
```

Cost is 1 from tick 0 and reaches the cap of 12 at tick 118,800 = 33 min. But the cap is not where
defence ends — see the wall below.

**The `HASHPOWER_MAX = 8` / `REORG_COST_MAX = 12` split is deliberate, and it puts a hard wall at
tick 86,400 (24:00).** `reorgCost` reaches `9` at tick 86,400, and `hashpower` is clamped to `8` on
mint, so from 24 minutes onward `hashpower >= reorgCost(tick)` is **unsatisfiable at every skill
level** and every REORG lands. Costs 9, 10, 11 and 12 are therefore inert as prices; they exist only so
the formula stays total past the wall. Nothing in the sim needs a special case — the comparison simply
never succeeds — but any *model*, gate bound or balance argument that assumes partial rejection past
24:00 is wrong. §10 carries the `g = inj` branch for `reorgCost(tick) > HASHPOWER_MAX` for exactly this
reason. Whether the wall belongs at 24:00, or `HASHPOWER_MAX` should rise to 12 so the ladder stays
live to 33 minutes, or `REORG_COST_MAX` should drop to 8 so the formula stops where the economy does,
is an open owner question (`STACKED-MASTER-PLAN.md` §7 question 9). It is not blocking: the shipped
constants are these, and §10's predictions pass every band against them.

**Hashpower is minted only by a lock that clears at least one line.** A spin that clears nothing scores
its FORK points (§9) but mints nothing, and neither the spin nor the chain bonus fires. This closes a
farm the bare formula would open: a `T` spin costs 0.4 rows of stack and, if a 0-line spin minted `+1`,
would buy defence more cheaply than any actual line clear at every tier below elite. The `0: 0` key
exists anyway so the lookup is total and a 0-line lock cannot evaluate to `undefined` and poison
`hashpower` with `NaN`.

At a pending push: if `hashpower >= reorgCost(tick)`, subtract the cost, discard the injection, and
award `250 * level` points. Otherwise the row goes in. Each pending row is tested independently, in
queue order, against the hashpower remaining at that moment — so a three-row burst against a store of 5
at cost 2 rejects two rows and takes the third. `hashpower` is clamped to `HASHPOWER_MAX = 8` on mint,
so surplus income is discarded, which only bites while the player is already outrunning the attacker.

**A single line clear mints zero hashpower.** That one rule is the sharpest difficulty separator in the
design: beginners clear almost nothing but singles and never defend; experts live on doubles, spins and
HALVINGs and defend for most of the run; **nobody defends past 24 minutes**, because `reorgCost`
exceeds `HASHPOWER_MAX` there while the reorg rate is pinned at 30/min from 16 minutes. From 24:00 the
board is a pure endurance problem: every row lands, and the only question is how fast the player can
clear what arrives.

---

## 9. Scoring

| Lines / event | Display name | Base points |
| --- | --- | --- |
| 1 | **CONFIRM** | `100` |
| 2 | **BATCH** | `300` |
| 3 | **MERKLE** | `500` |
| 4 | **HALVING** | `800` |
| mini spin, 0 lines | **MINI FORK** | `100` |
| mini spin, 1 line | **MINI FORK CONFIRM** | `200` |
| mini spin, 2 lines | **MINI FORK BATCH** | `400` |
| full spin, 0 lines | **FORK** | `400` |
| full spin, 1 line | **FORK CONFIRM** | `800` |
| full spin, 2 lines | **FORK BATCH** | `1200` |
| full spin, 3 lines | **FORK MERKLE** | `1600` |
| perfect clear + 1 | **GENESIS CONFIRM** | `800` (in addition to the clear) |
| perfect clear + 2 | **GENESIS BATCH** | `1200` |
| perfect clear + 3 | **GENESIS MERKLE** | `1800` |
| perfect clear + 4 | **GENESIS HALVING** | `2000`, or `3200` if back-to-back |

Two lookup rules the table does not encode:

- **A spin row replaces the plain clear row; they are never summed.** A full-spin double scores 1200,
  not 1200 + 300.
- **A four-line clear always scores HALVING (`800`), spin or not.** Only `I` can clear four rows and
  there is no `FORK HALVING`; a spin flag on such a clear still counts toward the spin stat, still
  mints the `+1` spin hashpower, and still keeps `chainActive` alive, but it does not change the base
  value. A mini spin clearing 3 lines falls back to `MERKLE` (`500`), because no mini row is defined
  for three.

Display names: back-to-back is **CHAIN** (HUD `CHAIN xN`), the combo streak is **MEMPOOL** (HUD
`MEMPOOL xN`), a garbage injection is a **REORG**, defence currency is **HASHPOWER**, zones advance on
**EPOCH** milestones. The four-line clear's identifier root is `quad` everywhere (`quadClears`,
`clearType: 'quad'`, `stacked-first-quad`), independent of the display name.

**Application order, all integer arithmetic.** `level` and `chainActive` are read at their **pre-clear**
values for the whole block — the clear that raises `linesCleared` past a multiple of ten does not
multiply itself by the new level — and are updated only after it. `comboCount` is incremented **before**
the MEMPOOL line and the post-increment value scores: it is initialised to `-1`, so a pre-increment
read would score `50 * -1 * level` and *subtract* points on the first clear of every streak.

```js
base   = tableLookup(lines, spinKind);          // level and chainActive are pre-clear values
scaled = base * level;
if (chainActive && (lines === 4 || isSpinClear)) scaled = Math.floor(scaled * 3 / 2);  // CHAIN x1.5
score += scaled;
if (boardIsEmptyAfterClear) {                   // GENESIS
  const pcBonus = (lines === 4 && chainActive) ? 3200 : PERFECT_CLEAR_BONUS[lines]; // 800/1200/1800/2000
  score += pcBonus * level;
}
comboCount += 1;                                // MEMPOOL: increment first, then score it
score += 50 * Math.min(comboCount, STACKED_COMBO_BONUS_CAP) * level;
maxCombo = Math.max(maxCombo, comboCount);
score += softDropCells * 1;                     // not level-scaled
score += hardDropCells * 2;                     // not level-scaled
score += 250 * level;                           // per REORG rejected with HASHPOWER
if (tick % 60 === 0) score += 10 * level;       // survival trickle, one award per whole second
```

`PERFECT_CLEAR_BONUS = Object.freeze({ 1: 800, 2: 1200, 3: 1800, 4: 2000 })`; the `3200` back-to-back
variant is the branch above and not a fifth table row, because it is the only entry depending on run
state rather than on the clear alone. `Math.floor(scaled * 3 / 2)` is used rather than `* 1.5` so the
multiply stays integral and the halving is a single deterministic floor.

`STACKED_COMBO_BONUS_CAP = 20` caps the MEMPOOL term. Uncapped, that term is `O(clears²)`: at a
degenerate 1,712 **single-line** clears — the largest clear count 1,712 lines permits — and level 30 it
alone pays `750 × 1712 × 1713 ≈ 2.2 billion` points, and the `score-implausible` check becomes
worthless. (1,712 is the *lines* figure from §4.3's shape example, whose implied clear count is ~537 and
whose uncapped combo term would be two orders smaller; the 2.2-billion figure is the degenerate bound,
not that example's.)

**There is no score clamp inside `step()`.** `STACKED_MAX_SCORE = 1_000_000_000_000` is a validator
bound in `sdk/stacked-run-summary-schema.mjs`, not a sim clamp: a clamp silently stops an elite
player's score from moving, and a schema-legal run exceeds any 9-digit clamp at the level cap.

Then, in this order: on a lock that cleared at least one line (§8.1),
`hashpower = Math.min(HASHPOWER_MAX, hashpower + HASHPOWER_PER_CLEAR[lines] + (isSpinClear ? 1 : 0) + (chainActive ? 1 : 0))`
using the pre-clear `chainActive`; then `linesCleared += lines` and `level` is recomputed per §5; then
`chainActive` is set true by any HALVING or spin-with-lines, set false by any non-spin clear of 1–3
lines, and left untouched by a lock that clears nothing. `comboCount` resets to `-1` on any lock that
clears nothing.

`tick` is incremented before the step body (matching `DeterministicSimulation`), so the survival
trickle first pays at `tick = 60`.

**Range check and integer width.** With `STACKED_LEVEL_CAP = 30` the largest single term is the GENESIS
HALVING chain bonus, `3200 * 30 = 96_000`; the largest per-clear total is under 200,000 (72,000 chained
base + 96,000 perfect clear + 30,000 capped combo). At the schema ceiling of 86,400 lines that is under
`1e10` — two orders under `STACKED_MAX_SCORE`, far under `Number.MAX_SAFE_INTEGER` (`9.007e15`), and
**above** `2^31 - 1`. So `score` is always an exact integer but must never be forced through a 32-bit
path: no `| 0`, no `>>> 0`, no `Int32Array`. Every other sim integer (board bytes, tick, lines,
`gravityAccQ16`, counters) stays in int32. A realistic god-tier run at §10's 33.4-minute prediction
lands near `5–6 × 10^7`. That is deliberately **not** the `score: 9864300` in the result-tuple example
at `STACKED-CONTRACTS.md` §4.3 / `integrity.md` §4.2: that tuple is a schema-*shape* illustration —
internally consistent field types, magnitudes and cross-field identities for a validator author — and
is explicitly not tuned balance. This section is the authority on score magnitude; nothing may be
tuned against that tuple.

**Design consequence of the level cap, for the owner before ship:** above level 30 the per-clear
multiplier stops growing, so score grows linearly with survival time and **the leaderboard ranks
endurance with score as a skill weighting** — a 35-minute competent run will generally outscore a
12-minute brilliant one. If that is unwanted the fix is a secondary sort or a separate board, not an
uncapped multiplier (`STACKED-CONTRACTS.md` §5.4, owner gate G-4).

---

## 10. Difficulty validation against the owner's session bands

The tuning constants in §5 and §8 are shipped. The parameters below are **descriptive model
parameters, not shipped values**: they describe how a player at each tier behaves, and exist only so
the shipped constants can be checked against the target bands. Changing them changes the prediction,
never the game.

Model, in rows of stack height per minute:

```
M0     = 0.4 * P                                  own material placed (4 cells = 0.4 rows)
A_eff  = A * (0.35 + 0.65 * min(1, (20 - H) / 6)) attainment, degraded by stack pressure
mat    = M0 + g                                   total material arriving
L      = A_eff * mat                              lines cleared per minute
credits/min = L * cpl                             hashpower minted per minute
g      = inj                                      if cost > HASHPOWER_MAX  (no defence possible)
       = max(0, (inj - A_eff * M0 * cpl / cost) / (1 + A_eff * cpl / cost))   otherwise
dH/dt  = mat - L = (1 - A_eff) * mat
top-out when H reaches 20
```

`g` is the fixed point of `g = inj - A_eff * (M0 + g) * cpl / cost`: garbage arriving minus garbage
rejected, with rejections fed by the lines cleared out of the garbage. Stack pressure begins at
`H = 14` and floors attainment at 35% of nominal.

**`HASHPOWER_MAX = 8` enters the model in exactly one place, and it is decisive.** While
`cost <= HASHPOWER_MAX` the cap only discards surplus — whenever `credits/min < cost * inj` the store
is fully drained and the cap does not bind, and whenever it does bind the player is already rejecting
everything — so the fixed-point branch is correct there and the cap can be left out of it. Once
`cost > HASHPOWER_MAX`, which happens at **tick 86,400 = 24:00** (§8.1), the player can never bank the
price of a single rejection, so `g = inj` flat: every REORG lands. Only god tier survives past 24
minutes, so this branch is exercised by the god integration alone; an earlier version of this section
omitted it and modelled god as still partially rejecting at costs 9 through 12, which is not a state
the shipped constants can reach.

`cpl` (hashpower per line) is **derived**, not chosen: it falls out of the clear-type mix multiplied
through `HASHPOWER_PER_CLEAR` plus the spin bonus. The "+N% spins" column counts spin **clears** as a
share of all clears — exactly the population §8.1 mints for — so the rule that a 0-line spin mints
nothing leaves every number unchanged. The rates assume §3.1's `T` corner rule; under 4-way immobility
for `T`, expert's 10% / elite's 25% / god's 35% would be unattainable.

| Tier | `P` pieces/min | `A` attainment | clear mix (S / D / T / Q) | lines per clear | hashpower per clear | `cpl` |
| --- | --- | --- | --- | --- | --- | --- |
| Beginner | 25 | 0.45 | 90 / 9 / 1 / 0 | 1.11 | 0.11 | 0.099 |
| Intermediate | 55 | 0.86 | 60 / 25 / 10 / 5 | 1.60 | 0.65 | 0.406 |
| Expert | 90 | 0.955 | 30 / 30 / 20 / 20 (+10% spins) | 2.30 | 1.60 | 0.696 |
| Elite | 130 | 0.987 | 15 / 25 / 20 / 40 (+25% spins) | 2.85 | 2.50 | 0.877 |
| God | 180 | 0.995 | 8 / 20 / 17 / 55 (+35% spins) | 3.19 | 3.09 | 0.969 |

**The model omits the CHAIN (+1 back-to-back) hashpower bonus**, so every predicted top-out is a lower
bound on that axis — but only while defence is still possible. Re-running elite and god at a plausible
85% back-to-back rate raises `cpl` to `(2.50 + 0.85) / 2.85 = 1.175` and `(3.09 + 0.85) / 3.19 = 1.235`.
Elite's rejection capacity at `cost = 4` then goes from 11.25 to 15.1 injections/min, so `g` stays at
zero until ~13.75 min rather than 11.5 min; at `t = 20` min elite's `mat` falls only from 72.98 to
70.35 (`dH/dt` 0.949 -> 0.914, under 4%). **Elite gains ≈ +0.5 to +1.0 min** and stays in band. God
gains far less than it looks: past the 24:00 wall `g = inj` regardless of `cpl`, so the bonus only
buys a slightly slower climb over t 18–24 (`dH/dt` 0.448/0.455 -> 0.434/0.442, `H(24)` 9.41 -> 9.33),
worth **≈ +0.2 min**. Both stay in band.

Worked integration (0.5–1.0 min steps; only steps where something changes are shown), **forward Euler
with a mid-interval `A_eff`**: once the pressure term engages, `A_eff` is evaluated near the middle of
the step rather than at its start, and the *same* value is used for both the rejection-capacity term
and the `dH/dt` term within a step. That is what the arithmetic below actually does. It carries no
directional-bias guarantee — a mid-interval value trades the interval-start method's late bias for a
smaller two-sided error — so read every prediction as approximate to a few tenths of a minute, which is
far inside every band's width. Fixed-step Euler is kept so the arithmetic stays hand-checkable.

**Beginner** — `M0 = 10`, `cpl = 0.099`.
- t 0–1, no garbage: `dH/dt = 0.55 * 10 = 5.5`. `H(1) = 5.5`.
- t 1–2, `inj ≈ 5.1`, `cost = 1`: `g = (5.1 - 0.45*10*0.099) / (1 + 0.45*0.099) = 4.654 / 1.0446 = 4.46`. `mat = 14.46`, `dH/dt = 7.95`. `H(2) = 13.45`.
- `H` hits 14 at t = 2.07; `A_eff` starts degrading.
- t 2.07–2.5, `A_eff ~ 0.40`: `g = 4.64`, `mat = 14.64`, `dH/dt = 8.76`. `H(2.5) = 17.77`.
- t 2.5+, `A_eff ~ 0.23`, `dH/dt = 11.3`: remaining 2.23 rows in 0.20 min.
- **Top-out 2.70 min. Target 2–3 min. Pass.**

**Intermediate** — `M0 = 22`, `cpl = 0.406`.
- t 0–1: `dH/dt = 0.14 * 22 = 3.08`. `H(1) = 3.08`.
- t 1–3, `cost = 1`, credits `= 0.86*22*0.406 = 7.68/min` vs `inj ~ 5.2` -> `g = 0`. `dH/dt = 3.08`. `H(3) = 9.24`.
- t 3–4, `cost = 2`, capacity `3.84` vs `inj ~ 5.5`: `g = 1.37`, `mat = 23.37`, `dH/dt = 3.27`. `H(4) = 12.51`.
- t 4–4.5, `inj = 6.0`: `g = 1.84`, `dH/dt = 3.34`. `H(4.5) = 14.18` — pressure begins.
- t 4.5–5, `A_eff = 0.843`: `g = 1.91`, `dH/dt = 3.75`. `H(5) = 16.06`.
- t 5–5.5, `A_eff = 0.668`, `inj = 6.32`: `g = 2.94`, `mat = 24.94`, `dH/dt = 8.28`. `H` crosses 20 at 5.47.
- **Top-out 5.47 min. Target 4–6 min. Pass.**

**Expert** — `M0 = 36`, `cpl = 0.696`, credits `= 0.955*36*0.696 = 23.93/min`.
- t 0–8.6, `cost <= 3` so capacity `>= 7.98` vs `inj <= 8.0`: `g ~ 0`. `dH/dt = 0.045*36 = 1.62`. `H(8.64) = 14.0`.
- t 8.64–9, `A_eff = 0.924`: `dH/dt = 2.74`. `H(9) = 14.99`.
- t 9–9.5, `cost = 4`, `A_eff = 0.800` for **both** terms: capacity `0.800*36*0.696/4 = 5.01` vs `inj 8.57` -> `g = 3.12`, `mat = 39.12`, `dH/dt = 0.200 * 39.12 = 7.82`. `H(9.5) = 18.90`.
- t 9.5+, `A_eff ~ 0.40`, `mat ~ 41.8`, `dH/dt = 25.1`: remaining 1.10 rows in 0.04 min.
- **Top-out 9.54 min. Target 6–12 min. Pass.**

**Elite** — `M0 = 52`, `cpl = 0.877`, credits `= 0.987*52*0.877 = 45.0/min`.
- t 0–11.5, capacity `>= 11.25` vs `inj <= 10.9`: `g ~ 0`, `dH/dt = 0.013*52 = 0.676`. `H(11.5) = 7.77`.
- t 11.5–13, `cost = 5` from t = 12, capacity `9.0`, `inj 12`: `g = 2.56`, `mat = 54.6`, `dH/dt = 0.709`. `H(13) = 8.82`.
- t 13–14, `inj 15`: `g = 5.12`, `dH/dt = 0.742`. `H(14) = 9.56`.
- t 14–15, `inj 17.1 -> 20`: `g = 6.94`, `dH/dt = 0.766`. `H(15) = 10.33`.
- t 15–16, `cost = 6`, capacity `7.5`, `inj 20` flat (the 3 s interval holds from 14.5 to 16 min): `g = 10.92`, `mat = 62.9`, `dH/dt = 0.818`. `H(16) = 11.15`.
- t 16–18, `inj 30` (floor): `g = 19.66`, `mat = 71.7`, `dH/dt = 0.932`. `H(18) = 13.01`.
- t 18–19, `cost = 7`, capacity `6.43`: `g = 20.97`, `dH/dt = 0.949`. `H(19) = 13.96`.
- t 19–20, pressure begins, `A_eff = 0.955`: `g = 21.24`, `mat = 73.2`, `dH/dt = 3.30`. `H(20) = 17.26`.
- t 20+, `A_eff = 0.506`, `g = 25.1`, `mat = 77.1`, `dH/dt = 38.1`: remaining 2.74 rows in 0.07 min.
- **Top-out 20.07 min. Target 12–30 min. Pass.**

**God** — `M0 = 72`, `cpl = 0.969`, credits `= 0.995*72*0.969 = 69.4/min`.
- t 0–12.9, capacity `>= 13.88` vs `inj <= 13.3`: `g ~ 0`, `dH/dt = 0.005*72 = 0.36`. `H(12.9) = 4.64`.
- t 13–15, `cost = 5`, `inj 15 -> 17.1`: `g = 0.94 -> 2.73`, `dH/dt ~ 0.37`. `H(15) = 5.42`.
- t 15–18, `cost = 6`, capacity `11.57`, `inj 20 -> 30`: `g = 7.26 -> 15.88`, `mat -> 87.9`, `dH/dt ~ 0.44`. `H(18) = 6.70`.
- t 18–21, `cost = 7`, `inj` pinned at 30: capacity `69.4/7 = 9.91`, `g = (30 − 9.91)/1.1377 = 17.65`, `mat = 89.65`, `dH/dt = 0.448`. `H(21) = 8.04`.
- t 21–24, `cost = 8` — the **last affordable price**, since `HASHPOWER_MAX = 8`: capacity `69.4/8 = 8.68`, `g = (30 − 8.68)/1.1205 = 19.03`, `mat = 91.03`, `dH/dt = 0.455`. `H(24) = 9.41`.
- **t 24 onward, `cost = 9 > HASHPOWER_MAX`: the wall (§8.1). `g = inj = 30` flat**, `mat = 102`, `dH/dt = 0.005 * 102 = 0.51`. No further `cost` step changes anything — 10, 11 and 12 are equally unaffordable. `H` climbs the remaining `14 − 9.41 = 4.59` rows in `4.59 / 0.51 = 9.00` min, reaching 14 at **t = 33.0**.
- t 33.0+, pressure at fixed `mat = 102`: `A_eff = 0.995 * (0.35 + 0.65 * (20 − H)/6)`, so `dH/dt = 66.47 − 10.995 * (20 − H)` — `0.50` at `H = 14`, `66.5` at `H = 20`. `∫ dH / (dH/dt)` over 14 -> 20 is `ln(66.47 / 0.50) / 10.995 = 0.44` min, almost all of it in the slow 14 -> 14.5 stretch.
- **Top-out 33.4 min. Target 30–40 min. Pass.**

| Tier | Predicted | Target | Verdict |
| --- | --- | --- | --- |
| Beginner | 2.70 min | 2–3 | pass |
| Intermediate | 5.47 min | 4–6 | pass |
| Expert | 9.54 min | 6–12 | pass |
| Elite | 20.07 min | 12–30 | pass |
| God | 33.4 min | 30–40 | pass |

Every prediction sits far below `STACKED_MAX_TICKS = 432_000` (120 min), which is the point of a 2-hour
ceiling: it can never truncate a legal run.

Three design facts the arithmetic exposes and the implementer should not "fix": beginners and
intermediates die almost entirely to their own stack; the reorg only becomes the killer from expert
upward; and **only god tier ever plays past the 24:00 defence wall**, where `g = inj` and the run
becomes a pure clear-rate race. All three are intended. The first also means beginner and intermediate
durations are set overwhelmingly by `A` and `P`, which are player properties, not by anything
shippable. The third means the last nine minutes of a god run are the flattest stretch in the game —
`dH/dt` is constant at 0.51 — which is a feel consequence worth seeing (`STACKED-MASTER-PLAN.md` §7
question 9), not a bug in the model.

**Tuning dials, in leverage order.** If playtesting disagrees, change these and only these, then
regenerate the model artifact. Every magnitude is computed from the model, not estimated:

1. `GARBAGE_INTERVAL_FLOOR_TICKS` (`120`). Terminal pressure, the only dial that reaches god tier, and
   past the 24:00 wall the **only** one that does — with `g = inj` flat, god's terminal `mat` is
   `M0 + inj` and nothing else. Raising to `180` (3 s, 20 injections/min) drops god's terminal `mat`
   from 102 to 92 rows/min, so `dH/dt` falls from 0.51 to 0.46, stretching the 9.41 -> 14 climb from
   9.0 to 10.0 min: **god +1 min, elite +1 min, expert under +0.5 min, beginner and intermediate
   untouched** (their `g` is already tiny, or the run ends before the floor).
2. `REORG_COST_PERIOD_TICKS` (`10_800`), `REORG_COST_MAX` (`12`) and `HASHPOWER_MAX` (`8`). How fast
   defence gets expensive, and when it becomes impossible. Primary elite/god separator, and the only
   dials that move *when* `g` turns positive rather than how big it gets. `REORG_COST_PERIOD_TICKS`
   also sets the 24:00 wall (§8.1): the wall is `HASHPOWER_MAX * REORG_COST_PERIOD_TICKS`, so raising
   the period to `14_400` (4 min) moves it to 32:00 and adds roughly 2 min to god alone. `REORG_COST_MAX`
   above `HASHPOWER_MAX` changes nothing at all — costs past 8 are already unaffordable.
3. `GARBAGE_START_TICK` (`3_600`) and `GARBAGE_INTERVAL_START_TICKS` (`720`). Beginner only in
   practice: beginner's `g = 4.46` is 31% of its total material; intermediate's `g` is 0 until t = 3
   and ~1.4–2.9 out of ~24 afterwards, so the same change barely registers.
4. `HASHPOWER_PER_CLEAR[1] = 0` — a **beginner** dial. Setting it to `1` raises beginner `cpl` from
   0.099 to 0.910, cutting `g` from 4.46 to 0.71 and `dH/dt` from 7.95 to 5.89: beginner reaches
   `H = 14` at 2.44 min and tops out at ~3.2 min, *out* of its 2–3 min band. Intermediate moves from
   5.47 to ~5.3 min (`cpl` 0.781, `g` zero throughout, `H = 14` at 4.55 min, 0.79 min of pressure
   phase) — slightly *worse*, because with `g` at zero it is purely stack-limited at
   `dH/dt = (1 - A) * M0 = 3.08`.
5. Gravity table and `GRAVITY_LEVEL_CAP`. These barely appear because the model takes `P` as an input
   and hard drop makes gravity almost irrelevant to a competent player. Feel dials, not difficulty
   dials.

The model's own fit parameters — pressure-start row `14`, attainment floor `0.35`, and the per-tier
`P` / `A` / clear-mix table — are **not** dials. Adjust them only to re-fit the model to observed
playtest telemetry; adjusting them to make a band pass is fitting the ruler to the plank.

Ship the model as `scripts/write-stacked-difficulty-model.mjs` emitting
`docs/stacked/difficulty-model.json`, with `tests/stacked-difficulty-model.test.mjs` asserting the
committed file is byte-identical to a fresh derivation and that every tier's predicted top-out sits
inside its target band. This mirrors the existing `scripts/write-hmh-integrity-bounds.mjs` /
`docs/security/hmh-integrity-bounds.json` / `tests/hmh-integrity-bounds.test.mjs` triple. Copy its
shape exactly: the script exports a pure `buildStackedDifficultyModel()` and writes
`${JSON.stringify(build(), null, 2)}\n`, and the test asserts string equality against the committed
file. `npm test` globs `tests/*.test.mjs`, so the test needs no `package.json` change; both new `.mjs`
files must still be appended to `NODE_CHECK_FILES` in `scripts/syntax-check.mjs`, which is
hand-maintained and un-globbed.

---

## 11. Timestep, integer discipline, and the sim/presentation boundary

**Timestep.** The host loop imports `DeterministicSimulation`, `FIXED_STEP_MS`, `MAX_CATCH_UP_STEPS`
and `DEFAULT_MAX_FRAME_DELTA_MS` from `apps/hmh-reboot/src/simulation.mjs` rather than hand-rolling a
third accumulator (Chikun hand-rolled the second). That module provides `FIXED_STEP_MS = 1000 / 60`,
`MAX_CATCH_UP_STEPS = 4`, `DEFAULT_MAX_FRAME_DELTA_MS = 100`, the epsilon snap
(`if (Math.abs(this.accumulatorMs) < FLOAT_EPSILON) this.accumulatorMs = 0`, `FLOAT_EPSILON = 1e-9`),
`freezeClone` input validation (throws on non-finite numbers and on anything that is not a plain
object, array, boolean, string or number), the `start()` / `pause()` / `resume()` / `gameOver()` /
`exit()` state machine, `interpolationAlpha`, and the `rawWallClockLossMs` / `accumulatorOverflowMs`
loss metrics. AGENTS.md lists "Fixed 60 Hz simulation." and "Maximum four catch-up steps." as
preserve-items; do not vary either. `STACKED_FIXED_STEP_HZ = 60`, `STACKED_MAX_CATCH_UP_STEPS = 4`.

`DeterministicSimulation` drives the *cadence*; `createStackedRuntime` owns the *state*, and its `tick`
is the canonical one. The host calls `runtime.step(mask)` from inside a single `onStep` callback and
nowhere else. Because the same frozen input reaches all four catch-up steps of a frame, §6's
rising-edge test inside the sim is what makes those steps idempotent for edge actions.

Do **not** use `DeterministicSimulation.nextRandom` — its `RANDOM_STREAMS` set is
`new Set(['encounters', 'drops'])` (`simulation.mjs:7`) and it throws `TypeError` on any other stream
name. STACKED's RNG is `createSeededSubstreams` from `apps/portal/src/seeded-rng.mjs`.

Rank on **ticks**, not wall-clock seconds: `accumulatorOverflowMs` means a stuttering client runs fewer
ticks per real second. `survivalSeconds` is a display value derived as `ticks / 60`, as Chikun computes
`elapsedSeconds: Number((state.tick / CHIKUN_FIXED_STEP_HZ).toFixed(6))`
(`apps/portal/src/chikun-cabinet.mjs:171`).

**Integer / fixed-point discipline.** The whole sim is integer arithmetic. The only float is
`SeededRng.float()`, whose value is `uint32 / 4294967296` — exactly representable in IEEE-754 double on
every engine, so `Math.floor(f * n)` for small integer `n` is bit-identical everywhere. Convert to an
integer at the call site and never store a float in sim state. `gravityAccQ16` is the one accumulator,
an integer in Q16.16.

Permitted inside `step()`: `+ - *`, integer division via `Math.floor(a / b)`, `Math.floor`, `Math.min`,
`Math.max`, `Math.abs`, `Math.imul`, and bitwise operators.

Banned inside `step()`, without exception: `Math.hypot`, `Math.sqrt`, `Math.pow`, `**`, `Math.sin` /
`cos` / `tan` / `atan2`, `Math.random`, `Date.now`, `performance.now`, `toFixed` on a value that feeds
a comparison, `Object.keys` / `for...in` ordering as a control-flow input, and any `Number.prototype`
formatting. `Math.hypot` is implementation-approximated in ECMA-262 and already sits inside Chikun's
`step()` (the coin-pickup radius test at `apps/portal/src/chikun-cabinet.mjs:291`), so a run recorded
in one engine can in principle fail re-verification in another. STACKED must not inherit that.

**The boundary.** `createStackedRuntime({ seed, maxTicks, config })` returns a frozen
`{ step(mask), snapshot(), result(), get terminal }`, mirroring `createChikunRuntime`'s
`Object.freeze({ step, snapshot, result, get terminal })`. `config` is the Free/Ranked configuration of
§12, accepted once at construction and never mutable afterwards. In Ranked, `config` is the frozen
ranked preset and the runtime exposes no additional methods; the Free-only `restoreSnapshot()` used by
undo must be **absent** from the Ranked runtime object, not merely refused by it.

Simulation state (canonical, hashed, replayed, in `snapshot()`): `board` (240 bytes), active piece
`{ kind, rot, x, y }`, `prevMask`, `gravityAccQ16`, `lockDelayTicks`, `lockResetsUsed`,
`lowestYReached`, `queue`, `bagRngCount`, `garbageRngCount`, `holdKind`, `holdUsed`, `tick`,
`linesCleared`, `level`, `score`, `comboCount`, `maxCombo`, `chainActive`, `maxBackToBack`, `hashpower`,
`garbageTimerTicks`, `garbagePending`, `garbageRowsReceived`, `garbageGroups`, `garbageRowsCleared`,
`reorgsRejected`, `lastGarbageHole`, `lastActionWasRotation`, `lastKickIndex`, `piecesPlaced`,
`holdsUsed`, `quadClears`, `spinsMini`, `spinsFull`, `perfectClears`, `softDropCells`, `hardDropCells`,
`maxStackHeight`, `terminal`, `terminalReason`.

The stat counters are canonical results, not optional bookkeeping: the leaderboard needs lines, time
survived, max combo, four-line clears and spins as ranked columns, so the sim produces them and the
verifier re-derives them; the renderer never computes them. Update rules:
`maxCombo = Math.max(maxCombo, comboCount)` immediately after the §9 increment; `quadClears += 1` on
any lock clearing exactly 4 rows; `spinsFull` / `spinsMini` increment per §3.1 on any qualifying lock
**including 0-line spins**, since the column counts spins performed, not spins that cleared;
`perfectClears += 1` when the board is empty after a clear; `piecesPlaced += 1` per lock;
`holdsUsed += 1` per accepted swap; `garbageRowsReceived` counts rows written and `reorgsRejected`
counts rows bought off with hashpower; `maxStackHeight` is the highest occupied row + 1, recomputed at
each lock and bounded by `BOARD_ROWS`. Every one is an integer that only ever increases.

`survivalSeconds` is deliberately **not** in the list: it is `tick / 60`, derived at the boundary and
never stored.

**Presentation state — never read by the sim, never in evidence, never in the hash:** ghost piece,
`interpolationAlpha`, hard-drop trail, line-clear flash and row-collapse animation, particle emitters,
zone/EPOCH palette index, audio band energies from the parent AnalyserNode, camera shake, score-counter
lerp, DAS/ARR charge indicator, next-queue and hold rendering, viewport size and aspect, and every
quality-tier decision (`visuals.md`, `mobile.md`; STACKED selects its own tier in
`apps/stacked/src/render/quality-tier.mjs` and does **not** reuse HMH's
`selectRuntimePerformanceProfile`).

Hard rule, matching AGENTS.md ("Art, interpolation, particles, shaders, audio, animation LOD, and
quality tiers are projection-only. They may not change collision, damage, AI, spawning, RNG,
progression, evidence, or results."): the renderer may read only the frozen `snapshot()` plus
`interpolationAlpha`, and no render-side callback may call a sim mutator. Music-reactive energy is a
renderer input only; it must not appear in `snapshot()`, and no zone/EPOCH transition may touch a sim
value.

---

## 12. Free Mode vs Ranked Mode

| Aspect | Free | Ranked |
| --- | --- | --- |
| Seed | `session.seed` from `portal:init`; on restart the child re-derives `hashSeed(seed ^ restartIndex)` (`seeded-rng.mjs:41`) — deterministic, locally reproducible, never submitted. | `session.seed` only, verbatim, for the whole run. |
| Restart | Instant, child-owned: the runtime is reset in place and a new piece queue is built. No iframe remount, no new parent session. | Refused **at the host**, not merely hidden in the UI. A host-policy refusal, not a schema rejection: the bridge validators accept `portal:restart` with an empty payload regardless of mode (`sdk/hmh-bridge-protocol.mjs:240`), so the child must check its own `mode === 'ranked'` and reply with an error. |
| Starting level | Player-selectable `1..15`; `level = min(30, startLevel + floor(lines / 10))`. | Forced `startLevel = 1`. No level skip. |
| Next queue | `1..6`, player choice. | Fixed `5`. |
| Hold | Toggleable off (practice constraint). | Always on. |
| Ghost | Toggleable off. | On (§4). |
| Rising ledger | Toggleable off entirely, or forced to a fixed interval for dig practice. | Always on, exactly per §8. |
| 20G practice | Optional toggle forcing `gravityLevel = 15` from tick 0. | Unavailable. |
| Overlays | Hole/bumpiness heat overlay, finesse-fault counter, per-piece placement timer. Presentation-only. | Unavailable. |
| Undo | Rewind one placement, at most 3 per run, via a Free-only `restoreSnapshot()` restoring a full pre-lock snapshot (board bytes, piece, `prevMask`, both RNG cursors, all counters). Restore streams with `SeededRng.fromSnapshot({ seed, count })` (`seeded-rng.mjs:109`), which replays `count` draws in its constructor — O(count), fine at 3 undos and unacceptable per-tick, which is why the snapshot stores a cursor rather than the generator's internal word. | Method absent from the runtime object (§11). |
| Pause | Free. | Allowed and uncapped, but the overlay **blanks the playfield, the next queue and the hold slot**, so a pause buys no planning time. Forced on tab-hide and window blur. `pauseCount` and `pausedWallClockMs` recorded in `runStats` (owner gate G-7). |
| Evidence | Not recorded. | Recorded from tick 0 as the `SIC1` transition stream (§6, `integrity.md`), bounded by `STACKED_MAX_INPUT_TRANSITIONS` and `STACKED_MAX_EVIDENCE_BYTES`. |
| Score write | None; the run is ephemeral and the parent short-circuits before any progress write. | Parent-verified re-simulation is authoritative; the parent's re-derived score is written, never the child's submitted number (`portal.md`, `integrity.md`). |
| Achievements | No run achievements unlocked. | Unlocked through the parent. |
| Progress isolation | Free never advances `profile.progress`, cadence boards, XP, rank, payments or `officialSessions`. | Normal ranked write path. |

**Every Free-mode aid is either presentation-only or a documented sim-parameter override**
(`startLevel`, garbage off, forced 20G, queue length, hold off). None exists in Ranked, and the runtime
accepts its Free/Ranked configuration once at construction and refuses to mutate it mid-run, so there
is no code path by which a Ranked run can acquire an aid.

**Two different objects are called `session`, and conflating them is a real hazard.** The child's
`session` arrives in the `portal:init` payload and carries exactly
`{ seed, buildHash, seasonId, rankedEligible }`, with `rankedEligible` validated to equal
`mode === 'ranked'` — that is the object the Seed row means. The parent's `session`, the one
`recordScore` takes (`apps/portal/src/arcade-core.mjs:5465`), is the arcade-core canonical session and
carries `leaderboardEligible`, `wallet`, `gameId`, `sessionId`. The child never sees the second and must
never be trusted to report the first; the write decision is made parent-side off
`session.leaderboardEligible` alone. `startLevel` rides in the `settings` block, never in `session`,
which structurally prevents a Free-mode start level from reaching the seed.

**One caveat on progress isolation**, because the short-circuit is not as early as it looks:
`recordScore` calls `ensureProfile` (which routes to `connectPlayerAccount`) and `ensureGameProgress`
at `arcade-core.mjs:5493-5494`, **before** testing `session.leaderboardEligible`. Those lazily *create*
the profile and the per-game progress record — and, on a wallet's first connection, unlock
`CABINET_PIONEER` and append a `wallet-login` event. They never *advance* anything from the run. "Free
never touches the profile" is therefore false and must not be relied on; "Free never advances progress,
XP, rank, achievements-from-runs, cadence boards or official sessions" is true and is what the
isolation test should assert.

STACKED ships its **own** bridge module (`apps/portal/src/stacked-bridge-protocol.mjs`, protocol
`stacked-bridge/v1`) rather than importing `sdk/hmh-bridge-protocol.mjs`, which hard-checks
`payload.gameId !== HMH_GAME_ID` and caps `game:state` `level` at 1000
(`sdk/hmh-bridge-protocol.mjs:155`). STACKED's `level` is capped at 30, so that bound is not a practical
problem, but the module boundary is still required; the envelope shape and payload contracts are owned
by `integrity.md` and `portal.md`.
