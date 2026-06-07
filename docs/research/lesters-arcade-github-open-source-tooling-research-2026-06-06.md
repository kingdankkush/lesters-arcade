# Lester's Arcade — GitHub / Open-Source Game Tooling Research

Date: 2026-06-06  
Project: Lester's Arcade / Hard Money Heroes  
Purpose: turn the provided GitHub/tool links into a practical stack, code-pattern notes, and workflow automation ideas for making the arcade run better, look better, and ship more consistently.

---

## Executive recommendation

**Do not switch engines yet.** Lester's Arcade is already a browser-first Web3 arcade with a vanilla Canvas prototype, asset manifests, test coverage, and a static Vercel-ready shape. The strongest path is:

1. **Keep the current custom Canvas runtime for the next playable pass.**
2. **Add better tools around it**: Aseprite/Pixelorama/PixiEditor for sprites, LDtk or Tiled for levels, Howler-style audio manifests, and automated asset validation.
3. **Evaluate Phaser in a small spike only after Level 1 gameplay proves the desired feel.** Phaser is the best web-native engine candidate if the custom runtime becomes too hard to maintain.
4. **Use open-source repos as references, not copy-paste sources**, unless license and integration fit are explicitly checked.
5. **Build a repeatable game-design pipeline**: design canon → asset brief → sprite/level/audio manifest → generated runtime files → unit tests → browser smoke → playable preview.

The best additions are not one giant engine. They are **a tighter asset/level/audio/workflow pipeline**.

---

## What was inspected

### Provided links by category

- Pixel art collections/topics:
  - `github.com/collections/pixel-art-tools`
  - `github.com/topics/pixelart`
  - `github.com/topics/pixel-art?l=c`
  - `github.com/Siilwyn/awesome-pixel-art`
- Pixel art tools:
  - `giventofly/pixelit`
  - `aseprite/aseprite`
  - `PixiEditor/PixiEditor`
  - `willibrandon/pixel-plugin`
- 2D engines/game-dev topics:
  - `github.com/topics/2d-game`
  - `github.com/topics/2d-game-development`
  - `github.com/topics/2d-game-engine`
  - `github.com/collections/game-engines`
  - `github.com/collections/javascript-game-engines`
  - `github.com/topics/2d-game?l=rust`
  - `github.com/topics/2d-game-development?l=c%2B%2B`
  - `bevyengine/bevy` discussion on 2D Bevy direction
- Example games / engines:
  - `dandacompany/deskrpg`
  - `gopxl/pixel`
  - `GarethIW/LDEngine`
  - `RunicIntern/Pixel-art-2D-game-Echo-of-the-Seven-`
  - `Yirade/SwordStone`
- Web3 games/tools:
  - `bitcraft3r/adventurer-island-web3-game`
  - `rofergon/Speed-Rush-2D`
  - `moonstream-to/awesome-web3-games`
  - `starton-io/awesome-web3-tools-and-dapps`
  - Medium Web3 repo list article
  - GitHub Community AI game-dev platform discussion
- General production tooling article:
  - GitHub Blog: “Beyond the engine: 10 open source projects shaping how games actually get made”

### Local Lester's Arcade context checked

Current repo has:

- Browser-first app at `apps/portal/`
- `apps/portal/src/arcade-core.mjs` canonical model / gameplay constants
- `tests/arcade-core.test.mjs` Node test coverage
- Existing asset pipeline scripts:
  - `scripts/slice-hmh-generated-assets.py`
  - `scripts/generate-hmh-hd-sprite-atlas.py`
  - `scripts/slice-lester-production-sprites.py`
  - `scripts/ingest-hard-money-heroes-user-assets.py`
  - `scripts/verify-generated-assets.mjs`
- Build/test scripts in `package.json`:
  - `npm test`
  - `npm run check`
  - `npm run assets:verify`
  - `npm run contracts:check`
  - `npm run vercel:build`

This means the project already has the right instinct: **manifest-first assets + tests + browser game shell**. The recommended additions should strengthen that, not replace it.

---

## Repo metadata snapshot

