# Hard Money Heroes Cycle 021 Production Handoff for Claude Agent

Date: `2026-07-27`
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Branch: `reboot/hmh-aaa-continuous`
Audience: Claude Agent continuing Hard Money Heroes and Lester's Arcade work

## 1. Read this first

This handoff supersedes older HMH implementation priorities in:

- `docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md`
- `docs/handoffs/2026-07-25-hmh-art-pipeline-hermes-handoff.md`
- `docs/handoffs/hard-money-heroes-claude-opus-4-8-handoff.md`

Those files remain useful history, but their old isometric/procedural direction, Cycle 002 release state, and early art debt are not current authority.

Read in this order:

1. `AGENTS.md`
2. This handoff
3. `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md`
4. `docs/hmh-reboot/cycles/CYCLE-021.md`
5. `docs/hmh-reboot/RELEASE-CERTIFICATION-AAA-FINAL-CANDIDATE.md`
6. `docs/hmh-reboot/DEPLOYMENT-ROLLBACK-RUNBOOK-AAA-FINAL-CANDIDATE.md`
7. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`
8. `docs/hmh-reboot/COMPATIBILITY.json`

The final certificate and deployment runbook describe the pre-Cycle-021 candidate. Their safety rules remain valid, but their production status and rollback identities are stale. Updating them is a remaining documentation task.

## 2. Current repository truth

Verified on `2026-07-27`:

- Branch: `reboot/hmh-aaa-continuous`
- HEAD: `a81f1c8f830f3339ebb568de166c108e58f695d3`
- `origin/reboot/hmh-aaa-continuous`: same commit
- Working tree before this README/handoff update: clean
- HEAD subject: `feat(hmh): animate district landmark signals`
- Cycle 021 commit diff SHA-256: `7239e8c66ec7275bbf556c59de999fa8a7d35893aa0a6817aeffad7fa080daeb`
- PixiJS: `8.19.0`
- Simulation: fixed `60 Hz`, maximum four catch-up steps
- Render partitions: `60 / 30 / 20`
- `SETTLEMENT_LIVE=false`

Do not reset this branch to an older local cycle. Cycles 011-021 are already in its linear history.

## 3. Production truth

Cycle 021 is already public at `https://lestersarcade.io`.

### Current production

- Source commit: `a81f1c8f830f3339ebb568de166c108e58f695d3`
- GitHub deployment record: `5626423782`
- Immutable production URL: `https://lesters-arcade-gsbj7uxer-justin-agent-projects.vercel.app`
- Deployment status: `success`
- HMH bundle URL: `https://lestersarcade.io/dist/hmh-reboot/game.js`
- HMH bundle bytes: `1,012,139`
- HMH bundle SHA-256: `7e6938dbad83dd1b36d71cc2cdc03008f36b30213754b2fb36bc13d4643492da`
- HMH HTML bytes: `5,919`
- HMH HTML SHA-256: `4d388732081fd597ad4e7de7b0267ba3bd86f51ddf85bc14ea93b3503752c525`
- Service worker bytes: `3,508`
- Service worker SHA-256: `8146ed967e426c70d9dc439494168c85be32892720fec8e9794347a10d6b504a`
- Public cache policy observed: `public, max-age=0, must-revalidate`

### Cycle 021 preview

- GitHub deployment record: `5626388771`
- Immutable URL: `https://lesters-arcade-fgzvqbcjk-justin-agent-projects.vercel.app`
- Deployment status: `success`

### Immediate previous production

- Source commit: `9ff359eaf28b81a792a10a41b0d59db5f9ae5440`
- GitHub deployment record: `5619406683`
- Immutable URL: `https://lesters-arcade-g242ggtb8-justin-agent-projects.vercel.app`
- Deployment status: `success`

This is now the practical previous-production rollback candidate. The older `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9` record is no longer the immediately previous production.

The Vercel CLI is missing locally. Current and previous Vercel `dpl_...` IDs were not recoverable from GitHub deployment records. Resolve them through an authenticated Vercel CLI session or the dashboard before any future rollback/promotion operation.

## 4. What is finished

The original predeployment improvement program is complete in source and automation:

