# New-Session Agent Prompt — Complete Remaining Hard Money Heroes Program

> **Historical planning snapshot (2026-08-06):** the reboot branch has advanced since this was written. Reconcile the current branch, deployed production identity, and completed wave evidence before using any task or commit checkpoint below.

Copy the prompt below into a new Hermes session.

---

You are continuing the Hard Money Heroes AAA deterministic reboot in Lester’s Arcade. Work autonomously through the remaining program in dependency order, completing real implementations and verified artifacts rather than stopping at plans or stubs.

## Repository and branch

```text
Repository: C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade
Expected branch: reboot/hmh-aaa-continuous
Last locally verified implementation HEAD: 88e75585eff94e596116a02a14092f800785cbc9
Last observed upstream HEAD: 036d430d33ab7cfd10d05766e99eb9b8da26c235
```

The upstream may have advanced. Never reset or restore the handoff over newer verified work.

## Read first

Load and follow these project documents in this order:

1. `docs/handoffs/2026-08-06-hmh-remaining-waves-execution-guide.md`
2. `docs/handoffs/2026-08-06-hmh-next-session-master-roadmap.md`
3. current project instructions such as `AGENTS.md`, `CLAUDE.md`, or `.cursorrules` if present
4. current tests and runtime source for the slice being implemented

Load these Hermes skills before implementation:

- `hmh-aaa-continuous-improvement`
- `software-delivery-lifecycle`
- `test-driven-development`
- `subagent-driven-development`
- `deterministic-combat-review`
- `game-systems-auditing`
- `requesting-code-review`
- `release-candidate-review`
- `exact-index-architecture-input-review`

Load the relevant specialized skill before each applicable art, level, UI, accessibility, security, GitHub, Vercel, or deployment task. Use the HMH skill’s `capacity-bound-weapon-vertical-slices` reference for all remaining weapons.

Create and maintain a session task list covering:

- Wave 8B Lightning Ledger and Wave 8 closeout
- Wave 9 Bear Market Burner, Forked Standard, and eight-weapon balance closure
- Wave 10 AI/pathing/encounters/swarm performance
- Wave 11 Liquidator/power-ups/build checks
- Wave 12 production art/terrain/lighting/animation/VFX, excluding A12
- Wave 13 authored-world expansion
- Wave 14 onboarding/meta UI/accessibility/analytics/docs/endurance
- Wave 15 Litecoin City first vertical slice
- final release, cloud Preview, and production-readiness work

Only one task should be in progress at a time. Mark each task complete immediately after real verification.

## First: reconcile live authority

Before editing, run and preserve the results of:

```bash
cd '/c/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade'
git fetch origin
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse '@{upstream}'
git log -8 --oneline --decorate
npm run build:meta
node -e "const fs=require('fs');const entry=fs.statSync('apps/portal/dist/hmh-reboot/game.js').size;const vendor=fs.statSync('apps/portal/dist/chunks/hmh-pixi.js').size;console.log(JSON.stringify({entryBytes:entry,vendorBytes:vendor,combinedInitialChildBytes:entry+vendor,cap:1050000,remaining:1050000-entry-vendor}))"
```

Inspect the current deployment state through the configured Vercel/Git tooling before making release claims. Do not expose credentials.

Stop and reconcile rather than overwriting work if:

- branch/HEAD/upstream differs from the handoff;
- tracked edits exist that are not explained by the current Lightning slice;
- a newer certified wave or deployment exists;
- generated outputs are being mutated by a live background process;
- the current bundle/cap contract differs from the guide.

The expected uncommitted starting files from the interrupted Wave 8B work are:

```text
apps/hmh-reboot/src/lightning-ledger.mjs
tests/hmh-reboot-lightning-ledger.test.mjs
```

The prior master roadmap and the new guide/prompt may also be untracked documentation. Inspect them; do not delete them as scratch files.

## Certified baseline: do not rebuild it as missing

Treat these local commits as completed foundations unless live evidence proves a regression:

```text
428be2e4  canonical run-summary authority
cbab316e  run history, provenance, and combo closure
1c941196  Wave 7 runtime/controls/settings/audio/movement polish
0d9b4100  stable Pixi vendor split
88e75585  Wave 8A Hash Rail
```

Hash Rail is a completed separate slice. Do not mix corrections to it into Lightning unless a current behavioral test proves a real blocker; if so, isolate the correction as its own reviewed fix.

Two authored-props reproducibility runs completed successfully with 101 unique assets in a 1024×1024 atlas. Do not rerun them merely because an old background notification appears; rerun only when the current slice changes their source/outputs or current evidence is stale.