| Repo | Stars | Forks | Language | License signal | Updated | Usefulness for Lester's Arcade |
|---|---:|---:|---|---|---|---|
| `aseprite/aseprite` | 37.3k | 8.1k | C++ | EULA / mixed components | 2026-06-05 | Best professional pixel-art editor and CLI automation target; do not copy source blindly. |
| `PixiEditor/PixiEditor` | 7.8k | 311 | C# | LGPL-3.0 | 2026-06-05 | Strong open-source 2D editor alternative; useful for animation/vector/procedural workflows. |
| `giventofly/pixelit` | 1.7k | 247 | JavaScript | MIT | 2026-05-09 | Useful for browser-based image-to-pixel-art concept/palette experiments. |
| `Siilwyn/awesome-pixel-art` | 1.2k | 49 | curated list | CC0-1.0 | 2026-05-18 | Good inspiration and resource hub; not runtime code. |
| `gopxl/pixel` | 391 | 13 | Go | MIT | 2025-03-07 | Interesting native 2D library; low priority for browser/Web3 app. |
| `willibrandon/pixel-plugin` | 202 | 16 | Shell/plugin docs | MIT | 2025-10-19 | Strong reference for natural-language Aseprite export workflow; not directly a Hermes-native dependency. |
| `dandacompany/deskrpg` | 82 | 66 | TypeScript | no SPDX in API snapshot | 2026-05-29 | Valuable layered avatar registry + multiplayer/NPC task-board patterns. |
| `GarethIW/LDEngine` | 19 | 2 | C# | no SPDX in API snapshot | 2014-05-08 | Old but useful concepts: timers, tweening, pixel collision, game states, pooling. |
| `bitcraft3r/adventurer-island-web3-game` | 10 | 2 | JS/Solidity | no SPDX in API snapshot | 2023-04-18 | Very relevant simple Canvas + Web3 RPG demo; inspect patterns and pitfalls. |
| `moonstream-to/awesome-web3-games` | 20 | 8 | curated list | CC0-1.0 | 2025-02-03 | Market/genre reference list. |
| `starton-io/awesome-web3-tools-and-dapps` | 9 | 22 | curated list | Apache-2.0 | 2023-12-18 | Vendor/tool radar for wallets, RPC, indexing, security. |
| `Yirade/SwordStone` | 1 | 0 | C++ | no SPDX in API snapshot | 2023-06-21 | Useful learning/reference only; not a direct stack fit. |
| `rofergon/Speed-Rush-2D` | 0 | 0 | TypeScript/Unity/Solidity | MIT | 2025-01-17 | Useful as a Web3 portal + Unity WebGL bridge + leaderboard/economy reference. |
| `RunicIntern/Pixel-art-2D-game-Echo-of-the-Seven-` | 0 | 0 | docs/GDD | no SPDX in API snapshot | 2025-12-08 | Reference for structured GDD/worldbuilding, not runtime code. |

---

## Adopt / watch / skip recommendations

### Adopt now

#### 1. Aseprite-style export discipline

Use Aseprite as the default sprite workflow if available, especially because it supports:

- layers and frames as separate concepts,
- indexed palettes up to 256 colors,
- onion skinning,
- sprite sheet / GIF / PNG sequence export,
- tiled mode,
- Lua scripting,
- command-line automation.

**What to add to Lester's workflow:**

- Create a standard export spec:
  - transparent PNG frames,
  - nearest-neighbor scaling only,
  - consistent frame sizes,
  - JSON metadata per animation,
  - explicit frame durations,
  - named states: `idle`, `walk`, `run`, `jump`, `attack`, `hit`, `ko`, `boss-telegraph`, `boss-attack`, `boss-recover`.
- Add or extend scripts so every accepted sprite sheet becomes:
  - source copy in repo,
  - generated frame PNGs,
  - manifest JSON/module,
  - test coverage,
  - browser-visible runtime frame.

**Caution:** Aseprite's repo is source-available under its EULA/mixed component licenses. Use the official tool/CLI; do not copy source code into our project unless licensing is reviewed.

#### 2. Pixelorama / PixiEditor as open-source alternatives

