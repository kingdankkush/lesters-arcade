# Lester's Arcade Smart Contract Architecture

## Overview

The Lester's Arcade smart contract system is designed for deployment on LitVM (Litecoin Virtual Machine) and implements a Web3-enabled arcade platform where players can:

- Register profiles linked to their wallet
- Play free or ranked modes across multiple arcade cabinets
- Submit scores with cryptographic attestations
- Earn on-chain achievements
- Compete in tournaments

## Core Contracts

### 1. PlayerProfileRegistry.sol

**Purpose**: Manages wallet-to-profile mappings for all players.

**Key Features**:
- One profile per wallet (1:1 mapping)
- Stores display name, avatar URL, and aggregate stats
- Emits `ProfileCreated` event when new players join
- Allows profile updates (name/avatar changes)

**Integration**: Used by GameRegistry to validate player eligibility for ranked modes.

### 2. GameRegistry.sol

**Purpose**: Central registry of all arcade cabinets (games) available on the platform.

**Key Features**:
- Operator-only registration (controlled by platform owner)
- Stores game metadata, wallet address, and revenue split configuration
- Revenue splits defined in basis points (bps): **dev/platform/liquidity/treasury**
- Default split: 60/20/10/10 (must total 10,000 bps)
- Tracks which cabinets are currently playable

**Integration**: SessionLedger queries GameRegistry to validate cabinet existence and retrieve revenue split for fee distribution.

### 3. SessionLedger.sol

**Purpose**: Tracks ranked (paid) game sessions on-chain and handles entry fee collection.

**Key Features**:
- `openSession()`: Collects entry fee (default 250,000 microUSDC = $0.25) from player
- Stores session state: cabinet, score, kills, survival time, timestamp
- `closeSession()`: Marks session complete
- `disburseSession()`: Distributes entry fee according to GameRegistry's revenue split
- Emits `SessionOpened` for leaderboard tracking

**Integration**: Calls PaymentRouter to split fees after session completion.

### 4. AchievementRegistry.sol

**Purpose**: Mints and tracks on-chain achievements earned by players.

**Key Features**:
- `unlockFor()`: Awards achievement to a specific wallet address
- `unlockAchievement()`: Generic unlock trigger
- Each achievement has metadata: name, description, rarity
- Achievements are non-transferable (soulbound tokens)
- Emits `AchievementUnlocked` event

**Integration**: Called by SessionLedger when players meet achievement criteria (e.g., "First Ranked Win", "Beat Boss #3").

### 5. PaymentRouter.sol

**Purpose**: Distributes collected fees to multiple recipients according to revenue splits.

**Key Features**:
- `splitAndDisburse()`: Takes total fee and splits based on basis points
- Queries GameRegistry for cabinet-specific splits
- Transfers tokens to: dev wallet, platform treasury, liquidity pool, community treasury
- Uses IERC20 interface for token transfers

**Integration**: Called by SessionLedger after ranked session completion.

### 6. interfaces/IERC20.sol

**Purpose**: Standard ERC20 token interface for USDC integration.

**Key Features**:
- `transfer()`, `transferFrom()`, `approve()`, `balanceOf()`
- Standard interface for LitVM-native USDC or any ERC20-compatible token

## Architecture Flow

### Free Mode (No Blockchain Interaction)

```
Player → Select Cabinet → Play Free Mode → High Score (local only)
```

No smart contract calls. Scores stored in browser localStorage.

### Ranked Mode (On-Chain)

```
1. Player connects wallet (MetaMask/LitVM Wallet)
2. PlayerProfileRegistry registers profile (if new)
3. Player selects cabinet and Ranked mode
4. SessionLedger.openSession() collects entry fee
5. Player plays game, generates cryptographic attestation
6. Cabinet server signs attestation with trustedVerifier key
7. SessionLedger.closeSession() validates signature, stores score
8. SessionLedger.disburseSession() → PaymentRouter.splitAndDisburse()
9. AchievementRegistry.unlockFor() awards any earned achievements
10. Leaderboard updates (off-chain indexer + on-chain events)
```

## Security Model

### Trusted Verifier Pattern

Each cabinet has a `trustedVerifier` key held by the cabinet's backend server. This key signs score attestations, preventing players from submitting fake scores.

### Operator Controls

- **GameRegistry**: Only platform operator can register new cabinets
- **AchievementRegistry**: Operator defines achievement metadata
- **PlayerProfileRegistry**: Players control their own profiles (no operator override)

### Session Fee Flow

```
Entry Fee ($0.25)
  ↓
SessionLedger (escrow)
  ↓
PaymentRouter.splitAndDisburse()
  ↓
├─ Dev Wallet (60%) → Cabinet developer
├─ Platform (20%) → Lester's Arcade operator
├─ Liquidity (10%) → DEX liquidity pool
└─ Treasury (10%) → Community DAO treasury
```

## Future Contracts (Not Yet Implemented)

### TournamentPool.sol
- Manages tournament creation and prize distribution
- Players pool entry fees, winner takes all (or split)
- Operator creates tournaments with specific cabinets and rules

### LestersArcadeCore.sol
- Facade contract that aggregates all other contracts
- Single entry point for frontend integrations
- Batch operations (e.g., open session + register profile in one tx)

### ScoreSubmissionRegistry.sol
- Advanced score validation with zero-knowledge proofs
- Prevents replay attacks on signed attestations
- Rate limiting to prevent spam submissions

## Testing

Run contract structure validation:

```bash
npm run contracts:check
```

This verifies:
- All required contracts exist
- All required functions/events are present
- Pragma version is ^0.8.24
- All contracts compile without errors

## Deployment Order

1. **IERC20 interface** (no deployment needed, just import)
2. **PlayerProfileRegistry** (no dependencies)
3. **GameRegistry** (no dependencies)
4. **AchievementRegistry** (depends on nothing, but called by SessionLedger)
5. **PaymentRouter** (depends on GameRegistry for splits)
6. **SessionLedger** (depends on GameRegistry, PaymentRouter, AchievementRegistry)

## LitVM Compatibility

These contracts are designed for LitVM, a Litecoin-based EVM. Key considerations:

- **Block time**: ~2.5 minutes (vs Ethereum's 12 seconds)
- **Gas costs**: Significantly lower than Ethereum mainnet
- **Token**: LTC-wrapped USDC (or native LitVM token)
- **Wallet**: MetaMask configured with LitVM RPC endpoint

## Revenue Model

The platform's sustainability comes from:

1. **Ranked mode entry fees**: $0.25 per session
2. **Platform share**: 20% of all fees
3. **Scale**: 1,000 ranked sessions/day = $50/day platform revenue

At 10,000 sessions/day: **$500/day = $15,000/month**

## Upgrade Strategy

Contracts use the **proxy pattern** for upgradeability:

- **Logic contracts**: Contain business logic, can be upgraded
- **Proxy contracts**: Hold state, delegate calls to logic
- **Admin key**: Platform operator can upgrade logic contracts

This allows bug fixes and feature additions without migrating state.