## Non-negotiable constraints

1. The child fixed-step simulation owns canonical gameplay truth.
2. Rendering, animation, camera, lighting, VFX, audio, and HUD remain projection-only.
3. Parent owns profile persistence, portal presentation, analytics, wallet state, and ranked/publication authority.
4. Bridge payloads remain allowlisted, bounded, and at or below 64 KB.
5. The raw combined initial child gameplay entry plus preloaded Pixi vendor must remain at or below `1,050,000` bytes. A vendor split is not a cap loophole.
6. Total game delivery remains within 300 MB.
7. Simulation uses fixed ticks, seeded named RNG, stable ordering, bounded collections, and deterministic reset/restart behavior.
8. Humans and zombies are the only active combat actors. Recast all incompatible Level 2 concepts before runtime use.
9. Do not implement A12/256 px hero work without explicit owner approval.
10. Generated assets must be changed through repository-owned source manifests, Blender/Python owners, and reproducible regeneration. Never hand-edit generated art.
11. Run browser profiles serially against one exact built candidate.
12. Do not lower safety, performance, visual, determinism, schema, or budget thresholds to make a wave pass.
13. Do not push unfinished, RED, over-budget, or inconclusive work.
14. No wallet, contract, settlement, testnet, or LitVM write without a separate explicit HALT approval.
15. Website deployment authorization never authorizes blockchain writes.

## Current bundle blocker

The last measurement was:

```text
entry:   321,272 bytes
vendor:  730,790 bytes
combined: 1,052,062 bytes
cap:     1,050,000 bytes
over:        2,062 bytes
```

Re-measure. If still over, complete a behavior-preserving aggregate byte-recovery slice before integrating more Lightning runtime code. Add or correct a build regression that enforces `entry + preloaded vendor <= 1,050,000`. Recover at least 15–25 KB if feasible so Lightning is not built against a few bytes. Use metafile attribution. Do not raise the cap, omit required gameplay, hide gameplay in another preloaded chunk, or report compressed/network bytes instead of raw emitted bytes.

Certify and commit any capacity-only change separately from Lightning.

## Execution method for every implementation slice

Use RED → GREEN → REFACTOR:

1. inspect current behavior and similar implementation;
2. write the smallest failing behavioral test;
3. run it and preserve the exact RED reason;
4. implement the smallest coherent fix;
5. run focused tests;
6. add malformed-input, boundary, reset, and determinism coverage;
7. measure bundle/performance consequences;
8. produce and inspect real browser/art evidence where player-visible;
9. stage only the slice;
10. freeze and review the exact staged index;
11. commit separately only when every applicable gate passes.

For complex slices, delegate independent source inspection, spec review, and code-quality review in parallel where safe. Do not let reviewers share and mutate the same staged checkout. Verify their claims yourself against real tests/files/artifacts.

## Wave 8B: finish Lightning Ledger first

The current pure module’s three focused tests passed once, but that is only a starting point. The active channel specification supersedes the older triggered three-target-carbine prose in the prior roadmap.

Required canonical behavior:

- held primary-fire channel;
- stable nearest-unhit chain order by `(distanceSquared, targetId)`;
- ordinary first-target LOS/range/cover/targetability authority;
- explicit LOS/cover policy on every later jump;
- hard cap of eight total targets;
- six fixed ticks of target-loss grace;
- 108-tick/1.8-second break cooldown;
- damage ramp from 1× toward 3× across 180 ticks;
- forced overheat at 180 ticks with a three-second cooldown;
- stop on release, dodge, switch, empty cells, invalid target after grace, reset, death, and applicable pause state;
- six authoritative visible cell segments;
- no repeated target in one pulse;
- no through-cover chain;
- no render/wall-clock authority.

Complete these bounded sub-slices:

1. Harden `lightning-ledger.mjs` with malformed, duplicate-ID, tie, range, LOS, grace, overheat, reset, reversal, pulse-cap, and 60/30/20 tests.
2. Integrate a canonical `lightning-ledger` definition, cell/reserve state, switching, fixed-tick channel, combat damage, shield/armor handling, and stop reasons through existing weapon/combat authority.
3. Add one deterministic rare biome acquisition event within the first eight minutes, with seed equality/divergence, reachability, nav, collision, and protected-radius tests.
4. Add three three-tier branches and a capstone compatible with the held-channel identity:
   - Conductivity: radius, chain allowance, Mesh Network retention;
   - Voltage: first-hit damage, ramp improvement, bounded final-arc knockback;
   - Reconciliation: reserve, recovery, one bounded full-chain segment refund;
   - Proof of Network capstone without raising the certified target/effect cap.
