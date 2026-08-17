# Hard Money Heroes — 2026-08-13 production closeout and next-session gameplan

Date: 2026-08-13 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Branch: `reboot/hmh-aaa-continuous`

> **Current continuation authority:** this document supersedes the execution status and first-action instructions in the 2026-08-06 HMH handoffs. Keep those documents for detailed weapon, world, art, and acceptance-criteria intent. Reconcile live Git and Vercel state before trusting any checkpoint below.

> **2026-08-17 continuation update:** Cycles 054–061 are committed locally through implementation commit `59f6f0b4`. Cycle 061 exact implementation patch SHA-256 is `11ed26cbea6a54e149a17ba01310056c09286e0f03a473658f289acd3d05247e`. This update supersedes the older “latest completed slice” and next-slice text later in this file. No Cycle 054–061 continuation work was pushed, deployed, or promoted.

> **2026-08-17 Cycle 065 update:** continuation now includes Cycle 062 flanker validation (`bac9679e`), Cycle 064 ranged-role validation (`47326841`), and a locally certified Cycle 065 canonical Precision Ledger benchmark on top. Cycle 065 legally selects one rank from the real first-level offer, retains Coin Blaster cadence/reloads, routes seeded hits through combat and Liquidator role/punish authority, and is 60/30/20 partition-invariant. Release is `2,237 / 2,186 / 51 / 0`; initial child JavaScript is `391,292 + 575,891 = 967,183 / 1,048,576` bytes. Production, Preview, aliases, main, wallets, contracts, settlement, transactions, external services, and LitVM writes remain untouched. The next bounded slice is the existing Wave 11 power-up lifecycle/boss-safety audit, not a new power-up.

> **2026-08-17 Cycle 066 update (current):** the Wave 11 existing-power-up lifecycle/boss-safety audit is locally complete on baseline `6dbab610`. Timed effects now publish explicit non-stacking refresh telemetry (`refreshed`, prior expiry, bounded refresh count); focused tests certify capped healing, repeated weapon-cache reserve bounds, exact expiry/reset, bounded run-summary active ticks, and 60/30/20 equality. The real desktop/mobile/landscape browser matrix covers all nine canonical pickups and proves a screen nuke retires ordinary enemies while the active Liquidator remains at `11,001 / 12,000` HP through normal combat/boss authority. Release is `2,246 / 2,195 / 51 / 0`; child entry/vendor is `391,473 + 575,891 = 967,364 / 1,050,000` bytes. Four network scenarios had zero errors; desktop/mobile p95 was `13.9 / 7.0 ms` with bounded retained heap. Production, Preview, aliases, `main`, wallets, contracts, settlement, transactions, paid/external services, and LitVM writes remain untouched. Next: expose one compact deterministic timed-effect countdown/refresh presentation shared by desktop/mobile HUD and accessibility output before considering any new power-up.

## 1. Live checkpoint

### Git

- Runtime source commit: `e3679552b06781b34fe63e10a2260e7d3a3433a8`
- Published continuation head: `b14fbbebbebd76609563d8825f0824c661c3622b`
- Local and `origin/reboot/hmh-aaa-continuous` matched at `b14fbbeb` before Cycle 050 work began.
- `origin/main`: `fa9585be7014db6515c536f9a09fdba5a3a2572f`
- Cycle 050 is locally committed as `fc6ad3da15d4cd134f565f1e6e579a7d63a087ba` on top of `b14fbbeb`; it has not been pushed or deployed. `origin/reboot/hmh-aaa-continuous` therefore remains at `b14fbbeb`.
- Cycle 050 documentation closeout was `576b6388`. Cycle 051 implementation and evidence are locally committed as `dcd4a9ba79eec28c770a11920030afcd2a57cbaf`. Cycle 052 runtime is locally committed as `7837888af7592c195eaf526921305b77a3307472`, with p99/touch evidence correction `94209018b747b590fa4bf6949a411204032c1108`. Cycle 053 visual-baseline reconciliation is locally committed as `b4a66b02`; its documentation closeout follows that commit. Reconcile live Git before editing it.

### Production

- Public site: `https://lestersarcade.io`
- HMH routes:
  - `https://lestersarcade.io/hmh-reboot/`
  - `https://lestersarcade.io/games/hard-money-heroes/play`