Pixelorama appears strongly on GitHub topic pages as a powerful open-source pixel-art multitool for sprites, tiles, animations, and web/desktop use. PixiEditor is a more universal 2D editor with pixel, painting, vector, timeline, animation, and node/procedural features.

**Workflow use:**

- Aseprite = primary if purchased/installed.
- Pixelorama = free/open-source backup for sprites/tiles/animations.
- PixiEditor = optional for 2D art, animation, vector/raster mixing, and procedural experimentation.

#### 3. LDtk or Tiled for level design

The GitHub Blog article emphasized that engines are only part of shipping a game; level editors and asset pipelines matter. LDtk and Tiled are the two strongest level-design workflow additions.

**Recommended choice:**

- **LDtk first** if we want entity-driven maps, enums, clean JSON, and production-safe constraints.
- **Tiled** if we want maximum engine-agnostic maturity and broad loader support.

**What to add to Lester's Arcade:**

- A `levels/` source folder for LDtk/Tiled files.
- A `scripts/verify-levels.mjs` validator that checks:
  - collision layer exists,
  - spawn points exist,
  - scroll-lock pockets exist,
  - enemy spawn volumes have allowed archetypes,
  - boss gate trigger exists,
  - exit / return-to-arcade trigger exists.
- A runtime level-loader bridge that converts the editor JSON into the existing Canvas model.

This is one of the highest-leverage workflow upgrades because it turns level design from “manual code coordinates” into editable maps.

#### 4. Howler-style audio manifest

`Adventurer Island` used Howler for looped map music, battle music, hit SFX, fireball SFX, and victory stings. Lester's Arcade should formalize that idea.

**What to add:**

- `audio-manifest.json` / `audio-manifest.mjs` with:
  - `arcade-attract-loop`,
  - `cabinet-select-sting`,
  - `coin-in`,
  - `free-run-start`,
  - `official-run-start`,
  - `level-1-loop`,
  - `boss-warning`,
  - `boss-loop`,
  - `hit-player`,
  - `hit-enemy`,
  - `pickup`,
  - `game-over`,
  - `run-summary-count-up`,
  - `return-to-arcade`.
- Browser-safe audio unlock after player interaction.
- Tests that every manifest path exists.
- Volume groups: `music`, `sfx`, `ui`, `voice`.

#### 5. Pixelit as concept/palette helper, not production art replacement

`giventofly/pixelit` is MIT-licensed and converts images into pixel-art-ish output with scale and palette conversion. It is useful for fast experiments, not final sprite production.

**Best use:**

- internal tool page: “drop image → pixelate → apply Lester palette → export concept PNG.”
- generate rough cabinet art, background thumbnails, or quick mood-board conversions.

**Do not use it as the final art pipeline** unless an artist manually cleans the output. Pixelated photos can look cheap if dropped straight into the game.

---

### Watch / evaluate with small spikes

#### 1. Phaser

The current repo already says `recommendedGameEngine.primary = 'phaser-or-custom-canvas'`. The GitHub JavaScript game engine collection reinforces Phaser as the best full web-native 2D engine candidate.

**Why it fits:**

- browser-native,
- mature 2D game framework,
- Canvas/WebGL support,
- input, scene/state management, sprites, collisions, tilemaps,
- easier to connect with Web3 UI than Unity/Godot exports.

**When to switch:**

Only if custom Canvas becomes a bottleneck for:

- collisions,
- tilemap scrolling,
- scene transitions,
- particles,
- camera,
- input handling,
- animation state management.

**Suggested spike:** build a tiny Phaser `Hard Money Heroes` Level 1 scene with:

- one player,
- one enemy FSM,
- one LDtk/Tiled map,
- one pickup,
- pause/menu/exit-to-arcade,
- no Web3 writes.

If it feels better and remains easy to embed in the app shell, consider migration.

#### 2. PixiJS

PixiJS is a renderer/creation engine, not a full gameplay framework. It is excellent if we want fast 2D rendering while keeping our own gameplay systems.

**Use if:** rendering performance or visual polish becomes the bottleneck.

**Skip if:** we need full game-state/collision/tilemap help; Phaser is more complete.

#### 3. GDevelop / Godot / Unity WebGL

