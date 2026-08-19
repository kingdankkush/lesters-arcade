# Lester's Arcade — Third-Party Game SDK Onboarding Guide

This guide walks a third-party game developer through integrating a game into
Lester's Arcade as a sandboxed cabinet. It covers the SDK contract, manifest
schema, security requirements, and step-by-step onboarding.

## 1. Overview

Lester's Arcade is a parent portal that owns wallet identity, profiles,
leaderboards, and on-chain settlement. Games run as child cabinets that
request actions through the SDK — they never touch the wallet directly.

**Architecture:**
```
Player → Lester's Arcade (parent) → Sandboxed iframe (game cabinet)
                ↑                            ↓
        Wallet / Profile /         arcade.* events via postMessage
        Leaderboard / Chain        (scoreSubmit, achievement, etc.)
```

## 2. SDK Contract

### Lifecycle methods
The parent calls these on the game via `postMessage`:
- `init(ctx)` — game receives context (gameId, profile snapshot, mode)
- `start` — game begins a session
- `pause` / `resume` — parent requests pause/resume
- `end` — parent requests game end (e.g. timeout)
- `teardown` — game cleans up
- `resize` — viewport changed

### Event schema (game → parent)
Games emit these events via `postMessage` to the parent:
| Event | When | Payload |
|---|---|---|
| `arcade.ready` | Game loaded, ready to start | `{ gameId }` |
| `arcade.sessionStart` | Session begins | `{ gameId, mode, characterId }` |
| `arcade.statUpdate` | Periodic stats | `{ gameId, score, kills, survived }` |
| `arcade.achievement` | Achievement unlocked | `{ gameId, achievementId }` |
| `arcade.scoreSubmit` | Final score submission | `{ gameId, score, ...runStats }` |
| `arcade.gameOver` | Game over | `{ gameId, score, kills, survived }` |
| `arcade.requestWalletAction` | Request wallet op (connect/submitRanked) | `{ kind, ... }` |

### Security rules
- Game runs in sandboxed iframe with `allow-scripts` only (no `allow-same-origin`)
- Game NEVER has access to `window.ethereum`, wallet provider, or private keys
- All wallet operations go through `arcade.requestWalletAction`
- Parent validates every inbound message (schema + rate limit + source tag)
- Game code is static-scanned before onboarding (no eval, no remote code, no drainer patterns)

## 3. Game Manifest

Every cabinet ships a `game.manifest.json`:

```json
{
  "id": "chikun",
  "name": "Chikun's Escape",
  "version": "1.0.0",
  "sdkVersion": "1.0.0",
  "status": "coming-soon",
  "developer": "Your Name",
  "description": "Game description...",
  "genre": "one-button-arcade",
  "aspectSupport": ["9:16", "16:9"],
  "controlScheme": "touch-tap",
  "capabilities": ["scoreSubmit", "leaderboards"],
  "rankedEligible": true,
  "endpoints": {
    "loader": "games/chikun/loader.mjs",
    "assets": "./assets/generated/chikun-cabinet/"
  },
  "checksum": null
}
```

### Required fields
- `id` — unique slug (lowercase, hyphenated)
- `name` — display title
- `version` — semver
- `sdkVersion` — must match `ARCADE_SDK_VERSION` ("1.0.0")
- `aspectSupport` — must support both 9:16 and 16:9
- `controlScheme` — one of: `touch-tap`, `touch-twin-stick`, `keyboard-mouse`, `hybrid`
- `capabilities` — what the game needs: `scoreSubmit`, `leaderboards`, `achievements`
- `rankedEligible` — can this game participate in ranked/paid runs?

## 4. Onboarding Steps

1. **Create your game manifest** — copy the template above, fill in your game's details
2. **Implement the SDK adapter** — use `createInProcessGameAdapter` from `apps/portal/src/game-adapter.mjs` as a reference. For sandboxed iframe mode, use `postMessage` with the `arcade.*` event schema
3. **Build your game loader** — create `games/<your-game>/loader.mjs` that initializes your game
4. **Test locally** — open `apps/portal/dev/mock-parent-harness.html` from the portal dev server, point it at your `games/<your-game>/main.mjs`, and verify `arcade.ready`, session events, malformed-message rejection, flood-drop behavior, and wallet isolation
5. **Security review** — run `npm run design:third-party-security` and ensure your candidate code passes the static review for:
   - No `window.ethereum` or wallet provider access
   - No `eval()` or `Function()` constructors
   - No remote code loading (no `import()` from external URLs)
   - No undeclared network endpoints
   - No drainer patterns (transaction signing, approval requests)