- Verified immutable Preview: `dpl_GW6Kkk8v3urJQRfpPasggePk9xhn`
- Preview URL: `https://lesters-arcade-9stogfwhw-justin-agent-projects.vercel.app`
- Current production deployment: `dpl_Hm2bB5eEgnr6VvacT9xWU7SxVRJr` (read-only Vercel inspection, 2026-08-17)
- Immutable production URL: `https://lesters-arcade-r60lkwo2p-justin-agent-projects.vercel.app`
- Retained rollback deployment: `dpl_8wxJAwqrJKD3cMPscMS5QBG383GJ`
- Active cache marker: `lesters-arcade-v18-hmh-mobile-character-start`
- Cycle 050 local candidate cache marker: `lesters-arcade-v18-hmh-heavy-chokepoints` (not deployed)
- Cycle 051 local candidate cache marker: `lesters-arcade-v19-hmh-endurance-pressure` (not deployed)
- Cycle 052 local candidate cache marker: `lesters-arcade-v20-hmh-browser-endurance` (not deployed)

### Current certification

- Release ledger: **2,191 evaluated = 2,140 passed + 51 exact expected legacy failures**
- Unexpected failures: **0**
- Syntax: **336 JavaScript modules + 49 Python scripts**
- HMH entry: **373.5 KB**
- Pixi vendor: **562.4 KB**
- Combined initial HMH JavaScript: **935.9 KB**
- Headroom beneath the 1 MB raw aggregate budget: **89.5 KB**
- 128-enemy benchmark:
  - 90.45% separation broadphase reduction;
  - 15,360 canonical fixed-tick safety steps;
  - deterministic forward/reversed result preserved.
- Thirty-minute long-run certification: PASS.
- Local and production network audits: PASS.
- Five-profile local and production browser certification: PASS, zero anchor-pixel changes.
- Production performance: PASS on desktop and mobile, zero runtime errors and no measured long tasks.

### Cycle 050 local certification (2026-08-15; committed 2026-08-16)

- Slice: deterministic Whale Enforcer authored-nav chokepoint pressure.
- Release ledger: **2,195 evaluated = 2,144 passed + 51 exact expected legacy failures**; unexpected failures **0**.
- Focused enemy/nav/runtime tests: **35/35 PASS**; shell after build: **12/12 PASS**.
- Syntax: **336 JavaScript modules + 49 Python scripts**.
- HMH entry: **384,816 bytes**; Pixi vendor: **575,891 bytes**; combined initial HMH JavaScript: **960,707 bytes**; headroom: **87,869 bytes**.
- 128-enemy benchmark: **90.45%** broadphase reduction, **15,360** canonical safety steps, deterministic forward/reversed equality, and a non-vacuous **2/2** heavy chokepoint fixture whose actors each advance exactly one `1.6`-unit canonical fixed step.
- Thirty-minute deterministic long-run certification: PASS.
- Desktop/mobile production-roster browser smoke: PASS, zero errors and no overflow.
- Five-profile release browser certification rerun: PASS; all five profiles had **zero changed anchor pixels**, and touch/control geometry was contained.
- Browser performance rerun: desktop/mobile p95 **8.2 / 8.2 ms**; retained-heap deltas **-511,220 / -559,015 bytes**; zero steady-state long tasks and zero runtime errors.
- The 2026-08-16 scheduled run revalidated the candidate from the live checkout: focused tests **35/35**, benchmark, syntax, release **2,195 / 2,144 / 51 / 0**, build, shell **12/12**, long-run, serial browser/network/performance, asset QA, security, Web3 read-only, repo-health/CDN, and docs-link gates completed with their expected verdicts. Bundle bytes stayed **384,816 + 575,891 = 960,707 / 1,048,576**. Current desktop/mobile p95 was **8.5 / 8.1 ms**, retained heap **-4,244,591 / -3,883,414 bytes**, zero steady-state long tasks/runtime errors, and all five responsive profiles again reported zero changed anchor pixels with contained touch controls.
- Evidence and screenshots are local under `.hermes/evidence/cron-wave10-heavy-chokepoints/` and remain uncommitted.
- The hosted reviewer paths remained unavailable: Hermes delegation lacked its configured Nous token, the local Codex CLI returned `401 Unauthorized`, and the scheduled-run Claude reviewer returned `401 OAuth access token has been revoked`. An independent offline `qwen3.5-4b-64k` exact-index review then completed against the full frozen patch and returned `PASS` with no blockers. The exact reviewed index was committed as `fc6ad3da`.
- Production, Preview, aliases, rollback, `main`, settlement, wallets, contracts, transactions, external uploads, and LitVM writes were untouched.

