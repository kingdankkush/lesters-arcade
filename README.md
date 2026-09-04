# Lester's Arcade

A retro Litecoin and LitVM arcade portal with deterministic child games, wallet-bound profiles, canonical game sessions, cadence leaderboards, achievements, and approval-gated Web3 publishing.

**Repository:** https://github.com/kingdankkush/Lesters-Arcade

**Production:** https://lestersarcade.io

**Certified production runtime implementation:** `414fc3049` (`fable/hmh-cycle-072-visual-facelift`)

**Verified runtime release deployment:** `dpl_FMqS2vbPBq1Na12m33ER9K7Ho27w`

**Immutable runtime release:** https://lesters-arcade-qkk7kcv56-justin-agent-projects.vercel.app

**Retained rollback:** `dpl_5HbBQf21BFoPzucGvijjcefygcDS`

**Production cache marker:** `lesters-arcade-v25-hmh-visual-facelift`

> **Current Lester's Arcade / HMH / Chikun handoff:** [`docs/handoffs/2026-08-20-lesters-arcade-hmh-chikun-live-release.md`](docs/handoffs/2026-08-20-lesters-arcade-hmh-chikun-live-release.md)

> Runtime release facts above were verified on 2026-09-04 through exact-index review, Git/Preview artifact identity, Vercel promotion and custom-domain deployment-ID inspection, exact Preview/production hashes for stable bundles, and live five-profile HMH plus four-profile mobile-control browser certification. The deployed runtime boundary is `414fc3049`; later documentation-only commits do not replace it.

> `SETTLEMENT_LIVE=false` remains mandatory; LitVM contracts, wallets, signatures, transactions, and settlement changes require separate explicit HALT approval.

---

## Current game roster

| Cabinet | Game ID | State | Summary |
| --- | --- | --- | --- |
| Hard Money Heroes | `lester-blaster` | Playable reboot candidate | Deterministic PixiJS top-down 2.5D roguelike run-and-gun with authored world, four production heroes, enemies, boss, progression, desktop/mobile/controller controls, and parent portal integration |
| Chikun's Escape | `chikun` | Public playable, Ranked-eligible (`0.5.0`) | Third-party one-button arcade shipped through Cabinet SDK v1, with deterministic parent-seeded replay, a parent-owned daily UTC course, same-seed ghost racing, a seek-safe animated replay viewer, fail-closed mode configuration, and cabinet art. Asset rights, `devWallet`, and revenue split remain open — see below |
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
- Reference-faithful detailed Blender characters derived from approved illustrated sheets and combat sprites.
- Ordinary enemies at comparable human scale, with forgiving projectile hurtboxes tuned in separate deterministic gameplay cycles.
- Deep weapons, upgrades, build synergies, bosses, achievements, and ethical replayability.
- Projection-only animation, VFX, audio, interpolation, and quality scaling.
- 60 FPS desktop and 30 FPS mobile targets with 100+ enemy pressure.
- Parent-owned profiles, sessions, leaderboards, and future verified LitVM publication.

The ongoing roadmap and certification history are maintained in [docs/handoffs/](docs/handoffs/).

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

