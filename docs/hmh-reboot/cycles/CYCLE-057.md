# HMH AAA Continuous Improvement Cycle 057

Date: `2026-08-17`
Status: `DOCUMENTATION TRUTH RECONCILED · NO RUNTIME CHANGE · PRODUCTION/WEB3 UNCHANGED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `64fae5ce`

## Bounded slice

Reconcile `README.md` and `AGENTS.md` with deployed reality. Both documents made claims that were false against the shipped source, and one of them actively instructed agents to preserve a gate that production had already passed. No runtime, asset, routing, service-worker, or test change.

## Drift found

### 1. README production header was two weeks stale

It declared production source `a81f1c8f830f3339ebb568de166c108e58f695d3` (Cycle 021) and an immutable deployment URL that is no longer aliased, and pointed the "current continuation handoff" at the Cycle 028 document.

Measured on 2026-08-17:

```text
curl https://lestersarcade.io/sw.js   -> lesters-arcade-v18-hmh-mobile-character-start
npx vercel inspect https://lestersarcade.io
  id      dpl_Hm2bB5eEgnr6VvacT9xWU7SxVRJr
  target  production
  status  Ready
  url     https://lesters-arcade-r60lkwo2p-justin-agent-projects.vercel.app
  created Sun Aug 16 2026 21:52:25 GMT-0700
```

Deployed source is `5d4db8ee` on `hotfix/hmh-mobile-character-start`, branched from `e3679552` — not the tip of `reboot/hmh-aaa-continuous`. The header now records that, and states that continuation work after `e3679552` is not deployed.

### 2. Chikun's Escape was documented as Coming Soon after it shipped

`54aab311` (2026-08-11) launched the cabinet and is an ancestor of both `e3679552` and the deployed hotfix. Deployed source at `e3679552`:

```js
{ id: 'chikun', status: 'playable', playable: true,
  devPlayable: true, leaderboardEligible: true }
{ id: 'chikun', status: 'playable', publicPlayable: true,
  developer: 'Louie / LitVM Port Team' }
```

The route gate at `arcade-core.mjs:5057` is `status === 'playable' && publicPlayable !== false`, so Chikun resolves to a real `/play/chikun` route rather than the `null` that renders a locked roadmap card. `tests/arcade-core.test.mjs:889` already asserts that route.

`README.md` still said "Coming Soon, dev harness only" and "Chikun remains `playable: false`". `AGENTS.md` said "Do not make it public playable without full production and browser certification" — an instruction inverted against shipped state, and the most likely of the three to misdirect a future session.

### 3. Canonical file list was incomplete

The README listed six Chikun paths. The launch added seven more (`apps/chikun/src/main.mjs`, `apps/portal/chikun/`, `chikun-host.mjs`, `chikun-bridge.mjs`, `chikun-bridge-protocol.mjs`, `chikun-portal-lifecycle.mjs`, `assets/generated/chikun-game/`). All thirteen paths were confirmed to exist before listing.

## What was deliberately not claimed

Chikun is not described as finished. What shipped is the `0.5.0` vertical slice, not the creator's full original game. Both documents now state that these remain open:

- written commercial-use, modification, hosting, and redistribution rights for the creator's art are pending (`docs/THIRD_PARTY_GAME_ONBOARDING.md`);
- `devWallet` is `null` in `game-registry.mjs` and `game.manifest.json`, so third-party revenue routing is unwired;
- the registry split is a skeleton and `entryFeeMicroUsdc` resolves to `DEFAULT_ENTRY_FEE_MICRO_USDC = 0` (`arcade-core.mjs:69`), so no paid entry is live.

The vaulted React/Supabase source remains out of the tree and must not be restored.

## Verification

- `npm run check`: **PASS**, `344` JavaScript modules + `49` Python scripts.
- `npm run docs:links`: **PASS**, 8 current/public documents.
- `npm run repo:health:strict`: **PASS**, SHIP repo budget passed.
- `node --test tests/agents-policy.test.mjs`: **PASS** 2/2 — this test asserts `AGENTS.md` content and was run because `AGENTS.md` changed.
- `npm run test:release`: **PASS**, `2,213` evaluated = `2,162` passed + `51` exact expected legacy failures.

Runtime gates were not re-run because no runtime, asset, routing, CSP, service-worker, or release-harness file changed. The certification of `a676e29b` recorded in Cycle 054 and the hardened endurance probe in Cycle 056 remain the current runtime evidence.

## Boundaries

- No runtime source change. No test behavior change.
- `SETTLEMENT_LIVE=false` unchanged.
- No push, no promote, no deployment. Production remains `dpl_Hm2bB5eEgnr6VvacT9xWU7SxVRJr` / `lesters-arcade-v18-hmh-mobile-character-start`.
- Production facts written into `README.md` are timestamped and marked for reconciliation; they will go stale again and should be re-measured, not trusted, in a later session.
