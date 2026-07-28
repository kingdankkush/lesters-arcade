# Lester's Arcade

A retro Litecoin and LitVM arcade portal with deterministic child games, wallet-bound profiles, canonical game sessions, cadence leaderboards, achievements, and approval-gated Web3 publishing.

**Repository:** https://github.com/kingdankkush/Lesters-Arcade

**Production:** https://lestersarcade.io

**Current HMH production source:** `a81f1c8f830f3339ebb568de166c108e58f695d3` (Cycle 021)

**Immutable production deployment:** https://lesters-arcade-gsbj7uxer-justin-agent-projects.vercel.app

**Immutable Cycle 021 preview:** https://lesters-arcade-fgzvqbcjk-justin-agent-projects.vercel.app

> **Current Hard Money Heroes continuation handoff:** [`docs/handoffs/2026-07-28-hmh-cycle-027-claude-handoff.md`](docs/handoffs/2026-07-28-hmh-cycle-027-claude-handoff.md)

> `lestersarcade.io` now serves the Cycle 021 bundle. Public desktop, ultrawide, tablet, mobile portrait, mobile landscape, cockpit, and collectible routes were reverified after promotion. `SETTLEMENT_LIVE=false` remains mandatory; LitVM contracts, wallets, signatures, transactions, and settlement changes require separate explicit HALT approval.

---

## Current game roster

| Cabinet | Game ID | State | Summary |
| --- | --- | --- | --- |
| Hard Money Heroes | `lester-blaster` | Playable reboot candidate | Deterministic PixiJS top-down 2.5D roguelike run-and-gun with authored world, four production heroes, enemies, boss, progression, desktop/mobile/controller controls, and parent portal integration |
| Chikun's Escape | `chikun` | Coming Soon, dev harness only | Third-party one-button arcade integration with Cabinet SDK, deterministic parent-seeded replay, fail-closed mode configuration, and cabinet art |
| Future cabinets | Various | Coming Soon | Portal expansion slots, not production commitments until separately approved |

---

## Product direction

Lester's Arcade is the parent account and cabinet platform. It owns:

- Wallet discovery and login.
- Player profiles and character preferences.
- Free and Ranked mode boundaries.
- Canonical session IDs, seeds, evidence, and finalization.
- Official session history.
- Daily, weekly, monthly, yearly, and all-time leaderboards.
- Achievements and profile progression.
- Analytics.
- Contract reads and player-signed transactions.
- Settlement policy.

Child games own gameplay simulation and presentation. They do not request wallets, send transactions, grant official progress, or decide settlement.

### Hard Money Heroes vision

The active HMH direction is a deterministic top-down 2.5D roguelike run-and-gun with:

- Precise keyboard/mouse, controller, and touch controls.
- Authored districts, loops, landmarks, hazards, and boss arenas.
- Controlled deterministic enemy pressure instead of random scatter.
- Truthful projectile, collision, elevation, damage, and telegraph behavior.
- Human survivors and zombies, never animal, vehicle, robot, mech, or abstract actor proxies.
- Deep weapons, upgrades, build synergies, bosses, achievements, and ethical replayability.
- Projection-only animation, VFX, audio, interpolation, and quality scaling.
- 60 FPS desktop and 30 FPS mobile targets with 100+ enemy pressure.
- Parent-owned profiles, sessions, leaderboards, and future verified LitVM publication.

The controlling roadmap is [.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md](.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md).

---

## Major updates

## Chikun's Escape integration

Chikun entered the project through platform-extensibility work, a third-party source handoff, and Cabinet SDK integration.

Implemented:

- Canonical cabinet manifest and loader.
- Rotating transparent cabinet artwork.
- Free and Ranked-preview mode configuration.
- Fixed 60 Hz deterministic flap simulation.
- Bounded input evidence.
- Parent-provided Ranked seed, build hash, and season binding.
- Canonical replay and result verification.
- Fail-closed missing mode configuration.
- Coming Soon public gate with a development-only harness.