The exact Cycle 050 staged and one-parent commit-patch SHA-256 is:

```text
f6a1c656ed045c0d0cb3f86589fec83ff76f1cb0f0f2882c7fd090b181be533e
```

The independent offline hash-bound review returned `PASS` with no blockers. The failed hosted-auth attempts and the looping/partial first offline attempt were not counted as review verdicts.

### Cycle 051 local source verification (2026-08-16; committed locally)

- Slice: truthful 128-body attack-token, projectile/effect-pressure, recurrence, and low-FPS blocker evidence.
- Release ledger: **2,199 evaluated = 2,148 passed + 51 exact expected legacy failures**; unexpected failures **0**.
- Focused endurance/performance tests: **10/10 PASS**; post-build shell: **12/12 PASS**; syntax: **341 JavaScript modules + 49 Python scripts**.
- Benchmark: **128** bodies over **360** fixed ticks and **46,080** safety steps; body/threat **128/192** and **496/640**; token families **6/5/4/2** and total **17/17**; projectile/effect peaks **8/128** and **12/64**; **4,475** blocker contacts, **148** attack events, and **0** drops/teleports.
- Determinism: same-seed reports equal; seed `1337` digest `2e38a09a` diverges from seed `1338` digest `2de9efbe`; one-step and four-catch-up frame partitions are equal; both 180-tick recurrence windows are non-vacuous.
- Build: HMH entry **384,919 bytes**; Pixi **575,891 bytes**; initial aggregate **960,810 / 1,048,576 bytes**; headroom **87,766 bytes**.
- Browser: six-archetype desktop/mobile detail smoke PASS; all five responsive profiles had zero changed anchor pixels; performance p95 **8.2 / 8.1 ms** desktop/mobile; heap deltas **-97,631 / -4,384,170 bytes**; network/console audit had zero errors.
- Visual baseline blocker: `frontier-relay-mobile` and `combat-engaged-desktop` fail the signature gate with the exact same metrics from an isolated clean build of baseline HEAD `576b6388`. The candidate did not cause the drift; no baseline was weakened or accepted.
- Hosted independent review was unavailable because the configured Nous delegation provider had no access token; no unavailable reviewer was counted as PASS. An offline `qwen3.5-4b-64k` correction review returned structured `PASS` with no findings for staged SHA-256 `e7170ce2753f159a61463b0d01b67771c1a0d915fd058fb8da263426485d10fb`. That exact patch was committed as `dcd4a9ba`, and the one-parent commit patch has the same hash.
- Production, Preview, aliases, rollback, `main`, settlement, wallets, contracts, transactions, external uploads, paid services, and LitVM writes were untouched.

### Cycle 052 local source certification (2026-08-16; committed locally)