Good for prototyping or separate cabinet games, but not the default for the parent Lester's Arcade shell.

- GDevelop: fast no-code prototyping, web export, beginner-friendly.
- Godot: strong 2D, open source, good for stand-alone game development.
- Unity WebGL: useful if a future cabinet requires Unity physics/tooling.

**Main risk:** Web3 wallet integration and parent arcade profile sync become more complex when the game is an exported black-box runtime.

`Speed-Rush-2D` shows the split clearly: React/TypeScript portal + Unity WebGL game + contracts + backend services. That architecture can work, but it is heavier than Lester's current needs.

#### 4. DeskRPG layered avatar system

DeskRPG is not an arcade game, but its LPC-based character registry is highly relevant for future profile/avatar customization.

Inspected pattern:

- `public/assets/lpc-registry.json` uses categories, body types, variants, z-order, and layer paths.
- This is the right style for a future Lester's Arcade profile builder.

**Possible Lester version:**

- base body / jacket / hat / goggles / boots / weapon skin / aura,
- z-order and variants defined in a registry,
- profile avatar rendered as a composited canvas PNG,
- official leaderboards show the avatar thumbnail.

**Caution:** Do not import DeskRPG assets directly without license review.

---

### Skip for now

#### 1. Bevy / Rust engine path

Bevy and Rust 2D are interesting, but too heavy for the current goal. The project is Web3/browser-first and needs wallet/profile/cabinet UX more than a native Rust engine.

Use Rust/Bevy only if:

- we build a separate high-performance game later,
- the team has Rust capacity,
- WebAssembly packaging and wallet bridge are solved.

#### 2. Go `gopxl/pixel`

Strong small 2D library, MIT, and good for native Go games. Not a fit for a browser-first Web3 arcade unless we pivot to native desktop tooling.

#### 3. C/C++ examples as direct code sources

`SwordStone`, C pixel-art topic repos, and older engines can teach architecture, collision, sounds, or OOP patterns, but they do not fit the browser/Web3 deployment target.

#### 4. Full Web3 economy complexity from Speed Rush

Speed Rush includes car NFTs, parts, marketplace, repairs, prize distribution, AI-generated vehicles, IPFS storage, and multiple contracts/services.

For Lester's Arcade, this is too much for the next phase. Keep Web3 simple:

- wallet identity,
- paid run receipt,
- official score claim,
- achievements,
- leaderboards,
- tournament pools later.

---

## Selected code-pattern takeaways

### Adventurer Island — Canvas + Web3 RPG demo

Relevant inspected files:

- `game/index.js`
- `game/classes.js`
- `game/helpers/audio.js`
- `game/helpers/nft.js`
- `contracts/adventurer.sol`

Good patterns:

- Canvas locked to a known 16:9 size (`1024x576`).
- Collision and battle-zone arrays are converted into 2D maps.
- Boundaries are generated from map symbols.
- Sprite class supports animation frames with a `hold` duration.
- Monsters extend sprite behavior and carry health, damage, drops, attacks, XP, and gold.
- Audio is separated into a central object with loops and one-shot SFX.
- Wallet/NFT stats are used to affect in-game character creation.

Pitfalls to avoid:

- Global variables and script-order dependency can become brittle.
- NFT loading has a duplicated-load TODO.
- Web3 chain-switching code had a stray `params` reference in the inspected snippet.
- Sequential token fetching can become slow.
- Hardcoded map offsets and dimensions become painful unless moved into map metadata.
- README notes mobile/resolution issues and difficulty spikes.

Lester application:

- Keep the good pieces: central audio, sprite animation model, collision/battle zones, NFT/wallet-to-character idea.
- Avoid the brittle pieces: globals, hardcoded offsets, unbounded loops, direct official writes from gameplay code.

### Speed Rush 2D — Web3 portal + game bridge pattern

Relevant inspected files:

- `src/providers/Web3Provider.tsx`
- `src/services/web3Service.ts`
- `src/components/Leaderboard.tsx`
- `src/components/UnityGame.tsx` appeared empty/blank in the inspected content.

Good patterns:

- React/TypeScript app shell.
- Wallet/provider abstraction through `wagmi`, `ConnectKit`, `ethers`, and custom chain config.
- Web3 services are separated from UI components.
- Dedicated pages/components for profile, marketplace, leaderboard, game page, car gallery, and inventory.
- Unity WebGL bridge files exist under `Assets/WebGLTemplates` and `public/Build`.

Pitfalls to avoid:

- Pulling all leaderboard records by incrementing token IDs until failure is not scalable.
- Marketplace/repair/NFT-part economy is too heavy before the core game is fun.
- Unity WebGL build payloads complicate static deployment and browser load.
- Some code comments/config reference different networks/ecosystems, which can confuse product identity.

Lester application:

- Use the service separation concept.
- Keep leaderboards paginated/indexed rather than scanning on-chain sequentially from the browser.
- Keep the parent arcade shell independent of any child game engine.

### DeskRPG — layered avatar/profile architecture

Relevant inspected files:

- `package.json`
- `public/assets/lpc-registry.json`

Good patterns:

- Character customization is registry-driven.
- Layers have z-order (`zPos`) and paths by body type.
- Variants are explicit.
- The app combines a 2D map, multiplayer presence, chat, AI NPCs, and task states.

Lester application:

- Future profile avatars should be registry-driven, not one-off uploads only.
- NPC/AI task-board ideas could inspire an “Arcade Repair Shop” or “Lester's Workshop” mode where automation tasks appear as in-world NPC jobs.

### Pixel plugin — export workflow pattern

Relevant inspected files:

- `commands/pixel-export.md`
- `skills/pixel-art-exporter/export-formats.md`

Useful export ideas:

- PNG/GIF/spritesheet/JSON export modes.
- Nearest-neighbor scale options: 2x, 4x, 8x.
- Spritesheet layouts: horizontal, vertical, grid, packed.
- Padding/trim options.
- JSON metadata formats for Unity/Godot/Phaser.
- Palette and transparency rules.

Lester application:

Create our own asset-export spec and maybe a Hermes-friendly command/checklist, even if we do not use Claude Code or this plugin directly.

### LDEngine / older engine concepts

Useful concepts:

- timers,
- tweening,
- sprite animation classes,
- particles,
- camera rotation/zoom/shake,
- game states,
- pooling,
- per-pixel collision.

Lester application:

- Add small, data-driven helpers before adopting a large engine:
  - `TimerController`,
  - `TweenController`,
  - `ParticleSystem`,
  - `GameStateMachine`,
  - `EntityPool`.

---

## Recommended Lester's Arcade tool stack

### Current foundation

Keep:

- Static browser app / Canvas runtime for the current playable prototype.
- Canonical model in `arcade-core.mjs`.
- Node unit tests.
- Asset generation and verification scripts.
- Static Vercel preview build gate.

### Add next

| Area | Recommended addition | Why |
|---|---|---|
| Sprite authoring | Aseprite, with Pixelorama/PixiEditor backup | Better animation workflow, indexed palettes, onion skinning, CLI export. |
| Level design | LDtk first, Tiled as fallback | Designer-editable maps, collision layers, spawn volumes, scroll-lock pockets. |
| Audio | Howler-like manifest and runtime wrapper | Browser-safe music/SFX loops, volume groups, easy verification. |
| Gameplay architecture | Data-driven FSMs and state machines | Enemy AI and boss patterns become testable and tunable. |
| Browser QA | Playwright smoke tests | Verify wallet/profile → cabinet → mode → game → pause → exit → arcade. |
| Asset QA | Palette/frame/manifest validators | Prevent broken sprites, wrong frame sizes, missing alpha, missing audio. |
| License QA | Source/license register | Avoid accidentally importing incompatible assets/code. |
| Tool radar | Monthly GitHub watchlist doc | Keep finding useful tools without random stack churn. |

### Evaluate later

| Candidate | Use only if... |
|---|---|
| Phaser | Custom Canvas becomes too hard for tilemaps/collisions/scene management. |
| PixiJS | Rendering polish/performance is the bottleneck but we want custom game logic. |
| Godot/GDevelop | We want to prototype a separate cabinet quickly and can tolerate export-bridge complexity. |
| Unity WebGL | A future cabinet needs Unity-specific workflows/physics, not for current Hard Money Heroes MVP. |
| Bevy/Rust | We decide to build a separate high-performance game and have Rust/WebAssembly capacity. |

