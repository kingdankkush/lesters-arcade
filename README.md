# Lester's Arcade

A retro Litecoin and LitVM arcade portal with deterministic child games, wallet-bound profiles, canonical game sessions, cadence leaderboards, achievements, and approval-gated Web3 publishing.

**Repository:** https://github.com/kingdankkush/Lesters-Arcade

**Production:** https://lestersarcade.io

**Current HMH Cycle 002 preview:** https://lesters-arcade-ck25dqelb-justin-agent-projects.vercel.app

**Comprehensive Claude/Fable handoff:** [docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md](docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md)

> Production does not yet contain the Cycle 002 candidate. The preview is verified and Ready, but promotion requires explicit approval for the exact deployment. LitVM contract deployment and transaction activity require a separate HALT approval.

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

### AAA Cycle 001

Cycle 001 added:

- Hosted-origin-only Vercel Analytics.
- Permanent fail-closed network and console auditing.
- Vector-magnitude-bounded acceleration.
- Velocity interpolation.
- Projection-only interpolated camera following.
- Cross-platform retained-memory harness fixes.
- Updated browser smokes and active production hero references.
- Removal of broken hidden references to retired actor art.

See [docs/hmh-reboot/cycles/CYCLE-001.md](docs/hmh-reboot/cycles/CYCLE-001.md).

### AAA Cycle 002

Cycle 002 added a bounded 100 ms rising-edge buffer for:

- Fire.
- Melee.
- Grenade.
- Dash.

Rapid press/release actions now survive render frames with zero fixed simulation steps across keyboard, pointer, touch, and gamepad. Pending edges consume once, expire when stale, and remain bounded to one pending edge per action.

Cycle 002 did not change collision, elevation, recoil, saves, replay, wallets, settlement, or parent authority.

See:

- [Cycle 002 record](docs/hmh-reboot/cycles/CYCLE-002.md)
- [Release certification](docs/hmh-reboot/RELEASE-CERTIFICATION-AAA-CYCLE-002.md)
- [Preview verification](docs/hmh-reboot/PREVIEW-VERIFICATION-AAA-CYCLE-002.md)
- [Memory audit](docs/hmh-reboot/MEMORY-AUDIT-AAA-CYCLE-002.md)

---

## Cycle 002 release status

| Gate | Result |
| --- | --- |
| Release ledger | 1,619 total, 1,567 passed, exactly 52 accepted legacy failures in 35 files, 0 unexpected |
| Focused controls/combat | 75/75 |
| Syntax | 319 JavaScript modules, 40 Python scripts |
| Chrome | Five viewport profiles passed |
| Edge | Five viewport profiles passed |
| Production heroes | Four of four desktop/mobile smokes passed |
| Security | 5/5, zero findings |
| Sandbox security | 3/3 |
| Web3 authority | 9/9 |
| Network/console | 4/4, zero failures |
| Performance | Desktop/mobile p95 7 ms |
| HMH bundle | 963,568 bytes under 1,050,000-byte gate |
| Input-state soak | 260,000 cycles, bounded pending state, 2,000-byte retained delta |
| Exact-index reviews | Gameplay, security/Web3, and release evidence all PASS |

A broader browser heap threshold fails against both current production and Cycle 002. Cycle 002 did not regress the matched production baseline, but pre-existing renderer/runtime retained-memory debt remains open.

### Exact candidate

- Deployable source: `ab8eecdbe7ec40e3451ef8b10f58ae3095a3a170`
- Evidence commit: `af86dfadbd4861d76f56c7198a62739e57ab9543`
- Preview deployment: `dpl_7jXSC1fjXSPtnAzEkzZx97CgTNXN`
- Preview URL: https://lesters-arcade-ck25dqelb-justin-agent-projects.vercel.app
- Production deployment remains: `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`
- Rollback deployment remains: `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`

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
npm run smoke:hmh:performance
npm run smoke:portal
npm run smoke:portal:interactions
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
```

---

## Next priorities

1. Preserve and, only with approval, promote the exact Cycle 002 candidate.
2. Continue the earliest incomplete HMH Phase 2 slice: collision/elevation/low-FPS safety, stale aim, focus/device switching, or projection-only camera framing.
3. Build a permanent portal E2E harness for Free, Ranked preview, wallet reconnect, profiles, scores, sessions, restart, controls, audio, and service-worker behavior.
4. Investigate pre-existing browser retained-memory debt with matched production controls.
5. Prepare the hardened verifier deployment and attestation architecture without broadcasting.
6. Decide how to turn Chikun's development harness and historical source into a production public vertical slice.
7. Expand HMH combat identities, bosses, authored acts, animation, VFX, audio, build synergies, accessibility, and physical-device QA.
8. Treat paid settlement as a separate product, economy, legal, and security phase.

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