6. **Register your game** — submit your manifest + loader to the Lester's Arcade registry
7. **QA pass** — playtest on desktop + mobile, verify scores submit correctly

## 5. Chikun's Escape — Reference Implementation

Chikun's Escape is the first third-party game onboarded through Cabinet SDK v1, and it is **public-playable and Ranked-eligible**. It cleared the public gate in Cycle 057 and is no longer behind a developer flag.

Current canonical state:

| Source of truth | Field | Value |
| --- | --- | --- |
| `apps/portal/games/chikun/game.manifest.json` | `status` | `playable` |
| `apps/portal/games/chikun/game.manifest.json` | `rankedEligible` | `true` |
| `apps/portal/games/chikun/game.manifest.json` | `version` / `runtimeVersion` | `0.5.0` / `canvas-runtime-v3` |
| `apps/portal/src/arcade-core.mjs` | cabinet `status` / `playable` / `leaderboardEligible` | `playable` / `true` / `true` |
| `apps/portal/src/game-registry.mjs` | `status` | `live` |

Public users see a clickable cabinet, the Free and Ranked mode select, and a Chikun leaderboard filter. No query flag is required. `?devCabinets=1` still exists in `apps/portal/main.js`, but it now only unlocks cabinets whose cartridge sets `devPlayable` without `playable`; it is not Chikun's gate.

Shipped since the public flip: parent-owned UTC daily seed with same-seed ghost projection, and a seek-safe animated replay viewer on the result screen. Both are presentation-only and cannot alter a canonical score.

What is still open on Chikun is commercial, not technical: `devWallet` is `null` in both the manifest and the registry, so asset rights, the creator wallet, and the revenue split remain unresolved. Those are owner decisions, not launch gates that were skipped.

- **Manifest**: `apps/portal/games/chikun/game.manifest.json` (canonical)
- **Cabinet art**: `apps/portal/assets/generated/chikun-cabinet/` (6 angle sprites)
- **Game registry**: `apps/portal/src/game-registry.mjs` (already registered)
- **Adapter pattern**: `apps/portal/src/game-adapter.mjs` (reference implementation)

### Chikun integration checklist
- [x] Create the canonical `apps/portal/games/chikun/` loader and manifest path
- [x] Implement the deterministic reference vertical slice and parent replay verification
- [x] Emit the parent SDK session/score/game-over path without direct wallet access
- [x] Pass the third-party security and public cabinet regression gates
- [x] Flip `status` to `playable` and `rankedEligible` to `true` after the public-launch gates passed (Cycle 057)
- [x] Port the playable game into the sandboxed cabinet runtime at `0.5.0` / `canvas-runtime-v3`
- [x] Ship the daily UTC seed, same-seed ghost, and seek-safe animated replay viewer
- [ ] Visually certify 16:9 play (`aspectSupport` declares both, but only 9:16 has certification evidence in `tests/`)
- [ ] Replace temporary mode-selection art and complete production gameplay art
- [ ] Complete Louie/Justin QA and resolve asset rights, creator wallet (`devWallet` is still `null`), and revenue split

### Chikun art production request

Already preserved in the external Lester asset vault:

- `chikun-coast.png`, `chikun-flap.png`, and `chikun-fall.png`: 2752×1536 RGB character illustrations flattened over a dark gray matte
- `bigcorp-tower.png`: 2752×1536 RGB tower art with white side gutters
- Six transparent 400×531 cabinet-rotation frames
- The 135-second source soundtrack

Do not resend those unless cleaner layered or transparent masters exist. The current 2400×525 mode-select atlas is a dev-only derivative. Public approval and written commercial-use, modification, hosting, and redistribution rights remain pending.

Immediate selection-screen replacements:

