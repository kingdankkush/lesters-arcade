# Lester's Arcade

Retro Litecoin/Web3 arcade portal prototype for **LitVM**, centered on Lester's Arcade and its first playable cabinet, **Hard Money Heroes**.

This project intentionally starts as a local prototype: wallet/profile logic, arcade cabinet selection, free-vs-paid game mode, score eligibility, achievement unlocks, and contract architecture sketches. Nothing here deploys contracts, moves funds, posts externally, or connects to a real wallet without a later explicit approval step.

## Current MVP direction

- Main arcade portal: parent wallet account for profile, cross-game progress, achievements, transactions, high scores, and paid-session economics.
- Game selection: SVG arcade cabinet row plus SNES-style cartridge shelf for child dapp games.
- First playable cabinet: **Hard Money Heroes**, a 60fps-target Metal Slug-style crypto-satire side-scrolling shooter sandbox set in **Litecoin City After Dark**. Current loop includes jump/double-jump, parallax levels, mini-boss scroll locks, The Settler, The Block Breaker, The Hashstorm, Litecoin Blade melee, Crypto Bombs, Hard Forks, power-ups, attack-pattern enemies, 10 rotating bosses, sparks-first combat effects, optional pre-run gore, scoring, and difficulty scaling.
- Free mode is practice-only: no parent progress, achievements, high scores, payments, or transactions. Paid mode is simulated locally and is the only official leaderboard/achievement path.
- Smart contract MVP: modular Solidity skeleton for profiles, game registry, paid sessions, score submission, achievements, tournaments, and revenue routing.
- Target chain direction: LitVM / Litecoin EVM rollup using Arbitrum Nitro, Espresso shared sequencing, Succinct zkVM, and BitcoinOS Grail Bridge / zkLTC according to LitVM docs.
- Web3 tooling direction: dappit.io is a candidate for helping build/refine LitVM-aligned contract rails because of the LitVM partnership angle.
- Engine direction: current prototype is web Canvas; next gameplay layer should likely be Phaser/custom Canvas, with Godot HTML5 as an optional later path rather than the current build engine.

## Run locally

```bash
cd "C:/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade"
npm test
npm run check
npm run contracts:check
npm run contracts:compile
npm audit --audit-level=high
npm run serve
```

Then open:

```txt
http://127.0.0.1:8791/apps/portal/
```

## Vercel demo preview

A safe static Vercel preview can deploy the portal only, with no contracts, funds, secrets, or official paid-run writes.

```bash
npm run vercel:build
```

Then import the repo into Vercel with:

- Framework Preset: **Other**
- Root Directory: `.`
- Build Command: `npm run vercel:build`
- Output Directory: `apps/portal`

See [`docs/VERCEL-DEMO.md`](docs/VERCEL-DEMO.md) for the step-by-step demo checklist.

## Safety boundaries

- No real funds.
- No private keys or seed phrases.
- No contract deployment unless explicitly approved.
- No external posting or account changes.
- Paid mode is simulated locally until real LitVM testnet integration is explicitly approved.
- Commercial Litecoin-logo/name-heavy/Ł-heavy usage needs explicit written brand/legal sign-off before launch.
