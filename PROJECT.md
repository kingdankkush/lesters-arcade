# Lester's Arcade

## Purpose

Build a retro Litecoin-themed Web3 arcade portal where EVM-wallet players enter arcade cabinets that are synced dapp games. Free play is casual/untracked; paid play unlocks official leaderboards, achievements, tournaments, and revenue splits for infrastructure and game developers.

## Primary Users

- Litecoin community members and LitVM early adopters.
- Retro arcade / pixel art gaming fans.
- Web3 users with MetaMask, Rabby, or similar EVM wallets.
- Future third-party game developers who may build arcade cabinets.

## Current Goals

1. Create a strong master concept and technical architecture.
2. Build a local Lester's Arcade parent-account portal prototype.
3. Add arcade cabinet graphics and SNES-style cartridge selection.
4. Add the first **Hard Money Heroes** Metal Slug-style combat sandbox.
5. Create modular Solidity MVP contract skeletons.
6. Verify everything locally without real funds or deployment.

## Important Links

- LitVM architecture docs: https://docs.litvm.com/overview/architecture
- LitVM core partners: https://docs.litvm.com/integrations/partners
- LitVM intro: https://www.litvm.com/blog/introducing-litvm-litecoins-zk-omnichain

## Setup / Run

```bash
npm test
npm run check
npm run contracts:check
npm run contracts:compile
npm audit --audit-level=high
npm run serve
```

Open `http://127.0.0.1:8791/apps/portal/`.

## Verification Commands

- `npm test`
- `npm run check`
- `npm run contracts:check`
- `npm run contracts:compile`
- `npm audit --audit-level=high`
- Browser smoke test through local server.

## Owner Notes

Justin wants Lester's Arcade to feel like an 80s/90s arcade with pixel art, NES/SNES/Neo Geo flavor, arcade machines, pinball, cabinets, and subtle Litecoin/LitVM energy. The main portal is the parent account system; each game is a child cabinet/cartridge dapp. **Hard Money Heroes** is the first playable cabinet: a goofy/gritty Metal Slug-style Web3 satire shooter set in **Litecoin City After Dark**, where average runs last ~5 minutes, veteran/master runs last 15–20 minutes, bosses appear every 3–5 minutes from a 10-boss roster, free play is practice-only, and paid play is official leaderboard/achievement state.