1. **Free Mode banner**: 2400×1050 layered master; 1200×525 WebP export, sRGB, ≤180 KiB. Chikun flying free in cyan/blue daylight with open sky. Keep action inside the center 80%. No baked UI, wallet, token, score, or leaderboard claims.
2. **Ranked banner**: 2400×1050 layered master; 1200×525 WebP export, sRGB, ≤180 KiB. Chikun pushing toward Big Corp with gold/red/magenta pressure lighting. Do not imply gambling, rewards, NFTs, verified settlement, or on-chain publishing.
3. **Mode-selection backdrop**: 2560×1440 layered master; 1600×900 WebP export, sRGB, ≤350 KiB. Corporate city/industrial escape scene with dark center/lower-middle negative space for cards. It must survive desktop, tablet, portrait-phone, and landscape-phone `background-size: cover` crops.
4. **Logo lockup**: horizontal transparent SVG plus 1600×500 PNG fallback, in full-color and white/knockout variants, with no baked glow, shadow, or background plate.

Gameplay P0 art:

- Coast/idle flight: 6–8 transparent frames
- Flap/impulse: 4–6 frames
- Hit/shield impact: 4–6 frames
- Fall/death: 6–8 frames
- Optional boss-clear/victory: 6–8 frames
- Preferred 512×512 source cells with documented pivot, order, and FPS
- Modular top/bottom Big Corp towers with at least three variants and a sliding-panel variant
- Litecoin coin eight-frame spin
- Shield, Magnet, and Slowmo pickup icons at 128×128 transparent masters
- Standard drone, missile, and telegraph art
- Big Corp Helicopter, Drone Swarm, and The CEO encounter art

Four P0 parallax environment sets, each with separable sky/cloud, far skyline, near skyline/tower, and optional foreground atmosphere layers on a 2560×1440 master:

- **The Yard**: urban daylight and industrial/corporate confinement
- **Corporate Heights**: purple/orange sunset and lit elevated towers
- **Blue Hour**: indigo city, magenta accents, moving towers, drones, and panels
- **Midnight**: near-black sky, cyan city lights, maximum neon contrast

P1 art:

- Skins: Chikun/default, Neon, 24 Karat, Ice, Trollbox, Shadow, Inferno
- Trails: Standard, Neon, Gold, Cyan, Rainbow
- Ten 256×256 achievement-badge masters
- Four zone-entry emblems, boss-warning frame/icon, pause/game-over/run-summary/unlock panels, and Chikun-specific leaderboard stat icons

Delivery requirements:

- Include creator/source attribution and disclose whether AI tools were used
- Use clean alpha without matte halos, sRGB, and no remote runtime dependencies
- Keep accessible UI copy in HTML rather than baking it into art
- Keep masters in the asset vault and commit only optimized runtime derivatives
- Initial Chikun code plus critical visuals target ≤1.5 MiB; total payload target ≤4 MiB; optional soundtrack target ≤2 MiB

## 6. Mock Parent Harness

External developers can validate a cabinet without touching the real parent runtime:

1. Run the portal dev server (`npm run serve` from `apps/portal` or serve `apps/portal` over any local HTTP server).
2. Open `/dev/mock-parent-harness.html`.
3. Enter the candidate entry path, e.g. `../games/hard-money-heroes/main.mjs` or `../games/<your-game>/main.mjs`.
4. Run the buttons for Free, Ranked, malformed-message rejection, flood drop, and wallet isolation.
5. Only after the harness and `npm run design:third-party-security` pass should a cabinet request ranked review.

Hard Money Heroes now dogfoods the same sandbox manifest path at `apps/portal/games/hard-money-heroes/game.manifest.json` with entry `./main.mjs` and `sandbox.allow = ["scripts"]`.

## 7. SDK Module Reference

- **SDK contract**: `apps/portal/src/arcade-sdk.mjs` — event schema, validators, rate limiter
- **Game manifest**: `apps/portal/src/game-manifest.mjs` — manifest validation, registry
- **In-process adapter**: `apps/portal/src/game-adapter.mjs` — reference adapter (transitional)
- **Game registry**: `apps/portal/src/game-registry.mjs` — runtime game registration
- **Tests**: `tests/arcade-sdk.test.mjs`, `tests/game-adapter.test.mjs`

## 7. Questions?

Contact Justin at kingdankkush420@gmail.com or through the Lester's Arcade GitHub repo.
