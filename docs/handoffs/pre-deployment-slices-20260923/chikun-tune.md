# Slice brief: chikun-tune (wave 1, runs first; the achievements slice follows it)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/chikun-tune`, branch `fable/pd-chikun-tune`, base = the integration-branch commit that adds the contract doc on top of `06ebe4ca` (or `06ebe4ca` itself).
**Read first:**
- the contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`): §1 (A9, A11), §2.2, §5.1 (Chikun evidence v6), §6.3 (Chikun stats), §10, §11;
- guide `docs/handoffs/pre-deployment-web3-guide-20260922.md` §5.3 items 6-7 and decision D11.

## Goal

1. Make Chikun's Escape hit the owner's run-length targets (D11):

   | Player | Target |
   | --- | --- |
   | Beginner to intermediate | 2-6 min |
   | Intermediate to expert | 6-8 min |
   | Expert to hardcore | 8-12 min |
   | Exceptional | past 15 min is very rare |

   Prove this with a reproducible headless difficulty harness.
2. Ship **evidence v6**: delta-encoded flap ticks and a 12,000-flap cap that ends the run gracefully.
3. Add the extra deterministic counters the achievement catalog needs.

## Acceptance criteria

1. `scripts/chikun-difficulty-harness.mjs` runs at least 200 seeded runs per bot profile (5 profiles). It writes `docs/qa/chikun-difficulty-harness-20260923.json` with, per profile:
   - survival-minute percentiles p10/p25/p50/p75/p90/p95/p99;
   - the fraction of runs over 15 min;
   - a death-cause histogram;
   - **p10/p50/p90/p99 of every §6.3 Chikun stat**: `score`, `forksPassed`, `nearMisses`, `coinsCollected`, `bestCombo`, `nearMissStreakBest`, `flawlessRegions`, `distanceMeters`, `regionIndexReached`, `laps`, `speedMultiplierReached`. The achievements slice calibrates thresholds from these.
   - **flaps per minute p50 and p99** per profile (flap count divided by survival minutes), so the 12,000-flap cap can be checked against 60 minutes of play.
   - `node scripts/chikun-difficulty-harness.mjs --runs 200` finishes in under 10 minutes. `--runs 16` exists for tests.
2. Bot profiles are fixed **before** tuning, in `scripts/lib/chikun-bots.mjs`:

   | Profile | Reaction delay (ticks) | Timing jitter σ (ticks) | Look-ahead (px) | Viewport |
   | --- | --- | --- | --- | --- |
   | novice | 24 | 5 | 260 | portrait 390×844 |
   | intermediate | 18 | 3.5 | 360 | portrait |
   | expert | 12 | 2 | 520 | landscape |
   | hardcore | 8 | 1.2 | 700 | landscape |
   | exceptional | 5 | 0.8 | 1000 | landscape |

   Jitter uses a seeded PRNG (mulberry32 of `seed ^ profileHash`), never `Math.random`. You may change a profile's parameters only before the first retune commit, and you must record why in the harness JSON (`botChanges`).
3. After the retune, the 200-run medians are:

   | Profile | Required median |
   | --- | --- |
   | novice | 2-4 min |
   | intermediate | 4-6 min |
   | expert | 6-8 min |
   | hardcore | 8-12 min |

   Also: exceptional p50 is 10-14 min with at most 10% of runs over 15 min; hardcore has at most 2% over 15 min; novice p10 is at least 1.0 min. A median hardcore run reaches region index 6 (coast) in loop 0.
4. **The ceiling is not a safe lane.** `scripts/chikun-course-pilot.mjs` `coursePilot` (the "hover at y ≤ 100" exploit) must die with a median under 4 minutes across 16 seeds. Use top-band hazards, more ground-route passages or a lethal ceiling band; the design is your choice.
5. **Evidence v6** (contract §5.1): `{ version:'chikun-flap-evidence-v6', seed, fixedStepHz:60, maxTicks, flapDeltas:number[] }`.
   - `CHIKUN_EVIDENCE_VERSION = 'chikun-flap-evidence-v6'`, `CHIKUN_RUNTIME_VERSION = 'canvas-runtime-v7'`, `CHIKUN_CABINET_VERSION = '0.9.0'`.
   - v6 cap: `CHIKUN_MAX_FLAP_TRANSITIONS = 12000`. Reaching the cap ends the run with `terminalReason:'flap-limit'` and never throws.
   - `maxTicks` stays at most 216,000 (60 min), with `run-complete` at the cap.
   - Export `encodeFlapDeltas(ticks) → number[]` and `decodeFlapDeltas(deltas) → number[]` from `chikun-cabinet.mjs`.
   - Export `flapTicksOf(evidence) → number[]` from `chikun-cabinet.mjs`: the v5 `flapSteps` as is, or the decoded v6 `flapDeltas`. **Every reader of `flapSteps` in the repo switches to it in this slice** (plan step 4), otherwise `recordScore` throws a `TypeError` on every Ranked Chikun run and the daily-challenge ghost replays with no flaps.
   - The cap covers 60 minutes: a test asserts `12000 ≥ 1.25 × 60 × (exceptional p99 flaps per minute)` from the committed harness JSON. If it fails, raise the cap (and the bridge and replay-file size limits with it) rather than widen the margin.
6. **The v5 course is frozen for historical replay**, the same way v3 was: `chikun-ground-v5-runtime.mjs` and `chikun-ground-v5-course.mjs` are byte-copies of today's v5 runtime and course. They must carry their own copy of the region passage table, `COURSE_CADENCE` and the speed functions, because `courseKind` reads `CHIKUN_REGIONS`.
   - `replayChikunRun` dispatches v5 there (flapSteps format) and v6 to the new runtime (flapDeltas format).
   - `verifyChikunReplayClaim` accepts **only v6**.
   - Commit a v5 fixture **before** changing any course code.
7. **New counters on the v6 runtime `result`**, outside `finalState` so bridge `validateFinalState` is unchanged:
   - `nearMissStreakBest`: the longest run of consecutive passed obstacles that were each a near miss.
   - `flawlessRegions`: the number of regions whose obstacles were all passed with no near miss.
   - `regionIndexReached` and `regionReached`: obstacle-exact, from `regionForObstacle(index)` of the highest passed index.
   - `laps`: completed loops.
   - `distancePixels`.
   - `speedMultiplierReached`.
   - A meaningful `bestCombo`. Today `combo` never resets, so `bestCombo === forksPassed`. In v6, combo counts consecutive passes that each collected that obstacle's coin **or** were a near miss, and resets otherwise.
   - Document these definitions in a comment block at the top of `chikun-ground-runtime.mjs`.
8. **Failure safety.** No code path in the child can freeze the game loop:
   - `apps/chikun/src/main.mjs` `finishRun` runs inside try/catch, and the rAF is always re-armed;
   - bridge `CHIKUN_MAX_MESSAGE_BYTES` goes to 262,144;
   - `REPLAY_FILE_LIMIT` goes to 262,144;
   - a 60-minute worst-case v6 `game:result` (12,000 deltas, sent twice: `evidence` and `replayClaim.evidence`) validates under the cap. Test it.
9. **Determinism.** New course and runtime math uses only `+ - * /`, `Math.floor`, `Math.min`, `Math.max` and integer operations. **Never** `Math.exp`, `Math.pow`, `Math.hypot`, `Math.sqrt` or trig in new code: ECMAScript allows implementation-approximated results, and the server replays in Node while players run Safari (A9). Existing `Math.hypot` uses in `obstacleClearance` may stay (v5 parity), but do not add more. `distanceAtTick` must keep an exact closed form equal to the per-step sum, and a test pins it.

## Files

- **You own:** see contract §10.2, row chikun-tune. That row now includes the single `flapSteps` lines in `arcade-core.mjs:5649-5650`, `chikun-daily-challenge.mjs:80` and `chikun-portal-lifecycle.mjs:14`, three scripts and several tests (plan step 4).
- **Read-only:** `apps/portal/main.js`, the rest of `apps/portal/src/arcade-core.mjs` and `apps/portal/src/chikun-portal-lifecycle.mjs`, `apps/chikun/src/main.mjs:826-840` (the share call belongs to results-share), all `api/**` and `server/**`.

## Interfaces

- **Produced:**
  - the v6 evidence format and codec (§5.1);
  - the v6 result counters (§6.3 inputs);
  - the harness JSON (consumed by achievements);
  - the new constants (§2.2).
- **Consumed:** nothing new.

## Plan

1. **Baseline fixture first.** Write `tests/fixtures/chikun-v5-replays.json`. For seeds 1, 7 and 42, record `{evidence, result}` for (a) a delayed `coursePilot` (30-tick delay) run and (b) a "flap every 20 ticks" run, using the current runtime. Add a test in `tests/chikun-evidence-v6.test.mjs` that replays them through `replayChikunRun`. Commit.
2. **Freeze v5.**
   - Copy `chikun-ground-runtime.mjs` to `chikun-ground-v5-runtime.mjs`, and `chikun-ground-course.mjs` plus the parts of `chikun-course-regions.mjs` that `courseKind` reads to `chikun-ground-v5-course.mjs`. Follow the v3 pattern (`chikun-ground-v3-runtime.mjs`, `chikun-ground-v3-course.mjs`).
   - Wire the `chikun-cabinet.mjs:102-107` dispatch so v5 goes to the frozen copy.
   - The fixtures from step 1 must still replay. Commit.
3. **Bots and harness.**
   - Implement the profiles and the loop from the Chikun map §14. Keep a ring buffer of frozen snapshots and decide from the snapshot `delay` ticks back. Filter `snapshot.forks` to the viewport (landscape x < 1280; portrait is roughly world x 194..527, `buildChikunViewport` in `apps/chikun/src/viewport.mjs:3-9`).
   - Look-ahead planning mirrors the physics constants (`chikun-ground-runtime.mjs:28,35-37`) and queries the pure `courseObstacles(seed, futureTick)` with `obstacleClearance`, limited to what the profile can see. The runtime is a closure and cannot be cloned.
   - Catch throws and record them as `flap-cap`.
   - Run it on the untuned course and save the "before" numbers in the JSON under `baseline`. Commit.
4. **Retune** in `chikun-ground-course.mjs` and `chikun-ground-runtime.mjs`:
   - **Speed ramp:** steeper and front-loaded, piecewise-linear with an exact closed-form distance. Update `speedAtTick`, `distanceAtTick` and the private `tickAtDistance` **together**; they hard-code 2.4, 28800 and 57600 today.
   - **Obstacle spacing:** `COURSE_CADENCE` (340) is the lever for time between obstacles. Obstacle timing is seed-independent, so bot noise supplies the variance. If you change cadence, check `REGION_LOOP_TICKS`, `REGION_SCHEDULE` and `REGION_LEAD_TICKS` (300) still line up, and that a strong run passes farmland through coast in loop 0.
   - **Obstacle size and sky y-bands:** `buildCourseObstacle` in `chikun-ground-course.mjs:23-71`, plus the passage tables in `chikun-course-regions.mjs`.
   - **Anti-hover** per acceptance 4.
   - Iterate the harness until acceptance 3 and 4 hold.
   - Bump to v6 and runtime/cabinet versions everywhere:

     | Site | Change |
     | --- | --- |
     | `chikun-cabinet.mjs:7-12` | the version constants |
     | `chikun-cabinet.mjs:90, :103-106, :122` | the version arrays |
     | `chikun-bridge-protocol.mjs:85-104` | exact keys: `flapDeltas`; add `'flap-limit'` to the terminalReason enumeration at `:104`; `:89` becomes 12000; `:2` becomes 262144 |
     | `apps/chikun/src/main.mjs:751` | `runtimeVersion: '0.9.0'` |
     | `apps/chikun/src/main.mjs:927` | the v5 filter becomes v6 |
     | `apps/portal/src/leaderboard-engine.mjs:144` | the v5 filter becomes v6 |
     | `apps/portal/src/chikun-profile.mjs:18` | the v5 filter becomes v6 |
     | `apps/chikun/src/replay-file.mjs:2,12` | limit and key check |
     | `apps/chikun/src/replay-viewer.mjs:3-11` | `cloneEvidence` |
     | `apps/chikun/src/presentation.mjs:19` | `buildChikunReplayTimeline` decodes the deltas |
     | `apps/portal/src/arcade-core.mjs:5650` | `runStats.flapCount = flapTicksOf(canonical.evidence).length` (that line only) |
     | `apps/portal/src/chikun-daily-challenge.mjs:80` | `new Set(flapTicksOf(replayed.evidence))` |
     | `apps/portal/src/chikun-portal-lifecycle.mjs:14` | `flapCount: payload.evidence ? flapTicksOf(payload.evidence).length : 0` (that line only; ranked-client edits the rest in wave 3) |
     | `scripts/chikun-ground-browser.mjs`, `scripts/chikun-ground-performance.mjs`, `scripts/chikun-open-air-browser-smoke.mjs` | read `flapTicksOf` |
     | `tests/arcade-core.test.mjs:494`, `tests/chikun-host.test.mjs:78` | the `cabinet-0.8.0` build hash and `runtimeVersion: '0.8.0'` pins become `0.9.0` |
     | `tests/arcade-sdk.test.mjs`, `tests/chikun-replay-file.test.mjs`, `tests/chikun-replay-viewer.test.mjs`, `tests/chikun-vfx-presentation.test.mjs` | their `flapSteps` fixtures move to v6 `flapDeltas`, or stay v5 where the test is about v5 replay |

     Finish with `grep -rn "flapSteps" apps scripts tests --include=*.mjs`: every remaining hit is v5-specific code (the frozen runtimes, the v5 decoder, `flapTicksOf`, the v5 fixture test) or a v5 fixture.

5. **Counters** per acceptance 7, then **failure safety** per acceptance 8.
6. **Tests.** `tests/chikun-difficulty.test.mjs`:
   - "speed ramp and distance stay exact": `speedAtTick` at 0, 1, 2, 4, 6, 8, 10, 12 and 15 min pinned exactly, and `distanceAtTick(n)` equals the sum of per-step scroll for n ≤ 36000;
   - "harness sample stays inside the D11 bands": 16 seeds × novice and hardcore, cap 20 min, medians inside the bands widened by ±0.75 min, runtime under 45 s;
   - "hover pilot no longer survives".

   `tests/chikun-evidence-v6.test.mjs`:
   - "delta codec round-trips and rejects non-canonical input" (a negative first delta, a zero later delta, non-integers, over 12000 entries, a tick ≥ maxTicks);
   - "flapTicksOf reads v5 and v6 evidence alike";
   - "recordScore counts flaps from v6 evidence" (a Ranked Chikun `recordScore` with a v6 payload does not throw);
   - "flap cap ends the run as flap-limit";
   - "flap cap covers sixty minutes of the fastest profile" (reads the harness JSON);
   - "60-minute worst-case result message fits the bridge cap";
   - "verifyChikunReplayClaim rejects v5 for Ranked";
   - "v5 fixtures replay through the frozen runtime";
   - "v6 fixtures replay deterministically". Write `tests/fixtures/chikun-v6-replays.json` with 3 bot runs, including one near-miss-heavy run.
7. **Update the pinned tests** in the same commit as each behaviour change:

   | Test | What it pins |
   | --- | --- |
   | `tests/chikun-ground-sky.test.mjs:18` | speed curve |
   | `tests/chikun-runtime.test.mjs:51` | level and scroll |
   | `tests/chikun-runtime.test.mjs:64` | near-miss taps |
   | `tests/chikun-regions.test.mjs:12,27,45,74,94,106` | region order, pilot survival and loop ticks; update to the new course |
   | `tests/chikun-flight-pilot.test.mjs:4` | the pilot bot |
   | `tests/chikun-flight-passages.test.mjs:6,20,28,35` | fix the stale "v4" title too |
   | `tests/chikun-cabinet.test.mjs:85,95,107,114,129` | version strings, flap cap constant, buildHash `cabinet-0.9.0` |
   | `tests/chikun-parent-bridge.test.mjs:94` | evidence version |
   | `tests/chikun-profile.test.mjs:3` | evidence version |
   | `tests/chikun-portal-lifecycle.test.mjs`, `tests/chikun-public-integration.test.mjs:86` | may pin v5 or cabinet strings |

   Keep test **names** unchanged unless the name states a now-false fact, and never rename a ledgered test (`docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json`).
8. Register the new files in `scripts/syntax-check.mjs` immediately after `'scripts/chikun-course-pilot.mjs',`.

## Verification

```
node --test tests/chikun-*.test.mjs tests/arcade-core.test.mjs tests/arcade-sdk.test.mjs
node scripts/chikun-difficulty-harness.mjs --runs 200   # writes the QA JSON
grep -rn "flapSteps" apps scripts tests --include=*.mjs  # only v5-specific hits remain
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51 tolerated
```

Browser check: serve `apps/portal` as the web root (`python -m http.server 8801 --directory apps/portal`). Play Chikun Free for 2 minutes on desktop and at a 390×844 viewport. The console must be clean, the HUD speed readout must look right, and region transitions must still blend. Optionally run `node scripts/chikun-regions-browser-smoke.mjs` with `CHIKUN_PORTAL_ORIGIN=http://127.0.0.1:8801` and `PLAYWRIGHT_PACKAGE_PATH=C:/Users/just_/lesters-arcade-fable0916/benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs`. If that smoke relies on hovering, update its pilot.

## Pitfalls

- `snapshot.region` lags by 300 ticks (scenery). Achievement regions use the obstacle-exact definition (`regionForObstacle`).
- `groundDifficulty().safeGapHeight` is vestigial, and `CHIKUN_VERTICAL_SLICE_CONFIG.rules` / `.hazards` are legacy flappy leftovers. Do not tune them.
- The evidence travels twice inside `game:result` (`payload.evidence` and `payload.replayClaim.evidence`). Size tests must count both.
- `finishRun` runs outside the try block at `main.mjs:709`. A throw there stops rAF re-arming and freezes the game.
- The HUD `speedValue` (`main.mjs:463`), gait (`character.mjs:69`) and portrait "upcoming" indicator (`viewport.mjs:15`) all read `speedAtTick`. Check they still look sane at higher speeds.
- `npm test` runs every test file. Keep the harness sample test under 45 s, and put the full sweep only in the script.
- Do not touch `apps/chikun/src/main.mjs:826-840` (the share call) or anything the Ranked copy slice owns (`main.mjs:467-537` belongs to ranked-client in wave 3). Mechanics only here.
- `leaderboard-engine.mjs` is read by the index slice in parallel. Change only line `:144`.

## Definition of done

- Every acceptance criterion holds, and the harness JSON is committed.
- The v5 and v6 fixtures are committed and their tests pass.
- The gate shows exactly 51 tolerated failures. Do not commit the gate JSON (contract §10.4.2).
- The build and bundle budgets pass. `scripts/syntax-check.mjs` is updated.
- Commits are small and each has tests. Branch `fable/pd-chikun-tune` is ready for merge.
- Hand-off note in the final commit message: the final bot-profile table, the final medians, and the path of the harness JSON for the achievements slice.
