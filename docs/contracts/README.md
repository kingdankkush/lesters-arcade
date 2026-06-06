# Contract Notes

These contracts are MVP architecture skeletons, not production-audited contracts.

## Production gaps before real funds

- Add full unit tests with Foundry or Hardhat.
- Compile with local Solidity tooling.
- Use audited access-control and pausability patterns.
- Add verifier signature checks instead of verifier-only placeholders where appropriate.
- Confirm LitVM token addresses and RPC config.
- Run security review before deployment.

## Intended module boundaries

- `PlayerProfileRegistry`: identity/profile shell.
- `GameRegistry`: official cabinet records and developer/economy settings.
- `ArcadePaymentRouter`: paid sessions and revenue splits.
- `ScoreSubmissionRegistry`: official score records from trusted verifier.
- `AchievementRegistry`: achievement definitions and unlocks.
- `TournamentPool`: future competition windows and prize accounting.
- `LestersArcadeCore`: convenience composition wrapper.
