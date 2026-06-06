# Lester's Arcade — UI Quality, Branding, Tooltips, and Controls Guide

## Purpose

This pass turns the prototype from a functional Web3 arcade shell into a clearer, more polished player-facing experience. The goal is to help a first-time visitor understand the path from **Lester's Arcade portal → cabinet selection → mode choice → Hard Money Heroes combat → score sync** without needing a separate explanation.

## Brand direction

- **Name:** Lester's Arcade
- **Tagline:** LitVM retro arcade OS for wallet-owned players and cabinet dapps.
- **Look:** late-80s/early-90s cabinet floor, CRT glow, Litecoin silver, cyan/yellow/pink neon, SNES cartridge language, readable beginner-friendly Web3 labels.
- **Mood:** playful, high-energy, retro, but still understandable enough for a hackathon judge or potential partner.

## Color tokens

| Token | Role |
| --- | --- |
| `--bg` | deep CRT black background |
| `--panel` | midnight-purple glass panels |
| `--neon-cyan` | guidance, links, focus rings, control hints |
| `--neon-yellow` | score, coin, primary highlights |
| `--neon-green` | wallet connected, health, power-ups, success |
| `--neon-pink` | boss/rare energy, marquee accent |
| `--neon-red` | damage, danger, boss warnings |
| `--ltc-silver` | coin/knife/rail/chain icon strokes |

## Pattern language

- **CRT scanlines:** global overlay and retro screen texture.
- **Cabinet floor grid:** arcade stage and selection surfaces.
- **Coin halftone glow:** pickups, paid mode, score cards.
- **Boss warning stripe:** mini-boss locks, boss arenas, danger panels.

## Icon language

| Icon | Meaning |
| --- | --- |
| `▣` | wallet / parent account |
| `▥` | cabinet dapp |
| `◉` | paid credit / official run |
| `★` | official leaderboard / achievement |
| `?` | guide / tooltip |
| `⌁` | weapon / pickup |
| `⚠` | boss / danger |

## Guide and tooltip model

The UI now has a guide layer that explains:

1. Connect mock wallet.
2. Choose cabinet.
3. Choose free or paid mode.
4. Start combat.
5. Survive and score.
6. Sync a run result.

Tooltips attach to the core action controls:

- connect wallet
- free play
- paid play
- sync prototype result
- start combat
- jump
- shoot
- knife
- grenade
- power-up helper
- combat canvas
- leaderboard panel

## Controls polish

Keyboard baseline:

- `A` — move left
- `D` — move right
- `Space` — jump / double jump
- `J` — shoot
- `K` — Litecoin Blade
- `L` — Crypto Bomb / Hard Fork throwable
- `R` — reload concept

Gamepad target:

- D-pad / left stick — move
- A — jump
- X / RT — shoot
- B — knife
- Y / LB — grenade

## Quality checklist

Prototype pass now covers:

- portal → cabinet → game hierarchy
- tooltip coverage on primary actions
- keyboard and gamepad guide model
- shared palette, icon, and pattern language
- 60fps target surfaced in the combat HUD

Still needs production pass:

- final sprite sheets and animation timing
- live wallet/dappit/LitVM tooltip copy after integration
- full playable enemy collision, damage, death, and level-scroll systems