5. Extend run-summary telemetry with bounded fixed fields for channel starts/releases/break reasons/overheats, active/valid ticks, pulses, chain histogram, max chain/ramp, damage by jump index, full chains, cell use/refunds/waste, boss/support outcomes, and damage taken while equipped. Preserve stored schema compatibility.
6. Add dedicated repository-owned world/in-hand/pickup/icon art: compact copper/silver emitter or rotating dish, white-blue arcs, and a readable six-segment indicator.
7. Add deterministic start/loop/pulse/break/overheat audio through the existing allocator and voice caps.
8. Add pooled segmented arcs, target flashes, reduced-flash/colorblind-safe treatment, HUD/cooldown/cell status, and mobile-safe composition.
9. Add a dedicated browser smoke that obtains/selects the weapon through canonical authority and proves start, ramp, chain, cell use, grace, break, and overheat with screenshot hashes and zero console/page errors.
10. Run static, moving, clustered/spread four/eight-body, mixed support/heavy, Liquidator, resource, pressure, partition, and desktop/mobile comparisons. Lightning should lead clustered clear while remaining below Hash Rail/Coin Blaster isolated boss efficiency.
11. Run full gates, exact-index review, and commit only Lightning as `feat(hmh): complete wave 8 lightning ledger`.

Do not begin Bear Market Burner until Lightning is fully under cap, certified, reviewed, and committed.

## Wave 9: two separate weapon slices plus balance closeout

### Bear Market Burner

Implement bounded fixed-tick flame pulses, finite fuel/reserve, non-stacking burn refresh, fixed scorch/hazard caps and replacement order, AI hazard cost, three branches/capstone, bounded telemetry, authored projector/canister art, pooled mobile-safe flame VFX, deterministic audio, HUD, browser proof, and focused/full certification. It must excel at close corridor control but remain weak at range and limited in boss uptime. No permanent boss DoT, effect explosion, or audio-voice runaway. Commit Burner alone.

### Forked Standard

Unify melee authority truthfully. Primary fire alternates deterministic swept thrust/sweep attacks. Existing standalone melee must become a tested secondary action or be retired from runtime/help. Add explicit reach/arc/elevation/cover/one-hit ordering, ammo-free cadence and whiff cost, branches/capstone, touch/controller parity, bounded telemetry, hero-aligned authored spear art, VFX/audio/HUD/browser proof, ledge/wall/one-way-drop tests, and partition equality. Commit Forked Standard alone.

### Eight-weapon closure

Run and record static, moving, clustered/spread swarm, mixed-role, Liquidator, resource exhaustion, overkill, projectile/effect/audio pressure, and 30-minute hero × weapon × enemy × seed evidence. No weapon may lead single-target, swarm, safety, economy, and boss damage simultaneously. Tune only the smallest evidence-supported knob and commit balance-only changes separately.

## Wave 10: AI, pathing, encounter, and swarm depth

In separate reviewed slices:

- instrument baseline AI/animation/query/replan/stuck/token/projectile/effect pressure;
- add deterministic spatial hashing;
- add near/mid/far decision cadence without skipping per-tick safety;
- add cached-route/flow-field distant steering on the authored navgrid;
- add bounded stuck recovery, never random teleport;
- lock attack intent/geometry at tell start;
- add cover-aware suppressor/flanker/heavy/gas-bomber/validator roles;
- add hazard path cost without changing collision truth;
- add anti-clumping/anti-perfect-ring behavior;
- prioritize animation by gameplay readability;
- prove same-seed equality, different-seed divergence, recurring spawns, low-FPS blocker safety, and 100+ active-body desktop/mobile endurance.

Do not reduce canonical enemy-count targets to obtain a pass.

## Wave 11: Liquidator and power-up depth

Preserve the Liquidator’s timeline and certified identity. Add one authored collision-consistent mechanic per phase, bounded adds and safe/unsafe sectors, a final punish window, one locked geometry source for tell/resolution, weapon-role checks without immunity, and build tests for no-hit, baseline, high/low DPS, melee, and crowd control. Add bounded phase telemetry.

Audit existing power-ups before adding Block Shield, Fee Holiday, Flash Crash, or Liquidity Magnet. Every effect must be deterministic, bounded, stack-policy explicit, reset-safe, boss-safe, tracked, visually distinct, and mobile HUD-safe.

