# Hard Money Heroes — Build-Risk Review v2.1

Status: **active implementation-risk and QA addendum** for Hard Money Heroes and Lester's Arcade.
Source: `C:/Users/just_/Downloads/Hard_Money_Heroes_Build_Risk_Review_v2.1.pdf`, extracted locally with `pdftotext -layout` and normalized into Markdown.
Author pass: Claude Opus 4.8, responding to Hermes follow-up packet from 2026-06-07.
Applied by: Hermes Agent on 2026-06-07.

## Authority

- `hard-money-heroes-design-bible-v2.md` remains the accepted **content/design canon**.
- This v2.1 review is the accepted **implementation, sequencing, UX, QA, exploit, and LitVM/EVM risk addendum**.
- When v2 and v2.1 conflict on build sequencing, UX gating, boards, tests, or exploit mitigation, follow v2.1.
- Stable persisted keys remain unchanged: `gameId="lester-blaster"`, leaderboard keys, achievement IDs, profile schema keys, score receipt/session IDs.
- Owner-gated actions remain gated: real funds, deployments, recurring automation, public launch, commercial Litecoin/LTC branding, contract transactions, and brand/legal sign-off.

## Executive build-risk summary — top 10

| # | Risk | Why dangerous | Defuse |
| ---: | --- | --- | --- |
| 1 | P0 determinism debt | Anti-cheat, daily seed boards, reroll integrity, and server re-sim cannot be cleanly retrofitted. | Build fixed-timestep deterministic core, single seeded RNG stream, input log, and periodic checksums first. |
| 2 | P0 accidental side-scroller revival | Old side-scroller code still compiles and can mislead future agents. | Land genre-guard, controls-contract, and legacy-deprecation tests before feature work. |
| 3 | P0 Free/official write leak | One free-mode official write corrupts leaderboard/profile trust. | Make official writes a single guarded function and test Free writes zero official state. |
| 4 | P0 screen-space combat math | Iso depth makes screen-distance aiming, melee, and knockback silently wrong. | Mandate world-space combat math; convert only for rendering. |
| 5 | P1 draft/reroll UI RNG | UI `Math.random` breaks determinism and enables modal reopen exploits. | Draft and reroll consume the sim RNG cursor and are recorded in the input log. |
| 6 | P1 knockback/teleport into collision | Dash, hooks, pincer teleports, or boss rings can trap the player in walls/hazards. | Clamp forced displacement to valid nav cells; ring spawn must nudge out of invalid cells. |
| 7 | P1 modal/focus/timer bugs | Level-up modals, fullscreen exit, pointer lock, mobile buttons, and pause can break fairness. | Centralize `timeScale=0` pause gate that owns input, timer, audio, projectiles, and modal focus. |
| 8 | P0 wrong-chain/mock submit pollution | Mock or wrong-chain runs reaching official boards destroys trust. | Gate ranked pre-run and at-submit; mock is QA-only and never official. |
| 9 | P1 double-submit/replay | Score packets can be replayed across wallet/game/build/season/seed if under-bound. | Idempotent `sessionId`; bind wallet + gameId + season + buildHash + seed + verifier signature. |
| 10 | P1 scope creep | Full 3 acts/10 bosses before Act I is fun wastes effort. | Prove a fun 6:30 Act I Rug Pull Baron clear before building full game breadth. |

## v2.1 design refinements

### Game loop and feel

