# Lester's Arcade — Login UX and Parent Account System

## Core principle

The wallet login is not just an authentication button. It creates the **parent arcade account** that every Lester's Arcade cabinet/game dapp reads from and writes back to.

The parent account owns:

- EVM wallet identity
- player handle/avatar/rank/XP
- per-game progress
- free/casual score history
- paid/official high scores
- achievements/badges
- paid session transactions
- game/cabinet permissions
- future tournaments and community incentives

## UX flow

1. **Wallet login**
   - User enters the arcade portal.
   - They connect an EVM wallet: MetaMask, Rabby, or similar.
   - In the current prototype this is a mock wallet only.

2. **Parent account activation**
   - The wallet becomes the player's Lester's Arcade account.
   - A profile shell is created with handle, rank, XP, achievements, and progress records for each game.

3. **Game/cabinet selection**
   - The arcade floor shows cabinet art.
   - The cartridge shelf shows SNES-style cartridges.
   - Each cartridge represents a child dapp game that syncs with the parent system.

4. **Free vs paid run**
   - Free mode: local/casual score, no official leaderboard, no transaction.
   - Paid mode: simulated $0.25 credit, official score eligibility, transaction record, progress sync, achievement unlocks.

5. **Parent sync**
   - Each game writes back to the parent account:
     - best paid score
     - best free score
     - longest run
     - bosses defeated
     - transactions
     - achievements
     - leaderboard rank

## Current prototype surfaces

- Header login terminal
- Four-step integration flow
- Player Command Center panel
- Cabinet Row with SVG arcade cabinet graphics
- SNES cartridge shelf
- Free/paid session controls
- Parent progress, achievement, transaction, and high-score panels

## Implementation files

- `apps/portal/index.html`
- `apps/portal/styles.css`
- `apps/portal/main.js`
- `apps/portal/src/arcade-core.mjs`
- `apps/portal/assets/*.svg`

## Production notes

Before connecting real wallets/funds:

- Replace mock wallet login with a wallet connector.
- Require signed terms / score-eligibility consent for paid leaderboard runs.
- Store off-chain profile state in a backend indexed by wallet.
- Store official paid sessions and verifier-signed score claims in contracts.
- Add anti-cheat and deterministic replay validation before real prizes.