## Wave 12: production-art quality, excluding A12

Complete the industrial/mining kit, roofless-interior and secret modules, terrain transition bands, measured 1024 px material trial with 512 fallback, surface-specific impacts, district value breakup, projection-only district lighting, pooled light/contact/emissive treatment, weapon hold/recoil/reload overlays, transition and boss tell/recovery animation improvements, and a pooled VFX registry with hard family caps and truthful drops.

Use only repository-owned deterministic asset pipelines. Inspect native outputs and full-resolution runtime evidence. Do not begin 256 px hero/A12 work without explicit owner approval.

## Wave 13: authored-world expansion

Build and certify the ruined-neighborhood interior packet, vertical packet, secret/cache packet, district atmosphere packet, encounter anchors/lanes/spawn/retreat/reward rings, seam landmarks, visible blocker art, crossing tests, and production visual scenes. Preserve each district’s distinct combat grammar and protected spawn radius.

## Wave 14: onboarding, UI, accessibility, analytics, docs, endurance

Complete hero comparison/selector accessibility, truthful cabinet metadata, three-action-or-fewer start flow, achievement dates/progress/tooltips, signature/connection/error/sign-out truth, privacy-conscious analytics without raw wallet payload, generated-art retirement with provenance, public documentation, colorblind/contrast/caption/remapping/touch/HUD accessibility, and real-interaction 30-minute desktop/mobile endurance.

## Wave 15: Litecoin City first vertical slice

Audit `apps/portal/src/hmh-campaign-levels.mjs`. Preserve useful geography but recast every non-human/non-zombie actor before runtime use. Build a compact Level 2 metadata contract and only one certified slice: Litecoin Square → one connector → one optional POI → one human/zombie mini-boss → extraction/return. Include urban/rain/neon assets, visible boundaries, nav, minimap, spawn safety, and one production visual scene. Do not expand Level 2 until this slice passes all traversal, collision, combat, art, mobile, performance, and replay gates.

## Required gates for every slice

Run applicable focused tests plus:

```bash
npm run test:release
npm run build:meta
npm run certify:hmh:browser
npm run audit:hmh:network
git diff --check
```

Also run current repository syntax/check, visual regression, asset QA/reproducibility, performance, heap, long-run, and endurance commands discovered from `package.json` and current docs. Do not guess command names.

Before each commit:

```bash
git status --porcelain=v1
git diff --cached --name-only
git diff --cached --check
git diff --cached --binary | sha256sum
```

Scan the exact staged diff for credentials. Require an exact-index review that returns `PASS` and literal `BLOCKERS: none`. Any staged change requires a new hash, affected gates, and review. Keep implementation, infrastructure, balance, and documentation commits separate where practical.

## Final shipping sequence

Only after Waves 8–15 are all complete and the worktree contains no unfinished wave:

1. reconcile local/upstream/main and every certification;
2. run all final release, build, syntax/check, network, console, visual, responsive, performance, heap, endurance, path, and secret gates against one exact candidate;
3. confirm raw combined initial child JS and total delivery budgets;
4. obtain final architecture, deterministic-combat, security, release-risk, and release-candidate reviews;
5. push the reviewed branch and verify remote HEAD equals local HEAD;
6. obtain a clean cloud Preview build and record deployment ID/immutable URL;
7. verify Preview routes, artifact hashes, service worker/cache, responsive behavior, network/console, and byte parity;
8. stop before production unless the owner explicitly authorizes production promotion in the active session;
9. if authorized, promote the exact verified immutable Preview rather than rebuilding;
10. prove these live routes and deployed artifacts:
   - `https://lestersarcade.io/hmh-reboot/`
   - `https://lestersarcade.io/games/hard-money-heroes/play`
11. retain and verify a known-good rollback deployment;
12. confirm no wallet, contract, settlement, testnet, or LitVM write occurred.

## Reporting standard

At each wave closeout, report:

- commit SHA and message;
- exact staged binary-diff SHA-256;
- tests/gates with real counts and exit status;
- entry, vendor, combined child bytes and remaining headroom;
- deterministic art/audio hashes and asset counts if changed;
- benchmark/performance results;
- browser evidence paths and screenshot hashes;
- exact blockers and owner-gated work;
- local/upstream/cloud/production status without conflating them.

Keep working through the dependency-ordered list until a genuine external blocker or approval gate is reached. Do not stop after writing a plan, a pure module, or a local test. A feature is complete only when integrated, exercised, visually reviewed where applicable, fully gated, exact-index reviewed, and committed as its intended slice.

---