- **Prove Act I first.** Slice success metric: a fresh tester reaches and beats the Rug Pull Baron around 6:30 and immediately wants another run with a different build.
- **Separate Overtime board.** Main Extraction board snapshots and locks score at 20:00. Overtime continues on a separate Endless board so 22-minute grinders do not erase clean extraction runs.
- **Minimum-fun slice:** 6 enemy archetypes, 12 skills, 1 reachable evolution, 4 power-ups, 1 biome with 6-8 chunk templates, dash, 2 weapons + blade + 1 throwable, 1 mini-boss, 1 full boss.
- **Dash is P0.** It is the core defensive verb. Recommended baseline: 250 ms i-frames, 900 ms cooldown; enforce `iFrameWindow < dashCooldown` and cap skill uptime below 100%.
- **Assists:** desktop auto-aim/auto-fire are accessibility toggles off by default. Mobile defaults to hybrid auto-aim-nearest with manual override and auto-fire on. Record assist flags on every run.
- **Death feedback:** game-over should show what killed the player, one counter tip, build cards so far, time survived vs median, big Retry/new seed, and smaller Retry Seed.
- **Boss level-ups:** XP still accrues during boss arenas, but level-up modals are deferred/batched until a safe window such as phase transition or boss death. If shown, the boss pauses too.

### Enemy spawn, threat budget, and anti-farming

Relative spawn weights by act. The director normalizes weights and gates elites by the elite-share curve.

| Archetype | Role | Act I 0:00-6:30 | Act II 6:30-13:30 | Act III 13:30-20:00 |
| --- | --- | ---: | ---: | ---: |
| FUD Goblin | swarm | 28 | 8 | 6 |
| Trench Degen | chaser | 22 | 0 | 8 |
| Paper Hands | panic-melee | 18 | 10 | 6 |
| Rug Rat | disruptor | 12 | 8 | 4 |
| Gas Fee Wisp | flyer-taxer | 10 | 6 | 3 |
| Honeypot Turret | trap | 6 foundry | 7 | 5 |
| Evil Banker | cover-shooter | 4 | 7 | 0 |
| Gas Beast | tank | 0 | 6 | 7 |
| Crypto Bro | KOL shooter | 0 | 0 | 10 |
| Shill Bot | ranged drone | 0 | 18 | 8 |
| Bot Swarm | formation flyer | 0 | 14 | 7 |
| Phishing Angler | zoning hook | 0 | 10 | 8 |
| Slippage Skater | rusher | 0 | 10 | 7 |
| MEV Reaper | elite flanker | 0 | 6 penthouse / elite-pool | elite-pool |
| Liquidation Golem | elite tank | 0 | 0 | 10 |
| Rugpull Summoner | elite summoner | elite foundry | 6 / elite-pool | elite-pool |
| Orange-Pilled Zealot | elite beam | 0 | elite-pool | elite-pool |

#### Attack-token algorithm

Tokens gate committed offense, not enemy presence. Bosses and boss adds use a separate boss budget.

```text
attackTokens = attackTokenCap(t) // 2 at 0:00 -> 5 at 20:00

tryBeginAttack(enemy):
  if enemy.kind == BOSS or enemy.isBossAdd:
    return useBossBudget(enemy)
  if attackTokens.free == 0: return false
  if !inRange(enemy) or !cooldownReady(enemy) or !hasLineOfSight(enemy): return false
  attackTokens.acquire(enemy)
  enemy.enter(TELEGRAPH) // minTelegraphFrames >= 24
  return true

release token on: recovery end, stagger, knockback, or death.
consumers: melee swings, ranged shots/bursts, charge/dash strikes, hook-reel.
non-consumers: Gas Beast slow field, Summoner aura, Burning Trail wake, Honeypot passive lure.
```

Acceptance: in a simulated 20-minute run, `count(enemies in TELEGRAPH|ACTIVE) <= attackTokenCap(t)` every tick; boss adds never draw from global pool; ambient effects never block grunt attacks.

#### AFK / corner-farm detection

Detect spatial coverage, not idle time, and respond with XP/score taper rather than gameplay punishment.

```text
coverage = areaOfBoundingHull(playerPositions_30s) / tileArea
killSpread = distinctSpawnLanesCredited_30s
if coverage < 6 tiles AND income_30s > threshold AND killSpread < 2:
  farmFactor = clamp(0.35..1.0)
else:
  farmFactor = 1.0
```