| Area | Completed by |
| --- | --- |
| Four animated production hero selectors | Cycle 013, `b50d5aac` |
| Authored district landmarks and world identity | Cycle 014, `c56ee2f6` |
| Nine deterministic collectible/power-up routes | Cycle 015, `0f44ee9e` |
| Health, ammo, weapon caches, grenades, nuke, speed, damage, HUD, audio, VFX | Cycle 015 |
| Grenade blast-radius warning/readability | Cycle 016, `6292cc57` |
| Responsive upgrade disclosures and tooltips | Cycle 017, `c07b6e8e` |
| Pause/settings/current-build/restart polish | Cycle 018, `3ab3ad71` |
| Isolated 30-minute desktop/mobile soaks | Cycle 019, `c98861a2` |
| Restart-race and deploy-build certification | Cycle 020, `8842077c` |
| District landmark signals and reduced motion | Cycle 021, `a81f1c8f` |

Cycle 021 automation reported:

- release ledger: `1,721 total / 1,669 passing / 52 accepted legacy / 0 unexpected`
- syntax: `332` JavaScript modules and `49` Python scripts
- deterministic visual regression: `8/8` unchanged
- desktop/mobile performance p95: `7 ms / 7 ms`
- security: `5/5`
- third-party sandbox: `3/3`
- settlement boundary: `9/9`
- strict repository health, CDN gate, and docs links: PASS
- Web3 live readiness: `PARTIAL 3/4`

## 5. Post-production verification completed

The following were rerun against `https://lestersarcade.io` after Cycle 021 appeared in production:

```bash
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run certify:hmh:browser
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run smoke:hmh:cockpit
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run smoke:hmh:collectibles
```

Results:

- desktop: PASS
- ultrawide: PASS
- tablet landscape: PASS
- mobile portrait: PASS
- mobile landscape: PASS
- cockpit desktop/tablet/mobile/short-landscape: PASS
- all nine collectible effects: PASS
- collectible reset and timed expiry: PASS
- browser/page errors: zero
- public bundle hash/bytes: exact Cycle 021 match

## 6. Remaining work, in priority order

### P0: Human production acceptance

Automation is complete, but physical-device acceptance is not recorded.

Desktop/controller checklist:

1. Start a Free run on `https://lestersarcade.io`.
2. Test keyboard/mouse movement, aim, fire, melee, dash, grenade, weapon switching, Pause, upgrades, and Restart.
3. Test a real controller, including reconnect and focus loss/recovery.
4. Evaluate music/SFX balance, Liquidator warnings, grenade radius, damage feedback, reduced motion, reduced flash, and screen shake.
5. Record PASS or concrete defects.

Real-phone checklist:

1. Test an actual iOS or Android phone, not emulation only.
2. Test portrait and landscape rotation.
3. Exercise both sticks and all eight touch controls.
4. Verify HUD, minimap, warnings, upgrade details, Pause, and Restart remain usable.
5. Evaluate touch ergonomics, audio balance, heat/thermal behavior, battery impact, reduced motion, and motion comfort.
6. Record model, browser, OS version, session length, and PASS/defects.

Do not change source merely to document a preference. Any runtime correction becomes Cycle 022 and requires the full release path.

### P0: Resolve deployment and rollback identities

1. Install/authenticate the official Vercel CLI or use the Vercel dashboard.
2. Record the current Cycle 021 production `dpl_...` ID.
3. Record the immediate previous `9ff359ea` production `dpl_...` ID.
4. Confirm whether the Hobby rollback UI can still target the immediate previous production.
5. Do not execute rollback, redeploy, promote, or alias changes unless explicitly approved.

### P1: Produce a post-production closeout certificate

Update or supersede:

- `docs/hmh-reboot/RELEASE-CERTIFICATION-AAA-FINAL-CANDIDATE.md`
- `docs/hmh-reboot/DEPLOYMENT-ROLLBACK-RUNBOOK-AAA-FINAL-CANDIDATE.md`

The closeout should include:

- Cycle 021 source and bundle identities
- GitHub production/preview deployment records and immutable URLs
- current and immediate previous Vercel `dpl_...` IDs once known
- public browser/cockpit/collectible results
- human desktop/controller/phone results
- public HTML, game bundle, and service-worker fingerprints
- current rollback procedure
- confirmation that settlement remains disabled