- Slice: serial desktop/mobile wall-clock browser proof with `128` real active enemies through existing spawn/population, fixed-tick safety, token, projectile, effect, and production-art authority.
- Exact source commit: `7837888af7592c195eaf526921305b77a3307472`; one-parent patch SHA-256: `9381fc018b413c16d5e5ceee08c0661feb8ed73e6a893bc527546ad5c3a8f843`.
- P99/touch evidence correction: `94209018b747b590fa4bf6949a411204032c1108`; one-parent patch SHA-256: `9cae773394eb46ab8a1bba1f8257cf23ab0f4f019a01fb069bcfe413d6046788`.
- Release ledger: **2,201 evaluated = 2,150 passed + 51 exact expected legacy failures**; unexpected failures **0**. Focused final set: **54/54 PASS**. Syntax: **342 JavaScript modules + 49 Python scripts**.
- Desktop 1440×900, 30 seconds: bodies **128–128**, threat **497/640**, all **17** family tokens, p95/p99 **7.1/7.2 ms**, median **144.93 FPS**, **0** catch-up saturation/dropped time/long tasks/runtime errors, retained heap **+25,337,142 bytes** under the **32 MiB** ceiling.
- Mobile 390×844, 30 seconds run serially after desktop: bodies **128–128**, threat **497/640**, all **17** family tokens, p95/p99 **7.0/7.1 ms**, median **144.93 FPS**, **0** catch-up saturation/dropped time/long tasks/runtime errors, retained heap **+13,549,684 bytes** under the **32 MiB** ceiling; all five touch controls visible and real touch aim/fire made projectile pressure non-vacuous.
- Both profiles required production Blender hero art, production enemy-roster atlas art, authored props/terrain, max **64** animated enemies, `128` canonical safety steps per tick, and non-vacuous projectile/effect pressure.
- Build: HMH entry **388,054 bytes**; Pixi **575,891 bytes**; initial aggregate **963,945 / 1,048,576 bytes**; headroom **84,631 bytes**.
- Generic browser performance, local clean/warm network audit, assets, contracts, deterministic long-run, security, and repo-health gates passed.
- The visual gate remains blocked only by the same inherited `frontier-relay-mobile` and `combat-engaged-desktop` signatures; no baseline was weakened or accepted.
- Hosted delegation remained unavailable because the configured Nous provider has no token. A local offline correction review returned `PASS` with no blockers for the exact frozen source hash after factually invalid first-pass pseudo-findings were rejected.
- Production, Preview, aliases, rollback, `main`, settlement, wallets, contracts, transactions, external uploads, paid services, and LitVM writes were untouched.

### Cycle 053 visual-baseline reconciliation (2026-08-16; committed locally)

- Exact last tracked baseline writer: `c4680a68`.
- Same-browser/build history reconstruction: `428be2e4` passes; intentional cockpit combo feedback at `cbab316e` is the first revision with the inherited pair; verified portrait HUD placement at `319547f5` produces the final mobile signature.
- The significant pixel deltas are localized to the upper cockpit/combat-status regions, not authored terrain, actors, depth sorting, or world props.
- The repository-owned acceptance path refreshed all twelve signatures without changing schema, scene list, viewport, target tick, grid, script, or tolerance.
- Two subsequent full visual runs reported exact `meanDelta=0`, `maxDelta=0`, and `changedCells=0` for every one of the twelve scenes.
- Exact commit: `b4a66b02`; one-parent patch SHA-256: `7cf865b02766ef8b36eed02f672dd1b09529ec040574c7ae37c15e0f9fdde132`.
- Release ledger remains **2,201 evaluated = 2,150 passed + 51 exact expected legacy failures**; syntax, build, assets, contracts, and strict repo health pass.
- Production still serves cache marker `lesters-arcade-v17-hmh-formation-pressure`; `SETTLEMENT_LIVE=false`; no push, deployment, promotion, wallet, contract, settlement, transaction, or LitVM write occurred.

### Cycles 054–061 continuation update (2026-08-17)

- Cycle 054 merged the deployed mobile-character-start hotfix into continuation so later promotion cannot regress the shipped startup fix.
- Cycles 055 and 058 complete the six named deterministic Liquidator build profiles: no-hit, baseline, high-DPS, low-DPS, melee-heavy, and crowd-control.
- Cycle 056 hardened the 128-body real-browser projectile observation without weakening the non-vacuity gate.
- Cycle 057 reconciled README and agent policy with current deployed HMH/Chikun truth.
- Cycle 059 routes locked Liquidator line pressure through the existing authored `combatCover` blockers and shared height-aware LOS resolver. Tall cover protects; low/non-cover props do not; the real Liquidation Market east lean-to is behavior-tested from the arena origin.
- Cycle 060 binds fixed-tick Liquidator phase transitions to production phase atlases and one-time boss-warning audio while keeping presentation outside simulation authority.
- Cycle 061 completes the phase-two positional seam with locked `east-west -> north-south` Circuit Breaker safe circles at authored ticks 1,260 and 2,040, exact boundary behavior, and desktop/mobile runtime evidence.
- Cycle 061 release ledger: **2,224 evaluated = 2,173 passed + 51 exact expected legacy failures**; unexpected failures **0**.
- Child entry/vendor/combined initial JS: **389,579 / 575,891 / 965,470 bytes**; headroom **83,106 bytes**.
- Desktop/mobile phase-two browser evidence passes with two safe zones and two telegraph primitives in each tell, positive player health, and no overflow/errors. Network audit passes all four scenarios. Desktop/mobile performance passes. All twelve visual scenes are exact zero delta.
- Production, Preview, aliases, rollback, `main`, wallets, contracts, settlement, transactions, paid/external services, asset uploads, and LitVM writes remain untouched.