Kiting should sweep more than 6 tiles and pull from many spawn lanes, so it stays at `farmFactor = 1.0`.

#### Despawn and reposition

- Never despawn or teleport an on-camera enemy.
- Recycle only outside `cameraSafeR`.
- Non-combat stragglers past `despawnR = 2x cameraSafeR` are silently recycled to fresh off-camera spawn lanes.
- Stuck detection: no path progress for more than 2s. Off-camera: blink to valid lane. On-camera: nudge + recompute path; never blink in view.
- Spawn lanes should form a ring around the camera with per-lane cooldowns.

#### P0 enemy ship order

Ship first: FUD Goblin, Trench Degen, Paper Hands, Rug Rat, Evil Banker, Gas Beast.

Delay to P1: Phishing Angler, Bot Swarm, MEV Reaper, Honeypot Turret disguise state, Liquidation Golem, Orange-Pilled Zealot.

Iso-fragile behaviors to fix proactively:

1. Melee/aim uses world-space distance, not screen distance.
2. Tall props need occlusion fade so player can aim behind them while collision resolves in world-space.
3. Flyer `zHeight` excluded from ground collision but included in depth-sort.
4. Knockback/hook/pincer teleport clamps to valid nav cells.
5. Hook reel stops at hazard edge instead of dragging player through hazards.

#### Elite stacking

Allow up to two elite modifiers after 12:00, but ban unreadable/unkillable combos.

| Combo | Status |
| --- | --- |
| Swift + Volatile | BAN — unreadable fast bomb. |
| Shielded + Summoner | BAN — unkillable add factory. |
| Splitter + Volatile | BAN — chain-explosion cascade. |
| Swift + Summoner | BAN — runaway adds. |
| Volatile + Projectile Fan | Caution / down-weight. |
| Summoner + Burning Trail | Caution / down-weight. |

Elite tags must be colorblind-safe: unique icon + aura outline pattern + color. Never rely on color alone.

### First 12 P0 skills

| Skill | Category/tag | Rarity | Rank 1-5 values | Icon concept |
| --- | --- | --- | --- | --- |
| Damage Alpha | offense | common | +5/10/15/20/25% weapon damage | up arrow over coin |
| Rate of Fire | offense | common | +5/10/15/20/25% fire rate | triple muzzle ticks |
| Street Runner | mobility | common | +5/10/15/20/25% move speed | sneaker speed lines |
| Diamond Hands HP | defense | common | +6/12/18/24/30% max HP | diamond heart |
| Magnet Wallet | utility | common | +12/24/36/48/60% pickup radius, hard radius cap | wallet magnet |
| Frag Yield | throwable | common | +8/16/24/32/40% grenade damage | cracked coin-bomb |
| Cold Wallet Armor | defense | uncommon | +4/8/12/16/20% DR, global DR cap 75% | steel ledger plate |
| Crit Candle | offense / crit | uncommon | +5/9/13/17/22% crit chance, cap 60% | green candlestick spark |
| Mempool Tar | control | uncommon | -6/11/16/21/26% enemy speed on hit | dripping tar node |
| Dash Settlement | mobility | uncommon | -6/12/18/24/30% dash cooldown, uptime under 100% | dashing chevrons |
| Multi-Sig Burst | offense / AoE | rare | +6/12/18/24/30% multishot chance | forked tracer |
| Chain Lightning | status / chain | rare | arc to 1/1/2/2/3 targets, +5% damage/rank | blue arc bolt |

Tests per skill: exact rank delta, maxed skill excluded from drafts, caps enforced, deterministic values from rank only.

### First three evolutions

| Evolution | Prerequisite | Effect |
| --- | --- | --- |
| Lightning Ledger | Chain Lightning R5 + Multi-Sig Burst R3 | Every shot arcs to 3 targets; arcs apply brief Mempool Tar slow. |
| Diamond Protocol | Diamond Hands HP R5 + Cold Wallet Armor R3 | Below 30% HP, heavy regen + extra DR as a comeback tool. |
| Tar Pit | Mempool Tar R5 + Frag Yield R3 | Throwables leave a slowing tar field. |

