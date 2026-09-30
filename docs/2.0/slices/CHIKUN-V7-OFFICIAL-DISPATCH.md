# Chikun course two — official version-based dispatch (gated off)

September 30, 2026. Follows `CHIKUN-COURSE-TWO.md`, which left "official
game-version-to-evidence dispatch in its release slice; parent/server review for
that dispatch" open. This slice adds that dispatch and keeps it closed. No
cabinet, site, game or service-worker version changed. Nothing here makes
course two public, Ranked-eligible or settleable.

## What is implemented

**One dispatch table**, `apps/portal/src/chikun-official-course.mjs`, keyed by
evidence version (`CHIKUN_OFFICIAL_COURSES_BY_VERSION`) and by course id
(`CHIKUN_OFFICIAL_COURSES_BY_ID`). It has no imports (the host bundle carries
only strings) and is imported by the server verifier and the portal host:

| course | evidence version | §5.1 encoding | runtimeId | gate |
| --- | --- | --- | --- | --- |
| 1 (default) | `chikun-flap-evidence-v6` | `chikun-flap-evidence-v6+json` | `chikun:canvas-runtime-v7` | none |
| 2 | `chikun-input-evidence-v7` | `chikun-input-evidence-v7+json` | `chikun:canvas-runtime-v7:course-2` | `CHIKUN_OFFICIAL_COURSE_TWO_ENABLED` |

**The gate** is the literal `export const CHIKUN_OFFICIAL_COURSE_TWO_ENABLED = false;`
in that module. Only boolean `true` opens it. Nothing reads a URL, query
string, environment variable, storage or claim field to change it;
`tests/chikun-official-course.test.mjs` pins the literal and the module's lack
of imports. Tests inject `courseTwoEnabled: true` through options
(`verifyRankedRun`, `verifyChikunRun`, `computeEvidenceDigest`,
`reverifyStoredRun`, `createChikunHost`) and never flip the constant.

**Server verifier** (`server/verify/chikun.mjs`): the evidence encoding must be
one the gate allows, then the flap version resolves through the table to a
course whose encoding matches. Per course: exact keys, seed binding to the
bound ticket seed, `fixedStepHz` 60, `maxTicks` 1..216,000, bounded strictly
parsed input streams, a clean copy, the cabinet replay (`replayChikunRun`,
which dispatches v7 to `replayCourseV2`), canonical termination (a flap or
glide transition at or after the terminal tick is `replay-rejected`), a
terminal reason, and a result whose evidence version is the dispatched course.
Course two adds: `flapDeltas` and `glideDeltas` each strictly increasing and
inside `maxTicks`, at most **12,000 combined** transitions
(`CHIKUN_OFFICIAL_MAX_TRANSITIONS`, equal to the runtime's `GROUND_MAX_FLAPS`
and to the v6 flap cap). Wallet, session key and ticket binding are the shared
`bindRankedIdentity` path, identical for both courses.

A verified course-two run carries `runtimeId` `chikun:canvas-runtime-v7:course-2`,
evidence encoding `chikun-input-evidence-v7+json`, the canonical JSON of the
six-key v7 object as evidence text, and stats keyed exactly
`CHIKUN_V7_STATS_KEYS` = the seventeen v6 keys (`score`, `survivalTicks`,
`survivalSeconds`, `coinsCollected`, `forksPassed`, `nearMisses`, `bestCombo`,
`nearMissStreakBest`, `flawlessRegions`, `flapCount`, `distanceMeters`,
`regionIndexReached`, `regionReached`, `laps`, `speedMultiplierReached`,
`terminalReason`, `evidenceVersion: 'chikun-input-evidence-v7'`) followed by
`glideCount`, `shieldsUsed`, `powerupsCollected`. The contract fields map as
for v6 (kills = forks passed, maxCombo, survivalSeconds, no boss).

`server/verify/index.mjs` threads the same `courseTwoEnabled` option through
`verifyRankedRun`, `computeEvidenceDigest` (which now reports the body's own
accepted encoding) and `reverifyStoredRun`; `parseChikunEvidenceText` picks the
stored version's encoding. `server/verify/verified-run.mjs` accepts an optional
`runtimeId` that must extend the game's runtimeId with `:`; every other caller
is unchanged.

`apps/portal/src/ranked-identity.mjs` lists both Chikun encodings under a new
`evidenceEncodings` array (the single `evidenceEncoding` default is unchanged),
so the one `rankedEnvelopeHash` / `evidenceDigestFor` implementation covers a
v7 envelope without a second copy of the formula. Listing is hashing, not
acceptance: acceptance is the verifier's gate.

**Portal host** (`apps/portal/src/chikun-host.mjs`): takes `courseTwoEnabled`
(default: the shared constant), exposes `officialCourse()` and forwards
`course=2` to the child for ordinary sessions only when the gate is open. The
private unranked Free preview via `?course=2` is untouched, and no URL can move
a Ranked session off course one while the gate is closed.

