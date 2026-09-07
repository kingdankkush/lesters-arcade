# STACKED — Ranked Integrity, Seeding & Replay Verification

> Precedence: `../STACKED-CONTRACTS.md` overrides this specification wherever they disagree.

**Scope.** Authority for six things and nothing else: how a Ranked seed is issued and bound; how input is
recorded into the `SIC1` codec and shipped to the parent; how the parent deterministically re-simulates that
stream and hashes the result; the plausibility gate; the trust verdict on a leaderboard row; and the threat
model. Board rules, scoring tables, gravity, garbage cadence, handling defaults, layout, particles and CSP
live in `mechanics.md`, `visuals.md`, `mobile.md`, `portal.md`, `versus.md` and `gates.md`. Every constant
named here is frozen in `docs/stacked/STACKED-CONTRACTS.md` and exported from
`apps/portal/src/stacked-contracts.mjs`; where this document and the contract disagree, the contract wins.
Every file path and line number was read in the working tree at `ff2934db`.

**Honest summary.** This makes a *forged* run expensive — you must produce a consistent input stream that
deterministically re-simulates to the claimed score — and a *tampered* run (edit the number, edit the save)
cheap to detect. It does not prove a human played, and it does not stop an attacker who runs the real
simulation headlessly with synthetic inputs, because every check runs in JavaScript the player controls.

**Contents.** 0 Transport · 1 Seed ownership · 2 Seeded RNG · 3 The `SIC1` codec, its ceilings and transport ·
4 Deterministic re-simulation, the result tuple, sim purity · 5 Plausibility gate and trust verdict ·
6 Files and tests · 7 Threat model · 8 Preconditions for value · 9 Open questions owned here

---

## 0. Transport

STACKED runs in a **sandboxed iframe behind `postMessage`**, like both existing cabinets:
`apps/portal/src/hmh-reboot-host.mjs:112-126` builds
`<iframe sandbox="allow-scripts allow-same-origin allow-pointer-lock" src="{origin}/hmh-reboot/index.html">`;
`apps/portal/src/chikun-host.mjs:87-97` does the same for `/chikun/index.html`. The message cap is **65,536
bytes** in all three (`sdk/hmh-bridge-protocol.mjs:4`, `apps/portal/src/chikun-bridge-protocol.mjs:2`,
`AGENTS.md:34`).

Two corrections to an earlier draft of this section, stated rather than quietly swapped:

1. **The in-process claim is void.** That draft asserted STACKED followed `createInProcessGameAdapter` and
   handed the parent a live `Uint8Array` — no serialization, no chunking, no envelope validator. That is the
   *legacy* HMH path, not the cabinet path. Every consequence it drew ("the 64 KiB cap does not apply",
   "design chunking later") is dead. **Evidence is chunked from day one** (§3.5).
2. **The bridge validator exists and is load-bearing.** `exactKeys()` (`sdk/hmh-bridge-protocol.mjs:29`,
   `chikun-bridge-protocol.mjs:16`) rejects unexpected **and** missing keys; STACKED's protocol module reuses
   it verbatim. The lifecycle still re-validates the reassembled payload (§4.6): the envelope check bounds
   message shape, not run semantics.

The evidence chunk **cannot** ride `game:run-event` — that payload is exact-keyed
`['tick','sequence','eventType','value']` with `value` validated as a finite number
(`sdk/hmh-bridge-protocol.mjs:193-197`), and a base64 chunk is a string. It gets its own message type.

---

## 1. Seed ownership and binding

The parent owns the seed. The child never generates, rerolls, or offers a choice of seed in Ranked.
`startPlaySession` (`apps/portal/src/arcade-core.mjs:5205`) already does the right thing, unchanged:

```js
// arcade-core.mjs:5234-5236, verbatim
const buildHash = `site-${SITE_VERSION}:game-${GAME_VERSION}${game.cabinetVersion ? `:cabinet-${game.cabinetVersion}` : ''}`;
const seasonId = game.rankedSeasonId ?? CURRENT_RANKED_SEASON_ID;
const seed = deriveSessionSeed({ sessionId: canonicalSessionId, gameId, seasonId, buildHash });
```

`deriveSessionSeed` (`arcade-core.mjs:5194`) is FNV-1a-32 over
`[sessionId, gameId, seasonId, buildHash].join('|')` returning `hash >>> 0`, throwing if any part is empty
after `String(...).trim()`. The seed is a **pure function of the session identity** — derived, not random —
which is what makes re-rolling detectable rather than merely discouraged. STACKED's `rankedSeasonId` is
`stacked-season-preview-1`, dedicated so an HMH season rollover can never reset STACKED boards.

For Ranked (`isPaid`), `canonicalSessionId` is `urlSessionId ?? createCanonicalSessionHandle({ uuid: nonce })`
(`arcade-core.mjs:5230-5232`). `createCanonicalSessionHandle` (`session-integrity.mjs:39`) prefixes
`game-session-` and runs the value through `normalizeUuid` (`:24`), requiring
`/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`. `nonce` is
`sessionNonce ?? randomNonce`, and `randomNonce` falls back to
`` `${Date.now()}-${Math.random().toString(16).slice(2)}` `` when `crypto.randomUUID` is missing
(`arcade-core.mjs:5227-5229`) — not a UUID, so `normalizeUuid` throws. **A Ranked session cannot be created
without `crypto.randomUUID` unless the caller supplies `urlSessionId`**, which bypasses
`createCanonicalSessionHandle` entirely; STACKED's wrapper never supplies it, so "no `randomUUID`, no Ranked"
holds absolutely here. (`secureUuid()` at `session-integrity.mjs:32` also throws, but `normalizeUuid` fires
first because `startPlaySession` always passes a `uuid`.)

**Anti-reroll rule.** The verifier does not trust a submitted seed; it recomputes it:

```js
// apps/portal/src/stacked-portal-lifecycle.mjs (NOT stacked-cabinet.mjs — §4.1, import direction)
if (deriveSessionSeed({ sessionId, gameId: 'stacked', seasonId, buildHash }) !== claim.seed) {
  throw new Error('stacked: replay seed is not derivable from the session identity');
}
```

**Seed shopping is free and offline.** `startPlaySession` accepts caller-supplied `urlSessionId` and
`sessionNonce` (`arcade-core.mjs:5210, 5212`), and `deriveSessionSeed` is a 32-bit FNV-1a over a short
string. A devtools console enumerates millions of valid UUIDs per second, computes each resulting seed
locally with no simulation, and picks the identity whose first bags it likes — no session starts, no
abandoned checkpoints, no timing signal. Three Phase-1 mitigations, none of which close it:

| Rule | Where | Effect |
|---|---|---|
| Ranked start forwards no `sessionNonce` and no `urlSessionId` | `startStackedRankedSession()` in `stacked-portal-lifecycle.mjs`, calling `startPlaySession({ wallet, gameId: 'stacked', mode: 'paid' })` and nothing else | Removes the in-product path to a chosen seed. Not the console path. |
| One live Ranked session per wallet | `state.activeSessionCheckpoint`, persisted (`persistence.mjs:27-51`) | Abandoning to reroll leaves an unsubmitted checkpoint the next start must resolve |
| Abandoned-start counter | `profile.progress.stacked.custom.abandonedRankedStarts` | Review signal, not a block |
| Say in the UI that reroll is free and invisible | mode-select Ranked copy | Do not claim a protection we do not have |

**STACKED must call that checkpoint plumbing itself.** `saveActiveSessionCheckpoint` and
`clearActiveSessionCheckpoint` are `persistence.mjs:152` and `:165`; the only caller in the tree is
`checkpointCurrentSessionEvidence` (`apps/portal/main.js:2666-2676`, driven from `:6931`), guarded on
`currentSession?.isPaid` and reading `combat.frame` — HMH-specific, never fires for a cabinet. Chikun has no
checkpoint. So `state.activeSessionCheckpoint` is `null` for every cabinet run today:
`startStackedRankedSession` calls `saveActiveSessionCheckpoint(state, { sessionId, stepIndex: 0 })` at start,
and the lifecycle calls `clearActiveSessionCheckpoint(state, sessionId, { submitted: true })` after a
successful write. `saveActiveSessionCheckpoint` throws when the id is already in `submittedSessionIds`
(`persistence.mjs:155`) — the resubmission guard, empty today for the reason in §5.4 defect 4.

**Honest limit.** With no server the seed is a deterministic function of a string the player chooses. This is
preventable only when a server mints the session identity against a wallet and a timestamp the player does
not control (§7, §8).

**Free mode.** `leaderboardEligible = isPaid` (`arcade-core.mjs:5266`), and free sessions get the derived
seed too (`sessionId` is `` `${gameId}-free-${nonce}` ``), so free runs are already reproducible. Free may
expose a player-entered practice seed and a starting-level selector; when it does, `replayClaim` is `null`
and no verified stamp may be issued. `startLevel` rides in the `portal:init` `settings` block, never in
`session` — that is what structurally prevents a Free start level from reaching the seed.

**Do not rely on `recordScore`'s eligibility short-circuit as a write barrier.** In `recordScore`
(`arcade-core.mjs:5465`) the order is: replay verification (`:5483`) → `ensureProfile` (`:5493`) →
`ensureGameProgress` → *then* `if (!session.leaderboardEligible)` (`:5496`). Records are created before that
return, so the guarantee is "no progress, XP, achievement or leaderboard write", not "no state mutation".
Free-mode isolation is enforced by never calling into the ranked path at all.

---

## 2. Seeded RNG — extend `seeded-rng.mjs`, do not fork it

STACKED uses `apps/portal/src/seeded-rng.mjs` (mulberry32) and adds two integer methods:

1. **Correct float normalisation.** `mulberry32` divides by `4294967296` (2³²) at `seeded-rng.mjs:30`, so
   `float()` is in `[0, 1)` and `Math.floor(float() * n)` can never return `n`. Chikun's `deterministicRoll`
   (`chikun-cabinet.mjs:96`) divides by `0xffffffff` and *can* return exactly 1.0 — a live out-of-bounds bug
   for a 7-piece bag.
2. **Resumable cursor.** `SeededRng` tracks `count`, with `snapshot()` → `{ seed, count }`
   (`seeded-rng.mjs:104`), `static fromSnapshot()` (`:109`), and a constructor that fast-forwards by calling
   `float()` `count` times (`:68-74`).
3. **Named substreams exist.** `createSeededSubstreams(baseSeed, names)` (`:129`) salts each stream as
   `hashSeed(safeSeed ^ hashStreamName(name))` (`:133`), `hashStreamName` being FNV-1a over the name
   (`:48-56`). Adding a draw in one subsystem cannot shift another's sequence.

**Additive extension** — existing `float()` / `count` semantics untouched, so the pinned sequence in
`tests/seeded-rng.test.mjs` still passes:

```js
// Recover the raw uint32 the generator produced. Exact: float() returned exactly
// u / 2**32 (a power-of-two divisor, so the double is lossless).
uint32() { return (this.float() * 4294967296) >>> 0; }

// Unbiased integer in [0, n). Modulo-rejection, fully deterministic: the same seed
// rejects at the same draws on every engine, and each rejected draw still advances
// `count`, so the cursor stays canonical.
nextBelow(n) {
  if (!Number.isInteger(n) || n < 1) throw new TypeError('nextBelow(n) needs a positive integer');
  const limit = 4294967296 - (4294967296 % n);
  let u = this.uint32();
  while (u >= limit) u = this.uint32();
  return u % n;
}
```

**The rejection loop makes the RNG cursor a *bound*, not an identity.** `4294967296 % n` is non-zero for
`n ∈ {3, 5, 6, 7, 10}` (zero only for powers of two), so `nextBelow` can consume more than one draw:
probability `(2³² mod n) / 2³² ≤ 9/2³² ≈ 2.1e-9` per call, so over a ~5,200-draw run the expected number of
extra draws is ~1.1e-5. Astronomically rare is not impossible, and a hard-reject equality would reject a
legitimate run roughly once in 10⁵ runs. Therefore:

- The sim counts **refills**: `state.bagRefills` increments once per `refillBag` call, `state.garbageGroups`
  once per garbage group. Those are the exact integers.