Draft algorithm: exclude maxed skills, force ready evolutions into slot 1, guarantee at least one meaningfully progressable card, draw two distinct cards via seeded sim RNG. Reroll consumes the same sim RNG cursor and records `{tick, rerollPressed}` in input log.

Exploit clamps:

- I-Frame Ledger P1: invulnerability duration + buffer must be less than cooldown; cap total uptime under 60%.
- Magnet Wallet: hard radius cap; combine with anti-farm XP/score taper.
- Revive P1: max revives/run; atomic consume; no nested revive during revive i-frames.
- Reroll Bank P1: bank is sim state; modal is pure view.
- Score multipliers: cap per source and total multiplier.
- Regen + Diamond Protocol: pressure escalation + farm taper should make turtling worse than progression.

Boards and assists: default competitive board is Ranked Assist-Off; inclusive Ranked Assist-On exists separately. Combined views must show assist badges per row.

### Bosses

P0 ships Warren first, then Rug Pull Baron if capacity allows. If only one boss can ship to first-runnable, ship Warren.

Smallest arena ring:

1. Boss trigger freezes chunk streaming.
2. Draw circular collision boundary at current player position.
3. Suppress ambient spawns to boss add budget.
4. Spawn boss with HP bar, phase thresholds, telegraph/attack/recover states.
5. Dissolve ring and resume streaming on death.

Delay until projectile/collision/occlusion are stable: floor-drop, moving arena, homing orbs, bullet-hell, illusions/decoys, rotating Sybil shield.

Perfect boss clear: zero health damage taken during the boss arena. Shield/i-frame negation is allowed.

| Boss | Phase plan | Add budget | P0 attacks | Hit/contact damage | Reward |
| --- | --- | ---: | --- | --- | --- |
| Warren the Spear Rider, ~3:30 | P1 100-50%, P2 <50% | 0 | line charge tell 36f, spear sweep; P2 cross-charge + 3-fan spear throw tell 30f | 18 charge / 10 spear | ~900 score + uncommon draft + bronze mini-boss achievement hook |
| The Rug Pull Baron, ~6:30 | P1 100-66%, P2 66-33%, P3 <33% | 3 Rug Rats | shadow coin bombs tell 42f, straight burst tell 30f, radial shockwave tell 36f with dash gap; P3 dash-chain + warning blast safe wedge | 16-24 | ~2,000 score + guaranteed rare 1-of-3 draft + beat-level-1-boss; perfect +1,500 |

Boss HP scales from active difficulty tier at spawn time and freezes for the fight.

### Scoring decisions

- Main residual degenerate strategy is plateau elite-farming. Mitigate with time-gated boss seams and per-type diminishing returns.
- `biomeIndex * 1500` is awarded once on seam/boss clear, not merely for surviving in a biome.
- Extraction score snapshots/locks at 20:00. Overtime competes only on Endless board.
- Score packet includes: `score`, `components{}`, `biomeReached`, `sessionId`, `wallet`, `gameId`, `season`, `buildHash`, `gameVersion`, `seed`, `assistFlags`, `checksumRoot`, `verifierSig`.
- Boards: Free Practice local only, Ranked Assist-Off, Ranked Assist-On, Overtime/Endless, optional Daily Seed.

Anti-farm diminishing returns:

```text
value = base * max(floor, 1 - decay * (killsThisType_thisMinute / softCap(type, minute)))
```

| Enemy class | Soft cap kills/min | Decay | Floor | Effect |
| --- | --- | ---: | ---: | --- |
| Trash | 40 -> 90 by 20m | 0.70 | 0.20 | Hard taper; fodder farming falls off. |
| Standard | 18 -> 40 | 0.50 | 0.35 | Moderate taper. |
| Elite | 6 -> 14 | 0.25 | 0.70 | Light taper; elites stay rewarding. |
| Boss / mini-boss | n/a | 0 | 1.00 | No taper; milestone payoff. |

