# Lester's Arcade Agent Notes

## Project identity

Lester's Arcade is a retro Litecoin-themed Web3 arcade portal on LitVM. The portal uses EVM wallets for identity, arcade cabinets as integrated dapp games, and a free-vs-paid mode split where paid play is eligible for global leaderboards, achievements, tournaments, and developer revenue splits.

## Operating rules

- Keep secrets out of files and prompts. Never ask for seed phrases or private keys.
- Do not deploy contracts, bridge funds, send transactions, post externally, or change accounts without explicit user approval.
- Prefer local prototypes and testnet-only planning until approval.
- Preserve the retro 80s/90s arcade aesthetic: CRT glow, pixel art, cabinet UI, neon, coin-slot language, NES/SNES/Neo Geo inspiration.
- Use LitVM docs as the source of truth for chain details; if docs and guesses conflict, docs win.

## Current Hard Money Heroes gameplay pivot

As of 2026-06-07, Hard Money Heroes is pivoting from a 2D side-scrolling run-and-gun into an **isometric run-and-gun roguelike / roguelite survival game**. Agents should treat `docs/game-design/hard-money-heroes-design-bible-v2.md` as the accepted content/design canon and `docs/game-design/hard-money-heroes-build-risk-review-v2-1.md` as the active implementation/QA/UX addendum. The original pivot doc remains historical context.

Art agents should use **Pixellab API** and other approved design tools to produce the missing isometric assets: isometric tilesets/chunks, 8-way hero/enemy/boss animation coverage, roguelike upgrade UI/icons, and combat VFX. Existing 2D buildings/trees/garbage cans/props can be reused only where they still read correctly from the isometric camera; accepted assets must be repo-local and manifest-ready before runtime integration.

## Verification

Run before handoff:

```bash
npm test
npm run check
npm run contracts:check
```

### Render-layer visual verification

Any change that touches isometric rendering, ground plane math, terrain cache/patterns, prop grounding, obstacle placement, depth sorting, loading/prewarm behavior, canvas camera projection, or `docs/testing/VISUAL_BASELINES/` must also run:

```bash
npm run visual:regression
```

Use `npm run visual:accept` only when the visual change is intentional. Review the new captures in `docs/testing/VISUAL_BASELINES/hmh-level-1/`, then commit the updated baseline PNGs with the code that changed the render output. Do not rely on screenshots alone: keep or add source-level tests for the math/policy, and use the visual harness as the browser proof that the live canvas still boots, waits through loading, captures seed `1337`, and passes the tight pixel-diff gate.

For UI changes, also serve locally and check the browser console. IMPORTANT: `apps/portal/index.html`
has `<base href="/" />` and uses root-relative asset paths, and Vercel serves the portal from the
site root (`outputDirectory: apps/portal`). So you MUST serve `apps/portal` itself as the web root —
NOT the repo root:

```bash
cd apps/portal && python -m http.server 8791    # then open http://127.0.0.1:8791/
```

Serving the repo root and opening `/apps/portal/` will 404 every asset (main.js, styles.css, images),
because `<base href="/">` resolves them against `/` — the app will appear completely dead with no
console errors. This is a local-serving artifact only; production (Vercel root) is correct.

## Repo asset hygiene

The repo holds code, tests, contracts, docs, integrated runtime assets (atlases + manifests), QA
reports, and small SFX/brand art. Raw generation output, reference-art dumps, audio/video masters,
downloaded ZIPs, and prompt/error logs live in `~/lesters-arcade-vault/` or a gitignored staging
folder, not in committed `apps/portal/assets/`. Any new asset wave should land as: raw output → vault,
integrated frames → atlas/runtime manifest, manifest + QA report/contact sheet → repo.