- `bagDraws` / `garbageDraws` (cursors) are recorded as evidence and compared by re-simulation for **exact**
  equality — free, because the same seed rejects at the same draws on every engine.
- The plausibility gate, which must never false-reject, uses the refill counters for equality and treats the
  cursors as **lower bounds only**.

`nextBelow` is the **only** RNG entry point the sim may call. `float()`, `range()`, `int()`, `chance()` and
`pick()` are banned inside the sim (§4.4) — not because mulberry32's float is unsafe, but because banning the
whole float surface makes the purity check a grep instead of a judgement call.

**Streams.** Three named substreams, created once at run start:

```js
const rng = createSeededSubstreams(session.seed >>> 0, ['bag', 'garbage', 'zone']);
```

`bag` and `garbage` are the only consumers in Phase 1. `zone` is created and **draws zero times** — zone
advancement is a survival-tick milestone (`mechanics.md`), not an RNG event — and is reserved now so a future
consumer cannot shift `bag` or `garbage` and retire every stored replay. Anything audio-reactive is
projection-only and gets no stream.

*Do not "fix" this:* `createSeededSubstreams` and the `SeededRng` constructor both coerce a falsy seed to `1`
(`Math.floor(Number(seed) || 1)`), so the 1-in-2³² session whose derived seed is `0` behaves as seed `1`.
Harmless — the verifier lands on the same derivation — but changing it rotates every stored replay.

**7-bag consumption.** Fisher–Yates over the frozen order `['I','J','L','O','S','T','Z']`, descending, 6
draws per bag:

```js
function refillBag(bagRng /* rng.bag */) {
  const bag = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  for (let i = 6; i > 0; i -= 1) {
    const j = bagRng.nextBelow(i + 1);
    const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
  }
  return bag;
}
```

**Queue discipline — exact, and a stored replay depends on it.** A 5-piece preview cannot be served by
refilling "when the bag empties": with three left in bag N the preview already needs two from bag N+1. So:

- At run start generate **two** bags: `queue.length === 14`.
- `pieces` counts **pops from the queue**. After each pop, if `queue.length <= 7`, generate exactly one more
  bag and append it.
- A hold swap does **not** pop the queue when the hold slot is occupied; it pops once when the slot is empty.
  Holds therefore do not perturb the bag cursor beyond the pop they cause.

Walk it — 14 queued, pop 7 → length 7 → refill → 14, so the third bag lands on the 7th pop:

```
bagRefills = 2 + floor(pieces / 7)          // exact — the gate's equality check
bagDraws  >= 6 * bagRefills                 // equality except for nextBelow rejections
```

`pieces` counts pops, so the piece in play at termination is counted: `pieces` is one greater than pieces
*locked*. Do not conflate the two. Pin this in `tests/stacked-sim-determinism.test.mjs` with a golden
first-40-pieces sequence for seed `0x1337`; any change silently invalidates every stored replay.

**Hold discipline (the gate depends on it).** One hold per piece; a second is refused until the current piece
locks. Without it `holdsUsed <= pieces` is not an invariant and the `holds-exceed-pieces` reject in §5.3 is
unsound. This section *requires* the rule; `mechanics.md` owns the feel of it.

**Garbage stream.** One draw per inserted garbage **group**: `rng.garbage.nextBelow(BOARD_WIDTH)` picks the
hole column, and consecutive rows from one group share it. `garbageGroups` counts groups, is recorded, and is
**never inferred** from `garbageRowsReceived`. In Phase 1 the rising ledger is the only source and
`GARBAGE_ROWS_PER_INJECTION = 1`, so groups equal rows; the gate still enforces
`garbageGroups <= garbageRowsReceived`, which stays sound when `versus.md`'s attack table adds multi-row
groups. The cadence curve is owned by `mechanics.md`; the gate imports `GARBAGE_START_TICK` and
`GARBAGE_INTERVAL_FLOOR_TICKS` from it and nothing else (§5.1).

**Cursor recording.** At run end the evidence records `bagRefills`, `garbageGroups`,
`bagDraws = rng.bag.snapshot().count` and `garbageDraws = rng.garbage.snapshot().count`. The verifier asserts
all four match the re-simulation exactly; a mismatch is a hard reject.

---

## 3. `SIC1` — STACKED Input Codec v1

### 3.1 The action set

The sim's input is **one `uint8` held-state mask per tick**, recorded exactly as handed to `step()`. This bit
order is part of the codec version and may never be reordered:

| Bit | Action | Trigger |
|---|---|---|
| 0 | `moveLeft` | edge (rising, detected **inside** the sim) |
| 1 | `moveRight` | edge |
| 2 | `softDrop` | **level** — the only held bit; applies on every tick it is set |
| 3 | `hardDrop` | edge |
| 4 | `rotateCW` | edge |
| 5 | `rotateCCW` | edge |
| 6 | `rotate180` | edge |
| 7 | `hold` | edge |

Three load-bearing properties:

1. **Edge detection is inside the sim**, comparing the previous tick's mask; nothing in the host clears bits.
   Host-side edge clearing puts a determinism invariant outside the sim — if the host is ever wrong, the
   recorded stream and the live run diverge silently. It also removes the catch-up-step multiplication trap
   by construction and means the verifier needs **no host adapter at all**.
2. **DAS, ARR, DCD and every touch/gesture/gamepad threshold live outside the sim**, expanding a held
   direction into discrete per-tick move bits *before* the mask is built. Handling configuration therefore
   cannot change a replay, and a run recorded on any DAS/ARR re-simulates identically on a verifier running
   defaults. Values and ranges are in `mechanics.md` / `mobile.md`; integrity requires only that they never
   enter `step()`.
3. **The encoding caps movement at one column per tick.** `STACKED_MAX_MOVE_STEPS_PER_TICK = 1` is
   structural — a one-byte mask carries at most one move bit. The input layer banks up to
   `STACKED_MOVE_QUEUE_MAX = 9` column steps and drains one per tick; overflow is dropped and counted into
   the non-hashed `droppedInputs` stat.

Simultaneous-bit precedence and within-tick resolution order are frozen in contract §2.3, owned by
`mechanics.md`. **Pause is not an input bit**, and nothing presentational — camera, zoom, mute, HUD toggle —
is ever an input bit. All eight bits are allocated; a ninth widens the record, invalidates every stored
replay and forces `stacked-bridge/v2`.

**Touch maps onto the same eight bits and adds nothing.** A swipe-down sets `hardDrop` for exactly one tick;
a tap sets a rotate bit for one tick; a drag drives `moveLeft`/`moveRight` through the same expander a held
key uses. No touch-only action, no gesture record type, no per-device branch in the sim or the codec. A
replay recorded on a phone decodes and re-simulates identically on a desktop verifier and in Node.

**Three recorder invariants**, which exist because the format cannot represent a gap of zero:

1. **At most one record per tick index.** A second change within one sampled tick overwrites the pending
   record's mask; if the overwrite makes it equal to the previous mask, the record is dropped.
2. **Tick 0's mask is forced to `0`.** Keys physically held at run start are honoured from tick 1. This makes
   the first gap ≥ 1 by construction and lets the decoder measure it from tick 0.
3. **Any loop stop synthesises a release.** On pause, `blur` and `visibilitychange` to hidden, write a
   mask-`0` record at the current tick before the loop stops. Otherwise a key held across a pause keeps
   charging DAS on resume and the replay diverges from what the player saw.

### 3.2 Why not raw per-tick bytes

`STACKED_MAX_TICKS = 432_000` (2 h at 60 Hz); the 40-minute god-tier target is `144_000` ticks. One mask byte
per tick is 144,000 B at the target, 432,000 B at the cap. Base64 multiplies by 4/3 and `localStorage` counts
UTF-16 code units, so one raw 40-minute replay costs ~192,000 characters of a Chrome quota of roughly 2.5 M
characters shared with the arcade save; a cap-length run needs 11 raw chunks against 31 worst-case encoded.