## 2. Latest completed slice

Cycle 053 closes the inherited release visual-signature blocker:

- Baseline provenance is commit-level rather than inferred from the latest handoff.
- The player-visible change is explained by intentional combo/cockpit and portrait HUD work, not Cycle 051/052 runtime drift or nondeterministic rendering.
- All twelve signatures now represent one current local candidate, and two complete reruns are exact zero delta.
- No runtime, renderer, asset, budget, tolerance, or authority changed.

Cycle 052 closed the remaining real-browser half of the Wave 10 soak-truth gap:

- A fail-closed route requires both `evidenceSafe=1` and `endurancePressurePilot=1`.
- Deterministic candidates are selected from the existing endurance role policy and routed one by one through `attemptScheduledEnemyInsertion(...)`; no second population or movement authority was added.
- The route observes all `128` bodies for serial desktop/mobile 30-second wall-clock windows while sampling body/threat/token/projectile/effect pressure, frame time, heap, long tasks, fixed-tick catch-up/dropped time, network, console, page errors, production art, canvas, and touch controls.
- Normal opening composition, movement/attack grace, director cadence, fixed-tick authority, and caps remain unchanged.
- Wave 10's deterministic 128-body and real-browser 128-body evidence requirements are now both locally complete. Cycle 053 separately closes the release visual-signature reconciliation.

Cycle 051 closed the deterministic benchmark half of the Wave 10 soak-truth gap:

- `runEnemyEnduranceSoak(...)` reads the existing enemy population, collision/traversal, attack-token, Auto Miner, projectile-flight, and effect-compaction authorities rather than duplicating gameplay.
- Runtime projectile/effect caps and effect lifetime now have one immutable source consumed by both the browser and evidence seam, without changing their values.
- The existing benchmark now self-certifies same-seed equality, different-seed divergence, one-versus-four fixed-step partition equality, two recurring windows, non-vacuous blocker contacts, all family-token peaks, and independent capacity maxima.
- Browser-visible gameplay semantics are unchanged; the child bundle increases by only `103` bytes.

The serial desktop/mobile 100+ active-body endurance requirement is now locally complete in Cycle 052. The existing generic browser performance smoke still reports its separate 11-enemy route and is not used as the 128-body proof.

Cycle 050 adds the bounded Whale Enforcer heavy-role contract requested by the prior handoff:

- `sampleChokepointDirection(...)` derives a choke from the shared authored-nav graph: a walkable cell with exactly two opposite legal exits.
- The bounded four-hop graph scan requires progress toward the player, follows the first stable legal edge around blocked direct segments, and rejects disconnected candidates.
- The Whale Enforcer approaches and holds a validated choke only outside its attack reservation and within a 520-unit activation window.
- Hazards retain priority; committed attack tells cannot refresh the heavy decision; formation pressure remains subordinate.
- Holding faces the player with zero velocity; approach movement still uses canonical fixed-tick collision, traversal, elevation, bounds, and safety.
- Immutable intent distinguishes `chokepointSeeking` from actual `chokepointHolding`, carries `chokepointTarget`, and exposes separate aggregate/runtime dataset counts.
- Synthetic and real Level One tests prove blocked-direct-segment rerouting, disconnected-candidate rejection, source-order equality, no teleporting, and a 120-tick authored-nav hold just outside the attack reservation.
- The benchmark's former ad-hoc flat-ground stub was replaced with the canonical authored elevation query after a RED non-vacuity assertion proved that the stub rejected both movement steps.

The previous bounded anti-perfect-ring formation pressure remains integrated and unchanged:

