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

## 2. Latest completed slice

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
   - Add attack-token occupancy and projectile/effect-pressure assertions to the 100+ body soak if still absent.
   - Prove same-seed equality, different-seed divergence, two recurring spawn cycles, low-FPS blocker safety, and real desktop/mobile 100+ active-body endurance in one consolidated closeout report.

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

Close the **Wave 10 100+ body soak-truth gap** before adding another role rule.

Why this slice:

- Heavy chokepoint depth is now non-vacuously integrated and certified.
- The existing 128-body benchmark proves deterministic movement and safety but still does not report attack-token occupancy or projectile/effect-pressure maxima.
- Extending the read-only benchmark/telemetry seam is smaller and safer than inventing another AI behavior before Wave 10's endurance evidence is complete.

Proposed contract:

1. Reuse the fixed-tick enemy/combat resolver; do not create a second combat engine.
2. Add truthful attack-token occupancy plus projectile/effect-pressure maxima to the 100+ body soak.
3. Prove same-seed equality, different-seed divergence, and at least two recurring encounter cycles.
4. Add a low-FPS/four-catch-up blocker-safety case with no teleport or skipped canonical safety steps.
5. Preserve independent body, threat, token, projectile, and VFX caps; do not lower enemy counts to pass.
6. Run the benchmark, release ledger, long-run, serial desktop/mobile browser performance, and exact-index review.

Likely files are the existing enemy/combat benchmark script, focused benchmark tests or contracts, and runtime telemetry only where current reports lack a truthful source field.

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
Continue Hard Money Heroes from docs/handoffs/2026-08-13-hmh-production-closeout-next-session.md on branch reboot/hmh-aaa-continuous. First reconcile local HEAD, origin/reboot/hmh-aaa-continuous, the worktree/index, and https://lestersarcade.io. Cycle 050 locally completed deterministic Whale Enforcer authored-nav chokepoint pressure; verify its exact commit/index status rather than reimplementing it. Begin with the remaining Wave 10 soak-truth gap: extend the existing 100+ body benchmark with truthful attack-token occupancy plus projectile/effect-pressure maxima, same-seed equality, different-seed divergence, two recurring encounter cycles, and low-FPS blocker safety. Keep the benchmark read-only over existing fixed-tick enemy/combat authority; do not create another combat engine or lower caps. Use RED-GREEN TDD, run focused and full certification, obtain exact-index review, and do not push, deploy, promote, publish, use paid services, or perform any wallet, contract, settlement, transaction, or LitVM action without separate live approval. After the slice, update this handoff again.
```
