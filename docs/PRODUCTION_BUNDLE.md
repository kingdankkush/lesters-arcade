# Production bundle (esbuild) — build & deploy notes

The portal historically shipped `apps/portal/main.js` (~485 KB raw, 10.8k lines)
and its 60-file static import graph (~371 KB gzipped at startup) directly to the
browser. `build.mjs` produces a minified, tree-shaken, code-split bundle.

## Commands

```bash
npm run build          # -> apps/portal/dist/main.js (+ shared chunks)
npm run build:meta     # also writes apps/portal/dist/meta.json for analysis
```

`apps/portal/dist/` is git-ignored — it is a build artifact, rebuilt fresh.

## Measured result (2026-06-24, esbuild 0.28.1)

| Metric | Before | After | Delta |
|---|---|---|---|
| Startup JS, raw | 1.62 MB (main.js + 60 static deps) | 944.6 KB (bundled main + 2 shared chunks) | -42.9% |
| Startup JS, gzipped | 371.1 KB | 223.1 KB | -39.9% |

Big lazy manifests (animated roster ~589 KB, production art pass, etc.) stay
code-split via `import()` and load only when a cabinet is selected — same as
before.

## CRITICAL constraints (already enforced in build.mjs)

1. **Asset URLs are runtime string literals**, resolved against `<base href="/">`
   (e.g. `"./assets/generated/.../00.png"`). esbuild only rewrites module
   `import` specifiers, never string literals, so these survive untouched. Do
   NOT add any `--loader:.png=file` / asset loader — it would try to bundle art.
2. **Dynamic `import()` seams are intentional** (cabinet loaders,
   `litvm-chain-client.mjs`, generated manifests). `splitting: true` + `format:
   'esm'` preserves them as separate lazily-fetched chunks.
3. **Output served from the same site root** (`apps/portal/dist/`), so any
   relative URL resolves identically to the source layout.

## Verification done

Bundled build was play-tested in-browser end-to-end via a temporary
`index.bundletest.html` pointing at `./dist/main.js`: splash → cabinet select →
free mode → hero select → BEGIN → Space → live combat. Canvas rendered the full
isometric scene (100% sampled pixels drawn), lazy HMH manifests loaded, and the
console reported **zero errors / zero warnings** through the whole flow.

## TO GO LIVE (deliberate, deploy-gated step — NOT yet done)

The served entry is still the unbundled source so the live site is byte-identical
until we choose to flip. To switch production to the bundle:

1. In `apps/portal/index.html`, change the entry script from
   `./main.js?v=<tag>` to `./dist/main.js?v=<new-tag>` (bump the tag).
2. Add `npm run build` to the `vercel:build` script in `package.json` so `dist/`
   exists at deploy time:
   `"vercel:build": "npm run assets:verify && npm test && npm run check && npm run contracts:check && npm run build"`
3. Update any smoke test / `index.html` cache-bust marker assertions that
   reference the old `main.js?v=` string.
4. Run the full gate + an in-browser play-test, then deploy (Justin-approved).

Service worker (`sw.js`) is network-first for scripts and only precaches
`/` + `/index.html`, so no SW change is required for the flip — no stale-cache trap.