**How much transition encoding actually saves, stated honestly, because the ratio is density-dependent
and the design target is the dense end.** At §3.4's god-tier target — 6,000 pieces × ~20 transitions =
120,000 transitions over 144,000 ticks — the encoded stream is 132,028 B against 144,000 B raw: a saving
of **~8%**, not the order-of-magnitude an earlier draft of this line claimed. The large savings appear at
intermediate density and below, where a 5-minute run emits a few thousand transitions across 18,000 ticks
and the encoding costs a small fraction of the raw stream. **The codec is not chosen for its compression
ratio at god tier; it is chosen because it makes the stream self-describing** — a header the parent can
validate before decoding, a checksum, a terminator whose tick index makes truncation detectable, and a
reserved lead-byte range that makes an unknown record a rejection rather than a silent skip. Raw
per-tick bytes give none of that. (It is also why `STACKED_MAX_STORED_REPLAY_CHARS = 240_000` is only
~1.25× the 192,000 characters a plain raw god-tier stream would cost: the cap is sized against the
encoding's *worst* realistic case, not its best.)

**The record rate stays under the recorder's one-per-tick ceiling even in bursts.** At the sustained
2.5 pieces/s target, ~20 transitions per piece is ~50 transitions/s against 60 ticks/s — close, and
sprint bursts of 4–5 PPS imply 80–100 transitions/s, which is *above* one per tick. Recorder invariant 1
resolves this without dropping input: **multiple bit changes landing in one sampled tick collapse into a
single general-form record carrying the absolute mask**, so the record rate is bounded by ticks, not by
transitions, and a burst raises the mean bytes-per-record rather than the record count. The 120,000
figure above is therefore an upper bound on records as well as transitions, and `STACKED_MAX_INPUT_TRANSITIONS
= 432_000` (= `STACKED_MAX_TICKS`) provably cannot be reached by a live run.

### 3.3 The encoding

Record only ticks where the mask changes. Byte stream, big-endian, no padding. **The mask is defined to be
`0` at tick 0**; the first record's gap is measured from tick 0, so a Ranked run must begin with no keys held.

**Header — 24 bytes**

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | magic `0x53 0x49 0x43 0x31` (`"SIC1"`) |
| 4 | 1 | codec version = `1` (`STACKED_EVIDENCE_CODEC_VERSION`) |
| 5 | 1 | action-set version = `1` |
| 6 | 2 | fixed step Hz = `60` (uint16) |
| 8 | 4 | seed (uint32, big-endian) |
| 12 | 4 | total ticks (uint32) |
| 16 | 4 | transition count (uint32) |
| 20 | 4 | FNV-1a-32 of bytes `[24 .. end]` — stream integrity, **not** a security hash |

**Body — one record per mask transition**

- **Short form, 1 byte.** High bit `0`. `0DDDDBBB`: `DDDD` = (ticks since previous transition) − 1, a gap of
  1–16; `BBB` = index of the single toggled bit, applied as `mask ^= 1 << BBB`. Covers the overwhelming
  majority of real play.
- **General form, 3–5 bytes.** Lead byte `0x80`, LEB128 varint of (gap − 1), then one byte of the
  **absolute** new mask. Used for gaps > 16 ticks or multi-bit changes on one tick. The varint is at most 3
  bytes because gap − 1 < 432,000 < 2¹⁹.
- **Terminator, 2–4 bytes.** Lead byte `0xFF`, LEB128 varint of the final tick index. The decoder MUST reach
  a terminator and MUST reject unless that index equals the header's total-ticks field — the header survives
  a truncation, the terminator does not.
- Lead bytes `0x81`–`0xFE` are **reserved and MUST be rejected**. No forward-compatible skip: a decoder that
  skips unknown records can be fed a divergent stream.

The decoder MUST also reject: a transition count disagreeing with the number of records read, a header
checksum mismatch, any gap that would push the tick index past the header's total ticks, and any stream
longer than `STACKED_MAX_EVIDENCE_BYTES`.

### 3.4 Ceilings and the byte math

**Transition budget, recounted for the frozen input model.** Because DAS/ARR expansion happens outside the
sim, a held direction that auto-shifts N columns emits N rising and N falling edges in the mask, not one held
bit. Budget **~20 transitions per piece** — roughly 2.5× the 8-per-piece a level-move model produced, and the
reason the older 96,000 / 120,000 / 131,072 transition caps are all dead. Sustained god-tier placement is
~2.5 pieces/second over 40 minutes (burst rates of 4–5 PPS are sprint-only), so `2,400 × 2.5 = 6,000` pieces:

```
transitions          = 6,000 pieces x 20          = 120,000
short form (95%)     = 114,000 x 1 byte           = 114,000 B
general form (5%)    =   6,000 x 3 bytes          =  18,000 B
header + terminator             24 B + 4 B        =      28 B
--------------------------------------------------------------
binary total                                      = 132,028 B  ~ 129 KiB
base64url, unpadded (x 4/3)                       = 176,038 chars
chunks at 42,000 raw bytes each                   =       4
```

**Frozen ceilings** (imported from `stacked-contracts.mjs`, never retyped):

```js
STACKED_MAX_TICKS                = 432_000;    // 2 h at 60 Hz
STACKED_MAX_INPUT_TRANSITIONS    = 432_000;    // == MAX_TICKS, by recorder invariant 1
STACKED_MAX_EVIDENCE_BYTES       = 1_302_000;
STACKED_MAX_EVIDENCE_CHUNKS      = 33;
STACKED_EVIDENCE_CHUNK_RAW_BYTES = 42_000;
STACKED_EVIDENCE_CHUNK_B64_CHARS = 56_000;     // 42,000 x 4 / 3, exact
STACKED_MAX_STORED_REPLAY_CHARS  = 240_000;
```

*Why the transition cap equals the tick cap.* Recorder invariant 1 permits at most one record per tick, so a
live run provably cannot reach it; the cap does its real job — bounding a *submitted* blob during
verification — without ever firing mid-run. The real bound on a live run is the byte ceiling.

*Deriving the byte ceiling.* It must bound the **worst legal encoding**, not the typical one: a stream where
every transition is multi-bit uses the 3-byte general form for every record. With `T = 432,000` ticks and at
most one record per tick:

```
per record        1 (lead) + varint(gap-1) + 1 (mask)      <= 3 bytes with a 1-byte varint
varint >= 2 bytes requires gap-1 >= 128,   at most T/128   = 3,375 such records
varint  = 3 bytes requires gap-1 >= 16384, at most T/16384 =    26 such records
---------------------------------------------------------------------------------
24 (header) + 432,000 x 3 + 3,375 + 26 + 4 (terminator)    = 1,299,429 B
```

`1_302_000` is the next whole multiple of the 42,000-byte chunk above it (31 × 42,000).
`STACKED_MAX_EVIDENCE_CHUNKS = 33` sits two above the 31 the byte ceiling implies, so envelope rounding can
never make a legal stream illegal. The sim tracks **encoded bytes**, not event count, so varint-escape
density cannot overrun it.

**Which ceiling bites first.** `1,302,000 ÷ 432,000 = 3.014` bytes/tick against a worst legal encoding of 3
bytes/tick at one record per tick, so **the tick ceiling always terminates first, for every stream the
recorder can produce**. `'evidence-ceiling'` is unreachable in legal play and exists only to bound the
parent's reassembly buffer against a hostile or broken child. Both are terminal conditions *inside the sim*
with distinct `terminalReason` values, and both rank normally — a validator-only cap silently loses a
legitimate run instead of ending it cleanly, the exact class of bug this section exists to prevent.
`tests/stacked-evidence-codec.test.mjs` asserts this ordering.

### 3.5 Chunked evidence transport

The stream is base64-encoded and sent as ordered `game:evidence-chunk` messages **before** `game:result`;
`game:result` carries only the digest (§4.6).

```js
// game:evidence-chunk payload — exact keys
{
  chunkIndex,     // int, 0-based, contiguous
  chunkCount,     // int, 1..STACKED_MAX_EVIDENCE_CHUNKS
  totalRawBytes,  // int, 1..STACKED_MAX_EVIDENCE_BYTES
  payload,        // base64 string, length <= STACKED_EVIDENCE_CHUNK_B64_CHARS (56,000)
}
```

*Why 42,000.* The envelope (`protocol`, `type`, `sessionId`, `messageId`, framing) costs ≤ 4,096 bytes of the
65,536-byte cap, leaving 61,440 usable base64 characters = 46,080 raw bytes; 42,000 leaves margin. And
`42,000 = 14,000 × 3`, so every chunk boundary lands on a base64 3-byte group and no chunk carries interior
`=` padding.

The parent reassembles and rejects — **before any decode or simulation work** — on: a missing index, a
duplicated index, a `chunkCount` mismatch, a `totalRawBytes` mismatch, more than
`STACKED_MAX_EVIDENCE_CHUNKS`, a reassembled length over `STACKED_MAX_EVIDENCE_BYTES`, a bad `"SIC1"` magic,
or a header-checksum mismatch. Message size is measured as
`new TextEncoder().encode(JSON.stringify(message)).byteLength` (`hmh-bridge-protocol.mjs:86`).

### 3.6 `localStorage` replay budget

Replays must **not** go into the main arcade snapshot. `saveArcadeState` (`persistence.mjs:96`) degrades
under quota in three attempts — full, then dropping avatars, then dropping `cadenceLeaderboards` entirely
(`:98-101`) — so a fat replay in that payload trades the whole leaderboard for one run's inputs. Instead, a
separate key namespace written outside `snapshotArcadeState`, by `apps/portal/src/stacked-replay-store.mjs`:

- Key `stacked-replay-v1:<sessionId>`, value = the base64url stream plus a small JSON header.
- **Retention: 2 replays** — most recent Ranked and personal best. LRU eviction on write, plus an index key
  `stacked-replay-v1:index` holding the two session ids so eviction does not enumerate storage.
- **The store's cap is deliberately not `STACKED_MAX_EVIDENCE_BYTES`.** The decoder accepts 1,302,000 B;
  storing two would cost `2 × ceil(1,302,000 × 4/3) = 3,472,000` characters, past the whole quota. So
  `STACKED_MAX_STORED_REPLAY_CHARS = 240_000` base64url characters per replay, 1.36× the 176,038 the §3.4
  god-tier derivation produces. Worst-case pair 480,000 ≈ 19% of a conservatively read ~2.5 M-character
  Chrome budget shared with `lesters-arcade-save-v1`; a god-tier pair ≈ 352,000 ≈ 14%; a typical pair
  ≈ 200,000 ≈ 8%.
- A verified run whose stream exceeds the cap **still ranks** and is simply not stored, reason
  `replay-too-large`. Verification and storage are independent decisions.
- "~2.5 M characters" is a conservative reading of Chrome's 5 MB-per-origin quota counted as UTF-16 code
  units — an assumption, not a measurement, and the design must not depend on it being generous. Both numbers
  are asserted by a test writing a cap-sized stream into an in-memory storage mock.
- Write failure is non-fatal and never blocks a score write; the run still ranks (it was verified in-session)
  and simply cannot be re-verified later. The row's `replayStored` flag records which case it was. The blob
  is written **after** the score write, never before, so storage never holds a replay for a run that did not
  rank.

### 3.7 Three digests, three jobs

| Digest | Algorithm | Over | Job |
|---|---|---|---|
| `streamChecksum` | FNV-1a-32, in the SIC1 header | body bytes | Truncation/corruption in storage and transport. **Not** security. |
| `inputHash` | `sha256Hex` (`session-integrity.mjs:43`) | the full binary stream | Binds the stream to the claim |
| `resultHash` | `sha256Hex` | `canonicalSessionJson(tuple)` (§4.2) | The value the verifier reproduces |

`sha256Hex` is **async** and returns a `0x`-prefixed **66-character** string (`session-integrity.mjs:47`), not
bare 64 hex — every claim field holding one is 66 characters. It takes
`{ cryptoProvider = globalThis.crypto }` and throws `'Web Crypto SHA-256 is required'` when `subtle.digest`
is absent, so it runs identically under browser Web Crypto and Node ≥ 18. Reuse it; do not write a fourth
hash. Because it is async, all hashing happens in the lifecycle before `recordScore`, which stays synchronous
— which is also why §4.5's `inFlight` latch is needed.

The **full** 66-character `resultHash` goes in the replay blob; the persisted leaderboard row carries only
`resultHash16`, its first 16 hex characters, for the size reason in §5.4 defect 2. Sixty-four bits is fine
for "does this row correspond to this stored replay" and is not fine for anything adversarial — do not extend
its job. Note that `replayDigest64` (`apps/portal/src/hmh-run-integrity.mjs:79`, used by
`buildReplayVerificationEnvelope` at `:218`) is eight parallel FNV-1a-style streams concatenated to 64 hex
characters, **not** a cryptographic hash. Never describe it, or `streamChecksum`, as a commitment.

---

## 4. Deterministic re-simulation

### 4.1 Where it runs

**Phase 1: in the browser, parent-side, at submit time, exactly once.**

The child self-verifies before emitting — it re-simulates its own recorded inputs and refuses to hand over a
claim that does not reproduce its own result, the Chikun pattern (`buildChikunReplayClaim`,
`chikun-cabinet.mjs:365`, calls `replayChikunRun` and `assertCanonicalChikunResult` before returning). The
child's self-check is a **bug detector, not a security control**; the parent never trusts it.

The parent re-simulates **once**, in `createStackedPortalLifecycle().handleResult()`, before any write — a
deliberate departure from Chikun, which re-verifies three times (`chikun-portal-lifecycle.mjs:38`,
`recordScore` at `arcade-core.mjs:5483`, `buildParentSyncPacket` at `:5307`).

*Deriving the cost.* A STACKED sim step is a handful of integer operations plus an occasional
lock/line-clear pass; budget 1–2 µs per tick in optimised JS. A 144,000-tick design-target replay is
~144–288 ms; a 432,000-tick cap run is ~430–860 ms. Three of those synchronously on the main thread at the
results screen is 1.3–2.6 s of frozen UI. Once is defensible; three times is not.

**Measure it, and put the assertion above the derivation, not inside it.**
`tests/stacked-sim-determinism.test.mjs` asserts a synthetic 432,000-tick replay completes in **under
1,500 ms** and prints the measured figure. 1,500 ms is ~1.75× the 860 ms upper end, the margin an unpinned CI
runner needs; a 500 ms threshold would sit *below* the design's own worst case and flake. The number that
matters is the printed trend — a jump from ~500 ms to ~1,200 ms is a regression the assertion would not catch
— so the measured value is logged even on a pass.

1. The lifecycle validates the payload shape, reassembles and decodes the stream, and runs
   `replayStackedRun(evidence)` **in a Web Worker** when one can be constructed, inline otherwise, behind a
   "Verifying run…" results state.
2. On success it computes the hashes and stamps the session:
   `session.verifiedRun = Object.freeze({ resultHash, inputHash, verdict, canonical })`.
3. `recordScore` and `buildParentSyncPacket` consume the stamp through a **per-game verifier registry**:

```js
// apps/portal/src/arcade-core.mjs — replaces the `game.id === 'chikun'` branches
// at :5483 (recordScore) and :5307 (buildParentSyncPacket)
const RUN_VERIFIERS = new Map([
  ['chikun',  ({ session, score, runStats, replayClaim }) => verifyChikunReplayClaim({ /* ... */ })],
  ['stacked', ({ session, score }) => assertStackedVerifiedStamp(session, score)],
]);
```

`assertStackedVerifiedStamp` is a synchronous identity check: it throws unless `session.verifiedRun` exists,
is a member of an in-memory `WeakSet` of stamp objects issued by lifecycle code in this same page load (so a
value copied out of devtools does not pass identity), and its `canonical.score` equals the score being
recorded. **The score written to the leaderboard is `canonical.score` from the re-simulation, never the
number the child sent** — the rule `chikun-portal-lifecycle.mjs:49` already follows. That is not in tension
with the field-by-field comparator: a submitted score differing from canonical is already a `rejected`
verdict, and writing `canonical.score` makes the guarantee structural rather than dependent on the comparator
being complete. The registry also removes the drift risk of a third hard-coded `game.id === '<cabinet>'`
branch, which is what lets a future cabinet forget one and rank an unverified score.

**Import direction, because the obvious placement creates a cycle.** `chikun-cabinet.mjs` imports only
`./arcade-sdk.mjs` and `./game-adapter.mjs` (`:1-2`) and never touches `arcade-core.mjs`; the direction is
strictly one-way. So:

- `stacked-cabinet.mjs` stays `arcade-core`-free — `STACKED_CABINET_VERSION` and the replay claim only.
  `verifyStackedReplayClaim` takes `{ expectedSeed, expectedBuildHash, expectedSeasonId, ... }` as arguments,
  exactly the `verifyChikunReplayClaim` signature at `chikun-cabinet.mjs:380`, rather than recomputing the
  seed itself. A back-import through a module loaded during `arcade-core`'s own evaluation would make
  `STACKED_CABINET_VERSION` read `undefined` on the `ARCADE_GAMES` entry.
- The stamp `WeakSet`, `assertStackedVerifiedStamp` and `startStackedRankedSession` live in
  `stacked-portal-lifecycle.mjs`, which may import `arcade-core.mjs` freely and performs the §1 anti-reroll
  recomputation.
- Break the remaining cycle by having the lifecycle **register** its verifier at construction —
  `registerRunVerifier('stacked', fn)`, exported by `arcade-core.mjs` — instead of `arcade-core` importing
  the lifecycle. The Chikun entry may be registered the same way or left static; either is fine, but
  **STACKED must not add a new import edge into `arcade-core.mjs`**.
- **Fail-closed.** The `ARCADE_GAMES` entry carries `requiresRunVerifier: true` (chikun and stacked; **not**
  `lester-blaster`, which has no replay claim today and must keep ranking), and `recordScore` throws for a
  `leaderboardEligible` session whose game requires a verifier and has none registered. A forgotten
  registration then fails loudly at the first ranked write instead of silently ranking an unverified score.

**Worker wiring.** There is no hand-written `new Worker(` anywhere in `apps/portal/src` today — the only
occurrences in the tree are inside the built Pixi vendor chunk `apps/portal/dist/chunks/hmh-pixi.js`.

- Source `apps/stacked/src/verify-worker.mjs`, importing only `../../portal/src/stacked-sim.mjs`.
- Build: a fourth entry in `build.mjs`'s `entryPoints` (`:109-113`, today exactly `main`, `hmh-reboot/game`,
  `chikun/game`) — `'stacked/verify-worker': stackedVerifyWorkerEntry` — emitting
  `apps/portal/dist/stacked/verify-worker.js`. `splitting: true` and `format: 'esm'` are already set
  (`build.mjs:116-117`), which is what a module worker needs. Consequence of `splitting`: `stacked-sim.mjs` is
  imported by both `main` and the worker, so esbuild hoists it into a shared `dist/chunks/` chunk that the
  worker loads by relative `import` — fine for a `type: 'module'` worker, and the reason the worker must not
  be built as a classic script.