---

## Foundational design ideas to improve the game

### Art

1. **One fixed visual grammar.** Pick a limited palette, sprite scale, outline rule, shadow rule, and VFX language.
2. **Readable silhouettes first.** Lester, enemies, bullets, pickups, hazards, and bosses must be identifiable at game speed.
3. **Functional color language.** Use silver/blue for Lester/trust/safe/official; red-orange/magenta for enemy danger/scams/hazards; yellow/green for pickups/rewards.
4. **Sprite budgets.** Define standard sizes:
   - player: e.g. 48–64 px logical frame,
   - small enemies: 32–48 px,
   - large enemies: 64–96 px,
   - bosses: 128+ px with readable telegraph zones.
5. **Layered backgrounds.** Each level should have foreground, midground, background, and parallax layers. Background detail should never obscure bullets/enemies.
6. **Cabinet art matters.** The arcade shell needs cabinet marquees, attract loops, and a satisfying selected-cabinet state.

### Animation

1. **Animation states are gameplay states.** Every enemy should have `idle → telegraph → attack → recover → hit → KO`.
2. **Telegraphs must be longer than the attack.** Players should feel they failed because they read late, not because the game cheated.
3. **Frame timing is data.** Store frame durations in manifests, not hidden in renderer magic numbers.
4. **Juice pass after mechanics.** Add squash/stretch, recoil, hit flash, particles, screen shake, and pause frames after the collision/score rules are stable.
5. **Contact-sheet reviews.** Every new sprite batch should produce a contact sheet so bad frames are caught before runtime.

### Sound

1. **Audio states mirror game states.** Arcade attract, cabinet select, free run, official run, boss warning, boss fight, game over, run summary, return-to-arcade.
2. **SFX must teach mechanics.** Pickups, official credit spend, enemy telegraph, player damage, boss phase, and leaderboard submission need distinct sounds.
3. **Short UI stings beat long noise.** Arcade UX should feel responsive without drowning the player.
4. **Mute/music/SFX controls are first-class.** Add them in pause and settings.
5. **Use silence intentionally.** Brief drops before boss attacks or official score submission can create tension.

### Functionality

1. **Strict Free vs Official separation.** Free Practice remains local/no-write. Official Run has clear entry, receipt, leaderboard eligibility, and summary.
2. **Every run ends with a useful summary.** Score, kills, boss progress, accuracy, damage taken, coins/pickups, achievements, and next recommended action.
3. **Exit flow is part of the product.** Player should be able to pause → game menu → exit game → return to cabinet/arcade without page reload confusion.
4. **Cabinet shell owns identity.** Game code should not own wallet/profile logic directly. Parent shell owns account, mode, receipts, leaderboards.
5. **Child games expose events.** `gameStarted`, `scoreChanged`, `achievementUnlocked`, `gameOver`, `exitRequested`, `officialScoreReady`.
6. **Leaderboard trust copy.** Official run summaries should explain why a score is eligible and what was or was not written.
7. **Mobile/responsive stance.** Even if desktop is primary, set a clear minimum viewport and fallback message so the game does not feel broken.

---

## Workflow automation to introduce

### 1. Open-source intake workflow

Add a simple recurring process:

1. Collect links in `docs/research/open-source-tool-radar.md`.
2. Record repo metadata: stars, license, language, update date, fit, risks.
3. Classify: `adopt`, `watch`, `skip`, `spike`.
4. For `adopt/spike`, inspect selected files and write code-pattern notes.
5. Only install dependencies after explicit stack decision.

### 2. Asset pipeline gate

Current project already has `assets:verify`. Extend the idea:

- verify PNG signatures,
- verify dimensions,
- verify transparent backgrounds for sprites,
- verify palette compliance,
- verify frame count per animation,
- verify frame duration metadata,
- verify no source paths point to Downloads/temp folders,
- verify audio paths exist,
- verify level JSON has required layers/entities.

