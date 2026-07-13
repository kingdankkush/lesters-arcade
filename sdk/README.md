# Lester's Arcade Cabinet SDK v1

This is the clean-room integration path for a new Lester's Arcade cabinet. A cabinet owns gameplay only. The parent portal owns wallet identity, profiles, official score authorization, leaderboards, and any approved chain interaction.

## Start here

1. Copy `apps/portal/games/template-cabinet/` to `apps/portal/games/<game-id>/`.
2. Edit `game.manifest.json`.
3. Implement `main.mjs` and emit the `arcade.*` event lifecycle below.
4. Add a lazy loader at `apps/portal/src/games/<game-id>/loader.mjs`.
5. Register manifest metadata in the parent registry. Keep `status: "coming-soon"` until QA approves public play.
6. Run the gates in **Validate**.

Use lowercase hyphenated IDs. Do not add wallet code to a cabinet.

## Manifest schema

Required fields:

| Field | Contract |
| --- | --- |
| `id` | Unique lowercase slug |
| `name` | Player-facing title |
| `version` | Cabinet semver |
| `sdkVersion` | `1.0.0` |
| `status` | `disabled`, `coming-soon`, or `playable` |
| `aspectSupport` | Include `9:16` and `16:9` |
| `controlScheme` | `tap`, `touch-tap`, `touch-twin-stick`, `keyboard-mouse`, or `hybrid` |
| `capabilities` | Requested parent capabilities only |
| `rankedEligible` | `false` until Ranked review passes |
| `entry` | Relative static entry module |
| `endpoints` | Declared network endpoints; empty by default |

Optional orientation metadata may declare a preferred orientation, but both required aspect ratios must remain usable. `rankedEligible` is an eligibility request, not permission to write official state.

## Lifecycle

The parent controls:

`init → start → pause/resume → end → teardown`

The parent may call `resize` whenever the viewport or orientation changes. A cabinet must reflow without reloading or resetting its active run.

A normal cabinet emits:

`arcade.ready → arcade.sessionStart → arcade.statUpdate* → arcade.scoreSubmit? → arcade.gameOver`

Build messages with `buildArcadeMessage()` or use `createInProcessGameAdapter()` for an in-process cabinet. The parent validates source, SDK version, game ID, sequence, event type, and payload.

## Score-submit adapter contract

`arcade.scoreSubmit` requests parent authorization. It does not write a leaderboard or send a transaction by itself.

Required payload:

```json
{ "score": 1200, "survivalTime": 180 }
```

The parent binds the request to its current session identity and decides whether the run is practice-only, local Ranked preview, or eligible for a separately approved verified settlement path. Cabinets never receive a signer or raw wallet provider.

## Two-layer security model

1. **Browser isolation:** third-party cabinets run in an iframe with `sandbox="allow-scripts"`; never add `allow-same-origin`.
2. **Message authorization:** the parent validates every `postMessage`, rate-limits floods, rejects unknown origins/sources/game IDs, and mediates wallet requests.

Forbidden in cabinet code:

- `window.ethereum`, seed phrases, private keys, or direct signing
- `eval`, `Function`, remote script imports, or undeclared endpoints
- ERC-20 approvals, arbitrary transaction payloads, or drainer patterns
- parent DOM access or assumptions about same-origin storage

Use `arcade.requestWalletAction` for the narrow actions documented by the SDK. The parent may reject any request.

## Development visibility

A registry manifest with `status: "coming-soon"` appears as a disabled **COMING SOON** card. It becomes clickable only behind `?devCabinets=1`; it must not enter public leaderboard filters until playable.

Serve the portal directory as the web root:

```bash
cd apps/portal
python -m http.server 8791 --bind 127.0.0.1
```

Open `http://127.0.0.1:8791/?devCabinets=1`, not a `file://` path and not `/apps/portal/` from the repository root.

The sandbox message harness is at `http://127.0.0.1:8791/dev/mock-parent-harness.html`.

## Validate

From the repository root:

```bash
node --test tests/sdk-clean-room.test.mjs tests/arcade-sdk.test.mjs tests/game-adapter.test.mjs
npm run design:third-party-security
npm run smoke:portal:interactions
npm test
npm run check
```

A Ranked-capable cabinet additionally requires threat review, deterministic session evidence, integrity bounds, mobile/desktop playtest evidence, and explicit operator approval. No SDK integration alone enables chain writes.

## Reference files

- `apps/portal/games/template-cabinet/game.manifest.json`
- `apps/portal/src/arcade-sdk.mjs`
- `apps/portal/src/game-adapter.mjs`
- `apps/portal/src/game-manifest.mjs`
- `apps/portal/dev/mock-parent-harness.html`
- `docs/THIRD_PARTY_GAME_ONBOARDING.md`
