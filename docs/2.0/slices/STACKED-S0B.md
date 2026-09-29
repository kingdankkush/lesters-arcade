# STACKED S0b: distinct canonical multibit recording

2026-09-29. Fixture/provenance/tests only, on the isolated world diagnostics branch. No simulation, gameplay rules, codec, server verifier, versions, contracts or settlement changed. This extends the local measured workload; global maximum-encoding and production acceptance remain open.

## Actual recording and acceptance

The existing Free-only bounded pilot sampled actual unchanged runtime snapshots. On each pilot HardDrop tick, the producer added the existing SoftDrop bit, generating a **distinct control mask**. All eight bits retain their real gameplay meanings. It recorded one real input and stepped the real runtime once per tick; no reset, reseed, board edit, skipped tick, shorter ceiling, rule override or padded encoding.

A bounded preflight consumed 10,800 ticks under the unchanged 432,000 ceiling, stayed alive and produced 16,151 canonically decoded bytes. This was an incomplete prefix, not a terminal/verifier pass; its [raw receipt](../../qa/stacked-s0b-prefix-20260929.json) retains that distinction. A separate full recording then started from the normal initial state and ran continuously to 432,000 ticks. The actual public decoder, complete headless terminal replay and old-protocol `verifyStackedRun` all accepted. Generation/public-decode observation: 158.627 seconds; final verification and timing are separate operations.

The full run changed 52,899 control masks and contains 105,798 multibit XOR transitions. Raw evidence is **643,624 bytes**, SHA-256 `41faf8d9f9ff38409cf6ebace00bd23a4d41aeb497e3216cf37d89ef8c7e887c`. Its unchanged gzip bytes occupy 52,761 bytes in Git. Score 96,604,870; terminal `tick-ceiling`; 432,000 transitions. This is a legal-input developer pilot recording accepted by the actual local verifier, not a human run, paid-entry session or publication.

The original S0 432,028-byte short-code fixture remains separate. These recordings have distinct evidence bytes/digests; neither is represented as the missing historical SHA. Full snapshots, canonical state bytes/hashes, board/queue/garbage state, RNG counts and the complete expected per-game VerifiedRun are saved at twelve checkpoints from 0 through 432,000.

Durable files:

- [Manifest](../../../tests/fixtures/stacked-maximal-multibit-run.json) and [gzip evidence](../../../tests/fixtures/stacked-maximal-multibit-run.sic1.gz).
- [Native producer receipt](../../qa/stacked-s0b-provenance-20260929.json) and [every fresh timing observation](../../qa/stacked-s0b-native-20260929.json).
- [Exact producer source attachment](../../qa/stacked-s0b-native-source/stacked-multibit-probe.mjs.txt), [sample source](../../qa/stacked-s0b-native-source/stacked-multibit-sample.mjs.txt), [batch source](../../qa/stacked-s0b-native-source/stacked-multibit-benchmark.mjs.txt), and [repaired S0 library](../../qa/stacked-s0b-native-source/stacked-replay-benchmark-library.mjs.txt).

The attachments preserve the exact native producer bytes/hashes as data, including host-specific paths. They are not shipping modules or test-time generators. The preserved fixture renamed only manifest/schema metadata; raw/compressed evidence, checkpoints and verifier result stayed unchanged. Its original manifest hash is recorded.

## Native first-use measurements

Windows x64, Node 24.17.0, Intel i9-12900K. Batch timestamp `2026-09-29T23:16:19.415Z`. Seven fresh processes per phase, no warmup/retry or fastest-sample selection. The repaired S0 parser binds each scheduled phase/index and fixture identity, retains child failures, and requires a complete unique 7 × 3 batch. All 21 observations passed.

| Actual first-use operation | Median wall time (ms) | Maximum / nearest-rank p95 (ms) |
| --- | ---: | ---: |
| Server base64/header decode | 50.190 | 52.426 |
| SIC1 parse + all headless ticks + terminal tuple/hash | 172.720 | 177.875 |
| Complete per-game verifier | 225.207 | 227.411 |