## P0 vertical-slice spec

Everything needed to playtest a fun 6:30 Act I and nothing more.

| Domain | Exact minimum | Acceptance |
| --- | --- | --- |
| Sim core | Fixed timestep, single seeded RNG, input log, periodic checksum. | Same seed + inputs produce identical score/checksum golden. |
| Camera/movement | Iso projection, 8-way WASD, mouse aim, hold-fire, dash i-frames. | All combat math in world-space; dash uptime under 100%. |
| Biome | One Slums/Foundry seam, 6-8 chunk templates, hazards: steam grate, smelt pit, conveyor. | No spawn/pickup inside collision; streaming recycles cleanly. |
| Enemies | FUD Goblin, Trench Degen, Paper Hands, Rug Rat, Evil Banker, Gas Beast. | Each has >=24f telegraph, world-space hit, threat-token compliance. |
| Bosses | Warren mini-boss + Rug Pull Baron, MVP arena ring. | Ring never traps; adds obey boss budget; floor-drop deferred. |
| Weapons | The Settler start, Block Breaker pickup, Litecoin Blade, Crypto Bomb. | Core verbs feel good in iso; blade reach is world-space. |
| Skills | 12 P0 skills + Lightning Ledger reachable. | Draft = 2 + 1 reroll; deterministic; no dead/maxed offers. |
| Power-ups | Cold Storage heal, Ammo Cache, Block Breaker pickup, Cold Wallet Shield. | Spawn only on valid pickup lanes. |
| UI | HUD, level-up modal/reroll, boss warning, pause gate, death feedback. | Pause freezes timer/input/audio/projectiles; modal cannot open mid-boss-pattern. |
| Mode | Free Practice only, fully local. | Free-write-boundary test passes: zero official writes. |
| Migration | Active genre/display constants; side-scroll deprecation shims behind `legacyInput`. | Genre-guard and controls-contract tests green. |

Explicitly **not** in P0: ranked/wallet submit, Acts II-III, bosses 3-10, full 40 skills, elite modifiers, mobile controls, fullscreen polish, achievements, leaderboards.

## Lester's Arcade UX flow refinements

Biggest UX win: **let guests play Free Practice before connecting a wallet.** Wallet-gating the first fun moment is the top onboarding-friction risk.

Recommended public flow:

1. Landing / arcade select as guest.
2. HMH card has Play Free enabled.
3. Future cabinets show Coming Soon cards, not errors.
4. HMH detail screen explains premise, controls, run length, Free vs Ranked.
5. Free Practice starts immediately without wallet.
6. After the run, prompt: Connect to save progress and go ranked.
7. Ranked/Testnet requires wallet and chain guard.
8. Chain guard runs pre-run and at submit.
9. Result screen has explicit Submit Official Score for ranked only.

Recommended copy:

- Free Practice: **Free Practice — no wallet, scores stay on this device.**
- Ranked Testnet: **Ranked (Testnet) — connect wallet, official leaderboards. Testnet only — no real money.**
- Official Submit: **Submit Official Score** / subcopy: **Records this run to the leaderboard via your wallet.**

Wrong-chain recovery should happen in-app via `wallet_switchEthereumChain(0x1159)` and fallback `wallet_addEthereumChain`, showing detected vs expected network. Do not force users away from the app.

Exit during a ranked run means forfeit: confirm modal says leaving ends the ranked run and no score is recorded. Session marked `abandoned`; no score and no double-charge. Entry-credit refund policy remains Justin/owner decision.

Profile/settings should be accessible from every screen via top bar, except during active runs where they live under Pause to avoid focus loss.