- **Deploy gap the build change creates.** `vercel.json:18` is `"/dist/(hmh-reboot|chikun)/(.*)"` with
  `Cache-Control: public, max-age=0, must-revalidate`. `dist/stacked/verify-worker.js` matches no explicit
  rule, so it would inherit no cache header and could be served stale across a deploy — a verifier one build
  behind the sim, the worst thing that can happen to a determinism check. The pattern must become
  `"/dist/(hmh-reboot|chikun|stacked)/(.*)"` in the same commit as the `build.mjs` change. The shared chunk is
  covered by `vercel.json:9`'s `"/dist/chunks/(.*)"` immutable rule, safe because esbuild content-hashes
  chunk names — and for the same reason **no STACKED artifact may be hand-placed under `/dist/chunks/`**.
- Construction: `new Worker(new URL('./dist/stacked/verify-worker.js', document.baseURI), { type: 'module' })`
  in try/catch. Any failure falls back to inline verification; correctness never depends on the worker
  existing, and the lifecycle test asserts the fallback still produces a verdict.
- **CSP: no change needed for the worker.** It is constructed by the *parent* page, under `vercel.json:54`'s
  catch-all `/((?!(?:hmh-reboot|chikun)/).*)`, whose policy already carries `worker-src 'self' blob:` and
  `script-src 'self' 'unsafe-inline'` (`:58`). `dist/stacked/verify-worker.js` begins with `dist/`, not
  `stacked/`, so widening that negative lookahead for the child shell does not move it. The child's own
  `/stacked/(.*)` CSP source and the lookahead change are owned by `portal.md` and `gates.md`.
- The inline and worker paths must call the same `replayStackedRun` on the same decoded stream and produce
  byte-identical tuples.

**Phase 2 and beyond: the same module runs unchanged in a backend verifier.**
`apps/portal/src/stacked-sim.mjs` is importable by Node with zero shims: no DOM, no `window`, no `document`,
no `globalThis.performance`; no imports outside `./seeded-rng.mjs` and `./stacked-contracts.mjs`; exports
`createStackedRuntime`, `simulateStackedRun`, `replayStackedRun`, `encodeSic1`, `decodeSic1`,
`buildStackedResultTuple`, `refillBag`, `STACKED_SIM_CONSTANTS`; everything frozen, no module-level mutable
state. `stacked-cabinet.mjs` imports `sha256Hex` with its `cryptoProvider` seam. A backend verifier is then a
short handler: decode SIC1 → `replayStackedRun` → recompute `resultHash` → compare to the claim → recompute
the seed from the session identity. No fork, no port, no reimplementation — the whole reason the sim is a
separate module from the runtime.

### 4.2 The result tuple and its hash

