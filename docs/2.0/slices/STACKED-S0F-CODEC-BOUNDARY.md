# STACKED S0f — canonical encoding boundary

No cabinet, simulation, transport, verifier, rule, cap, version or built runtime
changes. This is a diagnostic helper and real encoder/decoder/verifier coverage.

Every canonical transition consumes a positive, disjoint tick gap. Its compact
encoding costs one byte; its escape costs 2+varintLength(gap-1), at most three
bytes per consumed tick. Summed gaps cannot exceed totalTicks. The actual header
and minimal terminator make the bound 3T+24+1+varintLength(T): 1,296,028 bytes at
432,000 ticks, below the unchanged 1,302,000-byte transport cap. Tests cover every
legal gap and real encoder attainment at varint boundaries.

Alternating masks3/0 at every tick attains that canonical encoding bound using
the real encoder. SHA-256 is00607511b0b3b34856a0cc512786cbb8f6ebc7f6e2bf4a4e6ce7113849266fd2.
This is a structural hostile-input sentinel, not a surviving game, maximum
accepted score workload, padded real-run fixture or longest-duration proof.
The real runtime terminates early and existing verifier rejects it with422,
replay-rejected/cannot step terminal STACKED runtime, without an accepted score.

The initial missing-helper RED is preserved: import failure, zero behavior cases
executed. Final four behavior cases pass at root and in an exact18-file copy with
emptyPATH, no.git and no.node_modules; these are the same cases, not eight distinct
tests. The strengthened test requires the exact existing terminal rejection.

Seven first-use, fresh-process decoder observations have p50/max30.5746/31.2152ms.
The initial seven rejection children failed a witness that expected the wrong
error message. Those failures, source/helper identities, stderr and process
closure remain preserved. Only that expected error/status witness was corrected;
passing decoder samples were not repeated. Seven fresh rejection observations
have p50/max44.7284/48.2720ms. All21unique children closed normally without watchdog
or forced termination; the owned markers were released. The sentinel was saved
before the batch and loaded raw in each child, avoiding encoder/checksum warm-up.
All16actual target imports and the18-file copy are hash-bound before/after.

Root and independent source/saved-record reviews reproduce the bounds, identities,
failures, closure and statistics. The independently reviewed genuine S0c run is
separate:432,000real ticks and complete exact verification max195.2793ms after
S0e. The combined evidence establishes these local observations; it does not
prove the worst surviving legal workload, productionCPU/API/auth timing, physical
phone performance or globalS0/release acceptance. No new browser job is needed
for this diagnostic-only slice; the prior actual built browser bytes remain
unchanged. Only the two added JavaScript modules need fresh scoped syntax checks.

See ../receipts/stacked-codec-boundary-{root-review,independent-review,green,
original-witness,corrected-rejection}.json. Full raw sentinel, source copies,
immutable helpers and missing-module log remain in the recorded local work path.
The owner has accelerated work to a two-day target; unresolved checks remain open.
