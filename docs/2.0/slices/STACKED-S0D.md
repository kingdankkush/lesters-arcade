# STACKED S0d — genuine Hold controls, failed longest survival

The one authorized full-length attempt **did not survive to 432,000 ticks**. It reached a genuine `block-out` at **72,520 input/runtime ticks**, recording **193,743 canonical bytes**, SHA-256 `8665731c9716e09c8c1c180b880f0fb6e5f1ab861ae583d0a5fba2d5e4aec91a`. Its shorter terminal tuple and evidence passed the public decoder, exact terminal replay and unchanged old-protocol per-game verifier. This is accepted shorter diagnostic evidence and an adverse longest-survival outcome; it does not extend S0c's accepted maximum-duration measurement.

The unchanged Free pilot sampled actual runtime snapshots. It retained S0c's genuine concurrent HardDrop/SoftDrop and rotation controls, added an actual Hold after a real HardDrop only when the actual snapshot made Hold available, and used capped Hold on otherwise neutral frames only when the snapshot reported Hold already used. Every input tick was sampled, committed and stepped once. No runtime/pilot state assignment, reset, reseed, skipped tick, altered ceiling/rule/config or padded encoding occurred. Source priority alone was never treated as legality proof.

| Observation | Prefix | Single full attempt |
| --- | ---: | ---: |
| Actual input and runtime ticks | 10,800 | 72,520 |
| Raw recorded bytes | 28,856 | 193,743 |
| Terminal | false | block-out |
| Public canonical decoder | accepted | accepted |
| Complete terminal replay / old per-game verifier | not run | accepted / accepted |
| Required maximal duration | unproved | failed |
| Generation plus public decode wall | 4.2142984 s | 23.6095282 s |

The prefix's raw hash is `afaa99c43d508a8c831241593dadc801cf02ae04241e4266b21785be6be3d3c5`. It remains nonterminal evidence; the later short terminal does not retroactively turn the prefix into a complete verified run. The full attempt generated 64,577 actual input transitions, including 64,569 multibit XOR transitions. Hold controls total 40,227: 7,943 post-drop and 32,284 capped neutral. The actual terminal scored 13,422,668 with 7,946 pieces and 3,315 lines, board hash `0x5cecd2eaae17e421e22cd28700637caca066cfa65456de45b6f592bceb9e0e76`. All eight complete public canonical checkpoints through 72,520 are retained, alongside the four prefix checkpoints.

The single child ran at 2026-09-30T01:51:17.078Z–01:51:40.969Z on Node 24.17.0. Whole-child wall was **23.8916516 s**, including imports, recording, decoder, archive handling and terminal replay/verifier. A 225-second recording-loop ceiling and 240-second real outer child watchdog were armed; neither timeout fired. Child exit 0 records successful shorter-run validation; outer wrapper exit 1 records the failed required maximal duration. No recording/validation exception, lost control tail or kill signal occurred. No retry, discarded attempt or fresh verifier timing batch followed. These walls are not per-game verification/headroom samples.

The [receipt](../../qa/stacked-s0d-20260929.json) preserves the exact reports, process stdout/stderr/outcome, identity/config, producer and six frozen source hashes, checkpoint bytes/snapshots/RNG state and shorter old-protocol VerifiedRun. Raw prefix and short-terminal gzip controls remain byte-identical. Producer SHA-256 is `fb91d30e3dae8d7d7aad34481d95b53de01ab970d48dff1fb6e852fd4983950e`; the source-reviewed outer runner is `81d3932283badabd90630544d1c37ad281c0e2694aaffaf6c69a9bc3423120d7`. Raw source witnesses are data, not imported tests or game entry code. The original producer's generic `stacked-maximal-run` fixture filenames are retained in raw metadata; its actual schema is explicitly the shorter-terminal variant and maximal-duration flag is false.

Independent source/archive review is embedded in the receipt and does not imply an independent decoder, simulation or timing rerun. Archive-only checks matched both raw/compressed evidence hashes, all six source copies, the exact producer, checkpoint counts and shorter terminal metadata. No new preservation replay suite or no-Git check was run for this documentation-only adverse archive. Tests/runtime/server/codec/protocol/versions remain unchanged. The owned shared marker was explicitly released only after actual child close.

Global S0, largest accepted encoding, production CPU, worker/browser parity, physical-phone soak, local Ranked end-to-end and release acceptance remain open. Existing S0c remains the accepted 432,000-tick/757,272-byte baseline with a 242.7848-ms worst local full verifier sample. The separately recorded [single CPU profile](STACKED-S0C-PROFILE.md) diagnoses that unchanged baseline; it is not a new uninstrumented headroom measurement. No deployment or gameplay change.