Chikun launched publicly in [`54aab311`](https://github.com/kingdankkush/Lesters-Arcade/commit/54aab311a813bf4d5ce622d54633ade32dd24bf1) on 2026-08-11, which is an ancestor of the deployed production source. The cabinet is `status: 'playable'` with `publicPlayable: true` and `rankedEligible: true`, and the portal serves it at `/play/chikun`. It is the working proof that third-party Cabinet SDK onboarding produces a shippable cabinet.

Shipped since the public launch, integrated 2026-08-19:

- **Parent-owned daily course.** The parent issues one UTC daily seed, so every Free run on a given day races the same forks and a remount does not reroll the course. Ranked session seeds stay unique and parent-issued. This is a shared course, not an official Daily Seed leaderboard; official boards remain an owner product decision.
- **Same-seed ghost.** A translucent projection of the player's best local flight on that seed. Projection only: it has no collision, no score contribution, and no Ranked write.
- **Seek-safe animated replay viewer.** `Watch Replay` on the result screen plays the just-submitted flap log back on the live canvas at 60 Hz, with a scrubbable timeline, 15-tick arrow-key nudges, and space/tap pause. Reduced motion parks on the crash frame rather than autoplaying. The canonical score is already final and the viewer cannot change it.

Current canonical files:

- `apps/chikun/src/main.mjs`
- `apps/chikun/src/replay-viewer.mjs`
- `apps/portal/chikun/`
- `apps/portal/src/chikun-daily-challenge.mjs`
- `apps/portal/src/chikun-cabinet.mjs`
- `apps/portal/src/chikun-host.mjs`
- `apps/portal/src/chikun-bridge.mjs`
- `apps/portal/src/chikun-bridge-protocol.mjs`
- `apps/portal/src/chikun-portal-lifecycle.mjs`
- `apps/portal/src/games/chikun/loader.mjs`
- `apps/portal/games/chikun/game.manifest.json`
- `apps/portal/games/chikun/main.mjs`
- `apps/portal/assets/generated/chikun-cabinet/`
- `apps/portal/assets/generated/chikun-mode-select/`
- `apps/portal/assets/generated/chikun-game/`

The historical full React/Supabase source handoff was vaulted out of the active tree and remains inspectable in commit [`51def63a`](https://github.com/kingdankkush/Lesters-Arcade/commit/51def63af5ebbc84bab3b0dd51273d5c805b47b5) and [PR #2](https://github.com/kingdankkush/Lesters-Arcade/pull/2). It must not be restored without reconciling current parent authority, deterministic replay, security, persistence, and bundle constraints.

What shipped is the `0.5.0` vertical slice, not the creator's full original game. These remain open and must not be described as settled:

- Public approval and written commercial-use, modification, hosting, and redistribution rights for the creator's source art are pending (`docs/THIRD_PARTY_GAME_ONBOARDING.md`).
- `devWallet` is `null` in both `game-registry.mjs` and `game.manifest.json`, so third-party revenue routing is unwired.
- The registry revenue split is a skeleton and `entryFeeMicroUsdc` resolves to `DEFAULT_ENTRY_FEE_MICRO_USDC = 0`. No paid entry is live.

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

### AAA cycles 001-070

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
- Cycle 028: user-reference model contract for all four heroes, a 48-part Lester combat rebuild, reproducible four-hero atlas/selector regeneration, and corrected production-hero mobile/asset certification rails.
- Cycles 029-031: reference-faithful Blender rebuilds for Lilly, Lit Commando, and Lit Valkyrie.
- Cycles 032-036: projection-only zombie scale parity, forgiving deterministic hurtboxes, Bagholder Rusher and Whale Enforcer close-range readability, Liquidator Agent and Validator Cultist role art, and mobile weapon access with truthful reload/switch/overheat readability.
- Cycles 050-053: authored-nav chokepoint pressure for the heavy role, 128-body attack-token and low-FPS safety evidence, serial desktop/mobile real-browser endurance certification, and exact visual-baseline authority reconstruction.
- Cycles 054-057: the production mobile-character-start hotfix merged into continuation without promotion, the deterministic Liquidator no-hit/baseline/high-DPS/low-DPS build matrix, non-vacuous 128-body browser projectile probes, and README/agent-policy reconciliation against deployed source truth.
- Cycles 058-061: Liquidator melee-heavy and crowd-control matrix completion, height-aware authored-cover counterplay, fixed-tick production phase art and audio, and deterministic Margin Call safe-sector rotation.
- Cycles 062-065: navgrid-validated flanker lanes, the canonical Precision Ledger crit-upgrade benchmark routed through the live combat resolver into Liquidator damage, navgrid-validated ranged-role backoff and strafe lanes, and Precision Ledger selection through real Coin Blaster cadence.
- Cycles 066-067: bounded timed-power-up refresh telemetry with Liquidator-safe nuke lifecycle certification, and one shared fixed-tick timed-effect countdown driving the desktop HUD, the mobile HUD, and `aria-live` accessibility wording from a single source.
- Cycle 068: projection-only Time Dilation/Berserk silhouette and audio identity recovered onto current integration, followed by exact candidate review, full serial certification, and live production proof for HMH and Chikun.
- Cycle 070: portal-owned pause-only soundtrack transport with accessible seek/volume/queue controls, a non-overlapping desktop sidecar, a contained portrait-mobile launcher/drawer, MCP 1/2 PixelLab owner-script compatibility, exact Preview proof, and live desktop/mobile production verification.
- Cycle 071: canonical `bruiser` encounter-role truth, exported projectile budgets clamped to the live 128-projectile authority, direct cross-band tests, and source-backed reconciliation of the Fable roadmap.
- Cycle 072: the gameworld facelift. Terrain rebaked as lit micro-terrain with the 67-pixel tile grid removed, roads without the black outline, shore and scree edge bands, ground contact shadows, a real in-game HUD with developer telemetry behind `?debugHud=1`, the encounter director decoupled from the render camera, and the external-model import path for owner-supplied GLB/FBX actors.

See the [reconciled AAA roadmap](docs/hmh-reboot/AAA-ROADMAP.md), [reference-derived character model brief](docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md), [continuous-improvement ledger](docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md), [Cycle 072](docs/hmh-reboot/cycles/CYCLE-072.md), and the [current live-release handoff](docs/handoffs/2026-08-20-lesters-arcade-hmh-chikun-live-release.md).

---

## Current production runtime status

| Gate | Verified 2026-09-02 result |
| --- | --- |
| Runtime implementation | `414fc3049` |
| Exact certified patch SHA-256 | `e08e6e91430a02afe177add51a3cf87db0834b6997590e7998cb9a549ded7094` |
| Release ledger | 2,283 evaluated, 2,232 passing, exactly 51 accepted legacy failures, 0 unexpected |
| Syntax | 361 JavaScript modules and 49 Python scripts |
| Deterministic visual suite | 12/12 unchanged; every scene `0 / 0 / 0` delta |
| HMH browser matrix | Desktop, ultrawide, tablet landscape, mobile portrait, and mobile landscape PASS locally and on production |
| Mobile controls | iPhone 13, Pixel 7, iPhone SE portrait, and iPhone 13 landscape real-pointer PASS |
| Network/console | Four clean/warm portal/HMH production scenarios; 0 HTTP/request/console/page errors |
| Performance | Desktop/mobile p95 7.1 ms / 7.0 ms |
| HMH initial JS | 395,337-byte entry + 575,891-byte Pixi vendor = 971,228 / 1,050,000 bytes; 78,772 bytes headroom |
| Security/Web3 | Security 5/5, findings 0; Web3 source audit 9/9; `SETTLEMENT_LIVE=false` |

### Runtime release identities

- Public domain: https://lestersarcade.io
- Verified Preview deployment: `dpl_Gn7CJuYMMEvw6Kyak7yfGEu31v9u`
- Verified production deployment: `dpl_FMqS2vbPBq1Na12m33ER9K7Ho27w`
- Immutable production URL: https://lesters-arcade-qkk7kcv56-justin-agent-projects.vercel.app
- Retained rollback deployment: `dpl_5HbBQf21BFoPzucGvijjcefygcDS`
- Retained rollback URL: https://lesters-arcade-57ws1fm9l-justin-agent-projects.vercel.app
- Active runtime cache marker: `lesters-arcade-v25-hmh-visual-facelift`
- Exact service-worker, portal bundle, HMH child bundle, and Pixi vendor bytes matched between the verified Preview and production.

A later documentation-only commit can create a newer Preview without changing production. Treat `f2328177` as the implementation boundary and re-inspect the alias before any future release; do not invent a self-referential “current docs commit” SHA.

## Current continuation status

Runtime implementation `414fc3049` is certified and live. This documentation wave records that immutable boundary without claiming its own future commit SHA.

| Gate | Result |
| --- | --- |
| Release branch | `hermes/hmh-cycle-070-gameplay-ui-music` at runtime boundary `f2328177` |
| Latest closed cycle | 071, roadmap reconciliation and encounter-role/projectile-budget truth |
| Release ledger | 2,283 evaluated, 2,232 passing, exactly 51 accepted legacy failures, 0 unexpected |
| Syntax | 361 JavaScript modules and 49 Python scripts |
| HMH initial JS / cap | 971,228 / 1,050,000 bytes; 78,772 bytes headroom |
| Chikun | `0.5.0`; daily course, same-seed ghost, animated replay, Ranked/Free desktop/mobile certification |
| Cabinet status docs | PASS across canonical manifests and governed docs |
| Production marker | `lesters-arcade-v25-hmh-visual-facelift`; local README parity and live network gate PASS |
| Production runtime | LIVE at the verified `f2328177` implementation boundary |

The next generated-art/Tripo/PixelLab phase remains locked until Justin explicitly says `go`. Code-first audit, certification, and documentation work may continue without that art authorization.

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
npm run docs:production
npm run docs:cabinets
```

`docs:production` needs the network: it proves the README cache marker against the live service worker. `docs:cabinets` is offline and deterministic, so it also runs inside `npm test` and therefore inside `test:release` and the Vercel build.

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
10. Resolve Chikun's open commercial items: written art rights, a real `devWallet`, and the revenue split. The technical launch question is closed, the cabinet is public and Ranked-eligible; what remains is contractual.
11. Certify Chikun 16:9 play. `aspectSupport` declares both orientations, but only 9:16 has certification evidence under `tests/`.

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