`buildStackedResultTuple(state)` returns integers and short enum strings **only** — no floats, no nested
objects, no arrays. Hashed as `await sha256Hex(canonicalSessionJson(tuple))`; `canonicalSessionJson`
(`session-integrity.mjs:14`) recursively key-sorts before `JSON.stringify`, removing the key-order fragility
Chikun's `sameJson` (`chikun-cabinet.mjs:353`) carries. Values are an internally consistent **shape example**,
not tuned balance; the field list, types and invariants are what is pinned.

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
  bagRefills: 860,                 // exact: 2 + floor(6006 / 7) = 2 + 858
  bagDraws: 5160,                  // >= 6 * bagRefills; equal here (no nextBelow rejections)
  garbageDraws: 91,                // >= garbageGroups
  transitionCount: 120000,         // from the SIC1 header; also gated pre-re-simulation
  boardHash: '0x<64 hex>',         // 66 chars, sha256Hex of the packed final board
  terminalReason: 'block-out',     // one of STACKED_TERMINAL_REASONS
}
```

**This is a schema-*shape* example, not tuned balance and not a prediction.** It exists so a validator
author and a codec author have one internally consistent tuple to test against; every §5 identity below
holds on it, and that is all it claims. In particular its `score: 9864300` is **not** the difficulty
model's output: `mechanics.md` §9 — the authority on score magnitude — puts a real god-tier run near
`5–6 × 10^7`, five to six times this figure, and `mechanics.md` §10 predicts a 33.4-minute god run, not
this tuple's 40 minutes. Nothing may be tuned against these numbers, and the `maxScore` commentary in
§5.1 uses them only as an arithmetic reference point.

Consistency checks on that example, all enforced by §5:

| Check | Arithmetic | Result |
|---|---|---|
| `pieces <= floor(ticks / STACKED_MIN_PLACEMENT_TICKS) + 1` | 6,006 ≤ 72,001 | ok |
| `garbageRowsReceived <= maxGarbageRowsReceived` | 190 ≤ 1,171 | ok |
| `garbageGroups <= garbageRowsReceived` | 91 ≤ 190 | ok (equal in Phase 1; the split is a Phase 2 shape) |
| `lines <= floor(pieces * 4 / 10) + garbageRowsReceived` | 1,712 ≤ 2,402 + 190 = 2,592 | ok |
| `quadClears * 4 <= lines` | 1,248 ≤ 1,712 | ok |
| `maxCombo <= lines - 1` | 21 ≤ 1,711 | ok |
| `perfectClears <= min(floor(pieces/5), floor(lines/2))` | 3 ≤ min(1,201, 856) = 856 | ok |
| `holdsUsed <= pieces` | 1,902 ≤ 6,006 | ok |
| `garbageRowsCleared <= garbageRowsReceived` | 176 ≤ 190 | ok |
| `bagRefills === 2 + floor(pieces/7)` | 860 = 2 + 858 | exact |
| `garbageDraws >= garbageGroups` | 91 ≥ 91 | ok |
| `level === min(30, 1 + floor(lines/10))` | 30 = min(30, 172) | ok |
| `transitionCount <= min(STACKED_MAX_INPUT_TRANSITIONS, ticks)` | 120,000 ≤ 144,000 | ok |
| sustained PPS | 6,006 / 2,400 = 2.50 | under 3.2 |
| sustained LPS | 1,712 / 2,400 = 0.71 | under 1.28 |

`garbageRowsReceived` is bounded on its own terms *before* use, because `maxLines` takes it as an **input**:
an unbounded submitted value defeats the strongest check in the gate outright (§5.1).

`boardHash`: the 10 × `BOARD_ROWS` (24) playfield packed at 4 bits per cell (0 = empty, 1–7 = piece kinds,
8 = garbage), 5 bytes per row, **120 bytes total**, hex-encoded, then SHA-256. Packing rather than hashing a
JSON array removes any chance of array-formatting drift.

**No floats anywhere in the tuple.** Wall-clock seconds are never hashed and never ranked; the `SURVIVED`
column renders `survivalTicks / 60` at display time only. `DeterministicSimulation.update`
(`apps/hmh-reboot/src/simulation.mjs`) clamps its accumulator to `MAX_CATCH_UP_STEPS = 4` (`:2`) and *drops*
the overflow, so a stuttering device simulates fewer ticks per real second than a smooth one. Ranking on
ticks makes the metric device-independent; ranking on wall clock would not.

### 4.3 Verification comparison rule

Field-by-field equality against an explicit field list — **not** `JSON.stringify` string equality.
`verifyChikunReplayClaim` compares `finalState` with `sameJson` (`chikun-cabinet.mjs:353, 388`), which makes
key order and `toFixed(6)` digit counts load-bearing — chikun writes `Number(state.y.toFixed(6))` and
`Number(state.velocity.toFixed(6))` at `:183` and `:201-202`, so 6 decimals → 5 would silently invalidate
every stored claim. STACKED's tuple is all integers and short enums, so that is designed out, and the
comparator is explicit anyway so a **missing** field is a hard error rather than a silent pass. Any single
mismatch → `verdict: 'rejected'`, no leaderboard write, the run recorded in run history as unverified.

### 4.4 Sim purity rules (hard, gated)

`apps/portal/src/stacked-sim.mjs` MUST NOT contain:

| Banned | Why |
|---|---|
| `Math.random` | non-deterministic by definition |
| `Date`, `Date.now`, `performance.now`, any wall clock | the tick index is the only clock |
| `Math.sin cos tan atan2 hypot pow sqrt exp log cbrt` | implementation-defined precision in ECMA-262. `chikun-cabinet.mjs:291` calls `Math.hypot` *inside its step function*; a run recorded on one engine can in principle fail re-verification on another. Do not repeat this. |
| any non-integer arithmetic | see the fixed-point rule below |
| `toFixed`, `toPrecision`, `toLocaleString`, `Intl` | digit-count and locale drift silently invalidate stored claims |
| `window`, `document`, `navigator`, `devicePixelRatio`, `AudioContext`, `AnalyserNode`, any audio band value, any render/particle/quality-tier state | projection is projection. Audio-reactive visuals may not reach RNG, scoring, or evidence. |
| `crypto`, `structuredClone` | hashing lives in `stacked-cabinet.mjs`; the sim stays dependency-free |
| `float()`, `range()`, `int()`, `chance()`, `pick()` on a `SeededRng` | `nextBelow` is the only permitted draw |

**Fixed-point gravity.** Gravity is an integer in 1/65536-cell units per tick, read from the frozen
`STACKED_GRAVITY_Q16` table (`mechanics.md`) whose rounded integers **are** the truth and must never be
re-derived at runtime:

```js
state.gravityQ16 += STACKED_GRAVITY_Q16[gravityLevel];   // both integers
const cellsToDrop = state.gravityQ16 >>> 16;
state.gravityQ16 &= 0xffff;
```

DAS, ARR, DCD, lock delay, spawn delay and the garbage-rise timer are all integer tick counters (DAS/ARR/DCD
outside the sim, §3.1). **There is no floating-point number anywhere in the simulation**, so there is nothing
for a different engine to round differently.

**Enforcement is a build gate, not a code-review promise.** `scripts/stacked-sim-purity-check.mjs` regex-scans
the sim files for the banned token list and exits non-zero on a hit, exposed as
`npm run design:stacked-purity` and asserted by `tests/stacked-sim-purity.test.mjs` so it also runs inside
`npm test` (`node --test tests/*.test.mjs tests/projectile-pool.test.mjs`, `package.json:8` — a glob, so a new
test file is picked up automatically). Follows the static-gate precedent of
`scripts/hmh-security-audit-sweep.mjs`, whose `SECURITY_PATTERNS` array is the shape to copy. The same script
greps the cabinet's source for the trademarked genre term and the trademarked four-line-clear term.

Every new `.mjs` module and test named here must be appended to `NODE_CHECK_FILES` in
`scripts/syntax-check.mjs:22` — a hand-maintained array with no globbing (`seeded-rng.mjs` at `:25`,
`hmh-run-integrity.mjs` at `:254`) — or it silently escapes `npm run check`, including inside `vercel:build`.

### 4.5 Input application, and the states the loop must survive

**Input application convention.** The live loop samples input **once per animation frame** and stamps that
one mask onto **every** simulated tick produced by that frame. If a frame runs 3 catch-up steps, the recorder
writes that mask for 3 consecutive tick indices — which the transition encoder collapses to nothing, since
the mask did not change. The replay reads one mask per tick from the decoded timeline and steps identically
by construction. This picks the `DeterministicSimulation` convention (one frozen input snapshot across all
catch-up steps) over `apps/chikun/src/main.mjs`'s "consume the queued tap on the first step only"; the two
must not be mixed. Because `MAX_CATCH_UP_STEPS = 4` drops overflow, a stuttering device advances fewer ticks
per real second, so its player gets more wall-clock thinking time per piece — a fairness property of
tick-based ranking, not a determinism bug, and the price of a device-independent metric.

A second consequence §7 depends on: **the recorded stream carries the shape of the recorder's refresh rate.**
A 144 Hz display samples 144 times a second and stamps at most one mask per simulated tick; a 60 Hz display
samples 60. Verification is unaffected — the recorded timeline is exactly what is replayed — but the
inter-transition gap distribution differs systematically between devices. Any future input-timing anti-TAS
statistic must normalise for that or it flags high-refresh-rate players as machines. Record
`sampledTicksPerSecond` as a non-hashed run stat now so the corpus is usable later.

**The one-shot latch must close synchronously, before the first `await`.** Chikun's `finalized` latch
(`chikun-portal-lifecycle.mjs:31`, checked `:35`, set `:52`) is safe because its verification is synchronous.
STACKED's is not: the worker round trip and `sha256Hex` are both async, so between entering `handleResult`
and setting `finalized` a second call can enter and start a second verification. Two flags, not one: an
`inFlight` boolean set synchronously on entry (a second call returns
`{ ok: false, reason: 'verification-in-flight' }`) and the `finalized` latch set when the write completes.
Neither is ever cleared — this cabinet has no retry.

| State | Rule |
|---|---|
| **Pause during Ranked** | The fixed-step loop stops. No ticks advance, no masks recorded, replay unaffected. Ranked therefore grants unlimited thinking time while paused — accepted for Phase 1; a pause budget is a balance decision this section does not own (G-7). `pauseCount` and `pausedWallClockMs` are recorded as non-hashed run stats so the decision can be revisited from data. |
| **Tab hidden / backgrounded** | On `visibilitychange` to hidden a Ranked run auto-pauses and the recorder writes a mask-`0` record (§3.1 invariant 3). On resume the accumulator is **reset, not drained**, so no burst of catch-up ticks is simulated for time the player could not see. |
| **Window blur without a visibility change** | Alt-tab leaves the tab visible, so `visibilitychange` never fires and a held key would stay logically down forever. On `blur`, release all bits (mask-`0` record) but do **not** auto-pause — the run continues with no input, the honest reading of "the player stopped playing". On `focus`, keys are re-read from the next sampled frame; nothing is back-filled. |
| **Touch pointer lost mid-gesture** | `pointercancel` / `touchcancel` clears that pointer's bits on the next sampled tick, same as a key release. A cancelled swipe never synthesises a `hardDrop` edge. |
| **Resize / orientation change mid-run** | Projection only. The board is a logical 10 × 24 grid; layout, scale and touch geometry are presentation. No tick is added, dropped, or re-simulated. |
| **Zone transition** | A survival-tick milestone; consumes no RNG, changes only palette/background/particle presets. A top-out on the same tick as a zone advance is ordinary: the sim resolves the top-out, the zone change never reaches the tuple. |
| **Tick ceiling reached** | `terminalReason: 'tick-ceiling'` at `tick >= STACKED_MAX_TICKS`. Run ends, run ranks. |
| **Evidence ceiling reached** | `terminalReason: 'evidence-ceiling'` at encoded bytes `>= STACKED_MAX_EVIDENCE_BYTES`. Unreachable in legal play (§3.4); still a sim terminal, still ranks. |
| **Tab closed or navigated away mid-run** | Nothing is submitted. `activeSessionCheckpoint` is left unresolved and the next Ranked start increments `abandonedRankedStarts` when it clears it. There is no partial-run submission path and none may be added. |
| **Tab closed while "Verifying run…" is on screen** | Same: the score is written only after `assertStackedVerifiedStamp` passes, so an interrupted verification writes nothing. |
| **Verification throws** | Caught by the lifecycle, `verdict: 'rejected'`, no leaderboard write, one run-history row marked unverified with the thrown reason. The `finalized` latch still closes, so a failed verification cannot be retried with a different payload. |

`'abandoned'` and `'runtime-error'` are **not** `terminalReason` values. Neither is a sim terminal — an
abandoned run submits nothing and a thrown verification writes nothing — so neither can appear in a result
tuple or a run summary. They are run-history lifecycle states.

### 4.6 The submitted payload and its validation order

```js
// game:result payload — exact keys, validated before any simulation work
{
  v: 'stacked-run-payload-v1',
  score: 9864300,          // int >= 0; compared against canonical, never trusted
  evidenceDigest: '0x…',   // 66 chars — sha256Hex of the reassembled SIC1 stream (inputHash)
  totalRawBytes: 132028,   // must equal the reassembled length
  tuple: { /* §4.2 */ },
  summary: { /* validateStackedRunSummary — sdk/stacked-run-summary-schema.mjs */ },
  runStats: {              // NOT hashed, NOT ranked, NOT re-simulated — projection telemetry only
    pauseCount, pausedWallClockMs, sampledTicksPerSecond,
    qualityTier, reducedMotion, droppedInputs, degradationLevel,
  },
}
```

The stream does **not** travel in this message — it arrived as `game:evidence-chunk` messages (§3.5).
Validation order, all before any decode or simulation:

1. Exactly these seven top-level keys, `exactKeys()` discipline (`sdk/hmh-bridge-protocol.mjs:29`) — unexpected
   **and** missing keys both fail.
2. `v === 'stacked-run-payload-v1'`.
3. Chunks reassembled, contiguous, `totalRawBytes` matched, `"SIC1"` magic present, header checksum valid,
   length ≤ `STACKED_MAX_EVIDENCE_BYTES`, chunk count ≤ `STACKED_MAX_EVIDENCE_CHUNKS`.
4. `tuple` field-list exact (the §4.3 comparator runs on the same list), every numeric a non-negative safe
   integer, `terminalReason` in `STACKED_TERMINAL_REASONS`.
5. `summary` passes `validateStackedRunSummary`.
6. `validateStackedRunPlausibility` on the submitted numbers — the cheap pre-filter pass (§5).

Only then is the stream decoded and re-simulated. Failure at any step is `verdict: 'rejected'`, and the
reason code is the step that failed.

---

## 5. The plausibility gate — `apps/portal/src/stacked-run-integrity.mjs`

Sibling to `apps/portal/src/hmh-run-integrity.mjs`, same shape and verdict vocabulary, pure and DOM-free so
it runs in the browser, in a future backend, and in tests. It exports exactly
`validateStackedRunPlausibility`, `deriveStackedRunCeilings` and `STACKED_INTEGRITY_TOLERANCE`; every sim
constant is **imported from `stacked-contracts.mjs`, never retyped and never re-exported**, so a tuning
change cannot leave the gate rejecting legitimate runs.

**It is a cheap pre-filter, not the security control.** Re-simulation is the security control. The gate
exists to (a) reject absurd submissions before spending 144,000 ticks of CPU on them, and (b) catch a
*self-consistent but physically implausible* run — a synthetic stream that really does re-simulate to a
3,000,000-point score in 90 seconds. It runs **twice**: once on the submitted summary before re-simulation,
once on the canonical numbers afterwards. The second verdict is the one persisted.

### 5.1 Derived ceilings

```js
import {
  STACKED_MIN_PLACEMENT_TICKS,   // 2
  BOARD_WIDTH,                   // 10
  BOARD_ROWS,                    // 24
  STACKED_LEVEL_CAP,             // 30
  STACKED_COMBO_BONUS_CAP,       // 20
  STACKED_MAX_TICKS,             // 432_000
  STACKED_MAX_INPUT_TRANSITIONS, // 432_000
  GARBAGE_START_TICK,            // 3_600
  GARBAGE_INTERVAL_FLOOR_TICKS,  // 120
  GARBAGE_ROWS_PER_INJECTION,    // 1
} from './stacked-contracts.mjs';

const CELLS_PER_PIECE = 4;
const MAX_DROP_SCORE_PER_PIECE = 2 * BOARD_ROWS;                                       //     48
const MAX_SCORE_PER_LINE = (1200 + 50 * STACKED_COMBO_BONUS_CAP) * STACKED_LEVEL_CAP;  // 66,000
const MAX_PERFECT_CLEAR_BONUS = 3200 * STACKED_LEVEL_CAP;                              // 96,000
const MAX_HASHPOWER_SCORE_PER_GROUP = 250 * STACKED_LEVEL_CAP;                         //  7,500
const MAX_SURVIVAL_TRICKLE_PER_60 = 10 * STACKED_LEVEL_CAP;                            //    300

// The ONE judgement number in this file. Soft ceiling, applied only to runs long
// enough for an average to mean anything.
const SUSTAINED_PPS_SOFT  = 3.2;
const SUSTAINED_MIN_TICKS = 3_600;   // 60 s — below this, burst rates are real

