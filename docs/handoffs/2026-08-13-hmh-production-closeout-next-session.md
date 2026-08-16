# Hard Money Heroes — 2026-08-13 production closeout and next-session gameplan

Date: 2026-08-13 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Branch: `reboot/hmh-aaa-continuous`

> **Current continuation authority:** this document supersedes the execution status and first-action instructions in the 2026-08-06 HMH handoffs. Keep those documents for detailed weapon, world, art, and acceptance-criteria intent. Reconcile live Git and Vercel state before trusting any checkpoint below.

## 1. Live checkpoint

### Git

- Runtime source commit: `e3679552b06781b34fe63e10a2260e7d3a3433a8`
- Published continuation head: `b14fbbebbebd76609563d8825f0824c661c3622b`
- Local and `origin/reboot/hmh-aaa-continuous` matched at `b14fbbeb` before Cycle 050 work began.
- `origin/main`: `fa9585be7014db6515c536f9a09fdba5a3a2572f`
- Cycle 050 is locally committed as `fc6ad3da15d4cd134f565f1e6e579a7d63a087ba` on top of `b14fbbeb`; it has not been pushed or deployed. `origin/reboot/hmh-aaa-continuous` therefore remains at `b14fbbeb`.
- Cycle 050 documentation closeout is local HEAD `576b6388`. Cycle 051 is a coherent uncommitted candidate on top: source verification is complete, but inherited visual-baseline drift and exact-index review remain open. Reconcile live Git before editing it.

### Production

- Public site: `https://lestersarcade.io`
- HMH routes:
  - `https://lestersarcade.io/hmh-reboot/`
  - `https://lestersarcade.io/games/hard-money-heroes/play`
- Verified immutable Preview: `dpl_GW6Kkk8v3urJQRfpPasggePk9xhn`
- Preview URL: `https://lesters-arcade-9stogfwhw-justin-agent-projects.vercel.app`
- Current production deployment: `dpl_EdLJRnpmh55bEe8fNWj3x3oCVotA`
- Immutable production URL: `https://lesters-arcade-ebvbhfyek-justin-agent-projects.vercel.app`
- Retained rollback deployment: `dpl_8wxJAwqrJKD3cMPscMS5QBG383GJ`
- Active cache marker: `lesters-arcade-v17-hmh-formation-pressure`
- Cycle 050 local candidate cache marker: `lesters-arcade-v18-hmh-heavy-chokepoints` (not deployed)
- Cycle 051 local candidate cache marker: `lesters-arcade-v19-hmh-endurance-pressure` (not deployed)

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

### Cycle 051 local source verification (2026-08-16; uncommitted)

- Slice: truthful 128-body attack-token, projectile/effect-pressure, recurrence, and low-FPS blocker evidence.
- Release ledger: **2,199 evaluated = 2,148 passed + 51 exact expected legacy failures**; unexpected failures **0**.
- Focused endurance/performance tests: **10/10 PASS**; post-build shell: **12/12 PASS**; syntax: **341 JavaScript modules + 49 Python scripts**.
- Benchmark: **128** bodies over **360** fixed ticks and **46,080** safety steps; body/threat **128/192** and **496/640**; token families **6/5/4/2** and total **17/17**; projectile/effect peaks **8/128** and **12/64**; **4,475** blocker contacts, **148** attack events, and **0** drops/teleports.
- Determinism: same-seed reports equal; seed `1337` digest `2e38a09a` diverges from seed `1338` digest `2de9efbe`; one-step and four-catch-up frame partitions are equal; both 180-tick recurrence windows are non-vacuous.
- Build: HMH entry **384,919 bytes**; Pixi **575,891 bytes**; initial aggregate **960,810 / 1,048,576 bytes**; headroom **87,766 bytes**.
- Browser: six-archetype desktop/mobile detail smoke PASS; all five responsive profiles had zero changed anchor pixels; performance p95 **8.2 / 8.1 ms** desktop/mobile; heap deltas **-97,631 / -4,384,170 bytes**; network/console audit had zero errors.
- Visual baseline blocker: `frontier-relay-mobile` and `combat-engaged-desktop` fail the signature gate with the exact same metrics from an isolated clean build of baseline HEAD `576b6388`. The candidate did not cause the drift; no baseline was weakened or accepted.
- Hosted independent review was unavailable because the configured Nous delegation provider had no access token. Exact-index review and commit remain pending; no unavailable reviewer was counted as PASS.
- Production, Preview, aliases, rollback, `main`, settlement, wallets, contracts, transactions, external uploads, paid services, and LitVM writes were untouched.

## 2. Latest completed slice

Cycle 051 closes the deterministic benchmark half of the Wave 10 soak-truth gap:

- `runEnemyEnduranceSoak(...)` reads the existing enemy population, collision/traversal, attack-token, Auto Miner, projectile-flight, and effect-compaction authorities rather than duplicating gameplay.
- Runtime projectile/effect caps and effect lifetime now have one immutable source consumed by both the browser and evidence seam, without changing their values.
- The existing benchmark now self-certifies same-seed equality, different-seed divergence, one-versus-four fixed-step partition equality, two recurring windows, non-vacuous blocker contacts, all family-token peaks, and independent capacity maxima.
- Browser-visible gameplay semantics are unchanged; the child bundle increases by only `103` bytes.

