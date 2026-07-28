# Hard Money Heroes Cycle 027 Claude continuation handoff

Date: 2026-07-28 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Continuation branch: `reboot/hmh-aaa-continuous`
Certified Cycle 027 runtime/art source: `4c0066371423cd752ac48d2c39c66e275635934d`
Certified Cycle 027 commit patch SHA-256: `6dcd1ec317d4e1234ce1a3d79d4e2b465f9c5f67f8245d9108aa1200be8b7ea5`
Production source: `a81f1c8f830f3339ebb568de166c108e58f695d3` (Cycle 021)
Production deployment: https://lesters-arcade-gsbj7uxer-justin-agent-projects.vercel.app
Settlement: `SETTLEMENT_LIVE=false`

> This is the current continuation brief. The documentation closeout commit containing this file should be the branch HEAD after push. Verify live Git before changing anything. Cycle 027 is certified continuation source, not production.

## Standing mandate

Continually upgrade the game world, authored level design, level assets, character and enemy models, movement, combat, weapons and leveling. Treat this as an ongoing quality program.

Every session must:

1. Begin with a read-only branch/Web3 health check.
2. Fix a broken rail first with the smallest safe change.
3. Take one bounded, test-first vertical slice.
4. Keep fixed-step simulation and parent/child authority intact.
5. Keep art, camera, VFX, interpolation and audio projection-only.
6. Run the full gate battery.
7. Freeze the literal staged binary diff and obtain exact-index reviews.
8. Commit and push only `reboot/hmh-aaa-continuous`.
9. Stop for explicit approval before any preview promotion, production promotion, wallet/signature request, contract action or settlement change.

## Mandatory read order

Before changing code, read in this order:

1. This file.
2. `docs/handoffs/2026-07-27-hmh-cycle-026-hermes-handoff.md`.
3. `docs/handoffs/2026-07-27-hmh-cycle-021-production-claude-handoff.md`.
4. `docs/handoffs/2026-07-25-hmh-art-pipeline-hermes-handoff.md`.
5. `docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md`.
6. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`.
7. `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md`.
8. Latest `docs/hmh-reboot/cycles/CYCLE-*.md`.
9. Latest release/preview certificates and `docs/hmh-reboot/COMPATIBILITY.json`.

`AGENTS.md` carries the same order and is authoritative for repository policy.

## First action: read-only health check

Run before editing:

```bash
cd '/c/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade'
git status --short --branch
git branch --show-current
git rev-parse HEAD
git rev-parse '@{u}'
git log --oneline -12
git grep -n 'SETTLEMENT_LIVE' -- ':!docs/**' ':!*.md'
npm run design:web3-audit
npm run design:web3-live
```

Expected after this handoff is pushed:

- Branch: `reboot/hmh-aaa-continuous`.
- Local branch equals its remote upstream.
- Runtime Cycle 027 commit `4c0066371423cd752ac48d2c39c66e275635934d` is in linear history.
- Production remains Cycle 021.
- Web3 audit: 9/9 PASS.
- Live readiness: PARTIAL 3/4.
- `SETTLEMENT_LIVE=false`.

If Git or Web3 rails differ, stop and investigate. Never infer production from branch HEAD.

## What Cycle 027 shipped

Cycle ledger: `docs/hmh-reboot/cycles/CYCLE-027.md`

### Enemy role-detail geometry

The two weakest combat silhouettes were improved test-first:

- Forkrunner: 10-part cyan forearm guard, crossbar and fork-tine kit.
- Gas Bomber: 11-part respirator, enlarged filters, hoses, separated belt bombs/caps and hazard badge.
- Unknown `detailKit.kind` values fail closed in Blender.
- Inspection output records kit kind and authored part count.
- Human/zombie anatomy remains canonical.

Authoritative files:

- `apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json`
- `scripts/hmh-blender/create-hmh-enemy-roster.py`
- `tests/hmh-reboot-enemy-role-detail.test.mjs`

### Runtime projection/readability

- Rank-and-file production atlas scale increased from `0.42` to `0.50`.
- Collision radius, hurtbox, AI, speed, damage, spawn cadence, replay and save authority did not change.
- The scale change is visual projection only and was reviewed against health bars/attack footprints.

### Durable roster-preview evidence route

`evidenceSafe=1&rosterPreview=1` now:

- creates all six non-boss enemy families;
- arranges them in a compact two-row formation around `runtimePlayerSpawn`;
- disables autofire, movement, attacks and director insertion only for that evidence route;
- reports preview/autofire/director/atlas telemetry;
- leaves normal opening composition and director behavior unchanged.

The permanent gate is:

```bash
npm run smoke:hmh:enemy-details
```

It certifies desktop 1440x900 and mobile 390x844, all six exact families, all six production atlases, one Pixi canvas, zero director insertions, no overflow and zero browser errors.

### Browser certification rail repairs

Cycle 027 also repaired two stale/false browser rails found by the full battery:

1. `certify:hmh:browser` now executes the freshly built local `game.js`, blocks service workers, disables browser cache and maps the canonical `https://lestersarcade.io/assets/**` namespace to traversal-checked tracked local assets.
2. Mobile combat synthetic keys are held across fixed simulation ticks instead of using zero-duration key presses.

