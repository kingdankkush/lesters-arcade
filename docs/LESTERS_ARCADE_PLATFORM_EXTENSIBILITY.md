# Lester's Arcade - Platform Extensibility & Third-Party Game Onboarding

## Goal
Make it trivial for Justin (or third-party developers like a LitVM friend with "Chikun" flappy bird) to add new games into the Lester's Arcade ecosystem while sharing:
- Wallet login & parent profile
- Ranked sessions (score, kills, survival time, etc.)
- Display Name, Avatar, Achievements
- Revenue splits

## Architecture

### 1. Game Registry (Frontend + Contract)
Every game registers once:
```js
{
  id: 'chikun-flappy',
  name: 'Chikun',
  devWallet: '0x...',
  feeSplit: { dev: 60, platform: 20, liquidity: 10, treasury: 10 },
  adapter: 'chikun-adapter.mjs',
  status: 'live'
}
```

### 2. Shared Parent Profile
All games read/write to the same `PlayerProfile` (stored under wallet address):
- displayName
- avatar
- totalStats (across all games)
- achievements[]
- rankedHistory[]

### 3. Standard Game Interface (Adapter Pattern)
Third-party developers only implement this small adapter:

```js
// chikun-adapter.mjs
export async function init(gameId, wallet) {
  // Setup their game with the connected wallet
}

export async function submitRun(stats) {
  // stats = { score, kills, survivalTime, achievements, metadata }
  // Platform handles signature, settlement, achievement unlocking
  return await recordGameSession(gameId, stats);
}

export function getProfile(wallet) {
  return getSharedProfile(wallet);
}
```

### 4. Onboarding Flow for New Game
1. Developer provides adapter + registers game (frontend form).
2. Game appears automatically in the cartridge shelf.
3. Player connects wallet once → all games use the same identity.
4. Ranked play, achievements, and revenue all flow through the parent system.

This design keeps Hard Money Heroes as the first game while making the platform a true multi-game arcade.

## Files to Create/Modify
- `src/game-registry.mjs`
- `src/player-profile-adapter.mjs`
- Update `arcade-router.mjs` to support dynamic game loading
- Smart contract: `GameRegistry.sol` + `PlayerProfileRegistry.sol`