The remaining Wave 10 closeout item is real wall-clock desktop/mobile 100+ active-body endurance. Current browser performance evidence uses 11 active enemies and must not be mislabeled as the 100+ body proof.

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
- Wave 11 partially complete:
  - Liquidator deterministic phase timeline and certified presentation;
  - bounded Bad Debt adds;
  - boss warning captions;
  - weapon-role checks without hard immunity;
  - final-phase 60-tick recovery punish window.

### Immediate remaining items

1. **Close Wave 10 with the remaining role-specific depth and soak truth.**
   - The Whale Enforcer heavy gap is locally complete; audit flankers, gas bombers, and validators for one remaining justified behavior gap at a time.
   - Implement one bounded role behavior at a time only where a current behavioral gap exists.
   - Deterministic 128-body attack-token/projectile/effect pressure, seed, recurrence, and low-FPS blocker assertions are locally complete in Cycle 051.
   - Add the remaining serial desktop/mobile real-time 100+ active-body endurance proof, including frame/heap/network/runtime errors and the same pressure telemetry.
   - Reconcile the two inherited visual signatures against the last accepted baseline before accepting any visual update.

2. **Finish Wave 11 Liquidator build checks.**
   - Add or verify one authored positional mechanic per phase without rewriting the boss.
   - Complete no-hit, baseline, high/low DPS, melee-heavy, and crowd-control build matrices.
   - Record phase times, damage windows, adds, per-phase damage, and defeat tick through bounded existing telemetry.
   - Preserve ordinary-weapon damage, role multiplier `1.15`, punish multiplier `1.1`, and ticks `0–59` active / tick `60` inactive.

3. **Wave 11 power-up audit before expansion.**
   - Audit heal, caches, time dilation, berserk, nuke, stack/reset policy, boss safety, silhouette, audio, and telemetry.
   - Add Block Shield, Fee Holiday, Flash Crash, or Liquidity Magnet only after the existing set is behaviorally certified.

4. **Wave 12 production-art and presentation work.**
   - Industrial/mining kit, wet-bank/foam/scree transitions, interior/secret kits, all-weapon model coverage, lighting, animation transitions, and pooled VFX caps.
   - A12/256 px hero work remains owner-gated.

5. **Wave 13 authored-world expansion.**
   - Ruined-neighborhood interiors, vertical set-pieces, secrets, atmosphere, encounter staging, visible blockers, traversal tests, and visual scenes.

6. **Wave 14 onboarding, accessibility, meta UI, docs, analytics, and active endurance.**
   - Hero comparison/accessibility, truthful cabinets, three-action start flow, achievement progress, wallet-state copy audit, privacy-conscious analytics, colorblind/caption/remapping/touch/HUD-scale work, and a real-interaction desktop/mobile endurance pass.

7. **Wave 15 Litecoin City first vertical slice.**
   - Reconcile all legacy non-human concepts before runtime use.
   - Build only Litecoin Square → one connector → one optional POI → one human/zombie mini-boss → extraction/return before expansion.

## 4. Recommended next bounded slice

Finish **Wave 10 real-browser 100+ active-body endurance** before adding another role rule.

Why this slice:

- Cycle 051 now closes deterministic pressure truth, seed divergence, recurrence, and low-FPS blocker safety.
- Existing browser performance passes on desktop/mobile but only reports 11 active enemies; it is not the requested 100+ body endurance evidence.
- A serial evidence-safe 128-body browser route can consume current authority and telemetry without adding AI or combat behavior.

Proposed contract:

1. Use an evidence-safe route or bounded query to seed 128 real active enemies through existing spawn/population authority; never ship an acquisition shortcut in normal play.
2. Run desktop and mobile serially over a meaningful wall-clock interval; sample frame p95/p99, retained heap, long tasks, catch-up saturation, network/console/page errors, and body/threat/token/projectile/effect pressure.
3. Require all 128 bodies and all pressure fields to be observed non-vacuously; keep existing caps and fixed-tick safety.
4. Reconcile `frontier-relay-mobile` and `combat-engaged-desktop` against the last accepted visual baseline commit; do not use `--accept` until player-visible review explains the delta.
5. Freeze Cycle 051 only after exact-index review completes; then commit locally without push or deployment.

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
10. Commit and push the runtime slice.
11. Build immutable Vercel Preview, verify cache/runtime markers and browser/network/performance evidence, then promote that exact Preview only when the active user request authorizes production.
12. Verify the production deployment ID, routes, markers, browser/network/performance, rollback, clean tree, and stopped listeners.

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
Continue Hard Money Heroes from docs/handoffs/2026-08-13-hmh-production-closeout-next-session.md on branch reboot/hmh-aaa-continuous. First reconcile local HEAD, origin/reboot/hmh-aaa-continuous, the worktree/index, and production; Cycle 051 is currently an uncommitted candidate on baseline 576b6388, so do not overwrite it. Verify the 128-body deterministic soak and focused tests, then finish the remaining Wave 10 real-browser desktop/mobile 100+ active-body endurance proof using existing population/combat authority and truthful body/threat/token/projectile/effect telemetry. Also reproduce and diagnose the inherited frontier-relay-mobile and combat-engaged-desktop visual signatures from the last accepted baseline; do not weaken or accept baselines without player-visible review. Preserve fixed 60 Hz/four-catch-up authority and all caps. Obtain exact-index review before committing, and do not push, deploy, promote, publish, use paid services, or perform any wallet, contract, settlement, transaction, or LitVM action without separate live approval.
```