### P1: Production observation

Monitor, without changing source:

- service-worker update behavior
- stale-bundle reports
- console/network errors
- mobile heat and battery behavior
- audio balance
- controller reconnect/focus behavior
- gameplay readability during dense enemy pressure

If a concrete defect appears, reproduce it locally, write RED coverage, and open Cycle 022. Do not hot-patch production.

### P2: Repository governance

Current known limits:

- reboot branch and `main` are not protected
- no GitHub Actions workflows or CI runs exist
- release discipline is manual
- raw `npm test` still includes exactly 52 accepted superseded Canvas/isometric contracts; `npm run test:release` is the authority
- bundle headroom is only `37,861` bytes under the `1,050,000` gate

Recommended non-runtime work:

1. Add branch protection.
2. Add CI that runs the same authoritative release gates without changing accepted-failure classification.
3. Prevent direct production deployment from unreviewed commits.
4. Keep generated assets and browser evidence out of ordinary commits unless explicitly required.

### P2: Hardened Web3 remains blocked

Do not claim live verified Web3 publication. Required future work remains:

1. explicit HALT approval for any contract/testnet/mainnet action
2. hardened contract deployment and verification
3. trusted replay/evidence attestation outside the browser
4. real-wallet run and readback into profile/session/verified leaderboards
5. duplicate, replay, expiry, wrong-chain, user-cancel, and RPC-failure proofs
6. separate economy/legal/security decisions before paid settlement

No wallet, signature, transaction, LitVM, contract, or settlement action is part of routine HMH polish.

### P3: Product expansion after stabilization

Only after P0/P1 closeout:

- decide whether Cycle 022 is bug-fix only or new content
- consider additional authored acts/districts/bosses without weakening Level One
- preserve human-survivor/zombie actor canon
- preserve projection-only art/audio/VFX authority
- decide whether Chikun's development harness should become a production public vertical slice

## 7. Cycle 022 entry criteria

Do not begin runtime work just because the roadmap has open ideas. Require a concrete accepted scope.

For any Cycle 022 source change:

1. Confirm branch and clean tree.
2. Reproduce the defect or define one bounded vertical slice.
3. Write RED behavioral coverage.
4. Make the smallest deterministic correction.
5. Run the actual browser route.
6. Review desktop, mobile portrait, and mobile landscape evidence.
7. Run release, visual, security, performance, repository, CDN, and documentation gates.
8. Freeze with literal `git diff --cached --binary | sha256sum`.
9. Obtain exact-index review for that literal hash.
10. Commit locally.
11. Request explicit push/preview approval if remote work is needed.
12. Verify immutable preview and complete human acceptance.
13. Request separate production approval.

A source edit invalidates the current deployment candidate identity. A timeout, hash mismatch, empty review, classifier-only output, or missing concrete verdict is not PASS.

## 8. Commands Claude should run first

Read-only discovery:

```bash
git branch --show-current
git status --short --branch
git rev-parse HEAD
git rev-parse origin/reboot/hmh-aaa-continuous
git log -12 --oneline --decorate
```

Authoritative local checks:

```bash
npm run check
npm run test:release
npm run build
npm run visual:reboot
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run audit:hmh:network
npm run certify:hmh:browser
npm run smoke:hmh:cockpit
npm run smoke:hmh:collectibles
npm run smoke:hmh:performance
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
```

Production read-only verification:

```bash
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run certify:hmh:browser
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run smoke:hmh:cockpit
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run smoke:hmh:collectibles
```

Serve locally from `apps/portal`, not `apps/portal/dist`:

```bash
cd apps/portal
python -m http.server 8791 --bind 127.0.0.1
```

## 9. Hard stop boundaries

Claude must stop and request explicit approval before:

- pushing an ordinary runtime change
- creating or promoting a deployment
- changing the production alias
- executing rollback
- rewriting Git history
- migrating CDN assets
- changing `SETTLEMENT_LIVE`
- requesting a wallet or signature
- sending a transaction
- deploying or interacting with LitVM contracts
- changing settlement or revenue split authority

The current public build is healthy by automated verification. Preserve it until a concrete defect or approved Cycle 022 scope exists.