**Fixture** `tests/fixtures/ranked/chikun-course-two.json` (built by
`buildChikunCourseTwoEvidence` in `build-fixtures.mjs`, kept apart from
`FIXTURE_NAMES` like the HMH schema-7 fixtures): a real course-two run from
`createChikunRuntime` — two minutes of the region autopilot with the jump key
held while airborne and falling (182 flaps, 314 held-glide transitions, a
Scrypt Shield taken and spent, ending in a real collision), then no input until
the course ends it. Its `expected` block records the gate-closed refusal and the
gate-open VerifiedRun. `node tests/fixtures/ranked/build-fixtures.mjs` rebuilds
and compares it with the others.

## What is frozen

- Course one / v6: the committed `chikun-valid` and `chikun-10min` fixtures
  rebuild byte-for-byte (same score, stats keys, encoding, text, digest,
  envelope hash and runtimeId) and verify identically whether the gate is open
  or closed. No v6 simulation, coin/scoring rule, daily seed, ghost, share or
  bridge behaviour changed.
- v1–v5 stay `evidence-version-unsupported` with the same detail text while the
  gate is closed (`Ranked accepts only chikun-flap-evidence-v6`), and stay
  refused when it is open.
- With the gate closed a v7 body is refused exactly as before: `invalid-evidence`
  under its own encoding, `evidence-version-unsupported` when smuggled under the
  v6 encoding; the digest and re-sign paths refuse it too.
- The bridge protocol still validates only v6 evidence and the child sends no
  `game:result` for course two; `ranked-requests.mjs` still settles only v6.

## Before the gate can be flipped

Independent verifier review and a release decision are still required for:

1. **Settle and storage paths outside `server/verify`** (not touched here):
   `server/settle/settle-core.mjs` `EVIDENCE_KEYS.chikun.encoding` is the v6
   string; `server/neon/migrations.mjs` has a `CHECK (encoding IN (...))` on the
   three v6-era encodings; `server/neon/rows.mjs` `INDEX_GAMES.chikun.runtimeId`
   and the on-chain `runtimeId32` are the course-one id. A course-two settle
   needs the encoding allowed there, a migration, and a decision on whether
   `chikun:canvas-runtime-v7:course-2` gets its own on-chain runtime id or is
   folded into the existing one.
2. **Child and bridge**: `chikun-bridge-protocol.mjs` `validateEvidence` accepts
   only v6; `apps/chikun/src/main.mjs` activates course two only for unranked
   Free and never sends its result; `ranked-requests.mjs` builds only a v6 body.
   Official course two needs those to carry v7 under the same gate, with the
   parent replay claim (`buildChikunReplayClaim` / `verifyChikunReplayClaim`,
   which pin v6) extended in a measured cycle.
3. **Course content**: `CHIKUN-COURSE-TWO.md` still lists magnet/feather
   playtesting, difficulty/balance, final obstacle art and physical-phone
   acceptance as open.
4. **Leaderboards, ghosts, shares and achievements**: a v7 run has its own
   runtimeId and extra stats; decide whether it shares a board with v6, and
   confirm the achievements mapper and rows treat the extra keys as intended.
5. **Version bump and certification**: flipping the gate changes runtime
   behaviour of the portal host and server verifier and therefore needs a new
   candidate, fresh certification and the deployment approvals in `AGENTS.md`.

## How to flip it (after the above)

Change the one literal in `apps/portal/src/chikun-official-course.mjs` to
`export const CHIKUN_OFFICIAL_COURSE_TWO_ENABLED = true;` in the same commit as
the settle/storage/bridge changes above, update
`tests/chikun-official-course.test.mjs` (which pins `false`) and the
`gateClosed` expectation of the course-two fixture, move
`chikun-course-two` into the ordinary fixture list, and bump the cabinet/game
versions per the release checklist. Rolling back is the reverse literal.

## Tests

- `tests/chikun-official-course.test.mjs`: gate literal and purity, table pins
  against `CHIKUN_RUNTIME_VERSION`, `RANKED_GAMES` and the course-two runtime,
  version dispatch under both gate states, envelope hashing of both encodings,
  host offering (closed: never; open: official sessions; preview unchanged).
- `tests/server-verify-chikun-course-two.test.mjs`: fixture realism, gate-off
  refusal on every path, gate-on acceptance with stats equal to a local replay,
  v6 untouched with the gate open, v1–v5 refused, encoding/version mismatch,
  claim ignored, seed mismatch, other-wallet copy, budgets and stream shape,
  inputs at/after the terminal tick, replay-file parity and fixture rebuild.
- `tests/server-verify-chikun.test.mjs` and the ranked fixture check prove the
  v6 path is unchanged.
