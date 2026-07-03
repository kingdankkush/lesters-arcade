# Hard Money Heroes Fable Markdown Crosswalk

Generated: 2026-07-03

This report captures the ignored/local Fable markdown task files in a tracked repo artifact so the production branch has an honest source of truth for what was completed, what remains, and what is gated.

## Audited source files
- `.hermes/desktop-attachments/hmh-ship-v1-master-todo.md`
- `.hermes/desktop-attachments/hermes-wave2-core-loop-handoff.md`
- `.hermes/desktop-attachments/hermes-wave3-sprites-animation-handoff.md`
- `.hermes/desktop-attachments/hermes-repo-cleanup-guide.md`
- `OPEN_QUESTIONS.md`
- `docs/THIRD_PARTY_GAME_ONBOARDING.md`

## Completed in the shipped WO sweep

| Work order | Result | Evidence |
|---|---|---|
| WO-30 | copywriting pass and copy sheet | docs/game-design/hard-money-heroes-copy-sheet.md; npm run design:copy-sheet |
| WO-32 | combat feedback certification | docs/art/COMBAT_FEEDBACK_CERTIFICATION.md; npm run design:combat-feedback |
| WO-33 | boss balance pass | docs/game-design/hard-money-heroes-boss-balance.md; npm run design:boss-balance |
| WO-34 | structured playtest and bug sweep | docs/qa/hard-money-heroes-playtest-sweep.md; npm run design:playtest-sweep |
| WO-35 | avatar/profile persistence parity | docs/qa/hard-money-heroes-profile-parity.md; npm run design:profile-parity |
| WO-36 | load-speed optimization pass | docs/performance/hard-money-heroes-load-speed.md; npm run design:load-speed |
| WO-37 | device and input QA matrix | docs/qa/hard-money-heroes-device-input-qa.md; npm run design:device-input |
| WO-38 | Web3 wallet to settlement to leaderboard audit | docs/qa/hard-money-heroes-web3-settlement-audit.md; npm run design:web3-audit |
| WO-39 | security audit sweep | docs/security/hard-money-heroes-security-audit.md; npm run design:security-audit |
| WO-40 | upgrade menu presentation | tests/hmh-upgrade-menu-ui.test.mjs; upgrade-menu runtime markers |
| WO-41 | game audio and SFX system upgrade | docs/audio/hard-money-heroes-audio-system.md; npm run design:audio-system |

## Remaining implementable Fable waves

| Area | Priority | Status | What remains |
|---|---:|---|---|
| Wave 2 / EPIC 1: endless survival economy and difficulty loop | P0 | local-implementable-slices-shipped | XP curve targets Fable 60-80 level bands, 80-level draft depth is protected, post-cap XP converts into score, long-run telemetry reports cap/post-cap pressure, pure game-feel physics contracts are covered, and integrity now rejects over-cap levels plus impossible post-cap score claims. Remaining work is live playtest tuning and future backend replay re-simulation infrastructure. |
| Wave 3 / EPIC 2-3: sprite QA, hero/enemy matrices, metadata, telegraph decals | P0 | remaining-major-work | Requires PixelLab/contact-sheet production and Justin sign-off before new animation batches; current repo has coverage reports and QA tooling, not the full generated matrix. |
| EPIC 4-5: terrain autotiling, authored world chunks, water/bridges, elevation | P0 | remaining-major-work | Requires new terrain/elevation systems plus art integration; cannot be honestly completed as a small audit fix. |
| EPIC 6: lighting, shadows, VFX, retro presentation | P0/P1 | remaining-major-work | Requires rendering/performance work after core loop and art matrices are locked. |
| EPIC 7: replay verification, live leaderboards, remaining contracts, profile pages | P0/P1 | remaining-major-work | Depends on deterministic replay and explicit real-funds/contract approval. |
| EPIC 10.1: repo cleanup/history rewrite | P0 | approval-gated | History rewrite or fresh-repo reseed needs explicit destructive-operation approval even though repo-health guardrails exist. |

## Gated / not safe to finish without approval

| File | Decision | Gate |
|---|---|---|
| OPEN_QUESTIONS.md | LitVM RPC/token/faucet verification before contract deployment | external-verification |
| OPEN_QUESTIONS.md | real paid asset, refund policy, third-party revenue, brand/legal sign-off | Justin/legal/economy decision |
| docs/THIRD_PARTY_GAME_ONBOARDING.md | Chikun playable implementation | separate third-party cabinet scope |
| OPEN_QUESTIONS.md | role email vs existing ad Gmail | Justin decision; existing Gmail was intentionally set |

## Production conclusion

- WO-30 through WO-41 have tracked reports/tests or runtime markers.
- The ignored .hermes desktop-attachment task files are now summarized in this tracked crosswalk.
- Remaining Fable items are not small misses; they are future waves or approval-gated decisions.