### 3. Aseprite/Pixelorama export standard

Create `docs/workflows/pixel-art-export-spec.md` and require every accepted sprite to define:

- source file,
- license/owner,
- palette,
- intended runtime role,
- frame grid,
- animation states,
- loop flags,
- frame durations,
- export path,
- generated manifest path.

### 4. Level editor validation

When LDtk/Tiled is introduced, add a validator that rejects maps missing:

- player spawn,
- safe intro zone,
- collision layer,
- enemy spawn zones,
- scroll-lock gates,
- boss arena,
- exit/return trigger,
- parallax layer references.

### 5. Gameplay tuning simulator

Add a Node test/simulation for enemy waves:

- spawn cadence,
- max enemies on screen,
- bullet density,
- time-to-kill,
- health lost per hit,
- pickup frequency,
- score rate,
- boss entrance timing.

This lets us tune “addictive but fair” loops without guessing from one playthrough.

### 6. Browser smoke tests

Add Playwright or a lightweight browser-smoke workflow for:

1. splash loads,
2. mock wallet fallback works,
3. profile shell appears,
4. cabinet select opens,
5. Free Practice starts without wallet write,
6. Official Run path shows entry/eligibility copy,
7. game canvas mounts,
8. pause menu opens,
9. game menu returns to mode select,
10. exit game returns to arcade shell,
11. no console errors.

### 7. License/source register

Every imported asset/tool/code reference should have:

- source URL,
- license,
- allowed use,
- attribution needed,
- commercial-safe status,
- whether copied into repo or just referenced.

This is especially important because pixel-art repos often mix code licenses and asset licenses.

### 8. GitHub Actions / preview build gate

Once the repo is on GitHub, add CI that runs:

```bash
npm run assets:verify
npm test
npm run check
npm run contracts:check
npm run vercel:build
```

Later add:

```bash
npm run levels:verify
npm run audio:verify
npm run license:scan
npm run smoke:browser
```

---

## Specific backlog for Lester's Arcade

### Highest-impact next implementation pass

1. **Create an audio manifest and basic Howler-like wrapper.**
2. **Add run-summary screen improvements.** Make exit/return-to-arcade feel complete.
3. **Add enemy FSM data model.** At minimum: one goblin/rusher, one turret, one boss phase pattern.
4. **Add level pocket model.** Define intro, wave pocket, shop/brief pause, mini-boss gate, boss arena, exit.
5. **Add an asset export spec doc.** Make future art drops consistent.
6. **Add `open-source-tool-radar.md`.** Keep these GitHub findings maintainable.
7. **Plan a tiny LDtk/Tiled spike.** Do not migrate all levels yet; prove one level section loads.

### Tooling backlog

- `docs/workflows/pixel-art-export-spec.md`
- `docs/workflows/level-editor-pipeline.md`
- `docs/workflows/audio-manifest-pipeline.md`
- `docs/research/open-source-tool-radar.md`
- `scripts/verify-audio-assets.mjs`
- `scripts/verify-levels.mjs`
- `scripts/verify-pixel-style.mjs`
- `tests/enemy-ai.test.mjs`
- `tests/level-director.test.mjs`
- optional `playwright` smoke tests after package/project setup approval

---

## Final stack decision

For the next Lester's Arcade / Hard Money Heroes phase:

- **Runtime:** keep custom Canvas.
- **Potential engine spike:** Phaser only.
- **Renderer spike:** PixiJS only if visual/performance bottleneck appears.
- **Sprite tool:** Aseprite primary; Pixelorama/PixiEditor backups.
- **Image-to-pixel concept helper:** Pixelit.
- **Level tool:** LDtk first; Tiled fallback.
- **Audio:** Howler-style manifest/wrapper.
- **Web3:** continue parent-shell-controlled wallet/profile/offical-run model; do not copy heavy marketplace/NFT economy patterns yet.
- **Automation:** expand the existing manifest/test/build pipeline rather than adopting a huge toolchain.

The fastest path to a better game is not “more repos.” It is **better constraints, better manifests, better level editing, better enemy state machines, and better browser smoke tests**.