- `getEnemyFormationBias(...)` detects six-or-more active enemies occupying a narrow radial band around the player.
- Selection and tie behavior are stable by enemy ID and independent of source-array order.
- The lateral intent bias is capped at `0.18` and remains subordinate to canonical pursuit.
- Hazard avoidance and cover selection retain higher steering priority.
- Committed attack tells ignore formation refreshes.
- Collision, traversal, elevation, world bounds, attack tokens, hazard damage, and fixed-tick safety still execute through canonical authority.
- `enemyFormationAdjusted` exposes truthful current-step telemetry and resets to zero.

The previous bounded hazard-aware pathing slice remains production-live and unchanged:

- validated walkable nav candidates;
- existing Bear Market Burner hazard-cost truth;
- no parallel hazard or movement authority;
- locked tell precedence;
- `enemyHazardAvoiding` telemetry.

## 3. Reconciled remaining program status

### Complete or substantially closed

- Waves 6A and 6B: canonical run summaries, history/provenance, and combo closure.
- Wave 7: capacity recovery, boot, controls/settings/audio/movement/camera foundations.
- Wave 8: Hash Rail and Lightning Ledger vertical slices and benchmark closure.
- Wave 9: Bear Market Burner, Forked Standard, eight-weapon balance closure, and long-run evidence.
- Wave 10 items now substantially complete:
  - baseline pressure telemetry;
  - deterministic spatial hashing/separation;
  - near/mid/far AI decision cadence;
  - shared authored-navgrid flow-field steering;
  - bounded stuck recovery and replan requests;
  - locked attack-tell intent;
  - bounded cover behavior for suppressor/demolition/support roles;
  - bounded authored-nav chokepoint pressure for the Whale Enforcer heavy;
  - Burner hazard path costs;
  - bounded anti-clumping and anti-perfect-ring behavior;
  - animation readability priority;
  - 128-body deterministic benchmark and canonical per-tick safety proof.
- Wave 11 substantially complete:
  - Liquidator deterministic phase timeline and certified presentation;
  - bounded Bad Debt adds;
  - boss warning captions;
  - weapon-role checks without hard immunity;
  - authored height-aware cover counterplay;
  - deterministic phase-two safe-sector rotation;
  - final-phase 60-tick recovery punish window.

### Immediate remaining items

1. **Wave 11 existing-power-up audit before expansion.**
   - Audit heal, weapon caches, time dilation, berserk, and nuke through their real collection/runtime/summary paths.
   - Prove exact fixed-tick refresh/expiry and reset policy, capped refill/selection behavior, non-deleting Liquidator nuke behavior, bounded telemetry, silhouette/audio truth, and desktop/mobile safe-area evidence.
   - Add Block Shield, Fee Holiday, Flash Crash, or Liquidity Magnet only after the existing set is behaviorally certified.

2. **Wave 12 production-art and presentation work.**
   - Industrial/mining kit, wet-bank/foam/scree transitions, interior/secret kits, all-weapon model coverage, lighting, animation transitions, and pooled VFX caps.
   - A12/256 px hero work remains owner-gated.

3. **Wave 13 authored-world expansion.**
   - Ruined-neighborhood interiors, vertical set-pieces, secrets, atmosphere, encounter staging, visible blockers, traversal tests, and visual scenes.

4. **Wave 14 onboarding, accessibility, meta UI, docs, analytics, and active endurance.**
   - Hero comparison/accessibility, truthful cabinets, three-action start flow, achievement progress, wallet-state copy audit, privacy-conscious analytics, colorblind/caption/remapping/touch/HUD-scale work, and a real-interaction desktop/mobile endurance pass.

5. **Wave 15 Litecoin City first vertical slice.**
   - Reconcile all legacy non-human concepts before runtime use.
   - Build only Litecoin Square → one connector → one optional POI → one human/zombie mini-boss → extraction/return before expansion.

## 4. Recommended next bounded slice

Complete the smallest **existing-power-up lifecycle -> runtime -> summary certification seam** before adding any new power-up.

Why this slice:

- Cycle 065 closes the canonical crit-upgrade benchmark with real cadence, seeded combat resolution, boss punish authority, and partition equality.
- Wave 11 explicitly requires certifying heal, weapon caches, time dilation, berserk, and nuke before expansion.
- Existing pure tests prove single-use collection and one timed expiry, but do not yet close duplicate-effect refresh policy, full reset behavior, capped cache refill/selection, Liquidator nuke safety, or bounded summary truth together.
- This audit crosses collection, fixed-tick effects, combat/boss safety, telemetry, audio/presentation, and desktop/mobile evidence without adding a new mechanic or asset.

Proposed contract:

1. Audit the current authored placements and effect definitions; do not add Block Shield, Fee Holiday, Flash Crash, or Liquidity Magnet.
2. RED-test duplicate timed-effect refresh/expiry, 60/30/20 equality, complete run reset, heal caps, weapon-cache refill/selection caps, and malformed input.
3. Prove nuke damage routes through ordinary combat/boss authority, cannot delete the Liquidator, and does not bypass boss defeat/reward state.
4. Close bounded run-summary counters plus existing pickup/audio/silhouette truth without per-event histories or new projection authority.
5. Capture transient desktop/mobile collection and expiry evidence, then rerun release, build/bundle, network, performance, visual, security, and exact-index gates. Do not push or deploy.

## 5. Exact workflow for the next session

```bash
cd 'C:/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade'
git fetch origin
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/reboot/hmh-aaa-continuous
npx --yes vercel@latest inspect https://lestersarcade.io --non-interactive --no-color
```

Then:

1. Stop if local/remote/runtime/production identity differs from this handoff; reconcile newer work first.
2. Read `AGENTS.md`, this handoff, and the detailed Wave 10–15 sections in `2026-08-06-hmh-remaining-waves-execution-guide.md`.
3. Select one bounded gap from the earliest incomplete wave.
4. Establish RED before production code.
5. Implement minimal deterministic behavior.
6. Run focused tests and benchmark.
7. Run `npm run check`, `npm run test:release`, `npm run build`, long-run, serial browser/network/performance, and visual review.
8. Fetch/reconcile origin again before staging.
9. Stage only intended paths, run credential/diff checks, freeze `git diff --cached --binary | sha256sum`, and require a hash-bound exact-index review.
10. Commit the runtime slice locally; push only when the active user request explicitly authorizes it.
11. Build an immutable Vercel Preview only with explicit deployment approval; verify cache/runtime markers and browser/network/performance evidence before any promotion.
12. Promote only when separately authorized, then verify the production deployment ID, routes, markers, browser/network/performance, rollback, clean tree, and stopped listeners.

## 6. Non-negotiable boundaries

- Fixed 60 Hz simulation, maximum four catch-up steps.
- Human and zombie combat actors only.
- Child gameplay remains deterministic and parent wallet/profile/ranked/settlement authority remains separate.
- `SETTLEMENT_LIVE=false` remains binding.
- No wallet signature, contract deployment, transaction, testnet/mainnet write, or LitVM write without separate explicit HALT approval.
- A12 remains owner-gated.
- Do not reduce enemy counts to pass performance gates.
- Do not weaken bundle, expected-failure, heap, replay, visual, or exact-index gates to ship a slice.
- Keep `.hermes/`, temporary servers, screenshots, browser profiles, Vercel caches, and reviewer scripts uncommitted.

## 7. Ready-to-paste first prompt

```text
Continue Hard Money Heroes from docs/handoffs/2026-08-13-hmh-production-closeout-next-session.md on branch reboot/hmh-aaa-continuous. First reconcile local HEAD, origin/reboot/hmh-aaa-continuous, every HMH worktree, the index/worktree, and production. Cycle 065 closes the canonical Precision Ledger offer/selection -> real Coin Blaster cadence -> seeded combat resolver -> Liquidator benchmark seam with 60/30/20 equality, 2,237-test retirement-ledger PASS, and 81,393 bytes of initial-JS headroom; do not merge the older competing benchmark branches or duplicate combat authority. Select the smallest Wave 11 existing-power-up lifecycle/boss-safety audit for heal, caches, time dilation, berserk, and nuke before adding any new power-up. Preserve fixed 60 Hz/four-catch-up authority, caps, parent authority, and Web3 HALT boundaries. Obtain exact-index review before committing, and do not push, deploy, promote, publish, use paid services, or perform any wallet, contract, settlement, transaction, or LitVM action without separate live approval.
```
