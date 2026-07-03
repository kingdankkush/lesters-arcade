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

Chikun's Escape is the first third-party game being onboarded, but it is **not public-playable yet**. The public arcade card remains COMING SOON until Louie's actual game is integrated.

Developer harness:

1. Open the portal with `?devCabinets=1` (for example `/games?devCabinets=1`).
2. The Chikun cabinet becomes clickable and loads the reference SDK slice.
3. Public users without the flag see a desaturated COMING SOON cabinet and no leaderboard filter.

- **Manifest**: `games/chikun/game.manifest.json` (already created)
- **Cabinet art**: `apps/portal/assets/generated/chikun-cabinet/` (6 angle sprites)
- **Game registry**: `apps/portal/src/game-registry.mjs` (already registered)
- **Adapter pattern**: `apps/portal/src/game-adapter.mjs` (reference implementation)

### Chikun integration checklist
- [ ] Create `games/chikun/loader.mjs` — loads the Chikun game code
- [ ] Implement the game (one-button flappy-bird with Litecoin coin mechanic)
- [ ] Emit `arcade.ready` → `arcade.sessionStart` → `arcade.statUpdate` → `arcade.scoreSubmit` → `arcade.gameOver`
- [ ] Support both 9:16 (mobile portrait) and 16:9 (desktop/landscape)
- [ ] Pass security scan (no wallet access, no eval, no remote code)
- [ ] Flip `status` from `coming-soon` to `playable` in the manifest + registry
- [ ] QA playtest

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