Suggested local/testnet analytics events: `landing_view`, `connect_clicked`, `connect_result`, `free_guest_started`, `cabinet_select_view`, `cabinet_detail_view`, `mode_select`, `chain_guard_shown`, `chain_switch_result`, `run_start{mode}`, `first_death{t,cause}`, `levelups_count`, `run_end{mode,score,biome}`, `submit_clicked`, `submit_result`, `exit_to_arcade`. Use hashed wallet only; no PII.

## Exploit/failure matrix — implementation gates

### Gameplay

| Risk | Severity | Detection test | Mitigation |
| --- | --- | --- | --- |
| AFK / corner farming | Medium | Sim 20m parked in one region; assert income tapers. | Coverage-based farmFactor + per-type DR. |
| Spawn-camp chunk seams | Medium | Assert spawn lanes spread around camera ring. | Per-lane cooldown and ring distribution. |
| Enemy/pickup in collision/wall | High | Fuzz 10k spawns and drops; assert valid nav/pickup lanes. | Validated lanes + clear radius. |
| Projectile tunneling | High | Fast bullet vs thin wall test. | Swept/continuous collision. |
| Dash i-frame chaining | High | Max dash-CD build; assert uptime under 100%. | i-frame < cooldown, cap uptime. |
| Revive loop | High | Kill at revive frame repeatedly. | Atomic consume, N/run cap. |
| Reroll-bank dupe | High | Open/close modal 100x; bank stable. | Bank sim-state only. |
| Modal does not pause sim | High | Modal mid-flight; assert no state advance. | Single `timeScale=0` pause gate. |
| Timer ticks during pause/fullscreen exit | Medium | Pause/FS-exit; run clock frozen. | Pause gate owns clock. |
| Boss ring traps player | High | Spawn ring on player atop prop; assert escape. | Clamp/nudge ring start. |
| Boss adds exceed budget | Medium | Assert adds <= boss budget every tick. | Separate boss budget. |
| Overtime score inflation | Medium | Long OT sim; bounded multiplier. | Capped multiplier + Endless board. |
| FPS changes sim | High | Run 30/60/144/throttled; same result. | Fixed timestep accumulator, render decoupled. |
| DPR/resize aim break | Medium | Resize/DPR change; aim ray stable. | Live screen-to-world unprojection. |
| Mobile touch fires under menus | Medium | Tap-through test over modal. | Modal captures input; disable touch layer. |
| Audio desync after suspend | Low | Suspend/resume tab; audio state reconciles. | Resume AudioContext, sync to sim time. |

### Web3 / wallet / ranked

| Risk | Severity | Detection test | Mitigation |
| --- | --- | --- | --- |
| Free run writes official state | High | Free run asserts zero official writes. | Single guarded official-write function. |
| Mock wallet accepted as ranked | High | Mock submit rejected. | Mock flagged QA-only; submit requires real provider. |
| Wrong-chain submit accepted | High | Submit on `0x1` blocked. | Re-check chain at submit. |
| Decimal/hex chain mismatch | Medium | Feed `4441` and `0x1159`; equal normalized chain. | Normalize before compare. |
| Malicious provider | High | Malformed provider responses fail safe. | Validate shape; never request keys. |
| Address-case duplicate profiles | Medium | Same address mixed case -> one profile. | Lowercase/checksum-normalized key. |
| Handle/profanity bypass | Medium | Reservation/filter race tests. | Unique reserved index + normalized filter. |
| Avatar XSS/oversize | High | SVG/HTML/huge/EXIF rejected. | Re-encode to PNG; strip metadata; cap size/type. |
| Duplicate session submit | High | Same session twice idempotent. | `sessionId` idempotency key. |
| Replay across wallet/chain/build/season | High | Replay packet in new context rejected. | Bind packet to wallet+gameId+season+buildHash+seed. |
| Input log tampered | High | Edited log fails re-sim. | Server re-sim + checksum root. |
| Checksum sparse | Medium | Edit state between checkpoints caught. | Tune checkpoint cadence + final checksum. |
| Seed manipulation | Medium | Player-chosen seed rejected for ranked. | Server-issued seed or signed daily seed. |
| Client clock manipulation | Medium | Clock skew has no effect. | Sim time = tick count. |
| Abandoned ranked after credit | Medium | Quit mid-run -> abandoned, no score/double-charge. | Abandoned state; refund policy owner decision. |
| UI submit-state desync | Medium | Net success/UI fail and inverse. | Reconcile against receipt truth; retry idempotent. |
| Unsigned receipt | High | Unsigned summary not eligible. | Only verifier-signed summaries count. |
| Schema migration break | Medium | Load v1 profile in v2. | Versioned schema + migration. |
| RPC outage/reorg | Medium | Kill RPC mid-submit. | Queue/retry, pending copy, confirm receipt. |