Do not remove these safeguards. A stale bundle previously made the release certifier report eight touch controls even though the current child correctly owns four.

### Deterministic authored output

Pinned Blender `5.1.2` verification:

- 7 actors.
- 1,368 frames.
- 0 duplicate frames.
- 6,448,834 total atlas bytes.
- Full rebuild A/B reproducibility PASS.

Because the enemy scene is shared, the deterministic verify rerenders all seven actor atlas/manifest/contact-sheet families even though only Forkrunner and Gas Bomber geometry changed.

## Cycle 027 certification

- Exact commit patch hash: `6dcd1ec317d4e1234ce1a3d79d4e2b465f9c5f67f8245d9108aa1200be8b7ea5`.
- Release ledger: 1,773 total / 1,721 passing / 52 accepted legacy failures / 0 unexpected.
- Syntax: 335 JavaScript modules / 49 Python scripts.
- Visual regression: 8/8 unchanged, max delta 2.
- Desktop/mobile roster detail smoke: PASS.
- Five-profile local candidate browser matrix: PASS.
- Combat desktop/mobile/bridge: PASS.
- Cockpit, portal E2E and mobile controls: PASS.
- Network: four scenarios, zero request/HTTP/console/page failures.
- Performance: desktop p95 7 ms, mobile p95 7 ms.
- Bundle: 1,021,358 / 1,050,000 bytes.
- Security: zero findings; third-party checks PASS.
- Asset QA: PASS.
- Strict repository health/CDN/docs: PASS.
- Exact-index architecture review: PASS.
- Exact-index release/adversarial review: findings none, PASS.

No preview or production deployment occurred. No transaction, signature, wallet request, contract action or settlement change occurred.

## Highest-value next bounded slice: Cycle 028

### Recommendation

Add front/side-readable role kits for **Bagholder Rusher** and **Whale Enforcer**.

Why these two:

- Bagholder still depends heavily on color/chest mass; its bag/carrying role is weak from combat-facing angles.
- Whale Enforcer reads as broad/armored but lacks unmistakable enforcement gear at runtime scale.
- Both can reuse the proven `detailKit` architecture without touching gameplay authority.

### Test-first acceptance

1. Add RED manifest/builder tests for two explicit fail-closed kit kinds and minimum authored part counts.
2. Keep canonical human/zombie anatomy.
3. Make kit parts front/side-readable at `0.50` runtime scale.
4. Do not change collision, AI, health, damage, speed, spawn or replay data.
5. Run `npm run assets:hmh:enemy-roster:verify` with Blender 5.1.2.
6. Review contact-sheet before/after comparisons.
7. Run `npm run smoke:hmh:enemy-details` with desktop/mobile screenshots.
8. Run the full gate battery and exact-index reviews.
9. Write `docs/hmh-reboot/cycles/CYCLE-028.md`.

Do not expand Cycle 028 into world props, combat tuning and animation simultaneously. Keep it bounded.

## Remaining quality program after Cycle 028

### Character/enemy models

- Add role kits for Liquidator Agent, Fork Cultist and Liquidator boss.
- Improve hero-specific equipment silhouettes without replacing approved identities.
- Add deterministic damage-state or phase details where they truthfully reflect canonical state.
- Continue evaluating actor scale against health bars, hurt footprints and dense crowds.

### Animation readability

- Add recoil and recovery to ranged attacks.
- Add cloth, strap, satchel and canister secondary motion.
- Add clearer hit reactions, stagger recovery and boss phase poses.
- Preserve clip tick counts and replay hashes. Animation remains projection-only.

### World/level assets

- Replace remaining simple building/tree/crate/landmark silhouettes with authored modular geometry.
- Improve authored route framing and district identity without changing canonical collision or ground queries.
- Re-review 31 relit prop contact sheets with human visual acceptance.
- Close the strict prop reproducibility gate’s small renderer-tolerance gap rather than weakening thresholds blindly.

### Movement and combat

Take one hypothesis per cycle with RED deterministic coverage:

- acceleration/deceleration and stop precision;
- dash recovery and cancel readability;
- melee reach/arc clarity;
- grenade cadence and recharge economy;
- weapon recoil, heat, reload and ammo pressure;
- enemy pressure bands and boss feedback.

Never tune several interdependent systems in one unmeasured pass. Preserve 60/30/20 schedule equivalence and replay hashes.

### Weapons and leveling

- Rebalance the five Cycle 025 capstones through seeded simulations and live playtests.
- Review upgrade offer frequency, sibling disclosures and rank progression pace.
- Test build archetypes for dominance, dead choices and runaway multiplicative stacking.
- Keep parent-owned profile/session/official-completion boundaries intact.

### Mobile and human acceptance

