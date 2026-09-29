# W0a: native world sizing diagnostic

Date: 2026-09-29. Slice: diagnostic harness and characterization tests only. Starting source: `2d67acb9`. No active map, runtime navigation, elevation, simulation, assets, rules, versions or server verifier changed. No optimization performed.

## Result and scope

The current actual 12,000 × 4,800 map and proposed 20,000 × 14,000 bounds can now be benchmarked with the **actual** `createEnemyNavGrid`, `createEnemyNavGridChunked`, authored ground query, directed flow and gate patch code. This is reproducible native Node evidence, not acceptance of the new map, browser streaming, phone memory or 30 fps.

Four scenarios deliberately answer different questions:

- **Current authored:** the exact `LEVEL_ONE_WORLD` object, 12 elevation surfaces and 117 collision blockers.
- **Bounds-only control:** extend its bounds/base ground to 20,000 × 14,000 while retaining those same surfaces and old perimeter blockers. This intentionally exposes the cost and correctness hazards of changing dimensions alone; it is not a connected future map.
- **Synthetic current / target:** deterministic repeated 2,000-unit rooms with deep water, shallow fords, polygon buildings, circle blockers, ramps and one-way ledges, plus perimeter capsule guards. Target: 280 surfaces and 144 blockers. This representative topology is not the final ten areas. Its target lattice is 44.55% walkable, below the requested 45–55% band; it remains a diagnostic load, not a passing W1 layout.

The [machine-readable receipt](../../qa/hmh-world-w0a-native-20260929.json) contains all raw build/flow samples, source content hashes, complete fixture topology hashes, query counts, both build passes, buffer byte lengths, boundary probes and gate patch differentials. It uses no Git calls at test or benchmark runtime.

## Native measurements

Host: Windows x64, Node `24.17.0`, Intel i9-12900K, 24 logical CPUs. Timestamp: `2026-09-29T22:53:45.490Z`. Each scenario received one synchronous build/flow warmup; three build samples alternate across scenarios. Each of three targets received 12 flow samples. These are finite samples, not worst-case guarantees.

