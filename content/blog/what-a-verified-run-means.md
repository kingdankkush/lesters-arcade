---
{
  "slug": "what-a-verified-run-means",
  "title": "What a verified run means at Lester’s Arcade",
  "summary": "From a game result to a checked leaderboard entry: the roles of the game, server and testnet.",
  "category": "dev-notes",
  "games": [],
  "date": "2026-09-30",
  "status": "published",
  "author": "Lester’s Arcade"
}
---
## A result begins in the game

The game knows when your run ends and can show its result immediately. Ranked adds another step: the arcade server checks the submitted run before the result is published.

That distinction matters. A number on a local results screen is not, by itself, a verified leaderboard entry. Free Mode remains separate from Ranked and does not publish an official score to the chain.

## Different games need different checks

Chikun’s Escape and STACKED record inputs that the server can replay. Replaying the run lets the server compare the resulting state and score with the submission.

Hard Money Heroes uses plausibility checks on its run evidence. It does not use the same exact-input replay verification as the other two games. Describing all three systems as identical would hide a meaningful difference.

## The browser does not approve itself

For a valid Ranked run, the server produces the trusted verification and the relayer publishes the result. The browser does not hold the server’s verification secret or authorize its own score submission.

The leaderboard and profile then reflect the indexed result. If a result is still being checked or published, follow the status shown by the arcade rather than repeatedly submitting the same run.

## Why visual settings stay separate

A brighter effect, a different costume or a calmer screen should change what you see, not the outcome of a run. Cosmetic settings therefore belong to presentation. They must not change collision, damage, input evidence or a server-earned achievement.

That also helps explain why older runs matter during an update. New art can arrive without rewriting what an earlier game version recorded. Changes to gameplay rules require deliberate compatibility work.

## This is a testnet

Ranked currently runs on LitVM LiteForge. Testnet zkLTC has no monetary value, and testnet activity should not be described as mainnet settlement or a real-money prize.

For the current entry steps, supported flow and troubleshooting, use [How Ranked works](/how-ranked-works). To learn a cabinet without a wallet, [start a Free run](/games).
