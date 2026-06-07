# Hard Money Heroes / Lester's Arcade — Claude Opus 4.8 Follow-up Review Packet

Generated: 2026-06-07T20:40:57Z
Prepared by: Hermes Agent
Recipient: Claude Opus 4.8
Context source: Claude's `Hard_Money_Heroes_Design_Bible_v2.pdf`, now normalized into `docs/game-design/hard-money-heroes-design-bible-v2.md` and applied as active project canon.

## 0. Purpose of this follow-up

Claude, your v2 Design Bible has now been accepted as the active design authority for the game direction. This follow-up asks you to stress-test that spec before Hermes turns it into more runtime implementation.

Please respond as a practical build critic, not just a designer. Focus on:

1. Improvements and missing design clarifications.
2. Bug-testing strategy.
3. Exploit/failure points in gameplay, scoring, wallet identity, and ranked submission.
4. UI/UX/user-flow improvements for Lester's Arcade and cabinet selection.
5. EVM/LitVM testnet interoperability and setup robustness.
6. A prioritized implementation plan that reduces risk and avoids rebuilding the old side-scroller by accident.

## 1. Current accepted direction after your v2 Bible

- Parent portal: Lester's Arcade.
- First cabinet: Hard Money Heroes.
- Stable internal game ID remains `lester-blaster` for persisted state compatibility.
- Active genre/display genre: `isometric-run-and-gun-roguelike`.
- Core run: 20-minute isometric roguelite survival, ending in Mainnet Express extraction, with optional Overtime.
- Free practice: local/practice only; writes nothing official.
- Ranked/paid: same mechanics/RNG as free, but wallet-bound, explicit submit, verifier-backed, official leaderboard eligible.
- Main hero: Lester.
- Lilly: future unlockable alt hero/skin in HMH, not a separate active cabinet yet.
- Controls: WASD movement, mouse aim, hold fire, dash/dodge, throwable, reload, pause, level-up reroll.
- Run loop: procedural chunks, enemies spawn outside camera-safe radius, XP gems, paused two-card draft + one reroll, boss arena rings, extraction at 20:00.
- Balance target: ~4-6 minute median survival after 3 runs, ~30 level-up picks by 20 minutes, ~60 visible enemies max, attack-token cap of 2-5.
- Anti-cheat target: fixed timestep, seeded RNG, input log, periodic checksums, final summary, server re-sim, verifier-signed score.

## 2. LitVM / EVM compatibility baseline to preserve

Project constants and LitVM docs currently align on:

| Field | Value |
| --- | --- |
| Network | LitVM LiteForge public testnet |
| Chain ID | `4441` decimal / `0x1159` hex |
| Native gas | `zkLTC`, 18 decimals |
| RPC | `https://liteforge.rpc.caldera.xyz/http` |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Repo hub/faucet URL | `https://liteforge.hub.caldera.xyz` |
| Portal | `https://testnet.litvm.com` |
| EVM target from docs | Shanghai-compatible EVM |

Wallet rail expectations:

- EIP-1193 injected wallet first: MetaMask/Rabby/EVM-compatible.
- Normalize decimal and hex chain IDs.
- Implement `wallet_switchEthereumChain` for `0x1159`.
- Implement `wallet_addEthereumChain` fallback with chain name, RPC, explorer, native currency.
- Mock wallet stays QA fallback only; never eligible for live/real official funds.
- Never request seed phrases or private keys.
- Real funds, deployments, recurring automation, public launch, and commercial Litecoin branding remain explicitly gated.

## 3. Questions for you: remaining design improvements

Please answer with concrete tables and acceptance criteria.

### 3.1 Game loop and feel

1. Does the 20-minute extraction target create enough replay desire, or should the first vertical slice prove only a 6:30 Act I clear first?
2. Should Overtime preserve the same score formula with multiplier, or should it have separate leaderboard categories to avoid making extraction-run scores irrelevant?
3. What is the exact minimum fun vertical slice: how many enemy archetypes, skills, power-ups, and biome chunks must exist before playtesting is worthwhile?
4. Is dash mandatory in P0, or can it be behind the first skill unlock? Your v2 says MVP-in; please validate risks.
5. Should auto-aim/auto-fire be purely accessibility, or should mobile default to hybrid aim?
6. What should a failed 2-minute learner run teach? What specific feedback should appear after death?
7. Should bosses stop XP/level-up drops during arena rings to avoid modal interruptions during boss phases?
8. Should players be able to level up inside boss fights, and if yes, should the boss pause too?

### 3.2 Enemy, spawn, and anti-farming