The verifier row includes decode, private SIC1 parsing, simulation, stats mapping, evidence/envelope digest and result construction; phase times must not be summed. Maximum observed local margin is 22.589 ms to the strict under-250-ms bar, for this fixture and environment only. Small samples do not bound all valid inputs.

Excluded: process startup, module imports, fixture disk read/decompression, assertions, authentication/ticket binding, paid entry, API/network/settlement, browser/phone acceptance and production-server CPU behavior. Thread CPU and before/after process-memory deltas are retained, not peak residency or GC-stabilized measurements. No simulator optimization was performed. Both generation and timing ran under an atomically acquired, exclusively owned shared heavy lock; only the matching token's marker and empty directory were removed.

## RED to GREEN and Git-free verification

Four new legality/checkpoint/canonical-verifier/rejection tests first failed with ENOENT for the absent durable fixture. No simulation ran in that RED (134.827 ms suite). The evidence and manifest were then preserved. Source syntax passed. Focused GREEN: **4/4 PASS**, 0 failures/skips/todo, 3,203.994 ms. A separate identical copy of the 17 real relative-source modules and two fixture files, with only a minimal module package and neither `.git` nor `node_modules`, passed the same **4/4 tests**, 0 failures/skips/todo, 3,210.568 ms. Both ran serially under the exclusive owned shared heavy lock; the matching marker was released. The [test/copy receipt](../../qa/stacked-s0b-tests-20260929.json) pins every copied source/data hash. These suite durations are not new per-game performance measurements. Independent bounded source/receipt review by the STACKED slice agent passed: unchanged actual runtime/recorder continuity, exact producer/engine hashes, raw gzip identity, metadata-only manifest preservation and all twelve complete checkpoints. It independently reparsed all 21 saved samples through the repaired parser/completeness assessor, including missing-decode/duplicate-index rejection; no timings or simulations were rerun in review. Global maximum encoding, production CPU and browser/phone remain uncertified.

The tests pin raw bytes independently of editable metadata, count actual canonical multibit transitions, exercise all ticks through the public runtime and full state checkpoints, compare actual per-game verification including exact evidence text/digest, and reject checksum/seed corruption. They read files directly and contain no Git calls or fixture generation. The syntax whitelist now also covers the four W0a diagnostic modules/tests that were previously checked individually.

## Next workload strategy, before optimization

Canonical SIC1 rejects long-form encoding of the same single-bit transitions with gaps at most 16, nonminimal varints, duplicate/no-op masks and trailing padding. A larger accepted recording therefore requires genuinely different masks or gaps plus actual terminal replay/verifier acceptance.

Candidate: keep HardDrop|SoftDrop; add rotate180 to pilot rotateCW and both rotateCW/rotate180 to pilot rotateCCW. Current rotation processing gives CCW priority, then CW, then180. These are concurrent real controls, but survival and acceptance are unproven. Observed counts project about 757,272 bytes **if the pilot route stays identical**; this is source arithmetic, not a measured recording. Do not add priority-changing rotations to rotate180-only frames or add SoftDrop to movement/rotation without treating altered gravity/score/locking as a distinct workload.

Opposing horizontal keys do not cancel in the actual runtime: both rising bits update lastHorizontal to right and can move right; releasing one can also move. The client resolves held directions by most-recent press and normally emits a single horizontal bit. OR Left|Right into every no-horizontal-input frame would keep both bits across pulse/neutral pairs and projects only two extra bytes for the observed pattern. Selective insertion on rotation pulses or neutral frames projects about 779,128 bytes, but changes movement and may prevent survival; this remains an adversarial protocol-input candidate, not established parity or a normal sampler output.

Recommendation: bounded prefix/full priority-rotation recording first, then selective opposing-direction exploration only if necessary, with all actual acceptance checks. The 1,302,000-byte cap and production headroom are still unresolved. No further generation or optimization is authorized by this receipt itself. Browser, physical-phone soak, worker-long-run acceptance, full release gate and integration remain pending.
