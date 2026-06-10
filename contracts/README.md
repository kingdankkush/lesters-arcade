# Lester's Arcade Smart Contract Architecture

This directory contains the Solidity contracts that power the LitVM-integrated backend for Lester's Arcade. These contracts handle player identity, game registry, ranked session tracking, achievement minting, and payment splitting.

## Contracts Overview

### Core Identity & Registry

- **`PlayerProfileRegistry.sol`** — Master identity registry mapping wallet addresses to display names, avatars, and player stats. One wallet → one profile.

- **`GameRegistry.sol`** — Cabinet registry for approved games. Platform operator approves cabinets that integrate the submitRun adapter. Stores per-game fee splits (dev/platform/liquidity/treasury bps).

### Session & Scoring

- **`SessionLedger.sol`** — Tracks ranked paid-run sessions on LitVM. Players pay entry fee at session open, fee held in escrow until session close. Uses EIP-712 signatures from cabinet adapters to verify score commits.

### Achievements & Rewards

- **`AchievementRegistry.sol`** — Cross-game achievement tracking. Parent arcade defines milestones (first boss kill, 100 games played, etc.), cabinets call `submitGameRun()` which triggers `unlockFor()`. Each achievement mints a soulbound NFT.

### Payment & Settlement

- **`PaymentRouter.sol`** — Splits entry fee payments according to per-game fee splits. Reads splits from GameRegistry, distributes to dev/platform/liquidity/treasury vaults.

### Interfaces

- **`interfaces/IERC20.sol`** — Standard ERC20 interface for entry token (USDC on LitVM).

## Architecture Flow

```
Player connects wallet
    ↓
PlayerProfileRegistry.registerProfile(wallet, name, avatar)
    ↓
Player selects cabinet (Hard Money Heroes)
    ↓
GameRegistry.getGame(gameId) → validates cabinet is approved + playable
    ↓
SessionLedger.openSession(gameId, entryFee) → pulls USDC from player, holds in escrow
    ↓
Player plays game in browser (off-chain)
    ↓
Game over → cabinet adapter signs session summary with EIP-712
    ↓
SessionLedger.closeSession(sessionId, score, kills, survivalSeconds, signature)
    → recovers signer, validates signature matches game's registered adapter
    → emits SessionClosed(score, kills, survivalSeconds)
    ↓
AchievementRegistry.unlockFor() called for any milestones reached
    ↓
SessionLedger.settleSession() → transfers entry fee to PaymentRouter
    ↓
PaymentRouter.splitAndRoute() → reads fee split from GameRegistry
    → routes to dev/platform/liquidity/treasury vaults
    ↓
Session marked as settled on-chain
```

## Fee Split Model

Each game registers a fee split in basis points (bps, out of 10,000):

| Share         | BPS  | %   | Recipient                          |
|---------------|------|-----|------------------------------------|
| **dev**       | 6000 | 60% | Game developer wallet              |
| **platform**  | 2000 | 20% | Lester's Arcade operator           |
| **liquidity** | 1000 | 10% | Liquidity pool (DEX/staking)       |
| **treasury**  | 1000 | 10% | Community treasury (DAO governance)|

**Total: 10,000 bps (100%)**

Splits are enforced on-chain by `PaymentRouter.splitAndRoute()`. The router reads the game's split from `GameRegistry.getGame(gameId)` at settlement time, so splits can be updated without touching PaymentRouter logic.

## Gas Reserve Model

The platform's 20% share acts as a **gas bank**: it funds future on-chain writes for profile updates, achievement unlocks, and session settlements. This makes the system self-sustaining without requiring separate gas funding from the operator.

## Security Considerations

- **EIP-712 signatures** — SessionLedger requires cabinet adapters to sign score commits. The signer must match `GameRegistry.getGame(gameId).devWallet` (currently a TODO in the skeleton).
- **Operator access control** — GameRegistry and AchievementRegistry restrict administrative functions (register game, define achievement) to a single operator address. Production should upgrade to role-based access (OpenZeppelin AccessControl).
- **Reentrancy guard** — PaymentRouter should add `ReentrancyGuard` before production deployment to prevent reentrancy attacks during token transfers.
- **Token whitelist** — Entry token is hardcoded to USDC on LitVM. Multi-token support would require a more flexible design.

## Deployment Sequence

1. Deploy `PlayerProfileRegistry`
2. Deploy `GameRegistry`
3. Deploy `AchievementRegistry` (requires SessionLedger address)
4. Deploy `SessionLedger` (requires GameRegistry + AchievementRegistry addresses)
5. Deploy `PaymentRouter` (requires GameRegistry + SessionLedger addresses)
6. Configure vault addresses in `PaymentRouter.setDefaultVaults()`
7. Register initial cabinets in `GameRegistry.registerCabinet()`
8. Define initial achievements in `AchievementRegistry`

## Integration with Frontend

The frontend uses `ethers.js` or `viem` to interact with these contracts:

```javascript
import { ethers } from 'ethers';

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// PlayerProfileRegistry
const profileRegistry = new ethers.Contract(
  '0x...', // PlayerProfileRegistry address
  PlayerProfileRegistryABI,
  signer
);

await profileRegistry.registerProfile('lester', 'https://ipfs.io/avatar.png');

// SessionLedger
const sessionLedger = new ethers.Contract(
  '0x...', // SessionLedger address
  SessionLedgerABI,
  signer
);

await sessionLedger.openSession(gameId, entryFee, { value: entryFee });
```

## Testing

Run the contract structure check:

```bash
npm run check:contracts
```

This validates that all contracts are present and have the expected exported symbols (functions like `registerProfile`, `openSession`, etc.).

## Future Extensions

- **ERC1155 achievement NFTs** — Current AchievementRegistry mints ERC721-like tokens. ERC1155 would allow batching for gas efficiency.
- **Tournament contracts** — Separate contract for tournament prize pools, bracket management, and winner payouts.
- **DAO governance** — Treasury vault could be a DAO contract with voting on split updates and platform parameters.
- **Multi-chain bridges** — Bridge achievement NFTs and player stats to Ethereum mainnet or other L2s for broader visibility.

## Contact

For questions about integrating with these contracts or deploying to LitVM testnet, contact the Lester's Arcade core team.
