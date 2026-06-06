# Lester's Arcade — Build Stack, LitVM, dappit, and Engine Direction

## Short answer

The prototype is **not currently built on Godot**.

The current build is a **browser-first Web3 dApp prototype**:

- Portal: vanilla HTML/CSS/JavaScript
- Gameplay surface: Canvas/Web Canvas prototype
- State model/tests: JavaScript modules + Node test runner
- Smart-contract MVP rails: Solidity skeletons compiled locally
- Target Web3 network: LitVM
- Smart-contract helper candidate: dappit.io, because of the LitVM partnership angle

## Why web-first right now

For the hackathon/prototype stage, browser-native is the simplest path because the same app can handle:

1. wallet login and parent profile UX
2. cabinet/game selection
3. Canvas gameplay
4. free vs paid session simulation
5. high-score/achievement syncing
6. future dappit/LitVM smart-contract calls

A dedicated game engine can still be used later, but a web-first prototype keeps the dApp side from becoming an integration problem too early.

## Recommended path

### Current prototype

- **Engine:** Web Canvas
- **Framework:** vanilla HTML/CSS/JS
- **Purpose:** prove UX, game loop direction, parent account system, and Web3 rails.

### Next playable vertical slice

Use either:

- **Phaser 3** for faster side-scroller gameplay features, collision, animation, input, camera, particles, and tilemaps.
- **Custom Canvas** if the design stays lightweight and we want maximum control.

### Optional later

- **Godot HTML5 export** can be explored later if game production needs a more visual editor, scene system, animation tools, and designer-friendly workflows.
- Godot is not the fastest path for the Web3 wallet/hackathon dApp layer unless the game becomes large enough to justify the engine integration overhead.

## Where dappit.io could fit

dappit.io should be evaluated for the Web3 smart-contract side, especially if they are partnered with LitVM and the hackathon rewards submissions aligned with their tooling.

Potential dappit-assisted contract rails:

- Player profile registry
- Game/cabinet registry
- Paid-session receipt/router
- Score submission registry
- Achievement registry
- Tournament/reward pool
- Developer revenue split routing

The gameplay should remain off-chain/local for MVP. Contracts should store session receipts, score claims, achievements, and tournament/reward accounting.

## Hackathon submission framing

Position Lester's Arcade as:

> A LitVM-powered retro arcade portal where one wallet account controls cross-game identity, paid session receipts, official leaderboards, achievements, and future tournament/revenue rails across multiple Web3 cabinet dapps.

## Build principle

**Do not over-engineer the engine before the hackathon pitch is validated.**

First target:

- polished portal UX
- clear cabinet selection
- one fun Hard Money Heroes vertical slice
- strong smart-contract architecture
- dappit/LitVM alignment
- testable free/paid score and achievement flows
