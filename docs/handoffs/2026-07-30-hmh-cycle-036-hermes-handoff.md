# Hard Money Heroes — Cycle 036 Hermes handoff

Date: 2026-07-30 PDT
Continuation branch: `reboot/hmh-aaa-continuous`
Cycle 036 source: `15629ebac9e1004f2b41760aedd3e67cc406f5c3`
Cycle 036 exact commit patch SHA-256: `5fa3e71570a20d1ca5b4166df06c041e244e9a7315645ae74f797752686847d6`
Production source: `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`
Production: <https://lestersarcade.io>
Settlement: `SETTLEMENT_LIVE=false`

## Certified continuation state

Cycle 036 closes the first deterministic combat-readability slice after the ordinary-enemy art wave.

The touch-only runtime now exposes all retained weapons through a visible `SWAP` control. The compact HUD names the selected weapon, shows `rounds/capacity`, and reports deterministic `RELOAD`, `COOLING`, `SWITCH`, or `EMPTY` state. Browser evidence exercises the real touch control, observes a shotgun reload, and verifies fixed-tick status telemetry.

The implementation is committed locally only. No push, preview, promotion, deployment, production, wallet, contract, or settlement action occurred.

## What changed

### Five-control mobile ownership

- `MOVE` and `AIM` remain independent sticks.
- `SWAP` is mirrored above `MOVE` and emits the existing `weaponNext` action.
- `POWER` remains above `AIM`.
- Pause remains centered between the sticks.
- Safe insets, viewport containment, pairwise overlap, and landscape minimap clearance remain certified.
- Production-hero, mobile-control, combat, and release-browser scripts now fail closed on anything other than the five-control set.

### Weapon-state readability

`getWeaponReadabilityStatus()` provides a frozen projection-only snapshot from authoritative fixed-tick weapon state:

- weapon ID and display name;
- rounds and magazine capacity;
- ready/reloading/overheated/switching/empty mode;
- remaining ticks and one-decimal seconds;
- compact HUD and accessible labels.

The helper does not mutate state or advance simulation. The runtime exposes clip size, mode, reload flag, and remaining reload ticks as deterministic browser evidence.

### Visual correction during certification

The first portrait debug capture placed the expanded status line under cockpit score chrome. The final packet reflowed the narrow debug HUD and shifted it down only for that multiline evidence mode. Full-resolution portrait, phone-landscape, and reload-state captures are readable, contained, and non-overlapping.

## TDD and gates

- Initial RED: seven focused failures.
- Focused final: `71/71`.
- Release: `1,799 total / 1,747 passing / 52 accepted legacy / 0 unexpected`.
- Visual regression: `8/8` unchanged.
- Release browser certification: five profiles.
- Mobile-control certification: four device profiles.
- Combat browser smoke: touch SWAP plus deterministic shotgun reload PASS.
- Desktop/mobile performance: `7 ms` p95 each.
- Built child bundle: `1,023,218 / 1,050,000` bytes.
- Check, build, asset QA, security, third-party, Web3, strict repository health, CDN, and docs links: PASS.

## Review authority and tooling trap

The authoritative implementation digest is:

`5fa3e71570a20d1ca5b4166df06c041e244e9a7315645ae74f797752686847d6`

A native Ollama `qwen3.5-4b-64k` reviewer was smoke-tested with `think: false`, received the complete canonical staged binary diff, and returned exact matching PASS verdicts for:

- deterministic gameplay/input and architecture;
- security, authority, compatibility, and release scope.

Hermes native vision inspected the actual final full-resolution portrait, landscape, and mobile reload frames and found no blocker.

Do **not** use `deleg_8558907c` as approval. That hosted batch violated its read-only contract, attempted Git-object lookups for a diff digest, and created untracked `0001-feat-hmh-upgrade-close-range-enemy-role-art.patch` and `docs/hmh-reboot/cycles/CYCLE-036.md` scratch artifacts. Both were removed before the final digest guard; the canonical digest was unchanged. Always inspect untracked files after delegated review.

## Authority boundary

Cycle 036 changes child-owned input availability and projection only. It does not change:

- fixed-step cadence or replay/save formats;
- weapon balance, projectile physics, damage, collision, hurtboxes, combat ordering, AI, spawning, progression, or RNG;
- parent bridge, wallet, persistence, leaderboard, Ranked, achievement, or settlement authority;
- routing, CSP, service worker, production source, or deployment state.

## Next bounded work — Cycle 037

Build a committed deterministic weapon-role benchmark before tuning balance:

1. exercise each retained weapon at declared close, mid, and long engagement distances;
2. record same-seed hit rate, time-to-kill, rounds, reloads, heat/overheat, and projectile pressure against representative ordinary and armored enemies;
3. define explicit role envelopes and fail closed on non-finite or nondeterministic output;
4. select only the first measured outlier for RED/GREEN correction;
5. rerun desktop, touch, controller, performance, replay, security, and visual gates after any actual tuning.

Do not tune weapon damage from subjective feel alone. Do not change settlement, production, or deployment authority.

## Required commands

```bash
npm run check
npm run test:release
npm run build
npm run visual:reboot
npm run certify:hmh:browser
npm run smoke:hmh:mobile-controls
npm run smoke:hmh:performance
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
```

Serve locally from `apps/portal` at `http://127.0.0.1:8791/`; stop the server after evidence capture.
