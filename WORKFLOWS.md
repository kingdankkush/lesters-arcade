# Workflows

## Local verification

When to use: Before handoff after changing docs, JS, UI, or contract skeletons.

Steps:

```bash
cd "C:/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade"
npm test
npm run check
npm run contracts:check
npm run contracts:compile
npm audit --audit-level=high
```

Verification: All commands exit 0.

## Browser smoke test

When to use: After changing `apps/portal` UI or game logic.

Steps:

```bash
cd "C:/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade"
npm run serve
```

Open:

```txt
http://127.0.0.1:8791/apps/portal/
```

Smoke actions:

1. Click/connect mock wallet.
2. Select Hard Money Heroes cabinet.
3. Try free mode and verify practice-only state: no parent progress, achievements, high scores, payments, or transactions.
4. Try paid mode and verify global leaderboard/achievement state updates.
5. Check browser console for errors.

## LitVM readiness check

When to use: Before any real deployment or transaction wiring.

Steps:

1. Confirm current LitVM docs for RPC URL, chain ID, testnet status, faucet, bridge, and supported assets.
2. Confirm no private keys are stored in the repo.
3. Use testnet only.
4. Ask Justin before deploying or sending any transaction.

Verification: Deployment plan includes chain ID, RPC, contract list, token addresses, and rollback strategy.