1. Give exact spawn weights by act and minute for each enemy archetype.
2. Define the attack-token algorithm: which attacks consume tokens, when tokens release, and which boss/add attacks bypass the cap.
3. Define AFK/corner-farming detection that cannot punish legitimate kiting.
4. Define enemy de-spawn/reposition rules so enemies do not visibly pop or exploit pathing.
5. Which enemies are dangerous to ship first because they require complex pathing, hooks, or formations?
6. Which enemy behaviors are likely to break in isometric collision/occlusion?
7. Should elite modifiers stack on any enemy, or should some combinations be banned (e.g., Swift + Volatile, Shielded + Summoner)?
8. Should elite visual tags be color-coded, icon-coded, or both for colorblind accessibility?

### 3.3 Skills and builds

1. Provide the first 12 P0 skills with exact rank values, rarity, tags, icon concepts, and tests.
2. Define the first 3 evolved upgrades that should be implemented earliest.
3. What draw-weight algorithm avoids dead drafts while still creating build identity?
4. Should level-up choices be deterministic from seed + RNG cursor, or can UI reroll create separate RNG streams?
5. Which skills create exploit risk: infinite invulnerability, pickup magnet farming, revive loops, reroll banking, score multipliers?
6. How should assists or accessibility toggles affect leaderboard transparency, if at all?

### 3.4 Bosses

1. Which boss should be P0: Warren mini-boss only, Rug Pull Baron, or both?
2. What is the smallest arena-ring implementation that proves the boss system without overbuilding?
3. Define exact boss add budgets, phase HP thresholds, damage values, telegraph durations, and rewards.
4. Which boss mechanics should be delayed until projectile/collision/occlusion are stable?
5. Should perfect boss clear be no damage from boss only, no damage from any source, or no HP loss including shields?

### 3.5 Scoring

1. Validate the v2 score formula against top-player incentives. What degenerate strategy still wins?
2. Should `biomeIndex * 1500` be awarded once, incrementally, or only on successful seam/boss clear?
3. How should score handle Overtime so 22-minute runs do not erase all 20-minute skill expression?
4. Define exact anti-farm diminishing returns by enemy type and minute.
5. Should score packets include assist flags, build hash, version, and RNG seed in the leaderboard row?
6. Should there be separate boards for Free Practice local, Ranked Assist-On, Ranked Assist-Off, Overtime, and Daily Seed?

## 4. Questions for you: Lester's Arcade UI / UX and cabinet user flow

Please critique the entire player journey, not only Hard Money Heroes gameplay.

### 4.1 Desired public flow

Current desired flow:

1. Player lands on Lester's Arcade.
2. Wallet splash explains connect wallet / play free / mock QA fallback.
3. Profile activation creates wallet-bound parent arcade account.
4. Cabinet select shows playable and future cabinets.
5. Player chooses Hard Money Heroes.
6. Cabinet splash / intro explains game premise and Free vs Ranked.
7. Player chooses Free Practice or Ranked / Insert Credit.
8. Chain guard checks wallet/provider/network if ranked.
9. Run starts.
10. Pause/menu offers Resume, Settings, Restart, Game Menu, Exit to Arcade.
11. Game-over/win shows score breakdown.
12. Ranked run offers explicit Submit Official Score.
13. Result sync updates profile, achievements, leaderboard, receipts.
14. Player returns to cabinet, leaderboard, profile, or arcade floor.

Questions:

1. Is wallet connect too early? Should Free Practice be playable before wallet connection while still encouraging profile creation?
2. What exactly should a guest see on cabinet select before connecting?
3. How should future cabinets be displayed without confusing users into thinking they are broken?
4. Should Hard Money Heroes show a game detail screen before mode select: controls, average run length, risk-free Free, ranked requirements?
5. What is the clearest copy for `Free Practice`, `Ranked Testnet`, and `Official Submit`?
6. Should wallet chain guard appear before the run, at game over, or both?
7. How should wrong-chain users recover without leaving the app?
8. What should happen if the player exits to arcade during a ranked run before death/win?
9. Should the profile settings page be available from every screen?
10. What user-flow analytics events should be recorded locally/testnet for debugging onboarding friction?

### 4.2 UI failure points

Please produce a risk matrix for:

- Player does not understand Free vs Ranked.
- Player thinks mock wallet means real official status.
- Player cannot find cabinet select after connecting.
- Player clicks future cabinet and sees no useful explanation.
- Player starts ranked on wrong chain.
- Player disconnects wallet mid-run.
- Player exits fullscreen and input focus breaks.
- Level-up modal appears while mouse is captured or mobile buttons are active.
- Game-over submit fails and user does not know whether score was recorded.
- Profile handle/avatar validation fails.
- Leaderboard mixes practice and official rows visually.
- Mobile layout obscures HUD or buttons.
- Accessibility toggles are hidden or unclear.
- Gore toggle state is unclear or changes mid-run.

