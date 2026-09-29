# STACKED S0 — durable maximal replay and first-use measurement

2026-09-29. Local fixture/harness slice on `codex/200-stacked-replay-20260929`, based on program commit `2d67acb9`. Runtime simulation, rules, evidence encoding, server verifier, versions, contracts and settlement are unchanged. Independent review and integration remain pending. This is not production-server, browser or physical-phone acceptance, and does not finish the STACKED track.

## Problem and resulting behavior

The historical 432,000-tick calibration evidence was absent from the clean integration tree and the named recovery locations. Existing timing coverage measured a warmed 54,017-tick run using the fastest sample under 500 ms. It could not establish the owner's longest-run under-250-ms target.

This slice commits a legal uninterrupted maximum-length recording, full canonical checkpoint expectations and exact verifier output. The opt-in benchmark runs actual server evidence decoding, complete headless replay and complete per-game verification in separate fresh processes. It retains every observation and fails if any operation reaches 250 ms, any result differs or any phase fails. No budget override, warm-up retry, skipped simulation tick or best-sample policy is provided.

## Fixture provenance

- Reproduced with the existing `createStackedSoakPilot({mode:'free'})`, sampling the actual unchanged runtime continuously at Ranked start level 1 until its 432,000-tick ceiling. No reset, reseed, board edit, rule override or fake elapsed time. This is a legal-input developer pilot recording, not a human run or published Ranked session.
- Seed `3978027289` and test session metadata reuse the committed 15-minute fixture. Score `96,604,870`; terminal `tick-ceiling`; generation took 181.537 seconds, including final replay/result verification.
- Evidence: 432,028 raw bytes, SHA-256 `769d2425938c2eb2659eaa97e0868a4089c633592c262b69a587d078a3d8dab1`. Gzip storage: 49,909 bytes; the loader verifies both compressed and uncompressed hashes. The manifest adds 63,757 bytes.
- The historical SHA-256 `3e64933b39da1680fcae9568815109e4bc522be059bce4ab2fd14096d00707d5` was not recovered and is not represented as matching this replacement.
- Ten checkpoints include every snapshot field, the entire board/queue/garbage state, RNG draw counts, exact canonical state bytes and state hash, at ticks 0, 10,800, 25,200, 43,200, 64,800, 90,000, 144,000, 216,000, 324,000 and 432,000. The terminal tuple and every canonical per-game `VerifiedRun` field are pinned; evidence text is checked byte for byte without duplicating it in JSON.
- Producer source hashes are recorded in the manifest. Fixtures are read directly from files; tests do not call Git. The generator is an explicit authoring command and refuses to overwrite the durable evidence. It is not imported or rerun by tests.

## Measurements — local environment only

Seven fresh Node processes per phase, all observations retained. Node `v24.17.0`, Windows x64. CPU/host details, wall and CPU time, memory deltas and canonical source hashes appear in [the complete report](STACKED-S0-baseline.json). Generation, timing and focused tests ran under the exclusively owned shared heavy lock; ownership was checked before releasing it.

| Measured first-use operation | Median wall time | p95 / maximum wall time | Result |
| --- | ---: | ---: | --- |
| Actual server base64 + evidence header decode | 33.7706 ms | 34.5573 ms | 7/7 correct, below 250 ms |
| Private SIC1 parse + all 432,000 headless ticks + terminal tuple/board hash | 171.1627 ms | 173.2194 ms | 7/7 identical, below 250 ms |
| Complete `verifyStackedRun` call | 204.8862 ms | 206.0789 ms | 7/7 identical, below 250 ms |

The final row already includes evidence decode, SIC1 parsing, simulation, stats mapping, evidence digest, envelope hash and result construction. The diagnostic phase times are **not summed**. Process startup, module imports, fixture disk read/decompression and expected-result assertions are excluded. Authentication, seed-ticket binding, paid-entry checking, API handling, network and settlement are excluded. These observations do not establish production Vercel CPU behavior, a cold-import budget or end-to-end API latency. With seven observations, nearest-rank p95/p99 equal the maximum; they are small-sample diagnostics.

No simulation optimization was made: current local replay already meets the requested target. Further optimization requires a measured bottleneck in the environment being certified.

## RED → GREEN and retained failures

1. Four opening tests failed because the maximal fixture and harness were missing.
2. Legal generation reached exactly 432,000 ticks. Its replay and per-game verification matched before saving the durable fixture.
3. The first benchmark correctly failed: decoder output was a `Uint8Array` while decompressed expected bytes were a Node `Buffer`; strict deep equality rejected their different prototypes despite identical bytes. All seven decode samples failed validation. Replay and verifier measurements from that failed batch remain visible in [the retained failed report](STACKED-S0-initial-harness-failure.json).
4. Added a fresh-process regression; it failed on the same decoder assertion. Normalized both containers to `Buffer` only for the equality assertion, retaining exact byte comparison. The timed production operation did not change.
5. The fresh seven-sample batch passed all three phases and the fixed under-250-ms gate. No earlier observation was discarded to select a faster result.
6. Focused tests: **32/32 pass**, zero skips/cancellations. Includes full maximal public-runtime checkpoint parity, actual sample processes, complete per-game verifier output, old Ranked fixture acceptance/rebuild, malformed evidence/seed rejection, private headless/public snapshot boundaries, collision/compaction equivalence, 256 seeded bags and isolated Node worker/inline golden parity.

