# Lester's Arcade brand kit

## Product identity

Lester's Arcade is a retro Litecoin arcade portal. Hard Money Heroes is its flagship isometric survival cabinet. The visual language combines late-1980s and early-1990s arcade chrome with Litecoin blue, silver, brass, CRT glow, and satirical fiat-corruption accents.

## Source of truth

Runtime interface tokens live in `apps/portal/src/design-tokens.css`. New portal and HUD styles should consume semantic variables rather than introducing another root palette or font family.

## Palette

| Role | Token | Value |
|---|---|---|
| Litecoin blue | `--litecoin-blue` | `#345DCC` |
| Silver highlight | `--silver-100` | `#EAF2FF` |
| Deep navy | `--navy-850` | `#0D182A` |
| Brass | `--brass` | `#C9A34E` |
| Crypto cyan | `--crypto-cyan` | `#19F7FF` |
| Crypto green | `--crypto-green` | `#45FF8A` |
| Fiat magenta | `--fiat-magenta` | `#FF3DF2` |
| Danger | `--danger` | `#FF476F` |

Use semantic aliases such as `--surface`, `--text-primary`, `--accent`, `--success`, `--warning`, and `--danger` in components. Canvas-only biome, projectile, lighting, and faction colors remain authored gameplay data and are not interface tokens.

## Typography

The portal uses two local/system families and makes no third-party font request:

1. `--font-display`: Trebuchet MS / Arial Black fallback for arcade headings and marquee moments.
2. `--font-ui`: the operating-system UI stack for menus, settings, profiles, and readable body text.

`--font-mono` is a constrained compatibility face for code-like wallet addresses and telemetry, not a third visual family. Stats use `.tabular-numerals` or `[data-stat]`.

Type scale: 12, 14, 16, 20, 28, and 40 pixels through `--type-12` to `--type-40`.

## Spacing and shape

Use `--space-1` through `--space-7`, `--radius-sm` through `--radius-xl`, `--shadow-panel`, and `--focus-ring`. Interactive controls require a visible `:focus-visible` state and at least a 44px touch target at phone breakpoints.

## Iconography

Current cabinet controls use the existing pixel/chrome vocabulary and accessible text labels. New icons should use a 32px grid and one consistent filled-pixel or 2px-stroke treatment. Emoji must not be the sole accessible label. Until a bespoke icon sheet is approved, text-backed controls are preferred over mixing external icon libraries.

## Asset and metadata policy

- Runtime assets must be repository-local, manifest-backed, or explicitly CDN-backed.
- Raw generation outputs, source reference dumps, and contact-sheet working files belong in `~/lesters-arcade-vault/`.
- Social metadata must describe the current settlement posture accurately.
- The favicon, PWA manifest, OpenGraph image, and Twitter card must resolve from the production domain.