// Derived, not guessed. Placement alone cannot clear lines faster than
// PPS x 4 cells / 10 cells-per-row. An earlier draft typed 1.4 here, ABOVE what
// SUSTAINED_PPS_SOFT permits from piece mass, so the flag could only ever fire on
// garbage-fed clears and was dead as a speed check.
const SUSTAINED_LPS_SOFT = SUSTAINED_PPS_SOFT * CELLS_PER_PIECE / BOARD_WIDTH;         //   1.28
```

`MAX_SCORE_PER_LINE` derivation, from the frozen scoring block: the highest points-per-line of any single
action at the level cap with every multiplier stacked is a full-spin single — base `800` for one line,
×`level`; `CHAIN` ×1.5 applies to spin clears, giving `1200 × L`; the combo bonus is `50 × min(combo, 20) × L`
once per clear, and a clear is ≥ 1 line, giving `+1000 × L`. So `(1200 + 1000) × 30 = 66,000`.

`STACKED_MIN_PLACEMENT_TICKS = 2` is derived from `SPAWN_DELAY_TICKS = 0`, `LINE_CLEAR_DELAY_TICKS = 0` and
"a tick that locks ends there": a lock resolves clears, garbage and spawn on its own tick, and the newly
spawned piece takes no action until the next. **This is 3.5× looser than an earlier draft of this section
assumed** (it computed `SPAWN_DELAY_FRAMES + 1 = 7` against a spawn delay mechanics then froze at 0). The
frozen value is correct — a tighter bound rejects legal runs — but `maxPieces` and `maxLines` therefore carry
less of the gate's weight than that draft claimed; the checks that bite are `bag-refill-mismatch`,
`garbage-exceeds-rise-rate` and `level-inconsistent-with-lines`.

**Order matters.** `maxLines` consumes `garbageRowsReceived` and `maxScore` consumes `perfectClears`, both
submitted values. Each is clamped to its own ceiling before being used as an input to another, so a single
inflated field cannot cascade.

| Ceiling | Formula | Rationale |
|---|---|---|
| `maxPieces` | `floor(ticks / STACKED_MIN_PLACEMENT_TICKS) + 1` | A piece cannot lock on the tick it spawns; 2 ticks is the floor. `floor(...) + 1`, not `ceil(...)`, so a perfect run at an exact boundary is not rejected by one. |
| `maxGarbageGroups` | `floor(max(0, ticks - GARBAGE_START_TICK) / GARBAGE_INTERVAL_FLOOR_TICKS) + 1` | The rising ledger's interval is a **curve**, so the bound must use the curve's *minimum* interval — the only value sound at every point on it. `GARBAGE_RISE_INTERVAL_FRAMES` does not exist; do not reintroduce it. The `+ 1` is the boundary guard. When `versus.md`'s attack table lands as a second source, this formula gains a term and this module changes in the same commit. |
| `maxGarbageRowsReceived` | `maxGarbageGroups * GARBAGE_ROWS_PER_INJECTION` | **Load-bearing.** Without it, `garbageRowsReceived` is an unbounded attacker-supplied input to `maxLines` and the strongest check in the gate is defeated by typing a big number. |
| `safeGarbageRows` | `min(garbageRowsReceived, maxGarbageRowsReceived)` | The clamped value `maxLines` actually uses |
| `maxLines` | `floor(pieces * CELLS_PER_PIECE / BOARD_WIDTH) + safeGarbageRows` | Exact combinatorial invariant: each piece adds 4 cells, a row needs 10. Garbage rows arrive 9/10 filled, so each received row is worth at most one extra clear. |
| `maxCombo` | `max(0, lines - 1)` | The combo counter is (consecutive clearing placements − 1), so the first clear is combo 0 and a combo of N needs N+1 clears, each costing ≥ 1 line. |
| `maxQuadClears` | `floor(lines / 4)` | Definitional |
| `maxPerfectClears` | `min(floor(pieces / 5), floor(lines / 2))` | Cells cleared must be a multiple of both 10 (row) and 4 (piece), so the smallest perfect clear is 20 cells = 5 pieces = 2 rows. Five, not ten. |
| `expectedBagRefills` | `2 + floor(pieces / 7)` | Exact, from §2's queue discipline — equality, not an inequality, hence the name. The cursor `bagDraws` is checked only as `>= 6 * expectedBagRefills`, because `nextBelow`'s rejection loop can consume extra draws. |
| `expectedLevel` | `min(STACKED_LEVEL_CAP, 1 + floor(lines / 10))` | A pure function of lines, per the frozen `LEVEL_FOR_LINES` rule. If that curve ever stops being pure, this check is **dropped, not fudged**. |
| `maxScore` | `lines * MAX_SCORE_PER_LINE`<br>`+ min(perfectClears, maxPerfectClears) * MAX_PERFECT_CLEAR_BONUS`<br>`+ pieces * MAX_DROP_SCORE_PER_PIECE`<br>`+ maxGarbageGroups * MAX_HASHPOWER_SCORE_PER_GROUP`<br>`+ floor(ticks / 60) * MAX_SURVIVAL_TRICKLE_PER_60` | Score is gated by lines, and lines by pieces. The last two terms are the frozen scoring block's tick-driven income (`250 × level` per REORG rejected with `HASHPOWER`, `10 × level` every 60 ticks) and must be present or a long clean run trips `score-implausible`. Using the **clamped submitted** perfect-clear count rather than the ceiling matters: with the ceiling that term dominates and swamps the bound for no reason. |

Worked example against the §4.2 tuple (`ticks` 144,000; `pieces` 6,006; `lines` 1,712; `perfectClears` 3;
`garbageRowsReceived` 190):

```
maxPieces              = floor(144000/2) + 1                        =     72,001
maxGarbageGroups       = floor((144000 - 3600)/120) + 1             =      1,171
maxGarbageRowsReceived = 1,171 x 1                                  =      1,171
safeGarbageRows        = min(190, 1171)                             =        190
maxLines               = floor(6006*4/10) + 190 = 2402 + 190        =      2,592
maxCombo = 1711    maxQuadClears = 428    maxPerfectClears = 856    expectedLevel = 30
expectedBagRefills     = 2 + 858                                    =        860
maxScore               = 1712 x 66,000                              = 112,992,000
                       +    3 x 96,000                              =     288,000
                       + 6006 x 48                                  =     288,288
                       + 1171 x 7,500                               =   8,782,500
                       + 2400 x 300                                 =     720,000
                                                                    -------------
                                                                    = 123,070,788
```

Be honest about `maxScore`: even tightened it is **~12.5× the example's 9,864,300**, because it stacks every
best case at the level cap simultaneously. It is a backstop against a submitted score with an extra digit,
not a discriminating test. `maxGarbageRowsReceived`, `expectedBagRefills` and `expectedLevel` are the checks
that actually bite.

### 5.2 Tolerances

Mirrors `INTEGRITY_TOLERANCE` (`hmh-run-integrity.mjs:35`:
`Object.freeze({ score: 3.0, kills: 1.6, xpPerKill: 1.35, combo: 1.5 })`). STACKED's are **much tighter**,
because unlike HMH's swarm-density estimates these ceilings are combinatorial identities, not balance
guesses:

```js
export const STACKED_INTEGRITY_TOLERANCE = Object.freeze({
  score:   1.25,   // the ceiling is already loose; slack only for future multipliers
  pieces:  1.00,   // the placement-tick floor is a sim invariant — no slack
  lines:   1.00,   // the 4-cells-per-piece bound is arithmetic — no slack
  combo:   1.00,   // combo <= lines - 1 is definitional — no slack
  garbage: 1.00,   // rows are bounded by the rise curve's floor interval — no slack
  pps:     1.15,   // slack on the *sustained* soft ceiling only
});
```

Every comparison in §5.3 multiplies by its tolerance even where it is `1.00`. That is deliberate: a `1.00`
entry records "we decided there is no slack here" as a value a future maintainer can find and change in one
place, instead of as an absence they have to notice.

### 5.3 Flags and verdicts

```js
validateStackedRunPlausibility({
  score, pieces, lines, level, maxCombo, quadClears, perfectClears, ticks,
  garbageRowsReceived, garbageRowsCleared, garbageGroups, garbageDraws,
  holdsUsed, bagRefills, bagDraws, transitionCount,
})
```

Sixteen fields, not the twelve an earlier draft listed: `transitionCount`, `garbageGroups`, `garbageDraws`
and `bagRefills` were referenced by flags the signature did not accept. `transitionCount` comes from the SIC1
header, so it is available on the pre-re-simulation pass too. Returns the frozen shape
`validateRunPlausibility` returns (`hmh-run-integrity.mjs:205-215`):
`Object.freeze({ ok, verdict, rankable: !rejected, flags, ceilings })`, `verdict` in
`'ok' | 'suspicious' | 'rejected'`, flags shaped `{ code, severity, detail }` to match
`leaderboardRowTrust`'s tooltip renderer, which reads `flag.code` and `flag.detail`
(`official-leaderboard-route.mjs:328`).

| Code | Severity | Condition |
|---|---|---|
| `non-integer-run-stat` | reject | any numeric field is not a non-negative safe integer. **Checked first**: every other formula assumes integers, and `NaN > x` is `false`, so an unchecked `NaN` passes every ceiling silently. |
| `no-ticks-with-progress` | reject | `ticks <= 0 && (score > 0 \|\| lines > 0 \|\| pieces > 0)` |
| `run-exceeds-tick-budget` | reject | `ticks > STACKED_MAX_TICKS` |
| `pieces-exceed-placement-floor` | reject | `pieces > ceilings.maxPieces * tol.pieces` |
| `garbage-exceeds-rise-rate` | reject | `garbageRowsReceived > ceilings.maxGarbageRowsReceived * tol.garbage` — **evaluated before `maxLines` is used**, so an inflated garbage claim is rejected on its own terms rather than quietly widening the line ceiling |
| `garbage-groups-exceed-rise-rate` | reject | `garbageGroups > ceilings.maxGarbageGroups * tol.garbage` |
| `garbage-groups-exceed-rows` | reject | `garbageGroups > garbageRowsReceived` — sound at `GARBAGE_ROWS_PER_INJECTION >= 1`, and stays sound when versus adds multi-row groups |
| `garbage-cursor-below-groups` | reject | `garbageDraws < garbageGroups` |
| `garbage-cleared-exceeds-received` | reject | `garbageRowsCleared > garbageRowsReceived` |
| `lines-exceed-piece-mass` | reject | `lines > ceilings.maxLines * tol.lines` |
| `combo-exceeds-lines` | reject | `maxCombo > ceilings.maxCombo * tol.combo` |
| `quad-clears-exceed-lines` | reject | `quadClears * 4 > lines` |
| `perfect-clears-exceed-piece-mass` | reject | `perfectClears > ceilings.maxPerfectClears` |
| `bag-refill-mismatch` | reject | `bagRefills !== ceilings.expectedBagRefills` — exact equality, safe because refills are a counter, not an RNG cursor |
| `bag-cursor-below-refills` | reject | `bagDraws < 6 * bagRefills` — a lower bound, **not** equality; `nextBelow` rejections can push the cursor above `6 × refills` on a legitimate run (§2) |
| `holds-exceed-pieces` | reject | `holdsUsed > pieces` — sound only because hold is once-per-piece (§2) |
| `level-inconsistent-with-lines` | reject | `level !== ceilings.expectedLevel` — the level curve is a pure function of lines; if it stops being pure this flag is dropped rather than fudged |
| `level-cap-exceeded` | reject | `level > STACKED_LEVEL_CAP`. Redundant while `expectedLevel` is present and capped; kept as the check that survives if that curve is dropped. |
| `transitions-exceed-budget` | reject | `transitionCount > STACKED_MAX_INPUT_TRANSITIONS` |
| `transitions-exceed-ticks` | reject | `transitionCount > ticks` — recorder invariant 1 allows at most one record per tick index (§3.1) |
| `score-implausible` | suspect | `score > ceilings.maxScore * tol.score` |
| `pps-sustained-implausible` | suspect | `ticks >= SUSTAINED_MIN_TICKS && pieces / (ticks/60) > SUSTAINED_PPS_SOFT * tol.pps` |
| `lps-sustained-implausible` | suspect | `ticks >= SUSTAINED_MIN_TICKS && lines / (ticks/60) > SUSTAINED_LPS_SOFT * tol.pps` |
| `replay-absent` | suspect | Ranked run submitted with no decodable SIC1 stream |

`maxBackToBack` is deliberately ungated: a bound of `lines - 1` is trivially satisfied and adds nothing the
combo check does not cover. It is in the tuple because re-simulation compares it exactly, which is the real
check. The `SUSTAINED_MIN_TICKS` guard is not decoration: a 20-second sprint at 4.5 PPS is a real thing a
human does, and without the guard every short Ranked run by a good player is flagged and the flag stops
meaning anything.

Every `reject` is a combinatorial impossibility or an exact identity, so a legitimate run cannot trip one.
Every `suspect` is a statistical judgement, so a suspect run still ranks and is marked for review — matching
the existing `rankable: !rejected` semantics (`hmh-run-integrity.mjs:212`).

### 5.4 A fourth verdict at the trust layer, and four defects that block it

`leaderboardRowTrust` (`arcade-core.mjs:4485`, module-private, called at `:4562` and `:5905`) resolves a row:

```js
// arcade-core.mjs:4488, verbatim
const verdict = flagged?.verdict ?? session?.integrity?.verdict
  ?? (row.settlementTxHash || session?.settlement?.primaryTxHash ? 'settled' : 'prototype');
