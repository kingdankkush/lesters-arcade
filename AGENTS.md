# Lester's Arcade Agent Notes

## Project identity

Lester's Arcade is a retro Litecoin-themed Web3 arcade portal on LitVM. The portal uses EVM wallets for identity, arcade cabinets as integrated dapp games, and a free-vs-paid mode split where paid play is eligible for global leaderboards, achievements, tournaments, and developer revenue splits.

## Operating rules

- Keep secrets out of files and prompts. Never ask for seed phrases or private keys.
- Do not deploy contracts, bridge funds, send transactions, post externally, or change accounts without explicit user approval.
- Prefer local prototypes and testnet-only planning until approval.
- Preserve the retro 80s/90s arcade aesthetic: CRT glow, pixel art, cabinet UI, neon, coin-slot language, NES/SNES/Neo Geo inspiration.
- Use LitVM docs as the source of truth for chain details; if docs and guesses conflict, docs win.

## Current Hard Money Heroes gameplay pivot

As of 2026-06-07, Hard Money Heroes is pivoting from a 2D side-scrolling run-and-gun into an **isometric run-and-gun roguelike / roguelite survival game**. Agents should treat `docs/game-design/hard-money-heroes-isometric-roguelike-pivot.md` as the active design handoff for this pivot.

Art agents should use **Pixellab API** and other approved design tools to produce the missing isometric assets: isometric tilesets/chunks, 8-way hero/enemy/boss animation coverage, roguelike upgrade UI/icons, and combat VFX. Existing 2D buildings/trees/garbage cans/props can be reused only where they still read correctly from the isometric camera; accepted assets must be repo-local and manifest-ready before runtime integration.

## Verification

Run before handoff:

```bash
npm test
npm run check
npm run contracts:check
```

For UI changes, also serve locally and check browser console at:

```txt
http://127.0.0.1:8791/apps/portal/
```