### UI / UX

| Risk | Detection/fix |
| --- | --- |
| Free vs Ranked misunderstood | HMH detail copy; comprehension target >=90% in usability test. |
| Mock wallet mistaken for official | Persistent QA MOCK banner; mock cannot reach official submit. |
| Cannot find cabinet select after connect | Connect returns to same cabinet context; persistent nav. |
| Future cabinet looks broken | Coming Soon modal, no dead click. |
| Leaderboard mixes practice/official | Separate tabs; practice greyed and clearly not eligible. |
| Fullscreen exit breaks input | Listen `fullscreenchange`, auto-pause, regrab focus/pointer lock. |
| Mobile layout hides HUD/buttons | Safe-area insets and layout test across notch devices. |
| Accessibility toggles hidden | Top-level Settings and HMH detail surface assists. |
| Gore toggle unclear / mid-run change | Pre-run only, locked on start, visible on detail screen. |

## LitVM / EVM interoperability checklist

All testnet-only. No mainnet path, no real funds, no deploys, no commercial branding without explicit Justin approval. Mock wallet is QA-only and never official. Never request seed phrases/private keys.

### Wallet calls

| Call / object | Use |
| --- | --- |
| `eth_requestAccounts` | explicit connect via user gesture |
| `eth_accounts` | silent reconnect on load; no prompt |
| `eth_chainId` | read chain and normalize before compare |
| `wallet_switchEthereumChain` | switch to `{ chainId: "0x1159" }` |
| `wallet_addEthereumChain` | fallback on 4902 unknown-chain |
| events | `accountsChanged`, `chainChanged`, `disconnect`; rerun guard, rederive profile, pause if mid-run |

`wallet_addEthereumChain` params:

```json
{
  "chainId": "0x1159",
  "chainName": "LitVM LiteForge",
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/http"],
  "blockExplorerUrls": ["https://liteforge.explorer.caldera.xyz"],
  "nativeCurrency": { "name": "zkLTC", "symbol": "zkLTC", "decimals": 18 }
}
```

Normalize chain id with decimal/hex equivalence and compare to `4441`. Verify live RPC, chain ID, explorer, faucet/hub, and token decimals against official LitVM docs immediately before any deployment or real transaction flow.

### Ranked submit/sign flow

1. Ranked game-over: player taps Submit Official Score explicitly.
2. Re-check chain must be 4441 and provider must be real; mock blocked.
3. Package run `{seed, inputLog ref, checksumRoot, summary, assistFlags, buildHash}`.
4. Verifier re-simulates from seed + input log.
5. On match, verifier signs summary.
6. Record signed summary + testnet receipt; update profile, achievements, board.
7. UI reconciles against receipt truth; retry is idempotent by `sessionId`.

### LitVM setup test matrix

| Scenario | Expected |
| --- | --- |
| No provider | Offer mock QA + install wallet copy; Free still playable. |
| Provider locked | Prompt unlock via `eth_requestAccounts`; graceful rejection. |
| Wrong chain | Block ranked; show switch button. |
| Correct chain | Show LitVM LiteForge ready state. |
| Switch success / reject | Proceed / stay blocked with retry. |
| Switch 4902 then add success / reject | Add then proceed / stay blocked. |
| RPC unavailable | Queue/retry; clear network unavailable copy. |
| Explorer/faucet links | Generated from constants. |
| zkLTC balance absent/zero | Link faucet/hub; block paid ranked until funded. |
| Testnet-only copy | Visible on ranked surfaces. |
| Real funds disabled | No mainnet transaction path exists in build. |

