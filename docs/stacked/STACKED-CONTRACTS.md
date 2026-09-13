# STACKED — Frozen Contracts

**Status: FROZEN.** This document is the single source of truth for every cross-section name,
constant, identifier, and payload shape in STACKED. It is the output of Cycle **S-01** (see
[`STACKED-MASTER-PLAN.md`](STACKED-MASTER-PLAN.md) §3 and [`STACKED-CYCLES.md`](STACKED-CYCLES.md) §3)
and it resolves conflicts C-1 … C-9 and every row of §0.3 of the phasing plan.

**Precedence.** Where any other STACKED document — mechanics, visuals, portal, integrity, mobile,
versus, gates, phasing — disagrees with this file, **this file wins and that document is wrong and
must be corrected**. The seven design sections were written in parallel and contradict each other;
that is the reason this file exists. An implementer who finds a second value for anything listed here
has found a bug, not a choice.

**The freeze rule.** Nothing from S-02 onward may re-open a contract in this file without a
`STACKED_CABINET_VERSION` bump and an explicit note in the cycle ledger. `cabinetVersion` feeds
`buildHash` feeds the derived session seed (`apps/portal/src/arcade-core.mjs:5234-5236`), so a
contract change **rotates every seed and retires the season's stored replays**. That is correct
behaviour and it is stated policy, not an accident to be discovered when a board empties.

**Single declaration.** Every constant in §2 is exported from exactly one module,
`apps/portal/src/stacked-contracts.mjs`, which imports nothing. `tests/stacked-contracts.test.mjs`
carries a duplicate-declaration scan over `apps/`, `sdk/`, `scripts/` and `tests/`. A second
declaration anywhere is a test failure.

**Trademark rule, restated because it constrains every table below.** The trademarked genre name and
the trademarked term for a four-line clear appear in **no** shipped string: not in `gameId`,
`seasonId`, achievement ids, evidence or protocol version strings, particle preset ids, flag codes,
asset filenames, or UI copy. Every name in §1 already obeys this.

---

## 1. Canonical terminology

One approved name per concept. Rejected variants are listed so a reader who meets one in an older
draft knows it is dead.

### 1.1 The four-line clear (conflict C-5 / owner gate G-1)

The four drafts disagreed four ways. The resolution **decouples the display name from every
identifier**, so the one part the owner still owns can change without rotating a seed or retiring a
replay.

| Slot | Frozen value | Rejected | Why it lost |
| --- | --- | --- | --- |
| **Player-facing display name** | **`HALVING`** (HUD, results screen, leaderboard column header, achievement titles, copy sheet) | `LEDGER BLOCK` (versus), the trademarked term | `HALVING` is the only variant already carrying the LitVM/Litecoin theme *and* already used by two sections (mechanics §9, portal §1). `LEDGER BLOCK` is two words, does not fit a fixed-width leaderboard header, and collides with "ledger" already used for the rising-garbage mechanic. **This is owner gate G-1 and it may still change** — see §5.1. |
| **Technical root used in all identifiers** | **`quad`** | `halving` (portal), `fourLine` (integrity) | `quad` is the neutral community term that exists precisely to avoid the trademark; it is short, it is already the visuals section's preset root, and — decisively — it is **independent of the display name**, so a G-1 ruling that renames `HALVING` touches zero ids, zero stored replays, and zero seeds. `halvings` would have welded a display decision into the schema. |
| **Run-summary / result-tuple schema field** | **`quadClears`** | `halvings` (portal §7), `fourLineClears` (integrity §4.2/§9), `quadCount` | Follows the frozen root. `fourLineClears` is 4 characters longer in a 16-key projection that exists to halve the persisted leaderboard row (portal §7.2). |
| **Achievement ids** | **`stacked-first-quad`** (key `STACKED_FIRST_QUAD`), **`stacked-quad-10`** (key `STACKED_QUAD_10`) | `stacked-first-halving`, `stacked-halving-10` (portal §10) | Achievement ids are permanent once a player has unlocked one; they must not carry a name still under an owner gate. Titles stay `Halving Day` / `Ten Halvings` and are display copy. |
| **Particle preset id** | **`quadClear`** | renaming it to match the display name (visuals §9 proposed this) | Preset ids are shipped strings referenced from the zone data tables; visuals' plan to rewrite the id once the display name landed is exactly the coupling this row removes. |
| **Plausibility flag code** | **`quad-clears-exceed-lines`** | `four-line-clears-exceed-lines` (integrity §5.3) | Follows the frozen root; flag codes are rendered in the trust tooltip and are shipped strings. |
| **Sim event / `clearType` enum value** | **`'quad'`** | `'ledger-block'` (versus §2.2) | Follows the frozen root. |

### 1.2 Every other gameplay term

| Concept | Player-facing name | Identifier / schema field | Rejected variants |
| --- | --- | --- | --- |
| 1-line clear | `CONFIRM` | `singles`, `clearType: 'single'` | — |
| 2-line clear | `BATCH` | `doubles`, `clearType: 'double'` | — |
| 3-line clear | `MERKLE` | `triples`, `clearType: 'triple'` | — |
| 4-line clear | `HALVING` | `quadClears`, `clearType: 'quad'` | see §1.1 |
| Rotation clear, full | `FORK` | `clearType: 'spin-full'`, `spins` / `spinClears` | `T-spin` and any piece-letter-derived name (trademark and letter-leak risk) |
| Rotation clear, mini | `MINI FORK` | `clearType: 'spin-mini'` | — |
| Rotation-clear family (generic) | `SPIN` | `spins` | — |
| Back-to-back streak | `CHAIN` (HUD `CHAIN xN`) | `maxBackToBack`, `chainActive` | `b2b`, `backToBack` as a display string |
| Combo streak | `MEMPOOL` (HUD `MEMPOOL xN`) | `maxCombo`, `comboCount` | — |
| All-clear / empty board | `GENESIS` | `perfectClears`, `allClearStreakMax` | `perfect clear` as a display string (it is fine in prose and in field names) |
| Rising garbage row | `REORG` | `garbageRowsReceived`, `garbageGroups` | `rising ledger` as an id (fine as prose), `attack` (versus, that is the P2 term), **`LEDGER` as the player-facing name for a rising row** (an early master-plan draft — it collides with the system name and with `LEDGER BLOCK`, both already rejected above) |
| Rising-garbage system | the rising ledger | — | `LEDGER` as a shipped display string |
| Defence currency | `HASHPOWER` | `hashpower` | — |
| Spending `HASHPOWER` to reject one rising row | *(no display name; prose is "reject a REORG")* | `reorgsRejected` — **sim state only** (mechanics §8.1); it is **not** a run-summary, `runStats`, result-tuple or leaderboard field | **`REORG` as the name of the rejection** (it is the name of the *row*, per the row above) and **`reorgs` as a schema field** — an early master-plan draft invented it; no such field exists in the 42-field run summary (§4.4), the 16-key `runStats` projection (§4.4), or the result tuple (§4.3), and none may be added without a `STACKED_CABINET_VERSION` bump |
| Visual zone milestone | `EPOCH` | `zoneReached`, `STACKED_ZONES[n].id` | — |
| Simulation time unit | ticks | `survivalTicks`, `tick`, `*_TICKS` | **`frames` / `*_FRAMES` (integrity) is rejected everywhere.** A tick is simulation; a frame is projection. The projection firewall depends on never confusing the two, and `DeterministicSimulation` in this repo already counts ticks. |
| Run end cause | — | `terminalReason` | `topOutReason` (integrity §4.2) |
| Evidence codec | — | `SIC1` (4-byte magic), codec version `1` | — |
| Quality tier | — | `desktopHigh` \| `desktopLow` \| `mobile` | `desktop` / `mobile` / `reducedMotion` (mobile §7). *(gates §6.1 already asserts the winning vocabulary — `dataset.qualityProfile` in the three tiers plus a separate `dataset.reducedMotion` boolean. No rewrite is outstanding.)* |
| Reduced motion | — | a **modifier** (`reducedMotion: boolean`), never a tier | reduced motion as a fourth tier |
| Reserved two-player block | — | `summary.versus` — an object of **seven integer zeros** (§4.4) | **`versus: null`** on the `game:result` payload or in the stored `runStats` (versus §7), and **`progress.custom.versus`** on the per-game progress record (versus §7). Both are dead: §4.5 freezes the result payload at exactly seven top-level keys with no `versus`, and portal §2.5 freezes `progress.stacked.custom` at exactly eleven keys. Under exact-key **and** key-count validation the `null` shape and the object-of-zeros shape reject each other; only one can ship, and it is the object of zeros, because it is validatable by the same integer-bounds path as every other field and needs no null branch. |

### 1.3 `terminalReason` — the one enum

```js
export const STACKED_TERMINAL_REASONS = Object.freeze([
  'block-out',        // spawn cell set intersects an occupied cell
  'lock-out',         // a piece locks with all four cells at y >= BOARD_VISIBLE_ROWS
  'garbage-out',      // a pending REORG push would move an occupied cell past BOARD_ROWS,
                      //   or the pending queue would exceed GARBAGE_PENDING_MAX
  'tick-ceiling',     // tick >= STACKED_MAX_TICKS
  'evidence-ceiling', // encoded evidence bytes >= STACKED_MAX_EVIDENCE_BYTES
]);
```

All five are **terminal conditions inside the sim**, evaluated as integer comparisons, and all five
rank normally. A validator-only cap silently loses a legitimate run instead of ending it cleanly;
that is forbidden.

Rejected: `'time-cap'` / `'time-limit'` (mechanics, portal — renamed to `tick-ceiling` because the
sim counts ticks, not time); `'frame-cap'` (integrity); `'buried'` (versus — it is a `garbage-out`,
and a second name for one condition is how two verifiers disagree); `'topped-out'` as a catch-all
(portal — it collapses three distinguishable causes the trust column wants to show);
`'abandoned'` and `'runtime-error'` (portal — **neither is a sim terminal**: an abandoned run
submits nothing and a thrown verification writes nothing, so neither can ever appear in a result
tuple or a run summary. They are lifecycle states and live only in the run-history row.)

---

## 2. Frozen constants

All exported from `apps/portal/src/stacked-contracts.mjs`, deeply frozen, no imports. Every value
below is an integer. **There is no floating-point number anywhere in the simulation.**

### 2.1 Board and simulation core

