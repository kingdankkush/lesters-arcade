# Cabinet SDK v1 — Lester's Arcade

**Status:** WO-54 local extraction complete when tests pass.  
**Scope:** Pure, DOM-free SDK primitives plus in-process adapters used by current first-party cabinets. Sandboxed iframe transport can sit on the same event contract later.

## Public surface

`apps/portal/src/arcade-sdk.mjs`

- `ARCADE_SDK_VERSION`
- `SDK_LIFECYCLE_METHODS`
- `SDK_EVENTS`
- `buildInitContext()`
- `buildArcadeMessage()`
- `validateEventPayload()`
- `parseInboundMessage()`
- `createMessageRateLimiter()`
- `authorizeRankedSubmit()`

`apps/portal/src/game-adapter.mjs`

- `CABINET_SDK_V1_PUBLIC_EXPORTS`
- `createInProcessGameAdapter()`
- `createTemplateCabinetAdapter()`
- `createHardMoneyHeroesCabinetAdapter()`

## Security rule

A cabinet never receives a provider, signer, private key, full wallet write access, or direct official-state writer. The parent passes display-only identity in `buildInitContext()` and validates every `arcade.*` message through `parseInboundMessage()` before acting.

WO-129 postMessage hardening is two-layered:

1. **Browser transport gate:** parent shells should call `parsePostMessageEvent(event, { expectedSourceWindow, expectedOrigin, expectedGameId })` or perform the same checks before parsing. `event.source` must be the sandboxed iframe's `contentWindow`; `event.origin` must match the known embedding/cabinet origin when known.
2. **SDK payload gate:** after source/origin pass, the payload still must pass source-tag, SDK-major, game-id, event-name, and schema validation through `parseInboundMessage()`.

Cabinets must avoid wildcard posting once the parent origin is known. First-party cabinets resolve an explicit target origin from the parent handshake/referrer via `resolveParentTargetOrigin()` and fail closed if no origin is available.

## Template cabinet

Reference files:

- `apps/portal/games/template-cabinet/game.manifest.json`
- `apps/portal/games/template-cabinet/main.mjs`

The template is `disabled` so it does not render on the public arcade floor. Copy it for new cabinets and change the manifest id/name/entry/status.

## HMH adapter proof

`createHardMoneyHeroesCabinetAdapter()` binds the current in-process Hard Money Heroes runtime to the same SDK events a future iframe cabinet will emit:

1. `arcade.ready`
2. `arcade.sessionStart`
3. `arcade.statUpdate`
4. `arcade.achievement`
5. `arcade.scoreSubmit`
6. `arcade.gameOver`

WO-55 should build Chikun's Escape against this same adapter path instead of adding another one-off parent integration.
