# LitVM Smart Contract Foundation for Lester's Arcade

## Core Philosophy
- Wallet is the single source of truth (parent identity).
- Games are pluggable modules.
- Revenue, achievements, and ranked history are on-chain.
- Free play = local sandbox only (no on-chain writes).
- Paid/ranked play = creates a Session and writes results.

## Core Contracts (Modular & Upgradeable)

### 1. PlayerProfileRegistry
- Maps wallet → { displayName, avatar, totalStats, achievements[] }
- Functions: `setDisplayName`, `setAvatar`, `recordStat`, `grantAchievement`

### 2. GameRegistry
- Maps gameId → { name, devWallet, feeSplit, adapterContract, status }
- Functions: `registerGame`, `updateGame`, `setStatus`

### 3. SessionLedger
- Creates a `Session` struct on paid entry:
  ```solidity
  struct Session {
    address player;
    bytes32 gameId;
    uint256 entryFee;
    uint256 startTime;
    uint256 finalScore;
    uint256 kills;
    uint256 survivalTime;
    bool settled;
  }
  ```
- Functions: `createSession`, `submitRun` (with signature), `settleSession`

### 4. AchievementRegistry
- Milestone tracking + NFT minting on achievement unlock.

### 5. PaymentRouter
- Splits entry fees according to GameRegistry.feeSplit on settlement.

## Anti-Cheat & Security
- Score submission requires EIP-712 signature from the game client.
- Session can only be settled once.
- Dev wallets can be updated by governance.

## Revenue Flow (on every ranked session)
- Entry fee split:
  - Dev: 50-70%
  - Platform: 15-20%
  - Liquidity / Treasury: remainder

## Integration with Frontend
- `settlement.mjs` already has the client-side plan.
- Future: `submitRun` will call the SessionLedger contract.

This foundation allows Hard Money Heroes (and future games like Chikun) to plug in cleanly while keeping the parent wallet/profile system as the single source of truth across the entire Lester's Arcade ecosystem.