## Implementation backlog

### P0 — slice foundation, in order

| Task | Acceptance | Test |
| --- | --- | --- |
| Deterministic sim core | seed + inputs -> identical score/checksum | `determinism-golden`, FPS invariance 30/60/144 |
| Genre constants + side-scroll deprecation | active genre is isometric; legacy behind flag | `genre-guard`, `controls-contract` |
| Free/ranked write boundary | free writes no official state | `free-write-boundary` |
| Iso camera + movement/aim/fire/dash | world-space combat; dash uptime <100% | `worldspace-hit`, `dash-iframe-cap` |
| Slums biome + chunk streaming | valid spawn/pickup lanes; clean recycle | `spawn-fuzz`, `pickup-validity` |
| 6 enemies + threat director | tells >=24f; token cap never exceeded | `threat-budget`, `tell-frame` |
| XP curve + deterministic draft/reroll | ~30 levels/20m; no dead/maxed offers | `xp-curve`, `draft-determinism`, `no-dead-draft` |
| 12 skills + Lightning Ledger | exact deltas; caps enforced | `skill-rank`, `cap-enforce`, `evo-unlock` |
| Warren + Rug Pull Baron + ring | no trap; adds budget obeyed | `arena-no-trap`, `boss-add-budget`, `boss-scheduler` |
| HUD + pause gate + modal + death feedback | pause freezes sim surfaces | `pause-gate`, `modal-no-advance` |

### P1 — full first cabinet + ranked

- Acts II-III + seam transitions; time-gated boss seams.
- Full roster + elite modifiers and stacking bans.
- Bosses 1-3 full kits; deferred mechanics only after projectile/occlusion stability.
- Full 40 skills + rarity/evolutions/draw-weight.
- Ranked wallet rails + chain guard + signed submit + verifier re-sim.
- Score rebalance + board separation + assist split + Overtime/Endless board.
- Anti-farm coverage + per-type diminishing returns.
- Missing VFX/UI assets, mobile controls, fullscreen focus handling.
- Avatar/handle/address hardening.

### P2 — depth, meta, platform

- Bosses 4-10 full sheets.
- Achievement remap and optional ERC-1155 claim path; off-chain first and IDs unchanged.
- Daily seed board, tournaments, multi-asset payments, third-party cabinet registry.
- Cosmetic-only unlocks: Lilly, skins, jukebox, cabinet art; no gameplay stats.
- Legal/brand/funds approvals before commercial usage.

## Owner decisions still needed

| Decision | v2.1 recommendation | Why Justin/owner approval is required |
| --- | --- | --- |
| First real paid asset | Testnet zkLTC for prototype; asset-agnostic router for future. | Money/legal gate. |
| Entry-credit refund policy on abandoned ranked runs | Forfeit, no double-charge; refund TBD. | Economy/product policy. |
| Overtime separate board | Yes. | Protects extraction skill expression and affects leaderboard identity. |
| Assist-Off vs combined primary board | Default Assist-Off competitive + inclusive Assist-On. | Competitive identity. |
| Daily-seed board scope | P2; cheap once determinism exists. | Competitive identity and scope. |
| Future cabinets status | Lilly's Lightning / Mempool Mayhem remain coming-soon flavor until greenlit. | Scope/priority. |
| Portal branding | Lead Litecoin/LitVM but architect rails for third-party cabinets later. | Roadmap ownership. |
| LitVM live constants | Verify official docs before deploy. | External technical verification gate. |
| Litecoin name/logo/pay-to-play licensing | Written brand/legal sign-off before commercial/real-funds launch. | Legal gate; not legal advice. |
