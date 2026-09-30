# STACKED S0c — one complete-verifier CPU profile

One fresh Node process profiled the unchanged accepted **432,000-tick, 757,272-byte S0c run**, before optimization. Its complete old per-game VerifiedRun, canonical evidence text/digest and public terminal tuple matched the frozen fixture exactly. The only instrumented verifier call took **254.0865 ms**; whole-child wall was **572.015 ms**. These are diagnostic walls with profiler overhead, not a new uninstrumented 250-ms gate or a replacement for S0c's prior worst sample of 242.7848 ms.

The [receipt](../../qa/stacked-s0c-profile-20260929.json) preserves the one child outcome, exact fixture and transitive source hashes, all 17 raw target/frozen source copies, six reviewed harness/input/plan copies, exact result and public tuple, before/after process observations and the source review. The [standard CPU profile](../../qa/stacked-s0c-profile-20260929.cpuprofile) has SHA-256 `49d57fcf836b0919f7cef39cabb552b6cbdfb6ae0638207da5e4015ff30ffaef`. Actual module resolution matched all 16 declared transitive ESM target files; the seventeenth copied file is the separately frozen, unimported Free pilot. Before and after source, fixture and harness hashes matched. No pre-call replay or warmup occurred. The public replay ran after profiling stopped to check the exact terminal tuple.

The 15-second outer child watchdog did not fire; exit 0 had no signal, spawn error, validation error or Inspector/resolver cleanup error. The owned shared marker was explicitly released after actual child close. Runner SHA-256 `87731ef22a27dd80c2ee8d5b3e2930c89746fdce931d9291981132b77868b07c` was checked externally immediately before launch; reviewed child/input/closure/preparer/plan hashes were pinned and rejected on mismatch before the sole attempt. Independent source review corrected two pre-execution gaps: merely recording reviewed hashes was insufficient, and cleanup errors needed to invalidate a claimed valid profile. No profiler retry occurred.

The [saved sample analysis](../../qa/stacked-s0c-profile-weights-20260929.json) reads the preserved profile only. It retains **479 samples and 79 nodes**, 268.424 ms of standard profile range and 268.300 ms of weighted sample intervals. The requested interval was 100 microseconds; observed average sample spacing was about 560 microseconds, so the requested resolution was not achieved.

| Main-thread frame | Approximate self-weight | Approximate inclusive weight |
| --- | ---: | ---: |
| `decodeStackedBase64` | 44.285 ms | 52.613 ms |
| `advance` | 40.553 ms | 167.816 ms |
| `processGravityAndLock` | 27.406 ms | 51.319 ms |
| `processHardDrop` | 11.158 ms | 58.297 ms |
| Garbage collection | 8.023 ms | 8.023 ms |

These are approximate Inspector main-JS-thread sample weights, with nested inclusive weights that overlap. Awaited crypto/worker CPU and scheduling wait are not fully attributed; complete verifier wall includes awaited latency. Native, GC, idle, unattributed and Inspector boundary frames remain in the saved analysis. Sampled weights are not total process CPU, allocation-site measurements or exact expected savings. The substantial decoder self-weight does not prove that its string-copy operation alone caused all 44.285 ms. Process CPU deltas include profiler overhead; memory deltas are aggregate before/after observations without forced GC, not peak residency or per-site allocations.

An AST/source-only preparation initially used a Windows `C:/` ESM import without `file:///` for Acorn and failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME` before game imports or profiling. The import was corrected and source preparation completed. The receipt preserves that observed diagnostic as a summary; the original failing helper/output was not saved as a raw archive. This was not a failed game or profile attempt.

The next authorized candidate is a small change to the shared Latin-1 transport copy, retaining native `atob`/`btoa`, all canonical/type/length/cap checks and rejection behavior. RED coverage must observe actual bounded iteration/allocation traffic in an isolated realm, with independent all-byte and malformed-input goldens; it must not assert syntax or a microsecond threshold. Independent verifier review and fresh uninstrumented measurements remain required after any implementation. No optimizer, rule, protocol, version, decoder acceptance or old corpus change was made in this diagnostic slice. Largest accepted encoding, production CPU, worker/browser/phone, global S0 and release acceptance remain open.