- Run real-phone portrait/landscape acceptance for touch ergonomics, audio balance, thermal behavior, reduced motion and motion comfort.
- Run real keyboard/mouse and controller acceptance.
- Harden portal E2E at actual mobile viewport sizes; current portal E2E still primarily exercises a desktop-sized page.

### Release/operations

- Resolve current/previous Vercel `dpl_...` IDs and verify rollback through an authenticated Vercel session/dashboard.
- Add CI/branch protection or preserve manual exact-index discipline.
- Keep future preview and production promotion as separate explicit approval steps.

### Web3

Hardened verifier/attestation and LitVM deployment remain blocked. Do not deploy contracts, request wallets/signatures, send transactions, alter authority or enable settlement without separate explicit HALT approval.

## Full gate battery

Use a local origin explicitly. This machine may retain `HMH_REBOOT_ORIGIN=https://lestersarcade.io` in the shell.

Terminal A:

```bash
cd '/c/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade'
npm run build
python -m http.server 8791 --bind 127.0.0.1 -d apps/portal
```

Before starting, ensure there is only one listener on 8791:

```bash
/c/Windows/System32/netstat.exe -ano | python -c 'import sys; print("".join(line for line in sys.stdin if ":8791 " in line and "LISTENING" in line))'
```

Terminal B:

```bash
cd '/c/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade'
export HMH_REBOOT_ORIGIN='http://127.0.0.1:8791'

node --test tests/hmh-reboot-enemy-role-detail.test.mjs
npm run check
npm run test:release
npm run build
npm run visual:reboot
npm run smoke:hmh:enemy-details
npm run smoke:hmh:performance
npm run certify:hmh:browser
node scripts/hmh-reboot-combat-browser-smoke.mjs
npm run smoke:hmh:cockpit
npm run smoke:portal:e2e
npm run smoke:hmh:mobile-controls
npm run audit:hmh:network
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run assets:qa:hmh-reboot
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
git diff --check
```

For enemy authored-art changes also run:

```bash
npm run assets:hmh:enemy-roster:verify
```

Restore only known generated audit drift before staging:

```bash
git restore -- \
  docs/security/hard-money-heroes-security-audit.json \
  docs/security/hard-money-heroes-security-audit.md \
  docs/cleanup/repo-cdn-cleanup-gate.json \
  docs/cleanup/repo-cdn-cleanup-gate.md
```

## Exact-index discipline

Stage only intended paths, then use the literal binary diff identity:

```bash
git diff --cached --check
git diff --cached --binary | sha256sum
test -z "$(git diff --name-only)"
```

Any staged edit, including a date or documentation correction, requires a fresh hash and fresh reviews. A completion notification, timeout, malformed reviewer command or hash of `git diff --cached` without `--binary` is not an exact review.

Review agents must be explicitly read-only. Recheck the index after every delegated review because a previous reviewer accidentally staged ignored dependencies.

## Pipeline and browser traps

1. Blender is pinned to `5.1.2`.
2. Enemy verify rebuilds all seven actors twice and can take several minutes. Do not audit the tree while it has temporarily removed outputs.
3. Do not run a second Blender job while the PID-aware pipeline lock is active.
4. Do not commit raw frames, `.blend1`, temporary contact montages, screenshots, caches or scratch scripts.
5. `hmh-reboot-enemy-detail-browser-smoke.mjs` and the release certifier intentionally execute the freshly built candidate bundle and map canonical asset URLs to tracked local files.
6. Those local asset routes reject traversal before resolving a filesystem path. Do not replace them with unrestricted URL-to-path joins.
7. Synthetic keyboard inputs must be held across fixed simulation ticks. Instant press/release can be missed.
8. A stale second listener on 8791 previously caused requests to alternate between old and current bundles. Verify port ownership before browser QA and kill only positively identified stale PIDs.
9. `HMH_REBOOT_ORIGIN` may point to production in the shell. Pin local browser certification explicitly.
10. Bundle headroom is about 28 KB. Treat growth as constrained.
11. Generated security/CDN reports must be restored unless their intentional content is part of the bounded slice.

## Authority invariants

Preserve all of these:

- PixiJS `8.19.0`.
- Fixed 60 Hz simulation.
- Maximum four catch-up steps.
- Deterministic 60/30/20 render partitions.
- Canonical collision, ground, damage, replay and save authority.
- Parent authority for wallets, profiles, official sessions, leaderboards, completion and settlement.
- Free Mode isolation from Ranked progression.
- Human survivor/zombie actor canon.
- Missing/corrupt art and audio remain nonfatal with safe fallbacks.
- Production and rollback remain untouched until exact approval.
- `SETTLEMENT_LIVE=false`.

## End-of-session handback

Every completed cycle should provide:

1. Local commit ID and exact commit patch hash.
2. Cycle ledger.
3. RED/GREEN evidence.
4. Deterministic authored-art metrics if assets changed.
5. Desktop/mobile visual findings.
6. Release, performance, security, network and repository gate results.
7. Exact-index reviewer verdicts.
8. Remote continuation-branch verification.
9. Explicit statement that production, Web3 and settlement were untouched.
10. One recommended next bounded slice plus the remaining backlog.