| Constant | Frozen value | Derivation | Rejected |
| --- | --- | --- | --- |
| `STACKED_FIXED_STEP_HZ` | `60` | House rule, `AGENTS.md`. All four sections agree. | — |
| `STACKED_MAX_CATCH_UP_STEPS` | `4` | Matches `DeterministicSimulation` in `apps/hmh-reboot/src/simulation.mjs`. | — |
| `BOARD_WIDTH` | `10` | The only width the kick tables are defined against; narrower breaks I-piece kicks, wider invalidates the garbage arithmetic. | — |
| `BOARD_VISIBLE_ROWS` | `20` | Legible cell size in 9:16 and full-bleed in 16:9 without letterboxing. | — |
| `BOARD_BUFFER_ROWS` | `4` | **Derived** (mechanics §1): two rows so all seven pieces spawn wholly inside rows 20–21, two for I-piece vertical kicks and to detect garbage-out one row before it is unrecoverable. | — |
| `BOARD_ROWS` | `24` | `BOARD_VISIBLE_ROWS + BOARD_BUFFER_ROWS`. | **`40`** (portal §7, versus §2.1). Asserted as "guideline-shaped", with no argument for the other 20 rows. Nothing in the sim can use them: lock-out fires at `y >= 20`, so no piece ever rests above row 23. 40 also inflates `pressure.maxStackHeight` and `technique.softDropCells` bounds by 67% for no reason. **Portal's `STACKED_MATRIX_ROWS` is retired; use `BOARD_ROWS`.** |
| `SPAWN_DELAY_TICKS` | `0` | mechanics §5. Zero delay is what competitive players expect and it deletes a class of replay-boundary ambiguity. **See §5.3 — this is the constant that makes `maxPieces` loose.** | — |
| `LINE_CLEAR_DELAY_TICKS` | `0` | Same. | — |
| `STACKED_MIN_PLACEMENT_TICKS` | `2` | **Derived from the two constants above plus mechanics §6's "a tick that locks ends there".** A lock resolves clears, garbage and spawn on its own tick, and the newly spawned piece takes no action until the next tick. Two ticks per piece is therefore the true floor. | `6` (portal §7, `MAX_RUN_TICKS/6`, asserted) and `7` (integrity §5.1, `SPAWN_DELAY_FRAMES + 1` — computed against a spawn delay of 6 that mechanics then froze at 0). Both are **tighter than the rules allow** and would reject a legal run. |
| `SOFT_DROP_FACTOR` | `20` | mechanics §5, a frozen sim constant in both modes. It is read inside `step()`, so a per-player value would have to travel in the evidence header and be applied by the verifier; a verifier running defaults would diverge from the run it is checking. | portal §12's player-configurable `sdf: 5..41`. Rejected on the derivation above; it can return only together with a header field and a verifier change. |
| `STACKED_LEVEL_CAP` | `30` | integrity §5.1 + portal §7.1. Without it, `level-inconsistent-with-lines` cannot be a pure function of lines and `maxScore` is unbounded. Owner gate **G-4**; the recommendation is adopted as the contract value. | uncapped (mechanics §9). |
| `STACKED_COMBO_BONUS_CAP` | `20` | integrity §5.1. Uncapped, the combo term is `O(clears²)` — at a degenerate 1,712 **single-line** clears (the largest clear count 1,712 lines permits) and level 30 it alone pays `750 × 1712 × 1713 ≈ 2.2 billion` points — and `score-implausible` becomes worthless. (1,712 is the *lines* figure from the §4.3 shape example, whose implied clear count is ~537; the 2.2-billion figure is the degenerate all-singles bound, not that example's combo term.) Owner gate **G-4**. | uncapped (mechanics §9). |
| `LEVEL_FOR_LINES` | `level = min(STACKED_LEVEL_CAP, startLevel + floor(lines / 10))`; `startLevel` is `1` in Ranked | mechanics §5. Must stay a **pure function of lines**, or integrity's `level-inconsistent-with-lines` flag is dropped rather than fudged. | — |
| `GRAVITY_LEVEL_CAP` | `15` | mechanics §5: past 2 cells/tick the game stops being about stacking; the difficulty driver is the rising ledger. | — |
| `LOCK_LEVEL_CAP` | `20` | mechanics §5. | — |
| `STACKED_GRAVITY_Q16` | `[1092, 1092, 1365, 1771, 2341, 3121, 4096, 5461, 7282, 9362, 13107, 16384, 21845, 32768, 65536, 131072]` | mechanics §5. Each entry is `round(65536 / framesPerCell)`; the rounded integers **are** the truth and must never be re-derived at runtime, or a future engine's division reintroduces a float. Index 0 duplicates index 1 so the lookup is total. Ship as a frozen plain array, **not** a frozen `Int32Array` (`Object.freeze` throws `TypeError` on a typed array with elements). | — |
| `LOCK_DELAY_TICKS` / `LOCK_RESET_CAP` by `lockLevel` | `1-10 → 30/15`, `11-13 → 26/15`, `14-16 → 22/12`, `17-18 → 18/10`, `19 → 15/8`, `20+ → 12/6` | mechanics §5. | — |
| `STACKED_ZONE_COUNT` | `6` | portal §7 and visuals §3 both ship six; the locked owner decision says "5–6" and the visual baseline set is sized for six. Zone ids are frozen in §2.7. | `5`. |

### 2.2 Run ceilings (conflict C-3)

| Constant | Frozen value | Derivation | Rejected |
| --- | --- | --- | --- |
| `STACKED_MAX_TICKS` | `432_000` (2 h at 60 Hz) | **Portal §7's derivation, which is the only one that reasons about the real hazard — force-ending a legal run.** The owner's god-tier target is 30–40 min and solo play is indefinite until top-out, so the cap must sit far enough above the intended ceiling that no exceptional run is ever cut off. Two hours is 3–4×. | `216_000` (integrity, 60 min — only 1.5× the god-tier ceiling; one exceptional run is truncated). `270_000` (mechanics, 75 min — 1.9×, same failure mode with less margin). `1_296_000` (gates, 6 h — a hostile-client bound wearing a play cap's clothes; it triples every downstream ceiling (`maxPieces`, `maxLines`, `maxScore`) and makes `maxLines`, the strongest check in the plausibility gate, three times weaker, for a run length no human reaches). |
| `STACKED_MAX_PIECES` | `216_000` | `floor(STACKED_MAX_TICKS / STACKED_MIN_PLACEMENT_TICKS)`. | `72_000` (portal, from a 6-tick floor). |
| `STACKED_MAX_LINES` | `86_400` | `floor(STACKED_MAX_PIECES * 4 / 10)` — a piece is 4 cells, a row is 10. | `28_800` (portal, downstream of the above). |
| `STACKED_MAX_QUAD_CLEARS` | `21_600` | `floor(STACKED_MAX_LINES / 4)`. | — |
| `STACKED_MAX_SCORE` | `1_000_000_000_000` | portal §7's term-by-term derivation at the level cap. It is also the value HMH already uses for its own score/xp bound (`sdk/hmh-run-summary-schema.mjs:132`) and for `game:state score` (`sdk/hmh-bridge-protocol.mjs:149`), so nothing downstream needs a wider integer. | `999_999_999` (mechanics' earlier draft, applied as a **clamp inside `step()`**). Rejected twice over: portal proved a schema-legal run exceeds it, and clamping silently stops an elite player's score from moving. **Delete the `score = Math.min(score, …)` line from the scoring block; the bound is a validator bound, not a sim clamp.** |
| `STACKED_MAX_ELAPSED_MS` | `7_200_000` | `STACKED_MAX_TICKS * 50 / 3`. | — |

### 2.3 Input model and evidence codec (conflicts C-1, C-2)

**The resolution in one paragraph.** The sim's input is **one committed `uint8` action-state mask
per tick**, not a raw physical held-key snapshot. The mask is recorded exactly as handed to `step()`.
DAS, ARR, DCD and every touch/gesture/gamepad threshold live in the **input layer, outside the sim**,
which expands held directions into per-tick movement pulses before committing the mask. The accepted
sim compares consecutive masks for horizontal movement (including opposing-direction takeover),
rotation, hold and hard-drop edges; `softDrop` is level-triggered. The verifier consumes those same
committed masks without a device adapter, and SIC1 transition-encodes them for chunked transport.
The [input-mask clarification](amendments/INPUT-MASK-CLARIFICATION-v1.md) records the unresolved
ARR=1/nine-tick touch timing promises: this wording does not change mechanics or claim those cadence
gates pass.

Why each loser lost:

- *mechanics §6's host-adapter edge clearing* — correct in outcome, but it puts a determinism
  invariant in the host instead of the sim. If the host is ever wrong, the recorded stream and the
  live run diverge silently. Its **"the byte recorded for tick T is exactly the byte handed to
  `step()` on tick T"** rule survives and is adopted verbatim.
- *integrity §3.1's level-triggered `MOVE_LEFT`/`MOVE_RIGHT`* — puts DAS inside the sim, which makes
  touch a second-class input: a 3-column drag would have to synthesise a held bit and would then be
  subject to DAS charge and ARR. Mobile §6.3 derives that there **is no touch analogue of DAS**.
  Everything else in integrity §3 — the codec, the header, the recorder invariants, the bit order —
  survives.
- *mobile §6.1's 9-action edge list* — a ninth action breaks the 8-bit ceiling, widens the record,
  invalidates every stored replay and forces `stacked-bridge/v2`. It only needed `softDropOff`
  because it modelled soft drop as an edge pair; with a per-tick mask, `softDropOff` is the bit going
  to `0` and costs nothing. The classifier design, the spawn lockout, and the flick rules survive.
- *versus §2.2's held-state `uint8`* — **wins**, and is what makes lockstep trivial later: a remote
  peer's input for tick T is one byte. Its simultaneous-bit precedence table is adopted.
- *integrity §0's "no chunking, hand the stream over as a live `Uint8Array`"* — **void**. STACKED runs
  in a sandboxed iframe behind `postMessage` with a 65,536-byte cap, exactly like HMH and Chikun
  (`apps/portal/src/hmh-reboot-host.mjs:115-126`, `sdk/hmh-bridge-protocol.mjs:4`, `AGENTS.md:34`).
  Integrity §0 must be corrected in the same commit that reads it.

**The action bit order. This is part of the codec version and may never be reordered.** Integrity
§3.1 and versus §2.2 already agree on it exactly; mechanics' earlier draft order is rejected.

| Bit | Action | Trigger |
| --- | --- | --- |
| 0 | `moveLeft` | edge (rising, detected inside the sim) |
| 1 | `moveRight` | edge |
| 2 | `softDrop` | **level** — the only held bit; applies to every tick it is set |
| 3 | `hardDrop` | edge |
| 4 | `rotateCW` | edge |
| 5 | `rotateCCW` | edge |
| 6 | `rotate180` | edge |
| 7 | `hold` | edge |

All eight bits are allocated. A ninth sim action widens the record, invalidates every stored replay
and forces `stacked-bridge/v2`. **Pause is not an input bit** (all four sections agree) and nothing
presentational — camera, zoom, mute, HUD toggle — is ever an input bit.

**Simultaneous-bit precedence, pinned** (versus §2.2; an implementer will otherwise invent one, and
two inventions desync):

1. `moveLeft` and `moveRight` both set: a 1-bit `lastHorizontal` latch, updated on each rising edge,
   wins. On release of one, the other takes over immediately with DAS charge reset to 0.
   *(Rejected: mechanics' "opposing bits cancel", which drops the input entirely.)*
2. Multiple rotate bits rising on one tick: `rotateCCW` > `rotateCW` > `rotate180`. Exactly one
   rotation is attempted; the others do not re-fire until they fall and rise again.
   *(Rejected: mechanics' "rotate180 is evaluated first and suppresses both 90 bits".)*
3. `hold` and `hardDrop` rising on one tick: `hold` resolves first, `hardDrop` is ignored for that
   tick. A swapped-in piece is never instantly slammed.
4. `softDrop` and `hardDrop`: `hardDrop` wins.
5. `hold` while `hold.usedThisPiece`: no-op, no lock-delay reset.

**Within-tick resolution order** (mechanics §6, adopted):
`hold → rotate → shift → hardDrop → gravity/softDrop → lock timer → lock → line clears → pending
garbage → spawn`. A tick that locks ends there; the newly spawned piece takes no gravity, shift or
rotation until the next tick.

| Constant | Frozen value | Derivation | Rejected |
| --- | --- | --- | --- |
| `STACKED_ACTION_COUNT` | `8` | Bit order above. | `9` (mobile §6.1). |
| `STACKED_MAX_MOVE_STEPS_PER_TICK` | `1` | **Structural.** A one-byte mask carries at most one move bit per tick, so one column per tick (60 cells/s) is the fastest the encoding can express. mechanics §6 states the price and it is the right price. | mobile's `maxMoveStepsPerFrame = 9` and `STACKED_MAX_ACTIONS_PER_FRAME = 12` are **not expressible** in the frozen encoding. |
| `STACKED_MOVE_QUEUE_MAX` | `9` | mobile §5.1's derived per-frame move ceiling, **reused as an input-layer queue depth**: a fast touch drag banks up to 9 column steps and the classifier drains exactly one per tick. Crossing a 10-wide board therefore costs ≤ 9 ticks (150 ms) instead of being dropped. Steps beyond 9 are dropped and counted into `droppedInputs`. | dropping excess steps at the frame boundary (loses input from fast players on exactly the hardware they play on). |
| `STACKED_INPUT_BUFFER_TICKS` | `4` | mobile §6.2: zero-step frames between consecutive steps is `ceil(refreshHz/60) - 1` — 1 at 120 Hz, 2 at 144 Hz, 4 at 300 Hz. Mirrors Chikun's `flapBufferFrames = 2` with a larger bound. | — |
| `DAS_TICKS` default / range | `8` (133 ms) / `4..18` (60–300 ms) | **Derived** (mobile §6.3): stored in ms for the UI, converted once at run start via `clamp(round(dasMs / (1000/60)), 4, 18)`, and the UI displays the snapped value so the number the player sees is the number the run uses. | mechanics' `10` ticks (167 ms), asserted, and inconsistent with the ms defaults the settings module stores. |
| `ARR_TICKS` default / range | `2` (33 ms) / `1..6` (17–100 ms) | Same derivation. A 0 ms ARR is not offered: 1 tick is already the floor and instant wall-to-wall movement removes a real cost from the difficulty curve. | mechanics' range `0..5` — `0` is not representable as a tick count and its "one cell per tick" meaning is already what `1` means. |
| `DCD_TICKS` default / range | `0` / `0..8` | mechanics §6. On a held-direction change the controller sets remaining charge to `min(DAS, DCD)`; `DCD = 0` is an immediate full recharge. Input-layer, outside `step()`. | portal's `dcdMs: 0..100` (ms; the sim and the expander count ticks). |
| **Auto-shift stops at the wall** | rule | mobile §6.3. Once the sim reports the piece cannot move further in the held direction, expansion stops and re-arms on the next spawn, rotation, or direction change. Without it, holding against the wall emits up to 60 dead edges/second — an evidence-size problem *and* a plausibility-gate false positive. | — |

**`SIC1` — STACKED Input Codec v1** (integrity §3.3, adopted whole; only the trigger semantics of
bits 0/1 changed, which does not touch the byte format).

Header, 24 bytes:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | magic `0x53 0x49 0x43 0x31` (`"SIC1"`) |
| 4 | 1 | codec version = `1` |
| 5 | 1 | action-set version = `1` |
| 6 | 2 | fixed step Hz = `60` (uint16) |
| 8 | 4 | seed (uint32, big-endian) |
| 12 | 4 | total ticks (uint32) |
| 16 | 4 | transition count (uint32) |
| 20 | 4 | FNV-1a-32 of bytes `[24 .. end]` — stream integrity, **not** a security hash |

Body, one record per mask transition, big-endian, no padding:

- **Short form, 1 byte.** High bit `0`; `0DDDDBBB` where `DDDD` = (ticks since previous transition)
  − 1 (gap 1–16) and `BBB` = index of the single toggled bit, applied as `mask ^= 1 << BBB`.
- **General form, 3–5 bytes.** Lead byte `0x80`, LEB128 varint of (gap − 1), then one byte of the
  **absolute** new mask. Used for gaps > 16 ticks or multi-bit changes on one tick.
- **Terminator, 2–4 bytes.** Lead byte `0xFF`, LEB128 varint of the final tick index. The decoder
  MUST reach a terminator and MUST reject unless that index equals the header's total-ticks field —
  that is what makes truncation detectable.
- Lead bytes `0x81`–`0xFE` are **reserved and MUST be rejected**. No forward-compatible skip: a
  decoder that skips unknown records is a decoder that can be fed a divergent stream.

Three recorder invariants (they exist because the format cannot represent a gap of zero):

1. **At most one record per tick index.** A second change within one sampled tick overwrites the
   pending record's mask; if the overwrite makes it equal to the previous mask, the record is dropped.
2. **Tick 0's mask is forced to `0`.** Keys physically held at run start are honoured from tick 1.
3. **Any loop stop synthesises a release.** On pause, `blur`, and `visibilitychange` to hidden, write
   a mask-`0` record at the current tick before the loop stops — otherwise a key held across a pause
   keeps charging DAS on resume and the replay diverges from what the player saw.

| Constant | Frozen value | Derivation | Rejected |
| --- | --- | --- | --- |
| `STACKED_EVIDENCE_CODEC_VERSION` | `1` | — | — |
| `STACKED_MAX_INPUT_TRANSITIONS` | `432_000` | **Set equal to `STACKED_MAX_TICKS`** (mechanics §6's rule, and it is the right one): recorder invariant 1 permits at most one record per tick, so a live run provably cannot reach it, and the cap does its real job — bounding a *submitted* blob during verification — without ever firing mid-run. | `131_072` (mechanics' own earlier draft — a live-run hazard, not a margin). `120_000` (integrity §3.4, mobile §6) and `96_000` (versus §5.5): both are below what post-expansion move edges legitimately produce (see the recount below) and would reject god-tier runs. |
| `STACKED_MAX_EVIDENCE_BYTES` | `1_302_000` | **Derived, and re-derived because the tick ceiling changed.** Worst legal encoding is 24 (header) + 432,000 × 3 (every record multi-bit, general form) + 3,375 (records whose gap forces a 2-byte varint: at most `432000/128`) + 26 (3-byte varints: at most `432000/16384`) + 4 (terminator) = **1,299,429 B**. `1_302_000` is the next whole multiple of the chunk size above it (31 × 42,000). Terminal condition `'evidence-ceiling'`; the sim tracks **encoded** bytes, not event count, so varint-escape density cannot be used to overrun it. | `1_260_000` (gates §3.4, 30 × 42,000) — correct method, but derived against a 6-hour tick ceiling; at 432,000 ticks it sits *below* the structural maximum encoding and could reject a legal stream. `362_000` (integrity §3.4) — derived against a 216,000-tick cap and level-triggered move bits. |
| `STACKED_MAX_EVIDENCE_CHUNKS` | `33` | Two chunks above the 31 the byte ceiling implies, so envelope rounding can never make a legal stream illegal (gates §3.4's rule, applied to the new numbers). | `8` (gates' own earlier draft — the chunk ceiling fired before the tick ceiling with no terminal state defined). `12` (versus §5.5) and `32` (gates) — both downstream of rejected byte ceilings. |
| `STACKED_EVIDENCE_CHUNK_RAW_BYTES` | `42_000` | **Derived** (gates §3.4): the envelope (`version`, `seed`, `buildHash`, `seasonId`, `fixedStepHz`, `maxTicks`, score, ~12 secondary stats, framing) costs ≤ 4,096 bytes of the 65,536-byte message cap, leaving 61,440 usable base64 chars = 46,080 raw bytes. 42,000 leaves margin. 42,000 = 14,000 × 3, so every chunk boundary lands on a base64 3-byte group boundary and no chunk carries interior `=` padding. | `30_720` (an earlier versus §5.5 draft — also 3-byte aligned but derived without the envelope budget, so it wastes a third of every message). `16_384` (an earlier mobile §6.5 draft — 15 messages for a run that needs 4). **Neither literal survives in `versus.md` or `mobile.md`; both sections now cite this row. They are recorded here so the numbers cannot be reinvented.** |
| `STACKED_EVIDENCE_CHUNK_B64_CHARS` | `56_000` | `42_000 × 4 / 3`, exact. | — |
| `STACKED_MAX_STORED_REPLAY_CHARS` | `240_000` | **Re-derived because post-expansion move edges cost more transitions than integrity's level-move model.** God-tier 40-minute run ≈ 6,000 pieces × ~20 transitions = ~120,000 transitions ≈ 132,000 B ≈ 176,000 base64url chars; `240_000` is ~1.36×. Retention stays **2 replays** (most recent Ranked + personal best), LRU on write, with an index key. Worst-case pair 480,000 chars ≈ 19% of a ~2.5 M-char Chrome quota shared with the arcade save; typical pair ≈ 200,000 chars ≈ 8%. A run that encodes above the cap simply is not stored locally, with reason `replay-too-large`; it still ranks. | `140_000` (integrity §3.5 — derived from a 60-min cap and a level-move input model, both of which are gone). |

**Which ceiling bites first, restated.** `1_302_000 ÷ 432_000 = 3.014` bytes/tick, and the worst
legal encoding is 3 bytes/tick with at most one record per tick. **The tick ceiling therefore always
terminates first, for every stream the recorder can produce.** `'evidence-ceiling'` is unreachable in
legal play and exists only to bound the parent's reassembly buffer against a hostile or broken child.
Both remain terminal conditions inside the sim, with distinct `terminalReason` values, per C-3.
`tests/stacked-evidence-codec.test.mjs` asserts this ordering directly.

### 2.4 Scoring (mechanics §9, adopted; two reconciliations, both already applied there)

| Lines / event | Name | Base |
| --- | --- | --- |
| 1 | `CONFIRM` | `100` |
| 2 | `BATCH` | `300` |
| 3 | `MERKLE` | `500` |
| 4 | `HALVING` | `800` |
| mini spin, 0 / 1 / 2 lines | `MINI FORK` / `MINI FORK CONFIRM` / `MINI FORK BATCH` | `100` / `200` / `400` |
| full spin, 0 / 1 / 2 / 3 lines | `FORK` / `FORK CONFIRM` / `FORK BATCH` / `FORK MERKLE` | `400` / `800` / `1200` / `1600` |
| `GENESIS` (perfect clear) + 1 / 2 / 3 / 4 | `PERFECT_CLEAR_BONUS` | `800` / `1200` / `1800` / `2000`, or `3200` for 4 with `chainActive` |

Two lookup rules the table does not encode: a spin row **replaces** the plain clear row (never
summed); and a four-line clear always scores `HALVING` (`800`), spin or not, because only `I` clears
four rows and there is no `FORK HALVING`.

Application order, all integers. `level` and `chainActive` are read at their **pre-clear** values for
the whole block; `comboCount` is initialised to `-1` and incremented **before** it is scored.

```js
base   = tableLookup(lines, spinKind);
scaled = base * level;
if (chainActive && (lines === 4 || isSpinClear)) scaled = Math.floor(scaled * 3 / 2);  // CHAIN x1.5
score += scaled;
if (boardIsEmptyAfterClear) {
  score += ((lines === 4 && chainActive) ? 3200 : PERFECT_CLEAR_BONUS[lines]) * level;
}
comboCount += 1;
score += 50 * Math.min(comboCount, STACKED_COMBO_BONUS_CAP) * level;   // MEMPOOL  [EDIT 1]
maxCombo = Math.max(maxCombo, comboCount);
score += softDropCells * 1;
score += hardDropCells * 2;
score += 250 * level;                          // per REORG rejected with HASHPOWER
if (tick % 60 === 0) score += 10 * level;      // survival trickle
// [EDIT 2] no clamp here — STACKED_MAX_SCORE is a validator bound, not a sim clamp
```

`Math.floor(scaled * 3 / 2)` rather than `* 1.5` so the multiply stays integral and the halving is a
single deterministic floor.

- **Reconciliation 1** applied `STACKED_COMBO_BONUS_CAP` (§2.1) to the `MEMPOOL` term; an early
  mechanics draft had no cap. **Already applied:** mechanics §9 caps it at `STACKED_COMBO_BONUS_CAP`.
- **Reconciliation 2** deleted the earlier draft's `score = Math.min(score, 999_999_999)`. See §2.2.
  **Already applied:** mechanics §9 states "There is no score clamp inside `step()`", and the literal
  `999_999_999` no longer appears there. Do not reintroduce either.

### 2.5 The rising ledger (garbage cadence and the HASHPOWER economy — mechanics §8, adopted whole)

| Constant | Frozen value | Meaning |
| --- | --- | --- |
| `GARBAGE_START_TICK` | `3_600` | 60 s of clean board before the first REORG. |
| `GARBAGE_INTERVAL_START_TICKS` | `720` | 12 s between REORGs at the start. |
| `GARBAGE_INTERVAL_STEP_TICKS` | `30` | 0.5 s removed per step. |
| `GARBAGE_INTERVAL_STEP_PERIOD_TICKS` | `2_700` | One step every 45 s. |
| `GARBAGE_INTERVAL_FLOOR_TICKS` | `120` | 2 s, reached after 20 steps at tick 57,600 (16 min). |
| `GARBAGE_ROWS_PER_INJECTION` | `1` | Always one row; the interval carries the whole curve. |
| `GARBAGE_PENDING_MAX` | `8` | More than 8 queued REORGs is `garbage-out`. A safety net, not a live mechanism. |
| `GARBAGE_HOLE_REPEAT_NUM` / `_DEN` | `3` / `5` | 60% chance the hole repeats the previous column. |

**One RNG draw per garbage *group*, not per row** (integrity §2): consecutive rows from one group
share a hole column, so `garbageGroups` counts groups and is recorded, never inferred from
`garbageRowsReceived`.

**Integrity's `GARBAGE_RISE_INTERVAL_FRAMES` does not exist.** The interval is a curve, not a
constant. The plausibility gate's `maxGarbageRowsReceived` and `maxGarbageGroups` must import
`GARBAGE_INTERVAL_FLOOR_TICKS` and use `floor((ticks - GARBAGE_START_TICK) / GARBAGE_INTERVAL_FLOOR_TICKS) + 1`
(clamped at 0 below `GARBAGE_START_TICK`) — the curve's **minimum** interval, which is the only value
that keeps the bound sound at every point on the curve. Integrity §5.1 has **already been reconciled**
to this floor-interval formula (`floor((144000 − 3600) / 120) + 1 = 1,171`); do not reintroduce a flat
interval, and do not reintroduce `GARBAGE_RISE_INTERVAL_FRAMES`.

**The HASHPOWER defence economy** (mechanics §8.1, adopted whole; frozen here because the sim reads
these values inside `step()` and the verifier must run the identical numbers):

| Constant | Frozen value | Meaning |
| --- | --- | --- |
| `HASHPOWER_PER_CLEAR` | `{ 0: 0, 1: 0, 2: 1, 3: 2, 4: 4 }` | Lines cleared → hashpower minted. The `0` key exists so the lookup is total and a 0-line lock cannot poison `hashpower` with `NaN`. A single-line clear mints **zero**; that one rule is the design's sharpest difficulty separator. |
| Spin bonus / chain bonus | `+1` each | Only on a lock that clears at least one line, using the **pre-clear** `chainActive`. A 0-line spin mints nothing (it closes a defence farm). |
| `HASHPOWER_MAX` | `8` | Clamp applied **on mint**; surplus income is discarded. |
| `REORG_COST_PERIOD_TICKS` | `10_800` (3 min) | — |
| `REORG_COST_MAX` | `12` | `reorgCost(tick) = min(REORG_COST_MAX, 1 + floor(tick / REORG_COST_PERIOD_TICKS))`. |

**The `8` / `12` split is deliberate and load-bearing: defence ends at tick 86,400 (24:00).**
`reorgCost` reaches `9` at tick 86,400, and `hashpower` can never exceed `HASHPOWER_MAX = 8`, so
`hashpower >= reorgCost(tick)` is unsatisfiable from 24 minutes onward and **every** REORG lands from
then on. Costs 9–12 are therefore inert as prices and exist only so the formula stays total. Any model,
gate bound or balance argument that assumes partial rejection past 24:00 is wrong — see mechanics §10,
which carries the `g = inj` branch for `reorgCost(tick) > HASHPOWER_MAX`. Whether the wall belongs at
24:00 or should move (raise `HASHPOWER_MAX` to 12, or cap `REORG_COST_MAX` at 8) is an unanswered feel
question, recorded in `STACKED-MASTER-PLAN.md` §7. It is not blocking: the shipped constants are these,
and the §10 model passes every band against them.

### 2.6 Quality tiers and particle caps (conflict C-9, §0.3 rows 1, 2, 5)

**One module, one vocabulary, one predicate:** `apps/stacked/src/render/quality-tier.mjs`, exporting
`STACKED_QUALITY_TIERS` and `selectStackedQualityTier(...)`. Three tiers; **reduced motion is a
modifier, never a tier.**

Selection ladder (visuals §5, adopted — it is the only one that argues its predicate):

1. explicit player override (`stackedQuality` setting) wins;
2. `coarsePointer === true && width <= 820` → `mobile`. **Both conditions, not either.** An `||`
   sends every 10–13″ tablet and touchscreen laptop to the phone tier, and makes the tier flip while
   a desktop player resizes a window;
3. `coarsePointer === true` (wider touch device) → `desktopLow`;
4. `hardwareConcurrency <= 4 || deviceMemory <= 4` → `desktopLow`. Both may be `undefined`
   (`deviceMemory` is not implemented in Safari or Firefox) — treat `undefined` as "not low" and fall
   through. Never treat a missing value as a failing one;
5. otherwise → `desktopHigh`.

`resolution = Math.min(tier.resolutionCap, devicePixelRatio)`, then the per-tier area clamp
(`if (cssW * cssH * resolution ** 2 > maxPixelArea) resolution = sqrt(maxPixelArea / (cssW * cssH))`),
floor 1.

| Field | `desktopHigh` | `desktopLow` | `mobile` | Source |
| --- | --- | --- | --- | --- |
| `particleCapacity` | **6_000** | **2_600** | **1_200** | visuals §5 — **derived**: adversarial concurrent-particle sums of 893 / 445 / 190 from the preset table, padded 35% to ceilings of ~1,200 / ~540 / ~230, then ~5× for governor headroom. |
| `resolutionCap` | 2 | 1.5 | 1.25 | visuals §5 |
| `maxPixelArea` | 4_000_000 | 1_600_000 | 1_600_000 | mobile §7 — desktop 4 M is derived (a single 1.6 M ceiling would clamp a 1440×900 window at dpr 2 down to 1.11 and defeat `resolutionCap: 2` on every display anyone owns); 1.6 M matches `combatCanvasRenderScale`'s existing default in `apps/portal/src/device-model.mjs`. `desktopLow` takes the tighter budget because it *is* the weak-GPU/tablet tier. |
| `bloomCap` (absolute `layerPost` alpha) | 0.35 | 0.22 | 0 | visuals §5, reconciled with the flash limiter's ceiling so the tightest clamp is the meaningful one. |
| `antialias` | true | false | false | mobile §7 |

Rejected: `900` / `260` particle capacities (mobile §7 — asserted, and ~7× below visuals' derived
adversarial ceiling for `desktopHigh`); `measure-then-set` (gates §6.1 — a cap that starts as "we'll
find out" never gets set); the `desktop`/`mobile`/`reducedMotion` vocabulary and the
`width <= 700 || coarsePointer` predicate (mobile §7).

**Consequence for the gates, closed.** gates §6.1 asserts `dataset.qualityProfile` is one of
`desktopHigh`/`desktopLow`/`mobile` with a separate `dataset.reducedMotion` boolean, which is this
vocabulary. Nothing is outstanding.

**What `reduceMotion` does to particles, ruled here because two documents disagreed.**
`reduceMotion` is a **motion** modifier, not a particle switch: it scales particle initial speeds
×0.35 and lifetimes ×0.60, zeroes shake and parallax, and freezes the domain warp (visuals §7.1).
Particles keep rendering, so `dataset.renderedParticles` under the modifier is **> 0 and below the
tier's reduced ceiling — never `0`**. The only two things that zero the alive ceiling are
`stackedEffects: 'minimal'` and frame-budget guard level 3. A gate asserting
`renderedParticles === 0` under `reduceMotion` is asserting against a correct implementation, and the
natural way to make it pass is to break the setting. Rejected: `renderedParticles === 0` as "the
modifier's whole contract" (an earlier gates §6.1 draft).

Telemetry dataset keys on `#stackedStage`, gated behind `telemetry=1`:
`qualityProfile`, `reducedMotion`, `renderResolution`, `renderedParticles`, `particlePoolSize`,
`simulationTick`, `runScore`, `garbageRowsInserted`, `runRestarts`, `longestRunTicks`, `assetsReady`.

Frame-budget guard degradation levels (visuals §5, projection-only, never reallocates the pools —
only the alive ceiling moves): L1 `capacity ×0.60`, bloom 2 passes → 1; L2 `×0.35`, bloom off,
backdrop shader → static gradient; L3 `×0.15`, board glow off, shake ×0.5, parallax → 1 layer, and
**L3 is announced** with a `PERF` pip in the HUD.

### 2.7 Bundle budgets (§0.3 row 3)

| Constant | Frozen value | Note |
| --- | --- | --- |
| `STACKED_ENTRY_JS_CAP` | `null` | **Hard-fails until measured.** `assertStackedJsBudget` throws `Error('STACKED_ENTRY_JS_CAP has no measured baseline yet')` — a readable failure, not the `TypeError` `safeByteCount()` would raise. S-11's first clean build sets it to `measured × 1.08`, rounded up to the nearest 1,000, with the measurement quoted in the ledger. |
| `STACKED_INITIAL_JS_CAP` | `null` | Same discipline. Set from `graphBytes` = `dist/stacked/game.js` plus every output in its transitive static import graph, the number a phone actually downloads. |
| `HMH_INITIAL_JS_CAP` | `1_050_000` — **unchanged** | Do **not** retarget it at the sum of the split caps: `HMH_ENTRY_JS_CAP + ARCADE_PIXI_VENDOR_CAP` is 1,077,000, which is 27,000 bytes *looser* than what the build promises today. Per-artifact caps are additional gates, never a replacement. |

Rejected: `200_000` and `260_000` (portal §6.2) and `220 KB` (gates §6.2) — all three are guesses, and
a cap that starts permissive never gets tightened. This is the one row in this document that is
deliberately not a number, per phasing §0.3.

**Hard prerequisite for any of it to hold:** `createHmhPixiPlugin` in `build.mjs` externalises
`pixi.js` only for importers matching `/apps/hmh-reboot/src/`. It must be widened to an array
including `/apps/stacked/src/` in the same commit that adds the entry, or STACKED inlines the whole
575,891-byte engine and lands near 600 KB. Widening the *externaliser* is not the same decision as
widening the *chunk*, and only the first is free.

#### The shared Pixi vendor chunk is owner gate G-5 — no cycle may edit it before the ruling

visuals §1.2 and gates §6.2 arrived at opposite instructions: visuals mandates adding seven exports to
`apps/hmh-reboot/src/pixi-vendor.mjs` (9 → 16, a measured +21,469 B), and gates says the nine are
frozen and a tenth is a separate owner decision. **Neither is the contract. This is the ruling:**

`apps/hmh-reboot/src/pixi-vendor.mjs` stays at **nine** exports until G-5 is answered. STACKED may not
add a symbol to it, and no cycle may treat visuals §1.2's seven-export table as an instruction. It is
the *proposal attached to G-5 option (a)*, priced and ready, and nothing more.

The arithmetic the owner needs, measured in this checkout at `ff2934db`:

| Quantity | Bytes |
| --- | --- |
| `dist/hmh-reboot/game.js` | 398,971 |
| `dist/chunks/hmh-pixi.js` (9 exports) | 575,891 |
| `dist/chunks/chunk-22O5W2QY.js` (statically imported by the HMH entry) | 63,871 |
| `dist/chunks/chunk-2WGYLO4P.js` (same) | 655 |
| **Real HMH initial JS today** | **1,039,388** |
| `HMH_INITIAL_JS_CAP` (`build.mjs:42`) | 1,050,000 |
| **Real headroom** | **10,612** |
| Cost of the seven added exports (visuals §1.2, measured) | +21,469 |
| **Real HMH initial JS after option (a)** | **1,060,857 — over the cap by 10,857** |

`assertHmhInitialJsBudget` would **not** catch it: it is called with `entryBytes + vendorBytes` only
(996,331 after the additions), so it never sees the two shared chunks. gates §6.2 states the rule that
applies — "if HMH's true initial JS crosses 1,050,000 that is a stop, not a cap bump" — so option (a)
cannot be taken silently by an implementer; it requires the owner to accept the crossing **and** a
cache-busting plan, because `/dist/chunks/(.*)` is served `max-age=31536000, immutable` and
`hmh-pixi.js` carries no content hash.

The options, unchanged from `STACKED-CYCLES.md` §6's G-5: **(a)** grow the shared chunk (needs the
crossing accepted and a cache-busting plan); **(b)** emit a renamed `arcade-pixi-v1.js` carrying all
sixteen and repoint both cabinets (the standing recommendation — rename rather than edit); **(c)** give
STACKED its own vendor entry so HMH's chunk is untouched at nine. Whichever lands, `visuals.md` §1.2
and `gates.md` §6.2 must be brought to the same sentence in the same commit, and `ARCADE_PIXI_VENDOR_CAP`
(646,000, derived from the 597,360-byte 16-export build) is only meaningful under (a) or (b).

Until then: **S-11 ships the externaliser widening and STACKED's own entry, and touches
`pixi-vendor.mjs` not at all.** A STACKED renderer that needs `ParticleContainer` before G-5 is
answered is blocked on G-5, which is the correct place to be blocked.

### 2.8 Render tree and layout (conflict C-8)

Six root layers under one `stackedRoot`, built once by `createLayerStack()` (visuals §1.4). Versus's
five-child `matchRoot` is rejected: it has no `layerPost` for the bloom composite and no split
far/near particle containers, both of which the particle system's z-ordering requires, and it hangs
`boardSlot[n]` directly off the root where visuals groups them under `boardRoot` so per-board shake
has a home.

```
app.stage
└─ stackedRoot                      Container   (global shake applies HERE)
   ├─ layerBackdrop      z=0        Container   zone shader Mesh + parallax TilingSprites
   ├─ layerParticleFar   z=10       ParticleContainer
   ├─ boardRoot          z=20       Container
   │    ├─ boardSlot[0]             Container   <- BoardView 0 (per-board shake applies HERE)
   │    └─ boardSlot[1]             Container   <- created, empty, visible = false in Phase 1
   ├─ layerParticleNear  z=30       ParticleContainer
   ├─ layerPost          z=40       Container   bloom composite Sprite (blendMode 'add')
   └─ layerHud           z=50       Container
```

Inside each `boardSlot[n]`, `createStackedBoardView()` builds (versus §3.1): `wellFrame`,
`stackLayer`, `garbageWarnLayer`, `ghostLayer`, `activeLayer`, `effectLayer`, `hudLayer`.

Four rules, enforced by `tests/stacked-render-tree.test.mjs` against **stub constructors under
`node --test`** (so dropping constructor injection breaks the test rather than passing silently):

1. `app.stage.addChild` is called **exactly once**, with `stackedRoot` as its only argument.
2. No module below `boardSlot[n]` may read `app.screen`, `window.innerWidth`, or `devicePixelRatio`.
3. Two authored frames, `CELL_PX = 32`: `'wide'` 512 × 640 (landscape solo, both landscape 2P slots)
   and `'tall'` 320 × 800 (portrait solo, portrait own-board, portrait opponent mini). The frame
   choice is presentation-only and is decided by `layoutMatch()`, never by the view.
4. Phase 1 creates `boardSlot[1]` and leaves it empty and hidden, so the Phase 2 diff never touches
   root assembly.

```js
// apps/portal/src/stacked-layout.mjs — pure, no Pixi, parent-side, imported by the child
export function layoutMatch({ viewportWidth, viewportHeight, boardCount, opponentMini })
  -> Object.freeze([{ slot, frame, x, y, scale, visible }, ...])
```

`x`/`y` are the CSS-pixel position of the slot container's origin, and **that origin is the TOP-LEFT
of the authored box**, not its centre. `scale` is uniform. All four are integers, so a board never
lands on a half-pixel. The array is returned in ascending `slot` order and always has `boardCount`
entries, hidden ones included. Phase 1 calls it with `boardCount: 1`.

Rejected: `layoutBoards` in `apps/stacked/src/render/board-layout.mjs` (visuals §10) and
`apps/stacked/src/layout.mjs` (mobile §1) — one name, one home, and parent-side is what makes it
importable by a plain-Node test and by a future backend verifier.

Mobile's cell-size solver is **not** a competing layout function: it resolves the on-screen cell size
(`14 ≤ cell ≤ 44`, `cell × snapResolution` an integer, `snapResolution` taken from the **resolved**
clamp chain and not from `resolutionCap`) and feeds `layoutMatch`'s `scale`. `CELL_PX = 32` is the
authored-space constant; the mobile floor and ceiling are on-screen CSS px.

### 2.9 Zone data

`apps/portal/src/stacked-zones.mjs` — pure data plus pure functions, no Pixi import, node-testable,
importable by the parent for results-screen copy.

| # | id | Name |
| --- | --- | --- |
| 0 | `genesis-vault` | Genesis Vault |
| 1 | `mempool-drift` | Mempool Drift |
| 2 | `hashrate-forge` | Hashrate Forge |
| 3 | `scrypt-lattice` | Scrypt Lattice |
| 4 | `halving-eclipse` | Halving Eclipse |
| 5 | `mainnet-aurora` | Mainnet Aurora |

A zone transition is **150 ticks of pure cross-fade**. Gravity, lock delay, input, RNG and scoring are
untouched; nothing pauses and nothing modal appears over the well. `zoneReached` is a projection
readout carried in the run summary; the zone never reaches the result tuple.

### 2.10 Module and test-file map (conflict C-8, closed)

| Path | Owns | Must not import |
| --- | --- | --- |
| `apps/portal/src/stacked-contracts.mjs` | every constant in this document | **anything** |
| `apps/portal/src/stacked-sim.mjs` | the pure sim: `createStackedRuntime`, `simulateStackedRun`, `replayStackedRun`, `encodeSic1`, `decodeSic1`, `buildStackedResultTuple`, `refillBag`, `STACKED_SIM_CONSTANTS` | anything but `./seeded-rng.mjs` and `./stacked-contracts.mjs`. No DOM, no `window`, no `document`, no `performance`. |
| `apps/portal/src/stacked-cabinet.mjs` | `STACKED_CABINET_VERSION`, replay-claim build/verify | **`arcade-core.mjs`** (a back-import through a module loaded during `arcade-core`'s own evaluation makes the constant read `undefined` on the `ARCADE_GAMES` entry), `game-adapter.mjs`, `game-manifest.mjs` |
| `apps/portal/src/stacked-layout.mjs` | `layoutMatch` | Pixi |
| `apps/portal/src/stacked-run-integrity.mjs` | `validateStackedRunPlausibility`, `deriveStackedRunCeilings`, `STACKED_INTEGRITY_TOLERANCE` | DOM |
| `apps/portal/src/stacked-portal-lifecycle.mjs` | the verified-stamp `WeakSet`, `assertStackedVerifiedStamp`, `startStackedRankedSession`, `handleResult`; **registers** its verifier via `registerRunVerifier('stacked', fn)` so no new import edge into `arcade-core.mjs` is created | — |
| `apps/portal/src/stacked-match.mjs` | `createStackedMatch({ seed, playerConfigs, attackTable = null })` — `stepAll`, the garbage router, the all-board `stateHash()`. Constructed with **one** board and `attackTable: null` in Phase 1 (versus §7 item 3). This is the seam that makes Two Player a data change; it ships in S-03 alongside the attack table. | **`./stacked-versus-table.mjs`** (the table arrives through the `attackTable` argument, supplied by Phase 2's entry point, or the zero-importer proof dies), Pixi, DOM. Its only imports are `./stacked-sim.mjs`, `./stacked-contracts.mjs` and `./seeded-rng.mjs`. |
| `apps/portal/src/stacked-versus-table.mjs` | frozen `STACKED_ATTACK_TABLE`, `computeAttack`, `resolveGarbageExchange` | **anything but `./stacked-contracts.mjs`.** Must have **zero runtime importers** across `apps/` in Phase 1; `tests/stacked-versus-table.test.mjs` greps the tree to prove it. `garbageHoleColumn` and board geometry deliberately live in `stacked-sim.mjs` / `stacked-contracts.mjs` — that split is the only reason the zero-importer claim is true. |
| `apps/portal/src/stacked-host.mjs`, `stacked-bridge.mjs`, `stacked-bridge-protocol.mjs`, `stacked-player-settings.mjs`, `stacked-replay-store.mjs`, `stacked-zones.mjs`, `games/stacked/loader.mjs` | as named | — |
| `apps/portal/src/stacked-copy-sheet.mjs` | `STACKED_COPY_STYLE_RULES`, `STACKED_COPY_SHEET`, `collectStackedCopyTexts()`, `stackedCopy(path, fallback)`, `validateStackedCopySheet()` — the five-export shape of `hmh-copy-sheet.mjs`, and the **single** home of the display name `HALVING` | DOM. The naming-scan test must exclude this module from its own input (it necessarily contains the banned patterns as `RegExp` literals). |
| `apps/portal/src/audio-band-analysis.mjs` | pure band-split, adaptive normalisation, spectral-flux onset detection — plain numbers in, plain numbers out | **Web Audio.** No `AnalyserNode`, no `AudioContext`, no DOM. It must be node-testable with synthetic spectra (`tests/stacked-audio-band-analysis.test.mjs`), which is what keeps the audio feature on the projection side of the firewall by construction. |
| `apps/portal/src/arcade-audio-analyser.mjs` | the parent-side Web Audio graph: one cached `createMediaElementSource()` per element for the page lifetime, analyser attach/detach, and a `destroy()` that reconnects the source straight to `destination` | the STACKED sim, any render module. **Lives in the parent, never in the cabinet iframe** — `createMediaElementSource()` is once-per-element and permanently reroutes output, so constructing it in a realm the portal tears down silences arcade music for the whole session, for every cabinet (risk R-4). |
| `apps/portal/src/game-stat-schema.mjs` | per-cabinet `projectRunStats` / `reduceProgress` / profile formatters, replacing hard-coded per-game branches | **`arcade-core.mjs`** — formatters and `ACHIEVEMENTS` are passed in. A back-import creates a cycle through a module `arcade-core` evaluates. |
| `apps/portal/src/run-verifier-registry.mjs` | `registerRunVerifier(gameId, fn)`, `getRunVerifier(gameId)`, the `requiresRunVerifier: true` contract | **`arcade-core.mjs`**, and any cabinet module. It is the seam that removes a third hard-coded cabinet branch; importing a cabinet from it recreates the branch. |
| `apps/portal/src/cabinet-settings-registry.mjs` | the registry-driven parent settings panel (G-12) | any cabinet child module |
| `sdk/stacked-run-summary-schema.mjs` | `validateStackedRunSummary`, the bounds table | DOM |
| `apps/stacked/src/main.mjs`, `render/layers.mjs`, `render/board-view.mjs`, `render/quality-tier.mjs`, `render/backdrop.mjs`, `render/bloom.mjs`, `render/particles.mjs`, `render/flash-limiter.mjs`, `input-intents.mjs`, `touch-gestures.mjs`, `gamepad.mjs`, `haptics.mjs`, `thermal-governor.mjs`, `dev/soak-pilot.mjs`, `verify-worker.mjs` | child runtime | `game-adapter.mjs`, `game-manifest.mjs` — that chain statically imports `apps/portal/vendor/ethers.min.js` for one keccak hash and pulls `dist/chunks/chunk-VSG3JNSZ.js` (392,452 B) into the cold load. Import `ARCADE_SDK_VERSION` from `arcade-sdk.mjs` directly. `thermal-governor.mjs` and every render module are **projection-only**: none may import `stacked-sim.mjs`. |

The map is not a closed enumeration of the cabinet's files — it is the home of the **import
restrictions**. Any Phase-1 module `STACKED-CYCLES.md` creates and this table does not name inherits
the default rule for its directory:

- Parent-side `apps/portal/src/stacked-*.mjs` and `sdk/stacked-*.mjs` stay DOM-free and plain-Node
  importable unless a row above says otherwise.
- **Nothing** under `apps/stacked/src/` may import `game-adapter.mjs` or `game-manifest.mjs`.
- Every module under `apps/stacked/src/render/`, plus `thermal-governor.mjs`, `haptics.mjs`,
  `touch-gestures.mjs` and `gamepad.mjs`, is **projection- or input-layer only** and may not import
  `stacked-sim.mjs`. The three modules that legitimately do are `main.mjs` (which wires bridge → sim →
  render), `verify-worker.mjs` (which imports **only** `stacked-sim.mjs` and is rendering-free by
  construction) and `dev/soak-pilot.mjs` (dev-only, dynamically imported, refused when
  `mode === 'ranked'`).
- A module that is neither in the table nor covered by a rule above is a module whose home nobody
  decided; decide it in the cycle that creates it and add the row.

**Test files.** `STACKED-CYCLES.md` is the scheduling authority and names all of them; the list below
is the same set, held here so a reader who starts at the contract sees the whole thing. It supersedes
gates §3's and integrity §6's earlier partial lists **by name only** — where a cycle specifies what a
file asserts, the cycle wins. Forty-eight files:

`stacked-achievements.test.mjs` · `stacked-audio-band-analysis.test.mjs` · `stacked-audio-graph.test.mjs` ·
`stacked-autoshift.test.mjs` · `stacked-bridge-protocol.test.mjs` · `stacked-bundle-budget.test.mjs` ·
`stacked-cabinet-art.test.mjs` · `stacked-commit-queue.test.mjs` · `stacked-contracts.test.mjs` ·
`stacked-copy-sheet.test.mjs` · `stacked-difficulty-model.test.mjs` · `stacked-evidence-codec.test.mjs` ·
`stacked-flash-limiter.test.mjs` · `stacked-free-medals.test.mjs` · `stacked-haptics.test.mjs` ·
`stacked-host.test.mjs` · `stacked-input-codec.test.mjs` · `stacked-input-device-parity.test.mjs` ·
`stacked-layout.test.mjs` · `stacked-layout-hysteresis.test.mjs` · `stacked-leaderboard-profile.test.mjs` ·
`stacked-match.test.mjs` · `stacked-parent-bridge.test.mjs` · `stacked-particle-system.test.mjs` ·
`stacked-player-settings.test.mjs` · `stacked-portal-lifecycle.test.mjs` ·
`stacked-projection-firewall.test.mjs` · `stacked-public-integration.test.mjs` ·
`stacked-quality-tier.test.mjs` · `stacked-render-tree.test.mjs` · `stacked-replay-claim.test.mjs` ·
`stacked-replay-store.test.mjs` · `stacked-root-fit.test.mjs` · `stacked-run-integrity.test.mjs` ·
`stacked-run-lifecycle-states.test.mjs` · `stacked-run-summary-schema.test.mjs` ·
`stacked-settings-hot-frozen.test.mjs` · `stacked-shell.test.mjs` · `stacked-sim.test.mjs` ·
`stacked-sim-determinism.test.mjs` · `stacked-sim-purity.test.mjs` · `stacked-soak-pilot.test.mjs` ·
`stacked-telemetry-contract.test.mjs` · `stacked-thermal-governor.test.mjs` ·
`stacked-touch-gestures.test.mjs` · `stacked-trust-column.test.mjs` · `stacked-versus-table.test.mjs` ·
`stacked-zones.test.mjs`

Two of them are **mandatory ship gates** and may not be deferred, descoped, or merged into another
file: **`stacked-projection-firewall.test.mjs`** (the twelve-case proof that no tier, audio state or
accessibility setting can move a `resultHash` — §2.6, visuals §6.3, S-14) and
**`stacked-copy-sheet.test.mjs`** (the naming scan that proves D-2's trademark rule holds in shipped
strings — gates §4.10 and §8.2, S-22). `stacked-versus-table.test.mjs` is the third that cannot be
dropped without breaking a locked decision: its grep-for-importers assertion is what keeps D-14's
attack table honest data rather than dead code that drifted.

**Every `.mjs` file this cabinet adds — source, script and test, whether or not it appears in the
table or the list above — must be appended to `NODE_CHECK_FILES` in `scripts/syntax-check.mjs`.** That
list is hand-maintained and un-globbed; an omission escapes `npm run check` silently, including inside
`vercel:build`.

---

## 3. Identity

**Every value below was checked for collisions against this checkout at `ff2934db`.** Method: grep of
`ARCADE_GAMES` ids (`apps/portal/src/arcade-core.mjs:2110-2210`), the app-shell cabinet list
(`arcade-core.mjs:594-616`), `ARCADE_GAME_SLUGS` (`apps/portal/src/arcade-router.mjs:22-29`) and
`ARCADE_GAME_IDS_BY_SLUG` (`arcade-router.mjs:31-36`), `apps/portal/games/`,
`ARCADE_PERSIST_KEY` (`apps/portal/src/persistence.mjs:13`), `ACHIEVEMENT_DEFINITIONS`
(`arcade-core.mjs:1442`, module-private; the exported surfaces are `ACHIEVEMENTS` at `:1508` and
`ACHIEVEMENT_LIST` at `:1509`), `rankedSeasonId` / `CURRENT_RANKED_SEASON_ID`
(`apps/portal/src/session-integrity.mjs:4`), and a case-insensitive tree grep for `stacked` across
`apps/portal/src`, `apps/portal/games`, `sdk` and `vercel.json`.

**Result: no collision.** The string `stacked` occurs in the tree today only as ordinary English in
prose and in asset keys (`interior/stacked-boxes`, `'stacked shipping-container housing'`,
`'stacked red ticker blocks…'`) — never as a game id, slug, manifest id, storage key, achievement id,
or route segment. Existing game ids are **seven**: `lester-blaster`, `lilly-pinball`, `block-brawler`
(`arcade-core.mjs:2155`, status `coming-soon`), `mega-lester` and `chikun` from `ARCADE_GAMES`, plus
`mweb-invaders` and `litvm-legends`, which exist only in the app-shell cabinet list
(`arcade-core.mjs:615-616`). Existing slugs are `hard-money-heroes`, `chikun`, `mweb-invaders`,
`litvm-legends`. `stack` is free in both slug maps.

| Slot | Frozen value | Notes / collision check |
| --- | --- | --- |
| Manifest `id` | `stacked` | `apps/portal/games/stacked/game.manifest.json`. No existing manifest dir named `stacked` (only `chikun`, `hard-money-heroes`, `template-cabinet`). |
| Manifest `capabilities` | `["leaderboard", "achievements", "ranked", "audio", "haptics"]` — **exactly these five, in this order** | `leaderboard` + `ranked` are both required or `rankedEligible: true` is a hard validation error (`game-manifest.mjs:112-116`); `audio` because the cabinet plays its own SFX and the parent ducks music; **`haptics` because it ships** — S-15 delivers `apps/stacked/src/haptics.mjs`, `STACKED_HAPTIC_PATTERNS`, `createHapticChannel` and a `navigator.vibrate` call, with `tests/stacked-haptics.test.mjs` as its gate. `CAPABILITIES` (`game-manifest.mjs:35-41`) already contains `'haptics'`, so **both spellings validate and the drift would be silent** — that is why the array is pinned here rather than described. Rejected: the four-value array without `haptics` (gates §3.1, portal §5's manifest bullet), written when haptics was still conditional. |
| `ARCADE_GAMES[n].id` (runtime `gameId`) | `stacked` | Checked against all seven existing ids. **One string for everything** — HMH's three-identifier split (manifest `hard-money-heroes` / engine `lester-blaster` / slug `hard-money-heroes`) costs a translation table at every boundary and is the reason `official-profile-route.mjs` still carries a `s.gameId === 'hmh'` fixup. Chikun proved the single-string approach; STACKED copies Chikun. |
| App-shell cabinet `id` | `stacked` | — |
| `REGISTERED_GAMES` key | `stacked` | — |
| URL slug | `stacked` | Free in `ARCADE_GAME_SLUGS` and `ARCADE_GAME_IDS_BY_SLUG`. Both maps need an entry: a missing one does **not** error — `gameSlugFor` falls back to `DEFAULT_GAME_SLUG` (`hard-money-heroes`) and `gameIdForSlug` falls back to `lester-blaster`, so every STACKED run-detail link would silently point at HMH. |
| URL slug **alias** | `stack` | Goes in **`ARCADE_GAME_IDS_BY_SLUG`** only (`stack: 'stacked'`), never in `ARCADE_GAME_SLUGS`. Putting it in the wrong map is silently inert. It is never written into state, a session, or a leaderboard row; `gameSlugFor('stacked')` always returns `stacked`. |
| Cadence-leaderboard key | `stacked` | `state.cadenceLeaderboards.stacked`, created automatically by `createInitialArcadeState` from `ARCADE_GAMES` irrespective of `status`. |
| Profile progress key | `profile.progress.stacked` | Created automatically by `ensureAllGameProgress`. Durable custom stats live under `profile.progress.stacked.custom`. |
| Season id | `stacked-season-preview-1` | **Dedicated, not inherited** (owner gate G-9 recommendation): an HMH season rollover must never reset STACKED boards. Follows the only other dedicated cabinet season in the tree, `chikun-season-preview-1` — not `hmh-season-1-2026`. **Rejected: `stacked-season-1-2026`** (portal §2.1): it bakes a year into a string that must survive a rollover, and it does not match the shipped precedent. It feeds `deriveSessionSeed`, so it is frozen here. |
| Cabinet version | `STACKED_CABINET_VERSION = '0.2.0'` | Exported from `stacked-cabinet.mjs`. Versioned S-03 canonical-state correction in §4.3.1 supersedes the initial 0.1.0 stub. Feeds `buildHash` feeds the session seed. Bumping it rotates every seed. |
| Bridge protocol | `stacked-bridge/v1` | `STACKED_BRIDGE_PROTOCOL`. |
| Result-tuple tag | `stacked-result-v1` | `v` field of the result tuple. |
| Run-summary version | `STACKED_RUN_SUMMARY_VERSION = 1` | `schemaVersion` field. |
| Save/schema keys | none of its own | STACKED writes **nothing** to a new arcade save key. It rides `lesters-arcade-save-v1` / `ARCADE_PERSIST_VERSION = 3` through `state.cadenceLeaderboards.stacked` and `profile.progress.stacked`. |
| Storage key — player settings | `stacked-player-settings-v1` | Free. Sibling of the HMH pattern (`hmh-settings`). |
| Storage key — replays | `stacked-replay-v1:<sessionId>`, index `stacked-replay-v1:index` | Free. Written by `stacked-replay-store.mjs`, **outside** `snapshotArcadeState`, quota-safe, 2-replay LRU. Written **after** the score write, never before, so storage never holds a replay for a run that did not rank. |
| Storage key — Free medal shelf | `stacked-free-medals-v1` | Free. **Device-local only**; it never touches the profile, the boards, XP, rank, or achievements. |
| Board id (render slot) | `boardSlot[0]`, `boardSlot[1]` | §2.8. |
| Asset directory | `apps/portal/assets/stacked/` | Free. Particle atlas `apps/portal/assets/stacked/particle-atlas-v1.png`. Placeholder cabinet art follows the existing `apps/portal/assets/cabinet-*.svg` naming: `cabinet-stacked.svg`, `cartridge-stacked.svg`. **No `desktopCabinetSprite`** — the placeholder path is `bannerArt` fallback, per the locked owner decision. |
| Child shell | `apps/portal/stacked/index.html`, `apps/portal/stacked/game.css` | Chikun's naming (`game.css`), not HMH's `styles.css`. Serves at `/stacked/index.html`, `/stacked/game.css` (`outputDirectory` is `apps/portal`). |
| Build entry / output | entry `apps/stacked/src/main.mjs` → `dist/stacked/game.js`; worker `apps/stacked/src/verify-worker.mjs` → `dist/stacked/verify-worker.js` | `dist/stacked/` sits at the same depth as `dist/hmh-reboot/`, which is required for the relative Pixi external `'../chunks/hmh-pixi.js'` to resolve. |
| Contract entry | `apps/portal/games/stacked/main.mjs` | Re-exports the deterministic core; declared by the manifest, never imported by the portal runtime. |
| Route — cabinet entry | `/games/stacked` | Plus the alias `/games/stack`. |
| Route — active session | `/games/stacked/game-session-<id>` | Existing router shape. |
| Route — run detail | `/play/stacked/<urlSessionId>` | Built by `leaderboardDetailFor` as `/play/${gameSlug}/${urlSessionId}`. |
| Route — mode select | `/play/stacked`, `/play/stacked?devCabinets=1` | `getCartridgeSelectModel` derives `routePath` from `status === 'playable'` and `devRoutePath` from `devPlayable`. |
| CSP source | `/stacked/(.*)` | **Mandatory, and the catch-all's negative lookahead must become `/((?!(?:hmh-reboot\|chikun\|stacked)/).*)` in the same commit** — header rules match in order, and the catch-all's `frame-ancestors 'none'` makes an unlisted `/stacked/` un-iframeable with no symptom but a console violation. Base the policy on chikun's verbatim, plus `worker-src 'self' blob:` (free, closes the child case) and `frame-ancestors 'self'`. `'unsafe-eval'` is owner gate **G-6**: author strict, run the smoke, add it only on a recorded violation with the Pixi call site quoted in the ledger. |
| Cache-Control source | `/dist/(hmh-reboot\|chikun\|stacked)/(.*)` → `public, max-age=0, must-revalidate` | Must be extended in the same commit as the build change. `dist/stacked/verify-worker.js` matching no rule would mean a verifier one build behind the sim. **Never** put a STACKED artifact under `/dist/chunks/`, which is `max-age=31536000, immutable` with no content hash. |
| Service worker | add `/stacked/index.html`, `/stacked/game.css`, `/dist/stacked/game.js` to `PRECACHE_URLS`; bump `CACHE_VERSION` | `install` calls `cache.addAll(...).catch(() => {})`, so one mistyped path fails the **entire** precache silently. Verify each URL 200s before shipping. |
| Music queue key | **none in Phase 1** | `gameQueues` today holds two keys both pointing at the full 26-track list, byte-identical to `defaultQueue`. Without a `stacked` key the cabinet inherits `defaultQueue`, which is correct and indistinguishable. Add one only when it is an ordered *subset*, and only via `scripts/ingest-arcade-playlist-music.py` — a hand edit is reverted on the next asset run. |
| Achievement ids | `stacked-<slug>`, 16 of them, keys `STACKED_*` | All 16 checked against `ACHIEVEMENT_DEFINITIONS`; no collision. The two four-line-clear badges are `stacked-first-quad` and `stacked-quad-10` per §1.1. |
| Dataset flag | `document.documentElement.dataset.embeddedCabinet = 'stacked'` | Deleted on teardown **only when it still equals `'stacked'`** — chikun's guarded pattern, not HMH's unconditional `delete`. With three cabinets, an unconditional teardown clears a flag another cabinet just set. |
| Telemetry mount | `#stackedStage`, gated behind `telemetry=1` | §2.6. |
| Free-mode DOM | `#officialFreeModeOptions`, `#officialFreeStartLevel`, `#officialFreeStartLevelValue` | New markup in the shared mode-select panel; ids checked against `apps/portal/index.html`. |

**Manifest `status` stays `coming-soon` and app-shell `playable` stays `false` from S-06 through
S-21.** Only S-22 flips them, under owner gates G-1, G-2 and G-3. Board slots and progress keys are
built from `ARCADE_GAMES` irrespective of `status`, so nothing is blocked by shipping `coming-soon`.

---

## 4. Interface contracts

### 4.1 Bridge message envelope

Identical in shape to `sdk/hmh-bridge-protocol.mjs:220`, because the host, the sandbox, and the
65,536-byte cap are identical.

```js
export const STACKED_BRIDGE_PROTOCOL = 'stacked-bridge/v1';
export const STACKED_MAX_MESSAGE_BYTES = 64 * 1024;   // 65,536 — same value, same measurement
export const STACKED_GAME_ID = 'stacked';

// Every message, both directions:
{
  protocol: 'stacked-bridge/v1',
  type:     '<message type>',
  sessionId: '<matches /^[a-z0-9][a-z0-9:_-]{2,127}$/>',
  messageId: '<matches /^[a-z0-9][a-z0-9:_-]{0,63}$/>',
  payload:  { /* exact-key validated per type */ },
}
```

Size is measured as `new TextEncoder().encode(JSON.stringify(message)).byteLength` and must be
≤ `STACKED_MAX_MESSAGE_BYTES`. Every payload is validated with `exactKeys()` — **unknown and missing
keys both fail**. No payload contains a free-form object.

Parent → child, **six**: `portal:init`, `portal:settings`, `portal:pause`, `portal:resume`,
`portal:exit`, `portal:audio-frame`.
Child → parent, **five**: `game:ready`, `game:state`, `game:evidence-chunk`, `game:result`,
`game:error`.

`portal:audio-frame` is the transport for owner decision D-5's live audio analysis (visuals §2.8). It
is the same five-key envelope, under the same 65,536-byte cap, registered in the same exact-key
validator; it exists as a distinct type because it is the one parent→child message that must be
**droppable** — a missed frame is a visual stutter, never a state error. Any test asserting the
parent→child set must assert these six, not five.

```js
// portal:audio-frame payload — exact keys, all integers except the two booleans.
// 155 bytes of JSON, ~308 bytes on the wire: 212x under the message cap.
{
  audio: {
    t: 0,              // 0..1_048_575 — parent sample counter mod 2^20, for ordering + gap detection
    sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0,   // each 0..1000; the child divides by 1000
    level: 0,          // 0..1000
    onset: false,      // true if ANY onset fired in the two samples this message covers
    beatPhase: 0,      // 0..1000
    bpm: 0,            // 0, or 600..2000 (bpm x 10); 0 = no estimate
    available: false,
  },
}
```

**Rate: 30 Hz, self-imposed.** The parent samples at a fixed 60 Hz (never rAF-bound, or a throttled
background tab changes the band statistics) and sends every other sample; the child interpolates the
33 ms gap. `createMessageRateLimiter({ windowMs: 1000, maxPerWindow: 60 })`
(`apps/portal/src/arcade-sdk.mjs:235`) gates **inbound child→parent** messages only and cannot throttle
this stream, so **treat 60 messages/second as the hard ceiling for this channel in either direction**
and keep the send at 30.

`portal:audio-frame` writes only into the renderer's `audioReactive` state and **never** reaches
`simulation.update()`. That is structural, not procedural: the sim's only input is a `uint8` mask per
tick (§2.3), and `tests/stacked-projection-firewall.test.mjs` asserts an identical `resultHash` with
the channel absent, silent and loud.

```js
// portal:init payload — exact keys
{
  gameId: 'stacked',
  mode: 'free' | 'ranked',
  profile: { displayName, locale },                       // exact keys
  session: { seed, buildHash, seasonId, rankedEligible },  // exact keys — LOCKED, see below
  settings: { /* startLevel, handling, video, controls — never session data */ },
}
```

The `session` block is exact-key validated as exactly `['seed', 'buildHash', 'seasonId',
'rankedEligible']`, mirroring `sdk/hmh-bridge-protocol.mjs:106`. `rankedEligible` must equal
`mode === 'ranked'`. **`startLevel` rides in `settings`, never in `session`** — that is what
structurally prevents a Free-mode start level from reaching the seed, since `deriveSessionSeed` takes
only `{ sessionId, gameId, seasonId, buildHash }` (`arcade-core.mjs:5194-5196`).

```js
// game:evidence-chunk payload — exact keys. Sent, in order, BEFORE game:result.
{
  chunkIndex,     // int, 0-based, contiguous
  chunkCount,     // int, 1..STACKED_MAX_EVIDENCE_CHUNKS
  totalRawBytes,  // int, 1..STACKED_MAX_EVIDENCE_BYTES
  payload,        // base64 string, length <= STACKED_EVIDENCE_CHUNK_B64_CHARS (56,000)
}
```

The chunk **cannot** ride `game:run-event`: that payload is exact-keyed
`['tick','sequence','eventType','value']` with `value` validated as a finite *number*, and a base64
chunk is a string. The parent reassembles and rejects on: a missing index, a duplicated index, a
`chunkCount` mismatch, a `totalRawBytes` mismatch, more than `STACKED_MAX_EVIDENCE_CHUNKS`, a
reassembled length over `STACKED_MAX_EVIDENCE_BYTES`, a bad `"SIC1"` magic, or a header-checksum
mismatch — all **before** any decode or simulation work.

### 4.2 The seed record

The parent mints it; the child never replaces it, never requests it, and never forwards a nonce.

```js
// apps/portal/src/arcade-core.mjs:5194-5236 — existing, unchanged
deriveSessionSeed({ sessionId, gameId, seasonId, buildHash }) -> uint32   // FNV-1a-32

// The record STACKED's Ranked wrapper produces and pins for the whole run:
Object.freeze({
  sessionId:  'game-session-000000042',       // parent-minted, canonical
  gameId:     'stacked',
  seasonId:   'stacked-season-preview-1',
  buildHash:  'site-<v>:game-<v>:cabinet-0.1.0',  // includes STACKED_CABINET_VERSION
  seed:       305419896,                      // uint32, deriveSessionSeed(...) of the four above
  fixedStepHz: 60,
  maxTicks:   432000,
  mode:       'ranked',
})
```

`startStackedRankedSession` forwards **no caller-supplied nonce**, which closes the in-product
seed-shopping path. It does not close the console path — nothing client-side can, and the UI must say
so rather than claim a protection that does not exist. The RNG is split into named substreams at
session start: `createSeededSubstreams(seed, ['bag', 'garbage', 'zone'])`, so adding a future consumer
cannot shift an existing stream.

### 4.3 The result tuple (what the replay hash covers)

`buildStackedResultTuple(state)` returns integers and short enum strings **only** — no floats, no
nested objects, no arrays. Hashed as `await sha256Hex(canonicalSessionJson(tuple))`;
`canonicalSessionJson` (`apps/portal/src/session-integrity.mjs:14`) recursively key-sorts before
`JSON.stringify`, which removes the key-order fragility Chikun's `sameJson` comparison carries.

```js
{
  v: 'stacked-result-v1',
  gameId: 'stacked',
  seed: 305419896,                 // uint32
  buildHash: 'site-1.3.0:game-1.3.0:cabinet-0.1.0',
  seasonId: 'stacked-season-preview-1',
  ticks: 144000,                   // total simulated ticks — the ONLY time quantity in the tuple
  pieces: 6006,                    // pops from the queue
  lines: 1712,
  level: 30,
  score: 9864300,
  quadClears: 312,
  spins: 88,
  perfectClears: 3,
  maxCombo: 21,
  maxBackToBack: 47,
  garbageRowsReceived: 190,
  garbageGroups: 91,               // groups, not rows — one RNG draw each
  garbageRowsCleared: 176,
  holdsUsed: 1902,
  bagRefills: 860,                 // exact: 2 + floor(pieces / 7)
  bagDraws: 5160,                  // >= 6 * bagRefills
  garbageDraws: 91,                // >= garbageGroups
  transitionCount: 48000,          // from the SIC1 header; also gated pre-re-simulation
  boardHash: '0x<64 hex>',         // 66 chars, sha256Hex of the packed final board
  terminalReason: 'block-out',     // one of STACKED_TERMINAL_REASONS
}
```

Changes from integrity §4.2, for the record: `frames` → `ticks` (§1.2); `fourLineClears` →
`quadClears` (§1.1); `topOutReason` → `terminalReason` with the five-value enum (§1.3);
`seasonId` per §3.

**Those numbers are a shape example, not a balance prediction.** The tuple above is an internally
consistent illustration of field types, magnitudes and the §4.4 cross-field identities — it is what a
validator author and a codec author need. It is **not** the difficulty model's output: mechanics §10
predicts a god-tier run near `5–6 × 10^7`, five to six times the `9864300` shown here, and mechanics §9
is the authority on score magnitude. Nothing may be tuned against this tuple, and integrity's
`maxScore` commentary is calibrated against it only as an arithmetic reference point.

Three hashes, three jobs, never conflated:

| Name | Algorithm | Covers | Job |
| --- | --- | --- | --- |
| `streamChecksum` | FNV-1a-32, in the SIC1 header | body bytes | Truncation/corruption in storage. **Not** security. |
| `inputHash` | `sha256Hex` | the full binary SIC1 stream | Binds the stream to the claim |
| `resultHash` | `sha256Hex` | `canonicalSessionJson(tuple)` | The value the verifier reproduces |

`sha256Hex` (`session-integrity.mjs:43`) is **async** and returns a `0x`-prefixed **66-character**
string, not bare 64 hex. It takes a `{ cryptoProvider }` seam, so it runs identically under browser
Web Crypto and Node ≥ 18. Reuse it; do not write a fourth hash. The full 66-char `resultHash` goes in
the replay blob; the persisted leaderboard row carries only `resultHash16`, its first 16 hex
characters — enough to answer "does this row correspond to this stored replay", and **not** enough
for anything adversarial. Never describe `replayDigest64` or `streamChecksum` as a commitment; both
are FNV-derived, not cryptographic.

All hashing happens in the lifecycle **before** `recordScore`, which stays synchronous. The parent
re-simulates **exactly once**, in `createStackedPortalLifecycle().handleResult()`, in a Web Worker
when one can be constructed and inline otherwise; verification correctness never depends on the worker
existing. **The score written to the leaderboard is `canonical.score` from the parent's own
re-simulation, never the number the child sent.**

### 4.3.1 Versioned S-03 canonical-state correction

Cabinet version **0.2.0** supersedes the incomplete canonical state-hash sequence in versus §2.7. This is a deliberate, review-gated correction under DECISIONS.md's interpretation rule, not a gameplay-tuning change. A public-input witness with seed 1/start level 15 accepts HOLD in two runtimes, then holds mask 128 in one and releases to mask 0 in the other until the first piece locks. At tick 31 the old hashes matched despite different previous masks; the same next HOLD input produced different hold counts. Immutable start level, terminal ceiling and injected attack configuration also need hashing before they change future steps.

The existing golden replay produces an unchanged exact result tuple. Its observed canonical hash moves from `3232793281` (0.1.0) to `1015998860` (0.2.0). This explicitly replaces hash identity, never silently changes the fixture. The historical fixture migration remains recorded. Full Node gates and independent review of the new exact source are still required before acceptance.

The result source validator additionally requires explicit valid `maxTicks`, exact tick-ceiling identity, and `holdsUsed <= piecesSpawned`. Returned result-tuple keys do not change.

Injected attack tables remain test/internal Phase-2 preparation, never imported into Phase-1 runtime by default. Constructors validate dense arrays and safe integers before creating boards. Individual row parameters and the largest combined send (max base/full/mini entry + CHAIN bonus + maximum combo bonus + perfect-clear bonus) must be at most `STACKED_MAX_LINES`; charge delay at most `STACKED_MAX_TICKS`; per-lock rise cap `1..BOARD_ROWS`; queue-pressure threshold `0..STACKED_MAX_LINES`. Optional version is a string of at most 128 characters (nullish means empty), and qualifiers must be dense supported enum arrays. Bounds use existing central constants and do not retune the frozen attack table.

Seed-zero normalization and rejection-sampling cursor advancement retain the explicit mechanics/integrity rules. The perfect-clear summary ceiling in §4.4 is unchanged pending any demonstrated legal-runtime contradiction.

#### Solo runtime canonical state encoding — SRT2

`stateHash()` is FNV-1a-32 over the following byte stream. All multi-byte integers are low-byte-first. Unsigned counters use uint32; score uses uint64. Passing a negative value to a uint32 slot means its explicit two's-complement 32-bit representation, so `-1` is `ff ff ff ff`. Booleans and enums are one byte. Piece ids are `0=null, 1=I, 2=J, 3=L, 4=O, 5=S, 6=T, 7=Z`. Terminal ids are `0=nonterminal`, followed by `STACKED_TERMINAL_REASONS` in its frozen order as ids 1–5.

The pre-correction sequence remains an exact prefix:

1. `tick:u32`.
2. Raw 240-byte board.
3. Six `u32` active slots: piece id, signed x, signed y, gravity accumulator, rotation, active spawn tick; all zero if no active piece.
4. `piecesSpawned % 7:u32`, then bag RNG draw count `u32`.
5. Hold piece id byte and `holdUsed` boolean byte.
6. For each pending solo-garbage hole, the historical entry `rows:u32=1`, `chargeReadyTick:u32=0`, `hole:byte`; this historical section has no new delimiter.
7. Garbage RNG draw count `u32`, historical previous-hole byte (`255` for `-1`), derived zone index `u32`, `comboCount:i32`, CHAIN boolean byte, lines `u32`, score `u64`.

The correction appends these bytes without changing that prefix:

1. Marker `53 52 54 02` (`SRT` plus encoding version 2).
2. Immutable `seed:u32`, `startLevel:u32`, `maxTicks:u32`.
3. Full `piecesSpawned:u32`, `piecesLocked:u32`, `bagRefills:u32`.
4. Next-piece queue as `length:u32` followed by exactly that many piece-id bytes. Together with the historical bag cursor (`piecesSpawned % 7`) and bag RNG count, this fixes future bag state.
5. Active/lock provenance: `lastKickIndex:byte`, `lastActionWasRotation:boolean-byte`, `lockTimer:u32`, `lockResetsUsed:u32`, `lowestYReached:i32`; all zero when no active piece. Active identity, position, rotation, gravity and spawn tick remain authoritative in the prefix.
6. Input history: `prevMask:byte`, `lastHorizontal:i32`, `lastTransitionTick:u32`.
7. Hold/result counters: `holdsUsed:u32`, `softDropCells:u32`, `hardDropCells:u32`.
8. Scoring state: `maxCombo:u32`, `backToBackCount:u32`, `maxBackToBack:u32`, `hashpower:u32`. Current combo, CHAIN, lines and score remain in the prefix.
9. Solo garbage state: `garbageTimerTicks:i32`; pending queue `length:u32` followed by hole bytes; `lastGarbageHole:i32`; then `garbageGroups:u32`, `garbageRowsReceived:u32`, `garbageRowsCleared:u32`, `reorgsRejected:u32`. The corrected queue length makes its boundary unambiguous; historical garbage RNG count remains in the prefix.
10. Clear/technique counters, each `u32`: `quadClears`, `singles`, `doubles`, `triples`, `spinsMini`, `spinsFull`, `perfectClears`, `maxStackHeight`.
11. Evidence counters: `transitionCount:u32`, `encodedEvidenceBytes:u32`.
12. Terminal-reason enum byte.

`buildHash` and `seasonId` are intentionally excluded because they are metadata and cannot affect simulation. Projection state is excluded. The following snapshot aliases are not repeated because they are exactly derivable: `piecesPlaced = piecesLocked`, `linesCleared = lines`, `bagDraws = bagRngCount`, and `terminal = terminalReason !== null`. `level` is exactly `levelForLines(startLevel, lines)`, and the zone index is exactly `zoneForTick(tick)`; both are derivable, while the historical zone index remains in the prefix. `terminalResult` is a memoized projection of the terminal snapshot and cannot affect future execution.

#### Match canonical state encoding — SMH2

A one-board match with `attackTable:null` and no pending attack continues to return the solo runtime hash exactly, with no wrapper bytes.

Every other match hashes this unambiguous stream with FNV-1a-32:

1. Marker `53 4d 48 02` (`SMH` plus encoding version 2), then match `tick:u32`.
2. Attack-table presence byte. `0` ends this section. For `1`, encode in fixed order: UTF-8 version as `byteLength:u32 + bytes`; base, full-spin, and mini-spin arrays each as `length:u32 + u32 entries`; `backToBack:u32`; `backToBackMinLines:u32`; qualifier count `u32` plus enum bytes (`1=quad, 2=spin-full, 3=spin-mini`); combo as `length:u32 + u32 entries`; then `perfectClear`, `chargeTicks`, `maxRowsPerLock`, and `queuePressureThreshold` as `u32`.
3. Board count `u32`. For each ascending player slot: solo canonical bytes as `byteLength:u32 + bytes`; pending-attack count `u32`; then each entry in queue order as `rows:u32`, `chargeReadyTick:u32`, and `holeColumns` as `length:u32 + bytes`.
4. Match garbage RNG draw count `u32`, then `lastGarbageHole:i32` using explicit two's-complement encoding.

The table is immutable canonical configuration because it changes future attacks even before any queue exists. Lengths separate every board, queue, table array, string and hole sequence. Match input-ring slots are empty at every public API boundary because `stepAll` consumes each slot synchronously before returning. `generatedSends` is reset before its next read and therefore cannot affect a later step; neither is encoded.

### 4.4 The run summary payload

`sdk/stacked-run-summary-schema.mjs`, sibling of `sdk/hmh-run-summary-schema.mjs`. Exact-key
validation at every level, integer bounds on every numeric, no free-form objects, DOM-free.

```js
{
  schemaVersion: 1,
  identity:  { seed, buildHash, mode, seasonId, terminalReason, startTick, endTick },
  totals:    { score, survivalTicks, elapsedMs, level, zoneReached, pieces, linesCleared },
  clears:    { singles, doubles, triples, quadClears, perfectClears, allClearStreakMax },
  technique: { spins, spinClears, maxCombo, maxBackToBack, holds, hardDrops, softDropCells },
  pressure:  { garbageRowsReceived, garbageRowsCleared, maxStackHeight, topOutTick },
  handling:  { dasTicks, arrTicks, dcdTicks, inputDevice },
  versus:    { wins, losses, draws, garbageSent, garbageReceived, kos, roundsPlayed },
}
```

Seven blocks plus `schemaVersion`; 42 fields. Two changes from portal §7: `clears.halvings` → `clears.quadClears`
(§1.1), and the new `handling` block — **metadata only, never hashed, never ranked, never fed to the
verifier**. It exists because DAS/ARR live outside the sim (§2.3), so they cannot be recovered from
the stream, and G-19's cross-device fairness question cannot be answered without them.
`inputDevice ∈ 'keyboard' | 'touch' | 'gamepad' | 'mixed'`.

Bounds. **Every numeric field is a non-negative integer, and there are no floats anywhere in the
summary** — float quantization is what makes Chikun's `finalState` comparison fragile. **Five fields
are strings**, each bounded by a pattern or an enum in the table below: `identity.buildHash`,
`identity.mode`, `identity.seasonId`, `identity.terminalReason`, `handling.inputDevice`. A validator
written from the sentence rather than the table would reject every legal summary.

| Field | Bound |
| --- | --- |
| `identity.seed` | `0..0xffffffff` |
| `identity.buildHash` | `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/` |
| `identity.mode` | `'free' \| 'ranked'` |
| `identity.seasonId` | `/^[a-z0-9][a-z0-9-]{1,63}$/` |
| `identity.terminalReason` | `STACKED_TERMINAL_REASONS` |
| `identity.startTick`, `endTick` | `0..STACKED_MAX_TICKS`, `end >= start` |
| `totals.score` | `0..STACKED_MAX_SCORE` |
| `totals.survivalTicks` | `0..STACKED_MAX_TICKS` |
| `totals.elapsedMs` | `0..STACKED_MAX_ELAPSED_MS`, must equal `round(survivalTicks * 50 / 3)` ± 1 |
| `totals.level` | `1..STACKED_LEVEL_CAP` |
| `totals.zoneReached` | `1..STACKED_ZONE_COUNT` |
| `totals.pieces` | `0..STACKED_MAX_PIECES` |
| `totals.linesCleared`, `clears.singles/doubles/triples` | `0..STACKED_MAX_LINES` |
| `clears.quadClears` | `0..STACKED_MAX_QUAD_CLEARS` (21,600) |
| `clears.perfectClears` | `0..STACKED_MAX_QUAD_CLEARS` |
| `clears.allClearStreakMax` | `0..1000` |
| `technique.spins`, `holds`, `hardDrops` | `0..STACKED_MAX_PIECES` |
| `technique.spinClears`, `maxCombo`, `maxBackToBack` | `0..STACKED_MAX_LINES` |
| `technique.softDropCells` | `0..STACKED_MAX_PIECES * BOARD_ROWS` |
| `pressure.garbageRowsReceived`, `garbageRowsCleared` | `0..STACKED_MAX_LINES` |
| `pressure.maxStackHeight` | `0..BOARD_ROWS` (24 — **not** 40) |
| `pressure.topOutTick` | `0..STACKED_MAX_TICKS` |
| `handling.dasTicks` | `4..18` |
| `handling.arrTicks` | `1..6` |
| `handling.dcdTicks` | `0..8` |
| `versus.*` | `0..100_000` — **reserved; every one of the seven is exactly `0` in Phase 1 and the validator rejects any other value** |

Cross-field rules the validator enforces — **eleven**, matching portal §7.2, which derives them:

1. `singles + 2*doubles + 3*triples + 4*quadClears === linesCleared` — **exact**, not `<=`. A future
   mechanic clearing lines outside those four categories bumps `schemaVersion`.
2. `spinClears <= linesCleared` and `spins <= pieces`.
3. `holds + hardDrops <= pieces * 2`.
4. `garbageRowsCleared <= garbageRowsReceived`.
5. `endTick - startTick === survivalTicks`.
6. `linesCleared <= floor(pieces * 4 / 10) + garbageRowsReceived` — REORG rows add clearable cells the
   player never placed.
7. `level === min(STACKED_LEVEL_CAP, 1 + floor(linesCleared / 10))` **in Ranked only** — Free runs may
   start above level 1.
8. `elapsedMs === round(survivalTicks * 50 / 3) ± 1`.
9. `topOutTick <= endTick`, and `topOutTick === endTick` when `terminalReason` is `'block-out'`,
   `'lock-out'` or `'garbage-out'`.
10. `endTick === STACKED_MAX_TICKS` when `terminalReason === 'tick-ceiling'`.
11. Every `versus.*` field is exactly `0` while `schemaVersion === 1`.

Rules 5 and 8 together are what make pause safe in Ranked: `elapsedMs` is a function of `survivalTicks`
and never of a wall clock, and `survivalTicks` is `endTick - startTick`, so a paused tick is a tick that
never happens and cannot inflate survival, ranking, or the tick ceiling.

**The 16-key `runStats` projection** — the only fields persisted into a cadence leaderboard row.
Everything else is present in the bridge payload and the verification pass and is then discarded, to
halve the persisted row (`state.cadenceLeaderboards` is the quota pressure named in R-12):

```
score, linesCleared, survivalTicks, maxCombo, quadClears, level, zoneReached, pieces,
spins, spinClears, maxBackToBack, perfectClears, garbageRowsReceived, terminalReason,
resultHash16, trust
```

Leaderboard columns (6, sort key first): `score` · `linesCleared` (`LINES`) · `survivalTicks`
(`SURVIVED`, rendered `ticks/60`) · `maxCombo` (`COMBO`) · `quadClears` (`HALVING`) · `level` (`LVL`).

**Where the reserved two-player fields live, and where they do not.** `summary.versus` — the object of
seven integer zeros above — is the **only** place they exist in Phase 1. They are **not** in the
`game:result` payload (§4.5 freezes it at exactly seven top-level keys), **not** in the 16-key
`runStats` projection, **not** in `progress.stacked.custom` (portal §2.5 freezes that at exactly eleven
keys, and `tests/stacked-achievements.test.mjs` / S-20 assert the exact set), and **not** on any Phase 1
surface: a solo-only board showing "0-0" for every player is worse than showing nothing (portal §7.4).
`versus: null` on the payload or in `runStats`, and `custom.versus`, are the rejected variants — see
§1.2's last row. When Two Player ships, the additions are a `schemaVersion` bump plus a
`roundsPlayed` key in `runStats`, a `roundsPlayed` accumulator in `reduceProgress`, and a
"Record: W-L" profile cell rendered behind `custom.roundsPlayed > 0`; `custom` moves from eleven keys
to twelve **in that commit and not before**.

### 4.5 The child → parent result payload

```js
// game:result payload — exact keys, validated before any simulation work
{
  v: 'stacked-run-payload-v1',
  score: 9864300,          // int >= 0; compared against canonical, never trusted
  evidenceDigest: '0x…',   // 66 chars — sha256Hex of the reassembled SIC1 stream (inputHash)
  totalRawBytes: 52828,    // must equal the reassembled length
  tuple: { /* §4.3 */ },
  summary: { /* §4.4 */ },
  runStats: {              // NOT hashed, NOT ranked, NOT re-simulated — projection telemetry only
    pauseCount, pausedWallClockMs, sampledTicksPerSecond,
    qualityTier, reducedMotion, droppedInputs, degradationLevel,
  },
}
```

The stream itself does **not** travel in this message — it arrived as `game:evidence-chunk` messages
(§4.1). Validation order, all before any decode:

1. Exactly these seven top-level keys.
2. `v === 'stacked-run-payload-v1'`.
3. Chunks reassembled, contiguous, `totalRawBytes` matched, `"SIC1"` magic present, header checksum
   valid, length ≤ `STACKED_MAX_EVIDENCE_BYTES`.
4. `tuple` field-list exact, every numeric a non-negative safe integer, `terminalReason` in the enum.
5. `summary` passes `validateStackedRunSummary`.
6. `validateStackedRunPlausibility` on the submitted numbers — the cheap pre-filter pass.

Only then is the stream decoded and re-simulated. A failure at any step is `verdict: 'rejected'` and
the reason code is the step that failed. `validateStackedRunPlausibility` takes exactly sixteen
fields:

```js
validateStackedRunPlausibility({
  score, pieces, lines, level, maxCombo, quadClears, perfectClears, ticks,
  garbageRowsReceived, garbageRowsCleared, garbageGroups, garbageDraws,
  holdsUsed, bagRefills, bagDraws, transitionCount,
})
// -> Object.freeze({ ok, verdict, rankable: !rejected, flags, ceilings })
//    verdict in 'ok' | 'suspicious' | 'rejected'
//    flags shaped { code, severity, detail } to match leaderboardRowTrust's tooltip renderer
```

---

## 5. Unresolved — owner decisions required

Everything above is frozen. These five are not, and each is stated as a question with options and a
recommendation. **Do not fake, mock, or work around any of them.** Each also names what it blocks.

### 5.1 G-1 — the player-facing name for the four-line clear

**Question.** Is the display name `HALVING`?

**Options.** (a) `HALVING` — thematic, one word, already used by two sections. (b) `LEDGER BLOCK` —
versus's choice; two words, does not fit a fixed-width leaderboard header, and "ledger" is already
taken by the rising-ledger mechanic. (c) something new.

**Recommendation: (a) `HALVING`, and it is safe to defer.** §1.1 deliberately decouples the display
name from `quad`, the technical root used by the schema field, the achievement ids, the particle
preset id, and the flag code. **Changing the display name after this point touches copy strings and
achievement *titles* only — no id, no schema field, no seed, no stored replay.** That is the whole
point of the decoupling and it is why this is the one owner gate that does not block S-02. It blocks
only the copy sheet and the S-22 ship gate.

### 5.2 Six zones or five, and whether the five placeholder palettes ship (G-18)

**Question.** The locked decision says "5–6". Every draft and the visual baseline set assume 6, and
only zone 0's palette is specified numerically. The other five must satisfy hard constraints
(red-ratio, deep-stop luminance, bloom ceiling ≤ 0.35, every mino colour at relative luminance
≥ 0.19 — which rules out very dark blues and purples). Is a real art pass in Phase 1 scope?

**Options.** (a) Six zones, labelled placeholder palettes for 1–5, replaced in a later art cycle.
(b) Six zones with a real art pass now. (c) Five zones.

**Recommendation: (a).** `STACKED_ZONE_COUNT = 6` is frozen at 6 in §2.1 on that basis, because the
count feeds a run-summary bound and cannot float. Dropping to five later is a bound change and a
`STACKED_CABINET_VERSION` bump; the placeholder palettes are data and cost nothing to replace.
Blocks S-13 and S-21. **Related feel question, not blocking:** zone 5 at ~25 minutes means most
players never see the payoff zone, and a beginner sees only one zone in a 2–3 minute run.

### 5.3 Whether `SPAWN_DELAY_TICKS` stays `0`

**Question.** This is the one place where a frozen mechanics constant materially weakens the
integrity gate, and neither section noticed because they were written in parallel.

With `SPAWN_DELAY_TICKS = 0` and `LINE_CLEAR_DELAY_TICKS = 0` (mechanics §5, frozen in §2.1), the
true placement floor is **2 ticks per piece**, so `STACKED_MAX_PIECES = 216_000` and
`STACKED_MAX_LINES = 86_400`. Integrity §5.1 calls `maxLines` "the strongest bound in the whole
gate" — and it was computed against a 7-tick floor that no longer exists. The frozen bounds are
**3.5× looser** than integrity assumed. They are *correct* — a tighter bound would reject legal runs,
which is the exact failure these constants exist to prevent — but the gate is weaker than its author
believed.

**Options.** (a) Keep `0`. Competitive feel is preserved; `maxLines` stays loose and `maxPieces`,
`expectedBagRefills` and `maxGarbageRowsReceived` carry more of the gate's weight.
(b) Set `SPAWN_DELAY_TICKS = 2` (a conventional ARE for this genre) and `LINE_CLEAR_DELAY_TICKS = 0`.
The placement floor becomes 4 ticks, `maxPieces` halves to 108,000 and `maxLines` halves to 43,200 —
a 2× tighter gate — at the cost of 33 ms of dead time per piece that expert players will feel.

**Recommendation: (a), keep `0`, and say so in the ledger.** Feel is a shipped property and gate
tightness is not; and `maxLines` was never the discriminating test — integrity itself concedes
`maxScore` is ~11.5× loose. The bounds that actually bite (`bag-refill-mismatch`,
`garbage-exceeds-rise-rate`, `level-inconsistent-with-lines`) are unaffected. What is **not**
acceptable is leaving integrity's 7-tick figure in place: it would reject legal runs. Blocks S-03 and
S-18.

### 5.4 G-4 — confirmation that the caps ship

**Question.** `STACKED_LEVEL_CAP = 30` and `STACKED_COMBO_BONUS_CAP = 20` are frozen in §2.1 on the
phasing recommendation. The owner should see the consequence before ship, because it is a design
consequence and not only an integrity one.

**The consequence, stated plainly.** With a level cap, score above level 30 grows linearly with
survival time, so **the leaderboard ranks endurance with score as a skill weighting**. A 35-minute
competent run will generally outscore a 12-minute brilliant one. That is a real design choice and it
is the one the owner's "score is the sort key, indefinite until top-out" decision implies; it is
worth confirming rather than discovering.

**Recommendation: ship both caps.** An uncapped combo makes the score ceiling quadratic in clears and
removes a real integrity check for no design gain; an uncapped level makes `maxScore` unbounded and
`level-inconsistent-with-lines` impossible. If the endurance ranking is unwanted, the fix is a
secondary sort or a separate board, not an uncapped multiplier. Blocks nothing (the values are
frozen), but a reversal after S-03 rotates every seed.

### 5.5 G-19 — cross-device Ranked fairness

**Question.** One board, an input-device column or filter, or a separate touch board?

A keyboard player gets DAS wall-charge and a hard 1-tick ARR floor. A gesture-touch player gets
neither — §2.3 freezes `STACKED_MAX_MOVE_STEPS_PER_TICK = 1`, so a fast drag banks steps in a queue
and drains one per tick, and touch sensitivity still varies ~1.6× to 0.9× across devices because the
move-step floor is in CSS px. A mid-run rotation changes it again.

**Options.** (a) One board, `handling.inputDevice` shown as a column. (b) One board with a device
filter. (c) Separate boards.

**Recommendation: (a).** §4.4's `handling` block already records `dasTicks`, `arrTicks`, `dcdTicks`
and `inputDevice` for exactly this purpose, so the data to decide from is collected from run one, and
a column is reversible where a board split is not. This is a competitive-fairness call, not a
technical one — and the ledger for S-15 must **not** describe its determinism proof as a fairness
proof. Determinism and parity of difficulty are different claims. Blocks S-20's column set.

---

### Deferred owner gates not restated here

G-2 (flip to playable), G-3 (enable Ranked writes), G-5 (Pixi vendor chunk policy), G-6 (child CSP
`'unsafe-eval'`), G-7 (Ranked pause policy), G-8 (achievement scoping), G-10 (Free Mode aids), G-11
(ghost piece on in Ranked — recommendation **on**, and it is a one-line presentation change either
way), G-12 (where cabinet settings live), G-13 (gate placement), G-14 (committed dev autoplay), G-15
(deployment promotion), G-16 (online-multiplayer backend), G-17 (`pruneCadenceLeaderboards`
destructiveness) all live in `docs/stacked/DECISIONS.md` with their exact asks. None of them changes
a value in §1–§4, which is why they are not in §5.

**Explicitly not requested anywhere in this document and not up for a gate here:** paid entry, a
non-zero `entryFeeMicroUsdc`, settlement activation, contract deployment, or a production promotion.
`SETTLEMENT_LIVE` stays `false`, `entryFeeMicroUsdc` stays `DEFAULT_ENTRY_FEE_MICRO_USDC` (`0`), and
`devWallet` stays `null`. Those require a separate explicit HALT approval naming the exact action and
candidate.
