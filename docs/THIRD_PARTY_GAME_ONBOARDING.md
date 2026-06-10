# Lester's Arcade — Third-Party Game Onboarding Guide

This document is the contract between the parent arcade portal and any third-party developer onboarding a game (e.g. Chikun, a LitVM port).

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Portal Shell (always eager, ~220 KB + CSS)     │
│  ┌────────────────────────────────────────────┐ │
│  │ Wallet, profile, achievements, leaderboards│ │
│  │ Cabinet grid UI, game-registry.mjs         │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                     │ user clicks a cabinet
                     ▼ (lazy import() — per-game loader.mjs)
┌─────────────────────────────────────────────────┐
│  games/<game-id>/loader.mjs                     │
│  • exports `load<Game>Game()`                   │
│  • dynamically imports the game's manifests     │
│  • returns { manifest, entryPoint, adapter }    │
└─────────────────────────────────────────────────┘
```

## Onboarding checklist for a new game

### 1. Create a loader module

Path: `apps/portal/src/games/<your-game-id>/loader.mjs`

See `apps/portal/src/games/chikun/loader.mjs` for a worked example.

Your loader must export a single async function named `load<X>Game()`. Keep the dynamic imports inside the function so they don't bloat the parent shell.

### 2. Register the game

In the portal's `ARCADE_GAMES` constant (`apps/portal/src/arcade-core.mjs`), add an entry:

```js
{
  id: '<your-game-id>',
  title: '<Your Game Title>',
  cabinet: 'RUN-N-GUN CABINET NN',
  genre: '<one-line genre description>',
  status: 'playable' | 'coming-soon' | 'locked',
  developer: '<your dev team name>',
  entryFeeMicroUsdc: 250_000, // default $0.25
  livesPaid: 3,
  livesFree: 3,
  tagline: '<one-line player-facing tagline>',
  systemRole: 'child-dapp-cartridge',
  parentSystem: "Lester's Arcade",
}
```

### 3. Wire the loader into the cabinet click handler

In `apps/portal/main.js`, inside the cabinet-selection `click` listener, add:

```js
if (cabinet.id === '<your-game-id>') {
  card.classList.add('is-loading');
  try {
    const chikun = await loadChikunGame();
    CHIKUN_PAYLOAD = chikun;
  } finally {
    card.classList.remove('is-loading');
  }
}
```

### 4. Implement the adapter contract

Your loader must return an object with:

- `manifest`: the static data your game needs (asset URLs, config)
- `entryPoint`: a function the parent calls to start the game
- `adapter.normalizeStats(raw)`: maps your game's native stats object to the shared ranked-run shape:

```js
{
  score: Number,
  kills: Number | undefined,
  coinsCollected: Number | undefined,
  survivalTime: Number, // seconds
  achievements: String[],
}
```

If your game is very different from a combat game (e.g. a flappy bird clone), drop `kills` — the shared model handles missing fields.

### 5. Submit runs through the registry

On game over, call:

```js
import { submitGameRun } from '../../../src/game-registry.mjs';
await submitGameRun('<your-game-id>', adapter.normalizeStats(myRun), playerWallet);
```

This routes through the parent's shared session ledger. In the on-chain phase this will sign an EIP-712 packet and commit to LitVM's `SessionLedger.sol`.

## What you DO NOT need to implement

The parent portal owns:
- Wallet connection + chain guard
- Display name / avatar / profile persistence
- Leaderboard rankings across cadences (daily, weekly, monthly, yearly, all-time)
- Achievement unlocks (parent-defined)
- Revenue split calculation and on-chain settlement routing
- Arcade music + ambient sound mixing
- Cabinet art rotation and UI chrome

Focus on: gameplay, art pipeline (Pixellab-friendly), and the stats adapter.

## Currently onboarded cabinets

| Game ID | Developer | Status |
|---|---|---|
| `hard-money-heroes` | Lester's Arcade Core | Live |
| `chikun` | LitVM port | Stub loaded, assets pending |

## LitVM Contract Phase (future)

When the smart contracts go live:
- `submitGameRun` → signs EIP-712 hash of run summary → commits to `SessionLedger.sol`
- Revenue split executed by `PaymentRouter.sol` based on game's registered `feeSplit`
- `AchievementRegistry.sol` mints NFTs for parent-defined milestones
- `PlayerProfileRegistry.sol` on-chain identity for cross-game stats