## 5. Questions for you: bug testing, exploits, and failure modes

Please provide a P0/P1 test plan that covers these categories.

### 5.1 Gameplay exploit/failure checklist

- AFK/corner farming.
- Spawn camping near chunk seams.
- Enemy spawn inside collision/hazards/walls.
- Pickup drops inside collision or under large props.
- Projectile tunneling through walls or missing due to high speed.
- Dash i-frames chaining into invulnerability.
- Revive loops or revive triggering multiple times.
- Reroll bank duplication by closing/reopening modal.
- Level-up modal not pausing projectiles/enemy attacks.
- Timer continuing during pause/modal/fullscreen exit.
- Boss arena ring trapping player in collision.
- Boss adds violating threat budget.
- Overtime scaling overflow or score inflation.
- FPS drops changing deterministic simulation results.
- Device-pixel-ratio / resize causing aim coordinate errors.
- Mobile touch controls firing while menus are open.
- Audio resume/play state desync after browser tab suspension.

### 5.2 Web3 / wallet / ranked exploit checklist

- Free run accidentally writes official state.
- Mock wallet accepted as real ranked wallet.
- Wrong chain submit accepted.
- Decimal/hex chain ID mismatch.
- Fake injected provider or malicious provider response.
- Address normalization/case mismatch creates duplicate profiles.
- Handle collision or profanity bypass.
- Avatar upload XSS, oversized file, tracking pixel, or unsupported format.
- Duplicate `sessionId` double-submit.
- Score submit replayed across wallet, chain, build, gameId, or season.
- Input log tampered after run.
- Checksum interval too sparse to catch state edits.
- RNG seed chosen/manipulated by player for favorable drops.
- Client clock/time manipulation.
- Ranked run abandoned after payment/credit reservation.
- Network request succeeds but UI stays in submit-failed state, or vice versa.
- Testnet receipt recorded without verifier signature.
- Contract/event schema changes break old profiles.
- Chain reorg or testnet RPC outage during submit.

### 5.3 LitVM/EVM setup tests

Please specify tests for:

- No provider installed.
- Provider installed but locked.
- Provider installed, wrong chain.
- Provider installed, correct chain.
- `wallet_switchEthereumChain` success.
- `wallet_switchEthereumChain` user rejects.
- `wallet_switchEthereumChain` unknown chain -> `wallet_addEthereumChain` success.
- Add-chain rejection.
- RPC unavailable.
- Explorer link generation.
- Faucet/hub link generation.
- zkLTC gas balance absent/zero.
- Testnet-only copy visible.
- Real-funds disabled / no mainnet transaction path.

## 6. Requested Claude output format

Please answer in this structure:

1. **Executive build-risk summary** — top 10 risks before coding the v2 migration.
2. **Design refinements** — concrete changes to v2, not general advice.
3. **P0 vertical-slice spec** — exact enemy/skill/boss/UI minimums.
4. **UX flow critique** — cabinet selection, wallet/profile, Free vs Ranked, game-over submit.
5. **Exploit/failure matrix** — severity, likelihood, detection test, mitigation.
6. **LitVM/EVM interoperability checklist** — wallet calls, chain params, sign/submit flow, test cases.
7. **Implementation backlog** — P0/P1/P2 with acceptance criteria and suggested tests.
8. **Open questions for Justin** — only the decisions that truly need owner approval.

## 7. Non-negotiable constraints

- Do not recommend real funds, deployments, public launch, recurring automation, or commercial Litecoin branding as executable steps without explicit Justin approval.
- Do not change persisted IDs casually: `gameId`, achievement IDs, leaderboard keys, profile schema keys.
- Do not make ranked mode pay-to-win or different-RNG.
- Do not co-mingle practice and official scores.
- Do not ask for seed phrases/private keys.
- Do not make future cabinets look broken; label them clearly as roadmap/coming-soon.
- Keep Command Center/public materials neutral and avoid irrelevant personal handles/labels.

## 8. Starting implementation assumption for Hermes

Unless you find a fatal flaw, Hermes will proceed after your next critique by updating docs/tests first, then migrating runtime in small verified slices:

1. Active genre/display-genre constants and legacy side-scroll deprecation shims.
2. Free/ranked write-boundary tests.
3. Controls contract tests.
4. XP curve/draft/reroll tests.
5. Threat-budget spawn-director tests.
6. Score formula golden tests.
7. LitVM chain-guard/wallet matrix tests.
8. UI flow smoke: wallet/profile -> cabinet select -> HMH -> Free/Ranked -> run -> pause -> game over -> submit/exit.
