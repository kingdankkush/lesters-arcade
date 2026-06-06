# Context

## Domain Language

- **Lester's Arcade**: Main portal/hub for wallet profiles, arcade cabinets, leaderboards, achievements, and payments.
- **Arcade cabinet / machine**: A game integrated into the arcade ecosystem.
- **Free mode**: Practice-only play that does not update parent progress, achievements, high scores, payments, or transactions.
- **Paid mode**: Official arcade run with fixed rules, entry fee, leaderboard eligibility, achievements, and possible tournament eligibility.
- **Hard Money Heroes**: First playable cabinet game; goofy/gritty Metal Slug-style Web3 satire set in Litecoin City After Dark.
- **Lester / Lilly**: Lester is the main playable hero; Lilly is a future alternate/unlockable with the same moveset/hitbox/stats and different art.
- **LitVM**: Litecoin EVM rollup target for smart contracts.
- **zkLTC**: LitVM native gas token described in LitVM docs, minted via BitcoinOS Grail Bridge when LTC is locked on Litecoin L1.

## Important Concepts

- The chain should not run full twitch gameplay.
- Contracts should record identity, games, paid sessions, official scores, achievements, tournaments, and revenue splits.
- The first anti-cheat version can use a trusted verifier signature before more advanced replay/proof systems.
- Third-party games should integrate through an SDK/API later.

## System Map

```txt
Player Wallet
  -> Lester's Arcade Portal
    -> Player Profile Registry
    -> Game Registry
    -> Payment Router
    -> Arcade Cabinet Game
      -> local/off-chain gameplay
      -> score verifier
      -> Score Submission Registry
      -> Achievement Registry
      -> Tournament Pool
```

## Data Sources

- LitVM docs and official blog for chain architecture.
- Local game state for prototype.
- Future backend/indexer for scores, replays, profiles, and game metadata.

## Naming Conventions

- Filesystem path avoids apostrophe: `Lesters-Arcade`.
- User-facing brand keeps apostrophe: `Lester's Arcade`.
- First playable cabinet title: `Hard Money Heroes`.
- Legacy/placeholder title retained only where file/API compatibility still uses it: `Lester Blaster`.