Current canonical files:

- `apps/portal/src/chikun-cabinet.mjs`
- `apps/portal/src/games/chikun/loader.mjs`
- `apps/portal/games/chikun/game.manifest.json`
- `apps/portal/games/chikun/main.mjs`
- `apps/portal/assets/generated/chikun-cabinet/`
- `apps/portal/assets/generated/chikun-mode-select/`

The historical full React/Supabase source handoff was vaulted out of the active tree and remains inspectable in commit [`51def63a`](https://github.com/kingdankkush/Lesters-Arcade/commit/51def63af5ebbc84bab3b0dd51273d5c805b47b5) and [PR #2](https://github.com/kingdankkush/Lesters-Arcade/pull/2). It must not be restored without reconciling current parent authority, deterministic replay, security, persistence, and bundle constraints.

Chikun remains `playable: false` and `devPlayable: true` until its production game, art, audio, browser, SDK, and public-launch gates are complete.

## Hard Money Heroes reboot

HMH moved away from the older monolithic Canvas/isometric/procedural prototype into a separate deterministic PixiJS child application.

The reboot now includes:

- PixiJS `8.19.0` renderer.
- Fixed 60 Hz simulation and four-step catch-up cap.
- Secure same-origin sandboxed iframe host.
- `hmh-bridge/v1` parent/child protocol with a 65,536-byte cap.
- Movement, aim, dash, touch, gamepad, collision, and elevation.
- Weapons, projectile physics, melee, grenades, combat events, lifecycle, and audio.
- Six enemy families and a deterministic encounter director.
- Liquidator boss logic.
- Authored Level 1, The Forked Frontier.
- Six districts, loops, bridge, water, ramps, ledges, hazards, POIs, minimap, and reveal data.
- Run progression and cockpit UI.
- Four approved production hero atlases.
- Production world and enemy projection layers.
- Parent-owned profile, session, leaderboard, and settlement integration.
- Release certification, Chrome/Edge matrices, security gates, network audits, soaks, and artifact-verified previews.

### AAA cycles 001-027

The bounded cycle ledger is the authoritative implementation history. Highlights:

- Cycles 001-003: observability, fixed-step input buffering, collision safety, and permanent portal E2E coverage.
- Cycles 004-006: deterministic combat/boss integrity, progression depth, production hero art, and the authored human/zombie enemy roster.
- Cycles 007-010: complete authored art integration, ledge combat correction, world composition, and bounded projectile recovery.
- Cycles 011-015: truthful Liquidator telegraphs, responsive mobile HUD, four animated hero selectors, district landmarks, and nine deterministic authored-POI collectibles.
- Cycles 016-018: grenade danger warnings, responsive upgrade disclosures, and truthful pause/settings/current-build presentation.
- Cycles 019-021: isolated desktop/mobile soaks, restart-race correction, deploy-build reproducibility, animated district signals, and Cycle 021 production promotion.
- Cycles 022-023: authored terrain materials and instantly identifiable pickup/POI models.
- Cycle 024: shared projection and detailed character/enemy body geometry.
- Cycle 025: four-control mobile layout plus five deterministic weapon capstones.
- Cycle 026: one shared light rig, mobility upgrades, and clearer current-build progression.
- Cycle 027: Forkrunner/Gas Bomber role equipment, collision-readable enemy projection scale, stable desktop/mobile roster preview, and current-candidate browser certification.

See [the continuous-improvement ledger](docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md), [Cycle 027](docs/hmh-reboot/cycles/CYCLE-027.md), and the [current Claude handoff](docs/handoffs/2026-07-28-hmh-cycle-027-claude-handoff.md).

---

## Current Cycle 021 production status

| Gate | Result |
| --- | --- |
| Source | `a81f1c8f830f3339ebb568de166c108e58f695d3` |
| Cycle 021 commit diff SHA-256 | `7239e8c66ec7275bbf556c59de999fa8a7d35893aa0a6817aeffad7fa080daeb` |
| Release ledger | 1,721 total, 1,669 passing, exactly 52 accepted legacy failures, 0 unexpected |
| Syntax | 332 JavaScript modules and 49 Python scripts |
| Deterministic visual regression | 8/8 unchanged; reduced motion verified with 0 animated signals |
| Public browser matrix | Desktop, ultrawide, tablet landscape, mobile portrait, and mobile landscape PASS |
| Public cockpit | Desktop, tablet, mobile portrait, and short landscape PASS |
| Public collectibles | All nine effects, reset, timed expiry, portrait, and landscape PASS |
| Network/console | Four scenarios; zero HTTP, request, console, or page errors |
| Performance | Desktop/mobile p95 7 ms / 7 ms |
| HMH bundle | 1,012,139 / 1,050,000 bytes |
| HMH bundle SHA-256 | `7e6938dbad83dd1b36d71cc2cdc03008f36b30213754b2fb36bc13d4643492da` |
| Security | 5/5; sandbox 3/3; settlement boundary 9/9 |
| Web3 live readiness | PARTIAL 3/4; hardened publication remains blocked |

### Production identities verified 2026-07-27

- Public domain: https://lestersarcade.io
- GitHub production deployment record: `5626423782`
- Immutable production URL: https://lesters-arcade-gsbj7uxer-justin-agent-projects.vercel.app
- GitHub preview deployment record: `5626388771`
- Immutable preview URL: https://lesters-arcade-fgzvqbcjk-justin-agent-projects.vercel.app
- Current service worker: 3,508 bytes; SHA-256 `8146ed967e426c70d9dc439494168c85be32892720fec8e9794347a10d6b504a`
- Immediate previous production source: `9ff359eaf28b81a792a10a41b0d59db5f9ae5440`
- Immediate previous immutable production URL: https://lesters-arcade-g242ggtb8-justin-agent-projects.vercel.app

The Vercel CLI is currently unavailable locally, so Vercel `dpl_...` identifiers and rollback status must be resolved through an authenticated Vercel session or dashboard before any future production action.

## Current continuation status

This is source/preview truth only. It is **not** the production deployment.

| Gate | Cycle 027 continuation result |
| --- | --- |
| Branch | `reboot/hmh-aaa-continuous` |
| Certified source | `4c0066371423cd752ac48d2c39c66e275635934d` |
| Exact commit patch SHA-256 | `6dcd1ec317d4e1234ce1a3d79d4e2b465f9c5f67f8245d9108aa1200be8b7ea5` |
| Release ledger | 1,773 total, 1,721 passing, exactly 52 accepted legacy failures, 0 unexpected |
| Authored enemy pipeline | 7 actors, 1,368 frames, 0 duplicates, reproducible |
| Enemy-detail browser gate | Desktop and 390x844 mobile PASS; six production families visibly framed |
| Local candidate browser matrix | Desktop, ultrawide, tablet, mobile portrait, and mobile landscape PASS |
| Performance | Desktop/mobile p95 7 ms / 7 ms |
| HMH bundle | 1,021,358 / 1,050,000 bytes |
| Security and network | Zero security findings; four network scenarios with zero failures |
| Production promotion | Not performed; Cycle 021 remains live |

---

## Architecture

```text
Browser
└── Lester's Arcade parent portal
    ├── Wallet/profile/session/leaderboard authority
    ├── Local persistence and canonical evidence
    ├── LitVM chain client, disabled writes by default
    └── Sandboxed HMH iframe
        └── PixiJS child runtime
            ├── Fixed-step simulation
            ├── Input/movement/collision/elevation
            ├── Combat/enemies/boss/progression
            └── Projection-only rendering and audio
```

### Core directories

```text
apps/
├── hmh-reboot/              PixiJS HMH child runtime and editable Blender sources
└── portal/                  Parent portal, child host, profiles, sessions, leaderboards, assets

contracts/
├── src/                     Solidity contracts
├── artifacts/               Compiled artifacts
├── deploy-config.testnet.json
└── deployment-record.json   June legacy deployment record

docs/
├── handoffs/                Agent handoffs
├── hmh-reboot/              Reboot design, evidence, certificates, cycle records
├── qa/                      Generated audits
└── web3/                    LitVM specs, readiness, hardened dry-run manifest

sdk/
└── hmh-bridge-protocol.mjs  Parent/child protocol contract

scripts/                     Build, QA, browser, asset, contract, and audit tooling
tests/                       Node and contract-facing regression suites
```

### HMH active code

```text
apps/hmh-reboot/src/
├── main.mjs
├── simulation.mjs
├── input.mjs
├── movement.mjs
├── aim.mjs
├── dash.mjs
├── collision.mjs
├── elevation.mjs
├── world-space.mjs
├── weapon-system.mjs
├── projectile-physics.mjs
├── melee.mjs
├── grenades.mjs
├── enemy-archetypes.mjs
├── enemy-simulation.mjs
├── enemy-combat.mjs
├── encounter-director.mjs
├── liquidator-boss.mjs
├── level-one-world.mjs
├── run-progression.mjs
├── collectible-system.mjs
├── liquidator-telegraph-renderer.mjs
├── authored-prop-atlas.mjs
├── combat-audio.mjs
├── hud-layout.mjs
├── production-hero-atlas.mjs
├── enemy-production-art.mjs
├── world-production-art.mjs
└── runtime-performance.mjs
```

### Parent platform code

```text
apps/portal/src/
├── arcade-core.mjs
├── persistence.mjs
├── session-integrity.mjs
├── leaderboard-engine.mjs
├── hmh-profile-parity.mjs
├── wallet-auth.mjs
├── settlement.mjs
├── litvm-chain-client.mjs
├── hmh-reboot-host.mjs
├── hmh-reboot-bridge.mjs
└── hmh-reboot-portal-lifecycle.mjs
```

---

## Production art

Editable Blender sources:

- `apps/hmh-reboot/assets/source/blender/hmh-character-template.blend`
- `apps/hmh-reboot/assets/source/blender/hmh-commando-concepts.blend`
- `apps/hmh-reboot/assets/source/blender/hmh-production-heroes.blend`

Production hero atlases:

- `apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/`
- `apps/portal/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/`
- `apps/portal/assets/generated/hmh-reboot-production-heroes/lester-original/`
- `apps/portal/assets/generated/hmh-reboot-production-heroes/lilly/`

Do not restore retired assets under `apps/portal/assets/generated/hmh-isometric-pixellab/` or use mannequin/prototype actors as final production art.

---

## Profiles, sessions, leaderboards, and Web3

### Functional now

- Local wallet-normalized profiles and preferences.
- Canonical session IDs, seed, build hash, season, evidence, and envelope hashes.
- Active session checkpoints and local run history.
- Free versus Ranked persistence boundaries.
- Daily, weekly, monthly, yearly, and all-time local leaderboards.
- Profile run history and local official sessions.
- Achievement and progression integration.
- Simulated/local settlement records.
- Player-signed chain client source for verified score and profile writes.

### Not live end to end

`SETTLEMENT_LIVE` remains `false`.

The June legacy contracts contain bytecode, but the current hardened score ABI cannot decode the legacy score registry. Chain leaderboard reads fail closed. The hardened verifier-based deployment is still an unsigned dry run and its predicted GameRegistry, PlayerProfileRegistry, and ScoreSubmissionRegistry addresses contain no bytecode.

The browser consumes an externally supplied verifier attestation, but the project does not yet contain a trusted production attestation service or controlled signing flow.

Before verified testnet publishing can be called functional:

1. Obtain explicit contract-deployment HALT approval.
2. Deploy and verify the hardened contracts.
3. Implement trusted replay/evidence attestation outside the untrusted browser.
4. Complete a real-wallet LitVM run and read it back into profile, session history, and verified leaderboards.
5. Prove duplicate, replay, expiry, wrong-chain, user-cancel, and RPC-failure behavior.

Paid settlement additionally requires approved payment asset, fees, splits, vaults, legal/economy decisions, security review, payment/session contracts, and real-wallet testnet certification.

See:

- [HMH Web3 live readiness](docs/web3/hmh-web3-live-readiness.md)
- [Hardened deployment dry run](docs/web3/hardened-ranked-deployment-manifest.json)
- [Contract architecture](contracts/ARCHITECTURE.md)
- [Full Fable handoff](docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md)

---

## Quick start

### Requirements

- Node.js 22 or newer recommended.
- npm.
- Python 3 for the local static server and asset scripts.
- Chrome or Edge for browser certification.
- Blender 5.1.2 only when rebuilding certified HMH production heroes.
- Foundry and Slither only for their respective contract gates.

### Install and build

```bash
npm install
npm run build
```

On this Windows checkout, use npm. `pnpm run build` is blocked by a parent user-level package-manager declaration, while the repository npm build succeeds.

### Serve locally

Serve `apps/portal`, not `apps/portal/dist`:

```bash
cd apps/portal
python -m http.server 8791 --bind 127.0.0.1
```

Open:

- Portal: http://127.0.0.1:8791/
- HMH child: http://127.0.0.1:8791/hmh-reboot/index.html

### Core checks

```bash
npm run check
npm run test:release
npm run build
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run audit:hmh:network
npm run certify:hmh:browser
npm run smoke:hmh:cockpit
npm run smoke:hmh:collectibles
npm run smoke:hmh:enemy-details
npm run smoke:hmh:mobile-controls
npm run smoke:hmh:performance
npm run visual:reboot
npm run smoke:portal
npm run smoke:portal:interactions
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
```

---

## Next priorities

1. Continue role-specific model geometry for Bagholder Rusher, Liquidator Agent, Whale Enforcer, Cultist and boss without changing hitboxes.
2. Replace remaining simple buildings, trees, crates and landmark props with authored modular assets, then close the prop reproducibility tolerance gap.
3. Add secondary motion and combat readability to hero/enemy clips: recoil, cloth/strap follow-through, hit reactions and boss phase poses.
4. Improve combat and movement feel through test-first weapon tuning, acceleration/deceleration review, melee reach clarity, grenade cadence and progression/build balance.
5. Run real keyboard/mouse, controller and real-phone acceptance for touch ergonomics, audio balance, thermal behavior, reduced motion and motion comfort.
6. Harden portal E2E at actual mobile viewport sizes, not desktop-only emulation.
7. Resolve current/previous Vercel `dpl_...` identifiers and verify rollback before any future production request.
8. Add branch protection/CI or preserve the current manual exact-index, preview, soak and public-verification discipline.
9. Keep hardened verifier/attestation and LitVM deployment work blocked until separate explicit HALT approval.
10. Decide whether Chikun's development harness should become a production public vertical slice.

---

## Safety boundaries

- Do not push ordinary work directly to `main`.
- Do not promote production without approval for the exact deployment.
- Do not deploy contracts or send LitVM transactions without explicit HALT approval.
- Do not expose private keys or verifier secrets.
- Do not let HMH child code request wallets or transact.
- Do not let Free Mode write Ranked progress.
- Do not let art, interpolation, particles, audio, or quality tiers alter simulation results.
- Do not reactivate retired/proxy actor art.
- Do not claim local or simulated settlement is on-chain settlement.
- Any runtime source change requires a fresh build, release certificate, exact-index review, preview, and artifact verification.

---

## License

UNLICENSED. Private project unless the owner explicitly changes repository or licensing policy.
