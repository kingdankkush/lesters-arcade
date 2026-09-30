# STACKED S0c: larger distinct priority-rotation recording

## Scope and result

A separate actual uninterrupted run reaches the unchanged 432,000-tick ceiling and passes the public canonical SIC1 decoder, full terminal replay and existing old-protocol per-game verifier. It contains **757,272 raw bytes**, SHA-256 **9ae11c4d47455bf92aed1424e9cd730ece503cf3f1f5fa2e00a18f9affb95ca4**. No simulator, codec, rules, public game version or server source changed. This does not replace S0b or historical evidence.

The existing Free-only pilot reacts to each actual unchanged runtime snapshot. It samples and commits exactly one real mask before every runtime.step. HardDrop receives concurrent SoftDrop (mask 12); clockwise receives lower-priority rotate180 (mask 80); counterclockwise receives clockwise plus rotate180 (mask 112). All controls have existing gameplay meanings. Source priority was only a candidate-selection reason; legality is established by actual continuous recording and decoder/replay/verifier acceptance. There were no resets, reseeds, state edits, skipped ticks, shortened ceiling, input padding or alternate noncanonical encodings.

The short prefix stays alive for 10,800 ticks with 18,831 canonical bytes, decoder acceptance and 4.0284845 seconds generation/decode. It makes no terminal/replay/per-game acceptance claim. A fresh separate maximal run consumed 432,000 ticks; generation plus public decode took 157.7997101 seconds. It changed 81,311 planned input ticks and produced 162,622 multibit XOR transitions. Observed counts: 52,899 mask 12, 21,916 mask 80 and 6,496 mask 112. The completed run scored 96,604,870 with 52,900 pieces and 23,989 lines; all 12 full canonical checkpoints, RNG/state bytes/snapshots and the complete terminal tuple are retained. It is diagnostic pilot evidence, not a human run or recovered/paid/published historical run. The historical identity's version binding is preserved exactly.

## Fresh native first-use batch

The complete 7 × 3 batch is retained in [the native receipt](../../qa/stacked-s0c-native-20260929.json), measured 2026-09-30T00:07:08.405Z. Every fresh-process scheduled index and phase is present; there were no warmups, retries or discarded observations.

| Phase | Count | Median ms | Maximum ms |
| --- | ---: | ---: | ---: |
| Decode | 7 | 56.6795 | 58.7797 |
| Terminal replay | 7 | 176.8122 | 181.8619 |
| Complete per-game verification | 7 | 236.1341 | 242.7848 |

The **7.2152 ms local observed margin** is specific to this distinct fixture on Windows x64, Node 24.17.0 and an Intel i9-12900K. Full verification includes server evidence decode, private SIC1 parsing, every simulation tick, stats/evidence envelope digests and result validation. Process startup/imports, fixture disk/decompression, assertions, session tickets/auth, API/network/entry/settlement and browser/phone are excluded. Per-sample CPU and memory deltas remain separate in the receipt and are not peak-residency measurements. The maximum legal raw encoding and production CPU remain unresolved. This is not full S0 approval.

The producer's exact content hash is 9458141f30c035f8afc56663b76c905e8bdf5b9352e4b1072fb9345d26f5cc9a. Producer/sample/batch/repaired assessment-library bytes are archived as data in [the native source directory](../../qa/stacked-s0c-native-source/). Runtime/server/codec/transport identities are pinned in receipts; tests never invoke Git.

## Durable fixture and tests

The prepared test source pins raw bytes/hash independently of editable metadata, verifies actual canonical decoding and exact multibit counts, replays all uninterrupted ticks against all full canonical checkpoints and terminal results, checks the complete old-protocol verifier fields/evidence, and rejects checksum corruption and mismatched evidence seed. Missing-fixture RED: **0/4 PASS, 4 ENOENT failures**, 169.0715 ms; no simulation ran. After exact-byte preservation, focused GREEN passed **4/4**, zero failures/skips/todo, 3209.7722 ms. An identical copy of the 17 real relative-source modules and two fixture files, with only a minimal module package and neither .git nor node_modules, passed **4/4**, zero failures/skips/todo, 3210.0646 ms. Both actual replay suites ran serially under the exclusive owned marker, which was released after matching token/path checks. [The test/copy receipt](../../qa/stacked-s0c-tests-20260929.json) pins every copied source/data hash. Suite durations are not new verification benchmarks. Preservation changes only the fixture schema label, filename and preservation metadata; raw gzip/evidence, expected canonical fields and all checkpoint contents stay identical.

## Observed harness failure and terrain checks

The measurement window itself completed its prefix, maximal recording and all 21 native observations under its own exclusive marker. Two pure W0b adverse tests then correctly failed: a cancelled request rejection poisoned later re-entry, and a no-op Pixi unload was incorrectly accepted. The outer wrapper expected TAP text while Node emitted the spec reporter, stopped before fixes/GREEN and retained the full outputs/error. It removed only its matching owned marker. This reporter assertion failure was not a replay or timing failure and no measurement was rerun to hide it.

After root authorization, the two demonstrated presentation-resource fixes were applied and ONLY the two mocked-resource tests ran with explicit TAP: **2/2 PASS**, 0 failures/skips/todo, 536.171 ms. That separate check ran no simulation/timing/browser and acquired no heavy marker. Broader W0b tests, actual browser/source-disposal proof, byte/visual gate and physical-phone acceptance remain pending. These terrain edits are excluded from this S0c commit.

## Review and remaining gate

Independent source/saved-evidence review **PASS**: the reviewer checked actual producer/capture/gzip/raw hashes, continuous real controls, unchanged ceiling/config, all 12 checkpoint fields and terminal, then independently reparsed all 21 observations through the repaired host parser/assessor. Missing-decode and duplicate-index cases reject. [The review receipt](../../qa/stacked-s0c-independent-review-20260929.json) retains the scope: no independent simulation/timing rerun or wider certification. No source or runtime optimization was made. Before choosing optimization, retain a larger accepted distinct workload if feasible, or profile this accepted run's complete server path; do not fabricate a larger encoding of the same inputs. Any next control pattern must survive a bounded actual-runtime prefix and a new uninterrupted maximal recording, then pass canonical decoder/terminal replay/verifier acceptance. Full maximum-encoding acceptance, production CPU, long-run worker/browser parity, physical phone and release gate remain open. No deployment or release-version changes.