| Scenario | Grid cells | Synchronous build median / max (ms) | Instrumented chunked elapsed median (ms) | Highest observed chunk work (ms) | Highest observed flow refresh (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current authored | 16,000 | 32.193 / 32.207 | 36.007 | 1.779 | 2.604 |
| Bounds-only target | 78,156 | 181.550 / 184.602 | 206.696 | 1.805 | 1.128 |
| Synthetic current | 16,000 | 18.729 / 19.269 | 22.664 | 1.285 | 0.191 |
| Synthetic target | 78,156 | 98.990 / 112.764 | 112.825 | 1.311 | 0.814 |

Chunking uses the runtime 512-cell and 4 ms limits with diagnostic clock/query hooks and native `setImmediate` yields. Instrumentation adds cost. Reported chunk work spans actual per-cell work within each pass; elapsed includes yields and bookkeeping. This differs from browser idle scheduling and phone frame integration. Current-size builds used 64 work slices / 62 yields; target-size builds used 306 / 304. All three repetitions produced byte-identical synchronous/chunked grids. Ground queries per build were respectively 253,753; 1,547,729; 155,844; 703,896. Both passes processed every cell, twice. The existing fixed 30-tick flow-refresh cadence is untouched.

| Returned typed arrays | Current size (bytes) | Target size (bytes) |
| --- | ---: | ---: |
| Walkability + directed edges | 32,000 | 156,312 |
| One flow distance + direction field | 80,000 | 390,780 |
| Total retained arrays inspected | 112,000 | 547,092 |

These are **actual `.byteLength` values of returned buffers**, not a source-arithmetic estimate of allocated residency. They describe the arrays retained by one returned nav grid and one returned flow field. Peak scratch memory is **unmeasured**: the transient BFS queue and previous fields waiting for GC are excluded. Process heap/external/array-buffer deltas are **unmeasured separately**; no GC stabilization or peak sampler was run. Objects, closures, spatial indexes, decoded textures, sprites, GPU and phone residency are also excluded. This receipt replaces neither the old source-derived peak estimate nor the W0b residency requirement.

## Unresolved correctness constraints

The target grid rounds to 334 × 234 cells, covering 20,040 × 14,040. Its last centres are (20,010, 14,010): 567 centres lie beyond the exact target bounds. In the bounds-only old-perimeter control **all 567 are walkable**, including out-of-bounds ground fallback. Synthetic perimeter guards block all of them, showing a possible layout constraint rather than fixing or accepting runtime semantics. W1 must explicitly validate the exact perimeter and rounded lattice; do not treat expanded bounds alone as a new map.

Differential checks compare actual local gate opening patches against actual full rebuilds:

| Gate probe | Open cells differing | Walkability differences | Directed-edge differences | Reclosed differences |
| --- | ---: | ---: | ---: | ---: |
| Interior synthetic | 0 | 0 | 0 | 0 |
| West border synthetic | 4 | 2 | 4 | 0 |
| North border synthetic | 12 | 10 | 12 | 0 |
| Actual current relay supply gate | 0 | 0 | 0 | 0 |

The adverse border cases expose the current outermost-cell patch halo omission. They are unresolved constraints, not passing future-map gates. W1 should constrain gate placement away from the outermost lattice until a separately reviewed navigation/rules slice establishes full parity. Reclosing parity and current interior/current-map parity do not erase the opening mismatch.

## Tests and checks actually performed

RED: the new test file first failed with `ERR_MODULE_NOT_FOUND` for the missing diagnostic helper API. The test-first sequence then added the helpers. This RED established absence of the diagnostic API, not an already fixed gameplay bug.

GREEN under the owned shared heavy lock:

```text
node --test --test-concurrency=1 tests/hmh-world-size-diagnostics.test.mjs tests/hmh-reboot-boot-responsive.test.mjs tests/hmh-reboot-enemy-navgrid.test.mjs tests/hmh-world-design-interactions.test.mjs
```

49 / 49 passed; 0 failed, skipped or todo. Ten new diagnostic tests cover immutable fixture identity, actual allocated buffers, rounding/fallback, guarded perimeter behavior, complete chunked authority readiness, reference byte parity, directed ledge/reverse-flow legality, gate full-rebuild comparisons, deterministic valid fixtures and bounded command arguments. Border tests deliberately assert that the diagnostic exposes the current mismatch; the suite passing does not certify it as acceptable.

Fresh native timing command under the same owned lock:

```text
node scripts/hmh-world-size-bench.mjs --repetitions=3 --warmups=1 --flow-repetitions=12 --output=docs/qa/hmh-world-w0a-native-20260929.json
```

Completed successfully. Source syntax checks passed. After measurement, two surplus blank lines at the ends of harness sources were removed for the staged whitespace check; the JSON source hashes retain the exact content measured. Executable statements are unchanged. The lock ownership marker was checked before removing only this job's marker and empty lock directory. No other worktree was changed.

Skipped: full release gate/build, browser runtime, `visual:reboot`, desktop/phone screenshots, physical-phone timing/soak, asset streaming/texture residency, 30-minute flat memory, local Ranked end-to-end and production probes. There is no render-layer change in this diagnostic slice. The real browser path and device acceptance remain open; none of the native timings prove 30 fps.

## Next dependencies

W0b must implement and measure bounded area asset lifetimes in the real Pixi/browser path, separately from culling. Capture decoded/GPU texture budgets, old-area eviction, seam travel, navigation boot/refresh frame contribution and long-run memory on the agreed physical phone. Keep presentation streaming independent of simulation authority and lazy-load new presentation modules.

W1 must consume these bounds/halo constraints in the layout checker and keep synthetic density separate from the actual ten-area greybox. W2 is the connected playable greybox owner checkpoint before production area art. W3 must preserve the frozen old six-strip verifier tables and select new map/rules by the authenticated session game version; this slice changes no run evidence or dispatch.
