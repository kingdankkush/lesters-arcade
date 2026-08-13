# Hard Money Heroes — 2026-08-13 production closeout and next-session gameplan

Date: 2026-08-13 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Branch: `reboot/hmh-aaa-continuous`

> **Current continuation authority:** this document supersedes the execution status and first-action instructions in the 2026-08-06 HMH handoffs. Keep those documents for detailed weapon, world, art, and acceptance-criteria intent. Reconcile live Git and Vercel state before trusting any checkpoint below.

## 1. Live checkpoint

### Git

- Runtime source commit: `e3679552b06781b34fe63e10a2260e7d3a3433a8`
- Local and `origin/reboot/hmh-aaa-continuous` matched at closeout.
- `origin/main`: `fa9585be7014db6515c536f9a09fdba5a3a2572f`
- Runtime worktree was clean after publication.

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

The exact staged binary-diff SHA-256 for the v17 runtime slice was:

```text
82f7122e3aab35bd191e12f59421c441f28b1bc684bbfdd6a8a0216fdddd192b
```

An independent hash-bound review returned `PASS` with no blockers.

## 2. Latest completed slice

Wave 10 now includes bounded anti-perfect-ring formation pressure:

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

1. **Close Wave 10 with missing role-specific depth and soak truth.**
   - Audit whether flankers, heavies, gas bombers, and validators have behavior beyond generic steering/cover.
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

Start with **Wave 10 role-depth closure for the Whale Enforcer heavy**.

Why this slice:

- The heavy currently pursues like a direct bruiser while the roadmap calls for readable chokepoint pressure.
- It can reuse current authored nav, stable intent planning, attack tells, telemetry, fixed-tick collision, and benchmark infrastructure.
- It stays smaller and safer than expanding the Liquidator or adding new power-ups.

Proposed contract:

1. Audit authored choke/cover metadata already available to the runtime. Do not invent a parallel nav authority.
2. RED-test a bounded heavy lane/chokepoint intent that activates only with a validated walkable target.
3. Keep hazard avoidance above the heavy role decision.
4. Lock the heavy decision during committed tells.
5. Keep collision, traversal, elevation, bounds, and damage canonical each tick.
6. Add immutable `chokepointHolding` intent and aggregate telemetry only if behavior is actually integrated.
7. Prove source-order independence, blocked-route rejection, low-FPS collision safety, and no teleporting.
8. Re-run the 128-body benchmark and focused browser/network/performance gates.

If the audit proves no suitable authored choke metadata exists, do not manufacture broad world metadata in the same patch. Select the next smallest role gap, preferably flanker side-lane separation using the existing stable-side/nav-grid contracts.

Likely files:

- `apps/hmh-reboot/src/enemy-navgrid.mjs`
- `apps/hmh-reboot/src/enemy-simulation.mjs`
- `apps/hmh-reboot/src/main.mjs`
- `tests/hmh-reboot-enemy-navgrid.test.mjs`
- `tests/hmh-reboot-enemy-simulation.test.mjs`
- `scripts/hmh-reboot-enemy-simulation-benchmark.mjs`
- service-worker and matching tests only if runtime bytes change.

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
Continue Hard Money Heroes from docs/handoffs/2026-08-13-hmh-production-closeout-next-session.md on branch reboot/hmh-aaa-continuous. First reconcile local HEAD, origin/reboot/hmh-aaa-continuous, the worktree/index, and https://lestersarcade.io. Load the HMH continuous-improvement, software-delivery, TDD, deterministic game-system review, release-candidate review, and deployment skills. Begin with the earliest incomplete Wave 10 role-depth gap. Audit whether the Whale Enforcer can gain a bounded authored chokepoint-holding intent using existing nav/world metadata. If the metadata is insufficient, choose the smallest existing-contract role gap instead rather than broadening scope. Use RED-GREEN TDD, preserve fixed-step collision/traversal/elevation/bounds/tells/hazards/damage, run focused and full certification, obtain exact-index review, and only publish through exact commit → immutable Preview → verified promotion. Do not perform any wallet, contract, settlement, transaction, or LitVM action. After the slice, update this handoff again.
```