```

and returns exactly four label/tone pairs — `Rejected`/`danger`, `Needs review`/`warning`,
`Settled`/`verified`, `Prototype`/`muted` (`:4489-4500`). The badge is the `TRUST` column declared
`['trust', 'TRUST', 'trust']` at `official-leaderboard-route.mjs:274`, built at `:325-330`, with
`entry.trust.flags` joined into its `title` at `:327-328`. Add one verdict:

| Verdict | Label | Tone | Meaning |
|---|---|---|---|
| `verified` | `Replay verified` | `verified` | Re-simulation reproduced the exact result tuple and the gate returned `ok` |
| `settled` | `Settled` | `verified` | (unchanged) an on-chain receipt exists |
| `suspicious` | `Needs review` | `warning` | Re-simulation matched but a soft ceiling was exceeded |
| `rejected` | `Rejected` | `danger` | Re-simulation mismatched or a hard ceiling was breached — **never written to the board**, so this label only appears on a historical row |
| `prototype` | `Prototype` | `muted` | No replay evidence (legacy rows, and every row today) |

**Four verified defects must be fixed for this column to mean anything. All four are live on `main`.**

1. **No verdict is ever persisted.** `applySettlement` (`arcade-core.mjs:5638`) is the *only* writer of
   `state.sessions[id].integrity` and `state.flaggedSessions` (`:5692-5700`), called from exactly one place —
   `apps/portal/main.js:2877`, inside `if (SETTLEMENT_LIVE && isRealWallet)` (`main.js:2846`).
   `SETTLEMENT_LIVE` is `false` (`apps/portal/src/settlement.mjs:27`) and `main.js` returns inside the
   `if (!SETTLEMENT_LIVE)` branch at `:2822`, so `:2877` is unreachable. It also explicitly skips storing
   `'ok'` verdicts as noise. STACKED's lifecycle must write the verdict through a new
   `recordRunIntegrityVerdict(state, sessionId, verdict)` in `arcade-core.mjs`, and must persist `'verified'`
   as well as the negative verdicts.
2. **Anything written to `state.sessions` dies on reload.** `snapshotArcadeState` (`persistence.mjs:27-51`)
   persists only `version`, `savedAt`, `seeded`, `profiles`, `usernames`, `cadenceLeaderboards`, `runHistory`,
   `activeSessionCheckpoint`, `submittedSessionIds`. `state.sessions` and `state.flaggedSessions` are absent,
   and `restoreArcadeState` (`:55`) has no migration — it returns `false` unless `snapshot.version` is in
   `[1, 2, ARCADE_PERSIST_VERSION = 3]`. So the verdict goes into the cadence row's `runStats` bag, which
   `recordCadenceScore` (`leaderboard-engine.mjs:77`) copies verbatim into every row (`:92`) and which *is*
   persisted. `leaderboardRowTrust` is extended to read `row.runStats?.trustVerdict` **ahead of** the session
   lookup.

   **Three integrity fields, and the third must be truncated.** `trustVerdict` (short enum), `replayFlags`
   (array of short codes, empty on a clean run), and — not the full 66-character `resultHash` —
   `resultHash16`, its first 16 hex characters. Size math: `recordCadenceScore` keeps `limitPerPeriod = 100`
   rows per bucket (`leaderboard-engine.mjs:77, 105`) across **five** cadences, and daily and weekly accrue a
   new bucket per period. A 90-day season is ~90 daily + ~13 weekly + 3 monthly + 1 yearly + 1 all-time ≈ 108
   buckets; at 100 rows and ~400 bytes of JSON per row that is ~4.3 MB of `cadenceLeaderboards` before STACKED
   adds anything. The full hash adds 66 characters plus key and quoting to every row — ~17% on a structure
   already at risk of tripping `saveArcadeState`'s final fallback, the one that drops **all** leaderboards
   (`persistence.mjs:101`). Sixteen hex characters is 64 bits, ample for "does this row match a stored replay"
   on a board holding hundreds of rows, at a quarter the cost; the full `resultHash` lives in the replay blob
   (§3.6), where a real re-verification reads it anyway. `resultHash16` is one of the 16 keys in the frozen
   `runStats` projection.

   The cadence store has no per-cabinet quota and no eviction beyond per-bucket row count. That is
   pre-existing and arcade-wide; adding a third cabinet is a reason to measure
   `JSON.stringify(state.cadenceLeaderboards).length` in a test, not a reason to skip the trust fields.
3. **The badge does not render the trust label for any row that can exist today.**
   `official-leaderboard-route.mjs:326` sets badge text as
   `provenance.official ? (entry.trust?.label ?? 'Pending') : provenance.label.replace('HOUSE SCORE', 'House Score')`,
   and `leaderboardEntryProvenance` (`leaderboard-seed.mjs:30`) only returns the `official: true` provenance
   (`OFFICIAL_SCORE_PROVENANCE`, `:21`) when `entry.settlementTxHash` is set. With `SETTLEMENT_LIVE = false`
   no row ever has one, so every real ranked row renders `LOCAL` (`:22`) — and
   `filterLeaderboardEntriesBySource` (`:38-45`) drops those rows entirely from the "Verified Ranked" tab.
   Fixing defects 1 and 2 without this one produces a correct verdict nobody can see. Fix:
   `leaderboardEntryProvenance` must treat a row carrying `runStats.trustVerdict === 'verified'` as a distinct
   third provenance (`source: 'replay-verified'`, `official: false`, `label: 'REPLAY VERIFIED'`), and the
   badge must render `entry.trust.label` for it. On-chain settlement remains a strictly stronger claim and
   keeps its own label.
4. **`submittedSessionIds` is never populated, so there is no resubmission barrier at all.** It is only
   appended by `clearActiveSessionCheckpoint(state, id, { submitted: true })` (`persistence.mjs:173-176`), and
   the only caller passing `true` is `apps/portal/main.js:2878`, inside the unreachable
   `SETTLEMENT_LIVE && isRealWallet` branch; the reachable branch at `main.js:2822` calls it at `:2823` with
   `{ submitted: false }`. With `SETTLEMENT_LIVE === false` the list is empty on every real run. §7's
   "replayed replay" row assumed it was doing work; it is not. STACKED's lifecycle must call
   `clearActiveSessionCheckpoint(state, sessionId, { submitted: true })` itself after a successful leaderboard
   write, independent of settlement — which also turns `saveActiveSessionCheckpoint`'s "submitted sessions
   cannot be checkpointed again" throw (`persistence.mjs:155`) into a working duplicate-submission guard for
   the first time.

---

## 6. Files and tests

The full module and test map is contract §2.10; this lists only what integrity adds or changes.

| File | New/changed | Contents |
|---|---|---|
| `apps/portal/src/seeded-rng.mjs` | changed (additive) | `uint32()`, `nextBelow(n)` on `SeededRng` |
| `apps/portal/src/stacked-sim.mjs` | new | Pure integer sim + codec: `createStackedRuntime`, `simulateStackedRun`, `replayStackedRun`, `encodeSic1`, `decodeSic1`, `buildStackedResultTuple`, `refillBag`, `STACKED_SIM_CONSTANTS`. Imports only `./seeded-rng.mjs` and `./stacked-contracts.mjs`. |
| `apps/portal/src/stacked-cabinet.mjs` | new | `STACKED_CABINET_VERSION`, `buildStackedReplayClaim`, `verifyStackedReplayClaim({ expectedSeed, expectedBuildHash, expectedSeasonId, ... })`. Imports `sha256Hex` and `canonicalSessionJson` only. **Must not import `arcade-core.mjs`** (§4.1). |
| `apps/portal/src/stacked-run-integrity.mjs` | new | `STACKED_INTEGRITY_TOLERANCE`, `deriveStackedRunCeilings`, `validateStackedRunPlausibility`. Imports constants from `stacked-contracts.mjs`; **re-exports none**. |
| `apps/portal/src/stacked-replay-store.mjs` | new | `stacked-replay-v1:*` keys, 2-replay LRU, index key, quota-safe writes outside `snapshotArcadeState` |
| `apps/portal/src/stacked-portal-lifecycle.mjs` | new | `createStackedPortalLifecycle({ state, session, recordScoreRef, persist, onComplete })`, `startStackedRankedSession`, `assertStackedVerifiedStamp` and the stamp `WeakSet`; payload validation (§4.6); `inFlight` + `finalized` latches; worker dispatch with inline fallback; checkpoint save/clear; verdict persistence; `registerRunVerifier('stacked', fn)`. The only new module allowed to import `arcade-core.mjs`. |
| `apps/stacked/src/verify-worker.mjs` | new | Imports `stacked-sim.mjs`, replays, posts back the tuple. Rendering-free by construction. |
| `apps/portal/src/arcade-core.mjs` | changed | `registerRunVerifier(gameId, fn)` + registry replacing the `game.id === 'chikun'` branches at `:5483` and `:5307`; `requiresRunVerifier` on the `ARCADE_GAMES` entries; `recordRunIntegrityVerdict`; `leaderboardRowTrust` (`:4485`) reads `row.runStats.trustVerdict` and knows `'verified'` |
| `apps/portal/src/leaderboard-seed.mjs` | changed | `replay-verified` provenance in `leaderboardEntryProvenance` (`:30`) and `filterLeaderboardEntriesBySource` (`:38`) |
| `apps/portal/src/routes/official-leaderboard-route.mjs` | changed | Badge at `:325-328` renders `entry.trust.label` for replay-verified rows |
| `build.mjs` | changed | Fourth entry point `'stacked/verify-worker'` in `entryPoints` (`:109-113`) |
| `vercel.json` | changed | Cache rule `:18` becomes `"/dist/(hmh-reboot\|chikun\|stacked)/(.*)"`. No worker CSP change (§4.1). |
| `scripts/stacked-sim-purity-check.mjs` | new | Banned-token + trademark static gate, `npm run design:stacked-purity` |
| `scripts/syntax-check.mjs` | changed | Append every module and test above to `NODE_CHECK_FILES` (`:22`) |
| `package.json` | changed | One new script, `design:stacked-purity`. `npm test` (`:8`) needs no change. |

**Tests.** `npm test` is a glob, so a new `tests/*.test.mjs` file is picked up without a script change.

- `tests/stacked-sim-determinism.test.mjs` — same seed + same inputs → identical result tuple, twice; a
  different seed diverges; golden first-40-piece bag sequence for seed `0x1337`; the
  `bagRefills = 2 + floor(pieces/7)` identity; `bagDraws >= 6 × bagRefills`; a 432,000-tick replay completes in
  under 1,500 ms with the measured figure printed.
- `tests/stacked-input-codec.test.mjs` — SIC1 round-trip on random masks; short/general/terminator forms; a
  multi-bit same-tick change encodes as one general record; reserved lead bytes `0x81`–`0xFE` rejected; a
  terminator tick index disagreeing with the header rejected; truncated stream rejected; over-cap stream
  rejected; measured byte size of a synthetic 144,000-tick / 120,000-transition run asserted `< 140,000` bytes
  (the §3.4 derivation, asserted rather than trusted).
- `tests/stacked-evidence-codec.test.mjs` — an all-general-form stream of 432,000 records encodes to
  `<= STACKED_MAX_EVIDENCE_BYTES`; the tick ceiling provably fires before the evidence ceiling; chunking
  round-trip at 42,000 raw bytes with no interior padding; reassembly rejects a missing index, a duplicate
  index, a `chunkCount` mismatch, a `totalRawBytes` mismatch, and a count over
  `STACKED_MAX_EVIDENCE_CHUNKS`.
- `tests/stacked-replay-claim.test.mjs` — claim build/verify round-trip, plus tamper cases: wrong seed, seed
  not derivable from `sessionId`, wrong `buildHash`, wrong `seasonId`, mutated score, mutated `boardHash`,
  mutated RNG cursors, mutated `bagRefills`, a stamp object not in the lifecycle `WeakSet`.
- `tests/stacked-run-integrity.test.mjs` — each reject and suspect flag fires on its own; **an inflated
  `garbageRowsReceived` is rejected on its own terms and does not widen `maxLines`**; a `NaN` field is rejected
  rather than passing every ceiling; a run whose `bagDraws` exceeds `6 × bagRefills` by a few still returns
  `ok`; a 20-second 4.5-PPS sprint returns `ok` (the `SUSTAINED_MIN_TICKS` guard); a realistic 20-minute run
  returns `ok`; the §5.1 worked example reproduces `maxScore = 123,070,788`.
- `tests/stacked-portal-lifecycle.test.mjs` — `inFlight` rejects a concurrent second `handleResult` before the
  first resolves; `finalized` rejects a later one; free mode writes nothing; each of the six §4.6 validation
  steps fails closed with its own reason code; a verification throw yields `rejected` with no leaderboard
  write; the score written is `canonical.score`, not the submitted number; a `Worker` constructor that throws
  falls back inline and still produces a verdict; the checkpoint is saved at start and cleared with
  `{ submitted: true }` after a successful write; 2-replay LRU eviction; a write at
  `STACKED_MAX_STORED_REPLAY_CHARS` measured against the character budget; an over-budget stream is refused
  with reason `replay-too-large` without failing the run; storage write failure is non-fatal.
- `tests/stacked-sim-purity.test.mjs` — asserts the purity script passes on the shipped sim.
- `tests/arcade-core.test.mjs` (existing, extended) — every `requiresRunVerifier` cabinet has a registration
  path; `recordScore` throws for a ranked session on such a cabinet with no verifier registered.

---

## 7. Threat model

"Stops" = the attack cannot succeed. "Detects" = it succeeds but leaves a signal. "Open" = neither, until a
server exists.

| Attack | Status | Mechanism | Honest limit |
|---|---|---|---|
| **Tampered client score** — send a bigger number in `game:result` | **Stops** | The board is written from `canonical.score` produced by parent-side re-simulation, never the submitted number. `exactKeys()` plus the six-step check (§4.6) reject a malformed payload before any work. | None for this attack. But "parent-side" means "other JS on the same page"; see the last row. |
| **Edited input stream** — hand-craft or splice a SIC1 buffer | **Stops (as a shortcut) / Open (as effort)** | Any edit that does not re-simulate to the claimed tuple is rejected; `boardHash` and the RNG cursors make the claim over-determined. Reserved lead bytes and the terminator tick index block truncation and skip tricks; chunk reassembly rejects gaps and duplicates before decode. | An attacker who *runs the real sim* over synthetic inputs produces a valid claim. Verification proves the inputs produce the score; it proves nothing about who produced the inputs. |
| **Replayed replay** — resubmit a good run under a new session | **Detects, once STACKED builds the barrier** | A claim carries its session's seed, so it verifies only against a session whose derived seed matches — which the attacker can arrange, because `startPlaySession` accepts `sessionNonce`. The intended barrier is `submittedSessionIds`. | **That list is empty today** (§5.4 defect 4). Even populated it is `localStorage`, capped at 1,000 (`SUBMITTED_SESSION_LIMIT`, `persistence.mjs:16`), newest-first with oldest evicted, cleared by clearing site data. A nuisance barrier, not a control. |
| **Seed shopping** — pick the identity whose bags you like | **Open** | Nothing. `deriveSessionSeed` is a 32-bit FNV-1a over a string and `startPlaySession` accepts caller-supplied `sessionNonce` / `urlSessionId`; an offline search finds a favourable seed in milliseconds with no session start and no simulation. | Not prevented, and barely detected — an offline search leaves no abandoned checkpoints. Fixed only by a server-issued, wallet-and-timestamp-bound session identity. |
| **Session-start reroll** — start and abandon until a friendly bag appears | **Detects only, after STACKED wires the checkpoint** | Abandoned-start ratio; one live Ranked checkpoint per wallet. `saveActiveSessionCheckpoint` has no cabinet caller today (§1), so this signal does not exist until STACKED creates it. | Genuinely not prevented; starts are free and local. Strictly weaker than seed shopping, and only matters for a player who will not open a console. |
| **Save-file editing** — hand-write a row into `lesters-arcade-save-v1` | **Detects only** | A hand-written row has no `resultHash16`, so it renders `Prototype`. A row claiming `verified` whose hash no stored replay reproduces is flaggable on the next load. | The board is `localStorage`. A player can put any number in it and will see it. It affects nobody else, because there is no shared board. |
| **Time manipulation** — move the clock to pick a bucket, or fake a long run | **Half stops, half open** | Run length is `survivalTicks` from the re-simulated stream — the clock cannot inflate it, and ticks are capped at 432,000. **But** `recordCadenceScore` (`leaderboard-engine.mjs:85`) stamps `recordedAt` from `entry.recordedAt ?? new Date().toISOString()` and `periodKeyFor` (`:39`) buckets by UTC. | Bucket selection is unaddressed — a pre-existing property of the local board, not something this cabinet introduces. |
| **Bot / TAS play** — a script emits a tick-perfect stream and drives the real sim | **Not addressed. At all.** | See below. | See below. |
| **Shared or stolen replays** — a strong player's buffer used by another wallet | **Stops, weakly** | The claim carries `seed`, `buildHash` and `seasonId`, so it verifies only against a session with the same derived seed, requiring the same `sessionId`, which `submittedSessionIds` then rejects as already submitted *on that browser profile*. | On a second browser profile it verifies fine. The board is per-browser, so there is nothing to steal a placement from — until the board is shared, at which point this row becomes real and this mitigation inadequate. |
| **Hostile page context** — extension, devtools, or patched bundle replaces the verifier | **Open** | Nothing. The stamp `WeakSet` raises the bar past copy-pasting a value, and nothing more. The iframe sandbox isolates the *child* from the parent, not the parent from the page it runs in. | The ceiling on every claim in this table. All verification runs in the attacker's own JS realm. |

**Be blunt about TAS and bots.** Perfect deterministic replay verification does not prove a human played. It
proves that *some* sequence of button masks, applied at 60 Hz to this seed, produces this score. A script
emitting tick-perfect masks and driving `stacked-sim.mjs` headlessly in Node produces a claim that passes
every check here, in seconds, at a score no human will match. That is not a gap in the implementation; it is
the definition of what replay verification does. Three things are true at once and the roadmap must say all
three: (1) replay verification is still worth shipping, because it eliminates the *cheap* attacks that
actually happen at this scale; (2) the Ranked board is local, unshared and zero-stakes today, so a TAS run
pollutes one person's `localStorage`; (3) the moment the board is shared or carries value, TAS is the
dominant attack and the mitigations below become prerequisites, not enhancements.

| Mitigation | What it buys | Requires |
|---|---|---|
| Server-issued session identities, bound to wallet + issue timestamp, short TTL | Kills seed shopping outright — the cheapest exploit in the table — and time-boxes replay submission | A backend that mints and stores session identities |
| Server-side re-simulation of the submitted SIC1 stream | Moves the authority out of the attacker's realm — the biggest jump in this table | The same `stacked-sim.mjs`, run in Node. Already designed for this (§4.1). |
| Rate limits per wallet (runs/hour, submissions/day) | Bounds TAS and reroll throughput | Backend |
| **Input-timing statistics** — distributions of inter-transition tick gaps, DAS hold lengths, rotation-to-drop latency, per-piece placement-time variance | The real anti-TAS signal. Human input has characteristic jitter and a long right tail; a TAS has near-zero variance and impossible reaction latencies. `SIC1` already records exactly this data at exactly this resolution. | Backend + a human corpus. **Two caveats to design in, not discover:** the gap distribution is shaped by display refresh rate (§4.5), so the statistic must normalise on `sampledTicksPerSecond` or it flags 144 Hz players as machines; and touch produces a categorically different distribution from keyboard, so mobile needs its own baseline. **Collect the corpus from Phase 1 replays now**, tagged with `sampledTicksPerSecond` and `handling.inputDevice`. |
| Human-review queue for top-N runs | Catches what statistics miss | Backend + a person |
| Attested clients / signed builds | Raises the cost of a patched bundle | Out of scope for a static site |

---

## 8. What must be true before this leaderboard can carry value

`DEFAULT_ENTRY_FEE_MICRO_USDC = 0` (`arcade-core.mjs:69`, "Ranked is free on testnet — only zkLTC gas for
settlement") and every `ARCADE_GAMES` entry uses it, chikun included (`:2205`). `SETTLEMENT_LIVE = false`
(`apps/portal/src/settlement.mjs:27`). **This document does not propose changing either.** These are
conditions that would have to be *already true* first — a checklist for a future decision, not a request
for one.

1. **A backend exists and is the authority.** Session identity, seed issuance and re-simulation all move
   server-side. Until then "verified" means "verified by code the player controls". The UI copy at
   `arcade-core.mjs:4477` already says this out loud — *"Scores are player-submitted and not yet cheat-proof
   on-chain…"* — and must not be softened while it remains true.
2. **The board is shared, not local.** `cadenceLeaderboards` lives in `localStorage`
   (`lesters-arcade-save-v1`, `ARCADE_PERSIST_VERSION = 3`); `state.leaderboards` is not even persisted. A
   local board cannot carry value because there is nobody to take value from.
3. **Anti-TAS is real, not aspirational.** Input-timing statistics on a real human corpus, plus rate limits,
   plus a review queue for top placements. Deterministic replay alone is not sufficient and must never be
   presented as if it were.
4. **The trust column is honest and functional.** All four §5.4 defects fixed: verdicts written, surviving a
   reload, rendered, and resubmission actually barred. A trust column showing `LOCAL` for every row while the
   marketing says "verified" is worse than no column.
5. **Every ranked row carries a stored, re-verifiable replay.** Today retention is 2 per browser. Value
   requires durable server-side storage, so a placement can be re-checked months later and a season
   re-verified wholesale after a verifier bug fix.
6. **Season and build binding are enforced end to end.** `buildHash` includes `cabinetVersion`
   (`arcade-core.mjs:5234`), so a gameplay-affecting change rotates every seed and retires the season's
   replays. That must be *stated policy*: a balance patch mid-season either forks the season or invalidates
   the board.
7. **A written, published statement of what verification does and does not prove.** If entry ever costs
   money, players are entitled to know that a passing replay check does not mean a human played. Ship that
   sentence in the product, not just in this document.

Until all seven hold, STACKED Ranked is a **local, unshared, zero-fee integrity prototype**. Ship it as one,
describe it as one.

---

## 9. Open questions owned here

Terminology, ceilings, the season id, the level and combo caps, the `terminalReason` enum and the tick/frame
vocabulary are **frozen** in `docs/stacked/STACKED-CONTRACTS.md` and no longer open. What remains:

1. **`SUSTAINED_PPS_SOFT = 3.2`** — the only judgement number left in the gate (`SUSTAINED_LPS_SOFT` is
   derived from it). Re-derive from the first 100 real ranked runs; soft-only by design, so a wrong guess
   flags rather than blocks.
2. **Pause policy in Ranked** (G-7). Today: unlimited pausing, unlimited thinking time, replay unaffected.
   The alternative is a pause budget, a balance call. `pauseCount` and `pausedWallClockMs` are recorded either
   way so the decision can be made from data.
3. **Whether a `rejected` run appears on the board at all.** This design never writes it; writing it with a
   `Rejected` badge for transparency is the alternative, and a product call.
4. **Whether `abandonedRankedStarts` is shown publicly on the profile** or kept internal. §7 shows it is a
   weak signal, so publishing it may overstate what it catches.
5. **Replay retention of 2 per browser.** If a results-screen replay viewer or a same-seed ghost is wanted
   sooner than the roadmap assumes, this number and the storage key shape change.
6. **Whether the cadence leaderboard needs a size budget before a third cabinet joins it.** §5.4 defect 2
   estimates ~4.3 MB for a 90-day season at current limits, against a quota that also holds profiles and
   avatars. Pre-existing and arcade-wide, but STACKED is what makes it three cabinets deep.

Cross-device Ranked fairness (G-19) is recorded in `docs/stacked/DECISIONS.md`; the data it needs — the
`handling` block's `dasTicks`, `arrTicks`, `dcdTicks` and `inputDevice` — is collected from run one and is
**metadata only: never hashed, never ranked, never fed to the verifier.** The ledger for that cycle must not
describe this document's determinism proof as a fairness proof. Determinism and parity of difficulty are
different claims.