Commands used:

```text
node --test tests/stacked-maximal-replay.test.mjs                    # opening RED
node scripts/generate-stacked-maximal-fixture.mjs                    # already holding shared heavy lock
node --test --test-name-pattern="fresh sample processes" tests/stacked-maximal-replay.test.mjs  # assertion RED
node scripts/stacked-replay-benchmark.mjs --samples=7 --owned-lock-token=<own token>
node --test --test-concurrency=1 tests/stacked-maximal-replay.test.mjs tests/stacked-replay-benchmark.test.mjs tests/stacked-headless-projection.test.mjs tests/stacked-hotpath-equivalence.test.mjs tests/stacked-sim-determinism.test.mjs tests/server-verify-stacked.test.mjs tests/stacked-verify-worker.test.mjs
```

For later standalone measurement, `npm run bench:stacked:replay` acquires the shared heavy lock itself, takes seven fresh samples per phase, writes its report and exits nonzero on any failure. It never removes another owner's lock. Fixture authoring must also run under the shared heavy lock; tests replay saved bytes rather than regenerating a run.

## Checks and boundaries

- All six added JavaScript modules parse; each is registered in `scripts/syntax-check.mjs`. `git diff --check` passes.
- No-Git proof: prepared a standalone copy containing only 20 transitive source/test modules, two fixtures and a minimal package declaration; neither `.git` nor `node_modules` exists in the copied tree. All **9/9 new tests pass**, zero skips/cancellations, under a separately coordinated owned heavy lock. Tests and spawned sample processes used only that copied source/fixture tree. This proves these new tests do not require Git or installed dependencies at runtime.
- No simulation/server source files changed. No initial bundle code added. The benchmark is opt-in; it is not yet wired into `vercel:build`. Release-gate integration follows the independent review and target-environment decision.
- Full release gate/build, production probes, actual browser/long worker replay, real-server CPU/cold-import measurements, 60-minute physical-phone soak and full Ranked end-to-end were not run in this slice. No visual assets changed; no visual-baseline acceptance is claimed.
- Next: independent adversarial review of fixture legality, parity coverage, failure/report policy, sample scope, shared-lock ownership and Git-free behavior; then root integration. Add production-environment replay evidence before claiming broader verifier headroom. Other STACKED features remain behind their own gates.

## Independent review follow-up — batch completeness

The independent reviewer found that the assessment helper could pass missing decode samples, uneven or truncated batches, or duplicate sample indexes. The CLI's recorded seven-per-phase batch was complete, so its historical observations remain unchanged and valid for that fixture on this local machine. The helper now requires the CLI's explicit configured sample count (5..30), exactly that many observations in every phase, and each unique integer index from zero to count minus one. Missing phases, missing/duplicate/out-of-range indexes, unknown extra phases and extra observations all fail. The fixed 250 ms limit and no-retry policy are unchanged.

RED: both new completeness tests failed on the old helper (missing decode accepted; absent expected count accepted). GREEN: six cheap harness tests and the isolated fixed-budget assessment test pass (7/7). Existing observation-retention coverage now uses a complete 21-observation batch, so it proves a single slow result fails independently of completeness. The CLI passes its configured count into the helper. Reassessing the saved seven-per-phase report with the corrected helper passes; no timing batch was rerun and no saved samples were changed.

The 432,028-byte fixture proves the longest tick count for its particular input pattern; it does **not** bound every legal input pattern or the 1,302,000-byte accepted evidence ceiling. Source inspection confirms SIC1 rejects a three-byte transition when the equivalent one-bit transition with gap at most 16 has a canonical one-byte form (`stacked-sim.mjs`, `decodeSic1Columns`); canonical base64 also rejects alternative spellings. The same recorded masks cannot be padded or expanded into a larger accepted encoding. All eight input bits have gameplay meaning, so a distinct multi-bit pattern requires a legal recording, canonical expectation and actual verification before measurement. That workload remains pending, together with browser/maximal worker checks, production-CPU/cold-import evidence, release-gate wiring and phone acceptance. Global S0 remains open, and this local fixture does not authorize STACKED visual work.

No simulation, rules, codec, server or fixture bytes changed in this follow-up. No browser, heavy timing batch or full gate was performed during another agent's Blender slot. After independent source review, a separately coordinated owned CPU-test window refreshed the same standalone 20-module/two-fixture tree and passed all 12/12 new tests with neither .git nor node_modules. The broader focused set passed 35/35 tests, zero skips/cancellations. This confirms the repaired harness still needs no Git or installed dependency at test runtime. It does not add a fresh timing batch or close the larger-input-pattern, browser, production-CPU or release-gate checks.

The reviewer also found that successful-process stdout parsing could throw before writing a report, and child output could override scheduled phase/index fields. A new parser regression failed RED because the safe parser did not exist. The CLI now retains malformed JSON, failed child exits, wrong fixture hashes/ticks/byte counts, invalid diagnostic fields and forged phase/index as failed observations in the host-owned slot, then finishes the report. Required wall/CPU times, memory/environment diagnostics and scope/exclusions are validated. Successful child output cannot supply an index or change the scheduled phase. All six cheap harness tests pass; the saved 21 successful observations also validate through this parser with their scheduled identities. Neither saved report was rewritten.
